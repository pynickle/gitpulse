<script setup lang="ts">
import { ArrowLeftIcon, GitPullRequestIcon, HomeIcon, MessageSquareIcon } from '@lucide/vue';
import { computed, nextTick, onBeforeUnmount, shallowRef, useTemplateRef } from 'vue';

import PRReviewDiffViewer from '~/components/dashboard/pr/PRReviewDiffViewer.vue';
import PRReviewFileSidebar from '~/components/dashboard/pr/PRReviewFileSidebar.vue';
import PRReviewSubmitBar from '~/components/dashboard/pr/PRReviewSubmitBar.vue';
import shouldCloseReviewWorkspaceAfterSubmit from '~/utils/prReviewNavigation';

import { buildDashboardQueryFromNavigationEntry } from '../../../utils/dashboardUrlNavigationUtils';

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
const localePath = useLocalePath();
const router = useRouter();
const {
  canGoBack,
  goBack: goNavigationBack,
  goToHome,
  previousEntry,
  shouldShowHomeButton,
} = useNavigationHistory();

const handleReviewSubmitted = () => {
  if (
    shouldCloseReviewWorkspaceAfterSubmit({
      previousEntry: previousEntry.value,
      owner: props.owner,
      repo: props.repo,
      pullNumber: props.pullNumber,
    })
  ) {
    goNavigationBack();
    emit('close');
  }
};

