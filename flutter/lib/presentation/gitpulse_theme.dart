import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import 'gitpulse_palette.g.dart';
import 'gitpulse_preset.dart';
import 'gitpulse_tokens.dart';

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
        pageBg: mix(from.pageBg, to.pageBg),
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
        dangerSoft: mix(from.dangerSoft, to.dangerSoft),
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

/// The proportion the preset's active step is laid on at for hover and keyboard focus.
///
/// The half-strength tint is the whole of the app's hover ink, and the strength is stated
/// here rather than left in the expression, because it is a decision: the active step at full
/// strength is a selected row, and at half strength it is a pointer's position.
///
/// It is deliberately **not** the shared `surface-hover` tone. Those two answer different
/// questions: `surface-hover` is a static background the web app paints under a row the reader
/// is pointing at, while this tint is an overlay the client lays *over* whatever fill a surface
/// already has — a white card, a tinted chip, a bar's own surface. Painting the shared background
/// under an ink layer would either hide the surface's own fill or double the tone on it, so the
/// client states its wash as the active step at this alpha and leaves `surface-hover` to the
/// surfaces that paint a background (ADR 0032).
const gitPulseHoverTintAlpha = 0.5;

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
    scheme.surfaceContainerHighest.withValues(alpha: gitPulseHoverTintAlpha);

/// The ink any pressable control paints, state by state: nothing at all while it is pressed,
/// and [gitPulseHoverTint] while it is hovered or focused.
///
/// `pressed` resolving to nothing is the app-wide rule (ADR 0023): the click itself is the
/// feedback, and Material's own component default — a 10% wash of the control's foreground
/// colour — is exactly the dark tinge this removes. Hover and keyboard focus keep the tint
/// because they answer a different question: whether a surface is clickable, and where the
/// focus sits.
///
/// [gitPulseTheme] installs this on the two Material families a retained control still
/// draws — `IconButton`, which the bar's back affordance and the date picker's own toggle
/// are, and `TextButton`, which the date picker's actions are — so the rule holds in the one
/// place a reader still meets Material's drawing (ADR 0032). The app's own controls read it
/// directly at their own call sites, and a retained Material face a screen mounts itself (the
/// Follows sort control) is handed it the same way. It is public for that reason:
/// `ButtonStyle.styleFrom` with an explicit `foregroundColor` builds Material's pressed wash
/// at the call site, where a theme cannot reach it, so such a control passes this through
/// `copyWith(overlayColor: …)` instead of setting an overlay of its own.
WidgetStateProperty<Color?> gitPulseInkOverlay(ColorScheme scheme) {
  final tint = gitPulseHoverTint(scheme);
  return WidgetStateProperty.resolveWith(
    (states) => switch (states) {
      _ when states.contains(WidgetState.pressed) => GitPulsePaint.none,
      _ when states.contains(WidgetState.hovered) => tint,
      _ when states.contains(WidgetState.focused) => tint,
      _ => null,
    },
  );
}

/// The proportion a filled or tonal surface lays its own foreground on while it is pressed.
///
/// ADR 0023's rule — a press paints nothing at all — is the app's rule, and it holds on every
/// surface that has no fill of its own. A control that already paints the Accent keeps an answer
/// to a press instead, because a coloured surface that did nothing at all under the finger would
/// read as broken rather than as calm (ADR 0032). One tenth is the strength Material's own filled
/// overlay used, so the answer is the one readers already know.
const gitPulseFilledPressAlpha = 0.10;

/// The ink a filled or tonal control paints: its own foreground while pressed, and the app's one
/// tint while hovered or focused.
///
/// The hover and focus half is [gitPulseInkOverlay]'s, unchanged: there is one tint in the app
/// whether or not the surface under it is coloured.
WidgetStateProperty<Color?> gitPulseFilledInkOverlay(
  ColorScheme scheme,
  Color foreground,
) {
  final tint = gitPulseHoverTint(scheme);
  return WidgetStateProperty.resolveWith(
    (states) => switch (states) {
      _ when states.contains(WidgetState.pressed) => foreground.withValues(
        alpha: gitPulseFilledPressAlpha,
      ),
      _ when states.contains(WidgetState.hovered) => tint,
      _ when states.contains(WidgetState.focused) => tint,
      _ => null,
    },
  );
}

/// The tone that reads on a filled role: the surface under a light Accent, the shell under a dark
/// one.
///
/// It is stated once, because every filled role the scheme carries — `onPrimary`, `onError` — and
/// every filled control the app draws has to agree about what sits on a coloured fill.
Color gitPulseOnFill(GitPulsePaletteTones tones, Brightness brightness) =>
    brightness == Brightness.light ? tones.surface : tones.shellBg;

