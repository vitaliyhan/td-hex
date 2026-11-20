import { pixelToCell, type Cell } from "./hex";
import { ENEMY_DEFS } from "./config";
import type { EnemyKind } from "./types";
import type { Grid } from "./grid";
import { nextStep, type FlowField } from "./path";

let nextId = 1;

export class Enemy {
  readonly id = nextId++;
  readonly kind: EnemyKind;

  x: number;
  y: number;
  hp: number;
  maxHp: number;
  bounty: number;
  readonly armor: number;
  readonly flying: boolean;
  readonly slowResist: number;
  readonly radius: number;
  readonly color: string;
  leakDamage: number;

  slowFactor = 0;
  slowTimer = 0;
  progress = 0; // distance travelled in px — used for first/last targeting
  angle = 0;
  alive = true;
  leaked = false;
  /** set once death/leak has been settled (bounty paid / core hit) */
  counted = false;

  private stepTarget: Cell;
  private wobble = Math.random() * Math.PI * 2;

  constructor(kind: EnemyKind, x: number, y: number, hpMult: number, bountyMult: number, grid: Grid) {
    const def = ENEMY_DEFS[kind];
    this.kind = kind;
    this.x = x;
    this.y = y;
    this.hp = Math.round(def.hp * hpMult);
    this.maxHp = this.hp;
    this.bounty = Math.round(def.bounty * bountyMult);
    this.armor = def.armor;
    this.flying = !!def.flying;
    this.slowResist = def.slowResist ?? 0;
    this.radius = def.radius * grid.size;
    this.leakDamage = def.leakDamage;
    this.color = def.color;
    this.stepTarget = pixelToCell(x, y, grid.size);
  }

  get speed(): number {
    // ENEMY_DEFS speeds are hexes/s; grid.spacing is px/hex — multiplied by caller scale
    return this._speed * (1 - this.slowFactor);
  }

  _speed = 0;

  setSpeedPx(pxPerSec: number): void {
    this._speed = pxPerSec;
  }

  applySlow(factor: number, dur: number): void {
    const f = factor * (1 - this.slowResist);
    if (f > this.slowFactor || this.slowTimer <= 0) this.slowFactor = Math.max(this.slowFactor, f);
    this.slowTimer = Math.max(this.slowTimer, dur);
  }

  /** returns damage actually dealt (for hit feedback) */
  damage(amount: number): number {
    const dealt = Math.max(1, amount - this.armor);
    this.hp -= dealt;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
    }
    return dealt;
  }

  update(dt: number, grid: Grid, field: FlowField): void {
    if (!this.alive) return;
    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) this.slowFactor = 0;
    }

    const core = grid.center(grid.core.col, grid.core.row);
    const spd = this.speed;

    if (this.flying) {
      const dx = core.x - this.x;
      const dy = core.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      const nx = dx / d;
      const ny = dy / d;
      this.wobble += dt * 3;
      const px = -ny * Math.sin(this.wobble + this.id) * 0.35;
      const py = nx * Math.cos(this.wobble + this.id) * 0.35;
      this.x += (nx + px) * spd * dt;
      this.y += (ny + py) * spd * dt;
      this.angle = Math.atan2(ny, nx);
      this.progress += spd * dt;
      if (d < grid.size * 0.5) this.leaked = true;
      return;
    }

    // ground: steer through the flow field
    let cur = pixelToCell(this.x, this.y, grid.size);
    if (!grid.isInside(cur)) {
      // pushed outside the board — walk straight toward core
      const dx = core.x - this.x;
      const dy = core.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      this.x += (dx / d) * spd * dt;
      this.y += (dy / d) * spd * dt;
      this.angle = Math.atan2(dy, dx);
      this.progress += spd * dt;
      return;
    }
    this.stepTarget = nextStep(cur, grid, field) ?? this.stepTarget;
    const t = grid.center(this.stepTarget.col, this.stepTarget.row);
    const dx = t.x - this.x;
    const dy = t.y - this.y;
    const d = Math.hypot(dx, dy);
    if (d > 0.001) {
      this.x += (dx / d) * spd * dt;
      this.y += (dy / d) * spd * dt;
      this.angle = Math.atan2(dy, dx);
      this.progress += spd * dt;
    }
    if (this.stepTarget.col === grid.core.col && this.stepTarget.row === grid.core.row && d < grid.size * 0.55) {
      this.leaked = true;
    }
  }
}
