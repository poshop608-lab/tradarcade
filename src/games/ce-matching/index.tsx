"use client";

import { useState, useEffect, useRef } from "react";
import { MentorConfig } from "@/lib/types";
import { recordSession } from "@/lib/stats";

type Difficulty = "easy" | "normal" | "hard";
type GamePhase = "start" | "playing" | "ended";

interface Question {
  gbNumber: string;
  correctCE: string;
  options: string[];
  explanation?: string;
}

const TOTAL_QUESTIONS = 10;
const SPEED_BONUS_MS = 3000;
const SPEED_BONUS_PTS = 50;
const BASE_PTS = 100;
const STREAK_BONUS_PTS = 25;

const TIMER_BY_DIFF: Record<Difficulty, number | null> = {
  easy: null,
  normal: null,
  hard: 3,
};

const OPTIONS_BY_DIFF: Record<Difficulty, number> = {
  easy: 2,
  normal: 4,
  hard: 5,
};

function buildQuestions(
  pairings: MentorConfig["cePairings"],
  diff: Difficulty
): Question[] {
  if (!pairings?.length) return [];

  const numOptions = OPTIONS_BY_DIFF[diff];
  const allCE = [...new Set(pairings.map((p) => p.ceNumber))];

  const shuffled = [...pairings].sort(() => Math.random() - 0.5);
  const pool = shuffled.slice(0, TOTAL_QUESTIONS);

  return pool.map((pairing) => {
    const distractors = allCE
      .filter((ce) => ce !== pairing.ceNumber)
      .sort(() => Math.random() - 0.5)
      .slice(0, numOptions - 1);

    while (distractors.length < numOptions - 1) {
      const dummy = String(10 + Math.floor(Math.random() * 80)).padStart(2, "0");
      if (!distractors.includes(dummy) && dummy !== pairing.ceNumber) {
        distractors.push(dummy);
      }
    }

    const options = [...distractors, pairing.ceNumber].sort(() => Math.random() - 0.5);

    return {
      gbNumber: pairing.gbNumber,
      correctCE: pairing.ceNumber,
      options,
      explanation: pairing.explanation,
    };
  });
}

