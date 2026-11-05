import '../repositories/repository_models.dart';

enum FollowProblem {
  network,
  rateLimited,
  session,
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

/// The account's confirmed Release Follows, or why confirmation failed.
class FollowCollectionResult {
  const FollowCollectionResult.confirmed(
    List<RepositoryReference> this.repositories,
  ) : problem = null;

  const FollowCollectionResult.failed(FollowProblem this.problem)
    : repositories = null;

  final List<RepositoryReference>? repositories;
  final FollowProblem? problem;
}

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
    this.metadataPending = false,
    this.savingRepositoryId,
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

  /// Whether the details Detailed View reads are still arriving.
  ///
  /// It is true from the moment a metadata read starts until its request
  /// settles, so a surface can state the wait instead of asking whether a
  /// description is missing. A confirmed collection replaces the pending set,
  /// so a reload's confirmation clears it, and a new account or context starts
  /// with none. The session restates its own per-repository request bookkeeping
  /// here; a surface reads this field and never infers a wait from a status
  /// that is absent.
  final bool metadataPending;

  /// The repository whose follow is being added or removed, while [saving].
  ///
  /// The bookmark for this repository turns while the write is in flight. Every
  /// other bookmark stays quiet.
  final String? savingRepositoryId;
  final bool saveFailed;
  final List<RepositoryReference> repositories;
  final Map<String, RepositoryQueryStatus> statuses;
  final Map<String, String> previousNames;
  final Map<String, FollowedRepositoryDetails> details;
  final FollowProblem? metadataProblem;
  final FollowProblem? problem;

  /// Whether an edit cannot start yet: one is already in flight, or the first
  /// read of the confirmed list has not finished. Every surface that offers the
  /// action asks this, so a button, a row, and the session's own guard agree on
  /// when the action is unavailable.
  bool get editBlocked => saving || (!loaded && loading);

  /// Whether [repositoryId] is the follow currently being added or removed.
  bool editing(String repositoryId) =>
      saving && savingRepositoryId == repositoryId;

  ReleaseFollowsState copyWith({
    bool? loaded,
    bool? loading,
    bool? saving,
    bool? metadataPending,
    String? savingRepositoryId,
    bool clearSavingRepository = false,
    bool? saveFailed,
    List<RepositoryReference>? repositories,
    Map<String, RepositoryQueryStatus>? statuses,
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
    metadataPending: metadataPending ?? this.metadataPending,
    savingRepositoryId: clearSavingRepository
        ? null
        : savingRepositoryId ?? this.savingRepositoryId,
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
