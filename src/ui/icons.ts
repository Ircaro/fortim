import type { TowerId } from '../core/types';
import { palette } from '../theme';

function poly(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, n: number, rot: number): void {
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    if (i === 0) ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    else ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, len: number, color: string): void {
  const k = r * 0.7071;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - k, y + k);
  ctx.lineTo(x + k, y - k);
  ctx.lineTo(x + k + len, y - k + len);
  ctx.lineTo(x - k + len, y + k + len);
  ctx.closePath();
  ctx.fill();
}

export function drawTowerShape(ctx: CanvasRenderingContext2D, id: TowerId, x: number, y: number, s: number, aim: number): void {
  const p = palette();
  ctx.fillStyle = p.tower[id];
  if (id === 'arqueiro') {
    ctx.beginPath();
    ctx.arc(x, y, s * 0.36, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(aim);
    ctx.fillStyle = p.bg;
    ctx.beginPath();
    ctx.moveTo(s * 0.3, 0);
    ctx.lineTo(-s * 0.12, -s * 0.16);
    ctx.lineTo(-s * 0.12, s * 0.16);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else if (id === 'canhao') {
    rounded(ctx, x - s * 0.34, y - s * 0.34, s * 0.68, s * 0.68, s * 0.12);
    ctx.fill();
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(aim);
    ctx.fillStyle = p.bg;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.17, 0, Math.PI * 2);
    ctx.fill();
    rounded(ctx, 0, -s * 0.09, s * 0.46, s * 0.18, s * 0.05);
    ctx.fill();
    ctx.restore();
  } else if (id === 'gelo') {
    poly(ctx, x, y, s * 0.38, 6, Math.PI / 6);
    ctx.fill();
    ctx.fillStyle = p.bg;
    poly(ctx, x, y, s * 0.16, 6, 0.3);
    ctx.fill();
  } else if (id === 'mago') {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    rounded(ctx, -s * 0.27, -s * 0.27, s * 0.54, s * 0.54, s * 0.06);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = p.bg;
    ctx.beginPath();
    ctx.arc(x, y, s * 0.11, 0, Math.PI * 2);
    ctx.fill();
  } else if (id === 'raio') {
    poly(ctx, x, y, s * 0.36, 3, -Math.PI / 2);
    ctx.fill();
    ctx.fillStyle = p.bg;
    ctx.beginPath();
    ctx.arc(x, y + s * 0.04, s * 0.1, 0, Math.PI * 2);
    ctx.fill();
  } else {
    poly(ctx, x, y, s * 0.36, 8, Math.PI / 8);
    ctx.fill();
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(aim);
    ctx.fillStyle = p.bg;
    rounded(ctx, -s * 0.1, -s * 0.05, s * 0.58, s * 0.1, s * 0.04);
    ctx.fill();
    ctx.fillRect(-s * 0.04, -s * 0.24, s * 0.08, s * 0.48);
    ctx.restore();
  }
}

export function drawTowerIcon(canvas: HTMLCanvasElement, id: TowerId): void {
  const size = 96;
  if (canvas.width !== size) canvas.width = size;
  if (canvas.height !== size) canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, size, size);
  const c = size * 0.46;
  shadow(ctx, c, c, size * 0.3, size * 0.16, palette().shadow);
  drawTowerShape(ctx, id, c, c, size * 0.86, -0.6);
}
