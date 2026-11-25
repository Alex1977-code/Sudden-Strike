// Kampagnen-Registry (V3-MENU): datengetriebene Kampagnen, Fortschritt je Kampagne, Kartenskizzen und Titelmotive.
//
// ===================================== API =====================================
//   registerCampaign(def)            → registriert bzw. ergänzt (gleiche id = Felder werden zusammengeführt) eine Kampagne
//       def = { id, era: 'modern'|'afghan'|'ww2'|'tutorial', faction, title, subtitle, years, desc, accent (CSS-Farbe),
//               order (Sortierung, klein = vorne), missions: [missionObj, ...], art? (Titelmotiv, s. u.) }
//   addMissions(id, missions)        → hängt Missionen an eine registrierte Kampagne an
//   getCampaigns({ era })            → alle Kampagnen (nach order sortiert), optional nach Epoche gefiltert
//   getCampaign(id)                  → Kampagne oder null
//   findMission(missionOrId)         → { campaign, index } oder null (Objekt-Identität oder mission.id)
//   getProgress(id)                  → { unlocked, done: { [missionId]: { time, kills, lost, shots, medal? } }, completed, total }
//   isUnlocked(id, index) / isDone(id, index)
//   completeMission(id, index, result) → speichert das Ergebnis, schaltet die nächste Mission frei
//   resetProgress(id?)               → Fortschritt einer (ohne id: aller) Kampagne(n) löschen
//   setUnlockAll(bool)               → Testmodus (?unlock=all), nicht gespeichert
//   nextMission(id)                  → Index der ersten freien, nicht abgeschlossenen Mission (oder letzte freie)
//   lastPlayed() / setLastPlayed(id) → zuletzt gewählte Kampagne (für „Fortsetzen“ im Hauptmenü)
//   drawMapSketch(canvas, map, opts) → schnelle Kartenskizze aus der Map-Definition (Wasser, Straßen, Wald, Orte)
//   campaignArtSVG(campaign)         → SVG-Titelmotiv (Himmel, Gelände, Silhouetten) aus campaign.art bzw. Epochen-Vorgabe
//   DIFFICULTY = { 1: 'Leicht', 2: 'Mittel', 3: 'Schwer' }, ERAS = { id: { label } }
//
// Missionsobjekte (zusätzlich zu den bisherigen Feldern id, title, place, date, briefing, objectivesPreview, forces, map, …):
//   era ('modern'|'afghan'|'ww2'; ohne Angabe die Epoche der Kampagne), date, place, difficulty (1–3),
//   summary (Kurztext für die Missionsliste; sonst erster Briefing-Satz), fictional: true (Badge „fiktiv“),
//   weather (optional, Text für die Briefing-Zeile; sonst aus env abgeleitet).
//
// Folgeagenten – neue Kampagne füllen:
//   // js/missions/afghan_isaf/index.js
//   import { registerCampaign } from '../campaigns.js';
//   import m1 from './m1_xyz.js';
//   registerCampaign({ id: 'afghan-isaf', missions: [m1, ...] });   // Titel/Text/Farbe sind schon als Platzhalter gesetzt
//   … und in js/missions/index.js eine Zeile ergänzen:  import './afghan_isaf/index.js';
// Vorhandene IDs: tutorial, ukraine, afghan-isaf, afghan-soviet, ww2-allies, ww2-soviet, ww2-axis.
// Starten aus Code/Tests: window.__startMission(campaignId, index); window.__start(i) startet weiterhin Ukraine-Mission i.
//
// Fortschritt: localStorage 'steppensturm.campaigns.v1' = { [campaignId]: { unlocked, done }, _last }; der alte
// Ukraine-Fortschritt ('steppensturm.progress.v1') wird beim ersten Laden übernommen.
//
// Titelmotiv (optional, def.art): { sky: [oben, unten], sun: { x, y, r, color } | null, ground: Farbe, far: Farbe,
//   terrain: 'steppe'|'mountains'|'coast'|'forest'|'snow'|'range'|'desert', ink: Silhouettenfarbe,
//   sil: [[form, x, grundlinieY, skalierung, spiegeln?], …] } – Formen: tank, tank_ww2, heli, plane, jet, drone, truck,
//   pylon, tree, birch, soldier, target. Bildraster 400×225.

