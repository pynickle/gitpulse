import 'dart:async';
import 'dart:io';

import 'package:drift/native.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/connection/backend_service.dart';
import 'package:gitpulse/connection/connection_controller.dart';
import 'package:gitpulse/connection/native_capabilities.dart';
import 'package:gitpulse/device/device_preferences_controller.dart';
import 'package:gitpulse/device/device_preferences_store.dart';
import 'package:gitpulse/session/gitpulse_http.dart';
import 'package:gitpulse/session/session_controller.dart';
import 'package:gitpulse/timeline/timeline_cache.dart';
import 'package:gitpulse/timeline/timeline_session.dart';
import 'package:path/path.dart' as p;

import '../timeline/timeline_test_support.dart';
import 'app_overrides.dart';
import 'provider_wait.dart';

const _capabilities = NativeCapabilities(
  protocolVersion: 1,
  capabilities: ['provider-discovery', 'release-timeline'],
  providers: SignInProviders(
    personalMode: false,
    patEnabled: true,
    oauthEnabled: false,
    mode: 'pat',
  ),
);

BackendConnectionState connectedConnection() => BackendConnectionState(
  rememberedAddress: 'https://gitpulse.example/',
  backend: ConnectedBackend(
    Uri.parse('https://gitpulse.example/'),
    _capabilities,
  ),
);

class _TestConnectionController extends ConnectionController {
  _TestConnectionController(this._connection);

  final BackendConnectionState Function() _connection;

  @override
  Future<BackendConnectionState> build() async => _connection();
}

/// One installation: a temporary preferences file and a local timeline cache.
/// Closing and opening it again models a later app launch.
class PresentationHarness {
  PresentationHarness({
    required this.directory,
    required this.preferencesFile,
    this.connection = connectedConnection,
    this.session,
    this.handlers = const {},
    this.deviceStore,
  });

  final Directory directory;
  final File preferencesFile;

  /// A device store that replaces the real file, for a device whose storage
  /// cannot be written at all.
  final DevicePreferencesStore? deviceStore;
  final BackendConnectionState Function() connection;
  final SessionState? session;
  final Map<String, FutureOr<BackendResult> Function()> handlers;
  late ProviderContainer container;
  late TimelineCache cache;
  bool _open = false;

  Future<void> open() async {
    _open = true;
    cache = TimelineCache(NativeDatabase.memory());
    container = ProviderContainer(
      overrides: [
        ...gitPulseHarnessOverrides(
          deviceStore: deviceStore,
          preferencesFile: () async => preferencesFile,
          timelineCache: cache,
        ),
        connectionControllerProvider.overrideWith(
          () => _TestConnectionController(connection),
        ),
        sessionControllerProvider.overrideWith(() {
          return FakeSessionController(
            session ?? const SessionState(phase: SessionPhase.signedOut),
          )..handlers.addAll(handlers);
        }),
      ],
    );
    container.listen(sessionControllerProvider, (_, _) {});
    await container.read(devicePreferencesProvider.future);
    await container.read(connectionControllerProvider.future);
    if (session?.phase == SessionPhase.signedIn) {
      await waitForProvider(
        container,
        releaseTimelineSessionProvider,
        (state) => state.active && !state.loading,
      );
    }
  }

  Future<void> close() async {
    if (!_open) return;
    _open = false;
    container.dispose();
    await cache.close();
  }
}

PresentationHarness harnessFor(
  WidgetTester tester, {
  BackendConnectionState Function() connection = connectedConnection,
  SessionState? session,
  Map<String, FutureOr<BackendResult> Function()> handlers = const {},
  DevicePreferencesStore? deviceStore,
}) {
  final directory = Directory.systemTemp.createTempSync(
    'gitpulse-presentation-',
  );
  final harness = PresentationHarness(
    directory: directory,
    preferencesFile: File(
      p.join(directory.path, 'presentation_preferences.json'),
    ),
    connection: connection,
    session: session,
    handlers: handlers,
    deviceStore: deviceStore,
  );
  addTearDown(() async {
    await tester.runAsync(harness.close);
    directory.deleteSync(recursive: true);
  });
  return harness;
}
