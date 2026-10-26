// Level gates: what you must do to move from one level to the next.
import type { UserProfile } from '../db';
import { CHESS_BOTS } from '../data/bots';
import { CLASSIC_DRILLS } from '../data/drills';
import { lessonsForLevel } from '../content/lessons';

export interface GateRequirement {
  label: string;
  done: boolean;
  detail: string;
  goTo?: 'learn' | 'puzzles' | 'play' | 'review' | 'drills' | 'vision';
}

export interface Gate {
  fromLevel: number;
  toLevel: number;
  title: string;
  requirements: GateRequirement[];
  eligible: boolean;
}

const botName = (id: string) => {
  const b = CHESS_BOTS.find((x) => x.id === id);
  return b ? `${b.name} (${b.elo})` : id;
};
const drillName = (id: string) => CLASSIC_DRILLS.find((d) => d.id === id)?.title || id;

function lessonsReq(p: UserProfile, level: number): GateRequirement {
  const lessons = lessonsForLevel(level).filter((l) => l.challenges.length > 0 || l.steps.length > 0);
  const done = lessons.filter((l) => p.completedLessons.includes(l.id)).length;
  return {
    label: `All Level ${level} lessons`,
    done: lessons.length > 0 && done === lessons.length,
    detail: `${done} / ${lessons.length}`,
    goTo: 'learn',
  };
}

function botReq(p: UserProfile, id: string): GateRequirement {
  const beaten = p.botsBeaten.includes(id);
  const assisted = !beaten && p.botsBeatenAssisted.includes(id);
  return {
    label: `Beat ${botName(id)} without takebacks`,
    done: beaten,
    detail: beaten ? 'Done' : assisted ? 'Only with takebacks so far' : 'Not yet',
    goTo: 'play',
  };
}

function drillsReq(p: UserProfile, ids: string[]): GateRequirement {
  const done = ids.filter((d) => p.passedDrills.includes(d));
  return {
    label: `Drills: ${ids.map(drillName).join(' and ')}`,
    done: done.length === ids.length,
    detail: `${done.length} / ${ids.length}`,
    goTo: 'drills',
  };
}

function ratingReq(p: UserProfile, min: number): GateRequirement {
  return { label: `Puzzle rating ${min}+`, done: p.puzzleRating >= min, detail: `Now ${p.puzzleRating}`, goTo: 'puzzles' };
}

export function computeGates(p: UserProfile): Gate[] {
  const g = p.settings.gates;
  const visionBest = Math.max(p.visionBestWhite, p.visionBestBlack);
  const gates: Array<Omit<Gate, 'eligible'>> = [
    {
      fromLevel: 1,
      toLevel: 2,
      title: 'Beginner Belt',
      requirements: [
        lessonsReq(p, 1),
        { label: `Vision score ${g.gate1to2.visionScore}+ in 30 seconds`, done: visionBest >= g.gate1to2.visionScore, detail: `Best ${visionBest}`, goTo: 'vision' },
        drillsReq(p, g.gate1to2.drillsPassed),
        botReq(p, g.gate1to2.botBeaten),
      ],
    },
    {
      fromLevel: 2,
      toLevel: 3,
      title: 'Intermediate Belt',
      requirements: [
        lessonsReq(p, 2),
        ratingReq(p, g.gate2to3.puzzleRating),
        botReq(p, g.gate2to3.botBeaten),
        {
          label: `Review ${g.gate2to3.gamesReviewed} of your games`,
          done: p.gamesReviewedCount >= g.gate2to3.gamesReviewed,
          detail: `${p.gamesReviewedCount} / ${g.gate2to3.gamesReviewed}`,
          goTo: 'review',
        },
      ],
    },
    {
      fromLevel: 3,
      toLevel: 4,
      title: 'Advanced Belt',
      requirements: [lessonsReq(p, 3), ratingReq(p, g.gate3to4.puzzleRating), botReq(p, g.gate3to4.botBeaten), drillsReq(p, g.gate3to4.drillsPassed)],
    },
    {
      fromLevel: 4,
      toLevel: 5,
      title: 'Mastery',
      requirements: [lessonsReq(p, 4), ratingReq(p, g.gate4toMastery.puzzleRating), botReq(p, g.gate4toMastery.botBeaten)],
    },
  ];
  return gates.map((gate) => ({ ...gate, eligible: gate.requirements.every((r) => r.done) }));
}

export function levelName(level: number): string {
  return ['', 'New to Chess', 'Beginner', 'Intermediate', 'Advanced', 'Mastery'][level] || 'Mastery';
}
