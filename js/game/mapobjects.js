// V3-M2: Kartenelemente zur Laufzeit – Hindernisse walzen, Brücken (sprengen, beschießen, Ponton-/Notbrücke bauen) und
// Motor-/Umgebungsklang.
//
// Walzen: Fahrzeuge mit type.crush (Kampfpanzer, schwere Kettenfahrzeuge; unitTypes.prepareType) zerstören beim Darüberfahren
//   Bäume, Büsche, Hecken (terrain.removeTreeAt/removeBushAt/removeHedgeAt) und Sandsackwälle; kurze Verlangsamung (u.crushT),
//   umfallender Baum / Laub als Optik. Leichte Fahrzeuge bleiben an Hecken blockiert (harte Zellen) und planen außen herum.
//   Wegfindung: unit.computePath → pathfinder.find(…, 'heavy') (gamepath.js), Hecken passierbar mit Kosten.
// Brücken (game.bridges): { id, kind 'road'|'rail', width, pts, state 'intact'|'destroyed'|'pontoon', hp, maxHp, cx, cz,
//   build (0..1 Baufortschritt) }. Quellen: game.addBridge(pts, {width, kind, hp}) (Mission), Dämme/Furten der
//   Gefechtskarten (bridgesFromCauseways) und Gleise über Wasser (rail.js). Zerstörung durch Pioniere ({t:'blowbridge',
//   ids, target: bridgeId}, Ladung 6 s + Zünder 10 s) oder schweren Beschuss (splashDamage → onBlast). Optik: eingestürztes
//   Mittelteil, Trümmer im Wasser; Pfadraster: Mittelteil wird Wasser. Wiederaufbau: {t:'buildbridge', ids, target}
//   (Pioniere, BR.buildTime s Arbeit ÷ Anzahl, Material BR.buildCost aus dem Vorrat) → Pontonbrücke.
//   Ereignisse: game.emit('bridgeDestroyed', b, cause) · game.emit('bridgeBuilt', b).
// Klang: fahrende Fahrzeuge/Luft-/Wasserfahrzeuge nahe der Kamera → audio.engine(id, kind, x, z, speed); Umgebung
//   (Epoche, Jahreszeit, Nacht, Regen, Gefechtsintensität) → audio.setAmbience.
import * as THREE from 'three';
import { rand } from '../engine/util.js';
import { CELL } from '../engine/terrain.js';

export const BR = {
  hp: { road: 2600, rail: 2200, pontoon: 900 },
  plant: 6, fuse: 10, blowCost: 2,
  buildTime: 40, buildCost: 3,
  deck: 0.06,
};
const d2 = (ax, az, bx, bz) => (ax - bx) * (ax - bx) + (az - bz) * (az - bz);
const fin = (v) => typeof v === 'number' && Number.isFinite(v);
const STATE_CODE = { intact: 0, destroyed: 1, pontoon: 2 };
const CODE_STATE = ['intact', 'destroyed', 'pontoon'];

