import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Chess, type Square } from 'chess.js';
import { DojoBoard } from '../board/DojoBoard';
import {
  analyzePgnGame,
  type GameReviewReport,
  type AnalyzedMove,
  type MoveClassification
} from '../../services/gameReviewService';
import { engine } from '../../services/engine';
import { db, type SavedGame, type UserProfile, updateUserProfile, getUserProfile, bumpDailyActivity } from '../../db';
import { GeminiCoachModal } from '../common/GeminiCoachModal';
import { sound } from '../../services/sound';
import {
  Search,
  Zap,
  Sparkles,
  RotateCcw,
  Play,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Award,
  ChevronLeft,
  ChevronRight,
  FileText,
  BarChart2,
  Clock,
  Eye,
  Sliders,
  Check
} from 'lucide-react';

interface GameReviewViewProps {
  userProfile: UserProfile;
  initialPgn?: string;
  initialUserColor?: 'white' | 'black';
  onRefreshProfile?: () => void;
}

// Famous instructive martial game for instant testing
const DEFAULT_SAMPLE_PGN = `1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. b4 Bxb4 5. c3 Ba5 6. d4 exd4 7. O-O d3 8. Qb3 Qf6 9. e5 Qg6 10. Re1 Nge7 11. Ba3 b5 12. Qxb5 Rb8 13. Qa4 Bb6 14. Nbd2 Bb7 15. Ne4 Qf5 16. Bxd3 Qh5 17. Nf6+ gxf6 18. exf6 Rg8 19. Rad1 Qxf3 20. Rxe7+ Nxe7 21. Qxd7+ Kxd7 22. Bf5+ Ke8 23. Bd7+ Kf8 24. Bxe7# 1-0`;

