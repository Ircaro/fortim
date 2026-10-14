import { describe, expect, it } from 'vitest';
import type { BattleEvent, BattleOptions, EnemyDef, EnemyId, EnemyState, MapDef, TowerDef, TowerId, TowerLevel, WaveDef, WaveGroup } from '../core/types';
import { ENEMIES } from '../data/enemies';
import { TOWERS, TOWER_ORDER, lvl } from '../data/towers';
import { Battle, computeDamage, towerLevel } from './battle';
import { createStageBattle } from './index';

const LINE: MapDef = { name: 'Linha', cols: 60, rows: 3, paths: [[{ col: -1, row: 1 }, { col: 60, row: 1 }]], blocked: [] };

const TWO: MapDef = {
  name: 'Dois',
  cols: 12,
  rows: 5,
  paths: [
    [{ col: -1, row: 0 }, { col: 10, row: 0 }],
    [{ col: -1, row: 4 }, { col: 10, row: 4 }],
  ],
  blocked: [],
};

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

function lv(p: Partial<TowerLevel> = {}): TowerLevel {
  return lvl({ cost: 50, damage: 10, range: 1000, fireRate: 1, projectileSpeed: 100000, ...p });
}

function tdef(id: TowerId, level: Partial<TowerLevel> = {}, p: Partial<TowerDef> = {}): TowerDef {
  return { ...TOWERS[id], damageType: 'fisico', hitsGround: true, hitsAir: true, levels: [lv(level)], ...p };
}

function grp(enemy: EnemyId, count: number, interval = 0, delay = 0, hpMultiplier = 1, path?: number): WaveGroup {
  return path === undefined ? { enemy, count, interval, delay, hpMultiplier } : { enemy, count, interval, delay, hpMultiplier, path };
}

interface Setup {
  map?: MapDef;
  towers?: Partial<Record<TowerId, TowerDef>>;
  enemies?: Partial<Record<EnemyId, EnemyDef>>;
  waves?: WaveDef[];
  gold?: number;
  lives?: number;
  extra?: Partial<BattleOptions>;
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
    ...s.extra,
  });
  const events: BattleEvent[] = [];
  battle.on((e) => events.push(e));
  return { battle, events };
}

function ofType<T extends BattleEvent['type']>(events: BattleEvent[], type: T): Extract<BattleEvent, { type: T }>[] {
  return events.filter((e): e is Extract<BattleEvent, { type: T }> => e.type === type);
}

function place(battle: Battle, enemy: EnemyState, distance: number): void {
  enemy.distance = distance;
  const p = battle.positionAt(distance, enemy.path);
  enemy.x = p.x;
  enemy.y = p.y;
}

function spawnAll(battle: Battle): EnemyState[] {
  battle.startNextWave();
  battle.update(1 / 60);
  return [...battle.enemies];
}

describe('vários caminhos', () => {
  it('expõe pontos e comprimentos de cada caminho e mantém o caminho 0 como padrão', () => {
    const { battle } = makeBattle({ map: TWO });
    expect(battle.paths).toHaveLength(2);
    expect(battle.pathLengths).toEqual([110, 110]);
    expect(battle.pathPoints).toEqual(battle.paths[0]);
    expect(battle.positionAt(0, 1)).toMatchObject({ x: -5, y: 45 });
  });

  it('sem caminho no grupo, alterna os caminhos a cada spawn', () => {
    const { battle } = makeBattle({ map: TWO, waves: [{ bonus: 0, groups: [grp('goblin', 4)] }] });
    const enemies = spawnAll(battle);
    expect(enemies.map((e) => e.path)).toEqual([0, 1, 0, 1]);
    expect(enemies.map((e) => e.y)).toEqual([5, 45, 5, 45]);
  });

  it('respeita o caminho explícito do grupo', () => {
    const { battle } = makeBattle({ map: TWO, waves: [{ bonus: 0, groups: [grp('goblin', 3, 0, 0, 1, 1)] }] });
    expect(spawnAll(battle).every((e) => e.path === 1)).toBe(true);
  });

  it('o inimigo vaza por qualquer caminho', () => {
    const { battle, events } = makeBattle({
      map: TWO,
      enemies: { goblin: edef('goblin', { speed: 200, lifeDamage: 3 }) },
      waves: [{ bonus: 0, groups: [grp('goblin', 1, 0, 0, 1, 1)] }],
    });
    battle.startNextWave();
    battle.update(1);
    const leak = ofType(events, 'enemyLeaked')[0];
    expect(leak.enemy.path).toBe(1);
    expect(battle.lives).toBe(17);
  });
});

