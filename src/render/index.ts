import type { BattleApi, BattleEvent, EnemyId, EnemyState, GridPoint, Point, ProjectileKind, SpecChoice, TowerId, TowerLevel, TowerState } from '../core/types';
import type { Ghost, PowerAim, RendererApi, ScreenPoint } from '../core/view';
import { TILE } from '../config';
import { POWERS } from '../data/powers';
import { STAGES } from '../data/stages';
import type { StageDef } from '../data/stages';
import { TOWERS } from '../data/towers';
import { towerLevel } from '../sim/battle';
import { fontFamily, palette } from '../theme';
import type { Palette } from '../theme';
import { MAP_RADIUS, paintBackground, paintBridge } from './background';
import {
  C_BAD,
  C_DUST,
  C_ENEMY,
  C_GOLD,
  C_PORTAL,
  C_TOWER,
  EffectPool,
  FX_BIT,
  FX_DUST,
  FX_PLUS,
  FX_SPARK,
  FX_STAR,
  MAX_BOLT_POINTS,
} from './effects';
import {
  WORLD_HEIGHT,
  WORLD_WIDTH,
  backingSize,
  bridgeCells,
  cellAtPoint,
  cellCenter,
  clampDpr,
  computeLayout,
  easeOutBack,
  lerpAngle,
  portalPoint,
  worldPointAt,
} from './geometry';
import type { Layout } from './geometry';
import {
  circlePath,
  drawArrowDown,
  drawBurn,
  drawEnemyShape,
  drawFrozen,
  drawLevelMarks,
  drawPlusBadge,
  drawShieldOutline,
  drawSpecMarks,
  drawStunStars,
  drawTowerShape,
  enemyBaseRadius,
  enemyTop,
  longShadow,
  paintEnemyIcon,
  paintTowerIcon,
  polyPath,
  roundRectPath,
  towerRadius,
} from './shapes';

export { bridgeCells, computeLayout, cellAtPoint, cellCenter, portalPoint, worldPointAt } from './geometry';
export type { Layout } from './geometry';

const T = TILE;
const TAU = Math.PI * 2;
const FLY_LIFT = T * 0.22;
const TRAIL = 6;
const POP_TIME = 0.38;
const UPGRADE_TIME = 0.45;
const SHAKE_TIME = 0.45;
const FREEZE_FLASH = 0.6;
const HEAL_PULSE = 0.6;
const BOLT_LIFE = 0.15;
const ARROW_COUNT = 22;
const ARROW_SPREAD = 0.45;
const PLUS_FONT_SIZE = Math.round(T * 0.26);

const KIND_TOWER: Record<ProjectileKind, TowerId> = {
  flecha: 'arqueiro',
  bala: 'canhao',
  gelo: 'gelo',
  magia: 'mago',
  virote: 'balista',
};

interface TowerVis {
  aim: number;
  recoil: number;
  pop: number;
  up: number;
  seen: number;
  lvl: TowerLevel;
  lvlLevel: number;
  lvlSpec: SpecChoice | null;
  lvlPlus: number;
}

interface EnemyVis {
  flash: number;
  phase: number;
  flying: boolean;
  heal: number;
  seen: number;
}

interface ProjVis {
  trail: Float32Array;
  count: number;
  head: number;
  sx: number;
  sy: number;
  air: boolean;
  seen: number;
}

export function drawTowerIcon(canvas: HTMLCanvasElement, towerId: TowerId, cssSize: number): void {
  const dpr = clampDpr(typeof window === 'undefined' ? 1 : window.devicePixelRatio);
  paintTowerIcon(canvas, palette(), towerId, cssSize, dpr);
}

export function drawEnemyIcon(canvas: HTMLCanvasElement, enemyId: EnemyId, cssSize: number): void {
  const dpr = clampDpr(typeof window === 'undefined' ? 1 : window.devicePixelRatio);
  paintEnemyIcon(canvas, palette(), enemyId, cssSize, dpr);
}

function stagePortals(stage: StageDef): Point[] {
  const list: Point[] = [];
  for (const route of stage.map.paths) {
    if (route.length === 0) continue;
    const pt = portalPoint(stage.map, route);
    if (!list.some((q) => Math.abs(q.x - pt.x) < 1 && Math.abs(q.y - pt.y) < 1)) list.push(pt);
  }
  return list;
}

