<template>
  <div
    v-show="!isAnyModalOpen"
    :class="['comment-composer', { 'comment-composer--expanded': isExpanded }]"
    :aria-hidden="isAnyModalOpen ? 'true' : undefined"
    :inert="isAnyModalOpen || undefined"
  >
    <div v-if="errorMessage" class="notification is-danger is-light mb-3 py-2 px-3">
      <button class="delete is-small" type="button" @click="errorMessage = ''"></button>
      <p class="is-size-7">{{ errorMessage }}</p>
    </div>

    <button
      v-if="!isExpanded"
      class="comment-composer__collapsed button is-light is-fullwidth is-justify-content-flex-start"
      type="button"
      @click="expandComposer"
    >
      <RoundImg
        class="mr-3"
        width="28"
        height="28"
        :src="currentUserAvatar"
        :alt="currentUserLogin"
      />
      <span class="has-text-grey">{{ t('commentComposer.placeholder') }}</span>
    </button>

    <div v-else class="comment-composer__panel">
      <div class="comment-composer__panel-header is-flex is-align-items-center mb-3">
        <RoundImg
          class="mr-3"
          width="32"
          height="32"
          :src="currentUserAvatar"
          :alt="currentUserLogin"
        />
        <div class="is-flex-grow-1">
          <p class="is-size-7 has-text-grey mb-1">{{ currentUserLogin }}</p>
          <div class="tabs is-boxed is-small mb-0">
            <ul>
              <li :class="{ 'is-active': activeTab === 'write' }">
                <a @click.prevent="activeTab = 'write'">{{ t('commentComposer.writeTab') }}</a>
              </li>
              <li :class="{ 'is-active': activeTab === 'preview' }">
                <a @click.prevent="activeTab = 'preview'">{{ t('commentComposer.previewTab') }}</a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div v-if="activeTab === 'write'">
        <textarea
          ref="textareaRef"
          v-model="draft"
          class="textarea comment-composer__textarea"
          :placeholder="t('commentComposer.placeholder')"
          rows="6"
          :disabled="isSubmitting"
        />
      </div>

      <div v-else class="comment-composer__preview content">
        <MarkdownRenderer
          v-if="trimmedDraft"
          :value="draft"
          :repo-owner="repoOwner"
          :repo-name="repoName"
        />
        <p v-else class="has-text-grey is-size-7 mb-0">
          {{ t('commentComposer.previewEmpty') }}
        </p>
      </div>

      <div
        class="comment-composer__footer is-flex is-align-items-center is-justify-content-space-between mt-3"
      >
        <p class="is-size-7 has-text-grey mb-0">
          {{ t('commentComposer.markdownHint') }}
        </p>

        <div class="buttons mb-0">
          <button
            class="button is-light"
            type="button"
            :disabled="isSubmitting"
            @click="resetComposer"
          >
            {{ t('commentComposer.cancel') }}
          </button>
          <button
            class="button is-link"
            type="button"
            :class="{ 'is-loading': isSubmitting }"
            :disabled="isSubmitting || !trimmedDraft || !canSubmit"
            @click="submitComment"
          >
            {{ isSubmitting ? t('commentComposer.submitting') : t('commentComposer.submit') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import MarkdownRenderer from '~/components/ui/MarkdownRenderer.vue';
import RoundImg from '~/components/ui/RoundImg.vue';

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

const props = defineProps<{
  repoOwner: string;
  repoName: string;
  itemNumber: number | null;
}>();

const emit = defineEmits<{
  (e: 'comment-created', item: TimelineCommentItem): void;
}>();

const { t } = useI18n();
const { user } = useUserSession();
const { isAnyModalOpen } = useModalState();

const textareaRef = ref<HTMLTextAreaElement | null>(null);
const isExpanded = ref(false);
const isSubmitting = ref(false);
const activeTab = ref<'write' | 'preview'>('write');
const draft = ref('');
const errorMessage = ref('');

const trimmedDraft = computed(() => draft.value.trim());
const canSubmit = computed(() => Boolean(props.repoOwner && props.repoName && props.itemNumber));
const currentUserLogin = computed(() => user.value?.login || 'You');
const currentUserAvatar = computed(
  () => user.value?.avatar_url || 'https://github.com/placeholder.png'
);

const expandComposer = async () => {
  isExpanded.value = true;
  activeTab.value = 'write';

  await nextTick();
  textareaRef.value?.focus();
};

const resetComposer = () => {
  draft.value = '';
  errorMessage.value = '';
  activeTab.value = 'write';
  isExpanded.value = false;
};

const submitComment = async () => {
  if (!trimmedDraft.value) {
    errorMessage.value = t('commentComposer.emptyError');
    return;
  }

  if (!canSubmit.value || !props.itemNumber) {
    errorMessage.value = t('commentComposer.unavailableError');
    return;
  }

  isSubmitting.value = true;
  errorMessage.value = '';

  try {
    const response = await $fetch<CreatedCommentResponse>(
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

    resetComposer();
  } catch (error: any) {
    errorMessage.value =
      error?.data?.statusMessage || error?.message || t('commentComposer.failed');
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<style scoped lang="scss">
.comment-composer {
  position: sticky;
  bottom: 1rem;
  z-index: 6;
  padding-top: 0.5rem;
}

.comment-composer__collapsed,
.comment-composer__panel {
  width: 100%;
  border: 1px solid var(--gitpulse-border);
  border-radius: 20px;
  background: color-mix(in srgb, var(--gitpulse-surface) 92%, transparent);
  backdrop-filter: blur(10px);
  box-shadow: var(--gitpulse-shadow-raised);
}

.comment-composer__collapsed {
  min-height: 56px;
  justify-content: flex-start;
  padding: 0.75rem 1rem;
}

.comment-composer__panel {
  padding: 1rem;
}

.comment-composer__textarea,
.comment-composer__preview {
  min-height: 160px;
  max-height: 40vh;
  overflow-y: auto;
  border-radius: 16px;
}

.comment-composer__preview {
  padding: 1rem;
  background: var(--gitpulse-surface-muted);
  border: 1px solid var(--gitpulse-border);
}

.comment-composer__footer {
  gap: 1rem;
}

@media (max-width: 768px) {
  .comment-composer {
    bottom: 0.5rem;
  }

  .comment-composer__footer {
    flex-direction: column;
    align-items: stretch;
  }

  .comment-composer__footer .buttons {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
