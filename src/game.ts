import { BOARD, DEV, ECON, ENEMY_DEFS, PALETTE, TOWER_DEFS, SPEED_OPTIONS, getWave, waveBountyMult, waveHpMult } from "./config";
import { Grid } from "./grid";
import { computeField, type FlowField } from "./path";
import { cellKey, pixelToCell, type Cell } from "./hex";
import { Enemy } from "./enemies";
import { Tower } from "./towers";
import type { Shell } from "./projectiles";
import { Fx } from "./fx";
import { AudioEngine } from "./audio";
import { loadBest, saveBest } from "./storage";
import type { EnemyKind, GameStatus, ModuleCat, TargetMode, TowerKind } from "./types";

interface SpawnEvent {
  t: number;
  kind: EnemyKind;
}

const TARGET_MODES: TargetMode[] = ["first", "last", "strong", "close"];

export class Game {
  readonly grid: Grid;
  field: FlowField;
  fieldOk = true;

  readonly fx = new Fx();
  readonly audio = new AudioEngine();

  status: GameStatus = "menu";
  time = 0;
  speed = 1;
  paused = false;
  autoStart = false;
  autoTimer = 0;

  gold: number;
  lives: number;
  kills = 0;
  wavesCompleted = 0;
  waveRunning = false;
  waveTime = 0;
  spawnQueue: SpawnEvent[] = [];

  enemies: Enemy[] = [];
  towers: Tower[] = [];
  shells: Shell[] = [];
  towerAt = new Map<string, Tower>();

  placing: TowerKind | null = null;
  hoverCell: Cell | null = null;
  selected: Tower | null = null;
  endless = false;

  best = loadBest();

  constructor() {
    this.grid = new Grid(BOARD.cols, BOARD.rows, BOARD.hexSize, BOARD.spawn, BOARD.core, BOARD.walls);
    const r = computeField(this.grid);
    this.field = r.field;
    this.fieldOk = r.ok;
    this.gold = ECON.startGold;
    this.lives = ECON.startLives;

    // dev short-cuts for balance / verification: ?wave=10&gold=9999
    // skip straight into the game, but still leave the wave for the player
    // to build first and start by hand (or with N)
    const dev = DEV.read();
    if (dev.wave !== null || dev.gold !== null) {
      this.status = "playing";
      if (dev.gold !== null) this.gold = dev.gold;
      if (dev.wave !== null) this.wavesCompleted = Math.max(0, dev.wave - 1);
    }
  }

  // ───────────────────────── setup / flow ─────────────────────────

  start(): void {
    this.audio.ensure();
    this.audio.sfx("click");
    if (this.status === "menu") this.status = "playing";
  }

  get waveNumber(): number {
    return this.wavesCompleted + 1;
  }

  get score(): number {
    return this.wavesCompleted * 500 + this.kills * 10 + this.lives * 100 + this.gold;
  }

  startWave(): void {
    if (this.waveRunning || this.status !== "playing") return;
    const w = this.waveNumber;
    const wave = getWave(w);
    const events: SpawnEvent[] = [];
    for (const g of wave.groups) {
      for (let i = 0; i < g.count; i++) events.push({ t: g.delay + i * g.gap, kind: g.kind });
    }
    events.sort((a, b) => a.t - b.t);
    this.spawnQueue = events;
    this.waveRunning = true;
    this.waveTime = 0;
    this.audio.sfx("wave");
  }

  private endWave(): void {
    this.wavesCompleted++;
    const bonus = ECON.waveBonus(this.wavesCompleted);
    this.gold += bonus;
    const c = this.grid.center(this.grid.core.col, this.grid.core.row);
    this.fx.text(c.x, c.y - this.grid.size * 1.6, `WAVE CLEAR +${bonus}`, PALETTE.gold, true);
    this.recordBest();
    if (!this.endless && this.wavesCompleted >= 20) {
      this.victory();
    } else {
      this.autoTimer = 3;
    }
  }

  private victory(): void {
    this.status = "victory";
    this.audio.sfx("victory");
    this.recordBest();
  }

  private defeat(): void {
    if (this.status !== "playing") return;
    this.status = "defeat";
    this.audio.sfx("defeat");
    this.fx.addShake(16, 0.6);
    this.recordBest();
  }

  continueEndless(): void {
    if (this.status !== "victory") return;
    this.audio.sfx("click");
    this.endless = true;
    this.status = "playing";
    this.autoTimer = 2;
  }

  private recordBest(): void {
    this.best = saveBest(this.wavesCompleted, this.score);
  }

  // ───────────────────────── building ─────────────────────────

  placingDef(): (typeof TOWER_DEFS)[TowerKind] {
    return TOWER_DEFS[this.placing ?? "lance"];
  }

  canPlace(cell: Cell): boolean {
    if (!this.grid.isBuildable(cell)) return false;
    const blocked = new Set([cellKey(cell.col, cell.row)]);
    return computeField(this.grid, blocked).ok;
  }

