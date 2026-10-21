import 'package:flutter/material.dart';

import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_formatting.dart';
import '../releases/release_drawer.dart';
import 'timeline_models.dart';

/// One release card in a date group of the Release Timeline.
///
class ReleaseTimelineCard extends StatelessWidget {
  const ReleaseTimelineCard({super.key, required this.item});

  final TimelineRelease item;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final muted = theme.textTheme.bodySmall?.copyWith(
      color: scheme.onSurfaceVariant,
    );

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => showReleaseDrawer(context, (
          owner: item.repository.owner,
          repository: item.repository.name,
          id: item.id,
          tag: null,
        )),
        // The surface is painted as ink rather than as a child container: a
        // container's own colour would cover the press and hover tint, and a
        // card that answers a press with nothing reads as unresponsive.
        child: Ink(
          decoration: BoxDecoration(
            border: Border.all(color: theme.dividerColor),
            borderRadius: BorderRadius.circular(12),
            color: scheme.surfaceContainerLow,
          ),
          child: Container(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        item.repository.fullName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.labelMedium?.copyWith(
                          color: scheme.primary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      gitPulseInstant(context, item.publishedAt.toLocal()),
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: scheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Wrap(
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: 8,
                  runSpacing: 4,
                  children: [
                    Text(
                      item.title,
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (item.isPrerelease)
                      _PrereleaseBadge(label: l10n.timelinePrerelease),
                  ],
                ),
                if (item.changelog.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(
                    item.changelog,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: scheme.onSurfaceVariant,
                    ),
                  ),
                ],
                const SizedBox(height: 10),
                Wrap(
                  spacing: 12,
                  runSpacing: 4,
                  children: [
                    Text(
                      l10n.timelineAssetCount(item.assetCount),
                      style: muted,
                    ),
                    if (item.isOldestShown)
                      Text(l10n.timelineOldestShown, style: muted),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _PrereleaseBadge extends StatelessWidget {
  const _PrereleaseBadge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        border: Border.all(color: scheme.outlineVariant, width: 0.5),
        borderRadius: BorderRadius.circular(6),
        // One container step below the press tint, so a pressed card cannot
        // dissolve the badge it holds into its own tone.
        color: scheme.surfaceContainerHigh,
      ),
      child: Text(
        label,
        style: theme.textTheme.labelSmall?.copyWith(
          color: scheme.onSurfaceVariant,
        ),
      ),
    );
  }
}
