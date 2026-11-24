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

// Panzerjäger (Gefecht, MP-T7): UA = Radfahrzeug (BTR-4E) mit Stugna-P-Doppelstarter, RU = Kettenfahrzeug (BMP-3-Fahrgestell)
// mit ausfahrbarem Chrysanthema-Doppelwerfer. Flache Silhouette, Werfer auf dem Turmträger (dreht sich mit dem Ziel).
function tankDestroyer(side) {
  const g = new THREE.Group();
  const cam = side === 'UA' ? M.camoUA : M.camoRU;
  const L = 7, W = 3.0, wheeled = side === 'UA';
  if (wheeled) {
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) wheel(g, 0.55, 0.45, s * (W / 2 - 0.2), 0.55, -2.4 + i * 1.55);
    add(g, hullGeo(W - 0.4, 1.25, L, 0.45, 0.1), cam, 0, 1.45, 0);
    box(g, 0.1, 0.12, 6.0, M.darkMetal, -(W / 2 - 0.2), 1.15, 0); box(g, 0.1, 0.12, 6.0, M.darkMetal, W / 2 - 0.2, 1.15, 0);
  } else {
    const tx = W / 2 - 0.3;
    for (const s of [-1, 1]) { trackSet(g, s, tx, L, { w: 0.7, h: 0.9, n: 6, wr: 0.34 }); box(g, 0.08, 0.5, L * 0.6, cam, s * (tx + 0.46), 1.0, 0); }
    add(g, hullGeo(W - 0.4, 1.15, L, 0.38, 0.05), cam, 0, 1.4, 0);
  }
  headlights(g, 1.4, L / 2 - 0.14, 1.0, 0.2);
  box(g, 1.3, 0.12, 1.4, M.darkMetal, 0, 2.08, -2.4); // Motorabdeckung
  // Tarnnetz-Rolle hinten
  cyl(g, 0.22, 0.22, 2.2, M.darkMetal, 0, 2.15, -3.1, 0, 0, Math.PI / 2, 8);
  const turret = new THREE.Group();
  turret.position.set(0, 2.05, 0.6);
  g.add(turret);
  box(turret, 1.1, 0.35, 1.3, cam, 0, 0.15, 0);           // Drehkranz/Träger
  box(turret, 0.25, 0.9, 0.25, M.darkMetal, 0, 0.6, -0.2); // Hubarm
  const barrel = new THREE.Group(); barrel.position.set(0, 1.05, -0.1); turret.add(barrel);
  for (const sx of [-0.32, 0.32]) {
    cyl(barrel, 0.15, 0.15, 1.7, side === 'UA' ? M.darkMetal : M.sand, sx, 0, 0.4, Math.PI / 2, 0, 0, 8); // Startrohr
    cyl(barrel, 0.17, 0.17, 0.08, M.gunMetal, sx, 0, 1.25, Math.PI / 2, 0, 0, 8);
  }
  box(barrel, 0.35, 0.3, 0.45, M.darkMetal, 0, 0.05, -0.2); // Zieloptik
  if (!wheeled) box(barrel, 0.45, 0.35, 0.4, M.gunMetal, 0, 0.35, 0.1); // Radar (Chrysanthema)
  const muzzle = new THREE.Object3D(); muzzle.position.set(0.32, 0, 1.3); barrel.add(muzzle);
  antenna(g, -1.0, 2.0, -2.6, 2.2, 0.08);
  iff(g, side, 2.1, -1.6);
  return { root: g, turret, barrel, muzzle, height: 3.1 };
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

// Bergepanzer / Werkstattfahrzeug: Wanne auf Ketten, Kran, Räumschild
function recoveryVehicle(side) {
  const g = new THREE.Group();
  const cam = side === 'UA' ? M.camoUA : M.camoRU;
  const L = 6.4, W = 3.3, tx = W / 2 - 0.35;
  for (const s of [-1, 1]) {
    trackSet(g, s, tx, L, { n: 5 });
    box(g, 0.06, 0.45, L * 0.6, cam, s * (tx + 0.5), 1.15, -0.3);
  }
  add(g, hullGeo(W - 0.6, 0.9, L, 0.18, 0.1), cam, 0, 1.3, 0);
  box(g, 2.2, 1.5, 2.0, cam, 0.0, 2.45, 1.1); // Kabine
  box(g, 1.9, 0.5, 0.05, M.glass, 0, 2.7, 2.12);
  box(g, 3.3, 0.9, 0.35, M.darkMetal, 0, 1.45, L / 2 + 0.3, -0.35, 0, 0); // Räumschild
  box(g, 2.6, 0.15, 3.0, M.darkMetal, 0, 1.82, -1.6); // Ladefläche
  box(g, 0.9, 0.9, 0.9, M.era, 0.9, 2.35, -2.4); box(g, 0.9, 0.7, 0.9, M.crate, -0.9, 2.25, -2.4); // Kisten
  const crane = new THREE.Group(); crane.position.set(0, 2.0, -0.6); g.add(crane);
  box(crane, 0.5, 0.5, 0.5, M.darkMetal, 0, 0.2, 0);
  box(crane, 0.28, 0.28, 3.4, M.darkMetal, 0, 1.0, -1.4, 0.35, 0, 0); // Ausleger
  box(crane, 0.08, 1.4, 0.08, M.gunMetal, 0, 0.5, -2.9); // Seil
  box(crane, 0.35, 0.2, 0.35, M.darkMetal, 0, -0.25, -2.9); // Haken
  box(g, 0.12, 0.12, 0.12, M.redLight, 0.9, 3.25, 1.1); // Rundumleuchte
  antenna(g, -0.9, 3.2, 0.4, 2.0, 0.1);
  iff(g, side, 1.78, 1.6, 1.4);
  const muzzle = new THREE.Object3D(); g.add(muzzle);
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
  if (weapon === 'engineer') { // großer Werkzeug-/Baustoffrucksack, Spaten, gelbe Weste
    box(body, 0.5, 0.45, 0.32, M.sand, 0, 1.28, -0.44);
    box(body, 0.06, 0.7, 0.04, M.wood2, 0.18, 1.3, -0.64);
    box(body, 0.22, 0.2, 0.03, M.darkMetal, 0.18, 0.9, -0.64);
    box(body, 0.58, 0.14, 0.38, M.iffUA, 0, 1.52, 0.01);
  } else if (weapon === 'medic') { // weißer Rucksack mit rotem Kreuz
    box(body, 0.46, 0.5, 0.3, M.white, 0, 1.34, -0.42);
    box(body, 0.34, 0.09, 0.02, M.redLight, 0, 1.4, -0.58); box(body, 0.09, 0.34, 0.02, M.redLight, 0, 1.4, -0.58);
    box(body, 0.32, 0.12, 0.02, M.white, 0, 1.78, 0.0);
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
// Alle Häuser teilen sich wenige neutrale Texturen (Putz, Ziegel, Bruchstein, Holz, Lehm, Platte, Wellblech,
// Dachziegel, Schiefer, Falzblech, Schindeln, Bitumen). Die Farbe kommt über die Materialfarbe (Tönung), die
// Detailteile (Fenster, Türen, Zubehör) sind einfarbig und werden von optimize() in 2–3 Meshes pro Haus vereint.
const _bt = {};
function bRot(c) { const [o, x] = mkCanvas(c.width, c.height); x.translate(c.width / 2, c.height / 2); x.rotate(Math.PI / 2); x.drawImage(c, -c.width / 2, -c.height / 2); return o; }
function tSpeckle(x, r, S, n, a, big = 2) { for (let i = 0; i < n; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '30,25,20'},${r() * a})`; x.fillRect(r() * S, r() * S, 1 + r() * big, 1 + r() * big); } }
function tBlots(x, r, S, n, r0, r1, a, cols = ['255,250,235', '60,50,40']) {
  for (let i = 0; i < n; i++) { x.fillStyle = `rgba(${cols[r() < 0.5 ? 0 : cols.length - 1]},${0.02 + r() * a})`; x.beginPath(); x.ellipse(r() * S, r() * S, r0 + r() * (r1 - r0), (r0 + r() * (r1 - r0)) * 0.7, r() * 3, 0, 6.3); x.fill(); }
}
function tStreaks(x, r, S, n, len, a, rgb = '40,35,30', y0 = null) {
  for (let i = 0; i < n; i++) { const px = r() * S, py = y0 ?? r() * (S - len * 0.4), g = x.createLinearGradient(0, py, 0, py + len); g.addColorStop(0, `rgba(${rgb},${a * (0.5 + r() * 0.5)})`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.fillRect(px, py, 1 + r() * 3, len * (0.5 + r() * 0.5)); }
}
function tCracks(x, r, S, n, a) {
  x.strokeStyle = `rgba(40,32,26,${a})`; x.lineWidth = 1;
  for (let i = 0; i < n; i++) { let px = r() * S, py = r() * S; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (r() - 0.5) * 14; py += 5 + r() * 10; x.lineTo(px, py); } x.stroke(); }
}
const BTX = {
  plaster() { // Kalkputz, Flecken, Risse, abgeplatzte Stellen mit Ziegel darunter
    const S = 256, [c, x] = mkCanvas(S), r = mkRand(101);
    x.fillStyle = '#ece8dc'; x.fillRect(0, 0, S, S);
    tBlots(x, r, S, 46, 12, 46, 0.07); tSpeckle(x, r, S, 1100, 0.11);
    for (let i = 0; i < 3; i++) {
      const px = 20 + r() * 190, py = 20 + r() * 190, pw = 18 + r() * 30, ph = 12 + r() * 22;
      x.fillStyle = 'rgba(0,0,0,0.22)'; x.fillRect(px - 1.5, py - 1.5, pw + 3, ph + 3);
      x.fillStyle = '#9c5b47'; x.beginPath(); x.moveTo(px, py + 3); x.lineTo(px + pw * 0.4, py); x.lineTo(px + pw, py + 4); x.lineTo(px + pw - 3, py + ph); x.lineTo(px + 4, py + ph - 2); x.closePath(); x.fill();
      x.fillStyle = 'rgba(190,175,150,0.8)'; for (let k = 3; k < ph; k += 6) x.fillRect(px + 1, py + k, pw - 2, 1.2);
    }
    tCracks(x, r, S, 5, 0.3); tStreaks(x, r, S, 9, 80, 0.16);
    return finishTex(c);
  },
  brick() { // Läuferverband 8 x 16 Steine je Kachel (2 m)
    const S = 256, [c, x] = mkCanvas(S), r = mkRand(202);
    x.fillStyle = '#bdb5a4'; x.fillRect(0, 0, S, S);
    for (let row = 0; row < 16; row++) for (let col = -1; col < 8; col++) {
      const bx = col * 32 + (row % 2) * 16, by = row * 16, k = r();
      const l = 30 + r() * 14 + (k < 0.06 ? -9 : k > 0.94 ? 9 : 0);
      x.fillStyle = `hsl(${7 + r() * 11},${36 + r() * 16}%,${l}%)`; x.fillRect(bx + 1, by + 1, 30, 14);
      x.fillStyle = 'rgba(255,225,205,0.10)'; x.fillRect(bx + 1, by + 1, 30, 1);
      x.fillStyle = 'rgba(0,0,0,0.2)'; x.fillRect(bx + 1, by + 14, 30, 1);
    }
    tBlots(x, r, S, 30, 10, 40, 0.1, ['255,245,230', '25,20,15']); tSpeckle(x, r, S, 900, 0.12); tStreaks(x, r, S, 8, 90, 0.2);
    for (let i = 0; i < 5; i++) { x.fillStyle = `rgba(235,235,225,${0.1 + r() * 0.12})`; x.fillRect(r() * S, r() * S, 12 + r() * 30, 2 + r() * 4); }
    return finishTex(c);
  },
  stone() { // Bruchstein, unregelmäßige Lagen (3 m)
    const S = 256, [c, x] = mkCanvas(S), r = mkRand(303);
    x.fillStyle = '#6e6859'; x.fillRect(0, 0, S, S);
    let y = 0;
    while (y < S) {
      let rh = Math.min(S - y, 24 + r() * 18); if (S - y - rh < 18) rh = S - y;
      let xx = 0;
      while (xx < S) {
        let sw = Math.min(S - xx, 26 + r() * 36); if (S - xx - sw < 16) sw = S - xx;
        x.fillStyle = `hsl(${30 + r() * 16},${10 + r() * 18}%,${50 + r() * 22}%)`; x.fillRect(xx + 1.5, y + 1.5, sw - 3, rh - 3);
        x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(xx + 1.5, y + 1.5, sw - 3, 2);
        x.fillStyle = 'rgba(0,0,0,0.22)'; x.fillRect(xx + 1.5, y + rh - 3.5, sw - 3, 2); x.fillRect(xx + sw - 3.5, y + 1.5, 2, rh - 3);
        xx += sw;
      }
      y += rh;
    }
    tSpeckle(x, r, S, 1200, 0.14); tBlots(x, r, S, 30, 10, 40, 0.1); tStreaks(x, r, S, 6, 80, 0.16);
    for (let i = 0; i < 14; i++) { x.fillStyle = `rgba(80,110,50,${0.12 + r() * 0.16})`; x.fillRect(r() * S, r() * S, 4 + r() * 10, 2 + r() * 4); } // Moos
    return finishTex(c);
  },
  log() { // Rundholz-Blockbau (2,7 m = 8 Lagen)
    const S = 256, [c, x] = mkCanvas(S), r = mkRand(404);
    for (let row = 0; row < 8; row++) {
      const y = row * 32, g = x.createLinearGradient(0, y, 0, y + 32);
      g.addColorStop(0, '#4f361f'); g.addColorStop(0.2, '#a2815a'); g.addColorStop(0.5, '#8c6c46'); g.addColorStop(0.85, '#5f432a'); g.addColorStop(1, '#241709');
      x.fillStyle = g; x.fillRect(0, y, S, 32);
      for (let k = 0; k < 16; k++) { x.strokeStyle = `rgba(30,18,8,${0.12 + r() * 0.18})`; x.lineWidth = 1; const gy = y + 4 + r() * 24, gx = r() * S; x.beginPath(); x.moveTo(gx, gy); x.lineTo(gx + 40 + r() * 100, gy + (r() - 0.5) * 2); x.stroke(); }
      if (r() < 0.6) { const kx = r() * S, ky = y + 8 + r() * 16; x.fillStyle = 'rgba(40,24,10,0.55)'; x.beginPath(); x.ellipse(kx, ky, 5, 3, 0, 0, 6.3); x.fill(); x.strokeStyle = 'rgba(40,24,10,0.35)'; x.stroke(); }
    }
    tBlots(x, r, S, 30, 8, 36, 0.1, ['200,195,180', '30,20,10']); tSpeckle(x, r, S, 500, 0.1);
    return finishTex(c);
  },
  plank() { // senkrechte Bretter, verwittert (2,5 m = 8 Bretter)
    const S = 256, [c, x] = mkCanvas(S), r = mkRand(505);
    for (let i = 0; i < 8; i++) {
      const px = i * 32; x.fillStyle = `hsl(${26 + r() * 10},${16 + r() * 14}%,${30 + r() * 16}%)`; x.fillRect(px, 0, 32, S);
      for (let k = 0; k < 10; k++) { x.strokeStyle = `rgba(20,14,8,${0.1 + r() * 0.2})`; const gx = px + 3 + r() * 26, gy = r() * S; x.beginPath(); x.moveTo(gx, gy); x.lineTo(gx + (r() - 0.5) * 2, gy + 30 + r() * 90); x.stroke(); }
      if (r() < 0.5) { x.fillStyle = 'rgba(25,15,8,0.5)'; x.beginPath(); x.ellipse(px + 8 + r() * 16, r() * S, 3, 5, 0, 0, 6.3); x.fill(); }
      x.fillStyle = '#1b150f'; x.fillRect(px, 0, 2, S); x.fillStyle = 'rgba(255,240,210,0.12)'; x.fillRect(px + 2, 0, 1, S);
      x.fillStyle = 'rgba(30,25,20,0.7)'; for (const ny of [30, 130, 226]) { x.fillRect(px + 7, ny, 2, 2); x.fillRect(px + 23, ny, 2, 2); }
    }
    tStreaks(x, r, S, 10, 110, 0.12, '190,185,170'); tBlots(x, r, S, 24, 8, 30, 0.08, ['200,195,180', '30,20,10']);
    return finishTex(c);
  },
  mud() { // Lehmputz auf Lehmziegeln: Fleckung, Strohreste, Kellenspuren, Risse (3 m)
    const S = 256, [c, x] = mkCanvas(S), r = mkRand(606);
    x.fillStyle = '#d6c19c'; x.fillRect(0, 0, S, S);
    tBlots(x, r, S, 80, 14, 52, 0.11, ['244,228,194', '110,85,52']);
    for (let i = 0; i < 50; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '250,236,205' : '120,95,60'},${0.06 + r() * 0.08})`; x.fillRect(r() * S, r() * S, 20 + r() * 60, 1 + r() * 3); }
    for (let i = 0; i < 160; i++) { x.strokeStyle = `rgba(170,140,80,${0.2 + r() * 0.3})`; const sx = r() * S, sy = r() * S, a = r() * 6.3; x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + Math.cos(a) * 4, sy + Math.sin(a) * 4); x.stroke(); }
    tSpeckle(x, r, S, 1500, 0.14); tCracks(x, r, S, 8, 0.3); tStreaks(x, r, S, 10, 90, 0.18, '90,65,40');
    return finishTex(c);
  },
  panel() { // Betonplatte 3 x 3 m mit Fugen, Rostfahnen, Schmutz
    const S = 256, [c, x] = mkCanvas(S), r = mkRand(707);
    x.fillStyle = '#d0cdc3'; x.fillRect(0, 0, S, S);
    tBlots(x, r, S, 40, 14, 50, 0.07); tSpeckle(x, r, S, 1200, 0.1);
    x.strokeStyle = 'rgba(0,0,0,0.05)'; x.lineWidth = 6; x.strokeRect(14, 14, S - 28, S - 28);
    tStreaks(x, r, S, 8, 100, 0.2, '45,42,38', 0);
    for (let i = 0; i < 5; i++) tStreaks(x, r, S, 1, 50 + r() * 40, 0.3, '120,70,40', 3);
    x.fillStyle = 'rgba(30,30,28,0.6)'; x.fillRect(0, 0, S, 3); x.fillRect(0, S - 1, S, 1); x.fillRect(0, 0, 3, S); x.fillRect(S - 1, 0, 1, S);
    x.fillStyle = 'rgba(255,255,255,0.2)'; x.fillRect(0, 3, S, 2); x.fillRect(3, 0, 2, S);
    return finishTex(c);
  },
  corr() { // Wellblech / Wellasbest, Rippen senkrecht (2 m)
    const S = 256, [c, x] = mkCanvas(S), r = mkRand(808);
    x.fillStyle = '#b1b6b0'; x.fillRect(0, 0, S, S);
    for (let xi = 0; xi < S; xi++) { const v = Math.sin((xi % 16) / 16 * 6.283); x.fillStyle = v > 0 ? `rgba(255,255,255,${0.26 * v})` : `rgba(0,0,0,${-0.3 * v})`; x.fillRect(xi, 0, 1, S); }
    tBlots(x, r, S, 20, 8, 30, 0.2, ['150,85,45', '110,70,40']); tBlots(x, r, S, 14, 10, 40, 0.1, ['90,120,60', '60,90,45']); tStreaks(x, r, S, 14, 110, 0.2, '70,45,30'); tSpeckle(x, r, S, 500, 0.1);
    return finishTex(c);
  },
  tile() { // Biberschwanz-/Hohlziegel, Lagen quer zum Gefälle (gedreht)
    const S = 256, [c, x] = mkCanvas(S), r = mkRand(909);
    x.fillStyle = '#b8b2aa'; x.fillRect(0, 0, S, S);
    for (let row = 0; row < 16; row++) for (let col = -1; col < 8; col++) {
      const bx = col * 32 + (row % 2) * 16, by = row * 16, l = r();
      x.fillStyle = l < 0.5 ? `rgba(0,0,0,${l * 0.34})` : `rgba(255,255,255,${(l - 0.5) * 0.2})`; x.fillRect(bx, by, 32, 16);
      x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(bx, by + 13, 32, 3); x.fillRect(bx, by, 1, 16);
      x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect(bx + 1, by, 31, 1);
    }
    tBlots(x, r, S, 24, 8, 30, 0.1, ['110,140,70', '30,25,20']); tSpeckle(x, r, S, 500, 0.1);
    return finishTex(bRot(c));
  },
  slate() { // Schiefer/Eternit-Schuppen
    const S = 256, [c, x] = mkCanvas(S), r = mkRand(1001);
    x.fillStyle = '#8f9399'; x.fillRect(0, 0, S, S);
    for (let row = 0; row < 16; row++) for (let col = -1; col < 11; col++) {
      const bx = col * 25.6 + (row % 2) * 12.8, by = row * 16, l = r();
      x.fillStyle = `hsl(215,${4 + r() * 6}%,${28 + l * 22}%)`; x.fillRect(bx + 1, by, 23.6, 15);
      x.fillStyle = 'rgba(0,0,0,0.4)'; x.fillRect(bx, by + 13, 25.6, 3);
      x.fillStyle = 'rgba(255,255,255,0.08)'; x.fillRect(bx + 1, by, 23, 1);
    }
    tBlots(x, r, S, 20, 8, 30, 0.1); tSpeckle(x, r, S, 400, 0.1);
    return finishTex(bRot(c));
  },
  seam() { // Falzblech, Falze entlang des Gefälles (gedreht)
    const S = 256, [c, x] = mkCanvas(S), r = mkRand(1102);
    x.fillStyle = '#aeb3b6'; x.fillRect(0, 0, S, S);
    for (let k = 0; k < 8; k++) { x.fillStyle = 'rgba(255,255,255,0.3)'; x.fillRect(k * 32, 0, 2, S); x.fillStyle = 'rgba(0,0,0,0.4)'; x.fillRect(k * 32 + 2, 0, 3, S); x.fillStyle = 'rgba(0,0,0,0.06)'; x.fillRect(k * 32 + 5, 0, 27, S); }
    tBlots(x, r, S, 18, 8, 30, 0.2, ['150,85,45', '110,70,40']); tStreaks(x, r, S, 12, 100, 0.2, '70,45,30'); tSpeckle(x, r, S, 400, 0.1);
    return finishTex(bRot(c));
  },
  shingle() { // Holzschindeln
    const S = 256, [c, x] = mkCanvas(S), r = mkRand(1203);
    x.fillStyle = '#8a7a66'; x.fillRect(0, 0, S, S);
    for (let row = 0; row < 12; row++) for (let col = -1; col < 14; col++) {
      const bx = col * 19.7 + (row % 2) * 9.8 + r() * 2, by = row * 21.3;
      x.fillStyle = `hsl(${24 + r() * 12},${10 + r() * 14}%,${30 + r() * 22}%)`; x.fillRect(bx + 0.5, by, 18.5, 20);
      x.fillStyle = 'rgba(0,0,0,0.4)'; x.fillRect(bx, by + 17, 20, 4); x.fillRect(bx, by, 1, 21);
    }
    tStreaks(x, r, S, 10, 90, 0.15, '190,185,170'); tSpeckle(x, r, S, 500, 0.1);
    return finishTex(bRot(c));
  },
  bitu() { // Bitumenbahnen mit Überlappung, Pfützenflecken, Kies
    const S = 256, [c, x] = mkCanvas(S), r = mkRand(1304);
    x.fillStyle = '#75736e'; x.fillRect(0, 0, S, S);
    tBlots(x, r, S, 40, 10, 50, 0.12, ['150,148,140', '30,30,28']); tSpeckle(x, r, S, 1600, 0.16, 3);
    for (const k of [0, 64, 128, 192]) { x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(k, 0, 2, S); x.fillStyle = 'rgba(255,255,255,0.1)'; x.fillRect(k + 2, 0, 1, S); }
    return finishTex(c);
  },
};
const btex = (n) => _bt[n] || (_bt[n] = BTX[n]());
const _bmc = {};
// Texturiertes Wand-/Dachmaterial (Textur geteilt, Farbe als Tönung)
function wmat(tex, hex, rough = 0.92, metal = 0) {
  const k = `${tex}|${hex}|${rough}|${metal}`;
  return _bmc[k] || (_bmc[k] = applyFow(new THREE.MeshStandardMaterial({ map: btex(tex), color: hex, roughness: rough, metalness: metal })));
}
// Einfarbiges Detailmaterial (wird beim Merge als Vertexfarbe übernommen)
function pm(hex, rough = 0.85, metal = 0, em = 0, emI = 1.2) {
  const k = `p${hex}|${rough}|${metal}|${em}`;
  return _bmc[k] || (_bmc[k] = applyFow(new THREE.MeshStandardMaterial(em ? { color: hex, roughness: rough, metalness: metal, emissive: em, emissiveIntensity: emI } : { color: hex, roughness: rough, metalness: metal })));
}
const ROOFS = { // Textur, UV-Maßstab, Rauheit, Metall
  tile: ['tile', 3.2, 0.85, 0.04], slate: ['slate', 3.2, 0.7, 0.1], seam: ['seam', 2.5, 0.5, 0.45], shingle: ['shingle', 2.4, 0.95, 0],
  corr: ['corr', 2.2, 0.6, 0.3], bitu: ['bitu', 4, 0.95, 0],
};
function rmat(kind, hex) { const r = ROOFS[kind]; return { mat: wmat(r[0], hex, r[2], r[3]), s: r[1] }; }

