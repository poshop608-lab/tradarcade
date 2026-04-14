"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { MentorConfig } from "@/lib/types";
import { recordSession, getSessions } from "@/lib/stats";
import { getSettings } from "@/lib/settings";

interface MemoryCard {
  id: number;
  pairId: number;
  type: "term" | "definition";
  text: string;
  isFlipped: boolean;
  isMatched: boolean;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildCards(terms: MentorConfig["terms"], pairCount = 8): MemoryCard[] {
  const picked = shuffle(terms).slice(0, pairCount);
  const cards: MemoryCard[] = [];
  picked.forEach((t, idx) => {
    cards.push({
      id: idx * 2,
      pairId: idx,
      type: "term",
      text: t.term,
      isFlipped: false,
      isMatched: false,
    });
    cards.push({
      id: idx * 2 + 1,
      pairId: idx,
      type: "definition",
      text: t.definition,
      isFlipped: false,
      isMatched: false,
    });
  });
  return shuffle(cards);
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function Memory({ config }: { config: MentorConfig }) {
  const settingsRef = useRef(getSettings());
  const [cards, setCards] = useState<MemoryCard[]>(() => {
    const s = getSettings();
    return buildCards(config.terms, s.memory.pairCount);
  });
  const [flippedIds, setFlippedIds] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [time, setTime] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [matchedCount, setMatchedCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const started = useRef(false);
  const movesRef = useRef(0);
  const sessionStartRef = useRef(0);

  const startTimer = useCallback(() => {
    if (started.current) return;
    started.current = true;
    sessionStartRef.current = Date.now();
    const settings = settingsRef.current;
    const timerSeconds = settings.memory.timerSeconds;

    if (timerSeconds > 0) {
      // Countdown timer
      setTime(timerSeconds);
      timerRef.current = setInterval(() => {
        setTime((t) => {
          if (t <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            setGameOver(true);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    } else {
      // Count-up timer
      setTime(0);
      timerRef.current = setInterval(() => {
        setTime((t) => t + 1);
      }, 1000);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (cards.length > 0 && cards.every((c) => c.isMatched)) {
      setGameOver(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [cards]);

  const recordedRef = useRef(false);
  useEffect(() => {
    if (gameOver && started.current && !recordedRef.current) {
      recordedRef.current = true;
      const durationMs = Date.now() - sessionStartRef.current;
      const m = movesRef.current;
      recordSession({
        gameId: "memory",
        gameName: "Memory",
        mentorId: config.id,
        timestamp: Date.now(),
        durationMs,
        score: m > 0 ? Math.round(1000 / m) : 0,
      });
    }
  }, [gameOver, config.id]);

  const handleCardClick = useCallback(
    (cardId: number) => {
      if (isChecking) return;
      if (flippedIds.length >= 2) return;

      const card = cards.find((c) => c.id === cardId);
      if (!card || card.isFlipped || card.isMatched) return;

      startTimer();

      const newFlipped = [...flippedIds, cardId];
      setFlippedIds(newFlipped);
      setCards((prev) =>
        prev.map((c) => (c.id === cardId ? { ...c, isFlipped: true } : c))
      );

      if (newFlipped.length === 2) {
        movesRef.current += 1;
        setMoves(movesRef.current);
        setIsChecking(true);

        const first = cards.find((c) => c.id === newFlipped[0])!;
        const second = cards.find((c) => c.id === newFlipped[1])!;

        if (first.pairId === second.pairId && first.type !== second.type) {
          setTimeout(() => {
            setCards((prev) =>
              prev.map((c) =>
                c.pairId === first.pairId
                  ? { ...c, isMatched: true, isFlipped: true }
                  : c
              )
            );
            setMatchedCount((m) => m + 1);
            setFlippedIds([]);
            setIsChecking(false);
          }, 600);
        } else {
          setTimeout(() => {
            setCards((prev) =>
              prev.map((c) =>
                newFlipped.includes(c.id) && !c.isMatched
                  ? { ...c, isFlipped: false }
                  : c
              )
            );
            setFlippedIds([]);
            setIsChecking(false);
          }, 1000);
        }
      }
    },
    [cards, flippedIds, isChecking, startTimer]
  );

  const resetGame = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    started.current = false;
    recordedRef.current = false;
    settingsRef.current = getSettings();
    const { pairCount, timerSeconds } = settingsRef.current.memory;
    setCards(buildCards(config.terms, pairCount));
    setFlippedIds([]);
    movesRef.current = 0;
    setMoves(0);
    setTime(timerSeconds > 0 ? timerSeconds : 0);
    setGameOver(false);
    setIsChecking(false);
    setMatchedCount(0);
    sessionStartRef.current = 0;
  }, [config.terms]);

  if (gameOver) {
    const isCountdown = settingsRef.current.memory.timerSeconds > 0;
    const allMatched = cards.length > 0 && cards.every((c) => c.isMatched);
    return (
      <div className="flex flex-col items-center gap-6 text-center">
        <h2 className="text-3xl font-black text-green tracking-wide uppercase">
          {allMatched ? "All Matched!" : `Time's Up! ${matchedCount}/${settingsRef.current.memory.pairCount} pairs`}
        </h2>
        <div className="flex gap-6">
          {!isCountdown && (
            <div className="bg-card rounded-xl border border-card-border px-6 py-4">
              <div className="text-[10px] font-mono text-muted uppercase tracking-widest mb-1">Time</div>
              <div className="font-black font-mono text-2xl text-foreground">{formatTime(time)}</div>
            </div>
          )}
          <div className="bg-card rounded-xl border border-card-border px-6 py-4">
            <div className="text-[10px] font-mono text-muted uppercase tracking-widest mb-1">Moves</div>
            <div className="font-black font-mono text-2xl text-foreground">{moves}</div>
          </div>
        </div>
        {(() => { const best = Math.min(...getSessions().filter(s => s.gameId === "memory" && s.mentorId === config.id && s.score !== undefined).map(s => s.score!)); return isFinite(best) ? <p className="text-xs font-mono text-muted">Best: <span className="text-green font-bold">{best} moves</span></p> : null; })()}
        <button
          onClick={resetGame}
          className="px-8 py-2.5 rounded-xl bg-green text-white font-bold hover:opacity-90 transition-opacity text-sm uppercase tracking-wide"
        >
          Play Again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-[700px]">
      {/* Stats bar */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-card rounded-lg px-3 py-1.5 border border-card-border">
          <span className="text-[10px] font-mono text-muted uppercase tracking-widest">
            {settingsRef.current.memory.timerSeconds > 0 ? "Time Left" : "Time"}
          </span>
          <span className={`font-bold font-mono ${settingsRef.current.memory.timerSeconds > 0 && time < 15 ? "text-red" : "text-foreground"}`}>
            {formatTime(time)}
          </span>
        </div>
        <div className="flex items-center gap-2 bg-card rounded-lg px-3 py-1.5 border border-card-border">
          <span className="text-[10px] font-mono text-muted uppercase tracking-widest">Moves</span>
          <span className="font-bold font-mono text-foreground">{moves}</span>
        </div>
        <button
          onClick={resetGame}
          className="text-xs font-mono text-muted hover:text-foreground transition-colors uppercase tracking-widest"
        >
          Reset
        </button>
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-4 gap-2.5 w-full">
        {cards.map((card) => (
          <button
            key={card.id}
            onClick={() => handleCardClick(card.id)}
            disabled={card.isFlipped || card.isMatched}
            className="relative w-full aspect-[3/2] [perspective:700px]"
            aria-label={card.isFlipped || card.isMatched ? card.text : "Hidden card"}
          >
            <div
              className={`relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] ${
                card.isFlipped || card.isMatched ? "[transform:rotateY(180deg)]" : ""
              }`}
            >
              {/* Back face */}
              <div className="absolute inset-0 rounded-xl flex items-center justify-center [backface-visibility:hidden] bg-[#0f0f1e] border border-card-border hover:border-white/15 transition-colors cursor-pointer">
                <span className="text-xl font-black text-muted select-none">?</span>
              </div>

              {/* Front face */}
              <div
                className={`absolute inset-0 rounded-xl flex items-center justify-center p-2 [backface-visibility:hidden] [transform:rotateY(180deg)] ${
                  card.type === "term"
                    ? "bg-green/10 border border-green/25 text-green"
                    : "bg-blue/10 border border-blue/25 text-blue"
                } ${card.isMatched ? "opacity-70 shadow-[0_0_14px_rgba(0,255,135,0.15)]" : ""}`}
              >
                <span className="text-xs sm:text-sm font-semibold leading-tight text-center line-clamp-3 overflow-hidden">
                  {card.text}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
