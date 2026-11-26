<script setup lang="ts">
import { computed } from 'vue';

import type { ReactionSummaryItem } from '#shared/types/reactions';
import type { TimelineRelease } from '#shared/types/release-follows';
import ReactionBar from '~/components/dashboard/reactions/ReactionBar.vue';

const { item } = defineProps<{
  item: TimelineRelease;
}>();

const { t } = useI18n();
const { settings } = useUserSettings();
const { itemsFor, setItems, canReactFor, setCanReact } = useReleaseReactionSummaries();

const showReactions = computed(() => settings.value.releaseTimeline.showReactions);
const reactionItems = computed(() => itemsFor(item));
const canReact = computed(() => canReactFor(item));

const handleReactionItems = (items: ReactionSummaryItem[]) => {
  setItems(item, items);
};

const handleCanReact = (value: boolean) => {
  setCanReact(item, value);
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
      :can-react="canReact"
      initial-items-include-viewer-state
      @update:items="handleReactionItems"
      @update:can-react="handleCanReact"
    />
  </div>
</template>

<style scoped lang="scss">
.release-timeline-reaction-bar {
  min-width: 0;
}
</style>
