import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../session/session_controller.dart';
import '../session/account_identity.dart';
import '../repositories/repository_models.dart';
import 'followed_repository_view.dart';
import 'release_follows_service.dart';
import 'release_follows_dto.dart';
import 'release_follows_state.dart';

final releaseFollowsSessionProvider =
    NotifierProvider<ReleaseFollowsSession, ReleaseFollowsState>(
      ReleaseFollowsSession.new,
    );

/// The account's sole confirmation authority for Release Follows.
class ReleaseFollowsSession extends Notifier<ReleaseFollowsState> {
  int _generation = 0;
  int _metadataTicket = 0;
  AccountIdentity? _context;
  Future<FollowCollectionResult>? _settingsRead;
  FollowProblem? _readFailure;
  Completer<FollowCollectionResult>? _edit;
  Future<FollowCollectionResult>? _lastEdit;
  final Map<String, Object> _members = {};
  final Map<String, Object> _metadataRequests = {};
  final Map<String, int> _nameVersions = {};
  int _nameVersion = 0;

  ReleaseFollowsService get _service => ref.read(releaseFollowsServiceProvider);

  @override
  ReleaseFollowsState build() {
    ref.onDispose(() {
      _generation++;
      _metadataTicket++;
    });
    ref.listen(sessionControllerProvider, (_, next) {
      final context = _sessionContext();
      if (context == _context) return;
      _context = context;
      _generation++;
      _metadataTicket++;
      _settingsRead = null;
      _readFailure = null;
      _members.clear();
      _metadataRequests.clear();
      _nameVersions.clear();
      _edit = null;
      _lastEdit = null;
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

  AccountIdentity? _sessionContext() {
    final session = ref.read(sessionControllerProvider);
    final identity = session.identity;
    return session.phase == SessionPhase.signedIn && identity != null
        ? identity.account
        : null;
  }

  bool _current(int ticket) => ref.mounted && ticket == _generation;

  /// Explicitly synchronizes the account's collection, independently of details.
  Future<void> reload() async {
    await synchronize(refresh: true);
  }

  /// Confirms the account's collection, sharing overlapping reads.
  ///
  /// Ordinary navigation reuses the last confirmation. A refresh reads remotely
  /// unless an overlapping edit supplies its outcome instead: synchronization
  /// waits for that edit, then returns its confirmed collection or failure
  /// without another read.
  Future<FollowCollectionResult> synchronize({bool refresh = false}) async {
    final context = _context;
    if (!state.active) {
      return const FollowCollectionResult.failed(FollowProblem.cancelled);
    }
    final edit = _edit;
    if (edit != null) {
      return _afterEdit(edit.future, context);
    }
    if (_settingsRead != null) return _settingsRead!;
    if (!refresh && state.loaded) {
      return FollowCollectionResult.confirmed(state.repositories);
    }
    if (!refresh && _readFailure != null) {
      return FollowCollectionResult.failed(_readFailure!);
    }
    final ticket = _generation;
    // A failed collection read owns the followed list until this read finishes.
    // Clearing it here would put that list back for the whole retry. A save
    // failure is not that page: the confirmed list stays up, so its notice
    // leaves as soon as another read starts.
    state = state.copyWith(
      loading: true,
      saveFailed: false,
      clearProblem: state.saveFailed,
    );
    final request = _readSettings(ticket);
    _settingsRead = request;
    try {
      return await request;
    } finally {
      if (identical(_settingsRead, request)) _settingsRead = null;
    }
  }

  Future<FollowCollectionResult> _afterEdit(
    Future<FollowCollectionResult> edit,
    AccountIdentity? context,
  ) async {
    final result = await edit;
    if (!ref.mounted || context != _context || !state.active) {
      return const FollowCollectionResult.failed(FollowProblem.cancelled);
    }
    return result.problem == null
        ? FollowCollectionResult.confirmed(state.repositories)
        : result;
  }

  Future<FollowCollectionResult> _readSettings(int ticket) async {
    final context = _context;
    final names = Map.of(_nameVersions);
    List<RepositoryReference>? repositories;
    FollowProblem? problem;
    try {
      repositories = await _service.readFollows();
    } on FollowRequestFailure catch (error) {
      problem = error.problem;
    }
    if (!_current(ticket)) {
      if (ref.mounted && context == _context && _lastEdit != null) {
        return _afterEdit(_lastEdit!, context);
      }
      return const FollowCollectionResult.failed(FollowProblem.cancelled);
    }
    if (repositories == null) {
      final failure = problem ?? FollowProblem.invalidResponse;
      _readFailure = failure;
      state = state.copyWith(loading: false, problem: failure);
      return FollowCollectionResult.failed(failure);
    }
    _publishConfirmed(_preserveNewerNames(repositories, names));
    if (_detailed) unawaited(loadMetadata());
    return FollowCollectionResult.confirmed(state.repositories);
  }

  /// Adds a Release Follow after checking the latest shared list and limits.
  Future<void> follow(RepositoryReference repository) async {
    if (!state.active || state.editBlocked) {
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
                    RepositoryQueryStatus.unavailable,
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
    Future<List<RepositoryReference>?> Function(
      int ticket,
      Map<String, int> names,
    )
    save,
  ) async {
    if (!state.active || state.editBlocked) {
      return;
    }
    final ticket = ++_generation;
    final names = Map.of(_nameVersions);
    _settingsRead = null;
    final edit = _edit = Completer<FollowCollectionResult>();
    _lastEdit = edit.future;
    var result = const FollowCollectionResult.failed(FollowProblem.cancelled);
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
      result = FollowCollectionResult.confirmed(state.repositories);
      if (_detailed) unawaited(loadMetadata());
    } on FollowRequestFailure catch (error) {
      result = FollowCollectionResult.failed(error.problem);
      if (_current(ticket)) {
        state = state.copyWith(
          saving: false,
          saveFailed: true,
          problem: error.problem,
        );
      }
    } finally {
      if (identical(_edit, edit)) _edit = null;
      edit.complete(result);
    }
  }

  List<RepositoryReference> _preserveNewerNames(
    List<RepositoryReference> repositories,
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

  void _publishConfirmed(List<RepositoryReference> repositories) {
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

  RepositoryReference _renamed(
    RepositoryReference repo,
    FollowMetadataDto? lookup,
  ) {
    if (lookup?.status != RepositoryQueryStatus.available ||
        lookup?.owner == null ||
        lookup?.name == null ||
        !validRepositoryName(lookup!.owner!, lookup.name!)) {
      return repo;
    }
    return RepositoryReference(
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
    final repositories = <RepositoryReference>[];
    for (final repo in state.repositories) {
      if (!eligible(repo.id)) {
        repositories.add(repo);
        continue;
      }
      _metadataRequests.remove(repo.id);
      final lookup = response?.repositories[repo.id];
      statuses[repo.id] = lookup?.status ?? RepositoryQueryStatus.transient;
      final updated = _renamed(repo, lookup);
      if (lookup?.status == RepositoryQueryStatus.available &&
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
