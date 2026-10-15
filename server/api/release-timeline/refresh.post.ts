import { loadReleaseTimelineRound } from '#server/utils/release-timeline-utils';
export default defineEventHandler((event) => loadReleaseTimelineRound(event, true));
