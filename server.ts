import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { Chess } from 'chess.js';

dotenv.config({ path: ['.env.local', '.env'], quiet: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

app.use(express.json({ limit: '200kb' }));

const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

// ---------------------------------------------------------------------------------------------
// Lichess puzzle proxy. Lichess asks API users to make one request at a time and to wait a full
// minute after a 429 response, so requests are serialized here.
// ---------------------------------------------------------------------------------------------
const puzzleCache = new Map<string, { at: number; data: unknown }>();
let lichessChain: Promise<unknown> = Promise.resolve();
let lichessBlockedUntil = 0;

function lichessGet(url: string): Promise<{ status: number; data?: unknown }> {
  const run = async () => {
    if (Date.now() < lichessBlockedUntil) return { status: 429 };
    const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'DabaDojo/1.0 (personal chess trainer)' } });
    if (r.status === 429) {
      lichessBlockedUntil = Date.now() + 60_000;
      return { status: 429 };
    }
    if (!r.ok) return { status: r.status };
    return { status: 200, data: await r.json() };
  };
  const p = lichessChain.then(run, run);
  lichessChain = p.catch(() => undefined);
  return p;
}

async function proxy(res: express.Response, url: string, cacheKey?: string, ttlMs = 0) {
  try {
    if (cacheKey) {
      const hit = puzzleCache.get(cacheKey);
      if (hit && (ttlMs === 0 || Date.now() - hit.at < ttlMs)) return res.json(hit.data);
    }
    const r = await lichessGet(url);
    if (r.status !== 200) return res.status(r.status).json({ error: `Lichess returned ${r.status}` });
    if (cacheKey) puzzleCache.set(cacheKey, { at: Date.now(), data: r.data });
    return res.json(r.data);
  } catch (err: any) {
    return res.status(502).json({ error: err?.message || 'Lichess request failed' });
  }
}

app.get('/api/puzzle/daily', (req, res) => proxy(res, 'https://lichess.org/api/puzzle/daily', 'daily', 30 * 60_000));

app.get('/api/puzzle/next', (req, res) => {
  const url = new URL('https://lichess.org/api/puzzle/next');
  const { angle, difficulty, color } = req.query;
  if (typeof angle === 'string' && /^[A-Za-z0-9_]{1,40}$/.test(angle)) url.searchParams.set('angle', angle);
  if (typeof difficulty === 'string' && /^(easiest|easier|normal|harder|hardest)$/.test(difficulty)) url.searchParams.set('difficulty', difficulty);
  if (typeof color === 'string' && /^(white|black)$/.test(color)) url.searchParams.set('color', color);
  return proxy(res, url.toString());
});

app.get('/api/puzzle/:id', (req, res) => {
  const { id } = req.params;
  if (!/^[A-Za-z0-9]{5,8}$/.test(id)) return res.status(400).json({ error: 'Bad puzzle id' });
  return proxy(res, `https://lichess.org/api/puzzle/${id}`, `id_${id}`);
});

// ---------------------------------------------------------------------------------------------
// Gemini coach. Gemini only explains; the moves come from Stockfish (sent by the browser).
// Any sentence that names a move outside the supplied lines is removed before it reaches you.
// ---------------------------------------------------------------------------------------------
const explainCache = new Map<string, string>();

const MOVE_TOKEN = /\b(O-O(?:-O)?|[KQRBN][a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?|[a-h]x[a-h][1-8](?:=[QRBN])?|[a-h][18]=[QRBN])[+#]?/g;

function normalizeSan(san: string): string {
  return san.replace(/[+#!?]/g, '').replace(/0/g, 'O');
}

function toSan(fen: string, move: string): string {
  if (/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)) {
    try {
      const c = new Chess(fen);
      return c.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] || undefined }).san;
    } catch {
      return move;
    }
  }
  return move;
}

