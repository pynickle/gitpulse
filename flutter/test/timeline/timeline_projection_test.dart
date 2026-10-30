import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/repositories/repository_models.dart';
import 'package:gitpulse/timeline/timeline_filters.dart';
import 'package:gitpulse/timeline/timeline_models.dart';
import 'package:gitpulse/timeline/timeline_projection.dart';

void main() {
  test('filter changes keep the window, new count and baseline in step', () {
    final projection = TimelineProjection(
      groups: [
        TimelineGroup(
          date: '2026-10-22',
          items: [_release(1, _alpha, 22), _release(2, _beta, 22)],
        ),
        TimelineGroup(date: '2026-10-19', items: [_release(3, _alpha, 19)]),
      ],
      previousBaseline: '2026-10-20T00:00:00Z',
      windowLowerBound: DateTime.utc(2026, 10, 19).millisecondsSinceEpoch,
      filters: const TimelineFilterState(repositoryIds: ['alpha']),
    );

    expect(_keys(projection.visibleGroups), ['alpha:1', 'alpha:3']);
    expect(projection.loadedNewCount, 1);
    expect(projection.baselineExposed, isTrue);

    final hidden = projection.withFilters(
      const TimelineFilterState(query: 'no match'),
    );
    expect(hidden.visibleGroups, isEmpty);
    expect(hidden.loadedNewCount, 0);
    expect(hidden.baselineExposed, isTrue);
    expect(_keys(hidden.groups), ['alpha:1', 'beta:2', 'alpha:3']);
    expect(hidden.previousBaseline, '2026-10-20T00:00:00Z');

    final cleared = hidden.withFilters(const TimelineFilterState());
    expect(_keys(cleared.visibleGroups), ['alpha:1', 'beta:2', 'alpha:3']);
    expect(cleared.loadedNewCount, 2);
    expect(cleared.baselineExposed, isTrue);
    expect(_keys(projection.visibleGroups), ['alpha:1', 'alpha:3']);
  });

  test('published projections own immutable window and filter snapshots', () {
    final items = [_release(1, _alpha, 22), _release(2, _beta, 22)];
    final groups = [TimelineGroup(date: '2026-10-22', items: items)];
    final selected = ['alpha'];
    final projection = TimelineProjection(
      groups: groups,
      filters: TimelineFilterState(repositoryIds: selected),
      previousBaseline: '2026-10-20T00:00:00Z',
    );

    groups.clear();
    items.clear();
    selected.clear();
    expect(_keys(projection.groups), ['alpha:1', 'beta:2']);
    expect(_keys(projection.visibleGroups), ['alpha:1']);
    expect(projection.filters.repositoryIds, ['alpha']);
    expect(projection.loadedNewCount, 1);
    expect(() => projection.groups.clear(), throwsUnsupportedError);
    expect(
      () => projection.groups.single.items.clear(),
      throwsUnsupportedError,
    );
    expect(
      () => projection.visibleGroups.single.items.clear(),
      throwsUnsupportedError,
    );
    expect(
      () => projection.filters.repositoryIds.clear(),
      throwsUnsupportedError,
    );

    final nextSelection = ['beta'];
    final next = projection.withFilters(
      TimelineFilterState(repositoryIds: nextSelection),
    );
    nextSelection.add('alpha');
    expect(next.filters.repositoryIds, ['beta']);
    expect(_keys(next.visibleGroups), ['beta:2']);
    expect(next.loadedNewCount, 1);
  });
}

const _alpha = RepositoryReference(id: 'alpha', owner: 'acme', name: 'alpha');
const _beta = RepositoryReference(id: 'beta', owner: 'acme', name: 'beta');

TimelineRelease _release(int id, RepositoryReference repository, int day) =>
    TimelineRelease(
      repository: repository,
      id: id,
      tagName: 'v$id',
      title: 'Release $id',
      publishedAt: DateTime.utc(2026, 10, day),
      notes: '',
      notesSearchText: '',
      changelog: '',
      changelogTruncated: false,
      assetCount: 0,
      isPrerelease: false,
      isOldestShown: false,
      htmlUrl: null,
    );

List<String> _keys(List<TimelineGroup> groups) => [
  for (final group in groups)
    for (final release in group.items) release.key,
];
