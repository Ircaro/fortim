import type { SfxPriority } from './sfx';

export const MAX_VOICES = 10;
export const MIN_INTERVAL = 0.06;

export interface AdmitResult<T> {
  readonly admitted: boolean;
  readonly evicted: T | null;
}

interface Slot<T> {
  readonly started: number;
  readonly end: number;
  readonly priority: SfxPriority;
  readonly handle: T;
}

export class VoiceLimiter<T> {
  private readonly lastPlayed = new Map<string, number>();
  private slots: Slot<T>[] = [];

  constructor(
    readonly maxVoices = MAX_VOICES,
    readonly minInterval = MIN_INTERVAL,
  ) {}

  activeCount(now: number): number {
    this.prune(now);
    return this.slots.length;
  }

  admit(name: string, now: number, end: number, priority: SfxPriority, handle: T): AdmitResult<T> {
    this.prune(now);
    const last = this.lastPlayed.get(name);
    if (last !== undefined && now - last < this.minInterval - 1e-9) return { admitted: false, evicted: null };
    let evicted: T | null = null;
    if (this.slots.length >= this.maxVoices) {
      if (priority !== 'high') return { admitted: false, evicted: null };
      const victimIndex = this.pickVictim();
      evicted = this.slots[victimIndex].handle;
      this.slots.splice(victimIndex, 1);
    }
    this.lastPlayed.set(name, now);
    this.slots.push({ started: now, end, priority, handle });
    return { admitted: true, evicted };
  }

  reset(): void {
    this.lastPlayed.clear();
    this.slots = [];
  }

  private pickVictim(): number {
    let best = -1;
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (best === -1) {
        best = i;
        continue;
      }
      const current = this.slots[best];
      const slotLow = slot.priority === 'low';
      const currentLow = current.priority === 'low';
      if (slotLow && !currentLow) best = i;
      else if (slotLow === currentLow && slot.started < current.started) best = i;
    }
    return best;
  }

  private prune(now: number): void {
    if (this.slots.some((slot) => slot.end <= now)) this.slots = this.slots.filter((slot) => slot.end > now);
  }
}
