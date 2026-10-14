import { VoiceLimiter } from './limiter';
import { SONG, buildTimeline, stepDuration } from './music';
import type { MusicSong, NoteEvent } from './music';
import type { SfxName } from './names';
import { DEFAULT_ATTACK, SFX_DEFS, sfxDuration } from './sfx';
import type { BellLayer, NoiseLayer, SfxDef, ToneLayer } from './sfx';

export const MUTE_KEY = 'fortim:mudo';
export const VOLUME_KEY = 'fortim:volume';
export const DEFAULT_VOLUME = 0.8;

export const CHANNELS_KEY = 'fortim:canais';
export const REVERB_SECONDS = 2.4;
export const REVERB_DECAY = 3;

export type VolumeChannel = 'musica' | 'efeitos';
export type Volumes = Record<VolumeChannel, number>;
export type ChannelsEnabled = Record<VolumeChannel, boolean>;
export const MASTER_VOLUME = 0.8;
export const SFX_BUS_VOLUME = 0.9;
export const MUSIC_BUS_VOLUME = 0.55;
export const MUSIC_LOOKAHEAD = 0.15;
export const MUSIC_TICK_MS = 25;
export const MUSIC_FADE_IN = 1.5;
export const MUSIC_FADE_OUT = 0.8;

const SILENT = 0.0001;

export interface MuteStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface AudioEngineOptions {
  readonly createContext?: () => AudioContext | null;
  readonly storage?: () => MuteStorage | null;
  readonly song?: MusicSong;
}

interface Voice {
  out: GainNode | null;
  sources: AudioScheduledSourceNode[];
}

type AudioContextCtor = new () => AudioContext;

function defaultCreateContext(): AudioContext | null {
  const scope = globalThis as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  const Ctor = scope.AudioContext ?? scope.webkitAudioContext;
  return Ctor ? new Ctor() : null;
}

function defaultStorage(): MuteStorage | null {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

export function readMuted(storage: () => MuteStorage | null): boolean {
  try {
    return storage()?.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeMuted(storage: () => MuteStorage | null, muted: boolean): void {
  try {
    storage()?.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    return;
  }
}

export function clampVolume(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : DEFAULT_VOLUME;
}

export function readVolumes(storage: () => MuteStorage | null): Volumes {
  try {
    const raw = storage()?.getItem(VOLUME_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<Volumes>) : {};
    return {
      musica: clampVolume(typeof parsed.musica === 'number' ? parsed.musica : DEFAULT_VOLUME),
      efeitos: clampVolume(typeof parsed.efeitos === 'number' ? parsed.efeitos : DEFAULT_VOLUME),
    };
  } catch {
    return { musica: DEFAULT_VOLUME, efeitos: DEFAULT_VOLUME };
  }
}

export function writeVolumes(storage: () => MuteStorage | null, volumes: Volumes): void {
  try {
    storage()?.setItem(VOLUME_KEY, JSON.stringify(volumes));
  } catch {
    return;
  }
}

export function readChannels(storage: () => MuteStorage | null): ChannelsEnabled {
  try {
    const raw = storage()?.getItem(CHANNELS_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<ChannelsEnabled>) : {};
    return { musica: parsed.musica !== false, efeitos: parsed.efeitos !== false };
  } catch {
    return { musica: true, efeitos: true };
  }
}

export function writeChannels(storage: () => MuteStorage | null, channels: ChannelsEnabled): void {
  try {
    storage()?.setItem(CHANNELS_KEY, JSON.stringify(channels));
  } catch {
    return;
  }
}

function makeImpulse(ctx: AudioContext): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * REVERB_SECONDS));
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, REVERB_DECAY);
  }
  return buffer;
}

function envelope(param: AudioParam, start: number, attack: number, duration: number, peak: number): void {
  const safeAttack = Math.min(attack, duration * 0.5);
  param.setValueAtTime(SILENT, start);
  param.linearRampToValueAtTime(Math.max(peak, SILENT), start + safeAttack);
  param.exponentialRampToValueAtTime(SILENT, start + duration);
}

function safeResume(ctx: AudioContext): Promise<void> {
  try {
    return Promise.resolve(ctx.resume()).catch(() => undefined);
  } catch {
    return Promise.resolve();
  }
}

