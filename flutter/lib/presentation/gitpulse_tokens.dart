import 'package:flutter/material.dart';

import 'gitpulse_preset.dart';
import 'gitpulse_theme.dart';

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

  /// A reading list's indent, under the paragraph that introduces it.
  ///
  /// The reading surface's own distance rather than the chrome's: it is set
  /// against the reading measure, not against a card's inset.
  static const readingListIndent = 20.0;

  /// A reading blockquote's indent, under its quote bar.
  static const readingQuoteIndent = 12.0;
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

  /// A mobile bottom sheet's top corners. The Release Drawer's remaining
  /// geometry — 70% open, 50% floor, 0.7 snap — is recorded in ADR 0018.
  static const sheetTop = 20.0;

  /// The smallest rounding the app draws, on a decoration rather than a
  /// surface: the Entry Release marker's 4dp-wide strip, and a toggle's box —
  /// a mark that is read at a glance rather than a block that is read.
  static const bar = 2.0;
}

/// The line widths the app draws.
///
/// Half-pixel rules are gone deliberately: 0.5 renders inconsistently on
/// high-DPI displays, and it was the wrong hierarchy signal besides.
///
/// There is one width for every line the app separates or bounds anything with — a card's
/// edge, a table rule, a bar's hairline, an input's outline — and it is [hairline]. A stronger
/// boundary is a darker tone at that same width, never a thicker line.
///
/// The three heavier widths below are not rules at all: they are the pen a drawn *mark* is made
/// with, and each is named for the mark that needs it, because a stroke that draws a check or an
/// arc is a different job from one that divides two tones.
abstract final class GitPulseStroke {
  /// The only rule width. A stronger rule is a darker tone here, never a thicker line.
  static const hairline = 1.0;

  /// The pen a toggle's mark is drawn with: the checkbox's check and its mixed-state dash,
  /// painted inside an 18dp box.
  static const toggleMark = 2.0;

  /// The pen a row indicator's arc is drawn with, at a glyph's measure (20dp): heavy enough to
  /// read in a row of text, light enough not to read as a solid disc.
  static const progressInline = 2.0;

  /// The pen a page indicator's arc is drawn with, at the page state's measure (32dp): the
  /// larger mark needs the heavier pen to keep the same visual weight as the row's.
  static const progressPage = 3.0;
}

/// What the app paints when a surface shows the ink beneath it rather than a
/// fill of its own.
///
/// It is not a tone: it is the app's one word for "this surface has no colour",
/// so a surface that stands transparent over the ink — an asset row, a chip that
/// is not chosen, the card a press is answered on — reads this instead of naming
/// a colour literal of its own (ADR 0032). The app's press rule is the same
/// statement: a press paints [none].
abstract final class GitPulsePaint {
  /// No colour at all: the surface under this one shows through.
  static const none = Colors.transparent;
}

/// The tones the app's own surfaces are painted with, read by the job each one does.
///
/// These are the Theme Preset's semantic tones (ADR 0031): the names the shared palette data
/// declares and the web app injects as CSS custom properties, so a reader of either client
/// meets one vocabulary. App code reads these for colour and stops reading Material's roles —
/// `onSurface` stops meaning "GitPulse's text", `primary` stops meaning "the Accent", and a
/// green stops meaning "GitPulse" (it means a status, and only that).
///
/// Each reader takes the [BuildContext] the app's own type helpers take, and resolves through
/// the theme's preset, so a tone cannot be read from anywhere but the presentation layer.
/// The tone of the page: the canvas every screen stands on, and the tone the web app paints its
/// own body with.
///
/// It is the palette's outermost step, darker than a surface in the light presentation and
/// darker than the shell in the dark one, which is what lets a card, a bar and a sheet stand on
/// the page and be read as raised from it.
Color tonePage(BuildContext context) => gitPulseTonesOf(context).pageBg;

