import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';

/// How fast a horizontal drag has to be thrown, in dp a second, to count as a
/// swipe rather than a hand that drifted while finding its place.
const gitPulseSwipeVelocity = 320.0;

/// Reports a deliberate sideways swipe over [child], and leaves every other
/// gesture — a tap, a list's scrolling, a selectable line's own dragging — to
/// the thing beneath it.
///
/// This is a shortcut, not a pager: nothing on screen moves and nothing is left
/// halfway. A page that travels under the finger needs a controller, a stack of
/// two pages and a place to come back from; this only says where a gesture the
/// reader already knows leads, so a reader who knows where they are going skips
/// the chrome (ADR 0039).
///
/// The gesture arena is what makes that possible: the recognizer claims the
/// arena from `isPointerAllowed` — the dispatch that happens as the finger lands,
/// before the tap's own recognizer has spoken — and gives it back the moment it
/// sees this is not the gesture that was meant. A finger that lifts without
/// moving, and a drag that is going up or down, are then wholly the surface's.
/// A selectable line beneath answers the drag itself, so the surface it stands
/// on catches no swipes; a header is therefore the place a shortcut belongs.
class GitPulseSwipe extends StatelessWidget {
  const GitPulseSwipe({
    super.key,
    required this.onSwipeLeft,
    this.onSwipeRight,
    required this.child,
  });

  /// Runs for a swipe thrown toward the left edge of the screen.
  final VoidCallback onSwipeLeft;

  /// Runs for a swipe thrown back toward the right edge, when the surface has
  /// somewhere to go that way.
  final VoidCallback? onSwipeRight;
  final Widget child;

  @override
  Widget build(BuildContext context) => RawGestureDetector(
    behavior: HitTestBehavior.opaque,
    gestures: {
      _SwipeGestureRecognizer:
          GestureRecognizerFactoryWithHandlers<_SwipeGestureRecognizer>(
            () => _SwipeGestureRecognizer(
              onSwipeLeft: onSwipeLeft,
              onSwipeRight: onSwipeRight,
            ),
            (recognizer) {
              recognizer.onSwipeLeft = onSwipeLeft;
              recognizer.onSwipeRight = onSwipeRight;
              recognizer.onStart = (details) => recognizer.begin();
              recognizer.onUpdate = (details) =>
                  recognizer.travel(details.delta);
              recognizer.onEnd = (details) =>
                  recognizer.report(details.velocity);
            },
          ),
    },
    child: child,
  );
}

/// A horizontal drag read as a direction once it is released.
///
/// It is the framework's own [HorizontalDragGestureRecognizer] in everything but
/// its timing in the arena, so a swipe is measured by the same slop and the same
/// velocity tracking as every other drag in the app.
class _SwipeGestureRecognizer extends HorizontalDragGestureRecognizer {
  _SwipeGestureRecognizer({this.onSwipeLeft, this.onSwipeRight});

  VoidCallback? onSwipeLeft;
  VoidCallback? onSwipeRight;

  /// Whether this recognizer is holding the arena and still deciding.
  ///
  /// A drag the framework already handed here — because nothing beneath wanted
  /// the gesture — is not given back: only a claim made here, before anyone else
  /// spoke, has to be released again.
  bool _holding = false;
  Offset _travel = Offset.zero;

  @override
  bool isPointerAllowed(PointerEvent event) {
    final allowed = super.isPointerAllowed(event);
    // The finger has landed and the arena is being filled: this recognizer
    // speaks before the tap's does, so the tap is not settled before it.
    if (allowed) {
      resolve(GestureDisposition.accepted);
      _holding = true;
    }
    return allowed;
  }

  @override
  void acceptGesture(int pointer) {
    _holding = false;
    super.acceptGesture(pointer);
  }

  @override
  void rejectGesture(int pointer) {
    _holding = false;
    super.rejectGesture(pointer);
  }

  /// The drag has started: this one now owns the moves that follow.
  void begin() {
    _holding = false;
    _travel = Offset.zero;
  }

  /// Reads a move while the recognizer is still deciding.
  ///
  /// A drag that is not going sideways belongs to the scroller, and this
  /// recognizer says so on the first frame that shows it. Nothing is resolved
  /// before the drag has moved, so a finger that lands and lifts is still wholly
  /// the tap's.
  void travel(Offset delta) {
    if (!_holding) return;
    _travel += delta;
    if (_travel.dy.abs() > _travel.dx.abs()) {
      _holding = false;
      resolve(GestureDisposition.rejected);
    }
  }

  /// Answers the release of a drag with the direction it was thrown in.
  ///
  /// Releasing without a throw is the finger giving the surface back: what it
  /// holds — a selectable line that was pressed, a row that was touched — is
  /// released to finish, or a tap under this recognizer could never land.
  ///
  /// The direction is read from the end's own velocity rather than from the
  /// last frame's, so a drag that stopped before it was released has thrown
  /// nothing anywhere and answers nothing.
  void report(Velocity velocity) {
    if (_holding) {
      _holding = false;
      resolve(GestureDisposition.rejected);
    }
    final horizontal = velocity.pixelsPerSecond.dx;
    if (horizontal <= -gitPulseSwipeVelocity) {
      onSwipeLeft?.call();
    } else if (horizontal >= gitPulseSwipeVelocity) {
      onSwipeRight?.call();
    }
  }
}
