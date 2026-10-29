// Generates `lib/presentation/gitpulse_palette.g.dart` from the palette data both
// clients share. Run from the flutter package:
//
//     dart run tool/generate_theme_palette.dart
//
// The output is committed, so neither a checkout nor a build needs this step; it runs
// when `shared/data/theme-palette.json` changes, in the same change.

import 'dart:convert';
import 'dart:io';

/// The one palette data source, relative to the flutter package.
const sourcePath = '../shared/data/theme-palette.json';

/// The constants generated from it.
const outputPath = 'lib/presentation/gitpulse_palette.g.dart';

void main() {
  final source = File(sourcePath);
  if (!source.existsSync()) {
    stderr.writeln(
      'Missing $sourcePath. Run this command from the flutter package.',
    );
    exitCode = 1;
    return;
  }

  final palette = readPalette(jsonDecode(source.readAsStringSync()));
  File(outputPath)
    ..createSync(recursive: true)
    ..writeAsStringSync(renderPalette(palette));

  // The generated file is committed, so it has to satisfy the package's formatter.
  final formatted = Process.runSync(Platform.resolvedExecutable, [
    'format',
    outputPath,
  ]);
  stdout.write(formatted.stdout);
  if (formatted.exitCode != 0) {
    stderr.write(formatted.stderr);
    exitCode = formatted.exitCode;
  }
}

/// The palette by presentation, keeping the tone names and the order the data declares.
///
/// Both presentations must declare the same tones: a tone one presentation has and the other
/// lacks is a hole the client would fill with a guess.
Map<String, Map<String, String>> readPalette(Object? decoded) {
  if (decoded is! Map<String, dynamic>) {
    throw FormatException('$sourcePath must hold an object of presentations.');
  }
  final palette = <String, Map<String, String>>{};
  for (final MapEntry(key: presentation, value: tones) in decoded.entries) {
    if (tones is! Map<String, dynamic>) {
      throw FormatException(
        '$sourcePath: "$presentation" must be an object of tones.',
      );
    }
    palette[presentation] = {
      for (final MapEntry(key: tone, value: value) in tones.entries)
        tone: value is String
            ? value
            : throw FormatException(
                '$sourcePath: "$presentation.$tone" must be a string.',
              ),
    };
  }

  final light = palette['light'];
  final dark = palette['dark'];
  if (light == null || dark == null) {
    throw FormatException(
      '$sourcePath must declare both a light and a dark presentation.',
    );
  }
  if (light.keys.join('|') != dark.keys.join('|')) {
    throw FormatException(
      '$sourcePath: the light and dark presentations must declare the same tones in the same '
      'order.',
    );
  }
  return palette;
}

/// The Dart source for [palette].
String renderPalette(Map<String, Map<String, String>> palette) {
  final tones = palette['light']!.keys.toList();
  final buffer = StringBuffer()
    ..writeln('// GENERATED FILE: do not edit by hand.')
    ..writeln('//')
    ..writeln(
      '// The `gitpulse` Theme Preset palette, generated from `$sourcePath` by',
    )
    ..writeln(
      '// `dart run tool/generate_theme_palette.dart`. The web app injects the same data as',
    )
    ..writeln(
      '// CSS custom properties at startup, so the two clients cannot disagree about a tone.',
    )
    ..writeln()
    ..writeln("import 'dart:ui' show Color;")
    ..writeln()
    ..writeln('/// One presentation of the `gitpulse` Theme Preset palette.')
    ..writeln('class GitPulsePaletteTones {')
    ..writeln('  const GitPulsePaletteTones({');
  for (final tone in tones) {
    buffer.writeln('    required this.${camelCase(tone)},');
  }
  buffer
    ..writeln('  });')
    ..writeln();
  for (final tone in tones) {
    buffer.writeln('  final Color ${camelCase(tone)};');
  }
  buffer
    ..writeln()
    ..writeln('  /// Every tone by the name the shared data gives it.')
    ..writeln('  Map<String, Color> toToneMap() => <String, Color>{');
  for (final tone in tones) {
    buffer.writeln("        '$tone': ${camelCase(tone)},");
  }
  buffer
    ..writeln('      };')
    ..writeln('}')
    ..writeln()
    ..writeln('/// The `gitpulse` Theme Preset palette in both presentations.')
    ..writeln('abstract final class GitPulsePalette {');
  for (final MapEntry(key: presentation, value: values) in palette.entries) {
    buffer
      ..writeln('  /// The $presentation presentation.')
      ..writeln('  static const $presentation = GitPulsePaletteTones(');
    for (final MapEntry(key: tone, value: value) in values.entries) {
      buffer.writeln('    ${camelCase(tone)}: ${colorExpression(value)},');
    }
    buffer
      ..writeln('  );')
      ..writeln();
  }
  buffer.writeln('}');
  return buffer.toString();
}

/// `shell-bg` becomes `shellBg`: the Dart spelling of the shared tone name.
String camelCase(String tone) {
  final parts = tone.split('-');
  return parts.first +
      parts
          .skip(1)
          .map(
            (part) =>
                part.isEmpty ? part : part[0].toUpperCase() + part.substring(1),
          )
          .join();
}

/// The Dart expression for a CSS colour: `#rrggbb` or `rgba(r, g, b, a)`.
String colorExpression(String css) {
  final hex = RegExp(r'^#([0-9a-fA-F]{6})$').firstMatch(css);
  if (hex != null) {
    return 'Color(0xFF${hex.group(1)!.toUpperCase()})';
  }
  final channels = RegExp(r'^rgba\(([^)]*)\)$').firstMatch(css);
  if (channels != null) {
    final parts = channels
        .group(1)!
        .split(',')
        .map((part) => part.trim())
        .toList();
    if (parts.length == 4) {
      return 'Color.fromRGBO(${parts[0]}, ${parts[1]}, ${parts[2]}, ${parts[3]})';
    }
  }
  throw FormatException('Not a CSS colour this generator understands: $css');
}
