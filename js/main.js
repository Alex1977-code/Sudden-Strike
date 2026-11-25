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
import { refreshMissionLang, deText } from './i18n/runtime.js'; // V3-I18N-B: englische Missions-/Kampagnentexte
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
import { t, tr, applyI18n, setLang, getLang, isLangAvailable, onLangChange, setNameSources } from './i18n.js'; // V3-MENU
import { UNIT_TYPES, W as WEAPONS } from './game/unitTypes.js'; // V3-I18N-A: Namensregister für die Übersetzung
import { ABILITIES } from './game/abilities.js';
import { SK_WEATHER, SK_DAYTIME } from './engine/weather.js'; // V3-MENU: Wetter/Tageszeit im Gefecht-Setup und in der Lobby
import { getCampaigns, getCampaign, findMission, getProgress, isUnlocked, completeMission, resetProgress, setUnlockAll, nextMission, lastPlayed, setLastPlayed, drawMapSketch, campaignArtSVG, DIFFICULTY, ERAS } from './missions/campaigns.js'; // V3-MENU
// V3-X: Speichern/Laden, Schwierigkeitsgrade, Sichtlinien-Werkzeug, Sprachfunk, Medaillen & Erfolge
import { SimRecorder, readSave } from './game/savegame.js';
import { createSaveUI } from './game/saveui.js';
import { installDifficulty, LEVELS, levelOf, normLevel } from './game/difficulty.js';
import { LosTool } from './game/lostool.js';
import { RadioVoice } from './engine/speech.js';
import { AwardTracker, evaluateMedal, medalBarHTML, awardsOnlyHTML, renderAwardsPage, MEDAL_NAMES } from './game/medals.js';
import { getCampaignLevel, setCampaignLevel } from './missions/campaigns.js';
import { createReplayUI } from './game/replayui.js'; // V3-RS: Wiederholungen
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
// V3-X: Aufzeichnung für Spielstände (Seed-RNG + Kommandoprotokoll), Schwierigkeitsgrade, Sichtlinie, Sprachfunk, Erfolge
const rec = new SimRecorder(game);
installDifficulty(game);
const losTool = new LosTool(game, hud, input);
setNameSources({ units: UNIT_TYPES, weapons: WEAPONS, abilities: ABILITIES }); // V3-I18N-A
const voice = new RadioVoice(game, settings, { getLang: () => getLang(), tr, isActive: () => inMission && !current });
const awards = new AwardTracker(game, { isActive: () => inMission && !online?.inGame });

