import { describe, expect, it } from 'vitest';
import type { EnemyId } from '../core/types';
import { cellKey, inBounds, pathSet, routeTiles } from '../sim/grid';
import { ENEMIES } from './enemies';
import { BOSS_EVERY, infiniteWave, isBossWave, stageRoster } from './infinite';
import { CASTLE, DECOR, MAP } from './map';
import { STAGES, STAGE_IDS, stageById } from './stages';
import { WAVES } from './waves';

const NEW_ENEMIES: EnemyId[] = ['curandeiro', 'escudeiro', 'lodo'];

describe('fases', () => {
  it('são 5, na ordem combinada, com nome, dificuldade e descrição', () => {
    expect(STAGE_IDS).toEqual(['vale', 'floresta', 'desfiladeiro', 'encruzilhada', 'cerco']);
    expect(STAGES.map((s) => s.difficulty)).toEqual(['facil', 'facil', 'medio', 'dificil', 'dificil']);
    for (const stage of STAGES) {
      expect(stage.name.length).toBeGreaterThan(3);
      expect(stage.description.length).toBeGreaterThan(20);
      expect(stage.description).not.toMatch(/[\u2013\u2014]/);
      expect(stage.startingGold).toBeGreaterThan(0);
      expect(stageById(stage.id)).toBe(stage);
    }
    expect(stageById('nada')).toBeUndefined();
  });

  it('o mapa padrão continua sendo o vale', () => {
    expect(MAP).toBe(STAGES[0].map);
    expect(DECOR).toBe(STAGES[0].decor);
    expect(CASTLE).toEqual({ col: 15, row: 7 });
    expect(MAP.paths).toHaveLength(1);
  });

  describe.each(STAGES.map((s) => [s.id, s] as const))('%s', (_id, stage) => {
    const road = pathSet(stage.map);

    it('é 16x10 e todo caminho termina no castelo', () => {
      expect([stage.map.cols, stage.map.rows]).toEqual([16, 10]);
      for (const route of stage.map.paths) {
        expect(route[route.length - 1]).toEqual(stage.castle);
        const first = route[0];
        expect(inBounds(stage.map, first.col, first.row)).toBe(false);
        for (let i = 1; i < route.length; i++) {
          const a = route[i - 1];
          const b = route[i];
          expect(a.col === b.col || a.row === b.row).toBe(true);
        }
      }
    });

    it('nenhum decor fica em cima do caminho e não há decor repetido', () => {
      const seen = new Set<string>();
      for (const d of stage.decor) {
        expect(road.has(cellKey(d.col, d.row))).toBe(false);
        expect(inBounds(stage.map, d.col, d.row)).toBe(true);
        expect(seen.has(cellKey(d.col, d.row))).toBe(false);
        seen.add(cellKey(d.col, d.row));
      }
    });

    it('bloqueia o decor e as vizinhas do castelo que não são caminho', () => {
      const blocked = new Set(stage.map.blocked.map((b) => cellKey(b.col, b.row)));
      for (const d of stage.decor) expect(blocked.has(cellKey(d.col, d.row))).toBe(true);
      const { col, row } = stage.castle;
      for (const [dc, dr] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const c = col + dc;
        const r = row + dr;
        if (!inBounds(stage.map, c, r) || road.has(cellKey(c, r))) continue;
        expect(blocked.has(cellKey(c, r))).toBe(true);
      }
      for (const b of stage.map.blocked) expect(road.has(cellKey(b.col, b.row))).toBe(false);
    });

    it('tem 15 ondas válidas com o chefe na onda 15', () => {
      expect(stage.waves).toHaveLength(15);
      stage.waves.forEach((wave, i) => {
        expect(wave.groups.length).toBeGreaterThan(0);
        for (const g of wave.groups) {
          expect(ENEMIES[g.enemy]).toBeDefined();
          expect(g.count).toBeGreaterThan(0);
          expect(g.hpMultiplier).toBeGreaterThan(0);
          if (g.path !== undefined) expect(g.path).toBeLessThan(stage.map.paths.length);
          if (i < 14) expect(g.enemy).not.toBe('rei');
        }
      });
      expect(stage.waves[14].groups.some((g) => g.enemy === 'rei')).toBe(true);
    });
  });

  it('os inimigos novos aparecem a partir da fase 2', () => {
    const uses = (index: number, id: EnemyId) => STAGES[index].waves.some((w) => w.groups.some((g) => g.enemy === id));
    for (const id of NEW_ENEMIES) expect(uses(0, id)).toBe(false);
    expect(uses(1, 'curandeiro') && uses(1, 'lodo')).toBe(true);
    for (let i = 2; i < STAGES.length; i++) for (const id of NEW_ENEMIES) expect(uses(i, id)).toBe(true);
    expect(WAVES).toBe(STAGES[0].waves);
  });

  it('o desfiladeiro passa duas vezes pela ponte em (6,3)', () => {
    const tiles = routeTiles(stageById('desfiladeiro')!.map.paths[0]);
    expect(tiles.filter((t) => t.col === 6 && t.row === 3)).toHaveLength(2);
  });

  it('a encruzilhada junta as duas entradas em (8,4)', () => {
    const [a, b] = stageById('encruzilhada')!.map.paths.map(routeTiles);
    const join = a.findIndex((t) => t.col === 8 && t.row === 4);
    const joinB = b.findIndex((t) => t.col === 8 && t.row === 4);
    expect(a.slice(join)).toEqual(b.slice(joinB));
  });
});

