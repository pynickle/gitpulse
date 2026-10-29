import 'timeline_models.dart';

/// The Release Timeline Filter and Release Timeline Search conditions applied
/// to the exposed Shared Timeline Window.
///
/// Conditions combine with AND across dimensions; selected repositories are OR
/// within their own dimension.
class TimelineFilterState {
  const TimelineFilterState({
    this.repositoryIds = const <String>[],
    this.dateRange = const TimelineDateRange(),
    this.query = '',
    this.includeReleaseNotes = false,
    this.hidePrereleases = false,
  });

  /// Selected stable GitHub node ids, so a repository rename never drops the
  /// selection.
  final List<String> repositoryIds;

  /// Inclusive published-date bounds as display-time-zone `yyyy-MM-dd` keys.
  final TimelineDateRange dateRange;

  /// Required search terms across the enabled fields.
  final String query;

  /// Add the complete release notes to the default searchable fields.
  final bool includeReleaseNotes;

  /// Hide releases GitHub marks as prereleases.
  final bool hidePrereleases;

  /// The structural filters, matching `hasActiveTimelineFilter` on the web.
  bool get hasActiveTimelineFilter =>
      repositoryIds.isNotEmpty || !dateRange.isEmpty || hidePrereleases;

  TimelineFilterState copyWith({
    List<String>? repositoryIds,
    TimelineDateRange? dateRange,
    String? query,
    bool? includeReleaseNotes,
    bool? hidePrereleases,
  }) => TimelineFilterState(
    repositoryIds: repositoryIds ?? this.repositoryIds,
    dateRange: dateRange ?? this.dateRange,
    query: query ?? this.query,
    includeReleaseNotes: includeReleaseNotes ?? this.includeReleaseNotes,
    hidePrereleases: hidePrereleases ?? this.hidePrereleases,
  );

  @override
  bool operator ==(Object other) =>
      other is TimelineFilterState &&
      _sameList(other.repositoryIds, repositoryIds) &&
      other.dateRange == dateRange &&
      other.query == query &&
      other.includeReleaseNotes == includeReleaseNotes &&
      other.hidePrereleases == hidePrereleases;

  @override
  int get hashCode => Object.hash(
    Object.hashAll(repositoryIds),
    dateRange,
    query,
    includeReleaseNotes,
    hidePrereleases,
  );
}

/// Inclusive published-date bounds as display-time-zone `yyyy-MM-dd` keys.
///
/// Either bound may be absent, so a one-sided range is possible.
class TimelineDateRange {
  const TimelineDateRange({this.from, this.to});

  final String? from;
  final String? to;

  bool get isEmpty => from == null && to == null;

  /// Sets the lower bound, dropping an upper bound that would invert the range.
  TimelineDateRange withFrom(String value) {
    final currentTo = to;
    return TimelineDateRange(
      from: value,
      to: currentTo != null && currentTo.compareTo(value) < 0
          ? null
          : currentTo,
    );
  }

  /// Sets the upper bound, dropping a lower bound that would invert the range.
  TimelineDateRange withTo(String value) {
    final currentFrom = from;
    return TimelineDateRange(
      from: currentFrom != null && currentFrom.compareTo(value) > 0
          ? null
          : currentFrom,
      to: value,
    );
  }

  @override
  bool operator ==(Object other) =>
      other is TimelineDateRange && other.from == from && other.to == to;

  @override
  int get hashCode => Object.hash(from, to);
}

/// Parses a `yyyy-MM-dd` key as a local calendar date, without shifting zones.
DateTime? parseTimelineDateKey(String key) {
  final match = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$').firstMatch(key);
  if (match == null) return null;
  final year = int.parse(match.group(1)!);
  final month = int.parse(match.group(2)!);
  final day = int.parse(match.group(3)!);
  final date = DateTime(year, month, day);
  if (date.year != year || date.month != month || date.day != day) return null;
  return date;
}

/// The enabled search fields of one exposed release.
class TimelineSearchFields {
  const TimelineSearchFields({required this.defaults, required this.notes});

  /// Repository identity, title, and tag, normalized for matching.
  final List<String> defaults;

  /// The complete release notes' readable text, normalized for matching.
  final String notes;
}

/// Normalized search fields for the releases of one exposed window.
///
/// Release-note text is supplied by the backend and retained with the window.
class PreparedTimelineSearch {
  PreparedTimelineSearch._(this._defaults, this._notes);

  factory PreparedTimelineSearch.fromGroups(List<TimelineGroup> groups) {
    final notes = <String, String>{};
    final defaults = <String, List<String>>{};
    for (final group in groups) {
      for (final item in group.items) {
        notes[item.key] = item.notesSearchText;
        defaults[item.key] = [
          '${item.repository.owner}/${item.repository.name}',
          item.title,
          item.tagName,
        ].map(normalizeTimelineSearchText).toList(growable: false);
      }
    }
    return PreparedTimelineSearch._(defaults, notes);
  }

