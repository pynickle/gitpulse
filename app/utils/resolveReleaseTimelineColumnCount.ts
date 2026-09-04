export const RELEASE_TIMELINE_PHONE_MAX_WIDTH = 700;
export const RELEASE_TIMELINE_TABLET_MAX_WIDTH = 1100;
export const RELEASE_TIMELINE_PHONE_MEDIA = `(max-width: ${RELEASE_TIMELINE_PHONE_MAX_WIDTH}px)`;
export const RELEASE_TIMELINE_TABLET_MEDIA = `(max-width: ${RELEASE_TIMELINE_TABLET_MAX_WIDTH}px)`;

export type ReleaseTimelineColumnCount = 1 | 2 | 3;

export default function resolveReleaseTimelineColumnCount(
  viewportWidth: number
): ReleaseTimelineColumnCount {
  if (viewportWidth <= RELEASE_TIMELINE_PHONE_MAX_WIDTH) {
    return 1;
  }
  if (viewportWidth <= RELEASE_TIMELINE_TABLET_MAX_WIDTH) {
    return 2;
  }
  return 3;
}

export function resolveReleaseTimelineColumnCountFromMedia(media: {
  matches: (query: string) => boolean;
}): ReleaseTimelineColumnCount {
  if (media.matches(RELEASE_TIMELINE_PHONE_MEDIA)) {
    return 1;
  }
  if (media.matches(RELEASE_TIMELINE_TABLET_MEDIA)) {
    return 2;
  }
  return 3;
}