const STORE_KEY = 'steppensturm.campaigns.v1';
const LEGACY_UKRAINE_KEY = 'steppensturm.progress.v1';

export const DIFFICULTY = { 1: 'Leicht', 2: 'Mittel', 3: 'Schwer' };
export const ERAS = {
  tutorial: { label: 'Ausbildung' },
  modern: { label: 'Gegenwart' },
  afghan: { label: 'Afghanistan' },
  ww2: { label: 'Zweiter Weltkrieg' },
};

const registry = new Map();
let unlockAll = false;
let store = null;

function loadStore() {
  if (store) return store;
  store = {};
  try { Object.assign(store, JSON.parse(localStorage.getItem(STORE_KEY) || '{}')); } catch (e) { /* ignorieren */ }
  if (!store.ukraine) {
    try {
      const old = JSON.parse(localStorage.getItem(LEGACY_UKRAINE_KEY) || 'null');
      if (old && typeof old === 'object') { store.ukraine = { unlocked: Math.max(1, +old.unlocked || 1), done: old.done || {} }; saveStore(); }
    } catch (e) { /* ignorieren */ }
  }
  return store;
}
function saveStore() { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* ignorieren */ } }

function normalizeMission(c, m, i) {
  if (!m || typeof m !== 'object') return m;
  if (!m.era && c.era && c.era !== 'tutorial') m.era = c.era;
  m.difficulty = Math.min(3, Math.max(1, Math.round(+m.difficulty || 2)));
  m.campaignId = c.id;
  m.campaignIndex = i;
  return m;
}
function normalize(c) {
  c.missions = (c.missions || []).filter(Boolean);
  c.missions.forEach((m, i) => normalizeMission(c, m, i));
  return c;
}

