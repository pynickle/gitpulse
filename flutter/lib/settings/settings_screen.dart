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
/// Each choice is its own card. A wide window gives the backend card a column
/// at the trailing edge, as the Follows page gives Followed Repositories one;
/// a phone stacks that card above the others, because there is nowhere else to
/// put it.
class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  /// The width the cards are allowed before the page stops growing: a card
  /// wider than this asks the eye to travel from the title to the control.
  static const _maximumContentWidth = GitPulseWidth.settingsTable;

  /// The width at which the backend card moves out of the scroll and into a
  /// column of its own.
  static const _wideMinimumWidth = 1040.0;

  /// The backend column's width, matching the Followed Repositories panel.
  static const _accountColumnWidth = 360.0;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionControllerProvider);
    final identity = session.identity;
    final signedIn = session.phase == SessionPhase.signedIn && identity != null;

    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: _maximumContentWidth),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final wide = constraints.maxWidth >= _wideMinimumWidth;
            final scroll = CustomScrollView(
              slivers: [
                SliverPadding(
                  padding: EdgeInsets.fromLTRB(
                    GitPulseSpace.gutter,
                    GitPulseSpace.gutter,
                    GitPulseSpace.gutter,
                    GitPulseSpace.bandGap,
                  ),
                  sliver: SliverList(
                    delegate: SliverChildListDelegate([
                      if (!wide) ...[
                        const AccountPanel(card: true),
                        const SizedBox(height: GitPulseSpace.bandGap),
                      ],
                      const DeviceSettings(),
                      if (signedIn) ...[
                        const SizedBox(height: GitPulseSpace.bandGap),
                        TimelineCacheSettings(key: ValueKey(identity)),
                      ],
                    ]),
                  ),
                ),
              ],
            );
            if (!wide) return scroll;
            return Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(child: scroll),
                SizedBox(
                  width: _accountColumnWidth,
                  child: const SingleChildScrollView(
                    padding: EdgeInsets.fromLTRB(
                      0,
                      GitPulseSpace.gutter,
                      GitPulseSpace.gutter,
                      GitPulseSpace.bandGap,
                    ),
                    child: AccountPanel(card: true),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
