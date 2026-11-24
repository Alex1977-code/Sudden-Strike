// Mod-Unterstützung: Mod-Dateien (JSON, Format „steppensturm-mod") fügen Karten hinzu und passen Einheitenwerte an.
//
// Sicherheit: Mods sind reine Daten. Es wird nie Code aus Mods ausgeführt (kein eval/Function/innerHTML ohne Escape).
// validateMod() weist Code-Felder (setup/update/script …, Texte mit „function(" / „<script" …) und Prototyp-Schlüssel ab,
// prüft Einheiten-/Waffenschlüssel gegen die vorhandenen Typen und klemmt alle Zahlen auf sinnvolle Bereiche.
// Erlaubte Einheitenfelder: hp, speed, sight · erlaubte Waffenfelder: dmg, range, reload.
//
// Aktive Mods liegen in localStorage (steppensturm.mods.v1) und sind einzeln an-/abschaltbar. applyActiveMods() stellt
// zuerst alle Originalwerte wieder her und wendet dann die aktiven Mods in Installationsreihenfolge an.
import { UNIT_TYPES, W } from '../game/unitTypes.js';
import { sanitizeMap, findCodeField } from './format.js';
import { listSlots, loadSlot } from './storage.js';

export const MOD_FORMAT = 'steppensturm-mod';
export const MOD_VERSION = 1;
const MODS_KEY = 'steppensturm.mods.v1';
const MAX_TEXT = 2 * 1024 * 1024;
export const UNIT_FIELDS = { hp: [1, 20000], speed: [0.1, 60], sight: [1, 150] };
export const WEAPON_FIELDS = { dmg: [0, 5000], range: [1, 400], reload: [0.05, 120] };
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const isObj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
const str = (v, max, def = '') => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : def);

// ---------- Validierung ----------
export function validateMod(input) {
  const warnings = [], errors = [];
  let raw = input;
  if (typeof raw === 'string') {
    if (raw.length > MAX_TEXT) return { ok: false, errors: [`Mod zu groß (${Math.round(raw.length / 1024)} KB, höchstens ${MAX_TEXT / 1024} KB).`], warnings };
    try { raw = JSON.parse(raw); } catch (e) { return { ok: false, errors: ['Kein gültiges JSON: ' + e.message], warnings }; }
  }
  if (!isObj(raw)) return { ok: false, errors: ['Mod muss ein JSON-Objekt sein.'], warnings };
  // Eine einzelne Karte (Editor-Export) wird als Mod mit einer Karte akzeptiert
  if (raw.format === 'steppensturm-karte') raw = { format: MOD_FORMAT, version: 1, name: raw.meta?.title || 'Eigene Karte', author: raw.meta?.author || '', maps: [raw] };
  if (raw.format !== MOD_FORMAT) return { ok: false, errors: [`Unbekanntes Format „${str(raw.format, 40) || '(fehlt)'}" – erwartet „${MOD_FORMAT}".`], warnings };
  const code = findCodeField(raw);
  if (code) return { ok: false, errors: [`Abgewiesen: Feld „${code}" enthält ausführbaren Code oder ist nicht erlaubt. Mods dürfen nur Daten enthalten.`], warnings };
  const known = new Set(['format', 'version', 'id', 'name', 'author', 'description', 'maps', 'units', 'weapons']);
  for (const k of Object.keys(raw)) if (!known.has(k)) warnings.push(`Unbekanntes Feld „${str(k, 30)}" ignoriert.`);
  const name = str(raw.name, 60) || 'Unbenannter Mod';
  let id = typeof raw.id === 'string' && /^[a-z0-9][a-z0-9_-]{0,39}$/i.test(raw.id) ? raw.id.toLowerCase() : name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'mod';
  const mod = { id, name, author: str(raw.author, 60), description: str(raw.description, 600), version: str(String(raw.version ?? ''), 20), maps: [], units: {}, weapons: {} };
  if (raw.maps !== undefined) {
    if (!Array.isArray(raw.maps)) warnings.push('„maps" muss eine Liste sein – ignoriert.');
    else {
      if (raw.maps.length > 30) warnings.push(`Zu viele Karten (${raw.maps.length}) – nur die ersten 30 übernommen.`);
      raw.maps.slice(0, 30).forEach((m, i) => {
        const r = sanitizeMap(m, { source: `Karte ${i + 1}` });
        if (!r.ok) { warnings.push(...r.errors); return; }
        for (const w of r.warnings.slice(0, 5)) warnings.push(`Karte „${r.map.meta.title}": ${w}`);
        mod.maps.push(r.map);
      });
    }
  }
  const patch = (src, table, fields, out, what) => {
    if (src === undefined) return;
    if (!isObj(src)) { warnings.push(`„${what}" muss ein Objekt sein – ignoriert.`); return; }
    let n = 0;
    for (const [k, vals] of Object.entries(src)) {
      if (++n > 500) { warnings.push(`Zu viele Einträge in „${what}".`); break; }
      if (!own(table, k)) { warnings.push(`${what}: unbekannter Schlüssel „${str(k, 30)}" ignoriert.`); continue; }
      if (!isObj(vals)) { warnings.push(`${what}.${k}: Objekt erwartet – ignoriert.`); continue; }
      const o = {};
      for (const [f, v] of Object.entries(vals)) {
        if (!own(fields, f)) { warnings.push(`${what}.${k}.${str(f, 20)}: Feld nicht erlaubt (erlaubt: ${Object.keys(fields).join(', ')}).`); continue; }
        const nv = typeof v === 'number' ? v : NaN;
        if (!Number.isFinite(nv)) { warnings.push(`${what}.${k}.${f}: Zahl erwartet – ignoriert.`); continue; }
        const [lo, hi] = fields[f];
        const c = Math.min(hi, Math.max(lo, nv));
        if (c !== nv) warnings.push(`${what}.${k}.${f}: ${nv} auf ${c} geklemmt (erlaubt ${lo}–${hi}).`);
        o[f] = c;
      }
      if (Object.keys(o).length) out[k] = o;
    }
  };
  patch(raw.units, UNIT_TYPES, UNIT_FIELDS, mod.units, 'units');
  patch(raw.weapons, W, WEAPON_FIELDS, mod.weapons, 'weapons');
  if (!mod.maps.length && !Object.keys(mod.units).length && !Object.keys(mod.weapons).length) errors.push('Der Mod enthält weder gültige Karten noch Werte-Anpassungen.');
  return { ok: errors.length === 0, mod: errors.length ? null : mod, warnings, errors };
}

