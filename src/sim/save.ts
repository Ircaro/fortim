import type { BattleStats, Difficulty, PowerId, SavedPower, SavedTower, SpecChoice, TargetMode, TowerId } from '../core/types';
import { isDifficulty } from '../data/difficulty';
import { POWER_ORDER } from '../data/powers';
import { stageById } from '../data/stages';
import { TOWERS } from '../data/towers';
import { TARGET_MODES, copyStats } from './battle';
import type { Battle } from './battle';
import { createStageBattle } from './index';

export const SAVE_VERSION = 1;
export const SAVE_KEY = 'fortim:partida';

export interface SaveData {
  version: typeof SAVE_VERSION;
  stageId: string;
  difficulty: Difficulty;
  infinite: boolean;
  gold: number;
  lives: number;
  waveNumber: number;
  stats: BattleStats;
  towers: SavedTower[];
  powers: SavedPower[];
}

export interface SaveMeta {
  stageId: string;
}

export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

const STAT_KEYS = ['kills', 'leaked', 'goldEarned', 'goldSpent', 'towersBuilt', 'elapsed', 'golemsKilled', 'bossesKilled', 'earlyCalls'] as const;

export function serializeBattle(battle: Battle, meta: SaveMeta): SaveData | null {
  if (battle.phase !== 'preparando' || !stageById(meta.stageId)) return null;
  return {
    version: SAVE_VERSION,
    stageId: meta.stageId,
    difficulty: battle.difficulty,
    infinite: battle.infinite,
    gold: battle.gold,
    lives: battle.lives,
    waveNumber: battle.waveNumber,
    stats: copyStats(battle.stats),
    towers: battle.towers.map((t) => ({
      id: t.def.id,
      col: t.col,
      row: t.row,
      level: t.level,
      targetMode: t.targetMode,
      totalSpent: t.totalSpent,
      kills: t.kills,
      spec: t.spec,
      plus: t.plus,
    })),
    powers: battle.powers.map((p) => ({ id: p.id, cooldown: p.cooldown })),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function readStats(value: unknown): BattleStats | null {
  if (!isRecord(value)) return null;
  const used = value.powersUsed;
  if (!isRecord(used)) return null;
  const powersUsed = {} as Record<PowerId, number>;
  for (const id of POWER_ORDER) {
    if (!isCount(used[id])) return null;
    powersUsed[id] = used[id] as number;
  }
  const stats = { powersUsed } as BattleStats;
  for (const key of STAT_KEYS) {
    const v = value[key];
    if (!isAmount(v)) return null;
    stats[key] = v;
  }
  return stats;
}

function readTower(value: unknown): SavedTower | null {
  if (!isRecord(value)) return null;
  const id = value.id as TowerId;
  const def = typeof id === 'string' && Object.prototype.hasOwnProperty.call(TOWERS, id) ? TOWERS[id] : null;
  if (!def) return null;
  const { col, row, level, targetMode, totalSpent, kills, spec, plus } = value;
  if (!isCount(col) || !isCount(row) || !isCount(level) || level >= def.levels.length) return null;
  if (!TARGET_MODES.includes(targetMode as TargetMode)) return null;
  if (!isAmount(totalSpent) || !isCount(kills) || !isCount(plus)) return null;
  if (spec !== null && spec !== 'a' && spec !== 'b') return null;
  if (spec !== null && level !== def.levels.length - 1) return null;
  if (spec === null && plus > 0) return null;
  return { id, col, row, level, targetMode: targetMode as TargetMode, totalSpent, kills, spec: spec as SpecChoice | null, plus };
}

function readPowers(value: unknown): SavedPower[] | null {
  if (!Array.isArray(value)) return null;
  const powers: SavedPower[] = [];
  for (const item of value) {
    if (!isRecord(item) || !POWER_ORDER.includes(item.id as PowerId) || !isAmount(item.cooldown)) return null;
    if (powers.some((p) => p.id === item.id)) return null;
    powers.push({ id: item.id as PowerId, cooldown: item.cooldown });
  }
  return powers;
}

export function validateSave(value: unknown): SaveData | null {
  if (!isRecord(value) || value.version !== SAVE_VERSION) return null;
  const { stageId, difficulty, infinite, gold, lives, waveNumber } = value;
  if (typeof stageId !== 'string') return null;
  const stage = stageById(stageId);
  if (!stage || !isDifficulty(difficulty) || typeof infinite !== 'boolean') return null;
  if (!isAmount(gold) || !isCount(lives) || lives < 1 || !isCount(waveNumber)) return null;
  if (!infinite && waveNumber >= stage.waves.length) return null;
  const stats = readStats(value.stats);
  const powers = readPowers(value.powers);
  if (!stats || !powers || !Array.isArray(value.towers)) return null;
  const probe = createStageBattle(stage, { difficulty, infinite });
  const taken = new Set<string>();
  const towers: SavedTower[] = [];
  for (const item of value.towers) {
    const tower = readTower(item);
    if (!tower) return null;
    const key = `${tower.col},${tower.row}`;
    if (taken.has(key) || !probe.canBuild(tower.col, tower.row)) return null;
    taken.add(key);
    towers.push(tower);
  }
  return { version: SAVE_VERSION, stageId, difficulty, infinite, gold, lives, waveNumber, stats, towers, powers };
}

export function restoreBattle(save: unknown): Battle | null {
  const data = validateSave(save);
  if (!data) return null;
  return createStageBattle(data.stageId, {
    difficulty: data.difficulty,
    infinite: data.infinite,
    initial: {
      gold: data.gold,
      lives: data.lives,
      waveNumber: data.waveNumber,
      stats: copyStats(data.stats),
      towers: data.towers.map((t) => ({ ...t })),
      powers: data.powers.map((p) => ({ ...p })),
    },
  });
}

export function parseSave(text: string | null | undefined): SaveData | null {
  if (!text) return null;
  try {
    return validateSave(JSON.parse(text));
  } catch {
    return null;
  }
}

function defaultStorage(): SaveStorage | null {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

export function readSave(storage: () => SaveStorage | null = defaultStorage): SaveData | null {
  try {
    return parseSave(storage()?.getItem(SAVE_KEY));
  } catch {
    return null;
  }
}

export function writeSave(data: SaveData, storage: () => SaveStorage | null = defaultStorage): boolean {
  try {
    const target = storage();
    if (!target) return false;
    target.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(storage: () => SaveStorage | null = defaultStorage): void {
  try {
    const target = storage();
    if (target?.removeItem) target.removeItem(SAVE_KEY);
    else target?.setItem(SAVE_KEY, '');
  } catch {
    return;
  }
}
