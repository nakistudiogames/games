import Phaser from "phaser";
import { GATE_GAP_HI, GATE_GAP_LO } from "./logic/runner";
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
  phantom: { w: 60, h: 110 },
  vine: { w: 54, h: 140 },
  gear: { w: 70, h: 70 },
  gate: { w: 24, h: 300 },
  crusher: { w: 90, h: 60 },
  urchin: { w: 80, h: 80 },
  talon: { w: 66, h: 120 },
  drone: { w: 60, h: 60 },
  obelisk: { w: 30, h: 150 },
  flare: { w: 210, h: 24 },
  comet: { w: 54, h: 60 },
  reaper: { w: 60, h: 90 },
  halo: { w: 70, h: 130 },
  wisp: { w: 56, h: 70 },
  lance: { w: 200, h: 26 },
  swarm: { w: 104, h: 96 },
  flux: { w: 110, h: 140 },
  pendul: { w: 60, h: 60 },
  rails: { w: 120, h: 145 },
  cyclone: { w: 70, h: 150 },
  specter: { w: 80, h: 130 },
  nova: { w: 64, h: 64 },
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
    case "phantom":
      drawPhantom(scene, container, w, h);
      return;
    case "vine":
      container.setData("stalk", drawVine(scene, container, w, h));
      return;
    case "gear":
      drawGear(scene, container, w);
      return;
    case "gate":
      drawGate(scene, container, w, h);
      return;
    case "crusher":
      drawCrusher(scene, container, w, h);
      return;
    case "urchin":
      drawUrchin(scene, container, w);
      return;
    case "talon":
      container.setData("blade", drawTalon(scene, container, w, h));
      return;
    case "drone":
      drawDrone(scene, container, w, h);
      return;
    case "obelisk":
      drawObelisk(scene, container, w, h);
      return;
    case "flare":
      drawFlare(scene, container, w, h);
      return;
    case "comet":
      drawComet(scene, container, w, h);
      return;
    case "reaper":
      container.setData("blade", drawReaper(scene, container, w, h));
      return;
    case "spike":
      if (floating) drawAirMine(scene, container, w, h);
      else drawSpike(scene, container, w, h);
      return;
    case "block":
      drawBlock(scene, container, w, h);
      return;
    case "halo":
      drawHalo(scene, container, w, h);
      return;
    case "wisp":
      drawWisp(scene, container, w, h);
      return;
    case "lance":
      drawLance(scene, container, w, h);
      return;
    case "swarm":
      drawSwarm(scene, container, w, h);
      return;
    case "flux":
      drawFlux(scene, container, w, h);
      return;
    case "pendul":
      drawPendul(scene, container, w);
      return;
    case "rails":
      drawRails(scene, container, w, h);
      return;
    case "cyclone":
      drawCyclone(scene, container, w, h);
      return;
    case "specter":
      drawSpecter(scene, container, w, h);
      return;
    case "nova":
      container.setData("satellite", drawNova(scene, container, w, h));
      return;
  }
}

