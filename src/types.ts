export type SemesterSeason = 'winter' | 'summer';

export interface Lecture {
  id: string;
  name: string;
  ects: number;
  examDate?: string;
  season: 'winter' | 'summer' | 'both';
  description: string;
  color: string;
  semesterId?: string;
  passed?: boolean;
  grade?: number;
}

export interface Semester {
  id: string;
  number: number;
  season: SemesterSeason;
  lectures: Lecture[];
}

export interface StudyPlan {
  planName: string;
  regularSemesters: number;
  startSeason: SemesterSeason;
  isConfigured: boolean;
  semesters: Semester[];
  parkingLot: Lecture[];
}

export const COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
  '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
  '#F8B88B', '#A9E6E6', '#FFB347', '#87CEEB',
  '#DDA0DD', '#98FB98', '#FFB6C1', '#20B2AA',
  '#FF8C00', '#9370DB', '#5DADE2', '#F1948A'
];
