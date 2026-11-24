// WK2: Rad-/Halbkettenfahrzeuge, Lkw, Panzerspähwagen
import { K, THREE, add, box, cyl, trackSet, wheel, fm, X, profGeo, dome, insignia, numerals, tube, mkBarrel, mkMuzzle } from './kit.js';

const PI = Math.PI;
const ant = (p, px, py, pz, len = 2.2) => K.antenna(p, px, py, pz, len, 0.05);

function wheels(g, M, W, zs, r = 0.5, w = 0.4) { for (const s of [-1, 1]) for (const z of zs) wheel(g, r, w, s * W, r, z); }
function marks(fac, g, list) {
  for (const [face, px, py, pz, r] of list) insignia(fac, g, r, face, px, py, pz);
}

// ---------------- Halbketten ----------------
function halftrack(fac, o) {
  return (side, type, ctx) => {
    const M = ctx.M, F = fm(fac, ctx.season), g = new THREE.Group();
    const L = o.L, W = o.W;
    for (const s of [-1, 1]) {
      trackSet(g, s, W / 2 - 0.3, L * 0.55, { w: 0.5, h: 0.7, n: 4, wr: 0.28, y: 0.4 });
      g.children[g.children.length - 1];
    }
    // trackSet zentriert – nach hinten verschieben
    g.children.forEach((c) => { c.position.z -= L * 0.2; });
    const fw = new THREE.Group(); g.add(fw);
    for (const s of [-1, 1]) wheel(fw, 0.5, 0.4, s * (W / 2 - 0.15), 0.5, L * 0.34);
    fw.position.z = 0;
    add(g, profGeo(o.hull, W - 0.2), F.body, 0, 0, 0);
    // offener Mannschaftsraum
    for (const s of [-1, 1]) box(g, 0.08, o.wallH, o.wallL, F.body, s * (W / 2 - 0.1), o.wallY, o.wallZ);
    box(g, W - 0.2, o.wallH, 0.08, F.body, 0, o.wallY, o.wallZ - o.wallL / 2);
    box(g, W - 0.3, 0.1, o.wallL, M.wood2, 0, o.wallY - o.wallH / 2, o.wallZ);
    box(g, W - 0.6, 0.55, 0.9, M.darkMetal, 0, 1.0, L / 2 + 0.2, 0, 0, 0);
    box(g, 0.4, 0.3, 0.3, M.headlight, W / 2 - 0.3, 1.5, L / 2 - 0.1);
    box(g, 0.4, 0.3, 0.3, M.headlight, -(W / 2 - 0.3), 1.5, L / 2 - 0.1);
    o.extra && o.extra(g, F, M);
    const turret = new THREE.Group(); turret.position.set(0, o.mgY, o.mgZ); g.add(turret);
    box(turret, 0.5, 0.35, 0.1, M.darkMetal, 0, 0.1, 0.35); // MG-Schild
    const barrel = mkBarrel(turret, 0, 0.1, 0.3);
    const end = tube(barrel, 0.04, o.mgLen, 0);
    const muzzle = mkMuzzle(barrel, end + 0.05);
    marks(fac, g, o.marks);
    return { root: g, turret, barrel, muzzle, height: 2.6 };
  };
}
const M3_HULL = [[-2.7, 0.6], [-2.7, 1.5], [0.8, 1.5], [1.0, 1.9], [2.3, 1.7], [2.9, 1.5], [2.9, 0.6]];
const m3 = halftrack('US', {
  L: 5.8, W: 2.3, hull: M3_HULL, wallH: 0.85, wallL: 3.4, wallY: 1.9, wallZ: -1.0, mgY: 2.4, mgZ: -0.2, mgLen: 0.9,
  extra: (g, F, M) => { cyl(g, 0.22, 0.22, 2.1, M.darkMetal, 0, 1.0, 3.2, 0, 0, PI / 2, 8); box(g, 2.0, 0.08, 0.6, F.body, 0, 2.1, -2.7); },
  marks: [['+x', 1.16, 1.6, 2.1, 0.3], ['-x', -1.16, 1.6, 2.1, 0.3], ['top', 0, 1.92, 1.0, 0.35]],
});
const sdkfz251 = halftrack('DE', {
  L: 5.9, W: 2.1, hull: [[-2.8, 0.6], [-2.8, 1.8], [0.5, 1.8], [1.3, 2.0], [1.9, 1.6], [2.9, 1.4], [2.9, 0.6]], wallH: 0.6, wallL: 3.3, wallY: 2.0, wallZ: -1.1, mgY: 2.6, mgZ: 0.7, mgLen: 0.8,
  extra: (g, F, M) => { box(g, 1.9, 0.08, 0.5, F.body, 0, 2.3, -2.7); for (const s of [-1, 1]) box(g, 0.06, 0.8, 1.0, F.body, s * 1.0, 1.95, 1.3, 0, 0, s * 0.2); },
  marks: [['+x', 1.06, 1.5, 0.5, 0.36], ['-x', -1.06, 1.5, 0.5, 0.36]],
});

