import { describe, expect, it } from 'vitest';
import type { BattleStats } from './types';
import { ACHIEVEMENTS, PROGRESS_KEY, applyGame, createProgress, emptyProgress, loadProgress, sanitizeProgress, starsFor } from './progress';
import type { GameResult, ProgressStorage } from './progress';

const STAGES = ['vale', 'floresta', 'desfiladeiro', 'encruzilhada', 'cerco'];

function stats(p: Partial<BattleStats> = {}): BattleStats {
  return {
    kills: 10,
    leaked: 0,
    goldEarned: 100,
    goldSpent: 50,
    towersBuilt: 3,
    elapsed: 60,
    golemsKilled: 0,
    bossesKilled: 0,
    earlyCalls: 0,
    powersUsed: { flechas: 0, congelar: 0, furia: 0 },
    ...p,
  };
}

function result(p: Partial<GameResult> = {}): GameResult {
  return {
    stageId: 'vale',
    difficulty: 'normal',
    infinite: false,
    victory: true,
    wave: 15,
    lives: 20,
    startingLives: 20,
    stats: stats(),
    ...p,
  };
}

function memory(): ProgressStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

describe('estrelas', () => {
  it('3 sem perder vida, 2 com metade ou mais, 1 vencendo, 0 perdendo', () => {
    expect(starsFor(result())).toBe(3);
    expect(starsFor(result({ lives: 19 }))).toBe(2);
    expect(starsFor(result({ lives: 10 }))).toBe(2);
    expect(starsFor(result({ lives: 9 }))).toBe(1);
    expect(starsFor(result({ victory: false, lives: 0 }))).toBe(0);
    expect(starsFor(result({ infinite: true, victory: false }))).toBe(0);
  });

  it('guarda a melhor marca por fase e dificuldade', () => {
    const progress = createProgress({ stageIds: STAGES, storage: () => memory() });
    progress.recordGame(result({ lives: 12 }));
    progress.recordGame(result({ lives: 3 }));
    expect(progress.stars('vale', 'normal')).toBe(2);
    progress.recordGame(result({ difficulty: 'dificil', lives: 15, startingLives: 15 }));
    expect(progress.stars('vale', 'dificil')).toBe(3);
    expect(progress.stars('vale', 'facil')).toBe(0);
    expect(progress.bestStars('vale')).toBe(3);
  });
});

describe('desbloqueio', () => {
  it('a primeira está sempre aberta e as outras abrem ao vencer a anterior em qualquer dificuldade', () => {
    const progress = createProgress({ stageIds: STAGES, storage: () => memory() });
    expect(STAGES.map((id) => progress.isUnlocked(id))).toEqual([true, false, false, false, false]);
    progress.recordGame(result({ victory: false, lives: 0 }));
    expect(progress.isUnlocked('floresta')).toBe(false);
    progress.recordGame(result({ difficulty: 'facil', lives: 2, startingLives: 25 }));
    expect(progress.isUnlocked('floresta')).toBe(true);
    expect(progress.isUnlocked('desfiladeiro')).toBe(false);
    expect(progress.isUnlocked('nada')).toBe(false);
  });
});

describe('infinito', () => {
  it('guarda o recorde de onda por fase e não conta como vitória', () => {
    const progress = createProgress({ stageIds: STAGES, storage: () => memory() });
    progress.recordGame(result({ infinite: true, victory: false, wave: 22, lives: 0 }));
    progress.recordGame(result({ infinite: true, victory: false, wave: 18, lives: 0 }));
    progress.recordGame(result({ stageId: 'cerco', infinite: true, victory: false, wave: 9, lives: 0 }));
    expect(progress.bestInfiniteWave('vale')).toBe(22);
    expect(progress.bestInfiniteWave('cerco')).toBe(9);
    expect(progress.bestInfiniteWave('floresta')).toBe(0);
    expect(progress.data().totals.victories).toBe(0);
    expect(progress.isUnlocked('floresta')).toBe(false);
  });
});