// ---------- Bildschirme ----------
const screens = ['title', 'campaign', 'skirmish', 'online', 'lobby', 'briefing', 'settings', 'help', 'pause', 'end', 'mods', 'saves', 'awards', 'replays']; // V3-X: saves, awards · V3-RS: replays
let current = 'title', returnTo = 'title';
function show(name) {
  for (const s of screens) $('screen-' + s).classList.toggle('hidden', s !== name);
  current = name;
  if (name === 'title') renderTitle(); // V3-MENU: „Fortsetzen“-Karte aktualisieren
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

// ================= Titel (V3-MENU) =================
$('btn-campaign').onclick = () => { renderCampaignGrid(); show('campaign'); };
$('btn-settings').onclick = () => { returnTo = 'title'; openSettings(); };
$('btn-help').onclick = () => { returnTo = 'title'; helpFrom = null; show('help'); };
$('btn-fullscreen').onclick = () => {
  const el = document.documentElement;
  if (!document.fullscreenElement) (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el)?.catch?.(() => {});
  else document.exitFullscreen?.();
  try { screen.orientation?.lock?.('landscape').catch(() => {}); } catch (e) { /* ignorieren */ }
};
document.addEventListener('fullscreenchange', () => {
  const s = $('btn-fullscreen').querySelector('span');
  if (s) s.textContent = document.fullscreenElement ? t('menu.fullscreen.off', 'Fenster') : t('menu.fullscreen', 'Vollbild');
});
document.querySelectorAll('.back').forEach((b) => (b.onclick = () => show(returnTo === 'pause' ? 'pause' : returnTo)));
document.querySelector('.back-campaign').onclick = () => {
  if (currentMission?.custom) { openMods(); return; }
  const fm = findMission(currentMission);
  if (fm) openCampaign(fm.campaign.id, fm.index); else { renderCampaignGrid(); show('campaign'); }
};
// "Zurück" im Kampagnenmenü: Missionsliste → Kampagnenauswahl → Titel
document.querySelector('#screen-campaign .back').onclick = () => { if (campSel) renderCampaignGrid(); else show('title'); };
// Hilfe: zurück dorthin, woher sie geöffnet wurde (Titel, Pause oder Einstellungen)
let helpFrom = null;
document.querySelector('#screen-help .back').onclick = () => { if (helpFrom === 'settings') { helpFrom = null; show('settings'); } else show(returnTo === 'pause' ? 'pause' : returnTo); };

// „Fortsetzen“-Karte im Hauptmenü: nächste offene Mission der zuletzt gespielten Kampagne
function renderTitle() {
  refreshMissionLang(); // V3-I18N-B
  const box = $('title-continue');
  const id = lastPlayed() || 'ukraine', c = getCampaign(id);
  if (!c || !c.missions.length) { box.classList.add('hidden'); return; }
  const i = Math.max(0, nextMission(id)), m = c.missions[i], p = getProgress(id);
  const fresh = !p.completed && !lastPlayed();
  box.querySelector('.tc-over').textContent = fresh ? t('title.begin', 'Einstieg in die Kampagne') : t('title.continue', 'Weiter in der Kampagne');
  $('tc-art').innerHTML = campaignArtSVG(c);
  $('tc-title').textContent = m.title;
  $('tc-sub').textContent = `${c.title} · ${t('common.mission', 'Mission')} ${i + 1}/${c.missions.length}`;
  box.style.setProperty('--acc', c.accent);
  box.classList.remove('hidden');
  $('btn-continue').onclick = () => openBriefing(m);
}

// ================= Kampagnen (V3-MENU): Registry, zweistufige Auswahl =================
// Entwickler-/Testmodus: ?unlock=all schaltet alle Missionen aller Kampagnen frei
if (new URLSearchParams(location.search).get('unlock') === 'all') setUnlockAll(true);
let campSel = null; // gewählte Kampagne (Stufe 2: Missionsliste) oder null (Stufe 1: Kampagnenkarten)
let campMission = 0;
const esc = (s) => escapeHtml(String(s ?? ''));
const diffPips = (d) => `<span class="diff d${d}" title="${esc(t('common.difficulty', 'Schwierigkeit'))}: ${esc(DIFFICULTY[d] || '')}"><i></i><i></i><i></i><b>${esc(DIFFICULTY[d] || '')}</b></span>`;
const ficBadge = () => `<span class="badge-fic" title="${esc(t('badge.fictional.t', 'Fiktives Szenario – nach Mitte 2026 bzw. frei erfunden'))}">${esc(t('badge.fictional', 'fiktiv'))}</span>`;
const campPanel = () => document.querySelector('#screen-campaign .camp-panel');

function campHead(over, title, sub) {
  $('camp-over').textContent = over; $('camp-title').textContent = title;
  $('camp-sub').textContent = sub || ''; $('camp-sub').classList.toggle('hidden', !sub);
}
function renderCampaignGrid() {
  refreshMissionLang(); // V3-I18N-B
  campSel = null;
  campPanel().style.removeProperty('--acc');
  campHead(t('camp.over', 'Kampagnen'), t('camp.title', 'Feldzug wählen'), t('camp.sub', 'Drei Epochen, sechs Perspektiven – und eine Grundausbildung für den Einstieg.'));
  $('camp-progress').classList.add('hidden');
  $('camp-select').classList.remove('hidden'); $('camp-detail').classList.add('hidden');
  $('btn-camp-start').classList.add('hidden'); $('btn-reset-progress').classList.add('hidden');
  const list = getCampaigns();
  const def = lastPlayed() || 'ukraine';
  const card = (c) => {
    const p = getProgress(c.id), n = c.missions.length;
    const foot = n
      ? `<span class="cc-bar"><i style="width:${Math.round((p.completed / n) * 100)}%"></i></span><span class="cc-count">${icon('medal', { cls: 'ic-in' })} ${p.completed}/${n}</span>`
      : `<span class="cc-soon">${icon('hourglass', { cls: 'ic-in' })} ${esc(t('camp.soon', 'In Vorbereitung'))}</span>`;
    return `<button class="camp-card${n ? '' : ' empty'}${c.era === 'tutorial' ? ' tut' : ''}" data-camp="${esc(c.id)}"${c.id === def ? ' data-gp-default' : ''} style="--acc:${esc(c.accent)}">
      <span class="cc-art">${campaignArtSVG(c)}</span>
      <span class="cc-body">
        <span class="cc-era">${esc(ERAS[c.era]?.label || '')}${c.years ? ' · ' + esc(c.years) : ''}</span>
        <span class="cc-title">${esc(c.title)}</span>
        ${c.subtitle ? `<span class="cc-sub">${esc(c.subtitle)}</span>` : ''}
        <span class="cc-desc">${esc(c.desc)}</span>
        <span class="cc-foot">${foot}</span>
      </span></button>`;
  };
  const tut = list.filter((c) => c.era === 'tutorial'), rest = list.filter((c) => c.era !== 'tutorial');
  $('camp-grid').innerHTML = (tut.length ? `<div class="camp-tut">${tut.map(card).join('')}</div>` : '') + `<div class="camp-cards">${rest.map(card).join('')}</div>`;
  $('camp-grid').querySelectorAll('[data-camp]').forEach((b) => (b.onclick = () => openCampaign(b.dataset.camp)));
}
function openCampaign(id, idx) {
  const c = getCampaign(id);
  if (!c) { renderCampaignGrid(); show('campaign'); return; }
  campSel = c; if (c.missions.length) setLastPlayed(id);
  campMission = idx ?? Math.max(0, nextMission(id));
  renderCampaignDetail();
  show('campaign');
}
function renderCampaignDetail() {
  refreshMissionLang(); // V3-I18N-B
  const c = campSel, p = getProgress(c.id), n = c.missions.length;
  campPanel().style.setProperty('--acc', c.accent);
  campHead(`${ERAS[c.era]?.label || ''}${c.years ? ' · ' + c.years : ''}${c.faction ? ' · ' + c.faction : ''}`, c.title, c.subtitle ? `${c.subtitle} – ${c.desc}` : c.desc);
  $('camp-select').classList.add('hidden'); $('camp-detail').classList.remove('hidden');
  const pr = $('camp-progress');
  pr.classList.toggle('hidden', !n);
  if (n) { pr.querySelector('i').style.width = Math.round((p.completed / n) * 100) + '%'; pr.querySelector('span').textContent = t('camp.progress', '{a} von {b} Missionen abgeschlossen', { a: p.completed, b: n }); }
  $('btn-reset-progress').classList.toggle('hidden', !n || !p.completed);
  $('btn-camp-start').classList.toggle('hidden', !n);
  $('camp-detail').classList.toggle('empty', !n);
  if (!n) {
    $('mission-list').innerHTML = `<div class="camp-empty">${campaignArtSVG(c)}<div><h3>${esc(t('camp.soon', 'In Vorbereitung'))}</h3><p>${esc(t('camp.soon.p', 'Die Missionen dieses Feldzugs entstehen gerade. Bis dahin: Gefecht, Online-Gefecht oder eigene Karten im Editor.'))}</p></div></div>`;
    $('camp-info').classList.add('hidden');
    return;
  }
  $('camp-info').classList.remove('hidden');
  if (!isUnlocked(c.id, campMission) || campMission >= n) campMission = Math.max(0, nextMission(c.id));
  $('mission-list').innerHTML = c.missions.map((m, i) => {
    const locked = !isUnlocked(c.id, i), done = p.done[m.id];
    const st = locked ? icon('lock', { label: t('mission.locked', 'Gesperrt') }) : done ? icon('medal', { label: t('mission.done', 'Abgeschlossen'), cls: done.medal ? 'medal-' + done.medal : '' }) : icon('play', { label: t('mission.open', 'Frei') });
    return `<button class="mission-card${locked ? ' locked' : ''}${done ? ' done' : ''}${i === campMission ? ' sel' : ''}" data-i="${i}" role="listitem"${locked ? ' disabled' : ''}${i === campMission ? ' data-gp-default' : ''}>
      <span class="num">${String(i + 1).padStart(2, '0')}</span>
      <span class="mc-main"><span class="t">${esc(m.title)}${m.fictional ? ' ' + ficBadge() : ''}</span><span class="p">${esc(m.date || '')}${m.place ? ' · ' + esc(m.place) : ''}</span></span>
      ${diffPips(m.difficulty)}
      <span class="state">${st}</span></button>`;
  }).join('');
  $('mission-list').querySelectorAll('.mission-card').forEach((b) => {
    b.onclick = () => { const i = +b.dataset.i; if (i === campMission) openBriefing(c.missions[i]); else selectCampMission(i); };
  });
  selectCampMission(campMission);
}
function selectCampMission(i) {
  const c = campSel, m = c.missions[i]; if (!m) return;
  campMission = i;
  $('mission-list').querySelectorAll('.mission-card').forEach((b) => { const on = +b.dataset.i === i; b.classList.toggle('sel', on); if (on) b.dataset.gpDefault = ''; else delete b.dataset.gpDefault; });
  const p = getProgress(c.id), done = p.done[m.id];
  const wx = weatherInfo(m);
  const summary = m.summary || (m.briefing?.[0]?.t || '').replace(/<[^>]+>/g, '').slice(0, 220);
  const state = done
    ? `${icon('medal', { cls: 'ic-in' })} ${esc(t('mission.doneIn', 'Abgeschlossen in {t}', { t: fmtTime(done.time || 0) }))} · ${done.kills | 0} ${esc(t('end.stat.kills', 'Abschüsse'))}`
    : `${icon('play', { cls: 'ic-in' })} ${esc(t('mission.ready', 'Bereit zum Einsatz'))}`;
  $('camp-info-text').innerHTML = `<div class="ci-over">${esc(t('common.mission', 'Mission'))} ${String(i + 1).padStart(2, '0')} / ${String(c.missions.length).padStart(2, '0')}</div>
    <h3 class="ci-title">${esc(m.title)}${m.fictional ? ' ' + ficBadge() : ''}</h3>
    <div class="ci-meta">${m.date ? `<span>${icon('calendar', { cls: 'ic-in' })}${esc(m.date)}</span>` : ''}${m.place ? `<span>${icon('pin', { cls: 'ic-in' })}${esc(m.place)}</span>` : ''}<span>${icon(wx.ic, { cls: 'ic-in' })}${esc(wx.txt)}</span></div>
    <p class="ci-sum">${esc(summary)}</p>
    <div class="ci-row">${diffPips(m.difficulty)}<span class="ci-state${done ? ' done' : ''}">${state}</span></div>`;
  const cv = $('camp-map');
  if (m.map) drawMapSketch(cv, m.map, { start: m.camera, markers: m.markers, startLabel: t('brief.start.lbl', 'Start') });
  else { const x = cv.getContext('2d'); x.fillStyle = '#1a2026'; x.fillRect(0, 0, cv.width, cv.height); }
}
$('btn-camp-start').onclick = () => { const m = campSel?.missions[campMission]; if (m && isUnlocked(campSel.id, campMission)) openBriefing(m); };
// Zweistufige Bestätigung direkt im Knopf (Browser-Dialoge sind nicht überall verfügbar)
function armButton(b, armedText, fn) {
  const label = b.querySelector('[data-i18n]') || b;
  if (!b.dataset.armed) {
    b.dataset.armed = '1'; b.dataset.label = label.textContent; label.textContent = armedText; b.classList.add('armed');
    setTimeout(() => { if (b.dataset.armed) { delete b.dataset.armed; label.textContent = b.dataset.label; b.classList.remove('armed'); } }, 6000);
    return;
  }
  delete b.dataset.armed; label.textContent = b.dataset.label; b.classList.remove('armed');
  fn();
}
$('btn-reset-progress').onclick = (e) => armButton(e.currentTarget, t('common.confirmReset', 'Wirklich zurücksetzen? Nochmal tippen'), () => { if (campSel) { resetProgress(campSel.id); campMission = 0; renderCampaignDetail(); } });

// ================= Briefing (V3-MENU) =================
const SEASON_DE = { winter: 'Winter', autumn: 'Herbst', summer: 'Sommer', spring: 'Frühling' };
function weatherInfo(m) {
  const env = m.env || {}, w = m.weather;
  let ic = env.night ? 'moon' : (env.season || m.map?.season) === 'winter' ? 'snow' : 'sun';
  if (w && w.type && w.type !== 'clear') ic = /rain|storm|thunder/.test(w.type) ? 'rain' : /snow|blizzard/.test(w.type) ? 'snow' : /fog|mist|dust|sand/.test(w.type) ? 'fog' : 'cloud';
  let txt = '';
  try { txt = (describeSetting(m) || '').replace(/^Wetter:\s*/, ''); } catch (e) { /* ignorieren */ }
  if (!txt) txt = [env.night ? t('wx.night', 'Nacht') : env.sunElev != null && env.sunElev < 12 ? t('wx.dawn', 'Dämmerung') : t('wx.day', 'Tag'), SEASON_DE[env.season || m.map?.season] || '', (env.fogDensity || 0) > 0.0038 ? t('wx.haze', 'Dunst') : t('wx.clear', 'klare Sicht')].filter(Boolean).join(', ');
  return { ic, txt };
}
const FORCE_ICONS = [
  [/seedrohne/, 'seadrone'], [/fpv/, 'fpv'], [/lancet|kamikaze|shahed/, 'loiter'], [/drohne|orlan|uav/, 'recon'], [/boot|schiff/, 'boat'],
  [/javelin|nlaw|panzerabwehr|rpg|panzerjäger|panzerfaust|panzerschreck|bazooka|milan|tow\b/, 'at'], [/scharfsch/, 'sniper'],
  [/\bmg\b|maschinengewehr/, 'mg'], [/pionier/, 'engineer'], [/sanität/, 'medic'], [/beobachter/, 'observer'],
  [/\bsso\b|spezial|kommando|ksk|speznas|ranger/, 'special'], [/gepard|flak|schilka|pantsir/, 'aa_gun'],
  [/iris|patriot|stinger|flugabwehr|igla|nasams|s-300|s-400/, 'aa_missile'], [/radar/, 'radar_veh'],
  [/himars|mars|raketenwerfer|grad|katjuscha|nebelwerfer/, 'arty_rocket'], [/haubitze|artillerie|m777|msta|mörser|geschütz/, 'arty_tube'],
  [/bradley|marder|schützenpanzer|bmp|cv90|puma/, 'ifv'], [/leopard|panzer|t-\d|abrams|challenger|sherman|tiger|kampfwagen/, 'tank'],
  [/btr|dingo|fuchs|radpanzer|mrap|humvee|wolf|jeep|spähwagen/, 'wheeled'], [/berge/, 'recovery'], [/lkw|versorgung|transporter|truck/, 'truck'],
  [/hubschrauber|heli|\bmi-|\bka-/, 'heli'], [/flugzeug|jäger|bomber|stuka/, 'plane'],
];
const ABIL_ICONS = [[/aufkl/, 'scan'], [/himars/, 'himars'], [/marschflug|storm/, 'stormshadow'], [/\bew\b|stör|elektron/, 'ew'], [/fpv/, 'fpv'], [/lancet|kamikaze/, 'lancet'], [/salve|tornado|grad/, 'tornado'], [/artillerie|feuerschlag/, 'artillery'], [/nebel|rauch/, 'smoke'], [/luftlande|fallschirm/, 'airdrop'], [/luft|flugzeug|bomber/, 'plane']];
const pickIcon = (list, s, fb) => { const l = String(s).toLowerCase(); for (const [re, ic] of list) if (re.test(l)) return ic; return fb; };
const briefMapCache = {};
function openBriefing(m) {
  refreshMissionLang(); // V3-I18N-B
  currentMission = m;
  const fm = findMission(m);
  if (fm) setLastPlayed(fm.campaign.id);
  $('brief-over').textContent = fm ? `${t('brief.over', 'Einsatzbefehl')} · ${fm.campaign.title} · ${t('common.mission', 'Mission')} ${fm.index + 1}/${fm.campaign.missions.length}` : m.custom ? t('brief.custom', 'Einsatzbefehl · Eigene Karte') : t('brief.over', 'Einsatzbefehl');
  $('brief-title').textContent = m.title;
  const wx = weatherInfo(m);
  $('brief-place').innerHTML = [
    m.date && `<span>${icon('calendar', { cls: 'ic-in' })}${esc(m.date)}</span>`,
    m.place && `<span>${icon('pin', { cls: 'ic-in' })}${esc(m.place)}</span>`,
    `<span>${icon(wx.ic, { cls: 'ic-in' })}${esc(wx.txt)}</span>`,
    m.difficulty && diffPips(m.difficulty),
    m.fictional && ficBadge(),
  ].filter(Boolean).join('');
  $('brief-text').innerHTML = (m.briefing || []).map((b) => `<div class="rl-line"><div class="rl-who">${b.s}</div><div class="rl-msg">${b.t}</div></div>`).join('');
  $('brief-objectives').innerHTML = (m.objectivesPreview || []).map((o) => {
    const opt = /^optional:\s*/i.test(o);
    return `<li class="${opt ? 'opt' : ''}">${icon(opt ? 'obj_open' : 'obj_target', { cls: 'ic-in' })}<span>${opt ? `<em>${esc(t('brief.optional', 'Optional'))}</em> ` : ''}${opt ? o.replace(/^optional:\s*/i, '') : o}</span></li>`;
  }).join('');
  const forces = m.forces || [];
  const units = forces.filter((f) => !/^fähigkeit/i.test(deText(f))), abil = forces.filter((f) => /^fähigkeit/i.test(deText(f))); // V3-I18N-B: Typ-/Icon-Erkennung am deutschen Original
  $('brief-forces').innerHTML = `<div class="force-list">${units.map((f) => `<span class="force">${icon(pickIcon(FORCE_ICONS, deText(f), 'inf'), { cls: 'ic-in' })}<span>${f}</span></span>`).join('')}</div>` +
    (abil.length ? `<div class="force-sub">${esc(t('brief.abilities', 'Fähigkeiten'))}</div><div class="force-list abil">${abil.map((f) => { const s = f.replace(/^(fähigkeiten?|abilit(y|ies)):\s*/i, ''), sd = deText(f).replace(/^fähigkeiten?:\s*/i, ''); return `<span class="force">${icon(pickIcon(ABIL_ICONS, sd, 'star'), { cls: 'ic-in' })}<span>${s}</span></span>`; }).join('')}</div>` : '');
  renderBriefLevel(); // V3-X
  show('briefing');
  // Lagekarte: sofort als Skizze, dann (falls möglich) als gerendertes Gelände mit denselben Markierungen
  const c = $('brief-map'), ctx = c.getContext('2d');
  const marks = { start: m.camera, markers: m.markers, startLabel: t('brief.start.lbl', 'Start') };
  if (m.map) drawMapSketch(c, m.map, marks); else { ctx.fillStyle = '#111'; ctx.fillRect(0, 0, c.width, c.height); }
  if (!m.map) return;
  setTimeout(() => {
    try { if (!briefMapCache[m.id]) briefMapCache[m.id] = new Terrain(m.map, 'low').minimapImage(360); } catch (e) { console.warn('[briefing] Lagekarte', e); return; }
    if (currentMission !== m) return;
    ctx.drawImage(briefMapCache[m.id], 0, 0, c.width, c.height);
    drawMapSketch(c, m.map, { ...marks, overlayOnly: true });
  }, 320); // erst nach dem Einblenden – der Geländeaufbau blockiert kurz den Hauptthread
}
$('btn-start-mission').onclick = () => startMission(currentMission);
// V3-X: Schwierigkeitsgrad je Kampagnenfortschritt (Standard aus den Einstellungen)
if (!LEVELS[settings.level]) settings.level = 'normal';
const campLevel = (m) => { const fm = findMission(m); return fm ? normLevel(getCampaignLevel(fm.campaign.id, settings.level)) : settings.level; };
function renderBriefLevel() {
  const lv = campLevel(currentMission);
  $('brief-level').querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.v === lv));
}
$('brief-level').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-v]'); if (!b) return;
  const fm = findMission(currentMission);
  if (fm) setCampaignLevel(fm.campaign.id, b.dataset.v); else settings.level = b.dataset.v;
  renderBriefLevel();
});

