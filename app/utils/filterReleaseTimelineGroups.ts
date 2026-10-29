import type {
  FollowedRepository,
  ReleaseTimelineGroup,
  RepositoryReleaseLookup,
  TimelineRelease,
} from '#shared/types/release-follows';
import { releaseNoteSearchText } from '#shared/utils/release-note-search-text';

import type { DateRange } from './filterDateRange';

export type ReleaseTimelineFilterState = {
  /** Selected `owner/name` values; OR within the dimension. */
  repositories: string[];
  /** Inclusive published-date range as local date keys; either bound may be null. */
  dateRange: DateRange;
  /** Required search terms across enabled fields, ANDed with the other dimensions. */
  query: string;
  /** Add full release notes to the default repository, title and tag fields. */
  includeReleaseNotes?: boolean;
  /** Hide releases GitHub marks as prereleases. */
  hidePrereleases: boolean;
};

export function toFollowedRepositoryKey(repository: FollowedRepository): string {
  return `${repository.owner}/${repository.name}`;
}

const toRepositoryMatchKey = (owner: string, name: string) => `${owner}/${name}`.toLowerCase();
const normalizeSearchText = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();
type SearchFields = { defaults: string[]; notes: string };
/** Prepare on source changes; full notes belong to pagination pages, never card previews. */
export function prepareReleaseTimelineSearch(
  groups: ReleaseTimelineGroup[],
  pages: Readonly<Record<string, RepositoryReleaseLookup>> = {}
): ReadonlyMap<TimelineRelease, SearchFields> {
  const descriptions = new Map<string, Map<number, string>>();
  for (const [repositoryId, page] of Object.entries(pages)) {
    if (page.status !== 'available') continue;
    descriptions.set(
      repositoryId,
      new Map(page.releases.map((release) => [release.id, release.description ?? '']))
    );
  }
  return new Map(
    groups.flatMap((group) =>
      group.items.map((item) => [
        item,
        {
          defaults: [
            `${item.repository.owner}/${item.repository.name}`,
            item.title,
            item.tagName,
          ].map(normalizeSearchText),
          notes: releaseNoteSearchText(descriptions.get(item.repository.id)?.get(item.id) ?? ''),
        },
      ])
    )
  );
}

function parseSearchTerms(query: string) {
  return [...query.matchAll(/"([^"]*)"?|([^\s"]+)/g)]
    .map((match) => normalizeSearchText(match[1] ?? match[2]!))
    .filter(Boolean)
    .map((text) => ({ text, versionLike: /^v?\d+(?:\.\d+)+(?:[-+][\da-z.-]+)?$/.test(text) }));
}

function matchesSearchTerm(field: string, term: ReturnType<typeof parseSearchTerms>[number]) {
  let position = field.indexOf(term.text);
  while (position !== -1) {
    if (
      !term.versionLike ||
      (!/\d/.test(field[position - 1] ?? '') &&
        !/\d/.test(field[position + term.text.length] ?? ''))
    )
      return true;
    position = field.indexOf(term.text, position + 1);
  }
  return false;
}

export function hasActiveTimelineFilter(
  state: Pick<ReleaseTimelineFilterState, 'repositories' | 'dateRange' | 'hidePrereleases'>
): boolean {
  return (
    state.repositories.length > 0 ||
    state.dateRange.from !== null ||
    state.dateRange.to !== null ||
    state.hidePrereleases
  );
}

export default function filterReleaseTimelineGroups(
  groups: ReleaseTimelineGroup[],
  filters: ReleaseTimelineFilterState,
  preparedSearch?: ReadonlyMap<TimelineRelease, SearchFields>
): ReleaseTimelineGroup[] {
  const terms = parseSearchTerms(filters.query);
  const selectedRepositories = new Set(
    filters.repositories.map((value) => value.trim().toLowerCase()).filter(Boolean)
  );
  const dateFrom = filters.dateRange.from;
  const dateTo = filters.dateRange.to;

  const hasRepositoryFilter = selectedRepositories.size > 0;
  const hasDateFilter = dateFrom !== null || dateTo !== null;
  const hasQueryFilter = terms.length > 0;

  if (!hasRepositoryFilter && !hasDateFilter && !hasQueryFilter && !filters.hidePrereleases) {
    return groups;
  }

  const search = hasQueryFilter ? (preparedSearch ?? prepareReleaseTimelineSearch(groups)) : null;

  const filtered: ReleaseTimelineGroup[] = [];

  for (const group of groups) {
    if (dateFrom !== null && group.date < dateFrom) continue;
    if (dateTo !== null && group.date > dateTo) continue;

    let items = group.items;
    let itemsChanged = false;

    if (filters.hidePrereleases) {
      const matched = items.filter((item) => !item.isPrerelease);
      itemsChanged = matched.length !== items.length;
      items = matched;
    }

    if (hasRepositoryFilter) {
      const matched = items.filter((item) =>
        selectedRepositories.has(toRepositoryMatchKey(item.repository.owner, item.repository.name))
      );
      itemsChanged = itemsChanged || matched.length !== items.length;
      items = matched;
    }

    if (hasQueryFilter) {
      const matched = items.filter((item) => {
        const prepared = search!.get(item);
        if (!prepared) return false;
        const fields = filters.includeReleaseNotes
          ? [...prepared.defaults, prepared.notes]
          : prepared.defaults;
        return terms.every((term) => fields.some((field) => matchesSearchTerm(field, term)));
      });
      itemsChanged = itemsChanged || matched.length !== items.length;
      items = matched;
    }

    if (items.length > 0) {
      filtered.push(itemsChanged ? { date: group.date, items } : group);
    }
  }

  return filtered;
}
