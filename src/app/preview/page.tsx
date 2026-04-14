"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MentorConfig } from "@/lib/types";
import { GAMES } from "@/lib/games";

const STORAGE_KEY = "trades-arcade-custom-config";

export default function PreviewPage() {
  const [config, setConfig] = useState<MentorConfig | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try { setConfig(JSON.parse(raw)); } catch { /* ignore */ }
  }, []);

  if (!config) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 text-center px-6">
        <div className="text-5xl">⚙️</div>
        <h1 className="text-2xl font-black text-foreground uppercase tracking-wide">No config saved yet</h1>
        <p className="text-muted text-sm max-w-xs">
          Go to Setup to import your trading content, then come back to play.
        </p>
        <Link
          href="/setup"
          className="px-8 py-3 bg-green text-white font-bold rounded-xl hover:opacity-90 transition-opacity uppercase tracking-wide text-sm"
        >
          Go to Setup →
        </Link>
      </div>
    );
  }

  return (
    <main className="min-h-screen max-w-5xl mx-auto px-6 py-10">
      <div className="mb-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-muted hover:text-foreground transition-colors uppercase tracking-[0.2em] mb-6"
        >
          ← Home
        </Link>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{config.displayName}</h1>
            <p className="text-muted text-sm mt-1 font-mono tracking-wide">
              {config.terms.length} terms · {config.concepts.length} concepts · {config.rules.length} rules
            </p>
          </div>
          <Link
            href="/setup"
            className="text-xs font-mono text-muted hover:text-foreground transition-colors border border-card-border rounded-lg px-4 py-2"
          >
            Edit content →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {GAMES.map((game) => (
          <Link
            key={game.id}
            href={`/preview/${game.path}`}
            className="group relative rounded-2xl border border-card-border bg-card overflow-hidden hover:border-white/15 hover:-translate-y-0.5 transition-all duration-200"
          >
            <div className="h-[2px] w-full" style={{ background: game.color, opacity: 0.9 }} />
            <div className="p-4 pb-5">
              <div className="text-3xl mb-3 leading-none">{game.icon}</div>
              <h3 className="font-semibold text-sm text-foreground group-hover:text-white transition-colors leading-tight mb-1.5">
                {game.name}
              </h3>
              <p className="text-[11px] text-muted leading-snug line-clamp-2">{game.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