/// The tone of a well cut into a surface: a field's own fill, an avatar's disc, the ground a
/// floating action stands on, and the backdrop a pull-to-refresh paints.
///
/// It is a step *within* a surface, not the page: the page is [tonePage].
Color toneShell(BuildContext context) => gitPulseTonesOf(context).shellBg;

/// The tone of a card, a sheet, a dialog: the surface a reader reads.
Color toneSurface(BuildContext context) => gitPulseTonesOf(context).surface;

/// A muted block within a surface: a Settings row's fill, a document's code block.
Color toneSurfaceMuted(BuildContext context) =>
    gitPulseTonesOf(context).surfaceMuted;

/// The fill a selected row, a chosen chip or an active destination takes.
Color toneSurfaceActive(BuildContext context) =>
    gitPulseTonesOf(context).surfaceActive;

/// The hairline between two lines within a surface, and the quietest boundary the app draws.
Color toneBorder(BuildContext context) => gitPulseTonesOf(context).border;

/// The stronger boundary: a card's own edge, an input's outline.
Color toneBorderStrong(BuildContext context) =>
    gitPulseTonesOf(context).borderStrong;

/// The tone a passage of prose is set in.
Color toneText(BuildContext context) => gitPulseTonesOf(context).text;

/// The tone a name, a title or any emphasised line is set in.
Color toneTextStrong(BuildContext context) =>
    gitPulseTonesOf(context).textStrong;

/// The tone a line that supports another one is set in: a note, a meta line, an owner.
Color toneTextMuted(BuildContext context) => gitPulseTonesOf(context).textMuted;

/// The quietest ink the app draws: a count beside a label, a footnote.
Color toneTextSubtle(BuildContext context) =>
    gitPulseTonesOf(context).textSubtle;

/// The Accent: primary actions, the selected state, focus. It is not the success tone, and no
/// surface may use one in the other's place (ADR 0031).
Color toneAccent(BuildContext context) => gitPulseTonesOf(context).accent;

/// The Accent laid on as a wash: a selected pill's fill, a confirmation's ground,
/// and the disc that holds the mark of a way into the app.
Color toneAccentSoft(BuildContext context) =>
    gitPulseTonesOf(context).accentSoft;

/// The tone that reads on the Accent: a filled button's label, a filled badge's
/// text, the check on a filled control.
///
/// It is the pairing the theme states for every filled role rather than a tone
/// of its own — the surface under a light Accent and the shell under a dark one —
/// so a filled control never chooses a foreground for itself.
Color toneOnAccent(BuildContext context) =>
    gitPulseOnFill(gitPulseTonesOf(context), Theme.of(context).brightness);

/// The success tone, read as text: "this succeeded", and nothing else.
///
/// It is the only reader the success family needs: the app paints no solid success fill — a
/// receipt is a mark and a line, never a filled block — so `success-solid` stays a row of the
/// shared palette that both clients may present, and this module has nothing to read it with.
Color toneSuccess(BuildContext context) => gitPulseTonesOf(context).success;

/// The danger tone, read as text: a failure, a destructive action's label.
Color toneDanger(BuildContext context) => gitPulseTonesOf(context).danger;

/// The danger tone as a wash: the ground of a banner that reports a failure, and the fill of a
/// failure's container.
///
/// It is a row of the shared palette (`danger-soft`) rather than a strength this client mixes for
/// itself, because the web app paints the same wash behind its own failure banners: a client that
/// derived its own proportion would drift from the other's hue in the light presentation and from
/// its strength in the dark one. Hue and alpha are the data's (ADR 0032).
Color toneDangerSoft(BuildContext context) =>
    gitPulseTonesOf(context).dangerSoft;

/// The tone a modal barrier is drawn in: the darkest ink the presentation has.
///
/// It is the one Material role the app still reads, and it is read here rather than in a
/// widget, because this module is the place that speaks Material's colour vocabulary (ADR
/// 0032). A barrier's value is not a palette step — it is "whatever this presentation's
/// darkest ink is", which is black on both presentations — so it is not a row of the shared
/// data; the strength it is laid on at belongs to the dialog entry point that draws it
/// (`gitPulseDialogBarrierAlpha`).
Color toneScrim(BuildContext context) => Theme.of(context).colorScheme.scrim;

