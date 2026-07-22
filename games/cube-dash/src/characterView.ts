import Phaser from "phaser";
import type { CharacterSpec } from "./characters";

/**
 * Builds the character's signature aura: effects that live AROUND the body —
 * hollow outlines, orbiting satellites, sparks — never filled shapes over it,
 * so the character itself stays fully visible.
 */
export function attachAura(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  spec: CharacterSpec,
  s: number,
): void {
  const { color, style } = spec.aura;

  /** Hollow outline in the character's silhouette, offset outside the body. */
  const outline = (size: number, strokeAlpha: number, width = 3): Phaser.GameObjects.Shape => {
    let shape: Phaser.GameObjects.Shape;
    if (spec.shape === "ball") {
      shape = scene.add.circle(0, 0, size / 2, color, 0);
    } else {
      shape = scene.add.rectangle(0, 0, size, size, color, 0);
      if (spec.shape === "diamond") shape.setAngle(45);
    }
    shape.setStrokeStyle(width, color, strokeAlpha);
    return shape;
  };

  switch (style) {
    case "pulse": {
      // Double halo: a crisp inner outline breathing against a faint outer one.
      const inner = outline(s + 26, 0.85, 4);
      const outer = outline(s + 46, 0.3, 2);
      container.addAt(outer, 0);
      container.addAt(inner, 0);
      scene.tweens.add({
        targets: inner,
        scale: 1.12,
        alpha: 0.35,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
      scene.tweens.add({
        targets: outer,
        scale: 0.92,
        alpha: 0.6,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
      break;
    }
    case "flicker": {
      // Embers circling the body, flickering at different rates.
      const orbit = scene.add.container(0, 0);
      const radius = s / 2 + 20;
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        const r = radius + (i % 2) * 8;
        const ember = scene.add.circle(
          Math.cos(angle) * r,
          Math.sin(angle) * r,
          i % 2 === 0 ? 5 : 3,
          i % 2 === 0 ? color : spec.light,
        );
        orbit.add(ember);
        scene.tweens.add({
          targets: ember,
          alpha: 0.25,
          duration: 90 + i * 35,
          yoyo: true,
          repeat: -1,
        });
      }
      container.addAt(orbit, 0);
      scene.tweens.add({ targets: orbit, angle: 360, duration: 1400, repeat: -1 });
      break;
    }
    case "rings": {
      // Sonar: rings born just outside the body, expanding and fading.
      for (const delay of [0, 650]) {
        const ring = outline(s + 18, 0.8, 3);
        container.addAt(ring, 0);
        ring.setAlpha(0);
        scene.tweens.add({
          targets: ring,
          scale: 1.9,
          alpha: { from: 0.8, to: 0 },
          duration: 1300,
          delay,
          repeat: -1,
          ease: "Quad.easeOut",
        });
      }
      break;
    }
    case "spin": {
      // Four gem satellites orbiting, inside a slow counter-rotating outline.
      const orbit = scene.add.container(0, 0);
      const radius = s / 2 + 22;
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        const gem = scene.add
          .rectangle(Math.cos(angle) * radius, Math.sin(angle) * radius, 11, 11, color)
          .setAngle(45)
          .setStrokeStyle(2, spec.light, 0.9);
        orbit.add(gem);
        scene.tweens.add({
          targets: gem,
          alpha: 0.45,
          duration: 700,
          yoyo: true,
          repeat: -1,
          delay: i * 175,
        });
      }
      const frame = outline(s + 48, 0.35, 2);
      container.addAt(frame, 0);
      container.addAt(orbit, 0);
      scene.tweens.add({ targets: orbit, angle: 360, duration: 2200, repeat: -1 });
      scene.tweens.add({ targets: frame, angle: frame.angle - 360, duration: 5200, repeat: -1 });
      break;
    }
    case "crackle": {
      // Lightning arcs discharging around the body at staggered rhythms.
      const radius = s / 2 + 16;
      for (let i = 0; i < 4; i++) {
        const bolt = scene.add.graphics();
        bolt.lineStyle(3, i % 2 === 0 ? color : 0xffffff, 1);
        bolt.beginPath();
        bolt.moveTo(0, -9);
        bolt.lineTo(5, -2);
        bolt.lineTo(-2, 2);
        bolt.lineTo(4, 9);
        bolt.strokePath();
        const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
        bolt.setPosition(Math.cos(angle) * radius, Math.sin(angle) * radius);
        bolt.setRotation(angle + Math.PI / 2);
        bolt.setAlpha(0);
        container.addAt(bolt, 0);
        scene.tweens.add({
          targets: bolt,
          alpha: { from: 1, to: 0 },
          duration: 140,
          repeat: -1,
          repeatDelay: 260 + i * 130,
          delay: i * 90,
        });
      }
      break;
    }
  }
}

/**
 * Draws a character's body parts centered on (0,0), sized to the player box.
 * Used both by the game (inside the rotating player container) and by the
 * menu's character preview.
 */
export function buildCharacterParts(
  scene: Phaser.Scene,
  spec: CharacterSpec,
  s: number,
): Phaser.GameObjects.GameObject[] {
  const parts: Phaser.GameObjects.GameObject[] = [];

  if (spec.shape === "cube") {
    parts.push(scene.add.rectangle(0, 0, s, s, spec.color).setStrokeStyle(5, spec.dark));
    // Bevel: lit top/left, shaded bottom/right — light from the top-left.
    parts.push(scene.add.rectangle(0, -s / 2 + 7, s - 12, 5, spec.light));
    parts.push(scene.add.rectangle(-s / 2 + 7, 0, 5, s - 12, spec.light));
    parts.push(scene.add.rectangle(0, s / 2 - 7, s - 12, 5, spec.dark));
    parts.push(scene.add.rectangle(s / 2 - 7, 0, 5, s - 12, spec.dark));
    parts.push(scene.add.rectangle(0, 0, s - 26, s - 26, spec.face));
    // Glass sheen across the upper-left, ambient occlusion pooling at the
    // bottom — the face reads as a curved, lit surface instead of a sticker.
    const sheen = scene.add.graphics();
    sheen.fillStyle(0xffffff, 0.12);
    sheen.fillTriangle(-s / 2 + 5, -s / 2 + 5, s / 2 - 9, -s / 2 + 5, -s / 2 + 5, s / 2 - 9);
    parts.push(sheen);
    parts.push(scene.add.rectangle(0, s / 2 - 11, s - 14, 6, 0x000000, 0.22));
  } else if (spec.shape === "ball") {
    parts.push(scene.add.circle(0, 0, s / 2, spec.color).setStrokeStyle(5, spec.dark));
    // Sphere shading: shadowed underside ring, lit face offset toward the
    // light, then a two-step specular (broad + hot core).
    parts.push(scene.add.circle(3, 3, s / 2 - 7, spec.dark, 0.55));
    parts.push(scene.add.circle(-2, -2, s / 2 - 12, spec.face));
    parts.push(scene.add.circle(-s / 5, -s / 5, s / 7, 0xffffff, 0.5));
    parts.push(scene.add.circle(-s / 4.4, -s / 4.4, s / 16, 0xffffff, 0.9));
  } else {
    // diamond: rotated squares, bounding box ≈ the player box.
    const d = s * 0.78;
    parts.push(
      scene.add.rectangle(0, 0, d, d, spec.color).setStrokeStyle(5, spec.dark).setAngle(45),
    );
    parts.push(scene.add.rectangle(0, 0, d - 20, d - 20, spec.face).setAngle(45));
    // Cut-gem facets: shaded right half, lit upper-left wedge.
    const facetR = ((d - 20) * Math.SQRT2) / 2;
    const facets = scene.add.graphics();
    facets.fillStyle(spec.dark, 0.3);
    facets.fillTriangle(0, -facetR, facetR, 0, 0, facetR);
    facets.fillStyle(0xffffff, 0.14);
    facets.fillTriangle(0, -facetR, -facetR, 0, 0, 0);
    parts.push(facets);
    parts.push(scene.add.rectangle(0, -d / 2 + 4, 10, 10, spec.light).setAngle(45));
  }

  // Face
  const eyeL = scene.add.rectangle(-9, -6, 9, 14, 0x0a1518);
  const eyeR = scene.add.rectangle(11, -6, 9, 14, 0x0a1518);
  if (spec.mouth === "angry") {
    eyeL.setAngle(-18);
    eyeR.setAngle(18);
    parts.push(eyeL, eyeR, scene.add.rectangle(1, 13, 26, 5, 0x0a1518));
  } else if (spec.mouth === "zap") {
    parts.push(
      eyeL,
      eyeR,
      scene.add
        .text(1, 13, "⚡", { fontSize: "20px" })
        .setOrigin(0.5),
    );
  } else {
    parts.push(eyeL, eyeR, scene.add.rectangle(1, 12, 22, 6, 0x0a1518));
  }
  return parts;
}

/**
 * Per-character signature running trail (companion to attachAura): a
 * particle emitter following the body, styled by spec.trailStyle. Shared by
 * GameScene (the real runner) and MenuScene's attract demo. Returns with
 * emitting OFF; callers toggle it. `scale` shrinks the effect for smaller
 * bodies (menu demo cube).
 *
 * The runner is SCREEN-STATIONARY while the track scrolls past, so
 * particles must stream left at ~`worldSpeed` to read as being left behind
 * on the track (slower and they hide inside the body). The base emission
 * frequency is stored as data "baseFrequency" so callers can boost
 * intensity in the air (TRAIL_AIR_BOOST) and restore it on landing.
 */
export const TRAIL_AIR_BOOST = 2.5;

export function buildCharacterTrail(
  scene: Phaser.Scene,
  follow: Phaser.GameObjects.Container,
  spec: CharacterSpec,
  scale = 1,
  worldSpeed = 480,
): Phaser.GameObjects.Particles.ParticleEmitter {
  ensureTrailTextures(scene);
  const ws = worldSpeed;
  const tint = [...spec.trail];
  const base: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig = {
    follow,
    tint,
    emitting: false,
  };
  let cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig;
  let texture: string;
  switch (spec.trailStyle) {
    case "streaks": // crisp cube afterimages fading out along the track
      texture = "trail-square";
      cfg = {
        ...base,
        speedX: { min: -ws - 40, max: -ws + 80 },
        speedY: { min: -12, max: 12 },
        lifespan: 340,
        frequency: 26,
        scale: { start: 1.3 * scale, end: 0 },
        alpha: { start: 0.35, end: 0 },
      };
      break;
    case "embers": // fire motes left behind, rising as they gutter out
      texture = "trail-dot";
      cfg = {
        ...base,
        speedX: { min: -ws - 70, max: -ws + 50 },
        speedY: { min: -30, max: 10 },
        gravityY: -150,
        lifespan: 520,
        frequency: 20,
        scale: { start: 1.1 * scale, end: 0 },
        alpha: { start: 0.85, end: 0 },
      };
      break;
    case "bubbles": // rings that lag the track a little, drifting up to pop
      texture = "trail-ring";
      cfg = {
        ...base,
        speedX: { min: -ws * 0.75, max: -ws * 0.5 },
        speedY: { min: -50, max: -5 },
        lifespan: 600,
        frequency: 48,
        scale: { start: 0.4 * scale, end: 1.1 * scale },
        alpha: { start: 0.55, end: 0 },
      };
      break;
    case "glints": // twinkling gem shards tumbling away down the track
      texture = "trail-shard";
      cfg = {
        ...base,
        speedX: { min: -ws - 30, max: -ws + 60 },
        speedY: { min: -25, max: 25 },
        lifespan: 430,
        frequency: 38,
        scale: { start: 1.25 * scale, end: 0 },
        alpha: { start: 0.9, end: 0 },
        rotate: { min: 0, max: 360 },
      };
      break;
    case "sparks": // dense jittery electric static crackling behind
      texture = "trail-dot";
      cfg = {
        ...base,
        speedX: { min: -ws - 160, max: -ws + 120 },
        speedY: { min: -150, max: 150 },
        lifespan: 220,
        frequency: 13,
        scale: { start: 0.95 * scale, end: 0 },
        alpha: { start: 1, end: 0 },
      };
      break;
  }
  const emitter = scene.add.particles(0, 0, texture, cfg);
  emitter.setData("baseFrequency", cfg.frequency);
  return emitter;
}

/** White particle textures (tinted per character), generated once per scene. */
function ensureTrailTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists("trail-dot")) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(4, 4, 4);
    g.generateTexture("trail-dot", 8, 8);
    g.destroy();
  }
  if (!scene.textures.exists("trail-square")) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 14, 14);
    g.generateTexture("trail-square", 14, 14);
    g.destroy();
  }
  if (!scene.textures.exists("trail-ring")) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.lineStyle(3, 0xffffff, 1);
    g.strokeCircle(8, 8, 6);
    g.generateTexture("trail-ring", 16, 16);
    g.destroy();
  }
  if (!scene.textures.exists("trail-shard")) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 1);
    // Diamond
    g.fillTriangle(7, 0, 14, 7, 7, 14);
    g.fillTriangle(7, 0, 0, 7, 7, 14);
    g.generateTexture("trail-shard", 14, 14);
    g.destroy();
  }
}
