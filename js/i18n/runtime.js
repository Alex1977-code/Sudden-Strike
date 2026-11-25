// V3-I18N-B: Englische Fassung der Kampagnen-, Missions- und Ortstexte (Laufzeitmechanik).
//
// Deutsch bleibt die Quelle im Code. Bei Sprache 'en' wird
//   (a) das Missions-Overlay (title, place, date, summary, victory, weather-Text, briefing[{s,t}], objectivesPreview, forces,
//       markers[].label) und das Kampagnen-Overlay (title, subtitle, desc, faction) sowie die Ortsvorlagen
//       (name, label, date, notes, landmarks[].name) aus den Tabellen js/i18n/en_missions/*.js darübergelegt – die deutschen
//       Originale werden gemerkt und beim Zurückschalten wiederhergestellt;
//   (b) alle Laufzeittexte (Game.say/sayTo, alert/alertTo, addObjective-/Ziel-Text-Updates, win/lose, Countdown-Label) beim
//       Ausgeben (Game.emit) übersetzt – der Spielzustand bleibt Deutsch (Vergleiche in Missionen, Speicherstände);
//   (c) der Tutorial-Hinweiskasten über trRuntime() (js/missions/tutorial/_tutor.js).
//
// Tabellen: Schlüssel = deutscher Originaltext, Wert = Englisch. Texte mit Zahlen/Namen tragen im Schlüssel {$} je Platzhalter
// (Reihenfolge), im Wert {$1}, {$2} …; die Fangtexte werden rekursiv übersetzt (Namen, Ziele). Nicht gefundene deutsche Texte
// bleiben deutsch und landen in window.__i18nMissing (nur Texte, die deutsch aussehen); window.__i18nDebug = true sammelt
// zusätzlich alles Unübersetzte in window.__i18nSeen.
//
// API: trRuntime(text) · deText(text) (englischer Text → deutsches Original, für Icon-/Typ-Erkennung in main.js)
//      refreshMissionLang() (idempotent; vor dem Rendern von Kampagnenliste/Briefing aufrufen)
import { getLang, onLangChange, tr as trUi } from '../i18n.js'; // trUi: Oberflächen-/Engine-Übersetzer (V3-I18N-A) als Rückfall
import { Game } from '../game/game.js';
import { getCampaigns, DIFFICULTY, ERAS } from '../missions/campaigns.js';
import { PLACES } from '../maps/places/index.js';
import ukraine from './en_missions/ukraine.js';
import tutorial from './en_missions/tutorial.js';
import ww2_allies from './en_missions/ww2_allies.js';
import ww2_soviet from './en_missions/ww2_soviet.js';
import ww2_axis from './en_missions/ww2_axis.js';
import places from './en_missions/places.js';
import common from './en_missions/common.js';
import afghan_isaf from './en_missions/afghan_isaf.js';
import afghan_soviet from './en_missions/afghan_soviet.js';

const TABLES = [ukraine, tutorial, ww2_allies, ww2_soviet, ww2_axis, places, common, afghan_isaf, afghan_soviet];
const EXTRA = { // Stufen/Epochen (campaigns.js) und Sprecher, die aus Wörterbüchern ohne Missionsbezug kommen
  'Leicht': 'Easy', 'Mittel': 'Medium', 'Schwer': 'Hard', 'Ausbildung': 'Training', 'Gegenwart': 'Present day', 'Zweiter Weltkrieg': 'World War II',
};

const exact = new Map();
const patterns = [];
const reverse = new Map(); // englischer Text → deutsches Original
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
for (const [k, v] of Object.entries(EXTRA)) exact.set(k, v);
for (const tab of TABLES) {
  for (const [de, en] of Object.entries(tab)) {
    if (de.includes('{$}')) {
      const parts = de.split('{$}');
      patterns.push({ re: new RegExp('^' + parts.map(esc).join('([\\s\\S]*?)') + '$'), en, lit: parts.join('').length, de });
    } else {
      if (!exact.has(de)) exact.set(de, en);
      if (!reverse.has(en)) reverse.set(en, de);
      const td = de.trim();
      if (td !== de && td && !exact.has(td)) exact.set(td, en.trim()); // Absatz ohne führende/folgende Zeilenumbrüche
    }
  }
}
patterns.sort((a, b) => b.lit - a.lit);

