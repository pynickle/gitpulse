import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'gitpulse_tokens.dart';

/// How long a dialog takes to arrive and to leave.
const gitPulseDialogTransition = Duration(milliseconds: 180);

/// How much of the page a dialog's scrim takes away.
///
/// A dialog is dismissed by tapping the page it covers, so the page has to read
/// as covered — the sheet's own barrier is left alone, because a sheet is pulled
/// away rather than tapped away.
const gitPulseDialogBarrierAlpha = 0.54;

/// Shows [builder]'s content as one of the app's dialogs.
///
/// Every dialog the app opens is this one presentation, the way every sheet is
/// `showGitPulseSheet`'s (ADR 0032): the route, its barrier, the surface tone
/// the dialog is drawn on, its shape, its measure and the Escape key are decided
/// here. A dialog body therefore decides only its content, and nothing about how
/// it arrives or where it sits.
///
/// The returned future completes with the value the body pops, and with null
/// when the reader dismisses it by the barrier or the key.
Future<T?> showGitPulseDialog<T>(
  BuildContext context, {
  required String barrierLabel,
  required WidgetBuilder builder,
}) {
  return showGeneralDialog<T>(
    context: context,
    barrierDismissible: true,
    barrierLabel: barrierLabel,
    barrierColor: toneScrim(context)
        .withValues(alpha: gitPulseDialogBarrierAlpha),
    requestFocus: true,
    transitionDuration: gitPulseDialogTransition,
    pageBuilder: (context, animation, secondaryAnimation) =>
        _DialogSurface(child: builder(context)),
    transitionBuilder: (context, animation, secondaryAnimation, child) {
      final curved = CurvedAnimation(
        parent: animation,
        curve: Curves.easeOutCubic,
      );
      return FadeTransition(
        opacity: curved,
        child: ScaleTransition(
          scale: Tween(begin: .96, end: 1.0).animate(curved),
          child: child,
        ),
      );
    },
  );
}

/// A dialog's body: its title, its content if it has any, and the actions that
/// answer it.
///
/// The body decides what the dialog says and nothing about how it is drawn: the
/// surface, the ink and the type of the title are the presentation's, so two
/// dialogs opened from two screens cannot drift into two looks.
class GitPulseDialog extends StatelessWidget {
  const GitPulseDialog({
    super.key,
    required this.title,
    this.content,
    required this.actions,
  });

  /// What the dialog is about, set as a surface's title.
  final Widget title;

  /// What it needs to say beyond its title, if anything.
  final Widget? content;

  /// The ways out, in the order the reader reads them: the quiet one first.
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(GitPulseSpace.surfaceInset),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          DefaultTextStyle.merge(
            style: gitPulseTypeSurfaceTitle(context),
            child: title,
          ),
          if (content case final content?) ...[
            const SizedBox(height: GitPulseSpace.inline),
            DefaultTextStyle.merge(
              style: gitPulseTypeMeta(context),
              child: content,
            ),
          ],
          const SizedBox(height: GitPulseSpace.gutter),
          Wrap(
            alignment: WrapAlignment.end,
            spacing: GitPulseSpace.inline,
            runSpacing: GitPulseSpace.inline,
            children: actions,
          ),
        ],
      ),
    );
  }
}

/// The surface a dialog body stands on, and the key that dismisses it.
///
/// Escape is not a desktop affordance here: a hardware keyboard is an ordinary
/// Android input device, so a dialog that the barrier dismisses is dismissed by
/// the key a keyboard offers too — the same answer every sheet gives.
class _DialogSurface extends StatelessWidget {
  const _DialogSurface({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Shortcuts(
      shortcuts: const {
        SingleActivator(LogicalKeyboardKey.escape): DismissIntent(),
      },
      child: Actions(
        actions: {
          DismissIntent: CallbackAction<DismissIntent>(
            onInvoke: (_) {
              Navigator.of(context).pop();
              return null;
            },
          ),
        },
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(GitPulseSpace.gutter),
            child: Center(
              // A dialog whose content outgrows the phone scrolls rather than
              // clipping: a body is content, and content does not get cut.
              child: SingleChildScrollView(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(
                    maxWidth: GitPulseWidth.dialog,
                  ),
                  // One measure for every dialog, taken from the page by the
                  // gutter rather than by the dialog's own content: a
                  // confirmation and a form arrive the same size.
                  child: SizedBox(
                    width: double.infinity,
                    child: Material(
                      color: toneSurface(context),
                      borderRadius: BorderRadius.circular(
                        GitPulseRadius.surface,
                      ),
                      clipBehavior: Clip.antiAlias,
                      child: child,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
