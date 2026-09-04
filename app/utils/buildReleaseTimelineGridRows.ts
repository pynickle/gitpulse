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

export type ReleaseTimelineGridRow = ReleaseTimelineDateRow | ReleaseTimelineCardsRow;

export default function buildReleaseTimelineGridRows(
  groups: readonly ReleaseTimelineGroup[],
  columnCount: 1 | 2 | 3
): ReleaseTimelineGridRow[] {
  const rows: ReleaseTimelineGridRow[] = [];

  for (const group of groups) {
    rows.push({
      type: 'date',
      key: `date:${group.date}`,
      date: group.date,
    });

    for (let index = 0; index < group.items.length; index += columnCount) {
      const items = group.items.slice(index, index + columnCount);
      const first = items[0];
      if (!first) {
        continue;
      }

      rows.push({
        type: 'cards',
        key: `cards:${group.date}:${first.repository.id}:${first.id}`,
        items,
      });
    }
  }

  return rows;
}
