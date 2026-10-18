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

void main() {
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
