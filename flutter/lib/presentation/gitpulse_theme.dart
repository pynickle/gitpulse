import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import 'gitpulse_palette.g.dart';
import 'gitpulse_preset.dart';

/// The Foundation Layer values a theme presents: the Theme Preset's palette for this
/// presentation, and the type table every presentation of that preset shares.
///
/// The theme carries its preset rather than app code reaching for the registry, so a second
/// preset later is a value presented to `MaterialApp` and not a global the app reads behind
/// the theme's back (ADR 0031).
@immutable
class GitPulseFoundation extends ThemeExtension<GitPulseFoundation> {
  const GitPulseFoundation({required this.preset, required this.palette});

  final GitPulseThemePreset preset;
  final GitPulsePaletteTones palette;

  @override
  GitPulseFoundation copyWith({
    GitPulseThemePreset? preset,
    GitPulsePaletteTones? palette,
  }) => GitPulseFoundation(
    preset: preset ?? this.preset,
    palette: palette ?? this.palette,
  );

  @override
  GitPulseFoundation lerp(ThemeExtension<GitPulseFoundation>? other, double t) {
    if (other is! GitPulseFoundation) return this;
    final from = palette;
    final to = other.palette;
    Color mix(Color first, Color second) => Color.lerp(first, second, t)!;
    return GitPulseFoundation(
      // A type table is not a colour and does not interpolate: it changes when a different
      // preset's presentation settles, and the table snaps with it.
      preset: t < 0.5 ? preset : other.preset,
      palette: GitPulsePaletteTones(
        shellBg: mix(from.shellBg, to.shellBg),
        surface: mix(from.surface, to.surface),
        surfaceMuted: mix(from.surfaceMuted, to.surfaceMuted),
        surfaceRaised: mix(from.surfaceRaised, to.surfaceRaised),
        surfaceHover: mix(from.surfaceHover, to.surfaceHover),
        surfaceActive: mix(from.surfaceActive, to.surfaceActive),
        border: mix(from.border, to.border),
        borderStrong: mix(from.borderStrong, to.borderStrong),
        text: mix(from.text, to.text),
        textStrong: mix(from.textStrong, to.textStrong),
        textMuted: mix(from.textMuted, to.textMuted),
        textSubtle: mix(from.textSubtle, to.textSubtle),
        accent: mix(from.accent, to.accent),
        accentSoft: mix(from.accentSoft, to.accentSoft),
        success: mix(from.success, to.success),
        successSolid: mix(from.successSolid, to.successSolid),
        danger: mix(from.danger, to.danger),
        dangerSolid: mix(from.dangerSolid, to.dangerSolid),
      ),
    );
  }
}

/// The Foundation Layer [gitPulseTheme] installed, or the product preset's when [context]'s
/// theme carries none.
///
/// The fallback is what lets a widget be mounted outside `gitPulseTheme` — a screen previewed
/// on its own, a probe, a test — and still read a tone instead of throwing. There is one
/// preset, so the tone it falls back to is the tone the app would have shown.
GitPulseFoundation gitPulseFoundationOf(BuildContext context) {
  final theme = Theme.of(context);
  return theme.extension<GitPulseFoundation>() ??
      GitPulseFoundation(
        preset: gitPulsePreset,
        palette: gitPulsePreset.paletteFor(theme.brightness),
      );
}

/// The Theme Preset's palette for [context]'s presentation.
GitPulsePaletteTones gitPulseTonesOf(BuildContext context) =>
    gitPulseFoundationOf(context).palette;

/// The Theme Preset's type table.
GitPulseTypeTable gitPulseTypeTableOf(BuildContext context) =>
    gitPulseFoundationOf(context).preset.type;

