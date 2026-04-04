import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';
import '../models/lecture.dart';
import '../models/semester.dart';
import '../models/study_plan.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';

class StudyPlanProvider extends ChangeNotifier {
  final _storage = StorageService();
  final _uuid = const Uuid();

  String? currentUser;
  String? authToken;
  String _baseUrl = '';
  StudyPlan _plan = StudyPlan();
  bool _isLoading = false;
  bool _localMode = false;
  Timer? _syncTimer;

  String get baseUrl => _baseUrl;
  StudyPlan get plan => _plan;
  bool get isLoading => _isLoading;
  bool get isLoggedIn => currentUser != null;
  bool get localMode => _localMode;

  static const _localUsername = 'lokal';

  ApiService get _api => ApiService(_baseUrl);

  // ─── Initialization ───────────────────────────────────────────────────────

  Future<void> initialize() async {
    _baseUrl = await _storage.loadBaseUrl();
    _localMode = await _storage.loadLocalMode();
    if (_localMode) {
      currentUser = _localUsername;
    } else {
      final user = await _storage.loadUser();
      if (user != null) {
        currentUser = user['username'];
        authToken = user['token'];
      }
    }
    final saved = await _storage.loadPlan();
    if (saved != null) _plan = saved;
    notifyListeners();
    if (isLoggedIn && !_localMode) {
      await refreshPlanFromServer();
      _startSyncTimer();
    }
  }

  Future<void> updateBaseUrl(String url) async {
    // Strip trailing slash to prevent double-slash in API paths
    _baseUrl = url.trim().replaceAll(RegExp(r'/+$'), '');
    await _storage.saveBaseUrl(_baseUrl);
    notifyListeners();
  }

  // ─── Auth ─────────────────────────────────────────────────────────────────

  Future<List<String>> getUsers() async {
    final r = await _api.getUsers();
    return r.data ?? [];
  }

  Future<({List<String> users, String? error})> getUsersResult() async {
    final r = await _api.getUsers();
    return (users: r.data ?? [], error: r.error);
  }

