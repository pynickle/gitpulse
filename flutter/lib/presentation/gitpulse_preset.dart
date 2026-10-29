import 'package:flutter/material.dart';

import 'gitpulse_palette.g.dart';

/// One row of a Theme Preset's type table: the four numbers a text style is made of.
///
/// A row carries no font family: the client renders in the platform's family (Roboto on
/// Android) and the table is authored against it, so a bundled font is a separate decision
/// (ADR 0031). [height] is a multiple of [size], the unit `TextStyle.height` counts in.
@immutable
class GitPulseTypeRow {
  const GitPulseTypeRow({
    required this.size,
    required this.weight,
    required this.height,
    required this.letterSpacing,
  });

  final double size;
  final FontWeight weight;
  final double height;
  final double letterSpacing;

  /// This row as the metrics of a text style, keeping whatever family a base style brings.
  TextStyle toTextStyle({Color? color}) => TextStyle(
    fontSize: size,
    fontWeight: weight,
    height: height,
    letterSpacing: letterSpacing,
    color: color,
  );

  /// [base] with this row's metrics on top, so the family and anything else the platform's
  /// typography set stays where it was.
  TextStyle mergeOnto(TextStyle? base) =>
      base == null ? toTextStyle() : base.merge(toTextStyle());
}

/// The type table a Theme Preset carries.
///
/// It authors the eight roles the client's chrome is set in — the roles Material's
/// [TextTheme] names, because retained Material controls read those roles and have to keep
/// receiving a value — and the reading scale a notes or README document is set in, which is
/// rows of this same table rather than a special case beside it.
///
/// One table serves both presentations: changing appearance changes tone, never rhythm.
@immutable
class GitPulseTypeTable {
  const GitPulseTypeTable({
    required this.bodySmall,
    required this.bodyMedium,
    required this.titleSmall,
    required this.titleMedium,
    required this.labelSmall,
    required this.labelMedium,
    required this.headlineSmall,
    required this.headlineMedium,
    required this.readingBody,
    required this.readingHeading1,
    required this.readingHeading2,
    required this.readingHeading3,
  });

  /// A card's summary, a setting's note, a meta line.
  final GitPulseTypeRow bodySmall;

  /// Prose inside chrome: a repository's description, a field's own text.
  final GitPulseTypeRow bodyMedium;

  /// The name a row is about, and a date group's header.
  final GitPulseTypeRow titleSmall;

  /// The title of a surface within a page: a Timeline card, an empty or error state.
  final GitPulseTypeRow titleMedium;

  /// The label of a block within a surface, and the tightest meta there is.
  final GitPulseTypeRow labelSmall;

  /// The repository's full name in a Timeline card.
  final GitPulseTypeRow labelMedium;

  /// A page's own name.
  final GitPulseTypeRow headlineSmall;

  /// The largest statement the client makes: a page-level headline above a form.
  final GitPulseTypeRow headlineMedium;

  /// The body of a notes or README document: 15 on a 24 line, a line and a half for
  /// sustained reading.
  final GitPulseTypeRow readingBody;

  /// A first-level reading heading.
  final GitPulseTypeRow readingHeading1;

  /// A second-level reading heading.
  final GitPulseTypeRow readingHeading2;

  /// A third-level reading heading, and every level below it: no heading is smaller than the
  /// body text, so tiers four to six fold into this one.
  final GitPulseTypeRow readingHeading3;

  /// The eight roles Material's [TextTheme] carries, by role name.
  Map<String, GitPulseTypeRow> get chromeRoles => <String, GitPulseTypeRow>{
    'bodySmall': bodySmall,
    'bodyMedium': bodyMedium,
    'titleSmall': titleSmall,
    'titleMedium': titleMedium,
    'labelSmall': labelSmall,
    'labelMedium': labelMedium,
    'headlineSmall': headlineSmall,
    'headlineMedium': headlineMedium,
  };

  /// Every row, by the name the client knows it by.
  Map<String, GitPulseTypeRow> get allRows => <String, GitPulseTypeRow>{
    ...chromeRoles,
    'readingBody': readingBody,
    'readingHeading1': readingHeading1,
    'readingHeading2': readingHeading2,
    'readingHeading3': readingHeading3,
  };

  /// [base] with this table's eight roles set from it.
  ///
  /// The roles the table does not author keep whatever [base] gave them, so a retained
  /// Material control that reads one (a text field's own text is `bodyLarge`) still has one.
  TextTheme applyTo(TextTheme base) => base.copyWith(
    bodySmall: bodySmall.mergeOnto(base.bodySmall),
    bodyMedium: bodyMedium.mergeOnto(base.bodyMedium),
    titleSmall: titleSmall.mergeOnto(base.titleSmall),
    titleMedium: titleMedium.mergeOnto(base.titleMedium),
    labelSmall: labelSmall.mergeOnto(base.labelSmall),
    labelMedium: labelMedium.mergeOnto(base.labelMedium),
    headlineSmall: headlineSmall.mergeOnto(base.headlineSmall),
    headlineMedium: headlineMedium.mergeOnto(base.headlineMedium),
  );
}

