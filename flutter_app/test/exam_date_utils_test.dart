import 'package:flutter_test/flutter_test.dart';
import 'package:studi_plan/utils/exam_date_utils.dart';

void main() {
  group('ExamDateUtils', () {
    test('parses and formats stored ISO dates', () {
      final parsed = ExamDateUtils.parseStoredDate('2026-04-05');

      expect(parsed, isNotNull);
      expect(ExamDateUtils.formatForDisplay(parsed!), '05.04.2026');
      expect(ExamDateUtils.formatForStorage(parsed), '2026-04-05');
      expect(
        ExamDateUtils.formatStoredDateForDisplay('2026-04-05'),
        '05.04.2026',
      );
    });

    test('rejects invalid ISO dates', () {
      expect(ExamDateUtils.parseStoredDate('2026-02-30'), isNull);
      expect(ExamDateUtils.parseStoredDate('05.04.2026'), isNull);
    });

    test('falls back to trimmed raw value for unknown legacy strings', () {
      expect(
        ExamDateUtils.formatStoredDateForDisplay('  bald festlegen  '),
        'bald festlegen',
      );
      expect(ExamDateUtils.formatStoredDateForDisplay(null), '');
    });
  });
}
