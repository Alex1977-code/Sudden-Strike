// Gemeinsame Helfer der Kampagne „Westalliierte“ (V3-C3): Einheitenschlüssel, Zielzeilen, Gegner-Luftangriff, Zähler.
import { ABILITIES } from '../../game/abilities.js';

// Einheitenschlüssel je Seite (Muster ww2_<us|uk|de>_<art>; MG/MP/Panzerabwehr heißen je Nation anders)
const keys = (tag, o) => Object.fromEntries(['rifle', 'lmg', 'smg', 'at', 'sniper', 'engineer', 'officer', 'medic', 'mortar', 'para'].map((k) => [k, `ww2_${tag}_${o[k] || k}`]));
export const us = keys('us', { lmg: 'bar', smg: 'thompson', at: 'bazooka' });
export const uk = keys('uk', { lmg: 'bren', smg: 'sten', at: 'piat' });
export const de = keys('de', { lmg: 'mg42', smg: 'mp40', at: 'panzer', para: 'fj' });
de.fj = 'ww2_de_fj';

// Zeile eines Missionsziels umschreiben (z. B. Zähler, Restzeit)
export function setText(g, id, text) {
  const o = g.objectives.find((q) => q.id === id);
  if (o && o.text !== text) { o.text = text; g.emit('objectives'); }
}
export const mmss = (s) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
export const enemyPlayer = (g) => g.players.find((p) => p.team === 'RU');

// Luftangriff der Gegenseite (nur Optik + Bombenwirkung, Flak der Spielerseite würfelt mit): Ju 87 Stuka im Sturzflug
export function stukaStrike(g, x, z) {
  if (g.ended) return;
  const p = enemyPlayer(g);
  try { ABILITIES.ww2_airstrike_de.exec(g, x, z, p); } catch (e) { /* ohne Flugzeugmodell: kein Angriff */ }
}
// Lebende Einheiten einer Seite (ohne Bauwerke, ohne Flugzeuge), optional gefiltert
export const alive = (g, side, f) => g.units.filter((u) => u.alive && u.side === side && !u.type.structure && !u.type.air && (!f || f(u)));
// Mehrere Gruppen auf einmal; liefert alle Einheiten
export function groups(g, side, list, opts = {}) {
  const out = [];
  for (const [x, z, units, o] of list) out.push(...g.spawnGroup(units, side, x, z, { spacing: 4, cols: 5, ...opts, ...(o || {}) }));
  return out;
}

// Bauwerk (Schützenloch, MG-Nest, Draht, Minen, Bunker) als fertig gebautes Objekt setzen: ohne build.progress zählen Minen,
// Deckung und Drahtsperren im Spiel nicht (logistics.js prüft progress >= 1)
export const fort = (g, kind, side, x, z, o = {}) => g.spawn(kind, side, x, z, { build: { progress: 1, time: 0 }, ...o });

// Pioniere räumen sichtbare Minen und Draht des Gegners, wenn sie direkt davor stehen (ohne Logistikmodus: keine Räumbefehle).
// Je Pionier in 6 m Umkreis laufen 1/2,5 Minen pro Sekunde (Panzerminen/Schützenminen), Draht braucht ca. 4 s.
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
