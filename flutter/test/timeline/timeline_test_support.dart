import 'dart:async';
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/session/gitpulse_http.dart';
import 'package:gitpulse/session/session_controller.dart';
import 'package:gitpulse/timeline/timeline_models.dart';
import 'package:gitpulse/timeline/timeline_session.dart';
import 'package:gitpulse/timeline/timeline_state.dart';

/// A session whose HTTP boundary answers from the test's own handlers, so the
/// Timeline is driven through real requests without a network.
class FakeSessionController extends SessionController {
  FakeSessionController(this._initial);

  final SessionState _initial;
  final requests = <String>[];
  final handlers = <String, FutureOr<BackendResult> Function()>{};

  @override
  SessionState build() => _initial;

  @override
  Future<BackendResult> request({
    required String method,
    required String path,
    Object? body,
  }) async {
    final key = '$method $path';
    requests.add(key);
    final handler = handlers[key];
    if (handler == null) {
      return const BackendResult(
        statusCode: 404,
        problem: BackendProblem.unavailable,
      );
    }
    return await handler();
  }

  /// Moves the session, as a sign-out, rejection, or account switch would.
  void emit(SessionState next) => state = next;
}

AuthenticatedIdentity signedInIdentity({String login = 'octocat'}) =>
    AuthenticatedIdentity(
      backend: Uri.parse('https://gitpulse.example/'),
      login: login,
      name: login,
      avatarUrl: '',
    );

/// Groups by a fixed +08:00 display zone so grouping is deterministic.
String utcPlusEight(DateTime instant) {
  final local = instant.toUtc().add(const Duration(hours: 8));
  return '${local.year.toString().padLeft(4, '0')}-'
      '${local.month.toString().padLeft(2, '0')}-'
      '${local.day.toString().padLeft(2, '0')}';
}

Map<String, Object?> followJson(String id, String owner, String name) => {
  'id': id,
  'owner': owner,
  'name': name,
};

Map<String, Object?> settingsJson(List<Map<String, Object?>> follows) => {
  'version': 1,
  'followedRepositories': follows,
};

Map<String, Object?> releaseJson(
  int id,
  String tag,
  String publishedAt, {
  String? name,
  String? description,
  bool isDraft = false,
  bool isPrerelease = false,
  int assetCount = 0,
  String? htmlUrl,
}) => {
  'id': id,
  'tagName': tag,
  'name': name,
  'description': description,
  'publishedAt': publishedAt,
  'isDraft': isDraft,
  'isPrerelease': isPrerelease,
  'assetCount': assetCount,
  'htmlUrl': htmlUrl,
  'reactions': const <Object?>[],
};

Map<String, Object?> pageJson(
  String owner,
  String name,
  List<Map<String, Object?>> releases, {
  bool hasOlderReleases = false,
  String? endCursor,
  bool incomplete = false,
}) => {
  'status': 'available',
  'owner': owner,
  'name': name,
  'hasOlderReleases': hasOlderReleases,
  'endCursor': endCursor,
  'incomplete': incomplete,
  'releases': releases,
};

Map<String, Object?> transientPageJson() => {'status': 'transient'};

Map<String, Object?> unavailablePageJson() => {'status': 'unavailable'};

Map<String, Object?> roundJson({
  Map<String, Object?> pages = const {},
  Map<String, Object?>? refresh,
  String? persistenceError,
  List<String> unavailableIds = const [],
  List<String> transientIds = const [],
  List<Map<String, Object?>> groups = const [],
}) => {
  'pages': pages,
  'refresh': refresh,
  'persistenceError': persistenceError,
  'unavailableIds': unavailableIds,
  'transientIds': transientIds,
  'groups': groups,
};

String pageRequest(Map<String, String?> cursors) =>
    'GET ${Uri(path: 'api/release-timeline', queryParameters: {'cursors': jsonEncode(cursors)})}';

({ProviderContainer container, FakeSessionController session}) createHarness({
  String login = 'octocat',
}) {
  late FakeSessionController session;
  final container = ProviderContainer(
    overrides: [
      sessionControllerProvider.overrideWith(() {
        session = FakeSessionController(
          SessionState(
            phase: SessionPhase.signedIn,
            identity: signedInIdentity(login: login),
          ),
        );
        return session;
      }),
      timelineEnvironmentProvider.overrideWithValue(
        TimelineEnvironment(localDateKey: utcPlusEight),
      ),
    ],
  );
  addTearDown(container.dispose);
  // Mounting the session starts the first cycle, as the app does on sign-in;
  // the listener keeps it alive, as the mounted Timeline destination does.
  container.listen(releaseTimelineSessionProvider, (_, _) {});
  return (container: container, session: session);
}

TimelineViewState readState(ProviderContainer container) =>
    container.read(releaseTimelineSessionProvider);
