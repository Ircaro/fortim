import { SELL_REFUND, STARTING_GOLD, STARTING_LIVES, TILE } from '../config';
import type { BattleSnapshot, Difficulty } from '../core/types';
import { ENEMIES } from '../data/enemies';
import { infiniteWave } from '../data/infinite';
import { MAP } from '../data/map';
import { STAGES, stageById } from '../data/stages';
import type { StageDef } from '../data/stages';
import { TOWERS } from '../data/towers';
import { WAVES } from '../data/waves';
import { Battle } from './battle';

export {
  Battle,
  SIM_STEP,
  TARGET_MODES,
  canHit,
  computeDamage,
  copyStats,
  damageFactor,
  earlyCallBonus,
  emptyStats,
  plusCostFor,
  specOf,
  towerLevel,
} from './battle';

export interface StageBattleOptions {
  difficulty?: Difficulty;
  infinite?: boolean;
  initial?: BattleSnapshot;
}

export function createDefaultBattle(): Battle {
  return new Battle({
    map: MAP,
    towers: TOWERS,
    enemies: ENEMIES,
    waves: WAVES,
    startingGold: STARTING_GOLD,
    startingLives: STARTING_LIVES,
    tileSize: TILE,
    sellRefund: SELL_REFUND,
  });
}

export function createStageBattle(stage: StageDef | string, options: StageBattleOptions = {}): Battle {
  const def = typeof stage === 'string' ? stageById(stage) ?? STAGES[0] : stage;
  return new Battle({
    map: def.map,
    towers: TOWERS,
    enemies: ENEMIES,
    waves: def.waves,
    startingGold: def.startingGold,
    startingLives: STARTING_LIVES,
    tileSize: TILE,
    sellRefund: SELL_REFUND,
    difficulty: options.difficulty ?? 'normal',
    infinite: options.infinite ?? false,
    infiniteWave: (n) => infiniteWave(n, def),
    initial: options.initial,
  });
}
