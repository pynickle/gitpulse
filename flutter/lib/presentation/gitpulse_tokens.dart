import 'package:flutter/material.dart';

/// Small content movements that accompany navigation, separate from layout.
abstract final class GitPulseMotion {
  /// The Release Timeline's distant return, hidden between its two positions.
  /// Registered in ADR 0030; this is a paint offset, never layout spacing.
  static const timelineReturnShift = 12.0;
}

/// The distances every GitPulse surface is laid out on, named by the job each
/// one does rather than by its size.
///
/// Naming by role is what keeps "how many pixels go here?" from being a
/// question: a card's inner padding is [surfaceInset] because that is what it
/// is, not because 14 happened to look right. A distance no role describes is
/// meant to become an ADR, not a literal.
abstract final class GitPulseSpace {
  /// Between a glyph and the text label it belongs to.
  static const glyphGap = 4.0;

  /// Between two lines of one block: a card's two rows, a control and its
  /// note.
  static const tight = 6.0;

  /// Between side-by-side items of one row: chips, an icon group, the label
  /// above a control.
  static const inline = 8.0;

  /// Between a card's body and the meta line beneath it.
  static const meta = 10.0;

  /// A row's top and bottom inset, in a table and in Settings.
  static const rowInsetV = 12.0;

  /// A card's or a banner's inner padding, on all four sides.
  static const surfaceInset = 14.0;

  /// The page gutter.
  ///
  /// One value for every band on every page: a Timeline column, a Settings row,
  /// a Follows row and a Repository band all begin at the same x. A page at a
  /// different gutter is the defect, not a variant.
  static const gutter = 16.0;

  /// Between two facts on the Repository page's data line.
  static const factGap = 20.0;

  /// Between two bands, and the space a page leaves after its last one.
  static const bandGap = 24.0;

  /// The space a page leaves at its end, after a Repository page's README.
  static const bandGapLoose = 32.0;

  /// An optical nudge between a name and the meta line that follows it — small
  /// enough that it corrects an alignment instead of adding a gap.
  static const nudge = 2.0;
}

/// The corner radii a surface may take, plus the strip a decoration draws.
abstract final class GitPulseRadius {
  /// A row's ink shape, an asset row, a drawer's chrome row, an input, a search
  /// field, and every pill that answers a press (ADR 0019 named 8dp).
  ///
  /// A status badge does not: it takes [surface], so the one pill in the app
  /// that answers no press is told apart from the controls by its corner alone
  /// (ADR 0020).
  static const row = 8.0;

  /// A card, a banner, the top of the filter panel (ADR 0019 named 12dp for
  /// the Timeline card).
  static const surface = 12.0;

  /// A mobile bottom sheet's top corners. The rest of that sheet's
  /// geometry — 70% open, 40% floor, 0.7 snap — belongs to ADR 0010.
  static const sheetTop = 20.0;

  /// The Entry Release marker's 4dp-wide strip: a decoration, not a surface.
  static const bar = 2.0;
}

/// The one line width the app draws.
///
/// Half-pixel rules are gone deliberately: 0.5 renders inconsistently on
/// high-DPI displays, and it was the wrong hierarchy signal besides.
abstract final class GitPulseStroke {
  /// The only stroke width. A stronger rule is a darker tone here, never a
  /// thicker line.
  static const hairline = 1.0;
}

/// The tone of a surface's outer boundary: a card's border, an input's outline,
/// a sheet's edge.
///
/// Taken from the scheme's outline rather than from the theme's `dividerColor`,
/// which under Material 3 resolves to that same outline: reading it for an
/// internal line is what once made a table rule and a card border carry the
/// same weight of ink.
Color toneEdge(ColorScheme scheme) => scheme.outline;

/// The tone of a line drawn inside a surface: a Settings hairline, a date
/// group's header, an asset module's boundary.
///
/// A surface uses this for every line within it and [toneEdge] only for its
/// own edge, which is the whole difference between the two.
Color toneRule(ColorScheme scheme) => scheme.outlineVariant;

