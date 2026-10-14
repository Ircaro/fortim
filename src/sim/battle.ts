import type {
  BattleApi,
  BattleEvent,
  BattleListener,
  BattleOptions,
  BattlePhase,
  BattleSnapshot,
  BattleStats,
  BurnEffect,
  DamageType,
  Difficulty,
  EnemyDef,
  EnemyId,
  EnemyState,
  MapDef,
  Point,
  PowerDef,
  PowerId,
  PowerState,
  ProjectileState,
  SpecChoice,
  SpecDef,
  StunEffect,
  TargetMode,
  TowerDef,
  TowerId,
  TowerLevel,
  TowerState,
  WaveDef,
} from '../core/types';
import { MIN_DAMAGE } from '../config';
import { DIFFICULTIES } from '../data/difficulty';
import { POWERS, POWER_ORDER } from '../data/powers';
import { PLUS_COST_FACTOR, PLUS_COST_GROWTH, PLUS_DAMAGE } from '../data/towers';
import { cellKey, inBounds, isBlocked, pathSet, tileCenter } from './grid';

export const SIM_STEP = 1 / 60;
export const TARGET_MODES: TargetMode[] = ['primeiro', 'ultimo', 'forte', 'perto'];
export const HEAL_EVENT_INTERVAL = 0.5;
export const HEAVY_STUN_FACTOR = 0.5;
export const LINE_HIT_RADIUS = 0.4;

export function computeDamage(
  enemy: EnemyDef,
  damage: number,
  damageType: DamageType,
  armorPierce: number,
  magicPierce = 0,
): number {
  return Math.max(MIN_DAMAGE, damage * damageFactor(enemy, damageType, armorPierce, magicPierce));
}

export function damageFactor(enemy: EnemyDef, damageType: DamageType, armorPierce: number, magicPierce = 0): number {
  return damageType === 'fisico'
    ? 1 - Math.max(0, enemy.armor - armorPierce)
    : 1 - Math.max(0, enemy.magicResist - magicPierce);
}

export function canHit(hitsGround: boolean, hitsAir: boolean, enemy: EnemyDef): boolean {
  return enemy.flying ? hitsAir : hitsGround;
}

export function isHeavy(enemy: EnemyDef): boolean {
  return enemy.slowImmune || enemy.isBoss;
}

export function resistedSlow(enemy: EnemyDef, factor: number): number {
  return 1 - (1 - factor) * (1 - enemy.slowResist);
}

export function earlyCallBonus(waveNumber: number): number {
  return Math.round(8 + 2 * waveNumber);
}

export function specOf(def: TowerDef, choice: SpecChoice): SpecDef {
  return def.specs[choice === 'a' ? 0 : 1];
}

export function plusCostFor(def: TowerDef, choice: SpecChoice, plus: number): number {
  return Math.round(specOf(def, choice).cost * PLUS_COST_FACTOR * Math.pow(PLUS_COST_GROWTH, plus));
}

export function towerLevel(tower: Pick<TowerState, 'def' | 'level' | 'spec' | 'plus'>): TowerLevel {
  const base = tower.spec ? specOf(tower.def, tower.spec).level : tower.def.levels[tower.level];
  if (tower.plus <= 0) return base;
  const m = Math.pow(PLUS_DAMAGE, tower.plus);
  return { ...base, damage: base.damage * m, burn: base.burn ? { ...base.burn, dps: base.burn.dps * m } : null };
}

export function emptyStats(): BattleStats {
  return {
    kills: 0,
    leaked: 0,
    goldEarned: 0,
    goldSpent: 0,
    towersBuilt: 0,
    elapsed: 0,
    golemsKilled: 0,
    bossesKilled: 0,
    earlyCalls: 0,
    powersUsed: { flechas: 0, congelar: 0, furia: 0 },
  };
}

export function copyStats(stats: BattleStats): BattleStats {
  return { ...stats, powersUsed: { ...stats.powersUsed } };
}

function segmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = dx * dx + dy * dy;
  const t = len > 0 ? Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len)) : 0;
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

interface Segment {
  from: Point;
  to: Point;
  start: number;
  length: number;
  angle: number;
}

interface ActiveWave {
  number: number;
  def: WaveDef;
  time: number;
  spawned: number[];
}

interface HealPulse {
  timer: number;
  targets: Set<EnemyState>;
}

function buildSegments(points: readonly Point[]): { segments: Segment[]; length: number } {
  const segments: Segment[] = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i];
    const to = points[i + 1];
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    segments.push({ from, to, start: total, length, angle: Math.atan2(to.y - from.y, to.x - from.x) });
    total += length;
  }
  return { segments, length: total };
}

function fallbackInfiniteWave(waves: readonly WaveDef[], waveNumber: number): WaveDef {
  const last = waves[waves.length - 1] ?? { bonus: 0, groups: [] };
  const growth = Math.pow(1.12, waveNumber - waves.length);
  return { bonus: last.bonus, groups: last.groups.map((g) => ({ ...g, hpMultiplier: g.hpMultiplier * growth })) };
}

