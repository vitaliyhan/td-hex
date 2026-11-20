import { cellKey, hexDistance, hexPath, parseKey } from "../hex";
import { tracePath } from "../path";
import { shellPos } from "../projectiles";
import { drawGlow } from "./glow";
import { drawCore, drawEnemy, drawPortal, drawTower } from "./sprites";
import type { Game } from "../game";

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private view = { s: 1, ox: 0, oy: 0 };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas not supported");
    this.ctx = ctx;
  }

  resize(): void {
    const { canvas } = this;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    // hard clamp guards against any CSS feedback loop blowing up the buffer
    const w = Math.min(8000, Math.max(320, canvas.clientWidth || window.innerWidth));
    const h = Math.min(8000, Math.max(240, canvas.clientHeight || window.innerHeight));
    canvas.width = Math.round(w * this.dpr);
    canvas.height = Math.round(h * this.dpr);
  }

  computeView(boardW: number, boardH: number): void {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const padX = 48;
    const padTop = 86;
    const padBottom = 118;
    const s = Math.min((w - padX * 2) / boardW, (h - padTop - padBottom) / boardH);
    this.view.s = Math.min(2.2, s);
    this.view.ox = (w - boardW * this.view.s) / 2;
    this.view.oy = padTop + (h - padTop - padBottom - boardH * this.view.s) / 2;
  }

  clientToWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - this.view.ox) / this.view.s,
      y: (clientY - rect.top - this.view.oy) / this.view.s,
    };
  }

  draw(game: Game): void {
    const { ctx, dpr } = this;
    const grid = game.grid;
    const t = game.time;
    const W = this.canvas.width / dpr;
    const H = this.canvas.height / dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // ── background ──
    const bg = ctx.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, Math.max(W, H) * 0.72);
    bg.addColorStop(0, "#0a1626");
    bg.addColorStop(0.55, "#060b16");
    bg.addColorStop(1, "#03050a");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // screen shake (in world view space)
    let sx = 0;
    let sy = 0;
    if (game.fx.shakeT > 0) {
      const m = game.fx.shakeMag * (game.fx.shakeT / game.fx.shakeDur);
      sx = (Math.random() - 0.5) * 2 * m;
      sy = (Math.random() - 0.5) * 2 * m;
    }
    ctx.translate(this.view.ox + sx, this.view.oy + sy);
    ctx.scale(this.view.s, this.view.s);

    // ── hex lattice ──
    ctx.lineWidth = 1 / this.view.s;
    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        const key = cellKey(col, row);
        if (grid.occupied.has(key) || grid.walls.has(key)) continue;
        const c = grid.center(col, row);
        const pulse = 0.05 + 0.035 * Math.sin(t * 1.3 - hexDistance({ col, row }, grid.core) * 0.55);
        ctx.strokeStyle = `rgba(90,200,255,${pulse})`;
        ctx.beginPath();
        hexPath(ctx, c.x, c.y, grid.size - 1.5);
        ctx.stroke();
      }
    }

    // ── walls: impassable barriers ──
    for (const key of grid.walls) {
      const cell = parseKey(key);
      const c = grid.center(cell.col, cell.row);
      ctx.globalCompositeOperation = "lighter";
      drawGlow(ctx, "#3f6f9e", c.x, c.y, grid.size * 1.1, 0.12);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(18,32,52,0.96)";
      ctx.strokeStyle = "rgba(140,200,245,0.55)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      hexPath(ctx, c.x, c.y, grid.size - 1.5);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "rgba(140,200,245,0.22)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      hexPath(ctx, c.x, c.y, grid.size * 0.66);
      ctx.stroke();
      // hazard corner marks
      ctx.strokeStyle = "rgba(255,181,71,0.5)";
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
        const rx = c.x + Math.cos(a) * grid.size * 0.42;
        const ry = c.y + Math.sin(a) * grid.size * 0.42;
        ctx.beginPath();
        ctx.moveTo(rx - 3, ry - 3);
        ctx.lineTo(rx + 3, ry + 3);
        ctx.moveTo(rx - 3, ry + 3);
        ctx.lineTo(rx + 3, ry - 3);
        ctx.stroke();
      }
    }

    // core pulse rings
    const coreC = grid.center(grid.core.col, grid.core.row);
    const ringPhase = (t * 0.55) % 1;
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 1 - ringPhase;
    ctx.strokeStyle = "rgba(52,231,255,0.30)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(coreC.x, coreC.y, grid.spacing * (0.8 + ringPhase * 2.2), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    // ── enemy path preview ──
    if (game.fieldOk && game.status !== "menu") {
      const cells = tracePath(grid.spawn, grid, game.field);
      ctx.setLineDash([5, 9]);
      ctx.lineDashOffset = -t * 46;
      ctx.strokeStyle = "rgba(110,215,255,0.16)";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      for (let i = 0; i < cells.length; i++) {
        const c = grid.center(cells[i].col, cells[i].row);
        if (i === 0) ctx.moveTo(c.x, c.y);
        else ctx.lineTo(c.x, c.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // ── placement ghost + range ──
    if (game.placing && game.hoverCell) {
      const cell = game.hoverCell;
      const def = game.placingDef();
      const c = grid.center(cell.col, cell.row);
      const ok = game.canPlace(cell) && game.gold >= def.cost;
      const color = ok ? "#62ff8f" : "#ff4d5e";
      ctx.globalCompositeOperation = "lighter";
      drawGlow(ctx, def.color, c.x, c.y, grid.size * 0.9, 0.18);
      ctx.globalCompositeOperation = "source-over";
      // range ring (skipped for the laser — its beam crosses the whole map)
      if (def.levels[0].range > 0) {
        const rangePx = def.levels[0].range * grid.spacing;
        ctx.fillStyle = `${def.color}0e`;
        ctx.strokeStyle = `${def.color}55`;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.arc(c.x, c.y, rangePx, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // ghost hex
      ctx.fillStyle = ok ? "rgba(98,255,143,0.13)" : "rgba(255,77,94,0.16)";
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      hexPath(ctx, c.x, c.y, grid.size - 2);
      ctx.fill();
      ctx.stroke();
    }

    // selected tower range
    if (game.selected) {
      const s = game.selected;
      if (s.kind === "laser") {
        // laser aim preview: faint full-map beam band along current facing
        const ex = s.x + Math.cos(s.angle) * s.beamLen;
        const ey = s.y + Math.sin(s.angle) * s.beamLen;
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = s.def.color;
        ctx.globalAlpha = 0.08;
        ctx.lineWidth = (s.stats.width ?? 5) * 2;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 8]);
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      } else {
        const rangePx = s.stats.range * grid.spacing;
        ctx.fillStyle = `${s.def.color}0c`;
        ctx.strokeStyle = `${s.def.color}66`;
        ctx.lineWidth = 1.3;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.arc(s.x, s.y, rangePx, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // ── specials ──
    const spawnC = grid.center(grid.spawn.col, grid.spawn.row);
    drawPortal(ctx, spawnC.x, spawnC.y, grid.size, t);
    drawCore(ctx, coreC.x, coreC.y, grid.size, t);

    // ── towers ──
    for (const tower of game.towers) drawTower(ctx, tower, grid.size);

    // ── shells ──
    for (const s of game.shells) {
      const p = shellPos(s);
      const tp = shellPos({ ...s, t: Math.max(0, s.t - 0.12) });
      ctx.globalCompositeOperation = "lighter";
      drawGlow(ctx, s.color, tp.x, tp.y, 9, 0.25);
      drawGlow(ctx, s.color, p.x, p.y, 13, 0.5);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── enemies ──
    for (const e of game.enemies) {
      if (e.alive && !e.leaked) drawEnemy(ctx, e, t);
    }

    // ── fx on top ──
    game.fx.draw(ctx);
  }
}
