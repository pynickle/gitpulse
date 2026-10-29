import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/follows/repository_discovery_session.dart';

import '../support/follows_session_harness.dart';
import 'follows_test_support.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  for (final source in RepositorySource.values) {
    test(
      '${source.name} reuses visited pages and refreshes only the current page',
      () async {
        final server = FollowsServer()
          ..starredRepositories = [repositoryJson()]
          ..starredHasMore = true
          ..searchHasMore = true;
        final container = await openFollowsSession(server);
        final discovery = container.read(
          repositoryDiscoverySessionProvider.notifier,
        );
        discovery.updateQuery('release');
        await discovery.selectSource(source);
        server.starredRepositories = server.repositories = [
          repositoryJson(id: 'R_beta', name: 'beta'),
        ];
        await discovery.goToPage(2);
        final requests = server.featureRequests.length;
        server.starredRepositories = server.repositories = [
          repositoryJson(id: 'R_new', name: 'new'),
        ];
        await discovery.goToPage(1);
        expect(
          container
              .read(repositoryDiscoverySessionProvider)
              .current
              .items
              .single
              .nodeId,
          'R_alpha',
        );
        expect(server.featureRequests.length, requests);
        await discovery.refresh();
        expect(
          container
              .read(repositoryDiscoverySessionProvider)
              .current
              .items
              .single
              .nodeId,
          'R_new',
        );
        expect(server.featureRequests.length, requests + 1);
        expect(server.featureRequests.last.uri.queryParameters['page'], '1');
        await discovery.goToPage(2);
        expect(
          container
              .read(repositoryDiscoverySessionProvider)
              .current
              .items
              .single
              .nodeId,
          'R_beta',
        );
        expect(server.featureRequests.length, requests + 1);
      },
    );

    test(
      '${source.name} discards an obsolete page request after a cached turn',
      () async {
        final server = FollowsServer()
          ..starredRepositories = [repositoryJson()]
          ..starredHasMore = true
          ..searchHasMore = true;
        final container = await openFollowsSession(server);
        final discovery = container.read(
          repositoryDiscoverySessionProvider.notifier,
        );
        discovery.updateQuery('release');
        await discovery.selectSource(source);
        final hold = Completer<void>();
        final path = source == RepositorySource.starred
            ? '/api/starred'
            : '/api/search/repositories';
        final started = server.nextRequest('GET', path);
        server.holdStarred = server.holdSearch = hold.future;
        final pending = discovery.goToPage(2);
        await started;
        await discovery.goToPage(1);
        hold.complete();
        await pending;
        expect(
          container.read(repositoryDiscoverySessionProvider).current.page,
          1,
        );
        expect(
          container
              .read(repositoryDiscoverySessionProvider)
              .current
              .requestedPage,
          1,
        );
        expect(
          container.read(repositoryDiscoverySessionProvider).current.loading,
          isFalse,
        );
      },
    );
  }
}
