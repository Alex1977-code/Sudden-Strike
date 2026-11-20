// Prozedurale 3D-Modelle für alle Einheiten und Gebäude
import * as THREE from 'three';
import { applyFow } from '../engine/fow.js';

const M = {};
let _matsReady = false;

function camoTexture(colors, seed = 1, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = colors[0]; ctx.fillRect(0, 0, size, size);
  let s = seed;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let k = 1; k < colors.length; k++) {
    ctx.fillStyle = colors[k];
    for (let i = 0; i < 18; i++) {
      const x = r() * size, y = r() * size, rad = 10 + r() * 34;
      ctx.beginPath();
      for (let a = 0; a < 6.28; a += 0.5) {
        const rr = rad * (0.6 + r() * 0.6);
        const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * 0.6;
        a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill();
    }
  }
  // Schmutz/Abnutzung
  for (let i = 0; i < 400; i++) { ctx.fillStyle = `rgba(30,25,20,${r() * 0.12})`; ctx.fillRect(r() * size, r() * size, 2 + r() * 6, 1 + r() * 3); }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function initMats() {
  if (_matsReady) return;
  _matsReady = true;
  const std = (o) => new THREE.MeshStandardMaterial(o);
  M.camoUA = std({ map: camoTexture(['#55603b', '#3c4529', '#6d6a48', '#2b2f22'], 3), roughness: 0.78, metalness: 0.25 });
  M.camoRU = std({ map: camoTexture(['#4e5236', '#3f4430', '#5d5a3e'], 7), roughness: 0.8, metalness: 0.25 });
  M.camoWinter = std({ map: camoTexture(['#c8ccc8', '#8d958a', '#e4e6e2'], 11), roughness: 0.8, metalness: 0.2 });
  M.sand = std({ color: 0x8a8060, roughness: 0.8, metalness: 0.2 });
  M.darkMetal = std({ color: 0x2b2d2f, roughness: 0.55, metalness: 0.7 });
  M.track = std({ color: 0x1c1b1a, roughness: 0.95, metalness: 0.3 });
  M.rubber = std({ color: 0x161616, roughness: 0.95 });
  M.glass = std({ color: 0x223344, roughness: 0.1, metalness: 0.6 });
  M.white = std({ color: 0xd8d8d0, roughness: 0.6, metalness: 0.2 });
  M.grey = std({ color: 0x6d7174, roughness: 0.7, metalness: 0.4 });
  M.navy = std({ color: 0x4a5560, roughness: 0.6, metalness: 0.4 });
  M.seadrone = std({ color: 0x2f3a40, roughness: 0.5, metalness: 0.4 });
  M.uniformUA = std({ map: camoTexture(['#6b6a4a', '#4c5236', '#87805e', '#3c3a2c'], 21, 64), roughness: 0.95 });
  M.uniformRU = std({ map: camoTexture(['#5a5c45', '#45483a', '#6a6550'], 33, 64), roughness: 0.95 });
  M.skin = std({ color: 0xc09070, roughness: 0.8 });
  M.helmet = std({ color: 0x4a4f36, roughness: 0.8 });
  M.iffUA = std({ color: 0xffd500, emissive: 0x332a00, roughness: 0.6 });
  M.iffUA2 = std({ color: 0x2f7de1, emissive: 0x061a33, roughness: 0.6 });
  M.iffRU = std({ color: 0xd8d8d8, roughness: 0.6 });
  M.redLight = std({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 3 });
  M.greenLight = std({ color: 0x20ff40, emissive: 0x20ff40, emissiveIntensity: 3 });
  M.engineGlow = std({ color: 0xff8030, emissive: 0xff6010, emissiveIntensity: 4 });
  M.rotor = std({ color: 0x111111, roughness: 0.6, transparent: true, opacity: 0.45 });
  M.concrete = applyFow(std({ color: 0x9a978f, roughness: 0.9 }));
  M.concreteDark = applyFow(std({ color: 0x6a6862, roughness: 0.9 }));
  M.steelBridge = applyFow(std({ color: 0x8c8f8f, roughness: 0.5, metalness: 0.7 }));
  M.wood = applyFow(std({ color: 0x6b5236, roughness: 0.9 }));
  M.tent = applyFow(std({ color: 0x55603b, roughness: 0.95 }));
  M.crate = applyFow(std({ color: 0x5b6038, roughness: 0.85 }));
  M.wreck = std({ color: 0x1a1816, roughness: 1, metalness: 0.2 });
  M.walls = [0xd9d2c3, 0xc9b9a0, 0xa9b6b8, 0xe0d8c8, 0xb59f87].map((c) => applyFow(std({ color: c, roughness: 0.92 })));
  M.roofs = [0x7a3d2e, 0x4b5a63, 0x5b4a3c, 0x384046].map((c) => applyFow(std({ color: c, roughness: 0.8, metalness: 0.1 })));
  M.window = applyFow(std({ color: 0x1b2530, roughness: 0.2, metalness: 0.5 }));
  M.windowLit = applyFow(std({ color: 0xffd28a, emissive: 0xffb050, emissiveIntensity: 1.5 }));
  M.rubble = applyFow(std({ color: 0x5a554e, roughness: 1, flatShading: true }));
}

const geoCache = {};
function boxG(w, h, d) { const k = `b${w},${h},${d}`; return geoCache[k] || (geoCache[k] = Object.assign(new THREE.BoxGeometry(w, h, d), { userData: { shared: true } })); }
function cylG(rt, rb, h, s = 12) { const k = `c${rt},${rb},${h},${s}`; return geoCache[k] || (geoCache[k] = Object.assign(new THREE.CylinderGeometry(rt, rb, h, s), { userData: { shared: true } })); }
function sphG(r, w = 12, h = 8) { const k = `s${r},${w},${h}`; return geoCache[k] || (geoCache[k] = Object.assign(new THREE.SphereGeometry(r, w, h), { userData: { shared: true } })); }

function add(parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  m.castShadow = shadow; m.receiveShadow = true;
  parent.add(m);
  return m;
}
const box = (p, w, h, d, mat, x, y, z, rx, ry, rz) => add(p, boxG(w, h, d), mat, x, y, z, rx, ry, rz);
const cyl = (p, rt, rb, h, mat, x, y, z, rx, ry, rz, s) => add(p, cylG(rt, rb, h, s), mat, x, y, z, rx, ry, rz);

// Abgeschrägte Wanne (Front angeschrägt)
function hullGeo(w, h, d, slopeFront = 0.35, slopeBack = 0.15) {
  const k = `h${w},${h},${d},${slopeFront},${slopeBack}`;
  if (geoCache[k]) return geoCache[k];
  const g = new THREE.BoxGeometry(w, h, d);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), z = p.getZ(i);
    if (z > 0 && y < 0) p.setZ(i, z - d * slopeFront);
    if (z < 0 && y > 0) p.setZ(i, z + d * slopeBack * 0.4);
    if (y > 0) p.setX(i, p.getX(i) * 0.92);
  }
  g.computeVertexNormals();
  g.userData.shared = true;
  return (geoCache[k] = g);
}

