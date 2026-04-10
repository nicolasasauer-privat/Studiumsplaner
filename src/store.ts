import { create } from 'zustand';
import type { Lecture, Semester, SemesterSeason, StudyPlan } from './types';

const PLAN_STORAGE_KEY = 'studyPlan';
const CURRENT_USER_KEY = 'currentUser';

type SyncStatus = 'idle' | 'saving' | 'saved' | 'error';

const DEFAULT_PLAN_NAME = 'Mein Studienplan';
const DEFAULT_REGULAR_SEMESTERS = 6;
const DEFAULT_START_SEASON: SemesterSeason = 'winter';
const MIN_SEMESTERS = 1;
const MAX_SEMESTERS = 20;

const isSemesterSeason = (value: unknown): value is SemesterSeason =>
  value === 'winter' || value === 'summer';

const clampSemesterCount = (count: number | null | undefined): number => {
  if (count === null || count === undefined || !Number.isFinite(count)) {
    return DEFAULT_REGULAR_SEMESTERS;
  }
  return Math.min(MAX_SEMESTERS, Math.max(MIN_SEMESTERS, Math.floor(count)));
};

const getSeasonForSemester = (
  semesterNumber: number,
  startSeason: SemesterSeason,
): SemesterSeason => {
  const isOddSemester = semesterNumber % 2 === 1;
  if (startSeason === 'winter') {
    return isOddSemester ? 'winter' : 'summer';
  }
  return isOddSemester ? 'summer' : 'winter';
};

const createSemester = (
  number: number,
  startSeason: SemesterSeason,
  id?: string,
): Semester => ({
  id: id ?? `${Date.now()}-${number}`,
  number,
  season: getSeasonForSemester(number, startSeason),
  lectures: [],
});

const getScopedPlanStorageKey = (username: string): string =>
  `${PLAN_STORAGE_KEY}:${encodeURIComponent(username.trim())}`;

const normalizeLecture = (
  lectureLike: unknown,
  semesterId?: string,
): Lecture | null => {
  if (!lectureLike || typeof lectureLike !== 'object') {
    return null;
  }

  const lecture = { ...(lectureLike as Lecture) };
  // Convert null to undefined for optional fields
  if (lecture.grade === null) lecture.grade = undefined;
  if (lecture.examDate === null) lecture.examDate = undefined;
  if (lecture.passed === null) lecture.passed = undefined;
  if (lecture.oralExam === null) lecture.oralExam = undefined;
  if (semesterId) {
    lecture.semesterId = semesterId;
  } else {
    delete lecture.semesterId;
  }

  return lecture;
};

const generateInitialSemesters = (
  count: number,
  startSeason: SemesterSeason,
): Semester[] => {
  const semesterCount = clampSemesterCount(count);
  return Array.from({ length: semesterCount }, (_, index) =>
    createSemester(index + 1, startSeason, `semester-${index + 1}`),
  );
};

