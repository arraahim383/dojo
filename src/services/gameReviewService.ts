// Game Review: grades every move by comparing the position BEFORE and AFTER it.
//
// For move i (from position P[i-1] to P[i]):
//   wpBefore = mover's win chance at P[i-1] (Stockfish's best line)
//   wpAfter  = mover's win chance at P[i]
//   EP lost  = max(0, wpBefore - wpAfter) / 100
// All engine scores are from White's point of view and converted to the mover's view here.
import { Chess, type Move, type Square } from 'chess.js';
import { engine, whiteWinPercent, formatEval, type EngineAnalysis, type EngineLine } from './engine';
import { loadOpeningBook, isBookPosition, openingNameAt } from './openingBook';

export type MoveClassification =
  | 'brilliant'
  | 'great'
  | 'best'
  | 'excellent'
  | 'good'
  | 'book'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'
  | 'miss';

export interface AnalyzedMove {
  ply: number; // 1-based half-move
  moveNumber: number;
  turn: 'w' | 'b';
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
  evalCp: number; // after the move, White's view (mates mapped to +/-10000)
  mate?: number; // after the move, White's view
  evalFormatted: string; // after the move, White's view
  winChanceWhite: number; // after the move, 0-100
  winChanceMoverBefore: number;
  winChanceMoverAfter: number;
  expectedPointsMover: number; // 0-1 after the move
  expectedPointsLost: number;
  accuracy: number; // 0-100
  classification: MoveClassification;
  bestEngineMove: string; // UCI of the engine's best move in the position before
  bestEngineSan?: string;
  bestEnginePv?: string;
  bestLinesBefore: Array<{ pvSan: string[]; eval: string }>; // for Explain grounding
  secondBestMove?: string;
  secondBestGap?: number; // how much worse (0-1) the engine's 2nd choice was
  isPieceSacrifice?: boolean;
  phase: 'opening' | 'middlegame' | 'endgame';
  openingName?: string;
}

export interface GameReviewReport {
  moves: AnalyzedMove[];
  white: string;
  black: string;
  userColor?: 'white' | 'black';
  openingName?: string;
  whiteAccuracy: number;
  blackAccuracy: number;
  openingAccuracy: { white: number | null; black: number | null };
  middlegameAccuracy: { white: number | null; black: number | null };
  endgameAccuracy: { white: number | null; black: number | null };
  classificationCounts: {
    white: Record<MoveClassification, number>;
    black: Record<MoveClassification, number>;
  };
  keyMoments: AnalyzedMove[];
  evalHistory: Array<{ ply: number; evalCp: number; wpWhite: number }>; // ply 0 = start position
  gameKey: string; // stable id of this game (for counting distinct reviewed games)
}

const VAL: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

export function calculateAccuracy(wpMoverBefore: number, wpMoverAfter: number): number {
  const drop = Math.max(0, wpMoverBefore - wpMoverAfter);
  const acc = 103.1668 * Math.exp(-0.04354 * drop) - 3.1669;
  return Math.max(0, Math.min(100, acc));
}

/** Static exchange evaluation: material the side to move can win by capturing on `sq`. */
function see(c: Chess, sq: Square, depth = 0): number {
  if (depth > 12) return 0;
  const caps = c.moves({ verbose: true }).filter((m) => m.to === sq && m.captured);
  if (caps.length === 0) return 0;
  caps.sort((a, b) => VAL[a.piece] - VAL[b.piece]);
  const m = caps[0];
  const gain = VAL[m.captured!] ;
  c.move(m);
  const reply = see(c, sq, depth + 1);
  c.undo();
  return Math.max(0, gain - reply);
}

/** A move is a piece sacrifice if the moved piece (knight or more) can be won back for less. */
function isPieceSacrifice(fenBefore: string, move: Move): boolean {
  if (VAL[move.piece] < 3) return false;
  try {
    const c = new Chess(fenBefore);
    c.move({ from: move.from, to: move.to, promotion: move.promotion });
    const gained = move.captured ? VAL[move.captured] : 0;
    const opponentWins = see(c, move.to as Square);
    return opponentWins - gained >= 2;
  } catch {
    return false;
  }
}

function nonPawnMaterial(fen: string): number {
  let total = 0;
  for (const ch of fen.split(' ')[0]) {
    const p = ch.toLowerCase();
    if (p === 'n' || p === 'b') total += 3;
    else if (p === 'r') total += 5;
    else if (p === 'q') total += 9;
  }
  return total;
}

