// WK2: Kettenfahrzeuge (Panzer, Jagdpanzer, Sturmgeschütze, Selbstfahrlafetten)
import { K, THREE, add, box, cyl, trackSet, fm, X, profGeo, prof, dome, insignia, numerals, tube, mkBarrel, mkMuzzle } from './kit.js';

const PI = Math.PI;

// Generischer Panzerbau. spec: { fac, L, track, hull, hullW, skirts, fenders, turret:{kind,y,z,pts,w,dome}, gun:{y,z,r,len,brake,pitch}, hx, tx, marks, height }
function buildTank(spec, side, type, ctx) {
  const M = ctx.M, x = X(), F = fm(spec.fac, ctx.season);
  const g = new THREE.Group();
  const t = spec.track;
  for (const s of [-1, 1]) trackSet(g, s, t.x, spec.L, { w: t.w, h: t.h, n: t.n, wr: t.wr, y: t.y ?? 0.52 });
  add(g, profGeo(spec.hull, spec.hullW), F.body, 0, 0, 0);
  if (spec.skirts) for (const s of [-1, 1]) for (const k of spec.skirts) box(g, 0.04, k.h, k.len, F.body, s * k.x, k.y, k.z);
  if (spec.fenders) for (const s of [-1, 1]) box(g, spec.fenders.w, 0.06, spec.fenders.len, F.body, s * spec.fenders.x, spec.fenders.y, spec.fenders.z || 0);
  const turret = new THREE.Group();
  turret.position.set(0, spec.turret.y, spec.turret.z);
  g.add(turret);
  const tu = spec.turret;
  if (tu.kind === 'dome') dome(turret, F.body, tu.dome[0], tu.dome[1], tu.dome[2], 0, 0, 0, 14);
  else if (tu.kind === 'prof') add(turret, profGeo(tu.pts, tu.w), F.body, 0, 0, 0);
  const gn = spec.gun;
  const barrel = mkBarrel(turret, gn.x || 0, gn.y, gn.z);
  if (gn.pitch) barrel.rotation.x = gn.pitch;
  if (gn.mantlet) box(barrel, gn.mantlet[0], gn.mantlet[1], gn.mantlet[2], F.body, 0, 0, 0.02);
  if (gn.sleeve) cyl(barrel, gn.sleeve[0], gn.sleeve[0], gn.sleeve[1], M.darkMetal, 0, 0, gn.sleeve[1] / 2 + 0.1, PI / 2, 0, 0, 8);
  const end = tube(barrel, gn.r || 0.06, gn.len, 0, { brake: gn.brake });
  const muzzle = mkMuzzle(barrel, end + 0.1);
  if (spec.hx) spec.hx(g, F, M, x);
  if (spec.tx) spec.tx(turret, F, M, x);
  for (const m of spec.marks || []) {
    const [where, px, py, pz, r] = m;
    if (where === 'h') for (const s of [-1, 1]) insignia(spec.fac, g, r, s > 0 ? '+x' : '-x', s * px, py, pz);
    else if (where === 't') for (const s of [-1, 1]) insignia(spec.fac, turret, r, s > 0 ? '+x' : '-x', s * px, py, pz);
    else if (where === 'top') insignia(spec.fac, g, r, 'top', px, py, pz);
    else if (where === 'ttop') insignia(spec.fac, turret, r, 'top', px, py, pz);
    else if (where === 'num') for (const s of [-1, 1]) numerals(turret, s > 0 ? '+x' : '-x', s * px, py, pz, r, 3);
  }
  if (spec.fac === 'SU' || spec.fac === 'US' || spec.fac === 'UK') { /* Fraktions-Funkantenne */ }
  return { root: g, turret, barrel, muzzle, height: spec.height || 2.8 };
}

const hatch = (p, mat, px, py, pz, r = 0.26) => { cyl(p, r, r, 0.08, mat, px, py, pz, 0, 0, 0, 8); };
const jerry = (p, mat, px, py, pz) => box(p, 0.4, 0.5, 0.18, mat, px, py, pz);
const ant = (p, px, py, pz, len = 2.2) => K.antenna(p, px, py, pz, len, 0.05);

// ---------------- Sherman-Familie ----------------
const SHERMAN_HULL = [[-2.9, 0.5], [-2.95, 1.38], [-2.45, 1.72], [1.1, 1.76], [2.5, 1.12], [2.95, 0.9], [2.95, 0.5]];
function shermanHull(g, F, M) {
  K.sphG && add(g, K.sphG(1, 12, 6), F.body, 0, 1.0, 2.7).scale.set(1.0, 0.55, 0.6); // gerundete Getriebehaube
  box(g, 1.4, 0.05, 1.2, M.darkMetal, 0, 1.78, -1.7); // Motorgitter
  hatch(g, F.body, -0.6, 1.8, 1.3); hatch(g, F.body, 0.6, 1.8, 1.3);
  box(g, 0.3, 0.12, 0.3, M.optic, 0.6, 1.84, 1.45);
  for (const s of [-1, 1]) { box(g, 0.1, 0.18, 0.5, M.darkMetal, s * 1.0, 1.82, -2.7); jerry(g, M.darkMetal, s * 0.9, 1.95, -2.6); }
  ant(g, 1.0, 1.7, -2.8, 2.4);
}
function shermanTurretBits(t, F, M, bust) {
  cyl(t, 1.12, 1.18, 0.14, F.body, 0, -0.07, 0, 0, 0, 0, 16);
  cyl(t, 0.3, 0.32, 0.16, F.body, -0.5, 0.52, -0.35, 0, 0, 0, 10); // Kommandantenkuppel
  cyl(t, 0.27, 0.27, 0.06, M.darkMetal, -0.5, 0.62, -0.35, 0.4, 0, 0, 10);
  box(t, 0.06, 0.06, 0.6, M.gunMetal, -0.5, 0.72, -0.1); // .50 cal
  hatch(t, F.body, 0.55, 0.5, -0.35, 0.28);
  if (bust) box(t, 1.9, 0.55, 0.55, F.body, 0, 0.1, -1.55);
  ant(t, 0.9, 0.4, -0.9, 2.4);
}
const sherman = (o) => (side, type, ctx) => buildTank({
  fac: 'US', L: 5.8, track: { x: 1.12, w: o.w || 0.6, h: 0.95, n: 6, wr: 0.36 }, hull: SHERMAN_HULL, hullW: 2.3,
  turret: { kind: 'dome', y: 1.8, z: 0.15, dome: o.dome || [1.15, 0.6, 1.3] },
  gun: { y: 0.12, z: 1.25, r: 0.06, len: o.len, brake: o.brake, mantlet: [0.9, 0.5, 0.3] },
  hx: (g, F, M) => shermanHull(g, F, M),
  tx: (t, F, M) => shermanTurretBits(t, F, M, o.bust),
  marks: [['h', 1.16, 1.4, -0.9, 0.34], ['t', 1.1, 0.12, -0.15, 0.3]],
  height: 2.75,
}, side, type, ctx);

function firefly(side, type, ctx) {
  return buildTank({
    fac: 'UK', L: 5.8, track: { x: 1.12, w: 0.62, h: 0.95, n: 6, wr: 0.36 }, hull: SHERMAN_HULL, hullW: 2.3,
    turret: { kind: 'dome', y: 1.8, z: 0.1, dome: [1.18, 0.6, 1.4] },
    gun: { y: 0.1, z: 1.35, r: 0.075, len: 3.9, brake: 'big', mantlet: [0.8, 0.45, 0.3], sleeve: [0.12, 0.6] },
    hx: (g, F, M) => shermanHull(g, F, M),
    tx: (t, F, M) => { shermanTurretBits(t, F, M, true); box(t, 2.0, 0.7, 0.9, F.body, 0, 0.12, -1.75); },
    marks: [['h', 1.16, 1.4, -0.9, 0.34], ['t', 1.12, 0.12, -0.2, 0.28], ['ttop', 0.0, 0.58, -0.1, 0.3]],
    height: 2.75,
  }, side, type, ctx);
}

function m10(side, type, ctx) {
  const M = ctx.M;
  return buildTank({
    fac: 'US', L: 5.8, track: { x: 1.12, w: 0.6, h: 0.95, n: 6, wr: 0.36 },
    hull: [[-2.9, 0.5], [-2.95, 1.3], [-2.45, 1.6], [1.0, 1.62], [2.45, 1.05], [2.95, 0.9], [2.95, 0.5]], hullW: 2.3,
    turret: { kind: 'none', y: 1.62, z: 0.2 },
    gun: { y: 0.45, z: 1.35, r: 0.065, len: 3.0, brake: true, mantlet: [0.8, 0.5, 0.3] },
    hx: (g, F, M) => { shermanHull(g, F, M); },
    tx: (t, F, M) => {
      box(t, 2.2, 0.08, 2.7, F.body, 0, 0.04, -0.1);
      for (const s of [-1, 1]) {
        box(t, 0.08, 0.75, 2.4, F.body, s * 1.1, 0.42, -0.25);
        box(t, 0.08, 0.75, 1.0, F.body, s * 0.85, 0.42, 1.25, 0, s * 0.6, 0);
      }
      box(t, 1.2, 0.75, 0.08, F.body, 0, 0.42, 1.55, -0.45, 0, 0);
      box(t, 2.2, 0.8, 0.9, F.body, 0, 0.42, -1.5); // Gegengewicht
      box(t, 0.06, 0.06, 0.7, M.gunMetal, 0.6, 0.95, -0.4); // .50 cal
      cyl(t, 0.1, 0.1, 0.5, M.darkMetal, 0.6, 0.7, -0.4, 0, 0, 0, 6);
    },
    marks: [['h', 1.16, 1.3, -0.9, 0.32]],
    height: 2.4,
  }, side, type, ctx);
}

