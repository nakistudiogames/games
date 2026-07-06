import Phaser from "phaser";
import type { ObstacleKind } from "./logic/runner";

/**
 * Obstacle drawing, shared by GameScene and the menu's obstacle
 * encyclopedia (same split as characters.ts / characterView.ts). Every
 * function draws into the given container with the obstacle's top-left at
 * (0, 0); animation tweens run on the passed scene's clock.
 */

type Scene = Phaser.Scene;
type Container = Phaser.GameObjects.Container;

/** Canonical size of each kind, as used by its intro pattern — the size the
 * encyclopedia previews. Pits also dig `depth` px below their h. */
export const OBSTACLE_PREVIEW: Record<ObstacleKind, { w: number; h: number }> = {
  spike: { w: 60, h: 60 },
  block: { w: 120, h: 60 },
  saw: { w: 90, h: 90 },
  pit: { w: 150, h: 24 },
  swing: { w: 54, h: 54 },
  laser: { w: 24, h: 130 },
  geyser: { w: 60, h: 110 },
  tentacle: { w: 30, h: 120 },
  arc: { w: 200, h: 50 },
};

/**
 * Draws any kind at (0,0)..(w,h) into `container`. Floating spikes render
 * as inverted air mines. Geysers stash their eruption column on the
 * container as data "column" so the caller can sync visibility to the
 * hitbox (GameScene) or force it on (encyclopedia).
 */
export function drawObstacle(
  scene: Scene,
  container: Container,
  kind: ObstacleKind,
  w: number,
  h: number,
  floating = false,
): void {
  switch (kind) {
    case "saw":
      drawSaw(scene, container, w);
      return;
    case "pit":
      drawPit(scene, container, w, h);
      return;
    case "swing":
      drawSwingMine(scene, container, w);
      return;
    case "laser":
      drawLaser(scene, container, w, h);
      return;
    case "geyser":
      container.setData("column", drawGeyser(scene, container, w, h));
      return;
    case "tentacle":
      drawTentacle(scene, container, w, h);
      return;
    case "arc":
      drawArc(scene, container, w, h);
      return;
    case "spike":
      if (floating) drawAirMine(scene, container, w, h);
      else drawSpike(scene, container, w, h);
      return;
    case "block":
      drawBlock(scene, container, w, h);
      return;
  }
}

/** Preview at canonical size for the encyclopedia (geyser column forced on). */
export function buildObstaclePreview(scene: Scene, kind: ObstacleKind): Container {
  const { w, h } = OBSTACLE_PREVIEW[kind];
  const container = scene.add.container(0, 0);
  drawObstacle(scene, container, kind, w, h, false);
  if (kind === "geyser") {
    (container.getData("column") as Container).setVisible(true);
  }
  return container;
}

/** Two-tone faces: lit left, shaded right — same light as the cube bevel. */
function drawSpike(scene: Scene, container: Container, w: number, h: number): void {
  const g = scene.add.graphics();
  // Receding right-back face: a TRIANGLE sharing the front apex — a pyramid
  // has exactly one apex, so the side face must meet it, not echo it.
  const d = 8;
  g.fillStyle(0x5c1512);
  g.fillTriangle(w / 2, 0, w + d, h - d, w, h);
  g.fillStyle(0xef5350);
  g.fillPoints([{ x: 0, y: h }, { x: w / 2, y: 0 }, { x: w / 2, y: h }], true);
  g.fillStyle(0x8e2320);
  g.fillPoints([{ x: w / 2, y: 0 }, { x: w, y: h }, { x: w / 2, y: h }], true);
  g.lineStyle(3, 0xff8a80, 0.9);
  g.strokePoints([{ x: 0, y: h }, { x: w / 2, y: 0 }, { x: w, y: h }], false);
  container.add(g);
}

/** Air mine: inverted spike hanging in the flight path. */
function drawAirMine(scene: Scene, container: Container, w: number, h: number): void {
  const g = scene.add.graphics();
  // Hanging pyramid: the square top base shows as a lit quad (that face is
  // flat, so extruding it is correct), while the receding right side is a
  // TRIANGLE meeting the single bottom apex.
  const d = 8;
  g.fillStyle(0xff8a80);
  g.fillPoints(
    [{ x: 0, y: 0 }, { x: d, y: -d }, { x: w + d, y: -d }, { x: w, y: 0 }],
    true,
  );
  g.fillStyle(0x5c1512);
  g.fillTriangle(w, 0, w + d, -d, w / 2, h);
  g.fillStyle(0xef5350);
  g.fillPoints([{ x: 0, y: 0 }, { x: w / 2, y: 0 }, { x: w / 2, y: h }], true);
  g.fillStyle(0x8e2320);
  g.fillPoints([{ x: w / 2, y: 0 }, { x: w, y: 0 }, { x: w / 2, y: h }], true);
  g.lineStyle(3, 0xff8a80, 0.9);
  g.strokePoints([{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w / 2, y: h }], true);
  container.add(g);
}