function iff(group, side, y, z = 0, w = 1.2) {
  if (side === 'UA') { box(group, w, 0.05, 0.35, M.iffUA, 0, y, z - 0.2); box(group, w, 0.05, 0.35, M.iffUA2, 0, y, z + 0.2); }
}

// ---------------- Fahrzeuge ----------------
function tank(side, variant) {
  const g = new THREE.Group();
  const cam = side === 'UA' ? M.camoUA : M.camoRU;
  const L = variant === 'leopard' ? 7.4 : 6.9, W = 3.5;
  // Ketten
  for (const s of [-1, 1]) {
    box(g, 0.8, 1.0, L * 0.96, M.track, s * (W / 2 - 0.35), 0.55, 0);
    for (let i = 0; i < 6; i++) cyl(g, 0.38, 0.38, 0.5, M.darkMetal, s * (W / 2 - 0.35), 0.45, -L * 0.38 + i * (L * 0.76 / 5), 0, 0, Math.PI / 2, 10);
    box(g, 0.9, 0.08, L * 0.98, cam, s * (W / 2 - 0.35), 1.12, 0); // Kettenschürze
  }
  add(g, hullGeo(W - 0.6, 0.9, L, 0.18, 0.1), cam, 0, 1.3, 0);
  const turret = new THREE.Group();
  turret.position.set(0, 1.75, variant === 'leopard' ? -0.4 : -0.2);
  g.add(turret);
  if (variant === 'leopard') {
    add(turret, hullGeo(2.8, 0.85, 3.6, 0.45, 0.0), cam, 0, 0.42, 0.2);
    box(turret, 2.2, 0.5, 1.2, cam, 0, 0.35, -2.0);
    box(turret, 0.5, 0.4, 0.6, M.darkMetal, 0.7, 0.95, -0.3); // Optik
    box(turret, 0.35, 0.3, 0.4, M.darkMetal, -0.6, 0.95, 0.4);
  } else {
    const dome = add(turret, sphG(1.55, 16, 8), cam, 0, 0.0, 0); dome.scale.set(1, 0.42, 1.15);
    // Reaktivpanzerung
    for (let i = 0; i < 5; i++) { const a = -0.7 + i * 0.35; box(turret, 0.55, 0.25, 0.4, cam, Math.sin(a) * 1.3, 0.45, Math.cos(a) * 1.25, 0, a, 0); }
    box(turret, 0.4, 0.4, 0.5, M.darkMetal, 0.5, 0.75, -0.4);
    if (variant === 't90') { box(turret, 0.35, 0.3, 0.3, M.redLight, -1.1, 0.45, 0.8); box(turret, 0.35, 0.3, 0.3, M.redLight, 1.1, 0.45, 0.8); }
    // Käfig ("Cope Cage")
    const cage = new THREE.Mesh(boxG(2.8, 0.05, 3.2), M.darkMetal); cage.position.set(0, 1.4, -0.2); turret.add(cage);
    for (const s of [-1, 1]) for (const t of [-1, 1]) cyl(turret, 0.04, 0.04, 1.2, M.darkMetal, s * 1.3, 0.85, t * 1.4);
  }
  const barrel = new THREE.Group();
  barrel.position.set(0, variant === 'leopard' ? 0.45 : 0.25, variant === 'leopard' ? 1.9 : 1.3);
  turret.add(barrel);
  cyl(barrel, 0.11, 0.13, 5.2, M.darkMetal, 0, 0, 2.6, Math.PI / 2, 0, 0, 8);
  cyl(barrel, 0.2, 0.2, 0.9, M.darkMetal, 0, 0, 2.6, Math.PI / 2, 0, 0, 8);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, 5.3); barrel.add(muzzle);
  iff(g, side, 1.78, -2.6);
  return { root: g, turret, barrel, muzzle, height: 3 };
}

