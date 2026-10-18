import 'package:flutter/widgets.dart';
import 'package:intl/intl.dart';

/// The locale Flutter's date formatters use for the current context.
String timelineLocaleName(BuildContext context) =>
    Localizations.localeOf(context).toString();

/// A calendar date of the Release Timeline, e.g. `Oct 4, 2026`, from the
/// `yyyy-MM-dd` key a Timeline Group carries.
String timelineDateLabel(BuildContext context, String date) {
  final parsed = DateTime.tryParse(date);
  if (parsed == null) return date;
  return DateFormat.yMMMd(timelineLocaleName(context)).format(parsed);
}

/// A release's publication time in the display time zone.
String timelineTimeLabel(BuildContext context, DateTime instant) =>
    DateFormat.yMMMd(timelineLocaleName(context)).add_Hm().format(instant);
