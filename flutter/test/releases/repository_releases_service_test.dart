import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/releases/repository_releases_service.dart';
import 'package:gitpulse/session/gitpulse_http.dart';

Map<String, Object?> listReleaseJson(
  int id,
  String tag, {
  bool draft = false,
  bool prerelease = false,
}) => {
  'id': id,
  'tag_name': tag,
  'name': null,
  'published_at': null,
  'created_at': '2026-10-17T12:00:00Z',
  'draft': draft,
  'prerelease': prerelease,
  'author': null,
  'assets_count': 2,
  'download_count': 7,
};

Map<String, Object?> releaseListJson(
  List<Map<String, Object?>> items, {
  int page = 1,
  bool hasNext = false,
}) => {
  'items': items,
  'pagination': {
    'page': page,
    'perPage': 20,
    'hasPrev': page > 1,
    'hasNext': hasNext,
    'totalCount': null,
    'totalPages': null,
  },
};

void main() {
  test(
    'uses backend pagination flags even for an empty or normalized page',
    () async {
      final service = RepositoryReleasesService(
        ({required method, required path}) async => BackendResult(
          statusCode: 200,
          data: {
            'items': <Object?>[],
            'pagination': {
              'page': 2,
              'perPage': 20,
              'hasPrev': false,
              'hasNext': true,
            },
          },
        ),
      );
      final result = await service.load(
        owner: 'octo',
        repository: 'app',
        page: 3,
      );
      expect(result.failure, isNull);
      expect(result.page!.pagination.page, 2);
      expect(result.page!.pagination.hasPrev, isFalse);
      expect(result.page!.pagination.hasNext, isTrue);
    },
  );

  test('distinguishes permissions, session rejection, unavailable repositories and retryable failures', () async {
    for (final (response, failure) in [
      (
        const BackendResult(
          statusCode: 403,
          problem: BackendProblem.repositoryPermission,
        ),
        RepositoryReleasesFailure.permission,
      ),
      (
        const BackendResult(
          statusCode: 401,
          problem: BackendProblem.authenticationRejected,
        ),
        RepositoryReleasesFailure.session,
      ),
      (
        const BackendResult(
          statusCode: 404,
          problem: BackendProblem.unavailable,
        ),
        RepositoryReleasesFailure.unavailable,
      ),
      (
        const BackendResult(problem: BackendProblem.network),
        RepositoryReleasesFailure.network,
      ),
      (
        const BackendResult(
          statusCode: 429,
          problem: BackendProblem.rateLimited,
        ),
        RepositoryReleasesFailure.rateLimited,
      ),
      (const BackendResult(statusCode: 503), RepositoryReleasesFailure.server),
      (
        const BackendResult(cancelled: true),
        RepositoryReleasesFailure.cancelled,
      ),
      (
        const BackendResult(statusCode: 200, data: null),
        RepositoryReleasesFailure.invalidResponse,
      ),
      (
        BackendResult(
          statusCode: 200,
          data: releaseListJson([
            {...listReleaseJson(42, 'v2'), 'id': 42.5},
          ]),
        ),
        RepositoryReleasesFailure.invalidResponse,
      ),
      (
        BackendResult(statusCode: 200, data: releaseListJson([], page: 2)),
        RepositoryReleasesFailure.invalidResponse,
      ),
    ]) {
      final service = RepositoryReleasesService(
        ({required method, required path}) async => response,
      );
      expect(
        (await service.load(owner: 'octo', repository: 'app')).failure,
        failure,
      );
    }
  });

  test(
    'invalid repository addresses and page numbers never reach the backend',
    () async {
      final requests = <String>[];
      final service = RepositoryReleasesService(({
        required method,
        required path,
      }) async {
        requests.add(path);
        return const BackendResult(statusCode: 500);
      });
      for (final (owner, repository, page) in [
        ('octo', '..', 1),
        ('..', 'app', 1),
        ('octo', 'app', 0),
      ]) {
        expect(
          (await service.load(
            owner: owner,
            repository: repository,
            page: page,
          )).failure,
          RepositoryReleasesFailure.invalidResponse,
        );
      }
      expect(requests, isEmpty);
    },
  );

  test(
    'loads an explicit repository page over HTTP including nullable drafts',
    () async {
      final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      addTearDown(() => server.close(force: true));
      final paths = <String>[];
      server.listen((request) async {
        paths.add(request.uri.toString());
        request.response.headers.contentType = ContentType.json;
        request.response.write(
          jsonEncode(
            releaseListJson(
              [listReleaseJson(42, 'v2', draft: true)],
              page: 2,
              hasNext: true,
            ),
          ),
        );
        await request.response.close();
      });
      final dio = Dio(
        BaseOptions(baseUrl: 'http://127.0.0.1:${server.port}/pulse/'),
      );
      addTearDown(dio.close);
      final service = RepositoryReleasesService(({
        required method,
        required path,
      }) async {
        return resultFromResponse(
          await dio.request<Object?>(path, options: Options(method: method)),
        );
      });
      final result = await service.load(
        owner: 'octo',
        repository: 'app',
        page: 2,
      );
      expect(paths, ['/pulse/api/releases/octo/app?page=2&per_page=20']);
      expect(result.failure, isNull);
      expect(result.page!.pagination.hasNext, isTrue);
      expect(result.page!.pagination.hasPrev, isTrue);
      final release = result.page!.items.single;
      expect(release.id, 42);
      expect(release.name, isNull);
      expect(release.publishedAt, isNull);
      expect(release.draft, isTrue);
      expect(release.assetsCount, 2);
      expect(release.downloadCount, 7);
    },
  );
}
