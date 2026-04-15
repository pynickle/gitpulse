<template>
  <div>
    <div class="mb-4 is-flex is-align-items-center">
      <span class="is-size-5 has-text-weight-semibold ml-2 mr-4">{{
        t('issueDetail.activity')
      }}</span>
      <div v-if="loading" class="is-flex is-justify-content-center">
        <LoadingIcon class="icon" />
        <span class="ml-2 is-size-7 has-text-grey">{{ t('issueDetail.loadingTimelines') }}</span>
      </div>
    </div>

    <div v-if="processedTimeline.length > 0">
      <div v-for="item in processedTimeline" :key="item.renderKey" class="mb-4">
        <IssueTimelineCommentCard
          v-if="item.kind === 'comment' && item.eventType === 'commented'"
          :item="item"
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

        <div v-else class="mx-2">
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

    <div v-else-if="!loading" class="has-text-grey is-size-7">
      {{ t('issueDetail.noActivity') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import IssueTimelineCommentCard from '~/components/dashboard/issue/IssueTimelineCommentCard.vue';
import IssueTimelineCommitCard from '~/components/dashboard/issue/IssueTimelineCommitCard.vue';
import IssueTimelineEventBody from '~/components/dashboard/issue/IssueTimelineEventBody.vue';
import IssueTimelineReferencedEventCard from '~/components/dashboard/issue/IssueTimelineReferencedEventCard.vue';
import TimelineEventActorRow from '~/components/dashboard/timeline/TimelineEventActorRow.vue';
import LoadingIcon from '~/components/ui/LoadingIcon.vue';
import {
  useIssueTimelineEvents,
  type IssueTimelineItem,
} from '~/composables/useIssueTimelineEvents';

const { t } = useI18n();

const props = defineProps<{
  timeline: IssueTimelineItem[];
  loading: boolean;
  repoOwner: string;
  repoName: string;
  issueNumber: number;
}>();

const emit = defineEmits<{
  (e: 'switch-issue', owner: string, repo: string, issueNumber: number): void;
  (e: 'switch-pull-request', owner: string, repo: string, pullNumber: number): void;
}>();

const { processedTimeline } = useIssueTimelineEvents(
  () => props.timeline,
  () => ({
    repoOwner: props.repoOwner,
    repoName: props.repoName,
    issueNumber: props.issueNumber,
  })
);

const switchToIssue = (owner: string, repo: string, issueNumber: number) => {
  emit('switch-issue', owner, repo, issueNumber);
};

const switchToPullRequest = (owner: string, repo: string, pullNumber: number) => {
  emit('switch-pull-request', owner, repo, pullNumber);
};
</script>
