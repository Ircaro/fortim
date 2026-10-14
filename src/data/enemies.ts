import type { EnemyDef, EnemyId } from '../core/types';

type Base = Omit<EnemyDef, 'slowResist' | 'isBoss' | 'ability'> & Partial<Pick<EnemyDef, 'slowResist' | 'isBoss' | 'ability'>>;

function enemy(base: Base): EnemyDef {
  return { slowResist: 0, isBoss: false, ability: null, ...base };
}

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  goblin: enemy({ id: 'goblin', name: 'Goblin', hp: 48, speed: 60, armor: 0, magicResist: 0, reward: 5, lifeDamage: 1, flying: false, slowImmune: false, size: 1 }),
  lobo: enemy({ id: 'lobo', name: 'Lobo', hp: 36, speed: 110, armor: 0, magicResist: 0, reward: 5, lifeDamage: 1, flying: false, slowImmune: false, size: 1 }),
  orc: enemy({ id: 'orc', name: 'Orc Blindado', hp: 120, speed: 42, armor: 0.5, magicResist: 0, reward: 11, lifeDamage: 2, flying: false, slowImmune: false, size: 1.15 }),
  morcego: enemy({ id: 'morcego', name: 'Morcego', hp: 42, speed: 80, armor: 0, magicResist: 0, reward: 6, lifeDamage: 1, flying: true, slowImmune: false, size: 0.9 }),
  xama: enemy({ id: 'xama', name: 'Xamã Goblin', hp: 84, speed: 55, armor: 0, magicResist: 0.5, reward: 8, lifeDamage: 1, flying: false, slowImmune: false, size: 1 }),
  golem: enemy({ id: 'golem', name: 'Golem de Pedra', hp: 540, speed: 30, armor: 0.7, magicResist: 0.5, reward: 32, lifeDamage: 5, flying: false, slowImmune: true, size: 1.5 }),
  curandeiro: enemy({
    id: 'curandeiro',
    name: 'Curandeiro',
    hp: 60,
    speed: 62,
    armor: 0,
    magicResist: 0,
    reward: 9,
    lifeDamage: 1,
    flying: false,
    slowImmune: false,
    size: 0.95,
    ability: { kind: 'cura', radius: 1.5, rate: 0.06, bossRate: 0.02 },
  }),
  escudeiro: enemy({
    id: 'escudeiro',
    name: 'Escudeiro',
    hp: 110,
    speed: 48,
    armor: 0.3,
    magicResist: 0,
    reward: 10,
    lifeDamage: 1,
    flying: false,
    slowImmune: false,
    size: 1.1,
    ability: { kind: 'escudo', radius: 1.3, reduction: 0.3 },
  }),
  lodo: enemy({
    id: 'lodo',
    name: 'Lodo',
    hp: 90,
    speed: 50,
    armor: 0,
    magicResist: 0,
    reward: 4,
    lifeDamage: 1,
    flying: false,
    slowImmune: false,
    size: 1.1,
    ability: { kind: 'divide', into: 'lodinho', count: 2, spread: 0.125 },
  }),
  lodinho: enemy({ id: 'lodinho', name: 'Lodinho', hp: 35, speed: 75, armor: 0, magicResist: 0, reward: 2, lifeDamage: 1, flying: false, slowImmune: false, size: 0.7 }),
  rei: enemy({
    id: 'rei',
    name: 'Rei Goblin',
    hp: 1200,
    speed: 24,
    armor: 0.3,
    magicResist: 0.3,
    reward: 150,
    lifeDamage: 10,
    flying: false,
    slowImmune: false,
    slowResist: 0.5,
    isBoss: true,
    size: 2.2,
    ability: { kind: 'invoca', enemy: 'goblin', count: 3, interval: 7, behind: 0.4 },
  }),
};

export const ENEMY_ORDER: EnemyId[] = ['goblin', 'lobo', 'orc', 'morcego', 'xama', 'golem', 'curandeiro', 'escudeiro', 'lodo', 'rei'];
