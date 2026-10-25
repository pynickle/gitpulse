import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../presentation/gitpulse_setting_rows.dart';
import '../presentation/gitpulse_tokens.dart';
import '../presentation/presentation_settings.dart';
import '../session/session_controller.dart';
import 'account_panel.dart';
import 'timeline_cache_settings.dart';

/// The Settings destination: this installation's own choices, and the account
/// those choices are made for.
///
/// The page is a table of settings rather than a document about them. Each row
/// is a name, the control that holds its value, and whatever that control last
/// reported, laid out on the one gutter the Timeline and Follows pages share —
/// so a reader who has learned to scan those two pages already knows where to
/// look here. A wide window gives the account its own column at the trailing
/// edge, as the Follows page gives Followed Repositories one; a phone stacks it
/// above the settings, because there is nowhere else to put it.
class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  /// The width the settings rows are allowed before the page stops growing: a
  /// row wider than this asks the eye to travel from name to control and back.
  static const _maximumContentWidth = GitPulseWidth.settingsTable;

  /// The width at which the account moves out of the scroll and into a column
  /// of its own, leaving the settings rows one readable column.
  static const _wideMinimumWidth = 1040.0;

  /// The account column's width, matching the Followed Repositories panel.
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
                if (!wide) ...[
                  const SliverToBoxAdapter(child: AccountPanel()),
                  // The account's band meets the settings table with a rule
                  // that touches both edges, so the two do not read as rows of
                  // one table.
                  const SliverToBoxAdapter(
                    child: GitPulseSettingsDivider(indent: 0),
                  ),
                ],
                const SliverToBoxAdapter(child: PresentationSettings()),
                if (signedIn) ...[
                  const SliverToBoxAdapter(child: GitPulseSettingsDivider()),
                  SliverToBoxAdapter(
                    child: TimelineCacheSettings(key: ValueKey(identity)),
                  ),
                ],
                const SliverToBoxAdapter(child: SizedBox(height: 24)),
              ],
            );
            if (!wide) return scroll;
            return Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(child: scroll),
                // A column boundary, not a row boundary: the same hairline,
                // turned on its side.
                VerticalDivider(
                  width: 1,
                  thickness: 1,
                  color: Theme.of(context).dividerColor,
                ),
                SizedBox(
                  width: _accountColumnWidth,
                  child: const SingleChildScrollView(
                    padding: EdgeInsets.only(bottom: 24),
                    child: AccountPanel(),
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
