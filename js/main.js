// Einstiegspunkt: Menüs, Einstellungen, Kampagnenfortschritt, Spielschleife
import { icon } from './game/icons.js';
import './eras/index.js';
import { GameRenderer } from './engine/renderer.js';
import { Audio } from './engine/audio.js';
import { Music } from './engine/music.js';
import { Terrain } from './engine/terrain.js';
import { Game } from './game/game.js';
import { SatNet } from './game/satnet.js'; // V3-SL: Satellitennetz
import { RTSCamera, Input } from './game/input.js';
import { getAirShow } from './engine/aircraft.js';
import { HUD } from './game/hud.js';
import { GamepadControl } from './game/gamepad.js';
import { CAMPAIGN, DEMO } from './missions/index.js';
import { isMobile, isTouchDevice, fmtTime } from './engine/util.js';
import { createOnline } from './net/onlineui.js';
import { startSkirmish, createSkirmish, normalizeSetup, roleSummary, roleSummaryText, ROLES, DIFFICULTIES, VICTORY, TEAM_NAME, TEAM_COLOR, MAP_PRESETS, MAP_SIZES } from './skirmish/skirmish.js';
import { describeSetting } from './engine/weather.js';
import { generateSkirmishMap } from './skirmish/maps.js';
import { createEditor } from './editor/editor.js';
import { createModsUI } from './editor/modsui.js';
import { initMods, listCustomMaps, getCustomMap } from './editor/mods.js';
import { compileMission, compileSkirmishGen } from './editor/compile.js';
import { escapeHtml } from './editor/format.js';
import { t, applyI18n, setLang, getLang, isLangAvailable } from './i18n.js'; // V3-MENU
import { getCampaigns, getCampaign, findMission, getProgress, isUnlocked, completeMission, resetProgress, setUnlockAll, nextMission, lastPlayed, setLastPlayed, drawMapSketch, campaignArtSVG, DIFFICULTY, ERAS } from './missions/campaigns.js'; // V3-MENU
initMods(); // V3-E: aktive Mods (Einheitenwerte) vor dem ersten Spielstart anwenden

const $ = (id) => document.getElementById(id);
const SETTINGS_KEY = 'steppensturm.settings.v2'; // v2: neue Grafik-Voreinstellungen
const SKIRMISH_KEY = 'steppensturm.skirmish.v1';

// ---------- Einstellungen ----------
const mobile = isMobile();
const defaults = mobile
  ? { quality: 'medium', upscale: 'auto', targetFps: 30, sharpness: 0.5, bloom: true, shadows: true, showFps: false, volume: 0.7 }
  : { quality: 'high', upscale: 'auto', targetFps: 60, sharpness: 0.4, bloom: true, shadows: true, showFps: false, volume: 0.7 };
let settings = { ...defaults };
try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch (e) { /* ignorieren */ }
const saveSettings = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* ignorieren */ } };

// Kampagnenfortschritt: js/missions/campaigns.js (je Kampagne, inkl. Übernahme des alten Ukraine-Fortschritts)

if (isTouchDevice()) document.body.classList.add('touch');

// ---------- Kernobjekte ----------
const canvas = $('game');
const gr = new GameRenderer(canvas, settings);
const audio = new Audio();
audio.setVolume(settings.volume);
const game = new Game(gr, audio, settings);
game.camera = new RTSCamera(game, gr.camera);
game.satnet = new SatNet(game); // V3-SL: Satellitennetz (Update über game.stepSim-Wrapper, API game.satnet.*)
const hud = new HUD(game, settings);
const input = new Input(game, canvas, hud);
hud.input = input;
const gamepad = new GamepadControl(game, input, hud); // V3-GP

// ---------- Bildschirme ----------
const screens = ['title', 'campaign', 'skirmish', 'online', 'lobby', 'briefing', 'settings', 'help', 'pause', 'end', 'mods'];
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

