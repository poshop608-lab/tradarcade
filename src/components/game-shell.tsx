"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { MentorConfig } from "@/lib/types";

const GAME_META: Record<string, { accent: string; cat: string }> = {
  "gb-number-quiz":   { accent: "#22d3ee", cat: "Trading"    },
  "ce-matching":      { accent: "#22d3ee", cat: "Trading"    },
  "algo-sorter":      { accent: "#22d3ee", cat: "Trading"    },
  "clockwise":        { accent: "#22d3ee", cat: "Trading"    },
  "wordle":           { accent: "#22c55e", cat: "Vocabulary" },
  "hangman":          { accent: "#22c55e", cat: "Vocabulary" },
  "wheel-of-fortune": { accent: "#22c55e", cat: "Vocabulary" },
  "flappy-bird":      { accent: "#f59e0b", cat: "Reflexes"   },
  "crossy-road":      { accent: "#f59e0b", cat: "Reflexes"   },
  "asteroids":        { accent: "#d946ef", cat: "Arcade"     },
  "doodle-jump":      { accent: "#d946ef", cat: "Arcade"     },
  "whack-a-mole":     { accent: "#f59e0b", cat: "Speed"      },
  "fruit-ninja":      { accent: "#f43f5e", cat: "Speed"      },
  "memory":           { accent: "#d946ef", cat: "Memory"     },
};

interface GameShellProps {
  mentor: MentorConfig;
  gameName: string;
  gameIcon: string;
  gameId?: string;
  children: ReactNode;
}

export function GameShell({ mentor, gameName, gameIcon, gameId, children }: GameShellProps) {
  const meta    = gameId ? GAME_META[gameId] : null;
  const accent  = meta?.accent ?? "#22d3ee";
  const cat     = meta?.cat    ?? "";

  // derive hex → rgba helper
  const a = (opacity: number) => {
    const h = accent.replace("#", "");
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${opacity})`;
  };

  return (
    <div style={{ minHeight: "100vh", background: "#09090b", display: "flex", flexDirection: "column", position: "relative", color: "#fafafa", fontFamily: "var(--font-geist-sans,-apple-system,system-ui,sans-serif)" }}>
      {/* ambient orbs */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
        <div style={{ position: "absolute", width: 600, height: 600, top: -200, right: -100, borderRadius: "50%", background: `radial-gradient(circle, ${a(0.09)} 0%, transparent 70%)`, filter: "blur(80px)" }} />
        <div style={{ position: "absolute", width: 500, height: 500, bottom: -150, left: -100, borderRadius: "50%", background: "radial-gradient(circle, rgba(217,70,239,.07) 0%, transparent 70%)", filter: "blur(80px)" }} />
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.018) 1px, transparent 1px)", backgroundSize: "44px 44px" }} />
      </div>

      {/* header */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        display: "flex", alignItems: "center", gap: 16, padding: "0 24px",
        height: 54,
        background: "rgba(9,9,11,.92)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255,255,255,.07)",
        flexShrink: 0,
      }}>
        {/* top accent line */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />

        {/* back */}
        <Link href="/dashboard" style={{
          display: "flex", alignItems: "center", gap: 6,
          fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase",
          color: "#52525b", textDecoration: "none", transition: "color .15s", flexShrink: 0,
        }}
          onMouseEnter={e => (e.currentTarget.style.color = accent)}
          onMouseLeave={e => (e.currentTarget.style.color = "#52525b")}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Dashboard
        </Link>

        <div style={{ width: 1, height: 18, background: "rgba(255,255,255,.07)", flexShrink: 0 }} />

        {/* game icon + name */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9, flexShrink: 0,
            background: a(0.1), border: `1px solid ${a(0.25)}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16,
          }}>
            {gameIcon}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#fafafa", letterSpacing: "-.01em", lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {gameName}
            </div>
            {cat && (
              <div style={{ fontSize: 9.5, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: ".1em", marginTop: 1 }}>
                {cat}
              </div>
            )}
          </div>
        </div>

        {/* mentor badge */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6, padding: "4px 12px",
          borderRadius: 20, background: "rgba(255,255,255,.04)",
          border: "1px solid rgba(255,255,255,.08)", flexShrink: 0,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e" }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: "#a1a1aa", letterSpacing: ".04em" }}>
            {mentor.displayName}
          </span>
        </div>
      </header>

      {/* content */}
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 20px", position: "relative", zIndex: 1 }}>
        {children}
      </main>
    </div>
  );
}
