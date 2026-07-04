import type { Rng } from "@mg/core";

export const GRID_SIZE = 4;

export type Direction = "up" | "down" | "left" | "right";

/** One tile's journey during a move, in grid coordinates. */
export interface TileMove {
  fromR: number;
  fromC: number;
  toR: number;
  toC: number;
  /** True when this tile merged into the tile already at the destination. */
  merged: boolean;
}

export interface MoveResult {
  /** False when the swipe changed nothing (no tiles slid or merged). */
  moved: boolean;
  /** Score gained: the sum of the values created by merges. */
  gained: number;
  moves: TileMove[];
  /** Cells that contain a freshly merged (doubled) tile. */
  mergedCells: Array<readonly [number, number]>;
}

interface LineSlide {
  values: number[];
  moves: Array<{ from: number; to: number; merged: boolean }>;
  gained: number;
}

/**
 * Slides one line's values toward index 0, merging equal neighbors once each
 * (classic 2048 rules: [2,2,4] → [4,4], [2,2,2,2] → [4,4]).
 */
export function slideLine(values: readonly number[]): LineSlide {
  const out = new Array<number>(values.length).fill(0);
  const moves: LineSlide["moves"] = [];
  let write = 0;
  let lastMergeAt = -1;
  let gained = 0;
  for (let read = 0; read < values.length; read++) {
    const v = values[read]!;
    if (v === 0) continue;
    if (write > 0 && out[write - 1] === v && lastMergeAt !== write - 1) {
      out[write - 1] = v * 2;
      gained += v * 2;
      moves.push({ from: read, to: write - 1, merged: true });
      lastMergeAt = write - 1;
    } else {
      out[write] = v;
      moves.push({ from: read, to: write, merged: false });
      write++;
    }
  }
  return { values: out, moves, gained };
}

/** Grid coordinates of a line's cells, ordered from the edge tiles slide toward. */
function lineCoords(dir: Direction, line: number): Array<readonly [number, number]> {
  const coords: Array<readonly [number, number]> = [];
  for (let i = 0; i < GRID_SIZE; i++) {
    switch (dir) {
      case "left":
        coords.push([line, i]);
        break;
      case "right":
        coords.push([line, GRID_SIZE - 1 - i]);
        break;
      case "up":
        coords.push([i, line]);
        break;
      case "down":
        coords.push([GRID_SIZE - 1 - i, line]);
        break;
    }
  }
  return coords;
}

/** Pure 2048 game state: 4x4 grid of tile values, 0 = empty. */
export class Grid {
  cells: number[][];

  constructor() {
    this.cells = Array.from({ length: GRID_SIZE }, () => Array<number>(GRID_SIZE).fill(0));
  }

  emptyCells(): Array<readonly [number, number]> {
    const empty: Array<readonly [number, number]> = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (this.cells[r]![c] === 0) empty.push([r, c]);
      }
    }
    return empty;
  }

  /** Spawns a 2 (90%) or 4 (10%) on a random empty cell; returns its position. */
  spawn(rng: Rng): readonly [number, number] | null {
    const empty = this.emptyCells();
    if (empty.length === 0) return null;
    const [r, c] = rng.pick(empty);
    this.cells[r]![c] = rng.next() < 0.9 ? 2 : 4;
    return [r, c];
  }

  move(dir: Direction): MoveResult {
    const result: MoveResult = { moved: false, gained: 0, moves: [], mergedCells: [] };
    for (let line = 0; line < GRID_SIZE; line++) {
      const coords = lineCoords(dir, line);
      const slid = slideLine(coords.map(([r, c]) => this.cells[r]![c]!));
      for (const m of slid.moves) {
        if (m.from !== m.to || m.merged) result.moved = true;
        const [fromR, fromC] = coords[m.from]!;
        const [toR, toC] = coords[m.to]!;
        result.moves.push({ fromR, fromC, toR, toC, merged: m.merged });
        if (m.merged) result.mergedCells.push([toR, toC]);
      }
      result.gained += slid.gained;
      coords.forEach(([r, c], i) => {
        this.cells[r]![c] = slid.values[i]!;
      });
    }
    return result;
  }

  canMove(): boolean {
    if (this.emptyCells().length > 0) return true;
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const v = this.cells[r]![c]!;
        if (r + 1 < GRID_SIZE && this.cells[r + 1]![c] === v) return true;
        if (c + 1 < GRID_SIZE && this.cells[r]![c + 1] === v) return true;
      }
    }
    return false;
  }

  maxTile(): number {
    return Math.max(...this.cells.flat());
  }

  /**
   * Rewarded-ad revive: clears every tile below the given value so the
   * player can keep going. Keeps at least the strongest tiles intact.
   */
  clearTilesBelow(threshold: number): number {
    let removed = 0;
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const v = this.cells[r]![c]!;
        if (v > 0 && v < threshold) {
          this.cells[r]![c] = 0;
          removed++;
        }
      }
    }
    return removed;
  }
}
