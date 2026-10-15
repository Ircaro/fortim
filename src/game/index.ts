import type { BattleEvent, Difficulty, GridPoint, Point, PowerId, SpecChoice, TargetMode, TowerId } from '../core/types';
import type { AchievementView, GameMode, Ghost, MenuState, PowerAim, ScreenPoint, StageCard, UiCallbacks, UiState } from '../core/view';
import { MAP_HEIGHT, MAP_WIDTH, TILE } from '../config';
import { audio } from '../audio';
import type { SfxName } from '../audio';
import { createProgress, starsFor } from '../core/progress';
import { DIFFICULTIES, isDifficulty } from '../data/difficulty';
import { ENEMIES } from '../data/enemies';
import { POWERS } from '../data/powers';
import { STAGES, STAGE_IDS, stageById } from '../data/stages';
import type { StageDef } from '../data/stages';
import { TOWER_ORDER } from '../data/towers';
import { createRenderer } from '../render';
import { createStageBattle } from '../sim';
import type { Battle } from '../sim';
import { clearSave, readSave, restoreBattle, serializeBattle, writeSave } from '../sim/save';
import { createUi } from '../ui';
import {
  TUTORIAL_STEPS,
  buildResult,
  buildUiState,
  clampSpeed,
  createControlState,
  decideTap,
  keyToAction,
  logicalToClient,
  nextSpeed,
  tutorialView,
  waveSummary,
  pruneSelection,
  selectedUids,
  toggleSelection,
} from './state';

const RESULT_DELAY = 1900;
const MENU_KEY = 'fortim:menu';
const TUTORIAL_KEY = 'fortim:tutorial';

interface MenuSelection {
  mode: GameMode;
  difficulty: Difficulty;
  stageId: string;
}

export interface GameDebugApi {
  startWave(): boolean;
  pick(id: TowerId | null): void;
  buildAt(col: number, row: number, id?: TowerId): number | null;
  select(uid: number | null): void;
  setSpeed(speed: number): void;
  castPower(id: PowerId, target?: Point): boolean;
  callEarly(): number;
  play(stageId?: string, difficulty?: Difficulty, infinite?: boolean): void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

function coarseQuery(): MediaQueryList | null {
  try {
    return typeof window.matchMedia === 'function' ? window.matchMedia('(pointer: coarse)') : null;
  } catch {
    return null;
  }
}

function readStorage(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    return;
  }
}

