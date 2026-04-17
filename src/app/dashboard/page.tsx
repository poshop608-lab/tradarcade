"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import MentorshipsTab from "./mentorships-tab";
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

type Tab = "games" | "leaderboard" | "stats" | "mentorships" | "admin" | "community";

type MembershipInfo = {
  id: string; name: string; accent_color: string; description: string;
  logo: string; tagline: string; rules: string[]; active_game_ids: string[];
  mentor_name: string; social_link: string; category: string;
};

type UserRecord = {
  id: string; email: string; display_name: string; role: string; created_at: string;
};

// ── nav SVGs ──────────────────────────────────────────────────────────────────
const NAV = {
  logo:   <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><polyline points="2 14 6 9 9 12 13 6 17 10 22 5"/><line x1="2" y1="20" x2="22" y2="20" strokeOpacity=".25"/></svg>,
  games:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M12 10v4M10 12h4"/></svg>,
  lb:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 6H3v16h5V6zM14 2H10v20h4V2zM20 10h-4v12h4V10z"/></svg>,
  stats:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 3v18h18"/><path d="M7 16l4-4 4 4 5-5"/></svg>,
  admin:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  mship:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
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
  font-family:var(--font-jakarta,-apple-system,system-ui,sans-serif);
  color:#fafafa;
  font-size:14px;
  line-height:1.6;
}

