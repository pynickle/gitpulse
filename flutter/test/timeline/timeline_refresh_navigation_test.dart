import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:drift/native.dart';
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/presentation/gitpulse_buttons.dart';
import 'package:gitpulse/presentation/gitpulse_progress.dart';
import 'package:gitpulse/presentation/gitpulse_toggles.dart';
import 'package:gitpulse/presentation/gitpulse_tokens.dart';
import 'package:gitpulse/timeline/release_timeline_card.dart';
import 'package:gitpulse/timeline/timeline_cache.dart';
import 'package:gitpulse/timeline/timeline_screen.dart';
import 'package:path/path.dart' as p;

import '../follows/follows_test_support.dart';
import '../session_flow_test.dart' as auth;
import '../support/named_actions.dart';
import '../support/settling.dart';
import 'timeline_test_support.dart';

const _backToTop = 'Back to top';

String _published(int minute) =>
    DateTime.utc(2026, 10, 25, 0, minute).toIso8601String();

/// A baseline after every release below, so no release counts as new.
final _lateBaseline = DateTime.utc(2026, 10, 26).toIso8601String();

/// [count] releases one minute apart, newest first.
List<Map<String, Object?>> _releases(
  int count, {
  Set<int> prereleases = const {},
}) => [
  for (var id = count; id > 0; id--)
    releaseJson(
      id,
      'v$id',
      _published(id),
      isPrerelease: prereleases.contains(id),
    ),
];

/// One app mounted on the Timeline, with the controlled backend behind it.
class _Timeline {
  _Timeline(this.server);

  final FollowsServer server;

  /// Coordinated rounds read so far, counted by the request the refresh entry
  /// makes.
  int get rounds => server.featureRequests
      .where(
        (request) =>
            request.method == 'POST' &&
            request.uri.path.endsWith('/api/release-timeline/refresh'),
      )
      .length;
}

Future<_Timeline> _openTimeline(
  WidgetTester tester, {
  double width = 390,
  double height = 800,
  List<Map<String, Object?>>? releases,
  Map<String, Object?>? pages,
  List<Map<String, Object?>>? follows,
  bool older = false,
  Map<String, Object?>? refresh,
  Map<String, Object?> preferences = const {},
  bool disableAnimations = false,
}) async {
  tester.view.physicalSize = Size(width, height);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  if (disableAnimations) {
    tester.binding.platformDispatcher.accessibilityFeaturesTestValue =
        const FakeAccessibilityFeatures(disableAnimations: true);
    addTearDown(
      tester.binding.platformDispatcher.clearAccessibilityFeaturesTestValue,
    );
  }
  final directory = Directory.systemTemp.createTempSync('timeline-refresh-');
  final file = File(p.join(directory.path, 'preferences.json'))
    ..writeAsStringSync(jsonEncode(preferences));
  final cache = TimelineCache(NativeDatabase.memory());
  addTearDown(() => _closeTimeline(tester, cache));
  addTearDown(() {
    file.deleteSync();
    directory.deleteSync();
  });
  final server = FollowsServer();
  server.settings['followedRepositories'] =
      follows ?? [followJson('R_alpha', 'octo', 'alpha')];
  server.pages =
      pages ??
      {
        'R_alpha': pageJson(
          'octo',
          'alpha',
          releases ?? _releases(40),
          hasOlderReleases: older,
          endCursor: older ? 'cursor-1' : null,
        ),
      };
  server.refresh = refresh;
  await auth.mountApp(
    tester,
    server,
    timelineCache: cache,
    presentationFile: file,
    timelineNow: () => DateTime.utc(2026, 10, 26),
  );
  await auth.submitField(
    tester,
    label: preferences['language'] == 'zh' ? '密码' : 'Password',
    value: 'correct-horse',
    action: preferences['language'] == 'zh' ? '解锁' : 'Unlock',
  );
  await settleUi(tester);
  return _Timeline(server);
}

Future<void> _closeTimeline(WidgetTester tester, TimelineCache cache) async {
  await tester.pumpWidget(const SizedBox.shrink());
  var closed = false;
  final closing = cache.close().whenComplete(() => closed = true);
  await pumpUntil(tester, () => closed, reason: 'the in-memory cache closes');
  await closing;
}