export const migrateStudyPlan = (raw: unknown): StudyPlan => {
  const fallback: StudyPlan = {
    planName: DEFAULT_PLAN_NAME,
    regularSemesters: DEFAULT_REGULAR_SEMESTERS,
    startSeason: DEFAULT_START_SEASON,
    isConfigured: false,
    semesters: generateInitialSemesters(
      DEFAULT_REGULAR_SEMESTERS,
      DEFAULT_START_SEASON,
    ),
    parkingLot: [],
  };

  if (!raw || typeof raw !== 'object') {
    return fallback;
  }

  const data = raw as Partial<StudyPlan> & {
    semesters?: unknown;
    parkingLot?: unknown;
  };
  const startSeason = isSemesterSeason(data.startSeason)
    ? data.startSeason
    : DEFAULT_START_SEASON;

  const regularSemesters = clampSemesterCount(
    data.regularSemesters == null
      ? Array.isArray(data.semesters)
        ? data.semesters.length
        : DEFAULT_REGULAR_SEMESTERS
      : data.regularSemesters,
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
          const candidateNumber = candidate.number == null ? undefined : candidate.number;
          const number =
            typeof candidateNumber === 'number' && Number.isFinite(candidateNumber)
              ? Math.max(1, Math.floor(candidateNumber))
              : index + 1;
          const semesterId =
            typeof candidate.id === 'string' ? candidate.id : `semester-${number}`;

          return {
            id: semesterId,
            number,
            season: isSemesterSeason(candidate.season)
              ? candidate.season
              : getSeasonForSemester(number, startSeason),
            lectures: Array.isArray(candidate.lectures)
              ? candidate.lectures
                  .map((lectureLike) => normalizeLecture(lectureLike, semesterId))
                  .filter((lecture): lecture is Lecture => lecture !== null)
              : [],
          };
        })
        .filter((semester): semester is Semester => semester !== null)
        .sort((a, b) => a.number - b.number)
    : [];

  const parkingLot = Array.isArray(data.parkingLot)
    ? data.parkingLot
        .map((lectureLike) => normalizeLecture(lectureLike))
        .filter((lecture): lecture is Lecture => lecture !== null)
    : [];

  return {
    planName,
    regularSemesters,
    startSeason,
    isConfigured:
      typeof data.isConfigured === 'boolean'
        ? data.isConfigured
        : semesters.length > 0,
    semesters:
      semesters.length > 0
        ? semesters
        : generateInitialSemesters(regularSemesters, startSeason),
    parkingLot,
  };
};

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
  isPlanLoading: boolean;
  syncStatus: SyncStatus;
  syncMessage: string | null;
  hasUnsyncedChanges: boolean;
  setCurrentUser: (username: string | null) => void;
  setAuthToken: (token: string | null) => void;
  loadPlanForUser: (username: string, token: string) => Promise<void>;
  refreshPlanFromServer: () => Promise<void>;
  deleteAccount: () => Promise<string | null>;
  initializePlan: (options: {
    planName: string;
    regularSemesters: number;
    startSeason: SemesterSeason;
  }) => void;
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
  semesters: generateInitialSemesters(
    DEFAULT_REGULAR_SEMESTERS,
    DEFAULT_START_SEASON,
  ),
  parkingLot: [],
};

const buildPlanFromState = (
  state: Pick<
    StudyPlanStore,
    | 'planName'
    | 'regularSemesters'
    | 'startSeason'
    | 'isConfigured'
    | 'semesters'
    | 'parkingLot'
  >,
): StudyPlan => ({
  planName: state.planName,
  regularSemesters: state.regularSemesters,
  startSeason: state.startSeason,
  isConfigured: state.isConfigured,
  semesters: state.semesters,
  parkingLot: state.parkingLot,
});

