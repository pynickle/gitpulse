import 'package:flutter/material.dart';

import 'gitpulse_tokens.dart';

/// The one icon-only action a row offers: a mark inside a compact target, named
/// by its tooltip rather than by text beside it.
///
/// A followed repository's action is [emphasized], in the accent colour, so a
/// list answers "what am I already following" before a row is read; everything
/// else stays muted so the action never competes with the name it belongs to.
class GitPulseIconAction extends StatelessWidget {
  const GitPulseIconAction({
    super.key,
    required this.tooltip,
    required this.icon,
    required this.onPressed,
    this.emphasized = false,
  });

  final String tooltip;
  final IconData icon;
  final VoidCallback? onPressed;
  final bool emphasized;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return IconButton(
      tooltip: tooltip,
      onPressed: onPressed,
      iconSize: GitPulseIconSize.action,
      visualDensity: VisualDensity.compact,
      padding: const EdgeInsets.all(GitPulseSpace.inline),
      // A square compact target: the mark stays a 20dp glyph while the button
      // keeps the touch area a row's action needs.
      constraints: const BoxConstraints(
        minWidth: GitPulseHeight.compact,
        minHeight: GitPulseHeight.compact,
      ),
      color: emphasized ? scheme.primary : scheme.onSurfaceVariant,
      icon: Icon(icon),
    );
  }
}