// ---------- Musik (V3-MUS): prozedural, Thema nach Epoche, Intensität aus Kampfereignissen ----------
const music = new Music(audio);
if (typeof settings.music !== 'boolean') settings.music = true;
if (typeof settings.musicVolume !== 'number') settings.musicVolume = 0.7;
music.setVolume(settings.musicVolume); music.setEnabled(settings.music); music.start('menu');
document.addEventListener('click', () => music.resume(), true);
document.addEventListener('touchstart', () => music.resume(), { once: true, passive: true });
const eraOf = (m) => { const e = m?.era || m?.meta?.era; if (e) return e === 'ww1' ? 'ww2' : e; const d = String(m?.date || ''); return /19[34]\d/.test(d) ? 'ww2' : /afghan|198\d|200\d/i.test(d) ? 'afghan' : 'modern'; };
let combat = 0;
game.on('loaded', () => { combat = 0; music.setIntensity(0); music.start(game.demo || !game.mission ? 'menu' : eraOf(game.mission)); });
game.on('loaded', () => { try { if (game.mission && !game.demo) getAirShow(game).ambient(eraOf(game.mission)); } catch (e) { console.warn('[air]', e); } }); // V3-A: gelegentliche Ambient-Überflüge
game.on('underAttack', () => { combat = Math.min(1, combat + 0.12); });
game.on('kill', (u, killer, silent) => { if (!silent) combat = Math.min(1, combat + 0.07); });
game.on('end', (won) => music.start(won ? 'victory' : 'defeat'));
setInterval(() => { combat *= 0.9; music.setIntensity(game.active && !game.demo && !game.paused && !game.ended ? Math.max(0.1, combat) : 0); }, 500);

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
document.querySelector('.back-campaign').onclick = () => { if (currentMission?.custom) openMods(); else { renderCampaign(); show('campaign'); } };
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
    el.innerHTML = `<div class="num">${i + 1}</div><div><div class="t">${m.title}</div><div class="p">${m.place} · ${m.date}</div>${done ? `<div class="p">Abgeschlossen in ${fmtTime(done.time)} · ${done.kills} Abschüsse</div>` : ''}</div><div class="state">${icon(locked ? 'lock' : done ? 'medal' : 'play', { label: locked ? 'Gesperrt' : done ? 'Abgeschlossen' : 'Starten' })}</div>`;
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
  $('brief-forces').innerHTML = m.forces.map((f) => `<span class="chip">${f}</span>`).join('') + (describeSetting(m) ? `<span class="chip">${describeSetting(m)}</span>` : ''); // V3-W
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
  currentSkirmish = null;
  hideScreens();
  await loadWithSpinner(`Lade „${m.title}" …`, () => {
    game.camera.orbit = false;
    game.load(m);
  });
  inMission = true;
  hud.show(true);
  game.stats.start = game.time;
  updatePauseInfo();
}

