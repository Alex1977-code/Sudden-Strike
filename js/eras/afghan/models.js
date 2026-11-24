// Afghanistan-Epoche: prozedurale Modelle. Farben werden aus type.faction (BW|TAL|SA|MUJ|ALL) abgeleitet, nicht aus side.
// Jedes Modell wird je Fraktion unter eigenem Namen (<name>_<FAC>) registriert (Geometrie-Cache in models.js).
// Kennzeichen: BW = Eisernes-Kreuz-Signet (schwarz/weiß), SA = roter Stern; Taliban/Mudschaheddin ohne Flaggen.
import * as THREE from 'three';
import { registerModel } from '../../game/models.js';
import { applyFow } from '../../engine/fow.js';

const FACS = ['BW', 'TAL', 'SA', 'MUJ', 'ALL'];
const reg = (base, fn) => { for (const f of FACS) registerModel(`${base}_${f}`, fn); };

// ---------------- Materialien (lazy, weil M erst nach initMats existiert) ----------------
let A = null;
function mats(ctx) {
  if (A) return A;
  const { camoTexture } = ctx;
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.12, ...o });
  const fs = (o) => applyFow(std(o));
  A = {
    // Bundeswehr
    bwCamo: std({ map: camoTexture(['#a89b76', '#8f8160', '#b8ac88', '#6f6a4c'], 41), roughness: 0.85, metalness: 0.15 }),
    bwTan: std({ color: 0xa89b76 }), bwTanD: std({ color: 0x7d7255 }), bwOlive: std({ color: 0x5f6650 }),
    bwUni: std({ map: camoTexture(['#b3a67c', '#8a7a53', '#6d7454'], 51, 64), roughness: 0.95 }),
    bwPara: std({ map: camoTexture(['#5b6340', '#3d4a2c', '#8c8156', '#25261f'], 52, 64), roughness: 0.95 }),
    bwVest: std({ color: 0x8f8460, roughness: 0.9 }), bwPack: std({ color: 0x7d7352, roughness: 0.95 }),
    beret: std({ color: 0x7a1f2b, roughness: 0.95 }),
    // Sowjetarmee
    saCamo: std({ map: camoTexture(['#5a603f', '#4a5236', '#837a53'], 61), roughness: 0.85, metalness: 0.15 }),
    saGreen: std({ color: 0x4f5a3a }), saUni: std({ color: 0x8d8860, roughness: 0.95 }), saVest: std({ color: 0x5c5a3d, roughness: 0.9 }),
    saHelm: std({ color: 0x4f5a3a, roughness: 0.8 }), saPack: std({ color: 0x4f4c36, roughness: 0.95 }), vdv: std({ color: 0x4f86c4, roughness: 0.95 }),
    star: std({ color: 0xb3161b, roughness: 0.6 }),
    // Mudschaheddin / Taliban
    mujCamo: std({ map: camoTexture(['#6d6c4a', '#5a5a3d', '#8f8662'], 62), roughness: 0.9 }),
    white: std({ color: 0xc9c5b4, roughness: 0.8 }), dirt: std({ color: 0x9c8e6c, roughness: 0.95 }), rust: std({ color: 0x7a5a3c, roughness: 0.9 }),
    shirts: [0xb7a98a, 0x7c8070, 0x5b5242, 0x8c7a5a, 0x9aa08a].map((c) => std({ color: c, roughness: 0.95 })),
    mujShirts: [0x9c8d6b, 0x7a6e55, 0x6c6a52].map((c) => std({ color: c, roughness: 0.95 })),
    hats: [0x8a7656, 0x5e5340, 0x3f3a30].map((c) => std({ color: c, roughness: 0.95 })),
    turban: [0xcfcab8, 0x6f6f66].map((c) => std({ color: c, roughness: 0.95 })),
    rig: std({ color: 0x4a4d38, roughness: 0.9 }), beard: std({ color: 0x2a2118, roughness: 1 }),
    canvas: std({ color: 0x8c8465, roughness: 1 }), canvasW: std({ color: 0xd8d4c4, roughness: 1 }),
    wood: std({ color: 0x6b4a2c, roughness: 0.8 }), black: std({ color: 0x101010, roughness: 0.7 }), cross: std({ color: 0xe8e8e2, roughness: 0.6 }),
    red: std({ color: 0xb3161b, roughness: 0.6 }), grey: std({ color: 0x6a6f74, roughness: 0.6, metalness: 0.3 }), greyL: std({ color: 0x8a8f92, roughness: 0.6, metalness: 0.3 }),
    animal: [0x6e5a44, 0x9a8666].map((c) => std({ color: c, roughness: 1 })),
    // Strukturen (Nebel des Krieges)
    sFabric: fs({ color: 0xb3a67f, roughness: 0.95 }), sFabricW: fs({ color: 0xdedacb, roughness: 0.95 }),
    sHesco: fs({ color: 0x9d9272, roughness: 1 }), sWire: fs({ color: 0x3a3c3d, roughness: 0.5, metalness: 0.8 }),
    sStone: fs({ color: 0x7a6f5c, roughness: 1 }), sStone2: fs({ color: 0x8e826c, roughness: 1 }), sDirt: fs({ color: 0x6b5a42, roughness: 1 }),
    sSteel: fs({ color: 0x6d7174, roughness: 0.6, metalness: 0.5 }), sRed: fs({ color: 0xb3161b, roughness: 0.6 }), sWood: fs({ color: 0x6b4a2c, roughness: 0.85 }),
  };
  return A;
}

// Flache Embleme (zeigen in +z; mit nx = '+x' | '-x' | '+y' | '-z' ausrichten)
let _starG = null;
function starG() {
  if (_starG) return _starG;
  const sh = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.2 : 0.5; const x = Math.cos(a) * r, y = Math.sin(a) * r; i ? sh.lineTo(x, y) : sh.moveTo(x, y); }
  _starG = new THREE.ShapeGeometry(sh); _starG.userData.shared = true;
  return _starG;
}
function face(m, nx) { if (nx === '+x') m.rotation.y = Math.PI / 2; else if (nx === '-x') m.rotation.y = -Math.PI / 2; else if (nx === '+y') m.rotation.x = -Math.PI / 2; else if (nx === '-z') m.rotation.y = Math.PI; }
function star(ctx, p, x, y, z, nx, s = 0.6) {
  const m = ctx.add(p, starG(), mats(ctx).star, x, y, z, 0, 0, 0, false); m.scale.set(s, s, 1); face(m, nx); return m;
}
// Bundeswehr-Signet: weißes Kreuz mit schwarzem Kern
function bwCross(ctx, p, x, y, z, nx, s = 0.5) {
  const a = mats(ctx), t = 0.02;
  const mk = (w, h, mat, dz) => {
    if (nx === '+x' || nx === '-x') return ctx.box(p, t, h, w, mat, x + (nx === '+x' ? dz : -dz), y, z);
    if (nx === '+y') return ctx.box(p, w, t, h, mat, x, y + dz, z);
    return ctx.box(p, w, h, t, mat, x, y, z + (nx === '-z' ? -dz : dz));
  };
  mk(s, s * 0.34, a.cross, 0); mk(s * 0.34, s, a.cross, 0);
  mk(s * 0.78, s * 0.2, a.black, 0.012); mk(s * 0.2, s * 0.78, a.black, 0.012);
}
function emblem(ctx, fac, p, x, y, z, nx, s = 0.5) {
  if (fac === 'BW') bwCross(ctx, p, x, y, z, nx, s); else if (fac === 'SA') star(ctx, p, x, y, z, nx, s * 1.1);
}
// Luftfahrzeuge: kein Kontaktschatten-Blob (models.js hängt ihn sonst auf Flughöhe an die Wurzel)
function noBlobGroup() {
  const g = new THREE.Group();
  const orig = g.add.bind(g);
  g.add = function (...objs) { for (const o of objs) { if (o.material && o.material.map && o.material.transparent && o.geometry && o.geometry.type === 'PlaneGeometry') continue; orig(o); } return g; };
  return g;
}
const hash = (s) => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const facCam = (fac, a) => (fac === 'BW' ? a.bwCamo : fac === 'SA' ? a.saCamo : a.mujCamo);

// ====================== Infanterie ======================
reg('af_soldier', (side, type, ctx) => {
  const { add, box, cyl, sphG, M } = ctx; const a = mats(ctx);
  const fac = type.faction, wm = type.weaponModel || 'rifle';
  const g = new THREE.Group();
  const afg = fac === 'TAL' || fac === 'MUJ';
  const h = hash(wm + fac);
  let uni, vest, pack, glove = M.rubber;
  if (fac === 'BW') { uni = wm === 'para' ? a.bwPara : a.bwUni; vest = a.bwVest; pack = a.bwPack; }
  else if (fac === 'SA') { uni = a.saUni; vest = a.saVest; pack = a.saPack; }
  else { uni = fac === 'TAL' ? a.shirts[h % a.shirts.length] : a.mujShirts[h % a.mujShirts.length]; vest = a.rig; pack = a.dirt; glove = M.skin; }
  const body = new THREE.Group(); g.add(body);
  const mkLeg = (x) => {
    const l = new THREE.Group(); l.position.set(x, 0.92, 0); body.add(l);
    box(l, 0.21, 0.46, 0.25, uni, 0, -0.23, 0);
    box(l, 0.18, 0.42, 0.21, uni, 0, -0.63, 0.01);
    box(l, 0.2, 0.15, 0.36, M.rubber, 0, -0.86, 0.06);
    return l;
  };
  const legL = mkLeg(-0.15), legR = mkLeg(0.15);
  box(body, 0.5, 0.62, 0.3, uni, 0, 1.28, 0);
  if (afg) {
    box(body, 0.54, 0.5, 0.36, uni, 0, 0.82, 0); // Perahan: langes Hemd über der Hose
    if (fac === 'TAL' || wm === 'rifle') box(body, 0.5, 0.3, 0.34, vest, 0, 1.36, 0.01); // Brusttasche/Chest-Rig
    if (fac === 'MUJ') { box(body, 0.07, 0.7, 0.34, M.rubber, 0.0, 1.32, 0.01, 0, 0, 0.7); box(body, 0.2, 0.08, 0.34, a.dirt, 0.1, 1.5, 0.0); } // Patronengurt + Patu
  } else box(body, 0.56, 0.44, 0.36, vest, 0, 1.34, 0.01);
  box(body, 0.38, 0.5, 0.22, pack, 0, 1.36, -0.28);
  add(body, sphG(0.14, 10, 8), M.skin, 0, 1.72, 0.01);
  // Kopfbedeckung
  if (fac === 'BW') {
    if (wm === 'para') { const b = cyl(body, 0.2, 0.19, 0.07, a.beret, 0.02, 1.85, 0, 0, 0, 0.12, 10); }
    else { box(body, 0.25, 0.06, 0.05, M.optic, 0, 1.74, 0.13); const hm = add(body, sphG(0.2, 10, 6), uni, 0, 1.8, 0); hm.scale.set(1, 0.72, 1.1); }
  } else if (fac === 'SA') {
    if (wm === 'vdv') cyl(body, 0.2, 0.19, 0.07, a.vdv, 0.02, 1.85, 0, 0, 0, 0.12, 10);
    else if (wm === 'jtac') { cyl(body, 0.19, 0.2, 0.09, a.saUni, 0, 1.87, 0, 0, 0, 0, 10); box(body, 0.22, 0.02, 0.12, a.black, 0, 1.83, 0.19); star(ctx, body, 0, 1.88, 0.2, '+z', 0.07); }
    else { const hm = add(body, sphG(0.2, 10, 6), a.saHelm, 0, 1.8, 0); hm.scale.set(1, 0.72, 1.1); star(ctx, body, 0, 1.82, 0.225, '+z', 0.1); }
  } else {
    box(body, 0.17, 0.09, 0.08, a.beard, 0, 1.65, 0.1);
    if (fac === 'MUJ' || h % 2) { cyl(body, 0.17, 0.16, 0.12, a.hats[h % a.hats.length], 0, 1.84, 0, 0, 0, 0, 10); cyl(body, 0.19, 0.19, 0.04, a.hats[h % a.hats.length], 0, 1.79, 0, 0, 0, 0, 10); }
    else { const t = add(body, sphG(0.2, 10, 6), a.turban[h % a.turban.length], 0, 1.82, 0); t.scale.set(1, 0.75, 1.1); }
  }
  const mkArm = (x, sRx, eRx, ry) => {
    const ar = new THREE.Group(); ar.position.set(x, 1.5, 0.02); ar.rotation.set(sRx, ry, 0); body.add(ar);
    box(ar, 0.14, 0.34, 0.14, uni, 0, -0.17, 0);
    const e = new THREE.Group(); e.position.y = -0.34; e.rotation.x = eRx; ar.add(e);
    box(e, 0.12, 0.3, 0.12, uni, 0, -0.15, 0);
    box(e, 0.11, 0.1, 0.12, glove, 0, -0.33, 0);
    return ar;
  };
  const armR = mkArm(0.33, -0.9, -0.9, 0);
  mkArm(-0.33, -1.0, -0.5, 0.55);
  const gun = new THREE.Group(); gun.position.set(0.2, 1.38, 0.3); body.add(gun);
  const metal = M.gunMetal, furn = afg || fac === 'SA' ? a.wood : M.rubber;
  const rifle = () => {
    box(gun, 0.07, 0.12, 0.6, metal, 0, 0, 0.2);
    cyl(gun, 0.018, 0.02, 0.4, metal, 0, 0.02, 0.7, Math.PI / 2, 0, 0, 5);
    box(gun, 0.06, 0.1, 0.3, furn, 0, -0.03, -0.25);
    if (fac === 'BW') { box(gun, 0.05, 0.2, 0.08, M.rubber, 0, -0.14, 0.12, 0.2, 0, 0); box(gun, 0.05, 0.05, 0.14, M.optic, 0, 0.09, 0.2); }
    else { box(gun, 0.05, 0.22, 0.07, M.rubber, 0, -0.15, 0.2, 0.45, 0, 0); box(gun, 0.075, 0.08, 0.3, a.wood, 0, -0.02, 0.5); }
  };
  const tube = (r, len, mat, z = 0.1) => cyl(gun, r, r, len, mat, 0, 0, z, Math.PI / 2, 0, 0, 8);
  switch (wm) {
    case 'enfield':
      box(gun, 0.06, 0.1, 1.05, a.wood, 0, 0, 0.35); cyl(gun, 0.018, 0.02, 0.5, metal, 0, 0.03, 0.95, Math.PI / 2, 0, 0, 5); box(gun, 0.03, 0.06, 0.2, metal, 0, 0.07, 0.1);
      break;
    case 'mg':
      box(gun, 0.09, 0.14, 0.8, metal, 0, 0, 0.2); cyl(gun, 0.025, 0.03, 0.5, metal, 0, 0.02, 0.85, Math.PI / 2, 0, 0, 6);
      box(gun, 0.14, 0.14, 0.2, fac === 'BW' ? a.bwTanD : a.saGreen, -0.12, -0.12, 0.1); box(gun, 0.06, 0.1, 0.3, furn, 0, -0.03, -0.3);
      box(gun, 0.03, 0.22, 0.03, metal, 0.05, -0.15, 0.7, 0.35, 0, 0); box(gun, 0.03, 0.22, 0.03, metal, -0.05, -0.15, 0.7, 0.35, 0, 0);
      break;
    case 'sniper':
      box(gun, 0.07, 0.1, 0.9, fac === 'BW' ? M.darkMetal : a.wood, 0, 0, 0.1); cyl(gun, 0.025, 0.03, 0.9, metal, 0, 0, 0.9, Math.PI / 2, 0, 0, 6);
      cyl(gun, 0.05, 0.05, 0.4, M.darkMetal, 0, 0.1, 0.15, Math.PI / 2, 0, 0, 6); box(gun, 0.03, 0.2, 0.03, M.darkMetal, 0.04, -0.12, 0.7, 0.3, 0, 0);
      if (fac === 'BW') cyl(gun, 0.05, 0.05, 0.12, M.darkMetal, 0, 0, 1.4, Math.PI / 2, 0, 0, 6);
      break;
    case 'pzf': case 'milan': {
      gun.position.set(0.18, 1.58, 0.0);
      tube(wm === 'milan' ? 0.09 : 0.07, wm === 'milan' ? 0.95 : 1.1, fac === 'BW' ? a.bwOlive : a.saGreen, 0.15);
      add(gun, sphG(0.12, 8, 6), fac === 'BW' ? a.bwTanD : a.dirt, 0, 0, wm === 'milan' ? 0.7 : 0.75).scale.set(1, 1, 1.4);
      box(gun, 0.1, 0.12, 0.2, M.optic, -0.05, 0.12, 0.0); box(gun, 0.05, 0.15, 0.08, M.darkMetal, 0, -0.14, 0.1);
      if (wm === 'milan') { box(gun, 0.28, 0.24, 0.3, M.darkMetal, -0.04, 0.2, -0.1); box(gun, 0.03, 0.4, 0.03, M.darkMetal, 0.1, -0.2, 0.2, 0.3, 0, 0.2); }
      break; }
    case 'rpg': case 'spg9': {
      gun.position.set(0.18, 1.58, 0.0);
      const L = wm === 'spg9' ? 1.6 : 1.0;
      tube(wm === 'spg9' ? 0.06 : 0.065, L, a.wood, 0.1);
      cyl(gun, 0.13, 0.07, 0.3, M.darkMetal, 0, 0, 0.1 - L / 2, Math.PI / 2, 0, 0, 8);
      add(gun, sphG(0.13, 8, 6), fac === 'SA' ? a.saGreen : a.dirt, 0, 0, 0.1 + L / 2 + 0.2).scale.set(1, 1, 1.5);
      if (wm === 'spg9') { box(gun, 0.03, 0.5, 0.03, M.darkMetal, 0.08, -0.3, 0.1, 0.2, 0, 0.1); box(gun, 0.03, 0.5, 0.03, M.darkMetal, -0.08, -0.3, 0.1, 0.2, 0, -0.1); }
      else box(gun, 0.05, 0.15, 0.08, M.darkMetal, 0, -0.14, 0.1);
      break; }
    case 'stinger': {
      gun.position.set(0.18, 1.58, 0.0);
      tube(0.07, 1.4, a.dirt, 0.15); cyl(gun, 0.1, 0.07, 0.2, M.darkMetal, 0, 0, 0.9, Math.PI / 2, 0, 0, 8); box(gun, 0.08, 0.16, 0.2, M.darkMetal, 0, -0.14, 0.1); box(gun, 0.12, 0.1, 0.12, M.optic, 0.08, 0.12, 0.0);
      break; }
    case 'mortar': {
      cyl(gun, 0.1, 0.09, 1.0, M.darkMetal, 0.0, 0.2, 0.2, 1.0, 0, 0, 8); // Rohr auf der Schulter
      cyl(body, 0.3, 0.3, 0.05, M.darkMetal, 0, 1.4, -0.45, Math.PI / 2, 0, 0, 10); // Bodenplatte auf dem Rücken
      box(body, 0.3, 0.2, 0.3, fac === 'SA' ? a.saGreen : a.dirt, -0.5, 0.1, 0.4); // Munitionskiste
      break; }
    case 'engineer': case 'ied':
      rifle();
      if (wm === 'ied') { box(body, 0.5, 0.45, 0.32, a.dirt, 0, 1.28, -0.44); cyl(body, 0.1, 0.1, 0.1, M.darkMetal, 0.2, 1.1, -0.64, Math.PI / 2, 0, 0, 8); }
      else { box(body, 0.5, 0.45, 0.32, pack, 0, 1.28, -0.44); if (fac === 'BW') box(body, 0.58, 0.14, 0.38, a.cross, 0, 1.52, 0.01); }
      box(body, 0.06, 0.7, 0.04, M.wood2, 0.18, 1.3, -0.64); box(body, 0.22, 0.2, 0.03, M.darkMetal, 0.18, 0.9, -0.64);
      if (fac === 'BW') { box(body, 0.03, 1.5, 0.03, M.darkMetal, -0.2, 1.0, -0.66); cyl(body, 0.15, 0.15, 0.02, M.darkMetal, -0.2, 0.25, -0.66, 0, 0, 0, 10); } // Metalldetektor
      break;
    case 'medic':
      box(gun, 0.08, 0.12, 0.2, M.darkMetal, 0, 0, 0.2);
      box(body, 0.46, 0.5, 0.3, M.white, 0, 1.34, -0.42); box(body, 0.34, 0.09, 0.02, a.red, 0, 1.4, -0.58); box(body, 0.09, 0.34, 0.02, a.red, 0, 1.4, -0.58);
      break;
    case 'jtac':
      box(gun, 0.14, 0.1, 0.1, M.darkMetal, -0.05, 0.25, 0.1); cyl(gun, 0.04, 0.04, 0.14, M.optic, 0.0, 0.25, 0.2, Math.PI / 2, 0, 0, 6); cyl(gun, 0.04, 0.04, 0.14, M.optic, -0.1, 0.25, 0.2, Math.PI / 2, 0, 0, 6);
      box(body, 0.2, 0.3, 0.1, M.darkMetal, 0, 1.4, -0.45); box(body, 0.02, 1.3, 0.02, M.darkMetal, 0.12, 1.9, -0.45);
      break;
    default: rifle();
  }
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, 0.8); gun.add(muzzle);
  g.scale.setScalar(1.45);
  return { root: g, turret: null, barrel: null, muzzle, height: 2.9, body, legs: [legL, legR], arm: armR };
});

// ====================== Bundeswehr: Radfahrzeuge ======================
const ifft = () => {}; // keine Team-Streifen: Fraktionen unterscheiden sich über Farben/Kennzeichen

function mrap(side, type, ctx, eagle) {
  const { add, box, cyl, hullGeo, wheel, antenna, sphG, M } = ctx; const a = mats(ctx);
  const g = new THREE.Group(), c = a.bwCamo;
  const L = eagle ? 5.4 : 5.8;
  for (const s of [-1, 1]) { wheel(g, 0.64, 0.5, s * 1.1, 0.64, 1.6); wheel(g, 0.64, 0.5, s * 1.1, 0.64, -1.5); box(g, 0.3, 0.12, 1.5, c, s * 1.15, 1.35, 1.6); box(g, 0.3, 0.12, 1.5, c, s * 1.15, 1.35, -1.5); }
  add(g, hullGeo(1.5, 0.5, L - 0.6, 0.1, 0.05), a.bwTanD, 0, 0.78, 0); // V-Wanne (Unterboden)
  add(g, hullGeo(2.3, 0.95, L, eagle ? 0.15 : 0.3, 0.05), c, 0, 1.4, 0);
  box(g, 2.25, 1.05, eagle ? 3.2 : 3.0, c, 0, 2.25, eagle ? -0.3 : -0.2); // Kabine
  box(g, 2.2, 0.7, 1.5, c, 0, 1.95, 1.9, eagle ? -0.05 : -0.3, 0, 0); // Motorhaube/Schrägfront
  box(g, 1.9, 0.6, 0.07, M.glass, 0, 2.45, eagle ? 1.32 : 1.3, eagle ? -0.15 : -0.45, 0, 0); // Panzerglas-Front
  for (const s of [-1, 1]) { box(g, 0.07, 0.5, 0.9, M.glass, s * 1.14, 2.45, 0.7); box(g, 0.07, 0.45, 0.8, M.glass, s * 1.14, 2.4, -0.7); box(g, 0.1, 0.35, 0.25, M.darkMetal, s * 1.2, 2.5, 1.35); }
  box(g, 1.9, 0.5, 0.06, M.darkMetal, 0, 1.55, L / 2 + 0.01); // Grill
  ctx.headlights(g, 1.5, L / 2 - 0.02, 0.85, 0.22);
  cyl(g, 0.5, 0.5, 0.15, M.rubber, 0, 2.0, -L / 2 - 0.1, Math.PI / 2, 0, 0, 10); // Reserverad
  for (const s of [-1, 1]) box(g, 0.3, 0.35, 0.5, a.bwTanD, s * 1.1, 1.8, -L / 2 + 0.2); // Kisten
  if (eagle) box(g, 1.8, 0.1, 1.6, M.darkMetal, 0, 2.82, -0.8); // Dachgepäckträger
  antenna(g, -0.8, 2.8, -1.4, 2.4, 0.08); antenna(g, 0.8, 2.8, -1.6, 1.8, -0.06);
  for (const s of [-1, 1]) emblem(ctx, 'BW', g, s * 1.14, 2.0, -0.5, s > 0 ? '+x' : '-x', 0.45);
  const turret = new THREE.Group(); turret.position.set(0.3, 2.85, 0.4); g.add(turret);
  box(turret, 0.7, 0.3, 0.8, M.darkMetal, 0, 0.15, 0);
  const barrel = new THREE.Group(); barrel.position.set(0, 0.5, 0); turret.add(barrel);
  box(barrel, 0.4, 0.3, 0.7, M.darkMetal, 0, 0, 0.1);
  cyl(barrel, 0.035, 0.045, eagle ? 1.3 : 1.0, M.gunMetal, 0, 0, 0.9, Math.PI / 2, 0, 0, 6);
  add(barrel, sphG(0.13, 8, 6), M.optic, 0.28, 0.05, 0.25);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, eagle ? 1.6 : 1.4); barrel.add(muzzle);
  ifft(ctx, side, g, 2.8, -1.2);
  return { root: g, turret, barrel, muzzle, height: 3.4 };
}
reg('af_dingo', (side, type, ctx) => mrap(side, type, ctx, false));
reg('af_eagle', (side, type, ctx) => mrap(side, type, ctx, true));

