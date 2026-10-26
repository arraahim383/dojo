import React, { useState, useEffect } from 'react';
import { Chess, type Square } from 'chess.js';
import { DojoBoard } from '../board/DojoBoard';
import { OPENINGS_DATABASE, OpeningLine } from '../../data/openings';
import { GeminiCoachModal } from '../common/GeminiCoachModal';
import { sound } from '../../services/sound';
import { UserProfile } from '../../db';
import {
  Compass,
  BookOpen,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Play,
  ArrowRight,
  Search,
  Filter,
  Check
} from 'lucide-react';

interface OpeningsViewProps {
  userProfile: UserProfile;
}

export const OpeningsView: React.FC<OpeningsViewProps> = ({ userProfile }) => {
  const [selectedLine, setSelectedLine] = useState<OpeningLine | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSide, setSelectedSide] = useState<'all' | 'white' | 'black'>('all');

  // Repertoire Trainer State
  const [drillStep, setDrillStep] = useState<number>(0); // index in selectedLine.ucis
  const [boardFen, setBoardFen] = useState<string>('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const [drillStatus, setDrillStatus] = useState<'playing' | 'completed' | 'mistake'>('playing');
  const [isOpponentMoving, setIsOpponentMoving] = useState<boolean>(false);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);

  // Gemini Sensei explanation modal
  const [explainModal, setExplainModal] = useState<{
    open: boolean;
    fen: string;
    move: string;
  }>({ open: false, fen: '', move: '' });

  // Start drilling opening
  const handleStartDrill = (line: OpeningLine) => {
    setSelectedLine(line);
    setDrillStep(0);
    const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    setBoardFen(startFen);
    setDrillStatus('playing');
    setLastMove(null);

    // If player is black, play white's first move
    if (line.side === 'black' && line.ucis.length > 0) {
      setIsOpponentMoving(true);
      setTimeout(() => {
        const c = new Chess(startFen);
        const firstMove = line.ucis[0];
        const from = firstMove.slice(0, 2) as Square;
        const to = firstMove.slice(2, 4) as Square;
        c.move({ from, to });
        setBoardFen(c.fen());
        setLastMove({ from, to });
        setDrillStep(1);
        sound.playMove();
        setIsOpponentMoving(false);
      }, 400);
    }
  };

  // User move in repertoire trainer
  const handleUserMove = async (uci: string) => {
    if (!selectedLine || drillStatus !== 'playing' || isOpponentMoving) return false;

    const expectedUci = selectedLine.ucis[drillStep];
    const isCorrect = uci.toLowerCase() === expectedUci?.toLowerCase();

    if (isCorrect) {
      sound.playMove();
      const from = uci.slice(0, 2) as Square;
      const to = uci.slice(2, 4) as Square;
      setLastMove({ from, to });

      const c = new Chess(boardFen);
      c.move({ from, to });
      setBoardFen(c.fen());

      const nextStep = drillStep + 1;

      if (nextStep >= selectedLine.ucis.length) {
        setDrillStatus('completed');
        sound.playSuccess();
        return true;
      }

      // Opponent auto-reply
      setDrillStep(nextStep + 1);
      setIsOpponentMoving(true);
      const oppUci = selectedLine.ucis[nextStep];

      setTimeout(() => {
        const oppFrom = oppUci.slice(0, 2) as Square;
        const oppTo = oppUci.slice(2, 4) as Square;
        c.move({ from: oppFrom, to: oppTo });
        setBoardFen(c.fen());
        setLastMove({ from: oppFrom, to: oppTo });
        sound.playMove();
        setIsOpponentMoving(false);

        if (nextStep + 1 >= selectedLine.ucis.length) {
          setDrillStatus('completed');
          sound.playSuccess();
        }
      }, 500);

      return true;
    } else {
      sound.playError();
      setDrillStatus('mistake');
      return false;
    }
  };

  const filteredLines = OPENINGS_DATABASE.filter((line) => {
    const matchesSearch =
      line.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      line.eco.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSide = selectedSide === 'all' || line.side === selectedSide;
    return matchesSearch && matchesSide;
  });

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold tracking-widest uppercase">
          <Compass className="w-3.5 h-3.5" />
          Opening Repertoire & Strategic Principles
        </div>
        <h1 className="text-3xl font-serif font-black text-stone-100 tracking-tight">
          Opening Explorer & Repertoire Dojo
        </h1>
        <p className="text-stone-400 text-xs sm:text-sm max-w-lg mx-auto">
          Drill core opening lines move-by-move. Learn the fundamental tactical ideas and pawn structures behind each opening.
        </p>
      </div>

      {!selectedLine ? (
        /* Openings List & Explorer */
        <div className="space-y-6">
          {/* Search & Filters */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-stone-900 border border-stone-800 p-4 rounded-2xl shadow-md">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search openings by name or ECO (e.g. Italian, B90, Sicilian)..."
                className="w-full bg-stone-950 border border-stone-800 rounded-xl pl-10 pr-4 py-2 text-xs text-stone-200 focus:outline-hidden focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-2">
              {(['all', 'white', 'black'] as const).map((side) => (
                <button
                  key={side}
                  onClick={() => setSelectedSide(side)}
                  className={`py-1.5 px-3.5 rounded-xl text-xs font-bold capitalize transition-all ${
                    selectedSide === side
                      ? 'bg-amber-500 text-stone-950 shadow-md font-serif'
                      : 'bg-stone-800 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  {side === 'all' ? 'All Sides' : `${side} Repertoire`}
                </button>
              ))}
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredLines.map((line) => (
              <div
                key={line.id}
                onClick={() => handleStartDrill(line)}
                className="p-5 rounded-2xl bg-stone-900 border border-stone-800 hover:border-amber-500/50 hover:bg-stone-800/80 transition-all cursor-pointer shadow-lg flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      {line.eco}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-stone-400 capitalize">
                      {line.side} Side • {line.category}
                    </span>
                  </div>

                  <h3 className="font-serif font-bold text-base text-stone-100 mb-1">
                    {line.name}
                  </h3>
                  <p className="text-xs text-stone-400 leading-relaxed mb-4">
                    {line.ideas}
                  </p>
                </div>

                <div className="pt-3 border-t border-stone-800/80 flex items-center justify-between text-[11px] text-stone-400">
                  <span className="font-mono">{line.moves.slice(0, 5).join(' ')}...</span>
                  <span className="font-bold text-amber-400 flex items-center gap-1">
                    <span>Drill Line</span>
                    <Play className="w-3 h-3 fill-current" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Active Repertoire Trainer */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: The Board */}
          <div className="lg:col-span-7 flex flex-col items-center">
            {/* Header */}
            <div className="w-full max-w-[560px] flex items-center justify-between bg-stone-900 border border-stone-800 rounded-t-xl px-4 py-2.5 mb-2 shadow-md text-xs">
              <div className="flex items-center gap-2">
                <span className="font-serif font-bold text-stone-100">{selectedLine.name}</span>
                <span className="font-mono text-amber-400 font-bold">({selectedLine.eco})</span>
              </div>
              <span className="font-mono text-stone-400">
                Move {Math.floor(drillStep / 2) + 1} / {Math.ceil(selectedLine.ucis.length / 2)}
              </span>
            </div>

            {/* Board */}
            <DojoBoard
              fen={boardFen}
              orientation={selectedLine.side}
              interactive={drillStatus === 'playing' && !isOpponentMoving}
              onMove={handleUserMove}
              lastMove={lastMove}
              boardTheme={userProfile.settings.boardTheme}
            />

            {/* Bottom info */}
            <div className="w-full max-w-[560px] flex items-center justify-between bg-stone-900 border border-stone-800 rounded-b-xl px-4 py-2 mt-2 shadow-md text-xs text-stone-400">
              <span className="italic truncate pr-2">Next required move: {selectedLine.moves[drillStep] || 'Complete'}</span>
              <button
                onClick={() => setSelectedLine(null)}
                className="text-stone-300 hover:text-amber-400 font-bold shrink-0"
              >
                Exit Repertoire
              </button>
            </div>
          </div>

          {/* Right: Line Progress & Sensei Idea */}
          <div className="lg:col-span-5 space-y-4">
            {/* Status alerts */}
            {drillStatus === 'completed' && (
              <div className="p-5 rounded-2xl bg-emerald-950/50 border border-emerald-500/40 shadow-xl space-y-3 animate-scaleUp">
                <div className="flex items-center gap-2 text-emerald-400 font-serif font-bold text-lg">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Repertoire Line Mastered!</span>
                </div>
                <p className="text-xs text-stone-300">
                  Every move executed with precision according to the Dojo opening repertoire.
                </p>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => handleStartDrill(selectedLine)}
                    className="flex-1 py-2 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold transition-all"
                  >
                    Drill Again
                  </button>
                  <button
                    onClick={() => setSelectedLine(null)}
                    className="flex-1 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs uppercase tracking-wider transition-all"
                  >
                    Explore Others
                  </button>
                </div>
              </div>
            )}

            {drillStatus === 'mistake' && (
              <div className="p-5 rounded-2xl bg-red-950/50 border border-red-500/40 shadow-xl space-y-3 animate-scaleUp">
                <div className="text-red-400 font-serif font-bold text-lg">Repertoire Deviation</div>
                <p className="text-xs text-stone-300">
                  Expected move: <strong className="font-mono text-emerald-400">{selectedLine.moves[drillStep]}</strong>.
                </p>
                <button
                  onClick={() => {
                    setDrillStatus('playing');
                  }}
                  className="w-full py-2 rounded-xl bg-stone-800 text-stone-200 text-xs font-bold hover:bg-stone-700"
                >
                  Retry Move
                </button>
              </div>
            )}

            {/* Strategic Ideas Card */}
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-serif font-bold text-stone-100 text-sm flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-amber-500" />
                  <span>Strategic Ideas & Plans</span>
                </h4>
                <button
                  onClick={() => {
                    setExplainModal({
                      open: true,
                      fen: boardFen,
                      move: selectedLine.moves[drillStep] || selectedLine.moves[0],
                    });
                  }}
                  className="py-1 px-2.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Explain the Idea</span>
                </button>
              </div>

              <p className="text-xs text-stone-300 leading-relaxed">
                {selectedLine.ideas}
              </p>

              {/* Move Sequence List */}
              <div className="pt-2 border-t border-stone-800 space-y-1 text-xs font-mono">
                <div className="text-[10px] uppercase font-bold text-stone-500">Full Move Line</div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {selectedLine.moves.map((m, idx) => (
                    <span
                      key={idx}
                      className={`px-2 py-0.5 rounded text-[11px] ${
                        idx === drillStep
                          ? 'bg-amber-500 text-stone-950 font-bold'
                          : idx < drillStep
                          ? 'bg-stone-800 text-stone-300'
                          : 'bg-stone-950 text-stone-600'
                      }`}
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Gemini Sensei Explanation Modal */}
      <GeminiCoachModal
        isOpen={explainModal.open}
        onClose={() => setExplainModal({ open: false, fen: '', move: '' })}
        fen={explainModal.fen}
        movePlayed={explainModal.move}
        userLevel={userProfile.currentLevel}
        context={`Opening strategy for ${selectedLine?.name || 'Repertoire Line'}`}
      />
    </div>
  );
};
