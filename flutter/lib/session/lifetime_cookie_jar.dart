import 'package:cookie_jar/cookie_jar.dart';

/// Persists session cookies and drops cookies after the server's Expires or
/// Max-Age. [PersistCookieJar] sends a still-stored `Secure` cookie on HTTPS
/// even after that lifetime; this jar records Max-Age as an absolute expiry
/// and filters both on load.
class LifetimeCookieJar extends PersistCookieJar {
  LifetimeCookieJar({required Storage storage})
    : super(persistSession: true, ignoreExpires: false, storage: storage);

  Future<void> _pending = Future.value();

  @override
  Future<void> saveFromResponse(Uri uri, List<Cookie> cookies) {
    final normalized = [for (final cookie in cookies) _absoluteExpiry(cookie)];
    return _serialize(() => super.saveFromResponse(uri, normalized));
  }

  @override
  Future<List<Cookie>> loadForRequest(Uri uri) {
    return _serialize(() async {
      final cookies = await super.loadForRequest(uri);
      final now = DateTime.now();
      return [
        for (final cookie in cookies)
          if (_allow(cookie, uri, now)) cookie,
      ];
    });
  }

  @override
  Future<void> delete(Uri uri, [bool withDomainSharedCookie = false]) =>
      _serialize(() => super.delete(uri, withDomainSharedCookie));

  @override
  Future<void> deleteAll() => _serialize(super.deleteAll);

  Future<T> _serialize<T>(Future<T> Function() action) {
    // A cancelled HTTP request may still be writing its response cookies.
    // Finish that write before logout removes the persisted credentials.
    final next = _pending.then((_) => action());
    _pending = next.then<void>((_) {}, onError: (Object _, StackTrace _) {});
    return next;
  }

  static Cookie _absoluteExpiry(Cookie cookie) {
    final maxAge = cookie.maxAge;
    if (maxAge == null) return cookie;
    return Cookie(cookie.name, cookie.value)
      ..expires = DateTime.now().add(Duration(seconds: maxAge))
      ..maxAge = maxAge
      ..domain = cookie.domain
      ..path = cookie.path
      ..secure = cookie.secure
      ..httpOnly = cookie.httpOnly
      ..sameSite = cookie.sameSite;
  }

  static bool _allow(Cookie cookie, Uri uri, DateTime now) {
    if (cookie.secure && uri.scheme != 'https') return false;
    final expires = cookie.expires;
    if (expires != null && !expires.isAfter(now)) return false;
    final maxAge = cookie.maxAge;
    if (maxAge != null && maxAge < 1) return false;
    return true;
  }
}
