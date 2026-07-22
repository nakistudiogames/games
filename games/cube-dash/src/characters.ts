/**
 * Character roster: cosmetic skins with identical physics/hitboxes.
 * Pure data + rules here (unit-testable); Phaser drawing in characterView.ts.
 *
 * ONE character per world, themed to it, unlocked by CLEARING that world
 * (unlockedLevel reaches world*5 + 1). Dash is the world-0 starter. No two
 * characters share the same (shape, aura style, trail style) identity
 * triple — palettes + triples keep every skin distinct (tested).
 */

export type CharacterShape = "cube" | "ball" | "diamond";
export type CharacterMouth = "smile" | "angry" | "zap";
/** Animation style of the character's signature aura. */
export type AuraStyle = "pulse" | "flicker" | "rings" | "spin" | "crackle";
/**
 * Visual style of the running trail: streaks = crisp afterimages; embers =
 * rising fire motes; bubbles = drifting rings that grow and pop; glints =
 * twinkling gem shards; sparks = fast jittery electric static.
 */
export type TrailStyle = "streaks" | "embers" | "bubbles" | "glints" | "sparks";

export interface CharacterSpec {
  id: string;
  name: string;
  shape: CharacterShape;
  mouth: CharacterMouth;
  /** World whose CLEAR unlocks this skin (0 = starter, always unlocked). */
  world: number;
  /** Unlocked once the player's unlockedLevel reaches this (world*5 + 1). */
  minLevel: number;
  color: number;
  light: number;
  dark: number;
  face: number;
  trail: readonly number[];
  trailStyle: TrailStyle;
  aura: { color: number; style: AuraStyle };
}

const c = (
  id: string,
  name: string,
  shape: CharacterShape,
  mouth: CharacterMouth,
  world: number,
  colors: [color: number, light: number, dark: number, face: number],
  trail: readonly number[],
  trailStyle: TrailStyle,
  aura: { color: number; style: AuraStyle },
): CharacterSpec => ({
  id,
  name,
  shape,
  mouth,
  world,
  minLevel: world === 0 ? 1 : world * 5 + 1,
  color: colors[0],
  light: colors[1],
  dark: colors[2],
  face: colors[3],
  trail,
  trailStyle,
  aura,
});

