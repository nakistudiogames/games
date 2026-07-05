/**
 * Character roster: cosmetic skins with identical physics/hitboxes.
 * Pure data + rules here (unit-testable); Phaser drawing in characterView.ts.
 */

export type CharacterShape = "cube" | "ball" | "diamond";
export type CharacterMouth = "smile" | "angry" | "zap";
/** Animation style of the character's signature aura. */
export type AuraStyle = "pulse" | "flicker" | "rings" | "spin" | "crackle";

export interface CharacterSpec {
  id: string;
  name: string;
  shape: CharacterShape;
  mouth: CharacterMouth;
  /** Unlocked once the player's unlockedLevel reaches this. */
  minLevel: number;
  color: number;
  light: number;
  dark: number;
  face: number;
  trail: readonly number[];
  aura: { color: number; style: AuraStyle };
}

export const CHARACTERS: readonly CharacterSpec[] = [
  {
    id: "dash",
    name: "Dash",
    shape: "cube",
    mouth: "smile",
    minLevel: 1,
    color: 0x26c6da,
    light: 0x9ef3fc,
    dark: 0x0d7d8f,
    face: 0x63e5f5,
    trail: [0x26c6da, 0x4dd0e1, 0xffffff],
    aura: { color: 0x4dd0e1, style: "pulse" },
  },
  {
    id: "blaze",
    name: "Blaze",
    shape: "cube",
    mouth: "angry",
    minLevel: 2,
    color: 0xff7043,
    light: 0xffab91,
    dark: 0xbf360c,
    face: 0xff8a65,
    trail: [0xff7043, 0xffab40, 0xffffff],
    aura: { color: 0xff5722, style: "flicker" },
  },
  {
    id: "orb",
    name: "Orb",
    shape: "ball",
    mouth: "smile",
    minLevel: 3,
    color: 0x66bb6a,
    light: 0xa5d6a7,
    dark: 0x2e7031,
    face: 0x81c784,
    trail: [0x66bb6a, 0xa5d6a7, 0xffffff],
    aura: { color: 0x81c784, style: "rings" },
  },
  {
    id: "prism",
    name: "Prism",
    shape: "diamond",
    mouth: "smile",
    minLevel: 4,
    color: 0xab47bc,
    light: 0xce93d8,
    dark: 0x6a1b7a,
    face: 0xba68c8,
    trail: [0xab47bc, 0xce93d8, 0xffffff],
    aura: { color: 0xce93d8, style: "spin" },
  },
  {
    id: "bolt",
    name: "Bolt",
    shape: "cube",
    mouth: "zap",
    minLevel: 5,
    color: 0xffca28,
    light: 0xfff59d,
    dark: 0xb28704,
    face: 0xffd54f,
    trail: [0xffca28, 0xfff59d, 0xffffff],
    aura: { color: 0xffee58, style: "crackle" },
  },
];

export function characterById(id: string): CharacterSpec {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0]!;
}

export function isCharacterUnlocked(spec: CharacterSpec, unlockedLevel: number): boolean {
  return unlockedLevel >= spec.minLevel;
}
