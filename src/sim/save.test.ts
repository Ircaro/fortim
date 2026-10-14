import { describe, expect, it } from 'vitest';
import { createStageBattle } from './index';
import type { Battle } from './battle';
import { SAVE_KEY, clearSave, parseSave, readSave, restoreBattle, serializeBattle, validateSave, writeSave } from './save';
import type { SaveData, SaveStorage } from './save';

function playedBattle(): Battle {
  const battle = createStageBattle('desfiladeiro', { difficulty: 'dificil' });
  battle.gold = 5000;
  const archer = battle.build('arqueiro', 0, 2)!;
  const mage = battle.build('mago', 2, 4)!;
  battle.build('canhao', 10, 4);
  while (battle.upgrade(archer.uid));
  battle.specialize(archer.uid, 'b');
  battle.upgradePlus(archer.uid);
  battle.upgrade(mage.uid);
  battle.setTargetMode(mage.uid, 'forte');
  battle.castPower('furia');
  battle.startNextWave();
  for (let i = 0; i < 2000 && battle.phase === 'onda'; i++) battle.update(1 / 30);
  return battle;
}

function memoryStorage(): SaveStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

describe('salvar e continuar', () => {
  it('só salva entre ondas', () => {
    const battle = createStageBattle('vale');
    battle.startNextWave();
    expect(serializeBattle(battle, { stageId: 'vale' })).toBeNull();
    expect(serializeBattle(createStageBattle('vale'), { stageId: 'nada' })).toBeNull();
  });

  it('ida e volta mantém tudo igual', () => {
    const battle = playedBattle();
    expect(battle.phase).toBe('preparando');
    const save = serializeBattle(battle, { stageId: 'desfiladeiro' })!;
    expect(save.waveNumber).toBe(1);
    expect(save.difficulty).toBe('dificil');
    expect(save.towers.find((t) => t.id === 'arqueiro')).toMatchObject({ level: 2, spec: 'b', plus: 1 });
    const restored = restoreBattle(JSON.parse(JSON.stringify(save)))!;
    expect(restored).not.toBeNull();
    expect(serializeBattle(restored, { stageId: 'desfiladeiro' })).toEqual(save);
    expect(restored.gold).toBe(battle.gold);
    expect(restored.lives).toBe(battle.lives);
    expect(restored.phase).toBe('preparando');
    expect(restored.powers.find((p) => p.id === 'furia')!.cooldown).toBeCloseTo(battle.powers.find((p) => p.id === 'furia')!.cooldown);
    expect(restored.towers.find((t) => t.def.id === 'mago')!.targetMode).toBe('forte');
    expect(restored.startNextWave()).toBe(true);
    expect(restored.waveNumber).toBe(2);
  });

  it('não divide as estatísticas com a partida salva', () => {
    const save = serializeBattle(playedBattle(), { stageId: 'desfiladeiro' })!;
    const restored = restoreBattle(save)!;
    restored.stats.powersUsed.flechas = 99;
    expect(save.stats.powersUsed.flechas).toBe(0);
  });

  it('o modo infinito pode salvar depois das ondas da fase', () => {
    const battle = createStageBattle('vale', { infinite: true });
    const save = { ...serializeBattle(battle, { stageId: 'vale' })!, waveNumber: 20 };
    const restored = restoreBattle(save)!;
    expect(restored.infinite).toBe(true);
    expect(restored.startNextWave()).toBe(true);
    expect(restored.waveNumber).toBe(21);
  });

  it('dados inválidos viram null', () => {
    const good = serializeBattle(playedBattle(), { stageId: 'desfiladeiro' })!;
    const tower = good.towers[0];
    const bad: unknown[] = [
      null,
      undefined,
      42,
      'texto',
      [],
      {},
      { ...good, version: 2 },
      { ...good, stageId: 'nada' },
      { ...good, difficulty: 'impossivel' },
      { ...good, gold: Number.NaN },
      { ...good, gold: -1 },
      { ...good, lives: 0 },
      { ...good, waveNumber: 15 },
      { ...good, waveNumber: 1.5 },
      { ...good, stats: { ...good.stats, kills: 'muitas' } },
      { ...good, stats: { ...good.stats, powersUsed: {} } },
      { ...good, powers: [{ id: 'trovao', cooldown: 1 }] },
      { ...good, powers: [{ id: 'furia', cooldown: 1 }, { id: 'furia', cooldown: 2 }] },
      { ...good, towers: 'nenhuma' },
      { ...good, towers: [{ ...tower, id: 'catapulta' }] },
      { ...good, towers: [{ ...tower, col: 1, row: 3 }] },
      { ...good, towers: [{ ...tower, col: 99 }] },
      { ...good, towers: [tower, { ...tower }] },
      { ...good, towers: [{ ...tower, level: 7 }] },
      { ...good, towers: [{ ...tower, level: 1, spec: 'a', plus: 0 }] },
      { ...good, towers: [{ ...tower, level: 2, spec: null, plus: 2 }] },
      { ...good, towers: [{ ...tower, spec: 'c' }] },
      { ...good, towers: [{ ...tower, targetMode: 'aleatorio' }] },
    ];
    for (const value of bad) {
      expect(validateSave(value)).toBeNull();
      expect(restoreBattle(value)).toBeNull();
    }
    expect(parseSave('{ quebrado')).toBeNull();
    expect(parseSave('')).toBeNull();
    expect(validateSave(good)).toEqual(good);
  });

  it('grava, lê e apaga no armazenamento', () => {
    const storage = memoryStorage();
    const save = serializeBattle(playedBattle(), { stageId: 'desfiladeiro' }) as SaveData;
    expect(writeSave(save, () => storage)).toBe(true);
    expect(storage.data.has(SAVE_KEY)).toBe(true);
    expect(readSave(() => storage)).toEqual(save);
    clearSave(() => storage);
    expect(readSave(() => storage)).toBeNull();
  });

  it('armazenamento quebrado não derruba nada', () => {
    const broken: SaveStorage = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('cheio');
      },
      removeItem: () => {
        throw new Error('bloqueado');
      },
    };
    const save = serializeBattle(createStageBattle('vale'), { stageId: 'vale' })!;
    expect(readSave(() => broken)).toBeNull();
    expect(writeSave(save, () => broken)).toBe(false);
    expect(() => clearSave(() => broken)).not.toThrow();
    expect(readSave(() => null)).toBeNull();
    expect(writeSave(save, () => null)).toBe(false);
  });
});
