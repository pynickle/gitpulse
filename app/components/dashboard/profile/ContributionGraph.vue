<script setup lang="ts">
import { computed } from 'vue';

import type { ContributionCalendar } from '#shared/types/users';
import buildContributionGrid from '~/utils/buildContributionGrid';

const props = defineProps<{
  calendar: ContributionCalendar;
}>();

const { t, locale } = useI18n();

const grid = computed(() => buildContributionGrid(props.calendar.weeks));

/** Flattened cells in row-major order (all of row 0, then row 1, …) for a single CSS grid. */
const flatCells = computed(() => grid.value.rows.flat());

/** Sunday, Tuesday, Thursday are labeled on GitHub; the rest are blank spacers. */
const WEEKDAY_LABEL_ROWS = new Set([1, 3, 5]);
const weekdayLabels = computed(() => {
  const formatter = new Intl.DateTimeFormat(locale.value, { weekday: 'short' });
  // 2023-01-01 is a Sunday — walk seven days to get localized short names.
  return Array.from({ length: 7 }, (_, weekday) => {
    if (!WEEKDAY_LABEL_ROWS.has(weekday)) {
      return '';
    }
    return formatter.format(new Date(Date.UTC(2023, 0, 1 + weekday)));
  });
});

const dateFormatter = computed(
  () => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' })
);

const cellTitle = (date: string, count: number) => {
  const readableDate = (() => {
    const parsed = new Date(`${date}T00:00:00Z`);
    return Number.isNaN(parsed.getTime()) ? date : dateFormatter.value.format(parsed);
  })();
  return t('profile.contributions.cellTitle', { count, date: readableDate });
};
</script>

<template>
  <section class="contribution-graph" aria-label="Contribution graph">
    <header class="contribution-graph__header">
      <h3 class="contribution-graph__total">
        {{ t('profile.contributions.total', { count: calendar.totalContributions }) }}
      </h3>
    </header>

    <div class="contribution-graph__scroll">
      <div class="contribution-graph__canvas">
        <div class="contribution-graph__months" aria-hidden="true">
          <span
            v-for="month in grid.months"
            :key="`${month.label}-${month.weekIndex}`"
            class="contribution-graph__month"
            :style="{ gridColumn: month.weekIndex + 1 }"
          >
            {{ month.label }}
          </span>
        </div>

        <div class="contribution-graph__body">
          <div class="contribution-graph__weekdays" aria-hidden="true">
            <span
              v-for="(label, weekday) in weekdayLabels"
              :key="weekday"
              class="contribution-graph__weekday"
            >
              {{ label }}
            </span>
          </div>

          <div
            class="contribution-graph__grid"
            :style="{
              gridTemplateColumns: `repeat(${grid.weekCount}, var(--contribution-cell-size))`,
            }"
            role="grid"
          >
            <template v-for="(cell, index) in flatCells" :key="index">
              <span
                v-if="cell"
                class="contribution-graph__cell"
                :data-level="cell.level"
                role="gridcell"
                :title="cellTitle(cell.date, cell.count)"
              />
              <span
                v-else
                class="contribution-graph__cell contribution-graph__cell--empty"
                role="gridcell"
              />
            </template>
          </div>
        </div>

        <footer class="contribution-graph__legend">
          <span class="contribution-graph__legend-label">{{
            t('profile.contributions.less')
          }}</span>
          <span class="contribution-graph__cell" :data-level="0" />
          <span class="contribution-graph__cell" :data-level="1" />
          <span class="contribution-graph__cell" :data-level="2" />
          <span class="contribution-graph__cell" :data-level="3" />
          <span class="contribution-graph__cell" :data-level="4" />
          <span class="contribution-graph__legend-label">{{
            t('profile.contributions.more')
          }}</span>
        </footer>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.contribution-graph {
  --contribution-cell-size: 11px;
  --contribution-cell-gap: 3px;

  padding: 1rem 1.25rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: var(--gitpulse-radius-lg, 10px);
  background: var(--gitpulse-surface);
}

