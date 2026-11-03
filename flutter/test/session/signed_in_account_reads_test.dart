import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/follows/repository_discovery_session.dart';
import 'package:gitpulse/releases/release_detail_service.dart';
import 'package:gitpulse/releases/repository_releases_controller.dart';
import 'package:gitpulse/releases/repository_releases_service.dart';
import 'package:gitpulse/repositories/repository_service.dart';
import 'package:gitpulse/session/gitpulse_http.dart';
import 'package:gitpulse/session/session_controller.dart';

import '../releases/release_detail_service_test.dart' show releaseDetailJson;
import '../releases/repository_releases_service_test.dart'
    show listReleaseJson, releaseListJson;
import '../timeline/timeline_test_support.dart';

const _repositoryKey = 'GET api/repos/octo/app';
const _readmeKey = 'GET api/repos/octo/app/readme?ref=main';
const _releaseKey = 'GET api/releases/octo/app/7';
const _releasesKey = 'GET api/releases/octo/app?page=1&per_page=20';
const _starredKey =
    'GET api/starred?page=1&per_page=30&sort=created&direction=desc';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test(
    'a rename keeps repository and release reads until the account changes',
    () async {
      final session = _session();
      final container = _container(session);
      // One opening for the whole test. A fresh one would be a new read.
      final scope = (owner: 'octo', repository: 'app', opening: Object());
      final readmeScope = (repository: scope, branch: 'main');
      const release = (owner: 'octo', repository: 'app', id: 7, tag: null);
      container
        ..listen(repositoryProvider(scope), (_, _) {})
        ..listen(repositoryReadmeProvider(readmeScope), (_, _) {})
        ..listen(releaseDetailProvider(release), (_, _) {})
        ..listen(repositoryReleasesControllerProvider(scope), (_, _) {});

      final repository = await container.read(repositoryProvider(scope).future);
      final readme = await container.read(
        repositoryReadmeProvider(readmeScope).future,
      );
      final detail = await container.read(
        releaseDetailProvider(release).future,
      );
      await _until(
        () => !container
            .read(repositoryReleasesControllerProvider(scope))
            .loading,
      );
      expect(repository.value?.nodeId, 'R_app');
      expect(readme.value?.path, 'README.md');
      expect(detail.release?.id, 7);
      expect(
        container.read(repositoryReleasesControllerProvider(scope)).data?.items,
        hasLength(1),
      );
      expect(_counts(session), [1, 1, 1, 1]);

      session.emit(
        SessionState(
          phase: SessionPhase.signedIn,
          identity: signedInIdentity(login: 'renamed'),
        ),
      );
      expect(
        (await container.read(repositoryProvider(scope).future)).value?.nodeId,
        'R_app',
      );
      expect(
        (await container.read(repositoryReadmeProvider(readmeScope).future))
            .value
            ?.path,
        'README.md',
      );
      expect(
        (await container.read(releaseDetailProvider(release).future))
            .release
            ?.id,
        7,
      );
      expect(
        container.read(repositoryReleasesControllerProvider(scope)).data?.items,
        hasLength(1),
      );
      expect(_counts(session), [1, 1, 1, 1]);

      session.emit(
        SessionState(
          phase: SessionPhase.signedIn,
          identity: signedInIdentity(login: 'renamed', githubId: '2'),
        ),
      );
      expect(
        (await container.read(repositoryProvider(scope).future)).value?.nodeId,
        'R_app',
      );
      expect(
        (await container.read(repositoryReadmeProvider(readmeScope).future))
            .value
            ?.path,
        'README.md',
      );
      expect(
        (await container.read(releaseDetailProvider(release).future))
            .release
            ?.id,
        7,
      );
      await _until(
        () => !container
            .read(repositoryReleasesControllerProvider(scope))
            .loading,
      );
      expect(
        container.read(repositoryReleasesControllerProvider(scope)).data?.items,
        hasLength(1),
      );
      expect(_counts(session), [2, 2, 2, 2]);

      session.emit(
        SessionState(
          phase: SessionPhase.rejected,
          identity: signedInIdentity(login: 'renamed', githubId: '2'),
        ),
      );
      expect(
        (await container.read(repositoryProvider(scope).future)).failure,
        RepositoryFailure.session,
      );
      expect(
        (await container.read(repositoryReadmeProvider(readmeScope).future))
            .failure,
        RepositoryFailure.session,
      );
      expect(
        (await container.read(releaseDetailProvider(release).future)).failure,
        ReleaseDetailFailure.session,
      );
      final releases = container.read(
        repositoryReleasesControllerProvider(scope),
      );
      expect(releases.loading, isFalse);
      expect(releases.failure, RepositoryReleasesFailure.session);
      expect(_counts(session), [2, 2, 2, 2]);
    },
  );

  test(
    'discovery keeps its page across a rename and drops it for another account',
    () async {
      final session = _session();
      final container = _container(session);
      container.listen(repositoryDiscoverySessionProvider, (_, _) {});
      await container
          .read(repositoryDiscoverySessionProvider.notifier)
          .loadStarred();
      expect(
        container
            .read(repositoryDiscoverySessionProvider)
            .current
            .items
            .single
            .nodeId,
        'R_app',
      );
      expect(session.requests.where((request) => request == _starredKey), [
        _starredKey,
      ]);

      session.emit(
        SessionState(
          phase: SessionPhase.signedIn,
          identity: signedInIdentity(login: 'renamed'),
        ),
      );
      expect(
        container
            .read(repositoryDiscoverySessionProvider)
            .current
            .items
            .single
            .nodeId,
        'R_app',
      );
      expect(session.requests, [_starredKey]);

      session.emit(
        SessionState(
          phase: SessionPhase.signedIn,
          identity: signedInIdentity(login: 'renamed', githubId: '2'),
        ),
      );
      final cleared = container.read(repositoryDiscoverySessionProvider);
      expect(cleared.active, isTrue);
      expect(cleared.current.page, 0);
      expect(session.requests, [_starredKey]);

      session.emit(
        SessionState(
          phase: SessionPhase.rejected,
          identity: signedInIdentity(login: 'renamed', githubId: '2'),
        ),
      );
      expect(
        container.read(repositoryDiscoverySessionProvider).active,
        isFalse,
      );
      expect(session.requests, [_starredKey]);
    },
  );
}

