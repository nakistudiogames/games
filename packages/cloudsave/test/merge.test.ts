import { describe, expect, it } from "vitest";
import { mergeSaves } from "../src/merge";
import type { MergeRule } from "../src/merge";

const rules: Record<string, MergeRule> = {
  unlockedLevel: "max",
  "bestPct:1": "max",
  "bestTimeMs:1": "minPos",
  "ach:first": "or",
  character: "newer",
};
const ruleFor = (k: string): MergeRule => rules[k] ?? "max";

describe("mergeSaves", () => {
  it("takes the best of both sides field-wise", () => {
    const { merged, changedLocal, changedRemote } = mergeSaves(
      { data: { unlockedLevel: 7, "bestPct:1": 100, "bestTimeMs:1": 31000, "ach:first": false }, at: 100 },
      { data: { unlockedLevel: 4, "bestPct:1": 80, "bestTimeMs:1": 29500, "ach:first": true }, at: 50 },
      ruleFor,
    );
    expect(merged).toEqual({ unlockedLevel: 7, "bestPct:1": 100, "bestTimeMs:1": 29500, "ach:first": true });
    expect(changedLocal.sort()).toEqual(["ach:first", "bestTimeMs:1"]);
    expect(changedRemote.sort()).toEqual(["bestPct:1", "unlockedLevel"]);
  });

  it("treats 0/missing times as unset for minPos", () => {
    const { merged } = mergeSaves(
      { data: { "bestTimeMs:1": 0 }, at: 0 },
      { data: { "bestTimeMs:1": 42000, "bestTimeMs:2": 30000 }, at: 0 },
      ruleFor,
    );
    expect(merged).toEqual({ "bestTimeMs:1": 42000, "bestTimeMs:2": 30000 });
  });

  it("resolves cosmetic prefs by save recency, local winning ties", () => {
    const newerLocal = mergeSaves(
      { data: { character: "blaze" }, at: 200 },
      { data: { character: "orb" }, at: 100 },
      ruleFor,
    );
    expect(newerLocal.merged["character"]).toBe("blaze");
    const newerRemote = mergeSaves(
      { data: { character: "blaze" }, at: 100 },
      { data: { character: "orb" }, at: 200 },
      ruleFor,
    );
    expect(newerRemote.merged["character"]).toBe("orb");
    const tie = mergeSaves(
      { data: { character: "blaze" }, at: 100 },
      { data: { character: "orb" }, at: 100 },
      ruleFor,
    );
    expect(tie.merged["character"]).toBe("blaze");
  });

  it("keeps one-sided keys and reports no spurious changes when identical", () => {
    const same = { data: { unlockedLevel: 3, "ach:first": true }, at: 5 };
    const r = mergeSaves(same, { data: { ...same.data }, at: 5 }, ruleFor);
    expect(r.changedLocal).toEqual([]);
    expect(r.changedRemote).toEqual([]);
    const oneSided = mergeSaves({ data: { "bestPct:1": 60 }, at: 0 }, { data: { unlockedLevel: 2 }, at: 0 }, ruleFor);
    expect(oneSided.merged).toEqual({ "bestPct:1": 60, unlockedLevel: 2 });
    expect(oneSided.changedLocal).toEqual(["unlockedLevel"]);
    expect(oneSided.changedRemote).toEqual(["bestPct:1"]);
  });

  it("survives non-numeric garbage under numeric rules", () => {
    const r = mergeSaves(
      { data: { unlockedLevel: "corrupt" }, at: 0 },
      { data: { unlockedLevel: 5 }, at: 0 },
      ruleFor,
    );
    expect(r.merged["unlockedLevel"]).toBe(5);
  });
});
