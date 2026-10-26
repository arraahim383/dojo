import Dexie, { type Table } from 'dexie';

export interface UserProfile {
  id: number;
  currentLevel: number; // 1: New, 2: Beginner, 3: Intermediate, 4: Advanced, 5: Mastery
  puzzleRating: number;
  placementDone: boolean;
  ratedPuzzlesPlayed: number;
  visionBestWhite: number;
  visionBestBlack: number;
  rushBestScore: number;
  survivalBestScore: number;
  dailyStreak: number;
  lastDailyDate: string;
  botsBeaten: string[]; // bot ids beaten WITHOUT takebacks (these count for gates)
  botsBeatenAssisted: string[]; // bot ids beaten with takebacks
  completedLessons: string[];
  passedDrills: string[];
  gamesReviewedCount: number; // number of distinct games reviewed (see reviewedGameKeys)
  reviewedGameKeys: string[];
  reviewHistory: Array<{ key: string; date: string; accuracy: number; color: 'white' | 'black'; opponent: string }>;
  puzzleBundleVersion: number; // version of the bundled puzzle set already imported
  settings: {
    soundEnabled: boolean;
    moveHaptic: boolean;
    autoQueen: boolean;
    coachThreatArrows: boolean;
    coachWarnings: boolean;
    boardTheme: 'dojo' | 'classic' | 'slate' | 'emerald';
    pieceTheme: 'standard' | 'wood';
    gates: {
      gate1to2: { visionScore: number; drillsPassed: string[]; botBeaten: string };
      gate2to3: { puzzleRating: number; botBeaten: string; gamesReviewed: number };
      gate3to4: { puzzleRating: number; botBeaten: string; drillsPassed: string[] };
      gate4toMastery: { puzzleRating: number; botBeaten: string };
    };
  };
}

export interface LocalPuzzle {
  id: string; // PuzzleId
  fen: string;
  moves: string; // space separated UCI
  rating: number;
  ratingDeviation?: number;
  popularity?: number;
  nbPlays?: number;
  themes: string[];
  gameUrl?: string;
  openingTags?: string;
}

export interface PuzzleHistoryItem {
  id?: number;
  puzzleId: string;
  mode: 'rated' | 'rush' | 'survival' | 'daily' | 'themes' | 'placement';
  result: 'win' | 'loss';
  userRatingBefore: number;
  userRatingAfter: number;
  puzzleRating: number;
  playedAt: number;
  usedHint: boolean;
  theme?: string; // most specific theme
  themes?: string[];
}

export interface SavedGame {
  id?: number;
  pgn: string;
  white: string;
  black: string;
  date: string;
  result: string;
  userColor: 'white' | 'black';
  botId?: string;
  timeControl?: string;
  movesCount: number;
  reviewed: boolean;
  createdAt: number;
}

export interface DailyActivity {
  date: string; // YYYY-MM-DD (local time)
  ratedPuzzles: number;
  themePuzzles: number;
  lessonsOrDrills: number;
  botGames: number;
  gamesReviewed: number;
  mistakesReviewed: number;
}

export interface SeenPuzzle {
  id: string;
  seenAt: number;
}

export interface MyMistakeItem {
  id?: number;
  fen: string;
  correctMove: string;
  mistakeMove: string;
  intervalDays: number; // 1, 3, 7, 21
  nextReviewDate: number;
  reviewsCount: number;
  lastReviewedAt: number;
}

export class DabaDojoDatabase extends Dexie {
  userProfile!: Table<UserProfile, number>;
  puzzles!: Table<LocalPuzzle, string>;
  puzzleHistory!: Table<PuzzleHistoryItem, number>;
  savedGames!: Table<SavedGame, number>;
  myMistakes!: Table<MyMistakeItem, number>;
  dailyActivity!: Table<DailyActivity, string>;
  seenPuzzles!: Table<SeenPuzzle, string>;

  constructor() {
    super('DabaDojoDB');
    this.version(1).stores({
      userProfile: 'id',
      puzzles: 'id, rating, *themes',
      puzzleHistory: '++id, puzzleId, mode, playedAt, result',
      savedGames: '++id, createdAt, reviewed, botId',
      myMistakes: '++id, nextReviewDate, intervalDays',
    });
    this.version(2).stores({
      dailyActivity: 'date',
      seenPuzzles: 'id, seenAt',
    });
  }
}

export const db = new DabaDojoDatabase();

