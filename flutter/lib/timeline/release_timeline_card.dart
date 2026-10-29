import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_formatting.dart';
import '../presentation/gitpulse_status_badge.dart';
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
    final scheme = Theme.of(context).colorScheme;
    final now = ref.watch(timelineClockProvider)();
    final meta = gitPulseTypeMeta(context);
    final relative = gitPulseRelativeTime(context, item.publishedAt, now: now);

    return Material(
      color: GitPulsePaint.none,
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
            color: toneSurfaceMuted(context),
          ),
          child: Container(
            padding: const EdgeInsets.all(GitPulseSpace.surfaceInset),
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
                        style: gitPulseTypeRepositoryName(context),
                      ),
                    ),
                    const SizedBox(width: GitPulseSpace.inline),
                    // The card says how long ago the release landed, and the
                    // instant it landed at is the one fact those words leave
                    // out: a screen reader hears both, in place of the hint a
                    // long press used to raise over the card.
                    Semantics(
                      label:
                          '$relative '
                          '${gitPulseDateTime(context, item.publishedAt.toLocal())}',
                      child: ExcludeSemantics(
                        child: Text(
                          relative,
                          style: gitPulseTypeMetaTight(context),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: GitPulseSpace.tight),
                Wrap(
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: GitPulseSpace.inline,
                  runSpacing: GitPulseSpace.glyphGap,
                  children: [
                    Text(item.title, style: gitPulseTypeSurfaceTitle(context)),
                    if (item.isPrerelease)
                      GitPulseStatusBadge(
                        icon: Icons.science_outlined,
                        label: l10n.timelinePrerelease,
                      ),
                  ],
                ),
                if (item.changelog.isNotEmpty) ...[
                  const SizedBox(height: GitPulseSpace.tight),
                  Text(
                    item.changelog,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: meta,
                  ),
                ],
                const SizedBox(height: GitPulseSpace.meta),
                Wrap(
                  spacing: 12,
                  runSpacing: GitPulseSpace.glyphGap,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        ExcludeSemantics(
                          child: Icon(
                            Icons.attach_file,
                            size: GitPulseIconSize.inline,
                            color: toneTextMuted(context),
                          ),
                        ),
                        const SizedBox(width: GitPulseSpace.glyphGap),
                        Text(
                          l10n.timelineAssetCount(item.assetCount),
                          style: meta,
                        ),
                      ],
                    ),
                    if (item.isOldestShown)
                      Text(l10n.timelineOldestShown, style: meta),
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
