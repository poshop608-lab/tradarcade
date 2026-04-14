"use client";

import { useState, useEffect, useRef } from "react";
import { MentorConfig } from "@/lib/types";
import { recordSession } from "@/lib/stats";

type Difficulty = "easy" | "normal" | "hard";
type Category = "gb" | "ce" | "neither";
type GamePhase = "start" | "playing" | "ended";

interface QuizItem {
  value: string;
  category: Category;
  hint?: string;
}

const TOTAL_QUESTIONS = 20;
const TIMER_SECONDS = 5;

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

function buildQuestions(items: QuizItem[], diff: Difficulty): QuizItem[] {
  let pool: QuizItem[];
  if (diff === "easy") pool = items.filter((i) => i.category === "gb");
  else if (diff === "normal") pool = items.filter((i) => i.category !== "neither");
  else pool = [...items];

  if (!pool.length) return [];

  const result: QuizItem[] = [];
  while (result.length < TOTAL_QUESTIONS) result.push(...shuffle(pool));
  return result.slice(0, TOTAL_QUESTIONS);
}

const CATEGORY_LABELS: Record<Category, string> = {
  gb: "GB NUMBER",
  ce: "CE NUMBER",
  neither: "NEITHER",
};

const CATEGORY_COLORS: Record<Category, string> = {
  gb: "#22d3ee",
  ce: "#a855f7",
  neither: "#f59e0b",
};

