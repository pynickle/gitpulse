import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'gitpulse_tokens.dart';

/// How long a sheet takes to slide into and out of the screen.
const gitPulseSheetTransition = Duration(milliseconds: 180);

/// Shows [builder]'s content as the app's bottom sheet.
///
/// Every sheet the app opens is this one presentation: the route, its barrier,
/// the slide from the bottom edge, the rounded surface it is drawn on and the
/// Escape key are decided here (ADR 0029). A sheet body therefore decides only
/// its own content and height, and nothing about how it arrives or leaves —
/// which is what stops the Release Drawer and the Release Timeline Filter Panel
/// from drifting into two different sheet implementations.
Future<void> showGitPulseSheet(
  BuildContext context, {
  required String barrierLabel,
  required WidgetBuilder builder,
}) {
  return showGeneralDialog<void>(
    context: context,
    barrierDismissible: true,
    barrierLabel: barrierLabel,
    requestFocus: true,
    transitionDuration: gitPulseSheetTransition,
    pageBuilder: (context, animation, secondaryAnimation) =>
        _SheetSurface(animation: animation, child: builder(context)),
    // The route's own default transition fades the page it holds, which is the
    // one thing a sheet must not do (see [_SheetSurface]): the slide is the
    // surface's own, so the route passes its progress through untouched.
    transitionBuilder: (context, animation, secondaryAnimation, child) => child,
  );
}

/// The surface a sheet body stands on, and the keyboard dismissal it answers.
///
/// Escape is not a desktop affordance here: a hardware keyboard is an ordinary
/// Android input device, so a sheet that can be dismissed by dragging is also
/// dismissed by the key a keyboard offers.
class _SheetSurface extends StatelessWidget {
  const _SheetSurface({required this.animation, required this.child});

  /// The route's own progress: the sheet is this far into standing on the
  /// bottom edge, so the same number places it on the way in and on the way out.
  final Animation<double> animation;

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
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
        child: Align(
          alignment: Alignment.bottomCenter,
          child: SlideTransition(
            // A sheet arrives and leaves by moving, never by fading. A
            // release's notes are drawn by a platform view, which keeps its own
            // opacity: a faded sheet would carry its chrome and its barrier
            // away while the notes stayed lit, and the frame the route is
            // removed on would show the whole sheet at full strength again — a
            // flash the reader sees as the drawer shuts. One sheet's own height
            // is also the distance it travels, so a short panel and a tall
            // drawer each leave the screen in the same time.
            position: animation.drive(
              Tween(
                begin: const Offset(0, 1),
                end: Offset.zero,
              ).chain(CurveTween(curve: Curves.easeOutCubic)),
            ),
            child: Material(
              color: scheme.surface,
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(GitPulseRadius.sheetTop),
              ),
              clipBehavior: Clip.antiAlias,
              child: child,
            ),
          ),
        ),
      ),
    );
  }
}
