import type { Difficulty } from '../core/types';
import type { GameMode, MenuState, UiCallbacks } from '../core/view';
import { DIFFICULTIES, DIFFICULTY_ORDER } from '../data/difficulty';
import { button, changed, h, setAttr, setClass, setPressed, setText } from './dom';
import { drawStageThumb } from './thumb';

export const LOGO_SVG =
  '<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false"><path d="M50,8 L84,19 L84,51 Q84,75 50,91 Q16,75 16,51 L16,19 Z" fill="#ecebf3"/><path d="M50,16 L77,25 L77,51 Q77,70 50,83 Q23,70 23,51 L23,25 Z" fill="#6aa7ff"/><rect x="35" y="44" width="30" height="25" fill="#171a26"/><rect x="35" y="37" width="7" height="8" fill="#171a26"/><rect x="46.5" y="37" width="7" height="8" fill="#171a26"/><rect x="58" y="37" width="7" height="8" fill="#171a26"/><path d="M45,69 v-8 a5,5 0 0 1 10,0 v8 z" fill="#6aa7ff"/><rect x="48.8" y="20" width="2.4" height="17" fill="#171a26"/><polygon points="51.2,20 63,25 51.2,30" fill="#f2c14e"/></svg>';

const LEVEL_NAMES = { facil: 'Fácil', medio: 'Médio', dificil: 'Difícil' } as const;

const DIFFICULTY_HINTS: Record<Difficulty, string> = {
  facil: 'Inimigos mais fracos, mais ouro e 25 vidas.',
  normal: 'O jogo como foi pensado: 20 vidas.',
  dificil: 'Inimigos mais fortes e só 15 vidas.',
};

const MODE_HINTS: Record<GameMode, string> = {
  campanha: 'Campanha: vença as 15 ondas para liberar a próxima fase.',
  infinito: 'Infinito: as ondas nunca acabam. Vá o mais longe que puder.',
};

export interface MenuView {
  readonly el: HTMLElement;
  render(menu: MenuState): void;
}

export interface MenuActions {
  openGuide(): void;
  openAchievements(): void;
  openSound(): void;
}

interface CardView {
  id: string;
  el: HTMLButtonElement;
  stars: HTMLElement;
  lock: HTMLElement;
}

export function starsText(count: number): string {
  return '★★★'.slice(0, Math.max(0, Math.min(3, count)));
}

