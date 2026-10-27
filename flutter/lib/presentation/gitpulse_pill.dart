import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'gitpulse_tokens.dart';

/// The type a pill's number is set in, and the one line height the pill is built
/// around: the body role, with tabular figures so the number does not shift as
/// its digits change.
TextStyle? gitPulsePillNumberStyle(BuildContext context) =>
    Theme.of(context).textTheme.bodyMedium
        ?.copyWith(fontFeatures: const [FontFeature.tabularFigures()]);

/// One line of the number's type at this reader's text scale.
///
/// Measured rather than assumed: it is what the number cell needs, and it is the
/// only thing that can make the pill taller than its own cell. The field's own
/// decoration reports a Material tap-target intrinsic that a borderless,
/// collapsed field never draws, so the pill cannot ask it.
double _numberLineHeight(BuildContext context) {
  final painter = TextPainter(
    text: TextSpan(text: '0', style: gitPulsePillNumberStyle(context)),
    textDirection: TextDirection.ltr,
    textScaler: MediaQuery.textScalerOf(context),
  )..layout();
  final height = painter.height;
  painter.dispose();
  return height;
}

/// A pill: one hairline surface whose cells are separated by rules, read as a
/// single control rather than as a row of buttons.
///
/// The page pill is the one user: a page number stepped by two neighbouring
/// arrows. Its height is one [GitPulseHeight.pill] cell — flatter than a toolbar
/// control, and wider than it is tall (ADR 0026) — until the reader's type needs
/// more room than that cell, and then exactly the number's own line.
///
/// [focused] is the whole of the focus feedback: the edge turns to the accent,
/// and nothing about the pill's shape, size or cells moves when its number takes
/// the focus.
class GitPulsePill extends StatelessWidget {
  const GitPulsePill({super.key, required this.cells, this.focused = false});

  final List<Widget> cells;
  final bool focused;

  /// The pill's height for this reader: its cell, or one line of the number's
  /// type when that is taller.
  static double heightFor(BuildContext context) =>
      math.max(GitPulseHeight.pill, _numberLineHeight(context));

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final rule = VerticalDivider(
      width: GitPulseStroke.hairline,
      thickness: GitPulseStroke.hairline,
      color: toneRule(scheme),
    );
    return SizedBox(
      height: heightFor(context),
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(GitPulseRadius.row),
          border: Border.all(
            color: focused ? scheme.primary : toneEdge(scheme),
            width: GitPulseStroke.hairline,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (var index = 0; index < cells.length; index++) ...[
              if (index > 0) rule,
              cells[index],
            ],
          ],
        ),
      ),
    );
  }
}

/// One step of a pill: a cell of its own, wider than it is tall so the two
/// arrows and the number between them share one rhythm.
class GitPulsePillStep extends StatelessWidget {
  const GitPulsePillStep({
    super.key,
    required this.icon,
    required this.tooltip,
    required this.onPressed,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback? onPressed;

  /// The cell's size: the pill's height, and a full 40dp across so an arrow
  /// keeps a comfortable target even though the pill is flat (ADR 0026).
  static const size = Size(
    GitPulseHeight.pill + GitPulseSpace.inline,
    GitPulseHeight.pill,
  );

  @override
  Widget build(BuildContext context) => IconButton(
    tooltip: tooltip,
    onPressed: onPressed,
    iconSize: GitPulseIconSize.action,
    visualDensity: VisualDensity.compact,
    style: IconButton.styleFrom(
      padding: EdgeInsets.zero,
      minimumSize: Size.zero,
      fixedSize: size,
      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
    ),
    icon: Icon(icon),
  );
}

/// The number a pill is about: always a field, always one cell, so a reader who
/// taps it finds the control they were already reading.
///
/// The cell is not the pill's label and repeats none of its copy — [label] names
/// the number for assistive technology only, because a pill draws no label of
/// its own.
class GitPulsePillNumber extends StatelessWidget {
  const GitPulsePillNumber({
    super.key,
    required this.controller,
    required this.focusNode,
    required this.label,
    this.enabled = true,
    this.onCommit,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final String label;
  final bool enabled;

  /// Runs before the field gives up the focus, as submitting does.
  final VoidCallback? onCommit;

  /// How wide the cell stands for this reader: the number is the one part of the
  /// pill that follows the type, so a scaled-up number is never clipped and the
  /// pill keeps its proportions around it.
  static double widthFor(BuildContext context) =>
      GitPulseWidth.pillNumber *
      MediaQuery.textScalerOf(context).scale(10) /
      10;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: GitPulseSpace.inline),
    child: SizedBox(
      width: widthFor(context),
      child: Semantics(
        label: label,
        child: TextField(
          controller: controller,
          focusNode: focusNode,
          enabled: enabled,
          keyboardType: TextInputType.number,
          textInputAction: TextInputAction.done,
          textAlign: TextAlign.center,
          style: gitPulsePillNumberStyle(context),
          onSubmitted: (_) {
            onCommit?.call();
            focusNode.unfocus();
          },
          onTapOutside: (_) => focusNode.unfocus(),
          // The pill is the control: a second box drawn inside it is the shape
          // that made the number look like a different control.
          decoration: const InputDecoration(
            isCollapsed: true,
            border: InputBorder.none,
            contentPadding: EdgeInsets.zero,
          ),
        ),
      ),
    ),
  );
}
