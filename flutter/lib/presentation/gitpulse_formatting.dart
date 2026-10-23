import 'dart:math' as math;

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

/// An exact count rendered for [localeName] with the locale's own grouping,
/// e.g. `1,234`, for a value a row shows in full instead of compacting.
String formatGitPulseCount(String localeName, int count) =>
    NumberFormat.decimalPattern(localeName).format(count);

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

/// A star count in locale compact notation with one fractional digit.
///
/// English uses `K` and `M` (`5.6K`, `12.3K`, `1M`, `1.2M`). Chinese uses `万`
/// (`1.2万`, `100万`) and leaves values below 10,000 exact (`5600`). Values
/// below 1,000 stay exact in every locale. Download counts keep
/// [formatGitPulseCompactCount], which appends `k` or `m` in every language.
String formatGitPulseLocaleCompactCount(String localeName, int count) {
  if (localeName.toLowerCase().startsWith('zh')) {
    if (count < 10000) return '$count';
    return _localeCompact(count, const [100000000, 10000], const ['亿', '万']);
  }
  if (count < 1000) return '$count';
  return _localeCompact(
    count,
    const [1000000000, 1000000, 1000],
    const ['B', 'M', 'K'],
  );
}

String _localeCompact(int count, List<int> divisors, List<String> suffixes) {
  for (var index = 0; index < divisors.length; index++) {
    final divisor = divisors[index];
    final last = index == divisors.length - 1;
    if (!last && count < divisor) continue;
    final rounded = _roundOneDecimal(count / divisor);
    if (index > 0 && rounded * divisor >= divisors[index - 1]) {
      return _compactDigits(_roundOneDecimal(count / divisors[index - 1])) +
          suffixes[index - 1];
    }
    return _compactDigits(rounded) + suffixes[index];
  }
  return '$count';
}

double _roundOneDecimal(double value) => (value * 10).round() / 10;

String _compactDigits(double value) => value == value.truncateToDouble()
    ? value.toInt().toString()
    : value.toStringAsFixed(1);

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

/// A star count in the language of [context], in locale compact notation.
String gitPulseLocaleCompactCount(BuildContext context, int count) =>
    formatGitPulseLocaleCompactCount(gitPulseLocaleName(context), count);

/// An exact count in the language of [context], grouped for its locale.
String gitPulseCount(BuildContext context, int count) =>
    formatGitPulseCount(gitPulseLocaleName(context), count);

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

/// A Timeline Refresh Baseline on the timeline's 24-hour clock.
///
/// [includeDate] is false when the calendar day is already on screen: the
/// toolbar when the baseline is today, and the in-list marker inside that
/// day's group. Otherwise the month and day are included, and the year only
/// when [instant] falls outside [now]'s year in [localDateKey]'s calendar,
/// the same calendar the day headers use.
String formatGitPulseBaselineInstant(
  String localeName,
  DateTime instant, {
  required DateTime now,
  required String Function(DateTime instant) localDateKey,
  required bool includeDate,
}) {
  final local = instant.toLocal();
  if (!includeDate) return DateFormat.Hm(localeName).format(local);
  final sameYear =
      localDateKey(instant).substring(0, 4) ==
      localDateKey(now).substring(0, 4);
  final date = sameYear
      ? DateFormat.MMMd(localeName)
      : DateFormat.yMMMd(localeName);
  return date.add_Hm().format(local);
}

/// The Previous Refresh instant shown beside its title: the timeline's 24-hour
/// clock, with the month and day only when [includeDate] says the screen does
/// not already name that day.
///
/// The title and this instant are separate Text widgets, so a surface that
/// emphasizes the title never has to split a formatted string apart.
String gitPulseBaselineInstantLabel(
  BuildContext context,
  DateTime instant, {
  required DateTime now,
  required String Function(DateTime instant) localDateKey,
  required bool includeDate,
}) => formatGitPulseBaselineInstant(
  gitPulseLocaleName(context),
  instant,
  now: now,
  localDateKey: localDateKey,
  includeDate: includeDate,
);

/// The Previous Refresh toolbar label: the existing words, a middle dot, and
/// the baseline instant from [formatGitPulseBaselineInstant].
String gitPulseBaselineLabel(
  AppLocalizations l10n,
  DateTime instant, {
  required DateTime now,
  required String Function(DateTime instant) localDateKey,
  required bool includeDate,
}) {
  final time = formatGitPulseBaselineInstant(
    l10n.localeName,
    instant,
    now: now,
    localDateKey: localDateKey,
    includeDate: includeDate,
  );
  return '${l10n.timelinePreviousRefreshMark} · $time';
}

