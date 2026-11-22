// Einstiegspunkt: Menüs, Einstellungen, Kampagnenfortschritt, Spielschleife
import { GameRenderer } from './engine/renderer.js';
import { Audio } from './engine/audio.js';
import { Terrain } from './engine/terrain.js';
import { Game } from './game/game.js';
import { RTSCamera, Input } from './game/input.js';
import { HUD } from './game/hud.js';
import { CAMPAIGN, DEMO } from './missions/index.js';
import { isMobile, isTouchDevice, fmtTime } from './engine/util.js';

const $ = (id) => document.getElementById(id);
const SETTINGS_KEY = 'steppensturm.settings.v1';
const PROGRESS_KEY = 'steppensturm.progress.v1';

// ---------- Einstellungen ----------
const mobile = isMobile();
const defaults = mobile
  ? { quality: 'medium', upscale: 'auto', targetFps: 30, sharpness: 0.5, bloom: true, shadows: true, showFps: false, volume: 0.7 }
  : { quality: 'high', upscale: 'auto', targetFps: 60, sharpness: 0.4, bloom: true, shadows: true, showFps: false, volume: 0.7 };
let settings = { ...defaults };
try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch (e) { /* ignorieren */ }
const saveSettings = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* ignorieren */ } };

let progress = { unlocked: 1, done: {} };
try { Object.assign(progress, JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}')); } catch (e) { /* ignorieren */ }
const saveProgress = () => { try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch (e) { /* ignorieren */ } };

if (isTouchDevice()) document.body.classList.add('touch');

// ---------- Kernobjekte ----------
const canvas = $('game');
const gr = new GameRenderer(canvas, settings);
const audio = new Audio();
audio.setVolume(settings.volume);
const game = new Game(gr, audio, settings);
game.camera = new RTSCamera(game, gr.camera);
const hud = new HUD(game, settings);
const input = new Input(game, canvas, hud);
hud.input = input;

// ---------- Bildschirme ----------
const screens = ['title', 'campaign', 'briefing', 'settings', 'help', 'pause', 'end'];
let current = 'title', returnTo = 'title';
function show(name) {
  for (const s of screens) $('screen-' + s).classList.toggle('hidden', s !== name);
  current = name;
}
function hideScreens() { for (const s of screens) $('screen-' + s).classList.add('hidden'); current = null; }
document.addEventListener('click', (e) => { audio.init(); if (e.target.closest('button')) audio.ui('click'); }, true);
document.addEventListener('touchstart', () => audio.init(), { once: true, passive: true });

let inMission = false;
let currentMission = null;

function loadWithSpinner(text, fn) {
  $('loading-text').textContent = text;
  $('loading').classList.remove('hidden');
  return new Promise((res) => setTimeout(() => {
    try { fn(); } catch (err) { console.error(err); $('loading-text').textContent = 'Fehler beim Laden: ' + err.message; return setTimeout(() => { $('loading').classList.add('hidden'); res(); }, 4000); }
    $('loading').classList.add('hidden');
    res();
  }, 30));
}
function loadDemo() {
  inMission = false;
  hud.show(false);
  return loadWithSpinner('Lade Schlachtfeld …', () => game.load(DEMO, { demo: true }));
}

// Titel
$('btn-campaign').onclick = () => { renderCampaign(); show('campaign'); };
$('btn-settings').onclick = () => { returnTo = 'title'; openSettings(); };
$('btn-help').onclick = () => { returnTo = 'title'; show('help'); };
$('btn-fullscreen').onclick = () => {
  const el = document.documentElement;
  if (!document.fullscreenElement) (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el)?.catch?.(() => {});
  else document.exitFullscreen?.();
  try { screen.orientation?.lock?.('landscape').catch(() => {}); } catch (e) { /* ignorieren */ }
};
document.querySelectorAll('.back').forEach((b) => (b.onclick = () => show(returnTo === 'pause' ? 'pause' : returnTo)));
document.querySelector('.back-campaign').onclick = () => { renderCampaign(); show('campaign'); };
// "Zurück" im Kampagnenmenü führt zum Titel
document.querySelector('#screen-campaign .back').onclick = () => show('title');

// Kampagne
function renderCampaign() {
  const list = $('mission-list');
  list.innerHTML = '';
  CAMPAIGN.forEach((m, i) => {
    const locked = i + 1 > progress.unlocked;
    const done = progress.done[m.id];
    const el = document.createElement('div');
    el.className = 'mission-card' + (locked ? ' locked' : '');
    el.innerHTML = `<div class="num">${i + 1}</div><div><div class="t">${m.title}</div><div class="p">${m.place} · ${m.date}</div>${done ? `<div class="p">Abgeschlossen in ${fmtTime(done.time)} · ${done.kills} Abschüsse</div>` : ''}</div><div class="state">${locked ? '🔒' : done ? '🏅' : '▶'}</div>`;
    if (!locked) el.onclick = () => openBriefing(m);
    list.appendChild(el);
  });
}
// Zweistufige Bestätigung direkt im Knopf (Browser-Dialoge sind nicht überall verfügbar)
$('btn-reset-progress').onclick = (e) => {
  const b = e.currentTarget;
  if (!b.dataset.armed) {
    b.dataset.armed = '1'; b.textContent = 'Wirklich zurücksetzen? Nochmal tippen';
    setTimeout(() => { delete b.dataset.armed; b.textContent = 'Fortschritt zurücksetzen'; }, 4000);
    return;
  }
  delete b.dataset.armed; b.textContent = 'Fortschritt zurücksetzen';
  progress = { unlocked: 1, done: {} }; saveProgress(); renderCampaign();
};
// Entwickler-/Testmodus: ?unlock=all schaltet alle Missionen frei
if (new URLSearchParams(location.search).get('unlock') === 'all') progress.unlocked = CAMPAIGN.length;

const briefMapCache = {};
function openBriefing(m) {
  currentMission = m;
  $('brief-place').textContent = `${m.place} · ${m.date}`;
  $('brief-title').textContent = m.title;
  $('brief-text').innerHTML = m.briefing.map((b) => `<p><span class="speaker">${b.s}:</span> ${b.t}</p>`).join('');
  $('brief-objectives').innerHTML = m.objectivesPreview.map((o) => `<li>${o}</li>`).join('');
  $('brief-forces').innerHTML = m.forces.map((f) => `<span class="chip">${f}</span>`).join('');
  show('briefing');
  // Lagekarte
  const c = $('brief-map'), ctx = c.getContext('2d');
  ctx.fillStyle = '#111'; ctx.fillRect(0, 0, c.width, c.height);
  setTimeout(() => {
    if (!briefMapCache[m.id]) briefMapCache[m.id] = new Terrain(m.map, 'low').minimapImage(220);
    ctx.drawImage(briefMapCache[m.id], 0, 0, c.width, c.height);
    ctx.strokeStyle = 'rgba(0,0,0,.35)';
    for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo((i * c.width) / 6, 0); ctx.lineTo((i * c.width) / 6, c.height); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, (i * c.height) / 6); ctx.lineTo(c.width, (i * c.height) / 6); ctx.stroke(); }
    if (m.camera) {
      const s = m.map.size;
      const x = ((m.camera.x + s / 2) / s) * c.width, y = ((m.camera.z + s / 2) / s) * c.height;
      ctx.fillStyle = '#5dff8a'; ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '700 12px system-ui'; ctx.fillText('Start', x + 9, y + 4);
    }
  }, 20);
}
$('btn-start-mission').onclick = () => startMission(currentMission);

