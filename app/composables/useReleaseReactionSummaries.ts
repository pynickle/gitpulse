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

  const itemsFor = (item: TimelineRelease) => resolveTimelineReleaseReactions(item, overlays.value);

  const setItems = (item: TimelineRelease, items: ReactionSummaryItem[]) => {
    const next = new Map(overlays.value);
    next.set(
      timelineReleaseKey(item),
      items.map((entry) => ({ ...entry }))
    );
    overlays.value = next;
  };

  return { itemsFor, setItems };
}