  /// Returns null on success, 'REQUIRES_PASSWORD' if password is needed,
  /// or an error string.
  Future<String?> login(String username, String? password) async {
    _isLoading = true;
    notifyListeners();
    try {
      final r = await _api.login(username, password);
      if (r.requiresPassword) return 'REQUIRES_PASSWORD';
      if (r.isSuccess && r.data != null) {
        currentUser = r.data!['username'] as String;
        authToken = r.data!['token'] as String;
        await _storage.saveUser(currentUser!, authToken!);
        await refreshPlanFromServer();
        _startSyncTimer();
        return null;
      }
      return r.error ?? 'Login fehlgeschlagen';
    } catch (e) {
      return e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<String?> createUser(String username, String? password) async {
    _isLoading = true;
    notifyListeners();
    try {
      final r = await _api.createUser(username, password);
      if (r.isSuccess && r.data != null) {
        currentUser = r.data!['username'] as String;
        authToken = r.data!['token'] as String;
        await _storage.saveUser(currentUser!, authToken!);
        _plan = StudyPlan();
        _startSyncTimer();
        return null;
      }
      return r.error ?? 'Erstellen fehlgeschlagen';
    } catch (e) {
      return e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    _syncTimer?.cancel();
    currentUser = null;
    authToken = null;
    _localMode = false;
    await _storage.clearUser();
    await _storage.saveLocalMode(false);
    notifyListeners();
  }

  /// Deletes the current user account on the server, then logs out.
  /// Returns null on success, or an error string on failure.
  Future<String?> deleteAccount() async {
    if (currentUser == null || authToken == null) return 'Nicht angemeldet';
    _isLoading = true;
    notifyListeners();
    try {
      final r = await _api.deleteUser(currentUser!, authToken!);
      if (r.isSuccess) {
        await _storage.clearPlan();
        await logout();
        return null;
      }
      return r.error ?? 'Löschen fehlgeschlagen';
    } catch (e) {
      return e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Deletes any user account by username (no login required).
  /// Returns null on success, or an error string on failure.
  Future<String?> deleteUserByName(String username) async {
    _isLoading = true;
    notifyListeners();
    try {
      final r = await _api.deleteUser(username);
      if (r.isSuccess) return null;
      return r.error ?? 'Löschen fehlgeschlagen';
    } catch (e) {
      return e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Switch to local-only mode — no server required.
  Future<void> enterLocalMode() async {
    _syncTimer?.cancel();
    _localMode = true;
    currentUser = _localUsername;
    authToken = null;
    await _storage.saveLocalMode(true);
    final saved = await _storage.loadPlan();
    if (saved != null) _plan = saved;
    notifyListeners();
  }

  // ─── Server Sync ──────────────────────────────────────────────────────────

  Future<void> refreshPlanFromServer() async {
    if (_localMode) return;
    if (currentUser == null || authToken == null) return;
    final r = await _api.getPlan(currentUser!, authToken!);
    if (r.isSuccess && r.data != null) {
      _plan = StudyPlan.fromJson(r.data!);
      await _storage.savePlan(_plan);
      notifyListeners();
    }
  }

  void _startSyncTimer() {
    _syncTimer?.cancel();
    _syncTimer =
        Timer.periodic(const Duration(seconds: 30), (_) => refreshPlanFromServer());
  }

  Future<void> _save() async {
    await _storage.savePlan(_plan);
    if (!_localMode && currentUser != null && authToken != null) {
      await _api.savePlan(currentUser!, authToken!, _plan.toJson());
    }
    notifyListeners();
  }

  // ─── Plan Setup ───────────────────────────────────────────────────────────

  Future<void> initializePlan(
      String name, int regularSemesters, String startSeason) async {
    final semesters = <Semester>[];
    String season = startSeason;
    for (int i = 1; i <= regularSemesters; i++) {
      semesters.add(
          Semester(id: 'semester-$i', number: i, season: season));
      season = season == 'winter' ? 'summer' : 'winter';
    }
    _plan = StudyPlan(
      planName: name,
      regularSemesters: regularSemesters,
      startSeason: startSeason,
      isConfigured: true,
      semesters: semesters,
    );
    await _save();
  }

  Future<void> updatePlanName(String name) async {
    _plan.planName = name.trim().isEmpty ? 'Mein Studienplan' : name.trim();
    await _save();
  }

  // ─── Semesters ────────────────────────────────────────────────────────────

  Future<void> addSemester() async {
    final lastNum = _plan.semesters.isEmpty
        ? 0
        : _plan.semesters.map((s) => s.number).reduce((a, b) => a > b ? a : b);
    final lastSeason = _plan.semesters.isEmpty
        ? (_plan.startSeason == 'winter' ? 'summer' : 'winter')
        : _plan.semesters.last.season;
    final newSeason = lastSeason == 'winter' ? 'summer' : 'winter';
    _plan.semesters
        .add(Semester(id: _uuid.v4(), number: lastNum + 1, season: newSeason));
    await _save();
  }

  Future<void> removeSemester(String semesterId) async {
    final sem = _plan.semesters.firstWhere((s) => s.id == semesterId);
    for (final l in sem.lectures) {
      _plan.parkingLot.add(l.copyWith(semesterId: null));
    }
    _plan.semesters.removeWhere((s) => s.id == semesterId);
    await _save();
  }

  // ─── Lectures ─────────────────────────────────────────────────────────────

  Future<void> addLecture(Lecture lecture, String? semesterId) async {
    if (semesterId != null) {
      final sem = _plan.semesters.firstWhere((s) => s.id == semesterId);
      sem.lectures.add(lecture.copyWith(semesterId: semesterId));
    } else {
      _plan.parkingLot.add(lecture.copyWith(semesterId: null));
    }
    await _save();
  }

  Future<void> updateLecture(Lecture updated) async {
    if (updated.semesterId != null) {
      final semIdx = _plan.semesters.indexWhere((s) => s.id == updated.semesterId);
      if (semIdx == -1) return;
      final sem = _plan.semesters[semIdx];
      final idx = sem.lectures.indexWhere((l) => l.id == updated.id);
      if (idx != -1) sem.lectures[idx] = updated;
    } else {
      final idx = _plan.parkingLot.indexWhere((l) => l.id == updated.id);
      if (idx != -1) _plan.parkingLot[idx] = updated;
    }
    await _save();
  }

  Future<void> removeLecture(String id, String? semesterId) async {
    if (semesterId != null) {
      final sem = _plan.semesters.firstWhere((s) => s.id == semesterId);
      sem.lectures.removeWhere((l) => l.id == id);
    } else {
      _plan.parkingLot.removeWhere((l) => l.id == id);
    }
    await _save();
  }

  Future<void> toggleLecturePassed(String id, String? semesterId) async {
    if (semesterId != null) {
      final sem = _plan.semesters.firstWhere((s) => s.id == semesterId);
      final idx = sem.lectures.indexWhere((l) => l.id == id);
      if (idx != -1) {
        final l = sem.lectures[idx];
        sem.lectures[idx] = l.copyWith(passed: !l.passed);
      }
    } else {
      final idx = _plan.parkingLot.indexWhere((l) => l.id == id);
      if (idx != -1) {
        final l = _plan.parkingLot[idx];
        _plan.parkingLot[idx] = l.copyWith(passed: !l.passed);
      }
    }
    await _save();
  }

  Future<void> moveLectureToSemester(
      String lectureId, String? fromSemesterId, String toSemesterId) async {
    Lecture? lecture;
    if (fromSemesterId != null) {
      final sem = _plan.semesters.firstWhere((s) => s.id == fromSemesterId);
      final idx = sem.lectures.indexWhere((l) => l.id == lectureId);
      if (idx != -1) {
        lecture = sem.lectures.removeAt(idx);
      }
    } else {
      final idx = _plan.parkingLot.indexWhere((l) => l.id == lectureId);
      if (idx != -1) {
        lecture = _plan.parkingLot.removeAt(idx);
      }
    }
    if (lecture == null) return;
    final toSem = _plan.semesters.firstWhere((s) => s.id == toSemesterId);
    toSem.lectures.add(lecture.copyWith(semesterId: toSemesterId));
    await _save();
  }

  Future<void> moveLectureToParkingLot(
      String lectureId, String fromSemesterId) async {
    final sem = _plan.semesters.firstWhere((s) => s.id == fromSemesterId);
    final idx = sem.lectures.indexWhere((l) => l.id == lectureId);
    if (idx == -1) return;
    final lecture = sem.lectures.removeAt(idx);
    _plan.parkingLot.add(lecture.copyWith(semesterId: null));
    await _save();
  }

  Future<void> sortSemesterLectures(String semesterId, String by) async {
    final sem = _plan.semesters.firstWhere((s) => s.id == semesterId);
    if (by == 'date') {
      sem.lectures.sort((a, b) {
        if (a.examDate == null && b.examDate == null) return 0;
        if (a.examDate == null) return 1;
        if (b.examDate == null) return -1;
        return a.examDate!.compareTo(b.examDate!);
      });
    } else {
      sem.lectures.sort((a, b) => b.ects.compareTo(a.ects));
    }
    await _save();
  }

  // ─── Export / Import ──────────────────────────────────────────────────────

  String exportJson() =>
      const JsonEncoder.withIndent('  ').convert(_plan.toJson());

  Future<String?> importJson(String jsonStr) async {
    try {
      final data = jsonDecode(jsonStr) as Map<String, dynamic>;
      _plan = StudyPlan.fromJson(data);
      await _save();
      return null;
    } catch (e) {
      return 'Import fehlgeschlagen: $e';
    }
  }

  @override
  void dispose() {
    _syncTimer?.cancel();
    super.dispose();
  }
}
