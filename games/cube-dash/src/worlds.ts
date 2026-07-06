import type { MusicPattern } from "@mg/core";

/**
 * Worlds: every 5 levels share a theme — background palette, silhouette
 * style, and music track. Worlds cycle once the list is exhausted.
 */

import { LEVELS_PER_WORLD } from "./logic/runner";
export { LEVELS_PER_WORLD } from "./logic/runner";

export type SilhouetteStyle =
  | "city"
  | "crystals"
  | "rocks"
  | "peaks"
  | "mushrooms"
  | "ruins"
  | "tendrils"
  | "spires";

export interface WorldTheme {
  id: string;
  name: string;
  skyTop: number;
  skyBottomA: number;
  skyBottomB: number;
  haze: number;
  silDark: number;
  silLight: number;
  silhouette: SilhouetteStyle;
  groundBase: number;
  groundGrid: number;
  music: MusicPattern;
}

// Note frequencies (Hz)
const E2 = 82.41, G2 = 98.0, A2 = 110.0, B2 = 123.47, C3 = 130.81, D3 = 146.83;
const D2 = 73.42, F2 = 87.31;
const BB2 = 116.54, CS3 = 138.59;
const G4 = 392.0, A4 = 440.0, C5 = 523.25, D5 = 587.33, E5 = 659.25, F5 = 698.46;
const G5 = 783.99, A5 = 880.0, BB5 = 932.33, B5 = 987.77, C6 = 1046.5, DB6 = 1108.73;
const FS5 = 739.99, D6 = 1174.66;

