// Lokale Ablage der Editor-Karten (localStorage, mehrere Speicherplätze + automatische Sicherung).
// Jeder Zugriff ist in try/catch – im privaten Modus, bei vollem Speicher oder gesperrtem Speicher arbeitet der
// Editor ohne Ablage weiter und meldet den Fehler.
import { sanitizeMap } from './format.js';

const SLOTS_KEY = 'steppensturm.editor.slots.v1';
const AUTO_KEY = 'steppensturm.editor.autosave.v1';
export const MAX_SLOTS = 24;

function readJSON(key, def) {
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : def; } catch (e) { return def; }
}
function writeJSON(key, v) {
  try { localStorage.setItem(key, JSON.stringify(v)); return { ok: true }; }
  catch (e) { return { ok: false, error: /quota/i.test(String(e?.name) + String(e?.message)) ? 'Speicher voll – bitte alte Karten löschen oder exportieren.' : 'Lokaler Speicher nicht verfügbar (' + (e?.message || e) + ').' }; }
}

// Liste der Speicherplätze: [{ name, title, modified, units, elements }]
export function listSlots() {
  const all = readJSON(SLOTS_KEY, {});
  if (!all || typeof all !== 'object') return [];
  return Object.entries(all).map(([name, doc]) => ({ name, title: doc?.meta?.title || name, author: doc?.meta?.author || '', modified: doc?.meta?.modified || '', units: doc?.units?.length || 0, elements: doc?.elements?.length || 0 }))
    .sort((a, b) => String(b.modified).localeCompare(String(a.modified)));
}
export function loadSlot(name) {
  const all = readJSON(SLOTS_KEY, {});
  const doc = all && Object.prototype.hasOwnProperty.call(all, name) ? all[name] : null;
  if (!doc) return null;
  const r = sanitizeMap(doc, { source: `Speicherplatz „${name}"` });
  return r.ok ? r.map : null;
}
export function saveSlot(name, doc) {
  name = String(name || '').trim().slice(0, 40) || 'Karte';
  const all = readJSON(SLOTS_KEY, {}) || {};
  if (!Object.prototype.hasOwnProperty.call(all, name) && Object.keys(all).length >= MAX_SLOTS) return { ok: false, error: `Höchstens ${MAX_SLOTS} Speicherplätze – bitte einen löschen.` };
  const clean = sanitizeMap(doc).map;
  clean.meta.modified = new Date().toISOString().slice(0, 19);
  all[name] = clean;
  const r = writeJSON(SLOTS_KEY, all);
  return r.ok ? { ok: true, name, doc: clean } : r;
}
export function deleteSlot(name) {
  const all = readJSON(SLOTS_KEY, {}) || {};
  delete all[name];
  return writeJSON(SLOTS_KEY, all);
}
export function autosave(doc) { return writeJSON(AUTO_KEY, doc); }
export function loadAutosave() {
  const d = readJSON(AUTO_KEY, null);
  if (!d) return null;
  const r = sanitizeMap(d, { source: 'Automatische Sicherung' });
  return r.ok ? r.map : null;
}
