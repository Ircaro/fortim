import { describe, expect, it } from 'vitest';
import type {
  BattleEvent,
  EnemyDef,
  EnemyId,
  EnemyState,
  MapDef,
  TowerDef,
  TowerId,
  TowerLevel,
  WaveDef,
  WaveGroup,
} from '../core/types';
import { ENEMIES } from '../data/enemies';
import { TOWERS } from '../data/towers';
import { MIN_DAMAGE } from '../config';
import { Battle, SIM_STEP, computeDamage } from './battle';
import { createDefaultBattle } from './index';

const LINE: MapDef = {
  name: 'Linha',
  cols: 10,
  rows: 3,
  paths: [
    [
      { col: -1, row: 1 },
      { col: 10, row: 1 },
    ],
  ],
  blocked: [{ col: 0, row: 0 }],
};

const ELBOW: MapDef = {
  name: 'Cotovelo',
  cols: 6,
  rows: 6,
  paths: [
    [
      { col: -1, row: 0 },
      { col: 2, row: 0 },
      { col: 2, row: 3 },
    ],
  ],
  blocked: [],
};

function lv(p: Partial<TowerLevel> = {}): TowerLevel {
  return {
    cost: 50,
    damage: 10,
    range: 1000,
    fireRate: 1,
    projectileSpeed: 100000,
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
    ...p,
  };
}

function tdef(id: TowerId, p: Partial<TowerDef> = {}): TowerDef {
  return {
    ...TOWERS[id],
    damageType: 'fisico',
    hitsGround: true,
    hitsAir: true,
    levels: [lv()],
    ...p,
  };
}

function edef(id: EnemyId, p: Partial<EnemyDef> = {}): EnemyDef {
  return {
    id,
    name: id,
    hp: 100,
    speed: 0,
    armor: 0,
    magicResist: 0,
    reward: 5,
    lifeDamage: 1,
    flying: false,
    slowImmune: false,
    slowResist: 0,
    isBoss: false,
    size: 1,
    ability: null,
    ...p,
  };
}

function grp(enemy: EnemyId, count: number, interval = 0, delay = 0, hpMultiplier = 1): WaveGroup {
  return { enemy, count, interval, delay, hpMultiplier };
}

interface Setup {
  map?: MapDef;
  towers?: Partial<Record<TowerId, TowerDef>>;
  enemies?: Partial<Record<EnemyId, EnemyDef>>;
  waves?: WaveDef[];
  gold?: number;
  lives?: number;
}

function makeBattle(s: Setup = {}): { battle: Battle; events: BattleEvent[] } {
  const battle = new Battle({
    map: s.map ?? LINE,
    towers: { ...TOWERS, arqueiro: tdef('arqueiro'), ...s.towers },
    enemies: { ...ENEMIES, goblin: edef('goblin'), ...s.enemies },
    waves: s.waves ?? [{ bonus: 10, groups: [grp('goblin', 1)] }],
    startingGold: s.gold ?? 1000,
    startingLives: s.lives ?? 20,
    tileSize: 10,
    sellRefund: 0.7,
  });
  const events: BattleEvent[] = [];
  battle.on((e) => events.push(e));
  return { battle, events };
}

function ofType<T extends BattleEvent['type']>(events: BattleEvent[], type: T): Extract<BattleEvent, { type: T }>[] {
  return events.filter((e): e is Extract<BattleEvent, { type: T }> => e.type === type);
}

function spawnAll(battle: Battle): EnemyState[] {
  battle.startNextWave();
  battle.update(SIM_STEP);
  return [...battle.enemies];
}

describe('caminho', () => {
  it('monta os pontos a partir dos centros dos waypoints e soma o comprimento', () => {
    const { battle } = makeBattle();
    expect(battle.pathPoints).toEqual([
      { x: -5, y: 15 },
      { x: 105, y: 15 },
    ]);
    expect(battle.pathLength).toBe(110);
  });

  it('calcula o caminho do mapa padrão', () => {
    const battle = createDefaultBattle();
    expect(battle.pathPoints[0]).toEqual({ x: -24, y: 120 });
    expect(battle.pathLength).toBe(29 * 48);
    expect(battle.gold).toBe(220);
    expect(battle.lives).toBe(20);
    expect(battle.totalWaves).toBe(15);
    expect(battle.phase).toBe('preparando');
  });

  it('inimigo nasce com distância 0 no primeiro waypoint', () => {
    const { battle, events } = makeBattle();
    const snapshots: { distance: number; x: number; y: number }[] = [];
    battle.on((e) => {
      if (e.type === 'enemySpawned') snapshots.push({ distance: e.enemy.distance, x: e.enemy.x, y: e.enemy.y });
    });
    spawnAll(battle);
    expect(ofType(events, 'enemySpawned')).toHaveLength(1);
    expect(snapshots[0]).toEqual({ distance: 0, x: -5, y: 15 });
  });

  it('interpola a posição e o ângulo ao longo dos segmentos', () => {
    const { battle } = makeBattle({ map: ELBOW, enemies: { goblin: edef('goblin', { speed: 60 }) } });
    battle.startNextWave();
    battle.update(0.25);
    const e = battle.enemies[0];
    expect(e.distance).toBeCloseTo(15);
    expect(e.x).toBeCloseTo(10);
    expect(e.y).toBeCloseTo(5);
    expect(e.angle).toBeCloseTo(0);
    battle.update(0.5);
    expect(e.distance).toBeCloseTo(45);
    expect(e.x).toBeCloseTo(25);
    expect(e.y).toBeCloseTo(20);
    expect(e.angle).toBeCloseTo(Math.PI / 2);
  });
});

