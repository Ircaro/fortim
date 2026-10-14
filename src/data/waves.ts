import type { EnemyId, WaveDef, WaveGroup } from '../core/types';

export function g(enemy: EnemyId, count: number, interval: number, delay = 0, hpMultiplier = 1, path?: number): WaveGroup {
  return path === undefined ? { enemy, count, interval, delay, hpMultiplier } : { enemy, count, interval, delay, hpMultiplier, path };
}

export function scaled(waves: WaveDef[], factors: number[]): WaveDef[] {
  return waves.map((wave, i) => ({
    ...wave,
    groups: wave.groups.map((group) => ({ ...group, hpMultiplier: Number((group.hpMultiplier * (factors[i] ?? 1)).toFixed(3)) })),
  }));
}

export const WAVES: WaveDef[] = [
  { bonus: 16, groups: [g('goblin', 8, 1.2)] },
  { bonus: 20, groups: [g('goblin', 10, 1.0), g('lobo', 4, 0.8, 8)] },
  { bonus: 24, groups: [g('lobo', 10, 0.7), g('goblin', 8, 0.9, 5)] },
  { bonus: 28, groups: [g('goblin', 10, 0.8, 0, 1.2), g('orc', 3, 2.5, 6)] },
  { bonus: 32, groups: [g('morcego', 8, 1.0), g('goblin', 10, 0.7, 4, 1.3)] },
  { bonus: 36, groups: [g('orc', 6, 1.8), g('xama', 6, 1.4, 4)] },
  { bonus: 40, groups: [g('lobo', 16, 0.5, 0, 1.4), g('morcego', 8, 0.9, 6, 1.2)] },
  { bonus: 48, groups: [g('golem', 1, 1), g('goblin', 16, 0.6, 2, 1.6), g('xama', 6, 1.2, 8, 1.2)] },
  { bonus: 48, groups: [g('orc', 10, 1.2, 0, 1.35), g('morcego', 12, 0.7, 5, 1.45)] },
  { bonus: 56, groups: [g('xama', 12, 0.9, 0, 1.6), g('lobo', 14, 0.5, 6, 1.85), g('golem', 2, 4, 10, 1.1)] },
  { bonus: 60, groups: [g('goblin', 24, 0.4, 0, 2.45), g('orc', 8, 1.2, 6, 1.8)] },
  { bonus: 64, groups: [g('morcego', 18, 0.5, 0, 1.85), g('golem', 3, 3.5, 4, 1.3)] },
  { bonus: 72, groups: [g('orc', 14, 0.9, 0, 1.95), g('xama', 12, 0.8, 4, 1.95), g('golem', 1, 4, 6, 1.3), g('lobo', 16, 0.4, 10, 2.25)] },
  { bonus: 80, groups: [g('golem', 4, 2.8, 0, 1.7), g('morcego', 20, 0.45, 5, 2.4)] },
  { bonus: 0, groups: [g('goblin', 20, 0.35, 0, 3.35), g('orc', 12, 0.9, 4, 2.75), g('xama', 10, 0.9, 8, 2.75), g('morcego', 14, 0.6, 10, 3.1), g('golem', 2, 3, 14, 2.4), g('rei', 1, 1, 18, 2.2)] },
];