function loadSelection(): MenuSelection {
  const fallback: MenuSelection = { mode: 'campanha', difficulty: 'normal', stageId: STAGES[0].id };
  try {
    const raw = readStorage(MENU_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<MenuSelection>;
    return {
      mode: parsed.mode === 'infinito' ? 'infinito' : 'campanha',
      difficulty: isDifficulty(parsed.difficulty) ? parsed.difficulty : 'normal',
      stageId: typeof parsed.stageId === 'string' && stageById(parsed.stageId) ? parsed.stageId : fallback.stageId,
    };
  } catch {
    return fallback;
  }
}

export function startGame(root: HTMLElement | null): void {
  if (!root) return;
  const coarse = coarseQuery();
  const control = createControlState(coarse?.matches ?? false, audio.isMuted());
  const progress = createProgress({ stageIds: STAGE_IDS });
  const selection = loadSelection();
  let stage: StageDef = stageById(selection.stageId) ?? STAGES[0];
  let battle: Battle = createStageBattle(stage);
  let unsubscribe: () => void = () => {};
  let resultTimer: number | null = null;
  let hoverCell: GridPoint | null = null;
  let pendingCell: GridPoint | null = null;
  let aimPoint: Point | null = null;
  let pendingAim: Point | null = null;
  let lastGhostKey = '';
  let lastAimKey = '';
  let lastSelected = '';
  let lastHovered: number | null = null;
  let savedWave = -1;
  let tutorialStep: number | null = null;
  let menuState: MenuState = buildMenu();

  function buildMenu(): MenuState {
    if (!progress.isUnlocked(selection.stageId)) selection.stageId = STAGES[0].id;
    const stages: StageCard[] = STAGES.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      level: s.difficulty,
      unlocked: progress.isUnlocked(s.id),
      stars: progress.stars(s.id, selection.difficulty),
      bestInfinite: progress.bestInfiniteWave(s.id),
      stage: s,
    }));
    const save = readSave();
    const saveStage = save ? stageById(save.stageId) : undefined;
    const continueLabel =
      save && saveStage ? `${saveStage.name}, onda ${save.waveNumber + 1}${save.infinite ? ' no infinito' : ''} (${DIFFICULTIES[save.difficulty].name})` : null;
    const achievements: AchievementView[] = progress.achievements().map((a) => ({ id: a.id, title: a.title, description: a.description, unlocked: a.unlocked }));
    return { mode: selection.mode, difficulty: selection.difficulty, stageId: selection.stageId, stages, continueLabel, achievements };
  }

  function refreshMenu(): void {
    menuState = buildMenu();
    writeStorage(MENU_KEY, JSON.stringify(selection));
  }

  const callbacks: UiCallbacks = {
    onPlay: () => {
      sfx('click');
      const chosen = stageById(selection.stageId) ?? STAGES[0];
      if (!progress.isUnlocked(chosen.id)) {
        sfx('error');
        return;
      }
      clearSave();
      startStage(chosen, selection.difficulty, selection.mode === 'infinito');
    },
    onRestart: () => {
      sfx('click');
      clearSave();
      startStage(stage, battle.difficulty, battle.infinite);
    },
    onMenu: () => {
      sfx('click');
      goToMenu();
    },
    onContinue: () => {
      sfx('click');
      continueSaved();
    },
    onNextStage: () => {
      sfx('click');
      const index = STAGES.findIndex((s) => s.id === stage.id);
      const next = STAGES[index + 1];
      if (!next || !progress.isUnlocked(next.id)) {
        goToMenu();
        return;
      }
      selection.stageId = next.id;
      selection.mode = 'campanha';
      refreshMenu();
      clearSave();
      startStage(next, battle.difficulty, false);
    },
    onSelectMode: (mode) => {
      sfx('click');
      selection.mode = mode;
      refreshMenu();
    },
    onSelectDifficulty: (difficulty) => {
      sfx('click');
      selection.difficulty = difficulty;
      refreshMenu();
    },
    onSelectStage: (stageId) => {
      const chosen = stageById(stageId);
      if (!chosen || !progress.isUnlocked(stageId)) {
        sfx('error');
        return;
      }
      sfx('click');
      selection.stageId = stageId;
      refreshMenu();
      if (control.screen === 'menu') showBackdrop(chosen);
    },
    onPickTower: (id) => {
      pickTower(id);
    },
    onUpgrade: () => {
      upgradeSelected();
    },
    onSell: () => {
      sellSelected();
    },
    onSpecialize: (choice: SpecChoice) => {
      if (!inGame() || control.selectedUid === null) return;
      if (!battle.specialize(control.selectedUid, choice)) sfx('error');
    },
    onUpgradePlus: () => {
      if (!inGame() || control.selectedUid === null) return;
      if (!battle.upgradePlus(control.selectedUid)) sfx('error');
    },
    onTargetMode: (mode: TargetMode) => {
      const uids = selectedUids(control);
      if (uids.length === 0) return;
      sfx('click');
      for (const uid of uids) battle.setTargetMode(uid, mode);
    },
    onDeselect: () => {
      sfx('click');
      clearSelection();
    },
    onToggleMulti: () => {
      sfx('click');
      control.multiMode = !control.multiMode;
    },
    onStartWave: () => {
      if (startWave()) sfx('click');
      else sfx('error');
    },
    onCallEarly: () => {
      callEarly();
    },
    onCastPower: (id) => {
      usePower(id);
    },
    onTogglePause: () => {
      sfx('click');
      togglePause();
    },
    onCycleSpeed: () => {
      sfx('click');
      control.speed = nextSpeed(control.speed);
    },
    onToggleMute: () => {
      toggleMute();
      sfx('click');
    },
    onTutorialNext: () => {
      sfx('click');
      advanceTutorial(TUTORIAL_STEPS.length);
    },
    onTutorialSkip: () => {
      sfx('click');
      endTutorial();
    },
  };

  const ui = createUi(root, callbacks);
  const renderer = createRenderer(ui.mapHost);
  const canvas = renderer.canvas;
  canvas.style.touchAction = 'none';

  function sfx(name: SfxName): void {
    audio.play(name);
  }

  function inGame(): boolean {
    return control.screen === 'jogo';
  }

  function battleOver(): boolean {
    return battle.phase === 'vitoria' || battle.phase === 'derrota';
  }

  function clearResultTimer(): void {
    if (resultTimer !== null) {
      window.clearTimeout(resultTimer);
      resultTimer = null;
    }
  }

  function clearSelection(): void {
    control.selectedUid = null;
    control.group = [];
    control.multiMode = false;
  }

  function clearInteraction(): void {
    control.picking = null;
    clearSelection();
    control.aiming = null;
    pendingCell = null;
    hoverCell = null;
    aimPoint = null;
    pendingAim = null;
    renderer.setGhost(null);
    renderer.setHovered(null);
    renderer.setSelected([]);
    renderer.setPowerAim(null);
    lastGhostKey = '';
    lastAimKey = '';
    lastSelected = '';
    lastHovered = null;
  }

  function attachBattle(next: Battle, nextStage: StageDef): void {
    unsubscribe();
    clearResultTimer();
    stage = nextStage;
    battle = next;
    renderer.setStage(stage);
    renderer.setBattle(battle);
    unsubscribe = battle.on(handleBattleEvent);
    clearInteraction();
  }

  function showBackdrop(target: StageDef): void {
    attachBattle(createStageBattle(target), target);
  }

  function goToMenu(): void {
    endTutorialSilently();
    refreshMenu();
    showBackdrop(stageById(selection.stageId) ?? STAGES[0]);
    control.screen = 'menu';
    control.paused = false;
    control.result = null;
  }

  function startStage(target: StageDef, difficulty: Difficulty, infinite: boolean): void {
    attachBattle(createStageBattle(target, { difficulty, infinite }), target);
    savedWave = -1;
    control.screen = 'jogo';
    control.paused = false;
    control.result = null;
    ui.banner(target.name, infinite ? 'Modo infinito: aguente o máximo de ondas' : 'Escolha uma torre e posicione no mapa');
    if (readStorage(TUTORIAL_KEY) !== '1') tutorialStep = 0;
  }

  function continueSaved(): void {
    const save = readSave();
    const saveStage = save ? stageById(save.stageId) : undefined;
    const restored = save ? restoreBattle(save) : null;
    if (!save || !saveStage || !restored) {
      sfx('error');
      clearSave();
      refreshMenu();
      return;
    }
    selection.stageId = saveStage.id;
    selection.difficulty = save.difficulty;
    selection.mode = save.infinite ? 'infinito' : 'campanha';
    refreshMenu();
    attachBattle(restored, saveStage);
    savedWave = restored.waveNumber;
    control.screen = 'jogo';
    control.paused = false;
    control.result = null;
    ui.banner(saveStage.name, `Continuando da onda ${restored.waveNumber + 1}`);
  }

  function autosave(): void {
    if (!inGame() || battle.phase !== 'preparando' || battle.waveNumber <= 0 || battle.waveNumber === savedWave) return;
    const data = serializeBattle(battle, { stageId: stage.id });
    if (data && writeSave(data)) savedWave = battle.waveNumber;
  }

  function advanceTutorial(minimum: number): void {
    if (tutorialStep === null) return;
    if (tutorialStep < minimum) tutorialStep = minimum;
    if (tutorialStep >= TUTORIAL_STEPS.length) endTutorial();
  }

  function endTutorialSilently(): void {
    tutorialStep = null;
  }

  function endTutorial(): void {
    tutorialStep = null;
    writeStorage(TUTORIAL_KEY, '1');
  }

  function setPicking(id: TowerId | null): void {
    control.picking = id;
    pendingCell = null;
    if (id !== null) {
      clearSelection();
      control.aiming = null;
      if (tutorialStep === 0) advanceTutorial(1);
    }
  }

  function pickTower(id: TowerId | null): void {
    if (!inGame() || battleOver()) return;
    const next = id !== null && control.picking === id ? null : id;
    sfx('click');
    setPicking(next);
  }

  function cancel(): void {
    if (control.aiming !== null) {
      control.aiming = null;
      pendingAim = null;
      return;
    }
    if (control.picking !== null) {
      setPicking(null);
      return;
    }
    clearSelection();
  }

  function startWave(): boolean {
    if (!inGame()) return false;
    return battle.startNextWave();
  }

  function callEarly(): number {
    if (!inGame() || !battle.canCallEarly()) {
      sfx('error');
      return 0;
    }
    return battle.callEarly();
  }

  function usePower(id: PowerId): boolean {
    if (!inGame() || battleOver()) return false;
    if (!battle.canCastPower(id)) {
      sfx('error');
      return false;
    }
    if (POWERS[id].needsTarget) {
      sfx('click');
      if (control.aiming === id) {
        control.aiming = null;
      } else {
        control.aiming = id;
        control.picking = null;
        clearSelection();
      }
      pendingAim = null;
      return true;
    }
    return battle.castPower(id);
  }

  function castAt(point: Point): void {
    const id = control.aiming;
    if (id === null) return;
    if (battle.castPower(id, point)) {
      control.aiming = null;
      pendingAim = null;
      aimPoint = null;
    } else {
      sfx('error');
    }
  }

  function togglePause(): void {
    if (!inGame() || battleOver()) return;
    control.paused = !control.paused;
  }

  function toggleMute(): void {
    audio.toggleMuted();
    control.muted = audio.isMuted();
  }

  function upgradeSelected(): void {
    if (!inGame() || control.selectedUid === null) return;
    const uid = control.selectedUid;
    if (battle.upgradeCost(uid) !== null) {
      if (!battle.upgrade(uid)) sfx('error');
      return;
    }
    if (battle.plusCost(uid) !== null) {
      if (!battle.upgradePlus(uid)) sfx('error');
      return;
    }
    sfx('error');
  }

  function sellSelected(): void {
    if (!inGame() || control.selectedUid === null) return;
    const uid = control.selectedUid;
    if (battle.sell(uid) <= 0) {
      sfx('error');
      return;
    }
    clearSelection();
  }

  function buildAt(id: TowerId, col: number, row: number): number | null {
    if (!battle.canBuild(col, row) || !battle.canAfford(id)) return null;
    const tower = battle.build(id, col, row);
    return tower ? tower.uid : null;
  }

  function canPlace(id: TowerId, cell: GridPoint): boolean {
    return battle.canBuild(cell.col, cell.row) && battle.canAfford(id);
  }

  function pointToClient(x: number, y: number): ScreenPoint {
    return logicalToClient(renderer, x, y, canvas.getBoundingClientRect(), MAP_WIDTH, MAP_HEIGHT);
  }

  function cellCenterToClient(col: number, row: number): ScreenPoint {
    return pointToClient((col + 0.5) * TILE, (row + 0.5) * TILE);
  }

  function label(point: ScreenPoint, text: string, tone: 'gold' | 'bad' | 'good'): void {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
    ui.floatingLabel(point.x, point.y, text, tone);
  }

  function finish(victory: boolean): void {
    clearResultTimer();
    setPicking(null);
    control.aiming = null;
    const owner = battle;
    const finishedStage = stage;
    const difficulty = battle.difficulty;
    const infinite = battle.infinite;
    const bestBefore = progress.bestInfiniteWave(finishedStage.id);
    const startingLives = DIFFICULTIES[difficulty].lives;
    const unlocked = progress.recordGame({
      stageId: finishedStage.id,
      difficulty,
      infinite,
      victory,
      wave: battle.waveNumber,
      lives: battle.lives,
      startingLives,
      stats: battle.stats,
    });
    clearSave();
    endTutorial();
    const index = STAGES.findIndex((s) => s.id === finishedStage.id);
    const next = STAGES[index + 1];
    const nextStageName = victory && !infinite && next && progress.isUnlocked(next.id) ? next.name : null;
    const stars = starsFor({ victory, infinite, lives: battle.lives, startingLives });
    const extras = {
      stageName: finishedStage.name,
      stars,
      bestInfinite: Math.max(bestBefore, infinite ? battle.waveNumber : 0),
      isRecord: infinite && battle.waveNumber > bestBefore,
      newAchievements: unlocked.map((a) => ({ id: a.id, title: a.title, description: a.description, unlocked: true })),
      nextStageName,
    };
    refreshMenu();
    resultTimer = window.setTimeout(() => {
      resultTimer = null;
      if (battle !== owner || !inGame()) return;
      control.result = buildResult(battle, victory, extras);
      control.screen = 'resultado';
      control.paused = false;
      clearInteraction();
    }, RESULT_DELAY);
  }

  function handleBattleEvent(event: BattleEvent): void {
    renderer.handleEvent(event);
    switch (event.type) {
      case 'towerFired':
        sfx(`shoot_${event.projectile.kind}`);
        break;
      case 'chainLightning':
        sfx('shoot_magia');
        break;
      case 'projectileImpact':
        if (event.projectile.kind === 'bala') sfx('explosion');
        break;
      case 'enemyHit':
        sfx('hit');
        break;
      case 'enemySpawned':
        if (event.enemy.def.isBoss && inGame()) {
          sfx('wave_start');
          ui.banner(`${event.enemy.def.name} chegou!`, 'Balistas e o poder Congelar ajudam muito');
        }
        break;
      case 'enemyKilled':
        sfx(event.enemy.def.isBoss ? 'victory' : 'enemy_die');
        label(pointToClient(event.enemy.x, event.enemy.y), `+${event.reward}`, 'gold');
        break;
      case 'enemyLeaked':
        sfx('leak');
        label(cellCenterToClient(stage.castle.col, stage.castle.row), `-${event.lifeDamage}`, 'bad');
        break;
      case 'waveStarted':
        sfx('wave_start');
        ui.banner(`Onda ${event.wave}`, waveSummary(battle.waveDef(event.wave), ENEMIES));
        if (tutorialStep === 2) advanceTutorial(3);
        break;
      case 'waveCalledEarly':
        sfx('sell');
        label(cellCenterToClient(stage.castle.col, stage.castle.row), `+${event.bonus}`, 'gold');
        break;
      case 'waveCleared':
        sfx('wave_clear');
        if (battle.infinite || event.wave < battle.totalWaves) {
          ui.banner('Onda vencida!', event.bonus > 0 ? `+${event.bonus} de ouro` : undefined);
        }
        break;
      case 'powerCast':
        sfx(event.power === 'flechas' ? 'explosion' : event.power === 'congelar' ? 'shoot_gelo' : 'upgrade');
        break;
      case 'towerBuilt':
        sfx('build');
        if (tutorialStep !== null && tutorialStep <= 1) advanceTutorial(2);
        break;
      case 'towerUpgraded':
      case 'towerSpecialized':
      case 'towerPlus':
        sfx('upgrade');
        break;
      case 'towerSold':
        sfx('sell');
        label(cellCenterToClient(event.tower.col, event.tower.row), `+${event.refund}`, 'gold');
        break;
      case 'victory':
        sfx('victory');
        ui.banner('Vitória!', 'O fortim resistiu a todas as ondas');
        finish(true);
        break;
      case 'defeat':
        sfx('defeat');
        ui.banner('O fortim caiu', battle.infinite ? `Você aguentou até a onda ${battle.waveNumber}` : 'Os inimigos romperam as defesas');
        finish(false);
        break;
      default:
        break;
    }
  }

  function applyTap(cell: GridPoint | null, shift: boolean): void {
    const picking = control.picking;
    const tower = cell ? battle.towerAt(cell.col, cell.row) : null;
    const action = decideTap({
      cell,
      picking,
      pending: pendingCell,
      touch: control.touch,
      shift,
      multi: control.multiMode,
      towerUid: tower ? tower.uid : null,
      canPlace: picking !== null && cell !== null ? canPlace(picking, cell) : false,
    });
    switch (action.kind) {
      case 'ghost':
        pendingCell = { col: action.col, row: action.row };
        break;
      case 'build': {
        if (picking === null) return;
        if (buildAt(picking, action.col, action.row) === null) {
          sfx('error');
          return;
        }
        pendingCell = null;
        if (!action.keepPicking || !battle.canAfford(picking)) setPicking(null);
        break;
      }
      case 'error':
        sfx('error');
        break;
      case 'select':
        if (control.selectedUid !== action.uid || control.group.length > 0) sfx('click');
        if (control.picking !== null) setPicking(null);
        control.selectedUid = action.uid;
        control.group = [];
        break;
      case 'toggle': {
        sfx('click');
        const next = toggleSelection(control, action.uid);
        control.selectedUid = next.selectedUid;
        control.group = next.group;
        if (next.selectedUid === null && next.group.length === 0) control.multiMode = false;
        break;
      }
      case 'deselect':
        clearSelection();
        break;
      case 'none':
        break;
    }
  }

  function applyAimTap(clientX: number, clientY: number): void {
    const point = renderer.clientToWorld(clientX, clientY);
    if (!point) return;
    if (control.touch) {
      if (pendingAim && Math.hypot(pendingAim.x - point.x, pendingAim.y - point.y) <= TILE) {
        castAt(pendingAim);
        return;
      }
      pendingAim = point;
      return;
    }
    castAt(point);
  }

  function onPointerDown(event: PointerEvent): void {
    if (event.pointerType === 'touch') control.touch = true;
    else if (event.pointerType === 'mouse') control.touch = false;
    if (!inGame()) return;
    if (event.button === 2) {
      event.preventDefault();
      cancel();
      return;
    }
    if (event.button !== 0) return;
    event.preventDefault();
    if (control.aiming !== null) {
      applyAimTap(event.clientX, event.clientY);
      return;
    }
    const cell = renderer.cellAt(event.clientX, event.clientY);
    hoverCell = control.touch ? null : cell;
    applyTap(cell, event.shiftKey);
  }

  function onPointerMove(event: PointerEvent): void {
    if (event.pointerType === 'touch' || control.touch) return;
    hoverCell = inGame() ? renderer.cellAt(event.clientX, event.clientY) : null;
    aimPoint = inGame() ? renderer.clientToWorld(event.clientX, event.clientY) : null;
  }

  function onPointerLeave(event: PointerEvent): void {
    if (event.pointerType === 'touch') return;
    hoverCell = null;
    aimPoint = null;
  }

  function onContextMenu(event: Event): void {
    event.preventDefault();
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (isTypingTarget(event.target)) return;
    if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) {
      if (control.screen === 'menu') {
        event.preventDefault();
        callbacks.onPlay();
        return;
      }
      if (control.screen === 'resultado') {
        event.preventDefault();
        callbacks.onRestart();
        return;
      }
    }
    if (!inGame()) return;
    const action = keyToAction(event.key, TOWER_ORDER);
    if (action.kind === 'none') return;
    event.preventDefault();
    if (event.repeat) return;
    switch (action.kind) {
      case 'pick':
        pickTower(action.tower);
        break;
      case 'startWave':
        if (battle.phase === 'onda' && battle.canCallEarly()) callEarly();
        else if (startWave()) sfx('click');
        break;
      case 'callEarly':
        callEarly();
        break;
      case 'power':
        usePower(action.power);
        break;
      case 'pause':
        sfx('click');
        togglePause();
        break;
      case 'speed':
        sfx('click');
        control.speed = nextSpeed(control.speed);
        break;
      case 'mute':
        toggleMute();
        sfx('click');
        break;
      case 'upgrade':
        upgradeSelected();
        break;
      case 'sell':
        sellSelected();
        break;
      case 'cancel':
        cancel();
        break;
    }
  }

  function unlockAudio(): void {
    window.removeEventListener('pointerdown', unlockAudio, true);
    window.removeEventListener('keydown', unlockAudio, true);
    audio.unlock();
    audio.startMusic();
  }

  window.addEventListener('pointerdown', unlockAudio, true);
  window.addEventListener('keydown', unlockAudio, true);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('contextmenu', onContextMenu);
  ui.mapHost.addEventListener('contextmenu', onContextMenu);
  window.addEventListener('keydown', onKeyDown);

  coarse?.addEventListener?.('change', (event: MediaQueryListEvent) => {
    control.touch = event.matches;
  });

  const resize = (): void => renderer.resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  if (typeof ResizeObserver === 'function') new ResizeObserver(resize).observe(ui.mapHost);

  function syncView(): void {
    const pruned = pruneSelection(control, (uid) => battle.towers.some((t) => t.uid === uid));
    if (pruned.selectedUid !== control.selectedUid || pruned.group !== control.group) {
      control.selectedUid = pruned.selectedUid;
      control.group = pruned.group;
      if (pruned.selectedUid === null && pruned.group.length === 0) control.multiMode = false;
    }
    if (control.aiming !== null && !battle.canCastPower(control.aiming)) {
      control.aiming = null;
      pendingAim = null;
    }
    if (control.picking === null || !control.touch) pendingCell = null;
    const ghostCell = control.touch ? pendingCell : hoverCell;
    let ghost: Ghost | null = null;
    if (inGame() && control.picking !== null && ghostCell !== null) {
      ghost = { towerId: control.picking, col: ghostCell.col, row: ghostCell.row, valid: canPlace(control.picking, ghostCell) };
    }
    const ghostKey = ghost ? `${ghost.towerId}:${ghost.col}:${ghost.row}:${ghost.valid}` : '';
    if (ghostKey !== lastGhostKey) {
      lastGhostKey = ghostKey;
      renderer.setGhost(ghost);
    }
    const aimAt = control.touch ? pendingAim : aimPoint;
    let aim: PowerAim | null = null;
    if (inGame() && control.aiming !== null && aimAt !== null) {
      aim = { power: control.aiming, x: aimAt.x, y: aimAt.y, radius: POWERS[control.aiming].radius * TILE, valid: true };
    }
    const aimKey = aim ? `${aim.power}:${Math.round(aim.x)}:${Math.round(aim.y)}` : '';
    if (aimKey !== lastAimKey) {
      lastAimKey = aimKey;
      renderer.setPowerAim(aim);
    }
    const selected = inGame() ? selectedUids(control) : [];
    const selectedKey = selected.join(',');
    if (selectedKey !== lastSelected) {
      lastSelected = selectedKey;
      renderer.setSelected(selected);
    }
    let hovered: number | null = null;
    if (inGame() && !control.touch && control.picking === null && control.aiming === null && hoverCell !== null) {
      hovered = battle.towerAt(hoverCell.col, hoverCell.row)?.uid ?? null;
    }
    if (hovered !== lastHovered) {
      lastHovered = hovered;
      renderer.setHovered(hovered);
    }
    const cursor = !inGame() ? 'default' : control.picking !== null || control.aiming !== null ? 'crosshair' : hovered !== null ? 'pointer' : 'default';
    if (canvas.style.cursor !== cursor) canvas.style.cursor = cursor;
  }

  function uiState(): UiState {
    return buildUiState(battle, TOWER_ORDER, control, {
      menu: menuState,
      stageName: stage.name,
      tutorial: inGame() ? tutorialView(tutorialStep, control.touch) : null,
    });
  }

  let last = -1;
  function loop(now: number): void {
    const delta = last < 0 ? 0 : now - last;
    last = now;
    const realDt = Math.min(Math.max(delta, 0), 100) / 1000;
    if (inGame() && !control.paused && realDt > 0) battle.update(realDt * control.speed);
    autosave();
    control.muted = audio.isMuted();
    syncView();
    renderer.frame(realDt, now);
    ui.render(uiState());
    requestAnimationFrame(loop);
  }

  attachBattle(battle, stage);
  renderer.resize();
  requestAnimationFrame(loop);

  if (import.meta.env.DEV) {
    const game: GameDebugApi = {
      startWave: () => startWave(),
      pick: (id) => setPicking(id),
      buildAt: (col, row, id) => buildAt(id ?? control.picking ?? TOWER_ORDER[0], col, row),
      select: (uid) => {
        setPicking(null);
        control.selectedUid = uid;
        control.group = [];
      },
      setSpeed: (speed) => {
        control.speed = clampSpeed(speed);
      },
      castPower: (id, target) => (target ? battle.castPower(id, target) : usePower(id)),
      callEarly: () => callEarly(),
      play: (stageId, difficulty, infinite) => {
        const chosen = (stageId && stageById(stageId)) || stage;
        startStage(chosen, difficulty ?? 'normal', infinite ?? false);
      },
    };
    (window as unknown as { __fortim: unknown }).__fortim = {
      get battle(): Battle {
        return battle;
      },
      get state(): UiState {
        return uiState();
      },
      progress,
      game,
    };
  }
}
