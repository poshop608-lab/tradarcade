// Client-side stats storage — localStorage only
const STATS_KEY = "trades-arcade-stats";

export interface GameSession {
  id: string;
  gameId: string;
  gameName: string;
  mentorId: string;
  timestamp: number;   // Date.now() when the session ended
  durationMs: number;
  score?: number;
  accuracy?: number;   // 0.0–1.0
}

export function getSessions(): GameSession[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STATS_KEY) || "[]") as GameSession[];
  } catch {
    return [];
  }
}

export function recordSession(session: Omit<GameSession, "id">): void {
  if (typeof window === "undefined") return;
  const sessions = getSessions();
  sessions.push({ ...session, id: crypto.randomUUID() });
  // Keep last 1000 sessions
  if (sessions.length > 1000) sessions.splice(0, sessions.length - 1000);
  localStorage.setItem(STATS_KEY, JSON.stringify(sessions));
}

export function clearSessions(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STATS_KEY);
}

/** Aggregate helpers */
export function totalTimePlayed(sessions: GameSession[]): number {
  return sessions.reduce((sum, s) => sum + s.durationMs, 0);
}

export function sessionsByGame(sessions: GameSession[]): Record<string, GameSession[]> {
  return sessions.reduce<Record<string, GameSession[]>>((acc, s) => {
    (acc[s.gameId] ??= []).push(s);
    return acc;
  }, {});
}

export function bestScoreByGame(sessions: GameSession[]): Record<string, number> {
  const byGame = sessionsByGame(sessions);
  return Object.fromEntries(
    Object.entries(byGame).map(([id, ss]) => [
      id,
      Math.max(...ss.filter((s) => s.score !== undefined).map((s) => s.score!)),
    ])
  );
}

export function avgAccuracyByGame(sessions: GameSession[]): Record<string, number> {
  const byGame = sessionsByGame(sessions);
  return Object.fromEntries(
    Object.entries(byGame).map(([id, ss]) => {
      const withAcc = ss.filter((s) => s.accuracy !== undefined);
      if (!withAcc.length) return [id, 0];
      return [id, withAcc.reduce((sum, s) => sum + s.accuracy!, 0) / withAcc.length];
    })
  );
}
