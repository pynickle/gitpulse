import type { ReactionSummaryItem } from '#shared/types/reactions';
import type { TimelineRelease } from '#shared/types/release-follows';
import {
  resolveTimelineReleaseReactions,
  timelineReleaseKey,
} from '#shared/utils/release-timeline';

export function useReleaseReactionSummaries() {
  const overlays = useState<Map<string, ReactionSummaryItem[]>>(
    'release-reaction-summaries',
    () => new Map()
  );
  const canReactOverrides = useState<Map<string, boolean>>(
    'release-reaction-eligibility',
    () => new Map()
  );

  const itemsFor = (item: TimelineRelease) => resolveTimelineReleaseReactions(item, overlays.value);

  const setItems = (item: TimelineRelease, items: ReactionSummaryItem[]) => {
    const next = new Map(overlays.value);
    next.set(
      timelineReleaseKey(item),
      items.map((entry) => ({ ...entry }))
    );
    overlays.value = next;
  };

  const canReactFor = (item: TimelineRelease) =>
    canReactOverrides.value.get(timelineReleaseKey(item)) ?? item.canReact;

  const setCanReact = (item: TimelineRelease, canReact: boolean) => {
    const next = new Map(canReactOverrides.value);
    next.set(timelineReleaseKey(item), canReact);
    canReactOverrides.value = next;
  };

  return { itemsFor, setItems, canReactFor, setCanReact };
}
