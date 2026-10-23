import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../session/gitpulse_http.dart';
import '../session/session_controller.dart';
import '../timeline/timeline_models.dart';
import '../timeline/timeline_session.dart';
import 'followed_repository_view.dart';
import 'release_follows_service.dart';
import 'release_follows_state.dart';

final releaseFollowsSessionProvider =
    NotifierProvider<ReleaseFollowsSession, ReleaseFollowsState>(
      ReleaseFollowsSession.new,
    );

/// The account's confirmed Release Follows and repository discovery actions.
class ReleaseFollowsSession extends Notifier<ReleaseFollowsState> {
  int _generation = 0;
  int _metadataTicket = 0;
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
      _metadataTicket++;
      _searchGeneration++;
      _starredGeneration++;
    });
    ref.listen(sessionControllerProvider, (_, next) {
      final context = _sessionContext();
      if (context == _context) return;
      _context = context;
      _generation++;
      _metadataTicket++;
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
      if (_detailed) {
        repositories = await _updateMetadata(
          repositories,
          current: () => _current(ticket),
        );
        if (!_current(ticket)) return;
      }
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
      repositories = await _updateMetadata(
        repositories,
        current: () => _current(ticket),
      );
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

  bool get _detailed =>
      ref.read(followedRepositoryViewProvider) ==
      FollowedRepositoryView.detailed;

  /// Loads Followed Repository metadata for Detailed View, or for one retry.
  Future<void> loadMetadata({String? repositoryId}) async {
    if (!state.active || state.repositories.isEmpty) return;
    final ticket = ++_metadataTicket;
    final context = _context;
    final current = List<TimelineRepository>.of(state.repositories);
    final updated = await _updateMetadata(
      current,
      current: () =>
          ref.mounted && ticket == _metadataTicket && context == _context,
      onlyIds: repositoryId == null ? null : {repositoryId},
    );
    if (!ref.mounted || ticket != _metadataTicket || context != _context) {
      return;
    }
    var renamed = updated.length != current.length;
    if (!renamed) {
      for (var index = 0; index < updated.length; index++) {
        if (updated[index].fullName != current[index].fullName) {
          renamed = true;
          break;
        }
      }
    }
    if (!renamed) return;
    state = state.copyWith(repositories: List.unmodifiable(updated));
    unawaited(
      ref.read(releaseTimelineSessionProvider.notifier).applyFollows(updated),
    );
  }

  Future<List<TimelineRepository>> _updateMetadata(
    List<TimelineRepository> repositories, {
    required bool Function() current,
    Set<String>? onlyIds,
  }) async {
    if (onlyIds != null && onlyIds.isEmpty) return repositories;
    if (repositories.isEmpty) {
      if (onlyIds != null || !current()) return repositories;
      state = state.copyWith(
        statuses: const {},
        previousNames: const {},
        details: const {},
        clearMetadataProblem: true,
      );
      return repositories;
    }
    final targets = [
      for (final repo in repositories)
        if (onlyIds == null || onlyIds.contains(repo.id)) repo,
    ];
    if (targets.isEmpty) return repositories;
    try {
      final response = await _service.readMetadata(targets);
      if (!current()) return repositories;
      final previousNames = onlyIds == null
          ? <String, String>{}
          : Map<String, String>.of(state.previousNames);
      final details = onlyIds == null
          ? <String, FollowedRepositoryDetails>{}
          : Map<String, FollowedRepositoryDetails>.of(state.details);
      final statuses = onlyIds == null
          ? <String, RepositoryPageStatus>{}
          : Map<String, RepositoryPageStatus>.of(state.statuses);

      TimelineRepository apply(TimelineRepository repo) {
        if (onlyIds != null && !onlyIds.contains(repo.id)) return repo;
        final lookup = response.repositories[repo.id];
        statuses[repo.id] = lookup?.status ?? RepositoryPageStatus.transient;
        if (lookup?.status != RepositoryPageStatus.available ||
            lookup?.owner == null ||
            lookup?.name == null ||
            !validRepositoryName(lookup!.owner!, lookup.name!)) {
          details.remove(repo.id);
          previousNames.remove(repo.id);
          return repo;
        }
        details[repo.id] = FollowedRepositoryDetails(
          description: lookup.description,
          language: lookup.primaryLanguage,
          starCount: lookup.starCount,
        );
        final identity = TimelineRepository(
          id: repo.id,
          owner: lookup.owner!,
          name: lookup.name!,
        );
        if (repo.fullName == identity.fullName) {
          previousNames.remove(repo.id);
        } else {
          previousNames[repo.id] = repo.fullName;
        }
        return identity;
      }

      final renamed = [for (final repo in repositories) apply(repo)];
      state = state.copyWith(
        statuses: Map.unmodifiable(statuses),
        previousNames: Map.unmodifiable(previousNames),
        details: Map.unmodifiable(details),
        clearMetadataProblem: onlyIds == null,
      );
      return renamed;
    } on FollowRequestFailure catch (error) {
      if (!current()) return repositories;
      if (onlyIds == null) {
        state = state.copyWith(
          statuses: Map.unmodifiable({
            for (final repo in repositories)
              repo.id: RepositoryPageStatus.transient,
          }),
          previousNames: const {},
          details: const {},
          metadataProblem: error.problem,
        );
      } else {
        final statuses = Map<String, RepositoryPageStatus>.of(state.statuses);
        for (final id in onlyIds) {
          statuses[id] = RepositoryPageStatus.transient;
        }
        state = state.copyWith(statuses: Map.unmodifiable(statuses));
      }
      return repositories;
    }
  }
}
