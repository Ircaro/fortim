import type { SfxName } from './names';
import { midiToFreq, noteToFreq } from './notes';

export type SfxPriority = 'low' | 'high';

export interface ToneLayer {
  readonly kind: 'tone';
  readonly wave: OscillatorType;
  readonly freq: number;
  readonly freqEnd?: number;
  readonly start?: number;
  readonly duration: number;
  readonly attack?: number;
  readonly gain: number;
  readonly vibratoRate?: number;
  readonly vibratoDepth?: number;
  readonly lowpass?: number;
}

export interface NoiseLayer {
  readonly kind: 'noise';
  readonly filter: 'lowpass' | 'highpass' | 'bandpass';
  readonly freq: number;
  readonly freqEnd?: number;
  readonly q?: number;
  readonly start?: number;
  readonly duration: number;
  readonly attack?: number;
  readonly gain: number;
}

export interface BellLayer {
  readonly kind: 'bell';
  readonly freq: number;
  readonly ratio: number;
  readonly index: number;
  readonly start?: number;
  readonly duration: number;
  readonly attack?: number;
  readonly gain: number;
}

export type SfxLayer = ToneLayer | NoiseLayer | BellLayer;

export interface SfxDef {
  readonly volume: number;
  readonly priority: SfxPriority;
  readonly reverb: number;
  readonly layers: readonly SfxLayer[];
}

export const DEFAULT_ATTACK = 0.005;

type ToneExtra = Omit<Partial<ToneLayer>, 'kind'>;
type NoiseExtra = Omit<Partial<NoiseLayer>, 'kind'>;

export function tone(wave: OscillatorType, freq: number, duration: number, gain: number, extra: ToneExtra = {}): ToneLayer {
  return { ...extra, kind: 'tone', wave, freq, duration, gain };
}

export function noise(
  filter: NoiseLayer['filter'],
  freq: number,
  duration: number,
  gain: number,
  extra: NoiseExtra = {},
): NoiseLayer {
  return { ...extra, kind: 'noise', filter, freq, duration, gain };
}

export function bell(midi: number, start: number, gain: number, duration: number): BellLayer {
  return { kind: 'bell', freq: midiToFreq(midi), ratio: 3.5, index: 2.2, start, duration, gain, attack: 0.004 };
}

export function mallet(midi: number, start: number, gain: number, duration = 0.6): ToneLayer[] {
  const freq = midiToFreq(midi);
  return [
    tone('sine', freq, duration, gain, { start, attack: 0.004 }),
    tone('sine', freq * 4, duration * 0.25, gain * 0.25, { start, attack: 0.003 }),
    tone('sine', freq * 10, 0.04, gain * 0.08, { start, attack: 0.002 }),
  ];
}

export function wood(freq: number, start: number, gain: number): SfxLayer[] {
  return [
    tone('sine', freq * 2.2, 0.25, gain, { start, freqEnd: freq, attack: 0.003 }),
    noise('bandpass', 1800, 0.05, gain * 0.4, { start, q: 2, attack: 0.002 }),
  ];
}

export function pad(midis: readonly number[], start: number, duration: number, gain: number, lowpass = 2200, attack = 0.06): ToneLayer[] {
  return midis.map((midi) => tone('triangle', midiToFreq(midi), duration, gain, { start, attack, lowpass }));
}

