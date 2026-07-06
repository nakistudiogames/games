import Phaser from "phaser";

/**
 * Extruded 3D text button: a rounded cap sitting on a darker base slab,
 * lit from the top. Pressing sinks the cap into the slab before the
 * handler-driven scene change, so taps read as physical.
 */
export function textButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  colors: { text: string; background: string },
  onClick: () => void,
  fontSize = "54px",
): Phaser.GameObjects.Container {
  const txt = scene.add
    .text(0, 0, label, {
      fontFamily: "Arial, sans-serif",
      fontSize,
      color: colors.text,
      // Rasterize at device resolution so labels stay crisp under Scale.FIT
      // on retina/mobile screens.
      resolution: Math.min(window.devicePixelRatio || 1, 3),
    })
    .setOrigin(0.5);
  txt.setShadow(0, 3, "#000000", 4, false, true);

  const w = txt.width + 60;
  const h = txt.height + 32;
  const depth = 8; // extrusion below the cap
  const radius = Math.min(16, h / 2 - 2);

  const base = Phaser.Display.Color.ValueToColor(colors.background);
  const faceTop = base.clone().brighten(14).color;
  const faceBottom = base.clone().darken(10).color;
  const slab = base.clone().darken(45).color;
  const rim = base.clone().brighten(30).color;

  // Base slab + contact shadow — stays put when the cap sinks.
  const under = scene.add.graphics();
  under.fillStyle(0x000000, 0.35);
  under.fillRoundedRect(-w / 2 + 3, -h / 2 + depth + 4, w - 6, h, radius);
  under.fillStyle(slab, 1);
  under.fillRoundedRect(-w / 2, -h / 2 + depth, w, h, radius);

  // Cap: gradient face, top rim light, hairline edge.
  const face = scene.add.graphics();
  face.fillGradientStyle(faceTop, faceTop, faceBottom, faceBottom, 1);
  face.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
  face.fillStyle(rim, 0.45);
  face.fillRoundedRect(-w / 2 + 5, -h / 2 + 3, w - 10, 5, 3);
  face.lineStyle(2, slab, 0.9);
  face.strokeRoundedRect(-w / 2, -h / 2, w, h, radius);

  const cap = scene.add.container(0, 0, [face, txt]);
  const btn = scene.add.container(x, y, [under, cap]);
  btn.setSize(w, h + depth);
  btn.setInteractive({ useHandCursor: true });
  btn.on("pointerdown", () => {
    // Physical press: the cap sinks into the slab — cosmetic only, the
    // handler fires immediately.
    scene.tweens.add({ targets: cap, y: depth - 2, duration: 55, yoyo: true, ease: "Sine.easeOut" });
    onClick();
  });
  return btn;
}
