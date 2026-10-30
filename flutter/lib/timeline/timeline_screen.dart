import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_buttons.dart';
import '../presentation/gitpulse_formatting.dart';
import '../presentation/gitpulse_state_views.dart';
import '../presentation/gitpulse_pull_to_refresh.dart';
import '../presentation/gitpulse_tokens.dart';
import '../session/session_controller.dart';
import 'release_timeline_card.dart';
import 'timeline_cache.dart';
import 'timeline_filter_panel.dart';
import 'timeline_filters.dart';
import 'timeline_layout.dart';
import 'timeline_session.dart';
import 'timeline_state.dart';
import 'timeline_toolbar.dart';
import '../repositories/repository_models.dart';

/// How long the return-to-top button takes to appear or disappear.
const _returnToTopFade = Duration(milliseconds: 120);

/// The nearby scroll duration and the arrival phase of a distant return, from
/// either the button or a refresh that lands while the reader is further down.
const _returnToTopMove = Duration(milliseconds: 240);

/// How far the floating return-to-top button sits from the edges it floats
/// over, on both axes.
///
/// The page's band spacing rather than the card gutter: at the gutter, the
/// circle's outline lands exactly on the cards' right edge and its glyph
/// exactly on their text edge, so the control reads as the last thing in the
/// column instead of something laid over it.
const _floatingInset = GitPulseSpace.bandGap;

/// Space the list keeps clear below its last row, so the final release and Load
/// older can both scroll fully above the floating button: its inset, its
/// standard height, and the inset again as breathing room.
const _listEndInset = _floatingInset * 2 + GitPulseHeight.standard;

/// Space between two releases stacked in the Timeline's one column.
const _cardSpacing = 12.0;

// Kept in memory across destination widgets, independently of cached releases.
final _readingPositionProvider = Provider((ref) {
  ref.watch(
    sessionControllerProvider.select(
      (state) => (state.phase, state.identity?.account),
    ),
  );
  return _TimelineReadingPosition();
});

class _TimelineReadingPosition {
  ({String releaseKey, double offset})? anchor;
  TimelineFilterState filters = const TimelineFilterState();

  /// Whether a refresh started from this screen is still being read, and
  /// whether the pull gesture is what started it.
  ///
  /// Both outlive the destination widget: leaving the Timeline during a round
  /// and coming back must finish the same way as staying on it.
  bool refreshing = false;
  bool pullRefreshing = false;

  /// How many refreshes have returned usable results. The list reads it to know
  /// that the release being read must give way to the newest ones.
  int landedRefreshes = 0;

  /// Ends a refresh that has stopped loading.
  ///
  /// Usable results replace the window from the top of the current search and
  /// filters. A round that completely failed keeps the release being read, and
  /// the position it was read at, so a slow or failed request never costs the
  /// reader their place.
  void settleRefresh({required bool failed}) {
    refreshing = false;
    pullRefreshing = false;
    if (failed) return;
    anchor = null;
    landedRefreshes++;
  }
}

/// Which entry asked for a round, and so where its progress belongs.
enum _RefreshOrigin {
  /// The toolbar's refresh button, and the footer's reload: the button itself
  /// says the round is being read.
  button,

  /// The pull gesture: the indicator at the top of the list says it instead,
  /// and the button keeps its glyph while staying disabled.
  pull,
}

/// The Release Timeline: published releases of the account's Followed
/// Repositories, grouped by display date, with the shared Timeline Refresh
/// Baseline and its loaded-new count.
class TimelineScreen extends ConsumerStatefulWidget {
  const TimelineScreen({super.key});

  @override
  ConsumerState<TimelineScreen> createState() => _TimelineScreenState();
}

