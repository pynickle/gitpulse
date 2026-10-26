import 'dart:async';

import 'package:drift/native.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/presentation/gitpulse_state_views.dart';
import 'package:gitpulse/connection/connection_controller.dart';
import 'package:gitpulse/session/gitpulse_http.dart';
import 'package:gitpulse/session/session_controller.dart';
import 'package:gitpulse/timeline/timeline_cache.dart';
import 'package:gitpulse/timeline/timeline_dto.dart';
import 'package:gitpulse/timeline/timeline_models.dart';
import 'package:gitpulse/timeline/timeline_screen.dart';

import 'session_flow_test.dart';
import 'support/settling.dart';
import 'timeline/timeline_test_support.dart' show releaseJson, utcPlusEight;

class HeldStorage extends FlutterSecureStorage {
  final held = Completer<void>();
  bool reading = false;

  @override
  Future<String?> read({
    required String key,
    AppleOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    AppleOptions? mOptions,
    WindowsOptions? wOptions,
  }) async {
    if (key == 'authenticated_identity') {
      reading = true;
      await held.future;
    }
    return super.read(key: key);
  }
}

void main() {
  for (final leaveBackend in [false, true]) {
    testWidgets(
      'leaving a restored session ignores late startup work: $leaveBackend',
      (tester) async {
        final server = AuthServer();
        await mountApp(tester, server);
        await submitField(
          tester,
          label: 'Password',
          value: 'correct-horse',
          action: 'Unlock',
        );
        await tester.pumpWidget(const SizedBox.shrink());
        await tester.pumpAndSettle();
        final held = Completer<void>();
        addTearDown(() {
          if (!held.isCompleted) held.complete();
        });
        server
          ..heldPath = '/api/'
          ..hold = held.future;
        final container = await mountApp(
          tester,
          server,
          resetStorage: false,
          settle: false,
        );
        await pumpUntil(
          tester,
          () => find.byType(TimelineScreen).evaluate().isNotEmpty,
          reason: 'the saved identity is visible during validation',
        );
        final session = container.read(sessionControllerProvider.notifier);
        final request = session.request(
          method: 'PUT',
          path: 'api/settings',
          body: {},
        );
        await pumped(
          tester,
          leaveBackend ? session.leaveBackend() : session.signOut(),
        );
        held.complete();
        await tester.pumpAndSettle();
        expect(
          (await pumped(tester, request)).problem,
          BackendProblem.cancelled,
        );
        expect(
          container.read(sessionControllerProvider).phase,
          SessionPhase.signedOut,
        );
        expect(container.read(sessionControllerProvider).identity, isNull);
        expect(find.byType(TimelineScreen), findsNothing);
        expect(server.requests.where((r) => r.method == 'PUT'), isEmpty);
        if (leaveBackend) {
          expect(
            container.read(connectionControllerProvider).value?.backend,
            isNull,
          );
          expect(fieldLabeled('Backend address'), findsOneWidget);
        } else {
          expect(fieldLabeled('Password'), findsOneWidget);
        }
        expect(tester.takeException(), isNull);
      },
    );
  }

  for (final outcome in ['valid', 'offline', 'expired', 'empty session']) {
    testWidgets(
      'saved releases appear before startup requests finish: $outcome',
      (tester) async {
        final cache = TimelineCache(NativeDatabase.memory());
        addTearDown(cache.close);
        final now = DateTime.utc(2026, 10, 26, 12);
        final server = AuthServer()..includeGithubId = true;
        final first = await mountApp(tester, server, timelineCache: cache);
        await pumped(
          tester,
          first
              .read(sessionControllerProvider.notifier)
              .unlock('correct-horse'),
        );
        await settleUi(tester);
        final identity = first.read(sessionControllerProvider).identity!;
        await tester.pumpWidget(const SizedBox.shrink());
        await tester.pumpAndSettle();

        const repository = TimelineRepository(
          id: 'R_a',
          owner: 'octo',
          name: 'app',
        );
        final page = RepositoryPage(
          status: RepositoryPageStatus.available,
          owner: 'octo',
          name: 'app',
          hasOlderReleases: false,
          releases: [
            ReleaseItemDto.fromJson(
              releaseJson(
                1,
                'v1',
                '2026-10-25T12:00:00Z',
                name: 'Saved release',
              ),
            ).toDomain(),
          ],
        );
        await tester.runAsync(() async {
          final scope = TimelineCache.scopeOf(identity)!;
          await cache.synchronize(
            scope: scope,
            retentionDays: 30,
            repositories: [repository],
            now: now,
            isCurrent: () => true,
          );
          await cache.save(
            scope: scope,
            cycleId: 'saved',
            pages: [(repositoryId: 'R_a', cursor: null, page: page)],
            groups: assembleTimelineGroups(
              [repository],
              {'R_a': page},
              TimelineEnvironment(localDateKey: utcPlusEight),
            ),
            cycle: TimelineCycle.empty,
            now: now,
            isCurrent: () => true,
          );
        });
        final held = Completer<void>();
        addTearDown(() {
          if (!held.isCompleted) held.complete();
        });
        server
          ..heldPath = '/api/'
          ..hold = held.future;
        server.requests.clear();
        await mountApp(
          tester,
          server,
          resetStorage: false,
          settle: false,
          timelineCache: cache,
          timelineNow: () => now,
        );
        await pumpUntil(
          tester,
          () => find.text('Saved release').evaluate().isNotEmpty,
          reason: 'saved content must not wait for capabilities or session validation',
        );
        expect(server.holding, isTrue);
        expect(fieldLabeled('Password'), findsNothing);
        expect(
          server.requests.where(
            (request) => request.uri.path.endsWith('/api/settings'),
          ),
          isEmpty,
        );
        if (outcome == 'offline') server.offline = true;
        if (outcome == 'expired') server.sessionStatus = 401;
        if (outcome == 'empty session') server.acceptedLogin = null;
        held.complete();
        await settleUi(tester);
        if (outcome == 'expired' || outcome == 'empty session') {
          expect(fieldLabeled('Password'), findsOneWidget);
          expect(find.text('Saved release'), findsNothing);
        } else {
          expectIdentity(tester, 'octocat');
          expect(fieldLabeled('Password'), findsNothing);
          if (outcome == 'offline') {
            expect(find.text('Saved release'), findsOneWidget);
          }
        }
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox.shrink());
        await tester.runAsync(cache.close);
      },
    );
  }

  testWidgets('local restoration shows loading until sign-in is needed', (
    tester,
  ) async {
    final storage = HeldStorage();
    addTearDown(() {
      if (!storage.held.isCompleted) storage.held.complete();
    });
    await mountApp(tester, AuthServer(), storage: storage, settle: false);
    await pumpUntil(
      tester,
      () => storage.reading,
      reason: 'local credentials are still being read',
    );
    expect(find.byType(GitPulseLoadingView), findsOneWidget);
    expect(fieldLabeled('Password'), findsNothing);
    expect(find.byType(NavigationBar), findsNothing);

    storage.held.complete();
    await tester.pumpAndSettle();
    expect(fieldLabeled('Password'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'reopening shows the timeline before session validation finishes',
    (tester) async {
      final server = AuthServer();
      await mountApp(tester, server);
      await submitField(
        tester,
        label: 'Password',
        value: 'correct-horse',
        action: 'Unlock',
      );
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pumpAndSettle();

      final held = Completer<void>();
      server
        ..heldPath = '/api/_auth/session'
        ..hold = held.future;
      await mountApp(tester, server, resetStorage: false, settle: false);
      await pumpUntil(
        tester,
        () => server.holding,
        reason: 'the session validation request is pending',
      );
      expect(fieldLabeled('Password'), findsNothing);
      expect(find.byType(TimelineScreen), findsOneWidget);

      held.complete();
      await tester.pumpAndSettle();
      expectIdentity(tester, 'octocat');
      expect(tester.takeException(), isNull);
    },
  );
}
