import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../session/session_controller.dart';
import 'timeline_filters.dart';
import 'timeline_session.dart';
import 'timeline_state.dart';

/// Where the reader is in the Release Timeline.
///
/// Silent by design: the list reports the release being read on a scroll frame,
/// and a notification per frame would rebuild the list it is measuring.
class TimelineReadingPosition {
  ({String releaseKey, double offset})? anchor;
}

/// The reader's place in the Release Timeline, and the refresh that moves it.
///
/// It outlives the destination widget, which the shell builds only while its
/// destination is selected, so a round that lands while another destination is
/// on screen still returns the reader to the top when they come back. Its
/// listener therefore lives in this provider and never in the widget: a widget's
/// listener would never fire for a landing that happened while it was gone, and
/// the round would never settle.
final timelineReadingSessionProvider =
    NotifierProvider<TimelineReadingSession, TimelineRefreshProgress>(
      TimelineReadingSession.new,
    );

/// What the destination must re-render for while a round is reading, and
/// nothing else.
///
/// The place the reader stopped at is not here: it changes on every scroll
/// frame and is held silently on the session instead.
typedef TimelineRefreshProgress = ({bool pullRefreshing, int landedRefreshes});

class TimelineReadingSession extends Notifier<TimelineRefreshProgress> {
  /// The place the list reads and writes; it publishes nothing.
  final TimelineReadingPosition position = TimelineReadingPosition();

  /// Whether a round this session began is still being read.
  bool _reading = false;

  @override
  TimelineRefreshProgress build() {
    // The place belongs to one Account Identity, so another account never
    // restores this one's position.
    ref.watch(
      sessionControllerProvider.select(
        (state) => (state.phase, state.identity?.account),
      ),
    );
    _reading = false;
    position.anchor = null;
    // The landed count restarts with this session: the list compares it within
    // one account's timeline, and another account's list starts at its top.
    ref.listen(releaseTimelineSessionProvider, _onTimelineChanged);
    ref.listen(
      releaseTimelineSessionProvider.select((state) => state.filters),
      _onFiltersChanged,
    );
    return (pullRefreshing: false, landedRefreshes: 0);
  }

  /// Marks the round the reader asked for, before it starts.
  ///
  /// The pull gesture announces itself at the top of the list, so the button
  /// keeps its glyph while staying disabled.
  void beginRefresh({required bool pull}) {
    _reading = true;
    state = (pullRefreshing: pull, landedRefreshes: state.landedRefreshes);
  }

  /// Forgets a begin that started no round, so nothing waits to settle it.
  void cancelRefresh() {
    _reading = false;
    state = (pullRefreshing: false, landedRefreshes: state.landedRefreshes);
  }

  /// Ends a refresh that has stopped loading.
  ///
  /// Usable results replace the window from the top of the current search and
  /// filters, so the place being read is given up and the list presents the
  /// newest releases. A round that completely failed keeps the release being
  /// read, and the position it was read at, so a slow or failed request never
  /// costs the reader their place.
  void _onTimelineChanged(TimelineViewState? previous, TimelineViewState next) {
    if (!_reading || next.loading) return;
    _reading = false;
    final landed = next.failure == null;
    if (landed) clearReadingPosition();
    state = (
      pullRefreshing: false,
      landedRefreshes: landed
          ? state.landedRefreshes + 1
          : state.landedRefreshes,
    );
  }

  /// Forgets where the reader stopped, so the next list starts at its top.
  void clearReadingPosition() => position.anchor = null;

  /// Another Active Timeline Filter or Release Timeline Search presents another
  /// list, so an offset into the previous result no longer means anything.
  void _onFiltersChanged(TimelineFilterState? _, TimelineFilterState _) =>
      clearReadingPosition();
}
