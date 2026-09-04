export default function shouldShowReleaseTimelineBackToTop(
  scrollTop: number,
  viewportHeight: number
) {
  return viewportHeight > 0 && scrollTop >= viewportHeight;
}