/// The Material colour scheme the preset's palette fills, role by role.
///
/// Nothing here is generated: `ColorScheme.fromSeed` is gone, because a scheme derived from
/// one status colour decided the whole neutral ramp and made a green the brand (ADR 0031).
/// Every role is a tone GitPulse chose, and the pairings Material still requires are stated
/// too — an `on…` for every container, an inverse pair for a snackbar — so a retained control
/// reads coherent values instead of the nonsense an unfilled role would give it.
///
/// The neutral steps are filled by job rather than as a ladder of five: the page is the palette's
/// outermost canvas, the shell is the step a surface cuts a well into, the muted surface is a
/// block within one, and the active step is the palette's strongest — the one a selection and
/// the app's hover ink use.
ColorScheme gitPulseColorScheme(
  GitPulseThemePreset preset,
  Brightness brightness,
) {
  final tones = preset.paletteFor(brightness);
  // The tone that reads on the Accent and on the danger fill: the white surface under a light
  // Accent, the shell under a dark one.
  final onFill = gitPulseOnFill(tones, brightness);

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
    // The wash a failure's banner and a failure's container are drawn on is the palette's own
    // `danger-soft` tone — the value the web app paints — rather than a stronger or weaker
    // mix of the danger ink (ADR 0032).
    errorContainer: tones.dangerSoft,
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
/// that preset's table, and the page behind every screen is the canvas tone the web app paints.
/// Material keeps the jobs that are genuinely the platform's — text input and its IME, the
/// date picker's calendar, pull-to-refresh — and receives coherent values for them from here.
///
/// **Every component theme installed below has a consumer named in ADR 0032.** There are no
/// entries left over from undoing Material: an entry whose family the client no longer draws
/// is an override with nothing to override, and it was deleted with the screen that used to
/// mount that family.
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
    // The page a screen stands on is the palette's own canvas, the tone the web app paints its
    // body with: a card is the surface, and the two are told apart by that step and the card's
    // own hairline. The shell is a different step — the well a field or an avatar disc is cut
    // into — so the two clients agree about which tone the page is (ADR 0031).
    scaffoldBackgroundColor: tones.pageBg,
    // The bar a page is titled with is the app's chrome, not Material's: the surface tone the
    // navigation bar and the cards share, told apart from the page by the one hairline the app
    // separates chrome with — never by Material 3's elevation or its scroll-under tint, which
    // would wash the bar in the Accent as a page scrolled beneath it. Its behaviour stays the
    // platform's: it is the surface a back affordance arrives on, which ADR 0032 records as a
    // Platform Dialect Exception.
    appBarTheme: AppBarTheme(
      backgroundColor: tones.surface,
      foregroundColor: tones.text,
      elevation: 0,
      scrolledUnderElevation: 0,
      surfaceTintColor: GitPulsePaint.none,
      shape: Border(
        bottom: BorderSide(color: tones.border, width: GitPulseStroke.hairline),
      ),
      // A surface's title, at the role the app's own surfaces take it: the bar is a surface
      // standing over the page, so its title is not a second page headline.
      titleTextStyle: preset.type.titleMedium.toTextStyle(
        color: tones.textStrong,
      ),
    ),
    // The date picker is one of the surfaces that stays the platform's own (ADR 0032), and
    // it reads this: the app gives it the tone the app's own sheets are drawn on rather than
    // a Material overlay with a tone of its own.
    datePickerTheme: DatePickerThemeData(backgroundColor: tones.surface),
    // No hint is raised anywhere in the client, and the tooltips still mounted are Material's own
    // inside the retained date picker. `manual` is the only trigger mode that draws nothing on a
    // press or a hover, so the rule holds wherever the reader puts a finger — while the words still
    // reach a screen reader from the node the tooltip wraps (ADR 0032).
    tooltipTheme: const TooltipThemeData(
      triggerMode: TooltipTriggerMode.manual,
    ),
    extensions: <ThemeExtension<dynamic>>[
      GitPulseFoundation(preset: preset, palette: tones),
    ],
    // The plain ink response — the app's own row, asset and chip surfaces, and every plain
    // `InkWell` beneath them — reads these four. A plain `InkWell` has no overlay of its own
    // to state the rule in, so the transparent press has to be the theme-wide default.
    highlightColor: GitPulsePaint.none,
    splashColor: GitPulsePaint.none,
    focusColor: gitPulseHoverTint(scheme),
    hoverColor: gitPulseHoverTint(scheme),
    // Two button families are still drawn by a control that stays the platform's own, so they
    // keep the app's ink: `IconButton`, which the bar's back affordance is (`BackButton extends
    // IconButton`) and which the date picker's calendar/input toggle is; and `TextButton`,
    // which is the date picker's own actions. Material's default would otherwise paint its
    // pressed wash on both. Nothing else is left to install: the client mounts no
    // `OutlinedButton`, no Material dialog, and no Material checkbox or switch, so
    // `outlinedButtonTheme`, `dialogTheme`, `checkboxTheme` and `switchTheme` are absent by
    // decision rather than by omission (ADR 0032).
    iconButtonTheme: IconButtonThemeData(
      style: ButtonStyle(overlayColor: overlay),
    ),
    textButtonTheme: TextButtonThemeData(
      style: ButtonStyle(overlayColor: overlay),
    ),
  );
}
