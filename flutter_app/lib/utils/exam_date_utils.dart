class ExamDateUtils {
  static final RegExp _isoDatePattern = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$');

  static DateTime? parseStoredDate(String? value) {
    final trimmed = value?.trim();
    if (trimmed == null || trimmed.isEmpty) return null;

    final match = _isoDatePattern.firstMatch(trimmed);
    if (match == null) return null;

    final year = int.parse(match.group(1)!);
    final month = int.parse(match.group(2)!);
    final day = int.parse(match.group(3)!);
    final parsed = DateTime.tryParse(trimmed);
    if (parsed == null ||
        parsed.year != year ||
        parsed.month != month ||
        parsed.day != day) {
      return null;
    }

    return DateTime(year, month, day);
  }

  static String formatForStorage(DateTime date) {
    final year = date.year.toString().padLeft(4, '0');
    final month = date.month.toString().padLeft(2, '0');
    final day = date.day.toString().padLeft(2, '0');
    return '$year-$month-$day';
  }

  static String formatForDisplay(DateTime date) {
    final day = date.day.toString().padLeft(2, '0');
    final month = date.month.toString().padLeft(2, '0');
    final year = date.year.toString().padLeft(4, '0');
    return '$day.$month.$year';
  }

  static String formatStoredDateForDisplay(String? value) {
    final parsed = parseStoredDate(value);
    if (parsed == null) return value?.trim() ?? '';
    return formatForDisplay(parsed);
  }
}
