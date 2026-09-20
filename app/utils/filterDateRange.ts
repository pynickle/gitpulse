/**
 * Pure helpers for the Release Timeline date range filter (ADR 0007).
 * All date keys are local `YYYY-MM-DD` strings, the same shape as
 * `ReleaseTimelineGroup.date`, so comparisons are plain string comparisons.
 */

export type DateRange = {
  from: string | null;
  to: string | null;
};

export const EMPTY_DATE_RANGE: DateRange = { from: null, to: null };

export type DateRangePresetId = 'last-30-days' | 'last-90-days' | 'this-year' | 'all-time';

export type CalendarDay = {
  /** Local date key (`YYYY-MM-DD`). */
  key: string;
  dayOfMonth: number;
  inMonth: boolean;
};

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_KEY_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

// 2026-01-05 is a Monday; anchoring weekday labels on a known Monday keeps Monday-first order.
const WEEKDAY_LABEL_ANCHOR = new Date(2026, 0, 5);

const pad = (value: number) => `${value}`.padStart(2, '0');

export function toLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const parseDateKey = (key: string) => {
  const match = DATE_KEY_PATTERN.exec(key);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
};

const shiftDateKey = (key: string, days: number): string => {
  const parsed = parseDateKey(key);
  if (!parsed) return key;
  const shifted = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days));
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
};

export function resolveDateRangePreset(preset: DateRangePresetId, todayKey: string): DateRange {
  switch (preset) {
    case 'last-30-days':
      return { from: shiftDateKey(todayKey, -29), to: todayKey };
    case 'last-90-days':
      return { from: shiftDateKey(todayKey, -89), to: todayKey };
    case 'this-year': {
      const parsed = parseDateKey(todayKey);
      return { from: parsed ? `${parsed.year}-01-01` : null, to: todayKey };
    }
    case 'all-time':
      return { from: null, to: null };
  }
}

export function shiftCalendarMonth(monthKey: string, months: number): string {
  const match = MONTH_KEY_PATTERN.exec(monthKey);
  if (!match) return monthKey;

  const total = Number(match[1]) * 12 + (Number(match[2]) - 1) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  return `${year}-${pad(month)}`;
}

export function clampCalendarMonth(monthKey: string, todayKey: string): string {
  const currentMonth = todayKey.slice(0, 7);
  return monthKey > currentMonth ? currentMonth : monthKey;
}

export function applyDateRangeClick(range: DateRange, dateKey: string): DateRange {
  if (range.from === null) {
    return { from: dateKey, to: null };
  }

  if (range.to === null) {
    return dateKey >= range.from ? { from: range.from, to: dateKey } : { from: dateKey, to: null };
  }

  return { from: dateKey, to: null };
}

export function buildCalendarMonthGrid(monthKey: string): CalendarDay[][] {
  const match = MONTH_KEY_PATTERN.exec(monthKey);
  if (!match) return [];

  const year = Number(match[1]);
  const month = Number(match[2]);
  const firstOfMonth = new Date(year, month - 1, 1);
  const leadingDays = (firstOfMonth.getDay() + 6) % 7;

  const weeks: CalendarDay[][] = [];
  let week: CalendarDay[] = [];

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(year, month - 1, 1 - leadingDays + index);
    week.push({
      key: toLocalDateKey(date),
      dayOfMonth: date.getDate(),
      inMonth: date.getMonth() === month - 1,
    });

    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }

  return weeks;
}

export function isDateInRange(range: DateRange, dateKey: string): boolean {
  if (range.from === null && range.to === null) return false;
  if (range.from !== null && dateKey < range.from) return false;
  if (range.to !== null && dateKey > range.to) return false;
  return true;
}

export function formatDateKeyLabel(key: string, locale: string): string {
  const parsed = parseDateKey(key);
  if (!parsed) return key;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(parsed.year, parsed.month - 1, parsed.day));
}

export function formatMonthKeyLabel(monthKey: string, locale: string): string {
  const match = MONTH_KEY_PATTERN.exec(monthKey);
  if (!match) return monthKey;
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }).format(
    new Date(Number(match[1]), Number(match[2]) - 1, 1)
  );
}

export function formatWeekdayLabels(locale: string): string[] {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  return Array.from({ length: 7 }, (_, index) =>
    formatter.format(
      new Date(
        WEEKDAY_LABEL_ANCHOR.getFullYear(),
        WEEKDAY_LABEL_ANCHOR.getMonth(),
        WEEKDAY_LABEL_ANCHOR.getDate() + index
      )
    )
  );
}
