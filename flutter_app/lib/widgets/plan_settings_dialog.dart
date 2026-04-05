import 'package:flutter/material.dart';

class PlanSettingsDialog extends StatefulWidget {
  final bool initialWeightAverageGradeByEcts;
  final Future<void> Function(bool weightAverageGradeByEcts) onSave;

  const PlanSettingsDialog({
    super.key,
    required this.initialWeightAverageGradeByEcts,
    required this.onSave,
  });

  @override
  State<PlanSettingsDialog> createState() => _PlanSettingsDialogState();
}

class _PlanSettingsDialogState extends State<PlanSettingsDialog> {
  late bool _weightAverageGradeByEcts;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _weightAverageGradeByEcts = widget.initialWeightAverageGradeByEcts;
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await widget.onSave(_weightAverageGradeByEcts);
      if (mounted) Navigator.of(context).pop();
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: const Color(0xFF1E293B),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 48),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Planeinstellungen',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 4),
            const Text(
              'Lege fest, wie die Durchschnittsnote im Plan berechnet wird.',
              style: TextStyle(color: Colors.white70, fontSize: 13),
            ),
            const SizedBox(height: 20),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              value: _weightAverageGradeByEcts,
              title: const Text('Durchschnittsnote nach ECTS gewichten'),
              subtitle: const Text(
                'Größere Module beeinflussen die Gesamt- und Semesternote stärker.',
                style: TextStyle(color: Colors.white70),
              ),
              onChanged: _saving
                  ? null
                  : (value) {
                      setState(() => _weightAverageGradeByEcts = value);
                    },
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: _saving
                  ? const Center(child: CircularProgressIndicator())
                  : ElevatedButton(
                      onPressed: _save,
                      child: const Text('Speichern'),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
