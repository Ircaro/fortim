import { describe, expect, it } from 'vitest';
import type { GridPoint } from '../core/types';
import type { ScreenPoint } from '../core/view';
import { TILE } from '../config';
import { ENEMIES } from '../data/enemies';
import { TOWER_ORDER } from '../data/towers';
import { WAVES } from '../data/waves';
import { createDefaultBattle } from '../sim';
import {
  buildResult,
  buildUiState,
  clampSpeed,
  commonTargetMode,
  pruneSelection,
  selectedUids,
  toggleSelection,
  createControlState,
  decideTap,
  keyToAction,
  logicalToClient,
  nextSpeed,
  waveSummary,
} from './state';
import type { TapInput, UiContext } from './state';
import { bossView, powerViews, specOptions, tutorialView, upcomingWave, TUTORIAL_STEPS } from './state';
import { createStageBattle } from '../sim';

const CTX: UiContext = {
  menu: { mode: 'campanha', difficulty: 'normal', stageId: 'vale', stages: [], continueLabel: null, achievements: [] },
  stageName: 'Vale do Fortim',
  tutorial: null,
};

const EXTRAS = { stageName: 'Vale do Fortim', stars: 0, bestInfinite: 0, isRecord: false, newAchievements: [], nextStageName: null };

function tap(partial: Partial<TapInput>): TapInput {
  return {
    cell: { col: 0, row: 1 },
    picking: null,
    pending: null,
    touch: false,
    shift: false,
    multi: false,
    towerUid: null,
    canPlace: true,
    ...partial,
  };
}

describe('decideTap no toque', () => {
  it('primeiro toque mostra o fantasma na célula', () => {
    expect(decideTap(tap({ touch: true, picking: 'arqueiro' }))).toEqual({ kind: 'ghost', col: 0, row: 1 });
  });

  it('segundo toque na mesma célula constrói e sai do modo de construção', () => {
    const action = decideTap(tap({ touch: true, picking: 'arqueiro', pending: { col: 0, row: 1 } }));
    expect(action).toEqual({ kind: 'build', col: 0, row: 1, keepPicking: false });
  });

  it('toque em outra célula move o fantasma', () => {
    const action = decideTap(tap({ touch: true, picking: 'canhao', pending: { col: 0, row: 1 }, cell: { col: 3, row: 4 } }));
    expect(action).toEqual({ kind: 'ghost', col: 3, row: 4 });
  });

  it('confirmar numa célula inválida dá erro', () => {
    const action = decideTap(tap({ touch: true, picking: 'arqueiro', pending: { col: 0, row: 1 }, canPlace: false }));
    expect(action).toEqual({ kind: 'error' });
  });

  it('shift não mantém o modo no toque', () => {
    const action = decideTap(tap({ touch: true, shift: true, picking: 'arqueiro', pending: { col: 0, row: 1 } }));
    expect(action).toMatchObject({ kind: 'build', keepPicking: false });
  });

  it('tocar numa torre sem escolher torre seleciona', () => {
    expect(decideTap(tap({ touch: true, towerUid: 7 }))).toEqual({ kind: 'select', uid: 7 });
  });

  it('tocar no vazio sem escolher torre desseleciona', () => {
    expect(decideTap(tap({ touch: true }))).toEqual({ kind: 'deselect' });
  });

  it('tocar numa torre construída com torre escolhida seleciona a torre', () => {
    expect(decideTap(tap({ touch: true, picking: 'arqueiro', towerUid: 4, canPlace: false }))).toEqual({ kind: 'select', uid: 4 });
    expect(decideTap(tap({ touch: true, picking: 'arqueiro', pending: { col: 0, row: 1 }, towerUid: 4, canPlace: false }))).toEqual({ kind: 'select', uid: 4 });
  });

  it('tocar fora do mapa com torre escolhida não faz nada', () => {
    expect(decideTap(tap({ touch: true, picking: 'gelo', cell: null }))).toEqual({ kind: 'none' });
  });
});

describe('decideTap no mouse', () => {
  it('clique válido constrói direto', () => {
    expect(decideTap(tap({ picking: 'mago' }))).toEqual({ kind: 'build', col: 0, row: 1, keepPicking: false });
  });

  it('shift mantém o modo de construção', () => {
    expect(decideTap(tap({ picking: 'mago', shift: true }))).toMatchObject({ kind: 'build', keepPicking: true });
  });

  it('clique inválido dá erro', () => {
    expect(decideTap(tap({ picking: 'mago', canPlace: false }))).toEqual({ kind: 'error' });
  });

  it('clique numa torre construída com torre escolhida seleciona a torre', () => {
    expect(decideTap(tap({ picking: 'mago', towerUid: 9, canPlace: false }))).toEqual({ kind: 'select', uid: 9 });
  });

  it('clique numa torre seleciona e no vazio desseleciona', () => {
    expect(decideTap(tap({ towerUid: 3 }))).toEqual({ kind: 'select', uid: 3 });
    expect(decideTap(tap({ cell: null }))).toEqual({ kind: 'deselect' });
  });
});

