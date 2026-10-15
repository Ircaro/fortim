import './ui.css';
import './extras.css';
import type { EnemyId, TowerId } from '../core/types';
import { createGuideModal } from './guide';
import { createNextWave } from './nextWave';
import type { ResultData, UiApi, UiCallbacks, UiState } from '../core/view';
import { TOWERS, TOWER_ORDER } from '../data/towers';
import { applyCssVars, onSettingsChange } from '../theme';
import { ICONS, button, changed, h, iconButton, restartAnimation, setAttr, setClass, setDisabled, setHtml, setPressed, setText } from './dom';
import {
  formatTime,
  hudWave,
  pauseLabel,
  resultSubtitle,
  resultTitle,
  soundAction,
  soundLabel,
  speedLabel,
  startWaveLabel,
  waveText,
} from './format';
import { drawTowerIcon } from './icons';
import { createSettingsPanel } from './settings';
import { createAchievementsModal } from './achievements';
import { createMenu } from './menu';
import { createBossBar, createPowerBar, createTutorialCard } from './play';
import { DIFFICULTIES } from '../data/difficulty';
import { createTowerSheet } from './sheet';
import { createConfirmModal } from './confirm';
import { restartConfirmText } from './format';

interface ShopCard {
  id: TowerId;
  el: HTMLButtonElement;
}

const MAX_FLOATS = 40;
const BANNER_MS = 1850;

