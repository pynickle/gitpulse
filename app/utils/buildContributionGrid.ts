import type { ContributionDay, ContributionWeek } from '#shared/types/users';

export interface ContributionMonthLabel {
  label: string;
  /** Zero-based column index this month's label sits above. */
  weekIndex: number;
}

export interface ContributionGrid {
  /** 7 rows (Sunday=0 … Saturday=6), each with one cell per week column. */
  rows: (ContributionDay | null)[][];
  weekCount: number;
  /** Month labels aligned to the columns where each month first appears. */
  months: ContributionMonthLabel[];
}

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

interface ParsedIsoDate {
  weekday: number;
  month: number;
}

/** Parse an ISO `YYYY-MM-DD` date into UTC weekday (0=Sun) and month (0=Jan). */
export function parseIsoDateParts(isoDate: string): ParsedIsoDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) {
    return null;
  }

  const year = Number.parseInt(match[1]!, 10);
  const month = Number.parseInt(match[2]!, 10);
  const day = Number.parseInt(match[3]!, 10);
  const timestamp = Date.UTC(year, month - 1, day);

  if (Number.isNaN(timestamp) || month < 1 || month > 12) {
    return null;
  }

  return { weekday: new Date(timestamp).getUTCDay(), month: month - 1 };
}

/**
 * Build the month labels aligned above the week columns, matching GitHub's rule:
 * a label appears above the first column whose month differs from the previous
 * labeled column's, and only when that column has room to render (not the last).
 */
function buildMonthLabels(weeks: ContributionWeek[]): ContributionMonthLabel[] {
  const labels: ContributionMonthLabel[] = [];
  let previousMonth: number | null = null;

  weeks.forEach((week, weekIndex) => {
    const firstDay = week.days[0];
    if (!firstDay) {
      return;
    }

    const parsed = parseIsoDateParts(firstDay.date);
    if (!parsed || parsed.month === previousMonth) {
      return;
    }

    previousMonth = parsed.month;

    // Skip labels that would sit above the final column (no space to render).
    if (weekIndex >= weeks.length - 1) {
      return;
    }

    labels.push({ label: MONTH_LABELS[parsed.month]!, weekIndex });
  });

  return labels;
}

/**
 * Arrange calendar weeks into GitHub's fixed 7-row grid. Each week becomes a
 * column; each day is placed on the row matching its weekday, so the first and
 * last columns keep the empty cells GitHub renders when a range starts or ends
 * mid-week. Placement is derived from the date itself, not array position, so a
 * short leading/trailing week never shifts the rows.
 */
export default function buildContributionGrid(weeks: ContributionWeek[]): ContributionGrid {
  const weekCount = weeks.length;
  const rows: (ContributionDay | null)[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: weekCount }, () => null)
  );

  weeks.forEach((week, columnIndex) => {
    for (const day of week.days) {
      const parsed = parseIsoDateParts(day.date);
      if (!parsed) {
        continue;
      }
      rows[parsed.weekday]![columnIndex] = day;
    }
  });

  return { rows, weekCount, months: buildMonthLabels(weeks) };
}
