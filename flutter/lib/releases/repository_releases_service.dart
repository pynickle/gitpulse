import '../session/gitpulse_http.dart';
import 'release_detail_service.dart';
import 'repository_releases_dto.dart';

enum RepositoryReleasesFailure {
  unavailable,
  permission,
  network,
  rateLimited,
  session,
  invalidResponse,
  server,
  cancelled,
}

class RepositoryReleasesResult {
  const RepositoryReleasesResult.data(RepositoryReleasesPageDto this.page)
    : failure = null;
  const RepositoryReleasesResult.failed(RepositoryReleasesFailure this.failure)
    : page = null;

  final RepositoryReleasesPageDto? page;
  final RepositoryReleasesFailure? failure;
}

class RepositoryReleasesService {
  const RepositoryReleasesService(this._request);

  final ReleaseRequest _request;

  Future<RepositoryReleasesResult> load({
    required String owner,
    required String repository,
    int page = 1,
  }) async {
    if (page < 1 ||
        !RegExp(r'^[a-zA-Z0-9-]+$').hasMatch(owner) ||
        !RegExp(r'^[a-zA-Z0-9_.-]+$').hasMatch(repository) ||
        repository == '.' ||
        repository == '..') {
      return const RepositoryReleasesResult.failed(
        RepositoryReleasesFailure.invalidResponse,
      );
    }
    final response = await _request(
      method: 'GET',
      path:
          'api/releases/${Uri.encodeComponent(owner)}/${Uri.encodeComponent(repository)}?page=$page&per_page=20',
    );
    if (response.cancelled) {
      return const RepositoryReleasesResult.failed(
        RepositoryReleasesFailure.cancelled,
      );
    }
    if (response.statusCode == 404 || response.statusCode == 410) {
      return const RepositoryReleasesResult.failed(
        RepositoryReleasesFailure.unavailable,
      );
    }
    if (response.problem != null) {
      return RepositoryReleasesResult.failed(switch (response.problem!) {
        BackendProblem.repositoryPermission =>
          RepositoryReleasesFailure.permission,
        BackendProblem.network => RepositoryReleasesFailure.network,
        BackendProblem.rateLimited => RepositoryReleasesFailure.rateLimited,
        BackendProblem.authenticationRejected =>
          RepositoryReleasesFailure.session,
        _ => RepositoryReleasesFailure.server,
      });
    }
    if (response.statusCode == null ||
        response.statusCode! < 200 ||
        response.statusCode! >= 300) {
      return const RepositoryReleasesResult.failed(
        RepositoryReleasesFailure.server,
      );
    }
    try {
      final payload = response.data as Map<String, dynamic>;
      final pagination = payload['pagination'] as Map<String, dynamic>;
      final items = payload['items'] as List;
      if (pagination['page'] is! int ||
          pagination['perPage'] is! int ||
          items.any(
            (item) =>
                item is! Map ||
                item['id'] is! int ||
                item['assets_count'] is! int ||
                item['download_count'] is! int,
          )) {
        throw const FormatException('Invalid numeric fields');
      }
      final result = RepositoryReleasesPageDto.fromJson(payload);
      if (result.pagination.page < 1 ||
          result.pagination.page > page ||
          result.pagination.perPage != 20 ||
          result.items.any(
            (item) =>
                item.id < 1 ||
                item.tagName.trim().isEmpty ||
                item.assetsCount < 0 ||
                item.downloadCount < 0,
          )) {
        throw const FormatException('Invalid release page');
      }
      return RepositoryReleasesResult.data(result);
    } catch (_) {
      return const RepositoryReleasesResult.failed(
        RepositoryReleasesFailure.invalidResponse,
      );
    }
  }
}
