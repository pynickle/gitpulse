import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/l10n/generated/app_localizations.dart';
import 'package:gitpulse/presentation/gitpulse_buttons.dart';
import 'package:gitpulse/presentation/gitpulse_progress.dart';
import 'package:gitpulse/presentation/gitpulse_state_views.dart';
import 'package:gitpulse/presentation/gitpulse_theme.dart';
import 'package:gitpulse/presentation/gitpulse_tokens.dart';
import 'package:gitpulse/presentation/gitpulse_toggles.dart';
import 'package:gitpulse/session/gitpulse_http.dart';
import 'package:gitpulse/timeline/release_timeline_card.dart';
import 'package:gitpulse/timeline/timeline_filter_panel.dart';
import 'package:gitpulse/timeline/timeline_screen.dart';
import 'package:gitpulse/timeline/timeline_toolbar.dart';

import 'timeline_filter_controls_test.dart' show pumpTimeline;
import 'timeline_test_support.dart';
import '../support/material_faces.dart';

/// The Release Timeline on the app's own presentation (ADR 0032).
///
/// The Timeline is the surface the rest of the client is read against, so this
/// file asserts two things about it: that the Material faces this migration
/// replaced are absent from its rendered tree, and that the type it is set in is
/// the Theme Preset's table rather than the platform's. Both are assertions
/// about what rendered — the project's rule against reading source text holds
/// here as everywhere.
void main() {
  Map<String, Object?> roundWith(List<Map<String, Object?>> releases) =>
      roundJson(
        pages: {'R_alpha': pageJson('octo', 'alpha', releases)},
        refresh: {
          // A baseline inside the loaded window, so the list carries its
          // Previous Refresh marker.
          'previousBaseline': '2026-10-04T00:00:00.000Z',
          'startedAt': '2026-10-20T00:00:00.000Z',
        },
      );

  Map<String, FutureOr<BackendResult> Function()> oneRelease() => {
    'GET api/settings': () => BackendResult(
      statusCode: 200,
      data: settingsJson([followJson('R_alpha', 'octo', 'alpha')]),
    ),
    'POST api/release-timeline/refresh': () => BackendResult(
      statusCode: 200,
      data: roundWith([
        releaseJson(12, 'v1.2', '2026-10-04T12:00:00Z', name: 'Newest'),
        releaseJson(11, 'v1.1', '2026-10-04T10:00:00Z', name: 'Older'),
        releaseJson(10, 'v1.0', '2026-10-03T10:00:00Z', name: 'Oldest'),
      ]),
    ),
  };

  testWidgets('the Timeline renders on the app’s own faces and none of the '
      'replaced ones', (tester) async {
    await pumpTimeline(
      tester,
      size: const Size(390, 844),
      handlers: oneRelease(),
    );

    expect(find.byType(ReleaseTimelineCard), findsWidgets);
    expect(
      find.descendant(
        of: find.byType(TimelineToolbar),
        matching: find.byType(GitPulseIconButton),
      ),
      findsWidgets,
    );
    // The search field is still the platform's own — a deliberate exception
    // rather than a gap (ADR 0032)…
    expect(find.byType(TextField), findsOneWidget);
    // …and nothing Material's is left to operate.
    expectNoReplacedMaterialFaces(find.byType(TimelineScreen));
    expect(tester.takeException(), isNull);
  });

  testWidgets('a date group header is the table’s group-header row, and a card '
      'names its repository in the Accent', (tester) async {
    // A window tall enough for the whole list, so the in-list marker is laid out
    // and measured with the rest of it.
    await pumpTimeline(
      tester,
      size: const Size(1400, 1200),
      handlers: oneRelease(),
    );

    final context = tester.element(find.byType(TimelineScreen));
    final table = gitPulseTypeTableOf(context);
    final header = tester.widget<Text>(find.text('Oct 4, 2026'));
    expect(header.style?.fontSize, table.titleSmall.size);
    expect(header.style?.fontWeight, FontWeight.w400);
    expect(header.style?.color, toneTextStrong(context));

    final brand = tester.widget<Text>(find.text('octo/alpha').first);
    expect(brand.style?.fontSize, table.labelMedium.size);
    expect(brand.style?.color, toneAccent(context));

    // The Previous Refresh marker keeps the smallest row the table has: its
    // measure is not a place this change may grow.
    final marker = tester.widget<Text>(find.text('Previous refresh').first);
    expect(marker.style?.fontSize, table.labelSmall.size);
  });

  testWidgets('the filter panel draws the app’s own toggles and buttons', (
    tester,
  ) async {
    await pumpTimeline(
      tester,
      size: const Size(390, 844),
      handlers: {
        'GET api/settings': () => BackendResult(
          statusCode: 200,
          data: settingsJson([
            for (var index = 0; index < 9; index++)
              followJson('R_$index', 'octo', 'repo$index'),
          ]),
        ),
        'POST api/release-timeline/refresh': () => BackendResult(
          statusCode: 200,
          data: roundJson(
            pages: {
              for (var index = 0; index < 9; index++)
                'R_$index': pageJson('octo', 'repo$index', [
                  releaseJson(
                    100 + index,
                    'v1.0.$index',
                    '2026-10-12T10:00:00Z',
                    name: 'Release $index',
                  ),
                ]),
            },
            refresh: {
              'previousBaseline': '2026-10-10T00:00:00.000Z',
              'startedAt': '2026-10-20T00:00:00.000Z',
            },
          ),
        ),
      },
    );
    final l10n = AppLocalizations.of(
      tester.element(find.byType(TimelineScreen)),
    );
    await tester.tap(find.byTooltip(l10n.timelineFilters));
    await tester.pumpAndSettle();

    final panel = find.byType(TimelineFilterPanel);
    expect(panel, findsOneWidget);
    expect(
      find.descendant(of: panel, matching: find.byType(GitPulseCheckbox)),
      findsNWidgets(9),
    );
    expect(
      find.descendant(of: panel, matching: find.byType(GitPulseSwitch)),
      findsOneWidget,
    );
    expect(
      find.descendant(of: panel, matching: find.byType(GitPulseButton)),
      findsWidgets,
    );
    // The sheet keeps its own search field, and no Material toggle or button
    // survives beside the app's own.
    expect(
      find.descendant(of: panel, matching: find.byType(TextField)),
      findsOneWidget,
    );
    expectNoReplacedMaterialFaces(panel);
    expect(tester.takeException(), isNull);
  });

  testWidgets('waiting for the first round shows the app’s own indicator', (
    tester,
  ) async {
    final held = Completer<BackendResult>();
    await pumpTimeline(
      tester,
      size: const Size(390, 844),
      handlers: {
        'GET api/settings': () => BackendResult(
          statusCode: 200,
          data: settingsJson([followJson('R_alpha', 'octo', 'alpha')]),
        ),
        'POST api/release-timeline/refresh': () => held.future,
      },
    );

    expect(find.byType(GitPulseProgressPage), findsWidgets);
    expect(find.byType(CircularProgressIndicator), findsNothing);
    expectNoReplacedMaterialFaces(find.byType(TimelineScreen));

    held.complete(BackendResult(statusCode: 200, data: roundWith(const [])));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
  });

  testWidgets('an empty account is told so on the app’s own empty state', (
    tester,
  ) async {
    await pumpTimeline(
      tester,
      size: const Size(390, 844),
      handlers: {
        'GET api/settings': () =>
            BackendResult(statusCode: 200, data: settingsJson(const [])),
      },
    );

    final message = find.byType(GitPulseMessageView);
    expect(message, findsOneWidget);
    expect(
      find.descendant(of: message, matching: find.byType(GitPulseButton)),
      findsNothing,
    );
    // An empty page is not the app acting: its glyph is a noun — the mark that says what the
    // page is about — so it is painted in a text tone rather than in the Accent, which belongs
    // to primary actions, the selected state and focus (CONTEXT.md).
    final context = tester.element(message);
    final glyph = tester.widget<Icon>(
      find.descendant(of: message, matching: find.byType(Icon)).first,
    );
    expect(glyph.color, toneTextMuted(context));
    expect(glyph.color, isNot(toneAccent(context)));
    expectNoReplacedMaterialFaces(find.byType(TimelineScreen));
  });

  testWidgets('a failed round offers the app’s own recovery action', (
    tester,
  ) async {
    await pumpTimeline(
      tester,
      size: const Size(390, 844),
      handlers: {
        'GET api/settings': () => BackendResult(
          statusCode: 200,
          data: settingsJson([followJson('R_alpha', 'octo', 'alpha')]),
        ),
        'POST api/release-timeline/refresh': () => const BackendResult(
          statusCode: 200,
          problem: BackendProblem.network,
        ),
      },
    );

    expect(find.byType(GitPulseMessageView), findsOneWidget);
    expect(
      find.widgetWithText(GitPulseButton, 'Retry'),
      findsOneWidget,
      reason: 'the failure keeps a retry, on the app’s own button',
    );
    // A failure stays in the danger tone: that is the one status a page-level message reports.
    final context = tester.element(find.byType(GitPulseMessageView));
    expect(
      tester
          .widget<Icon>(
            find
                .descendant(
                  of: find.byType(GitPulseMessageView),
                  matching: find.byType(Icon),
                )
                .first,
          )
          .color,
      toneDanger(context),
    );
    expectNoReplacedMaterialFaces(find.byType(TimelineScreen));
  });
}
