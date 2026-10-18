import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../session/gitpulse_http.dart';
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

/// Confirmed removals from an account's shared follow set.
///
/// Durable-history adapters consume this lifecycle rather than letting widgets
/// delete records.
class TimelineFollowRemoval {
  TimelineFollowRemoval({
    required this.identity,
    required Set<String> repositoryIds,
  }) : repositoryIds = Set.unmodifiable(repositoryIds);

  final AuthenticatedIdentity identity;
  final Set<String> repositoryIds;
}

class ReleaseTimelineSession extends Notifier<TimelineViewState> {
  List<TimelineRepository> _followedRepositories = const [];
  TimelineCycle _cycle = TimelineCycle.empty;
  String? _context;
  int _generation = 0;
  bool _followsKnown = false;
  final Map<String, RepositoryPageStatus> _failures = {};
  final Set<String> _firstPageRetries = {};
  final _followRemovals = StreamController<TimelineFollowRemoval>.broadcast(
    sync: true,
  );

  Stream<TimelineFollowRemoval> get followRemovals => _followRemovals.stream;

  @override
  TimelineViewState build() {
    ref.listen(sessionControllerProvider, (previous, next) {
      _onSessionChanged();
    });
    ref.onDispose(() {
      _generation += 1;
      _followRemovals.close();
    });
    final context = _sessionContext();
    if (context != null) {
      _context = context;
      final ticket = ++_generation;
      Future<void>.microtask(() => _startCycle(ticket));
    }
    return const TimelineViewState.inactive();
  }

