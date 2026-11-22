import { MODULE_BASE, TOWER_DEFS } from "./config";
import type { Grid } from "./grid";
import type { Fx } from "./fx";
import type { Shell } from "./projectiles";
import type { Enemy } from "./enemies";
import type { ModuleCat, TargetMode, TowerKind, TowerLevelStats } from "./types";

export interface TowerContext {
  enemies: Enemy[];
  fx: Fx;
  shells: Shell[];
  grid: Grid;
  sfx: (name: string) => void;
}

const SHELL_SPEED = 520; // px/s

let towerSeq = 1;

export class Tower {
  readonly id = towerSeq++;
  readonly kind: TowerKind;
  readonly col: number;
  readonly row: number;
  readonly x: number;
  readonly y: number;
  level = 0;
  invested: number;
  cooldown = 0;
  angle = -Math.PI / 2;
  targetMode: TargetMode = "first";
  /** muzzle flash timer, read by the renderer */
  flash = 0;
  /** cryo ring pulse timer */
  pulse = 0;

  // per-tower purchasable modules
  powT = 0;
  rateT = 0;
  rngT = 0;
  gunT = 0;

  // laser runtime
  /** seconds left of the current piercing beam (>0 = firing) */
  beamT = 0;
  /** rotation lock: when set the tower keeps this exact facing */
  fixedAngle: number | null = null;
  /** full-map beam length in px */
  readonly beamLen: number;
  private tickAcc = 0;

  private grid: Grid;

  constructor(kind: TowerKind, col: number, row: number, grid: Grid) {
    this.kind = kind;
    this.col = col;
    this.row = row;
    this.grid = grid;
    const c = grid.center(col, row);
    this.x = c.x;
    this.y = c.y;
    this.invested = TOWER_DEFS[kind].cost;
    this.beamLen = grid.boardWidth + grid.boardHeight;
  }

  get def() {
    return TOWER_DEFS[this.kind];
  }

  /** effective stats: level + per-tower modules */
  get stats(): TowerLevelStats {
    const b = this.def.levels[this.level];
    const out: TowerLevelStats = { ...b };
    out.dmg = Math.round(b.dmg * Math.pow(1.15, this.powT));
    out.rate = Math.round(b.rate * (1 + 0.12 * this.rateT) * 100) / 100;
    if (b.range > 0) out.range = Math.round((b.range + 0.25 * this.rngT) * 100) / 100;
    if (b.width !== undefined) out.width = b.width + 1.5 * this.rngT + 4 * this.gunT;
    return out;
  }

  get upgradeCost(): number | null {
    return this.level < 2 ? this.def.upgradeCosts[this.level] : null;
  }

  moduleTier(cat: ModuleCat): number {
    return cat === "pow" ? this.powT : cat === "rate" ? this.rateT : cat === "rng" ? this.rngT : this.gunT;
  }

  /** module tiers are uncapped; tier n costs base * (n+1) */
  moduleCost(cat: ModuleCat): number {
    return MODULE_BASE[cat] * (this.moduleTier(cat) + 1);
  }

  addModule(cat: ModuleCat): void {
    if (cat === "pow") this.powT++;
    else if (cat === "rate") this.rateT++;
    else if (cat === "rng") this.rngT++;
    else this.gunT++;
  }

  /** number of barrels / parallel shots; 0 for the aura tower (no guns) */
  get gunCount(): number {
    if (this.kind === "cryo") return 0;
    if (this.kind === "laser") return 1 + this.gunT; // extra guns widen the beam
    return (this.stats.multi ?? 1) + this.gunT;
  }

  /** lock the current facing / release it back to auto-tracking */
  toggleRotation(): void {
    this.fixedAngle = this.fixedAngle === null ? this.angle : null;
  }

  aimAt(px: number, py: number): void {
    this.fixedAngle = Math.atan2(py - this.y, px - this.x);
    this.angle = this.fixedAngle;
  }

  get sellValue(): number {
    return Math.floor(this.invested * 0.7);
  }

