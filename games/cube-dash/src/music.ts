import { MusicPlayer } from "@mg/core";
import { isFinaleLevel } from "./logic/runner";
import { worldForLevel } from "./worlds";

/**
 * One lazily created player per world so each 5-level block has its track;
 * finale levels get a hotter +8 BPM variant of the same pattern.
 */
const players = new Map<string, MusicPlayer>();

export function musicForLevel(level: number): MusicPlayer {
  const world = worldForLevel(level);
  const finale = isFinaleLevel(level);
  const key = finale ? `${world.id}:finale` : world.id;
  let player = players.get(key);
  if (!player) {
    player = new MusicPlayer(finale ? { ...world.music, bpm: world.music.bpm + 8 } : world.music);
    players.set(key, player);
  }
  return player;
}

/** Stops whichever world's track is currently playing. */
export function stopAllMusic(): void {
  for (const player of players.values()) player.stop();
}
