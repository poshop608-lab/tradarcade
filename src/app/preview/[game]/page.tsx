"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { MentorConfig } from "@/lib/types";
import { GameShell } from "@/components/game-shell";
import { GAMES } from "@/lib/games";

// Lazy import all game components
import dynamic from "next/dynamic";
const gameComponents: Record<string, React.ComponentType<{ config: MentorConfig }>> = {
  asteroids: dynamic(() => import("@/games/asteroids")),
  "crossy-road": dynamic(() => import("@/games/crossy-road")),
  "flappy-bird": dynamic(() => import("@/games/flappy-bird")),
  "whack-a-mole": dynamic(() => import("@/games/whack-a-mole")),
  wordle: dynamic(() => import("@/games/wordle")),
  memory: dynamic(() => import("@/games/memory")),
  "doodle-jump": dynamic(() => import("@/games/doodle-jump")),
  "fruit-ninja": dynamic(() => import("@/games/fruit-ninja")),
  hangman: dynamic(() => import("@/games/hangman")),
  "wheel-of-fortune": dynamic(() => import("@/games/wheel-of-fortune")),
};

const STORAGE_KEY = "trades-arcade-custom-config";

export default function PreviewGamePage({
  params,
}: {
  params: Promise<{ game: string }>;
}) {
  const { game } = use(params);
  const [config, setConfig] = useState<MentorConfig | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try { setConfig(JSON.parse(raw)); } catch { /* ignore */ }
  }, []);

  const gameMeta = GAMES.find((g) => g.path === game);
  const GameComponent = gameComponents[game];

  if (!config) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 text-center px-6">
        <h1 className="text-2xl font-black text-foreground uppercase tracking-wide">No config saved</h1>
        <Link href="/setup" className="px-8 py-3 bg-green text-white font-bold rounded-xl hover:opacity-90 transition-opacity uppercase tracking-wide text-sm">
          Setup →
        </Link>
      </div>
    );
  }

  if (!gameMeta || !GameComponent) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6">
        <h1 className="text-xl font-black text-red uppercase">Game not found</h1>
        <Link href="/preview" className="text-sm text-muted hover:text-foreground font-mono">← Back</Link>
      </div>
    );
  }

  // Provide a minimal valid config if sections are empty
  const safeConfig: MentorConfig = {
    ...config,
    terms: config.terms.length > 0 ? config.terms : [
      { term: "SAMPLE", definition: "Add real terms in setup", category: "Setup" },
    ],
    concepts: config.concepts.length > 0 ? config.concepts : [
      { label: "Add concepts in setup", isValid: true, explanation: "Go to /setup to add content" },
      { label: "This is a placeholder", isValid: false, explanation: "Go to /setup to add content" },
    ],
    rules: config.rules.length > 0 ? config.rules : [
      { rule: "Add rules in setup page", description: "Go to /setup to add your trading rules", isTrue: true },
    ],
  };

  return (
    <GameShell
      mentor={{ ...safeConfig, id: "custom" }}
      gameName={gameMeta.name}
      gameIcon={gameMeta.icon}
    >
      <GameComponent config={safeConfig} />
    </GameShell>
  );
}
