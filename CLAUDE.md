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
                           mulberry32), sfx (WebAudio synth), MusicPlayer
                           (WebAudio 16-step sequencer: kick/hat/bass/lead from
                           a MusicPattern — procedural music, zero audio assets)
packages/ads    @mg/ads  — AdsService interface; NoopAds on web, AdmobAds on native
                           (@capacitor-community/admob: UMP consent, interstitial
                           cooldown default 90s, rewarded via event listeners —
                           NOT yet validated on a real device)
packages/ui     @mg/ui   — Phaser helpers: floatBanner (celebration text),
                           textButton (padded text button); both cast drop
                           shadows (setShadow) for a subtle 3D depth cue
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
games/word-rush    Game #4, browser-playable. Wordle-style endless streak: word
                   lists bundled in src/data/words.ts (2315 answers + 10657
                   allowed, cfreshman gists, no trailing newline in source —
                   don't trust wc -l); duplicate-correct evaluateGuess in
                   src/logic/words.ts (tested); on-screen QWERTY + physical
                   keyboard; rewarded hint reveals one unsolved letter/round;
                   interstitial when out of guesses. "highScore" = best streak.
games/cube-dash    Game #5, browser-playable. Geometry-Dash-style auto-runner
                   (named to avoid the trademark): pure physics in
                   src/logic/runner.ts (tested) — jump/gravity, block-top
                   landing vs side-hit death, inset spike hitboxes, pattern
                   spawner with speed-gated patterns (spike3 needs ≥540 px/s)
                   and clearability invariants tested. Level system (GD-style
                   discrete levels): select in menu (◀ ▶), each level is a
                   fixed run (600m + 150m/level, cap 1500m) ending at a
                   checkered finish line; clearing unlocks the next. Layouts
                   are SEEDED per level (levelSeed = n*7919) so every attempt
                   is identical/memorizable. Speed +40/level (base 420 cap
                   600 → spike3 from level 4), gaps ×levelGapScale (1.2→0.75,
                   clearability tested levels 1-25), no spawns in last 1200px
                   runway. HUD: % progress + top progress bar. Storage keys:
                   "unlockedLevel", "lastPlayed", "bestPct:<n>" ("highScore"/
                   "bestLevel" are legacy, unused). tap/space/up to jump,
                   jump buffering (110ms), score = meters; rewarded revive
                   clears 900px ahead + 1.2s invuln. Visual pass: all textures
                   generated at runtime via Graphics.generateTexture (gradient
                   sky, star/skyline/ground-grid parallax TileSprites, particle
                   trail/dust/death-burst, GD-style cube face); pseudo-3D
                   pass: 2.5D extruded blocks (lit top + shaded right face,
                   d=14 up-right), two-tone lit/shaded spikes, beveled cube
                   (light from top-left everywhere), soft ellipse ground
                   shadows that shrink/fade with air height, skyline haze +
                   ground fade gradients; procedural
                   music loop in src/music.ts (132bpm A-minor via @mg/core
                   MusicPlayer), starts on first tap (iOS gesture rule),
                   mute toggle persisted as "musicMuted". Power-up framework
                   in logic/runner.ts (POWER_UPS registry, tryJump, pickups
                   spawn 2400-4000px apart in obstacle-free spots, first at
                   1500px): doubleJump = 10s of one extra air jump, recharged
                   on landing; gold diamond pickup, aura + "⇈ Ns" badge.
docs/           Runbooks — phase-0-setup.md is the user's account/toolchain checklist
```

## Commands (repo root; remember the PATH prefix)
```sh
npm run dev        # block-blast on Vite dev server
npm run dev:2048   # merge-2048 on Vite dev server
npm run dev:flap   # flap-dash on Vite dev server
npm run dev:word   # word-rush on Vite dev server
npm run dev:cube   # cube-dash on Vite dev server
npm test           # vitest (15 + 12 + 9 + 8 + 25 = 69 tests, all green)
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
1. ✅ Monorepo + ALL 5 GAMES (block-blast, merge-2048, flap-dash, word-rush,
   cube-dash) playable in browser; tests/typecheck/build green (2026-07-04).
   Publication still pilot-first.
2. ⏳ USER: Phase 0 accounts — Play Console ($25; new personal accounts need a
   closed test with **12 testers opted in for 14 consecutive days per app** before
   production), Apple Developer ($99/yr), AdMob + tax info, Xcode + Android Studio
3. Next Claude step once #2 lands: `npx cap add ios android` in games/block-blast,
   validate AdmobAds on real devices with test ads, then store listings + publish;
   roll shells out to the other four games on the proven checklist

## Ongoing ops (Phase 5, once games are live)
Weekly revenue/retention reports, review-reply drafting, SDK update checks —
via scheduled routines. Keep `docs/release-checklist.md` updated as publishing
steps are discovered (file doesn't exist yet; create it during pilot launch).
