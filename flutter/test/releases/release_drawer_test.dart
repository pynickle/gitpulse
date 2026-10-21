import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/session/gitpulse_http.dart';
import 'package:gitpulse/session/session_controller.dart';
import 'package:gitpulse/timeline/release_timeline_card.dart';
import 'package:gitpulse/timeline/timeline_layout.dart';

import '../timeline/timeline_screen_test.dart' show pumpTimelineScreen;
import '../timeline/timeline_test_support.dart';
import 'release_detail_service_test.dart' show releaseDetailJson;
import 'repository_releases_service_test.dart'
    show listReleaseJson, releaseListJson;

Map<String, FutureOr<BackendResult> Function()> browsingHandlers() => {
  'GET api/settings': () => BackendResult(
    statusCode: 200,
    data: settingsJson([followJson('R_app', 'octo', 'app')]),
  ),
  'POST api/release-timeline/refresh': () => BackendResult(
    statusCode: 200,
    data: roundJson(
      pages: {
        'R_app': pageJson('octo', 'app', [
          releaseJson(42, 'v2', '2026-10-17T12:00:00Z'),
        ]),
      },
    ),
  ),
  'GET api/releases/octo/app/42': () => BackendResult(
    statusCode: 200,
    data: {...releaseDetailJson(), 'name': 'Entry notes'},
  ),
};

/// The Repository Release List lives in the chrome line's icon slot, not in
/// the release body.
Future<void> openRepositoryReleases(
  WidgetTester tester, {
  bool settle = true,
}) async {
  await tester.tap(find.byTooltip('Repository releases'));
  if (settle) {
    await tester.pumpAndSettle();
  } else {
    await tester.pump();
  }
}

