import React, { useState, useEffect, useRef } from 'react';
import { db, getUserProfile, updateUserProfile, clearLocalProgress, type UserProfile, DEFAULT_PROFILE } from './db';
import { sound } from './services/sound';
import { supabase, authConfigured } from './services/auth';
import { startCloudSync, stopCloudSync, subscribeToSyncStatus, type SyncStatus } from './services/cloudSync';
import { apiUrl } from './services/paths';
import { HomeView } from './components/home/HomeView';
import { PlayView } from './components/play/PlayView';
import { PuzzlesView } from './components/puzzles/PuzzlesView';
import { VisionView } from './components/vision/VisionView';
import { LearnView } from './components/learn/LearnView';
import { ProgressView } from './components/progress/ProgressView';
import { SettingsView } from './components/settings/SettingsView';
import { GameReviewView } from './components/review/GameReviewView';
import { DrillsView } from './components/drills/DrillsView';
import { OpeningsView } from './components/openings/OpeningsView';
import { PlacementModal } from './components/placement/PlacementModal';
import { AuthView } from './components/auth/AuthView';
import { BrandMark } from './components/common/BrandMark';
import { engine, type EngineStatus } from './services/engine';
import { puzzleService } from './services/puzzleService';
import {
  Home,
  GraduationCap,
  Award,
  Swords,
  Search,
  Target,
  Compass,
  Eye,
  TrendingUp,
  Settings2,
  Volume2,
  VolumeX,
  Sparkles,
  Menu,
  X
} from 'lucide-react';

