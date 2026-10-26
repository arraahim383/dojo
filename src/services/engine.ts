// EngineService: two Stockfish Web Workers (one for analysis, one for bots).
//
// Rules this file guarantees:
// - Every score it returns is from WHITE's point of view (UCI reports scores from the side to move).
// - Searches run strictly one at a time per worker: the next "go" is only sent after the previous
//   search's "bestmove" arrived, so a stopped search can never answer the next request.
// - Nothing heavy ever runs on the main thread. If Stockfish cannot load, the app shows a banner
//   (see engine.onStatusChange) instead of silently switching to a weak JS engine.
import { Chess, type Move } from 'chess.js';
import { asset } from './paths';

export interface EngineLine {
  multipv: number;
  depth: number;
  scoreCp?: number; // White's point of view, centipawns
  mate?: number; // White's point of view: +3 = White mates in 3, -2 = Black mates in 2
  pv: string; // UCI moves, space separated, e.g. "e2e4 c7c5 g1f3"
  pvSan: string[]; // same line in SAN, e.g. ["e4", "c5", "Nf3"]
  bestMove: string; // first move of pv (UCI)
  evalFormatted: string; // "+1.4", "-0.3", "#3", "-#2"
}

export interface EngineAnalysis {
  fen: string;
  lines: EngineLine[];
  bestMove: string; // UCI
  depth: number;
  terminal?: 'checkmate' | 'stalemate' | 'draw';
  failed?: boolean; // engine unavailable
}

export interface EvalOptions {
  depth?: number;
  movetime?: number;
  multiPv?: number;
  timeoutMs?: number; // soft limit for depth searches; sends "stop" and returns the partial result
  onUpdate?: (partial: EngineAnalysis) => void;
}

export type EngineStatus = 'loading' | 'ready' | 'failed';

interface Job {
  fen: string;
  turn: 'w' | 'b';
  setup: string[];
  go: string;
  lines: Map<number, EngineLine>;
  depth: number;
  timeoutMs?: number;
  timer?: ReturnType<typeof setTimeout>;
  onUpdate?: (a: EngineAnalysis) => void;
  resolve: (a: EngineAnalysis) => void;
}

// Scores ---------------------------------------------------------------------------------------

export function formatEval(scoreCp?: number, mate?: number): string {
  if (mate !== undefined) return mate > 0 ? `#${mate}` : `-#${Math.abs(mate)}`;
  if (scoreCp === undefined) return '0.0';
  const pawns = (scoreCp / 100).toFixed(1);
  return scoreCp > 0 ? `+${pawns}` : pawns === '-0.0' ? '0.0' : pawns;
}

export function uciLineToSan(fen: string, uciMoves: string[], max = 12): string[] {
  const out: string[] = [];
  try {
    const c = new Chess(fen);
    for (const u of uciMoves.slice(0, max)) {
      const m: Move = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || undefined });
      out.push(m.san);
    }
  } catch {
    // stop at the first move that does not apply
  }
  return out;
}

function terminalAnalysis(fen: string): EngineAnalysis | null {
  try {
    const c = new Chess(fen);
    if (c.isCheckmate()) {
      // The side to move is mated. No score is attached; use whiteWinPercent(line, terminal, fen).
      return {
        fen,
        lines: [{ multipv: 1, depth: 0, pv: '', pvSan: [], bestMove: '', evalFormatted: c.turn() === 'w' ? '0-1' : '1-0' }],
        bestMove: '',
        depth: 0,
        terminal: 'checkmate',
      };
    }
    if (c.isStalemate() || c.isDraw()) {
      return {
        fen,
        lines: [{ multipv: 1, depth: 0, scoreCp: 0, pv: '', pvSan: [], bestMove: '', evalFormatted: '½-½' }],
        bestMove: '',
        depth: 0,
        terminal: c.isStalemate() ? 'stalemate' : 'draw',
      };
    }
  } catch {
    // invalid FEN: let the caller handle
  }
  return null;
}

// One worker -----------------------------------------------------------------------------------

class StockfishWorker {
  status: EngineStatus = 'loading';
  private worker: Worker | null = null;
  private current: Job | null = null;
  private queue: Job[] = [];
  private readyResolvers: Array<() => void> = [];
  private onStatus: (s: EngineStatus) => void;

