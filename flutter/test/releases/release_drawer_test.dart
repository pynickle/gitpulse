import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/session/gitpulse_http.dart';
import 'package:gitpulse/session/session_controller.dart';
import 'package:gitpulse/timeline/release_timeline_card.dart';

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
      await tester.tap(find.text('Repository releases'));
      await tester.pump();
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
      await tester.tap(find.widgetWithText(ChoiceChip, 'Prerelease'));
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
      await tester.tap(find.text('Repository releases'));
      await tester.pump();
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
      await tester.tap(find.text('Repository releases'));
      await tester.pumpAndSettle();
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
      await tester.tap(find.text('Repository releases'));
      await tester.pump();
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
    'repository browsing preserves page and filter until close and always returns to the Entry Release',
    (tester) async {
      final mounted = await pumpTimelineScreen(
        tester,
        size: const Size(1200, 1000),
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
      await tester.tap(find.text('Repository releases'));
      await tester.pumpAndSettle();
      expect(find.text('Entry Release'), findsOneWidget);
      expect(
        find.text(
          'Filters apply to this page only. Draft visibility depends on repository permissions.',
        ),
        findsOneWidget,
      );
      await tester.tap(find.widgetWithText(ChoiceChip, 'Draft'));
      await tester.pumpAndSettle();
      expect(find.text('draft-v4'), findsOneWidget);
      expect(find.text('v2/rc'), findsNothing);
      await tester.tap(find.widgetWithText(ChoiceChip, 'Stable'));
      await tester.pumpAndSettle();
      expect(find.text('No releases match on this page.'), findsOneWidget);
      await tester.tap(find.byTooltip('Next page'));
      await tester.pumpAndSettle();
      expect(find.text('older-stable'), findsOneWidget);
      expect(find.text('older-preview'), findsNothing);
      await tester.tap(find.text('older-stable'));
      await tester.pumpAndSettle();
      expect(find.text('Other notes'), findsOneWidget);
      await tester.tapAt(
        tester.getTopLeft(
              find.textContaining('Another repository', findRichText: true),
            ) +
            const Offset(30, 8),
      );
      await tester.pumpAndSettle();
      expect(find.text('Another repository notes'), findsOneWidget);
      await tester.tap(find.text('Repository releases'));
      await tester.pumpAndSettle();
      expect(find.text('another-repo-release'), findsOneWidget);
      expect(find.text('Entry Release'), findsNothing);
      await tester.tap(find.byTooltip('Return to Entry Release'));
      await tester.pumpAndSettle();
      expect(find.text('Entry notes'), findsOneWidget);
      await tester.tap(find.text('Repository releases'));
      await tester.pumpAndSettle();
      expect(find.text('Page 2'), findsOneWidget);
      expect(find.text('older-preview'), findsNothing);
      await tester.tap(find.byTooltip('Return to Entry Release'));
      await tester.pumpAndSettle();
      expect(find.text('Entry notes'), findsOneWidget);
      await tester.sendKeyEvent(LogicalKeyboardKey.escape);
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('release-drawer')), findsNothing);
      await tester.tap(find.byType(ReleaseTimelineCard));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Repository releases'));
      await tester.pumpAndSettle();
      expect(find.text('Page 1'), findsOneWidget);
      expect(find.text('draft-v4'), findsOneWidget);
      expect(find.text('Entry Release'), findsOneWidget);
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
    'a phone sheet reads embedded HTML, returns to the Entry Release and sends downloads to the browser',
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
      final bounds = tester.getRect(find.byKey(const Key('release-drawer')));
      expect(bounds.bottom, 1000);
      expect(bounds.width, 500);
      expect(bounds.height, closeTo(700, 1));
      await tester.drag(
        find.byKey(const Key('release-sheet-handle')),
        const Offset(0, -300),
      );
      await tester.pumpAndSettle();
      expect(
        tester.getSize(find.byKey(const Key('release-drawer'))).height,
        closeTo(1000, 1),
      );
      expect(
        find.textContaining('Visible HTML', findRichText: true),
        findsOneWidget,
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
      await tester.tapAt(
        tester.getTopLeft(
              find.textContaining('Next release', findRichText: true),
            ) +
            const Offset(30, 8),
      );
      await tester.pumpAndSettle();
      expect(find.text('Next notes'), findsOneWidget);
      expect(launched, isEmpty);
      await tester.tap(find.byTooltip('Return to Entry Release'));
      await tester.pumpAndSettle();
      expect(find.text('Entry notes'), findsOneWidget);
      await tester.ensureVisible(find.byTooltip('Download in browser'));
      await tester.tap(find.byTooltip('Download in browser'));
      await tester.pumpAndSettle();
      expect(
        launched.single.toString(),
        'https://github.com/canonical/project/releases/download/v2/app.zip',
      );
      await tester.ensureVisible(find.text('Open on GitHub'));
      await tester.tap(find.text('Open on GitHub'));
      await tester.pumpAndSettle();
      expect(
        launched.last.toString(),
        'https://github.com/canonical/project/releases/tag/v2/rc',
      );
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
      expect(bounds.width, lessThan(1000));
      expect(FocusManager.instance.primaryFocus?.context?.widget, isNotNull);
      await tester.sendKeyEvent(LogicalKeyboardKey.escape);
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('release-drawer')), findsNothing);
      expect(tester.getTopLeft(card), location);
      expect(FocusManager.instance.primaryFocus, openerFocus);
    },
  );
}