describe('movimento', () => {
  it('avança speed * dt', () => {
    const { battle } = makeBattle({ enemies: { goblin: edef('goblin', { speed: 60 }) } });
    battle.startNextWave();
    battle.update(0.5);
    expect(battle.enemies[0].distance).toBeCloseTo(30);
    expect(battle.enemies[0].x).toBeCloseTo(25);
  });

  it('lentidão reduz a velocidade e expira com o tempo', () => {
    const { battle } = makeBattle({ enemies: { goblin: edef('goblin', { speed: 20 }) } });
    const [e] = spawnAll(battle);
    e.slowFactor = 0.5;
    e.slowTimer = 1;
    const before = e.distance;
    battle.update(0.5);
    expect(e.distance - before).toBeCloseTo(5);
    expect(e.slowTimer).toBeCloseTo(0.5);
    battle.update(0.5);
    expect(e.slowFactor).toBe(1);
    expect(e.slowTimer).toBe(0);
    const mid = e.distance;
    battle.update(0.5);
    expect(e.distance - mid).toBeCloseTo(10);
  });
});

describe('ondas', () => {
  it('startNextWave inicia a próxima onda e emite waveStarted', () => {
    const { battle, events } = makeBattle();
    expect(battle.startNextWave()).toBe(true);
    expect(battle.waveNumber).toBe(1);
    expect(battle.phase).toBe('onda');
    expect(ofType(events, 'waveStarted')).toEqual([{ type: 'waveStarted', wave: 1 }]);
  });

  it('startNextWave fora de hora é ignorado', () => {
    const { battle } = makeBattle();
    battle.startNextWave();
    expect(battle.startNextWave()).toBe(false);
    expect(battle.waveNumber).toBe(1);
    const empty = makeBattle({ waves: [] }).battle;
    expect(empty.startNextWave()).toBe(false);
    expect(empty.waveNumber).toBe(0);
  });

  it('spawna cada inimigo em delay + i * interval', () => {
    const { battle } = makeBattle({ waves: [{ bonus: 0, groups: [grp('goblin', 3, 1, 0.5)] }] });
    battle.startNextWave();
    battle.update(0.4);
    expect(battle.enemies).toHaveLength(0);
    battle.update(0.2);
    expect(battle.enemies).toHaveLength(1);
    battle.update(1);
    expect(battle.enemies).toHaveLength(2);
    battle.update(1);
    expect(battle.enemies).toHaveLength(3);
  });

  it('aplica o multiplicador de vida com arredondamento', () => {
    const { battle } = makeBattle({
      enemies: { goblin: edef('goblin', { hp: 33 }) },
      waves: [{ bonus: 0, groups: [grp('goblin', 1, 0, 0, 1.5)] }],
    });
    const [e] = spawnAll(battle);
    expect(e.maxHp).toBe(50);
    expect(e.hp).toBe(50);
  });

  it('usa uid único para torres, inimigos e projéteis', () => {
    const { battle, events } = makeBattle({ waves: [{ bonus: 0, groups: [grp('goblin', 3)] }] });
    battle.build('arqueiro', 5, 0);
    battle.build('arqueiro', 6, 0);
    const enemies = spawnAll(battle);
    for (const e of enemies) e.distance = 50;
    battle.update(SIM_STEP);
    const uids = [
      ...battle.towers.map((t) => t.uid),
      ...enemies.map((e) => e.uid),
      ...ofType(events, 'towerFired').map((e) => e.projectile.uid),
    ];
    expect(new Set(uids).size).toBe(uids.length);
  });
});

