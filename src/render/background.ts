import type { GridPoint } from '../core/types';
import { MAP_COLS, MAP_ROWS, TILE } from '../config';
import type { StageDef } from '../data/stages';
import type { Palette } from '../theme';
import { WORLD_HEIGHT, WORLD_WIDTH, bridgeCells } from './geometry';
import { circlePath, longShadow, polyPath } from './shapes';

export const MAP_RADIUS = 12;

const BRIDGE_DECK = '#4a3f33';
const BRIDGE_PLANK = '#6b5a45';

export function tracePath(ctx: CanvasRenderingContext2D, paths: readonly (readonly GridPoint[])[]): void {
  ctx.beginPath();
  for (const pts of paths) {
    for (let i = 0; i < pts.length; i++) {
      const x = (pts[i].col + 0.5) * TILE;
      const y = (pts[i].row + 0.5) * TILE;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  }
}

export function paintBridge(ctx: CanvasRenderingContext2D, p: Palette, cell: GridPoint, shadow: boolean): void {
  const T = TILE;
  const x = cell.col * T;
  const y = cell.row * T;
  if (shadow) {
    ctx.fillStyle = p.shadow;
    ctx.fillRect(x + T * 0.92, y + T * 0.06, T * 0.12, T * 0.98);
  }
  ctx.fillStyle = BRIDGE_DECK;
  ctx.fillRect(x + T * 0.08, y - T * 0.02, T * 0.84, T * 1.04);
  ctx.fillStyle = BRIDGE_PLANK;
  for (let i = 0; i < 4; i++) ctx.fillRect(x + T * 0.12, y + T * (0.04 + i * 0.25), T * 0.76, T * 0.16);
  ctx.strokeStyle = p.bg;
  ctx.lineWidth = T * 0.06;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.moveTo(x + T * 0.08, y);
  ctx.lineTo(x + T * 0.08, y + T);
  ctx.moveTo(x + T * 0.92, y);
  ctx.lineTo(x + T * 0.92, y + T);
  ctx.stroke();
  ctx.lineCap = 'round';
}

export function paintBackground(ctx: CanvasRenderingContext2D, p: Palette, stage: StageDef): void {
  const T = TILE;
  const paths = stage.map.paths;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT, MAP_RADIUS);
  ctx.clip();
  ctx.fillStyle = p.ground2;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  ctx.fillStyle = p.ground;
  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      if ((r + c) % 2 === 1) ctx.fillRect(c * T, r * T, T, T);
    }
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  tracePath(ctx, paths);
  ctx.strokeStyle = p.pathEdge;
  ctx.lineWidth = T * 0.86;
  ctx.stroke();
  ctx.strokeStyle = p.path;
  ctx.lineWidth = T * 0.74;
  ctx.stroke();
  ctx.setLineDash([T * 0.08, T * 0.32]);
  ctx.strokeStyle = p.pathEdge;
  ctx.lineWidth = T * 0.06;
  ctx.stroke();
  ctx.setLineDash([]);
  for (const cell of bridgeCells(stage.map)) paintBridge(ctx, p, cell, true);
  for (const d of stage.decor) {
    const x = (d.col + 0.5) * T;
    const y = (d.row + 0.5) * T;
    if (d.kind === 'arvore') {
      longShadow(ctx, p.shadow, x, y, T * 0.32, T * 0.5);
      ctx.fillStyle = p.tree[(d.col + d.row) % 2];
      circlePath(ctx, x, y, T * 0.32);
      ctx.fill();
      ctx.fillStyle = p.tree[(d.col + d.row + 1) % 2];
      circlePath(ctx, x - T * 0.08, y - T * 0.08, T * 0.14);
      ctx.fill();
    } else {
      longShadow(ctx, p.shadow, x, y, T * 0.2, T * 0.3);
      ctx.fillStyle = p.rock;
      polyPath(ctx, x, y, T * 0.22, 5, 0.4);
      ctx.fill();
    }
  }
  ctx.restore();
}
