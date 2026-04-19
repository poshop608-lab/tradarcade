"use client";

import { useState, useEffect, useRef } from "react";
import { MentorConfig } from "@/lib/types";
import { recordSession } from "@/lib/stats";

type Difficulty = "easy" | "medium" | "hard";
type AlgoAnswer = "algo1" | "algo2" | "both";
type GamePhase = "start" | "playing" | "ended";

interface AlgoItem {
  number: string;
  algo: AlgoAnswer;
  note?: string;
}

interface Question {
  item: AlgoItem;
  context?: string; // shown on medium/hard
  displayLabel: string;
}

const TOTAL_QUESTIONS = 15;
const MAX_LIVES = 3;

const TIMER_BY_DIFF: Record<Difficulty, number> = {
  easy: 8,
  medium: 5,
  hard: 3,
};

const ALGO_LABELS: Record<AlgoAnswer, string> = {
  algo1: "ALGO 1",
  algo2: "ALGO 2",
  both: "BOTH",
};

const ALGO_COLORS: Record<AlgoAnswer, string> = {
  algo1: "#22d3ee",
  algo2: "#a855f7",
  both: "#f59e0b",
};

const ALGO_PATHS: Partial<Record<string, string>> = {
  "03": "Reference endpoint — Algo 1 origin, Algo 2 terminal",
  "11": "Shared node — both :03→:11 (A1) and :53→:11 (A2)",
  "17": ":11 → :17 → Algo 1 delivery",
  "29": "Shared anchor — both :29→:41 (A1) and :29→:47 (A2)",
  "41": ":29 → :41 → Algo 1 terminal",
  "47": ":29 → :47 → Algo 2 main delivery",
  "53": ":47 → :53 → Algo 2 CE extension",
  "59": "Shared — Algo 1: :41→:59→:71 | Algo 2: :53→:59→:03",
  "71": "Algo 1 terminal — sequence ends at :71 → CE :77",
};

function buildContext(item: AlgoItem, diff: Difficulty): string | undefined {
  if (diff === "easy") return undefined;

  if (diff === "medium") {
    const contextMap: Record<string, string> = {
      "03": "Price path starts or ends at :03",
      "11": "Price path: :03 → :11 (shared node)",
      "17": "Price path: :11 → :17",
      "29": "Price stopped at :29 — shared anchor for both algos",
      "41": "Price path: :29 → :41",
      "47": "Price path: :29 → :47",
      "53": "Price path: :47 → :53",
      "59": "Price path: :41/:53 → :59 (shared node)",
      "71": "Price path: :59 → :71 — end of sequence",
    };
    return contextMap[item.number];
  }

  // hard: 3-step sequences and tricky framing
  const hardMap: Record<string, string> = {
    "03": "Algo 1 starts at :03. Algo 2 ends at :03. Which algos use this number?",
    "11": ":03 → :11 in Algo 1. :53 → :11 in Algo 2. Which algos pass through :11?",
    "17": ":11 → :17 in Algo 1. Not in Algo 2. Which algo?",
    "29": "Both :29→:41 (A1) and :29→:47 (A2) start here. Which algos use :29?",
    "41": "Full path: :03→:11→:17→:29→:41. Algo?",
    "47": ":29 confirmed, next delivery to :47. CE of which algo?",
    "53": ":47 confirmed, next delivery to :53. CE of which algo?",
    "59": "Algo 1: :41→:59→:71. Algo 2: :53→:59→:03. Which algos pass through :59?",
    "71": "Full Algo 1 path: :03→:11→:17→:29→:41→:59→:71. Algo?",
  };
  return hardMap[item.number] ?? `Price at :${item.number}. Which algo?`;
}

function buildQuestions(items: AlgoItem[], diff: Difficulty): Question[] {
  if (!items.length) return [];

  const shuffled = [...items].sort(() => Math.random() - 0.5);
  const pool: AlgoItem[] = [];

  while (pool.length < TOTAL_QUESTIONS) {
    pool.push(...shuffled.sort(() => Math.random() - 0.5));
  }

  return pool.slice(0, TOTAL_QUESTIONS).map((item) => ({
    item,
    context: buildContext(item, diff),
    displayLabel: `:${item.number}`,
  }));
}

