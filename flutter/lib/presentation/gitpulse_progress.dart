import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'gitpulse_tokens.dart';

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
    stroke: GitPulseStroke.progressInline,
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
    stroke: GitPulseStroke.progressPage,
    label: label,
  );
}

/// How strong a mark that states a wait stays at its faintest.
///
/// A mark that breathes to state a wait never reaches nothing: it is still the
/// picture of what its control does, so the breath is a change of strength
/// rather than a disappearance of the thing the reader pressed.
const gitPulseWaitingFaintOpacity = 0.55;

/// Breathes [child] while [waiting], and holds it at full strength otherwise.
///
/// A wait that belongs to a control belongs in that control's mark rather than
/// in a second indicator beside it: the mark breathes in place, on the app's own
/// [gitPulseProgressTurn], and gains no indicator, no row and no name. The
/// control around this mark keeps its press and its name for the whole breath,
/// because the motion is a visual cue and the action still works at the moment
/// it moves (ADR 0047 states the Followed Repositories instance of the rule).
///
/// A reader who turned animation off gets the wait without the motion: when
/// [MediaQuery.disableAnimationsOf] is true the child is drawn at full strength
/// and no controller is left running behind it. Reduced motion removes the
/// breath, not the state, so a surface that states the wait another way still
/// can.
class GitPulseWaitingMark extends StatefulWidget {
  const GitPulseWaitingMark({
    super.key,
    required this.waiting,
    required this.child,
  });

  /// Whether the work this mark stands for is still in flight.
  final bool waiting;

  final Widget child;

  @override
  State<GitPulseWaitingMark> createState() => _GitPulseWaitingMarkState();
}

class _GitPulseWaitingMarkState extends State<GitPulseWaitingMark>
    with SingleTickerProviderStateMixin {
  /// One round trip of the opacity, on the period the app's own progress
  /// indicator turns with, so waiting reads the same wherever it is stated.
  late final AnimationController _turn = AnimationController(
    vsync: this,
    duration: gitPulseProgressTurn,
  );

  /// Full to faint and back, eased at both ends so the breath has no corner.
  late final Animation<double> _opacity = TweenSequence<double>([
    TweenSequenceItem(
      tween: Tween<double>(
        begin: 1,
        end: gitPulseWaitingFaintOpacity,
      ).chain(CurveTween(curve: Curves.easeInOut)),
      weight: 1,
    ),
    TweenSequenceItem(
      tween: Tween<double>(
        begin: gitPulseWaitingFaintOpacity,
        end: 1,
      ).chain(CurveTween(curve: Curves.easeInOut)),
      weight: 1,
    ),
  ]).animate(_turn);

  bool _breathing = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _syncBreath();
  }

  @override
  void didUpdateWidget(covariant GitPulseWaitingMark oldWidget) {
    super.didUpdateWidget(oldWidget);
    _syncBreath();
  }

  /// Starts or stops the turn for the state this frame is built in.
  ///
  /// A reader who turned animation off is the reason this is decided here: the
  /// mark is drawn at full strength and no controller is left running behind
  /// it.
  void _syncBreath() {
    final breathing =
        widget.waiting && !MediaQuery.disableAnimationsOf(context);
    if (breathing == _breathing) return;
    _breathing = breathing;
    if (breathing) {
      _turn.repeat();
    } else {
      _turn.stop();
    }
  }

  @override
  void dispose() {
    _turn.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: _turn,
    child: widget.child,
    builder: (context, child) =>
        Opacity(opacity: _breathing ? _opacity.value : 1, child: child),
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
