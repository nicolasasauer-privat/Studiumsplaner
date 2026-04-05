import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';
import '../models/lecture.dart';
import '../models/semester.dart';
import '../utils/exam_date_utils.dart';
import 'lecture_card.dart' show kColors, hexColor;

class AddLectureDialog extends StatefulWidget {
  final Lecture? existing;
  final List<Semester> semesters;
  final String? initialSemesterId;
  final Future<void> Function(Lecture lecture, String? semesterId) onSave;

  const AddLectureDialog({
    super.key,
    this.existing,
    required this.semesters,
    this.initialSemesterId,
    required this.onSave,
  });

  @override
  State<AddLectureDialog> createState() => _AddLectureDialogState();
}

class _AddLectureDialogState extends State<AddLectureDialog> {
  final _formKey = GlobalKey<FormState>();
  final _uuid = const Uuid();

  late final TextEditingController _nameCtrl;
  late final TextEditingController _ectsCtrl;
  late final TextEditingController _dateCtrl;
  late final TextEditingController _descCtrl;

  late String _season;
  String? _examDateValue;
  late bool _passed;
  late bool _oral;
  double? _grade;
  late String _color;
  String? _semId;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final l = widget.existing;
    _nameCtrl = TextEditingController(text: l?.name ?? '');
    _ectsCtrl =
        TextEditingController(text: l != null ? l.ects.toString() : '');
    _examDateValue = l?.examDate?.trim();
    _dateCtrl = TextEditingController(
      text: ExamDateUtils.formatStoredDateForDisplay(_examDateValue),
    );
    _descCtrl = TextEditingController(text: l?.description ?? '');
    _season = l?.season ?? 'both';
    _passed = l?.passed ?? false;
    _oral = l?.oralExam ?? false;
    _grade = l?.grade;
    _color = l?.color ?? kColors[0];
    _semId = l?.semesterId ?? widget.initialSemesterId;
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _ectsCtrl.dispose();
    _dateCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickExamDate() async {
    final now = DateTime.now();
    final firstDate = DateTime(2000, 1, 1);
    final lastDate = DateTime(2100, 12, 31);
    var initialDate = ExamDateUtils.parseStoredDate(_examDateValue) ??
        DateTime(now.year, now.month, now.day);

    if (initialDate.isBefore(firstDate)) initialDate = firstDate;
    if (initialDate.isAfter(lastDate)) initialDate = lastDate;

    final picked = await showDatePicker(
      context: context,
      initialDate: initialDate,
      firstDate: firstDate,
      lastDate: lastDate,
      initialEntryMode: DatePickerEntryMode.calendarOnly,
      helpText: 'Prüfungsdatum',
      cancelText: 'Abbrechen',
      confirmText: 'Übernehmen',
    );

    if (picked == null || !mounted) return;

    setState(() {
      _examDateValue = ExamDateUtils.formatForStorage(picked);
      _dateCtrl.text = ExamDateUtils.formatForDisplay(picked);
    });
  }

