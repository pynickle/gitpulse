import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/presentation/gitpulse_palette.g.dart';
import 'package:gitpulse/presentation/gitpulse_preset.dart';
import 'package:gitpulse/presentation/gitpulse_theme.dart';
import 'package:gitpulse/presentation/gitpulse_tokens.dart';

/// ADR 0031: the client presents one Theme Preset. Its palette and its type table live once,
/// as data, and the theme hands them to Material so a retained control (a text field's
/// decoration, a snackbar, the date picker, a divider) still receives coherent values.
///
/// These tests read what the theme actually hands the framework and what the app's own
/// readers return, in both presentations. The shared data is read from its file here rather
/// than from the generated constants, so a tone has an independent source to be compared to.
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

/// The contrast ratio the WCAG defines, so a paired `on…` role is judged as a reader sees it.
double contrast(Color foreground, Color background) {
  final first = foreground.computeLuminance();
  final second = background.computeLuminance();
  final lighter = first > second ? first : second;
  final darker = first > second ? second : first;
  return (lighter + 0.05) / (darker + 0.05);
}

/// [fill] composited over [background], which is what a translucent tone such as the Accent's
/// soft wash actually looks like on a surface.
Color over(Color fill, Color background) => Color.alphaBlend(fill, background);

/// A mounted theme, and the semantic tones read out of it, so every assertion below runs
/// against what a widget in the tree would actually get.
class ThemeProbe {
  ThemeProbe(this.theme, this.context);

  final ThemeData theme;
  final BuildContext context;

  ColorScheme get scheme => theme.colorScheme;

  /// Every semantic tone the app can read, by the name the shared data gives it.
  Map<String, Color> get tones => <String, Color>{
    'shell-bg': toneShell(context),
    'surface': toneSurface(context),
    'surface-muted': toneSurfaceMuted(context),
    'surface-raised': toneSurfaceRaised(context),
    'surface-hover': toneSurfaceHover(context),
    'surface-active': toneSurfaceActive(context),
    'border': toneBorder(context),
    'border-strong': toneBorderStrong(context),
    'text': toneText(context),
    'text-strong': toneTextStrong(context),
    'text-muted': toneTextMuted(context),
    'text-subtle': toneTextSubtle(context),
    'accent': toneAccent(context),
    'accent-soft': toneAccentSoft(context),
    'success': toneSuccess(context),
    'success-solid': toneSuccessSolid(context),
    'danger': toneDanger(context),
    'danger-solid': toneDangerSolid(context),
  };

  /// The eight roles Material's [TextTheme] carries for this app, by role name.
  Map<String, TextStyle> get roles => <String, TextStyle>{
    'bodySmall': theme.textTheme.bodySmall!,
    'bodyMedium': theme.textTheme.bodyMedium!,
    'titleSmall': theme.textTheme.titleSmall!,
    'titleMedium': theme.textTheme.titleMedium!,
    'labelSmall': theme.textTheme.labelSmall!,
    'labelMedium': theme.textTheme.labelMedium!,
    'headlineSmall': theme.textTheme.headlineSmall!,
    'headlineMedium': theme.textTheme.headlineMedium!,
  };
}

Future<ThemeProbe> pumpTheme(WidgetTester tester, Brightness brightness) async {
  late ThemeProbe probe;
  await tester.pumpWidget(
    MaterialApp(
      theme: gitPulseTheme(brightness),
      home: Scaffold(
        body: Builder(
          builder: (context) {
            probe = ThemeProbe(Theme.of(context), context);
            return const SizedBox.shrink();
          },
        ),
      ),
    ),
  );
  return probe;
}

