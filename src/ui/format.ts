import type { BattlePhase, DamageType, TargetMode } from '../core/types';
import { TILE } from '../config';

export const TARGET_MODES: TargetMode[] = ['primeiro', 'ultimo', 'forte', 'perto'];

const TARGET_NAMES: Record<TargetMode, string> = {
  primeiro: 'Primeiro',
  ultimo: 'Último',
  forte: 'Mais forte',
  perto: 'Mais perto',
};

export function decimal(value: number, digits: number): string {
  return value.toFixed(digits).replace('.', ',');
}

export function formatRate(fireRate: number): string {
  const rounded = Math.round(fireRate * 100) / 100;
  const tenths = Math.round(rounded * 10) / 10;
  const digits = Math.abs(rounded - tenths) < 1e-9 ? 1 : 2;
  return `${decimal(rounded, digits)}/s`;
}

export function formatRange(rangePx: number, tile: number = TILE): string {
  return decimal(rangePx / tile, 1);
}

export function targetModeName(mode: TargetMode): string {
  return TARGET_NAMES[mode];
}

export function damageTypeName(type: DamageType): string {
  return type === 'magico' ? 'Mágico' : 'Físico';
}

export function yesNo(value: boolean): string {
  return value ? 'Sim' : 'Não';
}

export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

export function hudWave(phase: BattlePhase, wave: number, totalWaves: number): number {
  if (phase === 'preparando') return Math.min(totalWaves, wave + 1);
  return Math.max(1, wave);
}

export function waveText(phase: BattlePhase, wave: number, totalWaves: number): string {
  return `Onda ${hudWave(phase, wave, totalWaves)} de ${totalWaves}`;
}

export function startWaveLabel(phase: BattlePhase, wave: number, totalWaves: number): string {
  if (phase === 'onda') return 'Onda em andamento';
  if (phase === 'preparando') return `Iniciar onda ${Math.min(totalWaves, wave + 1)}`;
  return phase === 'vitoria' ? 'Vitória!' : 'Fim de jogo';
}

export function pauseLabel(paused: boolean): string {
  return paused ? 'Continuar' : 'Pausar';
}

export function speedLabel(speed: number): string {
  return `${speed}x`;
}

export function soundLabel(muted: boolean): string {
  return muted ? 'Sem som' : 'Som';
}

export function soundAction(muted: boolean): string {
  return muted ? 'Ligar o som' : 'Desligar o som';
}

export function levelText(level: number, maxLevels: number): string {
  return `Nível ${level + 1} de ${maxLevels}`;
}

export function upgradeLabel(cost: number | null): string {
  return cost === null ? 'Nível máximo' : `Melhorar (${cost})`;
}

export function sellLabel(value: number): string {
  return `Vender (+${value})`;
}

export function resultTitle(victory: boolean): string {
  return victory ? 'Vitória!' : 'O fortim caiu';
}

export function resultSubtitle(victory: boolean): string {
  return victory ? 'O vale está a salvo.' : 'Os inimigos romperam a defesa.';
}

export function restartConfirmText(stageName: string, infinite: boolean): string {
  const start = infinite ? 'recomeça do início do modo infinito' : 'recomeça da onda 1';
  return `A partida atual será perdida, e ${stageName} ${start}, com o ouro e as vidas do começo.`;
}
