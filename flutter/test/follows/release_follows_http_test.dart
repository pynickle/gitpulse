import 'dart:io';

import 'package:cookie_jar/cookie_jar.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/connection/connection_controller.dart';
import 'package:gitpulse/follows/release_follows_session.dart';
import 'package:gitpulse/session/session_controller.dart';
import 'package:gitpulse/session/gitpulse_http.dart';
import 'package:gitpulse/timeline/timeline_models.dart';

import '../release_timeline_http_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('native follow edits and independent web sessions share the real settings authority and keep accounts isolated', () async {
    FlutterSecureStorage.setMockInitialValues({});
    final overrides = HttpOverrides.current;
    HttpOverrides.global = null;
    addTearDown(() => HttpOverrides.global = overrides);
    final server = await TimelineHttpServer.start();
    final container = ProviderContainer();
    addTearDown(container.dispose);
    container.listen(sessionControllerProvider, (_, _) {});
    await container.read(connectionControllerProvider.future);
    final appHttp = container.read(connectionDioProvider);
    await appHttp.post<Object?>('${server.address}test/sign-in');
    await container
        .read(connectionControllerProvider.notifier)
        .connect(server.address.toString());
    await waitForSession(
      container,
      (state) => state.phase == SessionPhase.signedIn,
    );

    // A separate jar represents the browser, not the app's session cookie.
    final web = createGitPulseDio(CookieJar())
      ..options.baseUrl = server.address.toString();
    addTearDown(() => web.close(force: true));
    Future<void> webSignIn(String login) async {
      await web.post<Object?>('test/sign-in', data: {'login': login});
    }

    await webSignIn('octocat');
    await web.put<Object?>(
      'api/settings',
      data: {
        'navigation': {'linkTarget': 'github'},
        'releaseTimeline': {'showReactions': false},
        'followedRepositories': [
          {'id': 'R_web', 'owner': 'web', 'name': 'project'},
        ],
      },
    );
    final facade = container.read(releaseFollowsSessionProvider.notifier);
    await facade.reload();
    expect(
      container.read(releaseFollowsSessionProvider).repositories.single.id,
      'R_web',
    );
    await facade.follow(
      const TimelineRepository(
        id: 'R_native',
        owner: 'native',
        name: 'project',
      ),
    );
    var settings = (await web.get<Map<String, dynamic>>('api/settings')).data!;
    expect(
      (settings['followedRepositories'] as List).map(
        (item) => (item as Map)['id'],
      ),
      ['R_native', 'R_web'],
    );
    expect(settings['navigation'], {'linkTarget': 'github'});
    expect(settings['releaseTimeline'], {'showReactions': false});
    await facade.unfollow('R_web');
    settings = (await web.get<Map<String, dynamic>>('api/settings')).data!;
    expect(
      (settings['followedRepositories'] as List).map(
        (item) => (item as Map)['id'],
      ),
      ['R_native'],
    );
    await web.put<Object?>(
      'api/settings',
      data: {'followedRepositories': <Object?>[]},
    );
    await facade.reload();
    expect(container.read(releaseFollowsSessionProvider).repositories, isEmpty);

    await webSignIn('hubot');
    await web.put<Object?>(
      'api/settings',
      data: {
        'followedRepositories': [
          {'id': 'R_foreign', 'owner': 'hubot', 'name': 'private'},
        ],
      },
    );
    await facade.reload();
    expect(container.read(releaseFollowsSessionProvider).repositories, isEmpty);
    settings = (await web.get<Map<String, dynamic>>('api/settings')).data!;
    expect(
      (settings['followedRepositories'] as List).single['id'],
      'R_foreign',
    );
  });
}
