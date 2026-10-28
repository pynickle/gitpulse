import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:gitpulse/l10n/generated/app_localizations.dart';
import 'package:gitpulse/releases/repository_releases_screen.dart';
import 'package:gitpulse/session/gitpulse_http.dart';
import 'package:gitpulse/session/session_controller.dart';
import 'package:intl/intl.dart';

import '../timeline/timeline_test_support.dart';
import 'release_detail_service_test.dart' show releaseDetailJson;
import 'repository_releases_service_test.dart'
    show listReleaseJson, releaseListJson;

/// Drives the fullscreen Repository Release List through a real route, with the
/// fake session answering the list requests from [handlers].
Future<({FakeSessionController session, GoRouter router})> pumpReleasesPage(
  WidgetTester tester, {
  required Map<String, FutureOr<BackendResult> Function()> handlers,
  Size? size,
}) async {
  if (size != null) {
    tester.view.physicalSize = size;
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
  }
  final session = FakeSessionController(
    SessionState(phase: SessionPhase.signedIn, identity: signedInIdentity()),
  )..handlers.addAll(handlers);
  final router = GoRouter(
    initialLocation: '/repositories/octo/app/releases',
    routes: [
      GoRoute(
        path: '/timeline',
        builder: (_, _) => const Scaffold(body: Text('Timeline destination')),
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
  return (session: session, router: router);
}

void main() {
  testWidgets(
    'routed repository releases open consistent details and preserve their filter on dismissal',
    (tester) async {
      final page = await pumpReleasesPage(
        tester,
        handlers: {
          'GET api/releases/octo/app?page=1&per_page=20': () => BackendResult(
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
        },
      );
      await tester.tap(find.byKey(const ValueKey('stable')));
      await tester.pumpAndSettle();
      expect(find.text('preview-release'), findsNothing);
      await tester.tap(find.text('stable-release'));
      await tester.pumpAndSettle();
      expect(find.text('Routed release notes'), findsOneWidget);
      // The drawer reads over the list without leaving its route.
      expect(
        page.router.routeInformationProvider.value.uri.path,
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

  testWidgets(
    'the page names the repository in its app bar and rows read as a name plus one meta line',
    (tester) async {
      // The year rule is relative to the current year by definition, so the
      // fixture is built from the clock; the expected strings are written out
      // here from `DateFormat` rather than recomputed with the helper under
      // test.
      final now = DateTime.now();
      final thisYear = DateTime(now.year, 3, 5, 12);
      final lastYear = DateTime(now.year - 1, 12, 31, 12);
      await pumpReleasesPage(
        tester,
        handlers: {
          'GET api/releases/octo/app?page=1&per_page=20': () => BackendResult(
            statusCode: 200,
            data: releaseListJson([
              listReleaseJson(
                1,
                'v1.0.0',
                name: 'First stable',
                publishedAt: thisYear.toUtc().toIso8601String(),
                assetsCount: 31,
                downloadCount: 1200,
              ),
              listReleaseJson(
                2,
                'v0.9.0',
                publishedAt: lastYear.toUtc().toIso8601String(),
              ),
              listReleaseJson(3, 'v0.1.0', downloadCount: 1),
            ]),
          ),
        },
      );
      // The fullscreen host owns the repository name; the list never repeats it.
      expect(find.text('octo/app'), findsOneWidget);
      expect(find.text('Repository releases'), findsNothing);

      final day = DateFormat.MMMd('en').format(thisYear);
      expect(find.text('First stable'), findsOneWidget);
      // Each fact is spelled by a glyph and its value, not by a repeated noun,
      // and the name owns the title line: a tag that differs from it is not
      // printed beside it.
      expect(find.text('v1.0.0'), findsNothing);
      expect(find.text(day), findsOneWidget);
      expect(
        find.descendant(
          of: find.byKey(const ValueKey(1)),
          matching: find.text('31'),
        ),
        findsOneWidget,
      );
      expect(
        find.descendant(
          of: find.byKey(const ValueKey(1)),
          matching: find.text('1.2k'),
        ),
        findsOneWidget,
      );
      // The paper clips and download arrows sit at one x per column, even
      // though the dates beside them differ in width and one row has no date.
      final clips = find.byIcon(Icons.attach_file);
      expect(clips, findsNWidgets(3));
      expect({
        for (var index = 0; index < 3; index++)
          tester.getTopLeft(clips.at(index)).dx,
      }, hasLength(1));
      final arrows = find.byIcon(Icons.download_outlined);
      expect(arrows, findsNWidgets(3));
      expect({
        for (var index = 0; index < 3; index++)
          tester.getTopLeft(arrows.at(index)).dx,
      }, hasLength(1));
      // The words the glyphs replace are visible nowhere on the page.
      expect(find.textContaining('assets'), findsNothing);
      expect(find.textContaining('downloads'), findsNothing);
      // A release without a name is titled by its tag, and the tag is not
      // printed a second time.
      final older = DateFormat.yMMMd('en').format(lastYear);
      expect(find.text('v0.9.0'), findsOneWidget);
      expect(find.text(older), findsOneWidget);
      // The units still reach a screen reader, and one download is not
      // "1 downloads": the localisation owns the agreement.
      final stable = tester.getSemantics(find.text('First stable')).label;
      expect(stable, contains('31 assets'));
      expect(stable, contains('1.2k downloads'));
      final single = tester.getSemantics(find.text('v0.1.0')).label;
      expect(single, contains('1 download'));
      expect(single, isNot(contains('1 downloads')));
      // The loaded page is the only page, so it is not worth a pager.
      expect(find.text('Page 1'), findsNothing);
      expect(find.byTooltip('Next page'), findsNothing);
    },
  );

  testWidgets(
    'a row states its Release State as one badge beside the name, and a draft wins',
    (tester) async {
      await pumpReleasesPage(
        tester,
        size: const Size(390, 844),
        handlers: {
          'GET api/releases/octo/app?page=1&per_page=20': () => BackendResult(
            statusCode: 200,
            data: releaseListJson([
              listReleaseJson(1, 'v1.0.0', name: 'Stable release'),
              listReleaseJson(2, 'v2.0.0-rc.1', prerelease: true),
              listReleaseJson(
                3,
                'v3.0.0-beta.1',
                name: 'Draft that is also a prerelease',
                draft: true,
                prerelease: true,
              ),
            ]),
          ),
        },
      );
      Finder inRow(int id, Finder matching) =>
          find.descendant(of: find.byKey(ValueKey(id)), matching: matching);
      // The badge is the state's own word, and only the rows that have that
      // state say it: the filter bar's pills sit outside the rows.
      expect(inRow(1, find.text('Draft')), findsNothing);
      expect(inRow(1, find.text('Prerelease')), findsNothing);
      expect(inRow(2, find.text('Prerelease')), findsOneWidget);
      expect(inRow(3, find.text('Draft')), findsOneWidget);
      // A release that is both stays a draft: the filter never files a draft
      // under prereleases, so its row must not claim to be one.
      expect(inRow(3, find.text('Prerelease')), findsNothing);
      // Each state carries its own glyph, and the glyph is not what is spoken.
      expect(inRow(2, find.byIcon(Icons.science_outlined)), findsOneWidget);
      expect(
        inRow(3, find.byIcon(Icons.visibility_off_outlined)),
        findsOneWidget,
      );
      expect(inRow(1, find.byIcon(Icons.science_outlined)), findsNothing);
      // The badge sits on the name's line, left of the way into the release.
      final badge = tester.getCenter(inRow(2, find.text('Prerelease')));
      expect(
        badge.dy,
        closeTo(tester.getCenter(find.text('v2.0.0-rc.1')).dy, 1),
      );
      expect(
        badge.dx,
        lessThan(
          tester.getCenter(inRow(2, find.byIcon(Icons.chevron_right))).dx,
        ),
      );
      // The state reaches a screen reader as a word, once.
      expect(
        tester.getSemantics(find.text('v2.0.0-rc.1')).label,
        contains('Prerelease'),
      );
    },
  );

  testWidgets(
    'the filter bar is one row of label pills whose selection is the only fill',
    (tester) async {
      await pumpReleasesPage(
        tester,
        size: const Size(360, 800),
        handlers: {
          'GET api/releases/octo/app?page=1&per_page=20': () => BackendResult(
            statusCode: 200,
            data: releaseListJson([listReleaseJson(1, 'v1')]),
          ),
        },
      );
      final labels = ['All', 'Stable', 'Prerelease', 'Draft'];
      final centers = [
        for (final label in labels) tester.getCenter(find.text(label)),
      ];
      // Four filters on one row: nothing is stranded onto a second line.
      for (final center in centers) {
        expect(center.dy, centers.first.dy);
      }
      for (var index = 1; index < centers.length; index++) {
        expect(centers[index].dx, greaterThan(centers[index - 1].dx));
      }
      // The selection is a tonal fill, not a check mark beside the label.
      expect(find.byIcon(Icons.check), findsNothing);
      final semantics = tester.ensureSemantics();
      expect(
        tester.getSemantics(find.text('All')),
        isSemantics(
          label: 'All',
          isButton: true,
          isSelected: true,
          hasTapAction: true,
        ),
      );
      expect(
        tester.getSemantics(find.text('Stable')),
        isSemantics(
          label: 'Stable',
          isButton: true,
          isSelected: false,
          hasTapAction: true,
        ),
      );
      semantics.dispose();
      // That filtering is page-scoped is stated nowhere on screen.
      expect(
        find.text(
          'Filters apply to this page only. Draft visibility depends on repository permissions.',
        ),
        findsNothing,
      );
      await tester.ensureVisible(find.byKey(const ValueKey('draft')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('draft')));
      await tester.pumpAndSettle();
      expect(find.text('v1'), findsNothing);
      expect(find.text('No releases match on this page.'), findsOneWidget);
      await tester.ensureVisible(find.byKey(const ValueKey('all')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('all')));
      await tester.pumpAndSettle();
      expect(find.text('v1'), findsOneWidget);
    },
  );

  testWidgets(
    'a long page builds only what is on screen and keeps its pager on the surface',
    (tester) async {
      await pumpReleasesPage(
        tester,
        size: const Size(390, 844),
        handlers: {
          'GET api/releases/octo/app?page=1&per_page=20': () => BackendResult(
            statusCode: 200,
            data: releaseListJson([
              for (var id = 1; id <= 20; id++)
                listReleaseJson(id, 'release-$id'),
            ], hasNext: true),
          ),
          'GET api/releases/octo/app?page=2&per_page=20': () => BackendResult(
            statusCode: 200,
            data: releaseListJson([
              listReleaseJson(30, 'second-page-release'),
            ], page: 2),
          ),
        },
      );
      expect(find.text('release-1'), findsOneWidget);
      // Rows below the fold are not built at all.
      expect(find.text('release-20'), findsNothing);
      expect(find.text('Page 1'), findsOneWidget);
      // The pager is one tap away without scrolling past the page.
      expect(find.byTooltip('Next page').hitTestable(), findsOneWidget);
      expect(
        tester
            .widget<IconButton>(
              find.widgetWithIcon(IconButton, Icons.chevron_left),
            )
            .onPressed,
        isNull,
      );
      await tester.tap(find.byTooltip('Next page'));
      await tester.pumpAndSettle();
      expect(find.text('second-page-release'), findsOneWidget);
      expect(find.text('Page 2'), findsOneWidget);
      expect(
        tester
            .widget<IconButton>(
              find.widgetWithIcon(IconButton, Icons.chevron_right),
            )
            .onPressed,
        isNull,
      );
    },
  );

  testWidgets(
    'a large text scale wraps the meta facts instead of clipping them',
    (tester) async {
      tester.platformDispatcher.textScaleFactorTestValue = 2;
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
      await pumpReleasesPage(
        tester,
        size: const Size(360, 800),
        handlers: {
          'GET api/releases/octo/app?page=1&per_page=20': () => BackendResult(
            statusCode: 200,
            data: releaseListJson([
              listReleaseJson(
                1,
                'v1.2.3-preview.4-with-a-long-suffix',
                name: 'A release with a long tag and long name',
                prerelease: true,
                publishedAt: DateTime(
                  2025,
                  12,
                  31,
                  12,
                ).toUtc().toIso8601String(),
                assetsCount: 1234,
                downloadCount: 1234567,
              ),
            ]),
          ),
        },
      );
      // Nothing is lost and nothing overflows: the facts take a second meta
      // line rather than painting outside the row.
      expect(tester.takeException(), isNull);
      expect(find.text('1,234'), findsOneWidget);
      expect(find.text('1.2m'), findsOneWidget);
      expect(find.text('Dec 31, 2025'), findsOneWidget);
      expect(
        tester
            .getSemantics(find.text('A release with a long tag and long name'))
            .label,
        allOf(contains('1,234 assets'), contains('1.2m downloads')),
      );
      // The badge keeps its whole width; the name is the part that gives way.
      expect(
        find.descendant(
          of: find.byKey(const ValueKey(1)),
          matching: find.text('Prerelease'),
        ),
        findsOneWidget,
      );
    },
  );
}