export function createUi(root: HTMLElement, callbacks: UiCallbacks): UiApi {
  applyCssVars();
  let paletteVersion = 0;
  let last: UiState | null = null;
  let settingsOpen = false;
  const icons: { canvas: HTMLCanvasElement; id: TowerId }[] = [];

  const ft = h('div', 'ft');
  ft.dataset.screen = 'menu';

  const hud = h('header', 'ft-hud');
  const stats = h('div', 'ft-stats');
  const goldPill = h('div', 'ft-pill ft-pill-gold');
  const goldValue = h('span', 'ft-num');
  goldPill.append(h('span', 'ft-dot ft-dot-gold'), goldValue);
  goldPill.setAttribute('aria-label', 'Ouro');
  goldPill.title = 'Ouro';
  const livesPill = h('div', 'ft-pill ft-pill-lives');
  const livesValue = h('span', 'ft-num');
  const heart = h('span', 'ft-heart');
  heart.innerHTML = ICONS.heart;
  livesPill.append(heart, livesValue);
  livesPill.setAttribute('aria-label', 'Vidas');
  livesPill.title = 'Vidas';
  const wavePill = h('div', 'ft-pill ft-pill-wave');
  const waveNow = h('span', 'ft-num');
  const waveTotal = h('small', '');
  wavePill.append(h('span', 'ft-wave-word', 'Onda'), waveNow, waveTotal);
  stats.append(goldPill, livesPill, wavePill);

  const controls = h('div', 'ft-controls');
  const pauseBtn = iconButton('ft-ctl', ICONS.pause, 'Pausar', () => callbacks.onTogglePause());
  const speedBtn = button('ft-btn ft-ctl ft-speed', '1x', () => callbacks.onCycleSpeed());
  speedBtn.setAttribute('aria-label', 'Velocidade 1x');
  speedBtn.title = 'Velocidade';
  const soundBtn = iconButton('ft-ctl', ICONS.sound, 'Som', () => callbacks.onToggleMute());
  const settingsBtn = iconButton('ft-ctl', ICONS.sliders, 'Ajustes', () => openSettings(true));
  let autoPaused = false;
  const guide = createGuideModal(() => {
    if (autoPaused && last?.screen === 'jogo' && last.paused) callbacks.onTogglePause();
    autoPaused = false;
  });

  function openGuide(focus?: EnemyId | TowerId): void {
    if (guide.isOpen()) return;
    autoPaused = !!last && last.screen === 'jogo' && last.phase === 'onda' && !last.paused;
    if (autoPaused) callbacks.onTogglePause();
    guide.open(focus);
  }

  const guideBtn = iconButton('ft-ctl', ICONS.book, 'Guia', () => openGuide());
  const confirm = createConfirmModal();
  let restartPaused = false;

  function askRestart(): void {
    if (!last || last.screen !== 'jogo' || confirm.isOpen()) return;
    restartPaused = !last.paused;
    if (restartPaused) callbacks.onTogglePause();
    confirm.open({
      title: 'Reiniciar a fase?',
      text: restartConfirmText(last.stageName, last.infinite),
      confirmLabel: 'Reiniciar',
      onConfirm: () => {
        restartPaused = false;
        callbacks.onRestart();
      },
      onCancel: () => {
        if (restartPaused && last?.screen === 'jogo' && last.paused) callbacks.onTogglePause();
        restartPaused = false;
      },
    });
  }

  const restartCtl = iconButton('ft-ctl', ICONS.restart, 'Reiniciar fase', () => askRestart());
  controls.append(pauseBtn.el, restartCtl.el, speedBtn, soundBtn.el, guideBtn.el, settingsBtn.el);
  hud.append(stats, controls);

  const stage = h('div', 'ft-stage');
  const mapbox = h('div', 'ft-mapbox');
  const mapHost = h('div', 'ft-map');
  const pauseVeil = h('div', 'ft-pause');
  const pauseBox = h('div', 'ft-pause-box');
  pauseBox.append(
    h('div', 'ft-pause-title', 'Pausado'),
    button('ft-btn primary ft-big', 'Continuar', () => callbacks.onTogglePause()),
    button('ft-btn', 'Reiniciar fase', () => askRestart()),
    button('ft-btn', 'Menu', () => callbacks.onMenu()),
  );
  pauseVeil.appendChild(pauseBox);
  const bannerEl = h('div', 'ft-banner');
  const bannerTitle = h('strong', 'ft-banner-title');
  const bannerSub = h('span', 'ft-banner-sub');
  bannerEl.append(bannerTitle, bannerSub);
  bannerEl.setAttribute('aria-live', 'polite');
  mapbox.append(mapHost, pauseVeil, bannerEl);
  stage.appendChild(mapbox);

  const dock = h('div', 'ft-dock');
  const shop = h('div', 'ft-shop');
  shop.setAttribute('role', 'toolbar');
  shop.setAttribute('aria-label', 'Torres');
  const cards: ShopCard[] = TOWER_ORDER.map((id) => {
    const def = TOWERS[id];
    const el = h('button', 'ft-card');
    el.type = 'button';
    const key = h('span', 'ft-key', def.hotkey);
    const icon = h('canvas', 'ft-card-icon');
    const nameEl = h('span', 'ft-card-name', def.name);
    const cost = h('span', 'ft-card-cost');
    cost.append(h('span', 'ft-dot ft-dot-gold ft-dot-sm'), h('span', '', String(def.levels[0].cost)));
    const text = h('span', 'ft-card-text');
    text.append(nameEl, cost);
    el.append(key, icon, text);
    el.setAttribute('aria-label', `${def.name}, custo ${def.levels[0].cost}`);
    el.addEventListener('click', () => {
      callbacks.onPickTower(last?.picking === id ? null : id);
    });
    icons.push({ canvas: icon, id });
    shop.appendChild(el);
    return { id, el };
  });
  const waveBtn = button('ft-btn primary ft-wave', 'Iniciar onda 1', () => {
    if (last?.phase === 'onda' && last.canCallEarly) callbacks.onCallEarly();
    else callbacks.onStartWave();
  });
  const nextWave = createNextWave((focus) => openGuide(focus));
  const nextWaveSide = createNextWave((focus) => openGuide(focus));
  nextWaveSide.el.classList.add('ft-next-side');
  const powers = createPowerBar(callbacks);
  dock.append(nextWave.el, shop, powers.el, waveBtn);
  const bossBar = createBossBar();
  const tutorial = createTutorialCard(callbacks);
  mapbox.append(bossBar.el, tutorial.el);

  const sheet = createTowerSheet(callbacks, mapbox);

  const achievements = createAchievementsModal();
  const menu = createMenu(callbacks, {
    openGuide: () => openGuide(),
    openAchievements: () => achievements.open(last?.menu.achievements ?? []),
    openSound: () => openSettings(true),
  });

  const result = h('section', 'ft-screen ft-result');
  const resultCard = h('div', 'ft-panel ft-result-card');
  const resultStage = h('p', 'ft-result-stage');
  const resultTitleEl = h('h1', 'ft-title ft-result-title');
  const resultStars = h('div', 'ft-result-stars');
  const resultSub = h('p', 'ft-subtitle');
  const resultAch = h('div', 'ft-result-ach');
  const summary = h('dl', 'ft-summary');
  const summaryValues: HTMLElement[] = [];
  for (const label of ['Onda alcançada', 'Vidas', 'Inimigos derrotados', 'Ouro ganho', 'Torres construídas', 'Tempo']) {
    const item = h('div', 'ft-summary-item');
    const dd = h('dd', '');
    item.append(h('dt', '', label), dd);
    summary.appendChild(item);
    summaryValues.push(dd);
  }
  const resultActs = h('div', 'ft-result-acts');
  const nextStageBtn = button('ft-btn primary ft-big ft-next-stage', '', () => callbacks.onNextStage());
  const nextStageName = h('span', 'ft-next-stage-name');
  nextStageBtn.append(h('span', 'ft-next-stage-title', 'Próxima fase'), nextStageName);
  const restartBtn = button('ft-btn ft-big', 'Jogar de novo', () => callbacks.onRestart());
  resultActs.append(nextStageBtn, restartBtn, button('ft-btn ft-big', 'Menu', () => callbacks.onMenu()));
  resultCard.append(resultStage, resultTitleEl, resultStars, resultSub, resultAch, summary, resultActs);
  result.appendChild(resultCard);

  const modal = h('div', 'ft-modal');
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Ajustes de som');
  const modalCard = h('div', 'ft-panel ft-modal-card');
  const modalHead = h('div', 'ft-modal-head');
  const modalClose = h('button', 'ft-btn ft-close');
  modalClose.type = 'button';
  modalClose.innerHTML = ICONS.close;
  modalClose.setAttribute('aria-label', 'Fechar');
  modalClose.title = 'Fechar';
  modalClose.addEventListener('click', () => openSettings(false));
  modalHead.append(h('h2', 'ft-h2', 'Ajustes de som'), modalClose);
  const modalSettings = createSettingsPanel();
  const modalDone = button('ft-btn primary ft-big', 'Pronto', () => openSettings(false));
  modalCard.append(modalHead, modalSettings.el, modalDone);
  modal.appendChild(modalCard);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) openSettings(false);
  });

  const floats = h('div', 'ft-floats');

  ft.append(hud, stage, nextWaveSide.el, dock, sheet.el, menu.el, result, modal, guide.el, achievements.el, confirm.el, floats);
  root.appendChild(ft);

  function openSettings(open: boolean): void {
    settingsOpen = open;
    setClass(modal, 'is-open', open);
    if (open) modalSettings.sync();
  }

  function redrawIcons(): void {
    for (const { canvas, id } of icons) drawTowerIcon(canvas, id);
  }

  function measure(): void {
    const rect = mapbox.getBoundingClientRect();
    ft.style.setProperty('--map-bottom', `${Math.round(rect.bottom)}px`);
  }

  redrawIcons();
  measure();
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(() => measure());
    observer.observe(mapbox);
    observer.observe(ft);
  }
  window.addEventListener('resize', measure);
  window.addEventListener('orientationchange', measure);
  if (document.fonts) void document.fonts.ready.then(measure);

  onSettingsChange(() => {
    paletteVersion++;
    redrawIcons();
    guide.redraw();
    modalSettings.sync();
    if (last) sheet.render(last, paletteVersion);
  });

  window.addEventListener(
    'keydown',
    (e) => {
      if (settingsOpen && e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        openSettings(false);
      }
    },
    true,
  );
  ft.addEventListener('mousedown', (e) => {
    if (e.target instanceof Element && e.target.closest('button')) e.preventDefault();
  });
  ft.addEventListener('contextmenu', (e) => {
    if (e.target instanceof Element && e.target.closest('.ft-map, button')) e.preventDefault();
  });
  ft.addEventListener('dblclick', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });

  let lastGold: number | null = null;
  let lastLives: number | null = null;

  function renderHud(state: UiState): void {
    setText(goldValue, state.gold);
    setText(livesValue, state.lives);
    if (lastGold !== null && state.gold !== lastGold) restartAnimation(goldPill, state.gold > lastGold ? 'is-up' : 'is-down');
    if (lastLives !== null && state.lives < lastLives) restartAnimation(livesPill, 'is-hurt');
    lastGold = state.gold;
    lastLives = state.lives;
    setClass(livesPill, 'is-low', state.lives <= 5);
    setText(waveNow, state.infinite ? Math.max(1, state.wave) : hudWave(state.phase, state.wave, state.totalWaves));
    setText(waveTotal, state.infinite ? 'infinito' : `de ${state.totalWaves}`);
    setAttr(wavePill, 'aria-label', waveText(state.phase, state.wave, state.totalWaves));

    const pl = pauseLabel(state.paused);
    setText(pauseBtn.label, pl);
    setAttr(pauseBtn.el, 'aria-label', pl);
    setAttr(pauseBtn.el, 'title', state.touch ? pl : `${pl} (P)`);
    setHtml(pauseBtn.icon, state.paused ? ICONS.play : ICONS.pause);
    setPressed(pauseBtn.el, state.paused);

    setText(speedBtn, speedLabel(state.speed));
    setAttr(speedBtn, 'aria-label', `Velocidade ${speedLabel(state.speed)}`);
    setAttr(speedBtn, 'title', state.touch ? 'Velocidade' : 'Velocidade (F)');
    setClass(speedBtn, 'is-fast', state.speed > 1);

    const action = soundAction(state.muted);
    setText(soundBtn.label, soundLabel(state.muted));
    setAttr(soundBtn.el, 'aria-label', action);
    setAttr(soundBtn.el, 'title', state.touch ? action : `${action} (M)`);
    setHtml(soundBtn.icon, state.muted ? ICONS.mute : ICONS.sound);
    setClass(soundBtn.el, 'is-muted', state.muted);
  }

  function renderDock(state: UiState): void {
    for (const card of cards) {
      const affordable = state.affordable[card.id];
      setClass(card.el, 'is-poor', !affordable);
      setPressed(card.el, state.picking === card.id);
    }
    const canStart = state.phase === 'preparando' && (state.infinite || state.wave < state.totalWaves);
    const canCall = state.phase === 'onda' && state.canCallEarly;
    if (canCall) setText(waveBtn, `Chamar onda ${state.upcomingNumber} · +${state.earlyBonus} de ouro`);
    else if (state.phase === 'preparando' && state.infinite) setText(waveBtn, `Iniciar onda ${state.wave + 1}`);
    else setText(waveBtn, startWaveLabel(state.phase, state.wave, state.totalWaves));
    setDisabled(waveBtn, !canStart && !canCall);
    setClass(waveBtn, 'is-ready', canStart && !state.paused);
    setClass(waveBtn, 'is-call', canCall);
    setAttr(waveBtn, 'title', state.touch ? '' : canCall ? 'Chamar a próxima onda agora (C)' : 'Iniciar a onda (Espaço)');
    powers.render(state);
  }

  function renderResult(data: ResultData): void {
    const key = `${data.stageName}|${data.victory}|${data.wave}|${data.totalWaves}|${data.lives}|${data.stats.kills}|${data.stats.goldEarned}|${data.stats.towersBuilt}|${Math.floor(data.stats.elapsed)}|${data.newAchievements.length}`;
    if (!changed(result, 'data', key)) return;
    resultStage.textContent = `${data.stageName} · ${DIFFICULTIES[data.difficulty].name}${data.infinite ? ' · Infinito' : ''}`;
    resultTitleEl.textContent = data.infinite ? `Onda ${data.wave}` : resultTitle(data.victory);
    resultSub.textContent = data.infinite
      ? data.isRecord
        ? 'Novo recorde nesta fase!'
        : `Seu recorde nesta fase é a onda ${data.bestInfinite}.`
      : resultSubtitle(data.victory);
    resultStars.replaceChildren(
      ...(data.infinite ? [] : [0, 1, 2].map((i) => h('span', i < data.stars ? 'ft-star is-on' : 'ft-star', '★'))),
    );
    setClass(resultStars, 'is-hidden', data.infinite);
    resultAch.replaceChildren(
      ...data.newAchievements.map((a) => {
        const item = h('div', 'ft-ach is-done is-new');
        const text = h('span', 'ft-ach-text');
        text.append(h('strong', '', `Conquista: ${a.title}`), h('span', '', a.description));
        item.append(h('span', 'ft-ach-badge', '★'), text);
        return item;
      }),
    );
    setClass(resultAch, 'is-hidden', data.newAchievements.length === 0);
    setClass(nextStageBtn, 'is-hidden', data.nextStageName === null);
    nextStageName.textContent = data.nextStageName ?? '';
    setAttr(nextStageBtn, 'aria-label', data.nextStageName ? `Próxima fase: ${data.nextStageName}` : 'Próxima fase');
    restartBtn.classList.toggle('primary', data.nextStageName === null);
    resultCard.classList.toggle('is-win', data.victory || (data.infinite && data.isRecord));
    resultCard.classList.toggle('is-lose', !data.victory && !(data.infinite && data.isRecord));
    const values = [
      data.infinite ? String(data.wave) : `${data.wave} de ${data.totalWaves}`,
      String(data.lives),
      String(data.stats.kills),
      String(data.stats.goldEarned),
      String(data.stats.towersBuilt),
      formatTime(data.stats.elapsed),
    ];
    values.forEach((v, i) => (summaryValues[i].textContent = v));
  }

  function render(state: UiState): void {
    last = state;
    if (changed(ft, 'screen', state.screen)) {
      ft.dataset.screen = state.screen;
      lastGold = null;
      lastLives = null;
      if (state.screen === 'jogo') openSettings(false);
      if (state.screen !== 'menu') achievements.close();
    }
    setClass(ft, 'is-touch', state.touch);
    if (state.screen === 'menu') menu.render(state.menu);
    if (state.screen === 'jogo') {
      renderHud(state);
      renderDock(state);
    }
    bossBar.render(state);
    tutorial.render(state);
    nextWave.render(state, paletteVersion);
    nextWaveSide.render(state, paletteVersion);
    setClass(pauseVeil, 'is-show', state.screen === 'jogo' && state.paused);
    sheet.render(state, paletteVersion);
    if (state.screen === 'resultado' && state.result) renderResult(state.result);
  }

  let bannerTimer: ReturnType<typeof setTimeout> | null = null;

  function banner(title: string, subtitle?: string): void {
    bannerTitle.textContent = title;
    bannerSub.textContent = subtitle ?? '';
    bannerSub.style.display = subtitle ? '' : 'none';
    bannerEl.classList.remove('is-show');
    void bannerEl.offsetWidth;
    bannerEl.classList.add('is-show');
    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => {
      bannerEl.classList.remove('is-show');
      bannerTimer = null;
    }, BANNER_MS);
  }

  function floatingLabel(clientX: number, clientY: number, text: string, tone: 'gold' | 'bad' | 'good'): void {
    while (floats.childElementCount >= MAX_FLOATS && floats.firstChild) floats.firstChild.remove();
    const el = h('div', `ft-float ft-${tone}`, text);
    el.style.left = `${clientX}px`;
    el.style.top = `${clientY}px`;
    const done = (): void => el.remove();
    el.addEventListener('animationend', done, { once: true });
    setTimeout(done, 1200);
    floats.appendChild(el);
  }

  return { mapHost, render, banner, floatingLabel };
}
