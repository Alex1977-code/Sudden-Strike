// Modelle der Epoche „modern 2024–2026“ (m_*). Registrierung über registerModel; Bau-Helfer aus MODEL_KIT.
// Vorwärts = +Z. Statische Teile werden von models.js je Transform-Knoten zusammengeführt (Draw-Calls schonen):
// Pro Modell höchstens Rumpf + Turm + Rohr + einige Drehteile als eigene Knoten.
// Kennzeichnung: UA = gelb/blaues Band (iff), RU = weißes Taktikzeichen (Raute) – keine „Z“-Symbole.
import { MODEL_KIT, registerModel } from '../../game/models.js';

const K = MODEL_KIT;
const { THREE, add, box, cyl, sphG, hullGeo, wheel, antenna, headlights, trackSet, iff, truckBase, soldier, quad, fixedWing } = K;

let _x = null;
function X() {
  if (_x) return _x;
  const std = (o) => new THREE.MeshStandardMaterial(o);
  _x = {
    orange: std({ color: 0xe0861e, roughness: 0.6 }),
    card: std({ color: 0xb8a070, roughness: 0.95 }),
    olive: std({ color: 0x4a5230, roughness: 0.85, metalness: 0.2 }),
    bomb: std({ color: 0x3d4430, roughness: 0.7, metalness: 0.3 }),
    pale: std({ color: 0xc7c9c4, roughness: 0.6, metalness: 0.25 }),
    missile: std({ color: 0xd2d4cf, roughness: 0.5, metalness: 0.3 }),
    cage: std({ color: 0x25272a, roughness: 0.6, metalness: 0.7 }),
    era: std({ color: 0x3b4230, roughness: 0.75, metalness: 0.5 }),
    jetGrey: std({ color: 0x7e868c, roughness: 0.45, metalness: 0.5 }),
    jetDark: std({ color: 0x4d555b, roughness: 0.5, metalness: 0.5 }),
  };
  return _x;
}
const camOf = (side) => (side === 'UA' ? K.M.camoUA : K.M.camoRU);
// UA: gelb/blaues Band; RU: weißes Taktikzeichen (Raute)
const mark = (g, side, y, z) => {
  if (side === 'UA') iff(g, side, y, z);
  else box(g, 0.6, 0.04, 0.6, K.M.iffRU, 0, y, z, 0, Math.PI / 4, 0);
};
// Tarnnetz (UA-Artillerie): flache, leicht überhängende Matte
const net = (g, side, w, d, x, y, z) => { if (side === 'UA') box(g, w, 0.05, d, K.M.camoUA, x, y, z); };

function gun(turret, o) {
  const M = K.M;
  const { y = 0.45, z = 1.9, len = 5.2, r = 0.11, sleeve = false, brake = false, x = 0 } = o;
  const barrel = new THREE.Group(); barrel.position.set(x, y, z); turret.add(barrel);
  cyl(barrel, r, r * 1.15, len, M.gunMetal, 0, 0, len / 2, Math.PI / 2, 0, 0, 8);
  if (sleeve) cyl(barrel, r * 1.6, r * 1.6, len * 0.42, M.darkMetal, 0, 0, len * 0.3, Math.PI / 2, 0, 0, 8);
  if (brake) box(barrel, r * 2.8, r * 2.8, 0.55, M.darkMetal, 0, 0, len - 0.3);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, len + 0.1); barrel.add(muzzle);
  return { barrel, muzzle };
}
function hullBase(side, o) {
  const M = K.M, cam = camOf(side), g = new THREE.Group();
  const { L, W, n = 6, hh = 0.9, sf = 0.2, skirt = 'full', y = 1.3 } = o;
  const tx = W / 2 - 0.35;
  for (const s of [-1, 1]) {
    trackSet(g, s, tx, L, { n });
    if (skirt === 'full') box(g, 0.1, 0.55, L * 0.78, cam, s * (tx + 0.52), 1.12, -0.2);
    else if (skirt === 'half') box(g, 0.06, 0.45, L * 0.6, cam, s * (tx + 0.5), 1.15, -0.3);
  }
  add(g, hullGeo(W - 0.6, hh, L, sf, 0.1), cam, 0, y, 0);
  headlights(g, y + 0.3, L / 2 - 0.12, 1.1, 0.2);
  box(g, 2.0, 0.1, 1.8, M.darkMetal, 0, y + 0.48, -L / 2 + 1.2); // Motorraumgitter
  return { g, cam, L, W, tx, M };
}
const grp = (parent, x, y, z) => { const t = new THREE.Group(); t.position.set(x, y, z); parent.add(t); return t; };
function noShadowInf(r, ctx) { if (ctx && (ctx.quality === 'low' || ctx.quality === 'medium')) r.root.traverse((o) => { if (o.isMesh) o.castShadow = false; }); return r; }

