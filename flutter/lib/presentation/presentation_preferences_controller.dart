import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'presentation_preferences.dart';
import 'presentation_preferences_store.dart';

/// The current presentation choices and language or appearance save feedback.
class PresentationPreferencesState {
  const PresentationPreferencesState({
    this.preferences = const PresentationPreferences(),
    this.rememberFailed = false,
  });

  final PresentationPreferences preferences;
  final bool rememberFailed;

  PresentationPreferencesState copyWith({
    PresentationPreferences? preferences,
    bool? rememberFailed,
  }) => PresentationPreferencesState(
    preferences: preferences ?? this.preferences,
    rememberFailed: rememberFailed ?? this.rememberFailed,
  );
}

/// The shared owner of this installation's presentation choices.
///
/// A failed local write preserves the choice for this run. Language and
/// appearance report failures; Followed Repository View failures stay silent.
final presentationPreferencesProvider =
    AsyncNotifierProvider<
      PresentationPreferencesController,
      PresentationPreferencesState
    >(PresentationPreferencesController.new);

/// The choices in force right now, or the system defaults while the local file
/// is still being read.
///
/// Every surface reads this one provider, so the fallback used during startup
/// cannot differ between the app shell and the controls.
final presentationPreferencesStateProvider =
    Provider<PresentationPreferencesState>(
      (ref) =>
          ref.watch(presentationPreferencesProvider).value ??
          const PresentationPreferencesState(),
    );

class PresentationPreferencesController
    extends AsyncNotifier<PresentationPreferencesState> {
  Future<void> _pending = Future.value();

  @override
  Future<PresentationPreferencesState> build() async {
    try {
      final preferences = await ref
          .read(presentationPreferencesStoreProvider)
          .read();
      return PresentationPreferencesState(preferences: preferences);
    } catch (_) {
      // An unreadable device store cannot stop the app from starting on the
      // system defaults; the next save retries the write.
      return const PresentationPreferencesState();
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

  Future<void> _select(
    PresentationPreferences Function(PresentationPreferences) update, {
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
    PresentationPreferences preferences, {
    required bool reportFailure,
  }) {
    final save = _pending.then((_) async {
      try {
        await ref.read(presentationPreferencesStoreProvider).write(preferences);
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
