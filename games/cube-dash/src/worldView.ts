import Phaser from "phaser";
import type { WorldTheme } from "./worlds";

/**
 * World-themed texture generation (silhouette skyline + ground tile),
 * shared by GameScene and the menu attract backdrop — extracted so both
 * always render the exact same world art (same split as obstacleView).
 */
export function ensureWorldTextures(scene: Phaser.Scene, world: WorldTheme): void {
    // World-specific silhouette (city buildings / crystal shards / rocks).
    const silKey = `sil-${world.id}`;
    if (!scene.textures.exists(silKey)) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      if (world.silhouette === "city") {
        const buildings: Array<[number, number, number]> = [
          [0, 70, 190], [80, 60, 260], [150, 90, 140], [250, 70, 300], [330, 55, 210],
        ];
        for (const [x, w, h] of buildings) {
          g.fillStyle(world.silDark, 1);
          g.fillRect(x, 320 - h, w, h);
          g.fillStyle(world.silLight, 1);
          g.fillRect(x, 320 - h, w, 6);
        }
      } else if (world.silhouette === "crystals") {
        const shards: Array<[number, number, number]> = [
          [0, 70, 220], [50, 50, 300], [110, 80, 170], [180, 55, 260], [240, 90, 200],
          [310, 60, 310], [360, 50, 150],
        ];
        for (const [x, w, h] of shards) {
          g.fillStyle(world.silDark, 1);
          g.fillTriangle(x, 320, x + w / 2, 320 - h, x + w, 320);
          g.fillStyle(world.silLight, 0.8);
          g.fillTriangle(x + w / 2, 320 - h, x + w / 2 + 8, 320 - h + 40, x + w / 2 - 8, 320 - h + 40);
        }
      } else if (world.silhouette === "peaks") {
        const peaks: Array<[number, number, number]> = [
          [0, 130, 230], [90, 150, 300], [210, 120, 200], [280, 140, 280], [370, 90, 170],
        ];
        for (const [x, w, h] of peaks) {
          g.fillStyle(world.silDark, 1);
          g.fillTriangle(x, 320, x + w * 0.5, 320 - h, x + w, 320);
          // Snow cap hugging the summit.
          g.fillStyle(world.silLight, 0.9);
          g.fillTriangle(x + w * 0.5, 320 - h, x + w * 0.62, 320 - h * 0.82, x + w * 0.38, 320 - h * 0.82);
        }
      } else if (world.silhouette === "mushrooms") {
        const shrooms: Array<[number, number, number]> = [
          [10, 90, 180], [110, 130, 260], [230, 80, 150], [290, 120, 230],
        ];
        for (const [x, capW, h] of shrooms) {
          const cx = x + capW / 2;
          g.fillStyle(world.silDark, 1);
          g.fillRect(cx - capW * 0.175, 320 - h, capW * 0.35, h); // stalk
          g.fillEllipse(cx, 320 - h, capW, capW * 0.55); // cap
          g.fillStyle(world.silLight, 0.8);
          g.fillEllipse(cx, 320 - h - capW * 0.08, capW * 0.6, capW * 0.2);
        }
      } else if (world.silhouette === "ruins") {
        const ruins: Array<[number, number]> = [
          [0, 150], [140, 200], [320, 130],
        ];
        const tierH = 46;
        for (const [x, baseW] of ruins) {
          const tiers = Math.round(baseW / 44);
          for (let t = 0; t < tiers; t++) {
            const w = baseW * (1 - t * 0.18);
            const cx = x + baseW / 2;
            g.fillStyle(world.silDark, 1);
            g.fillRect(cx - w / 2, 320 - tierH * (t + 1), w, tierH);
            g.fillStyle(world.silLight, 0.7);
            g.fillRect(cx - w / 2, 320 - tierH * (t + 1), w, 4);
          }
        }
      } else if (world.silhouette === "tendrils") {
        const tendrils: Array<[number, number, number, number]> = [
          [10, 34, 240, 40], [80, 26, 300, -30], [150, 40, 200, 25], [230, 30, 310, -45],
          [300, 36, 250, 35], [365, 24, 180, -20],
        ];
        for (const [x, w, h, lean] of tendrils) {
          g.fillStyle(world.silDark, 1);
          g.fillTriangle(x, 320, x + w / 2 + lean, 320 - h, x + w, 320);
          g.fillStyle(world.silLight, 0.5);
          g.fillTriangle(x + w * 0.3, 320, x + w / 2 + lean, 320 - h * 0.9, x + w * 0.55, 320);
        }
      } else if (world.silhouette === "spires") {
        const spires: Array<[number, number, number]> = [
          [10, 44, 210], [80, 60, 250], [170, 40, 170], [230, 70, 240], [330, 50, 220],
        ];
        for (const [x, w, h] of spires) {
          g.fillStyle(world.silDark, 1);
          g.fillRect(x, 320 - h, w, h);
          g.fillTriangle(x, 320 - h, x + w / 2, 320 - h - w, x + w, 320 - h); // pointed tip
          g.fillStyle(world.silLight, 0.8);
          g.fillRect(x + w / 2 - 2, 320 - h, 4, h); // lit spine
        }
      } else if (world.silhouette === "arches") {
        for (const [x, w, h] of [[0, 130, 200], [130, 150, 260], [290, 120, 180]] as const) {
          g.fillStyle(world.silDark, 1);
          g.fillRect(x, 320 - h, w, h);
          // Carved opening: a lighter arch reads as sky through the monument.
          g.fillStyle(world.silLight, 0.35);
          g.fillRect(x + w * 0.3, 320 - h * 0.62, w * 0.4, h * 0.62);
          g.fillEllipse(x + w / 2, 320 - h * 0.62, w * 0.4, h * 0.3);
          g.fillStyle(world.silLight, 0.9);
          g.fillRect(x, 320 - h, w, 5);
        }
      } else if (world.silhouette === "pines") {
        for (const [x, w, h] of [[0, 80, 180], [70, 110, 280], [180, 90, 220], [270, 120, 300], [380, 70, 160]] as const) {
          g.fillStyle(world.silDark, 1);
          for (let t = 0; t < 3; t++) {
            const tw = w * (1 - t * 0.25);
            const ty = 320 - (h / 3) * (t + 1);
            g.fillTriangle(x + (w - tw) / 2, 320 - (h / 3) * t, x + w - (w - tw) / 2, 320 - (h / 3) * t, x + w / 2, ty);
          }
          g.fillStyle(world.silLight, 0.7);
          g.fillTriangle(x + w * 0.35, 320 - h * 0.66, x + w / 2, 320 - h, x + w / 2, 320 - h * 0.66);
        }
      } else if (world.silhouette === "stacks") {
        for (const [x, w, h] of [[10, 60, 240], [110, 80, 180], [220, 55, 290], [320, 70, 210]] as const) {
          g.fillStyle(world.silDark, 1);
          g.fillRect(x, 320 - h, w, h);
          g.fillRect(x - 8, 320 - h, w + 16, 14); // crown lip
          g.fillStyle(world.silLight, 0.8);
          g.fillRect(x, 320 - h, 6, h);
          // Smoke plume drifting off the stack.
          g.fillStyle(world.silLight, 0.3);
          g.fillEllipse(x + w / 2 + 18, 320 - h - 18, 46, 22);
          g.fillEllipse(x + w / 2 + 44, 320 - h - 34, 30, 16);
        }
      } else if (world.silhouette === "thunderheads") {
        for (const [x, y, s] of [[30, 240, 60], [140, 190, 80], [280, 230, 70], [370, 180, 50]] as const) {
          g.fillStyle(world.silDark, 1);
          g.fillEllipse(x, y, s * 2.4, s);
          g.fillEllipse(x + s, y - s * 0.5, s * 1.8, s * 0.9);
          g.fillStyle(world.silLight, 0.6);
          g.fillEllipse(x - s * 0.4, y - s * 0.36, s, s * 0.4);
          // Lightning drops to the horizon.
          g.lineStyle(3, world.silLight, 0.8);
          g.beginPath();
          g.moveTo(x + s * 0.4, y + s * 0.4);
          g.lineTo(x + s * 0.2, y + s * 0.9);
          g.lineTo(x + s * 0.5, y + s * 1.1);
          g.strokePath();
        }
      } else if (world.silhouette === "citadel") {
        for (const [x, w, h] of [[20, 90, 230], [140, 130, 300], [300, 90, 250]] as const) {
          g.fillStyle(world.silDark, 1);
          g.fillRect(x, 320 - h, w, h);
          // Battlements + a spire — and mirrored towers hanging above, the
          // inverted-citadel motif.
          for (let bx = x; bx + 14 <= x + w; bx += 22) g.fillRect(bx, 320 - h - 10, 14, 10);
          g.fillTriangle(x + w / 2 - 12, 320 - h - 10, x + w / 2 + 12, 320 - h - 10, x + w / 2, 320 - h - 52);
          g.fillStyle(world.silLight, 0.35);
          g.fillRect(x + w * 0.18, 20, w * 0.64, 34);
          g.fillTriangle(x + w / 2 - 10, 54, x + w / 2 + 10, 54, x + w / 2, 86);
          g.fillStyle(world.silLight, 0.9);
          g.fillRect(x, 320 - h, w, 5);
        }
      } else if (world.silhouette === "coral") {
        for (const [x, w, h] of [[10, 70, 180], [100, 90, 260], [210, 60, 150], [290, 100, 230], [390, 40, 120]] as const) {
          g.fillStyle(world.silDark, 1);
          // Branching coral: a trunk with two forks.
          g.fillRect(x + w / 2 - 8, 320 - h * 0.55, 16, h * 0.55);
          g.fillTriangle(x + w / 2, 320 - h * 0.5, x, 320 - h, x + 26, 320 - h);
          g.fillTriangle(x + w / 2, 320 - h * 0.55, x + w, 320 - h * 0.9, x + w - 24, 320 - h * 0.86);
          g.fillStyle(world.silLight, 0.7);
          g.fillCircle(x + 13, 320 - h - 4, 7);
          g.fillCircle(x + w - 12, 320 - h * 0.9 - 4, 6);
        }
      } else if (world.silhouette === "ribs") {
        // A colossal ribcage arcing over the horizon.
        for (let i = 0; i < 6; i++) {
          const x = 20 + i * 68;
          const h = 180 + (i % 2) * 60 + (i < 3 ? i * 24 : (5 - i) * 24);
          g.fillStyle(world.silDark, 1);
          g.fillRect(x, 320 - h, 22, h);
          g.fillEllipse(x + 24, 320 - h, 50, 26);
          g.fillStyle(world.silLight, 0.6);
          g.fillRect(x + 3, 320 - h, 5, h);
        }
      } else if (world.silhouette === "circuits") {
        for (const [x, w, h] of [[0, 110, 210], [130, 90, 280], [240, 130, 170], [390, 60, 240]] as const) {
          g.fillStyle(world.silDark, 1);
          g.fillRect(x, 320 - h, w, h);
          // Trace lines + node dots, like a motherboard skyline.
          g.lineStyle(3, world.silLight, 0.7);
          g.lineBetween(x + 12, 320 - h + 16, x + 12, 320 - 20);
          g.lineBetween(x + 12, 320 - h + 16, x + w - 16, 320 - h + 16);
          g.fillStyle(world.silLight, 0.9);
          g.fillCircle(x + 12, 320 - h + 16, 5);
          g.fillCircle(x + w - 16, 320 - h + 16, 5);
        }
      } else if (world.silhouette === "obelisks") {
        for (const [x, w, h] of [[30, 46, 260], [120, 60, 310], [230, 40, 200], [310, 54, 280], [400, 30, 160]] as const) {
          g.fillStyle(world.silDark, 1);
          g.fillPoints(
            [{ x, y: 320 }, { x: x + w * 0.14, y: 320 - h }, { x: x + w * 0.86, y: 320 - h }, { x: x + w, y: 320 }],
            true,
          );
          g.fillTriangle(x + w * 0.14, 320 - h, x + w * 0.86, 320 - h, x + w / 2, 320 - h - w * 0.7);
          g.fillStyle(world.silLight, 0.8);
          g.fillRect(x + w / 2 - 2, 320 - h + 8, 4, h - 24);
        }
      } else if (world.silhouette === "flares") {
        // Prominence loops erupting off a molten horizon.
        g.fillStyle(world.silDark, 1);
        g.fillRect(0, 250, 400, 70);
        for (const [x, r] of [[70, 60], [200, 95], [330, 50]] as const) {
          g.lineStyle(14, world.silDark, 1);
          g.beginPath();
          g.arc(x, 260, r, Math.PI, 0);
          g.strokePath();
          g.lineStyle(5, world.silLight, 0.8);
          g.beginPath();
          g.arc(x, 260, r, Math.PI, 0);
          g.strokePath();
        }
      } else if (world.silhouette === "planets") {
        // Ringed giants and moons low on the horizon.
        for (const [x, y, r] of [[90, 210, 70], [280, 150, 46], [370, 250, 30]] as const) {
          g.fillStyle(world.silDark, 1);
          g.fillCircle(x, y, r);
          g.fillStyle(world.silLight, 0.5);
          g.fillCircle(x - r * 0.3, y - r * 0.3, r * 0.4);
          g.lineStyle(6, world.silLight, 0.55);
          g.strokeEllipse(x, y + r * 0.1, r * 3, r * 0.7);
        }
      } else if (world.silhouette === "summit") {
        for (const [x, w, h] of [[0, 170, 260], [150, 210, 320], [330, 140, 230]] as const) {
          g.fillStyle(world.silDark, 1);
          g.fillTriangle(x, 320, x + w * 0.5, 320 - h, x + w, 320);
          // Chrome facet: the whole lit half gleams, final-world flourish.
          g.fillStyle(world.silLight, 0.85);
          g.fillTriangle(x + w * 0.5, 320 - h, x + w * 0.5, 320, x + w * 0.28, 320);
        }
      } else {
        const rocks: Array<[number, number, number]> = [
          [0, 160, 140], [100, 190, 210], [240, 170, 160], [320, 160, 120],
        ];
        for (const [x, w, h] of rocks) {
          g.fillStyle(world.silDark, 1);
          g.fillTriangle(x, 320, x + w * 0.45, 320 - h, x + w, 320);
          g.fillStyle(world.silLight, 0.55);
          g.fillTriangle(x + w * 0.45, 320 - h, x + w * 0.62, 320 - h * 0.55, x + w * 0.3, 320 - h * 0.55);
        }
      }
      g.generateTexture(silKey, 400, 320);
      g.destroy();
    }
    const groundKey = `ground-${world.id}`;
    if (!scene.textures.exists(groundKey)) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(world.groundBase, 1);
      g.fillRect(0, 0, 80, 280);
      g.fillStyle(world.groundGrid, 1);
      g.fillRect(0, 0, 2, 280); // vertical grid line
      g.fillRect(0, 56, 80, 1); // faint horizontals
      g.fillRect(0, 140, 80, 1);
      g.generateTexture(groundKey, 80, 280);
      g.destroy();
    }
}
