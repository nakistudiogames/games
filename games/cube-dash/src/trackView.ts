import Phaser from "phaser";
import { POWER_UPS } from "./logic/runner";
import type { BoostKind, PowerUpKind, TrackZoneKind } from "./logic/runner";

/**
 * Track-element drawing (power-up pickups, launch pads, dash strips, zone
 * gates), shared by GameScene and the menu's guide — one source of truth,
 * same split as obstacleView/worldView.
 */

type Scene = Phaser.Scene;
type Container = Phaser.GameObjects.Container;

export const ZONE_COLORS: Record<TrackZoneKind, number> = { mirror: 0xeceff1, flip: 0xb388ff };

/** Canonical preview boxes for the guide (top-left origin). */
export const BOOST_PREVIEW: Record<BoostKind, { w: number; h: number }> = {
  pad: { w: 90, h: 70 },
  strip: { w: 200, h: 20 },
};
export const ZONE_GATE_SIZE = { w: 30, h: 380 };

/** Spinning pickup gem, centered on (0,0). The game adds its own bob. */
export function buildPickupView(scene: Scene, kind: PowerUpKind): Container {
  const spec = POWER_UPS[kind];
  const container = scene.add.container(0, 0);
  const diamond = scene.add.rectangle(0, 0, 40, 40, spec.color).setStrokeStyle(4, 0xffffff, 0.9);
  diamond.setAngle(45);
  // Gem facet: lit upper-left wedge gives the pickup depth as it spins.
  const facet = scene.add.rectangle(-5, -5, 18, 18, 0xffffff, 0.35).setAngle(45);
  const glyph = scene.add
    .text(0, 0, spec.glyph, {
      fontFamily: "Arial Black, sans-serif",
      fontSize: "26px",
      color: "#12141c",
    })
    .setOrigin(0.5);
  container.add([diamond, facet, glyph]);
  scene.tweens.add({ targets: facet, angle: 405, duration: 1800, repeat: -1 });
  scene.tweens.add({ targets: diamond, angle: 405, duration: 1800, repeat: -1 });
  return container;
}

/**
 * Launch pad / dash strip art, drawn top-left in its BOOST_PREVIEW box with
 * the track surface as the bottom edge.
 */
export function buildBoostView(scene: Scene, kind: BoostKind): Container {
  const { w, h } = BOOST_PREVIEW[kind];
  const container = scene.add.container(0, 0);
  if (kind === "pad") {
    // Amber launch wedge on the track.
    const g = scene.add.graphics();
    g.fillStyle(0x8f5b00, 1);
    g.fillRect(w / 2 - 45, h - 8, 90, 8);
    g.fillStyle(0xffb300, 1);
    g.fillTriangle(w / 2 - 45, h - 8, w / 2 + 45, h - 8, w / 2, h - 30);
    g.fillStyle(0xffe082, 1);
    g.fillTriangle(w / 2 - 22, h - 12, w / 2 + 22, h - 12, w / 2, h - 26);
    container.add(g);
    const chevron = scene.add
      .text(w / 2, h - 52, "▲", { fontSize: "30px", color: "#ffb300" })
      .setOrigin(0.5);
    container.add(chevron);
    scene.tweens.add({ targets: chevron, y: h - 66, alpha: 0.4, duration: 500, yoyo: true, repeat: -1 });
  } else {
    // Cyan dash strip flush with the ground.
    const g = scene.add.graphics();
    g.fillStyle(0x00e5ff, 0.25);
    g.fillRect(0, h - 10, w, 10);
    g.fillStyle(0x00e5ff, 0.9);
    for (let x = 10; x < w - 20; x += 40) {
      g.fillTriangle(x, h - 4, x, h - 16, x + 18, h - 10);
    }
    container.add(g);
    scene.tweens.add({ targets: g, alpha: 0.5, duration: 300, yoyo: true, repeat: -1 });
  }
  return container;
}

/** Shimmering zone-boundary pillar, drawn top-left in ZONE_GATE_SIZE. */
export function buildZoneGateView(scene: Scene, kind: TrackZoneKind): Container {
  const { w, h } = ZONE_GATE_SIZE;
  const color = ZONE_COLORS[kind];
  const container = scene.add.container(0, 0);
  container.add(scene.add.rectangle(w / 2, 0, w, h, color, 0.1).setOrigin(0.5, 0));
  const beam = scene.add.rectangle(w / 2, 0, 10, h, color, 0.55).setOrigin(0.5, 0);
  container.add(beam);
  container.add(scene.add.circle(w / 2, 0, 10, color, 0.9));
  scene.tweens.add({ targets: beam, alpha: 0.25, duration: 420, yoyo: true, repeat: -1 });
  return container;
}
