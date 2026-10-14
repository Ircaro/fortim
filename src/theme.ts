import type { EnemyId, TowerId } from './core/types';

export type PaletteId = 'noite';

export interface Palette {
  id: PaletteId;
  name: string;
  bg: string;
  ground: string;
  ground2: string;
  path: string;
  pathEdge: string;
  shadow: string;
  tree: [string, string];
  rock: string;
  ink: string;
  hit: string;
  castle: string;
  portal: string;
  tower: Record<TowerId, string>;
  enemy: Record<EnemyId, string>;
  css: {
    bg: string;
    ink: string;
    dim: string;
    panel: string;
    line: string;
    chip: string;
    accent: string;
    accentText: string;
    gold: string;
    life: string;
    good: string;
    bad: string;
  };
}

export const PALETTES: Record<PaletteId, Palette> = {
  noite: {
    id: 'noite',
    name: 'Noite',
    bg: '#171a26',
    ground: '#1f2333',
    ground2: '#1c2030',
    path: '#2b3048',
    pathEdge: '#323853',
    shadow: 'rgba(0,0,0,0.28)',
    tree: ['#2f6b5a', '#3a7d69'],
    rock: '#3a3f55',
    ink: '#e8e6f0',
    hit: '#ffffff',
    castle: '#f2c14e',
    portal: '#b48cff',
    tower: { arqueiro: '#6aa7ff', canhao: '#d7d9e6', gelo: '#7fe0ff', mago: '#b48cff', balista: '#ff8a65', raio: '#ffd84a' },
    enemy: { goblin: '#6fd39a', lobo: '#ffc14d', orc: '#ff7b5c', morcego: '#c58cff', xama: '#5fd0c4', golem: '#a4a7b8', curandeiro: '#7ee0b0', escudeiro: '#c9b27a', lodo: '#8fd14f', lodinho: '#b2e27a', rei: '#c23b4a' },
    css: { bg: '#11131c', ink: '#ecebf3', dim: '#8d90a6', panel: '#232838', line: '#151824', chip: '#232838', accent: '#f2c14e', accentText: '#1b1e2b', gold: '#f2c14e', life: '#ff6b6b', good: '#6fd39a', bad: '#ff6b6b' },
  },
};

const FONT = "'Outfit', system-ui, sans-serif";
const listeners = new Set<() => void>();

export function palette(): Palette {
  return PALETTES.noite;
}

export function fontFamily(): string {
  return FONT;
}

export function onSettingsChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function applyCssVars(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement.style;
  for (const [key, value] of Object.entries(palette().css)) {
    root.setProperty('--' + key.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()), value);
  }
  root.setProperty('--font', fontFamily());
}
