import 'package:flutter/material.dart';

import 'gitpulse_tokens.dart';

/// One state of the thing beside it, as a quiet outlined pill: a glyph, a word,
/// and one hairline.
///
/// It is not a control and answers no press, which is why it takes the
/// `surface` radius no control in the app uses — the two pill shapes stay
/// distinguishable even where they sit on one screen — and why its height may
/// fall under [GitPulseHeight.compact] (ADR 0020 carries the rule).
///
/// The words carry the state; nothing here adds a second tone. The glyph is
/// what makes the pill scannable before it is read, so it stands for the state
/// rather than repeating the surface it sits on, and it is excluded from
/// semantics so a screen reader hears the word alone.
class GitPulseStatusBadge extends StatelessWidget {
  const GitPulseStatusBadge({
    super.key,
    required this.icon,
    required this.label,
  });

  final IconData icon;

  /// The state in the reader's language. It is also the pill's whole semantics.
  final String label;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(GitPulseRadius.surface),
        border: Border.all(
          color: toneEdge(scheme),
          width: GitPulseStroke.hairline,
        ),
      ),
      child: Padding(
        // Two, not four: a badge is only as tall as the line it sits on, so a
        // row that has one is not taller than a row that does not.
        padding: const EdgeInsets.symmetric(
          horizontal: GitPulseSpace.inline,
          vertical: GitPulseSpace.nudge,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            ExcludeSemantics(
              child: Icon(
                icon,
                size: GitPulseIconSize.fact,
                color: toneTextMuted(context),
              ),
            ),
            const SizedBox(width: GitPulseSpace.nudge),
            Text(label, style: gitPulseTypeMetaTight(context)),
          ],
        ),
      ),
    );
  }
}
