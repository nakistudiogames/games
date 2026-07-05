import { MusicPlayer } from "@mg/core";
import { worldForLevel } from "./worlds";

/** One lazily created player per world so each 5-level block has its track. */
const players = new Map<string, MusicPlayer>();

export function musicForLevel(level: number): MusicPlayer {
  const world = worldForLevel(level);
  let player = players.get(world.id);
  if (!player) {
    player = new MusicPlayer(world.music);
    players.set(world.id, player);
  }
  return player;
}

/** Stops whichever world's track is currently playing. */
export function stopAllMusic(): void {
  for (const player of players.values()) player.stop();
}
