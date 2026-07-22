import Phaser from "phaser";
import { MenuScene } from "./scenes/MenuScene";
import { GameScene } from "./scenes/GameScene";

// Rasterize ALL text at device resolution. Canvas text is otherwise drawn at
// 1x and stretched by Scale.FIT, which reads soft on retina/mobile screens.
// Patched once here so every scene (and @mg/ui) gets it; an explicit
// `resolution` in a call site's style still wins via the spread.
const dpr = Math.min(window.devicePixelRatio || 1, 3);
const addText = Phaser.GameObjects.GameObjectFactory.prototype.text;
Phaser.GameObjects.GameObjectFactory.prototype.text = function (
  this: Phaser.GameObjects.GameObjectFactory,
  x: number,
  y: number,
  text: string | string[],
  style?: Phaser.Types.GameObjects.Text.TextStyle,
): Phaser.GameObjects.Text {
  return addText.call(this, x, y, text, { resolution: dpr, ...style });
};

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  width: 720,
  height: 1280,
  backgroundColor: "#12141c",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    // Integer CSS canvas size — avoids the half-pixel blur FIT can produce.
    autoRound: true,
  },
  scene: [MenuScene, GameScene],
});
