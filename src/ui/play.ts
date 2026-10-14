import type { PowerId } from '../core/types';
import type { UiCallbacks, UiState } from '../core/view';
import { POWER_ORDER } from '../data/powers';
import { button, h, setAttr, setClass, setDisabled, setText } from './dom';

const POWER_ICONS: Record<PowerId, string> = {
  flechas:
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 3v13M12 2v14M18 3v13"/></g><g fill="currentColor"><path d="M3.6 14.5L6 19.5l2.4-5zM9.6 13.5L12 18.5l2.4-5zM15.6 14.5L18 19.5l2.4-5z"/></g></svg>',
  congelar:
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6"/><path d="M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5"/></g></svg>',
  furia: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M13.5 2L5 13.4h5.6L9.2 22 19 9.6h-5.8z"/></svg>',
};

export interface PowerBar {
  readonly el: HTMLElement;
  render(state: UiState): void;
}

export function createPowerBar(callbacks: UiCallbacks): PowerBar {
  const el = h('div', 'ft-powers');
  el.setAttribute('role', 'toolbar');
  el.setAttribute('aria-label', 'Poderes');
  const items = POWER_ORDER.map((id) => {
    const b = button('ft-power', '', () => callbacks.onCastPower(id));
    const icon = h('span', `ft-power-icon is-${id}`);
    icon.innerHTML = POWER_ICONS[id];
    const name = h('span', 'ft-power-name');
    const key = h('span', 'ft-key ft-power-key');
    const timer = h('span', 'ft-power-timer');
    b.append(icon, name, key, timer);
    return { id, b, name, key, timer };
  });
  for (const item of items) el.appendChild(item.b);

  function render(state: UiState): void {
    for (const item of items) {
      const p = state.powers.find((x) => x.id === item.id);
      if (!p) continue;
      setText(item.name, p.name.replace('Chuva de flechas', 'Flechas'));
      setText(item.key, p.hotkey.toUpperCase());
      const cooling = p.cooldown > 0.05;
      setDisabled(item.b, !p.ready && state.aiming !== item.id);
      setClass(item.b, 'is-cooling', cooling);
      setClass(item.b, 'is-active', p.active > 0);
      setClass(item.b, 'is-aiming', state.aiming === item.id);
      setText(item.timer, cooling ? String(Math.ceil(p.cooldown)) : '');
      const fraction = cooling && p.maxCooldown > 0 ? Math.min(1, p.cooldown / p.maxCooldown) : 0;
      const pct = `${Math.round(fraction * 100)}%`;
      if (item.b.style.getPropertyValue('--cool') !== pct) item.b.style.setProperty('--cool', pct);
      setAttr(item.b, 'title', `${p.name}: ${p.description}${state.touch ? '' : ` (${p.hotkey.toUpperCase()})`}`);
      setAttr(item.b, 'aria-label', cooling ? `${p.name}, pronto em ${Math.ceil(p.cooldown)} segundos` : p.name);
    }
  }

  return { el, render };
}

export interface BossBar {
  readonly el: HTMLElement;
  render(state: UiState): void;
}

export function createBossBar(): BossBar {
  const el = h('div', 'ft-boss');
  const name = h('span', 'ft-boss-name');
  const track = h('span', 'ft-boss-track');
  const fill = h('span', 'ft-boss-fill');
  track.appendChild(fill);
  el.append(name, track);
  el.setAttribute('aria-live', 'polite');

  function render(state: UiState): void {
    const boss = state.screen === 'jogo' ? state.boss : null;
    setClass(el, 'is-show', boss !== null);
    if (!boss) return;
    setText(name, boss.name);
    const pct = `${Math.max(0, Math.min(100, (boss.hp / Math.max(1, boss.maxHp)) * 100)).toFixed(1)}%`;
    if (fill.style.width !== pct) fill.style.width = pct;
  }

  return { el, render };
}

export interface TutorialCard {
  readonly el: HTMLElement;
  render(state: UiState): void;
}

export function createTutorialCard(callbacks: UiCallbacks): TutorialCard {
  const el = h('div', 'ft-tutorial');
  el.setAttribute('role', 'status');
  const text = h('p', 'ft-tutorial-text');
  const foot = h('div', 'ft-tutorial-foot');
  const step = h('span', 'ft-tutorial-step');
  const skip = button('ft-tutorial-skip', 'Pular tutorial', () => callbacks.onTutorialSkip());
  const next = button('ft-btn primary ft-tutorial-next', 'Entendi', () => callbacks.onTutorialNext());
  foot.append(step, skip, next);
  el.append(text, foot);

  function render(state: UiState): void {
    const t = state.screen === 'jogo' ? state.tutorial : null;
    setClass(el, 'is-show', t !== null);
    if (!t) return;
    setText(text, t.text);
    setText(step, `Passo ${t.step} de ${t.total}`);
    setClass(next, 'is-hidden', !t.canAdvance);
  }

  return { el, render };
}
