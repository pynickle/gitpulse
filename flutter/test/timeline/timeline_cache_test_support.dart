import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/device/device_preferences.dart';
import 'package:gitpulse/session/gitpulse_http.dart';
import 'package:gitpulse/session/session_controller.dart';
import 'package:gitpulse/timeline/timeline_cache.dart';
import 'package:path/path.dart' as p;

import '../support/device_preferences_support.dart';
import 'timeline_test_support.dart';

typedef Harness = TimelineHarness;

void configure(
  Harness h, {
  required List<Map<String, Object?>> releases,
  String owner = 'octo',
}) {
  h.session.handlers['GET api/settings'] = () => BackendResult(
    statusCode: 200,
    data: settingsJson([followJson('R_a', owner, 'alpha')]),
  );
  h.session.handlers['POST api/release-timeline/refresh'] = () => BackendResult(
    statusCode: 200,
    data: roundJson(pages: {'R_a': pageJson(owner, 'alpha', releases)}),
  );
}

class DiskTimeline {
  DiskTimeline(this.directory);
  final Directory directory;
  final now = DateTime.utc(2026, 10, 19, 12);
  TimelineCache? get cache => container?.read(timelineCacheProvider);
  ProviderContainer? container;
  InMemoryDevicePreferencesStore? _device;

  /// The device's own choices, as the running container sees them.
  InMemoryDevicePreferencesStore get device => _device!;

  static Future<DiskTimeline> create() async {
    final disk = DiskTimeline(
      await Directory.systemTemp.createTemp('gitpulse-cache-'),
    );
    addTearDown(() async {
      await disk.close();
      await disk.directory.delete(recursive: true);
    });
    return disk;
  }

  Harness open({
    String login = 'octocat',
    AuthenticatedIdentity? identity,
    DateTime Function()? now,
    String Function(DateTime)? localDateKey,
    Future<File> Function()? cacheFileLookup,
    int? retentionDays = 30,
    bool freshDeviceChoice = false,
    InMemoryDevicePreferencesStore? device,
  }) {
    // The device store outlives an app launch, exactly as its file does, so a
    // window chosen in one launch is still in force in the next. A launch that
    // predates the field, or a second installation, asks for a fresh one.
    _device ??= InMemoryDevicePreferencesStore(
      DevicePreferences(retentionDays: retentionDays),
    );
    if (device != null) _device = device;
    if (freshDeviceChoice) {
      _device = InMemoryDevicePreferencesStore(
        DevicePreferences(retentionDays: retentionDays),
      );
    }
    final h = createHarness(
      cacheFile: File(p.join(directory.path, 'timeline.sqlite')),
      cacheFileLookup: cacheFileLookup,
      now: now ?? () => this.now,
      identity: identity,
      login: login,
      localDateKey: localDateKey,
      device: _device,
    );
    container = h.container;
    return h;
  }

  Future<void> close() async {
    final history = cache;
    container?.dispose();
    container = null;
    await history?.close();
  }
}

Future<void> settle(ProviderContainer container) async {
  for (var i = 0; i < 100; i++) {
    await Future<void>.delayed(const Duration(milliseconds: 5));
    if (!readState(container).loading && readState(container).active) return;
  }
  fail('timeline did not settle');
}

/// Waits until the window this installation keeps is [days], as the saved
/// history's own snapshot records it.
///
/// A retention change needs no request and sets no view-state flag, so the
/// ledger is where the applied window becomes observable.
Future<void> waitForSavedRetention(
  ProviderContainer container,
  int days,
) async {
  final identity = container.read(sessionControllerProvider).identity;
  final scope = identity == null ? null : TimelineCache.scopeOf(identity);
  if (scope == null) fail('no saved scope to read a window from');
  for (var i = 0; i < 200; i++) {
    final saved = await container
        .read(timelineCacheProvider)
        .lastSavedRetentionDays(scope: scope);
    if (saved == days) return;
    await Future<void>.delayed(const Duration(milliseconds: 5));
  }
  fail('retention did not reach $days days');
}

List<String> keys(ProviderContainer container) =>
    readState(container).groups
        .expand((group) => group.items)
        .map((release) => release.key)
        .toList();
