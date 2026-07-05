import type { MusicPattern } from "@mg/core";

/**
 * Worlds: every 5 levels share a theme — background palette, silhouette
 * style, and music track. Worlds cycle once the list is exhausted.
 */

export const LEVELS_PER_WORLD = 5;

export type SilhouetteStyle = "city" | "crystals" | "rocks";

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
const BB2 = 116.54;
const G4 = 392.0, A4 = 440.0, C5 = 523.25, D5 = 587.33, E5 = 659.25, F5 = 698.46;
const G5 = 783.99, A5 = 880.0, BB5 = 932.33, B5 = 987.77, C6 = 1046.5, DB6 = 1108.73;

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
];

/** 1-based world number for a level (world 1 = levels 1-5, ...). */
export function worldNumberForLevel(level: number): number {
  return Math.floor((Math.max(1, level) - 1) / LEVELS_PER_WORLD) + 1;
}

export function worldForLevel(level: number): WorldTheme {
  return WORLDS[(worldNumberForLevel(level) - 1) % WORLDS.length]!;
}
