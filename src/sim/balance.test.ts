import { describe, expect, it } from 'vitest';
import type { TowerId } from '../core/types';
import { MAP } from '../data/map';
import { STAGES } from '../data/stages';
import { WAVES } from '../data/waves';
import { mulberry32, roadsideCells, routeSamples, runBot } from './autoplay';
import type { BotRun } from './autoplay';
import { cellKey, pathSet } from './grid';
import { createDefaultBattle, createStageBattle } from './index';

const NAIVE_SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const STAGE_NAIVE_SEEDS = [1, 2, 3, 4, 5];

function typesOf(run: BotRun): Set<TowerId> {
  return new Set(run.towers.map((t) => t.id));
}

describe('robô bom', () => {
  const run = runBot('bom');

  it('vence as 15 ondas do vale com folga, terminando com pelo menos 15 vidas', () => {
    expect(WAVES).toHaveLength(15);
    expect(run.phase).toBe('vitoria');
    expect(run.lastWave).toBe(15);
    expect(run.waves).toHaveLength(15);
    expect(run.finalLives).toBeGreaterThanOrEqual(15);
  });

  it('usa vários tipos de torre e melhora as torres principais', () => {
    expect(typesOf(run).size).toBeGreaterThanOrEqual(4);
    expect(run.towers.filter((t) => t.level === 2).length).toBeGreaterThanOrEqual(3);
  });

  it('as vidas nunca aumentam ao longo das ondas', () => {
    for (let i = 1; i < run.waves.length; i++) expect(run.waves[i].lives).toBeLessThanOrEqual(run.waves[i - 1].lives);
  });
});

describe('robô mediano', () => {
  const run = runBot('mediano');

  it('perde entre as ondas 13 e 15 do vale', () => {
    expect(run.phase).toBe('derrota');
    expect(run.finalLives).toBe(0);
    expect(run.lastWave).toBeGreaterThanOrEqual(13);
    expect(run.lastWave).toBeLessThanOrEqual(15);
  });

  it('só usa arqueiros e canhões e melhora pouco', () => {
    expect([...typesOf(run)].sort()).toEqual(['arqueiro', 'canhao']);
    expect(run.towers.every((t) => t.level <= 1 && t.spec === null && t.plus === 0)).toBe(true);
    expect(run.towers.filter((t) => t.level > 0).length).toBeLessThanOrEqual(4);
  });
});

describe('robô ingênuo', () => {
  it.each(NAIVE_SEEDS)('perde entre as ondas 5 e 10 do vale com a semente %i', (seed) => {
    const run = runBot('ingenuo', { seed });
    expect(run.phase).toBe('derrota');
    expect(run.lastWave).toBeGreaterThanOrEqual(5);
    expect(run.lastWave).toBeLessThanOrEqual(10);
    expect(run.towers.every((t) => t.id === 'arqueiro' && t.level === 0)).toBe(true);
  });

  it('a mesma semente repete a mesma partida', () => {
    expect(runBot('ingenuo', { seed: 3 })).toEqual(runBot('ingenuo', { seed: 3 }));
  });
});

describe('todas as fases no Normal', () => {
  const goodLives = new Map<string, number>();

  describe.each(STAGES.map((s) => [s.id, s] as const))('%s', (_id, stage) => {
    it('o robô bom vence com pelo menos 12 vidas', () => {
      const run = runBot('bom', { stage, difficulty: 'normal' });
      expect(run.victory).toBe(true);
      expect(run.lastWave).toBe(stage.waves.length);
      expect(run.finalLives).toBeGreaterThanOrEqual(12);
      goodLives.set(stage.id, run.finalLives);
    });

    it('o robô mediano perde entre as ondas 9 e 15', () => {
      const run = runBot('mediano', { stage, difficulty: 'normal' });
      expect(run.phase).toBe('derrota');
      expect(run.lastWave).toBeGreaterThanOrEqual(9);
      expect(run.lastWave).toBeLessThanOrEqual(15);
    });

    it.each(STAGE_NAIVE_SEEDS)('o robô ingênuo perde até a onda 10 com a semente %i', (seed) => {
      const run = runBot('ingenuo', { stage, difficulty: 'normal', seed });
      expect(run.phase).toBe('derrota');
      expect(run.lastWave).toBeGreaterThanOrEqual(2);
      expect(run.lastWave).toBeLessThanOrEqual(10);
    });
  });

  it('as fases difíceis apertam mais o robô bom que as fáceis', () => {
    const livesOf = (difficulty: string) => STAGES.filter((s) => s.difficulty === difficulty).map((s) => goodLives.get(s.id) ?? runBot('bom', { stage: s }).finalLives);
    const easy = livesOf('facil');
    const hard = livesOf('dificil');
    expect(Math.max(...hard)).toBeLessThan(Math.min(...easy));
  });
});

describe('dificuldade na fase 1', () => {
  it('no Fácil o robô mediano chega pelo menos à onda 13', () => {
    const run = runBot('mediano', { stage: 'vale', difficulty: 'facil' });
    expect(run.lastWave).toBeGreaterThanOrEqual(13);
  });

  it('no Difícil o robô bom ainda vence', () => {
    const run = runBot('bom', { stage: 'vale', difficulty: 'dificil' });
    expect(run.victory).toBe(true);
    expect(run.finalLives).toBeGreaterThan(0);
  });
});

describe('apoio dos robôs', () => {
  it('mulberry32 é determinístico e fica entre 0 e 1', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('células à beira da trilha são construíveis e encostam no caminho', () => {
    const battle = createDefaultBattle();
    const road = pathSet(MAP);
    const cells = roadsideCells(battle, MAP);
    expect(cells.length).toBeGreaterThan(0);
    for (const { col, row } of cells) {
      expect(battle.canBuild(col, row)).toBe(true);
      const touches = [-1, 0, 1].some((dr) => [-1, 0, 1].some((dc) => road.has(cellKey(col + dc, row + dr))));
      expect(touches).toBe(true);
    }
  });

  it('nas fases com dois caminhos o robô bom cobre as duas entradas', () => {
    for (const stage of STAGES.filter((s) => s.map.paths.length > 1)) {
      const run = runBot('bom', { stage });
      const routes = routeSamples(createStageBattle(stage));
      const covered = routes.map((samples, i) => {
        const others = routes.filter((_, j) => j !== i).flat();
        const own = samples.filter((p) => others.every((o) => Math.hypot(o.x - p.x, o.y - p.y) > 48));
        return run.towers.some((t) => own.some((p) => Math.hypot(p.x - (t.col + 0.5) * 48, p.y - (t.row + 0.5) * 48) <= 150));
      });
      expect(covered).toEqual(routes.map(() => true));
    }
  });
});
