import type { Lesson } from './types';

// Level 3: Intermediate. Tactics challenges are real Lichess puzzles (source field); mates were
// checked with chess.js and strategy/endgame positions with Stockfish (npm run check:lessons -- --engine).
export const LEVEL_3_LESSONS: Lesson[] = [
  {
    id: 'l3_01_decoy_deflection',
    level: 3,
    unit: 'Unit 1: Advanced Tactics',
    title: 'Decoy and Deflection',
    description: 'Lure a piece onto a bad square, or drag a defender away from its job.',
    steps: [
      {
        text: 'A decoy (attraction) is a sacrifice that forces an enemy piece, often the king, onto a square where it walks into a tactic. Here Qxh7+ drags the king to h7, and the rook mates on the h-file.',
        fen: 'r1b2r1k/ppp3pp/3p1p2/3B1P2/4PR1Q/P1Bq2P1/6P1/7K w - - 3 23',
        arrows: [['h4', 'h7', 'rgba(239, 68, 68, 0.85)'], ['f4', 'h4', 'rgba(239, 68, 68, 0.5)']],
      },
      {
        text: 'A deflection pulls a defender away from what it protects. Ask: which enemy piece is doing an important job (guarding a square, a piece, or the back rank)? Can I attack it or force it to move?',
        fen: '2Q2qk1/p4pp1/1b5p/4p3/1P2B3/2P4P/r4PP1/5RK1 w - - 2 25',
        arrows: [['e4', 'h7', 'rgba(239, 68, 68, 0.85)']],
        highlights: { f8: '#F59E0B' },
      },
    ],
    challenges: [
      {
        fen: 'r1b2r1k/ppp3pp/3p1p2/3B1P2/4PR1Q/P1Bq2P1/6P1/7K w - - 3 23',
        prompt: 'White to move: sacrifice to drag the king forward, then mate. (Mate in two.)',
        solution: ['h4h7', 'h8h7', 'f4h4'],
        source: 'lichess:2On4d',
      },
      {
        fen: '5rk1/Q5p1/4p1Pp/p2q3P/2p5/P2p4/1PPb4/1K3R2 w - - 0 38',
        prompt: 'White to move: decoy the king onto f8, then mate. (Mate in two.)',
        solution: ['f1f8', 'g8f8', 'a7f7'],
        source: 'lichess:1r1yR',
      },
      {
        fen: '2Q2qk1/p4pp1/1b5p/4p3/1P2B3/2P4P/r4PP1/5RK1 w - - 2 25',
        prompt: 'White to move: the king is the only defender of the queen on f8. Deflect it.',
        solution: ['e4h7', 'g8h7', 'c8f8'],
        source: 'lichess:47AF5',
      },
      {
        fen: '1r3r2/1bp2p1k/p2p2pp/1p2p3/4P1QN/3PP3/PPq3PP/R4RK1 w - - 0 21',
        prompt: 'White to move: a rook sacrifice on f7 lures a defender away and sets up a fork.',
        solution: ['f1f7', 'f8f7', 'g4g6', 'h7h8', 'g6f7'],
        source: 'lichess:5oiPs',
      },
    ],
  },
  {
    id: 'l3_02_removing_defender',
    level: 3,
    unit: 'Unit 1: Advanced Tactics',
    title: 'Removing the Defender',
    description: 'Capture the piece that protects your real target.',
    steps: [
      {
        text: 'If a piece is defended only once, capture (or chase away) the defender first. Then the target is loose and you take it for free.',
        fen: 'r1bq1k1r/pp3p1p/6p1/1B1Qb3/8/2N1P1P1/PP3PP1/R3K2R b KQ - 0 14',
        arrows: [['e5', 'c3', 'rgba(239, 68, 68, 0.85)'], ['d8', 'd5', 'rgba(239, 68, 68, 0.5)']],
      },
    ],
    challenges: [
      {
        fen: 'r1bq1k1r/pp3p1p/6p1/1B1Qb3/8/2N1P1P1/PP3PP1/R3K2R b KQ - 0 14',
        prompt: 'Black to move: the white queen on d5 is defended only by the knight. Remove it.',
        solution: ['e5c3', 'b2c3', 'd8d5'],
        source: 'lichess:1iAlc',
      },
      {
        fen: 'rn1q1rk1/ppp2ppp/3b4/3p2B1/3P3n/2NQ1N2/PPP2PPP/R4RK1 b - - 3 10',
        prompt: 'Black to move: the bishop on g5 is protected by the knight on f3. Take the defender with check.',
        solution: ['h4f3', 'd3f3', 'd8g5'],
        source: 'lichess:0yr0K',
      },
      {
        fen: '1nr3k1/3qppbp/3p2p1/1Q6/4PP2/4B1P1/1P3KBP/2R5 w - - 3 28',
        prompt: 'White to move: Black’s rook on c8 is defended by the queen. Remove the defender.',
        solution: ['b5d7', 'b8d7', 'c1c8'],
        source: 'lichess:9gyZx',
      },
      {
        fen: '1R6/5pk1/p3nNp1/4K1P1/2P1P3/1P6/8/6r1 b - - 6 54',
        prompt: 'Black to move: the knight on f6 is protected only by the g5 pawn. Take the pawn with check.',
        solution: ['g1g5', 'e5d6', 'g7f6'],
        source: 'lichess:1yTJm',
      },
    ],
  },
  {
    id: 'l3_03_double_check',
    level: 3,
    unit: 'Unit 1: Advanced Tactics',
    title: 'Discovered Check and Double Check',
    description: 'The most forcing moves in chess.',
    steps: [
      {
        text: 'With a discovered check, the piece that moves can go anywhere and do anything, because your opponent must answer the check first. It can capture, fork or attack the queen.',
        fen: 'r7/1pk2ppp/5n2/1P6/2N1p3/B2n4/5PPP/R5K1 w - - 1 24',
        arrows: [['a3', 'd6', 'rgba(239, 68, 68, 0.85)'], ['a1', 'a8', 'rgba(239, 68, 68, 0.5)']],
      },
      {
        text: 'A double check comes from two pieces at once. Blocking or capturing cannot stop both, so the king must move.',
        fen: '1rr3k1/6pp/8/3Nqp2/1PQ1p3/P6P/5P2/1K4R1 w - - 1 35',
        arrows: [['d5', 'e7', 'rgba(239, 68, 68, 0.85)'], ['c4', 'g8', 'rgba(239, 68, 68, 0.5)']],
      },
    ],
    challenges: [
      {
        fen: 'r7/1pk2ppp/5n2/1P6/2N1p3/B2n4/5PPP/R5K1 w - - 1 24',
        prompt: 'White to move: give a bishop check that uncovers your rook on the a-file.',
        solution: ['a3d6', 'c7d7', 'a1a8'],
        source: 'lichess:1I7Uh',
      },
      {
        fen: '1rr3k1/6pp/8/3Nqp2/1PQ1p3/P6P/5P2/1K4R1 w - - 1 35',
        prompt: 'White to move: find the double check, then win material.',
        solution: ['d5e7', 'g8h8', 'e7c8'],
        source: 'lichess:4HZUe',
      },
      {
        fen: '8/6p1/4pp2/3p4/2kPPPKP/Prr2NP1/8/3R4 w - - 1 42',
        prompt: 'White to move: a knight check uncovers your rook. Win material.',
        solution: ['f3d2', 'c4d4', 'd2b3'],
        source: 'lichess:0x2Ou',
      },
      {
        fen: 'r1b1k2r/1p1pnppp/2q5/p1p1P3/1P2P3/Q4NP1/PP1NP2P/2KR1B1R b kq - 0 14',
        prompt: 'Black to move: a pawn capture with check uncovers an attack on the white queen.',
        solution: ['c5b4', 'c1b1', 'b4a3'],
        source: 'lichess:0dVxo',
      },
    ],
  },
  {
    id: 'l3_04_mating_patterns',
    level: 3,
    unit: 'Unit 2: Mating Patterns',
    title: 'Arabian, Anastasia and Boden Mates',
    description: 'Classic patterns that strong players spot instantly.',
    steps: [
      {
        text: 'Arabian mate: a rook next to the king in the corner, protected by a knight that also covers the escape square.',
        fen: '7k/7R/5N2/8/8/8/8/6K1 b - - 0 1',
        highlights: { h7: '#EF4444', f6: '#F59E0B', g8: '#F59E0B' },
      },
      {
        text: 'Anastasia mate: a knight on e7 covers g6 and g8, the king is boxed in by its own g-pawn, and a rook or queen mates on the h-file.',
        fen: '5r2/4Nppk/8/7R/8/8/8/6K1 b - - 0 1',
        highlights: { e7: '#F59E0B', h5: '#EF4444' },
      },
      {
        text: 'Boden’s mate: two bishops on crossing diagonals mate a king that has castled queenside, usually after a queen sacrifice on c6 opens the way.',
        fen: '2kr4/p2n4/B1p5/8/5B2/8/8/6K1 b - - 0 1',
        arrows: [['a6', 'c8', 'rgba(239, 68, 68, 0.85)'], ['f4', 'b8', 'rgba(239, 68, 68, 0.5)']],
      },
    ],
    challenges: [
      {
        fen: '7k/1R6/5N2/8/8/8/8/6K1 w - - 0 1',
        prompt: 'White to move: deliver the Arabian mate.',
        solution: ['b7h7'],
      },
      {
        fen: '5r2/4Nppk/8/3R4/8/8/8/6K1 w - - 0 1',
        prompt: 'White to move: deliver the Anastasia mate.',
        solution: ['d5h5'],
      },
      {
        fen: '2kr4/p2n4/2p5/8/5B2/8/4B3/6K1 w - - 0 1',
        prompt: 'White to move: deliver Boden’s mate with your bishop.',
        solution: ['e2a6'],
      },
      {
        fen: '2kr4/pp1n4/2n5/8/5B2/5Q2/4B3/6K1 w - - 0 1',
        prompt: 'White to move: sacrifice your queen to set up Boden’s mate. (Mate in two.)',
        solution: ['f3c6', 'b7c6', 'e2a6'],
      },
    ],
  },
  {
    id: 'l3_05_greek_gift',
    level: 3,
    unit: 'Unit 2: Mating Patterns',
    title: 'The Greek Gift',
    description: 'The bishop sacrifice on h7 (or h2) against a castled king.',
    steps: [
      {
        text: 'The Greek gift is Bxh7+ against a king on g8. After Kxh7, ideas like Ng5+ and Qh5 (or a direct queen check) can finish the attack. It works best when the f6 knight is gone and Black cannot defend h7 easily.',
        fen: 'r4bk1/1pp2ppp/p1b5/2Pp2Nr/1P3Pn1/P2Bq3/1BQ3PP/R4R1K w - - 2 21',
        arrows: [['d3', 'h7', 'rgba(239, 68, 68, 0.85)'], ['c2', 'h7', 'rgba(239, 68, 68, 0.5)']],
      },
      {
        text: 'Before sacrificing, check: after the king takes, can I give a check or create a mating threat right away? If not, the sacrifice may just lose a piece.',
        fen: 'r1b3k1/ppp2ppp/2nb4/3p3n/PP1P3P/2PB1P2/4r2P/RNBQ1RK1 b - - 0 12',
        arrows: [['d6', 'h2', 'rgba(239, 68, 68, 0.85)']],
      },
    ],
    challenges: [
      {
        fen: 'r4bk1/1pp2ppp/p1b5/2Pp2Nr/1P3Pn1/P2Bq3/1BQ3PP/R4R1K w - - 2 21',
        prompt: 'White to move: Greek gift! Mate in two.',
        solution: ['d3h7', 'h5h7', 'c2h7'],
        source: 'lichess:4biQe',
      },
      {
        fen: 'r1b3k1/ppp2ppp/2nb4/3p3n/PP1P3P/2PB1P2/4r2P/RNBQ1RK1 b - - 0 12',
        prompt: 'Black to move: sacrifice your bishop on h2, then mate with the knight. (Mate in two.)',
        solution: ['d6h2', 'g1h1', 'h5g3'],
        source: 'lichess:3U6wK',
      },
      {
        fen: 'r1b3k1/pp3pPp/2p4b/3p4/8/3Br1Q1/PPP3PP/2K5 w - - 1 24',
        prompt: 'White to move: the bishop sacrifice on h7 clears the way for your g-pawn. Mate in two.',
        solution: ['d3h7', 'g8h7', 'g7g8q'],
        source: 'lichess:2gCZQ',
      },
    ],
  },
  {
    id: 'l3_06_mate_in_3',
    level: 3,
    unit: 'Unit 2: Mating Patterns',
    title: 'Calculating Mate in Three',
    description: 'Keep the line forcing: checks, then more checks.',
    steps: [
      {
        text: 'Longer mates are found the same way as short ones: forcing moves first. After each check, list every reply and make sure your next move still works against all of them.',
        fen: '1r1q1r1k/pbp1bp2/1p2pn2/6B1/3P4/3B4/PPP2PPP/R2Q2K1 w - - 0 19',
        arrows: [['g5', 'f6', 'rgba(239, 68, 68, 0.85)']],
      },
    ],
    challenges: [
      {
        fen: '1r1q1r1k/pbp1bp2/1p2pn2/6B1/3P4/3B4/PPP2PPP/R2Q2K1 w - - 0 19',
        prompt: 'White to move: remove the knight that guards h7, then mate. (Mate in three.)',
        solution: ['g5f6', 'e7f6', 'd1h5', 'h8g7', 'h5h7'],
        source: 'lichess:0udEz',
      },
      {
        fen: '8/1pp4k/1p5p/5pp1/6P1/1BPPqP1b/PP3Q1P/6K1 b - - 3 27',
        prompt: 'Black to move: mate in three. Start with a queen check.',
        solution: ['e3c1', 'b3d1', 'c1d1', 'f2e1', 'd1e1'],
        source: 'lichess:3Zl4F',
      },
      {
        fen: '8/pR5R/2p2pk1/6p1/1P3PK1/1r4P1/3r3P/8 b - - 3 34',
        prompt: 'Black to move: pawn checks drive the king into a mating net. Mate in three.',
        solution: ['f6f5', 'g4h3', 'g5g4', 'h3h4', 'd2h2'],
        source: 'lichess:136rQ',
      },
    ],
  },
  {
    id: 'l3_07_structures',
    level: 3,
    unit: 'Unit 3: Positional Play',
    title: 'Outposts, Open Files and Pawn Breaks',
    description: 'Where to put your pieces when there is no tactic.',
    steps: [
      {
        text: 'An outpost is a square that enemy pawns can never attack. A knight on an outpost in the center, like d5 here, is a monster that can only be removed by trading it.',
        fen: 'r1bqkb1r/5p1p/p1np1p2/1p2p3/4P3/N1N5/PPP2PPP/R2QKB1R w KQkq - 0 10',
        highlights: { d5: '#10B981' },
      },
      {
        text: 'Rooks belong on open files (no pawns) or half-open files. A rook on an open file can invade your opponent’s position on the 7th or 8th rank.',
        fen: 'r4rk1/pp3ppp/2n1b3/8/8/2N1B3/PP3PPP/R4RK1 w - - 0 1',
        highlights: { c1: '#3B82F6', d1: '#3B82F6', c8: '#3B82F6', d8: '#3B82F6' },
      },
      {
        text: 'A pawn break opens lines for your pieces. Prepare it (like c3 in the Italian), then strike (d4). Keep your bishops outside your own pawn chain: a bishop blocked by its own pawns is a "bad" bishop.',
        fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2P2N2/PP1P1PPP/RNBQK2R w KQkq - 1 5',
        arrows: [['d2', 'd4', 'rgba(16, 185, 129, 0.85)']],
      },
    ],
    challenges: [
      {
        fen: 'r1bqkb1r/5p1p/p1np1p2/1p2p3/4P3/N1N5/PPP2PPP/R2QKB1R w KQkq - 0 10',
        prompt: 'White to move: put your knight on the d5 outpost.',
        solution: ['c3d5'],
      },
      {
        fen: 'r4rk1/pp3ppp/2n1b3/8/8/2N1B3/PP3PPP/R4RK1 w - - 0 1',
        prompt: 'White to move: put a rook on an open file.',
        solution: ['f1d1'],
        alsoAccept: ['a1d1', 'a1c1', 'f1c1'],
      },
      {
        fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2P2N2/PP1P1PPP/RNBQK2R w KQkq - 1 5',
        prompt: 'White to move: you prepared it with c3. Now strike in the center with a pawn.',
        solution: ['d2d4'],
      },
      {
        fen: 'rnbqkbnr/pp2pppp/2p5/3pP3/3P4/8/PPP2PPP/RNBQKBNR b KQkq - 0 3',
        prompt: 'Black to move: develop your light-squared bishop outside the pawn chain before playing ...e6.',
        solution: ['c8f5'],
      },
    ],
  },
  {
    id: 'l3_08_rook_endgames',
    level: 3,
    unit: 'Unit 4: Endgames',
    title: 'Rook Endgames: Lucena and Philidor',
    description: 'The two positions every player must know.',
    steps: [
      {
        text: 'Lucena (winning): your pawn is on the 7th, your king in front of it, and the enemy king is cut off. Get your king out and block the rook checks by "building a bridge" with your rook on the 4th rank.',
        fen: '6K1/3k2P1/8/8/8/8/7r/4R3 w - - 0 1',
        arrows: [['e1', 'e4', 'rgba(16, 185, 129, 0.85)']],
      },
      {
        text: 'Philidor (drawing): the defending king stands in front of the pawn and the rook guards the 6th rank (3rd from its side) so the enemy king cannot advance. When the pawn steps forward, the rook drops back and checks from behind.',
        fen: '4k3/7R/r7/3KP3/8/8/8/8 b - - 0 1',
        highlights: { a6: '#3B82F6', b6: '#3B82F6', c6: '#3B82F6', d6: '#3B82F6' },
      },
    ],
    challenges: [
      {
        fen: '6K1/3k2P1/8/8/8/8/7r/4R3 w - - 0 1',
        prompt: 'White to move: build the bridge. Lift your rook to the 4th rank.',
        solution: ['e1e4'],
      },
      {
        fen: '4k3/1R6/8/4PK2/8/8/8/r7 b - - 0 1',
        prompt: 'Black to move: set up the Philidor defence. Put your rook on the 6th rank so the white king cannot come forward.',
        solution: ['a1a6'],
      },
      {
        fen: '4k3/7R/r3P3/4K3/8/8/8/8 b - - 0 1',
        prompt: 'Black to move: the pawn reached the 6th rank, so its king can no longer hide there. Drop your rook far back to check from behind.',
        solution: ['a6a1'],
        alsoAccept: ['a6a2', 'a6a3', 'a6a4'],
      },
    ],
  },
];
