import '../repositories/repository_models.dart';
import 'timeline_models.dart';
import 'timeline_state.dart';

/// The unfiltered exposed content, independent of presentation choices.
final class TimelineWindow {
  const TimelineWindow.empty()
    : groups = const [],
      previousBaseline = null,
      windowLowerBound = null;
  TimelineWindow({
    List<TimelineGroup> groups = const [],
    this.previousBaseline,
    this.windowLowerBound,
  }) : groups = List.unmodifiable([
         for (final group in groups)
           TimelineGroup(
             date: group.date,
             items: List.unmodifiable(group.items),
           ),
       ]);
  final List<TimelineGroup> groups;
  final String? previousBaseline;
  final int? windowLowerBound;
}

/// The observable content and operation progress before display filtering.
class TimelineContentState {
  const TimelineContentState({
    this.active = false,
    this.loading = false,
    this.hasFollows = false,
    this.window = const TimelineWindow.empty(),
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
  const TimelineContentState.inactive() : this();

  /// Signed in, waiting for the first coordinated round.
  const TimelineContentState.activeLoading()
    : this(active: true, loading: true);

  /// Whether the signed-in account's timeline is being read.
  final bool active;
  final bool loading;

  /// Whether the account follows any repository.
  final bool hasFollows;

  /// The unfiltered window and its captured publication bounds.
  final TimelineWindow window;

  /// The exposed Shared Timeline Window, before the Active Timeline Filter.
  List<TimelineGroup> get groups => window.groups;

  /// Followed Repositories GitHub reports as missing, and the ones that failed
  /// to load and can be retried.
  final List<RepositoryReference> unavailableRepositories;
  final List<RepositoryReference> transientRepositories;

  /// The cycle's captured Timeline Refresh Baseline, fixed while reading.
  String? get previousBaseline => window.previousBaseline;

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

  TimelineContentState copyWith({
    bool? active,
    bool? loading,
    bool? hasFollows,
    TimelineWindow? window,
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
    return TimelineContentState(
      active: active ?? this.active,
      loading: loading ?? this.loading,
      hasFollows: hasFollows ?? this.hasFollows,
      window: window ?? this.window,
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