export class Battle implements BattleApi {
  enemies: EnemyState[] = [];
  towers: TowerState[] = [];
  projectiles: ProjectileState[] = [];
  gold: number;
  lives: number;
  phase: BattlePhase = 'preparando';
  waveNumber = 0;
  totalWaves: number;
  stats: BattleStats = emptyStats();
  pathPoints: Point[] = [];
  pathLength = 0;
  paths: Point[][] = [];
  pathLengths: number[] = [];
  powers: PowerState[];
  readonly infinite: boolean;
  readonly difficulty: Difficulty;

  private readonly map: MapDef;
  private readonly towerDefs: Record<TowerId, TowerDef>;
  private readonly enemyDefs: Record<EnemyId, EnemyDef>;
  private readonly waves: WaveDef[];
  private readonly tileSize: number;
  private readonly sellRefund: number;
  private readonly pathCells: Set<string>;
  private readonly routes: Segment[][] = [];
  private readonly hpMultiplier: number;
  private readonly shieldReduction: number;
  private readonly powerDefs: Record<PowerId, PowerDef>;
  private readonly infiniteWave: (waveNumber: number) => WaveDef;
  private readonly generated = new Map<number, WaveDef>();
  private readonly healPulses = new Map<number, HealPulse>();
  private readonly levelCache = new Map<number, { key: string; level: TowerLevel }>();
  private listeners: BattleListener[] = [];
  private nextUid = 1;
  private active: ActiveWave[] = [];

  constructor(options: BattleOptions) {
    this.map = options.map;
    this.towerDefs = options.towers;
    this.enemyDefs = options.enemies;
    this.waves = options.waves;
    this.tileSize = options.tileSize;
    this.sellRefund = options.sellRefund;
    this.difficulty = options.difficulty ?? 'normal';
    const diff = DIFFICULTIES[this.difficulty];
    this.hpMultiplier = options.difficulty ? diff.hpMultiplier : 1;
    this.gold = options.difficulty ? Math.round(options.startingGold * diff.goldMultiplier) : options.startingGold;
    this.lives = options.difficulty ? diff.lives : options.startingLives;
    this.infinite = options.infinite ?? false;
    this.infiniteWave = options.infiniteWave ?? ((n) => fallbackInfiniteWave(this.waves, n));
    this.totalWaves = options.waves.length;
    this.powerDefs = options.powers ?? POWERS;
    this.powers = POWER_ORDER.map((id) => ({ id, cooldown: 0, maxCooldown: this.powerDefs[id].cooldown, active: 0 }));
    let shield = 0;
    for (const def of Object.values(this.enemyDefs)) {
      if (def.ability?.kind === 'escudo') shield = Math.max(shield, def.ability.reduction);
    }
    this.shieldReduction = shield;
    this.pathCells = pathSet(options.map);
    for (const route of options.map.paths) {
      const points = route.map((w) => tileCenter(w.col, w.row, options.tileSize));
      const built = buildSegments(points);
      this.paths.push(points);
      this.pathLengths.push(built.length);
      this.routes.push(built.segments);
    }
    this.pathPoints = this.paths[0] ?? [];
    this.pathLength = this.pathLengths[0] ?? 0;
    if (options.initial) this.applySnapshot(options.initial);
  }

  get activeWaves(): readonly number[] {
    return this.active.map((w) => w.number);
  }

  private applySnapshot(snapshot: BattleSnapshot): void {
    this.gold = snapshot.gold;
    this.lives = snapshot.lives;
    this.waveNumber = snapshot.waveNumber;
    this.stats = copyStats(snapshot.stats);
    for (const saved of snapshot.towers) {
      const center = tileCenter(saved.col, saved.row, this.tileSize);
      this.towers.push({
        uid: this.uid(),
        def: this.towerDefs[saved.id],
        level: saved.level,
        col: saved.col,
        row: saved.row,
        x: center.x,
        y: center.y,
        cooldown: 0,
        targetMode: saved.targetMode,
        targetUid: null,
        angle: 0,
        totalSpent: saved.totalSpent,
        kills: saved.kills,
        spec: saved.spec,
        plus: saved.plus,
      });
    }
    for (const saved of snapshot.powers) {
      const power = this.powers.find((p) => p.id === saved.id);
      if (power) power.cooldown = Math.min(power.maxCooldown, Math.max(0, saved.cooldown));
    }
  }

  private get ended(): boolean {
    return this.phase === 'vitoria' || this.phase === 'derrota';
  }

  private emit(event: BattleEvent): void {
    for (const listener of this.listeners.slice()) listener(event);
  }

  private uid(): number {
    return this.nextUid++;
  }

  private findTower(towerUid: number): TowerState | undefined {
    return this.towers.find((t) => t.uid === towerUid);
  }

  private levelOf(tower: TowerState): TowerLevel {
    const key = `${tower.level}|${tower.spec ?? ''}|${tower.plus}`;
    const cached = this.levelCache.get(tower.uid);
    if (cached && cached.key === key) return cached.level;
    const level = towerLevel(tower);
    this.levelCache.set(tower.uid, { key, level });
    return level;
  }

