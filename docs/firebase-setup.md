# Firebase setup — shared project for all games

ONE Firebase project (`dash-937de`) serves every game: one Firestore database,
one anonymous-auth setup, one ruleset. Each game keeps its data under its own
namespace (`games/<gameId>/...` in Firestore), and the security rules +
indexes live at the repo root in `firebase/` — that's the only place deploys
run from, because **every rules deploy replaces the whole project's rules**.

Per-game web config lives in each game's `src/firebaseConfig.ts` (public by
design — the apiKey is an identifier, not a secret; access control is the
rules). Games without real config values fall back to a Noop leaderboard and
run fine.

Note: anonymous auth mints a different uid per app install, so a player does
NOT get one identity across games — the shared project is an ops win (one
console, one ruleset, pooled free tier), not a shared profile.

## One-time project setup (done 2026-07)

1. https://console.firebase.google.com → **Add project** (`dash-937de`).
2. **Build → Authentication** → Sign-in method → **Anonymous** → Enable.
3. **Build → Firestore Database** → Create database, production mode,
   closest region (can't be changed later).
4. Project settings → Your apps → **`</>`** Web app → copy the config into
   the game's `src/firebaseConfig.ts`.

## Testing rules changes (Claude does this, needs Java)

`firebase/rules-check.mjs` is an allow/deny matrix run against the local
Firestore emulator — from `firebase/`:

```sh
npx firebase-tools emulators:exec --only firestore \
  --project demo-rules-check "node rules-check.mjs"
```

All lines must PASS before deploying a rules change.

## Deploying rules + indexes (repeat whenever `firebase/` changes)

From the repo-root `firebase/` directory (remember the node PATH prefix):

```sh
export PATH="$HOME/.local/node/bin:$PATH"
cd firebase
npx firebase-tools login              # first time only, opens a browser
npx firebase-tools use --add          # first time only: pick dash-937de, alias "default"
npx firebase-tools deploy --only firestore
```

This uploads `firestore.rules` (namespaced per game; public reads; owner-only,
improvement-only writes; field allowlists; per-level minimum-time floors for
cube-dash) and `firestore.indexes.json` (composite index for the cube-dash
overall leaderboard). Indexes take a few minutes to build.

**One-time cleanup after the 2026-07-21 restructure:** the old root-level
`players`, `levels`, and `overall` collections (pre-namespacing test data) are
now unreachable under the new rules — delete them in the Firestore console
(Data tab → collection → ⋮ → Delete collection).

## Adding a new game

1. Reuse the standard schema: simple higher-is-better games write
   `games/<gameId>/scores/{uid}` `{ name, score, at }` — the rules already
   cover this, no rules change needed. Bespoke boards (like cube-dash's
   per-level times) get their own explicit block in `firebase/firestore.rules`.
2. Register another Web app in the Firebase console (nice for separate
   metrics) or reuse the existing config values; paste into the new game's
   `src/firebaseConfig.ts` (typed by `@mg/firebase`).
3. Build the game's service on `@mg/firebase` (lazy SDK + anonymous auth) and
   `@mg/leaderboard` (names, dirty queue, `gamePath`) — see
   `games/cube-dash/src/leaderboard.ts` for the pattern.

## Verify (cube-dash)

`npm run dev:cube` → clear level 1 → the complete screen shows a WORLD RANK
line, and the 🏅 overlay lists your time. In the Firebase console you should
see `games/cube-dash/levels/1/scores/<uid>` and `games/cube-dash/overall/<uid>`.

## Costs

Firestore free tier: 50k reads / 20k writes per day, POOLED across all games
in the project — several thousand daily players before any charge. No billing
account needed to start. If one game outgrows the pool, point its
`firebaseConfig.ts` at its own project and redeploy rules there.
