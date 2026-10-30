import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/follows/release_follows_session.dart';
import 'package:gitpulse/follows/release_follows_state.dart';
import 'package:gitpulse/session/gitpulse_http.dart';
import 'package:gitpulse/timeline/timeline_session.dart';
import 'package:gitpulse/timeline/timeline_state.dart';

import '../support/follows_session_harness.dart';
import '../timeline/timeline_test_support.dart';
import 'follows_test_support.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test(
    'confirmation returns an immutable snapshot across subsequent refreshes',
    () async {
      final server = FollowsServer();
      server.settings['followedRepositories'] = [
        followJson('R_alpha', 'octo', 'alpha'),
      ];
      final container = await openFollowsSession(server);
      final follows = container.read(releaseFollowsSessionProvider.notifier);
      final first = await follows.synchronize();
      expect(first.problem, isNull);
      expect(first.repositories!.single.fullName, 'octo/alpha');
      expect(
        () => first.repositories!.add(first.repositories!.single),
        throwsUnsupportedError,
      );

      server.settings['followedRepositories'] = [
        followJson('R_alpha', 'renamed', 'alpha'),
      ];
      final second = await follows.synchronize(refresh: true);

      expect(second.problem, isNull);
      expect(second.repositories!.single.fullName, 'renamed/alpha');
      expect(first.repositories!.single.fullName, 'octo/alpha');
      expect(
        container
            .read(releaseFollowsSessionProvider)
            .repositories
            .single
            .fullName,
        'renamed/alpha',
      );
    },
  );

  for (final (reason, response, expected) in [
    (
      'network failure',
      const BackendResult(problem: BackendProblem.network),
      FollowProblem.network,
    ),
    (
      'rate limit',
      const BackendResult(statusCode: 429, problem: BackendProblem.rateLimited),
      FollowProblem.rateLimited,
    ),
    (
      'authentication rejection',
      const BackendResult(
        statusCode: 401,
        problem: BackendProblem.authenticationRejected,
      ),
      FollowProblem.session,
    ),
    (
      'server failure',
      const BackendResult(statusCode: 500, problem: BackendProblem.unavailable),
      FollowProblem.server,
    ),
    (
      'missing collection',
      const BackendResult(statusCode: 200, data: {}),
      FollowProblem.invalidResponse,
    ),
    (
      'malformed member',
      const BackendResult(
        statusCode: 200,
        data: {
          'followedRepositories': [
            {'id': 'R_alpha', 'owner': 'octo', 'name': 42},
          ],
        },
      ),
      FollowProblem.invalidResponse,
    ),
  ]) {
    test(
      'collection confirmation reports $reason and keeps the previous collection',
      () async {
        final (:container, :session, device: _) = createHarness();
        session.handlers['GET api/settings'] = () => BackendResult(
          statusCode: 200,
          data: settingsJson([followJson('R_alpha', 'octo', 'alpha')]),
        );
        session.handlers['POST api/release-timeline/refresh'] = () =>
            BackendResult(statusCode: 200, data: roundJson());
        await pumpEventQueue(times: 50);
        session.handlers['GET api/settings'] = () => response;

        final result = await container
            .read(releaseFollowsSessionProvider.notifier)
            .synchronize(refresh: true);

        expect(result.problem, expected);
        expect(result.repositories, isNull);
        expect(
          container.read(releaseFollowsSessionProvider).repositories.single.id,
          'R_alpha',
        );
        if (expected == FollowProblem.session) {
          session.requests.clear();
          await container
              .read(releaseTimelineSessionProvider.notifier)
              .refresh();
          expect(session.requests, ['GET api/settings']);
          expect(
            container.read(releaseTimelineSessionProvider).failure!.kind,
            TimelineFailureKind.session,
          );
        }
      },
    );
  }

  test(
    'overlapping callers receive the same confirmed empty collection',
    () async {
      final server = FollowsServer();
      final container = await openFollowsSession(server);
      final follows = container.read(releaseFollowsSessionProvider.notifier);
      final hold = Completer<void>();
      addTearDown(() {
        if (!hold.isCompleted) hold.complete();
      });
      server.holdSettings = hold.future;
      final readsBefore = server.featureRequests
          .where(
            (r) => r.method == 'GET' && r.uri.path.endsWith('/api/settings'),
          )
          .length;
      final started = server.nextRequest('GET', '/api/settings');
      final first = follows.synchronize(refresh: true);
      final second = follows.synchronize(refresh: true);
      await started;
      hold.complete();
      final results = await Future.wait([first, second]);

      for (final result in results) {
        expect(result.problem, isNull);
        expect(result.repositories, isEmpty);
      }
      expect(
        server.featureRequests
            .where(
              (r) => r.method == 'GET' && r.uri.path.endsWith('/api/settings'),
            )
            .length,
        readsBefore + 1,
      );
    },
  );

  for (final saveStatus in [200, 500]) {
    test(
      'synchronization begun during a $saveStatus save uses its outcome without another read',
      () async {
        final server = FollowsServer();
        server.settings['followedRepositories'] = [
          followJson('R_alpha', 'octo', 'alpha'),
        ];
        final container = await openFollowsSession(server);
        final follows = container.read(releaseFollowsSessionProvider.notifier);
        final hold = Completer<void>();
        addTearDown(() {
          if (!hold.isCompleted) hold.complete();
        });
        server.holdSave = hold.future;
        server.saveStatus = saveStatus;
        final started = server.nextRequest('PUT', '/api/settings');
        final edit = follows.unfollow('R_alpha');
        await started;
        final readsBefore = server.featureRequests
            .where(
              (r) => r.method == 'GET' && r.uri.path.endsWith('/api/settings'),
            )
            .length;
        var completed = false;
        final synchronization = follows.synchronize(refresh: true).then((
          result,
        ) {
          completed = true;
          return result;
        });
        await pumpEventQueue();
        expect(completed, isFalse);
        hold.complete();
        await edit;
        final result = await synchronization;

        if (saveStatus == 200) {
          expect(result.problem, isNull);
          expect(result.repositories, isEmpty);
        } else {
          expect(result.problem, FollowProblem.server);
          expect(result.repositories, isNull);
          expect(
            container
                .read(releaseFollowsSessionProvider)
                .repositories
                .single
                .id,
            'R_alpha',
          );
        }
        expect(
          server.featureRequests
              .where(
                (r) =>
                    r.method == 'GET' && r.uri.path.endsWith('/api/settings'),
              )
              .length,
          readsBefore,
        );
      },
    );
  }

  test(
    'a cancelled collection request returns cancellation without confirmation',
    () async {
      final (:container, :session, device: _) = createHarness();
      session.handlers['GET api/settings'] = () => BackendResult(
        statusCode: 200,
        data: settingsJson([followJson('R_alpha', 'octo', 'alpha')]),
      );
      session.handlers['POST api/release-timeline/refresh'] = () =>
          BackendResult(statusCode: 200, data: roundJson());
      await pumpEventQueue(times: 50);
      session.handlers['GET api/settings'] = () =>
          const BackendResult(cancelled: true);

      final result = await container
          .read(releaseFollowsSessionProvider.notifier)
          .synchronize(refresh: true);

      expect(result.problem, FollowProblem.cancelled);
      expect(result.repositories, isNull);
      expect(
        container.read(releaseFollowsSessionProvider).repositories.single.id,
        'R_alpha',
      );
    },
  );

  test('synchronization waits for the edit that superseded its read', () async {
    final server = FollowsServer();
    server.settings['followedRepositories'] = [
      followJson('R_alpha', 'octo', 'alpha'),
      followJson('R_beta', 'octo', 'beta'),
    ];
    final container = await openFollowsSession(server);
    final follows = container.read(releaseFollowsSessionProvider.notifier);
    final readHold = Completer<void>();
    final saveHold = Completer<void>();
    addTearDown(() {
      if (!readHold.isCompleted) readHold.complete();
      if (!saveHold.isCompleted) saveHold.complete();
    });
    server.holdSettings = readHold.future;
    final readStarted = server.nextRequest('GET', '/api/settings');
    var completed = false;
    final synchronization = follows.synchronize(refresh: true).then((result) {
      completed = true;
      return result;
    });
    await readStarted;
    server.holdSettings = null;
    server.holdSave = saveHold.future;
    final saveStarted = server.nextRequest('PUT', '/api/settings');
    final edit = follows.unfollow('R_alpha');
    await saveStarted;
    readHold.complete();
    await pumpEventQueue();

    expect(completed, isFalse);
    expect(container.read(releaseFollowsSessionProvider).saving, isTrue);
    saveHold.complete();
    await edit;
    final result = await synchronization;
    expect(result.repositories!.single.id, 'R_beta');
    expect(result.problem, isNull);
    expect(
      container
          .read(releaseFollowsSessionProvider)
          .repositories
          .map((r) => r.id),
      ['R_beta'],
    );
  });

  for (final saveFinishesFirst in [false, true]) {
    test(
      'a failed edit fails synchronization when save finishes ${saveFinishesFirst ? 'before' : 'after'} the old read',
      () async {
        final server = FollowsServer();
        server.settings['followedRepositories'] = [
          followJson('R_alpha', 'octo', 'alpha'),
        ];
        final container = await openFollowsSession(server);
        final follows = container.read(releaseFollowsSessionProvider.notifier);
        final readHold = Completer<void>();
        final saveHold = Completer<void>();
        addTearDown(() {
          if (!readHold.isCompleted) readHold.complete();
          if (!saveHold.isCompleted) saveHold.complete();
        });
        server.holdSettings = readHold.future;
        final readStarted = server.nextRequest('GET', '/api/settings');
        final synchronization = follows.synchronize(refresh: true);
        await readStarted;
        server.holdSettings = null;
        server.holdSave = saveHold.future;
        server.saveStatus = 500;
        final saveStarted = server.nextRequest('PUT', '/api/settings');
        final edit = follows.unfollow('R_alpha');
        await saveStarted;
        final reads = server.featureRequests
            .where(
              (r) => r.method == 'GET' && r.uri.path.endsWith('/api/settings'),
            )
            .length;
        if (saveFinishesFirst) {
          saveHold.complete();
          await edit;
        }
        readHold.complete();
        await pumpEventQueue();
        if (!saveHold.isCompleted) saveHold.complete();
        await edit;
        final result = await synchronization;

        expect(result.problem, FollowProblem.server);
        expect(result.repositories, isNull);
        expect(
          container.read(releaseFollowsSessionProvider).repositories.single.id,
          'R_alpha',
        );
        expect(
          container.read(releaseFollowsSessionProvider).saveFailed,
          isTrue,
        );
        expect(
          server.featureRequests
              .where(
                (r) =>
                    r.method == 'GET' && r.uri.path.endsWith('/api/settings'),
              )
              .length,
          reads,
        );
      },
    );
  }
}
