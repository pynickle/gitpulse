import 'timeline_filters.dart';
import 'timeline_models.dart';
import 'timeline_projection.dart';
import '../repositories/repository_models.dart';

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

/// This installation's local cache actions, exposed to Settings.
///
/// The retention window is not here: it belongs to the installation's device
/// preferences, which the Timeline Session reads and applies, so a Settings row
/// can hold it without a round trip.
class TimelineCacheActions {
  const TimelineCacheActions({
    this.clearing = false,
    this.clearFailed = false,
    this.cleared = false,
  });

  final bool clearing;
  final bool clearFailed;
  final bool cleared;

  TimelineCacheActions copyWith({
    bool? clearing,
    bool? clearFailed,
    bool? cleared,
  }) => TimelineCacheActions(
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
    this.projection = const TimelineProjection.empty(),
    this.unavailableRepositories = const [],
    this.transientRepositories = const [],
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
    this.cacheActions = const TimelineCacheActions(),
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

  /// The window inputs and their presentation change as one immutable value.
  final TimelineProjection projection;

  /// The exposed Shared Timeline Window, before the Active Timeline Filter.
  List<TimelineGroup> get groups => projection.groups;

  /// The exposed groups after the Release Timeline Filter and Search.
  ///
  /// These are the only releases widgets display or count, so retained records
  /// outside the exposed window can never appear in a result.
  List<TimelineGroup> get visibleGroups => projection.visibleGroups;

  /// The Active Timeline Filter and Release Timeline Search.
  TimelineFilterState get filters => projection.filters;

  /// Followed Repositories GitHub reports as missing, and the ones that failed
  /// to load and can be retried.
  final List<RepositoryReference> unavailableRepositories;
  final List<RepositoryReference> transientRepositories;

  /// The cycle's captured Timeline Refresh Baseline, fixed while reading.
  String? get previousBaseline => projection.previousBaseline;

  /// Whether the baseline's publication-time position is inside the window.
  bool get baselineExposed => projection.baselineExposed;

  /// Releases newer than the captured baseline, after the current filters.
  int get loadedNewCount => projection.loadedNewCount;

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
  final List<RepositoryReference> waitingRepositories;
  final TimelineCacheActions cacheActions;

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
    TimelineProjection? projection,
    List<RepositoryReference>? unavailableRepositories,
    List<RepositoryReference>? transientRepositories,
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
    List<RepositoryReference>? waitingRepositories,
    TimelineCacheActions? cacheActions,
  }) {
    return TimelineViewState(
      active: active ?? this.active,
      loading: loading ?? this.loading,
      hasFollows: hasFollows ?? this.hasFollows,
      projection: projection ?? this.projection,
      unavailableRepositories:
          unavailableRepositories ?? this.unavailableRepositories,
      transientRepositories:
          transientRepositories ?? this.transientRepositories,
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
      cacheActions: cacheActions ?? this.cacheActions,
    );
  }
}
