import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/releases/release_drawer_geometry.dart';

/// A 1000dp window: the pull is 96dp, so the three lines sit 0.096 either side of
/// the drawer's heights — 60.4% (closes), 79.6% (opens fully) and 90.4% (returns
/// from full screen).
ReleaseDrawerRelease settle({
  required double extent,
  double velocity = 0,
  bool startedFull = false,
  double windowHeight = 1000,
  bool includeDismissLine = true,
}) => resolveReleaseDrawerRelease(
  extent: extent,
  velocity: velocity,
  startedFull: startedFull,
  dismissExtent: includeDismissLine
      ? releaseDrawerDismissExtent(windowHeight)
      : 0,
  expandExtent: releaseDrawerExpandExtent(windowHeight),
  collapseExtent: releaseDrawerCollapseExtent(windowHeight),
);

void main() {
  group('the lines a pull reaches', () {
    test('a tall window closes 96dp below the opening line', () {
      expect(releaseDrawerDismissExtent(1000), closeTo(.604, 1e-9));
    });

    test(
      'the pull is a distance, so a short window closes sooner in shares',
      () {
        expect(releaseDrawerDismissExtent(800), closeTo(.58, 1e-9));
      },
    );

    test('the drawer never shrinks past 40% of the window to close', () {
      expect(releaseDrawerDismissExtent(100), closeTo(.4, 1e-9));
    });

    test('a tall window opens fully 96dp above the opening line', () {
      expect(releaseDrawerExpandExtent(1000), closeTo(.796, 1e-9));
    });

    test('the full-screen height is the ceiling of that line', () {
      expect(releaseDrawerExpandExtent(50), 1);
    });

    test('a tall window returns from full screen 96dp below it', () {
      expect(releaseDrawerCollapseExtent(1000), closeTo(.904, 1e-9));
    });

    test('the opening line is the floor of that one', () {
      expect(releaseDrawerCollapseExtent(50), .7);
    });
  });

  group('resolveReleaseDrawerRelease', () {
    test('a slow drag released at the opening height stays there', () {
      expect(settle(extent: .7), ReleaseDrawerRelease.opening);
    });

    test('a short pull up finishes opening the drawer', () {
      // 100dp of sheet: past the 96dp line, and a third of what the same gesture
      // used to need.
      expect(settle(extent: .8), ReleaseDrawerRelease.full);
    });

    test('a pull up that stops short returns to the drawer', () {
      expect(settle(extent: .74), ReleaseDrawerRelease.opening);
    });

    test('a short pull back down from full screen returns to the drawer', () {
      expect(
        settle(extent: .9, startedFull: true),
        ReleaseDrawerRelease.opening,
      );
    });

    test('a pull back down that barely leaves full screen keeps it open', () {
      expect(settle(extent: .95, startedFull: true), ReleaseDrawerRelease.full);
    });

    test('the same height settles differently by the way the pull went', () {
      // The sheet at 88% can be a pull up from the drawer or a pull back down
      // from full screen, and it finishes the way it was going.
      expect(settle(extent: .88), ReleaseDrawerRelease.full);
      expect(
        settle(extent: .88, startedFull: true),
        ReleaseDrawerRelease.opening,
      );
    });

    test('a slow drag below the opening height does not close the drawer', () {
      expect(settle(extent: .66), ReleaseDrawerRelease.opening);
    });

    test('a quick downward flick below the opening closes the drawer', () {
      expect(settle(extent: .66, velocity: 1250), ReleaseDrawerRelease.dismiss);
    });

    test(
      'a quick downward flick from full screen only returns to the drawer',
      () {
        expect(
          settle(extent: .9, velocity: 1250, startedFull: true),
          ReleaseDrawerRelease.opening,
        );
      },
    );

    test('a quick upward flick opens the drawer fully', () {
      expect(settle(extent: .72, velocity: -1250), ReleaseDrawerRelease.full);
    });

    test('an upward flick from full screen leaves it open', () {
      expect(
        settle(extent: 1, velocity: -1250, startedFull: true),
        ReleaseDrawerRelease.full,
      );
    });

    test('a slow drag released at full screen stays there', () {
      expect(settle(extent: 1, startedFull: true), ReleaseDrawerRelease.full);
    });
  });
}
