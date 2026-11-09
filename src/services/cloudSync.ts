import { liveQuery } from 'dexie';
import type { DailyActivity, LocalPuzzle, MyMistakeItem, PuzzleHistoryItem, SavedGame, SeenPuzzle, UserProfile } from '../db';
import { db, DEFAULT_PROFILE, getUserProfile } from '../db';
import { supabase } from './auth';

type WithoutId<T> = T extends { id?: number } ? Omit<T, 'id'> : T;

export interface ProgressSnapshot {
  version: 1;
  updatedAt: number;
  profile: UserProfile;
  puzzles: LocalPuzzle[];
  history: Array<WithoutId<PuzzleHistoryItem>>;
  games: Array<WithoutId<SavedGame>>;
  mistakes: Array<WithoutId<MyMistakeItem>>;
  daily: DailyActivity[];
  seen: SeenPuzzle[];
}

export type SyncStatus = 'offline' | 'syncing' | 'synced' | 'error';

let activeUserId: string | null = null;
let liveSubscription: { unsubscribe: () => void } | null = null;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let lastSnapshot = '';
let currentStatus: SyncStatus = 'offline';
let statusListeners = new Set<(status: SyncStatus) => void>();
let activeWrite: Promise<void> | null = null;
let onlineHandler: (() => void) | null = null;
let syncPending = false;
const LOCAL_UPDATE_KEY = 'daba-dojo-progress-updated-at';

const setStatus = (status: SyncStatus) => {
  currentStatus = status;
  statusListeners.forEach((listener) => listener(status));
};

export const getSyncStatus = () => currentStatus;

export function subscribeToSyncStatus(listener: (status: SyncStatus) => void) {
  statusListeners.add(listener);
  listener(currentStatus);
  return () => statusListeners.delete(listener);
}

export async function readProgressSnapshot(): Promise<ProgressSnapshot> {
  const [profile, puzzles, history, games, mistakes, daily, seen] = await Promise.all([
    getUserProfile(),
    db.puzzles.where('source').equals('imported').toArray(),
    db.puzzleHistory.toArray(),
    db.savedGames.toArray(),
    db.myMistakes.toArray(),
    db.dailyActivity.toArray(),
    db.seenPuzzles.toArray(),
  ]);

  return {
    version: 1,
    updatedAt: Number(localStorage.getItem(LOCAL_UPDATE_KEY) || 0),
    profile,
    puzzles,
    history: history.map(({ id: _id, ...item }) => item),
    games: games.map(({ id: _id, ...item }) => item),
    mistakes: mistakes.map(({ id: _id, ...item }) => item),
    daily,
    seen,
  };
}

const stableSnapshot = (snapshot: ProgressSnapshot) => JSON.stringify({
  ...snapshot,
  updatedAt: 0,
});

const union = <T,>(a: T[], b: T[], keyOf: (item: T) => string): T[] => {
  const result = new Map<string, T>();
  [...a, ...b].forEach((item) => result.set(keyOf(item), item));
  return [...result.values()];
};

