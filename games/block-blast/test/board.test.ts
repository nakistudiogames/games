import { describe, expect, it } from "vitest";
import { Board, BOARD_SIZE, BOARD_CLEAR_BONUS, MONO_LINE_BONUS } from "../src/logic/board";
import { generateTray, SHAPES, shapeSize, TRAY_SIZE } from "../src/logic/pieces";
import type { Piece, PieceShape } from "../src/logic/pieces";
import { Rng } from "@mg/core";

const shape = (id: string): PieceShape => {
  const s = SHAPES.find((s) => s.id === id);
  if (!s) throw new Error(`no shape ${id}`);
  return s;
};
const piece = (id: string, colorIndex = 0): Piece => ({ shape: shape(id), colorIndex });

describe("Board.canPlace", () => {
  it("accepts a piece on an empty board", () => {
    expect(new Board().canPlace(shape("sq3"), 0, 0)).toBe(true);
  });

  it("rejects out-of-bounds placements", () => {
    const b = new Board();
    expect(b.canPlace(shape("h5"), 0, 4)).toBe(false);
    expect(b.canPlace(shape("v5"), 4, 0)).toBe(false);
    expect(b.canPlace(shape("dot"), -1, 0)).toBe(false);
    expect(b.canPlace(shape("dot"), 0, BOARD_SIZE)).toBe(false);
  });

  it("rejects overlaps with occupied cells", () => {
    const b = new Board();
    b.place(piece("sq2"), 3, 3);
    expect(b.canPlace(shape("dot"), 3, 3)).toBe(false);
    expect(b.canPlace(shape("h2"), 3, 2)).toBe(false);
    expect(b.canPlace(shape("dot"), 5, 5)).toBe(true);
  });
});

