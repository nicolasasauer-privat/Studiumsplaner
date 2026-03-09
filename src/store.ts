import { create } from 'zustand';
import type { Lecture, Semester, SemesterSeason, StudyPlan } from './types';

const PLAN_STORAGE_KEY = 'studyPlan';
const DEFAULT_PLAN_NAME = 'Mein Studienplan';
const DEFAULT_REGULAR_SEMESTERS = 6;
const DEFAULT_START_SEASON: SemesterSeason = 'winter';
const MIN_SEMESTERS = 1;
const MAX_SEMESTERS = 20;

const isSemesterSeason = (value: unknown): value is SemesterSeason =>
  value === 'winter' || value === 'summer';

const clampSemesterCount = (count: number): number =>
  Math.min(MAX_SEMESTERS, Math.max(MIN_SEMESTERS, Math.floor(count)));

const getSeasonForSemester = (semesterNumber: number, startSeason: SemesterSeason): SemesterSeason => {
  const isOddSemester = semesterNumber % 2 === 1;
  if (startSeason === 'winter') {
    return isOddSemester ? 'winter' : 'summer';
  }
  return isOddSemester ? 'summer' : 'winter';
};

const createSemester = (number: number, startSeason: SemesterSeason, id?: string): Semester => ({
  id: id ?? `${Date.now()}-${number}`,
  number,
  season: getSeasonForSemester(number, startSeason),
  lectures: [],
});

const generateInitialSemesters = (count: number, startSeason: SemesterSeason): Semester[] => {
  const semesterCount = clampSemesterCount(count);
  return Array.from({ length: semesterCount }, (_, index) =>
    createSemester(index + 1, startSeason, `semester-${index + 1}`)
  );
};

const migrateStudyPlan = (raw: unknown): StudyPlan => {
  const fallback: StudyPlan = {
    planName: DEFAULT_PLAN_NAME,
    regularSemesters: DEFAULT_REGULAR_SEMESTERS,
    startSeason: DEFAULT_START_SEASON,
    isConfigured: false,
    semesters: generateInitialSemesters(DEFAULT_REGULAR_SEMESTERS, DEFAULT_START_SEASON),
    parkingLot: [],
  };

  if (!raw || typeof raw !== 'object') {
    return fallback;
  }

  const data = raw as Partial<StudyPlan> & { semesters?: unknown; parkingLot?: unknown };
  const startSeason = isSemesterSeason(data.startSeason) ? data.startSeason : DEFAULT_START_SEASON;

  const regularSemesters = clampSemesterCount(
    typeof data.regularSemesters === 'number'
      ? data.regularSemesters
      : Array.isArray(data.semesters)
        ? data.semesters.length
        : DEFAULT_REGULAR_SEMESTERS
  );

  const planName =
    typeof data.planName === 'string' && data.planName.trim().length > 0
      ? data.planName.trim()
      : DEFAULT_PLAN_NAME;

  const semesters = Array.isArray(data.semesters)
    ? data.semesters
        .map((semesterLike, index): Semester | null => {
          if (!semesterLike || typeof semesterLike !== 'object') {
            return null;
          }

          const candidate = semesterLike as Partial<Semester>;
          const number =
            typeof candidate.number === 'number' && Number.isFinite(candidate.number)
              ? Math.max(1, Math.floor(candidate.number))
              : index + 1;

          return {
            id: typeof candidate.id === 'string' ? candidate.id : `semester-${number}`,
            number,
            season: isSemesterSeason(candidate.season)
              ? candidate.season
              : getSeasonForSemester(number, startSeason),
            lectures: Array.isArray(candidate.lectures) ? candidate.lectures as Lecture[] : [],
          };
        })
        .filter((semester): semester is Semester => semester !== null)
        .sort((a, b) => a.number - b.number)
    : [];

  const parkingLot = Array.isArray(data.parkingLot) ? data.parkingLot as Lecture[] : [];

  return {
    planName,
    regularSemesters,
    startSeason,
    isConfigured: typeof data.isConfigured === 'boolean' ? data.isConfigured : semesters.length > 0,
    semesters: semesters.length > 0 ? semesters : generateInitialSemesters(regularSemesters, startSeason),
    parkingLot,
  };
};

