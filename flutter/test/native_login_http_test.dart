import 'dart:convert';
import 'dart:io';

import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/connection/connection_controller.dart';
import 'package:gitpulse/session/gitpulse_http.dart';
import 'package:gitpulse/session/native_login_handoff.dart';
import 'package:gitpulse/session/session_controller.dart';

import 'support/provider_wait.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('real Flutter HTTP client completes the Nitro handoff with separate browser/app cookie jars and restores its session', () async {
    FlutterSecureStorage.setMockInitialValues({});
    final overrides = HttpOverrides.current;
    HttpOverrides.global = null;
    addTearDown(() => HttpOverrides.global = overrides);
    final directory = await Directory.systemTemp.createTemp(
      'gitpulse-handoff-http-',
    );
    final server = await Process.start('bun', [
      '../tests/fixtures/native-login-server.ts',
      directory.path,
    ]);
    final errors = StringBuffer();
    final stderr = server.stderr.transform(utf8.decoder).listen(errors.write);
    addTearDown(() async {
      server.kill();
      await server.exitCode.timeout(const Duration(seconds: 10));
      await stderr.cancel();
      await directory.delete(recursive: true);
    });
    final address = await server.stdout
        .transform(utf8.decoder)
        .transform(const LineSplitter())
        .first
        .timeout(
          const Duration(seconds: 20),
          onTimeout: () => throw StateError('Fixture did not start: $errors'),
        );
    final backend = Uri.parse(address);
    await const FlutterSecureStorage().write(
      key: 'last_successful_backend',
      value: address,
    );
    Uri? browserUrl;
    ProviderContainer createApp() => ProviderContainer(
      overrides: [
        browserLauncherProvider.overrideWithValue((uri) async {
          browserUrl = uri;
          return true;
        }),
      ],
    );
    var app = createApp();
    addTearDown(() => app.dispose());
    app.listen(sessionControllerProvider, (_, _) {});
    await app.read(connectionControllerProvider.future);
    await app.read(connectionControllerProvider.notifier).connect(address);
    await waitForSession(app, (state) => !state.busy);
    final session = app.read(sessionControllerProvider.notifier);
    await session.startBrowserSignIn();
    session.pauseBrowserSignIn();
    expect(app.read(sessionControllerProvider).browserSignInCode, isNotNull);
    expect(app.read(sessionControllerProvider).phase, SessionPhase.signedOut);
    expect(browserUrl!.path, '/pulse/native-login');

    final browserJar = CookieJar();
    final browser = createGitPulseDio(browserJar);
    addTearDown(() => browser.close(force: true));
    await browser.get<Object?>(
      backend.resolve('test/oauth-success').toString(),
    );
    final page = await browser.get<String>(browserUrl.toString());
    expect(
      page.data,
      contains(app.read(sessionControllerProvider).browserSignInCode!),
    );
    expect(page.data, isNot(contains('github-token-never-in-urls')));
    // A browser form POST must carry a real Origin: the page's referrer policy
    // decides that, and `no-referrer` would make the origin the literal `null`,
    // which the double-submit check rejects.
    expect(page.headers.value('referrer-policy'), 'same-origin');
    final approved = await browser.post<Object?>(
      backend.resolve('auth/native/approve').toString(),
      data: {
        'id': browserUrl!.queryParameters['id'],
        'browserToken': browserUrl!.queryParameters['browserToken'],
      },
      options: Options(headers: {'origin': backend.origin}),
    );
    expect(approved.statusCode, 200);
    expect(app.read(sessionControllerProvider).phase, SessionPhase.signedOut);
    session.resumeBrowserSignIn();
    await waitForSession(app, (state) => state.phase == SessionPhase.signedIn);
    expect(app.read(sessionControllerProvider).identity?.login, 'octocat');
    final appCookies = await app
        .read(cookieJarProvider)
        .loadForRequest(backend);
    final browserCookies = await browserJar.loadForRequest(backend);
    expect(
      appCookies
          .singleWhere((cookie) => cookie.name == sessionCookieName)
          .value,
      isNot(
        browserCookies
            .singleWhere((cookie) => cookie.name == sessionCookieName)
            .value,
      ),
    );
    final response = await session.request(
      method: 'GET',
      path: 'api/_auth/session',
    );
    expect((response.data as Map)['user'], containsPair('login', 'octocat'));

    app.dispose();
    app = createApp();
    app.listen(sessionControllerProvider, (_, _) {});
    await app.read(connectionControllerProvider.future);
    await waitForSession(app, (state) => state.phase == SessionPhase.signedIn);
    expect(app.read(sessionControllerProvider).identity?.login, 'octocat');
  });
}
