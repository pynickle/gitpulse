import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_formatting.dart';
import '../presentation/gitpulse_tokens.dart';
import '../releases/release_drawer.dart';
import 'timeline_cache.dart';
import 'timeline_models.dart';

/// One release card in a date group of the Release Timeline.
///
class ReleaseTimelineCard extends ConsumerWidget {
  const ReleaseTimelineCard({super.key, required this.item});

  final TimelineRelease item;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final now = ref.watch(timelineClockProvider)();
    final muted = theme.textTheme.bodySmall?.copyWith(
      color: scheme.onSurfaceVariant,
    );

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(GitPulseRadius.surface),
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
            // The card's own boundary, so it takes the edge tone rather than
            // the rule tone its contents use.
            border: Border.all(
              color: toneEdge(scheme),
              width: GitPulseStroke.hairline,
            ),
            borderRadius: BorderRadius.circular(GitPulseRadius.surface),
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
                    Tooltip(
                      message: gitPulseDateTime(
                        context,
                        item.publishedAt.toLocal(),
                      ),
                      triggerMode: TooltipTriggerMode.longPress,
                      child: Text(
                        gitPulseRelativeTime(
                          context,
                          item.publishedAt,
                          now: now,
                        ),
                        style: theme.textTheme.labelSmall?.copyWith(
                          color: scheme.onSurfaceVariant,
                        ),
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
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        ExcludeSemantics(
                          child: Icon(
                            Icons.attach_file,
                            size: GitPulseIconSize.inline,
                            color: scheme.onSurfaceVariant,
                          ),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          l10n.timelineAssetCount(item.assetCount),
                          style: muted,
                        ),
                      ],
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
        // A line inside the card, so it takes the rule tone at the one width
        // the app draws.
        border: Border.all(
          color: toneRule(scheme),
          width: GitPulseStroke.hairline,
        ),
        borderRadius: BorderRadius.circular(GitPulseRadius.row),
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