  setPlacing(kind: TowerKind | null): void {
    this.placing = kind;
    if (kind) {
      this.selected = null;
      this.audio.ensure();
      this.audio.sfx("select");
      document.body.classList.add("placing");
    } else {
      document.body.classList.remove("placing");
    }
  }

  private place(cell: Cell): void {
    const def = TOWER_DEFS[this.placing!];
    if (this.gold < def.cost) {
      this.audio.sfx("error");
      return;
    }
    if (!this.canPlace(cell)) {
      this.audio.sfx("error");
      return;
    }
    this.gold -= def.cost;
    const tower = new Tower(this.placing!, cell.col, cell.row, this.grid);
    this.towers.push(tower);
    this.grid.occupied.add(cellKey(cell.col, cell.row));
    this.towerAt.set(cellKey(cell.col, cell.row), tower);
    this.recompute();
    const c = this.grid.center(cell.col, cell.row);
    this.fx.ring(c.x, c.y, 8, this.grid.size * 1.2, def.color, 0.35, 2);
    this.fx.burst(c.x, c.y, { count: 10, color: def.color, speed: 150, life: 0.4, size: 2.5 });
    this.audio.sfx("place");
  }

  select(tower: Tower | null): void {
    this.selected = tower;
    if (tower) this.audio.sfx("select");
  }

  cycleTargetMode(): void {
    if (!this.selected) return;
    const i = TARGET_MODES.indexOf(this.selected.targetMode);
    this.selected.targetMode = TARGET_MODES[(i + 1) % TARGET_MODES.length];
    this.audio.sfx("click");
  }

  upgradeSelected(): void {
    const t = this.selected;
    if (!t) return;
    const cost = t.upgradeCost;
    if (cost === null || this.gold < cost) {
      this.audio.sfx("error");
      return;
    }
    this.gold -= cost;
    t.invested += cost;
    t.level++;
    this.fx.ring(t.x, t.y, 6, this.grid.size * 1.3, t.def.color, 0.4, 2.5);
    this.fx.burst(t.x, t.y, { count: 14, color: t.def.color, speed: 180, life: 0.45, size: 2.6 });
    this.audio.sfx("upgrade");
  }

  sellSelected(): void {
    const t = this.selected;
    if (!t) return;
    this.gold += t.sellValue;
    this.grid.occupied.delete(cellKey(t.col, t.row));
    this.towerAt.delete(cellKey(t.col, t.row));
    this.towers.splice(this.towers.indexOf(t), 1);
    this.recompute();
    this.fx.burst(t.x, t.y, { count: 10, color: "#9ab8d8", speed: 130, life: 0.4, size: 2.4 });
    this.fx.text(t.x, t.y - 10, `+${t.sellValue}`, PALETTE.gold);
    this.selected = null;
    this.audio.sfx("sell");
  }

  buyModule(cat: ModuleCat): void {
    const t = this.selected;
    if (!t) return;
    const c = t.moduleCost(cat);
    if (this.gold < c) {
      this.audio.sfx("error");
      return;
    }
    this.gold -= c;
    t.invested += c;
    t.addModule(cat);
    this.fx.ring(t.x, t.y, 6, this.grid.size * 1.2, t.def.color, 0.35, 2);
    this.fx.text(t.x, t.y - 16, `+${cat.toUpperCase()}`, t.def.color);
    this.audio.sfx("upgrade");
  }

  toggleRotation(): void {
    const t = this.selected;
    if (!t || t.kind !== "laser") return;
    t.toggleRotation();
    this.audio.sfx("click");
  }

  cancel(): void {
    this.setPlacing(null);
    this.selected = null;
  }

  private recompute(): void {
    const r = computeField(this.grid);
    this.field = r.field;
    this.fieldOk = r.ok;
  }

  // ───────────────────────── input ─────────────────────────

  pointerMove(x: number, y: number): void {
    const cell = pixelToCell(x, y, this.grid.size);
    this.hoverCell = this.grid.isInside(cell) ? cell : null;
  }

  pointerDown(button: number, x: number, y: number): void {
    if (this.status !== "playing") return;
    this.audio.ensure();
    if (button !== 0) {
      this.cancel();
      return;
    }
    const cell = pixelToCell(x, y, this.grid.size);
    if (!this.grid.isInside(cell)) {
      this.selected = null;
      return;
    }
    if (this.placing) {
      this.place(cell);
      return;
    }
    const tower = this.towerAt.get(cellKey(cell.col, cell.row)) ?? null;
    if (!tower && this.selected && this.selected.kind === "laser") {
      // clicking empty ground aims the selected laser's beam there
      this.selected.aimAt(x, y);
      this.audio.sfx("select");
      return;
    }
    if (!tower && this.selected) this.selected = null;
    else if (tower) this.select(tower);
  }

  setSpeed(n: number): void {
    this.speed = n;
    this.audio.sfx("click");
  }

  togglePause(): void {
    this.paused = !this.paused;
    this.audio.sfx("click");
  }

  setAuto(v: boolean): void {
    this.autoStart = v;
    if (v && !this.waveRunning) this.autoTimer = 3;
  }