describe('curandeiro', () => {
  const healer = edef('curandeiro', { ability: ENEMIES.curandeiro.ability });

  it('cura aliados próximos em 6% da vida máxima por segundo, sem passar do máximo', () => {
    const { battle } = makeBattle({ enemies: { curandeiro: healer }, waves: [{ bonus: 0, groups: [grp('goblin', 2), grp('curandeiro', 1)] }] });
    const [a, b] = spawnAll(battle);
    a.hp = 50;
    b.hp = 99;
    battle.update(1);
    expect(a.hp).toBeCloseTo(56, 0);
    expect(b.hp).toBe(100);
  });

  it('dois curandeiros não acumulam a cura', () => {
    const { battle } = makeBattle({ enemies: { curandeiro: healer }, waves: [{ bonus: 0, groups: [grp('goblin', 1), grp('curandeiro', 2)] }] });
    const [a] = spawnAll(battle);
    a.hp = 50;
    battle.update(1);
    expect(a.hp).toBeCloseTo(56, 0);
  });

  it('cura o chefe só em 2% por segundo e ignora quem está longe', () => {
    const { battle } = makeBattle({
      enemies: { curandeiro: healer, rei: edef('rei', { hp: 1000, isBoss: true }) },
      waves: [{ bonus: 0, groups: [grp('rei', 1), grp('goblin', 1), grp('curandeiro', 1)] }],
    });
    const [boss, far] = spawnAll(battle);
    boss.hp = 500;
    far.hp = 50;
    place(battle, far, 300);
    battle.update(1);
    expect(boss.hp).toBeCloseTo(520, 0);
    expect(far.hp).toBe(50);
  });

  it('avisa a cura no máximo a cada meio segundo', () => {
    const { battle, events } = makeBattle({ enemies: { curandeiro: healer }, waves: [{ bonus: 0, groups: [grp('goblin', 1), grp('curandeiro', 1)] }] });
    const [a] = spawnAll(battle);
    a.hp = 1;
    a.maxHp = 100000;
    battle.update(2);
    const heals = ofType(events, 'enemyHealed');
    expect(heals.length).toBeGreaterThanOrEqual(3);
    expect(heals.length).toBeLessThanOrEqual(5);
    expect(heals[0].targets).toContain(a);
  });
});

describe('escudeiro', () => {
  const shield = edef('escudeiro', { ability: ENEMIES.escudeiro.ability });

  it('quem está perto dele leva 30% menos dano e quem está longe não', () => {
    const { battle } = makeBattle({ enemies: { escudeiro: shield }, waves: [{ bonus: 0, groups: [grp('goblin', 2), grp('escudeiro', 1)] }] });
    const [near, far, guard] = spawnAll(battle);
    place(battle, near, 100);
    place(battle, guard, 105);
    place(battle, far, 300);
    battle.build('arqueiro', 0, 0);
    battle.setTargetMode(battle.towers[0].uid, 'forte');
    battle.update(1 / 60);
    expect(near.shielded).toBe(true);
    expect(guard.shielded).toBe(true);
    expect(far.shielded).toBe(false);
  });

  it('a redução vale para o próprio escudeiro e não acumula entre escudeiros', () => {
    const { battle } = makeBattle({ enemies: { escudeiro: shield }, waves: [{ bonus: 0, groups: [grp('goblin', 1), grp('escudeiro', 2)] }] });
    const [goblin, g1, g2] = spawnAll(battle);
    for (const e of [goblin, g1, g2]) place(battle, e, 100);
    battle.update(1 / 60);
    battle.build('arqueiro', 0, 0);
    battle.update(1 / 60);
    const hit = 100 - goblin.hp + (100 - g1.hp) + (100 - g2.hp);
    expect(hit).toBeCloseTo(7, 5);
  });
});

