import 'dart:async';

import '../repositories/repository_models.dart';
import 'timeline_cache.dart';
import 'timeline_content_state.dart';
import 'timeline_dto.dart';
import 'timeline_history.dart';
import 'timeline_models.dart';
import 'timeline_service.dart';
import 'timeline_state.dart';

export 'timeline_content_state.dart';

part 'timeline_content_journal.dart';

/// The account's current unfiltered timeline and its local recovery lifecycle.
///
/// Accepted pages, connected history and commit progress have one owner. Changes
/// are published before saving; asynchronous commands finish after the attempt.
final class TimelineContentController {
  TimelineContentController({
    required this._cache,
    required this._rebuild,
    required this._clock,
    required this._environment,
    required this._scope,
    required this._generation,
    required this._invalidate,
    required this._isCurrent,
    required this._resolveRetention,
    this._onChanged,
  });

  final TimelineCache Function() _cache;
  final Future<void> Function(bool Function()) _rebuild;
  final DateTime Function() _clock;
  final TimelineEnvironment Function() _environment;
  final String? Function() _scope;
  final int Function() _generation;
  final int Function() _invalidate;
  final bool Function(int) _isCurrent;
  final Future<int?> Function() _resolveRetention;
  final void Function()? _onChanged;
  TimelineContentState _value = const TimelineContentState();

  TimelineContentState get snapshot => _value;
  TimelineContentState get _state => _value;
  set _state(TimelineContentState value) {
    _value = value;
    _onChanged?.call();
  }

  List<RepositoryReference> _followedRepositories = const [];
  TimelineCycle _cycle = TimelineCycle.empty;
  bool _followsKnown = false;
  bool _awaitingFreshWindow = true;
  String _cycleId = '';
  Future<void>? _cacheAction;
  bool _retentionIncomplete = false;
  SavedTimeline? _loadedVisible;
  final _journal = _FetchedPageJournal();
  bool _cacheSynchronized = false;

  /// How many days of published releases this installation keeps.
  ///
  /// Null until the device's own window is known. Nothing is pruned or saved
  /// before that: a guessed window would delete saved records the real one
  /// keeps, and a deleted record cannot be recovered.
  int? _retentionWindow;

  TimelineHistoryConnection _history = TimelineHistoryConnection(
    const RetainedTimelineHistory(),
  );
  final Map<String, RepositoryQueryStatus> _failures = {};
  final Set<String> _firstPageRetries = {};

  List<RepositoryReference> get followedRepositories =>
      List.unmodifiable(_followedRepositories);
  bool get followsKnown => _followsKnown;

  Map<String, String?> get olderCursors => {
    for (final repository in _followedRepositories)
      if (!_cycle.failedIds.contains(repository.id) &&
          _cycle.pages[repository.id]?.hasOlderReleases == true)
        repository.id: _cycle.pages[repository.id]?.endCursor,
  };

  Map<String, String?> retryCursors(String? repositoryId) => {
    for (final repository in _followedRepositories)
      if (_cycle.failedIds.contains(repository.id) &&
          (repositoryId == null || repository.id == repositoryId))
        repository.id: _firstPageRetries.contains(repository.id)
            ? null
            : _cycle.pages[repository.id]?.endCursor,
  };

  void reset({required bool active}) {
    _followedRepositories = const [];
    _followsKnown = false;
    _cycle = TimelineCycle.empty;
    _journal.clear();
    _retentionIncomplete = false;
    _retentionWindow = null;
    _loadedVisible = null;
    _cacheSynchronized = false;
    _awaitingFreshWindow = true;
    _history = TimelineHistoryConnection(const RetainedTimelineHistory());
    _failures.clear();
    _firstPageRetries.clear();
    _state = TimelineContentState(active: active, loading: active);
  }

  void beginLoading() =>
      _state = _state.copyWith(active: true, loading: true, clearFailure: true);

