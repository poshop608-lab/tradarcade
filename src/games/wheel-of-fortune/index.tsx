"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { MentorConfig } from "@/lib/types";
import { recordSession, getSessions } from "@/lib/stats";

const VOWELS = new Set(["A", "E", "I", "O", "U"]);
const CONSONANTS = "BCDFGHJKLMNPQRSTVWXYZ".split("");
const VOWEL_COST = 250;

const WHEEL_SEGMENTS = [
  { label: "100",  value: 100,  color: "#EF4444" },
  { label: "300",  value: 300,  color: "#3B82F6" },
  { label: "500",  value: 500,  color: "#1DB97C" },
  { label: "800",  value: 800,  color: "#F59E0B" },
  { label: "1000", value: 1000, color: "#c084fc" },
  { label: "200",  value: 200,  color: "#3B82F6" },
  { label: "500",  value: 500,  color: "#EF4444" },
  { label: "BANKRUPT", value: -1, color: "#0a0a0a" },
  { label: "300",  value: 300,  color: "#1DB97C" },
  { label: "800",  value: 800,  color: "#F59E0B" },
  { label: "LOSE TURN", value: -2, color: "#141420" },
  { label: "200",  value: 200,  color: "#c084fc" },
  { label: "1000", value: 1000, color: "#EF4444" },
  { label: "100",  value: 100,  color: "#3B82F6" },
  { label: "500",  value: 500,  color: "#1DB97C" },
  { label: "300",  value: 300,  color: "#F59E0B" },
];

const SEGMENT_ANGLE = 360 / WHEEL_SEGMENTS.length;

type GamePhase = "spinning" | "guessing" | "solved" | "idle";

function pickRandomRule(rules: MentorConfig["rules"]): MentorConfig["rules"][number] {
  return rules[Math.floor(Math.random() * rules.length)];
}

