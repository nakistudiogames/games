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
  | "spires"
  | "arches"
  | "pines"
  | "stacks"
  | "thunderheads"
  | "citadel"
  | "coral"
  | "ribs"
  | "circuits"
  | "obelisks"
  | "flares"
  | "planets"
  | "summit";

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
const BB2 = 116.54, CS3 = 138.59, EB2 = 77.78, AB2 = 103.83;
const G4 = 392.0, A4 = 440.0, C5 = 523.25, D5 = 587.33, E5 = 659.25, F5 = 698.46;
const G5 = 783.99, A5 = 880.0, BB5 = 932.33, B5 = 987.77, C6 = 1046.5, DB6 = 1108.73;
const FS5 = 739.99, D6 = 1174.66, EB5 = 622.25, AB5 = 830.61, E6 = 1318.51;

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
  {
    id: "mirage",
    name: "Mirror Mirage",
    skyTop: 0x1a1a2e,
    skyBottomA: 0x4a4a6b,
    skyBottomB: 0x33334f,
    haze: 0x4a4a6b,
    silDark: 0x2b2b45,
    silLight: 0x4d4d75,
    silhouette: "arches",
    groundBase: 0x1e1e30,
    groundGrid: 0x3d3d5c,
    // Whole-tone shimmer, 120 BPM — rootless and glassy, nothing resolves:
    // the mirror-world feeling.
    music: {
      bpm: 120,
      bass: [C3, null, null, D2, null, null, E2, null, C3, null, null, D2, null, E2, null, null],
      lead: [C5, null, D5, null, E5, null, FS5, null, AB5, null, FS5, null, E5, null, D5, null],
      kick: [true, false, false, false, false, false, true, false, true, false, false, false, false, false, true, false],
      hat: [false, false, true, false, true, false, false, true, false, false, true, false, true, false, false, true],
    },
  },
  {
    id: "verdant",
    name: "Verdant Hollow",
    skyTop: 0x07160a,
    skyBottomA: 0x1c4423,
    skyBottomB: 0x123018,
    haze: 0x1c4423,
    silDark: 0x11301a,
    silLight: 0x235232,
    silhouette: "pines",
    groundBase: 0x0b2010,
    groundGrid: 0x1e4a2a,
    // G-major forest lilt, 116 BPM — a gentle 3-against-4 skip in the lead.
    music: {
      bpm: 116,
      bass: [G2, null, null, D3, null, null, C3, null, G2, null, null, B2, null, D3, null, null],
      lead: [G5, null, null, B5, null, null, D5, null, E5, null, null, D5, null, G5, null, A5],
      kick: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false],
      hat: [false, false, true, false, false, true, false, false, false, false, true, false, false, true, false, true],
    },
  },
  {
    id: "foundry",
    name: "Rust Foundry",
    skyTop: 0x1c1008,
    skyBottomA: 0x54301c,
    skyBottomB: 0x3a2010,
    haze: 0x54301c,
    silDark: 0x2e1c10,
    silLight: 0x543820,
    silhouette: "stacks",
    groundBase: 0x241407,
    groundGrid: 0x4d2e14,
    // Industrial E-minor stomp, 140 BPM — piston kicks on the offbeat too.
    music: {
      bpm: 140,
      bass: [E2, E2, null, G2, E2, null, A2, null, E2, E2, null, B2, null, A2, G2, null],
      lead: [E5, null, null, G5, null, B5, null, null, D6, null, B5, null, A5, null, G5, null],
      kick: [true, false, true, false, true, false, false, true, true, false, true, false, true, false, true, false],
      hat: [false, true, false, true, false, true, true, false, false, true, false, true, false, true, false, true],
    },
  },
  {
    id: "storm",
    name: "Storm Shelf",
    skyTop: 0x0d1420,
    skyBottomA: 0x2c3e58,
    skyBottomB: 0x1d2b40,
    haze: 0x2c3e58,
    silDark: 0x1a2536,
    silLight: 0x32465e,
    silhouette: "thunderheads",
    groundBase: 0x111a28,
    groundGrid: 0x2c3e58,
    // D-minor squall, 128 BPM — lead stabs land off the beat like gusts.
    music: {
      bpm: 128,
      bass: [D2, null, D2, null, F2, null, F2, null, A2, null, A2, null, C3, null, BB2, A2],
      lead: [null, D5, null, null, F5, null, A5, null, null, E5, null, C6, null, A5, null, F5],
      kick: [true, false, false, false, true, false, false, true, true, false, false, false, true, false, true, false],
      hat: [false, false, true, true, false, false, true, false, false, false, true, true, false, true, false, true],
    },
  },
  {
    id: "citadel",
    name: "Inverted Citadel",
    skyTop: 0x1c1030,
    skyBottomA: 0x3c2560,
    skyBottomB: 0x2a1a48,
    haze: 0x3c2560,
    silDark: 0x281a40,
    silLight: 0x453064,
    silhouette: "citadel",
    groundBase: 0x1a1030,
    groundGrid: 0x382458,
    // Solemn A-harmonic-minor procession, 110 BPM — the raised G# leading
    // tone gives the gravity-flip world its unsettled ceremony.
    music: {
      bpm: 110,
      bass: [A2, null, null, null, E2, null, null, null, F2, null, null, null, AB2, null, E2, null],
      lead: [A4, null, C5, null, E5, null, null, AB5, A5, null, E5, null, C5, null, AB5, null],
      kick: [true, false, false, false, false, false, false, false, true, false, false, false, true, false, false, false],
      hat: [false, false, false, true, false, false, true, false, false, false, false, true, false, false, true, false],
    },
  },
  {
    id: "coral",
    name: "Coral Shallows",
    skyTop: 0x043040,
    skyBottomA: 0x0e6b7a,
    skyBottomB: 0x0a4f60,
    haze: 0x0e6b7a,
    silDark: 0x0a4552,
    silLight: 0x15707f,
    silhouette: "coral",
    groundBase: 0x073542,
    groundGrid: 0x11616e,
    // Sunny F-major bounce, 122 BPM — steel-drum-flavored syncopation.
    music: {
      bpm: 122,
      bass: [F2, null, C3, null, F2, null, A2, null, BB2, null, F2, null, C3, null, A2, null],
      lead: [F5, null, A5, C6, null, A5, null, G5, null, F5, null, C6, null, null, G5, A5],
      kick: [true, false, false, true, false, false, true, false, true, false, false, true, false, false, true, false],
      hat: [false, true, false, false, true, false, false, true, false, true, false, false, true, false, false, true],
    },
  },
  {
    id: "bones",
    name: "Bone Wastes",
    skyTop: 0x191410,
    skyBottomA: 0x4a3f30,
    skyBottomB: 0x332b20,
    haze: 0x4a3f30,
    silDark: 0x2c261c,
    silLight: 0x4d4434,
    silhouette: "ribs",
    groundBase: 0x1e1912,
    groundGrid: 0x413828,
    // Sparse D-Phrygian dirge, 100 BPM — the flat second (Eb) hangs like
    // dust over long empty beats.
    music: {
      bpm: 100,
      bass: [D2, null, null, null, null, null, EB2, null, D2, null, null, null, A2, null, null, null],
      lead: [D5, null, null, null, EB5, null, null, null, F5, null, D5, null, null, A4, null, null],
      kick: [true, false, false, false, false, false, false, false, true, false, false, false, false, false, true, false],
      hat: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
    },
  },
  {
    id: "vault",
    name: "Neon Vault",
    skyTop: 0x050d0a,
    skyBottomA: 0x0d3326,
    skyBottomB: 0x092418,
    haze: 0x0d3326,
    silDark: 0x0a231a,
    silLight: 0x144833,
    silhouette: "circuits",
    groundBase: 0x06170f,
    groundGrid: 0x0f3d2a,
    // C-minor synthwave, 138 BPM — straight-eighth bass pulse under a
    // filtered arpeggio.
    music: {
      bpm: 138,
      bass: [C3, C3, null, C3, G2, null, C3, null, BB2, BB2, null, BB2, F2, null, G2, null],
      lead: [C6, null, G5, null, EB5, null, G5, null, BB5, null, G5, null, EB5, null, C6, null],
      kick: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false],
      hat: [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, true],
    },
  },
  {
    id: "obsidian",
    name: "Obsidian Reach",
    skyTop: 0x0d0716,
    skyBottomA: 0x261440,
    skyBottomB: 0x180c2c,
    haze: 0x261440,
    silDark: 0x1a0f2c,
    silLight: 0x2f1c4e,
    silhouette: "obelisks",
    groundBase: 0x120a20,
    groundGrid: 0x281644,
    // Hollow E-minor drift, 104 BPM — wide intervals, lots of dark air.
    music: {
      bpm: 104,
      bass: [E2, null, null, null, B2, null, null, null, C3, null, null, null, G2, null, B2, null],
      lead: [E5, null, null, B5, null, null, null, G5, null, null, C6, null, null, B5, null, null],
      kick: [true, false, false, false, false, false, true, false, true, false, false, false, false, false, false, false],
      hat: [false, false, true, false, false, false, false, true, false, false, true, false, false, false, true, false],
    },
  },
  {
    id: "forge",
    name: "Solar Forge",
    skyTop: 0x230d02,
    skyBottomA: 0x7a3a08,
    skyBottomB: 0x4f2405,
    haze: 0x7a3a08,
    silDark: 0x3a1e08,
    silLight: 0x6b3d14,
    silhouette: "flares",
    groundBase: 0x261204,
    groundGrid: 0x5c3210,
    // Blazing A-mixolydian charge, 148 BPM — the flat 7th (G) keeps it
    // roaring forward without ever settling.
    music: {
      bpm: 148,
      bass: [A2, null, A2, G2, A2, null, D3, null, A2, null, A2, G2, E2, null, G2, null],
      lead: [A5, null, DB6, null, E5, null, D6, DB6, null, A5, null, G5, null, E5, G5, null],
      kick: [true, false, false, true, true, false, false, false, true, false, false, true, true, false, true, false],
      hat: [false, true, false, false, false, true, true, false, false, true, false, false, false, true, false, true],
    },
  },
  {
    id: "nebula",
    name: "Void Nebula",
    skyTop: 0x0a0514,
    skyBottomA: 0x2e0f3e,
    skyBottomB: 0x1c0a2c,
    haze: 0x2e0f3e,
    silDark: 0x1e0e30,
    silLight: 0x3a1e55,
    silhouette: "planets",
    groundBase: 0x120826,
    groundGrid: 0x301848,
    // Weightless F-lydian float, 96 BPM — the raised 4th (B) suspends
    // everything mid-air; the slowest track in the game.
    music: {
      bpm: 96,
      bass: [F2, null, null, null, C3, null, null, null, G2, null, null, null, A2, null, null, null],
      lead: [F5, null, null, A5, null, null, B5, null, null, C6, null, null, G5, null, E5, null],
      kick: [true, false, false, false, false, false, false, false, true, false, false, false, false, false, false, false],
      hat: [false, false, false, true, false, false, false, false, false, false, true, false, false, false, false, true],
    },
  },
  {
    id: "apex",
    name: "Chrome Apex",
    skyTop: 0x0a1420,
    skyBottomA: 0x1c4a5e,
    skyBottomB: 0x123244,
    haze: 0x1c4a5e,
    silDark: 0x14303e,
    silLight: 0x265264,
    silhouette: "summit",
    groundBase: 0x0d2029,
    groundGrid: 0x1c4453,
    // C-major victory sprint, 160 BPM — the fastest, brightest track,
    // saved for the final world.
    music: {
      bpm: 160,
      bass: [C3, null, C3, null, G2, null, G2, null, A2, null, A2, null, F2, null, G2, G2],
      lead: [C6, null, G5, C6, null, E6, null, D6, C6, null, G5, null, E5, G5, C6, null],
      kick: [true, false, false, false, true, false, true, false, true, false, false, false, true, false, true, true],
      hat: [false, true, true, false, false, true, false, true, false, true, true, false, false, true, false, true],
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
