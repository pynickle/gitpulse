import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:cookie_jar/cookie_jar.dart';
import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/app.dart';
import 'package:gitpulse/timeline/timeline_screen.dart';
import 'package:gitpulse/connection/connection_controller.dart';
import 'package:gitpulse/session/gitpulse_http.dart';
import 'package:gitpulse/session/lifetime_cookie_jar.dart';
import 'package:gitpulse/session/secure_cookie_storage.dart';
import 'package:gitpulse/session/session_controller.dart';
import 'package:gitpulse/session/secure_storage.dart';
import 'package:gitpulse/session/native_login_handoff.dart';

class FaultyStorage extends FlutterSecureStorage {
  String? failWrite;
  String? failDelete;

  @override
  Future<void> write({
    required String key,
    required String? value,
    AppleOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    AppleOptions? mOptions,
    WindowsOptions? wOptions,
  }) async {
    if (key == failWrite) throw StateError('credential store unavailable');
    await super.write(key: key, value: value);
  }

  @override
  Future<void> delete({
    required String key,
    AppleOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    AppleOptions? mOptions,
    WindowsOptions? wOptions,
  }) async {
    if (key == failDelete) throw StateError('credential store unavailable');
    await super.delete(key: key);
  }
}

class UnreadableCookieJar extends LifetimeCookieJar {
  UnreadableCookieJar()
    : super(storage: SecureCookieStorage(const FlutterSecureStorage()));

  bool failLoad = false;

  @override
  Future<List<Cookie>> loadForRequest(Uri uri) {
    if (failLoad) throw StateError('credential store unavailable');
    return super.loadForRequest(uri);
  }
}

class RecordedRequest {
  RecordedRequest({
    required this.method,
    required this.uri,
    required this.headers,
    required this.body,
  });

  final String method;
  final Uri uri;
  final Map<String, String> headers;
  final String body;
}

class AuthServer implements HttpClientAdapter {
  AuthServer({Map<String, Object?>? providers})
    : providers =
          providers ??
          {
            'personalMode': true,
            'patEnabled': false,
            'oauthEnabled': false,
            'mode': 'personal',
          };

  Map<String, Object?> providers;
  bool offline = false;
  int featureStatus = 200;
  String featureMessage = 'OK';
  int? signInStatus;
  String? signInMessage;
  String? acceptedLogin;
  String csrf = 'csrf-token-1';
  String sessionValue = 'sealed-session-value';
  String sessionAttributes = 'Path=/; HttpOnly; SameSite=Lax';
  bool expireSessionImmediately = false;
  final requests = <RecordedRequest>[];
  Future<void>? hold;
  bool holding = false;
  String heldPath = 'release-timeline';
  int sessionStatus = 200;
  bool handoffEnabled = false;
  String handoffStatus = 'pending';
  String? handoffChallenge;
  int handoffNumber = 0;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    if (hold != null && options.uri.path.contains(heldPath)) {
      holding = true;
      final outcome = await Future.any<String>([
        hold!.then((_) => 'go'),
        if (cancelFuture != null) cancelFuture.then((_) => 'cancel'),
      ]);
      holding = false;
      if (outcome == 'cancel') {
        throw DioException.requestCancelled(
          requestOptions: options,
          reason: 'cancelled',
        );
      }
    }
    final body = await _readBody(requestStream);
    final headers = {
      for (final entry in options.headers.entries)
        entry.key.toLowerCase(): entry.value?.toString() ?? '',
    };
    requests.add(
      RecordedRequest(
        method: options.method.toUpperCase(),
        uri: options.uri,
        headers: headers,
        body: body,
      ),
    );
    if (offline) {
      throw DioException.connectionError(
        requestOptions: options,
        reason: 'offline',
      );
    }
    final path = options.uri.path;
    if (path.endsWith('/api/native/capabilities')) {
      return _json(
        200,
        {
          'protocolVersion': 1,
          'capabilities': [
            'provider-discovery',
            'release-timeline',
            if (handoffEnabled) 'native-login-handoff',
          ],
          'providers': providers,
        },
        cookies: ['gitpulse_csrf=$csrf; Path=/; SameSite=Lax'],
      );
    }
    if (path.endsWith('/auth/native/create')) {
      final input = jsonDecode(body) as Map<String, dynamic>;
      handoffChallenge = input['challenge'] as String;
      handoffStatus = 'pending';
      handoffNumber++;
      return _json(200, {
        'id': 'attempt-$handoffNumber',
        'browserUrl':
            '${options.uri.origin}/native-login?id=attempt-$handoffNumber&browserToken=browser-only',
        'expiresAt': DateTime.now()
            .add(const Duration(minutes: 10))
            .millisecondsSinceEpoch,
        'confirmationCode': 'ABCD1234',
        'interval': 2,
      });
    }
    if (path.endsWith('/auth/native/status') ||
        path.endsWith('/auth/native/redeem')) {
      final input = body.isEmpty
          ? null
          : jsonDecode(body) as Map<String, dynamic>;
      final proof =
          input?['verifier'] as String? ?? headers['x-native-verifier'];
      final challenge = base64Url
          .encode(sha256.convert(utf8.encode(proof ?? '')).bytes)
          .replaceAll('=', '');
      if (challenge != handoffChallenge) {
        return _json(403, {'statusMessage': 'Invalid app sign-in proof'});
      }
      if (path.endsWith('/status')) {
        return _json(200, {'status': handoffStatus});
      }
      if (handoffStatus != 'approved') {
        return _json(409, {'statusMessage': handoffStatus});
      }
      handoffStatus = 'redeemed';
      acceptedLogin = 'octocat';
      return _json(
        200,
        {'user': _user('octocat')},
        cookies: ['nuxt-session=$sessionValue; $sessionAttributes'],
      );
    }
    if (path.endsWith('/auth/native/cancel')) {
      handoffStatus = 'cancelled';
      return _json(200, {'status': 'cancelled'});
    }
    if (path.endsWith('/auth/unlock') || path.endsWith('/auth/pat')) {
      final csrfHeader = headers['x-csrf-token'];
      if (csrfHeader != csrf) {
        return _json(403, {
          'statusCode': 403,
          'statusMessage': 'csrf_mismatch',
        });
      }
      return _signIn(options.uri, body);
    }
    if (path.endsWith('/auth/logout')) {
      acceptedLogin = null;
      return _json(
        200,
        {'ok': true},
        cookies: ['nuxt-session=; Path=/; Max-Age=0'],
      );
    }
    if (path.endsWith('/api/_auth/session')) {
      if (sessionStatus != 200) {
        return _json(sessionStatus, {'statusMessage': 'Session probe failed'});
      }
      final cookie = headers['cookie'] ?? '';
      if (acceptedLogin != null &&
          cookie.contains('nuxt-session=$sessionValue')) {
        return _json(200, {'user': _user(acceptedLogin!)});
      }
      return _json(200, {'id': 'empty'});
    }
    final status = featureStatus;
    return _json(status, {
      'statusCode': status,
      'statusMessage': featureMessage,
    });
  }

  ResponseBody _signIn(Uri uri, String body) {
    if (signInStatus != null) {
      return _json(signInStatus!, {
        'statusCode': signInStatus,
        'statusMessage': signInMessage ?? 'API rate limit exceeded',
      });
    }
    final decoded = body.isEmpty ? const <String, Object?>{} : jsonDecode(body);
    if (decoded is! Map) {
      return _json(400, {'statusMessage': 'Invalid request body'});
    }
    final password = decoded['password'];
    final token = decoded['token'];
    if (password is String) {
      if (password != 'correct-horse') {
        return _json(401, {
          'statusCode': 401,
          'statusMessage': 'Invalid password',
        });
      }
    } else if (token is String) {
      if (token == 'ghp_bad') {
        return _json(401, {
          'statusCode': 401,
          'statusMessage': 'Invalid GitHub token',
        });
      }
      if (token == 'ghp_disabled') {
        return _json(403, {
          'statusCode': 403,
          'statusMessage': 'Token authentication is disabled',
        });
      }
      if (token != 'ghp_octocat' && token != 'ghp_hubot') {
        return _json(500, {
          'statusCode': 500,
          'statusMessage': 'Failed to validate GitHub token',
        });
      }
    } else {
      return _json(400, {'statusMessage': 'Invalid request body'});
    }
    final login = uri.host == 'other.example' || token == 'ghp_hubot'
        ? 'hubot'
        : 'octocat';
    acceptedLogin = login;
    final attributes = expireSessionImmediately
        ? 'Path=/; Secure; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
        : sessionAttributes;
    return _json(
      200,
      {'ok': true, 'user': _user(login)},
      cookies: ['nuxt-session=$sessionValue; $attributes'],
    );
  }

  Map<String, String> _user(String login) => {
    'login': login,
    'name': login == 'hubot' ? 'Hubot' : 'Octocat',
    'avatar_url': '',
  };

  ResponseBody _json(int status, Object? payload, {List<String>? cookies}) {
    return ResponseBody.fromString(
      jsonEncode(payload),
      status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
        'set-cookie': ?cookies,
      },
    );
  }

  Future<String> _readBody(Stream<Uint8List>? stream) async {
    if (stream == null) return '';
    final bytes = BytesBuilder(copy: false);
    await for (final chunk in stream) {
      bytes.add(chunk);
    }
    return utf8.decode(bytes.takeBytes());
  }

  @override
  void close({bool force = false}) {}
}