  void _clearExamDate() {
    setState(() {
      _examDateValue = null;
      _dateCtrl.clear();
    });
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      final l = Lecture(
        id: widget.existing?.id ?? _uuid.v4(),
        name: _nameCtrl.text.trim(),
        ects: int.parse(_ectsCtrl.text.trim()),
        examDate: _examDateValue,
        season: _season,
        description: _descCtrl.text.trim(),
        color: _color,
        semesterId: _semId,
        passed: _passed,
        grade: _passed ? _grade : null,
        oralExam: _oral,
      );
      await widget.onSave(l, _semId);
      if (mounted) Navigator.pop(context);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: const Color(0xFF1E293B),
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16)),
      insetPadding:
          const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          elevation: 0,
          title: Text(widget.existing != null
              ? 'Veranstaltung bearbeiten'
              : 'Neue Veranstaltung'),
          leading: IconButton(
              icon: const Icon(Icons.close),
              onPressed: () => Navigator.pop(context)),
          actions: [
            if (_saving)
              const Padding(
                  padding: EdgeInsets.all(12),
                  child: SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2)))
            else
              TextButton(
                  onPressed: _save,
                  child: const Text('Speichern',
                      style: TextStyle(color: Colors.blue))),
          ],
        ),
        body: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
            children: [
              TextFormField(
                controller: _nameCtrl,
                decoration: const InputDecoration(
                    labelText: 'Name *', prefixIcon: Icon(Icons.book)),
                validator: (v) => v == null || v.trim().isEmpty
                    ? 'Pflichtfeld'
                    : null,
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _ectsCtrl,
                decoration: const InputDecoration(
                    labelText: 'ECTS *',
                    prefixIcon: Icon(Icons.star_border)),
                keyboardType: TextInputType.number,
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return 'Pflichtfeld';
                  final n = int.tryParse(v.trim());
                  if (n == null || n < 1 || n > 30) {
                    return '1–30';
                  }
                  return null;
                },
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 12),
              const Text('Turnus',
                  style:
                      TextStyle(color: Colors.white70, fontSize: 13)),
              const SizedBox(height: 6),
              _seasonSelector(),
              const SizedBox(height: 12),
              _semesterDropdown(),
              const SizedBox(height: 12),
              TextFormField(
                controller: _dateCtrl,
                decoration: InputDecoration(
                  labelText: 'Prüfungsdatum',
                  prefixIcon: const Icon(Icons.event),
                  hintText: 'Datum auswählen',
                  suffixIcon: _dateCtrl.text.isEmpty
                      ? const Icon(Icons.calendar_month)
                      : IconButton(
                          onPressed: _clearExamDate,
                          tooltip: 'Datum entfernen',
                          icon: const Icon(Icons.clear),
                        ),
                ),
                readOnly: true,
                showCursor: false,
                enableInteractiveSelection: false,
                onTap: _pickExamDate,
                validator: (v) {
                  if ((v == null || v.trim().isEmpty) == (_examDateValue == null)) {
                    return null;
                  }
                  return 'Bitte Datum auswählen';
                },
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 12),
              SwitchListTile(
                title: Text(
                    _oral ? 'Münd. Prüfung bestanden' : 'Klausur bestanden'),
                value: _passed,
                onChanged: (v) => setState(() {
                  _passed = v;
                  if (!v) _grade = null;
                }),
                contentPadding: EdgeInsets.zero,
              ),
              if (_passed) ...[
                const Text('Note (1.0 – 5.0)',
                    style: TextStyle(
                        color: Colors.white70, fontSize: 13)),
                const SizedBox(height: 4),
                _gradeSlider(),
                const SizedBox(height: 8),
              ],
              SwitchListTile(
                title: const Text('Mündliche Prüfung'),
                value: _oral,
                onChanged: (v) => setState(() => _oral = v),
                contentPadding: EdgeInsets.zero,
              ),
              const SizedBox(height: 4),
              TextFormField(
                controller: _descCtrl,
                decoration: const InputDecoration(
                    labelText: 'Beschreibung',
                    prefixIcon: Icon(Icons.notes),
                    alignLabelWithHint: true),
                maxLines: 3,
                textInputAction: TextInputAction.newline,
              ),
              const SizedBox(height: 16),
              const Text('Farbe',
                  style:
                      TextStyle(color: Colors.white70, fontSize: 13)),
              const SizedBox(height: 8),
              _colorPicker(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _seasonSelector() {
    final opts = [
      ('winter', 'WS', Colors.blue),
      ('summer', 'SS', Colors.orange),
      ('both', 'WS/SS', Colors.purple),
    ];
    return Row(
      children: opts.map((o) {
        final sel = _season == o.$1;
        return Expanded(
          child: GestureDetector(
            onTap: () => setState(() => _season = o.$1),
            child: Container(
              margin: const EdgeInsets.symmetric(horizontal: 2),
              padding: const EdgeInsets.symmetric(vertical: 8),
              decoration: BoxDecoration(
                color: sel
                    ? o.$3.withAlpha(80)
                    : const Color(0xFF334155),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                    color: sel
                        ? o.$3
                        : const Color(0xFF475569)),
              ),
              child: Center(
                child: Text(o.$2,
                    style: TextStyle(
                        color: sel ? o.$3 : Colors.white70,
                        fontWeight: sel
                            ? FontWeight.bold
                            : FontWeight.normal)),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _semesterDropdown() => DropdownButtonFormField<String?>(
        value: _semId,
        dropdownColor: const Color(0xFF334155),
        decoration: const InputDecoration(
            labelText: 'Semester',
            prefixIcon: Icon(Icons.calendar_today)),
        items: [
          const DropdownMenuItem<String?>(
              value: null, child: Text('Parkplatz')),
          ...widget.semesters.map((sem) => DropdownMenuItem<String?>(
                value: sem.id,
                child: Text(
                    '${sem.number}. Semester (${sem.season == 'winter' ? 'WS' : 'SS'})'),
              )),
        ],
        onChanged: (v) => setState(() => _semId = v),
      );

  Widget _gradeSlider() {
    final g = _grade ?? 3.0;
    return Row(children: [
      Expanded(
        child: Slider(
          value: g,
          min: 1.0,
          max: 5.0,
          divisions: 40,
          label: g.toStringAsFixed(1),
          onChanged: (v) => setState(
              () => _grade = double.parse(v.toStringAsFixed(1))),
        ),
      ),
      SizedBox(
        width: 42,
        child: Text(g.toStringAsFixed(1),
            textAlign: TextAlign.center,
            style: const TextStyle(
                fontWeight: FontWeight.bold, color: Colors.purple)),
      ),
    ]);
  }

  Widget _colorPicker() => Wrap(
        spacing: 8,
        runSpacing: 8,
        children: kColors.map((hex) {
          final sel = _color == hex;
          final c = hexColor(hex);
          return GestureDetector(
            onTap: () => setState(() => _color = hex),
            child: Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: c,
                shape: BoxShape.circle,
                border: Border.all(
                    color: sel ? Colors.white : Colors.transparent,
                    width: 2.5),
                boxShadow: sel
                    ? [BoxShadow(color: c.withAlpha(128), blurRadius: 6)]
                    : null,
              ),
              child: sel
                  ? const Icon(Icons.check, size: 16, color: Colors.white)
                  : null,
            ),
          );
        }).toList(),
      );
}
