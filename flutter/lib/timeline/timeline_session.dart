import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/widgets.dart';

import '../device/device_preferences.dart';
import '../device/device_preferences_controller.dart';
import '../follows/release_follows_session.dart';
import '../follows/release_follows_state.dart';
import '../session/gitpulse_http.dart';
import '../session/session_controller.dart';
import 'timeline_dto.dart';
import 'timeline_filters.dart';
import 'timeline_models.dart';
import 'timeline_service.dart';
import 'timeline_state.dart';
import 'timeline_cache.dart';
import 'timeline_cache_lifecycle.dart';
import 'timeline_history.dart';
import '../repositories/repository_models.dart';

export 'timeline_service.dart'
    show timelineTransportProvider, releaseTimelineServiceProvider;

/// The device clock and display time zone. Tests replace this seam.
final timelineEnvironmentProvider = Provider<TimelineEnvironment>(
  (ref) => TimelineEnvironment.system(),
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

enum RetentionApplication { applied, failed, notApplied }

enum RetentionNotAppliedReason {
  noSession,
  followsUnconfirmed,
  unavailableCacheScope,
  sessionInvalidated,
}

class RetentionChoiceResult {
  const RetentionChoiceResult({
    required this.remembered,
    required this.application,
    this.reason,
  });

  final bool remembered;
  final RetentionApplication application;
  final RetentionNotAppliedReason? reason;
}

class ReleaseTimelineSession extends Notifier<TimelineViewState> {
  List<RepositoryReference> _followedRepositories = const [];
  TimelineCycle _cycle = TimelineCycle.empty;
  String? _context;
  int _generation = 0;
  bool _followsKnown = false;
  int? _synchronizingFollows;
  bool _awaitingFreshWindow = true;
  String _cycleId = '';
  Future<void>? _cacheAction;
  Future<void> _retentionChoices = Future.value();
  bool _retentionIncomplete = false;
  SavedTimeline? _loadedVisible;
  final List<TimelineCachePage> _cyclePages = [];
  int _persistedPageCount = 0;
  bool _currentSaveIncomplete = false;
  bool _cacheSynchronized = false;
  TimelineFilterState _filters = const TimelineFilterState();
  List<TimelineGroup>? _preparedForGroups;
  PreparedTimelineSearch? _preparedSearch;

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
    ref.listen(releaseFollowsSessionProvider, (previous, next) {
      if (!next.active ||
          !next.loaded ||
          identical(previous?.repositories, next.repositories)) {
        return;
      }
      // The cycle awaiting this read applies its result itself. A local edit
      // still takes effect immediately and supersedes that pending cycle.
      if (_synchronizingFollows == _generation && previous?.saving != true) {
        return;
      }
      unawaited(applyFollows(next.repositories));
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
      _synchronizingFollows = ticket;
      Future<void>.microtask(() => _restoreAndStart(ticket));
    }
    return const TimelineViewState.inactive();
  }

  /// Reads one coordinated round for every Followed Repository.
  Future<void> refresh() async {
    if (state.cacheActions.clearing) return;
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
  /// Additions invalidate all history and start at page one. Removals and
  /// metadata changes keep the surviving window without a release request.
  Future<void> applyFollows(List<RepositoryReference> repositories) async {
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
    if (_followsKnown &&
        context == _context &&
        repositories.every(
          (repository) =>
              _followedRepositories.any((old) => old.id == repository.id),
        )) {
      await _applyFollowsLocally(
        repositories.length == _followedRepositories.length
            ? _generation
            : ++_generation,
        List.unmodifiable(repositories),
        preserveLoading: repositories.length == _followedRepositories.length,
      );
      return;
    }
    _context = context;
    await _startCycle(
      ++_generation,
      confirmedFollows: List.unmodifiable(repositories),
    );
  }

  /// The account's currently confirmed Followed Repositories, which the filter
  /// controls offer as options.
  List<RepositoryReference> get followedRepositories =>
      List.unmodifiable(_followedRepositories);

  void _setFollowedRepositories(List<RepositoryReference> repositories) {
    final previousIds = _followedRepositories.map((item) => item.id).toSet();
    final byId = {
      for (final repository in repositories) repository.id: repository,
    };
    final removed = previousIds.difference(byId.keys.toSet());
    _followedRepositories = repositories;
    final identity = ref.read(sessionControllerProvider).identity;
    if (removed.isNotEmpty && identity != null) {
      _followRemovals.add(
        TimelineFollowRemoval(identity: identity, repositoryIds: removed),
      );
    }
    if (byId.keys.any((id) => !previousIds.contains(id))) {
      _cyclePages.clear();
      _currentSaveIncomplete = false;
      _persistedPageCount = 0;
      _cycle = TimelineCycle.empty;
      _awaitingFreshWindow = true;
      _history = TimelineHistoryConnection(const RetainedTimelineHistory());
      _failures.clear();
      _firstPageRetries.clear();
      state = TimelineViewState(
        active: true,
        loading: true,
        hasFollows: true,
        filters: _filters,
        cacheActions: state.cacheActions,
        cacheFailed: state.cacheFailed,
        cacheCorrupted: state.cacheCorrupted,
      );
      return;
    }
    _persistedPageCount = _cyclePages
        .take(_persistedPageCount)
        .where((page) => byId.containsKey(page.repositoryId))
        .length;
    _cyclePages.removeWhere((page) => !byId.containsKey(page.repositoryId));
    for (var i = 0; i < _cyclePages.length; i++) {
      final entry = _cyclePages[i];
      _cyclePages[i] = (
        repositoryId: entry.repositoryId,
        cursor: entry.cursor,
        page: entry.page.withRepository(byId[entry.repositoryId]!),
      );
    }
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
      for (final group in state.groups)
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
    state = _withGroups(state, groups, state.previousBaseline);
  }

  Future<void> _applyFollowsLocally(
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
          now: ref.read(timelineClockProvider)(),
          retentionDays: _retentionWindow ?? 1,
        ),
        refresh: false,
        environment: ref.read(timelineEnvironmentProvider),
      );
      _cycle = result.cycle;
      state = _withGroups(state, result.groups, state.previousBaseline);
    }
    state = state.copyWith(
      loading: preserveLoading ? null : true,
      hasFollows: repositories.isNotEmpty,
      partial: _cycle.pages.isNotEmpty
          ? _cycle.partial
          : state.partial && repositories.isNotEmpty,
      unavailableRepositories: _failedRepositories(
        RepositoryQueryStatus.unavailable,
      ),
      transientRepositories: _failedRepositories(
        RepositoryQueryStatus.transient,
      ),
      canRetry: _cycle.failedIds.isNotEmpty,
      canLoadOlder: _canLoadOlder,
      clearFailure: _cycle.failedIds.isEmpty,
      baselineExposed: _cycle.pages.isNotEmpty
          ? isBaselineExposed(state.previousBaseline, _cycle.windowLowerBound)
          : state.baselineExposed && repositories.isNotEmpty,
      cacheConnection: _cacheConnection,
      waitingRepositories: _repositoriesFor(
        _history.waitingRepositories.toList(),
      ),
    );
    final identity = ref.read(sessionControllerProvider).identity;
    final scope = identity?.account.scope;
    try {
      if (scope != null) {
        await _synchronizeCache(scope, ticket);
        if (!_isCurrent(ticket)) return;
        state = state.copyWith(cacheFailed: false);
        if (_cycle.pages.isNotEmpty) await _persistCurrent(ticket);
      }
    } catch (error) {
      if (_isCurrent(ticket)) _cacheFailure(error);
    }
    if (_isCurrent(ticket) && !preserveLoading) {
      state = state.copyWith(loading: false);
    }
  }

  /// Applies the Active Timeline Filter and Release Timeline Search to the
  /// exposed window. This never requests releases: offline filter changes stay
  /// within the Saved Visible Timeline.
  void applyFilters(TimelineFilterState filters) {
    if (filters == _filters) return;
    _filters = filters;
    state = _withGroups(
      state,
      state.groups,
      state.previousBaseline,
    ).copyWith(filters: filters);
  }

  /// Replaces the exposed window, keeping its filtered view and loaded-new
  /// count in step. Every `groups` write goes through here or through an
  /// equivalent constructor pair.
  TimelineViewState _withGroups(
    TimelineViewState base,
    List<TimelineGroup> groups,
    String? previousBaseline,
  ) {
    final view = _visibleIn(groups, previousBaseline);
    return base.copyWith(
      groups: groups,
      visibleGroups: view.groups,
      loadedNewCount: view.loadedNewCount,
    );
  }

  /// The visible groups and loaded-new count of one exposed window under the
  /// current filters.
  ({List<TimelineGroup> groups, int loadedNewCount}) _visibleIn(
    List<TimelineGroup> exposed,
    String? previousBaseline,
  ) {
    PreparedTimelineSearch? prepared;
    if (_filters.query.trim().isNotEmpty) {
      if (_preparedSearch == null || !identical(_preparedForGroups, exposed)) {
        _preparedForGroups = exposed;
        _preparedSearch = PreparedTimelineSearch.fromGroups(exposed);
      }
      prepared = _preparedSearch;
    }
    final groups = filterTimelineGroups(exposed, _filters, prepared: prepared);
    return (
      groups: groups,
      loadedNewCount: countLoadedNewReleases(groups, previousBaseline),
    );
  }

  /// Advances successful, non-exhausted repositories by one coordinated round.
  Future<void> loadOlder() async {
    if (state.loading ||
        state.cacheActions.clearing ||
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
        state.cacheActions.clearing ||
        !state.active ||
        !state.canRetry) {
      return;
    }
    if (!_followsKnown ||
        _followedRepositories.isEmpty ||
        ref
            .read(releaseFollowsSessionProvider.notifier)
            .synchronizationFailed) {
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
    if (context != null && context == _context) return;
    _retentionIncomplete = false;
    _loadedVisible = null;
    if (context == null) {
      _generation += 1;
      _cyclePages.clear();
      _currentSaveIncomplete = false;
      _persistedPageCount = 0;
      _context = null;
      _followedRepositories = const [];
      _followsKnown = false;
      _cycle = TimelineCycle.empty;
      _failures.clear();
      _firstPageRetries.clear();
      _cacheSynchronized = false;
      _resetFilters();
      state = const TimelineViewState.inactive();
      return;
    }
    _cyclePages.clear();
    _currentSaveIncomplete = false;
    _persistedPageCount = 0;
    _context = context;
    _followedRepositories = const [];
    _followsKnown = false;
    _cycle = TimelineCycle.empty;
    _failures.clear();
    _firstPageRetries.clear();
    _cacheSynchronized = false;
    _resetFilters();
    state = const TimelineViewState.activeLoading();
    _retentionWindow = null;
    final ticket = ++_generation;
    _synchronizingFollows = ticket;
    unawaited(_restoreAndStart(ticket));
  }

  /// Display conditions belong to one identity's session, so another account
  /// never inherits a filter that would hide its releases.
  void _resetFilters() {
    _filters = const TimelineFilterState();
    _preparedForGroups = null;
    _preparedSearch = null;
  }

  /// The signed-in account and its backend, which scope every stored rule.
  String? _sessionContext() {
    final session = ref.read(sessionControllerProvider);
    if (session.phase != SessionPhase.signedIn) return null;
    final identity = session.identity;
    if (identity == null) return null;
    return identity.account.scope;
  }

  Future<void> _restoreAndStart(int ticket) async {
    while (_cacheAction != null) {
      await _cacheAction;
    }
    if (!_isCurrent(ticket)) return;
    // The device's own window is resolved before anything is pruned or saved,
    // so a restored window is always read and rewritten under the real policy.
    await _resolveRetentionWindow();
    if (!_isCurrent(ticket)) return;
    await _restoreCachedWindow(ticket);
    if (_isCurrent(ticket)) await _startCycle(ticket, synchronize: false);
  }

  /// Resolves how much history this installation keeps, before any local write.
  ///
  /// The device's own choice wins. An installation that has never chosen one is
  /// seeded once from the window its Timeline Cache last wrote, so upgrading
  /// keeps the history the account already saved, and otherwise keeps the
  /// default. The seed becomes the device's choice, so the next launch has one
  /// without reading the cache first.
  Future<void> _resolveRetentionWindow() async {
    final scope = _scopeOfSession();
    // Without a cache scope this installation saves nothing at all, so there is
    // no window to resolve and no local file to read.
    if (scope == null) return;
    final preferences = await ref.read(devicePreferencesProvider.future);
    // The read may outlive an account change: a window resolved for another
    // account is not this session's to apply.
    if (!ref.mounted || _scopeOfSession() != scope) return;
    final chosen = ref
        .read(devicePreferencesStateProvider)
        .preferences
        .retentionDays;
    if (chosen != null) {
      _retentionWindow = chosen;
      return;
    }
    if (preferences.readFailed) {
      // A device whose choices could not be read keeps the default and does not
      // look for a seed: the document may have held a longer window.
      _retentionWindow = DevicePreferences.defaultRetentionDays;
      return;
    }
    var seeded = DevicePreferences.defaultRetentionDays;
    try {
      final saved = await ref
          .read(timelineCacheProvider)
          .lastSavedRetentionDays(scope: scope);
      if (!ref.mounted || _scopeOfSession() != scope) return;
      seeded = saved ?? seeded;
    } catch (error) {
      if (!ref.mounted) return;
      _cacheFailure(error);
    }
    _retentionWindow = seeded;
    await ref
        .read(devicePreferencesProvider.notifier)
        .rememberSeededRetentionDays(seeded);
  }

  Future<void> _restoreCachedWindow(int ticket) async {
    final identity = ref.read(sessionControllerProvider).identity;
    final scope = identity?.account.scope;
    if (scope != null) {
      try {
        final saved = await ref
            .read(timelineCacheProvider)
            .restore(
              scope: scope,
              now: ref.read(timelineClockProvider)(),
              environment: ref.read(timelineEnvironmentProvider),
              retentionDays: _retentionWindow,
              isCurrent: () => _isCurrent(ticket),
            );
        if (!_isCurrent(ticket)) return;
        if (saved != null) {
          _loadedVisible = saved;
          _cacheSynchronized = true;
          _followedRepositories = saved.repositories;
          final view = _visibleIn(saved.groups, saved.baseline);
          state = TimelineViewState(
            active: true,
            loading: true,
            cacheActions: state.cacheActions,
            hasFollows: saved.repositories.isNotEmpty,
            groups: saved.groups,
            visibleGroups: view.groups,
            filters: _filters,
            previousBaseline: saved.baseline,
            baselineExposed: isBaselineExposed(
              saved.baseline,
              saved.lowerBound,
            ),
            loadedNewCount: view.loadedNewCount,
            partial: saved.partial,
            savedAt: saved.savedAt,
            restored: true,
            offline: ref.read(sessionControllerProvider).offline,
          );
        }
      } catch (error) {
        if (!_isCurrent(ticket)) return;
        _cacheFailure(error);
      }
    }
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
    final scope = identity?.account.scope;
    if (scope == null) return;
    final ticket = _generation;
    try {
      await _pruneRetainedHistory(ticket);
    } catch (error) {
      if (_isCurrent(ticket)) _cacheFailure(error);
    }
  }

  Future<void> _pruneRetainedHistory(int ticket) async {
    final scope = _scopeOfSession();
    if (scope == null) return;
    if (!state.restored || !_cacheSynchronized) {
      await ref
          .read(timelineCacheProvider)
          .prune(
            scope: scope,
            now: ref.read(timelineClockProvider)(),
            isCurrent: () => _isCurrent(ticket),
            retentionDays: _retentionWindow,
          );
      return;
    }
    final saved = await ref
        .read(timelineCacheProvider)
        .restore(
          scope: scope,
          now: ref.read(timelineClockProvider)(),
          environment: ref.read(timelineEnvironmentProvider),
          retentionDays: _retentionWindow,
          previous: _loadedVisible,
          isCurrent: () => _isCurrent(ticket),
        );
    if (_isCurrent(ticket) &&
        state.restored &&
        saved != null &&
        _cacheSynchronized) {
      _loadedVisible = saved;
      if (!identical(state.groups, saved.groups)) {
        state = _withGroups(state, saved.groups, saved.baseline);
      }
    }
  }

  /// Remembers and locally applies one choice, in submission order.
  /// Completion includes history replay, pruning and any restored-window update.
  Future<RetentionChoiceResult> chooseRetentionWindow(int days) {
    if (validRetentionDays(days) == null) {
      throw ArgumentError.value(
        days,
        'days',
        'Expected 1 through 90 whole days',
      );
    }
    final ticket = _generation;
    final preferences = ref.read(devicePreferencesProvider.notifier);
    final operation = _retentionChoices.then((_) async {
      final remembered = await preferences.selectRetentionDays(days);
      RetentionNotAppliedReason? reason;
      if (!_isCurrent(ticket)) {
        reason = RetentionNotAppliedReason.sessionInvalidated;
      } else if (_sessionContext() == null) {
        reason = RetentionNotAppliedReason.noSession;
      } else {
        _retentionWindow = days;
        _retentionIncomplete = true;
        if (!_followsKnown) {
          reason = RetentionNotAppliedReason.followsUnconfirmed;
        } else if (_scopeOfSession() == null) {
          reason = RetentionNotAppliedReason.unavailableCacheScope;
        }
      }
      if (reason != null) {
        return RetentionChoiceResult(
          remembered: remembered,
          application: RetentionApplication.notApplied,
          reason: reason,
        );
      }
      while (_cacheAction != null) {
        await _cacheAction;
      }
      if (!_isCurrent(ticket)) {
        return RetentionChoiceResult(
          remembered: remembered,
          application: RetentionApplication.notApplied,
          reason: RetentionNotAppliedReason.sessionInvalidated,
        );
      }
      var applied = false;
      await _runCacheAction(() async {
        applied = await _applyRetentionWindow(days, ticket);
      });
      return RetentionChoiceResult(
        remembered: remembered,
        application: !_isCurrent(ticket)
            ? RetentionApplication.notApplied
            : applied
            ? RetentionApplication.applied
            : RetentionApplication.failed,
        reason: !_isCurrent(ticket)
            ? RetentionNotAppliedReason.sessionInvalidated
            : null,
      );
    });
    _retentionChoices = operation.then<void>(
      (_) {},
      onError: (Object _, StackTrace _) {},
    );
    return operation;
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
    if (!_isCurrent(ticket) || _sessionContext() == null || !_followsKnown) {
      return false;
    }
    _retentionWindow = days;
    _retentionIncomplete = true;
    final scope = _scopeOfSession();
    if (scope == null) return false;
    try {
      await _synchronizeCache(scope, ticket);
      if (!_isCurrent(ticket)) return false;
      if (_currentSaveIncomplete || _persistedPageCount < _cyclePages.length) {
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
      state = state.copyWith(cacheFailed: false);
      return true;
    } catch (error) {
      if (_isCurrent(ticket)) _cacheFailure(error);
      return false;
    }
  }

  /// Clears local content and continuation state without an account mutation.
  Future<void> clearCache() => _runCacheAction(_clearCache);

  Future<void> retryCache() => _runCacheAction(() async {
    if (_sessionContext() == null || state.loading || state.cacheCorrupted) {
      return;
    }
    final ticket = _generation;
    if (_retentionIncomplete && _retentionWindow != null) {
      await _applyRetentionWindow(_retentionWindow!, ticket);
      return;
    }
    if (_cyclePages.isEmpty && state.cacheFailed && !_followsKnown) {
      state = state.copyWith(loading: true);
      await _restoreCachedWindow(ticket);
      if (_isCurrent(ticket)) state = state.copyWith(loading: false);
      return;
    }
    if (_retentionWindow == null) {
      await refresh();
      return;
    }
    state = state.copyWith(loading: true);
    if (!_cacheSynchronized) {
      final identity = ref.read(sessionControllerProvider).identity!;
      final scope = identity.account.scope;
      try {
        await _synchronizeCache(scope, ticket);
        if (!_isCurrent(ticket)) return;
      } catch (error) {
        if (_isCurrent(ticket)) {
          _cacheFailure(error);
          state = state.copyWith(loading: false);
        }
        return;
      }
    }
    if (_cyclePages.isNotEmpty) {
      await _persistCurrent(ticket);
    } else if (_isCurrent(ticket)) {
      state = state.copyWith(cacheFailed: false);
    }
    if (_isCurrent(ticket)) state = state.copyWith(loading: false);
  });

  Future<void> rebuildCache() => _runCacheAction(() async {
    final identity = ref.read(sessionControllerProvider).identity;
    final scope = identity?.account.scope;
    if (_sessionContext() == null || scope == null) return;
    final ticket = ++_generation;
    state = state.copyWith(
      loading: true,
      cacheActions: state.cacheActions.copyWith(clearing: true),
    );
    _cacheSynchronized = false;
    try {
      await ref.read(timelineCacheRebuildProvider)(() => _isCurrent(ticket));
      if (!_isCurrent(ticket)) return;
      await _synchronizeCache(scope, ticket);
      if (!_isCurrent(ticket)) return;
      _persistedPageCount = 0;
      _history = TimelineHistoryConnection(const RetainedTimelineHistory());
      // Rebuild from the actual fetched pages, excluding the discarded cached
      // extension. No synthetic page can certify a connection to old history.
      var recovered = TimelineRound(
        cycle: TimelineCycle.empty,
        groups: const [],
      );
      for (final entry in _cyclePages) {
        recovered = mergeTimelineRound(
          cycle: recovered.cycle,
          followedRepositories: _followedRepositories,
          pages: {entry.repositoryId: entry.page},
          requestedIds: [entry.repositoryId],
          refresh: false,
          environment: ref.read(timelineEnvironmentProvider),
        );
      }
      recovered = mergeTimelineRound(
        cycle: TimelineCycle(
          pages: recovered.cycle.pages,
          failedIds: _cycle.failedIds,
          previousBaseline: state.previousBaseline,
        ),
        followedRepositories: _followedRepositories,
        pages: const {},
        requestedIds: const [],
        refresh: false,
        environment: ref.read(timelineEnvironmentProvider),
      );
      _cycle = recovered.cycle;
      final baseline = state.previousBaseline;
      state = _withGroups(
        state.copyWith(
          cacheFailed: false,
          cacheCorrupted: false,
          restored: false,
          partial: _cycle.partial,
          clearSavedAt: true,
          cacheConnection: TimelineCacheConnection.none,
          waitingRepositories: const [],
          canLoadOlder: _canLoadOlder,
          baselineExposed: isBaselineExposed(baseline, _cycle.windowLowerBound),
        ),
        recovered.groups,
        baseline,
      );
      if (_cyclePages.isNotEmpty) await _persistCurrent(ticket);
    } catch (error) {
      if (_isCurrent(ticket)) _cacheFailure(error);
    } finally {
      if (_isCurrent(ticket)) {
        state = state.copyWith(
          loading: false,
          cacheActions: state.cacheActions.copyWith(clearing: false),
        );
      }
    }
  });

  Future<void> _synchronizeCache(String scope, int ticket) async {
    // Nothing may be written before this installation's window is known: a
    // follow set that is not restored yet would delete the saved history it does
    // not name, and nothing may be pruned on a guessed policy. A round that
    // started while the device was still being read waits for it here.
    await _resolveRetentionWindow();
    if (!_isCurrent(ticket) || _retentionWindow == null) return;
    // Nor before this session has a confirmed follow set: a history keyed to
    // repositories nobody confirmed would be written, and its neighbours deleted.
    if (!_followsKnown) return;
    _cacheSynchronized = false;
    await ref
        .read(timelineCacheProvider)
        .synchronize(
          scope: scope,
          retentionDays: _retentionWindow,
          repositories: _followedRepositories,
          now: ref.read(timelineClockProvider)(),
          isCurrent: () => _isCurrent(ticket),
        );
    if (_isCurrent(ticket)) _cacheSynchronized = true;
  }

  void _cacheFailure(Object error) {
    state = state.copyWith(
      cacheFailed: true,
      cacheCorrupted: state.cacheCorrupted || error is TimelineCacheCorruption,
    );
  }

  Future<void> _clearCache() async {
    if (_sessionContext() == null || state.cacheActions.clearing) {
      return;
    }
    final ticket = ++_generation;
    _cyclePages.clear();
    _currentSaveIncomplete = false;
    _persistedPageCount = 0;
    _cycle = TimelineCycle.empty;
    _cycleId = '${DateTime.now().microsecondsSinceEpoch}:$_generation';
    _awaitingFreshWindow = true;
    _history = TimelineHistoryConnection(const RetainedTimelineHistory());
    _failures.clear();
    _firstPageRetries.clear();
    state = TimelineViewState(
      active: true,
      hasFollows: _followedRepositories.isNotEmpty,
      filters: _filters,
      cacheCorrupted: state.cacheCorrupted,
      cacheActions: state.cacheActions.copyWith(
        clearing: true,
        clearFailed: false,
        cleared: false,
      ),
    );
    try {
      await ref.read(timelineCacheProvider).clearHistory();
      if (!_isCurrent(ticket)) return;
      state = state.copyWith(
        cacheCorrupted: false,
        cacheActions: state.cacheActions.copyWith(
          clearing: false,
          cleared: true,
        ),
      );
    } catch (error) {
      if (!_isCurrent(ticket)) return;
      _cacheFailure(error);
      state = state.copyWith(
        cacheActions: state.cacheActions.copyWith(
          clearing: false,
          clearFailed: true,
        ),
      );
    }
  }

  Future<void> _startCycle(
    int ticket, {
    List<RepositoryReference>? confirmedFollows,
    bool synchronize = true,
  }) async {
    if (!_isCurrent(ticket)) return;
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

    FollowCollectionResult? confirmation;
    if (confirmedFollows == null) {
      _synchronizingFollows = ticket;
      try {
        confirmation = await ref
            .read(releaseFollowsSessionProvider.notifier)
            .synchronize(refresh: synchronize);
      } finally {
        if (_synchronizingFollows == ticket) _synchronizingFollows = null;
      }
    }
    if (!_isCurrent(ticket)) return;

    _failures.clear();
    _firstPageRetries.clear();
    _awaitingFreshWindow = true;
    _history = TimelineHistoryConnection(const RetainedTimelineHistory());

    if (confirmedFollows == null && confirmation?.repositories == null) {
      _followsKnown = ref.read(releaseFollowsSessionProvider).loaded;
      final failure = _followFailure(confirmation?.problem);
      if (failure.kind != TimelineFailureKind.session) {
        await _loadHistory(ticket);
        if (!_isCurrent(ticket)) return;
        await _runRound(ticket, inferFollows: _followedRepositories.isEmpty);
        if (_isCurrent(ticket)) state = state.copyWith(canRetry: true);
        return;
      }
      _fail(ticket, failure);
      return;
    }

    final follows = confirmedFollows ?? confirmation!.repositories!;
    _setFollowedRepositories(follows);
    _followsKnown = true;
    final identity = ref.read(sessionControllerProvider).identity;
    final scope = identity?.account.scope;
    if (scope != null) {
      try {
        await _synchronizeCache(scope, ticket);
        if (!_isCurrent(ticket)) return;
      } catch (error) {
        if (!_isCurrent(ticket)) return;
        _cacheFailure(error);
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
        filters: _filters,
        cacheActions: state.cacheActions,
        cacheFailed: state.cacheFailed,
        cacheCorrupted: state.cacheCorrupted,
      );
      return;
    }

    await _runRound(ticket);
  }

  TimelineFailure _followFailure(FollowProblem? problem) =>
      TimelineFailure(switch (problem) {
        FollowProblem.network => TimelineFailureKind.network,
        FollowProblem.rateLimited => TimelineFailureKind.rateLimited,
        FollowProblem.session => TimelineFailureKind.session,
        FollowProblem.invalidResponse => TimelineFailureKind.invalidResponse,
        FollowProblem.cancelled => TimelineFailureKind.cancelled,
        _ => TimelineFailureKind.server,
      });

  Future<void> _loadHistory(
    int ticket, {
    bool replayCurrentPages = false,
    bool propagateFailure = false,
  }) async {
    final identity = ref.read(sessionControllerProvider).identity;
    final scope = identity?.account.scope;
    if (scope == null ||
        _retentionWindow == null ||
        !_cacheSynchronized ||
        state.cacheCorrupted) {
      if (propagateFailure) throw StateError('History is not available');
      return;
    }
    try {
      final history = await ref
          .read(timelineCacheProvider)
          .readHistory(scope: scope, now: ref.read(timelineClockProvider)());
      if (!_isCurrent(ticket)) return;
      _history = TimelineHistoryConnection(history);
      if (replayCurrentPages) {
        final cutoff = ref
            .read(timelineClockProvider)()
            .toUtc()
            .subtract(Duration(days: _retentionWindow!));
        for (final entry in _cyclePages) {
          _history.accept(
            {entry.repositoryId: entry.page},
            cutoff: cutoff,
            cursors: {entry.repositoryId: entry.cursor},
          );
        }
      }
    } catch (error) {
      if (propagateFailure) rethrow;
      if (_isCurrent(ticket)) _cacheFailure(error);
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
            RepositoryReference(
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
      cursors: cursors,
      cutoff: ref
          .read(timelineClockProvider)()
          .toUtc()
          .subtract(Duration(days: _retentionWindow ?? 1)),
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
    if (startsWindow) {
      _cyclePages.clear();
      _currentSaveIncomplete = false;
      _persistedPageCount = 0;
      _cycleId = '${DateTime.now().microsecondsSinceEpoch}:$_generation';
    }
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
        environment: ref.read(timelineEnvironmentProvider),
      );
      _cycle = result.cycle;
    }

    final baseline = _cycle.previousBaseline;
    final unavailable = _failedRepositories(RepositoryQueryStatus.unavailable);
    final transient = _failedRepositories(RepositoryQueryStatus.transient);
    final view = _visibleIn(result.groups, baseline);

    state = TimelineViewState(
      active: true,
      loading: true,
      cacheActions: state.cacheActions,
      hasFollows: true,
      groups: result.groups,
      visibleGroups: view.groups,
      filters: _filters,
      unavailableRepositories: unavailable,
      transientRepositories: transient,
      previousBaseline: baseline,
      baselineExposed: isBaselineExposed(baseline, _cycle.windowLowerBound),
      loadedNewCount: view.loadedNewCount,
      partial: _cycle.partial || unavailable.isNotEmpty || transient.isNotEmpty,
      canRetry: _cycle.failedIds.isNotEmpty,
      canLoadOlder: _canLoadOlder,
      persistenceFailed: refresh
          ? round.persistenceError != null
          : state.persistenceFailed || round.persistenceError != null,
      cacheFailed: state.cacheFailed,
      cacheCorrupted: state.cacheCorrupted,
      savedAt: state.savedAt,
      cacheConnection: _cacheConnection,
      waitingRepositories: _repositoriesFor(
        _history.waitingRepositories.toList(),
      ),
    );
    _cyclePages.addAll([
      for (final entry in pages.entries)
        (
          repositoryId: entry.key,
          cursor: cursors[entry.key],
          page: entry.value,
        ),
    ]);
    await _persistCurrent(ticket);
    if (_isCurrent(ticket)) state = state.copyWith(loading: false);
  }

  Future<void> _persistCurrent(
    int ticket, {
    bool propagateFailure = false,
  }) async {
    final identity = ref.read(sessionControllerProvider).identity;
    final scope = identity?.account.scope;
    // Durable history also needs a confirmed follow set: without one the cache
    // does not know which repositories this account keeps.
    if (scope != null &&
        _retentionWindow != null &&
        _followsKnown &&
        _cacheSynchronized &&
        !state.cacheCorrupted) {
      final now = ref.read(timelineClockProvider)();
      try {
        await ref
            .read(timelineCacheProvider)
            .save(
              scope: scope,
              cycleId: _cycleId,
              pages: _cyclePages.skip(_persistedPageCount).toList(),
              groups: state.groups,
              cycle: _cycle,
              now: now,
              isCurrent: () => _isCurrent(ticket),
              obsoleteRepositories: Set.of(_history.obsoleteRepositories),
            );
        if (_isCurrent(ticket)) {
          _persistedPageCount = _cyclePages.length;
          _currentSaveIncomplete = false;
          state = state.copyWith(savedAt: now, cacheFailed: false);
        }
      } catch (error) {
        if (_isCurrent(ticket)) {
          _currentSaveIncomplete = true;
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

  /// The cache scope of the signed-in session, or null when there is none.
  String? _scopeOfSession() {
    final identity = ref.read(sessionControllerProvider).identity;
    return identity?.account.scope;
  }

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
