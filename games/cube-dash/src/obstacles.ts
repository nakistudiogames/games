import type { ObstacleKind } from "./logic/runner";

/**
 * Encyclopedia entries — pure data, no Phaser (drawing lives in
 * obstacleView.ts). Record<ObstacleKind, …> makes the compiler demand an
 * entry for every kind, and tests keep names/blurbs non-empty: adding an
 * obstacle without its encyclopedia page fails the build.
 */
export interface ObstacleInfo {
  name: string;
  /** One-liner strategy tip shown in the encyclopedia. */
  blurb: string;
}

export const OBSTACLE_INFO: Record<ObstacleKind, ObstacleInfo> = {
  spike: {
    name: "Spike",
    blurb: "Sharp and simple — one clean jump clears it. Watch for doubles and triples at speed.",
  },
  block: {
    name: "Block",
    blurb: "Hitting the side is fatal, but the top is solid ground — hop over it or land on it.",
  },
  saw: {
    name: "Buzzsaw",
    blurb: "A spinning blade with a round edge. Jump it clean — grazes that miss the disc are forgiven.",
  },
  pit: {
    name: "Lava Trench",
    blurb: "Harmless in the air, lethal to touch down in. Commit to the jump and clear the far lip.",
  },
  swing: {
    name: "Swing Mine",
    blurb: "Bobs up and down as it scrolls. Jump over it when it hangs low, run under when it rides high.",
  },
  laser: {
    name: "Plasma Pylon",
    blurb: "Thin, tall, and always on — the pulse is just for show. Jump late and precise.",
  },
  geyser: {
    name: "Flame Geyser",
    blurb: "Erupts on a fixed rhythm. Walk through the lull, or jump the column mid-eruption.",
  },
  tentacle: {
    name: "Abyssal Tentacle",
    blurb: "It sways as it approaches — aim your jump at where it will be, not where it is.",
  },
  arc: {
    name: "Tesla Arc",
    blurb: "A wide, low lightning span with nothing safe inside. One full-commitment jump, no hesitation.",
  },
};