  constructor(private name: string, onStatus: (s: EngineStatus) => void) {
    this.onStatus = onStatus;
    if (typeof window === 'undefined') return;
    try {
      this.worker = new Worker(asset('stockfish/stockfish.js'));
      this.worker.onmessage = (e: MessageEvent) => this.handleLine(String(e.data ?? ''));
      this.worker.onerror = (err) => {
        console.error(`[engine:${this.name}] worker error`, err);
        this.fail();
      };
      this.worker.postMessage('uci');
      // Loading the WASM can take a few seconds on slow phones; give it plenty of time.
      setTimeout(() => {
        if (this.status === 'loading') this.fail();
      }, 30000);
    } catch (err) {
      console.error(`[engine:${this.name}] could not start`, err);
      this.fail();
    }
  }

  private fail() {
    if (this.status === 'failed') return;
    this.status = 'failed';
    this.onStatus('failed');
    this.readyResolvers.splice(0).forEach((r) => r());
    // resolve everything pending so callers never hang
    const pending = [this.current, ...this.queue].filter(Boolean) as Job[];
    this.current = null;
    this.queue = [];
    pending.forEach((j) => j.resolve({ fen: j.fen, lines: [], bestMove: '', depth: 0, failed: true }));
  }

  waitReady(): Promise<void> {
    if (this.status !== 'loading') return Promise.resolve();
    return new Promise((r) => this.readyResolvers.push(r));
  }

  private send(cmd: string) {
    this.worker?.postMessage(cmd);
  }

  private handleLine(raw: string) {
    const line = raw.trim();
    if (!line) return;
    if (line === 'uciok') {
      this.send('isready');
      return;
    }
    if (line === 'readyok') {
      if (this.status === 'loading') {
        this.status = 'ready';
        this.onStatus('ready');
        this.readyResolvers.splice(0).forEach((r) => r());
        this.pump();
      }
      return;
    }
    const job = this.current;
    if (!job) return;

    if (line.startsWith('info') && line.includes(' pv ') && line.includes(' score ')) {
      if (line.includes(' lowerbound') || line.includes(' upperbound')) return;
      const parsed = this.parseInfo(line, job);
      if (parsed) {
        job.lines.set(parsed.multipv, parsed);
        job.depth = Math.max(job.depth, parsed.depth);
        job.onUpdate?.(this.snapshot(job));
      }
      return;
    }

    if (line.startsWith('bestmove')) {
      const best = line.split(' ')[1];
      if (job.timer) clearTimeout(job.timer);
      this.current = null;
      const result = this.snapshot(job);
      if (best && best !== '(none)') result.bestMove = best;
      job.resolve(result);
      this.pump();
    }
  }

  private parseInfo(line: string, job: Job): EngineLine | null {
    const t = line.split(' ');
    const get = (k: string) => {
      const i = t.indexOf(k);
      return i >= 0 ? t[i + 1] : undefined;
    };
    const pvIdx = t.indexOf('pv');
    const sIdx = t.indexOf('score');
    if (pvIdx < 0 || sIdx < 0) return null;
    const sign = job.turn === 'w' ? 1 : -1;
    let scoreCp: number | undefined;
    let mate: number | undefined;
    if (t[sIdx + 1] === 'cp') scoreCp = sign * parseInt(t[sIdx + 2], 10);
    else if (t[sIdx + 1] === 'mate') mate = sign * parseInt(t[sIdx + 2], 10);
    const moves = t.slice(pvIdx + 1).filter(Boolean);
    return {
      multipv: parseInt(get('multipv') || '1', 10),
      depth: parseInt(get('depth') || '0', 10),
      scoreCp,
      mate,
      pv: moves.join(' '),
      pvSan: [], // filled lazily in snapshot (cheap enough for the first 12 plies)
      bestMove: moves[0] || '',
      evalFormatted: formatEval(scoreCp, mate),
    };
  }

  private snapshot(job: Job): EngineAnalysis {
    const lines = [...job.lines.values()]
      .sort((a, b) => a.multipv - b.multipv)
      .map((l) => ({ ...l, pvSan: l.pvSan.length ? l.pvSan : uciLineToSan(job.fen, l.pv.split(' ')) }));
    return { fen: job.fen, lines, bestMove: lines[0]?.bestMove || '', depth: job.depth };
  }

  private pump() {
    if (this.status !== 'ready' || this.current || this.queue.length === 0) return;
    const job = this.queue.shift()!;
    this.current = job;
    job.setup.forEach((c) => this.send(c));
    this.send(`position fen ${job.fen}`);
    this.send(job.go);
    if (job.timeoutMs) {
      job.timer = setTimeout(() => {
        if (this.current === job) this.send('stop'); // bestmove (with the partial result) follows
      }, job.timeoutMs);
    }
  }

