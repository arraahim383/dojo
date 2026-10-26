// Endgame drills, played against full-strength Stockfish.
// Every position is legal and its goal was verified with Stockfish (depth 28–30) before shipping:
// "win" drills are winning for you with best play, "draw" drills are holdable draws.
// Check any new position with Stockfish before adding it.

export interface DojoDrill {
  id: string;
  title: string;
  category: 'checkmate' | 'pawn' | 'rook' | 'minor' | 'defense';
  fen: string;
  userColor: 'white' | 'black';
  goal: 'win' | 'draw';
  /** win: checkmate (or promote and keep a winning position is not enough) within this many of your moves.
   *  draw: hold the position for this many of your moves (or reach an actual draw). */
  moveLimit: number;
  description: string;
  techniqueTip: string;
}

export const CLASSIC_DRILLS: DojoDrill[] = [
  {
    id: 'kq_mate',
    title: 'King + Queen vs King',
    category: 'checkmate',
    fen: '8/8/8/4k3/8/8/8/4KQ2 w - - 0 1',
    userColor: 'white',
    goal: 'win',
    moveLimit: 15,
    description: 'Box the enemy king in with your queen, walk your king up, and deliver mate on the edge without stalemating.',
    techniqueTip: 'Keep the queen a knight’s jump away from the enemy king to shrink its box. When the king is on the edge, bring your own king next to it, then mate.',
  },
  {
    id: 'kr_mate',
    title: 'King + Rook vs King',
    category: 'checkmate',
    fen: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1',
    userColor: 'white',
    goal: 'win',
    moveLimit: 20,
    description: 'Use the rook to cut off ranks and files while your king takes the opposition, pushing the enemy king to the edge.',
    techniqueTip: 'When the kings face each other with one square between them (opposition), give a rook check along the edge-ward rank.',
  },
  {
    id: 'two_rooks_mate',
    title: 'Two Rooks: Lawnmower Mate',
    category: 'checkmate',
    fen: '8/8/8/4k3/R7/1R6/8/7K w - - 0 1',
    userColor: 'white',
    goal: 'win',
    moveLimit: 10,
    description: 'Roll both rooks up the board rank by rank to push the enemy king to the edge.',
    techniqueTip: 'One rook guards a rank so the king cannot come back; the other rook gives check on the next rank. If the king attacks a rook, move it far away on the same rank.',
  },
  {
    id: 'two_bishops_mate',
    title: 'Two Bishops Checkmate',
    category: 'checkmate',
    fen: '8/8/8/4k3/8/8/8/2B1KB2 w - - 0 1',
    userColor: 'white',
    goal: 'win',
    moveLimit: 20,
    description: 'Side by side, the two bishops make a wall the enemy king cannot cross. Herd it into any corner.',
    techniqueTip: 'Keep the bishops next to each other on neighbouring diagonals, and use your king to take squares away.',
  },
  {
    id: 'bn_mate',
    title: 'Bishop + Knight Checkmate',
    category: 'minor',
    fen: '8/8/8/4k3/8/8/8/1B2K1N1 w - - 0 1',
    userColor: 'white',
    goal: 'win',
    moveLimit: 40,
    description: 'The hardest basic mate. You can only mate in a corner of the same color as your bishop (light squares here: a8 or h1).',
    techniqueTip: 'First drive the king to the edge, then to the light corner. If it runs to a dark corner, use the "W" knight manoeuvre to chase it along the edge.',
  },
  {
    id: 'kp_sixth_rank',
    title: 'King + Pawn: King on the 6th',
    category: 'pawn',
    fen: '4k3/8/4K3/4P3/8/8/8/8 w - - 0 1',
    userColor: 'white',
    goal: 'win',
    moveLimit: 15,
    description: 'With your king on the 6th rank in front of your pawn, the pawn always queens. Show it.',
    techniqueTip: 'Step to the side (Kd6 or Kf6) to take the opposition when needed, then push. Avoid moves that leave Black stalemated.',
  },
  {
    id: 'kp_opposition',
    title: 'King + Pawn: Keep the Opposition',
    category: 'pawn',
    fen: '8/8/8/4k3/8/4K3/4P3/8 b - - 0 1',
    userColor: 'white',
    goal: 'win',
    moveLimit: 20,
    description: 'Black moves first, so you already have the opposition. Keep it, march your king forward, and queen the pawn.',
    techniqueTip: 'Your king leads, the pawn follows. When the black king steps aside, step forward diagonally (outflank) instead of pushing the pawn too early.',
  },
  {
    id: 'square_rule',
    title: 'The Rule of the Square',
    category: 'pawn',
    fen: '8/8/8/6k1/1P6/8/8/7K w - - 0 1',
    userColor: 'white',
    goal: 'win',
    moveLimit: 8,
    description: 'Draw an imaginary square from your pawn to its promotion rank. If the enemy king is outside it, the pawn simply runs.',
    techniqueTip: 'The black king on g5 is outside the square b4–f4–f8–b8. Push the pawn right away and promote.',
  },
  {
    id: 'q_vs_central_pawn',
    title: 'Queen vs Pawn on the 7th (Central)',
    category: 'pawn',
    fen: 'K7/8/8/8/8/8/3kp3/Q7 w - - 0 1',
    userColor: 'white',
    goal: 'win',
    moveLimit: 20,
    description: 'Black’s pawn is one step from queening. Use checks and pins to force the king in front of its own pawn, then bring your king closer.',
    techniqueTip: 'Every time the black king has to block its own pawn (Ke1), you gain a free move for your king. Repeat until your king arrives.',
  },
  {
    id: 'basic_rp_vs_r',
    title: 'Rook + Pawn vs Rook: King Cut Off',
    category: 'rook',
    fen: '6k1/8/3K4/3P4/8/8/r7/5R2 w - - 0 1',
    userColor: 'white',
    goal: 'win',
    moveLimit: 25,
    description: 'Your rook on the f-file keeps the black king away from your pawn. Escort the pawn home.',
    techniqueTip: 'Keep the cut-off. Use your king to hide from rook checks, and if needed build a bridge with your rook (the Lucena idea).',
  },
  {
    id: 'lucena',
    title: 'The Lucena Position (Building the Bridge)',
    category: 'rook',
    fen: '1K1k4/1P1r4/8/8/8/8/8/2R5 w - - 0 1',
    userColor: 'white',
    goal: 'win',
    moveLimit: 15,
    description: 'The most important winning rook endgame. Drive the black king further away, get your king out, and shield it from checks.',
    techniqueTip: 'Check the king away (Rc8+), then step out with your king. When the checks start, block them with your rook on the 4th rank: the "bridge".',
  },
  {
    id: 'philidor',
    title: 'The Philidor Position (Defend)',
    category: 'defense',
    fen: '4k3/7R/r7/3KP3/8/8/8/8 b - - 0 1',
    userColor: 'black',
    goal: 'draw',
    moveLimit: 20,
    description: 'You defend with Black. Keep your rook on the 6th rank so the white king cannot come forward.',
    techniqueTip: 'Wait on the 6th rank. The moment the pawn steps to e6, swing your rook to the far side of the board and check from behind.',
  },
  {
    id: 'vancura',
    title: 'The Vancura Position (Defend)',
    category: 'defense',
    fen: 'R7/6k1/P7/5r2/8/1K6/8/8 b - - 0 1',
    userColor: 'black',
    goal: 'draw',
    moveLimit: 20,
    description: 'You defend with Black against a rook pawn. Attack the pawn from the side so White’s rook stays tied to it.',
    techniqueTip: 'Keep your rook on the f-file/6th rank attacking a6 from the side. If the white king comes close, check it from the side.',
  },
  {
    id: 'q_vs_rook_pawn',
    title: 'Queen vs Rook Pawn on the 7th (Defend)',
    category: 'defense',
    fen: '8/6K1/8/8/3Q4/8/p7/1k6 w - - 0 1',
    userColor: 'black',
    goal: 'draw',
    moveLimit: 20,
    description: 'You defend with Black. White’s king is too far away, and the corner gives you stalemate tricks.',
    techniqueTip: 'When the queen blocks your pawn, step into the corner (Ka1). Taking your king away from the corner is what loses.',
  },
];
