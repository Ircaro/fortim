import type { EnemyId, SpecChoice, TowerId } from '../core/types';
import type { Palette } from '../theme';

const TAU = Math.PI * 2;

const KING_CAPE = '#9b2c3a';
const KING_CAPE_IN = '#c23b4a';
const KING_EAR = '#5bbf86';
const KING_SKIN = '#6fd39a';
const KING_SHINE = '#8fe0b2';
const KING_EYE = '#e5484d';
const KING_DARK = '#2b4a36';
const KING_TUSK = '#f4ead2';
const KING_BAND = '#d9a536';
const KING_JEWEL = '#6aa7ff';
const KING_STAFF = '#7a5233';
const FLAME = '#ff9a3d';

const BOLT: readonly number[] = [6, -22, -10, 4, 1, 4, -6, 24, 12, -4, 1, -4];

export function polyPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, n: number, rot: number): void {
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function starPath(ctx: CanvasRenderingContext2D, x: number, y: number, outer: number, inner: number, points: number, rot: number): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = rot + (i / (points * 2)) * TAU;
    const r = i % 2 === 0 ? outer : inner;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function boltPath(ctx: CanvasRenderingContext2D, x: number, y: number, k: number): void {
  ctx.beginPath();
  for (let i = 0; i < BOLT.length; i += 2) {
    const px = x + BOLT[i] * k;
    const py = y + BOLT[i + 1] * k;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function circlePath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), 0, TAU);
}

export function shieldPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y - r * 1.1);
  ctx.lineTo(x + r, y - r * 0.6);
  ctx.lineTo(x + r * 0.8, y + r * 0.5);
  ctx.lineTo(x, y + r * 1.1);
  ctx.lineTo(x - r * 0.8, y + r * 0.5);
  ctx.lineTo(x - r, y - r * 0.6);
  ctx.closePath();
}

export function longShadow(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, r: number, len: number): void {
  const k = r * 0.7071;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - k, y + k);
  ctx.lineTo(x + k, y - k);
  ctx.lineTo(x + k + len, y - k + len);
  ctx.lineTo(x - k + len, y + k + len);
  ctx.closePath();
  ctx.fill();
}

export function towerRadius(s: number): number {
  return s * 0.37;
}

function arrowHead(ctx: CanvasRenderingContext2D, s: number, back: number, a: number): void {
  const c = Math.cos(a);
  const sn = Math.sin(a);
  const tipX = s * 0.3 + back;
  const baseX = s * 0.06 + back;
  const half = s * 0.075;
  ctx.beginPath();
  ctx.moveTo(c * tipX, sn * tipX);
  ctx.lineTo(c * baseX - sn * half, sn * baseX + c * half);
  ctx.lineTo(c * baseX + sn * half, sn * baseX - c * half);
  ctx.closePath();
  ctx.fill();
}