  run(fen: string, setup: string[], go: string, opts: { timeoutMs?: number; onUpdate?: (a: EngineAnalysis) => void } = {}): Promise<EngineAnalysis> {
    if (this.status === 'failed') return Promise.resolve({ fen, lines: [], bestMove: '', depth: 0, failed: true });
    let turn: 'w' | 'b' = 'w';
    try {
      turn = new Chess(fen).turn();
    } catch {
      return Promise.resolve({ fen, lines: [], bestMove: '', depth: 0, failed: true });
    }
    return new Promise((resolve) => {
      this.queue.push({ fen, turn, setup, go, lines: new Map(), depth: 0, timeoutMs: opts.timeoutMs, onUpdate: opts.onUpdate, resolve });
      this.pump();
    });
  }

  /** Drop queued (not yet started) jobs and stop the running one; their promises resolve with what they have. */
  cancelAll() {
    const dropped = this.queue.splice(0);
    dropped.forEach((j) => j.resolve({ fen: j.fen, lines: [], bestMove: '', depth: 0 }));
    if (this.current) this.send('stop');
  }

  terminate() {
    this.worker?.terminate();
    this.worker = null;
  }
}

// Bots ---------------------------------------------------------------------------------------

/**
 * Strength recipe per bot rating. Stockfish's own UCI_Elo limiter plays far weaker than its number
 * (and ignores Skill Level), so every bot except the top one uses this one consistent scale instead:
 * a search depth, a little imprecision, and a chance of a real mistake (a move that loses material).
 */
interface BotRecipe {
  depth: number;
  multiPv: number;
  noiseCp: number; // pick randomly among moves within this many centipawns of the best
  mistakeChance: number; // play a move that loses at least `mistakeMinLoss`
  mistakeMinLoss: number;
  randomChance: number; // play any legal move
}

function botRecipe(elo: number): BotRecipe {
  if (elo <= 300) return { depth: 1, multiPv: 60, noiseCp: 60, mistakeChance: 0.3, mistakeMinLoss: 200, randomChance: 0.1 };
  if (elo <= 450) return { depth: 1, multiPv: 60, noiseCp: 50, mistakeChance: 0.22, mistakeMinLoss: 200, randomChance: 0.03 };
  if (elo <= 650) return { depth: 2, multiPv: 60, noiseCp: 40, mistakeChance: 0.15, mistakeMinLoss: 150, randomChance: 0 };
  if (elo <= 850) return { depth: 3, multiPv: 60, noiseCp: 35, mistakeChance: 0.1, mistakeMinLoss: 150, randomChance: 0 };
  if (elo <= 1050) return { depth: 4, multiPv: 40, noiseCp: 30, mistakeChance: 0.07, mistakeMinLoss: 120, randomChance: 0 };
  if (elo <= 1250) return { depth: 5, multiPv: 30, noiseCp: 25, mistakeChance: 0.05, mistakeMinLoss: 100, randomChance: 0 };
  if (elo <= 1450) return { depth: 6, multiPv: 20, noiseCp: 20, mistakeChance: 0.035, mistakeMinLoss: 100, randomChance: 0 };
  if (elo <= 1650) return { depth: 7, multiPv: 8, noiseCp: 15, mistakeChance: 0.025, mistakeMinLoss: 80, randomChance: 0 };
  if (elo <= 1850) return { depth: 8, multiPv: 6, noiseCp: 12, mistakeChance: 0.015, mistakeMinLoss: 60, randomChance: 0 };
  if (elo <= 2100) return { depth: 10, multiPv: 5, noiseCp: 8, mistakeChance: 0.01, mistakeMinLoss: 50, randomChance: 0 };
  return { depth: 12, multiPv: 4, noiseCp: 5, mistakeChance: 0.005, mistakeMinLoss: 40, randomChance: 0 };
}

export interface BotMoveResult {
  move: string; // UCI ('' if no legal move)
  san?: string;
  fromBook?: boolean;
  failed?: boolean;
}

// Engine service -------------------------------------------------------------------------------

export class EngineService {
  private analysisWorker: StockfishWorker;
  private botWorker: StockfishWorker;
  private statusListeners = new Set<(s: EngineStatus) => void>();

  constructor() {
    const notify = () => this.statusListeners.forEach((l) => l(this.status));
    this.analysisWorker = new StockfishWorker('analysis', notify);
    this.botWorker = new StockfishWorker('bot', notify);
  }