function ifv(side, variant) {
  const g = new THREE.Group();
  const cam = side === 'UA' ? M.camoUA : M.camoRU;
  const L = variant === 'bradley' ? 6.5 : 6.6, W = 3.2;
  const tracked = variant !== 'btr';
  if (tracked) {
    for (const s of [-1, 1]) {
      box(g, 0.7, 0.9, L * 0.95, M.track, s * (W / 2 - 0.3), 0.5, 0);
      for (let i = 0; i < 6; i++) cyl(g, 0.34, 0.34, 0.45, M.darkMetal, s * (W / 2 - 0.3), 0.42, -L * 0.38 + i * (L * 0.76 / 5), 0, 0, Math.PI / 2, 10);
    }
  } else {
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) cyl(g, 0.55, 0.55, 0.45, M.rubber, s * (W / 2 - 0.2), 0.55, -2.2 + i * 1.45, 0, 0, Math.PI / 2, 12);
  }
  if (variant === 'bradley') add(g, hullGeo(W - 0.4, 1.6, L, 0.22, 0.05), cam, 0, 1.6, 0);
  else add(g, hullGeo(W - 0.4, 1.2, L, 0.4, 0.05), cam, 0, 1.4, 0);
  const turret = new THREE.Group();
  turret.position.set(0, variant === 'bradley' ? 2.4 : 2.05, variant === 'bradley' ? 0.2 : 0.4);
  g.add(turret);
  if (variant === 'bradley') { box(turret, 1.9, 0.75, 2.2, cam, 0, 0.35, 0); box(turret, 0.5, 0.5, 1.2, M.darkMetal, 1.15, 0.55, -0.2); }
  else { const d = add(turret, sphG(0.95, 12, 8), cam, 0, 0, 0); d.scale.set(1, 0.5, 1); }
  const barrel = new THREE.Group(); barrel.position.set(0, 0.35, 1.0); turret.add(barrel);
  cyl(barrel, 0.06, 0.07, 2.6, M.darkMetal, 0, 0, 1.3, Math.PI / 2, 0, 0, 6);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, 2.7); barrel.add(muzzle);
  iff(g, side, variant === 'bradley' ? 2.42 : 2.02, -2.0);
  return { root: g, turret, barrel, muzzle, height: 2.8 };
}

function truckBase(cam, L = 7, W = 2.6, wheels = 3) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) for (let i = 0; i < wheels; i++) cyl(g, 0.55, 0.55, 0.45, M.rubber, s * (W / 2 - 0.15), 0.55, L / 2 - 1.2 - i * ((L - 2) / Math.max(1, wheels - 1)), 0, 0, Math.PI / 2, 12);
  box(g, W - 0.3, 0.4, L, M.darkMetal, 0, 1.0, 0);
  // Fahrerhaus
  box(g, W, 1.6, 1.9, cam, 0, 2.0, L / 2 - 1.0);
  box(g, W - 0.2, 0.6, 0.05, M.glass, 0, 2.3, L / 2 - 0.04);
  return g;
}

function launcherTruck(side, kind) {
  const cam = side === 'UA' ? M.camoUA : M.camoRU;
  const g = truckBase(cam, kind === 'himars' ? 7 : 8.5, 2.7, kind === 'himars' ? 3 : 4);
  const turret = new THREE.Group(); turret.position.set(0, 1.3, -1.2); g.add(turret);
  const barrel = new THREE.Group(); barrel.position.set(0, 0.3, -1.5); turret.add(barrel);
  let muzzle = new THREE.Object3D();
  if (kind === 'himars') {
    box(barrel, 2.3, 1.0, 4.2, cam, 0, 0.5, 2.0);
    for (let i = 0; i < 6; i++) cyl(barrel, 0.25, 0.25, 0.05, M.darkMetal, -0.75 + (i % 3) * 0.75, 0.25 + Math.floor(i / 3) * 0.5, 4.12, Math.PI / 2, 0, 0, 8);
    muzzle.position.set(0, 0.5, 4.2);
  } else if (kind === 'patriot') {
    for (let i = 0; i < 4; i++) box(barrel, 1.0, 0.95, 5.4, cam, -0.55 + (i % 2) * 1.1, 0.5 + Math.floor(i / 2) * 1.0, 2.6);
    muzzle.position.set(0, 1.0, 5.4);
    barrel.rotation.x = -0.65;
  } else if (kind === 'irist') {
    for (let i = 0; i < 8; i++) cyl(barrel, 0.22, 0.22, 4.0, M.sand, -0.7 + (i % 4) * 0.47, 0.3 + Math.floor(i / 4) * 0.47, 2.0, Math.PI / 2, 0, 0, 8);
    muzzle.position.set(0, 0.5, 4.0);
    barrel.rotation.x = -1.2;
  } else if (kind === 's400') {
    for (let i = 0; i < 4; i++) cyl(barrel, 0.4, 0.4, 7.0, M.camoRU, -0.9 + i * 0.6, 0.5, 3.5, Math.PI / 2, 0, 0, 10);
    muzzle.position.set(0, 0.5, 7);
    barrel.rotation.x = -1.45;
  }
  barrel.add(muzzle);
  iff(g, side, 2.82, 2.4, 1.4);
  return { root: g, turret, barrel, muzzle, height: 3.5 };
}

function radarTruck(side, big = false) {
  const cam = side === 'UA' ? M.camoUA : M.camoRU;
  const g = truckBase(cam, 8, 2.7, 4);
  const turret = new THREE.Group(); turret.position.set(0, 1.5, -1.5); g.add(turret);
  box(turret, 2.4, 1.2, 2.5, cam, 0, 0.6, 0);
  const panel = box(turret, big ? 4 : 3, big ? 3.6 : 2.6, 0.35, M.grey, 0, 2.6, 0.5, -0.35, 0, 0);
  iff(g, side, 2.82, 2.6, 1.4);
  return { root: g, turret, barrel: null, muzzle: panel, height: 5, radar: turret };
}

