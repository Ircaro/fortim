import { noteToFreq } from './notes';

export type MusicStep = readonly [note: string | null, steps: number];
export type MusicBar = readonly MusicStep[];

export interface MusicVoice {
  readonly name: string;
  readonly wave: OscillatorType;
  readonly gain: number;
  readonly attack: number;
  readonly legato: number;
  readonly lowpass?: number;
  readonly vibrato?: boolean;
  readonly timbre?: 'mallet';
  readonly reverb?: number;
  readonly bars: readonly MusicBar[];
}

export interface MusicSong {
  readonly bpm: number;
  readonly stepsPerBeat: number;
  readonly stepsPerBar: number;
  readonly voices: readonly MusicVoice[];
}

export interface NoteEvent {
  readonly voice: number;
  readonly step: number;
  readonly steps: number;
  readonly freq: number;
}

const PROGRESSION: readonly (readonly [string, string, string])[] = [
  ['A3', 'C4', 'E4'],
  ['F3', 'A3', 'C4'],
  ['G3', 'C4', 'E4'],
  ['G3', 'B3', 'D4'],
  ['A3', 'C4', 'E4'],
  ['F3', 'A3', 'C4'],
  ['G3', 'B3', 'D4'],
  ['G#3', 'B3', 'E4'],
];

const BASS_ROOTS: readonly string[] = ['A2', 'F2', 'C3', 'G2', 'A2', 'F2', 'G2', 'E2'];

const MELODY: readonly MusicBar[] = [
  [['E5', 4], [null, 4], ['C5', 4], ['D5', 4]],
  [['A4', 8], ['C5', 4], [null, 4]],
  [['G4', 4], ['C5', 4], ['E5', 8]],
  [['D5', 8], [null, 8]],
  [['E5', 4], ['A5', 4], ['G5', 4], ['E5', 4]],
  [['F5', 8], ['E5', 4], ['C5', 4]],
  [['D5', 4], ['B4', 4], ['G4', 8]],
  [['B4', 8], [null, 8]],
];

function padVoice(name: string, index: 0 | 1 | 2): MusicVoice {
  return {
    name,
    wave: 'triangle',
    gain: 0.045,
    attack: 0.4,
    legato: 1,
    lowpass: 1600,
    reverb: 0.6,
    bars: PROGRESSION.map((chord): MusicBar => [[chord[index], 16]]),
  };
}

const ARP_ORDER = [0, 1, 2, 1, 0, 1, 2, 1] as const;

export function arpeggioBar(chord: readonly [string, string, string], stepsEach = 2): MusicBar {
  return ARP_ORDER.map((index): MusicStep => [chord[index], stepsEach]);
}

export function bassBar(notes: readonly [string, string]): MusicBar {
  return [
    [notes[0], 6],
    [notes[0], 2],
    [notes[1], 6],
    [notes[1], 2],
  ];
}

export const SONG: MusicSong = {
  bpm: 92,
  stepsPerBeat: 4,
  stepsPerBar: 16,
  voices: [
    {
      name: 'marimba',
      wave: 'sine',
      gain: 0.12,
      attack: 0.004,
      legato: 1,
      timbre: 'mallet',
      reverb: 0.5,
      bars: MELODY,
    },
    padVoice('acorde grave', 0),
    padVoice('acorde médio', 1),
    padVoice('acorde agudo', 2),
    {
      name: 'baixo',
      wave: 'sine',
      gain: 0.11,
      attack: 0.05,
      legato: 0.95,
      reverb: 0.1,
      bars: BASS_ROOTS.map((root): MusicBar => [[root, 16]]),
    },
  ],
};

export function stepDuration(song: MusicSong): number {
  return 60 / song.bpm / song.stepsPerBeat;
}

export function barLength(bar: MusicBar): number {
  return bar.reduce((sum, [, steps]) => sum + steps, 0);
}

export function songLengthSteps(song: MusicSong): number {
  return song.voices.reduce((max, voice) => Math.max(max, voice.bars.length * song.stepsPerBar), 0);
}

export function flattenVoice(voice: MusicVoice, voiceIndex: number): NoteEvent[] {
  const events: NoteEvent[] = [];
  let step = 0;
  for (const bar of voice.bars) {
    for (const [note, steps] of bar) {
      if (note !== null) events.push({ voice: voiceIndex, step, steps, freq: noteToFreq(note) });
      step += steps;
    }
  }
  return events;
}

export function buildTimeline(song: MusicSong): NoteEvent[][] {
  const total = songLengthSteps(song);
  const timeline: NoteEvent[][] = Array.from({ length: total }, () => []);
  song.voices.forEach((voice, index) => {
    for (const event of flattenVoice(voice, index)) {
      if (event.step < total) timeline[event.step].push(event);
    }
  });
  return timeline;
}
