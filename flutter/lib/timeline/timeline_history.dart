import 'timeline_models.dart';

/// Retained page provenance captured before a refresh writes any new records.
class RetainedTimelineHistory {
  const RetainedTimelineHistory({this.repositories = const {}});

  final Map<String, RetainedRepositoryHistory> repositories;
}

class RetainedRepositoryHistory {
  const RetainedRepositoryHistory({
    required this.releases,
    required this.pages,
  });

  final Map<int, ReleaseItem> releases;
  final List<RetainedTimelinePage> pages;
}

class RetainedTimelinePage {
  const RetainedTimelinePage({
    required this.id,
    required this.cycle,
    required this.requestCursor,
    required this.endCursor,
    required this.hasOlder,
    required this.incomplete,
    required this.members,
  });

  final int id;
  final String cycle;
  final String? requestCursor;
  final String? endCursor;
  final bool hasOlder;
  final bool incomplete;
  final Set<int> members;
}

/// Connects only retained page suffixes reachable from the live fetched chain.
class TimelineHistoryConnection {
  TimelineHistoryConnection(this._history) {
    for (final entry in _history.repositories.entries) {
      _eligible[entry.key] = entry.value.releases.keys.toSet();
      _graphs[entry.key] = _RetainedPageGraph(entry.value.pages);
    }
  }

  RetainedTimelineHistory _history;
  final _reached = <String, Set<int>>{};
  final obsoleteRepositories = <String>{};
  final _unavailable = <String>{};
  final _eligible = <String, Set<int>>{};
  final _graphs = <String, _RetainedPageGraph>{};
  final _anchors = <String, Set<int>>{};
  final _fetched = <String, Map<int, ReleaseItem>>{};
  final _fetchedPages = <String, Map<String?, RepositoryPage>>{};
  final _exhausted = <String>{};

  void retainRepositories(Set<String> ids) {
    _history = RetainedTimelineHistory(
      repositories: {
        for (final entry in _history.repositories.entries)
          if (ids.contains(entry.key)) entry.key: entry.value,
      },
    );
    for (final map in [_reached, _eligible, _anchors]) {
      map.removeWhere((id, _) => !ids.contains(id));
    }
    _graphs.removeWhere((id, _) => !ids.contains(id));
    _fetched.removeWhere((id, _) => !ids.contains(id));
    _fetchedPages.removeWhere((id, _) => !ids.contains(id));
    for (final idsToKeep in [obsoleteRepositories, _unavailable, _exhausted]) {
      idsToKeep.retainAll(ids);
    }
  }

  Set<String> get waitingRepositories => {
    ..._unavailable,
    for (final entry in _history.repositories.entries)
      if (_eligible[entry.key]!.isNotEmpty &&
          !obsoleteRepositories.contains(entry.key) &&
          (_reached[entry.key]?.isEmpty ?? true))
        entry.key,
  };

  bool get connected => waitingRepositories.isEmpty;

  bool get hasRetainedHistory => _history.repositories.keys.any(
    (id) => _eligible[id]!.isNotEmpty && !obsoleteRepositories.contains(id),
  );

