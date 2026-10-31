import 'dart:async';
import 'dart:io';

import 'package:drift/native.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/presentation/gitpulse_toggles.dart';
import 'package:gitpulse/timeline/release_timeline_card.dart';
import 'package:gitpulse/timeline/timeline_cache.dart';
import 'package:gitpulse/timeline/timeline_screen.dart';
import 'package:gitpulse/timeline/timeline_session.dart';
import 'package:path/path.dart' as p;

import '../follows/follows_test_support.dart';
import '../session_flow_test.dart' as auth;
import '../support/named_actions.dart';
import '../support/settling.dart';
import 'timeline_test_support.dart';

Future<FollowsServer> _openTimeline(
  WidgetTester tester,
  double width, {
  bool includeBeta = false,
  String? firstReleaseTitle,
}) async {
  tester.view.physicalSize = Size(width, 800);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  final directory = Directory.systemTemp.createTempSync('timeline-position-');
  final preferences = File(p.join(directory.path, 'preferences.json'))
    ..writeAsStringSync('{}');
  final cache = TimelineCache(NativeDatabase.memory());
  addTearDown(() => _closeTimeline(tester, cache));
  addTearDown(() {
    preferences.deleteSync();
    directory.deleteSync();
  });
  final server = FollowsServer();
  server.settings['followedRepositories'] = [
    followJson('R_alpha', 'octo', 'alpha'),
    if (includeBeta) followJson('R_beta', 'octo', 'beta'),
  ];
  server.pages = {
    'R_alpha': pageJson('octo', 'alpha', [
      for (var id = 40; id > 0; id--)
        releaseJson(
          id,
          'v$id',
          DateTime.utc(2026, 10, 25, 0, id).toIso8601String(),
          name: id == 40 ? firstReleaseTitle : null,
          description: id.isEven ? 'Short notes.' : 'Long notes. ' * 35,
        ),
    ]),
    if (includeBeta)
      'R_beta': pageJson('octo', 'beta', [
        releaseJson(100, 'beta-latest', '2026-10-24T12:00:00Z'),
        releaseJson(99, 'beta-older', '2026-10-24T10:00:00Z'),
      ]),
  };
  await auth.mountApp(
    tester,
    server,
    timelineCache: cache,
    presentationFile: preferences,
    timelineNow: () => DateTime.utc(2026, 10, 26),
  );
  await auth.submitField(
    tester,
    label: 'Password',
    value: 'correct-horse',
    action: 'Unlock',
  );
  await pumpUntil(tester, () {
    final screen = find.byType(TimelineScreen);
    if (screen.evaluate().isEmpty) return false;
    final container = ProviderScope.containerOf(
      tester.element(screen),
      listen: false,
    );
    final state = container.read(releaseTimelineSessionProvider);
    return state.active && !state.loading;
  }, reason: 'finish timeline startup and saving');
  await settleUi(tester);
  expect(find.text(firstReleaseTitle?.trim() ?? 'v40'), findsOneWidget);
  return server;
}

Future<void> _closeTimeline(WidgetTester tester, TimelineCache cache) async {
  await tester.pumpWidget(const SizedBox.shrink());
  var closed = false;
  final closing = cache.close().whenComplete(() => closed = true);
  await pumpUntil(tester, () => closed, reason: 'the in-memory cache closes');
  await closing;
}