/// Holds the next round open, so a refresh can be inspected while it reads.
Future<Completer<void>> _holdNextRound(
  WidgetTester tester,
  FollowsServer server,
) async {
  final held = Completer<void>();
  server.holdRound = held.future;
  addTearDown(() {
    if (!held.isCompleted) held.complete();
  });
  await tester.pump();
  return held;
}

double _listHeight(WidgetTester tester) =>
    tester.getSize(find.byType(CustomScrollView)).height;

Future<void> _scrollBy(WidgetTester tester, double dy) async {
  await tester.drag(find.byType(CustomScrollView), Offset(0, dy));
  await tester.pumpAndSettle();
}

/// Pulls the list far enough to arm the refresh, then lets the indicator's own
/// snap animation finish so the round is really requested.
Future<void> _pull(
  WidgetTester tester, {
  Finder? target,
  double? distance,
}) async {
  await tester.drag(
    target ?? find.byType(CustomScrollView),
    Offset(0, distance ?? _listHeight(tester) * 0.6),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 250));
  await settleUi(tester, frames: 5);
}

Finder _card(String tag) => find.byWidgetPredicate(
  (widget) => widget is ReleaseTimelineCard && widget.item.tagName == tag,
);

Finder get _returnToTop => findNamedAction(_backToTop);

Finder get _refreshButton => findNamedAction('Reload');

/// The opacity the return-to-top button is currently painted at.
double _fadeValue(WidgetTester tester) {
  final opacity = find
      .ancestor(of: _returnToTop, matching: find.byType(AnimatedOpacity))
      .first;
  return tester
      .widget<FadeTransition>(
        find
            .descendant(of: opacity, matching: find.byType(FadeTransition))
            .first,
      )
      .opacity
      .value;
}

/// Reads further into the Timeline and reports the release now at the top of
/// the list.
Future<({Finder card, double top})> _readFurther(WidgetTester tester) async {
  await _scrollBy(tester, -_listHeight(tester) * 1.8);
  final viewport = tester.getRect(find.byType(CustomScrollView));
  final card = find.byType(ReleaseTimelineCard).evaluate().firstWhere((
    element,
  ) {
    final box = element.renderObject! as RenderBox;
    final top = box.localToGlobal(Offset.zero).dy;
    return top < viewport.bottom && top + box.size.height > viewport.top;
  });
  final key = (card.widget as ReleaseTimelineCard).item.key;
  final finder = find.byWidgetPredicate(
    (widget) => widget is ReleaseTimelineCard && widget.item.key == key,
  );
  return (card: finder, top: tester.getTopLeft(finder).dy);
}