reg('af_fennek', (side, type, ctx) => {
  const { add, box, cyl, hullGeo, wheel, antenna, M } = ctx; const a = mats(ctx);
  const g = new THREE.Group(), c = a.bwCamo;
  for (const s of [-1, 1]) { wheel(g, 0.55, 0.45, s * 1.05, 0.55, 1.7); wheel(g, 0.55, 0.45, s * 1.05, 0.55, -1.6); box(g, 0.25, 0.1, 1.4, c, s * 1.1, 1.0, 1.7); box(g, 0.25, 0.1, 1.4, c, s * 1.1, 1.0, -1.6); }
  add(g, hullGeo(2.1, 0.8, 5.6, 0.5, 0.15), c, 0, 1.1, 0);
  box(g, 1.7, 0.45, 2.6, c, 0, 1.6, -0.3); box(g, 1.5, 0.35, 0.06, M.glass, 0, 1.65, 1.0, -0.5, 0, 0);
  for (const s of [-1, 1]) box(g, 0.06, 0.3, 1.0, M.glass, s * 0.86, 1.65, -0.2);
  ctx.headlights(g, 1.15, 2.78, 0.7, 0.2);
  cyl(g, 0.22, 0.22, 1.8, a.bwTanD, 1.05, 1.75, -0.6, Math.PI / 2, 0, 0, 8); // Tarnnetz-Rolle
  cyl(g, 0.05, 0.05, 1.4, M.darkMetal, -0.6, 2.4, -1.4, 0, 0, 0, 6); box(g, 0.3, 0.3, 0.3, M.optic, -0.6, 3.15, -1.4); // Sichtmast
  box(g, 0.5, 0.2, 0.8, a.bwTanD, 0, 1.45, -2.4); antenna(g, 0.8, 1.8, -2.2, 2.4, 0.1);
  for (const s of [-1, 1]) emblem(ctx, 'BW', g, s * 0.9, 1.3, 0.8, s > 0 ? '+x' : '-x', 0.4);
  const turret = new THREE.Group(); turret.position.set(0, 1.85, -1.3); g.add(turret);
  box(turret, 0.6, 0.3, 0.7, M.darkMetal, 0, 0.15, 0);
  const barrel = new THREE.Group(); barrel.position.set(0, 0.35, 0); turret.add(barrel);
  box(barrel, 0.35, 0.28, 0.6, M.darkMetal, 0, 0, 0.1); cyl(barrel, 0.06, 0.06, 0.7, M.gunMetal, 0, 0, 0.7, Math.PI / 2, 0, 0, 6);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, 1.1); barrel.add(muzzle);
  ifft(ctx, side, g, 1.85, 0.4, 1.0);
  return { root: g, turret, barrel, muzzle, height: 2.2 };
});

function wiesel(side, type, ctx, tow) {
  const { add, box, cyl, hullGeo, trackSet, antenna, M } = ctx; const a = mats(ctx);
  const g = new THREE.Group(), c = a.bwCamo;
  for (const s of [-1, 1]) { trackSet(g, s, 0.82, 3.4, { w: 0.42, h: 0.6, n: 3, wr: 0.26, y: 0.38 }); box(g, 0.05, 0.3, 2.0, c, s * 1.12, 0.8, 0); }
  add(g, hullGeo(1.6, 0.7, 3.5, 0.3, 0.1), c, 0, 0.95, 0);
  box(g, 1.5, 0.55, 1.4, c, 0, 1.5, -0.7); box(g, 1.2, 0.35, 0.06, M.glass, 0, 1.55, 0.0, -0.4, 0, 0);
  box(g, 1.2, 0.15, 1.0, M.darkMetal, 0, 1.3, -1.7);
  emblem(ctx, 'BW', g, 0.82, 1.2, -0.3, '+x', 0.35); emblem(ctx, 'BW', g, -0.82, 1.2, -0.3, '-x', 0.35);
  antenna(g, 0.6, 1.7, -1.5, 2.0, 0.1);
  const turret = new THREE.Group(); turret.position.set(0, 1.85, 0.2); g.add(turret);
  const barrel = new THREE.Group(); barrel.position.set(0, 0.25, 0.3); turret.add(barrel);
  if (!tow) {
    box(turret, 1.0, 0.5, 1.1, c, 0, 0.1, 0); box(barrel, 0.3, 0.3, 0.8, M.darkMetal, 0, 0, 0.2); cyl(barrel, 0.045, 0.05, 1.5, M.gunMetal, 0, 0, 1.1, Math.PI / 2, 0, 0, 6);
  } else {
    box(turret, 0.5, 0.5, 0.6, M.darkMetal, 0, 0.0, 0); // Hubarm/Pylon
    box(barrel, 0.5, 0.35, 1.3, c, 0.35, 0.1, 0.1); box(barrel, 0.5, 0.35, 1.3, c, -0.35, 0.1, 0.1); // TOW-Kanister
    cyl(barrel, 0.13, 0.13, 0.1, M.optic, 0.35, 0.1, 0.78, Math.PI / 2, 0, 0, 8); cyl(barrel, 0.13, 0.13, 0.1, M.optic, -0.35, 0.1, 0.78, Math.PI / 2, 0, 0, 8);
  }
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, tow ? 0.9 : 1.9); barrel.add(muzzle);
  ifft(ctx, side, g, 1.8, -0.7, 0.9);
  return { root: g, turret, barrel, muzzle, height: 2.6 };
}
reg('af_wiesel_mk', (s, t, c) => wiesel(s, t, c, false));
reg('af_wiesel_tow', (s, t, c) => wiesel(s, t, c, true));

reg('af_marder', (side, type, ctx) => {
  const { add, box, cyl, hullGeo, trackSet, antenna, M } = ctx; const a = mats(ctx);
  const g = new THREE.Group(), c = a.bwCamo; const L = 6.9, W = 3.2, tx = W / 2 - 0.3;
  for (const s of [-1, 1]) { trackSet(g, s, tx, L, { w: 0.7, h: 0.9, n: 6, wr: 0.34 }); box(g, 0.08, 0.5, L * 0.6, c, s * (tx + 0.46), 1.0, 0); for (let i = 0; i < 3; i++) box(g, 0.14, 0.7, 0.8, a.bwTanD, s * (W / 2 + 0.08), 1.75, -1.4 + i * 1.4); }
  add(g, hullGeo(W - 0.4, 1.3, L, 0.4, 0.06), c, 0, 1.55, 0);
  box(g, 1.6, 0.1, 1.4, M.darkMetal, 0, 2.25, -2.3); box(g, 1.3, 0.35, 1.2, c, -0.2, 2.45, -0.9);
  ctx.headlights(g, 1.4, L / 2 - 0.1, 1.1, 0.2); box(g, 2.2, 0.05, 0.5, M.darkMetal, 0, 1.7, L / 2 - 0.5, -0.4, 0, 0);
  for (const s of [-1, 1]) emblem(ctx, 'BW', g, s * (W / 2 + 0.16), 1.75, -0.3, s > 0 ? '+x' : '-x', 0.5);
  const turret = new THREE.Group(); turret.position.set(0, 2.4, 0.3); g.add(turret);
  box(turret, 1.9, 0.75, 2.0, c, 0, 0.35, 0); box(turret, 0.5, 0.3, 0.5, M.darkMetal, -0.5, 0.85, -0.4);
  box(turret, 0.5, 0.45, 0.9, M.darkMetal, 1.2, 0.5, -0.2); cyl(turret, 0.1, 0.1, 0.5, M.gunMetal, 1.2, 0.5, 0.4, Math.PI / 2, 0, 0, 6); // MILAN
  for (const s of [-1, 1]) box(turret, 0.2, 0.25, 0.4, M.darkMetal, s * 0.95, 0.4, 1.1);
  antenna(turret, -0.8, 0.7, -0.9, 2.2, 0.05);
  const barrel = new THREE.Group(); barrel.position.set(0, 0.4, 1.0); turret.add(barrel);
  cyl(barrel, 0.05, 0.055, 2.2, M.gunMetal, 0, 0, 1.1, Math.PI / 2, 0, 0, 6); cyl(barrel, 0.1, 0.1, 0.7, M.darkMetal, 0, 0, 0.5, Math.PI / 2, 0, 0, 8);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, 2.3); barrel.add(muzzle);
  ifft(ctx, side, g, 2.45, -2.2);
  return { root: g, turret, barrel, muzzle, height: 3.2 };
});

reg('af_mungo', (side, type, ctx) => {
  const { add, box, cyl, hullGeo, wheel, antenna, M } = ctx; const a = mats(ctx);
  const g = new THREE.Group(), c = a.bwCamo;
  for (const s of [-1, 1]) { wheel(g, 0.55, 0.5, s * 1.0, 0.55, 1.3); wheel(g, 0.55, 0.5, s * 1.0, 0.55, -1.3); box(g, 0.3, 0.1, 1.2, c, s * 1.04, 1.05, 1.3); box(g, 0.3, 0.1, 1.2, c, s * 1.04, 1.05, -1.3); }
  add(g, hullGeo(1.9, 0.6, 4.6, 0.3, 0.05), c, 0, 0.95, 0);
  box(g, 1.7, 0.7, 1.3, c, 0, 1.55, 1.2); box(g, 1.5, 0.4, 0.05, M.glass, 0, 1.75, 1.88, -0.3, 0, 0);
  box(g, 1.8, 0.1, 2.0, M.darkMetal, 0, 1.3, -1.1); // offene Ladefläche
  for (const s of [-1, 1]) { box(g, 0.1, 0.5, 2.0, c, s * 0.9, 1.5, -1.1); box(g, 0.08, 0.9, 0.08, M.darkMetal, s * 0.85, 1.95, -0.2); }
  box(g, 1.8, 0.07, 0.07, M.darkMetal, 0, 2.4, -0.2);
  emblem(ctx, 'BW', g, 0.9, 1.5, 1.2, '+x', 0.3); emblem(ctx, 'BW', g, -0.9, 1.5, 1.2, '-x', 0.3);
  antenna(g, 0.7, 1.6, -2.0, 2.0, 0.1);
  const turret = new THREE.Group(); turret.position.set(0, 1.45, -0.8); g.add(turret);
  cyl(turret, 0.08, 0.08, 0.6, M.darkMetal, 0, 0.3, 0);
  const barrel = new THREE.Group(); barrel.position.set(0, 0.7, 0); turret.add(barrel);
  box(barrel, 0.2, 0.22, 0.6, M.darkMetal, 0, 0, 0.1); cyl(barrel, 0.025, 0.03, 0.8, M.gunMetal, 0, 0, 0.75, Math.PI / 2, 0, 0, 6);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, 1.2); barrel.add(muzzle);
  ifft(ctx, side, g, 1.9, 1.2, 0.9);
  return { root: g, turret, barrel, muzzle, height: 2.5 };
});

