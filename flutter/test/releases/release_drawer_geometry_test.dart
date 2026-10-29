import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/releases/release_drawer_geometry.dart';

void main() {
  group('releaseDrawerDismissExtent', () {
    test('a tall window closes once the top edge has fallen 96dp', () {
      // The drawer opens at 70% of the window; 96dp of a 1000dp window is .096,
      // so the closing line sits at .604 — a little under a tenth of the screen
      // below where the drawer opened, not the .5 (or .4) it used to take.
      expect(releaseDrawerDismissExtent(1000), closeTo(.604, 1e-9));
    });

    test(
      'the pull is a distance, so a short window closes sooner in shares',
      () {
        // 96 of 800 is .12: the same finger travel, a twelfth of that window.
        expect(releaseDrawerDismissExtent(800), closeTo(.58, 1e-9));
      },
    );

    test('the drawer never shrinks past 40% of the window to close', () {
      // A window shorter than the pull can take the line below the floor the
      // sheet has always kept, so the floor holds.
      expect(releaseDrawerDismissExtent(100), closeTo(.4, 1e-9));
    });
  });

  group('resolveReleaseDrawerRelease', () {
    test('a slow drag released at the opening height stays open', () {
      expect(
        resolveReleaseDrawerRelease(extent: .7, velocity: 0),
        ReleaseDrawerRelease.opening,
      );
    });

    test('a slow drag released past the full-snap line finishes opening', () {
      expect(
        resolveReleaseDrawerRelease(extent: .88, velocity: 0),
        ReleaseDrawerRelease.full,
      );
    });

    test('a slow drag released short of it returns to the opening height', () {
      expect(
        resolveReleaseDrawerRelease(extent: .74, velocity: 0),
        ReleaseDrawerRelease.opening,
      );
    });

    test('a quick downward flick at the opening height closes the drawer', () {
      // 40dp of travel is a tenth of what closing used to need; the speed is
      // what closes it.
      expect(
        resolveReleaseDrawerRelease(extent: .66, velocity: 1200),
        ReleaseDrawerRelease.dismiss,
      );
    });

    test('a flick above the opening height does not close the drawer', () {
      expect(
        resolveReleaseDrawerRelease(extent: .9, velocity: 1200),
        ReleaseDrawerRelease.full,
      );
    });

    test('a slow drag does not close the drawer, however fast it looks', () {
      expect(
        resolveReleaseDrawerRelease(extent: .66, velocity: 300),
        ReleaseDrawerRelease.opening,
      );
    });

    test('an upward flick never closes the drawer', () {
      expect(
        resolveReleaseDrawerRelease(extent: .7, velocity: -1200),
        ReleaseDrawerRelease.opening,
      );
    });
  });
}
