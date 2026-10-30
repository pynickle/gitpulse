import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/session/gitpulse_http.dart';
import 'package:gitpulse/session/session_controller.dart';
import 'package:gitpulse/timeline/timeline_session.dart';

import 'timeline_test_support.dart';

void main() {
  test('retry after a failed follow reload rereads shared settings before requesting repository pages', () async {
    final harness = createHarness();
    var settings = BackendResult(
      statusCode: 200,
      data: settingsJson([followJson('R_alpha', 'octo', 'alpha')]),
    );
    harness.session.handlers['GET api/settings'] = () => settings;
    var pages = {
      'R_alpha': pageJson('octo', 'alpha', [
        releaseJson(12, 'v1.2', '2026-10-05T10:00:00Z'),
      ]),
    };
    harness.session.handlers['POST api/release-timeline/refresh'] = () =>
        BackendResult(statusCode: 200, data: roundJson(pages: pages));
    await pumpEventQueue(times: 10);
    final facade = harness.container.read(
      releaseTimelineSessionProvider.notifier,
    );
    final removals = <TimelineFollowRemoval>[];
    final subscription = facade.followRemovals.listen(removals.add);
    addTearDown(subscription.cancel);
    settings = const BackendResult(
      statusCode: 503,
      problem: BackendProblem.unavailable,
    );
    await facade.reloadFollows();
    expect(readState(harness.container).canRetry, isTrue);
    settings = BackendResult(
      statusCode: 200,
      data: settingsJson([followJson('R_beta', 'octo', 'beta')]),
    );
    pages = {
      'R_beta': pageJson('octo', 'beta', [
        releaseJson(21, 'v2.1', '2026-10-06T10:00:00Z'),
      ]),
    };
    await facade.retryFailed();
    expect(
      readState(harness.container).groups.single.items.single.key,
      'R_beta:21',
    );
    expect(removals.single.repositoryIds, {'R_alpha'});
    expect(harness.session.requests.skip(2), [
      'GET api/settings',
      'POST api/release-timeline/refresh',
      'GET api/settings',
      'POST api/release-timeline/refresh',
    ]);
  });

  test('a confirmed empty follow set supersedes an initial release round still in flight', () async {
    final harness = createHarness();
    final held = Completer<BackendResult>();
    harness.session.handlers['GET api/settings'] = () => BackendResult(
      statusCode: 200,
      data: settingsJson([followJson('R_alpha', 'octo', 'alpha')]),
    );
    harness.session.handlers['POST api/release-timeline/refresh'] = () =>
        held.future;
    await pumpEventQueue(times: 10);
    await harness.container
        .read(releaseTimelineSessionProvider.notifier)
        .applyFollows([]);
    held.complete(
      BackendResult(
        statusCode: 200,
        data: roundJson(
          pages: {
            'R_alpha': pageJson('octo', 'alpha', [
              releaseJson(12, 'v1.2', '2026-10-05T10:00:00Z'),
            ]),
          },
        ),
      ),
    );
    await pumpEventQueue(times: 10);
    expect(readState(harness.container).hasFollows, isFalse);
    expect(readState(harness.container).groups, isEmpty);
    expect(harness.session.requests, [
      'GET api/settings',
      'POST api/release-timeline/refresh',
    ]);
  });

  test('a signed-in user reads Followed Repository releases newest first, grouped by display date, with no new count on first use', () async {
    final harness = createHarness();
    harness.session.handlers['GET api/settings'] = () => BackendResult(
      statusCode: 200,
      data: settingsJson([
        followJson('R_alpha', 'octo', 'alpha'),
        followJson('R_beta', 'octo', 'beta'),
      ]),
    );
    harness.session.handlers['POST api/release-timeline/refresh'] = () =>
        BackendResult(
          statusCode: 200,
          data: roundJson(
            pages: {
              'R_alpha': pageJson('octo', 'alpha', [
                releaseJson(11, 'v1.1', '2026-10-02T09:00:00Z'),
                releaseJson(10, 'v1.0', '2026-10-01T23:30:00Z'),
              ]),
              'R_beta': pageJson('octo', 'beta', [
                releaseJson(21, 'v2.0', '2026-10-02T20:00:00Z'),
              ]),
            },
            refresh: {
              'previousBaseline': null,
              'startedAt': '2026-10-03T00:00:00.000Z',
            },
          ),
        );

    await pumpEventQueue(times: 50);

    expect(harness.session.requests, [
      'GET api/settings',
      'POST api/release-timeline/refresh',
    ]);
    final state = readState(harness.container);
    expect(state.active, isTrue);
    expect(state.hasFollows, isTrue);
    expect(state.loading, isFalse);
    expect(state.failure, isNull);
    expect(state.partial, isFalse);
    expect(state.groups.map((group) => group.date).toList(), [
      '2026-10-03',
      '2026-10-02',
    ]);
    expect(
      state.groups.expand((group) => group.items).map((item) => item.key),
      ['R_beta:21', 'R_alpha:11', 'R_alpha:10'],
    );
    expect(state.groups.first.items.single.repository.fullName, 'octo/beta');
    // The first load establishes the baseline without calling history new.
    expect(state.previousBaseline, isNull);
    expect(state.loadedNewCount, 0);
  });

  test('the shared window follows every repository in the round, and a later refresh counts only releases newer than the captured baseline', () async {
    final harness = createHarness();
    harness.session.handlers['GET api/settings'] = () => BackendResult(
      statusCode: 200,
      data: settingsJson([
        followJson('R_alpha', 'octo', 'alpha'),
        followJson('R_beta', 'octo', 'beta'),
      ]),
    );
    var round = roundJson(
      pages: {
        // alpha still has older history: its earliest fetched release bounds
        // the window. The server's own groups must not be trusted as that
        // window, so they deliberately claim beta's older release too.
        'R_alpha': pageJson(
          'octo',
          'alpha',
          [
            releaseJson(11, 'v1.1', '2026-10-04T10:00:00Z'),
            releaseJson(10, 'v1.0', '2026-10-03T10:00:00Z'),
          ],
          hasOlderReleases: true,
          endCursor: 'cursor-1',
        ),
        'R_beta': pageJson('octo', 'beta', [
          releaseJson(21, 'v2.0', '2026-10-02T10:00:00Z'),
        ]),
      },
      groups: [
        {
          'date': '2026-10-04',
          'items': [
            {
              'repository': {'id': 'R_beta', 'owner': 'octo', 'name': 'beta'},
              'id': 21,
            },
          ],
        },
      ],
      refresh: {
        'previousBaseline': null,
        'startedAt': '2026-10-05T00:00:00.000Z',
      },
    );
    harness.session.handlers['POST api/release-timeline/refresh'] = () =>
        BackendResult(statusCode: 200, data: round);

    await pumpEventQueue(times: 50);

    var state = readState(harness.container);
    expect(
      state.groups.expand((group) => group.items).map((item) => item.key),
      ['R_alpha:11', 'R_alpha:10'],
    );

    // A later refresh publishes a newer release and an older release that was
    // only discovered now; the second must be inserted in publication order.
    round = roundJson(
      pages: {
        'R_alpha': pageJson(
          'octo',
          'alpha',
          [
            releaseJson(12, 'v1.2', '2026-10-04T12:00:00Z'),
            releaseJson(11, 'v1.1', '2026-10-04T10:00:00Z'),
            releaseJson(13, 'v1.0.1', '2026-10-03T12:00:00Z'),
            releaseJson(10, 'v1.0', '2026-10-03T10:00:00Z'),
          ],
          hasOlderReleases: true,
          endCursor: 'cursor-2',
        ),
        'R_beta': pageJson('octo', 'beta', [
          releaseJson(22, 'v2.1', '2026-10-04T12:00:00Z'),
          releaseJson(21, 'v2.0', '2026-10-02T10:00:00Z'),
        ]),
      },
      refresh: {
        'previousBaseline': '2026-10-04T00:00:00.000Z',
        'startedAt': '2026-10-05T01:00:00.000Z',
      },
    );
    await harness.container
        .read(releaseTimelineSessionProvider.notifier)
        .refresh();

    state = readState(harness.container);
    expect(harness.session.requests, [
      'GET api/settings',
      'POST api/release-timeline/refresh',
      'GET api/settings',
      'POST api/release-timeline/refresh',
    ]);
    // Equal publication times fall back to stable repository and release ids.
    expect(
      state.groups
          .expand((group) => group.items)
          .map((item) => item.key)
          .toList(),
      ['R_alpha:12', 'R_beta:22', 'R_alpha:11', 'R_alpha:13', 'R_alpha:10'],
    );
    expect(state.groups.map((group) => group.date).toList(), [
      '2026-10-04',
      '2026-10-03',
    ]);
    expect(state.previousBaseline, '2026-10-04T00:00:00.000Z');
    expect(state.baselineExposed, isTrue);
    // Only the releases newer than the captured baseline are counted, so the
    // late-discovered older release does not inflate the count.
    expect(state.loadedNewCount, 3);
    expect(state.partial, isFalse);
    expect(state.canRetry, isFalse);
  });

  test('one failed repository keeps the successful releases, marks the window partial, and recovers on retry', () async {
    final harness = createHarness();
    harness.session.handlers['GET api/settings'] = () => BackendResult(
      statusCode: 200,
      data: settingsJson([
        followJson('R_alpha', 'octo', 'alpha'),
        followJson('R_beta', 'octo', 'beta'),
      ]),
    );
    var round = roundJson(
      pages: {
        'R_alpha': pageJson(
          'octo',
          'alpha',
          [releaseJson(11, 'v1.1', '2026-10-04T10:00:00Z')],
          hasOlderReleases: true,
          endCursor: 'cursor-1',
        ),
        'R_beta': transientPageJson(),
      },
      transientIds: ['R_beta'],
      refresh: {
        'previousBaseline': null,
        'startedAt': '2026-10-05T00:00:00.000Z',
      },
    );
    harness.session.handlers['POST api/release-timeline/refresh'] = () =>
        BackendResult(statusCode: 200, data: round);

    await pumpEventQueue(times: 50);

    var state = readState(harness.container);
    expect(
      state.groups.expand((group) => group.items).map((item) => item.key),
      ['R_alpha:11'],
    );
    expect(state.failure, isNull);
    expect(state.partial, isTrue);
    expect(state.canRetry, isTrue);
    expect(state.transientRepositories.map((repo) => repo.fullName), [
      'octo/beta',
    ]);
    expect(state.unavailableRepositories, isEmpty);

    round = roundJson(
      pages: {
        'R_alpha': pageJson(
          'octo',
          'alpha',
          [releaseJson(11, 'v1.1', '2026-10-04T10:00:00Z')],
          hasOlderReleases: true,
          endCursor: 'cursor-1',
        ),
        'R_beta': pageJson('octo', 'beta', [
          releaseJson(21, 'v2.0', '2026-10-04T11:00:00Z'),
        ]),
      },
      refresh: {
        'previousBaseline': null,
        'startedAt': '2026-10-05T01:00:00.000Z',
      },
    );
    await harness.container
        .read(releaseTimelineSessionProvider.notifier)
        .refresh();

    state = readState(harness.container);
    expect(
      state.groups.expand((group) => group.items).map((item) => item.key),
      ['R_beta:21', 'R_alpha:11'],
    );
    expect(state.partial, isFalse);
    expect(state.canRetry, isFalse);
    expect(state.transientRepositories, isEmpty);
    expect(state.failure, isNull);
  });

  test('a wholly failed round, even with HTTP 200, keeps releases readable and does not move the captured baseline', () async {
    final harness = createHarness();
    harness.session.handlers['GET api/settings'] = () => BackendResult(
      statusCode: 200,
      data: settingsJson([
        followJson('R_alpha', 'octo', 'alpha'),
        followJson('R_beta', 'octo', 'beta'),
      ]),
    );
    var round = roundJson(
      pages: {
        'R_alpha': pageJson('octo', 'alpha', [
          releaseJson(11, 'v1.1', '2026-10-04T10:00:00Z'),
        ]),
        'R_beta': pageJson('octo', 'beta', [
          releaseJson(21, 'v2.0', '2026-10-03T10:00:00Z'),
        ]),
      },
      refresh: {
        'previousBaseline': '2026-10-01T00:00:00.000Z',
        'startedAt': '2026-10-05T00:00:00.000Z',
      },
    );
    harness.session.handlers['POST api/release-timeline/refresh'] = () =>
        BackendResult(statusCode: 200, data: round);

    await pumpEventQueue(times: 50);

    var state = readState(harness.container);
    expect(state.loadedNewCount, 2);
    expect(state.previousBaseline, '2026-10-01T00:00:00.000Z');

    round = roundJson(
      pages: {'R_alpha': transientPageJson(), 'R_beta': transientPageJson()},
      transientIds: ['R_alpha', 'R_beta'],
      refresh: {
        'previousBaseline': '2026-10-04T00:00:00.000Z',
        'startedAt': '2026-10-05T01:00:00.000Z',
      },
    );
    await harness.container
        .read(releaseTimelineSessionProvider.notifier)
        .refresh();

    state = readState(harness.container);
    expect(state.loading, isFalse);
    expect(state.failure, isNotNull);
    expect(state.failure!.retryable, isTrue);
    expect(state.canRetry, isTrue);
    expect(
      state.groups.expand((group) => group.items).map((item) => item.key),
      ['R_alpha:11', 'R_beta:21'],
    );
    expect(state.transientRepositories.map((repo) => repo.fullName), [
      'octo/alpha',
      'octo/beta',
    ]);
    // The failed round's bookmark never becomes this cycle's baseline.
    expect(state.previousBaseline, '2026-10-01T00:00:00.000Z');
    expect(state.loadedNewCount, 2);
  });

  test('an account with no Followed Repositories shows the no-follow state without requesting the timeline', () async {
    final harness = createHarness();
    harness.session.handlers['GET api/settings'] = () =>
        BackendResult(statusCode: 200, data: settingsJson(const []));

    await pumpEventQueue(times: 50);

    final state = readState(harness.container);
    expect(harness.session.requests, ['GET api/settings']);
    expect(state.active, isTrue);
    expect(state.hasFollows, isFalse);
    expect(state.groups, isEmpty);
    expect(state.loading, isFalse);
    expect(state.failure, isNull);
  });

  test('a failed settings read remains retryable while usable fresh results stay readable', () async {
    final harness = createHarness();
    var failing = true;
    harness.session.handlers['GET api/settings'] = () => failing
        ? const BackendResult(
            statusCode: 503,
            problem: BackendProblem.unavailable,
          )
        : BackendResult(
            statusCode: 200,
            data: settingsJson([followJson('R_alpha', 'octo', 'alpha')]),
          );
    harness.session.handlers['POST api/release-timeline/refresh'] = () =>
        BackendResult(
          statusCode: 200,
          data: roundJson(
            pages: {
              'R_alpha': pageJson('octo', 'alpha', [
                releaseJson(11, 'v1.1', '2026-10-04T10:00:00Z'),
              ]),
            },
            refresh: {
              'previousBaseline': null,
              'startedAt': '2026-10-05T00:00:00.000Z',
            },
          ),
        );

    await pumpEventQueue(times: 50);

    var state = readState(harness.container);
    expect(harness.session.requests, [
      'GET api/settings',
      'POST api/release-timeline/refresh',
    ]);
    expect(state.failure, isNull);
    expect(state.canRetry, isTrue);
    expect(state.loading, isFalse);

    failing = false;
    await harness.container
        .read(releaseTimelineSessionProvider.notifier)
        .refresh();

    state = readState(harness.container);
    expect(harness.session.requests, [
      'GET api/settings',
      'POST api/release-timeline/refresh',
      'GET api/settings',
      'POST api/release-timeline/refresh',
    ]);
    expect(state.failure, isNull);
    expect(
      state.groups.expand((group) => group.items).map((item) => item.key),
      ['R_alpha:11'],
    );
  });

  test('changing the followed set starts a new cycle and discards the superseded response', () async {
    final harness = createHarness();
    var follows = [followJson('R_alpha', 'octo', 'alpha')];
    harness.session.handlers['GET api/settings'] = () =>
        BackendResult(statusCode: 200, data: settingsJson(follows));
    final held = Completer<BackendResult>();
    var holdRound = true;
    harness.session.handlers['POST api/release-timeline/refresh'] = () {
      if (holdRound) return held.future;
      return Future.value(
        BackendResult(
          statusCode: 200,
          data: roundJson(
            pages: {
              'R_beta': pageJson('octo', 'beta', [
                releaseJson(21, 'v2.0', '2026-10-04T11:00:00Z'),
              ]),
            },
            refresh: {
              'previousBaseline': null,
              'startedAt': '2026-10-05T00:00:00.000Z',
            },
          ),
        ),
      );
    };

    await pumpEventQueue(times: 50);
    expect(readState(harness.container).loading, isTrue);

    holdRound = false;
    follows = [followJson('R_beta', 'octo', 'beta')];
    await harness.container
        .read(releaseTimelineSessionProvider.notifier)
        .reloadFollows();

    var state = readState(harness.container);
    expect(
      state.groups.expand((group) => group.items).map((item) => item.key),
      ['R_beta:21'],
    );

    // The superseded round would show a different release of the same
    // repository if it were still allowed to commit.
    held.complete(
      BackendResult(
        statusCode: 200,
        data: roundJson(
          pages: {
            'R_beta': pageJson('octo', 'beta', [
              releaseJson(20, 'v1.9', '2026-10-04T20:00:00Z'),
            ]),
          },
          refresh: {
            'previousBaseline': null,
            'startedAt': '2026-10-05T00:00:00.000Z',
          },
        ),
      ),
    );
    await pumpEventQueue(times: 50);

    state = readState(harness.container);
    expect(
      state.groups.expand((group) => group.items).map((item) => item.key),
      ['R_beta:21'],
    );
    expect(harness.session.requests, [
      'GET api/settings',
      'POST api/release-timeline/refresh',
      'GET api/settings',
      'POST api/release-timeline/refresh',
    ]);
  });

  test(
    'signing out clears the window and a later response cannot restore it',
    () async {
      final harness = createHarness();
      harness.session.handlers['GET api/settings'] = () => BackendResult(
        statusCode: 200,
        data: settingsJson([followJson('R_alpha', 'octo', 'alpha')]),
      );
      final held = Completer<BackendResult>();
      harness.session.handlers['POST api/release-timeline/refresh'] = () =>
          held.future;

      await pumpEventQueue(times: 50);
      expect(readState(harness.container).loading, isTrue);

      harness.session.emit(const SessionState());

      var state = readState(harness.container);
      expect(state.active, isFalse);
      expect(state.groups, isEmpty);
      expect(state.loading, isFalse);

      held.complete(
        BackendResult(
          statusCode: 200,
          data: roundJson(
            pages: {
              'R_alpha': pageJson('octo', 'alpha', [
                releaseJson(11, 'v1.1', '2026-10-04T10:00:00Z'),
              ]),
            },
            refresh: {
              'previousBaseline': null,
              'startedAt': '2026-10-05T00:00:00.000Z',
            },
          ),
        ),
      );
      await pumpEventQueue(times: 50);

      state = readState(harness.container);
      expect(state.active, isFalse);
      expect(state.groups, isEmpty);
    },
  );

  test('a different account reads its own Followed Repositories', () async {
    final harness = createHarness();
    var follows = [followJson('R_alpha', 'octo', 'alpha')];
    harness.session.handlers['GET api/settings'] = () =>
        BackendResult(statusCode: 200, data: settingsJson(follows));
    harness.session.handlers['POST api/release-timeline/refresh'] = () =>
        BackendResult(
          statusCode: 200,
          data: roundJson(
            pages: {
              'R_alpha': pageJson('octo', 'alpha', [
                releaseJson(11, 'v1.1', '2026-10-04T10:00:00Z'),
              ]),
            },
            refresh: {
              'previousBaseline': null,
              'startedAt': '2026-10-05T00:00:00.000Z',
            },
          ),
        );

    await pumpEventQueue(times: 50);
    expect(readState(harness.container).groups, isNotEmpty);

    follows = [];
    harness.session.emit(
      SessionState(
        phase: SessionPhase.signedIn,
        identity: signedInIdentity(login: 'hubot', githubId: '2'),
      ),
    );
    await pumpEventQueue(times: 50);

    final state = readState(harness.container);
    expect(state.groups, isEmpty);
    expect(state.hasFollows, isFalse);
  });

  test('usable releases whose shared bookmark could not be saved stay readable and report it', () async {
    final harness = createHarness();
    harness.session.handlers['GET api/settings'] = () => BackendResult(
      statusCode: 200,
      data: settingsJson([followJson('R_alpha', 'octo', 'alpha')]),
    );
    var round = roundJson(
      pages: {
        'R_alpha': pageJson('octo', 'alpha', [
          releaseJson(11, 'v1.1', '2026-10-04T10:00:00Z'),
        ]),
      },
      refresh: {
        'previousBaseline': null,
        'startedAt': '2026-10-05T00:00:00.000Z',
      },
      persistenceError: 'Could not save the timeline refresh baseline.',
    );
    harness.session.handlers['POST api/release-timeline/refresh'] = () =>
        BackendResult(statusCode: 200, data: round);

    await pumpEventQueue(times: 50);

    var state = readState(harness.container);
    expect(state.persistenceFailed, isTrue);
    expect(state.failure, isNull);
    expect(
      state.groups.expand((group) => group.items).map((item) => item.key),
      ['R_alpha:11'],
    );

    round = roundJson(
      pages: {
        'R_alpha': pageJson('octo', 'alpha', [
          releaseJson(11, 'v1.1', '2026-10-04T10:00:00Z'),
        ]),
      },
      refresh: {
        'previousBaseline': null,
        'startedAt': '2026-10-05T01:00:00.000Z',
      },
    );
    await harness.container
        .read(releaseTimelineSessionProvider.notifier)
        .refresh();

    state = readState(harness.container);
    expect(state.persistenceFailed, isFalse);
    expect(state.failure, isNull);
  });
}