export const SFX_DEFS: Record<SfxName, SfxDef> = {
  click: {
    volume: 0.32,
    priority: 'high',
    reverb: 0.08,
    layers: [tone('sine', 1320, 0.07, 0.3, { attack: 0.002 }), tone('sine', 2640, 0.03, 0.06, { attack: 0.002 })],
  },
  error: {
    volume: 0.38,
    priority: 'high',
    reverb: 0.15,
    layers: [
      tone('triangle', noteToFreq('A3'), 0.14, 0.32, { freqEnd: noteToFreq('G3'), lowpass: 900, attack: 0.006 }),
      tone('triangle', noteToFreq('F3'), 0.2, 0.3, { start: 0.12, lowpass: 900, attack: 0.006 }),
    ],
  },
  build: {
    volume: 0.45,
    priority: 'high',
    reverb: 0.25,
    layers: [...mallet(60, 0, 0.4), ...mallet(67, 0.08, 0.35), noise('lowpass', 900, 0.08, 0.15, { attack: 0.003 })],
  },
  upgrade: {
    volume: 0.42,
    priority: 'high',
    reverb: 0.35,
    layers: [72, 76, 79, 84].flatMap((midi, i) => mallet(midi, i * 0.07, 0.3, 0.7)),
  },
  sell: {
    volume: 0.4,
    priority: 'high',
    reverb: 0.3,
    layers: [bell(91, 0, 0.14, 0.7), bell(96, 0.07, 0.12, 0.8)],
  },
  shoot_flecha: {
    volume: 0.28,
    priority: 'low',
    reverb: 0.05,
    layers: [
      noise('bandpass', 3200, 0.16, 0.22, { freqEnd: 900, q: 1.4, attack: 0.02 }),
      tone('sine', 900, 0.08, 0.06, { freqEnd: 500 }),
    ],
  },
  shoot_bala: {
    volume: 0.38,
    priority: 'low',
    reverb: 0.12,
    layers: [tone('sine', 160, 0.18, 0.5, { freqEnd: 70, attack: 0.003 }), noise('lowpass', 600, 0.12, 0.2, { attack: 0.003 })],
  },
  shoot_gelo: {
    volume: 0.3,
    priority: 'low',
    reverb: 0.4,
    layers: [bell(88, 0, 0.1, 0.5), bell(95, 0.035, 0.1, 0.5), bell(100, 0.07, 0.1, 0.5), noise('highpass', 6000, 0.25, 0.05)],
  },
  shoot_magia: {
    volume: 0.3,
    priority: 'low',
    reverb: 0.45,
    layers: [
      tone('sine', 400, 0.45, 0.2, { freqEnd: 1400, attack: 0.01 }),
      tone('triangle', 800, 0.4, 0.08, { start: 0.05, freqEnd: 2400, attack: 0.01 }),
    ],
  },
  shoot_virote: {
    volume: 0.34,
    priority: 'low',
    reverb: 0.1,
    layers: [
      tone('sine', 300, 0.12, 0.4, { freqEnd: 120, attack: 0.003 }),
      noise('bandpass', 1200, 0.06, 0.25, { q: 1.5, attack: 0.002 }),
      noise('highpass', 3000, 0.1, 0.1, { attack: 0.01 }),
    ],
  },
  explosion: {
    volume: 0.42,
    priority: 'low',
    reverb: 0.25,
    layers: [tone('sine', 120, 0.5, 0.6, { freqEnd: 38, attack: 0.004 }), noise('lowpass', 900, 0.6, 0.35, { freqEnd: 120, attack: 0.004 })],
  },
  hit: {
    volume: 0.2,
    priority: 'low',
    reverb: 0,
    layers: [tone('sine', 700, 0.05, 0.2, { freqEnd: 420, attack: 0.002 })],
  },
  enemy_die: {
    volume: 0.3,
    priority: 'low',
    reverb: 0.15,
    layers: [tone('sine', 700, 0.14, 0.25, { freqEnd: 220, attack: 0.003 }), noise('bandpass', 1400, 0.1, 0.12, { q: 2, attack: 0.003 })],
  },
  leak: {
    volume: 0.45,
    priority: 'high',
    reverb: 0.3,
    layers: [
      tone('triangle', noteToFreq('G3'), 0.35, 0.3, { lowpass: 900, attack: 0.01 }),
      tone('triangle', noteToFreq('F#3'), 0.4, 0.3, { start: 0.18, lowpass: 900, attack: 0.01 }),
      tone('sine', noteToFreq('G2'), 0.6, 0.3, { attack: 0.01 }),
    ],
  },
  wave_start: {
    volume: 0.45,
    priority: 'high',
    reverb: 0.4,
    layers: [...pad([60, 67, 72], 0, 0.8, 0.12), ...pad([62, 69, 74], 0.35, 0.8, 0.12), ...wood(90, 0, 0.4), ...wood(90, 0.35, 0.4)],
  },
  wave_clear: {
    volume: 0.45,
    priority: 'high',
    reverb: 0.45,
    layers: [...mallet(72, 0, 0.3, 0.9), ...mallet(76, 0.1, 0.3, 0.9), ...mallet(79, 0.2, 0.3, 0.9), bell(84, 0.3, 0.12, 1.2)],
  },
  victory: {
    volume: 0.48,
    priority: 'high',
    reverb: 0.55,
    layers: [...[72, 76, 79, 84, 88].flatMap((midi, i) => mallet(midi, i * 0.11, 0.3, 1)), ...pad([60, 64, 67, 72], 0.55, 1.6, 0.08, 2500, 0.08)],
  },
  defeat: {
    volume: 0.45,
    priority: 'high',
    reverb: 0.55,
    layers: [...[76, 72, 69, 64].flatMap((midi, i) => mallet(midi, i * 0.25, 0.22, 1)), ...pad([57, 60, 64], 1, 1.8, 0.07, 1200, 0.2)],
  },
};

export function layerEnd(layer: SfxLayer): number {
  return (layer.start ?? 0) + layer.duration;
}

export function sfxDuration(def: SfxDef): number {
  return def.layers.reduce((max, layer) => Math.max(max, layerEnd(layer)), 0);
}
