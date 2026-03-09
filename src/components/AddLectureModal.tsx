import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { Lecture } from '../types';
import { COLORS } from '../types';
import { useStudyPlanStore } from '../store';

interface AddLectureModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialLecture?: Lecture;
}

const getInitialFormData = (initialLecture?: Lecture): Omit<Lecture, 'id'> => {
  if (initialLecture) {
    return {
      name: initialLecture.name,
      ects: initialLecture.ects,
      examDate: initialLecture.examDate,
      season: initialLecture.season,
      description: initialLecture.description,
      color: initialLecture.color,
      passed: initialLecture.passed,
      grade: initialLecture.grade,
    };
  }

  return {
    name: '',
    ects: 3,
    examDate: '',
    season: 'both',
    description: '',
    color: COLORS[0],
    passed: false,
    grade: undefined,
  };
};

export const AddLectureModal: React.FC<AddLectureModalProps> = ({ isOpen, onClose, initialLecture }) => {
  const [formData, setFormData] = useState<Omit<Lecture, 'id'>>(() => getInitialFormData(initialLecture));

  const addLecture = useStudyPlanStore(state => state.addLecture);
  const updateLecture = useStudyPlanStore(state => state.updateLecture);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      alert('Bitte füllen Sie alle erforderlichen Felder aus');
      return;
    }

    const grade = formData.passed && formData.grade !== undefined
      ? formData.grade
      : undefined;

    if (grade !== undefined && (grade < 1.0 || grade > 5.0)) {
      alert('Die Note muss zwischen 1,0 und 5,0 liegen.');
      return;
    }

    if (initialLecture) {
      updateLecture(initialLecture.id, { ...formData, grade });
    } else {
      const newLecture: Lecture = {
        id: Date.now().toString(),
        ...formData,
        grade,
      };
      addLecture(newLecture);
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md border border-slate-700 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-white">
            {initialLecture ? 'Veranstaltung bearbeiten' : 'Neue Veranstaltung'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="z.B. Mathematik I"
              className="input-field"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">ECTS *</label>
              <input
                type="number"
                min="1"
                max="30"
                value={formData.ects}
                onChange={(e) => setFormData({ ...formData, ects: parseInt(e.target.value) })}
                className="input-field"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Turnus der Veranstaltung</label>
              <select
                value={formData.season}
                onChange={(e) => setFormData({ ...formData, season: e.target.value as 'winter' | 'summer' | 'both' })}
                className="input-field"
              >
                <option value="winter">Wintersemester</option>
                <option value="summer">Sommersemester</option>
                <option value="both">Beide</option>
              </select>
              <p className="mt-1 text-xs text-slate-400">
                Hinweis: Das ist nur eine Empfehlung. Klausuren koennen trotzdem in jedem Semester geplant werden.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Klausurdatum <span className="text-gray-500">(optional)</span></label>
            <input
              type="date"
              value={formData.examDate ?? ''}
              onChange={(e) => setFormData({ ...formData, examDate: e.target.value || undefined })}
              className="input-field"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="passed"
                checked={!!formData.passed}
                onChange={(e) => setFormData({
                  ...formData,
                  passed: e.target.checked,
                  grade: e.target.checked ? formData.grade : undefined,
                })}
                className="w-4 h-4 rounded accent-blue-500 cursor-pointer"
              />
              <label htmlFor="passed" className="text-sm font-medium text-gray-300 cursor-pointer">
                Klausur bestanden
              </label>
            </div>
            {formData.passed && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Note <span className="text-gray-500">(optional, 1,0 – 5,0)</span>
                </label>
                <input
                  type="number"
                  min="1.0"
                  max="5.0"
                  step="0.1"
                  value={formData.grade ?? ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    grade: e.target.value ? parseFloat(e.target.value) : undefined,
                  })}
                  placeholder="z.B. 1,7"
                  className="input-field"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Beschreibung</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optionale Beschreibung..."
              className="input-field min-h-[80px] resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Farbe</label>
            <div className="grid grid-cols-5 gap-2">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData({ ...formData, color })}
                  className={`w-8 h-8 rounded-lg transition-transform ${
                    formData.color === color ? 'ring-2 ring-white scale-110' : ''
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 btn-secondary"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="flex-1 btn-primary"
            >
              {initialLecture ? 'Aktualisieren' : 'Hinzufügen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
