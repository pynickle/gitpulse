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

class StarredRepositoriesState {
  const StarredRepositoriesState({
    this.items = const [],
    this.loading = false,
    this.page = 0,
    this.pagination,
    this.requestedPage = 1,
    this.sort = StarredRepositorySort.created,
    this.ascending = false,
    this.problem,
  });

  final List<RepositoryCandidateDto> items;
  final bool loading;
  final int page;
  final RepositorySearchPaginationDto? pagination;
  final int requestedPage;
  bool get hasMore => pagination?.hasNext ?? false;
  final StarredRepositorySort sort;
  final bool ascending;
  final FollowProblem? problem;

  StarredRepositoriesState copyWith({
    List<RepositoryCandidateDto>? items,
    bool? loading,
    int? page,
    RepositorySearchPaginationDto? pagination,
    bool clearPagination = false,
    int? requestedPage,
    StarredRepositorySort? sort,
    bool? ascending,
    FollowProblem? problem,
    bool clearProblem = false,
  }) => StarredRepositoriesState(
    items: items ?? this.items,
    loading: loading ?? this.loading,
    page: page ?? this.page,
    pagination: clearPagination ? null : pagination ?? this.pagination,
    requestedPage: requestedPage ?? this.requestedPage,
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
    this.searchPagination,
    this.searchRequestedPage = 1,
    this.statuses = const {},
    this.previousNames = const {},
    this.details = const {},
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
  final RepositorySearchPaginationDto? searchPagination;
  final int searchRequestedPage;
  bool get hasMore => searchPagination?.hasNext ?? false;
  final Map<String, RepositoryPageStatus> statuses;
  final Map<String, String> previousNames;
  final Map<String, FollowedRepositoryDetails> details;
  final FollowProblem? metadataProblem;
  final FollowProblem? problem;
  final FollowProblem? searchProblem;
  final StarredRepositoriesState starred;

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
    bool? searching,
    List<TimelineRepository>? repositories,
    List<RepositoryCandidateDto>? results,
    String? query,
    int? searchPage,
    RepositorySearchPaginationDto? searchPagination,
    bool clearSearchPagination = false,
    int? searchRequestedPage,
    Map<String, RepositoryPageStatus>? statuses,
    Map<String, String>? previousNames,
    Map<String, FollowedRepositoryDetails>? details,
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
    searchPagination: clearSearchPagination
        ? null
        : searchPagination ?? this.searchPagination,
    searchRequestedPage: searchRequestedPage ?? this.searchRequestedPage,
    statuses: statuses ?? this.statuses,
    previousNames: previousNames ?? this.previousNames,
    details: details ?? this.details,
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
