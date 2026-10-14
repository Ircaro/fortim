import type { BattleStats, Difficulty, PowerId } from './types';

export const PROGRESS_KEY = 'fortim:progresso';
export const PROGRESS_VERSION = 1;

export type AchievementId =
  | 'primeira-vitoria'
  | 'intocavel'
  | 'cacador-golens'
  | 'regicida'
  | 'mestre-vale'
  | 'sobrevivente'
  | 'coragem'
  | 'pressa'
  | 'arsenal'
  | 'engenheiro';

export interface Achievement {
  id: AchievementId;
  title: string;
  description: string;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'primeira-vitoria', title: 'Primeira vitória', description: 'Vença uma fase pela primeira vez.' },
  { id: 'intocavel', title: 'Intocável', description: 'Vença uma fase sem perder nenhuma vida.' },
  { id: 'cacador-golens', title: 'Caçador de golens', description: 'Derrote 50 golens de pedra no total.' },
  { id: 'regicida', title: 'Regicida', description: 'Derrote um chefe.' },
  { id: 'mestre-vale', title: 'Mestre do vale', description: 'Consiga 3 estrelas em todas as fases no Normal ou no Difícil.' },
  { id: 'sobrevivente', title: 'Sobrevivente', description: 'Chegue à onda 30 no modo infinito.' },
  { id: 'coragem', title: 'Coragem', description: 'Vença uma fase no Difícil.' },
  { id: 'pressa', title: 'Pressa', description: 'Chame 10 ondas mais cedo numa mesma partida.' },
  { id: 'arsenal', title: 'Arsenal', description: 'Use os 3 poderes numa mesma partida.' },
  { id: 'engenheiro', title: 'Engenheiro', description: 'Construa 100 torres no total.' },
];

export const GOLEMS_GOAL = 50;
export const SURVIVOR_WAVE = 30;
export const EARLY_CALLS_GOAL = 10;
export const TOWERS_GOAL = 100;

export interface ProgressTotals {
  games: number;
  victories: number;
  kills: number;
  golems: number;
  bosses: number;
  goldEarned: number;
  towersBuilt: number;
}

export type StageStars = Partial<Record<Difficulty, number>>;

export interface ProgressData {
  version: typeof PROGRESS_VERSION;
  stars: Record<string, StageStars>;
  bestInfiniteWave: Record<string, number>;
  totals: ProgressTotals;
  achievements: AchievementId[];
}

export interface GameResult {
  stageId: string;
  difficulty: Difficulty;
  infinite: boolean;
  victory: boolean;
  wave: number;
  lives: number;
  startingLives: number;
  stats: BattleStats;
}

export interface ProgressStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ProgressOptions {
  stageIds: readonly string[];
  storage?: () => ProgressStorage | null;
}

export interface AchievementStatus extends Achievement {
  unlocked: boolean;
}

export interface ProgressApi {
  data(): ProgressData;
  stars(stageId: string, difficulty: Difficulty): number;
  bestStars(stageId: string): number;
  isUnlocked(stageId: string): boolean;
  bestInfiniteWave(stageId: string): number;
  achievements(): AchievementStatus[];
  recordGame(result: GameResult): Achievement[];
  reset(): void;
}

const DIFFICULTIES: Difficulty[] = ['facil', 'normal', 'dificil'];
const POWERS: PowerId[] = ['flechas', 'congelar', 'furia'];
const ACHIEVEMENT_IDS = new Set<string>(ACHIEVEMENTS.map((a) => a.id));