// ---- Gebäude: Geometrie-Bausteine (gecacht, geteilt) ----
const _bg = {};
const _bgk = (k, f) => _bg[k] || (_bg[k] = shared(f()));
const planeG = (w, h) => _bgk(`pl${w},${h}`, () => new THREE.PlaneGeometry(w, h));
// Verbundgeometrie aus Quadern: fn(B, merger), B(w,h,d,x,y,z,ry,rx,rz)
function comp(key, fn) {
  return _bgk(key, () => { const m = new Merger(); fn((w, h, d, x, y, z, ry, rx, rz) => m.add(boxG(w, h, d), mat4(x, y, z, ry, rx, rz)), m); return m.build(); });
}
function triG(w, h, s = 4) { // Dreieck (Basis w, Höhe h) in der xy-Ebene, Basis bei y=0
  return _bgk(`tr${w},${h},${s}`, () => {
    const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(0, h); sh.closePath();
    const g = new THREE.ShapeGeometry(sh); const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / s, uv.getY(i) / s);
    return g;
  });
}
function rtriG(w, h, s = 4) { // rechtwinkliges Dreieck (Sheddach-Zahn): Basis 0..w, Höhe h an der Seite x=w
  return _bgk(`rt${w},${h},${s}`, () => {
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(w, 0); sh.lineTo(w, h); sh.closePath();
    const g = new THREE.ShapeGeometry(sh); const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / s, uv.getY(i) / s);
    return g;
  });
}
function gableG(w, rh, s = 4) { return triG(+w.toFixed(3), +rh.toFixed(3), s); }
function onionG(r, h) { // Zwiebelkuppel (Drehkörper)
  return _bgk(`on${r},${h}`, () => {
    const P = [[0.55, 0], [0.5, 0.07], [0.8, 0.2], [1, 0.38], [0.94, 0.54], [0.64, 0.7], [0.3, 0.84], [0.09, 0.95], [0, 1]];
    return new THREE.LatheGeometry(P.map(([a, b]) => new THREE.Vector2(a * r, b * h)), 14);
  });
}
function archPlaneG(w, h) { // Fenster mit Rundbogen (Rechteck + Halbkreis)
  return _bgk(`ar${w},${h}`, () => {
    const sh = new THREE.Shape(); sh.moveTo(-w / 2, -h / 2); sh.lineTo(w / 2, -h / 2); sh.lineTo(w / 2, h / 2 - w / 2); sh.absarc(0, h / 2 - w / 2, w / 2, 0, Math.PI, false); sh.lineTo(-w / 2, -h / 2);
    return new THREE.ShapeGeometry(sh, 8);
  });
}
function gothG(w, h) { // Fenster mit Spitzbogen
  return _bgk(`go${w},${h}`, () => {
    const sh = new THREE.Shape(); sh.moveTo(-w / 2, -h / 2); sh.lineTo(w / 2, -h / 2); sh.lineTo(w / 2, h / 2 - w * 0.6); sh.lineTo(0, h / 2); sh.lineTo(-w / 2, h / 2 - w * 0.6); sh.closePath();
    return new THREE.ShapeGeometry(sh);
  });
}
// Fensterrahmen (Laibung, Kreuz, Bank, Sturz); Ursprung = Fenstermitte, Rückseite bei z=0, ragt nach +z
const WIN_Z = [0.06, 0.05, 0.05, 0.05];
function winG(ww, wh, v = 0) {
  return comp(`w${ww},${wh},${v}`, (B) => {
    if (v === 2) { B(ww + 0.16, wh + 0.16, 0.04, 0, 0, 0.02); B(0.05, wh, 0.03, 0, 0, 0.07); return; }
    const t = v === 1 ? 0.06 : 0.08, dp = v === 1 ? 0.12 : 0.16;
    B(ww + 2 * t, t, dp, 0, wh / 2 + t / 2, dp / 2); B(ww + 2 * t, t, dp, 0, -wh / 2 - t / 2, dp / 2);
    B(t, wh, dp, -ww / 2 - t / 2, 0, dp / 2); B(t, wh, dp, ww / 2 + t / 2, 0, dp / 2);
    if (v === 3) { for (const k of [-1, 0, 1]) B(0.04, wh, 0.06, k * ww / 4 * (k ? 1 : 0) + (k ? 0 : 0), 0, 0.09); B(ww, 0.04, 0.06, 0, wh / 6, 0.09); B(ww, 0.04, 0.06, 0, -wh / 6, 0.09); B(ww + 0.3, 0.07, 0.2, 0, -wh / 2 - t - 0.03, 0.1); return; }
    B(0.045, wh, 0.07, 0, 0, dp / 2 - 0.02);
    if (v === 0) { B(ww, 0.045, 0.07, 0, wh * 0.14, dp / 2 - 0.02); B(ww + 0.36, 0.08, 0.26, 0, -wh / 2 - t - 0.04, 0.13); B(ww + 0.24, 0.1, 0.12, 0, wh / 2 + t + 0.05, 0.06); } else B(ww + 0.2, 0.06, 0.18, 0, -wh / 2 - t - 0.03, 0.09);
  });
}
const shutG = (ww, wh) => comp(`sh${ww},${wh}`, (B) => {
  const sw = ww * 0.5;
  for (const s of [-1, 1]) { const x = s * (ww / 2 + 0.08 + sw / 2); B(sw, wh + 0.16, 0.05, x, 0, 0.03); for (const k of [-1, 0, 1]) B(sw * 0.86, 0.035, 0.02, x, k * wh * 0.3, 0.06); }
});
const barsG = (ww, wh) => comp(`ba${ww},${wh}`, (B) => {
  const n = Math.max(3, Math.round(ww / 0.14));
  for (let i = 0; i < n; i++) B(0.022, wh + 0.12, 0.022, -ww / 2 + (i + 0.5) * ww / n, 0, 0.2);
  B(ww + 0.12, 0.03, 0.03, 0, wh * 0.28, 0.2); B(ww + 0.12, 0.03, 0.03, 0, -wh * 0.28, 0.2);
});
const doorFrameG = (dw, dh) => comp(`df${dw},${dh}`, (B) => {
  B(0.09, dh + 0.1, 0.14, -dw / 2 - 0.045, dh / 2 + 0.05, 0.07); B(0.09, dh + 0.1, 0.14, dw / 2 + 0.045, dh / 2 + 0.05, 0.07); B(dw + 0.18, 0.1, 0.16, 0, dh + 0.05, 0.08);
  B(0.05, 0.05, 0.08, dw * 0.36, dh * 0.5, 0.12);
});
const doorLeafG = (dw, dh) => comp(`dl${dw},${dh}`, (B) => {
  B(dw, dh, 0.06, 0, dh / 2, 0.05);
  for (const sx of [-1, 1]) for (const sy of [0.28, 0.72]) B(dw * 0.36, dh * 0.3, 0.025, sx * dw * 0.22, dh * sy, 0.075);
});
const stoopG = (dw, dh, canopy) => comp(`st${dw},${dh},${canopy}`, (B) => {
  B(dw + 0.8, 0.16, 0.6, 0, 0.08, 0.3); B(dw + 0.5, 0.16, 0.3, 0, 0.24, 0.15);
  if (canopy) { B(dw + 1.2, 0.1, 1.0, 0, dh + 0.42, 0.5); for (const s of [-1, 1]) B(0.1, dh + 0.4, 0.1, s * (dw / 2 + 0.5), (dh + 0.4) / 2, 0.92); }
});
const tvAntG = () => comp('tv', (B) => { B(0.04, 2.4, 0.04, 0, 1.2, 0); B(0.03, 0.03, 1.0, 0, 2.3, 0.1); for (let i = 0; i < 6; i++) B(0.03, 0.03, 0.9 - i * 0.1, 0, 2.3 + (i % 2 ? 0.0 : 0), -0.4 + i * 0.17, 0); B(0.8, 0.03, 0.03, 0, 2.3, -0.4); B(0.7, 0.03, 0.03, 0, 1.8, -0.2); B(0.6, 0.03, 0.03, 0, 1.4, -0.2); });
const dishG = () => comp('dish', (B, m) => {
  m.add(cylG(0.36, 0.12, 0.1, 9), mat4(0, 0, 0.1, 0, Math.PI / 2 - 0.35));
  B(0.04, 0.04, 0.5, 0, 0.09, 0.3, 0, -0.25); B(0.07, 0.07, 0.12, 0, 0.17, 0.52);
  B(0.06, 0.3, 0.06, 0, -0.18, 0);
});
const balcSlabG = (bw, dp) => comp(`bs${bw},${dp}`, (B) => { B(bw, 0.16, dp, 0, 0, dp / 2); });
const balcRailG = (bw, dp, rh) => comp(`br${bw},${dp},${rh}`, (B) => { B(bw, rh, 0.07, 0, rh / 2, dp - 0.035); B(0.07, rh, dp, -bw / 2 + 0.035, rh / 2, dp / 2); B(0.07, rh, dp, bw / 2 - 0.035, rh / 2, dp / 2); });
const balcFrameG = (bw, dp, rh, gh) => comp(`bf${bw},${dp},${rh},${gh}`, (B) => { // Verglaste Loggia: Rahmen
  for (const s of [-1, 1]) B(0.05, gh, 0.05, s * (bw / 2 - 0.03), rh + gh / 2, dp - 0.03); B(bw, 0.05, 0.06, 0, rh + gh, dp - 0.03); B(0.04, gh, 0.04, 0, rh + gh / 2, dp - 0.03); B(bw, 0.05, dp, 0, rh + gh + 0.02, dp / 2);
});
const fenceG = (len) => comp(`fe${len}`, (B) => {
  const n = Math.max(2, Math.round(len / 0.22));
  for (let i = 0; i < n; i++) B(0.07, 0.95 - (i % 2) * 0.0, 0.03, -len / 2 + (i + 0.5) * len / n, 0.5, 0);
  B(len, 0.06, 0.05, 0, 0.35, -0.04); B(len, 0.06, 0.05, 0, 0.75, -0.04);
  for (let i = 0; i <= Math.max(1, Math.round(len / 2.5)); i++) B(0.1, 1.05, 0.1, -len / 2 + i * len / Math.max(1, Math.round(len / 2.5)), 0.52, -0.02);
});

