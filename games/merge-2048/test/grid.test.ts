import { describe, expect, it } from "vitest";
import { Grid, slideLine } from "../src/logic/grid";
import { Rng } from "@mg/core";

function gridFrom(rows: number[][]): Grid {
  const g = new Grid();
  g.cells = rows.map((r) => [...r]);
  return g;
}

describe("slideLine", () => {
  it("slides tiles toward the front", () => {
    expect(slideLine([0, 2, 0, 4]).values).toEqual([2, 4, 0, 0]);
  });

  it("merges equal neighbors and scores the merged value", () => {
    const r = slideLine([2, 2, 0, 0]);
    expect(r.values).toEqual([4, 0, 0, 0]);
    expect(r.gained).toBe(4);
  });

  it("merges each tile at most once per move", () => {
    expect(slideLine([2, 2, 4, 0]).values).toEqual([4, 4, 0, 0]);
    expect(slideLine([2, 2, 2, 2]).values).toEqual([4, 4, 0, 0]);
    expect(slideLine([4, 2, 2, 0]).values).toEqual([4, 4, 0, 0]);
    expect(slideLine([2, 2, 2, 0]).values).toEqual([4, 2, 0, 0]);
  });

  it("records tile movements with merge flags", () => {
    const r = slideLine([0, 2, 2, 4]);
    expect(r.values).toEqual([4, 4, 0, 0]);
    expect(r.moves).toEqual([
      { from: 1, to: 0, merged: false },
      { from: 2, to: 0, merged: true },
      { from: 3, to: 1, merged: false },
    ]);
  });
});

describe("Grid.move", () => {
  it("moves left across all rows and reports moved=true", () => {
    const g = gridFrom([
      [0, 2, 0, 2],
      [4, 0, 4, 0],
      [0, 0, 0, 8],
      [0, 0, 0, 0],
    ]);
    const r = g.move("left");
    expect(r.moved).toBe(true);
    expect(r.gained).toBe(12);
    expect(g.cells).toEqual([
      [4, 0, 0, 0],
      [8, 0, 0, 0],
      [8, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
  });

  it("moves right, up, and down with correct orientation", () => {
    const g = gridFrom([
      [2, 0, 0, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [2, 0, 0, 2],
    ]);
    expect(g.move("right").gained).toBe(8); // both rows merge
    expect(g.cells[0]).toEqual([0, 0, 0, 4]);
    expect(g.cells[3]).toEqual([0, 0, 0, 4]);
    const r2 = g.move("down");
    expect(r2.gained).toBe(8);
    expect(g.cells[3]).toEqual([0, 0, 0, 8]);
    const g2 = gridFrom([
      [0, 0, 0, 0],
      [2, 0, 0, 0],
      [0, 0, 0, 0],
      [2, 0, 0, 0],
    ]);
    expect(g2.move("up").gained).toBe(4);
    expect(g2.cells[0]).toEqual([4, 0, 0, 0]);
  });

  it("reports moved=false when nothing changes", () => {
    const g = gridFrom([
      [2, 4, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const r = g.move("left");
    expect(r.moved).toBe(false);
    expect(r.gained).toBe(0);
  });

  it("maps movement records to grid coordinates", () => {
    const g = gridFrom([
      [0, 0, 2, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const r = g.move("right");
    // The col-3 tile stays (no record of a non-move), col-2 tile merges into col 3.
    expect(r.moves).toContainEqual({ fromR: 0, fromC: 2, toR: 0, toC: 3, merged: true });
    expect(r.mergedCells).toEqual([[0, 3]]);
  });
});

describe("Grid state helpers", () => {
  it("spawn fills a random empty cell with 2 or 4, deterministically per seed", () => {
    const g = new Grid();
    const pos = g.spawn(new Rng(7));
    expect(pos).not.toBeNull();
    const [r, c] = pos!;
    expect([2, 4]).toContain(g.cells[r]![c]);
    const g2 = new Grid();
    expect(g2.spawn(new Rng(7))).toEqual(pos);
  });

  it("canMove detects merges available on a full board", () => {
    const stuck = gridFrom([
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ]);
    expect(stuck.canMove()).toBe(false);
    stuck.cells[3]![3] = 4; // creates a vertical pair
    expect(stuck.canMove()).toBe(true);
  });

  it("clearTilesBelow removes small tiles and keeps big ones", () => {
    const g = gridFrom([
      [2, 4, 8, 16],
      [32, 64, 2, 4],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const removed = g.clearTilesBelow(16);
    expect(removed).toBe(5);
    expect(g.cells[0]).toEqual([0, 0, 0, 16]);
    expect(g.cells[1]).toEqual([32, 64, 0, 0]);
  });

  it("maxTile returns the largest value", () => {
    const g = gridFrom([
      [2, 4, 8, 16],
      [32, 64, 128, 256],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    expect(g.maxTile()).toBe(256);
  });
});