function priest(side, type, ctx) {
  return buildTank({
    fac: 'US', L: 5.8, track: { x: 1.12, w: 0.6, h: 0.95, n: 6, wr: 0.36 }, hull: SHERMAN_HULL, hullW: 2.3,
    turret: { kind: 'none', y: 2.05, z: 0.6 },
    gun: { y: 0.1, z: 0.7, r: 0.09, len: 2.0, brake: true, mantlet: [0.8, 0.7, 0.5], pitch: -0.12 },
    hx: (g, F, M) => {
      shermanHull(g, F, M);
      for (const s of [-1, 1]) box(g, 0.1, 0.9, 2.8, F.body, s * 1.14, 2.2, -0.45);
      box(g, 2.3, 0.9, 0.1, F.body, 0, 2.2, -1.85);
      box(g, 2.3, 0.7, 0.1, F.body, 0, 2.15, 0.95, -0.25, 0, 0);
      cyl(g, 0.45, 0.45, 0.55, F.body, -0.8, 2.3, 0.7, 0, 0, 0, 10); // Kommandantenstand (Pulpit)
      box(g, 0.06, 0.06, 0.8, K.M.gunMetal, -0.8, 2.75, 0.8);
    },
    tx: () => {},
    marks: [['h', 1.16, 1.4, -0.9, 0.34]],
    height: 3.0,
  }, side, type, ctx);
}

// ---------------- Briten ----------------
function cromwell(side, type, ctx) {
  return buildTank({
    fac: 'UK', L: 6.0, track: { x: 1.32, w: 0.5, h: 0.9, n: 5, wr: 0.5, y: 0.5 },
    hull: [[-3.2, 0.5], [-3.2, 1.55], [-2.6, 1.6], [2.3, 1.6], [3.0, 1.35], [3.1, 0.85], [3.1, 0.5]], hullW: 2.9,
    fenders: { x: 1.32, w: 0.8, y: 1.05, len: 5.6 },
    turret: { kind: 'prof', y: 1.6, z: 0.1, pts: [[-1.3, 0], [-1.3, 0.7], [-0.9, 0.85], [0.7, 0.85], [1.2, 0.55], [1.25, 0]], w: 2.1 },
    gun: { y: 0.35, z: 1.2, r: 0.06, len: 2.5, brake: false, mantlet: [0.7, 0.5, 0.25] },
    hx: (g, F, M) => {
      box(g, 1.6, 0.06, 1.2, M.darkMetal, 0, 1.63, -2.4);
      hatch(g, F.body, -0.7, 1.64, 1.6); hatch(g, F.body, 0.7, 1.64, 1.6);
      cyl(g, 0.12, 0.12, 0.15, M.gunMetal, 0.0, 1.2, 3.12, PI / 2, 0, 0, 6);
      ant(g, 1.1, 1.6, -2.9, 2.6);
    },
    tx: (t, F, M) => { cyl(t, 0.3, 0.3, 0.2, F.body, -0.45, 0.92, -0.4, 0, 0, 0, 10); hatch(t, F.body, 0.5, 0.88, -0.45, 0.25); box(t, 1.6, 0.3, 0.4, M.darkMetal, 0, 0.35, -1.4); },
    marks: [['h', 1.46, 1.3, 0.0, 0.34], ['ttop', 0, 0.86, 0.1, 0.35]],
    height: 2.5,
  }, side, type, ctx);
}
function churchill(side, type, ctx) {
  return buildTank({
    fac: 'UK', L: 7.3, track: { x: 1.5, w: 0.62, h: 1.5, n: 9, wr: 0.2, y: 0.82 },
    hull: [[-3.4, 0.6], [-3.4, 1.55], [-2.8, 1.65], [2.8, 1.65], [3.3, 1.4], [3.4, 0.8]], hullW: 2.9,
    fenders: { x: 1.5, w: 0.7, y: 1.62, len: 7.0 },
    turret: { kind: 'prof', y: 1.65, z: 0.3, pts: [[-1.4, 0], [-1.4, 0.75], [-1.0, 0.92], [0.9, 0.92], [1.45, 0.5], [1.45, 0]], w: 2.3 },
    gun: { y: 0.35, z: 1.3, r: 0.065, len: 2.6, brake: false, mantlet: [0.8, 0.55, 0.3] },
    hx: (g, F, M) => {
      for (const s of [-1, 1]) { box(g, 0.66, 1.0, 1.1, M.track, s * 1.5, 1.2, 3.4, 0.7, 0, 0); box(g, 0.66, 0.9, 1.0, M.track, s * 1.5, 1.15, -3.5, -0.7, 0, 0); }
      box(g, 1.6, 0.08, 1.4, M.darkMetal, 0, 1.68, -2.4);
      ant(g, 1.2, 1.7, -2.9, 2.6);
    },
    tx: (t, F, M) => { cyl(t, 0.32, 0.32, 0.2, F.body, -0.5, 0.95, -0.3, 0, 0, 0, 10); hatch(t, F.body, 0.55, 0.95, -0.4, 0.26); box(t, 0.06, 0.06, 0.6, M.gunMetal, 0.9, 0.55, 1.5); },
    marks: [['h', 1.46, 1.95, 0.0, 0.0001], ['ttop', 0, 0.93, 0.2, 0.38], ['t', 1.2, 0.4, 0, 0.3]],
    height: 2.65,
  }, side, type, ctx);
}

