import { cellKey, hexToPixel, type Cell } from "./hex";

export class Grid {
  readonly cols: number;
  readonly rows: number;
  readonly size: number; // hex size (center → corner) in world px
  readonly spacing: number; // center-to-center distance of adjacent hexes
  readonly spawn: Cell;
  readonly core: Cell;
  readonly occupied = new Set<string>();
  readonly walls = new Set<string>();
  private centers = new Map<string, { x: number; y: number }>();

  constructor(
    cols: number,
    rows: number,
    size: number,
    spawn: Cell,
    core: Cell,
    walls: readonly (readonly [number, number])[] = [],
  ) {
    this.cols = cols;
    this.rows = rows;
    this.size = size;
    this.spacing = size * Math.sqrt(3);
    this.spawn = spawn;
    this.core = core;
    for (const [col, row] of walls) this.walls.add(cellKey(col, row));
  }

  isInside(cell: Cell): boolean {
    return cell.col >= 0 && cell.col < this.cols && cell.row >= 0 && cell.row < this.rows;
  }

  isOccupied(cell: Cell): boolean {
    return this.occupied.has(cellKey(cell.col, cell.row));
  }

  isWall(cell: Cell): boolean {
    return this.walls.has(cellKey(cell.col, cell.row));
  }

  isSpecial(cell: Cell): boolean {
    return (cell.col === this.spawn.col && cell.row === this.spawn.row) ||
      (cell.col === this.core.col && cell.row === this.core.row);
  }

  /** a hex where a tower may be placed (ignoring the fully-blocking rule) */
  isBuildable(cell: Cell): boolean {
    return this.isInside(cell) && !this.isOccupied(cell) && !this.isWall(cell) && !this.isSpecial(cell);
  }

  center(col: number, row: number): { x: number; y: number } {
    const k = cellKey(col, row);
    let c = this.centers.get(k);
    if (!c) {
      c = hexToPixel({ col, row }, this.size);
      this.centers.set(k, c);
    }
    return c;
  }

  get boardWidth(): number {
    return Math.sqrt(3) * this.size * this.cols;
  }

  get boardHeight(): number {
    return 1.5 * this.size * (this.rows - 1) + 2 * this.size;
  }
}
