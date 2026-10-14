import type {
  BattlePhase,
  Difficulty,
  EnemyDef,
  EnemyId,
  GridPoint,
  MapDef,
  Point,
  SpecChoice,
  TowerDef,
  TowerId,
  TowerLevel,
  TowerState,
  WaveDef,
} from '../core/types';
import { TILE } from '../config';
import { ENEMIES } from '../data/enemies';
import { MAP } from '../data/map';
import { stageById } from '../data/stages';
import type { StageDef } from '../data/stages';
import { TOWERS } from '../data/towers';
import { WAVES } from '../data/waves';
import { computeDamage, canHit, specOf, towerLevel } from './battle';
import type { Battle } from './battle';
import { cellKey, pathSet } from './grid';
import { createDefaultBattle, createStageBattle } from './index';

export type BotId = 'bom' | 'mediano' | 'ingenuo';

export const BOT_IDS: BotId[] = ['bom', 'mediano', 'ingenuo'];

export const AUTOPLAY_STEP = 1 / 30;

const MAX_WAVE_TIME = 600;
const SAMPLE_SPACING = 8;
const LOOKAHEAD_WEIGHT = 0.6;
const SLOW_WEIGHT = 0.3;
const DEFICIT_FLOOR = 0.3;
const SETTLE_RATIO = 0.5;
const MAX_ROLE_TOWERS = 3;
const GOLEMS_PER_BALLISTA = 2;
const ORCS_PER_MAGE = 4;
const FLYER_ALERT = 8;
const MIN_ANTI_AIR = 3;
const BOSS_BALLISTAS = 2;
const PLUS_RESERVE = 400;
const COVERAGE_TIEBREAK = 4;
const HEAVY_HITTERS: TowerId[] = ['balista', 'mago'];
const SPEC_CHOICES: SpecChoice[] = ['a', 'b'];

export interface BotContext {
  map: MapDef;
  towers: Record<TowerId, TowerDef>;
  enemies: Record<EnemyId, EnemyDef>;
  waves: WaveDef[];
  tileSize: number;
}

export interface Bot {
  readonly id: BotId;
  prepare(battle: Battle): void;
}

export interface WaveReport {
  wave: number;
  lives: number;
  gold: number;
  towers: number;
}

export interface BotTower {
  id: TowerId;
  level: number;
  col: number;
  row: number;
  kills: number;
  spec: SpecChoice | null;
  plus: number;
}

export interface BotRun {
  bot: BotId;
  phase: BattlePhase;
  victory: boolean;
  finalLives: number;
  lastWave: number;
  waves: WaveReport[];
  towers: BotTower[];
}

export interface RunOptions {
  seed?: number;
  stage?: StageDef | string;
  difficulty?: Difficulty;
  createBattle?: () => Battle;
  context?: Partial<BotContext>;
}

interface Threat {
  enemy: EnemyDef;
  hp: number;
  spacing: number;
  interval: number;
  walk: number;
  weight: number;
  route: number;
}

interface Candidate {
  value: number;
  cost: number;
  apply: () => boolean;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function resolveContext(context: Partial<BotContext> = {}): BotContext {
  return { map: MAP, towers: TOWERS, enemies: ENEMIES, waves: WAVES, tileSize: TILE, ...context };
}

export function pathSamples(battle: Battle, spacing = SAMPLE_SPACING): Point[] {
  return routeSamples(battle, spacing).flat();
}

export function routeSamples(battle: Battle, spacing = SAMPLE_SPACING): Point[][] {
  return battle.pathLengths.map((length, path) => {
    const samples: Point[] = [];
    for (let d = 0; d <= length; d += spacing) {
      const p = battle.positionAt(d, path);
      samples.push({ x: p.x, y: p.y });
    }
    return samples;
  });
}

export function buildableCells(battle: Battle, map: MapDef): GridPoint[] {
  const cells: GridPoint[] = [];
  for (let row = 0; row < map.rows; row++) {
    for (let col = 0; col < map.cols; col++) {
      if (battle.canBuild(col, row)) cells.push({ col, row });
    }
  }
  return cells;
}

export function roadsideCells(battle: Battle, map: MapDef): GridPoint[] {
  const road = pathSet(map);
  return buildableCells(battle, map).filter(({ col, row }) => {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (road.has(cellKey(col + dc, row + dr))) return true;
      }
    }
    return false;
  });
}

