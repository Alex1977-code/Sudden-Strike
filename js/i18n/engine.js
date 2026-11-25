// V3-I18N-A: Übersetzungsmaschine Deutsch → Englisch für Oberflächentexte.
// Reihenfolge: exakter Treffer (TEXT + Namen aus den Registries) → Muster mit Platzhaltern (PATTERNS) → Teilstring-Ersetzung (GLOSS + Namen).
// Muster: [regexQuelle, vorlage]; in der Vorlage steht $1 für die Fangguppe, {1} für die rekursiv übersetzte Fangguppe.
import { TEXT, PATTERNS, GLOSS } from './en_ui.js';
import { UNITS_EN, ABIL_EN, WEAP_EN } from './en_units.js';

let sources = null;              // { units, weapons, abilities } – Registries aus unitTypes.js/abilities.js (gesetzt von main.js)
let sig = '';
const exact = new Map();
let glossMap = new Map();
let glossRe = null;
let pats = null;
const cache = new Map();

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function setNameSources(src) { sources = src; sig = ''; cache.clear(); }

export function unitNameEn(type) { const e = type && UNITS_EN[type.key]; return (e && e[0]) || (type && type.name) || ''; }
export function unitDescEn(type) { const e = type && UNITS_EN[type.key]; return (e && e[1]) || (type && type.desc) || ''; }
export function abilityNameEn(id, a) { const e = ABIL_EN[id]; return (e && e[0]) || (a && a.name) || ''; }
export function abilityDescEn(id, a) { const e = ABIL_EN[id]; return (e && e[1]) || (a && a.desc) || ''; }
export function weaponNameEn(id, w) { return WEAP_EN[id] || (w && w.name) || ''; }

function rebuild() {
  const s = sources ? `${Object.keys(sources.units || {}).length}|${Object.keys(sources.weapons || {}).length}|${Object.keys(sources.abilities || {}).length}` : '0';
  if (s === sig && pats) return;
  sig = s; cache.clear();
  exact.clear(); glossMap = new Map(Object.entries(GLOSS));
  for (const [k, v] of Object.entries(TEXT)) exact.set(k, v);
  if (sources) {
    for (const [id, u] of Object.entries(sources.units || {})) {
      const e = UNITS_EN[id];
      if (u.name && e && e[0] && e[0] !== u.name) { exact.set(u.name, e[0]); glossMap.set(u.name, e[0]); }
      if (u.desc && e && e[1] && e[1] !== u.desc) exact.set(u.desc, e[1]);
    }
    for (const [id, w] of Object.entries(sources.weapons || {})) { const e = WEAP_EN[id]; if (w.name && e && e !== w.name) { exact.set(w.name, e); glossMap.set(w.name, e); } }
    for (const [id, a] of Object.entries(sources.abilities || {})) {
      const e = ABIL_EN[id];
      if (a.name && e && e[0] && e[0] !== a.name) { exact.set(a.name, e[0]); glossMap.set(a.name, e[0]); }
      if (a.desc && e && e[1] && e[1] !== a.desc) exact.set(a.desc, e[1]);
    }
  }
  const keys = [...glossMap.keys()].filter((k) => k.length > 1).sort((a, b) => b.length - a.length);
  glossRe = keys.length ? new RegExp('(?<![\\p{L}\\d])(?:' + keys.map(esc).join('|') + ')(?![\\p{L}])', 'gu') : null;
  pats = PATTERNS.map(([re, tpl]) => [new RegExp('^(?:' + (re.source ?? re) + ')$', 'su'), tpl]);
}

function applyTpl(tpl, m) {
  return tpl.replace(/\{(\d)\}|\$(\d)/g, (x, a, b) => (a !== undefined ? translateCore(m[+a] || '') : (m[+b] ?? '')));
}

function translateCore(s) {
  if (!s) return s;
  let r = exact.get(s);
  if (r !== undefined) return r;
  // Präfix (Emoji/Symbole) und Satzzeichen am Ende abtrennen
  const mm = /^([^\p{L}\p{N}(„"“]*)(.*?)([\s:.…!?]*)$/su.exec(s);
  if (mm && (mm[1] || mm[3]) && mm[2]) {
    r = exact.get(mm[2]);
    if (r !== undefined) return mm[1] + r + mm[3];
  }
  for (const [re, tpl] of pats) {
    const m = re.exec(s);
    if (m) return applyTpl(tpl, m);
  }
  if (s.includes(' · ') || s.includes(' | ')) {
    const sep = s.includes(' · ') ? ' · ' : ' | ';
    const parts = s.split(sep), tr = parts.map(translateCore);
    if (tr.some((p, i) => p !== parts[i])) return tr.join(sep);
  }
  if (s.includes('\n')) {
    const flat = s.replace(/\s*\n\s*/g, ' ');
    const rf = exact.get(flat);
    if (rf !== undefined) return rf;
  }
  if (s.includes('\n')) { const parts = s.split('\n'); const tr = parts.map(translateCore); if (tr.some((p, i) => p !== parts[i])) return tr.join('\n'); }
  const ci = s.indexOf(': ');
  if (ci > 0) { const a = translateCore(s.slice(0, ci)), b = translateCore(s.slice(ci + 2)); if (a !== s.slice(0, ci) || b !== s.slice(ci + 2)) return a + ': ' + b; }
  const di = s.indexOf(' – ');
  if (di > 0) { const a = translateCore(s.slice(0, di)), b = translateCore(s.slice(di + 3)); if (a !== s.slice(0, di) || b !== s.slice(di + 3)) return a + ' – ' + b; }
  if (glossRe) return s.replace(glossRe, (w) => glossMap.get(w) ?? w);
  return s;
}

export function translateText(s) {
  if (s === undefined || s === null) return s;
  rebuild();
  const hit = cache.get(s);
  if (hit !== undefined) return hit;
  const lead = /^\s*/.exec(s)[0], trail = /\s*$/.exec(s)[0];
  const core = s.slice(lead.length, s.length - trail.length);
  let out = core ? translateCore(core.replace(/(\d\d:\d\d) Uhr/g, '$1')) : core;
  // Sicherheitsnetz: Muster dürfen mehrere Sätze enthalten; nicht übersetzte Reste per Teilstring versuchen
  out = lead + out.replace(/(\d),(\d)/g, '$1.$2') + trail; // Dezimalkomma → Punkt (Englisch)
  if (cache.size > 6000) cache.clear();
  cache.set(s, out);
  return out;
}
