import Phaser from "phaser";
import { GameStorage, haptics, sfx } from "@mg/core";
import { textButton } from "@mg/ui";
import {
  FLIP_MIN_LEVEL,
  KIND_UNLOCK_LEVEL,
  LEVELS_PER_WORLD,
  MIRROR_MIN_LEVEL,
  PAD_MIN_LEVEL,
  POWERUP_UNLOCK_LEVEL,
  POWER_UPS,
  STRIP_MIN_LEVEL,
  isFinaleLevel,
  levelColor,
  levelDurationSec,
} from "../logic/runner";
import type { BoostKind, ObstacleKind, PowerUpKind, TrackZoneKind } from "../logic/runner";
import { worldForLevel } from "../worlds";
import { CHARACTERS, characterById, isCharacterUnlocked } from "../characters";
import { attachAura, buildCharacterParts, buildCharacterTrail } from "../characterView";
import { BOOST_INFO, OBSTACLE_INFO, POWERUP_INFO, ZONE_INFO } from "../obstacles";
import { OBSTACLE_PREVIEW, buildObstaclePreview } from "../obstacleView";
import {
  BOOST_PREVIEW,
  ZONE_COLORS,
  ZONE_GATE_SIZE,
  buildBoostView,
  buildPickupView,
  buildZoneGateView,
} from "../trackView";
import { ACHIEVEMENTS, isEarned } from "../achievements";
import { leaderboard } from "../leaderboard";
import { accountName, logIn, logOut, loginProviders, sessionSync } from "../account";
import type { AuthProviderId } from "@mg/firebase";
import { formatTimeMs, validName } from "@mg/leaderboard";
import { ensureWorldTextures } from "../worldView";

export const storage = new GameStorage("cube-dash");

// --- Dev-only god mode -------------------------------------------------
// Available ONLY on the Vite dev server; the toggle button never renders in
// a production/Capacitor build, and even a stale stored flag has no effect
// off localhost. While on, every level is selectable, and level completions
// do NOT touch stored progress (unlockedLevel/bestPct) — toggling off drops
// you back exactly where you really were.

/** Levels browsable in god mode (worlds cycle, so any cap works). */
const GOD_MODE_MAX_LEVEL = 99;

export function godModeAvailable(): boolean {
  return typeof location !== "undefined" && location.host === "localhost:5173";
}

export function godModeOn(): boolean {
  return godModeAvailable() && storage.get("godMode", false);
}

type GuideCategory = "hazards" | "powerups" | "boosters" | "gates";

const GUIDE_CATEGORIES: ReadonlyArray<{ id: GuideCategory; label: string; x: number }> = [
  { id: "hazards", label: "HAZARDS", x: 105 },
  { id: "powerups", label: "POWER-UPS", x: 297 },
  { id: "boosters", label: "BOOSTS", x: 480 },
  { id: "gates", label: "GATES", x: 632 },
];

export class MenuScene extends Phaser.Scene {
  private selected = 1;
  private levelWord!: Phaser.GameObjects.Text;
  private levelLabel!: Phaser.GameObjects.Text;
  private levelInfo!: Phaser.GameObjects.Text;
  private lockHint!: Phaser.GameObjects.Text;
  private charIndex = 0;
  private charPreview: Phaser.GameObjects.Container | null = null;
  private charName!: Phaser.GameObjects.Text;
  private attract: Phaser.GameObjects.Container | null = null;
  private attractWorldId = "";

  constructor() {
    super("menu");
  }