export function registerCampaign(def) {
  if (!def || !def.id) throw new Error('registerCampaign: id fehlt');
  const prev = registry.get(def.id);
  // Platzhalter-Registrierung (missions: []) darf bereits eingetragene Missionen nicht überschreiben (Importreihenfolge)
  if (prev && Array.isArray(def.missions) && !def.missions.length && prev.missions?.length) { def = { ...def }; delete def.missions; }
  // V3-C1: ebenso eine Teilliste (z. B. Ukraine m1–m5 aus index.js), deren Missionen alle schon enthalten sind
  else if (prev && Array.isArray(def.missions) && prev.missions?.length > def.missions.length && def.missions.every((m) => prev.missions.some((x) => x === m || (m?.id && x.id === m.id)))) { def = { ...def }; delete def.missions; }
  // Platzhalter (placeholder: true, aus missions/index.js) ergänzen nur Felder, die keine Kampagnendatei ausdrücklich gesetzt hat –
  // unabhängig von der Importreihenfolge (Kampagnenordner werden vor den Platzhaltern ausgewertet).
  if (def.placeholder) {
    def = { ...def }; delete def.placeholder;
    if (prev) { for (const k of Object.keys(def)) if (!prev._explicit?.has(k)) prev[k] = def[k]; registry.set(prev.id, normalize(prev)); return prev; }
  } else if (prev || def) {
    const ex = (prev && prev._explicit) || new Set();
    for (const k of Object.keys(def)) ex.add(k);
    def = { ...def, _explicit: ex };
  }
  const c = prev ? Object.assign(prev, def) : { era: 'modern', faction: '', title: def.id, subtitle: '', years: '', desc: '', accent: '#c8a84b', order: 100, missions: [], ...def };
  registry.set(c.id, normalize(c));
  return c;
}
export function addMissions(id, missions) {
  const c = registry.get(id);
  if (!c) throw new Error('addMissions: unbekannte Kampagne ' + id);
  c.missions.push(...(missions || []));
  return normalize(c);
}
export function getCampaigns({ era } = {}) {
  return [...registry.values()].filter((c) => !era || c.era === era).sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
}
export function getCampaign(id) { return registry.get(id) || null; }
export function findMission(m) {
  if (!m) return null;
  for (const c of registry.values()) {
    const i = c.missions.findIndex((x) => x === m || (typeof m === 'string' ? x.id === m : false));
    if (i >= 0) return { campaign: c, index: i };
  }
  if (typeof m === 'object' && m.id) for (const c of registry.values()) { const i = c.missions.findIndex((x) => x.id === m.id); if (i >= 0) return { campaign: c, index: i }; }
  return null;
}
export function getProgress(id) {
  const s = loadStore();
  const c = registry.get(id);
  const p = s[id] || { unlocked: 1, done: {} };
  const total = c ? c.missions.length : 0;
  const completed = c ? c.missions.filter((m) => p.done && p.done[m.id]).length : 0;
  return { unlocked: unlockAll ? Math.max(total, 1) : Math.max(1, p.unlocked || 1), done: p.done || {}, completed, total };
}
export function isUnlocked(id, index) { return index < getProgress(id).unlocked; }
export function isDone(id, index) { const c = registry.get(id); const m = c?.missions[index]; return !!(m && getProgress(id).done[m.id]); }
export function completeMission(id, index, result = {}) {
  const c = registry.get(id); const m = c?.missions[index];
  if (!m) return;
  const s = loadStore();
  const p = s[id] || (s[id] = { unlocked: 1, done: {} });
  p.done ||= {};
  const prev = p.done[m.id];
  const r = { time: Math.round(result.time || 0), kills: result.kills | 0, lost: result.lost | 0, shots: result.shots | 0, ...(result.medal ? { medal: result.medal } : {}), ...(result.level ? { level: result.level } : {}) };
  // Bestwert behalten: schnellere Zeit bzw. bessere Medaille gewinnt (V3-X: die beste Medaille bleibt erhalten)
  const MR = { bronze: 1, silver: 2, gold: 3 }, best = (a, b) => ((MR[a] || 0) >= (MR[b] || 0) ? a : b);
  if (!prev || !prev.time || (r.time && r.time < prev.time)) { p.done[m.id] = { ...prev, ...r }; if (prev?.medal) p.done[m.id].medal = best(prev.medal, r.medal); }
  else if (r.medal) p.done[m.id] = { ...prev, medal: best(prev.medal, r.medal), ...(MR[r.medal] > (MR[prev.medal] || 0) && r.level ? { level: r.level } : {}) };
  p.unlocked = Math.max(p.unlocked || 1, index + 2);
  s._last = id;
  saveStore();
}
// V3-X: Schwierigkeitsgrad je Kampagnenfortschritt ('easy'|'normal'|'hard'|'veteran'; ohne Eintrag: Standard aus den Einstellungen)
export function getCampaignLevel(id, fallback = 'normal') { const p = loadStore()[id]; return (p && p.level) || fallback; }
export function setCampaignLevel(id, level) {
  const s = loadStore();
  const p = s[id] || (s[id] = { unlocked: 1, done: {} });
  if (p.level === level) return;
  p.level = level; saveStore();
}
export function resetProgress(id) {
  const s = loadStore();
  if (id) delete s[id]; else for (const k of Object.keys(s)) delete s[k];
  if (!id || id === 'ukraine') { try { localStorage.removeItem(LEGACY_UKRAINE_KEY); } catch (e) { /* ignorieren */ } }
  saveStore();
}
export function setUnlockAll(v) { unlockAll = !!v; }
export function nextMission(id) {
  const c = registry.get(id); if (!c || !c.missions.length) return -1;
  const p = getProgress(id);
  for (let i = 0; i < Math.min(p.unlocked, c.missions.length); i++) if (!p.done[c.missions[i].id]) return i;
  return Math.min(p.unlocked, c.missions.length) - 1;
}
export function lastPlayed() { const s = loadStore(); return s._last && registry.get(s._last) ? s._last : null; }
export function setLastPlayed(id) { const s = loadStore(); if (s._last !== id) { s._last = id; saveStore(); } }

