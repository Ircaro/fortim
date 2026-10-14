import type { StageDef } from '../data/stages';
import type {
  BattleApi,
  BattleEvent,
  BattlePhase,
  BattleStats,
  Difficulty,
  GridPoint,
  Point,
  PowerId,
  SpecChoice,
  TargetMode,
  TowerId,
  TowerState,
  WaveDef,
} from './types';

export interface PowerAim {
  power: PowerId;
  x: number;
  y: number;
  radius: number;
  valid: boolean;
}

export interface Ghost {
  towerId: TowerId;
  col: number;
  row: number;
  valid: boolean;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface RendererApi {
  readonly canvas: HTMLCanvasElement;
  setStage(stage: StageDef): void;
  setBattle(battle: BattleApi): void;
  setPowerAim(aim: PowerAim | null): void;
  clientToWorld(clientX: number, clientY: number): Point | null;
  handleEvent(event: BattleEvent): void;
  resize(): void;
  frame(realDt: number, now: number): void;
  setSelected(towerUid: number | null): void;
  setHovered(towerUid: number | null): void;
  setGhost(ghost: Ghost | null): void;
  cellAt(clientX: number, clientY: number): GridPoint | null;
  cellToClient(col: number, row: number): ScreenPoint;
  destroy(): void;
}

export type Screen = 'menu' | 'jogo' | 'resultado';
export type GameMode = 'campanha' | 'infinito';

export interface AchievementView {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
}

export interface ResultData {
  victory: boolean;
  wave: number;
  totalWaves: number;
  lives: number;
  stats: BattleStats;
  infinite: boolean;
  stageName: string;
  difficulty: Difficulty;
  stars: number;
  bestInfinite: number;
  isRecord: boolean;
  newAchievements: AchievementView[];
  nextStageName: string | null;
}

export interface StageCard {
  id: string;
  name: string;
  description: string;
  level: 'facil' | 'medio' | 'dificil';
  unlocked: boolean;
  stars: number;
  bestInfinite: number;
  stage: StageDef;
}

export interface MenuState {
  mode: GameMode;
  difficulty: Difficulty;
  stageId: string;
  stages: StageCard[];
  continueLabel: string | null;
  achievements: AchievementView[];
}

export interface PowerView {
  id: PowerId;
  name: string;
  description: string;
  hotkey: string;
  cooldown: number;
  maxCooldown: number;
  active: number;
  ready: boolean;
}

export interface BossView {
  name: string;
  hp: number;
  maxHp: number;
}

export interface TutorialView {
  step: number;
  total: number;
  text: string;
  canAdvance: boolean;
}

export interface SpecOption {
  choice: SpecChoice;
  name: string;
  description: string;
  cost: number | null;
}

export interface UiState {
  menu: MenuState;
  stageName: string;
  difficulty: Difficulty;
  infinite: boolean;
  upcoming: WaveDef | null;
  upcomingNumber: number;
  boss: BossView | null;
  powers: PowerView[];
  aiming: PowerId | null;
  canCallEarly: boolean;
  earlyBonus: number;
  specOptions: SpecOption[] | null;
  plusCost: number | null;
  tutorial: TutorialView | null;
  screen: Screen;
  gold: number;
  lives: number;
  wave: number;
  totalWaves: number;
  phase: BattlePhase;
  picking: TowerId | null;
  selected: TowerState | null;
  upgradeCost: number | null;
  sellValue: number;
  affordable: Record<TowerId, boolean>;
  speed: number;
  paused: boolean;
  muted: boolean;
  touch: boolean;
  result: ResultData | null;
}

export interface UiCallbacks {
  onPlay(): void;
  onRestart(): void;
  onMenu(): void;
  onPickTower(id: TowerId | null): void;
  onUpgrade(): void;
  onSell(): void;
  onTargetMode(mode: TargetMode): void;
  onDeselect(): void;
  onStartWave(): void;
  onTogglePause(): void;
  onCycleSpeed(): void;
  onToggleMute(): void;
  onSelectMode(mode: GameMode): void;
  onSelectDifficulty(difficulty: Difficulty): void;
  onSelectStage(stageId: string): void;
  onContinue(): void;
  onNextStage(): void;
  onSpecialize(choice: SpecChoice): void;
  onUpgradePlus(): void;
  onCastPower(id: PowerId): void;
  onCallEarly(): void;
  onTutorialNext(): void;
  onTutorialSkip(): void;
}

export interface UiApi {
  readonly mapHost: HTMLElement;
  render(state: UiState): void;
  banner(title: string, subtitle?: string): void;
  floatingLabel(clientX: number, clientY: number, text: string, tone: 'gold' | 'bad' | 'good'): void;
}
