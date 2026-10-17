import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../connection/connection_controller.dart';
import '../l10n/generated/app_localizations.dart';
import 'session_controller.dart';

class SignInPanel extends ConsumerStatefulWidget {
  const SignInPanel({super.key});

  @override
  ConsumerState<SignInPanel> createState() => _SignInPanelState();
}

class _SignInPanelState extends ConsumerState<SignInPanel> {
  final _password = TextEditingController();
  final _token = TextEditingController();

  @override
  void dispose() {
    _password.dispose();
    _token.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final backend = ref.watch(connectionControllerProvider).value?.backend;
    final session = ref.watch(sessionControllerProvider);
    final providers = backend?.capabilities.providers;
    if (providers == null) return const SizedBox.shrink();
    final signedIn =
        session.phase == SessionPhase.signedIn && session.identity != null;
    final showForm = !signedIn;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (session.identity case final identity?) ...[
          Text(
            l10n.signedInAs(identity.login),
            style: Theme.of(context).textTheme.titleMedium,
          ),
          if (session.phase == SessionPhase.rejected) ...[
            const SizedBox(height: 8),
            Semantics(liveRegion: true, child: Text(l10n.sessionExpired)),
          ],
          if (session.offline) ...[
            const SizedBox(height: 8),
            Semantics(liveRegion: true, child: Text(l10n.offlineSession)),
          ],
          const SizedBox(height: 12),
          Align(
            alignment: Alignment.centerLeft,
            child: OutlinedButton(
              onPressed: session.busy
                  ? null
                  : () =>
                        ref.read(sessionControllerProvider.notifier).signOut(),
              child: Text(l10n.signOut),
            ),
          ),
          if (providers.patEnabled && signedIn) ...[
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton(
                onPressed: session.busy
                    ? null
                    : () => ref
                          .read(sessionControllerProvider.notifier)
                          .switchAccount(),
                child: Text(l10n.useDifferentAccount),
              ),
            ),
          ],
        ],
        if (showForm && providers.personalMode)
          _CredentialForm(
            controller: _password,
            label: l10n.passwordLabel,
            action: session.busy ? l10n.unlocking : l10n.unlock,
            busy: session.busy,
            onSubmit: () async {
              final password = _password.text.trim();
              if (password.isEmpty) return;
              await ref
                  .read(sessionControllerProvider.notifier)
                  .unlock(password);
              if (!context.mounted) return;
              if (ref.read(sessionControllerProvider).phase ==
                  SessionPhase.signedIn) {
                _password.clear();
              }
            },
          ),
        if (showForm && providers.patEnabled && !providers.personalMode)
          _CredentialForm(
            controller: _token,
            label: l10n.tokenLabel,
            action: session.busy ? l10n.signingIn : l10n.continueWithToken,
            busy: session.busy,
            onSubmit: () async {
              final token = _token.text.trim();
              if (token.isEmpty) return;
              await ref
                  .read(sessionControllerProvider.notifier)
                  .signInWithToken(token);
              if (!context.mounted) return;
              final phase = ref.read(sessionControllerProvider).phase;
              if (phase == SessionPhase.signedIn) {
                _token.clear();
              }
            },
          ),
        if (showForm &&
            !providers.personalMode &&
            !providers.patEnabled &&
            providers.oauthEnabled)
          Text(l10n.oauthOnly),
        if (session.failure case final failure?) ...[
          const SizedBox(height: 12),
          Semantics(
            liveRegion: true,
            child: Text(_failureLabel(l10n, failure, providers.personalMode)),
          ),
          if (failure == SignInFailure.storage && session.identity == null)
            Align(
              alignment: Alignment.centerLeft,
              child: OutlinedButton(
                onPressed: session.busy
                    ? null
                    : () => ref
                          .read(sessionControllerProvider.notifier)
                          .signOut(),
                child: Text(l10n.signOut),
              ),
            ),
        ],
      ],
    );
  }
}

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
        const SizedBox(height: 16),
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
        const SizedBox(height: 16),
        FilledButton(onPressed: busy ? null : onSubmit, child: Text(action)),
      ],
    );
  }
}

String _failureLabel(
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
};
