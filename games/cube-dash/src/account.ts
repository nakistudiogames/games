import { GameStorage } from "@mg/core";
import { AUTH_PROVIDERS, firebaseConfigured, signInWith, signOutToAnonymous } from "@mg/firebase";
import type { AuthProviderId, AuthUser } from "@mg/firebase";
import { cloudSave } from "@mg/cloudsave";
import { firebaseConfig } from "./firebaseConfig";
import { saveRule } from "./cloudSaveRules";
import { leaderboard } from "./leaderboard";

/**
 * Account layer: login (provider-agnostic — Google now, Apple flips on in
 * @mg/firebase AUTH_PROVIDERS once its console setup exists) + cloud-saved
 * progress. Anonymous play works exactly as before; logging in upgrades the
 * anonymous account in place, and progress then follows the account across
 * devices via @mg/cloudsave field-wise merging.
 */

// Own GameStorage instance (same namespace) — same cycle-avoidance as
// leaderboard.ts.
const store = new GameStorage("cube-dash");

export const saves = cloudSave({
  gameId: "cube-dash",
  config: firebaseConfig,
  store,
  ruleFor: saveRule,
});

/** Providers to offer in UI (only ones enabled in the Firebase console). */
export function loginProviders(): { id: AuthProviderId; label: string }[] {
  return firebaseConfigured(firebaseConfig) ? AUTH_PROVIDERS.filter((p) => p.enabled) : [];
}

/**
 * Last known signed-in display name, cached locally for instant sync UI
 * (auth state itself is async). "" = not logged in.
 */
export function accountName(): string {
  return store.get("authName", "");
}

let syncedThisSession = false;

/**
 * Once-per-session background sync (menu load): pulls the account's cloud
 * save, merges, pushes. Returns keys the remote improved (UI should
 * refresh when non-empty). Safe to call repeatedly.
 */
export async function sessionSync(): Promise<string[]> {
  if (!saves.ready || syncedThisSession) return [];
  syncedThisSession = true;
  return saves.sync();
}

/**
 * Interactive login (must run in a user gesture — popup). On success the
 * cloud save merges immediately; if the login landed on an EXISTING account
 * (different uid), local bests are re-submitted to the leaderboards under
 * it. Returns the user, or null if the player cancelled.
 */
export async function logIn(providerId: AuthProviderId): Promise<AuthUser | null> {
  const result = await signInWith(firebaseConfig, providerId);
  if (result === null) return null;
  store.set("authName", result.user.name ?? "Player");
  syncedThisSession = false;
  await sessionSync(); // merge FIRST so the resubmit sees the account's best data
  if (result.uidChanged) void leaderboard().resubmitAll();
  return result.user;
}

/**
 * Logout: drops to a FRESH anonymous identity. Local progress stays on the
 * device (and seeds the new anonymous account's cloud save on next sync);
 * the logged-in account's progress lives on in the cloud. Leaderboard rows
 * are NOT resubmitted here — that would instantly duplicate the account's
 * rows under the new anonymous uid.
 */
export async function logOut(): Promise<void> {
  await signOutToAnonymous(firebaseConfig);
  store.set("authName", "");
  syncedThisSession = false;
}
