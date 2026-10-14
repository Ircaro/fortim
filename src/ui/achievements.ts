import type { AchievementView } from '../core/view';
import { ICONS, button, changed, h, setClass } from './dom';

export interface AchievementsModal {
  readonly el: HTMLElement;
  open(list: readonly AchievementView[]): void;
  close(): void;
  isOpen(): boolean;
}

export function createAchievementsModal(): AchievementsModal {
  const el = h('div', 'ft-modal ft-ach-modal');
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'Conquistas');
  const card = h('div', 'ft-panel ft-modal-card ft-ach-card');
  const head = h('div', 'ft-modal-head');
  const title = h('h2', 'ft-h2', 'Conquistas');
  const closeBtn = h('button', 'ft-btn ft-close');
  closeBtn.type = 'button';
  closeBtn.innerHTML = ICONS.close;
  closeBtn.setAttribute('aria-label', 'Fechar');
  closeBtn.addEventListener('click', () => close());
  head.append(title, closeBtn);
  const list = h('div', 'ft-ach-list');
  const done = button('ft-btn primary ft-big', 'Fechar', () => close());
  card.append(head, list, done);
  el.appendChild(card);
  el.addEventListener('click', (e) => {
    if (e.target === el) close();
  });

  let opened = false;

  function open(items: readonly AchievementView[]): void {
    opened = true;
    const key = items.map((a) => `${a.id}:${a.unlocked}`).join('|');
    if (changed(list, 'items', key)) {
      list.replaceChildren(
        ...items.map((a) => {
          const item = h('div', 'ft-ach');
          setClass(item, 'is-done', a.unlocked);
          const badge = h('span', 'ft-ach-badge', a.unlocked ? '★' : '☆');
          const text = h('span', 'ft-ach-text');
          text.append(h('strong', '', a.title), h('span', '', a.description));
          item.append(badge, text);
          return item;
        }),
      );
      title.textContent = `Conquistas ${items.filter((a) => a.unlocked).length}/${items.length}`;
    }
    setClass(el, 'is-open', true);
  }

  function close(): void {
    opened = false;
    setClass(el, 'is-open', false);
  }

  window.addEventListener(
    'keydown',
    (e) => {
      if (opened && e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        close();
      }
    },
    true,
  );

  return { el, open, close, isOpen: () => opened };
}
