import '../timeline/timeline_models.dart';

enum FollowProblem {
  network,
  rateLimited,
  server,
  invalidResponse,
  cancelled,
  invalidRepository,
  notFound,
  duplicate,
  validLimit,
  storedLimit,
}

enum StarredRepositorySort { created, updated }

/// Recognition details for one Followed Repository after a metadata read.
class FollowedRepositoryDetails {
  const FollowedRepositoryDetails({
    this.description,
    this.language,
    this.starCount,
  });

  final String? description;
  final String? language;
  final int? starCount;
}

class ReleaseFollowsState {
  const ReleaseFollowsState({
    this.active = false,
    this.loaded = false,
    this.loading = false,
    this.saving = false,
    this.saveFailed = false,
    this.repositories = const [],
    this.statuses = const {},
    this.previousNames = const {},
    this.details = const {},
    this.metadataProblem,
    this.problem,
  });

  final bool active;
  final bool loaded;
  final bool loading;
  final bool saving;
  final bool saveFailed;
  final List<TimelineRepository> repositories;
  final Map<String, RepositoryPageStatus> statuses;
  final Map<String, String> previousNames;
  final Map<String, FollowedRepositoryDetails> details;
  final FollowProblem? metadataProblem;
  final FollowProblem? problem;

  /// Whether an edit cannot start yet: one is already in flight, or the first
  /// read of the confirmed list has not finished. Every surface that offers the
  /// action asks this, so a button, a row, and the session's own guard agree on
  /// when the action is unavailable.
  bool get editBlocked => saving || (!loaded && loading);

  ReleaseFollowsState copyWith({
    bool? loaded,
    bool? loading,
    bool? saving,
    bool? saveFailed,
    List<TimelineRepository>? repositories,
    Map<String, RepositoryPageStatus>? statuses,
    Map<String, String>? previousNames,
    Map<String, FollowedRepositoryDetails>? details,
    FollowProblem? metadataProblem,
    bool clearMetadataProblem = false,
    FollowProblem? problem,
    bool clearProblem = false,
  }) => ReleaseFollowsState(
    active: active,
    loaded: loaded ?? this.loaded,
    loading: loading ?? this.loading,
    saving: saving ?? this.saving,
    saveFailed: saveFailed ?? this.saveFailed,
    repositories: repositories ?? this.repositories,
    statuses: statuses ?? this.statuses,
    previousNames: previousNames ?? this.previousNames,
    details: details ?? this.details,
    metadataProblem: clearMetadataProblem
        ? null
        : metadataProblem ?? this.metadataProblem,
    problem: clearProblem ? null : problem ?? this.problem,
  );
}
