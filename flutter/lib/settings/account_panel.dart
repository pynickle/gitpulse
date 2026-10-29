import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../connection/connection_controller.dart';
import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_avatar.dart';
import '../presentation/gitpulse_buttons.dart';
import '../presentation/gitpulse_setting_rows.dart';
import '../presentation/gitpulse_tokens.dart';
import '../session/session_controller.dart';
import 'backend_details.dart';

/// The account this installation is using, as the Settings backend card.
///
/// The panel states the identity, the backend that identity lives on, and the
/// way out of it — the same order in which a reader asks: who am I, where, and
/// how do I become someone else. Signed out, the identity line is simply not
/// there, and the panel is the backend alone.
///
/// It holds no way in: signing in is what the Timeline and Follows destinations
/// put in front of a signed-out reader (the account gate), so this page states
/// the installation instead of asking the reader to enter it again.
class AccountPanel extends ConsumerWidget {
  const AccountPanel({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final backend = ref.watch(connectionControllerProvider).value?.backend;
    if (backend == null) return const SizedBox.shrink();
    final session = ref.watch(sessionControllerProvider);
    final identity = session.identity;
    final busy = session.busy;
    final notifier = ref.read(sessionControllerProvider.notifier);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (identity != null) ...[
          Row(
            children: [
              GitPulseAvatar(
                url: identity.avatarUrl,
                size: GitPulseAvatarSize.account,
              ),
              const SizedBox(width: GitPulseSpace.inline),
              Expanded(
                child: Text(
                  identity.login,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: gitPulseTypeRowLabel(context),
                ),
              ),
              // One way out of an account, because there is only one. The
              // action's own padding keeps the name off the card below it.
              GitPulseIconButton(
                tooltip: l10n.signOut,
                onPressed: busy ? null : notifier.signOut,
                icon: const Icon(Icons.logout),
              ),
            ],
          ),
          const SizedBox(height: GitPulseSpace.inline),
        ],
        const GitPulseSettingSurface(
          child: BackendDetails(layout: BackendDetailsLayout.card),
        ),
      ],
    );
  }
}
