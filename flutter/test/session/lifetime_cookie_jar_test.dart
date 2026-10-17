import 'dart:async';

import 'package:cookie_jar/cookie_jar.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/session/lifetime_cookie_jar.dart';

class HeldCookieStorage implements Storage {
  final values = <String, String>{};
  final started = Completer<void>();
  final release = Completer<void>();
  bool holdNextWrite = true;

  @override
  Future<void> init(bool persistSession, bool ignoreExpires) async {}

  @override
  Future<String?> read(String key) async => values[key];

  @override
  Future<void> write(String key, String value) async {
    if (key == '.domains' && holdNextWrite) {
      holdNextWrite = false;
      started.complete();
      await release.future;
    }
    values[key] = value;
  }

  @override
  Future<void> delete(String key) async => values.remove(key);

  @override
  Future<void> deleteAll(List<String> keys) async {
    for (final key in keys) {
      values.remove(key);
    }
  }
}

void main() {
  test('logout cannot be undone by an already pending cookie write', () async {
    final storage = HeldCookieStorage();
    final jar = LifetimeCookieJar(storage: storage);
    final uri = Uri.parse('https://gitpulse.example/api/_auth/session');
    final saving = jar.saveFromResponse(uri, [
      Cookie('nuxt-session', 'old-session')
        ..domain = 'gitpulse.example'
        ..path = '/',
    ]);
    await storage.started.future;
    var deleted = false;
    final deleting = jar.delete(uri, true).then((_) => deleted = true);
    await Future<void>.delayed(Duration.zero);
    expect(deleted, isFalse);
    storage.release.complete();
    await saving;
    await deleting;

    final restarted = LifetimeCookieJar(storage: storage);
    expect(await restarted.loadForRequest(uri), isEmpty);
    expect(storage.values.values.join().contains('old-session'), isFalse);
  });
}