describe('lodo', () => {
  it('ao morrer vira dois lodinhos na mesma trilha, perto de onde caiu', () => {
    const { battle, events } = makeBattle({
      map: TWO,
      enemies: { lodo: edef('lodo', { hp: 5, ability: ENEMIES.lodo.ability }), lodinho: edef('lodinho', { hp: 35 }) },
      waves: [{ bonus: 0, groups: [grp('lodo', 1, 0, 0, 2, 1)] }],
    });
    const [lodo] = spawnAll(battle);
    place(battle, lodo, 50);
    battle.build('arqueiro', 5, 2);
    battle.update(1 / 60);
    const split = ofType(events, 'enemySplit')[0];
    expect(split.enemy).toBe(lodo);
    expect(split.children).toHaveLength(2);
    expect(split.children.map((c) => c.distance)).toEqual([50 - 1.25, 50 + 1.25]);
    for (const child of split.children) {
      expect(child.def.id).toBe('lodinho');
      expect(child.path).toBe(1);
      expect(child.wave).toBe(1);
      expect(child.maxHp).toBe(70);
    }
    const spawned = ofType(events, 'enemySpawned').map((e) => e.enemy);
    expect(spawned).toEqual(expect.arrayContaining(split.children));
  });

  it('o lodinho não se divide de novo', () => {
    const { battle, events } = makeBattle({ enemies: { lodinho: edef('lodinho', { hp: 5 }) }, waves: [{ bonus: 0, groups: [grp('lodinho', 1)] }] });
    const [e] = spawnAll(battle);
    place(battle, e, 50);
    battle.build('arqueiro', 0, 0);
    battle.update(1 / 60);
    expect(ofType(events, 'enemyKilled')).toHaveLength(1);
    expect(ofType(events, 'enemySplit')).toHaveLength(0);
  });

  it('a recompensa do lodo e dos lodinhos somada vale mais que um lodo sozinho', () => {
    expect(ENEMIES.lodo.reward + 2 * ENEMIES.lodinho.reward).toBeGreaterThan(ENEMIES.lodo.reward);
    expect(ENEMIES.lodinho.speed).toBeGreaterThan(ENEMIES.lodo.speed);
    expect(ENEMIES.lodinho.ability).toBeNull();
  });
});

describe('rei goblin', () => {
  it('é o único chefe e resiste à lentidão pela metade', () => {
    expect(Object.values(ENEMIES).filter((e) => e.isBoss).map((e) => e.id)).toEqual(['rei']);
    expect(ENEMIES.rei.slowResist).toBe(0.5);
    expect(ENEMIES.golem.slowImmune).toBe(true);
    expect(ENEMIES.rei.lifeDamage).toBe(10);
  });

  it('invoca 3 goblins a cada 7 segundos um pouco atrás dele', () => {
    const { battle, events } = makeBattle({
      map: TWO,
      enemies: { rei: edef('rei', { hp: 5000, isBoss: true, ability: ENEMIES.rei.ability }) },
      waves: [{ bonus: 0, groups: [grp('rei', 1, 0, 0, 1.5, 1)] }],
    });
    const [boss] = spawnAll(battle);
    place(battle, boss, 60);
    battle.update(7);
    const summon = ofType(events, 'bossSummon');
    expect(summon).toHaveLength(1);
    expect(summon[0].summoned.map((e) => e.distance)).toEqual([56, 52, 48]);
    for (const g of summon[0].summoned) {
      expect(g.def.id).toBe('goblin');
      expect(g.path).toBe(1);
      expect(g.wave).toBe(1);
      expect(g.maxHp).toBe(150);
    }
    battle.update(7);
    expect(ofType(events, 'bossSummon')).toHaveLength(2);
  });

  it('a lentidão no chefe tem metade do efeito e o golem continua imune', () => {
    const slow = { factor: 0.5, duration: 2 };
    const { battle } = makeBattle({
      towers: { gelo: tdef('gelo', { slow, damage: 1 }, { damageType: 'magico' }) },
      enemies: { rei: edef('rei', { isBoss: true, slowResist: 0.5 }), golem: edef('golem', { slowImmune: true }) },
      waves: [{ bonus: 0, groups: [grp('rei', 1), grp('golem', 1)] }],
    });
    const [boss, golem] = spawnAll(battle);
    place(battle, boss, 100);
    place(battle, golem, 50);
    battle.build('gelo', 0, 0);
    battle.setTargetMode(battle.towers[0].uid, 'primeiro');
    battle.update(1 / 60);
    expect(boss.slowFactor).toBeCloseTo(0.75);
    battle.setTargetMode(battle.towers[0].uid, 'ultimo');
    battle.update(1.01);
    expect(golem.slowFactor).toBe(1);
  });
});

describe('chamar a onda mais cedo', () => {
  const waves: WaveDef[] = [
    { bonus: 5, groups: [grp('goblin', 1)] },
    { bonus: 7, groups: [grp('lobo', 1)] },
    { bonus: 9, groups: [grp('goblin', 1)] },
  ];
  const enemies = { goblin: edef('goblin', { speed: 10 }), lobo: edef('lobo', { speed: 100 }) };
  const map: MapDef = { ...LINE, cols: 10, paths: [[{ col: -1, row: 1 }, { col: 10, row: 1 }]] };

  it('só libera na onda quando todos os inimigos dela já entraram', () => {
    const { battle } = makeBattle({ map, enemies, waves: [{ bonus: 0, groups: [grp('goblin', 2, 1)] }, ...waves] });
    expect(battle.canCallEarly()).toBe(false);
    battle.startNextWave();
    battle.update(0.1);
    expect(battle.canCallEarly()).toBe(false);
    expect(battle.callEarly()).toBe(0);
    battle.update(1);
    expect(battle.canCallEarly()).toBe(true);
  });

  it('dá o bônus, começa a próxima na hora e conta na estatística', () => {
    const { battle, events } = makeBattle({ map, enemies, waves });
    battle.startNextWave();
    battle.update(1 / 60);
    const gold = battle.gold;
    expect(battle.earlyBonus()).toBe(12);
    expect(battle.callEarly()).toBe(12);
    expect(battle.gold).toBe(gold + 12);
    expect(battle.waveNumber).toBe(2);
    expect(battle.activeWaves).toEqual([1, 2]);
    expect(battle.stats.earlyCalls).toBe(1);
    expect(ofType(events, 'waveCalledEarly')).toEqual([{ type: 'waveCalledEarly', wave: 2, bonus: 12 }]);
    expect(ofType(events, 'waveStarted').map((e) => e.wave)).toEqual([1, 2]);
    expect(battle.startNextWave()).toBe(false);
  });

  it('cada onda é limpa por conta própria e a fase só volta a preparar no fim', () => {
    const { battle, events } = makeBattle({ map, enemies, waves });
    battle.startNextWave();
    battle.update(1 / 60);
    battle.callEarly();
    battle.update(2);
    expect(ofType(events, 'waveCleared')).toEqual([{ type: 'waveCleared', wave: 2, bonus: 7 }]);
    expect(battle.phase).toBe('onda');
    battle.update(12);
    expect(ofType(events, 'waveCleared').map((e) => e.wave)).toEqual([2, 1]);
    expect(battle.phase).toBe('preparando');
  });

  it('chamar a última onda cedo só vence quando todas acabam', () => {
    const { battle, events } = makeBattle({ map, enemies, waves: waves.slice(0, 2) });
    battle.startNextWave();
    battle.update(1 / 60);
    battle.callEarly();
    expect(battle.canCallEarly()).toBe(false);
    battle.update(2);
    expect(battle.phase).toBe('onda');
    expect(ofType(events, 'victory')).toHaveLength(0);
    battle.update(12);
    expect(battle.phase).toBe('vitoria');
    expect(ofType(events, 'victory')).toHaveLength(1);
  });

  it('inimigos invocados e lodinhos seguram a onda de origem', () => {
    const { battle, events } = makeBattle({
      map,
      enemies: { lodo: edef('lodo', { hp: 1, speed: 10, ability: ENEMIES.lodo.ability }), lodinho: edef('lodinho', { hp: 1000, speed: 10 }) },
      waves: [{ bonus: 0, groups: [grp('lodo', 1)] }],
    });
    const [lodo] = spawnAll(battle);
    place(battle, lodo, 20);
    battle.build('arqueiro', 0, 0);
    battle.update(1 / 60);
    expect(battle.enemies.every((e) => e.wave === 1)).toBe(true);
    battle.update(1);
    expect(ofType(events, 'waveCleared')).toHaveLength(0);
  });
});

