import React, { useState } from 'react';
import { Draggable } from 'react-beautiful-dnd';
import { Trash2, Badge, Calendar, BookOpen, Pencil, AlertTriangle, CheckCircle2, Circle } from 'lucide-react';
import type { Lecture, SemesterSeason } from '../types';
import { useStudyPlanStore } from '../store';

interface LectureCardProps {
  lecture: Lecture;
  index: number;
  semesterSeason?: SemesterSeason;
  onEdit?: (lectureId: string) => void;
}

export const LectureCard: React.FC<LectureCardProps> = ({ lecture, index, semesterSeason, onEdit }) => {
  const removeLecture = useStudyPlanStore(state => state.removeLecture);
  const updateLecture = useStudyPlanStore(state => state.updateLecture);
  const [showDetails, setShowDetails] = useState(false);

  const showSeasonHint =
    !!semesterSeason &&
    lecture.season !== 'both' &&
    lecture.season !== semesterSeason;

  const handleDelete = () => {
    if (confirm(`Möchten Sie "${lecture.name}" wirklich löschen?`)) {
      removeLecture(lecture.id);
    }
  };

  const handleTogglePassed = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateLecture(lecture.id, {
      passed: !lecture.passed,
      grade: lecture.passed ? undefined : lecture.grade,
    });
  };

  const getSeasonColor = (season: string) => {
    switch (season) {
      case 'winter':
        return 'text-blue-400';
      case 'summer':
        return 'text-orange-400';
      case 'both':
        return 'text-purple-400';
      default:
        return 'text-gray-400';
    }
  };

  const getSeasonLabel = (season: string) => {
    switch (season) {
      case 'winter':
        return 'WS';
      case 'summer':
        return 'SS';
      case 'both':
        return 'WS/SS';
      default:
        return '';
    }
  };

  return (
    <Draggable draggableId={lecture.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`relative card-hover mb-3 cursor-grab active:cursor-grabbing transition-shadow ${
            snapshot.isDragging ? 'shadow-2xl shadow-blue-500/50 bg-slate-600' : ''
          } ${lecture.passed ? 'bg-green-500/5' : ''}`}
          style={{
            borderLeft: `4px solid ${lecture.color}`,
            ...provided.draggableProps.style,
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white truncate hover:text-clip">{lecture.name}</h3>
              <div className="flex items-center gap-2 mt-2 text-sm text-gray-300 flex-wrap">
                <Badge size={16} />
                <span>{lecture.ects} ECTS</span>
                <span className={`font-medium ${getSeasonColor(lecture.season)}`}>
                  {getSeasonLabel(lecture.season)}
                </span>
                {lecture.passed && lecture.grade !== undefined && (
                  <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                    Note: {lecture.grade.toFixed(1).replace('.', ',')}
                  </span>
                )}
                {lecture.passed && lecture.grade === undefined && (
                  <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                    bestanden
                  </span>
                )}
              </div>
              {lecture.examDate && (
                <div className="flex items-center gap-2 mt-1 text-sm text-gray-400">
                  <Calendar size={16} />
                  <span>{new Date(lecture.examDate).toLocaleDateString('de-DE')}</span>
                </div>
              )}
              {showSeasonHint && (
                <p className="mt-2 text-xs text-amber-300 flex items-center gap-1">
                  <AlertTriangle size={13} />
                  Hinweis: Veranstaltung eher im {lecture.season === 'winter' ? 'WS' : 'SS'}, Klausurplanung hier ist trotzdem moeglich.
                </p>
              )}
              {lecture.description && (
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="text-xs text-blue-400 mt-2 hover:text-blue-300"
                >
                  {showDetails ? 'Details ausblenden' : 'Details anzeigen'}
                </button>
              )}
              {showDetails && lecture.description && (
                <p className="text-xs text-gray-400 mt-2 p-2 bg-slate-600 rounded">
                  <BookOpen size={14} className="inline mr-1" />
                  {lecture.description}
                </p>
              )}
            </div>
            <div className="flex-shrink-0 flex gap-2">
              <button
                onClick={handleTogglePassed}
                className={`p-2 rounded transition-colors ${
                  lecture.passed
                    ? 'text-green-400 hover:text-green-300 hover:bg-green-500/20'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-slate-600'
                }`}
                title={lecture.passed ? 'Bestanden – klicken zum Aufheben' : 'Als bestanden markieren'}
              >
                {lecture.passed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
              </button>
              {onEdit && (
                <button
                  onClick={() => onEdit(lecture.id)}
                  className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/20 rounded transition-colors"
                  title="Bearbeiten"
                >
                  <Pencil size={18} />
                </button>
              )}
              <button
                onClick={handleDelete}
                className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors"
                title="Löschen"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
};
