import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:gitpulse/l10n/generated/app_localizations.dart';
import 'package:gitpulse/releases/repository_releases_screen.dart';
import 'package:gitpulse/session/gitpulse_http.dart';
import 'package:gitpulse/session/session_controller.dart';

import '../timeline/timeline_test_support.dart';
import 'release_detail_service_test.dart' show releaseDetailJson;
import 'repository_releases_service_test.dart'
    show listReleaseJson, releaseListJson;

void main() {
  testWidgets(
    'routed repository releases open consistent details and preserve their filter on dismissal',
    (tester) async {
      final session =
          FakeSessionController(
              SessionState(
                phase: SessionPhase.signedIn,
                identity: signedInIdentity(),
              ),
            )
            ..handlers.addAll({
              'GET api/releases/octo/app?page=1&per_page=20': () =>
                  BackendResult(
                    statusCode: 200,
                    data: releaseListJson([
                      listReleaseJson(42, 'stable-release'),
                      listReleaseJson(43, 'preview-release', prerelease: true),
                    ]),
                  ),
              'GET api/releases/octo/app/42': () => BackendResult(
                statusCode: 200,
                data: {...releaseDetailJson(), 'name': 'Routed release notes'},
              ),
            });
      final router = GoRouter(
        initialLocation: '/repositories/octo/app/releases',
        routes: [
          GoRoute(
            path: '/timeline',
            builder: (_, _) =>
                const Scaffold(body: Text('Timeline destination')),
          ),
          GoRoute(
            path: '/repositories/:owner/:repository/releases',
            builder: (_, state) => RepositoryReleasesScreen(
              owner: state.pathParameters['owner']!,
              repository: state.pathParameters['repository']!,
            ),
          ),
        ],
      );
      addTearDown(router.dispose);
      await tester.pumpWidget(
        ProviderScope(
          overrides: [sessionControllerProvider.overrideWith(() => session)],
          child: MaterialApp.router(
            routerConfig: router,
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(ChoiceChip, 'Stable'));
      await tester.pumpAndSettle();
      expect(find.text('preview-release'), findsNothing);
      await tester.tap(find.text('stable-release'));
      await tester.pumpAndSettle();
      expect(find.text('Routed release notes'), findsOneWidget);
      expect(
        router.routeInformationProvider.value.uri.path,
        '/repositories/octo/app/releases',
      );
      await tester.sendKeyEvent(LogicalKeyboardKey.escape);
      await tester.pumpAndSettle();
      expect(find.text('preview-release'), findsNothing);
      expect(find.text('stable-release'), findsOneWidget);
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      expect(find.text('Timeline destination'), findsOneWidget);
    },
  );
}
