import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/app.dart';
import 'package:dio/dio.dart';
import 'package:gitpulse/connection/connection_controller.dart';

import 'connection_flow_test.dart' show CapabilityServer;
import 'support/app_overrides.dart';

void main() {
  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
  });

  ThemeData screenTheme(WidgetTester tester) =>
      Theme.of(tester.element(find.byType(Scaffold).first));

  Future<void> mountApp(WidgetTester tester) async {
    addTearDown(tester.binding.platformDispatcher.clearAllTestValues);
    tester.binding.platformDispatcher.localesTestValue = [
      const Locale('zh', 'CN'),
    ];
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          ...gitPulseHarnessOverrides(),
          connectionDioProvider.overrideWithValue(
            Dio()..httpClientAdapter = CapabilityServer(),
          ),
        ],
        child: const GitPulseApp(),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('Windows typography follows locale and system brightness', (
    tester,
  ) async {
    await mountApp(tester);

    for (final brightness in Brightness.values) {
      tester.binding.platformDispatcher.platformBrightnessTestValue =
          brightness;
      await tester.pumpAndSettle();
      final theme = screenTheme(tester);
      expect(theme.brightness, brightness);
      expect(theme.textTheme.titleMedium!.fontFamily, 'Microsoft YaHei UI');
      expect(theme.textTheme.bodyMedium!.fontFamily, 'Microsoft YaHei UI');
      expect(theme.textTheme.labelLarge!.fontFamily, 'Microsoft YaHei UI');
      expect(
        theme.primaryTextTheme.titleMedium!.fontFamily,
        'Microsoft YaHei UI',
      );
    }

    tester.binding.platformDispatcher.localesTestValue = [const Locale('en')];
    await tester.pumpAndSettle();
    final englishTheme = screenTheme(tester);
    expect(englishTheme.textTheme.bodyMedium!.fontFamily, 'Segoe UI');
    expect(
      englishTheme.textTheme.bodyMedium!.fontFamilyFallback,
      contains('Microsoft YaHei UI'),
    );
  }, variant: TargetPlatformVariant.only(TargetPlatform.windows));

  testWidgets(
    'Linux typography uses system Noto fonts for Chinese and English',
    (tester) async {
      await mountApp(tester);
      expect(
        screenTheme(tester).textTheme.bodyMedium!.fontFamily,
        'Noto Sans CJK SC',
      );

      tester.binding.platformDispatcher.localesTestValue = [const Locale('en')];
      await tester.pumpAndSettle();
      final theme = screenTheme(tester);
      expect(theme.textTheme.bodyMedium!.fontFamily, 'Noto Sans');
      expect(
        theme.textTheme.bodyMedium!.fontFamilyFallback,
        contains('Noto Sans CJK SC'),
      );
    },
    variant: TargetPlatformVariant.only(TargetPlatform.linux),
  );

  for (final platform in [
    TargetPlatform.android,
    TargetPlatform.iOS,
    TargetPlatform.macOS,
  ]) {
    testWidgets('$platform retains Flutter platform typography', (
      tester,
    ) async {
      await mountApp(tester);
      final theme = screenTheme(tester);
      final defaults = ThemeData(platform: platform);
      expect(
        theme.textTheme.bodyMedium!.fontFamily,
        defaults.textTheme.bodyMedium!.fontFamily,
      );
      expect(
        theme.textTheme.bodyMedium!.fontFamilyFallback,
        defaults.textTheme.bodyMedium!.fontFamilyFallback,
      );
    }, variant: TargetPlatformVariant.only(platform));
  }
}
