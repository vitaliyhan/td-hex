import { drawGlow } from "./render/glow";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  drag: number;
}

interface FloatText {
  x: number;
  y: number;
  txt: string;
  color: string;
  life: number;
  max: number;
  big: boolean;
}

interface Ring {
  x: number;
  y: number;
  r0: number;
  r1: number;
  life: number;
  max: number;
  color: string;
  width: number;
}

interface Beam {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  life: number;
  max: number;
  color: string;
  width: number;
}

interface Bolt {
  pts: number[]; // flat x,y pairs
  life: number;
  max: number;
  color: string;
}

interface BurstOpts {
  count?: number;
  color: string;
  speed?: number;
  life?: number;
  size?: number;
  drag?: number;
  spread?: number; // default 2PI
  dir?: number; // radians; limits the cone
}

const MAX_PARTICLES = 1500;

export class Fx {
  private particles: Particle[] = [];
  private texts: FloatText[] = [];
  private rings: Ring[] = [];
  private beams: Beam[] = [];
  private bolts: Bolt[] = [];

  shakeMag = 0;
  shakeDur = 0;
  shakeT = 0;

  burst(x: number, y: number, o: BurstOpts): void {
    const n = o.count ?? 12;
    const speed = o.speed ?? 140;
    const life = o.life ?? 0.5;
    const size = o.size ?? 3;
    const drag = o.drag ?? 2.2;
    const spread = o.spread ?? Math.PI * 2;
    for (let i = 0; i < n; i++) {
      if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
      const a = (o.dir ?? 0) + (Math.random() - 0.5) * spread;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: life * (0.6 + Math.random() * 0.6),
        max: life,
        size: size * (0.7 + Math.random() * 0.8),
        color: o.color,
        drag,
      });
    }
  }

  ring(x: number, y: number, r0: number, r1: number, color: string, dur = 0.4, width = 3): void {
    this.rings.push({ x, y, r0, r1, life: dur, max: dur, color, width });
  }

  beam(x1: number, y1: number, x2: number, y2: number, color: string, dur = 0.12, width = 3): void {
    this.beams.push({ x1, y1, x2, y2, life: dur, max: dur, color, width });
  }

  bolt(points: number[], color: string, dur = 0.18): void {
    this.bolts.push({ pts: points, life: dur, max: dur, color });
  }

  text(x: number, y: number, txt: string, color: string, big = false): void {
    this.texts.push({ x, y, txt, color, life: big ? 1.1 : 0.8, max: big ? 1.1 : 0.8, big });
  }

  addShake(mag: number, dur = 0.25): void {
    this.shakeMag = Math.min(22, Math.max(this.shakeMag, mag));
    this.shakeDur = Math.max(this.shakeDur, dur);
    this.shakeT = this.shakeDur;
  }

  update(dt: number): void {
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      if (this.shakeT <= 0) this.shakeMag = 0;
    }
    const ps = this.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) {
        ps.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const f = Math.max(0, 1 - p.drag * dt);
      p.vx *= f;
      p.vy *= f;
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      t.y -= 26 * dt;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      if (r.life <= 0) this.rings.splice(i, 1);
    }
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.life -= dt;
      if (b.life <= 0) this.beams.splice(i, 1);
    }
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.life -= dt;
      if (b.life <= 0) this.bolts.splice(i, 1);
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const prevComp = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = "lighter";

    for (const p of this.particles) {
      const a = p.life / p.max;
      drawGlow(ctx, p.color, p.x, p.y, p.size * (1 + a * 1.6), a * 0.9);
    }

    for (const b of this.beams) {
      const a = b.life / b.max;
      ctx.strokeStyle = b.color;
      ctx.globalAlpha = a * 0.85;
      ctx.lineWidth = b.width * a;
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();
      ctx.globalAlpha = a * 0.25;
      ctx.lineWidth = b.width * a * 3.2;
      ctx.stroke();
    }

    for (const b of this.bolts) {
      const a = b.life / b.max;
      ctx.strokeStyle = "#ffffff";
      ctx.globalAlpha = a;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(b.pts[0], b.pts[1]);
      for (let i = 2; i < b.pts.length; i += 2) ctx.lineTo(b.pts[i], b.pts[i + 1]);
      ctx.stroke();
      ctx.strokeStyle = b.color;
      ctx.globalAlpha = a * 0.45;
      ctx.lineWidth = 5;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    for (const r of this.rings) {
      const t = 1 - r.life / r.max;
      const rad = r.r0 + (r.r1 - r.r0) * t;
      ctx.globalAlpha = (1 - t) * 0.8;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * (1 - t) + 0.5;
      ctx.beginPath();
      ctx.arc(r.x, r.y, rad, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.globalCompositeOperation = prevComp;

    for (const t of this.texts) {
      const a = Math.min(1, t.life / t.max * 2);
      ctx.globalAlpha = a;
      ctx.font = `${t.big ? 700 : 600} ${t.big ? 19 : 14}px Rajdhani, monospace`;
      ctx.textAlign = "center";
      ctx.fillStyle = t.color;
      ctx.fillText(t.txt, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  get active(): boolean {
    return this.particles.length + this.rings.length + this.beams.length + this.bolts.length + this.texts.length > 0;
  }
}
