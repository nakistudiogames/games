/**
 * Namespaced localStorage wrapper shared by all games.
 * localStorage is synchronous and available in both the browser and
 * Capacitor WebViews, which is sufficient for scores/settings-sized data.
 */
export class GameStorage {
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

  bumpHighScore(score: number, k = "highScore"): number {
    const best = Math.max(this.get(k, 0), score);
    this.set(k, best);
    return best;
  }
}
