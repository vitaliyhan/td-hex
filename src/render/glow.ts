// Pre-rendered additive glow sprites, one per colour, so the hot loop just
// drawImage()s instead of building radial gradients every frame.

const cache = new Map<string, HTMLCanvasElement>();
const R = 128; // sprite texture radius

function build(color: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = R * 2;
  const ctx = c.getContext("2d")!;
  const grad = ctx.createRadialGradient(R, R, 0, R, R, R);
  grad.addColorStop(0, `${color}FF`);
  grad.addColorStop(0.25, `${color}80`);
  grad.addColorStop(0.55, `${color}2A`);
  grad.addColorStop(1, `${color}00`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, R * 2, R * 2);
  return c;
}

/**
 * Additive glow blob. Caller must set globalCompositeOperation to "lighter"
 * where a strong bloom is wanted, or keep "source-over" for soft light.
 */
export function drawGlow(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, radius: number, alpha: number): void {
  if (alpha <= 0) return;
  let sprite = cache.get(color);
  if (!sprite) {
    sprite = build(color);
    cache.set(color, sprite);
  }
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * Math.min(1, alpha);
  ctx.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
  ctx.globalAlpha = prev;
}
