import 'package:flutter/material.dart';

import '../l10n/generated/app_localizations.dart';
import 'timeline_date_labels.dart';
import 'timeline_models.dart';

/// One release card in a date group of the Release Timeline.
///
/// Opening release details belongs to the release-drawer slice, so the card is
/// readable but not yet interactive.
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

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        border: Border.all(color: theme.dividerColor),
        borderRadius: BorderRadius.circular(12),
        color: scheme.surfaceContainerLow,
      ),
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
                timelineTimeLabel(context, item.publishedAt.toLocal()),
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
              Text(l10n.timelineAssetCount(item.assetCount), style: muted),
              if (item.isOldestShown)
                Text(l10n.timelineOldestShown, style: muted),
            ],
          ),
        ],
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
        color: scheme.surfaceContainerHighest,
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
