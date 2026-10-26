import type { Lesson } from './types';

// Level 1: New to Chess. Every challenge position is legal and checked by validate.ts.
export const LEVEL_1_LESSONS: Lesson[] = [
  {
    id: 'l1_01_board',
    level: 1,
    unit: 'Unit 1: The Battlefield',
    title: 'The Board & Coordinates',
    description: 'The 64 squares, files a–h, ranks 1–8, and the rule: light square on the right.',
    steps: [
      {
        text: 'The chessboard has 64 squares: 8 columns called files (a to h) and 8 rows called ranks (1 to 8). Every square has a name, like e4: file e, rank 4.',
        fen: '8/8/8/8/8/8/8/8 w - - 0 1',
        arrows: [['e1', 'e8', 'rgba(245, 158, 11, 0.8)']],
        highlights: { e4: '#F59E0B' },
      },
      {
        text: 'Set the board up so each player has a light square in the bottom-right corner: "light on the right". From White’s side that corner is h1.',
        fen: '8/8/8/8/8/8/8/8 w - - 0 1',
        highlights: { h1: '#10B981', a8: '#10B981' },
      },
      {
        text: 'The four middle squares (d4, e4, d5, e5) are the center. Pieces in the center control more squares, so both sides fight for it from the first move.',
        fen: '8/8/8/8/8/8/8/8 w - - 0 1',
        highlights: { d4: '#3B82F6', e4: '#3B82F6', d5: '#3B82F6', e5: '#3B82F6' },
      },
      {
        text: 'This is the starting position. White always moves first. Pawns stand on the 2nd and 7th ranks; the pieces stand behind them.',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      },
    ],
    challenges: [
      {
        fen: '7k/8/8/8/8/8/4P3/K7 w - - 0 1',
        prompt: 'Move your pawn two squares forward, from e2 to e4.',
        solution: ['e2e4'],
      },
      {
        fen: '7k/8/8/8/8/8/3P4/K7 w - - 0 1',
        prompt: 'Move your pawn from d2 to d4.',
        solution: ['d2d4'],
      },
      {
        fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
        prompt: 'Black to move: answer in the center with the pawn from e7 to e5.',
        solution: ['e7e5'],
      },
    ],
  },
  {
    id: 'l1_02_pieces_movement',
    level: 1,
    unit: 'Unit 1: The Battlefield',
    title: 'How Each Piece Moves',
    description: 'The paths of the rook, bishop, knight, queen and king.',
    steps: [
      {
        text: 'The rook moves in straight lines along ranks and files, as far as the path is clear.',
        fen: '8/8/8/3R4/8/8/8/8 w - - 0 1',
        arrows: [['d5', 'd8'], ['d5', 'd1'], ['d5', 'a5'], ['d5', 'h5']],
      },
      {
        text: 'The bishop moves diagonally, as far as the path is clear. A bishop stays on its color forever: this one only ever visits dark squares.',
        fen: '8/8/8/4B3/8/8/8/8 w - - 0 1',
        arrows: [['e5', 'a1'], ['e5', 'h8'], ['e5', 'b8'], ['e5', 'h2']],
      },
      {
        text: 'The knight jumps in an L: two squares one way, then one square to the side. It is the only piece that can jump over others.',
        fen: '8/8/8/3N4/8/8/8/8 w - - 0 1',
        highlights: { c7: '#10B981', e7: '#10B981', f6: '#10B981', f4: '#10B981', e3: '#10B981', c3: '#10B981', b4: '#10B981', b6: '#10B981' },
      },
      {
        text: 'The queen moves like a rook and a bishop combined: any number of squares in a straight line or diagonal. The king moves one square in any direction.',
        fen: '8/8/8/3Q4/8/8/8/8 w - - 0 1',
        arrows: [['d5', 'd8'], ['d5', 'h1'], ['d5', 'a5'], ['d5', 'a8']],
      },
    ],
    challenges: [
      {
        fen: '7k/8/8/8/8/8/8/R5K1 w - - 0 1',
        prompt: 'Slide the rook all the way up the a-file to a8.',
        solution: ['a1a8'],
      },
      {
        fen: '7k/8/8/8/8/2N5/7P/6K1 w - - 0 1',
        prompt: 'Jump the knight from c3 to e4.',
        solution: ['c3e4'],
      },
      {
        fen: '7k/8/8/8/8/8/6PP/2B3K1 w - - 0 1',
        prompt: 'Move your dark-squared bishop from c1 to f4.',
        solution: ['c1f4'],
      },
      {
        fen: '7k/8/6K1/8/8/8/8/1Q6 w - - 0 1',
        prompt: 'Your queen can deliver checkmate in one move. Find it!',
        solution: ['b1b8'],
        acceptAnyMate: true,
      },
    ],
  },
  {
    id: 'l1_03_capturing',
    level: 1,
    unit: 'Unit 2: The Rules of Combat',
    title: 'Capturing',
    description: 'Take enemy pieces by moving onto their square. Pawns capture diagonally.',
    steps: [
      {
        text: 'If an enemy piece stands on a square your piece can move to, you can capture it: your piece takes its place and the enemy piece leaves the board.',
        fen: '8/8/8/3p4/3R4/8/8/8 w - - 0 1',
        arrows: [['d4', 'd5', 'rgba(239, 68, 68, 0.8)']],
      },
      {
        text: 'Pawns are special: they move straight forward, but capture one square diagonally forward.',
        fen: '8/8/8/3p4/4P3/8/8/8 w - - 0 1',
        arrows: [['e4', 'd5', 'rgba(239, 68, 68, 0.8)']],
      },
    ],
    challenges: [
      {
        fen: '7k/8/8/3r4/8/8/8/3R3K w - - 0 1',
        prompt: 'Capture the black rook on d5 with your rook.',
        solution: ['d1d5'],
      },
      {
        fen: '7k/8/8/2n5/3P4/8/8/7K w - - 0 1',
        prompt: 'Capture the knight with your pawn.',
        solution: ['d4c5'],
      },
      {
        fen: '7k/8/8/4q3/8/2B5/8/7K w - - 0 1',
        prompt: 'Your bishop can capture the black queen on e5. Take it!',
        solution: ['c3e5'],
      },
    ],
  },
  {
    id: 'l1_04_check',
    level: 1,
    unit: 'Unit 2: The Rules of Combat',
    title: 'Check and How to Escape It',
    description: 'When your king is attacked you must get out of check: capture, block, or move.',
    steps: [
      {
        text: 'A king that is attacked is "in check". You are never allowed to leave your king in check, so you must deal with it right away.',
        fen: '4k3/8/8/8/8/8/8/4R2K b - - 0 1',
        arrows: [['e1', 'e8', 'rgba(239, 68, 68, 0.9)']],
        highlights: { e8: '#EF4444' },
      },
      {
        text: 'There are three ways out of check: capture the attacking piece, block the line with one of your pieces, or move the king to a safe square.',
        fen: '4k3/8/8/2b5/8/8/8/4R2K b - - 0 1',
        arrows: [['c5', 'e7', 'rgba(16, 185, 129, 0.8)']],
      },
    ],
    challenges: [
      {
        fen: '4k3/8/8/8/8/8/8/4R2K b - - 0 1',
        prompt: 'Black is in check from the rook on e1. Move the king off the e-file.',
        solution: ['e8d7'],
        alsoAccept: ['e8f7', 'e8d8', 'e8f8'],
      },
      {
        fen: '4k3/8/8/2b5/8/8/8/4R2K b - - 0 1',
        prompt: 'Block the check by putting your bishop between the rook and your king.',
        solution: ['c5e7'],
        alsoAccept: ['c5e3'],
      },
      {
        fen: '4k3/8/8/8/8/8/8/r6K w - - 0 1',
        prompt: 'White is in check along the 1st rank. Move your king off that rank.',
        solution: ['h1g2'],
        alsoAccept: ['h1h2'],
      },
      {
        fen: '4k3/8/8/8/8/3n4/4P3/4K3 w - - 0 1',
        prompt: 'The knight on d3 is giving check. Capture it with your pawn!',
        solution: ['e2d3'],
      },
    ],
  },
  {
    id: 'l1_05_checkmate',
    level: 1,
    unit: 'Unit 2: The Rules of Combat',
    title: 'Checkmate: The Goal of the Game',
    description: 'Check with no escape: the king cannot capture, block, or move. The game is over.',
    steps: [
      {
        text: 'Checkmate means the king is in check and there is no way out. That wins the game. Here Black’s king is mated: the rook covers the whole 8th rank.',
        fen: 'R5k1/5ppp/8/8/8/8/8/7K b - - 0 1',
        arrows: [['a8', 'g8', 'rgba(239, 68, 68, 0.9)']],
        highlights: { g8: '#EF4444' },
      },
      {
        text: 'Black’s own pawns block the king’s escape squares. This pattern is called a back-rank mate, and it happens all the time in real games.',
        fen: 'R5k1/5ppp/8/8/8/8/8/7K b - - 0 1',
        highlights: { f7: '#F59E0B', g7: '#F59E0B', h7: '#F59E0B' },
      },
    ],
    challenges: [
      {
        fen: '4k3/8/4K3/8/8/8/8/7Q w - - 0 1',
        prompt: 'Use your queen, supported by your king, to deliver checkmate.',
        solution: ['h1h8'],
        acceptAnyMate: true,
      },
      {
        fen: '6k1/5ppp/8/8/8/8/4Q3/6K1 w - - 0 1',
        prompt: 'Deliver a back-rank checkmate with your queen.',
        solution: ['e2e8'],
      },
      {
        fen: 'r1bqkb1r/pppp1ppp/2n5/4p2Q/2B1n3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 4',
        prompt: 'The f7 pawn is only defended by the king. Checkmate in one!',
        solution: ['h5f7'],
      },
    ],
  },
  {
    id: 'l1_06_stalemate_draws',
    level: 1,
    unit: 'Unit 3: Special Rules',
    title: 'Stalemate and Draws',
    description: 'No legal moves but not in check is a draw. Learn to avoid it when winning.',
    steps: [
      {
        text: 'Stalemate: the player to move has no legal moves, but the king is NOT in check. The game is a draw. Here it is Black to move, and every king move walks into an attack.',
        fen: 'k7/2Q5/1K6/8/8/8/8/8 b - - 0 1',
        highlights: { a8: '#3B82F6' },
      },
      {
        text: 'Other draws: the same position three times (threefold repetition), 50 moves each without a capture or pawn move, or too little material to mate (like king against king).',
        fen: '8/8/8/4k3/8/8/8/4K3 w - - 0 1',
        highlights: { e1: '#10B981', e5: '#10B981' },
      },
    ],
    challenges: [
      {
        fen: 'k7/8/1K6/8/8/8/1Q6/8 w - - 0 1',
        prompt: 'Deliver checkmate. Careful: some queen moves leave Black with no moves at all, which would be stalemate.',
        solution: ['b2h8'],
        acceptAnyMate: true,
      },
      {
        fen: 'k7/2K5/8/8/8/8/8/1Q6 w - - 0 1',
        prompt: 'Checkmate in one. (Qb6 would be stalemate!)',
        solution: ['b1b7'],
        acceptAnyMate: true,
      },
    ],
  },
  {
    id: 'l1_07_castling',
    level: 1,
    unit: 'Unit 3: Special Rules',
    title: 'Castling',
    description: 'Tuck your king to safety and bring a rook into play in one move.',
    steps: [
      {
        text: 'Castling is the only move where two pieces move at once: the king moves two squares toward a rook, and the rook jumps to the square on the king’s other side.',
        fen: 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1',
        arrows: [['e1', 'g1', 'rgba(16, 185, 129, 0.8)'], ['h1', 'f1', 'rgba(16, 185, 129, 0.8)']],
      },
      {
        text: 'You cannot castle if the king or that rook has already moved, if you are in check, or if the king would pass through or land on an attacked square.',
        fen: 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1',
        highlights: { e1: '#F59E0B', f1: '#F59E0B', g1: '#10B981' },
      },
    ],
    challenges: [
      {
        fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 6 5',
        prompt: 'Castle kingside (O-O): move your king two squares toward the h1 rook.',
        solution: ['e1g1'],
      },
      {
        fen: 'r3kbnr/pppq1ppp/2np4/4p3/4P3/2NP1N2/PPP2PPP/R1BQK2R b KQkq - 0 6',
        prompt: 'Black to move: castle queenside (O-O-O).',
        solution: ['e8c8'],
      },
    ],
  },
  {
    id: 'l1_08_en_passant',
    level: 1,
    unit: 'Unit 3: Special Rules',
    title: 'En Passant',
    description: 'A special pawn capture right after an enemy pawn moves two squares.',
    steps: [
      {
        text: 'If an enemy pawn moves two squares and lands right next to your pawn, you may capture it as if it had moved only one square: your pawn goes diagonally behind it.',
        fen: '7k/8/8/4Pp2/8/8/8/7K w - f6 0 1',
        arrows: [['e5', 'f6', 'rgba(239, 68, 68, 0.8)']],
      },
      {
        text: 'You can only do this on the very next move. Wait one move and the chance is gone.',
        fen: '7k/8/8/4Pp2/8/8/8/7K w - f6 0 1',
        highlights: { f6: '#F59E0B', f5: '#EF4444' },
      },
    ],
    challenges: [
      {
        fen: '7k/8/8/3Pp3/8/8/8/7K w - e6 0 1',
        prompt: 'Black just played e7-e5. Capture it en passant with your d5 pawn.',
        solution: ['d5e6'],
      },
      {
        fen: '7k/8/8/8/4pP2/8/8/7K b - f3 0 1',
        prompt: 'Black to move: White just played f2-f4. Capture en passant.',
        solution: ['e4f3'],
      },
    ],
  },
  {
    id: 'l1_09_promotion',
    level: 1,
    unit: 'Unit 3: Special Rules',
    title: 'Pawn Promotion',
    description: 'A pawn that reaches the last rank becomes a queen (or rook, bishop or knight).',
    steps: [
      {
        text: 'When a pawn reaches the far end of the board, it must be promoted: you swap it for a queen, rook, bishop or knight of your color.',
        fen: '7k/4P3/8/8/8/8/8/K7 w - - 0 1',
        arrows: [['e7', 'e8', 'rgba(16, 185, 129, 0.9)']],
        highlights: { e8: '#10B981' },
      },
      {
        text: 'Almost always you choose a queen, the strongest piece. You can have more than one queen at a time.',
        fen: '7k/4P3/8/8/8/8/8/K7 w - - 0 1',
      },
    ],
    challenges: [
      {
        fen: '7k/4P3/8/8/8/8/8/K7 w - - 0 1',
        prompt: 'Push your pawn to e8 and promote it to a queen.',
        solution: ['e7e8q'],
      },
      {
        fen: '6K1/8/8/8/8/8/4p3/6k1 b - - 0 1',
        prompt: 'Black to move: push to e1 and promote to a queen.',
        solution: ['e2e1q'],
      },
      {
        fen: '8/3P4/8/8/8/8/8/k6K w - - 0 1',
        prompt: 'Promote the d7 pawn to a queen.',
        solution: ['d7d8q'],
      },
    ],
  },
  {
    id: 'l1_10_piece_values',
    level: 1,
    unit: 'Unit 4: First Principles',
    title: 'What the Pieces Are Worth',
    description: 'Point values help you decide which trades are good.',
    steps: [
      {
        text: 'Pawn = 1 point. Knight = 3. Bishop = 3. Rook = 5. Queen = 9. The king cannot be traded: losing it means losing the game.',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      },
      {
        text: 'Use the values to judge trades: giving a rook (5) for a knight (3) loses 2 points, unless it wins something bigger, like a checkmate.',
        fen: '7k/8/8/4n3/8/8/8/4R2K w - - 0 1',
        arrows: [['e1', 'e5', 'rgba(16, 185, 129, 0.8)']],
      },
    ],
    challenges: [
      {
        fen: '7k/8/8/4q3/3P4/8/8/7K w - - 0 1',
        prompt: 'Trade a 1-point pawn for a 9-point queen: capture on e5!',
        solution: ['d4e5'],
      },
      {
        fen: '7k/8/3b4/8/8/8/8/3R3K w - - 0 1',
        prompt: 'Win a free bishop with your rook.',
        solution: ['d1d6'],
      },
    ],
  },
  {
    id: 'l1_11_mating_technique',
    level: 1,
    unit: 'Unit 4: First Principles',
    title: 'Two Rooks: The Lawnmower Mate',
    description: 'Two rooks take turns stepping forward to push the king to the edge.',
    steps: [
      {
        text: 'One rook guards a rank so the king cannot step back; the other rook gives check on the next rank, pushing the king one rank further.',
        fen: '8/8/8/4k3/R7/1R6/8/7K w - - 0 1',
        arrows: [['a4', 'h4'], ['b3', 'b5']],
      },
      {
        text: 'Repeat, rank after rank, like a lawnmower, until the king is on the edge. Then the next rook check is checkmate.',
        fen: '4k3/R7/1R6/8/8/8/8/7K w - - 0 1',
        arrows: [['b6', 'b8', 'rgba(239, 68, 68, 0.9)']],
      },
    ],
    challenges: [
      {
        fen: '8/8/4k3/R7/1R6/8/8/7K w - - 0 1',
        prompt: 'Push the king back: check it with the b4 rook on b6.',
        solution: ['b4b6'],
      },
      {
        fen: '4k3/R7/1R6/8/8/8/8/7K w - - 0 1',
        prompt: 'The king is on the edge. Deliver checkmate!',
        solution: ['b6b8'],
        acceptAnyMate: true,
      },
    ],
  },
  {
    id: 'l1_12_kr_mate',
    level: 1,
    unit: 'Unit 4: First Principles',
    title: 'King + Queen and King + Rook Mates',
    description: 'Your king must help: push the enemy king to the edge, then mate.',
    steps: [
      {
        text: 'A queen or rook alone cannot checkmate a king in the middle of the board. Your own king has to come and help.',
        fen: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1',
      },
      {
        text: 'Drive the enemy king to the edge. When your king faces it with one square in between, a rook check along the edge is mate.',
        fen: '4k3/8/4K3/8/8/8/8/R7 w - - 0 1',
        arrows: [['a1', 'a8', 'rgba(239, 68, 68, 0.9)']],
      },
    ],
    challenges: [
      {
        fen: '4k3/8/4K3/8/8/8/8/R7 w - - 0 1',
        prompt: 'Your king covers d7, e7 and f7. Checkmate with the rook.',
        solution: ['a1a8'],
        acceptAnyMate: true,
      },
      {
        fen: '3k4/8/3K4/8/8/8/8/7Q w - - 0 1',
        prompt: 'King and queen together: deliver checkmate on the edge.',
        solution: ['h1h8'],
        acceptAnyMate: true,
      },
    ],
  },
];