async function startMission(m) {
  currentMission = m;
  hideScreens();
  await loadWithSpinner(`Lade „${m.title}" …`, () => {
    game.camera.orbit = false;
    game.load(m);
  });
  inMission = true;
  hud.show(true);
  game.stats.start = game.time;
}

// Pause
hud.onTogglePause = () => {
  if (!inMission || game.ended) return;
  if (game.paused && current === 'pause') { game.paused = false; hideScreens(); }
  else if (!game.paused) { game.paused = true; show('pause'); }
};
$('btn-menu').onclick = () => hud.togglePause();
$('btn-resume').onclick = () => { game.paused = false; hideScreens(); };
$('btn-pause-settings').onclick = () => { returnTo = 'pause'; openSettings(); };
$('btn-restart').onclick = () => { game.paused = false; startMission(currentMission); };
$('btn-quit').onclick = async () => { game.paused = false; await loadDemo(); renderCampaign(); show('campaign'); };

// Missionsende
game.on('end', (won, text) => {
  if (!inMission) return;
  game.paused = true;
  const m = currentMission;
  const idx = CAMPAIGN.indexOf(m);
  $('end-title').textContent = won ? '✔ Mission erfüllt' : '✖ Mission gescheitert';
  $('end-title').style.color = won ? '#46c46b' : '#e5484d';
  $('end-text').innerHTML = `<p>${text}</p>${won && m.victory ? `<p style="color:#9aa4b2;white-space:pre-line">${m.victory}</p>` : ''}`;
  const t = game.time;
  $('end-stats').innerHTML = `<div class="cols"><div>⏱ Einsatzzeit: <b>${fmtTime(t)}</b><br>💥 Feindliche Verluste: <b>${game.stats.kills}</b></div><div>🪦 Eigene Verluste: <b>${game.stats.lost}</b><br>🛡️ Abgefangene Flugkörper: <b>${game.stats.intercepts}</b></div></div>`;
  if (won) {
    progress.done[m.id] = { time: t, kills: game.stats.kills };
    progress.unlocked = Math.max(progress.unlocked, idx + 2);
    saveProgress();
  }
  const next = $('btn-end-next');
  if (won) {
    next.textContent = idx + 1 < CAMPAIGN.length ? 'Nächste Mission ▶' : 'Zum Hauptmenü';
    next.onclick = async () => { if (idx + 1 < CAMPAIGN.length) { await loadDemo(); openBriefing(CAMPAIGN[idx + 1]); } else { await loadDemo(); show('title'); } };
  } else {
    next.textContent = 'Zur Kampagne';
    next.onclick = async () => { await loadDemo(); renderCampaign(); show('campaign'); };
  }
  $('btn-end-retry').onclick = () => { game.paused = false; startMission(m); };
  show('end');
});

