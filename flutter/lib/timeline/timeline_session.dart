import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../session/session_controller.dart';
import 'timeline_dto.dart';
import 'timeline_models.dart';
import 'timeline_service.dart';
import 'timeline_state.dart';

/// The device clock and display time zone. Tests replace this seam.
final timelineEnvironmentProvider = Provider<TimelineEnvironment>(
  (ref) => TimelineEnvironment.system(),
);

final timelineTransportProvider = Provider<TimelineTransport>(
  (ref) => SessionTimelineTransport(ref),
);

final releaseTimelineServiceProvider = Provider<ReleaseTimelineService>(
  (ref) => ReleaseTimelineService(ref.watch(timelineTransportProvider)),
);

/// The app-facing Release Timeline session.
///
/// It owns the refresh cycle, the exposed Shared Timeline Window, the captured
/// Timeline Refresh Baseline, and the loaded-new count. Widgets read its
/// immutable state and never coordinate rounds themselves.
final releaseTimelineSessionProvider =
    NotifierProvider<ReleaseTimelineSession, TimelineViewState>(
      ReleaseTimelineSession.new,
    );

class ReleaseTimelineSession extends Notifier<TimelineViewState> {
  List<TimelineRepository> _followedRepositories = const [];
  TimelineCycle _cycle = TimelineCycle.empty;
  String? _context;
  int _generation = 0;

  @override
  TimelineViewState build() {
    ref.listen(sessionControllerProvider, (previous, next) {
      _onSessionChanged();
    });
    ref.onDispose(() {
      _generation += 1;
    });
    final context = _sessionContext();
    if (context != null) {
      _context = context;
      Future<void>.microtask(() => _startCycle(++_generation));
    }
    return const TimelineViewState.inactive();
  }

  /// Reads one coordinated round for every Followed Repository.
  ///
  /// This is the only Timeline command in this slice. Loading older pages and
  /// retrying individual repositories with their own cursors belong to the
  /// pagination slice.
  Future<void> refresh() async {
    final context = _sessionContext();
    if (context == null) return;
    // A new account, or a first cycle that never reached the Followed
    // Repositories, restarts from the account's settings.
    if (context != _context || _followedRepositories.isEmpty) {
      _context = context;
      await _startCycle(++_generation);
      return;
    }
    await _runRound(++_generation);
  }

  /// Re-reads the account's Release Follows and starts a new cycle, so a
  /// changed follow set cannot keep reusing the previous window.
  Future<void> reloadFollows() async {
    final context = _sessionContext();
    if (context == null) return;
    _context = context;
    await _startCycle(++_generation);
  }

  void _onSessionChanged() {
    final context = _sessionContext();
    if (context == null) {
      _generation += 1;
      _context = null;
      _followedRepositories = const [];
      _cycle = TimelineCycle.empty;
      state = const TimelineViewState.inactive();
      return;
    }
    if (context == _context) return;
    _context = context;
    _followedRepositories = const [];
    _cycle = TimelineCycle.empty;
    state = const TimelineViewState.activeLoading();
    unawaited(_startCycle(++_generation));
  }

  /// The signed-in account and its backend, which scope every stored rule.
  String? _sessionContext() {
    final session = ref.read(sessionControllerProvider);
    if (session.phase != SessionPhase.signedIn) return null;
    final identity = session.identity;
    if (identity == null) return null;
    return '${identity.backend}|${identity.login}';
  }

  Future<void> _startCycle(int ticket) async {
    if (!_isCurrent(ticket)) return;
    state = state.copyWith(
      active: true,
      loading: true,
      clearFailure: true,
      groups: const [],
      unavailableRepositories: const [],
      transientRepositories: const [],
      clearPreviousBaseline: true,
      baselineExposed: false,
      loadedNewCount: 0,
      partial: false,
      canRetry: false,
      persistenceFailed: false,
    );

    final response = await ref
        .read(releaseTimelineServiceProvider)
        .readFollowedRepositories();
    if (!_isCurrent(ticket)) return;

    if (response.data == null) {
      _fail(ticket, response.failure);
      return;
    }

    final follows = response.data!;
    if (follows.isEmpty) {
      _followedRepositories = const [];
      _cycle = TimelineCycle.empty;
      state = const TimelineViewState(active: true, hasFollows: false);
      return;
    }

    _followedRepositories = follows;
    await _runRound(ticket);
  }

