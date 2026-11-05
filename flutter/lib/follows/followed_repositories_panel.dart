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
                // Detailed View's details arrive after the follow set, so its
                // mark breathes while they do rather than leaving the wait
                // unstated. The action keeps its name and its press (ADR 0047).
                icon: _FollowedViewBreath(
                  breathing: detailed && state.metadataPending,
                  child: _FollowedViewIcon(detailed: detailed),
                ),
              ),
              GitPulseIconButton(
                label: l10n.followsReload,
                onPressed: state.loading || disabled ? null : facade.reload,
                // The control that asked for the read states it, the way the
                // Timeline's own reload control does: while the follow set is
                // being read its mark is the app's inline progress, and
                // nothing is added under the header, so only one indicator is
                // ever on screen and the list never moves (ADR 0047).
                icon: state.loading
                    ? const GitPulseProgressInline()
                    : const Icon(Icons.refresh),
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
                                saving: state.editing(repo.id),
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

/// How strong the panel's view mark stays while it breathes.
///
/// It never reaches nothing: the mark is still the picture of what the control
/// does, so the breath is a change of strength, not a disappearance.
const _followedViewFaintOpacity = 0.55;

/// Breathes [child] while [breathing], and holds it at full strength otherwise.
///
/// Detailed View's description, language and star count arrive after the follow
/// set, so the wait belongs to the mark of the control that asked for them: it
/// breathes in place, on the app's own progress turn, and gains no second
/// indicator, no row and no name (ADR 0047). The control around this mark is
/// never disabled and never renamed: the motion is a visual cue, and the action
/// keeps working at the moment it moves.
class _FollowedViewBreath extends StatefulWidget {
  const _FollowedViewBreath({required this.breathing, required this.child});

  /// Whether a detail read is still arriving.
  final bool breathing;

  final Widget child;

  @override
  State<_FollowedViewBreath> createState() => _FollowedViewBreathState();
}

class _FollowedViewBreathState extends State<_FollowedViewBreath>
    with SingleTickerProviderStateMixin {
  /// One round trip of the opacity, on the period the app's own progress
  /// indicator turns with, so waiting reads the same wherever it is stated.
  late final AnimationController _turn = AnimationController(
    vsync: this,
    duration: gitPulseProgressTurn,
  );

  /// Full to faint and back, eased at both ends so the breath has no corner.
  late final Animation<double> _opacity = TweenSequence<double>([
    TweenSequenceItem(
      tween: Tween<double>(
        begin: 1,
        end: _followedViewFaintOpacity,
      ).chain(CurveTween(curve: Curves.easeInOut)),
      weight: 1,
    ),
    TweenSequenceItem(
      tween: Tween<double>(
        begin: _followedViewFaintOpacity,
        end: 1,
      ).chain(CurveTween(curve: Curves.easeInOut)),
      weight: 1,
    ),
  ]).animate(_turn);

  bool _breathing = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _syncBreath();
  }

  @override
  void didUpdateWidget(covariant _FollowedViewBreath oldWidget) {
    super.didUpdateWidget(oldWidget);
    _syncBreath();
  }

  /// Starts or stops the turn for the state this frame is built in.
  ///
  /// A reader who turned animation off is the reason this is decided here: the
  /// mark is drawn at full strength and no controller is left running behind
  /// it.
  void _syncBreath() {
    final breathing =
        widget.breathing && !MediaQuery.disableAnimationsOf(context);
    if (breathing == _breathing) return;
    _breathing = breathing;
    if (breathing) {
      _turn.repeat();
    } else {
      _turn.stop();
    }
  }

  @override
  void dispose() {
    _turn.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: _turn,
    child: widget.child,
    builder: (context, child) =>
        Opacity(opacity: _breathing ? _opacity.value : 1, child: child),
  );
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