/// The tone of a surface's outer boundary: a card's border, an input's outline,
/// a sheet's edge.
///
/// Taken from the scheme's outline rather than from the theme's `dividerColor`,
/// which under Material 3 resolves to that same outline: reading it for an
/// internal line is what once made a table rule and a card border carry the
/// same weight of ink. The scheme fills that role from the preset's
/// [toneBorderStrong] tone (ADR 0031), which is why this reader and that one
/// agree.
Color toneEdge(ColorScheme scheme) => scheme.outline;

/// The tone of a line drawn inside a surface: a Settings hairline, a date
/// group's header, an asset module's boundary.
///
/// A surface uses this for every line within it and [toneEdge] only for its
/// own edge, which is the whole difference between the two. The scheme fills
/// this role from the preset's [toneBorder] tone.
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
  static const integerField = 56.0;

  /// The reading measure: the width at which a Repository page's README stays a
  /// line the eye does not lose its place in.
  static const readingMeasure = 960.0;

  /// The scanning ceiling of the Settings cards. Past this width the eye has
  /// to travel too far from a card's title to its control.
  static const settingsTable = 1120.0;

  /// A dialog's own measure: the width past which an overlay stops reading as a
  /// surface over the page and starts reading as a page of its own.
  ///
  /// It is the ceiling the app's account gate already holds its form to, named
  /// here because the dialog entry point owns it for every dialog.
  static const dialog = 420.0;
}

/// One row of the Theme Preset's type table, read as a text style.
///
/// It is the single path from a type role to the app's type: the row's size, weight, line height
/// and letter spacing are the table's (ADR 0031), and a helper decides only the colour and —
/// where one role has to carry two jobs — the weight. No helper states a size, a line height or a
/// letter spacing, so the style a screen is set in cannot disagree with the style Material hands a
/// retained control: both come from the same rows.
///
/// It reads the table the theme carries rather than the `TextTheme` the theme installed, because
/// those two stop agreeing the moment a subtree supplies a theme of its own — a preview, a probe,
/// a retained Material face that re-themes its descendants. A role asked of the table is the
/// preset's role wherever it is asked from.
TextStyle _typeRow(
  BuildContext context,
  GitPulseTypeRow Function(GitPulseTypeTable table) row, {
  required Color color,
  FontWeight? weight,
}) {
  final style = row(gitPulseTypeTableOf(context)).toTextStyle(color: color);
  return weight == null ? style : style.copyWith(fontWeight: weight);
}

/// A page's own name: a Repository page's identity, at the emphasis of a
/// heading rather than of a paragraph.
TextStyle? gitPulseTypePageTitle(BuildContext context) => _typeRow(
  context,
  (table) => table.headlineSmall,
  color: toneTextStrong(context),
);

/// The owner named above the repository's own name.
///
/// The page says who owns the repository before it says which one it is, and
/// the two are separate lines: this one only carries the address, so it keeps
/// the row's size, the lighter weight, and the muted tone.
TextStyle? gitPulseTypePageOwner(BuildContext context) => _typeRow(
  context,
  (table) => table.titleSmall,
  color: toneTextMuted(context),
  weight: FontWeight.w400,
);

/// The title of a surface within a page: a Timeline card, an empty or error
/// state.
TextStyle? gitPulseTypeSurfaceTitle(BuildContext context) => _typeRow(
  context,
  (table) => table.titleMedium,
  color: toneTextStrong(context),
);

/// The name a row is about: a setting's label, a Follows row's repository.
TextStyle? gitPulseTypeRowLabel(BuildContext context) => _typeRow(
  context,
  (table) => table.titleSmall,
  color: toneTextStrong(context),
);

