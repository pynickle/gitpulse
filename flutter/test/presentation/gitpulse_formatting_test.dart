import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/presentation/gitpulse_formatting.dart';
import 'package:intl/date_symbol_data_local.dart';

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
}
