import 'dart:convert';
import 'dart:io';

import 'package:cookie_jar/cookie_jar.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/connection/connection_controller.dart';
import 'package:gitpulse/follows/release_follows_session.dart';
import 'package:gitpulse/follows/release_follows_service.dart';
import 'package:gitpulse/follows/release_follows_state.dart';
import 'package:gitpulse/session/session_controller.dart';
import 'package:gitpulse/session/gitpulse_http.dart';

import '../support/release_timeline_server.dart';
import '../support/provider_wait.dart';
import 'follows_test_support.dart';

import 'package:gitpulse/repositories/repository_models.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('discovery HTTP requests retain the existing pagination contract and URL lookup stays unpaginated', () async {
    final overrides = HttpOverrides.current;
    HttpOverrides.global = null;
    addTearDown(() => HttpOverrides.global = overrides);
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    addTearDown(() => server.close(force: true));
    final requests = <Uri>[];
    server.listen((request) async {
      requests.add(request.uri);
      final query = request.uri.queryParameters;
      final page = int.parse(query['page'] ?? '1');
      final unknown = query['q'] == 'unknown';
      request.response.headers.contentType = ContentType.json;
      request.response.write(
        jsonEncode(
          request.uri.path.contains('/repos/')
              ? repositoryJson()
              : {
                  'items': [repositoryJson()],
                  'pagination': {
                    'page': page,
                    'perPage': 30,
                    'hasPrev': page > 1,
                    'hasNext': unknown || page < 12,
                    'totalCount': unknown ? null : 360,
                    'totalPages': unknown ? null : 12,
                  },
                },
        ),
      );
      await request.response.close();
    });
    final http = createGitPulseDio(CookieJar())
      ..options.baseUrl = 'http://127.0.0.1:${server.port}/pulse/';
    addTearDown(() => http.close(force: true));
    final service = ReleaseFollowsService(({
      required method,
      required path,
      body,
    }) async {
      expect(method, 'GET');
      final response = await http.get<Map<String, dynamic>>(path);
      return BackendResult(
        statusCode: response.statusCode,
        data: response.data,
      );
    });
    final starred = await service.starred(
      7,
      sort: StarredRepositorySort.updated,
      ascending: true,
    );
    expect(requests.last.path, '/pulse/api/starred');
    expect(requests.last.queryParameters, {
      'page': '7',
      'per_page': '30',
      'sort': 'updated',
      'direction': 'asc',
    });
    final pagination = starred.pagination!;
    expect(pagination.page, 7);
    expect(pagination.perPage, 30);
    expect(pagination.hasPrev, isTrue);
    expect(pagination.hasNext, isTrue);
    expect(pagination.totalCount, 360);
    expect(pagination.totalPages, 12);
    final search = await service.search('flutter & dart', 4);
    expect(requests.last.path, '/pulse/api/search/repositories');
    expect(requests.last.queryParameters, {
      'q': 'flutter & dart',
      'page': '4',
      'per_page': '30',
    });
    expect(search.pagination!.page, 4);
    final unknown = await service.search('unknown', 2);
    expect(unknown.pagination!.totalPages, isNull);
    expect(unknown.pagination!.totalCount, isNull);
    expect(unknown.pagination!.hasNext, isTrue);
    final repository = await service.search('https://github.com/octo/alpha', 1);
    expect(requests.last.path, '/pulse/api/repos/octo/alpha');
    expect(requests.last.hasQuery, isFalse);
    expect(repository.pagination, isNull);
    expect(repository.items.single.repository.fullName, 'octo/alpha');
  });

  test('native follow edits and independent web sessions share the real settings authority and keep accounts isolated', () async {
    FlutterSecureStorage.setMockInitialValues({});
    final overrides = HttpOverrides.current;
    HttpOverrides.global = null;
    addTearDown(() => HttpOverrides.global = overrides);
    final server = await TimelineHttpServer.start();
    addTearDown(server.close);
    await const FlutterSecureStorage().write(
      key: 'last_successful_backend',
      value: server.address.toString(),
    );
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
      const RepositoryReference(
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
