import type { ReleaseTimelineGroup, TimelineRelease } from '#shared/types/release-follows';

export type ReleaseTimelineDateRow = {
  type: 'date';
  key: string;
  date: string;
};

export type ReleaseTimelineCardsRow = {
  type: 'cards';
  key: string;
  items: TimelineRelease[];
};

export type ReleaseTimelineGridRow =
  | ReleaseTimelineDateRow
  | ReleaseTimelineCardsRow
  | { type: 'baseline'; key: string; timestamp: string };

export default function buildReleaseTimelineGridRows(
  groups: readonly ReleaseTimelineGroup[],
  columnCount: 1 | 2 | 3,
  baseline?: string | null
): ReleaseTimelineGridRow[] {
  const rows: ReleaseTimelineGridRow[] = [];
  let inserted = false;
  const marker = () => {
    rows.push({ type: 'baseline', key: `baseline:${baseline}`, timestamp: baseline! });
    inserted = true;
  };
  for (const group of groups) {
    rows.push({ type: 'date', key: `date:${group.date}`, date: group.date });
    let items: TimelineRelease[] = [];
    const flush = () => {
      const first = items[0];
      if (first)
        rows.push({
          type: 'cards',
          key: `cards:${group.date}:${first.repository.id}:${first.id}`,
          items,
        });
      items = [];
    };
    for (const item of group.items) {
      if (baseline && !inserted && Date.parse(item.publishedAt) <= Date.parse(baseline)) {
        flush();
        marker();
      }
      items.push(item);
      if (items.length === columnCount) flush();
    }
    flush();
  }
  if (baseline && !inserted) marker();
  return rows;
}
