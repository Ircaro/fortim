import type { BattleApi, EnemyDef, EnemyId, GridPoint, PowerId, TowerId, WaveDef } from '../core/types';
import type { BossView, MenuState, PowerView, ResultData, Screen, ScreenPoint, SpecOption, TutorialView, UiState } from '../core/view';
import { TILE } from '../config';
import { POWERS, POWER_ORDER } from '../data/powers';

export const SPEEDS = [1, 2, 3] as const;

export interface ControlState {
  screen: Screen;
  picking: TowerId | null;
  selectedUid: number | null;
  aiming: PowerId | null;
  speed: number;
  paused: boolean;
  muted: boolean;
  touch: boolean;
  result: ResultData | null;
}

export function createControlState(touch = false, muted = false): ControlState {
  return {
    screen: 'menu',
    picking: null,
    selectedUid: null,
    aiming: null,
    speed: 1,
    paused: false,
    muted,
    touch,
    result: null,
  };
}

export interface UiContext {
  menu: MenuState;
  stageName: string;
  tutorial: TutorialView | null;
}

export function bossView(battle: BattleApi): BossView | null {
  let boss: BossView | null = null;
  for (const e of battle.enemies) {
    if (!e.alive || !e.def.isBoss) continue;
    if (!boss || e.hp > boss.hp) boss = { name: e.def.name, hp: Math.max(0, e.hp), maxHp: e.maxHp };
  }
  return boss;
}

export function powerViews(battle: BattleApi): PowerView[] {
  return POWER_ORDER.map((id) => {
    const def = POWERS[id];
    const state = battle.powers.find((p) => p.id === id);
    return {
      id,
      name: def.name,
      description: def.description,
      hotkey: def.hotkey,
      cooldown: state ? state.cooldown : 0,
      maxCooldown: state ? state.maxCooldown : def.cooldown,
      active: state ? state.active : 0,
      ready: battle.canCastPower(id),
    };
  });
}

export function upcomingWave(battle: BattleApi): { wave: WaveDef | null; number: number } {
  const number = battle.waveNumber + 1;
  if (!battle.infinite && number > battle.totalWaves) return { wave: null, number };
  return { wave: battle.waveDef(number) ?? null, number };
}

export function specOptions(battle: BattleApi, uid: number | null): SpecOption[] | null {
  if (uid === null) return null;
  const tower = battle.towers.find((t) => t.uid === uid);
  if (!tower || tower.spec !== null || tower.level < tower.def.levels.length - 1) return null;
  return tower.def.specs.map((spec, i) => {
    const choice = i === 0 ? 'a' : 'b';
    return { choice, name: spec.name, description: spec.description, cost: battle.specCost(uid, choice) };
  });
}

export function nextSpeed(speed: number): number {
  const index = SPEEDS.indexOf(speed as (typeof SPEEDS)[number]);
  return SPEEDS[(index + 1) % SPEEDS.length];
}

export function clampSpeed(speed: number): number {
  return SPEEDS.includes(speed as (typeof SPEEDS)[number]) ? speed : 1;
}

export function buildUiState(battle: BattleApi, towerIds: readonly TowerId[], control: ControlState, context: UiContext): UiState {
  const affordable = {} as Record<TowerId, boolean>;
  for (const id of towerIds) affordable[id] = battle.canAfford(id);
  const selected = control.selectedUid === null ? null : battle.towers.find((t) => t.uid === control.selectedUid) ?? null;
  const upcoming = upcomingWave(battle);
  return {
    menu: context.menu,
    stageName: context.stageName,
    difficulty: battle.difficulty,
    infinite: battle.infinite,
    upcoming: upcoming.wave,
    upcomingNumber: upcoming.number,
    boss: bossView(battle),
    powers: powerViews(battle),
    aiming: control.aiming,
    canCallEarly: battle.canCallEarly(),
    earlyBonus: battle.canCallEarly() ? battle.earlyBonus() : 0,
    specOptions: selected ? specOptions(battle, selected.uid) : null,
    plusCost: selected && selected.spec !== null ? battle.plusCost(selected.uid) : null,
    tutorial: context.tutorial,
    screen: control.screen,
    gold: battle.gold,
    lives: battle.lives,
    wave: battle.waveNumber,
    totalWaves: battle.totalWaves,
    phase: battle.phase,
    picking: control.picking,
    selected,
    upgradeCost: selected ? battle.upgradeCost(selected.uid) : null,
    sellValue: selected ? battle.sellValue(selected.uid) : 0,
    affordable,
    speed: control.speed,
    paused: control.paused,
    muted: control.muted,
    touch: control.touch,
    result: control.result,
  };
}

export type ResultExtras = Omit<ResultData, 'victory' | 'wave' | 'totalWaves' | 'lives' | 'stats' | 'infinite' | 'difficulty'>;

export function buildResult(battle: BattleApi, victory: boolean, extras: ResultExtras): ResultData {
  return {
    victory,
    wave: battle.waveNumber,
    totalWaves: battle.totalWaves,
    lives: battle.lives,
    stats: { ...battle.stats, powersUsed: { ...battle.stats.powersUsed } },
    infinite: battle.infinite,
    difficulty: battle.difficulty,
    ...extras,
  };
}