  addMoney(amount: number): void {
    this.gold += amount;
    const c = this.grid.center(this.grid.spawn.col, this.grid.spawn.row);
    this.fx.text(c.x + 40, c.y - 30, `+${amount}`, PALETTE.gold, true);
    this.audio.sfx("place");
  }

  /** cheat-button amount: starts at 100 and grows by 1 per click */
  moneyClicks = 0;
  get nextMoney(): number {
    return 100 + this.moneyClicks;
  }
  cheatMoney(): void {
    this.addMoney(this.nextMoney);
    this.moneyClicks++;
  }

  /** dev hotkey (G) */
  devAddGold(amount: number): void {
    this.addMoney(amount);
  }

  // ───────────────────────── simulation ─────────────────────────

  private spawnEnemy(kind: EnemyKind): void {
    const w = this.waveNumber;
    const c = this.grid.center(this.grid.spawn.col, this.grid.spawn.row);
    const ang = Math.random() * Math.PI * 2;
    const rad = Math.random() * this.grid.size * 0.35;
    const e = new Enemy(kind, c.x + Math.cos(ang) * rad, c.y + Math.sin(ang) * rad, waveHpMult(w), waveBountyMult(w), this.grid);
    e.setSpeedPx(ENEMY_DEFS[kind].speed * this.grid.spacing);
    this.enemies.push(e);
    this.fx.burst(c.x, c.y, { count: 6, color: kind === "wraith" ? PALETTE.wraith : PALETTE.spawn, speed: 120, life: 0.3, size: 2.4 });
  }

  update(dt: number): void {
    this.time += dt;
    this.fx.update(dt);
    if (this.status !== "playing" || this.paused) return;

    // spawning
    if (this.waveRunning) {
      this.waveTime += dt;
      while (this.spawnQueue.length && this.spawnQueue[0].t <= this.waveTime) {
        this.spawnEnemy(this.spawnQueue.shift()!.kind);
      }
    }

    // towers
    const ctx = {
      enemies: this.enemies,
      fx: this.fx,
      shells: this.shells,
      grid: this.grid,
      sfx: (n: string) => this.audio.sfx(n as never),
    };
    for (const t of this.towers) t.update(dt, ctx);

    // shells
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const s = this.shells[i];
      s.t += dt;
      if (s.t < s.dur) continue;
      this.fx.ring(s.tx, s.ty, s.splash * 0.25, s.splash, s.color, 0.35, 3.5);
      this.fx.burst(s.tx, s.ty, { count: 14, color: s.color, speed: 220, life: 0.45, size: 3 });
      this.fx.addShake(3.5, 0.15);
      this.audio.sfx("boom");
      for (const e of this.enemies) {
        if (!e.alive || e.leaked || e.flying) continue;
        const d = Math.hypot(e.x - s.tx, e.y - s.ty);
        if (d <= s.splash) {
          const falloff = 1 - 0.45 * (d / s.splash);
          e.damage(Math.max(1, Math.round(s.dmg * falloff)));
        }
      }
      this.shells.splice(i, 1);
    }

    // enemies
    for (const e of this.enemies) e.update(dt, this.grid, this.field);

    // deaths & leaks
    const coreC = this.grid.center(this.grid.core.col, this.grid.core.row);
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.counted) {
        this.enemies.splice(i, 1);
        continue;
      }
      if (e.leaked) {
        e.counted = true;
        this.lives -= e.leakDamage;
        this.fx.ring(coreC.x, coreC.y, 10, this.grid.size * 2, PALETTE.red, 0.4, 4);
        this.fx.burst(coreC.x, coreC.y, { count: 18, color: PALETTE.red, speed: 260, life: 0.5, size: 3 });
        this.fx.addShake(e.kind === "boss" ? 14 : 7, 0.3);
        this.audio.sfx("leak");
        if (this.lives <= 0) {
          this.lives = 0;
          this.defeat();
        }
        this.enemies.splice(i, 1);
      } else if (!e.alive) {
        e.counted = true;
        this.gold += e.bounty;
        this.kills++;
        this.fx.burst(e.x, e.y, { count: e.kind === "boss" ? 46 : 12, color: e.color, speed: e.kind === "boss" ? 340 : 190, life: 0.5, size: e.radius * 0.16 + 2 });
        if (e.kind === "boss") this.fx.addShake(10, 0.4);
        this.fx.text(e.x, e.y - e.radius - 6, `+${e.bounty}`, PALETTE.gold, e.kind === "boss");
        this.audio.sfx("kill");
        this.enemies.splice(i, 1);
      }
    }

    // wave end
    if (this.waveRunning && this.spawnQueue.length === 0 && this.enemies.length === 0) {
      this.waveRunning = false;
      this.endWave();
    }

    // auto-start
    if (this.status === "playing" && this.autoStart && !this.waveRunning) {
      this.autoTimer -= dt;
      if (this.autoTimer <= 0) this.startWave();
    }
  }

  speedOptions(): number[] {
    return [...SPEED_OPTIONS];
  }
}
