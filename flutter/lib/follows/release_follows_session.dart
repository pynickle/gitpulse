import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../session/gitpulse_http.dart';
import '../session/session_controller.dart';
import '../timeline/timeline_models.dart';
import '../timeline/timeline_session.dart';
import 'release_follows_service.dart';
import 'release_follows_state.dart';

final releaseFollowsSessionProvider =
    NotifierProvider<ReleaseFollowsSession, ReleaseFollowsState>(
      ReleaseFollowsSession.new,
    );

/// The account's confirmed Release Follows and repository discovery actions.
class ReleaseFollowsSession extends Notifier<ReleaseFollowsState> {
  int _generation = 0;
  int _searchGeneration = 0;
  int _starredGeneration = 0;
  String? _context;

  ReleaseFollowsService get _service => ReleaseFollowsService(({
    required method,
    required path,
    body,
  }) {
    if (!ref.mounted) {
      return Future.value(
        const BackendResult(cancelled: true, problem: BackendProblem.cancelled),
      );
    }
    return ref
        .read(sessionControllerProvider.notifier)
        .request(method: method, path: path, body: body);
  });

  @override
  ReleaseFollowsState build() {
    ref.onDispose(() {
      _generation++;
      _searchGeneration++;
      _starredGeneration++;
    });
    ref.listen(sessionControllerProvider, (_, next) {
      final context = _sessionContext();
      if (context == _context) return;
      _context = context;
      _generation++;
      _searchGeneration++;
      _starredGeneration++;
      state = ReleaseFollowsState(active: context != null);
      if (context != null) unawaited(reload());
    });
    _context = _sessionContext();
    if (_context != null) {
      final ticket = _generation;
      Future<void>.microtask(() {
        if (_current(ticket)) return reload();
      });
    }
    return ReleaseFollowsState(active: _context != null);
  }

  String? _sessionContext() {
    final session = ref.read(sessionControllerProvider);
    final identity = session.identity;
    return session.phase == SessionPhase.signedIn && identity != null
        ? '${identity.backend}|${identity.login}'
        : null;
  }

  bool _current(int ticket) => ref.mounted && ticket == _generation;

  /// Reloads shared settings and checks stable repository identities.
  Future<void> reload() async {
    if (!state.active || state.saving) return;
    final ticket = ++_generation;
    state = state.copyWith(
      loading: true,
      saveFailed: false,
      clearProblem: true,
    );
    try {
      var repositories = await _service.readFollows();
      if (!_current(ticket)) return;
      repositories = await _updateMetadata(repositories, ticket);
      if (!_current(ticket)) return;
      _publishConfirmed(repositories);
    } on FollowRequestFailure catch (error) {
      if (_current(ticket)) {
        state = state.copyWith(loading: false, problem: error.problem);
      }
    }
  }

  /// Searches repositories or resolves a pasted GitHub repository URL.
  Future<void> search(String input, {bool more = false}) async {
    if (!state.active) return;
    if (more &&
        (state.searching || !state.hasMore || input.trim() != state.query)) {
      return;
    }
    final query = input.trim();
    final ticket = ++_searchGeneration;
    final context = _context;
    final page = more ? state.searchPage + 1 : 1;
    state = state.copyWith(
      query: query,
      searching: query.isNotEmpty,
      results: more ? null : [],
      searchPage: more ? null : 0,
      hasMore: more ? null : false,
      clearSearchProblem: true,
    );
    if (query.isEmpty) return;
    try {
      final result = await _service.search(query, page);
      if (!ref.mounted || context != _context || ticket != _searchGeneration) {
        return;
      }
      final byId = {
        for (final item in [if (more) ...state.results, ...result.items])
          item.repository.id: item,
      };
      state = state.copyWith(
        results: List.unmodifiable(byId.values),
        searching: false,
        searchPage: page,
        hasMore: result.pagination?.hasNext ?? false,
      );
    } on FollowRequestFailure catch (error) {
      if (ref.mounted && context == _context && ticket == _searchGeneration) {
        state = state.copyWith(searching: false, searchProblem: error.problem);
      }
    }
  }

  /// Invalidates pending search results as the input changes.
  void updateQuery(String input) {
    _searchGeneration++;
    state = state.copyWith(
      query: input.trim(),
      searching: false,
      results: const [],
      hasMore: false,
      searchPage: 0,
      clearSearchProblem: true,
    );
  }

  /// Loads starred repositories using the same ordering as the web app.
  Future<void> loadStarred({
    bool more = false,
    StarredRepositorySort? sort,
    bool? ascending,
  }) async {
    if (!state.active) return;
    final starred = state.starred;
    if (more && (starred.loading || !starred.hasMore)) return;
    final ticket = ++_starredGeneration;
    final context = _context;
    final page = more ? starred.page + 1 : 1;
    final nextSort = sort ?? starred.sort;
    final nextAscending = ascending ?? starred.ascending;
    state = state.copyWith(
      starred: starred.copyWith(
        loading: true,
        items: more ? null : const [],
        hasMore: more ? null : false,
        sort: nextSort,
        ascending: nextAscending,
        clearProblem: true,
      ),
    );
    try {
      final result = await _service.starred(
        page,
        sort: nextSort,
        ascending: nextAscending,
      );
      if (!ref.mounted || context != _context || ticket != _starredGeneration) {
        return;
      }
      final byId = {
        for (final item in [if (more) ...starred.items, ...result.items])
          item.repository.id: item,
      };
      state = state.copyWith(
        starred: state.starred.copyWith(
          items: List.unmodifiable(byId.values),
          loading: false,
          page: page,
          hasMore: result.pagination?.hasNext ?? false,
        ),
      );
    } on FollowRequestFailure catch (error) {
      if (ref.mounted && context == _context && ticket == _starredGeneration) {
        state = state.copyWith(
          starred: state.starred.copyWith(
            loading: false,
            problem: error.problem,
          ),
        );
      }
    }
  }

