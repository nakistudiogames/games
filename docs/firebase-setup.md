# Firebase setup — Dash the Cube leaderboards

One-time setup (~10 minutes). Until this is done, the game runs normally and the
🏅 leaderboard shows "not configured yet".

## 1. Create the Firebase project

1. Go to https://console.firebase.google.com (use the same Google account you'll
   use for AdMob/Play Console — keeps everything in one place).
2. **Add project** → name it `dash-the-cube` (or anything) → Google Analytics:
   optional, fine to disable for now → Create.

## 2. Enable Anonymous authentication

1. In the left sidebar: **Build → Authentication** → **Get started**.
2. **Sign-in method** tab → **Anonymous** → Enable → Save.

(That's the whole auth setup — players get a silent anonymous identity; no
login screens, no personal data.)

## 3. Create the Firestore database

1. **Build → Firestore Database** → **Create database**.
2. Location: pick the closest region (e.g. `eur3` or `us-central1`) — this
   can't be changed later.
3. Start in **production mode** (locked down; our rules deploy replaces them).

## 4. Paste the web config into the game

1. Project overview (gear icon) → **Project settings** → scroll to
   **Your apps** → click the **`</>`** (Web) icon → nickname `web` →
   Register app (skip hosting).
2. Copy the `firebaseConfig` object values into
   `games/cube-dash/src/firebaseConfig.ts`, replacing the `PASTE_ME`
   placeholders. (This config is public by design — committing it is fine.)

## 5. Deploy the security rules + index

From `games/cube-dash/` (remember the node PATH prefix):

```sh
export PATH="$HOME/.local/node/bin:$PATH"
npx firebase-tools login              # opens a browser
npx firebase-tools use --add          # pick the project, alias "default"
npx firebase-tools deploy --only firestore
```

This uploads `firestore.rules` (public reads; owner-only, improvement-only
writes) and `firestore.indexes.json` (the composite index the overall
leaderboard query needs). The index takes a few minutes to build.

## 6. Verify

`npm run dev:cube` → clear level 1 → the complete screen shows a WORLD RANK
line, and the 🏅 overlay lists your time. In the Firebase console you should
see `levels/1/scores/<uid>` and `overall/<uid>` documents.

## Costs

Firestore free tier: 50k reads / 20k writes per day — several thousand daily
players before any charge. No billing account needed to start.
