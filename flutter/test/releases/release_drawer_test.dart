import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/session/gitpulse_http.dart';
import 'package:gitpulse/presentation/gitpulse_buttons.dart';
import 'package:gitpulse/presentation/gitpulse_progress.dart';
import 'package:gitpulse/releases/release_document.dart';
import 'package:gitpulse/session/session_controller.dart';
import 'package:gitpulse/timeline/release_timeline_card.dart';

import '../timeline/timeline_screen_test.dart' show pumpTimelineScreen;
import '../timeline/timeline_test_support.dart';
import 'release_detail_service_test.dart' show releaseDetailJson;
import '../support/document_viewer.dart';
import '../support/named_actions.dart';
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
  await tester.tap(findNamedAction('Repository releases'));
  if (settle) {
    await tester.pumpAndSettle();
  } else {
    await tester.pump();
  }
}

/// Opens one Timeline card at [size] and hands back the sheet surface the drawer
/// is drawn on — the place its corners, colour and clipping are declared.
Future<Material> openReleaseDrawer(
  WidgetTester tester, {
  required Size size,
}) async {
  await pumpTimelineScreen(tester, size: size, handlers: browsingHandlers());
  await tester.tap(find.byType(ReleaseTimelineCard).hitTestable().first);
  await tester.pumpAndSettle();
  return tester.widget<Material>(
    find
        .ancestor(
          of: find.byKey(const Key('release-drawer')),
          matching: find.byType(Material),
        )
        .first,
  );
}

