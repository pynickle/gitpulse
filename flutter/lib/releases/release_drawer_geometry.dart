/// The Release Drawer's sheet geometry: where it opens, where a release settles
/// it, and how little of a pull closes it.
///
/// The sheet's own size is a share of the window, so the two things a reader
/// feels — how far the drawer has to come down before it closes, and how fast a
/// flick closes it without that distance — are stated here as a distance and a
/// speed. A pull is the same number of pixels on every device instead of a
/// share of the screen that shrinks and grows with the phone. ADR 0018 records
/// the resulting rules.
library;

import 'dart:math' as math;

/// The share of the window the drawer opens at.
const releaseDrawerOpeningExtent = .7;

/// The share above which a released drag finishes opening the drawer.
const releaseDrawerFullSnapExtent = .85;

/// How far the drawer's top edge falls below its opening line before a pull
/// closes it.
const releaseDrawerDismissTravel = 96.0;

/// The downward speed a released drag needs to close the drawer without that
/// pull: a flick of the header at or below the opening height.
const releaseDrawerDismissVelocity = 700.0;

/// The lowest share the drawer keeps, so a window too short for the pull still
/// leaves a sheet on screen instead of a sliver.
const _minimumExtent = .4;

/// The share of [windowHeight] at which a pull closes the drawer: the opening
/// line lowered by [releaseDrawerDismissTravel].
double releaseDrawerDismissExtent(double windowHeight) => math.max(
  releaseDrawerOpeningExtent - releaseDrawerDismissTravel / windowHeight,
  _minimumExtent,
);

/// Where a released header drag leaves the drawer.
enum ReleaseDrawerRelease { dismiss, full, opening }

/// What a released header drag does, given the sheet's [extent] and the
/// downward [velocity] the finger let go with.
///
/// A flick closes the drawer only once the drag has carried it back to the
/// opening height, so throwing a full-screen read downward settles it at that
/// height rather than closing the notes the reader had enlarged.
ReleaseDrawerRelease resolveReleaseDrawerRelease({
  required double extent,
  required double velocity,
}) {
  if (velocity >= releaseDrawerDismissVelocity &&
      extent <= releaseDrawerOpeningExtent) {
    return ReleaseDrawerRelease.dismiss;
  }
  return extent > releaseDrawerFullSnapExtent
      ? ReleaseDrawerRelease.full
      : ReleaseDrawerRelease.opening;
}
