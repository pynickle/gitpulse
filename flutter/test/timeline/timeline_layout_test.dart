import 'dart:math' as math;

import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/timeline/timeline_layout.dart';

void main() {
  test(
    'the wide Release Drawer panel is one Timeline column plus trail padding',
    () {
      // Worked by hand from the Release Timeline's own metrics: 16dp padding on
      // each side, a 12dp gap between columns, one to three columns.
      //   three columns at 1536: (1536 - 32 - 24) / 3 + 16 = 509.33
      //   three columns at 1400: (1400 - 32 - 24) / 3 + 16 = 464
      //   two columns at 1000:   (1000 - 32 - 12) / 2 + 16 = 494
      //   two columns at 701:    (701 - 32 - 12) / 2 + 16 = 344.5
      //   one column at 360:     360 - 16 = 344
      expect(releaseDrawerPanelWidth(1536), closeTo(509.33, .01));
      expect(releaseDrawerPanelWidth(1400), closeTo(464, .01));
      expect(releaseDrawerPanelWidth(1000), closeTo(494, .01));
      expect(releaseDrawerPanelWidth(701), closeTo(344.5, .01));
      expect(releaseDrawerPanelWidth(360), closeTo(344, .01));
    },
  );

  test('the panel leaves the columns beside it readable', () {
    // Two columns beside a three-column panel, and one beside a two-column
    // panel, must each keep more than a readable width.
    for (final width in [860.0, 1100.0, 1400.0, 1536.0, 2560.0]) {
      final panel = releaseDrawerPanelWidth(width);
      expect(panel, lessThan(width), reason: 'at $width');
      expect(
        width - panel,
        greaterThan(releaseDrawerMinimumPanelWidth),
        reason: 'at $width the columns beside the panel keep their width',
      );
    }
  });

  test(
    'the panel never exceeds the viewport nor drops below a readable width',
    () {
      for (final width in [
        200.0,
        280.0,
        320.0,
        360.0,
        700.0,
        860.0,
        1100.0,
        1101.0,
        1536.0,
      ]) {
        final panel = releaseDrawerPanelWidth(width);
        expect(panel, lessThanOrEqualTo(width), reason: 'at $width');
        expect(
          panel,
          greaterThanOrEqualTo(math.min(width, releaseDrawerMinimumPanelWidth)),
          reason: 'at $width',
        );
      }
    },
  );
}
