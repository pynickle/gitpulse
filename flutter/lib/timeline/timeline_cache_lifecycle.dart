import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../session/session_controller.dart';
import 'timeline_cache.dart';

// Kept alive by the app shell, including when no Timeline widget is mounted.
final timelineCacheLifecycleProvider = Provider<void>((ref) {
  void clear() {
    unawaited(
      ref.read(timelineCacheProvider).clear().catchError((Object _) {}),
    );
  }

  ref.listen(sessionControllerProvider, (previous, next) {
    final old = previous?.identity;
    final current = next.identity;
    if (old != null &&
        ((next.phase == SessionPhase.signedOut && !next.busy) ||
            (current != null && !old.sameAccount(current)))) {
      clear();
    }
  });
  final events = ref
      .read(sessionControllerProvider.notifier)
      .transitions
      .listen((event) {
        if (event is IdentityCleared) clear();
      });
  ref.onDispose(events.cancel);
});