  private power(id: PowerId): PowerState {
    return this.powers.find((p) => p.id === id) as PowerState;
  }

  positionAt(distance: number, path = 0): { x: number; y: number; angle: number } {
    const segments = this.routes[path] ?? [];
    if (segments.length === 0) {
      const p = this.paths[path]?.[0] ?? { x: 0, y: 0 };
      return { x: p.x, y: p.y, angle: 0 };
    }
    let seg = segments[segments.length - 1];
    for (const s of segments) {
      if (s.length > 0 && distance < s.start + s.length) {
        seg = s;
        break;
      }
    }
    const t = seg.length > 0 ? Math.min(1, Math.max(0, (distance - seg.start) / seg.length)) : 1;
    return {
      x: seg.from.x + (seg.to.x - seg.from.x) * t,
      y: seg.from.y + (seg.to.y - seg.from.y) * t,
      angle: seg.angle,
    };
  }

  waveDef(waveNumber: number): WaveDef | undefined {
    if (!Number.isInteger(waveNumber) || waveNumber < 1) return undefined;
    if (waveNumber <= this.waves.length) return this.waves[waveNumber - 1];
    if (!this.infinite) return undefined;
    let wave = this.generated.get(waveNumber);
    if (!wave) {
      wave = this.infiniteWave(waveNumber);
      this.generated.set(waveNumber, wave);
    }
    return wave;
  }

  canBuild(col: number, row: number): boolean {
    return (
      inBounds(this.map, col, row) &&
      !this.pathCells.has(cellKey(col, row)) &&
      !isBlocked(this.map, col, row) &&
      this.towerAt(col, row) === null
    );
  }

  canAfford(towerId: TowerId): boolean {
    return this.gold >= this.towerDefs[towerId].levels[0].cost;
  }

  build(towerId: TowerId, col: number, row: number): TowerState | null {
    if (this.ended || !this.canBuild(col, row) || !this.canAfford(towerId)) return null;
    const def = this.towerDefs[towerId];
    const cost = def.levels[0].cost;
    const center = tileCenter(col, row, this.tileSize);
    const tower: TowerState = {
      uid: this.uid(),
      def,
      level: 0,
      col,
      row,
      x: center.x,
      y: center.y,
      cooldown: 0,
      targetMode: 'primeiro',
      targetUid: null,
      angle: 0,
      totalSpent: cost,
      kills: 0,
      spec: null,
      plus: 0,
    };
    this.towers.push(tower);
    this.gold -= cost;
    this.stats.goldSpent += cost;
    this.stats.towersBuilt++;
    this.emit({ type: 'towerBuilt', tower });
    this.emit({ type: 'goldChanged', gold: this.gold });
    return tower;
  }

  upgradeCost(towerUid: number): number | null {
    const tower = this.findTower(towerUid);
    if (!tower) return null;
    const next = tower.def.levels[tower.level + 1];
    return next ? next.cost : null;
  }

  private pay(tower: TowerState, cost: number): void {
    this.gold -= cost;
    tower.totalSpent += cost;
    this.stats.goldSpent += cost;
  }

  upgrade(towerUid: number): boolean {
    if (this.ended) return false;
    const tower = this.findTower(towerUid);
    const cost = this.upgradeCost(towerUid);
    if (!tower || cost === null || this.gold < cost) return false;
    this.pay(tower, cost);
    tower.level++;
    this.emit({ type: 'towerUpgraded', tower });
    this.emit({ type: 'goldChanged', gold: this.gold });
    return true;
  }

  specCost(towerUid: number, choice: SpecChoice): number | null {
    const tower = this.findTower(towerUid);
    if (!tower || tower.spec !== null || tower.level < tower.def.levels.length - 1) return null;
    if (choice !== 'a' && choice !== 'b') return null;
    return specOf(tower.def, choice).cost;
  }

  specialize(towerUid: number, choice: SpecChoice): boolean {
    if (this.ended) return false;
    const tower = this.findTower(towerUid);
    const cost = this.specCost(towerUid, choice);
    if (!tower || cost === null || this.gold < cost) return false;
    this.pay(tower, cost);
    tower.spec = choice;
    tower.cooldown = 0;
    this.emit({ type: 'towerSpecialized', tower });
    this.emit({ type: 'goldChanged', gold: this.gold });
    return true;
  }

  plusCost(towerUid: number): number | null {
    const tower = this.findTower(towerUid);
    if (!tower || tower.spec === null) return null;
    return plusCostFor(tower.def, tower.spec, tower.plus);
  }

  upgradePlus(towerUid: number): boolean {
    if (this.ended) return false;
    const tower = this.findTower(towerUid);
    const cost = this.plusCost(towerUid);
    if (!tower || cost === null || this.gold < cost) return false;
    this.pay(tower, cost);
    tower.plus++;
    this.emit({ type: 'towerPlus', tower });
    this.emit({ type: 'goldChanged', gold: this.gold });
    return true;
  }

  sellValue(towerUid: number): number {
    const tower = this.findTower(towerUid);
    return tower ? Math.floor(tower.totalSpent * this.sellRefund) : 0;
  }

