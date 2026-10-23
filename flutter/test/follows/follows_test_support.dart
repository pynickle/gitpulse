import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';

import '../session_flow_test.dart';
import '../timeline/timeline_test_support.dart';

/// Controlled Nitro HTTP responses, with the real client Cookie/CSRF session.
class FollowsServer extends AuthServer {
  final settings = <String, Object?>{
    ...settingsJson([]),
    'fonts': {'appFont': 'system'},
    'releaseTimeline': {'showReactions': false},
  };
  final featureRequests = <RecordedRequest>[];
  List<Map<String, Object?>> repositories = [repositoryJson()];
  List<Map<String, Object?>> starredRepositories = [];
  Map<String, Object?> metadata = {};
  Map<String, Object?> pages = {};
  int saveStatus = 200;
  bool malformedSave = false;
  int searchStatus = 200;
  int starredStatus = 200;
  int metadataStatus = 200;
  bool searchHasMore = false;
  bool starredHasMore = false;
  Future<void>? holdSearch;
  Future<void>? holdStarred;
  Future<void>? holdSave;
  Future<void>? holdRound;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    final path = options.uri.path;
    if (!path.endsWith('/api/settings') &&
        !path.endsWith('/api/starred') &&
        !path.contains('/api/search/') &&
        !path.contains('/api/repos/') &&
        !path.contains('/api/release-follows/') &&
        !path.contains('/api/release-timeline')) {
      return super.fetch(options, requestStream, cancelFuture);
    }
    final bytes = await requestStream?.expand((chunk) => chunk).toList();
    final body = bytes == null ? '' : utf8.decode(bytes);
    featureRequests.add(
      RecordedRequest(
        method: options.method,
        uri: options.uri,
        headers: options.headers.map(
          (key, value) => MapEntry(key.toLowerCase(), '$value'),
        ),
        body: body,
      ),
    );
    if (options.method != 'GET' && options.headers['x-csrf-token'] != csrf) {
      return json(403, {'statusMessage': 'csrf_mismatch'});
    }
    if (path.endsWith('/api/settings')) {
      if (options.method == 'PUT') {
        if (holdSave != null) await holdSave;
        if (malformedSave) return json(200, {});
        if (saveStatus != 200) {
          return json(saveStatus, {'statusMessage': 'Save failed'});
        }
        settings.addAll(jsonDecode(body) as Map<String, dynamic>);
      }
      return json(200, {...settings});
    }
    if (path.contains('/api/search/')) {
      final result = List.of(repositories);
      if (holdSearch != null) await holdSearch;
      return json(searchStatus, {
        'items': result,
        'pagination': {'hasNext': searchHasMore},
      });
    }
    if (path.endsWith('/api/starred')) {
      final result = List.of(starredRepositories);
      if (holdStarred != null) await holdStarred;
      return json(starredStatus, {
        'items': result,
        'pagination': {'hasNext': starredHasMore},
      });
    }
    if (path.contains('/api/repos/')) {
      return repositories.isEmpty
          ? json(404, {'statusMessage': 'Not Found'})
          : json(searchStatus, repositories.first);
    }
    if (path.contains('/api/release-follows/')) {
      return json(metadataStatus, {
        'repositories': {
          for (final follow in settings['followedRepositories'] as List)
            (follow as Map)['id']:
                metadata[follow['id']] ??
                {
                  'status': 'available',
                  'owner': follow['owner'],
                  'name': follow['name'],
                },
        },
        'renamed': false,
      });
    }
    final result = roundJson(pages: Map.of(pages));
    if (holdRound != null) await holdRound;
    return json(200, result);
  }

  ResponseBody json(int status, Object? payload) => ResponseBody.fromString(
    jsonEncode(payload),
    status,
    headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    },
  );
}

Map<String, Object?> repositoryJson({
  String id = 'R_alpha',
  String owner = 'octo',
  String name = 'alpha',
}) => {
  'id': 123,
  'node_id': id,
  'owner': {'login': owner},
  'name': name,
  'description': 'A project for release followers',
  'default_branch': 'main',
  'forks_count': 7,
  'stargazers_count': 42,
};
