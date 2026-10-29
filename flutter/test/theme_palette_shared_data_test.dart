import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/presentation/gitpulse_palette.g.dart';

/// The palette both clients share, read from the data file itself so the comparison is
/// data against data rather than a restatement of what the generated file happens to hold.
Map<String, Map<String, String>> sharedPalette() {
  final decoded = jsonDecode(
    File('../shared/data/theme-palette.json').readAsStringSync(),
  ) as Map<String, dynamic>;
  return decoded.map(
    (presentation, tones) => MapEntry(
      presentation,
      (tones as Map<String, dynamic>).map(
        (tone, value) => MapEntry(tone, value as String),
      ),
    ),
  );
}

/// The ARGB value a CSS colour notation resolves to.
int argbOf(String css) {
  final hex = RegExp(r'^#([0-9a-fA-F]{6})$').firstMatch(css);
  if (hex != null) {
    return 0xFF000000 | int.parse(hex.group(1)!, radix: 16);
  }
  final channels = RegExp(r'^rgba?\(([^)]*)\)$').firstMatch(css);
  if (channels == null) {
    throw ArgumentError.value(
      css,
      'css',
      'not a colour notation this test understands',
    );
  }
  final parts = channels
      .group(1)!
      .split(',')
      .map((part) => part.trim())
      .toList();
  final alpha = parts.length == 4
      ? (double.parse(parts[3]) * 255).round()
      : 255;
  return (alpha << 24) |
      (int.parse(parts[0]) << 16) |
      (int.parse(parts[1]) << 8) |
      int.parse(parts[2]);
}

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
