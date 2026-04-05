import 'dart:convert';
import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import '../models/study_plan.dart';
import '../providers/study_plan_provider.dart';
import '../widgets/add_lecture_dialog.dart';
import '../widgets/parking_lot_section.dart';
import '../widgets/plan_setup_dialog.dart';
import '../widgets/plan_settings_dialog.dart';
import '../widgets/semester_section.dart';

class MainScreen extends StatefulWidget {
  const MainScreen({super.key});

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  final _nameCtrl = TextEditingController();
  bool _editingName = false;
  bool _bannerDismissed = false;
  bool _setupDialogScheduled = false;
  bool _setupDialogOpen = false;

  @override
  void dispose() {
    _nameCtrl.dispose();
    super.dispose();
  }

  Future<void> _export(StudyPlanProvider p) async {
    try {
      final json = p.exportJson();
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/studi_plan_export.json');
      await file.writeAsString(json);
      await Share.shareXFiles(
        [XFile(file.path, mimeType: 'application/json')],
        subject: 'StudiPlan Export',
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Export fehlgeschlagen: $e')),
        );
      }
    }
  }

  Future<void> _import(StudyPlanProvider p) async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['json'],
      withData: true,
    );
    if (result == null || result.files.isEmpty) return;
    String? content;
    final bytes = result.files.first.bytes;
    if (bytes != null) {
      content = utf8.decode(bytes);
    } else {
      final path = result.files.first.path;
      if (path != null) content = await File(path).readAsString();
    }
    if (content == null) return;
    final err = await p.importJson(content);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(err ?? 'Plan erfolgreich importiert'),
      backgroundColor: err == null ? Colors.green : Colors.red.shade700,
    ));
  }

  void _deleteAccount(StudyPlanProvider p) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Konto löschen?'),
        content: Text(
          'Soll das Konto "${p.currentUser}" unwiderruflich gelöscht werden? '
          'Alle Daten gehen dabei verloren.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Abbrechen'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
                backgroundColor: Colors.red.shade700),
            onPressed: () async {
              Navigator.pop(context);
              final err = await p.deleteAccount();
              if (err != null && mounted) {
                ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                  content: Text('Fehler: $err'),
                  backgroundColor: Colors.red.shade700,
                ));
              }
            },
            child: const Text('Löschen'),
          ),
        ],
      ),
    );
  }

  void _addLecture(StudyPlanProvider p) {
    showDialog(
      context: context,
      builder: (_) => AddLectureDialog(
        semesters: p.plan.semesters,
        onSave: (l, semId) => p.addLecture(l, semId),
      ),
    );
  }

  Future<void> _openSetup(StudyPlanProvider p,
      {bool barrierDismissible = true}) async {
    if (_setupDialogOpen) return;

    _setupDialogOpen = true;
    try {
      await showDialog(
        context: context,
        barrierDismissible: barrierDismissible,
        builder: (_) => PlanSetupDialog(
          initialName: p.plan.planName,
          initialSemesters: p.plan.regularSemesters,
          initialSeason: p.plan.startSeason,
          onSave: (name, n, season) => p.initializePlan(name, n, season),
        ),
      );
    } finally {
      _setupDialogOpen = false;
    }
  }

  Future<void> _openSettings(StudyPlanProvider p) async {
    await showDialog(
      context: context,
      builder: (_) => PlanSettingsDialog(
        initialWeightAverageGradeByEcts: p.plan.weightAverageGradeByEcts,
        onSave: p.updateGradeWeighting,
      ),
    );
  }

  void _closeSetupIfNoLongerNeeded(StudyPlanProvider p) {
    if (!_setupDialogOpen || !p.plan.isEffectivelyConfigured) return;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_setupDialogOpen) return;
      Navigator.of(context, rootNavigator: true).maybePop();
    });
  }

  void _scheduleInitialSetupIfNeeded(StudyPlanProvider p) {
    if (_setupDialogScheduled ||
        _setupDialogOpen ||
        !p.isLoggedIn ||
        p.plan.isEffectivelyConfigured) {
      return;
    }

    _setupDialogScheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) {
        _setupDialogScheduled = false;
        return;
      }

      final provider = context.read<StudyPlanProvider>();
      if (!provider.isLoggedIn || provider.plan.isEffectivelyConfigured) {
        _setupDialogScheduled = false;
        return;
      }

      await _openSetup(provider, barrierDismissible: false);
      if (mounted) {
        _setupDialogScheduled = false;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final p = context.watch<StudyPlanProvider>();
    final plan = p.plan;

    _closeSetupIfNoLongerNeeded(p);
    _scheduleInitialSetupIfNeeded(p);

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(p),
            if (!_bannerDismissed) _buildBanner(),
            Expanded(
              child: RefreshIndicator(
                onRefresh: p.refreshPlanFromServer,
                child: ListView(
                  padding: const EdgeInsets.all(12),
                  children: [
                    _buildStats(plan),
                    const SizedBox(height: 12),
                    ParkingLotSection(
                        lectures: plan.parkingLot,
                        semesters: plan.semesters,
                        provider: p),
                    const SizedBox(height: 8),
                    ...plan.semesters.map(
                        (sem) => SemesterSection(semester: sem, provider: p)),
                    const SizedBox(height: 80),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        icon: const Icon(Icons.add),
        label: const Text('Veranstaltung'),
        onPressed: () => _addLecture(p),
      ),
    );
  }

  Widget _buildHeader(StudyPlanProvider p) => Container(
        color: const Color(0xFF0F172A),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(
          children: [
            const Icon(Icons.school, color: Colors.blue, size: 22),
            const SizedBox(width: 8),
            Expanded(
              child: _editingName
                  ? TextField(
                      controller: _nameCtrl,
                      autofocus: true,
                      style: const TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.bold,
                          color: Colors.white),
                      decoration: const InputDecoration(
                          isDense: true,
                          contentPadding: EdgeInsets.symmetric(
                              horizontal: 6, vertical: 4)),
                      onSubmitted: (v) {
                        if (v.trim().isNotEmpty) p.updatePlanName(v.trim());
                        setState(() => _editingName = false);
                      },
                    )
                  : GestureDetector(
                      onTap: () {
                        _nameCtrl.text = p.plan.planName;
                        setState(() => _editingName = true);
                      },
                      child: Row(
                        children: [
                          Flexible(
                            child: Text(
                              p.plan.planName,
                              style: const TextStyle(
                                  fontSize: 17,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 4),
                          const Icon(Icons.edit,
                              size: 14, color: Colors.white54),
                        ],
                      ),
                    ),
            ),
            IconButton(
                icon: const Icon(Icons.download, color: Colors.white70,
                    size: 20),
                tooltip: 'Importieren',
                onPressed: () => _import(p)),
            IconButton(
                icon: const Icon(Icons.upload, color: Colors.white70,
                    size: 20),
                tooltip: 'Exportieren',
                onPressed: () => _export(p)),
            IconButton(
                icon: const Icon(Icons.add_circle_outline,
                    color: Colors.white70, size: 20),
                tooltip: 'Semester hinzufügen',
                onPressed: () => p.addSemester()),
            IconButton(
                icon: const Icon(Icons.settings,
                    color: Colors.white70, size: 20),
                tooltip: p.plan.isEffectivelyConfigured
                    ? 'Planeinstellungen'
                    : 'Plan einrichten',
                onPressed: () => p.plan.isEffectivelyConfigured
                    ? _openSettings(p)
                    : _openSetup(p)),
            if (p.localMode)
              const Tooltip(
                message: 'Lokaler Modus – keine Serververbindung',
                child: Padding(
                  padding: EdgeInsets.symmetric(horizontal: 4),
                  child: Icon(Icons.phone_android,
                      color: Colors.amber, size: 18),
                ),
              ),
            if (!p.localMode)
              IconButton(
                icon: const Icon(Icons.person_remove,
                    color: Colors.red, size: 20),
                tooltip: 'Konto löschen',
                onPressed: () => _deleteAccount(p),
              ),
            IconButton(
                icon: const Icon(Icons.logout,
                    color: Colors.white70, size: 20),
                tooltip: 'Abmelden',
                onPressed: () => p.logout()),
          ],
        ),
      );

  Widget _buildBanner() => Container(
        margin: const EdgeInsets.fromLTRB(12, 8, 12, 0),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.blue.shade900.withAlpha(128),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: Colors.blue.shade700),
        ),
        child: Row(
          children: [
            const Icon(Icons.info_outline, color: Colors.blue, size: 16),
            const SizedBox(width: 8),
            const Expanded(
              child: Text(
                'WS/SS bei Veranstaltungen ist ein Hinweis zum Turnus. '
                'Klausuren können weiterhin in jedem Semester geplant werden.',
                style: TextStyle(color: Colors.blue, fontSize: 12),
              ),
            ),
            IconButton(
              icon: const Icon(Icons.close, size: 14, color: Colors.blue),
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
              onPressed: () =>
                  setState(() => _bannerDismissed = true),
            ),
          ],
        ),
      );

  Widget _buildStats(StudyPlan plan) {
    final total = plan.totalEcts;
    final passed = plan.passedEcts;
    final avg = plan.averageGrade;
    if (total == 0) return const SizedBox.shrink();
    return Row(
      children: [
        _chip('$total ECTS', 'geplant', Colors.blue),
        const SizedBox(width: 8),
        _chip('$passed ECTS', 'bestanden', Colors.green),
        if (avg != null) ...[
          const SizedBox(width: 8),
          _chip(
            'Ø ${avg.toStringAsFixed(1)}',
            plan.weightAverageGradeByEcts ? 'Note · ECTS' : 'Note',
            Colors.purple,
          ),
        ],
      ],
    );
  }

  Widget _chip(String value, String label, Color color) => Expanded(
        child: Container(
          padding:
              const EdgeInsets.symmetric(vertical: 8, horizontal: 10),
          decoration: BoxDecoration(
            color: color.withAlpha(40),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: color.withAlpha(100)),
          ),
          child: Column(children: [
            Text(value,
                style: TextStyle(
                    color: color,
                    fontWeight: FontWeight.bold,
                    fontSize: 16)),
            Text(label,
                style:
                    const TextStyle(color: Colors.white54, fontSize: 10)),
          ]),
        ),
      );
}
