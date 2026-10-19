import 'timeline_filters.dart';
import 'timeline_models.dart';

/// Why a Timeline round could not be read.
enum TimelineFailureKind {
  network,
  rateLimited,
  session,
  server,
  invalidResponse,
  cancelled,
}

class TimelineFailure {
  const TimelineFailure(this.kind);

  final TimelineFailureKind kind;

  /// A rejected session needs sign-in again; a cancelled round needs nothing.
  bool get retryable =>
      kind != TimelineFailureKind.session &&
      kind != TimelineFailureKind.cancelled;
}

enum TimelineCacheConnection { none, waiting, connected }

/// Account policy and installation-local cache actions exposed to Settings.
class TimelineCacheSettings {
  const TimelineCacheSettings({
    this.retentionDays,
    this.syncFailed = false,
    this.saving = false,
    this.saveFailed = false,
    this.clearing = false,
    this.clearFailed = false,
    this.cleared = false,
  });

  final int? retentionDays;
  final bool syncFailed;
  final bool saving;
  final bool saveFailed;
  final bool clearing;
  final bool clearFailed;
  final bool cleared;

  TimelineCacheSettings copyWith({
    int? retentionDays,
    bool clearRetentionDays = false,
    bool? syncFailed,
    bool? saving,
    bool? saveFailed,
    bool? clearing,
    bool? clearFailed,
    bool? cleared,
  }) => TimelineCacheSettings(
    retentionDays: clearRetentionDays
        ? null
        : retentionDays ?? this.retentionDays,
    syncFailed: syncFailed ?? this.syncFailed,
    saving: saving ?? this.saving,
    saveFailed: saveFailed ?? this.saveFailed,
    clearing: clearing ?? this.clearing,
    clearFailed: clearFailed ?? this.clearFailed,
    cleared: cleared ?? this.cleared,
  );
}

/// The immutable Release Timeline the widgets read.
class TimelineViewState {
  const TimelineViewState({
    this.active = false,
    this.loading = false,
    this.hasFollows = false,
    this.groups = const [],
    this.visibleGroups = const [],
    this.filters = const TimelineFilterState(),
    this.unavailableRepositories = const [],
    this.transientRepositories = const [],
    this.previousBaseline,
    this.baselineExposed = false,
    this.loadedNewCount = 0,
    this.partial = false,
    this.canRetry = false,
    this.canLoadOlder = false,
    this.failure,
    this.persistenceFailed = false,
    this.cacheFailed = false,
    this.cacheCorrupted = false,
    this.offline = false,
    this.restored = false,
    this.savedAt,
    this.cacheConnection = TimelineCacheConnection.none,
    this.waitingRepositories = const [],
    this.cacheSettings = const TimelineCacheSettings(),
  });

  /// Nobody is signed in with a connected backend yet.
  const TimelineViewState.inactive() : this();

  /// Signed in, waiting for the first coordinated round.
  const TimelineViewState.activeLoading() : this(active: true, loading: true);

  /// Whether the signed-in account's timeline is being read.
  final bool active;
  final bool loading;

  /// Whether the account follows any repository.
  final bool hasFollows;

  /// The exposed Shared Timeline Window, before the Active Timeline Filter.
  final List<TimelineGroup> groups;

  /// The exposed groups after the Release Timeline Filter and Search.
  ///
  /// These are the only releases widgets display or count, so retained records
  /// outside the exposed window can never appear in a result.
  final List<TimelineGroup> visibleGroups;

  /// The Active Timeline Filter and Release Timeline Search.
  final TimelineFilterState filters;

  /// Followed Repositories GitHub reports as missing, and the ones that failed
  /// to load and can be retried.
  final List<TimelineRepository> unavailableRepositories;
  final List<TimelineRepository> transientRepositories;

  /// The cycle's captured Timeline Refresh Baseline, fixed while reading.
  final String? previousBaseline;