export const DEFAULT_PROFILE: UserProfile = {
  id: 1,
  currentLevel: 1,
  puzzleRating: 400,
  placementDone: false,
  ratedPuzzlesPlayed: 0,
  visionBestWhite: 0,
  visionBestBlack: 0,
  rushBestScore: 0,
  survivalBestScore: 0,
  dailyStreak: 0,
  lastDailyDate: '',
  botsBeaten: [],
  botsBeatenAssisted: [],
  completedLessons: [],
  passedDrills: [],
  gamesReviewedCount: 0,
  reviewedGameKeys: [],
  reviewHistory: [],
  puzzleBundleVersion: 0,
  settings: {
    soundEnabled: true,
    moveHaptic: true,
    autoQueen: true,
    coachThreatArrows: false,
    coachWarnings: true,
    boardTheme: 'dojo',
    pieceTheme: 'standard',
    gates: {
      gate1to2: { visionScore: 15, drillsPassed: ['kq_mate', 'kr_mate'], botBeaten: 'bot_tetsuo_400' },
      gate2to3: { puzzleRating: 1000, botBeaten: 'bot_maya_800', gamesReviewed: 5 },
      gate3to4: { puzzleRating: 1400, botBeaten: 'bot_daiki_1200', drillsPassed: ['lucena', 'philidor'] },
      gate4toMastery: { puzzleRating: 1700, botBeaten: 'bot_ren_1600' },
    },
  },
};

export async function getUserProfile(): Promise<UserProfile> {
  const profile = await db.userProfile.get(1);
  if (!profile) {
    await db.userProfile.put(DEFAULT_PROFILE);
    return DEFAULT_PROFILE;
  }
  // Fill in fields added in later versions so older saved profiles keep working.
  return {
    ...DEFAULT_PROFILE,
    ...profile,
    settings: {
      ...DEFAULT_PROFILE.settings,
      ...profile.settings,
      gates: { ...DEFAULT_PROFILE.settings.gates, ...(profile.settings?.gates || {}) },
    },
  };
}

export function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const EMPTY_DAY = (date: string): DailyActivity => ({
  date,
  ratedPuzzles: 0,
  themePuzzles: 0,
  lessonsOrDrills: 0,
  botGames: 0,
  gamesReviewed: 0,
  mistakesReviewed: 0,
});

export async function getTodayActivity(): Promise<DailyActivity> {
  const key = todayKey();
  return (await db.dailyActivity.get(key)) || EMPTY_DAY(key);
}

export async function bumpDailyActivity(field: Exclude<keyof DailyActivity, 'date'>, by = 1): Promise<void> {
  const key = todayKey();
  await db.transaction('rw', db.dailyActivity, async () => {
    const cur = (await db.dailyActivity.get(key)) || EMPTY_DAY(key);
    cur[field] += by;
    await db.dailyActivity.put(cur);
  });
}

export async function updateUserProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
  const current = await getUserProfile();
  const merged: UserProfile = {
    ...current,
    ...updates,
    settings: {
      ...current.settings,
      ...(updates.settings || {}),
      gates: {
        ...current.settings.gates,
        ...(updates.settings?.gates || {}),
      },
    },
  };
  await db.userProfile.put(merged);
  return merged;
}

// Export / Import entire IndexedDB for backup & zero account sync
export async function exportDatabaseBackup(): Promise<string> {
  const profile = await getUserProfile();
  const puzzles: LocalPuzzle[] = []; // the bundled puzzle set is re-imported automatically, no need to back it up
  const history = await db.puzzleHistory.toArray();
  const games = await db.savedGames.toArray();
  const mistakes = await db.myMistakes.toArray();
  const daily = await db.dailyActivity.toArray();

  const backupData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    profile,
    puzzles,
    history,
    games,
    mistakes,
    daily,
  };

  return JSON.stringify(backupData, null, 2);
}

export async function importDatabaseBackup(jsonString: string): Promise<boolean> {
  try {
    const data = JSON.parse(jsonString);
    if (!data || typeof data !== 'object') return false;

    if (data.profile) {
      await db.userProfile.put({ ...data.profile, id: 1 });
    }
    if (Array.isArray(data.puzzles) && data.puzzles.length > 0) {
      await db.puzzles.bulkPut(data.puzzles);
    }
    if (Array.isArray(data.history)) {
      await db.puzzleHistory.clear();
      await db.puzzleHistory.bulkAdd(data.history);
    }
    if (Array.isArray(data.games)) {
      await db.savedGames.clear();
      await db.savedGames.bulkAdd(data.games);
    }
    if (Array.isArray(data.mistakes)) {
      await db.myMistakes.clear();
      await db.myMistakes.bulkAdd(data.mistakes);
    }
    if (Array.isArray(data.daily)) {
      await db.dailyActivity.bulkPut(data.daily);
    }
    return true;
  } catch (e) {
    console.error('Failed to import database backup', e);
    return false;
  }
}
