import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/app.dart';
import 'package:gitpulse/connection/connection_controller.dart';

class CapabilityServer implements HttpClientAdapter {
  bool offline = false;
  int statusCode = 200;
  Object? payload = {
    'protocolVersion': 1,
    'capabilities': [
      'provider-discovery',
      'release-timeline',
      'timeline-retention',
    ],
    'providers': {
      'personalMode': true,
      'patEnabled': false,
      'oauthEnabled': false,
      'mode': 'personal',
    },
  };
  final requests = <Uri>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options.uri);
    if (offline) {
      throw DioException.connectionTimeout(
        timeout: const Duration(seconds: 10),
        requestOptions: options,
      );
    }
    return ResponseBody.fromString(
      jsonEncode(payload),
      statusCode,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

Future<void> mountApp(WidgetTester tester, CapabilityServer server) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        connectionDioProvider.overrideWithValue(
          Dio()..httpClientAdapter = server,
        ),
      ],
      child: const GitPulseApp(),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> connectTo(WidgetTester tester, String address) async {
  final field = find.byWidgetPredicate(
    (widget) =>
        widget is TextField &&
        widget.decoration?.labelText == 'Backend address',
  );
  if (field.evaluate().isEmpty) {
    await tester.tap(find.text('Change backend'));
    await tester.pumpAndSettle();
  }
  await tester.enterText(field, address);
  await tester.tap(find.text('Connect'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets(
    'first launch connects to the hosted backend without confirmation',
    (tester) async {
      FlutterSecureStorage.setMockInitialValues({});
      final server = CapabilityServer();
      await mountApp(tester, server);
      expect(server.requests.map((request) => request.toString()), [
        'https://gitpulse.euphony.ink/api/native/capabilities',
      ]);
      expect(find.text('Password'), findsOneWidget);
      expect(find.text('Connect to GitPulse'), findsNothing);
      expect(find.text('Change backend'), findsOneWidget);
    },
  );

  testWidgets(
    'phone shell exposes Timeline, Follows and Settings without overflow',
    (tester) async {
      FlutterSecureStorage.setMockInitialValues({});
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await mountApp(tester, CapabilityServer());
      await connectTo(tester, 'https://phone.example');
      expect(find.byType(NavigationBar), findsOneWidget);
      expect(find.byType(NavigationRail), findsNothing);
      await tester.tap(find.text('Follows'));
      await tester.pumpAndSettle();
      expect(find.text('Password'), findsOneWidget);
      await tester.tap(find.text('Settings'));
      await tester.pumpAndSettle();
      expect(find.text('Change backend'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'a compatible backend without a usable provider explains the configuration error',
    (tester) async {
      FlutterSecureStorage.setMockInitialValues({});
      final server = CapabilityServer()
        ..payload = {
          'protocolVersion': 1,
          'capabilities': [
            'provider-discovery',
            'release-timeline',
            'timeline-retention',
          ],
          'providers': {
            'personalMode': false,
            'patEnabled': false,
            'oauthEnabled': false,
            'mode': 'pat-only',
          },
        };
      await mountApp(tester, server);
      await connectTo(tester, 'https://unconfigured.example');
      expect(
        find.textContaining('no usable sign-in providers'),
        findsOneWidget,
      );
      expect(find.byType(TextField), findsOneWidget);
    },
  );

  testWidgets(
    'unreachable backend can be retried and failures preserve the last successful address',
    (tester) async {
      FlutterSecureStorage.setMockInitialValues({});
      final server = CapabilityServer()..offline = true;
      await mountApp(tester, server);
      await connectTo(tester, 'https://first.example');
      expect(find.textContaining('Could not reach'), findsOneWidget);
      expect(find.byType(TextField), findsOneWidget);
      server.offline = false;
      await tester.tap(find.text('Connect'));
      await tester.pumpAndSettle();
      expect(find.text('Password'), findsOneWidget);
      await tester.tap(find.text('Settings'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Change backend'));
      await tester.pumpAndSettle();
      server.offline = true;
      await connectTo(tester, 'https://failed.example');
      expect(find.textContaining('Could not reach'), findsOneWidget);
      expect(
        tester.widget<TextField>(find.byType(TextField)).controller!.text,
        'https://failed.example/',
      );
      await tester.tap(find.text('Connect'));
      await tester.pumpAndSettle();
      expect(server.requests.last.host, 'failed.example');
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pumpAndSettle();
      await mountApp(tester, server);
      final container = ProviderScope.containerOf(
        tester.element(find.byType(GitPulseApp)),
      );
      expect(
        container
            .read(connectionControllerProvider)
            .value
            ?.backend
            ?.address
            .toString(),
        'https://first.example/',
      );
      expect(find.text('Password'), findsOneWidget);
    },
  );

  for (final (name, payload, statusCode) in <(String, Object?, int)>[
    ('older protocol', {'protocolVersion': 0}, 200),
    (
      'missing discovery capability',
      {
        'protocolVersion': 1,
        'capabilities': <String>[],
        'providers': {
          'personalMode': true,
          'patEnabled': false,
          'oauthEnabled': false,
          'mode': 'personal',
        },
      },
      200,
    ),
    (
      'missing timeline capability',
      {
        'protocolVersion': 1,
        'capabilities': ['provider-discovery'],
        'providers': {
          'personalMode': true,
          'patEnabled': false,
          'oauthEnabled': false,
          'mode': 'personal',
        },
      },
      200,
    ),
    ('non-GitPulse response', '<html>Another application</html>', 200),
    ('missing capability endpoint', {}, 404),
    (
      'OAuth-only server without app handoff',
      {
        'protocolVersion': 1,
        'capabilities': [
          'provider-discovery',
          'release-timeline',
          'timeline-retention',
        ],
        'providers': {
          'personalMode': false,
          'patEnabled': false,
          'oauthEnabled': true,
          'mode': 'oauth-only',
        },
      },
      200,
    ),
    (
      'conflicting personal providers',
      {
        'protocolVersion': 1,
        'capabilities': [
          'provider-discovery',
          'release-timeline',
          'timeline-retention',
        ],
        'providers': {
          'personalMode': true,
          'patEnabled': true,
          'oauthEnabled': true,
          'mode': 'personal',
        },
      },
      200,
    ),
  ]) {
    testWidgets(
      '$name requires a server update and does not save the address',
      (tester) async {
        FlutterSecureStorage.setMockInitialValues({});
        final server = CapabilityServer()
          ..payload = payload
          ..statusCode = statusCode;
        await mountApp(tester, server);
        await connectTo(tester, 'https://old.example');
        expect(
          find.textContaining('Update the GitPulse server'),
          findsOneWidget,
        );
        await tester.pumpWidget(const SizedBox.shrink());
        await tester.pumpAndSettle();
        await mountApp(tester, server);
        expect(
          tester.widget<TextField>(find.byType(TextField)).controller!.text,
          'https://gitpulse.euphony.ink/',
        );
      },
    );
  }

  for (final (pat, oauth, mode) in [
    (true, false, 'pat-only'),
    (false, true, 'oauth-only'),
    (true, true, 'hybrid'),
  ]) {
    testWidgets('discovers $mode on a self-hosted backend with a base path', (
      tester,
    ) async {
      FlutterSecureStorage.setMockInitialValues({});
      final server = CapabilityServer()
        ..payload = {
          'protocolVersion': 1,
          'capabilities': [
            'provider-discovery',
            'release-timeline',
            'timeline-retention',
            if (oauth) 'native-login-handoff',
            'future-additive-capability',
          ],
          'providers': {
            'personalMode': false,
            'patEnabled': pat,
            'oauthEnabled': oauth,
            'mode': mode,
          },
        };
      await mountApp(tester, server);
      await connectTo(tester, 'http://127.0.0.1:3000/gitpulse');
      expect(
        server.requests.last.toString(),
        'http://127.0.0.1:3000/gitpulse/api/native/capabilities',
      );
      // The gate offers exactly the credentials this backend reports: one field
      // per enabled method, and nothing for a method it does not have.
      expect(find.text('Password'), findsNothing);
      expect(find.text('GitHub token'), pat ? findsOneWidget : findsNothing);
      expect(
        find.text('Continue with GitHub'),
        oauth ? findsOneWidget : findsNothing,
      );
    });
  }

  testWidgets(
    'invalid address is rejected before a request, with Chinese system localization',
    (tester) async {
      FlutterSecureStorage.setMockInitialValues({});
      tester.platformDispatcher.localesTestValue = [const Locale('zh', 'CN')];
      addTearDown(tester.platformDispatcher.clearLocalesTestValue);
      final server = CapabilityServer();
      await mountApp(tester, server);
      await tester.tap(find.text('更换后端'));
      await tester.pumpAndSettle();
      for (final address in [
        '',
        'gitpulse.example',
        'https://user:password@example.org',
        'https://example.org?token=secret',
        'https://example.org/#fragment',
      ]) {
        await tester.enterText(find.byType(TextField).last, address);
        await tester.tap(find.text('连接'));
        await tester.pumpAndSettle();
        expect(find.textContaining('请输入 HTTP 或 HTTPS'), findsOneWidget);
      }
      expect(server.requests, hasLength(1));
    },
  );

  testWidgets(
    'a future protocol asks for an app update even when its payload shape has changed',
    (tester) async {
      FlutterSecureStorage.setMockInitialValues({});
      final server = CapabilityServer()..payload = {'protocolVersion': 2};
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            connectionDioProvider.overrideWithValue(
              Dio()..httpClientAdapter = server,
            ),
          ],
          child: const GitPulseApp(),
        ),
      );
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), 'https://future.example');
      await tester.tap(find.text('Connect'));
      await tester.pumpAndSettle();
      expect(find.textContaining('Update the GitPulse app'), findsOneWidget);
      expect(find.byType(TextField), findsOneWidget);
    },
  );

  testWidgets(
    'rejects a fractional protocol version without remembering the address',
    (tester) async {
      FlutterSecureStorage.setMockInitialValues({});
      final server = CapabilityServer();
      server.payload = {
        ...(server.payload! as Map<String, Object?>),
        'protocolVersion': 1.5,
      };
      final dio = Dio()..httpClientAdapter = server;
      Future<void> mount() async {
        await tester.pumpWidget(
          ProviderScope(
            overrides: [connectionDioProvider.overrideWithValue(dio)],
            child: const GitPulseApp(),
          ),
        );
        await tester.pumpAndSettle();
      }

      await mount();
      await tester.enterText(
        find.byType(TextField),
        'https://incompatible.example',
      );
      await tester.tap(find.text('Connect'));
      await tester.pumpAndSettle();
      expect(find.textContaining('Update the GitPulse server'), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pumpAndSettle();
      await mount();
      expect(
        tester.widget<TextField>(find.byType(TextField)).controller!.text,
        'https://gitpulse.euphony.ink/',
      );
    },
  );

  testWidgets(
    'a saved custom backend reconnects automatically with its base path',
    (tester) async {
      FlutterSecureStorage.setMockInitialValues({});
      final server = CapabilityServer();
      final dio = Dio()..httpClientAdapter = server;

      Future<void> mount() async {
        await tester.pumpWidget(
          ProviderScope(
            overrides: [connectionDioProvider.overrideWithValue(dio)],
            child: const GitPulseApp(),
          ),
        );
        await tester.pumpAndSettle();
      }

      await mount();
      await connectTo(tester, ' https://self-hosted.example/gitpulse/ ');
      expect(
        server.requests.last.toString(),
        'https://self-hosted.example/gitpulse/api/native/capabilities',
      );
      expect(find.text('Password'), findsOneWidget);
      expect(find.text('Continue with GitHub'), findsNothing);
      expect(find.text('GitHub token'), findsNothing);
      expect(find.text('Timeline'), findsWidgets);

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pumpAndSettle();
      await mount();
      expect(
        server.requests.last.toString(),
        'https://self-hosted.example/gitpulse/api/native/capabilities',
      );
      expect(find.text('Connect to GitPulse'), findsNothing);
      expect(find.text('Password'), findsOneWidget);
    },
  );
}
