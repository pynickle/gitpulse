import 'dart:io';
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/l10n/generated/app_localizations.dart';
import 'package:gitpulse/session/gitpulse_http.dart';
import 'package:gitpulse/session/session_controller.dart';
import 'package:gitpulse/timeline/timeline_screen.dart';
import 'package:gitpulse/timeline/timeline_session.dart';
import 'package:gitpulse/timeline/timeline_state.dart';
import 'package:path/path.dart' as p;

import 'timeline_cache_test_support.dart';
import 'timeline_test_support.dart';

import 'package:gitpulse/repositories/repository_models.dart';

void main() {
  test('clearing malformed cached content re-enables saving and offline restoration', () async {
    final disk = await DiskTimeline.create();
    final h = disk.open();
    configure(h, releases: [releaseJson(1, 'saved', '2026-10-18T00:00:00Z')]);
    await settle(h.container);
    await disk.cache!.customStatement(
      "UPDATE cache_releases SET content = 'invalid json'",
    );
    final timeline = h.container.read(releaseTimelineSessionProvider.notifier);
    await timeline.refresh();
    expect(readState(h.container).cacheCorrupted, isTrue);
    await timeline.clearCache();
    expect(readState(h.container).cacheActions.cleared, isTrue);
    expect(readState(h.container).cacheCorrupted, isFalse);
    configure(
      h,
      releases: [releaseJson(2, 'replacement', '2026-10-19T00:00:00Z')],
    );
    await timeline.refresh();
    expect(readState(h.container).cacheFailed, isFalse);
    await disk.close();
    final reopened = disk.open();
    reopened.session.handlers['GET api/settings'] = () =>
        const BackendResult(problem: BackendProblem.network);
    await settle(reopened.container);
    expect(keys(reopened.container), ['R_a:2']);
  });

  test(
    'an obsolete rebuild cannot delete the replacement account cache',
    () async {
      final disk = await DiskTimeline.create();
      final lookup = Completer<File>();
      final h = disk.open(cacheFileLookup: () => lookup.future);
      configure(
        h,
        releases: [releaseJson(1, 'old account', '2026-10-18T00:00:00Z')],
      );
      await settle(h.container);
      final rebuild = h.container
          .read(releaseTimelineSessionProvider.notifier)
          .rebuildCache();
      final identity = signedInIdentity(login: 'other', githubId: '2');
      configure(
        h,
        releases: [releaseJson(99, 'new account', '2026-10-19T00:00:00Z')],
      );
      h.session.emit(
        SessionState(phase: SessionPhase.signedIn, identity: identity),
      );
      // Allow account startup to race with the pending database-file lookup.
      await pumpEventQueue(times: 30);
      lookup.complete(File(p.join(disk.directory.path, 'timeline.sqlite')));
      await rebuild;
      await settle(h.container);
      expect(keys(h.container), ['R_a:99']);
      expect(readState(h.container).cacheFailed, isFalse);
      await disk.close();
      final reopened = disk.open(identity: identity);
      reopened.session.handlers['GET api/settings'] = () =>
          const BackendResult(problem: BackendProblem.network);
      await settle(reopened.container);
      expect(keys(reopened.container), ['R_a:99']);
    },
  );

  test('clearing a damaged cache retains its rebuild action', () async {
    final disk = await DiskTimeline.create();
    await File(p.join(disk.directory.path, 'timeline.sqlite'))
        .writeAsString('damaged SQLite');
    final h = disk.open();
    configure(h, releases: [releaseJson(4, 'fresh', '2026-10-19T00:00:00Z')]);
    await settle(h.container);
    expect(readState(h.container).cacheCorrupted, isTrue);
    await h.container
        .read(releaseTimelineSessionProvider.notifier)
        .clearCache();
    expect(readState(h.container).cacheCorrupted, isTrue);
    await h.container
        .read(releaseTimelineSessionProvider.notifier)
        .rebuildCache();
    expect(readState(h.container).cacheFailed, isFalse);
  });
  testWidgets(
    'an invalid cursor retries the same page and offers a fresh refresh',
    (tester) async {
      final disk = (await tester.runAsync(DiskTimeline.create))!;
      final h = (await tester.runAsync(() async {
        final h = disk.open();
        configure(h, releases: []);
        h.session.handlers['POST api/release-timeline/refresh'] = () =>
            BackendResult(
              statusCode: 200,
              data: roundJson(
                pages: {
                  'R_a': pageJson(
                    'octo',
                    'alpha',
                    [releaseJson(12, 'fresh', '2026-10-18T00:00:00Z')],
                    hasOlderReleases: true,
                    endCursor: 'expired-cursor',
                  ),
                },
              ),
            );
        h.session.handlers[pageRequest({'R_a': 'expired-cursor'})] = () =>
            const BackendResult(
              statusCode: 400,
              problem: BackendProblem.unavailable,
            );
        await settle(h.container);
        await h.container
            .read(releaseTimelineSessionProvider.notifier)
            .loadOlder();
        return h;
      }))!;
      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: h.container,
          child: MaterialApp(
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: const Scaffold(body: TimelineScreen()),
          ),
        ),
      );
      expect(find.text('fresh'), findsOneWidget);
      expect(readState(h.container).canRetry, isTrue);
      expect(readState(h.container).canLoadOlder, isFalse);
      final retries = find.text('Retry');
      expect(retries, findsWidgets);
      await tester.runAsync(() async {
        await tester.tap(retries.first);
        await settle(h.container);
      });
      expect(h.session.requests.last, pageRequest({'R_a': 'expired-cursor'}));
      configure(
        h,
        releases: [releaseJson(20, 'refreshed', '2026-10-19T00:00:00Z')],
      );
      await tester.pump();
      await tester.runAsync(() async {
        await tester.tap(find.byIcon(Icons.refresh));
        await settle(h.container);
      });
      await tester.pump();
      expect(find.text('refreshed'), findsOneWidget);
      expect(readState(h.container).canRetry, isFalse);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  for (final action in [
    'refresh',
    'unfollow',
    'clear',
    'logout',
    'backend',
    'account',
  ]) {
    test(
      '$action discards a delayed cache connection and never saves its old tail',
      () async {
        final disk = await DiskTimeline.create();
        final h = disk.open();
        configure(
          h,
          releases: [
            releaseJson(8, 'anchor', '2026-10-10T00:00:00Z'),
            releaseJson(7, 'old tail', '2026-10-09T00:00:00Z'),
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
                    [releaseJson(12, 'fresh', '2026-10-18T00:00:00Z')],
                    hasOlderReleases: true,
                    endCursor: 'bridge',
                  ),
                },
              ),
            );
        final timeline = h.container.read(
          releaseTimelineSessionProvider.notifier,
        );
        await timeline.refresh();
        expect(
          readState(h.container).cacheConnection,
          TimelineCacheConnection.waiting,
        );
        final requested = Completer<void>();
        final delayed = Completer<BackendResult>();
        h.session.handlers[pageRequest({'R_a': 'bridge'})] = () {
          requested.complete();
          return delayed.future;
        };
        final older = timeline.loadOlder();
        await requested.future;
        final original = h.session.state.identity!;
        var reopenIdentity = original;
        List<String> expected = [];
        switch (action) {
          case 'refresh':
            configure(
              h,
              releases: [releaseJson(20, 'new cycle', '2026-10-19T00:00:00Z')],
            );
            await timeline.refresh();
            expected = ['R_a:20'];
          case 'unfollow':
            await timeline.applyFollows(const <RepositoryReference>[]);
          case 'clear':
            await timeline.clearCache();
          case 'logout':
            h.session.emit(const SessionState());
          case 'backend':
          case 'account':
            reopenIdentity = AuthenticatedIdentity(
              backend: action == 'backend'
                  ? Uri.parse('https://other.example/base/')
                  : original.backend,
              githubId: action == 'account' ? '2' : original.githubId,
              login: 'new-account',
              name: '',
              avatarUrl: '',
            );
            configure(
              h,
              releases: [
                releaseJson(99, 'other identity', '2026-10-19T00:00:00Z'),
              ],
            );
            h.session.emit(
              SessionState(
                phase: SessionPhase.signedIn,
                identity: reopenIdentity,
              ),
            );
            await settle(h.container);
            expected = ['R_a:99'];
        }
        delayed.complete(
          BackendResult(
            statusCode: 200,
            data: roundJson(
              pages: {
                'R_a': pageJson('octo', 'alpha', [
                  releaseJson(9, 'gap', '2026-10-11T00:00:00Z'),
                  releaseJson(8, 'anchor', '2026-10-10T00:00:00Z'),
                ]),
              },
            ),
          ),
        );
        await older;
        expect(keys(h.container), expected);
        await disk.close();
        final reopened = disk.open(identity: reopenIdentity);
        reopened.session.handlers['GET api/settings'] = () =>
            const BackendResult(problem: BackendProblem.network);
        await settle(reopened.container);
        expect(keys(reopened.container), expected);
      },
    );
  }

  test('rejected sessions hide and prune expired history while transient failures preserve it', () async {
    final disk = await DiskTimeline.create();
    var now = disk.now;
    final h = disk.open(retentionDays: 1, now: () => now);
    configure(
      h,
      releases: [releaseJson(1, 'boundary', '2026-10-18T12:00:00Z')],
    );
    await settle(h.container);
    h.session.handlers['POST api/release-timeline/refresh'] = () =>
        const BackendResult(problem: BackendProblem.network);
    final timeline = h.container.read(releaseTimelineSessionProvider.notifier);
    await timeline.refresh();
    expect(keys(h.container), ['R_a:1']);
    expect(readState(h.container).offline, isTrue);
    final identity = h.session.state.identity;
    h.session.emit(
      SessionState(phase: SessionPhase.rejected, identity: identity),
    );
    expect(keys(h.container), isEmpty);
    expect(readState(h.container).offline, isFalse);
    now = now.add(const Duration(microseconds: 1));
    await timeline.pruneRetainedHistory();
    h.session.handlers['GET api/settings'] = () =>
        const BackendResult(problem: BackendProblem.network);
    h.session.emit(
      SessionState(phase: SessionPhase.signedIn, identity: identity),
    );
    await settle(h.container);
    expect(keys(h.container), isEmpty);
    await disk.close();
    final reopened = disk.open(now: () => now);
    reopened.session.handlers['GET api/settings'] = () =>
        const BackendResult(problem: BackendProblem.network);
    await settle(reopened.container);
    expect(keys(reopened.container), isEmpty);
  });

  test(
    'failed cache clearing blocks old history until a retry can remove it',
    () async {
      final disk = await DiskTimeline.create();
      final h = disk.open();
      configure(
        h,
        releases: [releaseJson(1, 'removed', '2026-10-10T00:00:00Z')],
      );
      await settle(h.container);
      await disk.cache!.customStatement(
        "CREATE TEMP TRIGGER fail_clear BEFORE DELETE ON cache_releases BEGIN SELECT RAISE(ABORT, 'disk full'); END",
      );
      final timeline = h.container.read(
        releaseTimelineSessionProvider.notifier,
      );
      await timeline.clearCache();
      expect(readState(h.container).cacheActions.clearFailed, isTrue);
      expect(keys(h.container), isEmpty);
      // Same-account reauthentication must not restore history whose clearing
      // failed, even while both server reads are unavailable.
      final identity = h.session.state.identity;
      h.session.emit(
        SessionState(phase: SessionPhase.rejected, identity: identity),
      );
      h.session.handlers['GET api/settings'] = () =>
          const BackendResult(problem: BackendProblem.network);
      h.session.handlers['POST api/release-timeline/refresh'] = () =>
          const BackendResult(problem: BackendProblem.network);
      h.session.emit(
        SessionState(phase: SessionPhase.signedIn, identity: identity),
      );
      await settle(h.container);
      expect(keys(h.container), isEmpty);
      await disk.cache!.customStatement('DROP TRIGGER fail_clear');
      await timeline.clearCache();
      expect(readState(h.container).cacheActions.cleared, isTrue);
      await disk.close();
      final reopened = disk.open();
      reopened.session.handlers['GET api/settings'] = () =>
          const BackendResult(problem: BackendProblem.network);
      await settle(reopened.container);
      expect(keys(reopened.container), isEmpty);
    },
  );

  testWidgets(
    'a damaged database can be rebuilt without signing out or changing account settings',
    (tester) async {
      final disk = (await tester.runAsync(DiskTimeline.create))!;
      final h = (await tester.runAsync(() async {
        await File(p.join(disk.directory.path, 'timeline.sqlite'))
            .writeAsString('damaged SQLite file');
        final h = disk.open(retentionDays: 7);
        configure(
          h,
          releases: [releaseJson(4, 'fresh', '2026-10-19T00:00:00Z')],
        );
        await settle(h.container);
        h.session.handlers['POST api/release-timeline/refresh'] = () =>
            const BackendResult(problem: BackendProblem.network);
        await h.container
            .read(releaseTimelineSessionProvider.notifier)
            .refresh();
        return h;
      }))!;
      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: h.container,
          child: MaterialApp(
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: const Scaffold(body: TimelineScreen()),
          ),
        ),
      );
      expect(find.text('fresh'), findsOneWidget);
      expect(
        find.text(
          'The timeline cache is damaged. Rebuild it to save releases again.',
        ),
        findsOneWidget,
      );
      final identity = h.session.state.identity;
      final requests = h.session.requests.toList();
      await tester.runAsync(() async {
        await tester.tap(find.text('Rebuild cache'));
        await settle(h.container);
      });
      await tester.pump();
      expect(find.text('Rebuild cache'), findsNothing);
      expect(find.text('fresh'), findsOneWidget);
      expect(h.session.state.phase, SessionPhase.signedIn);
      expect(h.session.state.identity, identity);
      expect(h.session.requests, requests);
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.runAsync(() async {
        await disk.close();
        final reopened = disk.open(
          retentionDays: null,
          freshDeviceChoice: true,
        );
        reopened.session.handlers['GET api/settings'] = () =>
            const BackendResult(problem: BackendProblem.network);
        await settle(reopened.container);
        expect(keys(reopened.container), ['R_a:4']);
        expect(reopened.device.value.retentionDays, 7);
      });
    },
  );

  testWidgets(
    'retry saving keeps fresh results and does not fetch or change the baseline',
    (tester) async {
      final disk = (await tester.runAsync(DiskTimeline.create))!;
      var h = (await tester.runAsync(() async {
        final h = disk.open();
        configure(
          h,
          releases: [releaseJson(1, 'saved', '2026-10-10T00:00:00Z')],
        );
        await settle(h.container);
        return h;
      }))!;
      await tester.runAsync(() async {
        await disk.cache!.customStatement(
          "CREATE TEMP TRIGGER fail_cache BEFORE INSERT ON cache_visible BEGIN SELECT RAISE(ABORT, 'disk full'); END",
        );
        configure(
          h,
          releases: [releaseJson(4, 'fresh', '2026-10-19T00:00:00Z')],
        );
        await h.container
            .read(releaseTimelineSessionProvider.notifier)
            .refresh();
        await disk.cache!.customStatement('DROP TRIGGER fail_cache');
        h.session.handlers['POST api/release-timeline/refresh'] = () =>
            const BackendResult(problem: BackendProblem.network);
        await h.container
            .read(releaseTimelineSessionProvider.notifier)
            .refresh();
      });
      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: h.container,
          child: MaterialApp(
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: const Scaffold(body: TimelineScreen()),
          ),
        ),
      );
      expect(find.text('fresh'), findsOneWidget);
      expect(find.text('Retry saving'), findsOneWidget);
      final requests = h.session.requests.toList();
      await tester.runAsync(() async {
        await tester.tap(find.text('Retry saving'));
        await settle(h.container);
      });
      await tester.pump();
      expect(find.text('Retry saving'), findsNothing);
      expect(h.session.requests, requests);
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.runAsync(() async {
        await disk.close();
        h = disk.open();
        h.session.handlers['GET api/settings'] = () =>
            const BackendResult(problem: BackendProblem.network);
        await settle(h.container);
        expect(keys(h.container), ['R_a:4']);
      });
    },
  );

  test(
    'a later successful page saves fresh results from a failed write too',
    () async {
      final disk = await DiskTimeline.create();
      var h = disk.open();
      configure(h, releases: [releaseJson(1, 'saved', '2026-10-10T00:00:00Z')]);
      await settle(h.container);
      await disk.cache!.customStatement(
        "CREATE TEMP TRIGGER fail_cache BEFORE INSERT ON cache_visible BEGIN SELECT RAISE(ABORT, 'disk full'); END",
      );
      h.session.handlers['POST api/release-timeline/refresh'] = () =>
          BackendResult(
            statusCode: 200,
            data: roundJson(
              pages: {
                'R_a': pageJson(
                  'octo',
                  'alpha',
                  [releaseJson(4, 'fresh', '2026-10-19T00:00:00Z')],
                  hasOlderReleases: true,
                  endCursor: 'page-2',
                ),
              },
            ),
          );
      final timeline = h.container.read(
        releaseTimelineSessionProvider.notifier,
      );
      await timeline.refresh();
      expect(keys(h.container), ['R_a:4']);
      expect(readState(h.container).cacheFailed, isTrue);
      await disk.cache!.customStatement('DROP TRIGGER fail_cache');
      h.session.handlers[pageRequest({'R_a': 'page-2'})] = () => BackendResult(
        statusCode: 200,
        data: roundJson(
          pages: {
            'R_a': pageJson('octo', 'alpha', [
              releaseJson(3, 'older', '2026-10-18T00:00:00Z'),
            ]),
          },
        ),
      );
      await timeline.loadOlder();
      expect(keys(h.container), ['R_a:4', 'R_a:3']);
      expect(readState(h.container).cacheFailed, isFalse);
      await disk.close();
      h = disk.open();
      h.session.handlers['GET api/settings'] = () =>
          const BackendResult(problem: BackendProblem.network);
      await settle(h.container);
      expect(keys(h.container), ['R_a:4', 'R_a:3']);
    },
  );
}
