"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { MentorConfig } from "@/lib/types";
import { recordSession, getSessions } from "@/lib/stats";
import { getSettings, saveSettings } from "@/lib/settings";

interface MoleState {
  concept: { label: string; isValid: boolean; explanation?: string };
  holeIndex: number;
  id: number;
  appearedAt: number;
  duration: number;
  tapped: boolean;
  result: "correct" | "wrong" | null;
}

type GamePhase = "start" | "playing" | "ended";

export default function WhackAMoleGame({ config }: { config: MentorConfig }) {
  const [phase, setPhase] = useState<GamePhase>("start");
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [moles, setMoles] = useState<MoleState[]>([]);
  const [taps, setTaps] = useState(0);
  const [correctTaps, setCorrectTaps] = useState(0);
  const [flashStates, setFlashStates] = useState<
    Record<number, { type: "correct" | "wrong"; explanation: string }>
  >({});

  const nextIdRef = useRef(0);
  const gameStartRef = useRef(0);
  const durationSecondsRef = useRef(30);
  const tapsRef = useRef(0);
  const correctTapsRef = useRef(0);
  const scoreRef = useRef(0);
  const spawnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const concepts = config.concepts;

  const getRandomConcept = useCallback(() => {
    return concepts[Math.floor(Math.random() * concepts.length)];
  }, [concepts]);

  const getSpawnInterval = useCallback(() => {
    const elapsed = (Date.now() - gameStartRef.current) / 1000;
    return Math.max(400, 1200 - elapsed * 25) + Math.random() * 400;
  }, []);

  const getMoleDuration = useCallback(() => {
    const elapsed = (Date.now() - gameStartRef.current) / 1000;
    return Math.max(1000, 2500 - elapsed * 40);
  }, []);

  const cleanup = useCallback(() => {
    if (spawnTimerRef.current) { clearTimeout(spawnTimerRef.current); spawnTimerRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
  }, []);

  const spawnMole = useCallback(() => {
    setMoles((prev) => {
      const occupiedHoles = new Set(prev.filter((m) => !m.tapped).map((m) => m.holeIndex));
      const freeHoles = Array.from({ length: 9 }, (_, i) => i).filter((i) => !occupiedHoles.has(i));
      const activeCount = prev.filter((m) => !m.tapped).length;
      if (freeHoles.length === 0 || activeCount >= 3) return prev;

      const holeIndex = freeHoles[Math.floor(Math.random() * freeHoles.length)];
      const concept = getRandomConcept();
      const id = nextIdRef.current++;
      const duration = getMoleDuration();

      const newMole: MoleState = {
        concept, holeIndex, id,
        appearedAt: Date.now(),
        duration, tapped: false, result: null,
      };

      setTimeout(() => {
        setMoles((current) => current.filter((m) => m.id !== id));
      }, duration);

      return [...prev, newMole];
    });
  }, [getRandomConcept, getMoleDuration]);

  const scheduleSpawn = useCallback(() => {
    const interval = getSpawnInterval();
    spawnTimerRef.current = setTimeout(() => {
      spawnMole();
      scheduleSpawn();
    }, interval);
  }, [getSpawnInterval, spawnMole]);

  const startGame = useCallback(() => {
    const settings = getSettings();
    const durationSeconds = settings["whack-a-mole"].durationSeconds;
    durationSecondsRef.current = durationSeconds;
    setPhase("playing");
    setScore(0);
    setTimeLeft(durationSeconds);
    setMoles([]);
    setTaps(0);
    setCorrectTaps(0);
    setFlashStates({});
    nextIdRef.current = 0;
    tapsRef.current = 0;
    correctTapsRef.current = 0;
    scoreRef.current = 0;
    gameStartRef.current = Date.now();

    countdownRef.current = setInterval(() => {
      setTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    spawnMole();
    scheduleSpawn();
  }, [spawnMole, scheduleSpawn]);

  useEffect(() => {
    if (timeLeft === 0 && phase === "playing") {
      cleanup();
      recordSession({
        gameId: "whack-a-mole",
        gameName: "Whack-a-Mole",
        mentorId: config.id,
        timestamp: Date.now(),
        durationMs: durationSecondsRef.current * 1000,
        score: scoreRef.current,
        accuracy: tapsRef.current > 0 ? correctTapsRef.current / tapsRef.current : undefined,
      });
      setPhase("ended");
    }
  }, [timeLeft, phase, cleanup, config.id]);

  useEffect(() => { return cleanup; }, [cleanup]);

  const handleTap = useCallback(
    (mole: MoleState) => {
      if (mole.tapped || phase !== "playing") return;
      tapsRef.current += 1;
      setTaps(tapsRef.current);
      const isCorrect = mole.concept.isValid;
      if (isCorrect) {
        scoreRef.current += 10;
        correctTapsRef.current += 1;
        setScore(scoreRef.current);
        setCorrectTaps(correctTapsRef.current);
      } else {
        scoreRef.current -= 5;
        setScore(scoreRef.current);
      }

      setMoles((prev) =>
        prev.map((m) =>
          m.id === mole.id ? { ...m, tapped: true, result: isCorrect ? "correct" : "wrong" } : m
        )
      );

      setFlashStates((prev) => ({
        ...prev,
        [mole.holeIndex]: {
          type: isCorrect ? "correct" : "wrong",
          explanation: mole.concept.explanation || (isCorrect ? "Correct!" : "Incorrect!"),
        },
      }));

      setTimeout(() => {
        setFlashStates((prev) => {
          const next = { ...prev };
          delete next[mole.holeIndex];
          return next;
        });
        setMoles((prev) => prev.filter((m) => m.id !== mole.id));
      }, 800);
    },
    [phase]
  );

  const accuracy = taps > 0 ? Math.round((correctTaps / taps) * 100) : 0;

  if (phase === "start") {
    const currentDuration = getSettings()["whack-a-mole"].durationSeconds;
    const bestScore = Math.max(0, ...getSessions().filter(s => s.gameId === "whack-a-mole" && s.mentorId === config.id && s.score !== undefined).map(s => s.score!));
    return (
      <div className="flex flex-col items-center gap-6 text-center max-w-sm">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-wide text-foreground mb-2">
            Whack-a-Mole
          </h1>
          <p className="text-muted text-sm leading-relaxed">
            Tap <span className="text-green font-semibold">valid</span> concepts for +10 pts.
            Avoid <span className="text-red font-semibold">invalid</span> ones — they cost you 5 pts!
          </p>
          {bestScore > 0 && (
            <p className="text-xs font-mono text-muted mt-2">Best: <span className="text-green font-bold">{bestScore}</span></p>
          )}
        </div>
        {/* Time limit selector */}
        <div className="flex flex-col items-center gap-2 w-full">
          <p className="text-xs font-mono text-muted uppercase tracking-widest">Time Limit</p>
          <div className="flex gap-2">
            {([15, 30, 60, 90] as const).map((secs) => (
              <button
                key={secs}
                onClick={() => saveSettings({ "whack-a-mole": { durationSeconds: secs } })}
                className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all ${
                  currentDuration === secs
                    ? "bg-green text-white border-green"
                    : "bg-card border-card-border text-muted hover:border-white/20 hover:text-foreground"
                }`}
              >
                {secs}s
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={startGame}
          className="px-10 py-3.5 bg-green text-white font-bold text-base rounded-xl hover:opacity-90 transition-opacity uppercase tracking-wide"
        >
          Start
        </button>
      </div>
    );
  }

  if (phase === "ended") {
    return (
      <div className="flex flex-col items-center gap-6 text-center">
        <h1 className="text-4xl font-black uppercase tracking-wide text-foreground">
          Time&apos;s Up!
        </h1>
        <div className="bg-card rounded-2xl border border-card-border p-8 flex flex-col items-center gap-5">
          <div>
            <div className="text-[10px] font-mono text-muted uppercase tracking-widest mb-1">Final Score</div>
            <div className="text-6xl font-black font-mono text-foreground">{score}</div>
          </div>
          <div className="flex gap-8">
            <div className="text-center">
              <div className="text-[10px] font-mono text-muted uppercase tracking-widest mb-1">Accuracy</div>
              <div className="text-2xl font-black text-foreground">{accuracy}%</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] font-mono text-muted uppercase tracking-widest mb-1">Taps</div>
              <div className="text-2xl font-black text-foreground">{taps}</div>
            </div>
          </div>
        </div>
        <button
          onClick={startGame}
          className="px-10 py-3.5 bg-green text-white font-bold text-base rounded-xl hover:opacity-90 transition-opacity uppercase tracking-wide"
        >
          Play Again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      {/* HUD */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-card rounded-lg px-4 py-2 border border-card-border">
          <span className="text-[10px] font-mono text-muted uppercase tracking-widest">Score</span>
          <span className="font-black font-mono text-foreground text-xl">{score}</span>
        </div>
        <div className="flex items-center gap-2 bg-card rounded-lg px-4 py-2 border border-card-border">
          <span className="text-[10px] font-mono text-muted uppercase tracking-widest">Time</span>
          <span
            className={`font-black font-mono text-xl ${
              timeLeft < 10 ? "text-red" : "text-foreground"
            }`}
          >
            {timeLeft}s
          </span>
        </div>
      </div>

      {/* 3×3 hole grid */}
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 9 }).map((_, holeIndex) => {
          const mole = moles.find((m) => m.holeIndex === holeIndex && !m.tapped);
          const flash = flashStates[holeIndex];

          return (
            <div
              key={holeIndex}
              className={`relative w-28 h-28 rounded-full overflow-hidden border-2 transition-all duration-200 ${
                flash
                  ? flash.type === "correct"
                    ? "border-green/50 shadow-[0_0_20px_rgba(29,185,124,0.2)] bg-green/10"
                    : "border-red/50 shadow-[0_0_20px_rgba(255,71,87,0.2)] bg-red/8"
                  : "border-card-border bg-[#050510]"
              }`}
            >
              {/* Flash feedback */}
              {flash && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <span
                    className={`text-2xl font-black ${
                      flash.type === "correct" ? "text-green" : "text-red"
                    }`}
                  >
                    {flash.type === "correct" ? "✓" : "✗"}
                  </span>
                </div>
              )}

              {/* Mole */}
              {mole && !flash && (
                <button
                  onClick={() => handleTap(mole)}
                  type="button"
                  className="absolute inset-0 flex items-center justify-center bg-card hover:bg-[#141428] cursor-pointer active:scale-95 transition-all animate-pop-up rounded-full"
                >
                  <span className="text-foreground text-xs font-semibold text-center leading-tight px-3">
                    {mole.concept.label}
                  </span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      <style jsx>{`
        @keyframes pop-up {
          0%   { transform: scale(0.3); opacity: 0; }
          60%  { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-pop-up {
          animation: pop-up 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
      `}</style>
    </div>
  );
}
