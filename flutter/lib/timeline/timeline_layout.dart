import 'timeline_models.dart';

/// Phone layout ceiling for the Release Timeline, matching the web timeline.
const releaseTimelinePhoneMaxWidth = 700.0;

/// Tablet layout ceiling: above it the timeline uses three columns.
const releaseTimelineTabletMaxWidth = 1100.0;

/// One to three date-grouped columns, matching the web timeline's breakpoints.
int resolveTimelineColumnCount(double width) {
  if (width <= releaseTimelinePhoneMaxWidth) return 1;
  if (width <= releaseTimelineTabletMaxWidth) return 2;
  return 3;
}

sealed class TimelineRow {
  const TimelineRow();
}

class TimelineDateRow extends TimelineRow {
  const TimelineDateRow(this.date);

  final String date;
}

class TimelineCardsRow extends TimelineRow {
  const TimelineCardsRow(this.items);

  final List<TimelineRelease> items;
}

class TimelineBaselineRow extends TimelineRow {
  const TimelineBaselineRow(this.timestamp);

  final DateTime timestamp;
}

/// Date headers, card rows, and the Previous Refresh marker in publication
/// order. The marker is placed before the first release at or older than the
/// baseline, and after everything when it is older than the loaded window.
List<TimelineRow> buildTimelineRows(
  List<TimelineGroup> groups,
  int columnCount,
  String? exposedBaseline,
) {
  final baseline = exposedBaseline == null
      ? null
      : DateTime.tryParse(exposedBaseline);
  final rows = <TimelineRow>[];
  var inserted = false;

  for (final group in groups) {
    rows.add(TimelineDateRow(group.date));
    var items = <TimelineRelease>[];

    void flush() {
      if (items.isNotEmpty) rows.add(TimelineCardsRow(items));
      items = <TimelineRelease>[];
    }

    for (final item in group.items) {
      if (baseline != null &&
          !inserted &&
          !item.publishedAt.isAfter(baseline)) {
        flush();
        rows.add(TimelineBaselineRow(baseline));
        inserted = true;
      }
      items.add(item);
      if (items.length == columnCount) flush();
    }
    flush();
  }

  if (baseline != null && !inserted) {
    rows.add(TimelineBaselineRow(baseline));
  }

  return rows;
}