void main() {
  testWidgets('toolbar controls, metadata and header gaps all drag the sheet', (
    tester,
  ) async {
    final launched = <Uri>[];
    await pumpTimelineScreen(
      tester,
      size: const Size(390, 844),
      launchBrowser: (uri) async {
        launched.add(uri);
        return true;
      },
      handlers: {
        ...browsingHandlers(),
        'GET api/releases/octo/app/42': () => BackendResult(
          statusCode: 200,
          data: {
            ...releaseDetailJson(),
            'name': 'Entry notes',
            'author': {'login': 'octocat'},
          },
        ),
      },
    );
    await tester.tap(find.byType(ReleaseTimelineCard));
    await tester.pumpAndSettle();
    final drawer = find.byKey(const Key('release-drawer'));
    final starts = <String, Offset Function()>{
      'repository': () => tester.getCenter(find.text('canonical/project')),
      'list': () => tester.getCenter(findNamedAction('Repository releases')),
      'external': () => tester.getCenter(findNamedAction('Open on GitHub')),
      'close': () => tester.getCenter(findNamedAction('Close release details')),
      'metadata': () => tester.getCenter(find.textContaining('octocat')),
      'top padding': () =>
          tester.getTopLeft(find.text('Entry notes')) - const Offset(0, 10),
      'side padding': () =>
          Offset(6, tester.getCenter(find.text('Entry notes')).dy),
      'divider gap': () =>
          tester.getBottomLeft(find.textContaining('octocat')) +
          const Offset(0, 10),
    };
    for (final entry in starts.entries) {
      await tester.dragFrom(entry.value(), const Offset(0, -300));
      await tester.pumpAndSettle();
      expect(tester.getRect(drawer).top, 0, reason: entry.key);
      expect(find.text('Entry notes'), findsOneWidget, reason: entry.key);
      expect(launched, isEmpty, reason: entry.key);
      await tester.tap(find.byKey(const Key('release-sheet-handle')));
      await tester.pumpAndSettle();
      expect(tester.getRect(drawer).top, closeTo(253.2, .01));
    }
  });

  testWidgets(
    'long pressing the title selects text and tapping close dismisses',
    (tester) async {
      await openReleaseDrawer(tester, size: const Size(390, 844));
      final title = find.byType(SelectableText);
      await tester.longPress(title);
      await tester.pumpAndSettle();
      final editable = tester.widget<EditableText>(
        find.descendant(of: title, matching: find.byType(EditableText)),
      );
      expect(
        editable.controller.selection.textInside(editable.controller.text),
        isNotEmpty,
      );
      expect(
        tester.getRect(find.byKey(const Key('release-drawer'))).top,
        closeTo(253.2, .01),
      );
      await tester.tap(findNamedAction('Close release details'));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('release-drawer')), findsNothing);
    },
  );

  testWidgets('returning from the release list keeps the mounted document', (
    tester,
  ) async {
    await pumpTimelineScreen(
      tester,
      size: const Size(390, 844),
      handlers: {
        ...browsingHandlers(),
        'GET api/releases/octo/app/42': () => BackendResult(
          statusCode: 200,
          data: {
            ...releaseDetailJson(),
            'name': 'Entry notes',
            'body': List.generate(
              100,
              (index) => 'Paragraph $index',
            ).join('\n\n'),
          },
        ),
        'GET api/releases/canonical/project?page=1&per_page=20': () =>
            BackendResult(
              statusCode: 200,
              data: releaseListJson([listReleaseJson(42, 'v2/rc')]),
            ),
      },
    );
    await tester.tap(find.byType(ReleaseTimelineCard));
    await tester.pumpAndSettle();
    final document = tester.element(find.byType(ReleaseDocument));
    final scroll = find.descendant(
      of: find.byType(ReleaseDocument),
      matching: find.byType(Scrollable),
    );
    await tester.drag(find.byType(ReleaseDocument), const Offset(0, -200));
    await tester.pumpAndSettle();
    final offset = tester.state<ScrollableState>(scroll).position.pixels;
    expect(offset, greaterThan(0));
    expect(
      tester.getRect(find.byKey(const Key('release-drawer'))).top,
      closeTo(253.2, .01),
    );
    await openRepositoryReleases(tester);
    expect(document.mounted, isTrue);
    await tester.tap(findNamedAction('Return to Entry Release'));
    await tester.pumpAndSettle();
    expect(tester.element(find.byType(ReleaseDocument)), same(document));
    expect(tester.state<ScrollableState>(scroll).position.pixels, offset);
  });

  testWidgets('the release title can drag the sheet to full height', (
    tester,
  ) async {
    await openReleaseDrawer(tester, size: const Size(390, 844));
    await tester.drag(find.text('Entry notes'), const Offset(0, -300));
    await tester.pumpAndSettle();
    expect(tester.getRect(find.byKey(const Key('release-drawer'))).top, 0);
    expect(find.text('Entry notes'), findsOneWidget);
  });

  testWidgets('a short pull down the header closes the drawer', (tester) async {
    await openReleaseDrawer(tester, size: const Size(390, 1000));
    final drawer = find.byKey(const Key('release-drawer'));
    // The gesture keeps its own 20dp of slop, so 60dp of finger is 40dp of
    // sheet: short of the 96dp closing line, and the drawer settles back where
    // it opened instead of closing at a touch that drifts.
    await tester.drag(find.text('Entry notes'), const Offset(0, 60));
    await tester.pumpAndSettle();
    expect(tester.getRect(drawer).top, closeTo(300, .01));

    // 130dp of finger is 110dp of sheet, which passes that line — a little over
    // half of the 200dp of sheet this drawer used to need before it closed.
    await tester.drag(find.text('Entry notes'), const Offset(0, 130));
    await tester.pumpAndSettle();
    expect(drawer, findsNothing);
    expect(find.byType(ReleaseTimelineCard), findsOneWidget);
  });

  testWidgets('a quick flick down closes the drawer without a long pull', (
    tester,
  ) async {
    await openReleaseDrawer(tester, size: const Size(390, 1000));
    final drawer = find.byKey(const Key('release-drawer'));
    // 60dp of finger is 40dp of sheet — nowhere near the 96dp closing line —
    // and the drawer closes all the same because the header was thrown down at
    // 1250dp a second rather than dragged.
    final gesture = await tester.startGesture(
      tester.getCenter(find.byKey(const Key('release-sheet-handle'))),
    );
    for (var step = 1; step <= 3; step++) {
      await gesture.moveBy(
        const Offset(0, 20),
        timeStamp: Duration(milliseconds: 16 * step),
      );
      await tester.pump(const Duration(milliseconds: 16));
    }
    await gesture.up(timeStamp: const Duration(milliseconds: 52));
    await tester.pumpAndSettle();
    expect(drawer, findsNothing);
    expect(find.byType(ReleaseTimelineCard), findsOneWidget);
  });

  testWidgets('a short pull up the header opens the drawer fully', (
    tester,
  ) async {
    await openReleaseDrawer(tester, size: const Size(390, 1000));
    final drawer = find.byKey(const Key('release-drawer'));
    // 60dp of finger is 40dp of sheet: short of the 96dp line, so the drawer
    // settles back where it opened rather than jumping to full screen.
    await tester.drag(find.text('Entry notes'), const Offset(0, -60));
    await tester.pumpAndSettle();
    expect(tester.getRect(drawer).top, closeTo(300, .01));

    // 130dp of finger is 110dp of sheet, which passes it.
    await tester.drag(find.text('Entry notes'), const Offset(0, -130));
    await tester.pumpAndSettle();
    expect(tester.getRect(drawer).top, 0);
    expect(find.text('Entry notes'), findsOneWidget);
  });

  testWidgets('a quick flick up opens the drawer fully', (tester) async {
    await openReleaseDrawer(tester, size: const Size(390, 1000));
    final drawer = find.byKey(const Key('release-drawer'));
    // 60dp of finger is 40dp of sheet, thrown up at 1250dp a second.
    final gesture = await tester.startGesture(
      tester.getCenter(find.byKey(const Key('release-sheet-handle'))),
    );
    for (var step = 1; step <= 3; step++) {
      await gesture.moveBy(
        const Offset(0, -20),
        timeStamp: Duration(milliseconds: 16 * step),
      );
      await tester.pump(const Duration(milliseconds: 16));
    }
    await gesture.up(timeStamp: const Duration(milliseconds: 52));
    await tester.pumpAndSettle();
    expect(tester.getRect(drawer).top, 0);
  });

  testWidgets('a short pull back down from full screen returns the drawer', (
    tester,
  ) async {
    await openReleaseDrawer(tester, size: const Size(390, 1000));
    final drawer = find.byKey(const Key('release-drawer'));
    await tester.drag(find.text('Entry notes'), const Offset(0, -130));
    await tester.pumpAndSettle();
    expect(tester.getRect(drawer).top, 0);

    // Closing a full-screen read takes 110dp of sheet, and it lands back at the
    // height the drawer opens at instead of closing the notes.
    await tester.drag(find.text('Entry notes'), const Offset(0, 130));
    await tester.pumpAndSettle();
    expect(tester.getRect(drawer).top, closeTo(300, .01));
    expect(find.text('Entry notes'), findsOneWidget);
  });

  testWidgets('a quick flick down from full screen returns the drawer', (
    tester,
  ) async {
    await openReleaseDrawer(tester, size: const Size(390, 1000));
    final drawer = find.byKey(const Key('release-drawer'));
    await tester.drag(find.text('Entry notes'), const Offset(0, -130));
    await tester.pumpAndSettle();
    expect(tester.getRect(drawer).top, 0);

    final gesture = await tester.startGesture(
      tester.getCenter(find.byKey(const Key('release-sheet-handle'))),
    );
    for (var step = 1; step <= 3; step++) {
      await gesture.moveBy(
        const Offset(0, 20),
        timeStamp: Duration(milliseconds: 16 * step),
      );
      await tester.pump(const Duration(milliseconds: 16));
    }
    await gesture.up(timeStamp: const Duration(milliseconds: 52));
    await tester.pumpAndSettle();
    expect(drawer, findsOneWidget);
    expect(tester.getRect(drawer).top, closeTo(300, .01));
  });

  testWidgets('drag dismissal never rebounds upward before closing', (
    tester,
  ) async {
    await openReleaseDrawer(tester, size: const Size(390, 844));
    final drawer = find.byKey(const Key('release-drawer'));
    final gesture = await tester.startGesture(
      tester.getCenter(find.byKey(const Key('release-sheet-handle'))),
    );
    await gesture.moveBy(const Offset(0, 40));
    await gesture.moveBy(const Offset(0, 300));
    await tester.pump();
    var previousTop = tester.getTopLeft(drawer).dy;
    await gesture.up();
    for (var frame = 0; frame < 8; frame++) {
      await tester.pump(const Duration(milliseconds: 16));
      if (drawer.evaluate().isEmpty) break;
      final top = tester.getTopLeft(drawer).dy;
      expect(top, greaterThanOrEqualTo(previousTop));
      previousTop = top;
    }
    await tester.pumpAndSettle();
    expect(drawer, findsNothing);
    expect(find.byType(ReleaseTimelineCard), findsOneWidget);
  });

  testWidgets('a list scrolled past its top closes the drawer through its own '
      'snap', (tester) async {
    await pumpTimelineScreen(
      tester,
      size: const Size(390, 1000),
      handlers: {
        ...browsingHandlers(),
        'GET api/releases/canonical/project?page=1&per_page=20': () =>
            BackendResult(
              statusCode: 200,
              data: releaseListJson([
                listReleaseJson(42, 'v2/rc', prerelease: true),
                for (var id = 50; id < 60; id++)
                  listReleaseJson(id, 'release-$id'),
              ]),
            ),
      },
    );
    await tester.tap(find.byType(ReleaseTimelineCard).hitTestable().first);
    await tester.pumpAndSettle();
    await openRepositoryReleases(tester);
    final drawer = find.byKey(const Key('release-drawer'));

    // The rows own this gesture, so the sheet reaches the closing line by
    // snapping to it rather than by a header pull: 60dp of finger is not yet
    // halfway, and the drawer settles back.
    await tester.drag(find.text('release-50'), const Offset(0, 60));
    await tester.pumpAndSettle();
    expect(drawer, findsOneWidget);
    expect(tester.getRect(drawer).top, closeTo(300, .01));

    await tester.drag(find.text('release-50'), const Offset(0, 80));
    await tester.pumpAndSettle();
    expect(drawer, findsNothing);
  });

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
      expect(find.byType(GitPulseProgressPage), findsOneWidget);
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
      await tester.tap(find.byKey(const ValueKey('prerelease')));
      await tester.pumpAndSettle();
      expect(find.text('entry-preview'), findsOneWidget);
      expect(find.text('draft-preview'), findsNothing);
      await tester.ensureVisible(findNamedAction('Next page'));
      await tester.tap(findNamedAction('Next page'));
      await tester.pumpAndSettle();
      expect(
        find.text(
          "This account does not have permission to read this repository's releases.",
        ),
        findsOneWidget,
      );
      // The failed band's one action is the app's own button, not Material's.
      expect(find.byType(OutlinedButton), findsNothing);
      expect(find.widgetWithText(GitPulseButton, 'Retry'), findsOneWidget);
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
      await tester.ensureVisible(findNamedAction('Next page'));
      await tester.tap(findNamedAction('Next page'));
      await tester.pumpAndSettle();
      expect(find.text('older-preview'), findsOneWidget);
      await tester.ensureVisible(findNamedAction('Previous page'));
      await tester.tap(findNamedAction('Previous page'));
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
      expect(find.byType(GitPulseProgressPage), findsOneWidget);
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
      await tester.tap(findNamedAction('Close release details'));
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
      expect(findNamedAction('Return to Entry Release'), findsNothing);
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
      expect(findNamedAction('Return to Entry Release'), findsOneWidget);
      expect(findNamedAction('Repository releases'), findsNothing);
      // The list keeps the way out to GitHub, aimed at the list's own page.
      await tester.tap(findNamedAction('Open on GitHub'));
      await tester.pumpAndSettle();
      expect(
        launched.single.toString(),
        'https://github.com/canonical/project/releases',
      );
      await tester.ensureVisible(find.byKey(const ValueKey('draft')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('draft')));
      await tester.pumpAndSettle();
      expect(find.text('draft-v4'), findsOneWidget);
      expect(find.text('v2/rc'), findsNothing);
      await tester.ensureVisible(find.byKey(const ValueKey('stable')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('stable')));
      await tester.pumpAndSettle();
      expect(find.text('No releases match on this page.'), findsOneWidget);
      await tester.tap(findNamedAction('Next page'));
      await tester.pumpAndSettle();
      expect(find.text('older-stable'), findsOneWidget);
      expect(find.text('older-preview'), findsNothing);
      await tester.tap(find.text('older-stable'));
      await tester.pumpAndSettle();
      expect(find.text('Other notes'), findsOneWidget);
      // Another release in the same repository keeps the one step back and the
      // Repository Release List beside it.
      expect(findNamedAction('Return to Entry Release'), findsOneWidget);
      expect(findNamedAction('Repository releases'), findsOneWidget);
      await mountedDocument!.bridge.open(
        'https://github.com/other/tool/releases/tag/v1',
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
      await tester.tap(findNamedAction('Return to Entry Release'));
      await tester.pump();
      expect(find.text('Entry notes'), findsOneWidget);
      expect(find.byType(GitPulseProgressPage), findsNothing);
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
      expect(find.byType(GitPulseProgressPage), findsNothing);
      expect(
        mounted.session.requests.where(
          (path) => path == 'GET api/releases/canonical/project/45',
        ),
        hasLength(1),
      );
      await mountedDocument!.bridge.open(
        'https://github.com/other/tool/releases/tag/v1',
      );
      await tester.pump();
      expect(find.text('Another repository notes'), findsOneWidget);
      expect(find.byType(GitPulseProgressPage), findsNothing);
      expect(
        mounted.session.requests.where(
          (path) => path == 'GET api/releases/other/tool/by-tag?tag=v1',
        ),
        hasLength(1),
      );
      await tester.tap(findNamedAction('Return to Entry Release'));
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
      await tester.tap(findNamedAction('Next page'));
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
      expect(findNamedAction('Return to Entry Release'), findsNothing);
      await openRepositoryReleases(tester);
      await tester.tap(find.text('v2/rc'));
      await tester.pumpAndSettle();
      expect(find.text('Entry notes'), findsOneWidget);
      // Same release, different address: the drawer is still on the Entry
      // Release, so a back arrow would point at where the reader already is.
      expect(findNamedAction('Return to Entry Release'), findsNothing);
      expect(findNamedAction('Repository releases'), findsOneWidget);
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
      expect(find.byType(GitPulseProgressPage), findsOneWidget);
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

  testWidgets('a phone sheet rounds its top corners at the registered radius', (
    tester,
  ) async {
    final sheet = await openReleaseDrawer(tester, size: const Size(390, 800));
    // 20 is the radius the token registers for the sheet's top corners, written
    // here as a number so a radius token edited without the spec goes red. The
    // rest of this sheet's geometry belongs to ADR 0010.
    expect(
      sheet.borderRadius,
      const BorderRadius.vertical(top: Radius.circular(20)),
    );
  });

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
      final github = findNamedAction('Open on GitHub');
      expect(github, findsOneWidget);
      expect(
        tester.getRect(github).bottom,
        lessThanOrEqualTo(tester.getTopLeft(notes).dy),
      );
      // What the document draws for itself — a folded <details>, a table, a code
      // block — is the renderer's behaviour, asserted against the built renderer
      // in tool/document_viewer/verify.mjs. What this surface owns is where the
      // document sits and what a link tap does, which is what follows.
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
      expect(findNamedAction('Download in browser'), findsNothing);
      final assetRow = tester.getRect(find.text('app.zip'));
      await tester.tapAt(Offset(drawer.right - 24, assetRow.center.dy));
      await tester.pumpAndSettle();
      expect(
        launched.single.toString(),
        'https://github.com/canonical/project/releases/download/v2/app.zip',
      );
      // The list takes the reading area while it is open: the notes stay
      // mounted under it — folding the module away returns to the page the
      // reader left — but nothing of them is reachable through the list.
      expect(
        find.textContaining('Visible HTML', findRichText: true),
        findsOneWidget,
      );
      expect(
        find.textContaining('Visible HTML', findRichText: true).hitTestable(),
        findsNothing,
      );
      // Folding the assets away gives the notes their area back.
      await tester.tap(find.byKey(const Key('release-assets')));
      await tester.pumpAndSettle();
      expect(
        find.textContaining('Visible HTML', findRichText: true),
        findsOneWidget,
      );
      // A link is the page's report to the app, never a navigation the page
      // performs itself.
      await mountedDocument!.bridge.open(
        'https://github.com/canonical/project/releases/tag/v3',
      );
      await tester.pumpAndSettle();
      expect(find.text('Next notes'), findsOneWidget);
      expect(find.text('Next body', findRichText: true), findsOneWidget);
      expect(launched, hasLength(1));
      await tester.tap(findNamedAction('Return to Entry Release'));
      await tester.pumpAndSettle();
      expect(find.text('Entry notes'), findsOneWidget);
      // The chrome action leaves for the release on GitHub, not for the
      // release currently loaded.
      await tester.tap(findNamedAction('Open on GitHub'));
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
    'the release sheet opens from the keyboard and Escape restores its context',
    (tester) async {
      final response = Completer<BackendResult>();
      final mounted = await pumpTimelineScreen(
        tester,
        size: const Size(390, 844),
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
      expect(find.byType(GitPulseProgressPage), findsOneWidget);
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
      // The sheet stands on the bottom edge and leaves the timeline above it,
      // so the release being read stays where the reader left it.
      final bounds = tester.getRect(find.byKey(const Key('release-drawer')));
      expect(bounds.bottom, 844);
      expect(bounds.top, greaterThan(0));
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
      expect(find.byType(GitPulseProgressPage), findsOneWidget);
      // The filter row is already in place while the page loads.
      expect(find.text('All').hitTestable(), findsOneWidget);
      final before = tester
          .getRect(find.byKey(const Key('release-drawer')))
          .top;
      await tester.drag(
        find.byType(GitPulseProgressPage),
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
      expect(findNamedAction('Next page').hitTestable(), findsOneWidget);
      expect(find.text('Page 1'), findsOneWidget);
    },
  );

  testWidgets(
    'the filter row stays put and the pager stays in reach while the rows scroll',
    (tester) async {
      await pumpTimelineScreen(
        tester,
        size: const Size(390, 900),
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
      // The sheet opens at 70% of the screen, and a drag on its rows resizes it
      // until it reaches its own height; only then do the rows own the gesture.
      await tester.drag(find.text('release-50'), const Offset(0, -600));
      await tester.pumpAndSettle();
      final filters = tester.getTopLeft(find.text('All'));
      final pager = tester.getBottomLeft(findNamedAction('Next page'));
      expect(findNamedAction('Next page').hitTestable(), findsOneWidget);
      await tester.drag(find.text('release-50'), const Offset(0, -300));
      await tester.pumpAndSettle();
      // The rows moved; the filter bar and the pager did not.
      expect(find.text('release-50').hitTestable(), findsNothing);
      expect(tester.getTopLeft(find.text('All')), filters);
      expect(tester.getBottomLeft(findNamedAction('Next page')), pager);
      expect(findNamedAction('Next page').hitTestable(), findsOneWidget);
    },
  );

  testWidgets(
    'the Release Drawer renders on the app’s faces and none of the replaced ones',
    (tester) async {
      await openReleaseDrawer(tester, size: const Size(390, 844));

      final drawer = find.byKey(const Key('release-drawer'));
      expect(drawer, findsOneWidget);
      // The chrome line is the app's own actions…
      expect(
        find.descendant(of: drawer, matching: find.byType(GitPulseIconButton)),
        findsWidgets,
      );
      for (final name in [
        'Repository releases',
        'Open on GitHub',
        'Close release details',
      ]) {
        expect(findNamedAction(name), findsOneWidget, reason: name);
      }
      // …and none of the Material faces this change replaced is left in it.
      for (final replaced in <Type>[
        FilledButton,
        OutlinedButton,
        TextButton,
        IconButton,
        CircularProgressIndicator,
        LinearProgressIndicator,
        AlertDialog,
        Dialog,
      ]) {
        expect(
          find.descendant(of: drawer, matching: find.byType(replaced)),
          findsNothing,
          reason: '$replaced',
        );
      }
      // The notes are still shown by the document host's platform view, whose
      // boundary this change does not touch.
      expect(find.byKey(const Key('release-assets')), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}
