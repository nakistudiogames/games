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
packages/firebase @mg/firebase — FirebaseConfig type + firebaseConfigured;
                           getFirebase(config) lazy dynamic-import init +
                           auth (memoized promise; awaits authStateReady so
                           a persisted login is never clobbered by a fresh
                           anon user; handle.uid is a LIVE getter — login
                           can change it); firestore() = lazy memoized
                           firebase/firestore module so games never import
                           "firebase/*" directly; gamePath(gameId,...)
                           ("games/<id>/…" namespacing convention). LOGIN
                           (provider-agnostic, one flow for Google+Apple):
                           AUTH_PROVIDERS (google.com enabled, apple.com
                           dormant until console setup — flip its `enabled`
                           at iOS time, no other code), signInWith(cfg,id)
                           = linkWithPopup upgrade of the anon account (uid
                           preserved) or, on credential-already-in-use,
                           signInWithCredential into the existing account
                           (uidChanged:true → caller must resubmit per-uid
                           data), null on popup-cancel; signOutToAnonymous
                           (fresh anon uid). Owns the firebase npm dep. SDK
                           stays out of main bundles.
packages/leaderboard @mg/leaderboard — PURE (zero deps, vitest-tested):
                           validName/NAME_MIN/MAX, randomHandle, localName,
                           formatTimeMs, DirtySet (persisted
                           failed-submit tags, e.g. "level:3"/"overall"),
                           KVStore interface (GameStorage satisfies it).
packages/cloudsave @mg/cloudsave — cross-device progress sync. merge.ts =
                           PURE tested field-wise save merging (MergeRule:
                           max/minPos/or/newer per key; SaveDoc {data,at});
                           index.ts = cloudSave({gameId,config,store,
                           ruleFor}) → CloudSaveService (Noop when
                           unconfigured): ONE private Firestore doc
                           games/<id>/saves/{uid}; sync() = pull+merge+
                           apply+push (returns locally-changed keys; seeds
                           cloud on first sync; filters remote keys the
                           client excludes), push() after progress events;
                           failures → "saveDirty" retried by next sync.
                           Reserved local keys saveDirty/saveAt (recency for
                           "newer" rule) never sync.
firebase/       PROJECT-GLOBAL Firestore rules+indexes for the ONE shared
                Firebase project (dash-937de) all games use. Deploys run ONLY
                from here (each deploy replaces the whole ruleset — per-game
                rules files are forbidden). Layout: games/{gameId}/players/
                {uid} + generic higher-is-better games/{gameId}/scores/{uid}
                (covers the 4 simple games, rules already in place) + private
                games/{gameId}/saves/{uid} cloud saves (owner-only BOTH
                directions, {data: map, at}) + bespoke
                cube-dash blocks (levels/overall). Hardened: field allowlists
                (hasOnly), no profile deletes, per-level minimum-time floor
                ((15+3*level)*250 ms — division-free duration/4 bound from
                the level path segment). rules-check.mjs = allow/deny matrix
                vs the local emulator (needs Java; see docs/firebase-setup
                .md) — run + all-PASS before ANY rules deploy, extend when a
                game adds rule blocks. Anonymous uid is per app
                install — NO cross-game identity; free tier pooled.
