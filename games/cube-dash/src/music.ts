import { MusicPlayer } from "@mg/core";

// Note frequencies (Hz)
const A2 = 110.0;
const C3 = 130.81;
const E2 = 82.41;
const G2 = 98.0;
const A4 = 440.0;
const C5 = 523.25;
const E5 = 659.25;
const G4 = 392.0;
const A5 = 880.0;

/** Driving A-minor loop in the Geometry Dash electro style, 132 BPM. */
export const music = new MusicPlayer({
  bpm: 132,
  //     1     .     2     .     3     .     4     .
  bass: [A2, null, A2, null, C3, null, C3, null, G2, null, G2, null, E2, null, E2, C3],
  lead: [A4, null, C5, null, E5, null, A5, null, G4, null, C5, null, E5, null, C5, A4],
  kick: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false],
  hat: [false, false, true, false, false, false, true, false, false, false, true, false, false, false, true, true],
});
