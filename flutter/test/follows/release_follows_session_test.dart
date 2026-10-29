import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/follows/release_follows_session.dart';
import 'package:gitpulse/follows/release_follows_state.dart';
import 'package:gitpulse/follows/repository_discovery_session.dart';
import 'package:gitpulse/session/session_controller.dart';
import 'package:gitpulse/timeline/timeline_models.dart';
import 'package:gitpulse/timeline/timeline_session.dart';

import '../support/follows_session_harness.dart';
import '../support/provider_wait.dart';
import 'follows_test_support.dart';
import '../timeline/timeline_test_support.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test(
    'starred discovery paginates and resets the page when ordering changes',
    () async {
      final server = FollowsServer()
        ..starredRepositories = [repositoryJson()]
        ..starredTotalPages = 10
        ..starredHasMore = true;
      final container = await openFollowsSession(
        server,
        address: 'https://gitpulse.example/pulse',
      );
      final facade = container.read(
        repositoryDiscoverySessionProvider.notifier,
      );
      await facade.loadStarred();
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
      final pagination = container
          .read(repositoryDiscoverySessionProvider)
          .starred
          .pagination!;
      expect(pagination.page, 1);
      expect(pagination.perPage, 30);
      expect(pagination.hasPrev, isFalse);
      expect(pagination.hasNext, isTrue);
      expect(pagination.totalCount, 300);
      expect(pagination.totalPages, 10);
      server.starredRepositories = [repositoryJson(id: 'R_beta', name: 'beta')];
      server.starredHasMore = false;
      await facade.loadStarred(page: 2);
      var starred = container.read(repositoryDiscoverySessionProvider).starred;
      expect(starred.items.map((item) => item.repository.id), ['R_beta']);
      expect(starred.page, 2);
      expect(starred.hasMore, isFalse);
      server.starredRepositories = [
        repositoryJson(id: 'R_gamma', name: 'gamma'),
      ];
      server.starredHasMore = true;
      await facade.loadStarred(
        sort: StarredRepositorySort.updated,
        ascending: true,
      );
      starred = container.read(repositoryDiscoverySessionProvider).starred;
      expect(starred.items.single.repository.id, 'R_gamma');
      expect(starred.page, 1);
      expect(server.featureRequests.last.uri.queryParameters, {
        'page': '1',
        'per_page': '30',
        'sort': 'updated',
        'direction': 'asc',
      });
      server.starredStatus = 500;
      await facade.loadStarred(page: 2);
      starred = container.read(repositoryDiscoverySessionProvider).starred;
      expect(starred.items.single.repository.id, 'R_gamma');
      expect(starred.page, 1);
      expect(starred.problem, FollowProblem.server);
      server.starredStatus = 200;
      await facade.loadStarred(page: 2);
      expect(server.featureRequests.last.uri.queryParameters['page'], '2');
      expect(
        container.read(repositoryDiscoverySessionProvider).starred.problem,
        isNull,
      );
    },
  );

  test('obsolete starred responses cannot overwrite a new sort or a signed-out account', () async {
    final server = FollowsServer()..starredRepositories = [repositoryJson()];
    final container = await openFollowsSession(
      server,
      address: 'https://gitpulse.example',
    );
    final facade = container.read(repositoryDiscoverySessionProvider.notifier);
    final hold = Completer<void>();
    server.holdStarred = hold.future;
    final requestStarted = server.nextRequest('GET', '/api/starred');
    final obsolete = facade.loadStarred();
    await requestStarted;
    server.holdStarred = null;
    server.starredRepositories = [repositoryJson(id: 'R_beta', name: 'beta')];
    await facade.loadStarred(sort: StarredRepositorySort.updated);
    hold.complete();
    await obsolete;
    expect(
      container
          .read(repositoryDiscoverySessionProvider)
          .starred
          .items
          .single
          .repository
          .id,
      'R_beta',
    );
    final logoutHold = Completer<void>();
    server.holdStarred = logoutHold.future;
    final accountStarted = server.nextRequest('GET', '/api/starred');
    final accountRequest = facade.refresh();
    await accountStarted;
    await container.read(sessionControllerProvider.notifier).signOut();
    logoutHold.complete();
    await accountRequest;
    expect(
      container.read(repositoryDiscoverySessionProvider).starred.items,
      isEmpty,
    );
    expect(container.read(repositoryDiscoverySessionProvider).active, isFalse);
  });

  test('search and follow use the same account settings and preserve unrelated preferences', () async {
    final server = FollowsServer();
    final container = await openFollowsSession(
      server,
      address: 'https://gitpulse.example/pulse',
    );
    final facade = container.read(releaseFollowsSessionProvider.notifier);
    await facade.reload();
    await container
        .read(repositoryDiscoverySessionProvider.notifier)
        .search('  alpha  ');
    final results = container
        .read(repositoryDiscoverySessionProvider)
        .search
        .items;
    expect(results.single.repository.id, 'R_alpha');
    expect(results.single.repository.fullName, 'octo/alpha');
    await facade.follow(results.single.repository);
    var state = container.read(releaseFollowsSessionProvider);
    expect(state.repositories.map((repo) => repo.id), ['R_alpha']);
    expect(state.problem, isNull);
    final save = server.featureRequests.singleWhere(
      (request) => request.method == 'PUT',
    );
    expect(save.headers['x-csrf-token'], server.csrf);
    expect(save.headers['cookie'], contains('nuxt-session='));
    expect(jsonDecode(save.body), {
      'followedRepositories': [
        {'id': 'R_alpha', 'owner': 'octo', 'name': 'alpha'},
      ],
    });
    expect(server.settings['fonts'], {'appFont': 'system'});
    expect(server.settings['releaseTimeline'], {'showReactions': false});
    final search = server.featureRequests.singleWhere(
      (request) => request.uri.path.contains('/search/'),
    );
    expect(search.uri.queryParameters['q'], 'alpha');
    await facade.follow(
      const TimelineRepository(id: '', owner: 'octo', name: 'alpha'),
    );
    state = container.read(releaseFollowsSessionProvider);
    expect(state.problem, FollowProblem.invalidRepository);
    expect(state.saveFailed, isFalse);
    expect(state.repositories.map((repo) => repo.id), ['R_alpha']);
  });

  test('pasted GitHub repository URLs resolve canonical node IDs and reject invalid targets', () async {
    final server = FollowsServer()
      ..repositories = [repositoryJson(owner: 'new-owner', name: 'renamed')];
    final container = await openFollowsSession(
      server,
      address: 'https://gitpulse.example/pulse',
    );
    final facade = container.read(repositoryDiscoverySessionProvider.notifier);
    await facade.search(' https://github.com/old-owner/alpha.git/ ');
    var state = container.read(repositoryDiscoverySessionProvider);
    expect(state.search.items.single.repository.fullName, 'new-owner/renamed');
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
      await facade.search(invalid);
      state = container.read(repositoryDiscoverySessionProvider);
      expect(state.search.items, isEmpty, reason: invalid);
      expect(
        state.search.problem,
        FollowProblem.invalidRepository,
        reason: invalid,
      );
    }
    server.repositories.clear();
    await facade.search('https://github.com/octo/missing');
    expect(
      container.read(repositoryDiscoverySessionProvider).search.problem,
      FollowProblem.notFound,
    );
    server.repositories = [repositoryJson()];
    server.searchStatus = 429;
    await facade.search('https://github.com/octo/alpha');
    expect(
      container.read(repositoryDiscoverySessionProvider).search.problem,
      FollowProblem.rateLimited,
    );
  });

  test('duplicates, invalid identities, account limits and failed saves never claim a new follow', () async {
    final server = FollowsServer();
    final container = await openFollowsSession(
      server,
      address: 'https://gitpulse.example/pulse',
    );
    final facade = container.read(releaseFollowsSessionProvider.notifier);
    await facade.reload();
    const alpha = TimelineRepository(
      id: 'R_alpha',
      owner: 'octo',
      name: 'alpha',
    );
    server.settings['followedRepositories'] = [
      followJson('R_alpha', 'old', 'name'),
    ];
    await facade.follow(alpha);
    expect(
      container.read(releaseFollowsSessionProvider).problem,
      FollowProblem.duplicate,
    );
    expect(
      server.featureRequests.where((request) => request.method == 'PUT'),
      isEmpty,
    );
    await facade.follow(
      const TimelineRepository(id: '', owner: 'octo', name: 'alpha'),
    );
    expect(
      container.read(releaseFollowsSessionProvider).problem,
      FollowProblem.invalidRepository,
    );

    server.settings['followedRepositories'] = [
      for (var i = 0; i < 100; i++) followJson('R_$i', 'octo', 'repo-$i'),
    ];
    await facade.reload();
    await facade.follow(alpha);
    expect(
      container.read(releaseFollowsSessionProvider).problem,
      FollowProblem.validLimit,
    );
    server.metadata['R_0'] = {'status': 'transient'};
    await facade.follow(alpha);
    expect(
      container.read(releaseFollowsSessionProvider).problem,
      FollowProblem.validLimit,
    );
    server.metadata['R_0'] = {'status': 'unavailable'};
    await facade.follow(alpha);
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
    await facade.follow(alpha);
    expect(
      container.read(releaseFollowsSessionProvider).problem,
      FollowProblem.storedLimit,
    );

    server.settings['followedRepositories'] = [];
    await facade.reload();
    server.saveStatus = 500;
    await facade.follow(alpha);
    expect(container.read(releaseFollowsSessionProvider).repositories, isEmpty);
    expect(
      container.read(releaseFollowsSessionProvider).problem,
      FollowProblem.server,
    );
    expect(server.settings['followedRepositories'], isEmpty);
    server.saveStatus = 200;
    await facade.follow(alpha);
    expect(
      container.read(releaseFollowsSessionProvider).repositories.single.id,
      'R_alpha',
    );
  });

  test('confirmed unfollow invalidates in-flight rounds, emits account-scoped removal and loads additions from page one', () async {
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
    final container = await openFollowsSession(
      server,
      address: 'https://gitpulse.example/pulse',
    );
    final follows = container.read(releaseFollowsSessionProvider.notifier);
    final timeline = container.read(releaseTimelineSessionProvider.notifier);
    final removals = <TimelineFollowRemoval>[];
    final subscription = timeline.followRemovals.listen(removals.add);
    addTearDown(subscription.cancel);
    await follows.reload();
    await waitForProvider(
      container,
      releaseTimelineSessionProvider,
      (state) => !state.loading,
    );
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
    await follows.unfollow('R_alpha');
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
    final requestStarted = server.nextRequest(
      'POST',
      '/api/release-timeline/refresh',
    );
    final obsolete = timeline.refresh();
    await requestStarted;
    await follows.unfollow('R_alpha');
    expect(container.read(releaseTimelineSessionProvider).groups, isEmpty);
    expect(container.read(releaseTimelineSessionProvider).hasFollows, isFalse);
    expect(removals.single.repositoryIds, {'R_alpha'});
    expect(removals.single.identity.login, 'octocat');
    expect(
      removals.single.identity.backend.toString(),
      'https://gitpulse.example/pulse/',
    );
    hold.complete();
    await obsolete;
    expect(container.read(releaseTimelineSessionProvider).groups, isEmpty);
    server.holdRound = null;
    server.pages = {
      'R_beta': pageJson('octo', 'beta', [
        releaseJson(21, 'v2.1', '2026-10-06T10:00:00Z'),
      ]),
    };
    await follows.follow(
      const TimelineRepository(id: 'R_beta', owner: 'octo', name: 'beta'),
    );
    await waitForProvider(
      container,
      releaseTimelineSessionProvider,
      (state) => !state.loading,
    );
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
    await follows.reload();
    await waitForProvider(
      container,
      releaseTimelineSessionProvider,
      (state) => !state.loading,
    );
    expect(container.read(releaseTimelineSessionProvider).groups, isEmpty);
    expect(removals.last.repositoryIds, {'R_beta'});
  });

  test('search uses Nitro pagination and superseded requests cannot replace the latest query', () async {
    final server = FollowsServer()..searchHasMore = true;
    final container = await openFollowsSession(
      server,
      address: 'https://gitpulse.example/pulse',
    );
    final facade = container.read(repositoryDiscoverySessionProvider.notifier);
    await facade.search('release');
    expect(
      container.read(repositoryDiscoverySessionProvider).search.hasMore,
      isTrue,
    );
    server.repositories = [repositoryJson(id: 'R_beta', name: 'beta')];
    server.searchHasMore = false;
    await facade.search('release', page: 2);
    expect(
      container
          .read(repositoryDiscoverySessionProvider)
          .search
          .items
          .map((item) => item.repository.id),
      ['R_beta'],
    );
    expect(server.featureRequests.last.uri.queryParameters['page'], '2');
    expect(
      container.read(repositoryDiscoverySessionProvider).search.hasMore,
      isFalse,
    );
    final hold = Completer<void>();
    server.holdSearch = hold.future;
    final requestStarted = server.nextRequest(
      'GET',
      '/api/search/repositories',
    );
    final obsolete = facade.search('old');
    await requestStarted;
    server.holdSearch = null;
    server.repositories = [repositoryJson(id: 'R_gamma', name: 'gamma')];
    await facade.search('new');
    hold.complete();
    await obsolete;
    expect(container.read(repositoryDiscoverySessionProvider).query, 'new');
    expect(
      container
          .read(repositoryDiscoverySessionProvider)
          .search
          .items
          .single
          .repository
          .id,
      'R_gamma',
    );
    await facade.search('');
    expect(
      container.read(repositoryDiscoverySessionProvider).search.hasMore,
      isFalse,
    );
  });

  test(
    'a malformed successful save does not erase the last confirmed list',
    () async {
      final server = FollowsServer();
      server.settings['followedRepositories'] = [
        followJson('R_web', 'web', 'project'),
      ];
      final container = await openFollowsSession(
        server,
        address: 'https://gitpulse.example',
      );
      final facade = container.read(releaseFollowsSessionProvider.notifier);
      await facade.reload();
      server.malformedSave = true;
      await facade.follow(
        const TimelineRepository(id: 'R_alpha', owner: 'octo', name: 'alpha'),
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

  test('sign-out hides follows and ignores search and save responses from the previous session', () async {
    final server = FollowsServer();
    final container = await openFollowsSession(
      server,
      address: 'https://gitpulse.example',
    );
    final facade = container.read(releaseFollowsSessionProvider.notifier);
    await facade.reload();
    final searchHold = Completer<void>();
    final saveHold = Completer<void>();
    server.holdSearch = searchHold.future;
    server.holdSave = saveHold.future;
    final searchStarted = server.nextRequest('GET', '/api/search/repositories');
    final saveStarted = server.nextRequest('PUT', '/api/settings');
    final search = container
        .read(repositoryDiscoverySessionProvider.notifier)
        .search('alpha');
    final save = facade.follow(
      const TimelineRepository(id: 'R_alpha', owner: 'octo', name: 'alpha'),
    );
    await Future.wait([searchStarted, saveStarted]);
    await container.read(sessionControllerProvider.notifier).signOut();
    expect(container.read(releaseFollowsSessionProvider).active, isFalse);
    expect(container.read(releaseFollowsSessionProvider).repositories, isEmpty);
    searchHold.complete();
    saveHold.complete();
    await Future.wait([search, save]);
    final state = container.read(releaseFollowsSessionProvider);
    expect(state.repositories, isEmpty);
    expect(
      container.read(repositoryDiscoverySessionProvider).search.items,
      isEmpty,
    );
    expect(state.active, isFalse);
    expect(container.read(releaseTimelineSessionProvider).active, isFalse);
  });
}
