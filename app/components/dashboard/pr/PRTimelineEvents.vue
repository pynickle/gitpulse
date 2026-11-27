<template>
  <div>
    <div v-if="loading" class="pr-timeline-events__loading mb-4 is-flex is-align-items-center">
      <LoadingIcon :size="16" aria-hidden="true" />
      <span class="ml-2 is-size-7 has-text-grey">{{ t('detailTimeline.loading') }}</span>
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
          class="mx-2"
          :actor="item.actor"
          :previous-title="item.previousTitle"
          :current-title="item.currentTitle"
          :created-at="item.createdAt"
        />

        <div v-else-if="item.groupedEvents" class="mx-2">
          <TimelineEventActorRow :actor="item.actor" align-start>
            <div>
              <div class="is-size-7 has-text-grey mb-1">
                <GitHubProfileLink
                  :login="item.actor?.login"
                  :github-href="item.actor?.url"
                  class="has-text-weight-medium has-text-link mr-1"
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
        <div v-else class="mx-2">
          <TimelineEventActorRow :actor="item.actor">
            <PRTimelineEventBody
              :item="item"
              :repo-owner="repoOwner"
              :repo-name="repoName"
              @switch-issue="handleSwitchIssue"
              @switch-pull-request="handleSwitchPullRequest"
            />
          </TimelineEventActorRow>
        </div>
      </div>
    </div>

    <div v-else-if="!loading" class="has-text-grey is-size-7">
      {{ t('detailTimeline.noActivity') }}
    </div>

    <div
      v-if="hasNextPage && processedTimeline.length > 0"
      class="mt-4 is-flex is-justify-content-center"
    >
      <button
        class="button is-light is-small"
        type="button"
        :class="{ 'is-loading': loadingMore }"
        :disabled="loadingMore"
        @click="emit('load-more')"
      >
        {{ loadingMore ? t('detailTimeline.loadingMore') : t('detailTimeline.loadMore') }}
      </button>
    </div>

    <FloatingMarkdownEditor
      class="pr-timeline-events__composer mt-4"
      :repo-owner="repoOwner"
      :repo-name="repoName"
      :item-number="pullNumber"
      @comment-created="emit('comment-created', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

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

const { timeline } = defineProps<{
  timeline: PRTimelineItem[];
  loading: boolean;
  repoOwner: string;
  repoName: string;
  pullNumber: number;
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
</script>

<style scoped lang="scss">
.pr-timeline-events__loading {
  min-height: 1.25rem;
  padding-left: 0.5rem;
}

.pr-timeline-events__list {
  display: flex;
  flex-direction: column;
  gap: 1.125rem;
}

.pr-timeline-events__composer {
  padding-top: 1rem;
}
</style>