// ---------------- Universal Carrier ----------------
function carrier(side, type, ctx) {
  const M = ctx.M, F = fm('UK', ctx.season), g = new THREE.Group();
  for (const s of [-1, 1]) trackSet(g, s, 0.95, 3.6, { w: 0.4, h: 0.6, n: 4, wr: 0.28, y: 0.38 });
  add(g, profGeo([[-1.8, 0.45], [-1.8, 1.4], [-0.6, 1.4], [-0.3, 1.7], [0.7, 1.7], [1.8, 1.05], [1.8, 0.45]], 1.9), F.body, 0, 0, 0);
  box(g, 1.4, 0.08, 1.5, M.wood2, 0, 1.35, -1.0);
  const turret = new THREE.Group(); turret.position.set(0, 1.9, 0.4); g.add(turret);
  const barrel = mkBarrel(turret, 0, 0.1, 0.2);
  const end = tube(barrel, 0.04, 0.9, 0);
  const muzzle = mkMuzzle(barrel, end + 0.05);
  box(turret, 0.04, 0.4, 0.3, M.darkMetal, 0.0, 0.0, 0.4);
  insignia('UK', g, 0.3, '+x', 0.96, 1.1, -0.4); insignia('UK', g, 0.3, '-x', -0.96, 1.1, -0.4);
  return { root: g, turret, barrel, muzzle, height: 2.1 };
}

// ---------------- Jeep / Kübelwagen ----------------
function smallCar(fac, o) {
  return (side, type, ctx) => {
    const M = ctx.M, F = fm(fac, ctx.season), g = new THREE.Group();
    const W = o.W;
    wheels(g, M, W / 2 - 0.1, [o.L / 2 - 0.7, -o.L / 2 + 0.7], o.r, 0.32);
    add(g, profGeo(o.body, W - 0.3), F.body, 0, 0, 0);
    for (const s of [-1, 1]) box(g, 0.1, 0.1, o.L * 0.55, F.body, s * (W / 2 - 0.1), o.r * 2 + 0.3, 0);
    box(g, W - 0.4, 0.06, 0.8, M.wood2, 0, 1.35, -o.L / 2 + 0.7); // Ladefläche/Sitz
    box(g, W - 0.4, 0.5, 0.1, M.darkMetal, 0, 1.45, 0.2); // Frontscheibe (Rahmen)
    box(g, W - 0.5, 0.35, 0.06, M.glass, 0, 1.5, 0.2);
    box(g, 0.3, 0.2, 0.15, M.headlight, W / 2 - 0.3, 1.1, o.L / 2 - 0.05); box(g, 0.3, 0.2, 0.15, M.headlight, -W / 2 + 0.3, 1.1, o.L / 2 - 0.05);
    cyl(g, 0.3, 0.3, 0.12, M.rubber, 0, 1.0, -o.L / 2 - 0.05, PI / 2, 0, 0, 10); // Reserverad
    const turret = new THREE.Group(); turret.position.set(0, 1.65, -0.5); g.add(turret);
    const barrel = mkBarrel(turret, 0, 0.1, 0.2);
    let end = 0;
    if (o.mg) { box(turret, 0.06, 0.5, 0.06, M.darkMetal, 0, -0.1, 0); end = tube(barrel, 0.035, 0.8, 0); }
    const muzzle = mkMuzzle(barrel, end + 0.1);
    marks(fac, g, o.marks);
    return { root: g, turret, barrel, muzzle, height: 2.2 };
  };
}
const jeep = smallCar('US', { W: 1.9, L: 3.4, r: 0.42, mg: true, body: [[-1.7, 0.45], [-1.7, 1.2], [0.2, 1.2], [0.5, 1.0], [1.7, 1.0], [1.7, 0.45]], marks: [['top', 0, 1.22, 1.0, 0.3]] });
const kubel = smallCar('DE', { W: 1.8, L: 3.6, r: 0.45, mg: false, body: [[-1.8, 0.5], [-1.8, 1.3], [0.2, 1.3], [0.7, 1.05], [1.8, 1.0], [1.8, 0.5]], marks: [['+x', 0.8, 1.0, -0.4, 0.28], ['-x', -0.8, 1.0, -0.4, 0.28]] });

