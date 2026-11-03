import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/session/gitpulse_http.dart';
import 'package:gitpulse/session/session_controller.dart';
import 'package:gitpulse/timeline/timeline_filters.dart';
import 'package:gitpulse/timeline/timeline_projection.dart';
import 'package:gitpulse/timeline/timeline_reading_session.dart';
import 'package:gitpulse/timeline/timeline_session.dart';
import 'package:gitpulse/timeline/timeline_state.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test(
    'a landed round gives up the place and asks for the newest releases',
    () {
      final container = _container();
      final timeline = container.read(
        releaseTimelineSessionProvider.notifier,
      ) as _TimelineDriver;
      final reading = container.read(timelineReadingSessionProvider.notifier);
      reading.position.anchor = (releaseKey: 'alpha:7', offset: 120.0);

      reading.beginRefresh(pull: true);
      expect(
        container.read(timelineReadingSessionProvider).pullRefreshing,
        isTrue,
      );

      timeline.publish(
        const TimelineViewState(
          content: TimelineContentState(active: true, loading: true),
          projection: TimelineProjection.empty(),
        ),
      );
      expect(reading.position.anchor, (releaseKey: 'alpha:7', offset: 120.0));

      timeline.publish(
        const TimelineViewState(
          content: TimelineContentState(active: true),
          projection: TimelineProjection.empty(),
        ),
      );

      expect(reading.position.anchor, isNull);
      expect(container.read(timelineReadingSessionProvider), (
        pullRefreshing: false,
        landedRefreshes: 1,
      ));
    },
  );

  test('a failed round keeps the release being read where it was read', () {
    final container = _container();
    final timeline = container.read(
      releaseTimelineSessionProvider.notifier,
    ) as _TimelineDriver;
    final reading = container.read(timelineReadingSessionProvider.notifier);
    reading.position.anchor = (releaseKey: 'alpha:7', offset: 120.0);

    reading.beginRefresh(pull: false);
    timeline.publish(
      const TimelineViewState(
        content: TimelineContentState(active: true, loading: true),
        projection: TimelineProjection.empty(),
      ),
    );
    timeline.publish(
      const TimelineViewState(
        content: TimelineContentState(
          active: true,
          failure: TimelineFailure(TimelineFailureKind.network),
        ),
        projection: TimelineProjection.empty(),
      ),
    );

    expect(reading.position.anchor, (releaseKey: 'alpha:7', offset: 120.0));
    expect(container.read(timelineReadingSessionProvider), (
      pullRefreshing: false,
      landedRefreshes: 0,
    ));
  });

  test('another filter gives up the place without waiting for a refresh', () {
    final container = _container();
    final timeline = container.read(
      releaseTimelineSessionProvider.notifier,
    ) as _TimelineDriver;
    final reading = container.read(timelineReadingSessionProvider.notifier);
    reading.position.anchor = (releaseKey: 'alpha:7', offset: 120.0);

    timeline.publish(
      TimelineViewState(
        content: const TimelineContentState(active: true),
        projection: const TimelineProjection.empty().withFilters(
          const TimelineFilterState(query: 'v'),
        ),
      ),
    );

    expect(reading.position.anchor, isNull);
    expect(container.read(timelineReadingSessionProvider), (
      pullRefreshing: false,
      landedRefreshes: 0,
    ));
  });

  test('a round that never started leaves nothing waiting to settle', () {
    final container = _container();
    final timeline = container.read(
      releaseTimelineSessionProvider.notifier,
    ) as _TimelineDriver;
    final reading = container.read(timelineReadingSessionProvider.notifier);

    reading.beginRefresh(pull: true);
    reading.cancelRefresh();
    timeline.publish(
      const TimelineViewState(
        content: TimelineContentState(active: true),
        projection: TimelineProjection.empty(),
      ),
    );

    expect(reading.position.anchor, isNull);
    expect(container.read(timelineReadingSessionProvider), (
      pullRefreshing: false,
      landedRefreshes: 0,
    ));
  });

  test('another account starts at the top', () {
    final sessions = _SessionDriver();
    final container = ProviderContainer(
      overrides: [
        releaseTimelineSessionProvider.overrideWith(_TimelineDriver.new),
        sessionControllerProvider.overrideWith(() => sessions),
      ],
    );
    addTearDown(container.dispose);
    final reading = container.read(timelineReadingSessionProvider.notifier);
    reading.position.anchor = (releaseKey: 'alpha:7', offset: 120.0);
    reading.beginRefresh(pull: true);

    sessions.publish(
      SessionState(
        phase: SessionPhase.signedIn,
        identity: AuthenticatedIdentity(
          githubId: '1',
          backend: Uri.parse('https://gitpulse.example'),
          login: 'octo',
          name: 'Octo',
          avatarUrl: '',
        ),
      ),
    );

    // Reading the session is what rebuilds it for another account.
    final state = container.read(timelineReadingSessionProvider);
    expect(reading.position.anchor, isNull);
    expect(state, (pullRefreshing: false, landedRefreshes: 0));
  });
}

ProviderContainer _container() {
  final container = ProviderContainer(
    overrides: [
      releaseTimelineSessionProvider.overrideWith(_TimelineDriver.new),
    ],
  );
  addTearDown(container.dispose);
  return container;
}

/// A Release Timeline session that publishes exactly the rounds a test asks for.
class _TimelineDriver extends ReleaseTimelineSession {
  @override
  TimelineViewState build() => const TimelineViewState.inactive();

  void publish(TimelineViewState next) => state = next;
}

/// A session whose identity a test moves.
class _SessionDriver extends SessionController {
  @override
  SessionState build() => const SessionState();

  void publish(SessionState next) => state = next;
}