function mergeSnapshots(local: ProgressSnapshot, cloud: ProgressSnapshot): ProgressSnapshot {
  const newest = local.updatedAt >= cloud.updatedAt ? local : cloud;
  const older = newest === local ? cloud : local;
  const latestProfile = newest.profile;
  const otherProfile = older.profile;
  const profile: UserProfile = {
    ...otherProfile,
    ...latestProfile,
    currentLevel: Math.max(local.profile.currentLevel, cloud.profile.currentLevel),
    placementDone: local.profile.placementDone || cloud.profile.placementDone,
    ratedPuzzlesPlayed: Math.max(local.profile.ratedPuzzlesPlayed, cloud.profile.ratedPuzzlesPlayed),
    visionBestWhite: Math.max(local.profile.visionBestWhite, cloud.profile.visionBestWhite),
    visionBestBlack: Math.max(local.profile.visionBestBlack, cloud.profile.visionBestBlack),
    rushBestScore: Math.max(local.profile.rushBestScore, cloud.profile.rushBestScore),
    survivalBestScore: Math.max(local.profile.survivalBestScore, cloud.profile.survivalBestScore),
    dailyStreak: Math.max(local.profile.dailyStreak, cloud.profile.dailyStreak),
    botsBeaten: [...new Set([...local.profile.botsBeaten, ...cloud.profile.botsBeaten])],
    botsBeatenAssisted: [...new Set([...local.profile.botsBeatenAssisted, ...cloud.profile.botsBeatenAssisted])],
    completedLessons: [...new Set([...local.profile.completedLessons, ...cloud.profile.completedLessons])],
    passedDrills: [...new Set([...local.profile.passedDrills, ...cloud.profile.passedDrills])],
    reviewedGameKeys: [...new Set([...local.profile.reviewedGameKeys, ...cloud.profile.reviewedGameKeys])],
    gamesReviewedCount: Math.max(local.profile.gamesReviewedCount, cloud.profile.gamesReviewedCount),
    reviewHistory: union(local.profile.reviewHistory || [], cloud.profile.reviewHistory || [], (item) => item.key),
    settings: latestProfile.settings,
  };

  const puzzles = union(local.puzzles, cloud.puzzles, (item) => item.id);
  const history = union(local.history, cloud.history, (item) => `${item.puzzleId}|${item.mode}|${item.playedAt}`);
  const games = union(local.games, cloud.games, (item) => `${item.createdAt}|${item.pgn}`);
  const mistakes = union(local.mistakes, cloud.mistakes, (item) => `${item.fen}|${item.mistakeMove}`)
    .sort((a, b) => b.lastReviewedAt - a.lastReviewedAt);
  const activityByDate = new Map<string, DailyActivity>();
  [...local.daily, ...cloud.daily].forEach((item) => {
    const existing = activityByDate.get(item.date);
    activityByDate.set(item.date, existing ? {
      date: item.date,
      ratedPuzzles: Math.max(existing.ratedPuzzles, item.ratedPuzzles),
      themePuzzles: Math.max(existing.themePuzzles, item.themePuzzles),
      lessonsOrDrills: Math.max(existing.lessonsOrDrills, item.lessonsOrDrills),
      botGames: Math.max(existing.botGames, item.botGames),
      gamesReviewed: Math.max(existing.gamesReviewed, item.gamesReviewed),
      mistakesReviewed: Math.max(existing.mistakesReviewed, item.mistakesReviewed),
    } : item);
  });

  return {
    version: 1,
    updatedAt: Math.max(local.updatedAt, cloud.updatedAt),
    profile,
    puzzles,
    history,
    games,
    mistakes,
    daily: [...activityByDate.values()],
    seen: union(local.seen, cloud.seen, (item) => item.id),
  };
}

async function replaceLocalProgress(snapshot: ProgressSnapshot) {
  await db.transaction('rw', [db.userProfile, db.puzzles, db.puzzleHistory, db.savedGames, db.myMistakes, db.dailyActivity, db.seenPuzzles], async () => {
    await db.userProfile.put({ ...snapshot.profile, id: 1 });
    const importedKeys = await db.puzzles.where('source').equals('imported').primaryKeys();
    await db.puzzles.bulkDelete(importedKeys);
    if (snapshot.puzzles.length > 0) await db.puzzles.bulkPut(snapshot.puzzles);
    await db.puzzleHistory.clear();
    await db.savedGames.clear();
    await db.myMistakes.clear();
    await db.dailyActivity.clear();
    await db.seenPuzzles.clear();
    if (snapshot.history.length > 0) await db.puzzleHistory.bulkAdd(snapshot.history as PuzzleHistoryItem[]);
    if (snapshot.games.length > 0) await db.savedGames.bulkAdd(snapshot.games as SavedGame[]);
    if (snapshot.mistakes.length > 0) await db.myMistakes.bulkAdd(snapshot.mistakes as MyMistakeItem[]);
    await db.dailyActivity.bulkPut(snapshot.daily);
    await db.seenPuzzles.bulkPut(snapshot.seen);
  });
}

