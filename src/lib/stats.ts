// Client-side stats storage — localStorage for offline cache, Supabase for community data
// To enable community stats/leaderboard, run this SQL in your Supabase dashboard:
//
//   create table if not exists game_sessions (
//     id           uuid primary key default gen_random_uuid(),
//     user_id      uuid references auth.users(id) on delete cascade,
//     game_id      text not null,
//     game_name    text,
//     mentor_id    text,
//     duration_ms  integer,
//     score        integer,
//     accuracy     real,
//     created_at   timestamptz default now()
//   );
//   alter table game_sessions enable row level security;
//   create policy "insert own sessions" on game_sessions for insert with check (auth.uid() = user_id);
//   create policy "read all sessions"   on game_sessions for select using (true);
//
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

/**
 * Write a session to Supabase so it appears in the community leaderboard.
 * Call this after recordSession() whenever the user is authenticated.
 * Requires the game_sessions table — see SQL comment at top of file.
 */
export async function recordSessionRemote(
  session: GameSession,
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseClient: { from: (table: string) => any }
): Promise<void> {
  try {
    await supabaseClient.from("game_sessions").insert({
      user_id:     userId,
      game_id:     session.gameId,
      game_name:   session.gameName,
      mentor_id:   session.mentorId,
      duration_ms: session.durationMs,
      score:       session.score ?? null,
      accuracy:    session.accuracy ?? null,
    });
  } catch {
    // Non-fatal — local session is already saved
  }
}
