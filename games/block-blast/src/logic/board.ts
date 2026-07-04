import type { Piece, PieceShape } from "./pieces";

export const BOARD_SIZE = 8;
/** Flat bonus for emptying the entire board with a clear. */
export const BOARD_CLEAR_BONUS = 300;
/** Flat bonus per cleared line whose cells were all the same color. */
export const MONO_LINE_BONUS = 50;

export interface PlacementResult {
  /** Points earned by this placement (cells + line bonus + board-clear bonus). */
  points: number;
  clearedRows: number[];
  clearedCols: number[];
  /** Consecutive line-clearing placements, including this one. 0 if nothing cleared. */
  streak: number;
  /** True when this placement's clears left the board completely empty. */
  boardCleared: boolean;
  /** Number of cleared lines whose cells were all the same color. */
  monoLines: number;
}

/**
 * Pure game state for the 8x8 grid. Cells hold a color index or null.
 * No rendering concerns — fully unit-testable.
 */
export class Board {
  readonly size = BOARD_SIZE;
  cells: (number | null)[][];
  private streak = 0;

  constructor() {
    this.cells = Array.from({ length: BOARD_SIZE }, () =>
      Array<number | null>(BOARD_SIZE).fill(null),
    );
  }

  canPlace(shape: PieceShape, row: number, col: number): boolean {
    for (const [dr, dc] of shape.cells) {
      const r = row + dr;
      const c = col + dc;
      if (r < 0 || c < 0 || r >= this.size || c >= this.size) return false;
      if (this.cells[r]![c] !== null) return false;
    }
    return true;
  }

  /** True if the shape fits somewhere on the board. */
  fitsSomewhere(shape: PieceShape): boolean {
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.canPlace(shape, r, c)) return true;
      }
    }
    return false;
  }

  anyFits(pieces: readonly Piece[]): boolean {
    return pieces.some((p) => this.fitsSomewhere(p.shape));
  }

  /**
   * Places the piece (caller must have checked canPlace), clears any full
   * rows/columns, and returns the score delta.
   *
   * Scoring: 1 point per cell placed, plus 10 * lines^2 line bonus
   * multiplied by the current clear streak, plus MONO_LINE_BONUS per cleared
   * line that was entirely one color, plus BOARD_CLEAR_BONUS if the clears
   * leave the board completely empty.
   */
  place(piece: Piece, row: number, col: number): PlacementResult {
    if (!this.canPlace(piece.shape, row, col)) {
      throw new Error(`Invalid placement of ${piece.shape.id} at ${row},${col}`);
    }
    for (const [dr, dc] of piece.shape.cells) {
      this.cells[row + dr]![col + dc] = piece.colorIndex;
    }

    const clearedRows: number[] = [];
    const clearedCols: number[] = [];
    for (let r = 0; r < this.size; r++) {
      if (this.cells[r]!.every((c) => c !== null)) clearedRows.push(r);
    }
    for (let c = 0; c < this.size; c++) {
      if (this.cells.every((rowCells) => rowCells[c] !== null)) clearedCols.push(c);
    }
    // Count monochrome lines before the cells are wiped.
    let monoLines = 0;
    for (const r of clearedRows) {
      if (this.cells[r]!.every((c) => c === this.cells[r]![0])) monoLines++;
    }
    for (const c of clearedCols) {
      if (this.cells.every((rowCells) => rowCells[c] === this.cells[0]![c])) monoLines++;
    }

    for (const r of clearedRows) this.cells[r]!.fill(null);
    for (const c of clearedCols) {
      for (let r = 0; r < this.size; r++) this.cells[r]![c] = null;
    }

    const lines = clearedRows.length + clearedCols.length;
    this.streak = lines > 0 ? this.streak + 1 : 0;
    const boardCleared =
      lines > 0 && this.cells.every((rowCells) => rowCells.every((c) => c === null));
    const points =
      piece.shape.cells.length +
      10 * lines * lines * Math.max(1, this.streak) +
      MONO_LINE_BONUS * monoLines +
      (boardCleared ? BOARD_CLEAR_BONUS : 0);

    return { points, clearedRows, clearedCols, streak: this.streak, boardCleared, monoLines };
  }
}
