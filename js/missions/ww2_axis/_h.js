// Gemeinsame Helfer der Kampagne „WK2 – Deutsche Seite“ (V3-C5): Einheitenschlüssel, Zielzeilen, Gegner-Luftangriff, Zähler.
// Spielerseite = 'UA' (Wehrmacht-Typen ww2_de_* ohne Symbole), Gegenseite = 'RU' (britische, sowjetische, amerikanische Typen).
import { ABILITIES } from '../../game/abilities.js';

const keys = (tag, o) => Object.fromEntries(['rifle', 'lmg', 'smg', 'at', 'sniper', 'engineer', 'officer', 'medic', 'mortar'].map((k) => [k, `ww2_${tag}_${o[k] || k}`]));
export const de = keys('de', { lmg: 'mg42', smg: 'mp40', at: 'panzer' });
de.fj = 'ww2_de_fj';
export const uk = keys('uk', { lmg: 'bren', smg: 'sten', at: 'piat' });
export const us = keys('us', { lmg: 'bar', smg: 'thompson', at: 'bazooka' });
export const su = keys('su', { lmg: 'dp28', smg: 'ppsh', at: 'ptrd' });

export function setText(g, id, text) {
  const o = g.objectives.find((q) => q.id === id);
  if (o && o.text !== text) { o.text = text; g.emit('objectives'); }
}
export const mmss = (s) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
export const enemyPlayer = (g) => g.players.find((p) => p.team === 'RU');
// Luftangriff der Gegenseite (nur Optik + Bombenwirkung): id = 'ww2_airstrike_us' | 'ww2_airstrike_uk' | 'ww2_airstrike_su'
export function foeStrike(g, id, x, z) {
  if (g.ended) return;
  const p = enemyPlayer(g);
  try { ABILITIES[id].exec(g, x, z, p); } catch (e) { /* ohne Flugzeugmodell: kein Angriff */ }
}
export const alive = (g, side, f) => g.units.filter((u) => u.alive && u.side === side && !u.type.structure && !u.type.air && (!f || f(u)));
export const groups = (g, side, list, opts = {}) => {
  const out = [];
  for (const [x, z, units, o] of list) out.push(...g.spawnGroup(units, side, x, z, { spacing: 4, cols: 5, ...opts, ...(o || {}) }));
  return out;
};
// Fertig gebautes Bauwerk (Schützenloch, MG-Nest, Draht, Minen, Bunker)
export const fort = (g, kind, side, x, z, o = {}) => g.spawn(kind, side, x, z, { build: { progress: 1, time: 0 }, ...o });
// Zone gehalten: Gegner im Radius <= allow, eigene >= need (Einheiten ohne Bauwerke/Flugzeuge)
export const near = (g, side, x, z, r) => g.unitsInArea(x, z, r, side).filter((u) => !u.type.structure && !u.type.air);
// Zone einnehmen: secs Sekunden lang kein Gegner (<= allow) und >= need eigene in r; Zustand in st = { t, done }
export function holdZone(g, dt, st, x, z, r, { need = 2, allow = 0, secs = 6, enemyR } = {}) {
  if (st.done) return true;
  const en = near(g, 'RU', x, z, enemyR ?? r + 4).length, us2 = near(g, 'UA', x, z, r).length;
  if (en <= allow && us2 >= need) { st.t = (st.t || 0) + dt; if (st.t >= secs) st.done = true; } else st.t = Math.max(0, (st.t || 0) - dt * 0.5);
  return st.done;
}
// Pioniere räumen sichtbare Minen und Draht des Gegners, wenn sie direkt davor stehen
export function clearByEngineers(g, dt, side = 'UA') {
  const engs = g.units.filter((u) => u.alive && u.side === side && u.type.engineer && !u.moving && !u.carrier);
  if (!engs.length) return;
  for (const m of g.units) {
    if (!m.alive || !m.type.structure || m.side === side) continue;
    const b = m.type.build;
    if (!b || !(b.mines > 0 || b.blocksInfantry) || !m.seenBy?.[side]) continue;
    const n = engs.filter((e) => Math.hypot(e.pos.x - m.pos.x, e.pos.z - m.pos.z) < 6.5).length;
    if (!n) continue;
    if (b.mines > 0) m.mines = (m.mines ?? b.mines) - n * dt / 2.5;
    else m._cut = (m._cut || 0) + n * dt;
    if ((b.mines > 0 && m.mines <= 0.0001) || (m._cut || 0) >= 4) { g.effects.explosion(m.pos.x, m.pos.y + 0.2, m.pos.z, 0.35, { crater: false }); g.logi.removeBuilding(m); g.emit('mineCleared', m); }
  }
}
// Angriffsgruppe der Gegenseite
export const wave = (g, list, x, z, points, o = {}) => g.spawnGroup(list, 'RU', x, z, { spacing: o.spacing || 6, cols: o.cols || 5, tags: o.tags, ai: { mode: 'attackMove', points, after: o.after || 'guard', aggressive: true, aggroRadius: o.aggro || 40 } });
// Eigene Verstärkung (ohne KI, Spieler führt sie) mit Marker
export function reinforce(g, list, x, z, o = {}) {
  const u = g.spawnGroup(list, 'UA', x, z, { spacing: o.spacing || 4, cols: o.cols || 5, heading: o.heading, tags: o.tags });
  g.markerTo?.('UA', x, z, 0x5db8ff, 8, 14);
  return u;
}