  /**
   * ⚙ Settings: every toggle in one place — SFX / music / haptics, the
   * account row (sign in to save progress across devices; hidden until
   * Firebase is configured), and the dev-only god mode. Toggles re-render
   * by rebuilding the overlay; account/god changes restart the scene
   * (progress or its clamping may change).
   */
  private openSettings(): void {
    const { width } = this.scale;
    const overlay = this.buildOverlay("SETTINGS");
    const reopen = (): void => {
      overlay.destroy();
      this.openSettings();
    };
    let y = 300;
    const row = (
      label: string,
      colors: { text: string; background: string },
      onTap: () => void,
    ): void => {
      overlay.add(textButton(this, width / 2, y, label, colors, onTap, "30px"));
      y += 110;
    };
    const toggleRow = (label: string, on: boolean, flip: () => void): void => {
      row(
        `${label}: ${on ? "ON" : "OFF"}`,
        { text: on ? "#8a93a8" : "#5c667d", background: "#181d2b" },
        () => {
          flip();
          reopen();
        },
      );
    };

    const sfxOn = !storage.get("sfxMuted", false);
    toggleRow("🔊 SFX", sfxOn, () => {
      storage.set("sfxMuted", sfxOn);
      sfx.setMuted(sfxOn);
    });
    const musicOn = !storage.get("musicMuted", false);
    toggleRow("🎵 MUSIC", musicOn, () => storage.set("musicMuted", musicOn));
    const hapticsOn = !storage.get("hapticsOff", false);
    toggleRow("📳 HAPTICS", hapticsOn, () => {
      storage.set("hapticsOff", hapticsOn);
      haptics.setEnabled(!hapticsOn);
    });

    const providers = loginProviders();
    if (providers.length > 0) {
      const name = accountName();
      if (name !== "") {
        row(
          `👤 ${name.split(" ")[0]!.slice(0, 12).toUpperCase()} — SIGN OUT`,
          { text: "#7ee0a3", background: "#12281a" },
          () => void this.accountSignOut(overlay),
        );
      } else {
        // One provider today → straight to its popup (must stay inside the
        // tap gesture); a chooser gets added with the second provider.
        row(
          `👤 SIGN IN WITH ${providers[0]!.label.toUpperCase()}`,
          { text: "#80deea", background: "#12262b" },
          () => void this.accountSignIn(providers[0]!.id),
        );
      }
    }

    if (godModeAvailable()) {
      const on = storage.get("godMode", false);
      row(
        on ? "⚡ GOD MODE: ON" : "⚡ GOD MODE: OFF",
        on
          ? { text: "#ffd54f", background: "#3a2f10" }
          : { text: "#5c667d", background: "#181d2b" },
        () => {
          storage.set("godMode", !on);
          this.scene.restart(); // re-reads progress → selection re-clamps
        },
      );
    }
  }

  private async accountSignIn(providerId: AuthProviderId): Promise<void> {
    try {
      const user = await logIn(providerId);
      if (user !== null) this.scene.restart(); // re-renders + shows merged progress
    } catch {
      window.alert("Sign-in failed — check your connection and try again.");
    }
  }

  private async accountSignOut(overlay: Phaser.GameObjects.Container): Promise<void> {
    const msg = `Signed in as ${accountName()}.\nSign out? Your progress stays saved to the account.`;
    if (!window.confirm(msg)) return;
    overlay.destroy();
    await logOut();
    this.scene.restart();
  }

  /** Highest selectable level: real progress, or everything in god mode. */
  private unlockedLevel(): number {
    return godModeOn() ? GOD_MODE_MAX_LEVEL : storage.get("unlockedLevel", 1);
  }