// ---------- Ablage ----------
function readMods() {
  try { const a = JSON.parse(localStorage.getItem(MODS_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
}
function writeMods(list) {
  try { localStorage.setItem(MODS_KEY, JSON.stringify(list)); return { ok: true }; }
  catch (e) { return { ok: false, error: 'Mods konnten nicht gespeichert werden: ' + (e?.message || e) }; }
}
let MODS = null;
function mods() {
  if (MODS) return MODS;
  // Beim Laden erneut validieren (localStorage könnte manipuliert sein)
  MODS = [];
  for (const m of readMods()) {
    const r = validateMod({ ...m, format: MOD_FORMAT });
    if (r.ok) { r.mod.enabled = m.enabled !== false; r.mod.installed = str(m.installed, 32); MODS.push(r.mod); }
  }
  return MODS;
}
export function listMods() { return mods().map((m) => ({ ...m })); }
export function installMod(input) {
  const r = validateMod(input);
  if (!r.ok) return r;
  const list = mods();
  const i = list.findIndex((m) => m.id === r.mod.id);
  r.mod.enabled = true;
  r.mod.installed = new Date().toISOString().slice(0, 19);
  r.replaced = i >= 0;
  if (i >= 0) list[i] = r.mod; else list.push(r.mod);
  const w = writeMods(list);
  if (!w.ok) r.warnings.push(w.error + ' (nur für diese Sitzung aktiv)');
  applyActiveMods();
  return r;
}
export function setModEnabled(id, on) {
  const m = mods().find((q) => q.id === id);
  if (!m) return false;
  m.enabled = !!on;
  writeMods(mods());
  applyActiveMods();
  return true;
}
export function removeMod(id) {
  const list = mods();
  const i = list.findIndex((q) => q.id === id);
  if (i < 0) return false;
  list.splice(i, 1);
  writeMods(list);
  applyActiveMods();
  return true;
}

// ---------- Werte anwenden (umkehrbar) ----------
const ORIG_U = new Map(), ORIG_W = new Map();
const tempo = (t) => (t.vehicle ? 0.72 : t.infantry ? 0.95 : 1); // wie prepareType() in unitTypes.js
export function applyActiveMods() {
  for (const [k, o] of ORIG_U) Object.assign(UNIT_TYPES[k], o);
  for (const [k, o] of ORIG_W) Object.assign(W[k], o);
  ORIG_U.clear(); ORIG_W.clear();
  const applied = { units: 0, weapons: 0 };
  for (const m of mods()) {
    if (!m.enabled) continue;
    for (const [k, vals] of Object.entries(m.units)) {
      const t = UNIT_TYPES[k];
      if (!t) continue;
      if (!ORIG_U.has(k)) ORIG_U.set(k, { hp: t.hp, speed: t.speed, sight: t.sight });
      if (vals.hp !== undefined) t.hp = vals.hp;
      if (vals.speed !== undefined) t.speed = vals.speed * tempo(t);
      if (vals.sight !== undefined) t.sight = vals.sight;
      applied.units++;
    }
    for (const [k, vals] of Object.entries(m.weapons)) {
      const w = W[k];
      if (!w) continue;
      if (!ORIG_W.has(k)) ORIG_W.set(k, { dmg: w.dmg, range: w.range, reload: w.reload });
      Object.assign(w, vals);
      applied.weapons++;
    }
  }
  return applied;
}
export function initMods() { try { return applyActiveMods(); } catch (e) { console.warn('Mods: ', e); return { units: 0, weapons: 0 }; } }
// Grundwert eines Typs ohne Mods (für Anzeige/Tests)
export function baseUnitValue(k, f) { const o = ORIG_U.get(k); const t = UNIT_TYPES[k]; if (!t) return undefined; if (o) return f === 'speed' ? o.speed / tempo(t) : o[f]; return f === 'speed' ? t.speed / tempo(t) : t[f]; }

// ---------- Eigene Karten (aktive Mods + Editor-Speicherplätze) ----------
export function listCustomMaps() {
  const out = [];
  for (const m of mods()) {
    if (!m.enabled) continue;
    m.maps.forEach((doc, i) => out.push({ key: `mod:${m.id}:${i}`, title: doc.meta.title, author: doc.meta.author, source: `Mod „${m.name}"`, doc }));
  }
  for (const s of listSlots()) {
    const doc = loadSlot(s.name);
    if (doc) out.push({ key: `slot:${s.name}`, title: doc.meta.title, author: doc.meta.author, source: `Editor (${s.name})`, doc });
  }
  return out;
}
export function getCustomMap(key) {
  if (typeof key !== 'string') return null;
  if (key.startsWith('slot:')) return loadSlot(key.slice(5));
  const m = /^mod:([^:]+):(\d+)$/.exec(key);
  if (!m) return null;
  const mod = mods().find((q) => q.id === m[1] && q.enabled);
  return mod?.maps[+m[2]] || null;
}
