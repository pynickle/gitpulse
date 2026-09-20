<script setup lang="ts">
import {
  ArrowRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  XIcon,
} from '@lucide/vue';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import {
  applyDateRangeClick,
  buildCalendarMonthGrid,
  clampCalendarMonth,
  formatDateKeyLabel,
  formatMonthKeyLabel,
  formatWeekdayLabels,
  isDateInRange,
  resolveDateRangePreset,
  shiftCalendarMonth,
  toLocalDateKey,
  type DateRange,
  type DateRangePresetId,
} from '~/utils/filterDateRange';

const modelValue = defineModel<DateRange>({ required: true });

const { t, locale } = useI18n();

const todayKey = toLocalDateKey(new Date());
const todayMonth = todayKey.slice(0, 7);

const presets: { id: DateRangePresetId; labelKey: string }[] = [
  { id: 'last-30-days', labelKey: 'releaseTimeline.filterPanelPresetLast30' },
  { id: 'last-90-days', labelKey: 'releaseTimeline.filterPanelPresetLast90' },
  { id: 'this-year', labelKey: 'releaseTimeline.filterPanelPresetThisYear' },
  { id: 'all-time', labelKey: 'releaseTimeline.filterPanelPresetAllTime' },
];

const visibleMonth = ref(
  clampCalendarMonth(
    (modelValue.value.to ?? modelValue.value.from ?? todayKey).slice(0, 7),
    todayKey
  )
);

const weeks = computed(() => buildCalendarMonthGrid(visibleMonth.value));
const monthLabel = computed(() => formatMonthKeyLabel(visibleMonth.value, locale.value));
const weekdayLabels = computed(() => formatWeekdayLabels(locale.value));

const canGoNextMonth = computed(() => shiftCalendarMonth(visibleMonth.value, 1) <= todayMonth);
const canGoNextYear = computed(() => shiftCalendarMonth(visibleMonth.value, 12) <= todayMonth);

const shiftMonth = (months: number) => {
  visibleMonth.value = clampCalendarMonth(shiftCalendarMonth(visibleMonth.value, months), todayKey);
};

const applyPreset = (preset: DateRangePresetId) => {
  const range = resolveDateRangePreset(preset, todayKey);
  modelValue.value = range;
  visibleMonth.value = clampCalendarMonth((range.to ?? todayKey).slice(0, 7), todayKey);
};

const selectDay = (key: string) => {
  if (key > todayKey) return;
  modelValue.value = applyDateRangeClick(modelValue.value, key);
};

const removeBound = (bound: 'from' | 'to') => {
  modelValue.value = { ...modelValue.value, [bound]: null };
};
</script>