function gepard(side) {
  const g = new THREE.Group();
  const cam = side === 'UA' ? M.camoUA : M.camoRU;
  for (const s of [-1, 1]) {
    box(g, 0.75, 1.0, 6.6, M.track, s * 1.35, 0.55, 0);
    for (let i = 0; i < 6; i++) cyl(g, 0.36, 0.36, 0.5, M.darkMetal, s * 1.35, 0.45, -2.6 + i * 1.04, 0, 0, Math.PI / 2, 10);
  }
  add(g, hullGeo(2.8, 0.9, 6.8, 0.2, 0.1), cam, 0, 1.3, 0);
  const turret = new THREE.Group(); turret.position.set(0, 1.8, -0.3); g.add(turret);
  box(turret, 2.2, 1.3, 2.6, cam, 0, 0.65, 0);
  const dish = cyl(turret, 0.9, 0.9, 0.1, M.grey, 0, 1.9, -1.0, 1.2, 0, 0, 16);
  const dish2 = cyl(turret, 0.6, 0.6, 0.1, M.grey, 0, 1.4, 1.2, 1.4, 0, 0, 16);
  const barrel = new THREE.Group(); barrel.position.set(0, 0.8, 0.2); turret.add(barrel);
  for (const s of [-1, 1]) { box(barrel, 0.4, 0.6, 1.4, cam, s * 1.35, 0, 0.3); cyl(barrel, 0.07, 0.08, 3.2, M.darkMetal, s * 1.35, 0, 2.2, Math.PI / 2, 0, 0, 6); }
  const muzzle = new THREE.Object3D(); muzzle.position.set(1.35, 0, 3.8); barrel.add(muzzle);
  iff(g, side, 1.78, -2.6);
  return { root: g, turret, barrel, muzzle, height: 3.5, radar: dish, radar2: dish2 };
}

function pantsir() {
  const g = truckBase(M.camoRU, 8.5, 2.7, 4);
  const turret = new THREE.Group(); turret.position.set(0, 1.5, -1.6); g.add(turret);
  box(turret, 2.0, 1.4, 2.0, M.camoRU, 0, 0.7, 0);
  const dish = box(turret, 1.6, 1.4, 0.3, M.grey, 0, 2.2, 0.2, -0.2, 0, 0);
  const barrel = new THREE.Group(); barrel.position.set(0, 1.0, 0); turret.add(barrel);
  for (const s of [-1, 1]) {
    for (let i = 0; i < 6; i++) cyl(barrel, 0.14, 0.14, 3.2, M.camoRU, s * (1.25 + (i % 2) * 0.3), Math.floor(i / 2) * 0.32 - 0.3, 0.8, Math.PI / 2, 0, 0, 6);
    cyl(barrel, 0.06, 0.06, 2.2, M.darkMetal, s * 0.7, -0.4, 1.4, Math.PI / 2, 0, 0, 6);
  }
  const muzzle = new THREE.Object3D(); muzzle.position.set(1.3, 0, 2.4); barrel.add(muzzle);
  return { root: g, turret, barrel, muzzle, height: 4, radar: dish };
}

function spg(side) { // Msta / 2S19
  const r = tank(side, 't72');
  r.turret.scale.set(1.15, 1.6, 1.4);
  r.barrel.scale.set(1.2, 1.2, 1.35);
  return r;
}

function pickup(side) {
  const cam = side === 'UA' ? M.camoUA : M.camoRU;
  const g = new THREE.Group();
  for (const s of [-1, 1]) for (const z of [-1.5, 1.5]) cyl(g, 0.45, 0.45, 0.35, M.rubber, s * 0.95, 0.45, z, 0, 0, Math.PI / 2, 12);
  box(g, 2.0, 0.8, 5.0, cam, 0, 0.95, 0);
  box(g, 1.9, 0.8, 1.9, cam, 0, 1.75, 0.6);
  box(g, 1.8, 0.5, 0.05, M.glass, 0, 1.85, 1.56);
  const turret = new THREE.Group(); turret.position.set(0, 1.6, -1.4); g.add(turret);
  cyl(turret, 0.08, 0.08, 1.0, M.darkMetal, 0, 0.5, 0);
  const barrel = new THREE.Group(); barrel.position.set(0, 1.0, 0); turret.add(barrel);
  box(barrel, 0.2, 0.25, 0.9, M.darkMetal, 0, 0, 0.2);
  cyl(barrel, 0.04, 0.04, 1.4, M.darkMetal, 0, 0, 1.2, Math.PI / 2, 0, 0, 6);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, 1.9); barrel.add(muzzle);
  iff(g, side, 2.17, 0.6, 1.0);
  return { root: g, turret, barrel, muzzle, height: 2.5 };
}

// ---------------- Infanterie ----------------
function soldier(side, weapon = 'rifle') {
  const g = new THREE.Group();
  const uni = side === 'UA' ? M.uniformUA : M.uniformRU;
  const body = new THREE.Group(); g.add(body);
  const legL = box(body, 0.28, 0.85, 0.3, uni, -0.17, 0.45, 0);
  const legR = box(body, 0.28, 0.85, 0.3, uni, 0.17, 0.45, 0);
  box(body, 0.62, 0.75, 0.38, uni, 0, 1.25, 0); // Torso
  box(body, 0.66, 0.5, 0.44, M.helmet, 0, 1.3, 0); // Weste
  add(body, sphG(0.17, 10, 8), M.skin, 0, 1.78, 0);
  const helm = add(body, sphG(0.21, 10, 6), M.helmet, 0, 1.85, 0); helm.scale.set(1, 0.75, 1.05);
  const armR = box(body, 0.18, 0.65, 0.2, uni, 0.38, 1.3, 0.18, -1.0, 0, 0);
  box(body, 0.18, 0.65, 0.2, uni, -0.36, 1.3, 0.22, -1.2, 0.3, 0);
  if (side === 'UA') box(body, 0.2, 0.08, 0.2, M.iffUA, 0.4, 1.55, 0); // Armbinde
  const gun = new THREE.Group(); gun.position.set(0.12, 1.4, 0.4); body.add(gun);
  if (weapon === 'javelin' || weapon === 'rpg') {
    cyl(gun, 0.09, 0.09, 1.3, weapon === 'javelin' ? M.sand : M.camoRU, 0.1, 0.25, -0.1, Math.PI / 2, 0, 0, 8);
    if (weapon === 'javelin') box(gun, 0.3, 0.3, 0.3, M.darkMetal, -0.1, 0.25, -0.2);
  } else if (weapon === 'sniper') {
    box(gun, 0.07, 0.1, 1.4, M.darkMetal, 0, 0, 0.3);
    cyl(gun, 0.04, 0.04, 0.35, M.darkMetal, 0, 0.09, 0.2, Math.PI / 2, 0, 0, 6);
  } else if (weapon === 'tablet') {
    box(gun, 0.4, 0.05, 0.3, M.darkMetal, 0, -0.05, -0.1, 0.4, 0, 0);
    cyl(gun, 0.02, 0.02, 0.5, M.darkMetal, 0.2, 0.2, -0.2, 0, 0, 0, 4);
  } else box(gun, 0.07, 0.12, 0.95, M.darkMetal, 0, 0, 0.2);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, 0.8); gun.add(muzzle);
  g.scale.setScalar(1.3);
  return { root: g, turret: null, barrel: null, muzzle, height: 2.6, body, legs: [legL, legR], arm: armR };
}

