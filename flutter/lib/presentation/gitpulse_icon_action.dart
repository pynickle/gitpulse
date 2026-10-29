import 'package:flutter/material.dart';

import 'gitpulse_buttons.dart';

/// The one icon-only action a row offers: a mark inside a full touch target,
/// named by its tooltip rather than by text beside it.
///
/// It is the app's own icon button with the arguments a row hands it, so a
/// Follows row, a Followed Repository row and the Repository page's action row
/// cannot draw three versions of the same control (ADR 0032). A followed
/// repository's action is [emphasized], in the Accent, so a list answers "what
/// am I already following" before a row is read; everything else stays muted so
/// the action never competes with the name it belongs to.
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
  Widget build(BuildContext context) => GitPulseIconButton(
    tooltip: tooltip,
    icon: Icon(icon),
    onPressed: onPressed,
    emphasized: emphasized,
  );
}
