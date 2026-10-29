import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_buttons.dart';
import '../presentation/gitpulse_progress.dart';
import '../presentation/gitpulse_state_views.dart';
import '../device/device_preferences_controller.dart';
import '../presentation/gitpulse_tokens.dart';
import 'followed_repository_view.dart';
import 'release_follows_session.dart';
import 'release_follows_state.dart';
import 'release_follows_widgets.dart';

class FollowedRepositoriesPanel extends ConsumerWidget {
  const FollowedRepositoriesPanel({super.key, this.onClose});
  final VoidCallback? onClose;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(releaseFollowsSessionProvider);
    final view = ref.watch(followedRepositoryViewProvider);
    final facade = ref.read(releaseFollowsSessionProvider.notifier);
    final l10n = AppLocalizations.of(context);
    final disabled = state.editBlocked;
    final detailed = view == FollowedRepositoryView.detailed;
    // A collection read that failed replaces the list. An edit that never
    // started, such as a name the client rejects, is still a notice on the
    // list that is already there.
    final collectionFailed =
        state.problem != null &&
        !state.saveFailed &&
        state.problem != FollowProblem.invalidRepository;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(releaseFollowsPadding, 4, 4, 4),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  l10n.followsCurrent(state.repositories.length),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: gitPulseTypeRowLabel(context),
                ),
              ),
              GitPulseIconButton(
                label: detailed
                    ? l10n.followsViewDetailed
                    : l10n.followsViewCompact,
                onPressed: () => unawaited(
                  ref
                      .read(devicePreferencesProvider.notifier)
                      .selectFollowedRepositoryView(
                        detailed
                            ? FollowedRepositoryView.compact
                            : FollowedRepositoryView.detailed,
                      ),
                ),
                icon: _FollowedViewIcon(detailed: detailed),
              ),
              GitPulseIconButton(
                label: l10n.followsReload,
                onPressed: disabled ? null : facade.reload,
                icon: const Icon(Icons.refresh),
              ),
              if (onClose != null)
                GitPulseIconButton(
                  label: l10n.followsClose,
                  onPressed: onClose,
                  icon: const Icon(Icons.close),
                ),
            ],
          ),
        ),
        if (state.loading || state.saving)
          const Center(child: GitPulseProgressInline()),
        Divider(
          height: GitPulseStroke.hairline,
          thickness: GitPulseStroke.hairline,
          color: toneRule(Theme.of(context).colorScheme),
        ),
        Expanded(
          child: !state.loaded && state.loading
              ? GitPulseLoadingView(label: l10n.followsLoading)
              : collectionFailed
              ? _FollowedLoadFailure(
                  problem: state.problem!,
                  onRetry: disabled ? null : facade.reload,
                )
              : CustomScrollView(
                  primary: false,
                  slivers: [
                    if (state.problem != null)
                      SliverToBoxAdapter(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            FollowProblemNotice(
                              text: followProblemLabel(
                                l10n,
                                state.problem,
                                save: state.saveFailed,
                              ),
                            ),
                            if (!state.saveFailed)
                              Padding(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: releaseFollowsPadding,
                                ),
                                child: GitPulseButton(
                                  label: l10n.timelineRetry,
                                  onPressed: disabled ? null : facade.reload,
                                ),
                              ),
                          ],
                        ),
                      ),
                    if (state.metadataProblem != null)
                      SliverToBoxAdapter(
                        child: FollowProblemNotice(
                          text: l10n.followsLookupFailed,
                        ),
                      ),
                    if (state.loaded && state.repositories.isEmpty)
                      SliverFillRemaining(
                        hasScrollBody: false,
                        child: GitPulseMessageView(
                          icon: Icons.bookmarks_outlined,
                          title: l10n.followsEmpty,
                        ),
                      )
                    else
                      SliverList.builder(
                        itemCount: state.repositories.length,
                        itemBuilder: (context, index) {
                          final repo = state.repositories[index];
                          return Column(
                            children: [
                              FollowedRepositoryCard(
                                key: ValueKey('followed-${repo.id}'),
                                repository: repo,
                                detailed: detailed,
                                status: state.statuses[repo.id],
                                details: state.details[repo.id],
                                enabled: !disabled,
                                onUnfollow: () => facade.unfollow(repo.id),
                                onRetry: () =>
                                    facade.loadMetadata(repositoryId: repo.id),
                              ),
                              if (index < state.repositories.length - 1)
                                const FollowRowDivider(),
                            ],
                          );
                        },
                      ),
                  ],
                ),
        ),
      ],
    );
  }
}

/// The collection could not be read. It fills the space under the header the
/// way every other page states a failed load: one icon, the reason, and one
/// retry. The confirmed list stays in the session, so Timeline does not treat a
/// failed refresh as an empty account, and it is not drawn here.
class _FollowedLoadFailure extends StatelessWidget {
  const _FollowedLoadFailure({required this.problem, required this.onRetry});

  final FollowProblem problem;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final network = problem == FollowProblem.network;
    return GitPulseMessageView(
      icon: network ? Icons.cloud_off_outlined : Icons.error_outline,
      tone: followProblemTone(problem),
      title: followProblemLabel(l10n, problem),
      liveRegion: true,
      action: GitPulseButton(
        label: l10n.timelineRetry,
        variant: GitPulseButtonVariant.tonal,
        onPressed: onRetry,
      ),
    );
  }
}

/// Three short lines for Compact View, or those lines plus a paragraph for
/// Detailed View. The button's name says the view; the words are not text.
class _FollowedViewIcon extends StatelessWidget {
  const _FollowedViewIcon({required this.detailed});

  final bool detailed;

  @override
  Widget build(BuildContext context) {
    // The mark takes the ink of whatever control holds it; a control that sets
    // no icon theme at all still gets the app's own text tone.
    final color = IconTheme.of(context).color ?? toneText(context);
    return CustomPaint(
      size: const Size(24, 24),
      painter: _FollowedViewIconPainter(color: color, detailed: detailed),
    );
  }
}

class _FollowedViewIconPainter extends CustomPainter {
  const _FollowedViewIconPainter({required this.color, required this.detailed});

  final Color color;
  final bool detailed;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeCap = StrokeCap.round
      ..strokeWidth = 1.6;
    if (!detailed) {
      for (var index = 0; index < 3; index++) {
        final y = 6.0 + index * 6;
        canvas.drawLine(Offset(4, y), Offset(20, y), paint);
      }
      return;
    }
    canvas.drawLine(const Offset(4, 5), const Offset(14, 5), paint);
    canvas.drawLine(const Offset(4, 10), const Offset(14, 10), paint);
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        const Rect.fromLTWH(4, 14, 16, 6),
        const Radius.circular(1),
      ),
      Paint()..color = color,
    );
  }

  @override
  bool shouldRepaint(covariant _FollowedViewIconPainter oldDelegate) =>
      oldDelegate.color != color || oldDelegate.detailed != detailed;
}
