import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class BackendAddressStore {
  const BackendAddressStore(this._storage);

  final FlutterSecureStorage _storage;
  static const _key = 'last_successful_backend';

  Future<String?> read() => _storage.read(key: _key);

  Future<void> remember(Uri address) =>
      _storage.write(key: _key, value: address.toString());
}
