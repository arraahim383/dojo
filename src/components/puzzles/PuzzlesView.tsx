import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Chess, type Square } from 'chess.js';
import { DojoBoard } from '../board/DojoBoard';
import { puzzleService, LOCAL_THEMES, NoPuzzlesError, primaryTheme, type ActivePuzzle } from '../../services/puzzleService';
import { THEME_LABELS } from '../../services/puzzleThemes';
import { db, getUserProfile, updateUserProfile, bumpDailyActivity, todayKey, type UserProfile, type MyMistakeItem } from '../../db';
import { sound } from '../../services/sound';
import { GeminiCoachModal } from '../common/GeminiCoachModal';
import {
  Flame,
  Award,
  Zap,
  Calendar,
  Grid,
  FileSpreadsheet,
  RotateCcw,
  Sparkles,
  Lightbulb,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Loader2,
  Ghost,
  BookmarkCheck,
  ExternalLink,
} from 'lucide-react';

interface PuzzlesViewProps {
  userProfile: UserProfile;
  onRefreshProfile: () => void;
}

type PuzzleMode = 'rated' | 'rush' | 'survival' | 'battle' | 'daily' | 'themes' | 'mistakes';

const RUSH_SECONDS = 300;
const rushTarget = (score: number) => Math.min(2200, 450 + score * 60);