  sell(towerUid: number): number {
    if (this.ended) return 0;
    const tower = this.findTower(towerUid);
    if (!tower) return 0;
    const refund = this.sellValue(towerUid);
    this.towers = this.towers.filter((t) => t !== tower);
    this.levelCache.delete(tower.uid);
    this.gold += refund;
    this.emit({ type: 'towerSold', tower, refund });
    this.emit({ type: 'goldChanged', gold: this.gold });
    return refund;
  }

  towerAt(col: number, row: number): TowerState | null {
    return this.towers.find((t) => t.col === col && t.row === row) ?? null;
  }

  setTargetMode(towerUid: number, mode: TargetMode): void {
    const tower = this.findTower(towerUid);
    if (tower) tower.targetMode = mode;
  }

  private hasNextWave(): boolean {
    return this.infinite || this.waveNumber < this.totalWaves;
  }

  private launchWave(): void {
    this.waveNumber++;
    this.phase = 'onda';
    const def = this.waveDef(this.waveNumber) ?? { bonus: 0, groups: [] };
    this.active.push({ number: this.waveNumber, def, time: 0, spawned: def.groups.map(() => 0) });
    this.emit({ type: 'waveStarted', wave: this.waveNumber });
  }

  startNextWave(): boolean {
    if (this.phase !== 'preparando' || !this.hasNextWave()) return false;
    this.launchWave();
    return true;
  }

  canCallEarly(): boolean {
    if (this.phase !== 'onda' || !this.hasNextWave()) return false;
    const latest = this.active.find((w) => w.number === this.waveNumber);
    return !latest || this.fullySpawned(latest);
  }

  earlyBonus(): number {
    return earlyCallBonus(this.waveNumber + 1);
  }

  callEarly(): number {
    if (!this.canCallEarly()) return 0;
    const bonus = this.earlyBonus();
    this.gold += bonus;
    this.stats.goldEarned += bonus;
    this.stats.earlyCalls++;
    this.launchWave();
    this.emit({ type: 'waveCalledEarly', wave: this.waveNumber, bonus });
    this.emit({ type: 'goldChanged', gold: this.gold });
    return bonus;
  }

  canCastPower(id: PowerId): boolean {
    const power = this.powers.find((p) => p.id === id);
    return !!power && !this.ended && power.cooldown <= 0;
  }

  castPower(id: PowerId, target?: Point): boolean {
    if (!this.canCastPower(id)) return false;
    const def = this.powerDefs[id];
    const valid = !!target && Number.isFinite(target.x) && Number.isFinite(target.y);
    if (def.needsTarget && !valid) return false;
    const power = this.power(id);
    power.cooldown = def.cooldown;
    power.active = def.duration;
    this.stats.powersUsed[id]++;
    const point = def.needsTarget && target ? { x: target.x, y: target.y } : null;
    this.emit({ type: 'powerCast', power: id, target: point });
    if (point && def.damage > 0) this.arrowRain(def, point);
    return true;
  }

  private arrowRain(def: PowerDef, target: Point): void {
    const damage = def.damage * (1 + def.damagePerWave * this.waveNumber);
    const radius = def.radius * this.tileSize;
    for (const enemy of this.enemies.slice()) {
      if (!enemy.alive || enemy.distance <= 0) continue;
      if (Math.hypot(enemy.x - target.x, enemy.y - target.y) > radius) continue;
      this.hurt(enemy, damage, 'fisico', def.armorPierce, 0, null);
    }
  }

