// V3-M2: Brücken als Bauwerke über dem Wasser (statt Damm), sprengen, beschießen, Notbrücke bauen.
//
// Quellen: jedes 'causeway'-Feature der Karte über tiefem Wasser (Ortsvorlagen _kit.bridge(), Gefechtskarten, Editor,
//   Missionen; flache Furten bleiben Dämme), game.addBridge(pts, {width, kind, style, hp, name}) und Gleise über Wasser
//   (rail.js). Das Gelände bleibt unter der Brücke Wasser (Boote fahren unter hohen Brücken durch); an den Ufern schütten
//   Rampen/Widerlager bis zur Fahrbahnhöhe auf (terrain.editHeights). Fahrbahn: terrain.height() liefert auf der
//   Brückenfläche die Deckhöhe (Bodeneinheiten fahren darauf), das Pfadraster ist dort begehbar (Fahrzeugbreite über das
//   Abstandsfeld: Wasser daneben ist hartes Hindernis).
// Bauarten (feature.style bzw. o.style): 'stone_arch' (Steinbögen, Brüstung – Standard WK2), 'steel_truss' (Stahlfachwerk
//   mit Bogenobergurt – Eisenbahnbrücken, Remagen, Arnheim), 'concrete_beam' (Betonbalken – Standard modern),
//   'cable_arch' (Stahlbogen über der Fahrrinne + Betonbalkenbrücke, Krimbrücke), 'wood' (Behelfs-/Dorfbrücke – Standard
//   Afghanistan), 'pontoon' (Pionierbrücke auf Schwimmkörpern).
// Zustände: 'intact' | 'destroyed' (Mittelfeld eingestürzt: Optik Trümmer im Wasser, Raster Wasser) | 'repaired'
//   (Notbrücke/Ponton im Mittelfeld). Ereignisse: 'bridgeDestroyed' (b, Ursache) · 'bridgeBuilt' (b).
import * as THREE from 'three';
import { rand } from '../engine/util.js';

export const BR = {
  hp: { road: 2600, rail: 2200, wood: 1200, pontoon: 900, repaired: 1100 },
  plant: 6, fuse: 10, blowCost: 2,
  buildTime: 40, buildCost: 3,
  span: { stone_arch: 12, concrete_beam: 18, steel_truss: 30, cable_arch: 16, wood: 6, pontoon: 10 },
};
export const BRIDGE_STYLES = ['stone_arch', 'steel_truss', 'concrete_beam', 'cable_arch', 'wood', 'pontoon'];
const STATE_CODE = { intact: 0, destroyed: 1, repaired: 2 };
const CODE_STATE = ['intact', 'destroyed', 'repaired'];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sstep = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

// ---------------- Polylinien-Helfer ----------------
export function polyLen(pts) { const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return cum; }
export function polyAt(pts, cum, s) {
  s = Math.max(0, Math.min(cum[cum.length - 1], s));
  let i = 1; while (i < cum.length - 1 && cum[i] < s) i++;
  const L = cum[i] - cum[i - 1] || 1, t = (s - cum[i - 1]) / L;
  const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
  return { x: ax + (bx - ax) * t, z: az + (bz - az) * t, dx: (bx - ax) / L, dz: (bz - az) / L };
}
export function polyProject(pts, cum, x, z) {
  let best = { s: 0, d: Infinity };
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
    const px = ax + dx * t, pz = az + dz * t, d = Math.hypot(x - px, z - pz);
    if (d < best.d) best = { s: cum[i - 1] + t * Math.sqrt(l2), d };
  }
  return best;
}

// ---------------- Materialien / Instanz-Stapel ----------------
let _m = null;
function mats() {
  if (_m) return _m;
  const S = (c, r = 0.9, m = 0) => { const x = new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m }); x.userData.shared = true; return x; };
  _m = {
    stone: S(0x9b907c), stoneDark: S(0x7a705f), concrete: S(0x9a9a94), concreteDark: S(0x76766f), asphalt: S(0x3a3c3f, 0.95), marking: S(0xe6e3d6, 0.7),
    steel: S(0x4f5b58, 0.55, 0.55), steelLight: S(0x8a9396, 0.45, 0.6), rust: S(0x6a4a36, 0.8, 0.3), wood: S(0x6a4e33), plank: S(0x8a6a44), pontoon: S(0x3f4a34, 0.7, 0.3),
    ballast: S(0x5c5852), rubble: S(0x77736a), rope: S(0x2c2a26),
  };
  return _m;
}
const BOX = new THREE.BoxGeometry(1, 1, 1); BOX.userData.shared = true;
class Batch {
  constructor() { this.m = new Map(); }
  box(mat, w, h, d, x, y, z, ry = 0, rx = 0, rz = 0) { let l = this.m.get(mat); if (!l) this.m.set(mat, (l = [])); if (w > 0 && h > 0 && d > 0) l.push([w, h, d, x, y, z, ry, rx, rz]); }
  build(name) {
    const g = new THREE.Group(); g.name = name || 'batch';
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), p = new THREE.Vector3(), s = new THREE.Vector3();
    for (const [mat, list] of this.m) {
      if (!list.length) continue;
      const im = new THREE.InstancedMesh(BOX, mat, list.length);
      list.forEach((a, i) => { e.set(a[7], a[6], a[8], 'YXZ'); q.setFromEuler(e); im.setMatrixAt(i, m4.compose(p.set(a[3], a[4], a[5]), q, s.set(a[0], a[1], a[2]))); });
      im.castShadow = true; im.receiveShadow = true;
      im.computeBoundingSphere();
      g.add(im);
    }
    return g;
  }
}

