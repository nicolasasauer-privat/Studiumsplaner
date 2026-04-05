import 'dart:async';
import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';
import '../models/lecture.dart';
import '../models/local_user_account.dart';
import '../models/semester.dart';
import '../models/study_plan.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';

class StudyPlanProvider extends ChangeNotifier {
  static const _legacyGeneratedLocalUsername = 'lokal';
  static const _maxPasswordLength = 128;

  final StorageService _storage;
  final _uuid = const Uuid();

  String? currentUser;
  String? authToken;
  String _baseUrl = '';
  StudyPlan _plan = StudyPlan();
  bool _isInitialized = false;
  bool _isLoading = false;
  bool _localMode = false;
  Timer? _syncTimer;

  StudyPlanProvider({StorageService? storage})
      : _storage = storage ?? StorageService();

  String get baseUrl => _baseUrl;
  StudyPlan get plan => _plan;
  bool get isInitialized => _isInitialized;
  bool get isLoading => _isLoading;
  bool get isLoggedIn => currentUser != null;
  bool get localMode => _localMode;

  ApiService get _api => ApiService(_baseUrl);

  Future<void> initialize() async {
    try {
      _baseUrl = await _storage.loadBaseUrl();
      _localMode = await _storage.loadLocalMode();

      final savedUser = await _storage.loadUser();
      if (_localMode) {
        await _restoreLocalSession(savedUser);
      } else if (savedUser != null) {
        currentUser = savedUser['username'];
        authToken = savedUser['token'];
      }

      if (currentUser != null) {
        final saved = await _storage.loadPlan(
          username: currentUser,
          local: _localMode,
          fallbackToLegacy: !_localMode,
        );
        if (saved != null) _plan = saved;
      }

      if (isLoggedIn && !_localMode) {
        await refreshPlanFromServer();
        _startSyncTimer();
      }
    } finally {
      _isInitialized = true;
      notifyListeners();
    }
  }

  Future<void> updateBaseUrl(String url) async {
    _baseUrl = url.trim().replaceAll(RegExp(r'/+$'), '');
    await _storage.saveBaseUrl(_baseUrl);
    notifyListeners();
  }

  Future<List<String>> getUsers() async {
    if (_localMode) {
      final users = await _storage.loadLocalUsers();
      users.sort(
        (a, b) => a.username.toLowerCase().compareTo(b.username.toLowerCase()),
      );
      return users.map((user) => user.username).toList();
    }

    final r = await _api.getUsers();
    return r.data ?? [];
  }

  Future<({List<String> users, String? error})> getUsersResult() async {
    if (_localMode) {
      return (users: await getUsers(), error: null);
    }

    final r = await _api.getUsers();
    return (users: r.data ?? [], error: r.error);
  }

