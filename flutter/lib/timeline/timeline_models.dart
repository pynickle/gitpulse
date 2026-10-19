import 'dart:math' as math;

/// Changelog characters kept on a timeline card; the full notes stay available.
const releaseTimelineChangelogMaxLength = 500;

/// The display time zone the Release Timeline groups by.
///
/// The display time zone decides how releases are grouped by calendar date. It
/// never changes which releases are eligible, matching the web timeline.
class TimelineEnvironment {
  const TimelineEnvironment({required this.localDateKey});

  /// The device's local calendar date.
  factory TimelineEnvironment.system() =>
      TimelineEnvironment(localDateKey: systemLocalDateKey);

  /// The calendar date of an instant in the display time zone, as `yyyy-MM-dd`.
  final String Function(DateTime instant) localDateKey;
}

String systemLocalDateKey(DateTime instant) {
  final local = instant.toLocal();
  return '${local.year.toString().padLeft(4, '0')}-'
      '${local.month.toString().padLeft(2, '0')}-'
      '${local.day.toString().padLeft(2, '0')}';
}

/// A Followed Repository. [id] is GitHub's node id, which survives renames, so
/// display names never become cache or comparison identities.
class TimelineRepository {
  const TimelineRepository({
    required this.id,
    required this.owner,
    required this.name,
  });

  final String id;
  final String owner;
  final String name;

  String get fullName => '$owner/$name';

  /// Followed Repository identity is the stable GitHub node id alone, so a
  /// rename never reads as a different repository.
  @override
  bool operator ==(Object other) =>
      other is TimelineRepository && other.id == id;

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() => 'TimelineRepository($id, $fullName)';
}

/// One release as a repository page returns it, before its Followed Repository
/// identity is attached.
class ReleaseItem {
  const ReleaseItem({
    required this.id,
    required this.tagName,
    required this.name,
    required this.description,
    required this.publishedAt,
    required this.isDraft,
    required this.isPrerelease,
    required this.assetCount,
    required this.htmlUrl,
  });

  final int id;
  final String tagName;
  final String? name;
  final String? description;
  final DateTime? publishedAt;
  final bool isDraft;
  final bool isPrerelease;
  final int assetCount;
  final String? htmlUrl;

  /// Drafts and releases without a usable publication time never display.
  bool get isPublished => !isDraft && publishedAt != null;

  String get title {
    final trimmed = name?.trim();
    return trimmed == null || trimmed.isEmpty ? tagName : trimmed;
  }
}

/// A release placed on the Release Timeline.
class TimelineRelease {
  const TimelineRelease({
    required this.repository,
    required this.id,
    required this.tagName,
    required this.title,
    required this.publishedAt,
    required this.notes,
    required this.changelog,
    required this.changelogTruncated,
    required this.assetCount,
    required this.isPrerelease,
    required this.isOldestShown,
    required this.htmlUrl,
  });

  final TimelineRepository repository;
  final int id;
  final String tagName;
  final String title;
  final DateTime publishedAt;

  /// The complete release notes as fetched, kept for the release surfaces.
  final String notes;

  /// The card summary, truncated for display.
  final String changelog;
  final bool changelogTruncated;
  final int assetCount;
  final bool isPrerelease;

  /// True when this repository has older releases that were not loaded.
  final bool isOldestShown;
  final String? htmlUrl;

  String get key => '${repository.id}:$id';

  @override
  String toString() => 'TimelineRelease($key, $publishedAt)';
}

/// One calendar date of the Shared Timeline Window.
class TimelineGroup {
  const TimelineGroup({required this.date, required this.items});

  final String date;
  final List<TimelineRelease> items;
}

enum RepositoryPageStatus { available, unavailable, transient }

/// One Followed Repository's participation in a Timeline round.
class RepositoryPage {
  const RepositoryPage({
    required this.status,
    this.owner = '',
    this.name = '',
    this.hasOlderReleases = false,
    this.endCursor,
    this.incomplete = false,
    this.releases = const [],
  });

  final RepositoryPageStatus status;

  /// The repository's current identity, which replaces a stale Follow name.
  final String owner;
  final String name;

  /// Whether the backend reports further pages for this repository.
  final bool hasOlderReleases;
  final String? endCursor;

  /// True when the page carried an error alongside usable releases.
  final bool incomplete;
  final List<ReleaseItem> releases;

  bool get isAvailable => status == RepositoryPageStatus.available;

  /// Whether this page alone makes the round's results usable.
  bool get isUsable => isAvailable && (!incomplete || hasPublishedReleases);

  bool get hasPublishedReleases => releases.any((item) => item.isPublished);
}