export const WORLDS: readonly WorldTheme[] = [
  {
    id: "city",
    name: "Neon City",
    skyTop: 0x0b0e24,
    skyBottomA: 0x2a1650,
    skyBottomB: 0x1a1240,
    haze: 0x2a1650,
    silDark: 0x181f38,
    silLight: 0x232c4e,
    silhouette: "city",
    groundBase: 0x10142a,
    groundGrid: 0x1c2547,
    // Driving A-minor electro, 132 BPM.
    music: {
      bpm: 132,
      bass: [A2, null, A2, null, C3, null, C3, null, G2, null, G2, null, E2, null, E2, C3],
      lead: [A4, null, C5, null, E5, null, A5, null, G4, null, C5, null, E5, null, C5, A4],
      kick: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false],
      hat: [false, false, true, false, false, false, true, false, false, false, true, false, false, false, true, true],
    },
  },
  {
    id: "caves",
    name: "Crystal Caves",
    skyTop: 0x061a1c,
    skyBottomA: 0x0d3a3f,
    skyBottomB: 0x0a2d38,
    haze: 0x0d3a3f,
    silDark: 0x0f2f33,
    silLight: 0x1c4d52,
    silhouette: "crystals",
    groundBase: 0x0a2023,
    groundGrid: 0x14424a,
    // Airy D-minor drift, 112 BPM — sparser and calmer.
    music: {
      bpm: 112,
      bass: [D2, null, null, null, F2, null, null, null, A2, null, null, null, F2, null, D2, null],
      lead: [D5, null, null, F5, null, null, A5, null, null, E5, null, null, F5, null, null, null],
      kick: [true, false, false, false, false, false, false, false, true, false, false, false, false, false, false, false],
      hat: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
    },
  },
  {
    id: "magma",
    name: "Magma Core",
    skyTop: 0x1a0705,
    skyBottomA: 0x571e0a,
    skyBottomB: 0x3a1206,
    haze: 0x571e0a,
    silDark: 0x2b100a,
    silLight: 0x572317,
    silhouette: "rocks",
    groundBase: 0x200b06,
    groundGrid: 0x4d2012,
    // Evil E-Phrygian dirge, 138 BPM: half-step (E→F) grinding in the bass,
    // tritone (Bb) stabs, and a diminished lead (E-G-Bb-Db) with a chromatic
    // descending tail — the classic horror/menace vocabulary.
    music: {
      bpm: 138,
      bass: [E2, null, E2, F2, E2, null, BB2, null, E2, null, E2, F2, C3, null, BB2, null],
      lead: [E5, null, null, BB5, null, null, G5, null, F5, null, null, DB6, null, C6, B5, null],
      kick: [true, false, false, false, true, false, false, true, true, false, false, false, true, false, true, false],
      hat: [false, false, true, false, false, false, true, false, false, false, true, false, false, true, false, true],
    },
  },
  {
    id: "frost",
    name: "Frost Ridge",
    skyTop: 0x081226,
    skyBottomA: 0x1b3a5e,
    skyBottomB: 0x12294a,
    haze: 0x1b3a5e,
    silDark: 0x16283e,
    silLight: 0x2a4a70,
    silhouette: "peaks",
    groundBase: 0x0d1b2e,
    groundGrid: 0x1e3c5c,
    // Glassy C-major bells, 118 BPM — crisp mountain air with maj7 sparkle.
    music: {
      bpm: 118,
      bass: [C3, null, null, null, G2, null, null, null, A2, null, null, null, E2, null, G2, null],
      lead: [E5, null, G5, null, B5, null, D5, null, C5, null, E5, null, G5, null, null, B5],
      kick: [true, false, false, false, false, false, true, false, true, false, false, false, false, false, true, false],
      hat: [false, false, true, false, true, false, false, true, false, false, true, false, true, false, false, true],
    },
  },
  {
    id: "swamp",
    name: "Toxic Swamp",
    skyTop: 0x0a1408,
    skyBottomA: 0x1e4016,
    skyBottomB: 0x14300f,
    haze: 0x1e4016,
    silDark: 0x14290f,
    silLight: 0x2c521e,
    silhouette: "mushrooms",
    groundBase: 0x0e1f0a,
    groundGrid: 0x2a5217,
    // Squelchy G-Dorian funk, 126 BPM — syncopated bass bubbling under
    // off-beat lead stabs.
    music: {
      bpm: 126,
      bass: [G2, null, G2, null, BB2, null, G2, F2, null, F2, null, null, C3, null, BB2, G2],
      lead: [null, BB5, null, G5, null, null, F5, null, D5, null, F5, G5, null, BB5, null, C6],
      kick: [true, false, false, true, false, false, true, false, false, true, false, false, true, false, false, false],
      hat: [false, false, true, false, false, true, false, false, true, false, false, true, false, false, true, true],
    },
  },
  {
    id: "dunes",
    name: "Gilded Dunes",
    skyTop: 0x241105,
    skyBottomA: 0x6b3d10,
    skyBottomB: 0x47280a,
    haze: 0x6b3d10,
    silDark: 0x33200a,
    silLight: 0x5c3d14,
    silhouette: "ruins",
    groundBase: 0x241605,
    groundGrid: 0x4d3410,
    // A-Phrygian-dominant caravan, 124 BPM: the b2 (Bb) against C# gives the
    // classic desert scale its shimmer.
    music: {
      bpm: 124,
      bass: [A2, null, A2, BB2, A2, null, E2, null, A2, null, A2, BB2, D3, null, CS3, A2],
      lead: [A5, null, BB5, A5, null, DB6, null, null, F5, null, E5, null, DB6, null, BB5, null],
      kick: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, true, false],
      hat: [false, false, true, false, false, false, true, false, false, true, false, false, true, false, false, true],
    },
  },
  {
    id: "abyss",
    name: "Deep Abyss",
    skyTop: 0x03060f,
    skyBottomA: 0x0c1f3d,
    skyBottomB: 0x081530,
    haze: 0x0c1f3d,
    silDark: 0x0a1526,
    silLight: 0x18304e,
    silhouette: "tendrils",
    groundBase: 0x050d1a,
    groundGrid: 0x12294a,
    // Slow E-Aeolian pressure, 96 BPM — the sparsest track: long bass pedals
    // and a lead that surfaces only to sink again.
    music: {
      bpm: 96,
      bass: [E2, null, null, null, null, null, G2, null, A2, null, null, null, B2, null, A2, null],
      lead: [E5, null, null, null, G5, null, null, E5, null, null, D5, null, C6, null, B5, null],
      kick: [true, false, false, false, false, false, false, false, true, false, false, false, false, false, false, false],
      hat: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, true, false],
    },
  },
  {
    id: "aurora",
    name: "Aurora Summit",
    skyTop: 0x140b26,
    skyBottomA: 0x46165a,
    skyBottomB: 0x2c1048,
    haze: 0x46165a,
    silDark: 0x241436,
    silLight: 0x40255c,
    silhouette: "spires",
    groundBase: 0x180e28,
    groundGrid: 0x38204f,
    // D-major sprint, 150 BPM — the fastest, brightest track: driving
    // double-hit bass and a soaring lead for the (current) final world.
    music: {
      bpm: 150,
      bass: [D2, null, D2, D2, null, D2, null, null, G2, null, G2, null, A2, null, B2, null],
      lead: [D5, null, FS5, null, A5, null, B5, A5, G5, null, FS5, null, E5, FS5, D6, null],
      kick: [true, false, false, false, true, false, false, false, true, false, true, false, true, false, false, true],
      hat: [false, true, false, true, false, true, false, true, false, true, false, true, false, true, true, true],
    },
  },
];

/** 1-based world number for a level (world 1 = levels 1-5, ...). */
export function worldNumberForLevel(level: number): number {
  return Math.floor((Math.max(1, level) - 1) / LEVELS_PER_WORLD) + 1;
}

export function worldForLevel(level: number): WorldTheme {
  return WORLDS[(worldNumberForLevel(level) - 1) % WORLDS.length]!;
}
