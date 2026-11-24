// V3-M2: Kartenelemente zur Laufzeit – Hindernisse walzen, Brücken (sprengen, beschießen, Ponton-/Notbrücke bauen) und
// Motor-/Umgebungsklang.
//
// Walzen: Fahrzeuge mit type.crush (Kampfpanzer, schwere Kettenfahrzeuge; unitTypes.prepareType) zerstören beim Darüberfahren
//   Bäume, Büsche, Hecken (terrain.removeTreeAt/removeBushAt/removeHedgeAt) und Sandsackwälle; kurze Verlangsamung (u.crushT),
//   umfallender Baum / Laub als Optik. Leichte Fahrzeuge bleiben an Hecken blockiert (harte Zellen) und planen außen herum.
//   Wegfindung: unit.computePath → pathfinder.find(…, 'heavy') (gamepath.js), Hecken passierbar mit Kosten.
// Brücken (game.bridges, Bauwerke über dem Wasser – Details in bridges.js): { id, name, kind 'road'|'rail', style, width,
//   pts, deck (Fahrbahnhöhe), state 'intact'|'destroyed'|'repaired', hp, maxHp, cx, cz, build (0..1) }. Quellen: alle
//   causeway-Features über tiefem Wasser (game.load), game.addBridge(pts, {width, kind, style, hp}) und Gleise (rail.js).
//   Zerstörung durch Pioniere ({t:'blowbridge', ids, target: bridgeId}, Ladung 6 s + Zünder 10 s) oder schweren Beschuss
//   (splashDamage → onBlast): Mittelfeld stürzt ein, Raster dort Wasser. Wiederaufbau {t:'buildbridge', ids, target}:
//   Notbrücke (Bailey) bzw. Ponton, BR.buildTime s ÷ Anzahl Pioniere, Material BR.buildCost.
//   Ereignisse: game.emit('bridgeDestroyed', b, cause) · game.emit('bridgeBuilt', b).
// Klang: fahrende Fahrzeuge/Luft-/Wasserfahrzeuge nahe der Kamera → audio.engine(id, kind, x, z, speed); Umgebung
//   (Epoche, Jahreszeit, Nacht, Regen, Gefechtsintensität) → audio.setAmbience.
import * as THREE from 'three';
import { rand } from '../engine/util.js';
import { CELL } from '../engine/terrain.js';

import { BridgeSystem, BR, polyLen, polyAt, polyProject } from './bridges.js';
export { BR, polyLen, polyAt, polyProject };
const d2 = (ax, az, bx, bz) => (ax - bx) * (ax - bx) + (az - bz) * (az - bz);

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
    this.br = new BridgeSystem(game);
    this.acc = 0; this.sndAcc = 0; this.ambAcc = 0;
    this.decor = [];
    this.stats = { trees: 0, hedges: 0, bushes: 0, walls: 0, bridgesDestroyed: 0, bridgesBuilt: 0, engines: 0 };
    this._treeGrid = null;
  }
  bridgeById(id) { return this.br.byId(id); }
  nearestBridge(x, z, r = 30) { return this.br.nearest(x, z, r); }

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

  // ======================= Brücken (bridges.js) =======================
  get bridges() { return this.br.list; }
  bridgesFromCauseways() { this.br.fromCauseways(); }
  addBridge(pts, o = {}) { return this.br.add(pts, o); }
  destroyBridge(b, cause = 'fire', fromNet = false) { return this.br.destroy(b, cause, fromNet); }
  buildBridge(b, fromNet = false) { return this.br.repair(b, fromNet); }
  applyState(id, code) { this.br.applyState(id, code); }
  stateCodes() { return this.br.stateCodes(); }
  onBlast(x, z, r, dmg, w) { this.br.onBlast(x, z, r, dmg, w); }
  command(p, cmd, units) { return this.br.command(p, cmd, units); }
  _jobStep(e, dt) { this.br.jobStep(e, dt); }

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
