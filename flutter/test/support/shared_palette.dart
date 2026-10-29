import 'dart:convert';
import 'dart:io';

/// The palette both clients share, read from the data file itself.
///
/// The Flutter tests compare what the client presents against this file rather than against the
/// generated constants, so a tone has an independent source to be measured against: data on one
/// side, what the app renders on the other.
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
///
/// The shared data is written in the notation the web app renders, so the reading scale a test
/// compares against is the one the stylesheet gets.
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
