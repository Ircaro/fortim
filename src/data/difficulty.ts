import type { Difficulty } from '../core/types';

export type { Difficulty } from '../core/types';

export interface DifficultyDef {
  id: Difficulty;
  name: string;
  hpMultiplier: number;
  goldMultiplier: number;
  lives: number;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyDef> = {
  facil: { id: 'facil', name: 'Fácil', hpMultiplier: 0.8, goldMultiplier: 1.25, lives: 25 },
  normal: { id: 'normal', name: 'Normal', hpMultiplier: 1, goldMultiplier: 1, lives: 20 },
  dificil: { id: 'dificil', name: 'Difícil', hpMultiplier: 1.1, goldMultiplier: 1, lives: 15 },
};

export const DIFFICULTY_ORDER: Difficulty[] = ['facil', 'normal', 'dificil'];

export function isDifficulty(value: unknown): value is Difficulty {
  return value === 'facil' || value === 'normal' || value === 'dificil';
}
