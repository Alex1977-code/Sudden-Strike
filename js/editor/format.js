// Datenformat „Steppensturm-Karte" (JSON, versioniert) – Schema, Standardwerte, Validierung/Normalisierung.
//
// Eine Karte ist reine Daten (kein Code). sanitizeMap(raw) prüft und normalisiert jede Eingabe (Editor, Import, Mods):
// unbekannte Felder fallen weg, Zahlen werden geklemmt, Texte gekürzt, Typen/Arten gegen Whitelists geprüft.
// sanitizeMap ist idempotent: sanitizeMap(sanitizeMap(x)) ≡ sanitizeMap(x) → Export → Import ergibt identisches JSON.
//
// {
//   format: 'steppensturm-karte', version: 1,
//   meta: { title, author, era: 'modern'|'ww2'|'afghan', description, created, modified },
//   map: { size, seed, season: 'summer'|'autumn'|'winter', night, relief, scatterTrees },
//   player: 'UA'|'RU',                    // Spielerteam im Missionsmodus
//   briefing: 'Text',
//   elements: [ Gelände-Elemente, siehe ELEMENT_TYPES ],
//   units:  [ { id, type, team, x, z, heading, ai: 'guard'|'hold'|'attack', target } ],
//   points: [ { id, kind, x, z, name, value, radius } ],           // Eroberungspunkte
//   zones:  [ { id, team, x, z, r } ],                             // Startzonen (Gefecht, Kamera)
//   objectives: [ { id, kind: 'annihilate'|'destroy'|'hold'|'timelimit', minutes?, x?, z?, r? } ],
//   nextId
// }
import { UNIT_TYPES } from '../game/unitTypes.js';
import { BUILDING_SETS } from '../game/buildingKinds.js';
import { HOUSE_KINDS } from '../game/models.js';

export const FORMAT = 'steppensturm-karte';
export const VERSION = 1;
export const MAP_SIZE_OPTIONS = [160, 200, 260, 320, 380, 450, 520];
export const SEASONS = { summer: 'Sommer', autumn: 'Herbst', winter: 'Winter' };
export const ERAS = { modern: 'Gegenwart (2022–2026)', ww2: 'Zweiter Weltkrieg', afghan: 'Afghanistan' };
export const ERA_SET = { modern: 'ukraine_village', ww2: 'east_ww2', afghan: 'afghan' };
export const CROPS = { wheat: 'Weizen', sunflower: 'Sonnenblumen', stubble: 'Stoppelfeld', green: 'Grünland', plowed: 'Acker (gepflügt)' };
export const FOREST_KINDS = { mixed: 'Mischwald', pine: 'Nadelwald', deciduous: 'Laubwald' };
export const ROAD_KINDS = { road: 'Straße', track: 'Feldweg', rail: 'Bahnlinie' };
export const CP_KINDS = { zeppelin: 'Zeppelin', aerostat: 'Fesselballon', airfield: 'Flugfeld', depot: 'Depot', radio: 'Funkturm', railway: 'Bahnhof' };
export const CP_DEFAULT_R = { zeppelin: 18, aerostat: 14, airfield: 18, depot: 14, radio: 14, railway: 16 };
export const AI_MODES = { guard: 'Verteidigen (Umkreis)', hold: 'Stellung halten', attack: 'Angreifen' };
export const OBJECTIVE_KINDS = { annihilate: 'Alle Feinde vernichten', destroy: 'Ziel-Einheiten zerstören', hold: 'Gebiet halten', timelimit: 'Zeitlimit' };
// Siedlungsstil: einfach (Häuser aus einem Gebäude-Set) oder Ortsgenerator des Geländes (js/engine/settlement.js,
// Feature village + useGenerator) – ältere Geländestände ohne Generator fallen auf ein einfaches Dorf zurück.
export const SETTLEMENT_STYLES = {
  simple: 'Einfach (Gebäude-Set)', ukr_village: 'Generator: Ukrainisches Dorf', ukr_town: 'Generator: Ukrainische Kleinstadt',
  soviet_city: 'Generator: Sowjetische Stadt', afghan_village: 'Generator: Afghanisches Dorf', afghan_town: 'Generator: Afghanische Kleinstadt',
  normandy_village: 'Generator: Normannisches Dorf', eu_town: 'Generator: Europäische Kleinstadt', german_city: 'Generator: Deutsche Stadt',
  desert_village: 'Generator: Wüstendorf',
};
export const SET_NAMES = { ukraine_village: 'Ukraine – Dorf', ukraine_town: 'Ukraine – Stadt', afghan: 'Afghanistan', normandy: 'Normandie', east_ww2: 'Osteuropa (WK2)', german_town: 'Deutsche Kleinstadt' };
export const KIND_NAMES = {
  cottage: 'Landhaus', izba: 'Isba (Holzhaus)', barn: 'Scheune', shop: 'Laden', kiosk: 'Kiosk', church_orthodox: 'Orthodoxe Kirche',
  warehouse: 'Lagerhalle', khrushchyovka: 'Chruschtschowka', watchtower: 'Wachturm', panel_high: 'Plattenbau (Hochhaus)',
  industrial: 'Industriehalle', townhouse_eu: 'Stadthaus', mud_house: 'Lehmhaus', qalat: 'Qalat (Gehöft)', bazaar: 'Basar',
  farmhouse_eu: 'Bauernhaus', church_west: 'Kirche',
};
// Typische Maße je Gebäudeart (aus den Gebäude-Sets abgeleitet; Fallback 8×7)
export function buildingDims(kind) {
  for (const set of Object.values(BUILDING_SETS)) {
    const e = set.find((q) => q.kind === kind);
    if (e) return { w: Math.round((e.w[0] + e.w[1]) / 2 * 10) / 10, d: Math.round((e.d[0] + e.d[1]) / 2 * 10) / 10, floors: e.floors[0] };
  }
  return { w: 8, d: 7, floors: 1 };
}
export const ALL_BUILDING_KINDS = () => {
  const s = new Set(HOUSE_KINDS);
  for (const set of Object.values(BUILDING_SETS)) for (const e of set) s.add(e.kind);
  return [...s];
};

