import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Chess, type Square } from 'chess.js';
import { DojoBoard } from '../board/DojoBoard';
import { CHESS_BOTS, type ChessBot } from '../../data/bots';
import { engine } from '../../services/engine';
import { db, getUserProfile, updateUserProfile, bumpDailyActivity, type UserProfile } from '../../db';
import { sound } from '../../services/sound';
import { GeminiCoachModal } from '../common/GeminiCoachModal';
import {
  Swords,
  Shield,
  Lightbulb,
  RotateCcw,
  Flag,
  Sparkles,
  Trophy,
  AlertTriangle,
  Play,
  Clock,
  Settings2,
  ChevronRight,
  Eye,
  CheckCircle2
} from 'lucide-react';

interface PlayViewProps {
  userProfile: UserProfile;
  onRefreshProfile: () => void;
  onNavigateToReview?: (pgn: string, userColor: 'white' | 'black') => void;
}

type TimeControl = 'none' | '10+0' | '15+10' | '30+0';
const TC_SETTINGS: Record<TimeControl, { base: number; inc: number }> = {
  none: { base: 0, inc: 0 },
  '10+0': { base: 600, inc: 0 },
  '15+10': { base: 900, inc: 10 },
  '30+0': { base: 1800, inc: 0 },
};

export const PlayView: React.FC<PlayViewProps> = ({
  userProfile,
  onRefreshProfile,
  onNavigateToReview,
}) => {
  const [selectedBot, setSelectedBot] = useState<ChessBot>(CHESS_BOTS[1]); // Tetsuo (400)
  const [playerColor, setPlayerColor] = useState<'white' | 'black'>('white');
  const [timeControl, setTimeControl] = useState<TimeControl>('none');
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [isBotThinking, setIsBotThinking] = useState<boolean>(false);

  // Game state
  const [game, setGame] = useState<Chess>(new Chess());
  const [fen, setFen] = useState<string>(new Chess().fen());
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [gameResult, setGameResult] = useState<string | null>(null);
  const [resultQuote, setResultQuote] = useState<string>('');
  const [usedTakeback, setUsedTakeback] = useState<boolean>(false);
  const [assistedWin, setAssistedWin] = useState<boolean>(false);

  // Each game gets an id; async bot replies from an old game are ignored.
  const gameIdRef = useRef<number>(0);
  const savedGameIdRef = useRef<number | null>(null);
  const mountedRef = useRef<boolean>(true);

  // Clocks in seconds
  const [whiteTime, setWhiteTime] = useState<number>(600);
  const [blackTime, setBlackTime] = useState<number>(600);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const botMoveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Undo notification toast
  const [undoToast, setUndoToast] = useState<string | null>(null);
  const undoToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showUndoToast = (msg: string) => {
    if (undoToastTimeoutRef.current) clearTimeout(undoToastTimeoutRef.current);
    setUndoToast(msg);
    undoToastTimeoutRef.current = setTimeout(() => {
      setUndoToast(null);
    }, 2400);
  };

  // Coach Mode
  const [coachMode, setCoachMode] = useState<boolean>(true);
  const [checkingMove, setCheckingMove] = useState<boolean>(false);
  const [hintArrow, setHintArrow] = useState<Array<[Square, Square, string?]>>([]);
  const [threatArrow, setThreatArrow] = useState<Array<[Square, Square, string?]>>([]);
  const [warningModal, setWarningModal] = useState<{
    show: boolean;
    reason: string;
    from: Square;
    to: Square;
    promotion?: string;
  } | null>(null);

  // Gemini Sensei explanation modal
  const [explainModal, setExplainModal] = useState<{
    open: boolean;
    fen: string;
    move: string;
  }>({ open: false, fen: '', move: '' });

  // Evaluation (always from White's point of view)
  const [currentEval, setCurrentEval] = useState<string>('0.0');

  const userColorCode = playerColor === 'white' ? 'w' : 'b';
  const botBook = selectedBot.book ? (playerColor === 'white' ? selectedBot.book.black : selectedBot.book.white) : undefined;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (botMoveTimeoutRef.current) clearTimeout(botMoveTimeoutRef.current);
      if (undoToastTimeoutRef.current) clearTimeout(undoToastTimeoutRef.current);
    };
  }, []);

  // Build a PGN with proper headers (Review uses them to know which side you played)
  const buildPgn = (c: Chess, resultTag: string): string => {
    const copy = new Chess();
    for (const m of c.history()) copy.move(m);
    const youName = 'Disciple (You)';
    const botName = `${selectedBot.name} (${selectedBot.elo})`;
    copy.setHeader('Event', 'Daba Dojo sparring');
    copy.setHeader('Date', new Date().toISOString().slice(0, 10).replace(/-/g, '.'));
    copy.setHeader('White', playerColor === 'white' ? youName : botName);
    copy.setHeader('Black', playerColor === 'black' ? youName : botName);
    copy.setHeader('Result', resultTag);
    return copy.pgn();
  };

  // Save (or update) the current game in IndexedDB
  const saveGame = async (c: Chess, resultText: string, resultTag: string) => {
    if (c.history().length === 0) return;
    const record = {
      pgn: buildPgn(c, resultTag),
      white: playerColor === 'white' ? 'Disciple (You)' : `${selectedBot.name} (${selectedBot.elo})`,
      black: playerColor === 'black' ? 'Disciple (You)' : `${selectedBot.name} (${selectedBot.elo})`,
      date: new Date().toLocaleDateString(),
      result: resultText,
      userColor: playerColor,
      botId: selectedBot.id,
      timeControl,
      movesCount: Math.ceil(c.history().length / 2),
      reviewed: false,
      createdAt: Date.now(),
    };
    try {
      if (savedGameIdRef.current !== null) {
        await db.savedGames.update(savedGameIdRef.current, record);
      } else {
        savedGameIdRef.current = (await db.savedGames.add(record)) as number;
        await bumpDailyActivity('botGames');
      }
    } catch (err) {
      console.error('Error saving game:', err);
    }
  };

  const finishGame = async (c: Chess, resultText: string, quote: string, userWon: boolean | null, resultTag: string) => {
    setGameResult(resultText);
    setResultQuote(quote);
    if (userWon === true) {
      sound.playSuccess();
      const profile = await getUserProfile();
      if (!usedTakeback) {
        if (!profile.botsBeaten.includes(selectedBot.id)) {
          await updateUserProfile({ botsBeaten: [...profile.botsBeaten, selectedBot.id] });
        }
        setAssistedWin(false);
      } else {
        if (!profile.botsBeatenAssisted.includes(selectedBot.id)) {
          await updateUserProfile({ botsBeatenAssisted: [...profile.botsBeatenAssisted, selectedBot.id] });
        }
        setAssistedWin(true);
      }
      onRefreshProfile();
    } else if (userWon === false) {
      sound.playError();
    }
    await saveGame(c, resultText, resultTag);
  };

  // Start new game
  const handleStartGame = () => {
    if (botMoveTimeoutRef.current) {
      clearTimeout(botMoveTimeoutRef.current);
      botMoveTimeoutRef.current = null;
    }
    gameIdRef.current += 1;
    savedGameIdRef.current = null;
    const newChess = new Chess();
    setGame(newChess);
    setFen(newChess.fen());
    setMoveHistory([]);
    setLastMove(null);
    setGameResult(null);
    setResultQuote(selectedBot.quoteOnStart);
    setHintArrow([]);
    setUsedTakeback(false);
    setAssistedWin(false);
    setCurrentEval('0.0');
    setIsBotThinking(false);
    setGameStarted(true);

    const tc = TC_SETTINGS[timeControl];
    setWhiteTime(tc.base);
    setBlackTime(tc.base);

    // If player is black, trigger bot's opening move
    if (playerColor === 'black') {
      const id = gameIdRef.current;
      botMoveTimeoutRef.current = setTimeout(() => {
        triggerBotMove(newChess, id);
      }, 500);
    }
  };

  // Clock countdown timer effect
  useEffect(() => {
    if (!gameStarted || !!gameResult || timeControl === 'none') {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      const activeTurn = game.turn();
      if (activeTurn === 'w') {
        setWhiteTime((prev) => {
          if (prev <= 1) {
            handleTimeOut('w');
            return 0;
          }
          return prev - 1;
        });
      } else {
        setBlackTime((prev) => {
          if (prev <= 1) {
            handleTimeOut('b');
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [gameStarted, gameResult, timeControl, game]);

  const addIncrement = (color: 'w' | 'b') => {
    const inc = TC_SETTINGS[timeControl].inc;
    if (!inc) return;
    if (color === 'w') setWhiteTime((t) => t + inc);
    else setBlackTime((t) => t + inc);
  };

  const handleTimeOut = (loserColor: 'w' | 'b') => {
    const userLost = loserColor === userColorCode;
    gameIdRef.current += 1; // cancel any pending bot reply
    setIsBotThinking(false);
    finishGame(
      game,
      userLost ? 'Defeat on Time' : 'Victory on Time!',
      userLost ? selectedBot.quoteOnWin : selectedBot.quoteOnLoss,
      !userLost,
      loserColor === 'w' ? '0-1' : '1-0'
    );
  };

  const handleResign = () => {
    if (gameResult) return;
    gameIdRef.current += 1;
    if (botMoveTimeoutRef.current) clearTimeout(botMoveTimeoutRef.current);
    setIsBotThinking(false);
    finishGame(game, 'Resigned', selectedBot.quoteOnWin, false, playerColor === 'white' ? '0-1' : '1-0');
  };

  // Bot move
  const triggerBotMove = async (currentChess: Chess, id: number) => {
    if (currentChess.isGameOver()) {
      checkGameOver(currentChess);
      return;
    }
    setIsBotThinking(true);
    try {
      const res = await engine.getBotMove(currentChess.fen(), selectedBot.elo, botBook);
      if (!mountedRef.current || id !== gameIdRef.current) return; // game was reset / left
      if (!res.move) {
        checkGameOver(currentChess);
        return;
      }
      const moveObj = currentChess.move({ from: res.move.slice(0, 2), to: res.move.slice(2, 4), promotion: res.move[4] || 'q' });
      addIncrement(currentChess.turn() === 'w' ? 'b' : 'w');
      const newFen = currentChess.fen();
      const copy = new Chess();
      for (const m of currentChess.history()) copy.move(m);
      setGame(copy);
      setMoveHistory((prev) => [...prev, moveObj.san]);
      setFen(newFen);
      setLastMove({ from: moveObj.from as Square, to: moveObj.to as Square });
      setHintArrow([]);

      if (moveObj.san.startsWith('O-O')) sound.playCastle();
      else if (moveObj.captured) sound.playCapture();
      else sound.playMove();
      if (currentChess.inCheck()) sound.playCheck();

      if (!checkGameOver(currentChess) && coachMode) {
        updateCoachEvaluation(newFen);
      }
    } catch (e) {
      console.error('Error applying bot move:', e);
    } finally {
      if (mountedRef.current && id === gameIdRef.current) setIsBotThinking(false);
    }
  };

  // Eval shown in the sidebar (White's point of view), plus the optional threat arrow
  const updateCoachEvaluation = async (currentFen: string) => {
    setThreatArrow([]);
    const analysis = await engine.evaluatePosition(currentFen, { depth: 10 });
    if (mountedRef.current && analysis.lines[0]?.evalFormatted) {
      setCurrentEval(analysis.lines[0].evalFormatted);
    }
    if (userProfile.settings.coachThreatArrows) {
      // What would the bot play if it could move again? (skip when you are in check)
      const parts = currentFen.split(' ');
      parts[1] = parts[1] === 'w' ? 'b' : 'w';
      parts[3] = '-';
      try {
        const flipped = new Chess(parts.join(' '));
        if (!new Chess(currentFen).inCheck() && !flipped.isGameOver()) {
          const t = await engine.evaluatePosition(flipped.fen(), { depth: 10 });
          const mv = t.lines[0]?.bestMove;
          if (mv && mountedRef.current) setThreatArrow([[mv.slice(0, 2) as Square, mv.slice(2, 4) as Square, 'rgba(239, 68, 68, 0.75)']]);
        }
      } catch {
        // flipped position not legal (e.g. opponent's king would be in check): no threat to show
      }
    }
  };

  // Check Game Over & save. Returns true if the game ended.
  const checkGameOver = (currentChess: Chess): boolean => {
    if (!currentChess.isGameOver()) return false;
    if (currentChess.isCheckmate()) {
      const winner = currentChess.turn() === 'w' ? 'b' : 'w';
      const userWon = winner === userColorCode;
      finishGame(
        currentChess,
        userWon ? 'Victory by Checkmate!' : 'Defeat by Checkmate',
        userWon ? selectedBot.quoteOnLoss : selectedBot.quoteOnWin,
        userWon,
        winner === 'w' ? '1-0' : '0-1'
      );
    } else {
      const why = currentChess.isStalemate()
        ? 'Stalemate'
        : currentChess.isThreefoldRepetition()
          ? 'Threefold Repetition'
          : currentChess.isInsufficientMaterial()
            ? 'Insufficient Material'
            : '50-Move Rule';
      finishGame(currentChess, `Draw by ${why}`, 'A balanced struggle. The harmony holds.', null, '1/2-1/2');
    }
    return true;
  };

  // Handle User Move Attempt
  const handleUserMove = async (uci: string, san: string): Promise<boolean> => {
    if (isBotThinking || gameResult || checkingMove) return false;
    if (game.turn() !== userColorCode) return false;

    const from = uci.slice(0, 2) as Square;
    const to = uci.slice(2, 4) as Square;
    const promotion = uci.length > 4 ? uci.slice(4, 5) : 'q';

    // Coach Mode: ask Stockfish whether this move throws away 2+ pawns or allows mate
    if (coachMode && userProfile.settings.coachWarnings) {
      setCheckingMove(true);
      try {
        const quality = await engine.checkMoveQuality(game.fen(), uci);
        if (quality.isBlunder && !warningModal) {
          sound.playWarning();
          setWarningModal({
            show: true,
            reason: quality.reason || 'This move loses significant material.',
            from,
            to,
            promotion,
          });
          return false; // wait for the user's choice in the modal
        }
      } finally {
        setCheckingMove(false);
      }
    }

    return executeConfirmedMove(from, to, promotion);
  };

  const executeConfirmedMove = (from: Square, to: Square, promotion = 'q'): boolean => {
    const newChess = new Chess();
    for (const m of moveHistory) newChess.move(m);
    let moveObj;
    try {
      moveObj = newChess.move({ from, to, promotion });
    } catch {
      return false;
    }
    addIncrement(userColorCode);

    const newFen = newChess.fen();
    setGame(newChess);
    setFen(newFen);
    setLastMove({ from, to });
    setMoveHistory((prev) => [...prev, moveObj.san]);
    setHintArrow([]);
    setThreatArrow([]);

    if (!checkGameOver(newChess)) {
      const id = gameIdRef.current;
      botMoveTimeoutRef.current = setTimeout(() => {
        triggerBotMove(newChess, id);
      }, 350);
    }

    return true;
  };

  // Undo viability: undo needs at least one of your own moves on the board
  const canUndo = playerColor === 'white'
    ? moveHistory.length >= 1 && !isBotThinking
    : moveHistory.length >= 2 && !isBotThinking;

  // Takeback (undo your move and the bot's reply). Using it makes a win "assisted".
  const handleTakeback = useCallback(() => {
    if (botMoveTimeoutRef.current) {
      clearTimeout(botMoveTimeoutRef.current);
      botMoveTimeoutRef.current = null;
    }
    gameIdRef.current += 1; // ignore any bot reply still being calculated
    setIsBotThinking(false);

    if (moveHistory.length < 1) return;
    if (playerColor === 'black' && moveHistory.length < 2) return;

    // Remove plies until it is your turn again with one of your moves taken back
    const userParity = playerColor === 'white' ? 0 : 1; // your moves sit at even (white) / odd (black) indexes
    let keep = moveHistory.length - 1;
    while (keep >= 0 && keep % 2 !== userParity) keep--;
    const movesToReplay = moveHistory.slice(0, Math.max(0, keep));

    const newChess = new Chess();
    let lastM: { from: Square; to: Square } | null = null;
    for (const m of movesToReplay) {
      const res = newChess.move(m);
      lastM = { from: res.from as Square, to: res.to as Square };
    }

    setGame(newChess);
    setFen(newChess.fen());
    setMoveHistory(movesToReplay);
    setLastMove(lastM);
    setGameResult(null);
    setResultQuote('');
    setHintArrow([]);
    setUsedTakeback(true);
    sound.playMove();

    if (playerColor === 'white' && whiteTime <= 0) setWhiteTime(120);
    else if (playerColor === 'black' && blackTime <= 0) setBlackTime(120);

    showUndoToast('Move undone. This game now counts as an assisted win.');

    if (coachMode) updateCoachEvaluation(newChess.fen());
  }, [playerColor, moveHistory, coachMode, whiteTime, blackTime]);

  // Keyboard shortcut for Undo (Z or U)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (((e.key === 'z' || e.key === 'Z') && !e.altKey) || ((e.key === 'u' || e.key === 'U') && !e.ctrlKey && !e.metaKey && !e.altKey)) {
        if (gameStarted && canUndo) {
          e.preventDefault();
          handleTakeback();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameStarted, canUndo, handleTakeback]);

  // Coach Hint (arrow only when you ask). Always full-strength analysis.
  const handleRequestHint = async () => {
    if (hintArrow.length > 0) {
      setHintArrow([]);
      return;
    }
    const analysis = await engine.evaluatePosition(fen, { depth: 14 });
    const best = analysis.lines[0]?.bestMove;
    if (best && best.length >= 4 && mountedRef.current) {
      setHintArrow([[best.slice(0, 2) as Square, best.slice(2, 4) as Square, 'rgb(34, 197, 94)']]);
      sound.playWarning();
    }
  };

  // Arrows are strictly visible ONLY when seeking help (e.g. clicking Sensei Hint)
  const activeArrows = hintArrow.length ? hintArrow : threatArrow;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6">
      {!gameStarted ? (
        /* Bot Selection & Match Setup Screen */
        <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold tracking-widest uppercase">
              <Swords className="w-3.5 h-3.5" />
              Tatami Sparring Arena
            </div>
            <h1 className="text-3xl sm:text-4xl font-serif font-black text-stone-100 tracking-tight">
              Play Against Dojo Opponents
            </h1>
            <p className="text-stone-400 text-sm max-w-lg mx-auto">
              From white-belt novices to the grand patriarch, test your training against distinct personalities and styles.
            </p>
          </div>

          {/* Bot Roster Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CHESS_BOTS.map((bot) => {
              const isSelected = selectedBot.id === bot.id;
              const isBeaten = userProfile.botsBeaten.includes(bot.id);

              return (
                <div
                  key={bot.id}
                  onClick={() => setSelectedBot(bot)}
                  className={`cursor-pointer rounded-2xl p-4 transition-all border relative flex flex-col justify-between ${
                    isSelected
                      ? 'bg-amber-950/40 border-amber-500 ring-2 ring-amber-500/40 shadow-xl'
                      : 'bg-stone-900/80 border-stone-800 hover:border-amber-700/50 hover:bg-stone-800/60'
                  }`}
                >
                  {isBeaten && (
                    <div className="absolute top-3 right-3 flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/30">
                      <CheckCircle2 className="w-3 h-3" />
                      Defeated
                    </div>
                  )}

                  <div>
                    <div className="flex items-center gap-3 mb-2.5">
                      <div className="w-12 h-12 rounded-xl bg-stone-800 border border-amber-500/30 flex items-center justify-center text-2xl shadow-inner">
                        {bot.avatarIcon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-serif font-bold text-base text-stone-100">{bot.name}</h3>
                          <span className="text-xs font-mono font-bold text-amber-400">
                            {bot.elo}
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                          {bot.title}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-stone-300 leading-relaxed mb-3">
                      {bot.personality}
                    </p>
                  </div>

                  <div className="pt-2.5 border-t border-stone-800/80 flex items-center justify-between text-[11px] text-stone-400">
                    <span className="italic truncate pr-2">"{bot.quoteOnStart}"</span>
                    <span className="font-semibold text-amber-500 shrink-0">{bot.openingPreference}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sparring Options */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 shadow-xl space-y-6">
            <h3 className="font-serif font-bold text-stone-200 text-lg flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-amber-500" />
              Sparring Settings
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Play As */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-400 mb-2">
                  Your Tatami Side
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPlayerColor('white')}
                    className={`py-2.5 px-4 rounded-xl text-xs font-bold border transition-all ${
                      playerColor === 'white'
                        ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-md'
                        : 'bg-stone-800 text-stone-300 border-stone-700 hover:bg-stone-700'
                    }`}
                  >
                    White (Move First)
                  </button>
                  <button
                    onClick={() => setPlayerColor('black')}
                    className={`py-2.5 px-4 rounded-xl text-xs font-bold border transition-all ${
                      playerColor === 'black'
                        ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-md'
                        : 'bg-stone-800 text-stone-300 border-stone-700 hover:bg-stone-700'
                    }`}
                  >
                    Black (Counter)
                  </button>
                </div>
              </div>

              {/* Time Control */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-400 mb-2">
                  Clock Regulation
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'none', label: 'Untimed' },
                    { id: '10+0', label: '10 min Rapid' },
                    { id: '15+10', label: '15 | 10 Rapid' },
                    { id: '30+0', label: '30 min Classical' },
                  ].map((tc) => (
                    <button
                      key={tc.id}
                      onClick={() => setTimeControl(tc.id as any)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                        timeControl === tc.id
                          ? 'bg-amber-500 text-stone-950 border-amber-400'
                          : 'bg-stone-800 text-stone-300 border-stone-700 hover:bg-stone-700'
                      }`}
                    >
                      {tc.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Coach Mode Active */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-400 mb-2">
                  Sensei Mentorship
                </label>
                <div
                  onClick={() => setCoachMode(!coachMode)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                    coachMode
                      ? 'bg-amber-950/40 border-amber-500/60'
                      : 'bg-stone-800 border-stone-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Shield className={`w-5 h-5 ${coachMode ? 'text-amber-400' : 'text-stone-500'}`} />
                    <div>
                      <div className="text-xs font-bold text-stone-200">Coach Mode Enabled</div>
                      <div className="text-[10px] text-stone-400">Blunder warnings & hints</div>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                    coachMode ? 'bg-amber-500 border-amber-400 text-stone-950 font-bold' : 'border-stone-600'
                  }`}>
                    {coachMode ? '✓' : ''}
                  </div>
                </div>
              </div>
            </div>

            {/* Launch Game Button */}
            <div className="pt-4 flex justify-center">
              <button
                onClick={handleStartGame}
                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-serif font-black text-base uppercase tracking-wider shadow-xl hover:shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-3 cursor-pointer"
              >
                <Play className="w-5 h-5 fill-current" />
                Spar with {selectedBot.name} ({selectedBot.elo})
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* In-Game Active Sparring Board & Panel */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fadeIn">
          {/* Left Column: Chess Board & Eval indicator */}
          <div className="lg:col-span-7 flex flex-col items-center">
            {/* Opponent Bot Card Header */}
            <div className="w-full max-w-[560px] flex items-center justify-between bg-stone-900 border border-stone-800 rounded-t-xl px-4 py-2.5 mb-2 shadow-md">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{selectedBot.avatarIcon}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-serif font-bold text-stone-100 text-sm">{selectedBot.name}</span>
                    <span className="text-[11px] font-mono text-amber-400 font-bold">({selectedBot.elo})</span>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-stone-400">{selectedBot.title}</span>
                </div>
              </div>

              {isBotThinking ? (
                <div className="flex items-center gap-2 text-xs text-amber-400 font-serif italic animate-pulse">
                  <Sparkles className="w-3.5 h-3.5" />
                  Calculating...
                </div>
              ) : (
                <div className="text-xs text-stone-400 font-mono">
                  {timeControl !== 'none' && (playerColor === 'white' ? formatTime(blackTime) : formatTime(whiteTime))}
                </div>
              )}
            </div>

            {/* The Dojo Chess Board */}
            <DojoBoard
              fen={fen}
              orientation={playerColor}
              interactive={!isBotThinking && !gameResult && !checkingMove}
              onMove={handleUserMove}
              arrows={activeArrows}
              lastMove={lastMove}
              boardTheme={userProfile.settings.boardTheme}
              autoQueen={userProfile.settings.autoQueen}
            />

            {/* Player Card Footer */}
            <div className="w-full max-w-[560px] flex items-center justify-between bg-stone-900 border border-stone-800 rounded-b-xl px-4 py-2.5 mt-2 shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-600/30 border border-amber-500/40 flex items-center justify-center text-sm font-bold text-amber-400 font-serif">
                  道
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-serif font-bold text-stone-100 text-sm">Disciple (You)</span>
                    <span className="text-[11px] font-mono text-stone-400">Level {userProfile.currentLevel}</span>
                  </div>
                  <span className="text-[10px] text-amber-500 font-bold">Rating {userProfile.puzzleRating}</span>
                </div>
              </div>

              <div className="text-xs text-stone-400 font-mono">
                {timeControl !== 'none' && (playerColor === 'white' ? formatTime(whiteTime) : formatTime(blackTime))}
              </div>
            </div>

            {/* Quick Sparring Actions Bar (Undo, Hint, Resign) */}
            <div className="w-full max-w-[560px] mt-2.5 flex items-center gap-2">
              <button
                onClick={handleTakeback}
                disabled={!canUndo}
                title="Undo your last move and the bot's response (Shortcut: Z)"
                className="flex-1 py-2.5 px-3 rounded-xl bg-stone-800/90 hover:bg-stone-700 border border-stone-700/80 text-stone-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>Undo Move</span>
                <span className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-stone-950/80 border border-stone-700 text-[10px] text-stone-400 font-mono">
                  Z
                </span>
              </button>

              <button
                onClick={handleRequestHint}
                disabled={isBotThinking || !!gameResult}
                title="Ask Sensei for a hint"
                className="flex-1 py-2.5 px-3 rounded-xl bg-stone-800/90 hover:bg-stone-700 border border-stone-700/80 text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
              >
                <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                <span>Sensei Hint</span>
              </button>

              <button
                onClick={handleResign}
                disabled={!!gameResult}
                title="Resign current match"
                className="py-2.5 px-3.5 rounded-xl bg-stone-900/90 hover:bg-red-950/40 hover:border-red-500/40 border border-stone-800 text-stone-400 hover:text-red-300 text-xs font-medium flex items-center gap-1.5 transition-all disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
              >
                <Flag className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Resign</span>
              </button>
            </div>

            {/* Undo Toast Notification */}
            {undoToast && (
              <div className="w-full max-w-[560px] mt-2 py-2 px-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center justify-center gap-2 animate-fadeIn shadow-lg">
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>{undoToast}</span>
              </div>
            )}
          </div>

          {/* Right Column: Sparring Controls & Sensei Feedback */}
          <div className="lg:col-span-5 space-y-4">
            {/* Game Result Banner */}
            {gameResult && (
              <div className="p-5 rounded-2xl bg-gradient-to-br from-stone-900 via-amber-950/40 to-stone-900 border border-amber-500/50 shadow-2xl animate-scaleUp">
                <div className="flex items-center gap-3 mb-2">
                  <Trophy className="w-6 h-6 text-amber-400" />
                  <h3 className="font-serif font-black text-xl text-amber-300">{gameResult}</h3>
                </div>
                <p className="text-stone-300 text-xs italic mb-4 leading-relaxed">
                  "{resultQuote}"
                </p>
                {assistedWin && (
                  <p className="text-amber-300/90 text-[11px] mb-4 -mt-2">
                    Assisted win (takebacks used). Win again without takebacks to count it for your level gate.
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  {canUndo && (
                    <button
                      onClick={handleTakeback}
                      className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-serif font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 active:scale-95 cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Undo Blunder & Correct Move
                    </button>
                  )}
                  <button
                    onClick={handleStartGame}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Spar Again
                  </button>
                  <button
                    onClick={() => {
                      if (onNavigateToReview) {
                        onNavigateToReview(buildPgn(game, '*'), playerColor);
                      }
                    }}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Review Game
                  </button>
                  <button
                    onClick={() => setGameStarted(false)}
                    className="py-2.5 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-400 border border-stone-800 text-xs transition-all cursor-pointer"
                  >
                    Change Bot
                  </button>
                </div>
              </div>
            )}

            {/* Coach Toolbar */}
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-xl space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-stone-800">
                <div className="flex items-center gap-2 text-xs font-bold text-stone-300">
                  <Shield className="w-4 h-4 text-amber-500" />
                  <span>Sensei Guidance</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-mono text-stone-400" title="Stockfish evaluation from White's point of view (+ means White is better)">
                  <span>{checkingMove ? 'Checking move…' : 'Eval (White):'}</span>
                  {!checkingMove && <span className="font-bold text-amber-400">{currentEval}</span>}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={handleRequestHint}
                  disabled={isBotThinking || !!gameResult}
                  className="py-2.5 px-2 rounded-xl bg-stone-800 hover:bg-amber-950/40 border border-stone-700 hover:border-amber-500/40 text-amber-300 text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  <Lightbulb className="w-4 h-4 text-amber-400" />
                  <span>Get Hint</span>
                </button>

                <button
                  onClick={handleTakeback}
                  disabled={!canUndo}
                  title="Undo previous move (Shortcut: Z)"
                  className="py-2.5 px-2 rounded-xl bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-300 text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  <RotateCcw className="w-4 h-4 text-amber-400" />
                  <div className="flex items-center gap-1">
                    <span>Takeback</span>
                    <span className="text-[9px] px-1 py-0.2 bg-stone-900 border border-stone-700 rounded text-stone-400 font-mono">
                      Z
                    </span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    // Explain the last move played, from the position before it
                    if (moveHistory.length === 0) return;
                    const before = new Chess();
                    for (const m of moveHistory.slice(0, -1)) before.move(m);
                    setExplainModal({
                      open: true,
                      fen: before.fen(),
                      move: moveHistory[moveHistory.length - 1],
                    });
                  }}
                  disabled={moveHistory.length === 0}
                  className="py-2.5 px-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-300 text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Explain</span>
                </button>
              </div>
            </div>

            {/* Move History Log */}
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-xl">
              <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3">
                Sparring Record
              </h4>
              <div className="max-h-48 overflow-y-auto space-y-1 font-mono text-xs pr-2">
                {moveHistory.length === 0 ? (
                  <p className="text-stone-500 italic text-center py-4">No moves yet. Make your opening strike.</p>
                ) : (
                  Array.from({ length: Math.ceil(moveHistory.length / 2) }).map((_, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-7 py-1 px-2 rounded hover:bg-stone-800/50 text-stone-300"
                    >
                      <span className="col-span-1 text-stone-500 font-bold">{i + 1}.</span>
                      <span className="col-span-3 text-stone-200">{moveHistory[i * 2]}</span>
                      <span className="col-span-3 text-stone-400">{moveHistory[i * 2 + 1] || ''}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Resign / Change match button */}
            <div className="flex gap-2">
              <button
                onClick={handleResign}
                disabled={!!gameResult}
                className="flex-1 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-400 hover:text-stone-200 text-xs font-bold transition-all disabled:opacity-40"
              >
                Resign
              </button>
              <button
                onClick={() => setGameStarted(false)}
                className="py-2 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-400 hover:text-stone-200 text-xs font-bold transition-all"
              >
                Leave Arena
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Coach Warning Modal for Blunders */}
      {warningModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-stone-900 border border-red-500/50 rounded-2xl max-w-sm w-full p-5 shadow-2xl text-stone-100">
            <div className="flex items-center gap-3 mb-3 text-red-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-serif font-bold text-base">Sensei Warning!</h3>
            </div>
            <p className="text-xs text-stone-300 leading-relaxed mb-5">
              {warningModal.reason}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setWarningModal(null)}
                className="flex-1 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs uppercase tracking-wider transition-all"
              >
                Try Another Move
              </button>
              <button
                onClick={() => {
                  const { from, to, promotion } = warningModal;
                  setWarningModal(null);
                  executeConfirmedMove(from, to, promotion);
                }}
                className="py-2.5 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200 text-xs transition-all"
              >
                Play Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gemini Sensei Explanation Modal */}
      <GeminiCoachModal
        isOpen={explainModal.open}
        onClose={() => setExplainModal({ open: false, fen: '', move: '' })}
        fen={explainModal.fen}
        movePlayed={explainModal.move}
        userLevel={userProfile.currentLevel}
        context={`Sparring against ${selectedBot.name} (${selectedBot.elo})`}
      />
    </div>
  );
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}
