import 'package:flutter_test/flutter_test.dart';

/// Advances the widget clock while real cache and HTTP work runs.
///
/// Widget tests run on a fake clock, so a real `File`, SQLite, or socket call
/// never resumes from a plain `pump`. Bounded frames — never `pumpAndSettle` —
/// because a page can carry an indeterminate progress indicator that would make
/// settling wait forever.
Future<void> settleUi(
  WidgetTester tester, {
  int frames = 30,
  Duration step = const Duration(milliseconds: 20),
  Duration realStep = const Duration(milliseconds: 5),
}) async {
  for (var i = 0; i < frames; i++) {
    await tester.runAsync(() => Future<void>.delayed(realStep));
    await tester.pump(step);
  }
}