/// The `gitpulse` type table, the one every presentation of the preset shares.
///
/// The sizes are the whole of the app's type: a role's size, weight, line height and letter
/// spacing are decided here and nowhere else, so the injected `TextTheme` and the app's own
/// type helpers cannot disagree about a role. Line heights run looser than Material's — 1.4
/// to 1.5 through the chrome — because the client is read in Chinese as well as in English,
/// and a Chinese line needs the room a Latin one does not.
const gitPulseTypeTable = GitPulseTypeTable(
  // 13 on an 18.85 line: small enough to sit under the thing it describes, large enough to
  // read a timestamp at arm's length.
  bodySmall: GitPulseTypeRow(
    size: 13,
    weight: FontWeight.w400,
    height: 1.45,
    letterSpacing: 0.1,
  ),
  // 14 on a 21 line. The size is the one the app's measured controls are built around — the
  // page pill's number cell is four tabular digits at this size — so it is kept, and the
  // looser line is what makes it GitPulse's.
  bodyMedium: GitPulseTypeRow(
    size: 14,
    weight: FontWeight.w400,
    height: 1.5,
    letterSpacing: 0.1,
  ),
  // A row's own name carries weight instead of size: the hierarchy in dense chrome comes from
  // the weight, so a row is never set larger than the prose around it.
  titleSmall: GitPulseTypeRow(
    size: 14,
    weight: FontWeight.w600,
    height: 1.45,
    letterSpacing: 0.1,
  ),
  titleMedium: GitPulseTypeRow(
    size: 16,
    weight: FontWeight.w600,
    height: 1.4,
    letterSpacing: 0.1,
  ),
  // 11 with half a pixel of tracking: a section label reads as a label instead of as small
  // text, and a timestamp stays legible at the smallest step the table has. Its size is the
  // one the Timeline's Previous Refresh marker was built at, and it stays there: a label is
  // the role the chrome sets inside rows it does not get to re-flow.
  labelSmall: GitPulseTypeRow(
    size: 11,
    weight: FontWeight.w500,
    height: 1.35,
    letterSpacing: 0.5,
  ),
  labelMedium: GitPulseTypeRow(
    size: 13,
    weight: FontWeight.w500,
    height: 1.45,
    letterSpacing: 0.2,
  ),
  // 22 on a 28.6 line: large enough to be the page's, small enough to leave the document
  // beneath it the room to be read.
  headlineSmall: GitPulseTypeRow(
    size: 22,
    weight: FontWeight.w600,
    height: 1.3,
    letterSpacing: 0,
  ),
  headlineMedium: GitPulseTypeRow(
    size: 26,
    weight: FontWeight.w500,
    height: 1.3,
    letterSpacing: 0,
  ),
  readingBody: GitPulseTypeRow(
    size: 15,
    weight: FontWeight.w400,
    height: 1.6,
    letterSpacing: 0.1,
  ),
  readingHeading1: GitPulseTypeRow(
    size: 20,
    weight: FontWeight.w600,
    height: 1.35,
    letterSpacing: 0,
  ),
  readingHeading2: GitPulseTypeRow(
    size: 17,
    weight: FontWeight.w600,
    height: 1.35,
    letterSpacing: 0,
  ),
  readingHeading3: GitPulseTypeRow(
    size: 15,
    weight: FontWeight.w600,
    height: 1.35,
    letterSpacing: 0,
  ),
);

/// A Theme Preset: the named set of Foundation Layer values a client presents in full, light
/// and dark both.
///
/// A preset is data, not code path: presenting a second one is a second value of this class,
/// which is why the registry below exists even though it holds one entry (ADR 0031).
@immutable
class GitPulseThemePreset {
  const GitPulseThemePreset({
    required this.name,
    required this.light,
    required this.dark,
    required this.type,
  });

  /// The preset's name, which is also its identity in the registry.
  final String name;

  /// The light presentation's palette.
  final GitPulsePaletteTones light;

  /// The dark presentation's palette.
  final GitPulsePaletteTones dark;

  /// The type table both presentations are set in.
  final GitPulseTypeTable type;

  /// The palette this preset presents at [brightness].
  GitPulsePaletteTones paletteFor(Brightness brightness) =>
      brightness == Brightness.light ? light : dark;
}

/// The product's own Theme Preset.
///
/// Its palette is the `gitpulse` palette the web app presents too, generated from
/// `../shared/data/theme-palette.json`, so a tone changed there changes both clients.
const gitPulsePreset = GitPulseThemePreset(
  name: 'gitpulse',
  light: GitPulsePalette.light,
  dark: GitPulsePalette.dark,
  type: gitPulseTypeTable,
);

/// Every Theme Preset the client can present, by name.
///
/// Exactly one is registered. There is no reader-facing preset choice and none is stored in
/// Device Preferences: a preference that can only hold one value is not added, and the
/// registry is here so that a second preset later is a data addition rather than a redesign.
const gitPulsePresets = <String, GitPulseThemePreset>{
  'gitpulse': gitPulsePreset,
};
