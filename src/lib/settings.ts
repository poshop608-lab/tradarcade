// Client-side settings storage — localStorage only
const SETTINGS_KEY = "trades-arcade-settings";

export interface GameSettings {
  memory: {
    pairCount: 4 | 6 | 8;
    timerSeconds: 0 | 60 | 90 | 120; // 0 = unlimited
  };
  "whack-a-mole": {
    durationSeconds: 15 | 30 | 60 | 90;
  };
  "fruit-ninja": {
    durationSeconds: 30 | 60 | 90;
  };
  flappy_bird: {
    difficulty: "easy" | "normal" | "hard";
  };
  "crossy-road": {
    speed: "slow" | "normal" | "fast";
  };
  asteroids: {
    difficulty: "easy" | "normal" | "hard";
  };
}

const DEFAULTS: GameSettings = {
  memory: { pairCount: 8, timerSeconds: 0 },
  "whack-a-mole": { durationSeconds: 30 },
  "fruit-ninja": { durationSeconds: 60 },
  flappy_bird: { difficulty: "normal" },
  "crossy-road": { speed: "normal" },
  asteroids: { difficulty: "normal" },
};

export function getSettings(): GameSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") as Partial<GameSettings>;
    return {
      memory: { ...DEFAULTS.memory, ...(stored.memory ?? {}) },
      "whack-a-mole": { ...DEFAULTS["whack-a-mole"], ...(stored["whack-a-mole"] ?? {}) },
      "fruit-ninja": { ...DEFAULTS["fruit-ninja"], ...(stored["fruit-ninja"] ?? {}) },
      flappy_bird: { ...DEFAULTS.flappy_bird, ...(stored.flappy_bird ?? {}) },
      "crossy-road": { ...DEFAULTS["crossy-road"], ...(stored["crossy-road"] ?? {}) },
      asteroids: { ...DEFAULTS.asteroids, ...(stored.asteroids ?? {}) },
    };
  } catch {
    return DEFAULTS;
  }
}

export function saveSettings(patch: DeepPartial<GameSettings>): void {
  if (typeof window === "undefined") return;
  const current = getSettings();
  const next: GameSettings = {
    memory: { ...current.memory, ...((patch.memory as Partial<GameSettings["memory"]>) ?? {}) },
    "whack-a-mole": { ...current["whack-a-mole"], ...((patch["whack-a-mole"] as Partial<GameSettings["whack-a-mole"]>) ?? {}) },
    "fruit-ninja": { ...current["fruit-ninja"], ...((patch["fruit-ninja"] as Partial<GameSettings["fruit-ninja"]>) ?? {}) },
    flappy_bird: { ...current.flappy_bird, ...((patch.flappy_bird as Partial<GameSettings["flappy_bird"]>) ?? {}) },
    "crossy-road": { ...current["crossy-road"], ...((patch["crossy-road"] as Partial<GameSettings["crossy-road"]>) ?? {}) },
    asteroids: { ...current.asteroids, ...((patch.asteroids as Partial<GameSettings["asteroids"]>) ?? {}) },
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
}

// Utility type
type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };
