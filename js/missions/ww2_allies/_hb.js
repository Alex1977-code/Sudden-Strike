// Zusätzliche Helfer der Westalliierten-Missionen Teil 2 (b1–b5, V3-C3b): knappe Munition, Nachschub, Zonenzähler, Angriffswellen.
import { alive } from './_h.js';

// Munitionsvorrat begrenzen (ohne Logistikmodus sind alle Waffen unbegrenzt): stock = Anteil k des Standardvorrats der Waffe.
// Waffen ohne Vorratsangabe (Granaten, Pistolen) bleiben unbegrenzt. Die HUD-Zeile „Munition“ zeigt den Rest.
export function limitAmmo(units, k = 0.5) {
  for (const u of units) for (const w of u.weapons) {
    if (!w.def.stock) continue;
    w.stockMax = Math.max(12, Math.round(w.def.stock * k)); w.stock = w.stockMax;
  }
}
// Nachschub: füllt die Vorräte der Einheiten wieder auf (frac = Anteil des Maximalvorrats, der dazukommt)
export function refill(units, frac = 0.5) {
  let n = 0;
  for (const u of units) {
    let did = false;
    for (const w of u.weapons) {
      if (w.stockMax === Infinity || w.stock >= w.stockMax) continue;
      w.stock = Math.min(w.stockMax, w.stock + w.stockMax * frac); did = true;
      if (w.def.ammo && w.ammo <= 0) w.reloadT = Math.min(w.reloadT, 1);
    }
    if (did) n++;
  }
  return n;
}
// Mittlerer Munitionsstand (0..1) der eigenen Einheiten mit begrenztem Vorrat
export function ammoLevel(g, side = 'UA') {
  let s = 0, n = 0;
  for (const u of alive(g, side)) for (const w of u.weapons) if (w.stockMax !== Infinity) { s += w.stock / w.stockMax; n++; }
  return n ? s / n : 1;
}
// Kämpfende Bodeneinheiten (ohne Bauwerke/Flugzeuge) im Kreis
export const ground = (g, side, x, z, r) => g.unitsInArea(x, z, r, side).filter((u) => !u.type.structure && !u.type.air);
export const infIn = (g, side, x, z, r) => g.unitsInArea(x, z, r, side).filter((u) => u.type.infantry);
// Angriffswelle der Gegenseite: Gruppe erscheint bei from und greift über die Wegpunkte an (danach Wache)
export function wave(g, list, from, pts, { spacing = 6, cols = 5, tags = ['wave'], msg = null, aggroRadius = 50, after = 'guard' } = {}) {
  if (g.ended) return [];
  if (msg) g.alert(msg, 4);
  return g.spawnGroup(list, 'RU', from[0], from[1], { spacing, cols, heading: Math.atan2(pts[0][0] - from[0], pts[0][1] - from[1]), ai: { mode: 'attackMove', points: pts, aggressive: true, aggroRadius, after }, tags });
}
// Zeitgesteuert: wave() nach delay Sekunden
export const waveAt = (g, delay, ...a) => g.later(delay, () => wave(g, ...a));