export default function GBNumberQuizGame({ config }: { config: MentorConfig }) {
  const [phase, setPhase] = useState<GamePhase>("start");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [questions, setQuestions] = useState<QuizItem[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<Category | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [timerPct, setTimerPct] = useState(100);
  // timerKey increments per question to restart timer effects
  const [timerKey, setTimerKey] = useState(0);

  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const maxStreakRef = useRef(0);
  const correctRef = useRef(0);
  const startTimeRef = useRef(0);
  const answeredRef = useRef(false);

  const items = config.gbQuizItems;
  const answered = selectedAnswer !== null || timedOut;

  // Timer visual — resets when timerKey changes
  useEffect(() => {
    if (phase !== "playing") return;
    const start = Date.now();
    const iv = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.max(0, ((TIMER_SECONDS * 1000 - elapsed) / (TIMER_SECONDS * 1000)) * 100);
      setTimerPct(pct);
    }, 50);
    return () => clearInterval(iv);
  }, [phase, timerKey]);

  // Auto-timeout after TIMER_SECONDS — resets when timerKey changes
  useEffect(() => {
    if (phase !== "playing") return;
    const t = setTimeout(() => {
      if (!answeredRef.current) {
        answeredRef.current = true;
        streakRef.current = 0;
        setStreak(0);
        setTimedOut(true);
      }
    }, TIMER_SECONDS * 1000);
    return () => clearTimeout(t);
  }, [phase, timerKey]);

  // Auto-advance after feedback
  useEffect(() => {
    if (!answered) return;
    const t = setTimeout(() => {
      const nextIdx = currentIdx + 1;
      if (nextIdx >= questions.length) {
        recordSession({
          gameId: "gb-number-quiz",
          gameName: "GB Number Quiz",
          mentorId: config.id,
          timestamp: Date.now(),
          durationMs: Date.now() - startTimeRef.current,
          score: scoreRef.current,
          accuracy: correctRef.current / TOTAL_QUESTIONS,
        });
        setPhase("ended");
      } else {
        setCurrentIdx(nextIdx);
        setSelectedAnswer(null);
        setTimedOut(false);
        setTimerPct(100);
        setTimerKey((k) => k + 1);
        answeredRef.current = false;
      }
    }, 900);
    return () => clearTimeout(t);
  }, [answered, currentIdx, questions.length, config.id]);

  function handleAnswer(answer: Category) {
    if (answeredRef.current || phase !== "playing") return;
    answeredRef.current = true;

    const q = questions[currentIdx];
    const correct = answer === q.category;

    if (correct) {
      const bonus = Math.floor(streakRef.current / 3) * 5; // +5 every 3 correct
      scoreRef.current += 10 + bonus;
      correctRef.current += 1;
      streakRef.current += 1;
      if (streakRef.current > maxStreakRef.current) {
        maxStreakRef.current = streakRef.current;
        setMaxStreak(maxStreakRef.current);
      }
    } else {
      scoreRef.current = Math.max(0, scoreRef.current - 5);
      streakRef.current = 0;
    }

    setScore(scoreRef.current);
    setStreak(streakRef.current);
    setCorrectCount(correctRef.current);
    setSelectedAnswer(answer);
  }

  function startGame() {
    if (!items?.length) return;
    const qs = buildQuestions(items as QuizItem[], difficulty);
    setQuestions(qs);
    setCurrentIdx(0);
    setScore(0);
    setStreak(0);
    setMaxStreak(0);
    setCorrectCount(0);
    setSelectedAnswer(null);
    setTimedOut(false);
    setTimerPct(100);
    setTimerKey(0);
    scoreRef.current = 0;
    streakRef.current = 0;
    maxStreakRef.current = 0;
    correctRef.current = 0;
    startTimeRef.current = Date.now();
    answeredRef.current = false;
    setPhase("playing");
  }

  // ── No data state ──────────────────────────────────────────────────────────
  if (!items?.length) {
    return (
      <div className="text-center p-8 max-w-sm">
        <div className="text-4xl mb-3">🔢</div>
        <p className="font-bold text-lg text-foreground mb-2">No Quiz Data</p>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          This mentor hasn&apos;t set up GB Number Quiz content yet.
        </p>
      </div>
    );
  }

  // ── Start screen ───────────────────────────────────────────────────────────
  if (phase === "start") {
    return (
      <div className="flex flex-col items-center gap-8 text-center max-w-sm w-full">
        <div>
          <div className="text-5xl mb-3">🔢</div>
          <h1 className="text-4xl font-black uppercase tracking-wide text-foreground mb-3">
            GB Number Quiz
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
            Classify each minute value as a{" "}
            <span className="font-semibold text-foreground">GB number</span>,{" "}
            <span className="font-semibold text-foreground">CE extension</span>, or{" "}
            <span className="font-semibold text-foreground">neither</span>.
            You have {TIMER_SECONDS}s per question.
          </p>
        </div>

        <div className="flex flex-col items-center gap-3 w-full">
          <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--muted)" }}>
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
                    ? { background: "var(--accent)", borderColor: "var(--accent)", color: "#000" }
                    : { background: "var(--bg2)", borderColor: "var(--border2)", color: "var(--muted)" }
                }
              >
                {d}
              </button>
            ))}
          </div>
          <p className="text-[11px] font-mono" style={{ color: "var(--text3)" }}>
            {difficulty === "easy" && "Primary GB numbers only"}
            {difficulty === "normal" && "GB numbers + CE extensions"}
            {difficulty === "hard" && "All numbers including traps"}
          </p>
        </div>

        <button
          onClick={startGame}
          className="px-10 py-3.5 rounded-xl font-bold text-base uppercase tracking-wide hover:opacity-90 transition-opacity"
          style={{ background: "var(--accent)", color: "#000" }}
        >
          Start Quiz
        </button>
      </div>
    );
  }

  // ── End screen ─────────────────────────────────────────────────────────────
  if (phase === "ended") {
    const accuracy = Math.round((correctCount / TOTAL_QUESTIONS) * 100);
    return (
      <div className="flex flex-col items-center gap-6 text-center">
        <h1 className="text-4xl font-black uppercase tracking-wide text-foreground">
          Quiz Complete!
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
                style={{ color: accuracy >= 80 ? "var(--green)" : accuracy >= 60 ? "var(--amber)" : "var(--red)" }}
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
              <div className="text-2xl font-black text-foreground">{correctCount}/{TOTAL_QUESTIONS}</div>
            </div>
            <div className="text-center">
              <div
                className="text-[10px] font-mono uppercase tracking-widest mb-1"
                style={{ color: "var(--muted)" }}
              >
                Best Streak
              </div>
              <div className="text-2xl font-black" style={{ color: "var(--accent)" }}>
                {maxStreak}
              </div>
            </div>
          </div>
        </div>
        <button
          onClick={startGame}
          className="px-10 py-3.5 rounded-xl font-bold text-base uppercase tracking-wide hover:opacity-90 transition-opacity"
          style={{ background: "var(--accent)", color: "#000" }}
        >
          Play Again
        </button>
      </div>
    );
  }

  // ── Playing screen ─────────────────────────────────────────────────────────
  const currentQuestion = questions[currentIdx];
  const correctCategory = currentQuestion.category;

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-sm">
      {/* HUD */}
      <div className="flex items-center gap-3 w-full justify-between">
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 border"
          style={{ background: "var(--bg2)", borderColor: "var(--border)" }}
        >
          <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--muted)" }}>
            Q
          </span>
          <span className="font-black font-mono text-foreground text-sm">
            {currentIdx + 1}/{TOTAL_QUESTIONS}
          </span>
        </div>

        <div
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 border"
          style={{ background: "var(--bg2)", borderColor: "var(--border)" }}
        >
          <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--muted)" }}>
            Score
          </span>
          <span className="font-black font-mono text-foreground text-sm">{score}</span>
        </div>

        {streak > 1 && (
          <div
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 border"
            style={{
              background: "var(--accent-dim)",
              borderColor: "var(--accent-border)",
            }}
          >
            <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--accent)" }}>
              🔥 {streak}
            </span>
          </div>
        )}
      </div>

      {/* Timer bar */}
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
                ? "var(--accent)"
                : timerPct > 30
                ? "var(--amber)"
                : "var(--red)",
            transition: "width 50ms linear, background 300ms ease",
          }}
        />
      </div>

      {/* Question card */}
      <div
        className="w-full rounded-2xl border p-8 flex flex-col items-center gap-2"
        style={{ background: "var(--bg2)", borderColor: "var(--border)" }}
      >
        <div
          className="text-[10px] font-mono uppercase tracking-widest"
          style={{ color: "var(--muted)" }}
        >
          Classify this minute value
        </div>
        <div
          className="font-black font-mono leading-none"
          style={{
            fontSize: "clamp(72px, 18vw, 104px)",
            color: "var(--foreground)",
            letterSpacing: "-0.04em",
          }}
        >
          :{currentQuestion.value}
        </div>
        {answered && currentQuestion.hint && (
          <div
            className="text-xs font-mono text-center mt-1"
            style={{ color: "var(--muted)" }}
          >
            {currentQuestion.hint}
          </div>
        )}
        {timedOut && (
          <div className="text-xs font-mono mt-2" style={{ color: "var(--red)" }}>
            Time&apos;s up! Correct:{" "}
            <span className="font-bold">{CATEGORY_LABELS[correctCategory]}</span>
          </div>
        )}
      </div>

      {/* Answer buttons */}
      <div className="grid grid-cols-3 gap-3 w-full">
        {(["gb", "ce", "neither"] as Category[]).map((cat) => {
          let state: "default" | "correct" | "wrong" | "dimmed" = "default";
          if (answered) {
            if (cat === correctCategory) state = "correct";
            else if (cat === selectedAnswer) state = "wrong";
            else state = "dimmed";
          }

          const baseColor = CATEGORY_COLORS[cat];

          return (
            <button
              key={cat}
              onClick={() => handleAnswer(cat)}
              disabled={answered}
              className="py-4 rounded-xl font-bold text-xs uppercase tracking-widest border transition-all duration-200 disabled:cursor-not-allowed"
              style={{
                background:
                  state === "correct"
                    ? "rgba(34,197,94,0.15)"
                    : state === "wrong"
                    ? "rgba(244,63,94,0.15)"
                    : state === "dimmed"
                    ? "rgba(255,255,255,0.01)"
                    : `${baseColor}10`,
                borderColor:
                  state === "correct"
                    ? "rgba(34,197,94,0.5)"
                    : state === "wrong"
                    ? "rgba(244,63,94,0.5)"
                    : state === "dimmed"
                    ? "var(--border)"
                    : `${baseColor}35`,
                color:
                  state === "correct"
                    ? "var(--green)"
                    : state === "wrong"
                    ? "var(--red)"
                    : state === "dimmed"
                    ? "var(--text3)"
                    : baseColor,
                transform: state === "correct" ? "scale(1.03)" : "scale(1)",
              }}
            >
              {CATEGORY_LABELS[cat]}
              {state === "correct" && " ✓"}
              {state === "wrong" && " ✗"}
            </button>
          );
        })}
      </div>
    </div>
  );
}
