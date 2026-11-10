<script setup lang="ts">
import { computed } from 'vue';

import type { RepoCommitListItemPayload } from '#shared/types/repos';
import CommitListRow from '~/components/dashboard/detail/CommitListRow.vue';
import type { PRTimelineItem } from '~/composables/usePRTimelineEvents';

const { item, repoOwner, repoName, pullNumber } = defineProps<{
  item: PRTimelineItem;
  repoOwner: string;
  repoName: string;
  pullNumber: number;
}>();

const { t } = useI18n();

const listItem = computed((): RepoCommitListItemPayload | null =>
  buildTimelineCommitPayload(
    item.commit,
    (sha) => `https://github.com/${repoOwner}/${repoName}/pull/${pullNumber}/commits/${sha}`
  )
);
</script>

<template>
  <div class="commit-item">
    <CommitListRow v-if="listItem" :commit="listItem" />
    <p v-else class="commit-item__fallback">
      {{ t('prReview.commitFallbackTitle') }}
    </p>
  </div>
</template>

<style scoped lang="scss">
.commit-item {
  border-radius: 12px;
  background-color: var(--gitpulse-surface-muted);
  overflow: hidden;

  /* The card already supplies the surface; a timeline commit row is not a list target. */
  :deep(.commit-list-row) {
    background: none;
  }
}

.commit-item__fallback {
  margin: 0;
  padding: 0.75rem 1rem;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  font-size: 0.875rem;
  font-weight: 500;
}
</style>
