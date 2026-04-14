"use client";

import { useState, useEffect, useRef } from "react";
import { MentorConfig } from "@/lib/types";
import { recordSession } from "@/lib/stats";

type Difficulty = "easy" | "normal" | "hard";
type GamePhase = "start" | "playing" | "ended";

interface ClockwisePath {
  from: string;
  fromCE?: string;
  to: string[];
  toCEs?: string[];
  note?: string;
}

interface Question {
  displayInput: string;       // e.g. ":29" or ":35" (CE variant)
  correctAnswers: string[];   // all valid targets (primary + CE variants depending on difficulty)
  allOptions: string[];       // the answer buttons shown
  note?: string;
  sourceFrom: string;         // the raw "from" value for distractor logic
}

const TOTAL_QUESTIONS = 10;
const GAME_COLOR = "#22d3ee";

const TIMER_BY_DIFF: Record<Difficulty, number> = {
  easy: 8,
  normal: 5,
  hard: 3,
};

const CHOICES_BY_DIFF: Record<Difficulty, number> = {
  easy: 4,
  normal: 4,
  hard: 5,
};

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

/**
 * Collect all candidate distractor numbers from the full path list.
 * We pull from all "to" values and "toCEs" values in the entire dataset.
 */
function allCandidates(paths: ClockwisePath[], includeCEs: boolean): string[] {
  const set = new Set<string>();
  for (const p of paths) {
    p.to.forEach((t) => set.add(t));
    if (includeCEs && p.toCEs) p.toCEs.forEach((t) => set.add(t));
  }
  return Array.from(set);
}

function buildQuestions(paths: ClockwisePath[], diff: Difficulty): Question[] {
  if (!paths.length) return [];

  const numChoices = CHOICES_BY_DIFF[diff];
  const candidatePool = allCandidates(paths, diff !== "easy");

  // Build an expanded pool of (path, inputVariant) pairs
  type Entry = { path: ClockwisePath; displayInput: string; useCEFrom: boolean };
  const entries: Entry[] = [];

  for (const path of paths) {
    entries.push({ path, displayInput: path.from, useCEFrom: false });
    if (diff !== "easy" && path.fromCE) {
      entries.push({ path, displayInput: path.fromCE, useCEFrom: true });
    }
  }

  if (!entries.length) return [];

  const shuffledEntries = shuffle(entries);
  const pool: Entry[] = [];
  while (pool.length < TOTAL_QUESTIONS) {
    pool.push(...shuffle(shuffledEntries));
  }
  const selected = pool.slice(0, TOTAL_QUESTIONS);

  return selected.map(({ path, displayInput }) => {
    // Determine correct answers
    const correctAnswers: string[] = [...path.to];
    if (diff === "hard" && path.toCEs) {
      path.toCEs.forEach((ce) => correctAnswers.push(ce));
    }

    // Build distractor set — all candidates minus the correct answers
    const distractors = candidatePool.filter((c) => !correctAnswers.includes(c));
    const shuffledDistractors = shuffle(distractors);

    // We need (numChoices - 1) distractors, but at minimum show 1 correct answer
    // If multiple correct answers exist, randomly pick one to "anchor" in options
    // plus fill remaining slots with distractors
    const anchorCorrect = shuffle(correctAnswers)[0];

    // How many more slots do we have after anchoring one correct?
    const numDistractors = Math.min(numChoices - 1, shuffledDistractors.length);
    const chosenDistractors = shuffledDistractors.slice(0, numDistractors);

    // Pad if we don't have enough distractors
    const paddedDistractors = [...chosenDistractors];
    let padNum = 10;
    while (paddedDistractors.length < numChoices - 1) {
      const candidate = String(padNum).padStart(2, "0");
      if (!correctAnswers.includes(candidate) && !paddedDistractors.includes(candidate)) {
        paddedDistractors.push(candidate);
      }
      padNum++;
    }

    const allOptions = shuffle([anchorCorrect, ...paddedDistractors]);

    return {
      displayInput,
      correctAnswers,
      allOptions,
      note: path.note,
      sourceFrom: path.from,
    };
  });
}