export const PuzzlesView: React.FC<PuzzlesViewProps> = ({ userProfile, onRefreshProfile }) => {
  const [mode, setMode] = useState<PuzzleMode>('rated');
  const [activePuzzle, setActivePuzzle] = useState<ActivePuzzle | null>(null);
  const [boardFen, setBoardFen] = useState<string>(new Chess().fen());
  const [solutionStep, setSolutionStep] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bundlePct, setBundlePct] = useState<number>(puzzleService.bundleProgress);
  const [isOpponentMoving, setIsOpponentMoving] = useState<boolean>(false);

  const [status, setStatus] = useState<'solving' | 'correct' | 'failed'>('solving');
  const [ratingDelta, setRatingDelta] = useState<number | null>(null);
  const [usedHint, setUsedHint] = useState<boolean>(false);
  const [practiceRetry, setPracticeRetry] = useState<boolean>(false); // retry after a fail: no rating change
  const [hintArrow, setHintArrow] = useState<Array<[Square, Square, string?]>>([]);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const resultRecordedRef = useRef<boolean>(false);

  // Rush / Survival / Battle
  const [rushScore, setRushScore] = useState<number>(0);
  const rushScoreRef = useRef<number>(0);
  const [rushStrikes, setRushStrikes] = useState<number>(0);
  const [rushTimeRemaining, setRushTimeRemaining] = useState<number>(RUSH_SECONDS);
  const [rushActive, setRushActive] = useState<boolean>(false);
  const [rushFinal, setRushFinal] = useState<number | null>(null);
  const rushActiveRef = useRef<boolean>(false);
  const rushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const modeRef = useRef<PuzzleMode>(mode);
  modeRef.current = mode;

  // My Mistakes
  const [currentMistake, setCurrentMistake] = useState<MyMistakeItem | null>(null);
  const [dueCount, setDueCount] = useState<number>(0);

  // Themes
  const [selectedTheme, setSelectedTheme] = useState<string>('fork');

  // CSV import
  const [showCsvModal, setShowCsvModal] = useState<boolean>(false);
  const [csvImportProgress, setCsvImportProgress] = useState<number | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);

  const [explainModal, setExplainModal] = useState<{ open: boolean; fen: string; move: string }>({ open: false, fen: '', move: '' });

  const [ratedPacing, setRatedPacing] = useState<'ramp' | 'matched' | 'hard'>('matched');
  const [themeLevel, setThemeLevel] = useState<'mine' | 'easier' | 'harder'>('mine');

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    puzzleService.ensureBundledPuzzles(setBundlePct).catch((e) => setLoadError(e.message));
    return () => {
      mountedRef.current = false;
      if (rushTimerRef.current) clearInterval(rushTimerRef.current);
    };
  }, []);

  const getDifficultyTierBadge = (rating: number) => {
    if (rating < 800) return { label: 'Beginner', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
    if (rating < 1200) return { label: 'Novice', color: 'bg-teal-500/20 text-teal-400 border-teal-500/30' };
    if (rating < 1600) return { label: 'Intermediate', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
    if (rating < 2000) return { label: 'Advanced', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' };
    return { label: 'Expert', color: 'bg-rose-500/20 text-rose-400 border-rose-500/30' };
  };

  const showPuzzle = (p: ActivePuzzle) => {
    setActivePuzzle(p);
    setBoardFen(p.fen);
    setSolutionStep(0);
    setStatus('solving');
    setRatingDelta(null);
    setUsedHint(false);
    setPracticeRetry(false);
    setHintArrow([]);
    resultRecordedRef.current = false;
    setLastMove(p.lastMoveUci ? { from: p.lastMoveUci.slice(0, 2) as Square, to: p.lastMoveUci.slice(2, 4) as Square } : null);
  };

  const loadPuzzle = useCallback(
    async (targetMode: PuzzleMode = mode, customRating?: number) => {
      setLoading(true);
      setLoadError(null);
      try {
        if (targetMode === 'mistakes') {
          const all = await db.myMistakes.toArray();
          const due = all.filter((m) => m.nextReviewDate <= Date.now()).sort((a, b) => a.nextReviewDate - b.nextReviewDate);
          setDueCount(due.length);
          const item = due[0] || null;
          setCurrentMistake(item);
          if (item) {
            showPuzzle({
              id: `mistake_${item.id}`,
              source: 'mistake',
              fen: item.fen,
              solution: [item.correctMove],
              rating: userProfile.puzzleRating,
              themes: ['mistakeReview'],
              description: 'A position from one of your games. Find the move you missed.',
            });
          } else {
            setActivePuzzle(null);
          }
          return;
        }

        let target = customRating ?? userProfile.puzzleRating;
        if (targetMode === 'rated' && customRating === undefined) {
          target = ratedPacing === 'ramp' ? userProfile.puzzleRating - 150 : ratedPacing === 'hard' ? userProfile.puzzleRating + 150 : userProfile.puzzleRating;
        }
        if (targetMode === 'themes' && customRating === undefined) {
          target = themeLevel === 'easier' ? userProfile.puzzleRating - 250 : themeLevel === 'harder' ? userProfile.puzzleRating + 250 : userProfile.puzzleRating;
        }
        const p = await puzzleService.getNextPuzzle({
          mode: targetMode === 'battle' ? 'rush' : (targetMode as 'rated' | 'rush' | 'survival' | 'daily' | 'themes'),
          targetRating: Math.max(400, target),
          theme: targetMode === 'themes' ? selectedTheme : undefined,
        });
        if (!mountedRef.current) return;
        showPuzzle(p);
      } catch (err: any) {
        console.error('Failed to load puzzle', err);
        setActivePuzzle(null);
        setLoadError(err instanceof NoPuzzlesError ? err.message : `Could not load a puzzle: ${err?.message || err}`);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    },
    [mode, userProfile.puzzleRating, selectedTheme, ratedPacing, themeLevel]
  );

  // Load when the mode/theme/pacing changes (timed modes start from their launch card)
  useEffect(() => {
    if (mode === 'rush' || mode === 'survival' || mode === 'battle') {
      setActivePuzzle(null);
      setLoading(false);
      return;
    }
    loadPuzzle(mode);
  }, [mode, selectedTheme, ratedPacing, themeLevel]);

  // ---------- Timed modes ----------
  const stopRushTimer = () => {
    if (rushTimerRef.current) clearInterval(rushTimerRef.current);
    rushTimerRef.current = null;
  };

  const handleRushGameOver = async () => {
    if (!rushActiveRef.current) return;
    rushActiveRef.current = false;
    setRushActive(false);
    stopRushTimer();
    const score = rushScoreRef.current; // ref: always the latest score, even from the timer
    setRushFinal(score);
    const profile = await getUserProfile();
    const m = modeRef.current;
    if ((m === 'rush' || m === 'battle') && score > profile.rushBestScore) await updateUserProfile({ rushBestScore: score });
    if (m === 'survival' && score > profile.survivalBestScore) await updateUserProfile({ survivalBestScore: score });
    onRefreshProfile();
  };

  const startTimed = (m: 'rush' | 'battle' | 'survival') => {
    rushScoreRef.current = 0;
    setRushScore(0);
    setRushStrikes(0);
    setRushFinal(null);
    setRushTimeRemaining(RUSH_SECONDS);
    rushActiveRef.current = true;
    setRushActive(true);
    stopRushTimer();
    if (m !== 'survival') {
      rushTimerRef.current = setInterval(() => {
        setRushTimeRemaining((prev) => {
          if (prev <= 1) {
            handleRushGameOver();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    loadPuzzle(m, rushTarget(0));
  };

  // Ghost pace (your best Rush score spread evenly over the 5 minutes)
  const ghostTarget = Math.max(userProfile.rushBestScore, 5);
  const ghostScore = Math.min(ghostTarget, Math.floor(((RUSH_SECONDS - rushTimeRemaining) / RUSH_SECONDS) * ghostTarget));

  // ---------- Results ----------
  const recordResult = async (solved: boolean) => {
    if (!activePuzzle || resultRecordedRef.current) return;
    resultRecordedRef.current = true;
    if (activePuzzle.source !== 'mistake') await puzzleService.markSeen(activePuzzle.id);

    if (mode === 'rated' && !practiceRetry) {
      const win = solved && !usedHint;
      const profile = await getUserProfile();
      const delta = puzzleService.calculateEloDelta(profile.puzzleRating, activePuzzle.rating, win, profile.ratedPuzzlesPlayed);
      setRatingDelta(delta);
      const newRating = Math.max(100, profile.puzzleRating + delta);
      await updateUserProfile({ puzzleRating: newRating, ratedPuzzlesPlayed: profile.ratedPuzzlesPlayed + 1 });
      await db.puzzleHistory.add({
        puzzleId: activePuzzle.id,
        mode: 'rated',
        result: win ? 'win' : 'loss',
        userRatingBefore: profile.puzzleRating,
        userRatingAfter: newRating,
        puzzleRating: activePuzzle.rating,
        playedAt: Date.now(),
        usedHint,
        theme: primaryTheme(activePuzzle.themes),
        themes: activePuzzle.themes,
      });
      await bumpDailyActivity('ratedPuzzles');
      onRefreshProfile();
    } else if (mode === 'themes' && !practiceRetry) {
      await db.puzzleHistory.add({
        puzzleId: activePuzzle.id,
        mode: 'themes',
        result: solved && !usedHint ? 'win' : 'loss',
        userRatingBefore: userProfile.puzzleRating,
        userRatingAfter: userProfile.puzzleRating,
        puzzleRating: activePuzzle.rating,
        playedAt: Date.now(),
        usedHint,
        theme: primaryTheme(activePuzzle.themes),
        themes: activePuzzle.themes,
      });
      if (solved) await bumpDailyActivity('themePuzzles');
    } else if (mode === 'daily' && solved) {
      const profile = await getUserProfile();
      const today = todayKey();
      if (profile.lastDailyDate !== today) {
        const yesterday = todayKey(new Date(Date.now() - 86_400_000));
        await updateUserProfile({ dailyStreak: profile.lastDailyDate === yesterday ? profile.dailyStreak + 1 : 1, lastDailyDate: today });
        onRefreshProfile();
      }
    } else if (mode === 'mistakes' && currentMistake?.id) {
      const next = solved ? (currentMistake.intervalDays === 1 ? 3 : currentMistake.intervalDays === 3 ? 7 : 21) : 1;
      await db.myMistakes.update(currentMistake.id, {
        intervalDays: next,
        nextReviewDate: Date.now() + next * 86_400_000,
        reviewsCount: currentMistake.reviewsCount + 1,
        lastReviewedAt: Date.now(),
      });
      await bumpDailyActivity('mistakesReviewed');
    }
  };

  const handleUserMove = async (uci: string): Promise<boolean> => {
    if (!activePuzzle || status !== 'solving' || isOpponentMoving) return false;
    const isTimed = mode === 'rush' || mode === 'survival' || mode === 'battle';
    if (isTimed && !rushActiveRef.current) return false;

    const expected = activePuzzle.solution[solutionStep];
    const isFinal = solutionStep >= activePuzzle.solution.length - 1;
    const ok = puzzleService.isMoveCorrect(boardFen, uci, expected, isFinal);

    if (!ok) {
      setStatus('failed');
      sound.playError();
      // show the correct move
      if (expected) setHintArrow([[expected.slice(0, 2) as Square, expected.slice(2, 4) as Square, 'rgba(34, 197, 94, 0.9)']]);
      await recordResult(false);
      if (isTimed) {
        const strikes = rushStrikes + 1;
        setRushStrikes(strikes);
        if (strikes >= 3) handleRushGameOver();
        else setTimeout(() => rushActiveRef.current && loadPuzzle(mode, rushTarget(rushScoreRef.current)), 900);
      }
      return false;
    }

    const c = new Chess(boardFen);
    c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || 'q' });
    setBoardFen(c.fen());
    setLastMove({ from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square });
    setHintArrow([]);

    const next = solutionStep + 1;
    if (next >= activePuzzle.solution.length || c.isCheckmate()) {
      setStatus('correct');
      sound.playSuccess();
      await recordResult(true);
      if (isTimed) {
        rushScoreRef.current += 1;
        setRushScore(rushScoreRef.current);
        setTimeout(() => rushActiveRef.current && loadPuzzle(mode, rushTarget(rushScoreRef.current)), 450);
      }
      return true;
    }

    // opponent reply
    const reply = activePuzzle.solution[next];
    setSolutionStep(next + 1);
    setIsOpponentMoving(true);
    setTimeout(() => {
      try {
        c.move({ from: reply.slice(0, 2), to: reply.slice(2, 4), promotion: reply[4] || 'q' });
        setBoardFen(c.fen());
        setLastMove({ from: reply.slice(0, 2) as Square, to: reply.slice(2, 4) as Square });
        sound.playMove();
      } finally {
        setIsOpponentMoving(false);
      }
    }, 450);
    return true;
  };

  const handleShowHint = () => {
    if (!activePuzzle || status !== 'solving') return;
    setUsedHint(true);
    const expected = activePuzzle.solution[solutionStep];
    if (expected) {
      setHintArrow([[expected.slice(0, 2) as Square, expected.slice(2, 4) as Square, 'rgba(234, 179, 8, 0.85)']]);
      sound.playWarning();
    }
  };

  const handleGiveUp = async () => {
    if (!activePuzzle) return;
    if (status === 'solving' && (mode === 'rated' || mode === 'themes')) {
      await recordResult(false);
    }
    loadPuzzle(mode);
  };

  const handleRetryPosition = () => {
    if (!activePuzzle) return;
    setPracticeRetry(true);
    setStatus('solving');
    setBoardFen(activePuzzle.fen);
    setSolutionStep(0);
    setHintArrow([]);
    setLastMove(activePuzzle.lastMoveUci ? { from: activePuzzle.lastMoveUci.slice(0, 2) as Square, to: activePuzzle.lastMoveUci.slice(2, 4) as Square } : null);
  };

  const handleCsvFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvError(null);
    setCsvImportProgress(0);
    try {
      const text = await file.text();
      const total = await puzzleService.importLichessCsv(text, (n) => setCsvImportProgress(n));
      setCsvImportProgress(total);
      setTimeout(() => {
        setShowCsvModal(false);
        setCsvImportProgress(null);
        loadPuzzle(mode);
      }, 1200);
    } catch (err: any) {
      setCsvError(err.message || 'Error importing CSV');
      setCsvImportProgress(null);
    }
  };

  const boardOrientation: 'white' | 'black' = activePuzzle ? (new Chess(activePuzzle.fen).turn() === 'w' ? 'white' : 'black') : 'white';
  const isTimedMode = mode === 'rush' || mode === 'survival' || mode === 'battle';
  const fmtClock = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const showBoard = !(isTimedMode && !rushActive);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Mode tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-stone-900 border border-stone-800 p-2 rounded-2xl shadow-md">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'rated', label: 'Rated', icon: Award },
            { id: 'rush', label: 'Rush', icon: Flame },
            { id: 'battle', label: 'Battle Ghost', icon: Ghost },
            { id: 'survival', label: 'Survival', icon: Zap },
            { id: 'daily', label: 'Daily', icon: Calendar },
            { id: 'themes', label: 'Themes', icon: Grid },
            { id: 'mistakes', label: 'My Mistakes', icon: BookmarkCheck },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => {
                if (rushActiveRef.current) {
                  rushActiveRef.current = false;
                  setRushActive(false);
                  stopRushTimer();
                }
                setRushFinal(null);
                setMode(id as PuzzleMode);
              }}
              className={`flex items-center gap-2 py-2 px-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                mode === id ? 'bg-amber-500 text-stone-950 shadow-md font-serif' : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowCsvModal(true)}
          className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 text-xs font-semibold transition-all cursor-pointer"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />
          <span>Import CSV</span>
        </button>
      </div>

      {mode === 'rated' && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-stone-900/80 border border-stone-800 px-4 py-3 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 text-xs">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="font-serif font-bold text-stone-200">Difficulty:</span>
            <span className="text-stone-400 text-[11px] hidden sm:inline">Puzzles are picked around your rating; a hint or wrong move counts as a loss.</span>
          </div>
          <div className="flex items-center gap-1.5">
            {[
              { id: 'ramp', label: 'Easier (−150)', on: 'bg-emerald-500' },
              { id: 'matched', label: `At my rating (${userProfile.puzzleRating})`, on: 'bg-amber-500' },
              { id: 'hard', label: 'Harder (+150)', on: 'bg-orange-500' },
            ].map((b) => (
              <button
                key={b.id}
                onClick={() => setRatedPacing(b.id as 'ramp' | 'matched' | 'hard')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${ratedPacing === b.id ? `${b.on} text-stone-950 font-bold shadow` : 'bg-stone-800 text-stone-300 hover:bg-stone-700'}`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === 'themes' && (
        <div className="bg-stone-900/80 border border-stone-800 px-4 py-3 rounded-2xl shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs">
              <Grid className="w-4 h-4 text-amber-400" />
              <span className="font-serif font-bold text-stone-200">Theme practice (unrated, hints free)</span>
            </div>
            <div className="flex items-center gap-1.5">
              {[
                { id: 'easier', label: 'Easier' },
                { id: 'mine', label: 'My level' },
                { id: 'harder', label: 'Harder' },
              ].map((b) => (
                <button
                  key={b.id}
                  onClick={() => setThemeLevel(b.id as 'mine' | 'easier' | 'harder')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${themeLevel === b.id ? 'bg-amber-500 text-stone-950' : 'bg-stone-800 text-stone-300 hover:bg-stone-700'}`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {LOCAL_THEMES.map((t) => (
              <button
                key={t}
                onClick={() => setSelectedTheme(t)}
                className={`py-1 px-2.5 rounded-lg text-xs font-medium transition-all ${selectedTheme === t ? 'bg-amber-500 text-stone-950 font-bold' : 'bg-stone-800 text-stone-300 hover:bg-stone-700'}`}
              >
                {THEME_LABELS[t] || t}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Board column */}
        <div className="lg:col-span-7 flex flex-col items-center">
          <div className="w-full max-w-[560px] flex items-center justify-between bg-stone-900 border border-stone-800 rounded-t-xl px-4 py-2.5 mb-2 shadow-md text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-stone-200">{activePuzzle ? (boardOrientation === 'white' ? 'White to move' : 'Black to move') : 'Puzzles'}</span>
              {activePuzzle && activePuzzle.source !== 'mistake' && (
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-stone-800 text-amber-400 font-mono font-bold">{activePuzzle.rating}</span>
                  {(() => {
                    const tier = getDifficultyTierBadge(activePuzzle.rating);
                    return <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${tier.color}`}>{tier.label}</span>;
                  })()}
                </div>
              )}
            </div>
            {mode === 'battle' && rushActive && (
              <div className="flex items-center gap-4 text-xs font-mono font-bold">
                <div className="text-amber-400">You: {rushScore}</div>
                <div className="text-cyan-400 flex items-center gap-1">
                  <Ghost className="w-3.5 h-3.5" /> Ghost: {ghostScore}
                </div>
                <div className="text-stone-400">{fmtClock(rushTimeRemaining)}</div>
              </div>
            )}
            {(mode === 'rush' || mode === 'survival') && rushActive && (
              <div className="flex items-center gap-4">
                {mode === 'rush' && (
                  <div className="flex items-center gap-1 text-amber-400 font-mono font-bold">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{fmtClock(rushTimeRemaining)}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  {[0, 1, 2].map((idx) => (
                    <span key={idx} className={`text-sm ${idx < rushStrikes ? 'text-red-500' : 'text-stone-700'}`}>✕</span>
                  ))}
                </div>
                <div className="font-mono font-bold text-stone-200">
                  Score: <span className="text-amber-400">{rushScore}</span>
                </div>
              </div>
            )}
            {mode === 'daily' && <div className="text-amber-400 font-bold">🔥 Streak: {userProfile.dailyStreak} days</div>}
          </div>

          {!showBoard ? (
            <div className="w-full aspect-square max-w-[560px] rounded-xl bg-stone-900 border border-stone-800 flex flex-col items-center justify-center p-8 text-center space-y-3">
              <Flame className="w-12 h-12 text-amber-500" />
              <p className="text-sm text-stone-300 max-w-xs">
                {rushFinal !== null ? `Final score: ${rushFinal}` : 'Press start on the right when you are ready.'}
              </p>
            </div>
          ) : loading && !activePuzzle ? (
            <div className="w-full aspect-square max-w-[560px] rounded-xl bg-stone-900 border border-stone-800 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
              <p className="text-xs text-stone-400 font-serif italic">
                {bundlePct < 100 ? `Preparing your puzzle library… ${bundlePct}%` : 'Loading puzzle...'}
              </p>
            </div>
          ) : !activePuzzle ? (
            <div className="w-full aspect-square max-w-[560px] rounded-xl bg-stone-900 border border-stone-800 flex flex-col items-center justify-center p-8 text-center space-y-4">
              {mode === 'mistakes' ? (
                <>
                  <CheckCircle2 className="w-12 h-12 text-emerald-400" />
                  <h3 className="font-serif font-bold text-xl text-stone-100">No mistakes due for review</h3>
                  <p className="text-xs text-stone-400 max-w-sm">
                    Positions are added here when you press "Retry" on a key moment in Game Review. They come back after 1, 3, 7 and 21 days.
                  </p>
                </>
              ) : (
                <>
                  <XCircle className="w-12 h-12 text-red-400" />
                  <p className="text-sm text-stone-300 max-w-sm">{loadError || 'No puzzle loaded.'}</p>
                  <button onClick={() => loadPuzzle(mode)} className="py-2 px-4 rounded-xl bg-amber-500 text-stone-950 text-xs font-bold">
                    Try again
                  </button>
                </>
              )}
            </div>
          ) : (
            <DojoBoard
              fen={boardFen}
              orientation={boardOrientation}
              interactive={status === 'solving' && !isOpponentMoving && !loading}
              onMove={handleUserMove}
              arrows={hintArrow}
              lastMove={lastMove}
              boardTheme={userProfile.settings.boardTheme}
              autoQueen={userProfile.settings.autoQueen}
            />
          )}

          {activePuzzle && showBoard && (
            <div className="w-full max-w-[560px] flex items-center justify-between bg-stone-900 border border-stone-800 rounded-b-xl px-4 py-2 mt-2 shadow-md text-xs text-stone-400 gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span>Themes:</span>
                {status === 'solving' && mode !== 'themes' ? (
                  <span className="text-stone-500 italic">hidden until solved</span>
                ) : (
                  activePuzzle.themes
                    .filter((t) => !['oneMove', 'short', 'long', 'veryLong'].includes(t))
                    .slice(0, 4)
                    .map((t) => (
                      <span key={t} className="px-1.5 py-0.5 rounded bg-stone-800 text-[10px] text-stone-300">
                        {THEME_LABELS[t] || t}
                      </span>
                    ))
                )}
              </div>
              {activePuzzle.gameUrl && status !== 'solving' && (
                <a href={activePuzzle.gameUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-stone-400 hover:text-amber-300 shrink-0">
                  Lichess <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}
        </div>

        {/* Controls column */}
        <div className="lg:col-span-5 space-y-4">
          {isTimedMode && !rushActive && (
            <div className={`p-6 rounded-2xl bg-gradient-to-br ${mode === 'battle' ? 'from-cyan-950/40 border-cyan-500/40' : 'from-amber-950/40 border-amber-500/40'} via-stone-900 to-stone-900 border shadow-xl space-y-4 text-center`}>
              {mode === 'battle' ? <Ghost className="w-10 h-10 text-cyan-400 mx-auto" /> : <Flame className="w-10 h-10 text-amber-500 mx-auto" />}
              <h3 className="font-serif font-black text-2xl text-stone-100">
                {mode === 'rush' ? '5-Minute Rush' : mode === 'battle' ? 'Battle Your Ghost' : 'Survival'}
              </h3>
              <p className="text-xs text-stone-300 max-w-sm mx-auto">
                {mode === 'rush'
                  ? 'Solve as many puzzles as you can in 5 minutes. Puzzles get harder as you go. Three wrong answers and the run ends.'
                  : mode === 'battle'
                    ? `Race a ghost running at the pace of your best Rush score (${userProfile.rushBestScore}). Five minutes, three strikes.`
                    : 'No clock. Puzzles get harder each time. Three wrong answers and you are out.'}
              </p>
              {rushFinal !== null && (
                <p className="text-sm font-bold text-amber-300">
                  Score: {rushFinal}
                  {mode === 'battle' && (rushFinal > ghostTarget ? ' (you beat the ghost!)' : ' (the ghost wins this time)')}
                </p>
              )}
              <p className="text-[11px] text-stone-400">
                Best: {mode === 'survival' ? userProfile.survivalBestScore : userProfile.rushBestScore}
              </p>
              <button
                onClick={() => startTimed(mode as 'rush' | 'battle' | 'survival')}
                className={`w-full py-3 rounded-xl ${mode === 'battle' ? 'bg-cyan-500 hover:bg-cyan-400' : 'bg-amber-500 hover:bg-amber-400'} text-stone-950 font-bold text-sm uppercase tracking-wider transition-all shadow-lg active:scale-95 cursor-pointer`}
              >
                {rushFinal !== null ? 'Play again' : 'Start'}
              </button>
            </div>
          )}

          {activePuzzle?.description && status === 'solving' && (
            <div className="p-3 rounded-xl bg-stone-900 border border-stone-800 text-xs text-stone-300">{activePuzzle.description}</div>
          )}

          {status === 'correct' && activePuzzle && !isTimedMode && (
            <div className="p-5 rounded-2xl bg-emerald-950/40 border border-emerald-500/50 shadow-xl space-y-3 animate-scaleUp">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                  <h3 className="font-serif font-black text-lg">{usedHint ? 'Solved (with a hint)' : 'Solved!'}</h3>
                </div>
                {ratingDelta !== null && (
                  <div className={`flex items-center gap-1 font-mono font-bold text-sm px-2 py-0.5 rounded-md ${ratingDelta >= 0 ? 'text-emerald-400 bg-emerald-900/60' : 'text-red-400 bg-red-900/60'}`}>
                    {ratingDelta >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    <span>{ratingDelta >= 0 ? `+${ratingDelta}` : ratingDelta}</span>
                  </div>
                )}
              </div>
              {practiceRetry && <p className="text-[11px] text-stone-400">Practice retry: the rating was already counted on your first try.</p>}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => loadPuzzle(mode)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{mode === 'mistakes' ? 'Next mistake' : 'Next puzzle'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setExplainModal({ open: true, fen: activePuzzle.fen, move: activePuzzle.solution[0] || '' })}
                  className="py-2.5 px-3 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Explain</span>
                </button>
              </div>
            </div>
          )}

          {status === 'failed' && activePuzzle && !isTimedMode && (
            <div className="p-5 rounded-2xl bg-red-950/40 border border-red-500/50 shadow-xl space-y-3 animate-scaleUp">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-red-400">
                  <XCircle className="w-5 h-5" />
                  <h3 className="font-serif font-black text-lg">Not the right move</h3>
                </div>
                {ratingDelta !== null && (
                  <div className="flex items-center gap-1 font-mono font-bold text-sm text-red-400 bg-red-900/60 px-2 py-0.5 rounded-md">
                    <TrendingDown className="w-4 h-4" />
                    <span>{ratingDelta}</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-stone-300">The green arrow shows the move that works. Retry to play it through (practice only), or go to the next one.</p>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleRetryPosition}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Retry</span>
                </button>
                <button
                  onClick={() => loadPuzzle(mode)}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                >
                  <span>Next</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setExplainModal({ open: true, fen: activePuzzle.fen, move: activePuzzle.solution[0] || '' })}
                  className="py-2.5 px-3 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Explain</span>
                </button>
              </div>
            </div>
          )}

          {status === 'solving' && activePuzzle && !isTimedMode && (
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-xl space-y-3">
              <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">Controls</h4>
              <div className="flex gap-2">
                <button
                  onClick={handleShowHint}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 border border-stone-700 text-amber-300 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Lightbulb className="w-4 h-4 text-amber-400" />
                  <span>{mode === 'rated' && !practiceRetry ? 'Hint (counts as a loss)' : 'Show hint'}</span>
                </button>
                <button
                  onClick={handleGiveUp}
                  className="py-2.5 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200 text-xs font-bold transition-all"
                  title={mode === 'rated' ? 'Skipping a rated puzzle counts as a loss' : 'Skip'}
                >
                  {mode === 'rated' && !practiceRetry ? 'Give up' : 'Skip'}
                </button>
              </div>
            </div>
          )}

          {mode === 'mistakes' && (
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 text-xs text-stone-400">
              {dueCount} position{dueCount === 1 ? '' : 's'} due for review today.
            </div>
          )}

          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-xl flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-stone-500">Your puzzle rating</div>
              <div className="font-mono font-black text-2xl text-amber-400">{userProfile.puzzleRating}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase font-bold tracking-wider text-stone-500">Rated puzzles played</div>
              <div className="font-mono font-bold text-stone-300">{userProfile.ratedPuzzlesPlayed}</div>
            </div>
          </div>
        </div>
      </div>

      {showCsvModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-stone-100 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-amber-500" />
                <h3 className="font-serif font-bold text-lg text-stone-100">Import Lichess Puzzle CSV</h3>
              </div>
              <button onClick={() => setShowCsvModal(false)} className="text-stone-400 hover:text-stone-200">
                ✕
              </button>
            </div>
            <p className="text-xs text-stone-400 leading-relaxed">
              About 21,000 Lichess puzzles are already built in. You can add more from a Lichess puzzle CSV (
              <code className="text-amber-400">PuzzleId,FEN,Moves,Rating,…</code>, from database.lichess.org). Themes are detected
              automatically when the file has none.
            </p>
            <div className="border-2 border-dashed border-stone-700 hover:border-amber-500/50 rounded-xl p-6 text-center transition-all bg-stone-950/40">
              <input type="file" accept=".csv,text/csv" onChange={handleCsvFileChange} className="hidden" id="csv-file-input" />
              <label htmlFor="csv-file-input" className="cursor-pointer flex flex-col items-center space-y-2">
                <FileSpreadsheet className="w-8 h-8 text-amber-500/70" />
                <span className="text-xs font-bold text-stone-300">Choose CSV file</span>
              </label>
            </div>
            {csvImportProgress !== null && (
              <div className="text-xs text-stone-400 flex justify-between">
                <span>Importing…</span>
                <span className="font-mono text-amber-400">{csvImportProgress} puzzles</span>
              </div>
            )}
            {csvError && <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/40 text-red-300 text-xs">{csvError}</div>}
          </div>
        </div>
      )}

      <GeminiCoachModal
        isOpen={explainModal.open}
        onClose={() => setExplainModal({ open: false, fen: '', move: '' })}
        fen={explainModal.fen}
        movePlayed={explainModal.move}
        userLevel={userProfile.currentLevel}
        context="Puzzle: explain why the solution move works"
      />
    </div>
  );
};