export default function WheelOfFortuneGame({ config }: { config: MentorConfig }) {
  const [currentRule, setCurrentRule] = useState(() => pickRandomRule(config.rules));
  const [revealedLetters, setRevealedLetters] = useState<Set<string>>(new Set());
  const [roundScore, setRoundScore] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [phase, setPhase] = useState<GamePhase>("idle");
  const [spinValue, setSpinValue] = useState(0);
  const [spinLabel, setSpinLabel] = useState("");
  const [rotation, setRotation] = useState(0);
  const [message, setMessage] = useState<{ text: string; type: "info" | "success" | "error" | "warning" }>(
    { text: "Spin the wheel to reveal letters!", type: "info" }
  );
  const [solveInput, setSolveInput] = useState("");
  const [showSolveInput, setShowSolveInput] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [roundCount, setRoundCount] = useState(1);
  const sessionStartRef = useRef(Date.now());

  const phrase = currentRule.rule.toUpperCase();
  const phraseLetters = new Set(phrase.split("").filter((ch) => /[A-Z]/.test(ch)));
  const allRevealed = [...phraseLetters].every((l) => revealedLetters.has(l));

  useEffect(() => {
    if (allRevealed && !completed && phase !== "spinning") {
      setCompleted(true);
      setPhase("solved");
      setTotalScore((prev) => prev + roundScore);
      setMessage({ text: `Phrase fully revealed! +${roundScore} pts added to total.`, type: "success" });
      recordSession({
        gameId: "wheel-of-fortune",
        gameName: "Wheel of Fortune",
        mentorId: config.id,
        timestamp: Date.now(),
        durationMs: Date.now() - sessionStartRef.current,
        score: roundScore,
      });
    }
  }, [allRevealed, completed, phase, roundScore, config.id]);

  const spin = useCallback(() => {
    if (phase === "spinning") return;
    const extraSpins = 5 + Math.floor(Math.random() * 5);
    const landAngle = Math.random() * 360;
    const totalRotation = rotation + extraSpins * 360 + landAngle;
    setRotation(totalRotation);
    setPhase("spinning");
    setMessage({ text: "Spinning...", type: "info" });
    setShowSolveInput(false);

    setTimeout(() => {
      const normalizedAngle = totalRotation % 360;
      const pointerAngle = (360 - normalizedAngle + 360) % 360;
      const segmentIndex = Math.floor(pointerAngle / SEGMENT_ANGLE) % WHEEL_SEGMENTS.length;
      const segment = WHEEL_SEGMENTS[segmentIndex];
      setSpinLabel(segment.label);

      if (segment.value === -1) {
        setRoundScore(0);
        setPhase("idle");
        setMessage({ text: "BANKRUPT! Round score wiped. Spin again.", type: "error" });
      } else if (segment.value === -2) {
        setPhase("idle");
        setMessage({ text: "Lose a Turn! Spin again.", type: "warning" });
      } else {
        setSpinValue(segment.value);
        setPhase("guessing");
        setMessage({
          text: `Landed on ${segment.label}! Each correct consonant = +${segment.label} pts.`,
          type: "success",
        });
      }
    }, 3500);
  }, [phase, rotation]);

  const guessConsonant = useCallback(
    (letter: string) => {
      if (phase !== "guessing") return;
      const upper = letter.toUpperCase();
      if (revealedLetters.has(upper)) return;

      const newRevealed = new Set(revealedLetters);
      newRevealed.add(upper);
      setRevealedLetters(newRevealed);

      const count = phrase.split("").filter((ch) => ch === upper).length;
      if (count > 0) {
        const earned = spinValue * count;
        setRoundScore((prev) => prev + earned);
        setMessage({
          text: `"${upper}" appears ${count}×! +${earned} pts. Spin or solve.`,
          type: "success",
        });
      } else {
        setMessage({ text: `No "${upper}" in the phrase. Spin again.`, type: "error" });
      }
      setPhase("idle");
    },
    [phase, revealedLetters, phrase, spinValue]
  );

  const buyVowel = useCallback(
    (letter: string) => {
      if (phase !== "idle" && phase !== "guessing") return;
      if (roundScore < VOWEL_COST) {
        setMessage({ text: `Need ${VOWEL_COST} pts to buy a vowel (you have ${roundScore}).`, type: "warning" });
        return;
      }
      const upper = letter.toUpperCase();
      if (revealedLetters.has(upper)) return;

      const newRevealed = new Set(revealedLetters);
      newRevealed.add(upper);
      setRevealedLetters(newRevealed);
      setRoundScore((prev) => prev - VOWEL_COST);

      const count = phrase.split("").filter((ch) => ch === upper).length;
      setMessage({
        text: count > 0
          ? `"${upper}" appears ${count}×! (-${VOWEL_COST} pts)`
          : `No "${upper}" in the phrase. (-${VOWEL_COST} pts)`,
        type: count > 0 ? "success" : "error",
      });
      setPhase("idle");
    },
    [phase, roundScore, revealedLetters, phrase]
  );

  const attemptSolve = useCallback(() => {
    const guess = solveInput.trim().toUpperCase();
    if (guess === phrase) {
      const bonus = roundScore + 500;
      setCompleted(true);
      setPhase("solved");
      setTotalScore((prev) => prev + bonus);
      setRevealedLetters(new Set(phrase.split("").filter((ch) => /[A-Z]/.test(ch))));
      setMessage({ text: `Solved! +${bonus} pts (includes 500 solve bonus)!`, type: "success" });
      recordSession({
        gameId: "wheel-of-fortune",
        gameName: "Wheel of Fortune",
        mentorId: config.id,
        timestamp: Date.now(),
        durationMs: Date.now() - sessionStartRef.current,
        score: bonus,
      });
    } else {
      setMessage({ text: "Incorrect — keep playing!", type: "error" });
      setShowSolveInput(false);
      setSolveInput("");
    }
  }, [solveInput, phrase, roundScore, config.id]);

  function nextRound() {
    sessionStartRef.current = Date.now();
    setCurrentRule(pickRandomRule(config.rules));
    setRevealedLetters(new Set());
    setRoundScore(0);
    setPhase("idle");
    setSpinValue(0);
    setSpinLabel("");
    setRotation(0);
    setMessage({ text: "New phrase! Spin the wheel.", type: "info" });
    setSolveInput("");
    setShowSolveInput(false);
    setCompleted(false);
    setRoundCount((r) => r + 1);
  }

  // ── Phrase board ──────────────────────────────────────────────
  const renderPhrase = () => {
    const words = phrase.split(" ");
    return (
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-3">
        {words.map((word, wi) => (
          <div key={wi} className="flex gap-1">
            {word.split("").map((ch, ci) => {
              const isLetter = /[A-Z]/.test(ch);
              const isRevealed = revealedLetters.has(ch);
              return (
                <div
                  key={ci}
                  className={`flex items-center justify-center font-mono font-black text-base rounded ${
                    isLetter
                      ? "w-9 h-11 border-b-2 " +
                        (isRevealed
                          ? "bg-[#0d2a1a] border-green text-green"
                          : "bg-[#1a1a2a] border-white/20 text-transparent")
                      : "w-3 h-11"
                  }`}
                >
                  {isLetter ? ch : ""}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  // ── Wheel ──────────────────────────────────────────────────────
  const renderWheel = () => {
    const gradientStops = WHEEL_SEGMENTS.map((seg, i) => {
      const startPct = (i / WHEEL_SEGMENTS.length) * 100;
      const endPct = ((i + 1) / WHEEL_SEGMENTS.length) * 100;
      return `${seg.color} ${startPct}% ${endPct}%`;
    }).join(", ");

    return (
      <div className="relative w-56 h-56 mx-auto">
        {/* Pointer */}
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10 text-green text-2xl leading-none drop-shadow-[0_0_8px_rgba(29,185,124,0.8)]">
          ▼
        </div>
        {/* Wheel disc */}
        <div
          className="w-full h-full rounded-full border-4 border-white/10"
          style={{
            background: `conic-gradient(${gradientStops})`,
            transform: `rotate(${rotation}deg)`,
            transition:
              phase === "spinning"
                ? "transform 3.5s cubic-bezier(0.17, 0.67, 0.12, 0.99)"
                : "none",
            boxShadow: "0 0 40px rgba(0,0,0,0.6), 0 0 20px rgba(0,255,135,0.08)",
          }}
        >
          {WHEEL_SEGMENTS.map((seg, i) => {
            const angle = SEGMENT_ANGLE * i + SEGMENT_ANGLE / 2;
            const label = seg.label === "BANKRUPT" ? "BK" : seg.label === "LOSE TURN" ? "LT" : seg.label;
            return (
              <div
                key={i}
                className="absolute w-full h-full"
                style={{ transform: `rotate(${angle}deg)` }}
              >
                <span
                  className="absolute left-1/2 top-[6px] -translate-x-1/2 text-[8px] font-black text-white leading-none"
                  style={{ textShadow: "0 1px 3px rgba(0,0,0,0.95)" }}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
        {/* Center hub */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-[#0a0a0a] border-2 border-white/15 flex items-center justify-center">
          <span className="text-[9px] font-black font-mono text-muted text-center leading-tight">
            {spinLabel || "SPIN"}
          </span>
        </div>
      </div>
    );
  };

  const isSpinning = phase === "spinning";
  const canSpin = phase === "idle" && !completed;
  const canBuyVowel = (phase === "idle" || phase === "guessing") && !completed && roundScore >= VOWEL_COST;
  const canSolve = !completed && phase !== "spinning";

  const msgColors = {
    info: "text-muted",
    success: "text-green",
    error: "text-red",
    warning: "text-amber",
  } as const;

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-2xl mx-auto select-none py-3">

      {/* Header row — scores + round info */}
      <div className="flex items-center gap-3 w-full justify-center">
        <div className="bg-card rounded-xl border border-card-border px-4 py-2.5 text-center min-w-[80px]">
          <div className="text-[9px] font-mono text-muted uppercase tracking-widest">Round</div>
          <div className="text-xl font-black font-mono text-green">{roundScore}</div>
        </div>
        <div className="bg-card rounded-xl border border-card-border px-4 py-2.5 text-center min-w-[80px]">
          <div className="text-[9px] font-mono text-muted uppercase tracking-widest">Total</div>
          <div className="text-xl font-black font-mono text-foreground/70">{totalScore}</div>
        </div>
        <div className="bg-card rounded-xl border border-card-border px-4 py-2.5 text-center min-w-[60px]">
          <div className="text-[9px] font-mono text-muted uppercase tracking-widest">Round</div>
          <div className="text-xl font-black font-mono text-blue">#{roundCount}</div>
        </div>
        <button
          onClick={() => setShowInstructions(!showInstructions)}
          className="ml-auto text-muted hover:text-foreground transition-colors text-xs font-mono border border-card-border rounded-lg px-3 py-2"
        >
          ? How to play
        </button>
      </div>

      {/* Instructions panel */}
      {showInstructions && (
        <div className="w-full bg-card border border-card-border rounded-xl p-4 text-xs text-muted leading-relaxed space-y-1">
          <p><span className="text-green font-bold">1. Spin</span> the wheel to land on a point value.</p>
          <p><span className="text-blue font-bold">2. Pick a consonant</span> — earn that value × how many times it appears.</p>
          <p><span className="text-amber font-bold">3. Buy a vowel</span> for {VOWEL_COST} pts (spends your round score).</p>
          <p><span className="text-purple font-bold">4. Solve</span> the full phrase any time for +500 bonus on top of round score.</p>
          <p className="text-red/80">BANKRUPT wipes your round score. LOSE TURN skips to spin again.</p>
        </div>
      )}

      {/* Phrase board */}
      <div className="w-full bg-card rounded-2xl border border-card-border p-5 min-h-[80px] flex items-center justify-center">
        {renderPhrase()}
      </div>

      {/* Phrase metadata */}
      <div className="text-[10px] font-mono text-muted uppercase tracking-widest">
        {phraseLetters.size} letters · {phrase.split(" ").length} word{phrase.split(" ").length !== 1 ? "s" : ""}
      </div>

      {/* Status message */}
      <div className={`text-sm font-mono text-center min-h-[1.25rem] font-medium ${msgColors[message.type]}`}>
        {message.text}
      </div>

      {/* Current spin value badge */}
      {phase === "guessing" && (
        <div className="flex items-center gap-2 bg-[#0a2a10] border border-green/40 rounded-xl px-5 py-2">
          <span className="text-[10px] font-mono text-muted uppercase">Each consonant worth</span>
          <span className="text-xl font-black font-mono text-green">{spinValue} pts</span>
        </div>
      )}

      {/* Wheel */}
      {renderWheel()}

      {/* Action buttons */}
      {!completed && (
        <div className="flex flex-wrap justify-center gap-2">
          <button
            onClick={spin}
            disabled={!canSpin || isSpinning}
            className="bg-green text-white font-bold rounded-xl px-7 py-2.5 disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-opacity uppercase tracking-wide text-sm"
          >
            {isSpinning ? "Spinning…" : "Spin"}
          </button>
          <button
            onClick={() => { setShowSolveInput(!showSolveInput); setSolveInput(""); }}
            disabled={!canSolve}
            className="bg-blue text-white font-bold rounded-xl px-5 py-2.5 disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-opacity uppercase tracking-wide text-sm"
          >
            Solve Phrase
          </button>
        </div>
      )}

      {/* Solve input */}
      {showSolveInput && !completed && (
        <div className="flex gap-2 w-full max-w-md">
          <input
            type="text"
            value={solveInput}
            onChange={(e) => setSolveInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") attemptSolve(); }}
            placeholder="Type the full phrase…"
            className="flex-1 bg-card border border-card-border rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted focus:outline-none focus:border-blue/50 font-mono text-sm"
            autoFocus
          />
          <button
            onClick={attemptSolve}
            className="bg-blue text-white font-bold rounded-xl px-4 py-2.5 hover:opacity-90 transition-opacity"
          >
            →
          </button>
        </div>
      )}

      {/* Consonant board */}
      {phase === "guessing" && !completed && (
        <div className="w-full">
          <div className="text-center text-[10px] font-mono text-muted uppercase tracking-widest mb-2">
            Pick a consonant (+{spinValue} pts each)
          </div>
          <div className="flex flex-wrap justify-center gap-1.5">
            {CONSONANTS.map((letter) => {
              const used = revealedLetters.has(letter);
              const inPhrase = phraseLetters.has(letter);
              return (
                <button
                  key={letter}
                  onClick={() => guessConsonant(letter)}
                  disabled={used}
                  className={`w-9 h-10 rounded-lg font-bold text-sm transition-all border ${
                    used
                      ? "bg-[#111120] text-foreground/15 cursor-not-allowed border-transparent"
                      : inPhrase && !used
                      ? "bg-[#0a1a0a] border-green/30 text-green/80 hover:bg-green hover:text-white hover:border-green"
                      : "bg-[#1a1a2e] border-white/8 text-foreground/60 hover:bg-[#1e1e3e] hover:border-white/20"
                  }`}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Vowel board — always visible when can act */}
      {!completed && (phase === "idle" || phase === "guessing") && (
        <div className="w-full">
          <div className="text-center text-[10px] font-mono text-muted uppercase tracking-widest mb-2">
            Buy a vowel ({VOWEL_COST} pts each)
          </div>
          <div className="flex justify-center gap-2">
            {["A", "E", "I", "O", "U"].map((letter) => {
              const used = revealedLetters.has(letter);
              const afford = roundScore >= VOWEL_COST;
              return (
                <button
                  key={letter}
                  onClick={() => buyVowel(letter)}
                  disabled={used || !afford}
                  className={`w-11 h-11 rounded-lg font-bold text-sm transition-all border ${
                    used
                      ? "bg-[#111120] text-foreground/15 cursor-not-allowed border-transparent"
                      : afford
                      ? "bg-amber/15 border-amber/40 text-amber hover:bg-amber hover:text-white hover:border-amber"
                      : "bg-[#1a1a10] text-foreground/20 cursor-not-allowed border-transparent"
                  }`}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Completed / solved state */}
      {completed && (
        <div className="text-center space-y-4 w-full">
          <div className="bg-[#0a2a14] rounded-2xl border border-green/30 p-5 max-w-md mx-auto text-left">
            <div className="text-[10px] font-mono text-green/60 uppercase tracking-widest mb-2">The phrase</div>
            <p className="font-bold text-green text-lg leading-snug mb-2">{currentRule.rule}</p>
            {currentRule.description && (
              <p className="text-sm text-muted leading-relaxed">{currentRule.description}</p>
            )}
          </div>
          <button
            onClick={nextRound}
            className="px-8 py-3 rounded-xl bg-green text-white font-bold hover:opacity-90 transition-opacity uppercase tracking-wide text-sm"
          >
            Next Phrase →
          </button>
        </div>
      )}
    </div>
  );
}