describe('construção', () => {
  it('constrói em tile válido cobrando o custo', () => {
    const { battle, events } = makeBattle({ gold: 100 });
    expect(battle.canBuild(5, 0)).toBe(true);
    expect(battle.canAfford('arqueiro')).toBe(true);
    const tower = battle.build('arqueiro', 5, 0);
    expect(tower).not.toBeNull();
    expect(tower?.x).toBe(55);
    expect(tower?.y).toBe(5);
    expect(tower?.level).toBe(0);
    expect(tower?.targetMode).toBe('primeiro');
    expect(tower?.totalSpent).toBe(50);
    expect(battle.gold).toBe(50);
    expect(battle.stats.goldSpent).toBe(50);
    expect(battle.stats.towersBuilt).toBe(1);
    expect(battle.towerAt(5, 0)).toBe(tower);
    expect(ofType(events, 'towerBuilt')).toHaveLength(1);
    expect(ofType(events, 'goldChanged')).toEqual([{ type: 'goldChanged', gold: 50 }]);
  });

  it('recusa caminho, bloqueio, fora do mapa e tile ocupado', () => {
    const { battle } = makeBattle();
    expect(battle.canBuild(3, 1)).toBe(false);
    expect(battle.canBuild(0, 0)).toBe(false);
    expect(battle.canBuild(-1, 0)).toBe(false);
    expect(battle.canBuild(10, 0)).toBe(false);
    expect(battle.canBuild(0, 3)).toBe(false);
    expect(battle.build('arqueiro', 3, 1)).toBeNull();
    expect(battle.build('arqueiro', 0, 0)).toBeNull();
    battle.build('arqueiro', 4, 2);
    expect(battle.canBuild(4, 2)).toBe(false);
    expect(battle.build('arqueiro', 4, 2)).toBeNull();
    expect(battle.towers).toHaveLength(1);
  });

  it('recusa quando não há ouro suficiente', () => {
    const { battle, events } = makeBattle({ gold: 49 });
    expect(battle.canAfford('arqueiro')).toBe(false);
    expect(battle.build('arqueiro', 5, 0)).toBeNull();
    expect(battle.gold).toBe(49);
    expect(events).toHaveLength(0);
  });

  it('o mapa padrão respeita caminho e bloqueios', () => {
    const battle = createDefaultBattle();
    expect(battle.canBuild(3, 2)).toBe(false);
    expect(battle.canBuild(0, 0)).toBe(false);
    expect(battle.canBuild(0, 1)).toBe(true);
  });
});

describe('melhoria e venda', () => {
  const levels = [lv({ cost: 50 }), lv({ cost: 30 }), lv({ cost: 70 })];

  it('melhora até o nível máximo', () => {
    const { battle, events } = makeBattle({ towers: { arqueiro: tdef('arqueiro', { levels }) }, gold: 150 });
    const tower = battle.build('arqueiro', 5, 0);
    if (!tower) throw new Error('torre não construída');
    expect(battle.upgradeCost(tower.uid)).toBe(30);
    expect(battle.upgrade(tower.uid)).toBe(true);
    expect(tower.level).toBe(1);
    expect(battle.gold).toBe(70);
    expect(battle.upgradeCost(tower.uid)).toBe(70);
    expect(battle.upgrade(tower.uid)).toBe(true);
    expect(tower.level).toBe(2);
    expect(battle.gold).toBe(0);
    expect(tower.totalSpent).toBe(150);
    expect(battle.stats.goldSpent).toBe(150);
    expect(battle.upgradeCost(tower.uid)).toBeNull();
    expect(battle.upgrade(tower.uid)).toBe(false);
    expect(ofType(events, 'towerUpgraded')).toHaveLength(2);
  });

  it('não melhora sem ouro nem torre inexistente', () => {
    const { battle } = makeBattle({ towers: { arqueiro: tdef('arqueiro', { levels }) }, gold: 60 });
    const tower = battle.build('arqueiro', 5, 0);
    if (!tower) throw new Error('torre não construída');
    expect(battle.upgrade(tower.uid)).toBe(false);
    expect(tower.level).toBe(0);
    expect(battle.gold).toBe(10);
    expect(battle.upgradeCost(999)).toBeNull();
    expect(battle.upgrade(999)).toBe(false);
  });

  it('vende devolvendo floor(totalSpent * sellRefund)', () => {
    const { battle, events } = makeBattle({ towers: { arqueiro: tdef('arqueiro', { levels }) }, gold: 1000 });
    const tower = battle.build('arqueiro', 5, 0);
    if (!tower) throw new Error('torre não construída');
    battle.upgrade(tower.uid);
    expect(battle.sellValue(tower.uid)).toBe(56);
    expect(battle.sell(tower.uid)).toBe(56);
    expect(battle.gold).toBe(1000 - 80 + 56);
    expect(battle.towers).toHaveLength(0);
    expect(battle.towerAt(5, 0)).toBeNull();
    expect(battle.stats.goldEarned).toBe(0);
    expect(ofType(events, 'towerSold')).toEqual([{ type: 'towerSold', tower, refund: 56 }]);
    expect(battle.sellValue(tower.uid)).toBe(0);
    expect(battle.sell(tower.uid)).toBe(0);
  });

  it('funciona durante a onda e trava após a derrota', () => {
    const { battle } = makeBattle({ lives: 1, enemies: { goblin: edef('goblin', { speed: 1000 }) } });
    const tower = battle.build('arqueiro', 5, 0);
    if (!tower) throw new Error('torre não construída');
    battle.startNextWave();
    expect(battle.build('arqueiro', 6, 0)).not.toBeNull();
    battle.towers.forEach((t) => (t.def = tdef('arqueiro', { hitsGround: false })));
    battle.update(1);
    expect(battle.phase).toBe('derrota');
    const gold = battle.gold;
    expect(battle.build('arqueiro', 7, 0)).toBeNull();
    expect(battle.upgrade(tower.uid)).toBe(false);
    expect(battle.sell(tower.uid)).toBe(0);
    expect(battle.gold).toBe(gold);
  });

  it('setTargetMode muda o modo da torre', () => {
    const { battle } = makeBattle();
    const tower = battle.build('arqueiro', 5, 0);
    if (!tower) throw new Error('torre não construída');
    battle.setTargetMode(tower.uid, 'forte');
    expect(tower.targetMode).toBe('forte');
  });
});