// ---------------- Luftfahrzeuge ----------------
function quad(side, size = 1, recon = false) {
  const g = new THREE.Group();
  const body = box(g, 0.6 * size, 0.25 * size, 0.9 * size, recon ? M.grey : M.darkMetal, 0, 0, 0);
  const rotors = [];
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    box(g, 0.1 * size, 0.06 * size, 0.9 * size, M.darkMetal, x * 0.35 * size, 0.05 * size, z * 0.35 * size, 0, Math.atan2(x, z), 0);
    const r = add(g, cylG(0.38 * size, 0.38 * size, 0.02, 16), M.rotor, x * 0.65 * size, 0.15 * size, z * 0.65 * size, 0, 0, 0, false);
    rotors.push(r);
  }
  if (!recon) cyl(g, 0.12 * size, 0.12 * size, 0.6 * size, M.sand, 0, -0.18 * size, 0.2 * size, Math.PI / 2, 0, 0, 8); // Gefechtskopf
  else add(g, sphG(0.15 * size, 8, 6), M.glass, 0, -0.2 * size, 0.25 * size);
  add(g, sphG(0.05, 6, 4), side === 'UA' ? M.greenLight : M.redLight, 0, 0.15 * size, -0.45 * size, 0, 0, 0, false);
  const muzzle = new THREE.Object3D(); g.add(muzzle);
  return { root: g, muzzle, height: 0.5, rotors };
}

function fixedWing(side, kind) {
  const g = new THREE.Group();
  const muzzle = new THREE.Object3D(); g.add(muzzle);
  let rotors = [];
  if (kind === 'shahed') {
    // Deltaflügel
    const shape = new THREE.Shape();
    shape.moveTo(0, 1.8); shape.lineTo(1.3, -1.0); shape.lineTo(-1.3, -1.0); shape.closePath();
    const wing = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false }), M.grey);
    wing.rotation.x = -Math.PI / 2; wing.castShadow = true; g.add(wing);
    cyl(g, 0.22, 0.18, 3.0, M.grey, 0, 0.05, 0.2, Math.PI / 2, 0, 0, 8);
    box(g, 0.05, 0.6, 0.5, M.grey, 1.2, 0.3, -0.8); box(g, 0.05, 0.6, 0.5, M.grey, -1.2, 0.3, -0.8);
    rotors.push(add(g, cylG(0.45, 0.45, 0.02, 12), M.rotor, 0, 0.05, -1.3, Math.PI / 2, 0, 0, false));
    g.scale.setScalar(1.4);
  } else if (kind === 'lancet') {
    cyl(g, 0.14, 0.12, 1.6, M.grey, 0, 0, 0, Math.PI / 2, 0, 0, 8);
    for (const z of [0.4, -0.5]) { box(g, 1.6, 0.03, 0.25, M.grey, 0, 0, z, 0, 0, Math.PI / 4); box(g, 1.6, 0.03, 0.25, M.grey, 0, 0, z, 0, 0, -Math.PI / 4); }
    g.scale.setScalar(1.6);
  } else if (kind === 'orlan' || kind === 'recon_wing') {
    cyl(g, 0.18, 0.12, 1.8, side === 'UA' ? M.white : M.grey, 0, 0, 0, Math.PI / 2, 0, 0, 8);
    box(g, 3.2, 0.05, 0.35, side === 'UA' ? M.white : M.grey, 0, 0.12, 0.2);
    box(g, 1.0, 0.04, 0.25, side === 'UA' ? M.white : M.grey, 0, 0.12, -0.8);
    rotors.push(add(g, cylG(0.3, 0.3, 0.02, 12), M.rotor, 0, 0, -0.95, Math.PI / 2, 0, 0, false));
    g.scale.setScalar(1.5);
  } else if (kind === 'cruise') { // Storm Shadow / Kalibr
    cyl(g, 0.3, 0.3, 4.6, M.grey, 0, 0, 0, Math.PI / 2, 0, 0, 10);
    add(g, sphG(0.3, 10, 6), M.grey, 0, 0, 2.3).scale.set(1, 1, 2);
    box(g, 2.8, 0.05, 0.5, M.grey, 0, 0, 0.2);
    box(g, 1.0, 0.05, 0.4, M.grey, 0, 0, -2.0);
    add(g, sphG(0.22, 8, 6), M.engineGlow, 0, 0, -2.4, 0, 0, 0, false);
  } else if (kind === 'hypersonic') {
    cyl(g, 0.12, 0.5, 6.0, M.white, 0, 0, 0, Math.PI / 2, 0, 0, 12);
    for (let i = 0; i < 4; i++) box(g, 0.04, 0.9, 0.9, M.white, 0, 0, -2.6, 0, 0, i * Math.PI / 2);
    add(g, sphG(0.5, 10, 6), M.engineGlow, 0, 0, -3.1, 0, 0, 0, false);
  } else if (kind === 'interceptor') {
    cyl(g, 0.12, 0.15, 2.8, M.white, 0, 0, 0, Math.PI / 2, 0, 0, 8);
    add(g, sphG(0.2, 8, 6), M.engineGlow, 0, 0, -1.4, 0, 0, 0, false);
  } else if (kind === 'atgm' || kind === 'rocket') {
    cyl(g, 0.12, 0.12, 1.4, kind === 'rocket' ? M.grey : M.sand, 0, 0, 0, Math.PI / 2, 0, 0, 6);
    add(g, sphG(0.15, 8, 6), M.engineGlow, 0, 0, -0.75, 0, 0, 0, false);
  }
  return { root: g, muzzle, height: 0.5, rotors };
}

