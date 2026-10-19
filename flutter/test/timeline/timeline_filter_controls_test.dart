import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/l10n/generated/app_localizations.dart';
import 'package:gitpulse/session/gitpulse_http.dart';
import 'package:gitpulse/session/session_controller.dart';
import 'package:gitpulse/timeline/release_timeline_card.dart';
import 'package:gitpulse/timeline/timeline_filters.dart';
import 'package:gitpulse/timeline/timeline_models.dart';
import 'package:gitpulse/timeline/timeline_screen.dart';
import 'package:gitpulse/timeline/timeline_session.dart';

import 'timeline_test_support.dart';

typedef MountedTimeline = ({
  FakeSessionController session,
  ProviderContainer container,
});

Future<MountedTimeline> pumpTimeline(
  WidgetTester tester, {
  required Map<String, FutureOr<BackendResult> Function()> handlers,
  Size size = const Size(1400, 1200),
}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  late FakeSessionController session;
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        sessionControllerProvider.overrideWith(() {
          session = FakeSessionController(
            SessionState(
              phase: SessionPhase.signedIn,
              identity: signedInIdentity(),
            ),
          )..handlers.addAll(handlers);
          return session;
        }),
        timelineEnvironmentProvider.overrideWithValue(
          TimelineEnvironment(localDateKey: utcPlusEight),
        ),
      ],
      child: MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: const Scaffold(body: TimelineScreen()),
      ),
    ),
  );
  final container = ProviderScope.containerOf(
    tester.element(find.byType(TimelineScreen)),
  );
  for (var attempt = 0; attempt < 40; attempt++) {
    await tester.pump(const Duration(milliseconds: 20));
    if (!container.read(releaseTimelineSessionProvider).loading) break;
  }
  return (session: session, container: container);
}

Map<String, Object?> baselineRefresh(String baseline) => {
  'previousBaseline': baseline,
  'startedAt': '2026-10-20T00:00:00.000Z',
};

