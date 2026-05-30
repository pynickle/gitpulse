<script setup lang="ts">
import { GitPullRequestIcon, MessageSquareIcon } from 'lucide-vue-next';
import { computed, shallowRef } from 'vue';

import PRReviewDiffViewer from '~/components/dashboard/pr/PRReviewDiffViewer.vue';
import PRReviewFileSidebar from '~/components/dashboard/pr/PRReviewFileSidebar.vue';
import PRReviewSubmitBar from '~/components/dashboard/pr/PRReviewSubmitBar.vue';

const props = defineProps<{
  owner: string;
  repo: string;
  pullNumber: number;
  commitId: string;
  title?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const { t } = useI18n();

const review = usePRReview({
  owner: () => props.owner,
  repo: () => props.repo,
  pullNumber: () => props.pullNumber,
  commitId: () => props.commitId,
  messages: {
    loadFailed: t('prReview.loadFailed'),
    submitFailed: t('prReview.submitFailed'),
  },
  onSubmitted: () => emit('close'),
});

const hasFiles = computed(() => review.files.value.length > 0);
const hasMoreFiles = computed(() => review.pagination.value.hasNext);
const workspaceTitle = computed(() => props.title || t('prReview.untitledPullRequest'));
const fileViewMode = shallowRef<'list' | 'tree'>('tree');
const sidebarCollapsed = shallowRef(false);
const reviewPanelCollapsed = shallowRef(true);
const totalAdditions = computed(() =>
  review.files.value.reduce((total, file) => total + file.additions, 0)
);
const totalDeletions = computed(() =>
  review.files.value.reduce((total, file) => total + file.deletions, 0)
);
</script>

<template>
  <section class="pr-review-workspace">
    <header class="pr-review-workspace__header">
      <div class="pr-review-workspace__identity">
        <GitPullRequestIcon
          :size="18"
          class="pr-review-workspace__header-icon"
          aria-hidden="true"
        />
        <div class="pr-review-workspace__title-block">
          <p class="pr-review-workspace__eyebrow mb-0">{{ owner }}/{{ repo }} #{{ pullNumber }}</p>
          <h1 class="pr-review-workspace__title mb-0">{{ workspaceTitle }}</h1>
        </div>
      </div>

      <div class="pr-review-workspace__summary" aria-live="polite">
        <span class="pr-review-workspace__summary-pill">{{
          t('prReview.filesCount', { count: review.files.value.length })
        }}</span>
        <span class="pr-review-workspace__summary-pill pr-review-workspace__summary-pill--add"
          >+{{ totalAdditions }}</span
        >
        <span class="pr-review-workspace__summary-pill pr-review-workspace__summary-pill--delete"
          >-{{ totalDeletions }}</span
        >
        <span
          v-if="review.pendingCommentCount.value"
          class="pr-review-workspace__summary-pill pr-review-workspace__summary-pill--draft"
        >
          <MessageSquareIcon :size="13" aria-hidden="true" />
          {{ review.pendingCommentCount.value }}
        </span>
        <button class="button is-small is-light" type="button" @click="emit('close')">
          {{ t('prReview.backToDetails') }}
        </button>
      </div>
    </header>

    <div v-if="review.errorMessage.value && !hasFiles" class="pr-review-workspace__notice">
      <div class="notification is-danger is-light">
        <p class="mb-3">{{ review.errorMessage.value }}</p>
        <button class="button is-small is-danger" type="button" @click="review.retryLoad">
          {{ t('prReview.retry') }}
        </button>
      </div>
    </div>

    <div v-else-if="review.loading.value" class="pr-review-workspace__notice">
      <div class="is-flex is-align-items-center is-justify-content-center">
        <span class="button is-loading is-light pr-review-workspace__loading-btn mr-2"></span>
        <span>{{ t('prReview.loadingFiles') }}</span>
      </div>
    </div>

    <div v-else-if="!hasFiles" class="pr-review-workspace__notice">
      <p class="has-text-grey">{{ t('prReview.noFiles') }}</p>
    </div>

    <div
      v-else
      :class="[
        'pr-review-workspace__grid',
        {
          'pr-review-workspace__grid--sidebar-collapsed': sidebarCollapsed,
          'pr-review-workspace__grid--review-collapsed': reviewPanelCollapsed,
        },
      ]"
    >
      <PRReviewFileSidebar
        :files="review.files.value"
        :active-filename="review.activeFilename.value"
        :draft-comments="review.draftComments.value"
        :loading-more="review.loadingMore.value"
        :has-more-files="hasMoreFiles"
        :view-mode="fileViewMode"
        :collapsed="sidebarCollapsed"
        @update:view-mode="fileViewMode = $event"
        @update:collapsed="sidebarCollapsed = $event"
        @select-file="review.selectFile"
        @load-more="review.loadMoreFiles"
      />

      <PRReviewDiffViewer
        :sections="review.allDiffSections.value"
        :active-filename="review.activeFilename.value"
        :draft-comments="review.draftComments.value"
        :active-draft-target="review.activeDraftTarget.value"
        :submitting="review.submitting.value"
        @visible-file-changed="review.syncVisibleFile"
        @open-draft-editor="review.openDraftEditor"
        @close-draft-editor="review.closeDraftEditor"
        @save-draft-comment="review.saveDraftComment"
        @remove-draft-comment="review.removeDraftComment"
      />

      <PRReviewSubmitBar
        :event="review.selectedEvent.value"
        :body="review.draftBody.value"
        :pending-comment-count="review.pendingCommentCount.value"
        :draft-comments="review.draftComments.value"
        :can-submit="review.canSubmit.value"
        :submitting="review.submitting.value"
        :error-message="review.submitError.value"
        :collapsed="reviewPanelCollapsed"
        @update:event="review.selectedEvent.value = $event"
        @update:body="review.draftBody.value = $event"
        @update:collapsed="reviewPanelCollapsed = $event"
        @submit="review.submitReview"
        @remove-draft-comment="review.removeDraftComment"
      />
    </div>
  </section>