// ============================== Kartenskizze (Canvas) ==============================
// opts: { start: {x,z} (grüner Startpunkt), markers: [{x,z,r,color,label}], grid: true, labels: true,
//         overlayOnly: nur Raster/Markierungen über ein vorhandenes Bild zeichnen }
const GROUND = { summer: '#56663f', autumn: '#6d6138', winter: '#b9c0c4', afghan: '#9c8a64', desert: '#b49c6c' };
export function drawMapSketch(canvas, map, opts = {}) {
  if (!canvas || !map) return;
  const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height, N = map.size || 240;
  const P = (x, z) => [((x + N / 2) / N) * W, ((z + N / 2) / N) * H];
  const sc = W / N;
  const winter = map.season === 'winter';
  ctx.save();
  if (!opts.overlayOnly) {
    ctx.fillStyle = GROUND[map.palette] || GROUND[map.season] || GROUND.summer;
    ctx.fillRect(0, 0, W, H);
  }
  const feats = opts.overlayOnly ? [] : map.features || [];
  const poly = (pts) => { ctx.beginPath(); pts.forEach(([x, z], i) => { const [a, b] = P(x, z); if (i) ctx.lineTo(a, b); else ctx.moveTo(a, b); }); };
  const circ = (f) => { const [a, b] = P(f.x, f.z); ctx.beginPath(); ctx.arc(a, b, Math.max(1.5, (f.r || 10) * sc), 0, Math.PI * 2); };
  const line = (pts, w, col, dash) => { if (!pts || pts.length < 2) return; poly(pts); ctx.lineWidth = Math.max(1, w); ctx.strokeStyle = col; ctx.setLineDash(dash || []); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); ctx.setLineDash([]); };
  const pass = (types, fn) => { for (const f of feats) if (f && types.includes(f.type)) { try { fn(f); } catch (e) { /* defekte Features ignorieren */ } } };
  // Relief: Hügel als weiche Flecken mit Höhenlinie
  pass(['hill', 'flat'], (f) => {
    const [a, b] = P(f.x, f.z), r = Math.max(3, (f.r || 20) * sc);
    const g = ctx.createRadialGradient(a, b, 0, a, b, r);
    g.addColorStop(0, f.type === 'hill' ? 'rgba(255,240,200,.22)' : 'rgba(255,255,255,.08)'); g.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(a, b, r, 0, Math.PI * 2); ctx.fill();
    if (f.type === 'hill') { ctx.strokeStyle = 'rgba(60,40,20,.25)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(a, b, r * 0.62, 0, Math.PI * 2); ctx.stroke(); }
  });
  pass(['field'], (f) => { if (!f.poly) return; poly(f.poly); ctx.closePath(); ctx.fillStyle = winter ? 'rgba(255,255,255,.18)' : f.crop === 'plowed' ? 'rgba(90,60,35,.35)' : 'rgba(205,180,90,.28)'; ctx.fill(); });
  pass(['forest'], (f) => { if (f.poly) { poly(f.poly); ctx.closePath(); } else circ(f); ctx.fillStyle = winter ? 'rgba(70,90,80,.55)' : 'rgba(28,52,26,.72)'; ctx.fill(); });
  pass(['treeline'], (f) => line(f.pts, 2.2 * Math.max(1, sc), winter ? 'rgba(70,90,80,.7)' : 'rgba(28,52,26,.8)', [2, 2]));
  pass(['water'], (f) => { if (!f.poly) return; poly(f.poly); ctx.closePath(); ctx.fillStyle = '#2f5d78'; ctx.fill(); });
  pass(['river'], (f) => line(f.pts, (f.width || 10) * sc, '#2f5d78'));
  pass(['island'], (f) => { circ(f); ctx.fillStyle = GROUND[map.palette] || GROUND[map.season] || GROUND.summer; ctx.fill(); });
  pass(['causeway'], (f) => line(f.pts, (f.width || 8) * sc, '#8c8678'));
  pass(['road'], (f) => {
    if (f.rail) { line(f.pts, 2, '#3a3330'); line(f.pts, 1, '#bdb6a8', [3, 3]); return; }
    line(f.pts, Math.max(1.2, (f.width || 6) * sc * 0.7), f.paved === false ? 'rgba(150,120,80,.9)' : '#d8d1bd');
  });
  const houses = (cx, cz, r, n, seed) => {
    let s = (seed || 7) * 9301 + 49297;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    ctx.fillStyle = 'rgba(110,60,45,.9)';
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * r * 0.85;
      const [x, y] = P(cx + Math.cos(a) * d, cz + Math.sin(a) * d);
      const w = Math.max(1.6, 5 * sc);
      ctx.fillRect(x - w / 2, y - w / 2, w, w);
    }
  };
  pass(['village', 'settlement'], (f) => {
    circ(f); ctx.fillStyle = 'rgba(160,140,120,.28)'; ctx.fill();
    houses(f.x, f.z, f.r || 20, Math.min(40, f.houses || Math.round((f.r || 20) / 2.2)), f.seed || Math.round(f.x * 3 + f.z));
  });
  pass(['house'], (f) => { const [x, y] = P(f.x, f.z); const w = Math.max(2, (f.w || 8) * sc), d = Math.max(2, (f.d || 8) * sc); ctx.fillStyle = 'rgba(110,60,45,.95)'; ctx.fillRect(x - w / 2, y - d / 2, w, d); });
  // Raster mit Planquadraten
  if (opts.grid !== false) {
    ctx.strokeStyle = 'rgba(0,0,0,.22)'; ctx.lineWidth = 1;
    for (let i = 1; i < 6; i++) {
      ctx.beginPath(); ctx.moveTo(Math.round((i * W) / 6) + 0.5, 0); ctx.lineTo(Math.round((i * W) / 6) + 0.5, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, Math.round((i * H) / 6) + 0.5); ctx.lineTo(W, Math.round((i * H) / 6) + 0.5); ctx.stroke();
    }
  }
  const fs = Math.max(9, Math.round(W / 22));
  for (const mk of opts.markers || []) {
    const [x, y] = P(mk.x, mk.z);
    ctx.strokeStyle = mk.color || '#ff6b6b'; ctx.lineWidth = 2; ctx.setLineDash([3, 2]);
    ctx.beginPath(); ctx.arc(x, y, Math.max(5, (mk.r || 10) * sc), 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    if (mk.label && opts.labels !== false) { ctx.font = `600 ${fs}px Inter, system-ui, sans-serif`; ctx.fillStyle = '#fff'; ctx.shadowColor = '#000'; ctx.shadowBlur = 3; ctx.fillText(mk.label, x + 8, y - 6); ctx.shadowBlur = 0; }
  }
  if (opts.start) {
    const [x, y] = P(opts.start.x, opts.start.z);
    ctx.fillStyle = '#5dff8a'; ctx.strokeStyle = '#0b1a10'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, Math.max(4, W / 40), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (opts.labels !== false) { ctx.font = `700 ${fs}px Inter, system-ui, sans-serif`; ctx.fillStyle = '#fff'; ctx.shadowColor = '#000'; ctx.shadowBlur = 3; ctx.fillText(opts.startLabel || 'Start', x + 9, y + 4); ctx.shadowBlur = 0; }
  }
  ctx.restore();
}

