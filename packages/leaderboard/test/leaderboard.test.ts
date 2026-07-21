import { describe, expect, it } from "vitest";
import {
  DirtySet,
  NAME_MAX,
  NAME_MIN,
  formatTimeMs,
  gamePath,
  localName,
  randomHandle,
  validName,
} from "../src/index";
import type { KVStore } from "../src/index";

/** In-memory KVStore for tests (GameStorage needs localStorage). */
function memStore(): KVStore {
  const m = new Map<string, unknown>();
  return {
    get: <T>(k: string, fallback: T): T => (m.has(k) ? (m.get(k) as T) : fallback),
    set: <T>(k: string, v: T): void => void m.set(k, v),
  };
}

describe("names", () => {
  it("random handles look right and are deterministic under an injected rand", () => {
    let calls = 0;
    const rand = (): number => [0.1, 0.5, 0.9][calls++ % 3]!;
    const h = randomHandle(rand);
    expect(h).toMatch(/^[A-Z][a-zA-Z]+\d{2}$/);
    calls = 0;
    expect(randomHandle(rand)).toBe(h);
    // Default rand also yields valid names.
    for (let i = 0; i < 20; i++) {
      const name = randomHandle();
      expect(validName(name)).toBe(true);
    }
  });

  it("validates names by trimmed length", () => {
    expect(validName("ab")).toBe(false);
    expect(validName("   abc   ")).toBe(true);
    expect(validName("a".repeat(NAME_MAX))).toBe(true);
    expect(validName("a".repeat(NAME_MAX + 1))).toBe(false);
    expect(NAME_MIN).toBe(3);
  });

  it("mints a local name once and then keeps it", () => {
    const store = memStore();
    const name = localName(store);
    expect(validName(name)).toBe(true);
    expect(localName(store)).toBe(name);
  });
});

describe("formatTimeMs", () => {
  it("formats times compactly", () => {
    expect(formatTimeMs(31_540)).toBe("31.5s");
    expect(formatTimeMs(95_000)).toBe("1:35.0");
    expect(formatTimeMs(600)).toBe("0.6s");
  });
});

describe("gamePath", () => {
  it("namespaces every path under games/{gameId}", () => {
    expect(gamePath("cube-dash", "players", "u1")).toEqual(["games", "cube-dash", "players", "u1"]);
    expect(gamePath("word-rush", "scores")).toEqual(["games", "word-rush", "scores"]);
  });
});

describe("DirtySet", () => {
  it("adds uniquely, takes destructively, and supports re-adding failures", () => {
    const d = new DirtySet(memStore());
    expect(d.get()).toEqual([]);
    d.add("level:3", "overall");
    d.add("level:3", "level:7");
    expect(d.get().sort()).toEqual(["level:3", "level:7", "overall"]);
    const taken = d.take();
    expect(taken).toHaveLength(3);
    expect(d.get()).toEqual([]);
    d.add("overall"); // a retry that failed again
    expect(d.get()).toEqual(["overall"]);
  });

  it("tolerates a legacy non-array stored shape", () => {
    const store = memStore();
    store.set("lbDirty", { levels: [1, 2], overall: true }); // pre-package shape
    expect(new DirtySet(store).get()).toEqual([]);
  });
});