// ---- Gebäude: Kontext, Fassaden, Dächer, Zubehör ----
const MODERN_KINDS = new Set(['khrushchyovka', 'panel_high', 'shop', 'kiosk', 'warehouse', 'industrial']);
function bCtx(h, kind) {
  const w = h.w, d = h.d, floors = Math.max(1, Math.round(h.floors || 1));
  let sd = Math.floor(w * 977 + d * 131 + floors * 17 + (h.style | 0) * 7919 + (h.seed || 0)) % 2147483646; if (sd <= 0) sd += 12345;
  const rnd = mkRand(sd); rnd(); rnd(); rnd();
  const g = new THREE.Group();
  return {
    g, h, kind, w, d, floors, style: Math.abs(h.style | 0), rnd, lit: !!h.lit, snow: !!h.snow, modern: h.modern ?? MODERN_KINDS.has(kind),
    faces: [{ ry: 0, cx: 0, cz: d / 2, len: w }, { ry: Math.PI, cx: 0, cz: -d / 2, len: w }, { ry: Math.PI / 2, cx: w / 2, cz: 0, len: d }, { ry: -Math.PI / 2, cx: -w / 2, cz: 0, len: d }],
  };
}
// Teil an einer Fassade platzieren: fi = Seite, u = entlang der Seite, y = Höhe, out = vor der Wand
function fput(c, geo, mat, fi, u, y, out = 0, ry2 = 0, parent = null) {
  const f = c.faces[fi], cs = Math.cos(f.ry), sn = Math.sin(f.ry);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(f.cx + cs * u + sn * out, y, f.cz - sn * u + cs * out);
  m.rotation.y = f.ry + ry2; m.castShadow = true; m.receiveShadow = true;
  (parent || c.g).add(m);
  return m;
}
function glassFor(c) {
  const r = c.rnd();
  if (c.lit && r < 0.4) return c.rnd() < 0.78 ? M.windowLit : pm(0xcfe4ff, 0.3, 0, 0x8fb4e8, 1.1);
  if (r < 0.7) return M.window;
  if (r < 0.8) return pm(0x31404f, 0.15, 0.55);
  if (r < 0.88) return pm(0xc2b9a4, 0.9);
  if (r < 0.93) return pm(0xb48b86, 0.9);
  if (r < 0.97) return pm(0x7d8f86, 0.9);
  return pm(0x2a2f36, 0.2, 0.4);
}
// Fensterreihen. o: faces, fh, ww, wh, sill, bay, margin, v, frame, shut, bars, fl0, fl1, y0, skip(fi,fl,i,n,u)
function facade(c, o) {
  const { fh, ww, wh } = o;
  for (const fi of o.faces) {
    const len = fi < 2 ? c.w : c.d, mg = o.margin ?? 0.9;
    const n = Math.max(1, Math.round((len - 2 * mg) / ((o.baysBy && o.baysBy[fi]) || o.bay))), st = (len - 2 * mg) / n;
    for (let fl = o.fl0 ?? 0; fl < (o.fl1 ?? c.floors); fl++) for (let i = 0; i < n; i++) {
      const u = -len / 2 + mg + (i + 0.5) * st, y = (o.y0 ?? 0) + fl * fh + o.sill + wh / 2;
      if (o.skip && o.skip(fi, fl, i, n, u)) continue;
      fput(c, winG(ww, wh, o.v || 0), o.frame, fi, u, y);
      fput(c, planeG(ww, wh), glassFor(c), fi, u, y, WIN_Z[o.v || 0]);
      if (o.shut && (!o.shutP || c.rnd() < o.shutP)) fput(c, shutG(ww, wh), o.shut, fi, u, y);
      if (o.bars && (fl === 0 || o.barsAll)) fput(c, barsG(ww, wh), pm(0x2b2b2b, 0.6, 0.5), fi, u, y);
      if (o.each) o.each(fi, fl, i, u, y);
    }
  }
}
function door(c, fi, u, o = {}) {
  const dw = o.dw || 1.0, dh = o.dh || 2.15;
  fput(c, doorFrameG(dw, dh), o.frame || pm(0xe6e2d6, 0.7), fi, u, 0);
  fput(c, doorLeafG(dw, dh), o.mat || pm(0x4a3a2c, 0.85), fi, u, 0);
  if (o.stoop !== false) fput(c, stoopG(dw, dh, !!o.canopy), o.stoopMat || M.concrete, fi, u, 0);
}
// Satteldach: First entlang z des lokalen Systems (Spannweite W, Länge D). Liefert Höhe/halbe Breite.
function gableRoof(c, o) {
  const p = o.parent || c.g, { W, D, y, rh } = o, ov = o.over ?? 0.45, ovz = o.overZ ?? 0.4, th = o.th ?? 0.14;
  const half = W / 2 + ov, ls = Math.hypot(half, rh), ang = Math.atan2(rh, half), len = D + 2 * ovz;
  const R = rmat(o.kind || 'tile', o.hex ?? 0xb55a40);
  for (const s of [-1, 1]) add(p, tiledBoxG(+ls.toFixed(3), th, +len.toFixed(3), R.s), R.mat, s * half / 2, y + rh / 2 + 0.04, 0, 0, 0, -s * ang);
  const trim = o.trim || pm(0xcfcbc0, 0.8);
  add(p, boxG(0.3, 0.14, +(len + 0.04).toFixed(3)), o.ridge || pm(0x6b655c, 0.9), 0, y + rh + 0.07, 0);
  if (o.walls !== false) for (const s of [-1, 1]) add(p, gableG(W, rh, o.ws || 4), o.wall, 0, y, s * (D / 2 + 0.01), 0, s > 0 ? 0 : Math.PI, 0);
  const gap = rh * ov / half + 0.16;
  for (const s of [-1, 1]) {
    add(p, boxG(0.3, +gap.toFixed(3), +(D + 0.02).toFixed(3)), o.wall, s * (W / 2 + 0.05), y + gap / 2, 0); // Traufe
    if (o.bargeboards !== false) for (const e of [-1, 1]) add(p, tiledBoxG(+ls.toFixed(3), 0.2, 0.05, 2), trim, s * half / 2, y + rh / 2 - 0.05, e * (len / 2 - 0.02), 0, 0, -s * ang);
    if (o.gutter !== false) {
      add(p, boxG(0.1, 0.09, +len.toFixed(3)), pm(0x9ea4a6, 0.5, 0.6), s * (half - 0.02), y - 0.08, 0);
      add(p, cylG(0.035, 0.035, +(y - 0.3).toFixed(3), 5), pm(0x9ea4a6, 0.5, 0.6), s * (W / 2 + 0.1), (y - 0.1) / 2 + 0.1, s * (D / 2 - 0.25));
    }
  }
  if (c.snow) for (const s of [-1, 1]) add(p, tiledBoxG(+(ls + 0.1).toFixed(3), 0.12, +(len - 0.1).toFixed(3), 3), pm(0xf2f5f8, 1), s * half / 2, y + rh / 2 + 0.15, 0, 0, 0, -s * ang, false);
  return { rh, half, at: (u) => y + rh * (1 - Math.min(1, Math.abs(u) / half)) };
}
function roof(c, o) { // ridgeX: First entlang x
  if (!o.ridgeX) return gableRoof(c, { ...o, W: c.w, D: c.d });
  const rp = new THREE.Group(); rp.rotation.y = Math.PI / 2; c.g.add(rp);
  return gableRoof(c, { ...o, parent: rp, W: c.d, D: c.w });
}
function chimney(c, x, z, y0, y1, o = {}) {
  const sw = o.sw || 0.7, sd = o.sd || sw, mat = o.mat || pm(0x86483a, 0.95);
  box(c.g, sw, y1 - y0, sd, mat, x, (y0 + y1) / 2, z);
  box(c.g, sw + 0.2, 0.14, sd + 0.2, pm(0x777570, 0.9), x, y1 + 0.07, z);
  if (o.pot !== false) { cyl(c.g, 0.11, 0.13, 0.3, pm(0x8a4a38, 0.9), x - sw * 0.2, y1 + 0.28, z, 0, 0, 0, 6); cyl(c.g, 0.11, 0.13, 0.3, pm(0x8a4a38, 0.9), x + sw * 0.2, y1 + 0.28, z, 0, 0, 0, 6); }
}
function tvAnt(c, x, y, z, ry = 0) { const m = add(c.g, tvAntG(), pm(0xb8bcbe, 0.5, 0.7), x, y, z, 0, ry, 0, false); return m; }
function dish(c, x, y, z, ry = 0) { return add(c.g, dishG(), pm(0xe2e2dc, 0.5, 0.3), x, y, z, 0, ry, 0, false); }
function gardenFence(c, z, len, mat) { add(c.g, fenceG(len), mat || pm(0xcfc8b6, 0.9), 0, 0, z, 0, 0, 0, false); }
function baseWall(c, tex, hex, H, s = 4) { return add(c.g, tiledBoxG(c.w, H, c.d, s), wmat(tex, hex), 0, H / 2, 0); }
function plinth(c, hh, mat, grow = 0.12) { add(c.g, boxG(+(c.w + grow).toFixed(3), hh, +(c.d + grow).toFixed(3)), mat || M.concreteDark, 0, hh / 2, 0); }

// ---- Gebäudearten ----
const KINDS = {};
const pick = (a, s) => a[s % a.length];
const TRIM = () => pm(0xf2f0e8, 0.7);
function flatRoof(c, W, D, y, o = {}) { // Flachdach mit Bitumenbahn und Attika
  add(c.g, tiledBoxG(+(W + 0.3).toFixed(3), 0.3, +(D + 0.3).toFixed(3), 4), wmat('bitu', o.hex ?? 0xffffff, 0.95), 0, y + 0.15, 0);
  const ph = o.ph ?? 0.5, pt = 0.18, pm_ = o.pmat || M.concreteDark;
  for (const s of [-1, 1]) { add(c.g, boxG(+(W + 0.3).toFixed(3), ph, pt), pm_, 0, y + 0.3 + ph / 2, s * (D / 2 + 0.06)); add(c.g, boxG(pt, ph, +(D + 0.3).toFixed(3)), pm_, s * (W / 2 + 0.06), y + 0.3 + ph / 2, 0); }
  return y + 0.3;
}
function sub(c, x, y, z, ry = 0) { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; c.g.add(g); return g; }
function ventPipe(c, x, y, z, h = 0.8) { cyl(c.g, 0.14, 0.14, h, pm(0x8c9094, 0.6, 0.5), x, y + h / 2, z, 0, 0, 0, 6); cyl(c.g, 0.22, 0.14, 0.12, pm(0x8c9094, 0.6, 0.5), x, y + h + 0.06, z, 0, 0, 0, 6); }
function acUnit(c, x, y, z) { box(c.g, 0.9, 0.6, 0.45, pm(0xdcdcd6, 0.6), x, y + 0.3, z); cyl(c.g, 0.2, 0.2, 0.04, pm(0x333333, 0.5), x, y + 0.3, z + 0.23, Math.PI / 2, 0, 0, 8); }

KINDS.cottage = (c) => {
  const { w, d, style: s } = c, fh = 2.8, nf = Math.min(2, c.floors), H = nf * fh;
  const hex = pick([0xf1ede2, 0xcfe0e6, 0xeadfae, 0xd6dfc0, 0xe9cdb8], s), acc = pick([0x3c6fa8, 0x4d6b48, 0x2f4f7c, 0x7a4a36], s >> 1);
  const body = baseWall(c, 'plaster', hex, H);
  plinth(c, 0.65, pm(s % 2 ? 0x7b756b : acc, 0.9));
  const doorU = (s % 2 ? -1 : 1) * w * 0.2, trim = TRIM();
  facade(c, { faces: [0, 1, 2, 3], fh, ww: 0.85, wh: 1.15, sill: 0.95, bay: 2.6, v: 0, frame: trim, shut: s % 3 === 0 ? null : pm(acc, 0.8), skip: (fi, fl, i, n, u) => fi === 0 && fl === 0 && Math.abs(u - doorU) < 1.3 });
  door(c, 0, doorU, { mat: pm(acc, 0.8), frame: trim, canopy: true, dw: 0.95 });
  const ridgeX = w >= d * 1.05, span = ridgeX ? d : w, rh = Math.min(2.8, span * 0.38);
  const [rk, rhex] = pick([['tile', 0xb55a40], ['corr', 0x8e9a90], ['seam', 0x62707a], ['tile', 0x8a5a44]], s);
  const R = roof(c, { y: H, rh, ridgeX, kind: rk, hex: rhex, wall: wmat('plaster', hex), trim, over: 0.5, overZ: 0.45 });
  chimney(c, ridgeX ? w * 0.22 : 0, ridgeX ? 0 : -d * 0.2, H, H + rh + 0.9);
  const gf = ridgeX ? 2 : 0; // Giebelseite: Dachbodenfenster
  fput(c, winG(0.6, 0.7, 1), trim, gf, 0, H + rh * 0.36, 0.015); fput(c, planeG(0.6, 0.7), glassFor(c), gf, 0, H + rh * 0.36, 0.07);
  if (c.modern) { dish(c, ridgeX ? -w * 0.3 : w * 0.3, H - 0.7, d / 2 + 0.08); tvAnt(c, ridgeX ? -w * 0.25 : 0, H + rh * 0.9, ridgeX ? 0.4 : -d * 0.1); }
  if (s % 4 >= 2) { // Veranda-Bank und Blumenkasten
    box(c.g, 1.6, 0.06, 0.3, pm(0x7a5a3a), doorU + 1.5, 0.9, d / 2 + 0.2); box(c.g, 1.6, 0.14, 0.2, pm(0x5b7a3a), doorU + 1.5, 1.0, d / 2 + 0.05);
  }
  if (c.h.fence) gardenFence(c, d / 2 + 1.1, w + 1);
  return { height: H + rh + 1, body };
};

KINDS.khrushchyovka = (c) => {
  const { w, d, style: s } = c, fh = 2.9, nf = Math.min(6, Math.max(3, c.floors)), H = nf * fh;
  const hex = pick([0xd2cfc4, 0xd9d1b6, 0xc7cfd0, 0xdcc9a6], s), trim = pm(0xe9e6dc, 0.8);
  const body = baseWall(c, 'panel', hex, H, 3);
  plinth(c, 0.9, pm(0x8d8a83, 0.95), 0.18);
  const ne = Math.max(1, Math.round(w / 9)), eu = []; for (let k = 0; k < ne; k++) eu.push(-w / 2 + (k + 0.5) * w / ne);
  const near = (u) => eu.some((e) => Math.abs(u - e) < 1.6);
  facade(c, { faces: [0, 1], fh, ww: 1.35, wh: 1.4, sill: 0.85, bay: 3, margin: 0, v: 1, frame: trim, skip: (fi, fl, i, n, u) => near(u) });
  facade(c, { faces: [2, 3], fh, ww: 0.9, wh: 1.2, sill: 0.8, bay: 99, margin: 0, v: 1, frame: trim, fl0: 0, skip: (fi, fl) => fl === 0 });
  const acc = pick([0x3d6fa8, 0x4c8a5a, 0xb4513c, 0x6b7076], s >> 1), cols = [0xb9b3a6, 0x5f8a9c, 0xa4553f, 0x6e9a62, 0xd8c46a, 0xe8e6de];
  for (const fi of [0, 1]) for (const e of eu) {
    if (fi === 0) door(c, 0, e, { dw: 1.3, dh: 2.2, canopy: true, mat: pm(0x3d4a44, 0.6, 0.3), frame: pm(0x6d6a63, 0.9) });
    else door(c, 1, e, { dw: 1.1, dh: 2.1, canopy: false, stoop: true, mat: pm(0x3d4a44, 0.6, 0.3), frame: pm(0x6d6a63, 0.9) });
    for (let fl = 1; fl < nf; fl++) { // Treppenhausfenster
      fput(c, winG(0.9, 1.0, 1), trim, fi, e, fl * fh + 0.3); fput(c, planeG(0.9, 1.0), glassFor(c), fi, e, fl * fh + 0.3, WIN_Z[1]);
    }
  }
  // Loggien/Balkone zur Straße
  const n = Math.max(1, Math.round(w / 3)), st = w / n;
  for (let fl = 1; fl < nf; fl++) for (let i = 0; i < n; i++) {
    const u = -w / 2 + (i + 0.5) * st; if (near(u) || i % 3 !== 1) continue;
    const by = fl * fh + 0.06, bw = 2.1, dp = 0.95, rc = pm(pick(cols, Math.floor(c.rnd() * 6)), 0.9);
    fput(c, balcSlabG(bw, dp), M.concrete, 0, u, by, 0); fput(c, balcRailG(bw, dp, 0.95), rc, 0, u, by);
    if ((s + i + fl) % 3 === 0) { fput(c, balcFrameG(bw, dp, 0.95, 1.25), trim, 0, u, by); fput(c, planeG(bw - 0.1, 1.2), pm(0x7d9a96, 0.2, 0.5), 0, u, by + 0.95 + 0.62, dp - 0.04); }
  }
  // Dach: flach mit Attika oder flaches Satteldach (Wellasbest)
  let top;
  if (s % 4 < 2) {
    const ridgeX = w >= d, span = ridgeX ? d : w, rh = Math.max(0.9, span * 0.13);
    const R = roof(c, { y: H, rh, ridgeX, kind: s % 2 ? 'seam' : 'corr', hex: s % 2 ? 0x7c8a8f : 0x93a095, wall: wmat('panel', hex), ws: 3, trim, over: 0.5, overZ: 0.5 });
    top = H + rh;
    for (let k = 0; k < 2; k++) box(c.g, 0.7, 1.1, 0.7, M.concreteDark, (k ? 1 : -1) * w * 0.24 * (ridgeX ? 1 : 0), top + 0.3, (k ? 1 : -1) * d * 0.2 * (ridgeX ? 0 : 1));
  } else {
    top = flatRoof(c, w, d, H, { ph: 0.45 });
    for (let k = 0; k < 3; k++) ventPipe(c, -w * 0.3 + k * w * 0.3, top, -d * 0.2, 1.0);
    box(c.g, 1.6, 1.4, 1.4, M.concreteDark, w * 0.35, top + 0.7, d * 0.2);
  }
  const na = 2 + Math.floor(c.rnd() * 3);
  for (let k = 0; k < na; k++) tvAnt(c, -w * 0.4 + (k + 0.5) * w * 0.8 / na, top - 0.2, (c.rnd() - 0.5) * d * 0.3, c.rnd() * 1.5);
  if (c.modern) for (let k = 0; k < 5; k++) { const fi = c.rnd() < 0.7 ? 0 : 1, fl = Math.floor(c.rnd() * nf), u = -w / 2 + (Math.floor(c.rnd() * n) + 0.0) * st; if (near(u)) continue; fput(c, dishG(), pm(0xe2e2dc, 0.5, 0.3), fi, u, fl * fh + 1.45, 0.04); }
  return { height: top + 1.5, body };
};

