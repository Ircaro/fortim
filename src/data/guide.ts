import { TILE } from '../config';
import type { EnemyDef, EnemyId, TowerDef, TowerId, TowerLevel, WaveDef } from '../core/types';
import { ENEMIES, ENEMY_ORDER } from './enemies';
import { TOWERS } from './towers';

export interface EnemyGuide {
  best: TowerId[];
  weak: TowerId[];
  tip: string;
}

export interface TowerGuide {
  strong: string;
  weak: string;
}

export const ENEMY_GUIDE: Record<EnemyId, EnemyGuide> = {
  goblin: { best: ['arqueiro', 'canhao'], weak: [], tip: 'Fraco, mas vem em bando. Um Canhão numa curva limpa grupos inteiros.' },
  lobo: { best: ['arqueiro', 'gelo'], weak: [], tip: 'Muito rápido. O Gelo segura os lobos dentro do alcance das outras torres.' },
  orc: { best: ['mago', 'balista'], weak: ['arqueiro', 'canhao'], tip: 'Armadura de 50%: perde metade do dano físico. Mago e Balista passam direto.' },
  morcego: { best: ['arqueiro', 'mago'], weak: ['canhao'], tip: 'Voa: o Canhão não acerta. Tenha Arqueiros ou Magos cobrindo a trilha.' },
  xama: { best: ['arqueiro', 'canhao'], weak: ['mago', 'gelo'], tip: 'Resiste a 50% da magia. Use dano físico: Arqueiro e Canhão.' },
  golem: {
    best: ['balista'],
    weak: ['arqueiro', 'canhao', 'gelo'],
    tip: 'Armadura de 70% e não fica lento. Só a Balista perfura de verdade. Deixe o alvo dela em "Mais forte".',
  },
  curandeiro: { best: ['arqueiro', 'mago'], weak: [], tip: 'Cura os inimigos em volta. Derrube primeiro: Arqueiros e Magos acabam com ele rápido.' },
  escudeiro: {
    best: ['mago', 'balista'],
    weak: [],
    tip: 'Protege quem está perto: todos ali levam 30% menos dano. Dano em área, como o Canhão, quebra o grupo.',
  },
  lodo: { best: ['canhao', 'arqueiro'], weak: [], tip: 'Ao morrer, se divide em dois lodinhos. O Canhão pega o lodo e os pedaços de uma vez.' },
  lodinho: { best: ['canhao', 'arqueiro'], weak: [], tip: 'Pedaço rápido e fraco de um lodo. Área e disparos rápidos resolvem.' },
  rei: {
    best: ['balista'],
    weak: [],
    tip: 'O chefe: muita vida, armadura e chama goblins. Balista e Mago no alvo "Mais forte"; Congelar ajuda a segurar.',
  },
};

export const TOWER_GUIDE: Record<TowerId, TowerGuide> = {
  arqueiro: { strong: 'Bandos, voadores e xamãs', weak: 'Orc e golem (armadura)' },
  canhao: { strong: 'Grupos no chão, principalmente nas curvas', weak: 'Voadores (não acerta) e golem' },
  gelo: { strong: 'Segurar lobos e grupos dentro do alcance das outras torres', weak: 'Golem (não fica lento) e xamã' },
  mago: { strong: 'Orcs blindados e voadores', weak: 'Xamã (resiste a magia) e golem' },
  balista: { strong: 'Golem e orc (perfura armadura)', weak: 'Bandos grandes (atira devagar)' },
  raio: { strong: 'Bandos e voadores (o raio salta entre eles)', weak: 'Golem, chefe e resistências mágicas' },
};

export const THREAT_ORDER: EnemyId[] = ['rei', 'golem', 'curandeiro', 'escudeiro', 'orc', 'morcego', 'lodo', 'xama', 'lobo', 'goblin', 'lodinho'];

export function maxLevel(def: TowerDef): TowerLevel {
  return def.levels[def.levels.length - 1];
}

export function effectiveness(tower: TowerDef, enemy: EnemyDef, level: TowerLevel = maxLevel(tower)): number {
  if (enemy.flying ? !tower.hitsAir : !tower.hitsGround) return 0;
  if (tower.damageType === 'magico') return 1 - enemy.magicResist;
  return 1 - Math.max(0, enemy.armor - level.armorPierce);
}