FakeSessionController _session() {
  final session = FakeSessionController(
    SessionState(phase: SessionPhase.signedIn, identity: signedInIdentity()),
  );
  session.handlers.addAll({
    _repositoryKey: () => BackendResult(
      statusCode: 200,
      data: {
        'id': 1,
        'node_id': 'R_app',
        'name': 'app',
        'owner': {'login': 'octo'},
        'default_branch': 'main',
        'stargazers_count': 1,
        'forks_count': 0,
      },
    ),
    _readmeKey: () => const BackendResult(
      statusCode: 200,
      data: {'content': '# Notes', 'path': 'README.md'},
    ),
    _releaseKey: () => BackendResult(
      statusCode: 200,
      data: releaseDetailJson(id: 7, tag: 'v1'),
    ),
    _releasesKey: () => BackendResult(
      statusCode: 200,
      data: releaseListJson([listReleaseJson(7, 'v1', name: 'One')]),
    ),
    _starredKey: () => const BackendResult(
      statusCode: 200,
      data: {
        'items': [
          {
            'node_id': 'R_app',
            'name': 'app',
            'owner': {'login': 'octo'},
          },
        ],
      },
    ),
  });
  return session;
}

ProviderContainer _container(FakeSessionController session) {
  final container = ProviderContainer(
    overrides: [sessionControllerProvider.overrideWith(() => session)],
  );
  addTearDown(container.dispose);
  return container;
}

List<int> _counts(FakeSessionController session) => [
  for (final key in [_repositoryKey, _readmeKey, _releaseKey, _releasesKey])
    session.requests.where((request) => request == key).length,
];

Future<void> _until(bool Function() ready) async {
  for (var attempt = 0; attempt < 20; attempt++) {
    if (ready()) return;
    await Future<void>.delayed(Duration.zero);
  }
  fail('the release list did not settle');
}
