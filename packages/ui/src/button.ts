import Phaser from "phaser";

/** Simple text button with background padding and a press handler. */
export function textButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  colors: { text: string; background: string },
  onClick: () => void,
  fontSize = "54px",
): Phaser.GameObjects.Text {
  const btn = scene.add
    .text(x, y, label, {
      fontFamily: "Arial, sans-serif",
      fontSize,
      color: colors.text,
      backgroundColor: colors.background,
      padding: { x: 30, y: 16 },
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true });
  btn.on("pointerdown", onClick);
  return btn;
}