describe('poderes', () => {
  it('começam prontos', () => {
    const { battle } = makeBattle();
    expect(battle.powers.map((p) => [p.id, p.cooldown, p.active])).toEqual([
      ['flechas', 0, 0],
      ['congelar', 0, 0],
      ['furia', 0, 0],
    ]);
    expect(battle.powers.map((p) => p.maxCooldown)).toEqual([30, 45, 60]);
  });

  it('chuva de flechas precisa de alvo e acerta todos na área, inclusive voadores', () => {
    const { battle, events } = makeBattle({
      enemies: { goblin: edef('goblin', { hp: 200, armor: 0.5 }), morcego: edef('morcego', { hp: 200, flying: true }) },
      waves: [{ bonus: 0, groups: [grp('goblin', 2), grp('morcego', 1)] }],
    });
    const [a, far, bat] = spawnAll(battle);
    place(battle, a, 100);
    place(battle, bat, 105);
    place(battle, far, 300);
    expect(battle.castPower('flechas')).toBe(false);
    expect(battle.powers[0].cooldown).toBe(0);
    expect(battle.castPower('flechas', { x: a.x, y: a.y })).toBe(true);
    const damage = 80 * 1.05;
    expect(a.hp).toBeCloseTo(200 - damage * 0.8);
    expect(bat.hp).toBeCloseTo(200 - damage);
    expect(far.hp).toBe(200);
    expect(ofType(events, 'powerCast')[0]).toMatchObject({ power: 'flechas', target: { x: a.x, y: a.y } });
    expect(battle.stats.powersUsed.flechas).toBe(1);
  });

  it('recarrega no update, avisa quando fica pronto e não deixa usar antes', () => {
    const { battle, events } = makeBattle();
    expect(battle.castPower('flechas', { x: 0, y: 0 })).toBe(true);
    expect(battle.canCastPower('flechas')).toBe(false);
    expect(battle.castPower('flechas', { x: 0, y: 0 })).toBe(false);
    battle.update(29);
    expect(battle.powers[0].cooldown).toBeCloseTo(1);
    battle.update(1.01);
    expect(battle.canCastPower('flechas')).toBe(true);
    expect(ofType(events, 'powerReady')).toEqual([{ type: 'powerReady', power: 'flechas' }]);
  });

  it('congelar para todos por 3 segundos; golem e chefe só ficam a metade da velocidade', () => {
    const { battle } = makeBattle({
      enemies: { goblin: edef('goblin', { speed: 10 }), golem: edef('golem', { speed: 10, slowImmune: true }), rei: edef('rei', { speed: 10, isBoss: true, slowResist: 0.5 }) },
      waves: [{ bonus: 0, groups: [grp('goblin', 1), grp('golem', 1), grp('rei', 1)] }],
    });
    const [g, golem, boss] = spawnAll(battle);
    const start = [g.distance, golem.distance, boss.distance];
    expect(battle.castPower('congelar')).toBe(true);
    battle.update(2);
    expect(g.distance).toBeCloseTo(start[0]);
    expect(golem.distance - start[1]).toBeCloseTo(10, 0);
    expect(boss.distance - start[2]).toBeCloseTo(10, 0);
    battle.update(2);
    expect(g.distance - start[0]).toBeCloseTo(10, 0);
  });

  it('fúria faz as torres atirarem 50% mais rápido por 8 segundos', () => {
    const shots = (fury: boolean): number => {
      const { battle, events } = makeBattle({ enemies: { goblin: edef('goblin', { hp: 1e9 }) } });
      const [e] = spawnAll(battle);
      place(battle, e, 100);
      battle.build('arqueiro', 0, 0);
      if (fury) battle.castPower('furia');
      battle.update(3.99);
      return ofType(events, 'towerFired').length;
    };
    expect(shots(false)).toBe(4);
    expect(shots(true)).toBe(6);
  });

  it('não funcionam depois da derrota', () => {
    const { battle } = makeBattle({ lives: 1, enemies: { goblin: edef('goblin', { speed: 1000 }) } });
    battle.startNextWave();
    battle.update(1);
    expect(battle.phase).toBe('derrota');
    expect(battle.castPower('congelar')).toBe(false);
    expect(battle.canCastPower('furia')).toBe(false);
  });
});