// ============================================================ KAMPFPANZER
registerModel('m_abrams', (side) => {
  const { g, cam, L, M } = hullBase(side, { L: 7.9, W: 3.65, n: 7, sf: 0.25 });
  box(g, 0.45, 0.4, 0.5, M.darkMetal, 0.9, 1.9, -L / 2 + 0.6);
  const t = grp(g, 0, 1.75, -0.3);
  add(t, hullGeo(3.0, 0.8, 4.3, 0.55, 0.0), cam, 0, 0.4, 0.3); // flacher, breiter Turm
  box(t, 2.7, 0.7, 1.5, cam, 0, 0.38, -2.3);                    // Turmheck-Bustle
  for (const s of [-1, 1]) {
    box(t, 0.9, 0.75, 1.0, cam, s * 1.15, 0.42, 1.9, 0, s * 0.5, 0); // Frontmodule
    box(t, 0.3, 0.3, 0.7, M.darkMetal, s * 1.55, 0.6, 1.2);          // Nebelwerfer
    antenna(t, s * 1.0, 0.7, -2.7, 2.6, s * 0.06);
  }
  box(t, 0.55, 0.35, 0.7, M.darkMetal, -0.8, 0.88, -0.4); box(t, 0.08, 0.08, 0.8, M.gunMetal, -0.8, 0.96, 0.2); // MG-Station
  cyl(t, 0.4, 0.42, 0.18, cam, 0.75, 0.88, -0.8, 0, 0, 0, 10);
  box(t, 0.5, 0.4, 0.5, M.darkMetal, 0.75, 1.1, -0.8);
  box(t, 0.5, 0.3, 0.4, M.optic, 0.0, 0.85, 1.1);
  const { barrel, muzzle } = gun(t, { y: 0.5, z: 2.3, len: 5.6, r: 0.12 });
  mark(g, side, 1.86, -2.5); mark(t, side, 0.82, -1.9);
  return { root: g, turret: t, barrel, muzzle, height: 3 };
});
registerModel('m_leo1', (side) => {
  const { g, cam, L, M } = hullBase(side, { L: 7.1, W: 3.4, n: 6, sf: 0.2, skirt: 'half' });
  const t = grp(g, 0, 1.75, -0.2);
  add(t, hullGeo(2.5, 0.9, 3.4, 0.4, 0.05), cam, 0, 0.45, 0.1);
  box(t, 2.0, 0.5, 1.0, cam, 0, 0.35, -1.9);
  for (const s of [-1, 1]) { box(t, 0.5, 0.7, 0.6, cam, s * 0.85, 0.5, 1.7, 0, s * 0.5, 0); box(t, 0.3, 0.3, 0.5, M.darkMetal, s * 1.35, 0.6, 0.8); }
  box(t, 0.45, 0.35, 0.5, M.darkMetal, 0.6, 0.98, -0.2); cyl(t, 0.34, 0.36, 0.2, cam, 0.65, 0.95, -0.8, 0, 0, 0, 10);
  box(t, 0.3, 0.3, 0.4, M.darkMetal, -0.7, 0.98, 0.2);
  box(t, 2.0, 0.45, 0.4, M.darkMetal, 0, 0.3, -2.5); // Heckkorb
  const { barrel, muzzle } = gun(t, { y: 0.45, z: 1.7, len: 4.6, r: 0.1, sleeve: true });
  mark(g, side, 1.86, -2.4);
  return { root: g, turret: t, barrel, muzzle, height: 2.9 };
});
function domeTank(side, o) {
  const { g, cam, L, M } = hullBase(side, { L: o.L || 6.9, W: 3.4, n: o.n || 6, sf: 0.18, skirt: o.skirt || 'half' });
  const x = X();
  for (const s of [-1, 1]) {
    if (o.skirtEra) for (let i = 0; i < 6; i++) box(g, 0.12, 0.22, 0.7, x.era, s * (1.35 + 0.52), 1.45, -2.3 + i * 0.85);
    box(g, 0.9, 0.06, 1.2, cam, s * 1.35, 1.32, L / 2 - 0.5, 0.15, 0, 0);
  }
  box(g, 0.45, 0.4, 0.5, M.darkMetal, 0.9, 1.9, -L / 2 + 0.6);
  for (let i = 0; i < 4; i++) box(g, 0.5, 0.14, 0.4, x.era, -0.9 + i * 0.6, 1.7, L / 2 - 1.0, 0.5, 0, 0); // Reaktivpanzerung Wannenfront
  const t = grp(g, 0, 1.75, -0.2);
  const dome = add(t, sphG(1.55, 16, 8), cam, 0, 0, 0); dome.scale.set(1, 0.42, 1.15);
  cyl(t, 1.5, 1.55, 0.25, cam, 0, -0.1, 0, 0, 0, 0, 16);
  const eraN = o.relikt ? 9 : 7;
  for (let i = 0; i < eraN; i++) { const a = -1.0 + i * (2.0 / (eraN - 1)); box(t, o.relikt ? 0.55 : 0.5, o.relikt ? 0.34 : 0.26, 0.38, x.era, Math.sin(a) * 1.38, 0.34, Math.cos(a) * 1.32, 0, a, 0); }
  box(t, 0.4, 0.4, 0.5, M.darkMetal, 0.5, 0.75, -0.4); cyl(t, 0.3, 0.32, 0.18, cam, 0.55, 0.52, -0.5, 0, 0, 0, 10);
  box(t, 0.06, 0.06, 0.5, M.gunMetal, 0.55, 0.95, -0.2);
  for (const s of [-1, 1]) box(t, 0.28, 0.28, 0.5, M.darkMetal, s * 1.3, 0.4, 0.8, 0, s * -0.5, 0);
  antenna(t, -0.9, 0.3, -1.2, 2.2, 0.1);
  if (o.relikt) { box(t, 0.5, 0.3, 0.5, M.darkMetal, -0.55, 0.78, -0.4); for (let i = 0; i < 3; i++) box(g, 0.3, 0.12, 0.5, M.darkMetal, -0.8 + i * 0.8, 1.84, -L / 2 + 1.5); }
  const gn = gun(t, { y: 0.25, z: 1.3, len: 5.1, r: 0.11, sleeve: false });
  cyl(gn.barrel, 0.19, 0.19, 0.9, M.darkMetal, 0, 0, 2.5, Math.PI / 2, 0, 0, 8);
  cyl(gn.barrel, 0.15, 0.15, 0.4, M.darkMetal, 0, 0, 4.4, Math.PI / 2, 0, 0, 8);
  return { g, t, cam, M, x, ...gn, L };
}
registerModel('m_t64', (side) => {
  const r = domeTank(side, { L: 6.8, n: 6, skirt: 'half', skirtEra: true });
  mark(r.g, side, 1.86, -2.2);
  return { root: r.g, turret: r.t, barrel: r.barrel, muzzle: r.muzzle, height: 2.9 };
});
registerModel('m_t80', (side) => {
  const r = domeTank(side, { L: 7.0, n: 6, skirt: 'full', relikt: true, skirtEra: true });
  for (const s of [-1, 1]) box(r.g, 0.14, 0.5, 0.5, r.M.darkMetal, s * 0.7, 2.0, -r.L / 2 - 0.1); // Gasturbinen-Abgas
  mark(r.g, side, 1.86, -2.3);
  return { root: r.g, turret: r.t, barrel: r.barrel, muzzle: r.muzzle, height: 2.9 };
});
// „Schildkröten“-Panzer: T-72B3M mit Käfig über Turm und Wanne (Drohnenschutz)
registerModel('m_turtle', (side) => {
  const r = domeTank(side, { L: 6.9, n: 6, skirt: 'half' });
  const { g, t, M, x } = r, L = r.L;
  // Turmkäfig (dreht mit): Dach + Seitengitter + Frontvisier
  for (let i = 0; i < 8; i++) box(t, 0.06, 0.05, 4.3, x.cage, -1.6 + i * 0.46, 1.2, -0.2);
  for (let i = 0; i < 6; i++) box(t, 3.3, 0.05, 0.06, x.cage, 0, 1.2, -2.2 + i * 0.85);
  for (const s of [-1, 1]) { box(t, 0.05, 0.75, 4.3, x.cage, s * 1.7, 0.82, -0.2); for (let i = 0; i < 5; i++) box(t, 0.05, 0.06, 4.3, x.cage, s * 1.7, 0.55 + i * 0.16, -0.2); }
  box(t, 3.4, 0.7, 0.05, x.cage, 0, 0.85, -2.3);
  box(t, 3.3, 0.05, 1.3, x.cage, 0, 0.95, 2.35, 0.55, 0, 0); // Schrägvisier vorn (Rohr ragt hindurch)
  for (const s of [-1, 1]) box(t, 0.05, 0.75, 1.3, x.cage, s * 1.7, 0.7, 2.0, 0, 0, 0);
  // Wannenkäfig: Dachgitter über Motorraum und Wannenbug
  for (let i = 0; i < 7; i++) { box(g, 0.06, 0.05, 2.6, x.cage, -1.4 + i * 0.47, 2.42, -L / 2 + 1.4); box(g, 0.06, 0.05, 2.0, x.cage, -1.4 + i * 0.47, 2.15, L / 2 - 1.1, -0.35, 0, 0); }
  for (const z of [-L / 2 + 0.2, -L / 2 + 1.5, -L / 2 + 2.7]) box(g, 3.0, 0.05, 0.06, x.cage, 0, 2.42, z);
  for (const s of [-1, 1]) { box(g, 0.05, 0.65, 2.6, x.cage, s * 1.5, 2.1, -L / 2 + 1.4); box(g, 0.06, 0.6, 0.06, x.cage, s * 1.4, 1.95, L / 2 - 1.8); }
  box(g, 3.0, 0.05, 0.06, x.cage, 0, 2.55, L / 2 - 0.35, 0, 0, 0);
  mark(g, side, 1.86, -3.0);
  return { root: g, turret: t, barrel: r.barrel, muzzle: r.muzzle, height: 3.1 };
});