function LivesDisplay({ lives, max }: { lives: number; max: number }) {
  return (
    <div
      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 border"
      style={{ background: "var(--bg2)", borderColor: "var(--border)" }}
    >
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          style={{
            fontSize: "14px",
            opacity: i < lives ? 1 : 0.2,
            filter: i < lives ? "none" : "grayscale(1)",
          }}
        >
          ❤️
        </span>
      ))}
    </div>
  );
}

export default function AlgoSorterGame({ config }: { config: MentorConfig }) {
  const [phase, setPhase] = useState<GamePhase>("start");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [selectedAnswer, setSelectedAnswer] = useState<AlgoAnswer | null>(null);
  const [showNote, setShowNote] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [timerPct, setTimerPct] = useState(100);
  const [timerKey, setTimerKey] = useState(0);
  const [outOfLives, setOutOfLives] = useState(false);

  const scoreRef = useRef(0);
  const correctRef = useRef(0);
  const livesRef = useRef(MAX_LIVES);
  const startTimeRef = useRef(0);
  const answeredRef = useRef(false);

  const items = config.algoItems;
  const timerSeconds = TIMER_BY_DIFF[difficulty];
  const answered = selectedAnswer !== null || timedOut;

  // Timer visual
  useEffect(() => {
    if (phase !== "playing") return;
    const start = Date.now();
    const iv = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.max(
        0,
        ((timerSeconds * 1000 - elapsed) / (timerSeconds * 1000)) * 100
      );
      setTimerPct(pct);
    }, 50);
    return () => clearInterval(iv);
  }, [phase, timerKey, timerSeconds]);

  // Auto-timeout
  useEffect(() => {
    if (phase !== "playing") return;
    const t = setTimeout(() => {
      if (!answeredRef.current) {
        answeredRef.current = true;
        livesRef.current = Math.max(0, livesRef.current - 1);
        setLives(livesRef.current);
        setTimedOut(true);
        setShowNote(true);
      }
    }, timerSeconds * 1000);
    return () => clearTimeout(t);
  }, [phase, timerKey, timerSeconds]);

  // Auto-advance after feedback
  useEffect(() => {
    if (!answered) return;
    const t = setTimeout(() => {
      // Check lives after timeout
      if (livesRef.current <= 0) {
        recordSession({
          gameId: "algo-sorter",
          gameName: "Algo Sorter",
          mentorId: config.id,
          timestamp: Date.now(),
          durationMs: Date.now() - startTimeRef.current,
          score: scoreRef.current,
          accuracy:
            currentIdx > 0 ? correctRef.current / (currentIdx + 1) : undefined,
        });
        setOutOfLives(true);
        setPhase("ended");
        return;
      }

      const nextIdx = currentIdx + 1;
      if (nextIdx >= questions.length) {
        recordSession({
          gameId: "algo-sorter",
          gameName: "Algo Sorter",
          mentorId: config.id,
          timestamp: Date.now(),
          durationMs: Date.now() - startTimeRef.current,
          score: scoreRef.current,
          accuracy: questions.length > 0 ? correctRef.current / questions.length : undefined,
        });
        setPhase("ended");
      } else {
        setCurrentIdx(nextIdx);
        setSelectedAnswer(null);
        setShowNote(false);
        setTimedOut(false);
        setTimerPct(100);
        setTimerKey((k) => k + 1);
        answeredRef.current = false;
      }
    }, 1400);
    return () => clearTimeout(t);
  }, [answered, currentIdx, questions.length, config.id]);

  function handleAnswer(answer: AlgoAnswer) {
    if (answeredRef.current || phase !== "playing") return;
    answeredRef.current = true;

    const q = questions[currentIdx];
    const correct = answer === q.item.algo;

    if (correct) {
      scoreRef.current += 100;
      correctRef.current += 1;
    } else {
      scoreRef.current = Math.max(0, scoreRef.current - 25);
      livesRef.current = Math.max(0, livesRef.current - 1);
      setLives(livesRef.current);
    }

    setScore(scoreRef.current);
    setCorrectCount(correctRef.current);
    setSelectedAnswer(answer);
    setShowNote(true);
  }

  function startGame() {
    if (!items?.length) return;
    const qs = buildQuestions(items as AlgoItem[], difficulty);
    setQuestions(qs);
    setCurrentIdx(0);
    setScore(0);
    setCorrectCount(0);
    setLives(MAX_LIVES);
    setSelectedAnswer(null);
    setShowNote(false);
    setTimedOut(false);
    setTimerPct(100);
    setTimerKey(0);
    setOutOfLives(false);
    scoreRef.current = 0;
    correctRef.current = 0;
    livesRef.current = MAX_LIVES;
    startTimeRef.current = Date.now();
    answeredRef.current = false;
    setPhase("playing");
  }

  // ── No data state ──────────────────────────────────────────────────────────
  if (!items?.length) {
    return (
      <div className="text-center p-8 max-w-sm">
        <div className="text-4xl mb-3">📊</div>
        <p className="font-bold text-lg text-foreground mb-2">No Algo Data</p>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          This mentor hasn&apos;t set up Algo Sorter content yet.
        </p>
      </div>
    );
  }

  // ── Start screen ───────────────────────────────────────────────────────────
  if (phase === "start") {
    return (
      <div className="flex flex-col items-center gap-8 text-center max-w-sm w-full">
        <div>
          <div className="text-5xl mb-3">📊</div>
          <h1 className="text-4xl font-black uppercase tracking-wide text-foreground mb-3">
            Algo Sorter
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
            Classify each minute value into{" "}
            <span className="font-semibold" style={{ color: ALGO_COLORS.algo1 }}>
              Algo 1
            </span>
            ,{" "}
            <span className="font-semibold" style={{ color: ALGO_COLORS.algo2 }}>
              Algo 2
            </span>
            , or{" "}
            <span className="font-semibold" style={{ color: ALGO_COLORS.both }}>
              Both
            </span>
            . You have{" "}
            <span className="font-semibold text-foreground">3 lives</span> — wrong answers or
            timeouts cost a life!
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
            {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className="px-4 py-2 rounded-lg text-sm font-bold border transition-all capitalize"
                style={
                  difficulty === d
                    ? { background: "var(--amber)", borderColor: "var(--amber)", color: "#000" }
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
            {difficulty === "easy" && `Single numbers — ${TIMER_BY_DIFF.easy}s per question`}
            {difficulty === "medium" &&
              `2-step sequences for context — ${TIMER_BY_DIFF.medium}s per question`}
            {difficulty === "hard" &&
              `Trick questions + full sequences — ${TIMER_BY_DIFF.hard}s per question`}
          </p>
        </div>

        <button
          onClick={startGame}
          className="px-10 py-3.5 rounded-xl font-bold text-base uppercase tracking-wide hover:opacity-90 transition-opacity"
          style={{ background: "var(--amber)", color: "#000" }}
        >
          Start Sorting
        </button>
      </div>
    );
  }

  // ── End screen ─────────────────────────────────────────────────────────────
  if (phase === "ended") {
    const questionsAnswered = Math.min(currentIdx + 1, questions.length);
    const accuracy =
      questionsAnswered > 0 ? Math.round((correctCount / questionsAnswered) * 100) : 0;
    return (
      <div className="flex flex-col items-center gap-6 text-center">
        <h1 className="text-4xl font-black uppercase tracking-wide text-foreground">
          {outOfLives ? "Out of Lives!" : "Sort Complete!"}
        </h1>
        {outOfLives && (
          <p className="text-sm" style={{ color: "var(--red)" }}>
            You ran out of lives on question {currentIdx + 1}.
          </p>
        )}
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
                {correctCount}/{questionsAnswered}
              </div>
            </div>
            <div className="text-center">
              <div
                className="text-[10px] font-mono uppercase tracking-widest mb-1"
                style={{ color: "var(--muted)" }}
              >
                Lives Left
              </div>
              <div className="text-2xl font-black" style={{ color: "var(--red)" }}>
                {lives}/{MAX_LIVES}
              </div>
            </div>
          </div>
        </div>
        <button
          onClick={startGame}
          className="px-10 py-3.5 rounded-xl font-bold text-base uppercase tracking-wide hover:opacity-90 transition-opacity"
          style={{ background: "var(--amber)", color: "#000" }}
        >
          Play Again
        </button>
      </div>
    );
  }

  // ── Playing screen ─────────────────────────────────────────────────────────
  const currentQ = questions[currentIdx];
  const correctAnswer = currentQ.item.algo;
  const pathNote = ALGO_PATHS[currentQ.item.number] ?? currentQ.item.note;

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-md">
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
            {currentIdx + 1}/{TOTAL_QUESTIONS}
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
        <LivesDisplay lives={lives} max={MAX_LIVES} />
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
                ? "var(--amber)"
                : timerPct > 30
                ? "var(--amber)"
                : "var(--red)",
            transition: "width 50ms linear, background 300ms ease",
          }}
        />
      </div>

      {/* Question card */}
      <div
        className="w-full rounded-2xl border p-6 flex flex-col items-center gap-3"
        style={{ background: "var(--bg2)", borderColor: "var(--border)" }}
      >
        {currentQ.context ? (
          <>
            <div
              className="text-[10px] font-mono uppercase tracking-widest"
              style={{ color: "var(--muted)" }}
            >
              {difficulty === "medium" ? "Sequence" : "Scenario"}
            </div>
            <div
              className="text-sm font-mono text-center leading-relaxed px-2"
              style={{ color: "var(--foreground)" }}
            >
              {currentQ.context}
            </div>
          </>
        ) : (
          <>
            <div
              className="text-[10px] font-mono uppercase tracking-widest"
              style={{ color: "var(--muted)" }}
            >
              Which algo uses this number?
            </div>
            <div
              className="font-black font-mono leading-none"
              style={{
                fontSize: "clamp(64px, 16vw, 96px)",
                color: "var(--foreground)",
                letterSpacing: "-0.04em",
              }}
            >
              :{currentQ.item.number}
            </div>
          </>
        )}

        {/* Timeout indicator */}
        {timedOut && !selectedAnswer && (
          <div className="text-xs font-mono mt-1" style={{ color: "var(--red)" }}>
            Time&apos;s up! Correct:{" "}
            <span className="font-bold">{ALGO_LABELS[correctAnswer]}</span>
          </div>
        )}

        {/* Post-answer note */}
        {showNote && pathNote && (
          <div
            className="text-xs font-mono text-center mt-1 px-3 py-2 rounded-lg border"
            style={{
              background: "var(--bg3)",
              borderColor: "var(--border)",
              color: "var(--muted)",
            }}
          >
            {pathNote}
          </div>
        )}
      </div>

      {/* Answer buttons */}
      <div className="grid grid-cols-3 gap-3 w-full">
        {(["algo1", "algo2", "both"] as AlgoAnswer[]).map((ans) => {
          let state: "default" | "correct" | "wrong" | "dimmed" = "default";
          if (answered) {
            if (ans === correctAnswer) state = "correct";
            else if (ans === selectedAnswer) state = "wrong";
            else state = "dimmed";
          }

          const baseColor = ALGO_COLORS[ans];

          return (
            <button
              key={ans}
              onClick={() => handleAnswer(ans)}
              disabled={answered}
              className="py-5 rounded-xl font-bold text-sm uppercase tracking-widest border transition-all duration-200 disabled:cursor-not-allowed"
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
                    ? "var(--muted)"
                    : baseColor,
                transform: state === "correct" ? "scale(1.03)" : "scale(1)",
              }}
            >
              {ALGO_LABELS[ans]}
              {state === "correct" && " ✓"}
              {state === "wrong" && " ✗"}
            </button>
          );
        })}
      </div>
    </div>
  );
}
