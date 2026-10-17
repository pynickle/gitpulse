import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'backend_address_store.dart';
import 'backend_service.dart';

final connectionDioProvider = Provider<Dio>((ref) {
  final dio = Dio(
    BaseOptions(
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
      sendTimeout: const Duration(seconds: 10),
    ),
  );
  ref.onDispose(() => dio.close(force: true));
  return dio;
});

final backendServiceProvider = Provider(
  (ref) => BackendService(ref.watch(connectionDioProvider)),
);

final backendAddressStoreProvider = Provider(
  (ref) => const BackendAddressStore(FlutterSecureStorage()),
);

final connectionControllerProvider =
    AsyncNotifierProvider<ConnectionController, BackendConnectionState>(
      ConnectionController.new,
    );

class BackendConnectionState {
  const BackendConnectionState({
    this.rememberedAddress = '',
    this.connecting = false,
    this.backend,
    this.problem,
  });

  final String rememberedAddress;
  final bool connecting;
  final ConnectedBackend? backend;
  final ConnectionProblem? problem;
}

class ConnectionController extends AsyncNotifier<BackendConnectionState> {
  @override
  Future<BackendConnectionState> build() async {
    try {
      final address = await ref.watch(backendAddressStoreProvider).read();
      return BackendConnectionState(rememberedAddress: address ?? '');
    } catch (_) {
      return const BackendConnectionState(
        problem: ConnectionProblem.storageRead,
      );
    }
  }

  Future<void> connect(String address) async {
    final previous = state.value;
    if (previous == null || previous.connecting) return;
    final service = ref.read(backendServiceProvider);
    final store = ref.read(backendAddressStoreProvider);
    state = AsyncData(
      BackendConnectionState(
        rememberedAddress: previous.rememberedAddress,
        connecting: true,
      ),
    );
    try {
      final backend = await service.connect(address);
      ConnectionProblem? storageProblem;
      try {
        await store.remember(backend.address);
      } catch (_) {
        storageProblem = ConnectionProblem.storageWrite;
      }
      if (!ref.mounted) return;
      state = AsyncData(
        BackendConnectionState(
          rememberedAddress: storageProblem == null
              ? backend.address.toString()
              : previous.rememberedAddress,
          backend: backend,
          problem: storageProblem,
        ),
      );
    } on ConnectionException catch (error) {
      if (!ref.mounted) return;
      state = AsyncData(
        BackendConnectionState(
          rememberedAddress: previous.rememberedAddress,
          problem: error.problem,
        ),
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