// ============================================================ SCHÜTZEN-/RADPANZER
registerModel('m_cv90', (side) => {
  const M = K.M, cam = camOf(side), g = new THREE.Group();
  const L = 6.9, W = 3.3, tx = W / 2 - 0.3;
  for (const s of [-1, 1]) { trackSet(g, s, tx, L, { w: 0.7, h: 0.9, n: 6, wr: 0.34 }); box(g, 0.1, 0.6, L * 0.8, cam, s * (tx + 0.46), 1.05, 0); }
  add(g, hullGeo(W - 0.4, 1.25, L, 0.45, 0.05), cam, 0, 1.55, 0);
  headlights(g, 1.5, L / 2 - 0.14, 1.1, 0.2);
  box(g, 1.6, 0.1, 1.3, M.darkMetal, 0, 2.2, -2.5);
  const t = grp(g, 0, 2.15, 0.1);
  add(t, hullGeo(2.1, 0.75, 2.6, 0.45, 0.1), cam, 0, 0.4, 0);
  box(t, 1.5, 0.35, 1.0, cam, 0, 0.35, -1.5);
  box(t, 0.45, 0.35, 0.5, M.darkMetal, 0.55, 0.9, -0.3); box(t, 0.3, 0.3, 0.3, M.optic, 0.55, 1.1, -0.1);
  for (const s of [-1, 1]) box(t, 0.25, 0.25, 0.5, M.darkMetal, s * 1.0, 0.5, 0.9);
  antenna(t, -0.7, 0.7, -1.2, 2.2, 0.05);
  const { barrel, muzzle } = gun(t, { y: 0.4, z: 1.2, len: 3.4, r: 0.07 });
  cyl(barrel, 0.12, 0.12, 0.8, M.darkMetal, 0, 0, 0.5, Math.PI / 2, 0, 0, 8);
  mark(g, side, 2.2, -2.0);
  return { root: g, turret: t, barrel, muzzle, height: 2.8 };
});
registerModel('m_marder', (side) => {
  const M = K.M, cam = camOf(side), g = new THREE.Group();
  const L = 6.9, W = 3.25, tx = W / 2 - 0.3;
  for (const s of [-1, 1]) { trackSet(g, s, tx, L, { w: 0.7, h: 0.9, n: 6, wr: 0.34 }); box(g, 0.08, 0.5, L * 0.6, cam, s * (tx + 0.46), 1.0, 0); }
  add(g, hullGeo(W - 0.4, 1.4, L, 0.5, 0.0), cam, 0, 1.6, 0);
  headlights(g, 1.6, L / 2 - 0.14, 1.1, 0.2);
  box(g, 1.4, 0.1, 1.4, M.darkMetal, 0.7, 2.35, -2.5); box(g, 1.2, 0.5, 0.06, cam, 0, 2.1, -L / 2 - 0.02); // Heckklappe
  const t = grp(g, -0.35, 2.3, 0.2);
  add(t, hullGeo(1.9, 0.75, 2.3, 0.3, 0.1), cam, 0, 0.35, 0);
  cyl(t, 0.3, 0.32, 0.16, cam, 0.5, 0.8, -0.5, 0, 0, 0, 8);
  box(t, 0.4, 0.35, 0.4, M.darkMetal, -0.4, 0.8, -0.3);
  box(t, 0.35, 0.3, 0.9, M.darkMetal, 1.15, 0.55, 0.2); cyl(t, 0.09, 0.09, 0.6, M.sand, 1.15, 0.55, 0.85, Math.PI / 2, 0, 0, 6); // Milan
  antenna(t, -0.8, 0.6, -1.0, 2.0, 0.05);
  const { barrel, muzzle } = gun(t, { y: 0.4, z: 1.1, len: 2.6, r: 0.06 });
  mark(g, side, 2.35, -2.2);
  return { root: g, turret: t, barrel, muzzle, height: 2.9 };
});
registerModel('m_bmp3', (side) => {
  const M = K.M, cam = camOf(side), g = new THREE.Group();
  const L = 6.7, W = 3.2, tx = W / 2 - 0.3;
  for (const s of [-1, 1]) { trackSet(g, s, tx, L, { w: 0.7, h: 0.9, n: 6, wr: 0.34 }); box(g, 0.08, 0.5, L * 0.6, cam, s * (tx + 0.46), 1.0, 0); }
  add(g, hullGeo(W - 0.4, 1.15, L, 0.5, 0.05), cam, 0, 1.4, 0);
  headlights(g, 1.4, L / 2 - 0.14, 1.1, 0.2);
  box(g, 1.6, 0.14, 1.3, M.darkMetal, 0, 2.0, -2.5);
  const t = grp(g, 0, 2.0, 0.2);
  const d = add(t, sphG(1.0, 12, 8), cam, 0, 0, 0); d.scale.set(1, 0.55, 1.15);
  cyl(t, 0.14, 0.14, 1.9, M.gunMetal, -0.35, 0.3, 1.05, Math.PI / 2, 0, 0, 8);   // 100-mm-Rohr (starr dargestellt)
  cyl(t, 0.19, 0.19, 0.5, M.darkMetal, -0.35, 0.3, 0.3, Math.PI / 2, 0, 0, 8);
  box(t, 0.4, 0.3, 0.5, M.darkMetal, 0.55, 0.55, -0.2); antenna(t, -0.7, 0.3, -0.7, 2.0, 0.1);
  const { barrel, muzzle } = gun(t, { y: 0.32, z: 0.9, len: 2.3, r: 0.055, x: 0.4 });
  mark(g, side, 2.1, -2.0);
  return { root: g, turret: t, barrel, muzzle, height: 2.8 };
});
function wheeled(g, n, W, r, z0, dz) {
  for (const s of [-1, 1]) for (let i = 0; i < n; i++) wheel(g, r, 0.5, s * (W / 2 - 0.2), r, z0 + i * dz);
}
registerModel('m_stryker', (side) => {
  const M = K.M, cam = camOf(side), g = new THREE.Group(), x = X();
  const L = 6.9, W = 2.9;
  wheeled(g, 4, W, 0.58, -2.4, 1.6);
  box(g, W - 0.5, 0.5, L - 0.6, M.darkMetal, 0, 0.95, 0);
  add(g, hullGeo(W - 0.2, 1.5, L - 0.2, 0.3, 0.0), cam, 0, 1.75, 0);
  headlights(g, 1.55, L / 2 - 0.1, 1.0, 0.2);
  for (const s of [-1, 1]) for (let i = 0; i < 6; i++) box(g, 0.05, 1.3, 0.05, x.cage, s * (W / 2 + 0.28), 1.7, -2.6 + i * 1.0); // Gitterpanzerung
  for (const s of [-1, 1]) box(g, 0.05, 0.05, 6.0, x.cage, s * (W / 2 + 0.28), 2.3, 0);
  for (let i = 0; i < 4; i++) box(g, W + 0.3, 0.05, 0.05, x.cage, 0, 1.2 + i * 0.3, -L / 2 - 0.25);
  const t = grp(g, 0.7, 2.65, 0.4);
  box(t, 0.9, 0.5, 0.9, M.darkMetal, 0, 0.1, 0); box(t, 0.5, 0.35, 0.45, M.optic, 0, 0.42, 0.15);
  const { barrel, muzzle } = gun(t, { y: 0.15, z: 0.4, len: 1.5, r: 0.05 });
  antenna(g, -1.0, 2.4, -2.5, 2.6, 0.06);
  mark(g, side, 2.5, -1.8);
  return { root: g, turret: t, barrel, muzzle, height: 3 };
});
registerModel('m_senator', (side) => {
  const M = K.M, cam = camOf(side), g = new THREE.Group();
  const L = 5.6, W = 2.5;
  wheeled(g, 2, W, 0.62, -1.6, 3.2);
  box(g, W - 0.4, 0.4, L - 0.4, M.darkMetal, 0, 1.0, 0);
  add(g, hullGeo(W - 0.1, 1.2, L, 0.3, 0.0), cam, 0, 1.75, 0);
  box(g, W - 0.3, 0.5, 0.05, M.glass, 0, 2.05, L / 2 - 0.9);
  for (const s of [-1, 1]) { box(g, 0.05, 0.4, 0.8, M.glass, s * (W / 2 + 0.01), 2.1, 0.4); box(g, 0.05, 0.4, 0.8, M.glass, s * (W / 2 + 0.01), 2.1, -1.0); }
  headlights(g, 1.55, L / 2 - 0.05, 0.8, 0.2);
  const t = grp(g, 0, 2.45, -0.3);
  box(t, 0.7, 0.2, 0.7, M.darkMetal, 0, 0.0, 0);
  box(t, 0.9, 0.5, 0.06, M.darkMetal, 0, 0.3, 0.4); // Schutzschild
  const { barrel, muzzle } = gun(t, { y: 0.25, z: 0.3, len: 1.0, r: 0.04 });
  antenna(g, 0.9, 2.3, -2.2, 2.4, 0.06);
  mark(g, side, 2.36, -1.7);
  return { root: g, turret: t, barrel, muzzle, height: 2.8 };
});

