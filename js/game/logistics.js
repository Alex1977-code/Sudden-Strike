// Logistik, Reparatur, Pioniere und Besatzungs-Mechanik (MP-T4b)
//
// Aktiv nur mit game.logistics (mission.logistics === true, Gefechtsmodus). Die Kampagne bleibt unverändert.
//
// Zustände (alles einfache Felder an Unit bzw. Bauwerke als Unit-ähnliche Strukturen in game.units → snapshot-tauglich):
//   Unit.weapons[i].stock/stockMax (Schuss), Unit.fuel/maxFuel (s Fahrzeit), Unit.material/maxMaterial (Pionier),
//   Unit.supply {ammo, fuel, material} (Versorgungs-Lkw), Unit.immobilized, Unit.abandoned (side 'N'), Unit.crew,
//   Unit.job {type,...}, Bauwerke: type.build, Unit.build {progress,time,kind}, Unit.mines, game.charges[] (Zeitzünder).
// Neue Kommandos (alle über game.command validiert):
//   {t:'build', ids, kind:'tanktrap'|'sandbag'|'trench'|'minefield', x, z, rot}  (oder {t:'build', ids, target} = Bau fortsetzen)
//   {t:'clearmines', ids, x, z} · {t:'demolish', ids, target} · {t:'bailout', ids} · {t:'crew', ids, target}
import * as THREE from 'three';
import { UNIT_TYPES } from './unitTypes.js';
import { BLOCK_TRAP } from './gamepath.js';
import { rand } from '../engine/util.js';

export const BUILD_KINDS = ['tanktrap', 'sandbag', 'trench', 'minefield'];
export const LOGI = {
  tick: 0.25,
  ammoRate: 22,       // Versorgungs-Einheiten/s je Empfänger (Gewicht je Schuss: Waffe.wt)
  fuelRate: 35,       // Fahrzeit-Sekunden/s je Empfänger
  materialRate: 0.34, // Ladungen/s (≈ 3 s je Ladung)
  pointRate: { ammo: 120, fuel: 200, material: 1.5 }, // Nachfüllen des Lkw-Vorrats an Punkten
  fixTime: 6,         // s bis eine zerstörte Kette repariert ist
  clearTime: 3,       // s je Mine (je Pionier)
  fuse: 12,           // s Zeitzünder
  plantTime: 3,
  demolishCost: 2,
  maxBuildPerPlayer: 30,
  mineDmg: { veh: 240, inf: 70 },
  mineDetect: { engineer: 12, recon: 16 },
  bailChance: 0.28, immobChance: 0.15,
};
const MINE_W = { vs: { soft: 1, light: 1, heavy: 0.75, air: 0, struct: 1 }, name: 'Mine' };
const CHARGE_W = { vs: { soft: 1, light: 1, heavy: 1, air: 0, struct: 1 }, name: 'Sprengladung' };
const d2 = (ax, az, bx, bz) => (ax - bx) * (ax - bx) + (az - bz) * (az - bz);

export class Logistics {
  constructor(game) {
    this.g = game;
    this.acc = 0;
    this.covers = [];     // fertige Deckungs-Bauwerke (gecacht)
    this.mineList = [];
    this.stats = { supplied: 0, repaired: 0, built: 0, mines: 0, bailouts: 0, captured: 0, demolished: 0, cleared: 0 };
  }
  get on() { return this.g.logistics; }

  // ---------- Hauptschleife (4×/s) ----------
  update(dt) {
    const g = this.g;
    this.acc += dt;
    if (this.acc < LOGI.tick) return;
    const step = this.acc; this.acc = 0;
    const trucks = [], repairers = [], medics = [];
    this.covers.length = 0; this.mineList.length = 0;
    for (const u of g.units) {
      if (!u.alive) continue;
      const t = u.type;
      if (t.build) { if (u.build?.progress >= 1) { if (t.build.cover) this.covers.push(u); if (t.build.mines) this.mineList.push(u); } continue; }
      if (u.side === 'N') continue;
      if (u.supply) trucks.push(u);
      if (t.repair) repairers.push(u);
      if (t.medic) medics.push(u);
    }
    if (this.on) {
      this.supplyTick(step, trucks);
      this.pointTick(step, trucks);
      this.repairTick(step, repairers);
      this.medicTick(step, medics);
    }
    if (this.mineList.length) this.mineTick(step);
    if (g.charges?.length) this.chargeTick(step);
  }

