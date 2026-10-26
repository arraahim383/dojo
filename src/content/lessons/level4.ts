import type { Lesson } from './types';

// Level 4: Advanced. Tactics challenges are real Lichess puzzles (source field); strategy and
// endgame positions were checked with Stockfish (npm run check:lessons -- --engine).
export const LEVEL_4_LESSONS: Lesson[] = [
  {
    id: 'l4_01_calculation',
    level: 4,
    unit: 'Unit 1: Calculation',
    title: 'Candidate Moves and Calculation',
    description: 'List your options, then calculate the forcing ones to the end.',
    steps: [
      {
        text: 'Strong players do not calculate everything. First list candidate moves: checks, captures and threats for both sides. Then calculate the most forcing candidate first, one clear line at a time.',
        fen: 'r4r2/p4pbk/3p2pp/2qN4/2p5/4Q3/1PP5/2K4R w - - 2 33',
        arrows: [['d5', 'f6', 'rgba(239, 68, 68, 0.85)'], ['e3', 'h6', 'rgba(239, 68, 68, 0.5)']],
      },
      {
        text: 'At the end of every line, stop and evaluate: is the king mated, did I win material, or is the position just unclear? If your opponent has a check or capture you missed, start again.',
        fen: '3k4/1p1b4/p1pP1p2/3q4/1P6/P6P/2P3PK/4Q3 w - - 1 36',
      },
    ],
    challenges: [
      {
        fen: 'r4r2/p4pbk/3p2pp/2qN4/2p5/4Q3/1PP5/2K4R w - - 2 33',
        prompt: 'White to move: mate in three. Your knight opens the h-file.',
        solution: ['d5f6', 'g7f6', 'e3h6', 'h7g8', 'h6h7'],
        source: 'lichess:350qP',
      },
      {
        fen: '3k4/1p1b4/p1pP1p2/3q4/1P6/P6P/2P3PK/4Q3 w - - 1 36',
        prompt: 'White to move: mate in three with queen checks.',
        solution: ['e1e7', 'd8c8', 'e7f8', 'd7e8', 'f8e8'],
        source: 'lichess:0CZyA',
      },
      {
        fen: '5b1r/1pk3p1/pR2p1Q1/1b2P3/7r/P4B2/1P4PP/R1B4K b - - 0 25',
        prompt: 'Black to move: mate in three. Open the h-file with a sacrifice.',
        solution: ['h4h2', 'h1g1', 'f8c5', 'c1e3', 'c5e3'],
        source: 'lichess:5kGOX',
      },
      {
        fen: 'r3k1r1/p1pbbp2/2p4B/4p3/2Bq4/2NP1P1p/PPP1n2K/R5R1 w q - 0 19',
        prompt: 'White to move: calculate a forcing sequence of rook captures with check.',
        solution: ['g1g8', 'e7f8', 'g8f8', 'e8e7', 'f8f7'],
        source: 'lichess:0yCGj',
      },
    ],
  },
  {
    id: 'l4_02_prophylaxis',
    level: 4,
    unit: 'Unit 1: Calculation',
    title: 'Prophylaxis: Stop Their Idea First',
    description: 'Ask what your opponent wants, and prevent it before it happens.',
    steps: [
      {
        text: 'Prophylaxis means preventing your opponent’s plan before it becomes a threat. Before each move, ask: "If it were my opponent’s turn, what would they play?"',
        fen: '4r1k1/pp3ppp/8/4q3/8/8/PPQ2PPP/3R2K1 w - - 0 1',
        arrows: [['e5', 'e1', 'rgba(239, 68, 68, 0.85)']],
      },
      {
        text: 'Common prophylactic moves: making luft for your king (h3, g3), moving your king off a dangerous diagonal or square, and covering a square where an enemy knight wants to land with a fork.',
        fen: 'r3kb1r/ppp2ppp/8/8/1n6/8/PPP2PPP/R3KBNR w KQkq - 0 1',
        arrows: [['b4', 'c2', 'rgba(239, 68, 68, 0.85)']],
      },
    ],
    challenges: [
      {
        fen: '4r1k1/pp3ppp/8/4q3/8/8/PPQ2PPP/3R2K1 w - - 0 1',
        prompt: 'White to move: Black threatens Qe1+ with mate on the back rank. Make luft with a pawn move.',
        solution: ['h2h3'],
        alsoAccept: ['g2g3', 'h2h4'],
      },
      {
        fen: 'r3kb1r/ppp2ppp/8/8/1n6/8/PPP2PPP/R3KBNR w KQkq - 0 1',
        prompt: 'White to move: Black threatens Nxc2+, forking your king and rook. Deal with it.',
        solution: ['e1c1'],
        alsoAccept: ['f1b5'],
      },
    ],
  },
  {
    id: 'l4_03_iqp',
    level: 4,
    unit: 'Unit 2: Middlegame Strategy',
    title: 'The Isolated Queen’s Pawn',
    description: 'Attack with it, or blockade and win it.',
    steps: [
      {
        text: 'An isolated queen’s pawn (IQP) on d4 has no neighbours on the c- and e-files. It gives its owner space, open lines and outposts on e5 and c5, so the IQP side should attack.',
        fen: 'rnbq1rk1/pp3ppp/4pn2/8/1bBP4/2N2N2/PP3PPP/R1BQ1RK1 b - - 0 9',
        highlights: { d4: '#F59E0B', e5: '#10B981', c5: '#10B981' },
      },
      {
        text: 'Against an IQP: put pressure on it with pieces, trade minor pieces (the endgame favours you), and blockade the square in front of it (d5) with a knight.',
        fen: 'rnbq1rk1/pp3ppp/4pn2/8/1bBP4/2N2N2/PP3PPP/R1BQ1RK1 b - - 0 9',
        highlights: { d5: '#3B82F6' },
        arrows: [['b8', 'c6', 'rgba(16, 185, 129, 0.85)']],
      },
    ],
    challenges: [
      {
        fen: 'rnbq1rk1/pp3ppp/4pn2/8/1bBP4/2N2N2/PP3PPP/R1BQ1RK1 b - - 0 9',
        prompt: 'Black to move: White has an isolated d-pawn. Develop your queenside knight so that it attacks the pawn.',
        solution: ['b8c6'],
      },
    ],
  },
  {
    id: 'l4_04_minority_attack',
    level: 4,
    unit: 'Unit 2: Middlegame Strategy',
    title: 'The Minority Attack',
    description: 'Two pawns attack three to create a weakness.',
    steps: [
      {
        text: 'In the Carlsbad structure (after an exchange on d5), White pushes the b-pawn to b5. Black’s queenside pawns get broken up, leaving a weak pawn on c6 or a backward pawn that White can attack.',
        fen: 'r1bqr1k1/pp2bppp/2p2nn1/3p2B1/3P4/2NBPN2/PPQ2PPP/1R3RK1 w - - 11 12',
        arrows: [['b2', 'b4', 'rgba(16, 185, 129, 0.85)'], ['b4', 'b5', 'rgba(16, 185, 129, 0.5)']],
      },
    ],
    challenges: [
      {
        fen: 'r1bqr1k1/pp2bppp/2p2nn1/3p2B1/3P4/2NBPN2/PPQ2PPP/1R3RK1 w - - 11 12',
        prompt: 'White to move: your rook is on b1. Start the minority attack.',
        solution: ['b2b4'],
      },
    ],
  },
  {
    id: 'l4_05_attacking_king',
    level: 4,
    unit: 'Unit 2: Middlegame Strategy',
    title: 'Attacking the Castled King',
    description: 'Break the pawn shield with a sacrifice.',
    steps: [
      {
        text: 'A castled king is protected by its pawns. Sacrificing a piece to remove one of them (often on h6, h7, g6 or h3) can open a line for your queen and rooks. Count your attackers against the defenders first.',
        fen: '5r1k/6p1/p3B1Rp/2q1PP2/P4Q2/7P/2pr2PK/8 w - - 0 40',
        arrows: [['g6', 'h6', 'rgba(239, 68, 68, 0.85)'], ['f4', 'h6', 'rgba(239, 68, 68, 0.5)']],
      },
    ],
    challenges: [
      {
        fen: '5r1k/6p1/p3B1Rp/2q1PP2/P4Q2/7P/2pr2PK/8 w - - 0 40',
        prompt: 'White to move: sacrifice to break the pawn shield. Mate in two.',
        solution: ['g6h6', 'g7h6', 'f4h6'],
        source: 'lichess:0kMfp',
      },
      {
        fen: '8/p3Qbkq/1pPP4/2b5/7r/5B1P/P5P1/3R3K b - - 0 41',
        prompt: 'Black to move: break open the h-file. Mate in two.',
        solution: ['h4h3', 'g2h3', 'h7h3'],
        source: 'lichess:5M5d2',
      },
      {
        fen: '6k1/1br2p2/p3p2p/1p4q1/2r5/P1PQ4/2B2RPP/5RK1 w - - 4 29',
        prompt: 'White to move: mate in three. Start with a queen check on h7.',
        solution: ['d3h7', 'g8f8', 'f2f7', 'c7f7', 'h7f7'],
        source: 'lichess:2A8QY',
      },
    ],
  },
  {
    id: 'l4_06_rook_endgames',
    level: 4,
    unit: 'Unit 3: Endgames',
    title: 'Rook Endgames in Practice',
    description: 'Active rooks, checks from behind, cutting off the king.',
    steps: [
      {
        text: 'In rook endgames the activity of your rook usually matters more than a pawn. Put your rook behind passed pawns (yours or your opponent’s), cut off the enemy king, and use checks to gain tempo.',
        fen: '8/4k1pp/5p1r/R3KP2/8/8/8/8 w - - 0 58',
      },
    ],
    challenges: [
      {
        fen: '8/1P2R3/K1k1p3/8/8/8/8/1r6 w - - 15 66',
        prompt: 'White to move: win a pawn with check and keep your b-pawn going.',
        solution: ['e7e6', 'c6c7', 'e6e7'],
        source: 'lichess:0v1Ht',
      },
      {
        fen: '8/4k3/8/5K2/p7/P7/1pr5/3R4 w - - 0 68',
        prompt: 'White to move: stop the b-pawn first, then bring your king.',
        solution: ['d1b1', 'e7d6', 'f5e4'],
        source: 'lichess:3scyP',
      },
      {
        fen: '8/4k1pp/5p1r/R3KP2/8/8/8/8 w - - 0 58',
        prompt: 'White to move: improve your king, then use your rook on the 7th rank.',
        solution: ['e5d5', 'g7g6', 'a5a7'],
        source: 'lichess:0qbJJ',
      },
    ],
  },
  {
    id: 'l4_07_pawn_endgames',
    level: 4,
    unit: 'Unit 3: Endgames',
    title: 'Pawn Endgames: Count Every Tempo',
    description: 'The most concrete endgames: one tempo decides everything.',
    steps: [
      {
        text: 'In king and pawn endings, count moves exactly: how many moves to promote, how many for the enemy king to catch up? Use your king actively and look for the opposition and outflanking.',
        fen: '8/8/5pk1/7p/5P1P/5K2/8/8 w - - 3 59',
      },
    ],
    challenges: [
      {
        fen: '8/8/5pk1/7p/5P1P/5K2/8/8 w - - 3 59',
        prompt: 'White to move: march your king to win Black’s pawns.',
        solution: ['f3e4', 'g6f7', 'e4f5', 'f7e7', 'f5g6'],
        source: 'lichess:2SkJz',
      },
      {
        fen: '8/8/8/1K1k1p2/5P1p/1P5P/8/8 b - - 3 60',
        prompt: 'Black to move: win the f4 pawn.',
        solution: ['d5e4', 'b5c5', 'e4f4'],
        source: 'lichess:101ie',
      },
      {
        fen: '8/8/3pk3/2p5/2P1P3/4K3/8/8 b - - 2 51',
        prompt: 'Black to move: take the opposition and break through on the kingside.',
        solution: ['e6e5', 'e3d3', 'e5f4'],
        source: 'lichess:3BwQ9',
      },
    ],
  },
  {
    id: 'l4_08_technique_and_clock',
    level: 4,
    unit: 'Unit 3: Endgames',
    title: 'Bishop + Knight Mate and Using Your Clock',
    description: 'The hardest basic mate, and how to manage your time.',
    steps: [
      {
        text: 'Bishop + knight mate only works in a corner of the bishop’s color. Push the king to the edge first, then to the right corner. Practice the full technique in the Drills section.',
        fen: 'k7/B7/1K6/3N4/8/8/8/8 w - - 0 1',
        highlights: { a8: '#10B981', h1: '#10B981' },
      },
      {
        text: 'Clock tips: spend your time on critical moments (captures, sacrifices, the moment the position changes), play quickly when the move is obvious, and never let yourself drop below a minute in a winning position. In long games, budget about two minutes per move for the first 30 moves.',
        fen: 'r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 2 6',
      },
    ],
    challenges: [
      {
        fen: 'k7/B7/1K6/3N4/8/8/8/8 w - - 0 1',
        prompt: 'White to move: finish the bishop + knight mate.',
        solution: ['d5c7'],
      },
      {
        fen: 'kB6/2K5/8/3N4/8/8/8/8 w - - 0 1',
        prompt: 'White to move: checkmate with the knight.',
        solution: ['d5b6'],
      },
    ],
  },
];
