// Puzzles: a bundled set of real Lichess puzzles (imported into IndexedDB on first run),
// CSV imports, and the Lichess API (daily puzzle, themed puzzles, fallback).
//
// ActivePuzzle convention: `fen` is the position where YOU move; `solution` is
// [your move, reply, your move, reply, ...] in UCI.
import { Chess } from 'chess.js';
import { db, getUserProfile, updateUserProfile, type LocalPuzzle } from '../db';
import { detectThemes } from './puzzleThemes';
import { asset, hasServer } from './paths';

export interface ActivePuzzle {
  id: string;
  source: 'lichess' | 'local_db' | 'mistake';
  fen: string;
  lastMoveUci?: string; // opponent move that led to the puzzle position (highlighted)
  solution: string[];
  rating: number;
  themes: string[];
  gameUrl?: string;
  description?: string;
}

export type PuzzleDifficulty = 'easiest' | 'easier' | 'normal' | 'harder' | 'hardest';

export class NoPuzzlesError extends Error {
  constructor(msg = 'No puzzles available right now.') {
    super(msg);
  }
}

export const BUNDLE_VERSION = 2;

/** Themes the bundled puzzles are tagged with (shown in Themes mode). */
export const LOCAL_THEMES = [
  'mateIn1',
  'mateIn2',
  'mateIn3',
  'backRankMate',
  'smotheredMate',
  'fork',
  'pin',
  'skewer',
  'discoveredAttack',
  'capturingDefender',
  'attraction',
  'greekGift',
  'hangingPiece',
  'sacrifice',
  'promotion',
  'attackingF2F7',
  'endgame',
  'rookEndgame',
  'pawnEndgame',
];

const LENGTH_OR_PHASE = new Set(['oneMove', 'short', 'long', 'veryLong', 'opening', 'middlegame', 'endgame', 'mate', 'crushing', 'advantage', 'equality', 'master', 'masterVsMaster', 'superGM']);

/** The most specific theme of a puzzle (used for strengths/weaknesses stats). */
export function primaryTheme(themes: string[]): string {
  return themes.find((t) => !LENGTH_OR_PHASE.has(t)) || themes.find((t) => t === 'endgame' || t === 'mate') || 'tactics';
}

class PuzzleService {
  private bundlePromise: Promise<void> | null = null;
  bundleProgress = 0; // 0-100

  // ---------- Rating ----------
  calculateEloDelta(userRating: number, puzzleRating: number, isWin: boolean, totalPuzzlesPlayed: number): number {
    const k = totalPuzzlesPlayed < 30 ? 40 : 20;
    const expected = 1 / (1 + Math.pow(10, (puzzleRating - userRating) / 400));
    return Math.round(k * ((isWin ? 1 : 0) - expected));
  }

  // ---------- Bundled puzzle set ----------
  /** Imports public/data/puzzles.json into IndexedDB once (and again when the bundle version changes). */
  ensureBundledPuzzles(onProgress?: (pct: number) => void): Promise<void> {
    if (onProgress) {
      this.progressListeners.add(onProgress);
      onProgress(this.bundleProgress);
    }
    if (!this.bundlePromise) {
      this.bundlePromise = (async () => {
        const profile = await getUserProfile();
        const count = await db.puzzles.count();
        if (profile.puzzleBundleVersion >= BUNDLE_VERSION && count > 0) {
          this.reportProgress(100);
          return;
        }
        const res = await fetch(asset('data/puzzles.json'));
        if (!res.ok) throw new Error(`Could not load the puzzle set (HTTP ${res.status})`);
        const data: { puzzles: Array<[string, string, string, number, string]> } = await res.json();
        const rows = data.puzzles;
        const batch = 2000;
        for (let i = 0; i < rows.length; i += batch) {
          const chunk: LocalPuzzle[] = rows.slice(i, i + batch).map(([id, fen, moves, rating, themes]) => ({
            id,
            fen,
            moves,
            rating,
            themes: themes ? themes.split(' ') : [],
            gameUrl: `https://lichess.org/training/${id}`,
          }));
          await db.puzzles.bulkPut(chunk);
          this.reportProgress(Math.round(((i + chunk.length) / rows.length) * 100));
        }
        await updateUserProfile({ puzzleBundleVersion: BUNDLE_VERSION });
        this.reportProgress(100);
      })().catch((e) => {
        this.bundlePromise = null; // allow a retry later
        throw e;
      });
    }
    return this.bundlePromise;
  }

  private progressListeners = new Set<(pct: number) => void>();
  private reportProgress(pct: number) {
    this.bundleProgress = pct;
    for (const l of this.progressListeners) l(pct);
    if (pct >= 100) this.progressListeners.clear();
  }

