import 'package:flutter/material.dart';

import 'gitpulse_tokens.dart';

/// The one gutter every Settings surface shares: a setting's label, its
/// control, and the space around a card all start here.
const gitPulseSettingsGutter = GitPulseSpace.gutter;

/// The weight and size a setting's name is written in: the app's row-label
/// role, so a setting and a Follows row's repository name read as the same kind
/// of name.
TextStyle? gitPulseSettingLabelStyle(BuildContext context) =>
    gitPulseTypeRowLabel(context);

/// The height one line of a setting's name takes at the reader's text scale:
/// the type role's size as the reader scales it, times the role's line height.
double _labelLineHeight(BuildContext context) {
  final style = gitPulseSettingLabelStyle(context);
  final size = style?.fontSize;
  final height = style?.height;
  if (size == null || height == null) return 0;
  return MediaQuery.textScalerOf(context).scale(size) * height;
}

/// What stands on a line of a card beside its name.
///
/// A card is padded to the line it draws, so it has to know what that line is:
/// text alone, a fixed icon target, or a labelled control whose own label grows
/// the target with the reader's text.
enum GitPulseSettingLineControl {
  /// Nothing but the name and its mark.
  none,

  /// Icon actions: their target is the compact control height at every text
  /// size, because an icon does not grow with the reader's text.
  icons,

  /// A control with a label: its label grows with the reader's text, so the
  /// target grows past the compact height once the text does.
  labelled,
}

/// The height a labelled control stands at on a Settings line.
///
/// A card states its line and the control on it is drawn to that line, so the
/// two agree by construction: the control takes
/// [GitPulseHeight.inlineControl], or its own label's line when large text makes
/// that taller. The card is then padded to a line the control actually fills
/// (ADR 0040).
double _labelledControlHeight(BuildContext context) {
  final line = gitPulseTypeControlLineHeight(context);
  return line > GitPulseHeight.inlineControl
      ? line
      : GitPulseHeight.inlineControl;
}

/// The height one line of a card takes, by what stands on it.
double _lineHeight(BuildContext context, GitPulseSettingLineControl control) {
  final line = _labelLineHeight(context);
  final target = switch (control) {
    GitPulseSettingLineControl.none => line,
    GitPulseSettingLineControl.icons => GitPulseHeight.compact,
    GitPulseSettingLineControl.labelled => _labelledControlHeight(context),
  };
  return target > line ? target : line;
}

/// The part of a line's control target that stands above the name: half the
/// difference between the line and the name's own line, never less than zero
/// and never more than the card's own inset.
///
/// It is the one place the overhang is bounded, so a line's edge is simply the
/// card's inset minus this value and never needs clamping again: a line tall
/// enough to fill the target gives up nothing, and one so short that half the
/// target would stand above more than the inset gives up the inset itself
/// rather than pushing the name over the card's edge.
double _overhang(BuildContext context, GitPulseSettingLineControl control) {
  final overhang =
      (_lineHeight(context, control) - _labelLineHeight(context)) / 2;
  return overhang.clamp(0, GitPulseSpace.surfaceInset).toDouble();
}

/// The rounded surface every Settings card shares.
///
/// The fill, the corner, and the edge are the same roles a Timeline card uses,
/// so a settings card cannot grow a private palette. The card is not itself a
/// button: the control inside it is what answers a press.
///
/// A card states what stands on its first line ([GitPulseSettingLineControl]),
/// because that line decides how tall the line is and where the name sits on it.
/// A line that holds a control is taller than the name, and the name is centred
/// in it: the name is placed on the card's own inset by giving up the part of
/// the target that stands off it ([GitPulseSettingLabelLine] puts it back), and
/// the card still ends a surface inset under whatever it draws last. A card made
/// of that line alone ([firstLineOnly]) has no name below to line up with, so it
/// keeps its ordinary inset on both edges and lets the name ride centred on its
/// control: the card, the name and the control then share one centre line, and
/// the card does not end up pressed shut on its own button. The overhang is
/// derived from the line at the reader's text scale, never chosen, and it is
/// bounded where it is derived — never below zero, so a text scale large enough
/// to fill the target keeps the ordinary inset.
class GitPulseSettingSurface extends StatelessWidget {
  const GitPulseSettingSurface({
    super.key,
    required this.child,
    this.firstLine = GitPulseSettingLineControl.none,
    this.firstLineOnly = false,
  });

  final Widget child;

  /// What stands on the card's first line beside its name.
  final GitPulseSettingLineControl firstLine;

  /// Whether the first line is the whole card: no address, no control and no
  /// note under it.
  ///
  /// Such a card is padded to its line on both edges rather than giving up the
  /// overhang at the top, because there is no line of text under the control to
  /// which the name could be levelled.
  final bool firstLineOnly;

  @override
  Widget build(BuildContext context) {
    final top = firstLineOnly
        ? GitPulseSpace.surfaceInset
        : GitPulseSpace.surfaceInset - _overhang(context, firstLine);
    return DecoratedBox(
      decoration: BoxDecoration(
        // A block within the page, read by the job it does rather than by a
        // Material step's name.
        color: toneSurfaceMuted(context),
        borderRadius: BorderRadius.circular(GitPulseRadius.surface),
        border: Border.all(
          color: toneEdge(Theme.of(context).colorScheme),
          width: GitPulseStroke.hairline,
        ),
      ),
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          GitPulseSpace.surfaceInset,
          top,
          GitPulseSpace.surfaceInset,
          GitPulseSpace.surfaceInset,
        ),
        child: child,
      ),
    );
  }
}

