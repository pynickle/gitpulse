import 'package:flutter/material.dart';

/// The distances every GitPulse surface is laid out on, named by the job each
/// one does rather than by its size (MASTER §5).
///
/// Naming by role is what keeps "how many pixels go here?" from being a
/// question: a card's inner padding is [surfaceInset] because that is what it
/// is, not because 14 happened to look right. A distance no role describes is
/// meant to become an ADR, not a literal.
abstract final class GitPulseSpace {
  /// Between a glyph and the text label it belongs to (MASTER §5).
  static const glyphGap = 4.0;

  /// Between two lines of one block: a card's two rows, a control and its
  /// note (MASTER §5).
  static const tight = 6.0;

  /// Between side-by-side items of one row: chips, an icon group, the label
  /// above a control (MASTER §5).
  static const inline = 8.0;

  /// Between a card's body and the meta line beneath it (MASTER §5).
  static const meta = 10.0;

  /// A row's top and bottom inset, in a table and in Settings (MASTER §5).
  static const rowInsetV = 12.0;

  /// A card's or a banner's inner padding, on all four sides (MASTER §5).
  static const surfaceInset = 14.0;

  /// The page gutter.
  ///
  /// One value for every band on every page (MASTER §5 rule 1): a Timeline
  /// column, a Settings row, a Follows row and a Repository band all begin at
  /// the same x. A page at a different gutter is the defect, not a variant.
  static const gutter = 16.0;

  /// Between two facts on the Repository page's data line (MASTER §5).
  static const factGap = 20.0;

  /// Between two bands, and the space a page leaves after its last one
  /// (MASTER §5).
  static const bandGap = 24.0;

  /// The space a page leaves at its end, after a Repository page's README
  /// (MASTER §5).
  static const bandGapLoose = 32.0;

  /// An optical nudge between a name and the meta line that follows it — small
  /// enough that it corrects an alignment instead of adding a gap (MASTER §5).
  static const nudge = 2.0;

  /// Between two adjacent Release Timeline columns.
  ///
  /// The wide Release Drawer derives its panel width from this same value, so
  /// a column and the panel that replaces it cannot drift apart (MASTER §5,
  /// ADR 0018).
  static const columnGap = 12.0;
}

/// The corner radii a surface may take, plus the strip a decoration draws
/// (MASTER §6).
abstract final class GitPulseRadius {
  /// A row's ink shape, an asset row, a drawer's chrome row, an input or a
  /// search field (MASTER §6, ADR 0019 named 8dp).
  ///
  /// A badge shares it: 6 and 8 are indistinguishable on a 17dp box, and one
  /// fewer token is one fewer argument.
  static const row = 8.0;

  /// A card, a banner, the top of the filter panel (MASTER §6, ADR 0019 named
  /// 12dp for the Timeline card).
  static const surface = 12.0;

  /// A mobile bottom sheet's top corners (MASTER §6). The rest of that sheet's
  /// geometry — 70% open, 40% floor, 0.7 snap — belongs to ADR 0010.
  static const sheetTop = 20.0;

  /// The Entry Release marker's 4dp-wide strip: a decoration, not a surface
  /// (MASTER §6, §12 E8).
  static const bar = 2.0;
}

/// The one line width the app draws (MASTER §7).
///
/// Half-pixel rules are gone deliberately: 0.5 renders inconsistently on
/// high-DPI displays, and it was the wrong hierarchy signal besides
/// (MASTER §12 E14).
abstract final class GitPulseStroke {
  /// The only stroke width. A stronger rule is a darker tone here, never a
  /// thicker line.
  static const hairline = 1.0;
}

/// The tone of a surface's outer boundary: a card's border, an input's outline,
/// a sheet's edge (MASTER §7).
///
/// Taken from the scheme's outline rather than from the theme's `dividerColor`,
/// which under Material 3 resolves to that same outline: reading it for an
/// internal line is what once made a table rule and a card border carry the
/// same weight of ink (MASTER §15).
Color toneEdge(ColorScheme scheme) => scheme.outline;

/// The tone of a line drawn inside a surface: a Settings hairline, a date
/// group's header, an asset module's boundary (MASTER §7).
///
/// A surface uses this for every line within it and [toneEdge] only for its
/// own edge, which is the whole difference between the two.
Color toneRule(ColorScheme scheme) => scheme.outlineVariant;

