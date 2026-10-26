import React, { useState, useEffect } from 'react';
import { Chess, type Square } from 'chess.js';
import { DojoBoard } from '../board/DojoBoard';
import { challengeProblems, type Lesson, type LessonStep, type LessonChallenge, type BrokenLessonReport } from '../../content/lessons';
import { sound } from '../../services/sound';
import { puzzleService } from '../../services/puzzleService';
import {
  BookOpen,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Star,
  RotateCcw,
  Trophy,
  AlertTriangle,
  Code
} from 'lucide-react';

interface LessonPlayerProps {
  lesson: Lesson;
  onComplete: (stars: number) => void;
  onExit: () => void;
  brokenReports?: BrokenLessonReport[];
}

export const LessonPlayer: React.FC<LessonPlayerProps> = ({
  lesson,
  onComplete,
  onExit,
  brokenReports = [],
}) => {
  // Phase: 'explain' (steps 0..N) then 'challenges' (challenges 0..M) then 'finished'
  const [phase, setPhase] = useState<'explain' | 'challenge' | 'finished'>('explain');
  const [stepIdx, setStepIdx] = useState<number>(0);
  const [challengeIdx, setChallengeIdx] = useState<number>(0);

  // Challenge execution state
  const [currentFen, setCurrentFen] = useState<string>('');
  const [challengeStep, setChallengeStep] = useState<number>(0);
  const [triesLeft, setTriesLeft] = useState<number>(3);
  const [hintsUsed, setHintsUsed] = useState<number>(0); // 0 = none, 1 = piece highlight, 2 = arrow
  const [challengeStatus, setChallengeStatus] = useState<'solving' | 'correct' | 'failed'>('solving');
  const [isOpponentMoving, setIsOpponentMoving] = useState<boolean>(false);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);

  // Stars earned across all challenges
  const [totalStars, setTotalStars] = useState<number>(0);
  const [finalStars, setFinalStars] = useState<number>(3);

  // Dev panel toggle
  const [showDevPanel, setShowDevPanel] = useState<boolean>(false);

  // Broken challenges (illegal positions etc.) are never shown to you
  const playable = React.useMemo(() => lesson.challenges.filter((c) => challengeProblems(c).length === 0), [lesson]);

  const currentStep: LessonStep | undefined = lesson.steps[stepIdx];
  const currentChallenge: LessonChallenge | undefined = playable[challengeIdx];

  const toSan = (fen: string, uci?: string) => {
    if (!uci) return '';
    try {
      return new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined }).san;
    } catch {
      return uci;
    }
  };

  // Initialize challenge position
  useEffect(() => {
    if (phase === 'challenge' && currentChallenge) {
      setCurrentFen(currentChallenge.fen);
      setChallengeStep(0);
      setTriesLeft(3);
      setHintsUsed(0);
      setChallengeStatus('solving');
      setLastMove(null);
    }
  }, [phase, challengeIdx]);

  // Explain Step Navigation
  const handleNextStep = () => {
    if (stepIdx + 1 < lesson.steps.length) {
      setStepIdx((s) => s + 1);
      sound.playMove();
    } else {
      // Transition to challenges
      if (playable.length > 0) {
        setPhase('challenge');
        setChallengeIdx(0);
        sound.playSuccess();
      } else {
        setPhase('finished');
        // A reading-only lesson is complete once every step has been read.
        if (lesson.challenges.length === 0) {
          setFinalStars(3);
          onComplete(3);
          sound.playSuccess();
        }
      }
    }
  };

  const handlePrevStep = () => {
    if (stepIdx > 0) {
      setStepIdx((s) => s - 1);
      sound.playMove();
    }
  };

  // Hint button for challenges
  const handleRequestHint = () => {
    if (hintsUsed < 2) {
      setHintsUsed((h) => h + 1);
      sound.playWarning();
    }
  };

  // Handle user move in challenge
  const handleUserMove = async (uci: string): Promise<boolean> => {
    if (!currentChallenge || challengeStatus !== 'solving' || isOpponentMoving) return false;

    const expectedMove = currentChallenge.solution[challengeStep];
    const isFinalMove = challengeStep === currentChallenge.solution.length - 1;

    const isCorrect =
      puzzleService.isMoveCorrect(currentFen, uci, expectedMove, isFinalMove || !!currentChallenge.acceptAnyMate) ||
      (challengeStep === 0 && (currentChallenge.alsoAccept || []).some((a) => a.slice(0, 4) === uci.slice(0, 4)));

    const from = uci.slice(0, 2) as Square;
    const to = uci.slice(2, 4) as Square;
    const promotion = uci.length > 4 ? uci.slice(4, 5) : 'q';

    if (isCorrect) {
      setLastMove({ from, to });
      const nextStep = challengeStep + 1;

      const afterMove = new Chess(currentFen);
      afterMove.move({ from, to, promotion });
      if (nextStep >= currentChallenge.solution.length || afterMove.isCheckmate() || (challengeStep === 0 && uci !== expectedMove)) {
        setCurrentFen(afterMove.fen());
        // Challenge complete!
        setChallengeStatus('correct');
        sound.playSuccess();

        // Calculate stars for this challenge: 3 stars if 1st try & no hint, 2 stars if 1 hint or 2 tries, 1 star otherwise
        let stars = 3;
        if (hintsUsed === 1 || triesLeft === 2) stars = 2;
        else if (hintsUsed >= 2 || triesLeft === 1) stars = 1;
        setTotalStars((s) => s + stars);

        return true;
      } else {
        // Apply user move
        const c = new Chess(currentFen);
        c.move({ from, to, promotion });
        setCurrentFen(c.fen());

        // Opponent auto-reply
        setIsOpponentMoving(true);
        setChallengeStep(nextStep + 1);
        const oppMoveUci = currentChallenge.solution[nextStep];

        setTimeout(() => {
          const oppFrom = oppMoveUci.slice(0, 2) as Square;
          const oppTo = oppMoveUci.slice(2, 4) as Square;
          c.move({
            from: oppFrom,
            to: oppTo,
            promotion: oppMoveUci.length > 4 ? oppMoveUci.slice(4, 5) : 'q',
          });
          setCurrentFen(c.fen());
          setLastMove({ from: oppFrom, to: oppTo });
          sound.playMove();
          setIsOpponentMoving(false);
        }, 500);

        return true;
      }
    } else {
      // Missed move!
      sound.playError();
      const remaining = triesLeft - 1;
      setTriesLeft(remaining);

      if (remaining <= 0) {
        setChallengeStatus('failed');
      }

      return false;
    }
  };

  const handleNextChallenge = () => {
    if (challengeIdx + 1 < playable.length) {
      setChallengeIdx((c) => c + 1);
    } else {
      // All challenges done!
      setPhase('finished');
      const avgStars = Math.min(3, Math.max(1, Math.round(totalStars / Math.max(1, playable.length))));
      setFinalStars(avgStars);
      onComplete(avgStars);
      sound.playSuccess();
    }
  };

  const handleRetryChallenge = () => {
    if (currentChallenge) {
      setCurrentFen(currentChallenge.fen);
      setChallengeStep(0);
      setTriesLeft(3);
      setHintsUsed(0);
      setChallengeStatus('solving');
      setLastMove(null);
    }
  };

  // Build arrows & highlights for Board
  let displayArrows: Array<[Square, Square, string?]> = [];
  let displayHighlights: Record<string, React.CSSProperties> = {};

  if (phase === 'explain' && currentStep) {
    displayArrows = currentStep.arrows || [];
    if (currentStep.highlights) {
      for (const [sq, color] of Object.entries(currentStep.highlights)) {
        displayHighlights[sq] = { backgroundColor: color, boxShadow: `0 0 8px ${color}` };
      }
    }
  } else if (phase === 'challenge' && currentChallenge) {
    const nextExpected = currentChallenge.solution[challengeStep];
    if (hintsUsed >= 1 && nextExpected) {
      const fromSq = nextExpected.slice(0, 2);
      displayHighlights[fromSq] = {
        boxShadow: 'inset 0 0 0 4px #F59E0B',
        backgroundColor: 'rgba(245, 158, 11, 0.4)',
      };
    }
    if (hintsUsed >= 2 && nextExpected) {
      const fromSq = nextExpected.slice(0, 2) as Square;
      const toSq = nextExpected.slice(2, 4) as Square;
      displayArrows = [[fromSq, toSq, 'rgb(245, 158, 11)']];
    }
  }

  const lessonBroken = brokenReports.filter((r) => r.lessonId === lesson.id);

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 space-y-6 animate-fadeIn">
      {/* Top Banner Navigation */}
      <div className="flex items-center justify-between bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center gap-3">
          <button
            onClick={onExit}
            className="py-1.5 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Curriculum Path</span>
          </button>
          <div>
            <div className="text-[11px] uppercase font-bold text-amber-500 tracking-wider">
              {lesson.unit}
            </div>
            <h2 className="font-serif font-black text-base sm:text-lg text-stone-100">
              {lesson.title}
            </h2>
          </div>
        </div>

        {/* Phase progress indicators */}
        <div className="flex items-center gap-4">
          {phase === 'explain' ? (
            <div className="text-xs font-mono font-bold text-amber-400">
              Step {stepIdx + 1} / {lesson.steps.length}
            </div>
          ) : phase === 'challenge' ? (
            <div className="text-xs font-mono font-bold text-emerald-400">
              Challenge {challengeIdx + 1} / {playable.length}
            </div>
          ) : (
            <div className="text-xs font-bold text-amber-400">Complete</div>
          )}

          {lessonBroken.length > 0 && (
            <button
              onClick={() => setShowDevPanel(!showDevPanel)}
              className="px-2 py-1 rounded bg-red-950 text-red-400 border border-red-800 text-[11px] font-bold flex items-center gap-1"
            >
              <Code className="w-3.5 h-3.5" />
              Dev ({lessonBroken.length})
            </button>
          )}
        </div>
      </div>

      {/* Dev Panel listing broken items */}
      {showDevPanel && lessonBroken.length > 0 && (
        <div className="bg-red-950/40 border border-red-800/40 rounded-2xl p-4 text-xs space-y-2">
          <div className="flex items-center gap-2 text-red-400 font-bold">
            <AlertTriangle className="w-4 h-4" />
            <span>Dev Inspector: Broken Items Detected in Lesson</span>
          </div>
          <div className="space-y-1 font-mono text-red-300">
            {lessonBroken.map((b, i) => (
              <div key={i} className="py-1 border-b border-red-900/50">
                [{b.type}] Index {b.index}: {b.details}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Lesson Body */}
      {phase !== 'finished' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: The Board */}
          <div className="lg:col-span-7 flex flex-col items-center">
            <DojoBoard
              fen={phase === 'explain' ? (currentStep?.fen || '8/8/8/8/8/8/8/8 w - - 0 1') : currentFen}
              orientation={phase === 'challenge' && currentChallenge && currentChallenge.fen.split(' ')[1] === 'b' ? 'black' : 'white'}
              interactive={phase === 'challenge' && challengeStatus === 'solving' && !isOpponentMoving}
              onMove={handleUserMove}
              arrows={displayArrows}
              customHighlights={displayHighlights}
              lastMove={lastMove}
            />
          </div>

          {/* Right: Step or Challenge Guidance */}
          <div className="lg:col-span-5 space-y-5">
            {phase === 'explain' && currentStep ? (
              <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 shadow-xl space-y-6">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-500">
                  <BookOpen className="w-4 h-4" />
                  <span>Sensei Instruction</span>
                </div>

                <p className="text-stone-200 text-sm sm:text-base leading-relaxed font-sans">
                  {currentStep.text}
                </p>

                <div className="flex items-center justify-between pt-4 border-t border-stone-800">
                  <button
                    onClick={handlePrevStep}
                    disabled={stepIdx === 0}
                    className="py-2.5 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold transition-all disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    onClick={handleNextStep}
                    className="py-2.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center gap-2 cursor-pointer"
                  >
                    <span>{stepIdx + 1 < lesson.steps.length ? 'Next Step' : 'Begin Challenges'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : currentChallenge ? (
              <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 shadow-xl space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
                    <Star className="w-4 h-4" />
                    <span>Challenge Trial</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className={`text-sm ${i < triesLeft ? 'text-amber-400' : 'text-stone-700'}`}
                      >
                        ●
                      </span>
                    ))}
                    <span className="text-[11px] text-stone-400 ml-1.5 font-mono">{triesLeft} tries</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-stone-950/70 border border-stone-800/80">
                  <p className="text-stone-200 text-sm font-medium leading-relaxed">
                    {currentChallenge.prompt}
                  </p>
                </div>

                {/* Challenge Result Alerts */}
                {challengeStatus === 'correct' && (
                  <div className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between animate-fadeIn">
                    <div className="flex items-center gap-2 font-bold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Mastered! Accurate technique.</span>
                    </div>
                    <button
                      onClick={handleNextChallenge}
                      className="py-1.5 px-4 rounded-lg bg-emerald-500 text-stone-950 font-bold uppercase transition-all shadow-md active:scale-95 cursor-pointer"
                    >
                      Continue
                    </button>
                  </div>
                )}

                {challengeStatus === 'failed' && (
                  <div className="p-4 rounded-xl bg-red-950/50 border border-red-500/40 text-red-300 text-xs space-y-3 animate-fadeIn">
                    <div className="flex items-center gap-2 font-bold">
                      <XCircle className="w-4 h-4 text-red-400" />
                      <span>Out of attempts. The answer was {toSan(currentChallenge.fen, currentChallenge.solution[0])}.</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleRetryChallenge}
                        className="py-2 px-3 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold transition-all flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Retry Challenge</span>
                      </button>
                      <button
                        onClick={handleNextChallenge}
                        className="py-2 px-3 rounded-lg bg-amber-500 text-stone-950 font-bold transition-all"
                      >
                        Skip to Next
                      </button>
                    </div>
                  </div>
                )}

                {/* Hint Button */}
                {challengeStatus === 'solving' && (
                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={handleRequestHint}
                      disabled={hintsUsed >= 2}
                      className="py-2 px-3.5 rounded-xl bg-stone-800 hover:bg-stone-700 border border-stone-700 text-amber-300 text-xs font-bold flex items-center gap-2 transition-all disabled:opacity-40"
                    >
                      <Lightbulb className="w-4 h-4 text-amber-400" />
                      <span>
                        {hintsUsed === 0
                          ? 'Hint 1: Highlight Piece'
                          : hintsUsed === 1
                          ? 'Hint 2: Show Target Arrow'
                          : 'All Hints Revealed'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        /* Finished Screen */
        <div className="bg-stone-900 border border-amber-500/40 rounded-3xl p-8 max-w-lg mx-auto text-center space-y-6 shadow-2xl animate-scaleUp">
          <Trophy className="w-16 h-16 text-amber-400 mx-auto" />
          <div className="space-y-2">
            <h2 className="font-serif font-black text-2xl sm:text-3xl text-stone-100">
              Lesson Complete!
            </h2>
            <p className="text-stone-300 text-xs">
              You have completed all instructional steps and tactical challenges for <strong className="text-amber-400">{lesson.title}</strong>.
            </p>
          </div>

          <div className="flex justify-center gap-2 py-2">
            {[1, 2, 3].map((star) => (
              <Star
                key={star}
                className={`w-8 h-8 ${star <= finalStars ? 'text-amber-400 fill-amber-400' : 'text-stone-700'}`}
              />
            ))}
          </div>

          <button
            onClick={onExit}
            className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs uppercase tracking-wider transition-all shadow-xl active:scale-95 cursor-pointer"
          >
            Return to Curriculum Path
          </button>
        </div>
      )}
    </div>
  );
};