  // ---------- Versorgung ----------
  // Lkw füllt Munition/Treibstoff/Baumaterial eigener und verbündeter Einheiten (gleiches Team) im Radius auf
  supplyTick(step, trucks) {
    const g = this.g;
    for (const tr of trucks) {
      const s = tr.supply, r2 = tr.type.supply.radius ** 2;
      if (s.ammo <= 0 && s.fuel <= 0 && s.material <= 0) continue;
      for (const u of g.units) {
        if (u === tr || !u.alive || u.side !== tr.side || u.type.structure || u.type.air || u.abandoned) continue;
        if (d2(u.pos.x, u.pos.z, tr.pos.x, tr.pos.z) > r2) continue;
        this.refill(u, s, step, 1, LOGI);
      }
    }
  }
  // Füllt u aus dem Vorrat pool (Objekt mit ammo/fuel/material; unbegrenzt falls Infinity); gibt true zurück, wenn etwas floss
  refill(u, pool, step, k, rates) {
    let moved = false;
    if (pool.ammo > 0) {
      let budget = (rates.ammoRate ?? rates.ammo) * step * k;
      for (const ws of u.weapons) {
        if (ws.stockMax === Infinity || ws.stock >= ws.stockMax || budget <= 0) continue;
        const wt = ws.def.wt || 1;
        const rounds = Math.min(ws.stockMax - ws.stock, budget / wt, pool.ammo / wt);
        if (rounds <= 0) continue;
        ws.stock += rounds; budget -= rounds * wt;
        if (pool.ammo !== Infinity) pool.ammo -= rounds * wt;
        moved = true;
        if (ws.def.ammo && ws.ammo <= 0) ws.reloadT = Math.min(ws.reloadT, 1);
      }
    }
    if (pool.fuel > 0 && u.maxFuel && u.fuel < u.maxFuel) {
      const amt = Math.min(u.maxFuel - u.fuel, (rates.fuelRate ?? rates.fuel) * step * k, pool.fuel);
      u.fuel += amt; if (pool.fuel !== Infinity) pool.fuel -= amt; moved = true;
    }
    if (pool.material > 0 && u.maxMaterial && u.material < u.maxMaterial) {
      const amt = Math.min(u.maxMaterial - u.material, (rates.materialRate ?? rates.material) * step * k, pool.material);
      u.material += amt; if (pool.material !== Infinity) pool.material -= amt; moved = true;
    }
    if (moved) { u.lastSupplied = this.g.time; this.stats.supplied++; }
    return moved;
  }
  // Nachschubpunkte der Mission (mission.supplyPoints(g) → [{x,z,r,team,direct}]): Lkw füllen ihren Vorrat auf,
  // bei direct (Spawn/Depot) auch jede Einheit des Teams
  pointTick(step, trucks) {
    const g = this.g;
    const pts = g.mission?.supplyPoints?.(g);
    if (!pts || !pts.length) return;
    for (const pt of pts) {
      const r2 = pt.r * pt.r;
      for (const u of g.units) {
        if (!u.alive || u.side !== pt.team || u.type.structure || u.type.air || u.abandoned) continue;
        if (d2(u.pos.x, u.pos.z, pt.x, pt.z) > r2) continue;
        if (u.supply) {
          const max = u.type.supply;
          u.supply.ammo = Math.min(max.ammo, u.supply.ammo + LOGI.pointRate.ammo * step);
          u.supply.fuel = Math.min(max.fuel, u.supply.fuel + LOGI.pointRate.fuel * step);
          u.supply.material = Math.min(max.material, u.supply.material + LOGI.pointRate.material * step);
        }
        if (pt.direct) this.refill(u, { ammo: Infinity, fuel: Infinity, material: Infinity }, step, 1, LOGI);
      }
    }
  }
  // Reparatur (Bergepanzer): Fahrzeuge im Radius, auch verlassene (side 'N'); zerstörte Ketten nach fixTime
  repairTick(step, repairers) {
    const g = this.g;
    for (const rp of repairers) {
      const def = rp.type.repair, r2 = def.radius ** 2;
      for (const u of g.units) {
        if (u === rp || !u.alive || !u.type.vehicle || u.type.structure) continue;
        if (u.side !== rp.side && !u.abandoned) continue;
        if (d2(u.pos.x, u.pos.z, rp.pos.x, rp.pos.z) > r2) continue;
        let did = false;
        if (u.hp < u.maxHp) { u.hp = Math.min(u.maxHp, u.hp + u.maxHp * def.rate * step); did = true; }
        if (u.immobilized) { u.fixT = (u.fixT || 0) + step; did = true; if (u.fixT >= LOGI.fixTime) { u.immobilized = false; u.fixT = 0; } }
        if (did) { u.lastRepaired = g.time; this.stats.repaired++; }
      }
    }
  }
  medicTick(step, medics) {
    const g = this.g;
    for (const m of medics) {
      const def = m.type.medic, r2 = def.radius ** 2;
      for (const u of g.units) {
        if (!u.alive || !u.type.infantry || u.side !== m.side || u.hp >= u.maxHp) continue;
        if (d2(u.pos.x, u.pos.z, m.pos.x, m.pos.z) > r2) continue;
        u.hp = Math.min(u.maxHp, u.hp + def.rate * step);
      }
    }
  }