/// Icon extents by what the icon does, not by the glyph's shape.
///
/// The semantics decide the size: an icon inside a control is smaller than one
/// that stands alone as a button, so a misread role shows up as a glyph that
/// grew or shrank beside its neighbours.
abstract final class GitPulseIconSize {
  /// A glyph standing in for a noun: the Repository data line's star, fork and
  /// eye, the language swatch.
  static const fact = 14.0;

  /// A glyph beside a label inside a surface: a card's attachment mark, an
  /// asset's type icon.
  static const inline = 16.0;

  /// A glyph inside a compact control: an input's prefix or clear button, a
  /// chip's icon, a toolbar control's mark.
  static const inControl = 18.0;

  /// An icon button in a row, a toolbar or an app bar.
  static const action = 20.0;

  /// The icon of a page-level empty or error state.
  static const page = 32.0;
}

/// Avatar diameters by the identity they introduce.
abstract final class GitPulseAvatarSize {
  /// The signed-in account beside its name in Settings.
  static const account = 32.0;

  /// A repository's owner, introducing the page that is about that repository.
  ///
  /// Larger than [account] because it stands beside the page's own name rather
  /// than inside a Settings row: it is the identity the page opens with.
  static const owner = 40.0;
}

/// How tall a control stands.
abstract final class GitPulseHeight {
  /// A toolbar control, a search field, a filter chip, a dropdown in a tool
  /// strip — and the floor for anything clickable.
  static const compact = 40.0;

  /// The smallest a clickable list row may be. A control drawn smaller than
  /// this still has to clear it as a touch target.
  static const rowMin = 44.0;

  /// A default Material icon button's padded touch target, and a drawer's
  /// chrome row.
  static const standard = 48.0;

  /// A page pill: one flat cell of page navigation.
  ///
  /// Flatter than [compact] on purpose — the pill is a footnote to the list it
  /// belongs to, and a cell wider than it is tall keeps the step arrows a full
  /// 40dp target across (ADR 0026).
  static const pill = 32.0;
}

/// The shared layout and editor widths, registered so a width is changed
/// in one place instead of in each page that happens to need it.
///
/// The layout limits stay separate rather than sharing one "content width"
/// because they answer different questions — how wide a line of prose may get,
/// and how wide a column of Settings cards may get. One shared maximum would
/// make the other answer wrong.
abstract final class GitPulseWidth {
  /// A persistent integer editor, shared by retention and page navigation.
  static const integerField = 72.0;

  /// The number cell of a page pill, before the reader's text scale: four
  /// tabular digits at the body size.
  static const pillNumber = 32.0;

  /// The reading measure: the width at which a Repository page's README stays a
  /// line the eye does not lose its place in.
  static const readingMeasure = 960.0;

  /// The scanning ceiling of the Settings cards. Past this width the eye has
  /// to travel too far from a card's title to its control.
  static const settingsTable = 1120.0;
}

/// The numbered reading scale — the one place the app states a font size.
///
/// Everything else takes its size from a Material text role. Notes and READMEs
/// do not: they are read rather than operated, so their body sits at 15 on a 24
/// line and their headings take three tiers. ADR 0018 records why the
/// renderer's own ladder is not used instead — it once pushed a first-level
/// heading 65px down the page and made a fifth-level heading smaller than the
/// body text.
abstract final class GitPulseType {
  /// A page's own name: the repository at the head of its page.
  ///
  /// A repository page is read as well as scanned, so its title sits below a
  /// Material heading's 24 and above its body: large enough to be the page's,
  /// small enough to leave the README beneath it the room to be read.
  static const pageTitleSize = 22.0;

  /// The reading body's size.
  static const readingBodySize = 15.0;

  /// The reading body's line height, in the same units as [readingBodySize]:
  /// 24 over 15, a line-and-a-half for sustained reading.
  static const readingBodyLineHeight = 24.0;

  /// A reading heading's line height, applied to all three tiers so their
  /// blocks keep one rhythm.
  static const readingHeadingLineHeight = 1.35;

  /// A first-level reading heading.
  static const readingHeading1Size = 20.0;

