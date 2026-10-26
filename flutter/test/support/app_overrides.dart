import 'dart:io';

import 'package:flutter_riverpod/misc.dart';
import 'package:gitpulse/device/device_preferences_store.dart';
import 'package:gitpulse/timeline/timeline_cache.dart';

import 'device_preferences_support.dart';

/// Overrides for providers whose first read performs device or cache I/O.
///
/// The device store is always replaced. Pass [timelineCache] when the mount
/// already holds one. A new provider that awaits device, preference, or cache
/// I/O is added here. The fake-clock rule is in `flutter/AGENTS.md`.
List<Override> gitPulseHarnessOverrides({
  DevicePreferencesStore? deviceStore,
  Future<File> Function()? preferencesFile,
  TimelineCache? timelineCache,
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
    if (timelineCache != null)
      timelineCacheProvider.overrideWithValue(timelineCache),
    if (timelineNow != null)
      timelineClockProvider.overrideWithValue(timelineNow),
  ];
}
