<template>
  <span class="timeline-event-time">
    <ClockIcon
      :size="12"
      :stroke-width="2.5"
      class="timeline-event-time__icon"
      aria-hidden="true"
    />
    <span>{{ formatDurationFromNow(date, localeCode, relativeTimeNow) }}</span>
  </span>
</template>

<script setup lang="ts">
import { ClockIcon } from '@lucide/vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { formatDurationFromNow } from '~/utils/formatDurationFromNow';

const { date = '' } = defineProps<{
  date?: string;
}>();

const { locale } = useI18n();
const localeCode = computed(() => locale.value);
const relativeTimeNow = useRelativeTimeNow();
</script>

<style scoped lang="scss">
.timeline-event-time {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  white-space: nowrap;
}

.timeline-event-time__icon {
  flex: none;
}
</style>