  /// Adds a Release Follow after checking the latest shared list and limits.
  Future<void> follow(TimelineRepository repository) async {
    if (!state.active || state.saving || state.loading) return;
    if (repository.id.trim().isEmpty ||
        repository.id.length > 240 ||
        !validRepositoryName(repository.owner, repository.name)) {
      state = state.copyWith(problem: FollowProblem.invalidRepository);
      return;
    }
    final ticket = ++_generation;
    state = state.copyWith(saving: true, saveFailed: false, clearProblem: true);
    try {
      var repositories = await _service.readFollows();
      if (!_current(ticket)) return;
      if (repositories.any((repo) => repo.id == repository.id)) {
        throw const FollowRequestFailure(FollowProblem.duplicate);
      }
      if (repositories.length >= 150) {
        throw const FollowRequestFailure(FollowProblem.storedLimit);
      }
      repositories = await _updateMetadata(repositories, ticket);
      if (!_current(ticket)) return;
      if (repositories
              .where(
                (repo) =>
                    state.statuses[repo.id] != RepositoryPageStatus.unavailable,
              )
              .length >=
          100) {
        throw const FollowRequestFailure(FollowProblem.validLimit);
      }
      final saved = await _service.saveFollows([repository, ...repositories]);
      if (!_current(ticket)) return;
      _publishConfirmed(saved);
    } on FollowRequestFailure catch (error) {
      if (_current(ticket)) {
        state = state.copyWith(
          saving: false,
          saveFailed: true,
          problem: error.problem,
        );
      }
    }
  }

  /// Removes a Release Follow after the backend confirms the change.
  Future<void> unfollow(String repositoryId) async {
    if (!state.active || state.saving || state.loading) return;
    final ticket = ++_generation;
    state = state.copyWith(saving: true, saveFailed: false, clearProblem: true);
    try {
      final repositories = await _service.readFollows();
      if (!_current(ticket)) return;
      final saved = await _service.saveFollows([
        for (final repo in repositories)
          if (repo.id != repositoryId) repo,
      ]);
      if (!_current(ticket)) return;
      _publishConfirmed(saved);
    } on FollowRequestFailure catch (error) {
      if (_current(ticket)) {
        state = state.copyWith(
          saving: false,
          saveFailed: true,
          problem: error.problem,
        );
      }
    }
  }

  void _publishConfirmed(List<TimelineRepository> repositories) {
    state = state.copyWith(
      repositories: List.unmodifiable(repositories),
      loaded: true,
      loading: false,
      saving: false,
    );
    unawaited(
      ref
          .read(releaseTimelineSessionProvider.notifier)
          .applyFollows(repositories),
    );
  }

  Future<List<TimelineRepository>> _updateMetadata(
    List<TimelineRepository> repositories,
    int ticket,
  ) async {
    if (repositories.isEmpty) {
      state = state.copyWith(
        statuses: const {},
        previousNames: const {},
        clearMetadataProblem: true,
      );
      return repositories;
    }
    try {
      final response = await _service.readMetadata(repositories);
      if (!_current(ticket)) return repositories;
      final previousNames = <String, String>{};
      final renamed = [
        for (final repo in repositories)
          (() {
            final lookup = response.repositories[repo.id];
            if (lookup?.status != RepositoryPageStatus.available ||
                lookup?.owner == null ||
                lookup?.name == null ||
                !validRepositoryName(lookup!.owner!, lookup.name!)) {
              return repo;
            }
            final current = TimelineRepository(
              id: repo.id,
              owner: lookup.owner!,
              name: lookup.name!,
            );
            if (repo.fullName != current.fullName) {
              previousNames[repo.id] = repo.fullName;
            }
            return current;
          })(),
      ];
      state = state.copyWith(
        statuses: Map.unmodifiable({
          for (final repo in repositories)
            repo.id:
                response.repositories[repo.id]?.status ??
                RepositoryPageStatus.transient,
        }),
        previousNames: Map.unmodifiable(previousNames),
        clearMetadataProblem: true,
      );
      return renamed;
    } on FollowRequestFailure catch (error) {
      if (_current(ticket)) {
        state = state.copyWith(
          statuses: Map.unmodifiable({
            for (final repo in repositories)
              repo.id: RepositoryPageStatus.transient,
          }),
          previousNames: const {},
          metadataProblem: error.problem,
        );
      }
      return repositories;
    }
  }
}