reg('af_wolf', (side, type, ctx) => {
  const { add, box, cyl, wheel, antenna, M } = ctx; const a = mats(ctx);
  const g = new THREE.Group(), c = a.bwCamo;
  for (const s of [-1, 1]) { wheel(g, 0.5, 0.4, s * 0.9, 0.5, 1.2); wheel(g, 0.5, 0.4, s * 0.9, 0.5, -1.2); }
  box(g, 1.8, 0.7, 4.3, c, 0, 1.0, 0); box(g, 1.7, 0.6, 1.2, c, 0, 1.45, 1.4); // Haube
  box(g, 1.8, 1.1, 2.4, c, 0, 1.85, -0.5); box(g, 1.6, 0.4, 0.06, M.glass, 0, 2.05, 0.74, -0.2, 0, 0);
  for (const s of [-1, 1]) { box(g, 0.06, 0.4, 0.9, M.glass, s * 0.91, 2.1, -0.1); box(g, 0.06, 0.4, 0.9, M.glass, s * 0.91, 2.1, -1.1); }
  ctx.headlights(g, 1.5, 2.15, 0.65, 0.2); box(g, 1.9, 0.12, 0.15, M.darkMetal, 0, 0.75, 2.2);
  cyl(g, 0.4, 0.4, 0.15, M.rubber, 0, 1.4, -2.2, Math.PI / 2, 0, 0, 8);
  for (const s of [-1, 1]) emblem(ctx, 'BW', g, s * 0.92, 1.6, -0.5, s > 0 ? '+x' : '-x', 0.35);
  antenna(g, 0.7, 2.3, -1.4, 2.0, 0.08);
  const turret = new THREE.Group(); turret.position.set(0, 2.4, -0.7); g.add(turret);
  cyl(turret, 0.2, 0.2, 0.1, M.darkMetal, 0, 0.05, 0, 0, 0, 0, 8);
  const barrel = new THREE.Group(); barrel.position.set(0, 0.35, 0); turret.add(barrel);
  box(barrel, 0.18, 0.2, 0.7, M.darkMetal, 0, 0, 0.1); cyl(barrel, 0.025, 0.03, 0.7, M.gunMetal, 0, 0, 0.7, Math.PI / 2, 0, 0, 6);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, 1.1); barrel.add(muzzle);
  ifft(ctx, side, g, 2.45, -0.5, 0.9);
  return { root: g, turret, barrel, muzzle, height: 3 };
});

// MAN-/Ural-Lkw (Fraktionsfarben); BM-21 teilt die Basis
function cargo(side, type, ctx) {
  const { box, cyl, antenna, M } = ctx; const a = mats(ctx); const fac = type.faction;
  const c = facCam(fac, a);
  const g = ctx.truckBase(c, fac === 'BW' ? 8.0 : 7.5, 2.6, fac === 'BW' ? 4 : 3);
  const tarp = fac === 'BW' ? a.canvas : fac === 'SA' ? a.saGreen : a.dirt;
  box(g, 2.6, 2.2, 4.8, tarp, 0, 2.3, -1.2); for (let i = 0; i < 4; i++) box(g, 2.7, 2.3, 0.1, M.darkMetal, 0, 2.3, -3.4 + i * 1.6);
  box(g, 2.2, 0.35, 4.6, tarp, 0, 3.55, -1.2); box(g, 2.4, 0.9, 0.1, M.darkMetal, 0, 1.55, -3.7);
  if (fac === 'BW') { for (const s of [-1, 1]) emblem(ctx, 'BW', g, s * 1.32, 2.0, 1.9, s > 0 ? '+x' : '-x', 0.5); }
  if (fac === 'SA') star(ctx, g, 1.32, 2.0, 1.9, '+x', 0.5);
  const muzzle = new THREE.Object3D(); g.add(muzzle);
  return { root: g, muzzle, height: 3.4 };
}
reg('af_truck', cargo); reg('af_ural', cargo);

reg('af_buffel', (side, type, ctx) => {
  const { add, box, cyl, hullGeo, trackSet, antenna, M } = ctx; const a = mats(ctx);
  const g = new THREE.Group(), c = a.bwCamo; const L = 7.2, W = 3.4, tx = W / 2 - 0.35;
  for (const s of [-1, 1]) { trackSet(g, s, tx, L, { n: 6 }); box(g, 0.06, 0.45, L * 0.6, c, s * (tx + 0.5), 1.15, -0.3); }
  add(g, hullGeo(W - 0.6, 1.0, L, 0.2, 0.1), c, 0, 1.35, 0);
  box(g, 2.4, 1.2, 2.4, c, 0, 2.3, 1.2); box(g, 2.0, 0.4, 0.06, M.glass, 0, 2.5, 2.42, -0.2, 0, 0);
  box(g, 3.4, 0.9, 0.3, M.darkMetal, 0, 1.2, L / 2 + 0.3, -0.35, 0, 0); // Räumschild
  box(g, 2.6, 0.15, 3.0, M.darkMetal, 0, 1.95, -2.0);
  const crane = new THREE.Group(); crane.position.set(0.8, 2.1, -0.6); g.add(crane);
  box(crane, 0.5, 0.5, 0.5, M.darkMetal, 0, 0.2, 0); box(crane, 0.28, 0.28, 3.8, M.darkMetal, 0, 1.0, -1.6, 0.35, 0, 0); box(crane, 0.08, 1.4, 0.08, M.gunMetal, 0, 0.5, -3.2);
  emblem(ctx, 'BW', g, 1.77, 1.7, 0, '+x', 0.5); emblem(ctx, 'BW', g, -1.77, 1.7, 0, '-x', 0.5);
  box(g, 0.12, 0.12, 0.12, M.redLight, -0.9, 3.0, 1.2); antenna(g, -1.0, 2.9, 0.2, 2.2, 0.1);
  ifft(ctx, side, g, 1.95, -2.4, 1.4);
  const muzzle = new THREE.Object3D(); g.add(muzzle);
  return { root: g, muzzle, height: 3.4 };
});

reg('af_pzh2000', (side, type, ctx) => {
  const { add, box, cyl, hullGeo, trackSet, antenna, M } = ctx; const a = mats(ctx);
  const g = new THREE.Group(), c = a.bwCamo; const L = 7.4, W = 3.5, tx = W / 2 - 0.35;
  for (const s of [-1, 1]) { trackSet(g, s, tx, L, { n: 7, wr: 0.38 }); box(g, 0.08, 0.5, L * 0.6, c, s * (tx + 0.5), 1.15, 0); }
  add(g, hullGeo(W - 0.6, 1.0, L, 0.3, 0.08), c, 0, 1.35, 0);
  box(g, 2.2, 0.5, 1.4, c, 0, 2.0, 2.3); box(g, 1.6, 0.1, 1.0, M.darkMetal, 0, 2.28, 2.3);
  for (const s of [-1, 1]) emblem(ctx, 'BW', g, s * (W / 2 + 0.2), 1.75, 1.5, s > 0 ? '+x' : '-x', 0.5);
  const turret = new THREE.Group(); turret.position.set(0, 2.3, -0.8); g.add(turret);
  box(turret, 3.0, 1.0, 3.6, c, 0, 0.5, 0); box(turret, 2.6, 0.5, 2.0, c, 0, 1.1, -0.6, 0, 0, 0); box(turret, 0.4, 0.3, 0.6, M.darkMetal, 0.9, 1.3, 0.5);
  antenna(turret, -1.2, 1.3, -1.4, 2.2, 0.1); box(turret, 3.1, 0.35, 0.5, M.darkMetal, 0, 0.35, -1.9); // Heckkorb
  const barrel = new THREE.Group(); barrel.position.set(0, 0.55, 1.8); turret.add(barrel);
  cyl(barrel, 0.14, 0.16, 7.0, M.gunMetal, 0, 0, 3.5, Math.PI / 2, 0, 0, 10);
  cyl(barrel, 0.24, 0.24, 1.0, M.darkMetal, 0, 0, 3.8, Math.PI / 2, 0, 0, 10); // Rauchabsauger
  cyl(barrel, 0.2, 0.2, 0.5, M.darkMetal, 0, 0, 6.9, Math.PI / 2, 0, 0, 10); // Mündungsbremse
  cyl(barrel, 0.3, 0.3, 0.7, M.darkMetal, 0, 0, 0.5, Math.PI / 2, 0, 0, 10);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, 7.2); barrel.add(muzzle);
  ifft(ctx, side, g, 2.4, 2.3);
  return { root: g, turret, barrel, muzzle, height: 3.6 };
});

// ====================== Sowjetische / erbeutete Fahrzeuge ======================
function bmp(side, type, ctx, v) { // v: 'bmp1' | 'bmp2' | 'bmd'
  const { add, box, cyl, sphG, hullGeo, trackSet, antenna, M } = ctx; const a = mats(ctx);
  const g = new THREE.Group(), c = facCam(type.faction, a); const bmd = v === 'bmd';
  const L = bmd ? 5.4 : 6.6, W = bmd ? 2.8 : 3.1, tx = W / 2 - 0.3;
  for (const s of [-1, 1]) { trackSet(g, s, tx, L, { w: 0.62, h: 0.8, n: bmd ? 5 : 6, wr: 0.32 }); box(g, 0.08, 0.5, L * 0.6, c, s * (tx + 0.42), 1.0, 0); }
  add(g, hullGeo(W - 0.4, bmd ? 1.0 : 1.2, L, 0.45, 0.05), c, 0, bmd ? 1.35 : 1.45, 0);
  box(g, 1.2, 0.1, 1.4, M.darkMetal, 0, bmd ? 1.9 : 2.05, -L / 2 + 1.1);
  box(g, 0.5, 0.25, 0.9, c, 0.9, bmd ? 1.95 : 2.1, 1.4); // Fahrerluke
  if (type.faction === 'SA') for (const s of [-1, 1]) star(ctx, g, s * (W / 2 - 0.02), 1.5, -1.0, s > 0 ? '+x' : '-x', 0.5);
  const turret = new THREE.Group(); turret.position.set(0, bmd ? 1.95 : 2.1, 0.5); g.add(turret);
  const d = add(turret, sphG(0.95, 12, 8), c, 0, 0, 0); d.scale.set(1, 0.5, 1);
  box(turret, 0.9, 0.25, 0.45, M.darkMetal, 0, 0.5, -0.1); antenna(turret, -0.6, 0.3, -0.6, 2.0, 0.1);
  const barrel = new THREE.Group(); barrel.position.set(0, 0.3, 0.9); turret.add(barrel);
  if (v === 'bmp2') {
    cyl(barrel, 0.045, 0.05, 2.3, M.gunMetal, 0, 0, 1.15, Math.PI / 2, 0, 0, 6); box(turret, 0.25, 0.3, 0.5, M.darkMetal, 0.8, 0.45, -0.2); cyl(turret, 0.08, 0.08, 0.5, M.gunMetal, 0.8, 0.5, 0.2, Math.PI / 2, 0, 0, 6);
  } else {
    cyl(barrel, 0.09, 0.1, 1.5, M.gunMetal, 0, 0, 0.75, Math.PI / 2, 0, 0, 8); box(turret, 0.1, 0.1, 1.2, M.darkMetal, 0, 0.6, 0.1); cyl(turret, 0.05, 0.05, 0.8, c, 0, 0.7, 0.1, Math.PI / 2, 0, 0, 6);
  }
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, v === 'bmp2' ? 2.4 : 1.6); barrel.add(muzzle);
  return { root: g, turret, barrel, muzzle, height: 2.8 };
}
reg('af_bmp', (s, t, c) => bmp(s, t, c, 'bmp1')); reg('af_bmp2', (s, t, c) => bmp(s, t, c, 'bmp2')); reg('af_bmd', (s, t, c) => bmp(s, t, c, 'bmd'));

