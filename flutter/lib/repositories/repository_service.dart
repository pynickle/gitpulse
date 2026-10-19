import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../session/gitpulse_http.dart';
import '../session/session_controller.dart';
import 'repository_dto.dart';

typedef RepositoryScope = ({String owner, String repository, Object opening});
typedef ReadmeScope = ({RepositoryScope repository, String branch});

enum RepositoryFailure {
  unavailable,
  permission,
  network,
  rateLimited,
  session,
  invalidResponse,
  server,
  cancelled,
}

class RepositoryResult<T> {
  const RepositoryResult.data(T this.value) : failure = null;
  const RepositoryResult.failed(RepositoryFailure this.failure) : value = null;
  final T? value;
  final RepositoryFailure? failure;
}

bool validRepositoryIdentity(String owner, String name) =>
    RegExp(r'^[a-zA-Z0-9-]+$').hasMatch(owner) &&
    RegExp(r'^[a-zA-Z0-9_.-]+$').hasMatch(name) &&
    name != '.' &&
    name != '..';

final repositoryServiceProvider = Provider(
  (ref) => RepositoryService((path) {
    if (!ref.mounted) return Future.value(const BackendResult(cancelled: true));
    return ref
        .read(sessionControllerProvider.notifier)
        .request(method: 'GET', path: path);
  }),
);

final repositoryProvider = FutureProvider.autoDispose
    .family<RepositoryResult<RepositoryDto>, RepositoryScope>((ref, scope) {
      final session = ref.watch(
        sessionControllerProvider.select(
          (state) =>
              (state.phase, state.identity?.backend, state.identity?.login),
        ),
      );
      if (session.$1 != SessionPhase.signedIn) {
        return const RepositoryResult.failed(RepositoryFailure.session);
      }
      return ref
          .watch(repositoryServiceProvider)
          .load(scope.owner, scope.repository);
    });

final repositoryReadmeProvider = FutureProvider.autoDispose
    .family<RepositoryResult<RepositoryReadmeDto>, ReadmeScope>((ref, scope) {
      final session = ref.watch(
        sessionControllerProvider.select(
          (state) =>
              (state.phase, state.identity?.backend, state.identity?.login),
        ),
      );
      if (session.$1 != SessionPhase.signedIn) {
        return const RepositoryResult.failed(RepositoryFailure.session);
      }
      return ref
          .watch(repositoryServiceProvider)
          .readme(
            scope.repository.owner,
            scope.repository.repository,
            scope.branch,
          );
    });

class RepositoryService {
  const RepositoryService(this._request);
  final Future<BackendResult> Function(String path) _request;

  Future<RepositoryResult<T>> _get<T>(
    String path,
    T Function(Map<String, dynamic>) decode,
  ) async {
    final response = await _request(path);
    final failure = switch (response) {
      BackendResult(cancelled: true) => RepositoryFailure.cancelled,
      BackendResult(statusCode: 404 || 410) => RepositoryFailure.unavailable,
      BackendResult(problem: BackendProblem.repositoryPermission) =>
        RepositoryFailure.permission,
      BackendResult(problem: BackendProblem.network) =>
        RepositoryFailure.network,
      BackendResult(problem: BackendProblem.rateLimited) =>
        RepositoryFailure.rateLimited,
      BackendResult(problem: BackendProblem.authenticationRejected) =>
        RepositoryFailure.session,
      BackendResult(problem: != null) => RepositoryFailure.server,
      BackendResult(statusCode: final int status)
          when status >= 200 && status < 300 =>
        null,
      _ => RepositoryFailure.server,
    };
    if (failure != null) return RepositoryResult.failed(failure);
    try {
      return RepositoryResult.data(
        decode(response.data as Map<String, dynamic>),
      );
    } catch (_) {
      return const RepositoryResult.failed(RepositoryFailure.invalidResponse);
    }
  }

  Future<RepositoryResult<RepositoryDto>> load(
    String owner,
    String name,
  ) async {
    if (!validRepositoryIdentity(owner, name)) {
      return const RepositoryResult.failed(RepositoryFailure.invalidResponse);
    }
    return _get('api/repos/$owner/$name', (json) {
      final dto = RepositoryDto.fromJson(json);
      if (!validRepositoryIdentity(dto.owner.login, dto.name) ||
          dto.defaultBranch.trim().isEmpty ||
          dto.stargazersCount < 0 ||
          dto.forksCount < 0 ||
          (dto.subscribersCount ?? 0) < 0) {
        throw const FormatException('Invalid repository');
      }
      return dto;
    });
  }

  Future<RepositoryResult<RepositoryReadmeDto>> readme(
    String owner,
    String name,
    String branch,
  ) async {
    if (!validRepositoryIdentity(owner, name) || branch.trim().isEmpty) {
      return const RepositoryResult.failed(RepositoryFailure.invalidResponse);
    }
    return _get(
      'api/repos/$owner/$name/readme?${Uri(queryParameters: {'ref': branch}).query}',
      (json) {
        final dto = RepositoryReadmeDto.fromJson(json);
        if (dto.content?.trim().isNotEmpty == true &&
            (dto.path == null || dto.path!.trim().isEmpty)) {
          throw const FormatException('Missing README resource context');
        }
        return dto;
      },
    );
  }
}
