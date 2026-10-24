import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/l10n/generated/app_localizations.dart';
import 'package:gitpulse/repositories/repository_screen.dart';
import 'package:gitpulse/session/gitpulse_http.dart';
import 'package:gitpulse/session/native_login_handoff.dart';
import 'package:gitpulse/session/session_controller.dart';
import 'package:gitpulse/timeline/release_timeline_card.dart';

import '../releases/release_drawer_test.dart' show browsingHandlers;
import '../releases/release_detail_service_test.dart' show releaseDetailJson;
import '../releases/repository_releases_service_test.dart'
    show listReleaseJson, releaseListJson;
import '../timeline/timeline_screen_test.dart' show pumpTimelineScreen;
import '../timeline/timeline_test_support.dart';

Map<String, Object?> repositoryJson() => {
  'id': 123,
  'node_id': 'R_project',
  'name': 'project',
  'owner': {'login': 'canonical'},
  'description': 'A useful project',
  'default_branch': 'main',
  'stargazers_count': 125,
  'forks_count': 7,
  'subscribers_count': 4,
  'watchers_count': 125,
  'language': 'Dart',
};

Future<FakeSessionController> pumpRepository(
  WidgetTester tester, {
  Map<String, FutureOr<BackendResult> Function()> handlers = const {},
  Future<bool> Function(Uri)? launchBrowser,
  Size size = const Size(800, 600),
  TextScaler textScaler = TextScaler.noScaling,
}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final session =
      FakeSessionController(
          SessionState(
            phase: SessionPhase.signedIn,
            identity: signedInIdentity(),
          ),
        )
        ..handlers.addAll({
          'GET api/repos/octo/app': () =>
              BackendResult(statusCode: 200, data: repositoryJson()),
          'GET api/repos/canonical/project/readme?ref=main': () =>
              const BackendResult(
                statusCode: 200,
                data: {
                  'content': '# Project guide\n\nWelcome to this project.',
                  'path': 'docs/README.md',
                },
              ),
          ...handlers,
        });
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        sessionControllerProvider.overrideWith(() => session),
        if (launchBrowser != null)
          browserLauncherProvider.overrideWithValue(launchBrowser),
      ],
      child: MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(textScaler: textScaler),
          child: child!,
        ),
        home: const RepositoryScreen(owner: 'octo', repository: 'app'),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return session;
}