/// How long ago [instant] was, in the language of [context].
///
/// The buckets are dayjs `fromNow`'s defaults. A rounded unit that does not
/// exceed its limit selects that phrase, and a count of one uses the previous
/// bucket's singular phrase. Months follow dayjs's calendar difference rather
/// than a fixed length. [now] defaults to the device clock.
String gitPulseRelativeTime(
  BuildContext context,
  DateTime instant, {
  DateTime? now,
}) {
  final l10n = AppLocalizations.of(context);
  final phrase = _relativePhrase(instant, now ?? DateTime.now());
  final count = phrase.count;
  return switch (phrase.unit) {
    _RelativeBucket.fewSeconds =>
      phrase.future
          ? l10n.timelineRelativeSecondsIn
          : l10n.timelineRelativeSecondsAgo,
    _RelativeBucket.minute =>
      phrase.future
          ? l10n.timelineRelativeMinuteIn
          : l10n.timelineRelativeMinuteAgo,
    _RelativeBucket.minutes =>
      phrase.future
          ? l10n.timelineRelativeMinutesIn(count)
          : l10n.timelineRelativeMinutesAgo(count),
    _RelativeBucket.hour =>
      phrase.future
          ? l10n.timelineRelativeHourIn
          : l10n.timelineRelativeHourAgo,
    _RelativeBucket.hours =>
      phrase.future
          ? l10n.timelineRelativeHoursIn(count)
          : l10n.timelineRelativeHoursAgo(count),
    _RelativeBucket.day =>
      phrase.future ? l10n.timelineRelativeDayIn : l10n.timelineRelativeDayAgo,
    _RelativeBucket.days =>
      phrase.future
          ? l10n.timelineRelativeDaysIn(count)
          : l10n.timelineRelativeDaysAgo(count),
    _RelativeBucket.month =>
      phrase.future
          ? l10n.timelineRelativeMonthIn
          : l10n.timelineRelativeMonthAgo,
    _RelativeBucket.months =>
      phrase.future
          ? l10n.timelineRelativeMonthsIn(count)
          : l10n.timelineRelativeMonthsAgo(count),
    _RelativeBucket.year =>
      phrase.future
          ? l10n.timelineRelativeYearIn
          : l10n.timelineRelativeYearAgo,
    _RelativeBucket.years =>
      phrase.future
          ? l10n.timelineRelativeYearsIn(count)
          : l10n.timelineRelativeYearsAgo(count),
  };
}

enum _RelativeBucket {
  fewSeconds,
  minute,
  minutes,
  hour,
  hours,
  day,
  days,
  month,
  months,
  year,
  years,
}

class _RelativePhrase {
  const _RelativePhrase(this.unit, {required this.future, this.count = 0});

  final _RelativeBucket unit;
  final bool future;
  final int count;
}

/// dayjs relativeTime's default limits. A null unit keeps the previous
/// difference; a null limit is the final bucket.
const _relativeThresholds =
    <({_RelativeBucket bucket, int? limit, String? unit})>[
      (bucket: _RelativeBucket.fewSeconds, limit: 44, unit: 'second'),
      (bucket: _RelativeBucket.minute, limit: 89, unit: null),
      (bucket: _RelativeBucket.minutes, limit: 44, unit: 'minute'),
      (bucket: _RelativeBucket.hour, limit: 89, unit: null),
      (bucket: _RelativeBucket.hours, limit: 21, unit: 'hour'),
      (bucket: _RelativeBucket.day, limit: 35, unit: null),
      (bucket: _RelativeBucket.days, limit: 25, unit: 'day'),
      (bucket: _RelativeBucket.month, limit: 45, unit: null),
      (bucket: _RelativeBucket.months, limit: 10, unit: 'month'),
      (bucket: _RelativeBucket.year, limit: 17, unit: null),
      (bucket: _RelativeBucket.years, limit: null, unit: 'year'),
    ];

_RelativePhrase _relativePhrase(DateTime instant, DateTime now) {
  final from = instant.toLocal();
  final to = now.toLocal();
  double? result;
  for (var index = 0; index < _relativeThresholds.length; index++) {
    final threshold = _relativeThresholds[index];
    final unit = threshold.unit;
    if (unit != null) result = _diffIn(from, to, unit);
    final value = result!;
    final magnitude = value.abs().round();
    final limit = threshold.limit;
    if (limit != null && magnitude > limit) continue;
    final bucket = magnitude <= 1 && index > 0
        ? _relativeThresholds[index - 1].bucket
        : threshold.bucket;
    return _RelativePhrase(bucket, future: value > 0, count: magnitude);
  }
  return const _RelativePhrase(_RelativeBucket.years, future: false);
}

double _diffIn(DateTime from, DateTime to, String unit) {
  final milliseconds = from.difference(to).inMicroseconds / 1000;
  final zoneDelta =
      (to.timeZoneOffset - from.timeZoneOffset).inMicroseconds / 1000;
  return switch (unit) {
    'second' => milliseconds / 1000,
    'minute' => milliseconds / 60000,
    'hour' => milliseconds / 3600000,
    'day' => (milliseconds - zoneDelta) / 86400000,
    'month' => _monthDiff(from, to),
    'year' => _monthDiff(from, to) / 12,
    _ => milliseconds,
  };
}

/// dayjs's month difference, including the fractional month moment.js uses.
double _monthDiff(DateTime from, DateTime to) {
  if (from.day < to.day) return -_monthDiff(to, from);
  final whole = (to.year - from.year) * 12 + (to.month - from.month);
  final anchor = _addMonths(from, whole);
  final pastAnchor = to.difference(anchor).inMicroseconds;
  final beforeAnchor = pastAnchor < 0;
  final neighbor = _addMonths(from, whole + (beforeAnchor ? -1 : 1));
  final span = beforeAnchor
      ? anchor.difference(neighbor).inMicroseconds
      : neighbor.difference(anchor).inMicroseconds;
  final fraction = span == 0 ? 0.0 : pastAnchor / span;
  return -(whole + fraction);
}

DateTime _addMonths(DateTime date, int months) {
  final index = date.year * 12 + (date.month - 1) + months;
  final year = _floorDiv(index, 12);
  final month = index - year * 12;
  final lastDay = DateTime(year, month + 2, 0).day;
  return DateTime(
    year,
    month + 1,
    math.min(date.day, lastDay),
    date.hour,
    date.minute,
    date.second,
    date.millisecond,
    date.microsecond,
  );
}

int _floorDiv(int value, int divisor) {
  final quotient = value ~/ divisor;
  if (value % divisor < 0) return quotient - 1;
  return quotient;
}

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
