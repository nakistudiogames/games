import Phaser from "phaser";
import { GameStorage } from "@mg/core";
import { textButton } from "@mg/ui";
import { levelColor, levelLengthM, levelSpeed } from "../logic/runner";

export const storage = new GameStorage("cube-dash");

export class MenuScene extends Phaser.Scene {
  private selected = 1;
  private levelLabel!: Phaser.GameObjects.Text;
  private levelInfo!: Phaser.GameObjects.Text;
  private lockHint!: Phaser.GameObjects.Text;

  constructor() {
    super("menu");
  }

  create(): void {
    const { width, height } = this.scale;
    const unlocked = storage.get("unlockedLevel", 1);
    this.selected = Math.min(storage.get("lastPlayed", 1), unlocked);

    this.add
      .text(width / 2, height * 0.2, "CUBE\nDASH", {
        fontFamily: "Arial Black, sans-serif",
        fontSize: "110px",
        color: "#ffffff",
        align: "center",
        stroke: "#26c6da",
        strokeThickness: 10,
      })
      .setOrigin(0.5)
      .setShadow(0, 10, "#000000", 12, false, true);

    this.levelLabel = this.add
      .text(width / 2, height * 0.44, "", {
        fontFamily: "Arial Black, sans-serif",
        fontSize: "72px",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setShadow(0, 6, "#000000", 8, false, true);

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

    textButton(this, width / 2 - 220, height * 0.44, "◀", { text: "#ffffff", background: "#232b3e" }, () => {
      this.selected = Math.max(1, this.selected - 1);
      this.refresh();
    });
    textButton(this, width / 2 + 220, height * 0.44, "▶", { text: "#ffffff", background: "#232b3e" }, () => {
      this.selected = Math.min(storage.get("unlockedLevel", 1), this.selected + 1);
      this.refresh();
    });

    textButton(
      this,
      width / 2,
      height * 0.7,
      "▶  PLAY",
      { text: "#a5d6a7", background: "#1e3320" },
      () => {
        storage.set("lastPlayed", this.selected);
        this.scene.start("game", { level: this.selected });
      },
      "60px",
    );

    this.refresh();
  }

  private refresh(): void {
    const unlocked = storage.get("unlockedLevel", 1);
    const hex = `#${levelColor(this.selected).toString(16).padStart(6, "0")}`;
    this.levelLabel.setText(`LEVEL ${this.selected}`).setColor(hex);

    const best = storage.get(`bestPct:${this.selected}`, 0);
    const cleared = best >= 100;
    this.levelInfo.setText(
      `${levelLengthM(this.selected)}m  ·  speed ${levelSpeed(this.selected)}` +
        (best > 0 ? `  ·  ${cleared ? "✓ cleared" : `best ${best}%`}` : ""),
    );
    this.lockHint.setText(
      this.selected === unlocked && !cleared
        ? `clear this level to unlock level ${unlocked + 1}`
        : "",
    );
  }
}
