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
  TimelineHistoryConnection(this.history) {
    for (final entry in history.repositories.entries) {
      _eligible[entry.key] = entry.value.releases.keys.toSet();
      _graphs[entry.key] = _RetainedPageGraph(entry.value.pages);
    }
  }

  final RetainedTimelineHistory history;
  final _reached = <String, Set<int>>{};
  final obsoleteRepositories = <String>{};
  final _unavailable = <String>{};
  final _eligible = <String, Set<int>>{};
  final _graphs = <String, _RetainedPageGraph>{};
  final _anchors = <String, Set<int>>{};
  final _fetched = <String, Map<int, ReleaseItem>>{};
  final _exhausted = <String>{};

  Set<String> get waitingRepositories => {
    ..._unavailable,
    for (final entry in history.repositories.entries)
      if (_eligible[entry.key]!.isNotEmpty &&
          !obsoleteRepositories.contains(entry.key) &&
          (_reached[entry.key]?.isEmpty ?? true))
        entry.key,
  };

  bool get connected => waitingRepositories.isEmpty;

  bool get hasRetainedHistory => history.repositories.keys.any(
    (id) => _eligible[id]!.isNotEmpty && !obsoleteRepositories.contains(id),
  );

  void accept(Map<String, RepositoryPage> pages, {required DateTime cutoff}) {
    for (final entry in pages.entries) {
      final page = entry.value;
      if (page.status == RepositoryPageStatus.unavailable) {
        _unavailable.add(entry.key);
      } else if (page.isAvailable && !page.incomplete) {
        _unavailable.remove(entry.key);
      }
      if (!history.repositories.containsKey(entry.key) || !page.isAvailable) {
        continue;
      }
      final fetched = _fetched.putIfAbsent(entry.key, () => {});
      for (final item in page.releases) {
        fetched[item.id] = item;
      }
      if (page.incomplete) continue;
      _anchors
          .putIfAbsent(entry.key, () => {})
          .addAll(page.releases.map((item) => item.id));
      if (!page.hasOlderReleases) _exhausted.add(entry.key);
    }
    for (final entry in history.repositories.entries) {
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
      final reached = _reached[entry.key] = _graphs[entry.key]!.reach(
        (_anchors[entry.key] ?? const <int>{}).intersection(eligible),
        eligible,
      );
      if (reached.isEmpty && _exhausted.contains(entry.key)) {
        obsoleteRepositories.add(entry.key);
      }
    }
  }

  Map<String, RepositoryPage> extensionPages(
    TimelineCycle cycle, {
    required DateTime now,
    required int retentionDays,
  }) {
    if (!connected) return const {};
    final cutoff = now.toUtc().subtract(Duration(days: retentionDays));
    final result = <String, RepositoryPage>{};
    for (final entry in history.repositories.entries) {
      if (obsoleteRepositories.contains(entry.key)) continue;
      final live = cycle.pages[entry.key];
      if (live == null) continue;
      final reached = _reached[entry.key] ?? const <int>{};
      final members = {
        for (final page in entry.value.pages)
          if (reached.contains(page.id)) ...page.members,
      };
      result[entry.key] = RepositoryPage(
        status: live.status,
        owner: live.owner,
        name: live.name,
        // Keep the live cursor: old cursor strings alone cannot prove that a
        // new upstream page chain has reached another retained segment.
        hasOlderReleases: live.hasOlderReleases,
        endCursor: live.endCursor,
        incomplete: live.incomplete,
        releases: {
          for (final item in entry.value.releases.values)
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
