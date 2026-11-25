// Medaillen & Erfolge (V3-X)
//
// Medaille je Mission (generisch aus game.stats und den Zielen, überschreibbar über mission.medals):
//   Bronze: Sieg · Silber: Sieg + (alle Nebenziele ODER geringe Verluste)
//   Gold:   Sieg + alle Nebenziele + Verlustgrenze + Zeitlimit + Schwierigkeitsgrad ≥ Normal
//   mission.medals = { lost: maxVerluste, time: Sekunden, silver: (g, info) => bool, gold: (g, info) => bool }
//   Standard: Verlustgrenze = 25 % aller eigenen Einheiten (mind. 1), Zeitlimit = mission.parTime ?? 20 min.
// Erfolge (~26) mit SVG-Icons (icons.js: aw_*), Zähler und Freischaltungen in localStorage 'steppensturm.awards.v1'.
//   const aw = new AwardTracker(game, { getContext }); aw.onWin(info) …; renderAwardsPage(el); AWARDS (Liste)
import { icon } from './icons.js';
import { levelOf } from './difficulty.js';
import { getCampaign, getProgress } from '../missions/campaigns.js';

const KEY = 'steppensturm.awards.v1';
export const MEDAL_NAMES = { bronze: 'Bronze', silver: 'Silber', gold: 'Gold' };
const MR = { bronze: 1, silver: 2, gold: 3 };
const fmtMin = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function evaluateMedal(g, mission, level = 'normal') {
  const md = mission?.medals || {};
  const L = levelOf(level);
  const lost = g.stats.lost | 0;
  const alive = g.playerUnits ? g.playerUnits().length : 0;
  const total = Math.max(1, alive + lost);
  const lostMax = md.lost ?? Math.max(1, Math.round(total * 0.25));
  const par = md.time ?? mission?.parTime ?? 1200;
  const time = g.time - (g.stats.start || 0);
  const opt = g.objectives.filter((o) => o.optional);
  const optDone = opt.filter((o) => o.state === 'done').length;
  const allOpt = optDone === opt.length;
  const lowLoss = lost <= lostMax;
  const inTime = time <= par;
  const info = { lost, lostMax, total, par, time, opt: opt.length, optDone, allOpt, lowLoss, inTime, level: L.id, rank: L.rank };
  let silver = typeof md.silver === 'function' ? !!md.silver(g, info) : allOpt || lowLoss;
  let gold = typeof md.gold === 'function' ? !!md.gold(g, info) && L.rank >= 1 : allOpt && lowLoss && inTime && L.rank >= 1;
  if (gold) silver = true;
  const medal = gold ? 'gold' : silver ? 'silver' : 'bronze';
  const criteria = [
    { id: 'win', label: 'Mission erfüllt', ok: true },
    { id: 'opt', label: opt.length ? `Nebenziele ${optDone}/${opt.length}` : 'Keine Nebenziele', ok: allOpt },
    { id: 'lost', label: `Verluste ${lost} (Grenze ${lostMax})`, ok: lowLoss },
    { id: 'time', label: `Zeit ${fmtMin(time)} (Limit ${fmtMin(par)})`, ok: inTime },
    { id: 'level', label: `Schwierigkeit ${L.name}${L.rank < 1 ? ' – Gold ab Normal' : ''}`, ok: L.rank >= 1 },
  ];
  return { medal, info, criteria };
}

export function medalBarHTML(res, newAwards = []) {
  const slots = ['bronze', 'silver', 'gold'].map((m) => `<div class="medal-slot ${MR[m] <= MR[res.medal] ? 'got' : ''} m-${m}" title="${MEDAL_NAMES[m]}">${icon('medal', { cls: 'medal-' + m })}<span>${MEDAL_NAMES[m]}</span></div>`).join('');
  const crit = res.criteria.map((c) => `<li class="${c.ok ? 'ok' : 'no'}">${icon(c.ok ? 'check' : 'close', { cls: 'ic-in' })}${c.label}</li>`).join('');
  const aw = newAwards.length ? `<div class="medal-new"><b>Neue Auszeichnungen</b>${newAwards.map((a) => `<span class="aw-chip">${icon(a.icon, { cls: 'ic-in' })}${a.title}</span>`).join('')}</div>` : '';
  return `<div class="medal-row">${slots}</div><ul class="medal-crit">${crit}</ul>${aw}`;
}
export function awardsOnlyHTML(newAwards) {
  return newAwards.length ? `<div class="medal-new"><b>Neue Auszeichnungen</b>${newAwards.map((a) => `<span class="aw-chip">${icon(a.icon, { cls: 'ic-in' })}${a.title}</span>`).join('')}</div>` : '';
}