const FLORESTA_BASE: WaveDef[] = [
  { bonus: 16, groups: [g('goblin', 8, 1.2)] },
  { bonus: 20, groups: [g('goblin', 10, 1.0), g('lobo', 4, 0.8, 8)] },
  { bonus: 24, groups: [g('lobo', 10, 0.7), g('curandeiro', 2, 3, 3), g('goblin', 8, 0.9, 5)] },
  { bonus: 28, groups: [g('goblin', 10, 0.8, 0, 1.2), g('orc', 3, 2.5, 6)] },
  { bonus: 32, groups: [g('morcego', 8, 1.0), g('lodo', 5, 1.4, 4)] },
  { bonus: 36, groups: [g('orc', 6, 1.8), g('xama', 6, 1.4, 4), g('curandeiro', 2, 3, 5)] },
  { bonus: 40, groups: [g('lobo', 16, 0.5, 0, 1.4), g('orc', 5, 1.5, 3, 1.4), g('morcego', 8, 0.9, 6, 1.2)] },
  { bonus: 48, groups: [g('golem', 2, 3), g('goblin', 16, 0.6, 2, 1.6), g('curandeiro', 3, 2, 5, 1.2)] },
  { bonus: 48, groups: [g('orc', 12, 1.1, 0, 1.6), g('lodo', 8, 1.0, 5, 1.4)] },
  { bonus: 56, groups: [g('xama', 12, 0.9, 0, 1.6), g('lobo', 14, 0.5, 6, 1.85), g('golem', 4, 3, 10, 1.5)] },
  { bonus: 60, groups: [g('goblin', 24, 0.4, 0, 2.45), g('orc', 8, 1.2, 6, 1.8), g('curandeiro', 4, 2, 8, 1.6)] },
  { bonus: 64, groups: [g('morcego', 18, 0.5, 0, 1.85), g('golem', 3, 3.5, 4, 1.3), g('lodo', 8, 0.8, 6, 1.8)] },
  { bonus: 72, groups: [g('orc', 14, 0.9, 0, 1.95), g('curandeiro', 4, 2, 3, 1.9), g('lodo', 10, 0.7, 6, 2), g('lobo', 16, 0.4, 10, 2.25)] },
  { bonus: 80, groups: [g('golem', 4, 2.8, 0, 1.7), g('morcego', 20, 0.45, 5, 2.4), g('curandeiro', 4, 2, 6, 2)] },
  { bonus: 0, groups: [g('goblin', 20, 0.35, 0, 3.35), g('orc', 12, 0.9, 4, 2.75), g('lodo', 10, 0.9, 8, 2.6), g('morcego', 14, 0.6, 10, 3.1), g('rei', 1, 1, 16, 2.4)] },
];

const DESFILADEIRO_BASE: WaveDef[] = [
  { bonus: 16, groups: [g('goblin', 8, 1.2)] },
  { bonus: 20, groups: [g('goblin', 10, 1.0), g('lobo', 5, 0.8, 8)] },
  { bonus: 24, groups: [g('lobo', 10, 0.7), g('escudeiro', 2, 2.5, 3), g('goblin', 8, 0.9, 5)] },
  { bonus: 28, groups: [g('goblin', 10, 0.8, 0, 1.2), g('orc', 3, 2.5, 6), g('curandeiro', 2, 3, 7)] },
  { bonus: 32, groups: [g('morcego', 8, 1.0), g('lodo', 5, 1.4, 4, 1.1)] },
  { bonus: 36, groups: [g('escudeiro', 4, 1.6), g('goblin', 12, 0.6, 1, 1.4), g('xama', 6, 1.4, 6)] },
  { bonus: 40, groups: [g('lobo', 16, 0.5, 0, 1.5), g('morcego', 8, 0.9, 6, 1.3)] },
  { bonus: 48, groups: [g('golem', 1, 1), g('goblin', 16, 0.6, 2, 1.7), g('curandeiro', 3, 2, 5, 1.3)] },
  { bonus: 48, groups: [g('orc', 10, 1.2, 0, 1.45), g('escudeiro', 4, 1.5, 3, 1.3), g('morcego', 10, 0.7, 6, 1.5)] },
  { bonus: 56, groups: [g('xama', 12, 0.9, 0, 1.7), g('lodo', 10, 0.7, 5, 1.7), g('golem', 2, 4, 10, 1.2)] },
  { bonus: 60, groups: [g('goblin', 24, 0.4, 0, 2.6), g('escudeiro', 6, 1.2, 2, 1.6), g('curandeiro', 4, 2, 6, 1.7)] },
  { bonus: 64, groups: [g('morcego', 18, 0.5, 0, 2), g('golem', 3, 3.5, 4, 1.4), g('lobo', 14, 0.4, 8, 2.2)] },
  { bonus: 72, groups: [g('orc', 14, 0.9, 0, 2.05), g('escudeiro', 6, 1.2, 3, 1.9), g('lodo', 10, 0.7, 6, 2.1), g('curandeiro', 4, 2, 8, 2)] },
  { bonus: 80, groups: [g('golem', 4, 2.8, 0, 1.8), g('morcego', 20, 0.45, 5, 2.5), g('curandeiro', 4, 2, 6, 2.1)] },
  { bonus: 0, groups: [g('goblin', 20, 0.35, 0, 3.5), g('escudeiro', 8, 1, 4, 2.6), g('lodo', 10, 0.9, 8, 2.7), g('morcego', 14, 0.6, 10, 3.2), g('rei', 1, 1, 16, 2.5)] },
];

