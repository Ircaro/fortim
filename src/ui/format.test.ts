import { describe, expect, it } from 'vitest';
import {
  TARGET_MODES,
  damageTypeName,
  formatRange,
  formatRate,
  formatTime,
  hudWave,
  levelText,
  pauseLabel,
  restartConfirmText,
  sellLabel,
  soundLabel,
  speedLabel,
  startWaveLabel,
  targetModeName,
  upgradeLabel,
  waveText,
  yesNo,
} from './format';
import { TILE } from '../config';

describe('formatRate', () => {
  it('usa vírgula e uma casa decimal', () => {
    expect(formatRate(1.4)).toBe('1,4/s');
    expect(formatRate(1)).toBe('1,0/s');
    expect(formatRate(0.6)).toBe('0,6/s');
  });

  it('mantém duas casas quando necessário', () => {
    expect(formatRate(0.45)).toBe('0,45/s');
    expect(formatRate(0.65)).toBe('0,65/s');
  });
});

describe('formatRange', () => {
  it('converte pixels em tiles', () => {
    expect(formatRange(TILE * 3)).toBe('3,0');
    expect(formatRange(130)).toBe('2,7');
    expect(formatRange(210)).toBe('4,4');
  });

  it('aceita outro tamanho de tile', () => {
    expect(formatRange(100, 50)).toBe('2,0');
  });
});

describe('targetModeName', () => {
  it('nomeia todos os modos', () => {
    expect(TARGET_MODES.map(targetModeName)).toEqual(['Primeiro', 'Último', 'Mais forte', 'Mais perto']);
  });
});

describe('formatTime', () => {
  it('formata mm:ss', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(9.9)).toBe('00:09');
    expect(formatTime(75)).toBe('01:15');
    expect(formatTime(3725)).toBe('62:05');
  });

  it('não aceita negativo', () => {
    expect(formatTime(-5)).toBe('00:00');
  });
});

describe('ondas', () => {
  it('mostra a próxima onda durante a preparação', () => {
    expect(hudWave('preparando', 0, 15)).toBe(1);
    expect(hudWave('preparando', 3, 15)).toBe(4);
    expect(waveText('onda', 4, 15)).toBe('Onda 4 de 15');
    expect(waveText('vitoria', 15, 15)).toBe('Onda 15 de 15');
  });

  it('gera o rótulo do botão de iniciar', () => {
    expect(startWaveLabel('preparando', 0, 15)).toBe('Iniciar onda 1');
    expect(startWaveLabel('preparando', 7, 15)).toBe('Iniciar onda 8');
    expect(startWaveLabel('onda', 7, 15)).toBe('Onda em andamento');
    expect(startWaveLabel('derrota', 7, 15)).toBe('Fim de jogo');
  });
});

describe('rótulos', () => {
  it('pausa, velocidade e som', () => {
    expect(pauseLabel(false)).toBe('Pausar');
    expect(pauseLabel(true)).toBe('Continuar');
    expect(speedLabel(2)).toBe('2x');
    expect(soundLabel(true)).toBe('Sem som');
    expect(soundLabel(false)).toBe('Som');
  });

  it('ficha da torre', () => {
    expect(levelText(0, 3)).toBe('Nível 1 de 3');
    expect(upgradeLabel(110)).toBe('Melhorar (110)');
    expect(upgradeLabel(null)).toBe('Nível máximo');
    expect(sellLabel(49)).toBe('Vender (+49)');
    expect(damageTypeName('magico')).toBe('Mágico');
    expect(damageTypeName('fisico')).toBe('Físico');
    expect(yesNo(true)).toBe('Sim');
    expect(yesNo(false)).toBe('Não');
  });
});

describe('confirmação de reiniciar', () => {
  it('avisa que a partida se perde e de onde a fase recomeça', () => {
    expect(restartConfirmText('Vale do Fortim', false)).toBe('A partida atual será perdida, e Vale do Fortim recomeça da onda 1, com o ouro e as vidas do começo.');
    expect(restartConfirmText('Vale do Fortim', true)).toContain('modo infinito');
  });
});