/** 2.5D box: shaded right face and lit top face extruded up-right. */
function drawBlock(scene: Scene, container: Container, w: number, h: number): void {
  const g = scene.add.graphics();
  const d = 14;
  g.fillStyle(0x252e6e);
  g.fillPoints(
    [{ x: w, y: 0 }, { x: w + d, y: -d }, { x: w + d, y: h - d }, { x: w, y: h }],
    true,
  );
  g.fillStyle(0x8d97dd);
  g.fillPoints(
    [{ x: 0, y: 0 }, { x: d, y: -d }, { x: w + d, y: -d }, { x: w, y: 0 }],
    true,
  );
  // Front face: vertical falloff (lit above, dim below) + contact shadow.
  g.fillGradientStyle(0x4d5fc9, 0x4d5fc9, 0x2c3786, 0x2c3786, 1);
  g.fillRect(0, 0, w, h);
  g.fillStyle(0x5262c4);
  g.fillRect(0, 0, w, 7);
  g.fillStyle(0x10153a, 0.45);
  g.fillRect(0, h - 6, w, 6);
  g.lineStyle(2, 0x171d45, 1);
  g.strokeRect(0, 0, w, h);
  container.add(g);
}

/** Spinning steel buzzsaw sitting on the ground (world 2+). */
function drawSaw(scene: Scene, container: Container, w: number): void {
  const r = w / 2;
  const g = scene.add.graphics();
  g.setPosition(r, r);
  // Teeth around the rim, then the disc over them.
  g.fillStyle(0x78909c, 1);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const b = a + 0.22;
    g.fillTriangle(
      Math.cos(a) * (r - 12), Math.sin(a) * (r - 12),
      Math.cos(b) * (r - 12), Math.sin(b) * (r - 12),
      Math.cos((a + b) / 2) * r, Math.sin((a + b) / 2) * r,
    );
  }
  g.fillStyle(0xb0bec5, 1);
  g.fillCircle(0, 0, r - 12);
  g.fillStyle(0x546e7a, 1);
  g.fillCircle(0, 0, r - 24);
  // Hub bolts read as rotation once it spins.
  g.fillStyle(0xcfd8dc, 1);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    g.fillCircle(Math.cos(a) * (r - 18), Math.sin(a) * (r - 18), 4);
  }
  g.fillCircle(0, 0, 7);
  // Metal glint: a bright arc + hot dot that flash as the disc spins.
  g.lineStyle(4, 0xeceff1, 0.7);
  g.beginPath();
  g.arc(0, 0, r - 17, Math.PI * 1.05, Math.PI * 1.5);
  g.strokePath();
  g.fillStyle(0xffffff, 0.6);
  g.fillCircle(-4, -4, 3);
  container.add(g);
  scene.tweens.add({ targets: g, angle: 360, duration: 700, repeat: -1 });
}

/** Lava trench cut into the ground — lethal to touch down in (world 3+). */
function drawPit(scene: Scene, container: Container, w: number, h: number, depth = 150): void {
  const g = scene.add.graphics();
  // Dark cut below the ground line (container top sits h above it).
  g.fillStyle(0x140a06, 1);
  g.fillRect(0, h, w, depth);
  // Molten pool near the surface, brightest at the top.
  g.fillStyle(0xbf360c, 1);
  g.fillRect(3, h + 4, w - 6, 30);
  g.fillStyle(0xff7043, 1);
  g.fillRect(3, h + 4, w - 6, 10);
  g.fillStyle(0xffab91, 0.9);
  g.fillRect(3, h + 4, w - 6, 3);
  // Inner walls: lit near lip, shaded far lip — the cut reads as a volume.
  g.fillStyle(0xffffff, 0.1);
  g.fillRect(3, h + 4, 5, 42);
  g.fillStyle(0x000000, 0.5);
  g.fillRect(w - 8, h + 4, 5, 42);
  // Charred lips so the edge reads against the ground tile.
  g.fillStyle(0x000000, 0.55);
  g.fillRect(-6, h, 9, 8);
  g.fillRect(w - 3, h, 9, 8);
  container.add(g);
  // Heat shimmer rising out of the trench.
  const glow = scene.add.rectangle(w / 2, h - 2, w - 10, 10, 0xff7043, 0.35);
  container.add(glow);
  scene.tweens.add({
    targets: glow,
    alpha: 0.1,
    scaleY: 1.8,
    duration: 520,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });
}