  final Map<String, List<String>> _defaults;
  final Map<String, String> _notes;

  TimelineSearchFields? fieldsFor(String key, {required bool includeNotes}) {
    final defaults = _defaults[key];
    if (defaults == null) return null;
    return TimelineSearchFields(
      defaults: defaults,
      notes: includeNotes ? _notes[key]! : '',
    );
  }
}

bool _sameList(List<String> left, List<String> right) {
  if (left.length != right.length) return false;
  for (var index = 0; index < left.length; index++) {
    if (left[index] != right[index]) return false;
  }
  return true;
}

final _whitespacePattern = RegExp(r'\s+');
final _digitPattern = RegExp(r'\d');

/// Lowercase, collapse repeated whitespace, and trim, as the web timeline does.
String normalizeTimelineSearchText(String value) =>
    value.toLowerCase().replaceAll(_whitespacePattern, ' ').trim();

/// One required query term. A version-like term must not cut through digits.
class TimelineSearchTerm {
  const TimelineSearchTerm({required this.text, required this.versionLike});

  final String text;
  final bool versionLike;
}

final _searchTermPattern = RegExp(r'"([^"]*)"?|([^\s"]+)');
final _versionPattern = RegExp(r'^v?\d+(?:\.\d+)+(?:[-+][\da-z.-]+)?$');

/// Double-quoted text is one contiguous phrase; other terms split on
/// whitespace. An unfinished quoted phrase extends to the end of the query.
List<TimelineSearchTerm> parseTimelineSearchTerms(String query) {
  final terms = <TimelineSearchTerm>[];
  for (final match in _searchTermPattern.allMatches(query)) {
    final text = normalizeTimelineSearchText(match.group(1) ?? match.group(2)!);
    if (text.isEmpty) continue;
    terms.add(
      TimelineSearchTerm(
        text: text,
        versionLike: _versionPattern.hasMatch(text),
      ),
    );
  }
  return terms;
}

bool _matchesSearchTerm(String field, TimelineSearchTerm term) {
  var position = field.indexOf(term.text);
  while (position != -1) {
    if (!term.versionLike) return true;
    final before = position == 0 ? '' : field[position - 1];
    final afterIndex = position + term.text.length;
    final after = afterIndex >= field.length ? '' : field[afterIndex];
    if (!_digitPattern.hasMatch(before) && !_digitPattern.hasMatch(after)) {
      return true;
    }
    position = field.indexOf(term.text, position + 1);
  }
  return false;
}

/// Applies the Release Timeline Filter and Search to the exposed window.
///
/// The exposed [groups] are never mutated. When no condition is active the
/// same list is returned, so callers can keep the previous identity.
List<TimelineGroup> filterTimelineGroups(
  List<TimelineGroup> groups,
  TimelineFilterState filters, {
  PreparedTimelineSearch? prepared,
}) {
  final terms = parseTimelineSearchTerms(filters.query);
  final selectedRepositories = filters.repositoryIds.toSet();
  final from = filters.dateRange.from;
  final to = filters.dateRange.to;

  final hasRepositoryFilter = selectedRepositories.isNotEmpty;
  final hasDateFilter = from != null || to != null;
  final hasQueryFilter = terms.isNotEmpty;

  if (!hasRepositoryFilter &&
      !hasDateFilter &&
      !hasQueryFilter &&
      !filters.hidePrereleases) {
    return groups;
  }

  final search = hasQueryFilter
      ? prepared ?? PreparedTimelineSearch.fromGroups(groups)
      : null;
  final filtered = <TimelineGroup>[];

  for (final group in groups) {
    if (from != null && group.date.compareTo(from) < 0) continue;
    if (to != null && group.date.compareTo(to) > 0) continue;

    var items = group.items;
    var changed = false;

    if (filters.hidePrereleases) {
      final matched = items.where((item) => !item.isPrerelease).toList();
      changed = changed || matched.length != items.length;
      items = matched;
    }

    if (hasRepositoryFilter) {
      final matched = items
          .where((item) => selectedRepositories.contains(item.repository.id))
          .toList();
      changed = changed || matched.length != items.length;
      items = matched;
    }

    if (hasQueryFilter) {
      final matched = items.where((item) {
        final fields = search!.fieldsFor(
          item.key,
          includeNotes: filters.includeReleaseNotes,
        );
        if (fields == null) return false;
        final searchable = filters.includeReleaseNotes
            ? [...fields.defaults, fields.notes]
            : fields.defaults;
        return terms.every(
          (term) => searchable.any((field) => _matchesSearchTerm(field, term)),
        );
      }).toList();
      changed = changed || matched.length != items.length;
      items = matched;
    }

    if (items.isNotEmpty) {
      filtered.add(
        changed ? TimelineGroup(date: group.date, items: items) : group,
      );
    }
  }

  return filtered;
}