/// Icon extents by what the icon does, not by the glyph's shape (MASTER §8).
///
/// The semantics decide the size: an icon inside a control is smaller than one
/// that stands alone as a button, so a misread role shows up as a glyph that
/// grew or shrank beside its neighbours.
abstract final class GitPulseIconSize {
  /// A glyph standing in for a noun: the Repository data line's star, fork and
  /// eye, the language swatch (MASTER §8, §12 E7).
  static const fact = 14.0;

  /// A glyph beside a label inside a surface: a card's attachment mark, an
  /// asset's type icon (MASTER §8).
  static const inline = 16.0;

  /// A glyph inside a compact control: an input's prefix or clear button, a
  /// chip's icon, a toolbar control's mark (MASTER §8).
  static const inControl = 18.0;

  /// An icon button in a row, a toolbar or an app bar (MASTER §8).
  static const action = 20.0;

  /// The icon of a page-level empty or error state (MASTER §8).
  static const page = 32.0;
}

/// How tall a control stands (MASTER §9).
abstract final class GitPulseHeight {
  /// A toolbar control, a search field, a filter chip, a dropdown in a tool
  /// strip — and the floor for anything clickable (MASTER §9 rule 1).
  static const compact = 40.0;

  /// The smallest a clickable list row may be, and the floor §9 rule 2 puts
  /// under any clickable target drawn smaller than that.
  static const rowMin = 44.0;

  /// A default Material icon button's padded touch target, and a drawer's
  /// chrome row (MASTER §9, §12 E10).
  static const standard = 48.0;
}

/// The four widths the layouts break at, registered so a breakpoint is changed
/// in one place instead of in each page that happens to need it (MASTER §12
/// E11).
///
/// E11 keeps them as four tokens rather than one "content width" because they
/// answer four different questions — how wide a line of prose may get, how wide
/// a table of settings may get, and where a Timeline goes from one column to
/// two and from two to three. One shared maximum would make three of the four
/// answers wrong.
abstract final class GitPulseWidth {
  /// The reading measure: the width at which a Repository page's README stays a
  /// line the eye does not lose its place in (MASTER §1, §12 E11).
  static const readingMeasure = 960.0;

  /// The scanning ceiling of the Settings table, which is read as a table
  /// rather than as prose (MASTER §12 E11).
  static const settingsTable = 1120.0;

  /// The Release Timeline's phone ceiling: at or below it, one column
  /// (MASTER §12 E11).
  static const timelinePhone = 700.0;

  /// The Release Timeline's tablet ceiling: above it, three columns (MASTER
  /// §12 E11).
  static const timelineTablet = 1100.0;
}

/// The numbered reading scale — the one place the app states a font size
/// (MASTER §2.2).
///
/// Everything else takes its size from a Material text role. Notes and READMEs
/// do not: they are read rather than operated, so their body sits at 15 on a 24
/// line and their headings take three tiers. ADR 0018 records why the
/// renderer's own ladder is not used instead — it once pushed a first-level
/// heading 65px down the page and made a fifth-level heading smaller than the
/// body text.
abstract final class GitPulseType {
  /// The reading body's size (MASTER §2.2).
  static const readingBodySize = 15.0;

  /// The reading body's line height, in the same units as [readingBodySize]:
  /// 24 over 15, a line-and-a-half for sustained reading (MASTER §2.2).
  static const readingBodyLineHeight = 24.0;

  /// A reading heading's line height, applied to all three tiers so their
  /// blocks keep one rhythm (MASTER §2.2).
  static const readingHeadingLineHeight = 1.35;

  /// A first-level reading heading (MASTER §2.2).
  static const readingHeading1Size = 20.0;

  /// A second-level reading heading (MASTER §2.2).
  static const readingHeading2Size = 17.0;

  /// A third-level reading heading, and every level below it: no heading is
  /// smaller than the body text, so tiers four to six fold into this one
  /// (MASTER §2.2).
  static const readingHeading3Size = readingBodySize;

  /// A reading list's indent (MASTER §2.2).
  static const readingListIndent = 20.0;

  /// A reading blockquote's indent, under its quote bar (MASTER §2.2).
  static const readingQuoteIndent = 12.0;
}

