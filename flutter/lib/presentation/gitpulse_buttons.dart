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
    this.semanticsLabel,
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

  /// The action's whole name, when [label] is the shortening its ink has room
  /// for rather than the name itself.
  ///
  /// Only a destination whose own name does not fit passes one: a screen reader
  /// then hears what the action does, and a reader who can see the button keeps
  /// reading the short word. Every other button is named by its label.
  final String? semanticsLabel;

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
                          child: semanticsLabel == null
                              ? Text(
                                  label,
                                  textAlign: TextAlign.center,
                                  style: gitPulseTypeControlLabel(context, ink),
                                )
                              // The short word stays the ink; the whole name is
                              // what a screen reader is given, so shortening a
                              // destination costs nothing but letters.
                              : Semantics(
                                  label: semanticsLabel,
                                  child: ExcludeSemantics(
                                    child: Text(
                                      label,
                                      textAlign: TextAlign.center,
                                      style: gitPulseTypeControlLabel(
                                        context,
                                        ink,
                                      ),
                                    ),
                                  ),
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
///
/// The face has three standings and knows all of them. An action standing on the
/// page is a mark on that page; an action inside a control stands at the
/// control's own measure ([dimension]), so a clear mark never grows the field it
/// sits in; and an action that [floats] over content is a shell-toned disc inside
/// one hairline, which is how it is read as above the list rather than as part of
/// it — the app raises a surface with a boundary, never with a shadow.
class GitPulseIconButton extends StatelessWidget {
  const GitPulseIconButton({
    super.key,
    required this.tooltip,
    required this.icon,
    required this.onPressed,
    this.size = GitPulseIconSize.action,
    this.emphasized = false,
    this.autofocus = false,
    this.dimension = GitPulseHeight.standard,
    this.floating = false,
  });

  final String tooltip;
  final Widget icon;
  final VoidCallback? onPressed;

  /// The mark's own measure, by the job it does — never the target's.
  final double size;

  final bool emphasized;

  /// Takes the keyboard focus when it appears.
  ///
  /// A surface that opens with one action — a sheet's close — passes this so
  /// the keyboard has somewhere to be, and the Escape key the surface answers
  /// has a focused subtree to arrive in.
  final bool autofocus;

  /// The touch target's own measure: the app's 48dp action, the cell a flat
  /// control gives its step, or the control's own height when the action is
  /// drawn inside one.
  ///
  /// It is stated by the surface the action sits in, never chosen by the action:
  /// a page pill's step is one cell of the pill's recorded geometry (ADR 0026),
  /// and a full-height square there would be taller than the pill it belongs to.
  /// A parent that lays the control out shorter than this still decides the
  /// height — the measure is what the control asks for, not what it forces.
  final double dimension;

  /// Whether the action stands over content rather than on it.
  final bool floating;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final enabled = onPressed != null;
    final ink = !enabled
        ? toneTextSubtle(context)
        : emphasized
        ? toneAccent(context)
        // A floating action sits on a surface of its own, so its mark is as
        // strong as that surface's text; one standing on the page is a quiet
        // mark beside the thing it acts on.
        : floating
        ? toneText(context)
        : toneTextMuted(context);
    final fill = floating ? toneShell(context) : null;
    final shape = floating
        ? CircleBorder(
            side: BorderSide(
              color: toneEdge(scheme),
              width: GitPulseStroke.hairline,
            ),
          )
        : null;
    final rounded = BorderRadius.circular(
      floating ? dimension / 2 : GitPulseRadius.row,
    );

    // The tooltip sits inside the button's own semantics node, so the words a
    // pointer is shown are the words a screen reader is told, on the control
    // itself rather than on a node beside it.
    return Semantics(
      button: true,
      enabled: enabled,
      child: Tooltip(
        message: tooltip,
        child: SizedBox.square(
          dimension: dimension,
          child: Material(
            type: fill == null
                ? MaterialType.transparency
                : MaterialType.canvas,
            color: fill,
            shape: shape,
            clipBehavior: fill == null ? Clip.none : Clip.antiAlias,
            child: InkWell(
              onTap: onPressed,
              autofocus: autofocus,
              customBorder:
                  shape ?? RoundedRectangleBorder(borderRadius: rounded),
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
