import Phaser from "phaser";

/** Pops a celebratory text banner over the scene, then floats it away. */
export function floatBanner(
  scene: Phaser.Scene,
  message: string,
  y: number,
  fontSize = "72px",
  color = "#ffd54f",
): void {
  const banner = scene.add
    .text(scene.scale.width / 2, y, message, {
      fontFamily: "Arial Black, sans-serif",
      fontSize,
      color,
      stroke: "#000000",
      strokeThickness: 8,
      align: "center",
    })
    .setOrigin(0.5)
    .setScale(0.3)
    .setDepth(50);
  banner.setShadow(0, 8, "#000000", 10, false, true);
  scene.tweens.add({
    targets: banner,
    scale: 1,
    duration: 250,
    ease: "Back.easeOut",
    onComplete: () => {
      scene.tweens.add({
        targets: banner,
        alpha: 0,
        y: banner.y - 80,
        delay: 600,
        duration: 400,
        onComplete: () => banner.destroy(),
      });
    },
  });
}
