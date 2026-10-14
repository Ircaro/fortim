import type { StageDef } from '../data/stages';
import { palette } from '../theme';

export function drawStageThumb(canvas: HTMLCanvasElement, stage: StageDef, cssWidth: number): void {
  const dpr = Math.min(2, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);
  const cols = stage.map.cols;
  const rows = stage.map.rows;
  const w = Math.max(1, Math.round(cssWidth * dpr));
  const h = Math.max(1, Math.round((cssWidth * rows) / cols) * dpr);
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const p = palette();
  const t = w / cols;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = (r + c) % 2 ? p.ground : p.ground2;
      ctx.fillRect(c * t, r * t, t + 1, t + 1);
    }
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [color, width] of [
    [p.pathEdge, 0.86],
    [p.path, 0.72],
  ] as const) {
    for (const route of stage.map.paths) {
      ctx.beginPath();
      route.forEach((pt, i) => {
        const x = (pt.col + 0.5) * t;
        const y = (pt.row + 0.5) * t;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = color;
      ctx.lineWidth = t * width;
      ctx.stroke();
    }
  }
  for (const d of stage.decor) {
    const x = (d.col + 0.5) * t;
    const y = (d.row + 0.5) * t;
    ctx.fillStyle = d.kind === 'arvore' ? p.tree[(d.col + d.row) % 2] : p.rock;
    ctx.beginPath();
    ctx.arc(x, y, t * (d.kind === 'arvore' ? 0.3 : 0.22), 0, Math.PI * 2);
    ctx.fill();
  }
  for (const route of stage.map.paths) {
    const start = route[0];
    const x = Math.min(cols - 0.5, Math.max(0.5, start.col + 0.5)) * t;
    const y = (start.row + 0.5) * t;
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = p.portal;
    ctx.beginPath();
    ctx.arc(x, y, t * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = p.castle;
  ctx.beginPath();
  ctx.roundRect((stage.castle.col + 0.1) * t, (stage.castle.row + 0.1) * t, t * 0.8, t * 0.8, t * 0.15);
  ctx.fill();
}
