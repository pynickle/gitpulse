import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../presentation/gitpulse_tokens.dart';
import '../session/session_controller.dart';
import 'account_panel.dart';
import 'device_settings.dart';
import 'timeline_cache_settings.dart';

/// The Settings destination: this installation's own choices, and the account
/// those choices are made for.
///
/// Each choice is its own card, stacked in one column: the account first, then
/// the device's own choices, then the Timeline cache of the signed-in account.
class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  /// The width the cards are allowed before the page stops growing: a card
  /// wider than this asks the eye to travel from the title to the control.
  static const _maximumContentWidth = GitPulseWidth.settingsTable;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionControllerProvider);
    final identity = session.identity;
    final signedIn = session.phase == SessionPhase.signedIn && identity != null;

    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: _maximumContentWidth),
        child: CustomScrollView(
          slivers: [
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(
                GitPulseSpace.gutter,
                GitPulseSpace.gutter,
                GitPulseSpace.gutter,
                GitPulseSpace.bandGap,
              ),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  const AccountPanel(card: true),
                  const SizedBox(height: GitPulseSpace.bandGap),
                  const DeviceSettings(),
                  if (signedIn) ...[
                    const SizedBox(height: GitPulseSpace.bandGap),
                    TimelineCacheSettings(key: ValueKey(identity)),
                  ],
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
