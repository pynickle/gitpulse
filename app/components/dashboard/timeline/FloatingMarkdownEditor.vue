<template>
  <div
    v-show="!isAnyModalOpen"
    :class="[
      'floating-markdown-editor',
      {
        'floating-markdown-editor--expanded': isExpanded,
        'floating-markdown-editor--compact': compact,
        'floating-markdown-editor--bleed': isBleeding,
        'floating-markdown-editor--narrow-sheet': isNarrowSheetMode,
      },
    ]"
    :aria-hidden="isAnyModalOpen ? 'true' : undefined"
    :inert="isAnyModalOpen || undefined"
  >
    <template v-if="isNarrowSheetMode">
      <Teleport :to="sheetTeleportTarget">
        <div
          v-if="isComposerSheetOpen"
          v-show="!isAnyModalOpen"
          class="detail-composer-sheet-layer-item"
          :class="{ 'detail-sheet--fixed': !hasSheetLayer }"
        >
          <button
            type="button"
            class="detail-composer-sheet-backdrop"
            tabindex="-1"
            :aria-label="t('detailOverlay.closeComposer')"
            @click="dismissComposerSheet"
          />
          <aside
            class="detail-composer-sheet"
            :class="{ 'is-dragging': sheetDragging }"
            :style="sheetStyle"
            role="dialog"
            aria-modal="true"
            :aria-label="t('detailOverlay.writeComment')"
            tabindex="-1"
          >
            <div
              class="detail-composer-sheet__handle-bar"
              @pointerdown="onSheetPointerDown"
              @pointermove="onSheetPointerMove"
              @pointerup="onSheetPointerUp"
              @pointercancel="onSheetPointerCancel"
              @lostpointercapture="onSheetPointerCancel"
            >
              <span class="detail-composer-sheet__handle" aria-hidden="true" />
            </div>

            <ScrollArea class="detail-composer-sheet__scroll" axis="y">
              <div
                v-if="errorMessage"
                class="gp-notice gp-notice--danger gp-notice--compact floating-markdown-editor__error"
                role="alert"
              >
                <button
                  class="gp-dismiss gp-dismiss--small"
                  type="button"
                  :aria-label="t('floatingMarkdownEditor.dismissError')"
                  @click="errorMessage = ''"
                />
                <p class="floating-markdown-editor__error-text">{{ errorMessage }}</p>
              </div>

              <div class="detail-composer-sheet__body">
                <MarkdownComposer
                  ref="composerRef"
                  v-model="draft"
                  :surface="composerSurface"
                  :repo-owner="repoOwner"
                  :repo-name="repoName"
                  :placeholder="resolvedPlaceholder"
                  :disabled="isSubmitting"
                  :compact="false"
                  :autofocus="true"
                  :expanded="true"
                  @update:bleed="composerBleed = $event"
                >
                  <template #header-meta>
                    <span class="floating-markdown-editor__login">{{ currentUserLogin }}</span>
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
                  <div class="floating-markdown-editor__footer-actions">
                    <button
                      class="gp-btn gp-btn--light gp-btn--small"
                      type="button"
                      :disabled="isSubmitting"
                      @click="collapseComposer"
                    >
                      {{ t('floatingMarkdownEditor.cancel') }}
                    </button>
                    <button
                      class="gp-btn gp-btn--link gp-btn--small"
                      type="button"
                      :class="{ 'gp-btn--loading': isSubmitting }"
                      :disabled="isSubmitting || !trimmedDraft || !canSubmit"
                      :aria-busy="isSubmitting || undefined"
                      @click="handleSubmit"
                    >
                      {{ isSubmitting ? resolvedSubmittingLabel : resolvedSubmitLabel }}
                    </button>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </aside>
        </div>
      </Teleport>
    </template>

    <template v-else>
      <div
        v-if="errorMessage"
        class="gp-notice gp-notice--danger gp-notice--compact floating-markdown-editor__error"
        role="alert"
      >
        <button
          class="gp-dismiss gp-dismiss--small"
          type="button"
          :aria-label="t('floatingMarkdownEditor.dismissError')"
          @click="errorMessage = ''"
        />
        <p class="floating-markdown-editor__error-text">{{ errorMessage }}</p>
      </div>

      <button
        v-if="!compact && !isExpanded"
        class="floating-markdown-editor__capsule gp-btn gp-btn--light"
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
        <span class="floating-markdown-editor__capsule-placeholder">
          {{ resolvedPlaceholder }}
        </span>
        <span class="gp-btn gp-btn--link gp-btn--small floating-markdown-editor__capsule-submit">
          {{ resolvedSubmitLabel }}
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
            :placeholder="resolvedPlaceholder"
            :disabled="isSubmitting"
            :compact="compact"
            :autofocus="autofocus || isExpanded"
            :expanded="compact || isExpanded"
            @update:bleed="composerBleed = $event"
          >
            <template #header-meta>
              <span v-if="!compact" class="floating-markdown-editor__login">{{
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
            <div class="floating-markdown-editor__footer-actions">
              <button
                class="gp-btn gp-btn--light gp-btn--small"
                type="button"
                :disabled="isSubmitting"
                @click="collapseComposer"
              >
                {{ t('floatingMarkdownEditor.cancel') }}
              </button>
              <button
                class="gp-btn gp-btn--link gp-btn--small"
                type="button"
                :class="{ 'gp-btn--loading': isSubmitting }"
                :disabled="isSubmitting || !trimmedDraft || !canSubmit"
                :aria-busy="isSubmitting || undefined"
                @click="handleSubmit"
              >
                {{ isSubmitting ? resolvedSubmittingLabel : resolvedSubmitLabel }}
              </button>
            </div>
          </div>
        </div>
      </Teleport>
    </template>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  useTemplateRef,
  watch,
} from 'vue';
import { useI18n } from 'vue-i18n';

import {
  COMPOSER_BLEED_MAX_VIEWPORT_WIDTH,
  resolveComposerInitialLayout,
  shouldComposerBleed,
  type ComposerSurface,
} from '#shared/utils/composer-presentation';
import MarkdownComposer from '~/components/dashboard/composer/MarkdownComposer.vue';
import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';
import ScrollArea from '~/components/ui/ScrollArea.vue';
import { useComposerBleedPosition } from '~/composables/useComposerBleedPosition';
import {
  DETAIL_SHEET_LAYER_ID,
  useDetailOverlayChrome,
} from '~/composables/useDetailOverlayChrome';
import { useDetailSheetDrag } from '~/composables/useDetailSheetDrag';

interface CreatedCommentResponse {
  moderation?: import('#shared/types/comment-moderation').CommentModeration;
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
  moderation?: import('#shared/types/comment-moderation').CommentModeration;
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

const {
  repoOwner,
  repoName,
  itemNumber = null,
  submit = null,
  placeholder,
  submitLabel,
  submittingLabel,
  modelValue,
  compact = false,
  autofocus = false,
  submitting = false,
} = defineProps<{
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
}>();

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
const chrome = useDetailOverlayChrome();

const composerRef = useTemplateRef<InstanceType<typeof MarkdownComposer>>('composerRef');
const placeholderRef = useTemplateRef<HTMLElement>('placeholderRef');
const panelRef = useTemplateRef<HTMLElement>('panelRef');
const isExpanded = shallowRef(false);
const internalSubmitting = shallowRef(false);
const draft = shallowRef(modelValue ?? '');
const errorMessage = shallowRef('');
const hasSheetLayer = shallowRef(false);
const { settings } = useUserSettings();
const composerSurface = computed<ComposerSurface>(() =>
  compact ? 'conversation-reply' : 'conversation-sticky'
);
const isNarrowSheetMode = computed(() => !compact && Boolean(chrome?.isNarrowViewport.value));
const isComposerSheetOpen = computed(
  () => isNarrowSheetMode.value && chrome?.openSheet.value === 'composer'
);
const sheetTeleportTarget = computed(() =>
  hasSheetLayer.value ? `#${DETAIL_SHEET_LAYER_ID}` : 'body'
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

const isBleeding = computed(
  () => !isNarrowSheetMode.value && composerBleed.value && !compact && isExpanded.value
);
const {
  bleedStyle,
  panelHeight: bleedPanelHeight,
  bleedTarget,
} = useComposerBleedPosition({
  enabled: isBleeding,
  placeholder: placeholderRef,
  panel: panelRef,
});

const dismissComposerSheet = () => {
  chrome?.dispatch({ type: 'dismiss-sheet' });
};

const {
  dragging: sheetDragging,
  sheetStyle,
  onPointerDown: onSheetPointerDown,
  onPointerMove: onSheetPointerMove,
  onPointerUp: onSheetPointerUp,
  onPointerCancel: onSheetPointerCancel,
} = useDetailSheetDrag({
  open: isComposerSheetOpen,
  onDismiss: dismissComposerSheet,
});

const trimmedDraft = computed(() => draft.value.trim());
const currentUserLogin = computed(() => user.value?.login || '');
const currentUserAvatar = computed(() => user.value?.avatar_url || '');
const isSelfSubmitMode = computed(() => itemNumber != null);
const isCallbackMode = computed(() => submit != null);
const canSubmit = computed(() => {
  if (isSelfSubmitMode.value) {
    return Boolean(repoOwner && repoName && itemNumber);
  }
  return isCallbackMode.value;
});
const isSubmitting = computed(() => {
  if (isCallbackMode.value) {
    return submitting;
  }
  return internalSubmitting.value;
});
const resolvedPlaceholder = computed(() => placeholder || t('floatingMarkdownEditor.placeholder'));
const resolvedSubmitLabel = computed(() => submitLabel || t('floatingMarkdownEditor.submit'));
const resolvedSubmittingLabel = computed(
  () => submittingLabel || t('floatingMarkdownEditor.submitting')
);

const setDraft = (value: string) => {
  draft.value = value;
  emit('update:modelValue', value);
};

watch(draft, (value) => {
  if (value !== modelValue) {
    emit('update:modelValue', value);
  }
});

watch(
  () => modelValue,
  (value) => {
    if (value === undefined || value === draft.value) return;
    draft.value = value;
  }
);

watch(
  () => Boolean(trimmedDraft.value),
  (hasDraft) => {
    if (!compact) {
      chrome?.setComposerDraft(hasDraft);
    }
  },
  { immediate: true }
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
  if (isNarrowSheetMode.value) {
    chrome?.dispatch({ type: 'cancel-composer' });
  }
  emit('collapsed');
};

const handleComposerSheetEscape = (event: KeyboardEvent) => {
  if (!isComposerSheetOpen.value || event.key !== 'Escape' || event.defaultPrevented) {
    return;
  }

  if (isAnyModalOpen.value) {
    return;
  }

  event.preventDefault();
  dismissComposerSheet();
};

const bindComposerSheetEscape = (active: boolean) => {
  if (typeof document === 'undefined') return;
  if (active) {
    document.addEventListener('keydown', handleComposerSheetEscape);
  } else {
    document.removeEventListener('keydown', handleComposerSheetEscape);
  }
};

watch(
  isComposerSheetOpen,
  (open) => {
    bindComposerSheetEscape(open);
    if (open) {
      isExpanded.value = true;
      seedBleedFromSettings();
      void nextTick().then(async () => {
        composerRef.value?.seedLayout();
        await focus();
      });
    } else if (isNarrowSheetMode.value) {
      isExpanded.value = false;
    }
  },
  { immediate: true }
);

onMounted(() => {
  hasSheetLayer.value = Boolean(document.getElementById(DETAIL_SHEET_LAYER_ID));
});

onBeforeUnmount(() => {
  bindComposerSheetEscape(false);
  if (!compact && modelValue === undefined) {
    chrome?.setComposerDraft(false);
  }
});

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
    if (isSelfSubmitMode.value && itemNumber) {
      await selfSubmit();
    } else if (isCallbackMode.value && submit) {
      await submit(trimmedDraft.value);
      emit('submitted');
    }

    reset();
    if (isNarrowSheetMode.value) {
      isExpanded.value = false;
      chrome?.dispatch({ type: 'submit-composer' });
    } else if (!compact) {
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
  if (!itemNumber) return;

  internalSubmitting.value = true;

  try {
    const response = await apiFetch<CreatedCommentResponse>(
      `/api/repos/${repoOwner}/${repoName}/issues/${itemNumber}/comments`,
      {
        method: 'POST',
        body: {
          body: trimmedDraft.value,
        },
      }
    );

    emit('comment-created', {
      moderation: response.moderation,
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

if (autofocus) {
  isExpanded.value = true;
  void focus();
}

defineExpose({ focus });
</script>

<style scoped lang="scss">
@use '~/assets/scss/pointer' as *;

.floating-markdown-editor {
  position: sticky;
  bottom: 1rem;
  z-index: 6;
  padding-top: 0.5rem;
}

.floating-markdown-editor--narrow-sheet {
  display: none;
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

  @include hover-only {
    &:hover {
      box-shadow:
        0 1px 2px rgba(0, 0, 0, 0.06),
        0 4px 8px rgba(0, 0, 0, 0.05),
        0 8px 16px rgba(0, 0, 0, 0.04),
        inset 0 0 0 1px var(--gitpulse-border);
    }
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
  color: var(--gitpulse-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.floating-markdown-editor__error {
  margin-bottom: 0.75rem;
}

.floating-markdown-editor__error-text {
  font-size: 0.75rem;
}

.floating-markdown-editor__login {
  color: var(--gitpulse-text-muted);
  font-size: 0.75rem;
  font-weight: 500;
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
  justify-content: flex-end;
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

.detail-composer-sheet-layer-item {
  position: absolute;
  inset: 0;
  pointer-events: none;

  &.detail-sheet--fixed {
    position: fixed;
    z-index: 9999;
  }
}

.detail-composer-sheet-backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  padding: 0;
  background: rgb(0 0 0 / 0.4);
  pointer-events: auto;
  cursor: pointer;
  touch-action: none;
}

.detail-composer-sheet {
  position: absolute;
  right: 0;
  bottom: var(--detail-keyboard-inset, 0px);
  left: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  max-height: min(
    75dvh,
    calc(100% - var(--detail-keyboard-inset, 0px) - 0.5rem),
    calc(var(--detail-keyboard-visible-height, 100%) - 0.5rem)
  );
  padding: 0;
  overflow: hidden;
  overscroll-behavior: contain;
  border-radius: 16px 16px 0 0;
  background: var(--gitpulse-surface);
  box-shadow: 0 -8px 32px rgb(0 0 0 / 0.25);
  pointer-events: auto;
  transition: transform 0.22s cubic-bezier(0.32, 0.72, 0, 1);

  &.is-dragging {
    transition: none;
  }
}

.detail-composer-sheet__scroll {
  flex: 1 1 auto;
  min-height: 0;
  max-height: calc(75dvh - 1.5rem);
  padding: 0 1rem 1rem;
  overscroll-behavior: contain;
}

.detail-composer-sheet__handle-bar {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.65rem 0 0.55rem;
  touch-action: none;
  cursor: grab;
}

.detail-composer-sheet.is-dragging .detail-composer-sheet__handle-bar {
  cursor: grabbing;
}

.detail-composer-sheet__handle {
  width: 2.25rem;
  height: 0.25rem;
  border-radius: 999px;
  background: var(--gitpulse-border-strong, var(--gitpulse-border));
}

.detail-composer-sheet__body {
  display: flex;
  flex-direction: column;
  min-height: 0;
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

@media (prefers-reduced-motion: reduce) {
  .detail-composer-sheet {
    transition: none;
  }
}
</style>
