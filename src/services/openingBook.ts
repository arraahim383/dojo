// Opening book built from lichess-org/chess-openings (public domain).
// public/data/opening-book.json holds a hash of every position that occurs in a named opening line,
// plus the name of each line's final position. It is generated data; do not edit by hand.
import { asset } from './paths';

interface BookData {
  book: string[];
  names: Record<string, string>;
}

let loaded: { book: Set<string>; names: Record<string, string> } | null = null;
let loading: Promise<void> | null = null;

function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

const key = (fen: string) => fnv1a(fen.split(' ').slice(0, 4).join(' '));

export async function loadOpeningBook(): Promise<void> {
  if (loaded) return;
  if (!loading) {
    loading = fetch(asset('data/opening-book.json'))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: BookData) => {
        loaded = { book: new Set(d.book), names: d.names };
      })
      .catch((e) => {
        console.warn('Opening book unavailable', e);
        loaded = { book: new Set(), names: {} };
      });
  }
  await loading;
}

/** True if this position appears in a known opening line. Call loadOpeningBook() first. */
export function isBookPosition(fen: string): boolean {
  return !!loaded?.book.has(key(fen));
}

/** Name ("C50 Italian Game") if this exact position ends a named opening line. */
export function openingNameAt(fen: string): string | undefined {
  return loaded?.names[key(fen)];
}
