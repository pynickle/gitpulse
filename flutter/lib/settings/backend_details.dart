import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../connection/connection_controller.dart';
import '../connection/connection_screen.dart'
    show connectionProblemLabel, showBackendAddressEditor;
import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_buttons.dart';
import '../presentation/gitpulse_setting_rows.dart';
import '../presentation/gitpulse_tokens.dart';
import '../session/session_controller.dart';
import '../session/session_notice.dart';

/// The backend this installation is pointed at, as a Settings card: its name on
/// a line with the two actions that act on its address, and the address itself
/// across the card's width.
///
/// This page owns the backend: it is where the server is stated, copied and
/// changed. A destination in front of a signed-out reader therefore states none
/// of it (ADR 0040) — that page's whole subject is getting in, and the ways to
/// it are the only thing on it. A signed-out reader who wants a different server
/// reaches this card the same way they reached the page they are on: the shell's
/// Settings destination is always available, session or not.
///
/// A backend that answers says nothing about it. Health is the ordinary case,
/// and a box reporting it is ink on every visit to say that nothing happened;
/// what has to be stated is the failure, and [BackendStateNotes] states it.
///
/// The address is copyable rather than selected by hand: a reader shares it with
/// whatever else on their network points at the same backend, and an address
/// read on a phone is an address that is hard to retype.
class BackendDetails extends ConsumerStatefulWidget {
  const BackendDetails({super.key});

  @override
  ConsumerState<BackendDetails> createState() => _BackendDetailsState();
}

class _BackendDetailsState extends ConsumerState<BackendDetails> {
  bool _copied = false;
  Timer? _copiedTimer;

  @override
  void dispose() {
    _copiedTimer?.cancel();
    super.dispose();
  }

  Future<void> _editBackend(Uri address) async {
    final editor = await showBackendAddressEditor(context, address.toString());
    if (editor == null || !context.mounted) return;
    if (Uri.parse(editor) == address) return;
    _copiedTimer?.cancel();
    setState(() => _copied = false);
    await ref
        .read(sessionControllerProvider.notifier)
        .leaveBackend(address: editor);
  }

  Future<void> _copyAddress(String address) async {
    await Clipboard.setData(ClipboardData(text: address));
    if (!mounted) return;
    _copiedTimer?.cancel();
    setState(() => _copied = true);
    _copiedTimer = Timer(const Duration(milliseconds: 900), () {
      if (!mounted) return;
      setState(() => _copied = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final backend = ref.watch(connectionControllerProvider).value?.backend;
    if (backend == null) return const SizedBox.shrink();
    final address = backend.address.toString();
    final busy = ref.watch(sessionControllerProvider).busy;

    final name = Text(
      l10n.backend,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: gitPulseSettingLabelStyle(context),
    );
    // The address is the one fact here a reader checks against the server they
    // meant, so it takes a line of its own and nothing is drawn beside it to
    // shorten it; the two actions act on it from the line above.
    //
    // That line also holds the two actions, so the surface gives up the part of
    // their target that stands above the name and the name and its mark stand in
    // the line the target gives them (ADR 0040).
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            GitPulseSettingLabelLine(
              child: ExcludeSemantics(
                child: Icon(
                  Icons.dns_outlined,
                  size: GitPulseIconSize.inline,
                  color: toneTextMuted(context),
                ),
              ),
            ),
            const SizedBox(width: GitPulseSpace.inline),
            Expanded(child: GitPulseSettingLabelLine(child: name)),
            const SizedBox(width: GitPulseSpace.inline),
            GitPulseIconButton(
              label: l10n.copyBackendAddress,
              onPressed: () => _copyAddress(address),
              size: GitPulseIconSize.inControl,
              dimension: GitPulseHeight.compact,
              emphasized: _copied,
              icon: AnimatedSwitcher(
                duration: const Duration(milliseconds: 180),
                switchInCurve: Curves.easeOut,
                switchOutCurve: Curves.easeIn,
                transitionBuilder: (child, animation) =>
                    ScaleTransition(scale: animation, child: child),
                child: Icon(
                  _copied ? Icons.check : Icons.copy_outlined,
                  key: ValueKey(_copied),
                ),
              ),
            ),
            const SizedBox(width: GitPulseSpace.inline),
            // Its name is spoken rather than shortened: leaving a backend clears
            // this account's session and cache, and two arrows pointing opposite
            // ways are the one picture that says "another, not this one".
            GitPulseIconButton(
              label: l10n.changeBackend,
              onPressed: busy ? null : () => _editBackend(backend.address),
              size: GitPulseIconSize.inControl,
              dimension: GitPulseHeight.compact,
              icon: const Icon(Icons.swap_horiz),
            ),
          ],
        ),
        const SizedBox(height: GitPulseSpace.tight),
        Text(
          address,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: gitPulseTypeMeta(context),
        ),
        const BackendStateNotes(),
      ],
    );
  }
}

