import type { BoostKind, ObstacleKind, PowerUpKind, TrackZoneKind } from "./logic/runner";

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
  phantom: {
    name: "Phantom Shard",
    blurb: "A crystal that phases between solid and ghost. Walk through the shimmer — jump it when it hardens.",
  },
  vine: {
    name: "Lashing Vine",
    blurb: "Its reach rises and falls as you approach. Time your jump for the dip, or clear it at full stretch.",
  },
  gear: {
    name: "Rogue Gear",
    blurb: "A cog that patrols back and forth along the track. Jump the whole patrol path, not just the cog.",
  },
  gate: {
    name: "Storm Gate",
    blurb: "Twin energy bars with a gap between. Don't jump over — thread the jump THROUGH the window.",
  },
  crusher: {
    name: "Crusher Slab",
    blurb: "A toothed slab bobbing over the track. Duck under it when it rides high, hop it when it slams low.",
  },
  urchin: {
    name: "Reef Urchin",
    blurb: "A spiked ball floating at head height. Too low to run under — commit to a clean, high jump.",
  },
  talon: {
    name: "Grave Talon",
    blurb: "Watch the cracked mound: claws erupt on a rhythm. Cross in the lull, or leap the outstretched bones.",
  },
  drone: {
    name: "Sentry Drone",
    blurb: "It drifts and hovers but never dips low — hold your nerve and run straight underneath.",
  },
  obelisk: {
    name: "Obsidian Monolith",
    blurb: "The tallest solid on any track. A late, maximum-height jump clears it — barely.",
  },
  flare: {
    name: "Solar Flare",
    blurb: "A long ribbon of fire hugging the ground. The widest jump in the game — take off at the very edge.",
  },
  comet: {
    name: "Comet Fall",
    blurb: "It streaks down from the sky ahead of you and lands on the track. Treat the landed rock as a hurdle.",
  },
  reaper: {
    name: "Chrome Reaper",
    blurb: "A scythe that sweeps the track in pulses. The post never moves — the blade decides your timing.",
  },
};

// The guide also covers the friendly side of the track. Same Record trick:
// the compiler demands an entry for every kind, tests reject empty ones.

export const POWERUP_INFO: Record<PowerUpKind, ObstacleInfo> = {
  doubleJump: {
    name: "Double Jump",
    blurb: "Ten seconds of one extra jump in mid-air, recharged every time you land. Save it for the layered stuff.",
  },
  shield: {
    name: "Shield",
    blurb: "For fifteen seconds, one fatal hit shatters the shield instead of you — then you just keep running.",
  },
  slowmo: {
    name: "Slow-Mo",
    blurb: "The whole world drops to 85% speed for six seconds. Breathe, read the pattern, react.",
  },
};

export const BOOST_INFO: Record<BoostKind, ObstacleInfo> = {
  pad: {
    name: "Launch Pad",
    blurb: "Run over it to rocket into a jump half again higher than normal. It only fires when the track ahead is clear.",
  },
  strip: {
    name: "Dash Strip",
    blurb: "A burst of speed for the next stretch — your jumps carry further while the rush lasts.",
  },
};

export const ZONE_INFO: Record<TrackZoneKind, ObstacleInfo> = {
  mirror: {
    name: "Mirror Gate",
    blurb: "Between these pillars the view flips and you run the other way. The track itself never changes — trust your timing.",
  },
  flip: {
    name: "Gravity Gate",
    blurb: "Between these pillars gravity inverts: you run the ceiling and jump downward until the exit gate.",
  },
};
