import type { Rng } from "@mg/core";

/** Cell offsets are [row, col] from the shape's top-left corner. */
export interface PieceShape {
  readonly id: string;
  readonly cells: ReadonlyArray<readonly [number, number]>;
}

export interface Piece {
  readonly shape: PieceShape;
  readonly colorIndex: number;
}

function line(id: string, len: number, vertical: boolean): PieceShape {
  const cells: Array<readonly [number, number]> = [];
  for (let i = 0; i < len; i++) cells.push(vertical ? [i, 0] : [0, i]);
  return { id, cells };
}

function rect(id: string, rows: number, cols: number): PieceShape {
  const cells: Array<readonly [number, number]> = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push([r, c]);
  return { id, cells };
}

export const SHAPES: readonly PieceShape[] = [
  { id: "dot", cells: [[0, 0]] },
  line("h2", 2, false),
  line("h3", 3, false),
  line("h4", 4, false),
  line("h5", 5, false),
  line("v2", 2, true),
  line("v3", 3, true),
  line("v4", 4, true),
  line("v5", 5, true),
  rect("sq2", 2, 2),
  rect("sq3", 3, 3),
  rect("r2x3", 2, 3),
  rect("r3x2", 3, 2),
  // 3-cell corners, all four orientations
  { id: "c-tl", cells: [[0, 0], [0, 1], [1, 0]] },
  { id: "c-tr", cells: [[0, 0], [0, 1], [1, 1]] },
  { id: "c-bl", cells: [[0, 0], [1, 0], [1, 1]] },
  { id: "c-br", cells: [[0, 1], [1, 0], [1, 1]] },
  // 4-cell Ls
  { id: "l-1", cells: [[0, 0], [1, 0], [2, 0], [2, 1]] },
  { id: "l-2", cells: [[0, 1], [1, 1], [2, 0], [2, 1]] },
  { id: "l-3", cells: [[0, 0], [0, 1], [1, 0], [2, 0]] },
  { id: "l-4", cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
];

export const NUM_COLORS = 6;
export const TRAY_SIZE = 3;

export function shapeSize(shape: PieceShape): { rows: number; cols: number } {
  let rows = 0;
  let cols = 0;
  for (const [r, c] of shape.cells) {
    rows = Math.max(rows, r + 1);
    cols = Math.max(cols, c + 1);
  }
  return { rows, cols };
}

export function generateTray(rng: Rng): Piece[] {
  const pieces: Piece[] = [];
  for (let i = 0; i < TRAY_SIZE; i++) {
    pieces.push({ shape: rng.pick(SHAPES), colorIndex: rng.int(NUM_COLORS) });
  }
  return pieces;
}
