<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import {
  normalizeCopilotReviewEffort,
  type CopilotReviewEffort,
} from '#shared/utils/copilot-review';
import FilterDropdown from '~/components/ui/FilterDropdown.vue';

const effort = defineModel<CopilotReviewEffort>();
const { efforts = ['lite', 'balanced', 'max'] } = defineProps<{
  disabled?: boolean;
  efforts?: CopilotReviewEffort[];
}>();
const { t } = useI18n();
const options = computed(() => [
  { value: '', label: t('prReview.copilot.defaultEffort') },
  ...efforts.map((level) => ({ value: level, label: t(`prReview.copilot.${level}`) })),
]);
</script>

<template>
  <FilterDropdown
    :model-value="effort ?? ''"
    :options="options"
    class="copilot-effort"
    :disabled="disabled"
    :aria-label="t('prReview.copilot.effort')"
    content-width
    @update:model-value="effort = normalizeCopilotReviewEffort($event)"
  />
</template>

<style scoped lang="scss">
.copilot-effort :deep(.filter-dropdown-trigger) {
  height: 20px;
  padding: 0 4px;
  gap: 4px;
  font-size: 11px;
}
</style>
