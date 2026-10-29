import 'dart:async';

import 'package:drift/drift.dart';

/// Runs before every test file in this directory.
///
/// Drift prints a multi-line warning with a stack trace when a second database
/// of the same class is constructed while an earlier one is still open, because
/// it cannot tell a shared executor from a fresh one. These tests reopen a cache
/// to prove what survives a restart (and build the next container before the
/// previous `TimelineCache.close()`), so the warning fired 23 times per run and
/// buried the real output under a stack trace each time. Every instance here
/// owns its own executor, so there is no shared connection to corrupt.
Future<void> testExecutable(FutureOr<void> Function() testMain) async {
  driftRuntimeOptions.dontWarnAboutMultipleDatabases = true;
  await testMain();
}
