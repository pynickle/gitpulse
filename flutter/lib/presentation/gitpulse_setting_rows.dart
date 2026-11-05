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

/// The height a first line takes when its control shares it with the name: the
/// compact control target, or the name's own line when large text fills that
/// target already.
double _labelLineBoxHeight(BuildContext context) {
  final line = _labelLineHeight(context);
  return line > GitPulseHeight.compact ? line : GitPulseHeight.compact;
}

/// The part of a first line's control target that stands above the name: half
/// of the compact target minus the name's line, never less than zero.
double _labelOverhang(BuildContext context) {
  final overhang = (GitPulseHeight.compact - _labelLineHeight(context)) / 2;
  return overhang > 0 ? overhang : 0;
}

/// The rounded surface every Settings card shares.
///
/// The fill, the corner, and the edge are the same roles a Timeline card uses,
/// so a settings card cannot grow a private palette. The card is not itself a
/// button: the control inside it is what answers a press.
///
/// A card whose first line also holds its control states that with
/// [firstLineHoldsControl]. The line is then as tall as the control's touch
/// target and the name inside it is centred, which would leave the name half
/// that difference under the card's own inset while every card whose first line
/// is text alone starts at it. The name sits on the card's inset whatever stands
/// beside it, and the control keeps its whole target: the card gives up the part
/// of the target that stands above the name instead. That overhang is derived
/// from the name's type role at the reader's text scale, never chosen, and it
/// clamps at zero — a text scale large enough to fill the target keeps the
/// ordinary inset. The line's name and mark stand in a
/// [GitPulseSettingLabelLine], which puts the overhang back above the name.
class GitPulseSettingSurface extends StatelessWidget {
  const GitPulseSettingSurface({
    super.key,
    required this.child,
    this.firstLineHoldsControl = false,
  });

  final Widget child;

  /// Whether the card's first line also holds its control, so the line is as
  /// tall as the control's target rather than as the name alone.
  final bool firstLineHoldsControl;

  @override
  Widget build(BuildContext context) {
    final top = firstLineHoldsControl
        ? GitPulseSpace.surfaceInset - _labelOverhang(context)
        : GitPulseSpace.surfaceInset;
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
          top > 0 ? top : 0,
          GitPulseSpace.surfaceInset,
          GitPulseSpace.surfaceInset,
        ),
        child: child,
      ),
    );
  }
}

/// One child of a Settings card's first line, standing in the line the card's
/// control target gives it.
///
/// A card whose first line also holds its control takes the target's overhang
/// off its top inset (see [GitPulseSettingSurface.firstLineHoldsControl]), so
/// the line puts that overhang back above the name: the name is centred in a box
/// as tall as the compact target, and large text — which fills the target on its
/// own — keeps its own line instead. The mark and the name stand in this box;
/// the control does not, because it is the target the box is stated from.
class GitPulseSettingLabelLine extends StatelessWidget {
  const GitPulseSettingLabelLine({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: _labelLineBoxHeight(context),
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
  /// states the line's own top inset, so the name starts on the card's inset
  /// beside a control that keeps its whole target
  /// ([GitPulseSettingSurface.firstLineHoldsControl]).
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
    Widget onLabelLine(Widget child) =>
        inlineControl ? GitPulseSettingLabelLine(child: child) : child;
    return GitPulseSettingSurface(
      firstLineHoldsControl: inlineControl,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: inlineControl
                ? CrossAxisAlignment.start
                : CrossAxisAlignment.center,
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