describe('dificuldade', () => {
  const waves: WaveDef[] = [{ bonus: 0, groups: [grp('goblin', 1)] }];

  it('ajusta vida dos inimigos, ouro inicial e vidas', () => {
    const cases = [
      ['facil', 80, 250, 25],
      ['normal', 100, 200, 20],
      ['dificil', 110, 200, 15],
    ] as const;
    for (const [difficulty, hp, gold, lives] of cases) {
      const { battle } = makeBattle({ gold: 200, waves, extra: { difficulty } });
      expect(battle.difficulty).toBe(difficulty);
      expect(battle.gold).toBe(gold);
      expect(battle.lives).toBe(lives);
      expect(spawnAll(battle)[0].maxHp).toBe(hp);
    }
  });

  it('sem dificuldade usa os valores passados', () => {
    const { battle } = makeBattle({ gold: 123, lives: 7, waves });
    expect(battle.difficulty).toBe('normal');
    expect([battle.gold, battle.lives]).toEqual([123, 7]);
  });
});

describe('modo infinito', () => {
  it('não vence ao fim das ondas da fase e segue com ondas geradas', () => {
    const generated: WaveDef = { bonus: 3, groups: [grp('lobo', 2)] };
    const { battle, events } = makeBattle({
      enemies: { goblin: edef('goblin', { speed: 1000 }), lobo: edef('lobo', { speed: 1000 }) },
      extra: { infinite: true, infiniteWave: () => generated },
    });
    expect(battle.infinite).toBe(true);
    battle.startNextWave();
    battle.update(1);
    expect(battle.phase).toBe('preparando');
    expect(ofType(events, 'victory')).toHaveLength(0);
    expect(battle.waveDef(2)).toBe(generated);
    expect(battle.startNextWave()).toBe(true);
    expect(battle.waveNumber).toBe(2);
    expect(battle.totalWaves).toBe(1);
    battle.update(1);
    expect(battle.phase).toBe('preparando');
    expect(battle.canCallEarly()).toBe(false);
  });

  it('fora do infinito não existe onda depois da última', () => {
    const { battle } = makeBattle();
    expect(battle.waveDef(2)).toBeUndefined();
    expect(battle.waveDef(0)).toBeUndefined();
  });

  it('a fase de verdade gera ondas com chefe no infinito', () => {
    const battle = createStageBattle('vale', { infinite: true });
    expect(battle.waveDef(25)?.groups.some((g) => g.enemy === 'rei')).toBe(true);
    expect(battle.waveDef(24)?.groups.some((g) => g.enemy === 'rei')).toBe(false);
  });
});

describe('torre de raio', () => {
  it('entra no fim da loja com atalho 6', () => {
    expect(TOWER_ORDER[TOWER_ORDER.length - 1]).toBe('raio');
    expect(TOWERS.raio.hotkey).toBe('6');
    expect(TOWERS.raio.damageType).toBe('magico');
    expect(TOWERS.raio.hitsAir && TOWERS.raio.hitsGround).toBe(true);
  });

  it('acerta na hora e salta para o mais próximo perdendo 20% por salto', () => {
    const { battle, events } = makeBattle({
      towers: { raio: tdef('raio', { chain: { jumps: 2, radius: 1.6, falloff: 0.2 } }) },
      waves: [{ bonus: 0, groups: [grp('goblin', 4)] }],
    });
    const enemies = spawnAll(battle);
    [40, 30, 20, 4].forEach((d, i) => place(battle, enemies[i], d));
    battle.build('raio', 0, 0);
    battle.update(1 / 60);
    expect(enemies.map((e) => e.hp)).toEqual([90, 92, 93.6, 100]);
    const chain = ofType(events, 'chainLightning')[0];
    expect(chain.uids).toEqual([enemies[0].uid, enemies[1].uid, enemies[2].uid]);
    expect(chain.points).toHaveLength(4);
    expect(ofType(events, 'towerFired')).toHaveLength(0);
  });
});

