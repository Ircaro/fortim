import { button, h, setClass, setText } from './dom';

export interface ConfirmOptions {
  title: string;
  text: string;
  confirmLabel: string;
  onConfirm(): void;
  onCancel?(): void;
}

export interface ConfirmModal {
  readonly el: HTMLElement;
  open(options: ConfirmOptions): void;
  close(): void;
  isOpen(): boolean;
}

export function createConfirmModal(): ConfirmModal {
  const el = h('div', 'ft-modal ft-confirm');
  el.setAttribute('role', 'alertdialog');
  el.setAttribute('aria-modal', 'true');
  const card = h('div', 'ft-panel ft-modal-card');
  const title = h('h2', 'ft-h2 ft-confirm-title');
  title.id = 'ft-confirm-title';
  const text = h('p', 'ft-confirm-text');
  text.id = 'ft-confirm-text';
  el.setAttribute('aria-labelledby', title.id);
  el.setAttribute('aria-describedby', text.id);
  const acts = h('div', 'ft-confirm-acts');
  const cancelBtn = button('ft-btn ft-big', 'Cancelar', () => dismiss());
  const okBtn = button('ft-btn ft-big danger', '', () => accept());
  acts.append(cancelBtn, okBtn);
  card.append(title, text, acts);
  el.appendChild(card);
  el.addEventListener('click', (e) => {
    if (e.target === el) dismiss();
  });

  let current: ConfirmOptions | null = null;

  function open(options: ConfirmOptions): void {
    current = options;
    setText(title, options.title);
    setText(text, options.text);
    setText(okBtn, options.confirmLabel);
    setClass(el, 'is-open', true);
    cancelBtn.focus();
  }

  function close(): void {
    current = null;
    setClass(el, 'is-open', false);
  }

  function dismiss(): void {
    const options = current;
    close();
    options?.onCancel?.();
  }

  function accept(): void {
    const options = current;
    close();
    options?.onConfirm();
  }

  window.addEventListener(
    'keydown',
    (e) => {
      if (current && e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        dismiss();
      }
    },
    true,
  );

  return { el, open, close, isOpen: () => current !== null };
}
