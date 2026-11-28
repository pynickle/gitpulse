<template>
  <div>
    <div class="issue-timeline-events__header">
      <span class="issue-timeline-events__title">{{ t('detailTimeline.activity') }}</span>
      <div v-if="loading" class="issue-timeline-events__loading">
        <LoadingIcon :size="16" aria-hidden="true" />
        <span class="issue-timeline-events__loading-label">{{ t('detailTimeline.loading') }}</span>
      </div>
    </div>

    <div v-if="processedTimeline.length > 0" class="issue-timeline-events__list">
      <div v-for="item in processedTimeline" :key="item.renderKey">
        <TimelineCommentCard
          v-if="item.kind === 'comment' && item.eventType === 'commented'"
          :item="item"
          :repo-owner="repoOwner"
          :repo-name="repoName"
        />

        <IssueTimelineReferencedEventCard
          v-else-if="item.eventType === 'referenced'"
          :item="item"
        />

        <IssueTimelineCommitCard
          v-else-if="item.kind === 'commit'"
          :item="item"
          :repo-owner="repoOwner"
          :repo-name="repoName"
        />

        <TimelineRenamedTitleEvent
          v-else-if="item.eventType === 'renamed'"
          class="issue-timeline-events__row"
          :actor="item.actor"
          :previous-title="item.previousTitle"
          :current-title="item.currentTitle"
          :created-at="item.createdAt"
        />

        <div v-else-if="item.groupedEvents" class="issue-timeline-events__row">
          <TimelineEventActorRow :actor="item.actor" align-start>
            <div>
              <div class="issue-timeline-events__grouped-heading">
                <GitHubProfileLink
                  :login="item.actor?.login"
                  :github-href="item.actor?.url"
                  class="issue-timeline-events__grouped-actor"
                >
                  {{ item.actor?.login }}
                </GitHubProfileLink>
                {{ groupedActionLabel(item.eventType) }}
              </div>
              <div v-for="groupedItem in item.groupedEvents" :key="groupedItem.renderKey">
                <IssueTimelineEventBody
                  :item="groupedItem"
                  grouped
                  :repo-owner="repoOwner"
                  :repo-name="repoName"
                  @switch-issue="switchToIssue"
                  @switch-pull-request="switchToPullRequest"
                />
              </div>
            </div>
          </TimelineEventActorRow>
        </div>
        <div v-else class="issue-timeline-events__row">
          <TimelineEventActorRow :actor="item.actor">
            <IssueTimelineEventBody
              :item="item"
              :repo-owner="repoOwner"
              :repo-name="repoName"
              @switch-issue="switchToIssue"
              @switch-pull-request="switchToPullRequest"
            />
          </TimelineEventActorRow>
        </div>
      </div>
    </div>

    <div v-else-if="!loading" class="issue-timeline-events__empty">
      {{ t('detailTimeline.noActivity') }}
    </div>

    <div
      v-if="hasNextPage && processedTimeline.length > 0"
      class="issue-timeline-events__load-more"
    >
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

    <FloatingMarkdownEditor
      class="issue-timeline-events__composer"
      :repo-owner="repoOwner"
      :repo-name="repoName"
      :item-number="issueNumber"
      @comment-created="emit('comment-created', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import IssueTimelineCommitCard from '~/components/dashboard/issue/IssueTimelineCommitCard.vue';
import IssueTimelineEventBody from '~/components/dashboard/issue/IssueTimelineEventBody.vue';
import IssueTimelineReferencedEventCard from '~/components/dashboard/issue/IssueTimelineReferencedEventCard.vue';
import FloatingMarkdownEditor from '~/components/dashboard/timeline/DeferredFloatingMarkdownEditor.vue';
import TimelineCommentCard from '~/components/dashboard/timeline/TimelineCommentCard.vue';
import TimelineEventActorRow from '~/components/dashboard/timeline/TimelineEventActorRow.vue';
import TimelineRenamedTitleEvent from '~/components/dashboard/timeline/TimelineRenamedTitleEvent.vue';
import GitHubProfileLink from '~/components/ui/GitHubProfileLink.vue';
import LoadingIcon from '~/components/ui/LoadingIcon.vue';
import {
  useIssueTimelineEvents,
  type IssueTimelineItem,
} from '~/composables/useIssueTimelineEvents';

const { t } = useI18n();

const { timeline, repoOwner, repoName, issueNumber } = defineProps<{
  timeline: IssueTimelineItem[];
  loading: boolean;
  repoOwner: string;
  repoName: string;
  issueNumber: number;
  hasNextPage?: boolean;
  loadingMore?: boolean;
}>();

const emit = defineEmits<{
  (e: 'switch-issue', owner: string, repo: string, issueNumber: number): void;
  (e: 'switch-pull-request', owner: string, repo: string, pullNumber: number): void;
  (e: 'comment-created', item: IssueTimelineItem): void;
  (e: 'load-more'): void;
}>();

const { processedTimeline } = useIssueTimelineEvents(
  () => timeline,
  () => ({
    repoOwner: repoOwner,
    repoName: repoName,
    issueNumber: issueNumber,
  })
);

const groupedActionLabel = (eventType?: string) => {
  if (eventType === 'cross-referenced') return 'referenced this in';
  if (eventType === 'blocked_by_added') return 'marked this as blocked by';
  return 'added sub-issues';
};

const switchToIssue = (owner: string, repo: string, issueNumber: number) => {
  emit('switch-issue', owner, repo, issueNumber);
};

const switchToPullRequest = (owner: string, repo: string, pullNumber: number) => {
  emit('switch-pull-request', owner, repo, pullNumber);
};
</script>

<style scoped lang="scss">
.issue-timeline-events__header {
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
}

.issue-timeline-events__title {
  margin-left: 0.5rem;
  margin-right: 1rem;
  color: var(--gitpulse-text-strong);
  font-size: 1.25rem;
  font-weight: 600;
}

.issue-timeline-events__loading {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
}

.issue-timeline-events__loading-label,
.issue-timeline-events__empty {
  color: var(--gitpulse-text-muted);
  font-size: 0.75rem;
}

.issue-timeline-events__list {
  display: flex;
  flex-direction: column;
  gap: 1.125rem;
}

.issue-timeline-events__row {
  margin-inline: 0.5rem;
}

.issue-timeline-events__grouped-heading {
  margin-bottom: 0.25rem;
  color: var(--gitpulse-text-muted);
  font-size: 0.75rem;
}

.issue-timeline-events__grouped-actor {
  margin-right: 0.25rem;
  color: var(--gitpulse-link);
  font-weight: 500;
}

.issue-timeline-events__load-more {
  display: flex;
  justify-content: center;
  margin-top: 1rem;
}

.issue-timeline-events__composer {
  margin-top: 1rem;
  padding-top: 1rem;
}
</style>