.contribution-graph__header {
  margin-bottom: 0.75rem;
}

.contribution-graph__total {
  margin: 0;
  color: var(--gitpulse-text-strong);
  font-size: 0.95rem;
  font-weight: 600;
}

.contribution-graph__scroll {
  overflow-x: auto;
  padding-bottom: 0.25rem;
}

.contribution-graph__canvas {
  display: inline-block;
  min-width: min-content;
}

// Month row aligns to the same column tracks as the grid, offset by the weekday gutter.
.contribution-graph__months {
  display: grid;
  grid-template-columns: repeat(v-bind('grid.weekCount'), var(--contribution-cell-size));
  gap: var(--contribution-cell-gap);
  margin-left: calc(var(--contribution-weekday-gutter, 28px) + var(--contribution-cell-gap));
  margin-bottom: 0.35rem;
  height: 1rem;
}

.contribution-graph__month {
  grid-row: 1;
  color: var(--gitpulse-text-muted);
  font-size: 0.7rem;
  white-space: nowrap;
}

.contribution-graph__body {
  display: flex;
  gap: var(--contribution-cell-gap);
}

.contribution-graph__weekdays {
  display: grid;
  grid-template-rows: repeat(7, var(--contribution-cell-size));
  gap: var(--contribution-cell-gap);
  width: var(--contribution-weekday-gutter, 28px);
}

.contribution-graph__weekday {
  display: flex;
  align-items: center;
  height: var(--contribution-cell-size);
  color: var(--gitpulse-text-muted);
  font-size: 0.65rem;
  line-height: 1;
}

.contribution-graph__grid {
  display: grid;
  grid-auto-flow: row;
  gap: var(--contribution-cell-gap);
}

.contribution-graph__cell {
  width: var(--contribution-cell-size);
  height: var(--contribution-cell-size);
  border-radius: 2px;
  background: var(--contribution-level-0);
  outline: 1px solid var(--contribution-cell-outline);
  outline-offset: -1px;
}

.contribution-graph__cell--empty {
  background: transparent;
  outline: none;
}

.contribution-graph__cell[data-level='0'] {
  background: var(--contribution-level-0);
}
.contribution-graph__cell[data-level='1'] {
  background: var(--contribution-level-1);
}
.contribution-graph__cell[data-level='2'] {
  background: var(--contribution-level-2);
}
.contribution-graph__cell[data-level='3'] {
  background: var(--contribution-level-3);
}
.contribution-graph__cell[data-level='4'] {
  background: var(--contribution-level-4);
}

.contribution-graph__legend {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--contribution-cell-gap);
  margin-top: 0.6rem;
}

.contribution-graph__legend-label {
  color: var(--gitpulse-text-muted);
  font-size: 0.68rem;
}

.contribution-graph__legend .contribution-graph__cell {
  outline-color: var(--contribution-cell-outline);
}

// GitHub light-mode green ramp.
.contribution-graph {
  --contribution-cell-outline: rgba(27, 31, 35, 0.06);
  --contribution-level-0: #ebedf0;
  --contribution-level-1: #9be9a8;
  --contribution-level-2: #40c463;
  --contribution-level-3: #30a14e;
  --contribution-level-4: #216e39;
}

@media (prefers-reduced-motion: reduce) {
  .contribution-graph__cell {
    transition: none;
  }
}
</style>

<style lang="scss">
// GitHub dark-mode green ramp — applied via the app's global dark selectors.
html.dark .contribution-graph,
html[data-color-mode='dark'] .contribution-graph {
  --contribution-cell-outline: rgba(255, 255, 255, 0.05);
  --contribution-level-0: #161b22;
  --contribution-level-1: #0e4429;
  --contribution-level-2: #006d32;
  --contribution-level-3: #26a641;
  --contribution-level-4: #39d353;
}
</style>
