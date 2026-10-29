import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../connection/native_capabilities.dart';
import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_buttons.dart';
import '../presentation/gitpulse_setting_rows.dart';
import '../presentation/gitpulse_tokens.dart';
import '../session/session_controller.dart';

/// The ways into a backend, one card each, with the divider between the two when
/// it offers both.
///
/// A card is a method: a mark, what the method is called, the one line that says
/// what it will ask of the reader, and the control that performs it. Nothing
/// here selects a method first — each card's own control is the choice, so the
/// page never asks for the same decision twice.
class SignInCards extends ConsumerStatefulWidget {
  const SignInCards({super.key, required this.capabilities});

  /// What this backend says it can be signed into with.
  final NativeCapabilities capabilities;

  @override
  ConsumerState<SignInCards> createState() => _SignInCardsState();
}

class _SignInCardsState extends ConsumerState<SignInCards> {
  final _password = TextEditingController();
  final _token = TextEditingController();

  @override
  void dispose() {
    _password.dispose();
    _token.dispose();
    super.dispose();
  }

  /// Submits one secret, and keeps it in its field until the attempt actually
  /// ends signed in, so a rejected credential can be corrected rather than
  /// retyped.
  Future<void> _submit(
    TextEditingController controller,
    Future<void> Function(String secret) signIn,
  ) async {
    final secret = controller.text.trim();
    if (secret.isEmpty) return;
    await signIn(secret);
    if (!mounted) return;
    if (ref.read(sessionControllerProvider).phase == SessionPhase.signedIn) {
      controller.clear();
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final capabilities = widget.capabilities;
    final providers = capabilities.providers;
    final session = ref.watch(sessionControllerProvider);
    final busy = session.busy;
    final notifier = ref.read(sessionControllerProvider.notifier);

    final cards = <Widget>[
      if (providers.personalMode)
        _SignInCard(
          icon: Icons.lock_outline,
          title: l10n.signInPasswordTitle,
          description: l10n.signInPasswordDescription,
          control: _CredentialForm(
            controller: _password,
            label: l10n.passwordLabel,
            action: busy ? l10n.unlocking : l10n.unlock,
            busy: busy,
            onSubmit: () => _submit(_password, notifier.unlock),
          ),
        ),
      if (providers.patEnabled && !providers.personalMode)
        _SignInCard(
          icon: Icons.vpn_key_outlined,
          title: l10n.signInTokenTitle,
          description: l10n.signInTokenDescription,
          control: _CredentialForm(
            controller: _token,
            label: l10n.tokenLabel,
            action: busy ? l10n.signingIn : l10n.continueWithToken,
            busy: busy,
            onSubmit: () => _submit(_token, notifier.signInWithToken),
          ),
        ),
      if (capabilities.supportsNativeLogin)
        _SignInCard(
          icon: Icons.open_in_browser,
          title: l10n.signInGitPulseTitle,
          description: l10n.signInGitPulseDescription,
          control: _BrowserSignInControl(
            code: session.browserSignInCode,
            busy: busy,
            onStart: notifier.startBrowserSignIn,
            onCancel: () => notifier.cancelBrowserSignIn(),
          ),
        ),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        for (final (index, card) in cards.indexed) ...[
          if (index > 0) const _MethodsDivider(),
          card,
        ],
      ],
    );
  }
}

/// One way in: its mark, its name, what it will ask for, and its control.
///
/// The mark stands in the Accent's wash — the pairing the web app's own sign-in
/// panel paints for the same job — so a reader who has seen GitPulse in a
/// browser meets the same shape here. The card is a surface, not a control: the
/// control inside it is what answers a press.
class _SignInCard extends StatelessWidget {
  const _SignInCard({
    required this.icon,
    required this.title,
    required this.description,
    required this.control,
  });

  final IconData icon;
  final String title;
  final String description;
  final Widget control;

  @override
  Widget build(BuildContext context) {
    return GitPulseSettingSurface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              ExcludeSemantics(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    // The app's compact measure holds the mark, so the card's
                    // header keeps the rhythm of a Settings row.
                    shape: BoxShape.circle,
                    color: toneAccentSoft(context),
                  ),
                  child: SizedBox.square(
                    dimension: GitPulseHeight.compact,
                    child: Icon(
                      icon,
                      size: GitPulseIconSize.action,
                      color: toneAccent(context),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: GitPulseSpace.rowInsetV),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: gitPulseTypeRowLabel(context)),
                    const SizedBox(height: GitPulseSpace.nudge),
                    Text(description, style: gitPulseTypeMeta(context)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: GitPulseSpace.surfaceInset),
          control,
        ],
      ),
    );
  }
}

/// The "or" between two methods: a rule the two cards share, broken by the one
/// word that says they are alternatives.
class _MethodsDivider extends StatelessWidget {
  const _MethodsDivider();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: GitPulseSpace.bandGap),
      child: Row(
        children: [
          const Expanded(child: GitPulseSettingsDivider(indent: 0)),
          Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: GitPulseSpace.inline,
            ),
            child: Text(
              l10n.signInOr,
              style: gitPulseTypeSectionLabel(context),
            ),
          ),
          const Expanded(child: GitPulseSettingsDivider(indent: 0)),
        ],
      ),
    );
  }
}

/// One secret and the action that submits it.
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
        // The secret itself stays the platform's own input (ADR 0032): the app
        // owns the frame, the platform owns the typing.
        TextField(
          controller: controller,
          enabled: !busy,
          obscureText: true,
          enableSuggestions: false,
          autocorrect: false,
          autofillHints: const [],
          textInputAction: TextInputAction.done,
          style: gitPulseTypeFieldText(context),
          decoration: InputDecoration(
            labelText: label,
            border: const OutlineInputBorder(),
          ),
          onSubmitted: (_) => onSubmit(),
        ),
        const SizedBox(height: GitPulseSpace.rowInsetV),
        GitPulseButton(
          label: action,
          variant: GitPulseButtonVariant.filled,
          expand: true,
          onPressed: busy ? null : onSubmit,
        ),
      ],
    );
  }
}

/// Signing in on GitPulse itself: the browser does the asking, and this card
/// holds the code to check until the app comes back signed in.
class _BrowserSignInControl extends StatelessWidget {
  const _BrowserSignInControl({
    required this.code,
    required this.busy,
    required this.onStart,
    required this.onCancel,
  });

  final String? code;
  final bool busy;
  final Future<void> Function() onStart;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    if (code case final code?) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          GitPulseSettingNote(
            l10n.browserSignInPending(code),
            liveRegion: true,
          ),
          const SizedBox(height: GitPulseSpace.rowInsetV),
          // Waiting is exactly when this action has to work: the sign-in is
          // held open on the server until it is cancelled.
          GitPulseButton(
            label: l10n.cancelBrowserSignIn,
            variant: GitPulseButtonVariant.outlined,
            expand: true,
            onPressed: onCancel,
          ),
        ],
      );
    }
    return GitPulseButton(
      label: l10n.continueWithGitPulse,
      variant: GitPulseButtonVariant.tonal,
      expand: true,
      onPressed: busy ? null : onStart,
    );
  }
}
