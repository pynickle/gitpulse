import 'dart:async';
import 'dart:io';

import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import 'package:gitpulse/follows/followed_repositories_panel.dart';
import 'package:gitpulse/follows/release_follows_session.dart';
import 'package:gitpulse/follows/followed_repository_view.dart';
import 'package:gitpulse/presentation/gitpulse_state_views.dart';
import 'package:gitpulse/device/device_preferences_controller.dart';
import 'package:gitpulse/timeline/timeline_session.dart';
import 'package:gitpulse/timeline/timeline_models.dart';
import 'package:gitpulse/timeline/timeline_cache.dart';
import 'package:gitpulse/session/session_controller.dart';

import '../session_flow_test.dart' as auth;
import '../timeline/timeline_test_support.dart';
import 'follows_test_support.dart';
import '../support/settling.dart';
import '../support/follows_session_harness.dart';
import '../support/provider_wait.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  for (final edit in ['follow', 'unfollow']) {
    test(
      'a held $edit response preserves names accepted while saving',
      () async {
        final server = FollowsServer();
        server.settings['followedRepositories'] = [
          followJson('R_alpha', 'octo', 'alpha'),
          if (edit == 'unfollow') followJson('R_beta', 'octo', 'beta'),
        ];
        final container = await openFollowsSession(server);
        final follows = container.read(releaseFollowsSessionProvider.notifier);
        final saveHold = Completer<void>();
        server.holdSave = saveHold.future;
        final saveStarted = server.nextRequest('PUT', '/api/settings');
        final saving = edit == 'follow'
            ? follows.follow(
                const TimelineRepository(
                  id: 'R_beta',
                  owner: 'octo',
                  name: 'beta',
                ),
              )
            : follows.unfollow('R_beta');
        await saveStarted;
        expect(
          server.featureRequests.any((request) => request.method == 'PUT'),
          isTrue,
        );
        server.metadata['R_alpha'] = {
          'status': 'available',
          'owner': 'new-owner',
          'name': 'renamed',
        };
        await follows.loadMetadata();
        expect(
          container
              .read(releaseFollowsSessionProvider)
              .repositories
              .firstWhere((repo) => repo.id == 'R_alpha')
              .fullName,
          'new-owner/renamed',
        );
        final metadataHold = Completer<void>();
        server.holdMetadata = metadataHold.future;
        saveHold.complete();
        await saving;
        expect(
          container
              .read(releaseFollowsSessionProvider)
              .repositories
              .firstWhere((repo) => repo.id == 'R_alpha')
              .fullName,
          'new-owner/renamed',
        );
        expect(
          container
              .read(releaseTimelineSessionProvider.notifier)
              .followedRepositories
              .firstWhere((repo) => repo.id == 'R_alpha')
              .fullName,
          'new-owner/renamed',
        );
        metadataHold.complete();
        await waitForProvider(
          container,
          releaseTimelineSessionProvider,
          (state) => !state.loading,
        );
      },
    );
  }

  testWidgets(
    'startup cache work keeps the name already accepted by metadata',
    (tester) async {
      final cache = TimelineCache(NativeDatabase.memory());
      final cacheHold = Completer<void>();
      final metadataHold = Completer<void>();
      addTearDown(() async {
        if (!cacheHold.isCompleted) cacheHold.complete();
        if (!metadataHold.isCompleted) metadataHold.complete();
        final closing = cache.close();
        await settleUi(tester);
        await closing;
      });
      final server = FollowsServer()..includeGithubId = true;
      server.holdMetadata = metadataHold.future;
      server.settings['followedRepositories'] = [
        followJson('R_alpha', 'octo', 'alpha'),
      ];
      server.metadata['R_alpha'] = {
        'status': 'available',
        'owner': 'new-owner',
        'name': 'renamed',
      };
      server.pages = {
        'R_alpha': pageJson('new-owner', 'renamed', [
          releaseJson(1, 'release', '2026-10-20T00:00:00Z'),
        ]),
      };
      final container = await auth.mountApp(
        tester,
        server,
        timelineCache: cache,
        timelineNow: () => DateTime.utc(2026, 10, 24),
      );
      await auth.connectTo(tester, 'https://gitpulse.example');
      await tester.runAsync(
        () => container
            .read(devicePreferencesProvider.notifier)
            .selectFollowedRepositoryView(FollowedRepositoryView.detailed),
      );
      final cacheEntered = Completer<void>();
      Future<void>? transaction;
      final subscription = container.listen(releaseTimelineSessionProvider, (
        _,
        next,
      ) {
        if (!next.hasFollows || transaction != null) return;
        transaction = cache.transaction(() async {
          await cache.customSelect('SELECT 1').get();
          cacheEntered.complete();
          await cacheHold.future;
        });
      });
      await auth.pumped(
        tester,
        container
            .read(sessionControllerProvider.notifier)
            .unlock('correct-horse'),
      );
      await settleUi(tester);
      expect(cacheEntered.isCompleted, isTrue);
      metadataHold.complete();
      await settleUi(tester);
      expect(
        container
            .read(releaseFollowsSessionProvider)
            .repositories
            .single
            .fullName,
        'new-owner/renamed',
      );
      cacheHold.complete();
      await settleUi(tester);
      await transaction;
      await settleUi(tester);
      expect(
        container
            .read(releaseTimelineSessionProvider.notifier)
            .followedRepositories
            .single
            .fullName,
        'new-owner/renamed',
      );
      expect(container.read(releaseTimelineSessionProvider).loading, isFalse);
      subscription.close();
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  testWidgets(
    'a delayed rename save cannot revive loading after a release failure',
    (tester) async {
      final directory = Directory.systemTemp.createTempSync(
        'gitpulse-rename-loading-',
      );
      final file = File.fromUri(directory.uri.resolve('timeline.sqlite'));
      final cache = TimelineCache(NativeDatabase(file));
      addTearDown(() async {
        final closing = cache.close();
        await settleUi(tester);
        await closing;
        directory.deleteSync(recursive: true);
      });
      final server = FollowsServer()..includeGithubId = true;
      server.settings['followedRepositories'] = [
        followJson('R_alpha', 'octo', 'alpha'),
      ];
      server.pages = {
        'R_alpha': pageJson('octo', 'alpha', [
          releaseJson(1, 'saved', '2026-10-20T00:00:00Z'),
        ]),
      };
      final container = await auth.mountApp(
        tester,
        server,
        timelineCache: cache,
        timelineNow: () => DateTime.utc(2026, 10, 24),
      );
      await auth.connectTo(tester, 'https://gitpulse.example');
      await auth.pumped(
        tester,
        container
            .read(sessionControllerProvider.notifier)
            .unlock('correct-horse'),
      );
      await settleUi(tester);
      final roundHold = Completer<void>();
      server.holdRound = roundHold.future;
      server.roundStatus = 500;
      final timeline = container.read(releaseTimelineSessionProvider.notifier);
      final refresh = timeline.refresh();
      await settleUi(tester);
      final cacheHold = Completer<void>();
      final cacheEntered = Completer<void>();
      final transaction = cache.transaction(() async {
        await cache.customSelect('SELECT 1').get();
        cacheEntered.complete();
        await cacheHold.future;
      });
      await settleUi(tester);
      expect(cacheEntered.isCompleted, isTrue);
      server.metadata['R_alpha'] = {
        'status': 'available',
        'owner': 'renamed',
        'name': 'alpha',
      };
      await auth.pumped(
        tester,
        container.read(releaseFollowsSessionProvider.notifier).loadMetadata(),
      );
      await settleUi(tester);
      expect(timeline.followedRepositories.single.owner, 'renamed');
      roundHold.complete();
      await auth.pumped(tester, refresh);
      expect(container.read(releaseTimelineSessionProvider).loading, isFalse);
      cacheHold.complete();
      await settleUi(tester);
      await transaction;
      await settleUi(tester);
      expect(container.read(releaseTimelineSessionProvider).loading, isFalse);
      expect(
        container
            .read(releaseTimelineSessionProvider)
            .groups
            .single
            .items
            .single
            .key,
        'R_alpha:1',
      );
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  test(
    'a successful edit rejects older metadata names for surviving members',
    () async {
      final server = FollowsServer();
      server.settings['followedRepositories'] = [
        followJson('R_alpha', 'octo', 'alpha'),
      ];
      final container = await openFollowsSession(server);
      final follows = container.read(releaseFollowsSessionProvider.notifier);
      final hold = Completer<void>();
      server.metadata['R_alpha'] = {
        'status': 'available',
        'owner': 'old-owner',
        'name': 'obsolete',
      };
      server.holdMetadata = hold.future;
      final metadataStarted = server.nextRequest(
        'POST',
        '/api/release-follows/metadata',
      );
      final metadata = follows.loadMetadata();
      await metadataStarted;
      server.holdMetadata = null;
      server.metadata['R_alpha'] = {
        'status': 'available',
        'owner': 'octo',
        'name': 'alpha',
      };
      await follows.follow(
        const TimelineRepository(id: 'R_beta', owner: 'octo', name: 'beta'),
      );
      hold.complete();
      await metadata;
      expect(
        container
            .read(releaseFollowsSessionProvider)
            .repositories
            .map((r) => r.fullName),
        ['octo/beta', 'octo/alpha'],
      );
    },
  );

  testWidgets(
    'offline restart keeps the saved Timeline separate from unknown follows',
    (tester) async {
      final directory = Directory.systemTemp.createTempSync(
        'gitpulse-confirmation-',
      );
      final file = File.fromUri(directory.uri.resolve('timeline.sqlite'));
      var cache = TimelineCache(NativeDatabase(file));
      addTearDown(() async {
        final closing = cache.close();
        await settleUi(tester);
        await closing;
        directory.deleteSync(recursive: true);
      });
      final server = FollowsServer()..includeGithubId = true;
      server.settings['followedRepositories'] = [
        followJson('R_alpha', 'octo', 'alpha'),
        followJson('R_beta', 'octo', 'beta'),
      ];
      server.pages = {
        'R_alpha': pageJson('octo', 'alpha', [
          releaseJson(1, 'removed-release', '2026-10-20T00:00:00Z'),
        ]),
        'R_beta': pageJson('octo', 'beta', [
          releaseJson(2, 'saved-release', '2026-10-19T00:00:00Z'),
        ]),
      };
      var container = await auth.mountApp(
        tester,
        server,
        timelineCache: cache,
        timelineNow: () => DateTime.utc(2026, 10, 24),
      );
      await auth.connectTo(tester, 'https://gitpulse.example');
      await auth.pumped(
        tester,
        container
            .read(sessionControllerProvider.notifier)
            .unlock('correct-horse'),
      );
      await settleUi(tester);
      expect(
        container
            .read(releaseTimelineSessionProvider)
            .groups
            .expand((g) => g.items)
            .map((r) => r.key),
        ['R_alpha:1', 'R_beta:2'],
      );
      final follows = container.read(releaseFollowsSessionProvider.notifier);
      final rounds = server.featureRequests
          .where((r) => r.uri.path.contains('release-timeline'))
          .length;
      final hold = Completer<void>();
      server.holdMetadata = hold.future;
      server.metadata['R_alpha'] = {
        'status': 'available',
        'owner': 'old-owner',
        'name': 'obsolete',
      };
      final metadataStarted = server.nextRequest(
        'POST',
        '/api/release-follows/metadata',
      );
      final metadata = follows.loadMetadata();
      await auth.pumped(tester, metadataStarted);
      await auth.pumped(tester, follows.unfollow('R_alpha'));
      await settleUi(tester);
      hold.complete();
      await auth.pumped(tester, metadata);
      await settleUi(tester);
      expect(
        container.read(releaseFollowsSessionProvider).repositories.single.id,
        'R_beta',
      );
      expect(
        container
            .read(releaseTimelineSessionProvider.notifier)
            .followedRepositories
            .single
            .id,
        'R_beta',
      );
      expect(
        container
            .read(releaseTimelineSessionProvider)
            .groups
            .expand((g) => g.items)
            .map((r) => r.key),
        ['R_beta:2'],
      );
      expect(
        server.featureRequests
            .where((r) => r.uri.path.contains('release-timeline'))
            .length,
        rounds,
      );
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.runAsync(cache.close);
      cache = TimelineCache(NativeDatabase(file));
      server.offline = true;
      container = await auth.mountApp(
        tester,
        server,
        resetStorage: false,
        timelineCache: cache,
        timelineNow: () => DateTime.utc(2026, 10, 24),
      );
      await settleUi(tester);
      expect(find.text('saved-release'), findsOneWidget);
      expect(container.read(releaseFollowsSessionProvider).loaded, isFalse);
      expect(
        container.read(releaseFollowsSessionProvider).repositories,
        isEmpty,
      );
      await tester.tap(find.text('Follows'));
      await settleUi(tester);
      await tester.tap(find.byKey(const ValueKey('manage-follows')));
      await settleUi(tester);
      expect(find.text('Retry'), findsWidgets);
      expect(
        find.descendant(
          of: find.byType(FollowedRepositoriesPanel),
          matching: find.byType(GitPulseMessageView),
        ),
        findsOneWidget,
      );
      expect(
        find.descendant(
          of: find.byType(FollowedRepositoriesPanel),
          matching: find.byType(TextButton),
        ),
        findsNothing,
      );
      expect(find.text('No followed repositories'), findsNothing);
      expect(find.byKey(const ValueKey('followed-R_alpha')), findsNothing);
      expect(find.text('removed-release'), findsNothing);
      server.offline = false;
      server.settings['followedRepositories'] = [];
      await tester.tap(find.text('Retry').last);
      await settleUi(tester);
      expect(container.read(releaseFollowsSessionProvider).loaded, isTrue);
      expect(
        container.read(releaseFollowsSessionProvider).repositories,
        isEmpty,
      );
      expect(find.text('No followed repositories'), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  test(
    'failed refresh and detail retry retain the same confirmed membership',
    () async {
      final server = FollowsServer();
      server.settings['followedRepositories'] = [
        followJson('R_alpha', 'octo', 'alpha'),
      ];
      final container = await openFollowsSession(server);
      final follows = container.read(releaseFollowsSessionProvider.notifier);
      server.settingsStatus = 500;
      await follows.reload();
      expect(container.read(releaseFollowsSessionProvider).loaded, isTrue);
      expect(
        container.read(releaseFollowsSessionProvider).repositories.single.id,
        'R_alpha',
      );
      expect(container.read(releaseFollowsSessionProvider).problem, isNotNull);
      server.settingsStatus = 200;
      server.metadataStatus = 500;
      await follows.loadMetadata();
      expect(
        container.read(releaseFollowsSessionProvider).metadataProblem,
        isNotNull,
      );
      expect(
        container.read(releaseFollowsSessionProvider).repositories.single.id,
        'R_alpha',
      );
      server.metadataStatus = 200;
      server.metadata['R_alpha'] = {'status': 'unavailable'};
      await follows.loadMetadata(repositoryId: 'R_alpha');
      expect(
        container.read(releaseFollowsSessionProvider).repositories.single.id,
        'R_alpha',
      );
      server.metadata['R_alpha'] = {
        'status': 'available',
        'owner': 'octo',
        'name': 'alpha',
        'description': 'Recovered details',
      };
      await follows.loadMetadata(repositoryId: 'R_alpha');
      expect(
        container
            .read(releaseFollowsSessionProvider)
            .details['R_alpha']
            ?.description,
        'Recovered details',
      );
      expect(
        container.read(releaseFollowsSessionProvider).metadataProblem,
        isNull,
      );
    },
  );

  for (final transition in ['sign-out', 'account', 'backend']) {
    test(
      '$transition rejects delayed collection, metadata and save responses',
      () async {
        final server = FollowsServer();
        server.settings['followedRepositories'] = [
          followJson('R_alpha', 'octo', 'alpha'),
        ];
        final container = await openFollowsSession(server);
        final follows = container.read(releaseFollowsSessionProvider.notifier);
        final settingsHold = Completer<void>();
        final metadataHold = Completer<void>();
        final saveHold = Completer<void>();
        server.holdSettings = settingsHold.future;
        server.holdMetadata = metadataHold.future;
        server.metadata['R_alpha'] = {
          'status': 'available',
          'owner': 'old-account',
          'name': 'obsolete',
        };
        final settingsStarted = server.nextRequest('GET', '/api/settings');
        final settings = follows.reload();
        final metadataStarted = server.nextRequest(
          'POST',
          '/api/release-follows/metadata',
        );
        final metadata = follows.loadMetadata();
        await Future.wait([settingsStarted, metadataStarted]);
        server.holdSettings = null;
        server.holdSave = saveHold.future;
        final saveStarted = server.nextRequest('PUT', '/api/settings');
        final save = follows.unfollow('R_alpha');
        await saveStarted;
        final session = container.read(sessionControllerProvider.notifier);
        if (transition == 'backend') {
          await session.leaveBackend(address: 'https://other.example');
        } else {
          await session.signOut();
        }
        await waitForSession(container, (state) => !state.busy);
        expect(
          container.read(releaseFollowsSessionProvider).repositories,
          isEmpty,
        );
        if (transition != 'sign-out') {
          server.settings['followedRepositories'] = [
            followJson('R_second', 'second', 'project'),
          ];
          server.holdMetadata = null;
          await (transition == 'account'
              ? session.signInWithToken('ghp_hubot')
              : session.unlock('correct-horse'));
          await waitForProvider(
            container,
            releaseTimelineSessionProvider,
            (state) => !state.loading,
          );
          expect(
            container.read(sessionControllerProvider).identity?.login,
            'hubot',
          );
          expect(
            container
                .read(releaseFollowsSessionProvider)
                .repositories
                .single
                .id,
            'R_second',
          );
        }
        settingsHold.complete();
        metadataHold.complete();
        saveHold.complete();
        await Future.wait([settings, metadata, save]);
        await waitForProvider(
          container,
          releaseTimelineSessionProvider,
          (state) => !state.loading,
        );
        expect(
          container
              .read(releaseFollowsSessionProvider)
              .repositories
              .map((r) => r.id),
          transition == 'sign-out' ? <String>[] : ['R_second'],
        );
        expect(
          container
              .read(releaseTimelineSessionProvider.notifier)
              .followedRepositories
              .map((r) => r.id),
          transition == 'sign-out' ? <String>[] : ['R_second'],
        );
      },
    );
  }

  test(
    'old metadata cannot cross a removal and refollow of the same identity',
    () async {
      final server = FollowsServer();
      server.settings['followedRepositories'] = [
        followJson('R_alpha', 'octo', 'alpha'),
      ];
      final container = await openFollowsSession(server);
      final follows = container.read(releaseFollowsSessionProvider.notifier);
      server.metadata['R_alpha'] = {
        'status': 'available',
        'owner': 'old-owner',
        'name': 'obsolete',
      };
      final hold = Completer<void>();
      server.holdMetadata = hold.future;
      final metadataStarted = server.nextRequest(
        'POST',
        '/api/release-follows/metadata',
      );
      final metadata = follows.loadMetadata();
      await metadataStarted;
      await follows.unfollow('R_alpha');
      server.holdMetadata = null;
      server.metadata['R_alpha'] = {
        'status': 'available',
        'owner': 'new-owner',
        'name': 'current',
      };
      await follows.follow(
        const TimelineRepository(
          id: 'R_alpha',
          owner: 'new-owner',
          name: 'current',
        ),
      );
      hold.complete();
      await metadata;
      expect(
        container
            .read(releaseFollowsSessionProvider)
            .repositories
            .single
            .fullName,
        'new-owner/current',
      );
      expect(
        container
            .read(releaseTimelineSessionProvider.notifier)
            .followedRepositories
            .single
            .fullName,
        'new-owner/current',
      );
    },
  );

  test(
    'a metadata rename does not cancel an in-flight release round',
    () async {
      final server = FollowsServer();
      server.settings['followedRepositories'] = [
        followJson('R_alpha', 'octo', 'alpha'),
      ];
      final container = await openFollowsSession(server);
      final hold = Completer<void>();
      server.holdRound = hold.future;
      server.pages = {
        'R_alpha': pageJson('octo', 'alpha', [
          releaseJson(2, 'fresh', '2026-10-21T00:00:00Z'),
        ]),
      };

      final roundStarted = server.nextRequest(
        'POST',
        '/api/release-timeline/refresh',
      );
      final refresh = container
          .read(releaseTimelineSessionProvider.notifier)
          .refresh();
      await roundStarted;
      server.metadata['R_alpha'] = {
        'status': 'available',
        'owner': 'new-owner',
        'name': 'renamed',
      };
      await container
          .read(releaseFollowsSessionProvider.notifier)
          .loadMetadata();
      final requests = server.featureRequests
          .where((r) => r.uri.path.contains('release-timeline'))
          .length;
      hold.complete();
      await refresh;
      expect(
        container
            .read(releaseTimelineSessionProvider)
            .groups
            .expand((g) => g.items)
            .map((r) => r.key),
        ['R_alpha:2'],
      );
      expect(
        server.featureRequests
            .where((r) => r.uri.path.contains('release-timeline'))
            .length,
        requests,
      );
    },
  );

  test(
    'an older settings response cannot roll back a newly accepted name',
    () async {
      final server = FollowsServer();
      server.settings['followedRepositories'] = [
        followJson('R_alpha', 'octo', 'alpha'),
      ];
      final container = await openFollowsSession(server);
      final follows = container.read(releaseFollowsSessionProvider.notifier);
      final hold = Completer<void>();
      server.holdSettings = hold.future;
      final settingsStarted = server.nextRequest('GET', '/api/settings');
      final refresh = follows.reload();
      await settingsStarted;
      server.metadata['R_alpha'] = {
        'status': 'available',
        'owner': 'new-owner',
        'name': 'renamed',
      };
      await follows.loadMetadata();
      expect(
        container
            .read(releaseFollowsSessionProvider)
            .repositories
            .single
            .fullName,
        'new-owner/renamed',
      );
      // Prevent the refresh's later detail request from masking a stale-name rollback.
      server.holdMetadata = Completer<void>().future;
      hold.complete();
      await refresh;
      expect(
        container
            .read(releaseFollowsSessionProvider)
            .repositories
            .single
            .fullName,
        'new-owner/renamed',
      );
    },
  );

  for (final initiallyFollowed in [false, true]) {
    test(
      'an old ${initiallyFollowed ? 'nonempty' : 'empty'} settings read cannot undo a saved edit',
      () async {
        final server = FollowsServer();
        server.settings['followedRepositories'] = [
          if (initiallyFollowed) followJson('R_alpha', 'octo', 'alpha'),
        ];
        final container = await openFollowsSession(server);
        final follows = container.read(releaseFollowsSessionProvider.notifier);
        await follows.reload();
        final hold = Completer<void>();
        server.holdSettings = hold.future;
        final settingsStarted = server.nextRequest('GET', '/api/settings');
        final refresh = container
            .read(releaseTimelineSessionProvider.notifier)
            .refresh();
        await settingsStarted;
        server.holdSettings = null;
        await (initiallyFollowed
            ? follows.unfollow('R_alpha')
            : follows.follow(
                const TimelineRepository(
                  id: 'R_alpha',
                  owner: 'octo',
                  name: 'alpha',
                ),
              ));
        final expected = initiallyFollowed ? <String>[] : ['R_alpha'];
        expect(
          container
              .read(releaseFollowsSessionProvider)
              .repositories
              .map((r) => r.id),
          expected,
        );
        hold.complete();
        await refresh;
        expect(
          container
              .read(releaseFollowsSessionProvider)
              .repositories
              .map((r) => r.id),
          expected,
        );
        expect(
          container
              .read(releaseTimelineSessionProvider.notifier)
              .followedRepositories
              .map((r) => r.id),
          expected,
        );
        server.settings['followedRepositories'] = [
          followJson('R_remote', 'octo', 'remote'),
        ];
        await follows.reload();
        expect(
          container.read(releaseFollowsSessionProvider).repositories.single.id,
          'R_remote',
        );
      },
    );
  }

  testWidgets(
    'initialization and overlapping refreshes share reads while page switches reuse confirmation',
    (tester) async {
      final server = FollowsServer();
      final container = await auth.mountApp(tester, server);
      await auth.connectTo(tester, 'https://gitpulse.example');
      await auth.submitField(
        tester,
        label: 'Password',
        value: 'correct-horse',
        action: 'Unlock',
      );
      int reads() => server.featureRequests
          .where(
            (r) => r.method == 'GET' && r.uri.path.endsWith('/api/settings'),
          )
          .length;
      expect(reads(), 1);
      for (final page in ['Follows', 'Timeline', 'Follows']) {
        await tester.tap(find.text(page).last);
        await tester.pumpAndSettle();
      }
      expect(reads(), 1);
      final hold = Completer<void>();
      server.holdSettings = hold.future;
      final settingsStarted = server.nextRequest('GET', '/api/settings');
      final follows = container
          .read(releaseFollowsSessionProvider.notifier)
          .reload();
      final timeline = container
          .read(releaseTimelineSessionProvider.notifier)
          .refresh();
      await auth.pumped(tester, settingsStarted);
      expect(reads(), 2);
      hold.complete();
      await auth.pumped(tester, Future.wait([follows, timeline]));
      expect(reads(), 2);
    },
  );

  testWidgets(
    'confirmed follows render and remain editable while details are held',
    (tester) async {
      tester.view.physicalSize = const Size(1500, 900);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final server = FollowsServer();
      server.settings['followedRepositories'] = [
        followJson('R_alpha', 'octo', 'alpha'),
      ];
      final hold = Completer<void>();
      server.holdMetadata = hold.future;
      final container = await auth.mountApp(tester, server);
      await auth.connectTo(tester, 'https://gitpulse.example');
      await auth.submitField(
        tester,
        label: 'Password',
        value: 'correct-horse',
        action: 'Unlock',
      );
      await tester.tap(find.text('Follows'));
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('followed-R_alpha')), findsOneWidget);
      expect(container.read(releaseFollowsSessionProvider).loaded, isTrue);
      expect(container.read(releaseFollowsSessionProvider).loading, isFalse);
      await tester.tap(find.byTooltip('Unfollow'));
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('followed-R_alpha')), findsNothing);
      hold.complete();
      await tester.pumpAndSettle();
      expect(
        container.read(releaseFollowsSessionProvider).repositories,
        isEmpty,
      );
    },
  );

  test(
    'Timeline confirms remote follows even when release loading fails',
    () async {
      final server = FollowsServer();
      final container = await openFollowsSession(server);
      final follows = container.read(releaseFollowsSessionProvider.notifier);
      await follows.reload();
      server.settings['followedRepositories'] = [
        followJson('R_beta', 'octo', 'beta'),
      ];
      server.roundStatus = 500;
      await container.read(releaseTimelineSessionProvider.notifier).refresh();
      expect(
        container
            .read(releaseFollowsSessionProvider)
            .repositories
            .map((r) => r.id),
        ['R_beta'],
      );
      expect(
        container
            .read(releaseTimelineSessionProvider.notifier)
            .followedRepositories
            .map((r) => r.id),
        ['R_beta'],
      );
    },
  );

  test(
    'delayed metadata cannot restore a successfully removed follow',
    () async {
      final server = FollowsServer();
      server.settings['followedRepositories'] = [
        followJson('R_alpha', 'octo', 'alpha'),
      ];
      server.pages = {
        'R_alpha': pageJson('octo', 'alpha', [
          releaseJson(1, 'alpha', '2026-10-20T00:00:00Z'),
        ]),
      };
      final container = await openFollowsSession(server);
      final follows = container.read(releaseFollowsSessionProvider.notifier);
      await follows.reload();
      server.metadata['R_alpha'] = {
        'status': 'available',
        'owner': 'renamed',
        'name': 'alpha',
      };
      final hold = Completer<void>();
      server.holdMetadata = hold.future;
      final metadataStarted = server.nextRequest(
        'POST',
        '/api/release-follows/metadata',
      );
      final metadata = follows.loadMetadata();
      await metadataStarted;
      await follows.unfollow('R_alpha');
      expect(
        container.read(releaseFollowsSessionProvider).repositories,
        isEmpty,
      );
      final rounds = server.featureRequests
          .where((request) => request.uri.path.contains('release-timeline'))
          .length;
      hold.complete();
      await metadata;
      await waitForProvider(
        container,
        releaseTimelineSessionProvider,
        (state) => !state.loading,
      );
      expect(
        container.read(releaseFollowsSessionProvider).repositories,
        isEmpty,
      );
      expect(
        container
            .read(releaseTimelineSessionProvider.notifier)
            .followedRepositories,
        isEmpty,
      );
      expect(container.read(releaseTimelineSessionProvider).groups, isEmpty);
      expect(
        server.featureRequests
            .where((request) => request.uri.path.contains('release-timeline'))
            .length,
        rounds,
      );
    },
  );
}
