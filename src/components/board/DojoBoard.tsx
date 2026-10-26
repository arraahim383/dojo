import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Chess, type Square } from 'chess.js';
import { Chessboard, type Arrow } from 'react-chessboard';
import { sound } from '../../services/sound';

export type DojoBoardArrow =
  | [Square, Square, string?]
  | { startSquare: Square | string; endSquare: Square | string; color?: string }
  | { from: Square | string; to: Square | string; color?: string };

export interface DojoBoardProps {
  fen: string;
  orientation?: 'white' | 'black';
  interactive?: boolean;
  onMove?: (uci: string, san: string) => boolean | Promise<boolean>;
  arrows?: DojoBoardArrow[];
  customHighlights?: Record<string, React.CSSProperties>;
  lastMove?: { from: Square; to: Square } | null;
  boardTheme?: 'dojo' | 'classic' | 'slate' | 'emerald';
  allowPreMove?: boolean;
  autoQueen?: boolean;
  coachWarningSquare?: Square | null;
}

export const DojoBoard: React.FC<DojoBoardProps> = ({
  fen,
  orientation = 'white',
  interactive = true,
  onMove,
  arrows = [],
  customHighlights = {},
  lastMove = null,
  boardTheme = 'dojo',
  autoQueen = true,
  coachWarningSquare = null,
}) => {
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<Square[]>([]);
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: Square;
    to: Square;
  } | null>(null);

  // Chess instance for move validation. Display-only boards (e.g. a lone rook in a lesson)
  // may not be legal positions; those boards are simply not interactive.
  const chessOrNull = useMemo(() => {
    try {
      return new Chess(fen);
    } catch {
      return null;
    }
  }, [fen]);
  const chess = chessOrNull ?? new Chess();
  interactive = interactive && !!chessOrNull;

  // Reset selected square if FEN changes
  useEffect(() => {
    setSelectedSquare(null);
    setPossibleMoves([]);
    setPendingPromotion(null);
  }, [fen]);

  // Color schemes for board squares
  const themeColors = useMemo(() => {
    switch (boardTheme) {
      case 'dojo':
        // Warm Japanese Tatami / Cedar Wood aesthetic
        return {
          dark: '#7A5C43',
          light: '#D9C4A9',
        };
      case 'emerald':
        return {
          dark: '#3B6E52',
          light: '#E2E8D8',
        };
      case 'slate':
        return {
          dark: '#475569',
          light: '#CBD5E1',
        };
      case 'classic':
      default:
        return {
          dark: '#58738D',
          light: '#EAEFF3',
        };
    }
  }, [boardTheme]);

  // Helper to test if move is a pawn promotion
  const isPromotionMove = (from: Square, to: Square): boolean => {
    const piece = chess.get(from);
    if (!piece || piece.type !== 'p') return false;
    const toRank = to[1];
    return (piece.color === 'w' && toRank === '8') || (piece.color === 'b' && toRank === '1');
  };

  // Sound triggering helper
  const playMoveSound = (from: Square, to: Square, isCastle = false) => {
    const destPiece = chess.get(to);
    const movingPiece = chess.get(from);
    const isCapture = !!destPiece || (movingPiece?.type === 'p' && from[0] !== to[0]);

    if (isCastle) {
      sound.playCastle();
    } else if (isCapture) {
      sound.playCapture();
    } else {
      sound.playMove();
    }

    // Check if move gives check
    setTimeout(() => {
      try {
        const testChess = new Chess(chess.fen());
        testChess.move({ from, to, promotion: 'q' });
        if (testChess.inCheck()) {
          sound.playCheck();
        }
      } catch {
        // ignore
      }
    }, 10);
  };

  // Attempt move
  const attemptMove = useCallback(
    async (from: Square, to: Square, promotionPiece: string = 'q'): Promise<boolean> => {
      if (!interactive || !onMove) return false;

      try {
        // Check legality on cloned chess instance
        const testChess = new Chess(chess.fen());
        const moveObj = testChess.move({
          from,
          to,
          promotion: promotionPiece,
        });

        if (!moveObj) return false;

        const uci = `${from}${to}${isPromotionMove(from, to) ? promotionPiece : ''}`;
        const accepted = await onMove(uci, moveObj.san);
        if (accepted) {
          try {
            chess.move({ from, to, promotion: promotionPiece });
          } catch {
            // ignore
          }
          const isCastling = moveObj.san.startsWith('O-O');
          playMoveSound(from, to, isCastling);
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [chess, interactive, onMove]
  );

  // Drag & drop handler
  const onPieceDrop = (sourceSquare: Square, targetSquare: Square): boolean => {
    if (!interactive) return false;

    // Check if promotion
    if (isPromotionMove(sourceSquare, targetSquare)) {
      if (autoQueen) {
        attemptMove(sourceSquare, targetSquare, 'q');
        return true;
      } else {
        setPendingPromotion({ from: sourceSquare, to: targetSquare });
        return true;
      }
    }

    attemptMove(sourceSquare, targetSquare);
    return true;
  };

  // Click-to-move handler
  const onSquareClick = (square: Square) => {
    if (!interactive) return;

    // If a square is already selected
    if (selectedSquare) {
      // If clicking same square, deselect
      if (selectedSquare === square) {
        setSelectedSquare(null);
        setPossibleMoves([]);
        return;
      }

      // If clicking one of the possible destination squares, execute move
      if (possibleMoves.includes(square)) {
        if (isPromotionMove(selectedSquare, square)) {
          if (autoQueen) {
            attemptMove(selectedSquare, square, 'q');
          } else {
            setPendingPromotion({ from: selectedSquare, to: square });
          }
        } else {
          attemptMove(selectedSquare, square);
        }
        setSelectedSquare(null);
        setPossibleMoves([]);
        return;
      }
    }

    // Select piece if it belongs to active turn
    const piece = chess.get(square);
    const activeColor = chess.turn();
    if (piece && piece.color === activeColor) {
      setSelectedSquare(square);
      const moves = chess.moves({ square, verbose: true });
      setPossibleMoves(moves.map((m) => m.to as Square));
    } else {
      setSelectedSquare(null);
      setPossibleMoves([]);
    }
  };

  // Square styles & highlights
  const customSquareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = { ...customHighlights };

    // Highlight last move squares
    if (lastMove) {
      styles[lastMove.from] = {
        backgroundColor: 'rgba(234, 179, 8, 0.35)',
        ...styles[lastMove.from],
      };
      styles[lastMove.to] = {
        backgroundColor: 'rgba(234, 179, 8, 0.45)',
        ...styles[lastMove.to],
      };
    }

    // Selected square
    if (selectedSquare) {
      styles[selectedSquare] = {
        backgroundColor: 'rgba(245, 158, 11, 0.5)',
        boxShadow: 'inset 0 0 0 3px #F59E0B',
      };
    }

    // Possible target moves (subtle indicator dot)
    possibleMoves.forEach((sq) => {
      const isTargetOccupied = !!chess.get(sq);
      styles[sq] = {
        background: isTargetOccupied
          ? 'radial-gradient(circle, rgba(239, 68, 68, 0.4) 80%, transparent 80%)'
          : 'radial-gradient(circle, rgba(16, 185, 129, 0.4) 28%, transparent 30%)',
        cursor: 'pointer',
      };
    });

    // In check indicator
    if (chessOrNull && chess.inCheck()) {
      // find king square
      const turn = chess.turn();
      for (const row of chess.board()) {
        for (const p of row) {
          if (p && p.type === 'k' && p.color === turn) {
            styles[p.square] = {
              background: 'radial-gradient(circle, rgba(239, 68, 68, 0.8) 0%, rgba(220, 38, 38, 0.2) 70%, transparent 100%)',
            };
          }
        }
      }
    }

    // Coach warning square (e.g. threatened square)
    if (coachWarningSquare) {
      styles[coachWarningSquare] = {
        boxShadow: 'inset 0 0 10px 4px rgba(239, 68, 68, 0.8)',
        animation: 'pulse 1.5s infinite',
      };
    }

    return styles;
  }, [customHighlights, lastMove, selectedSquare, possibleMoves, chess, coachWarningSquare]);

  // Formatted arrows for react-chessboard v5
  // react-chessboard expects: { startSquare: string, endSquare: string, color: string }
  const formattedArrows: Arrow[] = useMemo(() => {
    if (!arrows || !Array.isArray(arrows)) return [];
    return arrows
      .map((arr): Arrow | null => {
        if (!arr) return null;
        let start: string | undefined;
        let end: string | undefined;
        let col: string | undefined;

        if (Array.isArray(arr)) {
          start = arr[0];
          end = arr[1];
          col = arr[2];
        } else if (typeof arr === 'object') {
          start = (arr as any).startSquare || (arr as any).from;
          end = (arr as any).endSquare || (arr as any).to;
          col = (arr as any).color;
        }

        // Must be a valid 2-char algebraic square (e.g. 'e2', 'e4')
        if (
          typeof start === 'string' &&
          /^[a-h][1-8]$/.test(start) &&
          typeof end === 'string' &&
          /^[a-h][1-8]$/.test(end)
        ) {
          return {
            startSquare: start,
            endSquare: end,
            color: col || 'rgb(245, 158, 11)',
          };
        }
        return null;
      })
      .filter((a): a is Arrow => a !== null);
  }, [arrows]);

  return (
    <div className="relative w-full aspect-square max-w-[min(88vw,560px)] mx-auto select-none rounded-xl overflow-hidden shadow-2xl border-4 border-amber-950/40 bg-stone-900">
      <Chessboard
        options={{
          position: fen,
          boardOrientation: orientation,
          onPieceDrop: ({ sourceSquare, targetSquare }) => onPieceDrop(sourceSquare as Square, targetSquare as Square),
          onSquareClick: ({ square }) => onSquareClick(square as Square),
          squareStyles: customSquareStyles,
          arrows: formattedArrows as any,
          darkSquareStyle: { backgroundColor: themeColors.dark },
          lightSquareStyle: { backgroundColor: themeColors.light },
          allowDragging: interactive,
          animationDurationInMs: 220,
        }}
      />

      {/* Promotion Choice Dialog */}
      {pendingPromotion && (
        <div className="absolute inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-stone-900 border border-amber-500/30 rounded-2xl p-5 shadow-2xl text-center max-w-xs mx-4">
            <h3 className="text-amber-400 font-bold text-lg mb-1 tracking-wide font-serif">Pawn Promotion</h3>
            <p className="text-stone-400 text-xs mb-4">Choose your exalted rank</p>
            <div className="grid grid-cols-4 gap-2">
              {[
                { piece: 'q', label: 'Queen', icon: '♛' },
                { piece: 'r', label: 'Rook', icon: '♜' },
                { piece: 'b', label: 'Bishop', icon: '♝' },
                { piece: 'n', label: 'Knight', icon: '♞' },
              ].map(({ piece, label, icon }) => (
                <button
                  key={piece}
                  onClick={() => {
                    const { from, to } = pendingPromotion;
                    setPendingPromotion(null);
                    attemptMove(from, to, piece);
                  }}
                  className="flex flex-col items-center justify-center p-3 rounded-xl bg-stone-800 hover:bg-amber-600/20 border border-stone-700 hover:border-amber-500 text-amber-200 transition-all hover:scale-105 active:scale-95"
                >
                  <span className="text-3xl mb-1">{icon}</span>
                  <span className="text-[10px] font-medium tracking-tight text-stone-300">{label}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setPendingPromotion(null)}
              className="mt-4 text-xs text-stone-400 hover:text-stone-200 transition-colors"
            >
              Cancel Move
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
