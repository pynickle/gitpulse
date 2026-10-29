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

/// The rounded surface every Settings card shares.
///
/// The fill, the corner, and the edge are the same roles a Timeline card uses,
/// so a settings card cannot grow a private palette. The card is not itself a
/// button: the control inside it is what answers a press.
class GitPulseSettingSurface extends StatelessWidget {
  const GitPulseSettingSurface({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
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
        padding: const EdgeInsets.all(GitPulseSpace.surfaceInset),
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

  /// Puts [control] on the name's line, at the trailing edge.
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
    return GitPulseSettingSurface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              mark,
              const SizedBox(width: GitPulseSpace.inline),
              if (inlineControl)
                Expanded(child: name)
              else
                Flexible(child: name),
              if (aside != null) ...[
                const SizedBox(width: GitPulseSpace.inline),
                aside!,
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
