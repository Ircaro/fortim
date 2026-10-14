import { AudioEngine } from './engine';
import type { VolumeChannel } from './engine';
import type { SfxName } from './names';

export type { SfxName } from './names';
export { SFX_NAMES } from './names';
export { AudioEngine, CHANNELS_KEY, MUTE_KEY, VOLUME_KEY } from './engine';
export type { ChannelsEnabled, VolumeChannel, Volumes } from './engine';

const engine = new AudioEngine();

export const audio = {
  unlock(): void {
    engine.unlock();
  },
  play(name: SfxName): void {
    engine.play(name);
  },
  startMusic(): void {
    engine.startMusic();
  },
  stopMusic(): void {
    engine.stopMusic();
  },
  setMuted(muted: boolean): void {
    engine.setMuted(muted);
  },
  isMuted(): boolean {
    return engine.isMuted();
  },
  toggleMuted(): boolean {
    return engine.toggleMuted();
  },
  isMusicPlaying(): boolean {
    return engine.isMusicPlaying();
  },
  getVolume(channel: VolumeChannel): number {
    return engine.getVolume(channel);
  },
  setVolume(channel: VolumeChannel, value: number): void {
    engine.setVolume(channel, value);
  },
  isEnabled(channel: VolumeChannel): boolean {
    return engine.isEnabled(channel);
  },
  setEnabled(channel: VolumeChannel, on: boolean): void {
    engine.setEnabled(channel, on);
  },
  toggleEnabled(channel: VolumeChannel): boolean {
    return engine.toggleEnabled(channel);
  },
};