export function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function enemyTraits(def: EnemyDef): string[] {
  const traits: string[] = [];
  if (def.flying) traits.push('Voa');
  if (def.armor > 0) traits.push(`Armadura ${percent(def.armor)}`);
  if (def.magicResist > 0) traits.push(`Resiste a magia ${percent(def.magicResist)}`);
  if (def.isBoss) traits.push('Chefe');
  if (def.slowImmune) traits.push('Não fica lento');
  else if (def.slowResist > 0) traits.push(`Lentidão ${percent(1 - def.slowResist)} do efeito`);
  if (def.hp >= 300) traits.push('Muita vida');
  if (def.lifeDamage > 1) traits.push(`Tira ${def.lifeDamage} vidas`);
  return traits;
}

export interface WaveEntry {
  enemy: EnemyId;
  count: number;
}

export function waveComposition(wave: WaveDef): WaveEntry[] {
  const totals = new Map<EnemyId, number>();
  for (const group of wave.groups) totals.set(group.enemy, (totals.get(group.enemy) ?? 0) + group.count);
  return [...totals.entries()]
    .map(([enemy, count]) => ({ enemy, count }))
    .sort((a, b) => b.count - a.count || ENEMY_ORDER.indexOf(a.enemy) - ENEMY_ORDER.indexOf(b.enemy));
}

export function waveTip(wave: WaveDef): string {
  const present = new Set(wave.groups.map((g) => g.enemy));
  const main = THREAT_ORDER.find((id) => present.has(id));
  return main ? ENEMY_GUIDE[main].tip : '';
}

export function enemyLabel(id: EnemyId, count: number): string {
  const name = ENEMIES[id].name;
  if (count === 1) return name;
  const plural: Record<EnemyId, string> = {
    goblin: 'Goblins',
    lobo: 'Lobos',
    orc: 'Orcs Blindados',
    morcego: 'Morcegos',
    xama: 'Xamãs Goblin',
    golem: 'Golens de Pedra',
    curandeiro: 'Curandeiros',
    escudeiro: 'Escudeiros',
    lodo: 'Lodos',
    lodinho: 'Lodinhos',
    rei: 'Reis Goblin',
  };
  return plural[id];
}

export interface LevelChange {
  label: string;
  from: string;
  to: string;
}

function decimal(value: number, digits = 1): string {
  return value.toFixed(digits).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '').replace('.', ',');
}

function tiles(px: number): string {
  return decimal(px / TILE);
}

export function damagePerSecond(level: TowerLevel): number {
  return level.damage * level.fireRate;
}

export function upgradeChanges(def: TowerDef, level: number): LevelChange[] {
  const current = def.levels[level];
  const next = def.levels[level + 1];
  if (!current || !next) return [];
  const changes: LevelChange[] = [];
  const add = (label: string, a: string, b: string): void => {
    if (a !== b) changes.push({ label, from: a, to: b });
  };
  add('Dano', String(current.damage), String(next.damage));
  add('Cadência', `${decimal(current.fireRate, 2)}/s`, `${decimal(next.fireRate, 2)}/s`);
  add('Dano por segundo', decimal(damagePerSecond(current)), decimal(damagePerSecond(next)));
  add('Alcance', tiles(current.range), tiles(next.range));
  if (current.splashRadius > 0 || next.splashRadius > 0) add('Área', current.splashRadius > 0 ? tiles(current.splashRadius) : 'nenhuma', tiles(next.splashRadius));
  if (current.slow || next.slow) {
    const slowText = (l: TowerLevel): string => (l.slow ? `-${percent(1 - l.slow.factor)} por ${decimal(l.slow.duration)}s` : 'nenhuma');
    add('Lentidão', slowText(current), slowText(next));
  }
  if (current.armorPierce > 0 || next.armorPierce > 0) add('Perfura armadura', percent(current.armorPierce), percent(next.armorPierce));
  return changes;
}

export function towerName(id: TowerId): string {
  return TOWERS[id].name;
}
