# Daba Dojo ♟️

A personal chess trainer that takes you from your first game to club strength. It works like the learning side of chess.com, but runs entirely on your own computer.

- **Learn**: 38 lessons in 4 levels (rules → tactics → strategy → advanced endgames), 115 interactive challenges. Tactics challenges are real Lichess puzzles, and every position was checked with Stockfish.
- **Puzzles**: 20,970 real Lichess puzzles (ratings 400–2500), rated mode with your own puzzle rating, themes, Puzzle Rush, daily puzzle, a placement test, and a "My Mistakes" deck with spaced repetition.
- **Play vs Bots**: 12 bots from 250 to 2500 on one calibrated strength scale, each with its own opening repertoire, plus optional coach warnings, hints and takebacks.
- **Game Review**: full Stockfish review with accuracy, move classifications (Brilliant to Blunder, Book, Miss), eval graph, opening names, and a Retry mode for your key mistakes.
- **Drills**: 14 endgame and middlegame positions to play out against Stockfish (K+Q mate, Lucena, Philidor, …).
- **Openings, Vision trainer, Progress stats, Today's Plan**: a daily routine that ticks itself off as you train.
- **Optional Gemini coach**: "Explain" buttons give a plain-English explanation grounded in Stockfish's lines. The app works fully without it.

All progress is stored in your browser (IndexedDB). There are no accounts and no server database. You can back up and restore from Settings.

## Run it

You need **Node.js 20 or newer** ([nodejs.org](https://nodejs.org)).

```bash
npm install
npm run dev
```

Open http://localhost:3000.

### Optional: the Gemini coach

Copy `.env.example` to `.env` and add your key from https://aistudio.google.com/apikey:

```
GEMINI_API_KEY=your-key-here
```

Without a key, the Explain buttons say the coach is unavailable and still show Stockfish's best lines.

### Production build

```bash
npm run build
npm start
```

This serves the built app and the API from one Node server on port 3000 (or `PORT`). Any host that runs Node works, e.g. Render, Railway, Fly.io or a VPS. Set `GEMINI_API_KEY` in the host's environment settings if you want the coach.

### Static build (GitHub Pages or any static host)

```bash
npm run build:static
```

This writes `dist-static/`, which runs from any folder or static host with no server. Lessons, puzzles, bots, game review and drills all work. The Gemini coach and live Lichess puzzles need the Node server, so the static build switches them off with a clear message (the daily puzzle comes from the built-in set instead).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build into `dist/` |
| `npm start` | Serve the production build |
| `npm run build:static` | Server-free build into `dist-static/` for static hosting |
| `npm run lint` | TypeScript type check |
| `npm run check:lessons` | Validate every lesson: legal positions, legal solutions, mates really mate, Lichess sources match the puzzle data |
| `npm run check:lessons -- --engine` | Also ask Stockfish whether each expected answer is actually good (Levels 2–4, a few minutes) |

**Adding lessons:** lessons live in `src/content/lessons/level1.ts` to `level4.ts`. Run `npm run check:lessons` after editing. Broken challenges are also hidden automatically in the app, so a typo can't trap a student.

## How it works

- **Stockfish (Stockfish.js 19, WASM)** runs in two Web Workers in the browser: one for analysis and hints, one for bots, so a bot game never weakens your hints. Scores are always shown from White's point of view.
- **Bots** below 2400 use a custom strength recipe (search depth, evaluation noise and occasional mistakes) instead of Stockfish's built-in Elo limiter. Tested in bot-vs-bot matches so a higher-rated bot really beats a lower one.
- **Game review** uses the expected-points model (win-probability drop per move), similar to modern review tools.
- **Server** (`server.ts`, Express): serves the app, proxies the Lichess API with rate-limit handling (daily puzzle), and calls Gemini for the coach.

```
src/
  components/   UI for each section (learn, puzzles, play, review, drills, …)
  content/      lessons + validator
  data/         bots, drills, openings
  services/     engine, game review, puzzles, opening book, themes, gates
  db/           IndexedDB schema (Dexie)
public/
  data/         puzzles.json (Lichess puzzles), opening-book.json
  stockfish/    Stockfish WASM engine
scripts/        lesson checker
```

## Credits and licenses

- Puzzles: [Lichess puzzle database](https://database.lichess.org/#puzzles) (CC0). Themes were re-detected by this app.
- Opening names and book: [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) (CC0).
- Engine: [Stockfish](https://stockfishchess.org) via [stockfish.js](https://github.com/nmrugg/stockfish.js), licensed **GPLv3**. The files in `public/stockfish/` are unmodified copies from the `stockfish` npm package.
- Board: [react-chessboard](https://github.com/Clariity/react-chessboard). Rules: [chess.js](https://github.com/jhlywa/chess.js).

Because the app ships Stockfish, the simplest license for this repository is also GPLv3 if you make it public.
