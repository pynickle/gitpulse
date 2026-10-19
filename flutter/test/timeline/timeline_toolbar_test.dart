import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/l10n/generated/app_localizations.dart';
import 'package:gitpulse/timeline/timeline_state.dart';
import 'package:gitpulse/timeline/timeline_toolbar.dart';

void main() {
  for (final width in [320.0, 1280.0]) {
    for (final locale in [const Locale('en'), const Locale('zh')]) {
      testWidgets(
        'refresh stays in the top row with large $locale text at $width',
        (tester) async {
          tester.view.physicalSize = Size(width, 1000);
          tester.view.devicePixelRatio = 1;
          addTearDown(tester.view.resetPhysicalSize);
          addTearDown(tester.view.resetDevicePixelRatio);
          var refreshes = 0;
          var loading = false;
          Future<void> mount() => tester.pumpWidget(
            MaterialApp(
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
                    showTitle: width < 720,
                    state: TimelineViewState(
                      previousBaseline: '2026-10-18T14:43:00.000Z',
                      loadedNewCount: 12345,
                      offline: true,
                      cacheFailed: true,
                      savedAt: DateTime.utc(2026, 10, 19, 12),
                      loading: loading,
                    ),
                    onRefresh: () async {
                      refreshes++;
                    },
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
          final refresh = find.byTooltip(l10n.timelineReload);
          expect(refresh, findsOneWidget);
          expect(tester.getCenter(refresh).dx, greaterThan(width - 80));
          expect(tester.getCenter(refresh).dy, lessThan(75));
          expect(find.byIcon(Icons.history), findsOneWidget);
          expect(find.text(l10n.timelineLoadedNew(12345)), findsOneWidget);
          expect(find.text(l10n.timelineOffline), findsOneWidget);
          expect(find.text(l10n.timelineCacheFailed), findsOneWidget);
          expect(
            find.textContaining(locale.languageCode == 'zh' ? '保存于' : 'Saved'),
            findsOneWidget,
          );
          expect(
            find.text(l10n.timeline),
            width < 720 ? findsOneWidget : findsNothing,
          );
          if (width < 720) {
            expect(
              tester.getCenter(refresh).dy,
              closeTo(tester.getCenter(find.text(l10n.timeline)).dy, 1),
            );
          }
          await tester.tap(refresh);
          expect(refreshes, 1);
          loading = true;
          await mount();
          await tester.pump();
          expect(
            tester.widget<IconButton>(find.byType(IconButton)).onPressed,
            isNull,
          );
          expect(find.byType(CircularProgressIndicator), findsOneWidget);
          expect(tester.takeException(), isNull);
        },
      );
    }
  }
}
