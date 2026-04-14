"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import {
  getSessions, totalTimePlayed, sessionsByGame,
  bestScoreByGame, avgAccuracyByGame, clearSessions,
} from "@/lib/stats";
import type { GameSession } from "@/lib/stats";

// ── helpers ────────────────────────────────────────────────────────────────────
function fmtTime(ms: number) {
  const s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}
function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function getDisplayName(u: User) {
  return u.user_metadata?.display_name || u.user_metadata?.full_name || u.email?.split("@")[0] || "Player";
}
function isMentor(u: User) {
  return (
    u.user_metadata?.role === "mentor" ||
    (u as unknown as { app_metadata?: { role?: string } }).app_metadata?.role === "mentor"
  );
}

// ── game SVG icons ────────────────────────────────────────────────────────────
const GAME_ICONS: Record<string, React.ReactElement> = {
  "flappy-bird": (
    <svg viewBox="0 0 40 40" fill="none">
      <ellipse cx="22" cy="20" rx="11" ry="8" fill="currentColor" opacity=".9"/>
      <ellipse cx="16" cy="18" rx="4" ry="3" fill="currentColor" opacity=".5"/>
      <path d="M28 16 C34 12 38 16 36 20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
      <circle cx="25" cy="17" r="2" fill="#09090b"/>
      <circle cx="25.7" cy="16.3" r=".8" fill="white"/>
      <path d="M33 19 L38 17 L36 22Z" fill="currentColor" opacity=".7"/>
    </svg>
  ),
  "whack-a-mole": (
    <svg viewBox="0 0 40 40" fill="none">
      <rect x="17" y="4" width="6" height="16" rx="3" fill="currentColor" opacity=".4"/>
      <rect x="14" y="2" width="12" height="7" rx="3.5" fill="currentColor"/>
      <ellipse cx="20" cy="30" rx="10" ry="6" fill="currentColor" opacity=".6"/>
      <circle cx="17" cy="28" r="2" fill="#09090b"/>
      <circle cx="23" cy="28" r="2" fill="#09090b"/>
      <path d="M17 32 Q20 34 23 32" stroke="#09090b" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    </svg>
  ),
  "asteroids": (
    <svg viewBox="0 0 40 40" fill="none">
      <polygon points="20,4 24,16 20,14 16,16" fill="currentColor"/>
      <line x1="20" y1="16" x2="20" y2="20" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="8" cy="28" r="5" fill="currentColor" opacity=".5"/>
      <path d="M6 24 L5 32 L11 31 L12 25Z" fill="currentColor" opacity=".5"/>
      <circle cx="30" cy="14" r="3.5" fill="currentColor" opacity=".4"/>
      <circle cx="32" cy="32" r="4" fill="currentColor" opacity=".35"/>
      <path d="M28 30 L29 36 L34 34 L35 29Z" fill="currentColor" opacity=".35"/>
      <circle cx="14" cy="10" r="2" fill="currentColor" opacity=".3"/>
    </svg>
  ),
  "wordle": (
    <svg viewBox="0 0 40 40" fill="none">
      <rect x="4"  y="4"  width="9" height="9" rx="2" fill="currentColor"/>
      <rect x="16" y="4"  width="9" height="9" rx="2" fill="currentColor" opacity=".5"/>
      <rect x="28" y="4"  width="9" height="9" rx="2" fill="currentColor" opacity=".3"/>
      <rect x="4"  y="16" width="9" height="9" rx="2" fill="currentColor" opacity=".3"/>
      <rect x="16" y="16" width="9" height="9" rx="2" fill="currentColor"/>
      <rect x="28" y="16" width="9" height="9" rx="2" fill="currentColor" opacity=".5"/>
      <rect x="4"  y="28" width="9" height="9" rx="2" fill="currentColor" opacity=".5"/>
      <rect x="16" y="28" width="9" height="9" rx="2" fill="currentColor" opacity=".3"/>
      <rect x="28" y="28" width="9" height="9" rx="2" fill="currentColor"/>
    </svg>
  ),
  "hangman": (
    <svg viewBox="0 0 40 40" fill="none">
      <line x1="6" y1="36" x2="34" y2="36" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="12" y1="36" x2="12" y2="4"  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="12" y1="4"  x2="24" y2="4"  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="24" y1="4"  x2="24" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="24" cy="14" r="3.5" stroke="currentColor" strokeWidth="2" fill="none"/>
      <line x1="24" y1="17.5" x2="24" y2="26" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="24" y1="20"   x2="19" y2="24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="24" y1="20"   x2="29" y2="24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="24" y1="26"   x2="20" y2="32" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="24" y1="26"   x2="28" y2="32" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  "memory": (
    <svg viewBox="0 0 40 40" fill="none">
      <rect x="4"  y="8" width="14" height="20" rx="3" fill="currentColor" opacity=".9"/>
      <rect x="22" y="8" width="14" height="20" rx="3" fill="currentColor" opacity=".4"/>
      <text x="11" y="22" textAnchor="middle" fontSize="10" fontWeight="800" fill="#09090b">?</text>
      <rect x="6"  y="10" width="10" height="14" rx="2" stroke="#09090b" strokeWidth=".5" fill="none" opacity=".3"/>
    </svg>
  ),
  "crossy-road": (
    <svg viewBox="0 0 40 40" fill="none">
      <rect x="2" y="2" width="36" height="36" rx="4" fill="currentColor" opacity=".08"/>
      <rect x="2" y="16" width="36" height="9" fill="currentColor" opacity=".15"/>
      <line x1="2" y1="20.5" x2="10" y2="20.5" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3"/>
      <line x1="16" y1="20.5" x2="24" y2="20.5" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3"/>
      <line x1="30" y1="20.5" x2="38" y2="20.5" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3"/>
      <rect x="14" y="11" width="12" height="7" rx="2" fill="currentColor"/>
      <circle cx="17" cy="18" r="2" fill="currentColor" opacity=".6"/>
      <circle cx="23" cy="18" r="2" fill="currentColor" opacity=".6"/>
      <rect x="16" y="9" width="8" height="4" rx="1.5" fill="currentColor" opacity=".5"/>
    </svg>
  ),
  "doodle-jump": (
    <svg viewBox="0 0 40 40" fill="none">
      <rect x="6"  y="32" width="12" height="3" rx="1.5" fill="currentColor"/>
      <rect x="22" y="24" width="12" height="3" rx="1.5" fill="currentColor" opacity=".7"/>
      <rect x="10" y="16" width="12" height="3" rx="1.5" fill="currentColor" opacity=".5"/>
      <rect x="20" y="8"  width="12" height="3" rx="1.5" fill="currentColor" opacity=".35"/>
      <circle cx="16" cy="28" r="4" fill="currentColor"/>
      <path d="M14 24 L12 20 M18 24 L20 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M16 32 L13 36 M16 32 L19 36" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  "fruit-ninja": (
    <svg viewBox="0 0 40 40" fill="none">
      <circle cx="14" cy="26" r="8" fill="currentColor" opacity=".7"/>
      <circle cx="28" cy="16" r="6" fill="currentColor" opacity=".45"/>
      <line x1="4" y1="36" x2="36" y2="4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="2" y1="34" x2="6" y2="38" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity=".4"/>
    </svg>
  ),
  "wheel-of-fortune": (
    <svg viewBox="0 0 40 40" fill="none">
      <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="2"/>
      <line x1="20" y1="4"  x2="20" y2="36" stroke="currentColor" strokeWidth="1.5" opacity=".4"/>
      <line x1="4"  y1="20" x2="36" y2="20" stroke="currentColor" strokeWidth="1.5" opacity=".4"/>
      <line x1="8.7" y1="8.7"  x2="31.3" y2="31.3" stroke="currentColor" strokeWidth="1.5" opacity=".4"/>
      <line x1="31.3" y1="8.7" x2="8.7" y2="31.3"  stroke="currentColor" strokeWidth="1.5" opacity=".4"/>
      <circle cx="20" cy="20" r="4" fill="currentColor"/>
      <polygon points="20,8 22,14 20,13 18,14" fill="currentColor"/>
    </svg>
  ),
  "gb-number-quiz": (
    <svg viewBox="0 0 40 40" fill="none">
      <line x1="12" y1="4"  x2="10" y2="36" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
      <line x1="28" y1="4"  x2="26" y2="36" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
      <line x1="7"  y1="14" x2="33" y2="14" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
      <line x1="6"  y1="24" x2="32" y2="24" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  ),
  "ce-matching": (
    <svg viewBox="0 0 40 40" fill="none">
      <circle cx="10" cy="20" r="7" stroke="currentColor" strokeWidth="2.5" fill="none"/>
      <circle cx="30" cy="20" r="7" stroke="currentColor" strokeWidth="2.5" fill="none"/>
      <line x1="17" y1="20" x2="23" y2="20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="10" cy="20" r="3" fill="currentColor" opacity=".6"/>
      <circle cx="30" cy="20" r="3" fill="currentColor" opacity=".6"/>
      <path d="M20 14 L20 10 M20 26 L20 30" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".4"/>
    </svg>
  ),
  "algo-sorter": (
    <svg viewBox="0 0 40 40" fill="none">
      <rect x="4"  y="28" width="7" height="8"  rx="2" fill="currentColor"/>
      <rect x="14" y="20" width="7" height="16" rx="2" fill="currentColor" opacity=".8"/>
      <rect x="24" y="12" width="7" height="24" rx="2" fill="currentColor" opacity=".6"/>
      <rect x="4"  y="4"  width="7" height="12" rx="2" fill="currentColor" opacity=".25"/>
      <path d="M33 10 L33 4 M33 4 L30 7 M33 4 L36 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  "clockwise": (
    <svg viewBox="0 0 40 40" fill="none">
      <circle cx="20" cy="20" r="15" stroke="currentColor" strokeWidth="2.5" fill="none"/>
      <line x1="20" y1="20" x2="20" y2="9"  stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
      <line x1="20" y1="20" x2="28" y2="24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="20" cy="20" r="2.5" fill="currentColor"/>
      <path d="M30 8 C34 12 36 17 35 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
      <polygon points="35,22 33,17 38,19" fill="currentColor"/>
    </svg>
  ),
};

// ── game catalogue ─────────────────────────────────────────────────────────────
const ALL_GAMES = [
  { id:"gb-number-quiz",   name:"GB Number Quiz",   cat:"Trading",    path:"gb-number-quiz",   diff:"Medium", accent:"#22d3ee", desc:"20 rapid-fire questions — classify each number as GB, CE, or neither before the timer hits zero." },
  { id:"ce-matching",      name:"CE Matching",       cat:"Trading",    path:"ce-matching",      diff:"Hard",   accent:"#22d3ee", desc:"Match each GB number to its correct CE counterpart. Speed bonuses reward clean streaks." },
  { id:"algo-sorter",      name:"Algo Sorter",       cat:"Trading",    path:"algo-sorter",      diff:"Hard",   accent:"#22d3ee", desc:"Classify each algorithm step as Algo 1, Algo 2, or Both. Three lives, no second guesses." },
  { id:"clockwise",        name:"Clockwise",         cat:"Trading",    path:"clockwise",        diff:"Hard",   accent:"#22d3ee", desc:"Navigate the trading decision tree — pick the correct next step at every algorithm branch." },
  { id:"wordle",           name:"Wordle",            cat:"Vocabulary", path:"wordle",           diff:"Easy",   accent:"#22c55e", desc:"6 attempts to guess the hidden trading term. Green = right spot, yellow = wrong position." },
  { id:"hangman",          name:"Hangman",           cat:"Vocabulary", path:"hangman",          diff:"Easy",   accent:"#22c55e", desc:"Reveal a hidden trading concept letter by letter before you run out of incorrect guesses." },
  { id:"wheel-of-fortune", name:"Wheel of Fortune",  cat:"Vocabulary", path:"wheel-of-fortune", diff:"Easy",   accent:"#22c55e", desc:"Spin to earn letters and solve the trading phrase before the clock runs out." },
  { id:"flappy-bird",      name:"Flappy Bird",       cat:"Reflexes",   path:"flappy-bird",      diff:"Medium", accent:"#f59e0b", desc:"Tap to stay airborne through trading concept pipes. One wrong move resets your streak." },
  { id:"crossy-road",      name:"Crossy Road",       cat:"Reflexes",   path:"crossy-road",      diff:"Easy",   accent:"#f59e0b", desc:"Cross lanes of valid and invalid trading rules without getting wiped. React fast." },
  { id:"asteroids",        name:"Asteroids",         cat:"Arcade",     path:"asteroids",        diff:"Medium", accent:"#d946ef", desc:"Blast incoming trading-term asteroids across waves. Survive longer, score higher." },
  { id:"doodle-jump",      name:"Doodle Jump",       cat:"Arcade",     path:"doodle-jump",      diff:"Easy",   accent:"#d946ef", desc:"Bounce up the trading concept tower. Each missed platform is a point lost forever." },
  { id:"whack-a-mole",     name:"Whack-a-Mole",      cat:"Speed",      path:"whack-a-mole",     diff:"Easy",   accent:"#f59e0b", desc:"Hammer valid trading concepts as they pop up. Every wrong hit costs you points." },
  { id:"fruit-ninja",      name:"Fruit Ninja",       cat:"Speed",      path:"fruit-ninja",      diff:"Medium", accent:"#f43f5e", desc:"Slice correct answers flying across the screen. Hesitate and they're gone." },
  { id:"memory",           name:"Memory Match",      cat:"Memory",     path:"memory",           diff:"Easy",   accent:"#d946ef", desc:"Flip pairs of trading term cards and match them before your focus breaks." },
];

const CATS = [
  { tag:"Trading",    accent:"#22d3ee", dim:"rgba(34,211,238,.08)",  border:"rgba(34,211,238,.18)",  desc:"Framework drills built from your mentor's exact model" },
  { tag:"Vocabulary", accent:"#22c55e", dim:"rgba(34,197,94,.08)",   border:"rgba(34,197,94,.18)",   desc:"Term recognition, spelling, and definitions under pressure" },
  { tag:"Reflexes",   accent:"#f59e0b", dim:"rgba(245,158,11,.08)",  border:"rgba(245,158,11,.18)",  desc:"Fast-reaction games that keep your pattern recognition sharp" },
  { tag:"Arcade",     accent:"#d946ef", dim:"rgba(217,70,239,.08)",  border:"rgba(217,70,239,.18)",  desc:"Classic arcade games remixed with trading knowledge twists" },
  { tag:"Speed",      accent:"#f59e0b", dim:"rgba(245,158,11,.08)",  border:"rgba(245,158,11,.18)",  desc:"Rapid-fire games that punish hesitation" },
  { tag:"Memory",     accent:"#d946ef", dim:"rgba(217,70,239,.08)",  border:"rgba(217,70,239,.18)",  desc:"Concentration drills that build long-term recall" },
];

const DIFF_COLOR: Record<string, string> = { Easy:"#22c55e", Medium:"#f59e0b", Hard:"#f43f5e" };

type Tab = "games" | "leaderboard" | "stats" | "admin";

// ── nav SVGs ──────────────────────────────────────────────────────────────────
const NAV = {
  logo:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round"><path d="M2 12L6 7L9 10L13 4L17 9L21 5"/></svg>,
  games:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M12 10v4M10 12h4"/></svg>,
  lb:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 6H3v16h5V6zM14 2H10v20h4V2zM20 10h-4v12h4V10z"/></svg>,
  stats:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 3v18h18"/><path d="M7 16l4-4 4 4 5-5"/></svg>,
  admin:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  logout: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>,
  play:   <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>,
  search: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>,
  chev:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 9l6 6 6-6"/></svg>,
  ban:    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M4.9 4.9l14.2 14.2"/></svg>,
  check:  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>,
  trash:  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>,
};

// ── CSS ────────────────────────────────────────────────────────────────────────
const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
@keyframes spin      { to { transform:rotate(360deg) } }
@keyframes slideUp   { from { opacity:0; transform:translateY(28px) } to { opacity:1; transform:translateY(0) } }
@keyframes fadeIn    { from { opacity:0 } to { opacity:1 } }

/* ── root ── */
.d {
  min-height:100vh;
  background:#09090b;
  display:flex;
  font-family:var(--font-geist-sans,-apple-system,system-ui,sans-serif);
  color:#fafafa;
  font-size:14px;
  line-height:1.6;
}

/* ── sidebar ── */
.sb {
  width:228px; flex-shrink:0; height:100vh; position:sticky; top:0;
  display:flex; flex-direction:column;
  background:#0d0d10;
  border-right:1px solid rgba(255,255,255,.06);
}
.sb-top  { padding:16px 14px 12px; border-bottom:1px solid rgba(255,255,255,.06); }
.sb-logo { display:flex; align-items:center; gap:9px; text-decoration:none; }
.sb-mark {
  width:32px; height:32px; border-radius:9px; flex-shrink:0;
  background:linear-gradient(135deg,rgba(34,211,238,.18),rgba(217,70,239,.14));
  border:1px solid rgba(34,211,238,.22);
  display:flex; align-items:center; justify-content:center;
}
.sb-name {
  font-size:14.5px; font-weight:800; letter-spacing:-.025em;
  background:linear-gradient(115deg,#67e8f9,#d946ef);
  -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
}

.sb-nav  { padding:12px 8px; flex:1; overflow-y:auto; }
.sb-lbl  { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.12em; color:#3f3f46; padding:0 8px; margin:8px 0 5px; }
.sb-btn  {
  display:flex; align-items:center; gap:9px; width:100%; padding:8px 10px; border-radius:8px;
  border:1px solid transparent; background:none; color:#71717a; font-size:13px; font-weight:500;
  cursor:pointer; transition:all .15s; font-family:inherit; text-align:left; margin-bottom:2px;
}
.sb-btn:hover  { background:rgba(255,255,255,.04); color:#a1a1aa; }
.sb-btn.on     { background:rgba(34,211,238,.08); border-color:rgba(34,211,238,.18); color:#22d3ee; }
.sb-badge      { margin-left:auto; background:rgba(255,255,255,.06); color:#52525b; border-radius:20px; padding:1px 8px; font-size:9.5px; font-weight:700; }
.sb-btn.on .sb-badge { background:rgba(34,211,238,.14); color:#67e8f9; }
.sb-mbadge     { margin-left:auto; background:rgba(217,70,239,.12); color:#d946ef; border-radius:20px; padding:2px 9px; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; }

.sb-foot { padding:10px 12px; border-top:1px solid rgba(255,255,255,.06); display:flex; align-items:center; gap:9px; }
.sb-av   { width:30px; height:30px; border-radius:50%; flex-shrink:0; background:linear-gradient(135deg,rgba(34,211,238,.22),rgba(217,70,239,.18)); border:1px solid rgba(34,211,238,.2); display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:800; color:#22d3ee; }
.sb-un   { font-size:12px; font-weight:700; color:#fafafa; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.sb-ue   { font-size:10px; color:#3f3f46; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.sb-out  { width:26px; height:26px; flex-shrink:0; border-radius:7px; border:1px solid rgba(255,255,255,.06); background:none; color:#3f3f46; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all .15s; }
.sb-out:hover { border-color:rgba(244,63,94,.35); color:#f43f5e; }

/* ── main ── */
.mn  { flex:1; min-width:0; display:flex; flex-direction:column; min-height:100vh; }
.tb  {
  height:54px; display:flex; align-items:center; justify-content:space-between;
  padding:0 28px; border-bottom:1px solid rgba(255,255,255,.06);
  background:rgba(9,9,11,.9); backdrop-filter:blur(14px);
  position:sticky; top:0; z-index:40; flex-shrink:0;
}
.tb-t  { font-size:14px; font-weight:700; color:#fafafa; letter-spacing:-.01em; }
.tb-s  { font-size:10.5px; color:#3f3f46; margin-top:1px; }
.tb-srch {
  display:flex; align-items:center; gap:7px;
  background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.07);
  border-radius:8px; padding:6px 12px; transition:border-color .2s;
}
.tb-srch:focus-within { border-color:rgba(34,211,238,.3); }
.tb-srch input { background:none; border:none; outline:none; color:#fafafa; font-size:12.5px; font-family:inherit; width:190px; transition:width .2s; }
.tb-srch input:focus { width:230px; }
.tb-srch input::placeholder { color:#3f3f46; }

.ct { flex:1; padding:28px; overflow-y:auto; }

/* ── welcome ── */
.wl {
  background:linear-gradient(135deg,rgba(34,211,238,.07),rgba(217,70,239,.05));
  border:1px solid rgba(34,211,238,.14); border-radius:16px;
  padding:22px 28px; margin-bottom:28px;
  display:flex; align-items:center; justify-content:space-between; gap:20px;
  position:relative; overflow:hidden;
  animation: fadeIn .4s ease both;
}
.wl::before {
  content:''; position:absolute; top:0; left:0; right:0; height:1px;
  background:linear-gradient(90deg,transparent,rgba(34,211,238,.55),rgba(217,70,239,.45),transparent);
}
.wl-n  { font-size:18px; font-weight:800; letter-spacing:-.02em; color:#fafafa; margin-bottom:3px; }
.wl-s  { color:#71717a; font-size:12.5px; }
.wl-stats { display:flex; gap:0; flex-shrink:0; }
.wl-st { text-align:center; padding:0 20px; }
.wl-st + .wl-st { border-left:1px solid rgba(255,255,255,.06); }
.wl-v { font-size:20px; font-weight:900; letter-spacing:-.03em; color:#22d3ee; display:block; line-height:1; }
.wl-l { font-size:9.5px; color:#71717a; text-transform:uppercase; letter-spacing:.08em; margin-top:4px; }

/* ── filters ── */
.fb  { display:flex; gap:5px; flex-wrap:wrap; margin-bottom:22px; align-items:center; }
.fbl { font-size:9.5px; font-weight:700; text-transform:uppercase; letter-spacing:.1em; color:#27272a; margin-right:4px; }
.chip { padding:4px 14px; border-radius:20px; border:1px solid rgba(255,255,255,.07); background:rgba(255,255,255,.02); color:#71717a; font-size:11.5px; font-weight:600; cursor:pointer; transition:all .15s; font-family:inherit; }
.chip:hover { color:#a1a1aa; border-color:rgba(255,255,255,.12); }
.chip.on    { background:rgba(34,211,238,.09); border-color:rgba(34,211,238,.28); color:#22d3ee; }

/* ── category block ── */
.cg     { margin-bottom:22px; }
.cg-hd  {
  display:flex; align-items:center; gap:12px; padding:12px 18px;
  border-radius:12px; border:1px solid; cursor:pointer; user-select:none;
  transition:filter .15s; margin-bottom:1px;
}
.cg-hd:hover { filter:brightness(1.07); }
.cg-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
.cg-label { font-size:13px; font-weight:800; flex:1; letter-spacing:-.01em; }
.cg-sub   { font-size:11px; opacity:.45; margin-top:1px; }
.cg-cnt   { font-size:10px; font-weight:700; padding:3px 11px; border-radius:20px; background:rgba(255,255,255,.05); flex-shrink:0; }
.cg-chev  { transition:transform .22s; flex-shrink:0; opacity:.5; }
.cg-chev.open { transform:rotate(180deg); }

/* ── game cards grid ── */
.gc-grid {
  display:grid;
  grid-template-columns:repeat(auto-fill, minmax(280px, 1fr));
  gap:14px;
  padding:14px 0 4px;
}

/* each card — hidden until scroll triggers .show */
.gc {
  background:#111113;
  border:1px solid rgba(255,255,255,.07);
  border-radius:16px;
  padding:0;
  text-decoration:none;
  color:inherit;
  display:flex;
  flex-direction:column;
  overflow:hidden;
  transition:transform .22s, box-shadow .22s, border-color .22s;
  /* scroll-reveal initial state */
  opacity:0;
  transform:translateY(24px);
}
.gc.show {
  animation:slideUp .42s cubic-bezier(.23,1,.32,1) both;
}
.gc:hover {
  transform:translateY(-4px);
  border-color:var(--gc-accent, rgba(34,211,238,.3));
  box-shadow:0 16px 48px rgba(0,0,0,.5), 0 0 0 1px var(--gc-accent, rgba(34,211,238,.15));
}

/* card top — icon area */
.gc-top {
  padding:22px 22px 16px;
  position:relative;
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
}
.gc-top::before {
  content:'';
  position:absolute;
  inset:0;
  background:var(--gc-glow, rgba(34,211,238,.04));
  pointer-events:none;
}
.gc-icon {
  width:52px; height:52px; border-radius:14px; flex-shrink:0;
  display:flex; align-items:center; justify-content:center;
  background:var(--gc-dim, rgba(34,211,238,.08));
  border:1px solid var(--gc-border, rgba(34,211,238,.18));
  color:var(--gc-accent, #22d3ee);
  position:relative; z-index:1;
}
.gc-badges { display:flex; flex-direction:column; align-items:flex-end; gap:5px; position:relative; z-index:1; }
.gc-cat  { font-size:9.5px; font-weight:700; padding:3px 10px; border-radius:20px; }
.gc-diff { font-size:9px; font-weight:700; padding:2px 9px; border-radius:20px; background:rgba(255,255,255,.05); }

/* card body */
.gc-body { padding:0 22px 20px; flex:1; display:flex; flex-direction:column; gap:8px; }
.gc-name { font-size:15px; font-weight:800; color:#fafafa; letter-spacing:-.02em; }
.gc-desc { font-size:12px; color:#71717a; line-height:1.6; flex:1; }
.gc-foot { display:flex; align-items:center; justify-content:space-between; margin-top:4px; }
.gc-meta { font-size:11px; color:#3f3f46; }
.gc-best { font-size:11px; font-weight:700; color:#22d3ee; }

/* play button */
.gc-play {
  display:flex; align-items:center; gap:7px;
  padding:10px 22px; margin:0 22px 20px;
  border-radius:10px; font-size:12.5px; font-weight:700;
  background:var(--gc-dim, rgba(34,211,238,.07));
  border:1px solid var(--gc-border, rgba(34,211,238,.2));
  color:var(--gc-accent, #22d3ee);
  transition:background .15s, border-color .15s;
  text-align:center; justify-content:center;
}
.gc:hover .gc-play {
  background:var(--gc-play-hover, rgba(34,211,238,.14));
  border-color:var(--gc-accent, #22d3ee);
}

/* ── leaderboard ── */
.lbt { width:100%; border-collapse:collapse; background:#111113; border:1px solid rgba(255,255,255,.07); border-radius:14px; overflow:hidden; }
.lbt th { padding:10px 18px; text-align:left; font-size:9.5px; font-weight:700; text-transform:uppercase; letter-spacing:.1em; color:#27272a; background:rgba(255,255,255,.02); border-bottom:1px solid rgba(255,255,255,.06); }
.lbt td { padding:13px 18px; border-bottom:1px solid rgba(255,255,255,.05); font-size:12.5px; color:#71717a; vertical-align:middle; }
.lbt tr:last-child td { border-bottom:none; }
.lbt tr:hover td { background:rgba(255,255,255,.025); }
.lbt-r { width:30px; height:30px; border-radius:8px; display:inline-flex; align-items:center; justify-content:center; font-size:12px; font-weight:800; }
.lbt-r1 { background:rgba(255,215,0,.1); color:#ffd700; border:1px solid rgba(255,215,0,.22); }
.lbt-r2 { background:rgba(192,192,192,.09); color:#c0c0c0; border:1px solid rgba(192,192,192,.2); }
.lbt-r3 { background:rgba(205,127,50,.09); color:#cd7f32; border:1px solid rgba(205,127,50,.2); }
.lbt-rn { background:rgba(255,255,255,.04); color:#3f3f46; border:1px solid rgba(255,255,255,.06); font-size:10px; }

/* ── stat cards ── */
.scg { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:24px; }
.sc  { background:#111113; border:1px solid rgba(255,255,255,.07); border-radius:14px; padding:18px; position:relative; overflow:hidden; }
.sc::after { content:''; position:absolute; bottom:0; left:0; right:0; height:2px; }
.sc-c::after { background:linear-gradient(90deg,transparent,#22d3ee,transparent); }
.sc-g::after { background:linear-gradient(90deg,transparent,#22c55e,transparent); }
.sc-p::after { background:linear-gradient(90deg,transparent,#d946ef,transparent); }
.sc-a::after { background:linear-gradient(90deg,transparent,#f59e0b,transparent); }
.sc-ico { width:32px; height:32px; border-radius:9px; display:flex; align-items:center; justify-content:center; margin-bottom:12px; }
.sc-lbl { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:#71717a; margin-bottom:4px; }
.sc-val { font-size:26px; font-weight:900; letter-spacing:-.04em; line-height:1; }
.sc-sub { font-size:10px; color:#27272a; margin-top:4px; }

.bar-list { display:flex; flex-direction:column; gap:8px; }
.bar-item { background:#111113; border:1px solid rgba(255,255,255,.07); border-radius:12px; padding:14px 18px; }
.bar-row  { display:flex; justify-content:space-between; align-items:center; margin-bottom:9px; }
.bar-gn   { display:flex; align-items:center; gap:10px; font-weight:700; color:#fafafa; font-size:13px; }
.bar-mts  { display:flex; gap:12px; font-size:11px; }
.bar-trk  { height:4px; background:rgba(255,255,255,.05); border-radius:2px; overflow:hidden; }
.bar-fill { height:100%; background:linear-gradient(90deg,#22d3ee,#d946ef); border-radius:2px; transition:width .5s cubic-bezier(.23,1,.32,1); }

/* ── admin ── */
.admin-strip { display:flex; gap:10px; margin-bottom:20px; }
.asc { flex:1; background:#111113; border:1px solid rgba(255,255,255,.07); border-radius:12px; padding:16px; }
.asc-val { font-size:24px; font-weight:900; letter-spacing:-.03em; color:#fafafa; }
.asc-lbl { font-size:9.5px; color:#71717a; margin-top:3px; text-transform:uppercase; letter-spacing:.07em; }
.atbl { width:100%; border-collapse:collapse; background:#111113; border:1px solid rgba(255,255,255,.07); border-radius:14px; overflow:hidden; }
.atbl th { padding:10px 18px; text-align:left; font-size:9.5px; font-weight:700; text-transform:uppercase; letter-spacing:.1em; color:#27272a; background:rgba(255,255,255,.02); border-bottom:1px solid rgba(255,255,255,.07); }
.atbl td { padding:13px 18px; border-bottom:1px solid rgba(255,255,255,.05); font-size:12.5px; color:#71717a; vertical-align:middle; }
.atbl tr:last-child td { border-bottom:none; }
.atbl tr:hover td { background:rgba(255,255,255,.025); }
.rtag { display:inline-flex; align-items:center; padding:2px 10px; border-radius:20px; font-size:10px; font-weight:700; }
.rt-m { background:rgba(217,70,239,.1); color:#d946ef; border:1px solid rgba(217,70,239,.2); }
.rt-u { background:rgba(255,255,255,.05); color:#71717a; border:1px solid rgba(255,255,255,.08); }
.rt-a { background:rgba(34,197,94,.08); color:#22c55e; border:1px solid rgba(34,197,94,.18); }
.rt-b { background:rgba(244,63,94,.08); color:#f43f5e; border:1px solid rgba(244,63,94,.18); }
.act { display:inline-flex; align-items:center; gap:4px; padding:4px 12px; border-radius:7px; font-size:11px; font-weight:600; font-family:inherit; cursor:pointer; transition:all .15s; border:1px solid; background:none; }
.a-ban   { color:#f43f5e; border-color:rgba(244,63,94,.2); }
.a-ban:hover   { background:rgba(244,63,94,.08); }
.a-unban { color:#22c55e; border-color:rgba(34,197,94,.2); }
.a-unban:hover { background:rgba(34,197,94,.08); }
.a-del   { color:#71717a; border-color:rgba(255,255,255,.07); }
.a-del:hover   { color:#f43f5e; border-color:rgba(244,63,94,.2); }

/* ── empty / loading ── */
.empty { background:#111113; border:1px solid rgba(255,255,255,.07); border-radius:14px; padding:52px 24px; text-align:center; display:flex; flex-direction:column; align-items:center; }
.empty-ico  { width:44px; height:44px; border-radius:12px; background:rgba(255,255,255,.04); display:flex; align-items:center; justify-content:center; margin:0 auto 16px; }
.empty-t    { font-size:15px; font-weight:700; color:#a1a1aa; margin-bottom:7px; }
.empty-s    { color:#71717a; font-size:12.5px; max-width:260px; }
.empty-btn  { margin-top:18px; padding:9px 26px; background:linear-gradient(135deg,#22d3ee,#d946ef); border:none; border-radius:9px; color:#09090b; font-size:12.5px; font-weight:800; font-family:inherit; cursor:pointer; }
.loading    { min-height:100vh; background:#09090b; display:flex; align-items:center; justify-content:center; flex-direction:column; gap:14px; }
.spinner    { width:36px; height:36px; border:2.5px solid rgba(34,211,238,.1); border-top-color:#22d3ee; border-radius:50%; animation:spin .7s linear infinite; }

@media(max-width:900px) {
  .sb { display:none; }
  .ct { padding:16px; }
  .scg { grid-template-columns:1fr 1fr; }
  .gc-grid { grid-template-columns:1fr; }
}
`;

// ── scroll reveal hook ─────────────────────────────────────────────────────────
function useScrollReveal(containerRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const cards = el.querySelectorAll<HTMLElement>(".gc");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const card = entry.target as HTMLElement;
            const idx  = parseInt(card.dataset.idx || "0", 10);
            card.style.animationDelay = `${idx * 60}ms`;
            card.classList.add("show");
            observer.unobserve(card);
          }
        });
      },
      { threshold: 0.08 }
    );
    cards.forEach((c) => observer.observe(c));
    return () => observer.disconnect();
  }, []); // run once on mount
}

// ── component ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const contentRef = useRef<HTMLDivElement>(null);

  const [user,     setUser]     = useState<User | null>(null);
  const [tab,      setTab]      = useState<Tab>("games");
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [filter,   setFilter]   = useState("all");
  const [search,   setSearch]   = useState("");
  const [loading,  setLoading]  = useState(true);
  const [collapsed,setCollapsed]= useState<Record<string,boolean>>({});
  const [banned,   setBanned]   = useState<Set<string>>(new Set());

  useScrollReveal(contentRef);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.replace("/login"); return; }
      const { data: refreshed } = await supabase.auth.refreshSession();
      setUser(refreshed.session?.user || data.session.user);
      setSessions(getSessions());
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!s) router.replace("/login"); else setUser(s.user);
    });
    return () => subscription.unsubscribe();
  }, [router]);

  async function signOut() { await supabase.auth.signOut(); router.push("/login"); }

  if (loading || !user) return (
    <><style>{CSS}</style>
      <div className="loading">
        <div className="spinner" />
        <span style={{ color:"#71717a", fontSize:12 }}>Loading arcade…</span>
      </div>
    </>
  );

  const name     = getDisplayName(user);
  const initials = name.slice(0, 2).toUpperCase();
  const mentor   = isMentor(user);

  const totalMs    = totalTimePlayed(sessions);
  const byGame     = sessionsByGame(sessions);
  const bestScores = bestScoreByGame(sessions);
  const avgAcc     = avgAccuracyByGame(sessions);

  const lbRows = ALL_GAMES
    .map(g => ({ ...g, count:(byGame[g.id]||[]).length, best:bestScores[g.id]??null, accuracy:avgAcc[g.id]??null, lastPlayed:byGame[g.id]?.[byGame[g.id].length-1]?.timestamp??null }))
    .filter(r => r.count > 0).sort((a,b) => (b.best??0)-(a.best??0));

  const visible = ALL_GAMES.filter(g => {
    const mf = filter === "all" || g.cat.toLowerCase() === filter;
    const ms = !search || g.name.toLowerCase().includes(search.toLowerCase()) || g.desc.toLowerCase().includes(search.toLowerCase());
    return mf && ms;
  });
  const visCats = CATS.filter(c => visible.some(g => g.cat === c.tag));

  const tabs = [
    { id:"games" as Tab,       label:"Games",       icon:NAV.games },
    { id:"leaderboard" as Tab, label:"Leaderboard", icon:NAV.lb    },
    { id:"stats" as Tab,       label:"Statistics",  icon:NAV.stats },
    ...(mentor ? [{ id:"admin" as Tab, label:"Admin", icon:NAV.admin }] : []),
  ];

  const PAGE: Record<Tab,{t:string;s:string}> = {
    games:       { t:"Game Arcade",  s:`${ALL_GAMES.length} games available` },
    leaderboard: { t:"Leaderboard",  s:"Your personal best scores"          },
    stats:       { t:"Statistics",   s:"Your performance overview"          },
    admin:       { t:"Admin Panel",  s:"Mentor controls & user management"  },
  };

  // global card index for stagger offset across all categories
  let cardIdx = 0;

  return (
    <>
      <style>{CSS}</style>
      <div className="d">

        {/* ── sidebar ── */}
        <aside className="sb">
          <div className="sb-top">
            <Link href="/" className="sb-logo">
              <div className="sb-mark">{NAV.logo}</div>
              <span className="sb-name">TradArcade</span>
            </Link>
          </div>
          <nav className="sb-nav">
            <div className="sb-lbl">Menu</div>
            {tabs.map(t => (
              <button key={t.id} className={`sb-btn${tab===t.id?" on":""}`} onClick={() => setTab(t.id)}>
                <span style={{ opacity:.65 }}>{t.icon}</span>
                {t.label}
                {t.id==="games"       && <span className="sb-badge">{ALL_GAMES.length}</span>}
                {t.id==="leaderboard" && lbRows.length>0 && <span className="sb-badge">{lbRows.length}</span>}
                {t.id==="admin"       && <span className="sb-mbadge">Mentor</span>}
              </button>
            ))}
          </nav>
          <div className="sb-foot">
            <div className="sb-av">{initials}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div className="sb-un">{name}</div>
              <div className="sb-ue">{user.email}</div>
            </div>
            <button className="sb-out" onClick={signOut} title="Sign out">{NAV.logout}</button>
          </div>
        </aside>

        {/* ── main ── */}
        <div className="mn">
          <header className="tb">
            <div>
              <div className="tb-t">{PAGE[tab].t}</div>
              <div className="tb-s">{PAGE[tab].s}</div>
            </div>
            {tab==="games" && (
              <div className="tb-srch">
                {NAV.search}
                <input placeholder="Search games…" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            )}
          </header>

          <div className="ct" ref={contentRef}>

            {/* ═══ GAMES ═══════════════════════════ */}
            {tab==="games" && (
              <div key="g">
                <div className="wl">
                  <div>
                    <div className="wl-n">Welcome back, {name.split(" ")[0]}</div>
                    <div className="wl-s">Your progress saves automatically. Pick up where you left off.</div>
                  </div>
                  <div className="wl-stats">
                    <div className="wl-st"><span className="wl-v">{sessions.length}</span><div className="wl-l">Sessions</div></div>
                    <div className="wl-st"><span className="wl-v">{Object.keys(byGame).length}</span><div className="wl-l">Played</div></div>
                    <div className="wl-st"><span className="wl-v" style={{ color:"#d946ef" }}>{fmtTime(totalMs)}</span><div className="wl-l">Time</div></div>
                  </div>
                </div>

                <div className="fb">
                  <span className="fbl">Category:</span>
                  {["all","trading","vocabulary","reflexes","arcade","speed","memory"].map(f => (
                    <button key={f} className={`chip${filter===f?" on":""}`} onClick={() => setFilter(f)}>
                      {f==="all" ? "All" : f.charAt(0).toUpperCase()+f.slice(1)}
                    </button>
                  ))}
                </div>

                {visCats.length === 0 && (
                  <div className="empty">
                    <div className="empty-ico">{NAV.search}</div>
                    <div className="empty-t">No games found</div>
                    <p className="empty-s">Try a different search or clear the filter.</p>
                    <button className="empty-btn" onClick={() => { setSearch(""); setFilter("all"); }}>Clear</button>
                  </div>
                )}

                {visCats.map(cat => {
                  const catGames = visible.filter(g => g.cat === cat.tag);
                  const open     = !collapsed[cat.tag];
                  return (
                    <div key={cat.tag} className="cg">
                      <div className="cg-hd" style={{ background:cat.dim, borderColor:cat.border }}
                        onClick={() => setCollapsed(p => ({ ...p, [cat.tag]:!p[cat.tag] }))}>
                        <div className="cg-dot" style={{ background:cat.accent }} />
                        <div style={{ flex:1 }}>
                          <div className="cg-label" style={{ color:cat.accent }}>{cat.tag}</div>
                          <div className="cg-sub">{cat.desc}</div>
                        </div>
                        <div className="cg-cnt" style={{ color:cat.accent }}>{catGames.length} game{catGames.length!==1?"s":""}</div>
                        <div className={`cg-chev${open?" open":""}`} style={{ color:cat.accent }}>{NAV.chev}</div>
                      </div>

                      {open && (
                        <div className="gc-grid">
                          {catGames.map(game => {
                            const cnt  = (byGame[game.id]||[]).length;
                            const best = bestScores[game.id];
                            const dc   = DIFF_COLOR[game.diff] || "#71717a";
                            const idx  = cardIdx++;
                            const icon = GAME_ICONS[game.id];
                            return (
                              <Link
                                key={game.id}
                                href={`/sample-mentor/${game.path}`}
                                className="gc"
                                data-idx={idx}
                                style={{
                                  "--gc-accent":      game.accent,
                                  "--gc-dim":         `${game.accent}14`,
                                  "--gc-border":      `${game.accent}33`,
                                  "--gc-glow":        `${game.accent}0a`,
                                  "--gc-play-hover":  `${game.accent}22`,
                                } as React.CSSProperties}
                              >
                                {/* top */}
                                <div className="gc-top">
                                  <div className="gc-icon">{icon}</div>
                                  <div className="gc-badges">
                                    <span className="gc-cat" style={{ background:`${game.accent}18`, border:`1px solid ${game.accent}44`, color:game.accent }}>{game.cat}</span>
                                    <span className="gc-diff" style={{ color:dc }}>{game.diff}</span>
                                  </div>
                                </div>
                                {/* body */}
                                <div className="gc-body">
                                  <div className="gc-name">{game.name}</div>
                                  <div className="gc-desc">{game.desc}</div>
                                  <div className="gc-foot">
                                    <span className="gc-meta">{cnt>0 ? `${cnt}× played` : "Not played yet"}</span>
                                    {best!==undefined && <span className="gc-best">Best: {best}</span>}
                                  </div>
                                </div>
                                {/* play */}
                                <div className="gc-play">
                                  {NAV.play} Play Now
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ═══ LEADERBOARD ═════════════════════ */}
            {tab==="leaderboard" && (
              <div key="lb">
                {lbRows.length===0 ? (
                  <div className="empty">
                    <div className="empty-ico">{NAV.lb}</div>
                    <div className="empty-t">No scores yet</div>
                    <p className="empty-s">Play games to start ranking your personal bests.</p>
                    <button className="empty-btn" onClick={() => setTab("games")}>Browse Games</button>
                  </div>
                ) : (
                  <table className="lbt">
                    <thead><tr><th>Rank</th><th>Game</th><th>Best Score</th><th>Accuracy</th><th>Sessions</th><th>Last Played</th></tr></thead>
                    <tbody>
                      {lbRows.map((r,i) => (
                        <tr key={r.id}>
                          <td><span className={`lbt-r lbt-r${i<3?i+1:"n"}`}>{i===0?"1st":i===1?"2nd":i===2?"3rd":`#${i+1}`}</span></td>
                          <td>
                            <div style={{ display:"flex", alignItems:"center", gap:11 }}>
                              <div style={{ width:34, height:34, borderRadius:9, background:`${r.accent}14`, border:`1px solid ${r.accent}33`, display:"flex", alignItems:"center", justifyContent:"center", color:r.accent, flexShrink:0 }}>
                                <div style={{ width:20, height:20 }}>{GAME_ICONS[r.id]}</div>
                              </div>
                              <div>
                                <div style={{ fontWeight:700, color:"#fafafa", fontSize:13 }}>{r.name}</div>
                                <div style={{ fontSize:10, color:"#71717a" }}>{r.cat}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ fontSize:17, fontWeight:900, color:"#22d3ee", letterSpacing:"-.02em" }}>{r.best??"-"}</td>
                          <td>{r.accuracy!=null?<span style={{ color:"#22c55e", fontWeight:700 }}>{Math.round(r.accuracy*100)}%</span>:<span style={{ color:"#27272a" }}>-</span>}</td>
                          <td>{r.count}</td>
                          <td style={{ fontSize:11 }}>{r.lastPlayed?fmtDate(r.lastPlayed):"-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* ═══ STATS ═══════════════════════════ */}
            {tab==="stats" && (
              <div key="st">
                <div className="scg">
                  {[
                    { lbl:"Sessions",     ico:NAV.games, acc:"c", val:sessions.length,   color:"#22d3ee", sub:`${Object.keys(byGame).length} games tried`,   ibg:"rgba(34,211,238,.08)"  },
                    { lbl:"Time Played",  ico:NAV.stats, acc:"p", val:fmtTime(totalMs),  color:"#d946ef", sub:"total game time",                              ibg:"rgba(217,70,239,.08)"  },
                    { lbl:"Explored",     ico:NAV.lb,    acc:"g", val:Object.keys(byGame).length, color:"#22c55e", sub:`of ${ALL_GAMES.length} available`,    ibg:"rgba(34,197,94,.08)"   },
                    { lbl:"Avg Accuracy", ico:NAV.admin, acc:"a", val:(()=>{ const v=Object.values(avgAcc).filter(x=>x>0); return v.length?`${Math.round(v.reduce((a,b)=>a+b,0)/v.length*100)}%`:"—"; })(), color:"#f59e0b", sub:"across all games", ibg:"rgba(245,158,11,.08)" },
                  ].map(s => (
                    <div key={s.lbl} className={`sc sc-${s.acc}`}>
                      <div className="sc-ico" style={{ background:s.ibg }}>{s.ico}</div>
                      <div className="sc-lbl">{s.lbl}</div>
                      <div className="sc-val" style={{ color:s.color }}>{s.val}</div>
                      <div className="sc-sub">{s.sub}</div>
                    </div>
                  ))}
                </div>
                {sessions.length===0 ? (
                  <div className="empty">
                    <div className="empty-ico">{NAV.stats}</div>
                    <div className="empty-t">No data yet</div>
                    <p className="empty-s">Play games to start tracking your performance.</p>
                    <button className="empty-btn" onClick={() => setTab("games")}>Start Playing</button>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize:9.5, fontWeight:700, textTransform:"uppercase", letterSpacing:".1em", color:"#27272a", marginBottom:10 }}>Per-Game Breakdown</div>
                    <div className="bar-list">
                      {ALL_GAMES.filter(g => byGame[g.id]?.length).map(game => {
                        const gs=byGame[game.id]||[], best=bestScores[game.id], acc=avgAcc[game.id], time=totalTimePlayed(gs);
                        const maxB=Math.max(...Object.values(bestScores).filter(Boolean),1), pct=best?Math.round((best/maxB)*100):0;
                        return (
                          <div key={game.id} className="bar-item">
                            <div className="bar-row">
                              <div className="bar-gn">
                                <div style={{ width:28,height:28,borderRadius:8,background:`${game.accent}14`,border:`1px solid ${game.accent}33`,display:"flex",alignItems:"center",justifyContent:"center",color:game.accent,flexShrink:0 }}>
                                  <div style={{ width:16,height:16 }}>{GAME_ICONS[game.id]}</div>
                                </div>
                                {game.name}
                              </div>
                              <div className="bar-mts">
                                <span style={{ color:"#71717a" }}>{gs.length} sessions</span>
                                <span style={{ color:"#71717a" }}>{fmtTime(time)}</span>
                                {best!==undefined && <span style={{ color:"#22d3ee", fontWeight:700 }}>Best: {best}</span>}
                                {acc>0 && <span style={{ color:"#22c55e", fontWeight:700 }}>{Math.round(acc*100)}% acc</span>}
                              </div>
                            </div>
                            {best!==undefined && <div className="bar-trk"><div className="bar-fill" style={{ width:`${pct}%` }} /></div>}
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ textAlign:"right", marginTop:14 }}>
                      <button onClick={() => { clearSessions(); setSessions([]); }} style={{ background:"none", border:"1px solid rgba(244,63,94,.18)", borderRadius:7, padding:"5px 14px", color:"#f43f5e", fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>
                        Clear all stats
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ═══ ADMIN (mentor only) ═════════════ */}
            {tab==="admin" && mentor && (
              <div key="adm">
                {/* stat strip */}
                <div className="admin-strip">
                  {[
                    { val:ALL_GAMES.length,            lbl:"Total Games",    color:"#22d3ee" },
                    { val:Object.keys(byGame).length,  lbl:"Games Played",   color:"#22c55e" },
                    { val:sessions.length,             lbl:"Your Sessions",  color:"#f59e0b" },
                    { val:banned.size,                 lbl:"Banned Users",   color:"#f43f5e" },
                  ].map(s => (
                    <div key={s.lbl} className="asc" style={{ borderTop:`2px solid ${s.color}` }}>
                      <div className="asc-val" style={{ color:s.color }}>{s.val}</div>
                      <div className="asc-lbl">{s.lbl}</div>
                    </div>
                  ))}
                </div>

                {/* mentor identity */}
                <div style={{ background:"rgba(217,70,239,.06)", border:"1px solid rgba(217,70,239,.18)", borderRadius:14, padding:"18px 22px", marginBottom:18, display:"flex", alignItems:"center", justifyContent:"space-between", gap:20 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                    <div style={{ width:44, height:44, borderRadius:12, background:"rgba(217,70,239,.12)", border:"1px solid rgba(217,70,239,.25)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                      {NAV.admin}
                    </div>
                    <div>
                      <div style={{ fontSize:15, fontWeight:800, color:"#fafafa", marginBottom:3 }}>Mentor Access Active</div>
                      <div style={{ fontSize:11.5, color:"#71717a" }}>You have elevated permissions. Manage games, content, and student access below.</div>
                    </div>
                  </div>
                  <span style={{ background:"rgba(217,70,239,.12)", border:"1px solid rgba(217,70,239,.25)", borderRadius:20, padding:"4px 14px", fontSize:10, fontWeight:800, color:"#d946ef", textTransform:"uppercase", letterSpacing:".08em", flexShrink:0 }}>Mentor</span>
                </div>

                {/* quick actions */}
                <div style={{ fontSize:9.5, fontWeight:700, textTransform:"uppercase", letterSpacing:".1em", color:"#27272a", marginBottom:10 }}>Quick Actions</div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(240px, 1fr))", gap:12, marginBottom:22 }}>
                  {[
                    { label:"Configure Games",   sub:"Edit game content & toggle games on/off",  href:"/mentor",     icon:NAV.games,  accent:"#22d3ee" },
                    { label:"View All Players",  sub:"Browse student scores across all games",    href:"/stats",      icon:NAV.stats,  accent:"#22c55e" },
                    { label:"Preview Hub",       sub:"See the student-facing arcade hub",         href:"/sample-mentor", icon:NAV.lb, accent:"#f59e0b" },
                  ].map(a => (
                    <Link key={a.label} href={a.href} style={{
                      display:"flex", alignItems:"center", gap:14, padding:"16px 18px",
                      background:"#111113", border:`1px solid rgba(255,255,255,.07)`,
                      borderRadius:12, textDecoration:"none", transition:"border-color .15s, background .15s",
                    }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${a.accent}44`; (e.currentTarget as HTMLElement).style.background = `${a.accent}07`; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,.07)"; (e.currentTarget as HTMLElement).style.background = "#111113"; }}
                    >
                      <div style={{ width:36, height:36, borderRadius:10, background:`${a.accent}14`, border:`1px solid ${a.accent}30`, display:"flex", alignItems:"center", justifyContent:"center", color:a.accent, flexShrink:0 }}>
                        {a.icon}
                      </div>
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:"#fafafa", marginBottom:2 }}>{a.label}</div>
                        <div style={{ fontSize:11, color:"#71717a" }}>{a.sub}</div>
                      </div>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3f3f46" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink:0, marginLeft:"auto" }}><path d="M9 18l6-6-6-6"/></svg>
                    </Link>
                  ))}
                </div>

                {/* role management */}
                <div style={{ fontSize:9.5, fontWeight:700, textTransform:"uppercase", letterSpacing:".1em", color:"#27272a", marginBottom:10 }}>Role Management via Supabase SQL</div>
                <div style={{ background:"#111113", border:"1px solid rgba(255,255,255,.07)", borderRadius:12, overflow:"hidden", marginBottom:18 }}>
                  <div style={{ padding:"12px 18px", borderBottom:"1px solid rgba(255,255,255,.06)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <span style={{ fontSize:12, fontWeight:700, color:"#a1a1aa" }}>Grant Mentor Role</span>
                    <span style={{ fontSize:10, color:"#3f3f46" }}>Run in Supabase SQL Editor</span>
                  </div>
                  <pre style={{ margin:0, padding:"14px 18px", fontSize:11.5, fontFamily:"var(--font-geist-mono,'Courier New',monospace)", color:"#22d3ee", lineHeight:1.7, overflowX:"auto", background:"rgba(34,211,238,.03)" }}>
{`UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}', '"mentor"'
)
WHERE email = 'student@example.com';`}
                  </pre>
                </div>
                <div style={{ background:"#111113", border:"1px solid rgba(255,255,255,.07)", borderRadius:12, overflow:"hidden" }}>
                  <div style={{ padding:"12px 18px", borderBottom:"1px solid rgba(255,255,255,.06)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <span style={{ fontSize:12, fontWeight:700, color:"#a1a1aa" }}>Revoke Mentor Role</span>
                    <span style={{ fontSize:10, color:"#3f3f46" }}>Run in Supabase SQL Editor</span>
                  </div>
                  <pre style={{ margin:0, padding:"14px 18px", fontSize:11.5, fontFamily:"var(--font-geist-mono,'Courier New',monospace)", color:"#f43f5e", lineHeight:1.7, overflowX:"auto", background:"rgba(244,63,94,.02)" }}>
{`UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data - 'role'
WHERE email = 'student@example.com';`}
                  </pre>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}
