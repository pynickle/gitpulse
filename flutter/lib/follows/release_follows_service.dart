import '../session/gitpulse_http.dart';
import '../timeline/timeline_dto.dart';
import '../timeline/timeline_models.dart';
import 'release_follows_dto.dart';
import 'release_follows_state.dart';

typedef FollowRequest = Future<BackendResult> Function({
  required String method,
  required String path,
  Object? body,
});

class FollowRequestFailure implements Exception {
  const FollowRequestFailure(this.problem);

  final FollowProblem problem;
}

class ReleaseFollowsService {
  const ReleaseFollowsService(this._request);

  final FollowRequest _request;

  Future<T> _read<T>(
    String method,
    String path,
    T Function(Map<String, dynamic>) parse, {
    Object? body,
  }) async {
    final response = await _request(method: method, path: path, body: body);
    if (response.cancelled || response.problem != null) {
      throw FollowRequestFailure(switch (response.problem) {
        BackendProblem.network => FollowProblem.network,
        BackendProblem.rateLimited => FollowProblem.rateLimited,
        BackendProblem.cancelled => FollowProblem.cancelled,
        _ =>
          response.statusCode == 404
              ? FollowProblem.notFound
              : FollowProblem.server,
      });
    }
    try {
      return parse(response.data as Map<String, dynamic>);
    } catch (_) {
      throw const FollowRequestFailure(FollowProblem.invalidResponse);
    }
  }

  Future<List<TimelineRepository>> readFollows() =>
      _read('GET', 'api/settings', _parseFollows);

  Future<List<TimelineRepository>> saveFollows(
    List<TimelineRepository> repositories,
  ) => _read(
    'PUT',
    'api/settings',
    (json) {
      final saved = _parseFollows(json);
      final expected = repositories.map((repo) => repo.id).toSet();
      if (saved.length != expected.length ||
          saved.any((repo) => !expected.contains(repo.id))) {
        throw const FormatException(
          'The backend did not confirm the requested follow set',
        );
      }
      return saved;
    },
    body: {
      'followedRepositories': [
        for (final repo in repositories)
          {'id': repo.id, 'owner': repo.owner, 'name': repo.name},
      ],
    },
  );

  List<TimelineRepository> _parseFollows(Map<String, dynamic> json) {
    if (json['followedRepositories'] is! List) {
      throw const FormatException('Missing followedRepositories');
    }
    return mapFollowedRepositories(UserSettingsDto.fromJson(json));
  }

  Future<FollowMetadataResponseDto> readMetadata(
    List<TimelineRepository> repositories,
  ) => _read(
    'POST',
    'api/release-follows/metadata',
    FollowMetadataResponseDto.fromJson,
    body: {
      'repositories': [
        for (final repo in repositories)
          {'id': repo.id, 'owner': repo.owner, 'name': repo.name},
      ],
    },
  );

  Future<RepositorySearchDto> search(String query, int page) async {
    final url =
        query.contains('://') ||
        query.startsWith('github.com/') ||
        query.startsWith('www.github.com/');
    if (url) {
      final uri = Uri.tryParse(
        query.contains('://') ? query : 'https://$query',
      );
      final segments =
          uri?.pathSegments.where((part) => part.isNotEmpty).toList() ?? [];
      final owner = segments.isNotEmpty ? segments.first : '';
      var name = segments.length == 2 ? segments.last : '';
      if (name.endsWith('.git')) name = name.substring(0, name.length - 4);
      if (uri == null ||
          !{'http', 'https'}.contains(uri.scheme) ||
          !{'github.com', 'www.github.com'}.contains(uri.host.toLowerCase()) ||
          uri.userInfo.isNotEmpty ||
          uri.hasPort ||
          segments.length != 2 ||
          !validRepositoryName(owner, name)) {
        throw const FollowRequestFailure(FollowProblem.invalidRepository);
      }
      final repository = await _read(
        'GET',
        'api/repos/${Uri.encodeComponent(owner)}/${Uri.encodeComponent(name)}',
        RepositoryCandidateDto.fromJson,
      );
      return RepositorySearchDto(items: [repository]);
    }
    return _read(
      'GET',
      Uri(
        path: 'api/search/repositories',
        queryParameters: {'q': query, 'page': '$page', 'per_page': '30'},
      ).toString(),
      RepositorySearchDto.fromJson,
    );
  }
}

bool validRepositoryName(String owner, String name) =>
    owner.length <= 100 &&
    name.length <= 100 &&
    RegExp(r'^[a-zA-Z0-9][a-zA-Z0-9-]*$').hasMatch(owner) &&
    RegExp(r'^[a-zA-Z0-9_.-]+$').hasMatch(name) &&
    name != '.' &&
    name != '..';
