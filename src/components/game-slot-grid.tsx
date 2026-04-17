"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { GameMeta } from "@/lib/types";

export const ACTIVE_GAMES_KEY = (mentorId: string) =>
  `tradegame-active-games-${mentorId}`;

interface GameSlotGridProps {
  mentorId: string;
  defaultGames: GameMeta[];
  allGames: GameMeta[];
  primaryColor: string;
}

export function GameSlotGrid({
  mentorId,
  defaultGames,
  allGames,
  primaryColor,
}: GameSlotGridProps) {
  const [activeIds, setActiveIds] = useState<string[] | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(ACTIVE_GAMES_KEY(mentorId));
    if (stored) {
      try {
        setActiveIds(JSON.parse(stored));
      } catch {
        // ignore bad data
      }
    }
  }, [mentorId]);

  // Mentor's defaultGames is the authoritative list — localStorage can only
  // reduce it further (e.g. admin toggling games off), never expand it.
  const defaultIds = new Set(defaultGames.map((g) => g.id));
  const visibleGames =
    mounted && activeIds !== null
      ? allGames.filter((g) => activeIds.includes(g.id) && defaultIds.has(g.id))
      : defaultGames;

  const gamesCount = visibleGames.length;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <div style={{ fontFamily: "var(--font-m)", fontSize: "10px", letterSpacing: ".14em", textTransform: "uppercase", color: "var(--text3)" }}>
          Game Hub — {gamesCount} games available
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "5px", padding: "5px 10px", borderRadius: "7px", background: `rgba(${primaryColor === "#22d3ee" ? "34,211,238" : "139,92,246"},.06)`, border: `1px solid ${primaryColor}30` }}>
          <span style={{ fontFamily: "var(--font-m)", fontSize: "10px", color: primaryColor }}>All games powered by config</span>
        </div>
      </div>

      <div className="game-slots-grid">
        {visibleGames.map((game, i) => {
          const colorHex = game.color;
          const r = parseInt(colorHex.slice(1, 3), 16);
          const gr = parseInt(colorHex.slice(3, 5), 16);
          const b = parseInt(colorHex.slice(5, 7), 16);
          const bg = `rgba(${r},${gr},${b},.06)`;
          const border = `rgba(${r},${gr},${b},.22)`;
          const iconBg = `rgba(${r},${gr},${b},.1)`;
          const iconBorder = `rgba(${r},${gr},${b},.28)`;
          const textColor = colorHex === "#22d3ee" || colorHex === "#22c55e" || colorHex === "#f59e0b" ? "#09090b" : "#fff";

          return (
            <div
              key={game.id}
              className="game-slot"
              style={{ background: "var(--bg3)", border: `1px solid ${border}` }}
            >
              <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at center,${bg} 0%,transparent 70%)`, pointerEvents: "none", borderRadius: "16px" }} />
              <div className="gs-icon" style={{ background: iconBg, border: `1px solid ${iconBorder}`, color: colorHex }}>
                {game.icon}
              </div>
              <div className="gs-format">FORMAT {String(i + 1).padStart(2, "0")} — {game.description.toUpperCase().slice(0, 24)}</div>
              <div className="gs-name">{game.name}</div>
              <div className="gs-tag">{game.description}</div>
              <Link
                href={`/${mentorId}/${game.path}`}
                className="gs-play-btn"
                style={{ background: colorHex, color: textColor }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><polygon points="3,1 11,6 3,11" fill="currentColor" /></svg>
                Play Now
              </Link>
            </div>
          );
        })}
      </div>
    </>
  );
}
