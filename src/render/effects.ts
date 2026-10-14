import type { Palette } from '../theme';
import { circlePath, drawArrowDown, polyPath, starPath } from './shapes';

export const FX_RING = 0;
export const FX_DISC = 1;
export const FX_BIT = 2;
export const FX_DUST = 3;
export const FX_SPARK = 4;
export const FX_BOLT = 5;
export const FX_STAR = 6;
export const FX_ARROW = 7;
export const FX_PLUS = 8;

export const MAX_BOLT_POINTS = 16;

export const C_TOWER = 0;
export const C_ENEMY = 1;
export const C_BAD = 2;
export const C_INK = 3;
export const C_DUST = 4;
export const C_HIT = 5;
export const C_PORTAL = 6;
export const C_GOLD = 7;

export interface Effect {
  active: boolean;
  type: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  t: number;
  life: number;
  size: number;
  rot: number;
  vr: number;
  width: number;
  group: number;
  key: string;
  pts: Float32Array | null;
  count: number;
}

function blank(): Effect {
  return { active: false, type: 0, x: 0, y: 0, vx: 0, vy: 0, r: 0, t: 0, life: 1, size: 0, rot: 0, vr: 0, width: 0, group: 0, key: '', pts: null, count: 0 };
}

export function resolveColor(p: Palette, group: number, key: string): string {
  switch (group) {
    case C_TOWER:
      return (p.tower as Record<string, string>)[key] ?? p.ink;
    case C_ENEMY:
      return (p.enemy as Record<string, string>)[key] ?? p.ink;
    case C_BAD:
      return p.css.bad;
    case C_DUST:
      return p.pathEdge;
    case C_HIT:
      return p.hit;
    case C_PORTAL:
      return p.portal;
    case C_GOLD:
      return p.css.gold;
    default:
      return p.ink;
  }
}

function jitter(seed: number): number {
  const v = Math.sin(seed * 12.9898) * 43758.5453;
  return (v - Math.floor(v)) * 2 - 1;
}

function traceBolt(ctx: CanvasRenderingContext2D, fx: Effect): void {
  const pts = fx.pts;
  if (!pts) return;
  const seed = fx.rot + Math.floor(fx.t / 0.05) * 17;
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 0; i < fx.count - 1; i++) {
    const ax = pts[i * 2];
    const ay = pts[i * 2 + 1];
    const bx = pts[i * 2 + 2];
    const by = pts[i * 2 + 3];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    const parts = Math.max(2, Math.min(8, Math.round(len / 14)));
    const nx = len > 0 ? -dy / len : 0;
    const ny = len > 0 ? dx / len : 0;
    const amp = Math.min(9, len * 0.18);
    for (let j = 1; j < parts; j++) {
      const f = j / parts;
      const o = jitter(seed + i * 31 + j * 7) * amp;
      ctx.lineTo(ax + dx * f + nx * o, ay + dy * f + ny * o);
    }
    ctx.lineTo(bx, by);
  }
}

export class EffectPool {
  private items: Effect[] = [];
  private free: number[] = [];

  clear(): void {
    for (let i = 0; i < this.items.length; i++) this.items[i].active = false;
    this.rebuildFree();
  }

  private rebuildFree(): void {
    this.free.length = 0;
    for (let i = this.items.length - 1; i >= 0; i--) if (!this.items[i].active) this.free.push(i);
  }

  spawn(type: number, x: number, y: number, life: number, group: number, key: string): Effect {
    let fx: Effect;
    const idx = this.free.pop();
    if (idx !== undefined) {
      fx = this.items[idx];
    } else {
      fx = blank();
      this.items.push(fx);
    }
    fx.active = true;
    fx.type = type;
    fx.x = x;
    fx.y = y;
    fx.vx = 0;
    fx.vy = 0;
    fx.r = 0;
    fx.t = 0;
    fx.life = life;
    fx.size = 0;
    fx.rot = 0;
    fx.vr = 0;
    fx.width = 0;
    fx.group = group;
    fx.key = key;
    fx.count = 0;
    return fx;
  }

  bolt(xs: ArrayLike<number>, ys: ArrayLike<number>, n: number, life: number, width: number, group: number, key: string): void {
    const count = Math.min(n, MAX_BOLT_POINTS);
    if (count < 2) return;
    const fx = this.spawn(FX_BOLT, xs[0], ys[0], life, group, key);
    if (!fx.pts) fx.pts = new Float32Array(MAX_BOLT_POINTS * 2);
    for (let i = 0; i < count; i++) {
      fx.pts[i * 2] = xs[i];
      fx.pts[i * 2 + 1] = ys[i];
    }
    fx.count = count;
    fx.width = width;
    fx.rot = Math.random() * 1000;
  }

  arrow(x: number, y: number, delay: number, life: number, height: number, group: number, key: string): void {
    const fx = this.spawn(FX_ARROW, x, y, life, group, key);
    fx.t = -delay;
    fx.size = height;
    fx.vr = (Math.random() - 0.5) * 0.3;
  }

  delayedRing(x: number, y: number, r: number, delay: number, life: number, width: number, group: number, key: string): void {
    const fx = this.spawn(FX_RING, x, y, life, group, key);
    fx.t = -delay;
    fx.r = r;
    fx.width = width;
  }

