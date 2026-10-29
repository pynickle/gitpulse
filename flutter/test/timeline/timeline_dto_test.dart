import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/timeline/timeline_dto.dart';
import 'package:json_annotation/json_annotation.dart';

import 'timeline_test_support.dart';

void main() {
  test(
    'release notes require the backend search text even when it is empty',
    () {
      final json = releaseJson(
        1,
        'v1',
        '2026-10-20T12:00:00Z',
        description: '**Notes**',
      );
      expect(ReleaseItemDto.fromJson(json).toDomain().notesSearchText, '');
      json.remove('notesSearchText');
      expect(
        () => ReleaseItemDto.fromJson(json),
        throwsA(isA<CheckedFromJsonException>()),
      );
    },
  );

  for (final value in [null, 42]) {
    test('rejects invalid search text $value', () {
      final json = releaseJson(1, 'v1', '2026-10-20T12:00:00Z')
        ..['notesSearchText'] = value;
      expect(
        () => ReleaseItemDto.fromJson(json),
        throwsA(isA<CheckedFromJsonException>()),
      );
    });
  }
}
