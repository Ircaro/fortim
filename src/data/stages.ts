import type { GridPoint, MapDef, WaveDef } from '../core/types';
import { CERCO_WAVES, DESFILADEIRO_WAVES, ENCRUZILHADA_WAVES, FLORESTA_WAVES, WAVES } from './waves';

export type DecorKind = 'arvore' | 'pedra';

export interface Decor extends GridPoint {
  kind: DecorKind;
}

export type StageDifficulty = 'facil' | 'medio' | 'dificil';

export interface StageDef {
  id: string;
  name: string;
  difficulty: StageDifficulty;
  description: string;
  map: MapDef;
  decor: Decor[];
  castle: GridPoint;
  waves: WaveDef[];
  startingGold: number;
}

const COLS = 16;
const ROWS = 10;

function pts(list: [number, number][]): GridPoint[] {
  return list.map(([col, row]) => ({ col, row }));
}

function decor(kind: DecorKind, list: [number, number][]): Decor[] {
  return list.map(([col, row]) => ({ col, row, kind }));
}

function routeCells(paths: GridPoint[][]): Set<string> {
  const cells = new Set<string>();
  for (const route of paths) {
    for (let i = 0; i < route.length - 1; i++) {
      const a = route[i];
      const b = route[i + 1];
      const dc = Math.sign(b.col - a.col);
      const dr = Math.sign(b.row - a.row);
      let col = a.col;
      let row = a.row;
      for (;;) {
        cells.add(`${col},${row}`);
        if (col === b.col && row === b.row) break;
        col += dc;
        row += dr;
      }
    }
  }
  return cells;
}

function buildMap(name: string, paths: GridPoint[][], castle: GridPoint, items: Decor[]): MapDef {
  const road = routeCells(paths);
  const near = [
    { col: castle.col, row: castle.row - 1 },
    { col: castle.col + 1, row: castle.row },
    { col: castle.col, row: castle.row + 1 },
    { col: castle.col - 1, row: castle.row },
  ].filter((c) => c.col >= 0 && c.row >= 0 && c.col < COLS && c.row < ROWS && !road.has(`${c.col},${c.row}`));
  return {
    name,
    cols: COLS,
    rows: ROWS,
    paths,
    blocked: [...items.map(({ col, row }) => ({ col, row })), ...near],
  };
}

function stage(def: Omit<StageDef, 'map'> & { paths: GridPoint[][] }): StageDef {
  const { paths, ...rest } = def;
  return { ...rest, map: buildMap(def.name, paths, def.castle, def.decor) };
}

const VALE_DECOR: Decor[] = [
  { col: 0, row: 0, kind: 'arvore' },
  { col: 1, row: 0, kind: 'arvore' },
  { col: 7, row: 0, kind: 'arvore' },
  { col: 15, row: 0, kind: 'arvore' },
  { col: 0, row: 8, kind: 'arvore' },
  { col: 1, row: 9, kind: 'arvore' },
  { col: 5, row: 9, kind: 'pedra' },
  { col: 15, row: 9, kind: 'arvore' },
  { col: 14, row: 4, kind: 'pedra' },
  { col: 6, row: 1, kind: 'pedra' },
  { col: 11, row: 9, kind: 'arvore' },
  { col: 15, row: 3, kind: 'arvore' },
  { col: 2, row: 6, kind: 'pedra' },
  { col: 7, row: 5, kind: 'arvore' },
];