  /// Reads one coordinated round for every Followed Repository.
  Future<void> refresh() async {
    final context = _sessionContext();
    if (context == null) return;
    // A new account, or a first cycle that never reached the Followed
    // Repositories, restarts from the account's settings.
    if (context != _context ||
        !_followsKnown ||
        _followedRepositories.isEmpty) {
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

  /// Accepts the backend-confirmed account list.
  ///
  /// Invalidates the previous window immediately, then loads additions from
  /// their first page.
  Future<void> applyFollows(List<TimelineRepository> repositories) async {
    final context = _sessionContext();
    if (context == null) return;
    if (_followsKnown &&
        context == _context &&
        repositories.length == _followedRepositories.length &&
        repositories.indexed.every((entry) {
          final previous = _followedRepositories[entry.$1];
          return previous.id == entry.$2.id &&
              previous.fullName == entry.$2.fullName;
        })) {
      return;
    }
    _context = context;
    await _startCycle(
      ++_generation,
      confirmedFollows: List.unmodifiable(repositories),
    );
  }

  /// Advances successful, non-exhausted repositories by one coordinated round.
  Future<void> loadOlder() async {
    if (state.loading || !state.active || !state.canLoadOlder) return;
    await _continueRound({
      for (final repository in _followedRepositories)
        if (!_cycle.failedIds.contains(repository.id) &&
            _cycle.pages[repository.id]?.hasOlderReleases == true)
          repository.id: _cycle.pages[repository.id]?.endCursor,
    });
  }

  /// Retries failed pages at their original cursors. An optional stable ID
  /// restricts the action to one failed repository.
  Future<void> retryFailed({String? repositoryId}) async {
    if (state.loading || !state.active || !state.canRetry) return;
    if (!_followsKnown || _followedRepositories.isEmpty) {
      await refresh();
      return;
    }
    await _continueRound({
      for (final repository in _followedRepositories)
        if (_cycle.failedIds.contains(repository.id) &&
            (repositoryId == null || repository.id == repositoryId))
          repository.id: _firstPageRetries.contains(repository.id)
              ? null
              : _cycle.pages[repository.id]?.endCursor,
    });
  }

  Future<void> _continueRound(Map<String, String?> cursors) async {
    if (cursors.isEmpty) return;
    final ticket = _generation;
    state = state.copyWith(loading: true, clearFailure: true);
    final response = await ref
        .read(releaseTimelineServiceProvider)
        .loadPages(cursors);
    if (!_isCurrent(ticket)) return;
    _acceptRound(
      ticket,
      response,
      cursors.keys.toList(),
      refresh: false,
      cursors: cursors,
    );
  }

  void _onSessionChanged() {
    final context = _sessionContext();
    if (context == null) {
      _generation += 1;
      _context = null;
      _followedRepositories = const [];
      _followsKnown = false;
      _cycle = TimelineCycle.empty;
      _failures.clear();
      _firstPageRetries.clear();
      state = const TimelineViewState.inactive();
      return;
    }
    if (context == _context) return;
    _context = context;
    _followedRepositories = const [];
    _followsKnown = false;
    _cycle = TimelineCycle.empty;
    _failures.clear();
    _firstPageRetries.clear();
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

  Future<void> _startCycle(
    int ticket, {
    List<TimelineRepository>? confirmedFollows,
  }) async {
    if (!_isCurrent(ticket)) return;
    _cycle = TimelineCycle.empty;
    _followsKnown = false;
    _failures.clear();
    _firstPageRetries.clear();
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
      canLoadOlder: false,
      persistenceFailed: false,
    );

    final response = confirmedFollows == null
        ? await ref
              .read(releaseTimelineServiceProvider)
              .readFollowedRepositories()
        : TimelineResult.data(confirmedFollows);
    if (!_isCurrent(ticket)) return;

    if (response.data == null) {
      _fail(ticket, response.failure);
      return;
    }

    final follows = response.data!;
    _followsKnown = true;
    final nextIds = follows.map((repository) => repository.id).toSet();
    final removed = _followedRepositories
        .map((repository) => repository.id)
        .where((id) => !nextIds.contains(id))
        .toSet();
    _followedRepositories = follows;
    final identity = ref.read(sessionControllerProvider).identity;
    if (removed.isNotEmpty && identity != null) {
      _followRemovals.add(
        TimelineFollowRemoval(identity: identity, repositoryIds: removed),
      );
    }
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

    _acceptRound(ticket, response, [
      for (final follow in _followedRepositories) follow.id,
    ], refresh: true);
  }

  void _acceptRound(
    int ticket,
    TimelineResult<TimelineRoundDto> response,
    List<String> requestedIds, {
    required bool refresh,
    Map<String, String?> cursors = const {},
  }) {
    final round = response.data;
    final pages = round?.toDomainPages() ?? <String, RepositoryPage>{};
    pages.removeWhere((id, _) => !requestedIds.contains(id));
    for (final entry in pages.entries.toList()) {
      final page = entry.value;
      if (page.isAvailable &&
          page.hasOlderReleases &&
          (page.endCursor == null ||
              page.endCursor!.isEmpty ||
              page.endCursor == cursors[entry.key])) {
        pages[entry.key] = RepositoryPage(
          status: page.status,
          owner: page.owner,
          name: page.name,
          hasOlderReleases: true,
          incomplete: true,
          releases: page.releases,
        );
      }
    }
    if (round == null || !pages.values.any((page) => page.isUsable)) {
      if (refresh) {
        _firstPageRetries
          ..clear()
          ..addAll(requestedIds);
        _failures.clear();
      }
      _fail(ticket, response.failure, pages: pages, requestedIds: requestedIds);
      return;
    }

    if (refresh) {
      _failures.clear();
      _firstPageRetries.clear();
    }
    for (final id in requestedIds) {
      final page = pages[id];
      if (page != null && page.isAvailable && !page.incomplete) {
        _firstPageRetries.remove(id);
      }
    }
    _recordFailures(requestedIds, pages);
    final result = mergeTimelineRound(
      cycle: _cycle,
      followedRepositories: _followedRepositories,
      pages: pages,
      requestedIds: requestedIds,
      refresh: refresh,
      environment: ref.read(timelineEnvironmentProvider),
      capturedBaseline: refresh
          ? round.refresh?.previousBaseline
          : _cycle.previousBaseline,
    );
    _cycle = result.cycle;

    final baseline = _cycle.previousBaseline;
    final unavailable = _failedRepositories(RepositoryPageStatus.unavailable);
    final transient = _failedRepositories(RepositoryPageStatus.transient);

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
      canRetry: _cycle.failedIds.isNotEmpty,
      canLoadOlder: _canLoadOlder,
      persistenceFailed: refresh
          ? round.persistenceError != null
          : state.persistenceFailed || round.persistenceError != null,
    );
  }

  bool get _canLoadOlder => _cycle.pages.entries.any(
    (entry) =>
        !_cycle.failedIds.contains(entry.key) && entry.value.hasOlderReleases,
  );

  void _recordFailures(List<String> ids, Map<String, RepositoryPage> pages) {
    for (final id in ids) {
      final page = pages[id];
      if (page == null || !page.isAvailable || page.incomplete) {
        _failures[id] = page?.status == RepositoryPageStatus.unavailable
            ? RepositoryPageStatus.unavailable
            : RepositoryPageStatus.transient;
      } else {
        _failures.remove(id);
      }
    }
  }

  List<TimelineRepository> _failedRepositories(RepositoryPageStatus status) =>
      _repositoriesFor([
        for (final entry in _failures.entries)
          if (entry.value == status) entry.key,
      ]);

  List<TimelineRepository> _repositoriesFor(List<String> ids) {
    final byId = {
      for (final follow in _followedRepositories) follow.id: follow,
    };
    return [for (final id in ids) ?byId[id]];
  }

  /// A round that returned no usable results keeps the releases already read
  /// and its captured baseline, and reports a retryable failure naming the
  /// repositories the backend could not include.
  void _fail(
    int ticket,
    TimelineFailure? failure, {
    Map<String, RepositoryPage> pages = const {},
    List<String>? requestedIds,
  }) {
    if (!_isCurrent(ticket)) return;
    final ids =
        requestedIds ?? [for (final follow in _followedRepositories) follow.id];
    _cycle = _cycle.withFailed(ids);
    _recordFailures(ids, pages);
    final baseline = _cycle.previousBaseline;
    state = state.copyWith(
      active: true,
      loading: false,
      hasFollows: _followedRepositories.isNotEmpty,
      unavailableRepositories: _failedRepositories(
        RepositoryPageStatus.unavailable,
      ),
      transientRepositories: _failedRepositories(
        RepositoryPageStatus.transient,
      ),
      partial: true,
      canRetry: true,
      canLoadOlder: _canLoadOlder,
      failure:
          failure ?? const TimelineFailure(TimelineFailureKind.invalidResponse),
      baselineExposed: isBaselineExposed(baseline, _cycle.windowLowerBound),
    );
  }

  bool _isCurrent(int ticket) => ref.mounted && ticket == _generation;
}
