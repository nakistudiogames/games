/**
 * Pure cross-device save merging — no Firebase imports (vitest-safe).
 *
 * A save is a flat key→JSON-value map plus a write timestamp. Merging is
 * field-wise so two devices that progressed independently both keep their
 * best results, rather than one clobbering the other.
 */

export type SaveData = Record<string, unknown>;

export interface SaveDoc {
  data: SaveData;
  /** Client wall-clock ms of the write (drives "newer" fields only). */
  at: number;
}

/**
 * How a key merges across devices:
 *  - "max":    larger number wins (progress, best percents, stat counters)
 *  - "minPos": smaller POSITIVE number wins (best times; 0/missing = unset)
 *  - "or":     true wins (achievements)
 *  - "newer":  the more recently written save wins (cosmetic preferences)
 */
export type MergeRule = "max" | "minPos" | "or" | "newer";

export interface MergeResult {
  merged: SaveData;
  /** Keys whose merged value differs from the local save (apply locally). */
  changedLocal: string[];
  /** Keys whose merged value differs from the remote save (needs a push). */
  changedRemote: string[];
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function mergeValue(rule: MergeRule, local: unknown, remote: unknown, localNewer: boolean): unknown {
  if (local === undefined) return remote;
  if (remote === undefined) return local;
  switch (rule) {
    case "max": {
      const l = num(local);
      const r = num(remote);
      if (l === null) return remote;
      if (r === null) return local;
      return Math.max(l, r);
    }
    case "minPos": {
      const l = num(local);
      const r = num(remote);
      if (l === null || l <= 0) return remote;
      if (r === null || r <= 0) return local;
      return Math.min(l, r);
    }
    case "or":
      return Boolean(local) || Boolean(remote);
    case "newer":
      return localNewer ? local : remote;
  }
}

/** Field-wise merge of a local and remote save (see MergeRule). */
export function mergeSaves(
  local: SaveDoc,
  remote: SaveDoc,
  ruleFor: (key: string) => MergeRule,
): MergeResult {
  const localNewer = local.at >= remote.at;
  const merged: SaveData = {};
  const changedLocal: string[] = [];
  const changedRemote: string[] = [];
  const keys = new Set([...Object.keys(local.data), ...Object.keys(remote.data)]);
  for (const key of keys) {
    const v = mergeValue(ruleFor(key), local.data[key], remote.data[key], localNewer);
    if (v === undefined) continue;
    merged[key] = v;
    if (JSON.stringify(v) !== JSON.stringify(local.data[key])) changedLocal.push(key);
    if (JSON.stringify(v) !== JSON.stringify(remote.data[key])) changedRemote.push(key);
  }
  return { merged, changedLocal, changedRemote };
}