  rise(type: number, x: number, y: number, count: number, spread: number, speed: number, size: number, life: number, group: number, key: string): void {
    for (let i = 0; i < count; i++) {
      const fx = this.spawn(type, x + (Math.random() - 0.5) * spread, y + (Math.random() - 0.5) * spread * 0.5, life * (0.8 + Math.random() * 0.4), group, key);
      fx.vx = (Math.random() - 0.5) * speed * 0.3;
      fx.vy = -speed * (0.7 + Math.random() * 0.6);
      fx.size = size * (0.8 + Math.random() * 0.4);
      fx.t = -Math.random() * 0.12;
    }
  }

  ring(x: number, y: number, r: number, life: number, width: number, group: number, key: string): void {
    const fx = this.spawn(FX_RING, x, y, life, group, key);
    fx.r = r;
    fx.width = width;
  }

  disc(x: number, y: number, r: number, life: number, group: number, key: string): void {
    const fx = this.spawn(FX_DISC, x, y, life, group, key);
    fx.r = r;
  }

  burst(type: number, x: number, y: number, count: number, speed: number, size: number, life: number, group: number, key: string): void {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const v = speed * (0.6 + Math.random() * 0.8);
      const fx = this.spawn(type, x, y, life * (0.8 + Math.random() * 0.4), group, key);
      fx.vx = Math.cos(a) * v;
      fx.vy = Math.sin(a) * v;
      fx.size = size * (0.7 + Math.random() * 0.6);
      fx.rot = Math.random() * Math.PI;
      fx.vr = (Math.random() - 0.5) * 8;
    }
  }

  update(dt: number): void {
    for (let i = 0; i < this.items.length; i++) {
      const fx = this.items[i];
      if (!fx.active) continue;
      fx.t += dt;
      if (fx.t >= fx.life) {
        fx.active = false;
        this.free.push(i);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, p: Palette): void {
    for (let i = 0; i < this.items.length; i++) {
      const fx = this.items[i];
      if (!fx.active || fx.t < 0) continue;
      const k = fx.t / fx.life;
      const color = resolveColor(p, fx.group, fx.key);
      switch (fx.type) {
        case FX_RING: {
          ctx.strokeStyle = color;
          ctx.globalAlpha = 1 - k;
          ctx.lineWidth = fx.width * (1 - k) + 0.8;
          circlePath(ctx, fx.x, fx.y, fx.r * (0.3 + k * 0.7));
          ctx.stroke();
          break;
        }
        case FX_DISC: {
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.25 * (1 - k);
          circlePath(ctx, fx.x, fx.y, fx.r * (0.5 + k * 0.5));
          ctx.fill();
          break;
        }
        case FX_BIT: {
          const travel = fx.t - (fx.t * fx.t) / (2 * fx.life);
          const x = fx.x + fx.vx * travel;
          const y = fx.y + fx.vy * travel;
          const s = fx.size * (1 - k * 0.5);
          ctx.fillStyle = color;
          ctx.globalAlpha = 1 - k;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(fx.rot + fx.vr * fx.t);
          ctx.fillRect(-s / 2, -s / 2, s, s);
          ctx.restore();
          break;
        }
        case FX_DUST: {
          const travel = fx.t - (fx.t * fx.t) / (2 * fx.life);
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.8 * (1 - k);
          circlePath(ctx, fx.x + fx.vx * travel, fx.y + fx.vy * travel, fx.size * (0.6 + k * 0.6));
          ctx.fill();
          break;
        }
        case FX_SPARK: {
          const travel = fx.t - (fx.t * fx.t) / (2 * fx.life);
          ctx.fillStyle = color;
          ctx.globalAlpha = 1 - k;
          polyPath(ctx, fx.x + fx.vx * travel, fx.y + fx.vy * travel - k * 10, fx.size * (1 - k * 0.6), 4, fx.rot + fx.vr * fx.t);
          ctx.fill();
          break;
        }
        case FX_BOLT: {
          ctx.strokeStyle = color;
          ctx.globalAlpha = 0.35 * (1 - k);
          ctx.lineWidth = fx.width * 3.2;
          traceBolt(ctx, fx);
          ctx.stroke();
          ctx.strokeStyle = p.hit;
          ctx.globalAlpha = 1 - k * 0.8;
          ctx.lineWidth = fx.width;
          traceBolt(ctx, fx);
          ctx.stroke();
          break;
        }
        case FX_STAR: {
          const travel = fx.t - (fx.t * fx.t) / (2 * fx.life);
          ctx.fillStyle = color;
          ctx.globalAlpha = 1 - k * k;
          const s = fx.size * (1 - k * 0.5);
          starPath(ctx, fx.x + fx.vx * travel, fx.y + fx.vy * travel, s, s * 0.45, 5, fx.rot + fx.vr * fx.t);
          ctx.fill();
          break;
        }
        case FX_ARROW: {
          const e = k * k;
          ctx.fillStyle = color;
          ctx.globalAlpha = k < 0.85 ? 1 : (1 - k) / 0.15;
          drawArrowDown(ctx, fx.x + fx.size * 0.35 * (1 - e), fx.y - fx.size * (1 - e), fx.size * 0.32, fx.vr + 0.32);
          break;
        }
        case FX_PLUS: {
          const s = fx.size;
          const x = fx.x + fx.vx * fx.t;
          const y = fx.y + fx.vy * fx.t;
          ctx.fillStyle = color;
          ctx.globalAlpha = 1 - k;
          ctx.fillRect(x - s * 0.18, y - s * 0.6, s * 0.36, s * 1.2);
          ctx.fillRect(x - s * 0.6, y - s * 0.18, s * 1.2, s * 0.36);
          break;
        }
      }
    }
    ctx.globalAlpha = 1;
  }
}
