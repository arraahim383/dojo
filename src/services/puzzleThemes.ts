// Detects common tactical themes in a puzzle line, using the same theme names as Lichess.
// Input is in Lichess CSV format: the FEN before the opponent's last move and the move list,
// where moves[0] is the opponent's move and the solver plays moves[1], moves[3], ...
//
// Only themes that can be detected reliably are tagged. Lichess puzzles fetched from the API
// come with Lichess's own (richer) tags.
import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js';

const VAL: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
const FILES = 'abcdefgh';

const sqFile = (s: Square) => FILES.indexOf(s[0]);
const sqRank = (s: Square) => parseInt(s[1], 10) - 1;
const toSq = (f: number, r: number) => `${FILES[f]}${r + 1}` as Square;

function material(c: Chess, color: Color): number {
  let m = 0;
  for (const row of c.board()) for (const p of row) if (p && p.color === color && p.type !== 'k') m += VAL[p.type];
  return m;
}

function nonPawn(c: Chess): { w: PieceSymbol[]; b: PieceSymbol[] } {
  const out = { w: [] as PieceSymbol[], b: [] as PieceSymbol[] };
  for (const row of c.board()) for (const p of row) if (p && p.type !== 'k' && p.type !== 'p') out[p.color].push(p.type);
  return out;
}

function kingSquare(c: Chess, color: Color): Square | undefined {
  return c.findPiece({ type: 'k', color })[0];
}

