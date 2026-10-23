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

enum StarredRepositorySort { created, updated }

class StarredRepositoriesState {
  const StarredRepositoriesState({
    this.items = const [],
    this.loading = false,
    this.page = 0,
    this.hasMore = false,
    this.sort = StarredRepositorySort.created,
    this.ascending = false,
    this.problem,
  });

  final List<RepositoryCandidateDto> items;
  final bool loading;
  final int page;
  final bool hasMore;
  final StarredRepositorySort sort;
  final bool ascending;
  final FollowProblem? problem;

  StarredRepositoriesState copyWith({
    List<RepositoryCandidateDto>? items,
    bool? loading,
    int? page,
    bool? hasMore,
    StarredRepositorySort? sort,
    bool? ascending,
    FollowProblem? problem,
    bool clearProblem = false,
  }) => StarredRepositoriesState(
    items: items ?? this.items,
    loading: loading ?? this.loading,
    page: page ?? this.page,
    hasMore: hasMore ?? this.hasMore,
    sort: sort ?? this.sort,
    ascending: ascending ?? this.ascending,
    problem: clearProblem ? null : problem ?? this.problem,
  );
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
    this.starred = const StarredRepositoriesState(),
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
  final StarredRepositoriesState starred;

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
    StarredRepositoriesState? starred,
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
    starred: starred ?? this.starred,
  );
}
