"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

// ── Types ──────────────────────────────────────────────────────────────────────
type Mentorship = {
  id: string;
  mentor_id: string;
  mentor_name: string;
  name: string;
  description: string;
  accent_color: string;
  rules: string[];
  active_game_ids: string[];
  logo: string;
  tagline: string;
  category: string;
  social_link: string;
  created_at: string;
};

type MentorRequest = {
  id: string;
  user_id: string;
  email: string;
  display_name: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

type JoinRequest = {
  id: string;
  mentorship_id: string;
  full_name: string;
  email: string;
  discord_username: string;
  message: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
};

type FormState = {
  name: string;
  description: string;
  accent_color: string;
  rules: string[];
  active_game_ids: string[];
  logo: string;
  tagline: string;
  category: string;
  social_link: string;
};

// ── Constants ──────────────────────────────────────────────────────────────────
const CATEGORIES = ["General", "Forex", "Crypto", "Stocks", "Futures", "Options"];

const GAMES = [
  { id: "gb-number-quiz",   name: "GB Number Quiz",   cat: "Trading",    accent: "#22d3ee" },
  { id: "ce-matching",      name: "CE Matching",       cat: "Trading",    accent: "#22d3ee" },
  { id: "algo-sorter",      name: "Algo Sorter",       cat: "Trading",    accent: "#22d3ee" },
  { id: "clockwise",        name: "Clockwise",         cat: "Trading",    accent: "#22d3ee" },
  { id: "wordle",           name: "Wordle",            cat: "Vocabulary", accent: "#22c55e" },
  { id: "hangman",          name: "Hangman",           cat: "Vocabulary", accent: "#22c55e" },
  { id: "wheel-of-fortune", name: "Wheel of Fortune",  cat: "Vocabulary", accent: "#22c55e" },
  { id: "flappy-bird",      name: "Flappy Bird",       cat: "Reflexes",   accent: "#f59e0b" },
  { id: "crossy-road",      name: "Crossy Road",       cat: "Reflexes",   accent: "#f59e0b" },
  { id: "asteroids",        name: "Asteroids",         cat: "Arcade",     accent: "#d946ef" },
  { id: "doodle-jump",      name: "Doodle Jump",       cat: "Arcade",     accent: "#d946ef" },
  { id: "whack-a-mole",     name: "Whack-a-Mole",      cat: "Speed",      accent: "#f59e0b" },
  { id: "fruit-ninja",      name: "Fruit Ninja",       cat: "Speed",      accent: "#f43f5e" },
  { id: "memory",           name: "Memory Match",      cat: "Memory",     accent: "#d946ef" },
];

const COLOR_PRESETS = [
  "#22d3ee","#818cf8","#22c55e","#f59e0b","#f43f5e",
  "#d946ef","#06b6d4","#ec4899","#a78bfa","#34d399",
];

const BLANK_FORM: FormState = {
  name: "", description: "", accent_color: "#22d3ee",
  rules: [""], active_game_ids: [],
  logo: "", tagline: "", category: "General", social_link: "",
};

// ── CSS ────────────────────────────────────────────────────────────────────────
const CSS = `
@keyframes ms-fade  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
@keyframes ms-spin  { to{transform:rotate(360deg)} }

.ms-wrap { animation: ms-fade .35s ease both; }

/* ── section label */
.ms-sec-lbl {
  font-size:9.5px; font-weight:700; text-transform:uppercase;
  letter-spacing:.12em; color:#3f3f46; margin-bottom:12px;
  display:flex; align-items:center; gap:10px;
}
.ms-sec-lbl::after { content:''; flex:1; height:1px; background:rgba(255,255,255,.05); }

/* ── my mentorship banner */
.ms-mine {
  background:linear-gradient(135deg,rgba(34,211,238,.06),rgba(129,140,248,.04));
  border:1px solid rgba(34,211,238,.18); border-radius:16px;
  padding:20px 24px; margin-bottom:28px;
  display:flex; align-items:center; justify-content:space-between; gap:20px;
  position:relative; overflow:hidden;
}
.ms-mine::before {
  content:''; position:absolute; top:0; left:0; right:0; height:2px;
  background:linear-gradient(90deg,transparent,var(--ms-accent,#22d3ee),transparent);
}
.ms-mine-av {
  width:52px; height:52px; border-radius:14px; flex-shrink:0;
  display:flex; align-items:center; justify-content:center;
  font-size:22px; font-weight:900; color:#09090b; letter-spacing:-.04em;
}
.ms-mine-info { flex:1; min-width:0; }
.ms-mine-name { font-size:18px; font-weight:800; color:#fafafa; letter-spacing:-.02em; margin-bottom:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ms-mine-meta { font-size:11.5px; color:#71717a; }
.ms-mine-acts { display:flex; gap:8px; flex-shrink:0; }

/* ── action buttons */
.ms-btn {
  display:inline-flex; align-items:center; gap:7px;
  padding:8px 16px; border-radius:9px; font-size:12.5px;
  font-weight:700; cursor:pointer; transition:all .15s;
  font-family:inherit; text-decoration:none; border:1px solid;
}
.ms-btn-primary   { background:rgba(34,211,238,.1);  border-color:rgba(34,211,238,.3);  color:#22d3ee; }
.ms-btn-primary:hover { background:rgba(34,211,238,.18); border-color:#22d3ee; }
.ms-btn-ghost     { background:rgba(255,255,255,.04); border-color:rgba(255,255,255,.08); color:#a1a1aa; }
.ms-btn-ghost:hover { background:rgba(255,255,255,.07); color:#fafafa; }
.ms-btn-danger    { background:rgba(244,63,94,.07);   border-color:rgba(244,63,94,.2);   color:#f43f5e; }
.ms-btn-danger:hover { background:rgba(244,63,94,.14); }
.ms-btn-sm { padding:5px 12px; font-size:11.5px; }
.ms-btn:disabled  { opacity:.5; cursor:not-allowed; }

/* ── form panel */
.ms-form-panel {
  background:#111113; border:1px solid rgba(255,255,255,.08);
  border-radius:16px; padding:28px; margin-bottom:28px;
}
.ms-form-grid { display:grid; grid-template-columns:1fr 1fr; gap:18px; margin-bottom:20px; }
.ms-field { display:flex; flex-direction:column; gap:7px; }
.ms-field.full { grid-column:1/-1; }
.ms-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.09em; color:#71717a; }
.ms-input {
  background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.09);
  border-radius:9px; padding:10px 14px; color:#fafafa;
  font-size:13px; font-family:inherit; outline:none; transition:border-color .15s;
}
.ms-input:focus { border-color:rgba(34,211,238,.4); }
.ms-input::placeholder { color:#3f3f46; }
.ms-textarea { resize:vertical; min-height:80px; }

/* color presets */
.ms-colors { display:flex; gap:8px; flex-wrap:wrap; margin-top:4px; }
.ms-color-dot {
  width:26px; height:26px; border-radius:8px; cursor:pointer;
  border:2px solid transparent; transition:transform .12s, border-color .12s;
}
.ms-color-dot:hover { transform:scale(1.12); }
.ms-color-dot.sel   { border-color:rgba(255,255,255,.7); transform:scale(1.1); }

/* rules editor */
.ms-rules-list { display:flex; flex-direction:column; gap:8px; }
.ms-rule-row { display:flex; gap:8px; align-items:center; }
.ms-rule-num { width:22px; height:22px; border-radius:6px; background:rgba(255,255,255,.06); display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:700; color:#71717a; flex-shrink:0; }
.ms-rule-del { width:28px; height:28px; border-radius:7px; border:1px solid rgba(255,255,255,.07); background:none; color:#3f3f46; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all .15s; flex-shrink:0; }
.ms-rule-del:hover { border-color:rgba(244,63,94,.3); color:#f43f5e; }
.ms-add-rule { display:inline-flex; align-items:center; gap:6px; background:none; border:1px dashed rgba(255,255,255,.1); border-radius:8px; padding:7px 14px; color:#52525b; font-size:12px; font-weight:600; cursor:pointer; transition:all .15s; font-family:inherit; margin-top:4px; }
.ms-add-rule:hover { border-color:rgba(34,211,238,.3); color:#22d3ee; }

/* games selector */
.ms-games-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(130px,1fr)); gap:8px; }
.ms-game-tile {
  padding:10px 12px; border-radius:10px; border:1px solid rgba(255,255,255,.07);
  background:rgba(255,255,255,.02); cursor:pointer; transition:all .15s;
  display:flex; align-items:center; gap:8px; user-select:none;
}
.ms-game-tile:hover { background:rgba(255,255,255,.05); }
.ms-game-tile.on    { background:var(--tile-dim); border-color:var(--tile-accent); }
.ms-game-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
.ms-game-name { font-size:11.5px; font-weight:600; color:#a1a1aa; line-height:1.2; }
.ms-game-tile.on .ms-game-name { color:var(--tile-accent); }
.ms-game-check { margin-left:auto; flex-shrink:0; }
.ms-sel-count { font-size:10px; color:#71717a; margin-top:8px; }

/* logo upload */
.ms-logo-area {
  display:flex; align-items:center; gap:14px;
}
.ms-logo-preview {
  width:56px; height:56px; border-radius:14px; flex-shrink:0;
  display:flex; align-items:center; justify-content:center;
  font-size:22px; font-weight:900; color:#09090b; overflow:hidden;
  border:2px solid rgba(255,255,255,.08); background:#1c1c1f;
}
.ms-logo-preview img { width:100%; height:100%; object-fit:cover; }
.ms-logo-btns { display:flex; flex-direction:column; gap:6px; }
.ms-logo-upload {
  display:inline-flex; align-items:center; gap:6px;
  padding:7px 14px; border-radius:8px; font-size:12px; font-weight:700;
  background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1);
  color:#a1a1aa; cursor:pointer; transition:all .15s; font-family:inherit;
}
.ms-logo-upload:hover { background:rgba(255,255,255,.09); color:#fafafa; }
.ms-logo-clear {
  display:inline-flex; align-items:center; gap:5px;
  padding:5px 12px; border-radius:7px; font-size:11px; font-weight:700;
  background:none; border:1px solid rgba(244,63,94,.2); color:#f43f5e;
  cursor:pointer; transition:all .15s; font-family:inherit;
}
.ms-logo-clear:hover { background:rgba(244,63,94,.08); }
.ms-logo-hint { font-size:10.5px; color:#3f3f46; margin-top:4px; }

/* select */
.ms-select {
  background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.09);
  border-radius:9px; padding:10px 14px; color:#fafafa;
  font-size:13px; font-family:inherit; outline:none; transition:border-color .15s;
  -webkit-appearance:none; appearance:none; cursor:pointer;
  background-image:url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2352525b' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat:no-repeat; background-position:right 12px center;
  padding-right:34px;
}
.ms-select:focus { border-color:rgba(34,211,238,.4); }
.ms-select option { background:#1c1c1f; }

/* category badge in card */
.ms-cat-badge {
  padding:2px 8px; border-radius:20px; font-size:9px; font-weight:800;
  text-transform:uppercase; letter-spacing:.08em;
}

/* social link */
.ms-social-row { display:flex; align-items:center; gap:8px; }
.ms-social-icon { width:32px; height:32px; border-radius:8px; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.09); display:flex; align-items:center; justify-content:center; flex-shrink:0; }

/* form actions */
.ms-form-foot { display:flex; align-items:center; justify-content:space-between; padding-top:20px; border-top:1px solid rgba(255,255,255,.06); margin-top:4px; }
.ms-save-msg { font-size:12px; font-weight:600; }
.ms-save-ok  { color:#22c55e; }
.ms-save-err { color:#f43f5e; }

/* ── mentorship cards grid */
.ms-grid {
  display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr));
  gap:14px;
}
.ms-card {
  background:#111113; border:1px solid rgba(255,255,255,.07);
  border-radius:16px; overflow:hidden; cursor:pointer;
  transition:transform .2s, box-shadow .2s, border-color .2s;
  display:flex; flex-direction:column;
}
.ms-card:hover {
  transform:translateY(-3px);
  border-color:var(--mc-accent,rgba(34,211,238,.3));
  box-shadow:0 12px 40px rgba(0,0,0,.45), 0 0 0 1px var(--mc-accent,rgba(34,211,238,.15));
}
.ms-card-top {
  padding:20px 20px 14px;
  display:flex; align-items:flex-start; gap:14px;
  position:relative;
}
.ms-card-top::before {
  content:''; position:absolute; top:0; left:0; right:0; height:2px;
  background:linear-gradient(90deg,transparent,var(--mc-accent,#22d3ee),transparent);
}
.ms-card-av {
  width:48px; height:48px; border-radius:13px; flex-shrink:0;
  display:flex; align-items:center; justify-content:center;
  font-size:20px; font-weight:900; color:#09090b;
}
.ms-card-info { flex:1; min-width:0; }
.ms-card-name { font-size:15px; font-weight:800; color:#fafafa; letter-spacing:-.02em; margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ms-card-mentor { font-size:11px; color:#71717a; }
.ms-card-body { padding:0 20px 14px; flex:1; }
.ms-card-desc { font-size:12px; color:#71717a; line-height:1.6; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; margin-bottom:10px; }
.ms-card-tags { display:flex; gap:6px; flex-wrap:wrap; }
.ms-tag { padding:3px 9px; border-radius:20px; font-size:9.5px; font-weight:700; }
.ms-card-foot { padding:12px 20px; border-top:1px solid rgba(255,255,255,.05); display:flex; align-items:center; justify-content:space-between; }
.ms-card-stats { font-size:11px; color:#52525b; }
.ms-card-action { display:flex; align-items:center; gap:5px; padding:6px 14px; border-radius:8px; font-size:11.5px; font-weight:700; background:var(--mc-dim); border:1px solid var(--mc-border); color:var(--mc-accent); transition:background .15s; }
.ms-card:hover .ms-card-action { background:var(--mc-hover); }

/* ── detail drawer */
.ms-detail {
  background:#111113; border:1px solid rgba(255,255,255,.08);
  border-radius:16px; padding:24px; margin-bottom:28px;
}
.ms-detail-head { display:flex; align-items:center; gap:14px; margin-bottom:18px; }
.ms-detail-close { margin-left:auto; background:none; border:1px solid rgba(255,255,255,.08); border-radius:8px; width:30px; height:30px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#71717a; transition:all .15s; flex-shrink:0; }
.ms-detail-close:hover { border-color:rgba(255,255,255,.18); color:#fafafa; }
.ms-detail-av { width:56px; height:56px; border-radius:15px; display:flex; align-items:center; justify-content:center; font-size:24px; font-weight:900; color:#09090b; flex-shrink:0; }
.ms-detail-name { font-size:20px; font-weight:800; letter-spacing:-.025em; color:#fafafa; margin-bottom:3px; }
.ms-detail-sub  { font-size:12px; color:#71717a; }
.ms-detail-desc { font-size:13px; color:#a1a1aa; line-height:1.7; margin-bottom:20px; }
.ms-rules-view { display:flex; flex-direction:column; gap:8px; margin-bottom:20px; }
.ms-rule-view { display:flex; align-items:flex-start; gap:10px; padding:10px 14px; background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.06); border-radius:9px; }
.ms-rule-view-n { font-size:10px; font-weight:800; min-width:18px; color:#52525b; }
.ms-rule-view-t { font-size:12.5px; color:#a1a1aa; line-height:1.5; }
.ms-detail-games { display:flex; flex-wrap:wrap; gap:7px; }
.ms-dg-pill { display:flex; align-items:center; gap:6px; padding:5px 12px; border-radius:20px; font-size:11px; font-weight:600; }

/* ── request banner */
.ms-req-banner {
  background:linear-gradient(135deg,rgba(129,140,248,.06),rgba(34,211,238,.04));
  border:1px solid rgba(129,140,248,.2); border-radius:14px;
  padding:18px 22px; margin-bottom:28px;
  display:flex; align-items:center; justify-content:space-between; gap:16px;
}
.ms-req-form { background:#111113; border:1px solid rgba(255,255,255,.08); border-radius:14px; padding:20px; margin-bottom:28px; }
.ms-req-pending { display:flex; align-items:center; gap:10px; padding:14px 18px; background:rgba(245,158,11,.06); border:1px solid rgba(245,158,11,.2); border-radius:12px; margin-bottom:24px; font-size:12.5px; color:#f59e0b; }

/* ── requests table (admin) */
.ms-req-table-wrap { background:#111113; border:1px solid rgba(255,255,255,.07); border-radius:14px; overflow:hidden; margin-bottom:28px; }
.ms-req-tbl { width:100%; border-collapse:collapse; }
.ms-req-tbl th { padding:10px 16px; text-align:left; font-size:9.5px; font-weight:700; text-transform:uppercase; letter-spacing:.1em; color:#27272a; background:rgba(255,255,255,.02); border-bottom:1px solid rgba(255,255,255,.06); }
.ms-req-tbl td { padding:12px 16px; border-bottom:1px solid rgba(255,255,255,.05); font-size:12.5px; color:#71717a; vertical-align:top; }
.ms-req-tbl tr:last-child td { border-bottom:none; }
.ms-req-tbl tr:hover td { background:rgba(255,255,255,.02); }
.ms-req-reason { font-size:11.5px; color:#52525b; max-width:220px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ms-req-acts { display:flex; gap:6px; }
.ms-act { display:inline-flex; align-items:center; gap:4px; padding:4px 11px; border-radius:7px; font-size:11px; font-weight:700; border:1px solid; background:none; cursor:pointer; font-family:inherit; transition:all .15s; }
.ms-act-ok  { color:#22c55e; border-color:rgba(34,197,94,.25); }
.ms-act-ok:hover  { background:rgba(34,197,94,.09); }
.ms-act-no  { color:#f43f5e; border-color:rgba(244,63,94,.25); }
.ms-act-no:hover  { background:rgba(244,63,94,.09); }
.ms-sql-btn { display:inline-flex; align-items:center; gap:4px; padding:3px 9px; border-radius:6px; font-size:10px; font-weight:700; border:1px solid rgba(34,211,238,.2); background:rgba(34,211,238,.06); color:#22d3ee; cursor:pointer; font-family:inherit; transition:all .15s; }
.ms-sql-btn:hover { background:rgba(34,211,238,.12); }
.ms-copied { color:#22c55e; font-size:10px; font-weight:700; }

/* ── join requests section */
.ms-join-req-wrap { background:#111113; border:1px solid rgba(255,255,255,.07); border-radius:14px; overflow:hidden; margin-bottom:28px; }
.ms-join-req-tbl { width:100%; border-collapse:collapse; }
.ms-join-req-tbl th { padding:10px 16px; text-align:left; font-size:9.5px; font-weight:700; text-transform:uppercase; letter-spacing:.1em; color:#27272a; background:rgba(255,255,255,.02); border-bottom:1px solid rgba(255,255,255,.06); }
.ms-join-req-tbl td { padding:12px 16px; border-bottom:1px solid rgba(255,255,255,.05); font-size:12.5px; color:#71717a; vertical-align:top; }
.ms-join-req-tbl tr:last-child td { border-bottom:none; }
.ms-join-req-tbl tr:hover td { background:rgba(255,255,255,.02); }
.ms-status-badge { display:inline-flex; padding:2px 9px; border-radius:20px; font-size:9.5px; font-weight:700; }
.ms-status-pending  { background:rgba(245,158,11,.1);  border:1px solid rgba(245,158,11,.25);  color:#f59e0b; }
.ms-status-accepted { background:rgba(34,197,94,.1);   border:1px solid rgba(34,197,94,.25);   color:#22c55e; }
.ms-status-rejected { background:rgba(244,63,94,.08);  border:1px solid rgba(244,63,94,.2);    color:#f43f5e; }
.ms-discord-tag { font-family:monospace; font-size:11.5px; background:rgba(88,101,242,.12); border:1px solid rgba(88,101,242,.25); border-radius:6px; padding:1px 7px; color:#818cf8; }

/* ── empty / loading */
.ms-empty { background:#111113; border:1px solid rgba(255,255,255,.07); border-radius:14px; padding:52px 24px; text-align:center; }
.ms-empty-ico { width:48px; height:48px; border-radius:12px; background:rgba(255,255,255,.04); display:flex; align-items:center; justify-content:center; margin:0 auto 14px; }
.ms-empty-t { font-size:15px; font-weight:700; color:#a1a1aa; margin-bottom:6px; }
.ms-empty-s { font-size:12px; color:#52525b; max-width:260px; margin:0 auto; }
.ms-spin { width:18px; height:18px; border:2px solid rgba(34,211,238,.15); border-top-color:#22d3ee; border-radius:50%; animation:ms-spin .7s linear infinite; }

@media(max-width:700px) {
  .ms-form-grid { grid-template-columns:1fr; }
  .ms-grid { grid-template-columns:1fr; }
  .ms-mine { flex-direction:column; align-items:flex-start; }
  .ms-req-banner { flex-direction:column; }
}
`;

// ── helpers ────────────────────────────────────────────────────────────────────
function avatarLetter(name: string) { return (name || "?")[0].toUpperCase(); }
function fmtDate(ts: string) { return new Date(ts).toLocaleDateString(undefined, { month:"short", day:"numeric", year:"numeric" }); }
function hexDim(hex: string, o: number) {
  const h = hex.replace("#","");
  const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
  return `rgba(${r},${g},${b},${o})`;
}

// ── component ──────────────────────────────────────────────────────────────────
interface Props { user: User; isMentor: boolean; displayName: string; }

export default function MentorshipsTab({ user, isMentor, displayName }: Props) {

  const [mentorships,     setMentorships]     = useState<Mentorship[]>([]);
  const [myMentorship,    setMyMentorship]    = useState<Mentorship | null>(null);
  const [myRequest,       setMyRequest]       = useState<MentorRequest | null>(null);
  const [pendingReqs,     setPendingReqs]     = useState<MentorRequest[]>([]);
  const [joinReqs,        setJoinReqs]        = useState<JoinRequest[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [showForm,        setShowForm]        = useState(false);
  const [selected,        setSelected]        = useState<Mentorship | null>(null);
  const [showReqForm,     setShowReqForm]     = useState(false);
  const [reqReason,       setReqReason]       = useState("");
  const [reqLoading,      setReqLoading]      = useState(false);
  const [saving,          setSaving]          = useState(false);
  const [saveMsg,         setSaveMsg]         = useState("");
  const [copied,          setCopied]          = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ ...BLANK_FORM });

  const loadData = useCallback(async () => {
    setLoading(true);

    const { data: mships } = await supabase
      .from("mentorships")
      .select("*")
      .eq("is_public", true)
      .order("created_at", { ascending: false });

    const list: Mentorship[] = mships ?? [];
    setMentorships(list);

    if (isMentor) {
      const mine = list.find(m => m.mentor_id === user.id) ?? null;
      setMyMentorship(mine);
      if (mine) {
        setForm({
          name:            mine.name,
          description:     mine.description ?? "",
          accent_color:    mine.accent_color ?? "#22d3ee",
          rules:           mine.rules?.length ? mine.rules : [""],
          active_game_ids: mine.active_game_ids ?? [],
          logo:            mine.logo ?? "",
          tagline:         mine.tagline ?? "",
          category:        mine.category ?? "General",
          social_link:     mine.social_link ?? "",
        });
      }
      const { data: reqs } = await supabase
        .from("mentor_requests")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      setPendingReqs(reqs ?? []);

      // Fetch join requests for this mentor's mentorship
      if (mine) {
        const { data: joinData } = await supabase
          .from("mentorship_join_requests")
          .select("*")
          .eq("mentorship_id", mine.id)
          .order("created_at", { ascending: false });
        setJoinReqs(joinData ?? []);
      }
    } else {
      const { data: myReq } = await supabase
        .from("mentor_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setMyRequest(myReq ?? null);
    }

    setLoading(false);
  }, [user.id, isMentor]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── form helpers ──────────────────────────────────────────────────────────
  function setRule(idx: number, val: string) {
    setForm(f => { const r = [...f.rules]; r[idx] = val; return { ...f, rules: r }; });
  }
  function addRule() { setForm(f => ({ ...f, rules: [...f.rules, ""] })); }
  function removeRule(idx: number) {
    setForm(f => ({ ...f, rules: f.rules.filter((_, i) => i !== idx) }));
  }
  function toggleGame(id: string) {
    setForm(f => ({
      ...f,
      active_game_ids: f.active_game_ids.includes(id)
        ? f.active_game_ids.filter(g => g !== id)
        : [...f.active_game_ids, id],
    }));
  }

  // ── logo upload ──────────────────────────────────────────────────────────
  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) { setSaveMsg("err:Logo must be under 500 KB."); setTimeout(() => setSaveMsg(""), 3500); return; }
    const reader = new FileReader();
    reader.onload = ev => setForm(f => ({ ...f, logo: (ev.target?.result as string) ?? "" }));
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  // ── save mentorship ───────────────────────────────────────────────────────
  async function handleSave() {
    if (!form.name.trim()) { setSaveMsg("err:Name is required."); return; }
    setSaving(true); setSaveMsg("");

    const payload = {
      mentor_id:       user.id,
      mentor_name:     displayName,
      name:            form.name.trim(),
      description:     form.description.trim(),
      accent_color:    form.accent_color,
      rules:           form.rules.filter(r => r.trim()),
      active_game_ids: form.active_game_ids,
      logo:            form.logo,
      tagline:         form.tagline.trim(),
      category:        form.category,
      social_link:     form.social_link.trim(),
      is_public:       true,
      updated_at:      new Date().toISOString(),
    };

    let error;
    if (myMentorship) {
      ({ error } = await supabase.from("mentorships").update(payload).eq("id", myMentorship.id));
    } else {
      ({ error } = await supabase.from("mentorships").insert(payload));
    }

    if (error) {
      setSaveMsg("err:" + error.message);
    } else {
      setSaveMsg("ok:" + (myMentorship ? "Changes saved!" : "Mentorship created!"));
      setShowForm(false);
      await loadData();
    }
    setSaving(false);
    setTimeout(() => setSaveMsg(""), 4000);
  }

  async function handleDelete() {
    if (!myMentorship) return;
    if (!confirm("Delete your mentorship? This cannot be undone.")) return;
    await supabase.from("mentorships").delete().eq("id", myMentorship.id);
    setMyMentorship(null);
    setForm({ ...BLANK_FORM });
    setShowForm(false);
    await loadData();
  }

  // ── request role ─────────────────────────────────────────────────────────
  async function handleRequestRole() {
    if (!reqReason.trim()) return;
    setReqLoading(true);
    const { error } = await supabase.from("mentor_requests").insert({
      user_id:      user.id,
      email:        user.email ?? "",
      display_name: displayName,
      reason:       reqReason.trim(),
      status:       "pending",
    });
    if (!error) { setShowReqForm(false); setReqReason(""); await loadData(); }
    setReqLoading(false);
  }

  // ── approve / reject mentor role request ─────────────────────────────────
  async function handleRequestAction(id: string, status: "approved" | "rejected") {
    await supabase.from("mentor_requests").update({ status }).eq("id", id);
    await loadData();
  }

  // ── accept / reject join request ─────────────────────────────────────────
  async function handleJoinAction(id: string, status: "accepted" | "rejected") {
    await supabase.from("mentorship_join_requests").update({ status }).eq("id", id);
    setJoinReqs(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  }

  // ── copy SQL helper ───────────────────────────────────────────────────────
  function copyGrantSQL(email: string, reqId: string) {
    const sql = `UPDATE auth.users SET raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data,'{}'),'{role}','"mentor"') WHERE email = '${email}';`;
    navigator.clipboard.writeText(sql).then(() => {
      setCopied(reqId);
      setTimeout(() => setCopied(null), 2500);
    });
  }

  // ── render ────────────────────────────────────────────────────────────────
  if (loading) return (
    <>
      <style>{CSS}</style>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:80 }}>
        <div className="ms-spin" />
      </div>
    </>
  );

  const ac = form.accent_color;

  return (
    <>
      <style>{CSS}</style>
      <div className="ms-wrap">

        {/* ── MENTOR: pending role requests ── */}
        {isMentor && pendingReqs.length > 0 && (
          <>
            <div className="ms-sec-lbl">
              Pending Role Requests
              <span style={{ background:"rgba(245,158,11,.12)", border:"1px solid rgba(245,158,11,.25)", borderRadius:20, padding:"1px 9px", fontSize:9.5, fontWeight:700, color:"#f59e0b" }}>
                {pendingReqs.length}
              </span>
            </div>
            <div className="ms-req-table-wrap">
              <table className="ms-req-tbl">
                <thead><tr>
                  <th>User</th><th>Reason</th><th>Requested</th><th>Actions</th>
                </tr></thead>
                <tbody>
                  {pendingReqs.map(req => (
                    <tr key={req.id}>
                      <td>
                        <div style={{ fontWeight:700, color:"#fafafa", fontSize:13 }}>{req.display_name || "—"}</div>
                        <div style={{ fontSize:10.5, color:"#52525b", marginTop:2 }}>{req.email}</div>
                      </td>
                      <td><div className="ms-req-reason" title={req.reason}>{req.reason || "—"}</div></td>
                      <td style={{ fontSize:11, whiteSpace:"nowrap" }}>{fmtDate(req.created_at)}</td>
                      <td>
                        <div className="ms-req-acts">
                          <button
                            className="ms-sql-btn"
                            onClick={() => copyGrantSQL(req.email, req.id)}
                          >
                            {copied === req.id
                              ? <span className="ms-copied">Copied!</span>
                              : <>
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                                  Copy SQL
                                </>
                            }
                          </button>
                          <button
                            className="ms-act ms-act-ok"
                            onClick={() => handleRequestAction(req.id, "approved")}
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                            Approve
                          </button>
                          <button
                            className="ms-act ms-act-no"
                            onClick={() => handleRequestAction(req.id, "rejected")}
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                            Decline
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── MENTOR: join requests for their mentorship ── */}
        {isMentor && myMentorship && joinReqs.length > 0 && (
          <>
            <div className="ms-sec-lbl">
              Mentorship Join Requests
              <span style={{ background:"rgba(34,211,238,.1)", border:"1px solid rgba(34,211,238,.25)", borderRadius:20, padding:"1px 9px", fontSize:9.5, fontWeight:700, color:"#22d3ee" }}>
                {joinReqs.filter(r => r.status === "pending").length} pending
              </span>
            </div>
            <div className="ms-join-req-wrap">
              <table className="ms-join-req-tbl">
                <thead><tr>
                  <th>Name</th><th>Contact</th><th>Message</th><th>Date</th><th>Status</th><th>Actions</th>
                </tr></thead>
                <tbody>
                  {joinReqs.map(req => (
                    <tr key={req.id}>
                      <td>
                        <div style={{ fontWeight:700, color:"#fafafa", fontSize:13 }}>{req.full_name || "—"}</div>
                      </td>
                      <td>
                        <div style={{ fontSize:11.5, color:"#a1a1aa", marginBottom:3 }}>{req.email}</div>
                        {req.discord_username && (
                          <span className="ms-discord-tag">{req.discord_username}</span>
                        )}
                      </td>
                      <td>
                        <div className="ms-req-reason" title={req.message} style={{ maxWidth:200 }}>
                          {req.message || <span style={{ color:"#3f3f46" }}>No message</span>}
                        </div>
                      </td>
                      <td style={{ fontSize:11, whiteSpace:"nowrap" }}>{fmtDate(req.created_at)}</td>
                      <td>
                        <span className={`ms-status-badge ms-status-${req.status}`}>
                          {req.status}
                        </span>
                      </td>
                      <td>
                        {req.status === "pending" && (
                          <div className="ms-req-acts">
                            <button
                              className="ms-act ms-act-ok"
                              onClick={() => handleJoinAction(req.id, "accepted")}
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                              Accept
                            </button>
                            <button
                              className="ms-act ms-act-no"
                              onClick={() => handleJoinAction(req.id, "rejected")}
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── MENTOR: my mentorship banner ── */}
        {isMentor && myMentorship && !showForm && (
          <>
            <div className="ms-sec-lbl">Your Mentorship</div>
            <div
              className="ms-mine"
              style={{ "--ms-accent": myMentorship.accent_color } as React.CSSProperties}
            >
              <div className="ms-mine-av" style={{ background: myMentorship.logo ? "transparent" : myMentorship.accent_color, overflow:"hidden" }}>
                {myMentorship.logo
                  ? <img src={myMentorship.logo} alt="logo" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                  : avatarLetter(myMentorship.name)
                }
              </div>
              <div className="ms-mine-info">
                <div className="ms-mine-name">{myMentorship.name}</div>
                {myMentorship.tagline && <div style={{ fontSize:11.5, color:"#a1a1aa", marginBottom:3 }}>{myMentorship.tagline}</div>}
                <div className="ms-mine-meta">
                  {myMentorship.category && <><span style={{ background:`${myMentorship.accent_color}14`, border:`1px solid ${myMentorship.accent_color}30`, borderRadius:20, padding:"1px 8px", fontSize:9.5, fontWeight:700, color:myMentorship.accent_color, marginRight:6 }}>{myMentorship.category}</span></>}
                  {myMentorship.active_game_ids?.length ?? 0} games
                  &nbsp;·&nbsp;
                  {myMentorship.rules?.filter(r => r.trim()).length ?? 0} rules
                  &nbsp;·&nbsp;
                  Created {fmtDate(myMentorship.created_at)}
                </div>
              </div>
              <div className="ms-mine-acts">
                <button className="ms-btn ms-btn-primary ms-btn-sm" onClick={() => setShowForm(true)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Edit
                </button>
                <button className="ms-btn ms-btn-ghost ms-btn-sm" onClick={() => setSelected(myMentorship)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  Preview
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── MENTOR: no mentorship yet ── */}
        {isMentor && !myMentorship && !showForm && (
          <>
            <div className="ms-sec-lbl">Your Mentorship</div>
            <div style={{ background:"#111113", border:"1px dashed rgba(34,211,238,.2)", borderRadius:16, padding:"32px 28px", marginBottom:28, display:"flex", alignItems:"center", justifyContent:"space-between", gap:20 }}>
              <div>
                <div style={{ fontSize:15, fontWeight:800, color:"#fafafa", marginBottom:5 }}>You don't have a mentorship yet</div>
                <div style={{ fontSize:12.5, color:"#71717a" }}>Create one to publish your community, rules, and featured games.</div>
              </div>
              <button className="ms-btn ms-btn-primary" onClick={() => { setForm({ ...BLANK_FORM }); setShowForm(true); }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Create Mentorship
              </button>
            </div>
          </>
        )}

        {/* ── CREATE / EDIT FORM ── */}
        {isMentor && showForm && (
          <>
            <div className="ms-sec-lbl">{myMentorship ? "Edit Mentorship" : "Create Mentorship"}</div>
            <div className="ms-form-panel">

              {/* ── Logo upload ── */}
              <div className="ms-field full" style={{ marginBottom:20 }}>
                <label className="ms-label">Logo</label>
                <div className="ms-logo-area">
                  <div className="ms-logo-preview" style={{ background: form.logo ? "transparent" : form.accent_color }}>
                    {form.logo
                      ? <img src={form.logo} alt="logo" />
                      : <span style={{ color:"#09090b", fontWeight:900, fontSize:22 }}>{(form.name||"?")[0].toUpperCase()}</span>
                    }
                  </div>
                  <div className="ms-logo-btns">
                    <label className="ms-logo-upload">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      Upload Logo
                      <input type="file" accept="image/*" style={{ display:"none" }} onChange={handleLogoUpload} />
                    </label>
                    {form.logo && (
                      <button className="ms-logo-clear" type="button" onClick={() => setForm(f => ({ ...f, logo: "" }))}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        Remove
                      </button>
                    )}
                    <div className="ms-logo-hint">JPG, PNG or GIF · max 500 KB</div>
                  </div>
                </div>
              </div>

              <div className="ms-form-grid">
                {/* Name */}
                <div className="ms-field">
                  <label className="ms-label">Mentorship Name *</label>
                  <input
                    className="ms-input"
                    placeholder="e.g. ProTrader Academy"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    maxLength={60}
                  />
                </div>

                {/* Category */}
                <div className="ms-field">
                  <label className="ms-label">Category</label>
                  <select
                    className="ms-select"
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* Tagline */}
                <div className="ms-field">
                  <label className="ms-label">Tagline</label>
                  <input
                    className="ms-input"
                    placeholder="e.g. Trade smart, not hard"
                    value={form.tagline}
                    onChange={e => setForm(f => ({ ...f, tagline: e.target.value }))}
                    maxLength={80}
                  />
                </div>

                {/* Social link */}
                <div className="ms-field">
                  <label className="ms-label">Discord / Telegram Link</label>
                  <div className="ms-social-row">
                    <div className="ms-social-icon">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#52525b" strokeWidth="2" strokeLinecap="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                    </div>
                    <input
                      className="ms-input"
                      style={{ flex:1 }}
                      placeholder="https://discord.gg/..."
                      value={form.social_link}
                      onChange={e => setForm(f => ({ ...f, social_link: e.target.value }))}
                      maxLength={200}
                    />
                  </div>
                </div>

                {/* Accent color */}
                <div className="ms-field full">
                  <label className="ms-label">Brand Color</label>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div className="ms-colors">
                      {COLOR_PRESETS.map(c => (
                        <div
                          key={c}
                          className={`ms-color-dot${form.accent_color === c ? " sel" : ""}`}
                          style={{ background: c }}
                          onClick={() => setForm(f => ({ ...f, accent_color: c }))}
                        />
                      ))}
                    </div>
                    <input
                      type="color"
                      value={form.accent_color}
                      onChange={e => setForm(f => ({ ...f, accent_color: e.target.value }))}
                      style={{ width:32, height:32, borderRadius:8, border:"1px solid rgba(255,255,255,.1)", background:"none", cursor:"pointer", padding:2 }}
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="ms-field full">
                  <label className="ms-label">Description</label>
                  <textarea
                    className="ms-input ms-textarea"
                    placeholder="Tell students what this mentorship is about…"
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    maxLength={300}
                  />
                </div>
              </div>

              {/* Rules */}
              <div className="ms-field" style={{ marginBottom:20 }}>
                <label className="ms-label" style={{ marginBottom:10 }}>Community Rules</label>
                <div className="ms-rules-list">
                  {form.rules.map((rule, idx) => (
                    <div key={idx} className="ms-rule-row">
                      <div className="ms-rule-num">{idx + 1}</div>
                      <input
                        className="ms-input"
                        style={{ flex:1 }}
                        placeholder={`Rule ${idx + 1}`}
                        value={rule}
                        onChange={e => setRule(idx, e.target.value)}
                        maxLength={120}
                      />
                      {form.rules.length > 1 && (
                        <button className="ms-rule-del" onClick={() => removeRule(idx)} type="button">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {form.rules.length < 10 && (
                  <button className="ms-add-rule" onClick={addRule} type="button">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Add rule
                  </button>
                )}
              </div>

              {/* Game selection */}
              <div className="ms-field" style={{ marginBottom:4 }}>
                <label className="ms-label" style={{ marginBottom:10 }}>Featured Games</label>
                <div className="ms-games-grid">
                  {GAMES.map(g => {
                    const on = form.active_game_ids.includes(g.id);
                    return (
                      <div
                        key={g.id}
                        className={`ms-game-tile${on ? " on" : ""}`}
                        style={{ "--tile-accent": g.accent, "--tile-dim": hexDim(g.accent, 0.1) } as React.CSSProperties}
                        onClick={() => toggleGame(g.id)}
                      >
                        <div className="ms-game-dot" style={{ background: on ? g.accent : "#27272a" }} />
                        <span className="ms-game-name">{g.name}</span>
                        {on && (
                          <span className="ms-game-check" style={{ color: g.accent }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="ms-sel-count">{form.active_game_ids.length} of {GAMES.length} games selected</div>
              </div>

              <div className="ms-form-foot">
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  {myMentorship && (
                    <button className="ms-btn ms-btn-danger ms-btn-sm" onClick={handleDelete} type="button">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                      Delete
                    </button>
                  )}
                  {saveMsg && (
                    <span className={`ms-save-msg ${saveMsg.startsWith("ok:") ? "ms-save-ok" : "ms-save-err"}`}>
                      {saveMsg.replace(/^(ok:|err:)/, "")}
                    </span>
                  )}
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button className="ms-btn ms-btn-ghost ms-btn-sm" onClick={() => setShowForm(false)} type="button">
                    Cancel
                  </button>
                  <button
                    className="ms-btn ms-btn-primary"
                    onClick={handleSave}
                    disabled={saving || !form.name.trim()}
                    type="button"
                    style={{ background: hexDim(ac, 0.12), borderColor: hexDim(ac, 0.4), color: ac }}
                  >
                    {saving
                      ? <><div className="ms-spin" style={{ width:13, height:13, borderTopColor:ac }} /> Saving…</>
                      : <>{myMentorship ? "Save Changes" : "Publish Mentorship"}</>
                    }
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── NON-MENTOR: request role banner ── */}
        {!isMentor && !myRequest && !showReqForm && (
          <div className="ms-req-banner">
            <div>
              <div style={{ fontSize:14, fontWeight:800, color:"#fafafa", marginBottom:3 }}>Want to become a mentor?</div>
              <div style={{ fontSize:12, color:"#71717a" }}>Request the mentor role to create your own mentorship and community.</div>
            </div>
            <button className="ms-btn ms-btn-primary" onClick={() => setShowReqForm(true)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Request Role
            </button>
          </div>
        )}

        {/* request role form */}
        {!isMentor && showReqForm && (
          <div className="ms-req-form" style={{ marginBottom:28 }}>
            <div style={{ fontSize:14, fontWeight:800, color:"#fafafa", marginBottom:4 }}>Request Mentor Role</div>
            <div style={{ fontSize:12, color:"#71717a", marginBottom:16 }}>Briefly explain why you'd like to become a mentor. The admin will review your request.</div>
            <textarea
              className="ms-input ms-textarea"
              placeholder="Why do you want to be a mentor? What trading experience do you have?"
              value={reqReason}
              onChange={e => setReqReason(e.target.value)}
              maxLength={400}
              style={{ width:"100%", marginBottom:12 }}
            />
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              <button className="ms-btn ms-btn-ghost ms-btn-sm" onClick={() => setShowReqForm(false)}>Cancel</button>
              <button
                className="ms-btn ms-btn-primary ms-btn-sm"
                onClick={handleRequestRole}
                disabled={reqLoading || !reqReason.trim()}
              >
                {reqLoading ? <><div className="ms-spin" style={{ width:12, height:12 }} /> Sending…</> : "Submit Request"}
              </button>
            </div>
          </div>
        )}

        {/* pending request notice */}
        {!isMentor && myRequest && myRequest.status === "pending" && (
          <div className="ms-req-pending" style={{ marginBottom:24 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
            Your mentor role request is <strong style={{ marginLeft:3 }}>pending review</strong>. The admin will approve it shortly.
          </div>
        )}
        {!isMentor && myRequest && myRequest.status === "rejected" && (
          <div style={{ background:"rgba(244,63,94,.06)", border:"1px solid rgba(244,63,94,.18)", borderRadius:12, padding:"12px 16px", marginBottom:24, fontSize:12.5, color:"#f43f5e" }}>
            Your previous request was declined. You can submit a new one.
            <button className="ms-btn ms-btn-ghost ms-btn-sm" style={{ marginLeft:12 }} onClick={() => setShowReqForm(true)}>Try Again</button>
          </div>
        )}

        {/* ── DETAIL DRAWER ── */}
        {selected && (
          <>
            <div className="ms-sec-lbl">Mentorship Details</div>
            <div className="ms-detail" style={{ marginBottom:28 }}>
              <div className="ms-detail-head">
                <div className="ms-detail-av" style={{ background: selected.logo ? "transparent" : selected.accent_color, overflow:"hidden" }}>
                  {selected.logo
                    ? <img src={selected.logo} alt="logo" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                    : avatarLetter(selected.name)
                  }
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div className="ms-detail-name">{selected.name}</div>
                  {selected.tagline && <div style={{ fontSize:12.5, color:"#a1a1aa", marginBottom:3 }}>{selected.tagline}</div>}
                  <div className="ms-detail-sub" style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                    by {selected.mentor_name || "Mentor"}
                    {selected.category && <span style={{ background:`${selected.accent_color}18`, border:`1px solid ${selected.accent_color}30`, borderRadius:20, padding:"1px 8px", fontSize:9.5, fontWeight:800, color:selected.accent_color }}>{selected.category}</span>}
                  </div>
                </div>
                <div style={{ display:"flex", gap:8, alignItems:"center", flexShrink:0 }}>
                  {selected.social_link && (
                    <a href={selected.social_link} target="_blank" rel="noopener noreferrer"
                      style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"6px 12px", borderRadius:8, background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.09)", color:"#a1a1aa", fontSize:11.5, fontWeight:700, textDecoration:"none", transition:"all .15s" }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                      Community
                    </a>
                  )}
                  <button className="ms-detail-close" onClick={() => setSelected(null)}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>

              {selected.description && (
                <p className="ms-detail-desc">{selected.description}</p>
              )}

              {selected.rules?.filter(r => r.trim()).length > 0 && (
                <>
                  <div style={{ fontSize:9.5, fontWeight:700, textTransform:"uppercase", letterSpacing:".1em", color:"#3f3f46", marginBottom:10 }}>Community Rules</div>
                  <div className="ms-rules-view">
                    {selected.rules.filter(r => r.trim()).map((rule, i) => (
                      <div key={i} className="ms-rule-view">
                        <span className="ms-rule-view-n">{i + 1}</span>
                        <span className="ms-rule-view-t">{rule}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {selected.active_game_ids?.length > 0 && (
                <>
                  <div style={{ fontSize:9.5, fontWeight:700, textTransform:"uppercase", letterSpacing:".1em", color:"#3f3f46", marginBottom:10, marginTop:18 }}>Featured Games</div>
                  <div className="ms-detail-games">
                    {selected.active_game_ids.map(gid => {
                      const g = GAMES.find(x => x.id === gid);
                      if (!g) return null;
                      return (
                        <div key={gid} className="ms-dg-pill" style={{ background: hexDim(g.accent, 0.1), border:`1px solid ${hexDim(g.accent, 0.25)}`, color: g.accent }}>
                          {g.name}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* ── ALL MENTORSHIPS GRID ── */}
        <div className="ms-sec-lbl">All Mentorships ({mentorships.length})</div>
        {mentorships.length === 0 ? (
          <div className="ms-empty">
            <div className="ms-empty-ico">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#52525b" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
            </div>
            <div className="ms-empty-t">No mentorships yet</div>
            <p className="ms-empty-s">
              {isMentor ? "Create yours above to appear here." : "Be the first — request mentor access and create a community."}
            </p>
          </div>
        ) : (
          <div className="ms-grid">
            {mentorships.map(m => {
              const isOwn = isMentor && m.mentor_id === user.id;
              return (
                <div
                  key={m.id}
                  className="ms-card"
                  style={{
                    "--mc-accent": m.accent_color,
                    "--mc-dim":    hexDim(m.accent_color, 0.09),
                    "--mc-border": hexDim(m.accent_color, 0.25),
                    "--mc-hover":  hexDim(m.accent_color, 0.15),
                  } as React.CSSProperties}
                  onClick={() => setSelected(selected?.id === m.id ? null : m)}
                >
                  <div className="ms-card-top">
                    <div className="ms-card-av" style={{ background: m.logo ? "transparent" : m.accent_color, overflow:"hidden" }}>
                      {m.logo
                        ? <img src={m.logo} alt="logo" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                        : avatarLetter(m.name)
                      }
                    </div>
                    <div className="ms-card-info">
                      <div className="ms-card-name">{m.name}</div>
                      {m.tagline && <div style={{ fontSize:10.5, color:"#71717a", marginBottom:2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{m.tagline}</div>}
                      <div className="ms-card-mentor">
                        by {m.mentor_name || "Mentor"}
                        {isOwn && <span style={{ marginLeft:6, background:"rgba(217,70,239,.12)", border:"1px solid rgba(217,70,239,.25)", borderRadius:20, padding:"1px 8px", fontSize:9, fontWeight:800, color:"#d946ef" }}>You</span>}
                      </div>
                    </div>
                  </div>
                  <div className="ms-card-body">
                    {m.description && <div className="ms-card-desc">{m.description}</div>}
                    <div className="ms-card-tags">
                      {m.category && m.category !== "General" && (
                        <span className="ms-tag ms-cat-badge" style={{ background:hexDim(m.accent_color,0.1), border:`1px solid ${hexDim(m.accent_color,0.25)}`, color:m.accent_color }}>
                          {m.category}
                        </span>
                      )}
                      {m.rules?.filter(r=>r.trim()).length > 0 && (
                        <span className="ms-tag" style={{ background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.08)", color:"#71717a" }}>
                          {m.rules.filter(r=>r.trim()).length} rules
                        </span>
                      )}
                      {m.active_game_ids?.length > 0 && (
                        <span className="ms-tag" style={{ background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.08)", color:"#71717a" }}>
                          {m.active_game_ids.length} games
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="ms-card-foot">
                    <span className="ms-card-stats">Since {fmtDate(m.created_at)}</span>
                    <div className="ms-card-action">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      {selected?.id === m.id ? "Close" : "View"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </>
  );
}
