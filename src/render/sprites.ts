import { hexPath } from "../hex";
import { drawGlow } from "./glow";
import type { Enemy } from "../enemies";
import type { Tower } from "../towers";

const TAU = Math.PI * 2;

export function drawCore(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, time: number): void {
  const comp = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = "lighter";
  const pulse = 0.75 + Math.sin(time * 2.2) * 0.15;
  drawGlow(ctx, "#00ff41", x, y, size * 2.6 * pulse, 0.55);
  ctx.globalCompositeOperation = comp;

  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(120,255,160,0.25)";
  ctx.beginPath();
  hexPath(ctx as unknown as CanvasRenderingContext2D, x, y, size * 1.15);
  ctx.stroke();

  ctx.strokeStyle = "#c9ffd6";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  hexPath(ctx as unknown as CanvasRenderingContext2D, x, y, size * 0.82);
  ctx.stroke();

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(time * 0.7);
  ctx.strokeStyle = "rgba(0,255,65,0.9)";
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 3; i++) {
    const a0 = (i / 3) * TAU;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.5, a0, a0 + 0.9);
    ctx.stroke();
  }
  ctx.rotate(-time * 1.5);
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.26, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

export function drawPortal(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, time: number): void {
  const comp = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = "lighter";
  drawGlow(ctx, "#ff2b2b", x, y, size * 1.8 * (0.8 + Math.sin(time * 3) * 0.12), 0.45);
  ctx.globalCompositeOperation = comp;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(time * 1.4);
  ctx.strokeStyle = "rgba(255,110,110,0.9)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const a0 = (i / 3) * TAU;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.62, a0, a0 + 1.3);
    ctx.stroke();
  }
  ctx.rotate(-time * 2.6);
  ctx.strokeStyle = "rgba(255,43,43,0.7)";
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.38, 0.4, 2.4);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.38, 3.6, 5.5);
  ctx.stroke();
  ctx.restore();
}

const levelRingSizes = [0, 0.6, 0.86];

