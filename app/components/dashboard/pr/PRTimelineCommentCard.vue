<template>
  <TimelineCommentCard
    :item="item"
    :empty-text="localizedEmptyText"
    :repo-owner="repoOwner"
    :repo-name="repoName"
    :enable-reactions="item.kind === 'comment' || item.kind === 'review-comment'"
    :reaction-target-kind="reactionTargetKind"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import TimelineCommentCard from '~/components/dashboard/timeline/TimelineCommentCard.vue';
import type { PRTimelineItem } from '~/composables/usePRTimelineEvents';

const { item, emptyText } = defineProps<{
  item: PRTimelineItem;
  emptyText?: string;
  repoOwner: string;
  repoName: string;
}>();

const { t } = useI18n();
const localizedEmptyText = computed(() => emptyText ?? t('detailTimeline.noCommentBody'));
const reactionTargetKind = computed(() =>
  item.kind === 'review-comment' ? 'pull-review-comment' : undefined
);
</script>