describe('mecânicas das especializações', () => {
  it('multialvo dispara em alvos diferentes', () => {
    const { battle, events } = makeBattle({ towers: { arqueiro: tdef('arqueiro', { targets: 3 }) }, waves: [{ bonus: 0, groups: [grp('goblin', 4)] }] });
    const enemies = spawnAll(battle);
    enemies.forEach((e, i) => place(battle, e, 20 + i * 10));
    battle.build('arqueiro', 0, 0);
    battle.update(1 / 60);
    const targets = ofType(events, 'towerFired').map((e) => e.projectile.targetUid);
    expect(new Set(targets).size).toBe(3);
  });

  it('atordoamento para o inimigo; golem e chefe ficam metade do tempo', () => {
    const { battle, events } = makeBattle({
      towers: { canhao: tdef('canhao', { damage: 1, splashRadius: 1000, fireRate: 0.01, stun: { duration: 0.4, heavySlow: null } }) },
      enemies: { goblin: edef('goblin', { speed: 10 }), golem: edef('golem', { speed: 10, slowImmune: true }) },
      waves: [{ bonus: 0, groups: [grp('goblin', 1), grp('golem', 1)] }],
    });
    const [g, golem] = spawnAll(battle);
    place(battle, g, 30);
    place(battle, golem, 20);
    battle.build('canhao', 0, 0);
    battle.update(1 / 60);
    expect(g.stunTimer).toBeCloseTo(0.4, 1);
    expect(golem.stunTimer).toBeCloseTo(0.2, 1);
    const before = g.distance;
    battle.update(0.3);
    expect(g.distance).toBeCloseTo(before, 5);
    battle.update(0.5);
    expect(g.distance).toBeGreaterThan(before);
    expect(ofType(events, 'enemyStunned').length).toBeGreaterThanOrEqual(2);
  });

  it('congelamento da lança só deixa golem e chefe lentos', () => {
    const { battle } = makeBattle({
      towers: { gelo: tdef('gelo', { damage: 1, splashRadius: 1000, fireRate: 0.01, stun: { duration: 1, heavySlow: 0.5 } }) },
      enemies: { golem: edef('golem', { slowImmune: true }) },
      waves: [{ bonus: 0, groups: [grp('golem', 1)] }],
    });
    const [golem] = spawnAll(battle);
    place(battle, golem, 20);
    battle.build('gelo', 0, 0);
    battle.update(1 / 60);
    expect(golem.stunTimer).toBe(0);
    expect(golem.slowFactor).toBe(0.5);
  });

  it('queimadura causa dano por segundo durante a duração', () => {
    const { battle } = makeBattle({
      towers: { mago: tdef('mago', { damage: 1, fireRate: 0.01, burn: { dps: 10, duration: 3 } }, { damageType: 'magico' }) },
      enemies: { goblin: edef('goblin', { magicResist: 0.5 }) },
    });
    const [e] = spawnAll(battle);
    place(battle, e, 20);
    battle.build('mago', 0, 0);
    battle.update(4);
    expect(e.hp).toBeCloseTo(100 - 1 - 15, 0);
    expect(e.burnTimer).toBe(0);
  });

  it('aura contínua fere e deixa lento sem disparar projétil', () => {
    const { battle, events } = makeBattle({
      towers: { gelo: tdef('gelo', { aura: true, damage: 10, range: 100, slow: { factor: 0.5, duration: 0.4 } }, { damageType: 'magico' }) },
      waves: [{ bonus: 0, groups: [grp('goblin', 2)] }],
    });
    const [near, far] = spawnAll(battle);
    place(battle, near, 20);
    place(battle, far, 400);
    battle.build('gelo', 0, 0);
    battle.update(1);
    expect(near.hp).toBeCloseTo(90, 0);
    expect(near.slowFactor).toBe(0.5);
    expect(far.hp).toBe(100);
    expect(ofType(events, 'towerFired')).toHaveLength(0);
  });

  it('o virote perfurante atravessa e acerta todos na linha uma vez', () => {
    const map: MapDef = { name: 'Reta', cols: 60, rows: 2, paths: [[{ col: -1, row: 0 }, { col: 60, row: 0 }]], blocked: [] };
    const { battle } = makeBattle({
      map,
      towers: { balista: tdef('balista', { line: true, damage: 10, fireRate: 0.01 }) },
      waves: [{ bonus: 0, groups: [grp('goblin', 3)] }],
    });
    const enemies = spawnAll(battle);
    [515, 505, 95].forEach((d, i) => place(battle, enemies[i], d));
    battle.build('balista', 0, 1);
    battle.update(1 / 60);
    expect(enemies.map((e) => e.hp)).toEqual([90, 90, 100]);
    expect(battle.projectiles).toHaveLength(0);
  });

  it('perfuração mágica reduz a resistência sem curar', () => {
    const def = edef('xama', { magicResist: 0.5 });
    expect(computeDamage(def, 100, 'magico', 0, 0.5)).toBe(100);
    expect(computeDamage(def, 100, 'magico', 0, 0.8)).toBe(100);
    expect(computeDamage(def, 100, 'magico', 0, 0.2)).toBeCloseTo(70);
  });
});