<template>
  <div class="filter-date-range">
    <div class="filter-date-range__presets">
      <button
        v-for="preset in presets"
        :key="preset.id"
        class="filter-date-range__preset"
        type="button"
        @click="applyPreset(preset.id)"
      >
        {{ t(preset.labelKey) }}
      </button>
    </div>

    <div class="filter-date-range__chips">
      <span v-if="!modelValue.from && !modelValue.to" class="filter-date-range__chips-empty">
        {{ t('releaseTimeline.filterPanelPresetAllTime') }}
      </span>
      <template v-else>
        <span v-if="modelValue.from" class="filter-date-range__chip">
          <span class="filter-date-range__chip-label">{{
            formatDateKeyLabel(modelValue.from, locale)
          }}</span>
          <button
            class="filter-date-range__chip-remove"
            type="button"
            :aria-label="t('releaseTimeline.filterPanelRemoveFrom')"
            :title="t('releaseTimeline.filterPanelRemoveFrom')"
            @click="removeBound('from')"
          >
            <XIcon :size="12" aria-hidden="true" />
          </button>
        </span>
        <ArrowRightIcon
          v-if="modelValue.from && modelValue.to"
          :size="14"
          class="filter-date-range__chips-arrow"
          aria-hidden="true"
        />
        <span v-if="modelValue.to" class="filter-date-range__chip">
          <span class="filter-date-range__chip-label">{{
            formatDateKeyLabel(modelValue.to, locale)
          }}</span>
          <button
            class="filter-date-range__chip-remove"
            type="button"
            :aria-label="t('releaseTimeline.filterPanelRemoveTo')"
            :title="t('releaseTimeline.filterPanelRemoveTo')"
            @click="removeBound('to')"
          >
            <XIcon :size="12" aria-hidden="true" />
          </button>
        </span>
      </template>
    </div>

    <div class="filter-date-range__calendar">
      <div class="filter-date-range__header">
        <button
          class="filter-date-range__nav"
          type="button"
          :aria-label="t('releaseTimeline.filterPanelPrevYear')"
          :title="t('releaseTimeline.filterPanelPrevYear')"
          @click="shiftMonth(-12)"
        >
          <ChevronsLeftIcon :size="15" aria-hidden="true" />
        </button>
        <button
          class="filter-date-range__nav"
          type="button"
          :aria-label="t('releaseTimeline.filterPanelPrevMonth')"
          :title="t('releaseTimeline.filterPanelPrevMonth')"
          @click="shiftMonth(-1)"
        >
          <ChevronLeftIcon :size="16" aria-hidden="true" />
        </button>
        <span class="filter-date-range__month" aria-live="polite">{{ monthLabel }}</span>
        <button
          class="filter-date-range__nav"
          type="button"
          :aria-label="t('releaseTimeline.filterPanelNextMonth')"
          :title="t('releaseTimeline.filterPanelNextMonth')"
          :disabled="!canGoNextMonth"
          @click="shiftMonth(1)"
        >
          <ChevronRightIcon :size="16" aria-hidden="true" />
        </button>
        <button
          class="filter-date-range__nav"
          type="button"
          :aria-label="t('releaseTimeline.filterPanelNextYear')"
          :title="t('releaseTimeline.filterPanelNextYear')"
          :disabled="!canGoNextYear"
          @click="shiftMonth(12)"
        >
          <ChevronsRightIcon :size="15" aria-hidden="true" />
        </button>
      </div>

      <div class="filter-date-range__weekdays" aria-hidden="true">
        <span v-for="label in weekdayLabels" :key="label">{{ label }}</span>
      </div>

      <div class="filter-date-range__weeks">
        <div v-for="week in weeks" :key="week[0]?.key" class="filter-date-range__week">
          <button
            v-for="day in week"
            :key="day.key"
            class="filter-date-range__day"
            type="button"
            :class="{
              'filter-date-range__day--out': !day.inMonth,
              'filter-date-range__day--today': day.key === todayKey,
              'filter-date-range__day--in-range': isDateInRange(modelValue, day.key),
              'filter-date-range__day--start': modelValue.from === day.key,
              'filter-date-range__day--end': modelValue.to === day.key,
            }"
            :disabled="day.key > todayKey"
            :aria-label="formatDateKeyLabel(day.key, locale)"
            :aria-pressed="modelValue.from === day.key || modelValue.to === day.key"
            @click="selectDay(day.key)"
          >
            {{ day.dayOfMonth }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.filter-date-range {
  display: grid;
  gap: 0.75rem;
  min-width: 0;
}

.filter-date-range__presets {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.filter-date-range__preset {
  padding: 0.3rem 0.6rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 999px;
  background: var(--gitpulse-surface, var(--gitpulse-page-bg));
  color: var(--gitpulse-text-muted);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    border-color 0.12s ease,
    color 0.12s ease,
    background 0.12s ease;
}

.filter-date-range__preset:hover,
.filter-date-range__preset:focus-visible {
  border-color: var(--gitpulse-accent);
  color: var(--gitpulse-accent);
  background: var(--gitpulse-info-soft);
}

.filter-date-range__chips {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
  min-height: 1.75rem;
}

.filter-date-range__chips-empty {
  color: var(--gitpulse-text-subtle);
  font-size: 0.75rem;
}

.filter-date-range__chips-arrow {
  flex-shrink: 0;
  color: var(--gitpulse-text-muted);
}

.filter-date-range__chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  max-width: 100%;
  padding: 0.2rem 0.3rem 0.2rem 0.55rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 999px;
  background: var(--gitpulse-surface-muted);
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  font-size: 0.75rem;
  font-weight: 600;
}

.filter-date-range__chip-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.filter-date-range__chip-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--gitpulse-text-muted);
  cursor: pointer;
}