// ---------------- Lkw ----------------
function truck(fac, o) {
  return (side, type, ctx) => {
    const M = ctx.M, F = fm(fac, ctx.season), g = new THREE.Group();
    const L = o.L, W = 2.5;
    const zs = o.axles === 3 ? [L / 2 - 1.2, -L / 2 + 2.3, -L / 2 + 0.9] : [L / 2 - 1.2, -L / 2 + 1.2];
    wheels(g, M, W / 2 - 0.1, zs, 0.55, 0.42);
    box(g, W - 0.5, 0.35, L, M.darkMetal, 0, 0.95, 0);
    // Fahrerhaus + Haube
    box(g, W - 0.2, o.cabH, o.cabL, F.body, 0, 1.2 + o.cabH / 2, L / 2 - o.hood - o.cabL / 2);
    box(g, W - 0.5, 0.95, o.hood, F.body, 0, 1.55, L / 2 - o.hood / 2);
    box(g, W - 0.7, 0.55, 0.06, M.darkMetal, 0, 1.55, L / 2 + 0.02);
    box(g, W - 0.3, 0.55, 0.06, M.glass, 0, 1.2 + o.cabH * 0.7, L / 2 - o.hood + 0.0);
    box(g, 0.34, 0.2, 0.1, M.headlight, 0.8, 1.45, L / 2 + 0.04); box(g, 0.34, 0.2, 0.1, M.headlight, -0.8, 1.45, L / 2 + 0.04);
    for (const s of [-1, 1]) box(g, 0.1, 0.12, o.hood + 0.2, F.body, s * (W / 2 - 0.1), 1.2, L / 2 - o.hood / 2); // Kotflügel
    // Ladefläche
    const bz = -L / 2 + o.bedL / 2 + 0.1;
    box(g, W - 0.1, 0.12, o.bedL, M.wood2, 0, 1.2, bz);
    if (o.cover) {
      box(g, W - 0.1, 1.4, 0.06, F.canvas, 0, 2.0, bz - o.bedL / 2);
      for (const s of [-1, 1]) box(g, 0.06, 1.2, o.bedL, F.canvas, s * (W / 2 - 0.05), 1.9, bz);
      const roof = cyl(g, 1.2, 1.2, o.bedL, F.canvas, 0, 2.15, bz, PI / 2, 0, 0, 12); roof.scale.y = 1;
      roof.scale.set(1, 1, 0.55);
    } else {
      for (const s of [-1, 1]) box(g, 0.08, 0.7, o.bedL, F.body, s * (W / 2 - 0.05), 1.65, bz);
      box(g, W - 0.1, 0.7, 0.08, F.body, 0, 1.65, bz - o.bedL / 2);
      box(g, W - 0.1, 0.7, 0.08, F.body, 0, 1.65, bz + o.bedL / 2);
    }
    o.extra && o.extra(g, F, M, bz);
    marks(fac, g, o.marks);
    const muzzle = new THREE.Object3D(); g.add(muzzle);
    return { root: g, muzzle, height: 3.0 };
  };
}
const gmc = truck('US', { L: 7.2, axles: 3, cabH: 1.1, cabL: 1.5, hood: 1.2, bedL: 4.3, cover: true, marks: [['+x', 1.28, 1.7, L2(7.2), 0.3], ['-x', -1.28, 1.7, L2(7.2), 0.3]] });
function L2(L) { return L / 2 - 1.9; }
const bedford = truck('UK', { L: 6.6, axles: 2, cabH: 1.1, cabL: 1.4, hood: 1.0, bedL: 4.0, cover: true, marks: [['+x', 1.28, 1.7, L2(6.6), 0.26], ['-x', -1.28, 1.7, L2(6.6), 0.26]] });
const zis = truck('SU', { L: 6.4, axles: 2, cabH: 1.0, cabL: 1.3, hood: 1.1, bedL: 3.9, cover: false, marks: [] });
const opel = truck('DE', { L: 6.4, axles: 2, cabH: 1.15, cabL: 1.5, hood: 0.8, bedL: 3.9, cover: true, marks: [['+x', 1.28, 1.7, L2(6.4), 0.3], ['-x', -1.28, 1.7, L2(6.4), 0.3]] });