const w = typeof window !== 'undefined' ? window : globalThis;
w.__i18nMissing = w.__i18nMissing || [];
w.__i18nSeen = w.__i18nSeen || new Set();
const missingSet = new Set();
const GERMAN_WORDS = /(?:^|[^A-Za-zÄÖÜäöüß])(?:der|die|das|und|ist|nicht|mit|von|zu|zum|zur|auf|den|dem|des|ein|eine|einen|wir|ihr|sie|im|für|bis|vor|nach|aus|bei|über|noch|jetzt|alle|wird|werden|haben|sind|oder|dann|wenn|nur|kein|keine|gegen|unter|durch)(?:[^A-Za-zÄÖÜäöüß]|$)/;
const looksGerman = (s) => /[äöüßÄÖÜ]/.test(s) || GERMAN_WORDS.test(s);

const cache = new Map();
const fill = (en, caps) => en.replace(/\{\$(\d+)\}/g, (m, n) => (caps[+n - 1] !== undefined ? trQuiet(caps[+n - 1]) : m));
function lookup(s) {
  if (exact.has(s)) return exact.get(s);
  for (const p of patterns) { const m = p.re.exec(s); if (m) return fill(p.en, m.slice(1)); }
  // Mehrzeilig: Absätze einzeln
  if (s.includes('\n')) {
    const parts = s.split(/(\n+)/);
    let any = false;
    const out = parts.map((x) => { if (!x.trim() || /^\n+$/.test(x)) return x; const r = lookup(x); if (r !== undefined) { any = true; return r; } return x; });
    if (any) return out.join('');
  }
  // Führende Zeichen (Symbole, Leerraum) abtrennen
  const mm = /^([^\p{L}\p{N}]+)([\s\S]+)$/u.exec(s);
  if (mm) { const r = lookup(mm[2]); if (r !== undefined) return mm[1] + r; }
  return undefined;
}
function trQuiet(s) {
  if (typeof s !== 'string' || !s) return s;
  if (cache.has(s)) return cache.get(s);
  const r = lookup(s);
  const out = r === undefined ? s : r;
  cache.set(s, out);
  return out;
}
/** Deutschen Text ins Englische übersetzen (bei Sprache 'de' unverändert); Unbekanntes bleibt deutsch und wird gemeldet. */
export function trRuntime(s) {
  if (getLang() !== 'en' || typeof s !== 'string' || !s) return s;
  if (cache.has(s)) return cache.get(s);
  let r = lookup(s);
  if (r === undefined) { try { const u = trUi(s); if (u && u !== s) r = u; } catch (e) { /* ignorieren */ } }
  if (r === undefined) {
    cache.set(s, s);
    if (looksGerman(s) && !missingSet.has(s)) { missingSet.add(s); w.__i18nMissing.push(s); }
    else if (w.__i18nDebug) w.__i18nSeen.add(s);
    return s;
  }
  cache.set(s, r);
  return r;
}
/** Englischer Text → deutsches Original (für Erkennung per deutscher Schlüsselwörter, z. B. Icons); sonst unverändert. */
export function deText(s) { return getLang() === 'en' && reverse.has(s) ? reverse.get(s) : s; }

// ---------- Overlay: Missionen, Kampagnen, Orte ----------
const FIELDS = ['title', 'place', 'date', 'summary', 'victory', 'defeat'];
const origs = new WeakMap();   // Objekt → Original der überlagerten Felder
const applied = new WeakMap(); // Objekt → zuletzt angewendete Sprache

