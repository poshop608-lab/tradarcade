"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MentorConfig } from "@/lib/types";
import { getSessions, totalTimePlayed, sessionsByGame, type GameSession } from "@/lib/stats";
import { getSettings, saveSettings, type GameSettings } from "@/lib/settings";
import { GAMES } from "@/lib/games";
import { getAllMentors } from "@/lib/mentors";
import { ACTIVE_GAMES_KEY } from "@/components/game-slot-grid";

const CUSTOM_KEY = "trades-arcade-custom-config";
const AUTH_KEY = "tradegame-mentor-auth";
const MENTOR_PIN = "1234"; // change this to your desired PIN

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

const ALL_MENTORS = getAllMentors();
const GB_SPECIFIC_IDS = new Set(["gb-number-quiz", "ce-matching", "algo-sorter", "clockwise"]);

export default function MentorPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [config, setConfig] = useState<MentorConfig | null>(null);
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [settings, setSettings] = useState<GameSettings | null>(null);
  const [saved, setSaved] = useState(false);
  const [selectedMentorId, setSelectedMentorId] = useState(ALL_MENTORS[0]?.id ?? "");
  const [activeGameIds, setActiveGameIds] = useState<Record<string, string[]>>({});
  const [gameToggleSaved, setGameToggleSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(AUTH_KEY);
    setAuthed(stored === "true");
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem(CUSTOM_KEY);
    if (raw) { try { setConfig(JSON.parse(raw)); } catch { /* ignore */ } }
    setSessions(getSessions());
    setSettings(getSettings());
    const loaded: Record<string, string[]> = {};
    for (const m of ALL_MENTORS) {
      const stored = localStorage.getItem(ACTIVE_GAMES_KEY(m.id));
      if (stored) {
        try { loaded[m.id] = JSON.parse(stored); } catch { /* ignore */ }
      } else if (m.defaultActiveGameIds) {
        loaded[m.id] = m.defaultActiveGameIds;
      } else {
        loaded[m.id] = GAMES.filter(g => !GB_SPECIFIC_IDS.has(g.id)).map(g => g.id);
      }
    }
    setActiveGameIds(loaded);
  }, []);

  function updateSetting<K extends keyof GameSettings>(game: K, patch: Partial<GameSettings[K]>) {
    if (!settings) return;
    const next = { ...settings, [game]: { ...(settings[game] as object), ...patch } } as GameSettings;
    setSettings(next);
    saveSettings({ [game]: patch } as Parameters<typeof saveSettings>[0]);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  function toggleGame(mentorId: string, gameId: string) {
    const current = activeGameIds[mentorId] ?? [];
    const next = current.includes(gameId)
      ? current.filter((id) => id !== gameId)
      : [...current, gameId];
    setActiveGameIds({ ...activeGameIds, [mentorId]: next });
    localStorage.setItem(ACTIVE_GAMES_KEY(mentorId), JSON.stringify(next));
    setGameToggleSaved(true);
    setTimeout(() => setGameToggleSaved(false), 1800);
  }

  function resetGamesForMentor(mentor: MentorConfig) {
    const defaults = mentor.defaultActiveGameIds
      ?? GAMES.filter(g => !GB_SPECIFIC_IDS.has(g.id)).map(g => g.id);
    setActiveGameIds({ ...activeGameIds, [mentor.id]: defaults });
    localStorage.removeItem(ACTIVE_GAMES_KEY(mentor.id));
    setGameToggleSaved(true);
    setTimeout(() => setGameToggleSaved(false), 1800);
  }

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (pin === MENTOR_PIN) {
      localStorage.setItem(AUTH_KEY, "true");
      setAuthed(true);
      setPinError(false);
    } else {
      setPinError(true);
      setPin("");
    }
  }

  function handleLogout() {
    localStorage.removeItem(AUTH_KEY);
    setAuthed(false);
    setPin("");
  }

  const totalMs = totalTimePlayed(sessions);
  const byGame = sessionsByGame(sessions);
  const topGames = GAMES
    .map((g) => ({ game: g, count: byGame[g.id]?.length ?? 0 }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (authed === null) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--accent)", animation: "pulseDot 1.4s ease-in-out infinite" }} />
      </div>
    );
  }

  // ── Login screen ───────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "var(--bg)", position: "relative", overflow: "hidden" }}>
        {/* Ambient orbs */}
        <div className="orb orb-1" />
        <div className="orb orb-2" />

        {/* Back link */}
        <div style={{ position: "absolute", top: "28px", left: "48px" }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: "7px", fontFamily: "var(--font-m)", fontSize: "11px", color: "var(--text3)", letterSpacing: ".12em", textTransform: "uppercase", transition: "color .15s" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--text2)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--text3)")}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            TradeArcade
          </Link>
        </div>

        {/* Card */}
        <div style={{ width: "100%", maxWidth: "400px", padding: "0 24px" }}>
          {/* Logo row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "40px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(34,211,238,.12)", border: "1px solid rgba(34,211,238,.3)", boxShadow: "0 0 18px rgba(34,211,238,.18)" }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 12L6 7L9 10L13 4" stroke="#67e8f9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <span style={{ fontFamily: "var(--font-d)", fontWeight: 700, fontSize: "17px", color: "var(--text)", letterSpacing: "-.02em" }}>
              Trade<span style={{ color: "var(--accent-bright)", fontWeight: 800 }}>Arcade</span>
            </span>
          </div>

          {/* Card body */}
          <div style={{ background: "var(--bg2)", border: "1px solid var(--border2)", borderRadius: "20px", padding: "36px", position: "relative", overflow: "hidden" }}>
            {/* top accent line */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: "linear-gradient(90deg, var(--accent), var(--purple))" }} />
            {/* inner glow */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "80px", background: "radial-gradient(ellipse at 50% 0%, rgba(34,211,238,.08) 0%, transparent 70%)", pointerEvents: "none" }} />

            <div style={{ textAlign: "center", marginBottom: "28px", position: "relative" }}>
              <div style={{ width: "52px", height: "52px", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", background: "rgba(34,211,238,.08)", border: "1px solid rgba(34,211,238,.22)" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="11" width="18" height="11" rx="2" stroke="var(--accent)" strokeWidth="1.5" />
                  <path d="M7 11V7a5 5 0 0110 0v4" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div style={{ fontFamily: "var(--font-m)", fontSize: "10px", letterSpacing: ".16em", textTransform: "uppercase", color: "var(--text3)", marginBottom: "8px" }}>Mentor Portal</div>
              <h1 style={{ fontFamily: "var(--font-d)", fontWeight: 800, fontSize: "26px", color: "var(--text)", letterSpacing: "-.03em", marginBottom: "8px" }}>Mentor Login</h1>
              <p style={{ fontFamily: "var(--font-b)", fontSize: "13.5px", color: "var(--text2)", lineHeight: 1.6 }}>
                Enter your PIN to access the dashboard.
              </p>
            </div>

            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <input
                type="password"
                value={pin}
                onChange={(e) => { setPin(e.target.value); setPinError(false); }}
                placeholder="••••"
                maxLength={8}
                autoFocus
                style={{
                  width: "100%",
                  padding: "14px 20px",
                  borderRadius: "12px",
                  textAlign: "center",
                  fontSize: "24px",
                  fontFamily: "var(--font-m)",
                  fontWeight: 700,
                  letterSpacing: "0.35em",
                  background: "var(--bg3)",
                  border: `1px solid ${pinError ? "var(--red)" : "var(--border2)"}`,
                  color: "var(--text)",
                  outline: "none",
                  transition: "border-color .15s",
                  caretColor: "var(--accent)",
                  boxShadow: pinError ? "0 0 0 3px rgba(244,63,94,.12)" : "none",
                }}
              />
              {pinError && (
                <div style={{ textAlign: "center", fontFamily: "var(--font-m)", fontSize: "11px", color: "var(--red)", letterSpacing: ".04em" }}>
                  Incorrect PIN — try again
                </div>
              )}
              <button
                type="submit"
                className="btn-primary"
                style={{ width: "100%", justifyContent: "center", borderRadius: "12px", padding: "13px 20px", fontSize: "14px" }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 8h8M8 6l-4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                Unlock Dashboard
              </button>
            </form>
          </div>

          <div style={{ textAlign: "center", marginTop: "20px" }}>
            <span style={{ fontFamily: "var(--font-m)", fontSize: "11px", color: "var(--text3)", letterSpacing: ".04em" }}>
              Not a mentor?{" "}
              <Link href="/" style={{ color: "var(--accent)", textDecoration: "none" }}>
                Browse communities →
              </Link>
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ── Dashboard ──────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", position: "relative" }}>
      <div className="orb orb-1" />
      <div className="orb orb-2" />

      {/* Topbar */}
      <div className="mentor-topbar" style={{ position: "sticky" }}>
        <div className="breadcrumb">
          <Link href="/" style={{ color: "var(--text3)" }}>TradeArcade</Link>
          <span className="sep">/</span>
          <span className="current">Mentor Dashboard</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 12px", borderRadius: "10px", background: "var(--bg3)", border: "1px solid var(--border)" }}>
            <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 5px var(--accent)", animation: "pulseDot 2s ease-in-out infinite" }} />
            <span style={{ fontFamily: "var(--font-m)", fontSize: "11px", color: "var(--accent)" }}>Admin</span>
          </div>
          <button
            onClick={handleLogout}
            className="btn-outline btn-sm"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--text2)" }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M6 3H3a1 1 0 00-1 1v8a1 1 0 001 1h3M10 11l3-3-3-3M13 8H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Log out
          </button>
        </div>
      </div>

      {/* Page body */}
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "40px 48px", position: "relative", zIndex: 1 }}>

        {/* Hero row */}
        <div style={{ marginBottom: "40px" }}>
          <div style={{ fontFamily: "var(--font-m)", fontSize: "10px", letterSpacing: ".16em", textTransform: "uppercase", color: "var(--text3)", marginBottom: "10px" }}>
            — Mentor Portal
          </div>
          <h1 style={{ fontFamily: "var(--font-d)", fontWeight: 800, fontSize: "clamp(28px,3.5vw,42px)", color: "var(--text)", letterSpacing: "-.04em", lineHeight: 1, marginBottom: "10px" }}>
            Mentor Dashboard
          </h1>
          <p style={{ fontFamily: "var(--font-b)", fontSize: "15px", color: "var(--text2)", lineHeight: 1.65 }}>
            Manage which games your community sees, tweak game settings, and track play stats.
          </p>
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px", marginBottom: "40px" }}>
          {[
            { label: "Total Sessions", val: sessions.length, color: "var(--accent)", icon: "🎮" },
            { label: "Time Played", val: formatDuration(totalMs), color: "var(--green)", icon: "⏱" },
            { label: "Games Available", val: GAMES.length, color: "var(--amber)", icon: "🕹" },
            { label: "Communities", val: ALL_MENTORS.length, color: "var(--purple)", icon: "👥" },
          ].map(({ label, val, color, icon }) => (
            <div key={label} className="stat-card">
              <div className="sc-icon" style={{ background: `${color}12`, border: `1px solid ${color}28` }}>
                <span style={{ fontSize: "18px" }}>{icon}</span>
              </div>
              <div className="sc-label">{label}</div>
              <div className="sc-val" style={{ fontSize: "clamp(20px,2.5vw,28px)", color }}>{val}</div>
            </div>
          ))}
        </div>

        {/* Two-column layout */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "24px", alignItems: "start" }}>

          {/* LEFT */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

            {/* Active Games */}
            <section>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                <div style={{ fontFamily: "var(--font-m)", fontSize: "10px", letterSpacing: ".14em", textTransform: "uppercase", color: "var(--text3)" }}>
                  Active Games
                </div>
                {gameToggleSaved && (
                  <span style={{ fontFamily: "var(--font-m)", fontSize: "10px", color: "var(--green)", letterSpacing: ".04em" }}>Saved ✓</span>
                )}
              </div>
              <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "16px", overflow: "hidden" }}>
                {/* Mentor selector tabs */}
                <div style={{ display: "flex", gap: "6px", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
                  {ALL_MENTORS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedMentorId(m.id)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: "999px",
                        fontFamily: "var(--font-m)",
                        fontSize: "11px",
                        fontWeight: 600,
                        letterSpacing: ".06em",
                        border: "1px solid",
                        cursor: "pointer",
                        transition: "all .15s",
                        ...(selectedMentorId === m.id
                          ? { background: `${m.branding.primaryColor}18`, borderColor: `${m.branding.primaryColor}50`, color: m.branding.primaryColor }
                          : { background: "transparent", borderColor: "var(--border)", color: "var(--text3)" }),
                      }}
                    >
                      {m.displayName}
                    </button>
                  ))}
                </div>

                {/* Games list */}
                {ALL_MENTORS.filter(m => m.id === selectedMentorId).map((m) => {
                  const currentIds = activeGameIds[m.id] ?? [];
                  return (
                    <div key={m.id}>
                      {GAMES.map((game, i) => {
                        const isActive = currentIds.includes(game.id);
                        const isGbSpecific = GB_SPECIFIC_IDS.has(game.id);
                        const r = parseInt(game.color.slice(1, 3), 16);
                        const g2 = parseInt(game.color.slice(3, 5), 16);
                        const b = parseInt(game.color.slice(5, 7), 16);
                        return (
                          <label
                            key={game.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "14px",
                              padding: "13px 20px",
                              borderBottom: i < GAMES.length - 1 ? "1px solid var(--border)" : "none",
                              cursor: "pointer",
                              transition: "background .12s",
                              background: isActive ? `rgba(${r},${g2},${b},.03)` : "transparent",
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = `rgba(${r},${g2},${b},.05)`)}
                            onMouseLeave={e => (e.currentTarget.style.background = isActive ? `rgba(${r},${g2},${b},.03)` : "transparent")}
                          >
                            {/* Custom checkbox */}
                            <div
                              onClick={() => toggleGame(m.id, game.id)}
                              style={{
                                width: "18px",
                                height: "18px",
                                borderRadius: "5px",
                                border: `1.5px solid ${isActive ? game.color : "var(--border2)"}`,
                                background: isActive ? `${game.color}22` : "transparent",
                                flexShrink: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                transition: "all .15s",
                              }}
                            >
                              {isActive && (
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                  <path d="M2 5l2.5 2.5L8 3" stroke={game.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </div>

                            {/* Icon */}
                            <div style={{ width: "32px", height: "32px", borderRadius: "9px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "16px", background: `rgba(${r},${g2},${b},.08)`, border: `1px solid rgba(${r},${g2},${b},.2)` }}>
                              {game.icon}
                            </div>

                            {/* Name */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontFamily: "var(--font-b)", fontSize: "14px", fontWeight: 500, color: isActive ? "var(--text)" : "var(--text2)" }}>
                                {game.name}
                              </div>
                              <div style={{ fontFamily: "var(--font-m)", fontSize: "10px", color: "var(--text3)", marginTop: "2px" }}>
                                {game.description}
                              </div>
                            </div>

                            {/* Badge */}
                            {isGbSpecific && (
                              <span style={{ fontFamily: "var(--font-m)", fontSize: "9px", letterSpacing: ".1em", textTransform: "uppercase", padding: "3px 8px", borderRadius: "999px", background: "rgba(34,211,238,.08)", color: "var(--accent)", border: "1px solid rgba(34,211,238,.2)", flexShrink: 0 }}>
                                GB only
                              </span>
                            )}
                          </label>
                        );
                      })}

                      <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontFamily: "var(--font-m)", fontSize: "10px", color: "var(--text3)" }}>
                          {currentIds.length} of {GAMES.length} active
                        </span>
                        <button
                          onClick={() => resetGamesForMentor(m)}
                          style={{ fontFamily: "var(--font-m)", fontSize: "10px", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text3)", background: "none", border: "none", cursor: "pointer", transition: "color .15s", padding: "4px 0" }}
                          onMouseEnter={e => (e.currentTarget.style.color = "var(--accent)")}
                          onMouseLeave={e => (e.currentTarget.style.color = "var(--text3)")}
                        >
                          Reset to defaults
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Game Settings */}
            {settings && (
              <section>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                  <div style={{ fontFamily: "var(--font-m)", fontSize: "10px", letterSpacing: ".14em", textTransform: "uppercase", color: "var(--text3)" }}>
                    Game Settings
                  </div>
                  {saved && (
                    <span style={{ fontFamily: "var(--font-m)", fontSize: "10px", color: "var(--green)", letterSpacing: ".04em" }}>Saved ✓</span>
                  )}
                </div>
                <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "16px", overflow: "hidden" }}>
                  {[
                    {
                      icon: "🃏", title: "Memory Pairs", sub: "Number of card pairs",
                      rows: [
                        {
                          label: "Pair count", opts: [4, 6, 8] as const,
                          current: settings.memory.pairCount,
                          fmt: (v: number) => String(v),
                          onClick: (v: number) => updateSetting("memory", { pairCount: v as 4|6|8 }),
                          color: "#22d3ee",
                        },
                        {
                          label: "Timer", opts: [0, 60, 90, 120] as const,
                          current: settings.memory.timerSeconds,
                          fmt: (v: number) => v === 0 ? "∞" : `${v}s`,
                          onClick: (v: number) => updateSetting("memory", { timerSeconds: v as 0|60|90|120 }),
                          color: "#22d3ee",
                        },
                      ],
                    },
                    {
                      icon: "🔨", title: "Whack-a-Mole", sub: "Game duration",
                      rows: [
                        {
                          label: "Duration", opts: [30, 60, 90] as const,
                          current: settings["whack-a-mole"].durationSeconds,
                          fmt: (v: number) => `${v}s`,
                          onClick: (v: number) => updateSetting("whack-a-mole", { durationSeconds: v as 30|60|90 }),
                          color: "#ef4444",
                        },
                      ],
                    },
                    {
                      icon: "🍎", title: "Fruit Ninja", sub: "Game duration",
                      rows: [
                        {
                          label: "Duration", opts: [30, 60, 90] as const,
                          current: settings["fruit-ninja"].durationSeconds,
                          fmt: (v: number) => `${v}s`,
                          onClick: (v: number) => updateSetting("fruit-ninja", { durationSeconds: v as 30|60|90 }),
                          color: "#ef4444",
                        },
                      ],
                    },
                    {
                      icon: "🐦", title: "Flappy Bird", sub: "Pipe speed & gap",
                      rows: [
                        {
                          label: "Difficulty", opts: ["easy", "normal", "hard"] as const,
                          current: settings.flappy_bird.difficulty,
                          fmt: (v: string) => v,
                          onClick: (v: string) => updateSetting("flappy_bird", { difficulty: v as "easy"|"normal"|"hard" }),
                          color: "#3b82f6",
                        },
                      ],
                    },
                  ].map((section, si, arr) => (
                    <div key={section.title} style={{ padding: "18px 20px", borderBottom: si < arr.length - 1 ? "1px solid var(--border)" : "none" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                        <span style={{ fontSize: "18px" }}>{section.icon}</span>
                        <div>
                          <div style={{ fontFamily: "var(--font-b)", fontSize: "14px", fontWeight: 600, color: "var(--text)" }}>{section.title}</div>
                          <div style={{ fontFamily: "var(--font-m)", fontSize: "10px", color: "var(--text3)", marginTop: "1px" }}>{section.sub}</div>
                        </div>
                      </div>
                      {section.rows.map((row) => (
                        <div key={row.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "8px" }}>
                          <span style={{ fontFamily: "var(--font-m)", fontSize: "12px", color: "var(--text2)" }}>{row.label}</span>
                          <div style={{ display: "flex", gap: "5px" }}>
                            {(row.opts as readonly (string | number)[]).map((v) => {
                              const isActive = v === row.current;
                              const label = row.fmt(v as never);
                              return (
                                <button
                                  key={String(v)}
                                  onClick={() => row.onClick(v as never)}
                                  style={{
                                    padding: "5px 12px",
                                    borderRadius: "8px",
                                    fontFamily: "var(--font-m)",
                                    fontSize: "11px",
                                    fontWeight: 600,
                                    border: "1px solid",
                                    cursor: "pointer",
                                    transition: "all .15s",
                                    textTransform: "lowercase" as const,
                                    ...(isActive
                                      ? { background: `${row.color}20`, borderColor: `${row.color}50`, color: row.color }
                                      : { background: "transparent", borderColor: "var(--border)", color: "var(--text3)" }),
                                  }}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </section>
            )}

          </div>

          {/* RIGHT sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* Most Played */}
            <div>
              <div style={{ fontFamily: "var(--font-m)", fontSize: "10px", letterSpacing: ".14em", textTransform: "uppercase", color: "var(--text3)", marginBottom: "14px" }}>
                Most Played
              </div>
              <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "14px", overflow: "hidden" }}>
                {topGames.length === 0 ? (
                  <div style={{ padding: "28px 20px", textAlign: "center", fontFamily: "var(--font-m)", fontSize: "12px", color: "var(--text3)" }}>
                    No sessions yet.<br />Play some games first!
                  </div>
                ) : topGames.map(({ game, count }, i) => (
                  <div key={game.id} className="activity-item">
                    <div className="act-icon" style={{ background: `${game.color}12`, border: `1px solid ${game.color}25`, color: game.color }}>
                      <span style={{ fontSize: "16px" }}>{game.icon}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="act-game">{game.name}</div>
                      <div style={{ height: "3px", background: "var(--bg4)", borderRadius: "2px", marginTop: "5px", overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: "2px", width: `${(count / topGames[0].count) * 100}%`, background: game.color, transition: "width .4s" }} />
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontFamily: "var(--font-m)", fontSize: "13px", fontWeight: 600, color: "var(--text)" }}>{count}</div>
                      <div style={{ fontFamily: "var(--font-m)", fontSize: "10px", color: "var(--text3)" }}>plays</div>
                    </div>
                    {i === 0 && <span style={{ fontSize: "14px" }}>🏆</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Custom content */}
            <div>
              <div style={{ fontFamily: "var(--font-m)", fontSize: "10px", letterSpacing: ".14em", textTransform: "uppercase", color: "var(--text3)", marginBottom: "14px" }}>
                Your Content
              </div>
              <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "14px", padding: "18px" }}>
                {config ? (
                  <>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                      <span style={{ fontFamily: "var(--font-b)", fontSize: "14px", fontWeight: 600, color: "var(--text)" }}>{config.displayName}</span>
                      <span className="tag tag-green" style={{ fontSize: "10px" }}>Custom</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "8px", marginBottom: "14px" }}>
                      {[
                        { label: "Terms", count: config.terms.length, color: "#22c55e" },
                        { label: "Concepts", count: config.concepts.length, color: "#3b82f6" },
                        { label: "Rules", count: config.rules.length, color: "#f59e0b" },
                      ].map(({ label, count, color }) => (
                        <div key={label} style={{ background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: "10px", padding: "10px", textAlign: "center" }}>
                          <div style={{ fontFamily: "var(--font-d)", fontWeight: 800, fontSize: "20px", color, letterSpacing: "-.04em" }}>{count}</div>
                          <div style={{ fontFamily: "var(--font-m)", fontSize: "9px", color: "var(--text3)", marginTop: "3px", letterSpacing: ".08em", textTransform: "uppercase" }}>{label}</div>
                        </div>
                      ))}
                    </div>
                    <Link href="/setup" className="btn-outline btn-sm" style={{ width: "100%", justifyContent: "center", borderRadius: "10px" }}>
                      Edit Content
                    </Link>
                  </>
                ) : (
                  <div style={{ textAlign: "center", padding: "12px 0" }}>
                    <p style={{ fontFamily: "var(--font-m)", fontSize: "12px", color: "var(--text3)", marginBottom: "14px" }}>No custom config yet.</p>
                    <Link href="/setup" className="btn-primary btn-sm" style={{ borderRadius: "10px" }}>
                      Import Content →
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Full stats link */}
            <Link href="/stats" style={{ display: "block", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "14px", padding: "16px 18px", textAlign: "center", transition: "border-color .2s, transform .2s", textDecoration: "none" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent-border)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              <div style={{ fontFamily: "var(--font-m)", fontSize: "10px", letterSpacing: ".14em", textTransform: "uppercase", color: "var(--text3)", marginBottom: "4px" }}>Full Analytics</div>
              <div style={{ fontFamily: "var(--font-b)", fontSize: "14px", fontWeight: 600, color: "var(--text)" }}>View detailed stats →</div>
            </Link>

          </div>
        </div>
      </div>
    </div>
  );
}