export default function ClockwiseGame({ config }: { config: MentorConfig }) {
  const [phase, setPhase] = useState<GamePhase>("start");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [timerPct, setTimerPct] = useState(100);
  const [timerKey, setTimerKey] = useState(0);

  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const maxStreakRef = useRef(0);
  const correctRef = useRef(0);
  const startTimeRef = useRef(0);
  const answeredRef = useRef(false);

  const paths = config.clockwisePaths;
  const timerSeconds = TIMER_BY_DIFF[difficulty];
  const answered = selectedAnswer !== null || timedOut;

  // Timer visual
  useEffect(() => {
    if (phase !== "playing") return;
    const start = Date.now();
    const iv = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.max(0, ((timerSeconds * 1000 - elapsed) / (timerSeconds * 1000)) * 100);
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
        streakRef.current = 0;
        setStreak(0);
        setTimedOut(true);
      }
    }, timerSeconds * 1000);
    return () => clearTimeout(t);
  }, [phase, timerKey, timerSeconds]);

  // Auto-advance after feedback
  useEffect(() => {
    if (!answered) return;
    const t = setTimeout(() => {
      const nextIdx = currentIdx + 1;
      if (nextIdx >= questions.length) {
        recordSession({
          gameId: "clockwise",
          gameName: "Clockwise",
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
        setIsCorrect(null);
        setTimedOut(false);
        setTimerPct(100);
        setTimerKey((k) => k + 1);
        answeredRef.current = false;
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [answered, currentIdx, questions.length, config.id]);

  function handleSelect(option: string) {
    if (answeredRef.current || phase !== "playing") return;
    answeredRef.current = true;

    const q = questions[currentIdx];
    const correct = q.correctAnswers.includes(option);

    if (correct) {
      const streakBonus = Math.floor(streakRef.current / 3) * 25;
      scoreRef.current += 100 + streakBonus;
      correctRef.current += 1;
      streakRef.current += 1;
      if (streakRef.current > maxStreakRef.current) {
        maxStreakRef.current = streakRef.current;
        setMaxStreak(maxStreakRef.current);
      }
    } else {
      scoreRef.current = Math.max(0, scoreRef.current - 25);
      streakRef.current = 0;
    }

    setScore(scoreRef.current);
    setStreak(streakRef.current);
    setCorrectCount(correctRef.current);
    setIsCorrect(correct);
    setSelectedAnswer(option);
  }

  function startGame() {
    if (!paths?.length) return;
    const qs = buildQuestions(paths, difficulty);
    setQuestions(qs);
    setCurrentIdx(0);
    setScore(0);
    setStreak(0);
    setMaxStreak(0);
    setCorrectCount(0);
    setSelectedAnswer(null);
    setIsCorrect(null);
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
  if (!paths?.length) {
    return (
      <div className="text-center p-8 max-w-sm">
        <div className="text-4xl mb-3">🕐</div>
        <p className="font-bold text-lg text-foreground mb-2">No Clockwise Data</p>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          This mentor hasn&apos;t set up Clockwise path content yet.
        </p>
      </div>
    );
  }

  // ── Start screen ───────────────────────────────────────────────────────────
  if (phase === "start") {
    const diffDescriptions: Record<Difficulty, string> = {
      easy: `Primary numbers only — ${TIMER_BY_DIFF.easy}s per question, ${CHOICES_BY_DIFF.easy} choices`,
      normal: `Includes CE variants as inputs — ${TIMER_BY_DIFF.normal}s per question, ${CHOICES_BY_DIFF.normal} choices`,
      hard: `All variants + CE targets as distractors — ${TIMER_BY_DIFF.hard}s per question, ${CHOICES_BY_DIFF.hard} choices`,
    };

    return (
      <div className="flex flex-col items-center gap-8 text-center max-w-sm w-full">
        <div>
          <div className="text-5xl mb-3">🕐</div>
          <h1
            className="text-4xl font-black uppercase tracking-wide mb-3"
            style={{ color: "var(--foreground)" }}
          >
            Clockwise
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
            You&apos;ll be shown a minute value. Pick{" "}
            <span className="font-semibold" style={{ color: GAME_COLOR }}>
              what comes next
            </span>{" "}
            in the clockwise algo path.
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
                    ? { background: GAME_COLOR, borderColor: GAME_COLOR, color: "#000" }
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
            className="text-[10px] font-mono uppercase tracking-widest mb-2"
            style={{ color: "var(--muted)" }}
          >
            Scoring
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-sm">
              <span style={{ color: "var(--foreground)" }}>Correct answer</span>
              <span className="font-black font-mono" style={{ color: "var(--green)" }}>
                +100 pts
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: "var(--muted)" }}>Streak bonus (per 3 in a row)</span>
              <span className="font-black font-mono text-sm" style={{ color: GAME_COLOR }}>
                +25 pts
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: "var(--muted)" }}>Wrong answer</span>
              <span className="font-black font-mono text-sm" style={{ color: "var(--red)" }}>
                −25 pts
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={startGame}
          className="px-10 py-3.5 rounded-xl font-bold text-base uppercase tracking-wide hover:opacity-90 transition-opacity"
          style={{ background: GAME_COLOR, color: "#000" }}
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
                style={{ color: GAME_COLOR }}
              >
                {maxStreak}
              </div>
            </div>
          </div>
        </div>
        <button
          onClick={startGame}
          className="px-10 py-3.5 rounded-xl font-bold text-base uppercase tracking-wide hover:opacity-90 transition-opacity"
          style={{ background: GAME_COLOR, color: "#000" }}
        >
          Play Again
        </button>
      </div>
    );
  }

  // ── Playing screen ─────────────────────────────────────────────────────────
  const currentQ = questions[currentIdx];

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-sm">
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
              background: `${GAME_COLOR}15`,
              borderColor: `${GAME_COLOR}40`,
            }}
          >
            <span
              className="text-[10px] font-mono uppercase tracking-widest"
              style={{ color: GAME_COLOR }}
            >
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
                ? GAME_COLOR
                : timerPct > 30
                ? "var(--amber)"
                : "var(--red)",
            transition: "width 50ms linear, background 300ms ease",
          }}
        />
      </div>

      {/* Question card */}
      <div
        className="w-full rounded-2xl border p-8 flex flex-col items-center gap-3"
        style={{ background: "var(--bg2)", borderColor: "var(--border)" }}
      >
        <div
          className="text-[10px] font-mono uppercase tracking-widest"
          style={{ color: "var(--muted)" }}
        >
          If price is at, what&apos;s next?
        </div>
        <div
          className="font-black font-mono leading-none"
          style={{
            fontSize: "clamp(64px, 16vw, 96px)",
            color: "var(--foreground)",
            letterSpacing: "-0.04em",
          }}
        >
          :{currentQ.displayInput}
        </div>

        {/* Post-answer feedback */}
        {answered && (
          <div
            className="text-sm font-mono text-center"
            style={{ color: timedOut ? "var(--red)" : isCorrect ? "var(--green)" : "var(--red)" }}
          >
            {timedOut ? (
              <>
                Time&apos;s up! Next:{" "}
                <span className="font-bold">
                  {currentQ.correctAnswers.map((a) => `:${a}`).join(" or ")}
                </span>
              </>
            ) : isCorrect ? (
              <>✓ Correct!</>
            ) : (
              <>
                ✗ Wrong — next is{" "}
                <span className="font-bold">
                  {currentQ.correctAnswers.map((a) => `:${a}`).join(" or ")}
                </span>
              </>
            )}
            {currentQ.note && (
              <span
                className="block text-xs mt-1"
                style={{ color: "var(--muted)" }}
              >
                {currentQ.note}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Answer buttons */}
      <div
        className={`grid gap-3 w-full ${
          currentQ.allOptions.length === 5 ? "grid-cols-5" : "grid-cols-2"
        }`}
      >
        {currentQ.allOptions.map((opt) => {
          let state: "default" | "correct" | "wrong" | "dimmed" = "default";
          if (answered) {
            if (currentQ.correctAnswers.includes(opt)) state = "correct";
            else if (opt === selectedAnswer) state = "wrong";
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
                  currentQ.allOptions.length === 5
                    ? "clamp(18px, 4vw, 28px)"
                    : "clamp(28px, 7vw, 40px)",
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