function cellCenter(ctx: BotContext, cell: GridPoint): Point {
  return { x: cell.col * ctx.tileSize + ctx.tileSize / 2, y: cell.row * ctx.tileSize + ctx.tileSize / 2 };
}

export function coverage(samples: readonly Point[], center: Point, range: number): number {
  let n = 0;
  for (const s of samples) {
    if (Math.hypot(s.x - center.x, s.y - center.y) <= range) n++;
  }
  return n / Math.max(1, samples.length);
}

class Field {
  private readonly cache = new Map<string, number[]>();

  constructor(
    readonly routes: Point[][],
    private readonly ctx: BotContext,
  ) {}

  covAt(point: Point, range: number): number[] {
    const key = point.x + ',' + point.y + ',' + range;
    let cov = this.cache.get(key);
    if (!cov) {
      cov = this.routes.map((samples) => coverage(samples, point, range));
      this.cache.set(key, cov);
    }
    return cov;
  }

  covCell(cell: GridPoint, range: number): number[] {
    return this.covAt(cellCenter(this.ctx, cell), range);
  }
}

function towersOf(battle: Battle, id: TowerId): TowerState[] {
  return battle.towers.filter((t) => t.def.id === id);
}

function routeLoad(battle: Battle, field: Field): number[] {
  const load = field.routes.map(() => 0);
  for (const t of battle.towers) {
    const cov = field.covAt(t, towerLevel(t).range);
    cov.forEach((c, i) => (load[i] += c));
  }
  return load;
}

function balancedCell(battle: Battle, ctx: BotContext, field: Field, range: number): GridPoint | null {
  const load = routeLoad(battle, field);
  let best: { cell: GridPoint; value: number } | null = null;
  for (const cell of buildableCells(battle, ctx.map)) {
    const cov = field.covCell(cell, range);
    const value = cov.reduce((sum, c, i) => sum + c / (1 + 4 * load[i]), 0);
    if (!best || value > best.value) best = { cell, value };
  }
  return best && best.value > 0 ? best.cell : null;
}

function buildBalanced(battle: Battle, ctx: BotContext, field: Field, id: TowerId): boolean {
  if (!battle.canAfford(id)) return false;
  const cell = balancedCell(battle, ctx, field, ctx.towers[id].levels[0].range);
  return cell !== null && battle.build(id, cell.col, cell.row) !== null;
}

function threatsFor(ctx: BotContext, waveIndex: number, battle: Battle): Threat[] {
  const threats: Threat[] = [];
  const routes = Math.max(1, battle.paths.length);
  const add = (wave: WaveDef | undefined, factor: number) => {
    if (!wave) return;
    const total = wave.groups.reduce((sum, g) => sum + g.count * ctx.enemies[g.enemy].lifeDamage, 0);
    for (const g of wave.groups) {
      const enemy = ctx.enemies[g.enemy];
      const targets = g.path === undefined ? Array.from({ length: Math.min(routes, g.count) }, (_, i) => i) : [g.path];
      const per = g.count / targets.length;
      for (const route of targets) {
        const interval = per > 1 ? Math.max(g.interval, 0.05) * targets.length : Infinity;
        threats.push({
          enemy,
          hp: enemy.hp * g.hpMultiplier,
          spacing: enemy.speed * interval,
          interval,
          walk: (battle.pathLengths[route] ?? battle.pathLength) / Math.max(1, enemy.speed),
          weight: (factor * per * enemy.lifeDamage) / Math.max(1, total),
          route,
        });
      }
    }
  };
  add(ctx.waves[waveIndex], 1);
  add(ctx.waves[waveIndex + 1], LOOKAHEAD_WEIGHT);
  return threats;
}

