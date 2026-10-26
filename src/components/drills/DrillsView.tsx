import React, { useState, useEffect, useRef } from 'react';
import { Chess, type Square } from 'chess.js';
import { DojoBoard } from '../board/DojoBoard';
import { CLASSIC_DRILLS, type DojoDrill } from '../../data/drills';
import { engine } from '../../services/engine';
import { getUserProfile, updateUserProfile, bumpDailyActivity, type UserProfile } from '../../db';
import { sound } from '../../services/sound';
import {
  Target,
  CheckCircle2,
  Trophy,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Shield,
  HelpCircle,
  Clock,
  Play,
  ArrowLeft
} from 'lucide-react';

interface DrillsViewProps {
  userProfile: UserProfile;
  onRefreshProfile: () => void;
}

export const DrillsView: React.FC<DrillsViewProps> = ({
  userProfile,
  onRefreshProfile,
}) => {
  const [selectedDrill, setSelectedDrill] = useState<DojoDrill | null>(null);
  const [game, setGame] = useState<Chess>(new Chess());
  const [fen, setFen] = useState<string>('');
  const [movesPlayedCount, setMovesPlayedCount] = useState<number>(0);
  const [isBotThinking, setIsBotThinking] = useState<boolean>(false);
  const [drillResult, setDrillResult] = useState<'playing' | 'win' | 'draw' | 'failed'>('playing');
  const [failReason, setFailReason] = useState<string>('');
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const runIdRef = useRef(0); // ignore engine replies from a drill that was restarted or left

  useEffect(() => () => {
    runIdRef.current++;
  }, []);

  const userTurn = (c: Chess, drill: DojoDrill) => (c.turn() === 'w') === (drill.userColor === 'white');

  const handleStartDrill = (drill: DojoDrill) => {
    runIdRef.current++;
    const c = new Chess(drill.fen);
    setSelectedDrill(drill);
    setGame(c);
    setFen(c.fen());
    setMovesPlayedCount(0);
    setDrillResult('playing');
    setFailReason('');
    setLastMove(null);
    setIsBotThinking(false);
    if (!userTurn(c, drill)) {
      const id = runIdRef.current;
      setTimeout(() => triggerEngineMove(c, drill, 0, id), 500);
    }
  };

  const recordDrillPassed = async (drillId: string) => {
    const profile = await getUserProfile();
    if (!profile.passedDrills.includes(drillId)) {
      await updateUserProfile({ passedDrills: [...profile.passedDrills, drillId] });
    }
    await bumpDailyActivity('lessonsOrDrills');
    onRefreshProfile();
  };

  // Decide whether the drill is over. `userMoves` = how many moves you have made so far.
  const checkDrillOutcome = (c: Chess, drill: DojoDrill, userMoves: number): boolean => {
    const youAreMated = c.isCheckmate() && userTurn(c, drill);
    const youMated = c.isCheckmate() && !userTurn(c, drill);
    if (drill.goal === 'win') {
      if (youMated) {
        setDrillResult('win');
        sound.playSuccess();
        recordDrillPassed(drill.id);
        return true;
      }
      if (youAreMated || c.isDraw()) {
        setDrillResult('failed');
        setFailReason(c.isStalemate() ? 'Stalemate! The enemy king had no legal moves but was not in check, so the game is a draw.' : c.isDraw() ? 'The game ended in a draw.' : 'You were checkmated.');
        sound.playError();
        return true;
      }
      if (userMoves >= drill.moveLimit && userTurn(c, drill)) {
        setDrillResult('failed');
        setFailReason(`You used all ${drill.moveLimit} moves without delivering checkmate.`);
        sound.playError();
        return true;
      }
      return false;
    }
    // goal: draw
    if (youAreMated) {
      setDrillResult('failed');
      setFailReason('You were checkmated.');
      sound.playError();
      return true;
    }
    if (c.isDraw() || youMated) {
      setDrillResult('draw');
      sound.playSuccess();
      recordDrillPassed(drill.id);
      return true;
    }
    if (userMoves >= drill.moveLimit && userTurn(c, drill)) {
      // You survived the required moves: pass unless Stockfish says the position is now lost.
      const id = runIdRef.current;
      setIsBotThinking(true);
      engine.evaluatePosition(c.fen(), { depth: 16 }).then((a) => {
        if (id !== runIdRef.current) return;
        setIsBotThinking(false);
        const l = a.lines[0];
        const sign = drill.userColor === 'white' ? 1 : -1;
        const youCp = l ? sign * (l.mate !== undefined ? (l.mate > 0 ? 10000 : -10000) : l.scoreCp ?? 0) : 0;
        if (youCp <= -400) {
          setDrillResult('failed');
          setFailReason('You lasted the moves, but Stockfish says the position is now lost. Try again.');
          sound.playError();
        } else {
          setDrillResult('draw');
          sound.playSuccess();
          recordDrillPassed(drill.id);
        }
      });
      return true;
    }
    return false;
  };

  const triggerEngineMove = async (c: Chess, drill: DojoDrill, userMoves: number, id: number) => {
    if (c.isGameOver()) return;
    setIsBotThinking(true);
    try {
      const res = await engine.getBestMove(c.fen());
      if (id !== runIdRef.current || !res.move) return;
      const moved = c.move({ from: res.move.slice(0, 2), to: res.move.slice(2, 4), promotion: res.move[4] || 'q' });
      const copy = new Chess();
      copy.loadPgn(c.pgn());
      setGame(copy);
      setFen(c.fen());
      setLastMove({ from: moved.from as Square, to: moved.to as Square });
      if (moved.captured) sound.playCapture();
      else sound.playMove();
      checkDrillOutcome(c, drill, userMoves);
    } catch (e) {
      console.error('Drill engine move error', e);
    } finally {
      if (id === runIdRef.current) setIsBotThinking(false);
    }
  };

  const handleUserMove = async (uci: string) => {
    if (!selectedDrill || drillResult !== 'playing' || isBotThinking) return false;
    if (!userTurn(game, selectedDrill)) return false;
    // play on a copy that keeps the move history (needed for repetition draws)
    const next = new Chess();
    next.loadPgn(game.pgn());
    let moved;
    try {
      moved = next.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || 'q' });
    } catch {
      return false;
    }
    const count = movesPlayedCount + 1;
    setMovesPlayedCount(count);
    setGame(next);
    setFen(next.fen());
    setLastMove({ from: moved.from as Square, to: moved.to as Square });
    if (!checkDrillOutcome(next, selectedDrill, count)) {
      const id = runIdRef.current;
      setTimeout(() => triggerEngineMove(next, selectedDrill, count, id), 350);
    }
    return true;
  };

  const filteredDrills = CLASSIC_DRILLS.filter(
    (d) => selectedCategory === 'all' || d.category === selectedCategory
  );

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold tracking-widest uppercase">
          <Target className="w-3.5 h-3.5" />
          Martial Endgame & Tactical Drills
        </div>
        <h1 className="text-3xl font-serif font-black text-stone-100 tracking-tight">
          Drills Against Full-Strength Stockfish
        </h1>
        <p className="text-stone-400 text-xs sm:text-sm max-w-lg mx-auto">
          Classic endgame positions against full-strength Stockfish. Every position has been checked: win drills are winnable, draw drills are holdable.
        </p>
      </div>

      {!selectedDrill ? (
        /* Drills Selection View */
        <div className="space-y-6">
          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {[
              { id: 'all', label: 'All Drills' },
              { id: 'checkmate', label: 'Checkmates' },
              { id: 'rook', label: 'Rook Endgames' },
              { id: 'pawn', label: 'King & Pawn' },
              { id: 'minor', label: 'Minor Pieces' },
              { id: 'defense', label: 'Fortresses & Defense' },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setSelectedCategory(id)}
                className={`py-1.5 px-4 rounded-xl text-xs font-bold transition-all ${
                  selectedCategory === id
                    ? 'bg-amber-500 text-stone-950 shadow-md font-serif'
                    : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-stone-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Drill Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDrills.map((drill) => {
              const isPassed = userProfile.passedDrills.includes(drill.id);

              return (
                <div
                  key={drill.id}
                  onClick={() => handleStartDrill(drill)}
                  className={`p-5 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer ${
                    isPassed
                      ? 'bg-stone-900 border-emerald-500/40 hover:border-emerald-400'
                      : 'bg-stone-900 border-stone-800 hover:border-amber-500/50 hover:bg-stone-800/80 shadow-lg'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-amber-500">
                        {drill.category}
                      </span>
                      {isPassed ? (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/30">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Passed
                        </span>
                      ) : (
                        <span className="text-[11px] font-mono text-stone-400">
                          Goal: {drill.goal.toUpperCase()}
                        </span>
                      )}
                    </div>

                    <h3 className="font-serif font-bold text-base text-stone-100 mb-1">
                      {drill.title}
                    </h3>
                    <p className="text-xs text-stone-400 leading-relaxed mb-4">
                      {drill.description}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-stone-800/80 flex items-center justify-between text-[11px] text-stone-400">
                    <span>
                      {drill.goal === 'win' ? `Mate within ${drill.moveLimit} moves` : `Hold for ${drill.moveLimit} moves`} · you play {drill.userColor}
                    </span>
                    <span className="font-bold text-amber-400 flex items-center gap-1">
                      <span>Begin Drill</span>
                      <Play className="w-3 h-3 fill-current" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Active Drill Sparring Board */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: The Board */}
          <div className="lg:col-span-7 flex flex-col items-center">
            {/* Header bar */}
            <div className="w-full max-w-[560px] flex items-center justify-between bg-stone-900 border border-stone-800 rounded-t-xl px-4 py-2.5 mb-2 shadow-md text-xs">
              <div className="flex items-center gap-2">
                <span className="font-serif font-bold text-stone-100">{selectedDrill.title}</span>
                <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-mono text-[10px] font-bold">
                  {selectedDrill.goal === 'win' ? 'Goal: checkmate' : 'Goal: hold the draw'}
                </span>
              </div>

              {isBotThinking ? (
                <span className="text-amber-400 font-serif italic text-xs animate-pulse">
                  Stockfish replying...
                </span>
              ) : (
                <span className="font-mono text-stone-400">
                  Your moves: {movesPlayedCount} / {selectedDrill.moveLimit}
                </span>
              )}
            </div>

            {/* Board */}
            <DojoBoard
              fen={fen}
              orientation={selectedDrill.userColor}
              interactive={drillResult === 'playing' && !isBotThinking && userTurn(game, selectedDrill)}
              onMove={handleUserMove}
              lastMove={lastMove}
              boardTheme={userProfile.settings.boardTheme}
            />

            {/* Bottom info */}
            <div className="w-full max-w-[560px] flex items-center justify-between bg-stone-900 border border-stone-800 rounded-b-xl px-4 py-2 mt-2 shadow-md text-xs text-stone-400">
              <span className="italic truncate pr-2">Tip: {selectedDrill.techniqueTip}</span>
              <button
                onClick={() => setSelectedDrill(null)}
                className="text-stone-300 hover:text-amber-400 shrink-0 font-bold"
              >
                Exit Drill
              </button>
            </div>
          </div>

          {/* Right: Drill Status & Controls */}
          <div className="lg:col-span-5 space-y-4">
            {/* Result Banners */}
            {drillResult === 'win' && (
              <div className="p-5 rounded-2xl bg-emerald-950/50 border border-emerald-500/40 shadow-xl space-y-3 animate-scaleUp">
                <div className="flex items-center gap-2 text-emerald-400 font-serif font-bold text-lg">
                  <Trophy className="w-5 h-5" />
                  <span>Drill Conquered!</span>
                </div>
                <p className="text-xs text-stone-300">
                  Technique successfully proven against Stockfish. This drill is now recorded as passed in your Dojo belt gates.
                </p>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => handleStartDrill(selectedDrill)}
                    className="flex-1 py-2 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold transition-all"
                  >
                    Drill Again
                  </button>
                  <button
                    onClick={() => setSelectedDrill(null)}
                    className="flex-1 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs uppercase tracking-wider transition-all"
                  >
                    Choose Another
                  </button>
                </div>
              </div>
            )}

            {drillResult === 'draw' && (
              <div className="p-5 rounded-2xl bg-emerald-950/50 border border-emerald-500/40 shadow-xl space-y-3 animate-scaleUp">
                <div className="flex items-center gap-2 text-emerald-400 font-serif font-bold text-lg">
                  <Shield className="w-5 h-5" />
                  <span>Fortress Held! Drawn Battle</span>
                </div>
                <p className="text-xs text-stone-300">
                  You held the position against full-strength Stockfish. This drill now counts as passed.
                </p>
                <button
                  onClick={() => setSelectedDrill(null)}
                  className="w-full py-2.5 rounded-xl bg-amber-500 text-stone-950 font-bold text-xs uppercase tracking-wider"
                >
                  Return to Drills
                </button>
              </div>
            )}

            {drillResult === 'failed' && (
              <div className="p-5 rounded-2xl bg-red-950/50 border border-red-500/40 shadow-xl space-y-3 animate-scaleUp">
                <div className="text-red-400 font-serif font-bold text-lg">Drill Missed</div>
                <p className="text-xs text-stone-300">{failReason || 'Reset and try the technique again.'}</p>
                <button
                  onClick={() => handleStartDrill(selectedDrill)}
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs uppercase tracking-wider transition-all"
                >
                  Retry Drill
                </button>
              </div>
            )}

            {/* Technique Guidelines Card */}
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-xl space-y-4">
              <h4 className="font-serif font-bold text-stone-100 text-sm flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-500" />
                <span>Martial Technique Guide</span>
              </h4>
              <p className="text-xs text-stone-300 leading-relaxed">
                {selectedDrill.techniqueTip}
              </p>

              <div className="pt-2 flex gap-2">
                <button
                  onClick={() => handleStartDrill(selectedDrill)}
                  className="flex-1 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restart Drill</span>
                </button>
                <button
                  onClick={() => setSelectedDrill(null)}
                  className="py-2 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-400 border border-stone-800 text-xs transition-all"
                >
                  List
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