describe('alvo', () => {
  function targetsWith(mode: 'primeiro' | 'ultimo' | 'forte' | 'perto'): { picked: number; enemies: EnemyState[] } {
    const { battle, events } = makeBattle({
      towers: { arqueiro: tdef('arqueiro', { levels: [lv({ damage: 1 })] }) },
      waves: [{ bonus: 0, groups: [grp('goblin', 3)] }],
    });
    const tower = battle.build('arqueiro', 5, 0);
    if (!tower) throw new Error('torre não construída');
    battle.setTargetMode(tower.uid, mode);
    const enemies = spawnAll(battle);
    enemies[0].distance = 20;
    enemies[1].distance = 50;
    enemies[2].distance = 80;
    enemies[0].hp = 999;
    battle.update(SIM_STEP);
    const fired = ofType(events, 'towerFired');
    expect(fired).toHaveLength(1);
    expect(tower.targetUid).toBe(fired[0].projectile.targetUid);
    return { picked: fired[0].projectile.targetUid, enemies };
  }

  it('primeiro mira o mais adiantado', () => {
    const { picked, enemies } = targetsWith('primeiro');
    expect(picked).toBe(enemies[2].uid);
  });

  it('ultimo mira o mais atrasado', () => {
    const { picked, enemies } = targetsWith('ultimo');
    expect(picked).toBe(enemies[0].uid);
  });

  it('forte mira o de mais vida atual', () => {
    const { picked, enemies } = targetsWith('forte');
    expect(picked).toBe(enemies[0].uid);
  });

  it('perto mira o mais próximo da torre', () => {
    const { picked, enemies } = targetsWith('perto');
    expect(picked).toBe(enemies[1].uid);
  });

  it('ignora inimigos fora do alcance e ainda não visíveis', () => {
    const { battle, events } = makeBattle({
      towers: { arqueiro: tdef('arqueiro', { levels: [lv({ range: 20 })] }) },
      waves: [{ bonus: 0, groups: [grp('goblin', 2)] }],
    });
    const tower = battle.build('arqueiro', 0, 2);
    if (!tower) throw new Error('torre não construída');
    const enemies = spawnAll(battle);
    enemies[1].distance = 90;
    battle.update(SIM_STEP);
    expect(enemies[0].distance).toBe(0);
    expect(ofType(events, 'towerFired')).toHaveLength(0);
    expect(tower.targetUid).toBeNull();
    enemies[0].distance = 10;
    battle.update(SIM_STEP);
    expect(ofType(events, 'towerFired')).toHaveLength(1);
    expect(tower.targetUid).toBe(enemies[0].uid);
  });

  it('gira a torre na direção do alvo', () => {
    const { battle } = makeBattle();
    const tower = battle.build('arqueiro', 5, 0);
    if (!tower) throw new Error('torre não construída');
    const [e] = spawnAll(battle);
    e.distance = 60;
    battle.update(SIM_STEP);
    expect(tower.angle).toBeCloseTo(Math.PI / 2);
  });

  it('respeita hitsAir e hitsGround', () => {
    const { battle, events } = makeBattle({
      towers: {
        arqueiro: tdef('arqueiro', { hitsAir: false }),
        canhao: tdef('canhao', { hitsGround: false }),
      },
      enemies: { morcego: edef('morcego', { flying: true }) },
      waves: [{ bonus: 0, groups: [grp('goblin', 1), grp('morcego', 1)] }],
    });
    const ground = battle.build('arqueiro', 5, 0);
    const air = battle.build('canhao', 6, 0);
    if (!ground || !air) throw new Error('torre não construída');
    const [goblin, morcego] = spawnAll(battle);
    goblin.distance = 30;
    morcego.distance = 70;
    battle.update(SIM_STEP);
    expect(ground.targetUid).toBe(goblin.uid);
    expect(air.targetUid).toBe(morcego.uid);
    const fired = ofType(events, 'towerFired');
    expect(fired.find((f) => f.tower === ground)?.projectile.targetUid).toBe(goblin.uid);
    expect(fired.find((f) => f.tower === air)?.projectile.targetUid).toBe(morcego.uid);
  });
});