function snapshotMission(m) {
  let o = origs.get(m);
  if (o) return o;
  o = {};
  for (const f of FIELDS) if (typeof m[f] === 'string') o[f] = m[f];
  if (typeof m.weather === 'string') o.weather = m.weather;
  if (Array.isArray(m.briefing)) o.briefing = m.briefing.map((b) => ({ ...b }));
  if (Array.isArray(m.objectivesPreview)) o.objectivesPreview = [...m.objectivesPreview];
  if (Array.isArray(m.forces)) o.forces = [...m.forces];
  if (Array.isArray(m.markers)) o.markers = m.markers.map((k) => [k, k.label]);
  origs.set(m, o);
  return o;
}
function overlayMission(m, en) {
  const o = snapshotMission(m), T = en ? trRuntime : (x) => x;
  for (const f of Object.keys(o)) {
    if (f === 'briefing') m.briefing = o.briefing.map((b) => ({ ...b, s: T(b.s), t: T(b.t) }));
    else if (f === 'objectivesPreview' || f === 'forces') m[f] = o[f].map(T);
    else if (f === 'markers') { for (const [k] of o.markers) setMarker(k, en); }
    else m[f] = T(o[f]);
  }
}
const campOrig = new WeakMap();
function overlayCampaign(c, en) {
  let o = campOrig.get(c);
  if (!o) { o = {}; for (const f of ['title', 'subtitle', 'desc', 'faction', 'years']) if (typeof c[f] === 'string') o[f] = c[f]; campOrig.set(c, o); }
  for (const f of Object.keys(o)) c[f] = en ? trRuntime(o[f]) : o[f];
}
const placeOrig = new WeakMap();
function overlayPlace(p, en) {
  let o = placeOrig.get(p);
  if (!o) {
    o = {};
    for (const f of ['name', 'label', 'date', 'notes']) if (typeof p[f] === 'string') o[f] = p[f];
    if (Array.isArray(p.landmarks)) o.landmarks = p.landmarks.map((l) => [l, l.name]);
    placeOrig.set(p, o);
  }
  for (const f of ['name', 'label', 'date', 'notes']) if (f in o) p[f] = en ? trRuntime(o[f]) : o[f];
  if (o.landmarks) for (const [l, n] of o.landmarks) l.name = en ? trRuntime(n) : n;
}
let diffDe = null, erasDe = null;
let overlayLang = null, overlayCount = -1;
/** Overlay (neu) anwenden, falls Sprache oder Kampagnenbestand sich geändert haben. Idempotent und billig. */
export function refreshMissionLang() {
  const lang = getLang(), en = lang === 'en';
  let list = [];
  try { list = getCampaigns(); } catch (e) { return; }
  const n = list.reduce((a, c) => a + 1 + (c.missions?.length || 0), 0);
  if (overlayLang === lang && overlayCount === n) return;
  overlayLang = lang; overlayCount = n;
  if (!diffDe) { diffDe = { ...DIFFICULTY }; erasDe = Object.fromEntries(Object.entries(ERAS).map(([k, v]) => [k, v.label])); }
  for (const k of Object.keys(diffDe)) DIFFICULTY[k] = en ? trRuntime(diffDe[k]) : diffDe[k];
  for (const k of Object.keys(erasDe)) ERAS[k].label = en ? trRuntime(erasDe[k]) : erasDe[k];
  for (const c of list) { overlayCampaign(c, en); for (const m of c.missions || []) overlayMission(m, en); }
  for (const p of PLACES) overlayPlace(p, en);
}
onLangChange(() => {
  cache.clear();
  refreshMissionLang();
  try { const g = w.__game; if (g) translateMarkers(g); } catch (e) { /* ignorieren */ }
});

// ---------- Marker-Beschriftungen ----------
const markerOrig = new WeakMap();
function setMarker(k, en) {
  if (!k || typeof k.label !== 'string') return;
  let o = markerOrig.get(k);
  if (!o) { o = { de: k.label, en: null }; markerOrig.set(k, o); }
  else if (k.label !== o.de && k.label !== o.en) o.de = k.label; // Mission hat neu beschriftet
  o.en = en ? trRuntime(o.de) : o.de;
  k.label = o.en;
}
function translateMarkers(g) {
  const list = g.mission?.markers;
  if (Array.isArray(list)) { const en = getLang() === 'en'; for (const k of list) setMarker(k, en); }
}

// ---------- Laufzeittexte: Hooks in Game ----------
const emit0 = Game.prototype.emit;
Game.prototype.emit = function emitI18n(ev, ...a) {
  if (ev === 'beginLoad') { try { refreshMissionLang(); } catch (e) { /* ignorieren */ } }
  if (getLang() !== 'en') return emit0.call(this, ev, ...a);
  try {
    if (ev === 'say') { a[0] = trRuntime(a[0]); a[1] = trRuntime(a[1]); }
    else if (ev === 'alert') a[0] = trRuntime(a[0]);
    else if (ev === 'end') a[1] = trRuntime(a[1]);
  } catch (e) { console.warn('[i18n-b]', e); }
  if (ev === 'objectives') {
    // Ziel-Texte nur für die Dauer der Listener übersetzen (Spielzustand und Vergleiche in Missionen bleiben deutsch)
    const swapped = [];
    try { for (const o of this.objectives || []) { const en = trRuntime(o.text); if (en !== o.text) { swapped.push([o, o.text, en]); o.text = en; } } } catch (e) { console.warn('[i18n-b]', e); }
    try { return emit0.call(this, ev, ...a); } finally { for (const [o, de, en] of swapped) if (o.text === en) o.text = de; translateMarkers(this); }
  }
  const r = emit0.call(this, ev, ...a);
  if (ev === 'loaded' || ev === 'say' || ev === 'alert') { try { translateMarkers(this); } catch (e) { /* ignorieren */ } }
  return r;
};
const cd0 = Game.prototype.setCountdown;
Game.prototype.setCountdown = function setCountdownI18n(sec, label, onEnd) {
  return cd0.call(this, sec, getLang() === 'en' ? trRuntime(label) : label, onEnd);
};
