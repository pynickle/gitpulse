import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/presentation/gitpulse_palette.g.dart';
import 'package:gitpulse/presentation/gitpulse_preset.dart';
import 'package:gitpulse/presentation/gitpulse_theme.dart';
import 'package:gitpulse/presentation/gitpulse_tokens.dart';

import '../support/shared_palette.dart';

/// ADR 0031: the client presents one Theme Preset. Its palette and its type table live once,
/// as data, and the theme hands them to Material so a retained control (a text field's
/// decoration, a snackbar, the date picker, a divider) still receives coherent values.
///
/// These tests read what the theme actually hands the framework and what the app's own
/// readers return, in both presentations. The shared data is read from its file here rather
/// than from the generated constants, so a tone has an independent source to be compared to.

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

  /// The tone readers the client has, by the shared data's name for the tone each one reads.
  ///
  /// A reader is the app's way of saying what a tone is *for*; this map is what proves each one
  /// hands back the value the shared data declares, in both presentations.
  Map<String, Color> get readers => <String, Color>{
    'page-bg': tonePage(context),
    'shell-bg': toneShell(context),
    'surface': toneSurface(context),
    'surface-muted': toneSurfaceMuted(context),
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
    'danger': toneDanger(context),
    'danger-soft': toneDangerSoft(context),
  };

  /// Every tone the preset carries, by the name the shared data gives it — including the four
  /// the client paints no surface of its own for, which are still data both clients may present.
  Map<String, Color> get tones => gitPulseTonesOf(context).toToneMap();

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

/// The helper each row of the table reaches the app through, by the Material role an equivalent
/// `TextTheme` entry carries. The theme table and the app's own helpers have to agree about
/// every one of them.
final helperRoles = <String, TextStyle? Function(BuildContext context)>{
  'headlineSmall': gitPulseTypePageTitle,
  'titleSmall': gitPulseTypeRowLabel,
  'titleMedium': gitPulseTypeSurfaceTitle,
  'labelMedium': (context) => gitPulseTypeFactValue(context),
  'labelSmall': gitPulseTypeMetaTight,
  'bodySmall': gitPulseTypeMeta,
  'headlineMedium': gitPulseTypePageHeadline,
  'bodyMedium': gitPulseTypeDescription,
};

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
      '${brightness.name}: every type helper agrees with the theme’s own TextTheme',
      (tester) async {
        final probe = await pumpTheme(tester, brightness);
        final table = gitPulsePreset.type;

        // One table, two readers of it: the `TextTheme` a retained Material control receives and
        // the helpers the app's own screens are set in. A role cannot be one size in one and
        // another in the other, because both are rows of the same table.
        for (final MapEntry(key: role, value: helper) in helperRoles.entries) {
          final fromHelper = helper(probe.context)!;
          final fromTheme = probe.roles[role]!;
          final row = table.chromeRoles[role]!;

          expect(fromHelper.fontSize, row.size, reason: role);
          expect(fromHelper.height, row.height, reason: role);
          expect(fromHelper.letterSpacing, row.letterSpacing, reason: role);
          expect(fromHelper.fontSize, fromTheme.fontSize, reason: role);
          expect(fromHelper.height, fromTheme.height, reason: role);
          expect(
            fromHelper.letterSpacing,
            fromTheme.letterSpacing,
            reason: role,
          );
        }
      },
    );

    testWidgets(
      '${brightness.name}: the type helpers keep the table’s role in a re-themed subtree',
      (tester) async {
        // The helpers read the type table the theme carries rather than the `TextTheme` a subtree
        // happens to install: a preview, a probe or a retained Material face that re-themes its
        // descendants must not be able to redefine the app's rhythm for the widgets inside it.
        late TextStyle? fromHelper;
        late TextStyle? fromAmbient;
        final reThemed = gitPulseTheme(brightness);
        await tester.pumpWidget(
          MaterialApp(
            theme: reThemed,
            home: Theme(
              data: reThemed.copyWith(
                textTheme: reThemed.textTheme.copyWith(
                  headlineSmall: const TextStyle(fontSize: 99),
                ),
              ),
              child: Builder(
                builder: (context) {
                  fromHelper = gitPulseTypePageTitle(context);
                  fromAmbient = Theme.of(context).textTheme.headlineSmall;
                  return const SizedBox.shrink();
                },
              ),
            ),
          ),
        );

        expect(
          fromAmbient!.fontSize,
          99,
          reason: 'the subtree’s theme did apply',
        );
        expect(
          fromHelper!.fontSize,
          gitPulsePreset.type.headlineSmall.size,
          reason: 'a helper must keep the preset’s role',
        );
        expect(fromHelper!.height, gitPulsePreset.type.headlineSmall.height);
      },
    );

    testWidgets(
      '${brightness.name}: the semantic tones resolve to the shared data',
      (tester) async {
        final probe = await pumpTheme(tester, brightness);
        final shared = sharedPalette()[brightness.name]!;

        // The palette the theme presents carries every tone the data declares, in the data's
        // order — a tone the client paints nothing with is still part of the shared vocabulary.
        expect(probe.tones.keys, unorderedEquals(shared.keys));
        for (final MapEntry(key: tone, value: value) in shared.entries) {
          expect(
            probe.tones[tone]!.toARGB32(),
            argbOf(value),
            reason: '$tone ($value)',
          );
        }

        // Every reader the client has hands back that same value…
        expect(
          shared.keys.toSet().containsAll(probe.readers.keys),
          isTrue,
          reason: 'a reader for a tone the shared data does not declare',
        );
        for (final MapEntry(key: tone, value: toneColor)
            in probe.readers.entries) {
          expect(
            toneColor.toARGB32(),
            argbOf(shared[tone]!),
            reason: 'tone$tone does not read the shared $tone',
          );
        }

        // …and the tones with no reader are exactly the four the client paints no surface of that
        // job for: the raised step, the web's static row-background hover tone, and the two solid
        // status fills. They stay rows of the shared data rather than being deleted, because they
        // are values both clients may present (ADR 0032).
        expect(
          shared.keys.toSet().difference(probe.readers.keys.toSet()),
          <String>{
            'surface-raised',
            'surface-hover',
            'success-solid',
            'danger-solid',
          },
          reason:
              'a tone without a reader, or a reader for a tone nobody paints',
        );

        // The page a screen stands on is the shared canvas tone, and the soft danger wash is the
        // shared wash rather than a strength this client mixes for itself (ADR 0032).
        expect(probe.theme.scaffoldBackgroundColor, probe.tones['page-bg']);
        expect(probe.scheme.errorContainer, probe.tones['danger-soft']);
        expect(probe.tones['danger-soft']!.a, lessThan(1));
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