describe('especialização e melhorias +', () => {
  function maxed(id: TowerId): { battle: Battle; uid: number } {
    const battle = createStageBattle('vale');
    battle.gold = 100000;
    const tower = battle.build(id, 0, 1)!;
    expect(battle.specCost(tower.uid, 'a')).toBeNull();
    while (battle.upgrade(tower.uid));
    return { battle, uid: tower.uid };
  }

  it('todas as torres têm duas especializações com nome, descrição e custo', () => {
    for (const id of TOWER_ORDER) {
      const [a, b] = TOWERS[id].specs;
      expect([a.id, b.id]).toEqual(['a', 'b']);
      for (const spec of [a, b]) {
        expect(spec.name.length).toBeGreaterThan(3);
        expect(spec.description.length).toBeGreaterThan(10);
        expect(spec.cost).toBeGreaterThanOrEqual(250);
        expect(spec.cost).toBeLessThanOrEqual(350);
        expect(spec.level.cost).toBe(spec.cost);
      }
    }
  });

  it('especializa uma única vez depois do nível 3', () => {
    const { battle, uid } = maxed('mago');
    const events: BattleEvent[] = [];
    battle.on((e) => events.push(e));
    const cost = TOWERS.mago.specs[0].cost;
    const gold = battle.gold;
    const spent = battle.towers[0].totalSpent;
    expect(battle.upgradeCost(uid)).toBeNull();
    expect(battle.specCost(uid, 'a')).toBe(cost);
    expect(battle.specialize(uid, 'a')).toBe(true);
    expect(battle.towers[0].spec).toBe('a');
    expect(battle.gold).toBe(gold - cost);
    expect(battle.towers[0].totalSpent).toBe(spent + cost);
    expect(battle.specialize(uid, 'b')).toBe(false);
    expect(battle.specCost(uid, 'b')).toBeNull();
    expect(ofType(events, 'towerSpecialized')).toHaveLength(1);
    expect(towerLevel(battle.towers[0]).magicPierce).toBe(0.5);
  });

  it('recusa especializar sem ouro', () => {
    const { battle, uid } = maxed('canhao');
    battle.gold = 10;
    expect(battle.specialize(uid, 'b')).toBe(false);
    expect(battle.towers[0].spec).toBeNull();
  });

  it('o + só existe depois da especialização, aumenta 12% o dano e encarece 45% a cada compra', () => {
    const { battle, uid } = maxed('balista');
    expect(battle.plusCost(uid)).toBeNull();
    expect(battle.upgradePlus(uid)).toBe(false);
    battle.specialize(uid, 'b');
    const specCost = TOWERS.balista.specs[1].cost;
    const base = towerLevel(battle.towers[0]).damage;
    const events: BattleEvent[] = [];
    battle.on((e) => events.push(e));
    for (let n = 0; n < 3; n++) {
      const cost = Math.round(specCost * 0.6 * Math.pow(1.45, n));
      expect(battle.plusCost(uid)).toBe(cost);
      const spent = battle.towers[0].totalSpent;
      expect(battle.upgradePlus(uid)).toBe(true);
      expect(battle.towers[0].totalSpent).toBe(spent + cost);
    }
    expect(battle.towers[0].plus).toBe(3);
    expect(towerLevel(battle.towers[0]).damage).toBeCloseTo(base * Math.pow(1.12, 3));
    expect(towerLevel(battle.towers[0]).range).toBe(TOWERS.balista.specs[1].level.range);
    expect(ofType(events, 'towerPlus')).toHaveLength(3);
    expect(battle.sellValue(uid)).toBe(Math.floor(battle.towers[0].totalSpent * 0.7));
  });
});