// ---------------- Rote Armee ----------------
const T34_HULL = [[-3.0, 0.55], [-3.0, 1.1], [-2.5, 1.35], [-1.0, 1.55], [0.9, 1.55], [2.85, 0.85], [2.9, 0.55]];
function t34Hull(g, F, M, x) {
  for (const s of [-1, 1]) {
    box(g, 0.8, 0.06, 4.2, F.body, s * 1.38, 1.28, -0.2);
    cyl(g, 0.2, 0.2, 0.9, M.darkMetal, s * 1.5, 1.5, -1.9, 0, 0, PI / 2, 8); // Zusatztank
  }
  cyl(g, 0.14, 0.14, 2.8, M.wood2, 0.9, 1.42, 0.2, PI / 2, 0, 0, 6); // Baumstamm
  box(g, 1.5, 0.05, 1.3, M.darkMetal, 0, 1.58, -1.8);
  hatch(g, F.body, 0, 1.0, 2.4, 0.22);
}
const t34 = (big) => (side, type, ctx) => buildTank({
  fac: 'SU', L: 5.9, track: { x: 1.35, w: 0.5, h: 0.9, n: 5, wr: 0.5, y: 0.5 }, hull: T34_HULL, hullW: 2.6,
  turret: big ? { kind: 'dome', y: 1.55, z: 0.15, dome: [1.22, 0.55, 1.4] } : { kind: 'dome', y: 1.55, z: 0.25, dome: [1.0, 0.55, 1.15] },
  gun: big ? { y: 0.1, z: 1.4, r: 0.065, len: 3.4, brake: true, mantlet: [0.5, 0.45, 0.3] } : { y: 0.12, z: 1.1, r: 0.055, len: 2.7, brake: false, mantlet: [0.45, 0.4, 0.3] },
  hx: t34Hull,
  tx: (t, F, M) => {
    cyl(t, 1.0, 1.05, 0.14, F.body, 0, -0.07, 0, 0, 0, 0, 16);
    if (big) { hatch(t, F.body, 0.45, 0.5, -0.35, 0.27); cyl(t, 0.3, 0.32, 0.2, F.body, -0.45, 0.5, -0.4, 0, 0, 0, 10); box(t, 0.06, 0.06, 0.5, M.gunMetal, -0.45, 0.68, -0.2); }
    else { hatch(t, F.body, 0.4, 0.55, -0.25, 0.26); hatch(t, F.body, -0.4, 0.55, -0.25, 0.26); }
    ant(t, 0.7, 0.3, -0.9, 2.2);
  },
  marks: [['t', big ? 1.2 : 1.0, 0.12, 0, 0.3], ['num', big ? 1.22 : 1.02, 0.12, -0.55, 0.28]],
  height: 2.5,
}, side, type, ctx);

