import type { EnemyId, TowerId } from '../core/types';
import { ENEMIES, ENEMY_ORDER } from '../data/enemies';
import { ENEMY_GUIDE, TOWER_GUIDE, enemyTraits, towerName } from '../data/guide';
import { TOWERS, TOWER_ORDER } from '../data/towers';
import { POWERS, POWER_ORDER } from '../data/powers';
import { STAGES } from '../data/stages';
import { drawEnemyIcon } from '../render';
import { ICONS, button, h, setClass } from './dom';
import { damageTypeName, yesNo } from './format';
import { drawTowerIcon } from './icons';

export interface GuideModal {
  readonly el: HTMLElement;
  open(focus?: EnemyId | TowerId): void;
  close(): void;
  isOpen(): boolean;
  redraw(): void;
}

function speedWord(speed: number): string {
  if (speed >= 90) return 'rápida';
  if (speed <= 35) return 'lenta';
  return 'normal';
}

function towerChips(ids: readonly TowerId[], tone: 'good' | 'bad'): HTMLElement {
  const wrap = h('span', 'ft-chips');
  if (ids.length === 0) {
    wrap.appendChild(h('span', 'ft-chip ft-chip-none', 'Nenhuma em especial'));
    return wrap;
  }
  for (const id of ids) wrap.appendChild(h('span', `ft-chip ft-chip-${tone}`, towerName(id)));
  return wrap;
}

function stagesWith(enemy: EnemyId): string[] {
  return STAGES.filter((s) => s.waves.some((w) => w.groups.some((g) => g.enemy === enemy))).map((s) => s.name);
}

