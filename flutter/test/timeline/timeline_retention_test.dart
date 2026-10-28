import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/device/device_preferences.dart';
import 'package:gitpulse/session/gitpulse_http.dart';
import 'package:gitpulse/session/session_controller.dart';
import 'package:gitpulse/timeline/timeline_cache.dart';
import 'package:gitpulse/timeline/timeline_session.dart';

import '../support/device_preferences_support.dart';
import 'timeline_cache_test_support.dart';
import 'timeline_test_support.dart';

/// A device whose preferences file has not been read yet.
class HoldingDevicePreferencesStore extends InMemoryDevicePreferencesStore {
  HoldingDevicePreferencesStore([super.preferences]);

  final _read = Completer<void>();

  /// Completes the read that was held back.
  void release() => _read.complete();

  @override
  Future<DevicePreferences> read() async {
    await _read.future;
    return super.read();
  }
}

void main() {
  test(
    'nothing is pruned or saved before this device\'s window is known',
    () async {
      final disk = await DiskTimeline.create();
      final device = HoldingDevicePreferencesStore(
        const DevicePreferences(retentionDays: 90),
      );
      final h = disk.open(device: device);
      configure(
        h,
        releases: [
          releaseJson(
            3,
            'v3',
            disk.now.subtract(const Duration(days: 40)).toIso8601String(),
          ),
        ],
      );
      final scope = TimelineCache.scopeOf(h.session.state.identity!)!;
      // Let the startup cycle reach the device read it is waiting on.
      await Future<void>.delayed(const Duration(milliseconds: 20));

      // Nothing may have been written: a guess here would delete forty days of
      // readable history the ninety-day window keeps.
      expect(await disk.cache!.lastSavedRetentionDays(scope: scope), isNull);

      device.release();
      await settle(h.container);
      expect(await disk.cache!.lastSavedRetentionDays(scope: scope), 90);
      expect(keys(h.container), ['R_a:3']);
    },
  );

  test(
    'a device window chosen offline prunes saved history without a request',
    () async {
      final disk = await DiskTimeline.create();
      final h = disk.open();
      configure(
        h,
        releases: [
          releaseJson(
            3,
            'recent',
            disk.now.subtract(const Duration(hours: 2)).toIso8601String(),
          ),
          releaseJson(
            2,
            'fortnight',
            disk.now.subtract(const Duration(days: 14)).toIso8601String(),
          ),
        ],
      );
      await settle(h.container);
      expect(keys(h.container), ['R_a:3', 'R_a:2']);
      h.session.handlers['GET api/settings'] = () =>
          const BackendResult(problem: BackendProblem.network);
      h.session.handlers['POST api/release-timeline/refresh'] = () =>
          const BackendResult(problem: BackendProblem.network);
      final requests = h.session.requests.length;

      await h.container
          .read(releaseTimelineSessionProvider.notifier)
          .chooseRetentionWindow(1)
          .then((result) {
            expect(result.remembered, isTrue);
            expect(result.application, RetentionApplication.applied);
          });

      // Offline, the shortened window still applies: the record it excludes is
      // gone from what this installation keeps, and nothing went on the wire.
      expect(h.session.requests.length, requests);
      expect(h.device.value.retentionDays, 1);
      final saved = await disk.cache!.restore(
        scope: TimelineCache.scopeOf(h.session.state.identity!)!,
        now: disk.now,
        environment: h.container.read(timelineEnvironmentProvider),
      );
      expect(
        saved!.groups.expand((group) => group.items).map((item) => item.key),
        ['R_a:3'],
      );
    },
  );

  test('a refresh cannot save before this device\'s window is known', () async {
    final disk = await DiskTimeline.create();
    final device = HoldingDevicePreferencesStore(
      const DevicePreferences(retentionDays: 30),
    );
    final h = disk.open(device: device);
    configure(
      h,
      releases: [
        releaseJson(
          3,
          'v3',
          disk.now.subtract(const Duration(hours: 1)).toIso8601String(),
        ),
      ],
    );
    final scope = TimelineCache.scopeOf(h.session.state.identity!)!;
    await Future<void>.delayed(const Duration(milliseconds: 20));

    // The window is still unresolved, so a round started by the reader must not
    // reach the cache: an unresolved policy would write under a guess.
    unawaited(
      h.container.read(releaseTimelineSessionProvider.notifier).refresh(),
    );
    await Future<void>.delayed(const Duration(milliseconds: 20));
    expect(await disk.cache!.lastSavedRetentionDays(scope: scope), isNull);

    device.release();
    await settle(h.container);
    expect(await disk.cache!.lastSavedRetentionDays(scope: scope), 30);
  });

  test('a window changed after the session ended keeps saved history', () async {
    final disk = await DiskTimeline.create();
    final h = disk.open();
    configure(
      h,
      releases: [
        releaseJson(
          3,
          'v3',
          disk.now.subtract(const Duration(hours: 2)).toIso8601String(),
        ),
        releaseJson(
          2,
          'fortnight',
          disk.now.subtract(const Duration(days: 14)).toIso8601String(),
        ),
      ],
    );
    await settle(h.container);
    final scope = TimelineCache.scopeOf(h.session.state.identity!)!;
    expect(await disk.cache!.lastSavedRetentionDays(scope: scope), 30);

    // The session is rejected: this session no longer owns the follow set, so a
    // new window must not be applied to the history it does not describe.
    h.session.emit(
      SessionState(
        phase: SessionPhase.rejected,
        identity: h.session.state.identity,
      ),
    );
    await h.container
        .read(releaseTimelineSessionProvider.notifier)
        .chooseRetentionWindow(1);
    await Future<void>.delayed(const Duration(milliseconds: 50));

    expect(await disk.cache!.lastSavedRetentionDays(scope: scope), 30);
    final saved = await disk.cache!.restore(
      scope: scope,
      now: disk.now,
      environment: h.container.read(timelineEnvironmentProvider),
    );
    expect(
      saved!.groups.expand((group) => group.items).map((item) => item.key),
      ['R_a:3', 'R_a:2'],
    );
  });
}
