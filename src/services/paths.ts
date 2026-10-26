// Where the app's own files live, and whether a Node server (server.ts) is behind it.
//
// `npm run build` + `npm start` serves everything from one Node server, so both are true.
// A static build (`npm run build:static`) runs on any static host (GitHub Pages, a preview link):
// files load relative to the page, and features that need the server (the Gemini coach and live
// Lichess puzzles) are switched off with a clear message. Everything else works offline.

/** URL for a file in public/, e.g. asset('data/puzzles.json'). */
export const asset = (path: string) => import.meta.env.BASE_URL + path.replace(/^\//, '');

/** False in a static build, where there is no /api server. */
export const hasServer = import.meta.env.VITE_STATIC !== '1';
