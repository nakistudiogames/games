import { describe, expect, it } from "vitest";
import { saveRule } from "../src/cloudSaveRules";

describe("cloud save rules", () => {
  it("merges progression by best-of", () => {
    expect(saveRule("unlockedLevel")).toBe("max");
    expect(saveRule("bestPct:37")).toBe("max");
    expect(saveRule("attempts:5")).toBe("max");
    expect(saveRule("totalClears")).toBe("max");
    expect(saveRule("bestTimeMs:12")).toBe("minPos");
    expect(saveRule("ach:first-clear")).toBe("or");
    expect(saveRule("longNoRevive")).toBe("or");
  });

  it("resolves cosmetic preferences by recency", () => {
    for (const k of ["character", "sfxMuted", "musicMuted", "hapticsOff", "playerName"]) {
      expect(saveRule(k)).toBe("newer");
    }
  });

  it("keeps device-local and internal keys out of the cloud", () => {
    for (const k of ["godMode", "lbDirty", "saveDirty", "saveAt", "authName", "someFutureKey"]) {
      expect(saveRule(k)).toBeNull();
    }
  });
});