function kv1(side, type, ctx) {
  return buildTank({
    fac: 'SU', L: 6.4, track: { x: 1.4, w: 0.6, h: 0.95, n: 6, wr: 0.42 },
    hull: [[-3.3, 0.5], [-3.3, 1.45], [-2.7, 1.65], [2.0, 1.65], [3.05, 1.35], [3.3, 1.0], [3.3, 0.5]], hullW: 3.0,
    fenders: { x: 1.4, w: 0.9, y: 1.35, len: 5.4 },
    turret: { kind: 'dome', y: 1.65, z: 0.1, dome: [1.25, 0.6, 1.35] },
    gun: { y: 0.1, z: 1.3, r: 0.06, len: 3.0, brake: false, mantlet: [0.6, 0.5, 0.3] },
    hx: (g, F, M) => { box(g, 1.6, 0.06, 1.4, M.darkMetal, 0, 1.68, -2.3); hatch(g, F.body, 0, 1.68, 1.5, 0.22); jerry(g, M.darkMetal, -1.3, 1.65, -2.2); jerry(g, M.darkMetal, 1.3, 1.65, -2.2); },
    tx: (t, F, M) => { cyl(t, 1.15, 1.2, 0.14, F.body, 0, -0.07, 0, 0, 0, 0, 16); cyl(t, 0.3, 0.32, 0.2, F.body, -0.5, 0.55, -0.45, 0, 0, 0, 10); hatch(t, F.body, 0.5, 0.55, -0.45, 0.26); },
    marks: [['t', 1.25, 0.12, 0, 0.32], ['num', 1.27, 0.12, -0.6, 0.28]],
    height: 2.75,
  }, side, type, ctx);
}
function is2(side, type, ctx) {
  return buildTank({
    fac: 'SU', L: 6.6, track: { x: 1.38, w: 0.6, h: 0.95, n: 6, wr: 0.46 },
    hull: [[-3.2, 0.55], [-3.2, 1.4], [-2.7, 1.55], [0.4, 1.6], [3.3, 0.85], [3.3, 0.55]], hullW: 2.9,
    fenders: { x: 1.38, w: 0.85, y: 1.3, len: 5.2 },
    turret: { kind: 'dome', y: 1.6, z: 0.35, dome: [1.22, 0.58, 1.4] },
    gun: { y: 0.1, z: 1.4, r: 0.075, len: 4.1, brake: 'big', mantlet: [0.55, 0.5, 0.35] },
    hx: (g, F, M) => { cyl(g, 0.2, 0.2, 1.0, M.darkMetal, 1.5, 1.5, -2.2, 0, 0, PI / 2, 8); box(g, 1.5, 0.05, 1.3, M.darkMetal, 0, 1.62, -2.2); },
    tx: (t, F, M) => {
      cyl(t, 1.1, 1.15, 0.14, F.body, 0, -0.07, 0, 0, 0, 0, 16);
      cyl(t, 0.3, 0.32, 0.2, F.body, -0.5, 0.5, -0.5, 0, 0, 0, 10); hatch(t, F.body, 0.5, 0.5, -0.5, 0.26);
      cyl(t, 0.04, 0.04, 0.9, M.gunMetal, -0.5, 0.78, -0.2, PI / 2, 0, 0, 6); // DShK
    },
    marks: [['t', 1.2, 0.12, 0, 0.32], ['num', 1.22, 0.12, -0.6, 0.28]],
    height: 2.55,
  }, side, type, ctx);
}
function su76(side, type, ctx) {
  return buildTank({
    fac: 'SU', L: 4.8, track: { x: 1.15, w: 0.5, h: 0.9, n: 4, wr: 0.4 },
    hull: [[-2.4, 0.5], [-2.4, 1.2], [0.5, 1.2], [2.3, 0.95], [2.4, 0.5]], hullW: 2.5,
    turret: { kind: 'none', y: 1.95, z: 0.55 },
    gun: { y: 0, z: 0.5, r: 0.05, len: 2.5, brake: false, mantlet: [0.6, 0.55, 0.3] },
    hx: (g, F, M) => {
      for (const s of [-1, 1]) box(g, 0.08, 0.85, 2.8, F.body, s * 1.2, 1.62, -1.0);
      box(g, 2.4, 0.85, 0.08, F.body, 0, 1.62, -2.35);
      box(g, 2.4, 0.9, 0.1, F.body, 0, 1.7, 0.5, 0.35, 0, 0);
      box(g, 0.5, 0.3, 0.4, M.darkMetal, 0.7, 1.4, -1.5);
    },
    tx: () => {},
    marks: [['h', 1.26, 1.5, -1.0, 0.0001], ['t', 0.6, 0.0, -0.4, 0.0001]],
    height: 2.5,
  }, side, type, ctx);
}
function su100(side, type, ctx) {
  return buildTank({
    fac: 'SU', L: 5.9, track: { x: 1.35, w: 0.5, h: 0.9, n: 5, wr: 0.5, y: 0.5 }, hull: T34_HULL, hullW: 2.6,
    turret: { kind: 'none', y: 1.95, z: 1.55 },
    gun: { y: 0, z: 0.4, r: 0.07, len: 4.3, brake: false, mantlet: [0.5, 0.5, 0.3] },
    hx: (g, F, M) => {
      add(g, profGeo([[-1.6, 0], [-1.6, 0.65], [-1.2, 0.85], [1.0, 0.85], [1.9, 0.25], [1.9, 0]], 2.4), F.body, 0, 1.5, 0.15);
      cyl(g, 0.3, 0.32, 0.2, F.body, 0.6, 2.42, -0.3, 0, 0, 0, 10);
      hatch(g, F.body, -0.6, 2.38, -0.2, 0.26);
      for (const s of [-1, 1]) cyl(g, 0.2, 0.2, 0.9, M.darkMetal, s * 1.5, 1.45, -2.2, 0, 0, PI / 2, 8);
      cyl(g, 0.14, 0.14, 2.8, M.wood2, -0.9, 1.35, -0.5, PI / 2, 0, 0, 6);
      ant(g, -0.9, 2.3, -1.2, 2.2);
    },
    tx: () => {},
    marks: [['h', 1.31, 1.45, -1.9, 0.0001]],
    height: 2.6,
  }, side, type, ctx);
}