/// One child of a Settings card's line, standing in the line the card states
/// for it.
///
/// A card whose line holds a control takes the target's overhang off its own
/// inset (see [GitPulseSettingSurface]), so the line puts that overhang back
/// above the name: the name is centred in a box as tall as the control's
/// target. The mark and the name stand in this box; the control does not,
/// because it is the target the box is stated from.
class GitPulseSettingLabelLine extends StatelessWidget {
  const GitPulseSettingLabelLine({
    super.key,
    required this.control,
    required this.child,
  });

  /// What stands on this line beside the name.
  final GitPulseSettingLineControl control;

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: _lineHeight(context, control),
      child: Align(
        alignment: AlignmentDirectional.centerStart,
        widthFactor: 1,
        child: child,
      ),
    );
  }
}

/// One setting card: a leading icon, its name, the control that holds its
/// value, and any state that control reports.
///
/// The icon and the name share a line. The control sits under that line, using
/// the card's width, unless [inlineControl] keeps a short action on the name's
/// line. [aside] is a transient note beside the name, never a description of
/// what the card is for. Failures and confirmations in [notes] sit under the
/// control.
class GitPulseSettingRow extends StatelessWidget {
  const GitPulseSettingRow({
    super.key,
    required this.icon,
    required this.label,
    required this.control,
    this.aside,
    this.inlineControl = false,
    this.notes = const [],
  });

  final IconData icon;
  final String label;
  final Widget control;
  final Widget? aside;

  /// Puts [control] on the name's line, at the trailing edge. The card then
  /// states that line as one holding a control, so a card whose only line this
  /// is is padded to it on both edges, and its control is drawn to the line's
  /// own measure ([GitPulseSettingSurface.firstLineOnly]).
  final bool inlineControl;

  final List<Widget> notes;

  @override
  Widget build(BuildContext context) {
    final name = Text(
      label,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: gitPulseSettingLabelStyle(context),
    );
    final mark = ExcludeSemantics(
      child: Icon(
        icon,
        size: GitPulseIconSize.inline,
        color: toneTextMuted(context),
      ),
    );
    // A control on the name's line makes that line as tall as its target, so the
    // name and its mark stand in the line's own box; everything else keeps the
    // one line it always had.
    Widget onLabelLine(Widget child) => inlineControl
        ? GitPulseSettingLabelLine(
            control: GitPulseSettingLineControl.labelled,
            child: child,
          )
        : child;
    return GitPulseSettingSurface(
      firstLine: inlineControl
          ? GitPulseSettingLineControl.labelled
          : GitPulseSettingLineControl.none,
      // A row with no note under it is the whole card: its name line is all the
      // card draws, so the card is padded to that line rather than to a name
      // that would have nothing under it to line up with.
      firstLineOnly: inlineControl && notes.isEmpty,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            // The name's box is the line, and the control stands in the same
            // line: centring both is what keeps a control that is shorter than
            // the line (a label's own line at large text) on the name's centre.
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              onLabelLine(mark),
              const SizedBox(width: GitPulseSpace.inline),
              if (inlineControl)
                Expanded(child: onLabelLine(name))
              else
                Flexible(child: onLabelLine(name)),
              if (aside != null) ...[
                const SizedBox(width: GitPulseSpace.inline),
                onLabelLine(aside!),
              ],
              if (inlineControl) ...[
                const SizedBox(width: GitPulseSpace.inline),
                control,
              ],
            ],
          ),
          if (!inlineControl) ...[
            const SizedBox(height: GitPulseSpace.inline),
            control,
          ],
          for (final note in notes) ...[
            const SizedBox(height: GitPulseSpace.tight),
            note,
          ],
        ],
      ),
    );
  }
}

/// Whether a [GitPulseSettingNote] reports a failure or ordinary state.
enum GitPulseSettingNoteTone { muted, error }

/// One line of state under a setting's control: what the last save did, or what
/// stopped it. It is never a description of the setting above it — the control
/// and its label already say that.
class GitPulseSettingNote extends StatelessWidget {
  const GitPulseSettingNote(
    this.text, {
    super.key,
    this.tone = GitPulseSettingNoteTone.muted,
    this.liveRegion = false,
  });

  final String text;
  final GitPulseSettingNoteTone tone;

  /// Announce this line when it appears: a failure or a confirmation arrives on
  /// its own, while ordinary state is only found by reading.
  final bool liveRegion;

  @override
  Widget build(BuildContext context) {
    final text = Text(
      this.text,
      // The type table's meta role, in the tone the line's state asks for: a
      // note that reports a failure is the danger tone, ordinary state is the
      // muted one.
      style: gitPulseTypeMeta(context)?.copyWith(
        color: tone == GitPulseSettingNoteTone.error
            ? toneDanger(context)
            : toneTextMuted(context),
      ),
    );
    if (!liveRegion) return text;
    return Semantics(liveRegion: true, child: text);
  }
}

/// The hairline that separates one band of an account gate from the next.
///
/// Inset to the gutter the gate shares. A band that spans its surface edge to
/// edge passes `indent: 0`.
class GitPulseSettingsDivider extends StatelessWidget {
  const GitPulseSettingsDivider({
    super.key,
    this.indent = gitPulseSettingsGutter,
  });

  final double indent;

  @override
  Widget build(BuildContext context) => Divider(
    height: GitPulseStroke.hairline,
    thickness: GitPulseStroke.hairline,
    indent: indent,
    endIndent: indent,
    // A separator inside a surface takes the rule tone, which is lighter than
    // a card's edge.
    color: toneRule(Theme.of(context).colorScheme),
  );
}