/// A page's own name: a Repository page's identity, at the emphasis of a
/// heading rather than of a paragraph (MASTER §2.1 `pageTitle`).
///
/// The owner segment beside the repository name is the page's exception, set
/// lighter and muted, so the repository reads as the name and the owner as the
/// address.
TextStyle? gitPulseTypePageTitle(BuildContext context) {
  final theme = Theme.of(context);
  return theme.textTheme.headlineSmall?.copyWith(
    fontWeight: FontWeight.w600,
    color: theme.colorScheme.onSurface,
  );
}

/// The title of a surface within a page: a Timeline card, an empty or error
/// state (MASTER §2.1 `surfaceTitle`).
TextStyle? gitPulseTypeSurfaceTitle(BuildContext context) {
  final theme = Theme.of(context);
  return theme.textTheme.titleMedium?.copyWith(
    fontWeight: FontWeight.w600,
    color: theme.colorScheme.onSurface,
  );
}

/// The name a row is about: a setting's label, a Follows row's repository
/// (MASTER §2.1 `rowLabel`).
TextStyle? gitPulseTypeRowLabel(BuildContext context) {
  final theme = Theme.of(context);
  return theme.textTheme.titleSmall?.copyWith(
    fontWeight: FontWeight.w600,
    color: theme.colorScheme.onSurface,
  );
}

/// A date group's header in the Timeline (MASTER §2.1 `groupHeader`).
///
/// Left at the weight Material gives it: the header already sits between two
/// rules, and bolding it as well would make it compete with the cards it
/// introduces.
TextStyle? gitPulseTypeGroupHeader(BuildContext context) {
  final theme = Theme.of(context);
  return theme.textTheme.titleSmall?.copyWith(
    color: theme.colorScheme.onSurface,
  );
}

/// The repository's full name in a Timeline card — the only coloured text a
/// card is allowed (MASTER §2.1 `brandName`, §3.2 `brandLink`).
TextStyle? gitPulseTypeBrandName(BuildContext context) {
  final theme = Theme.of(context);
  return theme.textTheme.labelMedium?.copyWith(
    fontWeight: FontWeight.w600,
    color: theme.colorScheme.primary,
  );
}

/// The label of a block within a surface: a folded asset row, the Previous
/// Refresh marker (MASTER §2.1 `sectionLabel`).
///
/// The letter spacing is what makes an 11sp all-but-caps label read as a label
/// instead of as small text.
TextStyle? gitPulseTypeSectionLabel(BuildContext context) {
  final theme = Theme.of(context);
  return theme.textTheme.labelSmall?.copyWith(
    fontWeight: FontWeight.w600,
    letterSpacing: 0.6,
    color: theme.colorScheme.onSurfaceVariant,
  );
}

/// A card's summary, a setting's note, a meta line (MASTER §2.1 `meta`).
TextStyle? gitPulseTypeMeta(BuildContext context) {
  final theme = Theme.of(context);
  return theme.textTheme.bodySmall?.copyWith(
    fontWeight: FontWeight.w400,
    color: theme.colorScheme.onSurfaceVariant,
  );
}

/// The tightest meta there is: a card's timestamp, an asset's size and download
/// count (MASTER §2.1 `metaTight`).
TextStyle? gitPulseTypeMetaTight(BuildContext context) {
  final theme = Theme.of(context);
  return theme.textTheme.labelSmall?.copyWith(
    fontWeight: FontWeight.w400,
    color: theme.colorScheme.onSurfaceVariant,
  );
}

/// A repository's description: prose, but still part of a page that is scanned
/// (MASTER §2.1 `description`).
TextStyle? gitPulseTypeDescription(BuildContext context) {
  final theme = Theme.of(context);
  return theme.textTheme.bodyLarge?.copyWith(
    fontWeight: FontWeight.w400,
    color: theme.colorScheme.onSurfaceVariant,
  );
}

/// The reading body of a notes or README document (MASTER §2.2 `readingBody`).
///
/// The one style in the app with a written size and line height; everything
/// else inherits a Material role's own metrics (MASTER §2.3).
TextStyle? gitPulseTypeReadingBody(BuildContext context) =>
    Theme.of(context).textTheme.bodyMedium?.copyWith(
      fontSize: GitPulseType.readingBodySize,
      fontWeight: FontWeight.w400,
      height: GitPulseType.readingBodyLineHeight / GitPulseType.readingBodySize,
    );
