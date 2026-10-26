import React, { useState, useEffect } from 'react';
import { db, getTodayActivity, type UserProfile, type DailyActivity } from '../../db';
import { CHESS_BOTS } from '../../data/bots';
import { THEME_LABELS } from '../../services/puzzleThemes';
import {
  Swords,
  Award,
  Eye,
  Flame,
  CheckCircle2,
  Circle,
  ArrowRight,
  Sparkles,
  Trophy,
  Shield,
  Clock,
  Compass,
  BookmarkCheck,
  Search,
  BookOpen,
  Target
} from 'lucide-react';

interface HomeViewProps {
  userProfile: UserProfile;
  onNavigate: (tab: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  userProfile,
  onNavigate,
}) => {
  const [dueMistakesCount, setDueMistakesCount] = useState<number>(0);
  const [today, setToday] = useState<DailyActivity | null>(null);
  const [weakTheme, setWeakTheme] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const m = await db.myMistakes.toArray();
      setDueMistakesCount(m.filter((item) => item.nextReviewDate <= Date.now()).length);
      setToday(await getTodayActivity());
      // weakest theme: lowest success rate among themes with 5+ attempts
      const hist = await db.puzzleHistory.toArray();
      const stats: Record<string, { n: number; w: number }> = {};
      hist.forEach((h) => {
        const t = h.theme;
        if (!t || t === 'tactics') return;
        stats[t] = stats[t] || { n: 0, w: 0 };
        stats[t].n++;
        if (h.result === 'win') stats[t].w++;
      });
      const weakest = Object.entries(stats)
        .filter(([, v]) => v.n >= 5)
        .sort((a, b) => a[1].w / a[1].n - b[1].w / b[1].n)[0];
      setWeakTheme(weakest ? weakest[0] : null);
    })();
  }, [userProfile]);

  // The bot to play today: the gate bot for your level if not yet beaten, otherwise the next one up
  const gateBotId = [
    userProfile.settings.gates.gate1to2.botBeaten,
    userProfile.settings.gates.gate2to3.botBeaten,
    userProfile.settings.gates.gate3to4.botBeaten,
    userProfile.settings.gates.gate4toMastery.botBeaten,
  ][Math.min(3, userProfile.currentLevel - 1)];
  const suggestedBot =
    CHESS_BOTS.find((b) => b.id === gateBotId && !userProfile.botsBeaten.includes(b.id)) ||
    CHESS_BOTS.find((b) => !userProfile.botsBeaten.includes(b.id)) ||
    CHESS_BOTS[CHESS_BOTS.length - 1];

  const d = today;
  // Today's Plan (~30–45 min), built from your own data and reset every day
  const todayTasks = [
    {
      id: 'task_lesson_drill',
      title: 'Complete 1 lesson or endgame drill',
      subtitle: d && d.lessonsOrDrills > 0 ? `${d.lessonsOrDrills} done today` : 'Learn something new or sharpen a technique',
      completed: !!d && d.lessonsOrDrills > 0,
      action: () => onNavigate('learn'),
      btnLabel: 'Train',
      icon: BookOpen,
    },
    {
      id: 'task_rated_puzzles',
      title: 'Solve 10 rated puzzles',
      subtitle: `${Math.min(10, d?.ratedPuzzles ?? 0)} / 10 today (rating ${userProfile.puzzleRating})`,
      completed: (d?.ratedPuzzles ?? 0) >= 10,
      action: () => onNavigate('puzzles'),
      btnLabel: 'Solve',
      icon: Award,
    },
    {
      id: 'task_theme_puzzles',
      title: weakTheme ? `5 puzzles on your weakest theme: ${THEME_LABELS[weakTheme] || weakTheme}` : '5 theme puzzles',
      subtitle: `${Math.min(5, d?.themePuzzles ?? 0)} / 5 today${weakTheme ? '' : ' (play more puzzles to find your weak spot)'}`,
      completed: (d?.themePuzzles ?? 0) >= 5,
      action: () => onNavigate('puzzles'),
      btnLabel: 'Themes',
      icon: Target,
    },
    {
      id: 'task_mistakes',
      title: 'Review your due mistakes',
      subtitle: dueMistakesCount > 0 ? `${dueMistakesCount} position${dueMistakesCount === 1 ? '' : 's'} due` : 'Nothing due right now',
      completed: dueMistakesCount === 0,
      action: () => onNavigate('puzzles'),
      btnLabel: dueMistakesCount === 0 ? 'Done' : 'Review',
      icon: BookmarkCheck,
    },
    {
      id: 'task_bot_game',
      title: '1 game against a bot',
      subtitle: `Suggested: ${suggestedBot.name} (${suggestedBot.elo})${d && d.botGames > 0 ? ` · ${d.botGames} played today` : ''}`,
      completed: (d?.botGames ?? 0) > 0,
      action: () => onNavigate('play'),
      btnLabel: 'Play',
      icon: Swords,
    },
    {
      id: 'task_review_game',
      title: 'Review that game with Stockfish',
      subtitle: d && d.gamesReviewed > 0 ? `${d.gamesReviewed} reviewed today` : 'Find your key mistakes and retry them',
      completed: (d?.gamesReviewed ?? 0) > 0,
      action: () => onNavigate('review'),
      btnLabel: 'Review',
      icon: Search,
    },
  ];

  const completedCount = todayTasks.filter((t) => t.completed).length;

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 space-y-8 animate-fadeIn">
      {/* Hero Dojo Welcome Banner */}
      <div className="relative rounded-3xl bg-gradient-to-r from-stone-900 via-amber-950/40 to-stone-900 border border-amber-600/30 p-6 sm:p-10 shadow-2xl overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold tracking-widest uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            Dojo Level {userProfile.currentLevel} Disciple
          </div>

          <h1 className="text-3xl sm:text-5xl font-serif font-black text-stone-100 tracking-tight">
            Sharpen Your Blade, Disciple.
          </h1>

          <p className="text-stone-300 text-sm sm:text-base leading-relaxed">
            Welcome to your personal training sanctuary. Engine analysis, disciplined tactical drills, and Sensei guidance designed to elevate you from beginner to 1800 strength.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              onClick={() => onNavigate('puzzles')}
              className="py-3 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-serif font-black text-sm uppercase tracking-wider shadow-xl hover:shadow-amber-500/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Award className="w-4 h-4 fill-current" />
              <span>Resume Rated Puzzles</span>
            </button>
            <button
              onClick={() => onNavigate('play')}
              className="py-3 px-6 rounded-2xl bg-stone-800/80 hover:bg-stone-800 text-stone-200 border border-stone-700 font-serif font-bold text-sm tracking-wider active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Swords className="w-4 h-4" />
              <span>Spar vs Bots</span>
            </button>
          </div>
        </div>
      </div>

      {/* Today's Training Plan Card (~30-45 min) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <h2 className="font-serif font-bold text-xl text-stone-100">Today's Plan (30–45 min)</h2>
            </div>
            <p className="text-xs text-stone-400">Resets every day and ticks itself off as you train</p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-stone-300 bg-stone-900 border border-stone-800 px-3 py-1.5 rounded-xl">
            <span className="text-amber-400">{completedCount}</span> / {todayTasks.length} Completed
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {todayTasks.map((task) => {
            const Icon = task.icon;
            return (
              <div
                key={task.id}
                className={`p-5 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                  task.completed
                    ? 'bg-stone-900/40 border-stone-800 opacity-80'
                    : 'bg-stone-900 border-stone-800 hover:border-amber-500/40 shadow-lg'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    task.completed
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                      : 'bg-stone-800 text-amber-400 border border-stone-700'
                  }`}>
                    {task.completed ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className={`font-serif font-bold text-sm ${task.completed ? 'text-stone-400 line-through' : 'text-stone-100'}`}>
                      {task.title}
                    </h3>
                    <p className="text-[11px] text-stone-400">{task.subtitle}</p>
                  </div>
                </div>

                <button
                  onClick={task.action}
                  className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    task.completed
                      ? 'bg-stone-800 text-stone-400 hover:text-stone-200'
                      : 'bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-md active:scale-95'
                  }`}
                >
                  {task.completed ? 'Review' : task.btnLabel}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800 text-center space-y-1">
          <div className="text-[10px] uppercase font-bold tracking-wider text-stone-500">Puzzle Rating</div>
          <div className="font-mono font-black text-3xl text-amber-400">{userProfile.puzzleRating}</div>
          <div className="text-[10px] text-stone-400">{userProfile.ratedPuzzlesPlayed} rated solved</div>
        </div>

        <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800 text-center space-y-1">
          <div className="text-[10px] uppercase font-bold tracking-wider text-stone-500">Rush Record</div>
          <div className="font-mono font-black text-3xl text-amber-400">{userProfile.rushBestScore}</div>
          <div className="text-[10px] text-stone-400">Survival: {userProfile.survivalBestScore}</div>
        </div>

        <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800 text-center space-y-1">
          <div className="text-[10px] uppercase font-bold tracking-wider text-stone-500">Vision High Score</div>
          <div className="font-mono font-black text-3xl text-amber-400">
            {Math.max(userProfile.visionBestWhite, userProfile.visionBestBlack)}
          </div>
          <div className="text-[10px] text-stone-400">W: {userProfile.visionBestWhite} | B: {userProfile.visionBestBlack}</div>
        </div>

        <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800 text-center space-y-1">
          <div className="text-[10px] uppercase font-bold tracking-wider text-stone-500">Bots Defeated</div>
          <div className="font-mono font-black text-3xl text-amber-400">{userProfile.botsBeaten.length}</div>
          <div className="text-[10px] text-stone-400">of 12 masters</div>
        </div>
      </div>
    </div>
  );
};