// Einstellungen
function openSettings() {
  $('set-quality').value = settings.quality;
  $('set-upscale').value = settings.upscale;
  $('set-targetfps').value = String(settings.targetFps);
  $('set-sharpness').value = settings.sharpness;
  $('set-bloom').checked = settings.bloom;
  $('set-shadows').checked = settings.shadows;
  $('set-fps').checked = settings.showFps;
  $('set-volume').value = settings.volume;
  show('settings');
}
function bindSetting(id, key, conv = (v) => v, prop = 'value') {
  $(id).addEventListener('input', () => {
    settings[key] = conv($(id)[prop]);
    saveSettings();
    gr.applySettings();
    audio.setVolume(settings.volume);
    if (key === 'quality') game.settings.quality = settings.quality;
  });
}
bindSetting('set-quality', 'quality');
bindSetting('set-upscale', 'upscale');
bindSetting('set-targetfps', 'targetFps', Number);
bindSetting('set-sharpness', 'sharpness', Number);
bindSetting('set-bloom', 'bloom', Boolean, 'checked');
bindSetting('set-shadows', 'shadows', Boolean, 'checked');
bindSetting('set-fps', 'showFps', Boolean, 'checked');
bindSetting('set-volume', 'volume', Number);

// ---------- Spielschleife ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  input.update(dt);
  game.update(dt);
  if (inMission) hud.update(dt);
  gr.render(dt);
  requestAnimationFrame(frame);
}

// Start
(async () => {
  show('title');
  await loadDemo();
  requestAnimationFrame(frame);
  // Debug-Zugriff
  window.__game = game;
  window.__start = (i) => startMission(CAMPAIGN[i]);
})();

// Offline-Fähigkeit (PWA)
if (!window.__ARTIFACT && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
// App im Hintergrund → Pause
document.addEventListener('visibilitychange', () => { if (document.hidden && inMission && !game.paused && !game.ended) hud.togglePause(); });