/// The continuation state of the cycle currently being read.
class TimelineCycle {
  const TimelineCycle({
    this.pages = const {},
    this.failedIds = const {},
    this.windowLowerBound,
    this.partial = false,
    this.previousBaseline,
  });

  static const empty = TimelineCycle();

  final Map<String, RepositoryPage> pages;
  final Set<String> failedIds;

  /// The publication-time boundary of the Shared Timeline Window, in epoch
  /// milliseconds. Older releases stay buffered rather than displayed, so a
  /// repository that has not caught up cannot widen the window.
  final int? windowLowerBound;
  final bool partial;

  /// The Timeline Refresh Baseline captured for this cycle, fixed until a new
  /// cycle starts.
  final String? previousBaseline;

  TimelineCycle withFailed(Iterable<String> ids) => TimelineCycle(
    pages: pages,
    failedIds: {...failedIds, ...ids},
    windowLowerBound: windowLowerBound,
    partial: partial,
    previousBaseline: previousBaseline,
  );
}

/// The exposed window and continuation state after one coordinated round.
class TimelineRound {
  const TimelineRound({required this.cycle, required this.groups});

  final TimelineCycle cycle;
  final List<TimelineGroup> groups;
}

int compareTimelineReleases(TimelineRelease left, TimelineRelease right) {
  final byTime = right.publishedAt.compareTo(left.publishedAt);
  if (byTime != 0) return byTime;
  if (left.repository.id != right.repository.id) {
    return left.repository.id.compareTo(right.repository.id);
  }
  return left.id.compareTo(right.id);
}

({String text, bool truncated}) truncateReleaseNotes(String? description) {
  if (description == null || description.isEmpty) {
    return (text: '', truncated: false);
  }
  if (description.length <= releaseTimelineChangelogMaxLength) {
    return (text: description, truncated: false);
  }
  return (
    text: description.substring(0, releaseTimelineChangelogMaxLength),
    truncated: true,
  );
}

/// Assembles published releases from every available page, newest first by
/// publication time, grouped into consecutive display-time-zone dates.
List<TimelineGroup> assembleTimelineGroups(
  List<TimelineRepository> followedRepositories,
  Map<String, RepositoryPage> pages,
  TimelineEnvironment environment,
) {
  final items = <TimelineRelease>[];

  for (final followed in followedRepositories) {
    final page = pages[followed.id];
    if (page == null || !page.isAvailable) continue;

    final repository = TimelineRepository(
      id: followed.id,
      owner: page.owner.isNotEmpty ? page.owner : followed.owner,
      name: page.name.isNotEmpty ? page.name : followed.name,
    );
    final published = page.releases.where((item) => item.isPublished).toList();
    final oldest = published.isEmpty
        ? null
        : published.reduce(
            (current, item) => item.publishedAt!.isBefore(current.publishedAt!)
                ? item
                : current,
          );

    for (final item in published) {
      final changelog = truncateReleaseNotes(item.description);
      items.add(
        TimelineRelease(
          repository: repository,
          id: item.id,
          tagName: item.tagName,
          title: item.title,
          publishedAt: item.publishedAt!,
          notes: item.description ?? '',
          changelog: changelog.text,
          changelogTruncated: changelog.truncated,
          assetCount: item.assetCount,
          isPrerelease: item.isPrerelease,
          isOldestShown: page.hasOlderReleases && oldest?.id == item.id,
          htmlUrl: item.htmlUrl,
        ),
      );
    }
  }

  items.sort(compareTimelineReleases);

  final groups = <TimelineGroup>[];
  for (final item in items) {
    final date = environment.localDateKey(item.publishedAt);
    if (groups.isNotEmpty && groups.last.date == date) {
      groups.last.items.add(item);
      continue;
    }
    groups.add(TimelineGroup(date: date, items: [item]));
  }

  return groups;
}

