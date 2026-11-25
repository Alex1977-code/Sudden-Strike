// Gemeinsame Helfer der Grundausbildung (V3-TUT)
import { Tutor } from './_tutor.js';

// Übungsziel / Übungsgegner: Seite „RU“ ist intern die Gegenpartei (Rote Partei der Übung), keine reale Nation.
export function dummy(g, type, x, z, tag, name = 'Übungsziel', hold = true) {
  const u = g.spawn(type, 'RU', x, z, { tags: tag ? [tag] : [], name });
  u.name = name;
  if (hold) { u.holdFire = true; u.fireMode = 'hold'; }
  return u;
}
export const alive = (g, tag) => g.byTag(tag).length;
export const inCircle = (u, x, z, r) => Math.hypot(u.pos.x - x, u.pos.z - z) <= r;
export function ensureSquad(g, t) {
  if (t.own().length) return;
  g.spawnGroup([['rifle', 3]], 'UA', 0, 60, { spacing: 3 });
}
export function runTutor(mission, g, steps, opts) {
  mission._tutor?.destroy();
  mission._tutor = new Tutor(g, mission, steps, { safety: ensureSquad, ...opts });
}
export function tickTutor(mission, g, dt) { mission._tutor?.tick(dt); }
export const AREA = 'Truppenübungsplatz „Heidekamp“';
