// V3-M2: Eisenbahn – Gleise als Kartenelement, Panzer- und Nachschubzüge auf Schienen (Bewegung entlang einer Polylinie).
//
// Missions-API:
//   game.addRailway(points, { id }) → Gleis { id, pts, cum, len } – Schotterbett, Schwellen, Schienen; Abschnitte über Wasser
//     erhalten automatisch eine Eisenbahnbrücke (game.addBridge(…, {kind:'rail'})); Gleise und Brücken passen zusammen
//     (gesprengte Brücke: Gleis im Mittelteil fehlt, Züge halten davor; Pontonbrücke: Gleis wieder befahrbar).
//   game.addStation(x, z, { r, name }) → Bahnhof (Bahnsteig), Nachschubzüge liefern dort Munition/Treibstoff/Material.
//   game.spawnTrain({ side, kind: 'armored'|'supply', cars, route, owner, s, dir, go: 'end'|'station'|null, station, era,
//     faction, types, speed }) → Zug { id, rail, cars: [Unit], s, dir, v, target, kind }.
//     Waggons sind verbundene Einheiten (type.rail, zerstörbar); Lok zerstört/schwer getroffen → Zug steht (Treffer > 30 HP:
//     Notbremse 5 s; < 35 % HP: liegen geblieben). Zerstörter Waggon trennt die folgenden Wagen ab.
//   Spieler: Rechtsklick/move auf einen Zug → Zielpunkt auf dem Gleis (game.command 'move' wird umgeleitet), 'stop' hält an.
// Ereignisse: 'trainArrived' (train), 'trainDelivered' (train, station), 'trainStopped' (train, Grund).
import * as THREE from 'three';
import { polyLen, polyAt, polyProject } from './mapobjects.js';

export const RAIL = { gauge: 1.44, tie: 0.9, acc: 0.9, brake: 2.2, deliverR: 45, stationR: 24, carGap: 0.5 };
const fin = (v) => typeof v === 'number' && Number.isFinite(v);
let _m = null;
function mats() {
  if (_m) return _m;
  _m = {
    ballast: new THREE.MeshStandardMaterial({ color: 0x6b655c, roughness: 1 }),
    tie: new THREE.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 1 }),
    rail: new THREE.MeshStandardMaterial({ color: 0x8e9196, roughness: 0.35, metalness: 0.8 }),
    platform: new THREE.MeshStandardMaterial({ color: 0x9a978f, roughness: 0.95 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x5b4636, roughness: 0.9 }),
  };
  for (const m of Object.values(_m)) m.userData.shared = true;
  return _m;
}

export class Rail {
  constructor(game) {
    this.g = game;
    this.rails = []; this.trains = []; this.stations = [];
    this.acc = 0;
    this.stats = { delivered: 0, arrivals: 0, stops: 0 };
  }
  railById(id) { return this.rails.find((r) => r.id === id || String(r.id) === String(id)) || null; }