describe("Board.place scoring and clearing", () => {
  it("scores 1 point per cell when nothing clears", () => {
    const b = new Board();
    expect(b.place(piece("sq3"), 0, 0).points).toBe(9);
    expect(b.place(piece("dot"), 7, 7).points).toBe(1);
  });

  it("clears a completed row and scores the line bonus", () => {
    const b = new Board();
    b.place(piece("dot"), 5, 5); // spare cell so the clear doesn't empty the board
    b.place(piece("h5"), 0, 0);
    const result = b.place(piece("h3", 1), 0, 5); // second color keeps the row mixed
    expect(result.clearedRows).toEqual([0]);
    expect(result.clearedCols).toEqual([]);
    expect(result.monoLines).toBe(0);
    // 3 cells + 10 * 1^2 * streak(1)
    expect(result.points).toBe(13);
    expect(b.cells[0]!.every((c) => c === null)).toBe(true);
  });

  it("clears a completed column", () => {
    const b = new Board();
    b.place(piece("v5"), 0, 2);
    const result = b.place(piece("v3"), 5, 2);
    expect(result.clearedCols).toEqual([2]);
    for (let r = 0; r < BOARD_SIZE; r++) expect(b.cells[r]![2]).toBeNull();
  });

  it("clears intersecting row and column together with a quadratic bonus", () => {
    const b = new Board();
    b.place(piece("dot"), 5, 5); // spare cell so the clear doesn't empty the board
    // Fill row 0 except col 0, and col 0 except row 0 (mixed colors in both lines).
    b.place(piece("h4", 1), 0, 1);
    b.place(piece("h3"), 0, 5);
    b.place(piece("v4", 1), 1, 0);
    b.place(piece("v3"), 5, 0);
    const result = b.place(piece("dot"), 0, 0);
    expect(result.clearedRows).toEqual([0]);
    expect(result.clearedCols).toEqual([0]);
    // 1 cell + 10 * 2^2 * streak(1)
    expect(result.points).toBe(41);
  });

  it("increments the streak on consecutive clears and resets it otherwise", () => {
    const b = new Board();
    b.place(piece("dot"), 6, 6); // spare cell so the clears don't empty the board
    // Prepare rows 0 and 1 so each is one cell (col 7) from complete, mixed colors.
    b.place(piece("h5"), 0, 0);
    b.place(piece("h2", 1), 0, 5);
    b.place(piece("h5"), 1, 0);
    b.place(piece("h2", 1), 1, 5);
    expect(b.place(piece("dot"), 0, 7).streak).toBe(1);
    // Second consecutive clearing placement: 1 cell + 10 * 1^2 * streak(2).
    const second = b.place(piece("dot"), 1, 7);
    expect(second.streak).toBe(2);
    expect(second.points).toBe(21);
    expect(b.place(piece("dot"), 4, 4).streak).toBe(0);
  });

  it("awards the flat bonus when a clear empties the whole board", () => {
    const b = new Board();
    b.place(piece("h5"), 0, 0);
    // Only row 0 is occupied, so completing it empties the board (mixed colors).
    const result = b.place(piece("h3", 1), 0, 5);
    expect(result.boardCleared).toBe(true);
    // 3 cells + 10 * 1^2 * streak(1) + board-clear bonus.
    expect(result.points).toBe(13 + BOARD_CLEAR_BONUS);
  });

  it("does not award the board-clear bonus while other cells remain", () => {
    const b = new Board();
    b.place(piece("dot"), 5, 5);
    b.place(piece("h5"), 0, 0);
    const result = b.place(piece("h3", 1), 0, 5);
    expect(result.clearedRows).toEqual([0]);
    expect(result.boardCleared).toBe(false);
    expect(result.points).toBe(13);
  });

  it("awards the mono bonus when a cleared line is all one color", () => {
    const b = new Board();
    b.place(piece("dot", 1), 5, 5); // spare cell, different color, off the line
    b.place(piece("h5"), 0, 0);
    const result = b.place(piece("h3"), 0, 5); // row 0 entirely color 0
    expect(result.monoLines).toBe(1);
    // 3 cells + 10 * 1^2 * streak(1) + mono bonus
    expect(result.points).toBe(13 + MONO_LINE_BONUS);
  });

  it("awards the mono bonus per monochrome line, including columns", () => {
    const b = new Board();
    b.place(piece("dot", 1), 5, 5); // spare cell so the board doesn't empty
    // Column 2 entirely color 3.
    b.place(piece("v5", 3), 0, 2);
    const result = b.place(piece("v3", 3), 5, 2);
    expect(result.clearedCols).toEqual([2]);
    expect(result.monoLines).toBe(1);
    expect(result.points).toBe(13 + MONO_LINE_BONUS);
  });

  it("throws on invalid placement", () => {
    const b = new Board();
    b.place(piece("dot"), 0, 0);
    expect(() => b.place(piece("dot"), 0, 0)).toThrow();
  });
});

describe("game over detection", () => {
  it("anyFits is false only when no tray piece fits", () => {
    const b = new Board();
    // Fill everything except one cell at (7,7).
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (r === 7 && c === 7) continue;
        b.cells[r]![c] = 0;
      }
    }
    expect(b.anyFits([piece("dot")])).toBe(true);
    expect(b.anyFits([piece("h2"), piece("sq2")])).toBe(false);
  });
});

describe("piece generation", () => {
  it("is deterministic for a fixed seed and fits shape metadata", () => {
    const a = generateTray(new Rng(42));
    const b = generateTray(new Rng(42));
    expect(a.map((p) => p.shape.id)).toEqual(b.map((p) => p.shape.id));
    expect(a).toHaveLength(TRAY_SIZE);
    for (const s of SHAPES) {
      const { rows, cols } = shapeSize(s);
      expect(rows).toBeGreaterThan(0);
      expect(cols).toBeGreaterThan(0);
      expect(rows).toBeLessThanOrEqual(5);
      expect(cols).toBeLessThanOrEqual(5);
    }
  });
});