</template>

<style scoped lang="scss">
.pr-review-workspace {
  height: 100%;
  min-height: 0;
  background: var(--gitpulse-surface);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.pr-review-workspace__header {
  min-height: 3.25rem;
  padding: 0.45rem 0.75rem;
  border-bottom: 1px solid var(--gitpulse-border);
  background: var(--gitpulse-surface-muted);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex: none;
}

.pr-review-workspace__identity,
.pr-review-workspace__summary {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.pr-review-workspace__header-icon {
  flex: none;
  color: var(--gitpulse-text-muted);
}

.pr-review-workspace__title-block {
  min-width: 0;
}

.pr-review-workspace__eyebrow {
  color: var(--gitpulse-text-muted);
  font-size: 0.72rem;
  font-weight: 600;
}

.pr-review-workspace__title {
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  font-size: 0.9rem;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pr-review-workspace__summary {
  flex: none;
  justify-content: flex-end;
}

.pr-review-workspace__summary-pill {
  min-height: 1.65rem;
  padding: 0.18rem 0.5rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 999px;
  background: var(--gitpulse-surface);
  color: var(--gitpulse-text-muted);
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.72rem;
  font-weight: 700;
}

.pr-review-workspace__summary-pill--add {
  color: var(--gitpulse-success);
}

.pr-review-workspace__summary-pill--delete {
  color: var(--gitpulse-danger);
}

.pr-review-workspace__summary-pill--draft {
  border-color: var(--gitpulse-draft-border);
  background: var(--gitpulse-draft-bg);
  color: var(--gitpulse-warning);
}

.pr-review-workspace__grid {
  min-height: 0;
  flex: 1;
  display: grid;
  grid-template-columns:
    var(--pr-review-sidebar-width, minmax(14rem, 17rem))
    minmax(0, 1fr)
    var(--pr-review-panel-width, minmax(19rem, 22rem));
  transition: grid-template-columns 0.22s cubic-bezier(0.4, 0, 0.2, 1);
}

.pr-review-workspace__grid > * {
  min-width: 0;
  min-height: 0;
}

.pr-review-workspace__grid--sidebar-collapsed {
  --pr-review-sidebar-width: 2.75rem;
}

.pr-review-workspace__grid--review-collapsed {
  --pr-review-panel-width: 2.75rem;
}

.pr-review-workspace__notice {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

html.dark .pr-review-workspace__loading-btn {
  color: var(--gitpulse-text-strong);
  background-color: var(--gitpulse-surface);
  border-color: var(--gitpulse-border);
}

html.dark .pr-review-workspace__loading-btn::after {
  border-color: var(--gitpulse-text-strong);
  border-right-color: transparent;
}

@media (max-width: 1100px) {
  .pr-review-workspace__grid {
    grid-template-columns:
      var(--pr-review-sidebar-width, minmax(12rem, 14rem))
      minmax(0, 1fr)
      var(--pr-review-panel-width, minmax(16rem, 18rem));
  }

  .pr-review-workspace__summary-pill:not(.pr-review-workspace__summary-pill--draft) {
    display: none;
  }
}
</style>
