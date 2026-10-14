const SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const NOTE_PATTERN = /^([A-G])(#|b)?(-?\d)$/;

export function noteToMidi(note: string): number {
  const match = NOTE_PATTERN.exec(note);
  if (!match) throw new Error(`Nota inválida: ${note}`);
  const [, letter, accidental, octave] = match;
  const base = SEMITONES[letter];
  const shift = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0;
  return 12 * (Number(octave) + 1) + base + shift;
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function noteToFreq(note: string): number {
  return midiToFreq(noteToMidi(note));
}