export const CHARACTERS: readonly CharacterSpec[] = [
  // Starter.
  c("dash", "Dash", "cube", "smile", 0,
    [0x26c6da, 0x9ef3fc, 0x0d7d8f, 0x63e5f5],
    [0x26c6da, 0x4dd0e1, 0xffffff], "streaks", { color: 0x4dd0e1, style: "pulse" }),
  // W1 Neon City: magenta signage glow.
  c("pixel", "Pixel", "cube", "smile", 1,
    [0xec407a, 0xff80ab, 0x880e4f, 0xf06292],
    [0xec407a, 0xff80ab, 0x00e5ff], "glints", { color: 0xff4081, style: "pulse" }),
  // W2 Crystal Caves: Orb takes on the cave-glow mantle.
  c("orb", "Orb", "ball", "smile", 2,
    [0x66bb6a, 0xa5d6a7, 0x2e7031, 0x81c784],
    [0x66bb6a, 0xa5d6a7, 0xffffff], "bubbles", { color: 0x81c784, style: "rings" }),
  // W3 Magma Core: Blaze, forged in it.
  c("blaze", "Blaze", "cube", "angry", 3,
    [0xff7043, 0xffab91, 0xbf360c, 0xff8a65],
    [0xff7043, 0xffab40, 0xffffff], "embers", { color: 0xff5722, style: "flicker" }),
  // W4 Frost Ridge: glacial facet.
  c("frost", "Frost", "diamond", "smile", 4,
    [0x90caf9, 0xe1f5fe, 0x1565c0, 0xbbdefb],
    [0x90caf9, 0xe1f5fe, 0xffffff], "bubbles", { color: 0xb3e5fc, style: "rings" }),
  // W5 Toxic Swamp: fungal glow.
  c("spore", "Spore", "ball", "angry", 5,
    [0xc0ca33, 0xe6ee9c, 0x616a12, 0xd4e157],
    [0xc0ca33, 0xab47bc, 0xe6ee9c], "bubbles", { color: 0x9ccc65, style: "flicker" }),
  // W6 Gilded Dunes: sun-struck relic.
  c("scarab", "Scarab", "cube", "smile", 6,
    [0xd4af37, 0xffe082, 0x8a6d1a, 0xe6c65c],
    [0xd4af37, 0xffe082, 0xffffff], "glints", { color: 0xffd54f, style: "spin" }),
  // W7 Deep Abyss: pressure-proof lantern.
  c("gulp", "Gulp", "ball", "smile", 7,
    [0x3949ab, 0x7986cb, 0x141c54, 0x5c6bc0],
    [0x3949ab, 0x40c4ff, 0x7986cb], "streaks", { color: 0x40c4ff, style: "rings" }),
  // W8 Aurora Summit: Prism, refracting the lights.
  c("prism", "Prism", "diamond", "smile", 8,
    [0xab47bc, 0xce93d8, 0x6a1b7a, 0xba68c8],
    [0xab47bc, 0xce93d8, 0xffffff], "glints", { color: 0xce93d8, style: "spin" }),
  // W9 Mirror Mirage: pure chrome.
  c("mirage", "Mirage", "diamond", "smile", 9,
    [0xcfd8dc, 0xffffff, 0x78909c, 0xeceff1],
    [0xcfd8dc, 0xffffff, 0x80deea], "streaks", { color: 0xeceff1, style: "spin" }),
  // W10 Volt Grid: Bolt, straight off the wires.
  c("bolt", "Bolt", "cube", "zap", 10,
    [0xffca28, 0xfff59d, 0xb28704, 0xffd54f],
    [0xffca28, 0xfff59d, 0xffffff], "sparks", { color: 0xffee58, style: "crackle" }),
  // W11 Rust Foundry: still cooling.
  c("ingot", "Ingot", "cube", "angry", 11,
    [0xbf5b25, 0xffab40, 0x6d2f10, 0xd8763a],
    [0xbf5b25, 0xffab40, 0xff7043], "sparks", { color: 0xffab40, style: "flicker" }),
  // W12 Storm Shelf: a raincloud with opinions.
  c("nimbus", "Nimbus", "ball", "angry", 12,
    [0x78909c, 0xcfd8dc, 0x37474f, 0x90a4ae],
    [0x78909c, 0xfff176, 0xcfd8dc], "sparks", { color: 0xfff176, style: "crackle" }),
  // W13 Inverted Citadel: keystone of the upside-down keep.
  c("spire", "Spire", "diamond", "smile", 13,
    [0x7e57c2, 0xb39ddb, 0x3f2b78, 0x9575cd],
    [0x7e57c2, 0xb39ddb, 0xffffff], "streaks", { color: 0xb388ff, style: "pulse" }),
  // W14 Coral Shallows: reef-born.
  c("pearl", "Pearl", "ball", "smile", 14,
    [0xf48fb1, 0xffd1dc, 0xad2f5e, 0xf8bbd0],
    [0xf48fb1, 0x80deea, 0xffd1dc], "glints", { color: 0xf8bbd0, style: "rings" }),
  // W15 Bone Wastes: cheerfully calcified.
  c("marrow", "Marrow", "cube", "zap", 15,
    [0xd7ccc8, 0xf5f0ee, 0x6d5f5b, 0xe8e0dd],
    [0xd7ccc8, 0xf5f0ee, 0x8d6e63], "streaks", { color: 0xbcaaa4, style: "flicker" }),
  // W16 Neon Vault: living motherboard.
  c("cipher", "Cipher", "cube", "smile", 16,
    [0x00bfa5, 0x69f0ae, 0x00574b, 0x1de9b6],
    [0x00bfa5, 0x69f0ae, 0xffffff], "glints", { color: 0x69f0ae, style: "crackle" }),
  // W17 Obsidian Reach: volcanic glass edge.
  c("shard", "Shard", "diamond", "angry", 17,
    [0x455a64, 0x9575cd, 0x121a1e, 0x546e7a],
    [0x455a64, 0x9575cd, 0xb388ff], "glints", { color: 0x7e57c2, style: "flicker" }),
  // W18 Solar Forge: a pocket star.
  c("sol", "Sol", "ball", "zap", 18,
    [0xffb300, 0xfff8e1, 0xa85e00, 0xffd54f],
    [0xffb300, 0xff7043, 0xfff8e1], "embers", { color: 0xffe082, style: "flicker" }),
  // W19 Void Nebula: stardust held together by charm. (Not "nova" — that
  // name belongs to the L100 air hazard in the guide.)
  c("quasar", "Quasar", "ball", "smile", 19,
    [0x9c27b0, 0xea80fc, 0x4a0e57, 0xce93d8],
    [0x9c27b0, 0xea80fc, 0x80d8ff], "bubbles", { color: 0xea80fc, style: "spin" }),
  // W20 Chrome Apex: the summit itself.
  c("apex", "Apex", "diamond", "zap", 20,
    [0xb0bec5, 0xffffff, 0x455a64, 0xe0e6ea],
    [0xb0bec5, 0xffffff, 0x00e5ff], "streaks", { color: 0xffffff, style: "crackle" }),
];

export function characterById(id: string): CharacterSpec {
  return CHARACTERS.find((ch) => ch.id === id) ?? CHARACTERS[0]!;
}

export function isCharacterUnlocked(spec: CharacterSpec, unlockedLevel: number): boolean {
  return unlockedLevel >= spec.minLevel;
}
