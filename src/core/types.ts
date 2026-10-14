export type TowerId = 'arqueiro' | 'canhao' | 'gelo' | 'mago' | 'balista' | 'raio';
export type SpecChoice = 'a' | 'b';
export type EnemyId = 'goblin' | 'lobo' | 'orc' | 'morcego' | 'xama' | 'golem' | 'curandeiro' | 'escudeiro' | 'lodo' | 'lodinho' | 'rei';
export type PowerId = 'flechas' | 'congelar' | 'furia';
export type Difficulty = 'facil' | 'normal' | 'dificil';
export type DamageType = 'fisico' | 'magico';
export type TargetMode = 'primeiro' | 'ultimo' | 'forte' | 'perto';
export type ProjectileKind = 'flecha' | 'bala' | 'gelo' | 'magia' | 'virote';
export type BattlePhase = 'preparando' | 'onda' | 'vitoria' | 'derrota';

export interface GridPoint {
  col: number;
  row: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface SlowEffect {
  factor: number;
  duration: number;
}

export interface TowerLevel {
  cost: number;
  damage: number;
  range: number;
  fireRate: number;
  projectileSpeed: number;
  splashRadius: number;
  armorPierce: number;
  slow: SlowEffect | null;
  magicPierce: number;
  targets: number;
  chain: ChainEffect | null;
  stun: StunEffect | null;
  burn: BurnEffect | null;
  aura: boolean;
  line: boolean;
}

export interface ChainEffect {
  jumps: number;
  radius: number;
  falloff: number;
}

export interface StunEffect {
  duration: number;
  heavySlow: number | null;
}

export interface BurnEffect {
  dps: number;
  duration: number;
}

export interface SpecDef {
  id: SpecChoice;
  name: string;
  description: string;
  cost: number;
  level: TowerLevel;
}

export interface TowerDef {
  id: TowerId;
  name: string;
  description: string;
  damageType: DamageType;
  hitsGround: boolean;
  hitsAir: boolean;
  projectile: ProjectileKind;
  hotkey: string;
  levels: TowerLevel[];
  specs: [SpecDef, SpecDef];
}

export interface EnemyDef {
  id: EnemyId;
  name: string;
  hp: number;
  speed: number;
  armor: number;
  magicResist: number;
  reward: number;
  lifeDamage: number;
  flying: boolean;
  slowImmune: boolean;
  slowResist: number;
  isBoss: boolean;
  size: number;
  ability: EnemyAbility | null;
}

export type EnemyAbility =
  | { kind: 'cura'; radius: number; rate: number; bossRate: number }
  | { kind: 'escudo'; radius: number; reduction: number }
  | { kind: 'divide'; into: EnemyId; count: number; spread: number }
  | { kind: 'invoca'; enemy: EnemyId; count: number; interval: number; behind: number };

export interface WaveGroup {
  enemy: EnemyId;
  count: number;
  interval: number;
  delay: number;
  hpMultiplier: number;
  path?: number;
}

export interface WaveDef {
  groups: WaveGroup[];
  bonus: number;
}

export interface MapDef {
  name: string;
  cols: number;
  rows: number;
  paths: GridPoint[][];
  blocked: GridPoint[];
}

export interface EnemyState {
  uid: number;
  def: EnemyDef;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  distance: number;
  path: number;
  wave: number;
  hpScale: number;
  angle: number;
  shielded: boolean;
  abilityTimer: number;
  slowFactor: number;
  slowTimer: number;
  stunTimer: number;
  burnTimer: number;
  burnDps: number;
  burnTowerUid: number | null;
  alive: boolean;
  leaked: boolean;
}

export interface TowerState {
  uid: number;
  def: TowerDef;
  level: number;
  col: number;
  row: number;
  x: number;
  y: number;
  cooldown: number;
  targetMode: TargetMode;
  targetUid: number | null;
  angle: number;
  totalSpent: number;
  kills: number;
  spec: SpecChoice | null;
  plus: number;
}

export interface ProjectileState {
  uid: number;
  kind: ProjectileKind;
  towerUid: number;
  x: number;
  y: number;
  targetUid: number;
  targetX: number;
  targetY: number;
  speed: number;
  damage: number;
  damageType: DamageType;
  armorPierce: number;
  magicPierce: number;
  splashRadius: number;
  slow: SlowEffect | null;
  stun: StunEffect | null;
  burn: BurnEffect | null;
  line: boolean;
  remaining: number;
  hits: number[];
  hitsGround: boolean;
  hitsAir: boolean;
  angle: number;
  done: boolean;
}

export type BattleEvent =
  | { type: 'enemySpawned'; enemy: EnemyState }
  | { type: 'enemyHit'; enemy: EnemyState; damage: number; damageType: DamageType }
  | { type: 'enemyKilled'; enemy: EnemyState; reward: number; towerUid: number | null }
  | { type: 'enemyLeaked'; enemy: EnemyState; lifeDamage: number }
  | { type: 'enemySlowed'; enemy: EnemyState }
  | { type: 'towerFired'; tower: TowerState; projectile: ProjectileState }
  | { type: 'projectileImpact'; projectile: ProjectileState; x: number; y: number }
  | { type: 'towerBuilt'; tower: TowerState }
  | { type: 'towerUpgraded'; tower: TowerState }
  | { type: 'towerSpecialized'; tower: TowerState }
  | { type: 'towerPlus'; tower: TowerState }
  | { type: 'chainLightning'; tower: TowerState; points: Point[]; uids: number[] }
  | { type: 'enemyStunned'; enemy: EnemyState; duration: number }
  | { type: 'towerSold'; tower: TowerState; refund: number }
  | { type: 'waveStarted'; wave: number }
  | { type: 'waveCleared'; wave: number; bonus: number }
  | { type: 'goldChanged'; gold: number }
  | { type: 'livesChanged'; lives: number }
  | { type: 'enemyHealed'; healer: EnemyState; targets: EnemyState[] }
  | { type: 'enemySplit'; enemy: EnemyState; children: EnemyState[] }
  | { type: 'bossSummon'; boss: EnemyState; summoned: EnemyState[] }
  | { type: 'waveCalledEarly'; wave: number; bonus: number }
  | { type: 'powerCast'; power: PowerId; target: Point | null }
  | { type: 'powerReady'; power: PowerId }
  | { type: 'victory' }
  | { type: 'defeat' };

export type BattleListener = (event: BattleEvent) => void;

export interface BattleOptions {
  map: MapDef;
  towers: Record<TowerId, TowerDef>;
  enemies: Record<EnemyId, EnemyDef>;
  waves: WaveDef[];
  startingGold: number;
  startingLives: number;
  tileSize: number;
  sellRefund: number;
  difficulty?: Difficulty;
  infinite?: boolean;
  infiniteWave?: (waveNumber: number) => WaveDef;
  powers?: Record<PowerId, PowerDef>;
  initial?: BattleSnapshot;
}

export interface PowerDef {
  id: PowerId;
  name: string;
  description: string;
  hotkey: string;
  cooldown: number;
  duration: number;
  needsTarget: boolean;
  damage: number;
  damagePerWave: number;
  armorPierce: number;
  radius: number;
  freezeFactor: number;
  heavyFreezeFactor: number;
  fireRateMultiplier: number;
}

export interface PowerState {
  id: PowerId;
  cooldown: number;
  maxCooldown: number;
  active: number;
}

export interface SavedTower {
  id: TowerId;
  col: number;
  row: number;
  level: number;
  targetMode: TargetMode;
  totalSpent: number;
  kills: number;
  spec: SpecChoice | null;
  plus: number;
}

export interface SavedPower {
  id: PowerId;
  cooldown: number;
}

export interface BattleSnapshot {
  gold: number;
  lives: number;
  waveNumber: number;
  stats: BattleStats;
  towers: SavedTower[];
  powers: SavedPower[];
}

export interface BattleStats {
  kills: number;
  leaked: number;
  goldEarned: number;
  goldSpent: number;
  towersBuilt: number;
  elapsed: number;
  golemsKilled: number;
  bossesKilled: number;
  earlyCalls: number;
  powersUsed: Record<PowerId, number>;
}

export interface BattleApi {
  readonly enemies: readonly EnemyState[];
  readonly towers: readonly TowerState[];
  readonly projectiles: readonly ProjectileState[];
  readonly gold: number;
  readonly lives: number;
  readonly phase: BattlePhase;
  readonly waveNumber: number;
  readonly totalWaves: number;
  readonly stats: BattleStats;
  readonly pathPoints: readonly Point[];
  readonly pathLength: number;
  readonly paths: readonly (readonly Point[])[];
  readonly pathLengths: readonly number[];
  readonly powers: readonly PowerState[];
  readonly infinite: boolean;
  readonly difficulty: Difficulty;
  readonly activeWaves: readonly number[];
  waveDef(waveNumber: number): WaveDef | undefined;
  canCallEarly(): boolean;
  earlyBonus(): number;
  callEarly(): number;
  canCastPower(id: PowerId): boolean;
  castPower(id: PowerId, target?: Point): boolean;
  canBuild(col: number, row: number): boolean;
  canAfford(towerId: TowerId): boolean;
  build(towerId: TowerId, col: number, row: number): TowerState | null;
  upgradeCost(towerUid: number): number | null;
  upgrade(towerUid: number): boolean;
  specCost(towerUid: number, choice: SpecChoice): number | null;
  specialize(towerUid: number, choice: SpecChoice): boolean;
  plusCost(towerUid: number): number | null;
  upgradePlus(towerUid: number): boolean;
  sellValue(towerUid: number): number;
  sell(towerUid: number): number;
  towerAt(col: number, row: number): TowerState | null;
  setTargetMode(towerUid: number, mode: TargetMode): void;
  startNextWave(): boolean;
  update(dt: number): void;
  on(listener: BattleListener): () => void;
}
