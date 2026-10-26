import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'device_preferences.dart';
import 'device_preferences_store.dart';

/// The current device choices and whether the last one could be remembered.
class DevicePreferencesState {
  const DevicePreferencesState({
    this.preferences = const DevicePreferences(),
    this.rememberFailed = false,
    this.readFailed = false,
  });

  final DevicePreferences preferences;
  final bool rememberFailed;

  /// Whether this device's choices could not be read at all, so
  /// [preferences] is the fallback rather than what the installation holds.
  final bool readFailed;

  DevicePreferencesState copyWith({
    DevicePreferences? preferences,
    bool? rememberFailed,
    bool? readFailed,
  }) => DevicePreferencesState(
    preferences: preferences ?? this.preferences,
    rememberFailed: rememberFailed ?? this.rememberFailed,
    readFailed: readFailed ?? this.readFailed,
  );
}

/// The shared owner of this installation's choices.
///
/// A failed local write preserves the choice for this run. Language, appearance
/// and the retention window report failures; Followed Repository View failures
/// stay silent.
final devicePreferencesProvider =
    AsyncNotifierProvider<DevicePreferencesController, DevicePreferencesState>(
      DevicePreferencesController.new,
    );

/// The choices in force right now, or the system defaults while the local file
/// is still being read.
///
/// Every surface reads this one provider, so the fallback used during startup
/// cannot differ between the app shell and the controls.
final devicePreferencesStateProvider = Provider<DevicePreferencesState>(
  (ref) =>
      ref.watch(devicePreferencesProvider).value ??
      const DevicePreferencesState(),
);

class DevicePreferencesController
    extends AsyncNotifier<DevicePreferencesState> {
  Future<void> _pending = Future.value();

  @override
  Future<DevicePreferencesState> build() async {
    try {
      final preferences = await ref.read(devicePreferencesStoreProvider).read();
      return DevicePreferencesState(preferences: preferences);
    } catch (_) {
      // An unreadable device store cannot stop the app from starting on the
      // defaults; the next save retries the write. Readers of the state are told
      // the choices are fallbacks, so none of them treats them as this
      // installation's own.
      return const DevicePreferencesState(readFailed: true);
    }
  }

  Future<void> selectLanguage(AppLanguage language) =>
      _select((preferences) => preferences.copyWith(language: language));

  Future<void> selectAppearance(AppAppearance appearance) =>
      _select((preferences) => preferences.copyWith(appearance: appearance));

  Future<void> selectFollowedRepositoryView(FollowedRepositoryView view) =>
      _select(
        (preferences) => preferences.copyWith(followedRepositoryView: view),
        reportFailure: false,
      );

  /// Remembers a retention window the reader chose, applied immediately.
  Future<void> selectRetentionDays(int days) =>
      _select((preferences) => preferences.copyWith(retentionDays: days));

  /// Records the window seeded from this installation's saved history.
  ///
  /// Seeding is not a reader's choice, so a device that cannot remember it
  /// stays quiet: the Timeline Session holds the same value for this run.
  Future<void> rememberSeededRetentionDays(int days) => _select(
    (preferences) => preferences.retentionDays == null
        ? preferences.copyWith(retentionDays: days)
        : preferences,
    reportFailure: false,
  );

  Future<void> _select(
    DevicePreferences Function(DevicePreferences) update, {
    bool reportFailure = true,
  }) async {
    // Wait for the saved preferences, then read the latest state: another
    // choice waiting on the same read may already have updated it.
    if (state.value == null) await future;
    if (!ref.mounted) return;
    final current = state.requireValue;
    final preferences = update(current.preferences);
    if (preferences == current.preferences) return;
    state = AsyncData(
      current.copyWith(
        preferences: preferences,
        rememberFailed: reportFailure ? false : current.rememberFailed,
      ),
    );
    await _save(preferences, reportFailure: reportFailure);
  }

  /// Saves in order, so a slow earlier write cannot resurrect an older choice.
  Future<void> _save(
    DevicePreferences preferences, {
    required bool reportFailure,
  }) {
    final save = _pending.then((_) async {
      try {
        await ref.read(devicePreferencesStoreProvider).write(preferences);
        final current = state.value;
        if (ref.mounted && current != null && current.rememberFailed) {
          state = AsyncData(current.copyWith(rememberFailed: false));
        }
      } catch (_) {
        final current = state.value;
        if (reportFailure && ref.mounted && current != null) {
          state = AsyncData(current.copyWith(rememberFailed: true));
        }
      }
    });
    _pending = save;
    return save;
  }
}
