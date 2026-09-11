import type { ReleaseTimelineGroup } from '#shared/types/release-follows';

export default function filterReleaseTimelineGroupsByTitle(
  groups: ReleaseTimelineGroup[],
  query: string
): ReleaseTimelineGroup[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) return groups;

  const filtered: ReleaseTimelineGroup[] = [];

  for (const group of groups) {
    const items = group.items.filter((item) => item.title.toLowerCase().includes(normalizedQuery));

    if (items.length > 0) {
      filtered.push({ date: group.date, items });
    }
  }

  return filtered;
}
