import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gitpulse/session/gitpulse_http.dart';
import 'package:gitpulse/session/session_controller.dart';
import 'package:gitpulse/timeline/timeline_session.dart';

import 'timeline_test_support.dart';

List<String> releaseKeys(ProviderContainer container) => [
  for (final group in readState(container).groups)
    for (final item in group.items) item.key,
];

Future<TimelineHarness> startTimeline(Map<String, Object?> pages) async {
  final harness = createHarness();
  harness.session.handlers['GET api/settings'] = () => BackendResult(
    statusCode: 200,
    data: settingsJson([
      for (final id in pages.keys) followJson(id, 'octo', id.toLowerCase()),
    ]),
  );
  harness.session.handlers['POST api/release-timeline/refresh'] = () =>
      BackendResult(
        statusCode: 200,
        data: roundJson(
          pages: pages,
          refresh: {'previousBaseline': '2026-10-03T00:00:00Z'},
        ),
      );
  await pumpEventQueue(times: 50);
  return harness;
}

void main() {
  test('each action advances independent cursors once, releases buffers at the shared boundary, and skips exhausted repositories', () async {
    final harness = createHarness();
    harness.session.handlers['GET api/settings'] = () => BackendResult(
      statusCode: 200,
      data: settingsJson([
        followJson('A', 'octo', 'alpha'),
        followJson('B', 'octo', 'beta'),
      ]),
    );
    harness.session.handlers['POST api/release-timeline/refresh'] = () =>
        BackendResult(
          statusCode: 200,
          data: roundJson(
            pages: {
              'A': pageJson(
                'octo',
                'alpha',
                [
                  releaseJson(5, 'a5', '2026-10-05T00:00:00Z'),
                  releaseJson(4, 'a4', '2026-10-04T00:00:00Z'),
                ],
                hasOlderReleases: true,
                endCursor: 'a/1+=',
              ),
              'B': pageJson(
                'octo',
                'beta',
                [
                  releaseJson(6, 'b6', '2026-10-06T00:00:00Z'),
                  releaseJson(2, 'b2', '2026-10-02T00:00:00Z'),
                ],
                hasOlderReleases: true,
                endCursor: 'b1',
              ),
            },
            refresh: {
              'previousBaseline': '2026-10-03T00:00:00Z',
              'startedAt': '2026-10-07T00:00:00Z',
            },
          ),
        );
    final first = pageRequest({'A': 'a/1+=', 'B': 'b1'});
    harness.session.handlers[first] = () => BackendResult(
      statusCode: 200,
      data: roundJson(
        pages: {
          'A': pageJson(
            'octo',
            'alpha',
            [releaseJson(3, 'a3', '2026-10-03T00:00:00Z')],
            hasOlderReleases: true,
            endCursor: 'a2',
          ),
          'B': pageJson('octo', 'beta', []),
        },
      ),
    );
    final second = pageRequest({'A': 'a2'});
    harness.session.handlers[second] = () => BackendResult(
      statusCode: 200,
      data: roundJson(
        pages: {
          'A': pageJson('octo', 'alpha', [
            releaseJson(1, 'a1', '2026-10-01T00:00:00Z'),
          ]),
        },
      ),
    );
    await pumpEventQueue(times: 50);
    expect(releaseKeys(harness.container), ['B:6', 'A:5', 'A:4']);
    final session = harness.container.read(
      releaseTimelineSessionProvider.notifier,
    );
    await session.loadOlder();
    expect(releaseKeys(harness.container), ['B:6', 'A:5', 'A:4', 'A:3']);
    expect(harness.session.requests.last, first);
    expect(readState(harness.container).canLoadOlder, isTrue);
    await session.loadOlder();
    expect(releaseKeys(harness.container), [
      'B:6',
      'A:5',
      'A:4',
      'A:3',
      'B:2',
      'A:1',
    ]);
    expect(readState(harness.container).canLoadOlder, isFalse);
    expect(
      readState(harness.container).previousBaseline,
      '2026-10-03T00:00:00Z',
    );
    expect(readState(harness.container).loadedNewCount, 3);
    await session.loadOlder();
    expect(harness.session.requests, [
      'GET api/settings',
      'POST api/release-timeline/refresh',
      first,
      second,
    ]);
  });

  test('targeted retry preserves other failures and late releases merge into the already exposed interval', () async {
    final harness = createHarness();
    harness.session.handlers['GET api/settings'] = () => BackendResult(
      statusCode: 200,
      data: settingsJson([
        followJson('A', 'octo', 'alpha'),
        followJson('B', 'octo', 'beta'),
      ]),
    );
    var refresh = roundJson(
      pages: {
        'A': pageJson('octo', 'alpha', [
          releaseJson(5, 'a5', '2026-10-05T00:00:00Z'),
        ], endCursor: 'previous-a'),
        'B': pageJson('octo', 'beta', [
          releaseJson(2, 'b2', '2026-10-02T00:00:00Z'),
        ], endCursor: 'previous-b'),
      },
      refresh: {'previousBaseline': '2026-10-03T00:00:00Z'},
    );
    harness.session.handlers['POST api/release-timeline/refresh'] = () =>
        BackendResult(statusCode: 200, data: refresh);
    await pumpEventQueue(times: 50);
    refresh = roundJson(
      pages: {'A': transientPageJson(), 'B': unavailablePageJson()},
    );
    final session = harness.container.read(
      releaseTimelineSessionProvider.notifier,
    );
    await session.refresh();
    expect(releaseKeys(harness.container), ['A:5', 'B:2']);
    harness.session.handlers[pageRequest({'A': null})] = () => BackendResult(
      statusCode: 200,
      data: roundJson(
        pages: {
          'A': pageJson('octo', 'alpha', [
            releaseJson(5, 'a5', '2026-10-05T00:00:00Z'),
          ]),
        },
      ),
    );
    await session.retryFailed(repositoryId: 'A');
    // The first usable retry establishes the new refresh window. Records kept
    // readable during the failed refresh are not pages fetched in this cycle.
    expect(releaseKeys(harness.container), ['A:5']);
    expect(
      readState(harness.container).unavailableRepositories.map((r) => r.id),
      ['B'],
    );
    expect(readState(harness.container).canRetry, isTrue);
    harness.session.handlers[pageRequest({'B': null})] = () => BackendResult(
      statusCode: 200,
      data: roundJson(
        pages: {
          'B': pageJson('octo', 'beta', [
            releaseJson(4, 'late', '2026-10-04T00:00:00Z'),
          ]),
        },
      ),
    );
    await session.retryFailed(repositoryId: 'B');
    expect(releaseKeys(harness.container), ['A:5', 'B:4']);
    expect(readState(harness.container).canRetry, isFalse);
    expect(readState(harness.container).partial, isFalse);
    expect(
      readState(harness.container).previousBaseline,
      '2026-10-03T00:00:00Z',
    );
  });

  test('empty display pages remain loadable, while incomplete and non-progressing pages keep their failed cursor', () async {
    final harness = await startTimeline({
      'A': pageJson(
        'octo',
        'a',
        [releaseJson(8, 'draft', '2026-10-08T00:00:00Z', isDraft: true)],
        hasOlderReleases: true,
        endCursor: 'a1',
      ),
    });
    final session = harness.container.read(
      releaseTimelineSessionProvider.notifier,
    );
    expect(releaseKeys(harness.container), isEmpty);
    expect(readState(harness.container).canLoadOlder, isTrue);
    harness.session.handlers[pageRequest({'A': 'a1'})] = () => BackendResult(
      statusCode: 200,
      data: roundJson(
        pages: {
          'A': pageJson(
            'octo',
            'a',
            [releaseJson(5, 'a5', '2026-10-05T00:00:00Z')],
            incomplete: true,
            hasOlderReleases: false,
            endCursor: 'untrusted',
          ),
        },
      ),
    );
    await session.loadOlder();
    expect(releaseKeys(harness.container), ['A:5']);
    expect(readState(harness.container).canRetry, isTrue);
    expect(readState(harness.container).canLoadOlder, isFalse);
    // A cursor that repeats itself cannot silently certify progress.
    harness.session.handlers[pageRequest({'A': 'a1'})] = () => BackendResult(
      statusCode: 200,
      data: roundJson(
        pages: {
          'A': pageJson(
            'octo',
            'a',
            [],
            hasOlderReleases: true,
            endCursor: 'a1',
          ),
        },
      ),
    );
    await session.retryFailed();
    expect(readState(harness.container).canRetry, isTrue);
    expect(readState(harness.container).partial, isTrue);
    harness.session.handlers[pageRequest({'A': 'a1'})] = () => BackendResult(
      statusCode: 200,
      data: roundJson(pages: {'A': pageJson('octo', 'a', [])}),
    );
    await session.retryFailed();
    expect(readState(harness.container).canRetry, isFalse);
    expect(readState(harness.container).canLoadOlder, isFalse);
    // Successful exhaustion is authoritative: the retried page no longer
    // contains the release previously supplied by its incomplete response.
    expect(releaseKeys(harness.container), isEmpty);
    expect(
      harness.session.requests.skip(2),
      List.filled(3, pageRequest({'A': 'a1'})),
    );
  });

  test('failed pages retain cursors, successful peers widen a partial window, and retry never hides exposed history', () async {
    final harness = await startTimeline({
      'A': pageJson(
        'octo',
        'a',
        [releaseJson(5, 'a5', '2026-10-05T00:00:00Z')],
        hasOlderReleases: true,
        endCursor: 'a1',
      ),
      'B': pageJson(
        'octo',
        'b',
        [releaseJson(6, 'b6', '2026-10-06T00:00:00Z')],
        hasOlderReleases: true,
        endCursor: 'b1',
      ),
      'C': unavailablePageJson(),
    });
    final session = harness.container.read(
      releaseTimelineSessionProvider.notifier,
    );
    harness.session.handlers[pageRequest({'A': 'a1', 'B': 'b1'})] = () =>
        BackendResult(
          statusCode: 200,
          data: roundJson(
            pages: {
              'A': pageJson('octo', 'a', [
                releaseJson(1, 'a1', '2026-10-01T00:00:00Z'),
              ]),
              'B': transientPageJson(),
            },
          ),
        );
    await session.loadOlder();
    expect(releaseKeys(harness.container), ['B:6', 'A:5', 'A:1']);
    expect(
      readState(harness.container).transientRepositories.map((r) => r.id),
      ['B'],
    );
    expect(
      readState(harness.container).unavailableRepositories.map((r) => r.id),
      ['C'],
    );
    final retry = pageRequest({'B': 'b1'});
    var page = pageJson(
      'octo',
      'b',
      [
        releaseJson(4, 'late', '2026-10-04T00:00:00Z'),
        releaseJson(4, 'late-edited', '2026-10-04T00:00:00Z'),
        releaseJson(3, 'b3', '2026-10-03T00:00:00Z'),
      ],
      hasOlderReleases: true,
      endCursor: 'b2',
    );
    harness.session.handlers[retry] = () =>
        BackendResult(statusCode: 200, data: roundJson(pages: {'B': page}));
    await session.retryFailed(repositoryId: 'B');
    expect(releaseKeys(harness.container), ['B:6', 'A:5', 'B:4', 'B:3', 'A:1']);
    expect(
      readState(harness.container).groups
          .expand((g) => g.items)
          .firstWhere((r) => r.key == 'B:4')
          .title,
      'late-edited',
    );
    expect(readState(harness.container).partial, isTrue);
    expect(readState(harness.container).transientRepositories, isEmpty);
    // A 200 response with no requested results is a failed page, not the end.
    harness.session.handlers[pageRequest({'B': 'b2'})] = () =>
        BackendResult(statusCode: 200, data: roundJson());
    await session.loadOlder();
    expect(readState(harness.container).failure, isNotNull);
    expect(releaseKeys(harness.container), contains('A:1'));
    harness.session.handlers[pageRequest({'B': 'b2'})] = () => BackendResult(
      statusCode: 200,
      data: roundJson(pages: {'B': pageJson('octo', 'b', [])}),
    );
    await session.retryFailed(repositoryId: 'B');
    expect(readState(harness.container).failure, isNull);
    expect(
      readState(harness.container).previousBaseline,
      '2026-10-03T00:00:00Z',
    );
    expect(
      harness.session.requests.where((r) => r.startsWith('POST')),
      hasLength(1),
    );
  });

  for (final superseding in ['refresh', 'follows', 'identity']) {
    test(
      '$superseding invalidates an in-flight older page and overlapping load actions do not start extra rounds',
      () async {
        final harness = await startTimeline({
          'A': pageJson(
            'octo',
            'a',
            [releaseJson(5, 'a5', '2026-10-05T00:00:00Z')],
            hasOlderReleases: true,
            endCursor: 'a1',
          ),
        });
        final session = harness.container.read(
          releaseTimelineSessionProvider.notifier,
        );
        final held = Completer<BackendResult>();
        harness.session.handlers[pageRequest({'A': 'a1'})] = () => held.future;
        final loading = session.loadOlder();
        await session.loadOlder();
        await session.retryFailed();
        expect(
          harness.session.requests.where((r) => r.contains('cursors=')),
          hasLength(1),
        );
        switch (superseding) {
          case 'refresh':
            await session.refresh();
          case 'follows':
            harness.session.handlers['GET api/settings'] = () =>
                BackendResult(statusCode: 200, data: settingsJson([]));
            await session.reloadFollows();
          case 'identity':
            harness.session.handlers['GET api/settings'] = () =>
                BackendResult(statusCode: 200, data: settingsJson([]));
            harness.session.emit(
              SessionState(
                phase: SessionPhase.signedIn,
                identity: signedInIdentity(login: 'hubot'),
              ),
            );
            await pumpEventQueue(times: 50);
        }
        held.complete(
          BackendResult(
            statusCode: 200,
            data: roundJson(
              pages: {
                'A': pageJson('octo', 'a', [
                  releaseJson(1, 'obsolete', '2026-10-01T00:00:00Z'),
                ]),
              },
            ),
          ),
        );
        await loading;
        expect(releaseKeys(harness.container), isNot(contains('A:1')));
        expect(readState(harness.container).loading, isFalse);
      },
    );
  }
}
