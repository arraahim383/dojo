import type { Lesson } from './types';

// Level 2: Beginner. Tactics challenges are real Lichess puzzles (source field); the rest were
// checked with Stockfish. Run npm run check:lessons after editing.
export const LEVEL_2_LESSONS: Lesson[] = [
  {
    id: 'l2_01_principles',
    level: 2,
    unit: 'Unit 1: Fundamentals',
    title: 'Opening Principles',
    description: 'Control the center, develop your pieces, castle early.',
    steps: [
      {
        text: 'The opening has three jobs: fight for the center with pawns (e4, d4), bring out your knights and bishops toward the center, and castle so your king is safe.',
        fen: 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
        highlights: { d4: '#3B82F6', e4: '#3B82F6', d5: '#3B82F6', e5: '#3B82F6' },
        arrows: [['e1', 'g1', 'rgba(16, 185, 129, 0.8)']],
      },
      {
        text: 'Avoid moving the same piece twice and bringing your queen out early. An early queen gets chased by developing moves, and every chase gives your opponent free tempo.',
        fen: 'rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2',
        arrows: [['b8', 'c6', 'rgba(16, 185, 129, 0.8)'], ['g8', 'f6', 'rgba(16, 185, 129, 0.8)']],
      },
      {
        text: 'A simple checklist for every opening move: Does it help control the center? Does it develop a new piece? Does it get my king closer to castling?',
        fen: 'r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 2 6',
      },
    ],
    challenges: [
      {
        fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
        prompt: 'Develop a knight so that it attacks Black’s e5 pawn.',
        solution: ['g1f3'],
      },
      {
        fen: 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
        prompt: 'Your knight and bishop are out. Castle kingside to make your king safe.',
        solution: ['e1g1'],
      },
      {
        fen: 'rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR b KQkq - 1 3',
        prompt: 'Black to move: develop your kingside knight to its best square.',
        solution: ['g8f6'],
      },
      {
        fen: 'rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2',
        prompt: 'Black to move: White’s queen came out early and attacks e5. Defend the pawn with a developing move.',
        solution: ['b8c6'],
      },
      {
        fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3',
        prompt: 'Black to move: White threatens Qxf7 checkmate! Stop it with a pawn move that also attacks the queen.',
        solution: ['g7g6'],
      },
    ],
  },
  {
    id: 'l2_02_blunder_check',
    level: 2,
    unit: 'Unit 1: Fundamentals',
    title: 'The Blunder Check',
    description: 'Before every move: checks, captures, threats.',
    steps: [
      {
        text: 'Most games between beginners are decided by a piece left hanging. Before every move, ask three questions: What checks are there? What captures? What is my opponent threatening?',
        fen: '8/8/8/8/3pk3/6r1/PPP3K1/8 w - - 0 41',
        highlights: { g3: '#EF4444' },
      },
      {
        text: 'After your opponent moves, ask: why did they play that? What does that piece attack now? A move that looks harmless can set up a threat against your king or a loose piece.',
        fen: 'r5k1/pb3ppp/1p6/6q1/8/2N5/PP3PPP/3QR1K1 w - - 0 1',
        arrows: [['b7', 'g2', 'rgba(239, 68, 68, 0.85)'], ['g5', 'g2', 'rgba(239, 68, 68, 0.85)']],
      },
    ],
    challenges: [
      {
        fen: '8/8/8/8/3pk3/6r1/PPP3K1/8 w - - 0 41',
        prompt: 'White to move: Black just left a piece unprotected. Capture it.',
        solution: ['g2g3', 'd4d3', 'c2d3'],
        source: 'lichess:0IRFZ',
      },
      {
        fen: '3r4/2bP1k2/5R2/6pp/3p4/6BP/1P4P1/6K1 b - - 0 39',
        prompt: 'Black to move: one of White’s pieces is hanging. Take it, then deal with the pawn.',
        solution: ['f7f6', 'g3c7', 'd8d7'],
        source: 'lichess:pkmgl',
      },
      {
        fen: '8/5pk1/p2p2p1/1p5p/2Pp3P/1P3P2/P3r1P1/5K2 w - - 0 29',
        prompt: 'White to move: what did Black just leave unprotected?',
        solution: ['f1e2', 'b5c4', 'b3c4'],
        source: 'lichess:2drBh',
      },
      {
        fen: 'r5k1/pb3ppp/1p6/6q1/8/2N5/PP3PPP/3QR1K1 w - - 0 1',
        prompt: 'White to move: Black threatens Qxg2 checkmate. Stop the threat.',
        solution: ['f2f3'],
        alsoAccept: ['c3e4', 'g2g3'],
      },
    ],
  },
  {
    id: 'l2_03_forks',
    level: 2,
    unit: 'Unit 2: Tactics',
    title: 'Forks',
    description: 'One piece attacks two targets at once.',
    steps: [
      {
        text: 'A fork is one piece attacking two or more enemy pieces at the same time. Your opponent can only save one of them. Here the knight checks the king and attacks the rook.',
        fen: 'r3k3/2N5/8/8/8/8/8/4K3 b - - 0 1',
        arrows: [['c7', 'e8', 'rgba(239, 68, 68, 0.85)'], ['c7', 'a8', 'rgba(239, 68, 68, 0.85)']],
      },
      {
        text: 'Knights are the best forkers because they attack in an unusual pattern, but any piece can fork. Forks that include a check are the strongest: the king must move first.',
        fen: '4k3/8/2n1b3/3P4/8/8/8/4K3 w - - 0 1',
        arrows: [['d5', 'c6', 'rgba(239, 68, 68, 0.85)'], ['d5', 'e6', 'rgba(239, 68, 68, 0.85)']],
      },
    ],
    challenges: [
      {
        fen: '4r3/7k/5ppn/p2N4/P2n2P1/1p5P/1P3P2/R5K1 w - - 0 30',
        prompt: 'White to move: your knight can check the king and attack the rook at the same time.',
        solution: ['d5f6', 'h7h8', 'f6e8'],
        source: 'lichess:81jmH',
      },
      {
        fen: 'r1b1r1k1/pp3ppp/8/n2BN3/8/2P5/P3KPPP/1R5R w - - 5 19',
        prompt: 'White to move: find a bishop fork.',
        solution: ['d5f7', 'g8f8', 'f7e8'],
        source: 'lichess:490Ey',
      },
      {
        fen: '8/8/b2kBp2/2pp1P2/1p4K1/1P6/2P5/3N4 b - - 1 36',
        prompt: 'Black to move: check the king and win the knight.',
        solution: ['a6e2', 'g4g3', 'e2d1'],
        source: 'lichess:B8ZLe',
      },
      {
        fen: '8/6kp/8/2N1pp2/p1Br4/7P/1K4P1/8 w - - 3 57',
        prompt: 'White to move: fork the king and the rook.',
        solution: ['c5e6', 'g7f6', 'e6d4'],
        source: 'lichess:5sAT1',
      },
    ],
  },
  {
    id: 'l2_04_pins',
    level: 2,
    unit: 'Unit 2: Tactics',
    title: 'Pins',
    description: 'A piece that cannot move without exposing something more valuable.',
    steps: [
      {
        text: 'A pin is when a piece cannot move because a more valuable piece stands behind it. If the piece behind is the king, the pin is absolute: the pinned piece is not even allowed to move.',
        fen: '4k3/8/2n5/8/B7/8/8/4K3 b - - 0 1',
        arrows: [['a4', 'e8', 'rgba(239, 68, 68, 0.85)']],
        highlights: { c6: '#F59E0B' },
      },
      {
        text: 'Attack a pinned piece again, ideally with a pawn: it cannot run away. Or pin a piece against the king and then win it.',
        fen: '4k3/8/2n5/1B1P4/8/8/8/4K3 w - - 0 1',
        arrows: [['d5', 'c6', 'rgba(16, 185, 129, 0.85)'], ['b5', 'e8', 'rgba(239, 68, 68, 0.6)']],
      },
    ],
    challenges: [
      {
        fen: '3q3k/p5p1/5b1p/1Rp1p3/5p2/2PP1P2/P5K1/1R6 w - - 2 33',
        prompt: 'White to move: pin the black queen against its king.',
        solution: ['b5b8', 'h8h7', 'b8d8'],
        source: 'lichess:0iEPY',
      },
      {
        fen: '5rk1/5ppp/3B4/8/p7/5P2/2BK2PP/8 b - - 0 41',
        prompt: 'Black to move: pin the bishop against the white king and win it.',
        solution: ['f8d8', 'd2e3', 'd8d6'],
        source: 'lichess:0WVVy',
      },
      {
        fen: '3rb1k1/1p3p1p/p1p1p1p1/2q1P3/P1Pr1P2/1P2Q3/4B1PP/3RR2K b - - 4 22',
        prompt: 'Black to move: win material. Look at the white rook on e1 and the king behind it.',
        solution: ['d4d1', 'e3c5', 'd1e1'],
        source: 'lichess:1Mh2U',
      },
    ],
  },
  {
    id: 'l2_05_skewers',
    level: 2,
    unit: 'Unit 2: Tactics',
    title: 'Skewers',
    description: 'Attack a valuable piece; when it moves, take what was behind it.',
    steps: [
      {
        text: 'A skewer is a pin in reverse: you attack a valuable piece (often the king), it has to move, and you capture the piece behind it.',
        fen: 'q7/8/8/8/k7/8/8/R3K3 b - - 0 1',
        arrows: [['a1', 'a8', 'rgba(239, 68, 68, 0.85)']],
      },
    ],
    challenges: [
      {
        fen: '8/8/6R1/5p2/3kp3/6P1/r4PK1/3q1B2 w - - 0 64',
        prompt: 'White to move: check the king so the queen behind it falls.',
        solution: ['g6d6', 'd4e5', 'd6d1'],
        source: 'lichess:9gedV',
      },
      {
        fen: '8/8/7k/4p1Rp/7P/5PK1/8/4r3 b - - 3 54',
        prompt: 'Black to move: skewer the king and the rook.',
        solution: ['e1g1', 'g3f2', 'g1g5'],
        source: 'lichess:5FLVa',
      },
      {
        fen: '4b3/8/1p6/3k2pp/8/P2K1PP1/4N3/8 b - - 2 38',
        prompt: 'Black to move: check with your bishop and win the knight behind the king.',
        solution: ['e8b5', 'd3e3', 'b5e2'],
        source: 'lichess:52ocA',
      },
    ],
  },
  {
    id: 'l2_06_discovered',
    level: 2,
    unit: 'Unit 2: Tactics',
    title: 'Discovered Attacks',
    description: 'Move one piece to unleash another.',
    steps: [
      {
        text: 'When a piece moves out of the way, the piece behind it can suddenly attack. The moving piece can make its own threat at the same time: two attacks in one move.',
        fen: '3q3k/8/8/8/3N4/8/8/3RK3 w - - 0 1',
        arrows: [['d1', 'd8', 'rgba(239, 68, 68, 0.85)'], ['d4', 'f5', 'rgba(16, 185, 129, 0.85)']],
      },
      {
        text: 'If the uncovered piece gives check, it is a discovered check, and the piece that moved can grab almost anything. If both pieces give check, it is a double check and the king must move.',
        fen: 'r3kb1r/ppp1qppp/3p4/4n3/2B5/5Q2/PPP2PPP/RNB1R1K1 b kq - 1 10',
        arrows: [['e7', 'e1', 'rgba(239, 68, 68, 0.85)']],
      },
    ],
    challenges: [
      {
        fen: 'r3kb1r/ppp1qppp/3p4/4n3/2B5/5Q2/PPP2PPP/RNB1R1K1 b kq - 1 10',
        prompt: 'Black to move: move the knight with check and uncover your queen’s attack on e1.',
        solution: ['e5f3', 'g2f3', 'e7e1'],
        source: 'lichess:6TZGX',
      },
      {
        fen: '2q1r1k1/1r1nbppp/Q1p1p3/p1Pp4/N2P1B2/P3P2P/5PP1/RR4K1 b - - 1 19',
        prompt: 'Black to move: move your rook with check and uncover an attack on the white queen.',
        solution: ['b7b1', 'a1b1', 'c8a6'],
        source: 'lichess:0HhPI',
      },
      {
        fen: '8/8/pp1pBp1k/3P3P/2K3P1/PP5r/8/8 w - - 0 50',
        prompt: 'White to move: a pawn check opens a line for your bishop.',
        solution: ['g4g5', 'f6g5', 'e6h3'],
        source: 'lichess:1k1IT',
      },
    ],
  },
  {
    id: 'l2_07_mating_patterns',
    level: 2,
    unit: 'Unit 3: Mating Patterns',
    title: 'Back-Rank and Smothered Mates',
    description: 'Kings trapped by their own pieces.',
    steps: [
      {
        text: 'Back-rank mate: the king sits behind its own pawns and a rook or queen checks along the back rank. To avoid it, make "luft" (an escape square) with a pawn move like h3 or h6.',
        fen: 'R5k1/5ppp/8/8/8/8/8/7K b - - 0 1',
        highlights: { f7: '#F59E0B', g7: '#F59E0B', h7: '#F59E0B' },
      },
      {
        text: 'Smothered mate: the king is completely surrounded by its own pieces and a knight delivers check. Nothing can block a knight check.',
        fen: '6rk/5Npp/8/8/8/8/8/6K1 b - - 0 1',
        highlights: { g8: '#F59E0B', g7: '#F59E0B', h7: '#F59E0B' },
      },
    ],
    challenges: [
      {
        fen: '2kr3r/1ppqb1pp/p4p2/R7/4Q1P1/2P1BN1P/1P2PP2/4K2R b K - 0 18',
        prompt: 'Black to move: checkmate in one.',
        solution: ['d7d1'],
        source: 'lichess:33Qi4',
      },
      {
        fen: '8/p1kr4/1p2pR1p/2p3r1/4Q3/1P2P3/P5PP/7K b - - 1 31',
        prompt: 'Black to move: checkmate in two on the back rank.',
        solution: ['d7d1', 'f6f1', 'd1f1'],
        source: 'lichess:BeFWj',
      },
      {
        fen: 'rn4rk/pp1b2np/2pb2pB/3P1pN1/P1Pq1p2/1PN4P/2B3P1/R3K2R w KQ - 0 24',
        prompt: 'White to move: smothered mate in one.',
        solution: ['g5f7'],
        source: 'lichess:0tPyE',
      },
      {
        fen: 'r5rk/pp4pp/2n4N/q3Pp2/5Bb1/2P5/P4PPP/R3R1K1 w - - 0 21',
        prompt: 'White to move: smothered mate in one.',
        solution: ['h6f7'],
        source: 'lichess:2ESpH',
      },
    ],
  },
  {
    id: 'l2_08_mate_in_2',
    level: 2,
    unit: 'Unit 3: Mating Patterns',
    title: 'Mate in Two',
    description: 'Look at every check, then every reply.',
    steps: [
      {
        text: 'To find a mate in two, start with forcing moves: list every check, and for each one look at all of your opponent’s answers. If every answer allows a mate, you found it.',
        fen: '6k1/8/p2P3p/8/1P1R4/P4pP1/2r4P/7K b - - 0 34',
        arrows: [['c2', 'c1', 'rgba(239, 68, 68, 0.85)']],
      },
    ],
    challenges: [
      {
        fen: '8/1p6/8/4P2R/1r3p2/6kP/P2R4/6K1 b - - 0 44',
        prompt: 'Black to move: mate in two.',
        solution: ['b4b1', 'd2d1', 'b1d1'],
        source: 'lichess:9NW8B',
      },
      {
        fen: '5k2/8/3N4/1p1b2p1/1R6/2P3PP/2r2P2/6K1 b - - 1 41',
        prompt: 'Black to move: mate in two.',
        solution: ['c2c1', 'g1h2', 'c1h1'],
        source: 'lichess:3Tlgf',
      },
      {
        fen: '6k1/5r1p/p4bpB/1p1q4/8/4Qn1K/PP3P1P/R7 w - - 8 35',
        prompt: 'White to move: mate in two.',
        solution: ['e3e8', 'f7f8', 'e8f8'],
        source: 'lichess:24GQ0',
      },
    ],
  },
  {
    id: 'l2_09_trading',
    level: 2,
    unit: 'Unit 4: Strategy & Endgames',
    title: 'When to Trade',
    description: 'Trade when you are ahead; keep pieces on when you are behind.',
    steps: [
      {
        text: 'When you are ahead in material, trade pieces (not pawns). The fewer pieces left, the harder it is for your opponent to make threats, and the easier your extra material wins.',
        fen: 'r2q2k1/pp3ppp/8/8/8/8/PP3PPP/R2Q1RK1 w - - 0 1',
        arrows: [['d1', 'd8', 'rgba(16, 185, 129, 0.85)']],
      },
      {
        text: 'When you are behind, avoid trades and keep pieces on the board to create chances. And in any position, a trade that swaps your worst piece for your opponent’s best piece is usually good.',
        fen: '3r4/pp2kpp1/7p/8/8/2N5/PP3PPP/3R2K1 w - - 0 1',
      },
    ],
    challenges: [
      {
        fen: 'r2q2k1/pp3ppp/8/8/8/8/PP3PPP/R2Q1RK1 w - - 0 1',
        prompt: 'You are a rook up. Trade queens!',
        solution: ['d1d8'],
      },
      {
        fen: '3r4/pp2kpp1/7p/8/8/2N5/PP3PPP/3R2K1 w - - 0 1',
        prompt: 'You are a knight up. Trade the rooks on the open file.',
        solution: ['d1d8'],
      },
    ],
  },
  {
    id: 'l2_10_pawn_endings',
    level: 2,
    unit: 'Unit 4: Strategy & Endgames',
    title: 'Pawn Endings: The Square and the Opposition',
    description: 'Can the king catch the pawn? Who has the opposition?',
    steps: [
      {
        text: 'The rule of the square: draw a square from your pawn to its promotion rank. If the enemy king cannot step into that square, the pawn simply runs and queens.',
        fen: '8/8/8/6k1/1P6/8/8/7K w - - 0 1',
        highlights: { b4: '#3B82F6', f4: '#3B82F6', f8: '#3B82F6', b8: '#3B82F6' },
      },
      {
        text: 'The opposition: when the kings face each other with one square between them, the player who does NOT have to move has the opposition. The other king must give way.',
        fen: '8/3k4/8/3K4/3P4/8/8/8 b - - 0 1',
        arrows: [['d5', 'd7', 'rgba(245, 158, 11, 0.8)']],
      },
      {
        text: 'Your king should lead its pawn, not follow it. If your king reaches the 6th rank in front of its pawn, the pawn will queen no matter who moves.',
        fen: '4k3/8/4K3/4P3/8/8/8/8 w - - 0 1',
      },
    ],
    challenges: [
      {
        fen: '8/8/8/6k1/1P6/8/8/7K w - - 0 1',
        prompt: 'The black king is outside the square of your pawn. Make the winning move.',
        solution: ['b4b5'],
      },
      {
        fen: '8/3k4/8/2K5/3P4/8/8/8 w - - 0 1',
        prompt: 'Take the opposition: put your king directly in front of Black’s king with one square between them.',
        solution: ['c5d5'],
      },
      {
        fen: '8/8/4k3/8/8/4K3/4P3/8 w - - 0 1',
        prompt: 'Your king should lead the pawn. Move it forward.',
        solution: ['e3e4'],
        alsoAccept: ['e3d4', 'e3f4'],
      },
      {
        fen: '4k3/8/8/4K3/4P3/8/8/8 w - - 0 1',
        prompt: 'Bring your king to the 6th rank in front of the pawn.',
        solution: ['e5e6'],
        alsoAccept: ['e5d6', 'e5f6'],
      },
    ],
  },
];