export class BridgeSystem {
  constructor(game) {
    this.g = game;
    this.list = [];
    this.stats = { destroyed: 0, built: 0 };
    this._install();
  }
  // Fahrbahn: terrain.height liefert auf der Brücke die Deckhöhe (Instanz-Methode, Gelände-Netz ist bereits gebaut)
  _install() {
    const T = this.g.terrain, self = this;
    if (!T || T._deckBase) return;
    const base = T.height;
    T._deckBase = base;
    T.height = function (x, z) {
      if (!this._deckOff) for (let i = 0; i < self.list.length; i++) {
        const b = self.list[i], bb = b.bb;
        if (x < bb[0] || x > bb[2] || z < bb[1] || z > bb[3]) continue;
        const y = self.deckAt(b, x, z);
        if (y !== null) return y;
      }
      return base.call(this, x, z);
    };
  }
  baseHeight(x, z) { return this.g.terrain._deckBase.call(this.g.terrain, x, z); }
  deckAt(b, x, z) {
    const p = polyProject(b.pts, b.cum, x, z);
    if (p.d > b.width / 2 + 0.35 || p.s < b.sA - 0.6 || p.s > b.sB + 0.6) return null;
    if (b.state === 'destroyed' && p.s > b.gA && p.s < b.gB) return null;
    return b.deck;
  }
  byId(id) { return this.list.find((b) => b.id === id || String(b.id) === String(id)) || null; }
  nearest(x, z, r = 30) {
    let best = null, bd = r;
    for (const b of this.list) { const p = polyProject(b.pts, b.cum, x, z); if (p.d < bd && p.s > b.sA - 15 && p.s < b.sB + 15) { bd = p.d; best = b; } }
    return best;
  }
  eraStyle(kind) {
    if (kind === 'rail') return 'steel_truss';
    const g = this.g, m = g.mission || {};
    let era = m.era || m.meta?.era || m.place?.era;
    if (!era) { const d = String(m.date || ''); era = /19[34]\d/.test(d) ? 'ww2' : /afghan|198\d|200\d/i.test(d) ? 'afghan' : g.terrain?.palette === 'afghan' ? 'afghan' : 'modern'; }
    return era === 'ww2' || era === 'ww1' ? 'stone_arch' : era === 'afghan' ? 'wood' : 'concrete_beam';
  }

