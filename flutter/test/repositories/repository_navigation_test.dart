import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/app.dart';
import 'package:gitpulse/connection/connection_controller.dart';
import 'package:gitpulse/session/gitpulse_http.dart';
import 'package:gitpulse/session/session_controller.dart';
import 'package:gitpulse/timeline/release_timeline_card.dart';
import 'package:go_router/go_router.dart';

import '../connection_flow_test.dart' show CapabilityServer;
import '../support/app_overrides.dart';
import '../releases/release_detail_service_test.dart' show releaseDetailJson;
import '../releases/repository_releases_service_test.dart' show releaseListJson;
import '../timeline/timeline_test_support.dart';
import 'repository_screen_test.dart' show repositoryJson;

void main() {
  for (final size in [const Size(390, 844), const Size(1200, 900)]) {
    testWidgets(
      'Home restores the scrolled timeline and direct repository routes have Back at $size',
      (tester) async {
        tester.view.physicalSize = size;
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        FlutterSecureStorage.setMockInitialValues({});
        final session =
            FakeSessionController(
                SessionState(
                  phase: SessionPhase.signedIn,
                  identity: signedInIdentity(),
                ),
              )
              ..handlers.addAll({
                'GET api/settings': () => BackendResult(
                  statusCode: 200,
                  data: settingsJson([followJson('R_app', 'octo', 'app')]),
                ),
                'POST api/release-timeline/refresh': () => BackendResult(
                  statusCode: 200,
                  data: roundJson(
                    pages: {
                      'R_app': pageJson('octo', 'app', [
                        for (var id = 60; id > 0; id--)
                          releaseJson(id, 'v$id', '2026-10-17T12:00:00Z'),
                      ]),
                    },
                  ),
                ),
                'GET api/repos/canonical/project': () =>
                    BackendResult(statusCode: 200, data: repositoryJson()),
                'GET api/repos/canonical/project/readme?ref=main': () =>
                    const BackendResult(
                      statusCode: 200,
                      data: {'content': null, 'path': null},
                    ),
                'GET api/releases/canonical/project?page=1&per_page=20': () =>
                    BackendResult(statusCode: 200, data: releaseListJson([])),
              });
        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              ...gitPulseHarnessOverrides(),
              connectionDioProvider.overrideWithValue(
                Dio()..httpClientAdapter = CapabilityServer(),
              ),
              sessionControllerProvider.overrideWith(() => session),
            ],
            child: const GitPulseApp(),
          ),
        );
        await tester.pumpAndSettle();
        await tester.drag(find.byType(CustomScrollView), const Offset(0, -600));
        await tester.pumpAndSettle();
        final card = find.byType(ReleaseTimelineCard).hitTestable().first;
        final item = tester.widget<ReleaseTimelineCard>(card).item;
        final position = tester.getTopLeft(card);
        final router = GoRouter.of(tester.element(card));
        session.handlers['GET api/releases/octo/app/${item.id}'] = () =>
            BackendResult(
              statusCode: 200,
              data: {
                ...releaseDetailJson(id: item.id),
                'name': 'Origin release',
              },
            );
        await tester.tap(card);
        await tester.pumpAndSettle();
        await tester.tap(find.text('canonical/project'));
        await tester.pumpAndSettle();
        expect(find.text('A useful project'), findsOneWidget);
        await tester.tap(find.text('Releases'));
        await tester.pumpAndSettle();
        await tester.tap(find.byTooltip('Home'));
        await tester.pumpAndSettle();
        expect(find.byKey(const Key('release-drawer')), findsNothing);
        expect(tester.getTopLeft(card), position);
        expect(router.routeInformationProvider.value.uri.path, '/timeline');

        session.handlers['GET api/repos/octo/app'] = () => BackendResult(
          statusCode: 200,
          data: {...repositoryJson(), 'description': 'Fresh overview'},
        );
        router.go('/repositories/octo/app');
        await tester.pumpAndSettle();
        expect(find.text('Fresh overview'), findsOneWidget);
        await tester.tap(find.byType(BackButton));
        await tester.pumpAndSettle();
        expect(router.routeInformationProvider.value.uri.path, '/timeline');
        expect(find.byType(ReleaseTimelineCard), findsWidgets);
        expect(tester.takeException(), isNull);
      },
    );
  }
}