/** Bobbing spike mine — jump it when low, run under when high (world 4+). */
function drawSwingMine(scene: Scene, container: Container, w: number): void {
  const r = w / 2;
  const g = scene.add.graphics();
  g.setPosition(r, r);
  g.fillStyle(0xab47bc, 1);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.fillTriangle(
      Math.cos(a - 0.28) * (r - 10), Math.sin(a - 0.28) * (r - 10),
      Math.cos(a + 0.28) * (r - 10), Math.sin(a + 0.28) * (r - 10),
      Math.cos(a) * (r + 4), Math.sin(a) * (r + 4),
    );
  }
  // Lit-from-top-left body, matching the global light direction.
  g.fillStyle(0x8e24aa, 1);
  g.fillCircle(0, 0, r - 8);
  g.fillStyle(0xce93d8, 1);
  g.fillCircle(-4, -4, r - 15);
  g.fillStyle(0x4a148c, 1);
  g.fillCircle(2, 2, r - 21);
  // Specular point completes the sphere read.
  g.fillStyle(0xffffff, 0.55);
  g.fillCircle(-r * 0.3, -r * 0.3, 4);
  container.add(g);
  scene.tweens.add({ targets: g, angle: 360, duration: 2600, repeat: -1 });
  // Warning ring pulse — telegraphs "hazard" while it bobs.
  const ring = scene.add.circle(r, r, r + 8).setStrokeStyle(3, 0xce93d8, 0.5);
  container.add(ring);
  scene.tweens.add({
    targets: ring,
    scale: 1.25,
    alpha: 0.1,
    duration: 800,
    repeat: -1,
    ease: "Sine.easeOut",
  });
}

/** Thin, tall plasma pylon — a late, precise jump clears it (world 5+). */
function drawLaser(scene: Scene, container: Container, w: number, h: number): void {
  // Beam: green plasma with a white-hot core, pulsing.
  const beam = scene.add.graphics();
  beam.fillStyle(0x76ff03, 0.35);
  beam.fillRect(-4, 0, w + 8, h);
  beam.fillStyle(0x76ff03, 0.9);
  beam.fillRect(4, 0, w - 8, h);
  beam.fillStyle(0xf1ffdd, 1);
  beam.fillRect(w / 2 - 2, 0, 4, h);
  container.add(beam);
  scene.tweens.add({
    targets: beam,
    alpha: 0.55,
    duration: 220,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });
  // Emitter base and tip orb are steady — the hitbox never blinks.
  const g = scene.add.graphics();
  g.fillStyle(0x263238, 1);
  g.fillRect(-10, h - 12, w + 20, 12);
  g.fillStyle(0x455a64, 1);
  g.fillRect(-10, h - 12, w + 20, 4);
  // Shaded end cap on the base gives the emitter housing a third face.
  g.fillStyle(0x11181c, 1);
  g.fillRect(w + 5, h - 12, 5, 12);
  g.fillStyle(0xccff90, 1);
  g.fillCircle(w / 2, 2, 9);
  g.fillStyle(0xffffff, 0.8);
  g.fillCircle(w / 2 - 2, 0, 3);
  container.add(g);
}

/**
 * Temple flame vent: the column erupts on a fixed cycle (world 6+).
 * Returns the column so the caller controls its visibility.
 */