export function drawTowerShape(
  ctx: CanvasRenderingContext2D,
  p: Palette,
  id: TowerId,
  x: number,
  y: number,
  s: number,
  aim: number,
  recoil: number,
  time: number,
  color: string,
  spec: SpecChoice | null,
): void {
  const back = -recoil * s * 0.1;
  const detail = p.bg;
  ctx.fillStyle = color;
  switch (id) {
    case 'arqueiro': {
      circlePath(ctx, x, y, s * 0.36);
      ctx.fill();
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(aim);
      ctx.fillStyle = detail;
      ctx.strokeStyle = detail;
      if (spec === 'a') {
        ctx.lineWidth = s * 0.05;
        ctx.lineCap = 'round';
        circlePath(ctx, back * 0.5, 0, s * (0.16 - recoil * 0.03));
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-s * 0.27, 0);
        ctx.lineTo(s * 0.27, 0);
        ctx.moveTo(0, -s * 0.27);
        ctx.lineTo(0, s * 0.27);
        ctx.stroke();
        circlePath(ctx, s * 0.3, 0, s * 0.045);
        ctx.fill();
      } else if (spec === 'b') {
        arrowHead(ctx, s, back, -0.55);
        arrowHead(ctx, s, back, 0);
        arrowHead(ctx, s, back, 0.55);
      } else {
        ctx.beginPath();
        ctx.moveTo(s * 0.3 + back, 0);
        ctx.lineTo(-s * 0.12 + back, -s * 0.16);
        ctx.lineTo(-s * 0.12 + back, s * 0.16);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      break;
    }
    case 'canhao': {
      roundRectPath(ctx, x - s * 0.34, y - s * 0.34, s * 0.68, s * 0.68, s * 0.12);
      ctx.fill();
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(aim);
      ctx.fillStyle = detail;
      if (spec === 'a') {
        circlePath(ctx, 0, 0, s * 0.22);
        ctx.fill();
        roundRectPath(ctx, back, -s * 0.15, s * 0.34, s * 0.3, s * 0.06);
        ctx.fill();
        roundRectPath(ctx, back + s * 0.3, -s * 0.19, s * 0.12, s * 0.38, s * 0.04);
        ctx.fill();
        ctx.fillStyle = color;
        circlePath(ctx, back + s * 0.36, 0, s * 0.08);
        ctx.fill();
      } else if (spec === 'b') {
        circlePath(ctx, 0, 0, s * 0.17);
        ctx.fill();
        roundRectPath(ctx, back, -s * 0.08, s * 0.32, s * 0.16, s * 0.04);
        ctx.fill();
        roundRectPath(ctx, back + s * 0.28, -s * 0.17, s * 0.22, s * 0.07, s * 0.03);
        ctx.fill();
        roundRectPath(ctx, back + s * 0.28, s * 0.1, s * 0.22, s * 0.07, s * 0.03);
        ctx.fill();
        ctx.fillStyle = color;
        boltPath(ctx, 0, 0, s * 0.0055);
        ctx.fill();
      } else {
        circlePath(ctx, 0, 0, s * 0.17);
        ctx.fill();
        roundRectPath(ctx, back, -s * 0.09, s * 0.46, s * 0.18, s * 0.05);
        ctx.fill();
      }
      ctx.restore();
      break;
    }
    case 'gelo': {
      polyPath(ctx, x, y, s * 0.38, 6, Math.PI / 6);
      ctx.fill();
      ctx.fillStyle = detail;
      if (spec === 'a') {
        ctx.strokeStyle = detail;
        ctx.lineWidth = s * 0.06;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          const a = time * 1.5 + (i * Math.PI) / 3;
          const c = Math.cos(a) * s * 0.25;
          const sn = Math.sin(a) * s * 0.25;
          ctx.moveTo(x - c, y - sn);
          ctx.lineTo(x + c, y + sn);
        }
        ctx.stroke();
        circlePath(ctx, x, y, s * 0.08);
        ctx.fill();
      } else if (spec === 'b') {
        polyPath(ctx, x, y, s * 0.13, 6, time * 1.1);
        ctx.fill();
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(aim);
        ctx.beginPath();
        ctx.moveTo(s * 0.36 + back, 0);
        ctx.lineTo(s * 0.08 + back, -s * 0.08);
        ctx.lineTo(-s * 0.2 + back, 0);
        ctx.lineTo(s * 0.08 + back, s * 0.08);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        polyPath(ctx, x, y, s * (0.16 + recoil * 0.04), 6, time * 1.1);
        ctx.fill();
      }
      ctx.fillStyle = color;
      circlePath(ctx, x, y, s * 0.05);
      ctx.fill();
      break;
    }
    case 'mago': {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      roundRectPath(ctx, -s * 0.27, -s * 0.27, s * 0.54, s * 0.54, s * 0.06);
      ctx.fill();
      ctx.restore();
      if (spec === 'a') {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(time * 0.8);
        ctx.strokeStyle = color;
        ctx.lineWidth = s * 0.035;
        roundRectPath(ctx, -s * 0.3, -s * 0.3, s * 0.6, s * 0.6, s * 0.05);
        ctx.stroke();
        ctx.restore();
        ctx.fillStyle = detail;
        circlePath(ctx, x, y, s * 0.13 + Math.sin(time * 4) * s * 0.02 + recoil * s * 0.04);
        ctx.fill();
        ctx.fillStyle = color;
        starPath(ctx, x, y, s * 0.09, s * 0.035, 4, time * 2);
        ctx.fill();
      } else if (spec === 'b') {
        const f = 1 + Math.sin(time * 9) * 0.06 + recoil * 0.2;
        ctx.fillStyle = detail;
        ctx.beginPath();
        ctx.moveTo(x, y - s * 0.21 * f);
        ctx.quadraticCurveTo(x + s * 0.17, y + s * 0.02, x, y + s * 0.15);
        ctx.quadraticCurveTo(x - s * 0.17, y + s * 0.02, x, y - s * 0.21 * f);
        ctx.fill();
        ctx.fillStyle = FLAME;
        ctx.beginPath();
        ctx.moveTo(x, y - s * 0.06 * f);
        ctx.quadraticCurveTo(x + s * 0.08, y + s * 0.06, x, y + s * 0.11);
        ctx.quadraticCurveTo(x - s * 0.08, y + s * 0.06, x, y - s * 0.06 * f);
        ctx.fill();
      } else {
        ctx.fillStyle = detail;
        circlePath(ctx, x, y, s * 0.11 + Math.sin(time * 4) * s * 0.02 + recoil * s * 0.04);
        ctx.fill();
      }
      break;
    }
    case 'balista': {
      polyPath(ctx, x, y, s * 0.36, 8, Math.PI / 8);
      ctx.fill();
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(aim);
      ctx.fillStyle = detail;
      ctx.strokeStyle = detail;
      if (spec === 'a') {
        roundRectPath(ctx, -s * 0.2 + back, -s * 0.045, s * 0.76, s * 0.09, s * 0.04);
        ctx.fill();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(s * 0.72 + back, 0);
        ctx.lineTo(s * 0.54 + back, -s * 0.09);
        ctx.lineTo(s * 0.54 + back, s * 0.09);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = detail;
      } else if (spec === 'b') {
        for (let i = -1; i <= 1; i++) {
          roundRectPath(ctx, -s * 0.08 + back - Math.abs(i) * s * 0.06, i * s * 0.1 - s * 0.035, s * 0.48, s * 0.07, s * 0.03);
          ctx.fill();
        }
      } else {
        roundRectPath(ctx, -s * 0.12 + back, -s * 0.05, s * 0.58, s * 0.1, s * 0.04);
        ctx.fill();
      }
      ctx.lineCap = 'round';
      ctx.lineWidth = s * 0.07;
      ctx.beginPath();
      ctx.arc(-s * 0.16 + back, 0, s * 0.28, -1.05, 1.05);
      ctx.stroke();
      ctx.lineWidth = s * 0.025;
      ctx.beginPath();
      const bx = -s * 0.16 + back + Math.cos(1.05) * s * 0.28;
      const by = Math.sin(1.05) * s * 0.28;
      ctx.moveTo(bx, -by);
      ctx.lineTo(-s * 0.12 + back - recoil * s * 0.04, 0);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'raio': {
      const r = s * 0.37;
      polyPath(ctx, x, y, r, 6, Math.PI / 6);
      ctx.fill();
      const k = (r / 30) * (1 + recoil * 0.18);
      if (spec === 'b') {
        ctx.fillStyle = detail;
        circlePath(ctx, x, y, r * 0.62);
        ctx.fill();
        ctx.fillStyle = color;
        boltPath(ctx, x, y, k * 0.62);
        ctx.fill();
        for (let i = 0; i < 3; i++) {
          const a = time * 2.4 + (i * TAU) / 3;
          circlePath(ctx, x + Math.cos(a) * s * 0.5, y + Math.sin(a) * s * 0.5, s * 0.05);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = detail;
        boltPath(ctx, x, y, k);
        ctx.fill();
        if (spec === 'a') {
          ctx.fillStyle = color;
          for (let i = 0; i < 2; i++) {
            const a = time * 1.6 + i * Math.PI;
            boltPath(ctx, x + Math.cos(a) * s * 0.5, y + Math.sin(a) * s * 0.5, k * 0.38);
            ctx.fill();
          }
        }
      }
      break;
    }
    default: {
      polyPath(ctx, x, y, s * 0.36, 3, -Math.PI / 2);
      ctx.fill();
      ctx.fillStyle = detail;
      circlePath(ctx, x, y + s * 0.04, s * 0.1 + recoil * s * 0.04);
      ctx.fill();
      break;
    }
  }
}

export function drawLevelMarks(ctx: CanvasRenderingContext2D, p: Palette, x: number, y: number, s: number, level: number, color: string): void {
  if (level <= 0) return;
  if (level >= 2) {
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = s * 0.035;
    circlePath(ctx, x, y, s * 0.46);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  const count = level + 1;
  const gap = s * 0.12;
  const startX = x - ((count - 1) * gap) / 2;
  const py = y + s * 0.47;
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = p.bg;
    circlePath(ctx, startX + i * gap, py, s * 0.05);
    ctx.fill();
    ctx.fillStyle = color;
    circlePath(ctx, startX + i * gap, py, s * 0.034);
    ctx.fill();
  }
}

export function drawSpecMarks(ctx: CanvasRenderingContext2D, p: Palette, x: number, y: number, s: number): void {
  ctx.strokeStyle = p.css.gold;
  ctx.globalAlpha = 0.8;
  ctx.lineWidth = s * 0.03;
  circlePath(ctx, x, y, s * 0.53);
  ctx.stroke();
  ctx.globalAlpha = 1;
  const sx = x - s * 0.36;
  const sy = y - s * 0.36;
  ctx.fillStyle = p.bg;
  starPath(ctx, sx, sy, s * 0.17, s * 0.085, 5, -Math.PI / 2);
  ctx.fill();
  ctx.fillStyle = p.css.gold;
  starPath(ctx, sx, sy, s * 0.12, s * 0.055, 5, -Math.PI / 2);
  ctx.fill();
}

export function drawPlusBadge(ctx: CanvasRenderingContext2D, p: Palette, x: number, y: number, s: number, label: string, font: string, fontSize: number): void {
  ctx.font = font;
  const w = Math.max(fontSize * 1.5, ctx.measureText(label).width + fontSize * 0.6);
  const h = fontSize * 1.25;
  const bx = x + s * 0.36 - w / 2;
  const by = y - s * 0.36 - h / 2;
  ctx.fillStyle = p.bg;
  roundRectPath(ctx, bx - 1.5, by - 1.5, w + 3, h + 3, (h + 3) / 2);
  ctx.fill();
  ctx.fillStyle = p.css.gold;
  roundRectPath(ctx, bx, by, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = p.css.accentText;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, bx + w / 2, by + h / 2 + fontSize * 0.04);
}

export function enemyBaseRadius(id: EnemyId, size: number, tile: number): number {
  const factor = id === 'lobo' ? 0.2 : id === 'golem' ? 0.27 : id === 'orc' ? 0.25 : id === 'rei' ? 0.2 : 0.23;
  return tile * factor * size;
}

export function enemyTop(id: EnemyId, r: number): number {
  switch (id) {
    case 'xama':
      return r * 1.6;
    case 'lobo':
      return r * 0.85;
    case 'rei':
      return r * 1.42;
    case 'escudeiro':
    case 'curandeiro':
      return r * 1.15;
    default:
      return r * 1.05;
  }
}

function drawBlob(ctx: CanvasRenderingContext2D, p: Palette, x: number, y: number, r: number, time: number, phase: number, color: string, twin: boolean): void {
  const wob = Math.sin(time * 13 + phase);
  const jx = Math.sin(time * 23 + phase * 3) * r * 0.05;
  const sx = 1 + wob * 0.07;
  const sy = 1 - wob * 0.07;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x - r * 0.25 + jx, y + r * 0.7 * (1 - sy), r * 0.85 * sx, r * 0.7 * sy, 0, 0, TAU);
  ctx.fill();
  if (twin) {
    const wob2 = Math.sin(time * 15 + phase + 1.3);
    ctx.beginPath();
    ctx.ellipse(x + r * 0.5 + jx, y + r * 0.2, r * 0.5 * (1 + wob2 * 0.08), r * 0.45 * (1 - wob2 * 0.08), 0, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = p.bg;
  ctx.globalAlpha = 0.45;
  circlePath(ctx, x - r * 0.48 + jx, y - r * 0.12, r * 0.11);
  ctx.fill();
  circlePath(ctx, x - r * 0.08 + jx, y - r * 0.12, r * 0.11);
  ctx.fill();
  ctx.globalAlpha = 1;
}

export function drawKing(ctx: CanvasRenderingContext2D, p: Palette, x: number, y: number, R: number, time: number, sway: number, skin: string): void {
  ctx.save();
  ctx.strokeStyle = p.portal;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = R * 0.065;
  ctx.setLineDash([R * 0.16, R * 0.13]);
  ctx.lineDashOffset = -time * R * 0.32;
  circlePath(ctx, x, y + R * 0.1, R * 1.75);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;
  ctx.globalAlpha = 1;
  ctx.translate(x, y + R * 0.4);
  ctx.rotate(sway);
  ctx.translate(0, -R * 0.4);
  ctx.fillStyle = KING_CAPE;
  ctx.beginPath();
  ctx.moveTo(-R * 0.95, -R * 0.2);
  ctx.lineTo(R * 0.95, -R * 0.2);
  ctx.lineTo(R * 1.25, R * 1.12);
  ctx.quadraticCurveTo(0, R * 1.3, -R * 1.25, R * 1.12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = KING_CAPE_IN;
  ctx.beginPath();
  ctx.moveTo(-R * 0.6, -R * 0.1);
  ctx.lineTo(R * 0.6, -R * 0.1);
  ctx.lineTo(R * 0.8, R * 1.05);
  ctx.lineTo(-R * 0.8, R * 1.05);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = skin === KING_SKIN ? KING_EAR : skin;
  ctx.beginPath();
  ctx.moveTo(-R * 0.8, -R * 0.25);
  ctx.lineTo(-R * 1.55, -R * 0.75);
  ctx.lineTo(-R * 0.78, R * 0.2);
  ctx.closePath();
  ctx.moveTo(R * 0.8, -R * 0.25);
  ctx.lineTo(R * 1.55, -R * 0.75);
  ctx.lineTo(R * 0.78, R * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = skin;
  circlePath(ctx, 0, 0, R);
  ctx.fill();
  if (skin === KING_SKIN) {
    ctx.fillStyle = KING_SHINE;
    circlePath(ctx, -R * 0.3, -R * 0.35, R * 0.32);
    ctx.fill();
  }
  ctx.fillStyle = p.hit;
  ctx.beginPath();
  ctx.ellipse(-R * 0.36, -R * 0.02, R * 0.2, R * 0.15, 0, 0, TAU);
  ctx.moveTo(R * 0.56, -R * 0.02);
  ctx.ellipse(R * 0.36, -R * 0.02, R * 0.2, R * 0.15, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = KING_EYE;
  ctx.beginPath();
  ctx.arc(-R * 0.31, 0, R * 0.08, 0, TAU);
  ctx.moveTo(R * 0.49, 0);
  ctx.arc(R * 0.41, 0, R * 0.08, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = KING_DARK;
  ctx.lineWidth = R * 0.1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-R * 0.6, -R * 0.26);
  ctx.lineTo(-R * 0.16, -R * 0.14);
  ctx.moveTo(R * 0.6, -R * 0.26);
  ctx.lineTo(R * 0.16, -R * 0.14);
  ctx.stroke();
  ctx.fillStyle = KING_DARK;
  ctx.beginPath();
  ctx.moveTo(-R * 0.38, R * 0.38);
  ctx.quadraticCurveTo(0, R * 0.58, R * 0.38, R * 0.38);
  ctx.quadraticCurveTo(0, R * 0.44, -R * 0.38, R * 0.38);
  ctx.fill();
  ctx.fillStyle = KING_TUSK;
  ctx.beginPath();
  ctx.moveTo(-R * 0.26, R * 0.41);
  ctx.lineTo(-R * 0.2, R * 0.24);
  ctx.lineTo(-R * 0.13, R * 0.43);
  ctx.closePath();
  ctx.moveTo(R * 0.26, R * 0.41);
  ctx.lineTo(R * 0.2, R * 0.24);
  ctx.lineTo(R * 0.13, R * 0.43);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = p.css.gold;
  ctx.beginPath();
  ctx.moveTo(-R * 0.62, -R * 0.62);
  ctx.lineTo(-R * 0.7, -R * 1.22);
  ctx.lineTo(-R * 0.33, -R * 0.92);
  ctx.lineTo(0, -R * 1.36);
  ctx.lineTo(R * 0.33, -R * 0.92);
  ctx.lineTo(R * 0.7, -R * 1.22);
  ctx.lineTo(R * 0.62, -R * 0.62);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = KING_BAND;
  ctx.fillRect(-R * 0.62, -R * 0.74, R * 1.24, R * 0.14);
  ctx.fillStyle = KING_EYE;
  circlePath(ctx, 0, -R * 0.95, R * 0.1);
  ctx.fill();
  ctx.fillStyle = KING_JEWEL;
  ctx.beginPath();
  ctx.arc(-R * 0.38, -R * 0.67, R * 0.06, 0, TAU);
  ctx.moveTo(R * 0.44, -R * 0.67);
  ctx.arc(R * 0.38, -R * 0.67, R * 0.06, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = KING_STAFF;
  ctx.lineWidth = R * 0.13;
  ctx.beginPath();
  ctx.moveTo(R * 1.12, R * 1.1);
  ctx.lineTo(R * 1.32, -R * 0.5);
  ctx.stroke();
  ctx.fillStyle = p.portal;
  circlePath(ctx, R * 1.35, -R * 0.66, R * (0.2 + Math.sin(time * 3) * 0.035));
  ctx.fill();
  ctx.fillStyle = p.hit;
  ctx.globalAlpha = 0.5;
  circlePath(ctx, R * 1.29, -R * 0.72, R * 0.06);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
}

export function drawEnemyShape(
  ctx: CanvasRenderingContext2D,
  p: Palette,
  id: EnemyId,
  x: number,
  y: number,
  r: number,
  angle: number,
  spin: number,
  time: number,
  phase: number,
  color: string,
): void {
  ctx.fillStyle = color;
  switch (id) {
    case 'goblin': {
      circlePath(ctx, x, y, r);
      ctx.fill();
      ctx.fillStyle = p.bg;
      ctx.globalAlpha = 0.35;
      circlePath(ctx, x + Math.cos(angle) * r * 0.35, y + Math.sin(angle) * r * 0.35, r * 0.3);
      ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
    case 'lobo': {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      roundRectPath(ctx, -r * 1.3, -r * 0.75, r * 2.6, r * 1.5, r * 0.75);
      ctx.fill();
      ctx.fillStyle = p.bg;
      ctx.globalAlpha = 0.35;
      circlePath(ctx, r * 0.7, 0, r * 0.32);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
      break;
    }
    case 'orc': {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      roundRectPath(ctx, -r, -r, r * 2, r * 2, r * 0.25);
      ctx.fill();
      ctx.fillStyle = p.bg;
      ctx.globalAlpha = 0.35;
      roundRectPath(ctx, -r * 0.55, -r * 0.55, r * 1.1, r * 1.1, r * 0.15);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
      break;
    }
    case 'morcego': {
      const flap = Math.sin(time * 11 + phase) * 0.35;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(r * 1.1, 0);
      ctx.lineTo(-r * 0.8, -r * (1 + flap));
      ctx.lineTo(-r * 0.4, 0);
      ctx.lineTo(-r * 0.8, r * (1 + flap));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'xama': {
      circlePath(ctx, x, y, r);
      ctx.fill();
      ctx.strokeStyle = p.portal;
      ctx.lineWidth = r * 0.14;
      ctx.globalAlpha = 0.6;
      ctx.setLineDash([r * 0.35, r * 0.3]);
      ctx.lineDashOffset = -time * r * 2;
      circlePath(ctx, x, y, r * 1.45);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
      ctx.globalAlpha = 1;
      const a = time * 3 + phase;
      const ox = x + Math.cos(a) * r * 1.45;
      const oy = y + Math.sin(a) * r * 1.45;
      ctx.fillStyle = p.portal;
      ctx.save();
      ctx.translate(ox, oy);
      ctx.rotate(a + Math.PI / 4);
      ctx.fillRect(-r * 0.22, -r * 0.22, r * 0.44, r * 0.44);
      ctx.restore();
      ctx.fillStyle = p.bg;
      ctx.globalAlpha = 0.4;
      circlePath(ctx, x, y, r * 0.38);
      ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
    case 'golem': {
      polyPath(ctx, x, y, r, 6, spin);
      ctx.fill();
      ctx.fillStyle = p.bg;
      ctx.globalAlpha = 0.3;
      polyPath(ctx, x, y, r * 0.5, 6, spin);
      ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
    case 'curandeiro': {
      const pulse = Math.sin(time * 3 + phase);
      ctx.strokeStyle = p.enemy.curandeiro;
      ctx.globalAlpha = 0.32 + 0.14 * pulse;
      ctx.lineWidth = r * 0.12;
      circlePath(ctx, x, y, r * (1.7 + 0.1 * pulse));
      ctx.stroke();
      ctx.globalAlpha = 1;
      circlePath(ctx, x, y, r);
      ctx.fill();
      ctx.fillStyle = p.bg;
      ctx.fillRect(x - r * 0.15, y - r * 0.55, r * 0.3, r * 1.1);
      ctx.fillRect(x - r * 0.55, y - r * 0.15, r * 1.1, r * 0.3);
      break;
    }
    case 'escudeiro': {
      ctx.strokeStyle = p.enemy.escudeiro;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = r * 0.12;
      ctx.setLineDash([r * 0.3, r * 0.25]);
      ctx.lineDashOffset = -time * r * 1.2;
      circlePath(ctx, x, y, r * 1.8);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
      ctx.globalAlpha = 1;
      shieldPath(ctx, x, y, r);
      ctx.fill();
      ctx.fillStyle = p.bg;
      ctx.globalAlpha = 0.35;
      shieldPath(ctx, x, y, r * 0.55);
      ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
    case 'lodo': {
      drawBlob(ctx, p, x, y, r, time, phase, color, true);
      break;
    }
    case 'lodinho': {
      drawBlob(ctx, p, x, y, r, time * 1.3, phase, color, false);
      break;
    }
    case 'rei': {
      const sway = Math.sin(spin * 5) * 0.09;
      const bob = Math.abs(Math.sin(spin * 5)) * r * 0.08;
      drawKing(ctx, p, x, y - bob, r, time, sway, color === p.enemy.rei ? KING_SKIN : color);
      break;
    }
    default: {
      circlePath(ctx, x, y, r);
      ctx.fill();
      break;
    }
  }
}

export function drawShieldOutline(ctx: CanvasRenderingContext2D, p: Palette, x: number, y: number, r: number, lineWidth: number): void {
  ctx.strokeStyle = p.enemy.escudeiro;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = lineWidth;
  shieldPath(ctx, x, y, r * 1.45);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

export function drawStunStars(ctx: CanvasRenderingContext2D, p: Palette, x: number, y: number, w: number, size: number, time: number): void {
  ctx.fillStyle = p.css.gold;
  for (let i = 0; i < 3; i++) {
    const a = time * 5 + (i * TAU) / 3;
    const sx = x + Math.cos(a) * w;
    const sy = y + Math.sin(a) * w * 0.32;
    ctx.globalAlpha = Math.sin(a) > 0 ? 1 : 0.6;
    starPath(ctx, sx, sy, size, size * 0.45, 4, a);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawBurn(ctx: CanvasRenderingContext2D, p: Palette, x: number, y: number, r: number, time: number, phase: number): void {
  for (let i = 0; i < 4; i++) {
    const k = (time * 1.7 + i * 0.25 + phase * 0.1) % 1;
    const fx = x + Math.sin(phase + i * 1.9 + time * 3) * r * 0.6;
    const fy = y + r * 0.4 - k * r * 1.9;
    const s = r * 0.3 * (1 - k * 0.7);
    ctx.globalAlpha = 0.9 * (1 - k);
    ctx.fillStyle = i % 2 === 0 ? FLAME : p.css.gold;
    ctx.beginPath();
    ctx.moveTo(fx, fy - s * 1.6);
    ctx.quadraticCurveTo(fx + s, fy, fx, fy + s * 0.7);
    ctx.quadraticCurveTo(fx - s, fy, fx, fy - s * 1.6);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawFrozen(ctx: CanvasRenderingContext2D, p: Palette, x: number, y: number, r: number, phase: number): void {
  ctx.fillStyle = p.tower.gelo;
  ctx.globalAlpha = 0.28;
  polyPath(ctx, x, y, r * 1.45, 6, phase);
  ctx.fill();
  ctx.strokeStyle = p.hit;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.stroke();
  ctx.fillStyle = p.hit;
  ctx.globalAlpha = 0.85;
  for (let i = 0; i < 3; i++) {
    const a = phase + (i * TAU) / 3 - Math.PI / 2;
    const cx = x + Math.cos(a) * r * 1.05;
    const cy = y + Math.sin(a) * r * 1.05;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(r * 0.42, 0);
    ctx.lineTo(0, -r * 0.14);
    ctx.lineTo(-r * 0.12, 0);
    ctx.lineTo(0, r * 0.14);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

export function drawArrowDown(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, tilt: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  const th = len * 0.14;
  ctx.fillRect(-th / 2, -len, th, len * 0.8);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-len * 0.2, -len * 0.3);
  ctx.lineTo(len * 0.2, -len * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(-len * 0.16, -len * 1.02, len * 0.32, len * 0.1);
  ctx.restore();
}

export function paintTowerIcon(canvas: HTMLCanvasElement, p: Palette, id: TowerId, cssSize: number, dpr: number): void {
  const px = Math.max(1, Math.round(cssSize * dpr));
  if (canvas.width !== px) canvas.width = px;
  if (canvas.height !== px) canvas.height = px;
  canvas.style.width = `${cssSize}px`;
  canvas.style.height = `${cssSize}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, px, px);
  drawTowerShape(ctx, p, id, px / 2, px / 2, px * 0.95, -0.6, 0, 0, p.tower[id], null);
}

const ICON_RADIUS: Record<EnemyId, number> = {
  goblin: 0.3,
  lobo: 0.17,
  orc: 0.27,
  morcego: 0.26,
  xama: 0.28,
  golem: 0.36,
  curandeiro: 0.26,
  escudeiro: 0.26,
  lodo: 0.32,
  lodinho: 0.3,
  rei: 0.25,
};

export function paintEnemyIcon(canvas: HTMLCanvasElement, p: Palette, id: EnemyId, cssSize: number, dpr: number): void {
  const px = Math.max(1, Math.round(cssSize * dpr));
  if (canvas.width !== px) canvas.width = px;
  if (canvas.height !== px) canvas.height = px;
  canvas.style.width = `${cssSize}px`;
  canvas.style.height = `${cssSize}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, px, px);
  drawEnemyShape(ctx, p, id, px / 2, px / 2, px * ICON_RADIUS[id], 0, 0, 0, 0, p.enemy[id]);
}