packages/ui     @mg/ui   — Phaser helpers: floatBanner (celebration text,
                           drop shadow, device-res text); textButton (3D
                           extruded rounded button: gradient cap on a darker
                           slab, cap sinks on press; returns a CONTAINER, not
                           Text — callers only add/store it, don't chain Text
                           methods)
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
games/cube-dash    Game #5, browser-playable. Display name "Dash the Cube"
                   (renamed 2026-07-05; package/dir/storage namespace/script
                   stay cube-dash on purpose — renaming those breaks scripts
                   and wipes saved progress). Geometry-Dash-style auto-runner
                   (named to avoid the trademark): pure physics in
                   src/logic/runner.ts (tested) — jump/gravity, block-top
                   landing vs side-hit death, inset spike hitboxes, pattern
                   spawner with speed-gated patterns (spike3 needs ≥540 px/s)
                   and clearability invariants tested. Obstacle KINDS unlock
                   +1 per world (KIND_UNLOCK_LEVEL / obstacleKindsForLevel,
                   tested): spike+block from L1, saw L6 (ground buzzsaw,
                   circular hitbox, spins), pit L11 (lava trench, lethal only
                   at ground level — jump across, width-jumpable tested),
                   swing L16 (spike ball bobbing elev 10-130 as a pure
                   function of x via swingElev(o.x, o.phase) — phase drawn
                   from the level rng; every height clearable: ≤120 jumpable
                   over, ≥80 run-underable), laser L21 (thin 24x130 pylon
                   beam, always lethal — the pulse is visual only), geyser
                   L26 (temple vent, flame column erupts ~half-duty as a pure
                   function of x via geyserActive — lull walkable, eruption
                   jumpable, tested), tentacle L31 (thin 30x120 swaying stalk,
                   hitbox follows tentacleSway(x) ±24px, worst-case footprint
                   jumpable, tested), arc L36 (200x50 tesla span between twin
                   pylons, always lethal, crackle visual only — forces one
                   full-commitment jump, single-jump clearability tested),
                   then worlds 9-20 (all same pure-fn-of-x doctrine, all
                   clearability-tested via the airWindowPx helper): phantom
                   L41 (60x110 crystal phasing solid/ghost, phantomSolid),
                   vine L46 (54px stalk, lash height 40↔140 via vineHeight),
                   gear L51 (70px cog patrolling ±40 via gearShift, circle
                   hitbox), gate L56 (twin bars 0-40 & 170-300 from ONE spec
                   — jump THROUGH the 130px window), crusher L61 (90x60 slab
                   bobbing in the swing band [10,130] via crusherElev), urchin
                   L66 (80px static floating ball at elev 40, jump-over only),
                   talon L71 (66x120 claw erupting via talonActive), drone L76
                   (60px patroller, droneElev always ≥80 → run-under safe,
                   droneShift ±40), obelisk L81 (30x150 monolith, laser-style
                   hitbox), flare L86 (210x24 fire ribbon, arc-style, widest
                   jump), comet L91 (54x60 fireball, cometElev=max(0,.55*(x-
                   480)) — grounded before reaching the player), reaper L96
                   (60x90 scythe sweeping via reaperActive). AIR HAZARDS
                   (2026-07-21): SECOND unlock cadence — AIR_KINDS set, one
                   new floating hazard per 10 levels STARTING AT L5
                   (5,15,...,95; shifted from 10,20,...,100 same day per
                   user — re-rolled layouts L5+), all DEADLY TO JUMP
                   INTO / SAFE TO RUN UNDER (band bottom ≥ AIR_BAND_MIN_ELEV
                   85, band top above the ~200 jump apex or too wide to
                   clear over; both directions tested per kind): halo L5
                   (static ring), wisp L15 (elev bobs 85-145, wispElev),
                   lance L25 (200x26 spear @150 — airWindow < span), swarm
                   L35 (3 orbs from ONE spec, SWARM_OFFSETS), flux L45
                   (net, lethal half-duty fluxOn), pendul L55 (orb sweeps
                   ±44 pendulShift), rails L65 (twin bars 85-125 + 165-230
                   from one spec, no player-sized gap), cyclone L75 (funnel
                   sways ±20 cycloneSway), specter L85 (solid/ghost
                   specterSolid), nova L95 (core + orbiting satellite
                   novaSatPos, sat bottom ≥ 88). Each has an intro pattern
                   at its exact unlock + a conservative combo (flanking
                   ground obstacles ≥ ~340px so no mandatory jump crosses a
                   band). The unlock-cadence test checks BOTH rules (world
                   kinds on world starts, air kinds at 5 past each multiple
                   of 10, one per decade); bot cleared all 100 re-rolled
                   levels first try, both cadences. KINDS_WITH_PHASE
                   set (now incl. wisp/flux/pendul/cyclone/specter/nova)
                   drives seeded phase assignment at spawn. MIRROR/FLIP
                   ZONES (2026-07-21: the scenery — sky/stars/silhouettes/
                   haze — now lives in its own bgLayer container that gets
                   the IDENTICAL reflection as trackLayer, so background +
                   parallax reverse/flip with the world; flip coverage is
                   exact: sky [0,1000]→[320,1320], ground strip →[0,320]):
                   trackZones(level,lengthPx) (seeded levelSeed^0x51af,
                   separate from layout rng) → 1-2 "mirror" zones L41+ and
                   1-2 "flip" zones L61+, each 12-20% of length clamped
                   [1500,6000]px, sorted, ≥800px apart, ends ≥1600px before
                   finish (all tested). PURE RENDER TRANSFORM: GameScene puts
                   ground strip + all spawned views + player + particles in
                   ONE trackLayer container; mirror = scaleX -1 @ x=720
                   (cube appears to run right-to-left), flip = scaleY -1 @
                   y=1320 (pivot 660: ground 1000 ↔ ceiling 320 — cube runs
                   the ceiling track with obstacles hanging down). Physics/
                   layouts/progress untouched, so all clearability holds
                   inside zones. Zone boundaries: portal-pillar gates on the
                   track + camera flash on crossing (ZONE_COLORS: mirror
                   chrome / flip violet).
                   MANDATORY RULE: every new world must introduce an obstacle
                   kind no earlier world had — new WORLDS entry ⇒ new
                   ObstacleKind unlocking at that world's first level in
                   KIND_UNLOCK_LEVEL + an intro pattern at that minLevel
                   (enforced by tests in worlds.test.ts + runner.test.ts,
                   which fail on a world without a kind or a kind without a
                   pattern). Patterns
                   gate on BOTH minSpeed and minLevel (pickPattern(rng,
                   speed, level)); world-1 layouts unchanged by the feature
                   since all new patterns are minLevel ≥ 6. Obstacles have `elev`
                   (floating layer): kill only inside their vertical band, so
                   run-under is safe (elev ≥ 80 invariant tested); elevated
                   platform tops ≤ 190 (single-jump reach, tested). Layered
                   patterns by level: stairs L2, tunnel/airMine L3, skyway L4,
                   mineCombo L5; air mines render as inverted spikes.
                   Background gains a 2nd silhouette layer from the 3rd level
                   of each world (foreground speed streaks were tried and
                   removed per user). WORLDS (src/worlds.ts, tested): every 5
                   levels share a theme — sky/haze/silhouette/ground palette +
                   its own MusicPattern — 20 worlds, cycling after level 100:
                   Neon City (132bpm) / Crystal Caves (112) / Magma Core (138)
                   / Frost Ridge (118, peaks) / Toxic Swamp (126, mushrooms) /
                   Gilded Dunes (124, ruins) / Deep Abyss (96, tendrils) /
                   Aurora Summit (150, spires) / Mirror Mirage (120, arches,
                   whole-tone) / Volt Grid (134, pylons, E-minor arps — was
                   Verdant Hollow/pines until 2026-07-21, electrified per
                   user so its clear unlocks Bolt; accent LEVEL_COLORS[9]
                   now 0xd4e157) / Rust Foundry
                   (140, stacks) / Storm Shelf (128, thunderheads) / Inverted
                   Citadel (110, citadel, harmonic minor) / Coral Shallows
                   (122, coral) / Bone Wastes (100, ribs, Phrygian) / Neon
                   Vault (138, circuits) / Obsidian Reach (104, obelisks) /
                   Solar Forge (148, flares, mixolydian) / Void Nebula (96,
                   planets, lydian) / Chrome Apex (160, summit); each world
                   has a unique silhouette style (uniqueness tested) and its
                   own LEVEL_COLORS accent (20 entries); textures generated
                   per world (sil-<id>, ground-<id>); music.ts caches one
                   MusicPlayer per world (musicForLevel/stopAllMusic). HUD
                   run timer next to the % (elapsed active-play time, shown
                   on the complete screen too; finish triggers at remaining
                   <= 0 = cube FULLY past the pole — was <= 40, which
                   stopped the clock ~0.1s early, fixed 2026-07-21; sim
                   mirrors). Pause: ESC or ⏸ HUD button →
                   overlay w/ resume/restart/menu; auto-pauses on Phaser
                   HIDDEN/BLUR (covers Capacitor app-backgrounding via
                   visibilitychange); 200ms resume guard swallows the RESUME
                   tap so it doesn't double as a jump. Menu: tap level number
                   or ⊞ → paginated level-select grid (5x4/page, ✓/best-%,
                   locked 🔒 tiles). Level system (GD-style
                   discrete levels): select in menu (◀ ▶), each level is a
                   fixed run ending at a checkered finish line; clearing
                   unlocks the next. Length is TIME-based (levelDurationSec):
                   world 1 = 30s, +15s per world, distance = duration ×
                   levelSpeed. Layouts
                   are SEEDED per level (levelSeed = n*7919) so every attempt
                   is identical/memorizable. Speed +40/level (base 420 cap
                   600 → spike3 from level 4), gaps ×levelGapScale (1.2→0.75,
                   clearability tested levels 1-25), no spawns in last 1200px
                   runway. HUD: % progress + top progress bar. Storage keys:
                   "unlockedLevel", "lastPlayed", "bestPct:<n>", "character",
                   "godMode", "attempts:<n>", "ach:<id>", "sfxMuted",
                   "hapticsOff", stats counters (totalAttempts/totalDeaths/
                   totalClears/totalPlayMs/totalMeters/nearMisses/shieldSaves/
                   surgeUses/longNoRevive) ("highScore"/"bestLevel" legacy,
                   unused). "BETTER PACK" (2026-07-06): FEEL — instant retry
                   (tap anywhere on death screen, 400ms panic guard,
                   deadButtons hit-test; SPACE too) + scrolling "ATTEMPT N"
                   tag; coyote time (COYOTE_MS 90, Runner.coyoteMs, tested);
                   near-miss (nearMiss() = overlapsHazard pad 24 minus lethal,
                   tested; sparks+count on pass); death juice (80ms freeze
                   then burst/shake/zoom-punch) + squash&stretch (punchScale)
                   (landing camera kick removed 2026-07-21 per user — the
                   nudge read as world shake; landing feel is cube-only
                   squash + dust now). PROGRESSION — src/achievements.ts
                   (13 pure-checked achievements over PlayerStats snapshot,
                   newlyEarned() grants + floatBanner toasts w/ depth 120;
                   trophy 🏆 + stats 📊 menu overlays; floatBanner gained a
                   depth param). CONTENT — power-ups now doubleJump/shield/
                   surge (POWERUP_UNLOCK_LEVEL 1/6/16, rng.pick same stream
                   — NOTE: this re-rolled layouts for levels 6+; shield eats
                   one death → NO invuln window (removed 2026-07-21 per
                   user): a shieldEscaping flag passes through THE breaking
                   collision only, lethality re-arms on the first
                   hazard-free frame (sim mirrors); surge (was slow-mo until
                   2026-07-21, "boring" per user) = SURGE_MUL 1.5x on simDt
                   — same dt-scaling doctrine so px trajectories/clearability
                   unchanged, risk = reaction time, reward = faster clear on
                   the time leaderboards; SUSPENDED during pad flights so
                   stacking with the 3.23x flight can't undercut the
                   Firestore rules' duration/4 min-clear-time floor (sim
                   mirrors this); ach "timebender"→"surgerider", stat key
                   "slowmoUses"→"surgeUses";
                   badge column + shieldRing); track boosts (trackBoosts():
                   seeded ^0xb005, pads L6+ launch at PAD_JUMP_VELOCITY 1.25x
                   — suppressed when overheadAhead(), strips L9+ = DASH_MUL
                   1.2 for 1600px, all tested); finales (isFinaleLevel = every
                   5th: gap ×0.88 floored, music +8bpm via cache key, gold
                   gate, ★FINALE HUD/menu tags, confetti). POLISH — MusicPlayer
                   .setVoiceGain (hat off <33%, lead 60%→85%→100% w/ progress);
                   menu attract mode (src/worldView.ts ensureWorldTextures —
                   silhouette/ground gen EXTRACTED from GameScene, shared;
                   world-themed backdrop + hopping demo cube, rebuilt on world/
                   character change); @mg/core haptics (navigator.vibrate
                   tap/thud/win, no-op where unsupported); sfx.setMuted +
                   🔊SFX toggles in menu ⚙ SETTINGS + pause overlay.
                   LEADERBOARDS (Firebase, 2026-07-10; restructured for the
                   shared project 2026-07-21): per-level fastest clear +
                   overall (highestLevel DESC, totalTimeMs ASC — ties by
                   lower total). src/leaderboardCore.ts = cube-specific pure
                   (computeOverall, Level/OverallEntry; names/format/dirty
                   moved to @mg/leaderboard); src/leaderboard.ts =
                   LeaderboardService w/ FirebaseLeaderboard + NoopLeader-
                   board (AdsService pattern) built on @mg/firebase
                   (getFirebase + firestore(), lazy chunks — main bundle
                   clean) + @mg/leaderboard (localName, DirtySet, gamePath).
                   Anonymous Firebase Auth (silent, uid = doc key), editable
                   handle (window.prompt, validName 3-20). Firestore (real
                   config committed, project dash-937de): games/cube-dash/
                   players/{uid}, games/cube-dash/levels/{n}/scores/{uid}
                   (best only, improvement-only + per-level min-time floor
                   via rules), games/cube-dash/overall/{uid} (monotonic
                   highestLevel); rules/indexes live in repo-root firebase/
                   (project-global — see that entry), deploy per docs/
                   firebase-setup.md (USER redeploy pending after the
                   restructure; old root-level test collections to delete).
                   Failed submits → DirtySet "lbDirty" tags retried by
                   syncDirty() on 🏅 open; rule-rejected (permission-denied
                   = remote already better, e.g. 2nd device) is DROPPED, not
                   retried; resubmitAll() = all bests + overall (for uid
                   changes). Storage: "bestTimeMs:<n>" (god-gated),
                   "playerName", "lbDirty".
                   ACCOUNTS + CLOUD SAVE (2026-07-21): 👤 row in the ⚙
                   SETTINGS overlay (hidden if Firebase unconfigured) —
                   signed out = "SIGN IN WITH GOOGLE" → popup (single
                   provider goes straight to popup, keep inside the tap
                   gesture; chooser row comes with Apple); signed in =
                   green first-name row → confirm() sign-out.
                   MENU CHROME (decluttered 2026-07-21): top-left uniform
                   icon row 📖🏆📊🏅 + single top-right ⚙ opening a
                   SETTINGS overlay (buildOverlay scaffold) with rows: 🔊
                   SFX / 🎵 MUSIC / 📳 HAPTICS toggles (music+haptics are
                   NEW in menu; toggles rebuild the overlay, no scene
                   restart), 👤 account, ⚡ god mode (dev). No loose
                   toggle buttons on the menu anymore. src/account.ts: saves = cloudSave
                   instance; sessionSync() once/session from MenuScene
                   .create (restarts scene if remote improved progress);
                   logIn (merge FIRST, then resubmitAll if uidChanged);
                   logOut (fresh anon, local progress kept, NO resubmit —
                   would duplicate rows). src/cloudSaveRules.ts saveRule =
                   PURE tested key→MergeRule map: unlockedLevel/bestPct/
                   attempts/stat counters max, bestTimeMs minPos, ach/
                   longNoRevive or, character+mute/haptics prefs+playerName
                   newer, null for godMode/lbDirty/saveDirty/saveAt/
                   authName/unknown. GameScene.completeLevel → saves.push().
                   Storage adds: "authName" (cached display name for sync
                   UI), "saveAt", "saveDirty". @mg/core adds KVStore/
                   EnumerableKVStore + GameStorage.keys() (namespace-
                   stripped, for save collection).
                   GameScene.completeLevel submits on improvement + async
                   "WORLD RANK #N" line; MenuScene 🏅 overlay = LEVEL tab
                   (◀ n ▶, top 12) / OVERALL tab, own row highlighted,
                   states for unconfigured/offline/empty.
                   Guide (📖 GUIDE button in menu): tabbed overlay covering
                   ALL track content — clickable category tabs HAZARDS (31
                   kinds, unlock order, 7 pages) / POWER-UPS (3) / BOOSTS
                   (pad+strip) / GATES (mirror+gravity), per-category
                   pagination, active tab highlighted (GUIDE_CATEGORIES +
                   generic guideEntries() w/ category field in MenuScene);
                   entries are pure data in src/obstacles.ts (OBSTACLE_INFO +
                   POWERUP_INFO/BOOST_INFO/ZONE_INFO, Record<Kind,…> + tests
                   force real entries, names unique across the whole guide);
                   art shared with the game: src/obstacleView.ts (obstacles)
                   and src/trackView.ts (buildPickupView/buildBoostView/
                   buildZoneGateView + ZONE_COLORS/BOOST_PREVIEW — extracted
                   from GameScene, which now consumes them too); locked rows
                   show "??? / reach world-or-level N" teasers.
                   BOT PLAYTHROUGH TEST (test/levelSim.ts + bot.test.ts,
                   2026-07-06): headless LevelSim replicates GameScene's
                   update loop (fixed dt 1/120, same rng stream order:
                   patterns then powerups; mirrors GameScene-private consts —
                   keep in sync when touching spawn logic); a lookahead bot
                   (probe H=100; findSafePlan depth-3 returns a whole jump
                   SCHEDULE that the executor plays VERBATIM — razor-thin
                   lines like double-bounces die if replanning drifts a
                   link by a frame; base case recoverable() = hands-off the
                   runner must be GROUNDED ≥ REPLAN_MIN 35 frames before the
                   next hit, mid-air act-ability does NOT count; desperate
                   bestEffortDelay when death ≤30 frames) plays ALL 100
                   levels each npm test
                   and must finish with ZERO shield saves (~12s, timeout
                   120s). It CAUGHT + forced these fixes: (1) spawning now
                   uses BASE levelSpeed (maybeSpawnPattern(baseSpeed)) so
                   surge/dash can't change layouts; (2) surge (né slow-mo)
                   scales simDt (scroll AND physics) so px
                   trajectories are unchanged (scaling scroll only made arcs
                   impassable); (3) GATE_GAP_HI 170→240 (old window was
                   mathematically impassable: 72px crossing vs 41px of arc
                   time); (4) PADS = CANNON SHOTS (redesigned per user
                   2026-07-10): fire UNCONDITIONALLY when run over while
                   grounded — vy PAD_JUMP_VELOCITY (-1797) with the world
                   streaming at PAD_FLIGHT_SPEED_MUL 3.23x until touchdown
                   (≈3x the old flight distance on a ~30° flatter
                   trajectory), flight + touchdown now FULLY LETHAL
                   (2026-07-21 per user: removed the untouchable flight and
                   the PAD_LANDING_GRACE_MS 400 landing invuln — const
                   deleted; bot re-verified all 100 levels, steering flights
                   with the air jump; bot suite ~74s now) + ONE free air
                   jump mid-flight
                   (tryJump allowAir = doubleJumpMs>0 || padFlight, air jump
                   keeps the 3.23x stream until landing); history: overhead-
                   only checks launched pads into walls, a clear-corridor
                   check made pads never fire, a padLaunchSafe flight sim
                   worked but was replaced by this design; the bot asserts
                   ≥3 real launches per 25-level group so firing can't go
                   inert again; (5) CRUSHER_FREQ 560→2000px
                   period (fast bob shifted the band mid-crossing making
                   some phases impassable). Rng gained clone() for this.
                   Boost placement: seeded trackBoosts don't know the
                   (separately-seeded) obstacle layout, so GameScene.update-
                   Boosts NUDGES any pad/strip that would sit on a hazard
                   +40px down the track until clear (BOOST_FOOTPRINT in
                   runner.ts; retires it if it would hit the runway); the sim
                   mirrors this and the bot test asserts worstBoostOverlap≤0
                   (no boost body on a hazard body, all 100 levels). Bot test
                   runtime ~27s (nudge sim in every rollout); LevelSim.clone
                   deep-copies boosts so rollout nudges don't leak.
                   God mode: dev-only toggle row in ⚙ SETTINGS, rendered and
                   effective ONLY when location.host === "localhost:5173"
                   (godModeAvailable/godModeOn in MenuScene.ts) — unlocks all
                   levels AND all characters for selection (via
                   characterAvailable() = godModeOn || isCharacterUnlocked;
                   fixed 2026-07-21, was reading raw unlockedLevel so god
                   mode didn't reveal skins, and apex@101 exceeds the 99
                   cap anyway) and suppresses progress writes
                   (unlockedLevel bump + bestPct) so toggling off restores
                   real progress untouched. Characters:
                   cosmetic skins in src/characters.ts (pure data/rules,
                   tested) + characterView.ts (Phaser drawing — FLAT NEON
                   ARCADE look 2026-07-21 after a glossy attempt was
                   rejected: bold sharp silhouette + dark frame + flat body
                   + hard cel top-light band (ball uses Graphics.slice for a
                   top semicircle) + bright neon inner rim stroke + faint
                   outer glow bloom; sleek buildFace() = bold ink eyes with a
                   color-matched glowing core + white focus glint (no glossy
                   catchlights) + minimal mouth, mood via eye tilt; shared by game
                   and menu preview) — 21 SKINS, ONE PER WORLD (2026-07-21):
                   dash = world-0 starter; every world's CLEAR unlocks its
                   themed skin (minLevel = world*5+1, spec has `world` field,
                   lock hint "clear World N"): pixel W1 / orb W2 (caves) /
                   blaze W3 (magma) / frost W4 / spore W5 / scarab W6 /
                   gulp W7 / prism W8 (aurora) / mirage W9 / bolt W10 (volt
                   grid) / ingot W11 / nimbus W12 / spire W13 / pearl W14 /
                   marrow W15 / cipher W16 / shard W17 / sol W18 / quasar
                   W19 (NOT "nova" — that's the L100 hazard) / apex W20
                   (cube/ball/diamond shapes; aura+trail styles now REPEAT
                   across skins — uniqueness is the (shape,aura,trail)
                   triple, tested; orb/blaze/prism/bolt worlds prescribed by
                   user),
                   picker in menu (◀ ▶ arrows + name/⊞ tap opens
                   openCharacterGrid — 5-col overlay of live previews,
                   locked tiles dimmed w/ "🔒 World N", ✓ on current, tap to
                   equip; added 2026-07-21); each skin has a SIGNATURE TRAIL (2026-07-21:
                   trailStyle streaks/embers/bubbles/glints/sparks — cube
                   afterimages / rising fire motes / growing rings / tumbling
                   gem shards / jittery static — uniqueness tested; built by
                   buildCharacterTrail in characterView.ts from white trail-*
                   textures tinted spec.trail, shared by GameScene and the
                   menu attract demo runner which now emits it; the runner is
                   screen-stationary so particles stream left at worldSpeed
                   (levelSpeed passed in — slower hides them inside the body)
                   and emission runs TRAIL_AIR_BOOST 2.5x denser while
                   airborne via "baseFrequency" data + setFrequency ONLY on
                   ground/air transitions — it resets the flow counter — and
                   an explicit reset on revive); each has a
                   unique always-on aura AROUND the body — hollow outlines /
                   orbiting elements only, never fills over the sprite
                   (pulse halo / ember orbit / sonar rings / gem satellites /
                   lightning arcs; attachAura in characterView.ts, uniqueness
                   tested) — distinct from the gold double-jump overlay.
                   tap/space/up to jump,
                   JUMP SENSITIVITY (2026-07-21): releasing while rising
                   clamps vy to JUMP_CUT_VY (JUMP_VELOCITY*0.4) via pure
                   cutJump() — tap = hop, hold = full arc; STRICTLY OPT-IN
                   (no release event = full jump → clearability + bot
                   untouched; pad launches vy<-1550 not cuttable; buffered
                   jumps whose press already ended stay full),
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
unity/CubeDash  NATIVE Unity rebuild of cube-dash (2026-07-05, v2; display
                name/productName "Dash the Cube", folder/asmdef unchanged):
                after the
                1:1 port felt clunky, the game was REBUILT Unity-natively —
                same characters/auras/worlds/music, new everything else. NOT in
                npm workspaces; no ads; editor-only (Unity 6000.5.2f1
                installed). The v1 port lives in Archive~/v1-port (Unity
                ignores ~ folders); its docs are docs/unity-compare-setup.md.
                v2 design: y-UP sim, PLAYER moves through a PRE-BUILT fixed
                level (whole layout built at Start from Chunks.Build(level)),
                camera follows with look-ahead + landing kick + height damp;
                feel systems: squash & stretch (Tween.Punch), coyote 80ms,
                jump buffer 120ms, hold-to-float apex (gravity x0.78 near
                apex), GD-style half-flip driven by arc progress, hit-stop +
                slow-mo deaths, tap-anywhere instant retry w/ session ATTEMPT
                counter. Logic (asmdef CubeDash.Logic, pure): Sim.cs
                (gravity 5200/jumpV 1500, apex≈216px), Chunks.cs (authored
                chunk library, tiers 0-3 unlock at levels 1/3/5/7, gaps in
                the ground are a new hazard, seeded via level*0x9E3779B9,
                clearability invariants tested). Kinds: Spike/Block/Saw/Mine/
                Beam/Slab (ObstacleArt.cs). Kept from v1: Mulberry32 (still
                bit-exact w/ web rng), CharacterData/WorldData,
                CharacterFactory/Auras, TextureFactory (+ ScrollingTiled now
                LOCAL-space for camera-parented parallax), Painter (SS=3
                supersampling), Fx (additive), AudioEngine synth, UiFactory,
                same PlayerPrefs keys. Tests: Assets/Tests/EditMode/SimTests
                .cs (~14 tests). Batchmode tests CANNOT run while the editor
                has the project open (single-instance lock); v2 was written
                after v1 verified green but v2 itself pends its first compile.
docs/           Runbooks — phase-0-setup.md is the user's account/toolchain checklist;
                unity-compare-setup.md is the Unity Hub/editor install checklist
```

## Commands (repo root; remember the PATH prefix)
```sh
npm run dev        # block-blast on Vite dev server
npm run dev:2048   # merge-2048 on Vite dev server
npm run dev:flap   # flap-dash on Vite dev server
npm run dev:word   # word-rush on Vite dev server
npm run dev:cube   # cube-dash on Vite dev server
npm test           # vitest (@mg/cloudsave 5 + @mg/leaderboard 6 + 15 + 12
                   # + 9 + 8 + 155 = 210 tests, all green; cube-dash
                   # includes the ~74s bot playthrough suite)
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
   — Firebase project ✅ DONE (dash-937de, shared by all games, config
   committed, restructured rules deployed, old test data cleaned; Google
   sign-in provider ✅ enabled 2026-07-21 → 👤 SIGN IN live; Game Center
   also console-enabled but NATIVE-ONLY — no web popup, wire at iOS shell
   time; Sign in with Apple still required then per guideline 4.8)
3. Next Claude step once #2 lands: `npx cap add ios android` in games/block-blast,
   validate AdmobAds on real devices with test ads, then store listings + publish;
   roll shells out to the other four games on the proven checklist

## Ongoing ops (Phase 5, once games are live)
Weekly revenue/retention reports, review-reply drafting, SDK update checks —
via scheduled routines. Keep `docs/release-checklist.md` updated as publishing
steps are discovered (file doesn't exist yet; create it during pilot launch).
