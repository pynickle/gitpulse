import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'dart:convert';

import 'backend_service.dart';
import 'native_capabilities.dart';

class BackendAddressStore {
  const BackendAddressStore(this._storage);

  final FlutterSecureStorage _storage;
  static const _key = 'last_successful_backend';

  Future<String?> read() => _storage.read(key: _key);

  Future<void> remember(Uri address) =>
      _storage.write(key: _key, value: address.toString());

  Future<void> rememberCapabilities(ConnectedBackend backend) => _storage.write(
    key: 'last_backend_capabilities',
    value: jsonEncode({
      'address': backend.address.toString(),
      'capabilities': backend.capabilities.toJson(),
    }),
  );

  Future<ConnectedBackend?> readOfflineBackend(String address) async {
    final raw = await _storage.read(key: 'last_backend_capabilities');
    if (raw == null) return null;
    final saved = jsonDecode(raw) as Map<String, dynamic>;
    final base = parseBackendAddress(address);
    if (saved['address'] != base.toString()) return null;
    final capabilities = NativeCapabilities.fromJson(
      saved['capabilities'] as Map<String, dynamic>,
    );
    // The saved capabilities are only trusted for a backend that can still be
    // read offline: any server that served this app's timeline carries these.
    if (capabilities.protocolVersion != 1 ||
        !capabilities.capabilities.contains('release-timeline') ||
        !capabilities.capabilities.contains('release-note-search-text')) {
      return null;
    }
    return ConnectedBackend(base, capabilities);
  }
}