/// The only interactive tint the app paints: the preset's active step, laid on lightly for
/// hover and keyboard focus.
///
/// It is a tonal move, not a scrim — light mode moves toward the Accent's own wash instead of
/// darkening toward black, and dark mode brightens instead of greying out. A press paints
/// nothing at all (ADR 0023), so this tone is the whole of the app's ink feedback and no
/// surface sets its own overlay colour. ADR 0031 keeps the rule and re-tones it from the
/// preset: the active step is the strongest step the palette carries in either presentation,
/// which is what keeps a hover or a focus ring visible on a white card.
Color gitPulseHoverTint(ColorScheme scheme) =>
    scheme.surfaceContainerHighest.withValues(alpha: 0.5);

/// The ink any pressable control paints, state by state: nothing at all while it is pressed,
/// and [gitPulseHoverTint] while it is hovered or focused.
///
/// `pressed` resolving to nothing is the app-wide rule (ADR 0023): the click itself is the
/// feedback, and Material's own component default — a 10% wash of the control's foreground
/// colour — is exactly the dark tinge this removes. Hover and keyboard focus keep the tint
/// because they answer a different question: whether a surface is clickable, and where the
/// focus sits.
///
/// [gitPulseTheme] installs this on the `IconButton`, `TextButton`, `OutlinedButton` and
/// `Checkbox` families. It is public only because `ButtonStyle.styleFrom` with an explicit
/// `foregroundColor` builds Material's pressed wash at the call site, where a theme cannot
/// reach it; such a control passes this through `copyWith(overlayColor: …)` instead of
/// setting an overlay of its own.
WidgetStateProperty<Color?> gitPulseInkOverlay(ColorScheme scheme) {
  final tint = gitPulseHoverTint(scheme);
  return WidgetStateProperty.resolveWith(
    (states) => switch (states) {
      _ when states.contains(WidgetState.pressed) => Colors.transparent,
      _ when states.contains(WidgetState.hovered) => tint,
      _ when states.contains(WidgetState.focused) => tint,
      _ => null,
    },
  );
}

/// The proportion a status tone is laid on at when it is used as a wash rather than as ink:
/// the ground of a banner that reports a failure.
///
/// The shared palette data carries the status tones as text and as solid fills; a wash is the
/// presentation's own derivation from one of them, at the proportion the web app's own
/// danger-soft uses, so the two clients' washes are the same strength.
const gitPulseStatusWashAlpha = 0.10;

/// The Material colour scheme the preset's palette fills, role by role.
///
/// Nothing here is generated: `ColorScheme.fromSeed` is gone, because a scheme derived from
/// one status colour decided the whole neutral ramp and made a green the brand (ADR 0031).
/// Every role is a tone GitPulse chose, and the pairings Material still requires are stated
/// too — an `on…` for every container, an inverse pair for a snackbar — so a retained control
/// reads coherent values instead of the nonsense an unfilled role would give it.
///
/// The neutral steps are filled by job rather than as a ladder of five: the shell is what a
/// surface sits on, the muted surface is a block within it, the shell again is what a surface
/// cuts a well into (a field's own fill, an avatar's disc), and the active step is the
/// palette's strongest — the one a selection and the app's hover ink use.
ColorScheme gitPulseColorScheme(
  GitPulseThemePreset preset,
  Brightness brightness,
) {
  final tones = preset.paletteFor(brightness);
  // The tone that reads on the Accent and on the danger fill: the white surface under a light
  // Accent, the shell under a dark one.
  final onFill = brightness == Brightness.light ? tones.surface : tones.shellBg;
  // The soft danger wash the app's own banner paints, derived from the danger tone the way
  // the web app derives its danger-soft from the same tone.
  final dangerSoft = tones.danger.withValues(alpha: gitPulseStatusWashAlpha);

  return ColorScheme(
    brightness: brightness,
    primary: tones.accent,
    onPrimary: onFill,
    primaryContainer: tones.accentSoft,
    onPrimaryContainer: tones.accent,
    secondary: tones.textMuted,
    onSecondary: onFill,
    secondaryContainer: tones.surfaceActive,
    onSecondaryContainer: tones.accent,
    tertiary: tones.success,
    onTertiary: onFill,
    tertiaryContainer: tones.accentSoft,
    onTertiaryContainer: tones.success,
    error: tones.danger,
    onError: onFill,
    errorContainer: dangerSoft,
    onErrorContainer: tones.danger,
    surface: tones.surface,
    onSurface: tones.text,
    onSurfaceVariant: tones.textMuted,
    surfaceDim: tones.shellBg,
    surfaceBright: tones.surface,
    surfaceContainerLowest: tones.shellBg,
    surfaceContainerLow: tones.surfaceMuted,
    surfaceContainer: tones.surfaceMuted,
    surfaceContainerHigh: tones.shellBg,
    surfaceContainerHighest: tones.surfaceActive,
    outline: tones.borderStrong,
    outlineVariant: tones.border,
    shadow: Colors.black,
    scrim: Colors.black,
    inverseSurface: tones.textStrong,
    onInverseSurface: tones.surface,
    inversePrimary: tones.accent,
    surfaceTint: tones.accent,
  );
}

