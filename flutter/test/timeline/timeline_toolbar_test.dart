import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/l10n/generated/app_localizations.dart';
import 'package:gitpulse/presentation/gitpulse_buttons.dart';
import 'package:gitpulse/presentation/gitpulse_progress.dart';
import 'package:gitpulse/timeline/timeline_cache.dart';
import 'package:gitpulse/timeline/timeline_filters.dart';
import 'package:gitpulse/timeline/timeline_state.dart';
import 'package:gitpulse/timeline/timeline_toolbar.dart';

void main() {
  for (final width in [320.0, 1280.0]) {
    for (final locale in [const Locale('en'), const Locale('zh')]) {
      testWidgets('the two toolbar rows keep refresh and the filter visible '
          'with large $locale text at $width', (tester) async {
        tester.view.physicalSize = Size(width, 1000);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        var refreshes = 0;
        var loading = false;
        Future<void> mount() => tester.pumpWidget(
          ProviderScope(
            child: MaterialApp(
              locale: locale,
              localizationsDelegates: AppLocalizations.localizationsDelegates,
              supportedLocales: AppLocalizations.supportedLocales,
              builder: (context, child) => MediaQuery(
                data: MediaQuery.of(context)
                    .copyWith(textScaler: const TextScaler.linear(2)),
                child: child!,
              ),
              home: Scaffold(
                body: Align(
                  alignment: Alignment.topCenter,
                  child: TimelineToolbar(
                    state: TimelineViewState(
                      previousBaseline: '2026-10-18T14:43:00.000Z',
                      loadedNewCount: 12345,
                      cacheFailed: true,
                      savedAt: DateTime.utc(2026, 10, 19, 12),
                      loading: loading,
                    ),
                    onRefresh: () async {
                      refreshes++;
                    },
                    onRetryCache: () async {},
                  ),
                ),
              ),
            ),
          ),
        );
        await mount();
        await tester.pumpAndSettle();
        final l10n = AppLocalizations.of(
          tester.element(find.byType(TimelineToolbar)),
        );
        final search = tester.getRect(find.byType(TextField));
        final notes = tester.getRect(find.byTooltip(l10n.timelineIncludeNotes));
        final refresh = tester.getRect(find.byTooltip(l10n.timelineReload));
        final filter = tester.getRect(find.byTooltip(l10n.timelineFilters));
        final baseline = tester.getRect(
          find.textContaining(l10n.timelinePreviousRefreshMark),
        );

        expect(_overlapsVertically(search, notes), isTrue);
        expect(_overlapsVertically(notes, refresh), isTrue);
        expect(search.center.dx, lessThan(notes.center.dx));
        expect(notes.center.dx, lessThan(refresh.center.dx));
        expect(refresh.right, lessThanOrEqualTo(width));
        expect(refresh.left, greaterThan(width / 2));

        expect(_overlapsVertically(baseline, filter), isTrue);
        expect(filter.center.dy, greaterThan(refresh.center.dy));
        expect(filter.right, lessThanOrEqualTo(width));
        expect(filter.left, greaterThan(width / 2));

        expect(find.byIcon(Icons.history), findsNothing);
        expect(find.text(l10n.timeline), findsNothing);
        expect(
          find.textContaining(locale.languageCode == 'zh' ? '保存于' : 'Saved'),
          findsNothing,
        );
        // The count shares the refresh row and is never shortened to fit: a
        // narrow screen wraps the line rather than dropping part of it.
        final count = find.text(l10n.timelineNewReleases(12345));
        expect(count, findsOneWidget);
        expect(
          tester
              .widgetList<Text>(
                find.textContaining(l10n.timelinePreviousRefreshMark),
              )
              .every((text) => text.maxLines == null),
          isTrue,
        );
        expect(tester.widget<Text>(count).maxLines, isNull);
        expect(tester.getRect(count).right, lessThanOrEqualTo(width));
        expect(find.text(l10n.timelineCacheFailed), findsOneWidget);
        expect(find.text(l10n.timelineRetrySaving), findsOneWidget);

        await tester.tap(find.byTooltip(l10n.timelineReload));
        expect(refreshes, 1);
        loading = true;
        await mount();
        await tester.pump();
        expect(
          tester
              .widget<GitPulseIconButton>(
                find.ancestor(
                  of: find.byTooltip(l10n.timelineReload),
                  matching: find.byType(GitPulseIconButton),
                ),
              )
              .onPressed,
          isNull,
        );
        // The round the button is reading is the app's own indicator.
        expect(find.byType(GitPulseProgressInline), findsOneWidget);
        expect(find.byType(CircularProgressIndicator), findsNothing);
        expect(tester.takeException(), isNull);
      });
    }
  }

  for (final locale in [const Locale('en'), const Locale('zh')]) {
    final english = locale.languageCode == 'en';
    final cases = {
      DateTime(2026, 10, 22, 14, 43): english
          ? 'Previous refresh · 14:43'
          : '上次刷新 · 14:43',
      DateTime(2026, 10, 18, 14, 43): english
          ? 'Previous refresh · Oct 18 14:43'
          : '上次刷新 · 10月18日 14:43',
      DateTime(2024, 6, 15, 9, 5): english
          ? 'Previous refresh · Jun 15, 2024 09:05'
          : '上次刷新 · 2024年6月15日 09:05',
    };

    for (final entry in cases.entries) {
      testWidgets('baseline reads "${entry.value}" for $locale', (
        tester,
      ) async {
        await _pumpToolbar(
          tester,
          locale: locale,
          now: () => DateTime(2026, 10, 22, 16),
          state: TimelineViewState(
            previousBaseline: entry.key.toUtc().toIso8601String(),
          ),
        );
        expect(find.text(entry.value), findsOneWidget);
        expect(find.byIcon(Icons.history), findsNothing);
      });
    }

    testWidgets('an absent baseline leaves only the filter for $locale', (
      tester,
    ) async {
      await _pumpToolbar(
        tester,
        locale: locale,
        now: () => DateTime(2026, 10, 22, 16),
        state: const TimelineViewState(),
      );
      final l10n = _l10n(tester);
      expect(
        find.textContaining(l10n.timelinePreviousRefreshMark),
        findsNothing,
      );
      expect(find.byTooltip(l10n.timelineFilters), findsOneWidget);
    });
  }

  testWidgets(
    'offline states the saved instant once and drops the refresh facts',
    (tester) async {
      await _pumpToolbar(
        tester,
        now: () => DateTime(2026, 10, 19, 21),
        state: TimelineViewState(
          offline: true,
          previousBaseline: DateTime.utc(
            2026,
            10,
            18,
            14,
            43,
          ).toIso8601String(),
          loadedNewCount: 7,
          // A local instant, so the toolbar renders the clock its own calendar
          // reads and the assertion holds in any display zone.
          savedAt: DateTime(2026, 10, 19, 12),
        ),
      );
      final l10n = _l10n(tester);

      // One instant, and it is the saved one: two instants side by side would read
      // as the same fact told twice.
      expect(find.text(l10n.timelineOffline), findsOneWidget);
      expect(find.text(l10n.timelineSavedAt('12:00')), findsOneWidget);
      expect(
        find.textContaining(l10n.timelinePreviousRefreshMark),
        findsNothing,
      );
      // A count of loaded-new releases is a refresh fact, and offline nothing was
      // refreshed.
      expect(find.text(l10n.timelineNewReleases(7)), findsNothing);
      expect(find.byIcon(Icons.cloud_off), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('offline without a saved instant states offline alone', (
    tester,
  ) async {
    await _pumpToolbar(tester, state: const TimelineViewState(offline: true));
    final l10n = _l10n(tester);

    expect(find.text(l10n.timelineOffline), findsOneWidget);
    expect(find.textContaining(l10n.timelineSavedAt('')), findsNothing);
    expect(find.byTooltip(l10n.timelineReload), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  testWidgets('the refresh instant and the loaded-new count share one row', (
    tester,
  ) async {
    await _pumpToolbar(
      tester,
      now: () => DateTime(2026, 10, 22, 16),
      state: TimelineViewState(
        previousBaseline: DateTime.utc(2026, 10, 22, 14, 43).toIso8601String(),
        loadedNewCount: 7,
      ),
    );
    final l10n = _l10n(tester);
    final instant = tester.getRect(
      find.textContaining(l10n.timelinePreviousRefreshMark),
    );
    final count = find.text(l10n.timelineNewReleases(7));
    final countRect = tester.getRect(count);
    final filter = tester.getRect(find.byTooltip(l10n.timelineFilters));

    expect(_overlapsVertically(instant, countRect), isTrue);
    expect(countRect.left, greaterThan(instant.right));
    // The count sits inside the row the filter entry already sets, so it can
    // never add a row of its own below it.
    expect(countRect.top, greaterThanOrEqualTo(filter.top));
    expect(countRect.bottom, lessThanOrEqualTo(filter.bottom));
    expect(tester.takeException(), isNull);
  });

  testWidgets('a refresh the pull started shows no progress in the button', (
    tester,
  ) async {
    await _pumpToolbar(tester, state: const TimelineViewState(loading: true));
    final l10n = _l10n(tester);
    final button = find.ancestor(
      of: find.byTooltip(l10n.timelineReload),
      matching: find.byType(GitPulseIconButton),
    );
    expect(tester.widget<GitPulseIconButton>(button).onPressed, isNull);
    expect(find.byType(GitPulseProgressInline), findsOneWidget);

    await _pumpToolbar(
      tester,
      state: const TimelineViewState(loading: true),
      pullRefreshing: true,
    );
    expect(tester.widget<GitPulseIconButton>(button).onPressed, isNull);
    expect(find.byType(GitPulseProgressInline), findsNothing);
    expect(find.byIcon(Icons.refresh), findsOneWidget);
  });

  testWidgets('search stays a short filled field with a centered hint', (
    tester,
  ) async {
    await _pumpToolbar(tester, state: const TimelineViewState());
    final l10n = _l10n(tester);
    final field = tester.widget<TextField>(find.byType(TextField));
    final fieldRect = tester.getRect(find.byType(TextField));
    expect(field.maxLines, 1);
    expect(field.decoration?.filled, isTrue);
    expect(field.decoration?.labelText, isNull);
    expect(fieldRect.height, inInclusiveRange(36, 48));
    expect(
      tester.getCenter(find.text(l10n.timelineSearchPlaceholder)).dy,
      closeTo(fieldRect.center.dy, 1),
    );

    await tester.enterText(find.byType(TextField), 'v1');
    await tester.pump();
    expect(find.byTooltip(l10n.timelineSearchClear), findsOneWidget);
    expect(tester.getSize(find.byType(TextField)).height, fieldRect.height);
    expect(tester.takeException(), isNull);
  });

  testWidgets('a query can be cleared and notes keep their selection', (
    tester,
  ) async {
    final changes = <TimelineFilterState>[];
    await _pumpToolbar(
      tester,
      state: const TimelineViewState(
        filters: TimelineFilterState(includeReleaseNotes: true),
      ),
      onFiltersChanged: changes.add,
    );
    final l10n = _l10n(tester);
    // An applied mode is the app's emphasized action, and it says so to a
    // screen reader as a selected control.
    final notes = tester.widget<GitPulseIconButton>(
      find.ancestor(
        of: find.byTooltip(l10n.timelineIncludeNotes),
        matching: find.byType(GitPulseIconButton),
      ),
    );
    expect(notes.emphasized, isTrue);
    expect(
      tester.getSemantics(find.byTooltip(l10n.timelineIncludeNotes)),
      isSemantics(isSelected: true),
    );

    await tester.enterText(find.byType(TextField), 'v1');
    await tester.pump();
    expect(find.byTooltip(l10n.timelineSearchClear), findsOneWidget);
    await tester.tap(find.byTooltip(l10n.timelineSearchClear));
    await tester.pump();
    expect(find.byTooltip(l10n.timelineSearchClear), findsNothing);
    expect(changes.last.query, isEmpty);
    expect(
      tester.widget<TextField>(find.byType(TextField)).controller?.text,
      isEmpty,
    );

    await tester.tap(find.byTooltip(l10n.timelineIncludeNotes));
    expect(changes.last.includeReleaseNotes, isFalse);
  });

  testWidgets('an active filter stays selected and opens the panel', (
    tester,
  ) async {
    var opened = 0;
    await _pumpToolbar(
      tester,
      state: const TimelineViewState(
        filters: TimelineFilterState(hidePrereleases: true),
      ),
      onOpenFilters: () => opened++,
    );
    final l10n = _l10n(tester);
    final filter = tester.widget<GitPulseIconButton>(
      find.ancestor(
        of: find.byTooltip(l10n.timelineFilters),
        matching: find.byType(GitPulseIconButton),
      ),
    );
    expect(filter.emphasized, isTrue);
    await tester.tap(find.byTooltip(l10n.timelineFilters));
    expect(opened, 1);
  });
}

bool _overlapsVertically(Rect left, Rect right) =>
    left.top < right.bottom && right.top < left.bottom;

AppLocalizations _l10n(WidgetTester tester) =>
    AppLocalizations.of(tester.element(find.byType(TimelineToolbar)));

Future<void> _pumpToolbar(
  WidgetTester tester, {
  Locale locale = const Locale('en'),
  TimelineViewState state = const TimelineViewState(),
  DateTime Function()? now,
  bool pullRefreshing = false,
  ValueChanged<TimelineFilterState>? onFiltersChanged,
  VoidCallback? onOpenFilters,
}) {
  tester.view.physicalSize = const Size(800, 600);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  return tester.pumpWidget(
    ProviderScope(
      overrides: [
        if (now != null) timelineClockProvider.overrideWithValue(now),
      ],
      child: MaterialApp(
        locale: locale,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          body: TimelineToolbar(
            state: state,
            onRefresh: () async {},
            pullRefreshing: pullRefreshing,
            onFiltersChanged: onFiltersChanged,
            onOpenFilters: onOpenFilters,
          ),
        ),
      ),
    ),
  );
}
