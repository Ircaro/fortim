export type SfxName =
  | 'click'
  | 'error'
  | 'build'
  | 'upgrade'
  | 'sell'
  | 'shoot_flecha'
  | 'shoot_bala'
  | 'shoot_gelo'
  | 'shoot_magia'
  | 'shoot_virote'
  | 'explosion'
  | 'hit'
  | 'enemy_die'
  | 'leak'
  | 'wave_start'
  | 'wave_clear'
  | 'victory'
  | 'defeat';

export const SFX_NAMES = [
  'click',
  'error',
  'build',
  'upgrade',
  'sell',
  'shoot_flecha',
  'shoot_bala',
  'shoot_gelo',
  'shoot_magia',
  'shoot_virote',
  'explosion',
  'hit',
  'enemy_die',
  'leak',
  'wave_start',
  'wave_clear',
  'victory',
  'defeat',
] as const satisfies readonly SfxName[];