// ============================================================ ARTILLERIE
function tracked155(side, o) {
  const r = hullBase(side, { L: o.L, W: 3.4, n: 6, sf: 0.15, skirt: 'full' });
  const { g, cam, M } = r;
  const t = grp(g, 0, 1.95, o.tz ?? -0.4);
  add(t, hullGeo(o.tw, o.th, o.tl, 0.15, 0.0), cam, 0, o.th / 2, 0);
  box(t, o.tw - 0.4, 0.5, 1.2, cam, 0, 0.3, -o.tl / 2 - 0.3);
  cyl(t, 0.3, 0.32, 0.15, cam, 0.8, o.th + 0.05, -0.8, 0, 0, 0, 8);
  box(t, 0.08, 0.08, 0.7, M.gunMetal, -0.8, o.th + 0.15, -0.4);
  antenna(t, -1.0, o.th, -1.6, 2.4, 0.05);
  const gn = gun(t, { y: o.th * 0.55, z: o.tl / 2 - 0.2, len: o.len, r: 0.13, brake: true });
  if (o.sleeve) cyl(gn.barrel, 0.22, 0.22, 2.0, M.darkMetal, 0, 0, o.len * 0.62, Math.PI / 2, 0, 0, 8);
  box(g, 3.0, 0.2, 0.9, M.darkMetal, 0, 1.2, -o.L / 2 - 0.2); // Heckspaten
  net(t, side, 2.6, 1.4, 0, o.th + 0.12, -1.2);
  mark(g, side, 1.86, -o.L / 2 + 0.7);
  return { root: g, turret: t, barrel: gn.barrel, muzzle: gn.muzzle, height: 3.3 };
}
registerModel('m_pzh2000', (side) => tracked155(side, { L: 7.6, tw: 3.3, th: 1.15, tl: 4.4, len: 7.2, sleeve: true }));
registerModel('m_krab', (side) => tracked155(side, { L: 7.4, tw: 3.1, th: 1.2, tl: 4.0, len: 6.8, sleeve: false }));
function truckGun(side, o) {
  const M = K.M, cam = camOf(side);
  const g = truckBase(cam, o.L, 2.6, o.axles);
  const t = grp(g, 0, 1.75, -o.L / 2 + 2.0);
  box(t, 2.2, 0.35, 2.6, M.darkMetal, 0, 0.0, 0);
  box(t, 1.1, 0.7, 1.4, cam, 0, 0.5, -0.3);                      // Wiegenkasten
  if (o.shield) box(t, 2.0, 1.0, 0.1, M.darkMetal, 0, 0.7, 0.7);  // Schutzschild
  const gn = gun(t, { y: 0.8, z: 0.7, len: o.len, r: 0.1, brake: true });
  box(g, 2.4, 0.25, 0.8, M.darkMetal, 0, 1.0, -o.L / 2 - 0.2);   // Erdsporn
  for (const s of [-1, 1]) box(g, 0.5, 0.6, 0.9, M.era, s * 1.0, 1.6, -o.L / 2 + 0.5);
  net(g, side, 2.6, 2.0, 0, 2.3, -o.L / 2 + 1.8);
  mark(g, side, 2.88, o.L / 2 - 1.0);
  return { root: g, turret: t, barrel: gn.barrel, muzzle: gn.muzzle, height: 3.3 };
}
registerModel('m_caesar', (side) => truckGun(side, { L: 9, axles: 3, len: 5.6, shield: false }));
registerModel('m_bohdana', (side) => truckGun(side, { L: 9.6, axles: 4, len: 6.2, shield: true }));
registerModel('m_archer', (side) => {
  const M = K.M, cam = camOf(side);
  const g = truckBase(cam, 10, 2.9, 3);
  const mod = grp(g, 0, 2.3, -1.6);
  add(mod, hullGeo(2.6, 1.1, 4.4, 0.1, 0.0), cam, 0, 0.55, 0);
  const t = grp(g, 0, 3.0, -1.0);
  add(t, hullGeo(2.2, 0.75, 3.0, 0.2, 0.1), cam, 0, 0.35, 0);
  box(t, 0.5, 0.3, 0.6, M.darkMetal, 0.6, 0.85, -0.5);
  const gn = gun(t, { y: 0.4, z: 1.4, len: 6.2, r: 0.12, brake: true });
  box(g, 2.8, 0.25, 0.8, M.darkMetal, 0, 1.0, -5.3);
  mark(g, side, 2.88, 4.0);
  return { root: g, turret: t, barrel: gn.barrel, muzzle: gn.muzzle, height: 3.7 };
});
registerModel('m_2s7', (side) => {
  const { g, cam, L, M } = hullBase(side, { L: 8.2, W: 3.5, n: 7, sf: 0.15, skirt: 'half' });
  const t = grp(g, 0, 1.9, 0.3);
  box(t, 2.0, 0.6, 2.4, cam, 0, 0.3, 0); box(t, 2.4, 0.15, 1.6, M.darkMetal, 0, 0.62, -0.9);
  const gn = gun(t, { y: 0.45, z: 1.0, len: 8.4, r: 0.17, brake: true });
  cyl(gn.barrel, 0.27, 0.27, 2.4, M.darkMetal, 0, 0, 2.2, Math.PI / 2, 0, 0, 8);
  box(g, 3.4, 0.2, 1.1, M.darkMetal, 0, 1.15, -L / 2 - 0.2, 0.25, 0, 0); // Bodensporn
  box(g, 1.6, 0.9, 0.1, M.darkMetal, 0, 2.2, 1.9); // Fahrerhaus
  mark(g, side, 1.86, -3.2);
  return { root: g, turret: t, barrel: gn.barrel, muzzle: gn.muzzle, height: 3.2 };
});
registerModel('m_tos1a', (side) => {
  const { g, cam, L, M } = hullBase(side, { L: 6.9, W: 3.5, n: 6, sf: 0.2, skirt: 'half' });
  box(g, 1.1, 1.0, 1.6, cam, -0.9, 2.2, L / 2 - 1.4); box(g, 0.9, 0.4, 0.05, M.glass, -0.9, 2.45, L / 2 - 0.58); // Kabine links
  const t = grp(g, 0, 1.95, -0.2);
  box(t, 2.4, 0.5, 2.6, cam, 0, 0.25, 0);
  const barrel = grp(t, 0, 1.0, 0.8);
  box(barrel, 2.5, 1.5, 3.6, cam, 0, 0, 0);                         // Werferkasten (24 Rohre)
  for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) cyl(barrel, 0.17, 0.17, 0.5, M.gunMetal, -1.0 + c * 0.4, -0.55 + r * 0.38, 1.85, Math.PI / 2, 0, 0, 8);
  box(barrel, 2.6, 0.08, 3.7, M.darkMetal, 0, 0.78, 0);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, 2.2); barrel.add(muzzle);
  mark(g, side, 1.86, -3.0);
  return { root: g, turret: t, barrel, muzzle, height: 3.4 };
});

