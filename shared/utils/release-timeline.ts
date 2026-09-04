import type { ReactionSummaryItem } from '#shared/types/reactions';
import type {
  ClassifiableLookup,
  FollowedRepository,
  LookupClassification,
  ReleaseTimeline,
  ReleaseTimelineGroup,
  RepositoryReleaseItem,
  RepositoryReleaseLookup,
  TimelineRelease,
} from '#shared/types/release-follows';

const CHANGELOG_CARD_MAX_LENGTH = 500;
const LOCAL_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
};

export function classifyLookups(
  follows: FollowedRepository[],
  payloadsById: Readonly<Record<string, ClassifiableLookup | null | undefined>> | null
): LookupClassification {
  if (!payloadsById) {
    return {
      availableIds: [],
      unavailableIds: [],
      transientIds: follows.map((follow) => follow.id),
    };
  }

  const availableIds: string[] = [];
  const unavailableIds: string[] = [];
  const transientIds: string[] = [];

  for (const follow of follows) {
    const lookup = payloadsById[follow.id];
    if (lookup === null || lookup?.status === 'unavailable') {
      unavailableIds.push(follow.id);
      continue;
    }
    if (lookup?.status === 'available') {
      availableIds.push(follow.id);
      continue;
    }
    transientIds.push(follow.id);
  }

  return { availableIds, unavailableIds, transientIds };
}

const toLocalDateKey = (publishedAt: string, timeZone: string): string | null => {
  const date = new Date(publishedAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat('en-CA', { ...LOCAL_DATE_FORMAT, timeZone }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-CA', { ...LOCAL_DATE_FORMAT, timeZone: 'UTC' }).format(date);
  }
};

const truncateChangelog = (description: string | null): { text: string; truncated: boolean } => {
  if (!description) {
    return { text: '', truncated: false };
  }

  if (description.length <= CHANGELOG_CARD_MAX_LENGTH) {
    return { text: description, truncated: false };
  }

  return {
    text: description.slice(0, CHANGELOG_CARD_MAX_LENGTH),
    truncated: true,
  };
};

const comparePublishedDesc = (left: TimelineRelease, right: TimelineRelease) => {
  if (left.publishedAt !== right.publishedAt) {
    return right.publishedAt < left.publishedAt ? -1 : 1;
  }
  if (left.repository.id !== right.repository.id) {
    return left.repository.id < right.repository.id ? -1 : 1;
  }
  return left.id - right.id;
};

const isPublishedRelease = (
  item: RepositoryReleaseItem
): item is RepositoryReleaseItem & { publishedAt: string } => {
  if (item.isDraft || !item.publishedAt) {
    return false;
  }

  return toLocalDateKey(item.publishedAt, 'UTC') !== null;
};

const toTimelineRelease = (
  follow: FollowedRepository,
  lookup: Extract<RepositoryReleaseLookup, { status: 'available' }>,
  item: RepositoryReleaseItem & { publishedAt: string },
  oldestPublishedId: number | null
): TimelineRelease => {
  const changelog = truncateChangelog(item.description);

  return {
    repository: {
      id: follow.id,
      owner: lookup.owner || follow.owner,
      name: lookup.name || follow.name,
    },
    id: item.id,
    tagName: item.tagName,
    title: item.name?.trim() || item.tagName,
    publishedAt: item.publishedAt,
    changelog: changelog.text,
    changelogTruncated: changelog.truncated,
    assetCount: item.assetCount,
    isPrerelease: item.isPrerelease,
    isOldestShown: lookup.hasOlderReleases && oldestPublishedId === item.id,
    htmlUrl: item.htmlUrl,
    reactions: item.reactions ?? [],
  };
};

export function timelineReleaseKey(item: { repository: { id: string }; id: number }): string {
  return `${item.repository.id}:${item.id}`;
}

export function resolveTimelineReleaseReactions(
  item: { repository: { id: string }; id: number; reactions: ReactionSummaryItem[] },
  overlays: ReadonlyMap<string, ReactionSummaryItem[]>
): ReactionSummaryItem[] {
  return overlays.get(timelineReleaseKey(item)) ?? item.reactions;
}

export function assembleReleaseTimeline(
  follows: FollowedRepository[],
  payloadsById: Readonly<Record<string, RepositoryReleaseLookup | null | undefined>>,
  options: { timeZone: string }
): ReleaseTimeline {
  const { unavailableIds, transientIds } = classifyLookups(follows, payloadsById);
  const items: TimelineRelease[] = [];

  for (const follow of follows) {
    const lookup = payloadsById[follow.id];
    if (!lookup || lookup.status !== 'available') {
      continue;
    }

    const published = lookup.releases.filter(isPublishedRelease);
    const oldestPublished = published.reduce<(typeof published)[number] | null>((oldest, item) => {
      if (!oldest || item.publishedAt < oldest.publishedAt) {
        return item;
      }
      return oldest;
    }, null);
    const oldestPublishedId = oldestPublished?.id ?? null;

    for (const item of published) {
      items.push(toTimelineRelease(follow, lookup, item, oldestPublishedId));
    }
  }

  items.sort(comparePublishedDesc);

  const groups: ReleaseTimelineGroup[] = [];

  for (const item of items) {
    const date = toLocalDateKey(item.publishedAt, options.timeZone);
    if (!date) {
      continue;
    }

    const lastGroup = groups.at(-1);
    if (!lastGroup || lastGroup.date !== date) {
      groups.push({ date, items: [item] });
      continue;
    }

    lastGroup.items.push(item);
  }

  return {
    groups,
    unavailableIds,
    transientIds,
  };
}
