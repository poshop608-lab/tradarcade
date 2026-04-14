// ── Auth system — localStorage only ──────────────────────────────────────────

export type UserRole = "user" | "mentor";

export interface AuthUser {
  username: string;
  role: UserRole;
  joinedAt: number;
}

export interface UserRecord {
  username: string;
  role: UserRole;
  joinedAt: number;
  lastSeen: number;
  banned: boolean;
}

const AUTH_KEY = "tradegame-auth";
const USERS_KEY = "tradegame-users";
export const MENTOR_PIN = "1234";

// ── Current session ──────────────────────────────────────────────────────────

export function getAuth(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function login(username: string, role: UserRole): AuthUser {
  const user: AuthUser = { username, role, joinedAt: Date.now() };
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
  registerUser(username, role);
  return user;
}

export function logout(): void {
  localStorage.removeItem(AUTH_KEY);
}

// ── User registry (for mentor admin view) ────────────────────────────────────

export function getUsers(): UserRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || "[]") as UserRecord[];
  } catch {
    return [];
  }
}

function registerUser(username: string, role: UserRole): void {
  const users = getUsers();
  const existing = users.find((u) => u.username === username);
  if (existing) {
    existing.lastSeen = Date.now();
    existing.role = role;
  } else {
    users.push({ username, role, joinedAt: Date.now(), lastSeen: Date.now(), banned: false });
  }
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function banUser(username: string): void {
  const users = getUsers();
  const u = users.find((u) => u.username === username);
  if (u) { u.banned = true; localStorage.setItem(USERS_KEY, JSON.stringify(users)); }
}

export function unbanUser(username: string): void {
  const users = getUsers();
  const u = users.find((u) => u.username === username);
  if (u) { u.banned = false; localStorage.setItem(USERS_KEY, JSON.stringify(users)); }
}

export function removeUser(username: string): void {
  const users = getUsers().filter((u) => u.username !== username);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function isBanned(username: string): boolean {
  return getUsers().find((u) => u.username === username)?.banned ?? false;
}
