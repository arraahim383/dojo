import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DojoBoard } from '../board/DojoBoard';
import { type Square } from 'chess.js';
import { db, getUserProfile, updateUserProfile, type UserProfile } from '../../db';
import { sound } from '../../services/sound';
import { Eye, Clock, Award, RotateCcw, Play, CheckCircle2, Trophy, Zap } from 'lucide-react';

interface VisionViewProps {
  userProfile: UserProfile;
  onRefreshProfile: () => void;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'];

const ALL_SQUARES: Square[] = [];
for (const f of FILES) {
  for (const r of RANKS) {
    ALL_SQUARES.push(`${f}${r}` as Square);
  }
}

export const VisionView: React.FC<VisionViewProps> = ({
  userProfile,
  onRefreshProfile,
}) => {
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [trainerMode, setTrainerMode] = useState<'click_square' | 'name_square'>('click_square');
  const [active, setActive] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [score, setScore] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [bestStreak, setBestStreak] = useState<number>(0);
  const [targetSquare, setTargetSquare] = useState<Square>('e4');
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [lastCorrectSquare, setLastCorrectSquare] = useState<Square | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const getRandomSquare = (current?: Square): Square => {
    let next: Square;
    do {
      next = ALL_SQUARES[Math.floor(Math.random() * ALL_SQUARES.length)];
    } while (next === current);
    return next;
  };

  const startTrainer = () => {
    setActive(true);
    setGameOver(false);
    setTimeLeft(30);
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    const initial = getRandomSquare();
    setTargetSquare(initial);

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          finishSession();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const finishSession = useCallback(async () => {
    setActive(false);
    setGameOver(true);
    sound.playSuccess();

    // Check personal best
    if (orientation === 'white' && score > userProfile.visionBestWhite) {
      await updateUserProfile({ visionBestWhite: score });
      onRefreshProfile();
    } else if (orientation === 'black' && score > userProfile.visionBestBlack) {
      await updateUserProfile({ visionBestBlack: score });
      onRefreshProfile();
    }
  }, [orientation, score, userProfile.visionBestWhite, userProfile.visionBestBlack, onRefreshProfile]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Board Square Click in "Click Square" mode
  const handleBoardClick = (sq: Square) => {
    if (!active || trainerMode !== 'click_square') return;

    if (sq === targetSquare) {
      // Correct!
      sound.playMove();
      setScore((s) => s + 1);
      setStreak((st) => {
        const next = st + 1;
        if (next > bestStreak) setBestStreak(next);
        return next;
      });
      setLastCorrectSquare(sq);
      setTargetSquare(getRandomSquare(sq));
    } else {
      // Miss!
      sound.playError();
      setStreak(0);
    }
  };

  // Multiple Choice click in "Name Square" mode
  const handleCoordinateSelect = (selected: string) => {
    if (!active || trainerMode !== 'name_square') return;

    if (selected === targetSquare) {
      sound.playMove();
      setScore((s) => s + 1);
      setStreak((st) => {
        const next = st + 1;
        if (next > bestStreak) setBestStreak(next);
        return next;
      });
      setTargetSquare(getRandomSquare(targetSquare));
    } else {
      sound.playError();
      setStreak(0);
    }
  };

  const highscore = orientation === 'white' ? userProfile.visionBestWhite : userProfile.visionBestBlack;
  const passedGateRequirement = highscore >= 15;

  // Custom highlights on board
  const boardHighlights: Record<string, React.CSSProperties> = {};
  if (active && trainerMode === 'name_square') {
    boardHighlights[targetSquare] = {
      backgroundColor: 'rgba(245, 158, 11, 0.75)',
      boxShadow: 'inset 0 0 0 3px #F59E0B',
    };
  }
  if (lastCorrectSquare && active) {
    boardHighlights[lastCorrectSquare] = {
      backgroundColor: 'rgba(16, 185, 129, 0.5)',
    };
  }

  // Choices for "Name Square" mode
  const currentFile = targetSquare[0];
  const currentRank = targetSquare[1];

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold tracking-widest uppercase">
          <Eye className="w-3.5 h-3.5" />
          Tactical Vision & Coordinates
        </div>
        <h1 className="text-3xl font-serif font-black text-stone-100 tracking-tight">
          Board Coordinate Dojo
        </h1>
        <p className="text-stone-400 text-xs sm:text-sm max-w-md mx-auto">
          Instant square recognition is the bedrock of rapid tactical calculation. Train to find any square in under a second.
        </p>
      </div>

      {/* Control Bar: Orientation, Mode & Stats */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (!active) setOrientation('white');
            }}
            disabled={active}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all ${
              orientation === 'white'
                ? 'bg-amber-500 text-stone-950 shadow-md'
                : 'bg-stone-800 text-stone-400 hover:text-stone-200'
            }`}
          >
            Play as White
          </button>
          <button
            onClick={() => {
              if (!active) setOrientation('black');
            }}
            disabled={active}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all ${
              orientation === 'black'
                ? 'bg-amber-500 text-stone-950 shadow-md'
                : 'bg-stone-800 text-stone-400 hover:text-stone-200'
            }`}
          >
            Play as Black
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (!active) setTrainerMode('click_square');
            }}
            disabled={active}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all ${
              trainerMode === 'click_square'
                ? 'bg-amber-600/30 text-amber-300 border border-amber-500/40'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            Click the Square
          </button>
          <button
            onClick={() => {
              if (!active) setTrainerMode('name_square');
            }}
            disabled={active}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all ${
              trainerMode === 'name_square'
                ? 'bg-amber-600/30 text-amber-300 border border-amber-500/40'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            Name the Square
          </button>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div>
            <span className="text-stone-500 mr-1">Best ({orientation}):</span>
            <span className="font-bold text-amber-400">{highscore}</span>
          </div>
          {passedGateRequirement && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
              Gate Passed (≥15)
            </span>
          )}
        </div>
      </div>

      {/* Main Board & Prompt Card */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
        {/* Left: The Board */}
        <div className="md:col-span-7 flex flex-col items-center">
          <DojoBoard
            fen="8/8/8/8/8/8/8/8 w - - 0 1"
            orientation={orientation}
            interactive={true}
            onMove={() => false}
            customHighlights={boardHighlights}
            boardTheme={userProfile.settings.boardTheme}
          />
        </div>

        {/* Right: Active Prompt & Target Screen */}
        <div className="md:col-span-5 space-y-6">
          {active ? (
            <div className="bg-stone-900 border border-amber-500/40 rounded-2xl p-6 shadow-2xl text-center space-y-5 animate-scaleUp">
              {/* Timer & Streak */}
              <div className="flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                  <Clock className="w-4 h-4" />
                  <span className="text-base">{timeLeft}s</span>
                </div>
                <div className="text-stone-400">
                  Streak: <span className="font-bold text-amber-400">{streak}</span>
                </div>
                <div className="text-stone-300">
                  Score: <span className="font-bold text-2xl text-stone-100">{score}</span>
                </div>
              </div>

              {/* Big Target Prompt */}
              {trainerMode === 'click_square' ? (
                <div className="py-6 bg-stone-950/80 rounded-2xl border border-stone-800">
                  <div className="text-xs uppercase tracking-widest text-stone-500 mb-1">
                    Click Square
                  </div>
                  <div className="font-mono font-black text-6xl text-amber-400 tracking-wide uppercase animate-pulse">
                    {targetSquare}
                  </div>
                </div>
              ) : (
                /* Name the Square choices */
                <div className="space-y-4">
                  <div className="text-xs uppercase tracking-widest text-stone-400">
                    Which square is highlighted?
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {/* Render random coordinate choices including correct one */}
                    {generateCoordinateOptions(targetSquare).map((opt) => (
                      <button
                        key={opt}
                        onClick={() => handleCoordinateSelect(opt)}
                        className="py-3 rounded-xl bg-stone-800 hover:bg-amber-600/30 border border-stone-700 hover:border-amber-500 text-stone-100 font-mono font-bold text-base transition-all active:scale-95 cursor-pointer"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* In-game helper note */}
              <div className="text-[11px] text-stone-500 italic">
                {trainerMode === 'click_square'
                  ? 'Click directly on the board square corresponding to the coordinate.'
                  : 'Select the coordinate button matching the amber square.'}
              </div>
            </div>
          ) : gameOver ? (
            /* Results Card */
            <div className="bg-stone-900 border border-amber-500/50 rounded-2xl p-6 shadow-2xl text-center space-y-4 animate-scaleUp">
              <Trophy className="w-10 h-10 text-amber-400 mx-auto" />
              <h3 className="font-serif font-black text-2xl text-stone-100">Trial Concluded!</h3>
              <div className="py-4 bg-stone-950/60 rounded-xl border border-stone-800">
                <div className="text-xs text-stone-500 uppercase tracking-wider mb-1">Final Score</div>
                <div className="font-mono font-black text-5xl text-amber-400">{score}</div>
                <div className="text-xs text-stone-400 mt-2">
                  Best Streak: <span className="text-stone-200 font-bold">{bestStreak}</span>
                </div>
              </div>

              {score >= 15 ? (
                <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Level 1 Gate Requirement Achieved (≥15 in 30s)!</span>
                </div>
              ) : (
                <p className="text-xs text-stone-400">
                  Target: 15 coordinates in 30s to unlock Level 2. Keep drilling!
                </p>
              )}

              <button
                onClick={startTrainer}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs uppercase tracking-wider transition-all shadow-lg active:scale-95 cursor-pointer"
              >
                Drill Again
              </button>
            </div>
          ) : (
            /* Ready to Start Card */
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 shadow-xl text-center space-y-4">
              <Eye className="w-10 h-10 text-amber-500/70 mx-auto" />
              <h3 className="font-serif font-bold text-xl text-stone-100">Coordinate Reflex Test</h3>
              <p className="text-xs text-stone-400 leading-relaxed">
                You will have 30 seconds to identify as many board coordinates as possible. Aim for at least 15 to fulfill your Level 1 Dojo Gate.
              </p>

              <button
                onClick={startTrainer}
                className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm uppercase tracking-wider transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                Start 30s Drill
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function generateCoordinateOptions(correct: Square): string[] {
  const options = new Set<string>();
  options.add(correct);

  while (options.size < 8) {
    const f = FILES[Math.floor(Math.random() * FILES.length)];
    const r = RANKS[Math.floor(Math.random() * RANKS.length)];
    options.add(`${f}${r}`);
  }

  return Array.from(options).sort();
}
