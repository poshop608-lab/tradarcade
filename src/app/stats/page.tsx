"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getSessions,
  clearSessions,
  totalTimePlayed,
  sessionsByGame,
  bestScoreByGame,
  avgAccuracyByGame,
  type GameSession,
} from "@/lib/stats";
import { GAMES } from "@/lib/games";

function formatDuration(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function MiniBar({ value, max, color = "#1DB97C" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: color, boxShadow: `0 0 6px ${color}60` }}
      />
    </div>
  );
}

export default function StatsPage() {
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    setSessions(getSessions());
  }, []);

  const totalMs = totalTimePlayed(sessions);
  const byGame = sessionsByGame(sessions);
  const bestScores = bestScoreByGame(sessions);
  const avgAcc = avgAccuracyByGame(sessions);

  const maxSessions = Math.max(...Object.values(byGame).map((s) => s.length), 1);
  const maxScore = Math.max(...Object.values(bestScores), 1);

  const recent = [...sessions].sort((a, b) => b.timestamp - a.timestamp).slice(0, 15);

  function handleClear() {
    if (confirmClear) {
      clearSessions();
      setSessions([]);
      setConfirmClear(false);
    } else {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
    }
  }

  return (
    <div className="min-h-screen max-w-5xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-mono text-muted hover:text-foreground transition-colors uppercase tracking-[0.2em] mb-6">
          ← Home
        </Link>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-black text-foreground uppercase tracking-wide mb-1">Your Stats</h1>
            <p className="text-muted text-sm font-mono">{sessions.length} sessions recorded on this device</p>
          </div>
          <button
            onClick={handleClear}
            className={`text-xs font-mono border rounded-lg px-3 py-2 transition-colors ${
              confirmClear ? "border-red/50 text-red" : "border-card-border text-muted hover:text-foreground"
            }`}
          >
            {confirmClear ? "Click again to confirm" : "Clear all data"}
          </button>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
          <div className="text-5xl">📊</div>
          <p className="text-muted text-sm font-mono">No sessions recorded yet. Play some games first!</p>
          <Link href="/" className="px-6 py-2.5 bg-green text-white font-bold rounded-xl hover:opacity-90 transition-opacity text-sm uppercase tracking-wide">
            Play Now
          </Link>
        </div>
      ) : (
        <>
          {/* Top stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {[
              { label: "Time Played", value: formatDuration(totalMs), color: "text-green" },
              { label: "Sessions", value: String(sessions.length), color: "text-blue" },
              { label: "Games Played", value: String(Object.keys(byGame).length), color: "text-amber" },
              {
                label: "Avg Accuracy",
                value: (() => {
                  const all = sessions.filter((s) => s.accuracy !== undefined);
                  if (!all.length) return "—";
                  return `${Math.round(all.reduce((sum, s) => sum + s.accuracy!, 0) / all.length * 100)}%`;
                })(),
                color: "text-purple",
              },
            ].map((stat) => (
              <div key={stat.label} className="bg-card border border-card-border rounded-2xl p-4">
                <div className="text-[10px] font-mono text-muted uppercase tracking-widest mb-1">{stat.label}</div>
                <div className={`text-2xl font-black font-mono ${stat.color}`}>{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Per-game breakdown */}
          <div className="mb-8">
            <h2 className="text-xs font-mono text-muted uppercase tracking-widest mb-3">Per Game</h2>
            <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
              {GAMES.map((game, i) => {
                const gameSessions = byGame[game.id] ?? [];
                const best = bestScores[game.id];
                const acc = avgAcc[game.id];
                const totalTime = gameSessions.reduce((sum, s) => sum + s.durationMs, 0);
                if (gameSessions.length === 0) return null;
                return (
                  <div
                    key={game.id}
                    className={`flex items-center gap-4 px-5 py-4 ${i > 0 ? "border-t border-card-border" : ""}`}
                  >
                    <span className="text-2xl w-8 shrink-0">{game.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-sm font-semibold text-foreground truncate">{game.name}</span>
                        <div className="flex items-center gap-4 shrink-0 text-[11px] font-mono">
                          <span className="text-muted">{gameSessions.length} plays</span>
                          <span className="text-muted">{formatDuration(totalTime)}</span>
                          {best !== undefined && best > 0 && (
                            <span className="text-green">Best: {best}</span>
                          )}
                          {acc > 0 && (
                            <span className="text-blue">{Math.round(acc * 100)}% acc</span>
                          )}
                        </div>
                      </div>
                      <MiniBar value={gameSessions.length} max={maxSessions} color={game.color} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Score history per game (mini sparkline using bars) */}
          {Object.entries(byGame).filter(([, ss]) => ss.some((s) => s.score !== undefined)).map(([gameId, ss]) => {
            const game = GAMES.find((g) => g.id === gameId);
            if (!game) return null;
            const scored = [...ss].filter((s) => s.score !== undefined).sort((a, b) => a.timestamp - b.timestamp).slice(-20);
            const max = Math.max(...scored.map((s) => s.score!));
            return (
              <div key={gameId} className="mb-5">
                <h2 className="text-xs font-mono text-muted uppercase tracking-widest mb-2">
                  {game.icon} {game.name} — Score history
                </h2>
                <div className="bg-card border border-card-border rounded-xl p-4 flex items-end gap-1 h-20">
                  {scored.map((s, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-sm min-w-[4px] transition-all"
                      style={{
                        height: `${Math.max(4, (s.score! / max) * 100)}%`,
                        background: game.color,
                        opacity: 0.7 + (i / scored.length) * 0.3,
                        boxShadow: `0 0 4px ${game.color}40`,
                      }}
                      title={`${s.score} pts — ${formatDate(s.timestamp)}`}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Recent sessions */}
          <div>
            <h2 className="text-xs font-mono text-muted uppercase tracking-widest mb-3">Recent Sessions</h2>
            <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
              {recent.map((s, i) => {
                const game = GAMES.find((g) => g.id === s.gameId);
                return (
                  <div
                    key={s.id}
                    className={`flex items-center gap-3 px-5 py-3 text-sm ${i > 0 ? "border-t border-card-border" : ""}`}
                  >
                    <span className="text-xl w-7 shrink-0">{game?.icon ?? "🎮"}</span>
                    <span className="font-medium text-foreground/80 w-28 shrink-0 truncate">{s.gameName}</span>
                    <span className="text-muted font-mono text-xs flex-1">{formatDate(s.timestamp)}</span>
                    <span className="font-mono text-xs text-muted">{formatDuration(s.durationMs)}</span>
                    {s.score !== undefined && (
                      <span className="font-mono text-xs text-green w-16 text-right">{s.score} pts</span>
                    )}
                    {s.accuracy !== undefined && (
                      <span className="font-mono text-xs text-blue w-14 text-right">{Math.round(s.accuracy * 100)}%</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