describe('buildUiState', () => {
  it('reflete ouro, vidas e torres que cabem no bolso', () => {
    const battle = createDefaultBattle();
    const control = createControlState();
    const state = buildUiState(battle, TOWER_ORDER, control, CTX);
    expect(state.screen).toBe('menu');
    expect(state.gold).toBe(battle.gold);
    expect(state.lives).toBe(battle.lives);
    expect(state.totalWaves).toBe(WAVES.length);
    expect(state.affordable.arqueiro).toBe(true);
    expect(state.selected).toBeNull();
    expect(state.upgradeCost).toBeNull();
    expect(state.sellValue).toBe(0);
    expect(Object.keys(state.affordable).sort()).toEqual([...TOWER_ORDER].sort());
  });

  it('marca torres caras como fora do alcance depois de gastar', () => {
    const battle = createDefaultBattle();
    expect(battle.build('canhao', 0, 1)).not.toBeNull();
    expect(battle.build('arqueiro', 1, 1)).not.toBeNull();
    const state = buildUiState(battle, TOWER_ORDER, createControlState(), CTX);
    expect(state.gold).toBe(30);
    for (const id of TOWER_ORDER) expect(state.affordable[id]).toBe(false);
  });

  it('lê a torre selecionada pelo uid e acompanha melhoria e venda', () => {
    const battle = createDefaultBattle();
    const tower = battle.build('arqueiro', 0, 1);
    expect(tower).not.toBeNull();
    const control = { ...createControlState(), screen: 'jogo' as const, selectedUid: tower!.uid };
    let state = buildUiState(battle, TOWER_ORDER, control, CTX);
    expect(state.selected?.uid).toBe(tower!.uid);
    expect(state.upgradeCost).toBe(battle.upgradeCost(tower!.uid));
    expect(state.sellValue).toBe(battle.sellValue(tower!.uid));
    expect(battle.upgrade(tower!.uid)).toBe(true);
    state = buildUiState(battle, TOWER_ORDER, control, CTX);
    expect(state.selected?.level).toBe(1);
    battle.sell(tower!.uid);
    state = buildUiState(battle, TOWER_ORDER, control, CTX);
    expect(state.selected).toBeNull();
    expect(state.sellValue).toBe(0);
  });

  it('repassa velocidade, pausa, som e toque do controle', () => {
    const battle = createDefaultBattle();
    const control = { ...createControlState(true, true), speed: 3, paused: true, picking: 'gelo' as const };
    const state = buildUiState(battle, TOWER_ORDER, control, CTX);
    expect(state).toMatchObject({ speed: 3, paused: true, muted: true, touch: true, picking: 'gelo' });
  });

  it('monta o resultado com uma cópia das estatísticas', () => {
    const battle = createDefaultBattle();
    const result = buildResult(battle, true, EXTRAS);
    expect(result).toMatchObject({ victory: true, wave: 0, totalWaves: WAVES.length, lives: battle.lives, infinite: false, stageName: 'Vale do Fortim' });
    expect(result.stats).not.toBe(battle.stats);
    expect(result.stats).toEqual(battle.stats);
  });

  it('oferece as duas especializações só no último nível e o "+" depois delas', () => {
    const battle = createStageBattle('vale');
    battle.gold = 5000;
    const tower = battle.build('arqueiro', 0, 1)!;
    expect(specOptions(battle, tower.uid)).toBeNull();
    battle.upgrade(tower.uid);
    battle.upgrade(tower.uid);
    const options = specOptions(battle, tower.uid);
    expect(options?.map((o) => o.choice)).toEqual(['a', 'b']);
    expect(options?.every((o) => typeof o.cost === 'number' && o.name.length > 0)).toBe(true);
    expect(battle.specialize(tower.uid, 'a')).toBe(true);
    expect(specOptions(battle, tower.uid)).toBeNull();
    const control = { ...createControlState(), screen: 'jogo' as const, selectedUid: tower.uid };
    expect(buildUiState(battle, TOWER_ORDER, control, CTX).plusCost).toBe(battle.plusCost(tower.uid));
  });

  it('mostra os poderes prontos e a próxima onda, inclusive no infinito', () => {
    const battle = createStageBattle('vale', { infinite: true });
    expect(powerViews(battle).map((p) => [p.id, p.ready])).toEqual([['flechas', true], ['congelar', true], ['furia', true]]);
    expect(upcomingWave(battle).number).toBe(1);
    expect(upcomingWave(battle).wave).not.toBeNull();
    const campaign = createStageBattle('vale');
    expect(bossView(campaign)).toBeNull();
    expect(upcomingWave(campaign).wave).toBe(campaign.waveDef(1));
  });

  it('o tutorial tem passos com texto de toque e de mouse', () => {
    expect(tutorialView(0, true)?.text).toBe(TUTORIAL_STEPS[0].touch);
    expect(tutorialView(0, false)?.step).toBe(1);
    expect(tutorialView(TUTORIAL_STEPS.length - 1, false)?.canAdvance).toBe(true);
    expect(tutorialView(TUTORIAL_STEPS.length, false)).toBeNull();
    expect(tutorialView(null, false)).toBeNull();
  });
});

