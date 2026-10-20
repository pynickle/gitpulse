import 'package:flutter/widgets.dart';
import 'package:intl/intl.dart';

/// The locale the app resolved for [context].
///
/// Language preferences drive this value, so every date and time the app
/// formats follows the chosen language without per-surface locale checks. Counts
/// follow the same locale through their `decimalPattern` ARB placeholders.
String gitPulseLocaleName(BuildContext context) =>
    Localizations.localeOf(context).toString();

/// A calendar day rendered for [localeName].
String formatGitPulseDay(String localeName, DateTime instant) =>
    DateFormat.yMMMd(localeName).format(instant);

/// A calendar date rendered for [localeName], e.g. `Oct 4, 2026` or
/// `2026年10月4日`, from the `yyyy-MM-dd` key a Timeline Group carries.
String formatGitPulseDate(String localeName, String date) {
  final parsed = DateTime.tryParse(date);
  if (parsed == null) return date;
  return formatGitPulseDay(localeName, parsed);
}

/// A publication instant rendered for [localeName] in the display time zone,
/// with the locale's own 12- or 24-hour clock.
String formatGitPulseDateTime(String localeName, DateTime instant) =>
    DateFormat.yMMMd(localeName).add_jm().format(instant);

/// A compact publication instant for the Release Timeline, which shares one
/// 24-hour clock across the date group and the Previous Refresh marker.
String formatGitPulseInstant(String localeName, DateTime instant) =>
    DateFormat.yMMMd(localeName).add_Hm().format(instant);

/// A calendar day in the language of [context].
String gitPulseDay(BuildContext context, DateTime instant) =>
    formatGitPulseDay(gitPulseLocaleName(context), instant);

/// A Timeline calendar date in the language of [context].
String gitPulseDate(BuildContext context, String date) =>
    formatGitPulseDate(gitPulseLocaleName(context), date);

/// A publication instant in the language of [context], using the locale's own
/// 12- or 24-hour clock.
String gitPulseDateTime(BuildContext context, DateTime instant) =>
    formatGitPulseDateTime(gitPulseLocaleName(context), instant);

/// A compact publication instant in the language of [context], on the one
/// 24-hour clock the Release Timeline shares between dates and its marker.
String gitPulseInstant(BuildContext context, DateTime instant) =>
    formatGitPulseInstant(gitPulseLocaleName(context), instant);
