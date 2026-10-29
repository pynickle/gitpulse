import 'package:flutter/material.dart';

import 'gitpulse_theme.dart';
import 'gitpulse_tokens.dart';

/// Which of the app's surfaces a [GitPulseButton] is drawn on.
///
/// The variant decides the tone, never the size: a filled action and a text
/// action stand at the same height and are set in the same type, so a toolbar
/// reads as one row of controls rather than as controls of different weights.
enum GitPulseButtonVariant {
  /// The Accent, filled: the one action a surface is for.
  filled,

  /// The Accent's wash, with the Accent reading back on it: a second action
  /// that is still the app's.
  tonal,

  /// The surface's own text inside a hairline edge: an action that shapes a
  /// block without claiming the Accent.
  outlined,

  /// The Accent's ink with no shape at all: an action inside a line of text, a
  /// dialog's way out.
  text,
}

/// The app's button.
///
/// Every button the client draws is this one control (ADR 0032): the ink it
/// answers a pointer with is the app's own contract — nothing while pressed on a
/// plain surface, one half-strength tint while hovered or focused, and its own
/// foreground while pressed on a filled or tonal surface. A null [onPressed] is
/// the disabled state: the control quiets to the palette's subtlest ink, keeps
/// its place in the layout, and announces itself as unavailable.
///
/// The control owns its mark: an [icon] passed here takes the variant's tone and
/// the in-control measure, so a caller never decides a colour for it.
class GitPulseButton extends StatelessWidget {
  const GitPulseButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.variant = GitPulseButtonVariant.text,
    this.icon,
    this.expand = false,
  });

  /// The action, in the reader's language.
  final String label;

  /// Runs the action. Null is disabled.
  final VoidCallback? onPressed;

  final GitPulseButtonVariant variant;

  /// The mark that leads the label, if the action has one.
  final Widget? icon;

  /// Fills the width it is given, for an action that owns the end of a row.
  final bool expand;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final enabled = onPressed != null;
    final rounded = BorderRadius.circular(GitPulseRadius.row);

    // What the variant paints, quieted to the palette's subtlest ink when the
    // action is unavailable. A disabled control keeps its shape so a row does
    // not re-flow when one of its actions stops being offered.
    final fill = switch (variant) {
      _ when !enabled && variant != GitPulseButtonVariant.text =>
        variant == GitPulseButtonVariant.outlined
            ? null
            : toneSurfaceMuted(context),
      GitPulseButtonVariant.filled => toneAccent(context),
      GitPulseButtonVariant.tonal => toneAccentSoft(context),
      GitPulseButtonVariant.outlined || GitPulseButtonVariant.text => null,
    };
    final ink = !enabled
        ? toneTextSubtle(context)
        : switch (variant) {
            GitPulseButtonVariant.filled => toneOnAccent(context),
            GitPulseButtonVariant.tonal => toneAccent(context),
            GitPulseButtonVariant.outlined => toneText(context),
            GitPulseButtonVariant.text => toneAccent(context),
          };
    final edge = variant == GitPulseButtonVariant.outlined
        ? BorderSide(color: toneBorder(context), width: GitPulseStroke.hairline)
        : null;
    final overlay =
        variant == GitPulseButtonVariant.filled ||
            variant == GitPulseButtonVariant.tonal
        ? gitPulseFilledInkOverlay(scheme, ink)
        : gitPulseInkOverlay(scheme);

    return Semantics(
      button: true,
      enabled: enabled,
      child: Material(
        type: fill == null ? MaterialType.transparency : MaterialType.canvas,
        color: fill,
        borderRadius: fill == null ? null : rounded,
        clipBehavior: fill == null ? Clip.none : Clip.antiAlias,
        child: InkWell(
          onTap: onPressed,
          borderRadius: rounded,
          overlayColor: overlay,
          child: LayoutBuilder(
            builder: (context, constraints) {
              // A row lays a control out at its own natural width, so an action
              // that fills its width only does so where there is a width to
              // fill: everywhere else it keeps its label's measure.
              final fill = expand && constraints.hasBoundedWidth;
              return ConstrainedBox(
                constraints: BoxConstraints(
                  minHeight: GitPulseHeight.compact,
                  minWidth: fill ? constraints.maxWidth : 0,
                ),
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    borderRadius: rounded,
                    border: edge == null ? null : Border.fromBorderSide(edge),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: GitPulseSpace.surfaceInset,
                      vertical: GitPulseSpace.inline,
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        if (icon case final icon?) ...[
                          IconTheme(
                            data: IconThemeData(
                              color: ink,
                              size: GitPulseIconSize.inControl,
                            ),
                            child: icon,
                          ),
                          const SizedBox(width: GitPulseSpace.inline),
                        ],
                        Flexible(
                          child: Text(
                            label,
                            textAlign: TextAlign.center,
                            style: gitPulseTypeControlLabel(context, ink),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

/// The app's icon-only action: a mark inside a full touch target, named by its
/// tooltip rather than by text beside it.
///
/// The tooltip keeps the platform's own behaviour (a long press on touch, a
/// hover on a pointer): it is a Platform Dialect Exception, and the app supplies
/// the mark and the words the platform presents (ADR 0032). [emphasized] paints
/// the mark in the Accent, which is how a row says "this is already applied"
/// before it is read.
class GitPulseIconButton extends StatelessWidget {
  const GitPulseIconButton({
    super.key,
    required this.tooltip,
    required this.icon,
    required this.onPressed,
    this.size = GitPulseIconSize.action,
    this.emphasized = false,
  });

  final String tooltip;
  final Widget icon;
  final VoidCallback? onPressed;

  /// The mark's own measure, by the job it does — never the target's.
  final double size;

  final bool emphasized;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final enabled = onPressed != null;
    final ink = !enabled
        ? toneTextSubtle(context)
        : emphasized
        ? toneAccent(context)
        : toneTextMuted(context);
    final rounded = BorderRadius.circular(GitPulseRadius.row);

    return Tooltip(
      message: tooltip,
      child: Semantics(
        button: true,
        enabled: enabled,
        child: SizedBox.square(
          dimension: GitPulseHeight.standard,
          child: Material(
            type: MaterialType.transparency,
            child: InkWell(
              onTap: onPressed,
              borderRadius: rounded,
              overlayColor: gitPulseInkOverlay(scheme),
              child: Center(
                child: IconTheme(
                  data: IconThemeData(color: ink, size: size),
                  child: icon,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
