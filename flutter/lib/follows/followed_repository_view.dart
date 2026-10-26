import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../device/device_preferences.dart';
import '../device/device_preferences_controller.dart';

export '../device/device_preferences.dart' show FollowedRepositoryView;

/// The shared device preference used by Followed Repository surfaces.
final followedRepositoryViewProvider = Provider<FollowedRepositoryView>(
  (ref) => ref.watch(
    devicePreferencesStateProvider.select(
      (state) => state.preferences.followedRepositoryView,
    ),
  ),
);
