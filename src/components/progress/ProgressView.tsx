import React, { useState, useEffect } from 'react';
import { db, UserProfile, type PuzzleHistoryItem, type MyMistakeItem } from '../../db';
import { CHESS_BOTS } from '../../data/bots';
import { primaryTheme } from '../../services/puzzleService';
import { THEME_LABELS } from '../../services/puzzleThemes';
import {
  TrendingUp,
  Award,
  Flame,
  Eye,
  Swords,
  Calendar,
  CheckCircle2,
  XCircle,
  Trophy,
  History,
  BookmarkCheck,
  Target,
  BarChart2,
  ShieldAlert
} from 'lucide-react';

interface ProgressViewProps {
  userProfile: UserProfile;
}

export const ProgressView: React.FC<ProgressViewProps> = ({ userProfile }) => {
  const [history, setHistory] = useState<PuzzleHistoryItem[]>([]);
  const [allHistory, setAllHistory] = useState<PuzzleHistoryItem[]>([]);
  const [mistakes, setMistakes] = useState<MyMistakeItem[]>([]);

  useEffect(() => {
    const fetchHistory = async () => {
      const all = await db.puzzleHistory.orderBy('playedAt').toArray();
      setAllHistory(all);
      setHistory(all.filter((h) => h.mode === 'rated').slice(-30).reverse());
      const m = await db.myMistakes.toArray();
      setMistakes(m);
    };
    fetchHistory();
  }, [userProfile.puzzleRating]);

  // Success rate per theme (rated + theme practice), weakest first; themes with 3+ attempts
  const themeStats = React.useMemo(() => {
    const stats: Record<string, { total: number; wins: number }> = {};
    allHistory.forEach((h) => {
      const themes = (h.themes && h.themes.length ? h.themes : [h.theme || 'tactics']).filter(
        (t) => !['oneMove', 'short', 'long', 'veryLong', 'opening', 'middlegame', 'mate'].includes(t)
      );
      const unique = new Set(themes.length ? themes : [primaryTheme(h.themes || [])]);
      unique.forEach((theme) => {
        if (!stats[theme]) stats[theme] = { total: 0, wins: 0 };
        stats[theme].total++;
        if (h.result === 'win') stats[theme].wins++;
      });
    });
    return Object.entries(stats)
      .filter(([, d]) => d.total >= 3)
      .map(([theme, data]) => ({ theme, total: data.total, wins: data.wins, pct: Math.round((data.wins / data.total) * 100) }))
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 10);
  }, [allHistory]);

  // Puzzle rating over time (rated puzzles)
  const ratingPoints = React.useMemo(() => {
    const rated = allHistory.filter((h) => h.mode === 'rated');
    const pts = rated.length ? [rated[0].userRatingBefore, ...rated.map((h) => h.userRatingAfter)] : [];
    return pts.slice(-100);
  }, [allHistory]);
  const sparkline = (pts: number[]) => {
    if (pts.length < 2) return '';
    const min = Math.min(...pts) - 10;
    const max = Math.max(...pts) + 10;
    return pts.map((v, i) => `${(i / (pts.length - 1)) * 100},${40 - ((v - min) / (max - min)) * 40}`).join(' ');
  };

  const dueMistakesCount = mistakes.filter((m) => m.nextReviewDate <= Date.now() + 60000).length;

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8 space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold tracking-widest uppercase">
          <TrendingUp className="w-3.5 h-3.5" />
          Disciple Training Ledger
        </div>
        <h1 className="text-3xl font-serif font-black text-stone-100 tracking-tight">
          Your Progress & Strengths Analysis
        </h1>
        <p className="text-stone-400 text-xs sm:text-sm max-w-lg mx-auto">
          Every tactic solved, bot overcome, and coordinate identified is preserved directly in your browser.
        </p>
      </div>

      {/* High Level Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-stone-900 border border-stone-800 shadow-xl space-y-1">
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
            <Award className="w-4 h-4" />
            <span>Puzzle Rating</span>
          </div>
          <div className="font-mono font-black text-3xl text-stone-100">{userProfile.puzzleRating}</div>
          <div className="text-[11px] text-stone-400">{userProfile.ratedPuzzlesPlayed} rated puzzles played</div>
        </div>

        <div className="p-5 rounded-2xl bg-stone-900 border border-stone-800 shadow-xl space-y-1">
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
            <Flame className="w-4 h-4" />
            <span>Rush Record</span>
          </div>
          <div className="font-mono font-black text-3xl text-stone-100">{userProfile.rushBestScore}</div>
          <div className="text-[11px] text-stone-400">Survival: {userProfile.survivalBestScore}</div>
        </div>

        <div className="p-5 rounded-2xl bg-stone-900 border border-stone-800 shadow-xl space-y-1">
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
            <Eye className="w-4 h-4" />
            <span>Vision Speed</span>
          </div>
          <div className="font-mono font-black text-3xl text-stone-100">
            {Math.max(userProfile.visionBestWhite, userProfile.visionBestBlack)}
          </div>
          <div className="text-[11px] text-stone-400">W: {userProfile.visionBestWhite} | B: {userProfile.visionBestBlack}</div>
        </div>

        <div className="p-5 rounded-2xl bg-stone-900 border border-stone-800 shadow-xl space-y-1">
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
            <Calendar className="w-4 h-4" />
            <span>Daily Streak</span>
          </div>
          <div className="font-mono font-black text-3xl text-stone-100">{userProfile.dailyStreak}</div>
          <div className="text-[11px] text-stone-400">Consecutive days</div>
        </div>
      </div>

      {/* Rating graph + review accuracy */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 shadow-xl space-y-3">
          <h3 className="font-serif font-bold text-stone-100 text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-500" />
            <span>Puzzle rating</span>
          </h3>
          {ratingPoints.length < 2 ? (
            <p className="text-xs text-stone-500 italic py-4">Play a few rated puzzles to see your rating graph.</p>
          ) : (
            <>
              <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-28 bg-stone-950 rounded-xl border border-stone-800">
                <polyline fill="none" stroke="#F59E0B" strokeWidth="1.5" vectorEffect="non-scaling-stroke" points={sparkline(ratingPoints)} />
              </svg>
              <div className="flex justify-between text-[11px] font-mono text-stone-400">
                <span>Low {Math.min(...ratingPoints)}</span>
                <span>Last {ratingPoints.length - 1} puzzles</span>
                <span>High {Math.max(...ratingPoints)}</span>
              </div>
            </>
          )}
        </div>
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 shadow-xl space-y-3">
          <h3 className="font-serif font-bold text-stone-100 text-base flex items-center gap-2">
            <Target className="w-4 h-4 text-amber-500" />
            <span>Your accuracy in reviewed games</span>
          </h3>
          {userProfile.reviewHistory.length === 0 ? (
            <p className="text-xs text-stone-500 italic py-4">Review your bot games to track your accuracy over time.</p>
          ) : (
            <div className="space-y-1.5 text-xs font-mono">
              {[...userProfile.reviewHistory].reverse().slice(0, 8).map((r) => (
                <div key={r.key} className="flex items-center justify-between">
                  <span className="text-stone-400 truncate pr-2">{r.date} · vs {r.opponent}</span>
                  <span className={`font-bold ${r.accuracy >= 80 ? 'text-emerald-400' : r.accuracy >= 65 ? 'text-amber-400' : 'text-red-400'}`}>{r.accuracy}%</span>
                </div>
              ))}
            </div>
          )}
          <div className="text-[11px] text-stone-500 pt-1">
            Lessons completed: <span className="text-stone-300 font-bold">{userProfile.completedLessons.length}</span> · Drills passed:{' '}
            <span className="text-stone-300 font-bold">{userProfile.passedDrills.length}</span>
          </div>
        </div>
      </div>

      {/* Strengths & Weaknesses (Theme Success %) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-serif font-bold text-stone-100 text-base flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-amber-500" />
              <span>Tactical Strengths & Weaknesses</span>
            </h3>
            <span className="text-[10px] text-stone-400 uppercase font-mono">Weakest first</span>
          </div>

          {themeStats.length === 0 ? (
            <p className="text-xs text-stone-500 italic py-4">Solve a few more puzzles (3+ per theme) to see your weakest themes here.</p>
          ) : (
            <div className="space-y-3">
              {themeStats.map((st) => (
                <div key={st.theme} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-stone-300 font-medium">{THEME_LABELS[st.theme] || st.theme}</span>
                    <span className="font-mono font-bold text-amber-400">{st.pct}% ({st.wins}/{st.total})</span>
                  </div>
                  <div className="w-full bg-stone-950 h-2 rounded-full overflow-hidden border border-stone-800">
                    <div
                      className={`h-full ${st.pct >= 60 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                      style={{ width: `${st.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Spaced Repetition Ledger */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-serif font-bold text-stone-100 text-base flex items-center gap-2">
              <BookmarkCheck className="w-4 h-4 text-amber-500" />
              <span>My Mistakes (Spaced Repetition)</span>
            </h3>
            <span className="text-xs font-mono font-bold text-amber-400">
              {dueMistakesCount} Due Now
            </span>
          </div>

          <p className="text-xs text-stone-400 leading-relaxed">
            Positions retried during Game Reviews enter a 1, 3, 7, and 21-day spaced repetition loop to permanently iron out blunders.
          </p>

          <div className="grid grid-cols-4 gap-2 text-center text-xs pt-2">
            {[1, 3, 7, 21].map((days) => {
              const count = mistakes.filter((m) => m.intervalDays === days).length;
              return (
                <div key={days} className="p-3 rounded-xl bg-stone-950 border border-stone-800">
                  <div className="text-[10px] text-stone-500 uppercase font-bold">{days} Day</div>
                  <div className="font-mono font-black text-xl text-stone-200 mt-1">{count}</div>
                  <div className="text-[9px] text-stone-500">items</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Dojo Opponents Defeated Trophy Room */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-stone-100 font-serif font-bold text-lg">
            <Swords className="w-5 h-5 text-amber-500" />
            <span>Bots Defeated Tatami</span>
          </div>
          <span className="text-xs font-mono text-amber-400 font-bold">
            {userProfile.botsBeaten.length} / {CHESS_BOTS.length} Conquered
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {CHESS_BOTS.map((bot) => {
            const isBeaten = userProfile.botsBeaten.includes(bot.id);
            const isAssisted = !isBeaten && userProfile.botsBeatenAssisted.includes(bot.id);
            return (
              <div
                key={bot.id}
                className={`p-3 rounded-xl border text-center transition-all ${
                  isBeaten
                    ? 'bg-emerald-950/30 border-emerald-500/40'
                    : 'bg-stone-950/60 border-stone-800 opacity-50'
                }`}
              >
                <div className="text-2xl mb-1">{bot.avatarIcon}</div>
                <div className="font-serif font-bold text-xs text-stone-200 truncate">{bot.name}</div>
                <div className="font-mono text-[10px] text-amber-400">{bot.elo}</div>
                <div className="text-[9px] uppercase tracking-wider mt-1 font-bold text-stone-400">
                  {isBeaten ? 'Defeated' : isAssisted ? 'Assisted win' : 'Undefeated'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Puzzle History */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2 text-stone-100 font-serif font-bold text-lg">
          <History className="w-5 h-5 text-amber-500" />
          <span>Recent Tactical Trials</span>
        </div>

        {history.length === 0 ? (
          <p className="text-stone-500 text-xs italic py-4">No rated puzzles recorded yet.</p>
        ) : (
          <div className="divide-y divide-stone-800 text-xs font-mono">
            {history.map((item, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {item.result === 'win' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400" />
                  )}
                  <div>
                    <span className="text-stone-200 font-bold">Puzzle ~{item.puzzleRating}</span>
                    <span className="text-stone-500 ml-2">({THEME_LABELS[item.theme || ''] || item.theme || 'Tactics'})</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-stone-400">
                    {item.userRatingBefore} → <span className="text-stone-200 font-bold">{item.userRatingAfter}</span>
                  </span>
                  <span className={`font-bold ${item.result === 'win' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {item.userRatingAfter >= item.userRatingBefore ? `+${item.userRatingAfter - item.userRatingBefore}` : item.userRatingAfter - item.userRatingBefore}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