  Future<String?> login(String username, String? password) async {
    _isLoading = true;
    notifyListeners();
    try {
      if (_localMode) {
        return await _loginLocalUser(username, password);
      }

      final r = await _api.login(username, password);
      if (r.requiresPassword) return 'REQUIRES_PASSWORD';
      if (r.isSuccess && r.data != null) {
        currentUser = r.data!['username'] as String;
        authToken = r.data!['token'] as String;
        _localMode = false;
        _plan = await _storage.loadPlan(
              username: currentUser,
              fallbackToLegacy: true,
            ) ??
            StudyPlan();
        await _storage.saveUser(currentUser!, authToken!);
        await _storage.saveLocalMode(false);
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
      if (_localMode) {
        return await _createLocalUser(username, password);
      }

      final r = await _api.createUser(username, password);
      if (r.isSuccess && r.data != null) {
        currentUser = r.data!['username'] as String;
        authToken = r.data!['token'] as String;
        _localMode = false;
        await _storage.saveUser(currentUser!, authToken!);
        await _storage.saveLocalMode(false);
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
    _plan = StudyPlan();
    notifyListeners();
    await _storage.clearUser();
    await _storage.saveLocalMode(_localMode);
  }

  Future<String?> deleteAccount() async {
    if (currentUser == null) return 'Nicht angemeldet';
    _isLoading = true;
    notifyListeners();
    try {
      if (_localMode) {
        return await _deleteLocalUser(currentUser!, keepLocalMode: true);
      }

      if (authToken == null) return 'Nicht angemeldet';
      final username = currentUser!;
      final r = await _api.deleteUser(username, authToken!);
      if (r.isSuccess) {
        await _storage.clearPlan(username: username);
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

  Future<String?> deleteUserByName(String username) async {
    _isLoading = true;
    notifyListeners();
    try {
      if (_localMode) {
        return await _deleteLocalUser(username);
      }

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

  Future<void> enterLocalMode() async {
    _syncTimer?.cancel();
    _localMode = true;
    currentUser = null;
    authToken = null;
    _plan = StudyPlan();
    notifyListeners();
    await _storage.clearUser();
    await _storage.saveLocalMode(true);
  }

  Future<void> leaveLocalMode() async {
    _syncTimer?.cancel();
    _localMode = false;
    currentUser = null;
    authToken = null;
    _plan = StudyPlan();
    notifyListeners();
    await _storage.clearUser();
    await _storage.saveLocalMode(false);
  }

  Future<void> refreshPlanFromServer() async {
    if (_localMode) return;
    if (currentUser == null || authToken == null) return;

    final r = await _api.getPlan(currentUser!, authToken!);
    if (r.isSuccess && r.data != null) {
      _plan = StudyPlan.fromJson(r.data!);
      await _storage.savePlan(_plan, username: currentUser);
      notifyListeners();
    }
  }

  void _startSyncTimer() {
    _syncTimer?.cancel();
    _syncTimer = Timer.periodic(
      const Duration(seconds: 30),
      (_) => refreshPlanFromServer(),
    );
  }

  Future<void> _save() async {
    await _storage.savePlan(
      _plan,
      username: currentUser,
      local: _localMode,
    );
    if (!_localMode && currentUser != null && authToken != null) {
      await _api.savePlan(currentUser!, authToken!, _plan.toJson());
    }
    notifyListeners();
  }

  Future<void> initializePlan(
    String name,
    int regularSemesters,
    String startSeason,
  ) async {
    final semesters = <Semester>[];
    String season = startSeason;
    for (int i = 1; i <= regularSemesters; i++) {
      semesters.add(Semester(id: 'semester-$i', number: i, season: season));
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

  Future<void> updateGradeWeighting(bool enabled) async {
    _plan.weightAverageGradeByEcts = enabled;
    await _save();
  }

  Future<void> addSemester() async {
    final lastNum = _plan.semesters.isEmpty
        ? 0
        : _plan.semesters.map((s) => s.number).reduce((a, b) => a > b ? a : b);
    final lastSeason = _plan.semesters.isEmpty
        ? (_plan.startSeason == 'winter' ? 'summer' : 'winter')
        : _plan.semesters.last.season;
    final newSeason = lastSeason == 'winter' ? 'summer' : 'winter';
    _plan.semesters.add(
      Semester(id: _uuid.v4(), number: lastNum + 1, season: newSeason),
    );
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
      final semIdx = _plan.semesters.indexWhere(
        (s) => s.id == updated.semesterId,
      );
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
    String lectureId,
    String? fromSemesterId,
    String toSemesterId,
  ) async {
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
    String lectureId,
    String fromSemesterId,
  ) async {
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

  String exportJson() =>
      const JsonEncoder.withIndent('  ').convert(_plan.toJson());

  Future<String?> importJson(String jsonStr) async {
    try {
      final decoded = jsonDecode(jsonStr);
      if (decoded is! Map) {
        return 'Import fehlgeschlagen: Ungültiges JSON-Format';
      }
      final data = Map<String, dynamic>.from(decoded);
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

  Future<void> _restoreLocalSession(Map<String, String>? savedUser) async {
    var localUsers = await _storage.loadLocalUsers();
    localUsers = await _normalizeLegacyGeneratedLocalUsers(localUsers);
    if (savedUser != null &&
        localUsers.any((user) => user.username == savedUser['username'])) {
      currentUser = savedUser['username'];
      authToken = savedUser['token'];
      return;
    }

    if (localUsers.isEmpty) {
      await _migrateLegacyLocalPlanIfNeeded();
    }

    currentUser = null;
    authToken = null;
    await _storage.clearUser();
  }

  Future<String?> _loginLocalUser(String username, String? password) async {
    final normalized = _sanitizeUsername(username);
    if (normalized == null) return 'Ungültiger Benutzername';

    final users = await _storage.loadLocalUsers();
    LocalUserAccount? account;
    for (final user in users) {
      if (user.username == normalized) {
        account = user;
        break;
      }
    }

    if (account == null) return 'Benutzer nicht gefunden';

    if (account.passwordHash != null) {
      if (password == null || password.isEmpty) return 'REQUIRES_PASSWORD';
      if (!_verifyLocalPassword(password, account.passwordHash!)) {
        return 'Falsches Passwort';
      }
    }

    currentUser = account.username;
    authToken = _localSessionToken(account.username);
    await _storage.saveUser(currentUser!, authToken!);
    _plan = await _storage.loadPlan(
          username: account.username,
          local: true,
          fallbackToLegacy: false,
        ) ??
        StudyPlan();
    return null;
  }

  Future<String?> _createLocalUser(String username, String? password) async {
    final normalized = _sanitizeUsername(username);
    if (normalized == null) return 'Ungültiger Benutzername';

    if (password != null && password.length > _maxPasswordLength) {
      return 'Passwort zu lang';
    }

    final users = await _storage.loadLocalUsers();
    if (users.any((user) => user.username == normalized)) {
      return 'Benutzername bereits vergeben';
    }

    final localUsers = [...users];
    localUsers.add(
      LocalUserAccount(
        username: normalized,
        passwordHash: (password == null || password.isEmpty)
            ? null
            : _hashLocalPassword(password),
      ),
    );
    localUsers.sort(
      (a, b) => a.username.toLowerCase().compareTo(b.username.toLowerCase()),
    );

    currentUser = normalized;
    authToken = _localSessionToken(normalized);
    await _storage.saveLocalUsers(localUsers);
    final pendingPlan = await _storage.loadPendingLocalPlan();
    _plan = pendingPlan ?? StudyPlan();
    if (pendingPlan != null) {
      await _storage.savePlan(_plan, username: normalized, local: true);
      await _storage.clearPendingLocalPlan();
    }
    await _storage.saveUser(currentUser!, authToken!);
    return null;
  }

  Future<String?> _deleteLocalUser(
    String username, {
    bool keepLocalMode = false,
  }) async {
    final users = await _storage.loadLocalUsers();
    final updatedUsers =
        users.where((user) => user.username != username).toList(growable: false);
    if (updatedUsers.length == users.length) {
      return 'Benutzer nicht gefunden';
    }

    await _storage.saveLocalUsers(updatedUsers);
    await _storage.clearPlan(username: username, local: true);

    if (currentUser == username) {
      currentUser = null;
      authToken = null;
      _plan = StudyPlan();
      await _storage.clearUser();
      if (!keepLocalMode) {
        _localMode = false;
        await _storage.saveLocalMode(false);
      }
    }

    return null;
  }

  String? _sanitizeUsername(String username) {
    final trimmed = username.trim();
    if (trimmed.isEmpty || trimmed.length > 50) return null;
    if (!RegExp(r'^[-a-zA-Z0-9_ ]+$').hasMatch(trimmed)) return null;
    return trimmed;
  }

  String _localSessionToken(String username) => 'local-session:$username';

  String _hashLocalPassword(String password) {
    final salt = _uuid.v4();
    final digest = sha256.convert(utf8.encode('$salt:$password')).toString();
    return '$salt:$digest';
  }

  bool _verifyLocalPassword(String password, String storedHash) {
    final separator = storedHash.indexOf(':');
    if (separator == -1) return false;
    final salt = storedHash.substring(0, separator);
    final digest = storedHash.substring(separator + 1);
    final candidate = sha256.convert(utf8.encode('$salt:$password')).toString();
    return candidate == digest;
  }

  Future<void> _migrateLegacyLocalPlanIfNeeded() async {
    final pendingPlan = await _storage.loadPendingLocalPlan();
    if (pendingPlan != null) return;

    final legacyPlan = await _storage.loadPlan();
    if (legacyPlan == null) return;

    await _storage.savePendingLocalPlan(legacyPlan);
    await _storage.clearLegacyPlan();
  }

  Future<List<LocalUserAccount>> _normalizeLegacyGeneratedLocalUsers(
    List<LocalUserAccount> localUsers,
  ) async {
    final candidates = localUsers
        .where((user) =>
            user.username == _legacyGeneratedLocalUsername &&
            user.passwordHash == null)
        .toList(growable: false);
    if (candidates.length != 1) {
      return localUsers;
    }

    final candidate = candidates.single;
    final remainingUsers = localUsers
        .where((user) => user.username != candidate.username)
        .toList(growable: false);

    if (remainingUsers.isNotEmpty) {
      await _storage.clearPlan(username: candidate.username, local: true);
      await _storage.saveLocalUsers(remainingUsers);
      return remainingUsers;
    }

    final pendingPlan = await _storage.loadPendingLocalPlan();
    if (pendingPlan == null) {
      final generatedPlan = await _storage.loadPlan(
        username: candidate.username,
        local: true,
        fallbackToLegacy: false,
      );
      if (generatedPlan != null) {
        await _storage.savePendingLocalPlan(generatedPlan);
      }
    }

    await _storage.clearPlan(username: candidate.username, local: true);
    await _storage.saveLocalUsers(const []);
    await _storage.clearUser();
    return const [];
  }
}
