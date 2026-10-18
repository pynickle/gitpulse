import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/l10n/generated/app_localizations.dart';
import 'package:gitpulse/session/gitpulse_http.dart';
import 'package:gitpulse/session/session_controller.dart';
import 'package:gitpulse/timeline/release_timeline_card.dart';
import 'package:gitpulse/timeline/timeline_models.dart';
import 'package:gitpulse/timeline/timeline_screen.dart';
import 'package:gitpulse/timeline/timeline_session.dart';
import 'package:intl/intl.dart';

import 'timeline_test_support.dart';

class MountedTimeline {
  const MountedTimeline({required this.session, required this.container});

  final FakeSessionController session;
  final ProviderContainer container;
}

/// Mounts the Release Timeline with the account already signed in, and pumps
/// until its first round settles.
Future<MountedTimeline> pumpTimelineScreen(
  WidgetTester tester, {
  required Map<String, FutureOr<BackendResult> Function()> handlers,
  Size? size,
}) async {
  if (size != null) {
    tester.view.physicalSize = size;
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
  }
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
  return MountedTimeline(session: session, container: container);
}

Map<String, Object?> baselineRefresh(String baseline) => {
  'previousBaseline': baseline,
  'startedAt': '2026-10-05T00:00:00.000Z',
};

void main() {
  testWidgets(
    'a wide window shows three columns, a tablet two, and a phone one',
    (tester) async {
      final releases = [
        releaseJson(12, 'v1.2', '2026-10-04T12:00:00Z'),
        releaseJson(11, 'v1.1', '2026-10-04T11:00:00Z'),
        releaseJson(10, 'v1.0', '2026-10-04T10:00:00Z'),
        releaseJson(9, 'v0.9', '2026-10-04T09:00:00Z'),
        releaseJson(8, 'v0.8', '2026-10-04T08:00:00Z'),
        releaseJson(7, 'v0.7', '2026-10-04T07:00:00Z'),
      ];

      for (final (size, expectedColumns) in [
        (const Size(1400, 1200), 3),
        (const Size(900, 1200), 2),
        (const Size(500, 1200), 1),
      ]) {
        await pumpTimelineScreen(
          tester,
          size: size,
          handlers: {
            'GET api/settings': () => BackendResult(
              statusCode: 200,
              data: settingsJson([followJson('R_alpha', 'octo', 'alpha')]),
            ),
            'POST api/release-timeline/refresh': () => BackendResult(
              statusCode: 200,
              data: roundJson(
                pages: {'R_alpha': pageJson('octo', 'alpha', releases)},
                refresh: baselineRefresh('2026-10-01T00:00:00.000Z'),
              ),
            ),
          },
        );

        final cards = find.byType(ReleaseTimelineCard);
        expect(cards, findsWidgets, reason: 'cards for $size');
        final firstTop = tester.getTopLeft(cards.first).dy;
        var columnsInFirstRow = 0;
        for (final element in cards.evaluate()) {
          if ((element.renderObject! as RenderBox)
                  .localToGlobal(Offset.zero)
                  .dy !=
              firstTop) {
            break;
          }
          columnsInFirstRow++;
        }
        expect(columnsInFirstRow, expectedColumns, reason: 'columns at $size');

        await tester.pumpWidget(const SizedBox.shrink());
      }
    },
  );

  testWidgets(
    'date groups, the previous refresh marker, and the loaded-new count come from the shared baseline',
    (tester) async {
      await pumpTimelineScreen(
        tester,
        size: const Size(1400, 1200),
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
                  releaseJson(12, 'v1.2', '2026-10-04T12:00:00Z'),
                  releaseJson(11, 'v1.1', '2026-10-04T10:00:00Z'),
                  releaseJson(10, 'v1.0', '2026-10-03T10:00:00Z'),
                ]),
              },
              refresh: baselineRefresh('2026-10-04T00:00:00.000Z'),
            ),
          ),
        },
      );

      final english = DateFormat.yMMMd('en');
      expect(find.text('2 loaded new releases'), findsOneWidget);
      expect(find.textContaining('Previous refresh'), findsWidgets);
      expect(find.text(english.format(DateTime(2026, 10, 4))), findsOneWidget);
      expect(find.text(english.format(DateTime(2026, 10, 3))), findsOneWidget);
    },
  );

  testWidgets(
    'an account with no Followed Repositories shows the empty state and reads nothing else',
    (tester) async {
      final mounted = await pumpTimelineScreen(
        tester,
        handlers: {
          'GET api/settings': () =>
              BackendResult(statusCode: 200, data: settingsJson(const [])),
        },
      );

      expect(find.text('No Followed Repositories'), findsOneWidget);
      expect(mounted.session.requests, ['GET api/settings']);
    },
  );

  testWidgets(
    'Followed Repositories without published releases show the empty releases state',
    (tester) async {
      await pumpTimelineScreen(
        tester,
        handlers: {
          'GET api/settings': () => BackendResult(
            statusCode: 200,
            data: settingsJson([followJson('R_alpha', 'octo', 'alpha')]),
          ),
          'POST api/release-timeline/refresh': () => BackendResult(
            statusCode: 200,
            data: roundJson(
              pages: {'R_alpha': pageJson('octo', 'alpha', const [])},
              refresh: baselineRefresh('2026-10-01T00:00:00.000Z'),
            ),
          ),
        },
      );

      expect(find.text('No releases yet'), findsOneWidget);
    },
  );

  testWidgets(
    'a failed repository is named in the banner while the successful releases stay readable',
    (tester) async {
      final mounted = await pumpTimelineScreen(
        tester,
        size: const Size(1400, 1000),
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
                  releaseJson(11, 'v1.1', '2026-10-04T10:00:00Z'),
                ]),
                'R_beta': transientPageJson(),
              },
              transientIds: ['R_beta'],
              refresh: baselineRefresh('2026-10-01T00:00:00.000Z'),
            ),
          ),
          pageRequest({'R_beta': null}): () => BackendResult(
            statusCode: 200,
            data: roundJson(pages: {'R_beta': pageJson('octo', 'beta', [])}),
          ),
        },
      );

      expect(find.textContaining('octo/beta'), findsWidgets);
      expect(find.text('v1.1'), findsOneWidget);
      expect(find.text('Partial timeline coverage'), findsOneWidget);

      await tester.tap(find.widgetWithText(OutlinedButton, 'Retry').first);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));

      expect(mounted.session.requests, [
        'GET api/settings',
        'POST api/release-timeline/refresh',
        pageRequest({'R_beta': null}),
      ]);
      expect(find.text('v1.1'), findsOneWidget);
      expect(
        find.text('Some Followed Repositories failed to load'),
        findsNothing,
      );
    },
  );

  testWidgets(
    'a failed first round shows a retryable error, and retrying loads the timeline',
    (tester) async {
      var failing = true;
      await pumpTimelineScreen(
        tester,
        handlers: {
          'GET api/settings': () => BackendResult(
            statusCode: 200,
            data: settingsJson([followJson('R_alpha', 'octo', 'alpha')]),
          ),
          'POST api/release-timeline/refresh': () => failing
              ? const BackendResult(
                  statusCode: 200,
                  problem: BackendProblem.network,
                )
              : BackendResult(
                  statusCode: 200,
                  data: roundJson(
                    pages: {
                      'R_alpha': pageJson('octo', 'alpha', [
                        releaseJson(11, 'v1.1', '2026-10-04T10:00:00Z'),
                      ]),
                    },
                    refresh: baselineRefresh('2026-10-01T00:00:00.000Z'),
                  ),
                ),
          pageRequest({'R_alpha': null}): () => BackendResult(
            statusCode: 200,
            data: roundJson(
              pages: {
                'R_alpha': pageJson('octo', 'alpha', [
                  releaseJson(11, 'v1.1', '2026-10-04T10:00:00Z'),
                ]),
              },
            ),
          ),
        },
      );

      expect(find.text('Failed to load the Release Timeline.'), findsOneWidget);
      expect(find.textContaining('Could not reach'), findsOneWidget);

      failing = false;
      await tester.tap(find.widgetWithText(FilledButton, 'Retry'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));

      expect(find.text('Failed to load the Release Timeline.'), findsNothing);
      expect(find.text('v1.1'), findsOneWidget);
    },
  );

  testWidgets('waiting for the first round shows a loading indicator', (
    tester,
  ) async {
    final held = Completer<BackendResult>();
    await pumpTimelineScreen(
      tester,
      handlers: {
        'GET api/settings': () => BackendResult(
          statusCode: 200,
          data: settingsJson([followJson('R_alpha', 'octo', 'alpha')]),
        ),
        'POST api/release-timeline/refresh': () => held.future,
      },
    );

    expect(find.byType(CircularProgressIndicator), findsWidgets);

    held.complete(
      BackendResult(
        statusCode: 200,
        data: roundJson(
          pages: {'R_alpha': pageJson('octo', 'alpha', const [])},
          refresh: baselineRefresh('2026-10-01T00:00:00.000Z'),
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
  });

  testWidgets('a phone window renders one column without overflow', (
    tester,
  ) async {
    const longTitle =
        'A release title long enough to wrap across several lines on a narrow '
        'phone screen without breaking the card layout';
    await pumpTimelineScreen(
      tester,
      size: const Size(390, 844),
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
                  11,
                  'v1.1',
                  '2026-10-04T10:00:00Z',
                  name: longTitle,
                  description: 'Notes for this release.',
                  isPrerelease: true,
                  assetCount: 2,
                ),
              ]),
            },
            refresh: baselineRefresh('2026-10-01T00:00:00.000Z'),
          ),
        ),
      },
    );

    expect(find.text(longTitle), findsOneWidget);
    expect(find.text('Prerelease'), findsOneWidget);
    expect(find.text('2 assets'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'a failed Followed Repository read shows a retryable error instead of the no-follows state',
    (tester) async {
      var failing = true;
      await pumpTimelineScreen(
        tester,
        handlers: {
          'GET api/settings': () => failing
              ? const BackendResult(
                  statusCode: 503,
                  problem: BackendProblem.unavailable,
                )
              : BackendResult(
                  statusCode: 200,
                  data: settingsJson([followJson('R_alpha', 'octo', 'alpha')]),
                ),
          'POST api/release-timeline/refresh': () => BackendResult(
            statusCode: 200,
            data: roundJson(
              pages: {
                'R_alpha': pageJson('octo', 'alpha', [
                  releaseJson(11, 'v1.1', '2026-10-04T10:00:00Z'),
                ]),
              },
              refresh: baselineRefresh('2026-10-01T00:00:00.000Z'),
            ),
          ),
        },
      );

      // The account has not been shown to follow nothing, so the failure must
      // keep its retry instead of the no-follows empty state.
      expect(find.text('Failed to load the Release Timeline.'), findsOneWidget);
      expect(find.text('No Followed Repositories'), findsNothing);
      expect(find.widgetWithText(FilledButton, 'Retry'), findsOneWidget);

      failing = false;
      await tester.tap(find.widgetWithText(FilledButton, 'Retry'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));

      expect(find.text('Failed to load the Release Timeline.'), findsNothing);
      expect(find.text('v1.1'), findsOneWidget);
    },
  );
}
