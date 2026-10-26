import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/app.dart';
import 'package:gitpulse/connection/connection_controller.dart';
import 'package:gitpulse/device/device_preferences_controller.dart';
import 'package:gitpulse/presentation/gitpulse_state_views.dart';
import 'package:path_provider_platform_interface/path_provider_platform_interface.dart';

import 'connection_flow_test.dart' show CapabilityServer;
import 'support/settling.dart';

/// The support directory the real device store and timeline cache ask for.
///
/// Widget tests register `path_provider_windows`, which ignores the legacy
/// method channel and creates the real roaming directory. Replacing the
/// platform instance is what keeps this test on a directory it can see.
class _TempSupportDirectory extends PathProviderPlatform {
  _TempSupportDirectory(this.path);

  final String path;
  int reads = 0;

  @override
  Future<String?> getApplicationSupportPath() async {
    reads++;
    return path;
  }
}

void main() {
  testWidgets(
    'the real shell settles without a device store and writes nothing',
    (tester) async {
      final previous = PathProviderPlatform.instance;
      final directory = Directory.systemTemp.createTempSync(
        'gitpulse-shell-guard-',
      );
      final support = _TempSupportDirectory(directory.path);
      PathProviderPlatform.instance = support;
      FlutterSecureStorage.setMockInitialValues({});
      addTearDown(() {
        PathProviderPlatform.instance = previous;
        if (directory.existsSync()) directory.deleteSync(recursive: true);
      });

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            connectionDioProvider.overrideWithValue(
              Dio()..httpClientAdapter = CapabilityServer(),
            ),
          ],
          child: const GitPulseApp(),
        ),
      );
      // The read is real file I/O. pumpAndSettle is the settle check: a
      // loading indicator that stays fails the test inside its timeout.
      await settleUi(tester);
      await tester.pumpAndSettle();

      expect(support.reads, greaterThan(0));
      expect(find.byType(GitPulseLoadingView), findsNothing);
      expect(find.text('Password'), findsOneWidget);
      final container = ProviderScope.containerOf(
        tester.element(find.byType(GitPulseApp)),
      );
      final preferences = container.read(devicePreferencesProvider);
      expect(
        preferences.isLoading,
        isFalse,
        reason: 'the device read is still pending',
      );
      expect(preferences.hasError, isFalse);
      expect(directory.listSync(), isEmpty);
    },
    timeout: const Timeout(Duration(seconds: 30)),
  );
}
