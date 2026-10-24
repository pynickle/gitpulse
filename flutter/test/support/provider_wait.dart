import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show ProviderListenable;
import 'package:gitpulse/session/session_controller.dart';

/// Waits for an observable provider state without polling or a fixed sleep.
/// Call inside runAsync when a widget test is waiting for disk or socket I/O.
Future<void> waitForProvider<T>(
  ProviderContainer container,
  ProviderListenable<T> provider,
  bool Function(T) matches, {
  Duration timeout = const Duration(seconds: 10),
}) async {
  final done = Completer<void>();
  final subscription = container.listen(provider, (_, next) {
    if (matches(next) && !done.isCompleted) done.complete();
  }, fireImmediately: true);
  try {
    await done.future.timeout(timeout);
  } finally {
    subscription.close();
  }
}

Future<void> waitForSession(
  ProviderContainer container,
  bool Function(SessionState) matches,
) => waitForProvider(
  container,
  sessionControllerProvider,
  matches,
  timeout: const Duration(seconds: 15),
);