export const TUTORIAL_STEPS = [
  { touch: 'Toque numa torre aqui embaixo para escolher', mouse: 'Clique numa torre aqui embaixo para escolher (ou aperte 1)' },
  { touch: 'Toque num espaço livre perto da trilha e toque de novo para construir', mouse: 'Clique num espaço livre perto da trilha para construir' },
  { touch: 'Quando estiver pronto, toque em Iniciar onda', mouse: 'Quando estiver pronto, clique em Iniciar onda (ou aperte Espaço)' },
  { touch: 'Toque numa torre construída para melhorar. O Guia (livro no topo) mostra o que funciona contra cada inimigo', mouse: 'Clique numa torre construída para melhorar. O Guia (livro no topo) mostra o que funciona contra cada inimigo' },
] as const;

export function tutorialView(step: number | null, touch: boolean): TutorialView | null {
  if (step === null || step >= TUTORIAL_STEPS.length) return null;
  const s = TUTORIAL_STEPS[step];
  return { step: step + 1, total: TUTORIAL_STEPS.length, text: touch ? s.touch : s.mouse, canAdvance: step === TUTORIAL_STEPS.length - 1 };
}

export type TapAction =
  | { kind: 'build'; col: number; row: number; keepPicking: boolean }
  | { kind: 'ghost'; col: number; row: number }
  | { kind: 'select'; uid: number }
  | { kind: 'deselect' }
  | { kind: 'error' }
  | { kind: 'none' };

export interface TapInput {
  cell: GridPoint | null;
  picking: TowerId | null;
  pending: GridPoint | null;
  touch: boolean;
  shift: boolean;
  towerUid: number | null;
  canPlace: boolean;
}

export function sameCell(a: GridPoint | null, b: GridPoint | null): boolean {
  return a !== null && b !== null && a.col === b.col && a.row === b.row;
}

export function decideTap(input: TapInput): TapAction {
  const { cell, picking } = input;
  if (picking !== null) {
    if (cell === null) return { kind: 'none' };
    if (input.towerUid !== null) return { kind: 'select', uid: input.towerUid };
    if (input.touch && !sameCell(input.pending, cell)) return { kind: 'ghost', col: cell.col, row: cell.row };
    if (!input.canPlace) return { kind: 'error' };
    return { kind: 'build', col: cell.col, row: cell.row, keepPicking: !input.touch && input.shift };
  }
  if (cell !== null && input.towerUid !== null) return { kind: 'select', uid: input.towerUid };
  return { kind: 'deselect' };
}

export type KeyAction =
  | { kind: 'pick'; tower: TowerId }
  | { kind: 'startWave' }
  | { kind: 'pause' }
  | { kind: 'speed' }
  | { kind: 'mute' }
  | { kind: 'power'; power: PowerId }
  | { kind: 'callEarly' }
  | { kind: 'upgrade' }
  | { kind: 'sell' }
  | { kind: 'cancel' }
  | { kind: 'none' };

export function keyToAction(key: string, towerIds: readonly TowerId[]): KeyAction {
  if (/^[1-9]$/.test(key)) {
    const tower = towerIds[Number(key) - 1];
    return tower ? { kind: 'pick', tower } : { kind: 'none' };
  }
  const lower = key.toLowerCase();
  const power = POWER_ORDER.find((id) => POWERS[id].hotkey === lower);
  if (power) return { kind: 'power', power };
  switch (lower) {
    case 'c':
      return { kind: 'callEarly' };
    case ' ':
    case 'spacebar':
      return { kind: 'startWave' };
    case 'p':
      return { kind: 'pause' };
    case 'f':
      return { kind: 'speed' };
    case 'm':
      return { kind: 'mute' };
    case 'u':
      return { kind: 'upgrade' };
    case 'delete':
    case 'backspace':
      return { kind: 'sell' };
    case 'escape':
    case 'esc':
      return { kind: 'cancel' };
    default:
      return { kind: 'none' };
  }
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return names.slice(0, -1).join(', ') + ' e ' + names[names.length - 1];
}

export function waveSummary(wave: WaveDef | undefined, enemies: Record<EnemyId, EnemyDef>, limit = 3): string {
  if (!wave) return '';
  const totals = new Map<EnemyId, number>();
  for (const group of wave.groups) totals.set(group.enemy, (totals.get(group.enemy) ?? 0) + group.count);
  const ordered = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  return joinNames(ordered.map(([id]) => enemies[id].name));
}

export interface CellMapper {
  cellToClient(col: number, row: number): ScreenPoint;
  cellAt(clientX: number, clientY: number): GridPoint | null;
}

export interface ClientRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function logicalToClient(
  mapper: CellMapper,
  x: number,
  y: number,
  fallback: ClientRect | null = null,
  mapWidth = 0,
  mapHeight = 0,
): ScreenPoint {
  const a = mapper.cellToClient(0, 0);
  const b = mapper.cellToClient(1, 1);
  const sx = b.x - a.x;
  const sy = b.y - a.y;
  if (!(sx > 0) || !(sy > 0)) {
    if (fallback && mapWidth > 0 && mapHeight > 0) {
      const scale = Math.min(fallback.width / mapWidth, fallback.height / mapHeight);
      const left = fallback.left + (fallback.width - mapWidth * scale) / 2;
      const top = fallback.top + (fallback.height - mapHeight * scale) / 2;
      return { x: left + x * scale, y: top + y * scale };
    }
    return a;
  }
  const centered = mapper.cellAt(a.x - sx * 0.25, a.y - sy * 0.25) !== null;
  const offset = centered ? 0.5 : 0;
  return { x: a.x + (x / TILE - offset) * sx, y: a.y + (y / TILE - offset) * sy };
}
