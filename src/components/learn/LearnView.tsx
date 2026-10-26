import React, { useState, useMemo } from 'react';
import { type UserProfile, updateUserProfile, getUserProfile, bumpDailyActivity } from '../../db';
import { ALL_LESSONS, lessonsForLevel, validateLessons, type Lesson } from '../../content/lessons';
import { computeGates, levelName } from '../../services/gates';
import { LessonPlayer } from './LessonPlayer';
import { GraduationCap, CheckCircle2, Circle, Lock, BookOpen, ChevronRight, Play, ArrowRight } from 'lucide-react';

interface LearnViewProps {
  userProfile: UserProfile;
  onRefreshProfile: () => void;
  onNavigate: (tab: string) => void;
}

const GATE_ICONS = ['', '🥋', '⚡', '🔥', '👑'];

export const LearnView: React.FC<LearnViewProps> = ({ userProfile, onRefreshProfile, onNavigate }) => {
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [activeLevelTab, setActiveLevelTab] = useState<number>(Math.min(4, userProfile.currentLevel || 1));
  const devReports = useMemo(() => validateLessons(ALL_LESSONS), []);
  const gates = computeGates(userProfile);

  const handlePromoteLevel = async (newLevel: number) => {
    await updateUserProfile({ currentLevel: newLevel });
    onRefreshProfile();
  };

  const handleLessonComplete = async (lessonId: string) => {
    const profile = await getUserProfile();
    if (!profile.completedLessons.includes(lessonId)) {
      await updateUserProfile({ completedLessons: [...profile.completedLessons, lessonId] });
    }
    await bumpDailyActivity('lessonsOrDrills');
    onRefreshProfile();
  };

  if (selectedLesson) {
    return (
      <LessonPlayer
        lesson={selectedLesson}
        onComplete={() => handleLessonComplete(selectedLesson.id)}
        onExit={() => setSelectedLesson(null)}
        brokenReports={devReports}
      />
    );
  }

  const currentLessons = lessonsForLevel(activeLevelTab);
  const nextLesson = lessonsForLevel(Math.min(4, userProfile.currentLevel)).find((l) => !userProfile.completedLessons.includes(l.id));

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8 space-y-8 animate-fadeIn">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold tracking-widest uppercase">
          <GraduationCap className="w-3.5 h-3.5" />
          Curriculum & level gates
        </div>
        <h1 className="text-3xl font-serif font-black text-stone-100 tracking-tight">
          Level {userProfile.currentLevel}: {levelName(userProfile.currentLevel)}
        </h1>
        <p className="text-stone-400 text-xs sm:text-sm max-w-lg mx-auto">
          Work through the lessons for your level, then pass the gate: every requirement must be done.
        </p>
        {nextLesson && (
          <button
            onClick={() => setSelectedLesson(nextLesson)}
            className="mt-2 inline-flex items-center gap-2 py-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold"
          >
            <Play className="w-3.5 h-3.5 fill-current" /> Continue: {nextLesson.title}
          </button>
        )}
      </div>

      {/* Gates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {gates.map((gate) => {
          const passed = userProfile.currentLevel > gate.fromLevel;
          const isCurrent = userProfile.currentLevel === gate.fromLevel;
          return (
            <div
              key={gate.fromLevel}
              className={`p-6 rounded-2xl border transition-all ${
                passed ? 'bg-emerald-950/20 border-emerald-500/40' : isCurrent ? 'bg-stone-900 border-amber-500/50 shadow-xl' : 'bg-stone-900/60 border-stone-800'
              }`}
            >
              <div className="flex items-center justify-between mb-4 gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{GATE_ICONS[gate.fromLevel]}</span>
                  <div>
                    <h3 className="font-serif font-bold text-lg text-stone-100">
                      Gate {gate.fromLevel} → {gate.toLevel === 5 ? 'Mastery' : gate.toLevel}: {gate.title}
                    </h3>
                    <span className="text-[11px] text-stone-400">Unlocks {levelName(gate.toLevel)}</span>
                  </div>
                </div>
                {passed ? (
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-bold">Passed</span>
                ) : isCurrent && gate.eligible ? (
                  <button
                    onClick={() => handlePromoteLevel(gate.toLevel)}
                    className="py-1.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold uppercase transition-all shadow-md active:scale-95 cursor-pointer"
                  >
                    Pass gate
                  </button>
                ) : isCurrent ? (
                  <span className="px-2.5 py-1 rounded-full bg-stone-800 text-stone-300 text-xs">In progress</span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full bg-stone-800 text-stone-500 text-xs flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Later
                  </span>
                )}
              </div>
              <div className="space-y-2 text-xs">
                {gate.requirements.map((r) => (
                  <div key={r.label} className="flex items-center justify-between text-stone-300 py-1 border-b border-stone-800 last:border-0 gap-2">
                    <div className="flex items-center gap-2">
                      {r.done ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <Circle className="w-4 h-4 text-stone-600 shrink-0" />}
                      <span>{r.label}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`font-mono ${r.done ? 'text-emerald-400' : 'text-stone-400'}`}>{r.detail}</span>
                      {!r.done && isCurrent && r.goTo && r.goTo !== 'learn' && (
                        <button onClick={() => onNavigate(r.goTo!)} className="text-amber-400 hover:text-amber-300" title="Go there">
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Curriculum */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-800 pb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-500" />
            <h2 className="font-serif font-bold text-xl text-stone-100">Lessons</h2>
          </div>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4].map((lvl) => {
              const ls = lessonsForLevel(lvl);
              const done = ls.filter((l) => userProfile.completedLessons.includes(l.id)).length;
              return (
                <button
                  key={lvl}
                  onClick={() => setActiveLevelTab(lvl)}
                  className={`py-1 px-3 rounded-lg text-xs font-bold transition-all ${
                    activeLevelTab === lvl ? 'bg-amber-500 text-stone-950 font-serif shadow-md' : 'bg-stone-900 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  Level {lvl} <span className="opacity-70">({done}/{ls.length})</span>
                </button>
              );
            })}
          </div>
        </div>

        {activeLevelTab > userProfile.currentLevel && (
          <p className="text-xs text-amber-300/90">These lessons are above your current level. You can study them now, but they count for the gate once you reach Level {activeLevelTab}.</p>
        )}

        {currentLessons.length === 0 ? (
          <p className="text-sm text-stone-400 italic">No lessons here yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentLessons.map((lesson) => {
              const isCompleted = userProfile.completedLessons.includes(lesson.id);
              return (
                <div
                  key={lesson.id}
                  onClick={() => setSelectedLesson(lesson)}
                  className="p-5 rounded-2xl border transition-all flex flex-col justify-between bg-stone-900 border-stone-800 hover:border-amber-500/50 hover:bg-stone-800/80 cursor-pointer shadow-lg"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">{lesson.unit}</span>
                      {isCompleted ? (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/30">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Done
                        </span>
                      ) : (
                        <span className="text-[11px] text-stone-400 flex items-center gap-1">
                          <Play className="w-3 h-3 text-amber-400" />
                          Start
                        </span>
                      )}
                    </div>
                    <h3 className="font-serif font-bold text-base text-stone-100 mb-1">{lesson.title}</h3>
                    <p className="text-xs text-stone-400 leading-relaxed mb-4">{lesson.description}</p>
                  </div>
                  <div className="pt-3 border-t border-stone-800/80 flex items-center justify-between text-[11px] text-stone-400">
                    <span>
                      {lesson.steps.length} explanation{lesson.steps.length === 1 ? '' : 's'} • {lesson.challenges.length} challenge{lesson.challenges.length === 1 ? '' : 's'}
                    </span>
                    <span className="font-bold text-amber-400 flex items-center gap-1">
                      <span>{isCompleted ? 'Review' : 'Begin'}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
