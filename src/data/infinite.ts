import type { EnemyId, WaveDef, WaveGroup } from '../core/types';
import type { StageDef } from './stages';

export const INFINITE_GROWTH = 1.12;
export const BOSS_EVERY = 10;

const BASE_INTERVAL: Partial<Record<EnemyId, number>> = {
  goblin: 0.4,
  lobo: 0.4,
  orc: 0.9,
  morcego: 0.5,
  xama: 0.8,
  golem: 2.8,
  curandeiro: 1.8,
  escudeiro: 1.1,
  lodo: 0.8,
};

const BASE_COUNT: Partial<Record<EnemyId, number>> = {
  goblin: 22,
  lobo: 18,
  orc: 12,
  morcego: 18,
  xama: 12,
  golem: 3,
  curandeiro: 4,
  escudeiro: 7,
  lodo: 10,
};

function hashSeed(text: string, n: number): number {
  let h = 2166136261 ^ n;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function stageRoster(stage: StageDef): EnemyId[] {
  const found = new Set<EnemyId>();
  for (const wave of stage.waves) for (const g of wave.groups) found.add(g.enemy);
  found.delete('rei');
  found.delete('lodinho');
  return [...found];
}

function baseMultiplier(stage: StageDef): number {
  const last = stage.waves[stage.waves.length - 1];
  const groups = last ? last.groups.filter((g) => g.enemy !== 'rei') : [];
  if (groups.length === 0) return 1;
  return groups.reduce((sum, g) => sum + g.hpMultiplier, 0) / groups.length;
}

function bossMultiplier(stage: StageDef): number {
  for (const wave of stage.waves) {
    const boss = wave.groups.find((g) => g.enemy === 'rei');
    if (boss) return boss.hpMultiplier;
  }
  return baseMultiplier(stage);
}

export function isBossWave(n: number, stage: StageDef): boolean {
  return n > stage.waves.length && (n - stage.waves.length) % BOSS_EVERY === 0;
}

export function infiniteWave(n: number, stage: StageDef): WaveDef {
  const extra = Math.max(1, n - stage.waves.length);
  const rand = random(hashSeed(stage.id, n));
  const roster = stageRoster(stage);
  const pool = roster.length > 0 ? roster : (['goblin'] as EnemyId[]);
  const growth = Math.pow(INFINITE_GROWTH, extra);
  const hp = baseMultiplier(stage) * growth;
  const pace = Math.max(0.55, 1 - 0.02 * extra);
  const crowd = 1 + Math.min(1, extra * 0.03);
  const picks = Math.min(pool.length, 3 + Math.floor(rand() * 2));
  const chosen: EnemyId[] = [];
  const remaining = [...pool];
  while (chosen.length < picks && remaining.length > 0) {
    const index = Math.floor(rand() * remaining.length);
    chosen.push(remaining.splice(index, 1)[0]);
  }
  const groups: WaveGroup[] = chosen.map((enemy, i) => ({
    enemy,
    count: Math.max(1, Math.round((BASE_COUNT[enemy] ?? 10) * crowd * (0.8 + rand() * 0.4))),
    interval: Number(((BASE_INTERVAL[enemy] ?? 0.8) * pace).toFixed(3)),
    delay: i * 4,
    hpMultiplier: Number(hp.toFixed(3)),
  }));
  if (isBossWave(n, stage)) {
    groups.push({ enemy: 'rei', count: 1, interval: 1, delay: chosen.length * 4 + 2, hpMultiplier: Number((bossMultiplier(stage) * growth).toFixed(3)) });
  }
  return { bonus: 80 + 4 * extra, groups };
}
