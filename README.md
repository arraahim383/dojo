# Daba Dojo ♟️

A personal chess trainer focused on learning: short interactive lessons, puzzles, practice games and reviews that help explain the next useful step.

- **Learn**: 38 lessons in 4 levels (rules → tactics → strategy → advanced endgames), 115 interactive challenges. Tactics challenges are real Lichess puzzles, and every position was checked with Stockfish.
- **Puzzles**: 20,970 real Lichess puzzles (ratings 400–2500), rated mode with your own puzzle rating, themes, Puzzle Rush, daily puzzle, a placement test, and a "My Mistakes" deck with spaced repetition.
- **Play vs Bots**: 12 bots from 250 to 2500 on one calibrated strength scale, each with its own opening repertoire, plus optional coach warnings, hints and takebacks.
- **Game Review**: full Stockfish review with accuracy, move classifications (Brilliant to Blunder, Book, Miss), eval graph, opening names, and a Retry mode for your key mistakes.
- **Drills**: 14 endgame and middlegame positions to play out against Stockfish (K+Q mate, Lucena, Philidor, …).
- **Openings, Vision trainer, Progress stats, Today's Plan**: a short daily routine that keeps learning first and makes extra practice optional.
- **Optional Gemini coach**: "Explain" buttons give a plain-English explanation grounded in Stockfish's lines. The app works fully without it.

Progress is stored on-device first (IndexedDB), so the core app works offline. Account-enabled builds add email sign-in and private cloud sync; users can also export a backup from Settings.

## Run it

You need **Node.js 20 or newer** ([nodejs.org](https://nodejs.org)).

```bash
npm install
npm run dev
```

Open http://localhost:3000.

### Email accounts and cloud progress

The account screen is ready for Supabase email/password authentication. To turn on accounts for web and Android builds:

1. Create a Supabase project and run [`supabase/migrations/20261110000000_user_progress.sql`](supabase/migrations/20261110000000_user_progress.sql) in its SQL Editor.
2. In Supabase Auth, enable Email sign-in and configure email confirmation. Set the site URL and allowed redirect URL to `https://dojo-omega-two.vercel.app` (or your deployed app URL).
3. Add these build variables to `.env.local` for local builds and Vercel's Production/Preview environments:

   ```text
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
   VITE_AUTH_REDIRECT_URL=https://dojo-omega-two.vercel.app
   ```

4. If you connect Supabase through Vercel Marketplace, its `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` values are used by the web app automatically. The app only exposes the public Supabase key in its client bundle. For account deletion, the integration's server-only `SUPABASE_SECRET_KEY` is supported; never add it to a `VITE_`/`NEXT_PUBLIC_` variable or bundle it into the APK. When configuring Supabase manually, use these server variables instead:

   ```text
   SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SERVICE_ROLE_KEY
   ```

   Marketplace integrations may use `SUPABASE_PUBLISHABLE_KEY` instead of `SUPABASE_ANON_KEY` for the public server-side client key.

5. Redeploy the website. For Android, build the APK after setting the three `VITE_` values so sign-in is enabled in that APK too.

**Before opening registration to the public:** Supabase's built-in email sender is for testing only; it is rate-limited and only delivers to project team addresses. Configure a custom SMTP provider with a verified sender domain in Supabase Auth settings before relying on email confirmation or password resets for general users. Keep email confirmation enabled. The app uses the same Supabase account store on the web and APK; the APK contains only the publishable client key, while the server secret stays in Vercel.

The first account on a device adopts existing local progress. Later sign-ins restore that account's cloud progress; changing to a different account clears the previous account's cached records before restoring the new account. The bundled 20,970-puzzle set remains local, while user-imported puzzles and training progress sync. If the account service is not configured, the app clearly offers local mode and does not claim that progress is syncing. Account data is associated with the user's email; it is stored in the private progress database, not in the email inbox. See [`public/privacy.html`](public/privacy.html).

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

### Deploy to Vercel with the Gemini coach

Vercel can serve the static app and the `/api/explain` serverless function from the same project. In the Vercel project settings, use the repository root (`./`), build command `npm run build:static`, and output directory `dist-static`. The root `api/` directory is deployed as Vercel Functions.

Add this environment variable in Vercel, then redeploy:

- `GEMINI_API_KEY` for Production and Preview. Keep this server-side; never use a `VITE_` prefix for the key. The build detects Vercel and enables the coach automatically.
- Optional: `GEMINI_MODEL` to override the default `gemini-3.8-flash` model.

For other hosts that also provide the `/api/explain` endpoint, set `VITE_GEMINI_COACH=1` at build time to show the coach controls.

This enables only the Gemini coach API. Live Lichess puzzle requests remain off in the static build; the bundled daily puzzle still works.

### Android APK

The Android app packages the same static web build in a native Capacitor shell. Chess lessons, puzzles, bots, analysis, and saved progress run on the device. The optional Gemini coach connects to the Daba Dojo Vercel API and needs that API to be deployed with `GEMINI_API_KEY` configured.

Requirements: Node.js 22+, Android SDK Platform 36 and Build Tools, and a JDK 21 installation. Android Studio is optional if those command-line tools are installed.

```bash
npm install
npx cap add android   # first time only
npm run android:apk
```

The debug-signed, installable APK is written to `android/app/build/outputs/apk/debug/Daba-Dojo.apk`. To install it on a connected device with USB debugging enabled, run `adb install -r android/app/build/outputs/apk/debug/Daba-Dojo.apk`. A Play Store release needs a release signing key and a signed Android App Bundle.

The latest debug APK is also published at [dojo-omega-two.vercel.app/downloads/Daba-Dojo.apk](https://dojo-omega-two.vercel.app/downloads/Daba-Dojo.apk). The Android build script removes downloadable APKs from the app bundle before syncing, so the app never embeds a copy of itself.

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
