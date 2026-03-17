import { create } from 'zustand';
import type { Lecture, Semester, SemesterSeason, StudyPlan } from './types';

const PLAN_STORAGE_KEY = 'studyPlan';
const CURRENT_USER_KEY = 'currentUser';

const syncToServer = (plan: StudyPlan, username: string, token: string): void => {
  fetch(`/api/plan/${encodeURIComponent(username)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(plan),
  }).catch(() => {
    // Server not available – localStorage-only mode
  });
};

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

export const migrateStudyPlan = (raw: unknown): StudyPlan => {
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

// Validate that a parsed object matches the StudyPlan interface
export const isValidStudyPlan = (data: unknown): data is StudyPlan => {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (typeof d.planName !== 'string') return false;
  if (typeof d.regularSemesters !== 'number') return false;
  if (d.startSeason !== 'winter' && d.startSeason !== 'summer') return false;
  if (typeof d.isConfigured !== 'boolean') return false;
  if (!Array.isArray(d.semesters)) return false;
  if (!Array.isArray(d.parkingLot)) return false;
  return true;
};

interface StudyPlanStore extends StudyPlan {
  currentUser: string | null;
  authToken: string | null;
  setCurrentUser: (username: string | null) => void;
  setAuthToken: (token: string | null) => void;
  loadPlanForUser: (username: string, token: string) => Promise<void>;
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

const defaultPlan: StudyPlan = {
  planName: DEFAULT_PLAN_NAME,
  regularSemesters: DEFAULT_REGULAR_SEMESTERS,
  startSeason: DEFAULT_START_SEASON,
  isConfigured: false,
  semesters: generateInitialSemesters(DEFAULT_REGULAR_SEMESTERS, DEFAULT_START_SEASON),
  parkingLot: [],
};

export const useStudyPlanStore = create<StudyPlanStore>((set, get) => ({
  currentUser: null,
  authToken: null,
  ...defaultPlan,

  setCurrentUser: (username: string | null) => {
    if (username) {
      set({ currentUser: username });
      localStorage.setItem(CURRENT_USER_KEY, username);
    } else {
      // Reset user, token, and plan atomically when logging out
      set({ currentUser: null, authToken: null, ...defaultPlan, isConfigured: false });
      localStorage.removeItem(CURRENT_USER_KEY);
      localStorage.removeItem(PLAN_STORAGE_KEY);
    }
  },

  setAuthToken: (token: string | null) => {
    set({ authToken: token });
  },

  loadPlanForUser: async (username: string, token: string) => {
    try {
      const res = await fetch(`/api/plan/${encodeURIComponent(username)}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json() as unknown;
        const serverPlan = migrateStudyPlan(data);
        set(serverPlan);
        localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(serverPlan));
      } else {
        // No plan on server yet – start fresh (unconfigured)
        set({ ...defaultPlan, isConfigured: false });
        localStorage.removeItem(PLAN_STORAGE_KEY);
      }
    } catch {
      // Server not available – try localStorage fallback
      const savedPlan = localStorage.getItem(PLAN_STORAGE_KEY);
      if (savedPlan) {
        try {
          const parsed = JSON.parse(savedPlan) as unknown;
          set(migrateStudyPlan(parsed));
        } catch {
          set({ ...defaultPlan, isConfigured: false });
        }
      }
    }
  },

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

      const deletedNumber = semester.number;
      const remaining = state.semesters
        .filter((s) => s.id !== id)
        .map((s) =>
          s.number > deletedNumber
            ? { ...s, number: s.number - 1, season: getSeasonForSemester(s.number - 1, state.startSeason) }
            : s
        );

      return {
        semesters: remaining,
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
    if (state.currentUser && state.authToken) {
      syncToServer(plan, state.currentUser, state.authToken);
    }
    return JSON.stringify(plan);
  },

  exportPlan: () => {
    const state = get();
    const jsonString = state.savePlan();
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const date = new Date().toISOString().split('T')[0];
    const username = state.currentUser
      ? state.currentUser.replace(/[^a-z0-9]/gi, '-').toLowerCase()
      : state.planName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    a.download = `studiumsplaner_${username}_${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  importPlan: (jsonString: string) => {
    try {
      const parsed = JSON.parse(jsonString) as unknown;
      if (!isValidStudyPlan(parsed)) {
        throw new Error('Ungültiges Format');
      }
      const migratedPlan = migrateStudyPlan(parsed);
      set(migratedPlan);
      get().savePlan();
    } catch (error) {
      console.error('Failed to import plan:', error);
      throw new Error('Ungültige JSON-Datei. Bitte eine gültige Studienplan-Datei auswählen.');
    }
  },
}));
