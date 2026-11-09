import React, { useState } from 'react';
import {
  type UserProfile,
  updateUserProfile,
  exportDatabaseBackup,
  importDatabaseBackup,
} from '../../db';
import { sound } from '../../services/sound';
import type { SyncStatus } from '../../services/cloudSync';
import {
  Settings2,
  Volume2,
  VolumeX,
  Palette,
  Download,
  Upload,
  CheckCircle2,
  Cloud,
  ShieldCheck,
  LogOut,
  UserRound,
  Play,
} from 'lucide-react';

interface SettingsViewProps {
  userProfile: UserProfile;
  onRefreshProfile: () => void;
  accountEmail: string | null;
  accountConfigured: boolean;
  syncStatus: SyncStatus;
  onSignIn: () => void;
  onSignOut: () => void;
  onDeleteAccount: () => Promise<void>;
  onRetrySync: () => void;
}

const ToggleRow: React.FC<{ title: string; detail: string; enabled: boolean; onChange: () => void }> = ({ title, detail, enabled, onChange }) => (
  <div className="flex items-center justify-between gap-4 rounded-2xl border border-stone-800 bg-stone-950/60 p-4">
    <div>
      <div className="text-sm font-semibold text-stone-200">{title}</div>
      <div className="mt-1 text-xs leading-5 text-stone-500">{detail}</div>
    </div>
    <button type="button" role="switch" aria-checked={enabled} aria-label={title} onClick={onChange} className={`relative h-6 w-11 shrink-0 rounded-full transition ${enabled ? 'bg-emerald-500' : 'bg-stone-700'}`}>
      <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${enabled ? 'left-6' : 'left-1'}`} />
    </button>
  </div>
);

const syncMessage: Record<SyncStatus, string> = {
  offline: 'On this device',
  syncing: 'Syncing progress…',
  synced: 'Progress is up to date',
  error: 'Sync paused · check your connection',
};

export const SettingsView: React.FC<SettingsViewProps> = ({
  userProfile,
  onRefreshProfile,
  accountEmail,
  accountConfigured,
  syncStatus,
  onSignIn,
  onSignOut,
  onDeleteAccount,
  onRetrySync,
}) => {
  const [soundEnabled, setSoundEnabled] = useState(userProfile.settings.soundEnabled);
  const [boardTheme, setBoardTheme] = useState(userProfile.settings.boardTheme);
  const [autoQueen, setAutoQueen] = useState(userProfile.settings.autoQueen);
  const [coachWarnings, setCoachWarnings] = useState(userProfile.settings.coachWarnings);
  const [coachThreatArrows, setCoachThreatArrows] = useState(userProfile.settings.coachThreatArrows);
  const [saveMessage, setSaveMessage] = useState('');
  const [backupError, setBackupError] = useState('');
  const [accountError, setAccountError] = useState('');
  const [confirmAccountDeletion, setConfirmAccountDeletion] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const deleteAccount = async () => {
    setDeletingAccount(true);
    setAccountError('');
    try {
      await onDeleteAccount();
    } catch (cause) {
      setAccountError(cause instanceof Error ? cause.message : 'Could not delete the account. Try again.');
    } finally {
      setDeletingAccount(false);
      setConfirmAccountDeletion(false);
    }
  };

  const handleSaveSettings = async () => {
    sound.setEnabled(soundEnabled);
    await updateUserProfile({
      settings: {
        ...userProfile.settings,
        soundEnabled,
        boardTheme,
        autoQueen,
        coachWarnings,
        coachThreatArrows,
      },
    });
    await onRefreshProfile();
    setSaveMessage('Settings saved.');
    sound.playSuccess();
    setTimeout(() => setSaveMessage(''), 2600);
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
    } catch (cause) {
      setBackupError(cause instanceof Error ? cause.message : 'Could not create the backup file.');
    }
  };

  const handleImportBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const ok = await importDatabaseBackup(await file.text());
      if (!ok) throw new Error('That file is not a valid Daba Dojo backup.');
      await onRefreshProfile();
      setSaveMessage('Backup restored.');
      sound.playSuccess();
    } catch (cause) {
      setBackupError(cause instanceof Error ? cause.message : 'Could not restore that backup.');
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-7 animate-fadeIn sm:py-9">
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300"><Settings2 className="h-3.5 w-3.5" />Preferences</div>
        <h1 className="text-3xl font-extrabold tracking-tight text-stone-100">Settings</h1>
        <p className="max-w-xl text-sm leading-6 text-stone-400">Keep your account, board and practice tools working the way you like.</p>
      </header>

      {backupError && <div role="alert" className="flex items-center justify-between gap-4 rounded-xl border border-red-800 bg-red-950/60 p-3 text-sm text-red-200"><span>{backupError}</span><button onClick={() => setBackupError('')} className="shrink-0 underline underline-offset-4">Dismiss</button></div>}
      {saveMessage && <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-800 bg-emerald-950/50 p-3 text-sm text-emerald-200"><CheckCircle2 className="h-4 w-4" />{saveMessage}</div>}

      <section className="rounded-2xl border border-stone-800 bg-stone-900 p-5 shadow-xl sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-300"><UserRound className="h-5 w-5" /></div>
          <div><h2 className="font-bold text-stone-100">Account & progress</h2><p className="text-xs text-stone-500">Your work should be there when you switch devices.</p></div>
        </div>
        {accountEmail ? (
          <div className="flex flex-col justify-between gap-4 rounded-xl border border-stone-800 bg-stone-950/60 p-4 sm:flex-row sm:items-center">
            <div className="min-w-0"><div className="truncate text-sm font-semibold text-stone-200">{accountEmail}</div><div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1"><span className={`flex items-center gap-1.5 text-xs ${syncStatus === 'error' ? 'text-amber-300' : 'text-stone-500'}`}><Cloud className="h-3.5 w-3.5" />{syncMessage[syncStatus]}</span>{syncStatus === 'error' && <button onClick={onRetrySync} className="text-xs font-semibold text-emerald-300 underline decoration-emerald-900 underline-offset-4">Try again</button>}</div></div>
            <button onClick={onSignOut} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-stone-700 px-3 text-sm font-semibold text-stone-300 transition hover:border-red-800 hover:text-red-200"><LogOut className="h-4 w-4" />Sign out</button>
          </div>
        ) : (
          <div className="flex flex-col justify-between gap-4 rounded-xl border border-stone-800 bg-stone-950/60 p-4 sm:flex-row sm:items-center">
            <div><div className="flex items-center gap-2 text-sm font-semibold text-stone-200"><Cloud className="h-4 w-4 text-emerald-300" />{accountConfigured ? 'Not signed in' : 'Local progress only'}</div><div className="mt-1 max-w-lg text-xs leading-5 text-stone-500">{accountConfigured ? 'Sign in to sync your lessons, puzzles, games and settings between devices.' : 'This build has no account service configured, so progress stays in this browser or app.'}</div></div>
            <button onClick={onSignIn} disabled={!accountConfigured} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-bold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"><ShieldCheck className="h-4 w-4" />{accountConfigured ? 'Sign in' : 'Accounts unavailable'}</button>
          </div>
        )}
        {accountError && <p role="alert" className="mt-3 rounded-xl border border-red-800 bg-red-950/50 p-3 text-sm text-red-200">{accountError}</p>}
        {accountEmail && accountConfigured && (
          <div className="mt-4 border-t border-stone-800 pt-4">
            {!confirmAccountDeletion ? (
              <button onClick={() => setConfirmAccountDeletion(true)} className="text-xs font-semibold text-stone-500 underline decoration-stone-700 underline-offset-4 transition hover:text-red-300">Delete account and cloud progress</button>
            ) : (
              <div className="rounded-xl border border-red-900/80 bg-red-950/30 p-4">
                <p className="text-sm font-semibold text-red-100">Delete this account and its synced progress?</p>
                <p className="mt-1 text-xs leading-5 text-red-200/70">This permanently deletes your account, cloud history and account-specific data. Download a backup first if you want to keep a copy.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button disabled={deletingAccount} onClick={() => void deleteAccount()} className="min-h-10 rounded-xl bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-500 disabled:opacity-50">{deletingAccount ? 'Deleting…' : 'Delete permanently'}</button>
                  <button disabled={deletingAccount} onClick={() => setConfirmAccountDeletion(false)} className="min-h-10 rounded-xl border border-stone-700 px-4 text-sm font-semibold text-stone-300">Keep account</button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="space-y-5 rounded-2xl border border-stone-800 bg-stone-900 p-5 shadow-xl sm:p-6">
        <div className="flex items-center gap-2"><Palette className="h-5 w-5 text-emerald-300" /><h2 className="font-bold text-stone-100">Board & sound</h2></div>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-stone-300">Board colors</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[{ id: 'dojo', label: 'Cedar' }, { id: 'classic', label: 'Classic' }, { id: 'emerald', label: 'Emerald' }, { id: 'slate', label: 'Slate' }].map((theme) => (
              <button key={theme.id} onClick={() => setBoardTheme(theme.id as typeof boardTheme)} aria-pressed={boardTheme === theme.id} className={`min-h-11 rounded-xl border px-3 text-sm font-semibold transition ${boardTheme === theme.id ? 'border-emerald-400 bg-emerald-500 text-emerald-950' : 'border-stone-700 bg-stone-950 text-stone-300 hover:border-stone-500'}`}>{theme.label}</button>
            ))}
          </div>
        </div>
        <ToggleRow title="Move sounds" detail="Soft wooden taps, a quiet check cue and a short finish sound." enabled={soundEnabled} onChange={() => { const next = !soundEnabled; setSoundEnabled(next); sound.setEnabled(next); if (next) sound.playMove(); }} />
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-800 bg-stone-950/60 p-4">
          <div><div className="text-sm font-semibold text-stone-200">Sound preview</div><div className="mt-1 text-xs text-stone-500">Hear the move and lesson-complete cues.</div></div>
          <button onClick={() => { sound.setEnabled(soundEnabled); sound.playMove(); setTimeout(() => sound.playSuccess(), 240); }} disabled={!soundEnabled} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-stone-700 px-3 text-sm font-semibold text-stone-200 transition hover:border-emerald-600 disabled:opacity-40"><Play className="h-4 w-4" />Preview</button>
        </div>
        <ToggleRow title="Auto-queen" detail="Promote a pawn to a queen with one tap. You can still choose another piece when needed." enabled={autoQueen} onChange={() => setAutoQueen(!autoQueen)} />
        <ToggleRow title="Move coaching" detail="Show a gentle warning when a move gives away material or allows mate." enabled={coachWarnings} onChange={() => setCoachWarnings(!coachWarnings)} />
        <ToggleRow title="Show the bot’s threat" detail="Reveal the likely reply while you are thinking against a bot." enabled={coachThreatArrows} onChange={() => setCoachThreatArrows(!coachThreatArrows)} />
        <div className="flex justify-end"><button onClick={handleSaveSettings} className="min-h-11 rounded-xl bg-emerald-500 px-5 text-sm font-bold text-emerald-950 transition hover:bg-emerald-400">Save preferences</button></div>
      </section>

      <section className="rounded-2xl border border-stone-800 bg-stone-900 p-5 shadow-xl sm:p-6">
        <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-stone-800 text-stone-300"><Download className="h-5 w-5" /></div><div><h2 className="font-bold text-stone-100">Backup & restore</h2><p className="text-xs text-stone-500">A portable copy of your learning progress, games and settings.</p></div></div>
        <p className="mt-4 text-sm leading-6 text-stone-400">{accountEmail ? 'Cloud sync runs in the background. Keep an extra JSON copy whenever you want a backup you control.' : 'Until you sign in, this copy is the way to move progress to another device.'}</p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <button onClick={handleExportBackup} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-700 bg-stone-800 px-4 text-sm font-semibold text-stone-200 transition hover:border-emerald-600"><Download className="h-4 w-4 text-emerald-300" />Export backup</button>
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-stone-700 bg-stone-800 px-4 text-sm font-semibold text-stone-200 transition hover:border-emerald-600"><Upload className="h-4 w-4 text-emerald-300" />Restore backup<input type="file" accept=".json,application/json" onChange={handleImportBackup} className="sr-only" /></label>
        </div>
      </section>
    </div>
  );
};
