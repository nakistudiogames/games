import Phaser from "phaser";
import { GameStorage } from "@mg/core";

export const storage = new GameStorage("merge-2048");

export class MenuScene extends Phaser.Scene {
  constructor() {
    super("menu");
  }

  create(): void {
    const { width, height } = this.scale;

    this.add
      .text(width / 2, height * 0.28, "MERGE\n2048", {
        fontFamily: "Arial Black, sans-serif",
        fontSize: "110px",
        color: "#ffffff",
        align: "center",
        stroke: "#f2b179",
        strokeThickness: 10,
      })
      .setOrigin(0.5);

    const highScore = storage.get("highScore", 0);
    if (highScore > 0) {
      this.add
        .text(width / 2, height * 0.48, `Best: ${highScore}`, {
          fontFamily: "Arial, sans-serif",
          fontSize: "44px",
          color: "#ffd54f",
        })
        .setOrigin(0.5);
    }

    const prompt = this.add
      .text(width / 2, height * 0.65, "TAP TO PLAY", {
        fontFamily: "Arial, sans-serif",
        fontSize: "52px",
        color: "#a5d6a7",
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: prompt,
      alpha: 0.35,
      duration: 700,
      yoyo: true,
      repeat: -1,
    });

    this.input.once("pointerdown", () => this.scene.start("game"));
  }
}
