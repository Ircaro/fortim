const caches = new WeakMap<Element, Map<string, unknown>>();

export function changed(el: Element, key: string, value: unknown): boolean {
  let cache = caches.get(el);
  if (!cache) {
    cache = new Map();
    caches.set(el, cache);
  }
  if (cache.has(key) && cache.get(key) === value) return false;
  cache.set(key, value);
  return true;
}

export function setText(el: Element, value: string | number): void {
  const text = String(value);
  if (changed(el, 'text', text)) el.textContent = text;
}

export function setClass(el: Element, name: string, on: boolean): void {
  if (changed(el, 'class:' + name, on)) el.classList.toggle(name, on);
}

export function setAttr(el: Element, name: string, value: string): void {
  if (changed(el, 'attr:' + name, value)) el.setAttribute(name, value);
}

export function setDisabled(el: HTMLButtonElement, disabled: boolean): void {
  if (changed(el, 'disabled', disabled)) el.disabled = disabled;
}

export function setPressed(el: HTMLElement, on: boolean): void {
  setClass(el, 'is-on', on);
  setAttr(el, 'aria-pressed', on ? 'true' : 'false');
}

export function setHtml(el: Element, html: string): void {
  if (changed(el, 'html', html)) el.innerHTML = html;
}

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

export function button(className: string, text: string, onClick: () => void): HTMLButtonElement {
  const el = h('button', className, text);
  el.type = 'button';
  el.addEventListener('click', onClick);
  return el;
}

export function restartAnimation(el: HTMLElement, name: string): void {
  el.classList.remove(name);
  void el.offsetWidth;
  el.classList.add(name);
}

const SVG_OPEN = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">';

export const ICONS = {
  pause: `${SVG_OPEN}<rect x="6" y="5" width="4.2" height="14" rx="1.6"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.6"/></svg>`,
  play: `${SVG_OPEN}<path d="M8 5.6v12.8a1.1 1.1 0 0 0 1.7.9l9.6-6.4a1.1 1.1 0 0 0 0-1.8L9.7 4.7A1.1 1.1 0 0 0 8 5.6z"/></svg>`,
  sound: `${SVG_OPEN}<path d="M3.5 9.2h3.6L12 5.2v13.6l-4.9-4H3.5z"/><path d="M15.3 9a4.2 4.2 0 0 1 0 6M17.9 6.4a7.8 7.8 0 0 1 0 11.2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  mute: `${SVG_OPEN}<path d="M3.5 9.2h3.6L12 5.2v13.6l-4.9-4H3.5z"/><path d="M15.6 9.4l5 5.2M20.6 9.4l-5 5.2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  sliders: `${SVG_OPEN}<path d="M4 7.5h16M4 16.5h16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="9" cy="7.5" r="2.8"/><circle cx="15" cy="16.5" r="2.8"/></svg>`,
  close: `${SVG_OPEN}<path d="M6.5 6.5l11 11M17.5 6.5l-11 11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`,
  speed: `${SVG_OPEN}<path d="M3.5 7.2v9.6a.9.9 0 0 0 1.4.7l6.6-4.8a.9.9 0 0 0 0-1.4L4.9 6.5a.9.9 0 0 0-1.4.7zM12.5 7.2v9.6a.9.9 0 0 0 1.4.7l6.6-4.8a.9.9 0 0 0 0-1.4l-6.6-4.8a.9.9 0 0 0-1.4.7z"/></svg>`,
  heart: `${SVG_OPEN}<path d="M12 20.6l-1.3-1.2C5.9 15.1 3 12.4 3 8.9A4.6 4.6 0 0 1 7.6 4.3c1.7 0 3.3.8 4.4 2.1a5.8 5.8 0 0 1 4.4-2.1A4.6 4.6 0 0 1 21 8.9c0 3.5-2.9 6.2-7.7 10.5z"/></svg>`,
  book: `${SVG_OPEN}<path d="M4 5.2A1.7 1.7 0 0 1 5.7 3.5H11v16H5.7A1.7 1.7 0 0 0 4 21.2zM20 5.2a1.7 1.7 0 0 0-1.7-1.7H13v16h5.3a1.7 1.7 0 0 1 1.7 1.7z"/></svg>`,
};

export function iconButton(className: string, icon: string, label: string, onClick: () => void): { el: HTMLButtonElement; icon: HTMLSpanElement; label: HTMLSpanElement } {
  const el = h('button', 'ft-btn ' + className);
  el.type = 'button';
  const iconEl = h('span', 'ft-ico');
  iconEl.innerHTML = icon;
  const labelEl = h('span', 'ft-lbl', label);
  el.append(iconEl, labelEl);
  el.setAttribute('aria-label', label);
  el.title = label;
  el.addEventListener('click', onClick);
  return { el, icon: iconEl, label: labelEl };
}