void main() {
  test(
    'exactly one Theme Preset is registered, and it carries both presentations',
    () {
      expect(gitPulsePresets.keys.toList(), ['gitpulse']);

      final preset = gitPulsePresets['gitpulse']!;
      expect(preset.name, 'gitpulse');
      expect(preset.paletteFor(Brightness.light), GitPulsePalette.light);
      expect(preset.paletteFor(Brightness.dark), GitPulsePalette.dark);
      expect(
        preset.paletteFor(Brightness.light),
        isNot(preset.paletteFor(Brightness.dark)),
      );
      // One type table, shared by both presentations: a reader who changes appearance keeps
      // the rhythm they were reading.
      expect(preset.type, same(gitPulsePreset.type));
    },
  );

  test(
    'the type table authors every role the app sets, and none is Material\'s',
    () {
      final table = gitPulsePreset.type;
      final material = Typography.material2021(
        platform: TargetPlatform.android,
      );

      expect(
        table.chromeRoles.keys,
        unorderedEquals(<String>[
          'bodySmall',
          'bodyMedium',
          'titleSmall',
          'titleMedium',
          'labelSmall',
          'labelMedium',
          'headlineSmall',
          'headlineMedium',
        ]),
      );

      final materialRoles = <String, TextStyle?>{
        'bodySmall': material.black.bodySmall,
        'bodyMedium': material.black.bodyMedium,
        'titleSmall': material.black.titleSmall,
        'titleMedium': material.black.titleMedium,
        'labelSmall': material.black.labelSmall,
        'labelMedium': material.black.labelMedium,
        'headlineSmall': material.black.headlineSmall,
        'headlineMedium': material.black.headlineMedium,
      };

      for (final MapEntry(key: role, value: row) in table.chromeRoles.entries) {
        expect(row.size, greaterThan(0), reason: role);
        expect(row.height, inInclusiveRange(1.2, 1.7), reason: role);
        expect(row.letterSpacing, greaterThanOrEqualTo(0), reason: role);
        expect(
          <Object?>[row.size, row.weight, row.height, row.letterSpacing],
          isNot(<Object?>[
            materialRoles[role]!.fontSize,
            materialRoles[role]!.fontWeight,
            materialRoles[role]!.height,
            materialRoles[role]!.letterSpacing,
          ]),
          reason: '$role is set in Material\'s own metrics, not GitPulse\'s',
        );
      }

      // The reading scale a notes or README document is set in is rows of the same table: 15 on
      // a 24 line, and three heading tiers on one line height.
      expect(table.readingBody.size, 15);
      expect(
        table.readingBody.height * table.readingBody.size,
        closeTo(24, 0.001),
      );
      expect(
        <double>{
          table.readingHeading1.height,
          table.readingHeading2.height,
          table.readingHeading3.height,
        },
        <double>{1.35},
      );
    },
  );

  for (final brightness in Brightness.values) {
    testWidgets(
      '${brightness.name}: the text theme resolves to the type table',
      (tester) async {
        final probe = await pumpTheme(tester, brightness);
        final table = gitPulsePreset.type;

        for (final MapEntry(key: role, value: row)
            in table.chromeRoles.entries) {
          final style = probe.roles[role]!;
          expect(style.fontSize, row.size, reason: role);
          expect(style.fontWeight, row.weight, reason: role);
          expect(style.height, row.height, reason: role);
          expect(style.letterSpacing, row.letterSpacing, reason: role);
        }
      },
    );

    testWidgets(
      '${brightness.name}: the type helpers take their metrics from that table',
      (tester) async {
        late TextStyle? pageTitle;
        late TextStyle? meta;
        late TextStyle? readingBody;
        await tester.pumpWidget(
          MaterialApp(
            theme: gitPulseTheme(brightness),
            home: Scaffold(
              body: Builder(
                builder: (context) {
                  pageTitle = gitPulseTypePageTitle(context);
                  meta = gitPulseTypeMeta(context);
                  readingBody = gitPulseTypeReadingBody(context);
                  return const SizedBox.shrink();
                },
              ),
            ),
          ),
        );

        final table = gitPulsePreset.type;
        expect(pageTitle!.fontSize, table.headlineSmall.size);
        expect(pageTitle!.fontWeight, table.headlineSmall.weight);
        expect(pageTitle!.height, table.headlineSmall.height);
        expect(pageTitle!.letterSpacing, table.headlineSmall.letterSpacing);

        expect(meta!.fontSize, table.bodySmall.size);
        expect(meta!.height, table.bodySmall.height);
        expect(meta!.letterSpacing, table.bodySmall.letterSpacing);

        expect(readingBody!.fontSize, table.readingBody.size);
        expect(readingBody!.height, table.readingBody.height);
        expect(readingBody!.letterSpacing, table.readingBody.letterSpacing);
      },
    );

    testWidgets(
      '${brightness.name}: the semantic tones resolve to the shared data',
      (tester) async {
        final probe = await pumpTheme(tester, brightness);
        final shared = sharedPalette()[brightness.name]!;
        final tones = probe.tones;

        expect(tones.keys, unorderedEquals(shared.keys));
        for (final MapEntry(key: tone, value: value) in shared.entries) {
          expect(
            tones[tone]!.toARGB32(),
            argbOf(value),
            reason: '$tone ($value)',
          );
        }

        // The soft danger wash is the presentation's own derivation from the danger tone, the
        // way the web app derives its danger-soft from the same tone; it carries the tone's
        // colour at the soft alpha rather than inventing one.
        expect(toneDangerSoft(probe.context).r, toneDanger(probe.context).r);
        expect(toneDangerSoft(probe.context).g, toneDanger(probe.context).g);
        expect(toneDangerSoft(probe.context).b, toneDanger(probe.context).b);
        expect(toneDangerSoft(probe.context).a, inExclusiveRange(0.05, 0.3));
      },
    );

    testWidgets(
      '${brightness.name}: Material\'s colour scheme is filled from the preset',
      (tester) async {
        final probe = await pumpTheme(tester, brightness);
        final scheme = probe.scheme;
        final tones = gitPulsePreset.paletteFor(brightness);

        expect(scheme.brightness, brightness);
        expect(scheme.primary, tones.accent);
        expect(scheme.primaryContainer, tones.accentSoft);
        expect(scheme.secondaryContainer, tones.surfaceActive);
        expect(scheme.error, tones.danger);
        expect(scheme.surface, tones.surface);
        expect(scheme.onSurface, tones.text);
        expect(scheme.onSurfaceVariant, tones.textMuted);
        expect(scheme.surfaceContainerLowest, tones.shellBg);
        expect(scheme.surfaceContainerHighest, tones.surfaceActive);
        expect(scheme.outline, tones.borderStrong);
        expect(scheme.outlineVariant, tones.border);
        expect(scheme.inverseSurface, tones.textStrong);

        // The Accent is not the status tone: a green confirmation never reads as the brand,
        // and the scheme's primary is never the tone that means "this succeeded".
        expect(scheme.primary, isNot(tones.success));
        expect(scheme.primary, isNot(tones.successSolid));

        // Retained controls are not left with nonsense pairs: every `on…` colour reads on
        // the colour it sits on, in both presentations.
        expect(contrast(scheme.onPrimary, scheme.primary), greaterThan(4.5));
        expect(
          contrast(
            scheme.onPrimaryContainer,
            over(scheme.primaryContainer, scheme.surface),
          ),
          greaterThan(4.5),
        );
        expect(contrast(scheme.onSurface, scheme.surface), greaterThan(4.5));
        expect(
          contrast(scheme.onSurfaceVariant, scheme.surface),
          greaterThan(4.5),
        );
        expect(contrast(scheme.onError, scheme.error), greaterThan(4.5));
        expect(
          contrast(
            scheme.onErrorContainer,
            over(scheme.errorContainer, scheme.surface),
          ),
          greaterThan(4.5),
        );
        expect(
          contrast(scheme.onSecondary, scheme.secondary),
          greaterThan(4.5),
        );
        expect(
          contrast(scheme.onInverseSurface, scheme.inverseSurface),
          greaterThan(4.5),
        );
      },
    );

    testWidgets(
      '${brightness.name}: a press still paints nothing, hover and focus one tint',
      (tester) async {
        final probe = await pumpTheme(tester, brightness);
        final theme = probe.theme;
        final tones = gitPulsePreset.paletteFor(brightness);

        // The theme-wide ink: nothing on press, one tint on hover and focus.
        expect(theme.highlightColor.a, 0);
        expect(theme.splashColor.a, 0);
        expect(theme.focusColor, theme.hoverColor);
        expect(theme.hoverColor, gitPulseHoverTint(theme.colorScheme));
        expect(
          theme.hoverColor,
          tones.surfaceActive.withValues(alpha: 0.5),
          reason: 'the tint is the preset\'s active step, laid on lightly',
        );

        // And it reaches a real control: the button families resolve their own overlay.
        await tester.pumpWidget(
          MaterialApp(
            theme: gitPulseTheme(brightness),
            home: Scaffold(
              body: Center(
                child: TextButton(onPressed: () {}, child: const Text('Retry')),
              ),
            ),
          ),
        );
        final ink = tester.widget<InkWell>(
          find
              .descendant(
                of: find.byType(TextButton),
                matching: find.byType(InkWell),
              )
              .first,
        );
        expect(
          ink.overlayColor!.resolve({WidgetState.pressed}),
          Colors.transparent,
        );
        expect(
          ink.overlayColor!.resolve({WidgetState.hovered}),
          theme.hoverColor,
        );
        expect(
          ink.overlayColor!.resolve({WidgetState.focused}),
          theme.hoverColor,
        );
      },
    );
  }
}