export const STAGES: StageDef[] = [
  stage({
    id: 'vale',
    name: 'Vale do Fortim',
    difficulty: 'facil',
    description: 'Uma trilha só, com curvas largas e bastante espaço para construir.',
    paths: [pts([[-1, 2], [4, 2], [4, 7], [9, 7], [9, 3], [13, 3], [13, 7], [15, 7]])],
    castle: { col: 15, row: 7 },
    decor: VALE_DECOR,
    waves: WAVES,
    startingGold: 220,
  }),
  stage({
    id: 'floresta',
    name: 'Floresta Sinuosa',
    difficulty: 'facil',
    description: 'Uma trilha longa que serpenteia entre as árvores. Curandeiros e lodos aparecem.',
    paths: [pts([[-1, 1], [14, 1], [14, 4], [1, 4], [1, 7], [15, 7]])],
    castle: { col: 15, row: 7 },
    decor: [
      ...decor('arvore', [[0, 3], [3, 2], [7, 2], [11, 2], [15, 3], [4, 6], [9, 6], [13, 5], [0, 9], [5, 9], [12, 9], [15, 9]]),
      ...decor('pedra', [[8, 9]]),
    ],
    waves: FLORESTA_WAVES,
    startingGold: 220,
  }),
  stage({
    id: 'desfiladeiro',
    name: 'Desfiladeiro',
    difficulty: 'medio',
    description: 'Um cânion estreito onde a trilha cruza a si mesma. Poucos lugares para construir, mas a ponte rende em dobro.',
    paths: [pts([[-1, 3], [11, 3], [11, 8], [6, 8], [6, 1], [14, 1], [14, 6], [15, 6]])],
    castle: { col: 15, row: 6 },
    decor: [
      ...decor('pedra', [
        [0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [0, 5], [0, 6], [1, 6], [0, 7], [0, 8], [1, 8], [0, 9], [1, 9], [2, 9], [3, 9],
        [4, 9], [8, 0], [9, 0], [10, 0], [15, 0], [15, 1], [15, 2], [13, 8], [14, 8], [15, 8], [15, 9], [12, 9], [13, 9], [8, 5], [9, 5],
      ]),
      ...decor('arvore', [[3, 6], [4, 5], [12, 5], [13, 3], [9, 9], [10, 9]]),
    ],
    waves: DESFILADEIRO_WAVES,
    startingGold: 220,
  }),
  stage({
    id: 'encruzilhada',
    name: 'Encruzilhada',
    difficulty: 'dificil',
    description: 'Duas entradas em zigue-zague que se juntam no meio. Defenda o cruzamento e a reta final.',
    paths: [
      pts([[-1, 1], [5, 1], [5, 4], [8, 4], [11, 4], [11, 1], [14, 1], [14, 8], [15, 8]]),
      pts([[-1, 8], [4, 8], [4, 6], [8, 6], [8, 4], [11, 4], [11, 1], [14, 1], [14, 8], [15, 8]]),
    ],
    castle: { col: 15, row: 8 },
    decor: [
      ...decor('arvore', [[1, 3], [2, 5], [0, 6], [7, 2], [9, 2], [12, 6], [13, 4]]),
      ...decor('pedra', [[6, 8], [10, 7], [2, 3]]),
    ],
    waves: ENCRUZILHADA_WAVES,
    startingGold: 240,
  }),
  stage({
    id: 'cerco',
    name: 'Cerco ao Fortim',
    difficulty: 'dificil',
    description: 'O castelo fica no centro e os inimigos chegam em espiral pelos dois lados.',
    paths: [
      pts([[-1, 1], [6, 1], [6, 3], [2, 3], [2, 7], [7, 7], [7, 5], [8, 5]]),
      pts([[16, 1], [13, 1], [13, 8], [10, 8], [10, 5], [8, 5]]),
    ],
    castle: { col: 8, row: 5 },
    decor: [
      ...decor('arvore', [[0, 5], [4, 5], [11, 3], [15, 5], [5, 9], [11, 9], [15, 9], [0, 9], [9, 0]]),
      ...decor('pedra', [[9, 2], [4, 8], [12, 6]]),
    ],
    waves: CERCO_WAVES,
    startingGold: 300,
  }),
];

export const STAGE_IDS: string[] = STAGES.map((s) => s.id);

export function stageById(id: string): StageDef | undefined {
  return STAGES.find((s) => s.id === id);
}