async function readCloudSnapshot(userId: string): Promise<ProgressSnapshot | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('user_progress')
    .select('snapshot')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  const snapshot = data?.snapshot as ProgressSnapshot | undefined;
  return snapshot?.version === 1 ? snapshot : null;
}

async function writeCloudSnapshot(userId: string, snapshot: ProgressSnapshot) {
  if (!supabase) throw new Error('Cloud sign-in is not configured for this build.');
  const { error } = await supabase.from('user_progress').upsert({
    user_id: userId,
    snapshot,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

async function syncLocalChanges(userId: string) {
  if (!supabase || activeUserId !== userId) return;
  if (activeWrite) {
    syncPending = true;
    return activeWrite;
  }

  activeWrite = (async () => {
    try {
      const snapshot = await readProgressSnapshot();
      const serialized = stableSnapshot(snapshot);
      if (serialized === lastSnapshot) return;
      setStatus('syncing');
      await writeCloudSnapshot(userId, snapshot);
      lastSnapshot = serialized;
      setStatus('synced');
    } catch (error) {
      console.error('Progress sync failed:', error);
      setStatus('error');
    } finally {
      activeWrite = null;
      if (syncPending && activeUserId === userId) {
        syncPending = false;
        scheduleSync(userId);
      }
    }
  })();
  return activeWrite;
}

function scheduleSync(userId: string) {
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = setTimeout(() => void syncLocalChanges(userId), 1200);
}

export async function startCloudSync(userId: string) {
  if (!supabase) throw new Error('Cloud sign-in is not configured for this build.');
  stopCloudSync();
  await activeWrite?.catch(() => undefined);
  setStatus('syncing');
  activeUserId = userId;
  onlineHandler = () => {
    if (activeUserId !== userId) return;
    void startCloudSync(userId).catch((error) => {
      console.error('Could not resume cloud progress sync:', error);
      setStatus('error');
    });
  };
  window.addEventListener('online', onlineHandler);

  const previousOwner = localStorage.getItem('daba-dojo-progress-owner');
  const switchingAccounts = Boolean(previousOwner && previousOwner !== userId);
  const emptyProgress: ProgressSnapshot = {
        version: 1 as const,
        updatedAt: 0,
        profile: JSON.parse(JSON.stringify(DEFAULT_PROFILE)) as UserProfile,
        puzzles: [],
        history: [],
        games: [],
        mistakes: [],
        daily: [],
        seen: [],
  };
  if (switchingAccounts) {
    localStorage.setItem(LOCAL_UPDATE_KEY, '0');
    await replaceLocalProgress(emptyProgress);
  }
  const local = switchingAccounts ? emptyProgress : await readProgressSnapshot();
  localStorage.setItem('daba-dojo-progress-owner', userId);
  const cloud = await readCloudSnapshot(userId);
  const resolved = cloud ? mergeSnapshots(local, cloud) : local;
  if (!cloud) resolved.updatedAt = Date.now();
  await replaceLocalProgress(resolved);
  localStorage.setItem(LOCAL_UPDATE_KEY, String(resolved.updatedAt));
  const serialized = stableSnapshot(await readProgressSnapshot());
  await writeCloudSnapshot(userId, resolved);
  lastSnapshot = serialized;
  setStatus('synced');

  liveSubscription = liveQuery(readProgressSnapshot).subscribe({
    next: (snapshot) => {
      if (stableSnapshot(snapshot) !== lastSnapshot) {
        localStorage.setItem(LOCAL_UPDATE_KEY, String(Date.now()));
        scheduleSync(userId);
      }
    },
    error: (error) => {
      console.error('Local progress watcher stopped:', error);
      setStatus('error');
    },
  });
}

export function stopCloudSync() {
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = null;
  liveSubscription?.unsubscribe();
  liveSubscription = null;
  if (onlineHandler) window.removeEventListener('online', onlineHandler);
  onlineHandler = null;
  activeUserId = null;
  lastSnapshot = '';
  setStatus('offline');
}
