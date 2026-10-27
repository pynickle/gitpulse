import 'dart:async';

import 'package:flutter_test/flutter_test.dart';

import 'support/settling.dart';

void main() {
  testWidgets('an operation can wait for both widget timers and real I/O', (
    tester,
  ) async {
    final widgetTimer = Completer<void>();
    Timer(const Duration(milliseconds: 40), widgetTimer.complete);
    var finished = false;
    await pumpOperation(tester, () async {
      await widgetTimer.future;
      await Future<void>.delayed(const Duration(milliseconds: 5));
      finished = true;
    }, reason: 'complete work across both clocks');
    expect(finished, isTrue);
  });

  testWidgets('operation failures still fail the caller', (tester) async {
    await expectLater(
      pumpOperation(
        tester,
        () => Future<void>.error(StateError('storage failed')),
        reason: 'report failed storage',
      ),
      throwsStateError,
    );
  });
}