function crowdHits(radius: number, spacing: number, cap: number): number {
  if (radius <= 0 || !Number.isFinite(spacing)) return 1;
  return Math.min(cap, 1 + (2 * Math.max(0, radius - spacing / 2)) / spacing);
}

function hitsPerShot(level: TowerLevel, t: Threat, tileSize: number): number {
  if (level.chain) {
    const reach = level.chain.radius * tileSize;
    if (!Number.isFinite(t.spacing) || t.spacing > reach) return 1;
    const jumps = Math.min(level.chain.jumps, Math.floor(reach / Math.max(1, t.spacing)));
    let total = 0;
    let factor = 1;
    for (let i = 0; i <= jumps; i++) {
      total += factor;
      factor *= 1 - level.chain.falloff;
    }
    return total;
  }
  if (level.aura) return crowdHits(level.range, t.spacing, 6);
  if (level.line) return crowdHits(level.range / 2, t.spacing, 4);
  if (level.targets > 1) return crowdHits(level.range / 2, t.spacing, level.targets);
  return crowdHits(level.splashRadius, t.spacing, 5);
}

function threatDps(def: TowerDef, level: TowerLevel, t: Threat, tileSize: number): number {
  if (!canHit(def.hitsGround, def.hitsAir, t.enemy)) return 0;
  const shot = computeDamage(t.enemy, level.damage, def.damageType, level.armorPierce, level.magicPierce);
  const burn = level.burn ? level.burn.dps * level.burn.duration * 0.5 * (shot / Math.max(1, level.damage)) : 0;
  const dmg = Math.min(t.hp, shot + burn);
  const rate = level.aura ? 1 : level.fireRate;
  return rate * dmg * hitsPerShot(level, t, tileSize);
}

function share(def: TowerDef, level: TowerLevel, cov: readonly number[], t: Threat, tileSize: number): number {
  const c = cov[t.route] ?? 0;
  if (c <= 0) return 0;
  return (threatDps(def, level, t, tileSize) * Math.min(c * t.walk, t.interval)) / Math.max(1, t.hp);
}

function score(def: TowerDef, level: TowerLevel, cov: readonly number[], threats: readonly Threat[], team: readonly number[], slowers: number, tileSize: number): number {
  let total = 0;
  threats.forEach((t, i) => {
    let gain = share(def, level, cov, t, tileSize);
    const c = cov[t.route] ?? 0;
    if (level.slow && !t.enemy.slowImmune && c > 0) {
      const uptime = level.aura ? 1 : Math.min(1, level.fireRate * level.slow.duration);
      gain += (SLOW_WEIGHT * team[i] * (1 / level.slow.factor - 1) * uptime * c) / (1 + slowers);
    }
    total += (t.weight * gain) / (team[i] + DEFICIT_FLOOR);
  });
  return total;
}

function peakCount(ctx: BotContext, waveIndex: number, enemy: EnemyId): number {
  return Math.max(countEnemies(ctx.waves[waveIndex], enemy), countEnemies(ctx.waves[waveIndex + 1], enemy));
}

function countEnemies(wave: WaveDef | undefined, enemy: EnemyId): number {
  return wave ? wave.groups.filter((g) => g.enemy === enemy).reduce((sum, g) => sum + g.count, 0) : 0;
}

function roleFloors(ctx: BotContext, waveIndex: number): [TowerId, number][] {
  const golems = peakCount(ctx, waveIndex, 'golem');
  const bosses = peakCount(ctx, waveIndex, 'rei');
  const armored = peakCount(ctx, waveIndex, 'orc') + peakCount(ctx, waveIndex, 'escudeiro');
  const flyers = countEnemies(ctx.waves[waveIndex], 'morcego');
  const ballistas = Math.max(Math.ceil(golems / GOLEMS_PER_BALLISTA), bosses > 0 ? BOSS_BALLISTAS : 0);
  return [
    ['balista', Math.min(MAX_ROLE_TOWERS, ballistas)],
    ['mago', Math.min(MAX_ROLE_TOWERS, Math.ceil(armored / ORCS_PER_MAGE))],
    ['arqueiro', flyers >= FLYER_ALERT ? MIN_ANTI_AIR : 0],
  ];
}