async function startMission(m, opts = {}) {
  currentMission = m;
  currentSkirmish = null;
  hideScreens();
  const fm = findMission(m);
  game.difficulty = opts.save ? normLevel(opts.save.diff) : (m.custom ? 'normal' : campLevel(m)); // V3-X
  const ctx = fm ? { kind: 'mission', cid: fm.campaign.id, idx: fm.index, mid: m.id } : null;
  await loadWithSpinner(`Lade „${m.title}" …`, () => {
    game.camera.orbit = false;
    rec.runLoad(ctx, opts.save?.seed, () => game.load(m)); // V3-X: Seed-RNG + Aufzeichnung (Speichern/Laden)
  });
  inMission = true;
  hud.show(true);
  game.stats.start = game.time;
  updatePauseInfo();
  if (!opts.save && ctx) saveUI.save('auto', { silent: true }); // V3-X: Autosave beim Missionsstart
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
  renderSkExtras(); // V3-MENU
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
// V3-MENU: Wetter, Tageszeit (V3-W) und Satellitennetz-Ausfälle (V3-SL) – im letzten Setup gespeichert und explizit an normalizeSetup übergeben
$('skirmish-weather').innerHTML = Object.entries(SK_WEATHER).map(([k, v]) => opt(k, v)).join('');
$('skirmish-daytime').innerHTML = Object.entries(SK_DAYTIME).map(([k, v]) => opt(k, v)).join('');
if (!SK_WEATHER[skSetup.weather]) skSetup.weather = 'clear';
if (!SK_DAYTIME[skSetup.daytime]) skSetup.daytime = 'day';
if (typeof skSetup.satOutage !== 'boolean') skSetup.satOutage = true;
function renderSkExtras() { $('skirmish-weather').value = skSetup.weather; $('skirmish-daytime').value = skSetup.daytime; if ($('skirmish-satoutage')) $('skirmish-satoutage').checked = skSetup.satOutage; }
$('skirmish-weather').addEventListener('change', () => { skSetup.weather = $('skirmish-weather').value; skChanged(); });
$('skirmish-daytime').addEventListener('change', () => { skSetup.daytime = $('skirmish-daytime').value; skChanged(); });
$('skirmish-satoutage')?.addEventListener('change', () => { skSetup.satOutage = $('skirmish-satoutage').checked; skChanged(); });
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

async function startSkirmishGame(setup, opts = {}) {
  currentSkirmish = setup;
  hideScreens();
  let m = null;
  game.difficulty = normLevel(setup.difficulty); // V3-X: Gefecht – KI-Stufe = Schwierigkeitsgrad
  const { customMap, ...plain } = setup;
  const ctx = { kind: 'skirmish', setup: JSON.parse(JSON.stringify(plain)) };
  await loadWithSpinner('Lade Gefechtskarte …', () => {
    game.camera.orbit = false;
    m = rec.runLoad(ctx, opts.save?.seed, () => startSkirmish(game, setup)); // V3-X
  });
  if (!m) { show('skirmish'); return null; }
  currentMission = m;
  inMission = true;
  hud.show(true);
  game.stats.start = game.time;
  updatePauseInfo();
  if (!opts.save) saveUI.save('auto', { silent: true }); // V3-X: Autosave beim Gefechtsstart
  return m;
}
// ================= Online-Gefecht (MP-T5) =================
const online = createOnline({
  game, show, hideScreens,
  startGame: (S) => startOnlineGame(S),
  toMenu: async () => { inMission = false; game.paused = false; hud.show(false); await loadDemo(); show('title'); },
  simTick: (dt) => simTick(dt),
});
// V3-MENU: Lobby – Wetter, Tageszeit, Satellitennetz-Ausfälle als Lobby-Einstellungen (Settings werden an Clients übertragen;
// setupFromStart in js/net/session.js muss st.weather/st.daytime/st.satOutage noch an normalizeSetup weiterreichen – siehe Bericht)
$('ls-weather').innerHTML = Object.entries(SK_WEATHER).map(([k, v]) => opt(k, v)).join('');
$('ls-daytime').innerHTML = Object.entries(SK_DAYTIME).map(([k, v]) => opt(k, v)).join('');
$('ls-weather').addEventListener('change', () => online.setSetting({ weather: $('ls-weather').value }));
$('ls-daytime').addEventListener('change', () => online.setSetting({ daytime: $('ls-daytime').value }));
$('ls-satoutage').addEventListener('change', () => online.setSetting({ satOutage: $('ls-satoutage').checked }));
{
  const renderLobby0 = online.renderLobby.bind(online);
  online.renderLobby = (...a) => {
    const r = renderLobby0(...a);
    const st = online.lobby?.state?.settings;
    if (st) {
      const host = !!online.lobby.isHost;
      $('ls-weather').value = SK_WEATHER[st.weather] ? st.weather : 'clear';
      $('ls-daytime').value = SK_DAYTIME[st.daytime] ? st.daytime : 'day';
      $('ls-satoutage').checked = st.satOutage !== false;
      for (const id of ['ls-weather', 'ls-daytime', 'ls-satoutage']) $(id).disabled = !host;
    }
    return r;
  };
}
async function startOnlineGame(S) {
  currentSkirmish = null;
  hideScreens();
  game.difficulty = 'normal'; // V3-X: Online ohne Schwierigkeitsmodifikatoren
  let m = null;
  await loadWithSpinner(`Lade Online-Gefecht (${S.mode}v${S.mode}) …`, () => {
    game.camera.orbit = false;
    // V3-RS: Host zeichnet über den Seed-Recorder auf (Wiederholung mit den Kommandos aller Spieler); Clients laden normal
    const { customMap, ...plain } = S;
    const load = () => { const mm = createSkirmish(S); game.setupPlayers(mm.players); game.load(mm); return mm; };
    m = online.session?.isHost ? rec.runLoad({ kind: 'online', setup: JSON.parse(JSON.stringify(plain)) }, undefined, load) : load();
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
  $('btn-surrender').classList.toggle('hidden', on); // V3-MENU
  $('btn-pause-save').classList.toggle('hidden', on); $('btn-pause-load').classList.toggle('hidden', on); // V3-X
  const lbl = (id, s) => { const e = $(id).querySelector('.lbl'); if (e) e.textContent = s; else $(id).textContent = s; };
  lbl('btn-quit', on ? 'Online-Spiel verlassen' : sk ? 'Zum Gefechtsmenü' : currentMission?.custom ? (currentMission.fromEditor ? 'Zurück zum Editor' : 'Zu eigenen Karten') : 'Zur Kampagne');
  lbl('btn-resume', on ? 'Zurück zum Spiel' : 'Weiter');
  lbl('btn-restart', sk ? 'Gefecht neu starten' : 'Mission neu starten');
  $('pause-over').textContent = game.mission?.title ? `${t('pause.over', 'Einsatz unterbrochen')} · ${game.mission.title}` : t('pause.over', 'Einsatz unterbrochen');
  if (sk && on) { const S = sk.setup; el.innerHTML = `${game.mission.title}<br>Online · Seed <b>${S.seed}</b> · ${ROLES[game.localPlayer?.role]?.name || ''} · ${VICTORY[S.victory]}<br>Das Spiel läuft im Hintergrund weiter.`; return; }
  if (sk) { const S = sk.setup; el.innerHTML = `${game.mission.title}<br>Seed <b>${S.seed}</b> · ${ROLES[S.role].name} · KI ${DIFFICULTIES[S.difficulty]} · Verstärkung alle ${Math.round(S.reinforce / 60 * 10) / 10} min · ${VICTORY[S.victory]}`; }
}
function showSkirmishEnd(won, text) {
  const sk = game.mission.skirmish;
  const draw = sk.result && sk.result.winner === null;
  setEndBanner(draw ? 'draw' : won ? 'win' : 'loss', game.mission.title, online.inGame ? t('end.over.online', 'Online-Gefecht') : t('end.over.sk', 'Gefechtsbericht'));
  $('end-text').innerHTML = `<p>${text}</p>`;
  const rows = [];
  for (const team of [game.localSide, game.localSide === 'UA' ? 'RU' : 'UA']) {
    const ps = game.playersOfTeam(team);
    const sum = (k) => ps.reduce((s, p) => s + (p.stats[k] || 0), 0);
    rows.push(`<tr class="team"><td style="color:${TEAM_COLOR[team]}">${TEAM_NAME[team]} – ${sk.scores[team]} Punkte</td><td>${sum('kills')}</td><td>${sum('lost')}</td><td>${sum('captured')}</td><td>${sum('reinf')}</td></tr>`);
    for (const p of ps) rows.push(`<tr class="${p.id === game.localPlayerId ? 'me' : ''}"><td><span class="dot" style="background:${p.color}"></span>${ROLES[p.role] ? icon(ROLES[p.role].iconKey, { cls: 'ic-in', label: ROLES[p.role].name }) : ''} ${p.name}${p.defeated ? ' ' + icon('close', { cls: 'ic-in', label: 'Ausgeschieden' }) : ''}</td><td>${p.stats.kills}</td><td>${p.stats.lost}</td><td>${p.stats.captured || 0}</td><td>${p.stats.reinf || 0}</td></tr>`);
  }
  $('end-stats').innerHTML = statTiles([['attack', t('end.stat.kills', 'Abschüsse'), game.stats.kills], ['close', t('end.stat.lost', 'Verluste'), game.stats.lost], ['clock', t('end.stat.duration', 'Gefechtsdauer'), fmtTime(game.time)], ['ammo', t('end.stat.shots', 'Schüsse'), game.stats.shots]]) +
    `<div class="end-seed muted">Seed ${sk.setup.seed}</div><table class="sk-end-table"><tr><th>Spieler</th><th>Abschüsse</th><th>Verluste</th><th>Erobert</th><th>Verstärkung</th></tr>${rows.join('')}</table>`;
  const next = $('btn-end-next');
  $('btn-end-retry').classList.toggle('hidden', online.inGame);
  $('btn-end-menu').classList.toggle('hidden', online.inGame);
  if (online.inGame) {
    next.textContent = 'Zum Hauptmenü';
    next.onclick = () => online.leaveGame();
    show('end');
    return;
  }
  next.textContent = 'Gefechtsmenü';
  next.onclick = async () => { await loadDemo(); openSkirmish(); };
  { const fresh = won && !draw ? awards.onWin({ kind: 'skirmish', mode: sk.setup.mode, level: normLevel(sk.setup.difficulty) }) : (awards.flush(), []); const mb = $('end-medals'); if (fresh.length) { mb.innerHTML = awardsOnlyHTML(fresh); mb.classList.remove('hidden'); } } // V3-X
  $('btn-end-retry').textContent = 'Revanche';
  $('btn-end-retry').onclick = () => { game.paused = false; startSkirmishGame(currentSkirmish); };
  show('end');
}

// Pause
hud.onTogglePause = () => {
  if (game.replayDriver) { replayUI.togglePause(); return; } // V3-RS: Wiedergabe – Esc pausiert
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
// V3-X: Spielstände
$('btn-pause-save').onclick = () => saveUI.open('save', 'pause');
$('btn-pause-load').onclick = () => saveUI.open('load', 'pause');
$('btn-title-load').onclick = () => saveUI.open('load', 'title');
function uiToast(text) {
  let el = $('ui-toast');
  if (!el) { el = document.createElement('div'); el.id = 'ui-toast'; el.className = 'ui-toast hidden'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = text; el.classList.remove('hidden');
  clearTimeout(uiToast.t); uiToast.t = setTimeout(() => el.classList.add('hidden'), 2600);
}
const saveUI = createSaveUI({
  game, rec, show, hideScreens,
  current: () => current,
  isOnline: () => !!online.inGame || !!game.net,
  inMission: () => inMission && !game.ended && !game.demo,
  toast: uiToast,
  saveMeta: () => {
    const sk = game.mission?.skirmish;
    if (sk) return { title: game.mission.title || 'Gefecht', over: `Gefecht ${sk.setup.mode}v${sk.setup.mode} · Seed ${sk.setup.seed}` };
    const fm = findMission(currentMission);
    return { title: currentMission?.title || 'Einsatz', over: fm ? `${fm.campaign.title} · ${t('common.mission', 'Mission')} ${fm.index + 1}/${fm.campaign.missions.length}` : '' };
  },
  startFromSave: async (data) => {
    const c = data.ctx;
    if (c.kind === 'mission') {
      const camp = getCampaign(c.cid);
      let m = camp?.missions[c.idx];
      if (!m || (c.mid && m.id !== c.mid)) { const f = findMission(c.mid); m = f ? f.campaign.missions[f.index] : null; }
      if (!m) return false;
      if (current === 'pause' || game.paused) game.paused = false;
      await startMission(m, { save: data });
      return game.active && !game.demo;
    }
    if (c.kind === 'skirmish') {
      const r = await startSkirmishGame(withCustomMap({ ...c.setup }), { save: data });
      return !!r;
    }
    return false;
  },
  onLoaded: (rep) => {
    hud.sayQueue = []; hud.subEl?.classList.add('hidden');
    voice.clear();
    awards.unlock('saver');
    game.paused = false; hideScreens(); updatePauseInfo();
    uiToast(`Spielstand geladen (${fmtTime(game.time)})`);
  },
});
// ================= V3-RS: Wiederholungen =================
function resolveMissionCtx(c) {
  const camp = getCampaign(c.cid);
  let m = camp?.missions[c.idx];
  if (!m || (c.mid && m.id !== c.mid)) { const f = findMission(c.mid); m = f ? f.campaign.missions[f.index] : null; }
  return m || null;
}
async function loadForReplay(data) {
  const s = data.save, c = s.ctx;
  currentSkirmish = null;
  hideScreens();
  game.paused = false;
  game.difficulty = normLevel(s.diff);
  let m = null;
  await loadWithSpinner(t('rs.loading', 'Wiederholung wird geladen …'), () => {
    game.camera.orbit = false;
    if (c.kind === 'mission') { m = resolveMissionCtx(c); if (m) rec.runLoad(c, s.seed, () => game.load(m)); }
    else if (c.kind === 'skirmish') m = rec.runLoad(c, s.seed, () => startSkirmish(game, withCustomMap({ ...c.setup })));
    else if (c.kind === 'online') m = rec.runLoad(c, s.seed, () => { const mm = createSkirmish(c.setup); game.setupPlayers(mm.players); game.load(mm); return mm; });
    else if (c.kind === 'coop' && window.__coop) m = window.__coop.loadForReplay(c, s.seed, resolveMissionCtx(c));
  });
  if (!m || !game.active) return false;
  currentMission = m;
  inMission = true;
  hud.show(true);
  hud.sayQueue = []; hud.subEl?.classList.add('hidden');
  game.stats.start = game.time;
  return true;
}
const replayUI = createReplayUI({
  game, rec, show, hideScreens, toast: uiToast,
  loadForReplay,
  volume: () => settings.volume,
  lobby: () => online.lobby,
  setLoading: (text) => { if (text) { $('loading-text').textContent = text; $('loading').classList.remove('hidden'); } else $('loading').classList.add('hidden'); },
  exitWatch: async (to) => { inMission = false; game.paused = false; hud.show(false); await loadDemo(); show(to || 'replays'); },
  metaFor: (won) => {
    const sk = game.mission?.skirmish, draw = sk?.result && sk.result.winner === null;
    const result = draw ? 'draw' : won ? 'win' : 'loss';
    if (game.coop && online.inGame) { const fm = findMission(currentMission); return { title: currentMission?.title || 'Koop', over: `${t('rs.coop', 'Koop (online)')}${fm ? ' · ' + fm.campaign.title : ''}`, result }; }
    if (sk) return { title: game.mission.title || 'Gefecht', over: online.inGame ? `${t('end.over.online', 'Online-Gefecht')} ${sk.setup.mode}v${sk.setup.mode}` : `Gefecht ${sk.setup.mode}v${sk.setup.mode} · Seed ${sk.setup.seed}`, result };
    const fm = findMission(currentMission);
    return { title: currentMission?.title || 'Einsatz', over: fm ? `${fm.campaign.title} · ${t('common.mission', 'Mission')} ${fm.index + 1}/${fm.campaign.missions.length}` : '', result };
  },
});
$('btn-awards').onclick = () => { awards.checkStatic(); renderAwardsPage($('awards-body')); show('awards'); };
$('btn-awards-back').onclick = () => show('title');
$('btn-restart').onclick = () => { game.paused = false; if (currentSkirmish) startSkirmishGame(currentSkirmish); else startMission(currentMission); };
$('btn-quit').onclick = async () => {
  if (online.inGame) { online.leaveGame(); return; }
  game.paused = false;
  const m = currentMission;
  if (!currentSkirmish && m?.custom) { if (m.fromEditor) backToEditor(m); else { await loadDemo(); openMods(); } return; }
  const sk = !!currentSkirmish; await loadDemo(); if (sk) openSkirmish(); else { const fm = findMission(m); if (fm) openCampaign(fm.campaign.id, fm.index); else { renderCampaignGrid(); show('campaign'); } }
};
// V3-MENU: Hilfe aus der Pause, Aufgeben (mit Bestätigung) → Endbildschirm als Niederlage
$('btn-pause-help').onclick = () => { returnTo = 'pause'; helpFrom = null; show('help'); };
$('btn-surrender').onclick = (e) => armButton(e.currentTarget, t('pause.surrender.confirm', 'Wirklich aufgeben?'), () => {
  if (online.inGame) { online.leaveGame(); return; }
  if (!inMission || game.ended) return;
  game.paused = false; game.ended = true;
  game.emit('end', false, t('end.surrendered', 'Einsatz abgebrochen – die Einheiten ziehen sich zurück.'));
});

// Missionsende (V3-MENU: Banner, Statistik-Kacheln, Medaillenleiste #end-medals für das spätere Medaillen-System)
function setEndBanner(kind, title, over) {
  $('screen-end').dataset.result = kind;
  $('end-over').textContent = over || t('end.over', 'Einsatzbericht');
  $('end-word').textContent = kind === 'win' ? t('end.victory', 'Sieg') : kind === 'draw' ? t('end.draw', 'Unentschieden') : t('end.defeat', 'Niederlage');
  $('end-title').textContent = title || '';
  $('end-title').style.color = '';
}
function statTiles(items) {
  return `<div class="stat-tiles">${items.map(([ic, label, val]) => `<div class="stat">${icon(ic)}<b>${val ?? 0}</b><span>${label}</span></div>`).join('')}</div>`;
}
// Medaillenleiste bei jedem Laden leeren (das Medaillen-System füllt #end-medals nach 'end' und entfernt .hidden)
game.on('loaded', () => { const el = $('end-medals'); if (el) { el.innerHTML = ''; el.classList.add('hidden'); } });
$('btn-end-menu').onclick = async () => { if (online.inGame) { online.leaveGame(); return; } game.paused = false; await loadDemo(); show('title'); };
game.on('end', (won, text) => {
  if (!inMission || game.replayDriver) return; // V3-RS: Ende während einer Wiedergabe zählt nicht
  game.paused = true;
  if (online.inGame) online.toggleChat(false);
  if (game.mission?.skirmish) { showSkirmishEnd(won, text); return; }
  if (game.mission?.custom) { showCustomEnd(won, text); return; }
  $('btn-end-retry').classList.remove('hidden');
  $('btn-end-menu').classList.remove('hidden');
  $('btn-end-retry').textContent = 'Erneut versuchen';
  const m = currentMission;
  const fm = findMission(m), camp = fm?.campaign, idx = fm ? fm.index : -1; // V3-MENU: Kampagnen-Registry
  setEndBanner(won ? 'win' : 'loss', `${won ? t('end.won', 'Mission erfüllt') : t('end.lost', 'Mission gescheitert')} – ${m.title}`, camp ? `${camp.title} · ${t('common.mission', 'Mission')} ${idx + 1}/${camp.missions.length}` : '');
  $('end-text').innerHTML = `<p>${text}</p>${won && m.victory ? `<p class="victory-text">${m.victory}</p>` : ''}`;
  const tm = game.time;
  $('end-stats').innerHTML = statTiles([['attack', t('end.stat.kills', 'Abschüsse'), game.stats.kills], ['close', t('end.stat.lost', 'Verluste'), game.stats.lost], ['clock', t('end.stat.time', 'Einsatzzeit'), fmtTime(tm)], ['ammo', t('end.stat.shots', 'Schüsse'), game.stats.shots], ...(game.stats.intercepts ? [['obj_protect', t('end.stat.intercepts', 'Abgefangen'), game.stats.intercepts]] : [])]);
  // V3-X: Medaille (Bronze/Silber/Gold) und Erfolge
  const lvl = normLevel(game.difficulty);
  const md = won ? evaluateMedal(game, m, lvl) : null;
  const fresh = won ? awards.onWin({ kind: 'mission', medal: md.medal, level: lvl }) : (awards.flush(), []);
  const mb = $('end-medals');
  if (md) { mb.innerHTML = medalBarHTML(md, fresh); mb.classList.remove('hidden'); mb.dataset.medal = md.medal; }
  if (won && camp) completeMission(camp.id, idx, { time: tm, kills: game.stats.kills, lost: game.stats.lost, shots: game.stats.shots, medal: md?.medal, level: lvl });
  if (won && camp) { awards.checkStatic(); const more = awards.fresh.filter((a) => !fresh.includes(a)); if (more.length) mb.innerHTML = medalBarHTML(md, [...fresh, ...more]); }
  const next = $('btn-end-next');
  const hasNext = camp && idx + 1 < camp.missions.length;
  if (won) {
    next.textContent = hasNext ? 'Nächste Mission' : 'Zur Kampagne';
    next.onclick = async () => { await loadDemo(); if (hasNext) openBriefing(camp.missions[idx + 1]); else if (camp) openCampaign(camp.id, idx); else show('title'); };
  } else {
    next.textContent = 'Zur Kampagne';
    next.onclick = async () => { await loadDemo(); if (camp) openCampaign(camp.id, idx); else { renderCampaignGrid(); show('campaign'); } };
  }
  $('btn-end-retry').onclick = () => { game.paused = false; startMission(m); };
  show('end');
});

// ================= V3-E: Karteneditor, Mods, eigene Karten =================
function showCustomEnd(won, text) {
  const m = game.mission;
  $('btn-end-retry').classList.remove('hidden');
  $('btn-end-menu').classList.remove('hidden');
  $('btn-end-retry').textContent = 'Erneut spielen';
  setEndBanner(won ? 'win' : 'loss', `${won ? t('end.won', 'Mission erfüllt') : t('end.lost', 'Mission gescheitert')} – ${m.title}`, t('end.over.custom', 'Einsatzbericht · Eigene Karte'));
  $('end-text').innerHTML = `<p>${escapeHtml(text)}</p>`;
  $('end-stats').innerHTML = statTiles([['attack', t('end.stat.kills', 'Abschüsse'), game.stats.kills], ['close', t('end.stat.lost', 'Verluste'), game.stats.lost], ['clock', t('end.stat.time', 'Einsatzzeit'), fmtTime(game.time)], ['ammo', t('end.stat.shots', 'Schüsse'), game.stats.shots]]);
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

// Einstellungen (V3-MENU: Tabs Grafik/Audio/Steuerung/Spiel, Schalter, Werteanzeige an Reglern)
function ensureMusicUI() {
  if ($('set-music')?.dataset.bound) return;
  if (!$('set-music')) {
    const host = $('set-volume').closest('label'); if (!host) return;
    host.insertAdjacentHTML('afterend', '<label class="set-row"><span class="set-l"><b>Musik</b></span><input id="set-music" type="checkbox" class="switch"></label><label class="set-row"><span class="set-l"><b>Musiklautstärke</b></span><span class="range"><input id="set-musicvol" type="range" min="0" max="1" step="0.05"><output for="set-musicvol"></output></span></label>');
  }
  $('set-music').dataset.bound = '1';
  $('set-music').addEventListener('input', () => { settings.music = $('set-music').checked; saveSettings(); music.setEnabled(settings.music); });
  $('set-musicvol').addEventListener('input', () => { settings.musicVolume = +$('set-musicvol').value; saveSettings(); music.setVolume(settings.musicVolume); });
}
let setTab = 'gfx';
function selectSetTab(tab) {
  setTab = tab;
  $('set-tabs').querySelectorAll('[data-tab]').forEach((b) => { const on = b.dataset.tab === tab; b.classList.toggle('active', on); b.setAttribute('aria-selected', String(on)); });
  document.querySelectorAll('#screen-settings .tab-pane').forEach((p) => p.classList.toggle('hidden', p.dataset.pane !== tab));
}
$('set-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) selectSetTab(b.dataset.tab); });
function syncSetOutputs() {
  document.querySelectorAll('#screen-settings output[for]').forEach((o) => {
    const inp = $(o.getAttribute('for')); if (!inp) return;
    const pct = Math.round(((+inp.value - (+inp.min || 0)) / ((+inp.max || 1) - (+inp.min || 0))) * 100);
    o.textContent = Math.round(+inp.value * 100) + ' %'; inp.style.setProperty('--p', pct + '%');
  });
}
$('screen-settings').addEventListener('input', syncSetOutputs);
if (typeof settings.reduceMotion !== 'boolean') settings.reduceMotion = false;
document.body.classList.toggle('reduce-motion', settings.reduceMotion);
$('set-reducemotion').addEventListener('input', () => { settings.reduceMotion = $('set-reducemotion').checked; saveSettings(); document.body.classList.toggle('reduce-motion', settings.reduceMotion); });
// Sprache (V3-I18N-A): Deutsch/English, sofort wirksam; Browsersprache beim ersten Start (js/i18n.js initLang)
function renderLang() { $('set-lang').querySelectorAll('button').forEach((b) => { b.classList.toggle('active', b.dataset.v === getLang()); b.disabled = !isLangAvailable(b.dataset.v); }); }
$('set-lang').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b && !b.disabled && setLang(b.dataset.v)) { renderLang(); renderSpeechSettings(); } });
onLangChange(() => { try { if (current === 'title') renderTitle(); else if (current === 'campaign') { const c = $('screen-campaign'); const sel = c.querySelector('.back'); /* Listen werden beim nächsten Öffnen neu gebaut; DOM-Übersetzer deckt sichtbare Texte ab */ void sel; } } catch (e) { /* ignorieren */ } });
$('btn-reset-all').onclick = (e) => armButton(e.currentTarget, t('common.confirmReset', 'Wirklich zurücksetzen? Nochmal tippen'), () => { resetProgress(); renderTitle(); });
$('btn-set-help').onclick = () => { helpFrom = 'settings'; show('help'); };
// V3-X: Sprachfunk und Standard-Schwierigkeitsgrad
if (typeof settings.speechVolume !== 'number') settings.speechVolume = 0.9;
if (typeof settings.speechRate !== 'number') settings.speechRate = 1.05;
$('set-speech').addEventListener('input', () => { voice.setEnabled($('set-speech').checked); saveSettings(); });
$('set-speechvol').addEventListener('input', () => { settings.speechVolume = +$('set-speechvol').value; saveSettings(); });
$('set-speechrate').addEventListener('input', () => { settings.speechRate = +$('set-speechrate').value; saveSettings(); });
$('set-level').addEventListener('click', (e) => { const b = e.target.closest('button[data-v]'); if (!b) return; settings.level = b.dataset.v; saveSettings(); renderSetLevel(); });
function renderSetLevel() { $('set-level').querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.v === settings.level)); }
function renderSpeechSettings() {
  $('set-speech').checked = voice.enabled; $('set-speech').disabled = !voice.available;
  $('set-speechvol').value = settings.speechVolume; $('set-speechrate').value = settings.speechRate;
  $('set-speechvol').disabled = $('set-speechrate').disabled = !voice.available;
  $('set-speech-d').textContent = !voice.available ? 'In dieser Umgebung nicht verfügbar' : voice.hasVoice ? 'Funksprüche vorlesen (Sprachausgabe des Browsers)' : 'Keine passende Stimme gefunden – Browser-Standardstimme';
}
function openSettings() {
  renderSetLevel(); renderSpeechSettings(); // V3-X
  ensureMusicUI(); $('set-music').checked = settings.music; $('set-musicvol').value = settings.musicVolume;
  $('set-reducemotion').checked = !!settings.reduceMotion; renderLang();
  $('set-quality').value = settings.quality;
  $('set-upscale').value = settings.upscale;
  $('set-targetfps').value = String(settings.targetFps);
  $('set-sharpness').value = settings.sharpness;
  $('set-bloom').checked = settings.bloom;
  $('set-shadows').checked = settings.shadows;
  $('set-fps').checked = settings.showFps;
  $('set-volume').value = settings.volume;
  syncSetOutputs(); selectSetTab(setTab);
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
  voice.update(dt); // V3-X: Sprachfunk
  if (inMission) saveUI.tick(); // V3-X: Autosave alle 5 min Spielzeit
  if (!rec.replaying) gr.render(dt); // V3-X: beim Vorspulen eines Spielstands nicht rendern
  requestAnimationFrame(frame);
}

// Start
(async () => {
  applyI18n(document); // V3-MENU: data-i18n-Texte (vorerst Deutsch)
  show('title');
  await loadDemo();
  requestAnimationFrame(frame);
  // Debug-Zugriff
  window.__game = game;
  window.__gamepad = gamepad;
  window.__music = music;
  window.__start = (i) => startMission(CAMPAIGN[i]);
  window.__startMission = (campaignId, i = 0) => { const m = getCampaign(campaignId)?.missions[i]; if (!m) { console.warn('[Kampagne] Mission nicht gefunden:', campaignId, i); return null; } return startMission(m); }; // V3-MENU
  window.__campaigns = { getCampaigns, getCampaign, getProgress, openCampaign, openBriefing };
  window.__startSkirmish = (setup = {}) => startSkirmishGame({ ...skSetup, ...setup });
  window.__openSkirmish = openSkirmish;
  window.__online = online;
  window.__editor = editor;
  window.__modsUI = modsUI;
  window.__openMods = openMods;
  window.__saves = { rec, ui: saveUI, readSave, awards, voice, losTool, LEVELS }; // V3-X
  window.__replay = replayUI; // V3-RS
})();

// Offline-Fähigkeit (PWA)
if (!window.__ARTIFACT && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
// App im Hintergrund → Pause
document.addEventListener('visibilitychange', () => { if (document.hidden && inMission && !game.paused && !game.ended && !online.inGame) hud.togglePause(); });
