import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../session/session_controller.dart';
import 'release_follows_dto.dart';
import 'release_follows_service.dart';
import 'release_follows_state.dart';

enum RepositorySource { starred, search }

/// The repository being read and the distance into its row, for this visit.
class RepositoryReadingPosition {
  ({String repositoryId, double inset})? anchor;
}

/// One source's page, including a failed or pending turn away from its results.
class RepositoryDiscoveryPage {
  RepositoryDiscoveryPage({
    this.response,
    this.page = 0,
    this.requestedPage = 1,
    this.loading = false,
    this.problem,
    RepositoryReadingPosition? position,
  }) : position = position ?? RepositoryReadingPosition();

  final RepositorySearchDto? response;
  final int page;
  final int requestedPage;
  final bool loading;
  final FollowProblem? problem;
  final RepositoryReadingPosition position;

  List<RepositoryCandidateDto> get items => response?.items ?? const [];
  RepositorySearchPaginationDto? get pagination => response?.pagination;
  bool get hasMore => pagination?.hasNext ?? false;
  bool get replacingPage => loading && requestedPage != page;

  RepositoryDiscoveryPage copyWith({
    RepositorySearchDto? response,
    int? page,
    int? requestedPage,
    bool? loading,
    FollowProblem? problem,
    bool clearProblem = false,
    bool resetPosition = false,
  }) => RepositoryDiscoveryPage(
    response: response ?? this.response,
    page: page ?? this.page,
    requestedPage: requestedPage ?? this.requestedPage,
    loading: loading ?? this.loading,
    problem: clearProblem ? null : problem ?? this.problem,
    position: resetPosition ? null : position,
  );
}

class RepositoryDiscoveryState {
  RepositoryDiscoveryState({
    this.active = false,
    this.source = RepositorySource.starred,
    this.query = '',
    this.sort = StarredRepositorySort.created,
    this.ascending = false,
    RepositoryDiscoveryPage? starred,
    RepositoryDiscoveryPage? search,
  }) : starred = starred ?? RepositoryDiscoveryPage(),
       search = search ?? RepositoryDiscoveryPage();

  final bool active;
  final RepositorySource source;
  final String query;
  final StarredRepositorySort sort;
  final bool ascending;
  final RepositoryDiscoveryPage starred;
  final RepositoryDiscoveryPage search;

  RepositoryDiscoveryPage pageFor(RepositorySource source) =>
      source == RepositorySource.starred ? starred : search;
  RepositoryDiscoveryPage get current => pageFor(source);

  RepositoryDiscoveryState copyWith({
    RepositorySource? source,
    String? query,
    StarredRepositorySort? sort,
    bool? ascending,
    RepositoryDiscoveryPage? starred,
    RepositoryDiscoveryPage? search,
  }) => RepositoryDiscoveryState(
    active: active,
    source: source ?? this.source,
    query: query ?? this.query,
    sort: sort ?? this.sort,
    ascending: ascending ?? this.ascending,
    starred: starred ?? this.starred,
    search: search ?? this.search,
  );
}

final repositoryDiscoverySessionProvider =
    NotifierProvider<RepositoryDiscoverySession, RepositoryDiscoveryState>(
      RepositoryDiscoverySession.new,
    );

/// Search and Starred share page turns, caching, refresh, and retry semantics.
/// Their candidates never establish membership in the confirmed Release Follows.
class RepositoryDiscoverySession extends Notifier<RepositoryDiscoveryState> {
  int _epoch = 0;
  final _requests = <RepositorySource, Object>{};
  final _cache = <RepositorySource, Map<int, RepositorySearchDto>>{};

  @override
  RepositoryDiscoveryState build() {
    final identity = ref.watch(
      sessionControllerProvider.select((session) {
        final identity = session.identity;
        return session.phase == SessionPhase.signedIn && identity != null
            ? identity.account
            : null;
      }),
    );
    _epoch++;
    ref.onDispose(() => _epoch++);
    _requests.clear();
    _cache.clear();
    return RepositoryDiscoveryState(active: identity != null);
  }

