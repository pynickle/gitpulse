import 'package:cookie_jar/cookie_jar.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// [PersistCookieJar] storage that keeps cookie records in the credential store
/// instead of a plaintext file. Keys are prefixed so they do not collide with
/// the remembered backend address or the public identity.
class SecureCookieStorage implements Storage {
  SecureCookieStorage(this._storage);

  final FlutterSecureStorage _storage;
  static const _prefix = 'cookie.';

  String _key(String key) => '$_prefix$key';

  @override
  Future<void> init(bool persistSession, bool ignoreExpires) async {}

  @override
  Future<String?> read(String key) => _storage.read(key: _key(key));

  @override
  Future<void> write(String key, String value) =>
      _storage.write(key: _key(key), value: value);

  @override
  Future<void> delete(String key) => _storage.delete(key: _key(key));

  @override
  Future<void> deleteAll(List<String> keys) async {
    for (final key in keys) {
      await delete(key);
    }
  }
}