/** Preview at canonical size for the encyclopedia (timed parts forced on). */
export function buildObstaclePreview(scene: Scene, kind: ObstacleKind): Container {
  const { w, h } = OBSTACLE_PREVIEW[kind];
  const container = scene.add.container(0, 0);
  drawObstacle(scene, container, kind, w, h, false);
  if (kind === "geyser") {
    (container.getData("column") as Container).setVisible(true);
  }
  if (kind === "talon" || kind === "reaper") {
    (container.getData("blade") as Container).setVisible(true);
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

/**
 * Phasing crystal (world 9+): the whole view's alpha tracks phantomSolid —
 * GameScene fades it between solid (lethal) and ghost.
 */
function drawPhantom(scene: Scene, container: Container, w: number, h: number): void {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(w / 2, h - 2, w + 16, 10);
  // Faceted shard: lit left face, shaded right, bright fracture seam.
  g.fillStyle(0x9fa8da, 1);
  g.fillPoints([{ x: w / 2, y: 0 }, { x: 0, y: h * 0.35 }, { x: w * 0.2, y: h }, { x: w / 2, y: h }], true);
  g.fillStyle(0x5c6bc0, 1);
  g.fillPoints([{ x: w / 2, y: 0 }, { x: w, y: h * 0.35 }, { x: w * 0.8, y: h }, { x: w / 2, y: h }], true);
  g.fillStyle(0x3949ab, 0.8);
  g.fillPoints([{ x: w * 0.2, y: h }, { x: w * 0.8, y: h }, { x: w / 2, y: h * 0.55 }], true);
  g.lineStyle(2, 0xe8eaf6, 0.9);
  g.lineBetween(w / 2, 2, w / 2, h * 0.55);
  g.fillStyle(0xffffff, 0.7);
  g.fillCircle(w * 0.36, h * 0.3, 3.5);
  container.add(g);
  // Inner glimmer pulses on the same rhythm family as the phasing.
  const core = scene.add.circle(w / 2, h * 0.45, 7, 0xc5cae9, 0.8);
  container.add(core);
  scene.tweens.add({ targets: core, alpha: 0.25, scale: 1.4, duration: 500, yoyo: true, repeat: -1 });
}

/**
 * Lashing vine (world 10+): returns the bottom-anchored stalk whose scaleY
 * GameScene drives with vineHeight — the lash visibly grows and shrinks.
 */
function drawVine(scene: Scene, container: Container, w: number, h: number): Container {
  const shade = scene.add.graphics();
  shade.fillStyle(0x000000, 0.3);
  shade.fillEllipse(w / 2, h - 2, w + 20, 9);
  container.add(shade);
  // Stalk drawn upward from its base so scaling from the bottom looks alive.
  const stalk = scene.add.container(0, h);
  const g = scene.add.graphics();
  g.fillStyle(0x2e7d32, 1);
  g.fillTriangle(-6, 0, w + 6, 0, w / 2, -h);
  g.fillStyle(0x66bb6a, 1);
  g.fillTriangle(2, 0, w * 0.62, 0, w / 2, -h + 8);
  // Thorn nubs up the lit side + rim light.
  g.fillStyle(0xa5d6a7, 0.9);
  for (let i = 1; i <= 4; i++) {
    g.fillTriangle(w / 2 - 4, -i * (h / 5), w / 2 - 16, -i * (h / 5) + 6, w / 2 - 4, -i * (h / 5) + 10);
  }
  g.lineStyle(2, 0xc8e6c9, 0.5);
  g.lineBetween(w * 0.3, -4, w / 2 - 2, -h + 10);
  stalk.add(g);
  const bud = scene.add.circle(w / 2, -h + 6, 6, 0xffca28, 0.95);
  stalk.add(bud);
  scene.tweens.add({ targets: bud, alpha: 0.5, duration: 400, yoyo: true, repeat: -1 });
  container.add(stalk);
  return stalk;
}

/** Patrolling cog (world 11+): GameScene shifts the view x with gearShift. */
function drawGear(scene: Scene, container: Container, w: number): void {
  const r = w / 2;
  const g = scene.add.graphics();
  g.setPosition(r, r);
  // Square cog teeth, rusted bronze.
  g.fillStyle(0x8d6e63, 1);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.save();
    g.translateCanvas(Math.cos(a) * (r - 8), Math.sin(a) * (r - 8));
    g.rotateCanvas(a);
    g.fillRect(-5, -7, 12, 14);
    g.restore();
  }
  g.fillStyle(0xa1887f, 1);
  g.fillCircle(0, 0, r - 8);
  g.fillStyle(0x6d4c41, 1);
  g.fillCircle(0, 0, r - 16);
  g.fillStyle(0x4e342e, 1);
  g.fillCircle(0, 0, 9);
  // Lit arc + specular, matching the buzzsaw's metal read.
  g.lineStyle(4, 0xd7ccc8, 0.6);
  g.beginPath();
  g.arc(0, 0, r - 12, Math.PI * 1.05, Math.PI * 1.5);
  g.strokePath();
  g.fillStyle(0xffffff, 0.5);
  g.fillCircle(-4, -4, 3);
  container.add(g);
  scene.tweens.add({ targets: g, angle: 360, duration: 1400, repeat: -1 });
}

/** Energy gate (world 12+): two bars — thread the window between them. */
function drawGate(scene: Scene, container: Container, w: number, h: number): void {
  const winTop = h - GATE_GAP_HI; // window spans the passable elevations
  const winBottom = h - GATE_GAP_LO;
  const g = scene.add.graphics();
  // Emitter nodes bracketing the window — steady, like the laser base.
  g.fillStyle(0x263238, 1);
  g.fillRect(-8, winTop - 12, w + 16, 12);
  g.fillRect(-8, winBottom, w + 16, 12);
  g.fillStyle(0x455a64, 1);
  g.fillRect(-8, winTop - 12, w + 16, 4);
  g.fillRect(-8, winBottom, w + 16, 4);
  container.add(g);
  const bars = scene.add.graphics();
  for (const [y0, y1] of [[0, winTop - 12], [winBottom + 12, h]] as const) {
    bars.fillStyle(0x40c4ff, 0.35);
    bars.fillRect(-4, y0, w + 8, y1 - y0);
    bars.fillStyle(0x40c4ff, 0.9);
    bars.fillRect(4, y0, w - 8, y1 - y0);
    bars.fillStyle(0xe1f5fe, 1);
    bars.fillRect(w / 2 - 2, y0, 4, y1 - y0);
  }
  container.add(bars);
  scene.tweens.add({ targets: bars, alpha: 0.55, duration: 260, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
}

/** Bobbing crusher slab (world 13+): GameScene drives y with crusherElev. */
function drawCrusher(scene: Scene, container: Container, w: number, h: number): void {
  const g = scene.add.graphics();
  const d = 10;
  // 2.5D slab, same light model as blocks, in gunmetal.
  g.fillStyle(0x1c2226, 1);
  g.fillPoints([{ x: w, y: 0 }, { x: w + d, y: -d }, { x: w + d, y: h - 14 - d }, { x: w, y: h - 14 }], true);
  g.fillStyle(0x78909c, 1);
  g.fillPoints([{ x: 0, y: 0 }, { x: d, y: -d }, { x: w + d, y: -d }, { x: w, y: 0 }], true);
  g.fillGradientStyle(0x546e7a, 0x546e7a, 0x37474f, 0x37474f, 1);
  g.fillRect(0, 0, w, h - 14);
  g.lineStyle(2, 0x1c2226, 1);
  g.strokeRect(0, 0, w, h - 14);
  // Rivets.
  g.fillStyle(0xb0bec5, 0.9);
  for (const rx of [10, w / 2, w - 10]) g.fillCircle(rx, 9, 3);
  // Grinding teeth under the slab.
  g.fillStyle(0x263238, 1);
  for (let x = 4; x + 14 <= w; x += 18) {
    g.fillTriangle(x, h - 14, x + 14, h - 14, x + 7, h);
  }
  container.add(g);
}

/** Static floating spike ball (world 14+): a clean jump-over. */
function drawUrchin(scene: Scene, container: Container, w: number): void {
  const r = w / 2;
  const g = scene.add.graphics();
  g.setPosition(r, r);
  g.fillStyle(0xd84315, 1);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.fillTriangle(
      Math.cos(a - 0.18) * (r - 12), Math.sin(a - 0.18) * (r - 12),
      Math.cos(a + 0.18) * (r - 12), Math.sin(a + 0.18) * (r - 12),
      Math.cos(a) * (r + 5), Math.sin(a) * (r + 5),
    );
  }
  g.fillStyle(0xbf360c, 1);
  g.fillCircle(0, 0, r - 10);
  g.fillStyle(0xff8a65, 1);
  g.fillCircle(-4, -4, r - 17);
  g.fillStyle(0x870000, 1);
  g.fillCircle(2, 2, r - 23);
  g.fillStyle(0xffffff, 0.5);
  g.fillCircle(-r * 0.3, -r * 0.3, 4);
  container.add(g);
  // Slow menacing rotation — static position, living surface.
  scene.tweens.add({ targets: g, angle: 360, duration: 6000, repeat: -1 });
}

/**
 * Buried talon (world 15+): returns the erupting claw whose visibility
 * GameScene syncs to talonActive; the mound is the always-visible tell.
 */
function drawTalon(scene: Scene, container: Container, w: number, h: number): Container {
  const blade = scene.add.container(0, 0);
  const bg = scene.add.graphics();
  // Three curved bone talons: lit front edge, shaded back.
  for (const [cx, tip, lean] of [[w * 0.22, h * 0.55, -8], [w * 0.5, h, 0], [w * 0.78, h * 0.7, 8]] as const) {
    bg.fillStyle(0xbcaaa4, 1);
    bg.fillTriangle(cx - 9, h, cx + 9, h, cx + lean, h - tip);
    bg.fillStyle(0x8d6e63, 1);
    bg.fillTriangle(cx + 1, h, cx + 9, h, cx + lean, h - tip);
    bg.fillStyle(0xefebe9, 0.8);
    bg.fillCircle(cx + lean * 0.8, h - tip + 5, 2.5);
  }
  blade.add(bg);
  container.add(blade);
  // Cracked dirt mound — always visible, telegraphs the trap.
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(w / 2, h - 2, w + 18, 9);
  g.fillStyle(0x4e342e, 1);
  g.fillEllipse(w / 2, h - 4, w + 10, 16);
  g.fillStyle(0x6d4c41, 1);
  g.fillEllipse(w / 2, h - 7, w - 4, 9);
  g.lineStyle(2, 0x272320, 0.9);
  g.lineBetween(w * 0.3, h - 10, w * 0.45, h - 3);
  g.lineBetween(w * 0.6, h - 11, w * 0.7, h - 4);
  container.add(g);
  return blade;
}

/** Hover-drone (world 16+): GameScene drives x/y with droneShift/droneElev. */
function drawDrone(scene: Scene, container: Container, w: number, h: number): void {
  const g = scene.add.graphics();
  // Rotor glow disc above the body.
  g.fillStyle(0x69f0ae, 0.25);
  g.fillEllipse(w / 2, 4, w + 18, 10);
  // Hull: lit top dome, shaded belly.
  g.fillStyle(0x37474f, 1);
  g.fillEllipse(w / 2, h * 0.55, w, h * 0.7);
  g.fillStyle(0x546e7a, 1);
  g.fillEllipse(w / 2, h * 0.42, w - 8, h * 0.42);
  g.fillStyle(0x263238, 1);
  g.fillEllipse(w / 2, h * 0.72, w - 6, h * 0.3);
  g.fillStyle(0xffffff, 0.4);
  g.fillEllipse(w * 0.34, h * 0.36, 12, 6);
  container.add(g);
  // Scanner eye pulses.
  const eye = scene.add.circle(w / 2, h * 0.58, 6, 0x69f0ae, 1);
  container.add(eye);
  scene.tweens.add({ targets: eye, alpha: 0.35, duration: 350, yoyo: true, repeat: -1 });
}

/** Obsidian monolith (world 17+): the tallest precise jump. */
function drawObelisk(scene: Scene, container: Container, w: number, h: number): void {
  const g = scene.add.graphics();
  const d = 8;
  // 2.5D like a block, but tapered: lit cap, shaded right face.
  g.fillStyle(0x12081f, 1);
  g.fillPoints([{ x: w, y: 6 }, { x: w + d, y: 6 - d }, { x: w + d, y: h - d }, { x: w, y: h }], true);
  g.fillStyle(0x7e57c2, 1);
  g.fillPoints([{ x: 2, y: 6 }, { x: 2 + d, y: 6 - d }, { x: w + d, y: 6 - d }, { x: w, y: 6 }], true);
  g.fillGradientStyle(0x4527a0, 0x4527a0, 0x261445, 0x261445, 1);
  g.fillPoints([{ x: 2, y: 6 }, { x: w, y: 6 }, { x: w - 1, y: h }, { x: 3, y: h }], true);
  g.lineStyle(2, 0x12081f, 1);
  g.strokeRect(2, 6, w - 3, h - 6);
  container.add(g);
  // Glowing rune seam.
  const rune = scene.add.graphics();
  rune.lineStyle(3, 0xb388ff, 0.9);
  rune.lineBetween(w / 2, 14, w / 2, h - 12);
  rune.fillStyle(0xb388ff, 0.9);
  rune.fillCircle(w / 2, h * 0.3, 4);
  rune.fillCircle(w / 2, h * 0.62, 4);
  container.add(rune);
  scene.tweens.add({ targets: rune, alpha: 0.4, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
}

/** Solar fire ribbon (world 18+): wide, low, always burning. */
function drawFlare(scene: Scene, container: Container, w: number, h: number): void {
  const g = scene.add.graphics();
  // Scorched strip under the flames.
  g.fillStyle(0x1c0e02, 1);
  g.fillRect(-4, h - 6, w + 8, 6);
  // Flame wall: layered tongues, hot core low, cooler tips high.
  g.fillStyle(0xbf360c, 0.9);
  for (let x = 0; x + 26 <= w + 10; x += 26) {
    g.fillTriangle(x, h, x + 26, h, x + 13, h - 34 - (x % 3) * 6);
  }
  g.fillStyle(0xff9800, 0.95);
  for (let x = 8; x + 22 <= w; x += 22) {
    g.fillTriangle(x, h, x + 22, h, x + 11, h - 22 - (x % 2) * 8);
  }
  g.fillStyle(0xffe082, 1);
  g.fillRect(2, h - 8, w - 4, 5);
  container.add(g);
  const glow = scene.add.rectangle(w / 2, h - 16, w + 14, 26, 0xff9800, 0.22);
  container.add(glow);
  scene.tweens.add({ targets: [g, glow], alpha: 0.72, duration: 110, yoyo: true, repeat: -1 });
}

/** Fallen comet (world 19+): GameScene drives y with cometElev as it lands. */
function drawComet(scene: Scene, container: Container, w: number, h: number): void {
  const g = scene.add.graphics();
  // Trail streaks up-right — the direction it fell from.
  g.fillStyle(0xf48fb1, 0.3);
  g.fillTriangle(w * 0.4, h * 0.5, w + 46, -40, w + 20, -52);
  g.fillStyle(0xfce4ec, 0.4);
  g.fillTriangle(w * 0.5, h * 0.45, w + 34, -34, w + 22, -40);
  // Molten core: shaded under, lit toward the trail.
  g.fillStyle(0x880e4f, 1);
  g.fillCircle(w / 2, h / 2, w / 2);
  g.fillStyle(0xd81b60, 1);
  g.fillCircle(w / 2 + 2, h / 2 - 2, w / 2 - 6);
  g.fillStyle(0xf48fb1, 1);
  g.fillCircle(w / 2 + 5, h / 2 - 5, w / 2 - 13);
  g.fillStyle(0xffffff, 0.75);
  g.fillCircle(w / 2 + 8, h / 2 - 8, 4);
  container.add(g);
  const flicker = scene.add.circle(w / 2, h / 2, w / 2 + 6, 0xf48fb1, 0.18);
  container.add(flicker);
  scene.tweens.add({ targets: flicker, alpha: 0.05, scale: 1.2, duration: 160, yoyo: true, repeat: -1 });
}

/**
 * Reaper scythe (world 20+): returns the sweeping blade whose visibility
 * GameScene syncs to reaperActive; the chrome post is the constant tell.
 */
function drawReaper(scene: Scene, container: Container, w: number, h: number): Container {
  const blade = scene.add.container(0, 0);
  const bg = scene.add.graphics();
  // Crescent blade across the track: bright edge, dark spine.
  bg.fillStyle(0x455a64, 1);
  bg.fillPoints(
    [{ x: -14, y: h * 0.25 }, { x: w + 14, y: h * 0.4 }, { x: w + 6, y: h * 0.72 }, { x: -6, y: h * 0.55 }],
    true,
  );
  bg.fillStyle(0xeceff1, 1);
  bg.fillPoints(
    [{ x: -14, y: h * 0.25 }, { x: w + 14, y: h * 0.4 }, { x: w + 10, y: h * 0.52 }, { x: -10, y: h * 0.37 }],
    true,
  );
  blade.add(bg);
  container.add(blade);
  scene.tweens.add({ targets: blade, y: 6, duration: 300, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  // Chrome post with an energy core — always visible.
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(w / 2, h - 2, w + 10, 8);
  g.fillStyle(0x263238, 1);
  g.fillRect(w / 2 - 5, 0, 10, h);
  g.fillStyle(0x546e7a, 1);
  g.fillRect(w / 2 - 5, 0, 4, h);
  g.fillStyle(0x00e5ff, 1);
  g.fillCircle(w / 2, 6, 7);
  g.fillStyle(0xffffff, 0.85);
  g.fillCircle(w / 2 - 2, 4, 2.5);
  container.add(g);
  return blade;
}

// ---------------------------------------------------------------------------
// AIR HAZARDS (one per 10 levels): all float in the jump arc — safe to run
// under, deadly to jump into. Same graphics idiom as everything above.

/** Vertical golden ring hanging in the jump lane. */
function drawHalo(scene: Scene, container: Container, w: number, h: number): void {
  const g = scene.add.graphics();
  // Outer glow, then the torus as thick ellipse strokes.
  g.lineStyle(14, 0xffd54f, 0.18);
  g.strokeEllipse(w / 2, h / 2, w - 8, h - 8);
  g.lineStyle(8, 0xffb300, 1);
  g.strokeEllipse(w / 2, h / 2, w - 14, h - 14);
  g.lineStyle(3, 0xfff8e1, 0.9);
  g.strokeEllipse(w / 2 - 3, h / 2 - 4, w - 24, h - 24);
  container.add(g);
  scene.tweens.add({ targets: g, alpha: 0.55, duration: 700, yoyo: true, repeat: -1 });
}

/** Pale spirit orb with a trailing wispy tail (the bob comes from wispElev). */
function drawWisp(scene: Scene, container: Container, w: number, h: number): void {
  const g = scene.add.graphics();
  const r = w / 2 - 4;
  // Tail flames drifting up-left off the orb.
  g.fillStyle(0x80d8ff, 0.35);
  g.fillTriangle(w / 2 - r, h / 2, w / 2, h / 2 - 8, 2, h - 6);
  g.fillTriangle(w / 2, h / 2 + 4, w / 2 + r - 6, h / 2, w * 0.3, h - 2);
  // Orb: rim, body, hot core.
  g.fillStyle(0x40c4ff, 1);
  g.fillCircle(w / 2, h * 0.4, r);
  g.fillStyle(0xb3e5fc, 1);
  g.fillCircle(w / 2 - 3, h * 0.4 - 3, r - 7);
  g.fillStyle(0xffffff, 0.95);
  g.fillCircle(w / 2 - 5, h * 0.4 - 5, r - 14);
  container.add(g);
  scene.tweens.add({ targets: g, alpha: 0.7, duration: 420, yoyo: true, repeat: -1 });
}

/** Long steel spear pointing at the player, floating high. */
function drawLance(scene: Scene, container: Container, w: number, h: number): void {
  const g = scene.add.graphics();
  const tip = 26;
  // Shaft: lit top edge, shaded bottom.
  g.fillStyle(0x90a4ae, 1);
  g.fillRect(tip, 4, w - tip - 6, h - 8);
  g.fillStyle(0xcfd8dc, 1);
  g.fillRect(tip, 4, w - tip - 6, (h - 8) / 2);
  g.fillStyle(0x546e7a, 1);
  g.fillRect(w - 14, 2, 12, h - 4); // tail cap
  // Point (faces the incoming player).
  g.fillStyle(0xeceff1, 1);
  g.fillTriangle(0, h / 2, tip, 2, tip, h - 2);
  container.add(g);
  const glint = scene.add.rectangle(w * 0.45, h / 2 - 4, 26, 3, 0xffffff, 0.8);
  container.add(glint);
  scene.tweens.add({ targets: glint, x: w * 0.8, alpha: 0.1, duration: 900, repeat: -1 });
}

/** Trio of small spiked orbs staggered up the jump arc (SWARM_OFFSETS). */
function drawSwarm(scene: Scene, container: Container, w: number, h: number): void {
  // Local layout mirrors runner.ts SWARM_OFFSETS relative to the envelope:
  // orb bottoms at elev 85/118/145 inside an elev-85, h-96 spec.
  const orbs: ReadonlyArray<[number, number]> = [[0, 60], [34, 27], [68, 0]];
  for (const [ox, oy] of orbs) {
    const g = scene.add.graphics();
    g.setPosition(ox + 18, oy + 18);
    g.fillStyle(0xe53935, 1);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.fillTriangle(
        Math.cos(a - 0.3) * 10, Math.sin(a - 0.3) * 10,
        Math.cos(a + 0.3) * 10, Math.sin(a + 0.3) * 10,
        Math.cos(a) * 19, Math.sin(a) * 19,
      );
    }
    g.fillStyle(0xb71c1c, 1);
    g.fillCircle(0, 0, 12);
    g.fillStyle(0xff8a80, 1);
    g.fillCircle(-3, -3, 6);
    container.add(g);
    scene.tweens.add({ targets: g, angle: 360, duration: 3200 + ox * 8, repeat: -1 });
  }
  void w;
  void h;
}

/** Charged energy net — GameScene dims the whole view while discharged. */
function drawFlux(scene: Scene, container: Container, w: number, h: number): void {
  const g = scene.add.graphics();
  // Frame emitters top and bottom.
  g.fillStyle(0x2e7d32, 1);
  g.fillRect(0, 0, w, 10);
  g.fillRect(0, h - 10, w, 10);
  g.fillStyle(0xa5d6a7, 1);
  g.fillRect(0, 0, w, 4);
  // Mesh.
  g.lineStyle(3, 0x69f0ae, 0.9);
  for (let x = 10; x < w; x += 20) g.lineBetween(x, 10, x, h - 10);
  for (let y = 22; y < h - 10; y += 24) g.lineBetween(2, y, w - 2, y);
  container.add(g);
  const shimmer = scene.add.rectangle(w / 2, h / 2, w - 4, h - 20, 0x69f0ae, 0.14);
  container.add(shimmer);
  scene.tweens.add({ targets: shimmer, alpha: 0.32, duration: 300, yoyo: true, repeat: -1 });
}

/** Violet spiked orb that sweeps sideways (motion from pendulShift). */
function drawPendul(scene: Scene, container: Container, w: number): void {
  const r = w / 2;
  const g = scene.add.graphics();
  g.setPosition(r, r);
  g.fillStyle(0x7e57c2, 1);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    g.fillTriangle(
      Math.cos(a - 0.2) * (r - 10), Math.sin(a - 0.2) * (r - 10),
      Math.cos(a + 0.2) * (r - 10), Math.sin(a + 0.2) * (r - 10),
      Math.cos(a) * (r + 4), Math.sin(a) * (r + 4),
    );
  }
  g.fillStyle(0x4527a0, 1);
  g.fillCircle(0, 0, r - 8);
  g.fillStyle(0xb39ddb, 1);
  g.fillCircle(-3, -3, r - 15);
  g.fillStyle(0xede7f6, 0.9);
  g.fillCircle(-r * 0.25, -r * 0.25, 5);
  container.add(g);
  scene.tweens.add({ targets: g, angle: -360, duration: 2600, repeat: -1 });
}

/** Twin stacked energy bars; the safe lane is beneath the lower one. */
function drawRails(scene: Scene, container: Container, w: number, h: number): void {
  // Envelope maps elevation 230 (top) .. 85 (bottom): upper bar occupies
  // local y 0..65, lower bar 105..145 — mirrors RAILS_* consts.
  const g = scene.add.graphics();
  const bar = (y: number, bh: number): void => {
    g.fillStyle(0xef6c00, 0.35);
    g.fillRect(-6, y - 4, w + 12, bh + 8);
    g.fillStyle(0xff9800, 1);
    g.fillRect(0, y, w, bh);
    g.fillStyle(0xffe0b2, 1);
    g.fillRect(0, y, w, 6);
    g.fillStyle(0xe65100, 1);
    g.fillRect(0, y + bh - 6, w, 6);
  };
  bar(0, 65);
  bar(105, 40);
  container.add(g);
  const spark = scene.add.rectangle(0, 85, 10, 18, 0xffcc80, 0.9);
  container.add(spark);
  scene.tweens.add({ targets: spark, x: w, duration: 500, yoyo: true, repeat: -1 });
  void h;
}

/** Teal vortex funnel: stacked ellipses narrowing downward, always turning. */
function drawCyclone(scene: Scene, container: Container, w: number, h: number): void {
  const g = scene.add.graphics();
  const bands = 6;
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    const bw = w * (1 - 0.55 * t);
    const y = 8 + t * (h - 20);
    g.fillStyle(i % 2 === 0 ? 0x26a69a : 0x00897b, 0.9);
    g.fillEllipse(w / 2, y, bw, 16);
    g.fillStyle(0xb2dfdb, 0.5);
    g.fillEllipse(w / 2 - bw * 0.18, y - 3, bw * 0.4, 5);
  }
  container.add(g);
  // Spin illusion: the whole stack wobbles horizontally.
  scene.tweens.add({ targets: g, scaleX: 0.86, duration: 260, yoyo: true, repeat: -1 });
}

/** Ghost that fades between solid and harmless (alpha from GameScene). */
function drawSpecter(scene: Scene, container: Container, w: number, h: number): void {
  const g = scene.add.graphics();
  // Dome + wavy skirt.
  g.fillStyle(0xcfd8dc, 0.9);
  g.fillEllipse(w / 2, h * 0.32, w - 6, h * 0.6);
  g.fillRect(3, h * 0.32, w - 6, h * 0.45);
  for (let i = 0; i < 4; i++) {
    const seg = (w - 6) / 4;
    g.fillEllipse(3 + seg * (i + 0.5), h * 0.77, seg, 22);
  }
  g.fillStyle(0xeceff1, 0.9);
  g.fillEllipse(w / 2 - 4, h * 0.26, w * 0.55, h * 0.32);
  // Hollow eyes + mouth.
  g.fillStyle(0x263238, 1);
  g.fillEllipse(w * 0.36, h * 0.3, 12, 18);
  g.fillEllipse(w * 0.64, h * 0.3, 12, 18);
  g.fillEllipse(w * 0.5, h * 0.5, 10, 14);
  container.add(g);
  scene.tweens.add({ targets: g, y: 6, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
}

/** Magenta core orb; returns the orbiting satellite (positioned per frame). */
function drawNova(scene: Scene, container: Container, w: number, h: number): Container {
  const g = scene.add.graphics();
  const r = w / 2;
  g.fillStyle(0xd500f9, 0.2);
  g.fillCircle(r, h / 2, r + 10);
  g.fillStyle(0xaa00ff, 1);
  g.fillCircle(r, h / 2, r - 4);
  g.fillStyle(0xea80fc, 1);
  g.fillCircle(r - 4, h / 2 - 4, r - 12);
  g.fillStyle(0xffffff, 0.9);
  g.fillCircle(r - 8, h / 2 - 8, 6);
  container.add(g);
  // Orbit path hint.
  const path = scene.add.graphics();
  path.lineStyle(2, 0xea80fc, 0.25);
  path.strokeCircle(r, h / 2, 40);
  container.add(path);
  // Satellite: small hot spark, orbit driven by novaSatPos.
  const sat = scene.add.container(w, h / 2);
  const sg = scene.add.graphics();
  sg.fillStyle(0xd500f9, 0.35);
  sg.fillCircle(0, 0, 18);
  sg.fillStyle(0xf3e5f5, 1);
  sg.fillCircle(0, 0, 11);
  sg.fillStyle(0xffffff, 1);
  sg.fillCircle(-2, -2, 5);
  sat.add(sg);
  container.add(sat);
  return sat;
}