function helicopter(side) { // Ka-52-artig mit Koaxialrotor
  const g = new THREE.Group();
  const cam = side === 'UA' ? M.camoUA : M.camoRU;
  const b = add(g, sphG(1.2, 14, 10), cam, 0, 0, 0.6); b.scale.set(0.85, 0.9, 2.2);
  cyl(g, 0.35, 0.18, 6.5, cam, 0, 0.2, -4.0, Math.PI / 2, 0, 0, 8);
  box(g, 0.1, 1.6, 1.0, cam, 0, 0.8, -7.0);
  box(g, 2.6, 0.08, 0.6, cam, 0, 0.2, -6.6);
  box(g, 1.4, 0.1, 0.8, M.glass, 0, 0.7, 2.6, -0.4, 0, 0);
  box(g, 4.6, 0.12, 0.7, cam, 0, -0.3, 0.3); // Stummelflügel
  for (const s of [-1, 1]) cyl(g, 0.2, 0.2, 1.8, M.grey, s * 1.9, -0.6, 0.3, Math.PI / 2, 0, 0, 8);
  cyl(g, 0.12, 0.12, 2.6, M.darkMetal, 0, 1.4, 0.4, 0, 0, 0, 6);
  const r1 = add(g, cylG(7, 7, 0.04, 24), M.rotor, 0, 1.4, 0.4, 0, 0, 0, false);
  const r2 = add(g, cylG(7, 7, 0.04, 24), M.rotor, 0, 2.5, 0.4, 0, 0, 0, false);
  const turret = new THREE.Group(); turret.position.set(0, -0.6, 2.0); g.add(turret);
  const barrel = new THREE.Group(); turret.add(barrel);
  cyl(barrel, 0.06, 0.06, 1.4, M.darkMetal, 0, 0, 0.7, Math.PI / 2, 0, 0, 6);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, 1.5); barrel.add(muzzle);
  return { root: g, turret, barrel, muzzle, height: 2, rotors: [r1, r2] };
}

// ---------------- Wasser ----------------
function seaDrone() {
  const g = new THREE.Group();
  const hull = add(g, hullGeo(1.3, 0.6, 5.5, 0.5, 0.0), M.seadrone, 0, 0.1, 0);
  box(g, 0.6, 0.3, 0.8, M.darkMetal, 0, 0.5, -1.4);
  cyl(g, 0.03, 0.03, 0.8, M.darkMetal, 0, 0.9, -1.6, 0, 0, 0, 4);
  add(g, sphG(0.06, 6, 4), M.greenLight, 0, 1.3, -1.6, 0, 0, 0, false);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, 2.7); g.add(muzzle);
  g.scale.setScalar(1.5);
  return { root: g, muzzle, height: 1.2, hull };
}
function patrolBoat() {
  const g = new THREE.Group();
  add(g, hullGeo(4.2, 2.0, 16, 0.35, 0.0), M.navy, 0, 0.6, 0);
  box(g, 3.0, 2.2, 5, M.navy, 0, 2.6, -1.5);
  box(g, 3.05, 0.5, 0.1, M.glass, 0, 3.2, 1.0);
  cyl(g, 0.1, 0.1, 3, M.darkMetal, 0, 5, -2.0, 0, 0, 0, 6);
  const turret = new THREE.Group(); turret.position.set(0, 1.9, 4.5); g.add(turret);
  box(turret, 1.2, 0.8, 1.2, M.navy, 0, 0.4, 0);
  const barrel = new THREE.Group(); barrel.position.set(0, 0.5, 0.5); turret.add(barrel);
  cyl(barrel, 0.06, 0.06, 1.8, M.darkMetal, 0, 0, 0.9, Math.PI / 2, 0, 0, 6);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, 1.9); barrel.add(muzzle);
  return { root: g, turret, barrel, muzzle, height: 4 };
}

// ---------------- Gebäude & Ziele ----------------
export function house(h) {
  initMats();
  const g = new THREE.Group();
  const wall = M.walls[h.style % M.walls.length], roof = M.roofs[h.style % M.roofs.length];
  const fh = 3.0, H = h.floors * fh;
  const body = box(g, h.w, H, h.d, wall, 0, H / 2, 0);
  // Fenster
  const winMat = h.lit ? M.windowLit : M.window;
  for (let f = 0; f < h.floors; f++) {
    const y = f * fh + 1.7;
    const nx = Math.max(1, Math.floor(h.w / 2.4));
    for (let i = 0; i < nx; i++) {
      const x = -h.w / 2 + (i + 0.5) * (h.w / nx);
      box(g, 0.9, 1.1, 0.06, (h.lit && Math.random() < 0.3) ? M.windowLit : M.window, x, y, h.d / 2 + 0.02);
      box(g, 0.9, 1.1, 0.06, M.window, x, y, -h.d / 2 - 0.02);
    }
  }
  if (h.floors <= 2) {
    // Satteldach
    const shape = new THREE.Shape();
    shape.moveTo(-h.w / 2 - 0.4, 0); shape.lineTo(0, Math.min(3, h.w * 0.35)); shape.lineTo(h.w / 2 + 0.4, 0); shape.closePath();
    const rg = new THREE.ExtrudeGeometry(shape, { depth: h.d + 0.8, bevelEnabled: false });
    rg.translate(0, 0, -(h.d + 0.8) / 2);
    const r = new THREE.Mesh(rg, roof); r.position.y = H; r.castShadow = true; r.receiveShadow = true; g.add(r);
  } else {
    box(g, h.w + 0.3, 0.4, h.d + 0.3, M.concreteDark, 0, H + 0.2, 0);
    box(g, 1.5, 1.2, 1.5, M.concreteDark, h.w * 0.25, H + 0.8, 0);
  }
  return { root: g, height: H + 2, body };
}
export function rubble(w, d) {
  initMats();
  const g = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8 + Math.random() * 1.2, 0), M.rubble);
    m.position.set((Math.random() - 0.5) * w * 0.8, 0.3, (Math.random() - 0.5) * d * 0.8);
    m.scale.y = 0.5; m.rotation.set(Math.random(), Math.random(), Math.random());
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
  }
  const base = box(g, w * 0.9, 0.6, d * 0.9, M.rubble, 0, 0.3, 0);
  return g;
}

