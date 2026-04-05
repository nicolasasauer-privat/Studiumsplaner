import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/lecture.dart';
import '../models/semester.dart';
import '../providers/study_plan_provider.dart';
import '../utils/exam_date_utils.dart';
import 'add_lecture_dialog.dart';

// The 20 colors from the web app
const kColors = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
  '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B88B', '#A9E6E6',
  '#FFB347', '#87CEEB', '#DDA0DD', '#98FB98', '#FFB6C1',
  '#20B2AA', '#FF8C00', '#9370DB', '#5DADE2', '#F1948A',
];

Color hexColor(String hex) {
  final h = hex.replaceAll('#', '');
  return Color(int.parse('FF$h', radix: 16));
}

class LectureCard extends StatefulWidget {
  final Lecture lecture;
  final List<Semester> allSemesters;

  const LectureCard(
      {super.key, required this.lecture, required this.allSemesters});

  @override
  State<LectureCard> createState() => _LectureCardState();
}

class _LectureCardState extends State<LectureCard> {
  bool _showDesc = false;

  String get _seasonLabel {
    switch (widget.lecture.season) {
      case 'winter':
        return 'WS';
      case 'summer':
        return 'SS';
      default:
        return 'WS/SS';
    }
  }

  Color get _seasonColor {
    switch (widget.lecture.season) {
      case 'winter':
        return Colors.blue;
      case 'summer':
        return Colors.orange;
      default:
        return Colors.purple;
    }
  }

  bool get _hasMismatch {
    final l = widget.lecture;
    if (l.semesterId == null || l.season == 'both') return false;
    try {
      final sem =
          widget.allSemesters.firstWhere((s) => s.id == l.semesterId);
      return sem.season != l.season;
    } catch (_) {
      return false;
    }
  }

