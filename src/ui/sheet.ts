import type { TargetMode, TowerDef, TowerId, TowerLevel, TowerState } from '../core/types';
import { towerLevel } from '../sim';
import type { UiCallbacks, UiState } from '../core/view';
import { TOWER_GUIDE } from '../data/guide';
import { TOWERS } from '../data/towers';
import { MAP } from '../data/map';
import { ICONS, button, changed, h, setAttr, setClass, setDisabled, setPressed, setText } from './dom';
import {
  TARGET_MODES,
  damageTypeName,
  formatRange,
  formatRate,
  levelText,
  sellLabel,
  targetModeName,
  upgradeLabel,
  yesNo,
} from './format';
import { drawTowerIcon } from './icons';
import { palette } from '../theme';
import { commonTargetMode } from '../game/state';

export type SheetMode = 'none' | 'torre' | 'posicionar' | 'grupo';

export interface TowerSheet {
  readonly el: HTMLElement;
  render(state: UiState, paletteVersion: number): void;
}

interface Row {
  row: HTMLElement;
  value: HTMLElement;
}

function coversCell(sheet: HTMLElement, mapbox: HTMLElement, col: number): boolean {
  const style = getComputedStyle(sheet);
  if (style.position === 'fixed' || !style.gridArea.startsWith('stage')) return false;
  const host = sheet.parentElement;
  const map = mapbox.getBoundingClientRect();
  if (!host || map.width <= 0) return false;
  const cell = map.width / MAP.cols;
  const cellRight = map.left + (col + 1) * cell;
  const hostRight = host.getBoundingClientRect().right - parseFloat(getComputedStyle(host).paddingRight || '0');
  const sheetLeft = hostRight - sheet.offsetWidth - parseFloat(style.marginRight || '0') - parseFloat(style.marginLeft || '0');
  return cellRight > sheetLeft;
}

