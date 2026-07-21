/**
 * @mg/leaderboard — pure leaderboard domain logic shared by all games:
 * player handles/names, time formatting, the offline dirty-submit queue,
 * and the games/{gameId}/... Firestore path convention. Deliberately zero
 * Firebase imports (vitest-safe); SDK glue lives in @mg/firebase, and each
 * game builds its own service on the two (see games/cube-dash/src/
 * leaderboard.ts for the pattern).
 */
/**
 * Minimal key-value store — @mg/core's GameStorage satisfies this
 * structurally; tests use an in-memory stand-in.
 */
export interface KVStore {
  get<T>(k: string, fallback: T): T;
  set<T>(k: string, value: T): void;
}

export const NAME_MIN = 3;
export const NAME_MAX = 20;

/** True when a display name is acceptable (also enforced by Firestore rules). */
export function validName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= NAME_MIN && trimmed.length <= NAME_MAX;
}

const ADJECTIVES = [
  "Swift", "Neon", "Turbo", "Cosmic", "Blazing", "Frosty", "Shadow", "Golden",
  "Rapid", "Mighty", "Sonic", "Lucky", "Stellar", "Rogue", "Hyper", "Prime",
];
const NOUNS = [
  "Prism", "Cube", "Comet", "Dasher", "Bolt", "Nova", "Vector", "Pixel",
  "Racer", "Spark", "Falcon", "Rocket", "Glider", "Phantom", "Meteor", "Blade",
];

/**
 * Anonymous-but-friendly handle, e.g. "SwiftPrism42". `rand` defaults to
 * Math.random; injectable for deterministic tests.
 */
export function randomHandle(rand: () => number = Math.random): string {
  const adj = ADJECTIVES[Math.floor(rand() * ADJECTIVES.length)]!;
  const noun = NOUNS[Math.floor(rand() * NOUNS.length)]!;
  const num = 10 + Math.floor(rand() * 90);
  return `${adj}${noun}${num}`;
}

/** The player's local display name ("playerName"), minted on first read. */
export function localName(store: KVStore): string {
  let name = store.get("playerName", "");
  if (!name) {
    name = randomHandle();
    store.set("playerName", name);
  }
  return name;
}

/** "1:23.4" (m:ss.t); hours are unrealistic for clear times, minutes cap it. */
export function formatTimeMs(ms: number): string {
  const totalTenths = Math.round(ms / 100);
  const minutes = Math.floor(totalTenths / 600);
  const seconds = Math.floor((totalTenths % 600) / 10);
  const tenths = totalTenths % 10;
  return minutes > 0
    ? `${minutes}:${String(seconds).padStart(2, "0")}.${tenths}`
    : `${seconds}.${tenths}s`;
}

/**
 * Firestore path convention for the shared project: every game's data lives
 * under games/{gameId}/... so titles never collide. Spread into doc() or
 * collection(): doc(db, ...gamePath("cube-dash", "players", uid)).
 */
export function gamePath(gameId: string, ...segments: string[]): [string, ...string[]] {
  return ["games", gameId, ...segments];
}

/**
 * Persisted set of submit tags that failed (offline etc.) and need a retry —
 * e.g. "level:3", "overall". Tolerates any previously stored shape.
 */
export class DirtySet {
  constructor(
    private readonly store: KVStore,
    private readonly key: string = "lbDirty",
  ) {}

  get(): string[] {
    const v = this.store.get<unknown>(this.key, []);
    return Array.isArray(v) ? v.filter((t): t is string => typeof t === "string") : [];
  }

  add(...tags: string[]): void {
    this.store.set(this.key, [...new Set([...this.get(), ...tags])]);
  }

  /** Removes and returns all tags; callers re-add() whatever fails again. */
  take(): string[] {
    const tags = this.get();
    if (tags.length > 0) this.store.set(this.key, []);
    return tags;
  }
}
