<script setup lang="ts">
import { computed } from 'vue';

import type { RepoContributorWeek } from '#shared/types/repos';
import buildContributorSparkline from '~/utils/buildContributorSparkline';

const props = withDefaults(
  defineProps<{
    weeks: RepoContributorWeek[];
    width?: number;
    height?: number;
    label?: string;
  }>(),
  {
    width: 280,
    height: 36,
    label: '',
  }
);

const commitSeries = computed(() => props.weeks.map((week) => week.commits));

const paths = computed(() =>
  buildContributorSparkline(commitSeries.value, {
    width: props.width,
    height: props.height,
  })
);

const hasActivity = computed(() => paths.value.maxValue > 0);
const cssHeight = computed(() => `${props.height}px`);
</script>

<template>
  <svg
    class="contributor-sparkline"
    :class="{ 'contributor-sparkline--empty': !hasActivity }"
    :viewBox="`0 0 ${width} ${height}`"
    :width="width"
    :height="height"
    preserveAspectRatio="none"
    :role="label ? 'img' : 'presentation'"
    :aria-label="label || undefined"
    :aria-hidden="!label"
  >
    <path v-if="paths.areaPath" class="contributor-sparkline__area" :d="paths.areaPath" />
    <path
      v-if="paths.linePath"
      class="contributor-sparkline__line"
      :d="paths.linePath"
      fill="none"
    />
  </svg>
</template>

<style scoped lang="scss">
.contributor-sparkline {
  display: block;
  width: 100%;
  max-width: 100%;
  height: v-bind(cssHeight);
  overflow: visible;
  flex-shrink: 0;
}

.contributor-sparkline__area {
  fill: color-mix(in srgb, var(--gitpulse-success, #1a7f37) 26%, transparent);
}

.contributor-sparkline__line {
  stroke: var(--gitpulse-success, #1a7f37);
  // Slightly thinner so dense week series stay readable when scaled wide.
  stroke-width: 1.25;
  stroke-linejoin: round;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
}

.contributor-sparkline--empty {
  .contributor-sparkline__line {
    stroke: var(--gitpulse-border);
    stroke-width: 1;
  }
}
</style>