export const useStudyPlanStore = create<StudyPlanStore>((set, get) => {
  const parseErrorMessage = async (
    res: Response,
    fallback: string,
  ): Promise<string> => {
    try {
      const data = (await res.json()) as { error?: string };
      return data.error ?? fallback;
    } catch {
      return fallback;
    }
  };

  const writeCachedPlan = (plan: StudyPlan, username: string | null): void => {
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plan));
    if (username) {
      localStorage.setItem(
        getScopedPlanStorageKey(username),
        JSON.stringify(plan),
      );
    }
  };

  const clearCachedPlan = (username: string | null): void => {
    localStorage.removeItem(PLAN_STORAGE_KEY);
    if (username) {
      localStorage.removeItem(getScopedPlanStorageKey(username));
    }
  };

  const readCachedPlan = (username: string): StudyPlan | null => {
    const scopedPlan = localStorage.getItem(getScopedPlanStorageKey(username));
    const canUseLegacyCache = localStorage.getItem(CURRENT_USER_KEY) === username;
    const rawPlan =
      scopedPlan ?? (canUseLegacyCache ? localStorage.getItem(PLAN_STORAGE_KEY) : null);

    if (!rawPlan) {
      return null;
    }

    try {
      const parsed = JSON.parse(rawPlan) as unknown;
      return migrateStudyPlan(parsed);
    } catch {
      return null;
    }
  };

  const applyServerPlan = (data: unknown, username: string): void => {
    const serverPlan = migrateStudyPlan(data);
    set(serverPlan);
    writeCachedPlan(serverPlan, username);
  };

  let syncPromise: Promise<void> | null = null;
  let syncTimeout: ReturnType<typeof setTimeout> | null = null;

  const queueServerSync = (): void => {
    if (syncPromise) return;

    syncPromise = (async () => {
      while (true) {
        const state = get();
        if (!state.currentUser || !state.authToken) {
          set({
            syncStatus: 'idle',
            syncMessage: null,
            hasUnsyncedChanges: false,
          });
          return;
        }

        const plan = buildPlanFromState(state);
        const payload = JSON.stringify(plan);
        set({
          syncStatus: 'saving',
          syncMessage: 'Speichert Änderungen auf den Server …',
          hasUnsyncedChanges: true,
        });

        try {
          const controller = new AbortController();
          syncTimeout = setTimeout(() => controller.abort(), 10000);

          const res = await fetch(
            `/api/plan/${encodeURIComponent(state.currentUser)}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.authToken}`,
              },
              body: payload,
              signal: controller.signal,
            },
          );

          clearTimeout(syncTimeout);
          syncTimeout = null;

          if (!res.ok) {
            const fallback =
              res.status === 401
                ? 'Sitzung abgelaufen. Bitte erneut anmelden.'
                : 'Änderungen konnten nicht mit dem Server synchronisiert werden.';
            
            if (res.status === 401) {
              get().setCurrentUser(null);
              set({
                syncStatus: 'error',
                syncMessage: 'Sitzung abgelaufen. Bitte erneut anmelden.',
                hasUnsyncedChanges: false,
              });
            } else {
              set({
                syncStatus: 'error',
                syncMessage: await parseErrorMessage(res, fallback),
                hasUnsyncedChanges: true,
              });
            }
            return;
          }
        } catch (err) {
          clearTimeout(syncTimeout);
          syncTimeout = null;

          if (err instanceof Error && err.name === 'AbortError') {
            set({
              syncStatus: 'error',
              syncMessage:
                'Synchronisierung zeitüberschritten. Änderungen sind nur lokal gespeichert.',
              hasUnsyncedChanges: true,
            });
          } else {
            set({
              syncStatus: 'error',
              syncMessage:
                'Änderungen sind nur lokal gespeichert. Server nicht erreichbar.',
              hasUnsyncedChanges: true,
            });
          }
          return;
        }

        const latestState = get();
        if (!latestState.currentUser) {
          return;
        }

        const latestPayload = JSON.stringify(buildPlanFromState(latestState));
        if (latestPayload !== payload) {
          continue;
        }

        writeCachedPlan(plan, latestState.currentUser);
        set({
          syncStatus: 'saved',
          syncMessage: 'Mit Server synchronisiert',
          hasUnsyncedChanges: false,
        });
        return;
      }
    })().finally(() => {
      syncPromise = null;
      clearTimeout(syncTimeout);
      syncTimeout = null;
    });
  };

  return {
    currentUser: null,
    authToken: null,
    isPlanLoading: false,
    syncStatus: 'idle',
    syncMessage: null,
    hasUnsyncedChanges: false,
    ...defaultPlan,

    setCurrentUser: (username: string | null) => {
      if (username) {
        set({
          currentUser: username,
          syncStatus: 'idle',
          syncMessage: null,
          hasUnsyncedChanges: false,
        });
        localStorage.setItem(CURRENT_USER_KEY, username);
      } else {
        set({
          currentUser: null,
          authToken: null,
          isPlanLoading: false,
          syncStatus: 'idle',
          syncMessage: null,
          hasUnsyncedChanges: false,
          ...defaultPlan,
          isConfigured: false,
        });
        localStorage.removeItem(CURRENT_USER_KEY);
        localStorage.removeItem(PLAN_STORAGE_KEY);
      }
    },

    setAuthToken: (token: string | null) => {
      const state = get();
      set({
        authToken: token,
        syncStatus: token ? state.syncStatus : 'idle',
        syncMessage: token ? state.syncMessage : null,
        hasUnsyncedChanges: token ? state.hasUnsyncedChanges : false,
      });
    },

    loadPlanForUser: async (username: string, token: string) => {
      set({
        isPlanLoading: true,
        syncStatus: 'idle',
        syncMessage: 'Plan wird geladen …',
        hasUnsyncedChanges: false,
      });

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const res = await fetch(`/api/plan/${encodeURIComponent(username)}`, {
          headers: { 'Authorization': `Bearer ${token}` },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          applyServerPlan((await res.json()) as unknown, username);
          set({
            syncStatus: 'saved',
            syncMessage: 'Mit Server synchronisiert',
            hasUnsyncedChanges: false,
          });
          return;
        }

        if (res.status === 404) {
          clearCachedPlan(username);
          set({
            ...defaultPlan,
            isConfigured: false,
            syncStatus: 'idle',
            syncMessage: null,
            hasUnsyncedChanges: false,
          });
          return;
        }

        if (res.status === 401) {
          get().setCurrentUser(null);
          set({
            syncStatus: 'error',
            syncMessage: 'Sitzung abgelaufen. Bitte erneut anmelden.',
            hasUnsyncedChanges: false,
          });
          return;
        }

        const cachedPlan = readCachedPlan(username);
        const fallbackMessage = await parseErrorMessage(
          res,
          'Plan konnte nicht vom Server geladen werden.',
        );

        if (cachedPlan) {
          set({
            ...cachedPlan,
            syncStatus: 'error',
            syncMessage: `Gespeicherter Browser-Stand geladen. ${fallbackMessage}`,
            hasUnsyncedChanges: false,
          });
          writeCachedPlan(cachedPlan, username);
          return;
        }

        set({
          ...defaultPlan,
          isConfigured: false,
          syncStatus: 'error',
          syncMessage: fallbackMessage,
          hasUnsyncedChanges: false,
        });
      } catch (err) {
        const isTimeout = err instanceof Error && err.name === 'AbortError';
        const cachedPlan = readCachedPlan(username);
        
        if (cachedPlan) {
          set({
            ...cachedPlan,
            syncStatus: 'error',
            syncMessage: isTimeout
              ? 'Synchronisierung zeitüberschritten. Gespeicherter Browser-Stand geladen.'
              : 'Gespeicherter Browser-Stand geladen. Server nicht erreichbar.',
            hasUnsyncedChanges: false,
          });
          writeCachedPlan(cachedPlan, username);
        } else {
          set({
            ...defaultPlan,
            isConfigured: false,
            syncStatus: 'error',
            syncMessage: isTimeout
              ? 'Synchronisierung zeitüberschritten. Plan konnte nicht geladen werden.'
              : 'Plan konnte nicht geladen werden. Server nicht erreichbar.',
            hasUnsyncedChanges: false,
          });
        }
      } finally {
        set({ isPlanLoading: false });
      }
    },

    refreshPlanFromServer: async () => {
      const state = get();
      if (!state.currentUser || !state.authToken || state.isPlanLoading) return;
      if (state.syncStatus === 'saving') return;
      if (state.hasUnsyncedChanges) {
        queueServerSync();
        return;
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const res = await fetch(
          `/api/plan/${encodeURIComponent(state.currentUser)}`,
          {
            headers: { 'Authorization': `Bearer ${state.authToken}` },
            signal: controller.signal,
          },
        );

        clearTimeout(timeoutId);

        if (res.ok) {
          applyServerPlan((await res.json()) as unknown, state.currentUser);
          set({
            syncStatus: 'saved',
            syncMessage: 'Mit Server synchronisiert',
            hasUnsyncedChanges: false,
          });
        } else if (res.status === 401) {
          get().setCurrentUser(null);
          set({
            syncStatus: 'error',
            syncMessage: 'Sitzung abgelaufen. Bitte erneut anmelden.',
          });
        }
      } catch {
        // Fehler im Hintergrund - Plan bleibt unverändert sichtbar
      }
    },

    deleteAccount: async (): Promise<string | null> => {
      const state = get();
      if (!state.currentUser || !state.authToken) return 'Nicht angemeldet';

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const res = await fetch(
          `/api/users/${encodeURIComponent(state.currentUser)}`,
          {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${state.authToken}` },
            signal: controller.signal,
          },
        );

        clearTimeout(timeoutId);

        if (res.ok) {
          clearCachedPlan(state.currentUser);
          get().setCurrentUser(null);
          return null;
        }

        if (res.status === 401) {
          get().setCurrentUser(null);
          return 'Sitzung abgelaufen.';
        }

        return await parseErrorMessage(res, 'Löschen fehlgeschlagen');
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return 'Anfrage zeitüberschritten.';
        }
        return 'Server nicht erreichbar';
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
        const newNumber =
          Math.max(...state.semesters.map((s) => s.number), 0) + 1;
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
              ? {
                  ...s,
                  number: s.number - 1,
                  season: getSeasonForSemester(
                    s.number - 1,
                    state.startSeason,
                  ),
                }
              : s,
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
          const idx = newSemesters[i].lectures.findIndex(
            (l) => l.id === lectureId,
          );
          if (idx !== -1) {
            lecture = newSemesters[i].lectures[idx];
            newSemesters = newSemesters.map((s, semIdx) =>
              semIdx === i
                ? {
                    ...s,
                    lectures: s.lectures.filter((l) => l.id !== lectureId),
                  }
                : s,
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
            : s,
        );

        return {
          semesters: newSemestersWithLecture,
          parkingLot: newParkingLot,
        };
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
          parkingLot: [
            ...state.parkingLot,
            { ...lecture, semesterId: undefined },
          ],
        };
      });
      get().savePlan();
    },

    updateLecture: (lectureId: string, updates: Partial<Lecture>) => {
      // Convert null to undefined for optional fields
      const normalizedUpdates = { ...updates };
      if (normalizedUpdates.grade === null) normalizedUpdates.grade = undefined;
      if (normalizedUpdates.examDate === null) normalizedUpdates.examDate = undefined;
      if (normalizedUpdates.passed === null) normalizedUpdates.passed = undefined;
      if (normalizedUpdates.oralExam === null) normalizedUpdates.oralExam = undefined;

      set((state) => {
        const semesters = state.semesters.map((s) => ({
          ...s,
          lectures: s.lectures.map((l) =>
            l.id === lectureId ? { ...l, ...normalizedUpdates } : l,
          ),
        }));

        const parkingLot = state.parkingLot.map((l) =>
          l.id === lectureId ? { ...l, ...normalizedUpdates } : l,
        );

        return { semesters, parkingLot };
      });
      get().savePlan();
    },

    reorderLecturesInSemester: (semesterId: string, lectures: Lecture[]) => {
      set((state) => {
        const semesters = state.semesters.map((s) =>
          s.id === semesterId ? { ...s, lectures } : s,
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
                const aTime = a.examDate
                  ? new Date(a.examDate).getTime()
                  : null;
                const bTime = b.examDate
                  ? new Date(b.examDate).getTime()
                  : null;
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
      const plan = buildPlanFromState(state);
      const jsonString = JSON.stringify(plan);

      writeCachedPlan(plan, state.currentUser);

      if (state.currentUser && state.authToken) {
        set({
          hasUnsyncedChanges: true,
          syncStatus: 'saving',
          syncMessage: 'Speichert Änderungen auf den Server …',
        });
        queueServerSync();
      } else {
        set({
          syncStatus: 'idle',
          syncMessage: null,
          hasUnsyncedChanges: false,
        });
      }

      return jsonString;
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
        throw new Error(
          'Ungültige JSON-Datei. Bitte eine gültige Studienplan-Datei auswählen.',
        );
      }
    },
  };
});
