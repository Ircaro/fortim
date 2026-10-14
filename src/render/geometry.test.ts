import { describe, expect, it } from 'vitest';
import type { MapDef } from '../core/types';
import { STAGES, stageById } from '../data/stages';
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
  screenToWorldX,
  screenToWorldY,
  worldPointAt,
} from './geometry';

function mapOf(id: string): MapDef {
  const stage = stageById(id);
  if (!stage) throw new Error(id);
  return stage.map;
}

function grid(paths: [number, number][][]): MapDef {
  return { name: 'teste', cols: 16, rows: 10, blocked: [], paths: paths.map((route) => route.map(([col, row]) => ({ col, row }))) };
}

describe('computeLayout', () => {
  it('usa a escala exata quando a proporção é a do mapa', () => {
    const layout = computeLayout(WORLD_WIDTH, WORLD_HEIGHT);
    expect(layout.scale).toBe(1);
    expect(layout.offsetX).toBe(0);
    expect(layout.offsetY).toBe(0);
    expect(layout.tile).toBe(48);
  });

  it('centraliza com faixas laterais em tela larga', () => {
    const layout = computeLayout(1200, 480);
    expect(layout.scale).toBe(1);
    expect(layout.offsetX).toBe((1200 - 768) / 2);
    expect(layout.offsetY).toBe(0);
  });

  it('centraliza com faixas em cima e embaixo no retrato', () => {
    const layout = computeLayout(384, 800);
    expect(layout.scale).toBe(0.5);
    expect(layout.offsetX).toBe(0);
    expect(layout.offsetY).toBe((800 - 240) / 2);
    expect(layout.tile).toBe(24);
  });

  it('escala é o menor entre largura e altura', () => {
    const layout = computeLayout(1536, 700);
    expect(layout.scale).toBeCloseTo(Math.min(1536 / 768, 700 / 480));
  });

  it('host sem tamanho gera escala zero', () => {
    expect(computeLayout(0, 300).scale).toBe(0);
    expect(computeLayout(300, 0).scale).toBe(0);
    expect(computeLayout(Number.NaN, 300).scale).toBe(0);
  });
});

describe('cellAtPoint', () => {
  const layout = computeLayout(1200, 480);

  it('converte ponto em célula descontando o deslocamento', () => {
    expect(cellAtPoint(layout, 216 + 10, 10)).toEqual({ col: 0, row: 0 });
    expect(cellAtPoint(layout, 216 + 48 * 3 + 1, 48 * 2 + 47)).toEqual({ col: 3, row: 2 });
  });

  it('devolve a última célula logo antes da borda', () => {
    expect(cellAtPoint(layout, 216 + 767.9, 479.9)).toEqual({ col: 15, row: 9 });
  });

  it('devolve null fora do mapa e na borda exata', () => {
    expect(cellAtPoint(layout, 100, 100)).toBeNull();
    expect(cellAtPoint(layout, 216 + 768, 10)).toBeNull();
    expect(cellAtPoint(layout, 300, 480)).toBeNull();
    expect(cellAtPoint(layout, 300, -1)).toBeNull();
  });

  it('devolve null quando o layout não tem tamanho', () => {
    expect(cellAtPoint(computeLayout(0, 0), 0, 0)).toBeNull();
  });

  it('funciona em escala reduzida', () => {
    const small = computeLayout(384, 800);
    expect(cellAtPoint(small, 24 * 5 + 2, 280 + 24 * 4 + 2)).toEqual({ col: 5, row: 4 });
  });
});

describe('cellCenter', () => {
  it('é o inverso de cellAtPoint', () => {
    const layout = computeLayout(1000, 700);
    for (const [col, row] of [[0, 0], [7, 3], [15, 9]]) {
      const p = cellCenter(layout, col, row);
      expect(cellAtPoint(layout, p.x, p.y)).toEqual({ col, row });
    }
  });

  it('aplica escala e deslocamento', () => {
    const layout = computeLayout(384, 800);
    expect(cellCenter(layout, 0, 0)).toEqual({ x: 12, y: 280 + 12 });
  });

  it('converte de volta para coordenadas do mundo', () => {
    const layout = computeLayout(1536, 960);
    const p = cellCenter(layout, 2, 1);
    expect(screenToWorldX(layout, p.x)).toBeCloseTo(120);
    expect(screenToWorldY(layout, p.y)).toBeCloseTo(72);
  });
});

describe('clampDpr e backingSize', () => {
  it('limita a densidade a 2 e trata valores inválidos', () => {
    expect(clampDpr(3)).toBe(2);
    expect(clampDpr(1.5)).toBe(1.5);
    expect(clampDpr(0)).toBe(1);
    expect(clampDpr(Number.NaN)).toBe(1);
  });

  it('arredonda o tamanho do buffer', () => {
    expect(backingSize(100.4, 1.5)).toBe(151);
    expect(backingSize(0, 2)).toBe(0);
    expect(backingSize(0.2, 1)).toBe(1);
  });
});