// ============================================================ FLUGABWEHR / RAKETENWERFER
registerModel('m_nasams', (side) => {
  const M = K.M, cam = camOf(side);
  const g = truckBase(cam, 9.2, 2.7, 3);
  const t = grp(g, 0, 1.55, -1.6);
  box(t, 2.3, 0.4, 3.4, M.darkMetal, 0, 0, 0);
  const barrel = grp(t, 0, 1.15, 0.9);
  const pod = grp(barrel, 0, 0, 0); pod.rotation.x = -0.45;
  box(pod, 2.2, 1.0, 4.2, cam, 0, 0, 0);
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) cyl(pod, 0.26, 0.26, 0.3, M.missile || M.white, -0.75 + c * 0.75, -0.25 + r * 0.55, 2.2, Math.PI / 2, 0, 0, 8);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.7, 2.6); barrel.add(muzzle);
  net(g, side, 2.4, 1.6, 0, 2.5, 3.0);
  antenna(g, 1.0, 2.9, 2.0, 2.4, 0.04);
  mark(g, side, 2.88, 3.6);
  return { root: g, turret: t, barrel, muzzle, height: 3.9 };
});
registerModel('m_skynex', (side) => {
  const M = K.M, cam = camOf(side);
  const g = truckBase(cam, 8.2, 2.6, 3);
  const t = grp(g, 0, 1.75, -1.8);
  box(t, 1.7, 0.8, 1.7, cam, 0, 0.4, 0);
  const barrel = grp(t, 0, 0.9, 0.4);
  box(barrel, 1.2, 0.5, 1.0, M.darkMetal, 0, 0, 0);
  for (const s of [-1, 1]) { cyl(barrel, 0.08, 0.1, 2.4, M.gunMetal, s * 0.35, 0, 1.4, Math.PI / 2, 0, 0, 8); box(barrel, 0.22, 0.22, 0.4, M.darkMetal, s * 0.35, 0, 2.4); }
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, 2.7); barrel.add(muzzle);
  const radar = grp(g, 0.9, 3.6, -3.0);
  cyl(radar, 0.05, 0.05, 1.5, M.darkMetal, 0, -0.75, 0, 0, 0, 0, 6);
  box(radar, 1.3, 0.8, 0.12, M.grey, 0, 0.1, 0);
  mark(g, side, 2.88, 3.0);
  return { root: g, turret: t, barrel, muzzle, radar, height: 4.2 };
});
function pickupLauncher(side) {
  const M = K.M, cam = camOf(side), g = new THREE.Group();
  const L = 5.2, W = 2.1;
  for (const s of [-1, 1]) for (const z of [-1.6, 1.4]) wheel(g, 0.6, 0.5, s * (W / 2 - 0.1), 0.6, z);
  box(g, W - 0.2, 0.4, L, M.darkMetal, 0, 1.0, 0);
  box(g, W, 1.2, 1.9, cam, 0, 1.8, 1.0); box(g, W - 0.2, 0.5, 0.05, M.glass, 0, 2.05, 1.96);
  box(g, W - 0.4, 0.7, 1.1, cam, 0, 1.4, 2.3); headlights(g, 1.4, 2.88, 0.7, 0.2);
  for (const s of [-1, 1]) box(g, 0.1, 0.55, 2.3, cam, s * (W / 2), 1.45, -1.5);
  return g;
}
registerModel('m_interceptor', (side) => {
  const M = K.M, cam = camOf(side);
  const g = pickupLauncher(side);
  const t = grp(g, 0, 1.7, -1.5);
  box(t, 1.7, 0.3, 1.8, M.darkMetal, 0, 0, 0);
  const barrel = grp(t, 0, 0.5, 0.2);
  const rack = grp(barrel, 0, 0, 0); rack.rotation.x = -0.6;
  box(rack, 1.5, 0.9, 1.7, cam, 0, 0, 0);
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) cyl(rack, 0.17, 0.17, 0.5, M.gunMetal, -0.5 + c * 0.5, -0.2 + r * 0.45, 1.0, Math.PI / 2, 0, 0, 8);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.5, 1.0); barrel.add(muzzle);
  antenna(g, 0.8, 2.4, 0.4, 2.4, 0.05); antenna(g, -0.8, 2.4, 0.4, 2.0, -0.05);
  net(g, side, 2.0, 1.0, 0, 2.6, -1.6);
  mark(g, side, 2.42, 1.0);
  return { root: g, turret: t, barrel, muzzle, height: 3 };
});
registerModel('m_tor', (side) => {
  const { g, cam, L, M } = hullBase(side, { L: 6.8, W: 3.1, n: 5, sf: 0.3, skirt: 'half' });
  const x = X();
  const t = grp(g, 0, 1.95, 0.1);
  box(t, 2.3, 0.9, 2.8, cam, 0, 0.45, 0);
  const barrel = grp(t, 0, 0.55, 0.4);
  for (const s of [-1, 1]) for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
    cyl(barrel, 0.2, 0.2, 2.4, x.pale, s * (1.0 + c * 0.45), 0.35 + r * 0.45, 0.2, Math.PI / 2, 0, 0, 8);
    box(barrel, 0.3, 0.3, 0.3, M.darkMetal, s * (1.0 + c * 0.45), 0.35 + r * 0.45, -1.1);
  }
  box(t, 0.9, 0.7, 0.5, M.darkMetal, 0, 1.0, 1.1); cyl(t, 0.4, 0.4, 0.08, M.grey, 0, 1.15, 1.45, Math.PI / 2, 0, 0, 12); // Zielverfolgungsradar vorn
  const muzzle = new THREE.Object3D(); muzzle.position.set(1.0, 0.5, 1.6); barrel.add(muzzle);
  const radar = grp(g, 0, 3.3, -1.9);
  cyl(radar, 0.07, 0.07, 1.0, M.darkMetal, 0, -0.5, 0, 0, 0, 0, 6);
  box(radar, 1.9, 0.75, 0.1, M.grey, 0, 0.2, 0, 0, 0, 0);
  mark(g, side, 1.86, -2.8);
  return { root: g, turret: t, barrel, muzzle, radar, height: 4 };
});
registerModel('m_buk', (side) => {
  const { g, cam, L, M } = hullBase(side, { L: 7.2, W: 3.3, n: 6, sf: 0.25, skirt: 'half' });
  const x = X();
  const t = grp(g, 0, 1.95, -0.2);
  box(t, 2.4, 0.5, 3.0, cam, 0, 0.25, 0);
  const barrel = grp(t, 0, 0.8, 0.2);
  const rack = grp(barrel, 0, 0, 0); rack.rotation.x = -0.5;
  for (const s of [-1, 1]) for (let r = 0; r < 3; r++) {
    box(rack, 0.6, 0.55, 4.6, cam, s * 0.65, r * 0.0 - 0.0 + (r - 1) * 0.0, 0);
    if (r === 0) { cyl(rack, 0.26, 0.26, 0.5, x.pale, s * 0.65, 0.0, 2.45, Math.PI / 2, 0, 0, 8); }
  }
  box(rack, 0.7, 0.1, 4.6, M.darkMetal, 0, 0.32, 0);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.9, 1.6); barrel.add(muzzle);
  box(t, 0.9, 0.7, 0.6, M.darkMetal, 0, 0.95, 1.2); cyl(t, 0.5, 0.5, 0.08, M.grey, 0, 1.2, 1.6, Math.PI / 2, 0, 0, 12);
  mark(g, side, 1.86, -2.7);
  return { root: g, turret: t, barrel, muzzle, height: 4.1 };
});
function telModel(side, o) {
  const M = K.M, cam = camOf(side), x = X();
  const g = truckBase(cam, o.L, 2.9, o.axles);
  const t = grp(g, 0, 1.5, -o.L / 2 + 3.2);
  box(t, 2.4, 0.45, 4.0, M.darkMetal, 0, 0, 0);
  const barrel = grp(t, 0, 0.9, 0.6);
  const pod = grp(barrel, 0, 0, 0); pod.rotation.x = -0.18;
  for (const s of o.twin ? [-1, 1] : [0]) {
    cyl(pod, o.r, o.r, o.ml, o.cover ? cam : x.missile, s * 0.62, 0, 0, Math.PI / 2, 0, 0, 10);
    cyl(pod, 0.04, o.r, o.ml * 0.14, x.missile, s * 0.62, 0, o.ml / 2 + o.ml * 0.07, Math.PI / 2, 0, 0, 10);
    for (let i = 0; i < 4; i++) box(pod, 0.04, o.r * 2.4, 0.4, M.darkMetal, s * 0.62, 0, -o.ml / 2 + 0.2, 0, 0, i * Math.PI / 4);
  }
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.2, o.ml / 2); barrel.add(muzzle);
  net(g, side, 2.6, 1.6, 0, 2.5, o.L / 2 - 1.0);
  mark(g, side, 2.88, o.L / 2 - 1.0);
  return { root: g, turret: t, barrel, muzzle, height: 3.8 };
}
registerModel('m_neptun_tel', (side) => telModel(side, { L: 10, axles: 4, r: 0.36, ml: 6.6, twin: true, cover: false }));
registerModel('m_iskander_tel', (side) => telModel(side, { L: 11, axles: 4, r: 0.45, ml: 7.4, twin: true, cover: true }));

