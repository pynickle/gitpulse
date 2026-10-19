import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/widgets.dart';

import '../session/gitpulse_http.dart';
import '../session/session_controller.dart';
import 'timeline_dto.dart';
import 'timeline_models.dart';
import 'timeline_service.dart';
import 'timeline_state.dart';
import 'timeline_cache.dart';
import 'timeline_cache_lifecycle.dart';
import 'timeline_history.dart';

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
  bool _awaitingFreshWindow = true;
  String _cycleId = '';
  Future<void>? _cacheAction;
  int? get _retentionDays => state.cacheSettings.retentionDays;
  set _retentionDays(int? days) {
    state = state.copyWith(
      cacheSettings: state.cacheSettings.copyWith(
        retentionDays: days,
        clearRetentionDays: days == null,
      ),
    );
  }

  TimelineHistoryConnection _history = TimelineHistoryConnection(
    const RetainedTimelineHistory(),
  );
  final Map<String, RepositoryPageStatus> _failures = {};
  final Set<String> _firstPageRetries = {};
  final _followRemovals = StreamController<TimelineFollowRemoval>.broadcast(
    sync: true,
  );

  Stream<TimelineFollowRemoval> get followRemovals => _followRemovals.stream;

  @override
  TimelineViewState build() {
    ref.watch(timelineCacheLifecycleProvider);
    final lifecycle = AppLifecycleListener(
      onResume: () => unawaited(pruneRetainedHistory()),
    );
    ref.listen(sessionControllerProvider, (previous, next) {
      _onSessionChanged();
    });
    final transitions = ref
        .read(sessionControllerProvider.notifier)
        .transitions
        .listen((event) {
          if (event is IdentityCleared) {
            _generation++;
          }
        });
    ref.onDispose(() {
      _generation += 1;
      _followRemovals.close();
      transitions.cancel();
      lifecycle.dispose();
    });
    final context = _sessionContext();
    if (context != null) {
      _context = context;
      final ticket = ++_generation;
      Future<void>.microtask(() => _restoreAndStart(ticket));
    }
    return const TimelineViewState.inactive();
  }

  /// Reads one coordinated round for every Followed Repository.
  Future<void> refresh() async {
    if (state.cacheSettings.saving || state.cacheSettings.clearing) return;
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
    await _startCycle(++_generation);
  }

  /// Re-reads the account's Release Follows and starts a new cycle, so a
  /// changed follow set cannot keep reusing the previous window.
  Future<void> reloadFollows() async {
    final context = _sessionContext();
    if (context == null) return;
    while (_cacheAction != null) {
      await _cacheAction;
    }
    if (!ref.mounted || context != _sessionContext()) return;
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
    while (_cacheAction != null) {
      await _cacheAction;
    }
    if (!ref.mounted || context != _sessionContext()) return;
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
    if (state.loading ||
        state.cacheSettings.saving ||
        state.cacheSettings.clearing ||
        !state.active ||
        !state.canLoadOlder) {
      return;
    }
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
    if (state.loading ||
        state.cacheSettings.saving ||
        state.cacheSettings.clearing ||
        !state.active ||
        !state.canRetry) {
      return;
    }
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
    await _acceptRound(
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
    _retentionDays = null;
    unawaited(_restoreAndStart(++_generation));
  }

  /// The signed-in account and its backend, which scope every stored rule.
  String? _sessionContext() {
    final session = ref.read(sessionControllerProvider);
    if (session.phase != SessionPhase.signedIn) return null;
    final identity = session.identity;
    if (identity == null) return null;
    return TimelineCache.scopeOf(identity) ??
        '${identity.backend}|${identity.login.toLowerCase()}';
  }

  Future<void> _restoreAndStart(int ticket) async {
    final identity = ref.read(sessionControllerProvider).identity;
    final scope = identity == null ? null : TimelineCache.scopeOf(identity);
    if (scope != null) {
      try {
        final saved = await ref
            .read(timelineCacheProvider)
            .restore(
              scope: scope,
              now: ref.read(timelineClockProvider)(),
              environment: ref.read(timelineEnvironmentProvider),
            );
        if (!_isCurrent(ticket)) return;
        if (saved != null) {
          _retentionDays = saved.retentionDays;
          _followedRepositories = saved.repositories;
          state = TimelineViewState(
            active: true,
            loading: true,
            cacheSettings: state.cacheSettings,
            hasFollows: saved.repositories.isNotEmpty,
            groups: saved.groups,
            previousBaseline: saved.baseline,
            baselineExposed: isBaselineExposed(
              saved.baseline,
              saved.lowerBound,
            ),
            loadedNewCount: countLoadedNewReleases(
              saved.groups,
              saved.baseline,
            ),
            partial: saved.partial,
            savedAt: saved.savedAt,
            restored: true,
            offline: ref.read(sessionControllerProvider).offline,
          );
        }
      } catch (_) {
        if (!_isCurrent(ticket)) return;
        state = state.copyWith(cacheFailed: true);
      }
    }
    if (_isCurrent(ticket)) await _startCycle(ticket);
  }

  TimelineRelease? savedRelease({
    required String owner,
    required String repository,
    int? id,
    String? tag,
  }) {
    if (_sessionContext() == null) return null;
    for (final item in state.groups.expand((group) => group.items)) {
      if (item.repository.owner.toLowerCase() == owner.toLowerCase() &&
          item.repository.name.toLowerCase() == repository.toLowerCase() &&
          (id != null ? item.id == id : item.tagName == tag)) {
        return item;
      }
    }
    return null;
  }

  Future<void> pruneRetainedHistory() async {
    final identity = ref.read(sessionControllerProvider).identity;
    final scope = identity == null ? null : TimelineCache.scopeOf(identity);
    if (scope == null) return;
    final ticket = _generation;
    try {
      final saved = await ref
          .read(timelineCacheProvider)
          .restore(
            scope: scope,
            now: ref.read(timelineClockProvider)(),
            environment: ref.read(timelineEnvironmentProvider),
          );
      if (_isCurrent(ticket) && state.restored && saved != null) {
        state = state.copyWith(
          groups: saved.groups,
          loadedNewCount: countLoadedNewReleases(saved.groups, saved.baseline),
        );
      }
    } catch (_) {
      if (_isCurrent(ticket)) state = state.copyWith(cacheFailed: true);
    }
  }

  /// Applies an account preference only after the server confirms persistence.
  Future<void> saveRetention(int days) =>
      _runCacheAction(() => _saveRetention(days));

  Future<void> _runCacheAction(Future<void> Function() action) async {
    if (_cacheAction != null) return;
    final completed = Completer<void>();
    _cacheAction = completed.future;
    try {
      await action();
    } finally {
      _cacheAction = null;
      completed.complete();
    }
  }

  Future<void> _saveRetention(int days) async {
    if (_sessionContext() == null ||
        state.loading ||
        state.cacheSettings.saving ||
        state.cacheSettings.clearing) {
      return;
    }
    if (validatedRetentionDays(days) == null) {
      state = state.copyWith(
        cacheSettings: state.cacheSettings.copyWith(saveFailed: true),
      );
      return;
    }
    final ticket = _generation;
    state = state.copyWith(
      cacheSettings: state.cacheSettings.copyWith(
        saving: true,
        saveFailed: false,
      ),
    );
    final result = await ref
        .read(releaseTimelineServiceProvider)
        .saveRetention(days);
    if (!_isCurrent(ticket)) return;
    if (result.data == null) {
      state = state.copyWith(
        cacheSettings: state.cacheSettings.copyWith(
          saving: false,
          saveFailed: true,
        ),
      );
      return;
    }
    _retentionDays = days;
    state = state.copyWith(
      cacheSettings: state.cacheSettings.copyWith(syncFailed: false),
    );
    final identity = ref.read(sessionControllerProvider).identity;
    final scope = identity == null ? null : TimelineCache.scopeOf(identity);
    if (scope != null) {
      try {
        await ref
            .read(timelineCacheProvider)
            .synchronize(
              scope: scope,
              retentionDays: days,
              repositories: _followedRepositories,
              now: ref.read(timelineClockProvider)(),
              isCurrent: () => _isCurrent(ticket),
            );
        if (!_isCurrent(ticket)) return;
        await _loadHistory(ticket);
        if (!_isCurrent(ticket)) return;
        await pruneRetainedHistory();
      } catch (_) {
        if (!_isCurrent(ticket)) return;
        _retentionDays = null;
        state = state.copyWith(cacheFailed: true);
      }
    }
    if (_isCurrent(ticket)) {
      state = state.copyWith(
        cacheSettings: state.cacheSettings.copyWith(saving: false),
      );
    }
  }

  /// Clears local content and continuation state without an account mutation.
  Future<void> clearCache() => _runCacheAction(_clearCache);

  Future<void> _clearCache() async {
    if (_sessionContext() == null ||
        state.cacheSettings.clearing ||
        state.cacheSettings.saving) {
      return;
    }
    final ticket = ++_generation;
    _cycle = TimelineCycle.empty;
    _cycleId = '${DateTime.now().microsecondsSinceEpoch}:$_generation';
    _awaitingFreshWindow = true;
    _history = TimelineHistoryConnection(const RetainedTimelineHistory());
    _failures.clear();
    _firstPageRetries.clear();
    state = TimelineViewState(
      active: true,
      hasFollows: _followedRepositories.isNotEmpty,
      cacheSettings: state.cacheSettings.copyWith(
        clearing: true,
        clearFailed: false,
        cleared: false,
      ),
    );
    try {
      await ref.read(timelineCacheProvider).clearHistory();
      if (!_isCurrent(ticket)) return;
      state = state.copyWith(
        cacheSettings: state.cacheSettings.copyWith(
          clearing: false,
          cleared: true,
        ),
      );
    } catch (_) {
      if (!_isCurrent(ticket)) return;
      state = state.copyWith(
        cacheFailed: true,
        cacheSettings: state.cacheSettings.copyWith(
          clearing: false,
          clearFailed: true,
        ),
      );
    }
  }

  Future<void> _startCycle(
    int ticket, {
    List<TimelineRepository>? confirmedFollows,
  }) async {
    if (!_isCurrent(ticket)) return;
    _followsKnown = false;
    _failures.clear();
    _firstPageRetries.clear();
    _awaitingFreshWindow = true;
    _cycleId = '${DateTime.now().microsecondsSinceEpoch}:$_generation';
    _history = TimelineHistoryConnection(const RetainedTimelineHistory());
    state = state.copyWith(
      active: true,
      loading: true,
      clearFailure: true,
      unavailableRepositories: const [],
      transientRepositories: const [],
      partial: false,
      canRetry: false,
      canLoadOlder: false,
      persistenceFailed: false,
    );

    final settings = confirmedFollows == null
        ? await ref.read(releaseTimelineServiceProvider).readSettings()
        : null;
    if (!_isCurrent(ticket)) return;

    if (confirmedFollows == null && settings?.data == null) {
      state = state.copyWith(
        cacheSettings: state.cacheSettings.copyWith(
          syncFailed: true,
          saving: false,
        ),
      );
      _followsKnown = false;
      if (settings?.failure?.kind != TimelineFailureKind.session) {
        await _loadHistory(ticket);
        if (!_isCurrent(ticket)) return;
        await _runRound(ticket, inferFollows: _followedRepositories.isEmpty);
        if (_isCurrent(ticket)) state = state.copyWith(canRetry: true);
        return;
      }
      _fail(ticket, settings?.failure);
      return;
    }

    final follows =
        confirmedFollows ?? mapFollowedRepositories(settings!.data!);
    final sameFollows =
        follows.length == _followedRepositories.length &&
        follows.every(
          (item) => _followedRepositories.any((old) => old.id == item.id),
        );
    if (!sameFollows) _cycle = TimelineCycle.empty;
    _retentionDays =
        settings?.data?.releaseTimeline?.retentionDays ?? _retentionDays;
    state = state.copyWith(
      cacheSettings: state.cacheSettings.copyWith(
        syncFailed:
            confirmedFollows == null &&
            settings?.data?.releaseTimeline?.retentionDays == null,
        saving: false,
      ),
    );
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
    if (removed.isNotEmpty) {
      state = state.copyWith(
        groups: [
          for (final group in state.groups)
            if (group.items.any((item) => nextIds.contains(item.repository.id)))
              TimelineGroup(
                date: group.date,
                items: group.items
                    .where((item) => nextIds.contains(item.repository.id))
                    .toList(),
              ),
        ],
      );
    }
    final scope = identity == null ? null : TimelineCache.scopeOf(identity);
    if (scope != null) {
      try {
        await ref
            .read(timelineCacheProvider)
            .synchronize(
              scope: scope,
              retentionDays: _retentionDays,
              repositories: follows,
              now: ref.read(timelineClockProvider)(),
              isCurrent: () => _isCurrent(ticket),
            );
      } catch (_) {
        if (!_isCurrent(ticket)) return;
        // Content must not be saved under an older policy when the newly
        // synchronized account preference could not be committed locally.
        _retentionDays = null;
        state = state.copyWith(cacheFailed: true);
      }
      if (!_isCurrent(ticket)) return;
      await _loadHistory(ticket);
      if (!_isCurrent(ticket)) return;
      if (state.restored) {
        await pruneRetainedHistory();
        if (!_isCurrent(ticket)) return;
      }
    }
    if (follows.isEmpty) {
      _followedRepositories = const [];
      _cycle = TimelineCycle.empty;
      state = TimelineViewState(
        active: true,
        hasFollows: false,
        cacheSettings: state.cacheSettings,
        cacheFailed: state.cacheFailed,
      );
      return;
    }

    _followedRepositories = follows;
    await _runRound(ticket);
  }

  Future<void> _loadHistory(int ticket) async {
    final identity = ref.read(sessionControllerProvider).identity;
    final scope = identity == null ? null : TimelineCache.scopeOf(identity);
    if (scope == null || _retentionDays == null) return;
    try {
      final history = await ref
          .read(timelineCacheProvider)
          .readHistory(scope: scope, now: ref.read(timelineClockProvider)());
      if (_isCurrent(ticket)) _history = TimelineHistoryConnection(history);
    } catch (_) {
      if (_isCurrent(ticket)) state = state.copyWith(cacheFailed: true);
    }
  }

  Future<void> _runRound(int ticket, {bool inferFollows = false}) async {
    if (!_isCurrent(ticket)) return;
    state = state.copyWith(active: true, loading: true, clearFailure: true);

    final response = await ref.read(releaseTimelineServiceProvider).refresh();
    if (!_isCurrent(ticket)) return;

    if (inferFollows) {
      // A failed settings fetch cannot establish a durable retention policy.
      // The authenticated refresh still identifies its successful repositories
      // sufficiently for temporary reading, without treating them as saved follows.
      final pages =
          response.data?.toDomainPages() ?? <String, RepositoryPage>{};
      _followedRepositories = [
        for (final entry in pages.entries)
          if (entry.value.isAvailable &&
              entry.value.owner.isNotEmpty &&
              entry.value.name.isNotEmpty)
            TimelineRepository(
              id: entry.key,
              owner: entry.value.owner,
              name: entry.value.name,
            ),
      ];
      await _acceptRound(ticket, response, pages.keys.toList(), refresh: true);
      if (_isCurrent(ticket) &&
          pages.values.any((page) => !page.isAvailable || page.incomplete)) {
        state = state.copyWith(partial: true);
      }
      return;
    }

    await _acceptRound(ticket, response, [
      for (final follow in _followedRepositories) follow.id,
    ], refresh: true);
  }

  Future<void> _acceptRound(
    int ticket,
    TimelineResult<TimelineRoundDto> response,
    List<String> requestedIds, {
    required bool refresh,
    Map<String, String?> cursors = const {},
  }) async {
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
    _history.accept(
      pages,
      cutoff: ref
          .read(timelineClockProvider)()
          .toUtc()
          .subtract(Duration(days: _retentionDays ?? 1)),
    );
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
    final startsWindow = refresh || _awaitingFreshWindow;
    var result = mergeTimelineRound(
      cycle: _cycle,
      followedRepositories: _followedRepositories,
      pages: pages,
      requestedIds: startsWindow
          ? [for (final repository in _followedRepositories) repository.id]
          : requestedIds,
      refresh: startsWindow,
      environment: ref.read(timelineEnvironmentProvider),
      capturedBaseline: refresh
          ? round.refresh?.previousBaseline
          : _cycle.previousBaseline,
    );
    _awaitingFreshWindow = false;
    _cycle = result.cycle;
    final extension = _history.extensionPages(
      _cycle,
      now: ref.read(timelineClockProvider)(),
      retentionDays: _retentionDays ?? 1,
    );
    if (extension.isNotEmpty) {
      result = mergeTimelineRound(
        cycle: _cycle,
        followedRepositories: _followedRepositories,
        pages: const {},
        requestedIds: const [],
        retainedPages: extension,
        refresh: false,
        environment: ref.read(timelineEnvironmentProvider),
      );
      _cycle = result.cycle;
    }

    final baseline = _cycle.previousBaseline;
    final unavailable = _failedRepositories(RepositoryPageStatus.unavailable);
    final transient = _failedRepositories(RepositoryPageStatus.transient);

    state = TimelineViewState(
      active: true,
      loading: true,
      cacheSettings: state.cacheSettings,
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
      cacheFailed: state.cacheFailed,
      savedAt: state.savedAt,
      cacheConnection: _cacheConnection,
      waitingRepositories: _repositoriesFor(
        _history.waitingRepositories.toList(),
      ),
    );
    final identity = ref.read(sessionControllerProvider).identity;
    final scope = identity == null ? null : TimelineCache.scopeOf(identity);
    if (scope != null && _retentionDays != null) {
      final now = ref.read(timelineClockProvider)();
      try {
        await ref
            .read(timelineCacheProvider)
            .save(
              scope: scope,
              cycleId: _cycleId,
              pages: pages,
              cursors: cursors,
              groups: result.groups,
              cycle: _cycle,
              now: now,
              isCurrent: () => _isCurrent(ticket),
              obsoleteRepositories: Set.of(_history.obsoleteRepositories),
            );
        if (_isCurrent(ticket)) {
          state = state.copyWith(savedAt: now, cacheFailed: false);
        }
      } catch (_) {
        if (_isCurrent(ticket)) state = state.copyWith(cacheFailed: true);
      }
    }
    if (_isCurrent(ticket)) state = state.copyWith(loading: false);
  }

  bool get _canLoadOlder => _cycle.pages.entries.any(
    (entry) =>
        !_cycle.failedIds.contains(entry.key) && entry.value.hasOlderReleases,
  );

  TimelineCacheConnection get _cacheConnection => !_history.hasRetainedHistory
      ? TimelineCacheConnection.none
      : _history.connected
      ? TimelineCacheConnection.connected
      : TimelineCacheConnection.waiting;

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
      baselineExposed: state.restored
          ? state.baselineExposed
          : isBaselineExposed(baseline, _cycle.windowLowerBound),
      offline: failure?.kind == TimelineFailureKind.network,
      cacheConnection: _cacheConnection,
      waitingRepositories: _repositoriesFor(
        _history.waitingRepositories.toList(),
      ),
    );
  }

  bool _isCurrent(int ticket) => ref.mounted && ticket == _generation;
}
