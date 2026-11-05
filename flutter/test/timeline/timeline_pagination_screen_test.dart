import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/session/gitpulse_http.dart';
import 'package:gitpulse/timeline/release_timeline_card.dart';
import 'package:gitpulse/timeline/timeline_session.dart';

import '../support/named_actions.dart';
import 'timeline_screen_test.dart' show pumpTimelineScreen;
import 'timeline_test_support.dart';

void main() {
  testWidgets(
    'an empty display page still offers explicit loading and only requests one round per tap',
    (tester) async {
      final mounted = await pumpTimelineScreen(
        tester,
        handlers: {
          'GET api/settings': () => BackendResult(
            statusCode: 200,
            data: settingsJson([followJson('A', 'octo', 'a')]),
          ),
          'POST api/release-timeline/refresh': () => BackendResult(
            statusCode: 200,
            data: roundJson(
              pages: {
                'A': pageJson(
                  'octo',
                  'a',
                  [],
                  hasOlderReleases: true,
                  endCursor: 'a1',
                ),
              },
            ),
          ),
          pageRequest({'A': 'a1'}): () => BackendResult(
            statusCode: 200,
            data: roundJson(
              pages: {
                'A': pageJson('octo', 'a', [
                  releaseJson(1, 'a1', '2026-10-01T00:00:00Z'),
                ]),
              },
            ),
          ),
        },
      );
      expect(find.text('No releases yet'), findsOneWidget);
      await tester.tap(find.text('Load older'));
      await tester.pumpAndSettle();
      expect(find.text('a1'), findsOneWidget);
      expect(find.text('Load older'), findsNothing);
      expect(mounted.session.requests, [
        'GET api/settings',
        'POST api/release-timeline/refresh',
        pageRequest({'A': 'a1'}),
      ]);
    },
  );

  for (final width in [500.0, 900.0, 1400.0]) {
    testWidgets(
      'late insertions preserve the visible release and pixel offset at width $width',
      (tester) async {
        final mounted = await pumpTimelineScreen(
          tester,
          size: Size(width, 800),
          handlers: {
            'GET api/settings': () => BackendResult(
              statusCode: 200,
              data: settingsJson([followJson('A', 'octo', 'a')]),
            ),
            'POST api/release-timeline/refresh': () => BackendResult(
              statusCode: 200,
              data: roundJson(
                pages: {
                  'A': pageJson(
                    'octo',
                    'a',
                    [
                      for (var id = 40; id > 0; id--)
                        releaseJson(
                          id,
                          'v$id',
                          DateTime.utc(2026, 10, 1, id).toIso8601String(),
                          description: id.isEven
                              ? 'Short notes.'
                              : 'Long notes. ' * 35,
                        ),
                    ],
                    hasOlderReleases: true,
                    endCursor: 'a1',
                  ),
                },
              ),
            ),
            pageRequest({'A': 'a1'}): () => BackendResult(
              statusCode: 200,
              data: roundJson(
                pages: {
                  'A': pageJson('octo', 'a', [
                    for (var id = 60; id > 40; id--)
                      releaseJson(
                        id,
                        'late$id',
                        DateTime.utc(2026, 10, 1, 40, id).toIso8601String(),
                        description: 'Inserted notes. ' * 30,
                      ),
                  ]),
                },
              ),
            ),
          },
        );
        await tester.drag(
          find.descendant(
            of: find.byType(CustomScrollView),
            matching: find.byType(Scrollable),
          ),
          const Offset(0, -1100),
        );
        await tester.pumpAndSettle();
        final cards = find.byType(ReleaseTimelineCard).evaluate().where((
          element,
        ) {
          final box = element.renderObject! as RenderBox;
          final y = box.localToGlobal(Offset.zero).dy;
          return y >= 120 && y < 600;
        }).toList();
        expect(cards, isNotEmpty);
        final key = (cards.first.widget as ReleaseTimelineCard).item.key;
        final anchor = find.byWidgetPredicate(
          (w) => w is ReleaseTimelineCard && w.item.key == key,
        );
        final before = tester.getTopLeft(anchor).dy;
        await mounted.container
            .read(releaseTimelineSessionProvider.notifier)
            .loadOlder();
        await tester.pumpAndSettle();
        expect(anchor, findsOneWidget);
        expect(tester.getTopLeft(anchor).dy, closeTo(before, 1));
        expect(tester.takeException(), isNull);
      },
    );
  }
  testWidgets(
    'an unreadable repository is retried by the next refresh, with no banner above the list',
    (tester) async {
      // The repository whose page could not be read is not named above the list;
      // the Timeline's own refresh asks for it again, and its releases appear
      // when it answers. Nothing above the list is added or removed either way,
      // so the release a reader is on never moves for a banner's sake.
      var betaFails = true;
      await pumpTimelineScreen(
        tester,
        size: const Size(500, 900),
        handlers: {
          'GET api/settings': () => BackendResult(
            statusCode: 200,
            data: settingsJson([
              followJson('A', 'octo', 'a'),
              followJson('B', 'octo', 'b'),
            ]),
          ),
          'POST api/release-timeline/refresh': () => BackendResult(
            statusCode: 200,
            data: roundJson(
              pages: {
                'A': pageJson('octo', 'a', [
                  for (var id = 30; id > 0; id--)
                    releaseJson(
                      id,
                      'v$id',
                      DateTime.utc(2026, 10, 1, id).toIso8601String(),
                    ),
                ]),
                'B': betaFails
                    ? transientPageJson()
                    : pageJson('octo', 'b', [
                        releaseJson(40, 'recovered', '2026-10-04T00:00:00Z'),
                      ]),
              },
            ),
          ),
        },
      );

      expect(find.text('v30'), findsOneWidget);
      expect(
        find.text('Some Followed Repositories failed to load'),
        findsNothing,
      );
      expect(find.textContaining('octo/b'), findsNothing);

      betaFails = false;
      await tester.tap(findNamedAction('Reload'));
      await tester.pumpAndSettle();

      expect(find.text('recovered'), findsOneWidget);
      expect(
        find.text('Some Followed Repositories failed to load'),
        findsNothing,
      );
      expect(tester.takeException(), isNull);
    },
  );
}
