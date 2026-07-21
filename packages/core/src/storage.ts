/**
 * Minimal key-value store contract — GameStorage satisfies it structurally;
 * tests use in-memory stand-ins. Consumers that only read/write should take
 * this instead of GameStorage.
 */
export interface KVStore {
  get<T>(k: string, fallback: T): T;
  set<T>(k: string, value: T): void;
}

/** KVStore whose keys can be enumerated (e.g. for cloud-save collection). */
export interface EnumerableKVStore extends KVStore {
  keys(): string[];
}

/**
 * Namespaced localStorage wrapper shared by all games.
 * localStorage is synchronous and available in both the browser and
 * Capacitor WebViews, which is sufficient for scores/settings-sized data.
 */
export class GameStorage implements EnumerableKVStore {
  constructor(private readonly namespace: string) {}

  private key(k: string): string {
    return `${this.namespace}:${k}`;
  }

  get<T>(k: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(this.key(k));
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  }

  set<T>(k: string, value: T): void {
    try {
      localStorage.setItem(this.key(k), JSON.stringify(value));
    } catch {
      // Quota/private-mode failures are non-fatal; the game just won't persist.
    }
  }

  /** All keys in this namespace (namespace prefix stripped). */
  keys(): string[] {
    const out: string[] = [];
    try {
      const prefix = `${this.namespace}:`;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k !== null && k.startsWith(prefix)) out.push(k.slice(prefix.length));
      }
    } catch {
      // No localStorage (tests/private mode) — nothing to enumerate.
    }
    return out;
  }

  bumpHighScore(score: number, k = "highScore"): number {
    const best = Math.max(this.get(k, 0), score);
    this.set(k, best);
    return best;
  }
}