// ================= Gefecht (Skirmish) =================
let currentSkirmish = null;
let skSetup = { mode: 2, preset: 'random', size: 'auto', season: 'summer', night: false, team: 'UA', role: 'armor', difficulty: 'normal', reinforce: 180, victory: 'points', seed: Math.floor(Math.random() * 99999) + 1 };
try { Object.assign(skSetup, JSON.parse(localStorage.getItem(SKIRMISH_KEY) || '{}')); } catch (e) { /* ignorieren */ }
const saveSk = () => { try { localStorage.setItem(SKIRMISH_KEY, JSON.stringify(skSetup)); } catch (e) { /* ignorieren */ } };
const opt = (v, t) => `<option value="${v}">${t}</option>`;
$('sk-mode').innerHTML = [1, 2, 3, 4, 5, 6].map((n) => `<button data-v="${n}">${n}v${n}</button>`).join('');
$('sk-role').innerHTML = Object.entries(ROLES).map(([k, r]) => opt(k, r.name)).join('');
$('sk-preset').innerHTML = opt('random', 'Zufall') + MAP_PRESETS.map((p) => opt(p.id, p.name)).join('');
$('sk-size').innerHTML = opt('auto', 'Auto (empfohlen)') + Object.entries(MAP_SIZES).map(([k, z]) => opt(k, `${z.label} (${z.size} m, bis ${z.maxPerTeam}v${z.maxPerTeam})`)).join('');
$('sk-diff').innerHTML = Object.entries(DIFFICULTIES).map(([k, t]) => opt(k, t)).join('');
$('sk-victory').innerHTML = Object.entries(VICTORY).map(([k, t]) => opt(k, t)).join('');
// V3-E: eigene Karten (Editor/Mods) mit Startzonen und Eroberungspunkten
function skCustomMaps() { return listCustomMaps().filter((c) => { const t = new Set(c.doc.zones.map((z) => z.team)); return t.has('UA') && t.has('RU') && c.doc.points.length; }); }
function renderSkCustom() {
  const list = skCustomMaps();
  if (skSetup.customKey && !list.some((c) => c.key === skSetup.customKey)) skSetup.customKey = '';
  $('sk-custom').innerHTML = opt('', 'Generiert (Kartenthema)') + list.map((c) => `<option value="${escapeHtml(c.key)}">${escapeHtml(c.title)} – ${escapeHtml(c.source)}</option>`).join('');
  $('sk-custom').value = skSetup.customKey || '';
  const custom = !!skSetup.customKey;
  for (const id of ['sk-preset', 'sk-size', 'sk-season', 'sk-seed', 'sk-reroll']) $(id).disabled = custom;
  $('sk-night').disabled = custom;
}
const skGenCache = new Map();
function skCustomGen(key) {
  const doc = getCustomMap(key);
  if (!doc) return null;
  const ck = key + '|' + (doc.meta.modified || '') + '|' + JSON.stringify(doc).length;
  if (!skGenCache.has(ck)) skGenCache.set(ck, compileSkirmishGen(doc));
  return skGenCache.get(ck);
}
function renderSkSetup() {
  renderSkCustom();
  for (const [id, key] of [['sk-mode', 'mode'], ['sk-team', 'team']]) $(id).querySelectorAll('button').forEach((b) => b.classList.toggle('active', String(skSetup[key]) === b.dataset.v));
  $('sk-role').value = skSetup.role; $('sk-preset').value = skSetup.preset; $('sk-size').value = skSetup.size; $('sk-season').value = skSetup.season;
  $('sk-night').checked = !!skSetup.night; $('sk-diff').value = skSetup.difficulty; $('sk-reinforce').value = String(skSetup.reinforce);
  $('sk-victory').value = skSetup.victory; $('sk-seed').value = skSetup.seed;
  renderRoleDesc();
  schedulePreview();
}
// MP-T7 (P3a): Was bringt die Rolle mit? (Zeile unter der Auswahl + Tooltip je Option, abhängig vom Team)
function renderRoleDesc() {
  const team = skSetup.team === 'RU' ? 'RU' : 'UA';
  const r = roleSummary(skSetup.role, team);
  $('sk-role-desc').innerHTML = `<span>${r.text}</span><br><b>Bringt mit:</b> ${r.units}<br><b>Fähigkeiten:</b> ${r.abil}<br><span class="muted">${r.logi}</span>`;
  $('sk-role').querySelectorAll('option').forEach((o) => { o.title = roleSummaryText(o.value, team); });
  $('sk-role').title = roleSummaryText(skSetup.role, team);
}
const skChanged = () => { saveSk(); renderSkSetup(); };
for (const id of ['sk-mode', 'sk-team']) $(id).addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; skSetup[id === 'sk-mode' ? 'mode' : 'team'] = id === 'sk-mode' ? +b.dataset.v : b.dataset.v; skChanged(); });
for (const [id, key, conv] of [['sk-role', 'role'], ['sk-preset', 'preset'], ['sk-size', 'size'], ['sk-season', 'season'], ['sk-diff', 'difficulty'], ['sk-reinforce', 'reinforce', Number], ['sk-victory', 'victory'], ['sk-seed', 'seed', (v) => Math.max(1, Math.floor(+v) || 1)]]) {
  $(id).addEventListener('change', () => { skSetup[key] = conv ? conv($(id).value) : $(id).value; skChanged(); });
}
$('sk-night').addEventListener('change', () => { skSetup.night = $('sk-night').checked; skChanged(); });
$('sk-custom').addEventListener('change', () => { skSetup.customKey = $('sk-custom').value; skChanged(); });
$('sk-reroll').onclick = () => { skSetup.seed = Math.floor(Math.random() * 99999) + 1; skChanged(); };
let previewTimer = null;
const previewCache = new Map();
function schedulePreview() { clearTimeout(previewTimer); previewTimer = setTimeout(drawPreview, 180); }
function drawPreview() {
  const cg = skSetup.customKey ? skCustomGen(skSetup.customKey) : null;
  const S = normalizeSetup(cg ? { ...skSetup, customMap: cg } : skSetup);
  const gen = cg || generateSkirmishMap({ size: S.sizeResolved, seed: S.seed, playersPerTeam: S.mode, season: S.season, night: S.night, preset: S.presetResolved });
  const c = $('sk-map'), ctx = c.getContext('2d');
  const key = cg ? 'custom|' + skSetup.customKey + '|' + gen.map.features.length + '|' + gen.map.seed : `${S.seed}|${S.presetResolved}|${S.sizeResolved}|${S.season}|${S.mode}`;
  let img = previewCache.get(key);
  if (!img) { try { img = new Terrain(gen.map, 'low').minimapImage(240); previewCache.set(key, img); } catch (e) { console.error(e); } }
  ctx.fillStyle = '#111'; ctx.fillRect(0, 0, c.width, c.height);
  if (img) ctx.drawImage(img, 0, 0, c.width, c.height);
  const N = gen.map.size, toC = (x, z) => [((x + N / 2) / N) * c.width, ((z + N / 2) / N) * c.height];
  for (const cp of gen.capturePoints) {
    const [x, y] = toC(cp.x, cp.z);
    ctx.fillStyle = 'rgba(140,144,150,.55)'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, Math.max(5, cp.radius / N * c.width), 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = '700 10px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(cp.kind === 'zeppelin' ? 'Z' : cp.kind === 'aerostat' ? 'B' : '•', x, y + 0.5);
  }
  for (const team of ['UA', 'RU']) gen.spawns[team].forEach((sp, i) => {
    const [x, y] = toC(sp.x, sp.z);
    ctx.fillStyle = TEAM_COLOR[team]; ctx.fillRect(x - 4, y - 4, 8, 8);
    if (team === S.team && i === 0) { ctx.strokeStyle = '#5dff8a'; ctx.lineWidth = 2; ctx.strokeRect(x - 6, y - 6, 12, 12); }
  });
  ctx.textBaseline = 'alphabetic';
  const zep = gen.capturePoints.filter((p) => p.kind === 'zeppelin').length;
  if (cg) { $('sk-info').innerHTML = `<b>${gen.title}</b> · ${S.mode}v${S.mode}<br>${gen.place}<br>${gen.description}<br>${gen.capturePoints.length} Eroberungspunkte (${zep} Zeppelin) · Startzonen ${gen.spawns.UA.length}/${gen.spawns.RU.length}` + (Math.max(gen.spawns.UA.length, gen.spawns.RU.length) < S.mode ? `<br><span class="warn">Weniger Startzonen als Spieler – Spieler teilen sich Startzonen.</span>` : ''); return; }
  $('sk-info').innerHTML = `<b>${gen.title}</b> · ${S.mode}v${S.mode}<br>${MAP_PRESETS.find((p) => p.id === gen.preset)?.description || ''}<br>${gen.capturePoints.length} Eroberungspunkte (${zep} Zeppelin) · Seed <b>${S.seed}</b>` +
    (S.sizeAdjusted ? `<br><span class="warn">Größe auf „${MAP_SIZES[S.sizeResolved].label}" angehoben (${S.mode} Spieler je Team).</span>` : '');
}
function openSkirmish() { returnTo = 'title'; renderSkSetup(); show('skirmish'); }
$('btn-skirmish').onclick = openSkirmish;
$('btn-sk-start').onclick = () => startSkirmishGame(withCustomMap({ ...skSetup }));
function withCustomMap(setup) {
  if (!setup.customKey) return setup;
  const doc = getCustomMap(setup.customKey);
  if (!doc) { setup.customKey = ''; return setup; }
  return { ...setup, customMap: compileSkirmishGen(doc) };
}