void main() {
  group('the loaded-new count', () {
    testWidgets('is announced with its complete meaning', (tester) async {
      final handle = tester.ensureSemantics();
      await _openTimeline(
        tester,
        refresh: {'previousBaseline': _published(30)},
      );

      expect(find.textContaining('Previous refresh ·'), findsOneWidget);
      final count = find.text('10 new releases');
      expect(count, findsOneWidget);

      final semantics = tester.getSemantics(count).getSemanticsData();
      expect(semantics.label, '10 loaded new releases');
      expect(
        semantics.flagsCollection.isLiveRegion,
        isTrue,
        reason: 'a changed count is announced without moving focus',
      );
      handle.dispose();
    });

    testWidgets('stays hidden without a refresh baseline', (tester) async {
      await _openTimeline(tester);
      expect(find.textContaining('new release'), findsNothing);
      expect(find.textContaining('Previous refresh'), findsNothing);
    });

    testWidgets('stays hidden when nothing is new', (tester) async {
      await _openTimeline(tester, refresh: {'previousBaseline': _lateBaseline});
      expect(find.textContaining('Previous refresh ·'), findsOneWidget);
      expect(find.textContaining('new release'), findsNothing);
    });

    testWidgets('reads naturally in either language', (tester) async {
      await _openTimeline(
        tester,
        refresh: {'previousBaseline': _published(30)},
        preferences: {'language': 'zh'},
      );
      expect(find.text('新版本 10'), findsOneWidget);
      expect(find.textContaining('上次刷新 ·'), findsOneWidget);
    });

    testWidgets('follows the search and the active filter', (tester) async {
      await _openTimeline(
        tester,
        releases: _releases(40, prereleases: {40}),
        refresh: {'previousBaseline': _published(30)},
      );
      expect(find.text('10 new releases'), findsOneWidget);

      await tester.tap(findNamedAction('Filters'));
      await tester.pumpAndSettle();
      await tester.tap(find.byType(GitPulseSwitch));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Done'));
      await tester.pumpAndSettle();
      expect(find.text('9 new releases'), findsOneWidget);

      await tester.enterText(find.byType(TextField), 'v39');
      await tester.pumpAndSettle();
      expect(find.text('1 new release'), findsOneWidget);
    });
  });

  group('pull to refresh', () {
    testWidgets('reads exactly one round from the true top', (tester) async {
      final timeline = await _openTimeline(tester);
      final before = timeline.rounds;
      final held = await _holdNextRound(tester, timeline.server);

      await _pull(tester);

      expect(timeline.rounds, before + 1);
      expect(
        find.byType(RefreshProgressIndicator),
        findsOneWidget,
        reason: 'the pull shows its progress at the top of the list',
      );
      expect(
        find.byWidgetPredicate((widget) => widget is CircularProgressIndicator),
        findsOneWidget,
        reason: 'and it is the only progress on screen',
      );

      held.complete();
      await settleUi(tester);
      expect(find.byType(RefreshProgressIndicator), findsNothing);
    });

    testWidgets('stays available on a list shorter than the screen', (
      tester,
    ) async {
      final timeline = await _openTimeline(tester, releases: _releases(2));
      final before = timeline.rounds;

      await _pull(tester);

      expect(timeline.rounds, before + 1);
    });

    testWidgets('stays available on a refreshable empty result', (
      tester,
    ) async {
      final timeline = await _openTimeline(tester, releases: const []);
      expect(find.text('No releases yet'), findsOneWidget);
      final before = timeline.rounds;

      await _pull(tester, target: find.text('No releases yet'), distance: 400);

      expect(timeline.rounds, before + 1);
      expect(find.text('No releases yet'), findsOneWidget);
    });

    testWidgets('never restarts a round another entry is reading', (
      tester,
    ) async {
      final timeline = await _openTimeline(tester);
      final before = timeline.rounds;
      final held = await _holdNextRound(tester, timeline.server);

      await _pull(tester);
      expect(timeline.rounds, before + 1);
      expect(
        tester.widget<GitPulseIconButton>(_refreshButton).onPressed,
        isNull,
      );

      await tester.tap(findNamedAction('Reload'));
      await settleUi(tester, frames: 5);
      await _pull(tester);

      expect(timeline.rounds, before + 1);
      held.complete();
      await settleUi(tester);
    });
  });

  group('a refresh in flight', () {
    testWidgets('keeps the release being read and shows one progress', (
      tester,
    ) async {
      final timeline = await _openTimeline(tester);
      final reading = await _readFurther(tester);
      final held = await _holdNextRound(tester, timeline.server);

      await tester.tap(findNamedAction('Reload'));
      await settleUi(tester, frames: 5);

      expect(reading.card, findsOneWidget);
      expect(tester.getTopLeft(reading.card).dy, closeTo(reading.top, 1));
      // The round is the app's own indicator in the toolbar, and the page
      // itself keeps the releases it is reading.
      expect(find.byType(GitPulseProgressInline), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsNothing);
      expect(find.text('Loading the Release Timeline'), findsNothing);

      held.complete();
      await settleUi(tester);
    });

    testWidgets('presents usable results from the top of the list', (
      tester,
    ) async {
      final timeline = await _openTimeline(tester);
      await _readFurther(tester);
      final held = await _holdNextRound(tester, timeline.server);

      await tester.tap(findNamedAction('Reload'));
      await settleUi(tester, frames: 5);
      final page = timeline.server.pages['R_alpha']! as Map<String, Object?>;
      page['releases'] = [
        releaseJson(41, 'v41-new', _published(41)),
        ...page['releases']! as List,
      ];
      held.complete();
      await settleUi(tester);
      await tester.pumpAndSettle();

      expect(find.text('v41-new').hitTestable(), findsOneWidget);
      expect(
        _returnToTop.hitTestable(),
        findsNothing,
        reason: 'the reader is back at the top',
      );
    });

    testWidgets('presents new results without fading when already at the top', (
      tester,
    ) async {
      final timeline = await _openTimeline(tester);
      final held = await _holdNextRound(tester, timeline.server);
      timeline.server.pages['R_alpha'] = pageJson(
        'octo',
        'alpha',
        _releases(41),
      );

      await tester.tap(findNamedAction('Reload'));
      await settleUi(tester, frames: 5);
      held.complete();
      await pumpUntil(
        tester,
        () =>
            tester.widget<GitPulseIconButton>(_refreshButton).onPressed != null,
        reason: 'refresh results arrive',
      );
      await tester.pump();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 60));

      expect(find.text('v41').hitTestable(), findsOneWidget);
      final fade = find
          .ancestor(
            of: find.byType(CustomScrollView),
            matching: find.byType(FadeTransition),
          )
          .first;
      expect(tester.widget<FadeTransition>(fade).opacity.value, 1);
      expect(_returnToTop.hitTestable(), findsNothing);
    });

    testWidgets('keeps the cards and the position when it fails completely', (
      tester,
    ) async {
      final timeline = await _openTimeline(tester);
      final reading = await _readFurther(tester);
      final held = await _holdNextRound(tester, timeline.server);

      await tester.tap(findNamedAction('Reload'));
      await settleUi(tester, frames: 5);
      timeline.server.roundStatus = 500;
      held.complete();
      await settleUi(tester);

      expect(reading.card, findsOneWidget);
      expect(tester.getTopLeft(reading.card).dy, closeTo(reading.top, 1));
      expect(find.byType(CircularProgressIndicator), findsNothing);
      expect(
        tester.widget<GitPulseIconButton>(_refreshButton).onPressed,
        isNotNull,
      );

      await _scrollBy(tester, -_listHeight(tester) * 12);
      // The reader still has the releases they came for, so the footer offers
      // the retry without repeating what failed; only an empty page explains it.
      expect(
        find.text(
          'The GitPulse backend could not return the timeline. '
          'Try again.',
        ),
        findsNothing,
      );
      expect(find.widgetWithText(GitPulseButton, 'Retry'), findsOneWidget);
    });

    testWidgets('keeps the search and the filters that are active', (
      tester,
    ) async {
      final timeline = await _openTimeline(tester);
      await tester.enterText(find.byType(TextField), 'v2');
      await tester.pumpAndSettle();
      final held = await _holdNextRound(tester, timeline.server);

      await tester.tap(findNamedAction('Reload'));
      await settleUi(tester, frames: 5);
      held.complete();
      await settleUi(tester);

      expect(
        tester.widget<TextField>(find.byType(TextField)).controller?.text,
        'v2',
      );
      expect(_card('v40'), findsNothing);
      expect(_card('v29'), findsOneWidget);
    });

    testWidgets('keeps the reader’s focus when its error appears', (
      tester,
    ) async {
      final timeline = await _openTimeline(tester);
      final reading = await _readFurther(tester);
      final held = await _holdNextRound(tester, timeline.server);

      await tester.tap(find.byType(TextField));
      await tester.pump();
      await tester.tap(findNamedAction('Reload'));
      await settleUi(tester, frames: 5);
      final focus = FocusManager.instance.primaryFocus;
      timeline.server.roundStatus = 500;
      held.complete();
      await settleUi(tester);

      expect(FocusManager.instance.primaryFocus, same(focus));
      expect(reading.card, findsOneWidget);
      expect(tester.getTopLeft(reading.card).dy, closeTo(reading.top, 1));
    });

    testWidgets('keeps the usable results of a partly failed round', (
      tester,
    ) async {
      final timeline = await _openTimeline(
        tester,
        follows: [
          followJson('R_alpha', 'octo', 'alpha'),
          followJson('R_beta', 'octo', 'beta'),
        ],
        pages: {
          'R_alpha': pageJson('octo', 'alpha', _releases(3)),
          'R_beta': pageJson('octo', 'beta', [
            releaseJson(100, 'beta-1', _published(5)),
          ]),
        },
      );
      expect(find.text('beta-1'), findsOneWidget);

      timeline.server.pages['R_beta'] = transientPageJson();
      await _pull(tester);

      expect(_card('v3'), findsOneWidget);
      expect(
        find.text('Some Followed Repositories failed to load'),
        findsOneWidget,
      );
    });
  });

  group('the return-to-top button', () {
    testWidgets('appears past one list height and ignores direction', (
      tester,
    ) async {
      await _openTimeline(tester);
      final viewport = _listHeight(tester);
      expect(_returnToTop.hitTestable(), findsNothing);

      await _scrollBy(tester, -viewport * 0.8);
      expect(
        _returnToTop.hitTestable(),
        findsNothing,
        reason: 'the reader is still within one screen of the top',
      );

      await _scrollBy(tester, -viewport);
      expect(_returnToTop.hitTestable(), findsOneWidget);

      await _scrollBy(tester, viewport * 0.3);
      expect(
        _returnToTop.hitTestable(),
        findsOneWidget,
        reason: 'scrolling back does not hide it on the way',
      );
      await tester.pump(const Duration(seconds: 2));
      expect(
        _returnToTop.hitTestable(),
        findsOneWidget,
        reason: 'nor does standing still',
      );

      await _scrollBy(tester, viewport * 3);
      expect(_returnToTop.hitTestable(), findsNothing);
    });

    testWidgets('returns to the newest release without reading again', (
      tester,
    ) async {
      final timeline = await _openTimeline(tester);
      await _scrollBy(tester, -_listHeight(tester) * 2);
      final rounds = timeline.rounds;

      await tester.tap(_returnToTop);
      await tester.pumpAndSettle();

      expect(find.text('v40').hitTestable(), findsOneWidget);
      expect(timeline.rounds, rounds);
      expect(_returnToTop.hitTestable(), findsNothing);
    });

    testWidgets('skips distant history under a brief list transition', (
      tester,
    ) async {
      final timeline = await _openTimeline(tester, releases: _releases(200));
      await _scrollBy(tester, -_listHeight(tester) * 12);
      final position = tester
          .state<ScrollableState>(find.byType(Scrollable).last)
          .position;
      final start = position.pixels;
      expect(
        start - position.minScrollExtent,
        greaterThan(_listHeight(tester) * 3),
      );
      final rounds = timeline.rounds;
      final toolbarTop = tester.getTopLeft(find.byType(TextField));
      final seen = <String>{};
      void recordCards() {
        seen.addAll(
          tester
              .widgetList<ReleaseTimelineCard>(find.byType(ReleaseTimelineCard))
              .map((card) => card.item.tagName),
        );
      }

      recordCards();
      final previousBuildCallback = debugOnRebuildDirtyWidget;
      addTearDown(() => debugOnRebuildDirtyWidget = previousBuildCallback);
      debugOnRebuildDirtyWidget = (element, builtOnce) {
        previousBuildCallback?.call(element, builtOnce);
        final widget = element.widget;
        if (widget is ReleaseTimelineCard) seen.add(widget.item.tagName);
      };

      await tester.tap(_returnToTop);
      await tester.pump();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 60));
      expect(
        position.pixels,
        start,
        reason: 'distant returns fade instead of scrolling through history',
      );
      final fade = find
          .ancestor(
            of: find.byType(CustomScrollView),
            matching: find.byType(FadeTransition),
          )
          .first;
      expect(
        tester.widget<FadeTransition>(fade).opacity.value,
        inExclusiveRange(0, 1),
      );

      for (var frame = 0; frame < 24; frame++) {
        await tester.pump(const Duration(milliseconds: 16));
        expect(tester.getTopLeft(find.byType(TextField)), toolbarTop);
      }
      expect(find.text('v200').hitTestable(), findsOneWidget);
      expect(tester.widget<FadeTransition>(fade).opacity.value, 1);
      expect(
        seen.length,
        lessThan(24),
        reason: 'only the departure and arrival windows are built',
      );
      expect(timeline.rounds, rounds);
      expect(_returnToTop.hitTestable(), findsNothing);
    });

    testWidgets('a touch interrupts a distant return before it relocates', (
      tester,
    ) async {
      await _openTimeline(tester);
      await _scrollBy(tester, -_listHeight(tester) * 6);
      await tester.tap(_returnToTop);
      await tester.pump();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 60));

      final gesture = await tester.startGesture(
        tester.getCenter(find.byType(CustomScrollView)),
      );
      await tester.pump();
      await gesture.cancel();
      await tester.pumpAndSettle();

      expect(find.text('v40').hitTestable(), findsNothing);
      expect(_returnToTop.hitTestable(), findsOneWidget);
      final fade = find
          .ancestor(
            of: find.byType(CustomScrollView),
            matching: find.byType(FadeTransition),
          )
          .first;
      expect(tester.widget<FadeTransition>(fade).opacity.value, 1);
    });

    for (final reducedMotion in [false, true]) {
      testWidgets(
        'returns from restored deep history with reduced motion $reducedMotion',
        (tester) async {
          await _openTimeline(tester, disableAnimations: reducedMotion);
          await _scrollBy(tester, -_listHeight(tester) * 6);
          await tester.tap(find.text('Settings').last);
          await settleUi(tester);
          await tester.tap(find.text('Timeline').last);
          await settleUi(tester);
          expect(find.text('v40').hitTestable(), findsNothing);

          await tester.tap(_returnToTop);
          if (reducedMotion) {
            await tester.pump();
            await tester.pump();
          } else {
            await tester.pumpAndSettle();
          }
          expect(find.text('v40').hitTestable(), findsOneWidget);
          expect(_returnToTop.hitTestable(), findsNothing);

          await tester.tap(find.text('Settings').last);
          await settleUi(tester);
          await tester.tap(find.text('Timeline').last);
          await settleUi(tester);
          expect(find.text('v40').hitTestable(), findsOneWidget);
          expect(tester.takeException(), isNull);
        },
      );
    }

    testWidgets('positions directly when motion is reduced', (tester) async {
      await _openTimeline(tester, disableAnimations: true);
      await _scrollBy(tester, -_listHeight(tester) * 2);

      await tester.tap(_returnToTop);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 16));

      expect(find.text('v40').hitTestable(), findsOneWidget);
      expect(
        _returnToTop.hitTestable(),
        findsNothing,
        reason: 'its visibility changes at once, without a fade',
      );
    });

    testWidgets('is named for keyboard and screen-reader use', (tester) async {
      await _openTimeline(tester);
      await _scrollBy(tester, -_listHeight(tester) * 2);

      final semantics = tester.getSemantics(_returnToTop).getSemanticsData();
      expect(semantics.label, _backToTop);
      expect(
        semantics.flagsCollection.isButton,
        isTrue,
        reason: 'the action is a button, not a gesture to discover',
      );
      expect(
        semantics.hasAction(SemanticsAction.tap),
        isTrue,
        reason: 'and assistive technology can activate it',
      );
    });

    testWidgets('leaves the last card and Load older clear of itself', (
      tester,
    ) async {
      await _openTimeline(tester, releases: _releases(20), older: true);
      for (var i = 0; i < 8; i++) {
        await _scrollBy(tester, -_listHeight(tester));
      }

      final loadOlder = find.text('Load older');
      expect(loadOlder, findsOneWidget);
      expect(_returnToTop.hitTestable(), findsOneWidget);
      expect(
        tester.getRect(loadOlder).bottom,
        lessThanOrEqualTo(tester.getRect(_returnToTop).top),
      );
      expect(loadOlder.hitTestable(), findsOneWidget);
    });

    testWidgets('does not bring the old anchor back through tab switches', (
      tester,
    ) async {
      await _openTimeline(tester);
      await _scrollBy(tester, -_listHeight(tester) * 2);
      await tester.tap(_returnToTop);
      await tester.pumpAndSettle();
      expect(find.text('v40').hitTestable(), findsOneWidget);

      await tester.tap(find.text('Settings').last);
      await settleUi(tester);
      await tester.tap(find.text('Timeline').last);
      await settleUi(tester);

      expect(find.text('v40').hitTestable(), findsOneWidget);
      expect(_returnToTop.hitTestable(), findsNothing);
    });

    testWidgets('floats inside the card column, not on its edges', (
      tester,
    ) async {
      await _openTimeline(tester);
      await _scrollBy(tester, -_listHeight(tester) * 2);

      final button = tester.getRect(_returnToTop);
      final card = tester.getRect(find.byType(ReleaseTimelineCard).first);
      expect(
        button.right,
        lessThan(card.right),
        reason: 'the circle clears the cards’ right edge',
      );
      expect(
        tester.getRect(find.byIcon(Icons.arrow_upward)).right,
        lessThan(card.right - GitPulseSpace.surfaceInset),
        reason: 'and its glyph stays clear of the cards’ text edge',
      );
    });

    testWidgets('returns over a short move a scroll of the reader can stop', (
      tester,
    ) async {
      await _openTimeline(tester);
      await _scrollBy(tester, -_listHeight(tester) * 2);

      await tester.tap(_returnToTop);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      expect(
        find.text('v40').hitTestable(),
        findsNothing,
        reason: 'the move is still travelling',
      );

      await tester.drag(find.byType(CustomScrollView), const Offset(0, 300));
      await tester.pumpAndSettle();
      expect(
        find.text('v40').hitTestable(),
        findsNothing,
        reason: 'the reader scroll stopped the move',
      );
      expect(_returnToTop.hitTestable(), findsOneWidget);
    });

    testWidgets('fades in and out rather than appearing', (tester) async {
      await _openTimeline(tester);
      await tester.drag(
        find.byType(CustomScrollView),
        Offset(0, -_listHeight(tester) * 2),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 60));
      expect(_fadeValue(tester), inExclusiveRange(0.0, 1.0));

      await tester.pumpAndSettle();
      expect(_fadeValue(tester), 1);
    });

    testWidgets('uses the scheme surfaces of either theme', (tester) async {
      for (final appearance in ['light', 'dark']) {
        await _openTimeline(tester, preferences: {'appearance': appearance});
        await _scrollBy(tester, -_listHeight(tester) * 2);

        final scheme = Theme.of(tester.element(find.byType(TimelineScreen)))
            .colorScheme;
        expect(
          scheme.brightness,
          appearance == 'dark' ? Brightness.dark : Brightness.light,
        );
        final material = tester.widget<Material>(
          find
              .ancestor(
                of: find.byIcon(Icons.arrow_upward),
                matching: find.byType(Material),
              )
              .first,
        );
        expect(material.color, scheme.surfaceContainerHigh);
        expect(material.elevation, 0);
        final shape = material.shape! as CircleBorder;
        expect(shape.side.color, toneEdge(scheme));
        expect(shape.side.width, GitPulseStroke.hairline);
        expect(
          tester.getSize(_returnToTop),
          const Size.square(GitPulseHeight.standard),
        );
        expect(
          tester.getSize(find.byIcon(Icons.arrow_upward)),
          const Size.square(GitPulseIconSize.action),
        );
        expect(tester.takeException(), isNull);

        await tester.pumpWidget(const SizedBox.shrink());
      }
    });

    testWidgets('answers the keyboard once focused', (tester) async {
      await _openTimeline(tester);
      await _scrollBy(tester, -_listHeight(tester) * 2);

      Focus.of(tester.element(find.byIcon(Icons.arrow_upward))).requestFocus();
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pumpAndSettle();

      expect(find.text('v40').hitTestable(), findsOneWidget);
    });
  });
}
