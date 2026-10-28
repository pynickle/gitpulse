import '../presentation/gitpulse_tokens.dart';
import 'timeline_models.dart';

/// Horizontal padding on each side of the Release Timeline's single column.
const releaseTimelineHorizontalPadding = GitPulseSpace.gutter;

sealed class TimelineRow {
  const TimelineRow();
}

class TimelineDateRow extends TimelineRow {
  const TimelineDateRow(this.date);

  final String date;
}

/// One release, alone in its row: the Release Timeline never puts two cards
/// side by side.
class TimelineCardRow extends TimelineRow {
  const TimelineCardRow(this.item);

  final TimelineRelease item;
}

class TimelineBaselineRow extends TimelineRow {
  const TimelineBaselineRow(this.timestamp, {required this.includeDate});

  final DateTime timestamp;

  /// False when the marker sits inside the baseline's own day group, whose
  /// header already names that day. True after the loaded window, and when
  /// the marker falls in some other day's group.
  final bool includeDate;
}

/// Date headers, card rows, and the Previous Refresh marker in publication
/// order. The marker is placed before the first release at or older than the
/// baseline, and after everything when it is older than the loaded window.
List<TimelineRow> buildTimelineRows(
  List<TimelineGroup> groups,
  String? exposedBaseline, {
  String Function(DateTime instant) localDateKey = systemLocalDateKey,
}) {
  final baseline = exposedBaseline == null
      ? null
      : DateTime.tryParse(exposedBaseline);
  final baselineDay = baseline == null ? null : localDateKey(baseline);
  final rows = <TimelineRow>[];
  var inserted = false;

  for (final group in groups) {
    rows.add(TimelineDateRow(group.date));

    for (final item in group.items) {
      if (baseline != null &&
          !inserted &&
          !item.publishedAt.isAfter(baseline)) {
        rows.add(
          TimelineBaselineRow(baseline, includeDate: group.date != baselineDay),
        );
        inserted = true;
      }
      rows.add(TimelineCardRow(item));
    }
  }

  if (baseline != null && !inserted) {
    rows.add(TimelineBaselineRow(baseline, includeDate: true));
  }

  return rows;
}