async function startSkirmishGame(setup) {
  currentSkirmish = setup;
  hideScreens();
  let m = null;
  await loadWithSpinner('Lade Gefechtskarte …', () => {
    game.camera.orbit = false;
    m = startSkirmish(game, setup);
  });
  if (!m) { show('skirmish'); return null; }
  currentMission = m;
  inMission = true;
  hud.show(true);
  game.stats.start = game.time;
  updatePauseInfo();
  return m;
}
// ================= Online-Gefecht (MP-T5) =================
const online = createOnline({
  game, show, hideScreens,
  startGame: (S) => startOnlineGame(S),
  toMenu: async () => { inMission = false; game.paused = false; hud.show(false); await loadDemo(); show('title'); },
  simTick: (dt) => simTick(dt),
});
async function startOnlineGame(S) {
  currentSkirmish = null;
  hideScreens();
  let m = null;
  await loadWithSpinner(`Lade Online-Gefecht (${S.mode}v${S.mode}) …`, () => {
    game.camera.orbit = false;
    m = createSkirmish(S);
    game.setupPlayers(m.players);
    game.load(m);
  });
  if (!m || !game.active) { online.hostLost('Die Karte konnte nicht geladen werden.'); return; }
  currentMission = m;
  inMission = true;
  hud.show(true);
  game.stats.start = game.time;
  updatePauseInfo();
}
function updatePauseInfo() {
  const el = $('pause-info');
  const sk = game.mission?.skirmish;
  el.classList.toggle('hidden', !sk);
  const on = online.inGame;
  $('btn-restart').classList.toggle('hidden', on);
  $('btn-quit').textContent = on ? 'Online-Spiel verlassen' : sk ? 'Zum Gefechtsmenü' : currentMission?.custom ? (currentMission.fromEditor ? 'Zurück zum Editor' : 'Zu eigenen Karten') : 'Zur Kampagne';
  $('btn-resume').textContent = on ? 'Zurück zum Spiel' : 'Weiter';
  $('btn-restart').textContent = sk ? 'Gefecht neu starten' : 'Mission neu starten';
  if (sk && on) { const S = sk.setup; el.innerHTML = `${game.mission.title}<br>Online · Seed <b>${S.seed}</b> · ${ROLES[game.localPlayer?.role]?.name || ''} · ${VICTORY[S.victory]}<br>Das Spiel läuft im Hintergrund weiter.`; return; }
  if (sk) { const S = sk.setup; el.innerHTML = `${game.mission.title}<br>Seed <b>${S.seed}</b> · ${ROLES[S.role].name} · KI ${DIFFICULTIES[S.difficulty]} · Verstärkung alle ${Math.round(S.reinforce / 60 * 10) / 10} min · ${VICTORY[S.victory]}`; }
}
function showSkirmishEnd(won, text) {
  const sk = game.mission.skirmish;
  const draw = sk.result && sk.result.winner === null;
  $('end-title').textContent = draw ? 'Unentschieden' : won ? 'Sieg' : 'Niederlage';
  $('end-title').style.color = draw ? '#e5b93e' : won ? '#46c46b' : '#e5484d';
  $('end-text').innerHTML = `<p>${text}</p>`;
  const rows = [];
  for (const team of [game.localSide, game.localSide === 'UA' ? 'RU' : 'UA']) {
    const ps = game.playersOfTeam(team);
    const sum = (k) => ps.reduce((s, p) => s + (p.stats[k] || 0), 0);
    rows.push(`<tr class="team"><td style="color:${TEAM_COLOR[team]}">${TEAM_NAME[team]} – ${sk.scores[team]} Punkte</td><td>${sum('kills')}</td><td>${sum('lost')}</td><td>${sum('captured')}</td><td>${sum('reinf')}</td></tr>`);
    for (const p of ps) rows.push(`<tr class="${p.id === game.localPlayerId ? 'me' : ''}"><td><span class="dot" style="background:${p.color}"></span>${ROLES[p.role] ? icon(ROLES[p.role].iconKey, { cls: 'ic-in', label: ROLES[p.role].name }) : ''} ${p.name}${p.defeated ? ' ' + icon('close', { cls: 'ic-in', label: 'Ausgeschieden' }) : ''}</td><td>${p.stats.kills}</td><td>${p.stats.lost}</td><td>${p.stats.captured || 0}</td><td>${p.stats.reinf || 0}</td></tr>`);
  }
  $('end-stats').innerHTML = `<div>${icon('clock', { cls: 'ic-in' })} Gefechtsdauer: <b>${fmtTime(game.time)}</b> · Seed ${sk.setup.seed}</div><table class="sk-end-table"><tr><th>Spieler</th><th>Abschüsse</th><th>Verluste</th><th>Erobert</th><th>Verstärkung</th></tr>${rows.join('')}</table>`;
  const next = $('btn-end-next');
  $('btn-end-retry').classList.toggle('hidden', online.inGame);
  if (online.inGame) {
    next.textContent = 'Zum Hauptmenü';
    next.onclick = () => online.leaveGame();
    show('end');
    return;
  }
  next.textContent = 'Gefechtsmenü';
  next.onclick = async () => { await loadDemo(); openSkirmish(); };
  $('btn-end-retry').textContent = 'Revanche';
  $('btn-end-retry').onclick = () => { game.paused = false; startSkirmishGame(currentSkirmish); };
  show('end');
}

