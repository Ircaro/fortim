import type { GridPoint, MapDef, Point } from '../core/types';

export const PATH_N = 1;
export const PATH_E = 2;
export const PATH_S = 4;
export const PATH_W = 8;

export function cellKey(col: number, row: number): string {
  return `${col},${row}`;
}

export function routeTiles(points: readonly GridPoint[]): GridPoint[] {
  const tiles: GridPoint[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dc = Math.sign(b.col - a.col);
    const dr = Math.sign(b.row - a.row);
    let col = a.col;
    let row = a.row;
    for (;;) {
      if (tiles.length === 0 || i === 0 || col !== a.col || row !== a.row) tiles.push({ col, row });
      if (col === b.col && row === b.row) break;
      col += dc;
      row += dr;
    }
  }
  return tiles;
}

export function pathTiles(map: MapDef): GridPoint[] {
  const tiles: GridPoint[] = [];
  const seen = new Set<string>();
  for (const route of map.paths) {
    for (const t of routeTiles(route)) {
      const k = cellKey(t.col, t.row);
      if (!seen.has(k)) {
        seen.add(k);
        tiles.push(t);
      }
    }
  }
  return tiles;
}

export function pathSet(map: MapDef): Set<string> {
  return new Set(pathTiles(map).map((t) => cellKey(t.col, t.row)));
}

export function isPathTile(set: Set<string>, col: number, row: number): boolean {
  return set.has(cellKey(col, row));
}

export function pathMask(set: Set<string>, col: number, row: number): number {
  let mask = 0;
  if (set.has(cellKey(col, row - 1))) mask |= PATH_N;
  if (set.has(cellKey(col + 1, row))) mask |= PATH_E;
  if (set.has(cellKey(col, row + 1))) mask |= PATH_S;
  if (set.has(cellKey(col - 1, row))) mask |= PATH_W;
  return mask;
}

export function tileCenter(col: number, row: number, tileSize: number): Point {
  return { x: col * tileSize + tileSize / 2, y: row * tileSize + tileSize / 2 };
}

export function isBlocked(map: MapDef, col: number, row: number): boolean {
  return map.blocked.some((b) => b.col === col && b.row === row);
}

export function inBounds(map: MapDef, col: number, row: number): boolean {
  return col >= 0 && row >= 0 && col < map.cols && row < map.rows;
}
