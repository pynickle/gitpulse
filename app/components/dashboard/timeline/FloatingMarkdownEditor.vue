<template>
  <div
    v-show="!isAnyModalOpen"
    :class="[
      'floating-markdown-editor',
      {
        'floating-markdown-editor--expanded': isExpanded,
        'floating-markdown-editor--compact': compact,
        'floating-markdown-editor--bleed': isBleeding,
      },
    ]"
    :aria-hidden="isAnyModalOpen ? 'true' : undefined"
    :inert="isAnyModalOpen || undefined"
  >
    <div v-if="errorMessage" class="notification is-danger is-light mb-3 py-2 px-3">
      <button
        class="delete is-small"
        type="button"
        :aria-label="t('floatingMarkdownEditor.dismissError')"
        @click="errorMessage = ''"
      />
      <p class="is-size-7">{{ errorMessage }}</p>
    </div>

    <button
      v-if="!compact && !isExpanded"
      class="floating-markdown-editor__capsule button is-light"
      type="button"
      @click="expandComposer"
    >
      <GitHubAvatar
        variant="raised"
        interactive
        width="28"
        height="28"
        :src="currentUserAvatar"
        :alt="currentUserLogin"
        class="floating-markdown-editor__capsule-avatar"
      />
      <span class="floating-markdown-editor__capsule-placeholder has-text-grey">
        {{ placeholder }}
      </span>
      <span class="button is-link is-small floating-markdown-editor__capsule-submit">
        {{ submitLabel }}
      </span>
    </button>

    <div
      v-if="isBleeding"
      ref="placeholderRef"
      class="floating-markdown-editor__bleed-spacer floating-markdown-editor__bleed-spacer--active"
      :style="{ height: `${bleedPanelHeight}px` }"
      aria-hidden="true"
    />

    <Teleport :to="bleedTarget" :disabled="!isBleeding">
      <div
        v-if="compact || isExpanded"
        v-show="!isAnyModalOpen"
        ref="panelRef"
        class="floating-markdown-editor__panel"
        :class="{ 'floating-markdown-editor__panel--bleed': isBleeding }"
        :style="isBleeding ? bleedStyle : undefined"
        :aria-hidden="isAnyModalOpen ? 'true' : undefined"
        :inert="isAnyModalOpen || undefined"
      >
        <MarkdownComposer
          ref="composerRef"
          v-model="draft"
          :surface="composerSurface"
          :repo-owner="repoOwner"
          :repo-name="repoName"
          :placeholder="placeholder"
          :disabled="isSubmitting"
          :compact="compact"
          :autofocus="autofocus || isExpanded"
          :expanded="compact || isExpanded"
          @update:bleed="composerBleed = $event"
        >
          <template #header-meta>
            <span v-if="!compact" class="is-size-7 has-text-weight-medium has-text-grey">{{
              currentUserLogin
            }}</span>
            <GitHubAvatar
              variant="raised"
              interactive
              width="22"
              height="22"
              :src="currentUserAvatar"
              :alt="currentUserLogin"
              class="floating-markdown-editor__avatar"
            />
          </template>
        </MarkdownComposer>

        <div class="floating-markdown-editor__footer">
          <p class="is-size-7 has-text-grey mb-0">
            {{ t('floatingMarkdownEditor.markdownHint') }}
          </p>
          <div class="floating-markdown-editor__footer-actions">
            <button
              class="button is-light is-small"
              type="button"
              :disabled="isSubmitting"
              @click="collapseComposer"
            >
              {{ t('floatingMarkdownEditor.cancel') }}
            </button>
            <button
              class="button is-link is-small"
              type="button"
              :class="{ 'is-loading': isSubmitting }"
              :disabled="isSubmitting || !trimmedDraft || !canSubmit"
              @click="handleSubmit"
            >
              {{ isSubmitting ? submittingLabel : submitLabel }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, shallowRef, useTemplateRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import {
  COMPOSER_BLEED_MAX_VIEWPORT_WIDTH,
  resolveComposerInitialLayout,
  shouldComposerBleed,
  type ComposerSurface,
} from '#shared/utils/composer-presentation';
import MarkdownComposer from '~/components/dashboard/composer/MarkdownComposer.vue';
import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';

interface CreatedCommentResponse {
  id?: number | string;
  node_id?: string;
  body?: string;
  html_url?: string;
  created_at?: string;
  user?: {
    login?: string;
    avatar_url?: string;
    html_url?: string;
    type?: string;
  };
}

type TimelineCommentItem = {
  kind: 'comment';
  eventType: 'commented';
  id: string;
  createdAt: string;
  body: string;
  url?: string;
  timelineSource: 'local.created';
  author: {
    login?: string;
    avatarUrl?: string;
    url?: string;
    resourceType?: string;
  };
};

type SubmitHandler = (body: string) => Promise<void>;

const props = withDefaults(
  defineProps<{
    repoOwner: string;
    repoName: string;
    itemNumber?: number | null;
    submit?: SubmitHandler | null;
    placeholder?: string;
    submitLabel?: string;
    submittingLabel?: string;
    modelValue?: string;
    compact?: boolean;
    autofocus?: boolean;
    submitting?: boolean;
  }>(),
  {
    itemNumber: null,
    submit: null,
    placeholder: undefined,
    submitLabel: undefined,
    submittingLabel: undefined,
    modelValue: undefined,
    compact: false,
    autofocus: false,
    submitting: false,
  }
);

const emit = defineEmits<{
  (e: 'comment-created', item: TimelineCommentItem): void;
  (e: 'submitted'): void;
  (e: 'error', message: string): void;
  (e: 'expanded'): void;
  (e: 'collapsed'): void;
  (e: 'update:modelValue', value: string): void;
}>();

const { t } = useI18n();
const apiFetch = useGitPulseApiFetch();
const { user } = useUserSession();
const { isAnyModalOpen } = useModalState();

const composerRef = useTemplateRef<InstanceType<typeof MarkdownComposer>>('composerRef');
const placeholderRef = useTemplateRef<HTMLElement>('placeholderRef');
const panelRef = useTemplateRef<HTMLElement>('panelRef');
const isExpanded = shallowRef(false);
const internalSubmitting = shallowRef(false);
const draft = shallowRef(props.modelValue ?? '');
const errorMessage = shallowRef('');
const { settings } = useUserSettings();
const composerSurface = computed<ComposerSurface>(() =>
  props.compact ? 'conversation-reply' : 'conversation-sticky'
);

const seedBleedFromSettings = () => {
  const isNarrowViewport =
    import.meta.client &&
    window.matchMedia(`(max-width: ${COMPOSER_BLEED_MAX_VIEWPORT_WIDTH}px)`).matches;

  composerBleed.value = shouldComposerBleed({
    surface: composerSurface.value,
    layout: resolveComposerInitialLayout(composerSurface.value, settings.value.composer),
    expanded: true,
    viewportWidth: isNarrowViewport
      ? COMPOSER_BLEED_MAX_VIEWPORT_WIDTH
      : COMPOSER_BLEED_MAX_VIEWPORT_WIDTH + 1,
  });
};

const composerBleed = shallowRef(false);
seedBleedFromSettings();

const isBleeding = computed(() => composerBleed.value && !props.compact && isExpanded.value);
const {
  bleedStyle,
  panelHeight: bleedPanelHeight,
  bleedTarget,
} = useComposerBleedPosition({
  enabled: isBleeding,
  placeholder: placeholderRef,
  panel: panelRef,
});

const trimmedDraft = computed(() => draft.value.trim());
const currentUserLogin = computed(() => user.value?.login || '');
const currentUserAvatar = computed(() => user.value?.avatar_url || '');
const isSelfSubmitMode = computed(() => props.itemNumber != null);
const isCallbackMode = computed(() => props.submit != null);
const canSubmit = computed(() => {
  if (isSelfSubmitMode.value) {
    return Boolean(props.repoOwner && props.repoName && props.itemNumber);
  }
  return isCallbackMode.value;
});
const isSubmitting = computed(() => {
  if (isCallbackMode.value) {
    return props.submitting;
  }
  return internalSubmitting.value;
});
const placeholder = computed(() => props.placeholder || t('floatingMarkdownEditor.placeholder'));
const submitLabel = computed(() => props.submitLabel || t('floatingMarkdownEditor.submit'));
const submittingLabel = computed(
  () => props.submittingLabel || t('floatingMarkdownEditor.submitting')
);

const setDraft = (value: string) => {
  draft.value = value;
  emit('update:modelValue', value);
};

watch(draft, (value) => {
  if (value !== props.modelValue) {
    emit('update:modelValue', value);
  }
});

watch(
  () => props.modelValue,
  (value) => {
    if (value === undefined || value === draft.value) return;
    draft.value = value;
  }
);

const focus = async () => {
  await nextTick();
  composerRef.value?.focus();
};

const expandComposer = async () => {
  seedBleedFromSettings();
  isExpanded.value = true;
  emit('expanded');
  await nextTick();
  composerRef.value?.seedLayout();
  await focus();
};

const reset = () => {
  setDraft('');
  errorMessage.value = '';
};

const collapseComposer = () => {
  isExpanded.value = false;
  reset();
  emit('collapsed');
};

const handleSubmit = async () => {
  if (!trimmedDraft.value) {
    errorMessage.value = t('floatingMarkdownEditor.emptyError');
    return;
  }

  if (!canSubmit.value) {
    errorMessage.value = t('floatingMarkdownEditor.unavailableError');
    return;
  }

  errorMessage.value = '';

  try {
    if (isSelfSubmitMode.value && props.itemNumber) {
      await selfSubmit();
    } else if (isCallbackMode.value && props.submit) {
      await props.submit(trimmedDraft.value);
      emit('submitted');
    }

    reset();
    if (!props.compact) {
      isExpanded.value = false;
    } else {
      composerRef.value?.seedLayout();
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : t('floatingMarkdownEditor.submitFailed');
    errorMessage.value = message;
    emit('error', message);
  }
};

const selfSubmit = async () => {
  if (!props.itemNumber) return;

  internalSubmitting.value = true;

  try {
    const response = await apiFetch<CreatedCommentResponse>(
      `/api/repos/${props.repoOwner}/${props.repoName}/issues/${props.itemNumber}/comments`,
      {
        method: 'POST',
        body: {
          body: trimmedDraft.value,
        },
      }
    );

    emit('comment-created', {
      kind: 'comment',
      eventType: 'commented',
      id: String(response.id ?? response.node_id ?? `local-comment-${Date.now()}`),
      createdAt: response.created_at ?? new Date().toISOString(),
      body: response.body ?? trimmedDraft.value,
      url: response.html_url,
      timelineSource: 'local.created',
      author: {
        login: response.user?.login ?? user.value?.login,
        avatarUrl: response.user?.avatar_url ?? user.value?.avatar_url,
        url:
          response.user?.html_url ??
          (user.value?.login ? `https://github.com/${user.value.login}` : undefined),
        resourceType: response.user?.type,
      },
    });
  } finally {
    internalSubmitting.value = false;
  }
};

if (props.autofocus) {
  isExpanded.value = true;
  void focus();
}

defineExpose({ focus });
</script>

<style scoped lang="scss">
.floating-markdown-editor {
  position: sticky;
  bottom: 1rem;
  z-index: 6;
  padding-top: 0.5rem;
}

.floating-markdown-editor__capsule {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 52px;
  gap: 0.75rem;
  padding: 0.625rem 0.625rem 0.625rem 1rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 20px;
  background: color-mix(in srgb, var(--gitpulse-surface) 92%, transparent);
  backdrop-filter: blur(10px);
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.06),
    0 4px 8px rgba(0, 0, 0, 0.05),
    0 8px 16px rgba(0, 0, 0, 0.04);
  text-align: left;
  cursor: text;

  &:hover {
    box-shadow:
      0 1px 2px rgba(0, 0, 0, 0.06),
      0 4px 8px rgba(0, 0, 0, 0.05),
      0 8px 16px rgba(0, 0, 0, 0.04),
      inset 0 0 0 1px var(--gitpulse-border);
  }

  &:active {
    box-shadow:
      0 1px 2px rgba(0, 0, 0, 0.04),
      0 2px 4px rgba(0, 0, 0, 0.03);
  }
}

.floating-markdown-editor__capsule-avatar {
  flex: none;
}

.floating-markdown-editor__capsule-placeholder {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.floating-markdown-editor__capsule-submit {
  flex: none;
}

.floating-markdown-editor__bleed-spacer--active {
  width: 100%;
}

.floating-markdown-editor__panel {
  border: 1px solid var(--gitpulse-border);
  border-radius: 16px;
  padding: 1rem;
  background: color-mix(in srgb, var(--gitpulse-surface) 92%, transparent);
  backdrop-filter: blur(10px);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.03),
    0 2px 4px rgba(0, 0, 0, 0.04),
    0 4px 8px rgba(0, 0, 0, 0.03),
    0 8px 16px rgba(0, 0, 0, 0.02);
}

.floating-markdown-editor__panel--bleed {
  width: auto;
}

.floating-markdown-editor__avatar {
  flex: none;
}

.floating-markdown-editor__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 0.75rem;
}

.floating-markdown-editor__footer-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.floating-markdown-editor--compact .floating-markdown-editor__panel {
  border-radius: 8px;
  backdrop-filter: none;
  background: var(--gitpulse-surface);
  box-shadow: none;
}

@media (max-width: 768px) {
  .floating-markdown-editor {
    bottom: 0.5rem;
  }

  .floating-markdown-editor__capsule {
    min-height: 48px;
    padding: 0.5rem 0.5rem 0.5rem 0.75rem;
  }

  .floating-markdown-editor__footer {
    align-items: stretch;
    flex-direction: column;
    gap: 0.5rem;
  }

  .floating-markdown-editor__footer-actions {
    justify-content: flex-end;
  }
}
</style>