.filter-date-range__chip-remove:hover,
.filter-date-range__chip-remove:focus-visible {
  background: var(--gitpulse-surface-hover);
  color: var(--gitpulse-text-strong);
}

.filter-date-range__calendar {
  border: 1px solid var(--gitpulse-border);
  border-radius: var(--gitpulse-radius-md);
  background: var(--gitpulse-surface, var(--gitpulse-page-bg));
  padding: 0.6rem;
}

.filter-date-range__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.25rem;
  margin-bottom: 0.4rem;
}

.filter-date-range__nav {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.65rem;
  height: 1.65rem;
  padding: 0;
  border: 0;
  border-radius: var(--gitpulse-radius-sm);
  background: transparent;
  color: var(--gitpulse-text-muted);
  cursor: pointer;
}

.filter-date-range__nav:hover:not(:disabled),
.filter-date-range__nav:focus-visible:not(:disabled) {
  background: var(--gitpulse-info-soft);
  color: var(--gitpulse-link);
}

.filter-date-range__nav:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.filter-date-range__month {
  flex: 1;
  min-width: 0;
  text-align: center;
  color: var(--gitpulse-text-strong);
  font-size: 0.8rem;
  font-weight: 650;
}

.filter-date-range__weekdays,
.filter-date-range__week {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
}

.filter-date-range__weekdays {
  margin-bottom: 0.2rem;
}

.filter-date-range__weekdays span {
  text-align: center;
  color: var(--gitpulse-text-subtle);
  font-size: 0.68rem;
  font-weight: 600;
}

.filter-date-range__day {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 1.9rem;
  margin: 1px 0;
  padding: 0;
  border: 0;
  border-radius: var(--gitpulse-radius-sm);
  background: transparent;
  color: var(--gitpulse-text);
  font-size: 0.75rem;
  cursor: pointer;
  transition:
    background 0.1s ease,
    color 0.1s ease;
}

.filter-date-range__day:hover:not(:disabled) {
  background: var(--gitpulse-surface-active);
}

.filter-date-range__day:focus-visible {
  outline: 2px solid var(--gitpulse-info);
  outline-offset: -2px;
}

.filter-date-range__day--out {
  color: var(--gitpulse-text-subtle);
  opacity: 0.6;
}

.filter-date-range__day:disabled {
  color: var(--gitpulse-text-subtle);
  opacity: 0.35;
  cursor: not-allowed;
}

.filter-date-range__day--today {
  font-weight: 750;
  color: var(--gitpulse-link);
}

.filter-date-range__day--in-range {
  background: var(--gitpulse-info-soft);
  border-radius: 0;
  color: var(--gitpulse-text-strong);
}

.filter-date-range__day--in-range:hover:not(:disabled) {
  background: var(--gitpulse-info-soft);
}

.filter-date-range__day--start {
  border-radius: 999px 0 0 999px;
}

.filter-date-range__day--end {
  border-radius: 0 999px 999px 0;
}

.filter-date-range__day--start.filter-date-range__day--end {
  border-radius: 999px;
}

.filter-date-range__day--start,
.filter-date-range__day--end {
  background: var(--gitpulse-accent);
  color: var(--gitpulse-on-accent, #fff);
  font-weight: 700;
}

.filter-date-range__day--start:hover:not(:disabled),
.filter-date-range__day--end:hover:not(:disabled) {
  background: var(--gitpulse-accent);
}
</style>
