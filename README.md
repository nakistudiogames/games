# mobile-games

Portfolio of ad-monetized casual mobile games. Phaser 3 + TypeScript + Vite,
wrapped with Capacitor for iOS/Android, monetized with AdMob (ads only).

## Layout
- `packages/core` — shared storage (localStorage wrapper) + seedable RNG
- `packages/ads` — `AdsService` abstraction: no-op on web, AdMob on native (interstitial pacing, rewarded video, UMP consent)
- `games/block-blast` — pilot game: 8x8 grid puzzle, drag 3 pieces, clear lines
- `docs/` — runbooks (start with `phase-0-setup.md`)
- Shared Phaser UI helpers get extracted to `packages/ui` when game #2 needs them.

## Commands (repo root)
```sh
npm install
npm run dev        # block-blast dev server (browser)
npm test           # vitest across workspaces
npm run typecheck
npm run build
```

Node lives at `~/.local/node/bin` (no system install yet); see docs/phase-0-setup.md.

## Roadmap
1. ✅ Monorepo + pilot game playable in browser
2. Native shells (Capacitor) + test ads on devices — blocked on Xcode/Android Studio install
3. Store publication end-to-end (see plan: closed-test 12 testers / 14 days on Play)
4. Games 2–5 on the validated template
# games
# games
