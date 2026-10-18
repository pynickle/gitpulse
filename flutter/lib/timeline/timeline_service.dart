import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../session/gitpulse_http.dart';
import '../session/session_controller.dart';
import 'timeline_dto.dart';
import 'timeline_models.dart';
import 'timeline_state.dart';

/// The HTTP seam the Release Timeline reads through.
///
/// The app implements it with the signed-in session, so an explicit session
/// rejection, cancellation, and CSRF behave like every other native request.
abstract class TimelineTransport {
  Future<BackendResult> send({required String method, required String path});
}

class SessionTimelineTransport implements TimelineTransport {
  const SessionTimelineTransport(this._ref);

  final Ref _ref;

  @override
  Future<BackendResult> send({required String method, required String path}) {
    // The Timeline session may be disposed while a round is in flight, which
    // also disposes its transport. Report the round as cancelled instead of
    // throwing, so the superseded result is simply dropped.
    if (!_ref.mounted) {
      return Future<BackendResult>.value(
        const BackendResult(cancelled: true, problem: BackendProblem.cancelled),
      );
    }
    return _ref
        .read(sessionControllerProvider.notifier)
        .request(method: method, path: path);
  }
}

class TimelineResult<T> {
  const TimelineResult.data(T this.data) : failure = null;

  const TimelineResult.failed(TimelineFailure this.failure) : data = null;

  final T? data;
  final TimelineFailure? failure;
}

/// Reads the account's Release Follows and one coordinated timeline round.
class ReleaseTimelineService {
  const ReleaseTimelineService(this._transport);

  static const settingsPath = 'api/settings';
  static const refreshPath = 'api/release-timeline/refresh';

  final TimelineTransport _transport;

  Future<TimelineResult<List<TimelineRepository>>>
  readFollowedRepositories() async {
    final response = await _read('GET', settingsPath, UserSettingsDto.fromJson);
    final settings = response.data;
    if (settings == null) {
      return TimelineResult.failed(response.failure!);
    }
    return TimelineResult.data(mapFollowedRepositories(settings));
  }

  /// A refresh restarts pagination for every Followed Repository and can
  /// advance the account's shared Timeline Refresh Baseline.
  Future<TimelineResult<TimelineRoundDto>> refresh() {
    return _read('POST', refreshPath, TimelineRoundDto.fromJson);
  }

  Future<TimelineResult<T>> _read<T>(
    String method,
    String path,
    T Function(Map<String, dynamic> json) parse,
  ) async {
    final result = await _transport.send(method: method, path: path);
    final failure = _failureOf(result);
    if (failure != null) return TimelineResult.failed(failure);
    final payload = result.data;
    if (payload is! Map<String, dynamic>) {
      return const TimelineResult.failed(
        TimelineFailure(TimelineFailureKind.invalidResponse),
      );
    }
    try {
      return TimelineResult.data(parse(payload));
    } catch (_) {
      return const TimelineResult.failed(
        TimelineFailure(TimelineFailureKind.invalidResponse),
      );
    }
  }

  TimelineFailure? _failureOf(BackendResult result) {
    if (result.cancelled) {
      return const TimelineFailure(TimelineFailureKind.cancelled);
    }
    final problem = result.problem;
    if (problem == null) return null;
    return TimelineFailure(switch (problem) {
      BackendProblem.network => TimelineFailureKind.network,
      BackendProblem.rateLimited => TimelineFailureKind.rateLimited,
      BackendProblem.authenticationRejected => TimelineFailureKind.session,
      _ => TimelineFailureKind.server,
    });
  }
}