function filterExplanation(text: string, allowed: Set<string>): { text: string; removed: number } {
  const sentences = text.split(/(?<=[.!?])\s+/);
  let removed = 0;
  const kept = sentences.filter((s) => {
    const tokens = s.match(MOVE_TOKEN) || [];
    const bad = tokens.some((t) => !allowed.has(normalizeSan(t)));
    if (bad) removed++;
    return !bad;
  });
  return { text: kept.join(' ').trim(), removed };
}

app.post('/api/explain', async (req, res) => {
  const { fen, move, bestLines, userLevel, context } = req.body || {};
  if (typeof fen !== 'string' || typeof move !== 'string') {
    return res.status(400).json({ error: 'Missing fen or move' });
  }
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return res.status(400).json({ error: 'Invalid FEN' });
  }
  const lines: Array<{ pvSan: string[]; eval: string }> = Array.isArray(bestLines)
    ? bestLines
        .filter((l: any) => l && Array.isArray(l.pvSan))
        .slice(0, 3)
        .map((l: any) => ({ pvSan: l.pvSan.slice(0, 10).map(String), eval: String(l.eval ?? '') }))
    : [];
  const moveSan = toSan(fen, move);

  if (!ai) {
    return res.json({ unavailable: true, reason: 'No GEMINI_API_KEY is set on the server, so the coach is off.' });
  }

  const cacheKey = `${fen}|${moveSan}|${userLevel}`;
  const cached = explainCache.get(cacheKey);
  if (cached) return res.json({ explanation: cached, cached: true });

  const side = chess.turn() === 'w' ? 'White' : 'Black';
  const linesText = lines.length
    ? lines.map((l, i) => `Line ${i + 1} (eval ${l.eval}, from White's point of view): ${l.pvSan.join(' ')}`).join('\n')
    : '(no engine lines supplied)';

  const systemInstruction = `You are a friendly chess coach in a training app for a level ${userLevel || 1} student (levels: 1 new to chess, 2 beginner, 3 intermediate, 4 advanced).
Rules:
- At most 120 words, plain language, no headings, no bullet lists, no greeting.
- Only mention moves that appear in the engine lines given to you or the move that was played. Never invent other moves or variations.
- Write moves in standard algebraic notation exactly as given (e.g. Nf3, exd5, O-O).
- Explain the idea: the threat, tactic (fork, pin, skewer, discovered attack, removing the defender...), king safety, or what the played move allowed compared with the engine's best line.`;

  const userPrompt = `Position (FEN): ${fen}
${side} to move.
Move played or asked about: ${moveSan}
Context: ${String(context || 'position explanation').slice(0, 200)}
Stockfish lines from this position:
${linesText}

Explain this to the student.`;

  try {
    const response: any = await Promise.race([
      ai.models.generateContent({ model: GEMINI_MODEL, contents: userPrompt, config: { systemInstruction, temperature: 0.2 } }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 20_000)),
    ]);
    const raw: string = (response?.text || '').trim();
    if (!raw) throw new Error('empty response');

    const allowed = new Set<string>([normalizeSan(moveSan)]);
    lines.forEach((l) => l.pvSan.forEach((m) => allowed.add(normalizeSan(m))));
    const { text, removed } = filterExplanation(raw, allowed);
    if (!text) throw new Error('explanation only referred to moves outside the engine lines');
    if (removed) console.log(`[explain] removed ${removed} sentence(s) naming moves outside the engine lines`);

    explainCache.set(cacheKey, text);
    return res.json({ explanation: text });
  } catch (err: any) {
    console.warn('[explain] Gemini unavailable:', err?.message);
    return res.json({ unavailable: true, reason: 'The coach could not answer right now.' });
  }
});

// ---------------------------------------------------------------------------------------------
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production' || process.argv.includes('--prod');
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath, { maxAge: '1h' }));
    app.get('*', (req, res) => res.sendFile(path.resolve(distPath, 'index.html')));
  }
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Daba Dojo running at http://localhost:${PORT}${ai ? '' : '  (coach off: no GEMINI_API_KEY)'}`);
  });
}

startServer();