  update(dt: number): void {
    if (!(dt > 0) || this.ended) return;
    const steps = Math.max(1, Math.ceil(dt / SIM_STEP - 1e-9));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.step(h);
      if (this.ended) return;
    }
  }

  on(listener: BattleListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private step(h: number): void {
    this.tickPowers(h);
    if (this.phase === 'onda') {
      this.stats.elapsed += h;
      for (const wave of this.active.slice()) {
        wave.time += h;
        this.spawnDue(wave);
      }
    }
    if (!this.moveEnemies(h)) {
      this.cleanup();
      return;
    }
    this.updateStatus(h);
    this.updateAbilities(h);
    this.updateTowers(h);
    this.updateProjectiles(h);
    this.cleanup();
    this.checkWavesCleared();
  }

  private tickPowers(h: number): void {
    for (const power of this.powers) {
      if (power.active > 0) power.active = Math.max(0, power.active - h);
      if (power.cooldown > 0) {
        power.cooldown = Math.max(0, power.cooldown - h);
        if (power.cooldown === 0) this.emit({ type: 'powerReady', power: power.id });
      }
    }
  }

  private fullySpawned(wave: ActiveWave): boolean {
    return wave.def.groups.every((g, i) => wave.spawned[i] >= g.count);
  }

  private spawnDue(wave: ActiveWave): void {
    wave.def.groups.forEach((group, gi) => {
      while (wave.spawned[gi] < group.count && wave.time >= group.delay + wave.spawned[gi] * group.interval) {
        const index = wave.spawned[gi]++;
        const path = this.routeFor(group.path, index);
        this.spawnEnemy(this.enemyDefs[group.enemy], group.hpMultiplier * this.hpMultiplier, path, wave.number, 0);
      }
    });
  }

  private routeFor(path: number | undefined, index: number): number {
    const count = Math.max(1, this.routes.length);
    if (path !== undefined && path >= 0 && path < count) return path;
    return index % count;
  }

  private spawnEnemy(def: EnemyDef, hpScale: number, path: number, wave: number, distance: number): EnemyState {
    const pos = this.positionAt(distance, path);
    const maxHp = Math.max(1, Math.round(def.hp * hpScale));
    const ability = def.ability;
    const enemy: EnemyState = {
      uid: this.uid(),
      def,
      x: pos.x,
      y: pos.y,
      hp: maxHp,
      maxHp,
      distance,
      path,
      wave,
      hpScale,
      angle: pos.angle,
      shielded: false,
      abilityTimer: ability && ability.kind === 'invoca' ? ability.interval : 0,
      slowFactor: 1,
      slowTimer: 0,
      stunTimer: 0,
      burnTimer: 0,
      burnDps: 0,
      burnTowerUid: null,
      alive: true,
      leaked: false,
    };
    this.enemies.push(enemy);
    this.emit({ type: 'enemySpawned', enemy });
    return enemy;
  }

  private freezeFactor(enemy: EnemyDef): number {
    if (this.power('congelar').active <= 0) return 1;
    const def = this.powerDefs.congelar;
    return isHeavy(enemy) ? def.heavyFreezeFactor : def.freezeFactor;
  }

  private moveEnemies(h: number): boolean {
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const factor = enemy.stunTimer > 0 ? 0 : Math.min(enemy.slowFactor, this.freezeFactor(enemy.def));
      enemy.distance += enemy.def.speed * factor * h;
      if (enemy.slowTimer > 0) {
        enemy.slowTimer -= h;
        if (enemy.slowTimer <= 0) {
          enemy.slowTimer = 0;
          enemy.slowFactor = 1;
        }
      }
      const length = this.pathLengths[enemy.path] ?? 0;
      const pos = this.positionAt(Math.min(enemy.distance, length), enemy.path);
      enemy.x = pos.x;
      enemy.y = pos.y;
      enemy.angle = pos.angle;
      if (enemy.distance >= length) {
        enemy.alive = false;
        enemy.leaked = true;
        this.stats.leaked++;
        this.lives = Math.max(0, this.lives - enemy.def.lifeDamage);
        this.emit({ type: 'enemyLeaked', enemy, lifeDamage: enemy.def.lifeDamage });
        this.emit({ type: 'livesChanged', lives: this.lives });
        if (this.lives === 0) {
          this.phase = 'derrota';
          this.active = [];
          this.emit({ type: 'defeat' });
          return false;
        }
      }
    }
    return true;
  }

  private updateStatus(h: number): void {
    for (const enemy of this.enemies.slice()) {
      if (!enemy.alive) continue;
      if (enemy.stunTimer > 0) enemy.stunTimer = Math.max(0, enemy.stunTimer - h);
      if (enemy.burnTimer > 0) {
        const dt = Math.min(h, enemy.burnTimer);
        enemy.burnTimer = Math.max(0, enemy.burnTimer - h);
        const source = enemy.burnTowerUid;
        const dps = enemy.burnDps;
        if (enemy.burnTimer === 0) {
          enemy.burnDps = 0;
          enemy.burnTowerUid = null;
        }
        this.hurtOverTime(enemy, dps * dt, source);
      }
    }
  }

  private updateAbilities(h: number): void {
    const alive = this.enemies.filter((e) => e.alive);
    const shields = alive.filter((e) => e.def.ability?.kind === 'escudo');
    for (const enemy of alive) {
      enemy.shielded = shields.some((s) => {
        const ability = s.def.ability;
        return ability?.kind === 'escudo' && Math.hypot(s.x - enemy.x, s.y - enemy.y) <= ability.radius * this.tileSize;
      });
    }
    const healed = new Set<EnemyState>();
    for (const enemy of alive) {
      const ability = enemy.def.ability;
      if (!ability || !enemy.alive) continue;
      if (ability.kind === 'cura') this.heal(enemy, ability.radius, ability.rate, ability.bossRate, alive, healed, h);
      else if (ability.kind === 'invoca') this.summon(enemy, ability.enemy, ability.count, ability.interval, ability.behind, h);
    }
  }

  private heal(
    healer: EnemyState,
    radius: number,
    rate: number,
    bossRate: number,
    alive: readonly EnemyState[],
    healed: Set<EnemyState>,
    h: number,
  ): void {
    let pulse = this.healPulses.get(healer.uid);
    if (!pulse) {
      pulse = { timer: 0, targets: new Set() };
      this.healPulses.set(healer.uid, pulse);
    }
    pulse.timer = Math.max(0, pulse.timer - h);
    const reach = radius * this.tileSize;
    for (const ally of alive) {
      if (ally === healer || !ally.alive || ally.hp >= ally.maxHp || healed.has(ally)) continue;
      if (Math.hypot(ally.x - healer.x, ally.y - healer.y) > reach) continue;
      const perSecond = ally.def.isBoss ? Math.min(rate, bossRate) : rate;
      ally.hp = Math.min(ally.maxHp, ally.hp + perSecond * ally.maxHp * h);
      healed.add(ally);
      pulse.targets.add(ally);
    }
    if (pulse.timer <= 0 && pulse.targets.size > 0) {
      const targets = [...pulse.targets];
      pulse.targets.clear();
      pulse.timer = HEAL_EVENT_INTERVAL;
      this.emit({ type: 'enemyHealed', healer, targets });
    }
  }

  private summon(boss: EnemyState, enemyId: EnemyId, count: number, interval: number, behind: number, h: number): void {
    boss.abilityTimer -= h;
    if (boss.abilityTimer > 0) return;
    boss.abilityTimer += interval;
    const def = this.enemyDefs[enemyId];
    const summoned: EnemyState[] = [];
    for (let i = 0; i < count; i++) {
      const distance = Math.max(0, boss.distance - behind * this.tileSize * (i + 1));
      summoned.push(this.spawnEnemy(def, boss.hpScale, boss.path, boss.wave, distance));
    }
    this.emit({ type: 'bossSummon', boss, summoned });
  }

  private targetScore(tower: TowerState, enemy: EnemyState, d: number): number {
    switch (tower.targetMode) {
      case 'primeiro':
        return enemy.distance - (this.pathLengths[enemy.path] ?? 0);
      case 'ultimo':
        return (this.pathLengths[enemy.path] ?? 0) - enemy.distance;
      case 'forte':
        return enemy.hp;
      case 'perto':
        return -d;
    }
  }

  private inRange(tower: TowerState, range: number): { enemy: EnemyState; d: number }[] {
    const found: { enemy: EnemyState; d: number }[] = [];
    for (const enemy of this.enemies) {
      if (!enemy.alive || enemy.distance <= 0) continue;
      if (!canHit(tower.def.hitsGround, tower.def.hitsAir, enemy.def)) continue;
      const d = Math.hypot(enemy.x - tower.x, enemy.y - tower.y);
      if (d <= range) found.push({ enemy, d });
    }
    return found;
  }

  private pickTargets(tower: TowerState, level: TowerLevel): EnemyState[] {
    const scored = this.inRange(tower, level.range).map(({ enemy, d }) => ({ enemy, score: this.targetScore(tower, enemy, d) }));
    if (level.targets <= 1) {
      let best: { enemy: EnemyState; score: number } | null = null;
      for (const s of scored) if (best === null || s.score > best.score) best = s;
      return best ? [best.enemy] : [];
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, level.targets).map((s) => s.enemy);
  }

  private updateTowers(h: number): void {
    const rate = this.power('furia').active > 0 ? this.powerDefs.furia.fireRateMultiplier : 1;
    for (const tower of this.towers) {
      const level = this.levelOf(tower);
      if (level.aura) {
        this.pulseAura(tower, level, h * rate);
        continue;
      }
      const targets = this.pickTargets(tower, level);
      const target = targets[0] ?? null;
      tower.targetUid = target ? target.uid : null;
      if (tower.cooldown > 0) tower.cooldown -= h * rate;
      if (!target) {
        tower.cooldown = Math.max(tower.cooldown, 0);
        continue;
      }
      tower.angle = Math.atan2(target.y - tower.y, target.x - tower.x);
      if (tower.cooldown <= 0) {
        if (level.chain) this.fireChain(tower, level, target);
        else for (const t of targets) this.fire(tower, level, t);
        tower.cooldown += 1 / level.fireRate;
      }
    }
  }

  private pulseAura(tower: TowerState, level: TowerLevel, h: number): void {
    const found = this.inRange(tower, level.range);
    tower.targetUid = found[0]?.enemy.uid ?? null;
    for (const { enemy } of found) {
      if (!enemy.alive) continue;
      if (level.slow) this.applySlow(enemy, level.slow.factor, level.slow.duration, false);
      const amount = level.damage * h * damageFactor(enemy.def, tower.def.damageType, level.armorPierce, level.magicPierce);
      this.hurtOverTime(enemy, amount, tower.uid);
    }
  }

  private fireChain(tower: TowerState, level: TowerLevel, first: EnemyState): void {
    const chain = level.chain;
    if (!chain) return;
    const points: Point[] = [{ x: tower.x, y: tower.y }];
    const uids: number[] = [];
    const reach = chain.radius * this.tileSize;
    let damage = level.damage;
    let current: EnemyState | null = first;
    for (let i = 0; i <= chain.jumps && current; i++) {
      const at = { x: current.x, y: current.y };
      points.push(at);
      uids.push(current.uid);
      this.strike(current, level, tower, damage);
      damage *= 1 - chain.falloff;
      let next: EnemyState | null = null;
      let nearest = Infinity;
      for (const enemy of this.enemies) {
        if (!enemy.alive || enemy.distance <= 0 || uids.includes(enemy.uid)) continue;
        if (!canHit(tower.def.hitsGround, tower.def.hitsAir, enemy.def)) continue;
        const d = Math.hypot(enemy.x - at.x, enemy.y - at.y);
        if (d <= reach && d < nearest) {
          nearest = d;
          next = enemy;
        }
      }
      current = next;
    }
    this.emit({ type: 'chainLightning', tower, points, uids });
  }

  private fire(tower: TowerState, level: TowerLevel, target: EnemyState): void {
    const angle = Math.atan2(target.y - tower.y, target.x - tower.x);
    const projectile: ProjectileState = {
      uid: this.uid(),
      kind: tower.def.projectile,
      towerUid: tower.uid,
      x: tower.x,
      y: tower.y,
      targetUid: target.uid,
      targetX: level.line ? tower.x + Math.cos(angle) * level.range : target.x,
      targetY: level.line ? tower.y + Math.sin(angle) * level.range : target.y,
      speed: level.projectileSpeed,
      damage: level.damage,
      damageType: tower.def.damageType,
      armorPierce: level.armorPierce,
      magicPierce: level.magicPierce,
      splashRadius: level.splashRadius,
      slow: level.slow,
      stun: level.stun,
      burn: level.burn,
      line: level.line,
      remaining: level.range,
      hits: [],
      hitsGround: tower.def.hitsGround,
      hitsAir: tower.def.hitsAir,
      angle,
      done: false,
    };
    this.projectiles.push(projectile);
    this.emit({ type: 'towerFired', tower, projectile });
  }

  private aliveEnemy(uid: number): EnemyState | undefined {
    return this.enemies.find((e) => e.uid === uid && e.alive);
  }

  private updateProjectiles(h: number): void {
    for (const p of this.projectiles) {
      if (p.done) continue;
      if (p.line) {
        this.moveLine(p, h);
        continue;
      }
      const target = this.aliveEnemy(p.targetUid);
      if (target) {
        p.targetX = target.x;
        p.targetY = target.y;
      }
      const dx = p.targetX - p.x;
      const dy = p.targetY - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0) p.angle = Math.atan2(dy, dx);
      const travel = p.speed * h;
      if (dist <= travel) {
        p.x = p.targetX;
        p.y = p.targetY;
        this.impact(p);
      } else {
        p.x += (dx / dist) * travel;
        p.y += (dy / dist) * travel;
      }
    }
  }

  private moveLine(p: ProjectileState, h: number): void {
    const travel = Math.min(p.remaining, p.speed * h);
    const from = { x: p.x, y: p.y };
    p.x += Math.cos(p.angle) * travel;
    p.y += Math.sin(p.angle) * travel;
    p.remaining -= travel;
    const reach = LINE_HIT_RADIUS * this.tileSize;
    for (const enemy of this.enemies.slice()) {
      if (!enemy.alive || enemy.distance <= 0 || p.hits.includes(enemy.uid)) continue;
      if (!canHit(p.hitsGround, p.hitsAir, enemy.def)) continue;
      if (segmentDistance(enemy, from, p) > reach) continue;
      p.hits.push(enemy.uid);
      this.damageEnemy(enemy, p);
    }
    if (p.remaining <= 0) {
      p.done = true;
      this.emit({ type: 'projectileImpact', projectile: p, x: p.x, y: p.y });
    }
  }

  private impact(p: ProjectileState): void {
    p.done = true;
    if (p.splashRadius > 0) {
      for (const enemy of this.enemies.slice()) {
        if (!enemy.alive || !canHit(p.hitsGround, p.hitsAir, enemy.def)) continue;
        if (Math.hypot(enemy.x - p.x, enemy.y - p.y) <= p.splashRadius) this.damageEnemy(enemy, p);
      }
    } else {
      const target = this.aliveEnemy(p.targetUid);
      if (target) this.damageEnemy(target, p);
    }
    this.emit({ type: 'projectileImpact', projectile: p, x: p.x, y: p.y });
  }

  private applySlow(enemy: EnemyState, factor: number, duration: number, notify: boolean): void {
    if (enemy.def.slowImmune) return;
    enemy.slowFactor = Math.min(enemy.slowFactor, resistedSlow(enemy.def, factor));
    enemy.slowTimer = Math.max(enemy.slowTimer, duration);
    if (notify) this.emit({ type: 'enemySlowed', enemy });
  }

  private applyStun(enemy: EnemyState, stun: StunEffect): void {
    if (isHeavy(enemy.def)) {
      if (stun.heavySlow !== null) {
        enemy.slowFactor = Math.min(enemy.slowFactor, stun.heavySlow);
        enemy.slowTimer = Math.max(enemy.slowTimer, stun.duration);
        this.emit({ type: 'enemySlowed', enemy });
        return;
      }
      enemy.stunTimer = Math.max(enemy.stunTimer, stun.duration * HEAVY_STUN_FACTOR);
      this.emit({ type: 'enemyStunned', enemy, duration: stun.duration * HEAVY_STUN_FACTOR });
      return;
    }
    enemy.stunTimer = Math.max(enemy.stunTimer, stun.duration);
    this.emit({ type: 'enemyStunned', enemy, duration: stun.duration });
  }

  private applyBurn(enemy: EnemyState, burn: BurnEffect, factor: number, towerUid: number): void {
    const dps = burn.dps * factor;
    if (dps >= enemy.burnDps || enemy.burnTimer <= 0) {
      enemy.burnDps = dps;
      enemy.burnTowerUid = towerUid;
    }
    enemy.burnTimer = Math.max(enemy.burnTimer, burn.duration);
  }

  private strike(enemy: EnemyState, level: TowerLevel, tower: TowerState, damage: number): void {
    if (level.slow) this.applySlow(enemy, level.slow.factor, level.slow.duration, true);
    if (level.stun) this.applyStun(enemy, level.stun);
    if (level.burn) this.applyBurn(enemy, level.burn, damageFactor(enemy.def, tower.def.damageType, level.armorPierce, level.magicPierce), tower.uid);
    this.hurt(enemy, damage, tower.def.damageType, level.armorPierce, level.magicPierce, tower.uid);
  }

  private damageEnemy(enemy: EnemyState, p: ProjectileState): void {
    if (p.slow) this.applySlow(enemy, p.slow.factor, p.slow.duration, true);
    if (p.stun) this.applyStun(enemy, p.stun);
    if (p.burn) this.applyBurn(enemy, p.burn, damageFactor(enemy.def, p.damageType, p.armorPierce, p.magicPierce), p.towerUid);
    this.hurt(enemy, p.damage, p.damageType, p.armorPierce, p.magicPierce, p.towerUid);
  }

  private hurt(enemy: EnemyState, base: number, damageType: DamageType, armorPierce: number, magicPierce: number, towerUid: number | null): void {
    if (!enemy.alive) return;
    const raw = computeDamage(enemy.def, base, damageType, armorPierce, magicPierce);
    const damage = Math.max(MIN_DAMAGE, enemy.shielded ? raw * (1 - this.shieldReduction) : raw);
    enemy.hp -= damage;
    this.emit({ type: 'enemyHit', enemy, damage, damageType });
    if (enemy.hp <= 0) this.kill(enemy, towerUid);
  }

  private hurtOverTime(enemy: EnemyState, amount: number, towerUid: number | null): void {
    if (!enemy.alive || !(amount > 0)) return;
    enemy.hp -= enemy.shielded ? amount * (1 - this.shieldReduction) : amount;
    if (enemy.hp <= 0) this.kill(enemy, towerUid);
  }

  private kill(enemy: EnemyState, towerUid: number | null): void {
    enemy.hp = 0;
    enemy.alive = false;
    const reward = enemy.def.reward;
    this.gold += reward;
    this.stats.goldEarned += reward;
    this.stats.kills++;
    if (enemy.def.id === 'golem') this.stats.golemsKilled++;
    if (enemy.def.isBoss) this.stats.bossesKilled++;
    const tower = towerUid === null ? undefined : this.findTower(towerUid);
    if (tower) tower.kills++;
    this.emit({ type: 'enemyKilled', enemy, reward, towerUid });
    this.emit({ type: 'goldChanged', gold: this.gold });
    const ability = enemy.def.ability;
    if (ability?.kind === 'divide') this.split(enemy, ability.into, ability.count, ability.spread);
  }

  private split(parent: EnemyState, into: EnemyId, count: number, spread: number): void {
    const def = this.enemyDefs[into];
    const children: EnemyState[] = [];
    const length = this.pathLengths[parent.path] ?? 0;
    for (let i = 0; i < count; i++) {
      const offset = count > 1 ? (i / (count - 1) - 0.5) * 2 * spread * this.tileSize : 0;
      const distance = Math.min(Math.max(0, length - 1e-6), Math.max(0, parent.distance + offset));
      children.push(this.spawnEnemy(def, parent.hpScale, parent.path, parent.wave, distance));
    }
    this.emit({ type: 'enemySplit', enemy: parent, children });
  }

  private cleanup(): void {
    if (this.enemies.some((e) => !e.alive)) {
      for (const e of this.enemies) if (!e.alive) this.healPulses.delete(e.uid);
      this.enemies = this.enemies.filter((e) => e.alive);
    }
    if (this.projectiles.some((p) => p.done)) this.projectiles = this.projectiles.filter((p) => !p.done);
  }

  private checkWavesCleared(): void {
    if (this.phase !== 'onda') return;
    for (const wave of this.active.slice()) {
      if (!this.fullySpawned(wave)) continue;
      if (this.enemies.some((e) => e.alive && e.wave === wave.number)) continue;
      this.active = this.active.filter((w) => w !== wave);
      const bonus = wave.def.bonus;
      this.gold += bonus;
      this.stats.goldEarned += bonus;
      this.emit({ type: 'waveCleared', wave: wave.number, bonus });
      this.emit({ type: 'goldChanged', gold: this.gold });
    }
    if (this.active.length > 0) return;
    if (!this.infinite && this.waveNumber >= this.totalWaves) {
      this.phase = 'vitoria';
      this.emit({ type: 'victory' });
    } else {
      this.phase = 'preparando';
    }
  }
}
