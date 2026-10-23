import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../connection/connection_controller.dart';
import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_setting_rows.dart';
import 'session_controller.dart';

/// The session's own trouble, stated beside whatever the reader is looking at: a
/// lost connection, or the reason the last sign-in did not complete.
///
/// Every surface that carries a session draws it through this one widget, so the
/// account panel on the Settings destination and the account gate on Timeline and
/// Follows cannot state the same trouble twice in two different ways.
class SessionNotice extends ConsumerWidget {
  const SessionNotice({
    super.key,
    this.padding = const EdgeInsets.fromLTRB(
      gitPulseSettingsGutter,
      8,
      gitPulseSettingsGutter,
      0,
    ),
  });

  /// The panel this notice sits in supplies its own gutter; the shell does not.
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionControllerProvider);
    final l10n = AppLocalizations.of(context);
    final providers = ref
        .watch(connectionControllerProvider)
        .value
        ?.backend
        ?.capabilities
        .providers;
    if (!session.offline && session.failure == null) {
      return const SizedBox.shrink();
    }
    return Padding(
      padding: padding,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (session.offline)
            GitPulseSettingNote(l10n.offlineSession, liveRegion: true),
          if (session.failure case final failure?)
            GitPulseSettingNote(
              signInFailureLabel(
                l10n,
                failure,
                providers?.personalMode ?? false,
              ),
              tone: GitPulseSettingNoteTone.error,
              liveRegion: true,
            ),
        ],
      ),
    );
  }
}

/// Why a sign-in attempt did not end signed in, in the reader's language.
String signInFailureLabel(
  AppLocalizations l10n,
  SignInFailure failure,
  bool personalMode,
) => switch (failure) {
  SignInFailure.invalidCredentials =>
    personalMode ? l10n.invalidPassword : l10n.invalidToken,
  SignInFailure.network => l10n.signInNetwork,
  SignInFailure.rateLimited => l10n.signInRateLimited,
  SignInFailure.providerUnavailable => l10n.signInUnavailable,
  SignInFailure.storage => l10n.credentialStorage,
  SignInFailure.unavailable => l10n.signInFailed,
  SignInFailure.browserLaunch => l10n.browserLaunchFailed,
  SignInFailure.expired => l10n.browserSignInExpired,
  SignInFailure.cancelled => l10n.browserSignInCancelled,
};
