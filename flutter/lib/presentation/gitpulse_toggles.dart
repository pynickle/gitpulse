import 'package:flutter/material.dart';

import 'gitpulse_theme.dart';
import 'gitpulse_tokens.dart';

/// The track a [GitPulseSwitch] slides in.
///
/// Twice as wide as it is tall, so the two positions read as two places a thumb
/// can stand rather than as one knob twitched sideways. The height is the mark's
/// own: a toggle is not a button and does not grow to a control's height — the
/// target around it does that.
const gitPulseSwitchTrack = Size(52, 32);

/// The thumb's diameter, in either position.
///
/// One size for both states: the position is what states the value, and a thumb
/// that also changed size would be saying it twice.
const gitPulseSwitchThumb = 24.0;

/// How long a toggle takes to move from one state to the other.
///
/// Short enough that an answer to a tap arrives with the tap, long enough that
/// the eye can follow the mark from one place to the other.
const gitPulseToggleTurn = Duration(milliseconds: 180);

/// The app's switch.
///
/// It replaces Material's (ADR 0032) and carries what that control carried: the
/// track and the thumb are drawn in the preset's tones, the thumb crosses the
/// track when the value changes, a disabled switch quiets to the palette's
/// quietest steps and refuses, and a screen reader is told the role, the state
/// and — when the surface does not print it beside the control — the name.
///
/// A press paints nothing; a pointer over it, or the keyboard's focus on it,
/// paints the app's one half-strength tint. Because a track has a fill, that
/// fill is painted as ink below the tint rather than as a container above it, so
/// the tint reads over the track exactly as it reads over a card (ADR 0032).
class GitPulseSwitch extends StatelessWidget {
  const GitPulseSwitch({
    super.key,
    required this.value,
    required this.onChanged,
    this.label,
  });

  /// Whether the switch is on.
  final bool value;

  /// Runs with the value the reader asked for. Null is disabled: the switch
  /// keeps its place in the layout and announces itself as unavailable.
  final ValueChanged<bool>? onChanged;

  /// The switch's spoken name, for a surface that prints no label beside it.
  /// A row that already prints one passes none — the words are there to read.
  final String? label;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final enabled = onChanged != null;
    final radius = BorderRadius.circular(gitPulseSwitchTrack.height / 2);
    final inset = (gitPulseSwitchTrack.height - gitPulseSwitchThumb) / 2;
    final travel = gitPulseSwitchTrack.width - gitPulseSwitchThumb - inset * 2;
    // A reader who asked for reduced motion gets the state, not the crossing.
    final turn = MediaQuery.disableAnimationsOf(context)
        ? Duration.zero
        : gitPulseToggleTurn;