// Elementtypen (Gelände) mit Anzeigenamen
export const ELEMENT_TYPES = {
  hill: 'Hügel/Senke', flat: 'Ebene', water: 'See/Wasser', river: 'Fluss', road: 'Weg', forest: 'Wald', treeline: 'Baumreihe',
  field: 'Feld', village: 'Siedlung', building: 'Gebäude', bridge: 'Brücke/Furt',
};

// ---------- Einheiten-Palette (Epoche/Fraktion) ----------
const RU_BASE = new Set(['t72', 't90', 'bmp', 'btr', 'truck', 'msta', 'pantsir', 's400', 's400radar', 'orlan', 'lancet', 'shahed', 'ka52']);
const HIDDEN_UNITS = (k, t) => k === 'house' || k.startsWith('cp_') || t.cp || t.bridge || /(^|_)crew$/.test(k) || t.hidden;
export function unitFaction(k, t = UNIT_TYPES[k]) {
  if (!t) return '-';
  if (t.faction) return t.faction;
  if (t.structure && !t.weapons?.length) return 'ALL';
  if (k.startsWith('e_') || k.startsWith('ru_') || RU_BASE.has(k)) return 'RU';
  return 'UA';
}
export const FACTION_NAMES = { UA: 'Ukraine', RU: 'Russland', US: 'USA', UK: 'Großbritannien', SU: 'Sowjetunion', DE: 'Deutschland', BW: 'Bundeswehr', TAL: 'Taliban', SA: 'Sowjetarmee', MUJ: 'Mudschaheddin', ALL: 'Neutral/Bauwerke' };
export function unitPalette({ era = 'modern', faction = 'all' } = {}) {
  const out = [];
  for (const [k, t] of Object.entries(UNIT_TYPES)) {
    if (HIDDEN_UNITS(k, t)) continue;
    if (era !== 'all' && (t.era || 'modern') !== era) continue;
    const f = unitFaction(k, t);
    if (faction !== 'all' && f !== faction) continue;
    out.push({ key: k, name: t.name || k, faction: f, cls: t.cls, era: t.era || 'modern' });
  }
  const order = { inf: 0, veh: 1, air: 2, naval: 3, struct: 4 };
  out.sort((a, b) => (order[a.cls] ?? 9) - (order[b.cls] ?? 9) || a.name.localeCompare(b.name, 'de'));
  return out;
}
export function eraFactions(era) {
  const s = new Set();
  for (const [k, t] of Object.entries(UNIT_TYPES)) { if (HIDDEN_UNITS(k, t)) continue; if (era === 'all' || (t.era || 'modern') === era) s.add(unitFaction(k, t)); }
  return [...s];
}
export function isPlaceableUnit(k) { const t = UNIT_TYPES[k]; return !!t && Object.prototype.hasOwnProperty.call(UNIT_TYPES, k) && !HIDDEN_UNITS(k, t); }