// ============================== Titelmotive (SVG) ==============================
const SIL = {
  tank: ['M0 14L6 8H54L60 14L56 20H4Z', 'M18 8L22 2.5H38L42 8Z', 'M40 4.2H64V6H40Z'],
  tank_ww2: ['M0 13L4 7H48L52 13L49 20H3Z', 'M15 7V1.5H31L34 7Z', 'M32 3.2H49V4.8H32Z'],
  heli: ['M10 9Q13 3 25 3.4L35 4.5Q39 6.5 38 10.5L31 13H15Q8 13 10 9Z', 'M35 6L59 5.2V7.2L35 9.5Z', 'M55.5 1L59 1L60.5 8H57.5Z', 'M1 0.6H51V1.7H1Z', 'M24.3 1H26V3.8H24.3Z', 'M12 15.6H33V16.8H12Z', 'M16 13H17V15.6H16ZM28 13H29V15.6H28Z'],
  plane: ['M0 6Q4 3 14 3H44L50 -1H52L50.5 6L44 7.2H12Q3 8 0 6Z', 'M17 5H33L27 9.5H21Z', 'M-1.5 1V11H0V1Z'],
  jet: ['M0 5L30 3L40 -1H42L40 3.8L48 5L40 6.2L42 11H40L30 7Z'],
  drone: ['M0 6L24 0.5L20 6L24 11.5Z', 'M18 6L26 2.5V9.5Z'],
  truck: ['M0 4H30V16H0Z', 'M30 8H40L44 12V16H30Z', 'M2 16H44V18H2Z'],
  pylon: ['|M10 0L3 42M10 0L17 42M0 9H20M2 20H18M5 31H15M3 42L17 20M17 42L3 20'],
  tree: ['M6 0L12 14H8L13 24H-1L4 14H0Z'],
  birch: ['M3 0H5V30H3Z', 'M4 2Q11 8 9 16Q4 20 4 14Q-2 16 -1 9Q0 3 4 2Z'],
  soldier: ['M5 0A2.4 2.4 0 1 1 4.9 0Z', 'M2.5 5H8L9 13H7.5L7 20H5.5L5 14L4.2 20H2.8L2.6 13H1.5Z', 'M7 7L16 4.5L16.3 5.3L8 8.3Z'],
  target: ['|M8 0V30M0 30H16', 'M8 4A6 6 0 1 1 7.9 4Z'],
};
const ART_DEFAULTS = {
  modern: { sky: ['#1b2a3c', '#c9a35a'], sun: { x: 300, y: 128, r: 26, color: '#ffd98a' }, far: '#3c4652', ground: '#2a2a1f', terrain: 'steppe', ink: '#0f1216', sil: [['tank', 52, 186, 1.2], ['drone', 250, 64, 0.9, true], ['pylon', 330, 186, 1.6]] },
  afghan: { sky: ['#2c3b4d', '#d8b07a'], sun: { x: 90, y: 70, r: 20, color: '#fff0c8' }, far: '#7d6a55', ground: '#4b3b2a', terrain: 'mountains', ink: '#1a140f', sil: [['heli', 240, 70, 1.4, true], ['truck', 60, 196, 1.1]] },
  ww2: { sky: ['#2a2f33', '#8f8a74'], sun: { x: 320, y: 70, r: 18, color: '#f3e6c2' }, far: '#4f544a', ground: '#2b2e25', terrain: 'forest', ink: '#121410', sil: [['tank_ww2', 70, 190, 1.4], ['plane', 230, 52, 1.2, true]] },
  tutorial: { sky: ['#1d2a22', '#7f9a6a'], sun: null, far: '#3e5240', ground: '#273326', terrain: 'range', ink: '#0f1510', sil: [['target', 260, 190, 1.2], ['target', 310, 186, 0.9], ['target', 345, 183, 0.7], ['soldier', 60, 200, 1.6]] },
};
function hash(str) { let h = 2166136261; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function ridge(seed, y0, amp, rough, step = 20) {
  let s = seed || 1; const rnd = () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ 0x9e3779b9) >>> 0) / 4294967296;
  let d = `M0 225L0 ${y0}`;
  for (let x = step; x <= 400 + step; x += step) d += `L${x} ${(y0 - rnd() * amp + (rnd() - 0.5) * rough).toFixed(1)}`;
  return d + 'L400 225Z';
}
let artSerial = 0;
export function campaignArtSVG(c) {
  const base = ART_DEFAULTS[c.era] || ART_DEFAULTS.modern;
  const a = { ...base, ...(c.art || {}) };
  const seed = hash(c.id), uid = 'ca' + (seed % 1e6) + '_' + (++artSerial); // eindeutige IDs je Einbettung (Gradienten-Verweise)
  const sky = a.sky || base.sky;
  let terrain = '';
  const far = a.far, gr = a.ground;
  switch (a.terrain) {
    case 'mountains':
      terrain = `<path d="${ridge(seed, 120, 60, 26, 26)}" fill="${far}" opacity=".55"/>` +
        (a.snow ? `<path d="${ridge(seed, 120, 60, 26, 26)}" fill="#fff" opacity=".12" transform="translate(0 -4)"/>` : '') +
        `<path d="${ridge(seed + 7, 150, 44, 22, 22)}" fill="${far}" opacity=".85"/><path d="${ridge(seed + 13, 182, 22, 12, 18)}" fill="${gr}"/>`;
      break;
    case 'coast':
      terrain = `<rect x="0" y="150" width="400" height="75" fill="#2c4a5c" opacity=".85"/><path d="M0 158H400" stroke="#cfe3ea" stroke-opacity=".25"/>` +
        `<path d="M0 225V170L60 162L120 176L170 168L230 186L300 178L400 190V225Z" fill="${gr}"/>`;
      break;
    case 'forest': {
      let trees = '';
      for (let x = -6, i = 0; x < 410; x += 9 + (hash(c.id + i) % 7), i++) { const h = 16 + (hash(c.id + 'h' + i) % 18); trees += `M${x} 168L${x + 6} ${168 - h}L${x + 12} 168Z`; }
      terrain = `<path d="${ridge(seed, 150, 18, 8, 30)}" fill="${far}" opacity=".7"/><path d="${trees}" fill="${far}"/><path d="${ridge(seed + 3, 186, 10, 6, 25)}" fill="${gr}"/>`;
      break;
    }
    case 'snow':
      terrain = `<path d="${ridge(seed, 160, 14, 6, 30)}" fill="${far}" opacity=".7"/><path d="${ridge(seed + 5, 184, 8, 5, 25)}" fill="${gr}"/>` +
        `<path d="M0 200Q120 190 200 198T400 194" stroke="#fff" stroke-opacity=".15" fill="none"/>`;
      break;
    case 'desert':
      terrain = `<path d="M0 225V168Q80 150 170 166T320 160T400 166V225Z" fill="${far}" opacity=".7"/><path d="M0 225V188Q100 176 210 190T400 184V225Z" fill="${gr}"/>`;
      break;
    case 'range':
      terrain = `<path d="${ridge(seed, 160, 12, 6, 40)}" fill="${far}" opacity=".7"/><path d="M0 225V184H400V225Z" fill="${gr}"/>` +
        [0, 1, 2, 3].map((i) => `<path d="M${200 - i * 70} 225L${236 + i * 30} 184" stroke="#fff" stroke-opacity=".08"/>`).join('');
      break;
    default: // steppe
      terrain = `<path d="${ridge(seed, 168, 14, 6, 40)}" fill="${far}" opacity=".6"/><path d="M0 225V182Q140 172 250 180T400 178V225Z" fill="${gr}"/>` +
        [0, 1, 2, 3, 4, 5].map((i) => `<path d="M${-40 + i * 90} 225L${170 + i * 14} 182" stroke="#e8d08a" stroke-opacity=".08"/>`).join('');
  }
  const sil = (a.sil || []).map(([k, x, y, s = 1, flip]) => {
    const parts = SIL[k]; if (!parts) return '';
    const h = k === 'pylon' ? 42 : k === 'birch' ? 30 : k === 'target' ? 30 : k === 'tree' ? 24 : 20;
    const tr = `translate(${x} ${y - h * s}) scale(${flip ? -s : s} ${s})`;
    return `<g transform="${tr}">` + parts.map((p) => (p[0] === '|' ? `<path d="${p.slice(1)}" stroke="${a.ink}" stroke-width="1.6" fill="none"/>` : `<path d="${p}" fill="${a.ink}"/>`)).join('') + '</g>';
  }).join('');
  const sun = a.sun ? `<circle cx="${a.sun.x}" cy="${a.sun.y}" r="${a.sun.r * 2.6}" fill="url(#${uid}g)"/><circle cx="${a.sun.x}" cy="${a.sun.y}" r="${a.sun.r}" fill="${a.sun.color}" opacity=".9"/>` : '';
  // Höhenlinien als Kartenanmutung
  let topo = '';
  for (let i = 0; i < 5; i++) { const cx = 60 + (hash(c.id + 't' + i) % 280), cy = 40 + (hash(c.id + 'u' + i) % 110); topo += `<ellipse cx="${cx}" cy="${cy}" rx="${30 + i * 9}" ry="${16 + i * 5}"/>`; }
  return `<svg class="camp-art-svg" viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
<defs><linearGradient id="${uid}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient>
<radialGradient id="${uid}g"><stop offset="0" stop-color="${a.sun?.color || '#fff'}" stop-opacity=".45"/><stop offset="1" stop-color="${a.sun?.color || '#fff'}" stop-opacity="0"/></radialGradient>
<linearGradient id="${uid}v" x1="0" y1="0" x2="0" y2="1"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></linearGradient></defs>
<rect width="400" height="225" fill="url(#${uid}s)"/>${sun}<g fill="none" stroke="#fff" stroke-opacity=".035">${topo}</g>${terrain}${sil}
<rect width="400" height="225" fill="url(#${uid}v)"/></svg>`;
}