KINDS.panel_high = (c) => {
  const { w, d, style: s } = c, fh = 3.0, nf = Math.min(16, Math.max(7, c.floors)), H = nf * fh;
  const hex = pick([0xcdcac0, 0xd8cdb4, 0xbfc7ca, 0xd7c0b0], s), acc = pick([0x3d6fa8, 0xb4513c, 0x4c8a5a, 0x575d63], s >> 1), trim = pm(0xe9e6dc, 0.8);
  const body = baseWall(c, 'panel', hex, H, 3);
  plinth(c, 1.0, pm(0x7e7b74, 0.95), 0.2);
  const ne = Math.max(1, Math.round(w / 12)), eu = []; for (let k = 0; k < ne; k++) eu.push(-w / 2 + (k + 0.5) * w / ne);
  const near = (u) => eu.some((e) => Math.abs(u - e) < 1.7);
  facade(c, { faces: [0, 1], fh, ww: 1.5, wh: 1.5, sill: 0.8, bay: 3, margin: 0, v: 2, frame: trim, skip: (fi, fl, i, n, u) => near(u) });
  facade(c, { faces: [2, 3], fh, ww: 1.0, wh: 1.3, sill: 0.9, bay: 99, margin: 0, v: 2, frame: trim, fl0: 1 });
  const n = Math.max(1, Math.round(w / 3)), st = w / n;
  for (const fi of [0, 1]) for (const e of eu) {
    door(c, fi, e, { dw: 1.6, dh: 2.3, canopy: fi === 0, mat: pm(0x3d4a44, 0.6, 0.3), frame: pm(0x6d6a63, 0.9) });
    fput(c, boxG(0.9, +(H - 2.9).toFixed(2), 0.1), pm(acc, 0.8), fi, e, 2.9 + (H - 2.9) / 2, 0.02); // Farbband über dem Eingang (Treppenhaus)
    for (let fl = 1; fl < nf; fl++) { fput(c, planeG(0.6, 0.9), glassFor(c), fi, e, fl * fh + 0.4, 0.075); }
  }
  for (let fl = 1; fl < nf; fl++) for (let i = 0; i < n; i++) { // verglaste Loggien
    const u = -w / 2 + (i + 0.5) * st; if (near(u) || i % 2 !== 0) continue;
    const by = fl * fh + 0.05, bw = 2.3, dp = 0.9;
    for (const fi of [0, 1]) { if (fi === 1 && i % 4) continue; fput(c, balcSlabG(bw, dp), M.concrete, fi, u, by); fput(c, balcRailG(bw, dp, 0.9), pm(pick([0xb9b3a6, 0x5f8a9c, 0xe8e6de], i + fl), 0.9), fi, u, by); if ((fl + i) % 3) fput(c, planeG(bw - 0.1, 1.3), pm(0x7d9a96, 0.2, 0.5), fi, u, by + 0.9 + 0.65, dp - 0.04); }
  }
  add(c.g, boxG(+(w + 0.1).toFixed(2), 0.9, +(d + 0.1).toFixed(2)), pm(acc, 0.8), 0, H - 0.5, 0); // oberes Farbband
  const top = flatRoof(c, w, d, H, { ph: 0.6 });
  box(c.g, 3.0, 2.0, 2.6, M.concreteDark, -w * 0.2, top + 1.0, 0); box(c.g, 1.8, 1.6, 1.8, M.concreteDark, w * 0.25, top + 0.8, d * 0.15);
  for (let k = 0; k < 4; k++) ventPipe(c, -w * 0.4 + k * 1.2, top, d * 0.3, 0.9);
  cyl(c.g, 0.05, 0.05, 6, pm(0xb8bcbe, 0.5, 0.7), w * 0.4, top + 3, -d * 0.3, 0, 0, 0, 5);
  if (nf > 10) box(c.g, 0.25, 0.25, 0.25, pm(0xff3020, 0.5, 0, 0xff2010, 2.5), w * 0.4, top + 6.1, -d * 0.3);
  if (c.modern) for (let k = 0; k < Math.min(8, nf); k++) { const fi = c.rnd() < 0.6 ? 0 : 1, fl = 1 + Math.floor(c.rnd() * (nf - 1)); const u = -w / 2 + (Math.floor(c.rnd() * n)) * st; if (near(u)) continue; fput(c, dishG(), pm(0xe2e2dc, 0.5, 0.3), fi, u, fl * fh + 1.3, 0.04); }
  return { height: top + 3, body };
};

KINDS.shop = (c) => {
  const { w, d, style: s } = c, nf = Math.min(2, c.floors), H = 3.6 + (nf - 1) * 3.0, trim = TRIM();
  const tex = s % 3 === 0 ? ['brick', 0xffffff] : s % 3 === 1 ? ['plaster', 0xe5d5b2] : ['plaster', 0xcfd5d3];
  const body = baseWall(c, tex[0], tex[1], H, tex[0] === 'brick' ? 2 : 4);
  plinth(c, 0.5, M.concreteDark, 0.14);
  const sign = pick([0xb53a30, 0x2f5c9a, 0xe0b030, 0x3d7a4a], s);
  const gw = w - 2.6, gx = -0.7; // Schaufenster
  fput(c, planeG(gw, 2.1), M.window, 0, gx, 1.65, 0.06);
  fput(c, comp(`sf${gw}`, (B) => { B(gw + 0.2, 0.1, 0.14, 0, 1.1, 0.07); B(gw + 0.2, 0.1, 0.14, 0, -1.05, 0.07); B(0.1, 2.2, 0.14, -gw / 2 - 0.05, 0, 0.07); B(0.1, 2.2, 0.14, gw / 2 + 0.05, 0, 0.07); for (let k = 1; k < Math.round(gw / 1.6); k++) B(0.07, 2.1, 0.1, -gw / 2 + k * gw / Math.round(gw / 1.6), 0, 0.07); }), pm(0x555a5e, 0.5, 0.6), 0, gx, 1.6);
  door(c, 0, w / 2 - 1.0, { dw: 1.1, dh: 2.2, mat: pm(0x2b3a44, 0.2, 0.5), frame: pm(0x555a5e, 0.5, 0.6), canopy: false });
  fput(c, boxG(+(w - 0.4).toFixed(2), 0.8, 0.22), pm(sign, 0.7, 0, c.lit ? sign : 0, 0.8), 0, 0, 3.15, 0.1); // Schild
  const nst = Math.max(4, Math.round(gw / 0.8)); // gestreifte Markise
  for (let k = 0; k < nst; k++) { const u = gx - gw / 2 + (k + 0.5) * gw / nst; fput(c, boxG(+(gw / nst).toFixed(3), 0.05, 1.0), pm(k % 2 ? 0xf0ece0 : sign, 0.9), 0, u, 2.82, 0.5, 0).rotation.x = 0.22; }
  facade(c, { faces: [1, 2, 3], fh: 3.0, ww: 0.9, wh: 0.8, sill: 1.9, bay: 3.2, v: 1, frame: trim, fl0: 0, fl1: 1 });
  if (nf > 1) facade(c, { faces: [0, 1, 2, 3], fh: 3.0, ww: 1.0, wh: 1.35, sill: 0.9, y0: 3.6 - 3.0 + 0.0, bay: 2.8, v: 0, frame: trim, fl0: 1, fl1: nf });
  door(c, 1, -w * 0.25, { dw: 1.2, dh: 2.2, mat: pm(0x56616a, 0.6, 0.4), frame: pm(0x6d6a63, 0.9), canopy: false, stoop: true });
  const top = flatRoof(c, w, d, H, { ph: 0.5 });
  acUnit(c, -w * 0.3, top, -d * 0.2); acUnit(c, -w * 0.1, top, -d * 0.2);
  if (s % 2) { box(c.g, w * 0.5, 1.0, 0.12, pm(sign, 0.7, 0, c.lit ? sign : 0, 0.8), 0, top + 1.4, d / 2 - 0.3); for (const k of [-1, 1]) box(c.g, 0.08, 0.9, 0.08, pm(0x555a5e, 0.5, 0.6), k * w * 0.22, top + 0.7, d / 2 - 0.3); }
  if (c.modern) dish(c, w * 0.3, top + 0.2, d * 0.1, 0);
  return { height: top + 1.5, body };
};

KINDS.kiosk = (c) => {
  const { w, d, style: s } = c, H = 2.6, col = pick([0x3f6f5a, 0x2f5c9a, 0xb5442f, 0xc9a43a], s);
  add(c.g, boxG(+(w + 0.3).toFixed(2), 0.12, +(d + 0.3).toFixed(2)), M.concrete, 0, 0.06, 0, 0, 0, 0, false);
  const body = add(c.g, tiledBoxG(w, H, d, 2), wmat('corr', col, 0.55, 0.3), 0, 0.12 + H / 2, 0);
  const trim = pm(0xe6e2d6, 0.7);
  fput(c, planeG(w * 0.62, 0.95), M.window, 0, 0, 1.65, 0.04);
  fput(c, comp(`kw${w}`, (B) => { const ww = w * 0.62; B(ww + 0.16, 0.08, 0.1, 0, 0.52, 0.05); B(ww + 0.16, 0.08, 0.1, 0, -0.52, 0.05); B(0.08, 1.1, 0.1, -ww / 2 - 0.04, 0, 0.05); B(0.08, 1.1, 0.1, ww / 2 + 0.04, 0, 0.05); }), trim, 0, 0, 1.65);
  fput(c, boxG(+(w * 0.7).toFixed(2), 0.06, 0.4), pm(0x7a5a3a), 0, 0, 1.12, 0.2); // Ablage
  for (let k = 0; k < 6; k++) fput(c, boxG(+(w * 0.7 / 6).toFixed(3), 0.05, 0.95), pm(k % 2 ? 0xf0ece0 : col, 0.9), 0, -w * 0.35 + (k + 0.5) * w * 0.7 / 6, 2.5, 0.45).rotation.x = 0.35;
  fput(c, boxG(+(w * 0.8).toFixed(2), 0.5, 0.1), pm(0xf2efe6, 0.5, 0, c.lit ? 0xffe9b0 : 0, 0.9), 0, 0, 2.95, 0.05);
  door(c, 2, 0, { dw: 0.8, dh: 1.9, mat: pm(0x56616a, 0.6, 0.4), frame: trim, canopy: false, stoop: true });
  add(c.g, tiledBoxG(+(w + 0.4).toFixed(2), 0.12, +(d + 0.4).toFixed(2), 2), wmat('seam', 0x6a6e70, 0.5, 0.4), 0, 0.12 + H + 0.06, 0, 0.04, 0, 0);
  if (c.modern) tvAnt(c, -w * 0.3, H + 0.2, -d * 0.1);
  return { height: H + 1.2, body };
};

function hallWalls(c, H, tex, hex, s) { return add(c.g, tiledBoxG(c.w, H, c.d, s), wmat(tex, hex, tex === 'corr' ? 0.6 : 0.92, tex === 'corr' ? 0.25 : 0), 0, H / 2, 0); }
KINDS.warehouse = (c) => {
  const { w, d, style: s } = c, H = 5.0 + (c.floors - 1) * 1.8, hex = pick([0xaab2aa, 0x9aa6a8, 0x8f9c8c, 0xb4a89a], s);
  const body = hallWalls(c, H, 'corr', hex, 2);
  add(c.g, boxG(+(w + 0.16).toFixed(2), 1.1, +(d + 0.16).toFixed(2)), M.concrete, 0, 0.55, 0);
  const trim = pm(0xc9c6bc, 0.8), ridgeX = w >= d, span = ridgeX ? d : w, rh = Math.max(1.0, span * 0.12);
  roof(c, { y: H, rh, ridgeX, kind: 'corr', hex: pick([0x8f9892, 0x8a6a55, 0x7d8a84, 0x9a9a90], s >> 1), wall: wmat('corr', hex, 0.6, 0.25), ws: 2, trim, over: 0.35, overZ: 0.35 });
  // Lichtband am First, Lüfter
  const lg = ridgeX ? w - 3 : d - 3;
  add(c.g, boxG(ridgeX ? lg : 0.7, 0.5, ridgeX ? 0.7 : lg), pm(0x7a96a5, 0.3, 0.5), 0, H + rh + 0.25, 0);
  for (let k = 0; k < 3; k++) { const p = (k - 1) * (ridgeX ? w : d) * 0.28; ventPipe(c, ridgeX ? p : 0, H + rh * 0.5, ridgeX ? 0 : p, 0.6); }
  // Tore und Fensterband
  const ng = Math.max(1, Math.round(w / 8));
  for (let k = 0; k < ng; k++) {
    const u = -w / 2 + (k + 0.5) * w / ng - (k === ng - 1 ? 0 : 0);
    if (k === 0 && ng > 1) { door(c, 0, u, { dw: 1.1, dh: 2.2, mat: pm(0x56616a, 0.6, 0.4), frame: pm(0x6d6a63, 0.9), canopy: false }); continue; }
    fput(c, comp(`rd`, (B) => { B(3.5, 3.7, 0.12, 0, 1.85, 0.06); for (let i = 1; i < 9; i++) B(3.5, 0.04, 0.04, 0, i * 0.4, 0.14); B(3.9, 0.2, 0.2, 0, 3.8, 0.1); B(0.2, 3.7, 0.2, -1.85, 1.85, 0.1); B(0.2, 3.7, 0.2, 1.85, 1.85, 0.1); }), pm(pick([0x6e7f74, 0x7a6a55, 0x55657a], s + k), 0.6, 0.3), 0, u, 0.15);
    fput(c, boxG(4.6, 0.5, 0.6), M.concreteDark, 0, u, 0.25, 0.32); // Rampe/Prellbock
  }
  for (const fi of [0, 1, 2, 3]) { const len = fi < 2 ? w : d; fput(c, planeG(len - 3, 0.9), M.window, fi, 0, H - 1.5, 0.04); fput(c, comp(`rb${len}`, (B) => { B(len - 2.8, 0.06, 0.1, 0, 0.47, 0.05); B(len - 2.8, 0.06, 0.1, 0, -0.47, 0.05); for (let k = 0; k <= Math.round((len - 3) / 3); k++) B(0.06, 0.9, 0.1, -(len - 3) / 2 + k * (len - 3) / Math.round((len - 3) / 3), 0, 0.05); }), trim, fi, 0, H - 1.5); }
  for (const fi of [0, 1]) fput(c, boxG(0.3, 0.2, 0.3), pm(0xfff1c0, 0.3, 0, c.lit ? 0xffd890 : 0, 1.5), fi, -w * 0.4, H - 0.4, 0.2);
  cyl(c.g, 0.1, 0.1, H - 1.4, pm(0x7a8084, 0.5, 0.6), w / 2 + 0.2, (H - 1.4) / 2 + 0.7, -d * 0.3, 0, 0, 0, 6);
  if (s % 2) { cyl(c.g, 1.0, 1.0, 4.2, pm(0xa6abaf, 0.5, 0.6), -w / 2 - 0.9, 2.1, -d * 0.2, 0, 0, 0, 12); cyl(c.g, 1.0, 0.1, 0.5, pm(0xa6abaf, 0.5, 0.6), -w / 2 - 0.9, 4.45, -d * 0.2, 0, 0, 0, 12); }
  return { height: H + rh + 1, body };
};