/// Merges one coordinated round into the cycle.
///
/// A refresh starts from an empty window; any other round folds the requested
/// repositories into the cycle that is already being read.
TimelineRound mergeTimelineRound({
  required TimelineCycle cycle,
  required List<TimelineRepository> followedRepositories,
  required Map<String, RepositoryPage> pages,
  required List<String> requestedIds,
  required bool refresh,
  required TimelineEnvironment environment,
  String? capturedBaseline,
  Map<String, RepositoryPage> retainedPages = const {},
}) {
  final before = refresh ? TimelineCycle.empty : cycle;
  final nextPages = {...before.pages};
  final failed = {...before.failedIds};

  for (final id in requestedIds) {
    final page = pages[id];
    if (page == null || !page.isAvailable) {
      failed.add(id);
      continue;
    }
    if (page.incomplete) {
      failed.add(id);
    } else {
      failed.remove(id);
    }
    final previous = nextPages[id];
    final records = <int, ReleaseItem>{
      for (final item
          in previous != null && previous.isAvailable
              ? previous.releases
              : const <ReleaseItem>[])
        item.id: item,
    };
    for (final item in page.releases) {
      records[item.id] = item;
    }
    nextPages[id] = RepositoryPage(
      status: RepositoryPageStatus.available,
      owner: page.owner,
      name: page.name,
      // A partially failed page keeps its previous continuation state.
      hasOlderReleases: page.incomplete ? true : page.hasOlderReleases,
      endCursor: page.incomplete
          ? (previous != null && previous.isAvailable
                ? previous.endCursor
                : null)
          : page.endCursor,
      incomplete: page.incomplete,
      releases: records.values.toList(),
    );
  }

  nextPages.addAll(retainedPages);
  final assembled = assembleTimelineGroups(
    followedRepositories,
    nextPages,
    environment,
  );
  final items = [
    for (final group in assembled)
      for (final item in group.items) item,
  ];

  // The window boundary is the latest of each contributing repository's own
  // earliest fetched publication time. Exhausted repositories and those that
  // failed this round do not constrain it.
  final earliestByRepository = <String, int>{};
  for (final item in items) {
    final published = item.publishedAt.millisecondsSinceEpoch;
    final current = earliestByRepository[item.repository.id];
    earliestByRepository[item.repository.id] = current == null
        ? published
        : math.min(current, published);
  }

  final windowConstraints = <int>[];
  for (final entry in nextPages.entries) {
    final page = entry.value;
    if (!page.isAvailable || !page.hasOlderReleases) continue;
    if (failed.contains(entry.key)) continue;
    final earliest = earliestByRepository[entry.key];
    if (earliest != null) windowConstraints.add(earliest);
  }

  int? candidateBoundary;
  if (windowConstraints.isNotEmpty) {
    candidateBoundary = windowConstraints.reduce(math.max);
  } else if (items.isNotEmpty) {
    candidateBoundary = items
        .map((item) => item.publishedAt.millisecondsSinceEpoch)
        .reduce(math.min);
  }

  final int? windowLowerBound;
  if (before.windowLowerBound == null) {
    windowLowerBound = candidateBoundary;
  } else if (candidateBoundary == null) {
    windowLowerBound = before.windowLowerBound;
  } else {
    windowLowerBound = math.min(before.windowLowerBound!, candidateBoundary);
  }

  final partial = followedRepositories.any((followed) {
    final page = nextPages[followed.id];
    if (failed.contains(followed.id) || page == null || !page.isAvailable) {
      return true;
    }
    if (!page.hasOlderReleases) return false;
    final earliest = earliestByRepository[followed.id];
    return earliest == null ||
        (windowLowerBound != null && earliest > windowLowerBound);
  });

  final groups = <TimelineGroup>[];
  for (final group in assembled) {
    final visible = group.items
        .where(
          (item) =>
              windowLowerBound == null ||
              item.publishedAt.millisecondsSinceEpoch >= windowLowerBound,
        )
        .toList();
    if (visible.isNotEmpty) {
      groups.add(TimelineGroup(date: group.date, items: visible));
    }
  }

  return TimelineRound(
    cycle: TimelineCycle(
      pages: nextPages,
      failedIds: failed,
      windowLowerBound: windowLowerBound,
      partial: partial,
      previousBaseline: refresh
          ? (capturedBaseline ?? before.previousBaseline)
          : before.previousBaseline,
    ),
    groups: groups,
  );
}

/// Distinct exposed releases published after the cycle's captured baseline.
int countLoadedNewReleases(
  List<TimelineGroup> groups,
  String? previousBaseline,
) {
  if (previousBaseline == null) return 0;
  final baseline = DateTime.tryParse(previousBaseline);
  if (baseline == null) return 0;
  final keys = <String>{};
  for (final group in groups) {
    for (final item in group.items) {
      if (item.publishedAt.isAfter(baseline)) keys.add(item.key);
    }
  }
  return keys.length;
}

/// Whether the previous refresh sits inside the exposed window, so its marker
/// can be placed at its publication-time position.
bool isBaselineExposed(String? previousBaseline, int? windowLowerBound) {
  if (previousBaseline == null || windowLowerBound == null) return false;
  final baseline = DateTime.tryParse(previousBaseline);
  if (baseline == null) return false;
  return baseline.millisecondsSinceEpoch >= windowLowerBound;
}