  // ---------- Treffer: Kette zerstört, Besatzung steigt aus ----------
  onVehicleHit(u, amount, src) {
    if (!this.on || u.abandoned || u.invulnerable || u.owner === null) return;
    const frac = u.hp / u.maxHp, g = this.g;
    if (!u.immobilized && amount >= u.maxHp * 0.06 && Math.random() < LOGI.immobChance) {
      u.immobilized = true;
      if (g.isOwn(u)) g.alert(`⚠ ${u.name}: Kette/Antrieb zerstört`, 3);
    }
    if ((frac < 0.2 || (u.immobilized && frac < 0.5)) && amount >= u.maxHp * 0.02 && Math.random() < LOGI.bailChance) this.bailOut(u);
  }
  canBail(u) { return u.alive && !u.abandoned && u.type.vehicle && !u.type.structure && !u.invulnerable && (u.hp < u.maxHp * 0.25 || u.immobilized || (u.maxFuel > 0 && u.fuel <= 0)); }
  // Besatzung steigt aus: 2–3 Infanteristen, Fahrzeug wird neutral „verlassen“ (kein Wrack)
  bailOut(u) {
    const g = this.g;
    if (!u.alive || u.abandoned) return false;
    const side = u.side, owner = u.owner;
    const n = u.type.armor === 'heavy' ? 3 : 2;
    const key = side === 'UA' ? 'ua_crew' : 'e_crew';
    u.abandoned = true; u.prevSide = side; u.prevOwner = owner;
    u.side = 'N'; u.owner = null;
    u.order = null; u.path = null; u.moving = false; u.job = null; u.ai = null; u.crew = 0; u.holdFire = false;
    for (const ws of u.weapons) ws.target = null;
    u.seenBy = { UA: true, RU: true };
    u.root.visible = true;
    if (u.ring) u.ring.visible = false;
    if (g.selected.includes(u)) g.select(g.selected.filter((s) => s !== u));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + u.heading + 0.6;
      const r = u.radius + 1.6;
      const cx = u.pos.x + Math.sin(a) * r, cz = u.pos.z + Math.cos(a) * r;
      const c = g.spawn(key, side, cx, cz, { owner, heading: a });
      c.crewOf = u.id;
      c.moveTo(cx + Math.sin(a) * 5, cz + Math.cos(a) * 5);
      if (g.isAIOwned(c)) c.ai = null;
    }
    this.stats.bailouts++;
    g.emit('bailout', u, side, owner);
    if (side === g.localSide) g.say('Funk', `${u.name}: Besatzung hat das Fahrzeug verlassen!`, 3);
    return true;
  }
  maxCrew(u) { return u.type.armor === 'heavy' ? 3 : 2; }
  // Infanterist übernimmt ein verlassenes Fahrzeug: gehört danach dem Team/Spieler des Infanteristen
  takeOver(t, inf) {
    const g = this.g;
    const prev = t.prevSide;
    t.abandoned = false; t.side = inf.side; t.owner = inf.owner; t.crew = 1; t.holdFire = false;
    t.seenBy = { UA: t.side === 'UA', RU: t.side === 'RU' };
    for (const ws of t.weapons) ws.target = null;
    t.order = null; t.path = null;
    this.stats.captured++;
    g.emit('vehicleCaptured', t, inf);
    if (t.side === g.localSide) { g.say('Funk', `${t.name} übernommen!`, 2.5); g.audio.ui('obj'); }
    else if (prev === g.localSide) g.alert(`⚠ ${t.name} wurde vom Feind übernommen!`, 3);
    this.board(inf);
    g.updateVision(0, true);
  }
  board(inf) {
    const g = this.g;
    inf.alive = false; inf.job = null;
    g.removeUnit(inf);
    g.scene.remove(inf.root);
    if (inf.ring) { g.scene.remove(inf.ring); inf.ring = null; }
  }

  // ---------- Platzierung / Bauwerke ----------
  footprintOk(kind, x, z, rot) {
    const g = this.g, T = g.terrain, def = UNIT_TYPES[kind].build;
    if (!T.inBounds(x, z, -12)) return false;
    const c = Math.cos(rot), s = Math.sin(rot);
    const hw = def.w / 2, hd = def.d / 2;
    for (const [lx, lz] of [[0, 0], [hw, hd], [-hw, hd], [hw, -hd], [-hw, -hd], [hw, 0], [-hw, 0]]) {
      const px = x + lx * c + lz * s, pz = z - lx * s + lz * c;
      const k = T.cellIndex(px, pz);
      if (k < 0 || T.gWater[k] || T.gBlocked[k] === 1 || T.gBlocked[k] === 3 || T.gBlocked[k] === 2) return false;
      if (kind === 'tanktrap' && T.gBlocked[k] === BLOCK_TRAP) return false;
    }
    for (const u of g.units) {
      if (!u.alive || !u.type.build) continue;
      if (Math.hypot(u.pos.x - x, u.pos.z - z) < (u.radius + UNIT_TYPES[kind].radius) * 0.7) return false;
    }
    return true;
  }
  countBuilds(owner) { let n = 0; for (const u of this.g.units) if (u.alive && u.type.build && u.owner === owner) n++; return n; }
  // Panzersperren in das Pfadraster eintragen (gBlocked = 4): nur freie Zellen, alle Sperren neu aufbauen
  rebuildTraps() {
    const T = this.g.terrain;
    for (let i = 0; i < T.gBlocked.length; i++) if (T.gBlocked[i] === BLOCK_TRAP) T.gBlocked[i] = 0;
    for (const u of this.g.units) {
      if (!u.alive || u.type.build?.blocks !== true) continue;
      this.blockTrap(u);
    }
  }
  blockTrap(u) {
    const T = this.g.terrain, d = u.type.build;
    const c = Math.cos(u.heading), s = Math.sin(u.heading);
    const M = 2.2; // Sicherheitsabstand: Fahrzeuge (Radius ≈ 3 m) halten Abstand zum Bauwerk
    const r = Math.hypot(d.w, d.d) / 2 + M + 2;
    const [ci, cj] = T.cellOf(u.pos.x, u.pos.z);
    const cr = Math.ceil(r / 2);
    for (let j = cj - cr; j <= cj + cr; j++) for (let i = ci - cr; i <= ci + cr; i++) {
      if (i < 0 || j < 0 || i >= T.gw || j >= T.gw) continue;
      const [cx, cz] = T.cellCenter(i, j);
      const dx = cx - u.pos.x, dz = cz - u.pos.z;
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      if (Math.abs(lx) <= d.w / 2 + M && Math.abs(lz) <= d.d / 2 + M) { const k = j * T.gw + i; if (T.gBlocked[k] === 0) T.gBlocked[k] = BLOCK_TRAP; }
    }
  }
  // Bauwerk aus dem Spiel genommen (zerstört, abgebaut, Minen aufgebraucht)
  onBuildingGone(u) {
    if (u.type.build?.blocks) this.rebuildTraps();
  }
  removeBuilding(u) {
    if (!u.alive) return;
    u.alive = false;
    this.g.scene.remove(u.root);
    this.g.removeUnit(u);
  }
  setProgress(u, k) {
    u.build.progress = Math.min(1, k);
    u.hp = Math.max(1, Math.round(u.maxHp * (0.3 + 0.7 * u.build.progress)));
    u.root.scale.set(1, 0.3 + 0.7 * u.build.progress, 1);
    u.root.updateMatrix();
  }

  // ---------- Kommandos ----------
  assign(u, job) { u.job = job; u.order = null; u.path = null; } // laufende Bewegung verwerfen, der Auftrag steuert selbst
  command(p, cmd, units) {
    const g = this.g;
    const fin = (v) => typeof v === 'number' && Number.isFinite(v);
    switch (cmd.t) {
      case 'build': return this.cmdBuild(p, cmd, units, fin);
      case 'clearmines': {
        const eng = units.filter((u) => u.type.engineer && !u.abandoned);
        if (!eng.length || !fin(cmd.x) || !fin(cmd.z)) return false;
        let m = null, bd = 9;
        for (const u of g.units) {
          if (!u.alive || !u.type.build?.mines) continue;
          if (!(u.side === p.team || u.seenBy[p.team])) continue;
          const d = Math.hypot(u.pos.x - cmd.x, u.pos.z - cmd.z);
          if (d < bd) { bd = d; m = u; }
        }
        if (!m) return false;
        for (const e of eng) this.assign(e, { type: 'clear', target: m.id });
        return true;
      }
      case 'demolish': {
        const eng = units.filter((u) => u.type.engineer && !u.abandoned);
        const t = g.unitById(cmd.target);
        if (!eng.length || !t || !t.alive || !t.type.structure || t.type.cp || t.invulnerable || t.side === p.team) return false;
        if (t.side !== 'N' && !g.fowFor(p.team).isExplored(t.pos.x, t.pos.z)) return false;
        if (eng.reduce((s, e) => s + e.material, 0) < LOGI.demolishCost) return false;
        for (const e of eng) this.assign(e, { type: 'demolish', target: t.id, phase: 'go', t: 0 });
        return true;
      }
      case 'bailout': {
        let any = false;
        for (const u of units) if (this.canBail(u)) any = this.bailOut(u) || any;
        return any;
      }
      case 'crew': {
        const t = g.unitById(cmd.target);
        const inf = units.filter((u) => u.type.infantry && !u.type.air);
        if (!inf.length || !t || !t.alive || !t.type.vehicle || t.type.structure) return false;
        if (!t.abandoned && t.side !== p.team) return false; // nur verlassene oder eigene (Nachbesetzen) Fahrzeuge
        for (const u of inf) this.assign(u, { type: 'crew', target: t.id });
        return true;
      }
    }
    return false;
  }
  cmdBuild(p, cmd, units, fin) {
    const g = this.g;
    const eng = units.filter((u) => u.type.engineer && !u.abandoned);
    if (!eng.length) return false;
    if (cmd.target !== undefined && cmd.kind === undefined) { // Bau fortsetzen
      const t = g.unitById(cmd.target);
      if (!t || !t.alive || !t.build || t.build.progress >= 1 || t.side !== p.team) return false;
      for (const e of eng) this.assign(e, { type: 'build', target: t.id });
      return true;
    }
    if (!BUILD_KINDS.includes(cmd.kind) || !fin(cmd.x) || !fin(cmd.z)) return false;
    const rot = fin(cmd.rot) ? cmd.rot : 0;
    const def = UNIT_TYPES[cmd.kind].build;
    if (this.countBuilds(p.id) >= LOGI.maxBuildPerPlayer) return false;
    if (eng.reduce((s, e) => s + e.material, 0) < def.cost - 1e-6) return false;
    if (!this.footprintOk(cmd.kind, cmd.x, cmd.z, rot)) return false;
    // Material von den nächsten Pionieren abbuchen
    let need = def.cost;
    for (const e of [...eng].sort((a, b) => d2(a.pos.x, a.pos.z, cmd.x, cmd.z) - d2(b.pos.x, b.pos.z, cmd.x, cmd.z))) {
      const take = Math.min(e.material, need); e.material -= take; need -= take; if (need <= 1e-6) break;
    }
    const u = g.spawn(cmd.kind, p.team, cmd.x, cmd.z, { owner: p.id, rot, noBlock: true, build: { progress: 0, time: def.time, kind: cmd.kind }, mines: def.mines || 0 });
    this.setProgress(u, 0.02);
    if (def.hidden && p.team !== g.localSide) u.root.visible = false;
    if (def.blocks) { this.blockTrap(u); g.onObstacleAdded(u.pos.x, u.pos.z, Math.max(def.w, def.d) * 0.6, true); }
    for (const e of eng) this.assign(e, { type: 'build', target: u.id });
    this.stats.built++;
    g.emit('buildStarted', u);
    return true;
  }

  // ---------- Aufträge (Pioniere, Übernahme) – pro Frame aus Unit.update ----------
  updateJob(u, dt) {
    const g = this.g, job = u.job;
    const face = (t) => { const a = Math.atan2(t.pos.x - u.pos.x, t.pos.z - u.pos.z); u.heading = a; };
    const t = g.unitById(job.target);
    if (!t || !t.alive) { u.job = null; return; }
    const dist = Math.hypot(t.pos.x - u.pos.x, t.pos.z - u.pos.z);
    switch (job.type) {
      case 'build': {
        if (!t.build || t.build.progress >= 1) { u.job = null; return; }
        if (dist > t.radius * 0.6 + 4) { if (!u.order || u.order.type !== 'move') u._goto(t.pos.x, t.pos.z); return; }
        if (u.order) { u.order = null; u.path = null; }
        face(t);
        u.working = g.time;
        this.setProgress(t, t.build.progress + dt / t.build.time);
        if (Math.random() < dt * 0.8) g.effects.smallHit(t.pos.x + rand(-1.5, 1.5), t.pos.y + 0.6, t.pos.z + rand(-1, 1));
        if (t.build.progress >= 1) { g.emit('built', t); g.effects.marker(t.pos.x, t.pos.z, 0x5dff8a, 0.8, 3); }
        return;
      }
      case 'clear': {
        if (!t.type.build?.mines) { u.job = null; return; }
        if (dist > Math.max(2.5, t.radius * 0.55)) { if (!u.order || u.order.type !== 'move') u._goto(t.pos.x, t.pos.z); return; }
        if (u.order) { u.order = null; u.path = null; }
        u.working = g.time;
        t.mines -= dt / LOGI.clearTime;
        if (Math.random() < dt * 0.6) g.effects.smallHit(t.pos.x + rand(-3, 3), t.pos.y + 0.3, t.pos.z + rand(-3, 3));
        if (t.mines <= 0.0001) { this.stats.cleared++; this.removeBuilding(t); g.emit('minesCleared', t); u.job = null; }
        return;
      }
      case 'demolish': {
        if (job.phase === 'go') {
          if (dist - t.radius * 0.5 > 5) { if (!u.order || u.order.type !== 'move') u._goto(t.pos.x, t.pos.z); return; }
          if (u.order) { u.order = null; u.path = null; }
          job.phase = 'plant'; job.t = 0; return;
        }
        if (job.phase === 'plant') {
          face(t); u.working = g.time;
          job.t += dt;
          if (job.t < LOGI.plantTime) return;
          if (u.material < LOGI.demolishCost) { u.job = null; return; }
          u.material -= LOGI.demolishCost;
          (g.charges ||= []).push({ x: t.pos.x, z: t.pos.z, target: t.id, t: LOGI.fuse, owner: u.owner, side: u.side });
          g.effects.marker(t.pos.x, t.pos.z, 0xff3030, LOGI.fuse, Math.max(3, t.radius * 0.5));
          if (u.side === g.localSide) g.say('Pionier', `Sprengladung gelegt – Zünder ${LOGI.fuse} s. Abstand halten!`, 3);
          g.emit('chargePlanted', t, u);
          // Rückzug
          const a = Math.atan2(u.pos.x - t.pos.x, u.pos.z - t.pos.z);
          u.job = null;
          u.moveTo(t.pos.x + Math.sin(a) * (t.radius + 22), t.pos.z + Math.cos(a) * (t.radius + 22));
        }
        return;
      }
      case 'crew': {
        if (!t.type.vehicle) { u.job = null; return; }
        const ownVeh = !t.abandoned && t.side === u.side;
        if (!t.abandoned && !ownVeh) { u.job = null; return; } // inzwischen vom Feind besetzt
        if (dist - t.radius * 0.8 > 2.4) { if (!u.order || u.order.type !== 'move' || d2(u.order.x, u.order.z, t.pos.x, t.pos.z) > 4) u._goto(t.pos.x, t.pos.z); return; }
        if (t.abandoned) this.takeOver(t, u);
        else if (t.crew < this.maxCrew(t)) { t.crew++; this.board(u); }
        else u.job = null;
        return;
      }
    }
    u.job = null;
  }

  // ---------- Minen ----------
  mineTick(step) {
    const g = this.g;
    for (const m of this.mineList) {
      if (!m.alive) continue;
      const r = m.radius * 0.9, r2 = r * r;
      for (const u of g.units) {
        if (!u.alive || u.type.air || u.type.structure || u.type.naval || u.abandoned || u.side === m.side || u.side === 'N') continue;
        if (d2(u.pos.x, u.pos.z, m.pos.x, m.pos.z) > r2) continue;
        if (!u.moving || (u.mineCd || 0) > g.time) continue; // nur Einheiten in Bewegung lösen Minen aus
        if (u.job?.type === 'clear' && u.job.target === m.id) continue; // Räumende Pioniere lösen nichts aus
        u.mineCd = g.time + 2.2;
        const veh = u.type.vehicle;
        g.effects.explosion(u.pos.x, u.pos.y + 0.3, u.pos.z, veh ? 0.9 : 0.5, { crater: false });
        g.applyDamage(u, veh ? LOGI.mineDmg.veh : LOGI.mineDmg.inf, MINE_W, { pos: m.pos, alive: false, side: m.side, owner: m.owner }, { topAttack: true });
        if (veh && u.alive && Math.random() < 0.5 && g.logistics && !u.immobilized) { u.immobilized = true; if (g.isOwn(u)) g.alert(`⚠ ${u.name}: Mine – Kette zerstört`, 3); }
        m.mines -= 1;
        m.seenBy[u.side] = true; // Opfer-Team kennt das Minenfeld jetzt
        this.stats.mines++;
        g.emit('mineTriggered', m, u);
        if (m.side === g.localSide) g.say('Pionier', 'Minenfeld hat ausgelöst!', 2);
        else if (u.side === g.localSide) g.alert('⚠ Minenfeld!', 2.5);
        if (m.mines <= 0.0001) { this.removeBuilding(m); break; }
      }
    }
  }
  // Minenfeld für das Team sichtbar? (eigene immer; gegnerische nach Aufklärung durch Pioniere/Drohnen in der Nähe)
  detectMines(byTeam) {
    for (const m of this.g.units) {
      if (!m.alive || !m.type.build?.hidden) continue;
      for (const team of ['UA', 'RU']) {
        if (m.seenBy[team] || team === m.side) continue;
        for (const o of byTeam[team] || []) {
          const k = o.type.engineer ? LOGI.mineDetect.engineer : (o.type.key === 'recon' || o.type.key === 'orlan') ? LOGI.mineDetect.recon : 0;
          if (k && d2(o.pos.x, o.pos.z, m.pos.x, m.pos.z) < (k + m.radius) ** 2) { m.seenBy[team] = true; break; }
        }
      }
    }
  }

  // ---------- Sprengladungen ----------
  chargeTick(step) {
    const g = this.g;
    for (let i = g.charges.length - 1; i >= 0; i--) {
      const c = g.charges[i];
      c.t -= step;
      if (c.t > 0) continue;
      g.charges.splice(i, 1);
      const t = g.unitById(c.target);
      const src = { pos: new THREE.Vector3(c.x, 0, c.z), alive: false, side: c.side, owner: c.owner };
      g.effects.explosion(c.x, g.terrain.surface(c.x, c.z) + 1.5, c.z, 2.4);
      g.effects.shake = Math.max(g.effects.shake || 0, 1.2);
      if (t && t.alive) { g.applyDamage(t, 9000, CHARGE_W, src, { topAttack: true }); this.stats.demolished++; }
      g.splashDamage(c.x, c.z, 9, 500, CHARGE_W, c.side, t, true, c.owner);
      g.emit('chargeDetonated', c);
    }
  }

  // ---------- Deckung ----------
  // Multiplikator auf Schaden für Infanterie hinter Sandsäcken/im Graben (1 = keine Deckung)
  coverMul(u) {
    const c = this.coverOf(u);
    return c ? 1 - c.type.build.cover : 1;
  }
  coverOf(u) {
    if (!this.covers.length || !u.type.infantry) return null;
    let best = null;
    for (const b of this.covers) {
      if (b.side !== u.side) continue;
      if (d2(u.pos.x, u.pos.z, b.pos.x, b.pos.z) > (b.radius + 1) ** 2) continue;
      if (!best || b.type.build.cover > best.type.build.cover) best = b;
    }
    return best;
  }
}