  Future<void> _runRound(int ticket) async {
    if (!_isCurrent(ticket)) return;
    state = state.copyWith(active: true, loading: true, clearFailure: true);

    final response = await ref.read(releaseTimelineServiceProvider).refresh();
    if (!_isCurrent(ticket)) return;

    final round = response.data;
    if (round == null || !_hasUsablePage(round)) {
      _fail(ticket, response.failure, round: round);
      return;
    }

    final pages = round.toDomainPages();
    final result = mergeTimelineRound(
      cycle: _cycle,
      followedRepositories: _followedRepositories,
      pages: pages,
      requestedIds: [for (final follow in _followedRepositories) follow.id],
      refresh: true,
      environment: ref.read(timelineEnvironmentProvider),
      capturedBaseline: round.refresh?.previousBaseline,
    );
    _cycle = result.cycle;

    final baseline = _cycle.previousBaseline;
    final unavailable = _repositoriesFor(round.unavailableIds ?? const []);
    final transient = _repositoriesFor(round.transientIds ?? const []);

    state = TimelineViewState(
      active: true,
      hasFollows: true,
      groups: result.groups,
      unavailableRepositories: unavailable,
      transientRepositories: transient,
      previousBaseline: baseline,
      baselineExposed: isBaselineExposed(baseline, _cycle.windowLowerBound),
      loadedNewCount: countLoadedNewReleases(result.groups, baseline),
      partial: _cycle.partial || unavailable.isNotEmpty || transient.isNotEmpty,
      canRetry: _cycle.failedIds.isNotEmpty || _hasLookupFailures(round),
      persistenceFailed: round.persistenceError != null,
    );
  }

  /// A round is usable when at least one repository returned releases, or when
  /// a partially failed page carried some. HTTP success alone is not usable.
  bool _hasUsablePage(TimelineRoundDto round) {
    final pages = round.pages;
    if (pages == null) return false;
    return pages.entries.any((entry) => entry.value.toDomain().isUsable);
  }

  bool _hasLookupFailures(TimelineRoundDto round) =>
      (round.unavailableIds ?? const []).isNotEmpty ||
      (round.transientIds ?? const []).isNotEmpty;

  List<TimelineRepository> _repositoriesFor(List<String> ids) {
    final byId = {
      for (final follow in _followedRepositories) follow.id: follow,
    };
    return [for (final id in ids) ?byId[id]];
  }

  /// A round that returned no usable results keeps the releases already read
  /// and its captured baseline, and reports a retryable failure naming the
  /// repositories the backend could not include.
  void _fail(int ticket, TimelineFailure? failure, {TimelineRoundDto? round}) {
    if (!_isCurrent(ticket)) return;
    _cycle = _cycle.withFailed([
      for (final follow in _followedRepositories) follow.id,
    ]);
    final baseline = _cycle.previousBaseline;
    state = state.copyWith(
      active: true,
      loading: false,
      hasFollows: _followedRepositories.isNotEmpty,
      unavailableRepositories: _repositoriesFor(
        round?.unavailableIds ?? const [],
      ),
      transientRepositories: _repositoriesFor(round?.transientIds ?? const []),
      partial: true,
      canRetry: true,
      failure:
          failure ?? const TimelineFailure(TimelineFailureKind.invalidResponse),
      baselineExposed: isBaselineExposed(baseline, _cycle.windowLowerBound),
    );
  }

  bool _isCurrent(int ticket) => ref.mounted && ticket == _generation;
}
