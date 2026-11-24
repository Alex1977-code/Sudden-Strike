// WK2: gezogene Geschütze (Pak, Flak, Haubitzen, Nebelwerfer) – Drehteil = turret, Rohr = barrel
import { K, THREE, add, box, cyl, wheel, fm, X, dome, insignia, tube, mkBarrel, mkMuzzle } from './kit.js';
const PI = Math.PI;

function carriage(g, M, F, o) {
  // Räder + Achse
  for (const s of [-1, 1]) {
    wheel(g, o.wr, 0.18, s * o.wx, o.wr, 0);
    cyl(g, 0.12, 0.12, 0.3, M.darkMetal, s * (o.wx - 0.2), o.wr, 0, 0, 0, PI / 2, 6);
  }
  box(g, o.wx * 2, 0.14, 0.2, M.darkMetal, 0, o.wr, 0);
  // Spreizlafette (zwei Holme)
  for (const s of [-1, 1]) {
    box(g, 0.12, 0.14, o.trail, M.darkMetal, s * o.spread * 0.5, 0.3, -o.trail / 2 * 0.95, 0, s * -Math.atan2(o.spread * 0.5, o.trail), 0);
    box(g, 0.3, 0.05, 0.3, M.darkMetal, s * o.spread * 0.95, 0.05, -o.trail * 0.95);
  }
}
function shield(t, F, o) {
  box(t, o.sw, o.sh, 0.05, F.body, 0, o.sy, o.sz);
  if (o.sh2) for (const s of [-1, 1]) box(t, 0.05, o.sh2, 0.5, F.body, s * (o.sw / 2), o.sy - 0.1, o.sz - 0.2, 0, s * 0.3, 0);
}
function atGun(fac, o) {
  return (side, type, ctx) => {
    const M = ctx.M, F = fm(fac, ctx.season), g = new THREE.Group();
    carriage(g, M, F, o);
    const t = new THREE.Group(); t.position.set(0, o.wr + 0.15, 0); g.add(t);
    cyl(t, 0.2, 0.25, 0.2, M.darkMetal, 0, 0, 0, 0, 0, 0, 8);
    shield(t, F, o);
    box(t, 0.35, 0.3, 0.9, M.darkMetal, 0, 0.2, -0.1); // Wiege/Verschluss
    const b = mkBarrel(t, 0, 0.35, 0.3);
    cyl(b, 0.1, 0.1, 0.8, M.darkMetal, 0, 0, 0.1, PI / 2, 0, 0, 8);
    const end = tube(b, o.r, o.len, 0.4, { brake: o.brake });
    const mz = mkMuzzle(b, end + 0.1);
    o.extra && o.extra(g, t, F, M);
    if (o.mark) insignia(fac, t, o.mark, 'top', 0, o.sy + o.sh / 2 + 0.01, o.sz - 0.2);
    return { root: g, turret: t, barrel: b, muzzle: mz, height: 1.9 };
  };
}
const pak40 = atGun('DE', { wr: 0.45, wx: 0.95, trail: 2.6, spread: 1.5, sw: 1.7, sh: 1.0, sy: 0.65, sz: 0.55, sh2: 0.8, r: 0.07, len: 3.5, brake: true });
const pdr6 = atGun('UK', { wr: 0.42, wx: 0.85, trail: 2.4, spread: 1.4, sw: 1.3, sh: 0.85, sy: 0.6, sz: 0.5, r: 0.055, len: 2.8, brake: false });
const m1_57 = atGun('US', { wr: 0.42, wx: 0.85, trail: 2.4, spread: 1.4, sw: 1.3, sh: 0.85, sy: 0.6, sz: 0.5, r: 0.055, len: 2.8, brake: false });
const zis3 = atGun('SU', { wr: 0.45, wx: 0.9, trail: 2.8, spread: 1.7, sw: 1.5, sh: 0.9, sy: 0.65, sz: 0.55, sh2: 0.7, r: 0.06, len: 3.0, brake: 'big' });
function howitzer(fac, o) {
  return atGun(fac, { wr: 0.5, wx: 1.05, trail: 3.0, spread: 1.9, sw: 2.0, sh: 1.1, sy: 0.7, sz: 0.6, sh2: 0.9, r: 0.1, len: o.len, brake: o.brake, extra: (g, t, F, M) => { t.children[t.children.length - 1].rotation.x = 0; } });
}
const m101 = howitzer('US', { len: 2.0, brake: false });
const lefh18 = howitzer('DE', { len: 2.4, brake: false });
const m101gun = m101;