// ---------------- Erfolge ----------------
const campDone = (id) => { const c = getCampaign(id); if (!c || !c.missions.length) return false; const p = getProgress(id); return p.completed >= p.total; };
export const AWARDS = [
  { id: 'first_win', title: 'Feuertaufe', desc: 'Die erste Mission gewonnen.', icon: 'aw_first' },
  { id: 'camp_ukraine', title: 'Steppensturm', desc: 'Kampagne Ukraine abgeschlossen.', icon: 'aw_flag', check: () => campDone('ukraine') },
  { id: 'camp_ww2', title: 'Geschichtsbuch', desc: 'Eine Kampagne des Zweiten Weltkriegs abgeschlossen.', icon: 'aw_book', check: () => ['ww2-allies', 'ww2-soviet', 'ww2-axis'].some(campDone) },
  { id: 'camp_afghan', title: 'Hindukusch', desc: 'Eine Afghanistan-Kampagne abgeschlossen.', icon: 'aw_mountain', check: () => ['afghan-isaf', 'afghan-soviet'].some(campDone) },
  { id: 'tanks_10', title: 'Panzerjäger', desc: '10 feindliche Panzer zerstört.', icon: 'aw_tank', counter: 'tanks', goal: 10 },
  { id: 'tanks_100', title: 'Panzerknacker', desc: '100 feindliche Panzer zerstört.', icon: 'aw_tank2', counter: 'tanks', goal: 100 },
  { id: 'inf_250', title: 'Feuerwalze', desc: '250 feindliche Infanteristen ausgeschaltet.', icon: 'aw_inf', counter: 'inf', goal: 250 },
  { id: 'kills_1000', title: 'Tausend', desc: '1000 Abschüsse insgesamt.', icon: 'aw_kills', counter: 'kills', goal: 1000 },
  { id: 'no_losses', title: 'Ohne Verluste', desc: 'Eine Mission ohne eigene Verluste gewonnen.', icon: 'aw_shield' },
  { id: 'bridge_blown', title: 'Brücke gesprengt', desc: 'Eine Brücke gesprengt oder zum Einsturz gebracht.', icon: 'aw_bridge' },
  { id: 'train_ambush', title: 'Zug überfallen', desc: 'Lok oder Waggon eines feindlichen Zuges zerstört.', icon: 'aw_train' },
  { id: 'house_ambush', title: 'Hinterhalt aus dem Haus', desc: 'Aus einem besetzten Haus im Hinterhalt einen Feind ausgeschaltet.', icon: 'aw_house' },
  { id: 'starlink', title: 'Starlink-Ausfall gemeistert', desc: 'Eine Mission trotz Ausfall des Satellitennetzes gewonnen.', icon: 'aw_sat' },
  { id: 'night', title: 'Nachteinsatz', desc: 'Eine Mission bei Nacht gewonnen.', icon: 'aw_moon' },
  { id: 'weather', title: 'Allwetter', desc: 'Bei Schnee, Sturm, Nebel oder Rasputiza gewonnen.', icon: 'aw_snow' },
  { id: 'gold_1', title: 'Goldrichtig', desc: 'Die erste Goldmedaille errungen.', icon: 'aw_gold' },
  { id: 'gold_10', title: 'Ordensbrust', desc: '10 Goldmedaillen errungen.', icon: 'aw_gold10', counter: 'golds', goal: 10 },
  { id: 'veteran_win', title: 'Alter Hase', desc: 'Eine Mission auf „Veteran“ gewonnen.', icon: 'aw_vet' },
  { id: 'skirmish_win', title: 'Gefechtssieger', desc: 'Ein Gefecht gewonnen.', icon: 'aw_sk' },
  { id: 'skirmish_big', title: 'Großschlacht', desc: 'Ein Gefecht 4 gegen 4 oder größer gewonnen.', icon: 'aw_big' },
  { id: 'drones_25', title: 'Drohnenjäger', desc: '25 Drohnen oder Luftfahrzeuge abgeschossen.', icon: 'aw_drone', counter: 'air', goal: 25 },
  { id: 'intercept', title: 'Schutzschirm', desc: 'Einen Flugkörper abgefangen.', icon: 'aw_intercept' },
  { id: 'elite', title: 'Elite', desc: 'Eine Einheit hat den Elitestatus erreicht.', icon: 'aw_elite' },
  { id: 'abilities_50', title: 'Feuerleitung', desc: '50 Fähigkeiten eingesetzt.', icon: 'aw_fire', counter: 'abil', goal: 50 },
  { id: 'speedrun', title: 'Blitzangriff', desc: 'Eine Mission in unter 8 Minuten gewonnen.', icon: 'aw_clock' },
  { id: 'saver', title: 'Taktische Pause', desc: 'Einen Spielstand geladen.', icon: 'aw_save' },
];
const AW = Object.fromEntries(AWARDS.map((a) => [a.id, a]));

export function loadAwards() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { s = null; }
  if (!s || typeof s !== 'object') s = {};
  s.c ||= {}; s.u ||= {};
  return s;
}
function saveAwards(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* voll */ } }

