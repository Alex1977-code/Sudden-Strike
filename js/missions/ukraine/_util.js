// V3-C1: gemeinsame Helfer der Ukraine-Missionen 6–12 (nur Missionslogik, keine Spieltexte außer Funk-Standardsätzen).
import { ABILITIES } from '../../game/abilities.js';
import { canGarrison } from '../../game/garrison.js';
import { PLACE_BY_ID } from '../../maps/places/index.js';

export const FICTION_NOTE = 'Hinweis: Diese Mission ist ein fiktives Szenario. Ort und Ausgangslage sind angelehnt an reale Gegebenheiten, die Handlung ist erfunden.';

// Kartendefinition einer Ortsvorlage (js/maps/places) mit Überschreibungen (Jahreszeit, Palette …)
export function placeMap(id, over = {}) {
  const p = PLACE_BY_ID[id];
  if (!p) throw new Error('Ortsvorlage fehlt: ' + id);
  return { ...p.map, ...over };
}
export function placeLabel(id) { return PLACE_BY_ID[id]?.label || id; }

export const dist = (a, x, z) => Math.hypot(a.pos.x - x, a.pos.z - z);
export const living = (g, side, f) => g.units.filter((u) => u.alive && u.side === side && (!f || f(u)));
export const near = (g, x, z, r, side, f) => g.units.filter((u) => u.alive && u.side === side && !u.type.structure && Math.hypot(u.pos.x - x, u.pos.z - z) < r && (!f || f(u)));
export const ground = (u) => !u.type.air && !u.type.structure && !u.type.kamikaze;
export const ruPlayer = (g) => g.playersOfTeam('RU')[0] || g.playerById(1);

// Angriffswelle (KI greift entlang der Punkte an)
export function wave(g, list, x, z, points, opts = {}) {
  return g.spawnGroup(list, opts.side || 'RU', x, z, { spacing: opts.spacing || 3.5, cols: opts.cols || 4, tags: opts.tags, heading: opts.heading,
    ai: { mode: 'attackMove', points, aggressive: true, aggroRadius: opts.aggro || 34, after: 'guard' } });
}

// Gleitbombe (Su-34, KAB) des Gegners mit Vorwarnung: Marker + Warnung, Einschlag nach dem Überflug (V3-A m_kab)
export function enemyKab(g, x, z, { warn = 7, text } = {}) {
  if (g.ended) return;
  g.alert(text || '⚠ Su-34 im Anflug – Gleitbombe (KAB)! Markierten Bereich räumen!', 4);
  g.audio?.siren?.();
  const mk = g.effects.marker(x, z, 0xff3030, warn + 6, 15);
  (g.mission.kabZones ||= []).push({ x, z, r: 16, until: g.time + warn + 5 }); // für Tests/Hilfen: aktive Gefahrenzonen
  if (mk?.userData) mk.userData.persistent = true;
  g.later(warn, () => {
    if (g.ended) return;
    const p = ruPlayer(g);
    if (ABILITIES.m_kab && p) { try { ABILITIES.m_kab.exec(g, x, z, p); return; } catch (e) { /* Fallback unten */ } }
    const w = { name: 'KAB-500', dmg: 1400, splash: 13, vs: { soft: 1, light: 1, heavy: 0.9, air: 0, struct: 1 } };
    g.combat.incomingShell(x, z, w, 'RU', 1.5, null, 2.2);
  });
}

// Schwerpunkt der eigenen Bodentruppen in einem Gebiet (Ziel für KAB/Artillerie), null wenn niemand dort ist
export function clusterIn(g, side, x, z, r, f) {
  const us = near(g, x, z, r, side, (u) => ground(u) && (!f || f(u)));
  if (!us.length) return null;
  let sx = 0, sz = 0;
  for (const u of us) { sx += u.pos.x; sz += u.pos.z; }
  return [sx / us.length, sz / us.length, us.length];
}

// Boote mit Insassen setzen im Landebereich automatisch ab (zusätzlich zum Befehl „Absitzen“)
export function autoUnload(g, lz, r, onLand) {
  if (!g.trans) return;
  for (const v of g.units) {
    if (!v.alive || v.side !== 'UA' || !v.type.naval || !v.cargo?.length) continue;
    if (Math.hypot(v.pos.x - lz[0], v.pos.z - lz[1]) > r) continue;
    const out = g.trans.unloadAll(v);
    if (out?.length && onLand) onLand(v, out);
  }
}

// Häuser in der Nähe eines Punktes (besetzbar), nach Abstand sortiert
export function housesNear(g, x, z, r) {
  return g.units.filter((h) => h.alive && h.type.key === 'house' && canGarrison(h) && Math.hypot(h.pos.x - x, h.pos.z - z) < r)
    .sort((a, b) => Math.hypot(a.pos.x - x, a.pos.z - z) - Math.hypot(b.pos.x - x, b.pos.z - z));
}
// Trupp sofort in ein Haus setzen (Missionsstart); optional Hinterhalt
export function garrisonNow(g, units, h, ambush = false) {
  if (!h || !g.gar) return;
  for (const u of units) if (u.alive && u.type.infantry && !u.garrison) g.gar.enter(u, h);
  if (ambush && g.tac) { try { g.command(g.localPlayerId, { t: 'ambush', ids: [h.id], value: true, range: 26 }); } catch (e) { /* ohne Hinterhalt weiter */ } }
}

// Fortschrittszähler im Zieltext „… (n/m)“
export function objCount(g, id, base, n, m) {
  const o = g.objectives.find((q) => q.id === id);
  if (!o) return;
  const t = `${base} (${Math.min(n, m)}/${m})`;
  if (o.text !== t) { o.text = t; g.emit('objectives'); }
}

// Gebiet halten: true, wenn eigene Truppen dort sind und der Gegner nicht überlegen ist (mit Toleranzzeit)
export function overrun(g, st, key, x, z, r, { grace = 12, dt = 0.05, minOwn = 1 } = {}) {
  const own = near(g, x, z, r, 'UA', ground).length, en = near(g, x, z, r, 'RU', ground).length;
  const bad = own < minOwn && en > 0 || en >= Math.max(4, own * 3);
  st[key] = bad ? (st[key] || 0) + dt : 0;
  return st[key] > grace;
}