describe('cadência', () => {
  it('dispara a cada 1/fireRate e não acumula disparos ocioso', () => {
    const { battle, events } = makeBattle({
      towers: { arqueiro: tdef('arqueiro', { levels: [lv({ damage: 1, fireRate: 2 })] }) },
      enemies: { goblin: edef('goblin', { hp: 10000 }) },
    });
    const tower = battle.build('arqueiro', 5, 0);
    if (!tower) throw new Error('torre não construída');
    battle.update(5);
    expect(tower.cooldown).toBe(0);
    const [e] = spawnAll(battle);
    battle.update(5);
    expect(tower.cooldown).toBe(0);
    expect(ofType(events, 'towerFired')).toHaveLength(0);
    e.distance = 50;
    battle.update(SIM_STEP);
    expect(ofType(events, 'towerFired')).toHaveLength(1);
    expect(tower.cooldown).toBeCloseTo(0.5);
    battle.update(0.4);
    expect(ofType(events, 'towerFired')).toHaveLength(1);
    battle.update(0.2);
    expect(ofType(events, 'towerFired')).toHaveLength(2);
    e.distance = 0;
    battle.update(2);
    expect(tower.cooldown).toBe(0);
    expect(ofType(events, 'towerFired')).toHaveLength(2);
  });
});

describe('dano', () => {
  function hitDamage(tower: Partial<TowerDef>, enemy: Partial<EnemyDef>): number {
    const { battle, events } = makeBattle({
      towers: { arqueiro: tdef('arqueiro', tower) },
      enemies: { goblin: edef('goblin', { hp: 10000, ...enemy }) },
    });
    battle.build('arqueiro', 5, 0);
    const [e] = spawnAll(battle);
    e.distance = 50;
    battle.update(SIM_STEP);
    const hits = ofType(events, 'enemyHit');
    expect(hits).toHaveLength(1);
    expect(e.hp).toBeCloseTo(10000 - hits[0].damage);
    return hits[0].damage;
  }

  it('armadura reduz dano físico', () => {
    expect(hitDamage({ levels: [lv({ damage: 100 })] }, { armor: 0.4 })).toBeCloseTo(60);
  });

  it('perfuração reduz a armadura sem curar', () => {
    expect(hitDamage({ levels: [lv({ damage: 100, armorPierce: 0.25 })] }, { armor: 0.4 })).toBeCloseTo(85);
    expect(hitDamage({ levels: [lv({ damage: 100, armorPierce: 0.75 })] }, { armor: 0.5 })).toBeCloseTo(100);
  });

  it('resistência mágica reduz dano mágico e armadura não afeta', () => {
    expect(
      hitDamage({ damageType: 'magico', levels: [lv({ damage: 100 })] }, { magicResist: 0.5, armor: 0.9 }),
    ).toBeCloseTo(50);
  });

  it('respeita o dano mínimo', () => {
    expect(hitDamage({ levels: [lv({ damage: 10 })] }, { armor: 0.99 })).toBe(MIN_DAMAGE);
    expect(computeDamage(edef('goblin', { magicResist: 1 }), 50, 'magico', 0)).toBe(MIN_DAMAGE);
  });

  it('computeDamage segue as fórmulas', () => {
    expect(computeDamage(edef('golem', { armor: 0.7 }), 170, 'fisico', 0.8)).toBeCloseTo(170);
    expect(computeDamage(edef('golem', { armor: 0.7 }), 100, 'fisico', 0.6)).toBeCloseTo(90);
    expect(computeDamage(edef('orc', { armor: 0.4 }), 10, 'fisico', 0)).toBeCloseTo(6);
    expect(computeDamage(edef('xama', { magicResist: 0.5 }), 30, 'magico', 0)).toBeCloseTo(15);
  });

  it('morte dá recompensa e crédito à torre', () => {
    const { battle, events } = makeBattle({
      towers: { arqueiro: tdef('arqueiro', { levels: [lv({ damage: 200 })] }) },
      enemies: { goblin: edef('goblin', { reward: 7 }) },
      waves: [{ bonus: 0, groups: [grp('goblin', 2)] }],
    });
    const tower = battle.build('arqueiro', 5, 0);
    if (!tower) throw new Error('torre não construída');
    const [a, b] = spawnAll(battle);
    a.distance = 50;
    b.distance = 40;
    const gold = battle.gold;
    battle.update(SIM_STEP);
    expect(a.alive).toBe(false);
    expect(a.hp).toBeLessThanOrEqual(0);
    expect(battle.gold).toBe(gold + 7);
    expect(battle.stats.kills).toBe(1);
    expect(battle.stats.goldEarned).toBe(7);
    expect(tower.kills).toBe(1);
    expect(ofType(events, 'enemyKilled')).toEqual([{ type: 'enemyKilled', enemy: a, reward: 7, towerUid: tower.uid }]);
    expect(battle.enemies).toEqual([b]);
  });
});

