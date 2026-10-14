import { audio } from '../audio';
import type { VolumeChannel } from '../audio';
import { button, h, setClass, setPressed, setText } from './dom';

export interface SettingsPanel {
  readonly el: HTMLElement;
  sync(): void;
}

const CHANNELS: { id: VolumeChannel; label: string; on: string; off: string }[] = [
  { id: 'musica', label: 'Música', on: 'Ligada', off: 'Desligada' },
  { id: 'efeitos', label: 'Efeitos', on: 'Ligados', off: 'Desligados' },
];

const panels = new Set<() => void>();

function syncAll(): void {
  for (const sync of panels) sync();
}

interface ChannelControl {
  id: VolumeChannel;
  on: string;
  off: string;
  toggle: HTMLButtonElement;
  slider: HTMLInputElement;
  value: HTMLElement;
  row: HTMLElement;
}

function createChannel(id: VolumeChannel, label: string, on: string, off: string): ChannelControl {
  const row = h('div', 'ft-sound-row');
  const head = h('div', 'ft-sound-head');
  const toggle = button('ft-btn ft-sound-toggle', '', () => {
    audio.toggleEnabled(id);
    audio.play('click');
    syncAll();
  });
  const value = h('span', 'ft-sound-value');
  head.append(h('span', 'ft-sound-label', label), value, toggle);
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '100';
  slider.step = '5';
  slider.className = 'ft-range';
  slider.setAttribute('aria-label', `Volume: ${label}`);
  slider.addEventListener('input', () => {
    audio.setVolume(id, Number(slider.value) / 100);
    if (!audio.isEnabled(id) && Number(slider.value) > 0) audio.setEnabled(id, true);
    syncAll();
  });
  slider.addEventListener('change', () => {
    if (id === 'efeitos') audio.play('click');
  });
  row.append(head, slider);
  return { id, on, off, toggle, slider, value, row };
}

export function createSettingsPanel(): SettingsPanel {
  const el = h('div', 'ft-settings');
  const soundGroup = h('div', 'ft-field');
  const channels = CHANNELS.map(({ id, label, on, off }) => createChannel(id, label, on, off));
  for (const c of channels) soundGroup.appendChild(c.row);
  el.append(soundGroup);

  function sync(): void {
    for (const c of channels) {
      const on = audio.isEnabled(c.id);
      const percent = Math.round(audio.getVolume(c.id) * 100);
      setText(c.toggle, on ? c.on : c.off);
      setPressed(c.toggle, on);
      setClass(c.row, 'is-off', !on);
      setText(c.value, `${percent}%`);
      if (document.activeElement !== c.slider && c.slider.value !== String(percent)) c.slider.value = String(percent);
      c.slider.style.setProperty('--fill', `${percent}%`);
    }
  }

  panels.add(sync);
  sync();
  return { el, sync };
}