KINDS.industrial = (c) => {
  const { w, d, style: s } = c, H = 7.0 + (c.floors > 1 ? 1.5 : 0), brickHex = pick([0xffffff, 0xe0cdb8, 0xd0b090, 0xc4a898], s);
  const wallMat = wmat('brick', brickHex);
  const body = add(c.g, tiledBoxG(w, H, d, 2), wallMat, 0, H / 2, 0);
  add(c.g, boxG(+(w + 0.2).toFixed(2), 0.9, +(d + 0.2).toFixed(2)), M.concreteDark, 0, 0.45, 0);
  const trim = pm(0xb9b5a8, 0.85), frame = pm(0x4a4f52, 0.6, 0.4);
  // Pilaster und Gesims
  for (const fi of [0, 1]) { const n = Math.max(2, Math.round(w / 3.6)); for (let k = 0; k <= n; k++) fput(c, tiledBoxG(0.55, H, 0.28, 2), wallMat, fi, -w / 2 + k * w / n, H / 2, 0.14); }
  for (const fi of [2, 3]) { const n = Math.max(2, Math.round(d / 3.6)); for (let k = 0; k <= n; k++) fput(c, tiledBoxG(0.55, H, 0.28, 2), wallMat, fi, -d / 2 + k * d / n, H / 2, 0.14); }
  add(c.g, boxG(+(w + 0.5).toFixed(2), 0.4, +(d + 0.5).toFixed(2)), M.concrete, 0, H + 0.2, 0);
  facade(c, { faces: [0, 1, 2, 3], fh: 4.2, ww: 1.5, wh: 2.6, sill: 2.2, bay: 3.6, margin: 1.2, v: 3, frame, fl0: 0, fl1: 1, skip: (fi, fl, i, n, u) => fi === 0 && Math.abs(u) < 2.6 });
  if (c.floors > 1) facade(c, { faces: [0, 1, 2, 3], fh: 4.2, ww: 1.5, wh: 1.2, sill: 0.7, y0: 0.7, bay: 3.6, margin: 1.2, v: 3, frame, fl0: 0, fl1: 1, skip: (fi, fl, i, n, u) => fi === 0 && Math.abs(u) < 2.6 });
  fput(c, comp('ig', (B) => { B(4.0, 4.3, 0.14, 0, 2.15, 0.07); for (let i = 1; i < 11; i++) B(4.0, 0.04, 0.05, 0, i * 0.39, 0.16); B(4.5, 0.25, 0.25, 0, 4.4, 0.1); B(0.25, 4.3, 0.25, -2.1, 2.15, 0.1); B(0.25, 4.3, 0.25, 2.1, 2.15, 0.1); }), pm(0x5d6a62, 0.6, 0.3), 0, 0, 0.9);
  // Sheddach: Zähne entlang x, Glasfront nach +x
  const nt = Math.max(2, Math.round(w / 5)), tw = w / nt, th = Math.min(2.6, tw * 0.55);
  const R = rmat('seam', 0x7e8588), ang = Math.atan2(th, tw), sl = Math.hypot(tw, th);
  for (let k = 0; k < nt; k++) {
    const x0 = -w / 2 + k * tw;
    add(c.g, tiledBoxG(+(sl + 0.2).toFixed(3), 0.12, +(d + 0.3).toFixed(3), R.s), R.mat, x0 + tw / 2, H + 0.4 + th / 2, 0, 0, 0, ang);
    add(c.g, triG2(tw, th, false), wallMat, x0, H + 0.4, d / 2 + 0.01);
    add(c.g, triG2(tw, th, true), wallMat, x0 + tw, H + 0.4, -d / 2 - 0.01, 0, Math.PI, 0);
    fput(c, planeG(+(d - 1).toFixed(2), +(th * 0.85).toFixed(2)), pm(0x7a96a5, 0.25, 0.5), 2, 0, H + 0.4 + th * 0.45, 0, 0).position.set(x0 + tw + 0.02, H + 0.4 + th * 0.45, 0);
    for (let m = 0; m <= Math.round(d / 3); m++) add(c.g, boxG(0.06, +(th * 0.85).toFixed(2), 0.1), frame, x0 + tw + 0.04, H + 0.4 + th * 0.45, -d / 2 + 0.5 + m * (d - 1) / Math.round(d / 3));
  }
  // Schornstein
  const hc = 15 + c.floors * 2.5 + (s % 3) * 2, cx = w / 2 - 1.9, cz = -d / 2 + 1.9, chm = pm(0x7a4234, 0.95);
  cyl(c.g, 0.55, 0.95, hc, chm, cx, hc / 2, cz, 0, 0, 0, 10);
  for (const f of [0.35, 0.7, 0.95]) cyl(c.g, 0.58 + (1 - f) * 0.4, 0.58 + (1 - f) * 0.4, 0.16, pm(0x3d3a37, 0.6, 0.6), cx, hc * f, cz, 0, 0, 0, 10);
  cyl(c.g, 0.62, 0.52, 0.5, pm(0x3a3835, 0.8), cx, hc + 0.2, cz, 0, 0, 0, 10);
  box(c.g, 0.1, 0.1, 1.2, pm(0x55585a, 0.5, 0.7), cx + 0.5, hc * 0.5, cz, 0, 0, 0);
  // Rohre, Tank
  cyl(c.g, 0.2, 0.2, d * 0.5, pm(0x7a6a58, 0.5, 0.6), -w / 2 - 0.3, 3.6, 0, Math.PI / 2, 0, 0, 8);
  cyl(c.g, 0.16, 0.16, 3.6, pm(0x7a6a58, 0.5, 0.6), -w / 2 - 0.3, 1.8, d * 0.25, 0, 0, 0, 8);
  cyl(c.g, 1.1, 1.1, 4.6, pm(0x8c9094, 0.5, 0.7), -w / 2 - 1.0, 2.3, -d * 0.3, 0, 0, 0, 12);
  return { height: hc + 1, body };
};
function triG2(w, h, mir) { // Sheddach-Giebel: rechtwinkliges Dreieck, Spitze rechts (mir: links)
  return _bgk(`t2${w},${h},${mir}`, () => {
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(w, 0); if (mir) sh.lineTo(0, h); else sh.lineTo(w, h); sh.closePath();
    const g = new THREE.ShapeGeometry(sh); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2, uv.getY(i) / 2);
    return g;
  });
}

const wput = (c, geo, mat, x, y, z, ry = 0, parent = null) => add(parent || c.g, geo, mat, x, y, z, 0, ry, 0, false);
function cross(c, x, y, z, h = 1.4, mat = null) { // orthodoxes Kreuz
  const m = mat || pm(0xd9ac2f, 0.35, 0.8);
  box(c.g, 0.08, h, 0.08, m, x, y + h / 2, z); box(c.g, 0.6, 0.07, 0.07, m, x, y + h * 0.7, z); box(c.g, 0.4, 0.07, 0.07, m, x, y + h * 0.9, z); box(c.g, 0.4, 0.07, 0.07, m, x, y + h * 0.3, z, 0, 0, 0.35);
}
function dome(c, x, y, z, r, mat, drum = 1.0) { // Tambour + Zwiebelkuppel + Kreuz
  cyl(c.g, r * 0.62, r * 0.7, drum, pm(0xf4f0e6, 0.8), x, y + drum / 2, z, 0, 0, 0, 10);
  add(c.g, onionG(+r.toFixed(2), +(r * 1.85).toFixed(2)), mat, x, y + drum, z);
  cross(c, x, y + drum + r * 1.85, z, r * 1.5);
}

KINDS.church_orthodox = (c) => {
  const { w, d, style: s } = c;
  const hex = pick([0xf1ede2, 0xe9dfb8, 0xf4f0e6, 0xdfe6ea], s), wall = wmat('plaster', hex), trim = pm(0xfaf8f0, 0.7), dark = pm(0x1f1a17, 0.4, 0.2);
  const domeMat = pm(pick([0xd9ac2f, 0x2f5c9a, 0x3d7a4a, 0xc4c8cc], s), 0.3, 0.8), roofHex = pick([0x3f6b4f, 0x4a6f9a, 0x6b6f72, 0x3f6b4f], s);
  const tw = Math.min(w * 0.5, 4.6), tzc = d / 2 - tw / 2, nw = w * 0.74, ra = nw * 0.34, zN0 = -d / 2 + ra, zN1 = d / 2 - tw, nd = zN1 - zN0, zc = (zN0 + zN1) / 2;
  const Hn = 7.0 + Math.min(3, c.floors) * 0.6, Ht = Hn + 6.2, Ha = Hn * 0.72;
  const body = add(c.g, tiledBoxG(+nw.toFixed(2), Hn, +nd.toFixed(2), 4), wall, 0, Hn / 2, zc);
  add(c.g, boxG(+(nw + 0.24).toFixed(2), 0.8, +(nd + 0.24).toFixed(2)), M.concrete, 0, 0.4, zc);
  add(c.g, tiledBoxG(tw, Ht, tw, 4), wall, 0, Ht / 2, tzc); add(c.g, boxG(+(tw + 0.24).toFixed(2), 0.8, +(tw + 0.24).toFixed(2)), M.concrete, 0, 0.4, tzc);
  cyl(c.g, ra, ra, Ha, hex ? wmat('plaster', hex) : wall, 0, Ha / 2, zN0, 0, 0, 0, 12);
  cyl(c.g, 0.2, ra * 1.12, 2.4, pm(roofHex, 0.5, 0.4), 0, Ha + 1.2, zN0, 0, 0, 0, 12); cross(c, 0, Ha + 2.4, zN0, 1.2);
  const rg = sub(c, 0, 0, zc), rh = nw * 0.2;
  gableRoof(c, { parent: rg, W: nw, D: nd, y: Hn, rh, kind: 'seam', hex: roofHex, wall, ws: 4, trim, over: 0.5, overZ: 0.45 });
  const rd = nw * 0.24, y0 = Hn + rh * 0.35;
  dome(c, 0, y0, zc, rd * 1.25, domeMat, rh * 0.65 + 3.0);
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; wput(c, archPlaneG(0.5, 1.5), dark, Math.sin(a) * (rd * 0.7 * 1.25 + 0.02), y0 + (rh * 0.65 + 3.0) * 0.7, zc + Math.cos(a) * (rd * 0.7 * 1.25 + 0.02), a); }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) dome(c, sx * nw * 0.34, Hn + rh * 0.3, zc + sz * nd * 0.3, 0.75, domeMat, 1.2);
  // Glockenturm
  add(c.g, boxG(+(tw + 0.3).toFixed(2), 0.3, +(tw + 0.3).toFixed(2)), M.concrete, 0, Ht + 0.15, tzc);
  dome(c, 0, Ht + 0.3, tzc, tw * 0.36, domeMat, 1.6);
  for (const [px, pz, ry] of [[0, tzc + tw / 2 + 0.03, 0], [0, tzc - tw / 2 - 0.03, Math.PI], [tw / 2 + 0.03, tzc, Math.PI / 2], [-tw / 2 - 0.03, tzc, -Math.PI / 2]]) {
    wput(c, archPlaneG(1.0, 2.2), dark, px, Ht - 1.8, pz, ry); wput(c, archPlaneG(1.4, 2.6), trim, px, Ht - 1.7, pz - 0.0, ry).position.add(new THREE.Vector3(Math.sin(ry) * -0.01, 0, Math.cos(ry) * -0.01));
  }
  // Fenster
  const nwin = Math.max(2, Math.round(nd / 3.4));
  for (const sx of [-1, 1]) for (let k = 0; k < nwin; k++) { const z = zN0 + (k + 0.5) * nd / nwin; wput(c, archPlaneG(1.3, 2.8), trim, sx * (nw / 2 + 0.015), 4.2, z, sx * Math.PI / 2); wput(c, archPlaneG(0.9, 2.4), c.lit && c.rnd() < 0.5 ? M.windowLit : M.window, sx * (nw / 2 + 0.03), 4.1, z, sx * Math.PI / 2); }
  for (const a of [-0.75, 0, 0.75]) { wput(c, archPlaneG(0.8, 1.9), M.window, Math.sin(a) * (ra + 0.02), 3.2, zN0 - Math.cos(a) * (ra + 0.02), Math.PI - a); }
  // Portal
  wput(c, archPlaneG(2.4, 3.6), trim, 0, 1.8, d / 2 + 0.03, 0); wput(c, archPlaneG(1.7, 2.9), pm(0x4a3a2c, 0.85), 0, 1.45, d / 2 + 0.05, 0);
  add(c.g, boxG(3.0, 0.2, 1.3), M.concrete, 0, 0.1, d / 2 + 0.4); add(c.g, boxG(2.8, 0.14, 1.2), pm(roofHex, 0.5, 0.4), 0, 4.05, d / 2 + 0.55, 0.0);
  for (const sx of [-1, 1]) add(c.g, boxG(0.16, 3.9, 0.16), trim, sx * 1.35, 2.0, d / 2 + 1.0);
  return { height: Ht + tw * 0.36 * 1.85 + 3.5, body };
};

KINDS.church_west = (c) => {
  const { w, d, style: s } = c;
  const hex = pick([0xd4cdbd, 0xbdb7a8, 0xcbbfa6, 0xa9a79f], s), wall = wmat('stone', hex), H = Math.max(6.8, c.floors * 3.0 + 0.5), stoneT = pm(0xddd6c6, 0.9), dark = pm(0x201a16, 0.4, 0.2);
  const cd = d * 0.22, cw = w * 0.6, Hc = H - 1.3, nd = d - cd, tw = w * 0.62, Ht = H + 6.5, tz = d / 2 - tw / 2 + 0.04;
  const body = add(c.g, tiledBoxG(w, H, +nd.toFixed(2), 3), wall, 0, H / 2, cd / 2);
  add(c.g, tiledBoxG(+cw.toFixed(2), Hc, +(cd + 0.3).toFixed(2), 3), wall, 0, Hc / 2, -d / 2 + cd / 2);
  add(c.g, tiledBoxG(+tw.toFixed(2), Ht, +tw.toFixed(2), 3), wall, 0, Ht / 2, tz);
  add(c.g, boxG(+(w + 0.2).toFixed(2), 0.7, +(nd + 0.2).toFixed(2)), M.concreteDark, 0, 0.35, cd / 2);
  const slate = pick([0x4c5258, 0x565c62, 0x6a4a40, 0x4a4f55], s >> 1), nr = sub(c, 0, 0, cd / 2), cr = sub(c, 0, 0, -d / 2 + cd / 2 + 0.0);
  gableRoof(c, { parent: nr, W: w, D: nd, y: H, rh: w * 0.55, kind: s % 4 === 2 ? 'tile' : 'slate', hex: s % 4 === 2 ? 0x9a5a44 : slate, wall, ws: 3, trim: stoneT, over: 0.3, overZ: 0.3 });
  gableRoof(c, { parent: cr, W: cw, D: cd + 0.3, y: Hc, rh: cw * 0.5, kind: 'slate', hex: slate, wall, ws: 3, trim: stoneT, over: 0.25, overZ: 0.25 });
  // Turm: Gesims, Schallöffnungen, Uhr, Spitzhelm
  add(c.g, boxG(+(tw + 0.3).toFixed(2), 0.3, +(tw + 0.3).toFixed(2)), stoneT, 0, Ht + 0.15, tz);
  const hs = tw * 1.7; add(c.g, cylG(0, +(tw * 0.5 * 1.414).toFixed(3), +hs.toFixed(2), 4), pm(slate, 0.7, 0.1), 0, Ht + 0.3 + hs / 2, tz, 0, Math.PI / 4, 0);
  box(c.g, 0.08, 1.4, 0.08, pm(0xd9ac2f, 0.35, 0.8), 0, Ht + 0.3 + hs + 0.6, tz); box(c.g, 0.6, 0.07, 0.07, pm(0xd9ac2f, 0.35, 0.8), 0, Ht + 0.3 + hs + 0.9, tz);
  for (const [px, pz, ry] of [[0, tz + tw / 2 + 0.03, 0], [0, tz - tw / 2 - 0.03, Math.PI], [tw / 2 + 0.03, tz, Math.PI / 2], [-tw / 2 - 0.03, tz, -Math.PI / 2]]) {
    for (const k of [-1, 1]) { const ox = Math.cos(ry) * k * tw * 0.2, oz = -Math.sin(ry) * k * tw * 0.2; wput(c, gothG(0.8, 2.4), dark, px + ox, Ht - 1.9, pz + oz, ry); wput(c, gothG(1.1, 2.8), stoneT, px + ox - Math.sin(ry) * 0.01, Ht - 1.8, pz + oz - Math.cos(ry) * 0.01, ry); }
  }
  const cy = Ht - 5.2, cz = tz + tw / 2 + 0.05;
  cyl(c.g, 0.86, 0.86, 0.08, dark, 0, cy, cz, Math.PI / 2, 0, 0, 14); cyl(c.g, 0.72, 0.72, 0.1, pm(0xf0ece0, 0.5), 0, cy, cz + 0.01, Math.PI / 2, 0, 0, 14);
  box(c.g, 0.05, 0.5, 0.04, dark, 0, cy + 0.2, cz + 0.07); box(c.g, 0.4, 0.05, 0.04, dark, 0.15, cy, cz + 0.07);
  // Portal und Rosette
  wput(c, gothG(2.5, 4.0), stoneT, 0, 2.0, d / 2 + 0.03, 0); wput(c, gothG(1.8, 3.3), pm(0x4a3a2c, 0.85), 0, 1.65, d / 2 + 0.05, 0);
  add(c.g, boxG(3.0, 0.2, 1.2), M.concrete, 0, 0.1, d / 2 + 0.4);
  cyl(c.g, 0.95, 0.95, 0.08, stoneT, 0, H - 1.0, cz, Math.PI / 2, 0, 0, 14); cyl(c.g, 0.75, 0.75, 0.1, c.lit ? M.windowLit : M.window, 0, H - 1.0, cz + 0.01, Math.PI / 2, 0, 0, 14);
  // Strebepfeiler + Spitzbogenfenster
  const nb = Math.max(2, Math.floor((nd - tw) / 4.2));
  for (let k = 0; k < nb; k++) {
    const z = -d / 2 + cd + 1.2 + (k + 0.5) * (nd - tw - 1.2) / nb;
    for (const sx of [-1, 1]) {
      add(c.g, tiledBoxG(0.55, +(H * 0.85).toFixed(2), 0.9, 3), wall, sx * (w / 2 + 0.27), H * 0.425, z + 1.9); add(c.g, tiledBoxG(0.4, +(H * 0.5).toFixed(2), 0.8, 3), wall, sx * (w / 2 + 0.6), H * 0.25, z + 1.9);
      const wz = z - 0.2; wput(c, gothG(1.5, 3.4), stoneT, sx * (w / 2 + 0.015), 4.3, wz, sx * Math.PI / 2); wput(c, gothG(1.1, 3.0), c.lit && c.rnd() < 0.6 ? M.windowLit : pm(pick([0x1b2a44, 0x26364a, 0x3a2a44], k + s), 0.2, 0.5), sx * (w / 2 + 0.035), 4.2, wz, sx * Math.PI / 2);
      wput(c, boxG(0.05, 2.8, 0.06), stoneT, sx * (w / 2 + 0.05), 4.0, wz, 0);
    }
  }
  for (const k of [-1, 0, 1]) { wput(c, gothG(1.2, 2.8), stoneT, k * cw * 0.3, 3.4, -d / 2 - 0.17, Math.PI); wput(c, gothG(0.8, 2.4), M.window, k * cw * 0.3, 3.3, -d / 2 - 0.19, Math.PI); }
  box(c.g, 0.08, 1.2, 0.08, stoneT, 0, H + w * 0.55 + 0.6, -d / 2 + cd + 0.2); box(c.g, 0.5, 0.07, 0.07, stoneT, 0, H + w * 0.55 + 0.9, -d / 2 + cd + 0.2);
  return { height: Ht + hs + 2, body };
};

