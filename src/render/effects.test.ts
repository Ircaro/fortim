import { describe, expect, it } from 'vitest';
import { C_GOLD, C_TOWER, EffectPool, FX_BOLT, MAX_BOLT_POINTS, resolveColor } from './effects';
import { palette } from '../theme';

function fakeCtx(): { ctx: CanvasRenderingContext2D; calls: string[] } {
  const calls: string[] = [];
  const target: Record<string, unknown> = {};
  const ctx = new Proxy(target, {
    get(obj, key: string) {
      if (key in obj) return obj[key];
      return () => {
        calls.push(key);
      };
    },
    set(obj, key: string, value) {
      obj[key] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

describe('EffectPool', () => {
  it('copia os pontos do raio e limita a capacidade', () => {
    const pool = new EffectPool();
    const n = MAX_BOLT_POINTS + 4;
    const xs = Array.from({ length: n }, (_, i) => i * 10);
    const ys = Array.from({ length: n }, (_, i) => i * 5);
    pool.bolt(xs, ys, n, 0.15, 2, C_TOWER, 'raio');
    const items = (pool as unknown as { items: { type: number; count: number; pts: Float32Array; active: boolean }[] }).items;
    const bolt = items.find((e) => e.type === FX_BOLT && e.active);
    expect(bolt?.count).toBe(MAX_BOLT_POINTS);
    expect(bolt?.pts[2]).toBe(10);
    expect(bolt?.pts[3]).toBe(5);
  });

  it('ignora raio com menos de dois pontos', () => {
    const pool = new EffectPool();
    pool.bolt([1], [1], 1, 0.15, 2, C_TOWER, 'raio');
    const items = (pool as unknown as { items: unknown[] }).items;
    expect(items).toHaveLength(0);
  });

  it('reaproveita efeitos que terminaram', () => {
    const pool = new EffectPool();
    pool.ring(0, 0, 10, 0.1, 2, C_GOLD, '');
    pool.update(0.2);
    pool.ring(0, 0, 10, 0.1, 2, C_GOLD, '');
    const items = (pool as unknown as { items: unknown[] }).items;
    expect(items).toHaveLength(1);
  });

  it('não desenha efeito atrasado antes da hora', () => {
    const pool = new EffectPool();
    pool.delayedRing(0, 0, 10, 0.3, 0.2, 2, C_GOLD, '');
    const { ctx, calls } = fakeCtx();
    pool.update(0.1);
    pool.draw(ctx, palette());
    expect(calls).not.toContain('stroke');
    pool.update(0.25);
    pool.draw(ctx, palette());
    expect(calls).toContain('stroke');
    pool.update(0.5);
    const items = (pool as unknown as { items: { active: boolean }[] }).items;
    expect(items.every((e) => !e.active)).toBe(true);
  });

  it('resolve as cores pelo grupo', () => {
    const p = palette();
    expect(resolveColor(p, C_TOWER, 'raio')).toBe(p.tower.raio);
    expect(resolveColor(p, C_GOLD, '')).toBe(p.css.gold);
  });
});
