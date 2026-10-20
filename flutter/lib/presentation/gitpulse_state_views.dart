import 'package:flutter/material.dart';

/// A page that has nothing to show yet: one progress indicator announced to
/// assistive technology with the page's own action label.
class GitPulseLoadingView extends StatelessWidget {
  const GitPulseLoadingView({super.key, required this.label});

  final String label;

  @override
  Widget build(BuildContext context) => Center(
    child: Semantics(
      label: label,
      liveRegion: true,
      child: const CircularProgressIndicator(),
    ),
  );
}

/// Whether a [GitPulseMessageView] reports a failure or an ordinary empty page.
enum GitPulseMessageTone { neutral, error }

/// The shared empty/error surface: one icon, title, optional detail, and one
/// recovery action, so every feature slice states these conditions alike.
class GitPulseMessageView extends StatelessWidget {
  const GitPulseMessageView({
    super.key,
    required this.icon,
    required this.title,
    this.description,
    this.hint,
    this.tone = GitPulseMessageTone.neutral,
    this.liveRegion = false,
    this.inline = false,
    this.action,
  });

  final IconData icon;
  final String title;
  final String? description;
  final String? hint;
  final GitPulseMessageTone tone;

  /// Announce [description] when it replaces the page content, as a failure
  /// does; empty pages are only discovered by reading.
  final bool liveRegion;

  /// Render only the message column, for a failure inside a surface that is
  /// already scrollable.
  final bool inline;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final muted = theme.textTheme.bodyMedium?.copyWith(
      color: theme.colorScheme.onSurfaceVariant,
    );
    Widget? detail;
    if (description case final description?) {
      final text = Text(description, textAlign: TextAlign.center, style: muted);
      detail = liveRegion ? Semantics(liveRegion: true, child: text) : text;
    }
    final content = Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          icon,
          size: 32,
          color: tone == GitPulseMessageTone.error
              ? theme.colorScheme.error
              : theme.colorScheme.primary,
        ),
        const SizedBox(height: 12),
        Text(title, style: theme.textTheme.titleMedium),
        if (detail != null) ...[const SizedBox(height: 6), detail],
        if (hint case final hint?) ...[
          const SizedBox(height: 6),
          Text(
            hint,
            textAlign: TextAlign.center,
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
        ],
        if (action case final action?) ...[const SizedBox(height: 12), action],
      ],
    );
    if (inline) return content;
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: content,
      ),
    );
  }
}