describe('atalhos novos', () => {
  it('Q, W e E usam os poderes e C chama a onda antes', () => {
    expect(keyToAction('q', TOWER_ORDER)).toEqual({ kind: 'power', power: 'flechas' });
    expect(keyToAction('W', TOWER_ORDER)).toEqual({ kind: 'power', power: 'congelar' });
    expect(keyToAction('e', TOWER_ORDER)).toEqual({ kind: 'power', power: 'furia' });
    expect(keyToAction('c', TOWER_ORDER)).toEqual({ kind: 'callEarly' });
    expect(keyToAction('6', TOWER_ORDER)).toEqual({ kind: 'pick', tower: 'raio' });
  });
});

describe('velocidade', () => {
  it('alterna entre 1x, 2x e 3x', () => {
    expect(nextSpeed(1)).toBe(2);
    expect(nextSpeed(2)).toBe(3);
    expect(nextSpeed(3)).toBe(1);
  });

  it('aceita só velocidades conhecidas', () => {
    expect(clampSpeed(2)).toBe(2);
    expect(clampSpeed(5)).toBe(1);
  });
});

describe('keyToAction', () => {
  it('números escolhem a torre na ordem da loja', () => {
    TOWER_ORDER.forEach((id, i) => expect(keyToAction(String(i + 1), TOWER_ORDER)).toEqual({ kind: 'pick', tower: id }));
    expect(keyToAction('9', TOWER_ORDER)).toEqual({ kind: 'none' });
  });

  it('atalhos de controle', () => {
    expect(keyToAction(' ', TOWER_ORDER).kind).toBe('startWave');
    expect(keyToAction('P', TOWER_ORDER).kind).toBe('pause');
    expect(keyToAction('f', TOWER_ORDER).kind).toBe('speed');
    expect(keyToAction('m', TOWER_ORDER).kind).toBe('mute');
    expect(keyToAction('u', TOWER_ORDER).kind).toBe('upgrade');
    expect(keyToAction('Delete', TOWER_ORDER).kind).toBe('sell');
    expect(keyToAction('Backspace', TOWER_ORDER).kind).toBe('sell');
    expect(keyToAction('Escape', TOWER_ORDER).kind).toBe('cancel');
    expect(keyToAction('x', TOWER_ORDER).kind).toBe('none');
  });
});

describe('waveSummary', () => {
  it('lista os inimigos da onda', () => {
    expect(waveSummary(WAVES[0], ENEMIES)).toBe('Goblin');
    expect(waveSummary(WAVES[1], ENEMIES)).toBe('Goblin e Lobo');
  });

  it('ordena pelos mais numerosos e corta em três', () => {
    expect(waveSummary(WAVES[7], ENEMIES)).toBe('Goblin, Xamã Goblin e Golem de Pedra');
    expect(waveSummary(WAVES[14], ENEMIES).split(/, | e /)).toHaveLength(3);
  });

  it('onda inexistente devolve texto vazio', () => {
    expect(waveSummary(undefined, ENEMIES)).toBe('');
  });
});

