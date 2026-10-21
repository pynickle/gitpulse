import 'package:flutter/widgets.dart';
import 'package:intl/intl.dart';

import '../l10n/generated/app_localizations.dart';

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

/// A publication day for a Repository Release List row: the month and day, plus
/// the year only when [instant] falls outside [currentYear], so a row stays
/// short without becoming ambiguous across years.
///
/// [currentYear] is passed in rather than read from the clock, so a test can
/// stand on either side of the year boundary without depending on its own date.
String formatGitPulseMonthDay(
  String localeName,
  DateTime instant, {
  required int currentYear,
}) =>
    (instant.year == currentYear
            ? DateFormat.MMMd(localeName)
            : DateFormat.yMMMd(localeName))
        .format(instant);

/// A download count compacted for a Repository Release List row, e.g. `999`,
/// `1.2k` or `12k`, so a six-digit count cannot push the rest of the meta line
/// out of the row.
///
/// Below ten the value carries one decimal, from ten up a whole number of
/// thousands. Rounding can reach the next magnitude — 999,999 counts as one
/// million — so the rollover happens after rounding, exactly as it does for
/// download sizes.
String formatGitPulseCompactCount(String localeName, int count) {
  if (count.abs() < 1000) {
    return NumberFormat.decimalPattern(localeName).format(count);
  }
  if (_compactValue(count / 1000) >= 1000) {
    return _compactCount(localeName, count / 1000000, 'm');
  }
  return _compactCount(localeName, count / 1000, 'k');
}

double _compactValue(double value) =>
    value >= 10 ? value.roundToDouble() : (value * 10).round() / 10;

String _compactCount(String localeName, double value, String suffix) =>
    '${NumberFormat.decimalPattern(localeName).format(_compactValue(value))}$suffix';

/// A calendar day in the language of [context].
String gitPulseDay(BuildContext context, DateTime instant) =>
    formatGitPulseDay(gitPulseLocaleName(context), instant);

/// A Repository Release List row's publication day in the language of
/// [context], with the year left out of the current year.
String gitPulseMonthDay(BuildContext context, DateTime instant) =>
    formatGitPulseMonthDay(
      gitPulseLocaleName(context),
      instant,
      currentYear: DateTime.now().year,
    );

/// A download count in the language of [context], compacted for a row.
String gitPulseCompactCount(BuildContext context, int count) =>
    formatGitPulseCompactCount(gitPulseLocaleName(context), count);

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

/// The magnitude a humanised download size names.
enum GitPulseByteUnit { byte, kilobyte, megabyte, gigabyte }

/// [bytes] humanised for [localeName], e.g. `21.7 MB`, or null when nothing is
/// known about its size.
///
/// Kilobytes carry whole numbers while megabytes and gigabytes carry one
/// decimal, so comparing build artefacts never means counting digits. Unit
/// symbols are passed in because the app reads them from localisation; the
/// formatter only decides the magnitude and the number.
///
/// Zero and negative sizes render nothing at all: GitHub reports an unknown
/// size as zero, and a row must not advertise `0 B`.
String? formatGitPulseByteSize(
  String localeName,
  int bytes, {
  required String Function(GitPulseByteUnit unit) unitSymbol,
}) {
  if (bytes <= 0) return null;
  var unit = GitPulseByteUnit.byte;
  var value = bytes.toDouble();
  while (value >= 1024 && unit != GitPulseByteUnit.gigabyte) {
    value /= 1024;
    unit = GitPulseByteUnit.values[unit.index + 1];
  }
  var rounded = _roundedFor(unit, value);
  // Rounding can reach the next magnitude — 1,048,575 bytes is 1,023.999 KB —
  // so the rollover happens after rounding rather than before it, and the reader
  // never sees `1,024 KB` where `1 MB` belongs.
  if (rounded >= 1024 && unit != GitPulseByteUnit.gigabyte) {
    unit = GitPulseByteUnit.values[unit.index + 1];
    rounded = _roundedFor(unit, value / 1024);
  }
  final number = NumberFormat.decimalPattern(localeName).format(rounded);
  return '$number ${unitSymbol(unit)}';
}

double _roundedFor(GitPulseByteUnit unit, double value) => switch (unit) {
  GitPulseByteUnit.byte || GitPulseByteUnit.kilobyte => value.roundToDouble(),
  GitPulseByteUnit.megabyte ||
  GitPulseByteUnit.gigabyte => (value * 10).round() / 10,
};

/// A download size in the language of [context], or null when the size is
/// unknown.
String? gitPulseByteSize(BuildContext context, int bytes) {
  final l10n = AppLocalizations.of(context);
  return formatGitPulseByteSize(
    gitPulseLocaleName(context),
    bytes,
    unitSymbol: (unit) => switch (unit) {
      GitPulseByteUnit.byte => l10n.releaseSizeBytes,
      GitPulseByteUnit.kilobyte => l10n.releaseSizeKilobytes,
      GitPulseByteUnit.megabyte => l10n.releaseSizeMegabytes,
      GitPulseByteUnit.gigabyte => l10n.releaseSizeGigabytes,
    },
  );
}
