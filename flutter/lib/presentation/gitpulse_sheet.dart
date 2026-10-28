import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'gitpulse_tokens.dart';

/// How long a sheet takes to slide into and out of the screen.
const gitPulseSheetTransition = Duration(milliseconds: 180);

/// Shows [builder]'s content as the app's bottom sheet.
///
/// Every sheet the app opens is this one presentation: the route, its barrier,
/// the entry from the bottom edge, the rounded surface it is drawn on and the
/// Escape key are decided here (ADR 0029). A sheet body therefore decides only
/// its own content and height, and nothing about how it arrives — which is what
/// stops the Release Drawer and the Release Timeline Filter Panel from drifting
/// into two different sheet implementations.
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
        _SheetSurface(child: builder(context)),
    transitionBuilder: (context, animation, secondaryAnimation, child) {
      final curved = CurvedAnimation(
        parent: animation,
        curve: Curves.easeOutCubic,
      );
      return FadeTransition(
        opacity: curved,
        child: SlideTransition(
          position: Tween(
            begin: const Offset(0, .08),
            end: Offset.zero,
          ).animate(curved),
          child: child,
        ),
      );
    },
  );
}

/// The surface a sheet body stands on, and the keyboard dismissal it answers.
///
/// Escape is not a desktop affordance here: a hardware keyboard is an ordinary
/// Android input device, so a sheet that can be dismissed by dragging is also
/// dismissed by the key a keyboard offers.
class _SheetSurface extends StatelessWidget {
  const _SheetSurface({required this.child});

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
    );
  }
}