  // ======================= Anlegen =======================
  fromCauseways() {
    if (this._fromCw) return;
    this._fromCw = true;
    for (const f of this.g.terrain.features || []) if (f.type === 'causeway' && f.pts?.length >= 2) this.add(f.pts, { width: f.width || 8, style: f.style, kind: f.kind, name: f.name, causeway: true });
  }
  add(pts, o = {}) {
    const g = this.g, T = g.terrain;
    if (!T?.hasWater || !Array.isArray(pts) || pts.length < 2) return null;
    const width = o.width || 8, kind = o.kind === 'rail' ? 'rail' : 'road';
    const style = BRIDGE_STYLES.includes(o.style) ? o.style : this.eraStyle(kind);
    const P = pts.map((p) => [+p[0], +p[1]]), cum = polyLen(P), L = cum[cum.length - 1];
    // Wasserabschnitte (echtes Gelände), Unterbrechungen < 70 m (Inseln) zusammenfassen
    T._deckOff = true;
    const runs = [];
    let cur = null;
    for (let s = 0; s <= L; s += 1) {
      const p = polyAt(P, cum, s);
      if (T.isWater(p.x, p.z)) { if (!cur) cur = [s, s]; else cur[1] = s; } else if (cur) { runs.push(cur); cur = null; }
    }
    if (cur) runs.push(cur);
    T._deckOff = false;
    const merged = [];
    for (const r of runs) { const last = merged[merged.length - 1]; if (last && r[0] - last[1] < 70) last[1] = r[1]; else merged.push([...r]); }
    const run = merged.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]))[0];
    if (!run || run[1] - run[0] < 2) return null;
    const sea = T.seaLevel, sA = Math.max(0, run[0] - 1.5), sB = Math.min(L, run[1] + 1.5), span = sB - sA;
    const hAbove = style === 'pontoon' ? 0.35 : style === 'wood' ? clamp(1.8 + span * 0.02, 2, 2.8)
      : style === 'stone_arch' ? clamp(2.8 + span * 0.04, 3, 5.5) : style === 'steel_truss' ? clamp(3.2 + span * 0.025, 3.5, 6)
        : style === 'cable_arch' ? 6 : clamp(2.8 + span * 0.03, 3, 6);
    const b = {
      id: o.id ?? this.list.length + 1, name: o.name || null, kind, style, width, pts: P, cum, sA, sB, deck: sea + hAbove,
      state: 'intact', maxHp: o.hp || (style === 'wood' ? BR.hp.wood : style === 'pontoon' ? BR.hp.pontoon : BR.hp[kind]), hp: 0, build: 0,
      boats: hAbove >= 2.5, group: null, parts: {}, wreck: null, repairVis: null, causeway: !!o.causeway,
    };
    b.hp = b.maxHp;
    // Felder/Pfeiler: Mittelfeld = sprengbarer Abschnitt
    let piers = [];
    if (style === 'cable_arch') {
      const A = clamp(span * 0.25, 30, 70), mid = (sA + sB) / 2;
      b.gA = mid - A / 2; b.gB = mid + A / 2;
      for (let s = b.gA; s > sA + 4; s -= BR.span.cable_arch) piers.push(s);
      for (let s = b.gB; s < sB - 4; s += BR.span.cable_arch) piers.push(s);
      piers.sort((x, y) => x - y);
    } else {
      const n = Math.max(1, Math.round(span / BR.span[style]));
      for (let i = 1; i < n; i++) piers.push(sA + (i * span) / n);
      if (n >= 3) { const k = Math.floor(n / 2), all = [sA, ...piers, sB]; b.gA = all[k]; b.gB = all[k + 1]; }
      else { const mid = (sA + sB) / 2; b.gA = mid - span * 0.22; b.gB = mid + span * 0.22; }
    }
    b.piers = style === 'pontoon' ? [] : piers;
    const c = polyAt(P, cum, (b.gA + b.gB) / 2); b.cx = c.x; b.cz = c.z;
    // Rampen/Widerlager an beiden Ufern bis zur Fahrbahnhöhe
    b.ramp = style === 'pontoon' ? 4 : clamp(hAbove * 5.5, 8, 32);
    this._ramps(b);
    // Hüllrechteck für die Höhenabfrage
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (let s = sA - 1; s <= sB + 1; s += 1) { const p = polyAt(P, cum, s); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
    const pad = width / 2 + 1;
    b.bb = [x0 - pad, z0 - pad, x1 + pad, z1 + pad];
    this.list.push(b);
    this._grid(b, sA - b.ramp, sB + b.ramp, width / 2, 'land');
    this._visual(b);
    return b;
  }
  _rect(b, s0, s1, pad) {
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (let s = s0; s <= s1 + 0.01; s += 1) { const p = polyAt(b.pts, b.cum, s); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
    return [x0 - pad, z0 - pad, x1 + pad, z1 + pad];
  }
  _ramps(b) {
    const T = this.g.terrain, L = b.cum[b.cum.length - 1], hw = b.width / 2;
    const sides = [[Math.max(0, b.sA - b.ramp), b.sA, 1], [b.sB, Math.min(L, b.sB + b.ramp), -1]];
    T._deckOff = true;
    for (const [s0, s1, dir] of sides) {
      if (s1 - s0 < 0.5) continue;
      const [x0, z0, x1, z1] = this._rect(b, s0, s1, hw + 5);
      T.editHeights(x0, z0, x1, z1, (x, z, h) => {
        const p = polyProject(b.pts, b.cum, x, z);
        if (p.s < s0 - 0.5 || p.s > s1 + 0.5) return h;
        const t = dir > 0 ? (p.s - s0) / (s1 - s0) : (s1 - p.s) / (s1 - s0); // 0 am Ende der Rampe, 1 am Wasser
        const lat = 1 - sstep((p.d - hw - 0.6) / 3.8);
        if (lat <= 0) return h;
        const target = h + (b.deck - h) * sstep(t * 1.05);
        return Math.max(h, h + (target - h) * lat);
      });
    }
    T._deckOff = false;
  }
  // Pfadraster: 'land' (Fahrbahn/Rampe begehbar; Boote unter hohen Brücken) bzw. 'water' (eingestürztes Mittelfeld)
  _grid(b, s0, s1, hw, mode) {
    const g = this.g, T = g.terrain, [x0, z0, x1, z1] = this._rect(b, s0, s1, hw + 2);
    const [i0, j0] = T.cellOf(x0, z0), [i1, j1] = T.cellOf(x1, z1);
    T._deckOff = true;
    for (let j = Math.max(0, j0); j <= Math.min(T.gw - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(T.gw - 1, i1); i++) {
      const [cx, cz] = T.cellCenter(i, j), p = polyProject(b.pts, b.cum, cx, cz);
      if (p.d > hw || p.s < s0 || p.s > s1) continue;
      const k = j * T.gw + i, h = T.height(cx, cz);
      if (mode === 'water') { T.gWater[k] = h < T.seaLevel + 0.15 ? 1 : 0; T.gDeepWater[k] = h < T.seaLevel - 1 ? 1 : 0; T.gRoad[k] = 0; }
      else {
        T.gWater[k] = 0; T.gRoad[k] = 1;
        if (T.gBlocked[k] === 1 || T.gBlocked[k] === 2) T.gBlocked[k] = 0;
        T.gDeepWater[k] = b.boats && p.s > b.sA && p.s < b.sB && h < T.seaLevel - 1 ? 1 : 0;
      }
    }
    T._deckOff = false;
    const pf = g.pathfinder;
    if (pf?.clr) pf.buildField(); // Wasser ändert das Abstandsfeld (nicht über gBlocked/gHard erkennbar)
    if (pf?.heavy?.clr) pf.heavy.buildField();
  }

  // ======================= Optik =======================
  _segs(b, s0, s1) {
    const out = [];
    for (let i = 1; i < b.pts.length; i++) {
      const a = Math.max(s0, b.cum[i - 1]), e = Math.min(s1, b.cum[i]);
      if (e - a < 0.02) continue;
      const p0 = polyAt(b.pts, b.cum, a), p1 = polyAt(b.pts, b.cum, e);
      out.push({ a, e, len: e - a, mx: (p0.x + p1.x) / 2, mz: (p0.z + p1.z) / 2, ry: Math.atan2(p1.x - p0.x, p1.z - p0.z), p0, p1 });
    }
    return out;
  }
  // Seitlicher Versatz o (rechts +) und Längsversatz u relativ zu Punkt p mit Richtung ry
  _off(p, ry, o, u = 0) { return [p.x + Math.cos(ry) * o + Math.sin(ry) * u, p.z - Math.sin(ry) * o + Math.cos(ry) * u]; }
  _deckPiece(b, B, s0, s1, M) {
    const st = b.style, hw = b.width / 2, D = b.deck;
    const th = st === 'stone_arch' ? 1.1 : st === 'wood' ? 0.35 : st === 'pontoon' ? 0.16 : st === 'steel_truss' ? 0.6 : 0.9;
    const deckMat = st === 'stone_arch' ? M.stone : st === 'wood' || st === 'pontoon' ? M.plank : M.concrete;
    for (const sg of this._segs(b, s0, s1)) {
      const { mx, mz, ry, len } = sg;
      B.box(deckMat, b.width + 0.6, th, len + 0.02, mx, D - th / 2 - 0.01, mz, ry);
      if (b.kind === 'road' && st !== 'wood' && st !== 'pontoon') {
        B.box(M.asphalt, b.width - 1.7, 0.05, len, mx, D + 0.005, mz, ry);
        for (const sd of [-1, 1]) { const [x, z] = this._off({ x: mx, z: mz }, ry, sd * (hw - 0.42)); B.box(st === 'stone_arch' ? M.stoneDark : M.concreteDark, 0.84, 0.16, len, x, D + 0.07, z, ry); }
        if (b.width >= 6) for (let u = 1.5; u < len - 1; u += 6) { const t = (u + 1.5) / len; const x = sg.p0.x + (sg.p1.x - sg.p0.x) * t, z = sg.p0.z + (sg.p1.z - sg.p0.z) * t; B.box(M.marking, 0.14, 0.02, 3, x, D + 0.04, z, ry); }
      } else if (b.kind === 'rail') B.box(M.ballast, b.width - 1, 0.12, len, mx, D + 0.02, mz, ry);
      // Brüstung / Geländer
      for (const sd of [-1, 1]) {
        const [x, z] = this._off({ x: mx, z: mz }, ry, sd * (hw + 0.1));
        if (st === 'stone_arch') { B.box(M.stone, 0.5, 1.0, len, x, D + 0.5, z, ry); B.box(M.stoneDark, 0.66, 0.12, len, x, D + 1.06, z, ry); }
        else if (st === 'wood' || st === 'pontoon') {
          B.box(st === 'pontoon' ? M.rope : M.wood, 0.1, 0.1, len, x, D + (st === 'pontoon' ? 0.8 : 0.95), z, ry);
          for (let u = 0; u <= len; u += 2.5) { const t = u / len; B.box(M.wood, 0.14, st === 'pontoon' ? 0.85 : 1.0, 0.14, sg.p0.x + (sg.p1.x - sg.p0.x) * t + (x - mx), D + 0.45, sg.p0.z + (sg.p1.z - sg.p0.z) * t + (z - mz), ry); }
        } else {
          B.box(M.concreteDark, 0.35, 0.3, len, x, D + 0.15, z, ry);
          B.box(M.steelLight, 0.07, 0.07, len, x, D + 1.05, z, ry); B.box(M.steelLight, 0.05, 0.05, len, x, D + 0.65, z, ry);
          for (let u = 0; u <= len; u += 2.5) { const t = u / len; B.box(M.steelLight, 0.07, 0.95, 0.07, sg.p0.x + (sg.p1.x - sg.p0.x) * t + (x - mx), D + 0.55, sg.p0.z + (sg.p1.z - sg.p0.z) * t + (z - mz), ry); }
        }
      }
    }
    return th;
  }
  // Unterbau eines Feldes [a, e] (zwischen zwei Pfeilern)
  _span(b, B, grp, a, e, M) {
    const st = b.style, T = this.g.terrain, sea = T.seaLevel, D = b.deck, hw = b.width / 2, len = e - a;
    const p = polyAt(b.pts, b.cum, (a + e) / 2), ry = Math.atan2(p.dx, p.dz);
    if (st === 'stone_arch') {
      const th = 1.1, top = D - th, bot = sea - 3, pier = Math.min(1.2, len * 0.12);
      const rx = len / 2 - pier, spring = sea - 0.2, rh = Math.max(0.8, top - 0.55 - spring);
      const sh = new THREE.Shape();
      sh.moveTo(-len / 2, bot); sh.lineTo(len / 2, bot); sh.lineTo(len / 2, top); sh.lineTo(-len / 2, top); sh.lineTo(-len / 2, bot);
      const hole = new THREE.Path();
      hole.moveTo(-rx, bot + 0.4); hole.lineTo(-rx, spring); hole.absellipse(0, spring, rx, rh, Math.PI, 0, true); hole.lineTo(rx, bot + 0.4); hole.lineTo(-rx, bot + 0.4);
      sh.holes.push(hole);
      const geo = new THREE.ExtrudeGeometry(sh, { depth: b.width + 0.5, bevelEnabled: false, curveSegments: 12 });
      geo.translate(0, 0, -(b.width + 0.5) / 2);
      const m = new THREE.Mesh(geo, M.stone); m.position.set(p.x, 0, p.z); m.rotation.y = ry - Math.PI / 2; m.castShadow = true; m.receiveShadow = true;
      grp.add(m);
      // Bogenstirn (Keilsteine) als dunkler Saum
      for (let k = 0; k <= 8; k++) { const ang = Math.PI * (1 - k / 8), u = Math.cos(ang) * rx, v = spring + Math.sin(ang) * rh; for (const sd of [-1, 1]) { const [x, z] = this._off(p, ry, sd * (hw + 0.27), u); B.box(M.stoneDark, 0.1, 0.5, 0.9, x, v + 0.2, z, ry, -ang + Math.PI / 2); } }
    } else if (st === 'concrete_beam' || st === 'cable_arch') {
      B.box(M.concreteDark, b.width * 0.55, 1.3, len, p.x, D - 0.9 - 0.65, p.z, ry);
    } else if (st === 'steel_truss') {
      const n = Math.max(2, Math.round(len / 4)), pl = len / n, hgt = (t) => 2.6 + 3.2 * Math.sin(Math.PI * t);
      for (const sd of [-1, 1]) {
        const o = sd * (hw + 0.35);
        const [bx, bz] = this._off(p, ry, o); B.box(M.steel, 0.32, 0.45, len, bx, D + 0.15, bz, ry);
        for (let i = 0; i < n; i++) {
          const t0 = i / n, t1 = (i + 1) / n, u0 = -len / 2 + i * pl, u1 = u0 + pl, h0 = hgt(t0), h1 = hgt(t1);
          const [tx, tz] = this._off(p, ry, o, (u0 + u1) / 2);
          B.box(M.steel, 0.3, 0.3, Math.hypot(pl, h1 - h0) + 0.05, tx, D + (h0 + h1) / 2, tz, ry, -Math.atan2(h1 - h0, pl));
          const [vx, vz] = this._off(p, ry, o, u1); if (i < n - 1) B.box(M.steel, 0.18, h1, 0.18, vx, D + h1 / 2, vz, ry);
          const up = i < n / 2, dh = up ? h1 : h0;
          B.box(M.steel, 0.14, 0.14, Math.hypot(pl, dh), tx, D + dh / 2, tz, ry, (up ? -1 : 1) * Math.atan2(dh, pl));
          if (i % 2 === 0) { const [cx, cz] = this._off(p, ry, 0, (u0 + u1) / 2); B.box(M.steel, b.width + 0.7, 0.14, 0.14, cx, D + Math.min(h0, h1) - 0.1, cz, ry); }
        }
      }
    } else if (st === 'wood') {
      B.box(M.wood, b.width * 0.7, 0.3, len, p.x, D - 0.5, p.z, ry);
    }
  }
  _pier(b, B, s, M) {
    const st = b.style, sea = this.g.terrain.seaLevel, D = b.deck, hw = b.width / 2;
    const p = polyAt(b.pts, b.cum, s), ry = Math.atan2(p.dx, p.dz), bot = sea - 3.5;
    if (st === 'stone_arch') { B.box(M.stoneDark, b.width + 1.0, sea + 0.8 - bot, 2.0, p.x, (sea + 0.8 + bot) / 2, p.z, ry); return; }
    if (st === 'steel_truss') { const top = D - 0.6; B.box(M.stone, b.width + 2, top - bot, 2.8, p.x, (top + bot) / 2, p.z, ry); B.box(M.stoneDark, b.width + 2.4, 0.5, 3.2, p.x, top - 0.25, p.z, ry); return; }
    if (st === 'wood') { for (const sd of [-1, 1]) { const [x, z] = this._off(p, ry, sd * (hw - 0.4)); B.box(M.wood, 0.32, D - bot, 0.32, x, (D + bot) / 2, z, ry); } B.box(M.wood, b.width, 0.18, 0.18, p.x, (D + sea) / 2, p.z, ry, 0, 0.35); return; }
    const top = D - 0.9 - 1.3;
    for (const sd of [-1, 1]) { const [x, z] = this._off(p, ry, sd * hw * 0.32); B.box(M.concrete, 1.2, top - bot, 1.2, x, (top + bot) / 2, z, ry); }
    B.box(M.concrete, b.width * 0.85, 0.9, 1.6, p.x, top - 0.1, p.z, ry);
  }
  _visual(b) {
    const g = this.g, M = mats(), sea = g.terrain.seaLevel, st = b.style;
    const grp = new THREE.Group(); grp.name = 'bridge' + b.id;
    const parts = {};
    for (const [key, s0, s1] of [['left', b.sA - 0.3, b.gA], ['mid', b.gA, b.gB], ['right', b.gB, b.sB + 0.3]]) {
      const B = new Batch(), pg = new THREE.Group(); pg.name = key;
      this._deckPiece(b, B, s0, s1, M);
      const bounds = [b.sA, ...b.piers, b.sB];
      for (let i = 0; i < bounds.length - 1; i++) { const a = bounds[i], e = bounds[i + 1], m = (a + e) / 2; if (m > s0 && m < s1) this._span(b, B, pg, a, e, M); }
      if (st === 'pontoon') for (let s = s0 + 1.2; s < s1; s += 2.4) { const p = polyAt(b.pts, b.cum, s); B.box(M.pontoon, b.width + 1.2, 0.8, 2.0, p.x, sea - 0.05, p.z, Math.atan2(p.dx, p.dz)); }
      if (st === 'cable_arch' && key === 'mid') this._arch(b, B, M);
      pg.add(B.build(key));
      parts[key] = pg; grp.add(pg);
    }
    // Pfeiler (bleiben stehen) und Widerlager
    const S = new Batch();
    for (const s of b.piers) this._pier(b, S, s, M);
    if (st !== 'pontoon') for (const s of [b.sA - 1.2, b.sB + 1.2]) {
      const p = polyAt(b.pts, b.cum, s), ry = Math.atan2(p.dx, p.dz), bot = sea - 3;
      S.box(st === 'stone_arch' || st === 'steel_truss' ? M.stone : st === 'wood' ? M.wood : M.concrete, b.width + 1.6, b.deck - 0.05 - bot, 3.2, p.x, (b.deck - 0.05 + bot) / 2, p.z, ry);
    }
    grp.add(S.build('piers'));
    grp.traverse((o) => { o.raycast = () => {}; o.userData.bridge = b.id; });
    g.world.add(grp);
    b.group = grp; b.parts = parts;
  }
  // Stahlbogen über der Fahrrinne (Krimbrücke): Bogen beidseitig, Hänger
  _arch(b, B, M) {
    const a = b.gA, e = b.gB, len = e - a, H = Math.min(16, len * 0.28), D = b.deck, hw = b.width / 2;
    const p = polyAt(b.pts, b.cum, (a + e) / 2), ry = Math.atan2(p.dx, p.dz), n = 14;
    const y = (t) => D + H * 4 * t * (1 - t);
    for (const sd of [-1, 1]) {
      const o = sd * (hw + 0.4);
      for (let i = 0; i < n; i++) {
        const t0 = i / n, t1 = (i + 1) / n, u0 = -len / 2 + t0 * len, u1 = -len / 2 + t1 * len;
        const [x, z] = this._off(p, ry, o, (u0 + u1) / 2);
        B.box(M.steelLight, 0.6, 0.8, Math.hypot(u1 - u0, y(t1) - y(t0)) + 0.1, x, (y(t0) + y(t1)) / 2, z, ry, -Math.atan2(y(t1) - y(t0), u1 - u0));
        if (i) { const [hx, hz] = this._off(p, ry, o, u0); B.box(M.steelLight, 0.07, y(t0) - D, 0.07, hx, (y(t0) + D) / 2, hz, ry); }
      }
    }
    for (let i = 2; i < n - 1; i += 2) { const t = i / n, [x, z] = this._off(p, ry, 0, -len / 2 + t * len); B.box(M.steelLight, b.width + 0.8, 0.3, 0.3, x, y(t) - 0.2, z, ry); }
  }
  _wreckVisual(b) {
    const g = this.g, M = mats(), sea = g.terrain.seaLevel, st = b.style;
    if (b.wreck) { b.wreck.visible = true; return; }
    const B = new Batch(), hl = (b.gB - b.gA) / 2;
    const deckMat = st === 'stone_arch' ? M.stone : st === 'wood' || st === 'pontoon' ? M.plank : M.concrete;
    for (const [s, sg] of [[b.gA, 1], [b.gB, -1]]) {
      const p = polyAt(b.pts, b.cum, s), ry = Math.atan2(p.dx, p.dz) + (sg < 0 ? Math.PI : 0);
      const L = hl * 0.92, drop = b.deck - (sea - 1.2), tilt = Math.min(1.25, Math.atan2(drop, L));
      const cl = L / 2;
      // Platte hängt am Pfeiler, kippt zur Mitte ins Wasser
      const cx = p.x + Math.sin(ry) * Math.cos(tilt) * cl, cz = p.z + Math.cos(ry) * Math.cos(tilt) * cl, cy = b.deck - 0.4 - Math.sin(tilt) * cl;
      B.box(deckMat, b.width + 0.4, 0.8, L, cx, cy, cz, ry, tilt, sg * 0.05);
      if (st === 'steel_truss' || st === 'cable_arch') for (const sd of [-1, 1]) { const ox = Math.cos(ry) * sd * (b.width / 2 + 0.3), oz = -Math.sin(ry) * sd * (b.width / 2 + 0.3); B.box(M.rust, 0.3, 2.4, L * 0.9, cx + ox, cy + 1.2, cz + oz, ry, tilt * 0.8, sd * 0.25); }
      else B.box(st === 'stone_arch' ? M.stoneDark : M.steelLight, 0.4, 0.8, L * 0.8, cx + Math.cos(ry) * (b.width / 2), cy + 0.5, cz - Math.sin(ry) * (b.width / 2), ry, tilt);
    }
    for (let i = 0; i < 14; i++) {
      const s = b.gA + Math.random() * (b.gB - b.gA), p = polyAt(b.pts, b.cum, s), ry = Math.atan2(p.dx, p.dz);
      const [x, z] = this._off(p, ry, rand(-b.width / 2, b.width / 2));
      B.box(st === 'stone_arch' ? M.stone : M.rubble, rand(0.6, 2.2), rand(0.5, 1.2), rand(0.6, 2.4), x, sea - rand(0, 0.5), z, rand(0, 3), rand(-0.5, 0.5), rand(-0.5, 0.5));
    }
    const w = B.build('wreck'); w.name = 'bridgeWreck' + b.id;
    w.traverse((o) => { o.raycast = () => {}; });
    g.world.add(w);
    b.wreck = w;
  }
  // Notbrücke (Bailey-Bauart) bzw. Ponton im eingestürzten Mittelfeld
  _repairVisual(b) {
    const g = this.g, M = mats(), sea = g.terrain.seaLevel;
    if (b.repairVis) { b.repairVis.visible = true; return; }
    const B = new Batch(), D = b.deck, hw = b.width / 2;
    for (const sg of this._segs(b, b.gA - 0.4, b.gB + 0.4)) {
      const { mx, mz, ry, len } = sg;
      B.box(M.plank, b.width - 0.6, 0.25, len, mx, D - 0.12, mz, ry);
      if (b.style === 'pontoon' || D - sea < 1.2) { for (let u = 1; u < len; u += 2.4) { const t = u / len; B.box(M.pontoon, b.width + 1.2, 0.8, 2.0, sg.p0.x + (sg.p1.x - sg.p0.x) * t, sea - 0.05, sg.p0.z + (sg.p1.z - sg.p0.z) * t, ry); } continue; }
      for (const sd of [-1, 1]) {
        const o = sd * (hw - 0.1);
        const [x, z] = this._off({ x: mx, z: mz }, ry, o);
        B.box(M.steel, 0.2, 0.25, len, x, D + 0.12, z, ry); B.box(M.steel, 0.2, 0.25, len, x, D + 1.7, z, ry);
        for (let u = 0; u <= len; u += 1.5) { const t = u / len, [vx, vz] = [sg.p0.x + (sg.p1.x - sg.p0.x) * t + (x - mx), sg.p0.z + (sg.p1.z - sg.p0.z) * t + (z - mz)]; B.box(M.steel, 0.12, 1.6, 0.12, vx, D + 0.9, vz, ry); if (u + 1.5 <= len) { const t2 = (u + 0.75) / len; B.box(M.steel, 0.1, 0.1, 2.2, sg.p0.x + (sg.p1.x - sg.p0.x) * t2 + (x - mx), D + 0.9, sg.p0.z + (sg.p1.z - sg.p0.z) * t2 + (z - mz), ry, ((u / 1.5) % 2 ? 1 : -1) * 0.82); } }
      }
      for (const sd of [-1, 1]) { const [hx, hz] = this._off({ x: mx, z: mz }, ry, sd * hw * 0.5); B.box(M.steel, 0.4, D - sea + 2.5, 0.4, hx, (D + sea - 2.5) / 2, hz, ry); } // Hilfsstützen im Wasser
    }
    const r = B.build('repair'); r.name = 'bridgeRepair' + b.id;
    r.traverse((o) => { o.raycast = () => {}; });
    g.world.add(r);
    b.repairVis = r;
  }

  // ======================= Zustände =======================
  destroy(b, cause = 'fire', fromNet = false) {
    const g = this.g;
    if (!b || b.state === 'destroyed') return false;
    const was = b.state;
    b.state = 'destroyed'; b.hp = 0; b.build = 0;
    this._grid(b, b.gA, b.gB, b.width / 2 + 0.6, 'water');
    b.parts.mid.visible = false;
    if (was === 'repaired' && b.repairVis) b.repairVis.visible = false;
    this._wreckVisual(b);
    g.rail?.onBridgeChange(b);
    const sea = g.terrain.seaLevel, fx = g.effects;
    for (let i = 0; i < 6; i++) {
      const p = polyAt(b.pts, b.cum, b.gA + Math.random() * (b.gB - b.gA));
      g.later(i * 0.18, () => fx.explosion(p.x + rand(-2, 2), i < 2 ? b.deck + 0.5 : sea + 0.3, p.z + rand(-2, 2), i === 0 ? 2.6 : 1.4, { crater: false, water: i > 1 }));
    }
    fx.addEmitter?.(new THREE.Object3D().translateX(b.cx).translateY(b.deck).translateZ(b.cz), 0.3, 30, 1.4);
    fx.shake = Math.max(fx.shake || 0, 1.2);
    if (!fromNet) {
      for (const u of [...g.units]) { // Einheiten auf dem einstürzenden Mittelfeld
        if (!u.alive || u.type.air || u.type.naval || u.type.structure) continue;
        const p = polyProject(b.pts, b.cum, u.pos.x, u.pos.z);
        if (p.d < b.width / 2 + 1 && p.s > b.gA - 0.5 && p.s < b.gB + 0.5) g.killUnit(u, null);
      }
      g.onObstacleAdded(b.cx, b.cz, (b.gB - b.gA) / 2 + b.width);
      this.stats.destroyed++;
      g.emit('bridgeDestroyed', b, cause);
      g.alertTo(null, `💥 ${b.name || 'Brücke'} ${b.kind === 'rail' ? '(Eisenbahn) ' : ''}zerstört!`, 3);
      g.net?.event?.(['br', b.id, 1], b.cx, b.cz, true);
    }
    return true;
  }
  repair(b, fromNet = false) {
    const g = this.g;
    if (!b || b.state !== 'destroyed') return false;
    b.state = 'repaired'; b.maxHp = BR.hp.repaired; b.hp = b.maxHp; b.build = 1;
    this._grid(b, b.gA - 0.5, b.gB + 0.5, b.width / 2, 'land');
    if (b.wreck) b.wreck.visible = true;
    this._repairVisual(b);
    g.rail?.onBridgeChange(b);
    if (!fromNet) {
      this.stats.built++;
      g.emit('bridgeBuilt', b);
      g.alertTo(null, `🔨 ${b.name || 'Brücke'}: Notbrücke befahrbar`, 3);
      g.net?.event?.(['br', b.id, 2], b.cx, b.cz, true);
    }
    return true;
  }
  applyState(id, code) {
    const b = this.byId(id), st = CODE_STATE[code];
    if (!b || !st || b.state === st) return;
    if (st === 'destroyed') this.destroy(b, 'net', true);
    else if (st === 'repaired') { if (b.state === 'intact') this.destroy(b, 'net', true); this.repair(b, true); }
  }
  stateCodes() { return this.list.map((b) => STATE_CODE[b.state]); }
  onBlast(x, z, r, dmg, w) {
    if (!this.list.length || !(dmg > 0)) return;
    for (const b of this.list) {
      if (b.state === 'destroyed') continue;
      const p = polyProject(b.pts, b.cum, x, z);
      if (p.d > b.width / 2 + r || p.s < b.sA - r || p.s > b.sB + r) continue;
      const k = Math.max(0.15, 1 - Math.max(0, p.d - b.width / 2) / Math.max(1, r));
      const mul = w?.vs ? (w.vs.struct ?? 0.5) : 0.5;
      b.hp -= dmg * mul * k * (p.s > b.gA - 3 && p.s < b.gB + 3 ? 1 : 0.5);
      if (b.hp <= 0) this.destroy(b, 'fire');
    }
  }

  // ======================= Pioniere =======================
  command(p, cmd, units) {
    const g = this.g;
    if (cmd.t !== 'blowbridge' && cmd.t !== 'buildbridge') return undefined;
    const b = this.byId(cmd.target);
    const eng = units.filter((u) => u.type.engineer && !u.abandoned && !u.garrison);
    if (!b || !eng.length) return false;
    const L = !!g.logistics;
    if (cmd.t === 'blowbridge') {
      if (b.state === 'destroyed') return false;
      if (L && eng.reduce((s, e) => s + e.material, 0) < BR.blowCost - 1e-6) return false;
      for (const e of eng) { e.job = null; e.bridgeJob = { bridge: b.id, kind: 'blow', phase: 'go', t: 0 }; this._goBank(e, b); }
      return true;
    }
    if (b.state !== 'destroyed') return false;
    if (L && !b.paid) {
      if (eng.reduce((s, e) => s + e.material, 0) < BR.buildCost - 1e-6) return false;
      let need = BR.buildCost;
      for (const e of eng) { const t = Math.min(e.material, need); e.material -= t; need -= t; if (need <= 1e-6) break; }
      b.paid = true;
    }
    for (const e of eng) { e.job = null; e.bridgeJob = { bridge: b.id, kind: 'build', phase: 'go', t: 0 }; this._goBank(e, b); }
    return true;
  }
  _bankPoint(e, b) {
    const pA = polyAt(b.pts, b.cum, b.gA - 2.5), pB = polyAt(b.pts, b.cum, b.gB + 2.5);
    return (pA.x - e.pos.x) ** 2 + (pA.z - e.pos.z) ** 2 < (pB.x - e.pos.x) ** 2 + (pB.z - e.pos.z) ** 2 ? pA : pB;
  }
  _goBank(e, b) { const q = this._bankPoint(e, b); e._goto(q.x, q.z); }
  jobStep(e, dt) {
    const g = this.g, J = e.bridgeJob, b = this.byId(J.bridge);
    if (!b || (J.kind === 'blow' && b.state === 'destroyed') || (J.kind === 'build' && b.state !== 'destroyed')) { e.bridgeJob = null; return; }
    const q = this._bankPoint(e, b);
    if (J.phase === 'go') {
      if ((q.x - e.pos.x) ** 2 + (q.z - e.pos.z) ** 2 > 4.5 * 4.5) { if (!e.order || !e.path?.length) e._goto(q.x, q.z); return; }
      e.order = null; e.path = null; J.phase = 'work'; J.t = 0;
    }
    e.working = g.time;
    e.heading = Math.atan2(b.cx - e.pos.x, b.cz - e.pos.z);
    if (J.kind === 'blow') {
      J.t += dt;
      if (J.t < BR.plant) return;
      if (g.logistics) { if (e.material < BR.blowCost - 1e-6) { const other = g.units.find((o) => o.bridgeJob?.bridge === b.id && o !== e && o.material >= BR.blowCost); if (!other) { e.bridgeJob = null; return; } other.material -= BR.blowCost; } else e.material -= BR.blowCost; }
      for (const o of g.units) if (o.bridgeJob?.bridge === b.id && o.bridgeJob.kind === 'blow') { o.bridgeJob = null; const a = Math.atan2(o.pos.x - b.cx, o.pos.z - b.cz); o.moveTo(o.pos.x + Math.sin(a) * 18, o.pos.z + Math.cos(a) * 18); }
      g.effects.marker(b.cx, b.cz, 0xff3030, BR.fuse, Math.max(4, b.width));
      g.sayTo(e.side, 'Pionier', `Sprengladung an der Brücke – Zünder ${BR.fuse} s!`, 3);
      g.emit('bridgeCharge', b, e);
      g.later(BR.fuse, () => { if (b.state !== 'destroyed') this.destroy(b, 'charge'); });
      return;
    }
    b.build = Math.min(1, (b.build || 0) + dt / BR.buildTime);
    if (Math.random() < dt * 1.2) g.effects.smallHit(q.x + rand(-1, 1), g.terrain.surface(q.x, q.z) + 0.4, q.z + rand(-1, 1));
    if (b.build >= 1) {
      for (const o of g.units) if (o.bridgeJob?.bridge === b.id) o.bridgeJob = null;
      this.repair(b);
    }
  }
}