export default function CEMatchingGame({ config }: { config: MentorConfig }) {
  const [phase, setPhase] = useState<GamePhase>("start");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [speedBonus, setSpeedBonus] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [timerPct, setTimerPct] = useState(100);
  const [timerKey, setTimerKey] = useState(0);

  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const maxStreakRef = useRef(0);
  const correctRef = useRef(0);
  const startTimeRef = useRef(0);
  const questionStartRef = useRef(0);
  const answeredRef = useRef(false);

  const pairings = config.cePairings;
  const timerSeconds = TIMER_BY_DIFF[difficulty];
  const answered = selectedOption !== null || timedOut;

  // Timer visual — only for hard mode
  useEffect(() => {
    if (phase !== "playing" || timerSeconds === null) return;
    const start = Date.now();
    const iv = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.max(0, ((timerSeconds * 1000 - elapsed) / (timerSeconds * 1000)) * 100);
      setTimerPct(pct);
    }, 50);
    return () => clearInterval(iv);
  }, [phase, timerKey, timerSeconds]);

  // Auto-timeout — only for hard mode
  useEffect(() => {
    if (phase !== "playing" || timerSeconds === null) return;
    const t = setTimeout(() => {
      if (!answeredRef.current) {
        answeredRef.current = true;
        streakRef.current = 0;
        setStreak(0);
        setTimedOut(true);
      }
    }, timerSeconds * 1000);
    return () => clearTimeout(t);
  }, [phase, timerKey, timerSeconds]);

  // Auto-advance after showing feedback
  useEffect(() => {
    if (!answered) return;
    const t = setTimeout(() => {
      const nextIdx = currentIdx + 1;
      if (nextIdx >= questions.length) {
        recordSession({
          gameId: "ce-matching",
          gameName: "CE Matching",
          mentorId: config.id,
          timestamp: Date.now(),
          durationMs: Date.now() - startTimeRef.current,
          score: scoreRef.current,
          accuracy: questions.length > 0 ? correctRef.current / questions.length : undefined,
        });
        setPhase("ended");
      } else {
        setCurrentIdx(nextIdx);
        setSelectedOption(null);
        setIsCorrect(null);
        setSpeedBonus(false);
        setTimedOut(false);
        setTimerPct(100);
        setTimerKey((k) => k + 1);
        questionStartRef.current = Date.now();
        answeredRef.current = false;
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [answered, currentIdx, questions.length, config.id]);

  function handleSelect(option: string) {
    if (answeredRef.current || phase !== "playing") return;
    answeredRef.current = true;

    const q = questions[currentIdx];
    const correct = option === q.correctCE;
    const elapsed = Date.now() - questionStartRef.current;
    const fast = elapsed < SPEED_BONUS_MS;

    if (correct) {
      const streakBonus = Math.floor(streakRef.current / 3) * STREAK_BONUS_PTS;
      const pts = BASE_PTS + (fast ? SPEED_BONUS_PTS : 0) + streakBonus;
      scoreRef.current += pts;
      correctRef.current += 1;
      streakRef.current += 1;
      if (streakRef.current > maxStreakRef.current) {
        maxStreakRef.current = streakRef.current;
        setMaxStreak(maxStreakRef.current);
      }
      setSpeedBonus(fast);
    } else {
      scoreRef.current = Math.max(0, scoreRef.current - 25);
      streakRef.current = 0;
    }

    setScore(scoreRef.current);
    setStreak(streakRef.current);
    setCorrectCount(correctRef.current);
    setIsCorrect(correct);
    setSelectedOption(option);
  }

  function startGame() {
    if (!pairings?.length) return;
    const qs = buildQuestions(pairings, difficulty);
    setQuestions(qs);
    setCurrentIdx(0);
    setScore(0);
    setStreak(0);
    setMaxStreak(0);
    setCorrectCount(0);
    setSelectedOption(null);
    setIsCorrect(null);
    setSpeedBonus(false);
    setTimedOut(false);
    setTimerPct(100);
    setTimerKey(0);
    scoreRef.current = 0;
    streakRef.current = 0;
    maxStreakRef.current = 0;
    correctRef.current = 0;
    startTimeRef.current = Date.now();
    questionStartRef.current = Date.now();
    answeredRef.current = false;
    setPhase("playing");
  }

  // ── No data state ──────────────────────────────────────────────────────────
  if (!pairings?.length) {
    return (
      <div className="text-center p-8 max-w-sm">
        <div className="text-4xl mb-3">🎯</div>
        <p className="font-bold text-lg text-foreground mb-2">No CE Pairing Data</p>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          This mentor hasn&apos;t set up CE Matching content yet.
        </p>
      </div>
    );
  }

  // ── Start screen ───────────────────────────────────────────────────────────
  if (phase === "start") {
    const diffDescriptions: Record<Difficulty, string> = {
      easy: "2 answer choices — no timer",
      normal: "4 answer choices — no timer (speed bonus if under 3s)",
      hard: "5 answer choices — 3s timer",
    };

    return (
      <div className="flex flex-col items-center gap-8 text-center max-w-sm w-full">
        <div>
          <div className="text-5xl mb-3">🎯</div>
          <h1 className="text-4xl font-black uppercase tracking-wide text-foreground mb-3">
            CE Matching
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
            Match each GB number to its{" "}
            <span className="font-semibold text-foreground">Close Extension</span>.
            Answer in under 3 seconds for a speed bonus!
          </p>
        </div>

        <div className="flex flex-col items-center gap-3 w-full">
          <p
            className="text-[10px] font-mono uppercase tracking-widest"
            style={{ color: "var(--muted)" }}
          >
            Difficulty
          </p>
          <div className="flex gap-2">
            {(["easy", "normal", "hard"] as Difficulty[]).map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className="px-4 py-2 rounded-lg text-sm font-bold border transition-all capitalize"
                style={
                  difficulty === d
                    ? { background: "var(--purple)", borderColor: "var(--purple)", color: "#fff" }
                    : {
                        background: "var(--bg2)",
                        borderColor: "var(--border2)",
                        color: "var(--muted)",
                      }
                }
              >
                {d}
              </button>
            ))}
          </div>
          <p className="text-[11px] font-mono" style={{ color: "var(--muted)" }}>
            {diffDescriptions[difficulty]}
          </p>
        </div>

        <div
          className="rounded-xl border p-4 text-left w-full"
          style={{ background: "var(--bg2)", borderColor: "var(--border)" }}
        >
          <div
            className="flex justify-between text-xs font-mono mb-1"
            style={{ color: "var(--muted)" }}
          >
            <span>CORRECT ANSWER</span>
            <span>BASE PTS</span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-foreground font-bold">Per question</span>
            <span className="font-black font-mono" style={{ color: "var(--purple)" }}>
              +{BASE_PTS}
            </span>
          </div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm" style={{ color: "var(--muted)" }}>
              Speed bonus (under 3s)
            </span>
            <span
              className="font-black font-mono text-sm"
              style={{ color: "var(--amber)" }}
            >
              +{SPEED_BONUS_PTS}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm" style={{ color: "var(--muted)" }}>
              Streak bonus (per 3 in a row)
            </span>
            <span
              className="font-black font-mono text-sm"
              style={{ color: "var(--green)" }}
            >
              +{STREAK_BONUS_PTS}
            </span>
          </div>
        </div>

        <button
          onClick={startGame}
          className="px-10 py-3.5 rounded-xl font-bold text-base uppercase tracking-wide hover:opacity-90 transition-opacity"
          style={{ background: "var(--purple)", color: "#fff" }}
        >
          Start Game
        </button>
      </div>
    );
  }

  // ── End screen ─────────────────────────────────────────────────────────────
  if (phase === "ended") {
    const accuracy =
      questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
    return (
      <div className="flex flex-col items-center gap-6 text-center">
        <h1 className="text-4xl font-black uppercase tracking-wide text-foreground">
          Round Complete!
        </h1>
        <div
          className="rounded-2xl border p-8 flex flex-col items-center gap-6 min-w-[280px]"
          style={{ background: "var(--bg2)", borderColor: "var(--border)" }}
        >
          <div>
            <div
              className="text-[10px] font-mono uppercase tracking-widest mb-1"
              style={{ color: "var(--muted)" }}
            >
              Final Score
            </div>
            <div className="text-6xl font-black font-mono text-foreground">{score}</div>
          </div>
          <div className="flex gap-8">
            <div className="text-center">
              <div
                className="text-[10px] font-mono uppercase tracking-widest mb-1"
                style={{ color: "var(--muted)" }}
              >
                Accuracy
              </div>
              <div
                className="text-2xl font-black"
                style={{
                  color:
                    accuracy >= 80
                      ? "var(--green)"
                      : accuracy >= 60
                      ? "var(--amber)"
                      : "var(--red)",
                }}
              >
                {accuracy}%
              </div>
            </div>
            <div className="text-center">
              <div
                className="text-[10px] font-mono uppercase tracking-widest mb-1"
                style={{ color: "var(--muted)" }}
              >
                Correct
              </div>
              <div className="text-2xl font-black text-foreground">
                {correctCount}/{questions.length}
              </div>
            </div>
            <div className="text-center">
              <div
                className="text-[10px] font-mono uppercase tracking-widest mb-1"
                style={{ color: "var(--muted)" }}
              >
                Best Streak
              </div>
              <div
                className="text-2xl font-black"
                style={{ color: "var(--purple)" }}
              >
                {maxStreak}
              </div>
            </div>
          </div>
        </div>
        <button
          onClick={startGame}
          className="px-10 py-3.5 rounded-xl font-bold text-base uppercase tracking-wide hover:opacity-90 transition-opacity"
          style={{ background: "var(--purple)", color: "#fff" }}
        >
          Play Again
        </button>
      </div>
    );
  }

  // ── Playing screen ─────────────────────────────────────────────────────────
  const currentQ = questions[currentIdx];
  const numCols = currentQ.options.length === 5 ? 5 : 2;

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-sm">
      {/* HUD */}
      <div className="flex items-center gap-3 w-full justify-between">
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 border"
          style={{ background: "var(--bg2)", borderColor: "var(--border)" }}
        >
          <span
            className="text-[10px] font-mono uppercase tracking-widest"
            style={{ color: "var(--muted)" }}
          >
            Q
          </span>
          <span className="font-black font-mono text-foreground text-sm">
            {currentIdx + 1}/{questions.length}
          </span>
        </div>
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 border"
          style={{ background: "var(--bg2)", borderColor: "var(--border)" }}
        >
          <span
            className="text-[10px] font-mono uppercase tracking-widest"
            style={{ color: "var(--muted)" }}
          >
            Score
          </span>
          <span className="font-black font-mono text-foreground text-sm">{score}</span>
        </div>
        {streak > 1 && (
          <div
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 border"
            style={{
              background: "rgba(168,85,247,0.1)",
              borderColor: "rgba(168,85,247,0.3)",
            }}
          >
            <span
              className="text-[10px] font-mono uppercase tracking-widest"
              style={{ color: "var(--purple)" }}
            >
              🔥 {streak}
            </span>
          </div>
        )}
      </div>

      {/* Timer bar — hard mode only */}
      {timerSeconds !== null && (
        <div
          className="w-full h-1.5 rounded-full overflow-hidden border"
          style={{ background: "var(--bg3)", borderColor: "var(--border)" }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${timerPct}%`,
              background:
                timerPct > 60
                  ? "var(--purple)"
                  : timerPct > 30
                  ? "var(--amber)"
                  : "var(--red)",
              transition: "width 50ms linear, background 300ms ease",
            }}
          />
        </div>
      )}

      {/* Question card */}
      <div
        className="w-full rounded-2xl border p-8 flex flex-col items-center gap-3"
        style={{ background: "var(--bg2)", borderColor: "var(--border)" }}
      >
        <div
          className="text-[10px] font-mono uppercase tracking-widest"
          style={{ color: "var(--muted)" }}
        >
          Match the CE for:
        </div>
        <div
          className="font-black font-mono leading-none"
          style={{
            fontSize: "clamp(64px, 16vw, 96px)",
            color: "var(--foreground)",
            letterSpacing: "-0.04em",
          }}
        >
          :{currentQ.gbNumber}
        </div>

        {/* Feedback line */}
        {answered && (
          <div
            className="text-sm font-mono text-center"
            style={{
              color: timedOut ? "var(--red)" : isCorrect ? "var(--green)" : "var(--red)",
            }}
          >
            {timedOut ? (
              <>
                Time&apos;s up! Correct answer is :{currentQ.correctCE}
                {currentQ.explanation && (
                  <span
                    className="block text-xs mt-1"
                    style={{ color: "var(--muted)" }}
                  >
                    {currentQ.explanation}
                  </span>
                )}
              </>
            ) : isCorrect ? (
              <>
                ✓ Correct
                {speedBonus && (
                  <span style={{ color: "var(--amber)" }}> +{SPEED_BONUS_PTS} speed bonus!</span>
                )}
                {currentQ.explanation && (
                  <span
                    className="block text-xs mt-1"
                    style={{ color: "var(--muted)" }}
                  >
                    {currentQ.explanation}
                  </span>
                )}
              </>
            ) : (
              <>
                ✗ Wrong — correct answer is :{currentQ.correctCE}
                {currentQ.explanation && (
                  <span
                    className="block text-xs mt-1"
                    style={{ color: "var(--muted)" }}
                  >
                    {currentQ.explanation}
                  </span>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Option buttons */}
      <div
        className="grid gap-3 w-full"
        style={{ gridTemplateColumns: `repeat(${numCols}, minmax(0, 1fr))` }}
      >
        {currentQ.options.map((opt) => {
          let state: "default" | "correct" | "wrong" | "dimmed" = "default";
          if (answered) {
            if (opt === currentQ.correctCE) state = "correct";
            else if (opt === selectedOption) state = "wrong";
            else state = "dimmed";
          }

          return (
            <button
              key={opt}
              onClick={() => handleSelect(opt)}
              disabled={answered}
              className="py-5 rounded-xl border font-black font-mono transition-all duration-200 disabled:cursor-not-allowed"
              style={{
                fontSize:
                  numCols === 5 ? "clamp(18px, 4vw, 28px)" : "clamp(28px, 7vw, 40px)",
                letterSpacing: "-0.04em",
                background:
                  state === "correct"
                    ? "rgba(34,197,94,0.15)"
                    : state === "wrong"
                    ? "rgba(244,63,94,0.15)"
                    : state === "dimmed"
                    ? "rgba(255,255,255,0.01)"
                    : "var(--bg3)",
                borderColor:
                  state === "correct"
                    ? "rgba(34,197,94,0.5)"
                    : state === "wrong"
                    ? "rgba(244,63,94,0.5)"
                    : state === "dimmed"
                    ? "var(--border)"
                    : "var(--border2)",
                color:
                  state === "correct"
                    ? "var(--green)"
                    : state === "wrong"
                    ? "var(--red)"
                    : state === "dimmed"
                    ? "var(--muted)"
                    : "var(--foreground)",
                transform: state === "correct" ? "scale(1.04)" : "scale(1)",
              }}
            >
              :{opt}
              {state === "correct" && <span className="text-base ml-1">✓</span>}
              {state === "wrong" && <span className="text-base ml-1">✗</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