export function createRenderer(host: HTMLElement): RendererApi {
  const canvas = document.createElement('canvas');
  canvas.style.display = 'block';
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  canvas.style.touchAction = 'none';
  canvas.style.userSelect = 'none';
  canvas.style.setProperty('-webkit-tap-highlight-color', 'transparent');
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

  const bg = document.createElement('canvas');
  const bgCtx = bg.getContext('2d') as CanvasRenderingContext2D;
  let bgKey = '';

  let stage: StageDef = STAGES[0];
  let portals: Point[] = stagePortals(stage);
  let bridges: GridPoint[] = bridgeCells(stage.map);
  let layout: Layout = computeLayout(0, 0);
  let dpr = 1;
  let battle: BattleApi | null = null;
  let selected: number | null = null;
  let hovered: number | null = null;
  let ghost: Ghost | null = null;
  let aim: PowerAim | null = null;
  let time = 0;
  let frameId = 0;
  let shake = 0;
  let freezeFlash = 0;
  let congelarLeft = 0;
  let furiaLeft = 0;
  const towerVis = new Map<number, TowerVis>();
  const enemyVis = new Map<number, EnemyVis>();
  const projVis = new Map<number, ProjVis>();
  const fx = new EffectPool();
  const boltX = new Float32Array(MAX_BOLT_POINTS);
  const boltY = new Float32Array(MAX_BOLT_POINTS);
  const plusLabels: string[] = [];
  const plusFont = `800 ${PLUS_FONT_SIZE}px ${fontFamily()}`;

  function plusLabel(n: number): string {
    let label = plusLabels[n];
    if (label === undefined) {
      label = `+${n}`;
      plusLabels[n] = label;
    }
    return label;
  }

  function getTowerVis(t: TowerState): TowerVis {
    let v = towerVis.get(t.uid);
    if (!v) {
      v = { aim: t.angle, recoil: 0, pop: 99, up: 99, seen: frameId, lvl: towerLevel(t), lvlLevel: t.level, lvlSpec: t.spec, lvlPlus: t.plus };
      towerVis.set(t.uid, v);
    }
    return v;
  }

  function levelOf(t: TowerState): TowerLevel {
    const v = getTowerVis(t);
    if (v.lvlLevel !== t.level || v.lvlSpec !== t.spec || v.lvlPlus !== t.plus) {
      v.lvl = towerLevel(t);
      v.lvlLevel = t.level;
      v.lvlSpec = t.spec;
      v.lvlPlus = t.plus;
    }
    return v.lvl;
  }

  function getEnemyVis(e: EnemyState): EnemyVis {
    let v = enemyVis.get(e.uid);
    if (!v) {
      v = { flash: 0, phase: (e.uid * 2.39996) % TAU, flying: e.def.flying, heal: 0, seen: frameId };
      enemyVis.set(e.uid, v);
    }
    return v;
  }

  function isAirTarget(targetUid: number): boolean {
    const v = enemyVis.get(targetUid);
    if (v) return v.flying;
    if (!battle) return false;
    const list = battle.enemies;
    for (let i = 0; i < list.length; i++) if (list[i].uid === targetUid) return list[i].def.flying;
    return false;
  }

  function getProjVis(uid: number, x: number, y: number, targetUid: number): ProjVis {
    let v = projVis.get(uid);
    if (!v) {
      v = { trail: new Float32Array(TRAIL * 2), count: 0, head: 0, sx: x, sy: y, air: isAirTarget(targetUid), seen: frameId };
      projVis.set(uid, v);
    }
    return v;
  }

  function projLift(v: ProjVis, x: number, y: number): number {
    if (!v.air) return 0;
    const d = Math.hypot(x - v.sx, y - v.sy);
    return FLY_LIFT * Math.min(1, d / (T * 1.2));
  }

  function resize(): void {
    const rect = canvas.getBoundingClientRect();
    dpr = clampDpr(window.devicePixelRatio);
    const w = rect.width;
    const h = rect.height;
    layout = computeLayout(w, h);
    const bw = backingSize(w, dpr);
    const bh = backingSize(h, dpr);
    if (bw > 0 && bh > 0) {
      if (canvas.width !== bw) canvas.width = bw;
      if (canvas.height !== bh) canvas.height = bh;
    }
    bgKey = '';
    draw();
  }

  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => resize());
  observer?.observe(host);

  function ensureBackground(p: Palette): boolean {
    const bw = backingSize(WORLD_WIDTH * layout.scale, dpr);
    const bh = backingSize(WORLD_HEIGHT * layout.scale, dpr);
    if (bw <= 0 || bh <= 0) return false;
    const key = `${bw}x${bh}:${p.id}:${stage.id}`;
    if (key === bgKey) return true;
    bg.width = bw;
    bg.height = bh;
    bgCtx.setTransform(bw / WORLD_WIDTH, 0, 0, bh / WORLD_HEIGHT, 0, 0);
    bgCtx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    paintBackground(bgCtx, p, stage);
    bgKey = key;
    return true;
  }

  function enemyLift(v: EnemyVis | undefined): number {
    return v && v.flying ? FLY_LIFT : 0;
  }

  function liftOf(e: EnemyState): number {
    return e.def.flying ? FLY_LIFT : 0;
  }

  function findEnemy(uid: number): EnemyState | null {
    if (!battle) return null;
    const list = battle.enemies;
    for (let i = 0; i < list.length; i++) if (list[i].uid === uid) return list[i];
    return null;
  }

  function chainBolt(points: readonly Point[], uids: readonly number[]): void {
    const n = Math.min(points.length, MAX_BOLT_POINTS);
    for (let i = 0; i < n; i++) {
      let lift = 0;
      if (i > 0) {
        const uid = uids[i - 1];
        const v = uid === undefined ? undefined : enemyVis.get(uid);
        if (v) lift = enemyLift(v);
        else if (uid !== undefined) {
          const e = findEnemy(uid);
          if (e) lift = liftOf(e);
        }
      }
      boltX[i] = points[i].x;
      boltY[i] = points[i].y - lift;
      if (i > 0) fx.burst(FX_SPARK, boltX[i], boltY[i], 2, T * 1.1, T * 0.05, 0.25, C_TOWER, 'raio');
    }
    fx.bolt(boltX, boltY, n, BOLT_LIFE, T * 0.045, C_TOWER, 'raio');
  }

  function arrowRain(target: Point): void {
    const radius = POWERS.flechas.radius * T;
    for (let i = 0; i < ARROW_COUNT; i++) {
      const a = Math.random() * TAU;
      const d = Math.sqrt(Math.random()) * radius * 0.92;
      const x = target.x + Math.cos(a) * d;
      const y = target.y + Math.sin(a) * d;
      const delay = (i / ARROW_COUNT) * ARROW_SPREAD + Math.random() * 0.05;
      fx.arrow(x, y, delay, 0.16, T * 1.7, C_TOWER, 'arqueiro');
      fx.delayedRing(x, y, T * 0.2, delay + 0.16, 0.22, T * 0.04, C_DUST, '');
    }
    fx.delayedRing(target.x, target.y, radius, 0.12, 0.55, T * 0.1, C_TOWER, 'arqueiro');
    fx.delayedRing(target.x, target.y, radius * 1.05, ARROW_SPREAD + 0.12, 0.45, T * 0.08, C_GOLD, '');
  }

  function handleEvent(event: BattleEvent): void {
    switch (event.type) {
      case 'enemySpawned': {
        const e = event.enemy;
        getEnemyVis(e);
        fx.ring(Math.min(WORLD_WIDTH, Math.max(0, e.x)), e.y - liftOf(e), T * 0.5, 0.45, T * 0.06, C_PORTAL, '');
        break;
      }
      case 'enemyHit': {
        getEnemyVis(event.enemy).flash = 0.09;
        break;
      }
      case 'enemyKilled': {
        const e = event.enemy;
        const v = getEnemyVis(e);
        const y = e.y - enemyLift(v);
        const r = enemyBaseRadius(e.def.id, e.def.size, T);
        fx.burst(FX_BIT, e.x, y, 9 + Math.round(e.def.size * 2), T * 2.4, T * 0.11 * Math.max(1, e.def.size * 0.9), 0.6, C_ENEMY, e.def.id);
        fx.ring(e.x, y, r * 2.2, 0.3, T * 0.05, C_ENEMY, e.def.id);
        if (e.def.isBoss) {
          fx.burst(FX_STAR, e.x, y, 16, T * 3, T * 0.14, 0.9, C_GOLD, '');
          fx.ring(e.x, y, T * 2.2, 0.7, T * 0.12, C_GOLD, '');
        }
        break;
      }
      case 'enemyLeaked': {
        const e = event.enemy;
        shake = SHAKE_TIME;
        const cx = (stage.castle.col + 0.5) * T;
        const cy = (stage.castle.row + 0.5) * T;
        fx.ring(cx, cy, T * 1.1, 0.5, T * 0.08, C_BAD, '');
        fx.burst(FX_BIT, cx, cy, 7, T * 1.8, T * 0.09, 0.5, C_ENEMY, e.def.id);
        break;
      }
      case 'enemyHealed': {
        const h = event.healer;
        const hv = getEnemyVis(h);
        hv.heal = HEAL_PULSE;
        const reach = h.def.ability?.kind === 'cura' ? h.def.ability.radius * T : T * 1.5;
        fx.ring(h.x, h.y - enemyLift(hv), reach, 0.55, T * 0.06, C_ENEMY, 'curandeiro');
        const targets = event.targets;
        for (let i = 0; i < targets.length; i++) {
          const e = targets[i];
          const y = e.y - liftOf(e);
          fx.ring(e.x, y, T * 0.45, 0.4, T * 0.05, C_ENEMY, 'curandeiro');
          fx.rise(FX_PLUS, e.x, y - T * 0.1, 2, T * 0.4, T * 0.9, T * 0.09, 0.55, C_ENEMY, 'curandeiro');
        }
        break;
      }
      case 'enemySplit': {
        const e = event.enemy;
        fx.disc(e.x, e.y, T * 0.55, 0.35, C_ENEMY, 'lodo');
        fx.burst(FX_DUST, e.x, e.y, 10, T * 1.7, T * 0.09, 0.45, C_ENEMY, 'lodo');
        fx.ring(e.x, e.y, T * 0.7, 0.35, T * 0.05, C_ENEMY, 'lodinho');
        break;
      }
      case 'bossSummon': {
        const b = event.boss;
        fx.ring(b.x, b.y, enemyBaseRadius(b.def.id, b.def.size, T) * 2.6, 0.6, T * 0.08, C_PORTAL, '');
        const list = event.summoned;
        for (let i = 0; i < list.length; i++) {
          const e = list[i];
          const y = e.y - liftOf(e);
          fx.ring(e.x, y, T * 0.65, 0.5, T * 0.07, C_PORTAL, '');
          fx.disc(e.x, y, T * 0.45, 0.35, C_PORTAL, '');
          fx.burst(FX_SPARK, e.x, y, 6, T * 1.5, T * 0.07, 0.45, C_PORTAL, '');
        }
        break;
      }
      case 'enemyStunned': {
        const e = event.enemy;
        fx.ring(e.x, e.y - liftOf(e), T * 0.4, 0.25, T * 0.04, C_GOLD, '');
        break;
      }
      case 'towerFired': {
        const t = event.tower;
        getTowerVis(t).recoil = 1;
        getProjVis(event.projectile.uid, t.x, t.y, event.projectile.targetUid);
        break;
      }
      case 'chainLightning': {
        getTowerVis(event.tower).recoil = 1;
        chainBolt(event.points, event.uids);
        break;
      }
      case 'projectileImpact': {
        const pr = event.projectile;
        const kindTower = KIND_TOWER[pr.kind];
        const v = projVis.get(pr.uid);
        const air = v ? v.air : isAirTarget(pr.targetUid);
        const y = event.y - (air ? FLY_LIFT : 0);
        if (pr.splashRadius > 0) {
          fx.ring(event.x, y, pr.splashRadius, 0.45, T * 0.06, C_TOWER, kindTower);
          fx.disc(event.x, y, pr.splashRadius * 0.7, 0.32, C_TOWER, kindTower);
          if (pr.kind === 'bala') fx.burst(FX_DUST, event.x, y, 6, T * 1.4, T * 0.07, 0.4, C_DUST, '');
        } else if (pr.kind === 'gelo') {
          fx.ring(event.x, y, T * 0.55, 0.5, T * 0.06, C_TOWER, kindTower);
        } else {
          fx.ring(event.x, y, T * 0.35, 0.25, T * 0.06, C_TOWER, kindTower);
        }
        if (pr.kind === 'magia' || pr.kind === 'gelo') fx.burst(FX_SPARK, event.x, y, 4, T * 1.2, T * 0.06, 0.4, C_TOWER, kindTower);
        if (pr.burn) fx.burst(FX_SPARK, event.x, y, 5, T * 1.3, T * 0.06, 0.45, C_TOWER, 'balista');
        break;
      }
      case 'towerBuilt': {
        const t = event.tower;
        const v = getTowerVis(t);
        v.pop = 0;
        v.aim = -Math.PI / 4;
        fx.burst(FX_DUST, t.x, t.y + T * 0.15, 10, T * 1.7, T * 0.08, 0.5, C_DUST, '');
        fx.ring(t.x, t.y, T * 0.65, 0.35, T * 0.05, C_TOWER, t.def.id);
        break;
      }
      case 'towerUpgraded': {
        const t = event.tower;
        getTowerVis(t).up = 0;
        fx.ring(t.x, t.y, T * 0.8, 0.55, T * 0.1, C_TOWER, t.def.id);
        fx.ring(t.x, t.y, T * 0.55, 0.4, T * 0.05, C_GOLD, '');
        fx.burst(FX_SPARK, t.x, t.y, 8, T * 1.5, T * 0.07, 0.6, C_TOWER, t.def.id);
        break;
      }
      case 'towerSpecialized': {
        const t = event.tower;
        getTowerVis(t).up = 0;
        fx.burst(FX_STAR, t.x, t.y, 14, T * 2.4, T * 0.13, 0.8, C_GOLD, '');
        fx.ring(t.x, t.y, T * 1.2, 0.7, T * 0.12, C_GOLD, '');
        fx.ring(t.x, t.y, T * 0.8, 0.5, T * 0.08, C_TOWER, t.def.id);
        fx.disc(t.x, t.y, T * 0.9, 0.4, C_GOLD, '');
        break;
      }
      case 'towerPlus': {
        const t = event.tower;
        getTowerVis(t).up = 0;
        fx.ring(t.x, t.y, T * 0.85, 0.5, T * 0.09, C_GOLD, '');
        fx.delayedRing(t.x, t.y, T * 0.6, 0.1, 0.4, T * 0.05, C_GOLD, '');
        fx.burst(FX_STAR, t.x, t.y, 5, T * 1.4, T * 0.09, 0.55, C_GOLD, '');
        break;
      }
      case 'towerSold': {
        const t = event.tower;
        towerVis.delete(t.uid);
        fx.burst(FX_BIT, t.x, t.y, 12, T * 2, T * 0.1, 0.6, C_TOWER, t.def.id);
        fx.burst(FX_DUST, t.x, t.y + T * 0.15, 8, T * 1.4, T * 0.08, 0.45, C_DUST, '');
        if (selected === t.uid) selected = null;
        if (hovered === t.uid) hovered = null;
        break;
      }
      case 'powerCast': {
        if (event.power === 'flechas') {
          if (event.target) arrowRain(event.target);
        } else if (event.power === 'congelar') {
          freezeFlash = FREEZE_FLASH;
          if (battle) {
            const list = battle.enemies;
            for (let i = 0; i < list.length; i++) {
              const e = list[i];
              if (!e.alive) continue;
              fx.burst(FX_SPARK, e.x, e.y - liftOf(e), 4, T * 1.2, T * 0.06, 0.5, C_TOWER, 'gelo');
            }
          }
        } else if (event.power === 'furia' && battle) {
          const list = battle.towers;
          for (let i = 0; i < list.length; i++) {
            const t = list[i];
            fx.ring(t.x, t.y, T * 0.85, 0.55, T * 0.09, C_TOWER, 'balista');
            fx.burst(FX_SPARK, t.x, t.y, 4, T * 1.2, T * 0.06, 0.45, C_TOWER, 'balista');
          }
        }
        break;
      }
      default:
        break;
    }
  }

  function readPowers(): void {
    congelarLeft = 0;
    furiaLeft = 0;
    if (!battle) return;
    const list = battle.powers;
    for (let i = 0; i < list.length; i++) {
      const pw = list[i];
      if (pw.id === 'congelar') congelarLeft = pw.active;
      else if (pw.id === 'furia') furiaLeft = pw.active;
    }
  }

  function updateVisuals(dt: number): void {
    if (!battle) {
      towerVis.clear();
      enemyVis.clear();
      projVis.clear();
      return;
    }
    const towers = battle.towers;
    const k = Math.min(1, dt * 14);
    for (let i = 0; i < towers.length; i++) {
      const t = towers[i];
      const v = getTowerVis(t);
      v.seen = frameId;
      v.aim = lerpAngle(v.aim, t.angle, k);
      v.recoil = Math.max(0, v.recoil - dt * 5);
      v.pop += dt;
      v.up += dt;
    }
    const enemies = battle.enemies;
    for (let i = 0; i < enemies.length; i++) {
      const v = getEnemyVis(enemies[i]);
      v.seen = frameId;
      v.flash = Math.max(0, v.flash - dt);
      v.heal = Math.max(0, v.heal - dt);
    }
    const projectiles = battle.projectiles;
    for (let i = 0; i < projectiles.length; i++) {
      const pr = projectiles[i];
      const v = getProjVis(pr.uid, pr.x, pr.y, pr.targetUid);
      v.seen = frameId;
      v.head = (v.head + 1) % TRAIL;
      v.trail[v.head * 2] = pr.x;
      v.trail[v.head * 2 + 1] = pr.y - projLift(v, pr.x, pr.y);
      if (v.count < TRAIL) v.count++;
    }
    for (const [uid, v] of towerVis) if (v.seen !== frameId) towerVis.delete(uid);
    for (const [uid, v] of enemyVis) if (v.seen !== frameId) enemyVis.delete(uid);
    for (const [uid, v] of projVis) if (v.seen !== frameId) projVis.delete(uid);
  }

  function findTower(uid: number | null): TowerState | null {
    if (uid === null || !battle) return null;
    const list = battle.towers;
    for (let i = 0; i < list.length; i++) if (list[i].uid === uid) return list[i];
    return null;
  }

  function drawRange(x: number, y: number, range: number, color: string, fillAlpha: number, strokeAlpha: number): void {
    const px = 1 / Math.max(0.01, layout.scale);
    ctx.fillStyle = color;
    ctx.globalAlpha = fillAlpha;
    circlePath(ctx, x, y, range);
    ctx.fill();
    ctx.globalAlpha = strokeAlpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2 * px;
    ctx.setLineDash([6 * px, 8 * px]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  function drawPortals(p: Palette): void {
    const pulse = Math.sin(time * 3.3);
    for (let i = 0; i < portals.length; i++) {
      const x = portals[i].x;
      const y = portals[i].y;
      ctx.fillStyle = p.portal;
      ctx.globalAlpha = 0.22 + 0.1 * pulse;
      circlePath(ctx, x, y, T * (0.62 + 0.05 * pulse));
      ctx.fill();
      ctx.globalAlpha = 0.5;
      circlePath(ctx, x, y, T * 0.3);
      ctx.fill();
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = p.portal;
      ctx.lineWidth = T * 0.05;
      ctx.setLineDash([T * 0.12, T * 0.1]);
      ctx.lineDashOffset = -time * T * 0.4;
      circlePath(ctx, x, y, T * 0.45);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
    }
    ctx.globalAlpha = 1;
  }

  function drawCastleShadow(p: Palette): void {
    longShadow(ctx, p.shadow, (stage.castle.col + 0.5) * T, (stage.castle.row + 0.5) * T, T * 0.5, T * 0.7);
  }

  function drawCastle(p: Palette): void {
    const k = shake > 0 ? shake / SHAKE_TIME : 0;
    const cx = (stage.castle.col + 0.5) * T + Math.sin(time * 70) * 3 * k;
    const cy = (stage.castle.row + 0.5) * T + Math.cos(time * 55) * 2 * k;
    ctx.fillStyle = p.castle;
    roundRectPath(ctx, cx - T * 0.45, cy - T * 0.45, T * 0.9, T * 0.9, T * 0.12);
    ctx.fill();
    if (k > 0) {
      ctx.globalAlpha = 0.75 * k;
      ctx.fillStyle = p.css.bad;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = p.bg;
    for (let i = 0; i < 3; i++) ctx.fillRect(cx - T * 0.32 + i * T * 0.24, cy - T * 0.45, T * 0.12, T * 0.14);
    ctx.beginPath();
    ctx.arc(cx, cy + T * 0.15, T * 0.14, Math.PI, 0);
    ctx.lineTo(cx + T * 0.14, cy + T * 0.45);
    ctx.lineTo(cx - T * 0.14, cy + T * 0.45);
    ctx.closePath();
    ctx.fill();
  }

  function towerScale(t: TowerState, v: TowerVis): number {
    let s = T * (1 + t.level * 0.07 + (t.spec ? 0.06 : 0));
    if (v.pop < POP_TIME) s *= 0.35 + 0.65 * easeOutBack(v.pop / POP_TIME);
    if (v.up < UPGRADE_TIME) s *= 1 + 0.14 * Math.sin((v.up / UPGRADE_TIME) * Math.PI);
    return s;
  }

  function drawGhost(p: Palette): void {
    if (!ghost) return;
    const def = TOWERS[ghost.towerId];
    if (!def) return;
    const x = (ghost.col + 0.5) * T;
    const y = (ghost.row + 0.5) * T;
    const color = ghost.valid ? p.css.good : p.css.bad;
    drawRange(x, y, def.levels[0].range, color, 0.09, 0.6);
    const px = 1 / Math.max(0.01, layout.scale);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.16;
    roundRectPath(ctx, ghost.col * T + 2, ghost.row * T + 2, T - 4, T - 4, T * 0.16);
    ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5 * px;
    ctx.stroke();
    ctx.globalAlpha = 0.55;
    drawTowerShape(ctx, p, ghost.towerId, x, y, T, -Math.PI / 4, 0, time, p.tower[ghost.towerId], null);
    ctx.globalAlpha = 1;
  }

  function drawPowerAim(p: Palette): void {
    if (!aim) return;
    const color = aim.valid ? p.css.good : p.css.bad;
    const R = Math.max(T * 0.3, aim.radius);
    const px = 1 / Math.max(0.01, layout.scale);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.13;
    circlePath(ctx, aim.x, aim.y, R);
    ctx.fill();
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5 * px;
    ctx.setLineDash([8 * px, 7 * px]);
    ctx.lineDashOffset = -time * 24 * px;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
    ctx.fillStyle = color;
    for (let i = 0; i < 5; i++) {
      const a = i === 0 ? 0 : -Math.PI / 2 + ((i - 1) * TAU) / 4 + Math.PI / 4;
      const d = i === 0 ? 0 : R * 0.55;
      const bob = Math.sin(time * 6 + i * 1.3) * T * 0.06;
      ctx.globalAlpha = i === 0 ? 0.95 : 0.75;
      drawArrowDown(ctx, aim.x + Math.cos(a) * d, aim.y + Math.sin(a) * d + T * 0.12 + bob, T * (i === 0 ? 0.42 : 0.3), 0);
    }
    ctx.globalAlpha = 1;
  }

  function drawAura(p: Palette, t: TowerState, range: number): void {
    const px = 1 / Math.max(0.01, layout.scale);
    const color = p.tower[t.def.id];
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.05;
    circlePath(ctx, t.x, t.y, range);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.2;
    ctx.lineWidth = 1.5 * px;
    ctx.stroke();
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = T * 0.03;
    const base = time * 0.6 + t.uid;
    for (let i = 0; i < 6; i++) {
      const a = base + (i * TAU) / 6;
      const d = range * (0.55 + 0.25 * ((i % 2) + Math.sin(time * 1.3 + i) * 0.5));
      const fxp = t.x + Math.cos(a) * d;
      const fyp = t.y + Math.sin(a) * d;
      const s = T * 0.09;
      ctx.beginPath();
      for (let j = 0; j < 3; j++) {
        const b = time * 2 + (j * Math.PI) / 3;
        const c = Math.cos(b) * s;
        const sn = Math.sin(b) * s;
        ctx.moveTo(fxp - c, fyp - sn);
        ctx.lineTo(fxp + c, fyp + sn);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawFuryGlow(p: Palette, t: TowerState, size: number): void {
    const pulse = 0.5 + 0.5 * Math.sin(time * 8 + t.uid);
    const r = towerRadius(size);
    ctx.fillStyle = p.tower.balista;
    ctx.globalAlpha = 0.16 + 0.14 * pulse;
    circlePath(ctx, t.x, t.y, r * (1.45 + 0.12 * pulse));
    ctx.fill();
    ctx.strokeStyle = p.tower.balista;
    ctx.globalAlpha = 0.55 + 0.3 * pulse;
    ctx.lineWidth = T * 0.04;
    circlePath(ctx, t.x, t.y, r * (1.3 + 0.1 * pulse));
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function isFrozen(e: EnemyState): boolean {
    return congelarLeft > 0 && !e.def.slowImmune && !e.def.isBoss;
  }

  function drawEnemyShadow(p: Palette, e: EnemyState): void {
    const id = e.def.id;
    const r = enemyBaseRadius(id, e.def.size, T);
    longShadow(ctx, p.shadow, e.x, e.y, id === 'lobo' ? r * 1.1 : r, e.def.flying ? T * 0.6 : id === 'rei' ? T * 0.45 : T * 0.28);
  }

  function drawEnemy(p: Palette, e: EnemyState): void {
    const v = enemyVis.get(e.uid);
    const id = e.def.id;
    const r = enemyBaseRadius(id, e.def.size, T);
    const phase = v ? v.phase : 0;
    const y = e.def.flying ? e.y - FLY_LIFT + Math.sin(time * 3 + phase) * T * 0.03 : e.y;
    const frozen = isFrozen(e);
    const iced = congelarLeft > 0 || e.slowFactor < 1;
    const color = v && v.flash > 0 ? p.hit : iced ? p.tower.gelo : p.enemy[id];
    const animTime = frozen ? phase : time;
    drawEnemyShape(ctx, p, id, e.x, y, r, e.angle, (e.distance / T) * 0.6, animTime, phase, color);
    if (e.shielded && id !== 'escudeiro') drawShieldOutline(ctx, p, e.x, y, r, T * 0.035);
    if (frozen) drawFrozen(ctx, p, e.x, y, r, phase);
    if (e.burnTimer > 0) drawBurn(ctx, p, e.x, y, r, time, phase);
    if (v && v.heal > 0) {
      const k = v.heal / HEAL_PULSE;
      ctx.strokeStyle = p.enemy.curandeiro;
      ctx.globalAlpha = 0.8 * k;
      ctx.lineWidth = T * 0.05 * k + 0.8;
      circlePath(ctx, e.x, y, r * (1.2 + 1.2 * (1 - k)));
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    const top = enemyTop(id, r);
    if (e.hp < e.maxHp && e.maxHp > 0) {
      const w = T * 0.6 * Math.max(1, e.def.size * 0.85);
      const h = T * 0.07;
      const hy = y - top - T * 0.14;
      ctx.fillStyle = p.shadow;
      roundRectPath(ctx, e.x - w / 2, hy, w, h, h / 2);
      ctx.fill();
      const frac = Math.max(0, Math.min(1, e.hp / e.maxHp));
      if (frac > 0) {
        ctx.fillStyle = p.css.life;
        roundRectPath(ctx, e.x - w / 2, hy, Math.max(h, w * frac), h, h / 2);
        ctx.fill();
      }
    }
    if (e.stunTimer > 0) drawStunStars(ctx, p, e.x, y - top - T * 0.02, Math.max(T * 0.17, r * 0.8), T * 0.065, time);
  }

  function drawProjectiles(p: Palette): void {
    if (!battle) return;
    const list = battle.projectiles;
    for (let i = 0; i < list.length; i++) {
      const pr = list[i];
      const v = projVis.get(pr.uid);
      if (!v) continue;
      const color = p.tower[KIND_TOWER[pr.kind]];
      const x = pr.x;
      const y = pr.y - projLift(v, pr.x, pr.y);
      const fade = Math.min(1, Math.hypot(pr.x - v.sx, pr.y - v.sy) / (T * 0.3));
      ctx.fillStyle = color;
      if (pr.line) {
        ctx.strokeStyle = color;
        ctx.lineCap = 'round';
        ctx.globalAlpha = 0.18 * fade;
        ctx.lineWidth = T * 0.12;
        ctx.beginPath();
        ctx.moveTo(v.sx, v.sy);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.globalAlpha = 0.5 * fade;
        ctx.lineWidth = T * 0.035;
        ctx.beginPath();
        ctx.moveTo(v.sx + (x - v.sx) * 0.35, v.sy + (y - v.sy) * 0.35);
        ctx.lineTo(x, y);
        ctx.stroke();
      } else {
        for (let j = 1; j < v.count; j++) {
          const idx = (v.head - j + TRAIL) % TRAIL;
          ctx.globalAlpha = 0.35 * (1 - j / TRAIL) * fade;
          circlePath(ctx, v.trail[idx * 2], v.trail[idx * 2 + 1], T * 0.06 * (1 - j / (TRAIL + 1)));
          ctx.fill();
        }
      }
      ctx.globalAlpha = fade;
      switch (pr.kind) {
        case 'flecha':
        case 'virote': {
          const len = pr.kind === 'virote' ? T * (pr.line ? 0.6 : 0.44) : T * 0.3;
          const th = pr.kind === 'virote' ? T * 0.08 : T * 0.06;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(pr.angle);
          roundRectPath(ctx, -len * 0.55, -th / 2, len, th, th / 2);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(len * 0.45 + th * 1.4, 0);
          ctx.lineTo(len * 0.4, -th * 1.1);
          ctx.lineTo(len * 0.4, th * 1.1);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          break;
        }
        case 'bala': {
          circlePath(ctx, x, y, T * 0.1);
          ctx.fill();
          ctx.fillStyle = p.bg;
          ctx.globalAlpha = 0.35 * fade;
          circlePath(ctx, x - T * 0.03, y - T * 0.03, T * 0.035);
          ctx.fill();
          break;
        }
        case 'gelo': {
          polyPath(ctx, x, y, T * (pr.stun ? 0.12 : 0.09), 6, time * 6);
          ctx.fill();
          break;
        }
        case 'magia': {
          if (pr.burn) ctx.fillStyle = p.tower.balista;
          ctx.globalAlpha = 0.3 * fade;
          circlePath(ctx, x, y, T * (0.13 + 0.02 * Math.sin(time * 18)));
          ctx.fill();
          ctx.globalAlpha = fade;
          circlePath(ctx, x, y, T * 0.075);
          ctx.fill();
          break;
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  function underBridge(e: EnemyState): boolean {
    if (e.def.flying || Math.abs(Math.sin(e.angle)) > 0.5) return false;
    for (let i = 0; i < bridges.length; i++) {
      const b = bridges[i];
      if (Math.floor(e.y / T) !== b.row) continue;
      if (e.x > (b.col - 0.5) * T && e.x < (b.col + 1.5) * T) return true;
    }
    return false;
  }

  function drawGroundEnemies(p: Palette, enemies: readonly EnemyState[]): void {
    let hidden = 0;
    if (bridges.length > 0) {
      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (!e.def.flying && underBridge(e)) {
          drawEnemy(p, e);
          hidden++;
        }
      }
      if (hidden > 0) for (let i = 0; i < bridges.length; i++) paintBridge(ctx, p, bridges[i], false);
    }
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.def.flying || (hidden > 0 && underBridge(e))) continue;
      drawEnemy(p, e);
    }
  }

  function drawTowers(p: Palette, towers: readonly TowerState[]): void {
    for (let i = 0; i < towers.length; i++) {
      const t = towers[i];
      const v = getTowerVis(t);
      const size = towerScale(t, v);
      const color = p.tower[t.def.id];
      if (furiaLeft > 0) drawFuryGlow(p, t, size);
      drawTowerShape(ctx, p, t.def.id, t.x, t.y, size, v.aim, v.recoil, time, color, t.spec);
      drawLevelMarks(ctx, p, t.x, t.y, size, t.level, color);
      if (t.spec) drawSpecMarks(ctx, p, t.x, t.y, size);
      if (t.plus > 0) drawPlusBadge(ctx, p, t.x, t.y, size, plusLabel(t.plus), plusFont, PLUS_FONT_SIZE);
    }
  }

  function draw(): void {
    if (canvas.width <= 0 || canvas.height <= 0 || layout.scale <= 0) return;
    const p = palette();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = p.css.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!ensureBackground(p)) return;
    const s = layout.scale * dpr;
    ctx.setTransform(s, 0, 0, s, layout.offsetX * dpr, layout.offsetY * dpr);
    ctx.drawImage(bg, 0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT, MAP_RADIUS);
    ctx.clip();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    drawPortals(p);
    drawCastleShadow(p);

    const sel = findTower(selected);
    const hov = hovered !== selected ? findTower(hovered) : null;

    if (battle) {
      const enemies = battle.enemies;
      const towers = battle.towers;
      for (let i = 0; i < towers.length; i++) {
        const t = towers[i];
        const lvl = levelOf(t);
        if (lvl.aura) drawAura(p, t, lvl.range);
      }
      if (hov) drawRange(hov.x, hov.y, levelOf(hov).range, p.ink, 0.035, 0.22);
      if (sel) drawRange(sel.x, sel.y, levelOf(sel).range, p.ink, 0.06, 0.4);
      for (let i = 0; i < enemies.length; i++) drawEnemyShadow(p, enemies[i]);
      for (let i = 0; i < towers.length; i++) {
        const t = towers[i];
        longShadow(ctx, p.shadow, t.x, t.y, towerRadius(towerScale(t, getTowerVis(t))), T * 0.55);
      }
      if (sel) {
        ctx.fillStyle = p.tower[sel.def.id];
        ctx.globalAlpha = 0.2;
        circlePath(ctx, sel.x, sel.y, T * 0.5);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      drawTowers(p, towers);
      drawGhost(p);
      drawGroundEnemies(p, enemies);
      drawCastle(p);
      for (let i = 0; i < enemies.length; i++) if (enemies[i].def.flying) drawEnemy(p, enemies[i]);
      drawProjectiles(p);
    } else {
      drawGhost(p);
      drawCastle(p);
    }
    fx.draw(ctx, p);
    drawPowerAim(p);
    if (freezeFlash > 0) {
      ctx.fillStyle = p.tower.gelo;
      ctx.globalAlpha = 0.32 * (freezeFlash / FREEZE_FLASH);
      ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function frame(realDt: number, _now: number): void {
    const dt = Number.isFinite(realDt) ? Math.min(0.1, Math.max(0, realDt)) : 0;
    time += dt;
    frameId++;
    if (clampDpr(window.devicePixelRatio) !== dpr) resize();
    shake = Math.max(0, shake - dt);
    freezeFlash = Math.max(0, freezeFlash - dt);
    readPowers();
    updateVisuals(dt);
    fx.update(dt);
    if (layout.scale <= 0 || canvas.width <= 0) {
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) resize();
      return;
    }
    draw();
  }

  resize();

  return {
    canvas,
    setStage(next: StageDef): void {
      if (next === stage) return;
      stage = next;
      portals = stagePortals(next);
      bridges = bridgeCells(next.map);
      bgKey = '';
      shake = 0;
    },
    setBattle(next: BattleApi): void {
      battle = next;
      towerVis.clear();
      enemyVis.clear();
      projVis.clear();
      fx.clear();
      shake = 0;
      freezeFlash = 0;
      selected = null;
      hovered = null;
      ghost = null;
      aim = null;
    },
    setPowerAim(next: PowerAim | null): void {
      aim = next;
    },
    clientToWorld(clientX: number, clientY: number): Point | null {
      const rect = canvas.getBoundingClientRect();
      return worldPointAt(computeLayout(rect.width, rect.height), clientX - rect.left, clientY - rect.top);
    },
    handleEvent,
    resize,
    frame,
    setSelected(towerUid: number | null): void {
      selected = towerUid;
    },
    setHovered(towerUid: number | null): void {
      hovered = towerUid;
    },
    setGhost(next: Ghost | null): void {
      ghost = next;
    },
    cellAt(clientX: number, clientY: number): GridPoint | null {
      const rect = canvas.getBoundingClientRect();
      return cellAtPoint(computeLayout(rect.width, rect.height), clientX - rect.left, clientY - rect.top);
    },
    cellToClient(col: number, row: number): ScreenPoint {
      const rect = canvas.getBoundingClientRect();
      const c = cellCenter(computeLayout(rect.width, rect.height), col, row);
      return { x: rect.left + c.x, y: rect.top + c.y };
    },
    destroy(): void {
      observer?.disconnect();
      towerVis.clear();
      enemyVis.clear();
      projVis.clear();
      fx.clear();
      battle = null;
      canvas.remove();
    },
  };
}