export class AwardTracker {
  constructor(game, { isActive = () => true } = {}) {
    this.g = game; this.isActive = isActive; this.store = loadAwards(); this.fresh = [];
    this.m = {};
    const on = (ev, fn) => game.on(ev, (...a) => { if (!this._live()) return; try { fn(...a); } catch (e) { console.warn('[awards]', e); } });
    game.on('postLoad', () => { this.m = { outage: false, blew: false }; this.fresh = []; });
    on('kill', (u, killer) => {
      if (!killer || !game.isOwn(killer) || u.side === game.localSide || u.side === 'N' || u.type.build) return;
      this.inc('kills');
      if (u.type.vehicle && u.type.armor === 'heavy' && !u.type.rail && !u.type.structure) this.inc('tanks');
      if (u.type.infantry) this.inc('inf');
      if (u.type.air) this.inc('air');
      if (u.type.rail || u.train) this.unlock('train_ambush');
      if (killer.garrison && killer.ambush) this.unlock('house_ambush');
    });
    on('command', (pid, cmd) => {
      if (pid !== game.localPlayerId) return;
      if (cmd.t === 'ability') this.inc('abil');
      if (cmd.t === 'blowbridge') this.m.blew = true;
    });
    on('bridgeDestroyed', (b, cause) => { if (this.m.blew || /blow|spreng|demol|charge/i.test(String(cause || ''))) this.unlock('bridge_blown'); });
    on('promoted', (u, v) => { if (v >= 3 && game.isOwn(u)) this.unlock('elite'); });
    on('satnet', (team, st) => { if (st === 'outage' && team === game.localSide) this.m.outage = true; });
  }
  _live() { const g = this.g; return !g.replaying && !g.demo && g.active && this.isActive(); }
  inc(k, n = 1) {
    const c = this.store.c; c[k] = (c[k] || 0) + n;
    for (const a of AWARDS) if (a.counter === k && c[k] >= a.goal) this.unlock(a.id);
    this._dirty = true;
  }
  unlock(id) {
    const s = this.store;
    if (s.u[id] || !AW[id]) return false;
    s.u[id] = new Date().toISOString().slice(0, 10);
    this.fresh.push(AW[id]);
    saveAwards(s); this._dirty = false;
    this._toast(AW[id]);
    return true;
  }
  flush() { if (this._dirty) { saveAwards(this.store); this._dirty = false; } }
  // Missionsende (Sieg) – info: { kind: 'mission'|'skirmish', medal, level, mode }
  onWin(info = {}) {
    const g = this.g;
    if (g.replaying) return [];
    this.unlock('first_win');
    if ((g.stats.lost | 0) === 0) this.unlock('no_losses');
    if (this.m.outage) this.unlock('starlink');
    const wx = g.weather;
    if ((wx && !wx.idle && wx.nightF > 0.5) || g.mission?.env?.night) this.unlock('night');
    if (wx && !wx.idle && ['snow', 'storm', 'fog', 'rasputiza'].includes(wx.type)) this.unlock('weather');
    if ((g.stats.intercepts | 0) > 0) this.unlock('intercept');
    if (g.time - (g.stats.start || 0) < 480 && info.kind === 'mission') this.unlock('speedrun');
    if (info.level === 'veteran' && info.kind === 'mission') this.unlock('veteran_win');
    if (info.medal === 'gold') { this.unlock('gold_1'); this.inc('golds'); }
    if (info.kind === 'skirmish') { this.unlock('skirmish_win'); if ((info.mode || 0) >= 4) this.unlock('skirmish_big'); }
    this.checkStatic();
    this.flush();
    return this.fresh.slice();
  }
  checkStatic() { for (const a of AWARDS) if (a.check && !this.store.u[a.id]) { try { if (a.check()) this.unlock(a.id); } catch (e) { /* */ } } }
  _toast(a) {
    if (typeof document === 'undefined') return;
    let el = document.getElementById('award-toast');
    if (!el) { el = document.createElement('div'); el.id = 'award-toast'; el.className = 'award-toast hidden'; document.body.appendChild(el); }
    el.innerHTML = `${icon(a.icon)}<span><small>Auszeichnung freigeschaltet</small><b>${a.title}</b></span>`;
    el.classList.remove('hidden');
    clearTimeout(this._tt); this._tt = setTimeout(() => el.classList.add('hidden'), 4200);
  }
}

export function renderAwardsPage(el, store = loadAwards()) {
  const n = AWARDS.filter((a) => store.u[a.id]).length;
  el.innerHTML = `<p class="aw-sum">${icon('trophy', { cls: 'ic-in' })} ${n} / ${AWARDS.length} freigeschaltet</p><div class="aw-grid">${AWARDS.map((a) => {
    const got = store.u[a.id];
    const cur = a.counter ? Math.min(a.goal, store.c[a.counter] || 0) : 0;
    const prog = a.counter && !got ? `<span class="aw-prog"><i style="width:${Math.round((cur / a.goal) * 100)}%"></i></span><small>${cur} / ${a.goal}</small>` : '';
    return `<div class="aw-card ${got ? 'got' : 'locked'}" data-award="${a.id}">${icon(a.icon, { label: a.title })}<div class="aw-txt"><b>${a.title}</b><span>${a.desc}</span>${got ? `<small class="aw-date">${got}</small>` : prog}</div></div>`;
  }).join('')}</div>`;
}