const review = usePRReview({
  owner: () => props.owner,
  repo: () => props.repo,
  pullNumber: () => props.pullNumber,
  commitId: () => props.commitId,
  messages: {
    loadFailed: t('prReview.loadFailed'),
    submitFailed: t('prReview.submitFailed'),
    resolveThreadFailed: t('prReview.resolveThreadFailed'),
    unresolveThreadFailed: t('prReview.unresolveThreadFailed'),
  },
  onSubmitted: handleReviewSubmitted,
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
const shouldShowNavButtons = computed(() => canGoBack.value || shouldShowHomeButton.value);

const navigateToEntryRoute = async (entry: typeof previousEntry.value) => {
  if (!entry || entry.type === 'dashboard' || entry.type === 'notification') {
    await router.push(localePath('/dashboard'));
    return;
  }

  const query = buildDashboardQueryFromNavigationEntry(entry, {
    repositoryTab: 'repos',
  });

  if (query) {
    await router.push({ path: localePath('/dashboard'), query });
    return;
  }

  await router.push(localePath('/dashboard'));
};

const goBack = async () => {
  await navigateToEntryRoute(goNavigationBack());
};

const goHome = async () => {
  goToHome();
  await router.push(localePath('/dashboard'));
};

const goToPullRequestDetails = () => {
  emit('close');
};

// Keep in sync with the grid transition duration in <style>.
const GRID_ANIMATION_DURATION_MS = 280;
const GRID_ANIMATION_FALLBACK_MS = GRID_ANIMATION_DURATION_MS + 120;
const CENTER_PIN_PROPERTY = '--pr-review-center-pin';

const gridElement = useTemplateRef<HTMLElement>('gridElement');
const gridAnimating = shallowRef(false);
let gridAnimationToken = 0;
let gridAnimationFallbackTimer: number | undefined;

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const clearGridAnimationFallback = () => {
  if (gridAnimationFallbackTimer !== undefined) {
    window.clearTimeout(gridAnimationFallbackTimer);
    gridAnimationFallbackTimer = undefined;
  }
};

const finalizeGridAnimation = async (token: number) => {
  if (token !== gridAnimationToken) return;

  clearGridAnimationFallback();
  gridAnimating.value = false;
  await nextTick();

  const grid = gridElement.value;

  if (token !== gridAnimationToken || !grid) return;

  grid.style.gridTemplateColumns = '';
  grid.style.removeProperty(CENTER_PIN_PROPERTY);
};

const handleGridTransitionEnd = (event: TransitionEvent) => {
  if (event.propertyName !== 'grid-template-columns' || !gridAnimating.value) return;

  void finalizeGridAnimation(gridAnimationToken);
};

/**
 * Animates the panel grid between its pre- and post-toggle layouts (FLIP):
 * both layouts are measured as resolved pixel tracks, then the transition
 * interpolates between the two pixel lists, so it also reverses seamlessly
 * from mid-flight. While the tracks animate, the diff viewer body is pinned
 * to the wider of the two center widths so its rows are only clipped, never
 * re-wrapped frame by frame.
 */
const animateGridColumns = async (applyState: () => void) => {
  const grid = gridElement.value;

  if (!grid || prefersReducedMotion()) {
    applyState();
    return;
  }

  const token = ++gridAnimationToken;
  clearGridAnimationFallback();

  const startColumns = getComputedStyle(grid).gridTemplateColumns;
  const startCenterWidth = parseGridTemplateColumnWidths(startColumns)[1];
  const hasCenterPin = startCenterWidth !== undefined && Number.isFinite(startCenterWidth);

  // Pin the diff viewer to its current width up front so measuring the
  // post-toggle layout below never re-wraps its rows.
  if (hasCenterPin) {
    grid.style.setProperty(CENTER_PIN_PROPERTY, `${startCenterWidth}px`);
  } else {
    grid.style.removeProperty(CENTER_PIN_PROPERTY);
  }

  gridAnimating.value = false;
  grid.style.gridTemplateColumns = '';
  applyState();
  await nextTick();

  if (token !== gridAnimationToken) return;

  const endColumns = getComputedStyle(grid).gridTemplateColumns;

  if (endColumns === startColumns) {
    grid.style.removeProperty(CENTER_PIN_PROPERTY);
    return;
  }

  const endCenterWidth = parseGridTemplateColumnWidths(endColumns)[1];

  if (hasCenterPin && endCenterWidth !== undefined && Number.isFinite(endCenterWidth)) {
    grid.style.setProperty(CENTER_PIN_PROPERTY, `${Math.max(startCenterWidth, endCenterWidth)}px`);
  }

  grid.style.gridTemplateColumns = startColumns;
  void grid.offsetWidth;
  gridAnimating.value = true;
  await nextTick();

  if (token !== gridAnimationToken) return;

  grid.style.gridTemplateColumns = endColumns;
  gridAnimationFallbackTimer = window.setTimeout(() => {
    gridAnimationFallbackTimer = undefined;
    void finalizeGridAnimation(token);
  }, GRID_ANIMATION_FALLBACK_MS);
};

const setSidebarCollapsed = (collapsed: boolean) => {
  void animateGridColumns(() => {
    sidebarCollapsed.value = collapsed;
  });
};

const setReviewPanelCollapsed = (collapsed: boolean) => {
  void animateGridColumns(() => {
    reviewPanelCollapsed.value = collapsed;
  });
};

onBeforeUnmount(clearGridAnimationFallback);
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
          <button
            type="button"
            class="pr-review-workspace__detail-link"
            :aria-label="t('prReview.backToDetails')"
            :title="t('prReview.backToDetails')"
            @click="goToPullRequestDetails"
          >
            {{ owner }}/{{ repo }} #{{ pullNumber }}
          </button>
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
        <div v-if="shouldShowNavButtons" class="pr-review-workspace__nav-buttons">
          <button
            v-if="canGoBack"
            type="button"
            class="pr-review-workspace__nav-button"
            :aria-label="t('repoFileView.back')"
            :title="t('repoFileView.back')"
            @click="goBack"
          >
            <ArrowLeftIcon :size="15" aria-hidden="true" />
          </button>
          <button
            v-if="shouldShowHomeButton"
            type="button"
            class="pr-review-workspace__nav-button"
            :aria-label="t('repoFileView.home')"
            :title="t('repoFileView.home')"
            @click="goHome"
          >
            <HomeIcon :size="15" aria-hidden="true" />
          </button>
        </div>
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
      ref="gridElement"
      :class="[
        'pr-review-workspace__grid',
        {
          'pr-review-workspace__grid--sidebar-collapsed': sidebarCollapsed,
          'pr-review-workspace__grid--review-collapsed': reviewPanelCollapsed,
          'pr-review-workspace__grid--animating': gridAnimating,
        },
      ]"
      @transitionend.self="handleGridTransitionEnd"
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
        @update:collapsed="setSidebarCollapsed"
        @select-file="review.selectFile"
        @load-more="review.loadMoreFiles"
      />

      <PRReviewDiffViewer
        :repo-owner="owner"
        :repo-name="repo"
        :sections="review.allDiffSections.value"
        :active-filename="review.activeFilename.value"
        :draft-comments="review.draftComments.value"
        :review-comment-threads="review.reviewCommentThreads.value"
        :active-draft-target="review.activeDraftTarget.value"
        :submitting="review.submitting.value"
        :resolving-review-thread-id="review.resolvingReviewThreadId.value"
        @visible-file-changed="review.syncVisibleFile"
        @open-draft-editor="review.openDraftEditor"
        @close-draft-editor="review.closeDraftEditor"
        @save-draft-comment="review.saveDraftComment"
        @remove-draft-comment="review.removeDraftComment"
        @toggle-review-thread="review.toggleReviewThreadResolved"
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
        @update:collapsed="setReviewPanelCollapsed"
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

.pr-review-workspace__title {
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  font-size: 0.9rem;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pr-review-workspace__detail-link {
  max-width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--gitpulse-text-muted);
  display: block;
  overflow: hidden;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.12s ease;

  &:hover,
  &:focus-visible {
    color: var(--gitpulse-info);
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-info);
    outline-offset: 2px;
  }
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

.pr-review-workspace__nav-buttons {
  display: flex;
  align-items: center;
  gap: 1px;
  margin-left: 0.35rem;
  padding: 3px;
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
  background: var(--gitpulse-surface);
}

.pr-review-workspace__nav-button {
  height: 1.625rem;
  min-width: 1.625rem;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--gitpulse-text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  cursor: pointer;
  flex-shrink: 0;
  transition:
    background 0.12s ease,
    color 0.12s ease;

  &:hover {
    background: var(--gitpulse-surface-hover);
    color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-info);
    outline-offset: 1px;
  }
}