/* ── sidebar ── */
.sb {
  width:228px; flex-shrink:0; height:100vh; position:sticky; top:0;
  display:flex; flex-direction:column;
  background:#0b0b0e;
  border-right:1px solid rgba(255,255,255,.06);
}
.sb-top  { padding:16px 14px 12px; border-bottom:1px solid rgba(255,255,255,.06); }
.sb-logo { display:flex; align-items:center; gap:9px; text-decoration:none; }
.sb-mark {
  width:34px; height:34px; border-radius:10px; flex-shrink:0;
  background:linear-gradient(135deg,rgba(34,211,238,.18),rgba(129,140,248,.14));
  border:1px solid rgba(34,211,238,.25);
  display:flex; align-items:center; justify-content:center;
  box-shadow:0 0 14px rgba(34,211,238,.18), 0 0 4px rgba(34,211,238,.1) inset;
}
.sb-name {
  font-size:15px; font-weight:800; letter-spacing:-.03em;
  background:linear-gradient(115deg,#67e8f9 20%,#a5b4fc 80%);
  -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
  font-family:var(--font-jakarta), system-ui, sans-serif;
}

.sb-nav  { padding:12px 8px; flex:1; overflow-y:auto; }
.sb-lbl  { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.12em; color:#3f3f46; padding:0 8px; margin:8px 0 5px; }
.sb-btn  {
  display:flex; align-items:center; gap:9px; width:100%; padding:8px 10px; border-radius:8px;
  border:1px solid transparent; background:none; color:#71717a; font-size:13px; font-weight:600;
  cursor:pointer; transition:all .15s; font-family:inherit; text-align:left; margin-bottom:2px;
}
.sb-btn:hover  { background:rgba(255,255,255,.04); color:#a1a1aa; }
.sb-btn.on     { background:rgba(34,211,238,.08); border-color:rgba(34,211,238,.2); color:#22d3ee; box-shadow:0 0 12px rgba(34,211,238,.07); }
.sb-badge      { margin-left:auto; background:rgba(255,255,255,.06); color:#52525b; border-radius:20px; padding:1px 8px; font-size:9.5px; font-weight:700; }
.sb-btn.on .sb-badge { background:rgba(34,211,238,.14); color:#67e8f9; }
.sb-mbadge     { margin-left:auto; background:rgba(217,70,239,.12); color:#d946ef; border-radius:20px; padding:2px 9px; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; }

.sb-foot { padding:10px 12px; border-top:1px solid rgba(255,255,255,.06); display:flex; align-items:center; gap:9px; }
.sb-av   { width:30px; height:30px; border-radius:50%; flex-shrink:0; background:linear-gradient(135deg,rgba(34,211,238,.25),rgba(217,70,239,.2)); border:1px solid rgba(34,211,238,.25); display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:800; color:#22d3ee; box-shadow:0 0 10px rgba(34,211,238,.15); }
.sb-un   { font-size:12px; font-weight:700; color:#fafafa; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.sb-ue   { font-size:10px; color:#3f3f46; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.sb-out  { width:26px; height:26px; flex-shrink:0; border-radius:7px; border:1px solid rgba(255,255,255,.06); background:none; color:#3f3f46; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all .15s; }
.sb-out:hover { border-color:rgba(244,63,94,.35); color:#f43f5e; }

/* ── main ── */
.mn  { flex:1; min-width:0; display:flex; flex-direction:column; min-height:100vh; }
.tb  {
  height:62px; display:flex; align-items:center; justify-content:space-between;
  padding:0 28px; border-bottom:1px solid rgba(255,255,255,.07);
  background:rgba(8,9,12,.92); backdrop-filter:blur(18px);
  position:sticky; top:0; z-index:40; flex-shrink:0;
  gap:16px;
}
.tb::after {
  content:''; position:absolute; bottom:0; left:0; right:0; height:1px;
  background:linear-gradient(90deg,transparent 5%,rgba(34,211,238,.18) 30%,rgba(129,140,248,.12) 70%,transparent 95%);
  pointer-events:none;
}
.tb-left { display:flex; align-items:center; gap:12px; min-width:0; }
.tb-icon {
  width:34px; height:34px; border-radius:9px; flex-shrink:0;
  display:flex; align-items:center; justify-content:center;
  background:rgba(34,211,238,.08); border:1px solid rgba(34,211,238,.15);
  color:#22d3ee;
}
.tb-t  { font-size:15px; font-weight:800; color:#fafafa; letter-spacing:-.02em; }
.tb-s  { font-size:10.5px; color:#3f3f46; margin-top:1px; }
.tb-right { display:flex; align-items:center; gap:10px; flex-shrink:0; }
.tb-srch {
  display:flex; align-items:center; gap:7px;
  background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.07);
  border-radius:9px; padding:7px 13px; transition:border-color .2s, box-shadow .2s;
}
.tb-srch:focus-within { border-color:rgba(34,211,238,.3); box-shadow:0 0 0 3px rgba(34,211,238,.06); }
.tb-srch input { background:none; border:none; outline:none; color:#fafafa; font-size:12.5px; font-family:inherit; width:190px; transition:width .2s; }
.tb-srch input:focus { width:230px; }
.tb-srch input::placeholder { color:#3f3f46; }
.tb-role {
  display:inline-flex; align-items:center; gap:5px; padding:5px 12px; border-radius:20px;
  font-size:9.5px; font-weight:800; text-transform:uppercase; letter-spacing:.07em;
  flex-shrink:0;
}
.tb-role-mentor { background:rgba(217,70,239,.1); border:1px solid rgba(217,70,239,.25); color:#d946ef; }
.tb-role-member { background:rgba(34,211,238,.1); border:1px solid rgba(34,211,238,.25); color:#22d3ee; }
.tb-user-chip {
  display:flex; align-items:center; gap:7px; padding:5px 10px 5px 5px;
  background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.07);
  border-radius:20px; flex-shrink:0;
}
.tb-av {
  width:26px; height:26px; border-radius:50%;
  background:linear-gradient(135deg,rgba(34,211,238,.25),rgba(217,70,239,.2));
  border:1px solid rgba(34,211,238,.25); display:flex; align-items:center; justify-content:center;
  font-size:9.5px; font-weight:800; color:#22d3ee; flex-shrink:0;
}
.tb-uname { font-size:12px; font-weight:700; color:#a1a1aa; }

/* ── role management form */
.role-form-wrap { background:#111113; border:1px solid rgba(255,255,255,.08); border-radius:14px; padding:22px; margin-bottom:20px; }
.role-form-row  { display:flex; gap:8px; align-items:center; }
.role-input {
  flex:1; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.09);
  border-radius:9px; padding:10px 14px; color:#fafafa; font-size:13px;
  font-family:inherit; outline:none; transition:border-color .15s;
}
.role-input:focus { border-color:rgba(34,211,238,.4); }
.role-input::placeholder { color:#3f3f46; }
.role-btn-grant { padding:10px 18px; border-radius:9px; font-size:12.5px; font-weight:700; border:1px solid rgba(34,211,238,.3); background:rgba(34,211,238,.09); color:#22d3ee; cursor:pointer; font-family:inherit; transition:all .15s; flex-shrink:0; }
.role-btn-grant:hover { background:rgba(34,211,238,.16); }
.role-btn-revoke { padding:10px 18px; border-radius:9px; font-size:12.5px; font-weight:700; border:1px solid rgba(244,63,94,.25); background:rgba(244,63,94,.07); color:#f43f5e; cursor:pointer; font-family:inherit; transition:all .15s; flex-shrink:0; }
.role-btn-revoke:hover { background:rgba(244,63,94,.14); }
.role-msg-ok  { display:flex; align-items:center; gap:6px; font-size:12px; font-weight:600; color:#22c55e; margin-top:10px; }
.role-msg-err { display:flex; align-items:center; gap:6px; font-size:12px; font-weight:600; color:#f43f5e; margin-top:10px; }

/* ── users panel */
.users-panel { background:#111113; border:1px solid rgba(255,255,255,.08); border-radius:14px; overflow:hidden; margin-bottom:20px; }
.users-head  { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:16px 20px; border-bottom:1px solid rgba(255,255,255,.06); }
.users-search{ flex:1; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08); border-radius:8px; padding:8px 12px 8px 32px; color:#fafafa; font-size:12.5px; font-family:inherit; outline:none; transition:border-color .15s; }
.users-search:focus { border-color:rgba(34,211,238,.35); }
.users-search::placeholder { color:#3f3f46; }
.users-search-wrap { position:relative; flex:1; }
.users-search-wrap svg { position:absolute; left:10px; top:50%; transform:translateY(-50%); pointer-events:none; }
.users-reload { display:inline-flex; align-items:center; gap:5px; padding:7px 14px; border-radius:8px; font-size:11.5px; font-weight:700; border:1px solid rgba(255,255,255,.09); background:rgba(255,255,255,.04); color:#a1a1aa; cursor:pointer; font-family:inherit; transition:all .15s; flex-shrink:0; }
.users-reload:hover { background:rgba(255,255,255,.08); color:#fafafa; }
.users-tbl  { width:100%; border-collapse:collapse; }
.users-tbl th { padding:9px 16px; text-align:left; font-size:9.5px; font-weight:700; text-transform:uppercase; letter-spacing:.1em; color:#3f3f46; background:rgba(255,255,255,.02); border-bottom:1px solid rgba(255,255,255,.05); }
.users-tbl td { padding:11px 16px; border-bottom:1px solid rgba(255,255,255,.04); vertical-align:middle; }
.users-tbl tr:last-child td { border-bottom:none; }
.users-tbl tr:hover td { background:rgba(255,255,255,.02); }
.u-av { width:32px; height:32px; border-radius:9px; background:rgba(34,211,238,.1); border:1px solid rgba(34,211,238,.2); display:inline-flex; align-items:center; justify-content:center; font-size:12px; font-weight:800; color:#22d3ee; flex-shrink:0; }
.u-name { font-size:13px; font-weight:700; color:#fafafa; }
.u-email { font-size:11px; color:#52525b; margin-top:1px; }
.u-badge { display:inline-flex; align-items:center; padding:2px 9px; border-radius:20px; font-size:9.5px; font-weight:800; text-transform:uppercase; letter-spacing:.06em; }
.u-badge-mentor  { background:rgba(217,70,239,.1); border:1px solid rgba(217,70,239,.25); color:#d946ef; }
.u-badge-student { background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); color:#52525b; }
.u-acts { display:flex; align-items:center; gap:6px; }
.u-btn-grant  { padding:5px 11px; border-radius:7px; font-size:10.5px; font-weight:700; border:1px solid rgba(34,211,238,.25); background:rgba(34,211,238,.07); color:#22d3ee; cursor:pointer; font-family:inherit; transition:all .15s; white-space:nowrap; }
.u-btn-grant:hover { background:rgba(34,211,238,.14); }
.u-btn-grant:disabled { opacity:.4; cursor:not-allowed; }
.u-btn-revoke { padding:5px 11px; border-radius:7px; font-size:10.5px; font-weight:700; border:1px solid rgba(244,63,94,.2); background:rgba(244,63,94,.06); color:#f43f5e; cursor:pointer; font-family:inherit; transition:all .15s; white-space:nowrap; }
.u-btn-revoke:hover { background:rgba(244,63,94,.12); }
.u-btn-revoke:disabled { opacity:.4; cursor:not-allowed; }
.u-msg-ok  { font-size:10.5px; font-weight:600; color:#22c55e; white-space:nowrap; }
.u-msg-err { font-size:10.5px; font-weight:600; color:#f43f5e; white-space:nowrap; }
.users-empty { padding:40px 20px; text-align:center; color:#3f3f46; font-size:13px; }

/* ── community tab */
.cm-hero {
  border-radius:18px; padding:24px 28px; margin-bottom:24px;
  position:relative; overflow:hidden;
  display:flex; align-items:center; gap:20px;
}
.cm-hero::before {
  content:''; position:absolute; top:0; left:0; right:0; height:2px;
  background:linear-gradient(90deg,transparent,var(--cm-accent,#22d3ee),transparent);
}
.cm-hero::after {
  content:''; position:absolute; inset:0; pointer-events:none;
  background:radial-gradient(ellipse 70% 80% at 10% 0%, var(--cm-dim,rgba(34,211,238,.05)), transparent);
}
.cm-av {
  width:64px; height:64px; border-radius:16px; flex-shrink:0;
  display:flex; align-items:center; justify-content:center;
  font-size:26px; font-weight:900; color:#09090b;
  box-shadow:0 6px 20px rgba(0,0,0,.4);
  position:relative; z-index:1;
}
.cm-info { flex:1; min-width:0; position:relative; z-index:1; }
.cm-name { font-size:22px; font-weight:800; letter-spacing:-.03em; color:#fafafa; margin-bottom:3px; }
.cm-tag  { font-size:12px; color:#a1a1aa; font-weight:500; }
.cm-meta { display:flex; align-items:center; gap:8px; margin-top:6px; flex-wrap:wrap; }
.cm-pill { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:20px; font-size:10px; font-weight:700; }
.cm-status { position:relative; z-index:1; }
.cm-active { display:inline-flex; align-items:center; gap:6px; padding:6px 14px; border-radius:20px; font-size:11px; font-weight:700; background:rgba(34,197,94,.1); border:1px solid rgba(34,197,94,.25); color:#22c55e; }
.cm-active-dot { width:7px; height:7px; border-radius:50%; background:#22c55e; box-shadow:0 0 6px rgba(34,197,94,.6); }
.cm-section-lbl { font-size:9.5px; font-weight:700; text-transform:uppercase; letter-spacing:.1em; color:#3f3f46; margin-bottom:12px; display:flex; align-items:center; gap:10px; }
.cm-section-lbl::after { content:''; flex:1; height:1px; background:rgba(255,255,255,.05); }
.cm-games-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:10px; margin-bottom:28px; }
.cm-game-card {
  background:#111113; border:1px solid rgba(255,255,255,.07); border-radius:12px;
  padding:14px 16px; display:flex; align-items:center; gap:12px;
  transition:border-color .18s, background .18s;
}
.cm-game-card:hover { border-color:var(--cg-accent,rgba(34,211,238,.3)); background:rgba(255,255,255,.025); }
.cm-game-icon { width:36px; height:36px; border-radius:9px; flex-shrink:0; display:flex; align-items:center; justify-content:center; }
.cm-game-name { font-size:12.5px; font-weight:700; color:#fafafa; margin-bottom:2px; }
.cm-game-cat  { font-size:10px; color:#71717a; }
.cm-play-btn {
  margin-left:auto; display:flex; align-items:center; gap:4px;
  padding:5px 12px; border-radius:7px; font-size:11px; font-weight:700;
  background:var(--cg-dim); border:1px solid var(--cg-border); color:var(--cg-accent);
  text-decoration:none; transition:background .15s; flex-shrink:0;
}
.cm-game-card:hover .cm-play-btn { background:var(--cg-hover); }
.cm-rules { display:flex; flex-direction:column; gap:8px; margin-bottom:28px; }
.cm-rule { display:flex; align-items:flex-start; gap:10px; padding:11px 14px; background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.06); border-radius:9px; }
.cm-rule-n { font-size:10px; font-weight:800; color:#52525b; min-width:18px; }
.cm-rule-t { font-size:12.5px; color:#a1a1aa; line-height:1.5; }
.cm-member-card { background:#111113; border:1px solid rgba(255,255,255,.07); border-radius:12px; padding:16px 18px; display:flex; align-items:center; gap:14px; }
.cm-member-av { width:40px; height:40px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:800; border:1px solid rgba(34,211,238,.25); }
.cm-disc-tag { font-family:monospace; font-size:11.5px; background:rgba(88,101,242,.12); border:1px solid rgba(88,101,242,.25); border-radius:6px; padding:2px 8px; color:#818cf8; }

.ct { flex:1; padding:28px; overflow-y:auto; }

/* ── welcome ── */
.wl {
  background:linear-gradient(135deg,rgba(34,211,238,.08),rgba(217,70,239,.06));
  border:1px solid rgba(34,211,238,.18); border-radius:18px;
  padding:22px 28px; margin-bottom:28px;
  display:flex; align-items:center; justify-content:space-between; gap:20px;
  position:relative; overflow:hidden;
  animation: fadeIn .4s ease both;
  box-shadow: 0 0 40px rgba(34,211,238,.05), 0 0 80px rgba(217,70,239,.04);
}
.wl::before {
  content:''; position:absolute; top:0; left:0; right:0; height:1px;
  background:linear-gradient(90deg,transparent,rgba(34,211,238,.65),rgba(217,70,239,.5),transparent);
}
.wl::after {
  content:''; position:absolute; bottom:0; left:0; right:0; height:60px;
  background:radial-gradient(ellipse 60% 100% at 30% 100%, rgba(34,211,238,.06), transparent);
  pointer-events:none;
}
.wl-n  { font-size:19px; font-weight:800; letter-spacing:-.025em; color:#fafafa; margin-bottom:3px; }
.wl-s  { color:#71717a; font-size:12.5px; }
.wl-stats { display:flex; gap:0; flex-shrink:0; }
.wl-st { text-align:center; padding:0 20px; }
.wl-st + .wl-st { border-left:1px solid rgba(255,255,255,.06); }
.wl-v { font-size:22px; font-weight:900; letter-spacing:-.04em; color:#22d3ee; display:block; line-height:1; text-shadow:0 0 20px rgba(34,211,238,.4); }
.wl-l { font-size:9.5px; color:#71717a; text-transform:uppercase; letter-spacing:.08em; margin-top:4px; font-weight:700; }

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
  transform:translateY(-5px);
  border-color:var(--gc-accent, rgba(34,211,238,.35));
  box-shadow:0 20px 56px rgba(0,0,0,.55), 0 0 0 1px var(--gc-accent, rgba(34,211,238,.2)), 0 0 30px var(--gc-glow, rgba(34,211,238,.08));
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
.gc-mentor-pick {
  display:inline-flex; align-items:center; gap:4px;
  padding:2px 8px; border-radius:20px; font-size:8.5px; font-weight:800;
  background:linear-gradient(115deg,rgba(34,211,238,.15),rgba(129,140,248,.12));
  border:1px solid rgba(34,211,238,.3); color:#22d3ee;
  text-transform:uppercase; letter-spacing:.06em;
}

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
// dep changes whenever tab switches or loading completes, so cards are
// re-observed after they mount (cards start at opacity:0 and need .show)
function useScrollReveal(containerRef: React.RefObject<HTMLDivElement | null>, dep: string) {
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const cards = el.querySelectorAll<HTMLElement>(".gc");
    if (cards.length === 0) return;
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
  }, [dep]);
}

// ── component ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const contentRef = useRef<HTMLDivElement>(null);

  const [user,           setUser]          = useState<User | null>(null);
  const [tab,            setTab]           = useState<Tab>("games");
  const [sessions,       setSessions]      = useState<GameSession[]>([]);
  const [filter,         setFilter]        = useState("all");
  const [search,         setSearch]        = useState("");
  const [loading,        setLoading]       = useState(true);
  const [collapsed,      setCollapsed]     = useState<Record<string,boolean>>({});
  const [banned,         setBanned]        = useState<Set<string>>(new Set());
  const [recommendedIds, setRecommendedIds]= useState<Set<string>>(new Set());
  const [myMembership,   setMyMembership]  = useState<MembershipInfo | null>(null);
  const [adminEmail,     setAdminEmail]    = useState("");
  const [roleMsg,        setRoleMsg]       = useState("");
  const [roleLoading,    setRoleLoading]   = useState(false);
  const [allUsers,       setAllUsers]      = useState<UserRecord[]>([]);
  const [usersLoading,   setUsersLoading]  = useState(false);
  const [usersError,     setUsersError]    = useState("");
  const [userSearch,     setUserSearch]    = useState("");
  const [userRoleMsg,    setUserRoleMsg]   = useState<Record<string, string>>({});
  const [userRoleLoad,   setUserRoleLoad]  = useState<Record<string, boolean>>({});
  const [lbMode,         setLbMode]        = useState<"personal"|"community">("personal");
  const [communityLb,    setCommunityLb]   = useState<{game_id:string;game_name:string;score:number;user_id:string}[]>([]);
  const [communityTotal, setCommunityTotal]= useState<number>(0);

  useScrollReveal(contentRef, `${tab}${loading}`);

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

  useEffect(() => {
    if (!user) return;
    supabase.from("mentorships").select("active_game_ids").eq("is_public", true).then(({ data }) => {
      if (!data) return;
      const ids = new Set<string>(data.flatMap(m => m.active_game_ids ?? []));
      setRecommendedIds(ids);
    });
  }, [user]);

  useEffect(() => {
    if (!user || isMentor(user)) return;
    supabase.from("mentorship_join_requests")
      .select("mentorship_id")
      .eq("email", user.email ?? "")
      .eq("status", "accepted")
      .limit(1)
      .maybeSingle()
      .then(async ({ data }) => {
        if (data?.mentorship_id) {
          const { data: ms } = await supabase.from("mentorships").select("*").eq("id", data.mentorship_id).single();
          if (ms) setMyMembership(ms as MembershipInfo);
        }
      });
  }, [user]);

  // Auto-load all users when admin tab opens
  useEffect(() => {
    if (tab === "admin" && mentor && allUsers.length === 0 && !usersLoading) {
      loadAllUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Fetch community leaderboard from Supabase game_sessions table
  useEffect(() => {
    if (!user) return;
    supabase
      .from("game_sessions")
      .select("game_id, game_name, score, user_id")
      .not("score", "is", null)
      .order("score", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (data && data.length > 0) setCommunityLb(data as {game_id:string;game_name:string;score:number;user_id:string}[]);
      });
    supabase
      .from("game_sessions")
      .select("id", { count: "exact", head: true })
      .then(({ count }) => {
        if (count != null) setCommunityTotal(count);
      });
  }, [user]);

  async function handleSetRole(email: string, grant: boolean) {
    if (!email.trim()) { setRoleMsg("Enter an email address first."); return; }
    setRoleLoading(true); setRoleMsg("");
    const { data, error } = await supabase.rpc("set_user_mentor_role", {
      target_email: email.trim(), grant_role: grant,
    });
    setRoleLoading(false);
    if (error) setRoleMsg(`Error: ${error.message}`);
    else if (data?.error) setRoleMsg(`Error: ${data.error}`);
    else setRoleMsg(data?.message ?? "Done");
    setTimeout(() => setRoleMsg(""), 6000);
  }

  async function loadAllUsers() {
    setUsersLoading(true);
    setUsersError("");
    const { data, error } = await supabase.rpc("list_all_users");
    setUsersLoading(false);
    if (error) {
      setUsersError(error.message || "Failed to load users. The list_all_users RPC may not exist — see SQL below.");
    } else if (data) {
      setAllUsers(data as UserRecord[]);
    }
  }

  async function handleUserRole(u: UserRecord, grant: boolean) {
    setUserRoleLoad(p => ({ ...p, [u.id]: true }));
    setUserRoleMsg(p => ({ ...p, [u.id]: "" }));
    const { data, error } = await supabase.rpc("set_user_mentor_role", {
      target_email: u.email, grant_role: grant,
    });
    setUserRoleLoad(p => ({ ...p, [u.id]: false }));
    const msg = error ? `Error: ${error.message}` : (data?.error ? `Error: ${data.error}` : (grant ? "Mentor role granted" : "Role revoked"));
    setUserRoleMsg(p => ({ ...p, [u.id]: msg }));
    setAllUsers(prev => prev.map(r => r.id === u.id ? { ...r, role: grant ? "mentor" : "student" } : r));
    setTimeout(() => setUserRoleMsg(p => ({ ...p, [u.id]: "" })), 4000);
  }

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

  // Filter games by mentorship assignment when user has an active membership
  const membershipGameIds = myMembership?.active_game_ids;
  const visible = ALL_GAMES.filter(g => {
    if (membershipGameIds?.length && !membershipGameIds.includes(g.id)) return false;
    const mf = filter === "all" || g.cat.toLowerCase() === filter;
    const ms = !search || g.name.toLowerCase().includes(search.toLowerCase()) || g.desc.toLowerCase().includes(search.toLowerCase());
    return mf && ms;
  });
  const visCats = CATS.filter(c => visible.some(g => g.cat === c.tag));

  const communityIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;

  const tabs = [
    { id:"games"        as Tab, label:"Games",                     icon:NAV.games     },
    ...(myMembership ? [{ id:"community" as Tab, label:myMembership.name, icon:communityIcon }] : []),
    { id:"mentorships"  as Tab, label:"Mentorships",               icon:NAV.mship     },
    { id:"leaderboard"  as Tab, label:"Leaderboard",               icon:NAV.lb        },
    { id:"stats"        as Tab, label:"Statistics",                icon:NAV.stats     },
    ...(mentor ? [{ id:"admin" as Tab, label:"Admin",              icon:NAV.admin }] : []),
  ];

  const PAGE: Record<Tab,{t:string;s:string;icon:React.ReactElement}> = {
    games:       { t:"Game Arcade",   s: membershipGameIds?.length ? `${visible.length} games from your mentorship` : `${ALL_GAMES.length} games available`, icon:NAV.games },
    community:   { t:myMembership?.name ?? "My Community", s:"Your mentorship community",icon:communityIcon },
    mentorships: { t:"Mentorships",   s:"Browse and manage trading communities",         icon:NAV.mship     },
    leaderboard: { t:"Leaderboard",   s: lbMode === "community" ? `${communityTotal} community sessions` : "Your personal best scores", icon:NAV.lb },
    stats:       { t:"Statistics",    s:"Your performance overview",                     icon:NAV.stats     },
    admin:       { t:"Admin Panel",   s:"Mentor controls & user management",             icon:NAV.admin     },
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
              <span className="sb-name">TradeArcade</span>
            </Link>
          </div>
          <nav className="sb-nav">
            <div className="sb-lbl">Menu</div>
            {tabs.map(t => (
              <button key={t.id}
                className={`sb-btn${tab===t.id?" on":""}`}
                onClick={() => setTab(t.id)}
                style={t.id==="community" && myMembership ? {
                  "--sb-comm-accent": myMembership.accent_color,
                } as React.CSSProperties : {}}
              >
                <span style={{ opacity: tab===t.id ? 1 : .6, color: t.id==="community" && myMembership ? myMembership.accent_color : undefined }}>
                  {t.icon}
                </span>
                {t.label}
                {t.id==="games"       && <span className="sb-badge">{ALL_GAMES.length}</span>}
                {t.id==="leaderboard" && lbRows.length>0 && <span className="sb-badge">{lbRows.length}</span>}
                {t.id==="admin"       && <span className="sb-mbadge">Mentor</span>}
                {t.id==="community"   && <span style={{ marginLeft:"auto", width:7, height:7, borderRadius:"50%", background:myMembership?.accent_color ?? "#22d3ee", boxShadow:`0 0 6px ${myMembership?.accent_color ?? "#22d3ee"}` }} />}
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
            <div className="tb-left">
              <div className="tb-icon" style={tab==="community" && myMembership ? { background:`${myMembership.accent_color}14`, borderColor:`${myMembership.accent_color}30`, color:myMembership.accent_color } : {}}>
                {PAGE[tab].icon}
              </div>
              <div>
                <div className="tb-t">{PAGE[tab].t}</div>
                <div className="tb-s">{PAGE[tab].s}</div>
              </div>
            </div>
            <div className="tb-right">
              {tab==="games" && (
                <div className="tb-srch">
                  {NAV.search}
                  <input placeholder="Search games…" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
              )}
              {mentor && (
                <span className="tb-role tb-role-mentor">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  Mentor
                </span>
              )}
              {!mentor && myMembership && (
                <span className="tb-role tb-role-member" style={{ background:`${myMembership.accent_color}12`, borderColor:`${myMembership.accent_color}30`, color:myMembership.accent_color }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                  Member
                </span>
              )}
              <div className="tb-user-chip">
                <div className="tb-av">{initials}</div>
                <span className="tb-uname">{name.split(" ")[0]}</span>
              </div>
            </div>
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
                                    {recommendedIds.has(game.id) && (
                                      <span className="gc-mentor-pick">
                                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                                        Mentor Pick
                                      </span>
                                    )}
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

            {/* ═══ MY COMMUNITY ════════════════════ */}
            {tab==="community" && myMembership && (() => {
              const ms = myMembership;
              const ac = ms.accent_color;
              const hexDimLocal = (hex: string, o: number) => { const h=hex.replace("#",""); const r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16); return `rgba(${r},${g},${b},${o})`; };
              return (
                <div key="comm">
                  {/* Hero */}
                  <div className="cm-hero" style={{ background:`linear-gradient(135deg,${hexDimLocal(ac,.08)},rgba(129,140,248,.04))`, border:`1px solid ${hexDimLocal(ac,.22)}`, "--cm-accent":ac, "--cm-dim":hexDimLocal(ac,.05) } as React.CSSProperties}>
                    <div className="cm-av" style={{ background: ms.logo ? "transparent" : ac, overflow:"hidden" }}>
                      {ms.logo ? <img src={ms.logo} alt="logo" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : (ms.name||"?")[0].toUpperCase()}
                    </div>
                    <div className="cm-info">
                      <div className="cm-name">{ms.name}</div>
                      {ms.tagline && <div className="cm-tag">{ms.tagline}</div>}
                      <div className="cm-meta">
                        <span style={{ fontSize:11.5, color:"#71717a" }}>by {ms.mentor_name || "Mentor"}</span>
                        {ms.category && ms.category !== "General" && (
                          <span className="cm-pill" style={{ background:hexDimLocal(ac,.1), border:`1px solid ${hexDimLocal(ac,.25)}`, color:ac }}>{ms.category}</span>
                        )}
                        <span className="cm-pill" style={{ background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.08)", color:"#71717a" }}>{ms.active_game_ids?.length ?? 0} games</span>
                        {ms.social_link && (
                          <a href={ms.social_link} target="_blank" rel="noopener noreferrer"
                            style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:11, fontWeight:700, color:ac, textDecoration:"none" }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                            Community Link
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="cm-status">
                      <span className="cm-active"><span className="cm-active-dot" /> Active Member</span>
                    </div>
                  </div>

                  {/* Featured Games */}
                  {ms.active_game_ids?.length > 0 && (
                    <>
                      <div className="cm-section-lbl">Featured Games — {ms.active_game_ids.length} picked by your mentor</div>
                      <div className="cm-games-grid">
                        {ms.active_game_ids.map(gid => {
                          const g = ALL_GAMES.find(x => x.id === gid);
                          if (!g) return null;
                          return (
                            <div key={gid} className="cm-game-card"
                              style={{ "--cg-accent":g.accent, "--cg-dim":`${g.accent}12`, "--cg-border":`${g.accent}28`, "--cg-hover":`${g.accent}20` } as React.CSSProperties}>
                              <div className="cm-game-icon" style={{ background:`${g.accent}12`, border:`1px solid ${g.accent}28`, color:g.accent }}>
                                <div style={{ width:20, height:20 }}>{GAME_ICONS[g.id]}</div>
                              </div>
                              <div>
                                <div className="cm-game-name">{g.name}</div>
                                <div className="cm-game-cat">{g.cat}</div>
                              </div>
                              <Link href={`/sample-mentor/${g.path}`} className="cm-play-btn">
                                {NAV.play} Play
                              </Link>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {/* Rules */}
                  {ms.rules?.filter((r: string) => r.trim()).length > 0 && (
                    <>
                      <div className="cm-section-lbl">Community Rules</div>
                      <div className="cm-rules">
                        {ms.rules.filter((r: string) => r.trim()).map((rule: string, i: number) => (
                          <div key={i} className="cm-rule">
                            <span className="cm-rule-n">{i+1}</span>
                            <span className="cm-rule-t">{rule}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {/* My member card */}
                  <div className="cm-section-lbl">Your Membership</div>
                  <div className="cm-member-card" style={{ border:`1px solid ${hexDimLocal(ac,.2)}` }}>
                    <div className="cm-member-av" style={{ background:hexDimLocal(ac,.15), color:ac }}>
                      {initials}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:"#fafafa", marginBottom:3 }}>{name}</div>
                      <div style={{ fontSize:11.5, color:"#71717a" }}>{user.email}</div>
                    </div>
                    <span className="cm-pill" style={{ background:"rgba(34,197,94,.09)", border:"1px solid rgba(34,197,94,.22)", color:"#22c55e", fontSize:10, fontWeight:800 }}>
                      ✓ Accepted
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* ═══ MENTORSHIPS ═════════════════════ */}
            {tab==="mentorships" && (
              <MentorshipsTab
                key="mship"
                user={user}
                isMentor={mentor}
                displayName={name}
              />
            )}

            {/* ═══ LEADERBOARD ═════════════════════ */}
            {tab==="leaderboard" && (
              <div key="lb">
                {/* Mode toggle */}
                <div style={{ display:"flex", gap:6, marginBottom:20 }}>
                  {(["personal","community"] as const).map(m => (
                    <button key={m} onClick={() => setLbMode(m)} style={{
                      padding:"6px 16px", borderRadius:20, fontFamily:"inherit", fontSize:11, fontWeight:700,
                      border:"1px solid", cursor:"pointer", transition:"all .15s",
                      ...(lbMode===m
                        ? { background:"rgba(34,211,238,.1)", borderColor:"rgba(34,211,238,.3)", color:"#22d3ee" }
                        : { background:"transparent", borderColor:"rgba(255,255,255,.08)", color:"#52525b" }),
                    }}>
                      {m === "personal" ? "My Scores" : `Community${communityLb.length > 0 ? ` (${communityLb.length})` : ""}`}
                    </button>
                  ))}
                </div>

                {/* Personal leaderboard */}
                {lbMode==="personal" && (
                  lbRows.length===0 ? (
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
                  )
                )}

                {/* Community leaderboard */}
                {lbMode==="community" && (
                  communityLb.length===0 ? (
                    <div className="empty">
                      <div className="empty-ico">{NAV.lb}</div>
                      <div className="empty-t">No community scores yet</div>
                      <p className="empty-s">
                        Community data is stored in Supabase. Make sure the{" "}
                        <code style={{ fontSize:11, background:"rgba(255,255,255,.06)", padding:"1px 6px", borderRadius:4 }}>game_sessions</code>{" "}
                        table has been created and game sessions are being recorded to the database.
                      </p>
                    </div>
                  ) : (() => {
                    // Group by game, find top score per game
                    const gameMap = new Map<string, {game_id:string;game_name:string;topScore:number;plays:number}>();
                    communityLb.forEach(r => {
                      const existing = gameMap.get(r.game_id);
                      if (!existing) {
                        gameMap.set(r.game_id, { game_id:r.game_id, game_name:r.game_name, topScore:r.score, plays:1 });
                      } else {
                        existing.plays++;
                        if (r.score > existing.topScore) existing.topScore = r.score;
                      }
                    });
                    const rows = [...gameMap.values()].sort((a,b) => b.topScore - a.topScore);
                    return (
                      <table className="lbt">
                        <thead><tr><th>Rank</th><th>Game</th><th>Top Score (Community)</th><th>Total Plays</th></tr></thead>
                        <tbody>
                          {rows.map((r,i) => {
                            const g = ALL_GAMES.find(x => x.id === r.game_id);
                            return (
                              <tr key={r.game_id}>
                                <td><span className={`lbt-r lbt-r${i<3?i+1:"n"}`}>{i===0?"1st":i===1?"2nd":i===2?"3rd":`#${i+1}`}</span></td>
                                <td>
                                  <div style={{ display:"flex", alignItems:"center", gap:11 }}>
                                    {g && (
                                      <div style={{ width:34, height:34, borderRadius:9, background:`${g.accent}14`, border:`1px solid ${g.accent}33`, display:"flex", alignItems:"center", justifyContent:"center", color:g.accent, flexShrink:0 }}>
                                        <div style={{ width:20, height:20 }}>{GAME_ICONS[g.id]}</div>
                                      </div>
                                    )}
                                    <div>
                                      <div style={{ fontWeight:700, color:"#fafafa", fontSize:13 }}>{r.game_name || g?.name || r.game_id}</div>
                                      {g && <div style={{ fontSize:10, color:"#71717a" }}>{g.cat}</div>}
                                    </div>
                                  </div>
                                </td>
                                <td style={{ fontSize:17, fontWeight:900, color:"#22d3ee", letterSpacing:"-.02em" }}>{r.topScore}</td>
                                <td style={{ color:"#71717a", fontSize:13 }}>{r.plays} plays</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    );
                  })()
                )}
              </div>
            )}

            {/* ═══ STATS ═══════════════════════════ */}
            {tab==="stats" && (
              <div key="st">
                {/* Community stats banner (from Supabase) */}
                {communityTotal > 0 && (
                  <div style={{ background:"linear-gradient(135deg,rgba(34,211,238,.07),rgba(217,70,239,.05))", border:"1px solid rgba(34,211,238,.18)", borderRadius:14, padding:"14px 20px", marginBottom:20, display:"flex", alignItems:"center", justifyContent:"space-between", gap:20 }}>
                    <div>
                      <div style={{ fontSize:9.5, fontWeight:700, textTransform:"uppercase", letterSpacing:".1em", color:"#22d3ee", marginBottom:4 }}>Community Stats</div>
                      <div style={{ fontSize:13, color:"#a1a1aa" }}>
                        <strong style={{ color:"#fafafa", fontSize:17 }}>{communityTotal.toLocaleString()}</strong> total sessions played across the whole platform
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:20, flexShrink:0 }}>
                      <div style={{ textAlign:"center" }}>
                        <div style={{ fontSize:20, fontWeight:900, color:"#22d3ee" }}>{new Set(communityLb.map(r=>r.user_id)).size}</div>
                        <div style={{ fontSize:9.5, color:"#71717a", textTransform:"uppercase", letterSpacing:".06em" }}>Players</div>
                      </div>
                      <div style={{ textAlign:"center" }}>
                        <div style={{ fontSize:20, fontWeight:900, color:"#d946ef" }}>{new Set(communityLb.map(r=>r.game_id)).size}</div>
                        <div style={{ fontSize:9.5, color:"#71717a", textTransform:"uppercase", letterSpacing:".06em" }}>Games</div>
                      </div>
                    </div>
                  </div>
                )}
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
                    { val:ALL_GAMES.length,                                  lbl:"Total Games",         color:"#22d3ee" },
                    { val:communityTotal > 0 ? communityTotal : sessions.length, lbl: communityTotal > 0 ? "Community Sessions" : "Your Sessions", color:"#f59e0b" },
                    { val:new Set(communityLb.map(r=>r.user_id)).size || allUsers.length, lbl:"Players", color:"#22c55e" },
                    { val:banned.size,                                        lbl:"Banned Users",        color:"#f43f5e" },
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
                  {([
                    { label:"Configure Games",   sub:"Edit game content & toggle games on/off",  href:"/mentor",        isLink:true,  icon:NAV.games,  accent:"#22d3ee" },
                    { label:"View All Players",  sub:"Browse all registered players below",       href:"#all-users",     isLink:false, icon:NAV.stats,  accent:"#22c55e" },
                    { label:"Preview Hub",       sub:"See the student-facing arcade hub",         href:"/sample-mentor", isLink:true,  icon:NAV.lb,     accent:"#f59e0b" },
                  ] as const).map(a => {
                    const cardStyle: React.CSSProperties = {
                      display:"flex", alignItems:"center", gap:14, padding:"16px 18px",
                      background:"#111113", border:`1px solid rgba(255,255,255,.07)`,
                      borderRadius:12, textDecoration:"none", transition:"border-color .15s, background .15s",
                      cursor:"pointer", width:"100%", textAlign:"left",
                    };
                    const onEnter = (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.borderColor = `${a.accent}44`; e.currentTarget.style.background = `${a.accent}07`; };
                    const onLeave = (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.borderColor = "rgba(255,255,255,.07)"; e.currentTarget.style.background = "#111113"; };
                    const inner = (
                      <>
                        <div style={{ width:36, height:36, borderRadius:10, background:`${a.accent}14`, border:`1px solid ${a.accent}30`, display:"flex", alignItems:"center", justifyContent:"center", color:a.accent, flexShrink:0 }}>
                          {a.icon}
                        </div>
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:700, color:"#fafafa", marginBottom:2 }}>{a.label}</div>
                          <div style={{ fontSize:11, color:"#71717a" }}>{a.sub}</div>
                        </div>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3f3f46" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink:0, marginLeft:"auto" }}><path d="M9 18l6-6-6-6"/></svg>
                      </>
                    );
                    return a.isLink ? (
                      <Link key={a.label} href={a.href} style={cardStyle} onMouseEnter={onEnter} onMouseLeave={onLeave}>{inner}</Link>
                    ) : (
                      <button key={a.label} style={cardStyle} onMouseEnter={onEnter} onMouseLeave={onLeave}
                        onClick={() => document.getElementById("all-users")?.scrollIntoView({ behavior:"smooth" })}>
                        {inner}
                      </button>
                    );
                  })}
                </div>

                {/* all users */}
                <div id="all-users" style={{ fontSize:9.5, fontWeight:700, textTransform:"uppercase", letterSpacing:".1em", color:"#52525b", marginBottom:12 }}>All Users</div>
                <div className="users-panel">
                  <div className="users-head">
                    <div className="users-search-wrap">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#52525b" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                      <input
                        className="users-search"
                        placeholder="Search by name or email…"
                        value={userSearch}
                        onChange={e => setUserSearch(e.target.value)}
                      />
                    </div>
                    <button
                      className="users-reload"
                      onClick={loadAllUsers}
                      disabled={usersLoading}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={usersLoading ? { animation:"spin .8s linear infinite" } : {}}><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
                      {usersLoading ? "Loading…" : allUsers.length > 0 ? `${allUsers.length} users` : "Load Users"}
                    </button>
                  </div>
                  {allUsers.length === 0 && !usersLoading && !usersError && (
                    <div className="users-empty">Loading registered accounts…</div>
                  )}
                  {usersError && (
                    <div style={{ padding:"24px 20px" }}>
                      <div style={{ background:"rgba(244,63,94,.07)", border:"1px solid rgba(244,63,94,.2)", borderRadius:10, padding:"14px 18px", marginBottom:16 }}>
                        <div style={{ fontSize:12, fontWeight:700, color:"#f43f5e", marginBottom:4 }}>Could not load users</div>
                        <div style={{ fontSize:11.5, color:"#71717a" }}>{usersError}</div>
                      </div>
                      <div style={{ fontSize:11, color:"#52525b", lineHeight:1.7 }}>
                        To enable this feature, run this SQL in your{" "}
                        <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" style={{ color:"#22d3ee", textDecoration:"none" }}>
                          Supabase dashboard
                        </a>
                        {" "}→ SQL Editor:
                      </div>
                      <pre style={{ marginTop:10, padding:"12px 16px", background:"rgba(255,255,255,.03)", border:"1px solid rgba(255,255,255,.06)", borderRadius:8, fontSize:11, color:"#a1a1aa", overflowX:"auto", lineHeight:1.6 }}>{`create or replace function list_all_users()
returns table (
  id uuid, email text, display_name text,
  role text, created_at timestamptz
)
language plpgsql security definer as $$
begin
  return query
    select
      u.id,
      u.email,
      coalesce(u.raw_user_meta_data->>'display_name',
               u.raw_user_meta_data->>'full_name',
               split_part(u.email,'@',1)) as display_name,
      coalesce(u.raw_app_meta_data->>'role',
               u.raw_user_meta_data->>'role', 'student') as role,
      u.created_at
    from auth.users u
    order by u.created_at desc;
end;
$$;`}</pre>
                    </div>
                  )}
                  {usersLoading && (
                    <div className="users-empty">
                      <div className="spin" style={{ width:20, height:20, margin:"0 auto 8px", borderRadius:"50%", border:"2px solid rgba(34,211,238,.15)", borderTop:"2px solid #22d3ee", animation:"spin .8s linear infinite" }} />
                      Fetching users…
                    </div>
                  )}
                  {allUsers.length > 0 && !usersLoading && (() => {
                    const q = userSearch.toLowerCase();
                    const filtered = q
                      ? allUsers.filter(u => u.email.toLowerCase().includes(q) || u.display_name.toLowerCase().includes(q))
                      : allUsers;
                    return (
                      <table className="users-tbl">
                        <thead><tr>
                          <th>User</th>
                          <th>Role</th>
                          <th>Joined</th>
                          <th>Actions</th>
                        </tr></thead>
                        <tbody>
                          {filtered.map(u => {
                            const initials = (u.display_name || u.email)[0].toUpperCase();
                            const isMentorUser = u.role === "mentor";
                            const loading = userRoleLoad[u.id];
                            const msg = userRoleMsg[u.id] ?? "";
                            return (
                              <tr key={u.id}>
                                <td>
                                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                                    <div className="u-av" style={isMentorUser ? { background:"rgba(217,70,239,.1)", border:"1px solid rgba(217,70,239,.25)", color:"#d946ef" } : {}}>
                                      {initials}
                                    </div>
                                    <div>
                                      <div className="u-name">{u.display_name || u.email.split("@")[0]}</div>
                                      <div className="u-email">{u.email}</div>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <span className={`u-badge ${isMentorUser ? "u-badge-mentor" : "u-badge-student"}`}>
                                    {isMentorUser ? "Mentor" : "Student"}
                                  </span>
                                </td>
                                <td style={{ fontSize:11, color:"#52525b", whiteSpace:"nowrap" }}>
                                  {new Date(u.created_at).toLocaleDateString(undefined, { month:"short", day:"numeric", year:"numeric" })}
                                </td>
                                <td>
                                  <div className="u-acts">
                                    {msg ? (
                                      <span className={msg.startsWith("Error") ? "u-msg-err" : "u-msg-ok"}>{msg}</span>
                                    ) : isMentorUser ? (
                                      <button className="u-btn-revoke" onClick={() => handleUserRole(u, false)} disabled={!!loading}>
                                        {loading ? "…" : "Revoke Mentor"}
                                      </button>
                                    ) : (
                                      <button className="u-btn-grant" onClick={() => handleUserRole(u, true)} disabled={!!loading}>
                                        {loading ? "…" : "Make Mentor"}
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    );
                  })()}
                </div>

                {/* role management */}
                <div style={{ fontSize:9.5, fontWeight:700, textTransform:"uppercase", letterSpacing:".1em", color:"#52525b", marginBottom:12 }}>Role Management</div>
                <div className="role-form-wrap">
                  <div style={{ fontSize:13, fontWeight:700, color:"#fafafa", marginBottom:4 }}>Grant or Revoke Mentor Role</div>
                  <div style={{ fontSize:12, color:"#71717a", marginBottom:16 }}>Enter the user's email address to instantly update their role.</div>
                  <div className="role-form-row">
                    <input
                      className="role-input"
                      type="email"
                      placeholder="user@example.com"
                      value={adminEmail}
                      onChange={e => setAdminEmail(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleSetRole(adminEmail, true)}
                    />
                    <button
                      className="role-btn-grant"
                      onClick={() => handleSetRole(adminEmail, true)}
                      disabled={roleLoading}
                    >
                      {roleLoading ? "…" : "Grant Mentor"}
                    </button>
                    <button
                      className="role-btn-revoke"
                      onClick={() => handleSetRole(adminEmail, false)}
                      disabled={roleLoading}
                    >
                      {roleLoading ? "…" : "Revoke Role"}
                    </button>
                  </div>
                  {roleMsg && (
                    <div className={roleMsg.startsWith("Error") ? "role-msg-err" : "role-msg-ok"}>
                      {roleMsg.startsWith("Error")
                        ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                        : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                      }
                      {roleMsg}
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}