function structure(kind, side) {
  const g = new THREE.Group();
  let height = 4, radar = null;
  if (kind === 'hq') {
    box(g, 8, 2.6, 5, M.tent, 0, 1.3, 0);
    box(g, 8.6, 0.2, 5.6, M.tent, 0, 2.7, 0, 0, 0, 0.04);
    for (let i = 0; i < 6; i++) box(g, 1.4, 0.7, 0.7, M.crate, -4 + i * 1.6, 0.35, 3.2);
    cyl(g, 0.05, 0.05, 9, M.darkMetal, 3.5, 4.5, -2, 0, 0, 0, 4);
    radar = cyl(g, 0.8, 0.8, 0.08, M.grey, -2.6, 3.4, -1.8, 1.0, 0, 0, 16);
    if (side === 'UA') { box(g, 1.2, 0.4, 0.05, M.iffUA2, 3.5, 8.3, -1.75); box(g, 1.2, 0.4, 0.05, M.iffUA, 3.5, 7.9, -1.75); }
    height = 5;
  } else if (kind === 'radar' || kind === 's400radar') {
    box(g, 4, 2.4, 9, side === 'UA' ? M.camoUA : M.camoRU, 0, 1.6, 0);
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) cyl(g, 0.55, 0.55, 0.45, M.rubber, s * 1.8, 0.55, -3 + i * 2, 0, 0, Math.PI / 2, 12);
    radar = new THREE.Group(); radar.position.set(0, 3, -1); g.add(radar);
    box(radar, 1, 2.5, 1, M.darkMetal, 0, 1.2, 0);
    box(radar, 6, 4.5, 0.4, M.grey, 0, 4.2, 0.4, -0.3, 0, 0);
    height = 9;
  } else if (kind === 'depot') {
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
      box(g, 2.2, 1.2, 1.3, M.crate, -3 + i * 3, 0.6, -1.2 + j * 2.4);
      box(g, 2.2, 1.2, 1.3, M.crate, -3 + i * 3, 1.8, -1.2 + j * 2.4);
    }
    const tarp = box(g, 9.5, 0.15, 6, M.tent, 0, 3.2, 0, 0.05, 0, 0);
    for (const x of [-4.5, 4.5]) for (const z of [-2.8, 2.8]) cyl(g, 0.08, 0.08, 3.2, M.wood, x, 1.6, z, 0, 0, 0, 4);
    height = 4;
  } else if (kind === 'powerplant') {
    const tower = add(g, cylG(5, 7.5, 18, 24), M.concrete, -8, 9, 0);
    add(g, cylG(5, 6.5, 14, 24), M.concrete, 8, 7, -4);
    box(g, 12, 9, 10, M.concreteDark, 2, 4.5, 8);
    cyl(g, 0.8, 1.0, 22, M.concrete, 8, 11, 10, 0, 0, 0, 10);
    for (let i = 0; i < 4; i++) { box(g, 2.0, 2.4, 2.0, M.grey, -6 + i * 3.5, 1.2, -12); cyl(g, 0.06, 0.06, 5, M.darkMetal, -6 + i * 3.5, 4.5, -12, 0, 0, 0, 4); }
    height = 20;
  } else if (kind === 'substation') {
    for (let i = 0; i < 3; i++) { box(g, 2.6, 2.8, 2.2, M.grey, -4 + i * 4, 1.4, 0); cyl(g, 0.15, 0.15, 2, M.white, -4 + i * 4, 3.6, 0, 0, 0, 0, 6); }
    for (const x of [-6, 6]) { const t = box(g, 0.3, 9, 0.3, M.darkMetal, x, 4.5, -3); box(g, 5, 0.25, 0.25, M.darkMetal, x, 8.5, -3); }
    height = 9;
  } else if (kind === 'bunker') {
    box(g, 6, 2, 6, M.concreteDark, 0, 1, 0);
    box(g, 3, 0.4, 0.2, M.darkMetal, 0, 1.3, 3.05);
    height = 2.5;
  } else if (kind === 'fuel') {
    for (let i = 0; i < 3; i++) add(g, cylG(2.2, 2.2, 4, 18), M.white, -5 + i * 5, 2, 0);
    height = 4;
  } else if (kind === 'rail') { // Munitionszug-Waggon
    box(g, 2.8, 2.6, 12, M.camoRU, 0, 2.1, 0);
    for (const z of [-4.5, 4.5]) for (const s of [-1, 1]) cyl(g, 0.45, 0.45, 0.2, M.darkMetal, s * 1.1, 0.5, z, 0, 0, Math.PI / 2, 10);
    height = 4;
  }
  return { root: g, height, radar };
}

