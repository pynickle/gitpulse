import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/widgets.dart';

import '../device/device_preferences.dart';
import '../device/device_preferences_controller.dart';
import '../follows/release_follows_session.dart';
import '../follows/release_follows_state.dart';
import '../session/gitpulse_http.dart';
import '../session/session_controller.dart';
import 'timeline_filters.dart';
import 'timeline_models.dart';
import 'timeline_projection.dart';
import 'timeline_service.dart';
import 'timeline_state.dart';
import 'timeline_cache.dart';
import 'timeline_cache_lifecycle.dart';
import 'timeline_content.dart';
import '../repositories/repository_models.dart';

export 'timeline_service.dart'
    show timelineTransportProvider, releaseTimelineServiceProvider;

/// The device clock and display time zone. Tests replace this seam.
final timelineEnvironmentProvider = Provider<TimelineEnvironment>(
  (ref) => TimelineEnvironment.system(),
);

/// The app-facing Release Timeline session.
///
/// It adapts account and network lifecycle to the content module, publishing each
/// Shared Timeline Window through its immutable projection. Widgets read the
/// state and never coordinate rounds themselves.
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
  late TimelineContentController _content;
  TimelineWindow? _publishedWindow;
  String? _context;
  int _generation = 0;
  int? _synchronizingFollows;
  Future<void> _retentionChoices = Future.value();
  final _followRemovals = StreamController<TimelineFollowRemoval>.broadcast(
    sync: true,
  );

  Stream<TimelineFollowRemoval> get followRemovals => _followRemovals.stream;
  List<RepositoryReference> get followedRepositories =>
      _content.followedRepositories;

  @override
  TimelineViewState build() {
    ref.watch(timelineCacheLifecycleProvider);
    _content = TimelineContentController(
      cache: () => ref.read(timelineCacheProvider),
      rebuild: (isCurrent) => ref.read(timelineCacheRebuildProvider)(isCurrent),
      clock: () => ref.read(timelineClockProvider)(),
      environment: () => ref.read(timelineEnvironmentProvider),
      scope: _sessionContext,
      generation: () => _generation,
      invalidate: () => ++_generation,
      isCurrent: _isCurrent,
      resolveRetention: _resolveRetentionWindow,
      onChanged: _publishContent,
    );
    _publishedWindow = null;
    final lifecycle = AppLifecycleListener(
      onResume: () => unawaited(pruneRetainedHistory()),
    );
    ref.listen(
      sessionControllerProvider,
      (previous, next) => _onSessionChanged(),
    );
    ref.listen(releaseFollowsSessionProvider, (previous, next) {
      if (!next.active ||
          !next.loaded ||
          identical(previous?.repositories, next.repositories)) {
        return;
      }
      if (_synchronizingFollows == _generation && previous?.saving != true) {
        return;
      }
      unawaited(applyFollows(next.repositories));
    });
    final transitions = ref
        .read(sessionControllerProvider.notifier)
        .transitions
        .listen((event) {
          if (event is IdentityCleared) _generation++;
        });
    ref.onDispose(() {
      _generation++;
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

  void _publishContent() {
    if (!ref.mounted) return;
    final content = _content.snapshot;
    final projection = identical(_publishedWindow, content.window)
        ? state.projection
        : TimelineProjection(
            groups: content.groups,
            filters: state.filters,
            previousBaseline: content.previousBaseline,
            windowLowerBound: content.window.windowLowerBound,
          );
    _publishedWindow = content.window;
    state = TimelineViewState(
      active: content.active,
      loading: content.loading,
      hasFollows: content.hasFollows,
      projection: projection,
      unavailableRepositories: content.unavailableRepositories,
      transientRepositories: content.transientRepositories,
      partial: content.partial,
      canRetry: content.canRetry,
      canLoadOlder: content.canLoadOlder,
      failure: content.failure,
      persistenceFailed: content.persistenceFailed,
      cacheFailed: content.cacheFailed,
      cacheCorrupted: content.cacheCorrupted,
      offline: content.offline,
      restored: content.restored,
      savedAt: content.savedAt,
      cacheConnection: content.cacheConnection,
      waitingRepositories: content.waitingRepositories,
      cacheActions: content.cacheActions,
    );
  }

  /// Refreshes one coordinated round after confirming the account's follows.
  Future<void> refresh() async {
    if (state.cacheActions.clearing) return;
    final context = _sessionContext();
    if (context == null) return;
    _context = context;
    await _startCycle(++_generation);
  }

  Future<void> reloadFollows() async {
    final context = _sessionContext();
    if (context == null) return;
    while (_content.pendingCacheAction != null) {
      await _content.pendingCacheAction;
    }
    if (!ref.mounted || context != _sessionContext()) return;
    _context = context;
    await _startCycle(++_generation);
  }

  /// Applies confirmed follow changes without fetching for removals or renames.
  Future<void> applyFollows(List<RepositoryReference> repositories) async {
    final context = _sessionContext();
    if (context == null) return;
    while (_content.pendingCacheAction != null) {
      await _content.pendingCacheAction;
    }
    if (!ref.mounted || context != _sessionContext()) return;
    final previous = followedRepositories;
    if (_content.followsKnown &&
        context == _context &&
        repositories.length == previous.length &&
        repositories.indexed.every(
          (entry) =>
              previous[entry.$1].id == entry.$2.id &&
              previous[entry.$1].fullName == entry.$2.fullName,
        )) {
      return;
    }
    if (_content.followsKnown &&
        context == _context &&
        repositories.every(
          (repository) => previous.any((old) => old.id == repository.id),
        )) {
      final preserveLoading = repositories.length == previous.length;
      final ticket = preserveLoading ? _generation : ++_generation;
      _notifyRemovals(repositories);
      await _content.applyFollows(
        ticket,
        List.unmodifiable(repositories),
        preserveLoading: preserveLoading,
      );
      return;
    }
    _context = context;
    await _startCycle(
      ++_generation,
      confirmedFollows: List.unmodifiable(repositories),
    );
  }

  void _notifyRemovals(List<RepositoryReference> repositories) {
    final retained = repositories.map((repository) => repository.id).toSet();
    final removed = followedRepositories
        .map((repository) => repository.id)
        .toSet()
        .difference(retained);
    final identity = ref.read(sessionControllerProvider).identity;
    if (removed.isNotEmpty && identity != null) {
      _followRemovals.add(
        TimelineFollowRemoval(identity: identity, repositoryIds: removed),
      );
    }
  }

  void applyFilters(TimelineFilterState filters) {
    if (filters == state.filters) return;
    state = state.copyWith(projection: state.projection.withFilters(filters));
  }

  Future<void> loadOlder() async {
    if (state.loading ||
        state.cacheActions.clearing ||
        !state.active ||
        !state.canLoadOlder) {
      return;
    }
    await _continueRound(_content.olderCursors);
  }

  Future<void> retryFailed({String? repositoryId}) async {
    if (state.loading ||
        state.cacheActions.clearing ||
        !state.active ||
        !state.canRetry) {
      return;
    }
    if (!_content.followsKnown ||
        followedRepositories.isEmpty ||
        ref
            .read(releaseFollowsSessionProvider.notifier)
            .synchronizationFailed) {
      await refresh();
      return;
    }
    await _continueRound(_content.retryCursors(repositoryId));
  }

  Future<void> _continueRound(Map<String, String?> cursors) async {
    if (cursors.isEmpty) return;
    final ticket = _generation;
    _content.beginLoading();
    final response = await ref
        .read(releaseTimelineServiceProvider)
        .loadPages(cursors);
    if (!_isCurrent(ticket)) return;
    await _content.acceptRound(
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
    _generation++;
    _context = context;
    state = context == null
        ? const TimelineViewState.inactive()
        : const TimelineViewState.activeLoading();
    _content.reset(active: context != null);
    if (context == null) return;
    final ticket = _generation;
    _synchronizingFollows = ticket;
    unawaited(_restoreAndStart(ticket));
  }

  String? _sessionContext() {
    final session = ref.read(sessionControllerProvider);
    return session.phase == SessionPhase.signedIn
        ? session.identity?.account.scope
        : null;
  }

  Future<void> _restoreAndStart(int ticket) async {
    while (_content.pendingCacheAction != null) {
      await _content.pendingCacheAction;
    }
    if (!_isCurrent(ticket)) return;
    await _content.resolveRetentionWindow();
    if (!_isCurrent(ticket)) return;
    await _content.restore(
      ticket,
      offline: ref.read(sessionControllerProvider).offline,
    );
    if (_isCurrent(ticket)) await _startCycle(ticket, synchronize: false);
  }

  Future<int?> _resolveRetentionWindow() async {
    final scope = _sessionContext();
    // Without a cache scope this installation saves nothing at all, so there is
    // no window to resolve and no local file to read.
    if (scope == null) return null;
    final preferences = await ref.read(devicePreferencesProvider.future);
    // The read may outlive an account change: a window resolved for another
    // account is not this session's to apply.
    if (!ref.mounted || _sessionContext() != scope) return null;
    final chosen = ref
        .read(devicePreferencesStateProvider)
        .preferences
        .retentionDays;
    if (chosen != null) {
      return chosen;
    }
    if (preferences.readFailed) {
      // A device whose choices could not be read keeps the default and does not
      // look for a seed: the document may have held a longer window.
      return DevicePreferences.defaultRetentionDays;
    }
    var seeded = DevicePreferences.defaultRetentionDays;
    try {
      final saved = await _content.lastSavedRetentionDays(scope);
      if (!ref.mounted || _sessionContext() != scope) return null;
      seeded = saved ?? seeded;
    } catch (error) {
      if (!ref.mounted) return null;
      _content.reportCacheFailure(error);
    }
    await ref
        .read(devicePreferencesProvider.notifier)
        .rememberSeededRetentionDays(seeded);
    return seeded;
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

  Future<void> pruneRetainedHistory() => _content.pruneRetainedHistory();
  Future<void> clearCache() => _content.clear();
  Future<void> rebuildCache() => _content.rebuild();

  Future<void> retryCache() async {
    await _content.retrySaving(
      offline: ref.read(sessionControllerProvider).offline,
      initialize: refresh,
    );
  }

  /// Remembers and applies complete retention choices in submission order.
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
        _content.adoptRetentionWindow(days);
        if (!_content.followsKnown) {
          reason = RetentionNotAppliedReason.followsUnconfirmed;
        }
      }
      if (reason != null) {
        return RetentionChoiceResult(
          remembered: remembered,
          application: RetentionApplication.notApplied,
          reason: reason,
        );
      }
      while (_content.pendingCacheAction != null) {
        await _content.pendingCacheAction;
      }
      if (!_isCurrent(ticket)) {
        return RetentionChoiceResult(
          remembered: remembered,
          application: RetentionApplication.notApplied,
          reason: RetentionNotAppliedReason.sessionInvalidated,
        );
      }
      final applied = await _content.applyRetentionWindow(days, ticket);
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

  Future<void> _startCycle(
    int ticket, {
    List<RepositoryReference>? confirmedFollows,
    bool synchronize = true,
  }) async {
    if (!_isCurrent(ticket)) return;
    _content.beginRefresh();
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
    _content.beginFreshWindow();
    if (confirmedFollows == null && confirmation?.repositories == null) {
      _content.markFollowsKnown(ref.read(releaseFollowsSessionProvider).loaded);
      final failure = _followFailure(confirmation?.problem);
      if (failure.kind != TimelineFailureKind.session) {
        await _content.prepareHistory(ticket, synchronize: false);
        if (!_isCurrent(ticket)) return;
        await _runRound(ticket, inferFollows: followedRepositories.isEmpty);
        if (_isCurrent(ticket)) _content.offerRetry();
        return;
      }
      _content.failRound(ticket, failure);
      return;
    }
    final follows = confirmedFollows ?? confirmation!.repositories!;
    _notifyRemovals(follows);
    _content.confirmFollows(follows);
    await _content.prepareHistory(ticket);
    if (!_isCurrent(ticket)) return;
    if (follows.isEmpty) {
      _content.showEmpty();
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

  Future<void> _runRound(int ticket, {bool inferFollows = false}) async {
    if (!_isCurrent(ticket)) return;
    _content.beginLoading();
    final response = await ref.read(releaseTimelineServiceProvider).refresh();
    if (!_isCurrent(ticket)) return;
    await _content.acceptRefresh(ticket, response, inferFollows: inferFollows);
  }

  bool _isCurrent(int ticket) => ref.mounted && ticket == _generation;
}
