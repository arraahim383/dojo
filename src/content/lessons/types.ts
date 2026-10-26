import type { Square } from 'chess.js';

export interface LessonStep {
  text: string;
  /** Explanation boards may show partial positions (e.g. a lone rook); they are display-only. */
  fen: string;
  arrows?: Array<[Square, Square, string?]>;
  highlights?: Record<string, string>; // square -> color
}

export interface LessonChallenge {
  fen: string; // must be a legal position with both kings
  prompt: string;
  /** Your moves and the automatic replies, in UCI: [you, reply, you, ...] */
  solution: string[];
  /** Other first moves that also count as correct (UCI). */
  alsoAccept?: string[];
  /** Any checkmating move counts as correct on the final move. */
  acceptAnyMate?: boolean;
  /** Where the position comes from, e.g. 'lichess:81jmH' for a real Lichess puzzle. */
  source?: string;
}

export interface Lesson {
  id: string;
  level: number;
  unit: string;
  title: string;
  description: string;
  steps: LessonStep[];
  challenges: LessonChallenge[];
}

export interface BrokenLessonReport {
  lessonId: string;
  type: 'step_fen' | 'challenge_fen' | 'solution_illegal' | 'mate_claim' | 'empty';
  index: number;
  details: string;
}