class _TimelineScreenState extends ConsumerState<TimelineScreen> {
  @override
  Widget build(BuildContext context) {
    final state = ref.watch(releaseTimelineSessionProvider);
    final readingPosition = ref.watch(_readingPositionProvider);
    if (readingPosition.refreshing && !state.loading) {
      readingPosition.settleRefresh(failed: state.failure != null);
    }
    if (readingPosition.filters != state.filters) {
      readingPosition.anchor = null;
      readingPosition.filters = state.filters;
    }
    final now = ref.watch(timelineClockProvider)();
    final localDateKey = ref.watch(timelineEnvironmentProvider).localDateKey;

    /// Reads one shared round, from the refresh button or from the pull.
    ///
    /// One round at a time: a second entry is rejected while the first is still
    /// reading, so repeating a gesture or a click never restarts it.
    Future<void> refresh({_RefreshOrigin origin = _RefreshOrigin.button}) {
      if (ref.read(releaseTimelineSessionProvider).loading) {
        return Future<void>.value();
      }
      final round = ref.read(releaseTimelineSessionProvider.notifier).refresh();
      // The session marks itself loading before its first await, so a round
      // that never started has nothing to settle.
      if (!ref.read(releaseTimelineSessionProvider).loading) return round;
      final current = ref.read(_readingPositionProvider);
      current.refreshing = true;
      current.pullRefreshing = origin == _RefreshOrigin.pull;
      return round;
    }

    Future<void> retry() =>
        ref.read(releaseTimelineSessionProvider.notifier).retryFailed();
    Future<void> loadOlder() =>
        ref.read(releaseTimelineSessionProvider.notifier).loadOlder();
    void openFilters() => showTimelineFilterPanel(context);

    return LayoutBuilder(
      builder: (context, constraints) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TimelineToolbar(
            state: state,
            onRefresh: refresh,
            pullRefreshing: readingPosition.pullRefreshing,
            onFiltersChanged: (filters) => ref
                .read(releaseTimelineSessionProvider.notifier)
                .applyFilters(filters),
            onOpenFilters: openFilters,
            onRetryCache: ref
                .read(releaseTimelineSessionProvider.notifier)
                .retryCache,
            onRebuildCache: ref
                .read(releaseTimelineSessionProvider.notifier)
                .rebuildCache,
          ),
          // A round that failed as a whole is reported by its own error, near
          // the releases it kept. Naming repositories here as well would put a
          // second error above the list, and appearing there would move the
          // release the reader is halfway through.
          if (state.hasLookupFailures && state.failure == null)
            ConstrainedBox(
              constraints: BoxConstraints(
                maxHeight: constraints.maxHeight * 0.35,
              ),
              child: SingleChildScrollView(
                child: _LookupFailureBanner(state: state, onRetry: retry),
              ),
            ),
          Expanded(
            child: _Body(
              key: ValueKey(state.filters),
              state: state,
              readingPosition: readingPosition,
              now: now,
              localDateKey: localDateKey,
              onRetry: retry,
              onLoadOlder: loadOlder,
              onRefresh: () => refresh(),
              onPullRefresh: () => refresh(origin: _RefreshOrigin.pull),
            ),
          ),
        ],
      ),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({
    super.key,
    required this.state,
    required this.readingPosition,
    required this.now,
    required this.localDateKey,
    required this.onRefresh,
    required this.onPullRefresh,
    required this.onRetry,
    required this.onLoadOlder,
  });

