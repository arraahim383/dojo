import React, { useState } from 'react';
import { Chess, type Square } from 'chess.js';
import { DojoBoard } from '../board/DojoBoard';
import { puzzleService, type ActivePuzzle } from '../../services/puzzleService';
import { updateUserProfile, type UserProfile } from '../../db';
import { sound } from '../../services/sound';
import { ArrowRight, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface PlacementModalProps {
  isOpen: boolean;
  onComplete: () => void;
  userProfile: UserProfile;
}

const START_RATING = 800;
const K = 80;

function levelForRating(r: number): number {
  if (r >= 1450) return 4;
  if (r >= 1100) return 3;
  if (r >= 700) return 2;
  return 1;
}

export const PlacementModal: React.FC<PlacementModalProps> = ({ isOpen, onComplete, userProfile }) => {
  const [stage, setStage] = useState<'prompt' | 'loading' | 'testing' | 'result'>('prompt');
  const [puzzles, setPuzzles] = useState<ActivePuzzle[]>([]);
  const [idx, setIdx] = useState(0);
  const [boardFen, setBoardFen] = useState<string>(new Chess().fen());
  const [step, setStep] = useState(0);
  const [stepStatus, setStepStatus] = useState<'solving' | 'correct' | 'wrong'>('solving');
  const [opponentMoving, setOpponentMoving] = useState(false);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [arrow, setArrow] = useState<Array<[Square, Square, string?]>>([]);
  const [rating, setRating] = useState(START_RATING);
  const [solved, setSolved] = useState(0);
  const [failStreak, setFailStreak] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  const active = puzzles[idx];

  const show = (p: ActivePuzzle) => {
    setBoardFen(p.fen);
    setStep(0);
    setStepStatus('solving');
    setArrow([]);
    setLastMove(p.lastMoveUci ? { from: p.lastMoveUci.slice(0, 2) as Square, to: p.lastMoveUci.slice(2, 4) as Square } : null);
  };

  const handleImNew = async () => {
    await updateUserProfile({ currentLevel: 1, puzzleRating: 400, placementDone: true });
    sound.playSuccess();
    onComplete();
  };

  const handleStartTest = async () => {
    setStage('loading');
    setLoadError(null);
    try {
      const set = await puzzleService.getPlacementSet();
      if (set.length < 6) throw new Error('Not enough puzzles available for the test.');
      setPuzzles(set);
      setIdx(0);
      setRating(START_RATING);
      setSolved(0);
      setFailStreak(0);
      show(set[0]);
      setStage('testing');
    } catch (e: any) {
      setLoadError(e?.message || 'Could not prepare the test.');
      setStage('prompt');
    }
  };

  const applyResult = (win: boolean) => {
    const expected = 1 / (1 + Math.pow(10, (active.rating - rating) / 400));
    setRating((r) => Math.round(r + K * ((win ? 1 : 0) - expected)));
    if (win) {
      setSolved((s) => s + 1);
      setFailStreak(0);
    } else {
      setFailStreak((f) => f + 1);
    }
  };

  const handleUserMove = async (uci: string): Promise<boolean> => {
    if (!active || stepStatus !== 'solving' || opponentMoving) return false;
    const expected = active.solution[step];
    const isFinal = step >= active.solution.length - 1;
    if (!puzzleService.isMoveCorrect(boardFen, uci, expected, isFinal)) {
      sound.playError();
      setStepStatus('wrong');
      setArrow([[expected.slice(0, 2) as Square, expected.slice(2, 4) as Square, 'rgba(34, 197, 94, 0.9)']]);
      applyResult(false);
      return false;
    }
    const c = new Chess(boardFen);
    c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || 'q' });
    setBoardFen(c.fen());
    setLastMove({ from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square });
    const next = step + 1;
    if (next >= active.solution.length || c.isCheckmate()) {
      sound.playSuccess();
      setStepStatus('correct');
      applyResult(true);
      return true;
    }
    const reply = active.solution[next];
    setStep(next + 1);
    setOpponentMoving(true);
    setTimeout(() => {
      c.move({ from: reply.slice(0, 2), to: reply.slice(2, 4), promotion: reply[4] || 'q' });
      setBoardFen(c.fen());
      setLastMove({ from: reply.slice(0, 2) as Square, to: reply.slice(2, 4) as Square });
      sound.playMove();
      setOpponentMoving(false);
    }, 450);
    return true;
  };

  const finish = async (finalRating: number) => {
    const clamped = Math.max(400, Math.min(2000, finalRating));
    setRating(clamped);
    setStage('result');
    await updateUserProfile({ puzzleRating: clamped, currentLevel: levelForRating(clamped), placementDone: true });
    sound.playSuccess();
  };

  const handleNext = () => {
    // Three misses in a row ends the test early (the rest would be even harder)
    if (failStreak >= 3 || idx + 1 >= puzzles.length) {
      finish(rating);
      return;
    }
    const n = idx + 1;
    setIdx(n);
    show(puzzles[n]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-stone-900 border border-amber-600/40 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl relative text-stone-100 my-auto">
        {stage === 'prompt' && (
          <div className="text-center space-y-6 py-4 animate-fadeIn">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 mx-auto text-3xl font-serif">
              道
            </div>
            <div className="space-y-2">
              <h2 className="font-serif font-black text-3xl sm:text-4xl text-stone-100 tracking-tight">Welcome to Daba Dojo</h2>
              <p className="text-stone-300 text-sm max-w-md mx-auto leading-relaxed">
                Train from total beginner to about 1800, level by level. Where would you like to start?
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto pt-4">
              <button
                onClick={handleImNew}
                className="p-5 rounded-2xl bg-stone-800/80 hover:bg-stone-800 border border-stone-700 hover:border-amber-500/50 text-left transition-all cursor-pointer"
              >
                <div className="text-2xl mb-2">🌱</div>
                <div className="font-serif font-bold text-base text-amber-300 mb-1">I'm new to chess</div>
                <p className="text-xs text-stone-400 leading-relaxed">
                  Start from Level 1 fundamentals: how pieces move, check, checkmate, castling and piece values.
                </p>
              </button>
              <button
                onClick={handleStartTest}
                className="p-5 rounded-2xl bg-amber-950/40 hover:bg-amber-950/60 border border-amber-500/60 text-left transition-all cursor-pointer shadow-lg"
              >
                <div className="text-2xl mb-2">⚔️</div>
                <div className="font-serif font-bold text-base text-amber-400 mb-1">Take the placement test</div>
                <p className="text-xs text-stone-300 leading-relaxed">
                  Up to 12 real puzzles, rated 400 to 1900. Sets your starting rating and level.
                </p>
              </button>
            </div>
            {loadError && <p className="text-xs text-red-300">{loadError}</p>}
          </div>
        )}

        {stage === 'loading' && (
          <div className="py-16 flex flex-col items-center gap-3 text-stone-400 text-sm">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
            Preparing puzzles…
          </div>
        )}

        {stage === 'testing' && active && (
          <div className="space-y-5 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Placement test</span>
                <h3 className="font-serif font-bold text-lg text-stone-100">
                  Puzzle {idx + 1} of {puzzles.length}
                </h3>
              </div>
              <div className="text-right font-mono text-xs text-stone-400">
                <div>
                  Puzzle rating: <span className="font-bold text-amber-400">{active.rating}</span>
                </div>
                <div>
                  Your estimate: <span className="font-bold text-stone-200">{rating}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-center">
              <DojoBoard
                fen={boardFen}
                orientation={new Chess(active.fen).turn() === 'w' ? 'white' : 'black'}
                interactive={stepStatus === 'solving' && !opponentMoving}
                onMove={handleUserMove}
                lastMove={lastMove}
                arrows={arrow}
                boardTheme={userProfile.settings.boardTheme}
              />
            </div>
            <div className="flex items-center justify-between bg-stone-950/60 p-4 rounded-2xl border border-stone-800 gap-3">
              <div className="text-xs">
                {stepStatus === 'solving' && (
                  <p className="text-stone-300">
                    {new Chess(active.fen).turn() === 'w' ? 'White' : 'Black'} to move. Find the best move (play the whole sequence).
                  </p>
                )}
                {stepStatus === 'correct' && (
                  <span className="flex items-center gap-2 text-emerald-400 font-bold">
                    <CheckCircle2 className="w-4 h-4" /> Solved!
                  </span>
                )}
                {stepStatus === 'wrong' && (
                  <span className="flex items-center gap-2 text-red-400 font-bold">
                    <XCircle className="w-4 h-4" /> Not this time. The green arrow shows the move.
                  </span>
                )}
              </div>
              {stepStatus !== 'solving' && (
                <button
                  onClick={handleNext}
                  className="py-2 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-md shrink-0"
                >
                  <span>{failStreak >= 3 || idx + 1 >= puzzles.length ? 'See result' : 'Next'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
            <button onClick={() => finish(rating)} className="text-[11px] text-stone-500 hover:text-stone-300">
              Stop here and use my current estimate
            </button>
          </div>
        )}

        {stage === 'result' && (
          <div className="text-center space-y-6 py-6 animate-scaleUp">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 mx-auto text-3xl">🥋</div>
            <div className="space-y-2">
              <h2 className="font-serif font-black text-3xl text-stone-100">Placement complete</h2>
              <p className="text-stone-300 text-xs max-w-sm mx-auto">
                You solved {solved} of {idx + 1} puzzles. You can always change your level later in Settings.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto py-2">
              <div className="p-4 rounded-2xl bg-stone-950 border border-stone-800">
                <div className="text-[10px] uppercase font-bold text-stone-500">Puzzle rating</div>
                <div className="font-mono font-black text-3xl text-amber-400">{rating}</div>
              </div>
              <div className="p-4 rounded-2xl bg-stone-950 border border-stone-800">
                <div className="text-[10px] uppercase font-bold text-stone-500">Starting level</div>
                <div className="font-serif font-black text-2xl text-stone-100">Level {levelForRating(rating)}</div>
              </div>
            </div>
            <button
              onClick={onComplete}
              className="w-full max-w-xs py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs uppercase tracking-wider transition-all shadow-xl active:scale-95 cursor-pointer"
            >
              Enter Daba Dojo
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