describe('totais e conquistas', () => {
  it('soma os totais de todas as partidas', () => {
    const progress = createProgress({ stageIds: STAGES, storage: () => memory() });
    progress.recordGame(result({ stats: stats({ kills: 5, golemsKilled: 2, bossesKilled: 1, goldEarned: 300, towersBuilt: 4 }) }));
    progress.recordGame(result({ victory: false, lives: 0, stats: stats({ kills: 7, golemsKilled: 1, goldEarned: 50, towersBuilt: 6 }) }));
    expect(progress.data().totals).toEqual({ games: 2, victories: 1, kills: 12, golems: 3, bosses: 1, goldEarned: 350, towersBuilt: 10 });
  });

  it('tem as dez conquistas com título e descrição', () => {
    expect(ACHIEVEMENTS).toHaveLength(10);
    for (const a of ACHIEVEMENTS) {
      expect(a.title.length).toBeGreaterThan(3);
      expect(a.description.length).toBeGreaterThan(10);
      expect(a.description).not.toMatch(/[\u2013\u2014]/);
    }
  });

  it('primeira vitória e intocável saem uma vez só', () => {
    const progress = createProgress({ stageIds: STAGES, storage: () => memory() });
    expect(progress.recordGame(result()).map((a) => a.id)).toEqual(['primeira-vitoria', 'intocavel']);
    expect(progress.recordGame(result())).toEqual([]);
    expect(progress.achievements().filter((a) => a.unlocked).map((a) => a.id)).toEqual(['primeira-vitoria', 'intocavel']);
  });

  it('intocável exige não perder vida e coragem exige o Difícil', () => {
    const progress = createProgress({ stageIds: STAGES, storage: () => memory() });
    expect(progress.recordGame(result({ lives: 19 })).map((a) => a.id)).toEqual(['primeira-vitoria']);
    expect(progress.recordGame(result({ difficulty: 'dificil', lives: 3, startingLives: 15 })).map((a) => a.id)).toEqual(['coragem']);
  });

  it('caçador de golens soma entre partidas e engenheiro conta as torres', () => {
    const progress = createProgress({ stageIds: STAGES, storage: () => memory() });
    expect(progress.recordGame(result({ victory: false, lives: 0, stats: stats({ golemsKilled: 30, towersBuilt: 60 }) }))).toEqual([]);
    const ids = progress.recordGame(result({ victory: false, lives: 0, stats: stats({ golemsKilled: 20, towersBuilt: 40 }) })).map((a) => a.id);
    expect(ids).toEqual(['cacador-golens', 'engenheiro']);
  });

  it('regicida, sobrevivente, pressa e arsenal', () => {
    const progress = createProgress({ stageIds: STAGES, storage: () => memory() });
    const lost = { victory: false, lives: 0 };
    expect(progress.recordGame(result({ ...lost, stats: stats({ bossesKilled: 1 }) })).map((a) => a.id)).toEqual(['regicida']);
    expect(progress.recordGame(result({ ...lost, infinite: true, wave: 29 }))).toEqual([]);
    expect(progress.recordGame(result({ ...lost, infinite: true, wave: 30 })).map((a) => a.id)).toEqual(['sobrevivente']);
    expect(progress.recordGame(result({ ...lost, stats: stats({ earlyCalls: 9 }) }))).toEqual([]);
    expect(progress.recordGame(result({ ...lost, stats: stats({ earlyCalls: 10 }) })).map((a) => a.id)).toEqual(['pressa']);
    expect(progress.recordGame(result({ ...lost, stats: stats({ powersUsed: { flechas: 2, congelar: 1, furia: 0 } }) }))).toEqual([]);
    expect(progress.recordGame(result({ ...lost, stats: stats({ powersUsed: { flechas: 1, congelar: 1, furia: 1 } }) })).map((a) => a.id)).toEqual(['arsenal']);
  });

  it('mestre do vale pede 3 estrelas em todas as fases no Normal ou Difícil', () => {
    let data = emptyProgress();
    for (const stageId of STAGES.slice(0, 4)) data = applyGame(data, STAGES, result({ stageId })).progress;
    data = applyGame(data, STAGES, result({ stageId: 'cerco', difficulty: 'facil', startingLives: 25, lives: 25 })).progress;
    expect(data.achievements).not.toContain('mestre-vale');
    const last = applyGame(data, STAGES, result({ stageId: 'cerco', difficulty: 'dificil', startingLives: 15, lives: 15 }));
    expect(last.unlocked.map((a) => a.id)).toContain('mestre-vale');
  });
});

describe('armazenamento', () => {
  it('grava na chave do progresso e recarrega numa nova sessão', () => {
    const storage = memory();
    const first = createProgress({ stageIds: STAGES, storage: () => storage });
    first.recordGame(result({ lives: 12 }));
    expect(storage.data.has(PROGRESS_KEY)).toBe(true);
    const second = createProgress({ stageIds: STAGES, storage: () => storage });
    expect(second.stars('vale', 'normal')).toBe(2);
    expect(second.isUnlocked('floresta')).toBe(true);
    second.reset();
    expect(createProgress({ stageIds: STAGES, storage: () => storage }).stars('vale', 'normal')).toBe(0);
  });

  it('armazenamento quebrado ou dados estragados não derrubam o jogo', () => {
    const broken: ProgressStorage = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('cheio');
      },
    };
    const progress = createProgress({ stageIds: STAGES, storage: () => broken });
    expect(() => progress.recordGame(result())).not.toThrow();
    expect(progress.stars('vale', 'normal')).toBe(3);
    const garbage = memory();
    garbage.data.set(PROGRESS_KEY, '{ quebrado');
    expect(loadProgress(() => garbage)).toEqual(emptyProgress());
    expect(createProgress({ stageIds: STAGES, storage: () => null }).isUnlocked('vale')).toBe(true);
    const weird = sanitizeProgress({ stars: { vale: { normal: 9, facil: -2, dificil: 'x' } }, totals: { games: -5 }, achievements: ['inventada', 'regicida', 'regicida'] });
    expect(weird.stars.vale).toEqual({ normal: 3 });
    expect(weird.totals.games).toBe(0);
    expect(weird.achievements).toEqual(['regicida']);
  });
});
