import { describe, expect, it } from "vitest";
import { Grid } from "../src/grid";
import { computeField, nextStep, tracePath } from "../src/path";
import { cellKey, hexDistance } from "../src/hex";
import { BOARD } from "../src/config";

const mkGrid = (): Grid =>
  new Grid(15, 11, 34, { col: 0, row: 5 }, { col: 14, row: 5 });

describe("flow field", () => {
  it("designed board with boundary walls: navigable, path stays inside the ring", () => {
    const grid = new Grid(BOARD.cols, BOARD.rows, BOARD.hexSize, BOARD.spawn, BOARD.core, BOARD.walls);
    const { field, ok } = computeField(grid);
    expect(ok).toBe(true);
    expect(field.at(grid.spawn)).toBeGreaterThanOrEqual(hexDistance(grid.spawn, grid.core));
    // ring corners are walls; spawn & core stay open gates
    expect(grid.isWall({ col: 0, row: 0 })).toBe(true);
    expect(grid.isWall({ col: BOARD.cols - 1, row: BOARD.rows - 1 })).toBe(true);
    expect(grid.isWall(grid.spawn)).toBe(false);
    expect(grid.isWall(grid.core)).toBe(false);
    expect(grid.isBuildable({ col: 7, row: 0 })).toBe(false); // ring unbuildable
    const path = tracePath(grid.spawn, grid, field);
    for (const cell of path) {
      expect(grid.isWall(cell)).toBe(false);
      const ring = cell.col === 0 || cell.col === BOARD.cols - 1 || cell.row === 0 || cell.row === BOARD.rows - 1;
      if (ring) expect(cell.col === grid.spawn.col || cell.col === grid.core.col).toBe(true);
    }
  });

  it("open board: spawn reachable, straight-line distance", () => {
    const grid = mkGrid();
    const { field, ok } = computeField(grid);
    expect(ok).toBe(true);
    expect(field.at(grid.spawn)).toBe(14);
  });

  it("nextStep always descends toward the core", () => {
    const grid = mkGrid();
    const { field } = computeField(grid);
    let cur = grid.spawn;
    for (let i = 0; i < 50 && (cur.col !== grid.core.col || cur.row !== grid.core.row); i++) {
      const n = nextStep(cur, grid, field);
      expect(n).not.toBeNull();
      expect(field.at(n!)).toBe(field.at(cur) - 1);
      cur = n!;
    }
    expect(cur).toEqual(grid.core);
  });

  it("full wall blocks the path", () => {
    const grid = mkGrid();
    for (let row = 0; row < 11; row++) grid.occupied.add(cellKey(5, row));
    const { ok } = computeField(grid);
    expect(ok).toBe(false);
  });

  it("partial wall reroutes with a longer path", () => {
    const grid = mkGrid();
    for (let row = 0; row < 9; row++) grid.occupied.add(cellKey(5, row));
    const { field, ok } = computeField(grid);
    expect(ok).toBe(true);
    expect(field.at(grid.spawn)).toBeGreaterThan(14);
    const path = tracePath(grid.spawn, grid, field);
    // path is contiguous: consecutive cells are neighbours
    for (let i = 1; i < path.length; i++) {
      const d = Math.abs(path[i].col - path[i - 1].col) + Math.abs(path[i].row - path[i - 1].row);
      expect(d).toBeLessThanOrEqual(2);
      expect(field.at(path[i])).toBe(field.at(path[i - 1]) - 1);
    }
    expect(path[path.length - 1]).toEqual(grid.core);
  });

  it("tracePath from spawn reaches the core on an open board", () => {
    const grid = mkGrid();
    const { field } = computeField(grid);
    const path = tracePath(grid.spawn, grid, field);
    expect(path[0]).toEqual(grid.spawn);
    expect(path[path.length - 1]).toEqual(grid.core);
    expect(path).toHaveLength(15);
  });
});
