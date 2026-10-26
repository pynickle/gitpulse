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
  final _requestEvents = StreamController<RecordedRequest>.broadcast();

  /// Arm before starting an operation; the signal arrives after its request body
  /// has been read. Held responses snapshot their payload before waiting, so a
  /// later fixture edit cannot accidentally turn an old response into a new one.
  Future<RecordedRequest> nextRequest(String method, String path) =>
      _requestEvents.stream
          .firstWhere(
            (request) =>
                request.method == method && request.uri.path.endsWith(path),
          )
          .timeout(const Duration(seconds: 5));

  List<Map<String, Object?>> repositories = [repositoryJson()];
  List<Map<String, Object?>> starredRepositories = [];
  Map<String, Object?> metadata = {};
  Map<String, Object?> pages = {};

  /// The round's refresh bookmark, which carries the account's shared Timeline
  /// Refresh Baseline into the client.
  Map<String, Object?>? refresh;
  int saveStatus = 200;
  bool malformedSave = false;
  int searchStatus = 200;
  int starredStatus = 200;
  int metadataStatus = 200;
  int settingsStatus = 200;
  int roundStatus = 200;
  bool searchHasMore = false;
  bool starredHasMore = false;
  Future<void>? holdSearch;
  Future<void>? holdStarred;
  Future<void>? holdSave;
  Future<void>? holdRound;
  Future<void>? holdSettings;
  Future<void>? holdMetadata;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    final path = options.uri.path;
    if (offline) return super.fetch(options, requestStream, cancelFuture);
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
    _requestEvents.add(featureRequests.last);
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
      } else {
        final result = json(settingsStatus, {...settings});
        if (holdSettings != null) await holdSettings;
        return result;
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
      if (metadataStatus != 200) {
        return json(metadataStatus, {'statusMessage': 'metadata failed'});
      }
      final follows = [
        for (final follow in settings['followedRepositories']! as List)
          Map<String, Object?>.from(follow as Map),
      ];
      final repositories = <String, Object?>{};
      final updated = <Map<String, Object?>>[];
      var renamed = false;
      for (final follow in follows) {
        final id = follow['id']! as String;
        final stored = metadata[id];
        final meta = stored is Map
            ? Map<String, Object?>.from(stored)
            : {
                'status': 'available',
                'owner': follow['owner'],
                'name': follow['name'],
              };
        repositories[id] = meta;
        final owner = meta['owner'];
        final name = meta['name'];
        if (meta['status'] == 'available' &&
            owner is String &&
            name is String) {
          if (owner != follow['owner'] || name != follow['name']) {
            renamed = true;
          }
          updated.add({'id': id, 'owner': owner, 'name': name});
        } else {
          updated.add(follow);
        }
      }
      if (renamed) settings['followedRepositories'] = updated;
      final result = json(metadataStatus, {
        'repositories': repositories,
        'renamed': renamed,
      });
      if (holdMetadata != null) await holdMetadata;
      return result;
    }
    final result = roundJson(pages: Map.of(pages), refresh: refresh);
    if (holdRound != null) await holdRound;
    return json(roundStatus, result);
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
  String? description = 'A project for release followers',
  String? language = 'Python',
  int stars = 42,
}) => {
  'id': 123,
  'node_id': id,
  'owner': {'login': owner},
  'name': name,
  'description': ?description,
  'language': ?language,
  'default_branch': 'main',
  'forks_count': 7,
  'stargazers_count': stars,
};
