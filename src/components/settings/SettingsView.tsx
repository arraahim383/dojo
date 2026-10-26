import React, { useState } from 'react';
import {
  UserProfile,
  updateUserProfile,
  exportDatabaseBackup,
  importDatabaseBackup,
  DEFAULT_PROFILE
} from '../../db';
import { sound } from '../../services/sound';
import {
  Settings2,
  Volume2,
  VolumeX,
  Palette,
  Shield,
  Download,
  Upload,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Sliders
} from 'lucide-react';

interface SettingsViewProps {
  userProfile: UserProfile;
  onRefreshProfile: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  userProfile,
  onRefreshProfile,
}) => {
  const [soundEnabled, setSoundEnabled] = useState<boolean>(userProfile.settings.soundEnabled);
  const [boardTheme, setBoardTheme] = useState(userProfile.settings.boardTheme);
  const [autoQueen, setAutoQueen] = useState(userProfile.settings.autoQueen);
  const [coachWarnings, setCoachWarnings] = useState(userProfile.settings.coachWarnings);
  const [coachThreatArrows, setCoachThreatArrows] = useState(userProfile.settings.coachThreatArrows);

  // Editable Gates state
  const [gate1Vision, setGate1Vision] = useState(userProfile.settings.gates.gate1to2.visionScore);
  const [gate2Rating, setGate2Rating] = useState(userProfile.settings.gates.gate2to3.puzzleRating);
  const [gate3Rating, setGate3Rating] = useState(userProfile.settings.gates.gate3to4.puzzleRating);
  const [gate4Rating, setGate4Rating] = useState(userProfile.settings.gates.gate4toMastery.puzzleRating);
  const [selectedLevel, setSelectedLevel] = useState(userProfile.currentLevel);

  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);

  const handleSaveSettings = async () => {
    sound.setEnabled(soundEnabled);
    await updateUserProfile({
      currentLevel: selectedLevel,
      settings: {
        ...userProfile.settings,
        soundEnabled,
        boardTheme,
        autoQueen,
        coachWarnings,
        coachThreatArrows,
        gates: {
          ...userProfile.settings.gates,
          gate1to2: {
            ...userProfile.settings.gates.gate1to2,
            visionScore: Number(gate1Vision),
          },
          gate2to3: {
            ...userProfile.settings.gates.gate2to3,
            puzzleRating: Number(gate2Rating),
          },
          gate3to4: {
            ...userProfile.settings.gates.gate3to4,
            puzzleRating: Number(gate3Rating),
          },
          gate4toMastery: {
            ...userProfile.settings.gates.gate4toMastery,
            puzzleRating: Number(gate4Rating),
          },
        },
      },
    });

    onRefreshProfile();
    setSaveMessage('Settings saved successfully!');
    sound.playSuccess();
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const handleExportBackup = async () => {
    try {
      const jsonStr = await exportDatabaseBackup();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `daba-dojo-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      sound.playSuccess();
    } catch (err) {
      console.error('Export error', err);
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        const ok = await importDatabaseBackup(text);
        if (ok) {
          onRefreshProfile();
          setSaveMessage('Backup restored into IndexedDB!');
          sound.playSuccess();
        } else {
          setBackupError('That file could not be read as a Daba Dojo backup. Choose a .json file made with Export Backup.');
        }
      } catch (err) {
        setBackupError('That file is not a Daba Dojo backup. Choose a .json file made with Export Backup.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold tracking-widest uppercase">
          <Settings2 className="w-3.5 h-3.5" />
          Dojo Sanctuary Configuration
        </div>
        <h1 className="text-3xl font-serif font-black text-stone-100 tracking-tight">
          Settings & Gate Calibration
        </h1>
        <p className="text-stone-400 text-xs sm:text-sm max-w-md mx-auto">
          Tailor gate requirements, sound acoustics, board aesthetics, and browser-local data.
        </p>
      </div>

      {backupError && (
        <div className="p-4 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs flex items-center justify-between gap-3 font-bold animate-fadeIn">
          <span>{backupError}</span>
          <button onClick={() => setBackupError(null)} className="text-red-200 underline shrink-0">Dismiss</button>
        </div>
      )}

      {saveMessage && (
        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 font-bold animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{saveMessage}</span>
        </div>
      )}

      {/* Board & Audio Experience */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 shadow-xl space-y-6">
        <h3 className="font-serif font-bold text-lg text-stone-100 flex items-center gap-2">
          <Palette className="w-5 h-5 text-amber-500" />
          <span>Aesthetic & Acoustics</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Board Theme */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-400 mb-2">
              Board Tatami Finish
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'dojo', label: 'Dojo Cedar' },
                { id: 'classic', label: 'Classic Slate' },
                { id: 'emerald', label: 'Jade Emerald' },
                { id: 'slate', label: 'Dark Charcoal' },
              ].map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => setBoardTheme(theme.id as any)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                    boardTheme === theme.id
                      ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-md'
                      : 'bg-stone-800 text-stone-300 border-stone-700 hover:bg-stone-700'
                  }`}
                >
                  {theme.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sound & Auto-Queen */}
          <div className="space-y-3">
            <div
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-3 rounded-xl border border-stone-800 bg-stone-950/60 flex items-center justify-between cursor-pointer hover:border-amber-500/40 transition-all"
            >
              <div className="flex items-center gap-3">
                {soundEnabled ? (
                  <Volume2 className="w-5 h-5 text-amber-400" />
                ) : (
                  <VolumeX className="w-5 h-5 text-stone-500" />
                )}
                <div>
                  <div className="text-xs font-bold text-stone-200">Move Audio Acoustics</div>
                  <div className="text-[10px] text-stone-500">Wood knocks, check chimes, victory chords</div>
                </div>
              </div>
              <div className={`w-5 h-5 rounded-full border flex items-center justify-center text-xs ${
                soundEnabled ? 'bg-amber-500 border-amber-400 text-stone-950 font-bold' : 'border-stone-700'
              }`}>
                {soundEnabled ? '✓' : ''}
              </div>
            </div>

            <div
              onClick={() => setAutoQueen(!autoQueen)}
              className="p-3 rounded-xl border border-stone-800 bg-stone-950/60 flex items-center justify-between cursor-pointer hover:border-amber-500/40 transition-all"
            >
              <div>
                <div className="text-xs font-bold text-stone-200">Auto-Queen on Promotion</div>
                <div className="text-[10px] text-stone-500">Automatically promote pawns to Queens without modal</div>
              </div>
              <div className={`w-5 h-5 rounded-full border flex items-center justify-center text-xs ${
                autoQueen ? 'bg-amber-500 border-amber-400 text-stone-950 font-bold' : 'border-stone-700'
              }`}>
                {autoQueen ? '✓' : ''}
              </div>
            </div>

            {[
              { on: coachWarnings, set: setCoachWarnings, title: 'Coach Mode: blunder warnings', sub: 'Stockfish checks your move first and warns if it loses 2+ pawns or allows mate' },
              { on: coachThreatArrows, set: setCoachThreatArrows, title: "Coach Mode: show the bot's threat", sub: 'A red arrow shows what the bot would play next if you passed' },
            ].map((t) => (
              <div
                key={t.title}
                onClick={() => t.set(!t.on)}
                className="p-3 rounded-xl border border-stone-800 bg-stone-950/60 flex items-center justify-between cursor-pointer hover:border-amber-500/40 transition-all"
              >
                <div>
                  <div className="text-xs font-bold text-stone-200">{t.title}</div>
                  <div className="text-[10px] text-stone-500">{t.sub}</div>
                </div>
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center text-xs ${t.on ? 'bg-amber-500 border-amber-400 text-stone-950 font-bold' : 'border-stone-700'}`}>
                  {t.on ? '✓' : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Editable Level Gates Calibration */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 shadow-xl space-y-6">
        <h3 className="font-serif font-bold text-lg text-stone-100 flex items-center gap-2">
          <Sliders className="w-5 h-5 text-amber-500" />
          <span>Editable Level Gates</span>
        </h3>
        <p className="text-xs text-stone-400">
          Customize the qualification criteria required to advance between Dojo belts.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
            <label className="block text-xs font-bold text-stone-300">
              Gate 1→2: Vision Speed Requirement
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={gate1Vision}
                onChange={(e) => setGate1Vision(Number(e.target.value))}
                className="w-24 px-3 py-1.5 rounded-lg bg-stone-900 border border-stone-700 text-stone-100 font-mono text-sm"
              />
              <span className="text-xs text-stone-400">coordinates in 30s</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
            <label className="block text-xs font-bold text-stone-300">
              Gate 2→3: Target Puzzle Elo
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={gate2Rating}
                onChange={(e) => setGate2Rating(Number(e.target.value))}
                className="w-28 px-3 py-1.5 rounded-lg bg-stone-900 border border-stone-700 text-stone-100 font-mono text-sm"
              />
              <span className="text-xs text-stone-400">tactical rating</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
            <label className="block text-xs font-bold text-stone-300">
              Gate 3→4: Target Puzzle Elo
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={gate3Rating}
                onChange={(e) => setGate3Rating(Number(e.target.value))}
                className="w-28 px-3 py-1.5 rounded-lg bg-stone-900 border border-stone-700 text-stone-100 font-mono text-sm"
              />
              <span className="text-xs text-stone-400">tactical rating</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
            <label className="block text-xs font-bold text-stone-300">
              Gate 4→Mastery: Target Puzzle Elo
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={gate4Rating}
                onChange={(e) => setGate4Rating(Number(e.target.value))}
                className="w-28 px-3 py-1.5 rounded-lg bg-stone-900 border border-stone-700 text-stone-100 font-mono text-sm"
              />
              <span className="text-xs text-stone-400">tactical rating</span>
            </div>
          </div>
        </div>

        {/* Current Level Manual Override */}
        <div className="pt-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-stone-400 mb-2">
            Current Dojo Rank
          </label>
          <div className="grid grid-cols-5 gap-2">
            {[
              { lvl: 1, label: 'L1: New' },
              { lvl: 2, label: 'L2: Beginner' },
              { lvl: 3, label: 'L3: Inter.' },
              { lvl: 4, label: 'L4: Adv.' },
              { lvl: 5, label: 'Mastery' },
            ].map(({ lvl, label }) => (
              <button
                key={lvl}
                onClick={() => setSelectedLevel(lvl)}
                className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all ${
                  selectedLevel === lvl
                    ? 'bg-amber-500 text-stone-950 border-amber-400 font-serif'
                    : 'bg-stone-800 text-stone-300 border-stone-700 hover:bg-stone-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSaveSettings}
          className="py-3 px-8 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-serif font-black text-sm uppercase tracking-wider shadow-xl hover:shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
        >
          Save All Settings
        </button>
      </div>

      {/* Backup & Data Integrity */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 shadow-xl space-y-4">
        <h3 className="font-serif font-bold text-lg text-stone-100 flex items-center gap-2">
          <Download className="w-5 h-5 text-amber-500" />
          <span>Local Data Backup (Zero Account Lock-in)</span>
        </h3>
        <p className="text-xs text-stone-400">
          All your games, rating changes, and puzzles live locally in IndexedDB. Export an offline JSON snapshot or restore it onto any device.
        </p>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            onClick={handleExportBackup}
            className="flex items-center gap-2 py-2.5 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 text-xs font-bold transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 text-amber-400" />
            <span>Export Database JSON</span>
          </button>

          <label className="flex items-center gap-2 py-2.5 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 text-xs font-bold transition-all cursor-pointer">
            <Upload className="w-4 h-4 text-amber-400" />
            <span>Restore JSON Backup</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportBackup}
              className="hidden"
            />
          </label>
        </div>
      </div>
    </div>
  );
};
