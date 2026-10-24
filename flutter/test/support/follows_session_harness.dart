import 'package:drift/native.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/connection/connection_controller.dart';
import 'package:gitpulse/follows/release_follows_session.dart';
import 'package:gitpulse/session/gitpulse_http.dart';
import 'package:gitpulse/session/session_controller.dart';
import 'package:gitpulse/timeline/timeline_cache.dart';
import 'package:gitpulse/timeline/timeline_session.dart';

import '../follows/follows_test_support.dart';
import 'provider_wait.dart';

/// The real session, Dio transport, and shared Follows/Timeline providers,
/// without mounting the app merely to drive their event loop.
Future<ProviderContainer> openFollowsSession(
  FollowsServer server, {
  String address = 'https://gitpulse.example',
}) async {
  FlutterSecureStorage.setMockInitialValues({});
  final cache = TimelineCache(NativeDatabase.memory());
  addTearDown(cache.close);
  final container = ProviderContainer(
    overrides: [
      timelineCacheProvider.overrideWithValue(cache),
      connectionDioProvider.overrideWith((ref) {
        final dio = createGitPulseDio(ref.watch(cookieJarProvider));
        dio.httpClientAdapter = server;
        ref.onDispose(() => dio.close(force: true));
        return dio;
      }),
    ],
  );
  addTearDown(container.dispose);
  container.listen(releaseFollowsSessionProvider, (_, _) {});
  container.listen(releaseTimelineSessionProvider, (_, _) {});
  await container.read(connectionControllerProvider.future);
  await container.read(connectionControllerProvider.notifier).connect(address);
  await waitForSession(container, (state) => !state.busy);
  await container
      .read(sessionControllerProvider.notifier)
      .unlock('correct-horse');
  await waitForProvider(
    container,
    releaseTimelineSessionProvider,
    (state) => state.active && !state.loading,
  );
  expect(container.read(releaseFollowsSessionProvider).loaded, isTrue);
  return container;
}
