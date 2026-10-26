import React, { useState, useEffect } from 'react';
import { Chess } from 'chess.js';
import { Sparkles, X, Brain, ShieldAlert, Loader2 } from 'lucide-react';
import { engine } from '../../services/engine';
import { hasServer } from '../../services/paths';

interface GeminiCoachModalProps {
  isOpen: boolean;
  onClose: () => void;
  fen: string; // position BEFORE the move being explained
  movePlayed: string; // SAN or UCI
  userLevel?: number;
  context?: string;
  /** Engine lines for this position (SAN). If missing, Stockfish is asked here. */
  groundingLines?: Array<{ pvSan: string[]; eval: string }>;
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

export const GeminiCoachModal: React.FC<GeminiCoachModalProps> = ({
  isOpen,
  onClose,
  fen,
  movePlayed,
  userLevel = 1,
  context = 'Position explanation',
  groundingLines,
}) => {
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState<string>('');
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [lines, setLines] = useState<Array<{ pvSan: string[]; eval: string }>>([]);

  const moveSan = movePlayed ? toSan(fen, movePlayed) : '';

  useEffect(() => {
    if (!isOpen || !fen) return;
    let alive = true;
    (async () => {
      setLoading(true);
      setUnavailable(null);
      setExplanation('');
      try {
        let grounding = groundingLines && groundingLines.length ? groundingLines : null;
        if (!grounding) {
          const a = await engine.evaluatePosition(fen, { depth: 14, multiPv: 3 });
          grounding = a.lines.map((l) => ({ pvSan: l.pvSan, eval: l.evalFormatted }));
        }
        if (!alive) return;
        setLines(grounding);
        if (!hasServer) {
          setUnavailable('The coach needs the Node server (npm start with a GEMINI_API_KEY). Stockfish’s best lines are shown below.');
          return;
        }
        const res = await fetch('/api/explain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fen, move: moveSan || '(no move)', bestLines: grounding, userLevel, context }),
        });
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        if (!res.ok || data.unavailable || !data.explanation) {
          setUnavailable(data.reason || `The coach could not answer (status ${res.status}).`);
        } else {
          setExplanation(data.explanation);
        }
      } catch (err: any) {
        if (alive) setUnavailable(err?.message || 'The coach could not be reached.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [isOpen, fen, movePlayed, userLevel, context]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-stone-900 border border-amber-600/40 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl relative text-stone-100">
        <div className="bg-gradient-to-r from-amber-950/80 via-stone-900 to-amber-950/80 border-b border-amber-700/30 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-lg text-amber-300 tracking-wide">Sensei's Counsel</h3>
              <p className="text-xs text-stone-400">Gemini explains, grounded in Stockfish lines</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between text-xs text-stone-400 bg-stone-950/60 p-2.5 rounded-lg border border-stone-800">
            <div>
              <span className="text-stone-500 mr-1">Move:</span>
              <span className="font-mono font-semibold text-amber-400">{moveSan || '—'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-stone-300">
              <Brain className="w-3.5 h-3.5 text-amber-400" />
              <span>Stockfish lines</span>
            </div>
          </div>

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
              <p className="text-sm text-stone-400 font-serif italic">Sensei is looking at the board...</p>
            </div>
          ) : unavailable ? (
            <div className="p-4 rounded-xl bg-stone-950/60 border border-stone-700 text-stone-300 text-sm flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-1">Coach unavailable</p>
                <p className="text-xs text-stone-400">{unavailable}</p>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-900/30 text-stone-200 text-sm leading-relaxed whitespace-pre-line">
              {explanation}
            </div>
          )}

          {!loading && lines.length > 0 && (
            <div className="space-y-1 text-xs">
              <div className="text-stone-500 uppercase tracking-wider font-bold text-[10px]">Engine lines (eval from White's view)</div>
              {lines.map((l, i) => (
                <div key={i} className="font-mono text-stone-300 bg-stone-950/50 rounded px-2 py-1 truncate">
                  <span className="text-amber-400 mr-2">{l.eval}</span>
                  {l.pvSan.slice(0, 8).join(' ')}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 bg-stone-950 border-t border-stone-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-95"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