// ---------- Hilfen ----------
const num = (v, lo, hi, def) => { const n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN); if (!Number.isFinite(n)) return def; return Math.min(hi, Math.max(lo, n)); };
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;
const str = (v, max, def = '') => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, max) : def);
const oneOf = (v, obj, def) => (typeof v === 'string' && Object.prototype.hasOwnProperty.call(obj, v) ? v : def);
const inList = (v, list, def) => (typeof v === 'string' && list.includes(v) ? v : def);
const isObj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
export const escapeHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const LIMITS = { elements: 600, units: 600, points: 24, zones: 12, objectives: 8, pts: 200, textTitle: 80, textAuthor: 60, textDesc: 600, textBrief: 4000 };

export function newMap(opts = {}) {
  const now = new Date().toISOString().slice(0, 19);
  return sanitizeMap({
    format: FORMAT, version: VERSION,
    meta: { title: opts.title || 'Neue Karte', author: opts.author || '', era: opts.era || 'modern', description: '', created: now, modified: now },
    map: { size: opts.size || 260, seed: opts.seed || (Math.floor(Math.random() * 99999) + 1), season: opts.season || 'summer', night: !!opts.night, relief: 4, scatterTrees: 30 },
    player: 'UA', briefing: '', elements: [], units: [], points: [], zones: [], objectives: [{ id: 'o1', kind: 'annihilate' }], nextId: 2,
  }).map;
}

