import 'package:flutter/material.dart';

import 'gitpulse_tokens.dart';

/// The one gutter every Settings surface shares: a setting's label, its
/// control, and the hairline between two settings all start here.
const gitPulseSettingsGutter = GitPulseSpace.gutter;

/// The width at which a setting's label earns a column of its own.
///
/// Below it the label sits above its control instead: a column wide enough to
/// hold a label unbroken would leave a phone's control too little room to be
/// read, and a column narrow enough to fit would break every long label in two.
const _labelColumnMinimumWidth = 520.0;

/// The label column's width at the reader's text scale.
///
/// One width for every row on the page, so each control starts at the same x
/// down the list however long its own label is.
double gitPulseSettingLabelWidth(BuildContext context) =>
    MediaQuery.textScalerOf(context).scale(140);

/// The weight and size a setting's name is written in: the app's row-label
/// role, so a setting and a Follows row's repository name read as the same kind
/// of table.
TextStyle? gitPulseSettingLabelStyle(BuildContext context) =>
    gitPulseTypeRowLabel(context);

/// How far a label is nudged down to sit on the line of a control beside it: a
/// chip row is shorter than a text field, so this centres against neither
/// exactly, which is why it is small enough to read as aligned either way.
const _labelBaselineNudge = 6.0;

/// One setting: its name, the control that holds its value, and any state that
/// control reports.
///
/// The name and the control share one line whenever the window offers room for
/// both, and the name keeps a fixed column so the controls down the page line
/// up. A control reports its own failures and confirmations through [notes],
/// which sit under it rather than beside it: the value stays where the reader
/// left it, and the explanation arrives where they are looking.
class GitPulseSettingRow extends StatelessWidget {
  const GitPulseSettingRow({
    super.key,
    required this.label,
    required this.control,
    this.notes = const [],
  });

  final String label;
  final Widget control;
  final List<Widget> notes;

  @override
  Widget build(BuildContext context) {
    final name = Text(label, style: gitPulseSettingLabelStyle(context));
    final controls = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        control,
        for (final note in notes) ...[const SizedBox(height: 6), note],
      ],
    );
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        gitPulseSettingsGutter,
        12,
        gitPulseSettingsGutter,
        12,
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          if (constraints.maxWidth < _labelColumnMinimumWidth) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [name, const SizedBox(height: 8), controls],
            );
          }
          return Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: gitPulseSettingLabelWidth(context),
                child: Padding(
                  padding: const EdgeInsets.only(top: _labelBaselineNudge),
                  child: name,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(child: controls),
            ],
          );
        },
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
    final theme = Theme.of(context);
    final text = Text(
      this.text,
      style: theme.textTheme.bodySmall?.copyWith(
        color: tone == GitPulseSettingNoteTone.error
            ? theme.colorScheme.error
            : theme.colorScheme.onSurfaceVariant,
      ),
    );
    if (!liveRegion) return text;
    return Semantics(liveRegion: true, child: text);
  }
}

/// The hairline that separates one band of a Settings surface from the next.
///
/// Inset to the gutter the rows share, so a page of settings reads as one table
/// instead of a stack of bands. A band that spans its surface edge to edge — the
/// account's own header — passes `indent: 0`, so the rule it draws is the only
/// one on the page that touches both edges.
class GitPulseSettingsDivider extends StatelessWidget {
  const GitPulseSettingsDivider({
    super.key,
    this.indent = gitPulseSettingsGutter,
  });

  final double indent;

  @override
  Widget build(BuildContext context) => Divider(
    height: 1,
    thickness: 1,
    indent: indent,
    endIndent: indent,
    color: Theme.of(context).dividerColor,
  );
}
