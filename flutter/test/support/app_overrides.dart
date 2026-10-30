import 'dart:async';
import 'dart:io';

import 'package:drift/native.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:gitpulse/device/device_preferences_store.dart';
import 'package:gitpulse/timeline/timeline_cache.dart';

import 'device_preferences_support.dart';

/// Overrides for providers whose first read performs device or cache I/O.
///
/// The device store and an in-memory timeline database are supplied by default.
/// Pass [timelineCache] when the mount already holds one, or disable
/// [overrideTimelineCache] when it installs its own database provider.
/// The fake-clock rule is in `flutter/AGENTS.md`.
List<Override> gitPulseHarnessOverrides({
  DevicePreferencesStore? deviceStore,
  Future<File> Function()? preferencesFile,
  TimelineCache? timelineCache,
  bool overrideTimelineCache = true,
  DateTime Function()? timelineNow,
}) {
  return [
    if (deviceStore != null)
      devicePreferencesStoreProvider.overrideWithValue(deviceStore)
    else if (preferencesFile != null)
      devicePreferencesFileProvider.overrideWithValue(preferencesFile)
    else
      devicePreferencesStoreProvider.overrideWithValue(
        InMemoryDevicePreferencesStore(),
      ),
    if (overrideTimelineCache)
      if (timelineCache != null)
        timelineCacheProvider.overrideWithValue(timelineCache)
      else
        timelineCacheProvider.overrideWith((ref) {
          final cache = TimelineCache(NativeDatabase.memory());
          ref.onDispose(() => unawaited(cache.close()));
          return cache;
        }),
    if (timelineNow != null)
      timelineClockProvider.overrideWithValue(timelineNow),
  ];
}
