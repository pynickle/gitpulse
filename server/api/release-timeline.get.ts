import { definePrivateApiCoalescedEventHandler } from '#server/utils/api-cache-utils';
import { loadReleaseTimelineRound } from '#server/utils/release-timeline-utils';
export default definePrivateApiCoalescedEventHandler((event) => loadReleaseTimelineRound(event));