  get status(): EngineStatus {
    const a = this.analysisWorker.status;
    const b = this.botWorker.status;
    if (a === 'failed' || b === 'failed') return 'failed';
    if (a === 'ready' && b === 'ready') return 'ready';
    return 'loading';
  }

  onStatusChange(listener: (s: EngineStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  async waitReady(): Promise<void> {
    await Promise.all([this.analysisWorker.waitReady(), this.botWorker.waitReady()]);
  }

  /** Full-strength analysis. Scores are from White's point of view. */
  async evaluatePosition(fen: string, options: EvalOptions = {}): Promise<EngineAnalysis> {
    const terminal = terminalAnalysis(fen);
    if (terminal) return terminal;
    const multiPv = Math.max(1, options.multiPv || 1);
    const setup = ['setoption name UCI_LimitStrength value false', 'setoption name Skill Level value 20', `setoption name MultiPV value ${multiPv}`];
    const go = options.movetime ? `go movetime ${options.movetime}` : `go depth ${options.depth || 12}`;
    return this.analysisWorker.run(fen, setup, go, {
      timeoutMs: options.movetime ? undefined : options.timeoutMs ?? 30000,
      onUpdate: options.onUpdate,
    });
  }

  /** Stop analysis work that is queued or running (e.g. when leaving the Review screen). */
  cancelAnalysis() {
    this.analysisWorker.cancelAll();
  }

  /**
   * A bot move for the given rating, using the botRecipe() scale (depth + imprecision + real
   * mistakes). Ratings of 2400+ play at full strength.
   */
  async getBotMove(fen: string, elo: number, book?: string[]): Promise<BotMoveResult> {
    let chess: Chess;
    try {
      chess = new Chess(fen);
    } catch {
      return { move: '' };
    }
    const legal = chess.moves({ verbose: true });
    if (legal.length === 0) return { move: '' };
    const toUci = (m: Move) => `${m.from}${m.to}${m.promotion || ''}`;

    const randomLegal = (): BotMoveResult => {
      const m = legal[Math.floor(Math.random() * legal.length)];
      return { move: toUci(m), san: m.san };
    };

    if (this.botWorker.status === 'failed') return { ...randomLegal(), failed: true };

    // Personality opening moves: first 4 moves, 85% of the time, and only if the book move is
    // reasonable here (within a tolerance of Stockfish's best move at a quick depth).
    const fullmove = parseInt(fen.split(' ')[5] || '1', 10);
    if (book && book.length && fullmove <= 4 && Math.random() < 0.85) {
      const a = await this.botWorker.run(
        fen,
        ['setoption name UCI_LimitStrength value false', 'setoption name Skill Level value 20', 'setoption name MultiPV value 10'],
        'go depth 8'
      );
      const sign = chess.turn() === 'w' ? 1 : -1;
      const val = (l: EngineLine) => sign * (l.mate !== undefined ? (l.mate > 0 ? 10000 - l.mate : -10000 - l.mate) : l.scoreCp ?? 0);
      const best = a.lines[0] ? val(a.lines[0]) : 0;
      const tolerance = elo < 1000 ? 120 : 60;
      for (const u of book) {
        const line = a.lines.find((l) => l.bestMove === u || l.bestMove.slice(0, 4) === u);
        if (line && best - val(line) <= tolerance) {
          const m = legal.find((x) => toUci(x) === line.bestMove);
          if (m) return { move: toUci(m), san: m.san, fromBook: true };
        }
      }
    }

    // Top bot and drills: full strength
    if (elo >= 2400) {
      const a = await this.botWorker.run(
        fen,
        ['setoption name UCI_LimitStrength value false', 'setoption name Skill Level value 20', 'setoption name MultiPV value 1'],
        `go movetime ${elo >= 3000 ? 800 : 1000}`
      );
      const m = legal.find((x) => toUci(x) === a.bestMove);
      return m ? { move: toUci(m), san: m.san } : { ...randomLegal(), failed: a.failed };
    }

    const r = botRecipe(elo);
    if (Math.random() < r.randomChance) return randomLegal();
    const a = await this.botWorker.run(
      fen,
      ['setoption name UCI_LimitStrength value false', 'setoption name Skill Level value 20', `setoption name MultiPV value ${Math.min(r.multiPv, legal.length)}`],
      `go depth ${r.depth}`
    );
    const sign = chess.turn() === 'w' ? 1 : -1;
    const val = (l: EngineLine) => sign * (l.mate !== undefined ? (l.mate > 0 ? 10000 - l.mate : -10000 - l.mate) : l.scoreCp ?? 0);
    const scored = a.lines.filter((l) => legal.some((m) => toUci(m) === l.bestMove)).map((l) => ({ uci: l.bestMove, v: val(l) }));
    if (scored.length === 0) return { ...randomLegal(), failed: a.failed };
    scored.sort((x, y) => y.v - x.v);
    const best = scored[0].v;
    let pool = scored.filter((x) => best - x.v <= r.noiseCp);
    if (Math.random() < r.mistakeChance) {
      // a real mistake, but never walking into mate when something else is available
      const mistakes = scored.filter((x) => best - x.v >= r.mistakeMinLoss && x.v > -9000);
      if (mistakes.length) pool = mistakes;
    }
    const pick = pool[Math.floor(Math.random() * pool.length)].uci;
    const m = legal.find((x) => toUci(x) === pick)!;
    return { move: toUci(m), san: m.san };
  }

  /** Full-strength engine move (drills). */
  async getBestMove(fen: string): Promise<BotMoveResult> {
    return this.getBotMove(fen, 3200);
  }

  /**
   * Coach Mode blunder check. Returns how much the mover loses (in centipawns, mover's view)
   * by playing `uci` instead of the best move. Uses the analysis worker at a shallow depth.
   */
  async checkMoveQuality(fenBefore: string, uci: string, depth = 10): Promise<{ isBlunder: boolean; lossCp: number; allowsMate: boolean; bestMove: string; bestSan?: string; reason?: string }> {
    let c: Chess;
    let mover: 'w' | 'b';
    try {
      c = new Chess(fenBefore);
      mover = c.turn();
      c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || 'q' });
    } catch {
      return { isBlunder: false, lossCp: 0, allowsMate: false, bestMove: '' };
    }
    if (c.isCheckmate()) return { isBlunder: false, lossCp: 0, allowsMate: false, bestMove: uci };
    const [before, after] = await Promise.all([
      this.evaluatePosition(fenBefore, { depth }),
      this.evaluatePosition(c.fen(), { depth }),
    ]);
    if (before.failed || after.failed || !before.lines[0] || !after.lines[0]) {
      return { isBlunder: false, lossCp: 0, allowsMate: false, bestMove: '' };
    }
    const sign = mover === 'w' ? 1 : -1;
    const asCp = (l: EngineLine) => (l.mate !== undefined ? (l.mate > 0 ? 10000 - l.mate : -10000 - l.mate) : l.scoreCp ?? 0);
    const beforeCp = sign * asCp(before.lines[0]);
    const afterCp = sign * asCp(after.lines[0]);
    const allowsMate = after.lines[0].mate !== undefined && sign * after.lines[0].mate < 0 && !(before.lines[0].mate !== undefined && sign * before.lines[0].mate < 0);
    const lossCp = Math.max(0, beforeCp - afterCp);
    const isBlunder = allowsMate || (lossCp >= 200 && beforeCp > -500);
    const bestSan = before.lines[0].pvSan[0];
    let reason: string | undefined;
    if (allowsMate) reason = `This move allows a forced checkmate (${formatEval(undefined, after.lines[0].mate)}).`;
    else if (isBlunder) reason = `This move loses about ${(lossCp / 100).toFixed(1)} pawns of value compared with the best move.`;
    return { isBlunder, lossCp, allowsMate, bestMove: before.bestMove, bestSan, reason };
  }

  terminate() {
    this.analysisWorker.terminate();
    this.botWorker.terminate();
  }
}

export const engine = new EngineService();

// Win chance helpers (shared by Review, eval bar, coach) -----------------------------------------

/** Win chance (0-100) for White from a White-POV line. */
export function whiteWinPercent(line: Pick<EngineLine, 'scoreCp' | 'mate'> | undefined, terminal?: EngineAnalysis['terminal'], fen?: string): number {
  if (terminal === 'checkmate' && fen) {
    try {
      return new Chess(fen).turn() === 'w' ? 0 : 100;
    } catch {
      return 50;
    }
  }
  if (terminal === 'stalemate' || terminal === 'draw') return 50;
  if (!line) return 50;
  if (line.mate !== undefined) return line.mate > 0 ? 100 : line.mate < 0 ? 0 : 50;
  const cp = Math.max(-2000, Math.min(2000, line.scoreCp ?? 0));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}
