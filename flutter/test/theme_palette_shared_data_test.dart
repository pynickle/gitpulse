import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/presentation/gitpulse_palette.g.dart';

import 'support/shared_palette.dart';

/// The generated Dart palette against the data both clients share: the comparison is data against
/// data, so a tone cannot be restated in one client and drift from the other.
void main() {
  final generated = {
    'light': GitPulsePalette.light,
    'dark': GitPulsePalette.dark,
  };

  test(
    'the generated Dart palette carries the shared data in both presentations',
    () {
      final shared = sharedPalette();

      expect(
        generated.keys.toSet(),
        shared.keys.toSet(),
        reason: 'presentations',
      );

      for (final MapEntry(key: presentation, value: tones)
          in generated.entries) {
        final data = shared[presentation]!;
        final generatedTones = tones.toToneMap();

        expect(
          generatedTones.keys.toList(),
          data.keys.toList(),
          reason:
              '$presentation tone names, in the order the data declares them',
        );

        for (final MapEntry(key: tone, value: value) in data.entries) {
          expect(
            generatedTones[tone]!.toARGB32(),
            argbOf(value),
            reason: '$presentation $tone ($value)',
          );
        }
      }
    },
  );
}