describe('splash', () => {
  it('atinge todos os compatíveis no raio a partir do impacto', () => {
    const { battle, events } = makeBattle({
      towers: { canhao: tdef('canhao', { hitsAir: false, levels: [lv({ damage: 5, splashRadius: 25 })] }) },
      enemies: { morcego: edef('morcego', { flying: true }) },
      waves: [{ bonus: 0, groups: [grp('goblin', 3), grp('morcego', 1)] }],
    });
    const tower = battle.build('canhao', 5, 0);
    if (!tower) throw new Error('torre não construída');
    battle.setTargetMode(tower.uid, 'ultimo');
    const [near, mid, far, bat] = spawnAll(battle);
    near.distance = 50;
    mid.distance = 60;
    far.distance = 90;
    bat.distance = 55;
    battle.update(SIM_STEP);
    const hitUids = ofType(events, 'enemyHit').map((h) => h.enemy.uid).sort();
    expect(hitUids).toEqual([near.uid, mid.uid].sort());
    const impacts = ofType(events, 'projectileImpact');
    expect(impacts).toHaveLength(1);
    expect(impacts[0].x).toBeCloseTo(45);
    expect(impacts[0].y).toBeCloseTo(15);
  });
});

describe('lentidão', () => {
  it('aplica o menor fator e a maior duração', () => {
    const { battle, events } = makeBattle({
      towers: {
        gelo: tdef('gelo', { damageType: 'magico', levels: [lv({ damage: 1, slow: { factor: 0.5, duration: 1 } })] }),
        mago: tdef('mago', { damageType: 'magico', levels: [lv({ damage: 1, slow: { factor: 0.8, duration: 3 } })] }),
      },
      enemies: { goblin: edef('goblin', { hp: 1000 }) },
    });
    battle.build('gelo', 5, 0);
    battle.build('mago', 6, 0);
    const [e] = spawnAll(battle);
    e.distance = 50;
    battle.update(SIM_STEP);
    expect(e.slowFactor).toBe(0.5);
    expect(e.slowTimer).toBe(3);
    expect(ofType(events, 'enemySlowed')).toHaveLength(2);
  });

  it('não afeta inimigo imune', () => {
    const { battle, events } = makeBattle({
      towers: { gelo: tdef('gelo', { levels: [lv({ damage: 1, slow: { factor: 0.5, duration: 1 } })] }) },
      enemies: { goblin: edef('goblin', { hp: 1000, slowImmune: true }) },
    });
    battle.build('gelo', 5, 0);
    const [e] = spawnAll(battle);
    e.distance = 50;
    battle.update(SIM_STEP);
    expect(ofType(events, 'enemyHit')).toHaveLength(1);
    expect(ofType(events, 'enemySlowed')).toHaveLength(0);
    expect(e.slowFactor).toBe(1);
    expect(e.slowTimer).toBe(0);
  });
});