Future<ProviderContainer> mountApp(
  WidgetTester tester,
  AuthServer server, {
  bool resetStorage = true,
  FlutterSecureStorage? storage,
  UnreadableCookieJar? jar,
  Future<bool> Function(Uri)? launchBrowser,
  DateTime Function()? clock,
}) async {
  if (resetStorage) FlutterSecureStorage.setMockInitialValues({});
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        if (storage != null) secureStorageProvider.overrideWithValue(storage),
        if (jar != null) cookieJarProvider.overrideWithValue(jar),
        if (launchBrowser != null)
          browserLauncherProvider.overrideWithValue(launchBrowser),
        if (clock != null) nativeLoginClockProvider.overrideWithValue(clock),
        connectionDioProvider.overrideWith((ref) {
          final dio = createGitPulseDio(ref.watch(cookieJarProvider));
          dio.httpClientAdapter = server;
          ref.onDispose(() => dio.close(force: true));
          return dio;
        }),
      ],
      child: const GitPulseApp(),
    ),
  );
  await tester.pumpAndSettle();
  return ProviderScope.containerOf(tester.element(find.byType(GitPulseApp)));
}

Future<void> connectTo(WidgetTester tester, String address) async {
  final container = ProviderScope.containerOf(
    tester.element(find.byType(GitPulseApp)),
  );
  await pumped(
    tester,
    container.read(connectionControllerProvider.notifier).connect(address),
  );
  await tester.pumpAndSettle();
}

Finder fieldLabeled(String label) => find.byWidgetPredicate(
  (widget) => widget is TextField && widget.decoration?.labelText == label,
);

/// Dio delivers the response body on the event queue. Awaiting a request
/// without pumping the widget tester leaves that queue, and the timeout, stuck.
Future<T> pumped<T>(WidgetTester tester, Future<T> future) async {
  var completed = false;
  future.whenComplete(() => completed = true);
  for (var attempt = 0; attempt < 40 && !completed; attempt++) {
    await tester.pump(const Duration(milliseconds: 50));
  }
  expect(completed, isTrue, reason: 'timed out waiting for a backend request');
  return future;
}

Future<void> submitField(
  WidgetTester tester, {
  required String label,
  required String value,
  required String action,
}) async {
  await tester.enterText(fieldLabeled(label), value);
  await tester.tap(find.text(action));
  await tester.pumpAndSettle();
}

void expectIdentity(WidgetTester tester, String login) {
  final container = ProviderScope.containerOf(
    tester.element(find.byType(GitPulseApp)),
  );
  expect(container.read(sessionControllerProvider).identity?.login, login);
}

