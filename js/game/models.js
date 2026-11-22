// Prozedurale 3D-Modelle für alle Einheiten und Gebäude
import * as THREE from 'three';
import { applyFow } from '../engine/fow.js';

const M = {};
let _matsReady = false;

// ---------------- Texturen ----------------
function mkCanvas(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function mkRand(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
function finishTex(c, aniso = 4) {
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = aniso;
  return tex;
}

function camoTexture(colors, seed = 1, size = 256) {
  const [c, ctx] = mkCanvas(size);
  ctx.fillStyle = colors[0]; ctx.fillRect(0, 0, size, size);
  const r = mkRand(seed);
  const k0 = size / 256;
  for (let k = 1; k < colors.length; k++) {
    ctx.fillStyle = colors[k];
    for (let i = 0; i < 18; i++) {
      const x = r() * size, y = r() * size, rad = (10 + r() * 34) * k0;
      ctx.beginPath();
      for (let a = 0; a < 6.28; a += 0.5) {
        const rr = rad * (0.6 + r() * 0.6);
        const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * 0.6;
        a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill();
    }
  }
  if (size >= 128) {
    // Abgeplatzter Lack (helle Kratzer an Kanten) + Regenstreifen + Staub
    for (let i = 0; i < 90; i++) { ctx.fillStyle = `rgba(150,140,115,${0.1 + r() * 0.25})`; ctx.fillRect(r() * size, r() * size, 1 + r() * 5, 1); }
    for (let i = 0; i < 26; i++) { const x = r() * size, y = r() * size * 0.7; const g = ctx.createLinearGradient(0, y, 0, y + 50 * k0); g.addColorStop(0, `rgba(20,16,10,${0.16 + r() * 0.12})`); g.addColorStop(1, 'rgba(20,16,10,0)'); ctx.fillStyle = g; ctx.fillRect(x, y, 1 + r() * 2, 50 * k0); }
    const edge = ctx.createLinearGradient(0, 0, 0, size); edge.addColorStop(0, 'rgba(0,0,0,0.0)'); edge.addColorStop(0.85, 'rgba(70,55,35,0.0)'); edge.addColorStop(1, 'rgba(70,55,35,0.22)');
    ctx.fillStyle = edge; ctx.fillRect(0, 0, size, size);
  }
  for (let i = 0; i < 400; i++) { ctx.fillStyle = `rgba(30,25,20,${r() * 0.12})`; ctx.fillRect(r() * size, r() * size, (2 + r() * 6) * k0, (1 + r() * 3) * k0); }
  return finishTex(c);
}

function trackTexture() {
  const [c, ctx] = mkCanvas(64);
  ctx.fillStyle = '#1b1a19'; ctx.fillRect(0, 0, 64, 64);
  for (const x of [2, 34]) {
    ctx.fillStyle = '#3b3936'; ctx.fillRect(x, 0, 26, 64);
    ctx.fillStyle = '#0d0d0c'; ctx.fillRect(x + 26, 0, 4, 64);
    ctx.fillStyle = '#55524d'; ctx.fillRect(x + 2, 4, 22, 3); ctx.fillRect(x + 2, 56, 22, 3);
    ctx.fillStyle = '#6b6761'; ctx.fillRect(x + 11, 28, 4, 8);
  }
  const r = mkRand(5);
  for (let i = 0; i < 90; i++) { ctx.fillStyle = `rgba(90,70,45,${r() * 0.2})`; ctx.fillRect(r() * 64, r() * 64, 2 + r() * 4, 2 + r() * 3); }
  return finishTex(c);
}

function plasterTexture(base, seed, dirt = 0.5) {
  const [c, ctx] = mkCanvas(256);
  ctx.fillStyle = base; ctx.fillRect(0, 0, 256, 256);
  const r = mkRand(seed);
  for (let i = 0; i < 60; i++) { ctx.fillStyle = `rgba(${r() < 0.5 ? '255,250,235' : '60,50,40'},${0.03 + r() * 0.06})`; ctx.beginPath(); ctx.ellipse(r() * 256, r() * 256, 10 + r() * 40, 8 + r() * 30, r() * 3, 0, 6.3); ctx.fill(); }
  for (let i = 0; i < 700; i++) { ctx.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '40,30,20'},${r() * 0.1})`; ctx.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1 + r() * 2); }
  // abgeplatzter Putz (Ziegel scheint durch) und Risse
  for (let i = 0; i < 6; i++) { if (r() > dirt) continue; const x = r() * 240, y = r() * 240; ctx.fillStyle = 'rgba(140,85,65,0.5)'; ctx.fillRect(x, y, 6 + r() * 14, 4 + r() * 8); ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(x - 1, y + 6, 10, 1); }
  for (let i = 0; i < 5; i++) { const x = r() * 256, y = r() * 200; const g = ctx.createLinearGradient(0, y, 0, y + 60); g.addColorStop(0, `rgba(40,35,30,${0.12 + r() * 0.1})`); g.addColorStop(1, 'rgba(40,35,30,0)'); ctx.fillStyle = g; ctx.fillRect(x, y, 3 + r() * 6, 60); }
  return finishTex(c);
}

function panelTexture(base, seed) {
  const [c, ctx] = mkCanvas(256);
  ctx.fillStyle = base; ctx.fillRect(0, 0, 256, 256);
  const r = mkRand(seed);
  for (let i = 0; i < 900; i++) { ctx.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '30,30,30'},${r() * 0.08})`; ctx.fillRect(r() * 256, r() * 256, 1 + r() * 3, 1 + r() * 3); }
  for (let i = 0; i < 6; i++) { const x = r() * 256, y = r() * 150; const g = ctx.createLinearGradient(0, y, 0, y + 100); g.addColorStop(0, `rgba(30,30,30,${0.15 + r() * 0.1})`); g.addColorStop(1, 'rgba(30,30,30,0)'); ctx.fillStyle = g; ctx.fillRect(x, y, 4 + r() * 8, 100); }
  // Plattenfugen
  ctx.fillStyle = 'rgba(40,40,40,0.45)';
  ctx.fillRect(0, 0, 256, 3); ctx.fillRect(0, 0, 3, 256); ctx.fillRect(126, 0, 2, 256);
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(0, 3, 256, 2); ctx.fillRect(3, 0, 2, 256);
  return finishTex(c);
}

function roofTexture(kind, base, seed) {
  const [c, ctx] = mkCanvas(128);
  ctx.fillStyle = base; ctx.fillRect(0, 0, 128, 128);
  const r = mkRand(seed);
  if (kind === 'tile') {
    for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
      const x = col * 16 + (row % 2) * 8, y = row * 16;
      const l = r();
      ctx.fillStyle = l < 0.5 ? `rgba(0,0,0,${l * 0.3})` : `rgba(255,255,255,${(l - 0.5) * 0.18})`;
      ctx.fillRect(x, y, 16, 16);
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x, y + 13, 16, 3); ctx.fillRect(x, y, 1, 16);
      ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(x + 1, y, 15, 1);
    }
    for (let i = 0; i < 22; i++) { ctx.fillStyle = `rgba(70,95,40,${0.1 + r() * 0.15})`; ctx.fillRect(r() * 128, r() * 128, 2 + r() * 6, 2 + r() * 5); }
  } else {
    for (let x = 0; x < 128; x += 16) {
      ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(x, 0, 2, 128);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x + 2, 0, 3, 128);
      ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(x + 5, 0, 11, 128);
    }
    for (let i = 0; i < 30; i++) { ctx.fillStyle = `rgba(120,60,30,${0.1 + r() * 0.2})`; ctx.fillRect(r() * 128, r() * 128, 2 + r() * 8, 3 + r() * 12); }
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(0, 62, 128, 2);
  }
  return finishTex(c);
}

let _blobTex = null;
function blobTexture() {
  if (_blobTex) return _blobTex;
  const [c, ctx] = mkCanvas(64);
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
  g.addColorStop(0, 'rgba(0,0,0,0.62)'); g.addColorStop(0.5, 'rgba(0,0,0,0.36)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  _blobTex = new THREE.CanvasTexture(c);
  _blobTex.colorSpace = THREE.SRGBColorSpace;
  return _blobTex;
}

function initMats() {
  if (_matsReady) return;
  _matsReady = true;
  const std = (o) => new THREE.MeshStandardMaterial(o);
  M.camoUA = std({ map: camoTexture(['#55603b', '#3c4529', '#6d6a48', '#2b2f22'], 3), roughness: 0.85, metalness: 0.15 });
  M.camoRU = std({ map: camoTexture(['#4e5236', '#3f4430', '#5d5a3e'], 7), roughness: 0.85, metalness: 0.15 });
  M.camoWinter = std({ map: camoTexture(['#c8ccc8', '#8d958a', '#e4e6e2'], 11), roughness: 0.85, metalness: 0.12 });
  M.sand = std({ color: 0x8a8060, roughness: 0.8, metalness: 0.2 });
  M.darkMetal = std({ color: 0x2b2d2f, roughness: 0.5, metalness: 0.75 });
  M.gunMetal = std({ color: 0x1c1d1f, roughness: 0.35, metalness: 0.85 });
  M.rim = std({ color: 0x585b5c, roughness: 0.45, metalness: 0.8 });
  M.track = std({ map: trackTexture(), roughness: 0.9, metalness: 0.4 });
  M.rubber = std({ color: 0x161616, roughness: 0.95 });
  M.glass = std({ color: 0x223344, roughness: 0.1, metalness: 0.6 });
  M.optic = std({ color: 0x0b1a14, roughness: 0.05, metalness: 0.9, emissive: 0x03130a });
  M.white = std({ color: 0xd8d8d0, roughness: 0.6, metalness: 0.2 });
  M.grey = std({ color: 0x6d7174, roughness: 0.7, metalness: 0.4 });
  M.navy = std({ color: 0x4a5560, roughness: 0.6, metalness: 0.4 });
  M.seadrone = std({ color: 0x2f3a40, roughness: 0.5, metalness: 0.4 });
  M.era = std({ color: 0x353a2a, roughness: 0.7, metalness: 0.45 });
  M.tarp = std({ color: 0x59603f, roughness: 1 });
  M.wood2 = std({ color: 0x7a5d3a, roughness: 0.9 });
  M.headlight = std({ color: 0xfff1c0, emissive: 0x6a5a20, roughness: 0.2 });
  M.uniformUA = std({ map: camoTexture(['#6b6a4a', '#4c5236', '#87805e', '#3c3a2c'], 21, 64), roughness: 0.95 });
  M.uniformRU = std({ map: camoTexture(['#5a5c45', '#45483a', '#6a6550'], 33, 64), roughness: 0.95 });
  M.skin = std({ color: 0xc09070, roughness: 0.8 });
  M.helmet = std({ color: 0x4a4f36, roughness: 0.8 });
  M.vest = std({ color: 0x3b3d2f, roughness: 0.9 });
  M.vestUA = std({ color: 0x5a553c, roughness: 0.9 });
  M.pack = std({ color: 0x4a4d38, roughness: 0.95 });
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
  M.sandbag = applyFow(std({ color: 0x8a7d5c, roughness: 1 }));
  M.wreck = std({ color: 0x1a1816, roughness: 1, metalness: 0.2 });
  M.charred = applyFow(std({ color: 0x25221f, roughness: 1 }));
  const wallCols = ['#d9d2c3', '#c9b9a0', '#a9b6b8', '#e0d8c8', '#b59f87'];
  M.walls = wallCols.map((c, i) => applyFow(std({ map: plasterTexture(c, 40 + i * 7), roughness: 0.92 })));
  M.panels = ['#b9b6ac', '#a8aaa4', '#c4bfae'].map((c, i) => applyFow(std({ map: panelTexture(c, 60 + i * 5), roughness: 0.94 })));
  M.roofs = [
    ['tile', '#8a4533'], ['metal', '#56646d'], ['tile', '#6a5240'], ['metal', '#3f464c'],
  ].map(([k, c], i) => applyFow(std({ map: roofTexture(k, c, 80 + i * 3), roughness: k === 'metal' ? 0.55 : 0.85, metalness: k === 'metal' ? 0.35 : 0.05 })));
  M.brick = applyFow(std({ color: 0x86483a, roughness: 0.95 }));
  M.frame = applyFow(std({ color: 0xe6e2d6, roughness: 0.7 }));
  M.shutters = [0x4d6b48, 0x7a4a36].map((c) => applyFow(std({ color: c, roughness: 0.8 })));
  M.door = applyFow(std({ color: 0x4a3a2c, roughness: 0.85 }));
  M.window = applyFow(std({ color: 0x1b2530, roughness: 0.2, metalness: 0.5 }));
  M.windowLit = applyFow(std({ color: 0xffd28a, emissive: 0xffb050, emissiveIntensity: 1.5 }));
  M.rubble = applyFow(std({ color: 0x5a554e, roughness: 1, flatShading: true }));
  M.blob = new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
}

// ---------------- Geometrie-Helfer ----------------
const geoCache = {};
const shared = (g) => { g.userData.shared = true; return g; };
function boxG(w, h, d) { const k = `b${w},${h},${d}`; return geoCache[k] || (geoCache[k] = shared(new THREE.BoxGeometry(w, h, d))); }
function cylG(rt, rb, h, s = 12) { const k = `c${rt},${rb},${h},${s}`; return geoCache[k] || (geoCache[k] = shared(new THREE.CylinderGeometry(rt, rb, h, s))); }
function sphG(r, w = 12, h = 8) { const k = `s${r},${w},${h}`; return geoCache[k] || (geoCache[k] = shared(new THREE.SphereGeometry(r, w, h))); }
// Box mit weltmaßstäblichen UVs (Textur wiederholt sich alle s Einheiten)
function tiledBoxG(w, h, d, s = 4) {
  const k = `t${w},${h},${d},${s}`;
  if (geoCache[k]) return geoCache[k];
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const j = f * 4 + i; uv.setXY(j, uv.getX(j) * dims[f][0] / s, uv.getY(j) * dims[f][1] / s); }
  return (geoCache[k] = shared(g));
}

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

