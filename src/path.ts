import { cellKey, neighbours, type Cell } from "./hex";
import type { Grid } from "./grid";

/** Distance (in hexes) from the core for every reachable open cell. */
export class FlowField {
  readonly dist = new Map<string, number>();

  at(cell: Cell): number {
    return this.dist.get(cellKey(cell.col, cell.row)) ?? Infinity;
  }
}

export interface FieldResult {
  field: FlowField;
  /** false when the spawn is no longer reachable from the core */
  ok: boolean;
}

export function computeField(grid: Grid, extraBlocked?: Set<string>): FieldResult {
  const field = new FlowField();
  const queue: Cell[] = [grid.core];
  field.dist.set(cellKey(grid.core.col, grid.core.row), 0);
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    const d = field.at(cur);
    for (const n of neighbours(cur)) {
      if (!grid.isInside(n)) continue;
      const k = cellKey(n.col, n.row);
      if (field.dist.has(k)) continue;
      if (grid.occupied.has(k) || grid.walls.has(k) || extraBlocked?.has(k)) continue;
      field.dist.set(k, d + 1);
      queue.push(n);
    }
  }
  return { field, ok: field.dist.has(cellKey(grid.spawn.col, grid.spawn.row)) };
}

/** the neighbour hex a walking enemy should steer to (lowest field distance) */
export function nextStep(cell: Cell, grid: Grid, field: FlowField): Cell | null {
  let best: Cell | null = null;
  let bestD = field.at(cell);
  for (const n of neighbours(cell)) {
    if (!grid.isInside(n) || grid.isOccupied(n) || grid.isWall(n)) continue;
    const d = field.at(n);
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}

/** polyline of cells from a start cell to the core, following the field */
export function tracePath(from: Cell, grid: Grid, field: FlowField): Cell[] {
  const path: Cell[] = [from];
  let cur = from;
  let guard = 0;
  while ((cur.col !== grid.core.col || cur.row !== grid.core.row) && guard++ < 1000) {
    const n = nextStep(cur, grid, field);
    if (!n) break;
    path.push(n);
    cur = n;
  }
  return path;
}
