"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { MentorConfig } from "@/lib/types";
import { recordSession, getSessions } from "@/lib/stats";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const MAX_WRONG = 6;

interface HangmanProps {
  config: MentorConfig;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function HangmanSVG({ wrongCount }: { wrongCount: number }) {
  return (
    <svg viewBox="0 0 200 220" className="w-44 h-44 mx-auto">
      {/* Base */}
      <line x1="20" y1="210" x2="180" y2="210" stroke="#F59E0B" strokeWidth={3} strokeLinecap="round" />
      {/* Pole */}
      <line x1="60" y1="210" x2="60" y2="20" stroke="#F59E0B" strokeWidth={3} strokeLinecap="round" />
      {/* Top bar */}
      <line x1="60" y1="20" x2="140" y2="20" stroke="#F59E0B" strokeWidth={3} strokeLinecap="round" />
      {/* Rope */}
      <line x1="140" y1="20" x2="140" y2="50" stroke="#F59E0B" strokeWidth={2.5} strokeLinecap="round" />

      {/* Head */}
      {wrongCount >= 1 && (
        <circle
          cx="140" cy="70" r="20"
          stroke="#EF4444" strokeWidth={2.5}
          fill="rgba(255,71,87,0.08)"
        />
      )}
      {/* Body */}
      {wrongCount >= 2 && (
        <line x1="140" y1="90" x2="140" y2="150" stroke="#EF4444" strokeWidth={2.5} strokeLinecap="round" />
      )}
      {/* Left arm */}
      {wrongCount >= 3 && (
        <line x1="140" y1="110" x2="110" y2="135" stroke="#EF4444" strokeWidth={2.5} strokeLinecap="round" />
      )}
      {/* Right arm */}
      {wrongCount >= 4 && (
        <line x1="140" y1="110" x2="170" y2="135" stroke="#EF4444" strokeWidth={2.5} strokeLinecap="round" />
      )}
      {/* Left leg */}
      {wrongCount >= 5 && (
        <line x1="140" y1="150" x2="110" y2="185" stroke="#EF4444" strokeWidth={2.5} strokeLinecap="round" />
      )}
      {/* Right leg */}
      {wrongCount >= 6 && (
        <line x1="140" y1="150" x2="170" y2="185" stroke="#EF4444" strokeWidth={2.5} strokeLinecap="round" />
      )}
    </svg>
  );
}

export default function Hangman({ config }: HangmanProps) {
  const [currentRule, setCurrentRule] = useState(() => pickRandom(config.rules));
  const [guessedLetters, setGuessedLetters] = useState<Set<string>>(new Set());
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const sessionStartRef = useRef(Date.now());
  const recordedRef = useRef(false);

  const phrase = currentRule.rule.toUpperCase();

  const wrongGuesses = useMemo(() => {
    return [...guessedLetters].filter((l) => !phrase.includes(l));
  }, [guessedLetters, phrase]);

  const wrongCount = wrongGuesses.length;

  const isWon = useMemo(() => {
    return phrase.split("").every((ch) => {
      if (!/[A-Z]/.test(ch)) return true;
      return guessedLetters.has(ch);
    });
  }, [phrase, guessedLetters]);

  const isLost = wrongCount >= MAX_WRONG;
  const gameOver = isWon || isLost;

  useEffect(() => {
    if (gameOver && !recordedRef.current) {
      recordedRef.current = true;
      recordSession({
        gameId: "hangman",
        gameName: "Hangman",
        mentorId: config.id,
        timestamp: Date.now(),
        durationMs: Date.now() - sessionStartRef.current,
        score: isWon ? Math.max(0, (MAX_WRONG - wrongCount) * 100) : 0,
      });
    }
  }, [gameOver, isWon, wrongCount, config.id]);

  const handleGuess = useCallback(
    (letter: string) => {
      if (gameOver || guessedLetters.has(letter)) return;
      setGuessedLetters((prev) => new Set(prev).add(letter));
    },
    [gameOver, guessedLetters]
  );

  const playAgain = useCallback(() => {
    if (isWon) setWins((w) => w + 1);
    if (isLost) setLosses((l) => l + 1);
    sessionStartRef.current = Date.now();
    recordedRef.current = false;
    setCurrentRule(pickRandom(config.rules));
    setGuessedLetters(new Set());
  }, [isWon, isLost, config.rules]);

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-2xl mx-auto py-4 select-none">
      {/* Score badges */}
      <div className="flex gap-3">
        <div className="flex items-center gap-2 bg-card rounded-lg px-4 py-2 border border-card-border">
          <span className="text-[10px] font-mono text-muted uppercase tracking-widest">Wins</span>
          <span className="text-green font-black font-mono text-base">{wins}</span>
        </div>
        <div className="flex items-center gap-2 bg-card rounded-lg px-4 py-2 border border-card-border">
          <span className="text-[10px] font-mono text-muted uppercase tracking-widest">Wrong</span>
          <span className="text-red font-black font-mono text-base">
            {wrongCount}/{MAX_WRONG}
          </span>
        </div>
        <div className="flex items-center gap-2 bg-card rounded-lg px-4 py-2 border border-card-border">
          <span className="text-[10px] font-mono text-muted uppercase tracking-widest">Losses</span>
          <span className="text-muted font-black font-mono text-base">{losses}</span>
        </div>
      </div>

      {/* Drawing */}
      <HangmanSVG wrongCount={wrongCount} />

      {/* Phrase display */}
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-2 px-4 max-w-xl">
        {phrase.split(" ").map((word, wordIdx) => (
          <div key={wordIdx} className="flex gap-1">
            {word.split("").map((ch, ci) => {
              const isAlpha = /[A-Z]/.test(ch);
              const isRevealed = !isAlpha || guessedLetters.has(ch) || (isLost && isAlpha);
              const wasGuessed = guessedLetters.has(ch);

              if (!isAlpha) {
                return (
                  <span key={ci} className="w-5 text-center text-muted text-lg font-mono">
                    {ch}
                  </span>
                );
              }

              return (
                <div
                  key={ci}
                  className={`w-7 h-9 flex items-end justify-center pb-0.5 border-b-2 font-bold font-mono text-base transition-all ${
                    isRevealed
                      ? wasGuessed
                        ? "border-green/50 text-green"
                        : "border-red/40 text-red"
                      : "border-white/20 text-transparent"
                  }`}
                >
                  {isRevealed ? ch : "\u00A0"}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Game over */}
      {gameOver && (
        <div className="text-center space-y-4 px-4">
          <p
            className={`text-lg font-bold tracking-wide ${
              isWon ? "text-green" : "text-red"
            }`}
          >
            {isWon ? "You got it!" : "Game Over"}
          </p>
          <div className="bg-card rounded-xl border border-card-border p-4 max-w-md text-left">
            <p className="text-sm text-muted leading-relaxed">{currentRule.description}</p>
          </div>
          <button
            onClick={playAgain}
            className="px-8 py-2.5 rounded-xl bg-card border border-card-border hover:border-white/20 text-foreground font-bold transition-colors text-sm uppercase tracking-wide"
          >
            Play Again
          </button>
        </div>
      )}

      {/* Keyboard */}
      {!gameOver && (
        <div className="flex flex-wrap justify-center gap-1.5 max-w-md mx-auto">
          {ALPHABET.map((letter) => {
            const used = guessedLetters.has(letter);
            const inPhrase = phrase.includes(letter);

            return (
              <button
                key={letter}
                onClick={() => handleGuess(letter)}
                disabled={used || gameOver}
                className={`w-9 h-10 rounded-lg text-sm font-bold transition-colors ${
                  !used
                    ? "bg-[#1a1a2e] hover:bg-[#22223a] text-foreground"
                    : inPhrase
                    ? "bg-green/15 text-green border border-green/20 cursor-default"
                    : "bg-[#141420] text-foreground/20 cursor-default"
                }`}
              >
                {letter}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
