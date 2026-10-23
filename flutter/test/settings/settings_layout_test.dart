import 'dart:io';

import 'package:drift/native.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/app.dart';
import 'package:gitpulse/connection/backend_service.dart';
import 'package:gitpulse/connection/connection_controller.dart';
import 'package:gitpulse/connection/native_capabilities.dart';
import 'package:gitpulse/presentation/presentation_preferences_store.dart';
import 'package:gitpulse/session/gitpulse_http.dart';
import 'package:gitpulse/session/session_controller.dart';
import 'package:gitpulse/timeline/timeline_cache.dart';
import 'package:path/path.dart' as p;

import '../support/settling.dart';
import '../timeline/timeline_test_support.dart';

const _capabilities = NativeCapabilities(
  protocolVersion: 1,
  capabilities: ['timeline-retention'],
  providers: SignInProviders(
    personalMode: false,
    patEnabled: true,
    oauthEnabled: false,
    mode: 'pat',
  ),
);

class _TestConnectionController extends ConnectionController {
  @override
  Future<BackendConnectionState> build() async => BackendConnectionState(
    rememberedAddress: 'https://gitpulse.example/',
    backend: ConnectedBackend(
      Uri.parse('https://gitpulse.example/'),
      _capabilities,
    ),
  );
}

/// A signed-in Settings page on a local timeline cache, as a launch would have
/// it: the settings rows are the whole page, so they must hold their shape at
/// every window width and text scale a reader can bring.
Future<ProviderContainer> _openSettings(WidgetTester tester) async {
  final cache = TimelineCache(NativeDatabase.memory());
  final preferences = Directory.systemTemp.createTempSync(
    'gitpulse-settings-layout-',
  );
  final container = ProviderContainer(
    overrides: [
      presentationPreferencesFileProvider.overrideWithValue(
        () async => File(p.join(preferences.path, 'presentation.json')),
      ),
      timelineCacheProvider.overrideWithValue(cache),
      connectionControllerProvider.overrideWith(_TestConnectionController.new),
      sessionControllerProvider.overrideWith(() {
        return FakeSessionController(
            SessionState(
              phase: SessionPhase.signedIn,
              identity: signedInIdentity(),
            ),
          )
          ..handlers.addAll({
            'GET api/settings': () =>
                BackendResult(statusCode: 200, data: settingsJson(const [])),
            'POST api/release-timeline/refresh': () => BackendResult(
              statusCode: 200,
              data: roundJson(
                refresh: const {
                  'previousBaseline': '2026-10-01T00:00:00.000Z',
                  'startedAt': '2026-10-05T00:00:00.000Z',
                },
              ),
            ),
          });
      }),
    ],
  );
  addTearDown(() {
    container.dispose();
    cache.close();
    preferences.deleteSync(recursive: true);
  });
  await tester.pumpWidget(
    UncontrolledProviderScope(container: container, child: const GitPulseApp()),
  );
  await settleUi(tester);
  await tester.tap(find.text('Settings').last);
  await settleUi(tester);
  return container;
}

void _useWindow(WidgetTester tester, Size size, {double textScale = 1}) {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  tester.platformDispatcher.textScaleFactorTestValue = textScale;
  tester.platformDispatcher.localesTestValue = [const Locale('en')];
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  addTearDown(tester.platformDispatcher.clearAllTestValues);
}

void main() {
  testWidgets('a phone stacks each label over its control and keeps both fits', (
    tester,
  ) async {
    _useWindow(tester, const Size(390, 844));
    await _openSettings(tester);

    final languageLabel = tester.getRect(find.text('Language'));
    final languageChoice = tester.getRect(
      find.widgetWithText(ChoiceChip, 'System language'),
    );
    final appearanceLabel = tester.getRect(find.text('Appearance'));
    final appearanceChoice = tester.getRect(
      find.widgetWithText(ChoiceChip, 'System appearance'),
    );

    // The label sits above its own control, and both begin at the page gutter.
    expect(languageChoice.top, greaterThan(languageLabel.bottom));
    expect(appearanceChoice.top, greaterThan(appearanceLabel.bottom));
    expect(languageLabel.left, languageChoice.left);
    expect(appearanceLabel.left, appearanceChoice.left);
    // The account is the page's first band, so the settings open under it.
    expect(
      tester.getRect(find.text('octocat')).bottom,
      lessThan(languageLabel.top),
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('a wide window lines every control up in one column', (
    tester,
  ) async {
    _useWindow(tester, const Size(1280, 900));
    await _openSettings(tester);

    final languageChoice = tester.getRect(
      find.widgetWithText(ChoiceChip, 'System language'),
    );
    final appearanceChoice = tester.getRect(
      find.widgetWithText(ChoiceChip, 'System appearance'),
    );
    expect(appearanceChoice.left, languageChoice.left);
    // The labels sit on their own controls' lines, on the column beside them.
    final languageLabel = tester.getRect(find.text('Language'));
    final appearanceLabel = tester.getRect(find.text('Appearance'));
    expect(languageLabel.right, lessThan(languageChoice.left));
    expect(appearanceLabel.right, lessThan(appearanceChoice.left));
    expect(languageLabel.top, greaterThanOrEqualTo(languageChoice.top));
    expect(languageLabel.bottom, lessThanOrEqualTo(languageChoice.bottom));

    // The account keeps the trailing column the Follows page uses, so the
    // settings themselves are not pushed aside by it.
    final account = tester.getRect(find.text('octocat'));
    expect(account.left, greaterThan(languageChoice.right));
    expect(account.left, greaterThan(1280 * 0.6));
    expect(tester.takeException(), isNull);
  });

  testWidgets('large text neither clips nor overflows the row controls', (
    tester,
  ) async {
    _useWindow(tester, const Size(390, 844), textScale: 2);
    await _openSettings(tester);

    expect(find.text('Language'), findsOneWidget);
    expect(find.text('System appearance'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