function btr(side, type, ctx, v80) {
  const { add, box, cyl, sphG, hullGeo, wheel, antenna, M } = ctx; const a = mats(ctx);
  const g = new THREE.Group(), c = facCam(type.faction, a); const L = 7.0, W = 2.9;
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) wheel(g, 0.55, 0.45, s * (W / 2 - 0.2), 0.55, -2.4 + i * 1.6);
  for (const s of [-1, 1]) box(g, 0.1, 0.12, 6.4, M.darkMetal, s * (W / 2 - 0.2), 1.1, 0);
  add(g, hullGeo(W - 0.3, 1.2, L, 0.4, 0.05), c, 0, 1.45, 0);
  box(g, 1.2, 0.1, 1.4, M.darkMetal, 0, 2.05, -2.3);
  if (v80) for (const s of [-1, 1]) box(g, 0.05, 0.5, 1.0, M.darkMetal, s * (W / 2 - 0.02), 1.5, -0.3); // Seitenluken
  if (type.faction === 'SA') for (const s of [-1, 1]) star(ctx, g, s * (W / 2 - 0.02), 1.7, 0.6, s > 0 ? '+x' : '-x', 0.5);
  const turret = new THREE.Group(); turret.position.set(0, 2.05, 0.4); g.add(turret);
  const d = add(turret, sphG(0.8, 10, 6), c, 0, 0, 0); d.scale.set(1, 0.5, 1); box(turret, 0.6, 0.2, 0.5, M.darkMetal, 0.3, 0.35, 0.3); antenna(turret, -0.7, 0.3, -0.5, 2.2, 0.1);
  const barrel = new THREE.Group(); barrel.position.set(0, 0.1, 0.8); turret.add(barrel);
  cyl(barrel, 0.06, 0.07, 1.6, M.gunMetal, 0, 0, 0.8, Math.PI / 2, 0, 0, 6); cyl(barrel, 0.11, 0.11, 0.5, M.darkMetal, 0, 0, 0.3, Math.PI / 2, 0, 0, 8);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, 1.7); barrel.add(muzzle);
  return { root: g, turret, barrel, muzzle, height: 2.7 };
}
reg('af_btr70', (s, t, c) => btr(s, t, c, false)); reg('af_btr80', (s, t, c) => btr(s, t, c, true));

function tank55(side, type, ctx, t62) {
  const { add, box, cyl, sphG, hullGeo, trackSet, antenna, M } = ctx; const a = mats(ctx);
  const g = new THREE.Group(), c = facCam(type.faction, a); const L = 6.6, W = 3.3, tx = W / 2 - 0.35;
  for (const s of [-1, 1]) { trackSet(g, s, tx, L, { n: 5 }); box(g, 0.06, 0.4, L * 0.6, c, s * (tx + 0.5), 1.15, -0.3); box(g, 0.9, 0.06, 1.2, c, s * tx, 1.3, L / 2 - 0.5, 0.15, 0, 0); }
  add(g, hullGeo(W - 0.6, 0.9, L, 0.2, 0.1), c, 0, 1.3, 0);
  box(g, 2.0, 0.1, 1.8, M.darkMetal, 0, 1.78, -L / 2 + 1.1);
  cyl(g, 0.22, 0.22, 0.9, M.darkMetal, 1.1, 1.95, -L / 2 + 0.3, 0, 0, Math.PI / 2, 8); cyl(g, 0.22, 0.22, 0.9, M.darkMetal, -0.3, 1.95, -L / 2 + 0.3, 0, 0, Math.PI / 2, 8); // Zusatztanks
  box(g, 0.25, 0.25, 4.2, M.wood2, -1.1, 1.78, 0, 0, 0, 0); // Hilfsbalken
  if (type.faction === 'SA') star(ctx, g, 0, 1.55, L / 2 - 0.02, '+z', 0.45);
  const turret = new THREE.Group(); turret.position.set(0, 1.85, 0.4); g.add(turret);
  const d = add(turret, sphG(1.35, 14, 8), c, 0, 0.05, 0); d.scale.set(1, 0.5, 1.15); box(turret, 0.8, 0.3, 0.8, c, -0.5, 0.5, -0.3);
  cyl(turret, 0.35, 0.35, 0.2, M.darkMetal, 0.4, 0.55, -0.3, 0, 0, 0, 8); box(turret, 0.2, 0.3, 0.5, M.darkMetal, -0.3, 0.7, -0.4);
  if (type.faction === 'SA') for (const s of [-1, 1]) star(ctx, turret, s * 1.3, 0.1, 0.1, s > 0 ? '+x' : '-x', 0.5);
  const barrel = new THREE.Group(); barrel.position.set(0, 0.15, 1.2); turret.add(barrel);
  cyl(barrel, 0.07, 0.09, 4.0, M.gunMetal, 0, 0, 2.0, Math.PI / 2, 0, 0, 8);
  if (!t62) cyl(barrel, 0.14, 0.14, 0.6, M.darkMetal, 0, 0, 2.2, Math.PI / 2, 0, 0, 8); else cyl(barrel, 0.12, 0.12, 0.5, M.darkMetal, 0, 0, 1.0, Math.PI / 2, 0, 0, 8);
  cyl(barrel, 0.2, 0.2, 0.6, M.darkMetal, 0, 0, 0.3, Math.PI / 2, 0, 0, 8);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, 4.1); barrel.add(muzzle);
  return { root: g, turret, barrel, muzzle, height: 2.9 };
}
reg('af_t55', (s, t, c) => tank55(s, t, c, false)); reg('af_t62', (s, t, c) => tank55(s, t, c, true));

reg('af_shilka', (side, type, ctx) => {
  const { add, box, cyl, hullGeo, trackSet, antenna, M } = ctx; const a = mats(ctx);
  const g = new THREE.Group(), c = a.saCamo; const L = 6.5, W = 3.0, tx = W / 2 - 0.3;
  for (const s of [-1, 1]) { trackSet(g, s, tx, L, { w: 0.7, h: 0.9, n: 6, wr: 0.33 }); box(g, 0.06, 0.4, L * 0.6, c, s * (tx + 0.45), 1.1, 0); }
  add(g, hullGeo(W - 0.4, 1.0, L, 0.3, 0.05), c, 0, 1.45, 0);
  for (const s of [-1, 1]) star(ctx, g, s * (W / 2 - 0.2), 1.6, -1.8, s > 0 ? '+x' : '-x', 0.5);
  const turret = new THREE.Group(); turret.position.set(0, 2.0, -0.4); g.add(turret);
  box(turret, 2.8, 0.9, 2.6, c, 0, 0.45, 0); box(turret, 2.9, 0.2, 2.7, a.saGreen, 0, 0.95, 0);
  for (const s of [-1, 1]) box(turret, 0.2, 0.6, 1.2, M.darkMetal, s * 1.5, 0.5, 0.3);
  const radar = new THREE.Group(); radar.position.set(0, 1.0, -1.1); turret.add(radar);
  box(radar, 0.1, 0.5, 0.1, M.darkMetal, 0, 0.25, 0); box(radar, 1.2, 0.9, 0.08, M.grey, 0, 0.9, 0, -0.5, 0, 0); // Rundsuchradar RPK-2
  const barrel = new THREE.Group(); barrel.position.set(0, 0.55, 1.3); turret.add(barrel); barrel.rotation.x = -0.35;
  for (const [x, y] of [[-0.55, 0.12], [-0.2, 0.12], [0.2, 0.12], [0.55, 0.12]]) cyl(barrel, 0.045, 0.05, 2.2, M.gunMetal, x, y, 1.0, Math.PI / 2, 0, 0, 6);
  box(barrel, 1.5, 0.3, 0.8, M.darkMetal, 0, 0.1, 0.2);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.1, 2.2); barrel.add(muzzle);
  return { root: g, turret, barrel, muzzle, height: 3.3, radar };
});

reg('af_bm21', (side, type, ctx) => {
  const { box, cyl, M } = ctx; const a = mats(ctx);
  const g = ctx.truckBase(a.saCamo, 7.6, 2.6, 3);
  star(ctx, g, 1.32, 2.0, 1.9, '+x', 0.5); star(ctx, g, -1.32, 2.0, 1.9, '-x', 0.5);
  box(g, 2.2, 0.3, 4.6, M.darkMetal, 0, 1.4, -1.5);
  const turret = new THREE.Group(); turret.position.set(0, 1.7, -1.9); g.add(turret);
  const barrel = new THREE.Group(); barrel.position.set(0, 0.7, 0); turret.add(barrel); barrel.rotation.x = -0.35;
  box(barrel, 2.0, 1.6, 0.3, M.darkMetal, 0, 0.4, -0.2);
  for (let r = 0; r < 5; r++) for (let q = 0; q < 8; q++) cyl(barrel, 0.1, 0.1, 3.0, M.gunMetal, -0.84 + q * 0.24, -0.2 + r * 0.28 + (q % 2) * 0.04, 1.3, Math.PI / 2, 0, 0, 6);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.2, 2.9); barrel.add(muzzle);
  return { root: g, turret, barrel, muzzle, height: 3.6 };
});

reg('af_2s1', (side, type, ctx) => {
  const { add, box, cyl, hullGeo, trackSet, antenna, M } = ctx; const a = mats(ctx);
  const g = new THREE.Group(), c = a.saCamo; const L = 6.8, W = 2.9, tx = W / 2 - 0.3;
  for (const s of [-1, 1]) { trackSet(g, s, tx, L, { w: 0.62, h: 0.8, n: 7, wr: 0.3 }); box(g, 0.06, 0.4, L * 0.6, c, s * (tx + 0.4), 1.0, 0); }
  add(g, hullGeo(W - 0.4, 1.1, L, 0.3, 0.05), c, 0, 1.4, 0);
  box(g, 1.2, 0.1, 1.2, M.darkMetal, 0, 2.0, 2.3);
  for (const s of [-1, 1]) star(ctx, g, s * (W / 2 - 0.02), 1.6, 2.0, s > 0 ? '+x' : '-x', 0.5);
  const turret = new THREE.Group(); turret.position.set(0, 2.0, -0.7); g.add(turret);
  box(turret, 2.5, 1.0, 2.6, c, 0, 0.5, 0); box(turret, 2.3, 0.3, 1.6, c, 0, 1.1, -0.4); box(turret, 0.4, 0.3, 0.4, M.darkMetal, 0.6, 1.3, 0.3);
  antenna(turret, -1.0, 1.0, -1.2, 2.0, 0.1);
  const barrel = new THREE.Group(); barrel.position.set(0, 0.55, 1.3); turret.add(barrel);
  cyl(barrel, 0.1, 0.12, 3.8, M.gunMetal, 0, 0, 1.9, Math.PI / 2, 0, 0, 8); cyl(barrel, 0.17, 0.17, 0.7, M.darkMetal, 0, 0, 3.7, Math.PI / 2, 0, 0, 8); cyl(barrel, 0.22, 0.22, 0.6, M.darkMetal, 0, 0, 0.4, Math.PI / 2, 0, 0, 8);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, 3.9); barrel.add(muzzle);
  return { root: g, turret, barrel, muzzle, height: 3.2 };
});

reg('af_uaz', (side, type, ctx) => {
  const { add, box, cyl, wheel, antenna, M } = ctx; const a = mats(ctx);
  const g = new THREE.Group(), c = a.saCamo;
  for (const s of [-1, 1]) { wheel(g, 0.45, 0.38, s * 0.85, 0.45, 1.1); wheel(g, 0.45, 0.38, s * 0.85, 0.45, -1.1); }
  box(g, 1.7, 0.6, 3.8, c, 0, 0.95, 0); box(g, 1.6, 0.5, 1.1, c, 0, 1.35, 1.2);
  box(g, 1.7, 1.0, 1.9, a.canvas, 0, 1.75, -0.7); box(g, 1.5, 0.35, 0.06, M.glass, 0, 1.75, 0.3, -0.2, 0, 0);
  ctx.headlights(g, 1.25, 1.95, 0.6, 0.2); star(ctx, g, 0.86, 1.1, 0.2, '+x', 0.35); star(ctx, g, -0.86, 1.1, 0.2, '-x', 0.35);
  antenna(g, 0.7, 2.2, -1.4, 1.8, 0.1);
  const turret = new THREE.Group(); turret.position.set(0, 2.25, -0.7); g.add(turret);
  cyl(turret, 0.07, 0.07, 0.4, M.darkMetal, 0, 0.2, 0);
  const barrel = new THREE.Group(); barrel.position.set(0, 0.45, 0); turret.add(barrel);
  box(barrel, 0.18, 0.2, 0.6, M.darkMetal, 0, 0, 0.1); cyl(barrel, 0.025, 0.03, 0.7, M.gunMetal, 0, 0, 0.7, Math.PI / 2, 0, 0, 6);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, 1.1); barrel.add(muzzle);
  return { root: g, turret, barrel, muzzle, height: 2.8 };
});