  void accept(
    Map<String, RepositoryPage> pages, {
    required DateTime cutoff,
    Map<String, String?> cursors = const {},
  }) {
    for (final entry in pages.entries) {
      final page = entry.value;
      if (page.status == RepositoryPageStatus.unavailable) {
        _unavailable.add(entry.key);
      } else if (page.isAvailable && !page.incomplete) {
        _unavailable.remove(entry.key);
      }
      if (!page.isAvailable) continue;
      final fetchedPages = _fetchedPages.putIfAbsent(entry.key, () => {});
      // A retry replaces that page's membership; insertion order preserves the
      // latest fetched content if a release occurs on more than one page.
      fetchedPages.remove(cursors[entry.key]);
      fetchedPages[cursors[entry.key]] = page;
      _fetched[entry.key] = {
        for (final fetchedPage in fetchedPages.values)
          for (final item in fetchedPage.releases) item.id: item,
      };
      _anchors[entry.key] = {
        for (final fetchedPage in fetchedPages.values)
          if (!fetchedPage.incomplete)
            for (final item in fetchedPage.releases) item.id,
      };
      if (fetchedPages.values.any(
        (page) => !page.incomplete && !page.hasOlderReleases,
      )) {
        _exhausted.add(entry.key);
        obsoleteRepositories.add(entry.key);
      }
    }
    for (final entry in _history.repositories.entries) {
      final fetched = _fetched[entry.key] ?? const <int, ReleaseItem>{};
      final eligible = _eligible[entry.key] = {
        for (final item in entry.value.releases.values)
          if (!item.publishedAt!.isBefore(cutoff) &&
              (!fetched.containsKey(item.id) ||
                  (fetched[item.id]!.isPublished &&
                      !fetched[item.id]!.publishedAt!.isBefore(cutoff))))
            item.id,
      };
      // Only actual fetched records seed the graph. Cached extension records in
      // the displayed cycle must never certify their own reachability.
      _reached[entry.key] = _graphs[entry.key]!.reach(
        (_anchors[entry.key] ?? const <int>{}).intersection(eligible),
        eligible,
      );
    }
  }

  Map<String, RepositoryPage> extensionPages(
    TimelineCycle cycle, {
    required DateTime now,
    required int retentionDays,
  }) {
    final cutoff = now.toUtc().subtract(Duration(days: retentionDays));
    final result = <String, RepositoryPage>{};
    for (final id in {..._history.repositories.keys, ..._exhausted}) {
      final retained = _history.repositories[id];
      final live = cycle.pages[id];
      if (live == null) continue;
      final exhausted = obsoleteRepositories.contains(id);
      if (!exhausted && !connected) continue;
      final reached = _reached[id] ?? const <int>{};
      final members = {
        for (final page in retained?.pages ?? const <RetainedTimelinePage>[])
          if (reached.contains(page.id)) ...page.members,
      };
      result[id] = RepositoryPage(
        status: live.status,
        owner: live.owner,
        name: live.name,
        // Keep the live cursor: old cursor strings alone cannot prove that a
        // new upstream page chain has reached another retained segment.
        hasOlderReleases: live.hasOlderReleases,
        endCursor: live.endCursor,
        incomplete: live.incomplete,
        // Exhaustion is authoritative even if another repository is waiting.
        // Use fetched records, excluding cached tails merged earlier this cycle.
        releases: exhausted
            ? (_fetched[id]?.values.toList() ?? const [])
            : {
                for (final item
                    in retained?.releases.values ?? const <ReleaseItem>[])
                  if (members.contains(item.id) &&
                      !item.publishedAt!.isBefore(cutoff))
                    item.id: item,
                for (final item in live.releases) item.id: item,
              }.values.toList(),
      );
    }
    return result;
  }
}

class _RetainedPageGraph {
  _RetainedPageGraph(List<RetainedTimelinePage> pages) {
    for (final page in pages) {
      if (page.incomplete) continue;
      for (final id in page.members) {
        _members.putIfAbsent(id, () => []).add(page);
      }
      _continuations
          .putIfAbsent((page.cycle, page.requestCursor), () => [])
          .add(page);
    }
  }

  final _members = <int, List<RetainedTimelinePage>>{};
  final _continuations = <(String, String?), List<RetainedTimelinePage>>{};

  Set<int> reach(Set<int> anchors, Set<int> eligible) {
    final reached = <int>{};
    final pending = <RetainedTimelinePage>[];
    final expandedMembers = <int>{};
    void enqueue(Iterable<RetainedTimelinePage> pages) {
      for (final page in pages) {
        if (reached.add(page.id)) pending.add(page);
      }
    }

    void expandMember(int id) {
      if (eligible.contains(id) && expandedMembers.add(id)) {
        enqueue(_members[id] ?? const []);
      }
    }

    for (final id in anchors) {
      expandMember(id);
    }
    while (pending.isNotEmpty) {
      final page = pending.removeLast();
      for (final id in page.members) {
        expandMember(id);
      }
      if (page.hasOlder && page.endCursor != null) {
        enqueue(_continuations[(page.cycle, page.endCursor)] ?? const []);
      }
    }
    return reached;
  }
}
