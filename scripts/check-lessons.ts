// Checks every lesson before you ship it.
//   npm run check:lessons            rules: legal positions, legal solutions, mate prompts end in mate,
//                                    and lichess-sourced challenges match public/data/puzzles.json
//   npm run check:lessons -- --engine  also asks Stockfish whether the expected answers are actually good
//                                    (Levels 2-4; takes a few minutes)
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';
import { ALL_LESSONS } from '../src/content/lessons/index';
import { validateLessons } from '../src/content/lessons/validate';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const useEngine = process.argv.includes('--engine');
let problems = 0;
const flag = (msg: string) => { problems++; console.log('  ✗ ' + msg); };

console.log(`Checking ${ALL_LESSONS.length} lessons, ${ALL_LESSONS.reduce((s, l) => s + l.challenges.length, 0)} challenges`);

// 1. Rules
for (const r of validateLessons(ALL_LESSONS)) flag(`${r.lessonId} ${r.type} #${r.index + 1}: ${r.details}`);

// 2. Lichess sources match the bundled puzzle (bundle FEN is before the opponent's first move)
const bundle = JSON.parse(fs.readFileSync(path.join(root, 'public/data/puzzles.json'), 'utf8'));
const byId = new Map<string, any[]>(bundle.puzzles.map((p: any[]) => [p[0], p]));
for (const L of ALL_LESSONS) {
  L.challenges.forEach((ch, i) => {
    if (!ch.source?.startsWith('lichess:')) return;
    const p = byId.get(ch.source.slice(8));
    if (!p) return flag(`${L.id} #${i + 1}: ${ch.source} is not in puzzles.json`);
    const moves = String(p[2]).split(' ');
    const c = new Chess(p[1]);
    c.move({ from: moves[0].slice(0, 2), to: moves[0].slice(2, 4), promotion: moves[0][4] });
    const want = c.fen().split(' ').slice(0, 2).join(' ');
    if (want !== ch.fen.split(' ').slice(0, 2).join(' ')) flag(`${L.id} #${i + 1}: FEN differs from ${ch.source} (expected ${c.fen()})`);
    else if (moves.slice(1).join(' ') !== ch.solution.join(' ')) flag(`${L.id} #${i + 1}: solution differs from ${ch.source} (expected ${moves.slice(1).join(' ')})`);
  });
}

// 3. Optional Stockfish check of the expected first move and accepted alternatives
if (useEngine) {
  const require = createRequire(import.meta.url);
  const enginePath: string = require('stockfish').findEngine('lite-single');
  const sf = spawn(process.execPath, [enginePath], { stdio: 'pipe' });
  let buf = '';
  let listeners: Array<(l: string) => void> = [];
  sf.stdout.on('data', (d) => {
    buf += d.toString();
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      for (const l of [...listeners]) l(line);
    }
  });
  const send = (c: string) => sf.stdin.write(c + '\n');
  const waitFor = (pred: (l: string) => boolean) => new Promise<void>((res) => {
    const l = (line: string) => { if (pred(line)) { listeners = listeners.filter((x) => x !== l); res(); } };
    listeners.push(l);
  });
  send('uci'); await waitFor((l) => l === 'uciok');
  send('setoption name MultiPV value 8'); send('isready'); await waitFor((l) => l === 'readyok');

  type Line = { cp?: number; mate?: number; move: string };
  const analyse = async (fen: string): Promise<Line[]> => {
    const lines = new Map<number, Line>();
    const onInfo = (line: string) => {
      const m = line.match(/ multipv (\d+) .*score (cp|mate) (-?\d+).* pv (\S+)/);
      if (line.startsWith('info') && m) lines.set(+m[1], { [m[2]]: +m[3], move: m[4] } as Line);
    };
    listeners.push(onInfo);
    send('ucinewgame'); send(`position fen ${fen}`); send('go depth 16');
    await waitFor((l) => l.startsWith('bestmove'));
    listeners = listeners.filter((x) => x !== onInfo);
    return [...lines.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]);
  };
  const val = (l: Line) => (l.mate !== undefined ? (l.mate > 0 ? 10000 - l.mate : -10000 - l.mate) : l.cp!);
  const fmt = (l: Line) => (l.mate !== undefined ? `#${l.mate}` : (l.cp! / 100).toFixed(2));

  // Level 1 teaches the rules (any legal escape from check counts), so engine strength is not the test there.
  for (const L of ALL_LESSONS.filter((l) => l.level > 1)) {
    for (const [i, ch] of L.challenges.entries()) {
      const lines = await analyse(ch.fen);
      const best = lines[0];
      if (!best) continue;
      for (const u of [ch.solution[0], ...(ch.alsoAccept || [])]) {
        const l = lines.find((x) => x.move === u);
        if (!l) { flag(`${L.id} #${i + 1}: ${u} is not in Stockfish's top 8 (best ${best.move} ${fmt(best)})`); continue; }
        const bothMate = (best.mate ?? 0) > 0 && (l.mate ?? 0) > 0;
        const bothWinning = val(l) >= 300 && val(best) >= 300;
        const tolerance = ch.source ? 0 : 40;
        if (!bothMate && !bothWinning && val(best) - val(l) > tolerance) flag(`${L.id} #${i + 1}: ${u} (${fmt(l)}) is worse than ${best.move} (${fmt(best)})`);
      }
    }
    process.stdout.write('.');
  }
  console.log();
  sf.kill();
}

console.log(problems ? `\n${problems} problem(s) found` : '\nAll lessons OK');
process.exit(problems ? 1 : 0);
