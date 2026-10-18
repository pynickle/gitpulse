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
  @override
  Future<BackendConnectionState> build() async {
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
    return _connect(address ?? defaultBackendAddress);
  }

  Future<void> connect(String address) async {
    final previous = state.value;
    if (previous == null || previous.connecting) return;
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
    );
    if (ref.mounted) state = AsyncData(result);
  }

  Future<BackendConnectionState> _connect(
    String address, {
    String? rememberedAddress,
  }) async {
    final service = ref.read(backendServiceProvider);
    final store = ref.read(backendAddressStoreProvider);
    try {
      final backend = await service.connect(address);
      if (!ref.mounted) return const BackendConnectionState();
      ConnectionProblem? storageProblem;
      try {
        await store.remember(backend.address);
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
      return BackendConnectionState(
        rememberedAddress: rememberedAddress ?? address,
        attemptedAddress: address,
        problem: error.problem,
      );
    }
  }

  void changeBackend() {
    state = AsyncData(
      BackendConnectionState(
        rememberedAddress: state.value?.rememberedAddress ?? '',
      ),
    );
  }
}