void main() {
  testWidgets(
    'switching accounts while a repository covers a release removes the previous account drawer',
    (tester) async {
      final mounted = await pumpTimelineScreen(
        tester,
        size: const Size(1200, 1000),
        handlers: {
          ...browsingHandlers(),
          'GET api/repos/canonical/project': () =>
              BackendResult(statusCode: 200, data: repositoryJson()),
          'GET api/repos/canonical/project/readme?ref=main': () =>
              const BackendResult(
                statusCode: 200,
                data: {'content': null, 'path': null},
              ),
        },
      );
      await tester.tap(find.byType(ReleaseTimelineCard));
      await tester.pumpAndSettle();
      await tester.tap(find.text('canonical/project'));
      await tester.pumpAndSettle();
      mounted.session.emit(
        SessionState(
          phase: SessionPhase.signedIn,
          identity: signedInIdentity(login: 'another-account'),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('release-drawer')), findsNothing);
      expect(find.byType(ReleaseTimelineCard), findsWidgets);
      expect(
        Navigator.of(tester.element(find.byType(ReleaseTimelineCard).first))
            .canPop(),
        isFalse,
      );
    },
  );
  testWidgets(
    'README relative links use the returned branch and directory and supported links stay native',
    (tester) async {
      final launched = <Uri>[];
      await pumpRepository(
        tester,
        launchBrowser: (uri) async {
          launched.add(uri);
          return true;
        },
        handlers: {
          'GET api/repos/octo/app': () => BackendResult(
            statusCode: 200,
            data: {...repositoryJson(), 'default_branch': 'docs/current'},
          ),
          'GET api/repos/canonical/project/readme?ref=docs%2Fcurrent': () =>
              const BackendResult(
                statusCode: 200,
                data: {
                  'path': 'docs/README.md',
                  'content': '''
[Guide](../guide.md)

[Issue](https://github.com/canonical/project/issues/1)

[Other project](https://github.com/other/tool)

[All versions](https://github.com/canonical/project/releases)

[Release notes](https://github.com/canonical/project/releases/tag/v2)
''',
                },
              ),
          'GET api/repos/other/tool': () => BackendResult(
            statusCode: 200,
            data: {
              ...repositoryJson(),
              'name': 'tool',
              'owner': {'login': 'other'},
              'description': 'Another project',
            },
          ),
          'GET api/releases/canonical/project?page=1&per_page=20': () =>
              BackendResult(
                statusCode: 200,
                data: releaseListJson([listReleaseJson(42, 'v2')]),
              ),
          'GET api/releases/canonical/project/by-tag?tag=v2': () =>
              BackendResult(
                statusCode: 200,
                data: {
                  ...releaseDetailJson(tag: 'v2'),
                  'name': 'README release notes',
                },
              ),
        },
      );
      Future<void> tapLink(String label) async {
        final link = find.text(label, findRichText: true);
        await tester.ensureVisible(link);
        await tester.tapAt(tester.getTopLeft(link) + const Offset(10, 8));
        await tester.pumpAndSettle();
      }

      await tapLink('Guide');
      expect(
        launched.single.toString(),
        'https://github.com/canonical/project/blob/docs%2Fcurrent/guide.md',
      );
      await tapLink('Issue');
      expect(
        launched.last.toString(),
        'https://github.com/canonical/project/issues/1',
      );
      await tapLink('Other project');
      expect(find.text('Another project'), findsOneWidget);
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      await tapLink('All versions');
      expect(find.text('v2'), findsOneWidget);
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      await tapLink('Release notes');
      expect(find.text('README release notes'), findsOneWidget);
      await tester.sendKeyEvent(LogicalKeyboardKey.escape);
      await tester.pumpAndSettle();
      expect(find.text('A useful project'), findsOneWidget);
      expect(launched.length, 2);
      expect(tester.takeException(), isNull);
    },
  );

  for (final (response, message) in [
    (
      const BackendResult(statusCode: 404, problem: BackendProblem.unavailable),
      'This repository is unavailable or is not accessible to this account.',
    ),
    (
      const BackendResult(
        statusCode: 403,
        problem: BackendProblem.repositoryPermission,
      ),
      'This account does not have permission to read this repository content.',
    ),
    (
      const BackendResult(problem: BackendProblem.network),
      'Could not reach the GitPulse backend. Check your connection, then retry.',
    ),
    (
      const BackendResult(statusCode: 429, problem: BackendProblem.rateLimited),
      'The server is rate limiting requests. Try again shortly.',
    ),
    (
      const BackendResult(statusCode: 200, data: {'name': 'broken'}),
      'Could not load repository content. Try again.',
    ),
  ]) {
    testWidgets('repository failure is explicit and retryable: $message', (
      tester,
    ) async {
      final session = await pumpRepository(
        tester,
        handlers: {'GET api/repos/octo/app': () => response},
      );
      expect(find.text(message), findsOneWidget);
      final pending = Completer<BackendResult>();
      session.handlers['GET api/repos/octo/app'] = () => pending.future;
      await tester.tap(find.text('Retry'));
      await tester.pump();
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      pending.complete(BackendResult(statusCode: 200, data: repositoryJson()));
      await tester.pumpAndSettle();
      expect(find.text('A useful project'), findsOneWidget);
    });
  }

  testWidgets('in-flight README from a previous account cannot reappear', (
    tester,
  ) async {
    final session = await pumpRepository(tester);
    final pending = Completer<BackendResult>();
    session.handlers['GET api/repos/canonical/project/readme?ref=main'] = () =>
        pending.future;
    session.emit(
      SessionState(
        phase: SessionPhase.signedIn,
        identity: signedInIdentity(login: 'other'),
      ),
    );
    await tester.pump();
    session.emit(const SessionState(phase: SessionPhase.signedOut));
    await tester.pumpAndSettle();
    expect(find.text('A useful project'), findsNothing);
    pending.complete(
      const BackendResult(
        statusCode: 200,
        data: {'content': 'Private old README', 'path': 'README.md'},
      ),
    );
    await tester.pumpAndSettle();
    expect(
      find.textContaining('Private old README', findRichText: true),
      findsNothing,
    );
  });
  testWidgets(
    'README permission errors retry independently and empty content is explicit',
    (tester) async {
      final session = await pumpRepository(
        tester,
        handlers: {
          'GET api/repos/canonical/project/readme?ref=main': () =>
              const BackendResult(
                statusCode: 403,
                problem: BackendProblem.repositoryPermission,
              ),
        },
      );
      expect(find.text('A useful project'), findsOneWidget);
      expect(
        find.text(
          'This account does not have permission to read this repository content.',
        ),
        findsOneWidget,
      );
      final pending = Completer<BackendResult>();
      session.handlers['GET api/repos/canonical/project/readme?ref=main'] =
          () => pending.future;
      await tester.tap(find.text('Retry'));
      await tester.pump();
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(find.text('A useful project'), findsOneWidget);
      pending.complete(
        const BackendResult(
          statusCode: 200,
          data: {'content': '', 'path': null},
        ),
      );
      await tester.pumpAndSettle();
      expect(
        find.text('This repository has no README content.'),
        findsOneWidget,
      );
    },
  );
  testWidgets(
    'repository API renders the identity band, the data line and the README',
    (tester) async {
      final semantics = tester.ensureSemantics();
      await pumpRepository(tester);
      // The identity is one selectable name: the owner muted, the repository's
      // own name carrying the weight.
      expect(
        find.textContaining('canonical/project', findRichText: true),
        findsOneWidget,
      );
      expect(find.text('A useful project'), findsOneWidget);
      // The data line shows values under glyphs; the nouns a reader would
      // otherwise read five times survive only where a screen reader hears them.
      expect(find.text('Dart'), findsOneWidget);
      expect(find.text('125'), findsOneWidget);
      expect(find.text('7'), findsOneWidget);
      expect(find.text('4'), findsOneWidget);
      expect(find.bySemanticsLabel(RegExp('Stars: 125')), findsOneWidget);
      expect(find.bySemanticsLabel(RegExp('Forks: 7')), findsOneWidget);
      expect(find.bySemanticsLabel(RegExp('Watchers: 4')), findsOneWidget);
      // The README band names the revision and the file, then renders it.
      expect(find.text('main · docs/README.md'), findsOneWidget);
      expect(
        find.bySemanticsLabel(RegExp('Default branch: main')),
        findsOneWidget,
      );
      expect(
        find.textContaining('Welcome to this project.', findRichText: true),
        findsOneWidget,
      );
      expect(find.text('Repository releases'), findsOneWidget);
      semantics.dispose();
    },
  );

  testWidgets(
    'the bar above the identity carries navigation and no page title',
    (tester) async {
      await pumpRepository(tester);
      // The band below already names the page, so the bar renders no title.
      expect(tester.widget<AppBar>(find.byType(AppBar)).title, isNull);
      expect(find.byType(BackButton), findsOneWidget);
      expect(find.byTooltip('Home'), findsOneWidget);
    },
  );

  testWidgets('the identity band wraps inside a phone at a large text scale', (
    tester,
  ) async {
    await pumpRepository(
      tester,
      size: const Size(360, 740),
      textScaler: const TextScaler.linear(1.8),
    );
    expect(tester.takeException(), isNull);
    expect(find.text('A useful project'), findsOneWidget);
    expect(find.text('Repository releases'), findsOneWidget);
  });

  for (final (size, left) in [
    // A 1440 window centres the 960-wide page, which pads its own 16 inside.
    (const Size(1440, 900), 240.0 + 16),
    // A phone has nowhere to centre: the page starts at the shared gutter.
    (const Size(360, 740), 16.0),
  ]) {
    testWidgets('the page holds one reading measure at ${size.width}', (
      tester,
    ) async {
      await pumpRepository(tester, size: size);
      final header = tester.getRect(find.text('main · docs/README.md'));
      expect(header.left, closeTo(left, 1));
      expect(header.right, closeTo(size.width - left, 1));
    });
  }

  testWidgets(
    'repository and its releases return to the original release and timeline',
    (tester) async {
      await pumpTimelineScreen(
        tester,
        size: const Size(1200, 1000),
        handlers: {
          ...browsingHandlers(),
          'GET api/repos/canonical/project': () =>
              BackendResult(statusCode: 200, data: repositoryJson()),
          'GET api/repos/canonical/project/readme?ref=main': () =>
              const BackendResult(
                statusCode: 200,
                data: {'content': null, 'path': null},
              ),
          'GET api/releases/canonical/project?page=1&per_page=20': () =>
              BackendResult(
                statusCode: 200,
                data: releaseListJson([listReleaseJson(42, 'v2/rc')]),
              ),
        },
      );
      final card = find.byType(ReleaseTimelineCard);
      final position = tester.getTopLeft(card);
      await tester.tap(card);
      await tester.pumpAndSettle();
      expect(find.text('Entry notes'), findsOneWidget);
      await tester.tap(find.text('canonical/project'));
      await tester.pumpAndSettle();
      expect(find.text('A useful project'), findsOneWidget);
      expect(
        find.text('This repository has no README content.'),
        findsOneWidget,
      );
      await tester.tap(find.text('Repository releases'));
      await tester.pumpAndSettle();
      expect(find.text('v2/rc'), findsOneWidget);
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      expect(find.text('A useful project'), findsOneWidget);
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      expect(find.text('Entry notes'), findsOneWidget);
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(tester.getTopLeft(card), position);
    },
  );
}
