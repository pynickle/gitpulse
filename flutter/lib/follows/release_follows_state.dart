import '../timeline/timeline_models.dart';
import 'release_follows_dto.dart';

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

class ReleaseFollowsState {
  const ReleaseFollowsState({
    this.active = false,
    this.loaded = false,
    this.loading = false,
    this.saving = false,
    this.saveFailed = false,
    this.searching = false,
    this.repositories = const [],
    this.results = const [],
    this.query = '',
    this.searchPage = 0,
    this.hasMore = false,
    this.statuses = const {},
    this.previousNames = const {},
    this.metadataProblem,
    this.problem,
    this.searchProblem,
  });

  final bool active;
  final bool loaded;
  final bool loading;
  final bool saving;
  final bool saveFailed;
  final bool searching;
  final List<TimelineRepository> repositories;
  final List<RepositoryCandidateDto> results;
  final String query;
  final int searchPage;
  final bool hasMore;
  final Map<String, RepositoryPageStatus> statuses;
  final Map<String, String> previousNames;
  final FollowProblem? metadataProblem;
  final FollowProblem? problem;
  final FollowProblem? searchProblem;

  ReleaseFollowsState copyWith({
    bool? loaded,
    bool? loading,
    bool? saving,
    bool? saveFailed,
    bool? searching,
    List<TimelineRepository>? repositories,
    List<RepositoryCandidateDto>? results,
    String? query,
    int? searchPage,
    bool? hasMore,
    Map<String, RepositoryPageStatus>? statuses,
    Map<String, String>? previousNames,
    FollowProblem? metadataProblem,
    bool clearMetadataProblem = false,
    FollowProblem? problem,
    FollowProblem? searchProblem,
    bool clearProblem = false,
    bool clearSearchProblem = false,
  }) => ReleaseFollowsState(
    active: active,
    loaded: loaded ?? this.loaded,
    loading: loading ?? this.loading,
    saving: saving ?? this.saving,
    saveFailed: saveFailed ?? this.saveFailed,
    searching: searching ?? this.searching,
    repositories: repositories ?? this.repositories,
    results: results ?? this.results,
    query: query ?? this.query,
    searchPage: searchPage ?? this.searchPage,
    hasMore: hasMore ?? this.hasMore,
    statuses: statuses ?? this.statuses,
    previousNames: previousNames ?? this.previousNames,
    metadataProblem: clearMetadataProblem
        ? null
        : metadataProblem ?? this.metadataProblem,
    problem: clearProblem ? null : problem ?? this.problem,
    searchProblem: clearSearchProblem
        ? null
        : searchProblem ?? this.searchProblem,
  );
}