const ENCRUZILHADA_BASE: WaveDef[] = [
  { bonus: 16, groups: [g('goblin', 10, 1.0)] },
  { bonus: 20, groups: [g('goblin', 12, 0.8), g('lobo', 6, 0.7, 7)] },
  { bonus: 24, groups: [g('lobo', 12, 0.6), g('curandeiro', 2, 3, 3), g('goblin', 10, 0.8, 5)] },
  { bonus: 28, groups: [g('goblin', 12, 0.7, 0, 1.25), g('orc', 4, 2, 5), g('escudeiro', 2, 3, 6)] },
  { bonus: 32, groups: [g('morcego', 10, 0.8), g('lodo', 6, 1.2, 4, 1.15)] },
  { bonus: 36, groups: [g('orc', 7, 1.6), g('xama', 7, 1.2, 4), g('curandeiro', 3, 2.5, 5)] },
  { bonus: 40, groups: [g('lobo', 18, 0.45, 0, 1.5), g('morcego', 10, 0.8, 6, 1.3)] },
  { bonus: 48, groups: [g('golem', 2, 3), g('goblin', 18, 0.5, 2, 1.7), g('escudeiro', 4, 1.6, 6, 1.3)] },
  { bonus: 48, groups: [g('orc', 12, 1.0, 0, 1.45), g('lodo', 8, 0.9, 5, 1.5), g('morcego', 10, 0.7, 8, 1.5)] },
  { bonus: 56, groups: [g('xama', 14, 0.8, 0, 1.75), g('lobo', 16, 0.45, 6, 1.9), g('golem', 2, 4, 10, 1.25)] },
  { bonus: 60, groups: [g('goblin', 26, 0.35, 0, 2.6), g('escudeiro', 6, 1.2, 2, 1.7), g('curandeiro', 5, 1.8, 6, 1.7)] },
  { bonus: 64, groups: [g('morcego', 20, 0.45, 0, 2), g('golem', 3, 3.2, 4, 1.45), g('lodo', 10, 0.7, 8, 1.9)] },
  { bonus: 72, groups: [g('orc', 12, 0.9, 0, 2.05), g('escudeiro', 5, 1.3, 3, 2), g('curandeiro', 3, 2.2, 6, 2), g('lobo', 18, 0.4, 10, 2.3)] },
  { bonus: 80, groups: [g('golem', 4, 2.6, 0, 1.85), g('morcego', 22, 0.4, 5, 2.5), g('lodo', 10, 0.7, 8, 2.2)] },
  { bonus: 0, groups: [g('goblin', 22, 0.3, 0, 3.5), g('orc', 12, 0.8, 4, 2.85), g('escudeiro', 8, 1, 6, 2.6), g('morcego', 16, 0.5, 10, 3.2), g('rei', 1, 1, 14, 2.4)] },
];

