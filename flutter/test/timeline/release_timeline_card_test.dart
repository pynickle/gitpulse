import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/l10n/generated/app_localizations.dart';
import 'package:gitpulse/presentation/gitpulse_formatting.dart';
import 'package:gitpulse/presentation/gitpulse_theme.dart';
import 'package:gitpulse/session/session_controller.dart';
import 'package:gitpulse/timeline/release_timeline_card.dart';
import 'package:gitpulse/timeline/timeline_cache.dart';
import 'package:gitpulse/timeline/timeline_models.dart';

import 'timeline_test_support.dart';

final _clock = DateTime(2026, 10, 22, 12);

TimelineRelease _release({
  required DateTime publishedAt,
  int assetCount = 3,
  bool prerelease = false,
  bool oldest = false,
  String title = 'One',
}) => TimelineRelease(
  repository: const TimelineRepository(id: 'R', owner: 'octo', name: 'app'),
  id: 1,
  tagName: 'v1.0.0',
  title: title,
  publishedAt: publishedAt,
  notes: '',
  changelog: 'Notes excerpt',
  changelogTruncated: false,
  assetCount: assetCount,
  isPrerelease: prerelease,
  isOldestShown: oldest,
  htmlUrl: 'https://github.com/octo/app/releases/tag/v1.0.0',
);

Future<void> _pumpCard(
  WidgetTester tester,
  TimelineRelease item, {
  Locale locale = const Locale('en'),
  bool signedIn = false,
  Brightness brightness = Brightness.light,
}) {
  return tester.pumpWidget(
    ProviderScope(
      overrides: [
        timelineClockProvider.overrideWithValue(() => _clock),
        if (signedIn)
          sessionControllerProvider.overrideWith(() {
            return FakeSessionController(
              SessionState(
                phase: SessionPhase.signedIn,
                identity: signedInIdentity(),
              ),
            );
          }),
      ],
      child: MaterialApp(
        locale: locale,
        theme: gitPulseTheme(brightness),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(body: ReleaseTimelineCard(item: item)),
      ),
    ),
  );
}

void main() {
  final published = {
    _clock.subtract(const Duration(seconds: 10)): ('a few seconds ago', '几秒前'),
    _clock.subtract(const Duration(seconds: 60)): ('a minute ago', '1分钟前'),
    _clock.subtract(const Duration(minutes: 5)): ('5 minutes ago', '5分钟前'),
    _clock.subtract(const Duration(minutes: 60)): ('an hour ago', '1小时前'),
    _clock.subtract(const Duration(hours: 3)): ('3 hours ago', '3小时前'),
    _clock.subtract(const Duration(hours: 30)): ('a day ago', '1天前'),
    _clock.subtract(const Duration(days: 3)): ('3 days ago', '3天前'),
    _clock.subtract(const Duration(days: 40)): ('a month ago', '1个月前'),
    DateTime(2026, 7, 22, 12): ('3 months ago', '3个月前'),
    DateTime(2025, 8, 22, 12): ('a year ago', '1年前'),
    DateTime(2024, 10, 22, 12): ('2 years ago', '2年前'),
    _clock.add(const Duration(seconds: 10)): ('in a few seconds', '几秒后'),
  };

  for (final locale in [const Locale('en'), const Locale('zh')]) {
    final english = locale.languageCode == 'en';
    for (final entry in published.entries) {
      final phrase = english ? entry.value.$1 : entry.value.$2;
      testWidgets('a card says "$phrase"', (tester) async {
        await _pumpCard(
          tester,
          _release(publishedAt: entry.key),
          locale: locale,
        );
        expect(find.text(phrase), findsOneWidget);
        expect(find.text('One'), findsOneWidget);
        expect(find.text('Notes excerpt'), findsOneWidget);
      });
    }
  }

  testWidgets('long-pressing the relative time shows the exact instant', (
    tester,
  ) async {
    final at = _clock.subtract(const Duration(days: 3));
    await _pumpCard(tester, _release(publishedAt: at), signedIn: true);
    expect(find.byKey(const Key('release-drawer')), findsNothing);
    await tester.longPress(find.text('3 days ago'));
    await tester.pump(const Duration(seconds: 1));
    expect(
      find.text(formatGitPulseDateTime('en', at.toLocal())),
      findsOneWidget,
    );
    expect(find.byKey(const Key('release-drawer')), findsNothing);

    await tester.tap(find.text('One'));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('release-drawer')), findsOneWidget);
  });

  testWidgets('the asset count keeps a paper-clip and its words', (
    tester,
  ) async {
    await _pumpCard(
      tester,
      _release(publishedAt: _clock.subtract(const Duration(days: 3))),
    );
    expect(find.byIcon(Icons.attach_file), findsOneWidget);
    expect(find.text('3 assets'), findsOneWidget);
    final label = tester.getSemantics(find.text('3 assets')).label;
    expect(label, contains('3 assets'));
    expect(label.toLowerCase(), isNot(contains('attach')));

    await _pumpCard(
      tester,
      _release(
        publishedAt: _clock.subtract(const Duration(days: 3)),
        assetCount: 0,
        prerelease: true,
        oldest: true,
      ),
    );
    expect(find.byIcon(Icons.attach_file), findsOneWidget);
    expect(find.text('No assets'), findsOneWidget);
    expect(find.text('Prerelease'), findsOneWidget);
    expect(find.text('Earlier releases are not shown.'), findsOneWidget);
  });

  // A card's border is the boundary of a surface and its badge's border is a
  // line inside one, so the two take the scheme's two registered tones — never
  // one tone for both (MASTER §7 rules 2 and 3). The badge is also a whole
  // hairline: Material's half-pixel default renders inconsistently on high-DPI
  // displays (MASTER §12 E14).
  for (final brightness in Brightness.values) {
    testWidgets('a card edges with one tone and its badge rules with another '
        '(${brightness.name})', (tester) async {
      await _pumpCard(
        tester,
        _release(
          publishedAt: _clock.subtract(const Duration(days: 3)),
          prerelease: true,
        ),
        brightness: brightness,
      );
      final scheme = Theme.of(tester.element(find.byType(ReleaseTimelineCard)))
          .colorScheme;

      final surface =
          tester
                  .widget<Ink>(
                    find.ancestor(
                      of: find.text('One'),
                      matching: find.byType(Ink),
                    ),
                  )
                  .decoration!
              as BoxDecoration;
      final edge = (surface.border! as Border).top;
      expect(edge.color, scheme.outline);
      expect(edge.width, 1);

      final badge = tester
          .widgetList<Container>(
            find.ancestor(
              of: find.text('Prerelease'),
              matching: find.byType(Container),
            ),
          )
          .map((container) => container.decoration)
          .whereType<BoxDecoration>()
          .single;
      final rule = (badge.border! as Border).top;
      expect(rule.color, scheme.outlineVariant);
      expect(rule.width, 1);
    });
  }
}
