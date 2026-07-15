import { describe, expect, test } from 'bun:test';

import buildContributionGrid, { parseIsoDateParts } from '../app/utils/buildContributionGrid';
import type { ContributionWeek } from '../shared/types/users';

const day = (date: string, level = 0) => ({
  date,
  count: level,
  level: level as 0 | 1 | 2 | 3 | 4,
});

describe('parseIsoDateParts', () => {
  test('returns UTC weekday and zero-based month', () => {
    // 2026-01-04 is a Sunday.
    expect(parseIsoDateParts('2026-01-04')).toEqual({ weekday: 0, month: 0 });
    // 2026-03-10 is a Tuesday.
    expect(parseIsoDateParts('2026-03-10')).toEqual({ weekday: 2, month: 2 });
  });

  test('returns null for malformed dates', () => {
    expect(parseIsoDateParts('not-a-date')).toBeNull();
    expect(parseIsoDateParts('2026-13-01')).toBeNull();
  });
});

describe('buildContributionGrid', () => {
  test('places days on the row matching their weekday', () => {
    const weeks: ContributionWeek[] = [
      {
        days: [day('2026-01-04', 1), day('2026-01-05', 2), day('2026-01-10', 4)],
      },
    ];

    const grid = buildContributionGrid(weeks);

    expect(grid.weekCount).toBe(1);
    expect(grid.rows).toHaveLength(7);
    // Sunday row holds Jan 4, Monday holds Jan 5, Saturday holds Jan 10.
    expect(grid.rows[0]![0]?.date).toBe('2026-01-04');
    expect(grid.rows[1]![0]?.date).toBe('2026-01-05');
    expect(grid.rows[6]![0]?.date).toBe('2026-01-10');
    // Unfilled weekdays are null so the column keeps GitHub's empty cells.
    expect(grid.rows[2]![0]).toBeNull();
  });

  test('keeps a leading partial week aligned to real weekdays', () => {
    // Range starts on a Wednesday — Sun/Mon/Tue cells stay empty in column 0.
    const weeks: ContributionWeek[] = [
      { days: [day('2026-01-07'), day('2026-01-08'), day('2026-01-09'), day('2026-01-10')] },
    ];

    const grid = buildContributionGrid(weeks);

    expect(grid.rows[0]![0]).toBeNull();
    expect(grid.rows[1]![0]).toBeNull();
    expect(grid.rows[2]![0]).toBeNull();
    expect(grid.rows[3]![0]?.date).toBe('2026-01-07');
    expect(grid.rows[6]![0]?.date).toBe('2026-01-10');
  });

  test('derives month labels at the first column of each new month, skipping the last column', () => {
    const weeks: ContributionWeek[] = [
      { days: [day('2026-01-04')] },
      { days: [day('2026-01-11')] },
      { days: [day('2026-02-01')] },
      { days: [day('2026-02-08')] },
    ];

    const grid = buildContributionGrid(weeks);

    // January at column 0, February at column 2. The final column never carries a label.
    expect(grid.months).toEqual([
      { label: 'Jan', weekIndex: 0 },
      { label: 'Feb', weekIndex: 2 },
    ]);
  });

  test('handles an empty calendar', () => {
    const grid = buildContributionGrid([]);
    expect(grid.weekCount).toBe(0);
    expect(grid.rows).toHaveLength(7);
    expect(grid.rows.every((row) => row.length === 0)).toBe(true);
    expect(grid.months).toEqual([]);
  });
});