interface StudyPlanStore extends StudyPlan {
  initializePlan: (options: { planName: string; regularSemesters: number; startSeason: SemesterSeason }) => void;
  setPlanName: (name: string) => void;
  addSemester: () => void;
  removeSemester: (id: string) => void;
  addLecture: (lecture: Lecture) => void;
  removeLecture: (id: string) => void;
  moveLectureToSemester: (lectureId: string, semesterId?: string) => void;
  moveLectureToParkingLot: (lectureId: string) => void;
  updateLecture: (lectureId: string, updates: Partial<Lecture>) => void;
  reorderLecturesInSemester: (semesterId: string, lectures: Lecture[]) => void;
  sortSemesterLectures: (semesterId: string, sortBy: 'date' | 'ects') => void;
  loadPlan: (plan: StudyPlan) => void;
  savePlan: () => string;
  exportPlan: () => void;
  importPlan: (jsonString: string) => void;
}

export const useStudyPlanStore = create<StudyPlanStore>((set, get) => ({
  planName: DEFAULT_PLAN_NAME,
  regularSemesters: DEFAULT_REGULAR_SEMESTERS,
  startSeason: DEFAULT_START_SEASON,
  isConfigured: false,
  semesters: generateInitialSemesters(DEFAULT_REGULAR_SEMESTERS, DEFAULT_START_SEASON),
  parkingLot: [],

  initializePlan: ({ planName, regularSemesters, startSeason }) => {
    const normalizedName = planName.trim() || DEFAULT_PLAN_NAME;
    const normalizedSemesters = clampSemesterCount(regularSemesters);
    set({
      planName: normalizedName,
      regularSemesters: normalizedSemesters,
      startSeason,
      isConfigured: true,
      semesters: generateInitialSemesters(normalizedSemesters, startSeason),
      parkingLot: [],
    });
    get().savePlan();
  },

  setPlanName: (name: string) => {
    set({ planName: name.trim() || DEFAULT_PLAN_NAME });
    get().savePlan();
  },

  addSemester: () => {
    set((state) => {
      const newNumber = Math.max(...state.semesters.map((s) => s.number), 0) + 1;
      const semester = createSemester(newNumber, state.startSeason);
      return {
        semesters: [...state.semesters, semester],
      };
    });
    get().savePlan();
  },

  removeSemester: (id: string) => {
    set((state) => {
      const semester = state.semesters.find((s) => s.id === id);
      if (!semester) return state;

      return {
        semesters: state.semesters.filter((s) => s.id !== id),
        parkingLot: [...state.parkingLot, ...semester.lectures],
      };
    });
    get().savePlan();
  },

  addLecture: (lecture: Lecture) => {
    set((state) => ({
      parkingLot: [...state.parkingLot, lecture],
    }));
    get().savePlan();
  },

  removeLecture: (id: string) => {
    set((state) => {
      const semesters = state.semesters.map((s) => ({
        ...s,
        lectures: s.lectures.filter((l) => l.id !== id),
      }));
      const parkingLot = state.parkingLot.filter((l) => l.id !== id);
      return { semesters, parkingLot };
    });
    get().savePlan();
  },

  moveLectureToSemester: (lectureId: string, semesterId?: string) => {
    set((state) => {
      let lecture: Lecture | undefined;
      let newSemesters = state.semesters;
      let newParkingLot = state.parkingLot;

      for (let i = 0; i < newSemesters.length; i += 1) {
        const idx = newSemesters[i].lectures.findIndex((l) => l.id === lectureId);
        if (idx !== -1) {
          lecture = newSemesters[i].lectures[idx];
          newSemesters = newSemesters.map((s, semIdx) =>
            semIdx === i ? { ...s, lectures: s.lectures.filter((l) => l.id !== lectureId) } : s
          );
          break;
        }
      }

      if (!lecture) {
        const idx = newParkingLot.findIndex((l) => l.id === lectureId);
        if (idx !== -1) {
          lecture = newParkingLot[idx];
          newParkingLot = newParkingLot.filter((l) => l.id !== lectureId);
        }
      }

      if (!lecture || !semesterId) return state;

      const newSemestersWithLecture = newSemesters.map((s) =>
        s.id === semesterId
          ? { ...s, lectures: [...s.lectures, { ...lecture, semesterId }] }
          : s
      );

      return { semesters: newSemestersWithLecture, parkingLot: newParkingLot };
    });
    get().savePlan();
  },

  moveLectureToParkingLot: (lectureId: string) => {
    set((state) => {
      let lecture: Lecture | undefined;
      const newSemesters = state.semesters.map((s) => {
        const lectureToMove = s.lectures.find((l) => l.id === lectureId);
        if (lectureToMove) {
          lecture = lectureToMove;
          return {
            ...s,
            lectures: s.lectures.filter((l) => l.id !== lectureId),
          };
        }
        return s;
      });

      if (!lecture) return state;

      return {
        semesters: newSemesters,
        parkingLot: [...state.parkingLot, { ...lecture, semesterId: undefined }],
      };
    });
    get().savePlan();
  },

  updateLecture: (lectureId: string, updates: Partial<Lecture>) => {
    set((state) => {
      const semesters = state.semesters.map((s) => ({
        ...s,
        lectures: s.lectures.map((l) => (l.id === lectureId ? { ...l, ...updates } : l)),
      }));

      const parkingLot = state.parkingLot.map((l) =>
        l.id === lectureId ? { ...l, ...updates } : l
      );

      return { semesters, parkingLot };
    });
    get().savePlan();
  },

  reorderLecturesInSemester: (semesterId: string, lectures: Lecture[]) => {
    set((state) => {
      const semesters = state.semesters.map((s) =>
        s.id === semesterId ? { ...s, lectures } : s
      );
      return { semesters };
    });
    get().savePlan();
  },

  sortSemesterLectures: (semesterId: string, sortBy: 'date' | 'ects') => {
    set((state) => {
      const semesters = state.semesters.map((s) => {
        if (s.id === semesterId) {
          const sorted = [...s.lectures].sort((a, b) => {
            if (sortBy === 'date') {
              const aTime = a.examDate ? new Date(a.examDate).getTime() : null;
              const bTime = b.examDate ? new Date(b.examDate).getTime() : null;
              if (aTime !== null && bTime !== null) return aTime - bTime;
              if (aTime !== null) return -1;
              if (bTime !== null) return 1;
              return a.name.localeCompare(b.name);
            }
            return b.ects - a.ects;
          });
          return { ...s, lectures: sorted };
        }
        return s;
      });
      return { semesters };
    });
    get().savePlan();
  },

  loadPlan: (plan: StudyPlan) => {
    set(migrateStudyPlan(plan));
    get().savePlan();
  },

  savePlan: () => {
    const state = get();
    const plan: StudyPlan = {
      planName: state.planName,
      regularSemesters: state.regularSemesters,
      startSeason: state.startSeason,
      isConfigured: state.isConfigured,
      semesters: state.semesters,
      parkingLot: state.parkingLot,
    };
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plan));
    return JSON.stringify(plan);
  },

  exportPlan: () => {
    const jsonString = get().savePlan();
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `studienplan-${get().planName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  importPlan: (jsonString: string) => {
    try {
      const parsed = JSON.parse(jsonString) as unknown;
      const migratedPlan = migrateStudyPlan(parsed);
      set(migratedPlan);
      get().savePlan();
    } catch (error) {
      console.error('Failed to import plan:', error);
      throw new Error('Ungültige JSON-Datei. Bitte eine gültige Studienplan-Datei auswählen.');
    }
  },
}));

const savedPlan = localStorage.getItem(PLAN_STORAGE_KEY);
if (savedPlan) {
  try {
    const parsed = JSON.parse(savedPlan) as unknown;
    useStudyPlanStore.setState(migrateStudyPlan(parsed));
  } catch (error) {
    console.error('Failed to load saved plan:', error);
  }
}
