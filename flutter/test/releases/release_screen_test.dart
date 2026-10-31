import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:gitpulse/l10n/generated/app_localizations.dart';
import 'package:gitpulse/presentation/gitpulse_buttons.dart';
import 'package:gitpulse/presentation/gitpulse_theme.dart';
import 'package:gitpulse/presentation/gitpulse_tokens.dart';
import 'package:gitpulse/releases/release_assets_screen.dart';
import 'package:gitpulse/releases/release_screen.dart';
import 'package:gitpulse/releases/repository_releases_page.dart';
import 'package:gitpulse/repositories/repository_screen.dart';
import 'package:gitpulse/session/gitpulse_http.dart';
import 'package:gitpulse/session/native_login_handoff.dart';
import 'package:gitpulse/session/session_controller.dart';

import '../releases/release_detail_service_test.dart' show releaseDetailJson;
import '../repositories/repository_screen_test.dart' show repositoryJson;
import '../support/document_viewer.dart';
import '../support/material_faces.dart';
import '../support/named_actions.dart';
import '../timeline/timeline_test_support.dart';
import 'repository_releases_service_test.dart'
    show listReleaseJson, releaseListJson;

Map<String, Object?> releaseJson({
  String name = 'The big one',
  String tag = 'v1.0.0',
  String body = 'Release notes body',
  List<Map<String, Object?>> assets = const [],
  Map<String, Object?>? author,
  String? publishedAt = '2026-10-20T00:00:00Z',
  bool prerelease = false,
}) => {
  ...releaseDetailJson(tag: tag),
  'name': name,
  'body': body,
  'assets': assets,
  'author': author,
  'published_at': publishedAt,
  'prerelease': prerelease,
};

Map<String, Object?> assetJson(
  String name, {
  int size = 2048,
  String? browserDownloadUrl,
}) => {
  'id': name.hashCode,
  'name': name,
  'label': null,
  'size': size,
  'download_count': 7,
  'content_type': 'application/zip',
  'browser_download_url':
      browserDownloadUrl ??
      'https://github.com/canonical/project/releases/download/v1/app.zip',
};

/// Mounts the release routes the app installs, with the fake session answering
/// from [handlers], and hands back the router so a test can read where it is.
Future<({FakeSessionController session, GoRouter router})> pumpReleaseRoutes(
  WidgetTester tester, {
  required Map<String, FutureOr<BackendResult> Function()> handlers,
  String initialLocation = '/releases/octo/app/42',
  Future<bool> Function(Uri)? launchBrowser,
}) async {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final session = FakeSessionController(
    SessionState(phase: SessionPhase.signedIn, identity: signedInIdentity()),
  )..handlers.addAll(handlers);
  final router = GoRouter(
    initialLocation: initialLocation,
    routes: [
      GoRoute(
        path: '/timeline',
        builder: (_, _) => const Scaffold(body: Text('Timeline destination')),
      ),
      GoRoute(
        path: '/releases/:owner/:repository',
        builder: (_, state) => RepositoryReleasesPage(
          owner: state.pathParameters['owner']!,
          repository: state.pathParameters['repository']!,
        ),
      ),
      GoRoute(
        path: '/releases/:owner/:repository/:id',
        builder: (_, state) => ReleaseScreen(
          owner: state.pathParameters['owner']!,
          repository: state.pathParameters['repository']!,
          id: int.tryParse(state.pathParameters['id']!),
        ),
        routes: [
          GoRoute(
            path: 'assets',
            builder: (_, state) => ReleaseAssetsScreen(
              owner: state.pathParameters['owner']!,
              repository: state.pathParameters['repository']!,
              id: int.tryParse(state.pathParameters['id']!),
            ),
          ),
          GoRoute(
            path: 'repository',
            builder: (_, state) => RepositoryScreen(
              owner: state.pathParameters['owner']!,
              repository: state.pathParameters['repository']!,
              openedFromRelease: true,
            ),
          ),
        ],
      ),
    ],
  );
  addTearDown(router.dispose);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        ...documentViewerOverrides(),
        sessionControllerProvider.overrideWith(() => session),
        if (launchBrowser != null)
          browserLauncherProvider.overrideWithValue(launchBrowser),
      ],
      child: MaterialApp.router(
        routerConfig: router,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
      ),
    ),
  );
  await tester.pumpAndSettle();
  return (session: session, router: router);
}