// ---------------- Wehrmacht ----------------
const PZ4_HULL = [[-2.95, 0.5], [-2.95, 1.4], [-2.4, 1.5], [0.9, 1.55], [1.3, 1.4], [2.95, 1.35], [2.95, 0.5]];
const pzTrack = { x: 1.38, w: 0.42, h: 0.75, n: 8, wr: 0.27, y: 0.45 };
function pz4(side, type, ctx) {
  return buildTank({
    fac: 'DE', L: 5.9, track: pzTrack, hull: PZ4_HULL, hullW: 2.5,
    skirts: [{ x: 1.55, y: 1.15, h: 0.75, len: 4.6, z: -0.1 }, { x: 1.4, y: 1.95, h: 0.5, len: 1.9, z: 0.0 }],
    turret: { kind: 'prof', y: 1.55, z: -0.05, pts: [[-1.2, 0], [-1.2, 0.75], [-0.9, 0.86], [0.9, 0.86], [1.15, 0.7], [1.15, 0]], w: 2.0 },
    gun: { y: 0.18, z: 1.15, r: 0.065, len: 3.4, brake: true, mantlet: [0.55, 0.45, 0.3] },
    hx: (g, F, M) => { box(g, 1.4, 0.06, 1.2, M.darkMetal, 0, 1.58, -2.2); box(g, 0.6, 0.15, 0.5, M.darkMetal, 0.9, 1.4, 1.7); for (const s of [-1, 1]) jerry(g, M.darkMetal, s * 0.8, 1.62, -2.7); },
    tx: (t, F, M) => { cyl(t, 0.36, 0.36, 0.28, F.body, -0.4, 0.95, -0.5, 0, 0, 0, 10); hatch(t, F.body, 0.45, 0.88, -0.5, 0.24); box(t, 1.6, 0.3, 0.35, M.darkMetal, 0, 0.4, -1.35); for (const s of [-1, 1]) box(t, 0.06, 0.6, 1.8, F.body, s * 1.2, 0.4, -0.1); ant(t, 0.8, 0.8, -0.9, 2.4); },
    marks: [['h', 1.26, 1.1, 1.3, 0.38], ['t', 1.1, 0.4, 0.25, 0.3]],
    height: 2.7,
  }, side, type, ctx);
}
function panther(side, type, ctx) {
  return buildTank({
    fac: 'DE', L: 6.9, track: { x: 1.5, w: 0.5, h: 0.9, n: 8, wr: 0.52, y: 0.5 },
    hull: [[-3.4, 0.55], [-3.4, 1.45], [-2.9, 1.65], [-0.4, 1.75], [0.4, 1.8], [3.0, 1.05], [3.3, 0.65]], hullW: 3.1,
    skirts: [{ x: 1.75, y: 1.2, h: 0.8, len: 5.4, z: -0.2 }],
    turret: { kind: 'prof', y: 1.8, z: 0.45, pts: [[-1.5, 0], [-1.5, 0.7], [-1.0, 0.88], [0.4, 0.9], [1.1, 0.65], [1.35, 0.2], [1.35, 0]], w: 2.4 },
    gun: { y: 0.35, z: 1.4, r: 0.075, len: 4.8, brake: 'big', mantlet: [0.8, 0.7, 0.35] },
    hx: (g, F, M) => { box(g, 1.7, 0.06, 1.4, M.darkMetal, 0, 1.78, -2.5); hatch(g, F.body, -0.7, 1.9, 1.7, 0.22); hatch(g, F.body, 0.7, 1.9, 1.7, 0.22); },
    tx: (t, F, M) => { cyl(t, 0.36, 0.38, 0.3, F.body, -0.55, 0.95, -0.6, 0, 0, 0, 10); hatch(t, F.body, 0.55, 0.9, -0.6, 0.26); ant(t, 0.9, 0.7, -1.2, 2.6); },
    marks: [['h', 1.56, 1.3, 0.3, 0.42], ['t', 1.2, 0.4, -0.2, 0.34]],
    height: 3.0,
  }, side, type, ctx);
}
function tiger(side, type, ctx) {
  return buildTank({
    fac: 'DE', L: 6.3, track: { x: 1.5, w: 0.66, h: 0.85, n: 8, wr: 0.5, y: 0.5 },
    hull: [[-3.1, 0.55], [-3.1, 1.6], [-2.8, 1.72], [2.6, 1.74], [3.1, 1.55], [3.1, 0.55]], hullW: 3.1,
    skirts: null,
    turret: { kind: 'prof', y: 1.74, z: -0.1, pts: [[-1.35, 0], [-1.35, 0.8], [-1.1, 0.95], [1.0, 0.95], [1.4, 0.8], [1.4, 0]], w: 2.4 },
    gun: { y: 0.3, z: 1.35, r: 0.075, len: 5.3, brake: 'big', mantlet: [0.9, 0.75, 0.4] },
    hx: (g, F, M) => {
      box(g, 1.8, 0.06, 1.5, M.darkMetal, 0, 1.76, -2.4);
      box(g, 0.7, 0.12, 0.6, M.darkMetal, 0.9, 1.78, 1.9); hatch(g, F.body, -0.8, 1.78, 1.9, 0.24);
      for (const s of [-1, 1]) { box(g, 0.1, 0.2, 5.4, F.body, s * 1.6, 1.78, -0.1); jerry(g, M.darkMetal, s * 1.2, 1.9, -2.8); }
    },
    tx: (t, F, M) => { cyl(t, 0.4, 0.42, 0.34, F.body, -0.55, 0.98, -0.2, 0, 0, 0, 10); hatch(t, F.body, 0.6, 0.97, -0.5, 0.26); box(t, 2.2, 0.55, 0.3, F.body, 0, 0.35, -1.5); ant(t, 0.95, 0.8, -1.1, 2.6); },
    marks: [['h', 1.56, 1.3, -1.8, 0.45], ['t', 1.2, 0.45, 0.3, 0.38]],
    height: 2.95,
  }, side, type, ctx);
}
function stug(side, type, ctx) {
  return buildTank({
    fac: 'DE', L: 6.2, track: { x: 1.35, w: 0.4, h: 0.65, n: 6, wr: 0.3, y: 0.42 },
    hull: [[-3.0, 0.5], [-3.0, 1.3], [-2.3, 1.35], [-1.2, 1.4], [-1.0, 2.0], [0.6, 2.1], [1.3, 1.55], [2.9, 1.4], [2.95, 0.5]], hullW: 2.7,
    skirts: [{ x: 1.5, y: 1.15, h: 0.7, len: 4.8, z: -0.2 }, { x: 1.4, y: 1.8, h: 0.45, len: 2.6, z: -0.2 }],
    turret: { kind: 'none', y: 1.75, z: 1.1 },
    gun: { y: 0.0, z: 0.4, r: 0.065, len: 3.2, brake: true, mantlet: [0.5, 0.45, 0.35] },
    hx: (g, F, M) => {
      cyl(g, 0.28, 0.3, 0.22, F.body, -0.6, 2.18, -0.3, 0, 0, 0, 10); box(g, 0.4, 0.2, 0.3, M.optic, -0.6, 2.3, -0.2);
      hatch(g, F.body, 0.6, 2.12, -0.4, 0.26); box(g, 0.5, 0.35, 0.05, M.darkMetal, 0.2, 2.3, 0.5);
      box(g, 1.4, 0.06, 1.0, M.darkMetal, 0, 1.43, -2.2);
    },
    tx: () => {},
    marks: [['h', 1.36, 1.0, 1.9, 0.38]],
    height: 2.4,
  }, side, type, ctx);
}
function hetzer(side, type, ctx) {
  return buildTank({
    fac: 'DE', L: 5.4, track: { x: 1.1, w: 0.4, h: 0.7, n: 4, wr: 0.42, y: 0.45 },
    hull: [[-2.7, 0.5], [-2.7, 1.2], [-2.2, 1.3], [-1.2, 1.45], [-0.5, 1.9], [0.2, 2.0], [1.6, 1.2], [2.7, 1.0], [2.7, 0.5]], hullW: 2.4,
    skirts: [{ x: 1.3, y: 1.1, h: 0.6, len: 4.0, z: -0.2 }],
    turret: { kind: 'none', y: 1.5, z: 1.5 },
    gun: { x: 0.3, y: 0.0, z: 0.3, r: 0.06, len: 3.0, brake: true, mantlet: [0.45, 0.4, 0.3] },
    hx: (g, F, M) => { hatch(g, F.body, -0.6, 2.02, -0.1, 0.25); box(g, 1.2, 0.06, 0.9, M.darkMetal, 0, 1.2, -2.2); },
    tx: () => {},
    marks: [['h', 1.21, 1.1, -1.6, 0.34]],
    height: 2.2,
  }, side, type, ctx);
}
function jagdpz4(side, type, ctx) {
  return buildTank({
    fac: 'DE', L: 6.0, track: pzTrack,
    hull: [[-2.95, 0.5], [-2.95, 1.35], [-2.3, 1.45], [-1.3, 1.5], [-0.9, 2.0], [0.3, 2.05], [1.4, 1.5], [2.95, 1.35], [2.95, 0.5]], hullW: 2.6,
    skirts: [{ x: 1.55, y: 1.15, h: 0.75, len: 4.6, z: -0.1 }],
    turret: { kind: 'none', y: 1.75, z: 1.5 },
    gun: { y: 0.0, z: 0.3, r: 0.07, len: 4.1, brake: 'big', mantlet: [0.5, 0.45, 0.35] },
    hx: (g, F, M) => { cyl(g, 0.28, 0.3, 0.22, F.body, 0.6, 2.18, -0.3, 0, 0, 0, 10); hatch(g, F.body, -0.6, 2.1, -0.4, 0.26); box(g, 1.4, 0.06, 1.0, M.darkMetal, 0, 1.5, -2.2); },
    tx: () => {},
    marks: [['h', 1.31, 1.0, -2.0, 0.38]],
    height: 2.4,
  }, side, type, ctx);
}
function wespe(side, type, ctx) {
  return buildTank({
    fac: 'DE', L: 4.7, track: { x: 1.15, w: 0.4, h: 0.6, n: 5, wr: 0.3, y: 0.4 },
    hull: [[-2.35, 0.45], [-2.35, 1.3], [0.2, 1.35], [1.0, 1.15], [2.35, 1.0], [2.35, 0.45]], hullW: 2.3,
    turret: { kind: 'none', y: 1.95, z: 0.1 },
    gun: { y: 0, z: 0.2, r: 0.08, len: 2.1, brake: false, mantlet: [0.7, 0.6, 0.4], pitch: -0.12 },
    hx: (g, F, M) => {
      for (const s of [-1, 1]) box(g, 0.06, 0.9, 2.5, F.body, s * 1.1, 1.78, -1.1);
      box(g, 2.2, 0.9, 0.06, F.body, 0, 1.78, -2.3); box(g, 2.2, 0.9, 0.06, F.body, 0, 1.78, 0.15);
      box(g, 1.0, 0.5, 0.9, M.darkMetal, 0, 1.55, 1.2);
    },
    tx: () => {},
    marks: [['h', 1.16, 1.0, 1.5, 0.3]],
    height: 2.4,
  }, side, type, ctx);
}

export const TANK_MODELS = {
  ww2_sherman: sherman({ len: 2.5, brake: false }),
  ww2_sherman76: sherman({ len: 3.1, brake: true, w: 0.7, dome: [1.2, 0.6, 1.35], bust: true }),
  ww2_m10: m10,
  ww2_m7: priest,
  ww2_firefly: firefly,
  ww2_cromwell: cromwell,
  ww2_churchill: churchill,
  ww2_t34_76: t34(false),
  ww2_t34_85: t34(true),
  ww2_kv1: kv1,
  ww2_is2: is2,
  ww2_su76: su76,
  ww2_su100: su100,
  ww2_pz4: pz4,
  ww2_panther: panther,
  ww2_tiger: tiger,
  ww2_stug3: stug,
  ww2_hetzer: hetzer,
  ww2_jagdpz4: jagdpz4,
  ww2_wespe: wespe,
};
