/// The Release Drawer's sheet geometry: where it opens, where a release settles
/// it, and how little of a pull settles it somewhere else.
///
/// The sheet's own size is a share of the window, so the three things a reader
/// feels — how far the drawer comes down before it closes, how far it goes up
/// before it opens fully, and how far it comes back down before it returns from
/// full screen — are stated here as one distance and one speed. A pull is the
/// same number of pixels on every device instead of a share of the screen that
/// shrinks and grows with the phone. ADR 0018 records the resulting rules.
library;

import 'dart:math' as math;

/// The share of the window the drawer opens at.
const releaseDrawerOpeningExtent = .7;

/// The share of the window the drawer fills when it is opened fully.
const releaseDrawerFullExtent = 1.0;

/// The share above which a released drag that stopped short still finishes
/// opening the drawer.
const releaseDrawerFullSnapExtent = .85;

/// How far the sheet's top edge travels before a pull settles it somewhere else:
/// down to close the drawer, up to open it fully, or back down from full screen.
const releaseDrawerPullTravel = 96.0;

/// The speed of a flick that settles the sheet without that travel — in the
/// direction it was thrown.
const releaseDrawerFlickVelocity = 700.0;

/// The lowest share the drawer keeps, so a window too short for the pull still
/// leaves a sheet on screen instead of a sliver.
const _minimumExtent = .4;

/// The share of [windowHeight] a pull down reaches to close the drawer.
double releaseDrawerDismissExtent(double windowHeight) => math.max(
  releaseDrawerOpeningExtent - releaseDrawerPullTravel / windowHeight,
  _minimumExtent,
);

/// The share of [windowHeight] a pull up reaches to open the drawer fully.
double releaseDrawerExpandExtent(double windowHeight) => math.min(
  releaseDrawerOpeningExtent + releaseDrawerPullTravel / windowHeight,
  releaseDrawerFullExtent,
);

/// The share of [windowHeight] a pull back down from full screen reaches to
/// return the drawer to the height it opens at.
double releaseDrawerCollapseExtent(double windowHeight) => math.max(
  releaseDrawerFullExtent - releaseDrawerPullTravel / windowHeight,
  releaseDrawerOpeningExtent,
);

/// Where a released drag leaves the drawer.
enum ReleaseDrawerRelease { dismiss, opening, full }

/// What a released drag does, given the sheet's [extent], the downward
/// [velocity] the finger let go with, and the three lines a pull reaches.
///
/// A flick settles the sheet the way it was thrown. A slow pull settles it where
/// it reached, on the side the pull was going: [startedFull] says whether the
/// drag began with the drawer opened fully, because the same height means
/// opposite things coming up from the drawer and coming back down from full
/// screen. Nothing settles in a direction it was not going — a downward flick
/// from full screen returns the drawer to the height it opens at rather than
/// closing the notes a reader had enlarged.
ReleaseDrawerRelease resolveReleaseDrawerRelease({
  required double extent,
  required double velocity,
  required bool startedFull,
  required double dismissExtent,
  required double expandExtent,
  required double collapseExtent,
}) {
  if (velocity >= releaseDrawerFlickVelocity) {
    return extent <= releaseDrawerOpeningExtent
        ? ReleaseDrawerRelease.dismiss
        : ReleaseDrawerRelease.opening;
  }
  if (velocity <= -releaseDrawerFlickVelocity) {
    return ReleaseDrawerRelease.full;
  }
  if (extent <= dismissExtent) return ReleaseDrawerRelease.dismiss;
  if (startedFull) {
    return extent <= collapseExtent
        ? ReleaseDrawerRelease.opening
        : ReleaseDrawerRelease.full;
  }
  return extent >= expandExtent
      ? ReleaseDrawerRelease.full
      : ReleaseDrawerRelease.opening;
}