describe('ondas infinitas', () => {
  it('são válidas, determinísticas e usam os inimigos da fase', () => {
    for (const stage of STAGES) {
      const roster = new Set(stageRoster(stage));
      for (let n = 16; n <= 45; n++) {
        const wave = infiniteWave(n, stage);
        expect(infiniteWave(n, stage)).toEqual(wave);
        expect(wave.bonus).toBeGreaterThan(0);
        for (const g of wave.groups) {
          expect(g.count).toBeGreaterThan(0);
          expect(g.interval).toBeGreaterThan(0);
          expect(g.hpMultiplier).toBeGreaterThan(0);
          if (g.enemy !== 'rei') expect(roster.has(g.enemy)).toBe(true);
          if (g.path !== undefined) expect(g.path).toBeLessThan(stage.map.paths.length);
        }
      }
    }
  });

  it('o chefe aparece a cada 10 ondas depois da 15', () => {
    const stage = STAGES[0];
    const bossWaves: number[] = [];
    for (let n = 16; n <= 55; n++) if (infiniteWave(n, stage).groups.some((g) => g.enemy === 'rei')) bossWaves.push(n);
    expect(bossWaves).toEqual([25, 35, 45, 55]);
    expect(BOSS_EVERY).toBe(10);
    expect(isBossWave(25, stage)).toBe(true);
    expect(isBossWave(15, stage)).toBe(false);
  });

  it('a vida cresce cerca de 12% por onda e os intervalos encolhem', () => {
    const stage = STAGES[1];
    const hp = (n: number) => infiniteWave(n, stage).groups.find((g) => g.enemy !== 'rei')!.hpMultiplier;
    expect(hp(17) / hp(16)).toBeCloseTo(1.12, 2);
    expect(hp(30) / hp(20)).toBeCloseTo(Math.pow(1.12, 10), 1);
    const intervals = (from: number, to: number) => {
      const found = new Map<EnemyId, number>();
      for (let n = from; n <= to; n++) for (const g of infiniteWave(n, stage).groups) found.set(g.enemy, g.interval);
      return found;
    };
    const early = intervals(16, 20);
    const late = intervals(40, 44);
    const common = [...early.keys()].filter((id) => late.has(id) && id !== 'rei');
    expect(common.length).toBeGreaterThan(0);
    for (const id of common) expect(late.get(id)!).toBeLessThan(early.get(id)!);
  });
});