// ============================================================ DROHNEN
registerModel('m_vampire', (side) => {
  const M = K.M, g = new THREE.Group(), x = X();
  box(g, 0.9, 0.35, 1.6, M.darkMetal, 0, 0, 0);
  box(g, 0.6, 0.15, 1.1, M.gunMetal, 0, 0.25, -0.1);
  const rotors = [];
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3 + Math.PI / 6, ax = Math.sin(a) * 1.7, az = Math.cos(a) * 1.7;
    box(g, 0.1, 0.07, 1.7, M.darkMetal, ax / 2, 0.05, az / 2, 0, a, 0);
    cyl(g, 0.1, 0.1, 0.2, M.gunMetal, ax, 0.1, az, 0, 0, 0, 8);
    const r = add(g, K.cylG(0.72, 0.72, 0.02, 16), M.rotor, ax, 0.24, az, 0, 0, 0, false);
    r.userData.noWreck = true; rotors.push(r);
  }
  for (const s of [-1, 1]) { cyl(g, 0.12, 0.12, 0.8, x.bomb, s * 0.3, -0.5, 0.0, 0, 0, 0, 8); box(g, 0.04, 0.3, 0.2, x.bomb, s * 0.3, -0.95, 0.0); }
  cyl(g, 0.05, 0.05, 0.5, M.darkMetal, 0, -0.3, 0.6, 0, 0, 0, 6);
  add(g, sphG(0.16, 8, 6), M.glass, 0, -0.3, 0.75);
  add(g, sphG(0.05, 6, 4), side === 'UA' ? M.greenLight : M.redLight, 0, 0.2, -0.8, 0, 0, 0, false);
  mark(g, side, 0.2, 0.2);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, -0.6, 0); g.add(muzzle);
  return { root: g, muzzle, height: 0.8, rotors };
});
function fiberQuad(side) {
  const M = K.M, x = X();
  const r = quad(side, 1.2, false);
  cyl(r.root, 0.2, 0.2, 0.45, x.orange, 0, -0.08, -0.32, 0, 0, Math.PI / 2, 10); // Glasfaserspule
  cyl(r.root, 0.23, 0.23, 0.04, M.darkMetal, 0.24, -0.08, -0.32, 0, 0, Math.PI / 2, 10); cyl(r.root, 0.23, 0.23, 0.04, M.darkMetal, -0.24, -0.08, -0.32, 0, 0, Math.PI / 2, 10);
  if (side === 'RU') box(r.root, 0.3, 0.02, 0.3, M.iffRU, 0, 0.3, 0.1, 0, Math.PI / 4, 0); else box(r.root, 0.35, 0.02, 0.12, M.iffUA, 0, 0.3, 0.1);
  return r;
}
registerModel('m_fiberfpv', (side) => fiberQuad(side));
registerModel('m_kvn', (side) => fiberQuad(side));
registerModel('m_molniya', (side) => {
  const M = K.M, x = X(), g = new THREE.Group();
  box(g, 0.28, 0.26, 1.7, x.card, 0, 0, 0);
  add(g, sphG(0.2, 8, 6), x.olive, 0, 0, 0.9).scale.set(1, 1, 1.3);
  box(g, 3.1, 0.04, 0.6, x.card, 0, 0.14, 0.1);
  box(g, 1.1, 0.04, 0.35, x.card, 0, 0.1, -0.85); box(g, 0.04, 0.4, 0.3, x.card, 0, 0.3, -0.85);
  const prop = add(g, K.cylG(0.32, 0.32, 0.02, 12), M.rotor, 0, 0, -0.95, Math.PI / 2, 0, 0, false); prop.userData.noWreck = true;
  g.scale.setScalar(1.3);
  return { root: g, muzzle: new THREE.Object3D(), height: 0.5, rotors: [prop] };
});
registerModel('m_zala', (side) => {
  const M = K.M, x = X(), g = new THREE.Group();
  box(g, 0.4, 0.2, 1.3, x.pale, 0, 0, 0);
  for (const s of [-1, 1]) box(g, 1.7, 0.05, 0.75, x.pale, s * 0.95, 0, -0.05, 0, s * -0.5, 0);
  add(g, sphG(0.1, 6, 5), M.glass, 0, -0.15, 0.35);
  box(g, 0.04, 0.3, 0.25, x.pale, 0.9, 0.16, -0.5); box(g, 0.04, 0.3, 0.25, x.pale, -0.9, 0.16, -0.5);
  const prop = add(g, K.cylG(0.28, 0.28, 0.02, 12), M.rotor, 0, 0, -0.75, Math.PI / 2, 0, 0, false); prop.userData.noWreck = true;
  g.scale.setScalar(1.6);
  return { root: g, muzzle: new THREE.Object3D(), height: 0.5, rotors: [prop] };
});
registerModel('m_orion', (side) => {
  const M = K.M, x = X(), g = new THREE.Group();
  cyl(g, 0.24, 0.2, 3.6, x.pale, 0, 0, 0, Math.PI / 2, 0, 0, 10);
  add(g, sphG(0.26, 10, 8), x.pale, 0, 0, 1.8).scale.set(1, 1, 1.2);
  box(g, 7.6, 0.06, 0.55, x.pale, 0, 0.18, 0.2);
  for (const s of [-1, 1]) { box(g, 0.5, 0.05, 0.5, x.pale, s * 0.5, 0.35, -1.7, 0, 0, s * 0.7); cyl(g, 0.1, 0.1, 1.1, x.bomb, s * 1.6, -0.18, 0.25, Math.PI / 2, 0, 0, 6); box(g, 0.05, 0.3, 0.3, M.darkMetal, s * 1.6, -0.02, 0.2); }
  cyl(g, 0.12, 0.12, 0.6, x.bomb, 0, -0.3, 0.5, Math.PI / 2, 0, 0, 6);
  add(g, sphG(0.17, 8, 6), M.glass, 0, -0.3, 1.45);
  const prop = add(g, K.cylG(0.6, 0.6, 0.02, 14), M.rotor, 0, 0.05, -1.95, Math.PI / 2, 0, 0, false); prop.userData.noWreck = true;
  box(g, 0.3, 0.2, 0.2, M.era, 0, 0.1, 0);
  g.scale.setScalar(1.25);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, -0.2, 0.8); g.add(muzzle);
  return { root: g, muzzle, height: 0.8, rotors: [prop] };
});
registerModel('m_geran3', (side) => {
  const M = K.M;
  const r = fixedWing(side, 'shahed');
  for (const p of r.rotors) p.visible = false;
  cyl(r.root, 0.3, 0.22, 1.1, M.darkMetal, 0, 0.18, -1.5, Math.PI / 2, 0, 0, 10);       // Strahltriebwerk
  add(r.root, sphG(0.2, 8, 6), M.engineGlow, 0, 0.18, -2.1, 0, 0, 0, false);
  box(r.root, 0.3, 0.2, 1.2, M.darkMetal, 0, 0.3, -0.7);
  r.rotors = [];
  return r;
});
registerModel('m_magura7', () => {
  const M = K.M, g = new THREE.Group(), x = X();
  add(g, hullGeo(1.3, 0.6, 5.5, 0.5, 0.0), M.seadrone, 0, 0.1, 0);
  box(g, 1.1, 0.05, 3.0, M.darkMetal, 0, 0.42, 0.3);
  box(g, 0.6, 0.3, 0.8, M.darkMetal, 0, 0.5, -1.4);
  cyl(g, 0.03, 0.03, 0.8, M.darkMetal, 0, 0.9, -1.6, 0, 0, 0, 4);
  add(g, sphG(0.15, 8, 6), M.optic, 0, 0.65, -0.9);
  box(g, 0.5, 0.35, 0.4, M.darkMetal, 0, 0.2, -2.8);
  const t = grp(g, 0, 0.6, -0.2);
  box(t, 0.8, 0.12, 0.9, M.darkMetal, 0, 0, 0);
  const barrel = grp(t, 0, 0.2, 0.1);
  const rack = grp(barrel, 0, 0, 0); rack.rotation.x = -0.9;
  for (const s of [-1, 1]) { cyl(rack, 0.1, 0.1, 1.2, x.missile, s * 0.22, 0, 0.3, Math.PI / 2, 0, 0, 8); cyl(rack, 0.04, 0.1, 0.2, x.missile, s * 0.22, 0, 1.0, Math.PI / 2, 0, 0, 8); }
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.7, 0.6); barrel.add(muzzle);
  g.scale.setScalar(1.5);
  return { root: g, turret: t, barrel, muzzle, height: 1.8 };
});