String locationOf(GoRouter router) =>
    Uri.decodeFull(router.state.uri.toString());

void main() {
  testWidgets('a release is a page with the web drawer’s header', (
    tester,
  ) async {
    await pumpReleaseRoutes(
      tester,
      handlers: {
        'GET api/releases/octo/app/42': () => BackendResult(
          statusCode: 200,
          data: releaseJson(
            name: 'Nightly 0.4.0-nightly.1',
            tag: 'v0.4.0-nightly.1',
            prerelease: true,
            author: {'login': 'danyaber ezun'},
          ),
        ),
      },
    );
    // The tag line, its prerelease pill, the name, and the line that signs it —
    // the order the web Release Drawer opens a release in.
    expect(find.text('v0.4.0-nightly.1'), findsOneWidget);
    expect(find.byIcon(Icons.sell_outlined), findsOneWidget);
    expect(find.text('Prerelease'), findsOneWidget);
    expect(find.text('Nightly 0.4.0-nightly.1'), findsOneWidget);
    expect(find.text('danyaber ezun'), findsOneWidget);
    expect(findNamedAction('Open on GitHub'), findsOneWidget);

    // The name is a page's title and the tag above it a caption: rows of the
    // type table, never a literal.
    final context = tester.element(find.byType(ReleaseScreen));
    final title = tester.widget<SelectableText>(find.byType(SelectableText));
    expect(
      title.style?.fontSize,
      gitPulseTypeTableOf(context).headlineSmall.size,
    );
    expect(title.style?.color, toneTextStrong(context));
    expect(
      tester.widget<Text>(find.text('v0.4.0-nightly.1')).style?.fontSize,
      gitPulseTypeTableOf(context).labelSmall.size,
    );
    expectNoReplacedMaterialFaces(find.byType(ReleaseScreen));
    expect(tester.takeException(), isNull);
  });

  testWidgets('the GitHub action opens the release being read', (tester) async {
    final launched = <Uri>[];
    await pumpReleaseRoutes(
      tester,
      launchBrowser: (uri) async {
        launched.add(uri);
        return true;
      },
      handlers: {
        'GET api/releases/octo/app/42': () => BackendResult(
          statusCode: 200,
          data: releaseJson(author: {'login': 'octocat'}),
        ),
      },
    );
    await tester.tap(findNamedAction('Open on GitHub'));
    await tester.pumpAndSettle();
    expect(
      launched.single.toString(),
      'https://github.com/canonical/project/releases/tag/v2/rc',
    );
  });

  testWidgets('a swipe across the header opens the repository’s releases', (
    tester,
  ) async {
    final page = await pumpReleaseRoutes(
      tester,
      handlers: {
        'GET api/releases/octo/app?page=1&per_page=20': () => BackendResult(
          statusCode: 200,
          data: releaseListJson([
            listReleaseJson(42, 'v1.0.0'),
            listReleaseJson(43, 'v0.9.0'),
          ]),
        ),
        'GET api/releases/octo/app/42': () => BackendResult(
          statusCode: 200,
          data: releaseJson(author: {'login': 'octocat'}),
        ),
      },
    );
    // The gesture is offered over the header: the notes belong to the document's
    // own renderer, and nothing this page does moves them.
    await tester.fling(find.text('octocat'), const Offset(-300, 0), 1000);
    await tester.pumpAndSettle();
    expect(find.byType(RepositoryReleasesPage), findsOneWidget);
    expect(locationOf(page.router), '/releases/octo/app');

    // A row opens that release at the list's own address.
    await tester.tap(find.text('v0.9.0'));
    await tester.pumpAndSettle();
    expect(locationOf(page.router), '/releases/octo/app/43');
  });

  testWidgets(
    'the assets row opens the files, and Back returns to the release',
    (tester) async {
      final page = await pumpReleaseRoutes(
        tester,
        handlers: {
          'GET api/releases/octo/app/42': () => BackendResult(
            statusCode: 200,
            data: releaseJson(assets: [assetJson('linux.zip')]),
          ),
        },
      );
      expect(find.text('linux.zip'), findsNothing);
      await tester.tap(find.byKey(const Key('release-assets')));
      await tester.pumpAndSettle();
      expect(locationOf(page.router), '/releases/octo/app/42/assets');
      expect(find.text('linux.zip'), findsOneWidget);
      await tester.tap(findNamedAction('Back'));
      await tester.pumpAndSettle();
      expect(locationOf(page.router), '/releases/octo/app/42');
      expect(find.text('The big one'), findsOneWidget);
    },
  );

  testWidgets('an asset row downloads only through a safe address', (
    tester,
  ) async {
    final launched = <Uri>[];
    await pumpReleaseRoutes(
      tester,
      initialLocation: '/releases/octo/app/42/assets',
      launchBrowser: (uri) async {
        launched.add(uri);
        return true;
      },
      handlers: {
        'GET api/releases/octo/app/42': () => BackendResult(
          statusCode: 200,
          data: releaseJson(
            assets: [
              assetJson('app.zip'),
              assetJson('evil.zip', browserDownloadUrl: 'javascript:alert(1)'),
            ],
          ),
        ),
      },
    );
    // A row whose address is not safe keeps its name and offers no action.
    expect(
      tester.getSemantics(find.text('evil.zip')),
      isSemantics(hasTapAction: false),
    );
    await tester.tap(find.text('app.zip'));
    await tester.pumpAndSettle();
    expect(
      launched.single.toString(),
      'https://github.com/canonical/project/releases/download/v1/app.zip',
    );
  });

  testWidgets('the release title leads to the repository, and Back returns', (
    tester,
  ) async {
    final page = await pumpReleaseRoutes(
      tester,
      handlers: {
        'GET api/releases/octo/app/42': () =>
            BackendResult(statusCode: 200, data: releaseJson()),
        'GET api/repositories/octo/app': () =>
            BackendResult(statusCode: 200, data: repositoryJson()),
        'GET api/repositories/octo/app/readme?ref=main': () =>
            const BackendResult(
              statusCode: 200,
              data: {'content': null, 'path': null},
            ),
      },
    );
    await tester.tap(find.byKey(const Key('release-repository')));
    await tester.pumpAndSettle();
    expect(find.byType(RepositoryScreen), findsOneWidget);
    expect(locationOf(page.router), '/releases/octo/app/42/repository');
    // The repository was reached from a release, so it steps back to those
    // notes rather than closing the release behind the reader.
    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();
    expect(find.text('The big one'), findsOneWidget);
    expect(locationOf(page.router), '/releases/octo/app/42');
  });

  testWidgets('every way out of a release screen goes home', (tester) async {
    final page = await pumpReleaseRoutes(
      tester,
      handlers: {
        'GET api/releases/octo/app/42': () =>
            BackendResult(statusCode: 200, data: releaseJson()),
      },
    );
    // Back from a release leaves releases altogether: the reader is finished
    // with it, so the Timeline is what remains rather than a stack of pages.
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.text('Timeline destination'), findsOneWidget);
    expect(locationOf(page.router), '/timeline');
    expect(
      Navigator.of(tester.element(find.text('Timeline destination'))).canPop(),
      isFalse,
    );
  });

  testWidgets('a release that failed offers one retry', (tester) async {
    final mounted = await pumpReleaseRoutes(
      tester,
      handlers: {
        'GET api/releases/octo/app/42': () => const BackendResult(
          statusCode: 404,
          problem: BackendProblem.unavailable,
        ),
      },
    );
    expect(
      find.text(
        'This release is unavailable or is not accessible to this account.',
      ),
      findsOneWidget,
    );
    expect(find.widgetWithText(GitPulseButton, 'Retry'), findsOneWidget);
    mounted.session.handlers['GET api/releases/octo/app/42'] = () =>
        BackendResult(statusCode: 200, data: releaseJson(name: 'Late arrival'));
    await tester.tap(find.text('Retry'));
    await tester.pumpAndSettle();
    expect(find.text('Late arrival'), findsOneWidget);
  });

  testWidgets('a changed account leaves the screen it can no longer show', (
    tester,
  ) async {
    final page = await pumpReleaseRoutes(
      tester,
      handlers: {
        'GET api/releases/octo/app/42': () =>
            BackendResult(statusCode: 200, data: releaseJson()),
      },
    );
    page.session.emit(SessionState(phase: SessionPhase.restoring));
    await tester.pumpAndSettle();
    expect(find.byType(ReleaseScreen), findsNothing);
    expect(locationOf(page.router), '/timeline');
  });
}