  ReleaseFollowsService get _service => ref.read(releaseFollowsServiceProvider);

  void _publish(RepositorySource source, RepositoryDiscoveryPage page) {
    state = source == RepositorySource.starred
        ? state.copyWith(starred: page)
        : state.copyWith(search: page);
  }

  Future<void> selectSource(RepositorySource source) {
    state = state.copyWith(source: source);
    return ensureLoaded();
  }

  /// Reopening a source does not retry a failure or replace an in-flight page.
  Future<void> ensureLoaded() {
    final page = state.current;
    if (page.page != 0 || page.loading || page.problem != null) {
      return Future.value();
    }
    return _load(state.source, 1);
  }

  void updateQuery(String input) {
    final query = input.trim();
    if (query == state.query) return;
    _requests.remove(RepositorySource.search);
    _cache.remove(RepositorySource.search);
    state = state.copyWith(query: query, search: RepositoryDiscoveryPage());
  }

  Future<void> search(String input, {int page = 1}) {
    final changed = input.trim() != state.query;
    updateQuery(input);
    return _load(RepositorySource.search, changed ? 1 : page);
  }

  Future<void> loadStarred({
    int page = 1,
    StarredRepositorySort? sort,
    bool? ascending,
  }) {
    final nextSort = sort ?? state.sort;
    final nextAscending = ascending ?? state.ascending;
    if (nextSort != state.sort || nextAscending != state.ascending) {
      _requests.remove(RepositorySource.starred);
      _cache.remove(RepositorySource.starred);
      state = state.copyWith(
        sort: nextSort,
        ascending: nextAscending,
        starred: RepositoryDiscoveryPage(),
      );
      page = 1;
    }
    return _load(RepositorySource.starred, page);
  }

  Future<void> goToPage(int page) => _load(state.source, page);

  Future<void> refresh() => _load(
    state.source,
    state.current.page < 1 ? 1 : state.current.page,
    refresh: true,
  );

  Future<void> retry() =>
      _load(state.source, state.current.requestedPage, refresh: true);

  Future<void> _load(
    RepositorySource source,
    int page, {
    bool refresh = false,
  }) async {
    if (!state.active || page < 1) return;
    if (source == RepositorySource.search && state.query.isEmpty) return;
    final previous = state.pageFor(source);
    if (previous.loading && previous.requestedPage == page && !refresh) return;
    final request = Object();
    final epoch = _epoch;
    _requests[source] = request;
    final cached = refresh ? null : _cache[source]?[page];
    if (cached != null) {
      _publish(
        source,
        RepositoryDiscoveryPage(
          response: cached,
          page: cached.pagination?.page ?? page,
          requestedPage: page,
        ),
      );
      return;
    }
    _publish(
      source,
      previous.copyWith(
        requestedPage: page,
        loading: true,
        clearProblem: true,
        resetPosition: !refresh,
      ),
    );
    try {
      final result = await switch (source) {
        RepositorySource.search => _service.search(state.query, page),
        RepositorySource.starred => _service.starred(
          page,
          sort: state.sort,
          ascending: state.ascending,
        ),
      };
      if (!ref.mounted || epoch != _epoch || _requests[source] != request) {
        return;
      }
      final saved = RepositorySearchDto(
        items: List.unmodifiable(result.items),
        pagination: result.pagination,
      );
      (_cache[source] ??= {})[page] = saved;
      _publish(
        source,
        RepositoryDiscoveryPage(
          response: saved,
          page: result.pagination?.page ?? page,
          requestedPage: page,
        ),
      );
    } on FollowRequestFailure catch (error) {
      if (!ref.mounted || epoch != _epoch || _requests[source] != request) {
        return;
      }
      _publish(
        source,
        state.pageFor(source).copyWith(loading: false, problem: error.problem),
      );
    }
  }
}