describe('projétil', () => {
  it('persegue a posição atual do alvo', () => {
    const { battle, events } = makeBattle({
      towers: { arqueiro: tdef('arqueiro', { levels: [lv({ damage: 1, projectileSpeed: 120 })] }) },
      enemies: { goblin: edef('goblin', { speed: 30, hp: 1000 }) },
    });
    battle.build('arqueiro', 5, 0);
    const [e] = spawnAll(battle);
    e.distance = 40;
    let impactAt: { x: number; y: number; ex: number; ey: number } | null = null;
    battle.on((ev) => {
      if (ev.type === 'projectileImpact' && impactAt === null) impactAt = { x: ev.x, y: ev.y, ex: e.x, ey: e.y };
    });
    battle.update(SIM_STEP);
    const fired = ofType(events, 'towerFired')[0].projectile;
    const firstTargetX = fired.targetX;
    battle.update(1);
    expect(impactAt).not.toBeNull();
    const hit = impactAt as unknown as { x: number; y: number; ex: number; ey: number };
    expect(hit.x).toBeCloseTo(hit.ex);
    expect(hit.y).toBeCloseTo(hit.ey);
    expect(hit.x).toBeGreaterThan(firstTargetX);
  });

  it('alvo morto no meio do voo: segue até a última posição e some sem dano', () => {
    const { battle, events } = makeBattle({
      towers: { arqueiro: tdef('arqueiro', { levels: [lv({ projectileSpeed: 60 })] }) },
      waves: [
        { bonus: 0, groups: [grp('goblin', 1)] },
        { bonus: 0, groups: [grp('goblin', 1)] },
      ],
    });
    battle.build('arqueiro', 5, 0);
    const [e] = spawnAll(battle);
    e.distance = 60;
    battle.update(SIM_STEP);
    expect(battle.projectiles).toHaveLength(1);
    const p = battle.projectiles[0];
    expect(p.targetX).toBeCloseTo(55);
    expect(p.targetY).toBeCloseTo(15);
    e.alive = false;
    battle.update(SIM_STEP);
    expect(battle.phase).toBe('preparando');
    expect(battle.projectiles).toHaveLength(1);
    battle.update(0.5);
    expect(battle.projectiles).toHaveLength(0);
    expect(p.done).toBe(true);
    expect(ofType(events, 'enemyHit')).toHaveLength(0);
    const impacts = ofType(events, 'projectileImpact');
    expect(impacts).toHaveLength(1);
    expect(impacts[0].x).toBeCloseTo(55);
    expect(impacts[0].y).toBeCloseTo(15);
  });
});

describe('vazamento e derrota', () => {
  it('vazamento tira vidas e a onda termina', () => {
    const { battle, events } = makeBattle({
      lives: 5,
      enemies: { goblin: edef('goblin', { speed: 500, lifeDamage: 2 }) },
      waves: [
        { bonus: 0, groups: [grp('goblin', 1)] },
        { bonus: 0, groups: [grp('goblin', 1)] },
      ],
    });
    battle.startNextWave();
    battle.update(1);
    expect(battle.lives).toBe(3);
    expect(battle.stats.leaked).toBe(1);
    expect(battle.enemies).toHaveLength(0);
    const leaked = ofType(events, 'enemyLeaked');
    expect(leaked).toHaveLength(1);
    expect(leaked[0].lifeDamage).toBe(2);
    expect(leaked[0].enemy.leaked).toBe(true);
    expect(leaked[0].enemy.alive).toBe(false);
    expect(ofType(events, 'livesChanged')).toEqual([{ type: 'livesChanged', lives: 3 }]);
    expect(battle.phase).toBe('preparando');
  });

  it('vidas zeradas levam à derrota e param tudo', () => {
    const { battle, events } = makeBattle({
      lives: 3,
      enemies: { goblin: edef('goblin', { speed: 1000, lifeDamage: 2 }) },
      waves: [{ bonus: 0, groups: [grp('goblin', 3)] }],
    });
    battle.startNextWave();
    battle.update(1);
    expect(battle.phase).toBe('derrota');
    expect(battle.lives).toBe(0);
    expect(ofType(events, 'defeat')).toHaveLength(1);
    expect(ofType(events, 'enemyLeaked')).toHaveLength(2);
    expect(events[events.length - 1].type).toBe('defeat');
    const count = events.length;
    const elapsed = battle.stats.elapsed;
    battle.update(1);
    expect(events).toHaveLength(count);
    expect(battle.stats.elapsed).toBe(elapsed);
    expect(battle.startNextWave()).toBe(false);
  });
});

describe('fim de onda', () => {
  it('limpa a onda, paga o bônus e volta a preparar', () => {
    const { battle, events } = makeBattle({
      towers: { arqueiro: tdef('arqueiro', { levels: [lv({ damage: 500 })] }) },
      enemies: { goblin: edef('goblin', { speed: 30, reward: 4 }) },
      waves: [
        { bonus: 15, groups: [grp('goblin', 2, 0.5)] },
        { bonus: 0, groups: [grp('goblin', 1)] },
      ],
      gold: 100,
    });
    battle.build('arqueiro', 5, 0);
    battle.startNextWave();
    battle.update(3);
    expect(battle.phase).toBe('preparando');
    expect(battle.stats.kills).toBe(2);
    expect(battle.gold).toBe(100 - 50 + 8 + 15);
    expect(battle.stats.goldEarned).toBe(23);
    expect(ofType(events, 'waveCleared')).toEqual([{ type: 'waveCleared', wave: 1, bonus: 15 }]);
    expect(ofType(events, 'victory')).toHaveLength(0);
    expect(battle.startNextWave()).toBe(true);
    expect(battle.waveNumber).toBe(2);
  });

  it('a última onda limpa leva à vitória', () => {
    const { battle, events } = makeBattle({
      towers: { arqueiro: tdef('arqueiro', { levels: [lv({ damage: 500 })] }) },
      enemies: { goblin: edef('goblin', { speed: 30 }) },
      waves: [{ bonus: 0, groups: [grp('goblin', 1)] }],
    });
    battle.build('arqueiro', 5, 0);
    battle.startNextWave();
    battle.update(3);
    expect(battle.phase).toBe('vitoria');
    expect(ofType(events, 'waveCleared')).toEqual([{ type: 'waveCleared', wave: 1, bonus: 0 }]);
    expect(ofType(events, 'goldChanged').length).toBeGreaterThan(0);
    expect(events[events.length - 1].type).toBe('victory');
    expect(battle.startNextWave()).toBe(false);
    expect(battle.build('arqueiro', 6, 0)).toBeNull();
    const count = events.length;
    battle.update(1);
    expect(events).toHaveLength(count);
  });

  it('não termina enquanto houver grupos por spawnar', () => {
    const { battle } = makeBattle({
      enemies: { goblin: edef('goblin', { speed: 1000 }) },
      waves: [{ bonus: 0, groups: [grp('goblin', 2, 2)] }],
    });
    battle.startNextWave();
    battle.update(1);
    expect(battle.enemies).toHaveLength(0);
    expect(battle.phase).toBe('onda');
    battle.update(1.5);
    expect(battle.phase).toBe('vitoria');
  });
});