// ====================== Taliban / Mudschaheddin ======================
function hilux(side, type, ctx, kind) { // 'technical' | 'transport'
  const { add, box, cyl, sphG, wheel, antenna, M } = ctx; const a = mats(ctx);
  const g = new THREE.Group(); const body = kind === 'technical' ? a.white : a.dirt;
  for (const s of [-1, 1]) for (const z of [-1.5, 1.5]) wheel(g, 0.45, 0.35, s * 0.95, 0.45, z);
  box(g, 2.0, 0.8, 5.0, body, 0, 0.95, 0); box(g, 1.9, 0.8, 1.9, body, 0, 1.75, 0.6); box(g, 1.8, 0.5, 0.05, M.glass, 0, 1.85, 1.56);
  for (const s of [-1, 1]) { box(g, 0.05, 0.45, 1.5, M.glass, s * 0.96, 1.85, 0.6); box(g, 0.1, 0.5, 4.0, body, s * 1.0, 1.5, -1.5); }
  box(g, 1.9, 0.5, 1.0, body, 0, 1.5, 2.1); box(g, 2.1, 0.2, 0.2, M.darkMetal, 0, 0.7, 2.6); ctx.headlights(g, 1.45, 2.62, 0.7, 0.22);
  box(g, 1.9, 0.5, 0.1, body, 0, 1.5, -2.5); box(g, 1.7, 0.05, 1.8, M.darkMetal, 0, 1.38, -1.6);
  cyl(g, 0.4, 0.4, 0.15, M.rubber, 0, 1.9, -0.2, 0, 0, Math.PI / 2, 8);
  box(g, 0.5, 0.3, 0.5, a.rust, -0.6, 1.6, -2.0); // Kanister/Kiste
  if (kind === 'technical') {
    const turret = new THREE.Group(); turret.position.set(0, 1.6, -1.3); g.add(turret);
    cyl(turret, 0.08, 0.08, 1.0, M.darkMetal, 0, 0.5, 0); box(turret, 0.9, 0.7, 0.06, M.darkMetal, 0, 1.3, 0.35);
    const barrel = new THREE.Group(); barrel.position.set(0, 1.0, 0); turret.add(barrel);
    box(barrel, 0.2, 0.25, 0.9, M.darkMetal, 0, 0, 0.2); cyl(barrel, 0.045, 0.05, 1.6, M.gunMetal, 0, 0, 1.3, Math.PI / 2, 0, 0, 6); cyl(barrel, 0.09, 0.09, 0.15, M.darkMetal, 0, 0.1, 0.4, 0, 0, 0, 8);
    box(barrel, 0.25, 0.25, 0.25, a.rust, 0.25, -0.1, 0.1);
    const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, 2.1); barrel.add(muzzle);
    return { root: g, turret, barrel, muzzle, height: 2.9 };
  }
  for (let i = 0; i < 4; i++) { const x = (i % 2 ? 0.45 : -0.45), z = -1.2 - (i >> 1) * 1.1;
    box(g, 0.45, 0.5, 0.3, a.shirts[i], x, 1.95, z); add(g, sphG(0.14, 8, 6), M.skin, x, 2.37, z); cyl(g, 0.15, 0.14, 0.1, a.hats[i % 3], x, 2.52, z, 0, 0, 0, 8); box(g, 0.05, 0.9, 0.05, M.gunMetal, x + 0.28, 2.1, z, 0, 0, 0.1); }
  const muzzle = new THREE.Object3D(); g.add(muzzle);
  return { root: g, muzzle, height: 2.8 };
}
reg('af_technical', (s, t, c) => hilux(s, t, c, 'technical')); reg('af_pickup', (s, t, c) => hilux(s, t, c, 'transport'));

reg('af_bike', (side, type, ctx) => {
  const { add, box, cyl, sphG, wheel, M } = ctx; const a = mats(ctx);
  const g = new THREE.Group();
  for (const z of [-0.85, 0.85]) cyl(g, 0.42, 0.42, 0.12, M.rubber, 0, 0.42, z, 0, 0, Math.PI / 2, 12);
  box(g, 0.2, 0.2, 1.4, M.darkMetal, 0, 0.75, 0); box(g, 0.3, 0.3, 0.6, a.rust, 0, 1.05, 0.2); box(g, 0.25, 0.1, 0.8, a.black, 0, 1.0, -0.4);
  box(g, 0.1, 0.6, 0.1, M.darkMetal, 0, 0.75, 0.85, 0.3, 0, 0); box(g, 0.8, 0.06, 0.06, M.darkMetal, 0, 1.15, 0.7);
  // Fahrer
  box(g, 0.4, 0.55, 0.3, a.shirts[0], 0, 1.55, -0.3, 0.3, 0, 0); box(g, 0.28, 0.5, 0.3, a.shirts[0], 0.12, 1.0, -0.1, -0.9, 0, 0); box(g, 0.28, 0.5, 0.3, a.shirts[0], -0.12, 1.0, -0.1, -0.9, 0, 0);
  add(g, sphG(0.13, 8, 6), M.skin, 0, 1.98, -0.15); cyl(g, 0.15, 0.14, 0.1, a.hats[0], 0, 2.13, -0.15, 0, 0, 0, 8); box(g, 0.05, 0.9, 0.05, M.gunMetal, 0.28, 1.6, -0.35, 0.3, 0, 0.2);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 1.6, 0.4); g.add(muzzle);
  return { root: g, muzzle, height: 2.3 };
});

function flak(side, type, ctx, twin) {
  const { add, box, cyl, wheel, M } = ctx; const a = mats(ctx); const c = type.faction === 'SA' ? a.saGreen : a.mujCamo;
  const g = new THREE.Group();
  for (const s of [-1, 1]) wheel(g, 0.42, 0.25, s * (twin ? 1.2 : 0.9), 0.42, 0);
  box(g, twin ? 2.2 : 1.6, 0.25, 1.4, c, 0, 0.6, 0); box(g, 0.2, 0.2, 2.0, M.darkMetal, 0, 0.55, -1.6); // Deichsel
  if (twin) for (const s of [-1, 1]) box(g, 0.12, 0.12, 1.3, M.darkMetal, s * 1.0, 0.5, 1.0, 0, s * 0.5, 0);
  const turret = new THREE.Group(); turret.position.set(0, 0.8, 0); g.add(turret);
  box(turret, 0.7, 0.35, 0.8, c, 0, 0.15, 0); box(turret, 0.5, 0.1, 0.5, M.darkMetal, -0.7, 0.2, -0.3); // Sitz
  box(turret, 1.3, 0.8, 0.06, c, 0, 0.8, 0.5);
  const barrel = new THREE.Group(); barrel.position.set(0, 0.6, 0.2); turret.add(barrel); barrel.rotation.x = -0.5;
  box(barrel, 0.4, 0.3, 0.6, M.darkMetal, 0, 0, 0.1);
  if (twin) { for (const s of [-1, 1]) { cyl(barrel, 0.05, 0.06, 2.0, M.gunMetal, s * 0.25, 0, 1.0, Math.PI / 2, 0, 0, 6); cyl(barrel, 0.09, 0.09, 0.2, M.darkMetal, s * 0.25, 0, 2.0, Math.PI / 2, 0, 0, 6); } }
  else cyl(barrel, 0.05, 0.06, 2.2, M.gunMetal, 0, 0, 1.1, Math.PI / 2, 0, 0, 6);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, twin ? 2.1 : 2.3); barrel.add(muzzle);
  return { root: g, turret, barrel, muzzle, height: 2.2 };
}
reg('af_zpu1', (s, t, c) => flak(s, t, c, false)); reg('af_zu23', (s, t, c) => flak(s, t, c, true));

reg('af_caravan', (side, type, ctx) => {
  const { add, box, cyl, sphG, M } = ctx; const a = mats(ctx);
  const g = new THREE.Group();
  const animal = (x, z, camel) => {
    const mat = a.animal[camel ? 1 : 0], H = camel ? 1.5 : 1.15, bl = camel ? 2.0 : 1.7;
    const b = add(g, sphG(0.5, 10, 8), mat, x, H + 0.25, z); b.scale.set(0.8, camel ? 0.9 : 0.8, bl * 0.55);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 0.14, H, 0.14, mat, x + sx * 0.25, H / 2, z + sz * bl * 0.28);
    box(g, 0.2, camel ? 1.0 : 0.6, 0.2, mat, x, H + (camel ? 0.8 : 0.5), z + bl * 0.45, 0.5, 0, 0);
    add(g, sphG(0.17, 8, 6), mat, x, H + (camel ? 1.3 : 0.8), z + bl * 0.6).scale.set(0.8, 0.9, 1.5);
    if (camel) add(g, sphG(0.3, 8, 6), mat, x, H + 0.9, z - 0.1);
    box(g, 0.8, 0.4, 0.5, a.canvas, x, H + 0.55, z - 0.1); box(g, 0.3, 0.5, 0.5, a.dirt, x + 0.45, H + 0.4, z); box(g, 0.3, 0.5, 0.5, a.rust, x - 0.45, H + 0.4, z); // Packlast
  };
  animal(-0.0, 1.4, true); animal(0.0, -1.4, false);
  const muzzle = new THREE.Object3D(); g.add(muzzle);
  return { root: g, muzzle, height: 3.2 };
});

// ====================== Luftfahrzeuge ======================
const rotorDisc = (ctx, g, r, y, z) => { const m = ctx.add(g, ctx.cylG(r, r, 0.04, 24), ctx.M.rotor, 0, y, z, 0, 0, 0, false); m.userData.noWreck = true; return m; };