class MusicPlayer {
  private readonly out: GainNode;
  private readonly wet: GainNode | null;
  private readonly sends: (GainNode | null)[];
  private readonly timeline: NoteEvent[][];
  private readonly stepTime: number;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private nextTime = 0;
  private step = 0;
  private stopped = false;

  constructor(
    private readonly ctx: AudioContext,
    destination: AudioNode,
    private readonly song: MusicSong,
    reverbIn: AudioNode | null,
  ) {
    this.timeline = buildTimeline(song);
    this.stepTime = stepDuration(song);
    this.out = ctx.createGain();
    this.out.connect(destination);
    const wet = reverbIn ? ctx.createGain() : null;
    if (wet && reverbIn) wet.connect(reverbIn);
    this.wet = wet;
    this.sends = song.voices.map((voice) => {
      if (!wet || !voice.reverb) return null;
      const send = ctx.createGain();
      send.gain.value = voice.reverb;
      send.connect(wet);
      return send;
    });
  }

  private faders(): GainNode[] {
    return this.wet ? [this.out, this.wet] : [this.out];
  }

  start(): void {
    const now = this.ctx.currentTime;
    for (const fader of this.faders()) {
      fader.gain.setValueAtTime(SILENT, now);
      fader.gain.exponentialRampToValueAtTime(1, now + MUSIC_FADE_IN);
    }
    this.nextTime = now + 0.1;
    this.tick();
  }

  stop(fade: number): void {
    if (this.stopped) return;
    this.stopped = true;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    for (const fader of this.faders()) {
      try {
        const now = this.ctx.currentTime;
        const gain = fader.gain;
        gain.cancelScheduledValues(now);
        gain.setValueAtTime(Math.max(gain.value, SILENT), now);
        gain.exponentialRampToValueAtTime(SILENT, now + fade);
      } catch {
        fader.gain.value = 0;
      }
    }
    setTimeout(() => {
      for (const fader of this.faders()) {
        try {
          fader.disconnect();
        } catch {
          continue;
        }
      }
    }, fade * 1000 + 300);
  }

  private tick = (): void => {
    if (this.stopped) return;
    try {
      const now = this.ctx.currentTime;
      if (this.nextTime < now) this.nextTime = now + 0.05;
      const length = this.timeline.length;
      while (length > 0 && this.nextTime < now + MUSIC_LOOKAHEAD) {
        for (const event of this.timeline[this.step]) this.playNote(event, this.nextTime);
        this.step = (this.step + 1) % length;
        this.nextTime += this.stepTime;
      }
    } catch {
      this.stopped = true;
      return;
    }
    this.timer = setTimeout(this.tick, MUSIC_TICK_MS);
  };