void main() {
  testWidgets(
    'search and the notes option narrow the exposed cards without another request',
    (tester) async {
      final mounted = await pumpTimeline(
        tester,
        handlers: {
          'GET api/settings': () => BackendResult(
            statusCode: 200,
            data: settingsJson([followJson('R_alpha', 'octo', 'alpha')]),
          ),
          'POST api/release-timeline/refresh': () => BackendResult(
            statusCode: 200,
            data: roundJson(
              pages: {
                'R_alpha': pageJson('octo', 'alpha', [
                  releaseJson(
                    1,
                    'v1.0.0',
                    '2026-10-12T10:00:00Z',
                    name: 'Context bar default',
                    description: 'Explains the context bar.',
                  ),
                  releaseJson(
                    2,
                    'v2.0.0',
                    '2026-10-11T10:00:00Z',
                    name: 'Unrelated release',
                    description: 'A deep ZEBRA token lives here.',
                  ),
                ]),
              },
              refresh: baselineRefresh('2026-10-10T00:00:00.000Z'),
            ),
          ),
        },
      );
      final l10n = AppLocalizations.of(
        tester.element(find.byType(TimelineScreen)),
      );
      final requests = List.of(mounted.session.requests);
      expect(find.byType(ReleaseTimelineCard), findsNWidgets(2));

      await tester.enterText(find.byType(TextField), 'context');
      await tester.pump();
      expect(find.text('Context bar default'), findsOneWidget);
      expect(find.text('Unrelated release'), findsNothing);
      expect(find.text(l10n.timelineLoadedNew(1)), findsOneWidget);

      await tester.enterText(find.byType(TextField), 'zebra');
      await tester.pump();
      expect(find.text(l10n.timelineFilteredEmptyTitle), findsOneWidget);
      expect(
        mounted.container.read(releaseTimelineSessionProvider).loadedNewCount,
        0,
      );

      await tester.tap(find.byTooltip(l10n.timelineIncludeNotes));
      await tester.pump();
      expect(find.text('Unrelated release'), findsOneWidget);
      expect(find.text('Context bar default'), findsNothing);
      expect(find.text(l10n.timelineLoadedNew(1)), findsOneWidget);
      expect(mounted.session.requests, requests);

      await tester.tap(find.byTooltip(l10n.timelineSearchClear));
      await tester.pump();
      // Scroll preservation may keep only part of the restored list built.
      expect(
        mounted.container
            .read(releaseTimelineSessionProvider)
            .visibleGroups
            .expand((group) => group.items),
        hasLength(2),
      );
      expect(mounted.session.requests, requests);
    },
  );

  testWidgets(
    'the filter panel applies repository, prerelease, and date conditions',
    (tester) async {
      final mounted = await pumpTimeline(
        tester,
        handlers: {
          'GET api/settings': () => BackendResult(
            statusCode: 200,
            data: settingsJson([
              followJson('R_alpha', 'octo', 'alpha'),
              followJson('R_beta', 'octo', 'beta'),
            ]),
          ),
          'POST api/release-timeline/refresh': () => BackendResult(
            statusCode: 200,
            data: roundJson(
              pages: {
                'R_alpha': pageJson('octo', 'alpha', [
                  releaseJson(
                    10,
                    'v1.0.0',
                    '2026-10-12T10:00:00Z',
                    name: 'Alpha newest',
                  ),
                ]),
                'R_beta': pageJson('octo', 'beta', [
                  releaseJson(
                    20,
                    'v2.0.0-rc.1',
                    '2026-10-11T10:00:00Z',
                    name: 'Beta preview',
                    isPrerelease: true,
                  ),
                  releaseJson(
                    21,
                    'v1.9.0',
                    '2026-10-10T10:00:00Z',
                    name: 'Beta stable',
                  ),
                ]),
              },
              refresh: baselineRefresh('2026-10-09T00:00:00.000Z'),
            ),
          ),
        },
      );
      final l10n = AppLocalizations.of(
        tester.element(find.byType(TimelineScreen)),
      );
      TimelineFilterState filters() =>
          mounted.container.read(releaseTimelineSessionProvider).filters;

      await tester.tap(find.byTooltip(l10n.timelineFilters));
      await tester.pumpAndSettle();
      expect(find.text(l10n.timelineFilterPanelTitle), findsOneWidget);

      await tester.tap(find.widgetWithText(FilterChip, 'octo/alpha'));
      await tester.pump();
      expect(filters().repositoryIds, ['R_alpha']);
      expect(
        mounted.container.read(releaseTimelineSessionProvider).loadedNewCount,
        1,
      );
      expect(find.text('Alpha newest'), findsOneWidget);
      expect(find.text('Beta stable'), findsNothing);

      await tester.tap(find.widgetWithText(FilterChip, 'octo/alpha'));
      await tester.pump();
      expect(filters().repositoryIds, isEmpty);
      expect(find.byType(ReleaseTimelineCard), findsNWidgets(3));

      await tester.tap(find.text(l10n.timelineFilterHidePrereleases));
      await tester.pump();
      expect(filters().hidePrereleases, isTrue);
      expect(
        mounted.container.read(releaseTimelineSessionProvider).loadedNewCount,
        2,
      );
      expect(find.text('Beta preview'), findsNothing);
      expect(find.byType(ReleaseTimelineCard), findsNWidgets(2));

      await tester.tap(
        find.widgetWithText(
          OutlinedButton,
          l10n.timelineFilterTo(l10n.timelineFilterAnyDate),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('10'));
      await tester.tap(find.text('OK'));
      await tester.pumpAndSettle();
      expect(filters().dateRange.to, '2026-10-10');
      expect(find.text('Beta stable'), findsOneWidget);
      expect(find.text('Alpha newest'), findsNothing);

      // A lower bound after the upper bound drops the inverted upper bound.
      await tester.tap(
        find.widgetWithText(
          OutlinedButton,
          l10n.timelineFilterFrom(l10n.timelineFilterAnyDate),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('OK'));
      await tester.pumpAndSettle();
      expect(filters().dateRange.from, '2026-10-12');
      expect(filters().dateRange.to, isNull);
      expect(find.text('Alpha newest'), findsOneWidget);
      expect(find.text('Beta stable'), findsNothing);

      await tester.tap(find.text(l10n.timelineFilterDone));
      await tester.pumpAndSettle();
      expect(find.text(l10n.timelineFilterPanelTitle), findsNothing);

      await tester.tap(find.byTooltip(l10n.timelineFilters));
      await tester.pumpAndSettle();
      await tester.tap(find.text(l10n.timelineFilterClearAll));
      await tester.pump();
      expect(filters().hasActiveTimelineFilter, isFalse);
      expect(find.byType(ReleaseTimelineCard), findsNWidgets(3));
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('a filtered-empty window still offers explicit older loading', (
    tester,
  ) async {
    final mounted = await pumpTimeline(
      tester,
      handlers: {
        'GET api/settings': () => BackendResult(
          statusCode: 200,
          data: settingsJson([followJson('R_alpha', 'octo', 'alpha')]),
        ),
        'POST api/release-timeline/refresh': () => BackendResult(
          statusCode: 200,
          data: roundJson(
            pages: {
              'R_alpha': pageJson(
                'octo',
                'alpha',
                [
                  releaseJson(
                    100,
                    'v1.0.0',
                    '2026-10-18T10:00:00Z',
                    name: 'Recent release',
                  ),
                ],
                hasOlderReleases: true,
                endCursor: 'a1',
              ),
            },
            refresh: baselineRefresh('2026-10-17T00:00:00.000Z'),
          ),
        ),
        pageRequest({'R_alpha': 'a1'}): () => BackendResult(
          statusCode: 200,
          data: roundJson(
            pages: {
              'R_alpha': pageJson('octo', 'alpha', [
                releaseJson(
                  5,
                  'v0.1.0',
                  '2026-10-01T10:00:00Z',
                  name: 'Ancient history',
                ),
              ]),
            },
          ),
        ),
      },
    );
    final l10n = AppLocalizations.of(
      tester.element(find.byType(TimelineScreen)),
    );

    await tester.enterText(find.byType(TextField), 'ancient');
    await tester.pump();
    expect(find.text(l10n.timelineFilteredEmptyTitle), findsOneWidget);
    expect(find.text('Recent release'), findsNothing);

    await tester.tap(find.widgetWithText(FilledButton, l10n.timelineLoadOlder));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));

    expect(find.text('Ancient history'), findsOneWidget);
    expect(find.text('Recent release'), findsNothing);
    expect(mounted.session.requests.last, pageRequest({'R_alpha': 'a1'}));
  });
}
