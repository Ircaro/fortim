import { describe, expect, it } from 'vitest';
import type { EnemyId } from '../core/types';
import { ENEMIES, ENEMY_ORDER } from './enemies';
import { ENEMY_GUIDE, TOWER_GUIDE, effectiveness, enemyLabel, enemyTraits, upgradeChanges, waveComposition, waveTip } from './guide';
import { TOWERS, TOWER_ORDER } from './towers';
import { STAGES } from './stages';
import { WAVES } from './waves';

describe('guia de inimigos', () => {
  it('todo inimigo e toda torre têm guia', () => {
    for (const id of ENEMY_ORDER) expect(ENEMY_GUIDE[id].tip.length).toBeGreaterThan(10);
    for (const id of TOWER_ORDER) expect(TOWER_GUIDE[id].strong.length).toBeGreaterThan(5);
  });

  it('as torres recomendadas acertam o inimigo com pelo menos 90% do dano', () => {
    for (const id of ENEMY_ORDER) {
      for (const tower of ENEMY_GUIDE[id].best) expect(effectiveness(TOWERS[tower], ENEMIES[id])).toBeGreaterThanOrEqual(0.9);
    }
  });

  it('as torres a evitar perdem dano, não acertam ou não deixam lento', () => {
    for (const id of ENEMY_ORDER) {
      for (const tower of ENEMY_GUIDE[id].weak) {
        const losesDamage = effectiveness(TOWERS[tower], ENEMIES[id]) <= 0.5;
        const uselessSlow = tower === 'gelo' && ENEMIES[id].slowImmune;
        expect(losesDamage || uselessSlow).toBe(true);
      }
    }
  });

  it('a balista é a melhor resposta ao golem e o canhão não acerta morcego', () => {
    const golem = ENEMIES.golem;
    const best = Math.max(...TOWER_ORDER.map((t) => effectiveness(TOWERS[t], golem)));
    expect(effectiveness(TOWERS.balista, golem)).toBe(best);
    expect(effectiveness(TOWERS.canhao, ENEMIES.morcego)).toBe(0);
  });

  it('descreve as características que mudam a estratégia', () => {
    expect(enemyTraits(ENEMIES.morcego)).toContain('Voa');
    expect(enemyTraits(ENEMIES.golem)).toEqual(expect.arrayContaining(['Armadura 70%', 'Não fica lento', 'Muita vida']));
    expect(enemyTraits(ENEMIES.goblin)).toEqual([]);
  });

  it('descreve o chefe e a resistência à lentidão', () => {
    expect(enemyTraits(ENEMIES.rei)).toEqual(expect.arrayContaining(['Chefe', 'Lentidão 50% do efeito', 'Tira 10 vidas']));
    expect(enemyLabel('lodinho', 2)).toBe('Lodinhos');
    expect(ENEMY_GUIDE.lodinho.tip.length).toBeGreaterThan(10);
  });

  it('usa plural quando vem mais de um', () => {
    expect(enemyLabel('golem', 1)).toBe('Golem de Pedra');
    expect(enemyLabel('golem', 3)).toBe('Golens de Pedra');
  });
});

describe('prévia da onda', () => {
  it('soma os grupos do mesmo inimigo e ordena do mais numeroso', () => {
    const entries = waveComposition({ bonus: 0, groups: [
      { enemy: 'goblin', count: 3, interval: 1, delay: 0, hpMultiplier: 1 },
      { enemy: 'orc', count: 5, interval: 1, delay: 0, hpMultiplier: 1 },
      { enemy: 'goblin', count: 4, interval: 1, delay: 0, hpMultiplier: 1 },
    ] });
    expect(entries).toEqual([{ enemy: 'goblin', count: 7 }, { enemy: 'orc', count: 5 }]);
  });

  it('a dica fala do inimigo mais perigoso da onda', () => {
    const withGolem = WAVES.findIndex((w) => w.groups.some((g) => g.enemy === 'golem'));
    expect(waveTip(WAVES[withGolem])).toBe(ENEMY_GUIDE.golem.tip);
    expect(waveTip(WAVES[0])).toBe(ENEMY_GUIDE.goblin.tip);
  });

  it('toda onda de todas as fases tem prévia e dica', () => {
    for (const wave of STAGES.flatMap((s) => s.waves)) {
      expect(waveComposition(wave).length).toBeGreaterThan(0);
      expect(waveTip(wave).length).toBeGreaterThan(0);
      for (const { enemy } of waveComposition(wave)) expect(ENEMY_ORDER).toContain<EnemyId>(enemy);
    }
  });
});

describe('o que muda ao melhorar', () => {
  it('mostra dano, cadência e dano por segundo do arqueiro', () => {
    const changes = upgradeChanges(TOWERS.arqueiro, 0);
    const byLabel = Object.fromEntries(changes.map((c) => [c.label, `${c.from} > ${c.to}`]));
    expect(byLabel['Dano']).toBe('10 > 17');
    expect(byLabel['Cadência']).toBe('1,4/s > 1,6/s');
    expect(byLabel['Dano por segundo']).toBe('14 > 27,2');
    expect(byLabel['Alcance']).toBeDefined();
  });

  it('mostra a lentidão do gelo e a perfuração da balista', () => {
    expect(upgradeChanges(TOWERS.gelo, 0).map((c) => c.label)).toContain('Lentidão');
    expect(upgradeChanges(TOWERS.gelo, 1).map((c) => c.label)).toContain('Área');
    expect(upgradeChanges(TOWERS.balista, 0).map((c) => c.label)).toContain('Perfura armadura');
  });

  it('não mostra nada no nível máximo', () => {
    for (const id of TOWER_ORDER) expect(upgradeChanges(TOWERS[id], TOWERS[id].levels.length - 1)).toEqual([]);
  });
});
