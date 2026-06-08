<script setup lang="ts">
import { computed, nextTick, shallowRef, useTemplateRef } from 'vue';
import { useI18n } from 'vue-i18n';

import MarkdownRenderer from '~/components/ui/MarkdownRenderer.vue';
import RoundImg from '~/components/ui/RoundImg.vue';

type DiscussionSubmitHandler = (body: string) => Promise<void>;

const props = withDefaults(
  defineProps<{
    repoOwner: string;
    repoName: string;
    placeholder: string;
    submitLabel: string;
    submittingLabel: string;
    submit: DiscussionSubmitHandler;
    submitting?: boolean;
    compact?: boolean;
    autofocus?: boolean;
  }>(),
  {
    submitting: false,
    compact: false,
    autofocus: false,
  }
);

const { t } = useI18n();
const { user } = useUserSession();
const textareaRef = useTemplateRef<HTMLTextAreaElement>('textareaRef');
const draft = shallowRef('');
const errorMessage = shallowRef('');
const activeTab = shallowRef<'write' | 'preview'>('write');
const isExpanded = shallowRef(false);

const trimmedDraft = computed(() => draft.value.trim());
const currentUserLogin = computed(() => user.value?.login || t('discussionDetail.authorFallback'));
const currentUserAvatar = computed(
  () => user.value?.avatar_url || 'https://github.com/placeholder.png'
);

const focus = async () => {
  await nextTick();
  textareaRef.value?.focus();
};

const expandComposer = async () => {
  isExpanded.value = true;
  activeTab.value = 'write';
  await nextTick();
  textareaRef.value?.focus();
};

const collapseComposer = () => {
  isExpanded.value = false;
  reset();
};

const reset = () => {
  draft.value = '';
  errorMessage.value = '';
  activeTab.value = 'write';
};

const submitDraft = async () => {
  if (!trimmedDraft.value) {
    errorMessage.value = t('discussionDetail.emptyComment');
    return;
  }

  errorMessage.value = '';

  try {
    await props.submit(trimmedDraft.value);
    reset();
    if (!props.compact) {
      isExpanded.value = false;
    }
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : t('discussionDetail.submitFailed');
  }
};

if (props.autofocus) {
  void focus();
}

defineExpose({ focus });
</script>

<template>
  <div :class="['discussion-composer', { 'discussion-composer--compact': compact }]">
    <div v-if="errorMessage" class="notification is-danger is-light mb-3 py-2 px-3">
      <button
        class="delete is-small"
        type="button"
        :aria-label="t('discussionDetail.dismissError')"
        @click="errorMessage = ''"
      />
      <p class="is-size-7">{{ errorMessage }}</p>
    </div>

    <!-- Collapsed capsule (main composer only) -->
    <button
      v-if="!compact && !isExpanded"
      class="discussion-composer__capsule button is-light"
      type="button"
      @click="expandComposer"
    >
      <RoundImg
        width="28"
        height="28"
        :src="currentUserAvatar"
        :alt="currentUserLogin"
        class="discussion-composer__capsule-avatar"
      />
      <span class="discussion-composer__capsule-placeholder has-text-grey">
        {{ placeholder }}
      </span>
      <span class="button is-link is-small discussion-composer__capsule-submit">
        {{ submitLabel }}
      </span>
    </button>

    <!-- Expanded panel -->
    <div v-if="compact || isExpanded" class="discussion-composer__panel">
      <div class="discussion-composer__header">
        <RoundImg
          width="28"
          height="28"
          :src="currentUserAvatar"
          :alt="currentUserLogin"
          class="discussion-composer__avatar"
        />
        <div v-if="!compact" class="discussion-composer__header-copy">
          <span class="is-size-7 has-text-weight-medium">{{ currentUserLogin }}</span>
        </div>
        <div class="discussion-composer__tabs tabs is-boxed is-small mb-0">
          <ul>
            <li :class="{ 'is-active': activeTab === 'write' }">
              <a href="#" @click.prevent="activeTab = 'write'">
                {{ t('discussionDetail.writeTab') }}
              </a>
            </li>
            <li :class="{ 'is-active': activeTab === 'preview' }">
              <a href="#" @click.prevent="activeTab = 'preview'">
                {{ t('discussionDetail.previewTab') }}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <textarea
        v-if="activeTab === 'write'"
        ref="textareaRef"
        v-model="draft"
        class="textarea discussion-composer__textarea"
        :rows="compact ? 4 : 6"
        :placeholder="placeholder"
        :disabled="submitting"
      />

      <div v-else class="discussion-composer__preview content">
        <MarkdownRenderer
          v-if="trimmedDraft"
          :value="draft"
          :repo-owner="repoOwner"
          :repo-name="repoName"
        />
        <p v-else class="has-text-grey is-size-7 mb-0">
          {{ t('discussionDetail.previewEmpty') }}
        </p>
      </div>

      <div class="discussion-composer__footer">
        <p class="is-size-7 has-text-grey mb-0">
          {{ t('discussionDetail.markdownHint') }}
        </p>
        <div class="discussion-composer__footer-actions">
          <button
            v-if="!compact"
            class="button is-light is-small"
            type="button"
            :disabled="submitting"
            @click="collapseComposer"
          >
            {{ t('discussionDetail.cancel') }}
          </button>
          <button
            class="button is-link is-small"
            type="button"
            :class="{ 'is-loading': submitting }"
            :disabled="submitting || !trimmedDraft"
            @click="submitDraft"
          >
            {{ submitting ? submittingLabel : submitLabel }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.discussion-composer__capsule {
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
  box-shadow: var(--gitpulse-shadow-raised);
  text-align: left;
  cursor: text;
}

.discussion-composer__capsule-avatar {
  flex: none;
}

.discussion-composer__capsule-placeholder {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.discussion-composer__capsule-submit {
  flex: none;
}

.discussion-composer__panel {
  border: 1px solid var(--gitpulse-border);
  border-radius: 16px;
  padding: 1rem;
  background: color-mix(in srgb, var(--gitpulse-surface) 92%, transparent);
  backdrop-filter: blur(10px);
  box-shadow: var(--gitpulse-shadow-raised);
}

.discussion-composer__header,
.discussion-composer__footer {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.discussion-composer__header {
  margin-bottom: 0.75rem;
}

.discussion-composer__avatar {
  flex: none;
}

.discussion-composer__header-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.discussion-composer__tabs {
  min-width: 0;
  margin-left: auto;
}

.discussion-composer__textarea,
.discussion-composer__preview {
  min-height: 160px;
  max-height: 40vh;
  overflow-y: auto;
}

.discussion-composer--compact .discussion-composer__panel {
  border-radius: 8px;
  backdrop-filter: none;
  background: var(--gitpulse-surface);
  box-shadow: none;
}

.discussion-composer--compact .discussion-composer__textarea,
.discussion-composer--compact .discussion-composer__preview {
  min-height: 7rem;
}

.discussion-composer__preview {
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
  padding: 0.875rem;
  background: var(--gitpulse-surface-muted);
}

.discussion-composer__footer {
  justify-content: space-between;
  margin-top: 0.75rem;
}

.discussion-composer__footer-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

@media (max-width: 768px) {
  .discussion-composer__capsule {
    min-height: 48px;
    padding: 0.5rem 0.5rem 0.5rem 0.75rem;
  }

  .discussion-composer__footer {
    align-items: stretch;
    flex-direction: column;
    gap: 0.5rem;
  }

  .discussion-composer__footer-actions {
    justify-content: flex-end;
  }
}
</style>
