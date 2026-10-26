import type { Lesson } from './types';
import { LEVEL_1_LESSONS } from './level1';
import { LEVEL_2_LESSONS } from './level2';
import { LEVEL_3_LESSONS } from './level3';
import { LEVEL_4_LESSONS } from './level4';
export type { Lesson, LessonStep, LessonChallenge, BrokenLessonReport } from './types';
export { validateLessons, challengeProblems, positionProblems } from './validate';
export { LEVEL_1_LESSONS, LEVEL_2_LESSONS, LEVEL_3_LESSONS, LEVEL_4_LESSONS };

export const ALL_LESSONS: Lesson[] = [...LEVEL_1_LESSONS, ...LEVEL_2_LESSONS, ...LEVEL_3_LESSONS, ...LEVEL_4_LESSONS];

export function lessonsForLevel(level: number): Lesson[] {
  return level === 1 ? LEVEL_1_LESSONS : level === 2 ? LEVEL_2_LESSONS : level === 3 ? LEVEL_3_LESSONS : level === 4 ? LEVEL_4_LESSONS : [];
}
