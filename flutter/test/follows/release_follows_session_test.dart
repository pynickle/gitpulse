import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/follows/release_follows_session.dart';
import 'package:gitpulse/follows/release_follows_state.dart';
import 'package:gitpulse/session/session_controller.dart';
import 'package:gitpulse/timeline/timeline_models.dart';
import 'package:gitpulse/timeline/timeline_session.dart';

import '../session_flow_test.dart' as auth;
import 'follows_test_support.dart';
import '../timeline/timeline_test_support.dart';

void main() {
  testWidgets(
    'starred discovery paginates and resets the page when ordering changes',
    (tester) async {
      final server = FollowsServer()
        ..starredRepositories = [repositoryJson()]
        ..starredHasMore = true;
      final container = await auth.mountApp(tester, server);
      await auth.connectTo(tester, 'https://gitpulse.example/pulse');
      await auth.submitField(
        tester,
        label: 'Password',
        value: 'correct-horse',
        action: 'Unlock',
      );
      final facade = container.read(releaseFollowsSessionProvider.notifier);
      await auth.pumped(tester, facade.loadStarred());
      final first = server.featureRequests.singleWhere(
        (request) => request.uri.path.endsWith('/api/starred'),
      );
      expect(first.uri.path, '/pulse/api/starred');
      expect(first.uri.queryParameters, {
        'page': '1',
        'per_page': '30',
        'sort': 'created',
        'direction': 'desc',
      });
      server.starredRepositories = [
        repositoryJson(),
        repositoryJson(id: 'R_beta', name: 'beta'),
      ];
      server.starredHasMore = false;
      await auth.pumped(tester, facade.loadStarred(more: true));
      var starred = container.read(releaseFollowsSessionProvider).starred;
      expect(starred.items.map((item) => item.repository.id), [
        'R_alpha',
        'R_beta',
      ]);
      expect(starred.page, 2);
      expect(starred.hasMore, isFalse);
      server.starredRepositories = [
        repositoryJson(id: 'R_gamma', name: 'gamma'),
      ];
      server.starredHasMore = true;
      await auth.pumped(
        tester,
        facade.loadStarred(
          sort: StarredRepositorySort.updated,
          ascending: true,
        ),
      );
      starred = container.read(releaseFollowsSessionProvider).starred;
      expect(starred.items.single.repository.id, 'R_gamma');
      expect(starred.page, 1);
      expect(server.featureRequests.last.uri.queryParameters, {
        'page': '1',
        'per_page': '30',
        'sort': 'updated',
        'direction': 'asc',
      });
      server.starredStatus = 500;
      await auth.pumped(tester, facade.loadStarred(more: true));
      starred = container.read(releaseFollowsSessionProvider).starred;
      expect(starred.items.single.repository.id, 'R_gamma');
      expect(starred.page, 1);
      expect(starred.problem, FollowProblem.server);
      server.starredStatus = 200;
      await auth.pumped(tester, facade.loadStarred(more: true));
      expect(server.featureRequests.last.uri.queryParameters['page'], '2');
      expect(
        container.read(releaseFollowsSessionProvider).starred.problem,
        isNull,
      );
    },
  );

  testWidgets(
    'obsolete starred responses cannot overwrite a new sort or a signed-out account',
    (tester) async {
      final server = FollowsServer()..starredRepositories = [repositoryJson()];
      final container = await auth.mountApp(tester, server);
      await auth.connectTo(tester, 'https://gitpulse.example');
      await auth.submitField(
        tester,
        label: 'Password',
        value: 'correct-horse',
        action: 'Unlock',
      );
      final facade = container.read(releaseFollowsSessionProvider.notifier);
      final hold = Completer<void>();
      server.holdStarred = hold.future;
      final obsolete = facade.loadStarred();
      await tester.pump(const Duration(milliseconds: 100));
      server.holdStarred = null;
      server.starredRepositories = [repositoryJson(id: 'R_beta', name: 'beta')];
      await auth.pumped(
        tester,
        facade.loadStarred(sort: StarredRepositorySort.updated),
      );
      hold.complete();
      await auth.pumped(tester, obsolete);
      expect(
        container
            .read(releaseFollowsSessionProvider)
            .starred
            .items
            .single
            .repository
            .id,
        'R_beta',
      );
      final logoutHold = Completer<void>();
      server.holdStarred = logoutHold.future;
      final accountRequest = facade.loadStarred();
      await tester.pump(const Duration(milliseconds: 100));
      await auth.pumped(
        tester,
        container.read(sessionControllerProvider.notifier).signOut(),
      );
      logoutHold.complete();
      await auth.pumped(tester, accountRequest);
      expect(
        container.read(releaseFollowsSessionProvider).starred.items,
        isEmpty,
      );
      expect(container.read(releaseFollowsSessionProvider).active, isFalse);
    },
  );

  testWidgets(
    'search and follow use the same account settings and preserve unrelated preferences',
    (tester) async {
      final server = FollowsServer();
      final container = await auth.mountApp(tester, server);
      await auth.connectTo(tester, 'https://gitpulse.example/pulse');
      await auth.submitField(
        tester,
        label: 'Password',
        value: 'correct-horse',
        action: 'Unlock',
      );
      final facade = container.read(releaseFollowsSessionProvider.notifier);
      await auth.pumped(tester, facade.reload());
      await auth.pumped(tester, facade.search('  alpha  '));
      var state = container.read(releaseFollowsSessionProvider);
      expect(state.results.single.repository.id, 'R_alpha');
      expect(state.results.single.repository.fullName, 'octo/alpha');
      await auth.pumped(tester, facade.follow(state.results.single.repository));
      state = container.read(releaseFollowsSessionProvider);
      expect(state.repositories.map((repo) => repo.id), ['R_alpha']);
      expect(state.problem, isNull);
      final save = server.featureRequests.singleWhere(
        (request) => request.method == 'PUT',
      );
      expect(save.headers['x-csrf-token'], server.csrf);
      expect(save.headers['cookie'], contains('nuxt-session='));
      expect(
        save.body,
        '{"followedRepositories":[{"id":"R_alpha","owner":"octo","name":"alpha"}]}',
      );
      expect(server.settings['fonts'], {'appFont': 'system'});
      expect(server.settings['releaseTimeline'], {'showReactions': false});
      final search = server.featureRequests.singleWhere(
        (request) => request.uri.path.contains('/search/'),
      );
      expect(search.uri.queryParameters['q'], 'alpha');
    },
  );

  testWidgets(
    'pasted GitHub repository URLs resolve canonical node IDs and reject invalid targets',
    (tester) async {
      final server = FollowsServer()
        ..repositories = [repositoryJson(owner: 'new-owner', name: 'renamed')];
      final container = await auth.mountApp(tester, server);
      await auth.connectTo(tester, 'https://gitpulse.example/pulse');
      await auth.submitField(
        tester,
        label: 'Password',
        value: 'correct-horse',
        action: 'Unlock',
      );
      final facade = container.read(releaseFollowsSessionProvider.notifier);
      await auth.pumped(tester, facade.reload());
      await auth.pumped(
        tester,
        facade.search(' https://github.com/old-owner/alpha.git/ '),
      );
      var state = container.read(releaseFollowsSessionProvider);
      expect(state.results.single.repository.fullName, 'new-owner/renamed');
      expect(
        server.featureRequests.last.uri.path,
        '/pulse/api/repos/old-owner/alpha',
      );
      for (final invalid in [
        'https://github.com.evil.test/octo/alpha',
        'https://gitlab.com/octo/alpha',
        'https://user:password@github.com/octo/alpha',
        'https://github.com/octo/alpha/issues/1',
        'https://github.com/octo',
        'https://github.com/octo/%2Falpha',
        'file://github.com/octo/alpha',
      ]) {
        await auth.pumped(tester, facade.search(invalid));
        state = container.read(releaseFollowsSessionProvider);
        expect(state.results, isEmpty, reason: invalid);
        expect(
          state.searchProblem,
          FollowProblem.invalidRepository,
          reason: invalid,
        );
      }
      server.repositories.clear();
      await auth.pumped(
        tester,
        facade.search('https://github.com/octo/missing'),
      );
      expect(
        container.read(releaseFollowsSessionProvider).searchProblem,
        FollowProblem.notFound,
      );
      server.repositories = [repositoryJson()];
      server.searchStatus = 429;
      await auth.pumped(tester, facade.search('https://github.com/octo/alpha'));
      expect(
        container.read(releaseFollowsSessionProvider).searchProblem,
        FollowProblem.rateLimited,
      );
    },
  );

  testWidgets(
    'duplicates, invalid identities, account limits and failed saves never claim a new follow',
    (tester) async {
      final server = FollowsServer();
      final container = await auth.mountApp(tester, server);
      await auth.connectTo(tester, 'https://gitpulse.example/pulse');
      await auth.submitField(
        tester,
        label: 'Password',
        value: 'correct-horse',
        action: 'Unlock',
      );
      final facade = container.read(releaseFollowsSessionProvider.notifier);
      await auth.pumped(tester, facade.reload());
      const alpha = TimelineRepository(
        id: 'R_alpha',
        owner: 'octo',
        name: 'alpha',
      );
      server.settings['followedRepositories'] = [
        followJson('R_alpha', 'old', 'name'),
      ];
      await auth.pumped(tester, facade.follow(alpha));
      expect(
        container.read(releaseFollowsSessionProvider).problem,
        FollowProblem.duplicate,
      );
      expect(
        server.featureRequests.where((request) => request.method == 'PUT'),
        isEmpty,
      );
      await auth.pumped(
        tester,
        facade.follow(
          const TimelineRepository(id: '', owner: 'octo', name: 'alpha'),
        ),
      );
      expect(
        container.read(releaseFollowsSessionProvider).problem,
        FollowProblem.invalidRepository,
      );

      server.settings['followedRepositories'] = [
        for (var i = 0; i < 100; i++) followJson('R_$i', 'octo', 'repo-$i'),
      ];
      await auth.pumped(tester, facade.reload());
      await auth.pumped(tester, facade.follow(alpha));
      expect(
        container.read(releaseFollowsSessionProvider).problem,
        FollowProblem.validLimit,
      );
      server.metadata['R_0'] = {'status': 'transient'};
      await auth.pumped(tester, facade.follow(alpha));
      expect(
        container.read(releaseFollowsSessionProvider).problem,
        FollowProblem.validLimit,
      );
      server.metadata['R_0'] = {'status': 'unavailable'};
      await auth.pumped(tester, facade.follow(alpha));
      expect(
        container.read(releaseFollowsSessionProvider).repositories.first.id,
        'R_alpha',
      );
      expect(container.read(releaseFollowsSessionProvider).problem, isNull);

      server.settings['followedRepositories'] = [
        for (var i = 0; i < 150; i++) followJson('R_$i', 'octo', 'repo-$i'),
      ];
      server.metadata = {
        for (var i = 0; i < 150; i++) 'R_$i': {'status': 'unavailable'},
      };
      await auth.pumped(tester, facade.follow(alpha));
      expect(
        container.read(releaseFollowsSessionProvider).problem,
        FollowProblem.storedLimit,
      );

      server.settings['followedRepositories'] = [];
      await auth.pumped(tester, facade.reload());
      server.saveStatus = 500;
      await auth.pumped(tester, facade.follow(alpha));
      expect(
        container.read(releaseFollowsSessionProvider).repositories,
        isEmpty,
      );
      expect(
        container.read(releaseFollowsSessionProvider).problem,
        FollowProblem.server,
      );
      expect(server.settings['followedRepositories'], isEmpty);
      server.saveStatus = 200;
      await auth.pumped(tester, facade.follow(alpha));
      expect(
        container.read(releaseFollowsSessionProvider).repositories.single.id,
        'R_alpha',
      );
    },
  );

  testWidgets(
    'confirmed unfollow invalidates in-flight rounds, emits account-scoped removal and loads additions from page one',
    (tester) async {
      final server = FollowsServer();
      server.settings['followedRepositories'] = [
        followJson('R_alpha', 'octo', 'alpha'),
      ];
      server.pages = {
        'R_alpha': pageJson(
          'octo',
          'alpha',
          [releaseJson(12, 'v1.2', '2026-10-05T10:00:00Z')],
          hasOlderReleases: true,
          endCursor: 'alpha-next',
        ),
      };
      final container = await auth.mountApp(tester, server);
      await auth.connectTo(tester, 'https://gitpulse.example/pulse');
      await auth.submitField(
        tester,
        label: 'Password',
        value: 'correct-horse',
        action: 'Unlock',
      );
      final follows = container.read(releaseFollowsSessionProvider.notifier);
      final timeline = container.read(releaseTimelineSessionProvider.notifier);
      final removals = <TimelineFollowRemoval>[];
      final subscription = timeline.followRemovals.listen(removals.add);
      addTearDown(subscription.cancel);
      await auth.pumped(tester, follows.reload());
      await tester.pumpAndSettle();
      expect(
        container
            .read(releaseTimelineSessionProvider)
            .groups
            .single
            .items
            .single
            .key,
        'R_alpha:12',
      );
      server.saveStatus = 500;
      await auth.pumped(tester, follows.unfollow('R_alpha'));
      expect(
        container
            .read(releaseTimelineSessionProvider)
            .groups
            .single
            .items
            .single
            .key,
        'R_alpha:12',
      );
      expect(removals, isEmpty);
      server.saveStatus = 200;
      final hold = Completer<void>();
      server.holdRound = hold.future;
      final obsolete = timeline.refresh();
      await tester.pump(const Duration(milliseconds: 100));
      await auth.pumped(tester, follows.unfollow('R_alpha'));
      expect(container.read(releaseTimelineSessionProvider).groups, isEmpty);
      expect(
        container.read(releaseTimelineSessionProvider).hasFollows,
        isFalse,
      );
      expect(removals.single.repositoryIds, {'R_alpha'});
      expect(removals.single.identity.login, 'octocat');
      expect(
        removals.single.identity.backend.toString(),
        'https://gitpulse.example/pulse/',
      );
      hold.complete();
      await auth.pumped(tester, obsolete);
      expect(container.read(releaseTimelineSessionProvider).groups, isEmpty);
      server.holdRound = null;
      server.pages = {
        'R_beta': pageJson('octo', 'beta', [
          releaseJson(21, 'v2.1', '2026-10-06T10:00:00Z'),
        ]),
      };
      await auth.pumped(
        tester,
        follows.follow(
          const TimelineRepository(id: 'R_beta', owner: 'octo', name: 'beta'),
        ),
      );
      await tester.pumpAndSettle();
      expect(
        container
            .read(releaseTimelineSessionProvider)
            .groups
            .single
            .items
            .single
            .key,
        'R_beta:21',
      );
      expect(
        server.featureRequests.last.uri.path,
        '/pulse/api/release-timeline/refresh',
      );
      // A web-side follow change is authoritative on the next account reload.
      server.settings['followedRepositories'] = [];
      await auth.pumped(tester, follows.reload());
      await tester.pumpAndSettle();
      expect(container.read(releaseTimelineSessionProvider).groups, isEmpty);
      expect(removals.last.repositoryIds, {'R_beta'});
    },
  );

  testWidgets(
    'search uses Nitro pagination and superseded requests cannot replace the latest query',
    (tester) async {
      final server = FollowsServer()..searchHasMore = true;
      final container = await auth.mountApp(tester, server);
      await auth.connectTo(tester, 'https://gitpulse.example/pulse');
      await auth.submitField(
        tester,
        label: 'Password',
        value: 'correct-horse',
        action: 'Unlock',
      );
      final facade = container.read(releaseFollowsSessionProvider.notifier);
      await auth.pumped(tester, facade.reload());
      await auth.pumped(tester, facade.search('release'));
      expect(container.read(releaseFollowsSessionProvider).hasMore, isTrue);
      server.repositories = [repositoryJson(id: 'R_beta', name: 'beta')];
      server.searchHasMore = false;
      await auth.pumped(tester, facade.search('release', more: true));
      expect(
        container
            .read(releaseFollowsSessionProvider)
            .results
            .map((item) => item.repository.id),
        ['R_alpha', 'R_beta'],
      );
      expect(server.featureRequests.last.uri.queryParameters['page'], '2');
      expect(container.read(releaseFollowsSessionProvider).hasMore, isFalse);
      final hold = Completer<void>();
      server.holdSearch = hold.future;
      final obsolete = facade.search('old');
      await tester.pump(const Duration(milliseconds: 100));
      server.holdSearch = null;
      server.repositories = [repositoryJson(id: 'R_gamma', name: 'gamma')];
      await auth.pumped(tester, facade.search('new'));
      hold.complete();
      await auth.pumped(tester, obsolete);
      expect(container.read(releaseFollowsSessionProvider).query, 'new');
      expect(
        container
            .read(releaseFollowsSessionProvider)
            .results
            .single
            .repository
            .id,
        'R_gamma',
      );
      await auth.pumped(tester, facade.search(''));
      expect(container.read(releaseFollowsSessionProvider).hasMore, isFalse);
    },
  );

  testWidgets(
    'a malformed successful save does not erase the last confirmed list',
    (tester) async {
      final server = FollowsServer();
      server.settings['followedRepositories'] = [
        followJson('R_web', 'web', 'project'),
      ];
      final container = await auth.mountApp(tester, server);
      await auth.connectTo(tester, 'https://gitpulse.example');
      await auth.submitField(
        tester,
        label: 'Password',
        value: 'correct-horse',
        action: 'Unlock',
      );
      final facade = container.read(releaseFollowsSessionProvider.notifier);
      await auth.pumped(tester, facade.reload());
      server.malformedSave = true;
      await auth.pumped(
        tester,
        facade.follow(
          const TimelineRepository(id: 'R_alpha', owner: 'octo', name: 'alpha'),
        ),
      );
      expect(
        container.read(releaseFollowsSessionProvider).problem,
        FollowProblem.invalidResponse,
      );
      expect(
        container.read(releaseFollowsSessionProvider).repositories.single.id,
        'R_web',
      );
    },
  );

  testWidgets(
    'sign-out hides follows and ignores search and save responses from the previous session',
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
      final facade = container.read(releaseFollowsSessionProvider.notifier);
      await auth.pumped(tester, facade.reload());
      final searchHold = Completer<void>();
      final saveHold = Completer<void>();
      server.holdSearch = searchHold.future;
      server.holdSave = saveHold.future;
      final search = facade.search('alpha');
      final save = facade.follow(
        const TimelineRepository(id: 'R_alpha', owner: 'octo', name: 'alpha'),
      );
      await tester.pump(const Duration(milliseconds: 100));
      await auth.pumped(
        tester,
        container.read(sessionControllerProvider.notifier).signOut(),
      );
      expect(container.read(releaseFollowsSessionProvider).active, isFalse);
      expect(
        container.read(releaseFollowsSessionProvider).repositories,
        isEmpty,
      );
      searchHold.complete();
      saveHold.complete();
      await auth.pumped(tester, Future.wait([search, save]));
      final state = container.read(releaseFollowsSessionProvider);
      expect(state.repositories, isEmpty);
      expect(state.results, isEmpty);
      expect(state.active, isFalse);
      expect(container.read(releaseTimelineSessionProvider).active, isFalse);
    },
  );
}