/// What the connection and the session have to report, under the surface they
/// belong to — and nothing at all when they have nothing to report.
///
/// Its lines are the app's existing ones, stacked in one place so no surface
/// invents a second wording: the [SessionNotice] the shell already draws above a
/// signed-in Timeline or Follows, the repository pages draw above their bands, and
/// this card draws under its address; the connection's own failure; a rejected
/// session; and the one state that is neither — reading saved history offline,
/// which is ordinary and says so in the muted tone rather than the danger one.
/// A destination in front of a signed-out reader draws the same stack above its
/// ways in, because a sign-in that did not finish is the news that page exists to
/// carry.
///
/// [padding] is the caller's, and it is only paid when something is drawn: a
/// surface with nothing to report takes no room from an empty widget.
class BackendStateNotes extends ConsumerWidget {
  const BackendStateNotes({super.key, this.padding = EdgeInsets.zero});

  final EdgeInsets padding;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final problem = ref.watch(connectionControllerProvider).value?.problem;
    final session = ref.watch(sessionControllerProvider);
    final busy = session.busy;
    final storageFailure =
        session.failure == SignInFailure.storage && session.identity == null;

    final notes = <Widget>[
      // A connection problem is what went wrong, so it stays stated; the
      // ordinary case states nothing at all.
      if (problem != null) _BackendNote(connectionProblemLabel(l10n, problem)),
      // Reading saved history with no backend to ask is ordinary rather than a
      // failure, and the line says which state this is without colouring it like
      // a fault. It belongs to a reader who has history to read: with nobody
      // signed in there is no window to be reading, and the sign-in sentence
      // states an unreachable server on its own.
      if (problem == null && session.offline && session.identity != null)
        _BackendNote(l10n.timelineOffline, tone: GitPulseSettingNoteTone.muted),
      if (session.phase == SessionPhase.rejected)
        _BackendNote(l10n.sessionExpired),
      if (session.hasNotice)
        SessionNotice(
          padding: const EdgeInsets.only(top: GitPulseSpace.inline),
        ),
      // A session the device's credential store cannot account for is a session
      // nothing else can clear; the way out belongs beside the line that reports
      // it, on every surface these notes are drawn on.
      if (storageFailure) ...[
        const SizedBox(height: GitPulseSpace.rowInsetV),
        GitPulseButton(
          label: l10n.signOut,
          variant: GitPulseButtonVariant.outlined,
          expand: true,
          onPressed: busy
              ? null
              : ref.read(sessionControllerProvider.notifier).signOut,
        ),
      ],
    ];

    if (notes.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: padding,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: notes,
      ),
    );
  }
}

/// One failure or state stated under the surface it belongs to: what the
/// connection could not do, why the session ended, or that the history being read
/// is a saved one.
class _BackendNote extends StatelessWidget {
  const _BackendNote(this.text, {this.tone = GitPulseSettingNoteTone.error});

  final String text;

  /// A fault is the danger tone and is announced when it arrives; the ordinary
  /// state of reading saved history is the muted tone, found by reading.
  final GitPulseSettingNoteTone tone;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: GitPulseSpace.inline),
    child: GitPulseSettingNote(
      text,
      tone: tone,
      liveRegion: tone == GitPulseSettingNoteTone.error,
    ),
  );
}