  /// A second-level reading heading.
  static const readingHeading2Size = 17.0;

  /// A third-level reading heading, and every level below it: no heading is
  /// smaller than the body text, so tiers four to six fold into this one.
  static const readingHeading3Size = readingBodySize;

  /// A reading list's indent.
  static const readingListIndent = 20.0;

  /// A reading blockquote's indent, under its quote bar.
  static const readingQuoteIndent = 12.0;
}

/// A page's own name: a Repository page's identity, at the emphasis of a
/// heading rather than of a paragraph.
TextStyle? gitPulseTypePageTitle(BuildContext context) {
  final theme = Theme.of(context);
  return theme.textTheme.headlineSmall?.copyWith(
    fontSize: GitPulseType.pageTitleSize,
    fontWeight: FontWeight.w600,
    color: theme.colorScheme.onSurface,
  );
}

/// The owner named above the repository's own name.
///
/// The page says who owns the repository before it says which one it is, and
/// the two are separate lines: this one only carries the address, so it keeps
/// the body size, the lighter weight, and the muted tone.
TextStyle? gitPulseTypePageOwner(BuildContext context) {
  final theme = Theme.of(context);
  return theme.textTheme.titleSmall?.copyWith(
    fontWeight: FontWeight.w400,
    color: theme.colorScheme.onSurfaceVariant,
  );
}

/// The title of a surface within a page: a Timeline card, an empty or error
/// state.
TextStyle? gitPulseTypeSurfaceTitle(BuildContext context) {
  final theme = Theme.of(context);
  return theme.textTheme.titleMedium?.copyWith(
    fontWeight: FontWeight.w600,
    color: theme.colorScheme.onSurface,
  );
}

/// The name a row is about: a setting's label, a Follows row's repository.
TextStyle? gitPulseTypeRowLabel(BuildContext context) {
  final theme = Theme.of(context);
  return theme.textTheme.titleSmall?.copyWith(
    fontWeight: FontWeight.w600,
    color: theme.colorScheme.onSurface,
  );
}

/// A date group's header in the Timeline.
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
/// card is allowed.
TextStyle? gitPulseTypeBrandName(BuildContext context) {
  final theme = Theme.of(context);
  return theme.textTheme.labelMedium?.copyWith(
    fontWeight: FontWeight.w600,
    color: theme.colorScheme.primary,
  );
}

/// The label of a block within a surface: a folded asset row, the Previous
/// Refresh marker.
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

/// A card's summary, a setting's note, a meta line.
TextStyle? gitPulseTypeMeta(BuildContext context) {
  final theme = Theme.of(context);
  return theme.textTheme.bodySmall?.copyWith(
    fontWeight: FontWeight.w400,
    color: theme.colorScheme.onSurfaceVariant,
  );
}

/// The tightest meta there is: a card's timestamp, an asset's size and download
/// count.
TextStyle? gitPulseTypeMetaTight(BuildContext context) {
  final theme = Theme.of(context);
  return theme.textTheme.labelSmall?.copyWith(
    fontWeight: FontWeight.w400,
    color: theme.colorScheme.onSurfaceVariant,
  );
}

/// A repository's description: prose, but still part of a page that is scanned.
///
/// It sits at the body size rather than at the 16 of a passage read on its own,
/// because the title above it carries the page and the description only says
/// what the repository is for.
TextStyle? gitPulseTypeDescription(BuildContext context) {
  final theme = Theme.of(context);
  return theme.textTheme.bodyMedium?.copyWith(
    fontWeight: FontWeight.w400,
    color: theme.colorScheme.onSurfaceVariant,
  );
}

/// The reading body of a notes or README document.
///
/// The one style in the app with a written size and line height; everything
/// else inherits a Material role's own metrics.
TextStyle? gitPulseTypeReadingBody(BuildContext context) =>
    Theme.of(context).textTheme.bodyMedium?.copyWith(
      fontSize: GitPulseType.readingBodySize,
      fontWeight: FontWeight.w400,
      height: GitPulseType.readingBodyLineHeight / GitPulseType.readingBodySize,
    );