export function emptyProgress(): ProgressData {
  return {
    version: PROGRESS_VERSION,
    stars: {},
    bestInfiniteWave: {},
    totals: { games: 0, victories: 0, kills: 0, golems: 0, bosses: 0, goldEarned: 0, towersBuilt: 0 },
    achievements: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

export function sanitizeProgress(value: unknown): ProgressData {
  const clean = emptyProgress();
  if (!isRecord(value)) return clean;
  if (isRecord(value.stars)) {
    for (const [stageId, entry] of Object.entries(value.stars)) {
      if (!isRecord(entry)) continue;
      const stars: StageStars = {};
      for (const d of DIFFICULTIES) {
        const n = Math.min(3, count(entry[d]));
        if (n > 0) stars[d] = n;
      }
      clean.stars[stageId] = stars;
    }
  }
  if (isRecord(value.bestInfiniteWave)) {
    for (const [stageId, wave] of Object.entries(value.bestInfiniteWave)) {
      const n = count(wave);
      if (n > 0) clean.bestInfiniteWave[stageId] = n;
    }
  }
  if (isRecord(value.totals)) {
    const t = value.totals;
    clean.totals = {
      games: count(t.games),
      victories: count(t.victories),
      kills: count(t.kills),
      golems: count(t.golems),
      bosses: count(t.bosses),
      goldEarned: count(t.goldEarned),
      towersBuilt: count(t.towersBuilt),
    };
  }
  if (Array.isArray(value.achievements)) {
    clean.achievements = [...new Set(value.achievements.filter((id): id is AchievementId => typeof id === 'string' && ACHIEVEMENT_IDS.has(id)))];
  }
  return clean;
}

export function starsFor(result: Pick<GameResult, 'victory' | 'infinite' | 'lives' | 'startingLives'>): number {
  if (!result.victory || result.infinite) return 0;
  if (result.lives >= result.startingLives) return 3;
  if (result.lives * 2 >= result.startingLives) return 2;
  return 1;
}

function hasStageWin(data: ProgressData, stageId: string): boolean {
  const entry = data.stars[stageId];
  return !!entry && DIFFICULTIES.some((d) => (entry[d] ?? 0) > 0);
}

export function stageUnlocked(data: ProgressData, stageIds: readonly string[], stageId: string): boolean {
  const index = stageIds.indexOf(stageId);
  if (index < 0) return false;
  if (index === 0) return true;
  return hasStageWin(data, stageIds[index - 1]);
}

function earned(data: ProgressData, stageIds: readonly string[], result: GameResult): AchievementId[] {
  const ids: AchievementId[] = [];
  const stats = result.stats;
  if (result.victory && !result.infinite) ids.push('primeira-vitoria');
  if (result.victory && !result.infinite && result.lives >= result.startingLives) ids.push('intocavel');
  if (data.totals.golems >= GOLEMS_GOAL) ids.push('cacador-golens');
  if (stats.bossesKilled > 0) ids.push('regicida');
  const master =
    stageIds.length > 0 && stageIds.every((id) => Math.max(data.stars[id]?.normal ?? 0, data.stars[id]?.dificil ?? 0) >= 3);
  if (master) ids.push('mestre-vale');
  if (result.infinite && result.wave >= SURVIVOR_WAVE) ids.push('sobrevivente');
  if (result.victory && !result.infinite && result.difficulty === 'dificil') ids.push('coragem');
  if (stats.earlyCalls >= EARLY_CALLS_GOAL) ids.push('pressa');
  if (POWERS.every((p) => (stats.powersUsed[p] ?? 0) > 0)) ids.push('arsenal');
  if (data.totals.towersBuilt >= TOWERS_GOAL) ids.push('engenheiro');
  return ids;
}

export function applyGame(data: ProgressData, stageIds: readonly string[], result: GameResult): { progress: ProgressData; unlocked: Achievement[] } {
  const next = sanitizeProgress(data);
  const stats = result.stats;
  next.totals.games++;
  if (result.victory && !result.infinite) next.totals.victories++;
  next.totals.kills += count(stats.kills);
  next.totals.golems += count(stats.golemsKilled);
  next.totals.bosses += count(stats.bossesKilled);
  next.totals.goldEarned += count(stats.goldEarned);
  next.totals.towersBuilt += count(stats.towersBuilt);
  const stars = starsFor(result);
  if (stars > 0) {
    const entry = (next.stars[result.stageId] ??= {});
    entry[result.difficulty] = Math.max(entry[result.difficulty] ?? 0, stars);
  }
  if (result.infinite) {
    next.bestInfiniteWave[result.stageId] = Math.max(next.bestInfiniteWave[result.stageId] ?? 0, count(result.wave));
  }
  const fresh = earned(next, stageIds, result).filter((id) => !next.achievements.includes(id));
  next.achievements.push(...fresh);
  return { progress: next, unlocked: ACHIEVEMENTS.filter((a) => fresh.includes(a.id)) };
}

function defaultStorage(): ProgressStorage | null {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

export function loadProgress(storage: () => ProgressStorage | null = defaultStorage): ProgressData {
  try {
    const raw = storage()?.getItem(PROGRESS_KEY);
    return raw ? sanitizeProgress(JSON.parse(raw)) : emptyProgress();
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(data: ProgressData, storage: () => ProgressStorage | null = defaultStorage): void {
  try {
    storage()?.setItem(PROGRESS_KEY, JSON.stringify(data));
  } catch {
    return;
  }
}

export function createProgress(options: ProgressOptions): ProgressApi {
  const storage = options.storage ?? defaultStorage;
  const stageIds = options.stageIds;
  let state = loadProgress(storage);
  return {
    data: () => sanitizeProgress(state),
    stars: (stageId, difficulty) => state.stars[stageId]?.[difficulty] ?? 0,
    bestStars: (stageId) => Math.max(0, ...DIFFICULTIES.map((d) => state.stars[stageId]?.[d] ?? 0)),
    isUnlocked: (stageId) => stageUnlocked(state, stageIds, stageId),
    bestInfiniteWave: (stageId) => state.bestInfiniteWave[stageId] ?? 0,
    achievements: () => ACHIEVEMENTS.map((a) => ({ ...a, unlocked: state.achievements.includes(a.id) })),
    recordGame(result) {
      const { progress, unlocked } = applyGame(state, stageIds, result);
      state = progress;
      saveProgress(state, storage);
      return unlocked;
    },
    reset() {
      state = emptyProgress();
      saveProgress(state, storage);
    },
  };
}