export default function App() {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>('home');
  const [puzzleInitialMode, setPuzzleInitialMode] = useState<'rated' | 'mistakes'>('rated');
  const [reviewPgn, setReviewPgn] = useState<string | null>(null);
  const [reviewColor, setReviewColor] = useState<'white' | 'black'>('white');
  const [engineStatus, setEngineStatus] = useState<EngineStatus>(engine.status);
  const [showPlacement, setShowPlacement] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [offlineMode, setOfflineMode] = useState<boolean>(() => typeof window !== 'undefined' && localStorage.getItem('daba-dojo-offline-mode') === '1');
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('offline');
  const activeUserId = useRef<string | null>(null);

  // Load user profile on mount
  const refreshProfile = async () => {
    try {
      const p = await getUserProfile();
      setProfile(p);
      sound.setEnabled(p.settings.soundEnabled);
      if (!p.placementDone) {
        setShowPlacement(true);
      }
    } catch (e) {
      console.error('Error loading profile:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const warm = setTimeout(() => puzzleService.ensureBundledPuzzles().catch(() => undefined), 1500);
    const unsubscribeEngine = engine.onStatusChange(setEngineStatus);
    const activateSession = async (session: { user: { id: string; email?: string } } | null) => {
      if (!mounted) return;
      const nextUserId = session?.user.id ?? null;
      setAccountEmail(session?.user.email ?? null);
      if (nextUserId === activeUserId.current) {
        setAuthReady(true);
        return;
      }
      activeUserId.current = nextUserId;
      if (nextUserId) {
        localStorage.removeItem('daba-dojo-offline-mode');
        setOfflineMode(false);
        try {
          await startCloudSync(nextUserId);
        } catch (error) {
          console.error('Could not initialize cloud progress:', error);
          setSyncStatus('error');
        }
        if (mounted) await refreshProfile();
      } else {
        stopCloudSync();
        const useOffline = localStorage.getItem('daba-dojo-offline-mode') === '1';
        setOfflineMode(useOffline);
        if (useOffline && mounted) await refreshProfile();
      }
      if (mounted) setAuthReady(true);
    };

    const unsubscribeStatus = subscribeToSyncStatus(setSyncStatus);
    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        void activateSession(session ? { user: { id: session.user.id, email: session.user.email } } : null);
      });
      void supabase.auth.getSession().then(({ data }) => activateSession(data.session ? { user: { id: data.session.user.id, email: data.session.user.email } } : null));
      return () => {
        mounted = false;
        clearTimeout(warm);
        unsubscribeEngine();
        subscription.unsubscribe();
        unsubscribeStatus();
        stopCloudSync();
      };
    }

    setAuthReady(true);
    if (localStorage.getItem('daba-dojo-offline-mode') === '1') void refreshProfile();
    return () => {
      mounted = false;
      clearTimeout(warm);
      unsubscribeEngine();
      unsubscribeStatus();
    };
  }, []);

  const navigate = (tab: string, puzzleMode: 'rated' | 'mistakes' = 'rated') => {
    if (tab === 'puzzles') setPuzzleInitialMode(puzzleMode);
    setActiveTab(tab);
  };

  const toggleSound = async () => {
    const next = !profile.settings.soundEnabled;
    sound.setEnabled(next);
    const updated = await updateUserProfile({
      settings: {
        ...profile.settings,
        soundEnabled: next,
      },
    });
    setProfile(updated);
  };

  const navItems = [
    { id: 'home', label: "Today's Plan", icon: Home },
    { id: 'learn', label: 'Learn', icon: GraduationCap },
    { id: 'puzzles', label: 'Puzzles', icon: Award },
    { id: 'play', label: 'Play vs Bots', icon: Swords },
    { id: 'review', label: 'Review', icon: Search },
    { id: 'drills', label: 'Drills', icon: Target },
    { id: 'openings', label: 'Openings', icon: Compass },
    { id: 'vision', label: 'Vision', icon: Eye },
    { id: 'progress', label: 'Progress', icon: TrendingUp },
    { id: 'settings', label: 'Settings', icon: Settings2 },
  ];

  const getLevelName = (lvl: number): string => {
    switch (lvl) {
      case 1:
        return 'L1: New to Chess';
      case 2:
        return 'L2: Beginner';
      case 3:
        return 'L3: Intermediate';
      case 4:
        return 'L4: Advanced';
      case 5:
      default:
        return 'Mastery';
    }
  };

  const continueOffline = () => {
    localStorage.setItem('daba-dojo-offline-mode', '1');
    setOfflineMode(true);
    void refreshProfile();
  };

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
    localStorage.removeItem('daba-dojo-offline-mode');
    setOfflineMode(false);
  };

  const retryCloudSync = async () => {
    const userId = activeUserId.current;
    if (!userId) return;
    setSyncStatus('syncing');
    try {
      await startCloudSync(userId);
    } catch (error) {
      console.error('Could not retry cloud progress sync:', error);
      setSyncStatus('error');
    }
  };

  const deleteAccount = async () => {
    if (!supabase) throw new Error('Accounts are not configured in this build.');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Your session expired. Sign in again, then try once more.');
    const response = await fetch(apiUrl('/api/account'), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'We could not delete your account right now.');
    await supabase.auth.signOut();
    stopCloudSync();
    activeUserId.current = null;
    localStorage.removeItem('daba-dojo-progress-owner');
    localStorage.removeItem('daba-dojo-offline-mode');
    setAccountEmail(null);
    setOfflineMode(false);
    await clearLocalProgress();
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#0c0a09] flex flex-col items-center justify-center gap-4">
        <BrandMark className="h-16 w-16 animate-pulse" />
        <p className="text-sm text-stone-400">Checking your account…</p>
      </div>
    );
  }

  if (!accountEmail && !offlineMode) {
    return <AuthView onContinueOffline={continueOffline} />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0C0A09] flex flex-col items-center justify-center space-y-4">
        <BrandMark className="h-16 w-16 animate-pulse" />
        <p className="text-stone-400 text-sm">Loading your training…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0C0A09] text-stone-100 flex flex-col selection:bg-amber-500 selection:text-stone-950">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-stone-950/90 backdrop-blur-md border-b border-stone-800/80 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Brand */}
          <div
            onClick={() => navigate('home')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <BrandMark className="h-10 w-10 transition-transform group-hover:scale-105" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight text-stone-100 whitespace-nowrap">
                  DABA DOJO
                </span>
                <span className="hidden sm:inline text-[10px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  LEARN
                </span>
              </div>
              <p className="text-[10px] text-stone-400 tracking-tight">
                Chess learning, one step at a time
              </p>
            </div>
          </div>

          {/* Quick Stats: Level, Elo, Sound */}
          <div className="flex items-center gap-3">
            {/* Level Badge */}
            <div
              onClick={() => navigate('learn')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-800 hover:border-emerald-500/40 cursor-pointer transition-all text-xs"
            >
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-stone-300 font-bold">{getLevelName(profile.currentLevel)}</span>
            </div>

            {/* Puzzle Elo Badge */}
            <div
              onClick={() => navigate('puzzles')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-800 hover:border-emerald-500/40 cursor-pointer transition-all text-xs font-mono"
            >
              <Award className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-amber-400 font-bold">{profile.puzzleRating}</span>
            </div>

            {/* Audio Toggle */}
            <button
              onClick={toggleSound}
              className="w-9 h-9 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-400 hover:text-stone-200 flex items-center justify-center transition-all cursor-pointer"
              title="Toggle move sounds"
              aria-label={profile.settings.soundEnabled ? 'Turn move sounds off' : 'Turn move sounds on'}
            >
              {profile.settings.soundEnabled ? (
                <Volume2 className="w-4 h-4 text-amber-400" />
              ) : (
                <VolumeX className="w-4 h-4 text-stone-600" />
              )}
            </button>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden w-9 h-9 rounded-xl bg-stone-900 border border-stone-800 text-stone-400 flex items-center justify-center"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Desktop Navigation Row */}
        <div className="hidden md:flex items-center justify-center gap-1 max-w-7xl mx-auto pt-2.5 overflow-x-auto no-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-amber-500 text-stone-950 font-bold shadow-md'
                    : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-stone-950 border-b border-stone-800 p-4 space-y-2 animate-fadeIn z-30">
          <div className="grid grid-cols-2 gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    navigate(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-amber-500 text-stone-950'
                      : 'bg-stone-900 text-stone-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {engineStatus === 'failed' && (
        <div className="bg-red-950/80 border-b border-red-800 text-red-200 text-xs px-4 py-2 text-center">
          The Stockfish engine could not load in this browser, so bots, hints and Game Review won't work properly. Try reloading, or use a recent Chrome, Edge, Firefox or Safari.
        </div>
      )}

      {/* Main Content View Switcher */}
      <main className="flex-1 pb-24 md:pb-16">
        {activeTab === 'home' && (
          <HomeView
            userProfile={profile}
            onNavigate={navigate}
          />
        )}

        {activeTab === 'learn' && (
          <LearnView
            userProfile={profile}
            onRefreshProfile={refreshProfile}
            onNavigate={navigate}
          />
        )}

        {activeTab === 'puzzles' && (
          <PuzzlesView
            userProfile={profile}
            onRefreshProfile={refreshProfile}
            initialMode={puzzleInitialMode}
          />
        )}

        {activeTab === 'play' && (
          <PlayView
            userProfile={profile}
            onRefreshProfile={refreshProfile}
            onNavigateToReview={(pgn, color) => {
              setReviewPgn(pgn);
              setReviewColor(color);
              navigate('review');
            }}
          />
        )}

        {activeTab === 'vision' && (
          <VisionView
            userProfile={profile}
            onRefreshProfile={refreshProfile}
          />
        )}

        {activeTab === 'progress' && (
          <ProgressView userProfile={profile} />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            userProfile={profile}
            onRefreshProfile={refreshProfile}
            accountEmail={accountEmail}
            accountConfigured={authConfigured}
            syncStatus={syncStatus}
            onSignIn={() => {
              localStorage.removeItem('daba-dojo-offline-mode');
              setOfflineMode(false);
            }}
            onSignOut={signOut}
            onDeleteAccount={deleteAccount}
            onRetrySync={retryCloudSync}
          />
        )}

        {activeTab === 'review' && (
          <GameReviewView
            userProfile={profile}
            initialPgn={reviewPgn || undefined}
            initialUserColor={reviewColor}
            onRefreshProfile={refreshProfile}
          />
        )}

        {activeTab === 'drills' && (
          <DrillsView
            userProfile={profile}
            onRefreshProfile={refreshProfile}
          />
        )}

        {activeTab === 'openings' && (
          <OpeningsView
            userProfile={profile}
          />
        )}
      </main>

      <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-stone-800 bg-stone-950/95 px-2 pt-2 backdrop-blur-xl md:hidden" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
        {[
          { id: 'home', label: 'Today', icon: Home },
          { id: 'learn', label: 'Learn', icon: GraduationCap },
          { id: 'puzzles', label: 'Practice', icon: Award },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button key={item.id} onClick={() => { navigate(item.id); setMobileMenuOpen(false); }} aria-current={isActive ? 'page' : undefined} className={`flex min-h-12 min-w-16 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-bold transition ${isActive ? 'text-emerald-300' : 'text-stone-500 hover:text-stone-200'}`}>
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </button>
          );
        })}
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-expanded={mobileMenuOpen} aria-label="More sections" className={`flex min-h-12 min-w-16 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-bold transition ${mobileMenuOpen ? 'text-emerald-300' : 'text-stone-500 hover:text-stone-200'}`}>
          <Menu className="h-5 w-5" />
          <span>More</span>
        </button>
      </nav>

      {/* Placement Assessment Modal on First Launch */}
      <PlacementModal
        isOpen={showPlacement}
        onComplete={() => {
          setShowPlacement(false);
          refreshProfile();
        }}
        userProfile={profile}
      />
    </div>
  );
}