void main() {
  testWidgets(
    'opening, cancelling, or submitting an invalid backend keeps the session',
    (tester) async {
      final server = AuthServer();
      final container = await mountApp(tester, server);
      await submitField(
        tester,
        label: 'Password',
        value: 'correct-horse',
        action: 'Unlock',
      );
      await tester.tap(find.text('Settings').last);
      await tester.pumpAndSettle();
      final storage = await const FlutterSecureStorage().readAll();
      final before = server.requests.length;
      await tester.tap(find.text('Change backend'));
      await tester.pumpAndSettle();
      await tester.enterText(
        fieldLabeled('Backend address'),
        'invalid.example',
      );
      await tester.tap(find.text('Connect'));
      await tester.pumpAndSettle();
      expect(find.textContaining('Enter an HTTP or HTTPS'), findsOneWidget);
      expectIdentity(tester, 'octocat');
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
      expectIdentity(tester, 'octocat');
      expect(server.requests, hasLength(before));
      expect(
        container
            .read(sessionControllerProvider.notifier)
            .transitionLog
            .whereType<IdentityCleared>(),
        isEmpty,
      );
      expect(await const FlutterSecureStorage().readAll(), storage);
      expect(find.text('Signed in as octocat'), findsOneWidget);
    },
  );

  for (final width in [390.0, 1280.0]) {
    testWidgets('account actions stay in Settings at width $width', (
      tester,
    ) async {
      tester.view.physicalSize = Size(width, 900);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      tester.view.padding = const FakeViewPadding(top: 24);
      addTearDown(tester.view.resetPadding);
      await mountApp(tester, AuthServer());
      await submitField(
        tester,
        label: 'Password',
        value: 'correct-horse',
        action: 'Unlock',
      );
      expect(find.text('Signed in as octocat'), findsNothing);
      expect(find.text('Sign out'), findsNothing);
      expect(find.text('Release Timeline'), findsNothing);
      expect(find.textContaining('GitPulse ·'), findsNothing);
      final refresh = find.byTooltip('Reload');
      expect(refresh, findsOneWidget);
      expect(tester.getTopLeft(refresh).dy, greaterThanOrEqualTo(24));
      expect(tester.getCenter(refresh).dy, lessThan(90));
      expect(tester.getCenter(refresh).dx, greaterThan(width - 80));
      await tester.tap(find.text('Follows').last);
      await tester.pumpAndSettle();
      expect(find.text('Signed in as octocat'), findsNothing);
      expect(find.text('Sign out'), findsNothing);
      await tester.tap(find.text('Settings').last);
      await tester.pumpAndSettle();
      expect(find.text('Signed in as octocat'), findsOneWidget);
      expect(find.text('Sign out'), findsOneWidget);
      expect(find.text('Change backend'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets(
    'a cancelled attempt ignores a held poll and can be superseded by a fresh login',
    (tester) async {
      final server = AuthServer(
        providers: {
          'personalMode': false,
          'patEnabled': false,
          'oauthEnabled': true,
          'mode': 'oauth-only',
        },
      )..handoffEnabled = true;
      final container = await mountApp(
        tester,
        server,
        launchBrowser: (_) async => true,
      );
      await connectTo(tester, 'https://gitpulse.example');
      final session = container.read(sessionControllerProvider.notifier);
      await pumped(tester, session.startBrowserSignIn());
      await tester.pumpAndSettle();
      final held = Completer<void>();
      server
        ..hold = held.future
        ..heldPath = '/auth/native/status';
      final polling = session.pollBrowserSignIn();
      await tester.pumpAndSettle();
      expect(server.holding, isTrue);
      await pumped(tester, session.cancelBrowserSignIn());
      held.complete();
      await pumped(tester, polling);
      server.hold = null;
      expect(
        container.read(sessionControllerProvider).browserSignInCode,
        isNull,
      );
      expect(
        container.read(sessionControllerProvider).phase,
        SessionPhase.signedOut,
      );
      expect(
        server.requests.any((request) => request.uri.path.endsWith('/redeem')),
        isFalse,
      );
      await pumped(tester, session.startBrowserSignIn());
      await tester.pumpAndSettle();
      server.handoffStatus = 'approved';
      await pumped(tester, session.pollBrowserSignIn());
      expect(
        container.read(sessionControllerProvider).phase,
        SessionPhase.signedIn,
      );
      expect(server.handoffNumber, 2);
      // The Timeline destination starts its first round as soon as the session
      // is established; let that request finish instead of ending the test with
      // its timer still pending.
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'foreground return expires a pending attempt and reports browser launch failure',
    (tester) async {
      final server = AuthServer(
        providers: {
          'personalMode': false,
          'patEnabled': false,
          'oauthEnabled': true,
          'mode': 'oauth-only',
        },
      )..handoffEnabled = true;
      var now = DateTime.now();
      var launch = true;
      final container = await mountApp(
        tester,
        server,
        launchBrowser: (_) async => launch,
        clock: () => now,
      );
      await connectTo(tester, 'https://gitpulse.example');
      final session = container.read(sessionControllerProvider.notifier);
      await pumped(tester, session.startBrowserSignIn());
      session.pauseBrowserSignIn();
      now = now.add(const Duration(minutes: 11));
      session.resumeBrowserSignIn();
      await tester.pumpAndSettle();
      expect(
        container.read(sessionControllerProvider).failure,
        SignInFailure.expired,
      );
      expect(
        find.text('Browser sign-in expired. Start a new attempt.'),
        findsOneWidget,
      );
      expect(container.read(sessionControllerProvider).busy, isFalse);
      launch = false;
      await pumped(tester, session.startBrowserSignIn());
      await tester.pumpAndSettle();
      expect(
        container.read(sessionControllerProvider).failure,
        SignInFailure.browserLaunch,
      );
      expect(server.handoffStatus, 'cancelled');
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'OAuth opens the system browser and foreground resume redeems an independent app session',
    (tester) async {
      final server = AuthServer(
        providers: {
          'personalMode': false,
          'patEnabled': false,
          'oauthEnabled': true,
          'mode': 'oauth-only',
        },
      )..handoffEnabled = true;
      Uri? launched;
      final container = await mountApp(
        tester,
        server,
        launchBrowser: (uri) async {
          launched = uri;
          return true;
        },
      );
      await connectTo(tester, 'https://gitpulse.example');
      await tester.tap(find.text('Continue with GitHub'));
      await tester.pumpAndSettle();
      expect(launched?.origin, 'https://gitpulse.example');
      expect(find.textContaining('ABCD1234'), findsOneWidget);
      expect(
        container.read(sessionControllerProvider).phase,
        SessionPhase.signedOut,
      );
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
      server.handoffStatus = 'approved';
      await tester.pump(const Duration(seconds: 5));
      expect(server.handoffStatus, 'approved');
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pumpAndSettle();
      expectIdentity(tester, 'octocat');
      final redeem = server.requests.singleWhere(
        (request) => request.uri.path.endsWith('/auth/native/redeem'),
      );
      expect(redeem.headers['x-csrf-token'], server.csrf);
      expect(redeem.headers['cookie'], isNot(contains('nuxt-session=')));
      expect(
        launched.toString(),
        isNot(contains(jsonDecode(redeem.body)['verifier'] as String)),
      );
      final stored = await const FlutterSecureStorage().readAll();
      expect(stored.values.join(), contains(server.sessionValue));
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'CSRF credential-store reads fail as storage errors, not network loss',
    (tester) async {
      final server = AuthServer();
      final jar = UnreadableCookieJar();
      final container = await mountApp(tester, server, jar: jar);
      await connectTo(tester, 'https://gitpulse.example');
      jar.failLoad = true;
      await submitField(
        tester,
        label: 'Password',
        value: 'correct-horse',
        action: 'Unlock',
      );
      expect(
        container.read(sessionControllerProvider).failure,
        SignInFailure.storage,
      );
      expect(container.read(sessionControllerProvider).busy, isFalse);
      expect(tester.takeException(), isNull);
      jar.failLoad = false;
      await submitField(
        tester,
        label: 'Password',
        value: 'correct-horse',
        action: 'Unlock',
      );
      jar.failLoad = true;
      final result = await pumped(
        tester,
        container
            .read(sessionControllerProvider.notifier)
            .request(method: 'POST', path: 'api/release-timeline/refresh'),
      );
      expect(result.problem, BackendProblem.storage);
      expect(
        container.read(sessionControllerProvider).phase,
        SessionPhase.signedIn,
      );
    },
  );

  testWidgets(
    'cookie persistence failures are surfaced and sign-in can be retried',
    (tester) async {
      final server = AuthServer();
      final storage = FaultyStorage();
      final container = await mountApp(tester, server, storage: storage);
      await connectTo(tester, 'https://gitpulse.example');
      storage.failWrite = 'cookie.gitpulse.example';
      await submitField(
        tester,
        label: 'Password',
        value: 'correct-horse',
        action: 'Unlock',
      );
      expect(
        container.read(sessionControllerProvider).failure,
        SignInFailure.storage,
      );
      expect(container.read(sessionControllerProvider).busy, isFalse);
      expect(find.textContaining('Signed in as'), findsNothing);
      storage.failWrite = null;
      await submitField(
        tester,
        label: 'Password',
        value: 'correct-horse',
        action: 'Unlock',
      );
      expectIdentity(tester, 'octocat');
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'logout inside a restoration event cannot restore identity afterward',
    (tester) async {
      final server = AuthServer();
      final container = await mountApp(tester, server);
      await connectTo(tester, 'https://gitpulse.example');
      await submitField(
        tester,
        label: 'Password',
        value: 'correct-horse',
        action: 'Unlock',
      );
      final notifier = container.read(sessionControllerProvider.notifier);
      server.featureStatus = 401;
      await pumped(
        tester,
        notifier.request(method: 'GET', path: 'api/repos/octocat/hello'),
      );
      await tester.pumpAndSettle();
      Future<void>? signingOut;
      final subscription = notifier.transitions.listen((event) {
        if (event is IdentityRestored) signingOut = notifier.signOut();
      });
      await submitField(
        tester,
        label: 'Password',
        value: 'correct-horse',
        action: 'Unlock',
      );
      expect(signingOut, isNotNull);
      await pumped(tester, signingOut!);
      await tester.runAsync(subscription.cancel);
      expect(
        container.read(sessionControllerProvider).phase,
        SessionPhase.signedOut,
      );
      final stored = await const FlutterSecureStorage().readAll();
      expect(stored.containsKey('authenticated_identity'), isFalse);
      expect(stored.values.join().contains(server.sessionValue), isFalse);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('Max-Age takes precedence over an already-past Expires', (
    tester,
  ) async {
    final server = AuthServer()
      ..sessionAttributes =
          'Path=/; Secure; Max-Age=3600; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
    await mountApp(tester, server);
    await connectTo(tester, 'https://gitpulse.example');
    await submitField(
      tester,
      label: 'Password',
      value: 'correct-horse',
      action: 'Unlock',
    );
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpAndSettle();
    await mountApp(tester, server, resetStorage: false);

    expectIdentity(tester, 'octocat');
    expect(fieldLabeled('Password'), findsNothing);
  });

  testWidgets(
    'identity storage failures are shown without leaving sign-in busy',
    (tester) async {
      final storage = FaultyStorage()..failWrite = 'authenticated_identity';
      final server = AuthServer();
      final container = await mountApp(tester, server, storage: storage);
      await connectTo(tester, 'https://gitpulse.example');
      await submitField(
        tester,
        label: 'Password',
        value: 'correct-horse',
        action: 'Unlock',
      );
      expect(container.read(sessionControllerProvider).busy, isFalse);
      expect(
        find.text('Could not access the secure credential store.'),
        findsOneWidget,
      );
      expectIdentity(tester, 'octocat');
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'failed identity deletion still clears cookies and can be retried',
    (tester) async {
      final storage = FaultyStorage();
      final server = AuthServer();
      final container = await mountApp(tester, server, storage: storage);
      await connectTo(tester, 'https://gitpulse.example');
      await submitField(
        tester,
        label: 'Password',
        value: 'correct-horse',
        action: 'Unlock',
      );
      storage.failDelete = 'authenticated_identity';
      final notifier = container.read(sessionControllerProvider.notifier);
      await pumped(tester, notifier.signOut());
      await tester.pumpAndSettle();
      expect(container.read(sessionControllerProvider).busy, isFalse);
      expect(
        container.read(sessionControllerProvider).phase,
        SessionPhase.signedOut,
      );
      expect(
        find.text('Could not access the secure credential store.'),
        findsOneWidget,
      );
      var stored = await storage.readAll();
      expect(stored.values.join().contains(server.sessionValue), isFalse);
      storage.failDelete = null;
      await pumped(tester, notifier.signOut());
      stored = await storage.readAll();
      expect(stored.containsKey('authenticated_identity'), isFalse);
      expect(container.read(sessionControllerProvider).failure, isNull);
    },
  );

  testWidgets('logout blocks a new login until its cookie cleanup completes', (
    tester,
  ) async {
    final server = AuthServer();
    final container = await mountApp(tester, server);
    await connectTo(tester, 'https://gitpulse.example');
    await submitField(
      tester,
      label: 'Password',
      value: 'correct-horse',
      action: 'Unlock',
    );
    final hold = Completer<void>();
    server
      ..heldPath = '/auth/logout'
      ..hold = hold.future;
    final notifier = container.read(sessionControllerProvider.notifier);
    final signingOut = notifier.signOut();
    for (var i = 0; i < 40 && !server.holding; i++) {
      await tester.pump(const Duration(milliseconds: 10));
    }
    expect(server.holding, isTrue);
    expect(container.read(sessionControllerProvider).busy, isTrue);
    await notifier.unlock('correct-horse');
    expect(
      server.requests.where((r) => r.uri.path.endsWith('/auth/unlock')),
      hasLength(1),
    );
    hold.complete();
    await pumped(tester, signingOut);
    await tester.pumpAndSettle();
    expect(container.read(sessionControllerProvider).busy, isFalse);
    await submitField(
      tester,
      label: 'Password',
      value: 'correct-horse',
      action: 'Unlock',
    );
    expectIdentity(tester, 'octocat');
    final cookies = await container
        .read(cookieJarProvider)
        .loadForRequest(
          Uri.parse('https://gitpulse.example/api/_auth/session'),
        );
    expect(
      cookies.any(
        (cookie) =>
            cookie.name == sessionCookieName &&
            cookie.value == server.sessionValue,
      ),
      isTrue,
    );
  });

  testWidgets(
    'authentication rejection cancels pending work and pauses new API requests',
    (tester) async {
      final server = AuthServer();
      final container = await mountApp(tester, server);
      await connectTo(tester, 'https://gitpulse.example');
      await submitField(
        tester,
        label: 'Password',
        value: 'correct-horse',
        action: 'Unlock',
      );
      final hold = Completer<void>();
      server.hold = hold.future;
      final notifier = container.read(sessionControllerProvider.notifier);
      final pending = notifier.request(
        method: 'GET',
        path: 'api/release-timeline',
      );
      for (var i = 0; i < 40 && !server.holding; i++) {
        await tester.pump(const Duration(milliseconds: 10));
      }
      expect(server.holding, isTrue);
      server.featureStatus = 401;
      await pumped(
        tester,
        notifier.request(method: 'GET', path: 'api/repos/octocat/hello'),
      );
      expect((await pumped(tester, pending)).cancelled, isTrue);
      final before = server.requests.length;
      final result = await notifier.request(
        method: 'GET',
        path: 'api/repos/octocat/hello',
      );
      expect(result.problem, BackendProblem.authenticationRejected);
      expect(server.requests, hasLength(before));
      hold.complete();
    },
  );

  for (final status in [403, 429, 500]) {
    testWidgets('session restoration preserves identity on HTTP $status', (
      tester,
    ) async {
      final server = AuthServer();
      await mountApp(tester, server);
      await connectTo(tester, 'https://gitpulse.example');
      await submitField(
        tester,
        label: 'Password',
        value: 'correct-horse',
        action: 'Unlock',
      );
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pumpAndSettle();
      server.sessionStatus = status;
      final container = await mountApp(tester, server, resetStorage: false);

      expect(
        container.read(sessionControllerProvider).phase,
        SessionPhase.signedIn,
      );
      expect(container.read(sessionControllerProvider).busy, isFalse);
      expect(find.textContaining('Your session ended'), findsNothing);
      expect(
        container
            .read(sessionControllerProvider.notifier)
            .transitionLog
            .whereType<SessionRejected>(),
        isEmpty,
      );
    });
  }

  testWidgets(
    'choosing another account clears identity and cancels work before a new PAT',
    (tester) async {
      final server = AuthServer(
        providers: {
          'personalMode': false,
          'patEnabled': true,
          'oauthEnabled': false,
          'mode': 'pat-only',
        },
      );
      final container = await mountApp(tester, server);
      await connectTo(tester, 'https://pat.example');
      await submitField(
        tester,
        label: 'GitHub token',
        value: 'ghp_octocat',
        action: 'Continue',
      );
      final hold = Completer<void>();
      server.hold = hold.future;
      final notifier = container.read(sessionControllerProvider.notifier);
      final pending = notifier.request(
        method: 'GET',
        path: 'api/release-timeline',
      );
      for (var i = 0; i < 40 && !server.holding; i++) {
        await tester.pump(const Duration(milliseconds: 10));
      }
      expect(server.holding, isTrue);
      await tester.tap(find.text('Settings').last);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Use a different account'));
      expect(container.read(sessionControllerProvider).identity, isNull);
      expect(
        notifier.transitionLog.whereType<IdentityCleared>().single.reason,
        IdentityClearReason.accountSwitch,
      );
      expect((await pumped(tester, pending)).cancelled, isTrue);
      await tester.pumpAndSettle();
      final stored = await const FlutterSecureStorage().readAll();
      expect(stored.values.join().contains(server.sessionValue), isFalse);
      expect(fieldLabeled('GitHub token'), findsOneWidget);
      hold.complete();
    },
  );

  testWidgets(
    'personal password sign-in sends CSRF, shows the identity, and does not store the password',
    (tester) async {
      final server = AuthServer();
      await mountApp(tester, server);
      await connectTo(tester, 'https://gitpulse.example');
      expect(fieldLabeled('Password'), findsOneWidget);
      expect(fieldLabeled('GitHub token'), findsNothing);
      expect(
        tester.widget<TextField>(fieldLabeled('Password')).obscureText,
        isTrue,
      );

      await submitField(
        tester,
        label: 'Password',
        value: 'correct-horse',
        action: 'Unlock',
      );

      expectIdentity(tester, 'octocat');
      // The Timeline destination shows the Release Timeline itself now that the
      // placeholder of the connection shell has been replaced.
      expect(find.byType(TimelineScreen), findsOneWidget);
      final unlock = server.requests
          .where((request) => request.uri.path.endsWith('/auth/unlock'))
          .single;
      expect(unlock.headers['x-csrf-token'], server.csrf);
      expect(
        unlock.headers['cookie'],
        contains('gitpulse_csrf=${server.csrf}'),
      );
      expect(unlock.headers.containsKey('authorization'), isFalse);
      expect(jsonDecode(unlock.body), {
        'password': 'correct-horse',
        'remember': false,
      });
      final stored = await const FlutterSecureStorage().readAll();
      final blob = stored.values.join('\n');
      expect(blob.contains('correct-horse'), isFalse);
      expect(blob.contains(server.sessionValue), isTrue);
    },
  );

  testWidgets(
    'a wrong password stays on the password form and does not offer another provider',
    (tester) async {
      final server = AuthServer();
      await mountApp(tester, server);
      await connectTo(tester, 'https://gitpulse.example');
      await submitField(
        tester,
        label: 'Password',
        value: 'nope',
        action: 'Unlock',
      );
      expect(
        find.text('That password is not valid for this server.'),
        findsOneWidget,
      );
      expect(fieldLabeled('GitHub token'), findsNothing);
      expect(find.textContaining('OAuth'), findsNothing);
      expect(find.text('Signed in as octocat'), findsNothing);
      final stored = await const FlutterSecureStorage().readAll();
      expect(stored.values.join('\n').contains('nope'), isFalse);
    },
  );

  testWidgets(
    'PAT sign-in is shown only when the server enables it and the token is not stored',
    (tester) async {
      final server = AuthServer()
        ..providers = {
          'personalMode': false,
          'patEnabled': true,
          'oauthEnabled': true,
          'mode': 'hybrid',
        };
      await mountApp(tester, server);
      await connectTo(tester, 'http://127.0.0.1:3000/gitpulse');
      expect(fieldLabeled('Password'), findsNothing);
      expect(fieldLabeled('GitHub token'), findsOneWidget);
      expect(find.text('GitHub OAuth'), findsNothing);
      expect(find.text('Continue with GitHub'), findsNothing);

      await submitField(
        tester,
        label: 'GitHub token',
        value: 'ghp_bad',
        action: 'Continue',
      );
      expect(
        find.text('That personal access token was rejected.'),
        findsOneWidget,
      );
      expect(find.textContaining('password'), findsNothing);
      expect(find.textContaining('try OAuth'), findsNothing);

      await submitField(
        tester,
        label: 'GitHub token',
        value: 'ghp_octocat',
        action: 'Continue',
      );
      expectIdentity(tester, 'octocat');
      final pat = server.requests
          .where(
            (request) =>
                request.method == 'POST' &&
                request.uri.path.endsWith('/auth/pat'),
          )
          .last;
      expect(pat.uri.toString(), 'http://127.0.0.1:3000/gitpulse/auth/pat');
      expect(pat.headers['x-csrf-token'], server.csrf);
      expect(jsonDecode(pat.body), {'token': 'ghp_octocat'});
      final stored = await const FlutterSecureStorage().readAll();
      expect(stored.values.join('\n').contains('ghp_octocat'), isFalse);
    },
  );

  testWidgets('oauth-only servers do not show password or PAT forms', (
    tester,
  ) async {
    final server = AuthServer()
      ..handoffEnabled = true
      ..providers = {
        'personalMode': false,
        'patEnabled': false,
        'oauthEnabled': true,
        'mode': 'oauth-only',
      };
    await mountApp(tester, server);
    await connectTo(tester, 'https://oauth.example');
    expect(fieldLabeled('Password'), findsNothing);
    expect(fieldLabeled('GitHub token'), findsNothing);
    expect(find.textContaining('only offers GitHub OAuth'), findsOneWidget);
  });

  testWidgets('a disabled PAT method is reported without signing in', (
    tester,
  ) async {
    final server = AuthServer()
      ..providers = {
        'personalMode': false,
        'patEnabled': true,
        'oauthEnabled': false,
        'mode': 'pat-only',
      };
    await mountApp(tester, server);
    await connectTo(tester, 'https://pat.example');
    await submitField(
      tester,
      label: 'GitHub token',
      value: 'ghp_disabled',
      action: 'Continue',
    );
    expect(
      find.text('This sign-in method is not enabled on the server.'),
      findsOneWidget,
    );
    expect(find.textContaining('Signed in as'), findsNothing);
  });

  testWidgets(
    'restart restores the opaque session without asking for the password again',
    (tester) async {
      final server = AuthServer();
      await mountApp(tester, server);
      await connectTo(tester, 'https://gitpulse.example');
      await submitField(
        tester,
        label: 'Password',
        value: 'correct-horse',
        action: 'Unlock',
      );
      expectIdentity(tester, 'octocat');

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pumpAndSettle();
      final unlocksBefore = server.requests
          .where((request) => request.uri.path.endsWith('/auth/unlock'))
          .length;
      await mountApp(tester, server, resetStorage: false);

      expectIdentity(tester, 'octocat');
      expect(fieldLabeled('Password'), findsNothing);
      expect(
        server.requests
            .where((request) => request.uri.path.endsWith('/auth/unlock'))
            .length,
        unlocksBefore,
      );
      final probe = server.requests
          .where((request) => request.uri.path.endsWith('/api/_auth/session'))
          .last;
      expect(
        probe.headers['cookie'],
        contains('nuxt-session=${server.sessionValue}'),
      );
    },
  );

  testWidgets('an already expired session cookie is not sent again', (
    tester,
  ) async {
    final server = AuthServer()..expireSessionImmediately = true;
    final container = await mountApp(tester, server);
    await connectTo(tester, 'https://gitpulse.example');
    await submitField(
      tester,
      label: 'Password',
      value: 'correct-horse',
      action: 'Unlock',
    );
    server.featureStatus = 401;
    server.featureMessage = 'Access token not found in session';
    await pumped(
      tester,
      container
          .read(sessionControllerProvider.notifier)
          .request(method: 'GET', path: 'api/release-timeline'),
    );
    await tester.pumpAndSettle();
    final timeline = server.requests
        .where((request) => request.uri.path.endsWith('/api/release-timeline'))
        .single;
    expect(timeline.headers['cookie'] ?? '', isNot(contains('nuxt-session=')));
    expect(find.textContaining('Your session ended'), findsOneWidget);
    expect(find.byType(TimelineScreen), findsNothing);
  });

  testWidgets(
    'a secure cookie is dropped after its Max-Age even though the app restarted',
    (tester) async {
      final server = AuthServer()
        ..sessionAttributes =
            'Path=/; Secure; HttpOnly; Max-Age=1; Expires=Thu, 01 Jan 2099 00:00:00 GMT';
      await mountApp(tester, server);
      await connectTo(tester, 'https://gitpulse.example');
      await submitField(
        tester,
        label: 'Password',
        value: 'correct-horse',
        action: 'Unlock',
      );
      expectIdentity(tester, 'octocat');
      await tester.runAsync(
        () => Future<void>.delayed(const Duration(seconds: 2)),
      );
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pumpAndSettle();
      final container = await mountApp(tester, server, resetStorage: false);

      expect(find.textContaining('Your session ended'), findsOneWidget);
      expectIdentity(tester, 'octocat');
      expect(
        container
            .read(sessionControllerProvider.notifier)
            .transitionLog
            .whereType<IdentityCleared>(),
        isEmpty,
      );
      expect(
        container
            .read(sessionControllerProvider.notifier)
            .transitionLog
            .whereType<SessionRejected>(),
        isNotEmpty,
      );
    },
  );

  testWidgets(
    'sign-out clears the session from the start and cancels in-flight work',
    (tester) async {
      final server = AuthServer();
      final hold = Completer<void>();
      server.hold = hold.future;
      final container = await mountApp(tester, server);
      await connectTo(tester, 'https://gitpulse.example');
      await submitField(
        tester,
        label: 'Password',
        value: 'correct-horse',
        action: 'Unlock',
      );
      final notifier = container.read(sessionControllerProvider.notifier);
      IdentityCleared? cleared;
      SessionPhase? phaseAtClear;
      final subscription = notifier.transitions.listen((event) {
        if (event is IdentityCleared && cleared == null) {
          cleared = event;
          phaseAtClear = container.read(sessionControllerProvider).phase;
        }
      });
      final pending = notifier.request(
        method: 'GET',
        path: 'api/release-timeline',
      );
      for (var attempt = 0; attempt < 20 && !server.holding; attempt++) {
        await tester.pump(const Duration(milliseconds: 1));
      }
      expect(server.holding, isTrue);
      final signingOut = notifier.signOut();
      expect(phaseAtClear, SessionPhase.signedIn);
      expect(cleared?.previous?.login, 'octocat');
      expect(cleared?.reason, IdentityClearReason.signOut);
      final result = await pumped(tester, pending);
      expect(result.cancelled, isTrue);
      expect(server.holding, isFalse);
      expect(hold.isCompleted, isFalse);
      hold.complete();
      await pumped(tester, signingOut);
      await tester.pump();
      // Stream cancellation returns a root-zone future. Bridge it back into
      // the test's fake async loop before awaiting storage or more pumps.
      await tester.runAsync(subscription.cancel);

      expect(
        container.read(sessionControllerProvider).phase,
        SessionPhase.signedOut,
      );
      expect(find.text('Signed in as octocat'), findsNothing);
      expect(fieldLabeled('Password'), findsOneWidget);
      final logout = server.requests
          .where((request) => request.uri.path.endsWith('/auth/logout'))
          .single;
      expect(logout.headers['x-csrf-token'], server.csrf);
      expect(
        logout.headers['cookie'],
        contains('nuxt-session=${server.sessionValue}'),
      );
      final stored = await const FlutterSecureStorage().readAll();
      final blob = stored.values.join('\n');
      expect(blob.contains(server.sessionValue), isFalse);
      expect(blob.contains('correct-horse'), isFalse);
      expect(blob.contains('https://gitpulse.example/'), isTrue);
    },
  );

  testWidgets(
    'changing backend clears the previous identity before the screen returns',
    (tester) async {
      final server = AuthServer();
      final hold = Completer<void>();
      server.hold = hold.future;
      final container = await mountApp(tester, server);
      await connectTo(tester, 'https://personal.example');
      await submitField(
        tester,
        label: 'Password',
        value: 'correct-horse',
        action: 'Unlock',
      );
      final notifier = container.read(sessionControllerProvider.notifier);
      final pending = notifier.request(
        method: 'GET',
        path: 'api/release-timeline',
      );
      for (var attempt = 0; attempt < 20 && !server.holding; attempt++) {
        await tester.pump(const Duration(milliseconds: 1));
      }
      await tester.tap(find.text('Settings'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Change backend'));
      await tester.pumpAndSettle();
      expectIdentity(tester, 'octocat');
      expect(notifier.transitionLog.whereType<IdentityCleared>(), isEmpty);
      await tester.enterText(
        fieldLabeled('Backend address'),
        'https://other.example',
      );
      await tester.tap(find.text('Connect'));
      hold.complete();
      final result = await pumped(tester, pending);
      await tester.pumpAndSettle();

      expect(result.cancelled, isTrue);
      expect(
        notifier.transitionLog.whereType<IdentityCleared>().single.reason,
        IdentityClearReason.backendChange,
      );
      expect(find.byType(TextField), findsOneWidget);
      final stored = await const FlutterSecureStorage().readAll();
      expect(stored.values.join('\n').contains(server.sessionValue), isFalse);

      server.hold = null;
      await submitField(
        tester,
        label: 'Password',
        value: 'correct-horse',
        action: 'Unlock',
      );
      expectIdentity(tester, 'hubot');
      expect(notifier.transitionLog.whereType<IdentityRestored>(), isEmpty);
    },
  );

  testWidgets(
    'the same account can sign in again after rejection, and a different account clears first',
    (tester) async {
      final server = AuthServer()
        ..providers = {
          'personalMode': false,
          'patEnabled': true,
          'oauthEnabled': false,
          'mode': 'pat-only',
        };
      final container = await mountApp(tester, server);
      await connectTo(tester, 'https://pat.example');
      await submitField(
        tester,
        label: 'GitHub token',
        value: 'ghp_octocat',
        action: 'Continue',
      );
      final notifier = container.read(sessionControllerProvider.notifier);
      server.featureStatus = 401;
      server.featureMessage = 'Access token not found in session';
      final rejected = await pumped(
        tester,
        notifier.request(method: 'GET', path: 'api/repos/octocat/hello'),
      );
      await tester.pumpAndSettle();
      expect(rejected.problem, BackendProblem.authenticationRejected);
      expect(find.textContaining('Your session ended'), findsOneWidget);
      expect(find.byType(TimelineScreen), findsNothing);

      // Signing in again ends the rejection: the fixture stops rejecting every
      // call, so the Timeline destination loads against a working session.
      server
        ..featureStatus = 200
        ..featureMessage = 'OK';
      await submitField(
        tester,
        label: 'GitHub token',
        value: 'ghp_octocat',
        action: 'Continue',
      );
      expect(notifier.transitionLog.whereType<IdentityCleared>(), isEmpty);
      expect(notifier.transitionLog.whereType<IdentityRestored>(), isNotEmpty);
      expectIdentity(tester, 'octocat');

      String? loginAtSwitch;
      final subscription = notifier.transitions.listen((event) {
        if (event is IdentityCleared) {
          loginAtSwitch = container
              .read(sessionControllerProvider)
              .identity
              ?.login;
        }
      });
      await tester.tap(find.text('Settings').last);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Use a different account'));
      await tester.pumpAndSettle();
      await submitField(
        tester,
        label: 'GitHub token',
        value: 'ghp_hubot',
        action: 'Continue',
      );
      // Let the test binding coordinate the root-zone cancellation future.
      await tester.runAsync(subscription.cancel);
      expect(loginAtSwitch, 'octocat');
      expectIdentity(tester, 'hubot');
      expect(
        notifier.transitionLog.whereType<IdentityCleared>().single.reason,
        IdentityClearReason.accountSwitch,
      );
    },
  );

  testWidgets(
    'network loss, rate limits, and repository permission leave the session signed in',
    (tester) async {
      final server = AuthServer();
      final container = await mountApp(tester, server);
      await connectTo(tester, 'https://gitpulse.example');
      await submitField(
        tester,
        label: 'Password',
        value: 'correct-horse',
        action: 'Unlock',
      );
      final notifier = container.read(sessionControllerProvider.notifier);

      server.offline = true;
      final offline = await pumped(
        tester,
        notifier.request(method: 'GET', path: 'api/release-timeline'),
      );
      await tester.pumpAndSettle();
      expect(offline.problem, BackendProblem.network);
      expect(find.textContaining('You are offline'), findsOneWidget);
      expectIdentity(tester, 'octocat');
      expect(find.byType(TimelineScreen), findsOneWidget);

      server.offline = false;
      server.featureStatus = 429;
      server.featureMessage = 'API rate limit exceeded';
      final limited = await pumped(
        tester,
        notifier.request(method: 'GET', path: 'api/release-timeline'),
      );
      expect(limited.problem, BackendProblem.rateLimited);

      server.featureStatus = 403;
      server.featureMessage = 'Resource not accessible by integration';
      final denied = await pumped(
        tester,
        notifier.request(method: 'GET', path: 'api/repos/octocat/hello'),
      );
      expect(denied.problem, BackendProblem.repositoryPermission);
      expect(
        container.read(sessionControllerProvider).phase,
        SessionPhase.signedIn,
      );
      expect(notifier.transitionLog.whereType<SessionRejected>(), isEmpty);
      expect(notifier.transitionLog.whereType<IdentityCleared>(), isEmpty);

      final before = server.requests.length;
      final posted = await pumped(
        tester,
        notifier.request(
          method: 'POST',
          path: 'api/release-timeline/refresh',
          body: const {'ok': true},
        ),
      );
      expect(posted.statusCode, 403);
      final refresh = server.requests[before];
      expect(refresh.headers['x-csrf-token'], server.csrf);
      expect(
        refresh.headers['cookie'],
        contains('gitpulse_csrf=${server.csrf}'),
      );
    },
  );

  testWidgets('sign-in network loss and rate limits do not create a session', (
    tester,
  ) async {
    final server = AuthServer();
    await mountApp(tester, server);
    await connectTo(tester, 'https://gitpulse.example');
    server.offline = true;
    await submitField(
      tester,
      label: 'Password',
      value: 'correct-horse',
      action: 'Unlock',
    );
    expect(
      find.text('Could not reach the server. Your session was not changed.'),
      findsOneWidget,
    );
    expect(find.textContaining('Signed in as'), findsNothing);

    server.offline = false;
    server.signInStatus = 429;
    server.signInMessage = 'API rate limit exceeded';
    await submitField(
      tester,
      label: 'Password',
      value: 'correct-horse',
      action: 'Unlock',
    );
    expect(
      find.text(
        'The server is rate limiting requests. Your session was not changed.',
      ),
      findsOneWidget,
    );
    expect(find.textContaining('Signed in as'), findsNothing);
  });

  testWidgets(
    'wrong password is explained in Chinese without another provider',
    (tester) async {
      tester.platformDispatcher.localesTestValue = const [Locale('zh')];
      addTearDown(tester.platformDispatcher.clearLocalesTestValue);
      final server = AuthServer();
      await mountApp(tester, server);
      await connectTo(tester, 'https://gitpulse.example');
      await tester.enterText(fieldLabeled('密码'), 'nope');
      await tester.tap(find.text('解锁'));
      await tester.pumpAndSettle();
      expect(find.text('这个密码无法用于此服务器。'), findsOneWidget);
      expect(find.text('GitHub 令牌'), findsNothing);
      expect(find.textContaining('OAuth'), findsNothing);
    },
  );
}