describe('update', () => {
  it('ignora dt <= 0', () => {
    const { battle } = makeBattle({ enemies: { goblin: edef('goblin', { speed: 30 }) } });
    const [e] = spawnAll(battle);
    const d = e.distance;
    const elapsed = battle.stats.elapsed;
    battle.update(0);
    battle.update(-1);
    battle.update(Number.NaN);
    expect(e.distance).toBe(d);
    expect(battle.stats.elapsed).toBe(elapsed);
  });

  it('elapsed só conta durante a onda', () => {
    const { battle } = makeBattle({ enemies: { goblin: edef('goblin', { speed: 30 }) } });
    battle.update(2);
    expect(battle.stats.elapsed).toBe(0);
    battle.startNextWave();
    battle.update(1);
    expect(battle.stats.elapsed).toBeCloseTo(1);
  });

  it('dt grande é dividido em sub-passos sem pular o alvo', () => {
    const { battle, events } = makeBattle({
      towers: { arqueiro: tdef('arqueiro', { levels: [lv({ damage: 1, range: 15 })] }) },
      enemies: { goblin: edef('goblin', { speed: 600, hp: 1000 }) },
    });
    battle.build('arqueiro', 5, 0);
    battle.startNextWave();
    battle.update(0.5);
    expect(ofType(events, 'towerFired').length).toBeGreaterThanOrEqual(1);
    expect(ofType(events, 'enemyHit').length).toBeGreaterThanOrEqual(1);
    expect(battle.stats.leaked).toBe(1);
  });

  it('um update grande equivale a vários pequenos', () => {
    const setup: Setup = {
      towers: { arqueiro: tdef('arqueiro', { levels: [lv({ damage: 3, fireRate: 1.3, projectileSpeed: 200, range: 40 })] }) },
      enemies: { goblin: edef('goblin', { speed: 25, hp: 500 }) },
      waves: [{ bonus: 0, groups: [grp('goblin', 3, 0.7)] }],
    };
    const big = makeBattle(setup);
    const small = makeBattle(setup);
    for (const b of [big.battle, small.battle]) {
      b.build('arqueiro', 3, 0);
      b.startNextWave();
    }
    big.battle.update(1.5);
    for (let i = 0; i < 90; i++) small.battle.update(SIM_STEP);
    expect(big.battle.enemies.map((e) => e.distance)).toHaveLength(small.battle.enemies.length);
    big.battle.enemies.forEach((e, i) => {
      expect(e.distance).toBeCloseTo(small.battle.enemies[i].distance, 6);
      expect(e.hp).toBeCloseTo(small.battle.enemies[i].hp, 6);
    });
    expect(ofType(big.events, 'towerFired')).toHaveLength(ofType(small.events, 'towerFired').length);
    expect(big.battle.stats.elapsed).toBeCloseTo(1.5);
  });
});

describe('eventos', () => {
  it('on retorna função que remove o ouvinte', () => {
    const { battle } = makeBattle();
    const got: string[] = [];
    const off = battle.on((e) => got.push(e.type));
    battle.build('arqueiro', 5, 0);
    off();
    battle.build('arqueiro', 6, 0);
    expect(got).toEqual(['towerBuilt', 'goldChanged']);
  });

  it('um ouvinte que se remove não impede os outros', () => {
    const { battle, events } = makeBattle();
    const off = battle.on(() => off());
    battle.build('arqueiro', 5, 0);
    expect(events).toHaveLength(2);
  });
});
