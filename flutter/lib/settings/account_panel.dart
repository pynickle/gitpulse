import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../connection/connection_controller.dart';
import '../connection/connection_screen.dart'
    show connectionProblemLabel, showBackendAddressEditor;
import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_setting_rows.dart';
import '../session/session_controller.dart';
import '../session/session_notice.dart';

/// The account this installation is using, and the way to change it.
///
/// The panel states the identity, the backend that identity lives on, and the
/// two ways out of it — the same order in which a reader asks: who am I, where,
/// and how do I become someone else. Signed out, the identity line is simply not
/// there: the address leads the panel and the credentials the backend actually
/// accepts follow it, so the panel is the account in every state rather than a
/// form that appears beside a summary of itself.
class AccountPanel extends ConsumerStatefulWidget {
  const AccountPanel({super.key});

  @override
  ConsumerState<AccountPanel> createState() => _AccountPanelState();
}

class _AccountPanelState extends ConsumerState<AccountPanel> {
  final _password = TextEditingController();
  final _token = TextEditingController();

  @override
  void dispose() {
    _password.dispose();
    _token.dispose();
    super.dispose();
  }

  Future<void> _editBackend(Uri address) async {
    final editor = await showBackendAddressEditor(context, address.toString());
    if (editor == null || !context.mounted) return;
    if (Uri.parse(editor) == address) return;
    await ref
        .read(sessionControllerProvider.notifier)
        .leaveBackend(address: editor);
  }

  /// Submits one secret through [signIn], and keeps it in the field until the
  /// attempt actually ends signed in, so a rejected credential can be corrected
  /// rather than retyped.
  Future<void> _submit(
    TextEditingController controller,
    Future<void> Function(String secret) signIn,
  ) async {
    final secret = controller.text.trim();
    if (secret.isEmpty) return;
    await signIn(secret);
    if (!context.mounted) return;
    if (ref.read(sessionControllerProvider).phase == SessionPhase.signedIn) {
      controller.clear();
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final connection = ref.watch(connectionControllerProvider).value;
    final backend = connection?.backend;
    final session = ref.watch(sessionControllerProvider);
    final providers = backend?.capabilities.providers;
    if (backend == null || providers == null) return const SizedBox.shrink();

    final identity = session.identity;
    final signedIn = session.phase == SessionPhase.signedIn && identity != null;
    final busy = session.busy;
    final notifier = ref.read(sessionControllerProvider.notifier);
    final secondary = theme.textTheme.bodySmall?.copyWith(
      color: scheme.onSurfaceVariant,
    );

    Widget note(String text, GitPulseSettingNoteTone tone) => Padding(
      padding: const EdgeInsets.fromLTRB(
        gitPulseSettingsGutter,
        8,
        gitPulseSettingsGutter,
        0,
      ),
      child: GitPulseSettingNote(text, tone: tone, liveRegion: true),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (identity != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(gitPulseSettingsGutter, 4, 4, 0),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    identity.login,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                // One way out of an account, because there is only one: signing
                // out leaves the credential fields of the same panel in front of
                // the reader, which is all that choosing another account ever
                // was.
                _AccountAction(
                  tooltip: l10n.signOut,
                  icon: Icons.logout,
                  onPressed: busy ? null : notifier.signOut,
                ),
              ],
            ),
          ),
        Padding(
          padding: EdgeInsets.fromLTRB(
            gitPulseSettingsGutter,
            identity == null ? 4 : 0,
            8,
            0,
          ),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  backend.address.toString(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: secondary,
                ),
              ),
              // The address and this action share one line until the reader's
              // text scale leaves room for only one of them; then both give way
              // a little rather than pushing the row past the window.
              Flexible(
                child: TextButton(
                  onPressed: busy ? null : () => _editBackend(backend.address),
                  child: Text(
                    l10n.changeBackend,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 4),
        const GitPulseSettingsDivider(indent: 0),
        // Whatever the connection itself reported belongs beside the address it
        // is about, in every state of the account.
        if (connection?.problem case final problem?)
          note(
            connectionProblemLabel(l10n, problem),
            GitPulseSettingNoteTone.error,
          ),
        if (session.phase == SessionPhase.rejected)
          note(l10n.sessionExpired, GitPulseSettingNoteTone.error),
        // The shell draws the same lines above a signed-in Timeline or Follows,
        // so this is the session's one account of its own trouble: the surfaces
        // that carry this panel do not draw it again.
        const SessionNotice(padding: EdgeInsets.fromLTRB(16, 8, 16, 0)),
        if (!signedIn)
          Padding(
            padding: const EdgeInsets.fromLTRB(
              gitPulseSettingsGutter,
              12,
              gitPulseSettingsGutter,
              16,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (providers.personalMode)
                  _CredentialForm(
                    controller: _password,
                    label: l10n.passwordLabel,
                    action: busy ? l10n.unlocking : l10n.unlock,
                    busy: busy,
                    onSubmit: () => _submit(_password, notifier.unlock),
                  ),
                if (providers.patEnabled && !providers.personalMode)
                  _CredentialForm(
                    controller: _token,
                    label: l10n.tokenLabel,
                    action: busy ? l10n.signingIn : l10n.continueWithToken,
                    busy: busy,
                    onSubmit: () => _submit(_token, notifier.signInWithToken),
                  ),
                if (backend.capabilities.supportsNativeLogin) ...[
                  if (providers.personalMode || providers.patEnabled)
                    const SizedBox(height: 16),
                  if (session.browserSignInCode case final code?) ...[
                    GitPulseSettingNote(
                      l10n.browserSignInPending(code),
                      liveRegion: true,
                    ),
                    const SizedBox(height: 8),
                    OutlinedButton(
                      onPressed: () => notifier.cancelBrowserSignIn(),
                      child: Text(l10n.cancelBrowserSignIn),
                    ),
                  ] else
                    FilledButton.tonal(
                      onPressed: busy ? null : notifier.startBrowserSignIn,
                      child: Text(l10n.continueWithGitHub),
                    ),
                ],
                if (!providers.personalMode &&
                    !providers.patEnabled &&
                    providers.oauthEnabled)
                  GitPulseSettingNote(l10n.oauthOnly),
                if (session.failure == SignInFailure.storage &&
                    identity == null) ...[
                  const SizedBox(height: 12),
                  OutlinedButton(
                    onPressed: busy ? null : notifier.signOut,
                    child: Text(l10n.signOut),
                  ),
                ],
              ],
            ),
          ),
      ],
    );
  }
}

