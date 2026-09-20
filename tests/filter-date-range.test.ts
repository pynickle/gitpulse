import { describe, expect, test } from 'bun:test';

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
} from '../app/utils/filterDateRange';

describe('toLocalDateKey', () => {
  test('formats local date components as a zero-padded YYYY-MM-DD key', () => {
    expect(toLocalDateKey(new Date(2026, 7, 22, 23, 30))).toBe('2026-08-22');
    expect(toLocalDateKey(new Date(2026, 0, 5, 0, 30))).toBe('2026-01-05');
    expect(toLocalDateKey(new Date(2025, 11, 31, 12, 0))).toBe('2025-12-31');
  });
});

describe('resolveDateRangePreset', () => {
  test('resolves last 30 / 90 days as inclusive ranges ending today', () => {
    expect(resolveDateRangePreset('last-30-days', '2026-08-22')).toEqual({
      from: '2026-07-24',
      to: '2026-08-22',
    });
    expect(resolveDateRangePreset('last-90-days', '2026-08-22')).toEqual({
      from: '2026-05-25',
      to: '2026-08-22',
    });
  });

  test('resolves this year from January 1st to today', () => {
    expect(resolveDateRangePreset('this-year', '2026-08-22')).toEqual({
      from: '2026-01-01',
      to: '2026-08-22',
    });
    expect(resolveDateRangePreset('this-year', '2026-01-01')).toEqual({
      from: '2026-01-01',
      to: '2026-01-01',
    });
  });

  test('resolves all time to an open range', () => {
    expect(resolveDateRangePreset('all-time', '2026-08-22')).toEqual({ from: null, to: null });
  });

  test('crosses month and year boundaries when counting back', () => {
    expect(resolveDateRangePreset('last-30-days', '2026-03-01')).toEqual({
      from: '2026-01-31',
      to: '2026-03-01',
    });
    expect(resolveDateRangePreset('last-30-days', '2026-01-05')).toEqual({
      from: '2025-12-07',
      to: '2026-01-05',
    });
  });
});

describe('shiftCalendarMonth', () => {
  test('moves by single months', () => {
    expect(shiftCalendarMonth('2026-08', 1)).toBe('2026-09');
    expect(shiftCalendarMonth('2026-08', -1)).toBe('2026-07');
  });

  test('moves by years', () => {
    expect(shiftCalendarMonth('2026-08', 12)).toBe('2027-08');
    expect(shiftCalendarMonth('2026-08', -12)).toBe('2025-08');
  });

  test('wraps across year boundaries', () => {
    expect(shiftCalendarMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftCalendarMonth('2026-01', -1)).toBe('2025-12');
  });
});

describe('clampCalendarMonth', () => {
  test('clamps months after the current month back to it', () => {
    expect(clampCalendarMonth('2026-10', '2026-09-20')).toBe('2026-09');
    expect(clampCalendarMonth('2027-01', '2026-09-20')).toBe('2026-09');
  });

  test('keeps the current and earlier months', () => {
    expect(clampCalendarMonth('2026-09', '2026-09-20')).toBe('2026-09');
    expect(clampCalendarMonth('2026-08', '2026-09-20')).toBe('2026-08');
  });
});

describe('applyDateRangeClick', () => {
  const empty: DateRange = { from: null, to: null };

  test('first click sets the range start', () => {
    expect(applyDateRangeClick(empty, '2026-08-10')).toEqual({ from: '2026-08-10', to: null });
  });

  test('second click on a later day sets the range end', () => {
    expect(applyDateRangeClick({ from: '2026-08-10', to: null }, '2026-08-22')).toEqual({
      from: '2026-08-10',
      to: '2026-08-22',
    });
  });

  test('second click on the same day yields a single-day range', () => {
    expect(applyDateRangeClick({ from: '2026-08-10', to: null }, '2026-08-10')).toEqual({
      from: '2026-08-10',
      to: '2026-08-10',
    });
  });

  test('second click earlier than the start becomes the new start', () => {
    expect(applyDateRangeClick({ from: '2026-08-10', to: null }, '2026-08-01')).toEqual({
      from: '2026-08-01',
      to: null,
    });
  });

  test('a click after a complete range starts a new selection', () => {
    expect(applyDateRangeClick({ from: '2026-08-10', to: '2026-08-22' }, '2026-09-01')).toEqual({
      from: '2026-09-01',
      to: null,
    });
  });
});

describe('buildCalendarMonthGrid', () => {
  test('builds Monday-first weeks of local date keys for the month', () => {
    const weeks = buildCalendarMonthGrid('2026-08');

    expect(weeks).toHaveLength(6);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks[0]?.[0]?.key).toBe('2026-07-27');
    expect(weeks[0]?.[0]?.inMonth).toBe(false);
    expect(weeks[1]?.[0]?.key).toBe('2026-08-03');
    expect(weeks[5]?.[6]?.key).toBe('2026-09-06');
    expect(weeks[5]?.[6]?.inMonth).toBe(false);
  });

  test('marks only the displayed month as in-month', () => {
    const weeks = buildCalendarMonthGrid('2026-02');
    const inMonthDays = weeks
      .flat()
      .filter((day) => day.inMonth)
      .map((day) => day.key);

    expect(inMonthDays).toHaveLength(28);
    expect(inMonthDays[0]).toBe('2026-02-01');
    expect(inMonthDays.at(-1)).toBe('2026-02-28');
  });

  test('handles a month that starts on Monday without leading days', () => {
    const weeks = buildCalendarMonthGrid('2026-06');

    expect(weeks[0]?.[0]?.key).toBe('2026-06-01');
    expect(weeks[0]?.[0]?.inMonth).toBe(true);
  });
});

describe('isDateInRange', () => {
  const range: DateRange = { from: '2026-08-10', to: '2026-08-22' };

  test('includes both bounds', () => {
    expect(isDateInRange(range, '2026-08-10')).toBe(true);
    expect(isDateInRange(range, '2026-08-22')).toBe(true);
    expect(isDateInRange(range, '2026-08-16')).toBe(true);
  });

  test('excludes days outside the range', () => {
    expect(isDateInRange(range, '2026-08-09')).toBe(false);
    expect(isDateInRange(range, '2026-08-23')).toBe(false);
  });

  test('treats null bounds as open ends and an empty range as no highlight', () => {
    expect(isDateInRange({ from: '2026-08-10', to: null }, '2026-09-30')).toBe(true);
    expect(isDateInRange({ from: null, to: '2026-08-22' }, '2020-01-01')).toBe(true);
    expect(isDateInRange({ from: null, to: null }, '2026-08-16')).toBe(false);
  });
});

describe('label formatting', () => {
  test('formats date keys in the requested locale from local components', () => {
    expect(formatDateKeyLabel('2026-08-22', 'en')).toBe('August 22, 2026');
    expect(formatDateKeyLabel('2026-01-05', 'en')).toBe('January 5, 2026');
    expect(formatDateKeyLabel('not-a-date', 'en')).toBe('not-a-date');
  });

  test('formats month keys as a year-and-month label', () => {
    expect(formatMonthKeyLabel('2026-08', 'en')).toBe('August 2026');
    expect(formatMonthKeyLabel('2026-01', 'en')).toBe('January 2026');
    expect(formatMonthKeyLabel('2026-13', 'en')).toBe('2026-13');
  });

  test('formats weekday labels Monday-first', () => {
    expect(formatWeekdayLabels('en')).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });
});