function bestSpot(
  battle: Battle,
  ctx: BotContext,
  field: Field,
  def: TowerDef,
  threats: readonly Threat[],
  team: readonly number[],
  slowers: number,
): { cell: GridPoint; value: number } | null {
  const level = def.levels[0];
  const weights = field.routes.map(() => 0);
  for (const t of threats) weights[t.route] += t.weight;
  const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;
  let best: { cell: GridPoint; value: number; rank: number } | null = null;
  for (const cell of buildableCells(battle, ctx.map)) {
    const cov = field.covCell(cell, level.range);
    const value = score(def, level, cov, threats, team, slowers, ctx.tileSize);
    const spread = cov.reduce((sum, c, i) => sum + (c * weights[i]) / totalWeight, 0);
    const rank = value * (1 + COVERAGE_TIEBREAK * spread);
    if (!best || rank > best.rank) best = { cell, value, rank };
  }
  return best;
}

function spendWisely(battle: Battle, ctx: BotContext, field: Field): void {
  const threats = threatsFor(ctx, battle.waveNumber, battle);
  const tile = ctx.tileSize;
  const covOf = (t: TowerState, level: TowerLevel) => field.covAt(t, level.range);
  const assess = (): { team: number[]; slowers: number } => {
    const team = threats.map(() => 0);
    for (const t of battle.towers) {
      const level = towerLevel(t);
      const cov = covOf(t, level);
      threats.forEach((th, i) => (team[i] += share(t.def, level, cov, th, tile)));
    }
    return { team, slowers: battle.towers.filter((t) => towerLevel(t).slow).length };
  };
  for (const [id, wanted] of roleFloors(ctx, battle.waveNumber)) {
    while (towersOf(battle, id).length < wanted) {
      if (!battle.canAfford(id)) return;
      const { team, slowers } = assess();
      const spot = bestSpot(battle, ctx, field, ctx.towers[id], threats, team, slowers);
      if (!spot || battle.build(id, spot.cell.col, spot.cell.row) === null) return;
    }
  }
  for (let guard = 0; guard < 200; guard++) {
    const { team, slowers } = assess();
    const candidates: Candidate[] = [];
    for (const id of Object.keys(ctx.towers) as TowerId[]) {
      const def = ctx.towers[id];
      const level = def.levels[0];
      const spot = bestSpot(battle, ctx, field, def, threats, team, slowers);
      if (!spot) continue;
      candidates.push({ value: spot.value / level.cost, cost: level.cost, apply: () => battle.build(id, spot.cell.col, spot.cell.row) !== null });
    }
    for (const tower of battle.towers) {
      const cur = towerLevel(tower);
      const others = cur.slow ? slowers - 1 : slowers;
      const base = score(tower.def, cur, covOf(tower, cur), threats, team, others, tile);
      const cost = battle.upgradeCost(tower.uid);
      if (cost !== null) {
        const next = tower.def.levels[tower.level + 1];
        const gain = score(tower.def, next, covOf(tower, next), threats, team, others, tile) - base;
        candidates.push({ value: gain / cost, cost, apply: () => battle.upgrade(tower.uid) });
      }
      for (const choice of SPEC_CHOICES) {
        const specCost = battle.specCost(tower.uid, choice);
        if (specCost === null || specCost > battle.gold) continue;
        const next = specOf(tower.def, choice).level;
        const gain = score(tower.def, next, covOf(tower, next), threats, team, others, tile) - base;
        candidates.push({ value: gain / specCost, cost: specCost, apply: () => battle.specialize(tower.uid, choice) });
      }
    }
    if (candidates.length === 0) return;
    candidates.sort((a, b) => b.value - a.value);
    const best = candidates[0];
    const choice = best.cost <= battle.gold ? best : candidates.find((c) => c.cost <= battle.gold && c.value >= best.value * SETTLE_RATIO);
    if (!choice || !choice.apply()) return;
  }
}

