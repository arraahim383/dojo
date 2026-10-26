import { Chess } from 'chess.js';
import type { Lesson, LessonChallenge, BrokenLessonReport } from './types';

/** Problems with a position that a player would have to move in (empty list = fine). */
export function positionProblems(fen: string): string[] {
  let c: Chess;
  try {
    c = new Chess(fen);
  } catch (e: any) {
    return [e?.message || 'invalid FEN'];
  }
  const out: string[] = [];
  const pieces = c.board().flat().filter(Boolean) as Array<{ square: string; type: string; color: string }>;
  const kings = pieces.filter((p) => p.type === 'k');
  const wk = kings.find((k) => k.color === 'w');
  const bk = kings.find((k) => k.color === 'b');
  if (wk && bk) {
    const df = Math.abs(wk.square.charCodeAt(0) - bk.square.charCodeAt(0));
    const dr = Math.abs(Number(wk.square[1]) - Number(bk.square[1]));
    if (df <= 1 && dr <= 1) out.push('kings are touching');
  }
  const parts = fen.split(' ');
  parts[1] = parts[1] === 'w' ? 'b' : 'w';
  parts[3] = '-';
  try {
    if (new Chess(parts.join(' ')).inCheck()) out.push('the side not to move is in check');
  } catch {
    // ignore
  }
  if (pieces.some((p) => p.type === 'p' && (p.square[1] === '1' || p.square[1] === '8'))) out.push('pawn on the first or last rank');
  if (c.isGameOver()) out.push('position is already game over');
  return out;
}

function mateInOneMoves(fen: string): string[] {
  try {
    const c = new Chess(fen);
    return c
      .moves({ verbose: true })
      .filter((m) => {
        const t = new Chess(fen);
        t.move(m);
        return t.isCheckmate();
      })
      .map((m) => m.from + m.to + (m.promotion || ''));
  } catch {
    return [];
  }
}

/** Problems with one challenge (empty list = playable). */
export function challengeProblems(ch: LessonChallenge): string[] {
  const probs = positionProblems(ch.fen);
  if (probs.length) return probs;
  const c = new Chess(ch.fen);
  for (let i = 0; i < ch.solution.length; i++) {
    const u = ch.solution[i];
    try {
      c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || undefined });
    } catch {
      return [`solution move ${i + 1} (${u}) is illegal`];
    }
  }
  for (const alt of ch.alsoAccept || []) {
    try {
      new Chess(ch.fen).move({ from: alt.slice(0, 2), to: alt.slice(2, 4), promotion: alt[4] || undefined });
    } catch {
      return [`alternative ${alt} is illegal`];
    }
  }
  // Prompts that ask YOU to mate ("mate in two", "deliver checkmate", "checkmate with the rook")
  const asksForMate = /\b(check)?mate in\b|deliver (a )?([a-z-]+ )?(check)?mate|\bcheckmate with\b|\bsmothered mate in\b|\bcheckmate[!.]\s*$/i.test(ch.prompt);
  if (asksForMate && !c.isCheckmate()) {
    return ['prompt mentions mate but the solution does not end in checkmate'];
  }
  if (ch.acceptAnyMate && mateInOneMoves(ch.fen).length === 0 && ch.solution.length === 1) {
    return ['acceptAnyMate is set but there is no mate in one'];
  }
  return [];
}

export function validateLessons(lessons: Lesson[]): BrokenLessonReport[] {
  const broken: BrokenLessonReport[] = [];
  for (const lesson of lessons) {
    if (lesson.steps.length === 0 && lesson.challenges.length === 0) {
      broken.push({ lessonId: lesson.id, type: 'empty', index: 0, details: 'lesson has no content' });
      continue;
    }
    lesson.steps.forEach((step, idx) => {
      // Display-only boards may omit kings, but the placement part must parse.
      const placement = step.fen.split(' ')[0];
      if (!/^([prnbqkPRNBQK1-8]+\/){7}[prnbqkPRNBQK1-8]+$/.test(placement)) {
        broken.push({ lessonId: lesson.id, type: 'step_fen', index: idx, details: 'board layout is not valid' });
      }
    });
    lesson.challenges.forEach((ch, idx) => {
      const probs = challengeProblems(ch);
      if (probs.length) broken.push({ lessonId: lesson.id, type: 'challenge_fen', index: idx, details: probs.join('; ') });
    });
  }
  return broken;
}