export function createMenu(callbacks: UiCallbacks, actions: MenuActions): MenuView {
  const el = h('section', 'ft-screen ft-menu');
  const card = h('div', 'ft-panel ft-menu-card');

  const head = h('div', 'ft-menu-head');
  const logo = h('span', 'ft-logo');
  logo.innerHTML = LOGO_SVG;
  const titles = h('div', 'ft-menu-titles');
  titles.append(h('h1', 'ft-title', 'Fortim'), h('p', 'ft-subtitle', 'Defenda o vale'));
  head.append(logo, titles);

  const opts = h('div', 'ft-menu-opts');
  const modeSeg = h('div', 'ft-seg');
  modeSeg.setAttribute('role', 'group');
  modeSeg.setAttribute('aria-label', 'Modo');
  const modeButtons = new Map<GameMode, HTMLButtonElement>();
  for (const [mode, label] of [
    ['campanha', 'Campanha'],
    ['infinito', 'Infinito'],
  ] as const) {
    const b = button('ft-seg-btn', label, () => callbacks.onSelectMode(mode));
    modeButtons.set(mode, b);
    modeSeg.appendChild(b);
  }
  const diffSeg = h('div', 'ft-seg');
  diffSeg.setAttribute('role', 'group');
  diffSeg.setAttribute('aria-label', 'Dificuldade');
  const diffButtons = new Map<Difficulty, HTMLButtonElement>();
  for (const id of DIFFICULTY_ORDER) {
    const b = button('ft-seg-btn', DIFFICULTIES[id].name, () => callbacks.onSelectDifficulty(id));
    diffButtons.set(id, b);
    diffSeg.appendChild(b);
  }
  const hint = h('div', 'ft-menu-hint');
  const modeHint = h('span', 'ft-menu-hint-line');
  const diffHint = h('span', 'ft-menu-hint-line');
  hint.append(modeHint, diffHint);
  opts.append(modeSeg, diffSeg, hint);

  const stagesWrap = h('div', 'ft-stages');
  stagesWrap.setAttribute('role', 'listbox');
  stagesWrap.setAttribute('aria-label', 'Fases');
  const cards: CardView[] = [];

  const acts = h('div', 'ft-menu-acts');
  const playBtn = button('ft-btn primary ft-big ft-play', 'Jogar', () => callbacks.onPlay());
  const continueBtn = button('ft-btn ft-big ft-continue', '', () => callbacks.onContinue());
  const continueTitle = h('span', 'ft-continue-title', 'Continuar');
  const continueSub = h('span', 'ft-continue-sub');
  continueBtn.append(continueTitle, continueSub);
  acts.append(playBtn, continueBtn);

  const links = h('div', 'ft-menu-links');
  const guideBtn = button('ft-btn', 'Guia', () => actions.openGuide());
  const achBtn = button('ft-btn', 'Conquistas', () => actions.openAchievements());
  const soundBtn = button('ft-btn', 'Som', () => actions.openSound());
  links.append(guideBtn, achBtn, soundBtn);

  card.append(head, opts, stagesWrap, acts, links);
  el.appendChild(card);

  function ensureCards(menu: MenuState): void {
    if (!changed(stagesWrap, 'ids', menu.stages.map((s) => s.id).join('|'))) return;
    stagesWrap.replaceChildren();
    cards.length = 0;
    menu.stages.forEach((s, i) => {
      const b = h('button', 'ft-stage-card');
      b.type = 'button';
      b.setAttribute('role', 'option');
      const thumb = h('canvas', 'ft-stage-thumb');
      drawStageThumb(thumb, s.stage, 240);
      const info = h('span', 'ft-stage-info');
      const name = h('span', 'ft-stage-name', `${i + 1}. ${s.name}`);
      const meta = h('span', 'ft-stage-meta');
      meta.append(h('span', `ft-stage-level is-${s.level}`, LEVEL_NAMES[s.level]));
      const stars = h('span', 'ft-stage-stars');
      meta.append(stars);
      info.append(name, meta);
      const lock = h('span', 'ft-stage-lock', 'Vença a fase anterior');
      b.append(thumb, info, lock);
      b.title = s.description;
      b.addEventListener('click', () => callbacks.onSelectStage(s.id));
      stagesWrap.appendChild(b);
      cards.push({ id: s.id, el: b, stars, lock });
    });
  }

  function render(menu: MenuState): void {
    ensureCards(menu);
    for (const [mode, b] of modeButtons) setPressed(b, mode === menu.mode);
    for (const [id, b] of diffButtons) setPressed(b, id === menu.difficulty);
    setText(modeHint, MODE_HINTS[menu.mode]);
    setText(diffHint, DIFFICULTY_HINTS[menu.difficulty]);
    menu.stages.forEach((s, i) => {
      const c = cards[i];
      if (!c) return;
      setClass(c.el, 'is-locked', !s.unlocked);
      setPressed(c.el, s.id === menu.stageId);
      setAttr(c.el, 'aria-selected', s.id === menu.stageId ? 'true' : 'false');
      setAttr(c.el, 'aria-disabled', s.unlocked ? 'false' : 'true');
      if (menu.mode === 'infinito') setText(c.stars, s.bestInfinite > 0 ? `Recorde: onda ${s.bestInfinite}` : 'Sem recorde');
      else setText(c.stars, s.stars > 0 ? starsText(s.stars) : 'Sem estrelas');
      setClass(c.stars, 'is-stars', menu.mode !== 'infinito' && s.stars > 0);
    });
    const selected = menu.stages.find((s) => s.id === menu.stageId);
    setText(playBtn, selected ? `Jogar: ${selected.name}` : 'Jogar');
    setClass(continueBtn, 'is-hidden', menu.continueLabel === null);
    setText(continueSub, menu.continueLabel ?? '');
    const done = menu.achievements.filter((a) => a.unlocked).length;
    setText(achBtn, `Conquistas ${done}/${menu.achievements.length}`);
  }

  return { el, render };
}