// Brückensegment (Fahrbahn + Pfeiler) als Ziel
export function bridgeSpan(len, kind = 'road') {
  initMats();
  const g = new THREE.Group();
  const deck = box(g, len, 1.3, kind === 'road' ? 11 : 7, M.concrete, 0, 0, 0);
  box(g, len, 0.6, 0.25, M.steelBridge, 0, 1.0, (kind === 'road' ? 5.5 : 3.5));
  box(g, len, 0.6, 0.25, M.steelBridge, 0, 1.0, -(kind === 'road' ? 5.5 : 3.5));
  if (kind === 'rail') { box(g, len, 0.15, 0.15, M.darkMetal, 0, 0.72, 0.75); box(g, len, 0.15, 0.15, M.darkMetal, 0, 0.72, -0.75); }
  else for (let i = 0; i < len / 8; i++) box(g, 3, 0.03, 0.2, M.white, -len / 2 + 4 + i * 8, 0.66, 0);
  return { root: g, height: 3, deck };
}

// Komplette dekorative Brücke (Pfeiler & Bögen)
export function bridgeDecor(x0, x1, z, deckY, seaLevel, gapCenters = [], gapLen = 0) {
  initMats();
  const g = new THREE.Group();
  const lanes = [{ dz: -7, w: 11, kind: 'road' }, { dz: 7, w: 7, kind: 'rail' }];
  const inGap = (x) => gapCenters.some((c) => Math.abs(x - c.x) < gapLen / 2 && true);
  for (const L of lanes) {
    const gaps = gapCenters.filter((c) => c.kind === L.kind);
    const segs = [];
    let cur = x0;
    for (const gp of gaps.sort((a, b) => a.x - b.x)) { segs.push([cur, gp.x - gapLen / 2]); cur = gp.x + gapLen / 2; }
    segs.push([cur, x1]);
    for (const [a, b] of segs) {
      if (b - a < 0.5) continue;
      const len = b - a;
      const d = box(g, len, 1.3, L.w, M.concrete, (a + b) / 2, deckY, z + L.dz);
      box(g, len, 0.6, 0.25, M.steelBridge, (a + b) / 2, deckY + 1.0, z + L.dz + L.w / 2);
      box(g, len, 0.6, 0.25, M.steelBridge, (a + b) / 2, deckY + 1.0, z + L.dz - L.w / 2);
    }
    // Pfeiler
    for (let x = x0 + 6; x < x1; x += 14) {
      const h = deckY - seaLevel + 8;
      cyl(g, 1.0, 1.3, h, M.concreteDark, x, deckY - h / 2 - 0.6, z + L.dz - L.w * 0.25, 0, 0, 0, 10);
      cyl(g, 1.0, 1.3, h, M.concreteDark, x, deckY - h / 2 - 0.6, z + L.dz + L.w * 0.25, 0, 0, 0, 10);
    }
  }
  // Bogen über Fahrrinne (Mitte)
  const mid = (x0 + x1) / 2;
  for (const L of lanes) for (const s of [-1, 1]) {
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(mid - 30, deckY + 0.5, z + L.dz + s * L.w / 2), new THREE.Vector3(mid, deckY + 28, z + L.dz + s * L.w / 2), new THREE.Vector3(mid + 30, deckY + 0.5, z + L.dz + s * L.w / 2));
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.7, 8, false), M.steelBridge);
    tube.castShadow = true; g.add(tube);
    for (let i = 1; i < 10; i++) {
      const p = curve.getPoint(i / 10);
      cyl(g, 0.08, 0.08, p.y - deckY, M.darkMetal, p.x, (p.y + deckY) / 2, p.z, 0, 0, 0, 4);
    }
  }
  return g;
}

// ---------------- Fabrik ----------------
export function buildModel(type, side, season) {
  initMats();
  let r;
  switch (type.model) {
    case 'leopard': r = tank(side, 'leopard'); break;
    case 't72': r = tank(side, 't72'); break;
    case 't90': r = tank(side, 't90'); break;
    case 'bradley': r = ifv(side, 'bradley'); break;
    case 'bmp': r = ifv(side, 'bmp'); break;
    case 'btr': r = ifv(side, 'btr'); break;
    case 'gepard': r = gepard(side); break;
    case 'himars': r = launcherTruck(side, 'himars'); break;
    case 'patriot': r = launcherTruck(side, 'patriot'); break;
    case 'irist': r = launcherTruck(side, 'irist'); break;
    case 's400': r = launcherTruck(side, 's400'); break;
    case 'radartruck': r = radarTruck(side, true); break;
    case 'pantsir': r = pantsir(); break;
    case 'spg': r = spg(side); break;
    case 'pickup': r = pickup(side); break;
    case 'truck': {
      const cam = side === 'UA' ? M.camoUA : M.camoRU;
      const g = truckBase(cam, 7.5, 2.6, 3);
      box(g, 2.6, 2.2, 4.8, M.tent, 0, 2.3, -1.2);
      const muzzle = new THREE.Object3D(); g.add(muzzle);
      r = { root: g, muzzle, height: 3.4 };
      break;
    }
    case 'soldier': r = soldier(side, type.weaponModel || 'rifle'); break;
    case 'quad': r = quad(side, type.modelSize || 1, false); break;
    case 'reconquad': r = quad(side, type.modelSize || 1.6, true); break;
    case 'shahed': case 'lancet': case 'orlan': case 'recon_wing': r = fixedWing(side, type.model); break;
    case 'heli': r = helicopter(side); break;
    case 'seadrone': r = seaDrone(); break;
    case 'boat': r = patrolBoat(); break;
    case 'bridge_road': r = bridgeSpan(type.spanLen || 28, 'road'); break;
    case 'bridge_rail': r = bridgeSpan(type.spanLen || 28, 'rail'); break;
    default: r = structure(type.model, side);
  }
  // Winter-Tarnung
  if (season === 'winter' && side === 'UA') r.root.traverse((o) => { if (o.material === M.camoUA) o.material = M.camoWinter; });
  return r;
}
export function projectileModel(kind) { initMats(); return fixedWing('UA', kind); }
export function wreckify(root) {
  initMats();
  root.traverse((o) => { if (o.isMesh && o.material !== M.rotor) { o.material = M.wreck; } });
}
export const Materials = M;
export { initMats };
