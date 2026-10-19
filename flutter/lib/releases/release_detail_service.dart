import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../session/gitpulse_http.dart';
import '../session/session_controller.dart';
import '../timeline/timeline_session.dart';
import 'release_detail_dto.dart';

// Navigation addresses are distinct from stable timeline/cache node identities.
typedef ReleaseTarget = ({
  String owner,
  String repository,
  int? id,
  String? tag,
});
typedef ReleaseRequest = Future<BackendResult> Function({
  required String method,
  required String path,
});

enum ReleaseDetailFailure {
  unavailable,
  network,
  rateLimited,
  session,
  invalidResponse,
  server,
  cancelled,
}

class ReleaseDetailResult {
  const ReleaseDetailResult.data(ReleaseDetail this.release) : failure = null;
  const ReleaseDetailResult.failed(ReleaseDetailFailure this.failure)
    : release = null;

  final ReleaseDetail? release;
  final ReleaseDetailFailure? failure;
}

class ReleaseDetail {
  ReleaseDetail(
    this.dto,
    this.owner,
    this.repository, {
    this.offline = false,
    this.savedAt,
  });

  final ReleaseDetailDto dto;
  final String owner;
  final String repository;
  final bool offline;
  final DateTime? savedAt;
  int get id => dto.id;
  String get tag => dto.tagName;
  String get title =>
      dto.name?.trim().isNotEmpty == true ? dto.name!.trim() : tag;
  String get body => dto.body ?? '';
  DateTime? get publishedAt => dto.publishedAt;
  List<ReleaseAssetDto> get assets => List.unmodifiable(dto.assets);
}

final releaseDetailServiceProvider = Provider<ReleaseDetailService>((ref) {
  return ReleaseDetailService(({required method, required path}) {
    if (!ref.mounted) {
      return Future.value(const BackendResult(cancelled: true));
    }
    return ref
        .read(sessionControllerProvider.notifier)
        .request(method: method, path: path);
  });
});

final releaseDetailProvider = FutureProvider.autoDispose
    .family<ReleaseDetailResult, ReleaseTarget>((ref, target) async {
      final session = ref.watch(
        sessionControllerProvider.select(
          (state) =>
              (state.phase, state.identity?.backend, state.identity?.login),
        ),
      );
      if (session.$1 != SessionPhase.signedIn) {
        return const ReleaseDetailResult.failed(ReleaseDetailFailure.session);
      }
      final result = await ref.watch(releaseDetailServiceProvider).load(target);
      if (!ref.mounted || result.failure != ReleaseDetailFailure.network) {
        return result;
      }
      final saved = ref
          .read(releaseTimelineSessionProvider.notifier)
          .savedRelease(
            owner: target.owner,
            repository: target.repository,
            id: target.id,
            tag: target.tag,
          );
      if (saved == null) return result;
      return ReleaseDetailResult.data(
        ReleaseDetail(
          ReleaseDetailDto(
            id: saved.id,
            tagName: saved.tagName,
            name: saved.title,
            htmlUrl:
                saved.htmlUrl ??
                Uri.https(
                  'github.com',
                  '/${saved.repository.fullName}/releases/tag/${saved.tagName}',
                ).toString(),
            body: saved.notes,
            publishedAt: saved.publishedAt,
            assets: const [],
            draft: false,
            prerelease: saved.isPrerelease,
          ),
          saved.repository.owner,
          saved.repository.name,
          offline: true,
          savedAt: ref.read(releaseTimelineSessionProvider).savedAt,
        ),
      );
    });

class ReleaseDetailService {
  const ReleaseDetailService(this._request);

  final ReleaseRequest _request;

  Future<ReleaseDetailResult> load(ReleaseTarget target) async {
    if (!RegExp(r'^[a-zA-Z0-9-]+$').hasMatch(target.owner) ||
        !RegExp(r'^[a-zA-Z0-9_.-]+$').hasMatch(target.repository) ||
        target.repository == '.' ||
        target.repository == '..' ||
        (target.id == null) == (target.tag == null) ||
        (target.id != null && target.id! < 1) ||
        target.tag?.trim().isEmpty == true) {
      return const ReleaseDetailResult.failed(
        ReleaseDetailFailure.invalidResponse,
      );
    }
    final prefix =
        'api/releases/${Uri.encodeComponent(target.owner)}/${Uri.encodeComponent(target.repository)}';
    final path = target.id != null
        ? '$prefix/${target.id}'
        : '$prefix/by-tag?${Uri(queryParameters: {'tag': target.tag}).query}';
    final response = await _request(method: 'GET', path: path);
    if (response.cancelled) {
      return const ReleaseDetailResult.failed(ReleaseDetailFailure.cancelled);
    }
    if (response.statusCode == 404 || response.statusCode == 410) {
      return const ReleaseDetailResult.failed(ReleaseDetailFailure.unavailable);
    }
    if (response.problem != null) {
      return ReleaseDetailResult.failed(switch (response.problem!) {
        BackendProblem.network => ReleaseDetailFailure.network,
        BackendProblem.rateLimited => ReleaseDetailFailure.rateLimited,
        BackendProblem.authenticationRejected => ReleaseDetailFailure.session,
        _ => ReleaseDetailFailure.server,
      });
    }
    try {
      final payload = response.data as Map<String, dynamic>;
      if (payload['id'] is! int) {
        throw const FormatException('Invalid numeric release identity');
      }
      final dto = ReleaseDetailDto.fromJson(payload);
      if (dto.id < 1 ||
          dto.tagName.isEmpty ||
          (target.id != null && dto.id != target.id) ||
          (target.id == null && dto.tagName != target.tag)) {
        throw const FormatException('Unexpected release identity');
      }
      final url = Uri.parse(dto.htmlUrl);
      final parts = url.pathSegments;
      if (url.scheme != 'https' ||
          url.host != 'github.com' ||
          url.userInfo.isNotEmpty ||
          parts.length < 5 ||
          parts[2] != 'releases' ||
          parts[3] != 'tag') {
        throw const FormatException('Invalid release URL');
      }
      return ReleaseDetailResult.data(ReleaseDetail(dto, parts[0], parts[1]));
    } catch (_) {
      return const ReleaseDetailResult.failed(
        ReleaseDetailFailure.invalidResponse,
      );
    }
  }
}