/// One of the two things a signed-in account can do about itself.
class _AccountAction extends StatelessWidget {
  const _AccountAction({
    required this.tooltip,
    required this.icon,
    required this.onPressed,
  });

  final String tooltip;
  final IconData icon;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: tooltip,
      onPressed: onPressed,
      // A header action, sized as the Followed Repositories panel's header
      // actions are: a 20dp mark inside Material's full touch target.
      iconSize: 20,
      color: Theme.of(context).colorScheme.onSurfaceVariant,
      icon: Icon(icon),
    );
  }
}

/// One way in: a single secret and the action that submits it.
class _CredentialForm extends StatelessWidget {
  const _CredentialForm({
    required this.controller,
    required this.label,
    required this.action,
    required this.busy,
    required this.onSubmit,
  });

  final TextEditingController controller;
  final String label;
  final String action;
  final bool busy;
  final Future<void> Function() onSubmit;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: controller,
          enabled: !busy,
          obscureText: true,
          enableSuggestions: false,
          autocorrect: false,
          autofillHints: const [],
          textInputAction: TextInputAction.done,
          decoration: InputDecoration(
            labelText: label,
            border: const OutlineInputBorder(),
          ),
          onSubmitted: (_) => onSubmit(),
        ),
        const SizedBox(height: 12),
        FilledButton(onPressed: busy ? null : onSubmit, child: Text(action)),
      ],
    );
  }
}

/// The account panel as a page shows it while nobody is signed in: centred, and
/// held to a panel's width so a desktop window does not stretch a sign-in form
/// across the whole screen.
///
/// The shell's Timeline and Follows destinations and the repository pages all
/// put this in front of a signed-out reader, so the app has one sign-in surface
/// rather than one per page.
class AccountGate extends StatelessWidget {
  const AccountGate({super.key});

  @override
  Widget build(BuildContext context) => Center(
    child: SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: const AccountPanel(),
      ),
    ),
  );
}
