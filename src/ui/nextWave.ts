import type { EnemyId } from '../core/types';
import type { UiState } from '../core/view';
import { THREAT_ORDER, enemyLabel, waveComposition, waveTip } from '../data/guide';
import { drawEnemyIcon } from '../render';
import { changed, h, setAttr, setClass, setText } from './dom';

export interface NextWavePanel {
  readonly el: HTMLButtonElement;
  render(state: UiState, paletteVersion: number): void;
}

export function nextWaveIndex(state: Pick<UiState, 'screen' | 'upcoming' | 'upcomingNumber'>): number | null {
  if (state.screen !== 'jogo' || state.upcoming === null) return null;
  return state.upcomingNumber - 1;
}

export function createNextWave(onOpen: (focus?: EnemyId) => void): NextWavePanel {
  const el = h('button', 'ft-next');
  el.type = 'button';
  const head = h('span', 'ft-next-head');
  const title = h('span', 'ft-next-title');
  const more = h('span', 'ft-next-more', 'Ver guia');
  head.append(title, more);
  const list = h('span', 'ft-next-list');
  const tip = h('span', 'ft-next-tip');
  el.append(head, list, tip);
  let mainEnemy: EnemyId | undefined;
  el.addEventListener('click', () => onOpen(mainEnemy));

  function render(state: UiState, paletteVersion: number): void {
    const index = nextWaveIndex(state);
    setClass(el, 'is-hidden', index === null || state.phase === 'vitoria' || state.phase === 'derrota');
    if (index === null) return;
    const during = state.phase === 'onda';
    setText(title, during ? `Depois desta: onda ${index + 1}` : `Próxima: onda ${index + 1}`);
    const wave = state.upcoming;
    if (!wave) return;
    const boss = wave.groups.some((g) => g.enemy === 'rei');
    setClass(el, 'is-boss', boss);
    if (!changed(list, 'wave', `${state.stageName}|${state.infinite}|${index}|${paletteVersion}`)) return;
    const entries = waveComposition(wave);
    mainEnemy = entries.length ? THREAT_ORDER.find((id) => entries.some((e) => e.enemy === id)) : undefined;
    list.replaceChildren(
      ...entries.map(({ enemy, count }) => {
        const chip = h('span', 'ft-next-chip');
        const icon = h('canvas', 'ft-next-icon');
        drawEnemyIcon(icon, enemy, 22);
        chip.append(icon, h('span', 'ft-next-count', String(count)), h('span', 'ft-next-name', enemyLabel(enemy, count)));
        return chip;
      }),
    );
    setText(tip, boss ? 'Chefe nesta onda! Balistas e o poder Congelar ajudam muito.' : waveTip(wave));
    setAttr(el, 'aria-label', `${title.textContent}. ${entries.map((e) => `${e.count} ${enemyLabel(e.enemy, e.count)}`).join(', ')}. Toque para abrir o guia.`);
  }

  return { el, render };
}
