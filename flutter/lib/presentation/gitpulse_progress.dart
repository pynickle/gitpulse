import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'gitpulse_tokens.dart';

/// The line a row's indicator is drawn with: thin enough to sit beside a glyph
/// without thickening the row it belongs to.
const gitPulseInlineProgressStroke = 2.0;

/// The line a page's indicator is drawn with: heavy enough to read as the
/// page's whole state from across a phone.
const gitPulsePageProgressStroke = 3.0;

/// How long one turn of either indicator takes.
const gitPulseProgressTurn = Duration(milliseconds: 900);

/// The progress a row shows while the action it belongs to completes.
///
/// It is a face of its own rather than Material's spinner (ADR 0032) and it
/// stands exactly where a 20dp glyph stands, so a row keeps its height whether
/// it is showing a mark or the work behind it. [label] is what assistive
/// technology hears while it turns; an indicator the surrounding row already
/// names in words passes none.
class GitPulseProgressInline extends StatelessWidget {
  const GitPulseProgressInline({super.key, this.label});

  final String? label;

  @override
  Widget build(BuildContext context) => _GitPulseSpinner(
    extent: GitPulseIconSize.action,
    stroke: gitPulseInlineProgressStroke,
    label: label,
  );
}

/// The progress a loading page shows: the one thing on a surface that has
/// nothing else to say yet.
///
/// It takes the page state's glyph measure, so a loading page and an empty one
/// open at the same size, and [label] is announced as a live region because the
/// page arrived on its own.
class GitPulseProgressPage extends StatelessWidget {
  const GitPulseProgressPage({super.key, this.label});

  final String? label;

  @override
  Widget build(BuildContext context) => _GitPulseSpinner(
    extent: GitPulseIconSize.page,
    stroke: gitPulsePageProgressStroke,
    label: label,
  );
}

/// One turning arc in the Accent, at the size and line its face asks for.
///
/// The arc is drawn rather than taken from Material: an indicator the theme
/// cannot reach is an indicator a Flutter upgrade can restyle, and this is one
/// of the faces the client owns (ADR 0032). The ink is [toneAccent], so progress
/// reads as GitPulse acting rather than as a status.
class _GitPulseSpinner extends StatefulWidget {
  const _GitPulseSpinner({
    required this.extent,
    required this.stroke,
    required this.label,
  });

  final double extent;
  final double stroke;
  final String? label;

  @override
  State<_GitPulseSpinner> createState() => _GitPulseSpinnerState();
}

class _GitPulseSpinnerState extends State<_GitPulseSpinner>
    with SingleTickerProviderStateMixin {
  late final AnimationController _turns = AnimationController(
    vsync: this,
    duration: gitPulseProgressTurn,
  )..repeat();

  @override
  void dispose() {
    _turns.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: widget.label,
      liveRegion: widget.label != null,
      child: SizedBox.square(
        dimension: widget.extent,
        child: RotationTransition(
          turns: _turns,
          child: CustomPaint(
            painter: _GitPulseArc(
              color: toneAccent(context),
              stroke: widget.stroke,
            ),
          ),
        ),
      ),
    );
  }
}

/// Three quarters of a circle, open at the bottom: the gap is what says the
/// progress is still going.
class _GitPulseArc extends CustomPainter {
  const _GitPulseArc({required this.color, required this.stroke});

  final Color color;
  final double stroke;

  @override
  void paint(Canvas canvas, Size size) {
    final inset = stroke / 2;
    final bounds = Rect.fromLTWH(
      inset,
      inset,
      size.width - stroke,
      size.height - stroke,
    );
    canvas.drawArc(
      bounds,
      -math.pi / 2,
      math.pi * 1.5,
      false,
      Paint()
        ..color = color
        ..strokeWidth = stroke
        ..strokeCap = StrokeCap.round
        ..style = PaintingStyle.stroke,
    );
  }

  @override
  bool shouldRepaint(_GitPulseArc old) =>
      old.color != color || old.stroke != stroke;
}
