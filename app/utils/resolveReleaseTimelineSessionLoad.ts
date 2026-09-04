import type { ReleaseTimeline } from '#shared/types/release-follows';

export type ReleaseTimelineSessionEntry = {
  followKey: string;
  timeline: ReleaseTimeline;
};

export type ReleaseTimelineSessionLoad = {
  timeline: ReleaseTimeline;
  shouldFetch: boolean;
};

const emptyTimeline = (): ReleaseTimeline => ({
  groups: [],
  unavailableIds: [],
  transientIds: [],
});

export default function resolveReleaseTimelineSessionLoad(input: {
  hasFollows: boolean;
  followKey: string;
  cache: ReleaseTimelineSessionEntry | null;
}): ReleaseTimelineSessionLoad {
  if (!input.hasFollows) {
    return {
      timeline: emptyTimeline(),
      shouldFetch: false,
    };
  }

  const cachedTimeline = input.cache?.timeline ?? emptyTimeline();
  const cacheMatchesFollows = input.cache?.followKey === input.followKey;

  return {
    timeline: cachedTimeline,
    shouldFetch: !cacheMatchesFollows,
  };
}
