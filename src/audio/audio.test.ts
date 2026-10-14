import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioEngine, CHANNELS_KEY, DEFAULT_VOLUME, MUTE_KEY, VOLUME_KEY, clampVolume } from './engine';
import type { MuteStorage } from './engine';
import { audio, SFX_NAMES } from './index';
import { VoiceLimiter } from './limiter';
import { SONG, barLength, buildTimeline, flattenVoice, songLengthSteps, stepDuration } from './music';
import { midiToFreq, noteToFreq, noteToMidi } from './notes';
import { DEFAULT_ATTACK, SFX_DEFS, sfxDuration } from './sfx';

class FakeParam {
  value = 0;
  readonly events: [string, number, number][] = [];
  setValueAtTime(value: number, time: number): this {
    this.events.push(['set', value, time]);
    this.value = value;
    return this;
  }
  linearRampToValueAtTime(value: number, time: number): this {
    this.events.push(['linear', value, time]);
    return this;
  }
  exponentialRampToValueAtTime(value: number, time: number): this {
    if (!(value > 0)) throw new RangeError('rampa exponencial exige valor positivo');
    this.events.push(['exp', value, time]);
    return this;
  }
  cancelScheduledValues(): this {
    return this;
  }
}

class FakeNode {
  readonly gain = new FakeParam();
  readonly frequency = new FakeParam();
  readonly Q = new FakeParam();
  readonly threshold = new FakeParam();
  readonly knee = new FakeParam();
  readonly ratio = new FakeParam();
  readonly attack = new FakeParam();
  readonly release = new FakeParam();
  type = '';
  buffer: unknown = null;
  loop = false;
  onended: (() => void) | null = null;
  started = false;
  connect<T>(node: T): T {
    return node;
  }
  disconnect(): void {}
  start(): void {
    this.started = true;
  }
  stop(): void {}
}

class FakeContext {
  currentTime = 0;
  state: 'running' | 'suspended' = 'running';
  readonly sampleRate = 8000;
  readonly destination = new FakeNode();
  oscillators = 0;
  noises = 0;
  createGain(): FakeNode {
    return new FakeNode();
  }
  createOscillator(): FakeNode {
    this.oscillators++;
    return new FakeNode();
  }
  createBufferSource(): FakeNode {
    this.noises++;
    return new FakeNode();
  }
  createBiquadFilter(): FakeNode {
    return new FakeNode();
  }
  createDynamicsCompressor(): FakeNode {
    return new FakeNode();
  }
  createConvolver(): FakeNode {
    return new FakeNode();
  }
  createBuffer(_channels: number, length: number): { getChannelData: () => Float32Array } {
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }
  resume(): Promise<void> {
    this.state = 'running';
    return Promise.resolve();
  }
  suspend(): Promise<void> {
    this.state = 'suspended';
    return Promise.resolve();
  }
}

function memoryStorage(initial: Record<string, string> = {}): MuteStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

