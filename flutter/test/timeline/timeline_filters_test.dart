import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/repositories/repository_models.dart';
import 'package:gitpulse/session/gitpulse_http.dart';
import 'package:gitpulse/session/session_controller.dart';
import 'package:gitpulse/timeline/timeline_filters.dart';
import 'package:gitpulse/timeline/timeline_session.dart';
import 'package:gitpulse/timeline/timeline_state.dart';

import 'timeline_cache_test_support.dart';
import 'timeline_test_support.dart';

List<String> visibleKeys(Harness harness) =>
    readState(harness.container).visibleGroups
        .expand((group) => group.items)
        .map((release) => release.key)
        .toList();

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Harness harness;

  setUp(() async {
    harness = createHarness(now: () => DateTime.utc(2026, 10, 20, 12));
    harness.session.handlers['GET api/settings'] = () => BackendResult(
      statusCode: 200,
      data: settingsJson([
        followJson('R_alpha', 'octo', 'alpha'),
        followJson('R_api', 'acme', 'api'),
        followJson('R_versions', 'octo', 'versions'),
        followJson('R_zh', 'octo', 'zh'),
        followJson('R_raw', 'octo', 'raw'),
      ]),
    );
    harness.session.handlers['POST api/release-timeline/refresh'] = () =>
        BackendResult(
          statusCode: 200,
          data: roundJson(
            pages: {
              'R_alpha': pageJson('octo', 'alpha', [
                releaseJson(
                  1,
                  'v1.4.200',
                  '2026-10-12T10:00:00Z',
                  name: 'Widgets release',
                  description: 'Notes about widgets.',
                  notesSearchText: 'notes about widgets.',
                ),
                releaseJson(
                  2,
                  'v2.0.0',
                  '2026-10-11T10:00:00Z',
                  name: 'Context bar default',
                  description: 'Explains the context bar.',
                  notesSearchText: 'explains the context bar.',
                ),
              ]),
              'R_api': pageJson('acme', 'api', [
                releaseJson(
                  3,
                  'v0.10.1',
                  '2026-10-10T10:00:00Z',
                  name: 'API update',
                  description:
                      'Read [the docs](https://example.com/HIDDENPATH) and '
                      '![badge](https://img.example/badge.svg) about ZEBRA.',
                  notesSearchText: 'read the docs and badge about zebra.',
                ),
                releaseJson(
                  4,
                  'v0.1.5-rc.2',
                  '2026-10-09T10:00:00Z',
                  name: 'Docs preview',
                  isPrerelease: true,
                ),
              ]),
              'R_versions': pageJson('octo', 'versions', [
                releaseJson(
                  30,
                  'v3.12.0',
                  '2026-10-08T10:00:00Z',
                  name: 'Series',
                ),
                releaseJson(31, 'v3.120', '2026-10-07T10:00:00Z', name: 'Long'),
                releaseJson(
                  32,
                  'v13.12',
                  '2026-10-06T10:00:00Z',
                  name: 'Other',
                ),
              ]),
              'R_zh': pageJson('octo', 'zh', [
                releaseJson(40, 'v1.0', '2026-10-05T10:00:00Z', name: '中文发布说明'),
                releaseJson(41, 'v1.1', '2026-10-04T10:00:00Z', name: '中文 更新'),
              ]),
              'R_raw': pageJson('octo', 'raw', [
                releaseJson(
                  50,
                  'v5.0.0',
                  '2026-10-03T10:00:00Z',
                  description:
                      '<details open><summary>RawLabel</summary>'
                      '<p>Visible body</p></details> '
                      '<img src="https://img.example/HIDDENSRC" alt="RawAlt">',
                  notesSearchText: 'rawlabel visible body rawalt',
                ),
              ]),
            },
            refresh: {
              'previousBaseline': '2026-10-11T00:00:00.000Z',
              'startedAt': '2026-10-20T00:00:00.000Z',
            },
          ),
        );
    await settle(harness.container);
  });

  ReleaseTimelineSession facade() =>
      harness.container.read(releaseTimelineSessionProvider.notifier);

  test('repository, title, and tag replace the title-only search while notes stay excluded', () async {
    const cases = <({String query, bool notes, List<String> expected})>[
      (query: 'widgets', notes: false, expected: ['R_alpha:1']),
      (query: 'alpha', notes: false, expected: ['R_alpha:1', 'R_alpha:2']),
      (query: 'acme/api', notes: false, expected: ['R_api:3', 'R_api:4']),
      (query: 'v2.0.0', notes: false, expected: ['R_alpha:2']),
      (query: 'context bar', notes: false, expected: ['R_alpha:2']),
      (query: 'rc.2', notes: false, expected: ['R_api:4']),
      (query: 'notes', notes: false, expected: []),
      (query: 'ZEBRA', notes: false, expected: []),
      (query: 'ZEBRA', notes: true, expected: ['R_api:3']),
      (query: 'HIDDENPATH', notes: true, expected: []),
      (query: 'the docs', notes: true, expected: ['R_api:3']),
      (query: 'acme ZEBRA', notes: true, expected: ['R_api:3']),
      (query: 'acme context', notes: true, expected: []),
      (query: '"context bar"', notes: false, expected: ['R_alpha:2']),
      (query: '"context b', notes: false, expected: ['R_alpha:2']),
      (query: '  CONTEXT\tBAR  ', notes: false, expected: ['R_alpha:2']),
      (query: '3.12', notes: false, expected: ['R_versions:30']),
      (query: 'v3.12', notes: false, expected: ['R_versions:30']),
      (query: '中文', notes: false, expected: ['R_zh:40', 'R_zh:41']),
      (query: '中文 发布', notes: false, expected: ['R_zh:40']),
      (query: 'RawLabel', notes: true, expected: ['R_raw:50']),
      (query: 'visible body', notes: true, expected: ['R_raw:50']),
      (query: 'RawAlt', notes: true, expected: ['R_raw:50']),
      (query: 'details', notes: true, expected: []),
      (query: 'HIDDENSRC', notes: true, expected: []),
    ];

    for (final item in cases) {
      facade().applyFilters(
        TimelineFilterState(query: item.query, includeReleaseNotes: item.notes),
      );
      expect(
        visibleKeys(harness),
        item.expected,
        reason: 'query ${item.query} notes ${item.notes}',
      );
    }
  });

  test('an empty query removes only the text restriction', () async {
    facade().applyFilters(const TimelineFilterState(query: '   '));
    expect(visibleKeys(harness), hasLength(10));
  });

  test(
    'note search uses the backend text without parsing the source',
    () async {
      harness.session.handlers['POST api/release-timeline/refresh'] = () =>
          BackendResult(
            statusCode: 200,
            data: roundJson(
              pages: {
                'R_alpha': pageJson('octo', 'alpha', [
                  releaseJson(
                    9,
                    'v9.0.0',
                    '2026-10-18T10:00:00Z',
                    description: 'source-only',
                    notesSearchText: 'server content',
                  ),
                ]),
              },
            ),
          );
      await facade().refresh();
      facade().applyFilters(
        const TimelineFilterState(
          query: 'server content',
          includeReleaseNotes: true,
        ),
      );
      expect(visibleKeys(harness), ['R_alpha:9']);
      facade().applyFilters(
        const TimelineFilterState(
          query: 'source-only',
          includeReleaseNotes: true,
        ),
      );
      expect(visibleKeys(harness), isEmpty);
    },
  );

  test('full release notes beyond the card preview are searchable only when enabled', () async {
    final long = List.filled(30, 'Complete release notes.\n').join();
    harness.session.handlers['POST api/release-timeline/refresh'] = () =>
        BackendResult(
          statusCode: 200,
          data: roundJson(
            pages: {
              'R_alpha': pageJson('octo', 'alpha', [
                releaseJson(
                  9,
                  'v9.0.0',
                  '2026-10-18T10:00:00Z',
                  description: '$long deep needle',
                  notesSearchText: 'complete release notes. deep needle',
                ),
              ]),
            },
          ),
        );
    await facade().refresh();

    facade().applyFilters(const TimelineFilterState(query: 'deep needle'));
    expect(visibleKeys(harness), isEmpty);

    facade().applyFilters(
      const TimelineFilterState(
        query: 'deep needle',
        includeReleaseNotes: true,
      ),
    );
    expect(visibleKeys(harness), ['R_alpha:9']);
  });

  test(
    'repository, published-date, and prerelease filters combine with search',
    () async {
      facade().applyFilters(
        const TimelineFilterState(repositoryIds: ['R_api']),
      );
      expect(visibleKeys(harness), ['R_api:3', 'R_api:4']);

      facade().applyFilters(
        const TimelineFilterState(
          dateRange: TimelineDateRange(from: '2026-10-10', to: '2026-10-11'),
        ),
      );
      expect(visibleKeys(harness), ['R_alpha:2', 'R_api:3']);

      facade().applyFilters(
        const TimelineFilterState(
          dateRange: TimelineDateRange(to: '2026-10-10'),
        ),
      );
      expect(visibleKeys(harness), [
        'R_api:3',
        'R_api:4',
        'R_versions:30',
        'R_versions:31',
        'R_versions:32',
        'R_zh:40',
        'R_zh:41',
        'R_raw:50',
      ]);

      facade().applyFilters(const TimelineFilterState(hidePrereleases: true));
      expect(visibleKeys(harness), isNot(contains('R_api:4')));

      facade().applyFilters(
        const TimelineFilterState(
          repositoryIds: ['R_alpha'],
          dateRange: TimelineDateRange(from: '2026-10-11'),
          query: 'context',
        ),
      );
      expect(visibleKeys(harness), ['R_alpha:2']);
    },
  );

  test('the loaded-new count is recomputed from the captured baseline after filters', () async {
    int count() => readState(harness.container).loadedNewCount;

    expect(count(), 2);
    facade().applyFilters(const TimelineFilterState(query: 'context'));
    expect(count(), 1);
    facade().applyFilters(const TimelineFilterState(repositoryIds: ['R_api']));
    expect(count(), 0);
    facade().applyFilters(const TimelineFilterState(hidePrereleases: true));
    expect(count(), 2);
  });

  test(
    'follow removals update filtered releases, counts and baseline together',
    () async {
      facade().applyFilters(const TimelineFilterState(query: 'alpha'));
      expect(visibleKeys(harness), ['R_alpha:1', 'R_alpha:2']);
      expect(readState(harness.container).loadedNewCount, 2);
      expect(readState(harness.container).baselineExposed, isTrue);
      final requests = List.of(harness.session.requests);

      await facade().applyFollows([
        const RepositoryReference(id: 'R_api', owner: 'acme', name: 'api'),
      ]);
      expect(keys(harness.container), ['R_api:3', 'R_api:4']);
      expect(visibleKeys(harness), isEmpty);
      expect(readState(harness.container).filteredEmpty, isTrue);
      expect(readState(harness.container).loadedNewCount, 0);
      expect(readState(harness.container).baselineExposed, isTrue);

      await facade().applyFollows([]);
      final empty = readState(harness.container);
      expect(empty.groups, isEmpty);
      expect(empty.visibleGroups, isEmpty);
      expect(empty.loadedNewCount, 0);
      expect(empty.baselineExposed, isFalse);
      expect(empty.previousBaseline, '2026-10-11T00:00:00.000Z');
      expect(harness.session.requests, requests);
    },
  );

  test('filtering never requests releases and older loading still works when the filter hides every card', () async {
    harness.session.handlers['POST api/release-timeline/refresh'] = () =>
        BackendResult(
          statusCode: 200,
          data: roundJson(
            pages: {
              'R_alpha': pageJson(
                'octo',
                'alpha',
                [releaseJson(100, 'recent', '2026-10-18T10:00:00Z')],
                hasOlderReleases: true,
                endCursor: 'a1',
              ),
            },
            refresh: {
              'previousBaseline': '2026-10-17T00:00:00.000Z',
              'startedAt': '2026-10-20T00:00:00.000Z',
            },
          ),
        );
    harness.session.handlers['GET api/settings'] = () => BackendResult(
      statusCode: 200,
      data: settingsJson([followJson('R_alpha', 'octo', 'alpha')]),
    );
    harness.session.handlers[pageRequest({'R_alpha': 'a1'})] = () =>
        BackendResult(
          statusCode: 200,
          data: roundJson(
            pages: {
              'R_alpha': pageJson('octo', 'alpha', [
                releaseJson(5, 'ancient', '2026-10-01T10:00:00Z'),
              ]),
            },
          ),
        );
    await facade().refresh();
    final beforeFilter = List.of(harness.session.requests);

    facade().applyFilters(const TimelineFilterState(query: 'ancient'));
    expect(readState(harness.container).filteredEmpty, isTrue);
    expect(readState(harness.container).canLoadOlder, isTrue);
    expect(harness.session.requests, beforeFilter);
    expect(readState(harness.container).loadedNewCount, 0);

    await facade().loadOlder();
    expect(visibleKeys(harness), ['R_alpha:5']);
    expect(harness.session.requests.last, pageRequest({'R_alpha': 'a1'}));
  });

  test(
    'a disconnected retained release never appears in search or counts',
    () async {
      final disk = await DiskTimeline.create();
      var h = disk.open();
      h.session.handlers['GET api/settings'] = () => BackendResult(
        statusCode: 200,
        data: {
          ...settingsJson([followJson('R_a', 'octo', 'alpha')]),
        },
      );
      h.session.handlers['POST api/release-timeline/refresh'] = () =>
          BackendResult(
            statusCode: 200,
            data: roundJson(
              pages: {
                'R_a': pageJson(
                  'octo',
                  'alpha',
                  [
                    releaseJson(50, 'kept anchor', '2026-10-18T10:00:00Z'),
                    releaseJson(49, 'older island', '2026-10-10T10:00:00Z'),
                  ],
                  hasOlderReleases: true,
                  endCursor: 'a1',
                ),
              },
              refresh: {
                'previousBaseline': '2026-10-17T00:00:00.000Z',
                'startedAt': '2026-10-20T00:00:00.000Z',
              },
            ),
          );
      await settle(h.container);
      expect(keys(h.container), ['R_a:50', 'R_a:49']);
      expect(readState(h.container).cacheFailed, isFalse);

      h.session.handlers['POST api/release-timeline/refresh'] = () =>
          BackendResult(
            statusCode: 200,
            data: roundJson(
              pages: {
                'R_a': pageJson(
                  'octo',
                  'alpha',
                  [releaseJson(51, 'fresh only', '2026-10-19T10:00:00Z')],
                  hasOlderReleases: true,
                  endCursor: 'a2',
                ),
              },
              refresh: {
                'previousBaseline': '2026-10-17T00:00:00.000Z',
                'startedAt': '2026-10-20T01:00:00.000Z',
              },
            ),
          );
      final facade = h.container.read(releaseTimelineSessionProvider.notifier);
      await facade.refresh();
      expect(keys(h.container), ['R_a:51']);
      // The retained release is still on disk: the shared gate reports it as
      // disconnected, which is why neither search nor counting may see it.
      expect(
        readState(h.container).cacheConnection,
        TimelineCacheConnection.waiting,
      );

      for (final query in ['older island', 'kept anchor']) {
        facade.applyFilters(TimelineFilterState(query: query));
        expect(visibleKeys(h), isEmpty, reason: query);
        expect(readState(h.container).loadedNewCount, 0, reason: query);
      }
      facade.applyFilters(const TimelineFilterState(query: 'fresh only'));
      expect(visibleKeys(h), ['R_a:51']);
      expect(readState(h.container).loadedNewCount, 1);
    },
  );

  test('an offline restart filters only the saved exposed window and makes no requests', () async {
    final disk = await DiskTimeline.create();
    final online = disk.open();
    online.session.handlers['GET api/settings'] = () => BackendResult(
      statusCode: 200,
      data: {
        ...settingsJson([followJson('R_a', 'octo', 'alpha')]),
      },
    );
    online.session.handlers['POST api/release-timeline/refresh'] = () =>
        BackendResult(
          statusCode: 200,
          data: roundJson(
            pages: {
              'R_a': pageJson('octo', 'alpha', [
                releaseJson(
                  60,
                  'visible one',
                  '2026-10-18T10:00:00Z',
                  description: 'Alpha notes',
                ),
                releaseJson(61, 'old saved', '2026-10-15T10:00:00Z'),
              ]),
            },
            refresh: {
              'previousBaseline': '2026-10-17T00:00:00.000Z',
              'startedAt': '2026-10-20T00:00:00.000Z',
            },
          ),
        );
    await settle(online.container);
    await disk.close();

    final offline = disk.open();
    offline.session.handlers['GET api/settings'] = () =>
        const BackendResult(problem: BackendProblem.network);
    offline.session.handlers['POST api/release-timeline/refresh'] = () =>
        const BackendResult(problem: BackendProblem.network);
    await settle(offline.container);
    expect(keys(offline.container), ['R_a:60', 'R_a:61']);
    expect(readState(offline.container).baselineExposed, isTrue);
    final requests = List.of(offline.session.requests);
    final facade = offline.container.read(
      releaseTimelineSessionProvider.notifier,
    );

    facade.applyFilters(
      const TimelineFilterState(
        query: 'visible',
        dateRange: TimelineDateRange(from: '2026-10-16'),
      ),
    );
    expect(visibleKeys(offline), ['R_a:60']);
    expect(readState(offline.container).loadedNewCount, 1);
    // Filtering out the older card does not shrink the restored window or lose
    // its boundary when the live pagination cycle is still empty.
    expect(readState(offline.container).baselineExposed, isTrue);

    facade.applyFilters(const TimelineFilterState(query: 'old saved'));
    expect(visibleKeys(offline), ['R_a:61']);
    expect(readState(offline.container).loadedNewCount, 0);

    facade.applyFilters(const TimelineFilterState(query: 'never saved'));
    expect(visibleKeys(offline), isEmpty);
    expect(readState(offline.container).loadedNewCount, 0);
    expect(readState(offline.container).baselineExposed, isTrue);
    expect(offline.session.requests, requests);
  });

  test(
    'saving while a filter is active keeps the whole exposed window',
    () async {
      final disk = await DiskTimeline.create();
      final online = disk.open();
      online.session.handlers['GET api/settings'] = () => BackendResult(
        statusCode: 200,
        data: {
          ...settingsJson([followJson('R_a', 'octo', 'alpha')]),
        },
      );
      BackendResult cycle(List<Map<String, Object?>> releases) => BackendResult(
        statusCode: 200,
        data: roundJson(
          pages: {'R_a': pageJson('octo', 'alpha', releases)},
          refresh: {
            'previousBaseline': '2026-10-17T00:00:00.000Z',
            'startedAt': '2026-10-20T00:00:00.000Z',
          },
        ),
      );
      online.session.handlers['POST api/release-timeline/refresh'] = () =>
          cycle([
            releaseJson(60, 'alpha one', '2026-10-18T10:00:00Z'),
            releaseJson(62, 'alpha two', '2026-10-15T10:00:00Z'),
          ]);
      await settle(online.container);
      final facade = online.container.read(
        releaseTimelineSessionProvider.notifier,
      );

      facade.applyFilters(const TimelineFilterState(query: 'alpha two'));
      expect(visibleKeys(online), ['R_a:62']);
      online.session.handlers['POST api/release-timeline/refresh'] = () =>
          cycle([
            releaseJson(60, 'alpha one', '2026-10-18T10:00:00Z'),
            releaseJson(63, 'alpha three', '2026-10-16T10:00:00Z'),
            releaseJson(62, 'alpha two', '2026-10-15T10:00:00Z'),
          ]);
      await facade.refresh();
      expect(visibleKeys(online), ['R_a:62']);
      expect(keys(online.container), ['R_a:60', 'R_a:63', 'R_a:62']);
      await disk.close();

      final offline = disk.open();
      offline.session.handlers['GET api/settings'] = () =>
          const BackendResult(problem: BackendProblem.network);
      offline.session.handlers['POST api/release-timeline/refresh'] = () =>
          const BackendResult(problem: BackendProblem.network);
      await settle(offline.container);
      expect(keys(offline.container), ['R_a:60', 'R_a:63', 'R_a:62']);

      final offlineFacade = offline.container.read(
        releaseTimelineSessionProvider.notifier,
      );
      offlineFacade.applyFilters(const TimelineFilterState(query: 'alpha'));
      expect(visibleKeys(offline), ['R_a:60', 'R_a:63', 'R_a:62']);
      expect(readState(offline.container).loadedNewCount, 1);
    },
  );

  test('an identity change clears the previous account filters', () async {
    facade().applyFilters(const TimelineFilterState(query: 'alpha'));
    expect(readState(harness.container).filters.query, 'alpha');

    harness.session.emit(const SessionState(phase: SessionPhase.signedOut));
    await pumpEventQueue(times: 10);

    expect(readState(harness.container).filters, const TimelineFilterState());
    expect(readState(harness.container).visibleGroups, isEmpty);
  });
}
