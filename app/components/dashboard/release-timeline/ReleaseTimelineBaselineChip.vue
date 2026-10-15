<script setup lang="ts">
import { ClockIcon } from '@lucide/vue';
import { computed } from 'vue';

const props = defineProps<{
  baseline: string;
}>();

const { t } = useI18n();
const label = computed(() =>
  t('releaseTimeline.previousRefresh', {
    time: new Date(props.baseline).toLocaleString(),
  })
);
const time = computed(() => {
  const date = new Date(props.baseline);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return new Intl.DateTimeFormat(
    undefined,
    sameDay
      ? { hour: '2-digit', minute: '2-digit' }
      : { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }
  ).format(date);
});
</script>

<template>
  <time
    class="release-timeline-baseline-chip"
    :datetime="baseline"
    :title="label"
    :aria-label="label"
  >
    <ClockIcon :size="13" aria-hidden="true" />
    <span class="release-timeline-baseline-chip__time">{{ time }}</span>
  </time>
</template>

<style scoped lang="scss">
.release-timeline-baseline-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  flex: none;
  height: 1.5rem;
  max-width: 100%;
  padding: 0 0.55rem 0 0.45rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 999px;
  background: var(--gitpulse-surface-muted);
  color: var(--gitpulse-text-muted);
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
}

.release-timeline-baseline-chip__time {
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