/** Squares attacked by the piece standing on `from` (respecting blockers). */
function attacksFrom(c: Chess, from: Square): Square[] {
  const piece = c.get(from);
  if (!piece) return [];
  const out: Square[] = [];
  const f0 = sqFile(from);
  const r0 = sqRank(from);
  const ray = (df: number, dr: number, slide: boolean) => {
    let f = f0 + df;
    let r = r0 + dr;
    while (f >= 0 && f < 8 && r >= 0 && r < 8) {
      const s = toSq(f, r);
      out.push(s);
      if (!slide || c.get(s)) break;
      f += df;
      r += dr;
    }
  };
  switch (piece.type) {
    case 'p': {
      const dir = piece.color === 'w' ? 1 : -1;
      for (const df of [-1, 1]) {
        const f = f0 + df;
        const r = r0 + dir;
        if (f >= 0 && f < 8 && r >= 0 && r < 8) out.push(toSq(f, r));
      }
      break;
    }
    case 'n':
      for (const [df, dr] of [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]) ray(df, dr, false);
      break;
    case 'k':
      for (const [df, dr] of [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]) ray(df, dr, false);
      break;
    case 'b':
      for (const [df, dr] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) ray(df, dr, true);
      break;
    case 'r':
      for (const [df, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) ray(df, dr, true);
      break;
    case 'q':
      for (const [df, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) ray(df, dr, true);
      break;
  }
  return out;
}

function isDefended(c: Chess, sq: Square, byColor: Color): boolean {
  // A piece on sq is defended if another piece of its color attacks sq
  return c.attackers(sq, byColor).length > 0;
}

/** True if the piece on `sq` is pinned to its own king by an enemy slider. */
function isAbsolutelyPinned(c: Chess, sq: Square): boolean {
  const p = c.get(sq);
  if (!p || p.type === 'k') return false;
  const k = kingSquare(c, p.color);
  if (!k) return false;
  const enemy: Color = p.color === 'w' ? 'b' : 'w';
  const before = c.isAttacked(k, enemy);
  if (before) return false;
  const clone = new Chess(c.fen());
  clone.remove(sq);
  return clone.attackers(k, enemy).some((a) => {
    const t = clone.get(a)?.type;
    return t === 'b' || t === 'r' || t === 'q';
  });
}

function between(a: Square, b: Square): Square[] | null {
  const df = sqFile(b) - sqFile(a);
  const dr = sqRank(b) - sqRank(a);
  if (!(df === 0 || dr === 0 || Math.abs(df) === Math.abs(dr))) return null;
  const sf = Math.sign(df);
  const sr = Math.sign(dr);
  const out: Square[] = [];
  let f = sqFile(a) + sf;
  let r = sqRank(a) + sr;
  while (f !== sqFile(b) || r !== sqRank(b)) {
    out.push(toSq(f, r));
    f += sf;
    r += sr;
  }
  return out;
}

export function detectThemes(fen: string, movesStr: string): string[] {
  const moves = movesStr.trim().split(/\s+/);
  const tags = new Set<string>();
  let c: Chess;
  try {
    c = new Chess(fen);
  } catch {
    return [];
  }
  const positions: Chess[] = [];
  const played: Array<{ from: Square; to: Square; piece: PieceSymbol; captured?: PieceSymbol; promotion?: PieceSymbol; san: string }> = [];
  try {
    for (const u of moves) {
      positions.push(new Chess(c.fen()));
      const m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || undefined });
      played.push({ from: m.from, to: m.to, piece: m.piece, captured: m.captured, promotion: m.promotion, san: m.san });
    }
  } catch {
    return [];
  }
  positions.push(new Chess(c.fen()));
  // positions[i] = before moves[i]; positions[moves.length] = final
  const user: Color = positions[1].turn();
  const opp: Color = user === 'w' ? 'b' : 'w';
  const userIdx = moves.map((_, i) => i).filter((i) => i % 2 === 1);
  const userMoves = userIdx.length;
  const final = positions[moves.length];

  // Length
  tags.add(userMoves === 1 ? 'oneMove' : userMoves === 2 ? 'short' : userMoves === 3 ? 'long' : 'veryLong');

  // Mates
  if (final.isCheckmate() && final.turn() === opp) {
    tags.add('mate');
    if (userMoves <= 5) tags.add(`mateIn${userMoves}`);
    const k = kingSquare(final, opp)!;
    const checkers = final.attackers(k, user);
    const lastMove = played[played.length - 1];
    const kf = sqFile(k);
    const kr = sqRank(k);
    const neighbours: Square[] = [];
    for (let df = -1; df <= 1; df++)
      for (let dr = -1; dr <= 1; dr++) {
        if (!df && !dr) continue;
        const f = kf + df;
        const r = kr + dr;
        if (f >= 0 && f < 8 && r >= 0 && r < 8) neighbours.push(toSq(f, r));
      }
    // Smothered: knight mate, every neighbouring square holds one of the king's own pieces
    if (checkers.length === 1 && final.get(checkers[0])?.type === 'n' && neighbours.every((s) => final.get(s)?.color === opp)) {
      tags.add('smotheredMate');
    } else {
      // Back rank: king on its first rank, mated along that rank by a rook or queen, escape squares in front blocked by own pieces
      const backRank = opp === 'w' ? 0 : 7;
      const forward = opp === 'w' ? 1 : -1;
      if (kr === backRank && checkers.length === 1) {
        const ch = checkers[0];
        const t = final.get(ch)?.type;
        const front = [-1, 0, 1].map((df) => kf + df).filter((f) => f >= 0 && f < 8).map((f) => toSq(f, kr + forward));
        const ownBlockers = front.filter((s) => final.get(s)?.color === opp).length;
        if ((t === 'r' || t === 'q') && sqRank(ch) === backRank && ownBlockers >= 2) tags.add('backRankMate');
      }
    }
    if (lastMove.piece === 'q' || lastMove.piece === 'r') {
      // nothing extra
    }
  }

  // Promotion
  if (userIdx.some((i) => played[i].promotion)) tags.add('promotion');
  if (userIdx.some((i) => played[i].promotion && played[i].promotion !== 'q')) tags.add('underPromotion');

  // Hanging piece: the first move wins an undefended piece and the puzzle is short
  {
    const i = 1;
    const m = played[i];
    if (m.captured && VAL[m.captured] >= 3 && userMoves <= 2) {
      const after = positions[i + 1];
      const recapture = after.moves({ verbose: true }).some((x) => x.to === m.to && x.captured);
      if (!recapture) tags.add('hangingPiece');
    }
  }

  // Sacrifice: after some opponent reply the solver is 2+ points down compared with the start,
  // but the line ends in mate or with the material back.
  {
    const d0 = material(positions[1], user) - material(positions[1], opp);
    const dFinal = material(final, user) - material(final, opp);
    let minD = d0;
    for (let i = 2; i < positions.length; i += 2) {
      const p = positions[i + 1] ?? positions[i];
      minD = Math.min(minD, material(p, user) - material(p, opp));
    }
    if (minD <= d0 - 2 && (final.isCheckmate() || dFinal >= d0)) tags.add('sacrifice');
  }

  // Fork: a solver move attacks two valuable targets with one piece, the piece survives the reply,
  // and the solver's next move captures one of the targets (or the line ends in mate).
  for (const i of userIdx) {
    const m = played[i];
    const after = positions[i + 1];
    const mv = VAL[m.piece];
    const targets = attacksFrom(after, m.to).filter((s) => {
      const p = after.get(s);
      if (!p || p.color !== opp || p.type === 'p') return false;
      return p.type === 'k' || VAL[p.type] > mv || !isDefended(after, s, opp);
    });
    if (targets.length >= 2) {
      const reply = played[i + 1];
      const next = played[i + 2];
      const forkerSurvives = !reply || reply.to !== m.to;
      if (forkerSurvives && next && next.from === m.to && targets.some((t) => t === next.to || (reply && reply.from === t && next.to === reply.to))) {
        tags.add('fork');
        break;
      }
    }
  }

  // Pin: a solver move attacks a piece that is pinned to its king (and worth more, or undefended),
  // and the solver wins that piece on a later move.
  for (const i of userIdx) {
    const m = played[i];
    const after = positions[i + 1];
    const victims = attacksFrom(after, m.to).filter((s) => {
      const p = after.get(s);
      if (!p || p.color !== opp || p.type === 'k') return false;
      return (VAL[p.type] > VAL[m.piece] || !isDefended(after, s, opp)) && isAbsolutelyPinned(after, s);
    });
    if (victims.length && userIdx.some((j) => j > i && played[j].captured && victims.includes(played[j].to))) {
      tags.add('pin');
      break;
    }
  }

  // Skewer: a slider attacks a valuable piece, it steps away, and the slider takes what was behind it
  for (const i of userIdx) {
    const m = played[i];
    if (!['b', 'r', 'q'].includes(m.piece)) continue;
    const reply = played[i + 1];
    const next = played[i + 2];
    if (!reply || !next || next.from !== m.to || !next.captured) continue;
    const frontPiece = positions[i + 1].get(reply.from);
    if (!frontPiece || frontPiece.color !== opp) continue;
    const line = between(m.to, next.to);
    if (line && line.includes(reply.from) && (frontPiece.type === 'k' || VAL[frontPiece.type] > VAL[next.captured])) {
      tags.add('skewer');
      break;
    }
  }

  // Discovered attack: moving one piece opens a line for another solver slider, giving check or
  // hitting a valuable piece that the solver then takes with that slider.
  for (const i of userIdx) {
    const m = played[i];
    const before = positions[i];
    const after = positions[i + 1];
    const sliders = after
      .board()
      .flat()
      .filter((p): p is NonNullable<typeof p> => !!p && p.color === user && ['b', 'r', 'q'].includes(p.type) && p.square !== m.to);
    let found = false;
    for (const s of sliders) {
      const newly = attacksFrom(after, s.square).filter((t) => !attacksFrom(before, s.square).includes(t));
      for (const t of newly) {
        const victim = after.get(t);
        if (!victim || victim.color !== opp) continue;
        const line = between(s.square, t);
        if (!line || !line.includes(m.from)) continue;
        if (victim.type === 'k') {
          tags.add('discoveredAttack');
          if (after.attackers(t, user).length >= 2 && attacksFrom(after, m.to).includes(t)) tags.add('doubleCheck');
          found = true;
        } else if (VAL[victim.type] > VAL[s.type] || !isDefended(after, t, opp)) {
          if (userIdx.some((j) => j > i && played[j].from === s.square && played[j].to === t)) {
            tags.add('discoveredAttack');
            found = true;
          }
        }
      }
      if (found) break;
    }
    if (found) break;
  }

  // Removing the defender: capture a piece that defends something, then take what it defended
  for (const i of userIdx) {
    const m = played[i];
    const next = played[i + 2];
    if (!m.captured || !next || !next.captured || next.to === m.to) continue;
    const before = positions[i];
    const target = before.get(next.to);
    if (!target || target.color !== opp || target.type === 'k' || VAL[target.type] < 3) continue;
    const xWasDefender = attacksFrom(before, m.to).includes(next.to);
    const undefendedNow = !isDefended(positions[i + 2], next.to, opp);
    if (xWasDefender && undefendedNow) {
      tags.add('capturingDefender');
      break;
    }
  }

  // Attraction (decoy): a piece is sacrificed to lure the king/queen/rook to a square, then exploited
  for (const i of userIdx) {
    const m = played[i];
    const reply = played[i + 1];
    const next = played[i + 2];
    if (!reply || !next || reply.to !== m.to || !reply.captured) continue;
    const lured = reply.piece;
    const afterNext = positions[i + 3];
    if (!afterNext) continue;
    if (lured === 'k' && afterNext.inCheck()) {
      tags.add('attraction');
      break;
    }
    if ((lured === 'q' || lured === 'r') && attacksFrom(afterNext, next.to).includes(m.to) && userIdx.some((j) => j > i + 2 && played[j].to === m.to)) {
      tags.add('attraction');
      break;
    }
  }

  // Greek gift: the first move is Bxh7+ (or ...Bxh2+) against a castled king
  {
    const m = played[1];
    const target = user === 'w' ? 'h7' : 'h2';
    const kSq = user === 'w' ? 'g8' : 'g1';
    if (m.piece === 'b' && m.to === target && m.captured && positions[2].inCheck() && positions[1].get(kSq as Square)?.type === 'k') tags.add('greekGift');
  }

  // Attacking f2/f7
  {
    const target = opp === 'w' ? 'f2' : 'f7';
    const kHome = opp === 'w' ? 'e1' : 'e8';
    const start = positions[1];
    if (start.get(kHome as Square)?.type === 'k' && userIdx.some((i) => played[i].to === target && played[i].captured)) tags.add('attackingF2F7');
  }

  // Game phase and endgame type (from the puzzle's start position)
  {
    const start = positions[1];
    const np = nonPawn(start);
    const total = [...np.w, ...np.b].reduce((s, t) => s + VAL[t], 0);
    const fullmove = parseInt(start.fen().split(' ')[5] || '20', 10);
    if (total <= 26) {
      tags.add('endgame');
      const all = [...np.w, ...np.b];
      if (all.length === 0) tags.add('pawnEndgame');
      else if (all.every((t) => t === 'r')) tags.add('rookEndgame');
      else if (all.every((t) => t === 'q')) tags.add('queenEndgame');
      else if (all.every((t) => t === 'b')) tags.add('bishopEndgame');
      else if (all.every((t) => t === 'n')) tags.add('knightEndgame');
    } else if (fullmove <= 14) {
      tags.add('opening');
    } else {
      tags.add('middlegame');
    }
  }

  return [...tags];
}

export const THEME_LABELS: Record<string, string> = {
  mateIn1: 'Mate in 1',
  mateIn2: 'Mate in 2',
  mateIn3: 'Mate in 3',
  mate: 'Checkmate',
  backRankMate: 'Back-rank mate',
  smotheredMate: 'Smothered mate',
  fork: 'Fork',
  pin: 'Pin',
  skewer: 'Skewer',
  discoveredAttack: 'Discovered attack',
  doubleCheck: 'Double check',
  hangingPiece: 'Hanging piece',
  sacrifice: 'Sacrifice',
  promotion: 'Promotion',
  attackingF2F7: 'Attacking f2/f7',
  capturingDefender: 'Removing the defender',
  attraction: 'Decoy (attraction)',
  greekGift: 'Greek gift (Bxh7+)',
  endgame: 'Endgame',
  pawnEndgame: 'Pawn endgame',
  rookEndgame: 'Rook endgame',
  opening: 'Opening',
  middlegame: 'Middlegame',
  oneMove: 'One move',
  short: 'Short (2 moves)',
  long: 'Long (3 moves)',
  veryLong: 'Very long',
};