// Polylinien-Helfer
function polyLen(pts) { const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return cum; }
function polyAt(pts, cum, s) {
  s = Math.max(0, Math.min(cum[cum.length - 1], s));
  let i = 1; while (i < cum.length - 1 && cum[i] < s) i++;
  const L = cum[i] - cum[i - 1] || 1, t = (s - cum[i - 1]) / L;
  const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
  return { x: ax + (bx - ax) * t, z: az + (bz - az) * t, dx: (bx - ax) / L, dz: (bz - az) / L };
}
// Projektion auf die Polylinie: { s (Bogenlänge), d (Abstand) }
function polyProject(pts, cum, x, z) {
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
export { polyLen, polyAt, polyProject };

let _mats = null;
function mats() {
  if (_mats) return _mats;
  const S = (c, r = 0.9, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  _mats = { concrete: S(0x8a8880), dark: S(0x5a5852), steel: S(0x6d7276, 0.5, 0.6), rust: S(0x6a4a36, 0.8, 0.3), wood: S(0x6e5236), plank: S(0x8a6a44), pontoon: S(0x3f4a34, 0.7, 0.3), trunk: S(0x4a3624), leaf: S(0x3d5a26, 1), leafDry: S(0x6b6a3a, 1), rubble: S(0x77736a) };
  for (const m of Object.values(_mats)) m.userData.shared = true;
  return _mats;
}
const BOX = new THREE.BoxGeometry(1, 1, 1); BOX.userData.shared = true;
function boxMesh(mat, w, h, d, x, y, z, ry = 0, rx = 0, rz = 0) {
  const m = new THREE.Mesh(BOX, mat);
  m.scale.set(w, h, d); m.position.set(x, y, z); m.rotation.set(rx, ry, rz, 'YXZ');
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

export class MapObjects {
  constructor(game) {
    this.g = game;
    this.bridges = [];
    this.acc = 0; this.sndAcc = 0; this.ambAcc = 0;
    this.decor = [];
    this.stats = { trees: 0, hedges: 0, bushes: 0, walls: 0, bridgesDestroyed: 0, bridgesBuilt: 0, engines: 0 };
    this._treeGrid = null;
  }
  bridgeById(id) { return this.bridges.find((b) => b.id === id || String(b.id) === String(id)) || null; }
  nearestBridge(x, z, r = 30) {
    let best = null, bd = r;
    for (const b of this.bridges) { const p = polyProject(b.pts, b.cum, x, z); if (p.d < bd) { bd = p.d; best = b; } }
    return best;
  }

  // ======================= Walzen =======================
  _trees() {
    if (this._treeGrid) return this._treeGrid;
    const G = new Map(), C = 8;
    for (const t of this.g.terrain.objects.trees) {
      const k = Math.floor(t.x / C) * 100003 + Math.floor(t.z / C);
      let a = G.get(k); if (!a) G.set(k, (a = [])); a.push(t);
    }
    return (this._treeGrid = { G, C });
  }
  treesNear(x, z, r) {
    const { G, C } = this._trees(), out = [];
    for (let i = Math.floor((x - r) / C); i <= Math.floor((x + r) / C); i++) for (let j = Math.floor((z - r) / C); j <= Math.floor((z + r) / C); j++) {
      const a = G.get(i * 100003 + j); if (!a) continue;
      for (const t of a) if (!t.gone && d2(t.x, t.z, x, z) < r * r) out.push(t);
    }
    return out;
  }
  _crushStep(v) {
    const g = this.g, T = g.terrain;
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    const x = v.pos.x + fx * v.radius * 0.5, z = v.pos.z + fz * v.radius * 0.5, r = v.radius * 0.95;
    let hit = 0;
    for (const t of this.treesNear(x, z, r)) { this.crush('tree', t.x, t.z, 0.4, v.heading, t.s); hit++; }
    // Hecken unter der Wanne
    const [ci, cj] = T.cellOf(x, z), cr = Math.ceil(r / CELL);
    for (let j = cj - cr; j <= cj + cr && T.gCrush; j++) for (let i = ci - cr; i <= ci + cr; i++) {
      if (i < 0 || j < 0 || i >= T.gw || j >= T.gw) continue;
      const k = j * T.gw + i;
      if (!T.gCrush[k]) continue;
      const [cx, cz] = T.cellCenter(i, j);
      if (d2(cx, cz, x, z) > (r + 1) * (r + 1)) continue;
      this.crush('hedge', cx, cz, 2.4, v.heading); hit++;
    }
    if (this.crush('b', x, z, r * 0.8)) this.stats.bushes++;
    // Sandsackwälle (leichte Mauern)
    for (const b of g.units) {
      if (!b.alive || !b.type.build || !b.type.build.cover || b.type.build.blocks || b.type.selfDig || !/sandbag|sangar/.test(b.type.key)) continue;
      if (d2(b.pos.x, b.pos.z, v.pos.x, v.pos.z) > (v.radius + b.radius * 0.6) ** 2) continue;
      this.stats.walls++; hit++;
      g.effects.explosion(b.pos.x, b.pos.y + 0.3, b.pos.z, 0.5, { crater: false, sound: false });
      g.logi.removeBuilding(b);
      g.emit('wallCrushed', b, v);
    }
    if (hit) { v.crushT = g.time + 0.8; g.emit('crushed', v, hit); }
  }
  // Optik + Raster (Host und Client). kind 'tree'|'hedge'|'bush'
  crush(kind, x, z, r, dir = 0, s = 1, fromNet = false) {
    const g = this.g, T = g.terrain;
    let n = 0;
    if (kind === 'tree') { n = T.removeTreeAt(x, z, r); if (n) { this.stats.trees += n; this._fallingTree(x, z, dir, s); } }
    else if (kind === 'hedge') { n = T.removeHedgeAt(x, z, r); if (T.gCrush) { const k = T.cellIndex(x, z); if (k >= 0 && T.gCrush[k]) { T.gCrush[k] = 0; if (!T.gBlocked[k]) T.gHard[k] = 0; n = n || 1; } } if (n) { this.stats.hedges += n; this._leaves(x, z, 1.2); } }
    else if (kind === 'b') { n = T.removeBushAt(x, z, r); if (n) this._leaves(x, z, 0.6); }
    if (n && !fromNet) g.net?.event?.(['cr', kind === 'tree' ? 't' : kind === 'hedge' ? 'h' : 'b', +x.toFixed(2), +z.toFixed(2), +r.toFixed(2), +dir.toFixed(2), +s.toFixed(2)], x, z);
    return n;
  }
  _fallingTree(x, z, dir, s = 1) {
    const g = this.g, M = mats();
    const grp = new THREE.Group();
    const h = 4.2 * s;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13 * s, 0.2 * s, h, 6), M.trunk); trunk.position.y = h / 2; trunk.castShadow = true; grp.add(trunk);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5 * s, 0), g.terrain.season === 'winter' ? M.leafDry : M.leaf); crown.position.y = h * 0.95; crown.scale.set(1, 0.8, 1); crown.castShadow = true; grp.add(crown);
    grp.position.set(x, g.terrain.height(x, z) - 0.1, z);
    grp.rotation.order = 'YXZ'; grp.rotation.y = dir;
    g.world.add(grp);
    this._keepDecor(grp);
    g.animations.push({ t: 0, dur: 0.7, fn: (k) => { grp.rotation.x = (Math.PI / 2 - 0.12) * k * k; } });
    this._leaves(x, z, 0.8);
  }
  _leaves(x, z, n = 1) {
    const fx = this.g.effects;
    const y = this.g.terrain.height(x, z);
    if (fx.smoke) for (let i = 0; i < 4 * n; i++) fx.smoke.emit(x + rand(-1, 1), y + rand(0.3, 1.2), z + rand(-1, 1), rand(-0.6, 0.6), rand(0.3, 1), rand(-0.6, 0.6), rand(0.5, 1), rand(1, 2), 0.32, 0.4, 0.2, 0.7, { grow: 1.2, drag: 1.2 });
  }
  _keepDecor(o) { this.decor.push(o); if (this.decor.length > 80) { const d = this.decor.shift(); d.parent?.remove(d); } }

  // ======================= Brücken =======================
  // Damm-/Furt-Features der Gefechtskarte als Brücken (nur Abschnitte über Wasser)
  bridgesFromCauseways() {
    for (const f of this.g.terrain.features || []) if (f.type === 'causeway' && f.pts?.length >= 2) this.addBridge(f.pts, { width: f.width || 6, causeway: true });
  }
  addBridge(pts, o = {}) {
    const g = this.g, T = g.terrain;
    if (!T.hasWater || !Array.isArray(pts) || pts.length < 2) return null;
    const width = o.width || 6, kind = o.kind || 'road';
    const cum = polyLen(pts), L = cum[cum.length - 1];
    // Wasserabschnitt suchen (Mitte oder beide Seiten nass)
    const wetAt = (s) => {
      const p = polyAt(pts, cum, s), off = width / 2 + 3.5;
      if (T.isWater(p.x, p.z)) return true;
      return T.isWater(p.x - p.dz * off, p.z + p.dx * off) && T.isWater(p.x + p.dz * off, p.z - p.dx * off);
    };
    let best = null, cur = null;
    for (let s = 0; s <= L; s += 1) {
      if (wetAt(s)) { if (!cur) cur = { a: s, b: s }; else cur.b = s; }
      else if (cur) { if (!best || cur.b - cur.a > best.b - best.a) best = cur; cur = null; }
    }
    if (cur && (!best || cur.b - cur.a > best.b - best.a)) best = cur;
    if (!best || best.b - best.a < 4) return null;
    const sA = Math.max(0, best.a - 2), sB = Math.min(L, best.b + 2);
    const mid = (sA + sB) / 2, gl = Math.max(6, Math.min(22, (sB - sA) * 0.45));
    const b = {
      id: o.id ?? this.bridges.length + 1, kind, width, pts: pts.map((p) => [p[0], p[1]]), cum, sA, sB, gA: mid - gl / 2, gB: mid + gl / 2,
      state: 'intact', maxHp: o.hp || BR.hp[kind] || BR.hp.road, hp: 0, build: 0, causeway: !!o.causeway, group: null, parts: {},
    };
    b.hp = b.maxHp;
    const c = polyAt(pts, cum, mid); b.cx = c.x; b.cz = c.z;
    this.bridges.push(b);
    // Fahrbahn über dem Wasser anheben (Missionsbrücke ohne Damm)
    if (!o.causeway) this._raise(b, sA, sB, T.seaLevel + 0.7, width / 2 + 0.6);
    this._buildVisual(b);
    return b;
  }
  // Rechteck um einen Polylinienabschnitt
  _bbox(b, s0, s1, pad) {
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (let s = s0; s <= s1 + 0.01; s += 1) { const p = polyAt(b.pts, b.cum, s); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
    return [x0 - pad, z0 - pad, x1 + pad, z1 + pad];
  }
  // Höhenfeld im Abschnitt [s0, s1] (Halbbreite hw) auf Höhe h setzen; fn(alt, neu, Randgewicht) mischt
  _shape(b, s0, s1, hw, mix) {
    const T = this.g.terrain, [x0, z0, x1, z1] = this._bbox(b, s0, s1, hw + 4);
    T.editHeights(x0, z0, x1, z1, (x, z, h) => {
      const p = polyProject(b.pts, b.cum, x, z);
      if (p.s < s0 - 1.5 || p.s > s1 + 1.5) return h;
      const e = Math.min(1, Math.max(0, (hw + 2.5 - p.d) / 2.5)) * Math.min(1, Math.max(0, Math.min(p.s - (s0 - 1.5), s1 + 1.5 - p.s) / 1.5));
      return e > 0 ? mix(h, e) : h;
    });
  }
  _raise(b, s0, s1, h, hw) { this._shape(b, s0, s1, hw, (old, e) => Math.max(old, old + (h - old) * e)); this._grid(b, s0, s1, hw, 'land'); }
  // Pfadraster im Abschnitt: 'land' (Fahrbahn) oder 'water'
  _grid(b, s0, s1, hw, mode) {
    const g = this.g, T = g.terrain, [x0, z0, x1, z1] = this._bbox(b, s0, s1, hw + 2);
    const [i0, j0] = T.cellOf(x0, z0), [i1, j1] = T.cellOf(x1, z1);
    const cells = [];
    for (let j = Math.max(0, j0); j <= Math.min(T.gw - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(T.gw - 1, i1); i++) {
      const [cx, cz] = T.cellCenter(i, j), p = polyProject(b.pts, b.cum, cx, cz);
      if (p.d > hw || p.s < s0 || p.s > s1) continue;
      const k = j * T.gw + i;
      if (mode === 'water') { T.gWater[k] = 1; T.gDeepWater[k] = 1; T.gRoad[k] = 0; if (T.gBlocked[k] === 1) T.gBlocked[k] = 0; }
      else { T.gWater[k] = 0; T.gDeepWater[k] = 0; if (T.gBlocked[k] === 1 || T.gBlocked[k] === 2) T.gBlocked[k] = 0; T.gRoad[k] = 1; }
      cells.push(k);
    }
    // Wasser ändert das Abstandsfeld (wird nicht über gBlocked/gHard erkannt) → neu aufbauen
    const pf = g.pathfinder;
    if (pf?.clr) pf.buildField();
    if (pf?.heavy?.clr) pf.heavy.buildField();
    return cells;
  }
  // ---------- Optik ----------
  _buildVisual(b) {
    const g = this.g, T = g.terrain, M = mats();
    const grp = new THREE.Group(); grp.name = 'bridge' + b.id;
    const deck = b.kind === 'rail' ? M.dark : M.concrete;
    const piece = (s0, s1) => {
      const pg = new THREE.Group();
      for (let i = 1; i < b.pts.length; i++) {
        const a = Math.max(s0, b.cum[i - 1]), e = Math.min(s1, b.cum[i]);
        if (e - a < 0.05) continue;
        const p0 = polyAt(b.pts, b.cum, a), p1 = polyAt(b.pts, b.cum, e);
        const len = e - a, mx = (p0.x + p1.x) / 2, mz = (p0.z + p1.z) / 2, ry = Math.atan2(p1.x - p0.x, p1.z - p0.z);
        const y = Math.max(T.seaLevel + 0.7, Math.min(T.height(p0.x, p0.z), T.height(p1.x, p1.z), T.height(mx, mz))) + BR.deck;
        pg.add(boxMesh(deck, b.width + 0.6, 0.4, len + 0.02, mx, y - 0.2, mz, ry));
        for (const sd of [-1, 1]) {
          const ox = Math.cos(ry) * sd * (b.width / 2 + 0.25), oz = -Math.sin(ry) * sd * (b.width / 2 + 0.25);
          pg.add(boxMesh(M.steel, 0.12, 0.12, len, mx + ox, y + 0.95, mz + oz, ry));
          pg.add(boxMesh(M.dark, 0.3, 0.25, len, mx + ox, y + 0.1, mz + oz, ry));
          const np = Math.max(1, Math.round(len / 2.6));
          for (let q = 0; q <= np; q++) { const t = q / np - 0.5; pg.add(boxMesh(M.steel, 0.1, 0.9, 0.1, mx + ox + Math.sin(ry) * len * t, y + 0.5, mz + oz + Math.cos(ry) * len * t, ry)); }
        }
      }
      return pg;
    };
    const parts = b.parts = { left: piece(b.sA, b.gA), mid: piece(b.gA, b.gB), right: piece(b.gB, b.sB) };
    grp.add(parts.left, parts.mid, parts.right);
    // Pfeiler
    for (let s = b.sA + 4; s < b.sB - 2; s += 8) {
      const p = polyAt(b.pts, b.cum, s), ry = Math.atan2(p.dx, p.dz);
      for (const sd of [-1, 1]) {
        const ox = Math.cos(ry) * sd * b.width * 0.3, oz = -Math.sin(ry) * sd * b.width * 0.3;
        const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 7, 8), M.dark); pil.position.set(p.x + ox, T.seaLevel - 2.6, p.z + oz); pil.castShadow = true;
        (s > b.gA - 1 && s < b.gB + 1 ? parts.mid : grp).add(pil);
      }
    }
    grp.traverse((o) => { o.raycast = () => {}; o.userData.bridge = b.id; });
    g.world.add(grp);
    b.group = grp;
  }
  _wreckVisual(b) {
    const g = this.g, T = g.terrain, M = mats();
    b.parts.mid.visible = false;
    const wr = new THREE.Group(); wr.name = 'bridgeWreck' + b.id;
    const sea = T.seaLevel;
    const half = (b.gB - b.gA) / 2;
    for (const [s0, s1, sg] of [[b.gA, b.gA + half, 1], [b.gB - half, b.gB, -1]]) {
      const p0 = polyAt(b.pts, b.cum, s0), p1 = polyAt(b.pts, b.cum, s1);
      const len = s1 - s0, ry = Math.atan2(p1.x - p0.x, p1.z - p0.z);
      // am Ende eingehängt, schräg ins Wasser gekippt
      const hinge = sg > 0 ? p0 : p1, tilt = sg * 0.38;
      const slab = new THREE.Group(); slab.position.set(hinge.x, sea + 0.75, hinge.z); slab.rotation.order = 'YXZ'; slab.rotation.y = ry; slab.rotation.x = tilt;
      slab.add(boxMesh(b.kind === 'rail' ? M.dark : M.concrete, b.width + 0.6, 0.4, len * 0.9, 0, -0.2, sg * len * 0.45));
      slab.add(boxMesh(M.rust, 0.12, 0.12, len * 0.85, b.width / 2 + 0.25, 0.7, sg * len * 0.42));
      wr.add(slab);
    }
    for (let i = 0; i < 9; i++) {
      const s = b.gA + Math.random() * (b.gB - b.gA), p = polyAt(b.pts, b.cum, s);
      wr.add(boxMesh(M.rubble, rand(0.6, 1.8), rand(0.4, 0.9), rand(0.6, 2.2), p.x + rand(-b.width / 2, b.width / 2), sea - rand(0.2, 0.6), p.z + rand(-1, 1), rand(0, 3), rand(-0.4, 0.4), rand(-0.4, 0.4)));
    }
    wr.traverse((o) => { o.raycast = () => {}; });
    g.world.add(wr);
    b.wreck = wr;
  }
  _pontoonVisual(b) {
    const g = this.g, T = g.terrain, M = mats();
    const grp = new THREE.Group(); grp.name = 'pontoon' + b.id;
    const sea = T.seaLevel;
    const s0 = b.gA - 1.5, s1 = b.gB + 1.5;
    for (let s = s0; s <= s1; s += 2.4) {
      const p = polyAt(b.pts, b.cum, s), ry = Math.atan2(p.dx, p.dz);
      grp.add(boxMesh(M.pontoon, b.width + 1.4, 0.7, 2.1, p.x, sea - 0.05, p.z, ry));
    }
    for (let i = 1; i < b.pts.length; i++) {
      const a = Math.max(s0, b.cum[i - 1]), e = Math.min(s1, b.cum[i]);
      if (e - a < 0.05) continue;
      const p0 = polyAt(b.pts, b.cum, a), p1 = polyAt(b.pts, b.cum, e), ry = Math.atan2(p1.x - p0.x, p1.z - p0.z);
      grp.add(boxMesh(M.plank, b.width, 0.12, e - a, (p0.x + p1.x) / 2, sea + 0.36, (p0.z + p1.z) / 2, ry));
      for (const sd of [-1, 1]) { const ox = Math.cos(ry) * sd * (b.width / 2), oz = -Math.sin(ry) * sd * (b.width / 2); grp.add(boxMesh(M.wood, 0.1, 0.5, e - a, (p0.x + p1.x) / 2 + ox, sea + 0.65, (p0.z + p1.z) / 2 + oz, ry)); }
    }
    grp.traverse((o) => { o.raycast = () => {}; });
    g.world.add(grp);
    b.pontoon = grp;
  }
  // ---------- Zustandswechsel (Host: mit Wirkung; Client/Netz: nur Optik + Raster) ----------
  destroyBridge(b, cause = 'fire', fromNet = false) {
    const g = this.g, T = g.terrain;
    if (!b || b.state === 'destroyed') return false;
    const was = b.state;
    b.state = 'destroyed'; b.hp = 0; b.build = 0;
    const sea = T.seaLevel;
    this._shape(b, b.gA, b.gB, b.width / 2 + 2.5, (old, e) => old + (Math.min(old, sea - 2.6) - old) * e);
    this._grid(b, b.gA - 0.5, b.gB + 0.5, b.width / 2 + 2.5, 'water');
    if (was === 'pontoon' && b.pontoon) { b.pontoon.parent?.remove(b.pontoon); b.pontoon = null; if (!b.wreck) this._wreckVisual(b); else b.wreck.visible = true; }
    else if (!b.wreck) this._wreckVisual(b);
    else b.wreck.visible = true;
    b.parts.mid.visible = false;
    g.rail?.onBridgeChange(b);
    const fx = g.effects;
    for (let i = 0; i < 5; i++) {
      const p = polyAt(b.pts, b.cum, b.gA + Math.random() * (b.gB - b.gA));
      g.later(i * 0.18, () => fx.explosion(p.x + rand(-2, 2), sea + 1.2, p.z + rand(-2, 2), i === 0 ? 2.6 : 1.4, { crater: false, water: i > 1 }));
    }
    fx.addEmitter?.(new THREE.Object3D().translateX(b.cx).translateY(sea + 1).translateZ(b.cz), 0.3, 30, 1.4);
    fx.shake = Math.max(fx.shake || 0, 1.2);
    if (!fromNet) {
      // Einheiten auf dem eingestürzten Mittelteil
      for (const u of [...g.units]) {
        if (!u.alive || u.type.air || u.type.naval || u.type.structure) continue;
        const p = polyProject(b.pts, b.cum, u.pos.x, u.pos.z);
        if (p.d < b.width / 2 + 1 && p.s > b.gA - 0.5 && p.s < b.gB + 0.5) g.killUnit(u, null);
      }
      g.onObstacleAdded(b.cx, b.cz, (b.gB - b.gA) / 2 + b.width);
      this.stats.bridgesDestroyed++;
      g.emit('bridgeDestroyed', b, cause);
      g.alertTo(null, `💥 Brücke ${b.kind === 'rail' ? '(Eisenbahn) ' : ''}zerstört!`, 3);
      g.net?.event?.(['br', b.id, 1], b.cx, b.cz, true);
    }
    return true;
  }
  buildBridge(b, fromNet = false) {
    const g = this.g, T = g.terrain;
    if (!b || b.state !== 'destroyed') return false;
    b.state = 'pontoon'; b.maxHp = BR.hp.pontoon; b.hp = b.maxHp; b.build = 1;
    const sea = T.seaLevel;
    this._shape(b, b.gA - 1, b.gB + 1, b.width / 2 + 0.4, (old, e) => old + (sea + 0.25 - old) * Math.min(1, e * 1.6));
    this._grid(b, b.gA - 1, b.gB + 1, b.width / 2, 'land');
    if (b.wreck) b.wreck.visible = false;
    this._pontoonVisual(b);
    g.rail?.onBridgeChange(b);
    if (!fromNet) {
      this.stats.bridgesBuilt++;
      g.emit('bridgeBuilt', b);
      g.alertTo(null, '🔨 Pontonbrücke befahrbar', 3);
      g.net?.event?.(['br', b.id, 2], b.cx, b.cz, true);
    }
    return true;
  }
  // Netz: Zustand übernehmen
  applyState(id, code) {
    const b = this.bridgeById(id), st = CODE_STATE[code];
    if (!b || !st || b.state === st) return;
    if (st === 'destroyed') this.destroyBridge(b, 'net', true);
    else if (st === 'pontoon') { if (b.state === 'intact') this.destroyBridge(b, 'net', true); this.buildBridge(b, true); }
  }
  stateCodes() { return this.bridges.map((b) => STATE_CODE[b.state]); }
  // Beschuss (aus game.splashDamage)
  onBlast(x, z, r, dmg, w) {
    if (!this.bridges.length || !(dmg > 0)) return;
    for (const b of this.bridges) {
      if (b.state === 'destroyed') continue;
      const p = polyProject(b.pts, b.cum, x, z);
      if (p.d > b.width / 2 + r || p.s < b.sA - r || p.s > b.sB + r) continue;
      const k = Math.max(0.15, 1 - Math.max(0, p.d - b.width / 2) / Math.max(1, r));
      const mul = w?.vs ? (w.vs.struct ?? 0.5) : 0.5;
      b.hp -= dmg * mul * k * (p.s > b.gA - 3 && p.s < b.gB + 3 ? 1 : 0.5);
      if (b.hp <= 0) this.destroyBridge(b, 'fire');
    }
  }

  // ---------- Pionier-Aufträge ----------
  command(p, cmd, units) {
    const g = this.g;
    if (cmd.t !== 'blowbridge' && cmd.t !== 'buildbridge') return undefined;
    const b = this.bridgeById(cmd.target);
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
  // Arbeitsplatz am näheren Ufer des Mittelteils
  _bankPoint(e, b) {
    const pA = polyAt(b.pts, b.cum, b.gA - 2.5), pB = polyAt(b.pts, b.cum, b.gB + 2.5);
    return d2(pA.x, pA.z, e.pos.x, e.pos.z) < d2(pB.x, pB.z, e.pos.x, e.pos.z) ? pA : pB;
  }
  _goBank(e, b) { const q = this._bankPoint(e, b); e._goto(q.x, q.z); }
  _jobStep(e, dt) {
    const g = this.g, J = e.bridgeJob, b = this.bridgeById(J.bridge);
    if (!b || (J.kind === 'blow' && b.state === 'destroyed') || (J.kind === 'build' && b.state !== 'destroyed')) { e.bridgeJob = null; return; }
    const q = this._bankPoint(e, b);
    if (J.phase === 'go') {
      if (d2(q.x, q.z, e.pos.x, e.pos.z) > 4.5 * 4.5) { if (!e.order || !e.path?.length) e._goto(q.x, q.z); return; }
      e.order = null; e.path = null; J.phase = 'work'; J.t = 0;
    }
    e.working = g.time;
    e.heading = Math.atan2(b.cx - e.pos.x, b.cz - e.pos.z);
    if (J.kind === 'blow') {
      J.t += dt;
      if (J.t < BR.plant) return;
      if (g.logistics) { if (e.material < BR.blowCost - 1e-6) { const other = g.units.find((o) => o.bridgeJob?.bridge === b.id && o !== e && o.material >= BR.blowCost); if (!other) { e.bridgeJob = null; return; } other.material -= BR.blowCost; } else e.material -= BR.blowCost; }
      // Ladung liegt – alle Pioniere dieses Auftrags ziehen sich zurück
      for (const o of g.units) if (o.bridgeJob?.bridge === b.id && o.bridgeJob.kind === 'blow') { o.bridgeJob = null; const a = Math.atan2(o.pos.x - b.cx, o.pos.z - b.cz); o.moveTo(o.pos.x + Math.sin(a) * 18, o.pos.z + Math.cos(a) * 18); }
      g.effects.marker(b.cx, b.cz, 0xff3030, BR.fuse, Math.max(4, b.width));
      g.sayTo(e.side, 'Pionier', `Sprengladung an der Brücke – Zünder ${BR.fuse} s!`, 3);
      g.emit('bridgeCharge', b, e);
      g.later(BR.fuse, () => { if (b.state !== 'destroyed') this.destroyBridge(b, 'charge'); });
      return;
    }
    // Bau: Fortschritt je arbeitendem Pionier
    b.build = Math.min(1, (b.build || 0) + dt / BR.buildTime);
    if (Math.random() < dt * 1.2) g.effects.smallHit(q.x + rand(-1, 1), g.terrain.surface(q.x, q.z) + 0.4, q.z + rand(-1, 1));
    if (b.build >= 1) {
      for (const o of g.units) if (o.bridgeJob?.bridge === b.id) o.bridgeJob = null;
      this.buildBridge(b);
    }
  }

  // ======================= Hauptschleife =======================
  update(dt) {
    const g = this.g;
    for (const u of g.units) if (u.bridgeJob && u.alive) this._jobStep(u, dt);
    this.acc += dt;
    if (this.acc < 0.15) return;
    this.acc = 0;
    for (const v of g.units) if (v.alive && v.moving && v.type.crush && !v.type.air && !v.type.naval) this._crushStep(v);
  }

  // ======================= Klang (Host und Client, Bildschleife) =======================
  engineKind(t) {
    const m = String(t.model || '') + ' ' + t.key + ' ' + String(t.name || '').toLowerCase();
    if (t.naval) return 'boat';
    if (t.air) {
      if (/heli|mi8|mi-8|hind|ch53|nh90|tiger|ka52|uh60/.test(m)) return 'heli';
      if (/quad|fpv|vampire|kvn/.test(m)) return 'fpv';
      if (t.kamikaze || /shahed|lancet|geran|molniya|orlan|zala|luna|heron|leleka|recon_wing|orion|wing/.test(m)) return 'shahed';
      return t.era === 'ww2' || /c47|ju52|dakota|storch|po2|cub|auster|l4/.test(m) ? 'prop_plane' : 'jet';
    }
    if (t.rail) return t.era === 'ww2' ? 'tank_ww2' : 'truck';
    const truck = !!t.supply || /truck|lkw|ural|kraz|gmc|opel|bedford|zis_truck|caravan/.test(m);
    const wheel = t.wheeled ?? /btr|stryker|pickup|jeep|kubel|ba64|puma|dingo|eagle|fennek|wolf|mungo|technical|bike|moto|buggy|senator|caesar|bohdana|archer|himars|patriot|irist|s400|radartruck|uaz|interceptor|neptun|iskander|nasams|skynex|tpq|zoopark/.test(m);
    if (t.era === 'ww2') return truck ? 'truck' : wheel ? 'jeep_ww2' : 'tank_ww2';
    return truck ? 'truck' : wheel ? 'wheeled' : 'tracked';
  }
  updateSound(dt) {
    const g = this.g, au = g.audio;
    if (!au?.engine || !g.active || !g.camera) return;
    this.sndAcc += dt;
    if (this.sndAcc < 0.1) return;
    const step = this.sndAcc; this.sndAcc = 0;
    const cx = g.camera.target.x, cz = g.camera.target.z, R = 150 + (g.camera.dist || 80) * 0.6, ls = g.localSide;
    let n = 0;
    for (const u of g.units) {
      if (!u.alive || u.type.structure || u.type.infantry || u.abandoned || u.towedBy) continue;
      const t = u.type;
      if (!(t.vehicle || t.air || t.naval)) continue;
      if (u.side !== ls && !u.root.visible) continue;
      const d = d2(u.pos.x, u.pos.z, cx, cz);
      if (d > R * R) { u._sndX = u.pos.x; u._sndZ = u.pos.z; continue; }
      const mv = u._sndX === undefined ? 0 : Math.hypot(u.pos.x - u._sndX, u.pos.z - u._sndZ) / Math.max(0.02, step);
      u._sndX = u.pos.x; u._sndZ = u.pos.z;
      u._sndV = (u._sndV || 0) * 0.6 + Math.min(mv, (u.speed || 10) * 1.5) * 0.4;
      const moving = u.moving || u._sndV > 0.3 || t.air;
      if (!moving && d > 60 * 60) continue; // stehende Fahrzeuge nur nah an der Kamera im Leerlauf
      const k = u._sndKind || (u._sndKind = this.engineKind(t));
      au.engine('u' + u.id, k, u.pos.x, u.pos.z, t.air ? Math.max(u._sndV, u.speed * 0.8) : u._sndV);
      n++;
    }
    this.stats.engines = n;
    // Umgebung: Gefechtsintensität aus Schüssen/Abschüssen der letzten Sekunden
    this.ambAcc += step;
    if (this.ambAcc >= 1) {
      this.ambAcc = 0;
      const shots = g.players.reduce((s, p) => s + (p.stats.shots || 0) + (p.stats.kills || 0) * 3, 0);
      const ds = Math.max(0, shots - (this._shots ?? shots)); this._shots = shots;
      this._int = (this._int || 0) * 0.85 + Math.min(1, ds / 25) * 0.15;
      this.applyAmbience();
    }
  }
  eraOf() {
    const g = this.g, m = g.mission;
    if (this._era && this._eraM === m) return this._era;
    let e = m?.era || m?.meta?.era;
    if (!e) {
      const c = {};
      for (const u of g.units) if (!u.type.structure) c[u.type.era] = (c[u.type.era] || 0) + 1;
      e = Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] || 'modern';
    }
    this._era = e === 'ww1' ? 'ww2' : e; this._eraM = m;
    return this._era;
  }
  ambienceSpec() {
    const g = this.g, env = g.mission?.env || {};
    const season = env.season || g.terrain?.season || 'summer';
    const rain = env.rain ?? (env.weather === 'rain' ? 0.6 : env.weather === 'storm' ? 1 : 0);
    return { night: !!env.night, season: season === 'mud' ? 'autumn' : season === 'desert' || season === 'afghan' ? 'summer' : season, era: this.eraOf(), intensity: +(this._int || 0).toFixed(2), rain };
  }
  applyAmbience() { const a = this.ambienceSpec(); this.lastAmbience = a; try { this.g.audio?.setAmbience?.(a); } catch (e) { /* Audio optional */ } }
}