    return Semantics(
      toggled: value,
      enabled: enabled,
      label: label,
      child: Material(
        type: MaterialType.transparency,
        child: InkWell(
          onTap: enabled ? () => onChanged!(!value) : null,
          borderRadius: radius,
          overlayColor: gitPulseInkOverlay(scheme),
          child: SizedBox(
            width: gitPulseSwitchTrack.width,
            // The target, not the track: the track is the drawing, and a
            // toggle is operated by a finger that needs the floor a control
            // needs.
            height: GitPulseHeight.standard,
            child: Center(
              child: SizedBox.fromSize(
                size: gitPulseSwitchTrack,
                child: TweenAnimationBuilder<double>(
                  tween: Tween<double>(end: value ? 1 : 0),
                  duration: turn,
                  curve: Curves.easeOutCubic,
                  builder: (context, crossed, _) {
                    // Off is the palette's step under a knob, framed by the one
                    // hairline so the track is told apart from the surface it
                    // stands on; on is the Accent with the tone that reads on
                    // it. Both cross over while the thumb travels.
                    final track = !enabled
                        ? toneSurfaceMuted(context)
                        : Color.lerp(
                            toneSurfaceActive(context),
                            toneAccent(context),
                            crossed,
                          )!;
                    final edge = !enabled
                        ? toneBorder(context)
                        : Color.lerp(
                            toneBorderStrong(context),
                            GitPulsePaint.none,
                            crossed,
                          )!;
                    final thumb = !enabled
                        ? toneTextSubtle(context)
                        : Color.lerp(
                            toneTextSubtle(context),
                            toneOnAccent(context),
                            crossed,
                          )!;
                    return Stack(
                      children: [
                        Positioned.fill(
                          child: Ink(
                            decoration: BoxDecoration(
                              color: track,
                              borderRadius: radius,
                              border: Border.all(
                                color: edge,
                                width: GitPulseStroke.hairline,
                              ),
                            ),
                          ),
                        ),
                        Positioned(
                          left: inset + travel * crossed,
                          top: inset,
                          width: gitPulseSwitchThumb,
                          height: gitPulseSwitchThumb,
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              color: thumb,
                              shape: BoxShape.circle,
                            ),
                          ),
                        ),
                      ],
                    );
                  },
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The app's checkbox.
///
/// It replaces Material's (ADR 0032) and carries what that control carried: a
/// box drawn in the preset's tones, one hairline while it is clear and the
/// Accent while it is chosen, a check that draws itself in, a third state that
/// says neither, a disabled box that quiets and refuses, and a screen reader
/// told the role, the state — chosen, clear or mixed — and the name.
///
/// [dimension] is the square the box answers a finger in. It is a parameter rather
/// than a fixed measure because a box that stands at the end of a row is drawn
/// inside a row that is already the target: there, the row's own height decides,
/// and the box takes the room it has left instead of growing the row.
class GitPulseCheckbox extends StatelessWidget {
  const GitPulseCheckbox({
    super.key,
    required this.value,
    required this.onChanged,
    this.tristate = false,
    this.label,
    this.dimension = GitPulseHeight.standard,
  });

  /// Whether the box is chosen. Null is the mixed state, which only [tristate]
  /// allows.
  final bool? value;

  /// Runs with the value the reader asked for. Null is disabled.
  final ValueChanged<bool?>? onChanged;

  /// Whether a third state exists. Without it a null [value] draws as clear.
  final bool tristate;

  /// The box's spoken name, for a surface that prints no label beside it.
  final String? label;

  /// The square the box is operated in.
  final double dimension;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final enabled = onChanged != null;
    final chosen = value ?? false;
    final mixed = tristate && value == null;
    final box = GitPulseIconSize.inControl;
    final radius = BorderRadius.circular(GitPulseRadius.bar);
    final turn = MediaQuery.disableAnimationsOf(context)
        ? Duration.zero
        : gitPulseToggleTurn;

    return Semantics(
      checked: chosen,
      mixed: tristate ? mixed : null,
      enabled: enabled,
      label: label,
      child: Material(
        type: MaterialType.transparency,
        child: InkWell(
          onTap: enabled ? () => onChanged!(!chosen) : null,
          borderRadius: radius,
          overlayColor: gitPulseInkOverlay(scheme),
          child: SizedBox.square(
            dimension: dimension,
            child: Center(
              child: SizedBox.square(
                dimension: box,
                child: TweenAnimationBuilder<double>(
                  tween: Tween<double>(end: chosen ? 1 : 0),
                  duration: turn,
                  curve: Curves.easeOutCubic,
                  builder: (context, crossed, _) {
                    // A clear box is a boundary and no fill; a chosen one is the
                    // Accent, the mark that reads on it, and no boundary of its
                    // own; a box that cannot be operated keeps its shape in the
                    // palette's quietest steps.
                    final fill = !enabled
                        ? (chosen ? toneTextSubtle(context) : null)
                        : (crossed <= 0
                              ? null
                              : Color.lerp(
                                  GitPulsePaint.none,
                                  toneAccent(context),
                                  crossed,
                                ));
                    final edge = !enabled
                        ? toneBorder(context)
                        : (crossed >= 1
                              ? null
                              : Color.lerp(
                                  toneBorderStrong(context),
                                  GitPulsePaint.none,
                                  crossed,
                                ));
                    final mark = enabled
                        ? toneOnAccent(context)
                        : toneSurface(context);
                    return Stack(
                      children: [
                        Positioned.fill(
                          child: Ink(
                            decoration: BoxDecoration(
                              color: fill,
                              borderRadius: radius,
                              border: edge == null
                                  ? null
                                  : Border.all(
                                      color: edge,
                                      width: GitPulseStroke.hairline,
                                    ),
                            ),
                          ),
                        ),
                        Positioned.fill(
                          child: CustomPaint(
                            painter: _GitPulseMark(
                              progress: crossed,
                              color: mark,
                              mixed: mixed,
                            ),
                          ),
                        ),
                      ],
                    );
                  },
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The mark inside a [GitPulseCheckbox]: a check that draws itself in as the box
/// takes its fill, or the dash a mixed box states instead.
///
/// It is a path rather than a glyph, for the same reason the progress indicators
/// are drawn rather than skinned (ADR 0032): a mark the theme cannot reach is a
/// mark a framework upgrade can redraw.
class _GitPulseMark extends CustomPainter {
  const _GitPulseMark({
    required this.progress,
    required this.color,
    required this.mixed,
  });

  /// How much of the mark is drawn: nothing in a clear box, all of it in a
  /// chosen one.
  final double progress;

  final Color color;

  /// Whether the mark is the dash of a mixed box.
  final bool mixed;

  @override
  void paint(Canvas canvas, Size size) {
    if (progress <= 0) return;
    final paint = Paint()
      ..color = color
      ..strokeWidth = GitPulseStroke.toggleMark
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke;
    // The mark is authored in fractions of the box the face gave it, so a box
    // measured by a reader's type scale keeps a tick of the same proportions.
    final width = size.width;
    final height = size.height;
    final path = Path();
    if (mixed) {
      path
        ..moveTo(width * .28, height * .5)
        ..lineTo(width * .72, height * .5);
    } else {
      path
        ..moveTo(width * .24, height * .52)
        ..lineTo(width * .42, height * .68)
        ..lineTo(width * .76, height * .33);
    }
    if (progress >= 1) {
      canvas.drawPath(path, paint);
      return;
    }
    // A partial stroke is the mark on its way in: the tick is drawn as far as
    // the crossing has gone.
    final metric = path.computeMetrics().first;
    canvas.drawPath(metric.extractPath(0, metric.length * progress), paint);
  }

  @override
  bool shouldRepaint(_GitPulseMark old) =>
      old.progress != progress || old.color != color || old.mixed != mixed;
}