function heliMod(side, type, ctx, v) { // 'ch53' | 'nh90' | 'tiger' | 'hind' | 'mi8'
  const { add, box, cyl, sphG, M } = ctx; const a = mats(ctx);
  const fac = type.faction, g = noBlobGroup();
  const c = fac === 'BW' ? (v === 'ch53' ? a.bwOlive : a.bwCamo) : a.saCamo;
  const big = v === 'ch53', hind = v === 'hind', tiger = v === 'tiger', nh = v === 'nh90', mi8 = v === 'mi8';
  const rotors = [];
  let turret = null, barrel = null, muzzle = new THREE.Object3D();
  if (big) {
    const b = add(g, sphG(1.6, 14, 10), c, 0, 0, 0.8); b.scale.set(0.9, 0.95, 3.3);
    cyl(g, 0.5, 0.25, 6, c, 0, 0.6, -5.2, Math.PI / 2, 0, 0, 8); box(g, 0.2, 2.2, 1.3, c, 0, 1.6, -8.0, -0.2, 0, 0); box(g, 3.0, 0.1, 0.8, c, 0, 0.8, -7.8);
    box(g, 2.4, 0.9, 3.0, c, 0, 1.6, 0.4); for (const s of [-1, 1]) { box(g, 0.9, 0.5, 2.2, M.darkMetal, s * 0.8, 2.0, -0.4); box(g, 0.9, 0.8, 3.0, c, s * 1.7, -0.4, 0.3); cyl(g, 0.25, 0.25, 0.2, M.rubber, s * 1.8, -1.2, 0.3, 0, 0, Math.PI / 2, 8); }
    box(g, 1.8, 0.8, 0.1, M.glass, 0, 0.7, 4.2, -0.5, 0, 0); cyl(g, 0.5, 0.5, 0.5, M.darkMetal, 0, 2.3, 0.4, 0, 0, 0, 8);
    rotors.push(rotorDisc(ctx, g, 9, 2.7, 0.4));
    bwCrossBoth(ctx, g, fac, 1.45, 0.4, 0.6);
  } else if (nh || mi8) {
    const b = add(g, sphG(1.3, 14, 10), c, 0, 0, 0.6); b.scale.set(0.95, 0.95, mi8 ? 2.4 : 2.7);
    cyl(g, 0.4, 0.2, 5.5, c, 0, 0.5, -4.0, Math.PI / 2, 0, 0, 8); box(g, 0.15, 1.8, 1.0, c, 0, 1.3, -6.4, -0.2, 0, 0); box(g, 2.2, 0.08, 0.6, c, 0, 0.7, -6.2);
    box(g, 0.9, 0.8, 2.4, M.darkMetal, 0, 1.4, 0.2); if (mi8) for (const s of [-1, 1]) { cyl(g, 0.3, 0.3, 1.2, M.darkMetal, s * 0.9, 1.2, 1.0, Math.PI / 2, 0, 0, 8); box(g, 0.1, 0.7, 1.2, M.glass, s * 1.1, 0.6, 2.6); }
    box(g, 1.7, 0.7, 0.08, M.glass, 0, 0.55, nh ? 3.3 : 2.8, -0.5, 0, 0);
    for (const s of [-1, 1]) { box(g, 0.1, 0.8, 1.2, a.cross === undefined ? M.white : M.darkMetal, s * 1.22, 0.1, 0.0); cyl(g, 0.12, 0.12, 0.7, M.darkMetal, s * 0.9, -1.1, 1.8, 0, 0, 0, 6); cyl(g, 0.12, 0.12, 0.7, M.darkMetal, s * 0.9, -1.1, -1.2, 0, 0, 0, 6); cyl(g, 0.18, 0.18, 0.14, M.rubber, s * 0.9, -1.5, -1.2, 0, 0, Math.PI / 2, 8); }
    cyl(g, 0.4, 0.4, 0.4, M.darkMetal, 0, 2.2, 0.4, 0, 0, 0, 8);
    rotors.push(rotorDisc(ctx, g, nh ? 7 : 7.5, 2.5, 0.4));
    if (nh) { for (const s of [-1, 1]) { box(g, 0.02, 0.9, 0.9, M.white, s * 1.26, 0.5, 0.2); box(g, 0.025, 0.6, 0.14, a.red, s * 1.275, 0.5, 0.2); box(g, 0.025, 0.14, 0.6, a.red, s * 1.275, 0.5, 0.2); } bwCrossBoth(ctx, g, fac, 1.28, -0.5, 0.45); box(g, 0.9, 0.9, 0.04, M.white, 0, 0.95, -7.0); }
    else for (const s of [-1, 1]) star(ctx, g, s * 1.26, 0.4, -3.5, s > 0 ? '+x' : '-x', 0.6);
  } else { // tiger / hind
    const b = add(g, sphG(1.1, 14, 10), c, 0, 0, hind ? 0.3 : 0.2); b.scale.set(hind ? 0.9 : 0.55, hind ? 0.95 : 0.95, hind ? 2.2 : 2.5);
    cyl(g, 0.35, 0.16, 5.8, c, 0, 0.3, -3.9, Math.PI / 2, 0, 0, 8); box(g, 0.1, 1.6, 1.0, c, 0, 0.9, -6.7, -0.2, 0, 0); box(g, 2.2, 0.08, 0.6, c, 0, 0.3, -6.3);
    if (hind) {
      add(g, sphG(0.62, 10, 8), M.glass, 0, 0.3, 2.3).scale.set(0.9, 0.9, 1.3); add(g, sphG(0.62, 10, 8), M.glass, 0, 0.75, 1.1).scale.set(0.9, 0.9, 1.3);
      for (const s of [-1, 1]) { box(g, 0.7, 0.6, 1.4, M.darkMetal, s * 0.85, 1.1, 0.2); cyl(g, 0.12, 0.12, 0.4, M.darkMetal, s * 0.9, 1.1, 1.0, Math.PI / 2, 0, 0, 6); }
      box(g, 5.6, 0.12, 0.8, c, 0, 0.0, 0.5);
      for (const s of [-1, 1]) for (const dx of [1.2, 2.1, 2.7]) { cyl(g, 0.16, 0.16, 1.2, M.grey, s * dx, -0.3, 0.7, Math.PI / 2, 0, 0, 8); }
      for (const s of [-1, 1]) { cyl(g, 0.1, 0.1, 0.7, M.darkMetal, s * 0.9, -1.1, 1.8, 0, 0, 0, 6); cyl(g, 0.18, 0.18, 0.14, M.rubber, s * 0.9, -1.45, 1.8, 0, 0, Math.PI / 2, 8); cyl(g, 0.12, 0.12, 0.8, M.darkMetal, s * 0.9, -1.1, -1.0, 0, 0, 0, 6); cyl(g, 0.2, 0.2, 0.14, M.rubber, s * 0.9, -1.5, -1.0, 0, 0, Math.PI / 2, 8); star(ctx, g, s * 0.96, 0.2, -2.8, s > 0 ? '+x' : '-x', 0.55); }
      cyl(g, 0.45, 0.45, 0.4, M.darkMetal, 0, 1.2, 0.4, 0, 0, 0, 8); rotors.push(rotorDisc(ctx, g, 8, 1.55, 0.4));
    } else {
      add(g, sphG(0.5, 10, 8), M.glass, 0, 0.45, 2.2).scale.set(0.7, 0.8, 1.6); add(g, sphG(0.5, 10, 8), M.glass, 0, 0.8, 1.0).scale.set(0.7, 0.8, 1.6);
      box(g, 4.4, 0.1, 0.7, c, 0, -0.1, 0.3);
      for (const s of [-1, 1]) { for (const dx of [1.3, 2.1]) cyl(g, 0.13, 0.13, 1.3, M.grey, s * dx, -0.35, 0.4, Math.PI / 2, 0, 0, 8); box(g, 0.5, 0.4, 1.6, M.darkMetal, s * 0.65, 0.5, -0.6); cyl(g, 0.1, 0.1, 0.7, M.darkMetal, s * 0.7, -1.0, 1.5, 0, 0, 0, 6); cyl(g, 0.1, 0.1, 0.7, M.darkMetal, s * 0.8, -1.0, -1.0, 0, 0, 0, 6); cyl(g, 0.16, 0.16, 0.12, M.rubber, s * 0.8, -1.4, -1.0, 0, 0, Math.PI / 2, 8); }
      cyl(g, 0.05, 0.05, 1.0, M.darkMetal, 0, 1.4, 0.5, 0, 0, 0, 6); add(g, sphG(0.22, 8, 6), M.optic, 0, 1.95, 0.5); // Mastvisier
      cyl(g, 0.4, 0.4, 0.4, M.darkMetal, 0, 1.0, 0.4, 0, 0, 0, 8); rotors.push(rotorDisc(ctx, g, 6.5, 1.25, 0.4));
      bwCrossBoth(ctx, g, fac, 0.6, -2.8, 0.5);
    }
    turret = new THREE.Group(); turret.position.set(0, hind ? -0.45 : -0.5, hind ? 2.5 : 2.4); g.add(turret);
    barrel = new THREE.Group(); turret.add(barrel); barrel.rotation.x = 0.05;
    box(barrel, 0.3, 0.3, 0.6, M.darkMetal, 0, 0, 0.1); cyl(barrel, 0.05, 0.05, hind ? 1.1 : 1.3, M.gunMetal, 0, 0, 0.7, Math.PI / 2, 0, 0, 6);
    muzzle.position.set(0, 0, hind ? 1.3 : 1.5); barrel.add(muzzle);
  }
  if (!turret) g.add(muzzle);
  return { root: g, turret, barrel, muzzle, height: 2.6, rotors };
}
function bwCrossBoth(ctx, g, fac, y, z, s) { if (fac !== 'BW') return; for (const sg of [-1, 1]) bwCross(ctx, g, sg * 1.3, y - 0.5, z, sg > 0 ? '+x' : '-x', s); }
for (const v of ['ch53', 'nh90', 'tiger', 'hind', 'mi8']) reg(`af_${v}`, (s, t, c) => heliMod(s, t, c, v));

function jet(side, type, ctx) {
  const { add, box, cyl, sphG, M } = ctx; const a = mats(ctx);
  const g = noBlobGroup(), su = type.faction === 'SA';
  const c = su ? a.saCamo : a.grey;
  if (su) { // Su-25: gerade Flügel, zwei Triebwerke, Doppelleitwerk
    cyl(g, 0.45, 0.35, 6, c, 0, 0, 0, Math.PI / 2, 0, 0, 10); add(g, sphG(0.45, 10, 8), c, 0, 0, 3.0).scale.set(1, 1, 1.6);
    add(g, sphG(0.4, 8, 6), M.glass, 0, 0.45, 1.6).scale.set(0.9, 0.8, 1.7);
    box(g, 9, 0.1, 1.6, c, 0, 0.1, -0.2); for (const s of [-1, 1]) { cyl(g, 0.4, 0.4, 3.0, M.darkMetal, s * 0.85, -0.05, -1.4, Math.PI / 2, 0, 0, 10); box(g, 0.1, 0.9, 1.0, c, s * 1.5, 0.6, -3.0); cyl(g, 0.12, 0.12, 1.4, M.grey, s * 3.3, -0.3, 0.0, Math.PI / 2, 0, 0, 6); cyl(g, 0.12, 0.12, 1.4, M.grey, s * 2.4, -0.3, 0.0, Math.PI / 2, 0, 0, 6); star(ctx, g, s * 0.5, 0.15, -2.3, s > 0 ? '+x' : '-x', 0.6); }
    box(g, 3.0, 0.08, 0.8, c, 0, 0.7, -3.0);
  } else { // Tornado/Eurofighter-ähnlich: Deltaflügel, Seitenleitwerk
    cyl(g, 0.45, 0.4, 7, c, 0, 0, 0, Math.PI / 2, 0, 0, 10); add(g, sphG(0.45, 10, 8), c, 0, 0, 3.4).scale.set(0.9, 0.9, 1.8);
    add(g, sphG(0.4, 8, 6), M.glass, 0, 0.5, 1.9).scale.set(0.8, 0.8, 1.6);
    for (const s of [-1, 1]) { box(g, 4.0, 0.08, 3.0, c, s * 2.2, 0, -0.8, 0, s * 0.45, 0); box(g, 1.8, 0.08, 1.0, c, s * 1.2, 0, -3.2); cyl(g, 0.12, 0.12, 1.5, a.black, s * 3.3, -0.25, -0.3, Math.PI / 2, 0, 0, 6); }
    box(g, 0.1, 1.8, 1.8, c, 0, 1.0, -3.0, -0.3, 0, 0);
    add(g, sphG(0.3, 8, 6), M.engineGlow, 0, 0, -3.6, 0, 0, 0, false);
    for (const s of [-1, 1]) bwCross(ctx, g, s * 3.2, 0.06, -0.8, '+y', 0.7);
  }
  const muzzle = new THREE.Object3D(); g.add(muzzle);
  return { root: g, muzzle, height: 1.6 };
}
reg('af_jet', jet); reg('af_su25', jet);

reg('af_luna', (side, type, ctx) => {
  const { add, box, cyl, sphG, M } = ctx; const a = mats(ctx); const g = noBlobGroup();
  cyl(g, 0.16, 0.12, 2.0, a.bwTan, 0, 0, 0, Math.PI / 2, 0, 0, 8); add(g, sphG(0.16, 8, 6), a.bwTan, 0, 0, 1.0).scale.set(1, 1, 0.9);
  box(g, 4.0, 0.05, 0.45, a.bwTan, 0, 0.1, 0.2); box(g, 1.3, 0.04, 0.3, a.bwTan, 0, 0.1, -0.9); box(g, 0.04, 0.45, 0.28, a.bwTan, 0, 0.25, -0.95);
  cyl(g, 0.05, 0.05, 0.14, M.glass, 0, -0.16, 0.5, 0, 0, 0, 6); bwCross(ctx, g, 1.3, 0.13, 0.2, '+y', 0.25);
  const rot = add(g, ctx.cylG(0.35, 0.35, 0.02, 12), M.rotor, 0, 0.0, -1.1, Math.PI / 2, 0, 0, false); rot.userData.noWreck = true;
  const muzzle = new THREE.Object3D(); g.add(muzzle); g.scale.setScalar(1.5);
  return { root: g, muzzle, height: 0.6, rotors: [rot] };
});
reg('af_heron', (side, type, ctx) => {
  const { add, box, cyl, sphG, M } = ctx; const a = mats(ctx); const g = noBlobGroup();
  cyl(g, 0.3, 0.2, 3.2, a.white, 0, 0, 0, Math.PI / 2, 0, 0, 8); add(g, sphG(0.3, 8, 6), a.white, 0, 0, 1.6).scale.set(1, 1, 1.2); add(g, sphG(0.2, 8, 6), M.optic, 0, -0.3, 1.2);
  box(g, 8.0, 0.07, 0.6, a.white, 0, 0.2, 0.2); for (const s of [-1, 1]) { cyl(g, 0.07, 0.07, 2.6, a.white, s * 0.8, 0.1, -1.8, Math.PI / 2, 0, 0, 6); box(g, 0.05, 0.6, 0.5, a.white, s * 0.8, 0.45, -3.0); } box(g, 1.8, 0.05, 0.4, a.white, 0, 0.4, -3.1);
  bwCross(ctx, g, 0, 0.26, 0.2, '+y', 0.35);
  const rot = add(g, ctx.cylG(0.4, 0.4, 0.02, 12), M.rotor, 0, 0.0, -1.7, Math.PI / 2, 0, 0, false); rot.userData.noWreck = true;
  const muzzle = new THREE.Object3D(); g.add(muzzle);
  return { root: g, muzzle, height: 0.8, rotors: [rot] };
});