function drawGeyser(scene: Scene, container: Container, w: number, h: number): Container {
  // Erupting column — the caller keeps its visibility on the hitbox.
  const column = scene.add.container(0, 0);
  const cg = scene.add.graphics();
  cg.fillStyle(0xff7043, 0.4);
  cg.fillRect(-6, 0, w + 12, h);
  cg.fillStyle(0xffca28, 0.95);
  cg.fillRect(6, 0, w - 12, h);
  cg.fillStyle(0xfff3c4, 1);
  cg.fillRect(w / 2 - 5, 0, 10, h);
  column.add(cg);
  column.add(scene.add.circle(w / 2, 2, 12, 0xfff3c4, 0.9));
  container.add(column);
  // Flame flicker — alpha only, never below fully readable.
  scene.tweens.add({ targets: cg, alpha: 0.8, duration: 90, yoyo: true, repeat: -1 });
  // Carved stone rim: always visible, always harmless — this is the tell.
  const g = scene.add.graphics();
  g.fillStyle(0x33200a, 1);
  g.fillRect(-10, h - 10, w + 20, 10);
  g.fillStyle(0x5c3d14, 1);
  g.fillRect(-10, h - 10, w + 20, 4);
  // Shaded end + bottom lip: the rim reads as a carved stone block.
  g.fillStyle(0x1c1206, 1);
  g.fillRect(w + 5, h - 10, 5, 10);
  g.fillRect(-10, h - 2, w + 20, 2);
  g.fillStyle(0xffca28, 0.9);
  g.fillRect(4, h - 6, w - 8, 3); // ember glow in the slot
  container.add(g);
  return column;
}

/** Swaying abyssal stalk — the view follows the hitbox sway (world 7+). */
function drawTentacle(scene: Scene, container: Container, w: number, h: number): void {
  const g = scene.add.graphics();
  // Contact shadow anchors the stalk to the seabed.
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(w / 2, h - 2, w + 26, 10);
  // Tapered stalk: wide flared root, narrow tip.
  g.fillStyle(0x18304e, 1);
  g.fillTriangle(-8, h, w + 8, h, w / 2, 0);
  g.fillStyle(0x2a4a70, 1);
  g.fillTriangle(0, h, w * 0.7, h, w / 2, 8);
  // Rim light up the lit edge rounds the stalk.
  g.lineStyle(3, 0x90caf9, 0.35);
  g.lineBetween(w * 0.15, h - 4, w / 2 - 2, 10);
  // Sucker dots up the lit side.
  g.fillStyle(0x90caf9, 0.7);
  for (let i = 1; i <= 4; i++) g.fillCircle(w / 2 - 2, h - i * (h / 5), 3.5);
  container.add(g);
  // Luminous tip — the lure that telegraphs the hazard.
  const tip = scene.add.circle(w / 2, 6, 7, 0x90caf9, 0.9);
  container.add(tip);
  scene.tweens.add({
    targets: tip,
    alpha: 0.4,
    duration: 600,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });
}

/** Wide low tesla arc between twin pylons — always lethal (world 8+). */
function drawArc(scene: Scene, container: Container, w: number, h: number): void {
  const pw = 16;
  const g = scene.add.graphics();
  for (const px of [0, w - pw]) {
    // 2.5D pylon: shaded right face + lit top extruded up-right, mini-block
    // style, then the front face over the seam.
    const d = 6;
    g.fillStyle(0x161d21, 1);
    g.fillPoints(
      [{ x: px + pw, y: 0 }, { x: px + pw + d, y: -d }, { x: px + pw + d, y: h - d }, { x: px + pw, y: h }],
      true,
    );
    g.fillStyle(0x546e7a, 1);
    g.fillPoints(
      [{ x: px, y: 0 }, { x: px + d, y: -d }, { x: px + pw + d, y: -d }, { x: px + pw, y: 0 }],
      true,
    );
    g.fillStyle(0x263238, 1);
    g.fillRect(px, 0, pw, h);
    g.fillStyle(0x455a64, 1);
    g.fillRect(px, 0, pw, 4);
    g.fillStyle(0xea80fc, 1);
    g.fillCircle(px + pw / 2, 4, 6);
    g.fillStyle(0xffffff, 0.85);
    g.fillCircle(px + pw / 2 - 2, 2, 2.5);
  }
  container.add(g);
  // Jagged bolt with a white-hot core over a violet glow field. The
  // crackle is alpha-only — the whole span is always lethal.
  const bolt = scene.add.graphics();
  const midY = h * 0.45;
  bolt.fillStyle(0xea80fc, 0.25);
  bolt.fillRect(pw, 8, w - 2 * pw, h - 8);
  const seg = (w - 2 * pw) / 6;
  const pts = Array.from({ length: 7 }, (_, i) => ({
    x: pw + i * seg,
    y: midY + (i % 2 === 0 ? -8 : 8),
  }));
  bolt.lineStyle(7, 0xea80fc, 0.8);
  bolt.strokePoints(pts, false);
  bolt.lineStyle(3, 0xffffff, 1);
  bolt.strokePoints(pts, false);
  container.add(bolt);
  scene.tweens.add({ targets: bolt, alpha: 0.6, duration: 90, yoyo: true, repeat: -1 });
}
