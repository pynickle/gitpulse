import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/device/device_preferences_controller.dart';
import 'package:gitpulse/session/gitpulse_http.dart';
import 'package:gitpulse/timeline/timeline_cache.dart';
import 'package:gitpulse/timeline/timeline_models.dart';
import 'package:gitpulse/timeline/timeline_session.dart';

import 'timeline_cache_test_support.dart';
import 'timeline_test_support.dart';

const alpha = TimelineRepository(id: 'R_a', owner: 'octo', name: 'alpha');
const beta = TimelineRepository(id: 'R_b', owner: 'octo', name: 'beta');

void goOffline(Harness h) {
  h.session.handlers['GET api/settings'] = () =>
      const BackendResult(problem: BackendProblem.network);
  h.session.handlers['POST api/release-timeline/refresh'] = () =>
      const BackendResult(problem: BackendProblem.network);
}

void configureTwo(Harness h) {
  h.session.handlers['GET api/settings'] = () => BackendResult(
    statusCode: 200,
    data: {
      ...settingsJson([
        followJson('R_a', 'octo', 'alpha'),
        followJson('R_b', 'octo', 'beta'),
      ]),
    },
  );
  h.session.handlers['POST api/release-timeline/refresh'] = () => BackendResult(
    statusCode: 200,
    data: roundJson(
      pages: {
        'R_a': pageJson('octo', 'alpha', [
          releaseJson(8, 'alpha', '2026-10-10T00:00:00Z'),
        ]),
        'R_b': pageJson('octo', 'beta', [
          releaseJson(7, 'beta', '2026-10-09T00:00:00Z'),
        ]),
      },
    ),
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('removing a waiting repository reconnects surviving cached history without a request', () async {
    final disk = await DiskTimeline.create();
    var h = disk.open();
    configureTwo(h);
    await settle(h.container);
    h.session.handlers['POST api/release-timeline/refresh'] = () =>
        BackendResult(
          statusCode: 200,
          data: roundJson(
            pages: {
              'R_a': pageJson(
                'octo',
                'alpha',
                [releaseJson(8, 'anchor', '2026-10-10T00:00:00Z')],
                hasOlderReleases: true,
                endCursor: 'a-next',
              ),
              'R_b': pageJson(
                'octo',
                'beta',
                [releaseJson(12, 'fresh', '2026-10-18T00:00:00Z')],
                hasOlderReleases: true,
                endCursor: 'b-next',
              ),
            },
          ),
        );
    final timeline = h.container.read(releaseTimelineSessionProvider.notifier);
    await timeline.refresh();
    expect(keys(h.container), ['R_b:12']);
    expect(readState(h.container).waitingRepositories.map((repo) => repo.id), [
      'R_b',
    ]);
    final requests = h.session.requests.toList();
    await timeline.applyFollows([alpha]);
    expect(keys(h.container), ['R_a:8']);
    expect(readState(h.container).waitingRepositories, isEmpty);
    expect(h.session.requests, requests);
    await disk.close();
    h = disk.open();
    goOffline(h);
    await settle(h.container);
    expect(keys(h.container), ['R_a:8']);
  });

  test('a failed addition cleanup cannot restore the previous window after reopening', () async {
    final disk = await DiskTimeline.create();
    var h = disk.open();
    configure(h, releases: [releaseJson(8, 'saved', '2026-10-10T00:00:00Z')]);
    await settle(h.container);
    await disk.cache!.customStatement(
      "CREATE TRIGGER fail_addition BEFORE DELETE ON cache_releases BEGIN SELECT RAISE(ABORT, 'storage failure'); END",
    );
    goOffline(h);
    await h.container
        .read(releaseTimelineSessionProvider.notifier)
        .applyFollows([alpha, beta]);
    expect(keys(h.container), isEmpty);
    expect(readState(h.container).cacheFailed, isTrue);
    await disk.close();
    h = disk.open();
    goOffline(h);
    await settle(h.container);
    expect(keys(h.container), isEmpty);
    expect(readState(h.container).cacheFailed, isTrue);
    await disk.cache!.customStatement('DROP TRIGGER fail_addition');
    final requests = h.session.requests.toList();
    await h.container
        .read(releaseTimelineSessionProvider.notifier)
        .retryCache();
    expect(keys(h.container), isEmpty);
    expect(readState(h.container).cacheFailed, isFalse);
    expect(h.session.requests, requests);
    expect(
      h.container
          .read(releaseTimelineSessionProvider.notifier)
          .followedRepositories
          .map((repo) => repo.id),
      ['R_a', 'R_b'],
    );
  });

  test('retrying a failed save cannot retain superseded records after authoritative exhaustion', () async {
    final disk = await DiskTimeline.create();
    final h = disk.open();
    configure(h, releases: [releaseJson(8, 'anchor', '2026-10-10T00:00:00Z')]);
    await settle(h.container);
    await disk.cache!.customStatement(
      "CREATE TEMP TRIGGER fail_save BEFORE INSERT ON cache_visible BEGIN SELECT RAISE(ABORT, 'storage failure'); END",
    );
    h.session.handlers['POST api/release-timeline/refresh'] = () =>
        BackendResult(
          statusCode: 200,
          data: roundJson(
            pages: {
              'R_a': pageJson('octo', 'alpha', [
                releaseJson(8, 'anchor', '2026-10-10T00:00:00Z'),
                releaseJson(9, 'removed before retry', '2026-10-11T00:00:00Z'),
              ], incomplete: true),
            },
          ),
        );
    final timeline = h.container.read(releaseTimelineSessionProvider.notifier);
    await timeline.refresh();
    expect(readState(h.container).cacheFailed, isTrue);
    await disk.cache!.customStatement('DROP TRIGGER fail_save');
    h.session.handlers[pageRequest({'R_a': null})] = () => BackendResult(
      statusCode: 200,
      data: roundJson(
        pages: {
          'R_a': pageJson('octo', 'alpha', [
            releaseJson(8, 'anchor', '2026-10-10T00:00:00Z'),
          ]),
        },
      ),
    );
    await timeline.retryFailed();
    expect(keys(h.container), ['R_a:8']);
    final history = await disk.cache!.readHistory(
      scope: TimelineCache.scopeOf(h.session.state.identity!)!,
      now: disk.now,
    );
    expect(history.repositories['R_a']!.releases.keys, [8]);
  });

  test('an authoritative retry replaces incomplete page membership before exhaustion', () async {
    final disk = await DiskTimeline.create();
    final h = disk.open();
    configure(h, releases: [releaseJson(8, 'anchor', '2026-10-10T00:00:00Z')]);
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
                  releaseJson(8, 'anchor', '2026-10-10T00:00:00Z'),
                  releaseJson(
                    9,
                    'removed before retry',
                    '2026-10-11T00:00:00Z',
                  ),
                ],
                hasOlderReleases: true,
                endCursor: 'next',
                incomplete: true,
              ),
            },
          ),
        );
    final timeline = h.container.read(releaseTimelineSessionProvider.notifier);
    await timeline.refresh();
    h.session.handlers[pageRequest({'R_a': null})] = () => BackendResult(
      statusCode: 200,
      data: roundJson(
        pages: {
          'R_a': pageJson('octo', 'alpha', [
            releaseJson(8, 'anchor', '2026-10-10T00:00:00Z'),
          ]),
        },
      ),
    );
    await timeline.retryFailed();
    expect(keys(h.container), ['R_a:8']);
  });

  test('changing retention while paging keeps fetched releases when upstream is exhausted', () async {
    final disk = await DiskTimeline.create();
    final h = disk.open();
    configure(
      h,
      releases: [
        releaseJson(8, 'anchor', '2026-10-10T00:00:00Z'),
        releaseJson(6, 'deleted', '2026-10-08T00:00:00Z'),
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
                [releaseJson(8, 'anchor', '2026-10-10T00:00:00Z')],
                hasOlderReleases: true,
                endCursor: 'next',
              ),
            },
          ),
        );
    final timeline = h.container.read(releaseTimelineSessionProvider.notifier);
    await timeline.refresh();
    // The reader shortens the window in Settings: a device choice, applied to
    // saved history at once and without a request.
    await h.container
        .read(devicePreferencesProvider.notifier)
        .selectRetentionDays(20);
    await waitForSavedRetention(h.container, 20);
    h.session.handlers[pageRequest({'R_a': 'next'})] = () => BackendResult(
      statusCode: 200,
      data: roundJson(
        pages: {
          'R_a': pageJson('octo', 'alpha', [
            releaseJson(7, 'older', '2026-10-09T00:00:00Z'),
          ]),
        },
      ),
    );
    await timeline.loadOlder();
    expect(keys(h.container), ['R_a:8', 'R_a:7']);
  });

  test('renaming and reordering follow identities preserves content without a refresh', () async {
    final disk = await DiskTimeline.create();
    var h = disk.open();
    configureTwo(h);
    await settle(h.container);
    const renamed = TimelineRepository(
      id: 'R_a',
      owner: 'new-owner',
      name: 'renamed',
    );
    final requests = h.session.requests.toList();
    await h.container
        .read(releaseTimelineSessionProvider.notifier)
        .applyFollows([beta, renamed]);
    expect(keys(h.container), ['R_a:8', 'R_b:7']);
    expect(
      readState(h.container).groups.first.items.first.repository.fullName,
      'new-owner/renamed',
    );
    expect(h.session.requests, requests);
    await disk.close();
    h = disk.open();
    goOffline(h);
    await settle(h.container);
    expect(keys(h.container), ['R_a:8', 'R_b:7']);
    expect(
      readState(h.container).groups.first.items.first.repository.fullName,
      'new-owner/renamed',
    );
  });

  test(
    'upgrading a version one database keeps its saved window and retention',
    () async {
      final disk = await DiskTimeline.create();
      var h = disk.open(retentionDays: 7);
      configure(h, releases: [releaseJson(8, 'saved', '2026-10-18T00:00:00Z')]);
      await settle(h.container);
      // Recreate the previous on-disk schema before opening the new client.
      await disk.cache!.customStatement(
        'ALTER TABLE cache_account DROP COLUMN pending_follows',
      );
      await disk.cache!.customStatement('PRAGMA user_version = 1');
      await disk.close();
      // This device has not chosen a window yet, so the one its saved history
      // was written under is the seed.
      h = disk.open(retentionDays: null, freshDeviceChoice: true);
      goOffline(h);
      await settle(h.container);
      expect(keys(h.container), ['R_a:8']);
      expect(h.device.value.retentionDays, 7);
      expect(readState(h.container).cacheFailed, isFalse);
    },
  );

  test('a follow addition discards an older page already in flight', () async {
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
                [releaseJson(8, 'saved', '2026-10-10T00:00:00Z')],
                hasOlderReleases: true,
                endCursor: 'next',
              ),
            },
          ),
        );
    await settle(h.container);
    final requested = Completer<void>();
    final pending = Completer<BackendResult>();
    h.session.handlers[pageRequest({'R_a': 'next'})] = () {
      requested.complete();
      return pending.future;
    };
    final timeline = h.container.read(releaseTimelineSessionProvider.notifier);
    final older = timeline.loadOlder();
    await requested.future;
    goOffline(h);
    await timeline.applyFollows([alpha, beta]);
    pending.complete(
      BackendResult(
        statusCode: 200,
        data: roundJson(
          pages: {
            'R_a': pageJson('octo', 'alpha', [
              releaseJson(7, 'stale page', '2026-10-09T00:00:00Z'),
            ]),
          },
        ),
      ),
    );
    await older;
    expect(keys(h.container), isEmpty);
    await disk.close();
    h = disk.open();
    goOffline(h);
    await settle(h.container);
    expect(keys(h.container), isEmpty);
  });

  for (final fromSettings in [false, true]) {
    test(
      'a mixed follow change invalidates all history via ${fromSettings ? 'settings refresh' : 'confirmed follows'}',
      () async {
        final disk = await DiskTimeline.create();
        var h = disk.open();
        configureTwo(h);
        await settle(h.container);
        goOffline(h);
        const gamma = TimelineRepository(
          id: 'R_c',
          owner: 'octo',
          name: 'gamma',
        );
        final timeline = h.container.read(
          releaseTimelineSessionProvider.notifier,
        );
        if (fromSettings) {
          h.session.handlers['GET api/settings'] = () => BackendResult(
            statusCode: 200,
            data: {
              ...settingsJson([
                followJson('R_a', 'octo', 'alpha'),
                followJson('R_c', 'octo', 'gamma'),
              ]),
            },
          );
          await timeline.refresh();
        } else {
          await timeline.applyFollows([alpha, gamma]);
        }
        expect(keys(h.container), isEmpty);
        await disk.close();
        h = disk.open();
        goOffline(h);
        await settle(h.container);
        expect(keys(h.container), isEmpty);
        expect(
          h.container
              .read(releaseTimelineSessionProvider.notifier)
              .followedRepositories
              .map((repo) => repo.id),
          ['R_a', 'R_c'],
        );
      },
    );
  }

  test('unfollowing keeps peer history and its baseline without requesting releases', () async {
    final disk = await DiskTimeline.create();
    var h = disk.open();
    configureTwo(h);
    await settle(h.container);
    final requests = h.session.requests.toList();
    final baseline = readState(h.container).previousBaseline;
    await h.container
        .read(releaseTimelineSessionProvider.notifier)
        .applyFollows([beta]);
    expect(keys(h.container), ['R_b:7']);
    expect(h.session.requests, requests);
    expect(readState(h.container).previousBaseline, baseline);
    await disk.close();
    h = disk.open();
    goOffline(h);
    await settle(h.container);
    expect(keys(h.container), ['R_b:7']);
  });

  test('a failed unfollow cleanup blocks offline restoration until the durable change completes', () async {
    final disk = await DiskTimeline.create();
    var h = disk.open();
    configureTwo(h);
    await settle(h.container);
    await disk.cache!.customStatement(
      "CREATE TRIGGER fail_unfollow BEFORE DELETE ON cache_releases WHEN OLD.repository_id = 'R_a' BEGIN SELECT RAISE(ABORT, 'storage failure'); END",
    );
    goOffline(h);
    await h.container
        .read(releaseTimelineSessionProvider.notifier)
        .applyFollows([beta]);
    expect(keys(h.container), ['R_b:7']);
    expect(readState(h.container).cacheFailed, isTrue);
    await disk.close();
    h = disk.open();
    goOffline(h);
    await settle(h.container);
    expect(keys(h.container), isEmpty);
    expect(readState(h.container).cacheFailed, isTrue);
    await disk.cache!.customStatement('DROP TRIGGER fail_unfollow');
    final requests = h.session.requests.toList();
    await h.container
        .read(releaseTimelineSessionProvider.notifier)
        .retryCache();
    expect(keys(h.container), ['R_b:7']);
    expect(readState(h.container).cacheFailed, isFalse);
    expect(h.session.requests, requests);
    await disk.close();
    h = disk.open();
    goOffline(h);
    await settle(h.container);
    expect(keys(h.container), ['R_b:7']);
  });

  test('successful exhaustion removes deleted releases even when a cache anchor survives', () async {
    final disk = await DiskTimeline.create();
    var h = disk.open();
    configure(
      h,
      releases: [
        releaseJson(8, 'survivor', '2026-10-10T00:00:00Z'),
        releaseJson(7, 'deleted', '2026-10-09T00:00:00Z'),
      ],
    );
    await settle(h.container);
    configure(
      h,
      releases: [releaseJson(8, 'survivor', '2026-10-10T00:00:00Z')],
    );
    await h.container.read(releaseTimelineSessionProvider.notifier).refresh();
    expect(keys(h.container), ['R_a:8']);
    expect(readState(h.container).canLoadOlder, isFalse);
    await disk.close();
    h = disk.open();
    goOffline(h);
    await settle(h.container);
    expect(keys(h.container), ['R_a:8']);
  });

  test('adding a follow invalidates the entire saved window even when refresh fails', () async {
    final disk = await DiskTimeline.create();
    var h = disk.open();
    configure(h, releases: [releaseJson(8, 'saved', '2026-10-10T00:00:00Z')]);
    await settle(h.container);
    goOffline(h);
    await h.container
        .read(releaseTimelineSessionProvider.notifier)
        .applyFollows([alpha, beta]);
    expect(keys(h.container), isEmpty);
    expect(readState(h.container).previousBaseline, isNull);
    await disk.close();
    h = disk.open();
    goOffline(h);
    await settle(h.container);
    expect(keys(h.container), isEmpty);
    expect(
      h.container
          .read(releaseTimelineSessionProvider.notifier)
          .followedRepositories
          .map((repo) => repo.id),
      ['R_a', 'R_b'],
    );
  });
}