function dormer(c, x, z0, yBase, wallMat, trim, kind, hex) {
  const g = sub(c, x, 0, z0 - 0.5);
  add(g, tiledBoxG(1.3, 1.3, 1.0, 3), wallMat, 0, yBase + 0.65, 0);
  add(g, winG(0.6, 0.8, 1), trim, 0, yBase + 0.65, 0.5, 0, 0, 0, false); add(g, planeG(0.6, 0.8), glassFor(c), 0, yBase + 0.65, 0.55, 0, 0, 0, false);
  gableRoof(c, { parent: g, W: 1.3, D: 1.0, y: yBase + 1.3, rh: 0.6, kind, hex, wall: wallMat, ws: 3, trim, over: 0.15, overZ: 0.2, gutter: false, bargeboards: false });
}

KINDS.farmhouse_eu = (c) => {
  const { w, d, style: s } = c, fh = 2.8, nf = Math.min(2, c.floors), H = nf * fh + 0.4;
  const hex = pick([0xd2bf9c, 0xbab6a6, 0xd6c8a8, 0xc2ab8c], s), stone = wmat('stone', hex), trim = pm(0xe4dece, 0.85), shut = pm(pick([0x8fa3ae, 0xf0eee6, 0x5f7a5a, 0x6a7f94], s >> 1), 0.8);
  const body = add(c.g, tiledBoxG(w, H, d, 3), stone, 0, H / 2, 0);
  add(c.g, boxG(+(w + 0.12).toFixed(2), 0.45, +(d + 0.12).toFixed(2)), pm(0x8f8a7c, 0.95), 0, 0.225, 0);
  const doorU = s % 2 ? 0 : -w * 0.18;
  facade(c, { faces: [0, 1, 2, 3], fh, ww: 0.95, wh: 1.3, sill: 0.9, y0: 0.2, bay: 2.8, v: 0, frame: trim, shut, shutP: 0.9, skip: (fi, fl, i, n, u) => fi === 0 && fl === 0 && Math.abs(u - doorU) < 1.4 });
  door(c, 0, doorU, { dw: 1.1, dh: 2.2, mat: pm(0x5a4030, 0.85), frame: trim, canopy: false });
  fput(c, boxG(1.7, 0.3, 0.28), trim, 0, doorU, 2.4, 0.1);
  const ridgeX = w >= d, span = ridgeX ? d : w, rh = span * 0.55;
  const [rk, rhex] = pick([['slate', 0x565c62], ['tile', 0xa05a44], ['slate', 0x4a5056], ['tile', 0x8a5a48]], s);
  const R = roof(c, { y: H, rh, ridgeX, kind: rk, hex: rhex, wall: stone, ws: 3, trim, over: 0.4, overZ: 0.3 });
  for (const sg of [-1, 1]) chimney(c, ridgeX ? sg * (w / 2 - 0.5) : 0, ridgeX ? 0 : sg * (d / 2 - 0.5), H - 0.2, H + rh + 0.8, { sw: 0.9, sd: 0.8, mat: stone, pot: true });
  if (ridgeX) for (const sg of [-1, 1]) dormer(c, sg * w * 0.22, d / 2 - 0.9, R.at(d / 2 - 0.9) - 0.25, stone, trim, rk, rhex);
  if (nf === 2 && s % 4 === 3) { // Fachwerk im Obergeschoss
    const tb = pm(0x3a2a1e, 0.9);
    for (const fi of [0, 1]) { const len = w, n = Math.round(len / 1.3); for (let k = 0; k <= n; k++) fput(c, boxG(0.14, fh - 0.1, 0.1), tb, fi, -len / 2 + k * len / n, fh + fh / 2 + 0.4, 0.02); fput(c, boxG(+len.toFixed(2), 0.16, 0.12), tb, fi, 0, fh + 0.4, 0.03); }
  }
  if (c.h.fence) gardenFence(c, d / 2 + 1.1, w + 1, pm(0xb5ad9a, 0.95));
  return { height: H + rh + 1.2, body };
};

KINDS.barn = (c) => {
  const { w, d, style: s } = c, Hw = 4.2 + (c.floors - 1) * 1.0, hex = pick([0x8a7a68, 0x9a5a40, 0xa89168, 0x7a6a58], s);
  const plank = wmat('plank', hex), body = add(c.g, tiledBoxG(w, Hw, d, 2.5), plank, 0, Hw / 2, 0), dk = pm(0x3f2f22, 0.9);
  add(c.g, boxG(+(w + 0.14).toFixed(2), 0.6, +(d + 0.14).toFixed(2)), pm(0x8f897c, 0.95), 0, 0.3, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(c.g, boxG(0.3, Hw, 0.3), dk, sx * (w / 2 + 0.02), Hw / 2, sz * (d / 2 + 0.02));
  for (const fi of [0, 1, 2, 3]) { const len = fi < 2 ? w : d; fput(c, boxG(+len.toFixed(2), 0.18, 0.1), dk, fi, 0, Hw * 0.5, 0.05); fput(c, boxG(+len.toFixed(2), 0.18, 0.1), dk, fi, 0, Hw - 0.12, 0.05); }
  const rh = w * 0.42, [rk, rhex] = pick([['corr', 0x8a4b36], ['shingle', 0x8a7a66], ['tile', 0x9a5040], ['seam', 0x6a7378]], s >> 1);
  roof(c, { y: Hw, rh, ridgeX: false, kind: rk, hex: rhex, wall: plank, ws: 2.5, trim: dk, over: 0.6, overZ: 0.6 });
  fput(c, comp('bdoor', (B) => { B(1.8, 3.5, 0.1, -0.9, 1.75, 0.05); B(1.8, 3.5, 0.1, 0.9, 1.75, 0.05); for (const sx of [-1, 1]) for (const r of [-1, 1]) B(0.14, 3.84, 0.06, sx * 0.9, 1.75, 0.11, 0, 0, r * 0.48); B(4.4, 0.2, 0.2, 0, 3.7, 0.12); B(0.2, 3.7, 0.2, -1.95, 1.85, 0.1); B(0.2, 3.7, 0.2, 1.95, 1.85, 0.1); }), pm(0x5b4332, 0.9), 0, 0, 0.0);
  fput(c, comp('loft', (B) => { B(1.1, 1.2, 0.08, 0, 0, 0.04); B(1.3, 0.12, 0.1, 0, 0.66, 0.06); B(1.3, 0.12, 0.1, 0, -0.66, 0.06); B(0.12, 1.3, 0.1, -0.6, 0, 0.06); B(0.12, 1.3, 0.1, 0.6, 0, 0.06); B(0.14, 0.14, 1.2, 0, 1.2, 0.5); }), pm(0x4a3a2c, 0.9), 0, 0, Hw + 1.2);
  facade(c, { faces: [2, 3], fh: 4, ww: 0.6, wh: 0.5, sill: 2.4, bay: 4.5, margin: 1.5, v: 1, frame: dk, fl0: 0, fl1: 1 });
  for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) wput(c, planeG(0.12, 0.9), pm(0x1a1510, 1), sx * (w / 2 + 0.02), Hw - 0.9, -d * 0.3 + k * d * 0.3, sx * Math.PI / 2); // Lüftungsschlitze
  // Schleppdach / offener Schuppen mit Heuballen
  const sy = Hw * 0.7;
  add(c.g, tiledBoxG(1.3, 0.1, +(d * 0.6).toFixed(2), 2.4), wmat('corr', 0x8a8e88, 0.6, 0.3), w / 2 + 0.55, sy - 0.2, -d * 0.1, 0, 0, -0.3);
  for (const k of [-0.35, 0, 0.35]) box(c.g, 0.14, sy - 0.4, 0.14, dk, w / 2 + 1.05, (sy - 0.4) / 2, -d * 0.1 + k * d * 0.55);
  for (let k = 0; k < 4; k++) box(c.g, 0.9, 0.55, 0.6, pm(0xc9b25a, 1), w / 2 + 0.5, 0.28 + (k > 1 ? 0.55 : 0), -d * 0.3 + (k % 2) * 0.95 + (k > 1 ? 0.4 : 0) + 0.3);
  return { height: Hw + rh + 1, body };
};

KINDS.townhouse_eu = (c) => {
  const { w, d, style: s } = c, nf = Math.min(4, Math.max(2, c.floors)), fh = 3.1, H = nf * fh + 0.2;
  const tex = pick([['brick', 0xffffff], ['plaster', 0xe3d3b0], ['brick', 0xe8d0b0], ['plaster', 0xcfd6c4]], s), wall = wmat(tex[0], tex[1]), trim = pm(0xece8dc, 0.8), dk = pm(0x3a3a3a, 0.5, 0.5);
  const body = add(c.g, tiledBoxG(w, H, d, tex[0] === 'brick' ? 2 : 4), wall, 0, H / 2, 0);
  add(c.g, boxG(+(w + 0.14).toFixed(2), 1.0, +(d + 0.14).toFixed(2)), pm(0x8f8a80, 0.95), 0, 0.5, 0);
  const shop = s % 4 === 3, doorU = shop ? w * 0.3 : (s % 2 ? -w * 0.22 : w * 0.0 + (w > 7 ? -w * 0.2 : 0));
  const shutters = s % 2 ? pm(pick([0x4d6b48, 0x394f6d, 0x7a4a36], s), 0.8) : null;
  facade(c, { faces: [0, 1, 2, 3], fh, ww: 1.0, wh: 1.75, sill: 0.95, bay: 2.7, v: 0, frame: trim, shut: shutters, skip: (fi, fl, i, n, u) => fi === 0 && fl === 0 && (shop || Math.abs(u - doorU) < 1.3) });
  door(c, 0, doorU, { dw: 1.15, dh: 2.35, mat: pm(pick([0x3d4a44, 0x5a3a2a, 0x2f4f7c], s), 0.8), frame: trim, canopy: false });
  if (shop) { fput(c, planeG(w * 0.5, 2.1), M.window, 0, -w * 0.15, 1.5, 0.06); fput(c, boxG(+(w * 0.5 + 0.2).toFixed(2), 0.12, 0.14), dk, 0, -w * 0.15, 2.6, 0.07); fput(c, boxG(+(w - 0.6).toFixed(2), 0.6, 0.15), pm(0x7a2a2a, 0.7, 0, c.lit ? 0x7a2a2a : 0, 0.6), 0, 0, 3.05, 0.08); }
  if (nf > 2 || s % 2 === 0) { // schmiedeeiserner Balkon im 1. OG
    const bu = (w > 7 ? 0 : 0); fput(c, comp('ibal', (B) => { B(1.7, 0.1, 0.7, 0, 0, 0.35); B(1.7, 0.04, 0.04, 0, 0.9, 0.68); for (let k = 0; k < 9; k++) B(0.025, 0.9, 0.025, -0.8 + k * 0.2, 0.45, 0.68); B(0.04, 0.9, 0.7, -0.84, 0.45, 0.35); B(0.04, 0.9, 0.7, 0.84, 0.45, 0.35); }), dk, 0, bu, fh + 0.1);
  }
  // Gesims mit Zahnschnitt
  add(c.g, boxG(+(w + 0.5).toFixed(2), 0.28, +(d + 0.5).toFixed(2)), trim, 0, H - 0.14, 0);
  const nd = Math.round(w / 0.36); for (let k = 0; k < nd; k++) fput(c, boxG(0.16, 0.14, 0.14), trim, 0, -w / 2 + (k + 0.5) * w / nd, H - 0.4, 0.04);
  if (tex[0] === 'brick') for (const sx of [-1, 1]) for (let k = 0; k < Math.floor(H / 0.7); k++) if (k > 1) fput(c, boxG(0.5 + (k % 2) * 0.2, 0.3, 0.12), pm(0xd8d0bc, 0.9), 0, sx * (w / 2 - 0.2), 0.5 + k * 0.7, 0.04);
  const front = s % 4 < 2, [rk, rhex] = pick([['slate', 0x4c5258], ['tile', 0xa05a44], ['tile', 0x8a5a48], ['slate', 0x5a6066]], s >> 1);
  let top;
  if (front) { // First parallel zur Straße, Gauben
    const rh = Math.min(4.4, d * 0.5), R = roof(c, { y: H, rh, ridgeX: true, kind: rk, hex: rhex, wall, ws: 3, trim, over: 0.35, overZ: 0.3 });
    const ndm = w > 7.4 ? 3 : 2; for (let k = 0; k < ndm; k++) dormer(c, -w / 2 + (k + 0.5) * w / ndm, d / 2 - 0.9, R.at(d / 2 - 0.9) - 0.25, wall, trim, rk, rhex);
    for (const sg of [-1, 1]) chimney(c, sg * (w / 2 - 0.6), 0, H - 0.2, H + rh + 0.8, { sw: 0.8, sd: 0.7 });
    top = H + rh;
  } else { // Giebel zur Straße
    const rh = Math.min(5.0, w * 0.7);
    roof(c, { y: H, rh, ridgeX: false, kind: rk, hex: rhex, wall, ws: 3, trim, over: 0.3, overZ: 0.35 });
    cyl(c.g, 0.45, 0.45, 0.1, trim, 0, H + rh * 0.4, d / 2 + 0.05, Math.PI / 2, 0, 0, 12); cyl(c.g, 0.33, 0.33, 0.12, M.window, 0, H + rh * 0.4, d / 2 + 0.06, Math.PI / 2, 0, 0, 12);
    chimney(c, w * 0.2, -d * 0.2, H, H + rh + 0.5, { sw: 0.8, sd: 0.7 });
    top = H + rh;
  }
  if (c.modern) dish(c, w * 0.3, H - 0.6, d / 2 + 0.08);
  return { height: top + 1, body };
};

KINDS.izba = (c) => {
  const { w, d, style: s } = c, fh = 2.7, nf = Math.min(2, c.floors), H = nf * fh + 0.8, y0 = 0.6;
  const hex = pick([0xe0b88a, 0xb89a70, 0x8a7a68, 0xc9a070], s);
  const body = add(c.g, tiledBoxG(w, H - y0, d, 2.7), wmat('log', hex), 0, y0 + (H - y0) / 2, 0);
  add(c.g, boxG(+(w + 0.14).toFixed(2), y0, +(d + 0.14).toFixed(2)), pm(0x8d867a, 0.95), 0, y0 / 2, 0);
  const lg = comp(`clog${H.toFixed(1)}`, (B) => { for (let r = 0; r < Math.floor((H - y0) / 0.34); r++) { if (r % 2) B(0.36, 0.28, 0.76, 0, y0 + 0.17 + r * 0.34, 0); else B(0.76, 0.28, 0.36, 0, y0 + 0.17 + r * 0.34, 0); } });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(c.g, lg, pm(0xb58d5c, 0.9), sx * w / 2, 0, sz * d / 2);
  const col = pick([0x3b6ea5, 0xf0eee6, 0x4d6b48, 0xd8b24a], s), fr = pm(pick([0xf0eee6, 0x3b6ea5, 0xf0eee6, 0x7a4a36], s), 0.75), sh = pm(col, 0.8);
  const doorU = (s % 2 ? 1 : -1) * w * 0.28;
  facade(c, { faces: [0, 1, 2, 3], fh, ww: 0.8, wh: 1.1, sill: 0.95, y0: y0 + 0.05, bay: 2.3, margin: 1.0, v: 0, frame: fr, shut: sh, skip: (fi, fl, i, n, u) => fi === 0 && fl === 0 && Math.abs(u - doorU) < 1.5 });
  // Krylzo: überdachte Vortreppe
  fput(c, comp('porch', (B) => { B(1.9, 0.18, 1.3, 0, 0.09, 0.65); for (const sx of [-1, 1]) { B(0.14, 2.4, 0.14, sx * 0.85, 1.3, 1.15); B(0.05, 0.8, 1.2, sx * 0.9, 0.95, 0.6); } B(2.2, 0.1, 1.6, 0, 2.55, 0.8); B(2.0, 0.28, 0.08, 0, 2.38, 1.55); B(1.5, 0.14, 0.4, 0, 0.0, 1.5); }), pm(pick([0x7a5a3a, 0x3b6ea5], s >> 1), 0.85), 0, doorU, 0.4);
  door(c, 0, doorU, { dw: 0.95, dh: 2.0, mat: pm(0x5a4030, 0.85), frame: fr, stoop: false });
  const ridgeX = d < w * 0.8 ? true : false, span = ridgeX ? d : w, rh = span * 0.38;
  const [rk, rhex] = pick([['shingle', 0x8a7a66], ['corr', 0x6f8a6a], ['seam', 0x7a4a3a], ['slate', 0x5a6066]], s >> 1);
  const R = roof(c, { y: H, rh, ridgeX, kind: rk, hex: rhex, wall: wmat('log', hex), ws: 2.7, trim: sh, over: 0.6, overZ: 0.55 });
  chimney(c, ridgeX ? -w * 0.2 : 0, ridgeX ? 0 : -d * 0.2, H, H + rh + 0.9, { sw: 0.6 });
  if (c.modern) { dish(c, w * 0.3, H - 0.8, d / 2 + 0.08); tvAnt(c, ridgeX ? w * 0.3 : 0, H + rh * 0.9, 0.3); }
  if (c.h.fence) gardenFence(c, d / 2 + 1.1, w + 1, pm(0x8a6a44, 0.9));
  return { height: H + rh + 1, body };
};

