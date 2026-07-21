/**
 * @mg/cloudsave — cross-device progress sync over Firestore.
 *
 * Each game stores ONE private doc at games/{gameId}/saves/{uid}
 * ({ data, at }; owner-only in rules). The game declares which storage keys
 * sync and how they merge (see MergeRule in merge.ts); sync() pulls the
 * remote save, field-wise-merges it with local storage, applies what the
 * remote had better, and pushes back what local had better. Firebase loads
 * lazily via @mg/firebase — never in the initial bundle or vitest.
 *
 * Reserved local keys (never synced): "saveDirty" (failed-push flag),
 * "saveAt" (local save recency driving the "newer" rule).
 */
import type { EnumerableKVStore } from "@mg/core";
import { firebaseConfigured, firestore, gamePath, getFirebase } from "@mg/firebase";
import type { FirebaseConfig } from "@mg/firebase";
import { mergeSaves } from "./merge";
import type { MergeRule, SaveData, SaveDoc } from "./merge";

export { mergeSaves } from "./merge";
export type { MergeResult, MergeRule, SaveData, SaveDoc } from "./merge";

const RESERVED = new Set(["saveDirty", "saveAt"]);

export interface CloudSaveSpec {
  gameId: string;
  config: FirebaseConfig;
  store: EnumerableKVStore;
  /** Merge rule for a storage key, or null to keep it device-local. */
  ruleFor(key: string): MergeRule | null;
}

export interface CloudSaveService {
  /** False = unconfigured Noop: nothing syncs, game runs unchanged. */
  readonly ready: boolean;
  /**
   * Pull + merge + apply + push. Returns the storage keys that CHANGED
   * locally (remote had better values) so callers can refresh UI and
   * resubmit leaderboards; [] when offline/unconfigured/no change.
   */
  sync(): Promise<string[]>;
  /** Push the current local state (e.g. after a level clear); retried by the next sync() on failure. */
  push(): Promise<void>;
}

class NoopCloudSave implements CloudSaveService {
  readonly ready = false;
  async sync(): Promise<string[]> {
    return [];
  }
  async push(): Promise<void> {}
}

class FirebaseCloudSave implements CloudSaveService {
  readonly ready = true;
  constructor(private readonly spec: CloudSaveSpec) {}

  private collect(): SaveData {
    const { store, ruleFor } = this.spec;
    const data: SaveData = {};
    for (const key of store.keys()) {
      if (RESERVED.has(key) || ruleFor(key) === null) continue;
      const v = store.get<unknown>(key, undefined);
      if (v !== undefined) data[key] = v;
    }
    return data;
  }

  private async saveDocRef() {
    const { db, uid } = await getFirebase(this.spec.config);
    const { doc } = await firestore();
    return doc(db, ...gamePath(this.spec.gameId, "saves", uid));
  }

  async push(): Promise<void> {
    try {
      const ref = await this.saveDocRef();
      const { setDoc } = await firestore();
      const at = Date.now();
      await setDoc(ref, { data: this.collect(), at });
      this.spec.store.set("saveAt", at);
      this.spec.store.set("saveDirty", false);
    } catch {
      this.spec.store.set("saveDirty", true);
    }
  }

  async sync(): Promise<string[]> {
    const { store, ruleFor } = this.spec;
    try {
      const ref = await this.saveDocRef();
      const { getDoc, setDoc } = await firestore();
      const snap = await getDoc(ref);
      const local: SaveDoc = { data: this.collect(), at: store.get("saveAt", 0) };
      if (!snap.exists()) {
        // First device on this account: seed the cloud with local state.
        const at = Date.now();
        await setDoc(ref, { data: local.data, at });
        store.set("saveAt", at);
        store.set("saveDirty", false);
        return [];
      }
      const raw = snap.data() as Partial<SaveDoc>;
      const remoteData: SaveData = {};
      if (typeof raw.data === "object" && raw.data !== null) {
        // Drop remote keys this client version excludes (ruleFor null).
        for (const [k, v] of Object.entries(raw.data)) {
          if (!RESERVED.has(k) && ruleFor(k) !== null) remoteData[k] = v;
        }
      }
      const remote: SaveDoc = { data: remoteData, at: typeof raw.at === "number" ? raw.at : 0 };
      const { merged, changedLocal, changedRemote } = mergeSaves(local, remote, (k) => ruleFor(k) ?? "max");
      for (const key of changedLocal) store.set(key, merged[key]);
      if (changedRemote.length > 0 || store.get("saveDirty", false)) {
        const at = Date.now();
        await setDoc(ref, { data: merged, at });
        store.set("saveAt", at);
      } else {
        store.set("saveAt", Math.max(local.at, remote.at));
      }
      store.set("saveDirty", false);
      return changedLocal;
    } catch {
      store.set("saveDirty", true);
      return [];
    }
  }
}

/** The game's cloud-save service (Noop until Firebase is configured). */
export function cloudSave(spec: CloudSaveSpec): CloudSaveService {
  return firebaseConfigured(spec.config) ? new FirebaseCloudSave(spec) : new NoopCloudSave();
}