describe('logicalToClient', () => {
  function mapper(origin: ScreenPoint, size: number, centered: boolean) {
    return {
      cellToClient(col: number, row: number): ScreenPoint {
        const k = centered ? 0.5 : 0;
        return { x: origin.x + (col + k) * size, y: origin.y + (row + k) * size };
      },
      cellAt(x: number, y: number): GridPoint | null {
        const col = Math.floor((x - origin.x) / size);
        const row = Math.floor((y - origin.y) / size);
        return col >= 0 && row >= 0 && col < 16 && row < 10 ? { col, row } : null;
      },
    };
  }

  it('converte posição lógica quando a célula devolve o centro', () => {
    const p = logicalToClient(mapper({ x: 10, y: 20 }, 30, true), TILE * 2.5, TILE * 1.5);
    expect(p.x).toBeCloseTo(10 + 2.5 * 30);
    expect(p.y).toBeCloseTo(20 + 1.5 * 30);
  });

  it('converte posição lógica quando a célula devolve o canto', () => {
    const p = logicalToClient(mapper({ x: 10, y: 20 }, 30, false), TILE * 2.5, TILE * 1.5);
    expect(p.x).toBeCloseTo(10 + 2.5 * 30);
    expect(p.y).toBeCloseTo(20 + 1.5 * 30);
  });

  it('usa o retângulo do canvas quando o desenho ainda não tem escala', () => {
    const flat = { cellToClient: () => ({ x: 0, y: 0 }), cellAt: () => null };
    const p = logicalToClient(flat, 384, 240, { left: 100, top: 50, width: 768, height: 480 }, 768, 480);
    expect(p).toEqual({ x: 484, y: 290 });
  });

  it('respeita as faixas laterais quando o canvas é mais largo que o mapa', () => {
    const flat = { cellToClient: () => ({ x: 0, y: 0 }), cellAt: () => null };
    const p = logicalToClient(flat, 0, 0, { left: 0, top: 0, width: 1200, height: 480 }, 768, 480);
    expect(p).toEqual({ x: 216, y: 0 });
  });
});

describe('seleção de várias torres', () => {
  it('shift + clique numa torre alterna a seleção no mouse', () => {
    expect(decideTap(tap({ towerUid: 4, shift: true }))).toEqual({ kind: 'toggle', uid: 4 });
  });

  it('no toque o shift não alterna, só o modo Selecionar várias', () => {
    expect(decideTap(tap({ towerUid: 4, shift: true, touch: true }))).toEqual({ kind: 'select', uid: 4 });
    expect(decideTap(tap({ towerUid: 4, multi: true, touch: true }))).toEqual({ kind: 'toggle', uid: 4 });
  });

  it('com torre escolhida para construir, tocar numa torre continua selecionando uma só', () => {
    expect(decideTap(tap({ picking: 'mago', towerUid: 9, multi: true, canPlace: false }))).toEqual({ kind: 'select', uid: 9 });
  });

  it('tocar no vazio no modo Selecionar várias limpa a seleção', () => {
    expect(decideTap(tap({ multi: true, towerUid: null }))).toEqual({ kind: 'deselect' });
  });

  it('alternar junta torres num grupo e desfaz quando sobra uma', () => {
    let sel = toggleSelection({ selectedUid: null, group: [] }, 1);
    expect(sel).toEqual({ selectedUid: 1, group: [] });
    sel = toggleSelection(sel, 2);
    expect(sel).toEqual({ selectedUid: null, group: [1, 2] });
    sel = toggleSelection(sel, 3);
    expect(selectedUids(sel)).toEqual([1, 2, 3]);
    sel = toggleSelection(sel, 2);
    expect(sel).toEqual({ selectedUid: null, group: [1, 3] });
    sel = toggleSelection(sel, 1);
    expect(sel).toEqual({ selectedUid: 3, group: [] });
    sel = toggleSelection(sel, 3);
    expect(sel).toEqual({ selectedUid: null, group: [] });
  });

  it('tira do grupo as torres vendidas', () => {
    const sel = { selectedUid: null, group: [1, 2, 3] };
    expect(pruneSelection(sel, (uid) => uid !== 2)).toEqual({ selectedUid: null, group: [1, 3] });
    expect(pruneSelection(sel, (uid) => uid === 3)).toEqual({ selectedUid: 3, group: [] });
    expect(pruneSelection(sel, () => true)).toBe(sel);
  });

  it('o grupo aparece no estado da interface com o alvo de cada torre', () => {
    const battle = createDefaultBattle();
    const a = battle.build('arqueiro', 0, 1);
    const b = battle.build('arqueiro', 1, 1);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    battle.setTargetMode(b!.uid, 'forte');
    const control = { ...createControlState(), screen: 'jogo' as const, group: [a!.uid, b!.uid], multiMode: true };
    const state = buildUiState(battle, TOWER_ORDER, control, CTX);
    expect(state.selected).toBeNull();
    expect(state.multiMode).toBe(true);
    expect(state.group.map((t) => t.targetMode)).toEqual(['primeiro', 'forte']);
    expect(commonTargetMode(state.group)).toBeNull();
    battle.setTargetMode(a!.uid, 'forte');
    expect(commonTargetMode(buildUiState(battle, TOWER_ORDER, control, CTX).group)).toBe('forte');
  });

  it('sem torres não existe alvo em comum', () => {
    expect(commonTargetMode([])).toBeNull();
  });
});