export function drawTower(ctx: CanvasRenderingContext2D, t: Tower, size: number): void {
  const color = t.def.color;
  const comp = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = "lighter";
  drawGlow(ctx, color, t.x, t.y, size * 1.15, 0.34);
  if (t.flash > 0) {
    const fx = t.x + Math.cos(t.angle) * size * 0.55;
    const fy = t.y + Math.sin(t.angle) * size * 0.55;
    drawGlow(ctx, color, fx, fy, size * (0.5 + t.flash * 4), 0.8 * (t.flash / 0.12));
  }
  if (t.kind === "cryo" && t.pulse > 0) {
    const prog = 1 - t.pulse / 0.4;
    const r = t.stats.range * Math.sqrt(3) * size * (0.3 + 0.85 * prog);
    ctx.strokeStyle = color;
    ctx.globalAlpha = t.pulse / 0.4;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (t.kind === "laser" && t.beamT > 0) {
    // live piercing beam across the whole map
    const st = t.stats;
    const w = (st.width ?? 5) * (0.85 + Math.random() * 0.3);
    const ex = t.x + Math.cos(t.angle) * t.beamLen;
    const ey = t.y + Math.sin(t.angle) * t.beamLen;
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = "#b8ffd0";
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = w * 3.4;
    ctx.beginPath();
    ctx.moveTo(t.x, t.y);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.strokeStyle = "#ffffff";
    ctx.globalAlpha = 0.95;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(t.x, t.y);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = comp;
  }
  ctx.globalCompositeOperation = comp;

  // base plate
  ctx.strokeStyle = `${color}cc`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  hexPath(ctx, t.x, t.y, size * 0.62);
  ctx.stroke();
  ctx.fillStyle = `${color}14`;
  ctx.fill();

  for (let lvl = 1; lvl <= t.level; lvl++) {
    ctx.strokeStyle = `${color}66`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    hexPath(ctx, t.x, t.y, size * levelRingSizes[lvl]);
    ctx.stroke();
  }

  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.4;

  /** draw one barrel per gun, fanned parallel around the facing */
  const barrels = (n: number, len: number, spread: number): void => {
    ctx.rotate(t.angle);
    ctx.lineWidth = 2;
    for (let i = 0; i < n; i++) {
      const off = n === 1 ? 0 : (i - (n - 1) / 2) * spread;
      ctx.beginPath();
      ctx.moveTo(-size * 0.18, off);
      ctx.lineTo(size * len, off);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(size * len, off, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.rotate(-t.angle);
  };

  switch (t.kind) {
    case "lance": {
      barrels(Math.min(6, t.gunCount), 0.55, 3.4);
      ctx.beginPath();
      ctx.moveTo(-size * 0.22, -size * 0.18);
      ctx.lineTo(-size * 0.34, 0);
      ctx.lineTo(-size * 0.22, size * 0.18);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "sentinel": {
      // long sniper rails with a scope block
      barrels(Math.min(6, t.gunCount), 0.72, 4.5);
      ctx.rotate(t.angle);
      ctx.lineWidth = 1.6;
      ctx.strokeRect(size * 0.08, -size * 0.14, size * 0.2, size * 0.28);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(size * 0.72, 0, 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.rotate(-t.angle);
      break;
    }
    case "flak": {
      barrels(Math.min(6, t.gunCount), 0.4, 3.8);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.26, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case "cryo": {
      ctx.rotate(t.pulse > 0 ? performance.now() * 0.0015 : performance.now() * 0.0004);
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        ctx.rotate(Math.PI / 3);
        ctx.beginPath();
        ctx.moveTo(-size * 0.42, 0);
        ctx.lineTo(size * 0.42, 0);
        ctx.stroke();
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(s * size * 0.28, 0);
          ctx.lineTo(s * size * 0.36, -size * 0.09);
          ctx.moveTo(s * size * 0.28, 0);
          ctx.lineTo(s * size * 0.36, size * 0.09);
          ctx.stroke();
        }
      }
      break;
    }
    case "mortar": {
      barrels(Math.min(6, t.gunCount), 0.42, 3.6);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.2, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case "arc": {
      ctx.lineWidth = 1.8;
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.arc(0, 0, size * (0.2 + i * 0.14), 0.5, 3.6);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, size * (0.2 + i * 0.14), 3.9, 6.5);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "laser": {
      ctx.rotate(t.angle);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-size * 0.3, -size * 0.32);
      ctx.lineTo(size * 0.45, 0);
      ctx.lineTo(-size * 0.3, size * 0.32);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = t.beamT > 0 ? "#ffffff" : color;
      ctx.beginPath();
      ctx.arc(-size * 0.1, 0, size * 0.15, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
  ctx.restore();

  // level pips
  for (let i = 0; i <= t.level; i++) {
    ctx.fillStyle = color;
    ctx.fillRect(t.x - 8 + i * 7, t.y + size * 0.7, 4, 4);
  }
}

export function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, time: number): void {
  const color = e.color;
  const r = e.radius;
  const comp = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = "lighter";
  drawGlow(ctx, color, e.x, e.y, r * 2.2, e.flying ? 0.4 : 0.5);
  ctx.globalCompositeOperation = comp;

  ctx.save();
  ctx.translate(e.x, e.y);

  switch (e.kind) {
    case "scout": {
      ctx.rotate(e.angle);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.lineTo(-r * 0.7, r * 0.7);
      ctx.lineTo(-r * 0.35, 0);
      ctx.lineTo(-r * 0.7, -r * 0.7);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case "runner": {
      ctx.rotate(e.angle);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(r * 1.25, 0);
      ctx.lineTo(-r * 0.5, r * 0.42);
      ctx.lineTo(-r * 0.9, 0);
      ctx.lineTo(-r * 0.5, -r * 0.42);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = `${color}33`;
      ctx.fill();
      break;
    }
    case "swarm": {
      ctx.rotate(e.angle + time * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r, 0);
      ctx.lineTo(0, -r);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case "brute": {
      ctx.rotate(e.angle);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      hexPath(ctx, 0, 0, r);
      ctx.stroke();
      ctx.fillStyle = `${color}22`;
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      hexPath(ctx, 0, 0, r * 0.55);
      ctx.stroke();
      break;
    }
    case "wraith": {
      ctx.rotate(e.angle);
      ctx.globalAlpha = 0.75 + Math.sin(time * 5 + e.id) * 0.15;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
      ctx.stroke();
      // ghost trail
      ctx.beginPath();
      ctx.moveTo(-r * 0.6, -r * 0.5);
      ctx.lineTo(-r * 1.5, -r * 0.15);
      ctx.lineTo(-r * 1.15, 0);
      ctx.lineTo(-r * 1.5, r * 0.15);
      ctx.lineTo(-r * 0.6, r * 0.5);
      ctx.stroke();
      ctx.globalAlpha = 1;
      break;
    }
    case "boss": {
      ctx.strokeStyle = color;
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      hexPath(ctx, 0, 0, r);
      ctx.stroke();
      ctx.fillStyle = `${color}1f`;
      ctx.fill();
      ctx.save();
      ctx.rotate(time * 1.1);
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const px = Math.cos(a) * r * 0.62;
        const py = Math.sin(a) * r * 0.62;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
      break;
    }
  }
  ctx.restore();

  // slowed marker
  if (e.slowFactor > 0) {
    ctx.fillStyle = "#c9ffd6";
    ctx.beginPath();
    ctx.arc(e.x, e.y - r - 8, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // hp bar
  if (e.hp < e.maxHp) {
    const w = Math.max(14, r * 2.4);
    const x = e.x - w / 2;
    const y = e.y - r - (e.kind === "boss" ? 16 : 11);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(x - 1, y - 1, w + 2, 5);
    const frac = e.hp / e.maxHp;
    ctx.fillStyle = frac > 0.5 ? "#00ff41" : frac > 0.25 ? "#8aff00" : "#ff2b2b";
    ctx.fillRect(x, y, w * frac, 3);
  }
}
