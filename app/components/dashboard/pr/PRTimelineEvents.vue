<template>
  <div>
    <div class="mb-4 is-flex is-align-items-center">
      <span class="is-size-5 has-text-weight-semibold ml-2 mr-4">Activity</span>
      <div v-if="loading" class="is-flex is-justify-content-center">
        <LoadingIcon class="icon" />
        <span class="ml-2 is-size-7 has-text-grey">Loading...</span>
      </div>
    </div>

    <div v-if="processedTimeline.length > 0">
      <div v-for="item in processedTimeline" :key="item.renderKey" class="mb-4">
        <PRTimelineCommentCard
          v-if="item.kind === 'comment' || item.kind === 'review-comment'"
          :item="item"
          empty-text="No comment body"
        />

        <PRTimelineReviewCard v-else-if="item.kind === 'review'" :item="item" />

        <PRTimelineCommitCard
          v-else-if="item.kind === 'commit'"
          :item="item"
          :repo-owner="repoOwner"
          :repo-name="repoName"
          :pull-number="pullNumber"
        />

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

    <div v-else-if="!loading" class="has-text-grey is-size-7">No activity yet</div>
  </div>
</template>

<script setup lang="ts">
import PRTimelineCommentCard from '~/components/dashboard/pr/PRTimelineCommentCard.vue';
import PRTimelineCommitCard from '~/components/dashboard/pr/PRTimelineCommitCard.vue';
import PRTimelineEventBody from '~/components/dashboard/pr/PRTimelineEventBody.vue';
import PRTimelineReviewCard from '~/components/dashboard/pr/PRTimelineReviewCard.vue';
import TimelineEventActorRow from '~/components/dashboard/timeline/TimelineEventActorRow.vue';
import LoadingIcon from '~/components/ui/LoadingIcon.vue';
import { usePRTimelineEvents, type PRTimelineItem } from '~/composables/usePRTimelineEvents';

const props = defineProps<{
  timeline: PRTimelineItem[];
  loading: boolean;
  repoOwner: string;
  repoName: string;
  pullNumber: number;
}>();

const emit = defineEmits<{
  (e: 'switch-issue', owner: string, repo: string, issueNumber: number): void;
  (e: 'switch-pull-request', owner: string, repo: string, pullNumber: number): void;
}>();

const { processedTimeline } = usePRTimelineEvents(() => props.timeline);

const handleSwitchIssue = (owner: string, repo: string, issueNumber: number) => {
  emit('switch-issue', owner, repo, issueNumber);
};

const handleSwitchPullRequest = (owner: string, repo: string, pullNumber: number) => {
  emit('switch-pull-request', owner, repo, pullNumber);
};
</script>
