import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../session/gitpulse_http.dart';
import '../session/secure_storage.dart';
import 'backend_address_store.dart';
import 'backend_service.dart';

final connectionDioProvider = Provider<Dio>((ref) {
  final dio = createGitPulseDio(ref.watch(cookieJarProvider));
  ref.onDispose(() => dio.close(force: true));
  return dio;
});

final backendServiceProvider = Provider(
  (ref) => BackendService(ref.watch(connectionDioProvider)),
);

final backendAddressStoreProvider = Provider(
  (ref) => BackendAddressStore(ref.watch(secureStorageProvider)),
);

final connectionControllerProvider =
    AsyncNotifierProvider<ConnectionController, BackendConnectionState>(
      ConnectionController.new,
    );

const defaultBackendAddress = 'https://gitpulse.euphony.ink/';

class BackendConnectionState {
  const BackendConnectionState({
    this.rememberedAddress = '',
    this.attemptedAddress,
    this.connecting = false,
    this.backend,
    this.problem,
  });

  final String rememberedAddress;
  final String? attemptedAddress;
  final bool connecting;
  final ConnectedBackend? backend;
  final ConnectionProblem? problem;
}

class ConnectionController extends AsyncNotifier<BackendConnectionState> {
  int _generation = 0;

  @override
  Future<BackendConnectionState> build() async {
    final generation = ++_generation;
    final store = ref.watch(backendAddressStoreProvider);
    String? address;
    try {
      address = await store.read();
    } catch (_) {
      return const BackendConnectionState(
        rememberedAddress: defaultBackendAddress,
        problem: ConnectionProblem.storageRead,
      );
    }
    if (!ref.mounted) return const BackendConnectionState();
    if (address != null) {
      try {
        final saved = await store.readOfflineBackend(address);
        if (!ref.mounted) return const BackendConnectionState();
        if (saved != null) {
          unawaited(_refreshRememberedBackend(address, generation));
          return BackendConnectionState(
            rememberedAddress: address,
            backend: saved,
          );
        }
      } catch (_) {
        // Missing or damaged hints fall back to ordinary provider discovery.
      }
    }
    return _connect(
      address ?? defaultBackendAddress,
      allowOffline: address != null,
      generation: generation,
    );
  }

  Future<void> _refreshRememberedBackend(String address, int generation) async {
    final result = await _connect(
      address,
      allowOffline: true,
      generation: generation,
    );
    if (ref.mounted && generation == _generation) state = AsyncData(result);
  }

  Future<void> connect(String address) async {
    final previous = state.value;
    if (previous == null || previous.connecting) return;
    final generation = ++_generation;
    state = AsyncData(
      BackendConnectionState(
        rememberedAddress: previous.rememberedAddress,
        attemptedAddress: address,
        connecting: true,
      ),
    );
    final result = await _connect(
      address,
      rememberedAddress: previous.rememberedAddress,
      generation: generation,
    );
    if (ref.mounted && generation == _generation) state = AsyncData(result);
  }

  Future<BackendConnectionState> _connect(
    String address, {
    required int generation,
    String? rememberedAddress,
    bool allowOffline = false,
  }) async {
    final service = ref.read(backendServiceProvider);
    final store = ref.read(backendAddressStoreProvider);
    try {
      final backend = await service.connect(address);
      if (!ref.mounted || generation != _generation) {
        return const BackendConnectionState();
      }
      ConnectionProblem? storageProblem;
      try {
        await store.remember(backend.address);
        if (!ref.mounted || generation != _generation) {
          return const BackendConnectionState();
        }
        await store.rememberCapabilities(backend);
      } catch (_) {
        storageProblem = ConnectionProblem.storageWrite;
      }
      return BackendConnectionState(
        rememberedAddress: storageProblem == null
            ? backend.address.toString()
            : rememberedAddress ?? address,
        backend: backend,
        problem: storageProblem,
      );
    } on ConnectionException catch (error) {
      if (allowOffline && error.problem == ConnectionProblem.unreachable) {
        try {
          final offline = await store.readOfflineBackend(address);
          if (offline != null && ref.mounted) {
            return BackendConnectionState(
              rememberedAddress: address,
              backend: offline,
            );
          }
        } catch (_) {
          // A missing or damaged connection hint cannot authorize offline access.
        }
      }
      return BackendConnectionState(
        rememberedAddress: rememberedAddress ?? address,
        attemptedAddress: address,
        problem: error.problem,
      );
    }
  }

  void changeBackend() {
    _generation++;
    state = AsyncData(
      BackendConnectionState(
        rememberedAddress: state.value?.rememberedAddress ?? '',
      ),
    );
  }
}