.pr-review-workspace__grid {
  --pr-review-rail-width: 2.75rem;
  --pr-review-sidebar-expanded-width: 17rem;
  --pr-review-panel-expanded-width: 22rem;
  min-height: 0;
  flex: 1;
  display: grid;
  grid-template-columns:
    var(--pr-review-sidebar-width, var(--pr-review-sidebar-expanded-width))
    minmax(0, 1fr)
    var(--pr-review-panel-width, var(--pr-review-panel-expanded-width));
}

// Only transition while a toggle is in flight: the component first measures
// the pre- and post-toggle layouts (FLIP), then interpolates between the two
// resolved pixel track lists. Duration mirrors GRID_ANIMATION_DURATION_MS.
.pr-review-workspace__grid--animating {
  transition: grid-template-columns 0.28s cubic-bezier(0.32, 0.72, 0, 1);
}

.pr-review-workspace__grid > * {
  min-width: 0;
  min-height: 0;
}

.pr-review-workspace__grid--sidebar-collapsed {
  --pr-review-sidebar-width: var(--pr-review-rail-width);
}

.pr-review-workspace__grid--review-collapsed {
  --pr-review-panel-width: var(--pr-review-rail-width);
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
    --pr-review-sidebar-expanded-width: 14rem;
    --pr-review-panel-expanded-width: 18rem;
  }

  .pr-review-workspace__summary-pill:not(.pr-review-workspace__summary-pill--draft) {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .pr-review-workspace__grid--animating {
    transition: none;
  }
}
</style>