// Katjuscha BM-13 auf Lkw: Schienenrahmen schwenkt (turret) und neigt sich (barrel)
function bm13(side, type, ctx) {
  const M = ctx.M, F = fm('SU', ctx.season);
  const base = truck('SU', { L: 6.8, axles: 3, cabH: 1.0, cabL: 1.3, hood: 1.1, bedL: 0.2, cover: false, marks: [] })(side, type, ctx);
  const g = base.root;
  const turret = new THREE.Group(); turret.position.set(0, 1.4, -1.6); g.add(turret);
  box(turret, 1.8, 0.2, 3.0, M.darkMetal, 0, 0, 0);
  const barrel = mkBarrel(turret, 0, 0.3, -0.6);
  barrel.rotation.x = -0.55;
  for (const s of [-0.6, 0, 0.6]) {
    box(barrel, 0.12, 0.16, 4.2, M.gunMetal, s, 0.15, 2.0);
    box(barrel, 0.1, 0.1, 4.2, M.gunMetal, s, -0.15, 2.0);
    for (const dz of [0.6, 1.6, 2.6]) cyl(barrel, 0.07, 0.07, 1.0, M.darkMetal, s, 0.04, dz + 0.5, PI / 2, 0, 0, 6);
  }
  box(barrel, 2.0, 0.08, 0.08, M.darkMetal, 0, 0, 0.5); box(barrel, 2.0, 0.08, 0.08, M.darkMetal, 0, 0, 3.4);
  for (const s of [-1, 1]) box(g, 0.3, 0.7, 0.3, M.darkMetal, s * 1.15, 0.9, -3.4); // Stützen
  const muzzle = mkMuzzle(barrel, 4.2);
  return { root: g, turret, barrel, muzzle, height: 3.2 };
}

// ---------------- Panzerspähwagen ----------------
function armoredCar(fac, o) {
  return (side, type, ctx) => {
    const M = ctx.M, F = fm(fac, ctx.season), g = new THREE.Group();
    const zs = []; for (let i = 0; i < o.n; i++) zs.push(o.L / 2 - 0.8 - i * ((o.L - 1.6) / (o.n - 1)));
    wheels(g, M, o.W / 2 - 0.05, zs, o.r, 0.36);
    add(g, profGeo(o.hull, o.W - 0.3), F.body, 0, 0, 0);
    for (const s of [-1, 1]) box(g, 0.1, 0.5, o.L * 0.8, F.body, s * (o.W / 2 - 0.05), o.r * 2 + 0.1, 0, 0, 0, s * 0.3);
    const turret = new THREE.Group(); turret.position.set(0, o.ty, o.tz); g.add(turret);
    if (o.tpts) add(turret, profGeo(o.tpts, o.tw), F.body, 0, 0, 0);
    else dome(turret, F.body, o.tw / 2, 0.45, o.tw / 2 + 0.1, 0, 0.1, 0, 10);
    const barrel = mkBarrel(turret, 0, o.gy, o.gz);
    box(barrel, 0.4, 0.3, 0.25, F.body, 0, 0, 0.05);
    const end = tube(barrel, o.gr, o.gl, 0.1, { brake: o.brake });
    const muzzle = mkMuzzle(barrel, end + 0.1);
    o.extra && o.extra(g, turret, F, M);
    marks(fac, g, o.marks);
    return { root: g, turret, barrel, muzzle, height: 2.6 };
  };
}
const puma = armoredCar('DE', {
  L: 6.0, W: 2.4, n: 4, r: 0.55, ty: 1.55, tz: 0, tw: 1.7, gy: 0.35, gz: 0.8, gr: 0.05, gl: 2.5, brake: true,
  hull: [[-3.0, 0.7], [-3.0, 1.45], [-2.2, 1.6], [0.8, 1.6], [3.0, 1.1], [3.0, 0.7]],
  tpts: [[-0.9, 0], [-0.9, 0.55], [-0.5, 0.8], [0.5, 0.8], [1.0, 0.45], [1.0, 0]],
  extra: (g, t, F, M) => { box(t, 1.5, 0.05, 1.5, M.darkMetal, 0, 0.84, -0.1); ant(g, 0.9, 1.6, -2.4, 2.5); box(g, 0.1, 0.2, 5.0, M.darkMetal, 1.25, 1.1, 0); },
  marks: [['+x', 1.16, 1.2, -0.3, 0.38], ['-x', -1.16, 1.2, -0.3, 0.38]],
});
const ba64 = armoredCar('SU', {
  L: 3.8, W: 1.9, n: 2, r: 0.45, ty: 1.4, tz: -0.1, tw: 1.1, gy: 0.1, gz: 0.4, gr: 0.03, gl: 0.9, brake: false,
  hull: [[-1.9, 0.6], [-1.9, 1.25], [-1.2, 1.4], [0.5, 1.4], [1.8, 1.0], [1.8, 0.6]],
  tpts: [[-0.55, 0], [-0.55, 0.5], [-0.3, 0.6], [0.3, 0.6], [0.6, 0.3], [0.6, 0]],
  extra: () => {},
  marks: [['+x', 0.96, 1.0, -0.6, 0.26], ['-x', -0.96, 1.0, -0.6, 0.26]],
});

export const WHEELED_MODELS = {
  ww2_m3ht: m3, ww2_sdkfz251: sdkfz251, ww2_carrier: carrier, ww2_jeep: jeep, ww2_kubel: kubel,
  ww2_gmc: gmc, ww2_bedford: bedford, ww2_zis_truck: zis, ww2_opel: opel, ww2_bm13: bm13, ww2_puma: puma, ww2_ba64: ba64,
};