/// The platform's own typography, which the type table re-authors the app's eight roles on.
///
/// The roles the table does not name — `bodyLarge`, a text field's own text, the display
/// sizes, `labelLarge`, a button's label — stay the platform's, because a retained Material
/// control reads them and a null role would give it nothing.
TextTheme _platformTextTheme(Brightness brightness) {
  final typography = Typography.material2021(platform: defaultTargetPlatform);
  return brightness == Brightness.light ? typography.black : typography.white;
}

/// The GitPulse Material 3 theme for [brightness].
///
/// The theme is GitPulse's: its tones come from the `gitpulse` Theme Preset, its type from
/// that preset's table, and the page behind every screen is the shell tone the web app uses.
/// Material keeps the jobs that are genuinely the platform's — text input and its IME, the
/// date picker's calendar, tooltips, pull-to-refresh — and receives coherent values for them
/// from here.
ThemeData gitPulseTheme(Brightness brightness) {
  final preset = gitPulsePreset;
  final tones = preset.paletteFor(brightness);
  final scheme = gitPulseColorScheme(preset, brightness);
  final overlay = gitPulseInkOverlay(scheme);
  final textTheme = preset.type
      .applyTo(_platformTextTheme(brightness))
      .apply(bodyColor: tones.text, displayColor: tones.textStrong);

  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    textTheme: textTheme,
    // The page a screen stands on is the shell's tone, as it is on the web: a card is the
    // surface, and the two are told apart by that step rather than by a border.
    scaffoldBackgroundColor: tones.shellBg,
    // Overlays are surface-toned, which is the tone the app's own sheets already paint, so a
    // retained Material dialog reads as one of the app's overlays rather than as a component
    // with a tone of its own.
    dialogTheme: DialogThemeData(backgroundColor: tones.surface),
    datePickerTheme: DatePickerThemeData(backgroundColor: tones.surface),
    extensions: <ThemeExtension<dynamic>>[
      GitPulseFoundation(preset: preset, palette: tones),
    ],
    // The plain ink response — list rows, chips, the timeline card — reads these four, and
    // `ListTileThemeData` has no overlay field to override with, so the transparent press has
    // to be the theme-wide default.
    highlightColor: Colors.transparent,
    splashColor: Colors.transparent,
    focusColor: gitPulseHoverTint(scheme),
    hoverColor: gitPulseHoverTint(scheme),
    // The button families resolve their own overlay and would otherwise keep Material's
    // darker default; filled and elevated buttons are left alone so a primary action still
    // answers a press.
    iconButtonTheme: IconButtonThemeData(
      style: ButtonStyle(overlayColor: overlay),
    ),
    textButtonTheme: TextButtonThemeData(
      style: ButtonStyle(overlayColor: overlay),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: ButtonStyle(overlayColor: overlay),
    ),
    // A Checkbox paints its own press reaction rather than reading the theme's splash, so it
    // takes the same answer here: nothing while pressed, the app's tint while hovered or
    // focused. Its box and check stay Material's own scheme colours — the primary fill is the
    // theme's.
    checkboxTheme: CheckboxThemeData(overlayColor: overlay),
  );
}
