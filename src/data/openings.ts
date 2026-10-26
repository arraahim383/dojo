export interface OpeningLine {
  id: string;
  name: string;
  eco: string;
  side: 'white' | 'black';
  moves: string[]; // SAN moves e.g. ["e4", "e5", "Nf3", "Nc6", "Bc4"]
  ucis: string[]; // UCI moves e.g. ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4"]
  ideas: string;
  category: 'open' | 'semi-open' | 'closed' | 'flank';
}

export const OPENINGS_DATABASE: OpeningLine[] = [
  {
    id: 'italian_game',
    name: 'Italian Game (Giuoco Piano)',
    eco: 'C50',
    side: 'white',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd3', 'd6'],
    ucis: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'c2c3', 'g8f6', 'd2d3', 'd7d6'],
    ideas: 'Harmonious development targeting the weak f7 square, preparing central expansion with c3 and d4.',
    category: 'open',
  },
  {
    id: 'ruy_lopez',
    name: 'Ruy Lopez (Spanish Opening)',
    eco: 'C60',
    side: 'white',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7'],
    ucis: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4', 'g8f6', 'e1g1', 'f8e7'],
    ideas: 'Pressures the defender of the e5 pawn (Nc6) to establish long-term positional control over the center.',
    category: 'open',
  },
  {
    id: 'sicilian_najdorf',
    name: 'Sicilian Defense: Najdorf Variation',
    eco: 'B90',
    side: 'black',
    moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'],
    ucis: ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'a7a6'],
    ideas: 'Aggressive asymmetrical counter-attacking weapon preventing knight/bishop outposts on b5 and preparing queenside play with b5.',
    category: 'semi-open',
  },
  {
    id: 'caro_kann',
    name: 'Caro-Kann Defense',
    eco: 'B12',
    side: 'black',
    moves: ['e4', 'c6', 'd4', 'd5', 'e5', 'Bf5', 'Nf3', 'e6', 'Be2', 'c5'],
    ucis: ['e2e4', 'c7c6', 'd2d4', 'd7d5', 'e4e5', 'c8f5', 'g1f3', 'e7e6', 'f1e2', 'c6c5'],
    ideas: 'Ultra-solid pawn structure enabling the light-squared bishop to develop outside the pawn chain before locking the center with e6.',
    category: 'semi-open',
  },
  {
    id: 'french_defense',
    name: 'French Defense: Winawer',
    eco: 'C15',
    side: 'black',
    moves: ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Bb4', 'e5', 'c5', 'a3', 'Bxc3+'],
    ucis: ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'b1c3', 'f8b4', 'e4e5', 'c7c5', 'a2a3', 'b4c3'],
    ideas: 'Creates an asymmetric pawn chain locked in the center, fighting for the d4 and c3 pawn weaknesses.',
    category: 'semi-open',
  },
  {
    id: 'queens_gambit_declined',
    name: "Queen's Gambit Declined",
    eco: 'D30',
    side: 'white',
    moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'cxd5', 'exd5', 'Bg5', 'c6'],
    ucis: ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6', 'c4d5', 'e6d5', 'c1g5', 'c7c6'],
    ideas: 'Classic positional struggle offering a flank pawn to dismantle Black’s center and control e4.',
    category: 'closed',
  },
  {
    id: 'kings_indian_defense',
    name: "King's Indian Defense",
    eco: 'E60',
    side: 'black',
    moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7', 'e4', 'd6', 'Nf3', 'O-O'],
    ucis: ['d2d4', 'g8f6', 'c2c4', 'g7g6', 'b1c3', 'f8g7', 'e2e4', 'd7d6', 'g1f3', 'e8g8'],
    ideas: 'Allows White to claim the center with pawns, then launches a ferocious kingside pawn storm with f7-f5.',
    category: 'closed',
  },
  {
    id: 'london_system',
    name: 'London System',
    eco: 'D02',
    side: 'white',
    moves: ['d4', 'd5', 'Bf4', 'Nf6', 'e3', 'c5', 'c3', 'Nc6', 'Nd2', 'e6'],
    ucis: ['d2d4', 'd7d5', 'c1f4', 'g8f6', 'e2e3', 'c7c5', 'c2c3', 'b8c6', 'b1d2', 'e7e6'],
    ideas: 'Rock-solid pyramid pawn structure with an active bishop outside the chain, hard to dismantle for Black.',
    category: 'closed',
  },
  {
    id: 'scotch_game',
    name: 'Scotch Game',
    eco: 'C45',
    side: 'white',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4', 'Bc5', 'Be3', 'Qf6'],
    ucis: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'd2d4', 'e5d4', 'f3d4', 'f8c5', 'c1e3', 'd8f6'],
    ideas: 'Immediately breaks open the center on move 3, leading to dynamic tactical encounters.',
    category: 'open',
  },
  {
    id: 'english_opening',
    name: 'English Opening',
    eco: 'A20',
    side: 'white',
    moves: ['c4', 'e5', 'Nc3', 'Nf6', 'g3', 'd5', 'cxd5', 'Nxd5', 'Bg2', 'Nb6'],
    ucis: ['c2c4', 'e7e5', 'b1c3', 'g8f6', 'g2g3', 'd7d5', 'c4d5', 'f6d5', 'f1g2', 'd5b6'],
    ideas: 'Hypermodern opening controlling d5 from the flank with a fianchettoed bishop on g2.',
    category: 'flank',
  },
];