function lineCp(line?: EngineLine): number {
  if (!line) return 0;
  if (line.mate !== undefined) return line.mate > 0 ? 10000 : -10000;
  return line.scoreCp ?? 0;
}

function hashString(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

const emptyCounts = (): Record<MoveClassification, number> => ({
  brilliant: 0,
  great: 0,
  best: 0,
  excellent: 0,
  good: 0,
  book: 0,
  inaccuracy: 0,
  mistake: 0,
  blunder: 0,
  miss: 0,
});

export async function analyzePgnGame(
  pgn: string,
  depth: number = 14,
  onProgress?: (progressPercent: number, currentMove: string) => void,
  options: { userColor?: 'white' | 'black'; isCancelled?: () => boolean } = {}
): Promise<GameReviewReport> {
  const game = new Chess();
  try {
    game.loadPgn(pgn.trim());
  } catch (e: any) {
    throw new Error(`Could not read that PGN: ${e?.message || e}`);
  }
  const history = game.history({ verbose: true });
  if (history.length === 0) throw new Error('No moves found in PGN');

  const headers = game.getHeaders();
  // chess.js fills missing PGN headers with '?'
  const named = (v: string | undefined, fallback: string) => (v && v.trim() && v.trim() !== '?' ? v.trim() : fallback);
  const white = named(headers.White, 'White');
  const black = named(headers.Black, 'Black');
  let userColor = options.userColor;
  if (!userColor) {
    if (/\(You\)/.test(white)) userColor = 'white';
    else if (/\(You\)/.test(black)) userColor = 'black';
  }

  await loadOpeningBook();

  // Positions P0..Pn
  const startFen = headers.FEN || new Chess().fen();
  const replay = new Chess(startFen);
  const fens: string[] = [replay.fen()];
  for (const m of history) {
    replay.move(m);
    fens.push(replay.fen());
  }

  // Analyze every position once (MultiPV 2 for "only move" detection)
  const analyses: EngineAnalysis[] = [];
  for (let i = 0; i < fens.length; i++) {
    if (options.isCancelled?.()) throw new Error('cancelled');
    const a = await engine.evaluatePosition(fens[i], { depth, multiPv: 2 });
    if (a.failed) throw new Error('The Stockfish engine is not available, so the game cannot be reviewed.');
    analyses.push(a);
    if (onProgress) {
      const m = history[i - 1];
      const label = m ? `${Math.floor((i - 1) / 2) + 1}${m.color === 'w' ? '.' : '...'} ${m.san}` : 'Start position';
      onProgress(Math.round(((i + 1) / fens.length) * 100), label);
    }
  }

  const wpWhiteAt = (i: number) => whiteWinPercent(analyses[i].lines[0], analyses[i].terminal, fens[i]);

  const moves: AnalyzedMove[] = [];
  let stillInBook = true;
  let openingName: string | undefined;

  for (let i = 1; i < fens.length; i++) {
    const move = history[i - 1];
    const mover = move.color;
    const toMover = (wpWhite: number) => (mover === 'w' ? wpWhite : 100 - wpWhite);
    const before = analyses[i - 1];
    const after = analyses[i];
    const uci = `${move.from}${move.to}${move.promotion || ''}`;

    const wpBefore = toMover(wpWhiteAt(i - 1));
    const wpAfter = toMover(wpWhiteAt(i));
    const epLost = Math.max(0, wpBefore - wpAfter) / 100;
    const bestLine = before.lines[0];
    const secondLine = before.lines[1];
    const deliversMate = after.terminal === 'checkmate';
    const isBest = deliversMate || (!!bestLine && bestLine.bestMove === uci);
    const secondWp = secondLine ? toMover(whiteWinPercent(secondLine)) : undefined;
    const bestWp = bestLine ? toMover(whiteWinPercent(bestLine)) : wpBefore;
    const onlyMoveGap = secondWp !== undefined ? (bestWp - secondWp) / 100 : 0;
    const sacrifice = isPieceSacrifice(fens[i - 1], move);

    // Book: every move so far was in a known opening line
    const inBook = stillInBook && isBookPosition(fens[i]);
    if (!inBook) stillInBook = false;
    const name = openingNameAt(fens[i]);
    if (inBook && name) openingName = name;

    // Phase
    const npm = nonPawnMaterial(fens[i - 1]);
    const phase: AnalyzedMove['phase'] = inBook || i <= 16 ? 'opening' : npm <= 26 ? 'endgame' : 'middlegame';

    const prev = moves[moves.length - 1];
    const prevMove = history[i - 2];
    const isObviousRecapture = !!prevMove?.captured && !!move.captured && prevMove.to === move.to;
    let legalCount = 0;
    try {
      legalCount = new Chess(fens[i - 1]).moves().length;
    } catch {
      legalCount = 0;
    }
    const opponentJustErred = !!prev && (prev.classification === 'mistake' || prev.classification === 'blunder');

    let classification: MoveClassification;
    if (inBook) classification = 'book';
    else if ((isBest || epLost <= 0.02) && sacrifice && wpAfter >= 50 && secondWp !== undefined && secondWp < 97) classification = 'brilliant';
    else if (isBest && !deliversMate && onlyMoveGap >= 0.15 && wpAfter >= 30 && !isObviousRecapture && legalCount > 2) classification = 'great';
    else if (isBest) classification = 'best';
    else if (epLost <= 0.02) classification = 'excellent';
    else if (epLost <= 0.05) classification = 'good';
    else if (opponentJustErred && epLost >= 0.1 && wpBefore >= 60) classification = 'miss';
    else if (epLost <= 0.1) classification = 'inaccuracy';
    else if (epLost <= 0.2) classification = 'mistake';
    else classification = 'blunder';

    const afterLine = after.lines[0];
    moves.push({
      ply: i,
      moveNumber: Math.floor((i - 1) / 2) + 1,
      turn: mover,
      san: move.san,
      uci,
      fenBefore: fens[i - 1],
      fenAfter: fens[i],
      evalCp: after.terminal === 'checkmate' ? (mover === 'w' ? 10000 : -10000) : lineCp(afterLine),
      mate: afterLine?.mate,
      evalFormatted: after.terminal === 'checkmate' ? (mover === 'w' ? '1-0' : '0-1') : afterLine?.evalFormatted ?? formatEval(0),
      winChanceWhite: wpWhiteAt(i),
      winChanceMoverBefore: wpBefore,
      winChanceMoverAfter: wpAfter,
      expectedPointsMover: wpAfter / 100,
      expectedPointsLost: epLost,
      accuracy: calculateAccuracy(wpBefore, wpAfter),
      classification,
      bestEngineMove: bestLine?.bestMove || uci,
      bestEngineSan: bestLine?.pvSan[0],
      bestEnginePv: bestLine?.pvSan.join(' '),
      bestLinesBefore: before.lines.map((l) => ({ pvSan: l.pvSan, eval: l.evalFormatted })),
      secondBestMove: secondLine?.bestMove,
      secondBestGap: secondLine ? onlyMoveGap : undefined,
      isPieceSacrifice: sacrifice,
      phase,
      openingName: name,
    });
  }

  const avg = (arr: AnalyzedMove[]): number | null =>
    arr.length ? Math.round(arr.reduce((s, m) => s + m.accuracy, 0) / arr.length) : null;
  const side = (c: 'w' | 'b') => moves.filter((m) => m.turn === c);
  const phaseAcc = (p: AnalyzedMove['phase']) => ({
    white: avg(side('w').filter((m) => m.phase === p)),
    black: avg(side('b').filter((m) => m.phase === p)),
  });

  const classificationCounts = { white: emptyCounts(), black: emptyCounts() };
  moves.forEach((m) => {
    (m.turn === 'w' ? classificationCounts.white : classificationCounts.black)[m.classification]++;
  });

  // Key moments: the biggest drops (your own moves first when we know your color)
  const bad = moves.filter((m) => m.expectedPointsLost >= 0.1 && m.classification !== 'book');
  const mine = userColor ? bad.filter((m) => m.turn === (userColor === 'white' ? 'w' : 'b')) : bad;
  const pool = mine.length >= 1 ? mine : bad;
  const keyMoments = [...pool].sort((a, b) => b.expectedPointsLost - a.expectedPointsLost).slice(0, 3).sort((a, b) => a.ply - b.ply);

  const evalHistory = fens.map((_, i) => ({
    ply: i,
    evalCp: i === 0 ? lineCp(analyses[0].lines[0]) : moves[i - 1].evalCp,
    wpWhite: wpWhiteAt(i),
  }));

  return {
    moves,
    white,
    black,
    userColor,
    openingName,
    whiteAccuracy: avg(side('w')) ?? 100,
    blackAccuracy: avg(side('b')) ?? 100,
    openingAccuracy: phaseAcc('opening'),
    middlegameAccuracy: phaseAcc('middlegame'),
    endgameAccuracy: phaseAcc('endgame'),
    classificationCounts,
    keyMoments,
    evalHistory,
    gameKey: hashString(startFen + '|' + history.map((m) => m.san).join(' ')),
  };
}
