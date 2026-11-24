// Bausteine für Ortsvorlagen (js/maps/places/<id>.js). Koordinaten in Metern, Norden = −z, Osten = +x.
// Alle Funktionen liefern gewöhnliche Terrain-Features (road, house, causeway, river, water, …).

const r1 = (v) => Math.round(v * 10) / 10;

// Gebäude (Landmarke): kind = Gebäudeart aus models.js (house), rot in rad, Front (Tür) zeigt nach lokal +z
export function bldg(kind, x, z, w, d, rot = 0, floors = 1, name) {
  const f = { type: 'house', kind, x: r1(x), z: r1(z), w, d, rot, floors, style: Math.abs(Math.round(x * 3 + z * 7)) % 4 };
  if (name) f.name = name;
  return f;
}
// Rotation, mit der die Gebäudefront zum Punkt (tx, tz) zeigt
export const faceTo = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);

export const road = (pts, width = 7, paved = true, extra = {}) => ({ type: 'road', pts, width, paved, ...extra });
export const rail = (pts, extra = {}) => ({ type: 'road', pts, width: 5, paved: false, rail: true, ...extra });
// Brücke über Wasser: Fahrbahn + Bauwerk (V3-M2: style 'stone_arch'|'steel_truss'|'concrete_beam'|'cable_arch'|'wood'|'pontoon',
// ohne style nach Epoche; das Bauwerk über dem Wasser baut js/game/mapobjects.js)
export function bridge(pts, width = 9, name, paved = true, style) {
  return [{ type: 'causeway', pts, width: width + 2, name, ...(style ? { style } : {}) }, { type: 'road', pts, width, paved, name }];
}
export const river = (pts, width, extra = {}) => ({ type: 'river', pts, width, ...extra });
export const water = (poly, extra = {}) => ({ type: 'water', poly, ...extra });
export const forest = (poly, kind = 'mixed', density = 0.05) => ({ type: 'forest', poly, kind, density });
export const grove = (x, z, r, kind = 'deciduous', density = 0.05) => ({ type: 'forest', x, z, r, kind, density });
export const hill = (x, z, r, h) => ({ type: 'hill', x, z, r, h });
export const flat = (x, z, r, h) => ({ type: 'flat', x, z, r, h });
export const field = (poly, crop = 'wheat', angle = 0) => ({ type: 'field', poly, crop, angle });
export const treeline = (pts) => ({ type: 'treeline', pts });
export const settlement = (kind, x, z, r, seed, extra = {}) => ({ type: 'settlement', kind, x, z, r, seed, density: 0.6, ...extra });
export const island = (x, z, r, h = 1.5) => ({ type: 'island', x, z, r, h });

// Gebäudereihe entlang einer Strecke a→b (Front zur Seite side = +1 links / −1 rechts der Fahrtrichtung)
export function row(kind, a, b, { w = 8, d = 10, gap = 1, floors = 3, side = 1, setback = 6, name } = {}) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), tx = (b[0] - a[0]) / L, tz = (b[1] - a[1]) / L;
  const nx = -tz * side, nz = tx * side, out = [];
  for (let s = w / 2; s + w / 2 <= L; s += w + gap) {
    const x = a[0] + tx * s + nx * (setback + d / 2), z = a[1] + tz * s + nz * (setback + d / 2);
    out.push(bldg(kind, x, z, w, d, Math.atan2(-nx, -nz), floors, name && out.length === 0 ? name : undefined));
  }
  return out;
}
// Festungs-/Wallring (Kreisbogen) aus Graben (schmales Wasser) und Wallbäumen
export function ring(cx, cz, r, a0, a1, { ditch = 6, n = 14 } = {}) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push([r1(cx + Math.cos(a) * r), r1(cz + Math.sin(a) * r)]); }
  const inner = pts.map(([x, z]) => [r1(cx + (x - cx) * (r - ditch - 5) / r), r1(cz + (z - cz) * (r - ditch - 5) / r)]);
  return [{ type: 'river', pts, width: ditch, depth: 1.6, bank: 2 }, treeline(inner)];
}
// Landmarken aus Features mit name ableiten (ergänzt explizite Liste)
export function landmarksOf(features, extra = []) {
  const seen = new Set(extra.map((l) => l.name));
  const out = [...extra];
  for (const f of features) if (f.type === 'house' && f.name && !seen.has(f.name)) { seen.add(f.name); out.push({ name: f.name, x: f.x, z: f.z }); }
  return out;
}