// Pause
hud.onTogglePause = () => {
  if (!inMission || game.ended) return;
  if (online.inGame) { // Online: nur lokales Menü, die Simulation läuft weiter
    if (current === 'pause') hideScreens(); else { updatePauseInfo(); show('pause'); }
    return;
  }
  if (game.paused && current === 'pause') { game.paused = false; hideScreens(); }
  else if (!game.paused) { game.paused = true; show('pause'); }
};
$('btn-menu').onclick = () => hud.togglePause();
$('btn-resume').onclick = () => { if (!online.inGame) game.paused = false; hideScreens(); };
$('btn-pause-settings').onclick = () => { returnTo = 'pause'; openSettings(); };
$('btn-restart').onclick = () => { game.paused = false; if (currentSkirmish) startSkirmishGame(currentSkirmish); else startMission(currentMission); };
$('btn-quit').onclick = async () => {
  if (online.inGame) { online.leaveGame(); return; }
  game.paused = false;
  const m = currentMission;
  if (!currentSkirmish && m?.custom) { if (m.fromEditor) backToEditor(m); else { await loadDemo(); openMods(); } return; }
  const sk = !!currentSkirmish; await loadDemo(); if (sk) openSkirmish(); else { renderCampaign(); show('campaign'); }
};

// Missionsende
game.on('end', (won, text) => {
  if (!inMission) return;
  game.paused = true;
  if (online.inGame) online.toggleChat(false);
  if (game.mission?.skirmish) { showSkirmishEnd(won, text); return; }
  if (game.mission?.custom) { showCustomEnd(won, text); return; }
  $('btn-end-retry').classList.remove('hidden');
  $('btn-end-retry').textContent = 'Erneut versuchen';
  const m = currentMission;
  const idx = CAMPAIGN.indexOf(m);
  $('end-title').textContent = won ? 'Mission erfüllt' : 'Mission gescheitert';
  $('end-title').style.color = won ? '#46c46b' : '#e5484d';
  $('end-text').innerHTML = `<p>${text}</p>${won && m.victory ? `<p style="color:#9aa4b2;white-space:pre-line">${m.victory}</p>` : ''}`;
  const t = game.time;
  $('end-stats').innerHTML = `<div class="cols"><div>${icon('clock', { cls: 'ic-in' })} Einsatzzeit: <b>${fmtTime(t)}</b><br>${icon('attack', { cls: 'ic-in' })} Feindliche Verluste: <b>${game.stats.kills}</b></div><div>${icon('close', { cls: 'ic-in' })} Eigene Verluste: <b>${game.stats.lost}</b><br>${icon('obj_protect', { cls: 'ic-in' })} Abgefangene Flugkörper: <b>${game.stats.intercepts}</b></div></div>`;
  if (won) {
    progress.done[m.id] = { time: t, kills: game.stats.kills };
    progress.unlocked = Math.max(progress.unlocked, idx + 2);
    saveProgress();
  }
  const next = $('btn-end-next');
  if (won) {
    next.textContent = idx + 1 < CAMPAIGN.length ? 'Nächste Mission' : 'Zum Hauptmenü';
    next.onclick = async () => { if (idx + 1 < CAMPAIGN.length) { await loadDemo(); openBriefing(CAMPAIGN[idx + 1]); } else { await loadDemo(); show('title'); } };
  } else {
    next.textContent = 'Zur Kampagne';
    next.onclick = async () => { await loadDemo(); renderCampaign(); show('campaign'); };
  }
  $('btn-end-retry').onclick = () => { game.paused = false; startMission(m); };
  show('end');
});

