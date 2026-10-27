import 'package:flutter/material.dart';

import 'gitpulse_tokens.dart';

/// Someone's GitHub avatar, at the size the surface that introduces them gives
/// it.
///
/// The picture is decoration: every surface that draws one writes the identity
/// it belongs to beside it, so a screen reader hears the name once instead of
/// the image's own label. A missing or unloadable picture falls back to the same
/// silhouette, so a reader still sees a face-sized hole where the identity is.
class GitPulseAvatar extends StatelessWidget {
  const GitPulseAvatar({super.key, required this.url, required this.size});

  final String? url;
  final double size;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final fallback = ColoredBox(
      color: scheme.surfaceContainerHighest,
      child: Icon(
        Icons.person_outline,
        size: GitPulseIconSize.action,
        color: scheme.onSurfaceVariant,
      ),
    );
    final source = url?.trim() ?? '';
    return ExcludeSemantics(
      child: SizedBox.square(
        dimension: size,
        child: ClipOval(
          child: source.isEmpty
              ? fallback
              : Image.network(
                  source,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) => fallback,
                ),
        ),
      ),
    );
  }
}
