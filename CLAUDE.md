# CLAUDE.md — mobile-games

Portfolio of ad-monetized casual mobile games intended to generate passive income.
Claude does nearly all development and ongoing management; the user (experienced SE,
new to mobile/game dev) handles payments, store accounts, and final submit clicks.
Full roadmap: `~/.claude/plans/i-want-you-to-wise-rain.md`.

## Locked-in decisions (2026-07-04)
- **Platforms:** Android + iOS from day one
- **Stack:** Phaser 3 + TypeScript + Vite, wrapped with Capacitor 7 for native
- **Monetization:** AdMob ads only (interstitials + rewarded video), no IAP
- **Sequencing:** one pilot (block-blast) shipped end-to-end through both stores first,
  then batch-produce the remaining ~4 games on the validated template
- `packages/ui` was extracted when game #2 (merge-2048) arrived, per plan:
  floatBanner + textButton; the sfx synth moved into @mg/core at the same time

## Environment quirks (important)
- This Mac had **no dev toolchain**. Node v24 LTS is installed at `~/.local/node`
  (user-local, no sudo). Every shell command needing node/npm must prefix:
  `export PATH="$HOME/.local/node/bin:$PATH"` — do NOT edit `~/.zshrc` (denied by
  permission policy; user was asked to add the PATH line themselves).
- git, python3, Xcode CLT, Homebrew, Android Studio, CocoaPods are NOT installed yet.
  The repo is **not a git repository** until Xcode CLT arrives — `git init` then.
- User's install instructions live in `docs/phase-0-setup.md`.

## Repo layout
```
packages/core   @mg/core — GameStorage (namespaced localStorage), Rng (seedable
                           mulberry32), sfx (WebAudio synth, zero audio assets)
packages/ads    @mg/ads  — AdsService interface; NoopAds on web, AdmobAds on native
                           (@capacitor-community/admob: UMP consent, interstitial
                           cooldown default 90s, rewarded via event listeners —
                           NOT yet validated on a real device)
packages/ui     @mg/ui   — Phaser helpers: floatBanner (celebration text),
                           textButton (padded text button)
games/block-blast  Pilot game, browser-playable. Pure logic in src/logic/ (Board,
                   pieces) with vitest tests in test/; Phaser scenes in src/scenes/.
                   Uses Google's public TEST ad unit IDs (src/ads.ts, testMode: true).
games/merge-2048   Game #2, browser-playable. Classic 4x4 2048: pure logic in
                   src/logic/grid.ts (slideLine + Grid with movement records for
                   animation), swipe + arrow-key input, slide tweens, rewarded
                   revive clears tiles < 16. Same test ad IDs / testMode.
games/flap-dash    Game #3, browser-playable. Flappy-style endless arcade: pure
                   physics/gates/collision in src/logic/flight.ts (tested); gap
                   shrinks 360→250 and speed ramps 320→540 with score; tap/space
                   to flap; rewarded revive = clear near gates + 1.5s invuln.
docs/           Runbooks — phase-0-setup.md is the user's account/toolchain checklist
```

## Commands (repo root; remember the PATH prefix)
```sh
npm run dev        # block-blast on Vite dev server
npm run dev:2048   # merge-2048 on Vite dev server
npm run dev:flap   # flap-dash on Vite dev server
npm test           # vitest (block-blast 15 + merge-2048 12 + flap-dash 9, all green)
npm run typecheck  # tsc across workspaces (strict + noUncheckedIndexedAccess)
npm run build      # production bundle (vite base './' so file:// works in Capacitor)
```

## Game design notes (block-blast)
- 8x8 grid, tray of 3 dealt pieces, no rotation; game over when no tray piece fits
- Scoring: 1/cell placed + `10 * lines² * streak` + `MONO_LINE_BONUS` (50) per
  cleared line that's entirely one color (rows AND columns) + flat
  `BOARD_CLEAR_BONUS` (300) when a clear empties the whole board; streak =
  consecutive clearing placements (resets on any non-clearing placement —
  all tested in test/board.test.ts)
- Rewarded-ad hook: one "second chance" per game swaps stuck tray for dot/h2/v2
- Interstitial fires at game over (cooldown-capped in @mg/ads)

## Status / next steps
1. ✅ Monorepo + games 1-3 (block-blast, merge-2048, flap-dash) playable in
   browser; tests/typecheck/build green (2026-07-04). Publication still pilot-first.
2. ⏳ USER: Phase 0 accounts — Play Console ($25; new personal accounts need a
   closed test with **12 testers opted in for 14 consecutive days per app** before
   production), Apple Developer ($99/yr), AdMob + tax info, Xcode + Android Studio
3. Next Claude step once #2 lands: `npx cap add ios android` in games/block-blast,
   validate AdmobAds on real devices with test ads, then store listings + publish
4. After pilot ships: remaining game candidates for #4/#5: word puzzle
   (needs a bundled dictionary), solitaire / minimalist card game

## Ongoing ops (Phase 5, once games are live)
Weekly revenue/retention reports, review-reply drafting, SDK update checks —
via scheduled routines. Keep `docs/release-checklist.md` updated as publishing
steps are discovered (file doesn't exist yet; create it during pilot launch).
