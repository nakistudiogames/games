# Unity comparison — setup checklist (USER steps)

Goal: open `unity/CubeDash` (a full Unity port of cube-dash) in the Unity Editor
and play it side by side with `npm run dev:cube`. Everything in the project is
already written; these steps only install the editor.

## 1. Install Unity Hub
- Download from https://unity.com/download (macOS, Apple silicon build).
- Drag Unity Hub to Applications, open it, sign in / create a free Unity account.
- Choose the **Personal** (free) license when prompted.

## 2. Install the editor
- In Unity Hub: **Installs → Install Editor → Unity 6 LTS** (a `6000.x.yfz` version).
- Deselect every optional module (no Android/iOS/WebGL needed yet — macOS
  editor support is included by default). ~8 GB download.

## 3. Tell Claude the version
- The installed version string is shown in Hub's Installs tab (e.g. `6000.0.32f1`).
- Tell Claude — it will be written into
  `unity/CubeDash/ProjectSettings/ProjectVersion.txt` so the project opens
  without an upgrade prompt. (If skipped, Hub will just ask to open it with
  your installed version — say yes; that's fine too.)

## 4. Open the project
- Unity Hub → **Projects → Add → Add project from disk** →
  `~/Desktop/projects/mobile-games/unity/CubeDash`.
- First open takes a few minutes (imports + package resolve).
- If the console shows compile errors on first open, copy them to Claude.

## 5. Play
- The project has no authored scene content — everything spawns from code.
  Just press **Play** with the default empty scene open.
- Set the Game view aspect dropdown to **9:16 Portrait** (or add a custom
  720x1280 resolution) for the intended framing; other aspects letterbox.
- Controls are the same as the web version: click / Space / Up-arrow to jump,
  ESC to pause.

## 6. Optional: headless test run (Claude can do this once Unity is installed)
```sh
"/Applications/Unity/Hub/Editor/<version>/Unity.app/Contents/MacOS/Unity" \
  -batchmode -projectPath ~/Desktop/projects/mobile-games/unity/CubeDash \
  -runTests -testPlatform EditMode \
  -testResults /tmp/cubedash-results.xml -quit
```
The EditMode tests include an RNG-parity suite proving the C# port generates
the identical level layouts as the web build.