  void _moveSheet(BuildContext context) {
    final p = context.read<StudyPlanProvider>();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF1E293B),
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (_) {
        final maxHeight = MediaQuery.sizeOf(context).height * 0.75;
        return SafeArea(
          child: ConstrainedBox(
            constraints: BoxConstraints(maxHeight: maxHeight),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                    child: Text('Verschieben: ${widget.lecture.name}',
                        style: const TextStyle(
                            fontWeight: FontWeight.bold, fontSize: 15)),
                  ),
                  const Divider(height: 1),
                  if (widget.lecture.semesterId != null)
                    ListTile(
                      leading: const Icon(Icons.local_parking,
                          color: Colors.orange),
                      title: const Text('Parkplatz'),
                      onTap: () {
                        Navigator.pop(context);
                        p.moveLectureToParkingLot(
                            widget.lecture.id, widget.lecture.semesterId!);
                      },
                    ),
                  ...widget.allSemesters
                      .where((s) => s.id != widget.lecture.semesterId)
                      .map((sem) => ListTile(
                            leading: Icon(Icons.calendar_today,
                                color: sem.season == 'winter'
                                    ? Colors.blue
                                    : Colors.orange),
                            title: Text(
                                '${sem.number}. Semester (${sem.season == 'winter' ? 'WS' : 'SS'})'),
                            subtitle: Text('${sem.lectures.length} VL'),
                            onTap: () {
                              Navigator.pop(context);
                              p.moveLectureToSemester(widget.lecture.id,
                                  widget.lecture.semesterId, sem.id);
                            },
                          )),
                  const SizedBox(height: 8),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  void _edit(BuildContext context) {
    final p = context.read<StudyPlanProvider>();
    showDialog(
      context: context,
      builder: (_) => AddLectureDialog(
        existing: widget.lecture,
        semesters: widget.allSemesters,
        onSave: (updated, _) => p.updateLecture(updated),
      ),
    );
  }

  void _delete(BuildContext context) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Veranstaltung löschen?'),
        content: Text('Soll "${widget.lecture.name}" wirklich gelöscht werden?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Abbrechen')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
                backgroundColor: Colors.red.shade700),
            onPressed: () {
              Navigator.pop(context);
              context.read<StudyPlanProvider>().removeLecture(
                  widget.lecture.id, widget.lecture.semesterId);
            },
            child: const Text('Löschen'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = widget.lecture;
    final accent = hexColor(l.color);
    return GestureDetector(
      onLongPress: () => _moveSheet(context),
      child: Card(
        color: l.passed
            ? Colors.green.shade900.withAlpha(50)
            : const Color(0xFF1E293B),
        margin: const EdgeInsets.only(bottom: 8),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                width: 5,
                decoration: BoxDecoration(
                  color: accent,
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(12),
                    bottomLeft: Radius.circular(12),
                  ),
                ),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        Expanded(
                          child: Text(l.name,
                              style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 14)),
                        ),
                        _badge('${l.ects} ECTS', Colors.blue),
                      ]),
                      const SizedBox(height: 6),
                      Wrap(spacing: 4, runSpacing: 4, children: [
                        _badge(_seasonLabel, _seasonColor),
                        if (l.passed)
                          _badge('✓ Bestanden', Colors.green),
                        if (l.passed && l.grade != null)
                          _badge('Note: ${l.grade!.toStringAsFixed(1)}',
                              Colors.purple),
                        if (l.oralExam)
                          _badge('Münd.', Colors.teal),
                        if (_hasMismatch)
                          _badge('⚠ Semester-Hinweis', Colors.orange),
                      ]),
                      if (l.examDate != null) ...[
                        const SizedBox(height: 4),
                        Row(children: [
                          const Icon(Icons.event,
                              size: 12, color: Colors.white54),
                          const SizedBox(width: 4),
                          Text(
                              'Prüfung: ${ExamDateUtils.formatStoredDateForDisplay(l.examDate)}',
                              style: const TextStyle(
                                  fontSize: 11, color: Colors.white54)),
                        ]),
                      ],
                      if (l.description.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        GestureDetector(
                          onTap: () =>
                              setState(() => _showDesc = !_showDesc),
                          child: Row(children: [
                            Icon(
                              _showDesc
                                  ? Icons.expand_less
                                  : Icons.expand_more,
                              size: 16,
                              color: Colors.white54,
                            ),
                            const Text('Beschreibung',
                                style: TextStyle(
                                    fontSize: 11,
                                    color: Colors.white54)),
                          ]),
                        ),
                        if (_showDesc)
                          Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text(l.description,
                                style: const TextStyle(
                                    fontSize: 12,
                                    color: Colors.white70)),
                          ),
                      ],
                      const SizedBox(height: 4),
                      Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            _iconBtn(
                              l.passed
                                  ? Icons.check_circle
                                  : Icons.check_circle_outline,
                              l.passed ? Colors.green : Colors.white38,
                              () => context
                                  .read<StudyPlanProvider>()
                                  .toggleLecturePassed(
                                      l.id, l.semesterId),
                            ),
                            _iconBtn(Icons.edit, Colors.white54,
                                () => _edit(context)),
                            _iconBtn(Icons.open_with, Colors.white54,
                                () => _moveSheet(context)),
                            _iconBtn(Icons.delete_outline, Colors.red,
                                () => _delete(context)),
                          ]),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _badge(String text, Color color) => Container(
        padding:
            const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(
          color: color.withAlpha(50),
          borderRadius: BorderRadius.circular(4),
          border: Border.all(color: color.withAlpha(128)),
        ),
        child: Text(text,
            style: TextStyle(fontSize: 10, color: color)),
      );

  Widget _iconBtn(IconData icon, Color color, VoidCallback onTap) =>
      IconButton(
        icon: Icon(icon, color: color, size: 18),
        padding: EdgeInsets.zero,
        constraints:
            const BoxConstraints(minWidth: 32, minHeight: 32),
        onPressed: onTap,
      );
}