KINDS.qalat = (c) => {
  const { w, d, style: s } = c, Hw = 4.4, t = 0.9, hex = pick([0xffffff, 0xe8d4b0, 0xd9b98f, 0xc9a77c], s), mud = wmat('mud', hex), nf = Math.min(2, c.floors), Hi = nf * 3.0 + 0.3;
  add(c.g, boxG(+(w - 0.5).toFixed(2), 0.06, +(d - 0.5).toFixed(2)), pm(0xb9a37c, 1), 0, 0.03, 0, 0, 0, 0, false);
  const front = add(c.g, tiledBoxG(w, Hw, t, 3), mud, 0, Hw / 2, d / 2 - t / 2), back = add(c.g, tiledBoxG(w, Hw, t, 3), mud, 0, Hw / 2, -d / 2 + t / 2);
  for (const sx of [-1, 1]) add(c.g, tiledBoxG(t, Hw, +(d - 2 * t).toFixed(2), 3), mud, sx * (w / 2 - t / 2), Hw / 2, 0);
  for (const sz of [-1, 1]) add(c.g, tiledBoxG(+(w + 0.3).toFixed(2), 1.0, 0.25, 3), mud, 0, 0.5, sz * (d / 2 + 0.05)); // Wandfuß
  for (const sx of [-1, 1]) add(c.g, tiledBoxG(0.25, 1.0, +d.toFixed(2), 3), mud, sx * (w / 2 + 0.05), 0.5, 0);
  // Zinnen
  const mer = (len, f) => { const n = Math.floor(len / 1.4); for (let k = 0; k < n; k++) f(-len / 2 + (k + 0.5) * len / n); };
  for (const sz of [-1, 1]) mer(w - 3.4, (u) => add(c.g, boxG(0.6, 0.55, 0.45), mud, u, Hw + 0.27, sz * (d / 2 - t * 0.78)));
  for (const sx of [-1, 1]) mer(d - 3.4, (u) => add(c.g, boxG(0.45, 0.55, 0.6), mud, sx * (w / 2 - t * 0.78), Hw + 0.27, u));
  // Ecktürme
  const Ht = 6.2;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * (w / 2 - 1.0), z = sz * (d / 2 - 1.0);
    if (s % 2 === 0) {
      add(c.g, cylG(1.15, 1.45, Ht, 12), mud, x, Ht / 2, z); add(c.g, cylG(1.4, 1.2, 0.5, 12), mud, x, Ht + 0.25, z);
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; add(c.g, boxG(0.5, 0.4, 0.5), mud, x + Math.cos(a) * 1.25, Ht + 0.7, z + Math.sin(a) * 1.25, 0, -a, 0); }
      for (let k = 0; k < 3; k++) { const a = Math.atan2(sz, sx) + (k - 1) * 0.55; wput(c, boxG(0.16, 0.5, 0.1), pm(0x1a1510, 1), x + Math.cos(a) * 1.4, Ht - 1.2, z + Math.sin(a) * 1.4, -a + Math.PI / 2); }
    } else {
      add(c.g, tiledBoxG(2.5, Ht, 2.5, 3), mud, x, Ht / 2, z); add(c.g, tiledBoxG(2.9, 0.4, 2.9, 3), mud, x, Ht + 0.2, z);
      for (let k = 0; k < 4; k++) for (const q of [-1, 1]) { add(c.g, boxG(0.5, 0.45, 0.5), mud, x + (k % 2 ? q * 1.2 : (k - 1.5) * 0.8), Ht + 0.62, z + (k % 2 ? (k - 1.5) * 0.8 : q * 1.2)); }
      wput(c, boxG(0.16, 0.5, 0.1), pm(0x1a1510, 1), x + sx * 1.26, Ht - 1.2, z, sx * Math.PI / 2); wput(c, boxG(0.16, 0.5, 0.1), pm(0x1a1510, 1), x, Ht - 1.2, z + sz * 1.26, sz > 0 ? 0 : Math.PI);
    }
  }
  // Tor mit Torhaus
  add(c.g, tiledBoxG(4.0, 5.2, 0.6, 3), mud, 0, 2.6, d / 2 + 0.1);
  wput(c, archPlaneG(2.5, 3.6), pm(0x5a4028, 1), 0, 1.8, d / 2 + 0.42, 0); wput(c, archPlaneG(2.1, 3.3), pm(0x3f2c1c, 0.9), 0, 1.65, d / 2 + 0.43, 0);
  for (const k of [-0.8, 0, 0.8]) box(c.g, 0.1, 3.0, 0.06, pm(0x2b2b2b, 0.6, 0.5), k, 1.5, d / 2 + 0.44);
  // Innenbauten
  const iw = (w - 2 * t) * 0.64, id = (d - 2 * t) * 0.34, ix = -(w - 2 * t) * 0.16, iz = -d / 2 + t + id / 2;
  const body = add(c.g, tiledBoxG(+iw.toFixed(2), Hi, +id.toFixed(2), 3), wmat('mud', 0xf0e0c0), ix, Hi / 2, iz);
  add(c.g, tiledBoxG(+(iw + 0.2).toFixed(2), 0.25, +(id + 0.2).toFixed(2), 3), mud, ix, Hi + 0.12, iz);
  for (let k = 0; k < Math.round(iw / 0.8); k++) cyl(c.g, 0.07, 0.07, 0.6, pm(0x6a4a30, 1), ix - iw / 2 + 0.4 + k * 0.8, Hi - 0.35, iz + id / 2, Math.PI / 2, 0, 0, 5);
  const wz = iz + id / 2 + 0.02;
  for (let k = 0; k < nf; k++) for (const u of [-iw * 0.32, iw * 0.32]) { box(c.g, 0.7, 0.95, 0.12, pm(0x2a2118, 1), ix + u, 1.9 + k * 3.0, wz); box(c.g, 0.9, 0.12, 0.2, pm(0x6a4a30, 1), ix + u, 2.45 + k * 3.0, wz + 0.04); }
  box(c.g, 1.0, 2.0, 0.12, pm(0x5a4028, 0.9), ix, 1.0, wz); box(c.g, 1.3, 0.14, 0.2, pm(0x6a4a30, 1), ix, 2.1, wz + 0.04);
  const bw = 3.2, bd = 2.8, bx = (w - 2 * t) * 0.3, bz = -d / 2 + t + 1.8;
  add(c.g, tiledBoxG(bw, 2.8, bd, 3), mud, bx, 1.4, bz); add(c.g, tiledBoxG(bw + 0.2, 0.2, bd + 0.2, 3), mud, bx, 2.9, bz);
  box(c.g, 0.9, 1.9, 0.1, pm(0x5a4028, 0.9), bx, 0.95, bz + bd / 2 + 0.02);
  cyl(c.g, 0.0, 1.0, 1.4, pm(0xc9b25a, 1), (w - 2 * t) * 0.25, 0.7, d * 0.08, 0, 0, 0, 8); // Heuhaufen
  cyl(c.g, 0.55, 0.55, 0.7, M.concrete, -(w - 2 * t) * 0.2, 0.35, d * 0.1, 0, 0, 0, 10); cyl(c.g, 0.42, 0.42, 0.72, pm(0x15120f, 1), -(w - 2 * t) * 0.2, 0.36, d * 0.1, 0, 0, 0, 10); // Brunnen
  if (c.modern) dish(c, ix + iw * 0.3, Hi + 0.3, iz, 0);
  return { height: Ht + 2, body };
};

KINDS.mud_house = (c) => {
  const { w, d, style: s } = c, nf = Math.min(2, c.floors), H = nf * 2.9, hex = pick([0xffffff, 0xe8d4b0, 0xd9b98f, 0xc9a77c], s), mud = wmat('mud', hex), wood = pm(0x5a3f2a, 0.9);
  const body = add(c.g, tiledBoxG(w, H, d, 3), mud, 0, H / 2, 0);
  add(c.g, tiledBoxG(+(w + 0.1).toFixed(2), 0.3, +(d + 0.1).toFixed(2), 3), wmat('mud', 0xb89a70), 0, 0.15, 0);
  // Dach: Lehmschicht, niedrige Brüstung, Balkenköpfe
  add(c.g, tiledBoxG(+(w + 0.1).toFixed(2), 0.3, +(d + 0.1).toFixed(2), 3), wmat('mud', 0xc8b088), 0, H + 0.15, 0);
  for (const sz of [-1, 1]) { add(c.g, tiledBoxG(+(w + 0.1).toFixed(2), 0.35, 0.3, 3), mud, 0, H + 0.45, sz * (d / 2 - 0.1)); add(c.g, tiledBoxG(0.3, 0.35, +(d - 0.2).toFixed(2), 3), mud, sz * (w / 2 - 0.1), H + 0.45, 0); }
  const nb = Math.max(3, Math.round(w / 0.75));
  for (let k = 0; k < nb; k++) for (const sz of [-1, 1]) cyl(c.g, 0.07, 0.07, 0.55, wood, -w / 2 + (k + 0.5) * w / nb, H - 0.2, sz * (d / 2 + 0.12), Math.PI / 2, 0, 0, 5);
  // Anbau (L-Form)
  const aw = w * 0.42, ad = d * 0.42, ah = H * 0.7 + 0.2;
  const ax = w / 2 - aw / 2, az = -d / 2 + ad / 2;
  add(c.g, tiledBoxG(+aw.toFixed(2), ah, +ad.toFixed(2), 3), wmat('mud', hex === 0xffffff ? 0xece0c4 : hex), ax, ah / 2, az);
  add(c.g, tiledBoxG(+(aw + 0.1).toFixed(2), 0.25, +(ad + 0.1).toFixed(2), 3), wmat('mud', 0xc8b088), ax, ah + 0.1, az);
  // Öffnungen
  const doorU = (s % 2 ? -1 : 1) * w * 0.18;
  facade(c, { faces: [0, 1, 2, 3], fh: 2.9, ww: 0.55, wh: 0.7, sill: 1.2, bay: 3.0, margin: 1.2, v: 1, frame: wood, bars: s % 2 === 0, barsAll: true, skip: (fi, fl, i, n, u) => (fi === 0 && fl === 0 && Math.abs(u - doorU) < 1.2) || (fi === 1 && ax - aw / 2 < 0 && false) });
  door(c, 0, doorU, { dw: 0.9, dh: 1.85, mat: pm(0x6a4a30, 0.9), frame: wood, canopy: false });
  if (nf === 2) for (let k = 0; k < 9; k++) box(c.g, 0.9, 0.3, 0.45 + 0.0, wmat('mud', 0xd9c9a4), -w / 2 - 0.45, 0.15 + k * 0.3, d * 0.5 - 0.6 - k * 0.0 - 0.0 - k * (d - 1.2) / 9 * 0.9); // Außentreppe
  cyl(c.g, 0.3, 0.3, 0.7, pm(0x2f5c9a, 0.6, 0.4), -w * 0.3, H + 0.9, d * 0.1, 0, 0, 0, 8);
  box(c.g, 1.0, 0.5, 0.5, pm(0xb89a50, 1), w * 0.15, H + 0.8, -d * 0.2);
  if (c.modern) dish(c, w * 0.25, H + 0.4, d / 2 - 0.5, 0);
  if (s % 2) { // Hofmauer mit Tor
    const hw = 1.5, gu = -doorU * 0.0;
    add(c.g, tiledBoxG(+(w * 0.5 - 0.5).toFixed(2), hw, 0.4, 3), mud, -w * 0.25 - 0.25, hw / 2, d / 2 + 0.9); add(c.g, tiledBoxG(+(w * 0.5 - 0.5).toFixed(2), hw, 0.4, 3), mud, w * 0.25 + 0.25, hw / 2, d / 2 + 0.9);
    box(c.g, 1.0, 1.35, 0.1, wood, 0, 0.7, d / 2 + 0.9);
  }
  return { height: H + 1.5, body };
};

KINDS.bazaar = (c) => {
  const { w, d, style: s } = c, rnd = c.rnd, cloth = [0xa83a30, 0x2f5c9a, 0x3d7a4a, 0xd2a93a, 0xe6e1d3, 0xc86a2a, 0x7a3a7a];
  add(c.g, boxG(+(w - 0.3).toFixed(2), 0.05, +(d - 0.3).toFixed(2)), pm(0xa8946f, 1), 0, 0.025, 0, 0, 0, 0, false);
  const hex = pick([0xffffff, 0xe8d4b0, 0xd9b98f], s), bh = 3.1, bd = 2.6, bz = -d / 2 + bd / 2 + 0.2;
  const body = add(c.g, tiledBoxG(w - 0.4, bh, bd, 3), s % 2 ? wmat('mud', hex) : wmat('plaster', 0xe0d0b0), 0, bh / 2, bz);
  add(c.g, tiledBoxG(+(w - 0.2).toFixed(2), 0.25, +(bd + 0.3).toFixed(2), 3), wmat('mud', 0xc8b088), 0, bh + 0.12, bz);
  const ns = Math.max(3, Math.round(w / 3.4)), sw = (w - 0.6) / ns, zf = bz + bd / 2;
  for (let k = 0; k < ns; k++) {
    const u = -w / 2 + 0.3 + (k + 0.5) * sw, cc = cloth[Math.floor(rnd() * cloth.length)], cc2 = cloth[Math.floor(rnd() * cloth.length)];
    box(c.g, sw - 0.5, 2.2, 0.1, pm(0x2a2118, 1), u, 1.2, zf + 0.04); // Ladenöffnung
    box(c.g, sw - 0.2, 0.2, 0.14, wood2(), u, 2.4, zf + 0.06); // Sturz
    if (rnd() < 0.7) box(c.g, sw * 0.6, 1.2, 0.05, pm(cc, 1), u, 1.2, zf + 0.12); // hängender Teppich/Stoff
    // Tisch + Pfosten + Stoffdach davor
    const zt = zf + 1.8;
    box(c.g, sw - 0.8, 0.8, 1.0, wood2(), u, 0.4, zt); box(c.g, sw - 0.6, 0.05, 1.2, pm(cc2, 0.95), u, 0.82, zt);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(c.g, 0.09, 2.3, 0.09, wood2(), u + sx * (sw / 2 - 0.3), 1.15, zt + sz * 0.85);
    box(c.g, sw - 0.1, 0.06, 2.0, pm(cc, 0.95), u, 2.45, zt, 0.12, 0, 0); box(c.g, sw - 0.1, 0.35, 0.05, pm(cc, 0.95), u, 2.25, zt + 1.0);
    for (let g = 0; g < 4 + Math.floor(rnd() * 4); g++) { const gx = u + (rnd() - 0.5) * (sw - 1.0), gz = zt + (rnd() - 0.5) * 0.6, gc = cloth[Math.floor(rnd() * cloth.length)]; if (rnd() < 0.5) cyl(c.g, 0.17, 0.17, 0.22, pm(gc, 0.8), gx, 0.96, gz, 0, 0, 0, 6); else box(c.g, 0.3, 0.2, 0.25, pm(gc, 0.9), gx, 0.95, gz); }
    if (c.lit) box(c.g, 0.12, 0.12, 0.12, pm(0xffe9b0, 0.3, 0, 0xffd890, 2.2), u, 2.2, zt);
  }
  for (let k = 0; k < 3; k++) box(c.g, 0.7, 0.6, 0.6, wood2(), -w * 0.3 + k * w * 0.3, 0.3 + (k % 2) * 0.6, d / 2 - 0.5);
  if (c.modern) dish(c, w * 0.3, bh + 0.5, bz, 0);
  return { height: bh + 1, body };
};
function wood2() { return pm(0x7a5d3a, 0.9); }

