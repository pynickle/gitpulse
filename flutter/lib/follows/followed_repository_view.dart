import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../presentation/presentation_preferences.dart';
import '../presentation/presentation_preferences_controller.dart';

export '../presentation/presentation_preferences.dart'
    show FollowedRepositoryView;

/// The shared device preference used by Followed Repository surfaces.
final followedRepositoryViewProvider = Provider<FollowedRepositoryView>(
  (ref) => ref.watch(
    presentationPreferencesStateProvider.select(
      (state) => state.preferences.followedRepositoryView,
    ),
  ),
);