  private pickTargets(ctx: TowerContext, n: number): Enemy[] {
    const r = this.stats.range * this.grid.spacing;
    const r2 = r * r;
    const cands: Array<{ e: Enemy; score: number }> = [];
    for (const e of ctx.enemies) {
      if (!e.alive || e.leaked) continue;
      if (e.flying && this.def.groundOnly) continue;
      const dx = e.x - this.x;
      const dy = e.y - this.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      let score: number;
      switch (this.targetMode) {
        case "first":
          score = e.progress;
          break;
        case "last":
          score = -e.progress;
          break;
        case "strong":
          score = e.hp;
          break;
        default:
          score = -d2;
      }
      cands.push({ e, score });
    }
    cands.sort((a, b) => b.score - a.score);
    return cands.slice(0, n).map((c) => c.e);
  }

  /** all enemies inside the laser's line segment, within half-width */
  private beamTargets(st: TowerLevelStats, enemies: Enemy[]): Enemy[] {
    const sx = Math.cos(this.angle);
    const sy = Math.sin(this.angle);
    const halfW = st.width ?? 5;
    const out: Enemy[] = [];
    for (const e of enemies) {
      if (!e.alive || e.leaked) continue;
      const vx = e.x - this.x;
      const vy = e.y - this.y;
      const proj = vx * sx + vy * sy;
      if (proj < 0 || proj > this.beamLen) continue;
      const perp = Math.abs(vx * sy - vy * sx);
      if (perp <= halfW + e.radius * 0.5) out.push(e);
    }
    return out;
  }

