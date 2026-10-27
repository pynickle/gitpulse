import 'dart:async';

import 'package:flutter_test/flutter_test.dart';

/// Completes real I/O while also advancing any widget-clock continuations it
/// depends on. Awaiting only [WidgetTester.runAsync] can strand those tasks.
Future<void> pumpOperation(
  WidgetTester tester,
  Future<void> Function() operation, {
  required String reason,
}) async {
  var completed = false;
  Object? failure;
  StackTrace? failureStack;
  await tester.runAsync(() async {
    unawaited(
      Future<void>.sync(operation).then<void>(
        (_) {
          completed = true;
        },
        onError: (Object error, StackTrace stack) {
          failure = error;
          failureStack = stack;
          completed = true;
        },
      ),
    );
  });
  await pumpUntil(tester, () => completed, reason: reason);
  if (failure != null) Error.throwWithStackTrace(failure!, failureStack!);
}

/// Pumps only until the requested UI or request boundary is observable.
Future<void> pumpUntil(
  WidgetTester tester,
  bool Function() ready, {
  required String reason,
  int maxPumps = 200,
}) async {
  for (var i = 0; i < maxPumps; i++) {
    if (ready()) return;
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 5)),
    );
    await tester.pump(const Duration(milliseconds: 20));
  }
  expect(ready(), isTrue, reason: reason);
}

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