// Prüft/normalisiert eine Karte. Rückgabe { ok, map, warnings[], errors[] }.
// Fehler (errors) nur bei völlig unbrauchbarer Eingabe; sonst wird repariert und gewarnt.
export function sanitizeMap(raw, { source = 'Karte' } = {}) {
  const warnings = [], errors = [];
  if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch (e) { return { ok: false, map: null, warnings, errors: [`${source}: kein gültiges JSON (${e.message})`] }; } }
  if (!isObj(raw)) return { ok: false, map: null, warnings, errors: [`${source}: Objekt erwartet`] };
  if (raw.format !== undefined && raw.format !== FORMAT) return { ok: false, map: null, warnings, errors: [`${source}: unbekanntes Format „${str(raw.format, 40)}"`] };
  const ver = num(raw.version, 0, 999, VERSION);
  if (ver > VERSION) warnings.push(`${source}: Version ${ver} ist neuer als ${VERSION} – unbekannte Felder werden ignoriert.`);
  const codeHit = findCodeField(raw);
  if (codeHit) return { ok: false, map: null, warnings, errors: [`${source}: Feld „${codeHit}" sieht nach ausführbarem Code aus – abgewiesen.`] };

  const M = isObj(raw.map) ? raw.map : {};
  const size = MAP_SIZE_OPTIONS.reduce((best, s) => (Math.abs(s - num(M.size, 100, 2000, 260)) < Math.abs(best - num(M.size, 100, 2000, 260)) ? s : best), 260);
  if (M.size !== undefined && num(M.size, 0, 1e9, 0) !== size) warnings.push(`Kartengröße auf ${size} m angepasst.`);
  const half = size / 2 - 2;
  const P = (p) => (Array.isArray(p) && p.length >= 2 ? [r1(num(p[0], -half, half, 0)), r1(num(p[1], -half, half, 0))] : null);
  const pts = (arr, min) => { if (!Array.isArray(arr)) return null; const o = arr.slice(0, LIMITS.pts).map(P).filter(Boolean); return o.length >= min ? o : null; };
  const X = (v) => r1(num(v, -half, half, 0));

  const meta0 = isObj(raw.meta) ? raw.meta : {};
  const meta = {
    title: str(meta0.title, LIMITS.textTitle, 'Ohne Titel').trim() || 'Ohne Titel',
    author: str(meta0.author, LIMITS.textAuthor).trim(),
    era: oneOf(meta0.era, ERAS, 'modern'),
    description: str(meta0.description, LIMITS.textDesc),
    created: str(meta0.created, 32), modified: str(meta0.modified, 32),
  };
  const map = {
    size, seed: Math.floor(num(M.seed, 1, 999999, 1)), season: oneOf(M.season, SEASONS, 'summer'), night: M.night === true,
    relief: r1(num(M.relief, 0, 14, 4)), scatterTrees: Math.round(num(M.scatterTrees, 0, 400, 30)),
  };
  const ids = new Set();
  let maxId = 0;
  const takeId = (v) => {
    let id = typeof v === 'string' && /^[a-z]{0,3}\d{1,6}$/.test(v) ? v : null;
    if (!id || ids.has(id)) id = null;
    if (id) { const n = +id.replace(/^\D+/, ''); if (n > maxId) maxId = n; ids.add(id); }
    return id;
  };
  const kinds = ALL_BUILDING_KINDS();
  const elements = [];
  const rawEl = Array.isArray(raw.elements) ? raw.elements : [];
  if (rawEl.length > LIMITS.elements) warnings.push(`Zu viele Gelände-Elemente (${rawEl.length}) – auf ${LIMITS.elements} gekürzt.`);
  const pend = [];
  for (const e of rawEl.slice(0, LIMITS.elements)) {
    if (!isObj(e) || !Object.prototype.hasOwnProperty.call(ELEMENT_TYPES, e.type)) { warnings.push(`Unbekanntes Element verworfen (${str(e?.type, 20) || '?'}).`); continue; }
    let o = null;
    switch (e.type) {
      case 'hill': o = { type: 'hill', x: X(e.x), z: X(e.z), r: r1(num(e.r, 4, 160, 30)), h: r1(num(e.h, -12, 30, 5)) }; break;
      case 'flat': o = { type: 'flat', x: X(e.x), z: X(e.z), r: r1(num(e.r, 4, 160, 25)), h: r1(num(e.h, -6, 30, 3)) }; break;
      case 'water': { const p = pts(e.poly, 3); if (p) o = { type: 'water', poly: p, depth: r1(num(e.depth, 1, 12, 5)) }; break; }
      case 'river': { const p = pts(e.pts, 2); if (p) o = { type: 'river', pts: p, width: r1(num(e.width, 4, 60, 14)), depth: r1(num(e.depth, 1, 8, 3)) }; break; }
      case 'road': { const p = pts(e.pts, 2); const kind = oneOf(e.kind, ROAD_KINDS, 'road'); if (p) o = { type: 'road', kind, pts: p, width: r1(num(e.width, 2, 14, kind === 'road' ? 7 : 4)) }; break; }
      case 'forest': {
        const kind = oneOf(e.kind, FOREST_KINDS, 'mixed'), density = r2(num(e.density, 0.005, 0.12, 0.05));
        const p = pts(e.poly, 3);
        if (p) o = { type: 'forest', poly: p, kind, density };
        else if (e.x !== undefined) o = { type: 'forest', x: X(e.x), z: X(e.z), r: r1(num(e.r, 4, 120, 22)), kind, density };
        break;
      }
      case 'treeline': { const p = pts(e.pts, 2); if (p) o = { type: 'treeline', pts: p }; break; }
      case 'field': { const p = pts(e.poly, 3); if (p) o = { type: 'field', poly: p, crop: oneOf(e.crop, CROPS, 'wheat'), angle: r2(num(e.angle, -7, 7, 0)) }; break; }
      case 'village': o = { type: 'village', x: X(e.x), z: X(e.z), r: r1(num(e.r, 8, 90, 30)), houses: Math.round(num(e.houses, 1, 60, 10)), set: oneOf(e.set, BUILDING_SETS, ERA_SET[meta.era]), urban: e.urban === true, style: oneOf(e.style, SETTLEMENT_STYLES, 'simple') }; break;
      case 'building': {
        const kind = inList(e.kind, kinds, 'cottage'), dd = buildingDims(kind);
        o = { type: 'building', x: X(e.x), z: X(e.z), rot: r2(num(e.rot, -7, 7, 0)), kind, w: r1(num(e.w, 2, 40, dd.w)), d: r1(num(e.d, 2, 40, dd.d)), floors: Math.round(num(e.floors, 1, 16, dd.floors)) };
        break;
      }
      case 'bridge': { const p = pts(e.pts, 2); if (p) o = { type: 'bridge', kind: e.kind === 'ford' ? 'ford' : 'bridge', pts: p.slice(0, 2), width: r1(num(e.width, 3, 16, 7)) }; break; }
    }
    if (!o) { warnings.push(`Element ${ELEMENT_TYPES[e.type]} ohne gültige Geometrie verworfen.`); continue; }
    pend.push([o, e.id]);
  }
  const units = [], points = [], zones = [], objectives = [];
  const rawU = Array.isArray(raw.units) ? raw.units : [];
  if (rawU.length > LIMITS.units) warnings.push(`Zu viele Einheiten (${rawU.length}) – auf ${LIMITS.units} gekürzt.`);
  const pendU = [];
  let unknownTypes = 0;
  for (const u of rawU.slice(0, LIMITS.units)) {
    if (!isObj(u)) continue;
    if (!isPlaceableUnit(u.type)) { unknownTypes++; continue; }
    pendU.push([{ type: u.type, team: u.team === 'RU' ? 'RU' : 'UA', x: X(u.x), z: X(u.z), heading: r2(num(u.heading, -7, 7, 0)), ai: oneOf(u.ai, AI_MODES, 'guard'), target: u.target === true }, u.id]);
  }
  if (unknownTypes) warnings.push(`${unknownTypes} Einheit(en) mit unbekanntem Typ verworfen.`);
  const pendP = [];
  for (const p of (Array.isArray(raw.points) ? raw.points : []).slice(0, LIMITS.points)) {
    if (!isObj(p)) continue;
    const kind = oneOf(p.kind, CP_KINDS, 'zeppelin');
    pendP.push([{ kind, x: X(p.x), z: X(p.z), name: str(p.name, 40).trim() || CP_KINDS[kind], value: Math.round(num(p.value, 1, 5, kind === 'zeppelin' ? 3 : 1)), radius: r1(num(p.radius, 8, 40, CP_DEFAULT_R[kind])) }, p.id]);
  }
  const pendZ = [];
  for (const z of (Array.isArray(raw.zones) ? raw.zones : []).slice(0, LIMITS.zones)) {
    if (!isObj(z)) continue;
    pendZ.push([{ team: z.team === 'RU' ? 'RU' : 'UA', x: X(z.x), z: X(z.z), r: r1(num(z.r, 8, 60, 22)) }, z.id]);
  }
  const pendO = [];
  const seenKind = new Set();
  for (const o of (Array.isArray(raw.objectives) ? raw.objectives : []).slice(0, LIMITS.objectives)) {
    if (!isObj(o) || !Object.prototype.hasOwnProperty.call(OBJECTIVE_KINDS, o.kind)) continue;
    if (o.kind !== 'hold' && seenKind.has(o.kind)) continue;
    seenKind.add(o.kind);
    let q = { kind: o.kind };
    if (o.kind === 'hold') q = { kind: 'hold', x: X(o.x), z: X(o.z), r: r1(num(o.r, 8, 80, 25)), minutes: r1(num(o.minutes, 0.5, 60, 3)) };
    if (o.kind === 'timelimit') q = { kind: 'timelimit', minutes: r1(num(o.minutes, 1, 180, 20)) };
    pendO.push([q, o.id]);
  }
  // IDs: erst gültige übernehmen, dann fehlende vergeben (stabil → idempotent)
  const all = [...pend, ...pendU, ...pendP, ...pendZ, ...pendO];
  for (const it of all) it[2] = takeId(it[1]);
  const prefix = (o) => (pendU.includes(o) ? 'u' : pendP.includes(o) ? 'p' : pendZ.includes(o) ? 'z' : pendO.includes(o) ? 'o' : 'e');
  let next = Math.max(maxId + 1, Math.floor(num(raw.nextId, 1, 1e6, 1)));
  for (const it of all) if (!it[2]) { const id = prefix(it) + next++; ids.add(id); it[2] = id; }
  for (const [o, , id] of pend) elements.push({ id, ...o });
  for (const [o, , id] of pendU) units.push({ id, ...o });
  for (const [o, , id] of pendP) points.push({ id, ...o });
  for (const [o, , id] of pendZ) zones.push({ id, ...o });
  for (const [o, , id] of pendO) objectives.push({ id, ...o });
  const out = {
    format: FORMAT, version: VERSION, meta, map,
    player: raw.player === 'RU' ? 'RU' : 'UA',
    briefing: str(raw.briefing, LIMITS.textBrief),
    elements, units, points, zones, objectives, nextId: next,
  };
  return { ok: errors.length === 0, map: out, warnings, errors };
}