void main() {
  testWidgets(
    'a phone list retries the requested page and can advance past an empty page',
    (tester) async {
      final pending = Completer<BackendResult>();
      final mounted = await pumpTimelineScreen(
        tester,
        size: const Size(390, 844),
        handlers: {
          ...browsingHandlers(),
          'GET api/releases/canonical/project?page=1&per_page=20': () =>
              pending.future,
          'GET api/releases/canonical/project?page=2&per_page=20': () =>
              const BackendResult(
                statusCode: 403,
                problem: BackendProblem.repositoryPermission,
              ),
        },
      );
      await tester.tap(find.byType(ReleaseTimelineCard));
      await tester.pumpAndSettle();
      await openRepositoryReleases(tester, settle: false);
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      pending.complete(
        BackendResult(
          statusCode: 200,
          data: releaseListJson([
            listReleaseJson(42, 'entry-preview', prerelease: true),
            listReleaseJson(43, 'draft-preview', prerelease: true, draft: true),
          ], hasNext: true),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Prerelease'));
      await tester.pumpAndSettle();
      expect(find.text('entry-preview'), findsOneWidget);
      expect(find.text('draft-preview'), findsNothing);
      await tester.ensureVisible(find.byTooltip('Next page'));
      await tester.tap(find.byTooltip('Next page'));
      await tester.pumpAndSettle();
      expect(
        find.text(
          "This account does not have permission to read this repository's releases.",
        ),
        findsOneWidget,
      );
      mounted
              .session
              .handlers['GET api/releases/canonical/project?page=2&per_page=20'] =
          () => BackendResult(
            statusCode: 200,
            data: releaseListJson([], page: 2, hasNext: true),
          );
      await tester.ensureVisible(find.text('Retry'));
      await tester.tap(find.text('Retry'));
      await tester.pumpAndSettle();
      expect(find.text('No releases on this page.'), findsOneWidget);
      expect(find.text('Page 2'), findsOneWidget);
      mounted
              .session
              .handlers['GET api/releases/canonical/project?page=3&per_page=20'] =
          () => BackendResult(
            statusCode: 200,
            data: releaseListJson([
              listReleaseJson(40, 'older-preview', prerelease: true),
            ], page: 3),
          );
      await tester.ensureVisible(find.byTooltip('Next page'));
      await tester.tap(find.byTooltip('Next page'));
      await tester.pumpAndSettle();
      expect(find.text('older-preview'), findsOneWidget);
      await tester.ensureVisible(find.byTooltip('Previous page'));
      await tester.tap(find.byTooltip('Previous page'));
      await tester.pumpAndSettle();
      expect(find.text('Page 2'), findsOneWidget);
      expect(find.text('older-preview'), findsNothing);
      expect(tester.takeException(), isNull);
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('release-drawer')), findsNothing);
      expect(find.byType(ReleaseTimelineCard), findsOneWidget);
    },
  );

  testWidgets(
    'closing a loading list discards its response and reopening starts a new list',
    (tester) async {
      final pending = Completer<BackendResult>();
      final mounted = await pumpTimelineScreen(
        tester,
        size: const Size(1200, 900),
        handlers: {
          ...browsingHandlers(),
          'GET api/releases/canonical/project?page=1&per_page=20': () =>
              pending.future,
        },
      );
      await tester.tap(find.byType(ReleaseTimelineCard));
      await tester.pumpAndSettle();
      await openRepositoryReleases(tester, settle: false);
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      await tester.sendKeyEvent(LogicalKeyboardKey.escape);
      await tester.pumpAndSettle();
      mounted
              .session
              .handlers['GET api/releases/canonical/project?page=1&per_page=20'] =
          () => BackendResult(
            statusCode: 200,
            data: releaseListJson([listReleaseJson(43, 'Fresh opening')]),
          );
      await tester.tap(find.byType(ReleaseTimelineCard));
      await tester.pumpAndSettle();
      await openRepositoryReleases(tester);
      expect(find.text('Fresh opening'), findsOneWidget);
      pending.complete(
        BackendResult(
          statusCode: 200,
          data: releaseListJson([listReleaseJson(44, 'Obsolete opening')]),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Fresh opening'), findsOneWidget);
      expect(find.text('Obsolete opening'), findsNothing);
      final oldAccountPage = Completer<BackendResult>();
      await tester.tap(find.byTooltip('Close release details'));
      await tester.pumpAndSettle();
      mounted
              .session
              .handlers['GET api/releases/canonical/project?page=1&per_page=20'] =
          () => oldAccountPage.future;
      await tester.tap(find.byType(ReleaseTimelineCard));
      await tester.pumpAndSettle();
      await openRepositoryReleases(tester, settle: false);
      mounted.session.emit(
        SessionState(
          phase: SessionPhase.signedIn,
          identity: signedInIdentity(login: 'another-user'),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('release-drawer')), findsNothing);
      oldAccountPage.complete(
        BackendResult(
          statusCode: 200,
          data: releaseListJson([listReleaseJson(45, 'Old account')]),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Old account'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'repository browsing retains visited details, page and filter until close',
    (tester) async {
      final launched = <Uri>[];
      final mounted = await pumpTimelineScreen(
        tester,
        size: const Size(1200, 1000),
        launchBrowser: (uri) async {
          launched.add(uri);
          return true;
        },
        handlers: {
          'GET api/settings': () => BackendResult(
            statusCode: 200,
            data: settingsJson([followJson('R_app', 'octo', 'app')]),
          ),
          'POST api/release-timeline/refresh': () => BackendResult(
            statusCode: 200,
            data: roundJson(
              pages: {
                'R_app': pageJson('octo', 'app', [
                  releaseJson(42, 'v2', '2026-10-17T12:00:00Z'),
                ]),
              },
            ),
          ),
          'GET api/releases/octo/app/42': () => BackendResult(
            statusCode: 200,
            data: {...releaseDetailJson(), 'name': 'Entry notes'},
          ),
          'GET api/releases/canonical/project?page=1&per_page=20': () =>
              BackendResult(
                statusCode: 200,
                data: releaseListJson([
                  listReleaseJson(42, 'v2/rc', prerelease: true),
                  listReleaseJson(44, 'draft-v4', draft: true),
                ], hasNext: true),
              ),
          'GET api/releases/canonical/project?page=2&per_page=20': () =>
              BackendResult(
                statusCode: 200,
                data: releaseListJson([
                  listReleaseJson(45, 'older-stable'),
                  listReleaseJson(46, 'older-preview', prerelease: true),
                ], page: 2),
              ),
          'GET api/releases/canonical/project/45': () => BackendResult(
            statusCode: 200,
            data: {
              ...releaseDetailJson(id: 45, tag: 'older-stable'),
              'name': 'Other notes',
              'body': '[Another repository](https://github.com/other/tool/releases/tag/v1)',
            },
          ),
          'GET api/releases/other/tool/by-tag?tag=v1': () => BackendResult(
            statusCode: 200,
            data: {
              ...releaseDetailJson(id: 99, tag: 'v1'),
              'html_url': 'https://github.com/other/tool/releases/tag/v1',
              'name': 'Another repository notes',
            },
          ),
          'GET api/releases/other/tool?page=1&per_page=20': () => BackendResult(
            statusCode: 200,
            data: releaseListJson([
              listReleaseJson(99, 'another-repo-release'),
            ]),
          ),
        },
      );
      await tester.tap(find.byType(ReleaseTimelineCard));
      await tester.pumpAndSettle();
      // The chrome line names the Entry Release and offers no step that leads
      // back to where the reader already is.
      expect(find.text('v2/rc'), findsOneWidget);
      expect(find.text('canonical/project'), findsOneWidget);
      expect(find.byTooltip('Return to Entry Release'), findsNothing);
      await openRepositoryReleases(tester);
      // The chrome line owns the repository name and the list never repeats it.
      expect(find.text('canonical/project'), findsOneWidget);
      // The Entry Release marker is a leading accent, not a third meta line.
      expect(find.text('Entry Release'), findsNothing);
      expect(
        tester.getSemantics(find.text('v2/rc')).label,
        contains('Entry Release'),
      );
      // The list slot holds the one way back while the list is open.
      expect(find.byTooltip('Return to Entry Release'), findsOneWidget);
      expect(find.byTooltip('Repository releases'), findsNothing);
      // The list keeps the way out to GitHub, aimed at the list's own page.
      await tester.tap(find.byTooltip('Open on GitHub'));
      await tester.pumpAndSettle();
      expect(
        launched.single.toString(),
        'https://github.com/canonical/project/releases',
      );
      await tester.ensureVisible(find.text('Draft'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Draft'));
      await tester.pumpAndSettle();
      expect(find.text('draft-v4'), findsOneWidget);
      expect(find.text('v2/rc'), findsNothing);
      await tester.ensureVisible(find.text('Stable'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Stable'));
      await tester.pumpAndSettle();
      expect(find.text('No releases match on this page.'), findsOneWidget);
      await tester.tap(find.byTooltip('Next page'));
      await tester.pumpAndSettle();
      expect(find.text('older-stable'), findsOneWidget);
      expect(find.text('older-preview'), findsNothing);
      await tester.tap(find.text('older-stable'));
      await tester.pumpAndSettle();
      expect(find.text('Other notes'), findsOneWidget);
      // Another release in the same repository keeps the one step back and the
      // Repository Release List beside it.
      expect(find.byTooltip('Return to Entry Release'), findsOneWidget);
      expect(find.byTooltip('Repository releases'), findsOneWidget);
      await tester.tapAt(
        tester.getTopLeft(
              find.textContaining('Another repository', findRichText: true),
            ) +
            const Offset(30, 8),
      );
      await tester.pumpAndSettle();
      expect(find.text('Another repository notes'), findsOneWidget);
      // Following a link into another repository updates the chrome line.
      expect(find.text('other/tool'), findsOneWidget);
      expect(find.text('v1'), findsOneWidget);
      await openRepositoryReleases(tester);
      expect(find.text('another-repo-release'), findsOneWidget);
      expect(find.text('Entry Release'), findsNothing);
      expect(
        tester.getSemantics(find.text('another-repo-release')).label,
        isNot(contains('Entry Release')),
      );
      await tester.tap(find.byTooltip('Return to Entry Release'));
      await tester.pump();
      expect(find.text('Entry notes'), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsNothing);
      expect(
        mounted.session.requests.where(
          (path) => path == 'GET api/releases/octo/app/42',
        ),
        hasLength(1),
      );
      await openRepositoryReleases(tester);
      expect(find.text('Page 2'), findsOneWidget);
      expect(find.text('older-preview'), findsNothing);
      await tester.tap(find.text('older-stable'));
      await tester.pump();
      expect(find.text('Other notes'), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsNothing);
      expect(
        mounted.session.requests.where(
          (path) => path == 'GET api/releases/canonical/project/45',
        ),
        hasLength(1),
      );
      await tester.tapAt(
        tester.getTopLeft(
              find.textContaining('Another repository', findRichText: true),
            ) +
            const Offset(30, 8),
      );
      await tester.pump();
      expect(find.text('Another repository notes'), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsNothing);
      expect(
        mounted.session.requests.where(
          (path) => path == 'GET api/releases/other/tool/by-tag?tag=v1',
        ),
        hasLength(1),
      );
      await tester.tap(find.byTooltip('Return to Entry Release'));
      await tester.pump();
      expect(find.text('Entry notes'), findsOneWidget);
      await tester.sendKeyEvent(LogicalKeyboardKey.escape);
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('release-drawer')), findsNothing);
      await tester.tap(find.byType(ReleaseTimelineCard));
      await tester.pumpAndSettle();
      expect(
        mounted.session.requests.where(
          (path) => path == 'GET api/releases/octo/app/42',
        ),
        hasLength(2),
      );
      await openRepositoryReleases(tester);
      expect(find.text('Page 1'), findsOneWidget);
      expect(find.text('draft-v4'), findsOneWidget);
      expect(
        tester.getSemantics(find.text('v2/rc')).label,
        contains('Entry Release'),
      );
      expect(
        mounted.session.requests
            .where(
              (path) =>
                  path ==
                  'GET api/releases/canonical/project?page=1&per_page=20',
            )
            .length,
        2,
      );
      await tester.tap(find.byTooltip('Next page'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('older-stable'));
      await tester.pumpAndSettle();
      expect(find.text('Other notes'), findsOneWidget);
      expect(
        mounted.session.requests.where(
          (path) => path == 'GET api/releases/canonical/project/45',
        ),
        hasLength(2),
      );
    },
  );

  testWidgets(
    'reaching the Entry Release again through the list offers no step back',
    (tester) async {
      await pumpTimelineScreen(
        tester,
        size: const Size(1200, 1000),
        handlers: {
          ...browsingHandlers(),
          'GET api/releases/canonical/project?page=1&per_page=20': () =>
              BackendResult(
                statusCode: 200,
                data: releaseListJson([
                  listReleaseJson(42, 'v2/rc', prerelease: true),
                ]),
              ),
          // The same release, addressed by id this time instead of by tag.
          'GET api/releases/canonical/project/42': () => BackendResult(
            statusCode: 200,
            data: {...releaseDetailJson(), 'name': 'Entry notes'},
          ),
        },
      );
      await tester.tap(find.byType(ReleaseTimelineCard));
      await tester.pumpAndSettle();
      expect(find.byTooltip('Return to Entry Release'), findsNothing);
      await openRepositoryReleases(tester);
      await tester.tap(find.text('v2/rc'));
      await tester.pumpAndSettle();
      expect(find.text('Entry notes'), findsOneWidget);
      // Same release, different address: the drawer is still on the Entry
      // Release, so a back arrow would point at where the reader already is.
      expect(find.byTooltip('Return to Entry Release'), findsNothing);
      expect(find.byTooltip('Repository releases'), findsOneWidget);
    },
  );

  testWidgets(
    'unavailable details are retryable and an identity change hides pending content',
    (tester) async {
      final pending = Completer<BackendResult>();
      final mounted = await pumpTimelineScreen(
        tester,
        size: const Size(1100, 800),
        handlers: {
          'GET api/settings': () => BackendResult(
            statusCode: 200,
            data: settingsJson([followJson('R_app', 'octo', 'app')]),
          ),
          'POST api/release-timeline/refresh': () => BackendResult(
            statusCode: 200,
            data: roundJson(
              pages: {
                'R_app': pageJson('octo', 'app', [
                  releaseJson(42, 'v2', '2026-10-17T12:00:00Z'),
                ]),
              },
            ),
          ),
          'GET api/releases/octo/app/42': () => const BackendResult(
            statusCode: 404,
            problem: BackendProblem.unavailable,
          ),
        },
      );
      await tester.tap(find.byType(ReleaseTimelineCard));
      await tester.pumpAndSettle();
      expect(
        find.text(
          'This release is unavailable or is not accessible to this account.',
        ),
        findsOneWidget,
      );
      mounted.session.handlers['GET api/releases/octo/app/42'] = () =>
          pending.future;
      await tester.tap(find.text('Retry'));
      await tester.pump();
      // This must replace the error rather than keep stale data during retry.
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      mounted.session.emit(
        SessionState(
          phase: SessionPhase.signedIn,
          identity: signedInIdentity(login: 'another-user'),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('release-drawer')), findsNothing);
      pending.complete(
        BackendResult(
          statusCode: 200,
          data: {...releaseDetailJson(), 'name': 'Private old-account notes'},
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Private old-account notes'), findsNothing);
    },
  );

  testWidgets(
    'a phone sheet spends none of its height on the status bar inset',
    (tester) async {
      tester.view.padding = const FakeViewPadding(top: 40);
      addTearDown(tester.view.resetPadding);
      await pumpTimelineScreen(
        tester,
        size: const Size(390, 800),
        handlers: browsingHandlers(),
      );
      await tester.tap(find.byType(ReleaseTimelineCard));
      await tester.pumpAndSettle();
      final drawer = tester.getRect(find.byKey(const Key('release-drawer')));
      // The sheet's top edge is nowhere near the status bar, so the drag handle
      // starts at it instead of below a reserved strip.
      expect(
        tester.getTopLeft(find.byKey(const Key('release-sheet-handle'))).dy,
        drawer.top,
      );
    },
  );

  testWidgets(
    'a phone sheet spends its first screen on the notes and folds the rest away',
    (tester) async {
      final launched = <Uri>[];
      await pumpTimelineScreen(
        tester,
        size: const Size(500, 1000),
        launchBrowser: (uri) async {
          launched.add(uri);
          return true;
        },
        handlers: {
          'GET api/settings': () => BackendResult(
            statusCode: 200,
            data: settingsJson([followJson('R_app', 'octo', 'app')]),
          ),
          'POST api/release-timeline/refresh': () => BackendResult(
            statusCode: 200,
            data: roundJson(
              pages: {
                'R_app': pageJson('octo', 'app', [
                  releaseJson(42, 'v2', '2026-10-17T12:00:00Z'),
                ]),
              },
            ),
          ),
          'GET api/releases/octo/app/42': () => BackendResult(
            statusCode: 200,
            data: {
              ...releaseDetailJson(),
              'name': 'Entry notes',
              'published_at': '2026-10-17T12:00:00Z',
              'author': {'login': 'octocat'},
              'body': '''
<details open><summary>Expanded</summary><p>Visible HTML</p>
<details><summary>Nested</summary><p>Hidden HTML</p></details></details>
<table><tr><td colspan="2">Wide cell</td></tr></table>

[Next release](https://github.com/canonical/project/releases/tag/v3)
''',
            },
          ),
          'GET api/releases/canonical/project/by-tag?tag=v3': () =>
              BackendResult(
                statusCode: 200,
                data: {
                  ...releaseDetailJson(id: 43, tag: 'v3'),
                  'name': 'Next notes',
                  'body': 'Next body',
                },
              ),
        },
      );
      await tester.tap(find.byType(ReleaseTimelineCard));
      await tester.pumpAndSettle();
      final drawer = tester.getRect(find.byKey(const Key('release-drawer')));
      expect(drawer.bottom, 1000);
      expect(drawer.width, 500);
      // One line at the top says what is being read.
      expect(find.text('v2/rc'), findsOneWidget);
      expect(find.text('canonical/project'), findsOneWidget);
      // Author, publish time and release state share one quiet line, and no
      // chip competes with the notes.
      final meta = find.textContaining('octocat');
      expect(meta, findsOneWidget);
      expect(tester.widget<Text>(meta).data, contains('Prerelease'));
      expect(find.byType(Chip), findsNothing);
      // Reading starts near the top of the sheet rather than below a second
      // header, so the notes get the screen even at the default height.
      final notes = find.textContaining('Visible HTML', findRichText: true);
      expect(notes, findsOneWidget);
      expect(tester.getTopLeft(notes).dy - drawer.top, lessThan(220));
      expect(notes.hitTestable(), findsOneWidget);
      // The release name and its meta line are one block, and the author's
      // notes start after a separation: a changelog heading cannot read as a
      // continuation of the release name.
      final title = find.text('Entry notes');
      final nameToMeta =
          tester.getRect(meta).top - tester.getBottomLeft(title).dy;
      final metaToNotes =
          tester.getTopLeft(notes).dy - tester.getRect(meta).bottom;
      expect(nameToMeta, lessThan(8));
      expect(metaToNotes, greaterThan(24));
      // Leaving for GitHub is one tap away without scrolling the notes.
      final github = find.byTooltip('Open on GitHub');
      expect(github, findsOneWidget);
      expect(
        tester.getRect(github).bottom,
        lessThanOrEqualTo(tester.getTopLeft(notes).dy),
      );
      expect(
        find.textContaining('Hidden HTML', findRichText: true).hitTestable(),
        findsNothing,
      );
      await tester.tap(find.textContaining('Nested', findRichText: true));
      await tester.pumpAndSettle();
      expect(
        find.textContaining('Hidden HTML', findRichText: true).hitTestable(),
        findsOneWidget,
      );
      expect(
        find.textContaining('Wide cell', findRichText: true),
        findsOneWidget,
      );
      // Release Assets wait below the notes, folded into one labelled row that
      // states how many there are and their total size.
      expect(find.text('1 asset · 2 KB'), findsOneWidget);
      expect(find.text('app.zip'), findsNothing);
      await tester.ensureVisible(find.byKey(const Key('release-assets')));
      await tester.tap(find.byKey(const Key('release-assets')));
      await tester.pumpAndSettle();
      expect(find.text('app.zip'), findsOneWidget);
      // No trailing button offers the download any more: the row is the only
      // affordance, right to the edge that button used to occupy.
      expect(find.byTooltip('Download in browser'), findsNothing);
      final assetRow = tester.getRect(find.text('app.zip'));
      await tester.tapAt(Offset(drawer.right - 24, assetRow.center.dy));
      await tester.pumpAndSettle();
      expect(
        launched.single.toString(),
        'https://github.com/canonical/project/releases/download/v2/app.zip',
      );
      await tester.tapAt(
        tester.getTopLeft(
              find.textContaining('Next release', findRichText: true),
            ) +
            const Offset(30, 8),
      );
      await tester.pumpAndSettle();
      expect(find.text('Next notes'), findsOneWidget);
      expect(find.text('Next body', findRichText: true), findsOneWidget);
      expect(launched, hasLength(1));
      await tester.tap(find.byTooltip('Return to Entry Release'));
      await tester.pumpAndSettle();
      expect(find.text('Entry notes'), findsOneWidget);
      // The chrome action leaves for the release on GitHub, not for the
      // release currently loaded.
      await tester.tap(find.byTooltip('Open on GitHub'));
      await tester.pumpAndSettle();
      expect(
        launched.last.toString(),
        'https://github.com/canonical/project/releases/tag/v2/rc',
      );
      // Dragging the sheet to the full screen keeps working.
      await tester.drag(
        find.byKey(const Key('release-sheet-handle')),
        const Offset(0, -300),
      );
      await tester.pumpAndSettle();
      expect(tester.getRect(find.byKey(const Key('release-drawer'))).top, 0);
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('release-drawer')), findsNothing);
      expect(find.byType(ReleaseTimelineCard), findsOneWidget);
      await tester.tap(find.byType(ReleaseTimelineCard));
      await tester.pumpAndSettle();
      await tester.drag(
        find.byKey(const Key('release-sheet-handle')),
        const Offset(0, 400),
      );
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('release-drawer')), findsNothing);
    },
  );

  testWidgets(
    'a desktop release opens over the scrolled timeline and Escape restores its context',
    (tester) async {
      final response = Completer<BackendResult>();
      final mounted = await pumpTimelineScreen(
        tester,
        size: const Size(1400, 900),
        handlers: {
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
        },
      );
      await tester.drag(find.byType(CustomScrollView), const Offset(0, -500));
      await tester.pumpAndSettle();
      final cards = find.byType(ReleaseTimelineCard);
      final row = [for (var i = 0; i < 3; i++) tester.getRect(cards.at(i))];
      final card = find.byType(ReleaseTimelineCard).hitTestable().first;
      final item = tester.widget<ReleaseTimelineCard>(card).item;
      final location = tester.getTopLeft(card);
      final openerFocus = Focus.of(
        tester.element(
          find.descendant(of: card, matching: find.byType(Container)).first,
        ),
      );
      openerFocus.requestFocus();
      await tester.pump();
      mounted.session.handlers['GET api/releases/octo/app/${item.id}'] = () =>
          response.future;
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pump();
      expect(find.byKey(const Key('release-drawer')), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      response.complete(
        BackendResult(
          statusCode: 200,
          data: {
            ...releaseDetailJson(id: item.id),
            'name': 'Current release details',
            'body': '## Release notes\n\nReady to use.',
          },
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Current release details'), findsOneWidget);
      expect(
        find.textContaining('Ready to use.', findRichText: true),
        findsOneWidget,
      );
      final bounds = tester.getRect(find.byKey(const Key('release-drawer')));
      expect(bounds.right, 1400);
      expect(bounds.top, 0);
      // The panel covers exactly the right-most timeline column plus the trail
      // padding, measured from the timeline it sits beside.
      final trailPadding = 1400 - row[2].right;
      expect(trailPadding, releaseTimelineHorizontalPadding);
      expect(row[1].left - row[0].right, releaseTimelineColumnGap);
      expect(bounds.width, closeTo(row[2].width + trailPadding, 1));
      expect(FocusManager.instance.primaryFocus?.context?.widget, isNotNull);
      await tester.sendKeyEvent(LogicalKeyboardKey.escape);
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('release-drawer')), findsNothing);
      expect(tester.getTopLeft(card), location);
      expect(FocusManager.instance.primaryFocus, openerFocus);
    },
  );

  testWidgets(
    'a phone sheet still resizes from the list band while a page loads',
    (tester) async {
      final pending = Completer<BackendResult>();
      await pumpTimelineScreen(
        tester,
        size: const Size(390, 844),
        handlers: {
          ...browsingHandlers(),
          'GET api/releases/canonical/project?page=1&per_page=20': () =>
              pending.future,
        },
      );
      await tester.tap(find.byType(ReleaseTimelineCard));
      await tester.pumpAndSettle();
      await openRepositoryReleases(tester, settle: false);
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      // The filter row is already in place while the page loads.
      expect(find.text('All').hitTestable(), findsOneWidget);
      final before = tester
          .getRect(find.byKey(const Key('release-drawer')))
          .top;
      await tester.drag(
        find.byType(CircularProgressIndicator),
        const Offset(0, -300),
      );
      await tester.pump();
      // A state that replaced the rows still drags the sheet, exactly as the
      // rows themselves do.
      expect(
        tester.getRect(find.byKey(const Key('release-drawer'))).top,
        lessThan(before),
      );
      pending.complete(
        BackendResult(
          statusCode: 200,
          data: releaseListJson([
            listReleaseJson(42, 'v2/rc', prerelease: true),
          ]),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('v2/rc'), findsOneWidget);
    },
  );

  testWidgets(
    'the list gathers its filter bar and pager around rows that start near the top',
    (tester) async {
      await pumpTimelineScreen(
        tester,
        size: const Size(390, 844),
        handlers: {
          ...browsingHandlers(),
          'GET api/releases/canonical/project?page=1&per_page=20': () =>
              BackendResult(
                statusCode: 200,
                data: releaseListJson([
                  listReleaseJson(42, 'v2/rc', prerelease: true),
                  for (var id = 50; id < 62; id++)
                    listReleaseJson(id, 'release-$id'),
                ], hasNext: true),
              ),
        },
      );
      await tester.tap(find.byType(ReleaseTimelineCard));
      await tester.pumpAndSettle();
      await openRepositoryReleases(tester);
      final drawer = tester.getRect(find.byKey(const Key('release-drawer')));
      // The first release is where the reader's eye lands, not below a repeated
      // repository heading, a wrapped chip row and a permanent caveat.
      expect(
        tester.getTopLeft(find.text('v2/rc')).dy - drawer.top,
        lessThan(160),
      );
      // Across the whole sheet the repository is named exactly once.
      expect(find.text('canonical/project'), findsOneWidget);
      // The Entry Release is a marker with a label, never a third meta line.
      expect(find.text('Entry Release'), findsNothing);
      final entry = tester.getSemantics(find.text('v2/rc'));
      expect(entry.label, contains('Entry Release'));
      expect(entry, isSemantics(hasTapAction: true));
      // Changing page is one tap from anywhere in the list.
      expect(find.byTooltip('Next page').hitTestable(), findsOneWidget);
      expect(find.text('Page 1'), findsOneWidget);
    },
  );

  testWidgets(
    'the filter row stays put and the pager stays in reach while the rows scroll',
    (tester) async {
      await pumpTimelineScreen(
        tester,
        size: const Size(1200, 1000),
        handlers: {
          ...browsingHandlers(),
          'GET api/releases/canonical/project?page=1&per_page=20': () =>
              BackendResult(
                statusCode: 200,
                data: releaseListJson([
                  listReleaseJson(42, 'v2/rc', prerelease: true),
                  for (var id = 50; id < 70; id++)
                    listReleaseJson(id, 'release-$id'),
                ], hasNext: true),
              ),
        },
      );
      await tester.tap(find.byType(ReleaseTimelineCard));
      await tester.pumpAndSettle();
      await openRepositoryReleases(tester);
      final filters = tester.getTopLeft(find.text('All'));
      final pager = tester.getBottomLeft(find.byTooltip('Next page'));
      expect(find.byTooltip('Next page').hitTestable(), findsOneWidget);
      await tester.drag(find.text('release-50'), const Offset(0, -300));
      await tester.pumpAndSettle();
      // The rows moved; the filter bar and the pager did not.
      expect(find.text('release-50').hitTestable(), findsNothing);
      expect(tester.getTopLeft(find.text('All')), filters);
      expect(tester.getBottomLeft(find.byTooltip('Next page')), pager);
      expect(find.byTooltip('Next page').hitTestable(), findsOneWidget);
    },
  );
}
