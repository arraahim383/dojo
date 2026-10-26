import React, { useState, useEffect } from 'react';
import { db, getUserProfile, updateUserProfile, type UserProfile, DEFAULT_PROFILE } from './db';
import { sound } from './services/sound';
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
  const [reviewPgn, setReviewPgn] = useState<string | null>(null);
  const [reviewColor, setReviewColor] = useState<'white' | 'black'>('white');
  const [engineStatus, setEngineStatus] = useState<EngineStatus>(engine.status);
  const [showPlacement, setShowPlacement] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

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
    refreshProfile();
    // Load the puzzle library into the browser in the background so Puzzles opens instantly later.
    const warm = setTimeout(() => puzzleService.ensureBundledPuzzles().catch(() => undefined), 1500);
    const unsubscribe = engine.onStatusChange(setEngineStatus);
    return () => {
      clearTimeout(warm);
      unsubscribe();
    };
  }, []);

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0C0A09] flex flex-col items-center justify-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-3xl font-serif text-amber-400 animate-pulse">
          道
        </div>
        <p className="font-serif text-stone-400 text-sm italic">Entering Daba Dojo...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0C0A09] text-stone-100 flex flex-col selection:bg-amber-500 selection:text-stone-950">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-stone-950/90 backdrop-blur-md border-b border-stone-800/80 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo & Martial Title */}
          <div
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-600 to-amber-700 flex items-center justify-center text-stone-950 font-black text-xl shadow-lg border border-amber-400/50 group-hover:scale-105 transition-all">
              道
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif font-black text-lg tracking-wider text-stone-100 whitespace-nowrap">
                  DABA DOJO
                </span>
                <span className="hidden sm:inline text-[10px] font-mono tracking-widest uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  CHESS
                </span>
              </div>
              <p className="text-[10px] text-stone-400 tracking-tight font-serif">
                Sensei Guided Training
              </p>
            </div>
          </div>

          {/* Quick Stats: Level, Elo, Sound */}
          <div className="flex items-center gap-3">
            {/* Level Badge */}
            <div
              onClick={() => setActiveTab('learn')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-800 hover:border-amber-500/40 cursor-pointer transition-all text-xs font-serif"
            >
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-stone-300 font-bold">{getLevelName(profile.currentLevel)}</span>
            </div>

            {/* Puzzle Elo Badge */}
            <div
              onClick={() => setActiveTab('puzzles')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-800 hover:border-amber-500/40 cursor-pointer transition-all text-xs font-mono"
            >
              <Award className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-amber-400 font-bold">{profile.puzzleRating}</span>
            </div>

            {/* Audio Toggle */}
            <button
              onClick={toggleSound}
              className="w-9 h-9 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-400 hover:text-stone-200 flex items-center justify-center transition-all cursor-pointer"
              title="Toggle Move Sound"
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
                onClick={() => setActiveTab(item.id)}
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
                    setActiveTab(item.id);
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
      <main className="flex-1 pb-16">
        {activeTab === 'home' && (
          <HomeView
            userProfile={profile}
            onNavigate={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'learn' && (
          <LearnView
            userProfile={profile}
            onRefreshProfile={refreshProfile}
            onNavigate={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'puzzles' && (
          <PuzzlesView
            userProfile={profile}
            onRefreshProfile={refreshProfile}
          />
        )}

        {activeTab === 'play' && (
          <PlayView
            userProfile={profile}
            onRefreshProfile={refreshProfile}
            onNavigateToReview={(pgn, color) => {
              setReviewPgn(pgn);
              setReviewColor(color);
              setActiveTab('review');
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