/// A date group's header in the Timeline.
///
/// Set at the body weight rather than at the row name's: the header already
/// sits between two rules, and bolding it as well would make it compete with the
/// cards it introduces.
TextStyle? gitPulseTypeGroupHeader(BuildContext context) => _typeRow(
  context,
  (table) => table.titleSmall,
  color: toneTextStrong(context),
  weight: FontWeight.w400,
);

/// The repository's full name in a Timeline card — the only coloured text a
/// card is allowed.
///
/// Its name says the job rather than the tone it happens to read: a card leads with the
/// repository it is about, and that line is the one place the Accent stands for identity.
TextStyle? gitPulseTypeRepositoryName(BuildContext context) => _typeRow(
  context,
  (table) => table.labelMedium,
  color: toneAccent(context),
  weight: FontWeight.w600,
);

/// The label of a block within a surface: a folded asset row, the Previous
/// Refresh marker.
///
/// The letter spacing is the table's, not this helper's: it is what makes an
/// all-but-caps label read as a label instead of as small text.
TextStyle? gitPulseTypeSectionLabel(BuildContext context) => _typeRow(
  context,
  (table) => table.labelSmall,
  color: toneTextMuted(context),
  weight: FontWeight.w600,
);

/// A card's summary, a setting's note, a meta line.
TextStyle? gitPulseTypeMeta(BuildContext context) => _typeRow(
  context,
  (table) => table.bodySmall,
  color: toneTextMuted(context),
);

/// The tightest meta there is: a card's timestamp, an asset's size and download
/// count.
TextStyle? gitPulseTypeMetaTight(BuildContext context) => _typeRow(
  context,
  (table) => table.labelSmall,
  color: toneTextMuted(context),
  weight: FontWeight.w400,
);

/// One fact on a data line: the number a glyph stands beside, in the tone a line
/// that supports another one is set in.
///
/// A fact is a label weight rather than a paragraph, so the numbers compare down
/// the line instead of reading as prose; the glyph that says what they count
/// lives in the fact's semantics, so the line never repeats its nouns.
TextStyle? gitPulseTypeFactValue(BuildContext context) => _typeRow(
  context,
  (table) => table.labelMedium,
  color: toneTextMuted(context),
);

/// The largest statement the client makes: a page-level headline above a form,
/// as the connection page's own name is.
TextStyle? gitPulseTypePageHeadline(BuildContext context) => _typeRow(
  context,
  (table) => table.headlineMedium,
  color: toneTextStrong(context),
);

/// The label of a control: a button's text, a dialog's action, a navigation
/// destination.
///
/// It takes its ink as an argument because it is the one helper that serves
/// several tones at once — a variant reads the Accent, the tone that sits on the
/// Accent, or the surface's own text — and emphasis comes from that tone rather
/// than from a larger size. Everything else about the label is the type table's
/// control role, so a control cannot invent a size of its own.
TextStyle? gitPulseTypeControlLabel(BuildContext context, Color color) =>
    _typeRow(context, (table) => table.labelMedium, color: color);

/// A repository's description: prose, but still part of a page that is scanned.
///
/// It sits at the body role rather than at the reading body's roomier line,
/// because the title above it carries the page and the description only says
/// what the repository is for.
TextStyle? gitPulseTypeDescription(BuildContext context) => _typeRow(
  context,
  (table) => table.bodyMedium,
  color: toneTextMuted(context),
);

/// What a field holds: the value a reader typed, or the number one is showing.
///
/// It is the body role in the tone prose is set in — a field is read, not
/// announced — so the platform's own text input keeps the app's type instead of
/// the type the platform would have given it.
TextStyle? gitPulseTypeFieldText(BuildContext context) =>
    _typeRow(context, (table) => table.bodyMedium, color: toneText(context));

/// The reading body of a notes or README document.
///
/// It is a row of the same type table — 15 on a 24 line — so the reading scale is authored in the
/// table the rest of the app's type comes from, instead of in a special case beside it.
TextStyle? gitPulseTypeReadingBody(BuildContext context) =>
    gitPulseTypeTableOf(context).readingBody.toTextStyle();
