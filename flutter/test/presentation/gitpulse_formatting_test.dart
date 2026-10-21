import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/presentation/gitpulse_formatting.dart';
import 'package:intl/date_symbol_data_local.dart';

/// The unit symbols the app reads from localisation. A plain Dart test supplies
/// them itself, so what is under test is the formatter's own arithmetic.
const enUnits = <GitPulseByteUnit, String>{
  GitPulseByteUnit.byte: 'B',
  GitPulseByteUnit.kilobyte: 'KB',
  GitPulseByteUnit.megabyte: 'MB',
  GitPulseByteUnit.gigabyte: 'GB',
};

String enUnit(GitPulseByteUnit unit) => enUnits[unit]!;

void main() {
  // The app gets date symbols from its loaded Flutter localizations; a plain
  // Dart test loads them directly.
  setUpAll(() => initializeDateFormatting());

  group('gitPulse date presentation', () {
    test('calendar dates follow the selected language', () {
      expect(formatGitPulseDate('en', '2026-10-04'), 'Oct 4, 2026');
      expect(formatGitPulseDate('zh', '2026-10-04'), '2026年10月4日');
    });

    test('publication times follow the selected language', () {
      expect(
        formatGitPulseInstant('en', DateTime(2026, 10, 4, 9, 30)),
        'Oct 4, 2026 09:30',
      );
      expect(
        formatGitPulseInstant('zh', DateTime(2026, 10, 4, 9, 30)),
        '2026年10月4日 09:30',
      );
    });

    test('a value that is not a calendar date is shown unchanged', () {
      expect(formatGitPulseDate('en', 'not a date'), 'not a date');
    });
  });

  group('gitPulse month-and-day presentation', () {
    test('a release from the current year leaves the year out', () {
      expect(
        formatGitPulseMonthDay('en', DateTime(2026, 10, 20), currentYear: 2026),
        'Oct 20',
      );
      expect(
        formatGitPulseMonthDay('zh', DateTime(2026, 10, 20), currentYear: 2026),
        '10月20日',
      );
    });

    test('a release from another year keeps the year', () {
      expect(
        formatGitPulseMonthDay('en', DateTime(2025, 10, 20), currentYear: 2026),
        'Oct 20, 2025',
      );
      expect(
        formatGitPulseMonthDay('zh', DateTime(2025, 10, 20), currentYear: 2026),
        '2025年10月20日',
      );
      expect(
        formatGitPulseMonthDay('en', DateTime(2027, 1, 2), currentYear: 2026),
        'Jan 2, 2027',
      );
    });
  });

  group('gitPulse compact count presentation', () {
    test('a count below a thousand keeps its own digits', () {
      expect(formatGitPulseCompactCount('en', 0), '0');
      expect(formatGitPulseCompactCount('en', 7), '7');
      expect(formatGitPulseCompactCount('en', 999), '999');
    });

    test('thousands carry one decimal below ten and whole numbers above', () {
      expect(formatGitPulseCompactCount('en', 1000), '1k');
      expect(formatGitPulseCompactCount('en', 1200), '1.2k');
      expect(formatGitPulseCompactCount('en', 12345), '12k');
      expect(formatGitPulseCompactCount('en', 123456), '123k');
    });

    test('a count that rounds to the next magnitude rolls over', () {
      // 999,999 downloads must read as one million, not as `1,000k`.
      expect(formatGitPulseCompactCount('en', 999999), '1m');
    });

    test('millions are compacted the same way', () {
      expect(formatGitPulseCompactCount('en', 1200000), '1.2m');
      expect(formatGitPulseCompactCount('en', 12000000), '12m');
    });

    test('the number follows the selected language', () {
      expect(formatGitPulseCompactCount('de', 1200), '1,2k');
      expect(formatGitPulseCompactCount('de', 999), '999');
    });
  });

  group('gitPulse download size presentation', () {
    test('kilobytes round to whole numbers', () {
      expect(formatGitPulseByteSize('en', 2048, unitSymbol: enUnit), '2 KB');
      // 1.5 KB rounds to the nearer whole kilobyte instead of showing a
      // fraction, so scanning a list of artefacts never means counting digits.
      expect(formatGitPulseByteSize('en', 1536, unitSymbol: enUnit), '2 KB');
    });

    test('megabytes and gigabytes keep one decimal', () {
      expect(
        formatGitPulseByteSize('en', 22740992, unitSymbol: enUnit),
        '21.7 MB',
      );
      expect(
        formatGitPulseByteSize('en', 1572864, unitSymbol: enUnit),
        '1.5 MB',
      );
      expect(
        formatGitPulseByteSize('en', 1610612736, unitSymbol: enUnit),
        '1.5 GB',
      );
    });

    test('rounding that reaches the next magnitude rolls the unit over', () {
      // 1,023.999 KB must read as one megabyte, not as `1,024 KB`.
      expect(formatGitPulseByteSize('en', 1048575, unitSymbol: enUnit), '1 MB');
      expect(
        formatGitPulseByteSize('en', 1073741823, unitSymbol: enUnit),
        '1 GB',
      );
    });

    test('grouping follows the selected language', () {
      // A large Release Asset passes the gigabyte magnitude and keeps grouping.
      expect(
        formatGitPulseByteSize(
          'en',
          5 * 1024 * 1024 * 1024 * 1024,
          unitSymbol: enUnit,
        ),
        '5,120 GB',
      );
      expect(
        formatGitPulseByteSize(
          'de',
          5 * 1024 * 1024 * 1024 * 1024,
          unitSymbol: enUnit,
        ),
        '5.120 GB',
      );
    });

    test('a size smaller than a kilobyte is shown in bytes', () {
      expect(formatGitPulseByteSize('en', 512, unitSymbol: enUnit), '512 B');
    });

    test('an unknown size renders nothing at all', () {
      // The Release Asset API reports an unknown size as zero, and a row must
      // not advertise `0 B`.
      expect(formatGitPulseByteSize('en', 0, unitSymbol: enUnit), isNull);
      expect(formatGitPulseByteSize('en', -1, unitSymbol: enUnit), isNull);
    });

    test('the unit symbol comes from the caller, not the formatter', () {
      final zhUnits = <GitPulseByteUnit, String>{
        ...enUnits,
        GitPulseByteUnit.byte: '字节',
      };
      expect(
        formatGitPulseByteSize('zh', 512, unitSymbol: (unit) => zhUnits[unit]!),
        '512 字节',
      );
    });
  });
}
