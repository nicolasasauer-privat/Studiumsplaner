import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:studi_plan/models/lecture.dart';
import 'package:studi_plan/models/semester.dart';
import 'package:studi_plan/models/study_plan.dart';

void main() {
  group('Lecture', () {
    test('fromJson / toJson round-trip', () {
      final json = {
        'id': 'abc',
        'name': 'Mathe I',
        'ects': 5,
        'examDate': '2024-01-15',
        'season': 'winter',
        'description': 'Grundlagen',
        'color': '#FF6B6B',
        'semesterId': 's1',
        'passed': true,
        'grade': 1.7,
        'oralExam': false,
      };
      final l = Lecture.fromJson(json);
      expect(l.name, 'Mathe I');
      expect(l.ects, 5);
      expect(l.grade, 1.7);
      expect(l.toJson()['name'], 'Mathe I');
    });

    test('copyWith preserves unchanged fields and allows null override', () {
      final l = Lecture(
          id: 'x', name: 'Test', ects: 3, season: 'summer', color: '#4ECDC4');
      final l2 = l.copyWith(name: 'Test2');
      expect(l2.name, 'Test2');
      expect(l2.ects, 3);
      final l3 = l.copyWith(examDate: null);
      expect(l3.examDate, null);
    });
  });

  group('Semester', () {
    test('totalEcts sums lectures', () {
      final sem = Semester(
        id: 's1',
        number: 1,
        season: 'winter',
        lectures: [
          Lecture(
              id: 'l1', name: 'A', ects: 5, season: 'winter', color: '#FF6B6B'),
          Lecture(
              id: 'l2', name: 'B', ects: 3, season: 'both', color: '#4ECDC4'),
        ],
      );
      expect(sem.totalEcts, 8);
    });

    test('averageGrade ignores ungraded', () {
      final sem = Semester(
        id: 's1',
        number: 1,
        season: 'winter',
        lectures: [
          Lecture(
              id: 'l1',
              name: 'A',
              ects: 5,
              season: 'winter',
              color: '#FF6B6B',
              passed: true,
              grade: 2.0),
          Lecture(
              id: 'l2',
              name: 'B',
              ects: 3,
              season: 'both',
              color: '#4ECDC4',
              passed: false),
        ],
      );
      expect(sem.averageGrade(), 2.0);
    });

    test('averageGrade can be weighted by ECTS', () {
      final sem = Semester(
        id: 's1',
        number: 1,
        season: 'winter',
        lectures: [
          Lecture(
              id: 'l1',
              name: 'A',
              ects: 10,
              season: 'winter',
              color: '#FF6B6B',
              passed: true,
              grade: 1.0),
          Lecture(
              id: 'l2',
              name: 'B',
              ects: 5,
              season: 'both',
              color: '#4ECDC4',
              passed: true,
              grade: 3.0),
        ],
      );

      expect(sem.averageGrade(), 2.0);
      expect(
        sem.averageGrade(weightedByEcts: true),
        closeTo(1.6667, 0.0001),
      );
    });
  });

  group('StudyPlan', () {
    test('fromJson / toJson round-trip', () {
      final plan = StudyPlan(
        planName: 'Test',
        regularSemesters: 6,
        startSeason: 'winter',
        isConfigured: true,
        weightAverageGradeByEcts: true,
      );
      final restored = StudyPlan.fromJson(plan.toJson());
      expect(restored.planName, 'Test');
      expect(restored.regularSemesters, 6);
      expect(restored.weightAverageGradeByEcts, isTrue);
    });

    test('fromJson handles decoded nested maps from persisted JSON', () {
      final plan = StudyPlan(
        planName: 'Persisted',
        regularSemesters: 6,
        startSeason: 'winter',
        isConfigured: true,
        semesters: [
          Semester(
            id: 's1',
            number: 1,
            season: 'winter',
            lectures: [
              Lecture(
                id: 'l1',
                name: 'Mathe',
                ects: 5,
                season: 'winter',
                color: '#FF6B6B',
              ),
            ],
          ),
        ],
      );

      final decoded = jsonDecode(jsonEncode(plan.toJson())) as Map;
      final restored = StudyPlan.fromJson(Map<String, dynamic>.from(decoded));

      expect(restored.isConfigured, isTrue);
      expect(restored.semesters, hasLength(1));
      expect(restored.semesters.first.lectures, hasLength(1));
      expect(restored.semesters.first.lectures.first.name, 'Mathe');
    });

    test('fromJson infers configured for older persisted plans without flag', () {
      final decoded = {
        'planName': 'Altbestand',
        'regularSemesters': 6,
        'startSeason': 'winter',
        'semesters': [
          {
            'id': 'semester-1',
            'number': 1,
            'season': 'winter',
            'lectures': [],
          },
        ],
        'parkingLot': [],
      };

      final restored = StudyPlan.fromJson(decoded);

      expect(restored.isConfigured, isTrue);
      expect(restored.isEffectivelyConfigured, isTrue);
      expect(restored.weightAverageGradeByEcts, isFalse);
    });

    test('passedEcts counts across semesters and parking lot', () {
      final plan = StudyPlan(
        parkingLot: [
          Lecture(
              id: 'p1',
              name: 'P',
              ects: 4,
              season: 'both',
              color: '#FF6B6B',
              passed: true),
        ],
        semesters: [
          Semester(
            id: 's1',
            number: 1,
            season: 'winter',
            lectures: [
              Lecture(
                  id: 'l1',
                  name: 'A',
                  ects: 5,
                  season: 'winter',
                  color: '#FF6B6B',
                  passed: true),
              Lecture(
                  id: 'l2',
                  name: 'B',
                  ects: 3,
                  season: 'both',
                  color: '#4ECDC4'),
            ],
          ),
        ],
      );
      expect(plan.passedEcts, 9); // 4 (parking) + 5 (semester)
      expect(plan.totalEcts, 12);
    });

    test('averageGrade respects ECTS weighting setting', () {
      final plan = StudyPlan(
        weightAverageGradeByEcts: true,
        semesters: [
          Semester(
            id: 's1',
            number: 1,
            season: 'winter',
            lectures: [
              Lecture(
                id: 'l1',
                name: 'Mathe',
                ects: 10,
                season: 'winter',
                color: '#FF6B6B',
                passed: true,
                grade: 1.0,
              ),
            ],
          ),
        ],
        parkingLot: [
          Lecture(
            id: 'p1',
            name: 'Seminar',
            ects: 5,
            season: 'both',
            color: '#4ECDC4',
            passed: true,
            grade: 3.0,
          ),
        ],
      );

      expect(plan.averageGrade, closeTo(1.6667, 0.0001));
      expect(plan.calculateAverageGrade(weightedByEcts: false), 2.0);
    });
  });
}