const CERCO_BASE: WaveDef[] = [
  { bonus: 16, groups: [g('goblin', 10, 1.0)] },
  { bonus: 20, groups: [g('goblin', 12, 0.8), g('lobo', 6, 0.7, 7)] },
  { bonus: 24, groups: [g('lobo', 12, 0.6), g('escudeiro', 2, 3, 3), g('goblin', 10, 0.8, 5)] },
  { bonus: 28, groups: [g('goblin', 12, 0.7, 0, 1.25), g('orc', 4, 2, 5), g('curandeiro', 2, 3, 6)] },
  { bonus: 32, groups: [g('morcego', 10, 0.8), g('lodo', 6, 1.2, 4, 1.15)] },
  { bonus: 36, groups: [g('orc', 7, 1.6), g('xama', 7, 1.2, 4), g('escudeiro', 3, 2.5, 5)] },
  { bonus: 40, groups: [g('lobo', 18, 0.45, 0, 1.5), g('morcego', 10, 0.8, 6, 1.3)] },
  { bonus: 48, groups: [g('golem', 2, 3), g('goblin', 18, 0.5, 2, 1.7), g('curandeiro', 4, 1.6, 6, 1.3)] },
  { bonus: 48, groups: [g('orc', 12, 1.0, 0, 1.45), g('lodo', 8, 0.9, 5, 1.5), g('morcego', 10, 0.7, 8, 1.5)] },
  { bonus: 56, groups: [g('xama', 14, 0.8, 0, 1.75), g('lobo', 16, 0.45, 6, 1.9), g('golem', 2, 4, 10, 1.25)] },
  { bonus: 60, groups: [g('goblin', 26, 0.35, 0, 2.6), g('escudeiro', 6, 1.2, 2, 1.7), g('curandeiro', 5, 1.8, 6, 1.7)] },
  { bonus: 64, groups: [g('morcego', 20, 0.45, 0, 2), g('golem', 3, 3.2, 4, 1.45), g('lodo', 10, 0.7, 8, 1.9)] },
  { bonus: 72, groups: [g('orc', 12, 0.9, 0, 2.05), g('escudeiro', 5, 1.3, 3, 2), g('curandeiro', 3, 2.2, 6, 2), g('lobo', 18, 0.4, 10, 2.3)] },
  { bonus: 80, groups: [g('golem', 4, 2.6, 0, 1.85), g('morcego', 22, 0.4, 5, 2.5), g('lodo', 10, 0.7, 8, 2.2)] },
  { bonus: 0, groups: [g('goblin', 22, 0.3, 0, 3.5), g('orc', 12, 0.8, 4, 2.85), g('escudeiro', 8, 1, 6, 2.6), g('morcego', 16, 0.5, 10, 3.2), g('rei', 1, 1, 14, 2.4)] },
];

export const FLORESTA_WAVES: WaveDef[] = scaled(FLORESTA_BASE, [1, 1, 1, 1, 1, 1.05, 1.1, 1.1, 0.95, 1.1, 1.1, 1.1, 1.1, 1.1, 1.1]);
export const DESFILADEIRO_WAVES: WaveDef[] = scaled(DESFILADEIRO_BASE, [1, 1, 1, 1, 1.05, 1.1, 1.1, 1.15, 1.15, 1.15, 1.15, 1.15, 1.0, 1.1, 1.05]);
export const ENCRUZILHADA_WAVES: WaveDef[] = scaled(ENCRUZILHADA_BASE, [0.95, 0.95, 0.95, 0.95, 0.95, 0.95, 0.95, 0.95, 0.9, 1.1, 1.08, 1.15, 1.15, 1.15, 1.15]);
export const CERCO_WAVES: WaveDef[] = scaled(CERCO_BASE, [0.7, 0.7, 0.7, 0.7, 0.75, 0.75, 0.75, 0.8, 0.8, 0.8, 0.85, 0.85, 0.85, 0.85, 0.85]);
