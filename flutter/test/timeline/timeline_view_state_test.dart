import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/repositories/repository_models.dart';
import 'package:gitpulse/timeline/timeline_filters.dart';
import 'package:gitpulse/timeline/timeline_models.dart';
import 'package:gitpulse/timeline/timeline_projection.dart';
import 'package:gitpulse/timeline/timeline_state.dart';

void main() {
  test('the reader sees every content value it was derived from', () {
    const waiting = RepositoryReference(
      id: 'R_beta',
      owner: 'octo',
      name: 'beta',
    );
    final content = TimelineContentState(
      active: true,
      hasFollows: true,
      unavailableRepositories: const [
        RepositoryReference(id: 'R_gone', owner: 'octo', name: 'gone'),
      ],
      transientRepositories: const [
        RepositoryReference(id: 'R_flaky', owner: 'octo', name: 'flaky'),
      ],
      partial: true,
      canRetry: true,
      canLoadOlder: true,
      failure: const TimelineFailure(TimelineFailureKind.network),
      persistenceFailed: true,
      cacheFailed: true,
      cacheCorrupted: true,
      offline: true,
      restored: true,
      savedAt: DateTime.utc(2026, 10, 19, 12),
      cacheConnection: TimelineCacheConnection.waiting,
      waitingRepositories: const [waiting],
      cacheActions: const TimelineCacheActions(clearing: true),
    );

    final state = TimelineViewState(
      content: content,
      projection: const TimelineProjection.empty(),
    );

    expect(identical(state.content, content), isTrue);
    expect(state.active, isTrue);
    expect(state.loading, isFalse);
    expect(state.hasFollows, isTrue);
    expect(state.unavailableRepositories.single.id, 'R_gone');
    expect(state.transientRepositories.single.id, 'R_flaky');
    expect(state.hasLookupFailures, isTrue);
    expect(state.partial, isTrue);
    expect(state.canRetry, isTrue);
    expect(state.canLoadOlder, isTrue);
    expect(state.failure?.kind, TimelineFailureKind.network);
    expect(state.persistenceFailed, isTrue);
    expect(state.cacheFailed, isTrue);
    expect(state.cacheCorrupted, isTrue);
    expect(state.offline, isTrue);
    expect(state.restored, isTrue);
    expect(state.savedAt, DateTime.utc(2026, 10, 19, 12));
    expect(state.cacheConnection, TimelineCacheConnection.waiting);
    expect(state.waitingRepositories.single.id, 'R_beta');
    expect(state.cacheActions.clearing, isTrue);
  });

  test('a filter change re-presents the same window and keeps its content', () {
    final content = TimelineContentState(
      active: true,
      window: TimelineWindow(
        groups: [
          TimelineGroup(
            date: '2026-10-22',
            items: [
              _release(1, isPrerelease: false),
              _release(2, isPrerelease: true),
            ],
          ),
        ],
        previousBaseline: '2026-10-20T00:00:00Z',
      ),
    );
    final state = TimelineViewState(
      content: content,
      projection: const TimelineProjection.empty().withWindow(content.window),
    );

    expect(_keys(state.groups), ['alpha:1', 'alpha:2']);
    expect(_keys(state.visibleGroups), ['alpha:1', 'alpha:2']);
    expect(state.previousBaseline, '2026-10-20T00:00:00Z');

    final hidden = state.withFilters(
      const TimelineFilterState(hidePrereleases: true),
    );

    expect(_keys(hidden.groups), ['alpha:1', 'alpha:2']);
    expect(_keys(hidden.visibleGroups), ['alpha:1']);
    expect(hidden.filters.hidePrereleases, isTrue);
    expect(identical(hidden.content, content), isTrue);
  });
}

const _alpha = RepositoryReference(id: 'alpha', owner: 'acme', name: 'alpha');

TimelineRelease _release(int id, {required bool isPrerelease}) =>
    TimelineRelease(
      repository: _alpha,
      id: id,
      tagName: 'v$id',
      title: 'Release $id',
      publishedAt: DateTime.utc(2026, 10, 22),
      notes: '',
      notesSearchText: '',
      changelog: '',
      changelogTruncated: false,
      assetCount: 0,
      isPrerelease: isPrerelease,
      isOldestShown: false,
      htmlUrl: null,
    );

List<String> _keys(List<TimelineGroup> groups) => [
  for (final group in groups)
    for (final release in group.items) release.key,
];