export function createGuideModal(onClose: () => void = () => {}): GuideModal {
  const enemyIcons: { canvas: HTMLCanvasElement; id: EnemyId }[] = [];
  const towerIcons: { canvas: HTMLCanvasElement; id: TowerId }[] = [];
  const anchors = new Map<string, HTMLElement>();

  const el = h('div', 'ft-modal ft-guide');
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'Guia');
  const card = h('div', 'ft-panel ft-modal-card ft-guide-card');
  const head = h('div', 'ft-modal-head');
  const closeBtn = h('button', 'ft-btn ft-close');
  closeBtn.type = 'button';
  closeBtn.innerHTML = ICONS.close;
  closeBtn.setAttribute('aria-label', 'Fechar');
  closeBtn.title = 'Fechar';
  closeBtn.addEventListener('click', () => close());
  head.append(h('h2', 'ft-h2', 'Guia'), closeBtn);

  const body = h('div', 'ft-guide-body');

  const enemiesTitle = h('h3', 'ft-guide-title', 'Inimigos');
  const enemyList = h('div', 'ft-guide-list');
  for (const id of ENEMY_ORDER) {
    const def = ENEMIES[id];
    const guide = ENEMY_GUIDE[id];
    const item = h('article', 'ft-guide-item');
    const top = h('div', 'ft-guide-top');
    const icon = h('canvas', 'ft-guide-icon');
    enemyIcons.push({ canvas: icon, id });
    const names = h('div', 'ft-guide-names');
    names.append(h('strong', 'ft-guide-name', def.name), h('span', 'ft-guide-meta', `Vida ${def.hp} · velocidade ${speedWord(def.speed)}`));
    top.append(icon, names);
    const traits = h('div', 'ft-chips');
    for (const t of enemyTraits(def)) traits.appendChild(h('span', 'ft-chip', t));
    const best = h('div', 'ft-guide-line');
    best.append(h('span', 'ft-guide-label', 'Melhor contra ele'), towerChips(guide.best, 'good'));
    const weak = h('div', 'ft-guide-line');
    weak.append(h('span', 'ft-guide-label', 'Evite'), towerChips(guide.weak, 'bad'));
    const tip = h('p', 'ft-guide-tip', guide.tip);
    const stages = stagesWith(id);
    const when = h('p', 'ft-guide-when', stages.length ? `Aparece em: ${stages.join(', ')}` : 'Aparece quando um lodo se divide');
    item.append(top);
    if (traits.childElementCount) item.append(traits);
    item.append(best, weak, tip, when);
    anchors.set(id, item);
    enemyList.appendChild(item);
  }

  const towersTitle = h('h3', 'ft-guide-title', 'Torres');
  const towerList = h('div', 'ft-guide-list');
  for (const id of TOWER_ORDER) {
    const def = TOWERS[id];
    const guide = TOWER_GUIDE[id];
    const item = h('article', 'ft-guide-item');
    const top = h('div', 'ft-guide-top');
    const icon = h('canvas', 'ft-guide-icon');
    towerIcons.push({ canvas: icon, id });
    const names = h('div', 'ft-guide-names');
    names.append(
      h('strong', 'ft-guide-name', def.name),
      h('span', 'ft-guide-meta', `Dano ${damageTypeName(def.damageType).toLowerCase()} · acerta voadores: ${yesNo(def.hitsAir).toLowerCase()}`),
    );
    top.append(icon, names);
    const strong = h('div', 'ft-guide-line');
    strong.append(h('span', 'ft-guide-label', 'Forte contra'), h('span', 'ft-guide-text ft-good', guide.strong));
    const weak = h('div', 'ft-guide-line');
    weak.append(h('span', 'ft-guide-label', 'Fraca contra'), h('span', 'ft-guide-text ft-bad', guide.weak));
    const specs = h('div', 'ft-guide-line');
    specs.append(h('span', 'ft-guide-label', 'Nível 4'), h('span', 'ft-guide-text', def.specs.map((sp) => `${sp.name} (${sp.description.replace(/\.$/, '')})`).join(' ou ')));
    item.append(top, h('p', 'ft-guide-tip', def.description), strong, weak, specs);
    anchors.set(id, item);
    towerList.appendChild(item);
  }

  const tipsTitle = h('h3', 'ft-guide-title', 'Dicas gerais');
  const tips = h('ul', 'ft-list ft-guide-tips');
  for (const line of [
    'Construa dentro das curvas da trilha: dali a torre alcança dois ou três trechos do caminho ao mesmo tempo.',
    'Melhorar uma torre rende mais dano por ouro do que construir uma nova no nível 1.',
    'Guarde ouro para Balistas antes das ondas com golem. Arqueiros e Magos quase não machucam o golem.',
    'No nível 3 a torre pode se especializar em um de dois caminhos. Depois disso, as melhorias "+" aumentam o dano sem limite, cada vez mais caras.',
    'Quando todos os inimigos da onda já entraram no mapa, dá para chamar a próxima onda mais cedo e ganhar ouro extra.',
    'Misture as torres: cada inimigo tem uma fraqueza diferente.',
    'Dá para construir e melhorar durante a onda. Pause para pensar com calma.',
    'Vender devolve 70% do que você gastou na torre.',
  ]) tips.appendChild(h('li', '', line));

  const powersTitle = h('h3', 'ft-guide-title', 'Poderes');
  const powersList = h('ul', 'ft-list ft-guide-tips');
  for (const id of POWER_ORDER) {
    const p = POWERS[id];
    const li = h('li', '');
    li.append(h('strong', '', `${p.name} (${p.hotkey.toUpperCase()}): `), document.createTextNode(`${p.description} Recarrega em ${p.cooldown} segundos.`));
    powersList.appendChild(li);
  }
  const keysTitle = h('h3', 'ft-guide-title only-mouse', 'Atalhos do teclado');
  const keys = h('div', 'ft-keys only-mouse');
  for (const [k, label] of [
    ['1 a 6', 'escolher torre'],
    ['Espaço', 'iniciar onda'],
    ['C', 'chamar onda antes'],
    ['Q W E', 'poderes'],
    ['U', 'melhorar'],
    ['Del', 'vender'],
    ['P', 'pausar'],
    ['F', 'velocidade'],
    ['M', 'som'],
    ['Esc', 'cancelar'],
  ]) {
    const item = h('span', 'ft-keyitem');
    item.append(h('kbd', 'ft-kbd', k), h('span', '', label));
    keys.appendChild(item);
  }
  body.append(enemiesTitle, enemyList, towersTitle, towerList, powersTitle, powersList, tipsTitle, tips, keysTitle, keys);
  const done = button('ft-btn primary ft-big', 'Entendi', () => close());
  card.append(head, body, done);
  el.appendChild(card);
  el.addEventListener('click', (e) => {
    if (e.target === el) close();
  });

  let opened = false;
  let drawn = false;

  function redraw(): void {
    for (const { canvas, id } of enemyIcons) drawEnemyIcon(canvas, id, 40);
    for (const { canvas, id } of towerIcons) drawTowerIcon(canvas, id);
    drawn = true;
  }

  function open(focus?: EnemyId | TowerId): void {
    opened = true;
    if (!drawn) redraw();
    setClass(el, 'is-open', true);
    for (const item of anchors.values()) setClass(item, 'is-focus', false);
    const target = focus ? anchors.get(focus) : null;
    if (target) {
      setClass(target, 'is-focus', true);
      requestAnimationFrame(() => target.scrollIntoView({ block: 'center' }));
    } else {
      body.scrollTop = 0;
    }
  }

  function close(): void {
    if (!opened) return;
    opened = false;
    setClass(el, 'is-open', false);
    onClose();
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

  return { el, open, close, isOpen: () => opened, redraw };
}
