"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { MentorConfig } from "@/lib/types";
import { recordSession, getSessions } from "@/lib/stats";

type LetterStatus = "correct" | "present" | "absent" | "empty";

interface TileData {
  letter: string;
  status: LetterStatus;
}

const KEYBOARD_ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "⌫"],
];

const MAX_GUESSES = 6;

function pickRandomTerm(terms: MentorConfig["terms"]): MentorConfig["terms"][number] {
  return terms[Math.floor(Math.random() * terms.length)];
}

function evaluateGuess(guess: string, answer: string): LetterStatus[] {
  const result: LetterStatus[] = Array(answer.length).fill("absent");
  const answerLetters = answer.split("");
  const remaining = [...answerLetters];

  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === answerLetters[i]) {
      result[i] = "correct";
      remaining[i] = "";
    }
  }

  for (let i = 0; i < guess.length; i++) {
    if (result[i] === "correct") continue;
    const idx = remaining.indexOf(guess[i]);
    if (idx !== -1) {
      result[i] = "present";
      remaining[idx] = "";
    }
  }

  return result;
}

export default function WordleGame({ config }: { config: MentorConfig }) {
  const [currentTerm, setCurrentTerm] = useState(() => pickRandomTerm(config.terms));
  const [guesses, setGuesses] = useState<TileData[][]>([]);
  const [currentGuess, setCurrentGuess] = useState("");
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [shake, setShake] = useState(false);
  const [revealRow, setRevealRow] = useState(-1);
  const [score, setScore] = useState({ wins: 0, losses: 0 });
  const sessionStartRef = useRef(Date.now());

  const wordLength = currentTerm.term.length;

  const keyStatuses = (() => {
    const map: Record<string, LetterStatus> = {};
    for (const row of guesses) {
      for (const tile of row) {
        if (!tile.letter) continue;
        const prev = map[tile.letter];
        if (tile.status === "correct") {
          map[tile.letter] = "correct";
        } else if (tile.status === "present" && prev !== "correct") {
          map[tile.letter] = "present";
        } else if (!prev) {
          map[tile.letter] = "absent";
        }
      }
    }
    return map;
  })();

  const submitGuess = useCallback(() => {
    if (currentGuess.length !== wordLength) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    const statuses = evaluateGuess(currentGuess, currentTerm.term);
    const newRow: TileData[] = currentGuess.split("").map((letter, i) => ({
      letter,
      status: statuses[i],
    }));

    const newGuesses = [...guesses, newRow];
    setGuesses(newGuesses);
    setRevealRow(newGuesses.length - 1);
    setCurrentGuess("");

    const isWin = statuses.every((s) => s === "correct");
    if (isWin) {
      setWon(true);
      setGameOver(true);
      setScore((prev) => ({ ...prev, wins: prev.wins + 1 }));
      recordSession({
        gameId: "wordle",
        gameName: "Wordle",
        mentorId: config.id,
        timestamp: Date.now(),
        durationMs: Date.now() - sessionStartRef.current,
        score: (MAX_GUESSES - newGuesses.length + 1) * 100,
      });
    } else if (newGuesses.length >= MAX_GUESSES) {
      setGameOver(true);
      setScore((prev) => ({ ...prev, losses: prev.losses + 1 }));
      recordSession({
        gameId: "wordle",
        gameName: "Wordle",
        mentorId: config.id,
        timestamp: Date.now(),
        durationMs: Date.now() - sessionStartRef.current,
        score: 0,
      });
    }
  }, [currentGuess, wordLength, currentTerm.term, guesses, config.id]);

  const handleKey = useCallback(
    (key: string) => {
      if (gameOver) return;
      if (key === "ENTER") {
        submitGuess();
      } else if (key === "⌫" || key === "BACKSPACE") {
        setCurrentGuess((prev) => prev.slice(0, -1));
      } else if (/^[A-Z]$/.test(key) && currentGuess.length < wordLength) {
        setCurrentGuess((prev) => prev + key);
      }
    },
    [gameOver, submitGuess, currentGuess.length, wordLength]
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const key = e.key.toUpperCase();
      if (key === "ENTER" || key === "BACKSPACE" || /^[A-Z]$/.test(key)) {
        e.preventDefault();
        handleKey(key);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleKey]);

  function playAgain() {
    sessionStartRef.current = Date.now();
    setCurrentTerm(pickRandomTerm(config.terms));
    setGuesses([]);
    setCurrentGuess("");
    setGameOver(false);
    setWon(false);
    setRevealRow(-1);
  }

  function tileStyle(status: LetterStatus, hasLetter: boolean): string {
    switch (status) {
      case "correct":
        return "bg-green border-green text-white font-black";
      case "present":
        return "bg-amber border-amber text-white font-black";
      case "absent":
        return "bg-[#1a1a2a] border-[#1a1a2a] text-foreground/50 font-bold";
      default:
        return hasLetter
          ? "bg-transparent border-white/30 text-foreground font-bold"
          : "bg-transparent border-card-border text-transparent";
    }
  }

  function keyStyle(key: string): string {
    const status = keyStatuses[key];
    switch (status) {
      case "correct":
        return "bg-green text-white font-black";
      case "present":
        return "bg-amber text-white font-black";
      case "absent":
        return "bg-[#141420] text-foreground/30 font-semibold";
      default:
        return "bg-[#1a1a2e] hover:bg-[#22223a] text-foreground font-semibold";
    }
  }

  const rows: TileData[][] = [];
  for (let i = 0; i < MAX_GUESSES; i++) {
    if (i < guesses.length) {
      rows.push(guesses[i]);
    } else if (i === guesses.length) {
      const tiles: TileData[] = [];
      for (let j = 0; j < wordLength; j++) {
        tiles.push({ letter: currentGuess[j] || "", status: "empty" });
      }
      rows.push(tiles);
    } else {
      rows.push(
        Array.from({ length: wordLength }, () => ({
          letter: "",
          status: "empty" as LetterStatus,
        }))
      );
    }
  }

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-lg mx-auto select-none">
      {/* Score badges */}
      <div className="flex gap-3 flex-wrap justify-center">
        <div className="flex items-center gap-2 bg-card rounded-lg px-4 py-2 border border-card-border">
          <span className="text-[10px] font-mono text-muted uppercase tracking-widest">Wins</span>
          <span className="text-green font-black font-mono text-base">{score.wins}</span>
        </div>
        <div className="flex items-center gap-2 bg-card rounded-lg px-4 py-2 border border-card-border">
          <span className="text-[10px] font-mono text-muted uppercase tracking-widest">Losses</span>
          <span className="text-red font-black font-mono text-base">{score.losses}</span>
        </div>
        {(() => { const best = Math.max(0, ...getSessions().filter(s => s.gameId === "wordle" && s.mentorId === config.id && s.score !== undefined).map(s => s.score!)); return best > 0 ? <div className="flex items-center gap-2 bg-card rounded-lg px-4 py-2 border border-card-border"><span className="text-[10px] font-mono text-muted uppercase tracking-widest">Best Streak</span><span className="text-amber font-black font-mono text-base">{best}</span></div> : null; })()}
      </div>

      {/* Tile grid */}
      <div className="flex flex-col gap-1.5">
        {rows.map((row, rowIdx) => (
          <div
            key={rowIdx}
            className={`flex gap-1.5 ${
              rowIdx === guesses.length && shake
                ? "animate-[shake_0.5s_ease-in-out]"
                : ""
            }`}
          >
            {row.map((tile, colIdx) => {
              const isRevealing = rowIdx === revealRow && tile.status !== "empty";
              return (
                <div
                  key={colIdx}
                  className={`w-11 h-11 sm:w-13 sm:h-13 flex items-center justify-center border-2 rounded-lg text-lg uppercase transition-all duration-300 ${tileStyle(
                    tile.status,
                    !!tile.letter
                  )} ${isRevealing ? "animate-[flip_0.5s_ease-in-out]" : ""}`}
                  style={
                    isRevealing
                      ? {
                          animationDelay: `${colIdx * 150}ms`,
                          animationFillMode: "both",
                        }
                      : undefined
                  }
                >
                  {tile.letter}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Game over */}
      {gameOver && (
        <div className="text-center space-y-4 mt-1">
          <p
            className={`text-lg font-bold tracking-wide ${
              won ? "text-green" : "text-red"
            }`}
          >
            {won ? "Correct!" : `Answer: ${currentTerm.term}`}
          </p>
          <div className="bg-card rounded-xl border border-card-border p-5 max-w-sm text-left">
            {currentTerm.category && (
              <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-2">
                {currentTerm.category}
              </p>
            )}
            <p className="font-bold text-foreground mb-1.5">{currentTerm.term}</p>
            <p className="text-sm text-muted leading-relaxed">{currentTerm.definition}</p>
          </div>
          <button
            onClick={playAgain}
            className="px-8 py-2.5 rounded-xl bg-green text-white font-bold hover:opacity-90 transition-opacity text-sm uppercase tracking-wide"
          >
            Play Again
          </button>
        </div>
      )}

      {/* Keyboard */}
      {!gameOver && (
        <div className="flex flex-col items-center gap-1.5 mt-1">
          {KEYBOARD_ROWS.map((row, rowIdx) => (
            <div key={rowIdx} className="flex gap-1">
              {row.map((key) => (
                <button
                  key={key}
                  onClick={() => handleKey(key)}
                  className={`${
                    key === "ENTER" || key === "⌫"
                      ? "px-2.5 sm:px-3 text-[11px] min-w-[44px]"
                      : "w-8 sm:w-9 text-sm"
                  } h-12 rounded-lg transition-colors ${keyStyle(key)}`}
                >
                  {key}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes flip {
          0%   { transform: scaleY(1); }
          50%  { transform: scaleY(0); }
          100% { transform: scaleY(1); }
        }
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%     { transform: translateX(-6px); }
          40%     { transform: translateX(6px); }
          60%     { transform: translateX(-4px); }
          80%     { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}
