import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:gitpulse/l10n/generated/app_localizations.dart';
import 'package:gitpulse/presentation/gitpulse_buttons.dart';
import 'package:gitpulse/presentation/gitpulse_theme.dart';
import 'package:gitpulse/presentation/gitpulse_swipe.dart';
import 'package:gitpulse/presentation/gitpulse_tokens.dart';
import 'package:gitpulse/releases/release_assets_screen.dart';
import 'package:gitpulse/releases/release_navigation.dart';
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
///
/// The mount starts on the Timeline stand-in and enters the release through the
/// same call the shell makes, because a release opening begins at that step: a
/// test that landed on a release screen directly would be testing a state the
/// app never produces. [initialLocation] overrides that for the screens that are
/// reached some other way — a release's files opened by address, say.
Future<({FakeSessionController session, GoRouter router})> pumpReleaseRoutes(
  WidgetTester tester, {
  required Map<String, FutureOr<BackendResult> Function()> handlers,
  String? initialLocation,
  Future<bool> Function(Uri)? launchBrowser,
}) async {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final session = FakeSessionController(
    SessionState(phase: SessionPhase.signedIn, identity: signedInIdentity()),
  )..handlers.addAll(handlers);
  final router = GoRouter(
    initialLocation: initialLocation ?? '/releases/octo/app/42',
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
          tag: state.uri.queryParameters['tag'],
        ),
        routes: [
          GoRoute(
            path: 'assets',
            builder: (_, state) => ReleaseAssetsScreen(
              owner: state.pathParameters['owner']!,
              repository: state.pathParameters['repository']!,
              id: int.tryParse(state.pathParameters['id']!),
              tag: state.uri.queryParameters['tag'],
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
  if (initialLocation == null) {
    // Enter the release the way the shell does, so the opening this feature
    // keeps has an entry release to step back to.
    final container = ProviderScope.containerOf(
      tester.element(find.byType(ReleaseScreen)),
    );
    container.read(releaseOpeningProvider.notifier).start((
      owner: 'octo',
      repository: 'app',
      id: 42,
      tag: null,
    ));
    await tester.pumpAndSettle();
  }
  return (session: session, router: router);
}

String locationOf(GoRouter router) =>
    Uri.decodeFull(router.state.uri.toString());

void main() {
  // The probe is shared between tests: a document mounted by one case would
  // answer a link opened by the next one. Each case starts from none.
  setUp(() => mountedDocument = null);

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

  testWidgets('a swipe over the release opens the repository’s releases', (
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
    // The gesture is offered over the header, and the notes report their own
    // flick rather than being covered: a layer over the document would take its
    // own scrolling with it. What the page owes is both wires.
    expect(find.byType(GitPulseSwipe), findsOneWidget);
    await tester.fling(find.text('octocat'), const Offset(-300, 0), 1000);
    await tester.pumpAndSettle();
    expect(find.byType(RepositoryReleasesPage), findsOneWidget);
    expect(locationOf(page.router), '/releases/octo/app');
  });

  testWidgets('a flick the notes report opens the repository’s releases', (
    tester,
  ) async {
    final page = await pumpReleaseRoutes(
      tester,
      handlers: {
        'GET api/releases/octo/app?page=1&per_page=20': () => BackendResult(
          statusCode: 200,
          data: releaseListJson([listReleaseJson(42, 'v1.0.0')]),
        ),
        'GET api/releases/octo/app/42': () => BackendResult(
          statusCode: 200,
          data: releaseJson(body: 'Ready to use.'),
        ),
      },
    );
    // The document is a platform view, so it reads the flick itself and reports
    // it. This is the report, arriving through the same bridge a link does.
    mountedDocument!.bridge.swipe(true);
    await tester.pumpAndSettle();
    expect(find.byType(RepositoryReleasesPage), findsOneWidget);
    expect(locationOf(page.router), '/releases/octo/app');
  });

  testWidgets('the list has a labelled action of its own', (tester) async {
    final page = await pumpReleaseRoutes(
      tester,
      handlers: {
        'GET api/releases/octo/app?page=1&per_page=20': () => BackendResult(
          statusCode: 200,
          data: releaseListJson([listReleaseJson(42, 'v1.0.0')]),
        ),
        'GET api/releases/octo/app/42': () =>
            BackendResult(statusCode: 200, data: releaseJson()),
      },
    );
    // The swipe is a shortcut, never the only way: the bar names the same
    // destination in words.
    await tester.tap(find.byKey(const Key('release-open-list')));
    await tester.pumpAndSettle();
    expect(find.byType(RepositoryReleasesPage), findsOneWidget);
    expect(locationOf(page.router), '/releases/octo/app');
  });

  testWidgets('a link to another release steps back to the Entry Release', (
    tester,
  ) async {
    final page = await pumpReleaseRoutes(
      tester,
      handlers: {
        'GET api/releases/octo/app/42': () => BackendResult(
          statusCode: 200,
          data: releaseJson(name: 'Entry notes', body: 'Entry body'),
        ),
        'GET api/releases/octo/app/by-tag?tag=v2%2Frc': () => BackendResult(
          statusCode: 200,
          data: {
            ...releaseJson(
              name: 'Other notes',
              body: 'Other body',
              tag: 'v2/rc',
            ),
            'id': 43,
            'html_url': 'https://github.com/octo/app/releases/tag/v2/rc',
          },
        ),
      },
    );
    await mountedDocument!.bridge.open(
      'https://github.com/octo/app/releases/tag/v2/rc',
    );
    await tester.pumpAndSettle();
    expect(find.text('Other notes'), findsOneWidget);
    // A release named by its tag still takes a segment of its own: the list
    // address is `/releases/:owner/:repository`, so a tag in the query alone
    // would land on the list.
    expect(locationOf(page.router), '/releases/octo/app/v2/rc?tag=v2/rc');

    // A release the reader reached from another one steps back to the release
    // they entered through, not to the Timeline and not to a ladder of every
    // release they glanced at.
    expect(find.byKey(const Key('release-back-to-entry')), findsOneWidget);
    await tester.tap(find.byKey(const Key('release-back-to-entry')));
    await tester.pumpAndSettle();
    expect(find.text('Entry notes'), findsOneWidget);
    expect(locationOf(page.router), '/releases/octo/app/42');
    expect(find.byKey(const Key('release-back-to-entry')), findsNothing);
  });

  testWidgets('Back on another release returns to the Entry Release first', (
    tester,
  ) async {
    final page = await pumpReleaseRoutes(
      tester,
      handlers: {
        'GET api/releases/octo/app/42': () => BackendResult(
          statusCode: 200,
          data: releaseJson(name: 'Entry notes'),
        ),
        'GET api/releases/octo/app/by-tag?tag=v2%2Frc': () => BackendResult(
          statusCode: 200,
          data: {
            ...releaseJson(name: 'Other notes', tag: 'v2/rc'),
            'id': 43,
            'html_url': 'https://github.com/octo/app/releases/tag/v2/rc',
          },
        ),
      },
    );
    await mountedDocument!.bridge.open(
      'https://github.com/octo/app/releases/tag/v2/rc',
    );
    await tester.pumpAndSettle();
    expect(find.text('Other notes'), findsOneWidget);

    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(locationOf(page.router), '/releases/octo/app/42');
    expect(find.text('Entry notes'), findsOneWidget);

    // The entry release is the one place closing leaves releases altogether.
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(locationOf(page.router), '/timeline');
  });

  testWidgets('the list steps back to the Entry Release, not the Timeline', (
    tester,
  ) async {
    final page = await pumpReleaseRoutes(
      tester,
      handlers: {
        'GET api/releases/octo/app?page=1&per_page=20': () => BackendResult(
          statusCode: 200,
          data: releaseListJson([listReleaseJson(42, 'v1.0.0')]),
        ),
        'GET api/releases/octo/app/42': () => BackendResult(
          statusCode: 200,
          data: releaseJson(name: 'Entry notes', author: {'login': 'octocat'}),
        ),
      },
    );
    await tester.fling(find.text('octocat'), const Offset(-300, 0), 1000);
    await tester.pumpAndSettle();
    expect(find.byType(RepositoryReleasesPage), findsOneWidget);

    // The list was reached from a release, so leaving it is a step back to that
    // release — and only leaving the release itself goes home.
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.text('Entry notes'), findsOneWidget);
    expect(locationOf(page.router), '/releases/octo/app/42');

    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(locationOf(page.router), '/timeline');
  });

  testWidgets('a release opened from the list keeps the list’s entry release', (
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
          data: releaseJson(name: 'Entry notes', author: {'login': 'octocat'}),
        ),
        'GET api/releases/octo/app/43': () => BackendResult(
          statusCode: 200,
          data: {
            // The list row names release 43; the detail the app loads back must
            // be the same release, or the screen rejects it as a mismatch.
            ...releaseJson(name: 'Other notes'),
            'id': 43,
            'html_url': 'https://github.com/octo/app/releases/tag/v1.0.0',
          },
        ),
      },
    );
    await tester.fling(find.text('octocat'), const Offset(-300, 0), 1000);
    await tester.pumpAndSettle();
    await tester.tap(find.text('v0.9.0'));
    await tester.pumpAndSettle();
    expect(find.text('Other notes'), findsOneWidget);

    // A release opened from the list is another release of the same opening: the
    // screen offers the step back to the Entry Release the reader came in
    // through, and the list is not where that step leads.
    expect(find.byKey(const Key('release-back-to-entry')), findsOneWidget);
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.text('Entry notes'), findsOneWidget);
    expect(locationOf(page.router), '/releases/octo/app/42');
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
