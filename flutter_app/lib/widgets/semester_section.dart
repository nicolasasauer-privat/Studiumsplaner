import 'package:flutter/material.dart';
import '../models/semester.dart';
import '../providers/study_plan_provider.dart';
import 'add_lecture_dialog.dart';
import 'lecture_card.dart';

class SemesterSection extends StatefulWidget {
  final Semester semester;
  final StudyPlanProvider provider;

  const SemesterSection(
      {super.key, required this.semester, required this.provider});

  @override
  State<SemesterSection> createState() => _SemesterSectionState();
}

class _SemesterSectionState extends State<SemesterSection> {
  bool _collapsed = false;

  Semester get sem => widget.semester;
  StudyPlanProvider get p => widget.provider;

  Color get _seasonColor =>
      sem.season == 'winter' ? Colors.blue : Colors.orange;
  String get _seasonLabel => sem.season == 'winter' ? 'WS' : 'SS';

  void _delete(BuildContext context) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Semester löschen?'),
        content: Text(
          'Soll das ${sem.number}. Semester gelöscht werden? '
          'Alle Veranstaltungen kommen in den Parkplatz.',
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Abbrechen')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
                backgroundColor: Colors.red.shade700),
            onPressed: () {
              Navigator.pop(context);
              p.removeSemester(sem.id);
            },
            child: const Text('Löschen'),
          ),
        ],
      ),
    );
  }

  void _addLecture(BuildContext context) {
    showDialog(
      context: context,
      builder: (_) => AddLectureDialog(
        initialSemesterId: sem.id,
        semesters: p.plan.semesters,
        onSave: (l, semId) => p.addLecture(l, semId),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final avg = sem.averageGrade;
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Column(children: [
        InkWell(
          borderRadius: const BorderRadius.all(Radius.circular(12)),
          onTap: () => setState(() => _collapsed = !_collapsed),
          child: Padding(
            padding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Row(children: [
              Icon(_collapsed ? Icons.expand_more : Icons.expand_less,
                  color: Colors.white54, size: 20),
              const SizedBox(width: 6),
              _seasonBadge(),
              const SizedBox(width: 8),
              Text('${sem.number}. Semester',
                  style: const TextStyle(
                      fontWeight: FontWeight.bold, fontSize: 15)),
              const SizedBox(width: 6),
              Text('${sem.lectures.length} VL',
                  style: const TextStyle(
                      color: Colors.white54, fontSize: 12)),
              const Spacer(),
              _miniChip('${sem.totalEcts} ECTS', Colors.blue),
              const SizedBox(width: 4),
              if (sem.passedEcts > 0) ...[
                _miniChip('✓ ${sem.passedEcts}', Colors.green),
                const SizedBox(width: 4),
              ],
              if (avg != null) ...[
                _miniChip('Ø ${avg.toStringAsFixed(1)}', Colors.purple),
                const SizedBox(width: 4),
              ],
              PopupMenuButton<String>(
                icon: const Icon(Icons.sort,
                    color: Colors.white54, size: 18),
                tooltip: 'Sortieren',
                onSelected: (v) => p.sortSemesterLectures(sem.id, v),
                itemBuilder: (_) => const [
                  PopupMenuItem(
                      value: 'date', child: Text('Nach Prüfungsdatum')),
                  PopupMenuItem(
                      value: 'ects', child: Text('Nach ECTS')),
                ],
              ),
              IconButton(
                icon: const Icon(Icons.add,
                    color: Colors.white54, size: 18),
                padding: EdgeInsets.zero,
                constraints:
                    const BoxConstraints(minWidth: 28, minHeight: 28),
                tooltip: 'Veranstaltung hinzufügen',
                onPressed: () => _addLecture(context),
              ),
              IconButton(
                icon: const Icon(Icons.delete_outline,
                    color: Colors.red, size: 18),
                padding: EdgeInsets.zero,
                constraints:
                    const BoxConstraints(minWidth: 28, minHeight: 28),
                tooltip: 'Semester löschen',
                onPressed: () => _delete(context),
              ),
            ]),
          ),
        ),
        if (!_collapsed && sem.lectures.isNotEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(10, 0, 10, 10),
            child: Column(
              children: sem.lectures
                  .map((l) => LectureCard(
                        lecture: l,
                        allSemesters: p.plan.semesters,
                      ))
                  .toList(),
            ),
          ),
        if (!_collapsed && sem.lectures.isEmpty)
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: Text('Keine Veranstaltungen in diesem Semester.',
                style:
                    TextStyle(color: Colors.white38, fontSize: 12)),
          ),
      ]),
    );
  }

  Widget _seasonBadge() => Container(
        padding:
            const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(
          color: _seasonColor.withAlpha(50),
          borderRadius: BorderRadius.circular(4),
          border: Border.all(color: _seasonColor.withAlpha(128)),
        ),
        child: Text(_seasonLabel,
            style: TextStyle(
                color: _seasonColor,
                fontSize: 11,
                fontWeight: FontWeight.bold)),
      );

  Widget _miniChip(String text, Color color) => Container(
        padding:
            const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
        decoration: BoxDecoration(
          color: color.withAlpha(40),
          borderRadius: BorderRadius.circular(4),
        ),
        child: Text(text,
            style: TextStyle(fontSize: 10, color: color)),
      );
}