  // ======================= Gleise =======================
  addRailway(points, o = {}) {
    const g = this.g, T = g.terrain;
    if (!Array.isArray(points) || points.length < 2) return null;
    const pts = points.map((p) => [+p[0], +p[1]]);
    const cum = polyLen(pts);
    const rail = { id: o.id ?? this.rails.length + 1, pts, cum, len: cum[cum.length - 1], bridges: [] };
    // Wasserquerungen → Eisenbahnbrücken
    if (T.hasWater && g.mapobj) {
      let run = null;
      const runs = [];
      T._deckOff = true; // vorhandene Brücken verdecken das Wasser nicht
      for (let s = 0; s <= rail.len; s += 1) {
        const p = polyAt(pts, cum, s);
        if (T.isWater(p.x, p.z)) { if (!run) run = [s, s]; else run[1] = s; } else if (run) { runs.push(run); run = null; }
      }
      if (run) runs.push(run);
      T._deckOff = false;
      for (const [a, b] of runs) {
        const sub = [];
        for (let s = Math.max(0, a - 12); s <= Math.min(rail.len, b + 12) + 0.01; s += 2) { const p = polyAt(pts, cum, Math.min(s, rail.len)); sub.push([p.x, p.z]); }
        const br = g.mapobj.addBridge(sub, { kind: 'rail', width: 5 });
        if (br) rail.bridges.push(br);
      }
    }
    this.rails.push(rail);
    this._buildVisual(rail);
    for (const br of rail.bridges) this._mapGap(rail, br);
    return rail;
  }
  _mapGap(rail, br) {
    const a = polyAt(br.pts, br.cum, br.gA), b = polyAt(br.pts, br.cum, br.gB);
    const pa = polyProject(rail.pts, rail.cum, a.x, a.z).s, pb = polyProject(rail.pts, rail.cum, b.x, b.z).s;
    br.railGap = br.railGap || [];
    br.railGap.push({ rail: rail.id, s0: Math.min(pa, pb) - 0.5, s1: Math.max(pa, pb) + 0.5 });
  }
  _buildVisual(rail) {
    const g = this.g, M = mats();
    const n = Math.max(2, Math.floor(rail.len / RAIL.tie));
    const geoB = new THREE.BoxGeometry(1, 1, 1), geoT = new THREE.BoxGeometry(2.4, 0.14, 0.24), geoR = new THREE.BoxGeometry(0.09, 0.15, 1);
    const ballast = new THREE.InstancedMesh(geoB, M.ballast, n), ties = new THREE.InstancedMesh(geoT, M.tie, n), rails = new THREE.InstancedMesh(geoR, M.rail, n * 2);
    ballast.receiveShadow = true; ties.receiveShadow = true; rails.castShadow = true;
    const grp = new THREE.Group(); grp.name = 'railway' + rail.id;
    grp.add(ballast, ties, rails);
    grp.traverse((x) => { x.raycast = () => {}; });
    g.world.add(grp);
    rail.vis = { n, ballast, ties, rails, grp };
    for (let i = 0; i < n; i++) this._placeSample(rail, i);
    for (const im of [ballast, ties, rails]) im.instanceMatrix.needsUpdate = true;
  }
  _placeSample(rail, i, hide = false) {
    const T = this.g.terrain, V = rail.vis, s = (i + 0.5) * (rail.len / V.n);
    const p = polyAt(rail.pts, rail.cum, s), ry = Math.atan2(p.dx, p.dz), step = rail.len / V.n;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), sc = new THREE.Vector3(), pos = new THREE.Vector3();
    if (hide) { m4.makeScale(0, 0, 0); V.ballast.setMatrixAt(i, m4); V.ties.setMatrixAt(i, m4); V.rails.setMatrixAt(i * 2, m4); V.rails.setMatrixAt(i * 2 + 1, m4); return; }
    const y = Math.max(T.height(p.x, p.z), T.hasWater ? T.seaLevel + 0.2 : -999);
    V.ballast.setMatrixAt(i, m4.compose(pos.set(p.x, y - 0.02, p.z), q, sc.set(3.0, 0.22, step * 1.02)));
    V.ties.setMatrixAt(i, m4.compose(pos.set(p.x, y + 0.13, p.z), q, sc.set(1, 1, 1)));
    for (const sd of [-1, 1]) {
      const ox = Math.cos(ry) * sd * RAIL.gauge / 2, oz = -Math.sin(ry) * sd * RAIL.gauge / 2;
      V.rails.setMatrixAt(i * 2 + (sd > 0 ? 1 : 0), m4.compose(pos.set(p.x + ox, y + 0.27, p.z + oz), q, sc.set(1, 1, step * 1.01)));
    }
  }
  // Brücke gesprengt/gebaut: Gleisstück im Mittelteil aus-/einblenden (Host und Client)
  onBridgeChange(br) {
    for (const gp of br.railGap || []) {
      const rail = this.railById(gp.rail);
      if (!rail?.vis) continue;
      const V = rail.vis, step = rail.len / V.n;
      for (let i = 0; i < V.n; i++) { const s = (i + 0.5) * step; if (s >= gp.s0 && s <= gp.s1) this._placeSample(rail, i, br.state === 'destroyed'); }
      for (const im of [V.ballast, V.ties, V.rails]) im.instanceMatrix.needsUpdate = true;
    }
  }
  addStation(x, z, o = {}) {
    const g = this.g, T = g.terrain, M = mats();
    const st = { id: this.stations.length + 1, x, z, r: o.r || RAIL.stationR, name: o.name || 'Bahnhof', team: o.team || null };
    // Bahnsteig neben dem nächsten Gleis
    let best = null;
    for (const r of this.rails) { const p = polyProject(r.pts, r.cum, x, z); if (!best || p.d < best.p.d) best = { r, p }; }
    const grp = new THREE.Group(); grp.name = 'station' + st.id;
    if (best) {
      const p = polyAt(best.r.pts, best.r.cum, best.p.s), ry = Math.atan2(p.dx, p.dz), off = 3.4;
      const px = p.x + Math.cos(ry) * off, pz = p.z - Math.sin(ry) * off, y = T.height(px, pz);
      const plat = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.9, 22), M.platform); plat.position.set(px, y + 0.2, pz); plat.rotation.y = ry; plat.receiveShadow = true; plat.castShadow = true; grp.add(plat);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.15, 10), M.roof); roof.position.set(px, y + 3.4, pz); roof.rotation.y = ry; roof.castShadow = true; grp.add(roof);
      for (const k of [-4, 0, 4]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.8, 0.2), M.roof); post.position.set(px + Math.sin(ry) * k, y + 2, pz + Math.cos(ry) * k); grp.add(post); }
      st.rail = best.r.id; st.s = best.p.s; st.x = p.x; st.z = p.z;
    }
    grp.traverse((q) => { q.raycast = () => {}; });
    g.world.add(grp);
    this.stations.push(st);
    return st;
  }

  // ======================= Züge =======================
  trainTypes(o) {
    const g = this.g;
    if (Array.isArray(o.types) && o.types.length) return o.types;
    const n = Math.max(1, Math.min(8, o.cars ?? 3));
    const era = o.era || g.mapobj?.eraOf?.() || 'modern';
    const supply = o.kind === 'supply';
    if (era === 'ww2') {
      const tag = o.faction ? String(o.faction).toLowerCase() === 'de' ? 'de' : 'su' : o.side === 'RU' ? 'de' : 'su';
      const out = [`ww2_${tag}_train_loco`];
      for (let i = 0; i < n; i++) out.push(supply ? `ww2_${tag}_train_wagon` : `ww2_${tag}_train_${i % 2 ? 'flak' : 'armor'}`);
      return out;
    }
    const out = ['m_rail_loco'];
    for (let i = 0; i < n; i++) out.push(supply ? (i % 2 ? 'm_rail_tank' : 'm_rail_wagon') : (i % 2 ? 'm_rail_flak' : 'm_rail_armor'));
    return out;
  }
  spawnTrain(o = {}) {
    const g = this.g;
    let rail = o.route;
    if (Array.isArray(rail)) rail = this.addRailway(rail);
    else if (rail === undefined || rail === null) rail = this.rails[0];
    else if (typeof rail !== 'object') rail = this.railById(rail);
    if (!rail) return null;
    const side = o.side === 'RU' ? 'RU' : 'UA';
    const types = this.trainTypes({ ...o, side });
    const dir = o.dir === -1 ? -1 : 1;
    const train = { id: this.trains.length + 1, rail, cars: [], offs: [], s: 0, dir, v: 0, vmax: 0, target: null, kind: o.kind === 'supply' ? 'supply' : 'armored', stopT: 0, station: null, load: { ammo: 6000, fuel: 9000, material: 24 }, delivered: false, deliverT: 0, alive: true };
    let off = 0;
    types.forEach((k, i) => {
      const u = g.spawn(k, side, 0, 0, { owner: o.owner, heading: 0 });
      if (i) off += (train.cars[i - 1].radius + u.radius) * 1.02 + RAIL.carGap;
      train.cars.push(u); train.offs.push(off);
      u.railSpeed = u.speed; u.speed = 0; u.train = train;
      if (o.ai) u.ai = null;
    });
    train.vmax = (o.speed || Math.min(...train.cars.map((u) => u.railSpeed || 4)));
    const total = off;
    train.s = fin(o.s) ? o.s : dir > 0 ? total + train.cars[0].radius + 2 : rail.len - total - train.cars[0].radius - 2;
    train.s = Math.max(this._minS(train), Math.min(this._maxS(train), train.s));
    if (o.station !== undefined && o.station !== null) train.station = typeof o.station === 'object' ? o.station : this.stations[o.station] || null;
    this.trains.push(train);
    this._placeCars(train, 0);
    if (o.go === 'station' && train.station) this.setTarget(train, train.station.s + dir * total / 2);
    else if (o.go === 'end' || (o.go === undefined && train.kind === 'supply')) this.setTarget(train, dir > 0 ? this._maxS(train) : this._minS(train));
    else if (fin(o.go)) this.setTarget(train, o.go);
    g.emit('trainSpawned', train);
    return train;
  }
  _minS(t) { return (t.dir > 0 ? t.offs[t.offs.length - 1] : 0) + t.cars[0].radius + 0.5; }
  _maxS(t) { return t.rail.len - (t.dir < 0 ? t.offs[t.offs.length - 1] : 0) - t.cars[0].radius - 0.5; }
  setTarget(t, s) { t.target = Math.max(this._minS(t), Math.min(this._maxS(t), s)); t.delivered = false; }
  // Spielerbefehl: Zielpunkt auf das Gleis projizieren
  orderMove(units, x, z) {
    const trains = [...new Set(units.map((u) => u.train).filter((t) => t && t.alive))];
    let ok = false;
    for (const t of trains) {
      const p = polyProject(t.rail.pts, t.rail.cum, x, z);
      if (p.d > 80) continue;
      this.setTarget(t, p.s);
      t.stopT = 0;
      ok = true;
    }
    return ok;
  }
  stop(units) { for (const u of units) if (u.train) { u.train.target = null; } }
  _placeCars(t, dt) {
    const pi = Math.PI;
    t.cars.forEach((u, i) => {
      if (!u.alive) return;
      const s = t.s - t.dir * t.offs[i];
      const p = polyAt(t.rail.pts, t.rail.cum, s);
      u.pos.x = p.x; u.pos.z = p.z;
      u.heading = Math.atan2(p.dx, p.dz) + (t.dir < 0 ? pi : 0);
      u.moving = Math.abs(t.v) > 0.15;
      u.order = u.order?.type === 'attack' ? u.order : null; u.path = null;
      u.place(dt);
    });
  }
  // Hindernis voraus? (Gleisende, gesprengte Brücke, Wrack/Sperre, anderer Zug)
  _blocked(t, m, look) {
    const g = this.g, T = g.terrain, R = t.rail;
    const params = t.cars.map((u, i) => t.s - t.dir * t.offs[i]);
    const lead = m > 0 ? Math.max(...params) : Math.min(...params);
    const front = lead + m * (t.cars[0].radius + 0.3);
    const end = front + m * look;
    if (end > R.len - 0.5 || end < 0.5) return 'Gleisende';
    for (const br of g.mapobj?.bridges || []) {
      if (br.state !== 'destroyed') continue;
      for (const gp of br.railGap || []) if (gp.rail === R.id && Math.max(gp.s0, Math.min(front, end)) <= Math.min(gp.s1, Math.max(front, end))) return 'Brücke zerstört';
    }
    for (let s = front; m > 0 ? s <= end : s >= end; s += m * 1.5) {
      const p = polyAt(R.pts, R.cum, s), k = T.cellIndex(p.x, p.z);
      if (k >= 0 && (T.gBlocked[k] === 3 || T.gBlocked[k] === 4)) return 'Hindernis';
    }
    for (const o of this.trains) {
      if (o === t || !o.alive || o.rail !== R) continue;
      for (let i = 0; i < o.cars.length; i++) {
        if (!o.cars[i].alive) continue;
        const so = o.s - o.dir * o.offs[i];
        if (Math.abs(so - (front + end) / 2) < Math.abs(end - front) / 2 + o.cars[i].radius) return 'Zug';
      }
    }
    return null;
  }
  update(dt) {
    const g = this.g;
    for (const t of this.trains) {
      if (!t.alive) continue;
      // Wagen-Verluste
      const loco = t.cars[0];
      if (!loco?.alive) { t.alive = false; t.v = 0; for (const u of t.cars) if (u.alive) { u.train = null; u.moving = false; } g.emit('trainStopped', t, 'Lok zerstört'); continue; }
      const k = t.cars.findIndex((u) => !u.alive);
      if (k > 0) { for (const u of t.cars.slice(k)) if (u.alive) { u.train = null; u.moving = false; } t.cars = t.cars.slice(0, k); t.offs = t.offs.slice(0, k); }
      // Lok-Treffer
      if (loco._hpSeen === undefined) loco._hpSeen = loco.hp;
      if (loco.hp < loco._hpSeen - 30) { t.stopT = Math.max(t.stopT, 5); if (loco.hp < loco.maxHp * 0.35 && !loco.immobilized) { loco.immobilized = true; g.alertTo(loco.owner, `⚠ ${loco.name}: Lok schwer getroffen – Zug liegt fest`, 3); } }
      loco._hpSeen = loco.hp;
      if (t.stopT > 0) t.stopT -= dt;
      // Sollgeschwindigkeit
      let vdes = 0;
      if (t.target !== null && t.stopT <= 0 && !loco.immobilized && !(loco.maxFuel && loco.fuel <= 0)) {
        const d = t.target - t.s, ad = Math.abs(d);
        if (ad < 0.4) { t.target = null; t.v = 0; this.stats.arrivals++; g.emit('trainArrived', t); }
        else vdes = Math.sign(d) * Math.min(t.vmax, Math.sqrt(2 * RAIL.brake * 0.7 * ad) + 0.2);
      }
      if (vdes !== 0) {
        const why = this._blocked(t, Math.sign(vdes), Math.max(3, (t.v * t.v) / (2 * RAIL.brake) + 2));
        if (why) { vdes = 0; if (!t.blockMsg || g.time - t.blockMsg > 8) { t.blockMsg = g.time; this.stats.stops++; g.emit('trainStopped', t, why); g.alertTo(loco.owner, `${loco.name}: Halt – ${why}`, 2.5); } }
      }
      const dv = vdes - t.v, lim = (Math.sign(dv) === Math.sign(t.v) || t.v === 0 ? RAIL.acc : RAIL.brake) * dt;
      t.v += Math.max(-lim, Math.min(lim, dv));
      if (Math.abs(t.v) < 0.02 && vdes === 0) t.v = 0;
      t.s = Math.max(this._minS(t), Math.min(this._maxS(t), t.s + t.v * dt));
      if (loco.maxFuel && Math.abs(t.v) > 0.1) loco.fuel = Math.max(0, loco.fuel - dt);
      this._placeCars(t, dt);
      if (t.kind === 'supply') this._deliver(t, dt);
    }
  }
  _deliver(t, dt) {
    const g = this.g;
    if (Math.abs(t.v) > 0.1) return;
    let st = null;
    for (const s of this.stations) if (t.cars.some((u) => u.alive && Math.hypot(u.pos.x - s.x, u.pos.z - s.z) < s.r)) { st = s; break; }
    if (!st) return;
    t.deliverT += dt;
    if (t.deliverT < 1) return;
    t.deliverT = 0;
    const team = t.cars[0].side, L = !!g.logistics;
    let n = 0;
    for (const u of g.units) {
      if (!u.alive || u.side !== team || u.type.structure || u.train || Math.hypot(u.pos.x - st.x, u.pos.z - st.z) > RAIL.deliverR) continue;
      let got = false;
      if (L) {
        for (const ws of u.weapons) if (ws.stockMax !== Infinity && ws.stock < ws.stockMax && t.load.ammo > 0) { const need = ws.stockMax - ws.stock, take = Math.min(need, t.load.ammo / Math.max(0.1, ws.def.wt || 1)); ws.stock += take; t.load.ammo -= take * (ws.def.wt || 1); got = true; }
        if (u.maxFuel && u.fuel < u.maxFuel && t.load.fuel > 0) { const take = Math.min(u.maxFuel - u.fuel, t.load.fuel); u.fuel += take; t.load.fuel -= take; got = true; }
        if (u.maxMaterial && u.material < u.maxMaterial && t.load.material >= 1) { u.material += 1; t.load.material -= 1; got = true; }
        if (u.supply && u.type.supply) { for (const k of ['ammo', 'fuel', 'material']) { const need = u.type.supply[k] - u.supply[k], take = Math.max(0, Math.min(need, t.load[k] * 0.5)); if (take > 0.01) { u.supply[k] += take; t.load[k] -= take; got = true; } } }
      } else {
        // Kampagne (ohne Logistik): Instandsetzung/Sanität und Nebelwurfbecher
        if (u.hp < u.maxHp) { u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.04); got = true; }
        if (u.smokeN < u.smokeMax) { u.smokeN = u.smokeMax; got = true; }
      }
      if (got) { n++; u.working = g.time; }
    }
    if (n && !t.delivered) {
      t.delivered = true;
      this.stats.delivered++;
      g.emit('trainDelivered', t, st);
      g.sayTo(team, 'Bahnhof', `Nachschubzug am ${st.name} – Munition und Treibstoff werden verteilt.`, 4);
    }
  }
  // Waggon zerstört (aus game.killUnit)
  onDeath(u) { if (u.train && u === u.train.cars[0]) u.train.v = 0; }
}