// ================= V3-E: Karteneditor, Mods, eigene Karten =================
function showCustomEnd(won, text) {
  const m = game.mission;
  $('btn-end-retry').classList.remove('hidden');
  $('btn-end-retry').textContent = 'Erneut spielen';
  $('end-title').textContent = won ? 'Mission erfüllt' : 'Mission gescheitert';
  $('end-title').style.color = won ? '#46c46b' : '#e5484d';
  $('end-text').innerHTML = `<p>${escapeHtml(text)}</p><p class="muted">${escapeHtml(m.title)}</p>`;
  $('end-stats').innerHTML = `<div class="cols"><div>${icon('clock', { cls: 'ic-in' })} Einsatzzeit: <b>${fmtTime(game.time)}</b><br>${icon('attack', { cls: 'ic-in' })} Feindliche Verluste: <b>${game.stats.kills}</b></div><div>${icon('close', { cls: 'ic-in' })} Eigene Verluste: <b>${game.stats.lost}</b></div></div>`;
  const next = $('btn-end-next');
  next.textContent = m.fromEditor ? 'Zurück zum Editor' : 'Eigene Karten';
  next.onclick = async () => { game.paused = false; if (m.fromEditor) backToEditor(m); else { await loadDemo(); openMods(); } };
  $('btn-end-retry').onclick = () => { game.paused = false; startMission(m); };
  show('end');
}
function backToEditor(m) {
  inMission = false; game.paused = false; hud.show(false);
  editor.open(m.doc, { cam: editor.returnCam, keepUndo: true });
}
const editor = createEditor({
  game, gr, input, hud, hideScreens, show,
  playMission: (m) => startMission(m),
  onExit: async () => { await loadDemo(); show('title'); },
});
const modsUI = createModsUI({
  openEditor: (doc) => editor.open(doc),
  playAsMission: (entry) => openBriefing(compileMission(entry.doc, { source: entry.key })),
  playAsSkirmish: (entry) => { skSetup.customKey = entry.key; saveSk(); openSkirmish(); },
});
function openMods() { returnTo = 'title'; modsUI.render(); show('mods'); }
$('btn-editor').onclick = () => editor.open();
$('btn-mods').onclick = () => openMods();

