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
import '../presentation/gitpulse_status_badge.dart';
import '../presentation/gitpulse_tokens.dart';
import '../session/session_controller.dart';
import '../session/session_notice.dart';

/// Which of the app's two presentations the backend takes.
///
/// Both say the same things — which backend, whether it answers, where it is,
/// how to leave it, and whatever the connection or the session has to report —
/// and differ only in what holds them: the Settings card a reader scans in one
/// column, or the sign-in page that stands on the page itself.
enum BackendDetailsLayout {
  /// Inside a Settings card: the name and the state spread across one line, and
  /// the way out is a full-width action under the address.
  card,

  /// On the sign-in page: every line is centred, because nothing else on that
  /// page has a leading edge to line up with, and the way out is a quiet action
  /// under the address rather than a third block of ink.
  page,
}

/// The backend this installation is pointed at: its name, its state, its
/// address, the one action that leaves it, and the state of the session that
/// lives on it.
///
/// The address is copyable here rather than selected by hand: a reader shares it
/// with whatever else on their network points at the same backend, and an
/// address read on a phone is an address that is hard to retype. The health of
/// the connection is the pill's; a connection that failed to report one says so
/// again in a note, and the session's own trouble is stated under the backend it
/// belongs to, so the surfaces that carry this never repeat these lines.
class BackendDetails extends ConsumerStatefulWidget {
  const BackendDetails({super.key, required this.layout});

  final BackendDetailsLayout layout;

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
    final connection = ref.watch(connectionControllerProvider).value;
    final backend = connection?.backend;
    final session = ref.watch(sessionControllerProvider);
    if (backend == null) return const SizedBox.shrink();
    final centered = widget.layout == BackendDetailsLayout.page;
    final address = backend.address.toString();
    final problem = connection?.problem;
    final busy = session.busy;

    final name = Text(
      l10n.backend,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: gitPulseSettingLabelStyle(context),
    );
    final header = Row(
      mainAxisAlignment: centered
          ? MainAxisAlignment.center
          : MainAxisAlignment.start,
      children: [
        ExcludeSemantics(
          child: Icon(
            Icons.dns_outlined,
            size: GitPulseIconSize.inline,
            color: toneTextMuted(context),
          ),
        ),
        const SizedBox(width: GitPulseSpace.inline),
        // Across a card the name takes the line so the state pill can end it;
        // centred on the page the three stand together as one group, and the
        // name still gives way first when a long pill needs the room.
        if (centered) Flexible(child: name) else Expanded(child: name),
        if (problem == null) ...[
          const SizedBox(width: GitPulseSpace.inline),
          GitPulseStatusBadge(
            icon: session.offline
                ? Icons.cloud_off_outlined
                : Icons.cloud_done_outlined,
            label: session.offline
                ? l10n.timelineOffline
                : l10n.backendConnected,
          ),
        ],
      ],
    );

    final addressText = Text(
      address,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: gitPulseTypeMeta(context),
    );
    final addressLine = Row(
      mainAxisAlignment: centered
          ? MainAxisAlignment.center
          : MainAxisAlignment.start,
      children: [
        // Across a card the address takes the line so the copy action can end
        // it; centred on the page the two stand together as one group.
        if (centered)
          Flexible(child: addressText)
        else
          Expanded(child: addressText),
        GitPulseIconButton(
          label: l10n.copyBackendAddress,
          onPressed: () => _copyAddress(address),
          size: GitPulseIconSize.inControl,
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
      ],
    );

    final change = GitPulseButton(
      label: l10n.changeBackend,
      variant: centered
          ? GitPulseButtonVariant.text
          : GitPulseButtonVariant.outlined,
      expand: !centered,
      onPressed: busy ? null : () => _editBackend(backend.address),
      icon: const Icon(Icons.sync),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        header,
        const SizedBox(height: GitPulseSpace.tight),
        addressLine,
        const SizedBox(height: GitPulseSpace.tight),
        if (centered)
          Align(alignment: AlignmentDirectional.center, child: change)
        else
          change,
        // A connection problem is what went wrong, so it stays; the healthy
        // backend says so in its status pill instead.
        if (problem != null)
          _BackendNote(connectionProblemLabel(l10n, problem)),
        if (session.phase == SessionPhase.rejected)
          _BackendNote(l10n.sessionExpired),
        // The shell draws this line above a signed-in Timeline or Follows, so
        // this is the session's one account of its own trouble: the surfaces
        // that carry these details do not draw it again.
        SessionNotice(
          padding: const EdgeInsets.only(top: GitPulseSpace.inline),
        ),
        // A session the device's credential store cannot account for is a
        // session nothing else can clear; the way out belongs beside the line
        // that reports it, on every surface the details are drawn on.
        if (session.failure == SignInFailure.storage &&
            session.identity == null) ...[
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
      ],
    );
  }
}

/// One failure stated under the backend it belongs to: what the connection could
/// not do, or why the session ended.
class _BackendNote extends StatelessWidget {
  const _BackendNote(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: GitPulseSpace.inline),
    child: GitPulseSettingNote(
      text,
      tone: GitPulseSettingNoteTone.error,
      liveRegion: true,
    ),
  );
}
