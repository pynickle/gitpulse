import 'timeline_content_state.dart';
import 'timeline_filters.dart';
import 'timeline_models.dart';

/// One exposed window and its presentation under the current filters.
///
/// Window membership and its lower boundary come from upstream. Filtering never
/// admits retained history or changes whether the refresh baseline is exposed.
final class TimelineProjection {
  const TimelineProjection.empty()
    : groups = const [],
      visibleGroups = const [],
      filters = const TimelineFilterState(),
      previousBaseline = null,
      windowLowerBound = null,
      loadedNewCount = 0,
      baselineExposed = false,
      _preparedSearch = null,
      _window = null;

  factory TimelineProjection({
    List<TimelineGroup> groups = const [],
    TimelineFilterState filters = const TimelineFilterState(),
    String? previousBaseline,
    int? windowLowerBound,
  }) => TimelineProjection._project(
    groups: _freezeGroups(groups),
    filters: filters,
    previousBaseline: previousBaseline,
    windowLowerBound: windowLowerBound,
  );

  factory TimelineProjection._project({
    required List<TimelineGroup> groups,
    required TimelineFilterState filters,
    required String? previousBaseline,
    required int? windowLowerBound,
    PreparedTimelineSearch? preparedSearch,
    TimelineWindow? window,
  }) {
    filters = filters.copyWith(
      repositoryIds: List.unmodifiable(filters.repositoryIds),
    );
    if (filters.query.trim().isNotEmpty) {
      preparedSearch ??= PreparedTimelineSearch.fromGroups(groups);
    }
    final visible = filterTimelineGroups(
      groups,
      filters,
      prepared: preparedSearch,
    );
    return TimelineProjection._(
      groups: groups,
      visibleGroups: identical(visible, groups)
          ? groups
          : _freezeGroups(visible),
      filters: filters,
      previousBaseline: previousBaseline,
      windowLowerBound: windowLowerBound,
      loadedNewCount: countLoadedNewReleases(visible, previousBaseline),
      baselineExposed: isBaselineExposed(previousBaseline, windowLowerBound),
      preparedSearch: preparedSearch,
      window: window,
    );
  }

  const TimelineProjection._({
    required this.groups,
    required this.visibleGroups,
    required this.filters,
    required this.previousBaseline,
    required this.windowLowerBound,
    required this.loadedNewCount,
    required this.baselineExposed,
    required this._preparedSearch,
    required this._window,
  });

  final List<TimelineGroup> groups;
  final List<TimelineGroup> visibleGroups;
  final TimelineFilterState filters;
  final String? previousBaseline;
  final int? windowLowerBound;
  final int loadedNewCount;
  final bool baselineExposed;
  final PreparedTimelineSearch? _preparedSearch;

  /// The window this projection was derived from, when it was derived from one.
  final TimelineWindow? _window;

  /// Reuses this window's prepared search fields, including across empty queries.
  TimelineProjection withFilters(TimelineFilterState filters) {
    if (filters == this.filters) return this;
    return TimelineProjection._project(
      groups: groups,
      filters: filters,
      previousBaseline: previousBaseline,
      windowLowerBound: windowLowerBound,
      preparedSearch: _preparedSearch,
      window: _window,
    );
  }

  /// This projection re-derived from another window.
  ///
  /// The window a projection came from is remembered, so a publish that renewed
  /// nothing else and hands back the same window reuses this projection instead
  /// of filtering the whole window again.
  TimelineProjection withWindow(TimelineWindow window) {
    if (identical(window, _window)) return this;
    // A window froze its own groups, and a prepared search indexes the releases
    // of one window, so another window builds its own rather than searching the
    // previous one's fields.
    return TimelineProjection._project(
      groups: window.groups,
      filters: filters,
      previousBaseline: window.previousBaseline,
      windowLowerBound: window.windowLowerBound,
      window: window,
    );
  }

  static List<TimelineGroup> _freezeGroups(List<TimelineGroup> groups) =>
      List.unmodifiable([
        for (final group in groups)
          TimelineGroup(
            date: group.date,
            items: List.unmodifiable(group.items),
          ),
      ]);
}
