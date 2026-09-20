import type { FollowedRepository, ReleaseTimelineGroup } from '#shared/types/release-follows';

import type { DateRange } from './filterDateRange';

export type ReleaseTimelineFilterState = {
  /** Selected `owner/name` values; OR within the dimension. */
  repositories: string[];
  /** Inclusive published-date range as local date keys; either bound may be null. */
  dateRange: DateRange;
  /** Title search, ANDed with the other dimensions. */
  query: string;
};

export function toFollowedRepositoryKey(repository: FollowedRepository): string {
  return `${repository.owner}/${repository.name}`;
}

const toRepositoryMatchKey = (owner: string, name: string) => `${owner}/${name}`.toLowerCase();

export function hasActiveTimelineFilter(
  state: Pick<ReleaseTimelineFilterState, 'repositories' | 'dateRange'>
): boolean {
  return (
    state.repositories.length > 0 || state.dateRange.from !== null || state.dateRange.to !== null
  );
}

export default function filterReleaseTimelineGroups(
  groups: ReleaseTimelineGroup[],
  filters: ReleaseTimelineFilterState
): ReleaseTimelineGroup[] {
  const normalizedQuery = filters.query.trim().toLowerCase();
  const selectedRepositories = new Set(
    filters.repositories.map((value) => value.trim().toLowerCase()).filter(Boolean)
  );
  const dateFrom = filters.dateRange.from;
  const dateTo = filters.dateRange.to;

  const hasRepositoryFilter = selectedRepositories.size > 0;
  const hasDateFilter = dateFrom !== null || dateTo !== null;
  const hasQueryFilter = Boolean(normalizedQuery);

  if (!hasRepositoryFilter && !hasDateFilter && !hasQueryFilter) return groups;

  const filtered: ReleaseTimelineGroup[] = [];

  for (const group of groups) {
    if (dateFrom !== null && group.date < dateFrom) continue;
    if (dateTo !== null && group.date > dateTo) continue;

    let items = group.items;
    let itemsChanged = false;

    if (hasRepositoryFilter) {
      const matched = items.filter((item) =>
        selectedRepositories.has(toRepositoryMatchKey(item.repository.owner, item.repository.name))
      );
      itemsChanged = itemsChanged || matched.length !== items.length;
      items = matched;
    }

    if (hasQueryFilter) {
      const matched = items.filter((item) => item.title.toLowerCase().includes(normalizedQuery));
      itemsChanged = itemsChanged || matched.length !== items.length;
      items = matched;
    }

    if (items.length > 0) {
      filtered.push(itemsChanged ? { date: group.date, items } : group);
    }
  }

  return filtered;
}