// Einstellungen
function ensureMusicUI() {
  if ($('set-music')) return;
  const host = $('set-volume').closest('label'); if (!host) return;
  host.insertAdjacentHTML('afterend', '<label class="check"><input id="set-music" type="checkbox"> Musik</label><label>Musiklautstärke <input id="set-musicvol" type="range" min="0" max="1" step="0.05"></label>');
  $('set-music').addEventListener('input', () => { settings.music = $('set-music').checked; saveSettings(); music.setEnabled(settings.music); });
  $('set-musicvol').addEventListener('input', () => { settings.musicVolume = +$('set-musicvol').value; saveSettings(); music.setVolume(settings.musicVolume); });
}
function openSettings() {
  ensureMusicUI(); $('set-music').checked = settings.music; $('set-musicvol').value = settings.musicVolume;
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
// Simulationsschritt (auch vom Hintergrund-Takt des Online-Hosts genutzt): Client wendet vor, Host sendet nach dem Schritt
function simTick(dt) {
  const sess = online.session;
  if (sess && !sess.isHost) online.update(dt);
  const t0 = performance.now();
  game.update(dt);
  if (sess?.isHost) {
    online.update(dt);
    const ms = performance.now() - t0, st = sess.stats;
    st.ticks++; st.tickMs += ms; if (ms > st.tickMax) st.tickMax = ms;
  }
}
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  gamepad.update(dt);
  input.update(dt);
  simTick(dt);
  online.frameDone();
  if (inMission) hud.update(dt);
  if (editor.active) editor.update(dt);
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
  window.__gamepad = gamepad;
  window.__music = music;
  window.__start = (i) => startMission(CAMPAIGN[i]);
  window.__startSkirmish = (setup = {}) => startSkirmishGame({ ...skSetup, ...setup });
  window.__openSkirmish = openSkirmish;
  window.__online = online;
  window.__editor = editor;
  window.__modsUI = modsUI;
  window.__openMods = openMods;
})();

// Offline-Fähigkeit (PWA)
if (!window.__ARTIFACT && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
// App im Hintergrund → Pause
document.addEventListener('visibilitychange', () => { if (document.hidden && inMission && !game.paused && !game.ended && !online.inGame) hud.togglePause(); });
