<script setup lang="ts">
import { computed } from 'vue';

import type { ReactionSummaryItem } from '#shared/types/reactions';
import type { TimelineRelease } from '#shared/types/release-follows';
import ReactionBar from '~/components/dashboard/reactions/ReactionBar.vue';

const props = defineProps<{
  item: TimelineRelease;
}>();

const { t } = useI18n();
const { settings } = useUserSettings();
const { itemsFor, setItems } = useReleaseReactionSummaries();

const showReactions = computed(() => settings.value.releaseTimeline.showReactions);
const reactionItems = computed(() => itemsFor(props.item));

const handleReactionItems = (items: ReactionSummaryItem[]) => {
  setItems(props.item, items);
};
</script>

<template>
  <div
    v-if="showReactions"
    class="release-timeline-reaction-bar"
    data-release-drawer-ignore
    :aria-label="t('reactions.reactions')"
    @click.stop
  >
    <ReactionBar
      target-kind="release"
      :owner="item.repository.owner"
      :repo="item.repository.name"
      :target-id="item.id"
      :initial-items="reactionItems"
      initial-items-include-viewer-state
      @update:items="handleReactionItems"
    />
  </div>
</template>

<style scoped lang="scss">
.release-timeline-reaction-bar {
  min-width: 0;
}
</style>