function fakeEngine(storage = memoryStorage()): { engine: AudioEngine; ctx: FakeContext } {
  const ctx = new FakeContext();
  const engine = new AudioEngine({
    createContext: () => ctx as unknown as AudioContext,
    storage: () => storage,
  });
  return { engine, ctx };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('notas', () => {
  it('converte A4 em 440 Hz e respeita oitavas', () => {
    expect(noteToFreq('A4')).toBeCloseTo(440, 6);
    expect(noteToFreq('A5')).toBeCloseTo(880, 6);
    expect(noteToFreq('A3')).toBeCloseTo(220, 6);
    expect(noteToFreq('C4')).toBeCloseTo(261.6256, 3);
    expect(noteToFreq('E5')).toBeCloseTo(659.2551, 3);
  });

  it('trata sustenidos, bemóis e MIDI', () => {
    expect(noteToMidi('C4')).toBe(60);
    expect(noteToMidi('A4')).toBe(69);
    expect(noteToMidi('F#4')).toBe(noteToMidi('Gb4'));
    expect(noteToMidi('B3')).toBe(59);
    expect(midiToFreq(69)).toBe(440);
    expect(() => noteToFreq('H2')).toThrow();
  });
});

describe('música', () => {
  it('tem andamento por volta de 90 BPM', () => {
    expect(SONG.bpm).toBeGreaterThanOrEqual(80);
    expect(SONG.bpm).toBeLessThanOrEqual(100);
    expect(stepDuration(SONG)).toBeCloseTo(60 / SONG.bpm / SONG.stepsPerBeat, 9);
  });

  it('tem entre 2 e 3 vozes com volume baixo', () => {
    expect(SONG.voices.length).toBeGreaterThanOrEqual(2);
    expect(SONG.voices.length).toBeLessThanOrEqual(6);
    for (const voice of SONG.voices) expect(voice.gain).toBeLessThanOrEqual(0.15);
  });

  it('todo compasso de toda voz soma a mesma duração', () => {
    for (const voice of SONG.voices) {
      for (const bar of voice.bars) expect(barLength(bar)).toBe(SONG.stepsPerBar);
    }
  });

  it('todas as vozes têm o mesmo número de compassos', () => {
    const counts = new Set(SONG.voices.map((voice) => voice.bars.length));
    expect(counts.size).toBe(1);
    expect(songLengthSteps(SONG)).toBe(SONG.voices[0].bars.length * SONG.stepsPerBar);
  });

  it('usa apenas notas de lá menor, com o sol sustenido da dominante', () => {
    const allowed = new Set([9, 11, 0, 2, 4, 5, 7, 8]);
    for (const voice of SONG.voices) {
      for (const bar of voice.bars) {
        for (const [note] of bar) {
          if (note !== null) expect(allowed.has(noteToMidi(note) % 12)).toBe(true);
        }
      }
    }
  });

  it('monta a linha do tempo sem notas além do fim do loop', () => {
    const timeline = buildTimeline(SONG);
    const total = songLengthSteps(SONG);
    expect(timeline.length).toBe(total);
    SONG.voices.forEach((voice, index) => {
      for (const event of flattenVoice(voice, index)) {
        expect(event.step + event.steps).toBeLessThanOrEqual(total);
        expect(event.freq).toBeGreaterThan(20);
      }
    });
    const scheduled = timeline.reduce((sum, events) => sum + events.length, 0);
    const expected = SONG.voices.reduce((sum, voice, index) => sum + flattenVoice(voice, index).length, 0);
    expect(scheduled).toBe(expected);
  });
});

describe('efeitos', () => {
  it('toda SfxName tem definição', () => {
    for (const name of SFX_NAMES) {
      expect(SFX_DEFS[name]).toBeDefined();
      expect(SFX_DEFS[name].layers.length).toBeGreaterThan(0);
    }
    expect(Object.keys(SFX_DEFS).sort()).toEqual([...SFX_NAMES].sort());
  });

  it('definições têm parâmetros válidos para o WebAudio', () => {
    for (const name of SFX_NAMES) {
      const def = SFX_DEFS[name];
      expect(def.volume).toBeGreaterThan(0);
      expect(def.volume).toBeLessThanOrEqual(1);
      for (const layer of def.layers) {
        expect(layer.duration).toBeGreaterThan(0);
        expect(layer.gain).toBeGreaterThan(0);
        expect(layer.freq).toBeGreaterThan(0);
        expect(layer.start ?? 0).toBeGreaterThanOrEqual(0);
        expect(layer.attack ?? DEFAULT_ATTACK).toBeLessThan(layer.duration);
        if ('freqEnd' in layer && layer.freqEnd !== undefined) expect(layer.freqEnd).toBeGreaterThan(0);
      }
    }
  });

  it('sons de combate são curtos e de baixa prioridade', () => {
    const combat = ['shoot_flecha', 'shoot_bala', 'shoot_gelo', 'shoot_magia', 'shoot_virote', 'hit', 'enemy_die', 'explosion'] as const;
    for (const name of combat) {
      expect(SFX_DEFS[name].priority).toBe('low');
      expect(sfxDuration(SFX_DEFS[name])).toBeLessThanOrEqual(0.7);
    }
    expect(sfxDuration(SFX_DEFS.hit)).toBeLessThanOrEqual(0.06);
    expect(sfxDuration(SFX_DEFS.victory)).toBeGreaterThan(sfxDuration(SFX_DEFS.wave_clear));
  });
});

describe('limitador de vozes', () => {
  it('bloqueia o mesmo nome antes de 60 ms', () => {
    const limiter = new VoiceLimiter<number>(10, 0.06);
    expect(limiter.admit('hit', 0, 1, 'low', 1).admitted).toBe(true);
    expect(limiter.admit('hit', 0.03, 1, 'low', 2).admitted).toBe(false);
    expect(limiter.admit('hit', 0.06, 1, 'low', 3).admitted).toBe(true);
    expect(limiter.admit('click', 0.06, 1, 'high', 4).admitted).toBe(true);
  });

  it('limita o total de vozes simultâneas e libera as que terminaram', () => {
    const limiter = new VoiceLimiter<number>(10, 0.06);
    for (let i = 0; i < 10; i++) expect(limiter.admit(`som${i}`, 0, 1, 'low', i).admitted).toBe(true);
    expect(limiter.admit('extra', 0, 1, 'low', 99).admitted).toBe(false);
    expect(limiter.activeCount(0.5)).toBe(10);
    expect(limiter.activeCount(1)).toBe(0);
    expect(limiter.admit('extra', 1, 2, 'low', 99).admitted).toBe(true);
  });

  it('som importante substitui a voz de combate mais antiga', () => {
    const limiter = new VoiceLimiter<number>(3, 0.06);
    limiter.admit('a', 0, 5, 'high', 1);
    limiter.admit('b', 0.1, 5, 'low', 2);
    limiter.admit('c', 0.2, 5, 'low', 3);
    const result = limiter.admit('victory', 0.3, 5, 'high', 4);
    expect(result.admitted).toBe(true);
    expect(result.evicted).toBe(2);
    expect(limiter.activeCount(0.3)).toBe(3);
  });
});

describe('motor de áudio', () => {
  it('em Node nada lança erro', () => {
    expect(() => {
      audio.unlock();
      for (const name of SFX_NAMES) audio.play(name);
      audio.startMusic();
      audio.startMusic();
      audio.setMuted(true);
      audio.setMuted(false);
      audio.stopMusic();
      audio.stopMusic();
    }).not.toThrow();
    expect(audio.isMuted()).toBe(false);
  });

  it('sem AudioContext vira no-op', () => {
    const engine = new AudioEngine({ createContext: () => null, storage: () => null });
    expect(() => {
      engine.unlock();
      engine.play('explosion');
      engine.startMusic();
    }).not.toThrow();
    expect(engine.isMusicPlaying()).toBe(false);
  });

  it('não toca nada antes do unlock', () => {
    const { engine, ctx } = fakeEngine();
    engine.play('click');
    expect(ctx.oscillators).toBe(0);
  });

  it('renderiza todos os efeitos com um contexto falso', () => {
    const { engine, ctx } = fakeEngine();
    engine.unlock();
    for (const name of SFX_NAMES) {
      ctx.currentTime += 1;
      expect(() => engine.play(name)).not.toThrow();
    }
    expect(ctx.oscillators).toBeGreaterThan(SFX_NAMES.length);
    expect(ctx.noises).toBeGreaterThan(0);
  });

  it('aplica o limite por nome e o teto de vozes', () => {
    const { engine, ctx } = fakeEngine();
    engine.unlock();
    engine.play('hit');
    const afterFirst = ctx.oscillators;
    engine.play('hit');
    expect(ctx.oscillators).toBe(afterFirst);
    ctx.currentTime = 0.1;
    for (const name of ['shoot_flecha', 'shoot_bala', 'shoot_gelo', 'shoot_magia', 'shoot_virote', 'explosion', 'enemy_die'] as const) {
      engine.play(name);
    }
    ctx.currentTime = 0.2;
    for (const name of ['shoot_flecha', 'shoot_bala', 'shoot_gelo', 'shoot_magia', 'shoot_virote'] as const) engine.play(name);
    expect(engine.activeVoices()).toBeLessThanOrEqual(10);
  });

  it('silencia, persiste e lê o mudo do armazenamento', () => {
    const storage = memoryStorage();
    const { engine, ctx } = fakeEngine(storage);
    engine.unlock();
    engine.setMuted(true);
    expect(engine.isMuted()).toBe(true);
    expect(storage.data[MUTE_KEY]).toBe('1');
    const before = ctx.oscillators;
    engine.play('click');
    expect(ctx.oscillators).toBe(before);
    expect(engine.toggleMuted()).toBe(false);
    expect(storage.data[MUTE_KEY]).toBe('0');
    const reloaded = new AudioEngine({ createContext: () => null, storage: () => memoryStorage({ [MUTE_KEY]: '1' }) });
    expect(reloaded.isMuted()).toBe(true);
  });

  it('ajusta, limita e persiste o volume de música e de efeitos', () => {
    const storage = memoryStorage();
    const { engine } = fakeEngine(storage);
    expect(engine.getVolume('musica')).toBe(DEFAULT_VOLUME);
    expect(engine.getVolume('efeitos')).toBe(DEFAULT_VOLUME);
    engine.unlock();
    engine.setVolume('musica', 0.25);
    engine.setVolume('efeitos', 3);
    expect(engine.getVolume('musica')).toBe(0.25);
    expect(engine.getVolume('efeitos')).toBe(1);
    expect(JSON.parse(storage.data[VOLUME_KEY])).toEqual({ musica: 0.25, efeitos: 1 });
    const reloaded = new AudioEngine({ createContext: () => null, storage: () => memoryStorage({ [VOLUME_KEY]: '{"musica":0,"efeitos":0.5}' }) });
    expect(reloaded.getVolume('musica')).toBe(0);
    expect(reloaded.getVolume('efeitos')).toBe(0.5);
    expect(clampVolume(Number.NaN)).toBe(DEFAULT_VOLUME);
    expect(clampVolume(-1)).toBe(0);
  });

  it('liga e desliga música e efeitos separadamente e lembra a escolha', () => {
    const storage = memoryStorage();
    const { engine, ctx } = fakeEngine(storage);
    expect(engine.isEnabled('musica')).toBe(true);
    expect(engine.isEnabled('efeitos')).toBe(true);
    engine.unlock();
    engine.startMusic();
    expect(engine.isMusicPlaying()).toBe(true);
    engine.setEnabled('musica', false);
    expect(engine.isMusicPlaying()).toBe(false);
    expect(engine.toggleEnabled('efeitos')).toBe(false);
    const before = ctx.oscillators;
    engine.play('click');
    expect(ctx.oscillators).toBe(before);
    expect(JSON.parse(storage.data[CHANNELS_KEY])).toEqual({ musica: false, efeitos: false });
    engine.setEnabled('musica', true);
    expect(engine.isMusicPlaying()).toBe(true);
    const reloaded = new AudioEngine({ createContext: () => null, storage: () => memoryStorage({ [CHANNELS_KEY]: '{"musica":false}' }) });
    expect(reloaded.isEnabled('musica')).toBe(false);
    expect(reloaded.isEnabled('efeitos')).toBe(true);
  });

  it('armazenamento quebrado não derruba o jogo', () => {
    const broken: MuteStorage = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
    };
    const engine = new AudioEngine({ createContext: () => null, storage: () => broken });
    expect(engine.isMuted()).toBe(false);
    expect(() => engine.setMuted(true)).not.toThrow();
    expect(engine.isMuted()).toBe(true);
  });

  it('música agenda notas à frente, não reinicia e para com fade', () => {
    vi.useFakeTimers();
    const { engine, ctx } = fakeEngine();
    engine.startMusic();
    expect(engine.isMusicPlaying()).toBe(false);
    engine.unlock();
    expect(engine.isMusicPlaying()).toBe(true);
    const afterStart = ctx.oscillators;
    expect(afterStart).toBeGreaterThan(0);
    engine.startMusic();
    expect(ctx.oscillators).toBe(afterStart);
    for (let i = 0; i < 160; i++) {
      ctx.currentTime += 0.025;
      vi.advanceTimersByTime(25);
    }
    expect(ctx.oscillators).toBeGreaterThan(afterStart);
    engine.stopMusic();
    expect(engine.isMusicPlaying()).toBe(false);
    const afterStop = ctx.oscillators;
    ctx.currentTime += 2;
    vi.advanceTimersByTime(2000);
    expect(ctx.oscillators).toBe(afterStop);
  });
});
