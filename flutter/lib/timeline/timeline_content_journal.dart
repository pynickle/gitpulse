part of 'timeline_content.dart';

final class _FetchedPageJournal {
  final List<TimelineCachePage> _pages = [];
  int _committed = 0;
  bool _saveFailed = false;

  bool get hasPages => _pages.isNotEmpty;
  bool get needsSaving => _saveFailed || _committed < _pages.length;
  List<TimelineCachePage> get pending => _pages.skip(_committed).toList();

  void clear() {
    _pages.clear();
    _committed = 0;
    _saveFailed = false;
  }

  void append(Map<String, RepositoryPage> pages, Map<String, String?> cursors) {
    _pages.addAll([
      for (final entry in pages.entries)
        (
          repositoryId: entry.key,
          cursor: cursors[entry.key],
          page: entry.value,
        ),
    ]);
  }

  void acknowledge() {
    _committed = _pages.length;
    _saveFailed = false;
  }

  void failedSaving() {
    _saveFailed = true;
  }

  void forgetCommit() {
    _committed = 0;
  }

  void retainRepositories(Map<String, RepositoryReference> byId) {
    _committed = _pages
        .take(_committed)
        .where((page) => byId.containsKey(page.repositoryId))
        .length;
    _pages.removeWhere((page) => !byId.containsKey(page.repositoryId));
    for (var i = 0; i < _pages.length; i++) {
      final entry = _pages[i];
      _pages[i] = (
        repositoryId: entry.repositoryId,
        cursor: entry.cursor,
        page: entry.page.withRepository(byId[entry.repositoryId]!),
      );
    }
  }

  void replayConnection(TimelineHistoryConnection connection, DateTime cutoff) {
    for (final entry in _pages) {
      connection.accept(
        {entry.repositoryId: entry.page},
        cutoff: cutoff,
        cursors: {entry.repositoryId: entry.cursor},
      );
    }
  }

  TimelineRound replayContent({
    required List<RepositoryReference> repositories,
    required TimelineEnvironment environment,
    required Set<String> failedIds,
    required String? previousBaseline,
  }) {
    var recovered = TimelineRound(cycle: TimelineCycle.empty, groups: const []);
    for (final entry in _pages) {
      recovered = mergeTimelineRound(
        cycle: recovered.cycle,
        followedRepositories: repositories,
        pages: {entry.repositoryId: entry.page},
        requestedIds: [entry.repositoryId],
        refresh: false,
        environment: environment,
      );
    }
    return mergeTimelineRound(
      cycle: TimelineCycle(
        pages: recovered.cycle.pages,
        failedIds: failedIds,
        previousBaseline: previousBaseline,
      ),
      followedRepositories: repositories,
      pages: const {},
      requestedIds: const [],
      refresh: false,
      environment: environment,
    );
  }
}