  void beginRefresh() => _state = _state.copyWith(
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

  void beginFreshWindow() {
    _failures.clear();
    _firstPageRetries.clear();
    _awaitingFreshWindow = true;
    _history = TimelineHistoryConnection(const RetainedTimelineHistory());
  }

  void confirmFollows(List<RepositoryReference> repositories) {
    _setFollowedRepositories(List.unmodifiable(repositories));
    _followsKnown = true;
  }

  void markFollowsKnown(bool known) {
    _followsKnown = known;
  }

  void offerRetry() => _state = _state.copyWith(canRetry: true);

  void showEmpty() {
    _followedRepositories = const [];
    _cycle = TimelineCycle.empty;
    _state = TimelineContentState(
      active: true,
      cacheActions: _state.cacheActions,
      cacheFailed: _state.cacheFailed,
      cacheCorrupted: _state.cacheCorrupted,
    );
  }

  void adoptRetentionWindow(int days) {
    _retentionWindow = days;
    _retentionIncomplete = true;
  }

  Future<void> resolveRetentionWindow() => _ensureRetentionWindow();
  Future<void> _ensureRetentionWindow() async {
    final ticket = _generation();
    final scope = _scope();
    final days = await _resolveRetention();
    if (_isCurrent(ticket) && _scope() == scope) _retentionWindow = days;
  }

  Future<int?> lastSavedRetentionDays(String scope) =>
      _cache().lastSavedRetentionDays(scope: scope);

  void reportCacheFailure(Object error) => _cacheFailure(error);

  /// The current admission barrier, awaited directly to retain lifecycle order.
  Future<void>? get pendingCacheAction => _cacheAction;

  Future<void> prepareHistory(int ticket, {bool synchronize = true}) async {
    final scope = _scope();
    if (scope == null) return;
    if (synchronize) {
      try {
        await _synchronizeCache(scope, ticket);
      } catch (error) {
        if (_isCurrent(ticket)) _cacheFailure(error);
      }
      if (!_isCurrent(ticket)) return;
    }
    await _loadHistory(ticket);
    if (_isCurrent(ticket) && _state.restored && synchronize) {
      await pruneRetainedHistory();
    }
  }

  Future<bool> applyRetentionWindow(int days, int ticket) async {
    var applied = false;
    await _runCacheAction(() async {
      applied = await _applyRetentionWindow(days, ticket);
    });
    return applied;
  }

  Future<void> clear() => _runCacheAction(_clearCache);

  /// Retries local work, awaiting facade initialization when no policy is known.
  Future<void> retrySaving({
    bool offline = false,
    Future<void> Function()? initialize,
  }) async {
    await _runCacheAction(() async {
      if (_scope() == null || _state.loading || _state.cacheCorrupted) return;
      final ticket = _generation();
      if (_retentionIncomplete && _retentionWindow != null) {
        await _applyRetentionWindow(_retentionWindow!, ticket);
        return;
      }
      if (!_journal.hasPages && _state.cacheFailed && !_followsKnown) {
        _state = _state.copyWith(loading: true);
        await restore(ticket, offline: offline);
        if (_isCurrent(ticket)) _state = _state.copyWith(loading: false);
        return;
      }
      if (_retentionWindow == null) {
        await initialize?.call();
        return;
      }
      _state = _state.copyWith(loading: true);
      if (!_cacheSynchronized) {
        try {
          await _synchronizeCache(_scope()!, ticket);
        } catch (error) {
          if (_isCurrent(ticket)) {
            _cacheFailure(error);
            _state = _state.copyWith(loading: false);
          }
          return;
        }
        if (!_isCurrent(ticket)) return;
      }
      if (_journal.hasPages) {
        await _persistCurrent(ticket);
      } else if (_isCurrent(ticket)) {
        _state = _state.copyWith(cacheFailed: false);
      }
      if (_isCurrent(ticket)) _state = _state.copyWith(loading: false);
    });
  }

  Future<void> acceptRefresh(
    int ticket,
    TimelineResult<TimelineRoundDto> response, {
    bool inferFollows = false,
  }) async {
    if (inferFollows) {
      final pages =
          response.data?.toDomainPages() ?? <String, RepositoryPage>{};
      _followedRepositories = [
        for (final entry in pages.entries)
          if (entry.value.isAvailable &&
              entry.value.owner.isNotEmpty &&
              entry.value.name.isNotEmpty)
            RepositoryReference(
              id: entry.key,
              owner: entry.value.owner,
              name: entry.value.name,
            ),
      ];
      await acceptRound(ticket, response, pages.keys.toList(), refresh: true);
      if (_isCurrent(ticket) &&
          pages.values.any((page) => !page.isAvailable || page.incomplete)) {
        _state = _state.copyWith(partial: true);
      }
      return;
    }
    await acceptRound(ticket, response, [
      for (final follow in _followedRepositories) follow.id,
    ], refresh: true);
  }

  void _setFollowedRepositories(List<RepositoryReference> repositories) {
    final previousIds = _followedRepositories.map((item) => item.id).toSet();
    final byId = {
      for (final repository in repositories) repository.id: repository,
    };
    _followedRepositories = repositories;
    if (byId.keys.any((id) => !previousIds.contains(id))) {
      _journal.clear();
      _cycle = TimelineCycle.empty;
      _awaitingFreshWindow = true;
      _history = TimelineHistoryConnection(const RetainedTimelineHistory());
      _failures.clear();
      _firstPageRetries.clear();
      _state = TimelineContentState(
        active: true,
        loading: true,
        hasFollows: true,
        window: const TimelineWindow.empty(),
        cacheActions: _state.cacheActions,
        cacheFailed: _state.cacheFailed,
        cacheCorrupted: _state.cacheCorrupted,
      );
      return;
    }
    _journal.retainRepositories(byId);
    _cycle = TimelineCycle(
      pages: {
        for (final entry in _cycle.pages.entries)
          if (byId.containsKey(entry.key))
            entry.key: entry.value.withRepository(byId[entry.key]!),
      },
      failedIds: _cycle.failedIds.intersection(byId.keys.toSet()),
      windowLowerBound: _cycle.windowLowerBound,
      previousBaseline: _cycle.previousBaseline,
      partial: _cycle.partial,
    );
    _history.retainRepositories(byId.keys.toSet());
    _failures.removeWhere((id, _) => !byId.containsKey(id));
    _firstPageRetries.retainAll(byId.keys);
    final groups = [
      for (final group in _state.groups)
        if (group.items.any((item) => byId.containsKey(item.repository.id)))
          TimelineGroup(
            date: group.date,
            items: [
              for (final item in group.items)
                if (byId.containsKey(item.repository.id))
                  item.withRepository(byId[item.repository.id]!),
            ],
          ),
    ];
    _state = _state.copyWith(
      window: TimelineWindow(
        groups: groups,

        previousBaseline: _state.previousBaseline,
        windowLowerBound: repositories.isEmpty
            ? null
            : _state.window.windowLowerBound,
      ),
    );
  }

  Future<void> applyFollows(
    int ticket,
    List<RepositoryReference> repositories, {
    bool preserveLoading = false,
  }) async {
    _setFollowedRepositories(repositories);
    if (_cycle.pages.isNotEmpty) {
      final result = mergeTimelineRound(
        cycle: _cycle,
        followedRepositories: repositories,
        pages: const {},
        requestedIds: const [],
        retainedPages: _history.extensionPages(
          _cycle,
          now: _clock(),
          retentionDays: _retentionWindow ?? 1,
        ),
        refresh: false,
        environment: _environment(),
      );
      _cycle = result.cycle;
      _state = _state.copyWith(
        window: TimelineWindow(
          groups: result.groups,

          previousBaseline: _state.previousBaseline,
          windowLowerBound: _cycle.windowLowerBound,
        ),
      );
    }
    _state = _state.copyWith(
      loading: preserveLoading ? null : true,
      hasFollows: repositories.isNotEmpty,
      partial: _cycle.pages.isNotEmpty
          ? _cycle.partial
          : _state.partial && repositories.isNotEmpty,
      unavailableRepositories: _failedRepositories(
        RepositoryQueryStatus.unavailable,
      ),
      transientRepositories: _failedRepositories(
        RepositoryQueryStatus.transient,
      ),
      canRetry: _cycle.failedIds.isNotEmpty,
      canLoadOlder: _canLoadOlder,
      clearFailure: _cycle.failedIds.isEmpty,
      cacheConnection: _cacheConnection,
      waitingRepositories: _repositoriesFor(
        _history.waitingRepositories.toList(),
      ),
    );
    final scope = _scope();
    try {
      if (scope != null) {
        await _synchronizeCache(scope, ticket);
        if (!_isCurrent(ticket)) return;
        _state = _state.copyWith(cacheFailed: false);
        if (_cycle.pages.isNotEmpty) await _persistCurrent(ticket);
      }
    } catch (error) {
      if (_isCurrent(ticket)) _cacheFailure(error);
    }
    if (_isCurrent(ticket) && !preserveLoading) {
      _state = _state.copyWith(loading: false);
    }
  }

  Future<void> restore(int ticket, {bool offline = false}) async {
    final scope = _scope();
    if (scope != null) {
      try {
        final saved = await _cache().restore(
          scope: scope,
          now: _clock(),
          environment: _environment(),
          retentionDays: _retentionWindow,
          isCurrent: () => _isCurrent(ticket),
        );
        if (!_isCurrent(ticket)) return;
        if (saved != null) {
          _loadedVisible = saved;
          _cacheSynchronized = true;
          _followedRepositories = saved.repositories;
          _state = TimelineContentState(
            active: true,
            loading: true,
            cacheActions: _state.cacheActions,
            hasFollows: saved.repositories.isNotEmpty,
            window: TimelineWindow(
              groups: saved.groups,

              previousBaseline: saved.baseline,
              windowLowerBound: saved.lowerBound,
            ),
            partial: saved.partial,
            savedAt: saved.savedAt,
            restored: true,
            offline: offline,
          );
        }
      } catch (error) {
        if (!_isCurrent(ticket)) return;
        _cacheFailure(error);
      }
    }
  }

  Future<void> pruneRetainedHistory() async {
    final scope = _scope();
    if (scope == null) return;
    final ticket = _generation();
    try {
      await _pruneRetainedHistory(ticket);
    } catch (error) {
      if (_isCurrent(ticket)) _cacheFailure(error);
    }
  }

  Future<void> _pruneRetainedHistory(int ticket) async {
    final scope = _scope();
    if (scope == null) return;
    if (!_state.restored || !_cacheSynchronized) {
      await _cache().prune(
        scope: scope,
        now: _clock(),
        isCurrent: () => _isCurrent(ticket),
        retentionDays: _retentionWindow,
      );
      return;
    }
    final saved = await _cache().restore(
      scope: scope,
      now: _clock(),
      environment: _environment(),
      retentionDays: _retentionWindow,
      previous: _loadedVisible,
      isCurrent: () => _isCurrent(ticket),
    );
    if (_isCurrent(ticket) &&
        _state.restored &&
        saved != null &&
        _cacheSynchronized) {
      // The projection owns a frozen copy; compare the saved source windows to
      // retain an unchanged projection and its prepared search data.
      final groupsChanged = !identical(_loadedVisible?.groups, saved.groups);
      _loadedVisible = saved;
      if (groupsChanged) {
        _state = _state.copyWith(
          window: TimelineWindow(
            groups: saved.groups,

            previousBaseline: saved.baseline,
            windowLowerBound: _state.window.windowLowerBound,
          ),
        );
      }
    }
  }

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

  Future<bool> _applyRetentionWindow(int days, int ticket) async {
    if (!_isCurrent(ticket) || _scope() == null || !_followsKnown) {
      return false;
    }
    _retentionWindow = days;
    _retentionIncomplete = true;
    final scope = _scope();
    if (scope == null) return false;
    try {
      await _synchronizeCache(scope, ticket);
      if (!_isCurrent(ticket)) return false;
      if (_journal.needsSaving) {
        await _persistCurrent(ticket, propagateFailure: true);
        if (!_isCurrent(ticket)) return false;
      }
      await _loadHistory(
        ticket,
        replayCurrentPages: true,
        propagateFailure: true,
      );
      if (!_isCurrent(ticket)) return false;
      await _pruneRetainedHistory(ticket);
      if (!_isCurrent(ticket)) return false;
      _retentionIncomplete = false;
      _state = _state.copyWith(cacheFailed: false);
      return true;
    } catch (error) {
      if (_isCurrent(ticket)) _cacheFailure(error);
      return false;
    }
  }

  Future<void> rebuild() => _runCacheAction(() async {
    final scope = _scope();
    if (_scope() == null || scope == null) return;
    final ticket = _invalidate();
    _state = _state.copyWith(
      loading: true,
      cacheActions: _state.cacheActions.copyWith(clearing: true),
    );
    _cacheSynchronized = false;
    try {
      await _rebuild(() => _isCurrent(ticket));
      if (!_isCurrent(ticket)) return;
      await _synchronizeCache(scope, ticket);
      if (!_isCurrent(ticket)) return;
      _journal.forgetCommit();
      _history = TimelineHistoryConnection(const RetainedTimelineHistory());
      // Rebuild from the actual fetched pages, excluding the discarded cached
      // extension. No synthetic page can certify a connection to old history.
      final recovered = _journal.replayContent(
        repositories: _followedRepositories,
        environment: _environment(),
        failedIds: _cycle.failedIds,
        previousBaseline: _state.previousBaseline,
      );
      _cycle = recovered.cycle;
      _state = _state.copyWith(
        window: TimelineWindow(
          groups: recovered.groups,

          previousBaseline: _state.previousBaseline,
          windowLowerBound: _cycle.windowLowerBound,
        ),
        cacheFailed: false,
        cacheCorrupted: false,
        restored: false,
        partial: _cycle.partial,
        clearSavedAt: true,
        cacheConnection: TimelineCacheConnection.none,
        waitingRepositories: const [],
        canLoadOlder: _canLoadOlder,
      );
      if (_journal.hasPages) await _persistCurrent(ticket);
    } catch (error) {
      if (_isCurrent(ticket)) _cacheFailure(error);
    } finally {
      if (_isCurrent(ticket)) {
        _state = _state.copyWith(
          loading: false,
          cacheActions: _state.cacheActions.copyWith(clearing: false),
        );
      }
    }
  });

  Future<void> _synchronizeCache(String scope, int ticket) async {
    // Nothing may be written before this installation's window is known: a
    // follow set that is not restored yet would delete the saved history it does
    // not name, and nothing may be pruned on a guessed policy. A round that
    // started while the device was still being read waits for it here.
    await _ensureRetentionWindow();
    if (!_isCurrent(ticket) || _retentionWindow == null) return;
    // Nor before this session has a confirmed follow set: a history keyed to
    // repositories nobody confirmed would be written, and its neighbours deleted.
    if (!_followsKnown) return;
    _cacheSynchronized = false;
    await _cache().synchronize(
      scope: scope,
      retentionDays: _retentionWindow,
      repositories: _followedRepositories,
      now: _clock(),
      isCurrent: () => _isCurrent(ticket),
    );
    if (_isCurrent(ticket)) _cacheSynchronized = true;
  }

  void _cacheFailure(Object error) {
    _state = _state.copyWith(
      cacheFailed: true,
      cacheCorrupted: _state.cacheCorrupted || error is TimelineCacheCorruption,
    );
  }

  Future<void> _clearCache() async {
    if (_scope() == null || _state.cacheActions.clearing) {
      return;
    }
    final ticket = _invalidate();
    _journal.clear();
    _cycle = TimelineCycle.empty;
    _cycleId = '${DateTime.now().microsecondsSinceEpoch}:${_generation()}';
    _awaitingFreshWindow = true;
    _history = TimelineHistoryConnection(const RetainedTimelineHistory());
    _failures.clear();
    _firstPageRetries.clear();
    _state = TimelineContentState(
      active: true,
      hasFollows: _followedRepositories.isNotEmpty,
      window: const TimelineWindow.empty(),
      cacheCorrupted: _state.cacheCorrupted,
      cacheActions: _state.cacheActions.copyWith(
        clearing: true,
        clearFailed: false,
        cleared: false,
      ),
    );
    try {
      await _cache().clearHistory();
      if (!_isCurrent(ticket)) return;
      _state = _state.copyWith(
        cacheCorrupted: false,
        cacheActions: _state.cacheActions.copyWith(
          clearing: false,
          cleared: true,
        ),
      );
    } catch (error) {
      if (!_isCurrent(ticket)) return;
      _cacheFailure(error);
      _state = _state.copyWith(
        cacheActions: _state.cacheActions.copyWith(
          clearing: false,
          clearFailed: true,
        ),
      );
    }
  }

  Future<void> _loadHistory(
    int ticket, {
    bool replayCurrentPages = false,
    bool propagateFailure = false,
  }) async {
    final scope = _scope();
    if (scope == null ||
        _retentionWindow == null ||
        !_cacheSynchronized ||
        _state.cacheCorrupted) {
      if (propagateFailure) throw StateError('History is not available');
      return;
    }
    try {
      final history = await _cache().readHistory(scope: scope, now: _clock());
      if (!_isCurrent(ticket)) return;
      _history = TimelineHistoryConnection(history);
      if (replayCurrentPages) {
        final cutoff = _clock().toUtc().subtract(
          Duration(days: _retentionWindow!),
        );
        _journal.replayConnection(_history, cutoff);
      }
    } catch (error) {
      if (propagateFailure) rethrow;
      if (_isCurrent(ticket)) _cacheFailure(error);
    }
  }

  Future<void> acceptRound(
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
      cursors: cursors,
      cutoff: _clock().toUtc().subtract(Duration(days: _retentionWindow ?? 1)),
    );
    if (round == null || !pages.values.any((page) => page.isUsable)) {
      if (refresh) {
        _firstPageRetries
          ..clear()
          ..addAll(requestedIds);
        _failures.clear();
      }
      failRound(
        ticket,
        response.failure,
        pages: pages,
        requestedIds: requestedIds,
      );
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
    if (startsWindow) {
      _journal.clear();
      _cycleId = '${DateTime.now().microsecondsSinceEpoch}:${_generation()}';
    }
    var result = mergeTimelineRound(
      cycle: _cycle,
      followedRepositories: _followedRepositories,
      pages: pages,
      requestedIds: startsWindow
          ? [for (final repository in _followedRepositories) repository.id]
          : requestedIds,
      refresh: startsWindow,
      environment: _environment(),
      capturedBaseline: refresh
          ? round.refresh?.previousBaseline
          : _cycle.previousBaseline,
    );
    _awaitingFreshWindow = false;
    _cycle = result.cycle;
    final extension = _history.extensionPages(
      _cycle,
      now: _clock(),
      retentionDays: _retentionWindow ?? 1,
    );
    if (extension.isNotEmpty) {
      result = mergeTimelineRound(
        cycle: _cycle,
        followedRepositories: _followedRepositories,
        pages: const {},
        requestedIds: const [],
        retainedPages: extension,
        refresh: false,
        environment: _environment(),
      );
      _cycle = result.cycle;
    }

    final baseline = _cycle.previousBaseline;
    final unavailable = _failedRepositories(RepositoryQueryStatus.unavailable);
    final transient = _failedRepositories(RepositoryQueryStatus.transient);
    _state = TimelineContentState(
      active: true,
      loading: true,
      cacheActions: _state.cacheActions,
      hasFollows: true,
      window: TimelineWindow(
        groups: result.groups,

        previousBaseline: baseline,
        windowLowerBound: _cycle.windowLowerBound,
      ),
      unavailableRepositories: unavailable,
      transientRepositories: transient,
      partial: _cycle.partial || unavailable.isNotEmpty || transient.isNotEmpty,
      canRetry: _cycle.failedIds.isNotEmpty,
      canLoadOlder: _canLoadOlder,
      persistenceFailed: refresh
          ? round.persistenceError != null
          : _state.persistenceFailed || round.persistenceError != null,
      cacheFailed: _state.cacheFailed,
      cacheCorrupted: _state.cacheCorrupted,
      savedAt: _state.savedAt,
      cacheConnection: _cacheConnection,
      waitingRepositories: _repositoriesFor(
        _history.waitingRepositories.toList(),
      ),
    );
    _journal.append(pages, cursors);
    await _persistCurrent(ticket);
    if (_isCurrent(ticket)) _state = _state.copyWith(loading: false);
  }

  Future<void> _persistCurrent(
    int ticket, {
    bool propagateFailure = false,
  }) async {
    final scope = _scope();
    // Durable history also needs a confirmed follow set: without one the cache
    // does not know which repositories this account keeps.
    if (scope != null &&
        _retentionWindow != null &&
        _followsKnown &&
        _cacheSynchronized &&
        !_state.cacheCorrupted) {
      final now = _clock();
      try {
        await _cache().save(
          scope: scope,
          cycleId: _cycleId,
          pages: _journal.pending,
          groups: _state.groups,
          cycle: _cycle,
          now: now,
          isCurrent: () => _isCurrent(ticket),
          obsoleteRepositories: Set.of(_history.obsoleteRepositories),
        );
        if (_isCurrent(ticket)) {
          _journal.acknowledge();
          _state = _state.copyWith(savedAt: now, cacheFailed: false);
        }
      } catch (error) {
        if (_isCurrent(ticket)) {
          _journal.failedSaving();
          _cacheFailure(error);
        }
        if (propagateFailure) rethrow;
      }
    }
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
        _failures[id] = page?.status == RepositoryQueryStatus.unavailable
            ? RepositoryQueryStatus.unavailable
            : RepositoryQueryStatus.transient;
      } else {
        _failures.remove(id);
      }
    }
  }

  List<RepositoryReference> _failedRepositories(RepositoryQueryStatus status) =>
      _repositoriesFor([
        for (final entry in _failures.entries)
          if (entry.value == status) entry.key,
      ]);

  List<RepositoryReference> _repositoriesFor(List<String> ids) {
    final byId = {
      for (final follow in _followedRepositories) follow.id: follow,
    };
    return List.unmodifiable([for (final id in ids) ?byId[id]]);
  }

  /// A round that returned no usable results keeps the releases already read
  /// and its captured baseline, and reports a retryable failure naming the
  /// repositories the backend could not include.
  void failRound(
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
    _state = _state.copyWith(
      active: true,
      loading: false,
      hasFollows: _followedRepositories.isNotEmpty,
      unavailableRepositories: _failedRepositories(
        RepositoryQueryStatus.unavailable,
      ),
      transientRepositories: _failedRepositories(
        RepositoryQueryStatus.transient,
      ),
      partial: true,
      canRetry: true,
      canLoadOlder: _canLoadOlder,
      failure:
          failure ?? const TimelineFailure(TimelineFailureKind.invalidResponse),
      offline: failure?.kind == TimelineFailureKind.network,
      cacheConnection: _cacheConnection,
      waitingRepositories: _repositoriesFor(
        _history.waitingRepositories.toList(),
      ),
    );
  }
}