  private playMallet(event: NoteEvent, time: number, duration: number): void {
    const voice = this.song.voices[event.voice];
    const ctx = this.ctx;
    const ring = Math.min(Math.max(duration, 0.5), 1.4);
    const env = ctx.createGain();
    env.connect(this.out);
    const send = this.sends[event.voice];
    if (send) env.connect(send);
    const partials: [number, number, number][] = [
      [1, 1, ring],
      [4, 0.25, ring * 0.25],
      [10, 0.08, 0.04],
    ];
    let last: OscillatorNode | null = null;
    for (const [mult, level, length] of partials) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(event.freq * mult, time);
      const g = ctx.createGain();
      envelope(g.gain, time, 0.003, length, voice.gain * level);
      osc.connect(g);
      g.connect(env);
      osc.start(time);
      osc.stop(time + length + 0.02);
      if (mult === 1) last = osc;
    }
    if (last) {
      last.onended = () => {
        try {
          env.disconnect();
        } catch {
          return;
        }
      };
    }
  }

  private playNote(event: NoteEvent, time: number): void {
    const voice = this.song.voices[event.voice];
    const ctx = this.ctx;
    const duration = event.steps * this.stepTime * voice.legato;
    if (voice.timbre === 'mallet') {
      this.playMallet(event, time, duration);
      return;
    }
    const osc = ctx.createOscillator();
    osc.type = voice.wave;
    osc.frequency.setValueAtTime(event.freq, time);
    const env = ctx.createGain();
    const attack = Math.min(voice.attack, duration * 0.3);
    env.gain.setValueAtTime(SILENT, time);
    env.gain.linearRampToValueAtTime(voice.gain, time + attack);
    const sustainAt = Math.min(Math.max(attack + 0.02, Math.min(0.12, duration * 0.6)), duration * 0.7);
    env.gain.exponentialRampToValueAtTime(voice.gain * 0.6, time + sustainAt);
    env.gain.setValueAtTime(voice.gain * 0.6, time + duration * 0.75);
    env.gain.exponentialRampToValueAtTime(SILENT, time + duration);
    let head: AudioNode = osc;
    if (voice.lowpass) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = voice.lowpass;
      osc.connect(filter);
      head = filter;
    }
    head.connect(env);
    env.connect(this.out);
    const send = this.sends[event.voice];
    if (send) env.connect(send);
    if (voice.vibrato && duration > 0.45) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 5.5;
      depth.gain.setValueAtTime(0, time);
      depth.gain.linearRampToValueAtTime(event.freq * 0.006, time + 0.3);
      lfo.connect(depth);
      depth.connect(osc.frequency);
      lfo.start(time);
      lfo.stop(time + duration + 0.02);
    }
    osc.start(time);
    osc.stop(time + duration + 0.02);
    osc.onended = () => {
      try {
        env.disconnect();
      } catch {
        return;
      }
    };
  }
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxVerb: ConvolverNode | null = null;
  private musicVerb: ConvolverNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private music: MusicPlayer | null = null;
  private wantMusic = false;
  private muted: boolean;
  private volumes: Volumes;
  private enabled: ChannelsEnabled;
  private unsupported = false;
  private listenersInstalled = false;
  private suspendedByHide = false;
  private readonly limiter = new VoiceLimiter<Voice>();
  private readonly createContext: () => AudioContext | null;
  private readonly storage: () => MuteStorage | null;
  private readonly song: MusicSong;

  constructor(options: AudioEngineOptions = {}) {
    this.createContext = options.createContext ?? defaultCreateContext;
    this.storage = options.storage ?? defaultStorage;
    this.song = options.song ?? SONG;
    this.muted = readMuted(this.storage);
    this.volumes = readVolumes(this.storage);
    this.enabled = readChannels(this.storage);
  }

  isEnabled(channel: VolumeChannel): boolean {
    return this.enabled[channel];
  }

  setEnabled(channel: VolumeChannel, on: boolean): void {
    this.enabled = { ...this.enabled, [channel]: on };
    writeChannels(this.storage, this.enabled);
    try {
      this.applyBusGains(0.05);
      if (channel === 'musica') {
        if (on) this.syncMusic();
        else {
          this.music?.stop(MUSIC_FADE_OUT);
          this.music = null;
        }
      }
    } catch {
      return;
    }
  }

  toggleEnabled(channel: VolumeChannel): boolean {
    this.setEnabled(channel, !this.enabled[channel]);
    return this.enabled[channel];
  }

  private busTarget(channel: VolumeChannel): number {
    if (!this.enabled[channel]) return 0;
    return (channel === 'musica' ? MUSIC_BUS_VOLUME : SFX_BUS_VOLUME) * this.volumes[channel];
  }

  getVolume(channel: VolumeChannel): number {
    return this.volumes[channel];
  }

  setVolume(channel: VolumeChannel, value: number): void {
    this.volumes = { ...this.volumes, [channel]: clampVolume(value) };
    writeVolumes(this.storage, this.volumes);
    try {
      this.applyBusGains(0.05);
    } catch {
      return;
    }
  }

  private applyBusGains(ramp: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const pairs: [GainNode | null, number][] = [
      [this.sfxBus, this.busTarget('efeitos')],
      [this.musicBus, this.busTarget('musica')],
    ];
    for (const [bus, target] of pairs) {
      if (!bus) continue;
      bus.gain.cancelScheduledValues(now);
      bus.gain.setValueAtTime(bus.gain.value, now);
      bus.gain.linearRampToValueAtTime(target, now + ramp);
    }
  }

  unlock(): void {
    try {
      const ctx = this.ensureContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        this.suspendedByHide = false;
        void safeResume(ctx).then(() => this.syncMusic());
      }
      this.syncMusic();
    } catch {
      return;
    }
  }

  play(name: SfxName): void {
    try {
      this.installListeners();
      const ctx = this.ctx;
      const bus = this.sfxBus;
      if (!ctx || !bus || this.muted || !this.enabled.efeitos || ctx.state !== 'running') return;
      const def = SFX_DEFS[name];
      if (!def) return;
      const now = ctx.currentTime;
      const voice: Voice = { out: null, sources: [] };
      const result = this.limiter.admit(name, now, now + sfxDuration(def) + 0.03, def.priority, voice);
      if (!result.admitted) return;
      if (result.evicted) this.silence(result.evicted, now);
      this.render(ctx, bus, def, voice, now + 0.005);
    } catch {
      return;
    }
  }

  startMusic(): void {
    this.wantMusic = true;
    try {
      this.installListeners();
      this.syncMusic();
    } catch {
      return;
    }
  }

  stopMusic(): void {
    this.wantMusic = false;
    try {
      this.music?.stop(MUSIC_FADE_OUT);
    } catch {
      return;
    } finally {
      this.music = null;
    }
  }

  isMusicPlaying(): boolean {
    return this.music !== null;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    writeMuted(this.storage, muted);
    try {
      this.applyMasterGain(0.05);
    } catch {
      return;
    }
  }

  toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  activeVoices(): number {
    return this.ctx ? this.limiter.activeCount(this.ctx.currentTime) : 0;
  }

  private syncMusic(): void {
    const ctx = this.ctx;
    const bus = this.musicBus;
    if (!this.wantMusic || !this.enabled.musica || this.music || !ctx || !bus || ctx.state !== 'running') return;
    const player = new MusicPlayer(ctx, bus, this.song, this.musicVerb);
    this.music = player;
    player.start();
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (this.unsupported) return null;
    let ctx: AudioContext | null = null;
    try {
      ctx = this.createContext();
    } catch {
      ctx = null;
    }
    if (!ctx) {
      this.unsupported = true;
      return null;
    }
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.knee.value = 12;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;
    const master = ctx.createGain();
    const sfxBus = ctx.createGain();
    const musicBus = ctx.createGain();
    sfxBus.gain.value = this.busTarget('efeitos');
    musicBus.gain.value = this.busTarget('musica');
    sfxBus.connect(compressor);
    musicBus.connect(compressor);
    compressor.connect(master);
    master.connect(ctx.destination);
    try {
      const impulse = makeImpulse(ctx);
      const sfxVerb = ctx.createConvolver();
      const musicVerb = ctx.createConvolver();
      sfxVerb.buffer = impulse;
      musicVerb.buffer = impulse;
      sfxVerb.connect(sfxBus);
      musicVerb.connect(musicBus);
      this.sfxVerb = sfxVerb;
      this.musicVerb = musicVerb;
    } catch {
      this.sfxVerb = null;
      this.musicVerb = null;
    }
    this.ctx = ctx;
    this.master = master;
    this.sfxBus = sfxBus;
    this.musicBus = musicBus;
    this.noiseBuffer = this.makeNoise(ctx);
    master.gain.value = this.muted ? 0 : MASTER_VOLUME;
    this.installListeners();
    return ctx;
  }

  private applyMasterGain(ramp: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const now = ctx.currentTime;
    const target = this.muted ? 0 : MASTER_VOLUME;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(target, now + ramp);
  }

  private makeNoise(ctx: AudioContext): AudioBuffer {
    const length = Math.floor(ctx.sampleRate);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  private installListeners(): void {
    if (this.listenersInstalled) return;
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    this.listenersInstalled = true;
    const unlock = (): void => this.unlock();
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    window.addEventListener('touchend', unlock, { capture: true });
    document.addEventListener('visibilitychange', () => this.onVisibility());
  }

  private onVisibility(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    try {
      if (document.hidden) {
        if (ctx.state === 'running') {
          this.suspendedByHide = true;
          void Promise.resolve(ctx.suspend()).catch(() => undefined);
        }
      } else if (this.suspendedByHide) {
        this.suspendedByHide = false;
        void safeResume(ctx).then(() => this.syncMusic());
      }
    } catch {
      return;
    }
  }

  private silence(voice: Voice, now: number): void {
    try {
      if (voice.out) {
        const gain = voice.out.gain;
        gain.cancelScheduledValues(now);
        gain.setValueAtTime(gain.value, now);
        gain.linearRampToValueAtTime(0, now + 0.03);
      }
      for (const source of voice.sources) {
        try {
          source.stop(now + 0.04);
        } catch {
          continue;
        }
      }
    } catch {
      return;
    }
  }

  private render(ctx: AudioContext, bus: AudioNode, def: SfxDef, voice: Voice, t0: number): void {
    const out = ctx.createGain();
    out.gain.value = def.volume;
    out.connect(bus);
    voice.out = out;
    if (def.reverb > 0 && this.sfxVerb) {
      const send = ctx.createGain();
      send.gain.value = def.reverb;
      out.connect(send);
      send.connect(this.sfxVerb);
    }
    let lastEnd = -1;
    let lastSource: AudioScheduledSourceNode | null = null;
    for (const layer of def.layers) {
      const source =
        layer.kind === 'tone'
          ? this.renderTone(ctx, layer, t0, out, voice)
          : layer.kind === 'bell'
            ? this.renderBell(ctx, layer, t0, out, voice)
            : this.renderNoise(ctx, layer, t0, out);
      if (!source) continue;
      voice.sources.push(source);
      const end = (layer.start ?? 0) + layer.duration;
      if (end > lastEnd) {
        lastEnd = end;
        lastSource = source;
      }
    }
    if (lastSource) {
      lastSource.onended = () => {
        try {
          out.disconnect();
        } catch {
          return;
        }
      };
    }
  }

  private renderBell(ctx: AudioContext, layer: BellLayer, t0: number, dest: AudioNode, voice: Voice): AudioScheduledSourceNode {
    const start = t0 + (layer.start ?? 0);
    const end = start + layer.duration;
    const carrier = ctx.createOscillator();
    const modulator = ctx.createOscillator();
    const depth = ctx.createGain();
    carrier.type = 'sine';
    modulator.type = 'sine';
    carrier.frequency.setValueAtTime(layer.freq, start);
    modulator.frequency.setValueAtTime(layer.freq * layer.ratio, start);
    depth.gain.setValueAtTime(layer.freq * layer.index, start);
    depth.gain.exponentialRampToValueAtTime(1, end);
    modulator.connect(depth);
    depth.connect(carrier.frequency);
    const env = ctx.createGain();
    envelope(env.gain, start, layer.attack ?? DEFAULT_ATTACK, layer.duration, layer.gain);
    carrier.connect(env);
    env.connect(dest);
    modulator.start(start);
    modulator.stop(end + 0.02);
    voice.sources.push(modulator);
    carrier.start(start);
    carrier.stop(end + 0.02);
    return carrier;
  }

  private renderTone(ctx: AudioContext, layer: ToneLayer, t0: number, dest: AudioNode, voice: Voice): AudioScheduledSourceNode {
    const start = t0 + (layer.start ?? 0);
    const end = start + layer.duration;
    const osc = ctx.createOscillator();
    osc.type = layer.wave;
    osc.frequency.setValueAtTime(layer.freq, start);
    if (layer.freqEnd !== undefined && layer.freqEnd > 0) osc.frequency.exponentialRampToValueAtTime(layer.freqEnd, end);
    if (layer.vibratoRate && layer.vibratoDepth) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = layer.vibratoRate;
      depth.gain.value = layer.vibratoDepth;
      lfo.connect(depth);
      depth.connect(osc.frequency);
      lfo.start(start);
      lfo.stop(end + 0.02);
      voice.sources.push(lfo);
    }
    const env = ctx.createGain();
    envelope(env.gain, start, layer.attack ?? DEFAULT_ATTACK, layer.duration, layer.gain);
    let head: AudioNode = osc;
    if (layer.lowpass) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = layer.lowpass;
      osc.connect(filter);
      head = filter;
    }
    head.connect(env);
    env.connect(dest);
    osc.start(start);
    osc.stop(end + 0.02);
    return osc;
  }

  private renderNoise(ctx: AudioContext, layer: NoiseLayer, t0: number, dest: AudioNode): AudioScheduledSourceNode | null {
    const buffer = this.noiseBuffer;
    if (!buffer) return null;
    const start = t0 + (layer.start ?? 0);
    const end = start + layer.duration;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = layer.filter;
    filter.frequency.setValueAtTime(layer.freq, start);
    if (layer.freqEnd !== undefined && layer.freqEnd > 0) filter.frequency.exponentialRampToValueAtTime(layer.freqEnd, end);
    filter.Q.value = layer.q ?? 0.8;
    const env = ctx.createGain();
    envelope(env.gain, start, layer.attack ?? DEFAULT_ATTACK, layer.duration, layer.gain);
    source.connect(filter);
    filter.connect(env);
    env.connect(dest);
    source.start(start, Math.random() * 0.5);
    source.stop(end + 0.02);
    return source;
  }
}
