import type { GridPoint, MapDef, Point } from '../core/types';
import { MAP_COLS, MAP_ROWS, TILE } from '../config';

export interface Layout {
  width: number;
  height: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  tile: number;
}

export const WORLD_WIDTH = MAP_COLS * TILE;
export const WORLD_HEIGHT = MAP_ROWS * TILE;

export function clampDpr(dpr: number): number {
  if (!Number.isFinite(dpr) || dpr <= 0) return 1;
  return Math.min(2, dpr);
}

export function backingSize(cssSize: number, dpr: number): number {
  if (!Number.isFinite(cssSize) || cssSize <= 0) return 0;
  return Math.max(1, Math.round(cssSize * dpr));
}

export function computeLayout(width: number, height: number): Layout {
  const w = Number.isFinite(width) && width > 0 ? width : 0;
  const h = Number.isFinite(height) && height > 0 ? height : 0;
  const scale = w > 0 && h > 0 ? Math.min(w / WORLD_WIDTH, h / WORLD_HEIGHT) : 0;
  const offsetX = (w - WORLD_WIDTH * scale) / 2;
  const offsetY = (h - WORLD_HEIGHT * scale) / 2;
  return { width: w, height: h, scale, offsetX, offsetY, tile: TILE * scale };
}

export function screenToWorldX(layout: Layout, x: number): number {
  return layout.scale > 0 ? (x - layout.offsetX) / layout.scale : NaN;
}

export function screenToWorldY(layout: Layout, y: number): number {
  return layout.scale > 0 ? (y - layout.offsetY) / layout.scale : NaN;
}

export function worldToScreenX(layout: Layout, wx: number): number {
  return layout.offsetX + wx * layout.scale;
}

export function worldToScreenY(layout: Layout, wy: number): number {
  return layout.offsetY + wy * layout.scale;
}

export function cellAtPoint(layout: Layout, x: number, y: number): GridPoint | null {
  if (layout.scale <= 0) return null;
  const wx = screenToWorldX(layout, x);
  const wy = screenToWorldY(layout, y);
  if (!Number.isFinite(wx) || !Number.isFinite(wy)) return null;
  if (wx < 0 || wy < 0 || wx >= WORLD_WIDTH || wy >= WORLD_HEIGHT) return null;
  const col = Math.floor(wx / TILE);
  const row = Math.floor(wy / TILE);
  if (col < 0 || row < 0 || col >= MAP_COLS || row >= MAP_ROWS) return null;
  return { col, row };
}

export function worldPointAt(layout: Layout, x: number, y: number): Point | null {
  if (layout.scale <= 0) return null;
  const wx = screenToWorldX(layout, x);
  const wy = screenToWorldY(layout, y);
  if (!Number.isFinite(wx) || !Number.isFinite(wy)) return null;
  if (wx < 0 || wy < 0 || wx >= WORLD_WIDTH || wy >= WORLD_HEIGHT) return null;
  return { x: wx, y: wy };
}

export function bridgeCells(map: MapDef): GridPoint[] {
  const found: GridPoint[] = [];
  const seen = new Set<string>();
  for (const route of map.paths) {
    const marks = new Map<string, number>();
    for (let i = 0; i < route.length - 1; i++) {
      const a = route[i];
      const b = route[i + 1];
      const dc = Math.sign(b.col - a.col);
      const dr = Math.sign(b.row - a.row);
      if ((dc !== 0) === (dr !== 0)) continue;
      const bit = dc !== 0 ? 1 : 2;
      let col = a.col + dc;
      let row = a.row + dr;
      while (col !== b.col || row !== b.row) {
        const key = `${col},${row}`;
        marks.set(key, (marks.get(key) ?? 0) | bit);
        col += dc;
        row += dr;
      }
    }
    for (const [key, mask] of marks) {
      if (mask !== 3 || seen.has(key)) continue;
      seen.add(key);
      const [col, row] = key.split(',').map(Number);
      if (col >= 0 && row >= 0 && col < map.cols && row < map.rows) found.push({ col, row });
    }
  }
  return found;
}

export function portalPoint(map: MapDef, route: readonly GridPoint[]): Point {
  const first = route[0];
  const y = (Math.min(map.rows - 1, Math.max(0, first.row)) + 0.5) * TILE;
  const x = first.col < 0 ? 0 : first.col >= map.cols ? map.cols * TILE : (first.col + 0.5) * TILE;
  if (first.row < 0) return { x: (first.col + 0.5) * TILE, y: 0 };
  if (first.row >= map.rows) return { x: (first.col + 0.5) * TILE, y: map.rows * TILE };
  return { x, y };
}

export function cellCenter(layout: Layout, col: number, row: number): { x: number; y: number } {
  return {
    x: worldToScreenX(layout, (col + 0.5) * TILE),
    y: worldToScreenY(layout, (row + 0.5) * TILE),
  };
}

export function lerpAngle(from: number, to: number, k: number): number {
  const twoPi = Math.PI * 2;
  let diff = (to - from) % twoPi;
  if (diff > Math.PI) diff -= twoPi;
  if (diff < -Math.PI) diff += twoPi;
  return from + diff * Math.min(1, Math.max(0, k));
}

export function easeOutBack(k: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const t = Math.min(1, Math.max(0, k)) - 1;
  return 1 + c3 * t * t * t + c1 * t * t;
}
