import 'package:flutter/material.dart';

import 'gitpulse_tokens.dart';

/// A pill: one hairline surface whose cells are separated by rules, read as a
/// single control rather than as a row of buttons.
///
/// Page navigation and the retention window are both one number stepped by two
/// neighbouring actions, so they share this frame, this cell and this number
/// instead of each painting the same three boxes. A cell stands one
/// [GitPulseHeight.compact] high — the same height as the search field above a
/// page pill, and Material's floor for anything clickable — and the pill grows
/// past it when the number's type needs more room.
///
/// [focused] is the whole of the focus feedback: the edge turns to the accent,
/// and nothing about the pill's shape, size or cells moves when its number takes
/// the focus.
class GitPulsePill extends StatelessWidget {
  const GitPulsePill({super.key, required this.cells, this.focused = false});

  final List<Widget> cells;
  final bool focused;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final rule = VerticalDivider(
      width: GitPulseStroke.hairline,
      thickness: GitPulseStroke.hairline,
      color: toneRule(scheme),
    );
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(GitPulseRadius.row),
        border: Border.all(
          color: focused ? scheme.primary : toneEdge(scheme),
          width: GitPulseStroke.hairline,
        ),
      ),
      child: IntrinsicHeight(
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

/// One step of a pill: a cell of its own, held to the pill's cell height and
/// width so the two actions and the number between them share one rhythm.
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

  @override
  Widget build(BuildContext context) => IconButton(
    tooltip: tooltip,
    onPressed: onPressed,
    iconSize: GitPulseIconSize.action,
    visualDensity: VisualDensity.compact,
    style: IconButton.styleFrom(
      padding: EdgeInsets.zero,
      minimumSize: Size.zero,
      fixedSize: const Size.square(GitPulseHeight.compact),
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
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
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
            style: theme.textTheme.bodyMedium?.copyWith(
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
            onSubmitted: (_) {
              onCommit?.call();
              focusNode.unfocus();
            },
            onTapOutside: (_) => focusNode.unfocus(),
            // The pill is the control: a second box drawn inside it is the
            // shape that made the number look like a different control.
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
}