  final TimelineViewState state;
  final _TimelineReadingPosition readingPosition;
  final DateTime now;
  final String Function(DateTime instant) localDateKey;
  final Future<void> Function() onRefresh;
  final Future<void> Function() onPullRefresh;
  final Future<void> Function() onRetry;
  final Future<void> Function() onLoadOlder;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    if (state.loading && !state.hasExposedReleases) {
      return GitPulseLoadingView(label: l10n.timelineLoading);
    }
    // A failure outranks the no-follows state: a Followed Repository read that
    // failed has not established that the account follows nothing.
    if (state.failure != null && !state.hasExposedReleases) {
      return _FailureState(state: state, onRetry: onRetry);
    }
    if (!state.hasFollows) {
      return GitPulseMessageView(
        icon: Icons.rocket_launch_outlined,
        title: l10n.timelineEmptyTitle,
        description: l10n.timelineEmptyDescription,
        hint: l10n.timelineEmptyFollowsHint,
      );
    }
    if (state.hasReleases) {
      return _TimelineList(
        state: state,
        readingPosition: readingPosition,
        now: now,
        localDateKey: localDateKey,
        landedRefreshes: readingPosition.landedRefreshes,
        onRefresh: onRefresh,
        onPullRefresh: onPullRefresh,
        onRetry: onRetry,
        onLoadOlder: onLoadOlder,
      );
    }
    // No visible releases, but the footer stays so an Active Timeline Filter
    // can never prevent explicitly loading more history. The empty result is
    // still refreshable: a filter that hides everything today can match the
    // releases a new round brings.
    return GitPulsePullToRefresh(
      onRefresh: onPullRefresh,
      child: LayoutBuilder(
        builder: (context, viewport) => SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: SizedBox(
            height: viewport.maxHeight,
            child: Column(
              children: [
                Expanded(
                  child: state.filteredEmpty
                      ? GitPulseMessageView(
                          icon: Icons.filter_alt_off_outlined,
                          title: l10n.timelineFilteredEmptyTitle,
                          description: l10n.timelineFilteredEmptyDescription,
                        )
                      : GitPulseMessageView(
                          icon: Icons.inbox_outlined,
                          title: l10n.timelineEmptyReleasesTitle,
                          description: l10n.timelineEmptyReleasesDescription,
                        ),
                ),
                Padding(
                  padding: const EdgeInsets.all(GitPulseSpace.gutter),
                  child: _StatusFooter(
                    state: state,
                    onRetry: onRetry,
                    onLoadOlder: onLoadOlder,
                    onRefresh: onRefresh,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _FailureState extends StatelessWidget {
  const _FailureState({required this.state, required this.onRetry});

  final TimelineViewState state;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final failure = state.failure;
    final message = switch (failure?.kind) {
      TimelineFailureKind.network => l10n.timelineErrorNetwork,
      TimelineFailureKind.rateLimited => l10n.timelineErrorRateLimited,
      TimelineFailureKind.session => l10n.sessionExpired,
      _ => l10n.timelineErrorServer,
    };

    return GitPulseMessageView(
      icon: Icons.error_outline,
      tone: GitPulseMessageTone.error,
      title: l10n.timelineError,
      description: message,
      liveRegion: true,
      action: failure == null || failure.retryable
          ? GitPulseButton(
              label: l10n.timelineRetry,
              variant: GitPulseButtonVariant.tonal,
              onPressed: state.loading ? null : () => onRetry(),
            )
          : null,
    );
  }
}

class _LookupFailureBanner extends StatelessWidget {
  const _LookupFailureBanner({required this.state, required this.onRetry});

  final TimelineViewState state;
  final Future<void> Function() onRetry;

  static String _names(List<RepositoryReference> repositories) =>
      repositories.map((repository) => repository.fullName).join(', ');

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final wash = toneDangerSoft(context);

    return Container(
      margin: const EdgeInsets.fromLTRB(
        GitPulseSpace.gutter,
        GitPulseSpace.inline,
        GitPulseSpace.gutter,
        0,
      ),
      padding: const EdgeInsets.all(GitPulseSpace.surfaceInset),
      decoration: BoxDecoration(
        // The boundary is the app's edge tone and the ground is the shared danger wash: a border
        // drawn in the same ink as the fill it bounds is not an edge, it is a second wash, and the
        // banner loses the shape that tells it apart from the list it stands over.
        border: Border.all(
          color: toneEdge(Theme.of(context).colorScheme),
          width: GitPulseStroke.hairline,
        ),
        borderRadius: BorderRadius.circular(GitPulseRadius.surface),
        // A banner that reports a failure: the danger tone laid on as a wash,
        // never the Accent, which means the app is acting (ADR 0031).
        color: wash,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (state.unavailableRepositories.isNotEmpty) ...[
            Text(
              l10n.timelineBannerUnavailableTitle,
              style: gitPulseTypeRowLabel(context),
            ),
            Text(
              l10n.timelineBannerUnavailableDescription(
                _names(state.unavailableRepositories),
              ),
              style: gitPulseTypeMeta(context),
            ),
          ],
          if (state.transientRepositories.isNotEmpty) ...[
            Text(
              l10n.timelineBannerTransientTitle,
              style: gitPulseTypeRowLabel(context),
            ),
            Text(
              l10n.timelineBannerTransientDescription(
                _names(state.transientRepositories),
              ),
              style: gitPulseTypeMeta(context),
            ),
          ],
          const SizedBox(height: GitPulseSpace.inline),
          Align(
            alignment: Alignment.centerLeft,
            child: GitPulseButton(
              label: l10n.timelineRetry,
              variant: GitPulseButtonVariant.outlined,
              onPressed: state.loading ? null : () => onRetry(),
            ),
          ),
        ],
      ),
    );
  }
}

class _TimelineList extends StatefulWidget {
  const _TimelineList({
    required this.state,
    required this.readingPosition,
    required this.now,
    required this.localDateKey,
    required this.landedRefreshes,
    required this.onRefresh,
    required this.onPullRefresh,
    required this.onRetry,
    required this.onLoadOlder,
  });

  final TimelineViewState state;
  final _TimelineReadingPosition readingPosition;
  final DateTime now;
  final String Function(DateTime instant) localDateKey;

  /// How many refreshes have returned usable results, so the newest ones can be
  /// presented from the top instead of the release being read.
  final int landedRefreshes;
  final Future<void> Function() onRefresh;
  final Future<void> Function() onPullRefresh;
  final Future<void> Function() onRetry;
  final Future<void> Function() onLoadOlder;

  @override
  State<_TimelineList> createState() => _TimelineListState();
}

class _TimelineListState extends State<_TimelineList>
    with SingleTickerProviderStateMixin {
  var _centerKey = GlobalKey();
  final _cardKeys = <String, GlobalKey>{};
  late ScrollController _controller;
  String? _anchor;
  bool _returnToTop = false;
  late final AnimationController _listVisibility;
  bool _returningToTop = false;
  int _returnRevision = 0;

  @override
  void initState() {
    super.initState();
    _listVisibility = AnimationController(vsync: this, value: 1);
    final saved = widget.readingPosition.anchor;
    final exists = widget.state.visibleGroups.any(
      (group) => group.items.any((item) => item.key == saved?.releaseKey),
    );
    _anchor = exists ? saved?.releaseKey : null;
    _controller = _newController();
    if (!exists || saved == null) {
      widget.readingPosition.anchor = null;
      _scheduleReturnToTopSync();
      return;
    }
    // Lay out the anchor row first: its card may have become shorter while
    // another tab was open, so the old inset can no longer be assumed to fit.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_controller.hasClients) return;
      final box =
          _cardKeys[saved.releaseKey]?.currentContext?.findRenderObject()
              as RenderBox?;
      if (box == null || !box.attached || !box.hasSize) return;
      _controller.jumpTo(saved.offset < box.size.height ? saved.offset : 0);
      _syncReturnToTop();
    });
    _scheduleReturnToTopSync();
  }

  ScrollController _newController({double initialScrollOffset = 0}) {
    return ScrollController(
      initialScrollOffset: initialScrollOffset,
      keepScrollOffset: false,
    )..addListener(_syncReturnToTop);
  }

  /// Shows the floating button while the reader is more than one list height
  /// below the true top, and hides it once they are within one.
  ///
  /// The true top is the minimum scroll extent, not offset zero: rows restored
  /// above the reading anchor live in the scroll view's negative range, so zero
  /// can sit well inside the list. Direction and pauses never take part, so the
  /// button cannot flicker while the reader moves.
  void _syncReturnToTop() {
    if (!mounted || !_controller.hasClients) return;
    final position = _controller.position;
    final distance = position.pixels - position.minScrollExtent;
    final visible = distance > position.viewportDimension;
    if (visible == _returnToTop) return;
    setState(() => _returnToTop = visible);
  }

  void _scheduleReturnToTopSync() {
    WidgetsBinding.instance.addPostFrameCallback((_) => _syncReturnToTop());
  }

  /// Moves the list to the newest date group and its first release.
  ///
  /// Nothing is requested and no search or filter changes; the movement is
  /// interruptible by any manual scroll, and a reader who asked for reduced
  /// motion is positioned there directly.
  void _scrollToTop() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_controller.hasClients) return;
      _cancelReturnTransition();
      final position = _controller.position;
      final distance = position.pixels - position.minScrollExtent;
      if (MediaQuery.disableAnimationsOf(context)) {
        _resetToTop();
        return;
      }
      if (distance.abs() < 1) return;
      // A restored center has unmeasured rows above it: its negative extent is
      // an estimate. Rebase it as well, so the destination is the actual first
      // date rather than an estimate of that date's offset.
      if (_anchor != null || distance > position.viewportDimension * 3) {
        _returnFromDistance();
        return;
      }
      _controller.animateTo(
        position.minScrollExtent,
        duration: _returnToTopMove,
        curve: Curves.decelerate,
      );
    });
  }

  Future<void> _returnFromDistance() async {
    final revision = _returnRevision;
    _returningToTop = true;
    // Stop any ongoing fling while its departure window fades out.
    _controller.jumpTo(_controller.offset);
    try {
      await _listVisibility
          .animateTo(0, duration: _returnToTopFade, curve: Curves.easeIn)
          .orCancel;
      _resetToTop();
      // Lay out just the newest window while the list is invisible. No scroll
      // animation visits or measures the intervening history.
      await WidgetsBinding.instance.endOfFrame;
      if (!mounted || revision != _returnRevision) return;
      await _listVisibility
          .animateTo(1, duration: _returnToTopMove, curve: Curves.easeOutCubic)
          .orCancel;
    } on TickerCanceled {
      // A touch, wheel, repeat return, or disposal gives control to the reader.
    } finally {
      if (mounted && revision == _returnRevision) {
        _returningToTop = false;
        _scheduleReadingPosition();
      }
    }
  }

  void _cancelReturnTransition() {
    _returnRevision++;
    _returningToTop = false;
    _listVisibility.stop();
    _listVisibility.value = 1;
    _scheduleReadingPosition();
  }

  void _resetToTop() {
    final previous = _controller;
    previous.removeListener(_syncReturnToTop);
    setState(() {
      _anchor = null;
      widget.readingPosition.anchor = null;
      // A retained center would graft its old SliverList (and distant layout
      // origin) into the new viewport, rebuilding the skipped rows in one frame.
      _centerKey = GlobalKey();
      _cardKeys.clear();
      _controller = _newController();
      _returnToTop = false;
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      previous.dispose();
      if (mounted) _syncReturnToTop();
    });
  }

  void _scheduleReadingPosition() {
    final controller = _controller;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && !_returningToTop && identical(controller, _controller)) {
        _rememberReadingPosition();
      }
    });
  }

  void _rememberReadingPosition() {
    final visible = _visibleReadingPosition();
    widget.readingPosition.anchor = visible == null
        ? null
        : (releaseKey: visible.releaseKey, offset: visible.offset);
  }

  ({String releaseKey, double offset, double top})? _visibleReadingPosition({
    Set<String>? remaining,
  }) {
    final viewport = context.findRenderObject() as RenderBox?;
    if (viewport == null || !viewport.hasSize) return null;
    final top = viewport.localToGlobal(Offset.zero).dy;
    final bottom = top + viewport.size.height;
    ({String releaseKey, double offset, double top})? anchor;
    for (final entry in _cardKeys.entries) {
      if (remaining != null && !remaining.contains(entry.key)) continue;
      final box = entry.value.currentContext?.findRenderObject() as RenderBox?;
      if (box == null || !box.attached || !box.hasSize) continue;
      final y = box.localToGlobal(Offset.zero).dy;
      if (y + box.size.height <= top || y >= bottom) continue;
      if (anchor == null || top - y > anchor.offset) {
        anchor = (releaseKey: entry.key, offset: top - y, top: y);
      }
    }
    return anchor;
  }

  @override
  void dispose() {
    _listVisibility.dispose();
    _controller.dispose();
    super.dispose();
  }

  @override
  void didUpdateWidget(_TimelineList oldWidget) {
    super.didUpdateWidget(oldWidget);
    final expectsTop = widget.landedRefreshes != oldWidget.landedRefreshes;
    if (expectsTop &&
        _controller.hasClients &&
        (_controller.offset - _controller.position.minScrollExtent).abs() < 1) {
      // A refresh at the top presents its new first row immediately, even when
      // that row was inserted above the release previously being read.
      _cancelReturnTransition();
      _resetToTop();
      return;
    }
    void settle() {
      _scheduleReturnToTopSync();
      if (expectsTop) _scrollToTop();
    }

    if (identical(oldWidget.state.visibleGroups, widget.state.visibleGroups)) {
      settle();
      return;
    }
    final remaining = {
      for (final group in widget.state.visibleGroups)
        for (final item in group.items) item.key,
    };
    final visible = _visibleReadingPosition(remaining: remaining);
    if (visible == null) {
      settle();
      return;
    }
    final anchor = visible.releaseKey;
    // Put the row containing the visible release at the scroll view's center.
    // Rows inserted above it then grow upwards, including unbuilt, variable
    // height rows. This needs no estimate of their combined height.
    _anchor = anchor;
    final previous = _controller;
    _controller = _newController(initialScrollOffset: visible.offset);
    final savedTop = visible.top;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      previous.dispose();
      if (!mounted || !_controller.hasClients) return;
      final box =
          _cardKeys[anchor]?.currentContext?.findRenderObject() as RenderBox?;
      if (box == null || !box.attached || !box.hasSize) return;
      // Header/banner height changes can move the viewport as well.
      final delta = box.localToGlobal(Offset.zero).dy - savedTop;
      if (delta.abs() > 0.1) {
        _controller.jumpTo(_controller.offset + delta);
      }
      _cardKeys.removeWhere((key, _) => !remaining.contains(key));
      _syncReturnToTop();
    });
    settle();
  }

  Key _rowKey(TimelineRow row) => ValueKey(switch (row) {
    TimelineDateRow(:final date) => 'date/$date',
    TimelineCardRow(:final item) => 'card/${item.key}',
    TimelineBaselineRow(:final timestamp) => 'baseline/$timestamp',
  });

  Widget _row(TimelineRow row) => KeyedSubtree(
    key: _rowKey(row),
    child: switch (row) {
      TimelineDateRow(:final date) => _DateHeader(date: date),
      // One card per row, so the row has nothing to even out: no [Row] and no
      // [IntrinsicHeight], which would price a second layout pass on every
      // release for a height nothing compares against.
      TimelineCardRow(:final item) => Padding(
        padding: const EdgeInsets.only(bottom: _cardSpacing),
        child: ReleaseTimelineCard(
          key: _cardKeys.putIfAbsent(item.key, () => GlobalKey()),
          item: item,
        ),
      ),
      TimelineBaselineRow(:final timestamp, :final includeDate) =>
        _PreviousRefreshMark(
          timestamp: timestamp,
          includeDate: includeDate,
          now: widget.now,
          localDateKey: widget.localDateKey,
        ),
    },
  );

  @override
  Widget build(BuildContext context) {
    final rows = buildTimelineRows(
      widget.state.visibleGroups,
      widget.state.baselineExposed ? widget.state.previousBaseline : null,
      localDateKey: widget.localDateKey,
    );
    final found = rows.indexWhere(
      (row) => row is TimelineCardRow && row.item.key == _anchor,
    );
    final pivot = found < 0 ? 0 : found;
    final before = rows.take(pivot).toList().reversed.toList();
    final after = rows.skip(pivot).toList();
    final beforeIndices = {
      for (var i = 0; i < before.length; i++) _rowKey(before[i]): i,
    };
    final afterIndices = {
      for (var i = 0; i < after.length; i++) _rowKey(after[i]): i,
    };

    return Stack(
      fit: StackFit.expand,
      children: [
        NotificationListener<ScrollNotification>(
          onNotification: (notification) {
            if (notification.depth == 0) {
              _scheduleReadingPosition();
            }
            return false;
          },
          child: Listener(
            onPointerDown: (_) => _cancelReturnTransition(),
            onPointerSignal: (_) => _cancelReturnTransition(),
            child: ClipRect(
              child: FadeTransition(
                opacity: _listVisibility,
                child: AnimatedBuilder(
                  animation: _listVisibility,
                  builder: (context, child) => Transform.translate(
                    offset: Offset(
                      0,
                      -GitPulseMotion.timelineReturnShift *
                          (1 - _listVisibility.value),
                    ),
                    child: child,
                  ),
                  child: RepaintBoundary(
                    child: GitPulsePullToRefresh(
                      onRefresh: widget.onPullRefresh,
                      child: CustomScrollView(
                        key: ObjectKey(_controller),
                        controller: _controller,
                        center: _centerKey,
                        // A short list still answers the pull: the gesture is about
                        // asking for new releases, not about having enough to scroll.
                        physics: const AlwaysScrollableScrollPhysics(),
                        slivers: [
                          SliverPadding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: releaseTimelineHorizontalPadding,
                            ),
                            sliver: SliverList.builder(
                              itemCount: before.length,
                              findChildIndexCallback: (key) =>
                                  beforeIndices[key],
                              itemBuilder: (context, index) =>
                                  _row(before[index]),
                            ),
                          ),
                          SliverPadding(
                            key: _centerKey,
                            padding: const EdgeInsets.fromLTRB(
                              releaseTimelineHorizontalPadding,
                              0,
                              releaseTimelineHorizontalPadding,
                              _listEndInset,
                            ),
                            sliver: SliverList.builder(
                              itemCount: after.length + 1,
                              findChildIndexCallback: (key) =>
                                  afterIndices[key],
                              itemBuilder: (context, index) =>
                                  index < after.length
                                  ? _row(after[index])
                                  : _StatusFooter(
                                      state: widget.state,
                                      onRefresh: widget.onRefresh,
                                      onRetry: widget.onRetry,
                                      onLoadOlder: widget.onLoadOlder,
                                    ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
        Positioned(
          right: _floatingInset,
          // Above the app's bottom bar, which the shell already reserves, and
          // above the system's own inset where no bar stands on it: the shell
          // removes the body's bottom padding only when it shows that bar, so
          // this inset is what is left for a page that has no bar of its own.
          bottom: _floatingInset + MediaQuery.paddingOf(context).bottom,
          child: _ReturnToTop(visible: _returnToTop, onPressed: _scrollToTop),
        ),
      ],
    );
  }
}

/// The floating control that carries the reader back to the newest releases.
///
/// It only changes where the reader is; the releases, the search, the filters
/// and the Timeline Refresh Baseline are all left alone.
class _ReturnToTop extends StatelessWidget {
  const _ReturnToTop({required this.visible, required this.onPressed});

  final bool visible;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final reduceMotion = MediaQuery.disableAnimationsOf(context);
    return AnimatedOpacity(
      opacity: visible ? 1 : 0,
      duration: reduceMotion ? Duration.zero : _returnToTopFade,
      child: IgnorePointer(
        ignoring: !visible,
        child: ExcludeFocus(
          excluding: !visible,
          child: ExcludeSemantics(
            excluding: !visible,
            // The app's own icon action, standing over the list rather than on
            // it: a disc inside one hairline, which is how a floating surface is
            // told apart from the cards beneath it without a shadow.
            child: GitPulseIconButton(
              label: l10n.timelineBackToTop,
              onPressed: onPressed,
              floating: true,
              // A plain up arrow, not `vertical_align_top`: that glyph is a
              // text-alignment mark — a bar under an arrow — and reads as
              // "align text" rather than "go back up the list".
              icon: const Icon(Icons.arrow_upward),
            ),
          ),
        ),
      ),
    );
  }
}

class _DateHeader extends StatelessWidget {
  const _DateHeader({required this.date});

  final String date;

  @override
  Widget build(BuildContext context) {
    return _RuleRow(
      padding: const EdgeInsets.fromLTRB(0, 16, 0, 8),
      child: Text(
        gitPulseDate(context, date),
        style: gitPulseTypeGroupHeader(context),
      ),
    );
  }
}

/// The in-list Previous Refresh marker.
///
/// It must not read as a day group, so it deliberately shares nothing visual
/// with [_DateHeader]: the title is a small, letter-spaced, accent-coloured
/// label flush with the left edge of the cards, the instant is an unemphasized
/// caption, and the single hairline runs to the right of the text only. A day
/// header instead centers a larger on-surface label between two plain rules.
class _PreviousRefreshMark extends StatelessWidget {
  const _PreviousRefreshMark({
    required this.timestamp,
    required this.includeDate,
    required this.now,
    required this.localDateKey,
  });

  final DateTime timestamp;
  final bool includeDate;
  final DateTime now;
  final String Function(DateTime instant) localDateKey;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;
    final title = l10n.timelinePreviousRefreshMark;
    final instant = gitPulseBaselineInstantLabel(
      context,
      timestamp,
      now: now,
      localDateKey: localDateKey,
      includeDate: includeDate,
    );
    return Semantics(
      container: true,
      label: '$title $instant',
      child: ExcludeSemantics(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(0, 14, 0, 12),
          child: Row(
            children: [
              Text(
                title,
                maxLines: 1,
                // The section label at the Accent: the marker is the one block
                // label on the list that says "the app did this", and its type
                // row is the table's, so its measure is the one it always had.
                style: gitPulseTypeSectionLabel(context)
                    ?.copyWith(color: toneAccent(context)),
              ),
              const SizedBox(width: GitPulseSpace.inline),
              Text(
                instant,
                maxLines: 1,
                style: gitPulseTypeMetaTight(
                  context,
                )?.copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
              ),
              const SizedBox(width: GitPulseSpace.meta),
              // A plain rule rather than a [Divider]: the day headers own that
              // widget, and the marker must not be mistakable for one.
              Expanded(
                child: Container(
                  height: GitPulseStroke.hairline,
                  color: toneRule(scheme),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A day header: its label sits between two full-width rules. The Previous
/// Refresh marker does not use this, so the two rows do not look alike.
class _RuleRow extends StatelessWidget {
  const _RuleRow({required this.child, required this.padding});

  final Widget child;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final rule = Divider(
      height: GitPulseStroke.hairline,
      thickness: GitPulseStroke.hairline,
      color: toneRule(scheme),
    );
    return Padding(
      padding: padding,
      child: Row(
        children: [
          Expanded(child: rule),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            child: child,
          ),
          Expanded(child: rule),
        ],
      ),
    );
  }
}

class _StatusFooter extends StatelessWidget {
  const _StatusFooter({
    required this.state,
    required this.onRefresh,
    required this.onRetry,
    required this.onLoadOlder,
  });

  final TimelineViewState state;
  final Future<void> Function() onRefresh;
  final Future<void> Function() onRetry;
  final Future<void> Function() onLoadOlder;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final meta = gitPulseTypeMeta(context);

    return Padding(
      padding: const EdgeInsets.only(top: GitPulseSpace.inline),
      child: Wrap(
        alignment: WrapAlignment.center,
        crossAxisAlignment: WrapCrossAlignment.center,
        spacing: 12,
        runSpacing: GitPulseSpace.inline,
        children: [
          // Saved history that is not connected explains why the window is
          // incomplete, so it stays. That it *is* connected states nothing the
          // reader can act on, so it is not reported at all.
          if (state.cacheConnection == TimelineCacheConnection.waiting)
            Semantics(
              liveRegion: true,
              child: Text(
                l10n.timelineCacheWaiting(
                  state.waitingRepositories
                      .map((repository) => repository.fullName)
                      .join(', '),
                ),
                style: meta,
              ),
            ),
          if (state.partial) Text(l10n.timelinePartialWindow, style: meta),
          if (state.persistenceFailed)
            Semantics(
              liveRegion: true,
              child: Text(l10n.timelinePersistenceError, style: meta),
            ),
          if (state.canLoadOlder)
            GitPulseButton(
              label: l10n.timelineLoadOlder,
              variant: GitPulseButtonVariant.tonal,
              onPressed: state.loading ? null : () => onLoadOlder(),
            ),
          // A failed round with saved releases still on screen keeps only the
          // action: the reader can see what they came for, so the reason is
          // worth stating beside the releases lost, not here. Without a
          // readable window there is nothing to read, and the failure is the
          // only explanation the page can give.
          if (state.failure != null && !state.hasExposedReleases)
            Text(switch (state.failure!.kind) {
              TimelineFailureKind.network => l10n.timelineErrorNetwork,
              TimelineFailureKind.rateLimited => l10n.timelineErrorRateLimited,
              _ => l10n.timelineErrorServer,
            }, style: meta),
          if (state.canRetry)
            GitPulseButton(
              label: l10n.timelineRetry,
              variant: GitPulseButtonVariant.outlined,
              onPressed: state.loading ? null : () => onRetry(),
            ),
          if (state.persistenceFailed)
            GitPulseButton(
              label: l10n.timelineReload,
              variant: GitPulseButtonVariant.outlined,
              onPressed: state.loading ? null : () => onRefresh(),
            ),
        ],
      ),
    );
  }
}