describe('lerpAngle e easeOutBack', () => {
  it('gira pelo caminho mais curto', () => {
    expect(lerpAngle(3, -3, 1)).toBeCloseTo(3 + (Math.PI * 2 - 6));
    expect(lerpAngle(0, 1, 0.5)).toBeCloseTo(0.5);
  });

  it('easeOutBack começa em 0, passa de 1 e termina em 1', () => {
    expect(easeOutBack(0)).toBeCloseTo(0);
    expect(easeOutBack(1)).toBeCloseTo(1);
    expect(easeOutBack(0.6)).toBeGreaterThan(1);
  });
});

describe('worldPointAt', () => {
  it('converte ponto da tela em pixels lógicos do mundo', () => {
    const layout = computeLayout(1200, 480);
    expect(worldPointAt(layout, 216 + 100, 50)).toEqual({ x: 100, y: 50 });
  });

  it('desfaz a escala e o deslocamento', () => {
    const layout = computeLayout(384, 800);
    const p = worldPointAt(layout, 24 * 5 + 12, 280 + 24 * 4 + 12);
    expect(p?.x).toBeCloseTo(48 * 5 + 24);
    expect(p?.y).toBeCloseTo(48 * 4 + 24);
  });

  it('concorda com cellAtPoint', () => {
    const layout = computeLayout(1000, 700);
    const c = cellCenter(layout, 9, 6);
    const p = worldPointAt(layout, c.x, c.y);
    expect(p).not.toBeNull();
    expect(Math.floor((p?.x ?? 0) / 48)).toBe(9);
    expect(Math.floor((p?.y ?? 0) / 48)).toBe(6);
  });

  it('devolve null fora do mapa ou sem tamanho', () => {
    const layout = computeLayout(1200, 480);
    expect(worldPointAt(layout, 100, 100)).toBeNull();
    expect(worldPointAt(layout, 216 + 768, 10)).toBeNull();
    expect(worldPointAt(layout, 300, -1)).toBeNull();
    expect(worldPointAt(computeLayout(0, 0), 0, 0)).toBeNull();
  });
});

describe('bridgeCells', () => {
  it('acha a ponte do desfiladeiro onde a trilha cruza a si mesma', () => {
    expect(bridgeCells(mapOf('desfiladeiro'))).toEqual([{ col: 6, row: 3 }]);
  });

  it('não acha ponte nas fases sem cruzamento', () => {
    for (const id of ['vale', 'floresta', 'encruzilhada', 'cerco']) expect(bridgeCells(mapOf(id))).toEqual([]);
  });

  it('não confunde curva com cruzamento', () => {
    expect(bridgeCells(grid([[[0, 2], [5, 2], [5, 7], [9, 7]]]))).toEqual([]);
  });

  it('ignora caminhos diferentes que se cruzam', () => {
    expect(bridgeCells(grid([[[-1, 4], [10, 4]], [[5, 0], [5, 9]]]))).toEqual([]);
  });

  it('acha vários cruzamentos do mesmo caminho sem repetir', () => {
    const map = grid([[[0, 2], [10, 2], [10, 6], [4, 6], [4, 0], [7, 0], [7, 8]]]);
    expect(bridgeCells(map)).toEqual(
      expect.arrayContaining([
        { col: 4, row: 2 },
        { col: 7, row: 2 },
        { col: 7, row: 6 },
      ]),
    );
    expect(bridgeCells(map)).toHaveLength(3);
  });
});

describe('portalPoint', () => {
  it('coloca a entrada da esquerda na borda esquerda', () => {
    const map = mapOf('vale');
    expect(portalPoint(map, map.paths[0])).toEqual({ x: 0, y: 2.5 * 48 });
  });

  it('coloca a entrada da direita na borda direita', () => {
    const map = mapOf('cerco');
    expect(portalPoint(map, map.paths[1])).toEqual({ x: WORLD_WIDTH, y: 1.5 * 48 });
  });

  it('usa o centro da célula quando a entrada está dentro do mapa', () => {
    const map = grid([[[3, 4], [3, 9]]]);
    expect(portalPoint(map, map.paths[0])).toEqual({ x: 3.5 * 48, y: 4.5 * 48 });
  });

  it('cada fase tem um portal por caminho', () => {
    for (const stage of STAGES) {
      const pts = stage.map.paths.map((route) => portalPoint(stage.map, route));
      for (const p of pts) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(WORLD_WIDTH);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(WORLD_HEIGHT);
      }
    }
  });
});
