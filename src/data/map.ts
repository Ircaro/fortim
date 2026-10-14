import type { GridPoint, MapDef } from '../core/types';
import { STAGES } from './stages';
import type { Decor } from './stages';

export type { Decor, DecorKind } from './stages';

const VALE = STAGES[0];

export const DECOR: Decor[] = VALE.decor;
export const CASTLE: GridPoint = VALE.castle;
export const MAP: MapDef = VALE.map;