function spendLeftovers(battle: Battle): void {
  for (let guard = 0; guard < 50; guard++) {
    const ranked = battle.towers.filter((t) => t.spec !== null).sort((a, b) => b.kills - a.kills);
    const tower = ranked.find((t) => {
      const cost = battle.plusCost(t.uid);
      return cost !== null && battle.gold - cost >= PLUS_RESERVE;
    });
    if (!tower || !battle.upgradePlus(tower.uid)) return;
  }
}

function createGoodBot(ctx: BotContext): Bot {
  let field: Field | null = null;
  return {
    id: 'bom',
    prepare(battle) {
      field ??= new Field(routeSamples(battle), ctx);
      spendWisely(battle, ctx, field);
      spendLeftovers(battle);
      for (const tower of battle.towers) {
        if (HEAVY_HITTERS.includes(tower.def.id)) battle.setTargetMode(tower.uid, 'forte');
      }
    },
  };
}

function createMediumBot(ctx: BotContext): Bot {
  let field: Field | null = null;
  let wave = 0;
  return {
    id: 'mediano',
    prepare(battle) {
      field ??= new Field(routeSamples(battle), ctx);
      wave++;
      if (wave % 4 === 0) {
        const archers = towersOf(battle, 'arqueiro').filter((t) => t.level === 0);
        if (archers.length > 0) battle.upgrade(archers[0].uid);
      }
      for (;;) {
        const archers = towersOf(battle, 'arqueiro').length;
        const cannons = towersOf(battle, 'canhao').length;
        const next: TowerId = archers >= 2 * (cannons + 1) ? 'canhao' : 'arqueiro';
        if (!buildBalanced(battle, ctx, field, next)) return;
      }
    },
  };
}

function createNaiveBot(ctx: BotContext, seed: number): Bot {
  const rand = mulberry32(seed);
  return {
    id: 'ingenuo',
    prepare(battle) {
      while (battle.canAfford('arqueiro')) {
        const cells = roadsideCells(battle, ctx.map);
        if (cells.length === 0) return;
        const cell = cells[Math.floor(rand() * cells.length)];
        if (!battle.build('arqueiro', cell.col, cell.row)) return;
      }
    },
  };
}

export function createBot(id: BotId, context: Partial<BotContext> = {}, seed = 7): Bot {
  const ctx = resolveContext(context);
  switch (id) {
    case 'bom':
      return createGoodBot(ctx);
    case 'mediano':
      return createMediumBot(ctx);
    case 'ingenuo':
      return createNaiveBot(ctx, seed);
  }
}

function resolveStage(stage: StageDef | string | undefined): StageDef | undefined {
  return typeof stage === 'string' ? stageById(stage) : stage;
}

export function runBot(id: BotId, options: RunOptions = {}): BotRun {
  const stage = resolveStage(options.stage);
  const battle = options.createBattle
    ? options.createBattle()
    : stage || options.difficulty
      ? createStageBattle(stage ?? 'vale', { difficulty: options.difficulty ?? 'normal' })
      : createDefaultBattle();
  const context: Partial<BotContext> = stage ? { map: stage.map, waves: stage.waves, ...options.context } : { ...options.context };
  const bot = createBot(id, context, options.seed);
  const waves: WaveReport[] = [];
  const phase = (): BattlePhase => battle.phase;
  while (phase() === 'preparando') {
    bot.prepare(battle);
    if (!battle.startNextWave()) break;
    let t = 0;
    while (phase() === 'onda' && t < MAX_WAVE_TIME) {
      battle.update(AUTOPLAY_STEP);
      t += AUTOPLAY_STEP;
    }
    waves.push({ wave: battle.waveNumber, lives: battle.lives, gold: battle.gold, towers: battle.towers.length });
    if (phase() === 'onda') break;
  }
  return {
    bot: id,
    phase: battle.phase,
    victory: battle.phase === 'vitoria',
    finalLives: battle.lives,
    lastWave: battle.waveNumber,
    waves,
    towers: battle.towers.map((t) => ({ id: t.def.id, level: t.level, col: t.col, row: t.row, kills: t.kills, spec: t.spec, plus: t.plus })),
  };
}