  /// Whether the baseline's publication-time position is inside the window.
  final bool baselineExposed;

  /// Releases newer than the captured baseline, after the current filters.
  final int loadedNewCount;

  /// Whether the Shared Timeline Window is a Partial Timeline Window.
  final bool partial;

  /// Whether another round could recover a failed repository.
  final bool canRetry;

  /// Successful repositories still have another page available. Failed pages
  /// are retried explicitly instead of being advanced by Load older.
  final bool canLoadOlder;

  final TimelineFailure? failure;

  /// Whether usable results returned while their bookmark could not be saved.
  final bool persistenceFailed;
  final bool cacheFailed;
  final bool cacheCorrupted;
  final bool offline;
  final bool restored;
  final DateTime? savedAt;
  final TimelineCacheConnection cacheConnection;
  final List<TimelineRepository> waitingRepositories;
  final TimelineCacheSettings cacheSettings;

  bool get hasReleases => visibleGroups.isNotEmpty;

  /// The exposed window holds releases, even if the Active Timeline Filter
  /// currently hides them all.
  bool get hasExposedReleases => groups.isNotEmpty;

  /// The exposed window is not empty, but no release matches the Active
  /// Timeline Filter.
  bool get filteredEmpty => hasExposedReleases && visibleGroups.isEmpty;

  bool get hasLookupFailures =>
      unavailableRepositories.isNotEmpty || transientRepositories.isNotEmpty;

  TimelineViewState copyWith({
    bool? active,
    bool? loading,
    bool? hasFollows,
    List<TimelineGroup>? groups,
    List<TimelineGroup>? visibleGroups,
    TimelineFilterState? filters,
    List<TimelineRepository>? unavailableRepositories,
    List<TimelineRepository>? transientRepositories,
    String? previousBaseline,
    bool clearPreviousBaseline = false,
    bool? baselineExposed,
    int? loadedNewCount,
    bool? partial,
    bool? canRetry,
    bool? canLoadOlder,
    TimelineFailure? failure,
    bool clearFailure = false,
    bool? persistenceFailed,
    bool? cacheFailed,
    bool? cacheCorrupted,
    bool? offline,
    bool? restored,
    DateTime? savedAt,
    bool clearSavedAt = false,
    TimelineCacheConnection? cacheConnection,
    List<TimelineRepository>? waitingRepositories,
    TimelineCacheSettings? cacheSettings,
  }) {
    return TimelineViewState(
      active: active ?? this.active,
      loading: loading ?? this.loading,
      hasFollows: hasFollows ?? this.hasFollows,
      groups: groups ?? this.groups,
      visibleGroups: visibleGroups ?? this.visibleGroups,
      filters: filters ?? this.filters,
      unavailableRepositories:
          unavailableRepositories ?? this.unavailableRepositories,
      transientRepositories:
          transientRepositories ?? this.transientRepositories,
      previousBaseline: clearPreviousBaseline
          ? null
          : previousBaseline ?? this.previousBaseline,
      baselineExposed: baselineExposed ?? this.baselineExposed,
      loadedNewCount: loadedNewCount ?? this.loadedNewCount,
      partial: partial ?? this.partial,
      canRetry: canRetry ?? this.canRetry,
      canLoadOlder: canLoadOlder ?? this.canLoadOlder,
      failure: clearFailure ? null : failure ?? this.failure,
      persistenceFailed: persistenceFailed ?? this.persistenceFailed,
      cacheFailed: cacheFailed ?? this.cacheFailed,
      cacheCorrupted: cacheCorrupted ?? this.cacheCorrupted,
      offline: offline ?? this.offline,
      restored: restored ?? this.restored,
      savedAt: clearSavedAt ? null : savedAt ?? this.savedAt,
      cacheConnection: cacheConnection ?? this.cacheConnection,
      waitingRepositories: waitingRepositories ?? this.waitingRepositories,
      cacheSettings: cacheSettings ?? this.cacheSettings,
    );
  }
}