// Einfaches Geometrie-Merging (Position/Normale/UV), Matrix wird eingebacken
class Merger {
  constructor() { this.p = []; this.n = []; this.u = []; this.count = 0; }
  add(geo, m) {
    const g = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(m);
    this.p.push(g.attributes.position.array); this.n.push(g.attributes.normal.array); this.u.push(g.attributes.uv.array);
    this.count++; g.dispose();
  }
  build() {
    const cat = (arrs) => { let len = 0; for (const a of arrs) len += a.length; const out = new Float32Array(len); let o = 0; for (const a of arrs) { out.set(a, o); o += a.length; } return out; };
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(cat(this.p), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(cat(this.n), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(cat(this.u), 2));
    return g;
  }
}
const _o = new THREE.Object3D();
function mat4(x, y, z, ry = 0, rx = 0, rz = 0) { _o.position.set(x, y, z); _o.rotation.set(rx, ry, rz); _o.updateMatrix(); return _o.matrix; }
function flushMerged(parent, merger, material, shadow = true) {
  if (!merger.count) return null;
  const m = new THREE.Mesh(merger.build(), material);
  m.castShadow = shadow; m.receiveShadow = true;
  parent.add(m);
  return m;
}

// ---------------- Draw-Call-Reduktion ----------------
// Nach dem Bau eines Modells werden alle statischen Teil-Meshes, die sich gemeinsam mit demselben
// Transform-Knoten (Wurzel, Turm, Rohr, Bein, …) bewegen, zu möglichst wenigen Meshes zusammengeführt.
// Unterschiedliche einfarbige Standard-Materialien werden dabei über ein "Sammelmaterial" vereint:
// Farbe, Rauheit, Metallizität und Eigenleuchten liegen pro Vertex vor, die Textur (Tarnmuster,
// Putz, Dach …) wird nur auf den Teilen gezeigt, die sie ursprünglich hatten (Gewicht pro Vertex).
// Ergebnis: 1–2 Draw Calls je Transform-Knoten statt einem pro Teil, bei gleicher Optik.
const _uberMats = new Map();
function isFowMat(m) { try { return m.customProgramCacheKey() === 'fow'; } catch { return false; } }
function uberEligible(m) {
  return !!m && m.isMeshStandardMaterial && !m.isMeshPhysicalMaterial && !m.transparent && !m.flatShading && m.visible &&
    m.side === THREE.FrontSide && m.opacity === 1 && !m.vertexColors && !m.normalMap && !m.bumpMap && !m.roughnessMap &&
    !m.metalnessMap && !m.emissiveMap && !m.alphaMap && !m.aoMap && !m.lightMap && !m.envMap && !m.displacementMap &&
    (m.envMapIntensity ?? 1) === 1 &&
    (isFowMat(m) || m.onBeforeCompile === THREE.Material.prototype.onBeforeCompile);
}
function patchUber(s) {
  s.vertexShader = s.vertexShader
    .replace('#include <common>', `#include <common>
      attribute vec3 ubCol; attribute vec3 ubRMT; attribute vec3 ubEm;
      varying vec3 vUbCol; varying vec3 vUbRMT; varying vec3 vUbEm;`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      vUbCol = ubCol; vUbRMT = ubRMT; vUbEm = ubEm;`);
  s.fragmentShader = s.fragmentShader
    .replace('#include <common>', `#include <common>
      varying vec3 vUbCol; varying vec3 vUbRMT; varying vec3 vUbEm;`)
    .replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = vUbEm;')
    .replace('#include <map_fragment>', `#ifdef USE_MAP
        diffuseColor *= mix(vec4(1.0), texture2D(map, vMapUv), vUbRMT.z);
      #endif
      diffuseColor.rgb *= vUbCol;`)
    .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vUbRMT.x;')
    .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vUbRMT.y;');
}
function uberMat(map, fow) {
  const key = (map ? map.uuid : '-') + (fow ? 'f' : '');
  let m = _uberMats.get(key);
  if (m) return m;
  m = new THREE.MeshStandardMaterial({ map: map || null, roughness: 1, metalness: 0 });
  if (fow) applyFow(m);
  const fowCompile = fow ? m.onBeforeCompile : null;
  // Nebel-Patch zuerst (hängt sich hinter <map_fragment>), danach das Sammelmaterial (ersetzt <map_fragment>)
  m.onBeforeCompile = (s, r) => { if (fowCompile) fowCompile(s, r); patchUber(s); };
  m.customProgramCacheKey = () => (fow ? 'uberfow' : 'uber');
  m.userData.uber = true;
  _uberMats.set(key, m);
  return m;
}

const _v3 = new THREE.Vector3(), _nm3 = new THREE.Matrix3();
// parts: [{ geo, matrix, mat }] → indizierte BufferGeometry (Matrix eingebacken), optional mit Sammel-Attributen
function mergeParts(parts, uber) {
  let nv = 0, ni = 0;
  for (const p of parts) { const c = p.geo.attributes.position.count; nv += c; ni += p.geo.index ? p.geo.index.count : c; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
  const col = uber ? new Float32Array(nv * 3) : null, rmt = uber ? new Float32Array(nv * 3) : null, em = uber ? new Float32Array(nv * 3) : null;
  const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  let vo = 0, io = 0;
  for (const p of parts) {
    const g = p.geo, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, m = p.mat;
    _nm3.getNormalMatrix(p.matrix);
    const flip = p.matrix.determinant() < 0;
    const cr = m.color ? m.color.r : 1, cg = m.color ? m.color.g : 1, cb = m.color ? m.color.b : 1;
    const ei = m.emissive ? (m.emissiveIntensity ?? 1) : 0;
    const er = m.emissive ? m.emissive.r * ei : 0, eg = m.emissive ? m.emissive.g * ei : 0, eb = m.emissive ? m.emissive.b * ei : 0;
    const tw = m.map ? 1 : 0;
    for (let i = 0; i < P.count; i++) {
      const k = (vo + i) * 3;
      _v3.fromBufferAttribute(P, i).applyMatrix4(p.matrix);
      pos[k] = _v3.x; pos[k + 1] = _v3.y; pos[k + 2] = _v3.z;
      if (N) _v3.fromBufferAttribute(N, i).applyMatrix3(_nm3).normalize(); else _v3.set(0, 1, 0);
      nor[k] = _v3.x; nor[k + 1] = _v3.y; nor[k + 2] = _v3.z;
      if (U) { uv[(vo + i) * 2] = U.getX(i); uv[(vo + i) * 2 + 1] = U.getY(i); }
      if (uber) {
        col[k] = cr; col[k + 1] = cg; col[k + 2] = cb;
        rmt[k] = m.roughness; rmt[k + 1] = m.metalness; rmt[k + 2] = tw;
        em[k] = er; em[k + 1] = eg; em[k + 2] = eb;
      }
    }
    const I = g.index;
    const tri = I ? I.count : P.count;
    for (let i = 0; i < tri; i += 3) {
      const a = I ? I.getX(i) : i, b = I ? I.getX(i + 1) : i + 1, c = I ? I.getX(i + 2) : i + 2;
      idx[io++] = vo + a;
      if (flip) { idx[io++] = vo + c; idx[io++] = vo + b; } else { idx[io++] = vo + b; idx[io++] = vo + c; }
    }
    vo += P.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (uber) {
    out.setAttribute('ubCol', new THREE.BufferAttribute(col, 3));
    out.setAttribute('ubRMT', new THREE.BufferAttribute(rmt, 3));
    out.setAttribute('ubEm', new THREE.BufferAttribute(em, 3));
  }
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingBox(); out.computeBoundingSphere();
  return out;
}

// Gemergte Geometrien je Modelltyp/Seite/Saison (geteilt zwischen allen gleichen Einheiten)
const _mergeCache = new Map();
const _inv = new THREE.Matrix4();
// Führt die statischen Teile von root zusammen. keep: Objekte, die eigene Transformationen behalten
// (Turm, Rohr, Beine, Rotoren, …); deren Kinder werden relativ zu ihnen zusammengeführt.
// Rückgabe: Map Original-Mesh → zusammengeführtes Mesh.
function optimize(root, keep = [], cacheKey = null) {
  const keepSet = new Set(keep.filter(Boolean));
  root.updateMatrixWorld(true);
  const nodes = [];
  const groups = new Map();
  const collect = (o, nodeI) => {
    for (const c of o.children) {
      const isKeep = keepSet.has(c);
      if (c.isMesh && !isKeep && !c.userData.noWreck && !c.children.length && !c.isInstancedMesh && !c.isSkinnedMesh &&
          c.visible && !Array.isArray(c.material) && c.geometry.attributes.position && !c.geometry.morphAttributes.position) {
        const node = nodes[nodeI];
        const mat = c.material;
        const uber = uberEligible(mat);
        const fow = uber && isFowMat(mat);
        const part = { mesh: c, geo: c.geometry, mat, matrix: new THREE.Matrix4().multiplyMatrices(node.inv, c.matrixWorld), uber, fow };
        const key = uber ? `${nodeI}|U${fow ? 'f' : ''}` : `${nodeI}|M${mat.uuid}`;
        let gr = groups.get(key);
        if (!gr) groups.set(key, (gr = { nodeI, uber, fow, parts: [] }));
        gr.parts.push(part);
      }
      if (c.children.length) collect(c, isKeep ? addNode(c) : nodeI);
    }
  };
  const addNode = (o) => { nodes.push({ obj: o, inv: new THREE.Matrix4().copy(o.matrixWorld).invert() }); return nodes.length - 1; };
  collect(root, addNode(root));
  // Sammelgruppen nach Textur aufteilen; einfarbige Teile kommen in die erste Texturgruppe des Knotens
  const final = [];
  for (const gr of groups.values()) {
    if (!gr.uber) { final.push({ key: `${gr.parts[0].mesh.material.uuid}`, ...gr, mat: gr.parts[0].mat }); continue; }
    const byMap = new Map();
    for (const p of gr.parts) if (p.mat.map && !byMap.has(p.mat.map)) byMap.set(p.mat.map, []);
    if (!byMap.size) byMap.set(null, []);
    const first = byMap.keys().next().value;
    for (const p of gr.parts) byMap.get(p.mat.map || first).push(p);
    for (const [map, parts] of byMap) final.push({ key: `${map ? map.uuid : '-'}`, nodeI: gr.nodeI, uber: true, fow: gr.fow, parts, mat: uberMat(map, gr.fow) });
  }
  let cache = null;
  if (cacheKey) { cache = _mergeCache.get(cacheKey); if (!cache) _mergeCache.set(cacheKey, (cache = new Map())); }
  const mapping = new Map();
  for (const f of final) {
    if (f.parts.length < 2) continue; // Einzelteil: kein Gewinn
    const gk = `${f.nodeI}|${f.uber ? 'U' : 'M'}${f.fow ? 'f' : ''}|${f.key}|${f.parts.length}`;
    let geo = cache && cache.get(gk);
    if (!geo) {
      geo = mergeParts(f.parts, f.uber);
      if (cache) { geo.userData.shared = true; cache.set(gk, geo); }
    }
    const mesh = new THREE.Mesh(geo, f.mat);
    mesh.castShadow = f.parts.some((p) => p.mesh.castShadow);
    mesh.receiveShadow = f.parts.some((p) => p.mesh.receiveShadow);
    mesh.userData.merged = true;
    nodes[f.nodeI].obj.add(mesh);
    for (const p of f.parts) {
      mapping.set(p.mesh, mesh);
      p.mesh.removeFromParent();
      if (!p.geo.userData.shared) p.geo.dispose();
    }
  }
  return mapping;
}

// Kontaktschatten (weicher Blob unter Boden-Einheiten & Strukturen)
let _blobGeo = null;
function addBlob(root, w, d, cx = 0, cz = 0) {
  if (!_blobGeo) _blobGeo = shared(new THREE.PlaneGeometry(1, 1));
  const s = root.scale.x || 1;
  const m = new THREE.Mesh(_blobGeo, M.blob);
  m.rotation.x = -Math.PI / 2;
  m.position.set(cx / s, 0.05 / s, cz / s);
  m.scale.set(w / s, d / s, 1);
  m.castShadow = false; m.receiveShadow = false;
  m.userData.noWreck = true;
  m.raycast = () => {};
  root.add(m);
  return m;
}
function footprint(root, skip) {
  root.updateMatrixWorld(true);
  const bb = new THREE.Box3(), tmp = new THREE.Box3();
  root.traverse((o) => {
    if (!o.isMesh || o.userData.noWreck) return;
    if (skip) { let p = o.parent; while (p) { if (p === skip) return; p = p.parent; } }
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
    bb.union(tmp);
  });
  return bb;
}

function iff(group, side, y, z = 0, w = 1.2) {
  if (side === 'UA') { box(group, w, 0.05, 0.35, M.iffUA, 0, y, z - 0.2); box(group, w, 0.05, 0.35, M.iffUA2, 0, y, z + 0.2); }
}
function wheel(g, r, w, x, y, z, tire = M.rubber, s = 12) {
  cyl(g, r, r, w, tire, x, y, z, 0, 0, Math.PI / 2, s);
  const sg = Math.sign(x) || 1;
  cyl(g, r * 0.55, r * 0.55, w + 0.06, M.rim, x + sg * 0.01, y, z, 0, 0, Math.PI / 2, 8);
}
function antenna(p, x, y, z, len = 2.2, tilt = 0) { cyl(p, 0.025, 0.04, len, M.darkMetal, x, y + len / 2, z, 0, 0, tilt, 4); }
function headlights(g, y, z, xs = 1.0, size = 0.2) { for (const s of [-1, 1]) box(g, size, size, 0.12, M.headlight, s * xs, y, z); }

// ---------------- Fahrzeuge ----------------
// Laufwerk einer Seite: Kettenband (mit Gliedertextur), Laufrollen, Antriebs-/Leitrad, Stützrollen
function trackSet(g, s, x, L, o = {}) {
  const { w = 0.78, h = 0.95, n = 6, wr = 0.4, y = 0.52 } = o;
  add(g, tiledBoxG(w, h, L * 0.97, 0.7), M.track, s * x, y, 0);
  const xo = s * (x + w / 2 + 0.03);
  const span = L * 0.64;
  for (let i = 0; i < n; i++) cyl(g, wr, wr, 0.18, M.darkMetal, xo, wr + 0.06, -span / 2 + i * span / (n - 1) + 0.1, 0, 0, Math.PI / 2, 10);
  cyl(g, wr * 1.1, wr * 1.1, 0.22, M.rim, xo, wr + 0.2, -L / 2 + 0.5, 0, 0, Math.PI / 2, 10);
  cyl(g, wr * 0.95, wr * 0.95, 0.2, M.rim, xo, wr + 0.18, L / 2 - 0.5, 0, 0, Math.PI / 2, 10);
  for (let i = 0; i < 3; i++) cyl(g, 0.11, 0.11, 0.14, M.darkMetal, xo, y + h / 2 - 0.02, -span / 2 + i * span / 2 + 0.3, 0, 0, Math.PI / 2, 6);
}

function tank(side, variant) {
  const g = new THREE.Group();
  const cam = side === 'UA' ? M.camoUA : M.camoRU;
  const leo = variant === 'leopard';
  const L = leo ? 7.4 : 6.9, W = 3.5;
  const tx = W / 2 - 0.35;
  for (const s of [-1, 1]) {
    trackSet(g, s, tx, L, { n: 6 });
    if (leo) {
      // Seitenschürzen (Segmente)
      for (let i = 0; i < 3; i++) box(g, 0.1, 0.55, L * 0.27, cam, s * (tx + 0.52), 1.12, -L * 0.3 + i * L * 0.3);
      box(g, 0.1, 0.55, 0.6, cam, s * (tx + 0.46), 1.12, L * 0.44, 0, s * 0.35, 0);
    } else {
      box(g, 0.06, 0.45, L * 0.62, cam, s * (tx + 0.5), 1.15, -0.3);
      box(g, 0.9, 0.06, 1.2, cam, s * tx, 1.3, L / 2 - 0.5, 0.15, 0, 0); // Kotflügel
      box(g, 0.06, 0.4, 0.8, M.era, s * (tx + 0.5), 1.15, L / 2 - 0.5);
    }
    box(g, 0.5, 0.3, 0.9, M.darkMetal, s * (tx + 0.1), 1.45, -L * 0.2 + s * 0.5); // Werkzeugkiste
  }
  add(g, hullGeo(W - 0.6, 0.9, L, 0.18, 0.1), cam, 0, 1.3, 0);
  headlights(g, 1.62, L / 2 - 0.12, 1.15, 0.22);
  box(g, 2.0, 0.1, leo ? 2.2 : 1.8, M.darkMetal, 0, 1.78, -L / 2 + (leo ? 1.3 : 1.1)); // Motorraumgitter
  box(g, 0.45, 0.4, 0.5, M.darkMetal, 0.9, 1.9, -L / 2 + 0.6); // Auspuff / Abgasblende
  if (!leo) {
    for (const s of [-1, 1]) cyl(g, 0.27, 0.27, 1.1, M.era, s * 0.8, 1.98, -L / 2 + 0.15, 0, 0, Math.PI / 2, 8); // Fässer
    cyl(g, 0.15, 0.15, 2.6, M.wood2, 0, 1.78, -L / 2 + 0.8, 0, 0, Math.PI / 2, 6); // Baumstamm
    for (let i = 0; i < 4; i++) box(g, 0.5, 0.14, 0.4, M.era, -0.9 + i * 0.6, 1.7, L / 2 - 1.0, 0.5, 0, 0); // Reaktivpanzerung Wannenfront
  } else {
    box(g, 1.2, 0.2, 0.5, M.darkMetal, 0, 1.88, L / 2 - 1.0); // Fahrerluke
    cyl(g, 0.25, 0.25, 0.1, M.darkMetal, 0, 1.78, L / 2 - 1.0, 0, 0, 0, 8);
  }
  const turret = new THREE.Group();
  turret.position.set(0, 1.75, leo ? -0.4 : -0.2);
  g.add(turret);
  if (leo) {
    add(turret, hullGeo(2.8, 0.85, 3.6, 0.45, 0.0), cam, 0, 0.42, 0.2);
    box(turret, 2.2, 0.5, 1.2, cam, 0, 0.35, -2.0);
    for (const s of [-1, 1]) {
      box(turret, 0.5, 0.75, 0.55, cam, s * 0.95, 0.5, 2.0, 0, s * 0.55, 0); // Keilmodule vorne
      box(turret, 0.3, 0.35, 0.8, M.darkMetal, s * 1.45, 0.62, 0.9); // Nebelwerfer
      antenna(turret, s * 0.95, 0.65, -2.3, 2.6, s * 0.08);
    }
    box(turret, 1.1, 0.5, 0.45, cam, 0, 0.45, 2.2); // Blende
    box(turret, 0.5, 0.4, 0.6, M.darkMetal, 0.7, 0.95, -0.3); // PERI
    box(turret, 0.32, 0.18, 0.04, M.optic, 0.7, 0.98, 0.02);
    box(turret, 0.35, 0.3, 0.4, M.darkMetal, -0.6, 0.95, 0.4);
    cyl(turret, 0.38, 0.4, 0.22, cam, 0.7, 0.92, -0.9, 0, 0, 0, 10); // Kommandantenkuppel
    cyl(turret, 0.34, 0.34, 0.05, M.darkMetal, 0.7, 1.05, -0.9, 0.5, 0, 0, 10);
    box(turret, 0.07, 0.07, 0.55, M.gunMetal, 0.95, 1.1, -0.6); // MG
    cyl(turret, 0.36, 0.36, 0.12, M.darkMetal, -0.6, 0.9, -0.9, 0, 0, 0, 10); // Ladeschützenluke
    box(turret, 2.2, 0.45, 0.45, M.darkMetal, 0, 0.35, -2.75); // Heckkorb
  } else {
    const dome = add(turret, sphG(1.55, 16, 8), cam, 0, 0.0, 0); dome.scale.set(1, 0.42, 1.15);
    cyl(turret, 1.5, 1.55, 0.25, cam, 0, -0.1, 0, 0, 0, 0, 16);
    for (let i = 0; i < 7; i++) { const a = -0.9 + i * 0.3; box(turret, 0.5, 0.26, 0.36, M.era, Math.sin(a) * 1.35, 0.32, Math.cos(a) * 1.3, 0, a, 0); }
    box(turret, 0.4, 0.4, 0.5, M.darkMetal, 0.5, 0.75, -0.4);
    cyl(turret, 0.3, 0.32, 0.18, cam, 0.55, 0.52, -0.5, 0, 0, 0, 10); // Luke
    box(turret, 0.06, 0.06, 0.5, M.gunMetal, 0.55, 0.95, -0.2); // DShK
    box(turret, 0.55, 0.42, 0.4, M.darkMetal, -0.85, 0.5, 0.95); // IR-Scheinwerfer
    box(turret, 0.4, 0.4, 0.4, M.darkMetal, -0.4, 0.62, 0.15, 0, 0, 0);
    for (const s of [-1, 1]) box(turret, 0.28, 0.28, 0.5, M.darkMetal, s * 1.3, 0.4, 0.8, 0, s * -0.5, 0); // Nebelwerfer
    antenna(turret, -0.9, 0.3, -1.2, 2.2, 0.1);
    if (variant === 't90') { box(turret, 0.35, 0.3, 0.3, M.redLight, -1.1, 0.45, 0.8); box(turret, 0.35, 0.3, 0.3, M.redLight, 1.1, 0.45, 0.8); }
    // Käfig ("Cope Cage")
    for (let i = 0; i < 6; i++) box(turret, 0.06, 0.05, 3.2, M.darkMetal, -1.25 + i * 0.5, 1.15, -0.2);
    box(turret, 2.8, 0.05, 0.06, M.darkMetal, 0, 1.15, 1.0);
    for (const s of [-1, 1]) { box(turret, 0.05, 0.4, 3.2, M.darkMetal, s * 1.4, 0.95, -0.2); }
    box(turret, 2.8, 0.4, 0.05, M.darkMetal, 0, 0.95, -1.8);
  }
  const barrel = new THREE.Group();
  barrel.position.set(0, leo ? 0.45 : 0.25, leo ? 1.9 : 1.3);
  turret.add(barrel);
  cyl(barrel, 0.11, 0.13, 5.2, M.gunMetal, 0, 0, 2.6, Math.PI / 2, 0, 0, 8);
  if (leo) {
    cyl(barrel, 0.18, 0.18, 2.4, M.darkMetal, 0, 0, 1.3, Math.PI / 2, 0, 0, 8); // Wärmeschutzmantel
    cyl(barrel, 0.15, 0.15, 0.55, M.darkMetal, 0, 0, 3.5, Math.PI / 2, 0, 0, 8); // Rauchabsauger
  } else {
    cyl(barrel, 0.2, 0.2, 0.9, M.darkMetal, 0, 0, 2.6, Math.PI / 2, 0, 0, 8);
    cyl(barrel, 0.16, 0.16, 0.4, M.darkMetal, 0, 0, 4.6, Math.PI / 2, 0, 0, 8);
  }
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, 5.3); barrel.add(muzzle);
  iff(g, side, 1.82, leo ? -2.4 : -2.2);
  return { root: g, turret, barrel, muzzle, height: 3 };
}

function ifv(side, variant) {
  const g = new THREE.Group();
  const cam = side === 'UA' ? M.camoUA : M.camoRU;
  const brad = variant === 'bradley';
  const L = brad ? 6.5 : 6.6, W = 3.2;
  const tracked = variant !== 'btr';
  if (tracked) {
    const tx = W / 2 - 0.3;
    for (const s of [-1, 1]) {
      trackSet(g, s, tx, L, { w: 0.7, h: 0.9, n: 5, wr: 0.34 });
      box(g, 0.08, 0.5, L * 0.6, cam, s * (tx + 0.46), 1.0, 0); // Schürze
      if (brad) for (let i = 0; i < 3; i++) box(g, 0.1, 0.8, 0.7, M.era, s * (W / 2 - 0.02), 1.75, -1.6 + i * 1.3); // Zusatzpanzerung
    }
  } else {
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) wheel(g, 0.55, 0.45, s * (W / 2 - 0.2), 0.55, -2.2 + i * 1.45);
    for (const s of [-1, 1]) box(g, 0.1, 0.12, 5.6, M.darkMetal, s * (W / 2 - 0.2), 1.1, 0.0); // Kotflügelleiste
  }
  if (brad) add(g, hullGeo(W - 0.4, 1.6, L, 0.22, 0.05), cam, 0, 1.6, 0);
  else add(g, hullGeo(W - 0.4, 1.2, L, 0.4, 0.05), cam, 0, 1.4, 0);
  headlights(g, brad ? 1.5 : 1.35, L / 2 - 0.14, 1.1, 0.2);
  if (brad) box(g, 1.6, 0.1, 1.2, M.darkMetal, 0, 2.43, -2.4); // Motorraum
  else { box(g, 1.2, 0.1, 1.4, M.darkMetal, 0, 2.0, -2.3); box(g, 0.5, 0.25, 0.9, cam, 0.9, 2.1, 1.7); }
  if (variant === 'btr') box(g, 0.9, 0.7, 0.05, M.darkMetal, 0, 1.4, -L / 2 - 0.02);
  const turret = new THREE.Group();
  turret.position.set(0, brad ? 2.4 : 2.05, brad ? 0.2 : 0.4);
  g.add(turret);
  if (brad) {
    box(turret, 1.9, 0.75, 2.2, cam, 0, 0.35, 0);
    box(turret, 0.5, 0.5, 1.2, M.darkMetal, 1.15, 0.55, -0.2); // TOW-Werfer
    cyl(turret, 0.12, 0.12, 0.6, M.gunMetal, 1.15, 0.55, 0.45, Math.PI / 2, 0, 0, 6);
    box(turret, 0.4, 0.3, 0.5, M.darkMetal, -0.5, 0.85, -0.4);
    cyl(turret, 0.3, 0.3, 0.1, M.darkMetal, 0.3, 0.76, -0.6, 0, 0, 0, 8);
    for (const s of [-1, 1]) box(turret, 0.2, 0.25, 0.5, M.darkMetal, s * 0.95, 0.4, 1.15);
    antenna(turret, -0.8, 0.7, -1.0, 2.2, 0.05);
  } else {
    const d = add(turret, sphG(0.95, 12, 8), cam, 0, 0, 0); d.scale.set(1, 0.5, 1);
    if (variant === 'bmp') {
      box(turret, 0.9, 0.25, 0.45, M.darkMetal, 0, 0.5, -0.1);
      cyl(turret, 0.05, 0.05, 1.2, M.sand, 0.6, 0.45, 0.2, Math.PI / 2, 0, 0, 6); // Rakete
      box(turret, 0.1, 0.1, 1.2, M.darkMetal, 0.6, 0.35, 0.2);
      cyl(turret, 0.22, 0.22, 0.12, cam, -0.4, 0.4, -0.3, 0, 0, 0, 8);
      antenna(turret, -0.6, 0.3, -0.6, 2.0, 0.1);
    } else { // BTR: KPV-Turm
      box(turret, 0.6, 0.2, 0.5, M.darkMetal, 0.3, 0.35, 0.3);
      antenna(turret, -0.7, 0.3, -0.5, 2.2, 0.1);
    }
  }
  const barrel = new THREE.Group(); barrel.position.set(0, 0.35, 1.0); turret.add(barrel);
  cyl(barrel, 0.06, 0.07, 2.6, M.gunMetal, 0, 0, 1.3, Math.PI / 2, 0, 0, 6);
  cyl(barrel, 0.11, 0.11, 0.9, M.darkMetal, 0, 0, 0.6, Math.PI / 2, 0, 0, 8);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, 2.7); barrel.add(muzzle);
  iff(g, side, brad ? 2.45 : 2.05, -1.8);
  return { root: g, turret, barrel, muzzle, height: 2.8 };
}

function truckBase(cam, L = 7, W = 2.6, wheels = 3) {
  const g = new THREE.Group();
  const pitch = (L - 2) / Math.max(1, wheels - 1);
  for (const s of [-1, 1]) {
    for (let i = 0; i < wheels; i++) wheel(g, 0.55, 0.45, s * (W / 2 - 0.15), 0.55, L / 2 - 1.2 - i * pitch);
    box(g, 0.12, 0.55, 1.4, cam, s * (W / 2 - 0.1), 1.25, L / 2 - 1.2); // Radkasten vorn
    cyl(g, 0.25, 0.25, 1.4, M.darkMetal, s * (W / 2 - 0.35), 0.85, -0.6, 0, 0, Math.PI / 2, 8); // Tank unter dem Rahmen
  }
  box(g, W - 0.3, 0.4, L, M.darkMetal, 0, 1.0, 0);
  // Fahrerhaus mit Haube
  box(g, W, 1.6, 1.9, cam, 0, 2.0, L / 2 - 1.0);
  box(g, W - 0.3, 0.9, 1.0, cam, 0, 1.6, L / 2 + 0.45);
  box(g, W - 0.5, 0.5, 0.05, M.darkMetal, 0, 1.55, L / 2 + 0.96); // Kühlergrill
  box(g, W - 0.2, 0.6, 0.05, M.glass, 0, 2.3, L / 2 - 0.04);
  for (const s of [-1, 1]) {
    box(g, 0.05, 0.55, 1.0, M.glass, s * (W / 2 + 0.01), 2.3, L / 2 - 1.0);
    box(g, 0.1, 0.4, 0.3, M.darkMetal, s * (W / 2 + 0.25), 2.4, L / 2 - 0.2); // Spiegel
  }
  headlights(g, 1.55, L / 2 + 0.98, 0.9, 0.22);
  box(g, W, 0.2, 0.2, M.darkMetal, 0, 1.0, L / 2 + 1.0); // Stoßstange
  cyl(g, 0.07, 0.07, 1.4, M.darkMetal, W / 2 - 0.2, 2.9, L / 2 - 1.9, 0, 0, 0, 6); // Auspuff
  return g;
}

function launcherTruck(side, kind) {
  const cam = side === 'UA' ? M.camoUA : M.camoRU;
  const g = truckBase(cam, kind === 'himars' ? 7 : 8.5, 2.7, kind === 'himars' ? 3 : 4);
  const turret = new THREE.Group(); turret.position.set(0, 1.3, -1.2); g.add(turret);
  const barrel = new THREE.Group(); barrel.position.set(0, 0.3, -1.5); turret.add(barrel);
  let muzzle = new THREE.Object3D();
  box(turret, 2.0, 0.25, 3.4, M.darkMetal, 0, 0.1, -0.8); // Drehkranz / Lafette
  for (const s of [-1, 1]) box(g, 0.3, 0.9, 0.3, M.darkMetal, s * 1.3, 0.8, -3.0); // Stützen
  if (kind === 'himars') {
    box(barrel, 2.3, 1.0, 4.2, cam, 0, 0.5, 2.0);
    box(barrel, 2.4, 0.12, 4.3, M.darkMetal, 0, 1.05, 2.0);
    for (let i = 0; i < 6; i++) {
      cyl(barrel, 0.25, 0.25, 0.05, M.darkMetal, -0.75 + (i % 3) * 0.75, 0.25 + Math.floor(i / 3) * 0.5, 4.12, Math.PI / 2, 0, 0, 8);
      cyl(barrel, 0.15, 0.15, 0.06, M.sand, -0.75 + (i % 3) * 0.75, 0.25 + Math.floor(i / 3) * 0.5, 4.14, Math.PI / 2, 0, 0, 8);
    }
    muzzle.position.set(0, 0.5, 4.2);
  } else if (kind === 'patriot') {
    for (let i = 0; i < 4; i++) {
      const x = -0.55 + (i % 2) * 1.1, y = 0.5 + Math.floor(i / 2) * 1.0;
      box(barrel, 1.0, 0.95, 5.4, cam, x, y, 2.6);
      box(barrel, 0.88, 0.82, 0.06, M.white, x, y, 5.42);
    }
    box(barrel, 2.4, 0.15, 0.4, M.darkMetal, 0, 1.0, 0.4);
    muzzle.position.set(0, 1.0, 5.4);
    barrel.rotation.x = -0.65;
  } else if (kind === 'irist') {
    for (let i = 0; i < 8; i++) {
      const x = -0.7 + (i % 4) * 0.47, y = 0.3 + Math.floor(i / 4) * 0.47;
      cyl(barrel, 0.22, 0.22, 4.0, M.sand, x, y, 2.0, Math.PI / 2, 0, 0, 8);
      cyl(barrel, 0.17, 0.17, 0.05, M.darkMetal, x, y, 4.02, Math.PI / 2, 0, 0, 8);
    }
    box(barrel, 2.2, 0.12, 0.5, M.darkMetal, 0, 0.8, 0.5);
    muzzle.position.set(0, 0.5, 4.0);
    barrel.rotation.x = -1.2;
  } else if (kind === 's400') {
    for (let i = 0; i < 4; i++) {
      cyl(barrel, 0.4, 0.4, 7.0, M.camoRU, -0.9 + i * 0.6, 0.5, 3.5, Math.PI / 2, 0, 0, 10);
      cyl(barrel, 0.34, 0.34, 0.06, M.white, -0.9 + i * 0.6, 0.5, 7.02, Math.PI / 2, 0, 0, 10);
    }
    box(barrel, 2.8, 0.15, 0.5, M.darkMetal, 0, 0.0, 0.8);
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
  box(turret, 0.4, 0.4, 0.4, M.darkMetal, 0.8, 1.4, -0.6); // Lüfter
  for (const s of [-1, 1]) box(turret, 0.12, 2.0, 0.12, M.darkMetal, s * 0.7, 1.9, 0.5, -0.35, 0, 0); // Stützstreben
  box(turret, 3.2, 0.25, 0.4, M.darkMetal, 0, 1.3, 0.2);
  const panel = box(turret, big ? 4 : 3, big ? 3.6 : 2.6, 0.35, M.grey, 0, 2.6, 0.5, -0.35, 0, 0);
  box(turret, big ? 3.8 : 2.8, big ? 3.4 : 2.4, 0.05, M.darkMetal, 0, 2.6, 0.7, -0.35, 0, 0);
  antenna(g, -1.1, 2.8, 1.5, 2.6, 0.05);
  iff(g, side, 2.82, 2.6, 1.4);
  return { root: g, turret, barrel: null, muzzle: panel, height: 5, radar: turret };
}

function gepard(side) {
  const g = new THREE.Group();
  const cam = side === 'UA' ? M.camoUA : M.camoRU;
  for (const s of [-1, 1]) {
    trackSet(g, s, 1.35, 6.8, { w: 0.75, h: 0.95, n: 6, wr: 0.36 });
    box(g, 0.08, 0.5, 4.0, cam, s * 1.85, 1.12, -0.4);
  }
  add(g, hullGeo(2.8, 0.9, 6.8, 0.2, 0.1), cam, 0, 1.3, 0);
  headlights(g, 1.55, 3.28, 1.0, 0.2);
  box(g, 1.8, 0.1, 1.6, M.darkMetal, 0, 1.78, -2.5);
  const turret = new THREE.Group(); turret.position.set(0, 1.8, -0.3); g.add(turret);
  box(turret, 2.2, 1.3, 2.6, cam, 0, 0.65, 0);
  for (const s of [-1, 1]) { box(turret, 0.12, 0.9, 2.0, M.era, s * 1.15, 0.7, 0); box(turret, 0.3, 0.3, 0.6, M.darkMetal, s * 0.5, 1.45, -0.9); }
  cyl(turret, 0.1, 0.1, 1.0, M.darkMetal, 0, 1.7, -1.0, 0, 0, 0, 6); // Radarmast
  const dish = cyl(turret, 0.9, 0.9, 0.1, M.grey, 0, 1.9, -1.0, 1.2, 0, 0, 16);
  cyl(turret, 0.1, 0.1, 0.3, M.darkMetal, 0, 1.9, -0.7, 1.2, 0, 0, 6);
  const dish2 = cyl(turret, 0.6, 0.6, 0.1, M.grey, 0, 1.4, 1.2, 1.4, 0, 0, 16);
  const barrel = new THREE.Group(); barrel.position.set(0, 0.8, 0.2); turret.add(barrel);
  for (const s of [-1, 1]) {
    box(barrel, 0.4, 0.6, 1.4, cam, s * 1.35, 0, 0.3);
    cyl(barrel, 0.07, 0.08, 3.2, M.gunMetal, s * 1.35, 0, 2.2, Math.PI / 2, 0, 0, 6);
    cyl(barrel, 0.12, 0.12, 1.3, M.darkMetal, s * 1.35, 0, 1.4, Math.PI / 2, 0, 0, 8);
    cyl(barrel, 0.11, 0.11, 0.3, M.darkMetal, s * 1.35, 0, 3.7, Math.PI / 2, 0, 0, 8);
  }
  const muzzle = new THREE.Object3D(); muzzle.position.set(1.35, 0, 3.8); barrel.add(muzzle);
  iff(g, side, 1.82, -2.6);
  return { root: g, turret, barrel, muzzle, height: 3.5, radar: dish, radar2: dish2 };
}

function pantsir() {
  const g = truckBase(M.camoRU, 8.5, 2.7, 4);
  const turret = new THREE.Group(); turret.position.set(0, 1.5, -1.6); g.add(turret);
  box(turret, 2.0, 1.4, 2.0, M.camoRU, 0, 0.7, 0);
  box(turret, 0.3, 1.2, 0.3, M.darkMetal, 0, 1.9, 0.2); // Radarmast
  const dish = box(turret, 1.6, 1.4, 0.3, M.grey, 0, 2.2, 0.2, -0.2, 0, 0);
  box(turret, 1.0, 0.5, 0.2, M.darkMetal, 0, 3.1, 0.2); // Zielverfolgung (EO)
  box(turret, 0.35, 0.35, 0.05, M.optic, 0, 3.1, 0.32);
  const barrel = new THREE.Group(); barrel.position.set(0, 1.0, 0); turret.add(barrel);
  for (const s of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const x = s * (1.25 + (i % 2) * 0.3), y = Math.floor(i / 2) * 0.32 - 0.3;
      cyl(barrel, 0.14, 0.14, 3.2, M.camoRU, x, y, 0.8, Math.PI / 2, 0, 0, 6);
      cyl(barrel, 0.1, 0.1, 0.04, M.white, x, y, 2.4, Math.PI / 2, 0, 0, 6);
    }
    cyl(barrel, 0.06, 0.06, 2.2, M.gunMetal, s * 0.7, -0.4, 1.4, Math.PI / 2, 0, 0, 6);
    cyl(barrel, 0.1, 0.1, 0.9, M.darkMetal, s * 0.7, -0.4, 0.9, Math.PI / 2, 0, 0, 8);
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
  for (const s of [-1, 1]) for (const z of [-1.5, 1.5]) wheel(g, 0.45, 0.35, s * 0.95, 0.45, z);
  box(g, 2.0, 0.8, 5.0, cam, 0, 0.95, 0);
  box(g, 1.9, 0.8, 1.9, cam, 0, 1.75, 0.6);
  box(g, 1.8, 0.5, 0.05, M.glass, 0, 1.85, 1.56, 0.0, 0, 0);
  for (const s of [-1, 1]) box(g, 0.05, 0.45, 1.5, M.glass, s * 0.96, 1.85, 0.6);
  box(g, 1.9, 0.5, 1.0, cam, 0, 1.5, 2.1); // Motorhaube
  box(g, 2.1, 0.2, 0.2, M.darkMetal, 0, 0.7, 2.6); // Stoßstange
  headlights(g, 1.45, 2.62, 0.7, 0.22);
  for (const s of [-1, 1]) { box(g, 0.1, 0.12, 0.25, M.darkMetal, s * 1.05, 1.95, 1.4); box(g, 0.1, 0.5, 4.0, cam, s * 1.0, 1.5, -1.5); }
  box(g, 1.9, 0.5, 0.1, cam, 0, 1.5, -2.5);
  box(g, 1.7, 0.05, 1.6, M.darkMetal, 0, 1.38, -1.6);
  antenna(g, -0.9, 1.9, -0.6, 2.2, 0.05);
  const turret = new THREE.Group(); turret.position.set(0, 1.6, -1.4); g.add(turret);
  cyl(turret, 0.08, 0.08, 1.0, M.darkMetal, 0, 0.5, 0);
  box(turret, 0.9, 0.7, 0.06, M.darkMetal, 0, 1.3, 0.35); // Schutzschild
  const barrel = new THREE.Group(); barrel.position.set(0, 1.0, 0); turret.add(barrel);
  box(barrel, 0.2, 0.25, 0.9, M.darkMetal, 0, 0, 0.2);
  cyl(barrel, 0.04, 0.04, 1.4, M.gunMetal, 0, 0, 1.2, Math.PI / 2, 0, 0, 6);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, 1.9); barrel.add(muzzle);
  iff(g, side, 2.17, 0.6, 1.0);
  return { root: g, turret, barrel, muzzle, height: 2.5 };
}

function cargoTruck(side) {
  const cam = side === 'UA' ? M.camoUA : M.camoRU;
  const g = truckBase(cam, 7.5, 2.6, 3);
  box(g, 2.6, 2.2, 4.8, M.tarp, 0, 2.3, -1.2);
  for (let i = 0; i < 4; i++) box(g, 2.7, 2.3, 0.1, M.darkMetal, 0, 2.3, -3.4 + i * 1.6);
  box(g, 2.2, 0.35, 4.6, M.tarp, 0, 3.55, -1.2);
  box(g, 2.4, 0.9, 0.1, M.darkMetal, 0, 1.55, -3.7); // Heckklappe
  for (const s of [-1, 1]) box(g, 0.2, 0.2, 0.1, M.redLight, s * 1.1, 1.3, -3.8);
  box(g, 0.5, 0.5, 0.5, M.darkMetal, 1.3, 1.15, -1.0); // Werkzeugkasten
  const muzzle = new THREE.Object3D(); g.add(muzzle);
  iff(g, side, 3.75, -1.2, 1.4);
  return { root: g, muzzle, height: 3.4 };
}

// ---------------- Infanterie ----------------
function soldier(side, weapon = 'rifle') {
  const g = new THREE.Group();
  const uni = side === 'UA' ? M.uniformUA : M.uniformRU;
  const vest = side === 'UA' ? M.vestUA : M.vest;
  const body = new THREE.Group(); g.add(body);
  // Beine: Hüftgelenk als Drehpunkt (unit.animate rotiert legs[i] um x)
  const mkLeg = (x) => {
    const l = new THREE.Group(); l.position.set(x, 0.92, 0); body.add(l);
    box(l, 0.21, 0.46, 0.25, uni, 0, -0.23, 0);
    box(l, 0.18, 0.42, 0.21, uni, 0, -0.63, 0.01);
    box(l, 0.2, 0.15, 0.36, M.rubber, 0, -0.86, 0.06);
    return l;
  };
  const legL = mkLeg(-0.15), legR = mkLeg(0.15);
  box(body, 0.5, 0.62, 0.3, uni, 0, 1.28, 0); // Torso
  box(body, 0.56, 0.44, 0.36, vest, 0, 1.34, 0.01); // Plattenträger
  box(body, 0.38, 0.5, 0.22, M.pack, 0, 1.36, -0.28); // Rucksack
  add(body, sphG(0.14, 10, 8), M.skin, 0, 1.72, 0.01); // Kopf
  box(body, 0.25, 0.06, 0.05, M.optic, 0, 1.74, 0.13); // Schutzbrille
  const helm = add(body, sphG(0.2, 10, 6), side === 'UA' ? M.uniformUA : M.helmet, 0, 1.8, 0); helm.scale.set(1, 0.72, 1.1); // Helm mit Bezug
  // Arme: Schulter -> Ellbogen -> Hand, in Anschlag
  const mkArm = (x, shoulderRx, elbowRx, ry) => {
    const a = new THREE.Group(); a.position.set(x, 1.5, 0.02); a.rotation.set(shoulderRx, ry, 0); body.add(a);
    box(a, 0.14, 0.34, 0.14, uni, 0, -0.17, 0);
    const e = new THREE.Group(); e.position.y = -0.34; e.rotation.x = elbowRx; a.add(e);
    box(e, 0.12, 0.3, 0.12, uni, 0, -0.15, 0);
    box(e, 0.11, 0.1, 0.12, M.rubber, 0, -0.33, 0);
    return a;
  };
  const armR = mkArm(0.33, -0.9, -0.9, 0);
  mkArm(-0.33, -1.0, -0.5, 0.55);
  if (side === 'UA') box(body, 0.16, 0.08, 0.16, M.iffUA, 0.38, 1.6, 0.02); // Armbinde
  const gun = new THREE.Group(); gun.position.set(0.2, 1.38, 0.3); body.add(gun);
  if (weapon === 'javelin') {
    gun.position.set(0.18, 1.58, 0.0);
    cyl(gun, 0.1, 0.1, 1.2, M.sand, 0, 0, 0.15, Math.PI / 2, 0, 0, 8);
    box(gun, 0.3, 0.28, 0.4, M.darkMetal, -0.05, 0.2, 0.0); // Kommandostartgerät
    box(gun, 0.12, 0.1, 0.12, M.optic, -0.05, 0.38, 0.1);
    cyl(gun, 0.12, 0.12, 0.08, M.darkMetal, 0, 0, 0.78, Math.PI / 2, 0, 0, 8);
  } else if (weapon === 'rpg') {
    gun.position.set(0.18, 1.58, 0.0);
    cyl(gun, 0.07, 0.07, 1.0, M.camoRU, 0, 0, 0.1, Math.PI / 2, 0, 0, 8);
    cyl(gun, 0.13, 0.07, 0.3, M.darkMetal, 0, 0, -0.5, Math.PI / 2, 0, 0, 8); // Auspuffkonus
    add(gun, sphG(0.13, 8, 6), M.sand, 0, 0, 0.72).scale.set(1, 1, 1.5); // Gefechtskopf
    box(gun, 0.05, 0.15, 0.08, M.darkMetal, 0, -0.14, 0.1); // Griff
  } else if (weapon === 'sniper') {
    box(gun, 0.07, 0.1, 0.9, M.darkMetal, 0, 0, 0.1); // Schaft/Gehäuse
    cyl(gun, 0.025, 0.03, 0.9, M.gunMetal, 0, 0.0, 0.9, Math.PI / 2, 0, 0, 6); // langer Lauf
    cyl(gun, 0.05, 0.05, 0.4, M.darkMetal, 0, 0.1, 0.15, Math.PI / 2, 0, 0, 6); // Zielfernrohr
    box(gun, 0.03, 0.2, 0.03, M.darkMetal, 0.04, -0.12, 0.7, 0.3, 0, 0); // Zweibein
  } else if (weapon === 'tablet') {
    box(gun, 0.4, 0.04, 0.3, M.darkMetal, 0, -0.05, 0.05, 0.4, 0, 0);
    box(gun, 0.34, 0.01, 0.24, M.optic, 0, -0.03, 0.05, 0.4, 0, 0);
    cyl(gun, 0.015, 0.015, 0.5, M.darkMetal, 0.2, 0.2, -0.1, 0, 0, 0, 4);
    box(gun, 0.12, 0.08, 0.2, M.rubber, -0.3, -0.1, 0.0); // Fernsteuerung
  } else { // Sturmgewehr
    box(gun, 0.07, 0.12, 0.6, M.gunMetal, 0, 0, 0.2); // Gehäuse/Handschutz
    cyl(gun, 0.018, 0.02, 0.4, M.gunMetal, 0, 0.02, 0.7, Math.PI / 2, 0, 0, 5); // Lauf
    box(gun, 0.06, 0.1, 0.3, M.rubber, 0, -0.03, -0.25); // Schaft
    box(gun, 0.05, 0.2, 0.08, M.rubber, 0, -0.14, 0.12, 0.2, 0, 0); // Magazin
    box(gun, 0.05, 0.05, 0.14, M.optic, 0, 0.09, 0.2); // Visier
  }
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, 0.8); gun.add(muzzle);
  g.scale.setScalar(1.45);
  return { root: g, turret: null, barrel: null, muzzle, height: 2.9, body, legs: [legL, legR], arm: armR };
}

// ---------------- Luftfahrzeuge ----------------
function quad(side, size = 1, recon = false) {
  const g = new THREE.Group();
  const body = box(g, 0.6 * size, 0.25 * size, 0.9 * size, recon ? M.grey : M.darkMetal, 0, 0, 0);
  box(g, 0.4 * size, 0.1 * size, 0.5 * size, M.gunMetal, 0, 0.17 * size, -0.05 * size); // Akku/Abdeckung
  const rotors = [];
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    box(g, 0.1 * size, 0.06 * size, 0.9 * size, M.darkMetal, x * 0.35 * size, 0.05 * size, z * 0.35 * size, 0, Math.atan2(x, z), 0);
    cyl(g, 0.06 * size, 0.06 * size, 0.1 * size, M.gunMetal, x * 0.65 * size, 0.08 * size, z * 0.65 * size, 0, 0, 0, 8); // Motor
    const r = add(g, cylG(0.38 * size, 0.38 * size, 0.02, 16), M.rotor, x * 0.65 * size, 0.15 * size, z * 0.65 * size, 0, 0, 0, false);
    r.userData.noWreck = true;
    rotors.push(r);
    box(g, 0.03 * size, 0.2 * size, 0.03 * size, M.darkMetal, x * 0.2 * size, -0.15 * size, z * 0.3 * size); // Landebeine
  }
  if (!recon) cyl(g, 0.12 * size, 0.12 * size, 0.6 * size, M.sand, 0, -0.18 * size, 0.2 * size, Math.PI / 2, 0, 0, 8); // Gefechtskopf
  else { add(g, sphG(0.15 * size, 8, 6), M.glass, 0, -0.2 * size, 0.25 * size); box(g, 0.08 * size, 0.08 * size, 0.2 * size, M.darkMetal, 0, -0.2 * size, 0.38 * size); }
  add(g, sphG(0.05, 6, 4), side === 'UA' ? M.greenLight : M.redLight, 0, 0.15 * size, -0.45 * size, 0, 0, 0, false);
  const muzzle = new THREE.Object3D(); g.add(muzzle);
  return { root: g, muzzle, height: 0.5, rotors };
}

function fixedWing(side, kind) {
  const g = new THREE.Group();
  const muzzle = new THREE.Object3D(); g.add(muzzle);
  let rotors = [];
  const rot = (m) => { m.userData.noWreck = true; rotors.push(m); };
  if (kind === 'shahed') {
    // Deltaflügel
    const shape = new THREE.Shape();
    shape.moveTo(0, 1.8); shape.lineTo(1.3, -1.0); shape.lineTo(-1.3, -1.0); shape.closePath();
    const wing = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false }), M.grey);
    wing.rotation.x = -Math.PI / 2; wing.castShadow = true; g.add(wing);
    cyl(g, 0.22, 0.18, 3.0, M.grey, 0, 0.05, 0.2, Math.PI / 2, 0, 0, 8);
    add(g, sphG(0.22, 8, 6), M.grey, 0, 0.05, 1.7).scale.set(1, 1, 1.4); // Gefechtskopfspitze
    box(g, 0.05, 0.6, 0.5, M.grey, 1.2, 0.3, -0.8); box(g, 0.05, 0.6, 0.5, M.grey, -1.2, 0.3, -0.8);
    box(g, 0.3, 0.12, 0.5, M.darkMetal, 0, 0.28, -1.0); // Motorgondel
    box(g, 0.2, 0.05, 0.3, M.darkMetal, 0, 0.15, 0.9);
    rot(add(g, cylG(0.45, 0.45, 0.02, 12), M.rotor, 0, 0.05, -1.45, Math.PI / 2, 0, 0, false));
    g.scale.setScalar(1.4);
  } else if (kind === 'lancet') {
    cyl(g, 0.14, 0.12, 1.6, M.grey, 0, 0, 0, Math.PI / 2, 0, 0, 8);
    add(g, sphG(0.14, 8, 6), M.darkMetal, 0, 0, 0.8).scale.set(1, 1, 1.0);
    for (const z of [0.4, -0.5]) { box(g, 1.6, 0.03, 0.25, M.grey, 0, 0, z, 0, 0, Math.PI / 4); box(g, 1.6, 0.03, 0.25, M.grey, 0, 0, z, 0, 0, -Math.PI / 4); }
    cyl(g, 0.08, 0.1, 0.2, M.darkMetal, 0, 0, -0.85, Math.PI / 2, 0, 0, 6);
    g.scale.setScalar(1.6);
  } else if (kind === 'orlan' || kind === 'recon_wing') {
    const col = side === 'UA' ? M.white : M.grey;
    cyl(g, 0.18, 0.12, 1.8, col, 0, 0, 0, Math.PI / 2, 0, 0, 8);
    add(g, sphG(0.18, 8, 6), col, 0, 0, 0.9).scale.set(1, 1, 0.8);
    box(g, 3.2, 0.05, 0.35, col, 0, 0.12, 0.2);
    box(g, 1.0, 0.04, 0.25, col, 0, 0.12, -0.8);
    box(g, 0.04, 0.35, 0.22, col, 0, 0.25, -0.85);
    cyl(g, 0.05, 0.05, 0.12, M.glass, 0, -0.14, 0.4, 0, 0, 0, 6); // Kamerakugel
    rot(add(g, cylG(0.3, 0.3, 0.02, 12), M.rotor, 0, 0, -0.95, Math.PI / 2, 0, 0, false));
    g.scale.setScalar(1.5);
  } else if (kind === 'cruise') { // Storm Shadow / Kalibr
    cyl(g, 0.3, 0.3, 4.6, M.grey, 0, 0, 0, Math.PI / 2, 0, 0, 10);
    add(g, sphG(0.3, 10, 6), M.grey, 0, 0, 2.3).scale.set(1, 1, 2);
    box(g, 2.8, 0.05, 0.5, M.grey, 0, 0, 0.2);
    box(g, 1.0, 0.05, 0.4, M.grey, 0, 0, -2.0);
    box(g, 0.05, 0.5, 0.4, M.grey, 0, 0.3, -2.0);
    box(g, 0.4, 0.2, 0.9, M.darkMetal, 0, -0.32, -0.4); // Lufteinlauf
    add(g, sphG(0.22, 8, 6), M.engineGlow, 0, 0, -2.4, 0, 0, 0, false);
  } else if (kind === 'hypersonic') {
    cyl(g, 0.12, 0.5, 6.0, M.white, 0, 0, 0, Math.PI / 2, 0, 0, 12);
    add(g, sphG(0.12, 8, 6), M.darkMetal, 0, 0, 3.0);
    for (let i = 0; i < 4; i++) box(g, 0.04, 0.9, 0.9, M.white, 0, 0, -2.6, 0, 0, i * Math.PI / 2);
    cyl(g, 0.52, 0.52, 0.15, M.darkMetal, 0, 0, -2.95, Math.PI / 2, 0, 0, 12);
    add(g, sphG(0.5, 10, 6), M.engineGlow, 0, 0, -3.1, 0, 0, 0, false);
  } else if (kind === 'interceptor') {
    cyl(g, 0.12, 0.15, 2.8, M.white, 0, 0, 0, Math.PI / 2, 0, 0, 8);
    add(g, sphG(0.12, 8, 6), M.darkMetal, 0, 0, 1.4).scale.set(1, 1, 1.6);
    for (let i = 0; i < 4; i++) box(g, 0.03, 0.5, 0.4, M.white, 0, 0, -1.1, 0, 0, i * Math.PI / 2);
    add(g, sphG(0.2, 8, 6), M.engineGlow, 0, 0, -1.4, 0, 0, 0, false);
  } else if (kind === 'atgm' || kind === 'rocket') {
    cyl(g, 0.12, 0.12, 1.4, kind === 'rocket' ? M.grey : M.sand, 0, 0, 0, Math.PI / 2, 0, 0, 6);
    add(g, sphG(0.12, 6, 5), M.darkMetal, 0, 0, 0.7).scale.set(1, 1, 1.3);
    for (let i = 0; i < 4; i++) box(g, 0.03, 0.4, 0.25, M.darkMetal, 0, 0, -0.55, 0, 0, i * Math.PI / 2);
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
  add(g, sphG(0.8, 10, 8), M.glass, 0, 0.55, 2.3).scale.set(0.9, 0.65, 1.2); // Kanzel
  box(g, 4.6, 0.12, 0.7, cam, 0, -0.3, 0.3); // Stummelflügel
  for (const s of [-1, 1]) {
    cyl(g, 0.2, 0.2, 1.8, M.grey, s * 1.9, -0.6, 0.3, Math.PI / 2, 0, 0, 8);
    cyl(g, 0.2, 0.05, 0.3, M.darkMetal, s * 1.9, -0.6, 1.3, Math.PI / 2, 0, 0, 8);
    cyl(g, 0.08, 0.08, 0.6, M.darkMetal, s * 0.6, -1.2, 1.6, 0, 0, 0, 6); // Fahrwerk vorn/hinten
    cyl(g, 0.08, 0.08, 0.6, M.darkMetal, s * 0.9, -1.2, -0.8, 0, 0, 0, 6);
    cyl(g, 0.2, 0.2, 0.15, M.rubber, s * 0.9, -1.55, -0.8, 0, 0, Math.PI / 2, 8);
  }
  add(g, sphG(0.22, 8, 6), M.darkMetal, 0, -0.55, 3.2); // Sensorkugel
  cyl(g, 0.12, 0.12, 2.6, M.darkMetal, 0, 1.4, 0.4, 0, 0, 0, 6);
  cyl(g, 0.5, 0.5, 0.5, M.darkMetal, 0, 1.0, 0.4, 0, 0, 0, 8); // Rotorkopf
  const r1 = add(g, cylG(7, 7, 0.04, 24), M.rotor, 0, 1.4, 0.4, 0, 0, 0, false);
  const r2 = add(g, cylG(7, 7, 0.04, 24), M.rotor, 0, 2.5, 0.4, 0, 0, 0, false);
  r1.userData.noWreck = r2.userData.noWreck = true;
  const turret = new THREE.Group(); turret.position.set(0, -0.6, 2.0); g.add(turret);
  const barrel = new THREE.Group(); turret.add(barrel);
  box(barrel, 0.3, 0.3, 0.6, M.darkMetal, 0, 0, 0.1);
  cyl(barrel, 0.06, 0.06, 1.4, M.gunMetal, 0, 0, 0.7, Math.PI / 2, 0, 0, 6);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, 1.5); barrel.add(muzzle);
  return { root: g, turret, barrel, muzzle, height: 2, rotors: [r1, r2] };
}

// ---------------- Wasser ----------------
function seaDrone() {
  const g = new THREE.Group();
  const hull = add(g, hullGeo(1.3, 0.6, 5.5, 0.5, 0.0), M.seadrone, 0, 0.1, 0);
  box(g, 0.6, 0.3, 0.8, M.darkMetal, 0, 0.5, -1.4);
  box(g, 1.1, 0.05, 3.0, M.darkMetal, 0, 0.42, 0.3); // Deck
  cyl(g, 0.03, 0.03, 0.8, M.darkMetal, 0, 0.9, -1.6, 0, 0, 0, 4);
  add(g, sphG(0.06, 6, 4), M.greenLight, 0, 1.3, -1.6, 0, 0, 0, false);
  add(g, sphG(0.15, 8, 6), M.optic, 0, 0.65, -0.9); // Kamerakopf
  box(g, 0.5, 0.35, 0.4, M.darkMetal, 0, 0.2, -2.8); // Außenborder
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, 2.7); g.add(muzzle);
  g.scale.setScalar(1.5);
  return { root: g, muzzle, height: 1.2, hull };
}
function patrolBoat() {
  const g = new THREE.Group();
  add(g, hullGeo(4.2, 2.0, 16, 0.35, 0.0), M.navy, 0, 0.6, 0);
  box(g, 4.25, 0.15, 15.0, M.darkMetal, 0, 1.0, -0.2); // Scheuerleiste
  box(g, 3.0, 2.2, 5, M.navy, 0, 2.6, -1.5);
  box(g, 3.05, 0.5, 0.1, M.glass, 0, 3.2, 1.0);
  for (const s of [-1, 1]) box(g, 0.05, 0.5, 3.5, M.glass, s * 1.53, 3.2, -1.0);
  box(g, 3.2, 0.15, 5.2, M.darkMetal, 0, 3.75, -1.5); // Brückendach
  cyl(g, 0.1, 0.1, 3, M.darkMetal, 0, 5, -2.0, 0, 0, 0, 6);
  box(g, 1.6, 0.12, 0.3, M.grey, 0, 6.3, -2.0); // Radarantenne
  box(g, 1.4, 0.4, 1.0, M.navy, 0, 4.1, -3.4); // Aufbau hinten
  for (const s of [-1, 1]) { box(g, 0.05, 0.7, 5.5, M.darkMetal, s * 1.95, 1.65, -1.5); box(g, 0.05, 0.7, 4.5, M.darkMetal, s * 1.95, 1.65, 4.5); } // Reling
  box(g, 1.2, 0.3, 2.0, M.sand, 1.0, 1.25, -6.0); // Rettungsinsel
  const turret = new THREE.Group(); turret.position.set(0, 1.9, 4.5); g.add(turret);
  box(turret, 1.2, 0.8, 1.2, M.navy, 0, 0.4, 0);
  const barrel = new THREE.Group(); barrel.position.set(0, 0.5, 0.5); turret.add(barrel);
  cyl(barrel, 0.06, 0.06, 1.8, M.gunMetal, 0, 0, 0.9, Math.PI / 2, 0, 0, 6);
  cyl(barrel, 0.12, 0.12, 0.6, M.darkMetal, 0, 0, 0.4, Math.PI / 2, 0, 0, 8);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, 1.9); barrel.add(muzzle);
  return { root: g, turret, barrel, muzzle, height: 4 };
}

// ---------------- Gebäude & Ziele ----------------
function gableG(w, rh) {
  const k = `g${w},${rh}`;
  if (geoCache[k]) return geoCache[k];
  const sh = new THREE.Shape();
  sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(0, rh); sh.closePath();
  const g = new THREE.ShapeGeometry(sh);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.25 * 1, uv.getY(i) * 0.25);
  return (geoCache[k] = shared(g));
}

export function house(h) {
  initMats();
  const g = new THREE.Group();
  const big = h.floors > 2;
  const wall = big ? M.panels[h.style % M.panels.length] : M.walls[h.style % M.walls.length];
  const roofMat = M.roofs[h.style % M.roofs.length];
  const fh = 3.0, H = h.floors * fh, w = h.w, d = h.d;
  const body = add(g, tiledBoxG(w, H, d, big ? 6 : 4), wall, 0, H / 2, 0);
  add(g, boxG(w + 0.2, 0.5, d + 0.2), M.concreteDark, 0, 0.25, 0); // Sockel

  const frame = new Merger(), glass = new Merger(), lit = new Merger(), shut = new Merger(), trim = new Merger(), doorM = new Merger();
  const faces = [
    { ry: 0, cx: 0, cz: d / 2, len: w }, { ry: Math.PI, cx: 0, cz: -d / 2, len: w },
    { ry: Math.PI / 2, cx: w / 2, cz: 0, len: d }, { ry: -Math.PI / 2, cx: -w / 2, cz: 0, len: d },
  ];
  const put = (m, geo, f, u, y, out) => {
    const c = Math.cos(f.ry), s = Math.sin(f.ry);
    m.add(geo, mat4(f.cx + c * u + s * out, y, f.cz - s * u + c * out, f.ry));
  };
  const ww = big ? 1.3 : 0.9, wh = big ? 1.3 : 1.2;
  const doorsAt = big ? (w > 14 ? [-w / 4, w / 4] : [0]) : [0];
  const shutterOn = !big && h.style % 2 === 1;
  faces.forEach((f, fi) => {
    const nx = Math.max(1, Math.floor(f.len / (big ? 2.6 : 2.4)));
    for (let fl = 0; fl < h.floors; fl++) {
      const y = fl * fh + 1.7;
      for (let i = 0; i < nx; i++) {
        const u = -f.len / 2 + (i + 0.5) * (f.len / nx);
        if (fi === 0 && fl === 0 && doorsAt.some((dx) => Math.abs(u - dx) < 1.3)) continue;
        put(frame, boxG(ww + 0.2, wh + 0.2, 0.08), f, u, y, 0.02);
        put(frame, boxG(ww + 0.35, 0.08, 0.22), f, u, y - wh / 2 - 0.12, 0.1); // Fensterbank
        put(h.lit && Math.random() < 0.35 ? lit : glass, boxG(ww, wh, 0.1), f, u, y, 0.05);
        put(frame, boxG(0.05, wh, 0.12), f, u, y, 0.08); // Fensterkreuz
        if (shutterOn) { put(shut, boxG(ww * 0.5, wh + 0.2, 0.06), f, u - ww * 0.78, y, 0.06); put(shut, boxG(ww * 0.5, wh + 0.2, 0.06), f, u + ww * 0.78, y, 0.06); }
        if (big && fi === 0 && fl >= 1 && i % 2 === 0) { // Balkone
          const by = fl * fh;
          put(trim, boxG(1.8, 0.14, 1.0), f, u, by + 0.75, 0.5);
          put(trim, boxG(1.8, 0.5, 0.06), f, u, by + 1.07, 1.0);
          put(trim, boxG(0.06, 0.5, 1.0), f, u - 0.87, by + 1.07, 0.5);
          put(trim, boxG(0.06, 0.5, 1.0), f, u + 0.87, by + 1.07, 0.5);
        }
      }
    }
  });
  // Türen
  const f0 = faces[0];
  for (const dx of doorsAt) {
    const dw = big ? 1.5 : 1.0;
    put(frame, boxG(dw + 0.3, 2.35, 0.08), f0, dx, 1.2, 0.02);
    put(doorM, boxG(dw, 2.2, 0.1), f0, dx, 1.15, 0.05);
    put(trim, boxG(dw + 0.8, 0.2, 0.8), f0, dx, 0.1, 0.4); // Stufe
    put(trim, boxG(dw + 0.8, 0.12, 0.9), f0, dx, 2.6, 0.45); // Vordach
  }
  flushMerged(g, frame, M.frame);
  flushMerged(g, glass, M.window, false);
  flushMerged(g, lit, M.windowLit, false);
  flushMerged(g, shut, M.shutters[h.style % 2]);
  flushMerged(g, doorM, M.door);

  if (!big) {
    // Satteldach mit Ziegel-/Blechtextur, Giebel, First, Kamin
    const rh = Math.min(3, w * 0.35);
    const half = w / 2 + 0.4, ls = Math.hypot(half, rh), ang = Math.atan2(rh, half);
    for (const s of [-1, 1]) add(g, tiledBoxG(ls, 0.16, d + 0.8, 2), roofMat, s * half / 2, H + rh / 2 + 0.04, 0, 0, 0, -s * ang);
    box(g, 0.3, 0.2, d + 0.9, M.concreteDark, 0, H + rh + 0.06, 0);
    add(g, gableG(w, rh), wall, 0, H, d / 2 + 0.01);
    add(g, gableG(w, rh), wall, 0, H, -d / 2 - 0.01, 0, Math.PI, 0);
    const hc = rh * 0.7 + 1.0;
    box(g, 0.6, hc, 0.6, M.brick, w * 0.18, H + rh * 0.3 + hc / 2, -d * 0.2);
    box(g, 0.8, 0.12, 0.8, M.concreteDark, w * 0.18, H + rh + 1.0, -d * 0.2);
    if (h.floors === 2 && w > 9) { // Gaube
      add(g, tiledBoxG(1.6, 1.0, 1.4, 4), wall, -w * 0.22, H + rh * 0.35, d * 0.3);
      box(g, 0.7, 0.6, 0.06, M.window, -w * 0.22, H + rh * 0.35, d * 0.3 + 0.72);
    }
  } else {
    // Flachdach mit Attika, Treppenhaus, Aufbauten
    const tr = new Merger();
    box(g, w + 0.3, 0.4, d + 0.3, M.concreteDark, 0, H + 0.2, 0);
    tr.add(boxG(w + 0.3, 0.5, 0.15), mat4(0, H + 0.65, d / 2 + 0.07)); tr.add(boxG(w + 0.3, 0.5, 0.15), mat4(0, H + 0.65, -d / 2 - 0.07));
    tr.add(boxG(0.15, 0.5, d + 0.3), mat4(w / 2 + 0.07, H + 0.65, 0)); tr.add(boxG(0.15, 0.5, d + 0.3), mat4(-w / 2 - 0.07, H + 0.65, 0));
    for (const dx of doorsAt) tr.add(boxG(1.8, 1.6, 1.8), mat4(dx, H + 1.2, 0)); // Treppenhaus-Aufbauten
    for (let i = 0; i < 3; i++) tr.add(boxG(0.8, 0.6, 0.8), mat4(-w * 0.3 + i * 1.3, H + 0.7, d * 0.25));
    tr.add(boxG(0.06, 2.4, 0.06), mat4(-w * 0.35, H + 1.6, -d * 0.2));
    flushMerged(g, tr, M.concreteDark);
  }
  flushMerged(g, trim, M.concrete);
  const merged = optimize(g); // Einzelhaus (Zufallsfenster) → nicht gecacht
  addBlob(g, w + 5, d + 5);
  return { root: g, height: H + 2, body: merged.get(body) || body };
}

export function rubble(w, d) {
  initMats();
  const g = new THREE.Group();
  const rnd = Math.random;
  const base = box(g, w * 0.9, 0.5, d * 0.9, M.rubble, 0, 0.25, 0);
  base.scale.y = 1;
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6 + rnd() * 1.2, 0), i % 3 === 0 ? M.concreteDark : M.rubble);
    m.position.set((rnd() - 0.5) * w * 0.8, 0.4 + rnd() * 0.5, (rnd() - 0.5) * d * 0.8);
    m.scale.y = 0.5; m.rotation.set(rnd(), rnd(), rnd());
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
  }
  // stehengebliebene Wandreste
  for (let i = 0; i < 3; i++) {
    const wl = 2 + rnd() * 3, hh = 0.8 + rnd() * 2.0;
    const side = i % 2 ? 1 : -1;
    add(g, boxG(wl, hh, 0.4), M.walls[i % M.walls.length], side * w * 0.3 + (rnd() - 0.5), hh / 2 + 0.3, (rnd() - 0.5) * d * 0.7, (rnd() - 0.5) * 0.25, rnd() * 3, (rnd() - 0.5) * 0.25);
  }
  // verkohlte Balken und Deckenplatten
  for (let i = 0; i < 5; i++) add(g, boxG(0.25, 0.25, 2.5 + rnd() * 2.5), i % 2 ? M.charred : M.wood, (rnd() - 0.5) * w * 0.7, 0.9 + rnd() * 0.6, (rnd() - 0.5) * d * 0.7, (rnd() - 0.5) * 0.6, rnd() * 3, (rnd() - 0.5) * 0.6);
  add(g, boxG(w * 0.45, 0.25, d * 0.4), M.concrete, (rnd() - 0.5) * 2, 0.9, (rnd() - 0.5) * 2, 0.2, rnd(), 0.15);
  optimize(g);
  return g;
}

function sandbags(g, x, z, len, ry = 0, rows = 2) {
  const m = new Merger();
  const n = Math.max(1, Math.floor(len / 0.9));
  for (let r = 0; r < rows; r++) for (let i = 0; i < n; i++) {
    const u = -len / 2 + (i + 0.5 + (r % 2) * 0.5) * (len / n);
    m.add(boxG(0.85, 0.35, 0.5), mat4(Math.cos(ry) * u, 0.2 + r * 0.34, -Math.sin(ry) * u, ry));
  }
  const mesh = flushMerged(g, m, M.sandbag);
  if (mesh) mesh.position.set(x, 0, z);
}

function structure(kind, side) {
  const g = new THREE.Group();
  let height = 4, radar = null;
  const cam = side === 'UA' ? M.camoUA : M.camoRU;
  if (kind === 'hq') {
    box(g, 8, 2.6, 5, M.tent, 0, 1.3, 0);
    box(g, 8.6, 0.2, 5.6, M.tent, 0, 2.7, 0, 0, 0, 0.04);
    for (const s of [-1, 1]) box(g, 8.6, 0.2, 3.0, M.tarp, 0, 3.15, s * 1.4, -s * 0.35, 0, 0); // Zeltdach
    box(g, 1.4, 2.0, 0.1, M.darkMetal, 1.0, 1.0, 2.55); // Eingang
    for (let i = 0; i < 6; i++) box(g, 1.4, 0.7, 0.7, M.crate, -4 + i * 1.6, 0.35, 3.2);
    sandbags(g, 0, 4.2, 9, 0, 2);
    cyl(g, 0.05, 0.05, 9, M.darkMetal, 3.5, 4.5, -2, 0, 0, 0, 4);
    radar = cyl(g, 0.8, 0.8, 0.08, M.grey, -2.6, 3.4, -1.8, 1.0, 0, 0, 16);
    cyl(g, 0.08, 0.08, 1.0, M.darkMetal, -2.6, 3.0, -1.8, 0, 0, 0, 6);
    box(g, 1.0, 1.0, 1.4, M.camoRU, 5.0, 0.5, -1.0); // Generator
    if (side === 'UA') { box(g, 1.2, 0.4, 0.05, M.iffUA2, 3.5, 8.3, -1.75); box(g, 1.2, 0.4, 0.05, M.iffUA, 3.5, 7.9, -1.75); }
    height = 5;
  } else if (kind === 'radar' || kind === 's400radar') {
    box(g, 4, 2.4, 9, cam, 0, 1.6, 0);
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) wheel(g, 0.55, 0.45, s * 1.8, 0.55, -3 + i * 2);
    box(g, 3.6, 1.2, 1.6, cam, 0, 2.1, 4.3); // Kabine
    box(g, 3.4, 0.5, 0.05, M.glass, 0, 2.5, 5.15);
    radar = new THREE.Group(); radar.position.set(0, 3, -1); g.add(radar);
    box(radar, 1, 2.5, 1, M.darkMetal, 0, 1.2, 0);
    box(radar, 6, 4.5, 0.4, M.grey, 0, 4.2, 0.4, -0.3, 0, 0);
    box(radar, 5.7, 4.2, 0.05, M.darkMetal, 0, 4.2, 0.62, -0.3, 0, 0);
    box(radar, 0.4, 2.4, 0.3, M.darkMetal, 0, 2.6, 0.1, -0.3, 0, 0);
    for (const s of [-1, 1]) box(g, 0.4, 0.5, 0.4, M.darkMetal, s * 1.6, 0.5, -4.6); // Stützen
    height = 9;
  } else if (kind === 'depot') {
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
      box(g, 2.2, 1.2, 1.3, M.crate, -3 + i * 3, 0.6, -1.2 + j * 2.4);
      box(g, 2.2, 1.2, 1.3, M.crate, -3 + i * 3, 1.8, -1.2 + j * 2.4);
      box(g, 2.3, 0.1, 1.4, M.wood2, -3 + i * 3, 1.2, -1.2 + j * 2.4);
    }
    const tarp = box(g, 9.5, 0.15, 6, M.tent, 0, 3.2, 0, 0.05, 0, 0);
    for (const x of [-4.5, 4.5]) for (const z of [-2.8, 2.8]) cyl(g, 0.08, 0.08, 3.2, M.wood, x, 1.6, z, 0, 0, 0, 4);
    for (let i = 0; i < 4; i++) cyl(g, 0.35, 0.35, 0.9, i % 2 ? M.era : M.sand, 5.5, 0.45, -2 + i * 1.0, 0, 0, 0, 10); // Fässer
    sandbags(g, 0, 3.8, 9, 0, 2);
    height = 4;
  } else if (kind === 'powerplant') {
    const tower = add(g, cylG(5, 7.5, 18, 24), M.concrete, -8, 9, 0);
    add(g, cylG(5, 6.5, 14, 24), M.concrete, 8, 7, -4);
    cyl(g, 5.1, 5.1, 0.4, M.concreteDark, -8, 18.2, 0, 0, 0, 0, 24);
    box(g, 12, 9, 10, M.concreteDark, 2, 4.5, 8);
    for (let i = 0; i < 4; i++) box(g, 1.6, 2.0, 0.1, M.window, -2 + i * 3.4, 6, 13.05); // Fensterband
    box(g, 12.4, 0.5, 10.4, M.concrete, 2, 9.2, 8);
    cyl(g, 0.8, 1.0, 22, M.concrete, 8, 11, 10, 0, 0, 0, 10);
    cyl(g, 0.9, 0.9, 0.3, M.redLight, 8, 22.1, 10, 0, 0, 0, 10);
    for (let i = 0; i < 4; i++) { box(g, 2.0, 2.4, 2.0, M.grey, -6 + i * 3.5, 1.2, -12); cyl(g, 0.06, 0.06, 5, M.darkMetal, -6 + i * 3.5, 4.5, -12, 0, 0, 0, 4); }
    cyl(g, 0.4, 0.4, 14, M.darkMetal, -2, 6.5, 2, 0, 0, Math.PI / 2, 8); // Rohrleitung
    height = 20;
  } else if (kind === 'substation') {
    for (let i = 0; i < 3; i++) {
      box(g, 2.6, 2.8, 2.2, M.grey, -4 + i * 4, 1.4, 0);
      cyl(g, 0.15, 0.15, 2, M.white, -4 + i * 4, 3.6, 0, 0, 0, 0, 6);
      for (let k = 0; k < 3; k++) cyl(g, 0.3, 0.3, 0.08, M.white, -4 + i * 4, 3.0 + k * 0.5, 0, 0, 0, 0, 8);
      box(g, 1.0, 1.2, 0.8, M.darkMetal, -4 + i * 4, 0.6, 1.6);
    }
    for (const x of [-6, 6]) { const t = box(g, 0.3, 9, 0.3, M.darkMetal, x, 4.5, -3); box(g, 5, 0.25, 0.25, M.darkMetal, x, 8.5, -3); box(g, 4, 0.2, 0.2, M.darkMetal, x, 7.2, -3); }
    height = 9;
  } else if (kind === 'bunker') {
    box(g, 6, 2, 6, M.concreteDark, 0, 1, 0);
    add(g, sphG(3.6, 14, 6), M.tent, 0, 1.6, 0).scale.set(1, 0.28, 1); // Erdabdeckung
    box(g, 3, 0.4, 0.2, M.darkMetal, 0, 1.3, 3.05);
    box(g, 1.2, 1.6, 0.3, M.darkMetal, 2.0, 0.9, 3.05); // Tür
    sandbags(g, 0, 3.9, 6, 0, 2);
    height = 2.5;
  } else if (kind === 'fuel') {
    for (let i = 0; i < 3; i++) {
      add(g, cylG(2.2, 2.2, 4, 18), M.white, -5 + i * 5, 2, 0);
      add(g, cylG(2.0, 2.2, 0.3, 18), M.grey, -5 + i * 5, 4.1, 0);
      cyl(g, 0.15, 0.15, 4.2, M.darkMetal, -5 + i * 5 + 1.9, 2.1, 1.1, 0, 0, 0, 6); // Leiter
    }
    for (let i = 0; i < 2; i++) cyl(g, 0.2, 0.2, 5.4, M.darkMetal, -2.5 + i * 5, 3.0, -2.5, 0, 0, Math.PI / 2, 8); // Rohre
    height = 4;
  } else if (kind === 'rail') { // Munitionszug-Waggon
    box(g, 2.8, 2.6, 12, M.camoRU, 0, 2.1, 0);
    box(g, 2.9, 0.2, 12.2, M.darkMetal, 0, 0.9, 0);
    for (const z of [-4.5, 4.5]) for (const s of [-1, 1]) { cyl(g, 0.45, 0.45, 0.2, M.darkMetal, s * 1.1, 0.5, z, 0, 0, Math.PI / 2, 10); cyl(g, 0.45, 0.45, 0.2, M.darkMetal, s * 1.1, 0.5, z + 1.3, 0, 0, Math.PI / 2, 10); }
    box(g, 0.1, 2.0, 2.4, M.darkMetal, 1.42, 2.1, 0); box(g, 0.1, 2.0, 2.4, M.darkMetal, -1.42, 2.1, 0); // Schiebetüren
    box(g, 2.6, 0.12, 12, M.era, 0, 3.45, 0);
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
  optimize(g);
  return g;
}

// ---------------- Eroberungspunkte (Gefechtsmodus) ----------------
// Besitzerfarben: neutral grau, UA blau/gelb, RU rot. Jedes Modell bekommt eigene Farbmaterialien
// (setOwner(team)), die Teile sind von der Zusammenführung ausgenommen (noWreck).
const CP_COL = { N: [0x8c9096, 0x8c9096], UA: [0x2f7de1, 0xffd500], RU: [0xd42a2a, 0xd42a2a] };
const _bv = new THREE.Vector3(), _bq = new THREE.Quaternion(), _by = new THREE.Vector3(0, 1, 0);
// Zylinder zwischen zwei Punkten (Streben, Seile)
function beam(p, a, b, r, mat, s = 5) {
  _bv.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = _bv.length();
  const m = add(p, cylG(r, r, 1, s), mat, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  m.scale.set(1, len, 1);
  m.quaternion.copy(_bq.setFromUnitVectors(_by, _bv.normalize()));
  return m;
}
function ownerMats() {
  const a = new THREE.MeshStandardMaterial({ color: CP_COL.N[0], roughness: 0.7, side: THREE.DoubleSide });
  const b = new THREE.MeshStandardMaterial({ color: CP_COL.N[1], roughness: 0.7, side: THREE.DoubleSide });
  return { a, b, set(team) { const c = CP_COL[team] || CP_COL.N; a.color.setHex(c[0]); b.color.setHex(c[1]); const em = team === 'N' ? 0 : 0.18; a.emissive.setHex(c[0]).multiplyScalar(em); b.emissive.setHex(c[1]).multiplyScalar(em); } };
}
const ownerPart = (m) => { m.userData.noWreck = true; m.castShadow = true; return m; };
// Fahnenmast mit zweigeteilter Fahne (oben a, unten b) und Farbband
function flagMast(g, om, x, z, h = 9, y0 = 0) {
  cyl(g, 0.09, 0.12, h, M.darkMetal, x, y0 + h / 2, z, 0, 0, 0, 6);
  add(g, sphG(0.16, 8, 6), M.rim, x, y0 + h + 0.1, z);
  box(g, 0.6, 0.25, 0.6, M.concreteDark, x, y0 + 0.12, z);
  const flag = new THREE.Group(); flag.position.set(x, y0 + h - 1.0, z); g.add(flag);
  ownerPart(add(flag, boxG(2.8, 0.9, 0.04), om.a, 1.45, 0.45, 0, 0, 0, 0));
  ownerPart(add(flag, boxG(2.8, 0.9, 0.04), om.b, 1.45, -0.45, 0, 0, 0, 0));
  ownerPart(add(g, cylG(0.2, 0.2, 1.4, 10), om.b, x, y0 + 2.2, z));
  return flag;
}
function latticeMast(g, H, w0, w1, mat, legs = 4, step = 2.8) {
  const corner = (k, y) => { const w = w0 + (w1 - w0) * (y / H); const a = (k / legs) * Math.PI * 2 + Math.PI / legs; return [Math.cos(a) * w, y, Math.sin(a) * w]; };
  for (let k = 0; k < legs; k++) beam(g, corner(k, 0), corner(k, H), 0.14, mat);
  for (let y = 0; y < H - 0.1; y += step) {
    const y1 = Math.min(H, y + step);
    for (let k = 0; k < legs; k++) {
      const n = (k + 1) % legs;
      beam(g, corner(k, y1), corner(n, y1), 0.06, mat, 4);
      beam(g, corner(k, y), corner(n, y1), 0.05, mat, 4);
    }
  }
}
function capturePoint(kind) {
  const g = new THREE.Group();
  const om = ownerMats();
  const r = { root: g, height: 6, setOwner: (t) => om.set(t), owner: om, rotors: [] };
  if (!M.envelope) {
    M.envelope = new THREE.MeshStandardMaterial({ color: 0x9da29b, roughness: 0.6, metalness: 0.3 });
    M.envelopeRib = new THREE.MeshStandardMaterial({ color: 0x7d827c, roughness: 0.6, metalness: 0.4 });
    M.balloon = new THREE.MeshStandardMaterial({ color: 0xc4c7c0, roughness: 0.7, metalness: 0.05 });
    M.sock = new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.8, side: THREE.DoubleSide });
    M.rope = new THREE.MeshStandardMaterial({ color: 0x3a3630, roughness: 0.9 });
  }
  if (kind === 'zeppelin') {
    // Ankermast (Gittermast) mit Plattform
    const H = 22;
    latticeMast(g, H, 2.2, 0.7, M.darkMetal);
    cyl(g, 1.3, 1.3, 0.3, M.darkMetal, 0, H + 0.15, 0, 0, 0, 0, 12);
    cyl(g, 0.35, 0.55, 1.4, M.grey, 0, H + 1.0, 0, 0, 0, 0, 8);
    add(g, sphG(0.22, 8, 6), M.redLight, 0, H + 1.9, 0, 0, 0, 0, false);
    // Seile vom Mastkopf zu Bodenankern + Anker
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + Math.PI / 4;
      const ax = Math.cos(a) * 11, az = Math.sin(a) * 11;
      beam(g, [0, H - 0.5, 0], [ax, 0.3, az], 0.05, M.rope, 4);
      box(g, 1.0, 0.6, 1.0, M.concreteDark, ax, 0.3, az);
    }
    sandbags(g, 0, 3.4, 5, 0, 2); sandbags(g, 0, -3.4, 5, 0, 2);
    for (let i = 0; i < 3; i++) box(g, 1.3, 0.8, 0.9, M.crate, 4.5 + i * 1.4, 0.4, -3.0);
    // Farbband (Banner) am Mast
    ownerPart(add(g, boxG(1.4, 3.0, 0.05), om.a, 0, 9.5, 1.95));
    ownerPart(add(g, boxG(1.4, 3.0, 0.05), om.b, 0, 6.5, 1.75));
    // Fahne auf dem Mastkopf
    const flag = new THREE.Group(); flag.position.set(0, H + 4.2, 0); g.add(flag);
    cyl(g, 0.07, 0.07, 4.2, M.darkMetal, 0, H + 2.4, 0, 0, 0, 0, 5);
    ownerPart(add(flag, boxG(3.2, 1.0, 0.05), om.a, 1.65, 0.5, 0));
    ownerPart(add(flag, boxG(3.2, 1.0, 0.05), om.b, 1.65, -0.5, 0));
    r.flag = flag;
    // Luftschiff: Drehpunkt am Mastkopf, Rumpf liegt in −z
    const sway = new THREE.Group(); sway.position.set(0, H + 1.0, 0); g.add(sway);
    const L = 17, R = 4.6, cz = -L - 0.3;
    const hull = add(sway, sphG(1, 28, 16), M.envelope, 0, -0.3, cz);
    hull.scale.set(R, R, L);
    const prof = (z) => R * Math.sqrt(Math.max(0, 1 - ((z - cz) / L) ** 2));
    for (const z of [-5, -10, -15, -20, -25, -30]) {
      const rr = prof(z) + 0.04;
      const t = add(sway, new THREE.TorusGeometry(rr, 0.07, 5, 32), M.envelopeRib, 0, -0.3, z);
      t.castShadow = false;
    }
    // Besitzer-Farbband um den Rumpf
    const bz = -27.2, br = prof(bz) + 0.06;
    const band = ownerPart(add(sway, new THREE.CylinderGeometry(br, prof(bz - 1.4) + 0.06, 1.4, 28, 1, true), om.b, 0, -0.3, bz - 0.7, Math.PI / 2, 0, 0));
    band.castShadow = false;
    // Leitwerk (Kreuzleitwerk) – oben in Besitzerfarbe
    const tz = cz - L + 4.6;
    ownerPart(add(sway, boxG(0.25, 4.0, 5.2), om.a, 0, prof(tz) + 1.6, tz));
    box(sway, 0.25, 4.0, 5.2, M.envelopeRib, 0, -prof(tz) - 2.2, tz);
    box(sway, 4.2, 0.25, 5.2, M.envelopeRib, prof(tz) + 1.7, -0.3, tz);
    box(sway, 4.2, 0.25, 5.2, M.envelopeRib, -prof(tz) - 1.7, -0.3, tz);
    // Gondel mit Fenstern und Streben
    const gz = -13;
    box(sway, 2.2, 1.7, 7.5, M.grey, 0, -R - 1.4, gz);
    box(sway, 2.25, 0.5, 6.2, M.glass, 0, -R - 1.1, gz);
    add(sway, sphG(1.1, 10, 6), M.grey, 0, -R - 1.4, gz + 3.7).scale.set(1, 0.78, 0.8);
    for (const dz of [-2.8, 2.8]) for (const s of [-1, 1]) beam(sway, [s * 0.9, -R - 0.6, gz + dz], [s * 1.6, -R + 0.6, gz + dz * 1.2], 0.06, M.darkMetal, 4);
    // Motorgondeln mit Propellern
    for (const s of [-1, 1]) {
      const ex = s * (R + 0.6), ez = -21;
      cyl(sway, 0.55, 0.4, 2.6, M.grey, ex, -2.6, ez, Math.PI / 2, 0, 0, 10);
      beam(sway, [ex, -2.4, ez], [s * (R - 0.8), -1.8, ez], 0.08, M.darkMetal, 4);
      const pr = add(sway, cylG(1.3, 1.3, 0.03, 18), M.rotor, ex, -2.6, ez - 1.5, Math.PI / 2, 0, 0, false);
      pr.userData.noWreck = true;
      r.rotors.push(pr);
    }
    // Halteleinen vom Rumpf nach unten (schwingen mit)
    for (const [x, z] of [[2.5, -9], [-2.5, -9], [2.8, -24], [-2.8, -24]]) beam(sway, [x, -R * 0.7, z], [x * 2.2, -H - 0.8, z * 0.98], 0.035, M.rope, 3);
    r.sway = sway;
    r.height = 28;
  } else if (kind === 'aerostat') {
    // Seilwinde (Lkw-Aufbau) + Fesselballon
    box(g, 2.6, 1.4, 4.2, M.camoUA, 0, 0.9, 0);
    cyl(g, 0.7, 0.7, 2.2, M.darkMetal, 0, 1.9, 0.6, 0, 0, Math.PI / 2, 12);
    for (const s of [-1, 1]) for (const z of [-1.4, 1.4]) wheel(g, 0.45, 0.35, s * 1.3, 0.45, z);
    sandbags(g, 0, -3.5, 5, 0, 2);
    const sway = new THREE.Group(); sway.position.set(0, 2.4, 0.6); g.add(sway);
    const H = 30;
    beam(sway, [0, 0, 0], [0, H - 2.4, 1.5], 0.05, M.rope, 4);
    const bal = new THREE.Group(); bal.position.set(0, H, 1.5); sway.add(bal);
    const b = add(bal, sphG(1, 24, 14), M.balloon, 0, 0, 0); b.scale.set(2.5, 2.5, 6);
    const band = ownerPart(add(bal, new THREE.CylinderGeometry(2.48, 2.48, 1.2, 24, 1, true), om.b, 0, 0, 1.0, Math.PI / 2, 0, 0)); band.castShadow = false;
    for (let k = 0; k < 3; k++) {
      const a = k * (Math.PI * 2 / 3);
      const fin = new THREE.Group(); fin.rotation.z = a; fin.position.z = -4.6; bal.add(fin);
      const f = add(fin, sphG(1, 10, 6), k === 0 ? om.a : M.balloon, 0, 2.6, 0); f.scale.set(0.35, 1.6, 1.6);
      if (k === 0) ownerPart(f);
    }
    add(bal, sphG(0.45, 10, 6), M.darkMetal, 0, -2.6, 1.2); // Sensorkugel
    for (const s of [-1, 1]) beam(bal, [0, -2.2, 1.2], [s * 1.2, -0.8, 1.2], 0.03, M.rope, 3);
    r.sway = sway; r.balloon = bal;
    r.flag = flagMast(g, om, 4.5, 2.5, 8);
    r.height = 34;
  } else if (kind === 'airfield') {
    // lokale x-Achse = Piste, +z = Hangarseite (vom Generator gesetzt)
    box(g, 3.2, 7, 3.2, M.concrete, 14, 3.5, -14);
    box(g, 4.4, 2.4, 4.4, M.glass, 14, 8.2, -14);
    box(g, 4.8, 0.3, 4.8, M.concreteDark, 14, 9.55, -14);
    cyl(g, 0.05, 0.05, 3, M.darkMetal, 15, 11.2, -14.5, 0, 0, 0, 4);
    radarDish(g, 13, 10.2, -13.2);
    // Windsack
    cyl(g, 0.06, 0.06, 6, M.darkMetal, -18, 3, -10, 0, 0, 0, 5);
    add(g, cylG(0.55, 0.25, 2.4, 10, 1, true), M.sock, -18 + 1.2, 5.6, -10, 0, 0, Math.PI / 2 + 0.25);
    // Pistenbefeuerung
    for (let i = -3; i <= 3; i++) for (const s of [-1, 1]) box(g, 0.3, 0.25, 0.3, M.headlight, i * 10, 0.12, s * 5.6);
    for (let i = 0; i < 4; i++) cyl(g, 0.4, 0.4, 0.95, i % 2 ? M.era : M.sand, 6 + i * 1.0, 0.48, -11, 0, 0, 0, 10);
    r.flag = flagMast(g, om, -3, -9, 10);
    r.height = 11;
  } else if (kind === 'depot') {
    for (const [ox, oz] of [[8, -8], [-8, 8]]) {
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
        box(g, 2.2, 1.2, 1.3, M.crate, ox - 1.2 + i * 2.4, 0.6, oz - 0.8 + j * 1.6);
        if ((i + j) % 2 === 0) box(g, 2.2, 1.2, 1.3, M.crate, ox - 1.2 + i * 2.4, 1.8, oz - 0.8 + j * 1.6);
      }
      for (let i = 0; i < 3; i++) cyl(g, 0.38, 0.38, 0.95, i % 2 ? M.era : M.sand, ox + 3.6, 0.48, oz - 1 + i * 0.9, 0, 0, 0, 10);
      box(g, 6.5, 0.12, 4.6, M.tent, ox, 3.0, oz, 0.05, 0, 0);
      for (const dx of [-3, 3]) for (const dz of [-2.1, 2.1]) cyl(g, 0.07, 0.07, 3, M.wood, ox + dx, 1.5, oz + dz, 0, 0, 0, 4);
    }
    r.flag = flagMast(g, om, 0, 0, 9);
    r.height = 9;
  } else if (kind === 'radio') {
    const t = new THREE.Group(); t.position.set(-5, 0, 5); g.add(t);
    latticeMast(t, 28, 1.3, 0.45, M.steelBridge, 3, 3.1);
    add(t, sphG(0.25, 8, 6), M.redLight, 0, 28.3, 0, 0, 0, 0, false);
    add(t, sphG(0.2, 8, 6), M.redLight, 0, 15, 0, 0, 0, 0, false);
    for (const [y, a] of [[20, 0.3], [12, 2.4]]) { const d = add(t, cylG(1.0, 0.3, 0.6, 14), M.white, Math.cos(a) * 0.9, y, Math.sin(a) * 0.9, 0, -a, Math.PI / 2); d.castShadow = true; }
    for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3 + 0.5; beam(t, [0, 20, 0], [Math.cos(a) * 13, 0.2, Math.sin(a) * 13], 0.03, M.rope, 3); box(t, 0.8, 0.5, 0.8, M.concreteDark, Math.cos(a) * 13, 0.25, Math.sin(a) * 13); }
    box(g, 2.4, 1.6, 1.6, M.grey, -1.5, 0.8, 9); // Technikschrank
    r.flag = flagMast(g, om, 2, 5, 9);
    r.height = 29;
  } else if (kind === 'railway') {
    box(g, 30, 0.6, 3.2, M.concrete, 0, 0.3, 4.2);
    for (let i = -2; i <= 2; i++) { cyl(g, 0.06, 0.06, 4, M.darkMetal, i * 6, 2.6, 5.3, 0, 0, 0, 5); box(g, 0.7, 0.2, 0.3, M.headlight, i * 6, 4.6, 5.1); }
    box(g, 3.2, 0.9, 0.12, M.white, 4, 3.2, 5.6);
    for (const x of [24, 37.5]) structureRail(g, x);
    r.flag = flagMast(g, om, -9, 4.4, 8, 0.6);
    r.height = 9;
  } else { // village
    sandbags(g, 0, 2.6, 3.5, 0, 2);
    r.flag = flagMast(g, om, 0, 0, 9);
    r.height = 9;
  }
  return r;
}
function radarDish(g, x, y, z) { const d = add(g, cylG(0.8, 0.2, 0.4, 12), M.white, x, y, z, 0, 0, Math.PI / 2.4); return d; }
function structureRail(g, x) {
  box(g, 12, 2.6, 2.8, M.camoRU, x, 2.1, 0, 0, Math.PI / 2 * 0, 0);
  box(g, 12.2, 0.2, 2.9, M.darkMetal, x, 0.9, 0);
  for (const dx of [-4.5, 4.5]) for (const s of [-1, 1]) cyl(g, 0.45, 0.45, 0.2, M.darkMetal, x + dx, 0.5, s * 1.1, Math.PI / 2, 0, 0, 10);
  box(g, 12, 0.12, 2.6, M.era, x, 3.45, 0);
}

// ---------------- Fabrik ----------------
const NO_BLOB = new Set(['quad', 'reconquad', 'shahed', 'lancet', 'orlan', 'recon_wing', 'heli', 'seadrone', 'boat', 'bridge_road', 'bridge_rail']);
const TURRET_SKIP = new Set(['leopard', 't72', 't90', 'bradley', 'bmp', 'gepard', 'spg']);

export function buildModel(type, side, season, quality) {
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
    case 'truck': r = cargoTruck(side); break;
    case 'soldier': r = soldier(side, type.weaponModel || 'rifle'); break;
    case 'quad': r = quad(side, type.modelSize || 1, false); break;
    case 'reconquad': r = quad(side, type.modelSize || 1.6, true); break;
    case 'shahed': case 'lancet': case 'orlan': case 'recon_wing': r = fixedWing(side, type.model); break;
    case 'heli': r = helicopter(side); break;
    case 'seadrone': r = seaDrone(); break;
    case 'boat': r = patrolBoat(); break;
    case 'bridge_road': r = bridgeSpan(type.spanLen || 28, 'road'); break;
    case 'bridge_rail': r = bridgeSpan(type.spanLen || 28, 'rail'); break;
    case 'cp_zeppelin': case 'cp_aerostat': case 'cp_airfield': case 'cp_depot': case 'cp_radio': case 'cp_railway': case 'cp_village': r = capturePoint(type.model.slice(3)); break;
    default: r = structure(type.model, side);
  }
  // Winter-Tarnung
  if (season === 'winter' && side === 'UA') r.root.traverse((o) => { if (o.material === M.camoUA) o.material = M.camoWinter; });
  // Statische Teile je Transform-Knoten zusammenführen (Geometrie je Typ/Seite/Saison gecacht)
  const keep = [r.turret, r.barrel, r.muzzle, r.body, r.arm, r.radar, r.radar2, r.hull, r.deck, r.sway, r.balloon, r.flag, ...(r.legs || []), ...(r.rotors || [])];
  optimize(r.root, keep, `${type.model}|${side}|${season === 'winter' && side === 'UA' ? 'w' : ''}|${type.weaponModel || ''}|${type.modelSize || ''}|${type.spanLen || ''}`);
  // Infanterie wirft auf low/medium keinen Echtzeit-Schatten (Kontaktschatten reicht)
  if (type.model === 'soldier' && (quality === 'low' || quality === 'medium')) r.root.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  // Kontaktschatten für Boden-Einheiten und Strukturen
  if (!NO_BLOB.has(type.model) && !type.cp) {
    const bb = footprint(r.root, TURRET_SKIP.has(type.model) ? r.turret : null);
    const s = r.root.scale.x || 1;
    const sx = Math.min(80, bb.max.x - bb.min.x) / 1, sz = Math.min(80, bb.max.z - bb.min.z);
    if (isFinite(sx) && sx > 0) {
      const inf = type.model === 'soldier';
      addBlob(r.root, sx * (inf ? 1.2 : 1.12) + 0.5 * s, sz * (inf ? 1.2 : 1.1) + 0.5 * s, (bb.max.x + bb.min.x) / 2, (bb.max.z + bb.min.z) / 2);
    }
  }
  return r;
}
export function projectileModel(kind) {
  initMats();
  const r = fixedWing('UA', kind);
  optimize(r.root, [r.muzzle, ...(r.rotors || [])], `proj|${kind}`);
  return r;
}
export function wreckify(root) {
  initMats();
  root.traverse((o) => { if (o.isMesh && o.material !== M.rotor && !o.userData.noWreck) { o.material = M.wreck; } });
}
export const Materials = M;
export { initMats };