// Flak auf Kreuzlafette: Plattform + vier Stützarme
function crossGun(fac, o) {
  return (side, type, ctx) => {
    const M = ctx.M, F = fm(fac, ctx.season), g = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const a = i * PI / 2 + PI / 4, c = Math.cos(a), s = Math.sin(a);
      box(g, 0.2, 0.14, o.arm, M.darkMetal, s * o.arm / 2, 0.25, c * o.arm / 2, 0, a, 0);
      cyl(g, 0.16, 0.2, 0.12, M.darkMetal, s * o.arm, 0.08, c * o.arm, 0, 0, 0, 6);
    }
    cyl(g, 0.4, 0.5, 0.35, M.darkMetal, 0, 0.35, 0, 0, 0, 0, 10);
    for (const s of [-1, 1]) wheel(g, 0.35, 0.15, s * 0.9, 0.35, -o.arm - 0.5); // abgeklappte Räder
    const t = new THREE.Group(); t.position.set(0, 0.7, 0); g.add(t);
    box(t, 0.9, 0.2, 0.9, M.darkMetal, 0, 0, 0);
    if (o.shield) box(t, 1.5, 0.9, 0.05, F.body, 0, 0.65, 0.65);
    box(t, 0.5, 0.45, 0.9, M.darkMetal, 0, 0.35, -0.1);
    const b = mkBarrel(t, 0, 0.5, 0.2);
    b.rotation.x = o.pitch;
    cyl(b, 0.11, 0.11, 1.0, M.darkMetal, 0, 0, 0.5, PI / 2, 0, 0, 8);
    const end = tube(b, o.r, o.len, 0.6, { brake: o.brake });
    const mz = mkMuzzle(b, end + 0.1);
    insignia(fac, g, 0.3, 'top', 0, 0.55, -0.1);
    return { root: g, turret: t, barrel: b, muzzle: mz, height: 2.2 };
  };
}
const flak88 = crossGun('DE', { arm: 2.4, shield: true, r: 0.085, len: 4.9, brake: true, pitch: -0.12 });
const flak37 = crossGun('DE', { arm: 1.7, shield: false, r: 0.045, len: 2.4, brake: false, pitch: -0.5 });
const bofors = (fac) => crossGun(fac, { arm: 1.8, shield: false, r: 0.05, len: 2.4, brake: false, pitch: -0.5 });
const k61 = crossGun('SU', { arm: 1.6, shield: false, r: 0.045, len: 2.2, brake: false, pitch: -0.5 });

// Nebelwerfer 41: sechs Rohre auf Räderlafette
function nebelwerfer(side, type, ctx) {
  const M = ctx.M, F = fm('DE', ctx.season), g = new THREE.Group();
  carriage(g, M, F, { wr: 0.42, wx: 0.85, trail: 2.2, spread: 1.2 });
  const t = new THREE.Group(); t.position.set(0, 0.9, 0); g.add(t);
  box(t, 0.5, 0.5, 0.6, F.body, 0, 0, 0);
  const b = mkBarrel(t, 0, 0.5, 0);
  b.rotation.x = -0.5;
  for (let i = 0; i < 6; i++) {
    const a = i * PI / 3;
    cyl(b, 0.13, 0.13, 1.6, F.body, Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0.8, PI / 2, 0, 0, 8);
  }
  box(b, 0.9, 0.08, 0.08, M.darkMetal, 0, 0, 0.4); box(b, 0.08, 0.9, 0.08, M.darkMetal, 0, 0, 0.4);
  const mz = mkMuzzle(b, 1.7);
  insignia('DE', g, 0.3, 'top', 0, 0.9, -0.8);
  return { root: g, turret: t, barrel: b, muzzle: mz, height: 2.0 };
}

export const GUN_MODELS = {
  ww2_pak40: pak40, ww2_6pdr: pdr6, ww2_us_57mm: m1_57, ww2_zis3: zis3, ww2_m101: m101, ww2_lefh18: lefh18,
  ww2_flak88: flak88, ww2_flak37: flak37, ww2_bofors_us: bofors('US'), ww2_bofors_uk: bofors('UK'), ww2_61k: k61,
  ww2_nebelwerfer: nebelwerfer,
};