KINDS.watchtower = (c) => {
  const { w, d, style: s } = c, nf = Math.max(2, Math.min(7, c.floors)), fh = 3.0, H = nf * fh, dk = pm(0x4a3624, 0.9), metal = pm(0x55595b, 0.5, 0.6);
  let body, top;
  if (s % 2 === 0) { // Holz-/Stahlgitterturm
    const ox = w / 2 - 0.15, oz = d / 2 - 0.15;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) body = body || box(c.g, 0.22, H, 0.22, dk, sx * ox, H / 2, sz * oz);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) if (!(sx === -1 && sz === -1)) box(c.g, 0.22, H, 0.22, dk, sx * ox, H / 2, sz * oz);
    for (let k = 0; k < nf; k++) {
      const y = k * fh + fh / 2, la = Math.hypot(2 * ox, fh), a = Math.atan2(2 * ox, fh), lb = Math.hypot(2 * oz, fh), b = Math.atan2(2 * oz, fh);
      for (const sz of [-1, 1]) for (const r of [-1, 1]) box(c.g, 0.1, la, 0.1, dk, 0, y, sz * oz, 0, 0, r * a);
      for (const sx of [-1, 1]) for (const r of [-1, 1]) box(c.g, 0.1, lb, 0.1, dk, sx * ox, y, 0, r * b, 0, 0);
      for (const sz of [-1, 1]) box(c.g, 2 * ox, 0.14, 0.14, dk, 0, k * fh + 0.1, sz * oz); for (const sx of [-1, 1]) box(c.g, 0.14, 0.14, 2 * oz, dk, sx * ox, k * fh + 0.1, 0);
    }
    // Leiter
    const lh = H; box(c.g, 0.05, lh, 0.05, metal, -0.2, lh / 2, d / 2 + 0.2); box(c.g, 0.05, lh, 0.05, metal, 0.2, lh / 2, d / 2 + 0.2);
    for (let k = 0; k < Math.floor(lh / 0.4); k++) box(c.g, 0.4, 0.03, 0.03, metal, 0, 0.3 + k * 0.4, d / 2 + 0.2);
    // Plattform + Kabine
    add(c.g, boxG(+(w + 0.9).toFixed(2), 0.2, +(d + 0.9).toFixed(2)), dk, 0, H + 0.1, 0);
    const rail = comp(`rl${w},${d}`, (B) => { for (const sz of [-1, 1]) { B(w + 0.9, 0.06, 0.06, 0, 0.5, sz * (d / 2 + 0.43)); B(w + 0.9, 0.06, 0.06, 0, 1.0, sz * (d / 2 + 0.43)); } for (const sx of [-1, 1]) { B(0.06, 0.06, d + 0.9, sx * (w / 2 + 0.43), 0.5, 0); B(0.06, 0.06, d + 0.9, sx * (w / 2 + 0.43), 1.0, 0); } for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(0.08, 1.0, 0.08, sx * (w / 2 + 0.43), 0.5, sz * (d / 2 + 0.43)); });
    add(c.g, rail, dk, 0, H + 0.2, 0);
    const cw = w * 0.9, cdp = d * 0.9, ch = 2.2;
    add(c.g, tiledBoxG(+cw.toFixed(2), ch, +cdp.toFixed(2), 2.5), wmat('plank', 0x9a8a72), 0, H + 0.2 + ch / 2, 0);
    for (const fi of [0, 1, 2, 3]) { const len = fi < 2 ? cw : cdp; const f = c.faces[fi]; const m = fput(c, planeG(+(len * 0.7).toFixed(2), 0.7), M.window, fi, 0, H + 1.5, (fi < 2 ? cdp : cw) / 2 - (fi < 2 ? d : w) / 2 + 0.03); }
    roof(c, { y: H + 0.2 + ch, rh: 0.9, ridgeX: false, kind: 'seam', hex: 0x6a7378, wall: wmat('plank', 0x9a8a72), ws: 2.5, trim: dk, over: 0.5, overZ: 0.5 });
    // Suchscheinwerfer
    cyl(c.g, 0.22, 0.28, 0.4, metal, w / 2 + 0.3, H + 1.5, d / 2 + 0.3, Math.PI / 2 - 0.3, 0.6, 0, 8); box(c.g, 0.3, 0.3, 0.1, pm(0xfff1c0, 0.2, 0, c.lit ? 0xfff0b0 : 0, 2.5), w / 2 + 0.38, H + 1.45, d / 2 + 0.52);
    cyl(c.g, 0.03, 0.03, 2.2, metal, -w * 0.3, H + ch + 1.9, -d * 0.2, 0, 0, 0, 4);
    top = H + ch + 1.2;
  } else { // gemauerter Turm mit Zinnenplattform
    const stone = wmat(s % 4 === 1 ? 'mud' : 'stone', s % 4 === 1 ? 0xe0cba4 : 0xc8bfa8);
    body = add(c.g, tiledBoxG(w, H, d, 3), stone, 0, H / 2, 0);
    add(c.g, tiledBoxG(+(w + 0.6).toFixed(2), 1.0, +(d + 0.6).toFixed(2), 3), stone, 0, 0.5, 0);
    add(c.g, tiledBoxG(+(w + 0.9).toFixed(2), 0.5, +(d + 0.9).toFixed(2), 3), stone, 0, H + 0.25, 0);
    for (const sz of [-1, 1]) for (let k = 0; k < Math.max(2, Math.round(w / 0.9)); k++) add(c.g, boxG(0.5, 0.55, 0.4), stone, -w / 2 + 0.1 + (k + 0.5) * (w - 0.2) / Math.max(2, Math.round(w / 0.9)), H + 0.78, sz * (d / 2 + 0.3));
    for (const sx of [-1, 1]) for (let k = 0; k < Math.max(2, Math.round(d / 0.9)); k++) add(c.g, boxG(0.4, 0.55, 0.5), stone, sx * (w / 2 + 0.3), H + 0.78, -d / 2 + 0.1 + (k + 0.5) * (d - 0.2) / Math.max(2, Math.round(d / 0.9)));
    for (let k = 1; k < nf; k++) for (const fi of [0, 1, 2, 3]) fput(c, boxG(0.16, 0.6, 0.1), pm(0x1a1510, 1), fi, 0, k * fh + 0.8, 0.02);
    door(c, 0, 0, { dw: 0.9, dh: 1.9, mat: pm(0x4a3a2c, 0.9), frame: pm(0x6d6a63, 0.9), canopy: false });
    if (s % 4 === 3) { for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(c.g, 0.14, 2.0, 0.14, dk, sx * (w / 2 + 0.2), H + 1.5, sz * (d / 2 + 0.2)); add(c.g, cylG(0, +(Math.hypot(w, d) * 0.62).toFixed(2), 1.4, 4), wmat('tile', 0x9a5a44), 0, H + 3.2, 0, 0, Math.PI / 4, 0); top = H + 4; }
    else { cyl(c.g, 0.04, 0.04, 2.6, metal, w * 0.3, H + 1.8, d * 0.3, 0, 0, 0, 4); box(c.g, 0.9, 0.5, 0.03, pm(s % 2 ? 0xb53a30 : 0x2f6a3a, 0.9), w * 0.3 + 0.45, H + 2.7, d * 0.3); top = H + 3.2; }
  }
  return { height: top, body };
};

// ---- Öffentliche API: house(h), rubble(w, d, kind) ----
const _kindByDims = new Map();
const dimKey = (w, d) => `${(+w).toFixed(3)},${(+d).toFixed(3)}`;
export const HOUSE_KINDS = Object.keys(KINDS);
export function house(h) {
  initMats();
  const kind = KINDS[h.kind] ? h.kind : (h.floors >= 6 ? 'panel_high' : h.floors > 2 ? 'khrushchyovka' : 'cottage');
  const c = bCtx(h, kind);
  const r = KINDS[kind](c);
  const merged = optimize(c.g); // Einzelhaus → nicht gecacht
  addBlob(c.g, h.w + 5, h.d + 5);
  _kindByDims.set(dimKey(h.w, h.d), kind);
  c.g.userData.houseKind = kind;
  return { root: c.g, height: r.height, body: merged.get(r.body) || r.body, kind };
}

const RUBBLE_CLASS = {
  qalat: 'mud', mud_house: 'mud', bazaar: 'mud', watchtower: 'mud',
  khrushchyovka: 'concrete', panel_high: 'concrete', warehouse: 'concrete', kiosk: 'concrete',
  izba: 'wood', barn: 'wood', cottage: 'wood',
  farmhouse_eu: 'brick', townhouse_eu: 'brick', church_west: 'brick', church_orthodox: 'brick', industrial: 'brick', shop: 'brick',
};
export function rubble(w, d, kind) {
  initMats();
  kind = kind || _kindByDims.get(dimKey(w, d)) || 'cottage';
  const cls = RUBBLE_CLASS[kind] || 'brick', g = new THREE.Group(), rnd = Math.random;
  const base = { mud: 0xb59a72, brick: 0x7a5548, concrete: 0x8a8780, wood: 0x4a3a2c }[cls];
  const cols = { mud: [0xb59a72, 0xc9b088, 0x9a8260], brick: [0x7a5548, 0x8a5a48, 0x5a4a42, 0x9a9488], concrete: [0x8a8780, 0x6a6862, 0xa09d95], wood: [0x4a3a2c, 0x5a5048, 0x7a7266, 0x2a2420] }[cls];
  const wallTex = { mud: ['mud', 0xffffff], brick: ['brick', 0xd8c8b8], concrete: ['panel', 0xb0aca2], wood: ['plaster', 0xd9d2c0] }[cls];
  add(g, boxG(+(w * 0.92).toFixed(2), 0.45, +(d * 0.92).toFixed(2)), pm(base, 1), 0, 0.22, 0);
  const dod = (r) => _bgk(`dod${r}`, () => new THREE.DodecahedronGeometry(r, 0));
  for (let i = 0; i < 16; i++) {
    const r = [0.5, 0.8, 1.1][i % 3];
    const m = add(g, dod(r), pm(cols[i % cols.length], 1), (rnd() - 0.5) * w * 0.85, 0.35 + rnd() * 0.45, (rnd() - 0.5) * d * 0.85, rnd(), rnd() * 3, rnd());
    m.scale.set(1 + rnd() * 0.6, 0.45 + rnd() * 0.3, 1 + rnd() * 0.6);
  }
  // stehengebliebene Wandreste (Putz/Ziegel/Platte/Lehm) mit ausgebrochener Oberkante
  const maxH = { mud: 2.0, brick: 3.4, concrete: 2.6, wood: 1.2 }[cls], tm = wmat(wallTex[0], wallTex[1]);
  for (let i = 0; i < 4; i++) {
    const side = i % 2 ? 1 : -1, zside = i < 2 ? 1 : -1, len = 2 + rnd() * 3;
    const x = side * (w * 0.3 + (rnd() - 0.5)), z = zside * d * 0.34 + (rnd() - 0.5), ry = i < 2 ? (rnd() - 0.5) * 0.3 : Math.PI / 2 + (rnd() - 0.5) * 0.3;
    let acc = 0;
    for (let k = 0; k < 3; k++) { const sl = len / 3, hh = 0.6 + rnd() * (maxH - 0.6) * (1 - k * 0.25); const lx = (k - 1) * sl; add(g, tiledBoxG(+sl.toFixed(2), +hh.toFixed(2), 0.4, 3), tm, x + Math.cos(ry) * lx, hh / 2 + 0.3, z - Math.sin(ry) * lx, (rnd() - 0.5) * 0.08, ry, (rnd() - 0.5) * 0.12); acc += hh; }
  }
  if (cls === 'concrete') { // Deckenplatten + Bewehrung
    add(g, tiledBoxG(+(w * 0.4).toFixed(2), 0.25, +(d * 0.36).toFixed(2), 3), wmat('panel', 0xb8b4aa), (rnd() - 0.5) * 2, 0.9, (rnd() - 0.5) * 2, 0.22, rnd(), 0.15);
    add(g, tiledBoxG(+(w * 0.3).toFixed(2), 0.25, +(d * 0.3).toFixed(2), 3), wmat('panel', 0xb8b4aa), (rnd() - 0.5) * 3, 1.5, (rnd() - 0.5) * 3, -0.3, rnd(), -0.2);
    for (let i = 0; i < 16; i++) add(g, cylG(0.025, 0.025, 1.0 + rnd() * 1.4, 4), pm(0x6a4a32, 0.8, 0.5), (rnd() - 0.5) * w * 0.7, 1.2 + rnd() * 0.9, (rnd() - 0.5) * d * 0.7, (rnd() - 0.5) * 1.2, rnd() * 3, (rnd() - 0.5) * 1.2);
  } else if (cls === 'wood' || cls === 'brick') {
    for (let i = 0; i < 6; i++) add(g, boxG(0.25, 0.25, +(2.5 + rnd() * 2.5).toFixed(2)), i % 2 ? pm(0x25221f, 1) : pm(0x6b5236, 0.9), (rnd() - 0.5) * w * 0.7, 0.9 + rnd() * 0.6, (rnd() - 0.5) * d * 0.7, (rnd() - 0.5) * 0.6, rnd() * 3, (rnd() - 0.5) * 0.6);
    if (cls === 'brick') for (let i = 0; i < 10; i++) add(g, tiledBoxG(0.6 + rnd() * 0.5, 0.35, 0.4, 2), wmat('brick', 0xffffff), (rnd() - 0.5) * w * 0.8, 0.5 + rnd() * 0.5, (rnd() - 0.5) * d * 0.8, rnd(), rnd() * 3, rnd());
  } else { // Lehm: Balkenreste (Vigas) und Mauerbrocken
    for (let i = 0; i < 5; i++) add(g, cylG(0.07, 0.07, +(1.4 + rnd() * 1.4).toFixed(2), 5), pm(0x5a3f2a, 1), (rnd() - 0.5) * w * 0.7, 0.8 + rnd() * 0.6, (rnd() - 0.5) * d * 0.7, 0, rnd() * 3, Math.PI / 2 + (rnd() - 0.5) * 0.6);
  }
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
  } else if (kind === 'tanktrap') { // Panzersperre: Stahligel/Betonhöcker in Reihe
    for (const x of [-2.1, 0, 2.1]) {
      box(g, 0.24, 2.5, 0.24, M.steelBridge, x, 1.0, 0, 0, 0, 0.62);
      box(g, 0.24, 2.5, 0.24, M.steelBridge, x, 1.0, 0, 0, 0, -0.62);
      box(g, 0.24, 2.5, 0.24, M.steelBridge, x, 1.0, 0, 1.05, 0.0, 0.0);
      box(g, 0.7, 0.35, 0.7, M.concreteDark, x, 0.18, 0);
    }
    box(g, 5.6, 0.12, 0.12, M.steelBridge, 0, 0.5, 0.55);
    height = 2.2;
  } else if (kind === 'sandbag') { // Sandsackwall
    sandbags(g, 0, 0, 4.8, 0, 3);
    box(g, 4.6, 0.3, 0.45, M.sandbag, 0, 1.12, 0);
    height = 1.3;
  } else if (kind === 'trench') { // Schützengraben: Aushub-Wall, dunkle Sohle, Bohlen, Sandsäcke
    box(g, 5.8, 0.05, 1.3, M.charred, 0, 0.06, 0);
    for (const s of [-1, 1]) {
      box(g, 5.8, 0.55, 0.7, M.tent, 0, 0.27, s * 1.05); // Brustwehr (Aushub)
      box(g, 5.6, 0.08, 0.12, M.wood, 0, 0.62, s * 0.74); // Bohle
    }
    for (const x of [-2.6, -0.9, 0.9, 2.6]) box(g, 0.14, 0.7, 0.14, M.wood, x, 0.35, -0.74);
    sandbags(g, 0, -1.25, 5.4, 0, 1);
    for (const x of [-2.9, 2.9]) box(g, 0.4, 0.15, 1.3, M.wood, x, 0.1, 0);
    height = 0.9;
  } else if (kind === 'minefield') { // Minenschild: Pfähle mit Warnschildern, einzelne Minen
    for (const [x, z] of [[-4.2, -4.2], [4.2, -4.2], [-4.2, 4.2], [4.2, 4.2], [0, -4.4], [0, 4.4]]) {
      box(g, 0.08, 1.2, 0.08, M.wood, x, 0.6, z);
      box(g, 0.7, 0.5, 0.05, M.brick, x, 1.15, z + 0.06);
      box(g, 0.5, 0.08, 0.06, M.frame, x, 1.15, z + 0.1);
    }
    for (let i = 0; i < 9; i++) { const a = i * 2.4; cyl(g, 0.22, 0.24, 0.08, M.charred, Math.cos(a) * (1.2 + (i % 4) * 0.8), 0.05, Math.sin(a) * (1.2 + (i % 4) * 0.8), 0, 0, 0, 8); }
    height = 1.4;
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
const TURRET_SKIP = new Set(['leopard', 't72', 't90', 'bradley', 'bmp', 'gepard', 'spg', 'tankdestroyer']);

/**
 * Modell-Registry für Epochen-Module: registerModel('sherman', (side, type, ctx) => ({ root, turret, barrel, muzzle, height, … }))
 * ctx enthält die Bau-Helfer (siehe MODEL_KIT). Registrierte Modelle haben Vorrang vor den eingebauten.
 */
const MODEL_REGISTRY = {};
export function registerModel(name, fn) { MODEL_REGISTRY[name] = fn; }
/** Bau-Helfer für Epochen-Module (gleiche Funktionen wie intern verwendet). */
export const MODEL_KIT = {
  THREE, get M() { initMats(); return M; }, add, box, cyl, boxG, cylG, sphG, hullGeo, wheel, antenna, headlights, trackSet,
  camoTexture, iff, addBlob, truckBase, soldier, tank, ifv, quad, fixedWing, helicopter,
};

export function buildModel(type, side, season, quality) {
  initMats();
  let r;
  if (MODEL_REGISTRY[type.model]) {
    r = MODEL_REGISTRY[type.model](side, type, { ...MODEL_KIT, M, season, quality });
  } else switch (type.model) {
    case 'leopard': r = tank(side, 'leopard'); break;
    case 't72': r = tank(side, 't72'); break;
    case 't90': r = tank(side, 't90'); break;
    case 'bradley': r = ifv(side, 'bradley'); break;
    case 'bmp': r = ifv(side, 'bmp'); break;
    case 'btr': r = ifv(side, 'btr'); break;
    case 'tankdestroyer': r = tankDestroyer(side); break;
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
    case 'recovery': r = recoveryVehicle(side); break;
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
