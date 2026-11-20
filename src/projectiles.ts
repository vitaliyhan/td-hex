export interface Shell {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  t: number;
  dur: number;
  dmg: number;
  splash: number; // px radius
  color: string;
}

export function shellPos(s: Shell): { x: number; y: number } {
  const u = s.t / s.dur;
  const arc = -Math.sin(Math.PI * u) * 46;
  return { x: s.sx + (s.tx - s.sx) * u, y: s.sy + (s.ty - s.sy) * u + arc };
}
