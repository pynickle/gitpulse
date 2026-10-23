import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/session/gitpulse_http.dart';
import 'package:gitpulse/timeline/timeline_session.dart';
import 'package:gitpulse/timeline/timeline_state.dart';

import 'timeline_cache_test_support.dart';
import 'timeline_test_support.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('an expired connection is rechecked before another repository releases the shared gate', () async {
    final disk = await DiskTimeline.create();
    var now = disk.now;
    final h = disk.open(now: () => now);
    h.session.handlers['GET api/settings'] = () => BackendResult(
      statusCode: 200,
      data: {
        ...settingsJson([
          followJson('R_a', 'octo', 'alpha'),
          followJson('R_b', 'octo', 'beta'),
        ]),
        'releaseTimeline': {'retentionDays': 30},
      },
    );
    h.session.handlers['POST api/release-timeline/refresh'] = () =>
        BackendResult(
          statusCode: 200,
          data: roundJson(
            pages: {
              'R_a': pageJson('octo', 'alpha', [
                releaseJson(8, 'anchor', '2026-09-19T12:00:00Z'),
                releaseJson(7, 'retained', '2026-10-10T00:00:00Z'),
              ]),
              'R_b': pageJson('octo', 'beta', [
                releaseJson(8, 'anchor', '2026-10-10T00:00:00Z'),
                releaseJson(7, 'retained', '2026-10-09T00:00:00Z'),
              ]),
            },
          ),
        );
    await settle(h.container);
    h.session.handlers['POST api/release-timeline/refresh'] = () =>
        BackendResult(
          statusCode: 200,
          data: roundJson(
            pages: {
              'R_a': pageJson(
                'octo',
                'alpha',
                [
                  releaseJson(12, 'fresh', '2026-10-18T00:00:00Z'),
                  releaseJson(8, 'anchor', '2026-09-19T12:00:00Z'),
                ],
                hasOlderReleases: true,
                endCursor: 'a1',
              ),
              'R_b': pageJson(
                'octo',
                'beta',
                [releaseJson(12, 'fresh', '2026-10-18T00:00:00Z')],
                hasOlderReleases: true,
                endCursor: 'b1',
              ),
            },
          ),
        );
    final facade = h.container.read(releaseTimelineSessionProvider.notifier);
    await facade.refresh();
    expect(readState(h.container).waitingRepositories.map((item) => item.id), [
      'R_b',
    ]);
    now = now.add(const Duration(microseconds: 1));
    h.session.handlers[pageRequest({'R_a': 'a1', 'R_b': 'b1'})] = () =>
        BackendResult(
          statusCode: 200,
          data: roundJson(
            pages: {
              'R_a': pageJson(
                'octo',
                'alpha',
                [],
                hasOlderReleases: true,
                endCursor: 'a2',
              ),
              'R_b': pageJson(
                'octo',
                'beta',
                [releaseJson(8, 'anchor', '2026-10-10T00:00:00Z')],
                hasOlderReleases: true,
                endCursor: 'b2',
              ),
            },
          ),
        );
    await facade.loadOlder();
    expect(keys(h.container), ['R_a:12', 'R_b:12', 'R_b:8']);
    expect(readState(h.container).waitingRepositories.map((item) => item.id), [
      'R_a',
    ]);
  });

  test('exhaustion removes only its repository barrier and releases peer buffers through the shared boundary', () async {
    final disk = await DiskTimeline.create();
    var h = disk.open();
    h.session.handlers['GET api/settings'] = () => BackendResult(
      statusCode: 200,
      data: {
        ...settingsJson([
          followJson('R_a', 'octo', 'alpha'),
          followJson('R_b', 'octo', 'beta'),
        ]),
        'releaseTimeline': {'retentionDays': 30},
      },
    );
    h.session.handlers['POST api/release-timeline/refresh'] = () =>
        BackendResult(
          statusCode: 200,
          data: roundJson(
            pages: {
              'R_a': pageJson('octo', 'alpha', [
                releaseJson(8, 'v8', '2026-10-10T00:00:00Z'),
                releaseJson(7, 'v7', '2026-10-09T00:00:00Z'),
              ]),
              'R_b': pageJson('octo', 'beta', [
                releaseJson(8, 'v8', '2026-10-10T00:00:00Z'),
                releaseJson(7, 'v7', '2026-10-08T00:00:00Z'),
              ]),
            },
          ),
        );
    await settle(h.container);
    h.session.handlers['POST api/release-timeline/refresh'] = () =>
        BackendResult(
          statusCode: 200,
          data: roundJson(
            pages: {
              'R_a': pageJson(
                'octo',
                'alpha',
                [releaseJson(12, 'v12', '2026-10-12T00:00:00Z')],
                hasOlderReleases: true,
                endCursor: 'a1',
              ),
              'R_b': pageJson(
                'octo',
                'beta',
                [
                  releaseJson(9, 'v9', '2026-10-12T00:00:00Z'),
                  releaseJson(8, 'v8', '2026-10-10T00:00:00Z'),
                ],
                hasOlderReleases: true,
                endCursor: 'b1',
              ),
            },
          ),
        );
    final facade = h.container.read(releaseTimelineSessionProvider.notifier);
    await facade.refresh();
    expect(keys(h.container), ['R_a:12', 'R_b:9']);
    h.session.handlers[pageRequest({'R_a': 'a1', 'R_b': 'b1'})] = () =>
        BackendResult(
          statusCode: 200,
          data: roundJson(
            pages: {
              'R_a': pageJson('octo', 'alpha', []),
              'R_b': pageJson(
                'octo',
                'beta',
                [],
                hasOlderReleases: true,
                endCursor: 'b2',
              ),
            },
          ),
        );
    await facade.loadOlder();
    expect(keys(h.container), ['R_a:12', 'R_b:9', 'R_b:8', 'R_b:7']);
    expect(readState(h.container).partial, isFalse);
    await disk.close();
    h = disk.open();
    h.session.handlers['GET api/settings'] = () => BackendResult(
      statusCode: 200,
      data: {
        ...settingsJson([
          followJson('R_a', 'octo', 'alpha'),
          followJson('R_b', 'octo', 'beta'),
        ]),
        'releaseTimeline': {'retentionDays': 30},
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
                [releaseJson(8, 'recreated', '2026-10-10T00:00:00Z')],
                hasOlderReleases: true,
                endCursor: 'a2',
              ),
              'R_b': pageJson(
                'octo',
                'beta',
                [
                  releaseJson(9, 'v9', '2026-10-12T00:00:00Z'),
                  releaseJson(8, 'v8', '2026-10-10T00:00:00Z'),
                ],
                hasOlderReleases: true,
                endCursor: 'b1',
              ),
            },
          ),
        );
    await settle(h.container);
    expect(keys(h.container), ['R_b:9', 'R_a:8', 'R_b:8']);
    expect(readState(h.container).waitingRepositories.map((item) => item.id), [
      'R_a',
    ]);
  });

  test('an anchor that expires while bridging cannot unlock retained history with overlapping publication dates', () async {
    final disk = await DiskTimeline.create();
    var now = disk.now;
    final h = disk.open(now: () => now);
    configure(
      h,
      releases: [
        releaseJson(8, 'v8', '2026-09-19T12:00:00Z'),
        releaseJson(7, 'late-published', '2026-10-10T00:00:00Z'),
      ],
    );
    await settle(h.container);
    h.session.handlers['POST api/release-timeline/refresh'] = () =>
        BackendResult(
          statusCode: 200,
          data: roundJson(
            pages: {
              'R_a': pageJson(
                'octo',
                'alpha',
                [releaseJson(12, 'v12', '2026-10-10T00:00:00Z')],
                hasOlderReleases: true,
                endCursor: 'new1',
              ),
            },
          ),
        );
    final facade = h.container.read(releaseTimelineSessionProvider.notifier);
    await facade.refresh();
    expect(keys(h.container), ['R_a:12']);
    now = now.add(const Duration(microseconds: 1));
    h.session.handlers[pageRequest({'R_a': 'new1'})] = () => BackendResult(
      statusCode: 200,
      data: roundJson(
        pages: {
          'R_a': pageJson(
            'octo',
            'alpha',
            [releaseJson(8, 'expired anchor', '2026-09-19T12:00:00Z')],
            hasOlderReleases: true,
            endCursor: 'new2',
          ),
        },
      ),
    );
    await facade.loadOlder();
    expect(keys(h.container), ['R_a:12', 'R_a:8']);
    expect(
      readState(h.container).cacheConnection,
      TimelineCacheConnection.waiting,
    );
  });

  test('the first successful retry after a wholly failed refresh still applies the new connection gate', () async {
    final disk = await DiskTimeline.create();
    final h = disk.open();
    configure(
      h,
      releases: [
        releaseJson(8, 'v8', '2026-10-10T00:00:00Z'),
        releaseJson(7, 'v7', '2026-10-09T00:00:00Z'),
      ],
    );
    await settle(h.container);
    final facade = h.container.read(releaseTimelineSessionProvider.notifier);
    h.session.handlers['POST api/release-timeline/refresh'] = () =>
        const BackendResult(problem: BackendProblem.network);
    await facade.refresh();
    expect(keys(h.container), ['R_a:8', 'R_a:7']);
    h.session.handlers[pageRequest({'R_a': null})] = () => BackendResult(
      statusCode: 200,
      data: roundJson(
        pages: {
          'R_a': pageJson(
            'octo',
            'alpha',
            [releaseJson(12, 'v12', '2026-10-18T00:00:00Z')],
            hasOlderReleases: true,
            endCursor: 'new1',
          ),
        },
      ),
    );
    await facade.retryFailed();
    expect(keys(h.container), ['R_a:12']);
    expect(
      readState(h.container).cacheConnection,
      TimelineCacheConnection.waiting,
    );
  });

  test('incomplete and empty continuation pages cannot discard old history before successful exhaustion', () async {
    final disk = await DiskTimeline.create();
    var h = disk.open();
    configure(
      h,
      releases: [
        releaseJson(8, 'v8', '2026-10-10T00:00:00Z'),
        releaseJson(7, 'v7', '2026-10-09T00:00:00Z'),
      ],
    );
    await settle(h.container);
    h.session.handlers['POST api/release-timeline/refresh'] = () =>
        BackendResult(
          statusCode: 200,
          data: roundJson(
            pages: {
              'R_a': pageJson(
                'octo',
                'alpha',
                [releaseJson(12, 'v12', '2026-10-18T00:00:00Z')],
                hasOlderReleases: true,
                endCursor: 'new1',
              ),
            },
          ),
        );
    final facade = h.container.read(releaseTimelineSessionProvider.notifier);
    await facade.refresh();
    h.session.handlers[pageRequest({'R_a': 'new1'})] = () => BackendResult(
      statusCode: 200,
      data: roundJson(
        pages: {
          'R_a': pageJson('octo', 'alpha', [
            releaseJson(11, 'v11', '2026-10-17T00:00:00Z'),
          ], incomplete: true),
        },
      ),
    );
    await facade.loadOlder();
    expect(
      readState(h.container).cacheConnection,
      TimelineCacheConnection.waiting,
    );
    expect(readState(h.container).canRetry, isTrue);
    h.session.handlers[pageRequest({'R_a': 'new1'})] = () => BackendResult(
      statusCode: 200,
      data: roundJson(
        pages: {
          'R_a': pageJson(
            'octo',
            'alpha',
            [],
            hasOlderReleases: true,
            endCursor: 'new2',
          ),
        },
      ),
    );
    await facade.retryFailed();
    expect(
      readState(h.container).cacheConnection,
      TimelineCacheConnection.waiting,
    );
    expect(readState(h.container).canLoadOlder, isTrue);
    expect(keys(h.container), ['R_a:12', 'R_a:11']);
    h.session.handlers[pageRequest({'R_a': 'new2'})] = () => BackendResult(
      statusCode: 200,
      data: roundJson(pages: {'R_a': pageJson('octo', 'alpha', [])}),
    );
    await facade.loadOlder();
    expect(readState(h.container).waitingRepositories, isEmpty);
    expect(readState(h.container).canLoadOlder, isFalse);
    // The successful retry replaced the incomplete page with an empty page.
    // Exhaustion now removes its no-longer-present release as well as old cache.
    expect(keys(h.container), ['R_a:12']);
    await disk.close();
    h = disk.open();
    h.session.handlers['GET api/settings'] = () =>
        const BackendResult(problem: BackendProblem.network);
    h.session.handlers['POST api/release-timeline/refresh'] = () =>
        const BackendResult(problem: BackendProblem.network);
    await settle(h.container);
    expect(keys(h.container), ['R_a:12']);
    await disk.close();
    h = disk.open();
    configure(h, releases: []);
    h.session.handlers['POST api/release-timeline/refresh'] = () =>
        BackendResult(
          statusCode: 200,
          data: roundJson(
            pages: {
              'R_a': pageJson(
                'octo',
                'alpha',
                [releaseJson(8, 'v8', '2026-10-10T00:00:00Z')],
                hasOlderReleases: true,
                endCursor: 'recreated',
              ),
            },
          ),
        );
    await settle(h.container);
    // The removed old anchor cannot make its obsolete sibling reappear.
    expect(keys(h.container), ['R_a:8']);
    expect(
      readState(h.container).cacheConnection,
      TimelineCacheConnection.waiting,
    );
  });

  test('only a fetched bridge reaches older islands, including empty cached continuations and restarts', () async {
    final disk = await DiskTimeline.create();
    var h = disk.open();
    configure(h, releases: []);
    h.session.handlers['POST api/release-timeline/refresh'] = () =>
        BackendResult(
          statusCode: 200,
          data: roundJson(
            pages: {
              'R_a': pageJson(
                'octo',
                'alpha',
                [
                  releaseJson(8, 'v8', '2026-10-10T00:00:00Z'),
                  releaseJson(7, 'v7', '2026-10-09T00:00:00Z'),
                ],
                hasOlderReleases: true,
                endCursor: 'old1',
              ),
            },
          ),
        );
    await settle(h.container);
    h.session.handlers[pageRequest({'R_a': 'old1'})] = () => BackendResult(
      statusCode: 200,
      data: roundJson(
        pages: {
          'R_a': pageJson(
            'octo',
            'alpha',
            [],
            hasOlderReleases: true,
            endCursor: 'old2',
          ),
        },
      ),
    );
    h.session.handlers[pageRequest({'R_a': 'old2'})] = () => BackendResult(
      statusCode: 200,
      data: roundJson(
        pages: {
          'R_a': pageJson(
            'octo',
            'alpha',
            [releaseJson(6, 'v6', '2026-10-08T00:00:00Z')],
            hasOlderReleases: true,
            endCursor: 'old3',
          ),
        },
      ),
    );
    await h.container.read(releaseTimelineSessionProvider.notifier).loadOlder();
    await h.container.read(releaseTimelineSessionProvider.notifier).loadOlder();
    for (var attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await disk.close();
        h = disk.open();
        configure(h, releases: []);
      }
      h.session.handlers['POST api/release-timeline/refresh'] = () =>
          BackendResult(
            statusCode: 200,
            data: roundJson(
              pages: {
                'R_a': pageJson(
                  'octo',
                  'alpha',
                  [
                    releaseJson(12, 'v12', '2026-10-18T00:00:00Z'),
                    releaseJson(11, 'v11', '2026-10-17T00:00:00Z'),
                    releaseJson(10, 'v10', '2026-10-16T00:00:00Z'),
                  ],
                  hasOlderReleases: true,
                  endCursor: 'latest1',
                ),
              },
            ),
          );
      if (attempt == 0) {
        await h.container
            .read(releaseTimelineSessionProvider.notifier)
            .refresh();
      } else {
        await settle(h.container);
      }
      expect(keys(h.container), ['R_a:12', 'R_a:11', 'R_a:10']);
    }
    h.session.handlers[pageRequest({'R_a': 'latest1'})] = () => BackendResult(
      statusCode: 200,
      data: roundJson(
        pages: {
          'R_a': pageJson(
            'octo',
            'alpha',
            [
              releaseJson(9, 'v9', '2026-10-11T00:00:00Z'),
              releaseJson(8, 'v8', '2026-10-10T00:00:00Z'),
            ],
            hasOlderReleases: true,
            endCursor: 'bridge',
          ),
        },
      ),
    );
    await h.container.read(releaseTimelineSessionProvider.notifier).loadOlder();
    expect(keys(h.container), [
      'R_a:12',
      'R_a:11',
      'R_a:10',
      'R_a:9',
      'R_a:8',
      'R_a:7',
      'R_a:6',
    ]);
    await disk.close();
    h = disk.open();
    configure(h, releases: []);
    h.session.handlers['POST api/release-timeline/refresh'] = () =>
        BackendResult(
          statusCode: 200,
          data: roundJson(
            pages: {
              'R_a': pageJson(
                'octo',
                'alpha',
                [releaseJson(12, 'v12', '2026-10-18T00:00:00Z')],
                hasOlderReleases: true,
                endCursor: 'latest1',
              ),
            },
          ),
        );
    await settle(h.container);
    expect(keys(h.container), [
      'R_a:12',
      'R_a:11',
      'R_a:10',
      'R_a:9',
      'R_a:8',
      'R_a:7',
      'R_a:6',
    ]);
  });

  test('all repositories gate cached tails while fresh results and failed cursors remain usable', () async {
    final disk = await DiskTimeline.create();
    final h = disk.open();
    h.session.handlers['GET api/settings'] = () => BackendResult(
      statusCode: 200,
      data: {
        ...settingsJson([
          followJson('R_a', 'octo', 'alpha'),
          followJson('R_b', 'octo', 'beta'),
        ]),
        'releaseTimeline': {'retentionDays': 30},
      },
    );
    h.session.handlers['POST api/release-timeline/refresh'] = () =>
        BackendResult(
          statusCode: 200,
          data: roundJson(
            pages: {
              'R_a': pageJson('octo', 'alpha', [
                releaseJson(8, 'v8', '2026-10-10T00:00:00Z'),
                releaseJson(7, 'v7', '2026-10-09T00:00:00Z'),
              ]),
              'R_b': pageJson('octo', 'beta', [
                releaseJson(8, 'v8', '2026-10-10T00:00:00Z'),
                releaseJson(7, 'v7', '2026-10-09T00:00:00Z'),
              ]),
            },
          ),
        );
    await settle(h.container);
    h.session.handlers['POST api/release-timeline/refresh'] = () =>
        BackendResult(
          statusCode: 200,
          data: roundJson(
            pages: {
              'R_a': pageJson(
                'octo',
                'alpha',
                [
                  releaseJson(9, 'v9', '2026-10-11T00:00:00Z'),
                  releaseJson(8, 'v8', '2026-10-10T00:00:00Z'),
                ],
                hasOlderReleases: true,
                endCursor: 'a1',
              ),
              'R_b': unavailablePageJson(),
            },
            refresh: {'previousBaseline': '2026-10-09T12:00:00Z'},
          ),
        );
    final facade = h.container.read(releaseTimelineSessionProvider.notifier);
    await facade.refresh();
    expect(keys(h.container), ['R_a:9', 'R_a:8']);
    expect(readState(h.container).waitingRepositories.map((item) => item.id), [
      'R_b',
    ]);
    expect(readState(h.container).canRetry, isTrue);
    h.session.handlers[pageRequest({'R_b': null})] = () => BackendResult(
      statusCode: 200,
      data: roundJson(
        pages: {
          'R_b': pageJson(
            'octo',
            'beta',
            [
              releaseJson(9, 'v9', '2026-10-11T00:00:00Z'),
              releaseJson(8, 'v8', '2026-10-10T00:00:00Z'),
            ],
            hasOlderReleases: true,
            endCursor: 'b1',
          ),
        },
      ),
    );
    await facade.retryFailed();
    expect(keys(h.container), [
      'R_a:9',
      'R_b:9',
      'R_a:8',
      'R_b:8',
      'R_a:7',
      'R_b:7',
    ]);
    expect(
      readState(h.container).cacheConnection,
      TimelineCacheConnection.connected,
    );
    expect(readState(h.container).loadedNewCount, 4);
    h.session.handlers[pageRequest({'R_a': 'a1', 'R_b': 'b1'})] = () =>
        BackendResult(
          statusCode: 200,
          data: roundJson(
            pages: {
              'R_a': transientPageJson(),
              'R_b': pageJson(
                'octo',
                'beta',
                [],
                hasOlderReleases: true,
                endCursor: 'b2',
              ),
            },
          ),
        );
    await facade.loadOlder();
    expect(readState(h.container).canRetry, isTrue);
    expect(readState(h.container).partial, isTrue);
    h.session.handlers[pageRequest({'R_a': 'a1'})] = () => BackendResult(
      statusCode: 200,
      data: roundJson(pages: {'R_a': pageJson('octo', 'alpha', [])}),
    );
    await facade.retryFailed();
    expect(h.session.requests.last, pageRequest({'R_a': 'a1'}));
    expect(readState(h.container).canRetry, isFalse);
    expect(readState(h.container).previousBaseline, '2026-10-09T12:00:00Z');
  });

  test(
    'a fetched page reaching a retained segment exposes its connected tail',
    () async {
      final disk = await DiskTimeline.create();
      final h = disk.open();
      configure(
        h,
        releases: [
          releaseJson(8, 'v8', '2026-10-10T00:00:00Z'),
          releaseJson(7, 'v7', '2026-10-09T00:00:00Z'),
        ],
      );
      await settle(h.container);
      configure(h, releases: []);
      h.session.handlers['POST api/release-timeline/refresh'] = () =>
          BackendResult(
            statusCode: 200,
            data: roundJson(
              pages: {
                'R_a': pageJson(
                  'octo',
                  'alpha',
                  [
                    releaseJson(9, 'v9', '2026-10-11T00:00:00Z'),
                    releaseJson(
                      8,
                      'v8',
                      '2026-10-10T00:00:00Z',
                      description: 'edited',
                    ),
                  ],
                  hasOlderReleases: true,
                  endCursor: 'fresh',
                ),
              },
            ),
          );
      await h.container.read(releaseTimelineSessionProvider.notifier).refresh();
      expect(keys(h.container), ['R_a:9', 'R_a:8', 'R_a:7']);
      expect(
        readState(h.container).groups
            .expand((group) => group.items)
            .singleWhere((item) => item.id == 8)
            .notes,
        'edited',
      );
      expect(
        h.session.requests.where(
          (path) => path.startsWith('GET api/release-timeline'),
        ),
        isEmpty,
      );
    },
  );
}