Future<({Finder card, double top})> _readFurther(WidgetTester tester) async {
  await tester.drag(find.byType(CustomScrollView), const Offset(0, -1100));
  await tester.pumpAndSettle();
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
  for (final width in [390.0, 1000.0, 1400.0]) {
    testWidgets(
      'returning from tabs restores the release being read at $width',
      (tester) async {
        final server = await _openTimeline(tester, width);
        final reading = await _readFurther(tester);
        final rounds = server.featureRequests
            .where(
              (request) => request.uri.path.contains('/api/release-timeline'),
            )
            .length;

        for (final tab in ['Follows', 'Settings', 'Follows']) {
          await tester.tap(find.text(tab).last);
          await settleUi(tester);
          await tester.tap(find.text('Timeline').last);
          await settleUi(tester);

          expect(reading.card, findsOneWidget);
          expect(tester.getTopLeft(reading.card).dy, closeTo(reading.top, 1));
        }
        expect(
          server.featureRequests.where(
            (request) => request.uri.path.contains('/api/release-timeline'),
          ),
          hasLength(rounds),
        );
        expect(tester.takeException(), isNull);
      },
    );
  }

  for (final switchTab in [false, true]) {
    testWidgets(
      'explicit refresh shows the newest release; switch tab: $switchTab',
      (tester) async {
        final server = await _openTimeline(tester, 390);
        await _readFurther(tester);
        final page = server.pages['R_alpha']! as Map<String, Object?>;
        page['releases'] = [
          releaseJson(41, 'v41-new', '2026-10-26T00:00:00Z'),
          ...page['releases']! as List,
        ];
        final response = Completer<void>();
        server.holdRound = response.future;
        addTearDown(() {
          if (!response.isCompleted) response.complete();
        });

        await tester.tap(findNamedAction('Reload'));
        await settleUi(tester, frames: 5);
        if (switchTab) {
          await tester.tap(find.text('Settings').last);
          await settleUi(tester);
        }
        response.complete();
        await settleUi(tester);
        if (switchTab) {
          await tester.tap(find.text('Timeline').last);
          await settleUi(tester);
        }

        expect(find.text('v41-new').hitTestable(), findsOneWidget);
      },
    );
  }

  testWidgets(
    'changing search returns to the top even when all releases match',
    (tester) async {
      final server = await _openTimeline(tester, 390);
      await _readFurther(tester);
      final before = server.featureRequests.length;

      await tester.enterText(find.byType(TextField), 'v');
      await tester.pumpAndSettle();

      expect(find.text('v40').hitTestable(), findsOneWidget);
      expect(server.featureRequests, hasLength(before));
    },
  );

  testWidgets('removing the release being read returns to the remaining top', (
    tester,
  ) async {
    final server = await _openTimeline(tester, 390, includeBeta: true);
    final reading = await _readFurther(tester);
    final rounds = server.featureRequests
        .where((request) => request.uri.path.contains('/api/release-timeline'))
        .length;
    await tester.tap(find.text('Follows').last);
    await settleUi(tester);
    await tester.tap(find.byKey(const ValueKey('manage-follows')));
    await tester.pumpAndSettle();
    final unfollow = find.descendant(
      of: find.byKey(const ValueKey('followed-R_alpha')),
      matching: findNamedAction('Unfollow'),
    );
    await tester.ensureVisible(unfollow);
    await tester.tap(unfollow);
    await settleUi(tester);
    await tester.tap(findNamedAction('Close followed repositories'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Timeline').last);
    await settleUi(tester);

    expect(reading.card, findsNothing);
    expect(find.text('beta-latest').hitTestable(), findsOneWidget);
    expect(
      server.featureRequests.where(
        (request) => request.uri.path.contains('/api/release-timeline'),
      ),
      hasLength(rounds),
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('changing filters returns to the top of the resulting list', (
    tester,
  ) async {
    final server = await _openTimeline(tester, 390);
    await _readFurther(tester);
    final before = server.featureRequests.length;
    await tester.tap(findNamedAction('Filters'));
    await tester.pumpAndSettle();
    await tester.tap(find.byType(GitPulseSwitch));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Done'));
    await tester.pumpAndSettle();

    expect(find.text('v40').hitTestable(), findsOneWidget);
    expect(server.featureRequests, hasLength(before));
  });

  testWidgets('returning after a width change restores the same release', (
    tester,
  ) async {
    await _openTimeline(tester, 390);
    final reading = await _readFurther(tester);
    await tester.tap(find.text('Settings').last);
    await settleUi(tester);
    tester.view.physicalSize = const Size(1400, 800);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Timeline').last);
    await settleUi(tester);

    expect(reading.card, findsOneWidget);
    expect(tester.getTopLeft(reading.card).dy, closeTo(reading.top, 1));
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'a card that shrinks still contains the restored reading position',
    (tester) async {
      await _openTimeline(
        tester,
        390,
        firstReleaseTitle:
            'A long release title that wraps across many lines. ' * 30,
      );
      final card = find.byWidgetPredicate(
        (widget) => widget is ReleaseTimelineCard && widget.item.id == 40,
      );
      final viewport = tester.getRect(find.byType(CustomScrollView));
      final distance = tester.getRect(card).bottom - viewport.top - 60;
      await tester.drag(find.byType(CustomScrollView), Offset(0, -distance));
      await tester.pumpAndSettle();
      final before = tester.getRect(card);
      expect(before.overlaps(viewport), isTrue);
      expect(before.top, lessThan(viewport.top));

      await tester.tap(find.text('Settings').last);
      await settleUi(tester);
      tester.view.physicalSize = const Size(2800, 800);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Timeline').last);
      await settleUi(tester);

      expect(card, findsOneWidget);
      final restored = tester.getRect(card);
      final restoredViewport = tester.getRect(find.byType(CustomScrollView));
      expect(restored.height, lessThan(before.height));
      expect(restored.overlaps(restoredViewport), isTrue);
      expect(tester.takeException(), isNull);
    },
  );
}
