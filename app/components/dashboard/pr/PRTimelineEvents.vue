<template>
  <div>
    <div v-if="loading" class="pr-timeline-events__loading">
      <LoadingIcon :size="16" aria-hidden="true" />
      <span class="pr-timeline-events__loading-label">{{ t('detailTimeline.loading') }}</span>
    </div>

    <div v-if="processedTimeline.length > 0" class="pr-timeline-events__list">
      <div v-for="item in processedTimeline" :key="item.renderKey">
        <PRTimelineCommentCard
          v-if="item.kind === 'comment' || item.kind === 'review-comment'"
          :item="item"
          :empty-text="t('detailTimeline.noCommentBody')"
          :repo-owner="repoOwner"
          :repo-name="repoName"
        />

        <PRTimelineReviewCard
          v-else-if="item.kind === 'review'"
          :item="item"
          :repo-owner="repoOwner"
          :repo-name="repoName"
          :resolving-review-thread-id="resolvingReviewThreadId"
          @toggle-review-thread="emit('toggle-review-thread', $event.threadId, $event.resolved)"
        />

        <PRTimelineCommitCard
          v-else-if="item.kind === 'commit'"
          :item="item"
          :repo-owner="repoOwner"
          :repo-name="repoName"
          :pull-number="pullNumber"
        />

        <PRTimelineMergeCard
          v-else-if="item.kind === 'event' && item.eventType === 'merged'"
          :item="item"
          :repo-owner="repoOwner"
          :repo-name="repoName"
        />

        <TimelineRenamedTitleEvent
          v-else-if="item.eventType === 'renamed'"
          class="pr-timeline-events__row"
          :actor="item.actor"
          :previous-title="item.previousTitle"
          :current-title="item.currentTitle"
          :created-at="item.createdAt"
        />

        <div
          v-else-if="isAutomaticBaseChange(item.eventType)"
          class="pr-timeline-events__row pr-timeline-events__system"
        >
          <span class="pr-timeline-events__system-mark">
            <GitBranchIcon :size="13" aria-hidden="true" />
          </span>
          <PRTimelineEventBody
            :item="item"
            :repo-owner="repoOwner"
            :repo-name="repoName"
            @switch-issue="handleSwitchIssue"
            @switch-pull-request="handleSwitchPullRequest"
            @open-stack="openStack"
          />
        </div>

        <div v-else-if="item.groupedEvents" class="pr-timeline-events__row">
          <TimelineEventActorRow :actor="item.actor" align-start>
            <div>
              <div class="pr-timeline-events__grouped-heading">
                <GitHubProfileLink
                  :login="item.actor?.login"
                  :github-href="item.actor?.url"
                  class="pr-timeline-events__grouped-actor"
                >
                  {{ item.actor?.login }}
                </GitHubProfileLink>
                {{ groupedActionLabel(item.eventType) }}
              </div>
              <div v-for="groupedItem in item.groupedEvents" :key="groupedItem.renderKey">
                <PRTimelineEventBody
                  :item="groupedItem"
                  grouped
                  :repo-owner="repoOwner"
                  :repo-name="repoName"
                  @switch-issue="handleSwitchIssue"
                  @switch-pull-request="handleSwitchPullRequest"
                />
              </div>
            </div>
          </TimelineEventActorRow>
        </div>
        <div v-else class="pr-timeline-events__row">
          <TimelineEventActorRow :actor="item.actor">
            <PRTimelineEventBody
              :item="item"
              :repo-owner="repoOwner"
              :repo-name="repoName"
              @switch-issue="handleSwitchIssue"
              @switch-pull-request="handleSwitchPullRequest"
              @open-stack="openStack"
            />
          </TimelineEventActorRow>
        </div>
      </div>
    </div>

    <div v-else-if="!loading" class="pr-timeline-events__empty">
      {{ t('detailTimeline.noActivity') }}
    </div>

    <div v-if="hasNextPage && processedTimeline.length > 0" class="pr-timeline-events__load-more">
      <button
        class="gp-btn gp-btn--light gp-btn--small"
        type="button"
        :class="{ 'gp-btn--loading': loadingMore }"
        :disabled="loadingMore"
        :aria-busy="loadingMore || undefined"
        @click="emit('load-more')"
      >
        {{ loadingMore ? t('detailTimeline.loadingMore') : t('detailTimeline.loadMore') }}
      </button>
    </div>

    <PRStackDetail
      v-if="stackDetailOpen"
      :stack="stackDetail ?? emptyTimelineStack"
      :current-pull-number="pullNumber"
      :loading-label="stackDetailLoading ? t('prReview.stackDetail.loading') : undefined"
      @close="stackDetailOpen = false"
      @select="chooseStackLayer"
    />

    <FloatingMarkdownEditor
      class="pr-timeline-events__composer"
      :repo-owner="repoOwner"
      :repo-name="repoName"
      :item-number="pullNumber"
      @comment-created="emit('comment-created', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { GitBranchIcon } from '@lucide/vue';
import { shallowRef } from 'vue';
import { useI18n } from 'vue-i18n';

