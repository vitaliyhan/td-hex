// Pointy-top hex math. Board cells are stored as odd-r offset coords (col,row);
// pathfinding / distance math uses axial coords.

export const SQRT3 = Math.sqrt(3);

export interface Axial {
  q: number;
  r: number;
}

export interface Cell {
  col: number;
  row: number;
}

// axial neighbour directions (pointy-top)
const AXIAL_DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];

export function cellKey(col: number, row: number): string {
  return `${col},${row}`;
}

export function parseKey(key: string): Cell {
  const i = key.indexOf(",");
  return { col: +key.slice(0, i), row: +key.slice(i + 1) };
}

export function offsetToAxial(col: number, row: number): Axial {
  return { q: col - ((row - (row & 1)) >> 1), r: row };
}

export function axialToOffset(q: number, r: number): Cell {
  return { col: q + ((r - (r & 1)) >> 1), row: r };
}

export function cellToAxial(cell: Cell): Axial {
  return offsetToAxial(cell.col, cell.row);
}

export function hexToPixel(cell: Cell, size: number): { x: number; y: number } {
  const a = offsetToAxial(cell.col, cell.row);
  return {
    x: size * SQRT3 * (a.q + a.r / 2),
    y: size * 1.5 * a.r,
  };
}

function axialFromPixel(x: number, y: number, size: number): Axial {
  const q = ((SQRT3 / 3) * x - (1 / 3) * y) / size;
  const r = ((2 / 3) * y) / size;
  return { q, r };
}

function axialRound(a: Axial): Axial {
  let x = a.q;
  let z = a.r;
  let y = -x - z;
  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);
  const dx = Math.abs(rx - x);
  const dy = Math.abs(ry - y);
  const dz = Math.abs(rz - z);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz) ry = -rx - rz;
  else rz = -rx - ry;
  return { q: rx, r: rz };
}

export function pixelToCell(x: number, y: number, size: number): Cell {
  const a = axialRound(axialFromPixel(x, y, size));
  return axialToOffset(a.q, a.r);
}

export function hexDistance(a: Cell, b: Cell): number {
  const aa = offsetToAxial(a.col, a.row);
  const bb = offsetToAxial(b.col, b.row);
  const dq = aa.q - bb.q;
  const dr = aa.r - bb.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

export function neighbours(cell: Cell): Cell[] {
  const a = offsetToAxial(cell.col, cell.row);
  const out: Cell[] = [];
  for (const [dq, dr] of AXIAL_DIRS) {
    out.push(axialToOffset(a.q + dq, a.r + dr));
  }
  return out;
}

/** corners of a pointy-top hex around (cx, cy), corner angle 0 = 60*i - 30 */
export function hexCorners(cx: number, cy: number, size: number): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    pts.push([cx + size * Math.cos(angle), cy + size * Math.sin(angle)]);
  }
  return pts;
}

export function hexPath(ctx: Path2D | CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
  const pts = hexCorners(cx, cy, size);
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < 6; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}