  create(): void {
    const { width, height } = this.scale;
    const unlocked = this.unlockedLevel();
    this.selected = Math.min(storage.get("lastPlayed", 1), unlocked);

    // Attract-mode backdrop: the selected level's world, with a demo cube
    // running along the bottom. Rebuilt whenever the selected world changes.
    this.attract = null;
    this.attractWorldId = "";
    this.buildAttract();
    sfx.setMuted(storage.get("sfxMuted", false));

    // Cloud save: one background sync per session; if the account's remote
    // save improved local progress, rebuild so unlocks/selection update.
    void sessionSync().then((changed) => {
      if (changed.length > 0 && this.scene.isActive("menu")) this.scene.restart();
    });

    // Top chrome: one uniform icon row (guide / trophies / stats /
    // leaderboard) plus a single ⚙ that gathers every toggle — SFX, music,
    // haptics, account, dev god mode — into the settings overlay.
    const topButtons: ReadonlyArray<[string, () => void]> = [
      ["📖", () => this.openEncyclopedia()],
      ["🏆", () => this.openTrophies()],
      ["📊", () => this.openStats()],
      ["🏅", () => this.openLeaderboard()],
    ];
    topButtons.forEach(([icon, onTap], i) => {
      textButton(this, 70 + i * 94, 56, icon, { text: "#8a93a8", background: "#181d2b" }, onTap, "26px");
    });
    textButton(
      this,
      width - 70,
      56,
      "⚙",
      { text: "#8a93a8", background: "#181d2b" },
      () => this.openSettings(),
      "26px",
    );

    this.add
      .text(width / 2, height * 0.2, "DASH THE\nCUBE", {
        fontFamily: "Arial Black, sans-serif",
        fontSize: "110px",
        color: "#ffffff",
        align: "center",
        stroke: "#26c6da",
        strokeThickness: 10,
      })
      .setOrigin(0.5)
      .setLetterSpacing(6)
      .setShadow(0, 10, "#000000", 12, false, true);

    this.levelWord = this.add
      .text(width / 2, height * 0.395, "LEVEL", {
        fontFamily: "Arial, sans-serif",
        fontSize: "34px",
        color: "#8a93a8",
      })
      .setOrigin(0.5)
      .setShadow(0, 4, "#000000", 6, false, true);
    this.levelLabel = this.add
      .text(width / 2, height * 0.455, "", {
        fontFamily: "Arial Black, sans-serif",
        fontSize: "72px",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setShadow(0, 6, "#000000", 8, false, true);
    // Tapping the number opens the direct level-select grid.
    this.levelLabel.setInteractive({ useHandCursor: true });
    this.levelLabel.on("pointerdown", () => this.openLevelGrid());
    textButton(
      this,
      width / 2 + 310,
      height * 0.455,
      "⊞",
      { text: "#8a93a8", background: "#232b3e" },
      () => this.openLevelGrid(),
      "36px",
    );

    this.levelInfo = this.add
      .text(width / 2, height * 0.52, "", {
        fontFamily: "Arial, sans-serif",
        fontSize: "36px",
        color: "#8a93a8",
      })
      .setOrigin(0.5);

    this.lockHint = this.add
      .text(width / 2, height * 0.585, "", {
        fontFamily: "Arial, sans-serif",
        fontSize: "30px",
        color: "#5c667d",
      })
      .setOrigin(0.5);

    textButton(this, width / 2 - 220, height * 0.455, "◀", { text: "#ffffff", background: "#232b3e" }, () => {
      this.selected = Math.max(1, this.selected - 1);
      this.refresh();
    });
    textButton(this, width / 2 + 220, height * 0.455, "▶", { text: "#ffffff", background: "#232b3e" }, () => {
      this.selected = Math.min(this.unlockedLevel(), this.selected + 1);
      this.refresh();
    });

    textButton(
      this,
      width / 2,
      height * 0.68,
      "▶  PLAY",
      { text: "#a5d6a7", background: "#1e3320" },
      () => {
        storage.set("lastPlayed", this.selected);
        this.scene.start("game", { level: this.selected });
      },
      "60px",
    );

    // Character picker
    this.add
      .text(width / 2, height * 0.78, "CHARACTER", {
        fontFamily: "Arial, sans-serif",
        fontSize: "28px",
        color: "#5c667d",
      })
      .setOrigin(0.5);
    this.charName = this.add
      .text(width / 2, height * 0.915, "", {
        fontFamily: "Arial, sans-serif",
        fontSize: "32px",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    const savedId = storage.get("character", "dash");
    this.charIndex = Math.max(0, CHARACTERS.findIndex((c) => c.id === savedId));
    textButton(this, width / 2 - 160, height * 0.85, "◀", { text: "#ffffff", background: "#232b3e" }, () => {
      this.charIndex = (this.charIndex + CHARACTERS.length - 1) % CHARACTERS.length;
      this.refreshCharacter();
    }, "40px");
    textButton(this, width / 2 + 160, height * 0.85, "▶", { text: "#ffffff", background: "#232b3e" }, () => {
      this.charIndex = (this.charIndex + 1) % CHARACTERS.length;
      this.refreshCharacter();
    }, "40px");

    this.refresh();
    this.refreshCharacter();
  }

  private refreshCharacter(): void {
    const { width, height } = this.scale;
    const spec = CHARACTERS[this.charIndex]!;
    const unlocked = isCharacterUnlocked(spec, storage.get("unlockedLevel", 1));

    this.charPreview?.destroy();
    this.charPreview = this.add
      .container(width / 2, height * 0.85, buildCharacterParts(this, spec, 60))
      .setAlpha(unlocked ? 1 : 0.35);
    attachAura(this, this.charPreview, spec, 60);

    const hex = `#${spec.color.toString(16).padStart(6, "0")}`;
    if (unlocked) {
      this.charName.setText(spec.name).setColor(hex);
      // Browsing an unlocked character selects it immediately.
      storage.set("character", spec.id);
      this.buildAttract(); // demo runner wears the newly picked skin
    } else {
      this.charName
        .setText(`🔒 ${spec.name} — clear level ${spec.minLevel - 1}`)
        .setColor("#5c667d");
    }
  }

  /** Overlay grid to jump straight to any unlocked level. */
  private openLevelGrid(): void {
    const { width, height } = this.scale;
    const unlocked = this.unlockedLevel();
    const total = godModeOn() ? unlocked : unlocked + 4; // peek a few locked levels ahead
    const perPage = 20; // 5 x 4 tiles
    const pages = Math.ceil(total / perPage);
    let page = Math.min(Math.floor((this.selected - 1) / perPage), pages - 1);

    const overlay = this.add.container(0, 0).setDepth(100);
    overlay.add(
      this.add.rectangle(0, 0, width, height, 0x0b0e18, 0.95).setOrigin(0).setInteractive(),
    );
    overlay.add(
      this.add
        .text(width / 2, 150, "SELECT LEVEL", {
          fontFamily: "Arial Black, sans-serif",
          fontSize: "52px",
          color: "#ffffff",
        })
        .setOrigin(0.5)
        .setShadow(0, 6, "#000000", 8, false, true),
    );
    const tiles = this.add.container(0, 0);
    overlay.add(tiles);
    const pageText = this.add
      .text(width / 2, height - 165, "", {
        fontFamily: "Arial, sans-serif",
        fontSize: "30px",
        color: "#8a93a8",
      })
      .setOrigin(0.5);
    overlay.add(pageText);

    const renderPage = (): void => {
      tiles.removeAll(true);
      const start = page * perPage;
      for (let i = 0; i < perPage; i++) {
        const lvl = start + i + 1;
        if (lvl > total) break;
        const x = width / 2 - 248 + (i % 5) * 124;
        const y = 330 + Math.floor(i / 5) * 130;
        const isUnlocked = lvl <= unlocked;
        const best = storage.get(`bestPct:${lvl}`, 0);
        const tile = this.add
          .rectangle(x, y, 110, 110, isUnlocked ? 0x1b2233 : 0x141824)
          .setStrokeStyle(3, isUnlocked ? levelColor(lvl) : 0x2a3040);
        const label = this.add
          .text(x, y - 8, isUnlocked ? String(lvl) : "🔒", {
            fontFamily: "Arial Black, sans-serif",
            fontSize: "40px",
            color: isUnlocked ? "#ffffff" : "#5c667d",
          })
          .setOrigin(0.5);
        tiles.add(tile);
        tiles.add(label);
        if (isUnlocked && best > 0) {
          tiles.add(
            this.add
              .text(x, y + 34, best >= 100 ? "✓" : `${best}%`, {
                fontFamily: "Arial, sans-serif",
                fontSize: "24px",
                color: best >= 100 ? "#a5d6a7" : "#8a93a8",
              })
              .setOrigin(0.5),
          );
        }
        if (isUnlocked) {
          tile.setInteractive({ useHandCursor: true });
          tile.on("pointerdown", () => {
            this.selected = lvl;
            this.refresh();
            overlay.destroy();
          });
        }
      }
      pageText.setText(pages > 1 ? `page ${page + 1} / ${pages}` : "");
    };

    if (pages > 1) {
      overlay.add(
        textButton(this, width / 2 - 150, height - 165, "◀", { text: "#ffffff", background: "#232b3e" }, () => {
          page = Math.max(0, page - 1);
          renderPage();
        }, "32px"),
      );
      overlay.add(
        textButton(this, width / 2 + 150, height - 165, "▶", { text: "#ffffff", background: "#232b3e" }, () => {
          page = Math.min(pages - 1, page + 1);
          renderPage();
        }, "32px"),
      );
    }
    overlay.add(
      textButton(
        this,
        width / 2,
        height - 80,
        "✕  CLOSE",
        { text: "#ef9a9a", background: "#331e1e" },
        () => overlay.destroy(),
        "34px",
      ),
    );
    renderPage();
  }

  /**
   * All guide rows — hazards, power-ups, boosters, gates — in unlock order
   * per category, each with its live-art preview builder. Entries beyond the
   * player's progress render as "???" teasers (god mode reveals everything).
   */
  private guideEntries(): Array<{
    category: GuideCategory;
    name: string;
    blurb: string;
    tag: string;
    lockText: string;
    unlockLevel: number;
    w: number;
    h: number;
    color: string;
    build: () => Phaser.GameObjects.Container;
  }> {
    const hexOf = (c: number): string => `#${c.toString(16).padStart(6, "0")}`;
    const entries: ReturnType<MenuScene["guideEntries"]> = [];
    // Hazards, in unlock order.
    for (const [kind, lvl] of (Object.entries(KIND_UNLOCK_LEVEL) as Array<[ObstacleKind, number]>).sort(
      (a, b) => a[1] - b[1],
    )) {
      const worldN = Math.floor((lvl - 1) / LEVELS_PER_WORLD) + 1;
      const spec = OBSTACLE_PREVIEW[kind];
      entries.push({
        category: "hazards",
        ...OBSTACLE_INFO[kind],
        tag: `world ${worldN}`,
        lockText: `Reach world ${worldN} to identify this hazard.`,
        unlockLevel: lvl,
        w: spec.w,
        h: kind === "pit" ? spec.h + 150 : spec.h, // trench digs down
        color: hexOf(levelColor(lvl)),
        build: () => buildObstaclePreview(this, kind),
      });
    }
    // Power-up pickups.
    for (const [kind, lvl] of Object.entries(POWERUP_UNLOCK_LEVEL) as Array<[PowerUpKind, number]>) {
      entries.push({
        category: "powerups",
        ...POWERUP_INFO[kind],
        tag: `level ${lvl}`,
        lockText: `Reach level ${lvl} to unlock this pickup.`,
        unlockLevel: lvl,
        w: 56,
        h: 56,
        color: hexOf(POWER_UPS[kind].color),
        build: () => this.add.container(0, 0, [buildPickupView(this, kind).setPosition(28, 28)]),
      });
    }
    // Launch pads and dash strips.
    const boostUnlocks: Array<[BoostKind, number]> = [["pad", PAD_MIN_LEVEL], ["strip", STRIP_MIN_LEVEL]];
    for (const [kind, lvl] of boostUnlocks) {
      const { w, h } = BOOST_PREVIEW[kind];
      entries.push({
        category: "boosters",
        ...BOOST_INFO[kind],
        tag: `level ${lvl}`,
        lockText: `Reach level ${lvl} to meet this booster.`,
        unlockLevel: lvl,
        w,
        h,
        color: kind === "pad" ? "#ffb300" : "#00e5ff",
        build: () => buildBoostView(this, kind),
      });
    }
    // Mirror / gravity gates.
    const zoneUnlocks: Array<[TrackZoneKind, number]> = [["mirror", MIRROR_MIN_LEVEL], ["flip", FLIP_MIN_LEVEL]];
    for (const [kind, lvl] of zoneUnlocks) {
      entries.push({
        category: "gates",
        ...ZONE_INFO[kind],
        tag: `level ${lvl}`,
        lockText: `Reach level ${lvl} to pass through one.`,
        unlockLevel: lvl,
        w: ZONE_GATE_SIZE.w,
        h: ZONE_GATE_SIZE.h,
        color: hexOf(ZONE_COLORS[kind]),
        build: () => buildZoneGateView(this, kind),
      });
    }
    return entries;
  }

  private openEncyclopedia(): void {
    const { width, height } = this.scale;
    const unlocked = this.unlockedLevel();
    const all = this.guideEntries();
    const perPage = 5;
    let category: GuideCategory = "hazards";
    let page = 0;
    const current = (): typeof all => all.filter((e) => e.category === category);
    const pages = (): number => Math.max(1, Math.ceil(current().length / perPage));

    const overlay = this.add.container(0, 0).setDepth(100);
    overlay.add(
      this.add.rectangle(0, 0, width, height, 0x0b0e18, 0.95).setOrigin(0).setInteractive(),
    );
    overlay.add(
      this.add
        .text(width / 2, 130, "GUIDE", {
          fontFamily: "Arial Black, sans-serif",
          fontSize: "52px",
          color: "#ffffff",
        })
        .setOrigin(0.5)
        .setShadow(0, 6, "#000000", 8, false, true),
    );

    // Clickable category tabs — rebuilt on switch so the active one lights up.
    const tabs = this.add.container(0, 0);
    overlay.add(tabs);
    const renderTabs = (): void => {
      tabs.removeAll(true);
      for (const cat of GUIDE_CATEGORIES) {
        const active = cat.id === category;
        tabs.add(
          textButton(
            this,
            cat.x,
            222,
            cat.label,
            active
              ? { text: "#12141c", background: "#8a93a8" }
              : { text: "#8a93a8", background: "#181d2b" },
            () => {
              if (category === cat.id) return;
              category = cat.id;
              page = 0;
              renderTabs();
              renderPage();
            },
            "22px",
          ),
        );
      }
    };
    const rows = this.add.container(0, 0);
    overlay.add(rows);
    const pageText = this.add
      .text(width / 2, height - 165, "", {
        fontFamily: "Arial, sans-serif",
        fontSize: "30px",
        color: "#8a93a8",
      })
      .setOrigin(0.5);
    overlay.add(pageText);

    const renderPage = (): void => {
      rows.removeAll(true);
      current().slice(page * perPage, (page + 1) * perPage).forEach((e, i) => {
        const y = 340 + i * 168;
        const isKnown = e.unlockLevel <= unlocked;

        rows.add(
          this.add
            .rectangle(width / 2, y, 660, 156, 0x161b29)
            .setStrokeStyle(2, isKnown ? 0x2a3350 : 0x1c2233),
        );

        // Live-art preview, scaled to fit the left column of the card.
        const scale = Math.min(1, 116 / e.h, 150 / e.w);
        const pv = e
          .build()
          .setScale(scale)
          .setPosition(130 - (e.w * scale) / 2, y - (e.h * scale) / 2);
        if (!isKnown) pv.setAlpha(0.15);
        rows.add(pv);

        rows.add(
          this.add
            .text(240, y - 56, isKnown ? e.name : "???", {
              fontFamily: "Arial Black, sans-serif",
              fontSize: "32px",
              color: isKnown ? e.color : "#5c667d",
            })
            .setOrigin(0, 0.5),
        );
        rows.add(
          this.add
            .text(668, y - 56, e.tag, {
              fontFamily: "Arial, sans-serif",
              fontSize: "24px",
              color: "#5c667d",
            })
            .setOrigin(1, 0.5),
        );
        rows.add(
          this.add.text(240, y - 34, isKnown ? e.blurb : e.lockText, {
            fontFamily: "Arial, sans-serif",
            fontSize: "23px",
            color: isKnown ? "#aab3c7" : "#5c667d",
            wordWrap: { width: 428 },
            lineSpacing: 4,
          }),
        );
      });
      pageText.setText(pages() > 1 ? `page ${page + 1} / ${pages()}` : "");
    };

    overlay.add(
      textButton(this, width / 2 - 150, height - 165, "◀", { text: "#ffffff", background: "#232b3e" }, () => {
        page = Math.max(0, page - 1);
        renderPage();
      }, "32px"),
    );
    overlay.add(
      textButton(this, width / 2 + 150, height - 165, "▶", { text: "#ffffff", background: "#232b3e" }, () => {
        page = Math.min(pages() - 1, page + 1);
        renderPage();
      }, "32px"),
    );
    overlay.add(
      textButton(
        this,
        width / 2,
        height - 80,
        "✕  CLOSE",
        { text: "#ef9a9a", background: "#331e1e" },
        () => overlay.destroy(),
        "34px",
      ),
    );
    renderTabs();
    renderPage();
  }

  /** World-themed backdrop with a slow parallax skyline and a demo runner. */
  private buildAttract(): void {
    const { width, height } = this.scale;
    const world = worldForLevel(this.selected);
    this.attractWorldId = world.id;
    this.attract?.destroy();
    const c = this.add.container(0, 0).setDepth(-10);
    this.attract = c;
    ensureWorldTextures(this, world);

    const sky = this.add.graphics();
    sky.fillGradientStyle(world.skyTop, world.skyTop, world.skyBottomA, world.skyBottomB, 1);
    sky.fillRect(0, 0, width, height);
    const stars = this.add.graphics();
    for (let i = 0; i < 42; i++) {
      // Cheap deterministic scatter — no rng needed for set dressing.
      const sx = (i * 131 + 37) % width;
      const sy = (i * 337 + 91) % height;
      stars.fillStyle(0xffffff, 0.05 + ((i * 53) % 20) / 200);
      stars.fillRect(sx, sy, 2 + (i % 2), 2 + (i % 2));
    }
    c.add([sky, stars]);

    const sil = this.add
      .tileSprite(0, height - 346, width, 320, `sil-${world.id}`)
      .setOrigin(0)
      .setAlpha(0.3);
    c.add(sil);
    this.tweens.add({ targets: sil, tilePositionX: 400, duration: 18000, repeat: -1 });
    const haze = this.add.graphics();
    haze.fillGradientStyle(world.haze, world.haze, world.haze, world.haze, 0, 0, 0.4, 0.4);
    haze.fillRect(0, height - 346, width, 320);
    c.add(haze);

    // Demo runner hopping along the very bottom edge.
    const groundY = height - 26;
    c.add(this.add.rectangle(0, groundY, width, 26, world.groundBase).setOrigin(0));
    c.add(
      this.add.rectangle(0, groundY - 3, width, 3, levelColor(this.selected)).setOrigin(0).setAlpha(0.6),
    );
    const spec = characterById(storage.get("character", "dash"));
    const cube = this.add.container(width * 0.22, groundY - 22, buildCharacterParts(this, spec, 44));
    cube.setScale(0.85);
    // Demo runner previews the skin's signature trail too.
    const trail = buildCharacterTrail(this, cube, spec, 0.7, 220);
    trail.emitting = true;
    c.add(trail);
    c.add(cube);
    this.tweens.add({
      targets: cube,
      y: groundY - 140,
      duration: 380,
      yoyo: true,
      repeat: -1,
      ease: "Quad.easeOut",
      delay: 400,
      repeatDelay: 950,
    });
    this.tweens.add({
      targets: cube,
      angle: 360,
      duration: 760,
      repeat: -1,
      delay: 400,
      repeatDelay: 950,
    });
  }

  /** Full-screen overlay scaffold shared by the trophy and stats pages. */
  private buildOverlay(title: string): Phaser.GameObjects.Container {
    const { width, height } = this.scale;
    const overlay = this.add.container(0, 0).setDepth(100);
    overlay.add(
      this.add.rectangle(0, 0, width, height, 0x0b0e18, 0.95).setOrigin(0).setInteractive(),
    );
    overlay.add(
      this.add
        .text(width / 2, 150, title, {
          fontFamily: "Arial Black, sans-serif",
          fontSize: "52px",
          color: "#ffffff",
        })
        .setOrigin(0.5)
        .setShadow(0, 6, "#000000", 8, false, true),
    );
    overlay.add(
      textButton(
        this,
        width / 2,
        height - 80,
        "✕  CLOSE",
        { text: "#ef9a9a", background: "#331e1e" },
        () => overlay.destroy(),
        "34px",
      ),
    );
    return overlay;
  }

  /**
   * 🏅 Leaderboards: LEVEL tab (fastest clears per level, with a ◀ n ▶
   * selector) and OVERALL tab (highest level reached, ties by total time).
   * All loads are async with stale-guarding; when Firebase isn't configured
   * the overlay degrades to a friendly notice.
   */
  private openLeaderboard(): void {
    const { width } = this.scale;
    const overlay = this.buildOverlay("LEADERBOARD");
    const lb = leaderboard();
    void lb.syncDirty();

    // Player identity row.
    const nameText = this.add
      .text(width / 2 - 40, 205, lb.getName(), {
        fontFamily: "Arial Black, sans-serif",
        fontSize: "30px",
        color: "#80deea",
      })
      .setOrigin(0.5);
    overlay.add(nameText);
    overlay.add(
      textButton(
        this,
        width / 2 + 170,
        205,
        "✏",
        { text: "#8a93a8", background: "#181d2b" },
        () => {
          const entered = window.prompt("Leaderboard name (3-20 characters):", lb.getName());
          if (entered && validName(entered)) {
            void lb.setName(entered);
            nameText.setText(entered.trim());
          }
        },
        "22px",
      ),
    );

    let tab: "level" | "overall" = "level";
    let level = this.selected;
    let loadToken = 0;
    const tabs = this.add.container(0, 0);
    const body = this.add.container(0, 0);
    const status = this.add
      .text(width / 2, 620, "", {
        fontFamily: "Arial, sans-serif",
        fontSize: "30px",
        color: "#8a93a8",
      })
      .setOrigin(0.5);
    overlay.add([tabs, body, status]);

    const renderTabs = (): void => {
      tabs.removeAll(true);
      for (const [id, label, x] of [["level", "LEVEL", width / 2 - 150], ["overall", "OVERALL", width / 2 + 150]] as const) {
        const active = tab === id;
        tabs.add(
          textButton(
            this,
            x,
            278,
            label,
            active
              ? { text: "#12141c", background: "#8a93a8" }
              : { text: "#8a93a8", background: "#181d2b" },
            () => {
              if (tab === id) return;
              tab = id;
              renderTabs();
              void render();
            },
            "26px",
          ),
        );
      }
    };

    const rowStyle = (own: boolean): Phaser.Types.GameObjects.Text.TextStyle => ({
      fontFamily: own ? "Arial Black, sans-serif" : "Arial, sans-serif",
      fontSize: "28px",
      color: own ? "#80deea" : "#c6cede",
    });

    const render = async (): Promise<void> => {
      const token = ++loadToken;
      body.removeAll(true);
      if (!lb.ready) {
        status.setText("Leaderboard not configured yet");
        return;
      }
      status.setText("connecting…");

      if (tab === "level") {
        // Level selector row (part of the body so it clears on tab switch).
        const label = this.add
          .text(width / 2, 350, `LEVEL ${level}`, {
            fontFamily: "Arial Black, sans-serif",
            fontSize: "34px",
            color: `#${levelColor(level).toString(16).padStart(6, "0")}`,
          })
          .setOrigin(0.5);
        body.add(label);
        body.add(
          textButton(this, width / 2 - 190, 350, "◀", { text: "#ffffff", background: "#232b3e" }, () => {
            level = Math.max(1, level - 1);
            void render();
          }, "24px"),
        );
        body.add(
          textButton(this, width / 2 + 190, 350, "▶", { text: "#ffffff", background: "#232b3e" }, () => {
            level = Math.min(100, level + 1);
            void render();
          }, "24px"),
        );
      }

      try {
        if (tab === "level") {
          const entries = await lb.topLevel(level, 12);
          if (token !== loadToken || !overlay.active) return;
          status.setText(entries.length === 0 ? "no times yet — set one!" : "");
          entries.forEach((e, i) => {
            const own = e.uid === lb.myUid();
            const y = 420 + i * 52;
            body.add(this.add.text(120, y, `${i + 1}.`, rowStyle(own)).setOrigin(0, 0.5));
            body.add(
              this.add.text(185, y, own ? `${e.name} — you` : e.name, rowStyle(own)).setOrigin(0, 0.5),
            );
            body.add(this.add.text(width - 110, y, formatTimeMs(e.timeMs), rowStyle(own)).setOrigin(1, 0.5));
          });
        } else {
          const entries = await lb.topOverall(12);
          if (token !== loadToken || !overlay.active) return;
          status.setText(entries.length === 0 ? "no runs yet — be the first!" : "");
          entries.forEach((e, i) => {
            const own = e.uid === lb.myUid();
            const y = 370 + i * 52;
            body.add(this.add.text(100, y, `${i + 1}.`, rowStyle(own)).setOrigin(0, 0.5));
            body.add(
              this.add.text(165, y, own ? `${e.name} — you` : e.name, rowStyle(own)).setOrigin(0, 0.5),
            );
            body.add(this.add.text(width - 250, y, `L${e.highestLevel}`, rowStyle(own)).setOrigin(1, 0.5));
            body.add(
              this.add.text(width - 100, y, formatTimeMs(e.totalTimeMs), rowStyle(own)).setOrigin(1, 0.5),
            );
          });
        }
      } catch {
        if (token !== loadToken || !overlay.active) return;
        status.setText("offline — try again later");
      }
    };

    renderTabs();
    void render();
  }

  private openTrophies(): void {
    const { width } = this.scale;
    const overlay = this.buildOverlay("TROPHIES");
    const earnedCount = ACHIEVEMENTS.filter((a) => isEarned(storage, a.id)).length;
    overlay.add(
      this.add
        .text(width / 2, 210, `${earnedCount} / ${ACHIEVEMENTS.length} earned`, {
          fontFamily: "Arial, sans-serif",
          fontSize: "28px",
          color: "#8a93a8",
        })
        .setOrigin(0.5),
    );
    ACHIEVEMENTS.forEach((a, i) => {
      const y = 300 + i * 66;
      const earned = isEarned(storage, a.id);
      overlay.add(
        this.add
          .text(90, y, earned ? "🏆" : "🔒", { fontSize: "30px" })
          .setOrigin(0.5),
      );
      overlay.add(
        this.add.text(130, y - 16, a.name, {
          fontFamily: "Arial Black, sans-serif",
          fontSize: "26px",
          color: earned ? "#ffd54f" : "#5c667d",
        }),
      );
      overlay.add(
        this.add.text(130, y + 12, a.desc, {
          fontFamily: "Arial, sans-serif",
          fontSize: "21px",
          color: earned ? "#aab3c7" : "#4a5266",
        }),
      );
    });
  }

  private openStats(): void {
    const { width } = this.scale;
    const overlay = this.buildOverlay("STATS");
    const playMs = storage.get("totalPlayMs", 0);
    const hours = Math.floor(playMs / 3_600_000);
    const mins = Math.floor((playMs % 3_600_000) / 60_000);
    let cleared = 0;
    for (let lvl = 1; lvl <= 100; lvl++) {
      if (storage.get(`bestPct:${lvl}`, 0) >= 100) cleared++;
    }
    const rows: Array<[string, string]> = [
      ["Levels cleared", `${cleared}`],
      ["Total attempts", `${storage.get("totalAttempts", 0)}`],
      ["Total crashes", `${storage.get("totalDeaths", 0)}`],
      ["Distance run", `${storage.get("totalMeters", 0).toLocaleString()}m`],
      ["Near-misses", `${storage.get("nearMisses", 0)}`],
      ["Play time", `${hours}h ${mins}m`],
      ["Trophies", `${ACHIEVEMENTS.filter((a) => isEarned(storage, a.id)).length} / ${ACHIEVEMENTS.length}`],
    ];
    rows.forEach(([label, value], i) => {
      const y = 330 + i * 92;
      overlay.add(
        this.add.text(110, y, label, {
          fontFamily: "Arial, sans-serif",
          fontSize: "34px",
          color: "#8a93a8",
        }).setOrigin(0, 0.5),
      );
      overlay.add(
        this.add.text(width - 110, y, value, {
          fontFamily: "Arial Black, sans-serif",
          fontSize: "36px",
          color: "#ffffff",
        }).setOrigin(1, 0.5),
      );
    });
  }

  private refresh(): void {
    const unlocked = this.unlockedLevel();
    // Backdrop follows the selected level's world.
    if (worldForLevel(this.selected).id !== this.attractWorldId) this.buildAttract();
    const hex = `#${levelColor(this.selected).toString(16).padStart(6, "0")}`;
    this.levelWord.setColor(hex);
    this.levelLabel.setText(`${this.selected}`).setColor(hex);

    const best = storage.get(`bestPct:${this.selected}`, 0);
    const cleared = best >= 100;
    this.levelInfo.setText(
      `${worldForLevel(this.selected).name}  ·  ${levelDurationSec(this.selected)}s` +
        (isFinaleLevel(this.selected) ? "  ·  ★ FINALE" : "") +
        (best > 0 ? `  ·  ${cleared ? "✓ cleared" : `best ${best}%`}` : ""),
    );
    this.lockHint.setText(
      this.selected === unlocked && !cleared
        ? `clear this level to unlock level ${unlocked + 1}`
        : "",
    );
  }
}