// ============================================================ BODENROBOTER
function ugvBase(side, o) {
  const M = K.M, cam = camOf(side), g = new THREE.Group();
  const L = o.L || 3.4, W = o.W || 1.8, tx = W / 2 - 0.25;
  for (const s of [-1, 1]) trackSet(g, s, tx, L, { w: 0.5, h: 0.6, n: 4, wr: 0.24, y: 0.34 });
  add(g, hullGeo(W - 0.5, 0.5, L - 0.2, 0.3, 0.1), cam, 0, 0.78, 0);
  antenna(g, -0.5, 1.0, -L / 2 + 0.4, 1.6, 0.1);
  add(g, sphG(0.05, 6, 4), side === 'UA' ? M.greenLight : M.redLight, 0.4, 1.0, L / 2 - 0.3, 0, 0, 0, false);
  return { g, cam, M, L, W };
}
registerModel('m_ugv_mg', (side) => {
  const { g, cam, M } = ugvBase(side, {});
  const t = grp(g, 0, 1.1, 0.1);
  box(t, 0.7, 0.35, 0.9, cam, 0, 0.1, 0); box(t, 0.3, 0.2, 0.3, M.optic, 0.2, 0.4, 0.2);
  const { barrel, muzzle } = gun(t, { y: 0.15, z: 0.4, len: 1.1, r: 0.04 });
  mark(g, side, 1.04, -0.8);
  return { root: g, turret: t, barrel, muzzle, height: 1.5 };
});
registerModel('m_ugv_kami', (side) => {
  const { g, cam, M, L } = ugvBase(side, { L: 3.0, W: 1.7 });
  const x = X();
  cyl(g, 0.4, 0.4, 1.8, x.bomb, 0, 1.25, 0.1, Math.PI / 2, 0, 0, 10);
  add(g, sphG(0.4, 10, 6), x.bomb, 0, 1.25, 1.0).scale.set(1, 1, 0.8);
  box(g, 0.3, 0.2, 0.3, M.optic, 0, 0.95, L / 2 - 0.3);
  mark(g, side, 1.66, -0.4);
  return { root: g, muzzle: new THREE.Object3D(), height: 1.7 };
});
registerModel('m_ugv_log', (side) => {
  const M = K.M, cam = camOf(side), g = new THREE.Group(), x = X();
  const L = 3.8, W = 2.2;
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) wheel(g, 0.42, 0.4, s * (W / 2 - 0.1), 0.42, -1.3 + i * 1.3);
  box(g, W - 0.3, 0.3, L, M.darkMetal, 0, 0.8, 0);
  box(g, W - 0.5, 0.5, 1.4, cam, 0, 1.2, 1.2);
  for (let i = 0; i < 3; i++) box(g, 0.9, 0.55, 0.9, i % 2 ? x.card : x.bomb, i % 2 ? 0.45 : -0.45, 1.25, -0.5 - i * 0.25 + (i ? 0 : 0.4));
  box(g, 0.9, 0.4, 0.9, x.bomb, -0.45, 1.7, -0.3);
  antenna(g, 0.8, 1.4, -1.5, 1.8, 0.1);
  box(g, 0.3, 0.15, 0.3, M.optic, 0, 1.55, L / 2 - 0.5);
  mark(g, side, 1.46, 1.2);
  return { root: g, muzzle: new THREE.Object3D(), height: 1.9 };
});

// ============================================================ INFANTERIE
registerModel('m_dronehunter', (side, type, ctx) => {
  const M = K.M, x = X();
  const r = soldier(side, 'rifle');
  box(r.body, 0.32, 0.45, 0.2, M.darkMetal, 0, 1.4, -0.52);      // EloKa-Tornister
  antenna(r.body, -0.1, 1.55, -0.55, 0.9, 0.1); antenna(r.body, 0.1, 1.55, -0.55, 0.7, -0.15);
  box(r.body, 0.5, 0.12, 0.06, x.orange, 0.0, 1.75, 0.16);       // Schrotflinten-/EloKa-Kennung (Warnband)
  if (side === 'RU') box(r.body, 0.16, 0.08, 0.16, M.iffRU, 0.38, 1.6, 0.02);
  return noShadowInf(r, ctx);
});
registerModel('m_fibreop', (side, type, ctx) => {
  const x = X(), M = K.M;
  const r = soldier(side, 'tablet');
  box(r.body, 0.5, 0.5, 0.3, M.pack, 0, 1.38, -0.5);
  cyl(r.body, 0.2, 0.2, 0.3, x.orange, 0, 1.4, -0.7, Math.PI / 2, 0, 0, 10);    // Glasfaserspule im Tornister
  if (side === 'RU') box(r.body, 0.16, 0.08, 0.16, M.iffRU, 0.38, 1.6, 0.02);
  return noShadowInf(r, ctx);
});
registerModel('m_storm', (side, type, ctx) => {
  const M = K.M;
  const r = soldier(side, 'rifle');
  if (side === 'RU') box(r.body, 0.16, 0.08, 0.16, M.iffRU, 0.38, 1.6, 0.02);
  box(r.body, 0.4, 0.3, 0.1, M.pack, 0, 1.3, -0.4);
  return noShadowInf(r, ctx);
});
registerModel('m_moto', (side, type, ctx) => {
  const M = K.M, g = new THREE.Group(), cam = camOf(side);
  for (const z of [-0.85, 0.85]) { wheel(g, 0.42, 0.22, 0, 0.42, z); }
  box(g, 0.2, 0.3, 1.5, M.darkMetal, 0, 0.75, 0); box(g, 0.35, 0.3, 0.6, cam, 0, 0.98, 0.35);
  box(g, 0.8, 0.06, 0.06, M.darkMetal, 0, 1.25, 0.8); cyl(g, 0.05, 0.05, 0.6, M.darkMetal, 0, 1.0, 0.85, 0, 0, 0, 5);
  for (const [z, k] of [[0.0, 0], [-0.55, 1]]) {
    box(g, 0.4, 0.55, 0.3, k ? M.uniformRU : M.uniformRU, 0, 1.35, z); add(g, sphG(0.16, 8, 6), M.helmet, 0, 1.8, z + 0.05);
    box(g, 0.14, 0.4, 0.14, M.uniformRU, 0.28, 1.1, z + 0.1); box(g, 0.14, 0.4, 0.14, M.uniformRU, -0.28, 1.1, z + 0.1);
  }
  box(g, 0.06, 0.06, 0.8, M.gunMetal, 0.3, 1.3, 0.2);
  box(g, 0.3, 0.02, 0.3, M.iffRU, 0, 1.45, -0.7, 0, Math.PI / 4, 0);
  g.scale.setScalar(1.3);
  return noShadowInf({ root: g, muzzle: (() => { const m = new THREE.Object3D(); m.position.set(0.3, 1.3, 0.8); g.add(m); return m; })(), height: 2.8 }, ctx);
});
registerModel('m_buggy', (side) => {
  const M = K.M, cam = camOf(side), g = new THREE.Group();
  for (const s of [-1, 1]) for (const z of [-1.1, 1.2]) wheel(g, 0.55, 0.45, s * 0.95, 0.55, z);
  box(g, 1.5, 0.25, 3.2, M.darkMetal, 0, 0.8, 0); box(g, 1.2, 0.5, 1.2, cam, 0, 1.1, 1.3);
  for (const s of [-1, 1]) { box(g, 0.06, 0.9, 0.06, M.darkMetal, s * 0.7, 1.5, 0.5); box(g, 0.06, 0.9, 0.06, M.darkMetal, s * 0.7, 1.5, -0.9); box(g, 0.06, 0.06, 1.5, M.darkMetal, s * 0.7, 1.95, -0.2); }
  box(g, 1.4, 0.06, 0.06, M.darkMetal, 0, 1.95, 0.5);
  for (const z of [0.2, -0.6]) { box(g, 0.45, 0.5, 0.3, M.uniformRU, 0.3, 1.35, z); add(g, sphG(0.15, 8, 6), M.helmet, 0.3, 1.75, z + 0.03); }
  const t = grp(g, 0, 1.6, -1.1);
  box(t, 0.3, 0.3, 0.3, M.darkMetal, 0, 0, 0);
  const { barrel, muzzle } = gun(t, { y: 0.1, z: 0.3, len: 0.9, r: 0.04 });
  box(g, 0.35, 0.02, 0.35, M.iffRU, 0, 1.22, 1.35, 0, Math.PI / 4, 0);
  return { root: g, turret: t, barrel, muzzle, height: 2.4 };
});
registerModel('m_mtlb', (side) => {
  const M = K.M, cam = camOf(side), g = new THREE.Group(), x = X();
  const L = 6.4, W = 2.9, tx = W / 2 - 0.3;
  for (const s of [-1, 1]) { trackSet(g, s, tx, L, { w: 0.7, h: 0.9, n: 6, wr: 0.34 }); box(g, 0.08, 0.5, L * 0.7, cam, s * (tx + 0.46), 1.0, 0); }
  add(g, hullGeo(W - 0.4, 1.0, L, 0.4, 0.05), cam, 0, 1.3, 0);
  box(g, W - 0.6, 0.7, 3.0, cam, 0, 2.1, -1.2);                                 // Kampfaufbau
  for (const s of [-1, 1]) for (let i = 0; i < 5; i++) box(g, 0.05, 0.75, 0.05, x.cage, s * (W / 2 - 0.2), 2.1, -2.5 + i * 0.7); // Gitter-/Schlitzschutz
  box(g, W - 0.4, 0.05, 3.1, x.cage, 0, 2.62, -1.2);
  headlights(g, 1.4, L / 2 - 0.14, 1.0, 0.2);
  const t = grp(g, 0, 2.8, -0.6);
  box(t, 0.8, 0.3, 0.8, M.darkMetal, 0, 0, 0); box(t, 0.5, 0.4, 0.06, M.darkMetal, 0, 0.3, 0.4);
  const { barrel, muzzle } = gun(t, { y: 0.12, z: 0.4, len: 1.5, r: 0.05 });
  antenna(g, 1.0, 2.5, -2.6, 2.6, 0.1);
  mark(g, side, 2.66, 0.2);
  return { root: g, turret: t, barrel, muzzle, height: 3.1 };
});