export const GameReviewView: React.FC<GameReviewViewProps> = ({
  userProfile,
  initialPgn,
  initialUserColor,
  onRefreshProfile,
}) => {
  const [pgnInput, setPgnInput] = useState<string>(initialPgn || DEFAULT_SAMPLE_PGN);
  const [userColor, setUserColor] = useState<'white' | 'black' | undefined>(initialPgn ? initialUserColor : undefined);
  const [selectedSavedId, setSelectedSavedId] = useState<number | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const cancelledRef = useRef<boolean>(false);
  const [depth, setDepth] = useState<number>(14);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [progressCurrentMove, setProgressCurrentMove] = useState<string>('');

  const [savedGamesList, setSavedGamesList] = useState<SavedGame[]>([]);
  const [report, setReport] = useState<GameReviewReport | null>(null);
  const [selectedPly, setSelectedPly] = useState<number>(0); // 0 = start position, 1..N = after ply

  // Retry Key Moment state
  const [retryingMoment, setRetryingMoment] = useState<AnalyzedMove | null>(null);
  const [retryResult, setRetryResult] = useState<'pending' | 'success' | 'wrong'>('pending');

  // Gemini Sensei explanation modal
  const [explainModal, setExplainModal] = useState<{
    open: boolean;
    fen: string;
    move: string;
    lines?: Array<{ pvSan: string[]; eval: string }>;
  }>({ open: false, fen: '', move: '' });

  const fmtAcc = (v: number | null) => (v === null ? '—' : `${v}%`);

  // Load user's saved games from IndexedDB; stop any running analysis when leaving the screen
  useEffect(() => {
    const fetchSaved = async () => {
      const games = await db.savedGames.orderBy('createdAt').reverse().limit(20).toArray();
      setSavedGamesList(games);
    };
    fetchSaved();
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
      engine.cancelAnalysis();
    };
  }, []);

  // Run Game Review
  const handleStartReview = async (pgnToAnalyze: string = pgnInput) => {
    if (!pgnToAnalyze.trim()) return;

    setIsAnalyzing(true);
    setProgressPercent(0);
    setProgressCurrentMove('Starting Stockfish...');
    setReport(null);
    setReviewError(null);
    setSelectedPly(0);
    setRetryingMoment(null);

    try {
      const result = await analyzePgnGame(
        pgnToAnalyze,
        depth,
        (pct, move) => {
          if (cancelledRef.current) return;
          setProgressPercent(pct);
          setProgressCurrentMove(move);
        },
        { userColor, isCancelled: () => cancelledRef.current }
      );
      if (cancelledRef.current) return;

      setReport(result);
      setSelectedPly(0);
      sound.playSuccess();

      // Count distinct games only (reviewing the same game twice doesn't count twice)
      const profile = await getUserProfile();
      if (!profile.reviewedGameKeys.includes(result.gameKey) && result.moves.length >= 10) {
        const keys = [...profile.reviewedGameKeys, result.gameKey];
        await updateUserProfile({ reviewedGameKeys: keys, gamesReviewedCount: keys.length });
      }
      if (result.userColor) {
        const acc = result.userColor === 'white' ? result.whiteAccuracy : result.blackAccuracy;
        const opponent = result.userColor === 'white' ? result.black : result.white;
        const fresh = await getUserProfile();
        const history = [
          ...fresh.reviewHistory.filter((h) => h.key !== result.gameKey),
          { key: result.gameKey, date: new Date().toISOString().slice(0, 10), accuracy: acc, color: result.userColor, opponent },
        ].slice(-30);
        await updateUserProfile({ reviewHistory: history });
      }
      await bumpDailyActivity('gamesReviewed');
      if (selectedSavedId !== null) await db.savedGames.update(selectedSavedId, { reviewed: true });
      if (onRefreshProfile) onRefreshProfile();
    } catch (err: any) {
      if (err?.message === 'cancelled') return;
      console.error('Review error:', err);
      setReviewError(err?.message || 'Error analyzing PGN');
    } finally {
      if (!cancelledRef.current) setIsAnalyzing(false);
    }
  };

  // Current active board position based on selectedPly
  const currentMoveData = useMemo(() => {
    if (!report || selectedPly === 0) return null;
    return report.moves[selectedPly - 1] || null;
  }, [report, selectedPly]);

  const currentBoardFen = useMemo(() => {
    if (retryingMoment) {
      return retryingMoment.fenBefore;
    }
    if (!report) {
      return new Chess().fen();
    }
    if (selectedPly === 0) {
      return report.moves[0]?.fenBefore || new Chess().fen();
    }
    const move = report.moves[selectedPly - 1];
    return move ? move.fenAfter : new Chess().fen();
  }, [report, selectedPly, retryingMoment]);

  const boardOrientation: 'white' | 'black' = report?.userColor || userColor || 'white';

  // Every retried key moment goes into My Mistakes (spaced repetition), once per position
  const addToMistakes = async (m: AnalyzedMove) => {
    const exists = await db.myMistakes.filter((x) => x.fen === m.fenBefore).count();
    if (exists) return;
    await db.myMistakes.add({
      fen: m.fenBefore,
      correctMove: m.bestEngineMove,
      mistakeMove: m.uci,
      intervalDays: 1,
      nextReviewDate: Date.now() + 24 * 60 * 60 * 1000,
      reviewsCount: 0,
      lastReviewedAt: Date.now(),
    });
  };

  // Handle retry move in Key Moment: the best move (or an equally good second choice) passes
  const handleRetryMove = async (uci: string) => {
    if (!retryingMoment || retryResult === 'success') return false;
    const ok =
      uci === retryingMoment.bestEngineMove ||
      (uci === retryingMoment.secondBestMove && (retryingMoment.secondBestGap ?? 1) <= 0.03);
    await addToMistakes(retryingMoment);
    if (ok) {
      setRetryResult('success');
      sound.playSuccess();
      return true;
    }
    setRetryResult('wrong');
    sound.playError();
    return false;
  };

  // Classification styling badge helper
  const getBadgeStyle = (cls: MoveClassification) => {
    switch (cls) {
      case 'brilliant':
        return { label: 'Brilliant', bg: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40', icon: '!!' };
      case 'great':
        return { label: 'Great', bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40', icon: '!' };
      case 'best':
        return { label: 'Best', bg: 'bg-emerald-600/20 text-emerald-300 border-emerald-600/30', icon: '★' };
      case 'excellent':
        return { label: 'Excellent', bg: 'bg-teal-500/20 text-teal-300 border-teal-500/30', icon: '✓' };
      case 'good':
        return { label: 'Good', bg: 'bg-stone-700/40 text-stone-300 border-stone-600/30', icon: '—' };
      case 'book':
        return { label: 'Book', bg: 'bg-amber-600/20 text-amber-300 border-amber-600/30', icon: '📖' };
      case 'inaccuracy':
        return { label: 'Inaccuracy', bg: 'bg-amber-500/20 text-amber-400 border-amber-500/40', icon: '?!' };
      case 'mistake':
        return { label: 'Mistake', bg: 'bg-orange-500/20 text-orange-400 border-orange-500/40', icon: '?' };
      case 'blunder':
        return { label: 'Blunder', bg: 'bg-red-500/20 text-red-400 border-red-500/40', icon: '??' };
      case 'miss':
        return { label: 'Miss', bg: 'bg-pink-500/20 text-pink-400 border-pink-500/40', icon: '✕' };
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold tracking-widest uppercase">
          <Search className="w-3.5 h-3.5" />
          Full-Game Stockfish Review & Key Moments
        </div>
        <h1 className="text-3xl font-serif font-black text-stone-100 tracking-tight">
          Game Review Sanctuary
        </h1>
        <p className="text-stone-400 text-xs sm:text-sm max-w-lg mx-auto">
          Deep Stockfish analysis with mathematical Expected Points (EP), move classifications, accuracy metrics, and Sensei explanations.
        </p>
      </div>

      {/* Input / Saved Games Card */}
      {!report && !isAnalyzing && (
        <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-xl max-w-3xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-serif font-bold text-stone-100 text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-500" />
              <span>Input Game PGN</span>
            </h3>

            {savedGamesList.length > 0 && (
              <select
                onChange={(e) => {
                  const g = savedGamesList.find((x) => x.id === Number(e.target.value));
                  if (g) {
                    setPgnInput(g.pgn);
                    setUserColor(g.userColor);
                    setSelectedSavedId(g.id ?? null);
                  }
                }}
                className="bg-stone-950 border border-stone-800 text-stone-300 rounded-xl px-3 py-1.5 text-xs font-mono"
              >
                <option value="">Load From Saved Games ({savedGamesList.length})</option>
                {savedGamesList.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.date} vs {g.userColor === 'white' ? g.black : g.white} ({g.result}, {g.movesCount} moves){g.reviewed ? ' ✓' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          <textarea
            value={pgnInput}
            onChange={(e) => {
              setPgnInput(e.target.value);
              setSelectedSavedId(null);
            }}
            rows={5}
            placeholder="Paste PGN here (e.g. 1. e4 e5 2. Nf3...)"
            className="w-full bg-stone-950/80 border border-stone-800 rounded-2xl p-4 text-xs font-mono text-stone-200 focus:border-amber-500/60 focus:outline-hidden transition-all"
          />

          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-400">
            <span>I played:</span>
            {(['white', 'black'] as const).map((c) => (
              <button
                key={c}
                onClick={() => setUserColor(userColor === c ? undefined : c)}
                className={`py-1 px-2.5 rounded-lg font-bold capitalize ${userColor === c ? 'bg-amber-500 text-stone-950' : 'bg-stone-800 text-stone-300'}`}
              >
                {c}
              </button>
            ))}
            <span className="text-stone-500">(optional: flips the board and focuses key moments on your moves)</span>
          </div>

          {reviewError && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/40 text-red-300 text-xs">{reviewError}</div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <div className="flex items-center gap-3">
              <span className="text-xs text-stone-400">Stockfish Depth:</span>
              <div className="flex gap-1.5">
                {[10, 12, 14, 16, 18].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDepth(d)}
                    className={`py-1 px-2.5 rounded-lg text-xs font-mono font-bold transition-all ${
                      depth === d
                        ? 'bg-amber-500 text-stone-950 shadow-md'
                        : 'bg-stone-800 text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setPgnInput(DEFAULT_SAMPLE_PGN);
                  setUserColor(undefined);
                  setSelectedSavedId(null);
                }}
                className="py-2.5 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold transition-all"
              >
                Instructive Sample Game
              </button>
              <button
                onClick={() => handleStartReview(pgnInput)}
                className="py-2.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-serif font-black text-xs uppercase tracking-wider transition-all shadow-xl active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Start Review</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Analysis Progress Bar */}
      {isAnalyzing && (
        <div className="bg-stone-900 border border-stone-800 rounded-3xl p-8 max-w-xl mx-auto shadow-2xl text-center space-y-5 animate-scaleUp">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 mx-auto text-2xl font-serif animate-spin">
            ⚙️
          </div>
          <div>
            <h3 className="font-serif font-bold text-xl text-stone-100 mb-1">
              Stockfish Analyzing Every Position
            </h3>
            <p className="text-xs text-stone-400 font-mono">
              Analyzing at depth {depth} MultiPV 2 • {progressCurrentMove}
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="w-full bg-stone-950 h-3 rounded-full overflow-hidden border border-stone-800">
              <div
                className="bg-amber-500 h-full transition-all duration-300 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] font-mono text-stone-500">
              <span>Evaluating win chance wp(cp)</span>
              <span>{progressPercent}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Full Analysis Review Dashboard */}
      {report && (
        <div className="space-y-8 animate-fadeIn">
          {/* Top Review Bar: Accuracies & Phase Breakdown */}
          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-2xl grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
            {/* White Accuracy */}
            <div className="text-center p-4 rounded-2xl bg-stone-950 border border-stone-800/80">
              <div className="text-[10px] uppercase font-bold text-stone-500 mb-1 truncate" title={report.white}>White Accuracy · {report.white}</div>
              <div className="font-mono font-black text-4xl text-stone-100">{report.whiteAccuracy}%</div>
              <div className="text-[10px] text-stone-400 mt-1">
                Open: {fmtAcc(report.openingAccuracy.white)} • Mid: {fmtAcc(report.middlegameAccuracy.white)} • End: {fmtAcc(report.endgameAccuracy.white)}
              </div>
            </div>

            {/* Black Accuracy */}
            <div className="text-center p-4 rounded-2xl bg-stone-950 border border-stone-800/80">
              <div className="text-[10px] uppercase font-bold text-stone-500 mb-1 truncate" title={report.black}>Black Accuracy · {report.black}</div>
              <div className="font-mono font-black text-4xl text-stone-100">{report.blackAccuracy}%</div>
              <div className="text-[10px] text-stone-400 mt-1">
                Open: {fmtAcc(report.openingAccuracy.black)} • Mid: {fmtAcc(report.middlegameAccuracy.black)} • End: {fmtAcc(report.endgameAccuracy.black)}
              </div>
            </div>

            {/* Classification Summary Table */}
            <div className="md:col-span-2 grid grid-cols-5 gap-2 text-center text-xs">
              {(
                [
                  'brilliant',
                  'great',
                  'best',
                  'excellent',
                  'good',
                  'book',
                  'inaccuracy',
                  'mistake',
                  'blunder',
                  'miss',
                ] as MoveClassification[]
              ).map((cls) => {
                const badge = getBadgeStyle(cls);
                const wCount = report.classificationCounts.white[cls] || 0;
                const bCount = report.classificationCounts.black[cls] || 0;
                return (
                  <div key={cls} className="p-2 rounded-xl bg-stone-950/60 border border-stone-800/60">
                    <div className="text-[10px] font-bold text-stone-400 truncate">{badge.label}</div>
                    <div className="font-mono font-bold text-xs text-stone-200 mt-0.5">
                      <span className="text-amber-400">{wCount}</span> / <span className="text-stone-400">{bCount}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Interactive Board, Eval Bar & Move Explorer */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left: The Board & Eval Bar */}
            <div className="lg:col-span-7 flex flex-col items-center">
              {/* Eval Bar Header */}
              <div className="w-full max-w-[560px] flex items-center justify-between bg-stone-900 border border-stone-800 rounded-t-xl px-4 py-2.5 mb-2 shadow-md">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-stone-200">
                    {currentMoveData ? `${currentMoveData.moveNumber}${currentMoveData.turn === 'w' ? '.' : '...'} ${currentMoveData.san}` : 'Starting Position'}
                  </span>
                  {currentMoveData && (
                    <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider ${getBadgeStyle(currentMoveData.classification).bg}`}>
                      {getBadgeStyle(currentMoveData.classification).label}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 font-mono text-xs" title="Stockfish evaluation from White's point of view">
                  <span className="text-stone-400">Eval (White):</span>
                  <span className="font-bold text-amber-400">
                    {currentMoveData?.evalFormatted || report.evalHistory[0] && (report.evalHistory[0].evalCp / 100).toFixed(1)}
                  </span>
                </div>
              </div>

              {report.openingName && (
                <div className="w-full max-w-[560px] text-[11px] text-stone-400 mb-2 px-1">
                  Opening: <span className="text-amber-300 font-semibold">{report.openingName}</span>
                </div>
              )}

              {retryingMoment && (
                <div className={`w-full max-w-[560px] mb-2 p-3 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-2 ${
                  retryResult === 'success'
                    ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                    : retryResult === 'wrong'
                      ? 'bg-red-950/40 border-red-500/50 text-red-300'
                      : 'bg-amber-950/40 border-amber-500/50 text-amber-200'
                }`}>
                  <span className="font-semibold">
                    {retryResult === 'success'
                      ? `Correct! ${retryingMoment.bestEngineSan || ''} was the move. Saved to My Mistakes for review.`
                      : retryResult === 'wrong'
                        ? `Not quite. Try again, or reveal the answer. (You played ${retryingMoment.san} in the game.)`
                        : `Retry: ${retryingMoment.turn === 'w' ? 'White' : 'Black'} to move. Find a better move than ${retryingMoment.san}.`}
                  </span>
                  <span className="flex gap-1.5">
                    {retryResult !== 'success' && (
                      <button
                        onClick={() => setRetryResult('success')}
                        className="py-1 px-2 rounded-lg bg-stone-800 text-stone-200 font-bold"
                      >
                        Show answer
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setRetryingMoment(null);
                        setRetryResult('pending');
                      }}
                      className="py-1 px-2 rounded-lg bg-stone-800 text-stone-200 font-bold"
                    >
                      Exit retry
                    </button>
                  </span>
                </div>
              )}

              {/* Board */}
              <DojoBoard
                fen={currentBoardFen}
                orientation={boardOrientation}
                interactive={!!retryingMoment && retryResult !== 'success'}
                arrows={
                  retryingMoment && retryResult === 'success'
                    ? [[retryingMoment.bestEngineMove.slice(0, 2) as Square, retryingMoment.bestEngineMove.slice(2, 4) as Square, 'rgb(34, 197, 94)']]
                    : []
                }
                onMove={handleRetryMove}
                boardTheme={userProfile.settings.boardTheme}
                lastMove={
                  currentMoveData && !retryingMoment
                    ? {
                        from: currentMoveData.uci.slice(0, 2) as Square,
                        to: currentMoveData.uci.slice(2, 4) as Square,
                      }
                    : null
                }
              />

              {/* Navigation controls underneath board */}
              <div className="w-full max-w-[560px] flex items-center justify-between bg-stone-900 border border-stone-800 rounded-b-xl px-4 py-2 mt-2 shadow-md">
                <div className="flex gap-1">
                  <button
                    onClick={() => { setRetryingMoment(null); setSelectedPly(0); }}
                    disabled={selectedPly === 0}
                    className="p-1.5 rounded-lg bg-stone-800 text-stone-300 hover:bg-stone-700 disabled:opacity-30"
                  >
                    |◀
                  </button>
                  <button
                    onClick={() => { setRetryingMoment(null); setSelectedPly((p) => Math.max(0, p - 1)); }}
                    disabled={selectedPly === 0}
                    className="p-1.5 rounded-lg bg-stone-800 text-stone-300 hover:bg-stone-700 disabled:opacity-30"
                  >
                    ◀
                  </button>
                  <button
                    onClick={() => { setRetryingMoment(null); setSelectedPly((p) => Math.min(report.moves.length, p + 1)); }}
                    disabled={selectedPly >= report.moves.length}
                    className="p-1.5 rounded-lg bg-stone-800 text-stone-300 hover:bg-stone-700 disabled:opacity-30"
                  >
                    ▶
                  </button>
                  <button
                    onClick={() => { setRetryingMoment(null); setSelectedPly(report.moves.length); }}
                    disabled={selectedPly >= report.moves.length}
                    className="p-1.5 rounded-lg bg-stone-800 text-stone-300 hover:bg-stone-700 disabled:opacity-30"
                  >
                    ▶|
                  </button>
                </div>

                {/* Move details */}
                {currentMoveData && (
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-stone-400">
                      Best: <span className="font-mono text-emerald-400 font-bold">{currentMoveData.bestEngineSan || currentMoveData.bestEngineMove}</span>
                    </span>
                    <button
                      onClick={() => {
                        setExplainModal({
                          open: true,
                          fen: currentMoveData.fenBefore,
                          move: currentMoveData.san,
                          lines: currentMoveData.bestLinesBefore,
                        });
                      }}
                      className="py-1 px-2.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-300 font-bold text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Explain</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Clickable SVG Eval Graph & Key Moments */}
            <div className="lg:col-span-5 space-y-6">
              {/* Clickable Eval Graph */}
              <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-xl space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-stone-300">
                  <span className="flex items-center gap-1.5">
                    <BarChart2 className="w-4 h-4 text-amber-500" />
                    Eval Graph (white area = White's winning chances)
                  </span>
                  <span className="text-[10px] text-stone-500">Click anywhere to jump to move</span>
                </div>

                <div className="h-24 w-full bg-stone-950 rounded-xl relative overflow-hidden border border-stone-800 flex items-center">
                  <div className="absolute inset-x-0 top-1/2 border-b border-stone-800 border-dashed" />
                  <svg className="w-full h-full cursor-pointer" preserveAspectRatio="none" viewBox={`0 0 ${Math.max(1, report.evalHistory.length - 1)} 100`}>
                    <polygon
                      fill="rgba(245, 245, 244, 0.85)"
                      points={`0,100 ${report.evalHistory.map((pt) => `${pt.ply},${100 - pt.wpWhite}`).join(' ')} ${report.evalHistory.length - 1},100`}
                    />
                    <polyline
                      fill="none"
                      stroke="#F59E0B"
                      strokeWidth="1.5"
                      vectorEffect="non-scaling-stroke"
                      points={report.evalHistory.map((pt) => `${pt.ply},${100 - pt.wpWhite}`).join(' ')}
                    />
                    <line
                      x1={selectedPly}
                      x2={selectedPly}
                      y1={0}
                      y2={100}
                      stroke="#EF4444"
                      strokeWidth="1.5"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                  {/* Invisible click overlay */}
                  <div
                    className="absolute inset-0 cursor-pointer"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = e.clientX - rect.left;
                      const fraction = x / rect.width;
                      const targetPly = Math.min(
                        report.moves.length,
                        Math.max(0, Math.round(fraction * report.moves.length))
                      );
                      setSelectedPly(targetPly);
                    }}
                  />
                </div>
              </div>

              {/* 3 Key Moments */}
              <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-xl space-y-4">
                <h4 className="font-serif font-bold text-stone-100 text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span>Key Turning Points ({report.keyMoments.length})</span>
                </h4>

                {report.keyMoments.length === 0 ? (
                  <p className="text-xs text-stone-400 italic">No significant tactical blunders detected!</p>
                ) : (
                  <div className="space-y-3">
                    {report.keyMoments.map((moment, idx) => {
                      const badge = getBadgeStyle(moment.classification);
                      const isSelected = selectedPly === moment.ply;

                      return (
                        <div
                          key={idx}
                          className={`p-3.5 rounded-xl border transition-all space-y-2 ${
                            isSelected
                              ? 'bg-amber-950/40 border-amber-500'
                              : 'bg-stone-950/60 border-stone-800 hover:border-stone-700'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-stone-200">
                                {moment.moveNumber}{moment.turn === 'w' ? '.' : '...'} {moment.san}
                              </span>
                              <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${badge.bg}`}>
                                {badge.label}
                              </span>
                            </div>

                            <span className="font-mono text-red-400 font-bold text-[11px]" title="Drop in winning chances caused by this move">
                              −{(moment.expectedPointsLost * 100).toFixed(0)}% win chance
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-xs pt-1">
                            <span className="text-[11px] text-stone-400">
                              Best move: <strong className="font-mono text-emerald-400">{moment.bestEngineSan || moment.bestEngineMove}</strong>
                            </span>

                            <div className="flex gap-1.5">
                              <button
                                onClick={() => {
                                  setSelectedPly(moment.ply);
                                  setRetryingMoment(moment);
                                  setRetryResult('pending');
                                }}
                                className="py-1 px-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold transition-all"
                              >
                                Retry
                              </button>
                              <button
                                onClick={() => {
                                  setExplainModal({
                                    open: true,
                                    fen: moment.fenBefore,
                                    move: moment.san,
                                    lines: moment.bestLinesBefore,
                                  });
                                }}
                                className="py-1 px-2 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 text-xs font-bold border border-amber-500/30"
                              >
                                Explain
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Move List Log */}
              <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-xl">
                <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">
                  Annotated Move Record
                </h4>
                <div className="max-h-56 overflow-y-auto space-y-1 font-mono text-xs pr-2">
                  {Array.from({ length: Math.ceil(report.moves.length / 2) }).map((_, i) => {
                    const wMove = report.moves[i * 2];
                    const bMove = report.moves[i * 2 + 1];

                    return (
                      <div
                        key={i}
                        className="grid grid-cols-7 py-1 px-2 rounded hover:bg-stone-800/50 text-stone-300 text-[11px]"
                      >
                        <span className="col-span-1 text-stone-500 font-bold">{i + 1}.</span>

                        {wMove ? (
                          <span
                            onClick={() => { setRetryingMoment(null); setSelectedPly(wMove.ply); }}
                            className={`col-span-3 cursor-pointer flex items-center gap-1 ${
                              selectedPly === wMove.ply ? 'text-amber-400 font-bold' : 'text-stone-200'
                            }`}
                          >
                            <span>{wMove.san}</span>
                            <span className="text-[10px] text-stone-500">
                              {getBadgeStyle(wMove.classification).icon}
                            </span>
                          </span>
                        ) : (
                          <span className="col-span-3" />
                        )}

                        {bMove ? (
                          <span
                            onClick={() => { setRetryingMoment(null); setSelectedPly(bMove.ply); }}
                            className={`col-span-3 cursor-pointer flex items-center gap-1 ${
                              selectedPly === bMove.ply ? 'text-amber-400 font-bold' : 'text-stone-300'
                            }`}
                          >
                            <span>{bMove.san}</span>
                            <span className="text-[10px] text-stone-500">
                              {getBadgeStyle(bMove.classification).icon}
                            </span>
                          </span>
                        ) : (
                          <span className="col-span-3" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Start new review button */}
              <button
                onClick={() => setReport(null)}
                className="w-full py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-400 hover:text-stone-200 text-xs font-bold transition-all"
              >
                Review Another Game
              </button>
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
        groundingLines={explainModal.lines}
        userLevel={userProfile.currentLevel}
        context="Game review: explain why the move played was good or bad compared with the engine's best line"
      />
    </div>
  );
};
