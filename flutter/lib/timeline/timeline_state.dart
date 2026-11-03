import '../repositories/repository_models.dart';
import 'timeline_content_state.dart';
import 'timeline_filters.dart';
import 'timeline_models.dart';
import 'timeline_projection.dart';

export 'timeline_content_state.dart';

/// The immutable Release Timeline the widgets read.
///
/// It is the content module's snapshot under the reader's current filters, not a
/// second copy of the content's own fields: every content value is read through
/// the snapshot, so a field this state does not expose fails to compile rather
/// than silently reading a default.
class TimelineViewState {
  const TimelineViewState({required this.content, required this.projection});

  /// Nobody is signed in with a connected backend yet.
  const TimelineViewState.inactive()
    : this(
        content: const TimelineContentState.inactive(),
        projection: const TimelineProjection.empty(),
      );

  /// Signed in, waiting for the first coordinated round.
  const TimelineViewState.activeLoading()
    : this(
        content: const TimelineContentState.activeLoading(),
        projection: const TimelineProjection.empty(),
      );

  /// The unfiltered content this view was derived from.
  final TimelineContentState content;

  /// The exposed window as the current filters present it.
  final TimelineProjection projection;

  /// Whether the signed-in account's timeline is being read.
  bool get active => content.active;
  bool get loading => content.loading;

  /// Whether the account follows any repository.
  bool get hasFollows => content.hasFollows;

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
  List<RepositoryReference> get unavailableRepositories =>
      content.unavailableRepositories;
  List<RepositoryReference> get transientRepositories =>
      content.transientRepositories;

  /// The cycle's captured Timeline Refresh Baseline, fixed while reading.
  String? get previousBaseline => projection.previousBaseline;

  /// Whether the baseline's publication-time position is inside the window.
  bool get baselineExposed => projection.baselineExposed;

  /// Releases newer than the captured baseline, after the current filters.
  int get loadedNewCount => projection.loadedNewCount;

  /// Whether the Shared Timeline Window is a Partial Timeline Window.
  bool get partial => content.partial;

  /// Whether another round could recover a failed repository.
  bool get canRetry => content.canRetry;

  /// Successful repositories still have another page available. Failed pages
  /// are retried explicitly instead of being advanced by Load older.
  bool get canLoadOlder => content.canLoadOlder;

  TimelineFailure? get failure => content.failure;

  /// Whether usable results returned while their bookmark could not be saved.
  bool get persistenceFailed => content.persistenceFailed;
  bool get cacheFailed => content.cacheFailed;
  bool get cacheCorrupted => content.cacheCorrupted;
  bool get offline => content.offline;
  bool get restored => content.restored;
  DateTime? get savedAt => content.savedAt;
  TimelineCacheConnection get cacheConnection => content.cacheConnection;
  List<RepositoryReference> get waitingRepositories =>
      content.waitingRepositories;
  TimelineCacheActions get cacheActions => content.cacheActions;

  bool get hasReleases => visibleGroups.isNotEmpty;

  /// The exposed window holds releases, even if the Active Timeline Filter
  /// currently hides them all.
  bool get hasExposedReleases => groups.isNotEmpty;

  /// The exposed window is not empty, but no release matches the Active
  /// Timeline Filter.
  bool get filteredEmpty => hasExposedReleases && visibleGroups.isEmpty;

  bool get hasLookupFailures =>
      unavailableRepositories.isNotEmpty || transientRepositories.isNotEmpty;

  /// The same content under another projection.
  TimelineViewState withProjection(TimelineProjection projection) =>
      TimelineViewState(content: content, projection: projection);

  /// The same content under the current window and another Active Timeline
  /// Filter.
  TimelineViewState withFilters(TimelineFilterState filters) =>
      withProjection(projection.withFilters(filters));
}