// ============================================================ FLUGZEUGE (Fähigkeiten / Katalog)
function jet(side, kind) {
  const M = K.M, x = X(), g = new THREE.Group();
  const body = kind === 'su34' ? M.camoRU : x.jetGrey;
  const L = kind === 'mirage' ? 8.6 : kind === 'su34' ? 10.5 : 8.8;
  cyl(g, 0.55, 0.5, L * 0.7, body, 0, 0, 0, Math.PI / 2, 0, 0, 10);
  cyl(g, 0.06, 0.55, L * 0.3, body, 0, 0, L * 0.5 - 0.2, Math.PI / 2, 0, 0, 10);               // Nase
  add(g, sphG(0.45, 10, 6), M.glass, 0, 0.5, L * 0.12).scale.set(0.9, 0.7, 2.0);                  // Kanzel
  if (kind === 'su34') {
    box(g, 1.8, 0.35, 2.4, body, 0, -0.05, L * 0.34);                                              // „Ente“: breite Nase
    for (const s of [-1, 1]) {
      cyl(g, 0.45, 0.4, 3.2, x.jetDark, s * 0.7, -0.1, -L * 0.32, Math.PI / 2, 0, 0, 8);
      add(g, sphG(0.34, 8, 6), M.engineGlow, s * 0.7, -0.1, -L * 0.32 - 1.7, 0, 0, 0, false);
      box(g, 0.08, 1.9, 1.5, body, s * 0.9, 0.9, -L * 0.36, 0, 0, s * -0.1);
      box(g, 1.5, 0.06, 0.8, body, s * 1.4, 0.1, L * 0.3);                                       // Canards
      box(g, 0.35, 0.25, 1.6, x.bomb, s * 2.0, -0.55, -0.3);                                    // Waffenlast
    }
    for (const s of [-1, 1]) box(g, 3.8, 0.07, 2.4, body, s * 2.4, 0, -L * 0.1, 0, s * 0.2, 0);
    box(g, 2.4, 0.07, 1.0, body, 0, 0, -L * 0.4);
  } else if (kind === 'mirage') {
    for (const s of [-1, 1]) {
      box(g, 3.2, 0.07, 4.6, body, s * 1.6, 0, -L * 0.15, 0, s * -0.18, 0);                      // Deltaflügel
      box(g, 0.35, 0.25, 1.8, x.bomb, s * 2.1, -0.4, -0.4);
    }
    box(g, 0.08, 1.7, 1.6, body, 0, 1.1, -L * 0.36);
    add(g, sphG(0.4, 8, 6), M.engineGlow, 0, 0, -L * 0.38, 0, 0, 0, false);
    box(g, 1.1, 0.6, 1.6, x.jetDark, 0, -0.45, L * 0.1);
  } else { // F-16
    for (const s of [-1, 1]) {
      box(g, 2.8, 0.07, 2.6, body, s * 1.6, 0, -L * 0.12, 0, s * -0.45, 0);
      box(g, 1.5, 0.06, 1.0, body, s * 0.95, 0, -L * 0.38, 0, s * -0.3, 0);                       // Höhenleitwerk
      box(g, 0.3, 0.25, 1.8, x.bomb, s * 2.3, -0.4, -0.3); box(g, 0.1, 0.1, 1.2, x.missile, s * 3.1, 0, -0.2);
    }
    box(g, 0.08, 1.6, 1.6, body, 0, 1.0, -L * 0.34, 0, 0, 0);
    box(g, 1.0, 0.7, 2.2, x.jetDark, 0, -0.5, L * 0.12);                                             // Lufteinlauf
    add(g, sphG(0.38, 8, 6), M.engineGlow, 0, 0, -L * 0.38, 0, 0, 0, false);
  }
  add(g, sphG(0.05, 6, 4), side === 'UA' ? M.greenLight : M.redLight, 3.4, 0.0, -L * 0.15, 0, 0, 0, false);
  if (side === 'UA') { box(g, 0.9, 0.02, 0.2, M.iffUA, 1.5, 0.08, -L * 0.1); box(g, 0.9, 0.02, 0.2, M.iffUA2, 1.5, 0.08, -L * 0.1 + 0.2); }
  else box(g, 0.45, 0.02, 0.45, M.iffRU, 1.5, 0.08, -L * 0.1, 0, Math.PI / 4, 0);
  const muzzle = new THREE.Object3D(); g.add(muzzle);
  return { root: g, muzzle, height: 1.8 };
}
registerModel('m_jet_f16', (side) => jet(side, 'f16'));
registerModel('m_jet_mirage', (side) => jet(side, 'mirage'));
registerModel('m_jet_su34', (side) => jet(side, 'su34'));
