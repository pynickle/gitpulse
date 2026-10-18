import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/releases/release_detail_service.dart';
import 'package:gitpulse/session/gitpulse_http.dart';

Map<String, Object?> releaseDetailJson({int id = 42, String tag = 'v2/rc'}) => {
  'id': id,
  'tag_name': tag,
  'name': null,
  'body': null,
  'published_at': null,
  'created_at': '2026-10-17T12:00:00Z',
  'html_url': 'https://github.com/canonical/project/releases/tag/v2/rc',
  'target_commitish': 'main',
  'draft': false,
  'prerelease': true,
  'author': null,
  'assets': [
    {
      'id': 12,
      'name': 'app.zip',
      'label': null,
      'size': 2048,
      'download_count': 7,
      'content_type': 'application/zip',
      'browser_download_url':
          'https://github.com/canonical/project/releases/download/v2/app.zip',
    },
  ],
};

void main() {
  test(
    'rejects a malformed numeric release identity instead of truncating it',
    () async {
      final service = ReleaseDetailService(
        ({required method, required path}) async => BackendResult(
          statusCode: 200,
          data: {...releaseDetailJson(), 'id': 42.5},
        ),
      );
      expect(
        (await service.load((
          owner: 'octo',
          repository: 'app',
          id: 42,
          tag: null,
        ))).failure,
        ReleaseDetailFailure.invalidResponse,
      );
    },
  );

  test('keeps missing releases, transport errors, rate limits and invalid payloads distinct', () async {
    for (final (response, expected) in [
      (
        const BackendResult(
          statusCode: 404,
          problem: BackendProblem.unavailable,
        ),
        ReleaseDetailFailure.unavailable,
      ),
      (
        const BackendResult(problem: BackendProblem.network),
        ReleaseDetailFailure.network,
      ),
      (
        const BackendResult(
          statusCode: 429,
          problem: BackendProblem.rateLimited,
        ),
        ReleaseDetailFailure.rateLimited,
      ),
      (
        const BackendResult(
          statusCode: 401,
          problem: BackendProblem.authenticationRejected,
        ),
        ReleaseDetailFailure.session,
      ),
      (const BackendResult(cancelled: true), ReleaseDetailFailure.cancelled),
      (
        BackendResult(statusCode: 200, data: releaseDetailJson(id: 99)),
        ReleaseDetailFailure.invalidResponse,
      ),
      (
        const BackendResult(statusCode: 200, data: null),
        ReleaseDetailFailure.invalidResponse,
      ),
    ]) {
      final service = ReleaseDetailService(
        ({required method, required path}) async => response,
      );
      expect(
        (await service.load((
          owner: 'octo',
          repository: 'app',
          id: 42,
          tag: null,
        ))).failure,
        expected,
      );
    }
  });

  test(
    'rejects invalid navigation identities without sending a request',
    () async {
      final requests = <String>[];
      final service = ReleaseDetailService(({
        required method,
        required path,
      }) async {
        requests.add(path);
        return BackendResult(statusCode: 200, data: releaseDetailJson());
      });
      for (final target in <ReleaseTarget>[
        (owner: '..', repository: 'project', id: 42, tag: null),
        (owner: 'octo', repository: 'project', id: 0, tag: null),
        (owner: 'octo', repository: 'project', id: null, tag: null),
      ]) {
        expect(
          (await service.load(target)).failure,
          ReleaseDetailFailure.invalidResponse,
        );
      }
      expect(requests, isEmpty);
    },
  );

  test('reads a REST release identity over HTTP and accepts nullable GitHub fields', () async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    addTearDown(() => server.close(force: true));
    final paths = <String>[];
    server.listen((request) async {
      paths.add(request.uri.toString());
      request.response.headers.contentType = ContentType.json;
      request.response.write(jsonEncode(releaseDetailJson()));
      await request.response.close();
    });
    final dio = Dio(
      BaseOptions(baseUrl: 'http://127.0.0.1:${server.port}/pulse/'),
    );
    addTearDown(dio.close);
    final service = ReleaseDetailService(({
      required method,
      required path,
    }) async {
      try {
        return resultFromResponse(
          await dio.request<Object?>(path, options: Options(method: method)),
        );
      } on DioException catch (error) {
        return resultFromDio(error);
      }
    });

    final result = await service.load((
      owner: 'old-owner',
      repository: 'old-name',
      id: 42,
      tag: null,
    ));
    expect(paths, ['/pulse/api/releases/old-owner/old-name/42']);
    final release = result.release!;
    expect(release.id, 42);
    expect(release.title, 'v2/rc');
    expect(release.body, '');
    expect(release.publishedAt, isNull);
    expect(release.owner, 'canonical');
    expect(release.repository, 'project');
    expect(release.assets.single.size, 2048);
    expect(release.assets.single.downloadCount, 7);
    final byTag = await service.load((
      owner: 'canonical',
      repository: 'project',
      id: null,
      tag: 'v2/rc',
    ));
    expect(byTag.release?.id, 42);
    expect(
      paths.last,
      '/pulse/api/releases/canonical/project/by-tag?tag=v2%2Frc',
    );
  });
}