import type { PullRequestStack } from '#shared/types/pulls';
import PRStackDetail from '~/components/dashboard/pr/PRStackDetail.vue';
import PRTimelineCommentCard from '~/components/dashboard/pr/PRTimelineCommentCard.vue';
import PRTimelineCommitCard from '~/components/dashboard/pr/PRTimelineCommitCard.vue';
import PRTimelineEventBody from '~/components/dashboard/pr/PRTimelineEventBody.vue';
import PRTimelineMergeCard from '~/components/dashboard/pr/PRTimelineMergeCard.vue';
import PRTimelineReviewCard from '~/components/dashboard/pr/PRTimelineReviewCard.vue';
import FloatingMarkdownEditor from '~/components/dashboard/timeline/DeferredFloatingMarkdownEditor.vue';
import TimelineEventActorRow from '~/components/dashboard/timeline/TimelineEventActorRow.vue';
import TimelineRenamedTitleEvent from '~/components/dashboard/timeline/TimelineRenamedTitleEvent.vue';
import GitHubProfileLink from '~/components/ui/GitHubProfileLink.vue';
import LoadingIcon from '~/components/ui/LoadingIcon.vue';
import { usePRTimelineEvents, type PRTimelineItem } from '~/composables/usePRTimelineEvents';

const {
  timeline,
  repoOwner,
  repoName,
  pullNumber,
  stack = null,
} = defineProps<{
  timeline: PRTimelineItem[];
  loading: boolean;
  repoOwner: string;
  repoName: string;
  pullNumber: number;
  stack?: PullRequestStack | null;
  hasNextPage?: boolean;
  loadingMore?: boolean;
  resolvingReviewThreadId?: string | null;
}>();

const emit = defineEmits<{
  (e: 'switch-issue', owner: string, repo: string, issueNumber: number): void;
  (e: 'switch-pull-request', owner: string, repo: string, pullNumber: number): void;
  (e: 'comment-created', item: PRTimelineItem): void;
  (e: 'load-more'): void;
  (e: 'toggle-review-thread', threadId: string, resolved: boolean): void;
}>();

const { t } = useI18n();
const { processedTimeline } = usePRTimelineEvents(() => timeline);

const groupedActionLabel = (eventType?: string) => {
  if (eventType === 'cross-referenced') return 'referenced this in';
  if (eventType === 'blocked_by_added') return 'marked this as blocked by';
  return 'added sub-issues';
};

const handleSwitchIssue = (owner: string, repo: string, issueNumber: number) => {
  emit('switch-issue', owner, repo, issueNumber);
};

const handleSwitchPullRequest = (owner: string, repo: string, pullNumber: number) => {
  emit('switch-pull-request', owner, repo, pullNumber);
};

const automaticBaseChangeTypes = new Set([
  'automatic_base_change_failed',
  'automatic_base_change_succeeded',
]);

const isAutomaticBaseChange = (eventType?: string) =>
  Boolean(eventType && automaticBaseChangeTypes.has(eventType));

const emptyTimelineStack: PullRequestStack = {
  trunk: '',
  count: 0,
  place: 0,
  layers: [],
  history: 'unknown',
};

const stackDetailOpen = shallowRef(false);
const stackDetailLoading = shallowRef(false);
const stackDetail = shallowRef<PullRequestStack | null>(null);
const apiFetch = useGitPulseApiFetch();
let stackRequest = 0;

const openStack = async (stackNumber: number) => {
  const request = ++stackRequest;
  stackDetailOpen.value = true;

  if (stack?.number === stackNumber && stack.layers.length > 0) {
    stackDetail.value = stack;
    stackDetailLoading.value = false;
    return;
  }

  stackDetail.value = null;
  stackDetailLoading.value = true;

  try {
    const loaded = await apiFetch<PullRequestStack>(
      `/api/repos/${repoOwner}/${repoName}/stacks/${stackNumber}`,
      { query: { pull: pullNumber } }
    );
    if (request !== stackRequest) return;
    stackDetail.value = loaded;
  } catch (error: unknown) {
    console.warn('Failed to open stack detail:', error);
    if (request !== stackRequest) return;
    stackDetail.value = { ...emptyTimelineStack, number: stackNumber };
  } finally {
    if (request === stackRequest) stackDetailLoading.value = false;
  }
};

const chooseStackLayer = (layerNumber: number) => {
  stackDetailOpen.value = false;
  emit('switch-pull-request', repoOwner, repoName, layerNumber);
};
</script>

<style scoped lang="scss">
.pr-timeline-events__loading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 1.25rem;
  margin-bottom: 1rem;
  padding-left: 0.5rem;
}

.pr-timeline-events__loading-label,
.pr-timeline-events__empty {
  color: var(--gitpulse-text-muted);
  font-size: 0.75rem;
}

.pr-timeline-events__list {
  display: flex;
  flex-direction: column;
  gap: 1.125rem;
}

.pr-timeline-events__row {
  margin-inline: 0.5rem;
}

.pr-timeline-events__system {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.pr-timeline-events__system-mark {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--gitpulse-surface-muted);
  color: var(--gitpulse-text-muted);
  box-shadow: var(--gitpulse-shadow-card);
}

.pr-timeline-events__grouped-heading {
  margin-bottom: 0.25rem;
  color: var(--gitpulse-text-muted);
  font-size: 0.75rem;
}

.pr-timeline-events__grouped-actor {
  margin-right: 0.25rem;
  color: var(--gitpulse-link);
  font-weight: 500;
}

.pr-timeline-events__load-more {
  display: flex;
  justify-content: center;
  margin-top: 1rem;
}

.pr-timeline-events__composer {
  margin-top: 1rem;
  padding-top: 1rem;
}
</style>
