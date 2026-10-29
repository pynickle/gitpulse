import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/follows/release_follows_session.dart';
import 'package:gitpulse/presentation/gitpulse_buttons.dart';
import 'package:gitpulse/presentation/gitpulse_icon_action.dart';
import 'package:gitpulse/presentation/gitpulse_progress.dart';
import 'package:gitpulse/l10n/generated/app_localizations.dart';
import 'package:gitpulse/presentation/gitpulse_avatar.dart';
import 'package:gitpulse/presentation/gitpulse_preset.dart';
import 'package:gitpulse/presentation/gitpulse_theme.dart';
import 'package:gitpulse/repositories/repository_screen.dart';
import 'package:gitpulse/repositories/repository_share.dart';
import 'package:gitpulse/releases/document_web_view.dart';

import '../support/document_viewer.dart';

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

const _ownerAvatar = 'https://avatars.githubusercontent.com/u/583231?v=4';

Map<String, Object?> repositoryJson() => {
  'id': 123,
  'node_id': 'R_project',
  'name': 'project',
  'owner': {'login': 'canonical', 'avatar_url': _ownerAvatar},
  'description': 'A useful project',
  'default_branch': 'main',
  'stargazers_count': 125,
  'forks_count': 7,
  'subscribers_count': 4,
  'watchers_count': 125,
  'language': 'Dart',
};

const _releasesKey = ValueKey('repository-releases');
const _followKey = ValueKey('repository-follow');
const _shareKey = ValueKey('repository-share');
const _ownerKey = ValueKey('repository-owner');
const _nameKey = ValueKey('repository-name');
const _descriptionKey = ValueKey('repository-description');

/// Records what the app hands the clipboard, so a share that falls back to
/// copying can be read back the way a reader would paste it.
List<String> captureClipboard(WidgetTester tester) {
  final copied = <String>[];
  final messenger = tester.binding.defaultBinaryMessenger;
  messenger.setMockMethodCallHandler(SystemChannels.platform, (call) async {
    if (call.method == 'Clipboard.setData') {
      copied.add((call.arguments as Map)['text']! as String);
    }
    return null;
  });
  addTearDown(
    () => messenger.setMockMethodCallHandler(SystemChannels.platform, null),
  );
  return copied;
}

