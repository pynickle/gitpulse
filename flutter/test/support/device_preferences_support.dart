import 'dart:io';

import 'package:gitpulse/device/device_preferences.dart';
import 'package:gitpulse/device/device_preferences_store.dart';

/// A device store held in memory, for tests whose subject is what the Timeline
/// does with the device's choices rather than how the file is read or written.
///
/// The file itself is covered where it is the subject: the store writes one
/// document and replaces it atomically.
class InMemoryDevicePreferencesStore extends DevicePreferencesStore {
  InMemoryDevicePreferencesStore([DevicePreferences? preferences])
    : value = preferences ?? const DevicePreferences(),
      super(() => throw UnimplementedError('in-memory device store'));

  DevicePreferences value;

  /// Every document this store was asked to keep, in order.
  final writes = <DevicePreferences>[];

  /// Refuses every write, as a device whose storage cannot be reached does.
  bool failWrites = false;

  @override
  Future<DevicePreferences> read() async => value;

  @override
  Future<void> write(DevicePreferences preferences) async {
    if (failWrites) {
      throw const FileSystemException('device storage unavailable');
    }
    value = preferences;
    writes.add(preferences);
  }
}
