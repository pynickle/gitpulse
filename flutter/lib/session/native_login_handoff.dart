import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

final browserLauncherProvider = Provider<Future<bool> Function(Uri)>(
  (ref) =>
      (uri) => launchUrl(uri, mode: LaunchMode.externalApplication),
);

final nativeLoginClockProvider = Provider<DateTime Function()>(
  (ref) => DateTime.now,
);

String createNativeLoginVerifier() {
  final random = Random.secure();
  return base64Url
      .encode(List.generate(32, (_) => random.nextInt(256)))
      .replaceAll('=', '');
}

String nativeLoginChallenge(String verifier) => base64Url
    .encode(sha256.convert(utf8.encode(verifier)).bytes)
    .replaceAll('=', '');

class NativeLoginAttempt {
  const NativeLoginAttempt({
    required this.id,
    required this.verifier,
    required this.backend,
    required this.browserUrl,
    required this.expiresAt,
    required this.confirmationCode,
    required this.interval,
  });

  factory NativeLoginAttempt.fromResponse(
    Object? data,
    Uri backend,
    String verifier,
  ) {
    if (data is! Map) throw const FormatException('Invalid sign-in attempt');
    final id = data['id'];
    final browser = data['browserUrl'];
    final expiry = data['expiresAt'];
    final code = data['confirmationCode'];
    final interval = data['interval'];
    if (id is! String ||
        id.isEmpty ||
        browser is! String ||
        expiry is! int ||
        code is! String ||
        code.isEmpty ||
        interval is! int ||
        interval < 2 ||
        interval > 30) {
      throw const FormatException('Invalid sign-in attempt');
    }
    final url = Uri.parse(browser);
    if (url.origin != backend.origin ||
        url.userInfo.isNotEmpty ||
        url.hasFragment ||
        url.path != backend.resolve('native-login').path ||
        url.queryParameters['id'] != id ||
        (url.queryParameters['browserToken'] ?? '').isEmpty) {
      throw const FormatException(
        'Sign-in browser URL is outside this backend',
      );
    }
    return NativeLoginAttempt(
      id: id,
      verifier: verifier,
      backend: backend,
      browserUrl: url,
      expiresAt: DateTime.fromMillisecondsSinceEpoch(expiry),
      confirmationCode: code,
      interval: Duration(seconds: interval),
    );
  }

  final String id;
  final String verifier;
  final Uri backend;
  final Uri browserUrl;
  final DateTime expiresAt;
  final String confirmationCode;
  final Duration interval;

  Map<String, String> get proof => {
    'id': id,
    'verifier': verifier,
    'origin': backend.origin,
  };
}
