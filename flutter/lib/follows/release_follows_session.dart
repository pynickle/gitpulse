import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../session/gitpulse_http.dart';
import '../session/session_controller.dart';
import '../timeline/timeline_models.dart';
import '../timeline/timeline_dto.dart';
import '../timeline/timeline_service.dart';
import '../timeline/timeline_state.dart';
import 'followed_repository_view.dart';
import 'release_follows_service.dart';
import 'release_follows_dto.dart';
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
  Future<TimelineResult<UserSettingsDto>>? _settingsRead;
  UserSettingsDto? _settings;
  TimelineFailure? _readFailure;
  Completer<void>? _edit;
  final Map<String, Object> _members = {};
  final Map<String, Object> _metadataRequests = {};
  final Map<String, int> _nameVersions = {};
  int _nameVersion = 0;

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
      _settingsRead = null;
      _settings = null;
      _readFailure = null;
      _members.clear();
      _metadataRequests.clear();
      _nameVersions.clear();
      _edit = null;
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
        ? '${identity.backend}|${identity.githubId ?? identity.login.toLowerCase()}'
        : null;
  }

  bool _current(int ticket) => ref.mounted && ticket == _generation;

  /// Explicitly synchronizes the account's collection, independently of details.
  Future<void> reload() async {
    await synchronize(refresh: true);
  }

  /// Shares compatible collection reads with Timeline. Ordinary navigation reuses
  /// the last confirmation; edits invalidate reads begun before their save.
  Future<TimelineResult<UserSettingsDto>> synchronize({
    bool refresh = false,
  }) async {
    final context = _context;
    if (!state.active) {
      return const TimelineResult.failed(
        TimelineFailure(TimelineFailureKind.cancelled),
      );
    }
    final edit = _edit;
    if (edit != null) {
      await edit.future;
      if (!ref.mounted || context != _context) {
        return const TimelineResult.failed(
          TimelineFailure(TimelineFailureKind.cancelled),
        );
      }
      return synchronize(refresh: refresh);
    }
    if (_settingsRead != null) return _settingsRead!;
    if (!refresh && state.loaded) {
      return TimelineResult.data(_confirmedSettings);
    }
    if (!refresh && _readFailure != null) {
      return TimelineResult.failed(_readFailure!);
    }
    final ticket = _generation;
    state = state.copyWith(
      loading: true,
      saveFailed: false,
      clearProblem: true,
    );
    final request = _readSettings(ticket);
    _settingsRead = request;
    try {
      return await request;
    } finally {
      if (identical(_settingsRead, request)) _settingsRead = null;
    }
  }

  UserSettingsDto get _confirmedSettings => UserSettingsDto(
    followedRepositories: [
      for (final repo in state.repositories)
        FollowedRepositoryDto(id: repo.id, owner: repo.owner, name: repo.name),
    ],
    releaseTimeline: _settings?.releaseTimeline,
  );

  Future<TimelineResult<UserSettingsDto>> _readSettings(int ticket) async {
    final context = _context;
    final names = Map.of(_nameVersions);
    final response = await ref
        .read(releaseTimelineServiceProvider)
        .readSettings();
    if (!_current(ticket)) {
      if (ref.mounted && context == _context && state.active && state.loaded) {
        return TimelineResult.data(_confirmedSettings);
      }
      return const TimelineResult.failed(
        TimelineFailure(TimelineFailureKind.cancelled),
      );
    }
    final settings = response.data;
    if (settings == null || settings.followedRepositories == null) {
      final failure =
          response.failure ??
          const TimelineFailure(TimelineFailureKind.invalidResponse);
      _readFailure = failure;
      state = state.copyWith(
        loading: false,
        problem: switch (failure.kind) {
          TimelineFailureKind.network => FollowProblem.network,
          TimelineFailureKind.rateLimited => FollowProblem.rateLimited,
          TimelineFailureKind.invalidResponse => FollowProblem.invalidResponse,
          TimelineFailureKind.cancelled => FollowProblem.cancelled,
          _ => FollowProblem.server,
        },
      );
      return TimelineResult.failed(failure);
    }
    _settings = settings;
    _publishConfirmed(
      _preserveNewerNames(mapFollowedRepositories(settings), names),
    );
    if (_detailed) unawaited(loadMetadata());
    return TimelineResult.data(_confirmedSettings);
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
    if (!state.active || state.saving || (!state.loaded && state.loading)) {
      return;
    }
    if (repository.id.trim().isEmpty ||
        repository.id.length > 240 ||
        !validRepositoryName(repository.owner, repository.name)) {
      state = state.copyWith(problem: FollowProblem.invalidRepository);
      return;
    }
    return _saveEdit((ticket, names) async {
      var repositories = await _service.readFollows();
      if (!_current(ticket)) return null;
      if (repositories.any((repo) => repo.id == repository.id)) {
        throw const FollowRequestFailure(FollowProblem.duplicate);
      }
      if (repositories.length >= 150) {
        throw const FollowRequestFailure(FollowProblem.storedLimit);
      }
      FollowMetadataResponseDto? metadata;
      try {
        if (repositories.isNotEmpty) {
          metadata = await _service.readMetadata(repositories);
        }
      } on FollowRequestFailure {
        // Transient failures still count toward the available-repository limit.
      }
      if (!_current(ticket)) return null;
      if (repositories
              .where(
                (repo) =>
                    metadata?.repositories[repo.id]?.status !=
                    RepositoryPageStatus.unavailable,
              )
              .length >=
          100) {
        throw const FollowRequestFailure(FollowProblem.validLimit);
      }
      repositories = [
        for (final repo in repositories)
          _renamed(repo, metadata?.repositories[repo.id]),
      ];
      repositories = _preserveNewerNames(repositories, names);
      return _service.saveFollows([repository, ...repositories]);
    });
  }

  /// Removes a Release Follow after the backend confirms the change.
  Future<void> unfollow(String repositoryId) => _saveEdit((ticket, _) async {
    final repositories = await _service.readFollows();
    if (!_current(ticket)) return null;
    return _service.saveFollows([
      for (final repo in repositories)
        if (repo.id != repositoryId) repo,
    ]);
  });

  Future<void> _saveEdit(
    Future<List<TimelineRepository>?> Function(
      int ticket,
      Map<String, int> names,
    )
    save,
  ) async {
    if (!state.active || state.saving || (!state.loaded && state.loading)) {
      return;
    }
    final ticket = ++_generation;
    final names = Map.of(_nameVersions);
    _settingsRead = null;
    final edit = _edit = Completer<void>();
    state = state.copyWith(
      saving: true,
      loading: false,
      saveFailed: false,
      clearProblem: true,
    );
    try {
      final saved = await save(ticket, names);
      if (!_current(ticket) || saved == null) return;
      _publishConfirmed(_preserveNewerNames(saved, names));
      if (_detailed) unawaited(loadMetadata());
    } on FollowRequestFailure catch (error) {
      if (_current(ticket)) {
        state = state.copyWith(
          saving: false,
          saveFailed: true,
          problem: error.problem,
        );
      }
    } finally {
      if (identical(_edit, edit)) _edit = null;
      edit.complete();
    }
  }

  List<TimelineRepository> _preserveNewerNames(
    List<TimelineRepository> repositories,
    Map<String, int> versions,
  ) {
    final current = {for (final repo in state.repositories) repo.id: repo};
    return [
      for (final repo in repositories)
        if (current.containsKey(repo.id) &&
            _nameVersions[repo.id] != versions[repo.id])
          current[repo.id]!
        else
          repo,
    ];
  }

  void _publishConfirmed(List<TimelineRepository> repositories) {
    _readFailure = null;
    _metadataRequests.clear();
    final previous = {for (final repo in state.repositories) repo.id: repo};
    final ids = repositories.map((repo) => repo.id).toSet();
    _members.removeWhere((id, _) => !ids.contains(id));
    _nameVersions.removeWhere((id, _) => !ids.contains(id));
    for (final repo in repositories) {
      if (!_members.containsKey(repo.id) ||
          previous[repo.id]?.fullName != repo.fullName) {
        _members[repo.id] = Object();
        _metadataRequests.remove(repo.id);
        _nameVersions[repo.id] = ++_nameVersion;
      }
    }
    state = state.copyWith(
      statuses: Map.unmodifiable(
        Map.of(state.statuses)..removeWhere((id, _) => !ids.contains(id)),
      ),
      details: Map.unmodifiable(
        Map.of(state.details)..removeWhere((id, _) => !ids.contains(id)),
      ),
      previousNames: Map.unmodifiable(
        Map.of(state.previousNames)..removeWhere((id, _) => !ids.contains(id)),
      ),
      clearProblem: true,
      clearMetadataProblem: repositories.isEmpty,
      repositories: List.unmodifiable(repositories),
      loaded: true,
      loading: false,
      saving: false,
    );
  }

  bool get _detailed =>
      ref.read(followedRepositoryViewProvider) ==
      FollowedRepositoryView.detailed;

  bool get synchronizationFailed => _readFailure != null;

  TimelineRepository _renamed(
    TimelineRepository repo,
    FollowMetadataDto? lookup,
  ) {
    if (lookup?.status != RepositoryPageStatus.available ||
        lookup?.owner == null ||
        lookup?.name == null ||
        !validRepositoryName(lookup!.owner!, lookup.name!)) {
      return repo;
    }
    return TimelineRepository(
      id: repo.id,
      owner: lookup.owner!,
      name: lookup.name!,
    );
  }

  /// Enriches current members only. Per-member tokens also reject results from
  /// before a removal/refollow, a newer name, or a newer metadata request.
  Future<void> loadMetadata({String? repositoryId}) async {
    if (!state.active || state.repositories.isEmpty) return;
    final context = _context;
    final epoch = _metadataTicket;
    final request = Object();
    final targets = [
      for (final repo in state.repositories)
        if (repositoryId == null || repo.id == repositoryId) repo,
    ];
    if (targets.isEmpty) return;
    final members = {for (final repo in targets) repo.id: _members[repo.id]};
    for (final repo in targets) {
      _metadataRequests[repo.id] = request;
    }
    bool eligible(String id) =>
        members.containsKey(id) &&
        members[id] == _members[id] &&
        _metadataRequests[id] == request;
    FollowMetadataResponseDto? response;
    FollowProblem? problem;
    try {
      response = await _service.readMetadata(targets);
    } on FollowRequestFailure catch (error) {
      problem = error.problem;
    }
    if (!ref.mounted || context != _context || epoch != _metadataTicket) return;
    if (!state.repositories.any((repo) => eligible(repo.id))) return;
    final statuses = Map.of(state.statuses);
    final details = Map.of(state.details);
    final previousNames = Map.of(state.previousNames);
    var renamed = false;
    final repositories = <TimelineRepository>[];
    for (final repo in state.repositories) {
      if (!eligible(repo.id)) {
        repositories.add(repo);
        continue;
      }
      _metadataRequests.remove(repo.id);
      final lookup = response?.repositories[repo.id];
      statuses[repo.id] = lookup?.status ?? RepositoryPageStatus.transient;
      final updated = _renamed(repo, lookup);
      if (lookup?.status == RepositoryPageStatus.available &&
          lookup?.owner != null &&
          lookup?.name != null &&
          validRepositoryName(lookup!.owner!, lookup.name!)) {
        details[repo.id] = FollowedRepositoryDetails(
          description: lookup.description,
          language: lookup.primaryLanguage,
          starCount: lookup.starCount,
        );
        if (updated.fullName != repo.fullName) {
          renamed = true;
          previousNames[repo.id] = repo.fullName;
          _members[repo.id] = Object();
          _nameVersions[repo.id] = ++_nameVersion;
        } else {
          previousNames.remove(repo.id);
        }
      } else {
        details.remove(repo.id);
        previousNames.remove(repo.id);
      }
      repositories.add(updated);
    }
    state = state.copyWith(
      repositories: renamed ? List.unmodifiable(repositories) : null,
      statuses: Map.unmodifiable(statuses),
      details: Map.unmodifiable(details),
      previousNames: Map.unmodifiable(previousNames),
      metadataProblem: problem,
      clearMetadataProblem: problem == null,
    );
  }
}
