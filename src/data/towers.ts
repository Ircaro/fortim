import type { SpecDef, TowerDef, TowerId, TowerLevel } from '../core/types';

export function lvl(partial: Partial<TowerLevel> & Pick<TowerLevel, 'cost' | 'damage' | 'range' | 'fireRate'>): TowerLevel {
  return {
    projectileSpeed: 420,
    splashRadius: 0,
    armorPierce: 0,
    slow: null,
    magicPierce: 0,
    targets: 1,
    chain: null,
    stun: null,
    burn: null,
    aura: false,
    line: false,
    ...partial,
  };
}

function spec(id: SpecDef['id'], name: string, description: string, level: TowerLevel): SpecDef {
  return { id, name, description, cost: level.cost, level };
}

export const PLUS_DAMAGE = 1.12;
export const PLUS_COST_FACTOR = 0.6;
export const PLUS_COST_GROWTH = 1.45;

export const TOWERS: Record<TowerId, TowerDef> = {
  arqueiro: {
    id: 'arqueiro',
    name: 'Arqueiros',
    description: 'Disparo rápido e barato. Acerta inimigos voadores.',
    damageType: 'fisico',
    hitsGround: true,
    hitsAir: true,
    projectile: 'flecha',
    hotkey: '1',
    levels: [
      lvl({ cost: 70, damage: 10, range: 130, fireRate: 1.4, projectileSpeed: 520 }),
      lvl({ cost: 60, damage: 17, range: 145, fireRate: 1.6, projectileSpeed: 560 }),
      lvl({ cost: 110, damage: 28, range: 160, fireRate: 1.9, projectileSpeed: 600 }),
    ],
    specs: [
      spec('a', 'Atiradores de elite', 'Tiros fortes de muito longe que perfuram armadura.', lvl({ cost: 280, damage: 70, range: 224, fireRate: 1.14, projectileSpeed: 800, armorPierce: 0.3 })),
      spec('b', 'Saraivada', 'Cada disparo acerta até 3 alvos diferentes.', lvl({ cost: 260, damage: 30, range: 165, fireRate: 2, projectileSpeed: 620, targets: 3 })),
    ],
  },
  canhao: {
    id: 'canhao',
    name: 'Canhão',
    description: 'Dano em área. Não alcança voadores.',
    damageType: 'fisico',
    hitsGround: true,
    hitsAir: false,
    projectile: 'bala',
    hotkey: '2',
    levels: [
      lvl({ cost: 120, damage: 22, range: 115, fireRate: 0.6, projectileSpeed: 320, splashRadius: 50 }),
      lvl({ cost: 100, damage: 38, range: 125, fireRate: 0.65, projectileSpeed: 340, splashRadius: 58 }),
      lvl({ cost: 170, damage: 62, range: 135, fireRate: 0.7, projectileSpeed: 360, splashRadius: 68 }),
    ],
    specs: [
      spec('a', 'Morteiro', 'Alcance e explosão bem maiores, mas atira mais devagar.', lvl({ cost: 300, damage: 95, range: 210, fireRate: 0.5, projectileSpeed: 300, splashRadius: 100 })),
      spec('b', 'Canhão de Choque', 'Explosão menor que atordoa quem for atingido.', lvl({ cost: 280, damage: 70, range: 140, fireRate: 0.75, projectileSpeed: 380, splashRadius: 48, stun: { duration: 0.4, heavySlow: null } })),
    ],
  },
  gelo: {
    id: 'gelo',
    name: 'Gelo',
    description: 'Dano mágico baixo que deixa os inimigos lentos.',
    damageType: 'magico',
    hitsGround: true,
    hitsAir: true,
    projectile: 'gelo',
    hotkey: '3',
    levels: [
      lvl({ cost: 90, damage: 4, range: 110, fireRate: 1.0, projectileSpeed: 380, slow: { factor: 0.55, duration: 1.5 } }),
      lvl({ cost: 80, damage: 7, range: 120, fireRate: 1.1, projectileSpeed: 400, slow: { factor: 0.45, duration: 2 } }),
      lvl({ cost: 130, damage: 12, range: 130, fireRate: 1.2, projectileSpeed: 420, splashRadius: 40, slow: { factor: 0.35, duration: 2.5 } }),
    ],
    specs: [
      spec('a', 'Nevasca', 'Aura contínua que deixa lento e fere todos no alcance.', lvl({ cost: 260, damage: 14, range: 130, fireRate: 1, aura: true, slow: { factor: 0.4, duration: 0.4 } })),
      spec('b', 'Lança de Gelo', 'Dano alto num alvo que congela por 1 segundo.', lvl({ cost: 300, damage: 120, range: 150, fireRate: 0.6, projectileSpeed: 520, stun: { duration: 1, heavySlow: 0.5 } })),
    ],
  },
  mago: {
    id: 'mago',
    name: 'Mago',
    description: 'Dano mágico alto que ignora armadura.',
    damageType: 'magico',
    hitsGround: true,
    hitsAir: true,
    projectile: 'magia',
    hotkey: '4',
    levels: [
      lvl({ cost: 150, damage: 30, range: 135, fireRate: 0.8, projectileSpeed: 360 }),
      lvl({ cost: 130, damage: 52, range: 145, fireRate: 0.9, projectileSpeed: 380 }),
      lvl({ cost: 200, damage: 90, range: 160, fireRate: 1.0, projectileSpeed: 400 }),
    ],
    specs: [
      spec('a', 'Arquimago', 'Dano muito alto que ignora metade da resistência mágica.', lvl({ cost: 340, damage: 170, range: 170, fireRate: 0.9, projectileSpeed: 420, magicPierce: 0.5 })),
      spec('b', 'Mago das Chamas', 'Explosão pequena que deixa os inimigos queimando.', lvl({ cost: 300, damage: 70, range: 160, fireRate: 1, projectileSpeed: 400, splashRadius: 40, burn: { dps: 30, duration: 3 } })),
    ],
  },
  balista: {
    id: 'balista',
    name: 'Balista',
    description: 'Alcance enorme e virotes que perfuram armadura.',
    damageType: 'fisico',
    hitsGround: true,
    hitsAir: true,
    projectile: 'virote',
    hotkey: '5',
    levels: [
      lvl({ cost: 170, damage: 75, range: 180, fireRate: 0.3, projectileSpeed: 700, armorPierce: 0.6 }),
      lvl({ cost: 150, damage: 130, range: 195, fireRate: 0.34, projectileSpeed: 760, armorPierce: 0.7 }),
      lvl({ cost: 230, damage: 210, range: 210, fireRate: 0.37, projectileSpeed: 820, armorPierce: 0.8 }),
    ],
    specs: [
      spec('a', 'Balista Perfurante', 'O virote atravessa e acerta todos na linha.', lvl({ cost: 330, damage: 230, range: 230, fireRate: 0.37, projectileSpeed: 900, armorPierce: 0.8, line: true })),
      spec('b', 'Balista de Repetição', 'Atira três vezes mais rápido, com menos dano por tiro.', lvl({ cost: 320, damage: 95, range: 210, fireRate: 1.11, projectileSpeed: 820, armorPierce: 0.8 })),
    ],
  },
  raio: {
    id: 'raio',
    name: 'Raio',
    description: 'Raio mágico instantâneo que salta entre inimigos próximos.',
    damageType: 'magico',
    hitsGround: true,
    hitsAir: true,
    projectile: 'magia',
    hotkey: '6',
    levels: [
      lvl({ cost: 140, damage: 14, range: 120, fireRate: 0.9, chain: { jumps: 2, radius: 1.6, falloff: 0.2 } }),
      lvl({ cost: 120, damage: 22, range: 130, fireRate: 0.9, chain: { jumps: 3, radius: 1.6, falloff: 0.2 } }),
      lvl({ cost: 180, damage: 32, range: 140, fireRate: 1, chain: { jumps: 4, radius: 1.6, falloff: 0.2 } }),
    ],
    specs: [
      spec('a', 'Tempestade', 'Até 7 saltos, perdendo pouco dano a cada salto.', lvl({ cost: 320, damage: 40, range: 150, fireRate: 1, chain: { jumps: 7, radius: 1.6, falloff: 0.1 } })),
      spec('b', 'Bobina', 'Menos saltos, mas cada atingido fica atordoado.', lvl({ cost: 280, damage: 44, range: 140, fireRate: 1, chain: { jumps: 2, radius: 1.6, falloff: 0.2 }, stun: { duration: 0.3, heavySlow: null } })),
    ],
  },
};

export const TOWER_ORDER: TowerId[] = ['arqueiro', 'canhao', 'gelo', 'mago', 'balista', 'raio'];