// ====================== Strukturen: Feldlager, Befestigungen ======================
const GEO = {};
const torusG = (r, t) => { const k = `t${r},${t}`; return GEO[k] || (GEO[k] = Object.assign(new THREE.TorusGeometry(r, t, 5, 12), { userData: { shared: true } })); };
const sbRow = (ctx, g, x, z, len, rows, ry = 0) => { // Sandsackreihe aus Einzelblöcken
  const n = Math.max(1, Math.floor(len / 0.85));
  for (let r = 0; r < rows; r++) for (let i = 0; i < n; i++) { const u = -len / 2 + (i + 0.5 + (r % 2) * 0.5) * (len / n); ctx.box(g, 0.85, 0.34, 0.55, ctx.M.sandbag, x + Math.cos(ry) * u, 0.18 + r * 0.33, z - Math.sin(ry) * u, 0, ry, 0); }
};
function gunMount(ctx, g, y, mat, len = 0.9) {
  const { box, cyl, M } = ctx;
  const turret = new THREE.Group(); turret.position.set(0, y, 0); g.add(turret);
  cyl(turret, 0.07, 0.07, 0.6, M.darkMetal, 0, 0.3, 0, 0, 0, 0, 6);
  const barrel = new THREE.Group(); barrel.position.set(0, 0.7, 0); turret.add(barrel);
  box(barrel, 0.22, 0.25, 0.8, M.darkMetal, 0, 0, 0.15); cyl(barrel, 0.035, 0.045, len, M.gunMetal, 0, 0, 0.55 + len / 2, Math.PI / 2, 0, 0, 6);
  box(barrel, 0.22, 0.2, 0.2, mat, 0.2, -0.1, 0.1);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, 0.6 + len); barrel.add(muzzle);
  return { turret, barrel, muzzle };
}
reg('af_camp_sandbag', (side, type, ctx) => {
  const g = new THREE.Group();
  sbRow(ctx, g, 0, -1.2, 4.4, 3); sbRow(ctx, g, -2.0, 0, 2.4, 3, Math.PI / 2); sbRow(ctx, g, 2.0, 0, 2.4, 3, Math.PI / 2);
  ctx.box(g, 3.6, 0.1, 2.4, mats(ctx).sDirt, 0, 0.05, 0);
  const m = gunMount(ctx, g, 0.4, ctx.M.crate);
  return { root: g, ...m, height: 2 };
});
reg('af_camp_tower', (side, type, ctx) => {
  const { box, cyl, M } = ctx; const a = mats(ctx); const g = new THREE.Group();
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(g, 0.12, 0.16, 5.2, a.sSteel, sx * 1.3, 2.6, sz * 1.3, 0, 0, 0, 6);
  for (const y of [1.4, 3.0, 4.4]) { for (const s of [-1, 1]) { box(g, 2.8, 0.1, 0.1, a.sSteel, 0, y, s * 1.3); box(g, 0.1, 0.1, 2.8, a.sSteel, s * 1.3, y, 0); } }
  for (const s of [-1, 1]) { box(g, 0.08, 3.4, 0.08, a.sSteel, s * 1.3, 2.2, 0, 0, 0, 0.0).rotation.x = 0.5 * s; }
  box(g, 3.4, 0.2, 3.4, a.sWood, 0, 5.3, 0);
  for (const s of [-1, 1]) { box(g, 3.4, 0.9, 0.5, M.sandbag, 0, 5.85, s * 1.5); box(g, 0.5, 0.9, 2.6, M.sandbag, s * 1.5, 5.85, 0); }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(g, 0.06, 0.06, 1.8, a.sSteel, sx * 1.55, 6.9, sz * 1.55, 0, 0, 0, 4);
  box(g, 3.9, 0.12, 3.9, a.sFabric, 0, 7.85, 0); box(g, 0.4, 0.3, 0.3, M.darkMetal, 1.4, 7.6, 0);
  box(g, 1.0, 0.1, 3.0, a.sWood, 0, 0.6, 2.6, 0.5, 0, 0); // Leiter
  const m = gunMount(ctx, g, 5.6, M.crate);
  return { root: g, ...m, height: 8 };
});
function tent(ctx, fabric, med) {
  const { box } = ctx; const a = mats(ctx); const g = new THREE.Group();
  box(g, 4.4, 1.5, 9, fabric, 0, 0.75, 0);
  for (const s of [-1, 1]) box(g, 2.7, 0.12, 9.4, fabric, s * 1.05, 2.0, 0, 0, 0, s * -0.55);
  box(g, 0.4, 0.1, 9.4, fabric, 0, 2.55, 0); box(g, 1.6, 1.4, 0.1, ctx.M.darkMetal, 0, 0.7, 4.52);
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) box(g, 0.08, 1.4, 0.08, a.sWood, s * 2.6, 0.7, -3 + i * 3, 0, 0, s * 0.2);
  if (med) { for (const s of [-1, 1]) { box(g, 0.04, 1.0, 1.0, ctx.M.frame, s * 2.22, 1.0, 0); box(g, 0.05, 0.9, 0.26, a.sRed, s * 2.24, 1.0, 0); box(g, 0.05, 0.26, 0.9, a.sRed, s * 2.24, 1.0, 0); } box(g, 2.2, 0.04, 2.2, ctx.M.frame, 0, 2.62, 0); box(g, 2.0, 0.05, 0.5, a.sRed, 0, 2.65, 0); box(g, 0.5, 0.05, 2.0, a.sRed, 0, 2.65, 0); }
  else for (let i = 0; i < 4; i++) box(g, 0.9, 0.6, 0.6, ctx.M.crate, -1.5 + i * 1.0, 0.3, 5.1);
  return { root: g, height: 3 };
}
reg('af_camp_tent', (s, t, c) => tent(c, mats(c).sFabric, false));
reg('af_camp_medtent', (s, t, c) => tent(c, mats(c).sFabricW, true));

reg('af_hesco', (side, type, ctx) => {
  const { box } = ctx; const a = mats(ctx); const g = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const x = -1.9 + i * 1.27;
    box(g, 1.2, 1.4, 1.5, a.sHesco, x, 0.7, 0); box(g, 1.0, 0.04, 1.3, a.sDirt, x, 1.42, 0);
    for (const sz of [-1, 1]) for (const e of [-0.55, 0, 0.55]) box(g, 0.03, 1.4, 0.03, a.sWire, x + e, 0.7, sz * 0.76);
    box(g, 1.22, 0.03, 0.03, a.sWire, x, 1.0, 0.76); box(g, 1.22, 0.03, 0.03, a.sWire, x, 0.4, 0.76);
  }
  return { root: g, height: 1.6 };
});
reg('af_concertina', (side, type, ctx) => {
  const { add, box } = ctx; const a = mats(ctx); const g = new THREE.Group();
  for (let i = 0; i < 12; i++) add(g, torusG(0.5, 0.03), a.sWire, -2.75 + i * 0.5, 0.52, 0, 0, Math.PI / 2, 0);
  for (const s of [-1, 1]) for (const e of [-1, 0, 1]) box(g, 0.05, 0.8, 0.05, a.sWire, s * 2.9 * (e === 0 ? 0 : 1) * 0.9, 0.4, 0.0);
  box(g, 5.6, 0.03, 0.03, a.sWire, 0, 0.9, 0); box(g, 5.6, 0.03, 0.03, a.sWire, 0, 0.12, 0);
  return { root: g, height: 1.2 };
});
reg('af_trench', (side, type, ctx) => {
  const { box } = ctx; const a = mats(ctx); const g = new THREE.Group();
  box(g, 5.6, 0.06, 1.6, a.sDirt, 0, 0.03, 0); // Grabensohle (dunkel)
  for (const s of [-1, 1]) { sbRow(ctx, g, 0, s * 1.05, 5.6, 2); box(g, 5.6, 0.3, 0.3, a.sDirt, 0, 0.15, s * 1.45); }
  for (const s of [-1, 1]) box(g, 0.5, 0.8, 1.8, ctx.M.sandbag, s * 2.95, 0.4, 0);
  for (let i = 0; i < 3; i++) box(g, 0.14, 0.08, 1.5, a.sWood, -1.6 + i * 1.6, 0.1, 0);
  return { root: g, height: 1.2 };
});
reg('af_foxhole', (side, type, ctx) => {
  const { cyl } = ctx; const a = mats(ctx); const g = new THREE.Group();
  cyl(g, 0.95, 1.1, 0.3, a.sDirt, 0, 0.15, 0, 0, 0, 0, 10); cyl(g, 0.55, 0.55, 0.32, ctx.M.charred, 0, 0.16, 0, 0, 0, 0, 10);
  return { root: g, height: 0.7 };
});
reg('af_sangar', (side, type, ctx) => {
  const { box } = ctx; const a = mats(ctx); const g = new THREE.Group();
  const stones = [a.sStone, a.sStone2];
  const n = 14;
  for (let i = 0; i < n; i++) {
    const ang = -Math.PI * 0.85 + (i / (n - 1)) * Math.PI * 1.7, r = 1.9;
    const x = Math.sin(ang) * r, z = -Math.cos(ang) * r * 0.8;
    for (let k = 0; k < 3; k++) { if (k === 2 && (i === 5 || i === 8)) continue; box(g, 0.9, 0.42, 0.7, stones[(i + k) % 2], x, 0.22 + k * 0.4, z, 0, -ang, 0); }
  }
  box(g, 3.2, 0.06, 2.4, a.sDirt, 0, 0.03, 0.2);
  return { root: g, height: 1.6 };
});
reg('af_dshk_nest', (side, type, ctx) => {
  const { box, cyl } = ctx; const a = mats(ctx); const g = new THREE.Group();
  const stones = [a.sStone, a.sStone2];
  const n = 12;
  for (let i = 0; i < n; i++) {
    const ang = -Math.PI * 0.9 + (i / (n - 1)) * Math.PI * 1.8, r = 2.1;
    const x = Math.sin(ang) * r, z = -Math.cos(ang) * r;
    for (let k = 0; k < 2; k++) box(g, 0.9, 0.42, 0.7, stones[(i + k) % 2], x, 0.22 + k * 0.4, z, 0, -ang, 0);
  }
  box(g, 3.4, 0.06, 3.4, a.sDirt, 0, 0.03, 0); box(g, 0.5, 0.3, 0.4, ctx.M.crate, 0.9, 0.2, -0.6);
  const turret = new THREE.Group(); turret.position.set(0, 0.5, 0); g.add(turret);
  for (const [x, z] of [[0.4, -0.3], [-0.4, -0.3], [0, 0.4]]) cyl(turret, 0.04, 0.04, 0.7, ctx.M.darkMetal, x, 0.1, z, 0.0, 0, 0, 5);
  const barrel = new THREE.Group(); barrel.position.set(0, 0.55, 0); turret.add(barrel);
  box(barrel, 0.22, 0.25, 0.9, ctx.M.darkMetal, 0, 0, 0.2); cyl(barrel, 0.045, 0.05, 1.5, ctx.M.gunMetal, 0, 0, 1.2, Math.PI / 2, 0, 0, 6); cyl(barrel, 0.09, 0.09, 0.15, ctx.M.darkMetal, 0, 0.12, 0.4, 0, 0, 0, 8);
  box(barrel, 0.8, 0.7, 0.05, ctx.M.darkMetal, 0, 0.15, 0.55); // Schutzschild
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, 2.0); barrel.add(muzzle);
  return { root: g, turret, barrel, muzzle, height: 1.8 };
});
reg('af_ied', (side, type, ctx) => {
  const { cyl, box } = ctx; const a = mats(ctx); const g = new THREE.Group();
  cyl(g, 0.7, 0.9, 0.1, a.sDirt, 0, 0.05, 0, 0, 0, 0, 8); box(g, 0.3, 0.12, 0.3, ctx.M.charred, 0.2, 0.12, 0.1); box(g, 0.02, 0.02, 1.2, a.sWire, -0.3, 0.1, 0.5, 0, 0.3, 0);
  return { root: g, height: 0.3 };
});