// Felder, die nach Code aussehen (Mods/Karten dürfen keinen Code enthalten): Funktionsnamen der Missions-API
// oder Werte wie "function(", "=>", "<script". Rückgabe: Pfad des ersten Treffers oder null.
const CODE_KEYS = new Set(['setup', 'update', 'onkill', 'onspawn', 'onremove', 'script', 'code', 'js', 'javascript', 'eval', 'function', 'exec', 'html', 'onload', 'onclick', 'handler', 'callback']);
const CODE_RE = /(\bfunction\s*\*?\s*\w*\s*\(|\(\s*\w*\s*\)\s*=>|<\s*script|javascript\s*:|\beval\s*\(|\bnew\s+Function\b|\bimport\s*\(|\brequire\s*\(|<\s*\w+[^>]*\son\w+\s*=)/i;
export function findCodeField(o, path = '', depth = 0, budget = { n: 0 }) {
  if (depth > 12 || ++budget.n > 200000) return path || '(zu tief verschachtelt)';
  if (typeof o === 'string') return CODE_RE.test(o) ? path || '(Text)' : null;
  if (typeof o === 'function') return path || '(Funktion)';
  if (Array.isArray(o)) { for (let i = 0; i < o.length; i++) { const r = findCodeField(o[i], `${path}[${i}]`, depth + 1, budget); if (r) return r; } return null; }
  if (o && typeof o === 'object') {
    for (const k of Object.keys(o)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') return `${path}.${k}`;
      if (CODE_KEYS.has(k.toLowerCase()) && o[k] !== null && o[k] !== false) return path ? `${path}.${k}` : k;
      const r = findCodeField(o[k], path ? `${path}.${k}` : k, depth + 1, budget);
      if (r) return r;
    }
  }
  return null;
}

// Kanonischer Export (eingerückt, stabile Feldreihenfolge durch sanitizeMap)
export function exportMap(map) { return JSON.stringify(sanitizeMap(map).map, null, 1); }

// Gefecht/Mission-Tauglichkeit
export function mapCapabilities(map) {
  const teams = new Set(map.zones.map((z) => z.team));
  const skirmish = teams.has('UA') && teams.has('RU') && map.points.length > 0;
  const mission = map.units.some((u) => u.team === map.player) && map.units.some((u) => u.team !== map.player);
  const issues = [];
  if (!mission) issues.push('Mission: Einheiten für beide Teams platzieren.');
  if (!skirmish) issues.push('Gefecht: je eine Startzone für Ukraine und Russland sowie mind. einen Eroberungspunkt anlegen.');
  if (map.objectives.some((o) => o.kind === 'destroy') && !map.units.some((u) => u.target && u.team !== map.player)) issues.push('Ziel „Ziel-Einheiten zerstören": keine gegnerische Einheit als Zielobjekt markiert.');
  if (skirmish) {
    const ua = map.zones.filter((z) => z.team === 'UA'), ru = map.zones.filter((z) => z.team === 'RU');
    const avg = (l) => l.reduce((s, z) => s + z.z, 0) / l.length;
    if (avg(ua) < avg(ru)) issues.push('Hinweis Gefecht: Verstärkung rückt vom Kartenrand ein – Ukraine im Süden (+z, unten), Russland im Norden anlegen.');
  }
  return { skirmish, mission, issues };
}
// Kurzer Hash für ids/Caches
export function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
