<template>
  <TimelineCommentCard
    :item="props.item"
    :empty-text="localizedEmptyText"
    :repo-owner="props.repoOwner"
    :repo-name="props.repoName"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import TimelineCommentCard from '~/components/dashboard/timeline/TimelineCommentCard.vue';
import type { PRTimelineItem } from '~/composables/usePRTimelineEvents';

const props = defineProps<{
  item: PRTimelineItem;
  emptyText?: string;
  repoOwner: string;
  repoName: string;
}>();

const { t } = useI18n();
const localizedEmptyText = computed(() => props.emptyText ?? t('detailTimeline.noCommentBody'));
</script>