Future<FakeSessionController> pumpRepository(
  WidgetTester tester, {
  Map<String, FutureOr<BackendResult> Function()> handlers = const {},
  Map<String, Object?>? repository,
  List<Map<String, Object?>> follows = const [],
  Future<bool> Function(Uri)? launchBrowser,
  RepositorySharer? share,
  ThemeData? theme,
  Locale? locale,
  Size size = const Size(800, 600),
  TextScaler textScaler = TextScaler.noScaling,
}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final session = FakeSessionController(
    SessionState(phase: SessionPhase.signedIn, identity: signedInIdentity()),
  );
  final payload = {...repositoryJson(), ...?repository};
  session.handlers.addAll({
    // The Release Follows the account has already confirmed: the repository
    // page reads the shared session rather than a follow state of its own.
    'GET api/settings': () =>
        BackendResult(statusCode: 200, data: settingsJson(follows)),
    'PUT api/settings': () => BackendResult(
      statusCode: 200,
      data: {
        'followedRepositories':
            (session.bodies['PUT api/settings']
                as Map?)?['followedRepositories'] ??
            const <Object?>[],
      },
    ),
    'GET api/repos/octo/app': () =>
        BackendResult(statusCode: 200, data: payload),
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
        ...documentViewerOverrides(),
        if (launchBrowser != null)
          browserLauncherProvider.overrideWithValue(launchBrowser),
        if (share != null) repositorySharerProvider.overrideWithValue(share),
      ],
      child: MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        locale: locale,
        theme: theme,
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

ReleaseFollowsSession readFollows(WidgetTester tester) =>
    ProviderScope.containerOf(tester.element(find.byType(RepositoryScreen)))
        .read(releaseFollowsSessionProvider.notifier);

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
              'node_id': 'R_tool',
              'name': 'tool',
              'owner': {'login': 'other', 'avatar_url': _ownerAvatar},
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
      // A link in the README is the page's report to the app: the address the
      // author wrote is resolved against the revision and directory the document
      // was read from, and the app decides where it goes.
      Future<void> followLink(String href) async {
        final address = mountedDocument!.bridge.resolve([
          DocumentResourceTarget(value: href, image: false),
        ]);
        expect(address.single, isNotNull, reason: href);
        unawaited(mountedDocument!.bridge.open(address.single!));
        await tester.pumpAndSettle();
      }

      await followLink('../guide.md');
      expect(
        launched.single.toString(),
        'https://github.com/canonical/project/blob/docs%2Fcurrent/guide.md',
      );
      await followLink('https://github.com/canonical/project/issues/1');
      expect(
        launched.last.toString(),
        'https://github.com/canonical/project/issues/1',
      );
      await followLink('https://github.com/other/tool');
      expect(find.text('Another project'), findsOneWidget);
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      await followLink('https://github.com/canonical/project/releases');
      expect(find.text('v2'), findsOneWidget);
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      await followLink('https://github.com/canonical/project/releases/tag/v2');
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
    (
      // Without GitHub's own identifier there is no identity to write a Release
      // Follow against, so the page reports the payload instead of guessing one.
      const BackendResult(statusCode: 200, data: {'name': 'project'}),
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
      expect(find.byType(GitPulseProgressPage), findsOneWidget);
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
      expect(find.byType(GitPulseProgressPage), findsOneWidget);
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
      // The identity is the owner above the repository's own name, each on its
      // own line, with the owner's picture beside them.
      expect(find.text('canonical'), findsOneWidget);
      expect(find.text('project'), findsOneWidget);
      expect(
        tester.widget<GitPulseAvatar>(find.byType(GitPulseAvatar)).url,
        _ownerAvatar,
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
      expect(find.text('Releases'), findsOneWidget);
      semantics.dispose();
    },
  );

  testWidgets(
    'the owner line, the repository name and the description are set apart',
    (tester) async {
      // The app's own theme: the page's type is the preset's type table, so a
      // screen judged under a bare Material theme would be measured against
      // Material's sizes instead of GitPulse's.
      await pumpRepository(
        tester,
        size: const Size(390, 844),
        theme: gitPulseTheme(Brightness.light),
      );
      final owner = tester.getRect(find.byKey(_ownerKey));
      final name = tester.getRect(find.byKey(_nameKey));
      final description = tester.getRect(find.byKey(_descriptionKey));
      // Two identity lines, the owner first, the repository under it — not one
      // name with the owner's slash through it.
      expect(owner.bottom, lessThanOrEqualTo(name.top));
      expect(name.left, closeTo(owner.left, 0.5));
      expect(description.top, greaterThanOrEqualTo(name.bottom));
      // 14 for who owns it, 22 half-bold for which repository, 14 for what it is.
      expect(tester.widget<Text>(find.byKey(_ownerKey)).style?.fontSize, 14);
      final title = tester.widget<SelectableText>(find.byKey(_nameKey));
      expect(title.style?.fontSize, gitPulseTypeTable.headlineSmall.size);
      expect(title.style?.fontSize, 22);
      expect(title.style?.fontWeight, FontWeight.w600);
      expect(
        tester.widget<Text>(find.byKey(_descriptionKey)).style?.fontSize,
        14,
      );
    },
  );

  testWidgets('a long repository name wraps in full instead of shrinking away', (
    tester,
  ) async {
    const longName = 'gitzilla-release-notification-and-changelog-service';
    await pumpRepository(
      tester,
      size: const Size(360, 740),
      repository: {'name': longName},
      theme: gitPulseTheme(Brightness.light),
    );
    expect(find.text(longName), findsOneWidget);
    final title = tester.widget<SelectableText>(find.byKey(_nameKey));
    // Nothing is dropped and nothing is scaled down to fit: the name takes the
    // lines it needs.
    expect(title.maxLines, isNull);
    expect(title.style?.fontSize, gitPulseTypeTable.headlineSmall.size);
    expect(
      tester.getSize(find.byKey(_nameKey)).height,
      greaterThan(gitPulseTypeTable.headlineSmall.size * 1.5),
    );
    expect(tester.takeException(), isNull);
  });

  for (final size in [const Size(360, 740), const Size(1440, 900)]) {
    testWidgets('releases, follow and share hold one row at ${size.width}', (
      tester,
    ) async {
      final semantics = tester.ensureSemantics();
      await pumpRepository(tester, size: size);
      final releases = tester.getRect(find.byKey(_releasesKey));
      final follow = tester.getRect(find.byKey(_followKey));
      final share = tester.getRect(find.byKey(_shareKey));
      expect(follow.center.dy, closeTo(releases.center.dy, 1));
      expect(share.center.dy, closeTo(releases.center.dy, 1));
      // The release list is the primary action: it takes the row's spare width.
      expect(releases.width, greaterThan(follow.width));
      // Every action stays inside the window and can be pressed.
      expect(share.right, lessThanOrEqualTo(size.width));
      for (final key in [_releasesKey, _followKey, _shareKey]) {
        expect(find.byKey(key).hitTestable(), findsOneWidget);
      }
      expect(find.byTooltip('Follow releases'), findsOneWidget);
      expect(find.byTooltip('Share'), findsOneWidget);
      // The shortcut on the row keeps the destination's whole name for a screen
      // reader, so shortening it costs nothing but ink.
      expect(find.bySemanticsLabel('Repository releases'), findsOneWidget);
      expect(
        tester
            .renderObject<RenderParagraph>(find.text('Releases'))
            .didExceedMaxLines,
        isFalse,
      );
      semantics.dispose();
    });
  }

  testWidgets(
    'following from the page writes the shared follow set and shows the bookmark',
    (tester) async {
      final session = await pumpRepository(tester);
      expect(find.byTooltip('Follow releases'), findsOneWidget);
      await tester.tap(find.byKey(_followKey));
      await tester.pumpAndSettle();
      expect(session.bodies['PUT api/settings'], {
        'followedRepositories': [
          {'id': 'R_project', 'owner': 'canonical', 'name': 'project'},
        ],
      });
      // One follow set: the session the Follows page renders now holds it too.
      expect(readFollows(tester).state.repositories.single.id, 'R_project');
      expect(find.byTooltip('Unfollow'), findsOneWidget);
      expect(find.byTooltip('Follow releases'), findsNothing);
      // The Release Follow is a bookmark of this app, never a GitHub star or
      // watch: nothing under the repository was written on GitHub.
      expect(session.requests.where((request) => request.startsWith('PUT')), [
        'PUT api/settings',
      ]);
    },
  );

  testWidgets('an already followed repository is unfollowed from the page', (
    tester,
  ) async {
    final session = await pumpRepository(
      tester,
      follows: [
        {'id': 'R_project', 'owner': 'canonical', 'name': 'project'},
      ],
    );
    expect(find.byTooltip('Unfollow'), findsOneWidget);
    await tester.tap(find.byKey(_followKey));
    await tester.pumpAndSettle();
    expect(session.bodies['PUT api/settings'], {
      'followedRepositories': <Object?>[],
    });
    expect(readFollows(tester).state.repositories, isEmpty);
    expect(find.byTooltip('Follow releases'), findsOneWidget);
  });

  testWidgets(
    'a follow the backend refuses keeps the confirmed follow and reports it',
    (tester) async {
      final session = await pumpRepository(
        tester,
        follows: [
          {'id': 'R_project', 'owner': 'canonical', 'name': 'project'},
        ],
      );
      session.handlers['PUT api/settings'] = () =>
          const BackendResult(statusCode: 500);
      await tester.tap(find.byKey(_followKey));
      await tester.pumpAndSettle();
      expect(
        find.text(
          'Could not save Release Follows. Retry the action; your last confirmed list is still shown.',
        ),
        findsOneWidget,
      );
      // The confirmed list is unchanged, so the page still shows the repository
      // as followed.
      expect(readFollows(tester).state.repositories.single.id, 'R_project');
      expect(find.byTooltip('Unfollow'), findsOneWidget);
    },
  );

  testWidgets(
    'a follow list that could not be read is reported instead of read as unfollowed',
    (tester) async {
      await pumpRepository(
        tester,
        handlers: {
          'GET api/settings': () => const BackendResult(statusCode: 500),
        },
      );
      // The bookmark cannot say "not followed" about a list nobody could read,
      // so the page says what it could not read.
      expect(readFollows(tester).state.loaded, isFalse);
      expect(
        find.text(
          'Could not load repositories. Retry the search or reload follows.',
        ),
        findsOneWidget,
      );
    },
  );

  testWidgets('share hands the canonical GitHub link to the platform', (
    tester,
  ) async {
    final copied = captureClipboard(tester);
    final shared = <String>[];
    await pumpRepository(
      tester,
      share: (url) async {
        shared.add(url);
        return true;
      },
    );
    await tester.tap(find.byKey(_shareKey));
    await tester.pumpAndSettle();
    expect(shared, ['https://github.com/canonical/project']);
    expect(copied, isEmpty);
    expect(find.text('Link copied'), findsNothing);
  });

  testWidgets('a platform without a share sheet is given the link to copy', (
    tester,
  ) async {
    final copied = captureClipboard(tester);
    await pumpRepository(tester, share: (url) async => false);
    await tester.tap(find.byKey(_shareKey));
    await tester.pumpAndSettle();
    expect(copied, ['https://github.com/canonical/project']);
    expect(find.text('Link copied'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  for (final (brightness, locale) in [
    (Brightness.light, const Locale('en')),
    (Brightness.dark, const Locale('zh')),
  ]) {
    testWidgets(
      'the identity and its one action row hold in ${locale.languageCode} ${brightness.name}',
      (tester) async {
        final semantics = tester.ensureSemantics();
        await pumpRepository(
          tester,
          size: const Size(390, 844),
          theme: gitPulseTheme(brightness),
          locale: locale,
        );
        final chinese = locale.languageCode == 'zh';
        expect(tester.takeException(), isNull);
        expect(find.text('canonical'), findsOneWidget);
        expect(find.text('project'), findsOneWidget);
        expect(find.text(chinese ? '发布' : 'Releases'), findsOneWidget);
        // The actions keep one row and their names whatever the language.
        final releases = tester.getRect(find.byKey(_releasesKey));
        final follow = tester.getRect(find.byKey(_followKey));
        final share = tester.getRect(find.byKey(_shareKey));
        expect(follow.center.dy, closeTo(releases.center.dy, 1));
        expect(share.center.dy, closeTo(releases.center.dy, 1));
        expect(
          find.byTooltip(chinese ? '关注 Release' : 'Follow releases'),
          findsOneWidget,
        );
        expect(find.byTooltip(chinese ? '分享' : 'Share'), findsOneWidget);
        semantics.dispose();
      },
    );
  }

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
    expect(find.text('Releases'), findsOneWidget);
    // The three actions stay on the one row the reader was promised, at the
    // largest type this app expects to meet, and the primary action keeps its
    // name: what gives way is the row, never the destination.
    final releases = tester.getRect(find.byKey(_releasesKey));
    final follow = tester.getRect(find.byKey(_followKey));
    final share = tester.getRect(find.byKey(_shareKey));
    expect(follow.center.dy, closeTo(releases.center.dy, 1));
    expect(share.center.dy, closeTo(releases.center.dy, 1));
    expect(share.right, lessThanOrEqualTo(360));
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
      await tester.tap(find.byKey(_releasesKey));
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

  testWidgets(
    'the Repository page renders on the app’s faces and none of the replaced '
    'ones',
    (tester) async {
      await pumpRepository(tester, size: const Size(390, 844));

      final page = find.byType(RepositoryScreen);
      expect(page, findsOneWidget);
      // The action row is the app's own controls…
      expect(
        find.descendant(of: page, matching: find.byType(GitPulseButton)),
        findsWidgets,
      );
      expect(
        find.descendant(of: page, matching: find.byType(GitPulseIconAction)),
        findsWidgets,
      );
      // …and none of the Material faces this change replaced is left in it.
      for (final replaced in <Type>[
        FilledButton,
        OutlinedButton,
        TextButton,
        CircularProgressIndicator,
        LinearProgressIndicator,
        AlertDialog,
        Dialog,
      ]) {
        expect(
          find.descendant(of: page, matching: find.byType(replaced)),
          findsNothing,
          reason: '$replaced',
        );
      }
      // The one Material icon button left in the page is the platform's own
      // back affordance, which the app keeps as a Platform Dialect Exception.
      expect(
        find.descendant(of: page, matching: find.byType(IconButton)),
        findsOneWidget,
      );
      expect(
        find.descendant(
          of: find.byType(BackButton),
          matching: find.byType(IconButton),
        ),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
    },
  );
}