  update(dt: number, ctx: TowerContext): void {
    this.cooldown -= dt;
    this.flash = Math.max(0, this.flash - dt);
    this.pulse = Math.max(0, this.pulse - dt);
    const st = this.stats;

    if (this.kind === "laser") {
      if (this.beamT > 0) {
        this.beamT -= dt;
        this.tickAcc += dt;
        const step = 1 / st.rate;
        while (this.tickAcc >= step && this.beamT >= 0) {
          this.tickAcc -= step;
          for (const e of this.beamTargets(st, ctx.enemies)) {
            e.damage(st.dmg);
            if (Math.random() < 0.5) ctx.fx.burst(e.x, e.y, { count: 2, color: "#ffffff", speed: 110, life: 0.2, size: 2 });
          }
        }
        if (this.beamT <= 0) {
          this.beamT = 0;
          this.cooldown = st.cool ?? 1.2;
        }
        return;
      }
      if (this.fixedAngle !== null) {
        this.angle = this.fixedAngle;
      } else {
        let best: Enemy | null = null;
        let bd = Infinity;
        for (const e of ctx.enemies) {
          if (!e.alive || e.leaked) continue;
          const d = (e.x - this.x) ** 2 + (e.y - this.y) ** 2;
          if (d < bd) { bd = d; best = e; }
        }
        if (best) {
          const want = Math.atan2(best.y - this.y, best.x - this.x);
          let diff = want - this.angle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          this.angle += diff * Math.min(1, dt * 3.5);
        } else {
          this.angle += dt * 0.5; // idle sweep
        }
      }
      if (this.cooldown <= 0 && ctx.enemies.some((e) => e.alive && !e.leaked)) {
        this.beamT = st.beamDur ?? 0.8;
        this.tickAcc = 0;
        this.flash = 0.12;
        ctx.sfx("laser");
      }
      return;
    }

    if (this.kind === "cryo") {
      if (this.cooldown <= 0) {
        const r = st.range * this.grid.spacing;
        let hit = false;
        for (const e of ctx.enemies) {
          if (!e.alive || e.leaked) continue;
          if (Math.hypot(e.x - this.x, e.y - this.y) <= r) {
            e.damage(st.dmg);
            e.applySlow(st.slow ?? 0, 1.15);
            hit = true;
          }
        }
        this.cooldown = 1 / st.rate;
        this.pulse = 0.4;
        if (hit) ctx.sfx("cryo");
      }
      return;
    }

    const targets = this.pickTargets(ctx, Math.max(1, this.gunCount));
    if (targets.length === 0) return;
    const want = Math.atan2(targets[0].y - this.y, targets[0].x - this.x);
    let diff = want - this.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.angle += diff * Math.min(1, dt * 12);

    if (this.cooldown > 0) return;
    this.cooldown = 1 / st.rate;
    this.flash = 0.12;

    const tipX = this.x + Math.cos(this.angle) * this.grid.size * 0.55;
    const tipY = this.y + Math.sin(this.angle) * this.grid.size * 0.55;

    switch (this.kind) {
      case "lance":
      case "sentinel": {
        for (const target of targets) {
          target.damage(st.dmg);
          ctx.fx.beam(tipX, tipY, target.x, target.y, this.def.color, 0.1, this.kind === "sentinel" ? 3.5 : 2.5);
          ctx.fx.burst(target.x, target.y, { count: 3, color: this.def.color, speed: 90, life: 0.25, size: 2 });
        }
        ctx.sfx(this.kind === "sentinel" ? "laser" : "lance");
        break;
      }
      case "flak": {
        for (const target of targets) {
          target.damage(st.dmg);
          ctx.fx.beam(tipX, tipY, target.x, target.y, this.def.color, 0.08, 1.8);
          ctx.fx.burst(target.x, target.y, { count: 2, color: this.def.color, speed: 80, life: 0.2, size: 1.6 });
        }
        ctx.sfx("lance");
        break;
      }
      case "arc": {
        const chainRange = (st.chainRange ?? 2) * this.grid.spacing;
        // extra guns extend the chain
        const hit: Enemy[] = [targets[0]];
        let dmg = st.dmg;
        const pts: number[] = [tipX, tipY];
        let from = targets[0];
        const segs = (st.chain ?? 1) + this.gunT;
        for (let i = 0; i < segs; i++) {
          from.damage(dmg);
          pts.push(from.x, from.y);
          dmg *= 0.85;
          let next: Enemy | null = null;
          let nd = chainRange;
          for (const e of ctx.enemies) {
            if (!e.alive || e.leaked || hit.includes(e)) continue;
            const d = Math.hypot(e.x - from.x, e.y - from.y);
            if (d < nd) {
              nd = d;
              next = e;
            }
          }
          if (!next) break;
          hit.push(next);
          from = next;
        }
        ctx.fx.bolt(jitter(pts, 9), this.def.color, 0.16);
        for (const e of hit) ctx.fx.burst(e.x, e.y, { count: 4, color: this.def.color, speed: 120, life: 0.3, size: 2.2 });
        ctx.sfx("arc");
        break;
      }
      case "mortar": {
        for (const target of targets) {
          const dist = Math.hypot(target.x - this.x, target.y - this.y);
          const travel = dist / SHELL_SPEED;
          const spd = target.speed;
          const tx = target.x + Math.cos(target.angle) * spd * travel;
          const ty = target.y + Math.sin(target.angle) * spd * travel;
          const d2 = Math.hypot(tx - this.x, ty - this.y);
          ctx.shells.push({
            sx: this.x,
            sy: this.y,
            tx,
            ty,
            t: 0,
            dur: Math.max(0.35, d2 / SHELL_SPEED),
            dmg: st.dmg,
            splash: (st.splash ?? 1) * this.grid.spacing,
            color: this.def.color,
          });
        }
        ctx.fx.burst(tipX, tipY, { count: 5, color: this.def.color, speed: 130, life: 0.3, size: 2.5, dir: this.angle, spread: 0.9 });
        ctx.sfx("mortar");
        break;
      }
    }
  }
}

/** insert jittered midpoints into a flat point list so beams look electric */
function jitter(pts: number[], amount: number): number[] {
  if (pts.length <= 2) return pts;
  const out: number[] = [pts[0], pts[1]];
  for (let i = 2; i < pts.length; i += 2) {
    const px = pts[i - 2];
    const py = pts[i - 1];
    const cx = pts[i];
    const cy = pts[i + 1];
    const steps = Math.max(1, Math.floor(Math.hypot(cx - px, cy - py) / 22));
    for (let s = 1; s <= steps; s++) {
      const u = s / (steps + 1);
      out.push(
        px + (cx - px) * u + (Math.random() - 0.5) * amount,
        py + (cy - py) * u + (Math.random() - 0.5) * amount,
      );
    }
    out.push(cx, cy);
  }
  return out;
}
