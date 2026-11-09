import type { IncomingMessage, ServerResponse } from 'node:http';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { Chess } from 'chess.js';

type Request = IncomingMessage & { body?: unknown };
type Response = ServerResponse & {
  status: (code: number) => Response;
  json: (body: unknown) => void;
};

type BestLine = { pvSan: string[]; eval: string };
type ExplainBody = {
  fen?: unknown;
  move?: unknown;
  bestLines?: unknown;
  userLevel?: unknown;
  context?: unknown;
};

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const MOVE_TOKEN = /\b(O-O(?:-O)?|[KQRBN][a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?|[a-h]x[a-h][1-8](?:=[QRBN])?|[a-h][18]=[QRBN])[+#]?/g;
const explainCache = new Map<string, string>();
const requestWindows = new Map<string, { count: number; resetAt: number }>();

export const config = { maxDuration: 30 };

function normalizeSan(san: string): string {
  return san.replace(/[+#!?]/g, '').replace(/0/g, 'O');
}

function toSan(fen: string, move: string): string {
  if (/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)) {
    try {
      return new Chess(fen).move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] || undefined }).san;
    } catch {
      return move;
    }
  }
  return move;
}

function filterExplanation(text: string, allowed: Set<string>): { text: string; removed: number } {
  let removed = 0;
  const sentences = text.split(/(?<=[.!?])\s+/).filter((sentence) => {
    const tokens = sentence.match(MOVE_TOKEN) || [];
    const hasUnsupportedMove = tokens.some((token) => !allowed.has(normalizeSan(token)));
    if (hasUnsupportedMove) removed++;
    return !hasUnsupportedMove;
  });
  return { text: sentences.join(' ').trim(), removed };
}

export default async function handler(req: Request, res: Response) {
  const origin = req.headers.origin;
  if (origin && origin !== 'https://localhost' && origin !== 'https://dojo-omega-two.vercel.app') {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  if (origin === 'https://localhost') {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const clientIp = String(req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || 'unknown').split(',').at(-1)?.trim() || 'unknown';
  const now = Date.now();
  const window = requestWindows.get(clientIp);
  if (window && window.resetAt > now && window.count >= 12) {
    res.setHeader('Retry-After', String(Math.ceil((window.resetAt - now) / 1000)));
    return res.status(429).json({ error: 'Too many coach requests. Please wait a minute and try again.' });
  }
  requestWindows.set(clientIp, window && window.resetAt > now ? { ...window, count: window.count + 1 } : { count: 1, resetAt: now + 60_000 });
  if (requestWindows.size > 1000) {
    for (const [ip, entry] of requestWindows) if (entry.resetAt <= now) requestWindows.delete(ip);
  }

  const contentLength = Number(req.headers['content-length'] || 0);
  if (contentLength > 200 * 1024) return res.status(413).json({ error: 'Request body is too large' });

  const body = (req.body && typeof req.body === 'object' ? req.body : {}) as ExplainBody;
  const { fen, move, bestLines, userLevel, context } = body;
  if (typeof fen !== 'string' || typeof move !== 'string') {
    return res.status(400).json({ error: 'Missing fen or move' });
  }

  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return res.status(400).json({ error: 'Invalid FEN' });
  }

  const lines: BestLine[] = Array.isArray(bestLines)
    ? bestLines
        .filter((line): line is { pvSan: unknown[]; eval?: unknown } => !!line && Array.isArray((line as BestLine).pvSan))
        .slice(0, 3)
        .map((line) => ({ pvSan: line.pvSan.slice(0, 10).map(String), eval: String(line.eval ?? '') }))
    : [];
  const moveSan = toSan(fen, move);
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.json({ unavailable: true, reason: 'No GEMINI_API_KEY is set for this deployment, so the coach is off.' });
  }

  const cacheKey = `${fen}|${moveSan}|${String(userLevel || 1)}`;
  const cached = explainCache.get(cacheKey);
  if (cached) return res.json({ explanation: cached, cached: true });

  const side = chess.turn() === 'w' ? 'White' : 'Black';
  const linesText = lines.length
    ? lines.map((line, index) => `Line ${index + 1} (eval ${line.eval}, from White's point of view): ${line.pvSan.join(' ')}`).join('\n')
    : '(no engine lines supplied)';
  const systemInstruction = `You are a friendly chess coach in a training app for a level ${String(userLevel || 1)} student (levels: 1 new to chess, 2 beginner, 3 intermediate, 4 advanced).\nRules:\n- At most 120 words, plain language, no headings, no bullet lists, no greeting.\n- Only mention moves that appear in the engine lines given to you or the move that was played. Never invent other moves or variations.\n- Write moves in standard algebraic notation exactly as given (e.g. Nf3, exd5, O-O).\n- Explain the idea: the threat, tactic (fork, pin, skewer, discovered attack, removing the defender...), king safety, or what the played move allowed compared with the engine's best line.`;
  const userPrompt = `Position (FEN): ${fen}\n${side} to move.\nMove played or asked about: ${moveSan}\nContext: ${String(context || 'position explanation').slice(0, 200)}\nStockfish lines from this position:\n${linesText}\n\nExplain this to the student.`;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await Promise.race([
      ai.models.generateContent({ model: GEMINI_MODEL, contents: userPrompt, config: { systemInstruction, thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 20_000)),
    ]);
    const raw = (response.text || '').trim();
    if (!raw) throw new Error('empty response');

    const allowed = new Set<string>([normalizeSan(moveSan)]);
    lines.forEach((line) => line.pvSan.forEach((san) => allowed.add(normalizeSan(san))));
    const { text, removed } = filterExplanation(raw, allowed);
    if (!text) throw new Error('explanation only referred to moves outside the engine lines');
    if (removed) console.log(`[explain] removed ${removed} sentence(s) naming moves outside the engine lines`);
    explainCache.set(cacheKey, text);
    return res.json({ explanation: text });
  } catch (error) {
    console.warn('[explain] Gemini unavailable:', error instanceof Error ? error.message : 'unknown error');
    return res.json({ unavailable: true, reason: 'The coach could not answer right now.' });
  }
}