export function createTowerSheet(callbacks: UiCallbacks, mapbox: HTMLElement): TowerSheet {
  const el = h('aside', 'ft-sheet');
  el.setAttribute('aria-live', 'polite');
  el.dataset.mode = 'torre';

  const grip = h('div', 'ft-grip');
  const head = h('div', 'ft-sheet-head');
  const icon = h('canvas', 'ft-sheet-icon');
  const titles = h('div', 'ft-sheet-titles');
  const name = h('h3', 'ft-sheet-name');
  const levelLine = h('div', 'ft-sheet-level');
  const pips = h('span', 'ft-pips');
  const levelLabel = h('span', '');
  levelLine.append(pips, levelLabel);
  titles.append(name, levelLine);

  let mode: SheetMode = 'none';
  const close = h('button', 'ft-btn ft-close');
  close.type = 'button';
  close.innerHTML = ICONS.close;
  close.setAttribute('aria-label', 'Fechar');
  close.title = 'Fechar';
  close.addEventListener('click', () => {
    if (mode === 'torre' || mode === 'grupo') callbacks.onDeselect();
    else callbacks.onPickTower(null);
  });
  head.append(icon, titles, close);

  const desc = h('p', 'ft-sheet-desc');
  const rows = h('div', 'ft-rows');

  function makeRow(label: string, extra = ''): Row {
    const row = h('div', 'ft-row ' + extra);
    const value = h('span', 'ft-row-value');
    row.append(h('span', 'ft-row-label', label), value);
    rows.appendChild(row);
    return { row, value };
  }

  const costRow = makeRow('Custo', 'only-pick');
  costRow.value.classList.add('ft-gold');

  interface StatRow extends Row {
    show(levels: readonly TowerLevel[]): boolean;
    read(level: TowerLevel): string;
  }

  function percentText(value: number): string {
    return `${Math.round(value * 100)}%`;
  }

  function seconds(value: number): string {
    return `${String(Math.round(value * 10) / 10).replace('.', ',')}s`;
  }

  function statRow(label: string, read: (level: TowerLevel) => string, show: (levels: readonly TowerLevel[]) => boolean = () => true, wide = false): StatRow {
    const row = makeRow(label, wide ? 'ft-row-wide' : '');
    return { ...row, read, show };
  }

  const statRows: StatRow[] = [
    statRow('Dano', (l) => String(Math.round(l.damage))),
    statRow('Cadência', (l) => formatRate(l.fireRate)),
    statRow('Alcance', (l) => formatRange(l.range)),
    statRow('Alvos', (l) => String(l.targets), (ls) => ls.some((l) => l.targets > 1)),
    statRow('Saltos', (l) => (l.chain ? String(l.chain.jumps) : '1'), (ls) => ls.some((l) => l.chain !== null)),
    statRow('Área', (l) => (l.splashRadius > 0 ? formatRange(l.splashRadius) : 'nenhuma'), (ls) => ls.some((l) => l.splashRadius > 0)),
    statRow(
      'Lentidão',
      (l) => (l.slow ? `-${percentText(1 - l.slow.factor)} por ${seconds(l.slow.duration)}` : 'nenhuma'),
      (ls) => ls.some((l) => l.slow !== null),
      true,
    ),
    statRow('Atordoa', (l) => (l.stun ? seconds(l.stun.duration) : 'não'), (ls) => ls.some((l) => l.stun !== null)),
    statRow('Queimadura', (l) => (l.burn ? `${Math.round(l.burn.dps)}/s por ${seconds(l.burn.duration)}` : 'não'), (ls) => ls.some((l) => l.burn !== null), true),
    statRow('Perfura armadura', (l) => percentText(l.armorPierce), (ls) => ls.some((l) => l.armorPierce > 0), true),
    statRow('Ignora resistência', (l) => percentText(l.magicPierce), (ls) => ls.some((l) => l.magicPierce > 0), true),
  ];

  function levelsShown(current: TowerLevel, next: TowerLevel | null): TowerLevel[] {
    return next ? [current, next] : [current];
  }

  function renderStat(row: StatRow, currentLevel: TowerLevel, nextLevel: TowerLevel | null): void {
    const visible = row.show(levelsShown(currentLevel, nextLevel));
    setClass(row.row, 'is-hidden', !visible);
    if (!visible) return;
    const current = row.read(currentLevel);
    const next = nextLevel ? row.read(nextLevel) : null;
    const key = next !== null && next !== current ? `${current}>${next}` : current;
    if (!changed(row.value, 'stat', key)) return;
    if (next === null || next === current) {
      row.value.replaceChildren(current);
      return;
    }
    row.value.replaceChildren(h('span', 'ft-stat-from', current), h('span', 'ft-stat-arrow', '→'), h('span', 'ft-stat-to', next));
  }

  const typeRow = makeRow('Tipo de dano', 'ft-row-extra');
  const airRow = makeRow('Acerta voadores', 'ft-row-extra');
  const killsRow = makeRow('Abates', 'only-torre');

  const matchup = h('div', 'ft-matchup');
  const strongLine = h('div', 'ft-matchup-line');
  const strongText = h('span', 'ft-good');
  strongLine.append(h('span', 'ft-matchup-label', 'Bom contra'), strongText);
  const weakLine = h('div', 'ft-matchup-line');
  const weakText = h('span', 'ft-bad');
  weakLine.append(h('span', 'ft-matchup-label', 'Fraco contra'), weakText);
  matchup.append(strongLine, weakLine);

  const hint = h('div', 'ft-hint only-pick');

  const targetBox = h('div', 'ft-target only-torre');
  targetBox.appendChild(h('div', 'ft-field-label', 'Alvo'));
  const targetSeg = h('div', 'ft-seg ft-seg-grid');
  targetSeg.setAttribute('role', 'group');
  targetSeg.setAttribute('aria-label', 'Alvo');
  const targetButtons = new Map<TargetMode, HTMLButtonElement>();
  for (const m of TARGET_MODES) {
    const b = button('ft-seg-btn', targetModeName(m), () => callbacks.onTargetMode(m));
    targetButtons.set(m, b);
    targetSeg.appendChild(b);
  }
  targetBox.appendChild(targetSeg);

  const specBox = h('div', 'ft-spec only-torre');
  const specTitle = h('div', 'ft-field-label', 'Especialização: escolha um caminho');
  const specRow = h('div', 'ft-spec-row');
  const specButtons = (['a', 'b'] as const).map((choice) => {
    const b = button('ft-spec-btn', '', () => callbacks.onSpecialize(choice));
    const sName = h('span', 'ft-spec-name');
    const sDesc = h('span', 'ft-spec-desc');
    const sCost = h('span', 'ft-spec-cost ft-gold');
    b.append(sName, sDesc, sCost);
    specRow.appendChild(b);
    return { b, sName, sDesc, sCost };
  });
  specBox.append(specTitle, specRow);

  const acts = h('div', 'ft-acts only-torre');
  const upgrade = button('ft-btn primary', '', () => {
    if (lastState?.selected?.spec) callbacks.onUpgradePlus();
    else callbacks.onUpgrade();
  });
  const sell = button('ft-btn', '', () => callbacks.onSell());
  acts.append(upgrade, sell);

  const multiRow = h('div', 'ft-multi-row only-sel');
  const multiBtn = button('ft-btn ft-multi', 'Selecionar várias', () => callbacks.onToggleMulti());
  const multiHint = h('span', 'ft-multi-hint', 'ou Shift + clique');
  multiRow.append(multiBtn, multiHint);

  const groupBox = h('div', 'ft-group only-grupo');
  const groupList = h('div', 'ft-group-list');
  const groupTarget = h('div', 'ft-target-all');
  groupTarget.appendChild(h('div', 'ft-field-label', 'Alvo de todas'));
  const groupSeg = h('div', 'ft-seg ft-seg-grid');
  groupSeg.setAttribute('role', 'group');
  groupSeg.setAttribute('aria-label', 'Alvo de todas');
  const groupButtons = new Map<TargetMode, HTMLButtonElement>();
  for (const m of TARGET_MODES) {
    const b = button('ft-seg-btn', targetModeName(m), () => callbacks.onTargetMode(m));
    groupButtons.set(m, b);
    groupSeg.appendChild(b);
  }
  groupTarget.appendChild(groupSeg);
  const groupNote = h('p', 'ft-group-note');
  groupBox.append(groupList, groupTarget, groupNote);

  const pickActs = h('div', 'ft-acts only-pick');
  const cancel = button('ft-btn', 'Cancelar', () => callbacks.onPickTower(null));
  pickActs.append(cancel);

  el.append(grip, head, multiRow, desc, rows, matchup, hint, groupBox, targetBox, specBox, acts, pickActs);
  let lastState: UiState | null = null;

  function renderPips(count: number, filled: number): void {
    if (changed(pips, 'count', count)) {
      pips.replaceChildren(...Array.from({ length: count }, () => h('span', 'ft-pip')));
    }
    Array.from(pips.children).forEach((pip, i) => setClass(pip, 'is-on', i < filled));
  }

  function renderDef(def: TowerDef, rawLevel: number, paletteVersion: number, current: TowerLevel, next: TowerLevel | null, tower: TowerState | null = null): void {
    const level = Math.min(rawLevel, def.levels.length - 1);
    if (changed(icon, 'icon', `${def.id}|${paletteVersion}`)) drawTowerIcon(icon, def.id);
    const spec = tower && tower.spec ? def.specs[tower.spec === 'a' ? 0 : 1] : null;
    setText(name, spec ? spec.name : def.name);
    setText(desc, def.description);
    renderPips(def.levels.length + 1, spec ? def.levels.length + 1 : level + 1);
    setText(levelLabel, spec ? `${def.name} · nível 4${tower && tower.plus > 0 ? ` · +${tower.plus}` : ''}` : levelText(level, def.levels.length));
    for (const row of statRows) renderStat(row, current, next);
    setText(typeRow.value, damageTypeName(def.damageType));
    setText(airRow.value, yesNo(def.hitsAir));
    setText(strongText, TOWER_GUIDE[def.id].strong);
    setText(weakText, TOWER_GUIDE[def.id].weak);
  }

  function renderGroup(state: UiState): void {
    const towers = state.group;
    setText(name, `${towers.length} torres selecionadas`);
    setClass(el, 'has-spec', false);
    const key = towers.map((t) => `${t.uid}:${t.def.id}:${t.level}:${t.spec ?? ''}:${t.targetMode}`).join('|');
    if (changed(groupList, 'items', key)) {
      const colors = palette().tower;
      groupList.replaceChildren(
        ...towers.map((t) => {
          const item = h('div', 'ft-group-item');
          const dot = h('span', 'ft-group-dot');
          dot.style.background = colors[t.def.id];
          const spec = t.spec ? t.def.specs[t.spec === 'a' ? 0 : 1].name : t.def.name;
          const levelLabel = t.spec ? 'nível 4' : `nível ${Math.min(t.level, t.def.levels.length - 1) + 1}`;
          item.append(dot, h('span', 'ft-group-name', `${spec} · ${levelLabel}`), h('span', 'ft-group-mode', targetModeName(t.targetMode)));
          return item;
        }),
      );
    }
    const common = commonTargetMode(towers);
    for (const [m, b] of groupButtons) {
      setPressed(b, common === m);
      setClass(b, 'is-part', common === null && towers.some((t) => t.targetMode === m));
    }
    setText(groupNote, common === null ? 'Os alvos estão diferentes. O contorno marca os que estão em uso; tocar num botão aplica a todas.' : 'Tocar num botão troca o alvo de todas de uma vez.');
  }

  let sideKey = '';
  let pointerCol: number | null = null;

  function trackPointer(event: PointerEvent): void {
    const rect = mapbox.getBoundingClientRect();
    if (rect.width <= 0) return;
    const col = Math.floor(((event.clientX - rect.left) / rect.width) * MAP.cols);
    pointerCol = Math.min(MAP.cols - 1, Math.max(0, col));
  }

  mapbox.addEventListener('pointermove', trackPointer, { passive: true });
  mapbox.addEventListener('pointerdown', trackPointer, { passive: true });

  function updateSide(state: UiState): void {
    const col =
      mode === 'torre' && state.selected
        ? state.selected.col
        : mode === 'grupo' && state.group.length > 0
          ? state.group[state.group.length - 1].col
          : mode === 'posicionar'
            ? pointerCol
            : null;
    const key = col === null ? '' : `${mode}|${col}|${window.innerWidth}x${window.innerHeight}`;
    if (key === sideKey) return;
    sideKey = key;
    setClass(el, 'is-left', col !== null && coversCell(el, mapbox, col));
  }

  function render(state: UiState, paletteVersion: number): void {
    lastState = state;
    const next: SheetMode =
      state.screen !== 'jogo' ? 'none' : state.group.length > 1 ? 'grupo' : state.selected ? 'torre' : state.picking ? 'posicionar' : 'none';
    if (next !== mode) {
      mode = next;
      if (mode !== 'none') el.dataset.mode = mode;
    }
    setClass(el, 'is-open', mode !== 'none');
    updateSide(state);
    setAttr(el, 'aria-hidden', mode === 'none' ? 'true' : 'false');
    setPressed(multiBtn, state.multiMode);
    setClass(multiHint, 'is-hidden', state.touch);
    if (mode === 'grupo') {
      renderGroup(state);
      return;
    }
    if (mode === 'torre' && state.selected) {
      const t = state.selected;
      const current = towerLevel(t);
      const maxLevel = t.def.levels.length - 1;
      const preview = t.level < maxLevel ? t.def.levels[t.level + 1] : t.spec ? towerLevel({ ...t, plus: t.plus + 1 }) : null;
      renderDef(t.def, t.level, paletteVersion, current, preview, t);
      setText(killsRow.value, t.kills);
      for (const [m, b] of targetButtons) setPressed(b, m === t.targetMode);
      const options = state.specOptions;
      setClass(specBox, 'is-hidden', options === null);
      setClass(el, 'has-spec', options !== null);
      if (options) {
        options.forEach((o, i) => {
          const s = specButtons[i];
          setText(s.sName, o.name);
          setText(s.sDesc, o.description);
          setText(s.sCost, o.cost === null ? '' : String(o.cost));
          setDisabled(s.b, o.cost === null || state.gold < o.cost);
          setAttr(s.b, 'title', `${o.name}: ${o.description}`);
        });
      }
      if (t.spec) {
        const cost = state.plusCost;
        setText(upgrade, cost === null ? 'Máximo' : `Melhorar +${t.plus + 1} (${cost})`);
        setDisabled(upgrade, cost === null || state.gold < cost);
        setClass(upgrade, 'is-max', cost === null);
      } else {
        setText(upgrade, upgradeLabel(state.upgradeCost));
        setDisabled(upgrade, state.upgradeCost === null || state.gold < state.upgradeCost);
        setClass(upgrade, 'is-max', state.upgradeCost === null);
      }
      setClass(upgrade, 'is-hidden', options !== null);
      setText(sell, sellLabel(state.sellValue));
    } else if (mode === 'posicionar' && state.picking) {
      const id: TowerId = state.picking;
      const def = TOWERS[id];
      renderDef(def, 0, paletteVersion, def.levels[0], null);
      const cost = def.levels[0].cost;
      const poor = !state.affordable[id];
      setText(costRow.value, cost);
      setClass(costRow.row, 'is-poor', poor);
      setClass(hint, 'is-poor', poor);
      if (poor) setText(hint, `Ouro insuficiente: faltam ${Math.max(0, cost - state.gold)}. Dá para construir assim que o ouro chegar.`);
      else setText(hint, state.touch ? 'Toque num espaço livre do mapa e toque de novo para construir' : 'Clique num espaço livre do mapa. Shift mantém a torre escolhida, Esc cancela.');
    }
  }

  return { el, render };
}