  // ---------- Parsing ----------
  /**
   * Lichess API format: game.pgn already includes the opponent's last move, and puzzle.solution[0]
   * is the SOLVER's first move. Newer responses also include puzzle.fen and puzzle.lastMove.
   */
  parseLichessPuzzle(data: any): ActivePuzzle | null {
    try {
      const p = data?.puzzle;
      if (!p || !Array.isArray(p.solution) || p.solution.length === 0) return null;
      let fen: string | undefined = p.fen;
      let lastMove: string | undefined = p.lastMove;
      if (!fen) {
        const c = new Chess();
        let last: { from: string; to: string; promotion?: string } | null = null;
        for (const san of String(data?.game?.pgn || '').split(/\s+/).filter(Boolean)) {
          last = c.move(san);
        }
        fen = c.fen();
        if (last && !lastMove) lastMove = `${last.from}${last.to}${last.promotion || ''}`;
      }
      // validate the whole solution line
      const check = new Chess(fen);
      for (const u of p.solution as string[]) {
        check.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || undefined });
      }
      return {
        id: `lichess_${p.id}`,
        source: 'lichess',
        fen,
        lastMoveUci: lastMove,
        solution: p.solution,
        rating: p.rating || 1500,
        themes: Array.isArray(p.themes) ? p.themes : [],
        gameUrl: `https://lichess.org/training/${p.id}`,
      };
    } catch (err) {
      console.warn('Skipping a Lichess puzzle that does not validate', err);
      return null;
    }
  }

  /** CSV / bundled format: moves[0] is the opponent's move, played automatically. */
  parseLocalDbPuzzle(record: LocalPuzzle): ActivePuzzle | null {
    try {
      const moves = record.moves.trim().split(/\s+/);
      if (moves.length < 2) return null;
      const c = new Chess(record.fen);
      const opp = moves[0];
      c.move({ from: opp.slice(0, 2), to: opp.slice(2, 4), promotion: opp[4] || undefined });
      const fen = c.fen();
      const check = new Chess(fen);
      for (const u of moves.slice(1)) check.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || undefined });
      return {
        id: `local_${record.id}`,
        source: 'local_db',
        fen,
        lastMoveUci: opp,
        solution: moves.slice(1),
        rating: record.rating,
        themes: record.themes || [],
        gameUrl: record.gameUrl,
      };
    } catch {
      return null;
    }
  }

  // ---------- Selection ----------
  private async seenIds(): Promise<Set<string>> {
    return new Set((await db.seenPuzzles.toCollection().primaryKeys()) as string[]);
  }

  async markSeen(puzzleId: string): Promise<void> {
    await db.seenPuzzles.put({ id: puzzleId.replace(/^(local_|lichess_)/, ''), seenAt: Date.now() });
  }

  /** A random unseen local puzzle near `target` (window widens until something is found). */
  private async pickLocal(target: number, theme?: string): Promise<ActivePuzzle | null> {
    const seen = await this.seenIds();
    const windows = [50, 100, 200, 300, 500];
    if (theme) {
      const all = await db.puzzles.where('themes').equals(theme).toArray();
      if (all.length === 0) return null;
      for (const w of [...windows, 5000]) {
        const fresh = all.filter((p) => Math.abs(p.rating - target) <= w && !seen.has(p.id));
        if (fresh.length) return this.parseLocalDbPuzzle(fresh[Math.floor(Math.random() * fresh.length)]);
      }
      return this.parseLocalDbPuzzle(all[Math.floor(Math.random() * all.length)]); // everything seen: allow repeats
    }
    for (const w of windows) {
      const coll = db.puzzles.where('rating').between(target - w, target + w, true, true);
      const n = await coll.count();
      if (n === 0) continue;
      for (let tries = 0; tries < 8; tries++) {
        const rec = await db.puzzles.where('rating').between(target - w, target + w, true, true).offset(Math.floor(Math.random() * n)).first();
        if (rec && !seen.has(rec.id)) {
          const parsed = this.parseLocalDbPuzzle(rec);
          if (parsed) return parsed;
        }
      }
      // most of this window has been seen: scan it for anything unseen
      const fresh = (await coll.toArray()).filter((p) => !seen.has(p.id));
      if (fresh.length) return this.parseLocalDbPuzzle(fresh[Math.floor(Math.random() * fresh.length)]);
    }
    // everything nearby has been seen: allow repeats
    const any = await db.puzzles.where('rating').between(target - 150, target + 150).toArray();
    return any.length ? this.parseLocalDbPuzzle(any[Math.floor(Math.random() * any.length)]) : null;
  }

  private async fetchLichess(path: string): Promise<ActivePuzzle | null> {
    if (!hasServer) return null;
    try {
      const res = await fetch(path);
      if (!res.ok) return null;
      return this.parseLichessPuzzle(await res.json());
    } catch {
      return null;
    }
  }

  private lichessDifficulty(target: number): PuzzleDifficulty {
    // Lichess difficulty is relative to 1500 for anonymous requests
    if (target < 1000) return 'easiest';
    if (target < 1350) return 'easier';
    if (target < 1650) return 'normal';
    if (target < 1950) return 'harder';
    return 'hardest';
  }

  async getNextPuzzle(params: { mode: 'rated' | 'rush' | 'survival' | 'daily' | 'themes'; targetRating?: number; theme?: string }): Promise<ActivePuzzle> {
    const { mode, targetRating = 1000, theme } = params;
    await this.ensureBundledPuzzles().catch((e) => console.warn(e));

    if (mode === 'daily') {
      const daily = await this.fetchLichess('/api/puzzle/daily');
      if (daily) return daily;
      // offline: a puzzle picked by today's date
      const n = await db.puzzles.count();
      if (n > 0) {
        const day = Math.floor(Date.now() / 86_400_000);
        const rec = await db.puzzles.orderBy('rating').offset((day * 7919) % n).first();
        const parsed = rec && this.parseLocalDbPuzzle(rec);
        if (parsed) return { ...parsed, description: hasServer ? 'Offline daily puzzle (Lichess could not be reached).' : 'Daily puzzle from the built-in Lichess set.' };
      }
      throw new NoPuzzlesError();
    }

    if (mode === 'themes' && theme) {
      const local = await this.pickLocal(targetRating, theme);
      if (local) return local;
      const q = new URLSearchParams({ angle: theme, difficulty: this.lichessDifficulty(targetRating) });
      const remote = await this.fetchLichess(`/api/puzzle/next?${q}`);
      if (remote) return remote;
      throw new NoPuzzlesError(`No "${theme}" puzzles available right now.`);
    }

    const local = await this.pickLocal(targetRating);
    if (local) return local;
    const remote = await this.fetchLichess(`/api/puzzle/next?difficulty=${this.lichessDifficulty(targetRating)}`);
    if (remote) return remote;
    throw new NoPuzzlesError('No puzzles available. Import a Lichess puzzle CSV from the Puzzles screen.');
  }

  /** 12 real puzzles at increasing ratings for the placement test. */
  async getPlacementSet(): Promise<ActivePuzzle[]> {
    await this.ensureBundledPuzzles();
    const targets = [400, 550, 700, 850, 1000, 1150, 1300, 1450, 1600, 1700, 1800, 1900];
    const out: ActivePuzzle[] = [];
    for (const t of targets) {
      const p = await this.pickLocal(t);
      if (p) out.push(p);
    }
    return out;
  }

  // ---------- Checking moves ----------
  /** Correct if it matches the solution, or if it is any checkmate on the final move. */
  isMoveCorrect(currentFen: string, userUci: string, expectedUci: string, isFinalMove: boolean): boolean {
    if (userUci.toLowerCase() === (expectedUci || '').toLowerCase()) return true;
    if (isFinalMove) {
      try {
        const c = new Chess(currentFen);
        c.move({ from: userUci.slice(0, 2), to: userUci.slice(2, 4), promotion: userUci[4] || 'q' });
        if (c.isCheckmate()) return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  // ---------- CSV import ----------
  /** Imports a Lichess-format CSV (PuzzleId,FEN,Moves,Rating,...). Detects themes when missing. */
  async importLichessCsv(csvContent: string, onProgress?: (count: number) => void): Promise<number> {
    const lines = csvContent.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 1) return 0;
    let headers = lines[0].split(',').map((h) => h.trim());
    let start = 1;
    if (!headers.includes('PuzzleId')) {
      // official dumps without a header row
      headers = ['PuzzleId', 'FEN', 'Moves', 'Rating', 'RatingDeviation', 'Popularity', 'NbPlays', 'Themes', 'GameUrl', 'OpeningTags'];
      start = 0;
    }
    const idx = (h: string) => headers.indexOf(h);
    const [iId, iFen, iMoves, iRating, iThemes, iUrl] = ['PuzzleId', 'FEN', 'Moves', 'Rating', 'Themes', 'GameUrl'].map(idx);
    if (iId < 0 || iFen < 0 || iMoves < 0) throw new Error('CSV is missing PuzzleId, FEN or Moves');

    let imported = 0;
    let batch: LocalPuzzle[] = [];
    for (let i = start; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (cols.length < 3) continue;
      const fen = cols[iFen];
      const moves = cols[iMoves]?.trim();
      if (!fen || !moves) continue;
      let themes = iThemes >= 0 && cols[iThemes] ? cols[iThemes].split(/\s+/).filter(Boolean) : [];
      if (themes.length === 0) themes = detectThemes(fen, moves);
      if (themes.length === 0) continue; // line did not validate
      batch.push({
        id: cols[iId],
        fen,
        moves,
        rating: parseInt(cols[iRating] || '1500', 10) || 1500,
        themes,
        gameUrl: iUrl >= 0 && cols[iUrl] ? cols[iUrl] : `https://lichess.org/training/${cols[iId]}`,
      });
      if (batch.length >= 1000) {
        await db.puzzles.bulkPut(batch);
        imported += batch.length;
        batch = [];
        onProgress?.(imported);
        await new Promise((r) => setTimeout(r, 0)); // keep the page responsive
      }
    }
    if (batch.length) {
      await db.puzzles.bulkPut(batch);
      imported += batch.length;
      onProgress?.(imported);
    }
    return imported;
  }
}

export const puzzleService = new PuzzleService();
