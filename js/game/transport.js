// V3-M2: Auf-/Absitzen (Lkw, Schützenpanzer, Halbketten, Landungsboote, Hubschrauber) und gezogene Geschütze.
//
// Typfelder: transport: n (Plätze für Infanterie), tow: true (Zugfahrzeug), towable: true (gezogenes Geschütz; WK2-Typen
//   mit towed:true werden in unitTypes.prepareType vereinheitlicht), airdropOnly (Transportflugzeuge: nur Fallschirmabwurf).
// Kommandos: {t:'embark', ids: Infanterie, target: Fahrzeug} · {t:'unload', ids: Fahrzeuge, x?, z?} (ohne Ziel sofort,
//   mit Ziel: hinfahren/-fliegen, landen, absitzen) · {t:'hitch', ids: Zugfahrzeug, target: Geschütz} (Aufprotzen)
//   · {t:'unhitch', ids: Zugfahrzeuge oder Geschütze} (Abprotzen).
// Zustände: Fahrzeug.cargo [Unit] (Insassen sind NICHT in game.units – unsichtbar und geschützt, bleiben in game.unitMap),
//   Insasse.carrier = Fahrzeug, Infanterie.embarkGoal, Fahrzeug.unloadAt {x,z}, Fahrzeug.towing / Geschütz.towedBy,
//   Fahrzeug.hitchGoal, limberT (Auf-/Abprotzzeit läuft), Hubschrauber.landing/landed.
// Zerstörung: anteilig sterben Insassen (TR.deathShare, in der Luft alle), der Rest steigt verwundet aus.
// KI: Transporte mit Insassen, deren Besitzer KI ist (oder die selbst eine Missions-KI haben), setzen bei Feindkontakt ab.
// Missions-API: game.spawn(type, side, x, z, { cargo: [['e_rifle', 4], …] }) lädt Insassen direkt ein.
import { UNIT_TYPES } from './unitTypes.js';

export const TR = {
  boardDist: 2.4,       // m zur Fahrzeugkante
  limber: 4,            // s Auf-/Abprotzen
  towSpeed: 0.8,        // Tempo des Zugfahrzeugs mit Geschütz
  deathShare: 0.5,      // Anteil Insassen, die bei Zerstörung sterben (schwer gepanzert 0,35)
  woundedHp: 0.45,
  aiUnloadR: 45,        // m Feindkontakt, bei dem KI-Transporte absitzen lassen
  tick: 0.2,
};
const fin = (v) => typeof v === 'number' && Number.isFinite(v);
const d2 = (ax, az, bx, bz) => (ax - bx) * (ax - bx) + (az - bz) * (az - bz);

export class Transport {
  constructor(game) {
    this.g = game;
    this.acc = 0; this.aiAcc = 0;
    this.stats = { boarded: 0, unloaded: 0, killedInside: 0, hitched: 0, unhitched: 0, aiUnloads: 0 };
  }
  // ---------------- Fähigkeiten ----------------
  capacity(v) { const t = v?.type; return t && t.transport > 0 && !t.airdropOnly && (t.vehicle || t.naval || t.air) && !t.structure ? t.transport : 0; }
  canCarry(v) { return !!v && v.alive && !v.abandoned && this.capacity(v) > 0 && !v.towedBy; }
  room(v) { return this.capacity(v) - (v.cargo?.length || 0); }
  canBoard(u) { return !!u && u.alive && u.type.infantry && !u.type.kamikaze && !u.abandoned && !u.carrier; }
  canTow(v) { return !!v && v.alive && !v.abandoned && !!v.type.tow && !v.towing && !v.type.air; }
  isTowable(gun) { return !!gun && gun.alive && !!gun.type.towable && !gun.towedBy && !gun.abandoned; }
  // Insassen für HUD (Host: echte Einheiten, Client: Typen aus dem Snapshot)
  cargoTypes(v) { return v.remote ? (v.netCargo || []).map((k) => UNIT_TYPES[k]).filter(Boolean) : (v.cargo || []).map((u) => u.type); }
  cargoCount(v) { return v.remote ? (v.netCargo?.length ?? v.netCargoN ?? 0) : (v.cargo?.length || 0); }

  // ---------------- Kommandos ----------------
  command(p, cmd, units) {
    const g = this.g;
    switch (cmd.t) {
      case 'embark': {
        const v = g.unitById(cmd.target);
        if (!this.canCarry(v) || v.side !== p.team || (v.owner !== p.id && !g.playerById(v.owner)?.ai && v.owner !== null)) return false;
        const inf = units.filter((u) => this.canBoard(u));
        if (!inf.length) return false;
        let room = this.room(v) - g.units.filter((u) => u.embarkGoal === v).length;
        if (room <= 0) return false;
        let n = 0;
        for (const u of inf) {
          if (room <= 0) break;
          if (u.garrison) g.gar.leave(u);
          u.job = null; u.garrisonGoal = null; u.throwOrder = null; u.retreat = null;
          u.embarkGoal = v; u._embT = 0;
          this._approach(u, v);
          room--; n++;
        }
        if (n && v.type.air && v.curAlt > 1.5) this.land(v);
        return n > 0;
      }
      case 'unload': {
        const vs = units.filter((v) => v.cargo?.length);
        if (!vs.length) return false;
        for (const v of vs) {
          if (fin(cmd.x) && fin(cmd.z)) {
            v.unloadAt = { x: cmd.x, z: cmd.z };
            if (v.landed) this.takeoff(v);
            if (v.type.rail) { v.unloadAt = null; this.unloadAll(v); continue; }
            v.moveTo(cmd.x, cmd.z);
          } else if (v.type.air && v.curAlt > 1.2) { v.unloadAt = { x: v.pos.x, z: v.pos.z }; v.stop(); this.land(v); }
          else this.unloadAll(v);
        }
        return true;
      }
      case 'hitch': {
        const gun = g.unitById(cmd.target);
        if (!this.isTowable(gun) || gun.side !== p.team) return false;
        const v = units.find((u) => this.canTow(u));
        if (!v) return false;
        v.hitchGoal = gun; v.limberT = 0; v._limb = null;
        const a = Math.atan2(v.pos.x - gun.pos.x, v.pos.z - gun.pos.z), r = v.radius + gun.radius + 1.5;
        v.moveTo(gun.pos.x + Math.sin(a) * r, gun.pos.z + Math.cos(a) * r);
        gun.stop();
        return true;
      }
      case 'unhitch': {
        let n = 0;
        for (const u of units) {
          const v = u.towing ? u : u.towedBy;
          if (!v || v.limberT > 0) continue;
          v.stop(); v.limberT = TR.limber; v._limb = 'off'; if (v.towing) v.towing.limberT = TR.limber;
          n++;
        }
        return n > 0;
      }
    }
    return undefined;
  }
  _approach(u, v) {
    const a = Math.atan2(u.pos.x - v.pos.x, u.pos.z - v.pos.z), r = v.radius * 0.9 + 1.2;
    u._goto(v.pos.x + Math.sin(a) * r, v.pos.z + Math.cos(a) * r);
    u._embX = v.pos.x; u._embZ = v.pos.z;
  }

  // ---------------- Ein-/Aussteigen ----------------
  board(u, v) {
    const g = this.g;
    if (!this.canCarry(v) || this.room(v) <= 0 || !u.alive) return false;
    if (u.garrison) g.gar.leave(u);
    u.embarkGoal = null; u.order = null; u.path = null; u.job = null; u.moving = false; u.throwOrder = null; u.retreat = null;
    for (const w of u.weapons) w.target = null;
    u.carrier = v;
    (v.cargo ||= []).push(u);
    const i = g.units.indexOf(u);
    if (i >= 0) g.units.splice(i, 1);
    if (g.selected.includes(u)) g.select(g.selected.filter((s) => s !== u));
    if (u.ring) u.ring.visible = false;
    u.root.visible = false;
    if (u._cone) u._cone.visible = false;
    this.stats.boarded++;
    g.emit('embark', u, v);
    g.emit('selection');
    return true;
  }
  // Alle Insassen absitzen lassen (hinter dem Fahrzeug, auf begehbaren Zellen). hpMul < 1: verwundet.
  unloadAll(v, { hpMul = 1, supp = 0 } = {}) {
    const g = this.g, T = g.terrain, pf = g.pathfinder;
    const list = v.cargo || [];
    if (!list.length) return [];
    v.cargo = [];
    const out = [];
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    list.forEach((u, i) => {
      const row = Math.floor(i / 4), col = (i % 4) - 1.5;
      let x = v.pos.x - fx * (v.radius + 1.4 + row * 1.6) + fz * col * 1.3, z = v.pos.z - fz * (v.radius + 1.4 + row * 1.6) - fx * col * 1.3;
      const ok = (px, pz) => { const k = T.cellIndex(px, pz); return k >= 0 && pf.passable(k, 'ground', false) && !T.gWater[k]; };
      if (!ok(x, z)) {
        let found = false;
        for (let r = v.radius + 1.5; r < v.radius + 14 && !found; r += 1.5) for (let a = 0; a < 6.28 && !found; a += 0.5) {
          const px = v.pos.x + Math.sin(a + i) * r, pz = v.pos.z + Math.cos(a + i) * r;
          if (ok(px, pz)) { x = px; z = pz; found = true; }
        }
      }
      u.carrier = null;
      u.pos.x = x; u.pos.z = z; u.heading = v.heading;
      u.order = null; u.path = null; u.moving = false;
      if (hpMul < 1) u.hp = Math.max(1, u.hp * hpMul);
      if (supp && g.tac) { u.supp = Math.min(100, (u.supp || 0) + supp); u.suppT = g.time; }
      u.root.visible = true;
      if (!g.units.includes(u)) g.units.push(u);
      g.unitMap.set(u.id, u);
      u.place(0);
      out.push(u);
    });
    // Missions-/Gefechts-KI: abgesessene Infanterie übernimmt die KI des Fahrzeugs (Kampagne) bzw. sammelt sich
    for (const u of out) if (v.ai && !u.ai && !g.playerById(u.owner)?.ai) u.ai = { mode: 'guard', radius: 35, home: [u.pos.x, u.pos.z] };
    this.stats.unloaded += out.length;
    g.emit('disembark', v, out);
    g.visionT = 0;
    if (g.isOwn(v)) g.audio.ui('ack');
    return out;
  }
  // Missions-API: Insassen direkt einladen ([[typ, n], …] bzw. [typ, …])
  loadNew(v, list) {
    const g = this.g;
    for (const e of list || []) {
      const [type, n] = Array.isArray(e) ? e : [e, 1];
      for (let i = 0; i < n && this.room(v) > 0; i++) {
        if (!UNIT_TYPES[type]?.infantry) continue;
        const u = g.spawn(type, v.side, v.pos.x, v.pos.z, { owner: v.owner });
        this.board(u, v);
      }
    }
  }
  land(v) { if (!v.type.air) return; if (!v.landing && !v.landed) v._alt0 = v.alt; v.landing = true; v.alt = 0; }
  takeoff(v) { if (!v.type.air) return; v.landed = false; v.landing = false; v.alt = v._alt0 ?? v.type.alt ?? 18; }

  // ---------------- Zerstörung / Entfernen ----------------
  onDeath(v, killer) {
    const g = this.g;
    if (v.towing) this._unlink(v);
    if (v.towedBy) this._unlink(v.towedBy);
    if (v.hitchGoal) v.hitchGoal = null;
    if (!v.cargo?.length) return;
    const n = v.cargo.length;
    const air = v.type.air && v.curAlt > 3;
    const share = air ? 1 : v.type.armor === 'heavy' ? 0.35 : TR.deathShare;
    const out = this.unloadAll(v, { hpMul: TR.woundedHp, supp: 70 });
    const dead = Math.min(out.length, Math.round(n * share + (Math.random() < 0.5 ? 0.4 : 0)));
    const shuffled = out.sort(() => Math.random() - 0.5);
    for (let i = 0; i < dead; i++) { const u = shuffled[i]; if (u.alive) { this.stats.killedInside++; g.killUnit(u, killer && killer.side ? killer : null, true); } }
    if (n) g.alertTo(v.owner ?? v.side, `⚠ ${v.name} zerstört – ${dead} von ${n} Insassen gefallen`, 3);
  }
  onRemove(u) {
    if (u.towing || u.towedBy) this._unlink(u.towing ? u : u.towedBy);
    if (u.cargo?.length && !u.alive) {
      // Fahrzeug verschwindet ohne Tod (z. B. Mission entfernt es): Insassen sterben mit
      for (const p of u.cargo) { p.carrier = null; p.alive = false; this.g.unitMap.delete(p.id); }
      u.cargo = [];
    }
  }
  _unlink(v) {
    const gun = v.towing;
    v.towing = null; v.limberT = 0; v._limb = null;
    if (gun) { gun.towedBy = null; gun.limberT = 0; }
  }

  // ---------------- Hauptschleife (Host, nach den Einheiten) ----------------
  update(dt) {
    const g = this.g;
    // Geschütze folgen dem Zugfahrzeug (jedes Frame)
    for (const v of g.units) if (v.towing && v.alive) this._dragGun(v, dt);
    this.acc += dt;
    if (this.acc < TR.tick) return;
    const step = this.acc; this.acc = 0;
    for (const u of [...g.units]) {
      if (!u.alive) continue;
      if (u.embarkGoal) this._embarkStep(u, step);
      if (u.unloadAt) this._unloadStep(u);
      if (u.hitchGoal || u.limberT > 0) this._limberStep(u, step);
      if (u.type.air && (u.landing || u.landed)) {
        if (u.landing && u.curAlt < 0.6) { u.landing = false; u.landed = true; u.curAlt = 0; }
        if (u.landed && ((u.order && u.order.type !== 'attack') || u.path?.length)) this.takeoff(u);
      }
    }
    // KI-Transporte: bei Feindkontakt absitzen
    this.aiAcc += step;
    if (this.aiAcc >= 0.6) { this.aiAcc = 0; this._aiUnload(); }
  }
  _embarkStep(u, step) {
    const v = u.embarkGoal;
    if (!this.canCarry(v) || v.side !== u.side || this.room(v) <= 0) { u.embarkGoal = null; u.stop(); return; }
    const reach = v.radius + TR.boardDist + (v.type.naval ? 3 : 0);
    if (d2(u.pos.x, u.pos.z, v.pos.x, v.pos.z) <= reach * reach && (!v.type.air || v.curAlt < 1.5)) { this.board(u, v); return; }
    u._embT = (u._embT || 0) + step;
    // Fahrzeug hat sich bewegt oder Weg zu Ende: neu anlaufen
    if (u._embT > 1.2 && (d2(u._embX, u._embZ, v.pos.x, v.pos.z) > 9 || !u.order || !u.path?.length)) { u._embT = 0; this._approach(u, v); }
  }
  _unloadStep(v) {
    const a = v.unloadAt;
    if (!v.cargo?.length) { v.unloadAt = null; return; }
    const arrived = d2(v.pos.x, v.pos.z, a.x, a.z) < (v.radius + 4) ** 2 || (!v.order && !v.path?.length);
    if (!arrived) return;
    if (v.type.air && v.curAlt > 1.2) { if (!v.landing) { v.stop(); this.land(v); } return; }
    v.unloadAt = null;
    v.stop();
    this.unloadAll(v);
  }
  _limberStep(v, step) {
    const g = this.g;
    if (v.towedBy) return; // Geschütz: Zeit läuft über das Fahrzeug
    if (v.hitchGoal) {
      const gun = v.hitchGoal;
      if (!this.isTowable(gun) || gun.side !== v.side || !this.canTow(v)) { v.hitchGoal = null; v.limberT = 0; return; }
      const reach = v.radius + gun.radius + 5;
      if (!(v.limberT > 0)) {
        if (d2(v.pos.x, v.pos.z, gun.pos.x, gun.pos.z) <= reach * reach) { v.stop(); v.limberT = TR.limber; v._limb = 'on'; gun.limberT = TR.limber; gun.stop(); }
        else if (!v.order && !v.path?.length) { const a = Math.atan2(v.pos.x - gun.pos.x, v.pos.z - gun.pos.z), r = v.radius + gun.radius + 1.5; v.moveTo(gun.pos.x + Math.sin(a) * r, gun.pos.z + Math.cos(a) * r); }
        return;
      }
    }
    if (!(v.limberT > 0)) return;
    // Fahrbefehl während des Protzens bricht ab
    if (v.order && v.order.type !== 'attack') { v.limberT = 0; v._limb = null; v.hitchGoal = null; if (v.towing) v.towing.limberT = 0; return; }
    v.working = g.time;
    v.limberT -= step;
    const gun = v.hitchGoal || v.towing;
    if (gun) { gun.limberT = Math.max(0, v.limberT); gun.working = g.time; }
    if (v.limberT > 0) return;
    v.limberT = 0;
    if (v._limb === 'on' && v.hitchGoal) {
      const gun2 = v.hitchGoal;
      v.hitchGoal = null; v._limb = null;
      v.towing = gun2; gun2.towedBy = v; gun2.limberT = 0;
      gun2.stop(); gun2.queue = null;
      for (const w of gun2.weapons) w.target = null;
      // Geschütz hängt hinter dem Fahrzeug (Holm am Kupplungspunkt)
      const L = v.radius + gun2.radius * 1.05;
      gun2.pos.x = v.pos.x - Math.sin(v.heading) * L; gun2.pos.z = v.pos.z - Math.cos(v.heading) * L;
      gun2.heading = v.heading + Math.PI; gun2.place(0);
      this.stats.hitched++;
      g.emit('hitched', v, gun2);
      if (g.isOwn(v)) g.alert(`${gun2.name} aufgeprotzt`, 1.8);
    } else if (v._limb === 'off') {
      const gun2 = v.towing;
      this._unlink(v);
      if (gun2) {
        // Geschütz zeigt nach dem Abprotzen vom Fahrzeug weg (Feuerrichtung)
        gun2.heading = Math.atan2(gun2.pos.x - v.pos.x, gun2.pos.z - v.pos.z);
        gun2.place(0);
        this.stats.unhitched++;
        g.emit('unhitched', v, gun2);
        if (g.isOwn(v)) g.alert(`${gun2.name} abgeprotzt – feuerbereit`, 1.8);
      }
    }
  }
  // Anhänger-Kinematik: Geschütz hängt mit Abstand am Kupplungspunkt hinter dem Fahrzeug
  _dragGun(v, dt) {
    const gun = v.towing;
    if (!gun || !gun.alive) { v.towing = null; return; }
    const hx = v.pos.x - Math.sin(v.heading) * v.radius * 1.0, hz = v.pos.z - Math.cos(v.heading) * v.radius * 1.0;
    let dx = hx - gun.pos.x, dz = hz - gun.pos.z;
    const l = Math.hypot(dx, dz) || 1;
    dx /= l; dz /= l;
    const L = gun.radius * 1.05;
    gun.pos.x = hx - dx * L; gun.pos.z = hz - dz * L;
    gun.heading = Math.atan2(-dx, -dz); // Mündung zeigt nach hinten
    gun.order = null; gun.path = null; gun.moving = v.moving;
    gun.place(0);
  }
  _aiUnload() {
    const g = this.g;
    for (const v of g.units) {
      if (!v.alive || !v.cargo?.length || v.unloadAt || v.side === 'N') continue;
      if (!(v.ai || g.isAIOwned(v))) continue;
      const R2 = TR.aiUnloadR * TR.aiUnloadR;
      let hit = false;
      for (const e of g.units) {
        if (!e.alive || e.side === v.side || e.side === 'N' || e.type.structure || e.type.air || !e.visibleTo(v.side)) continue;
        if (d2(e.pos.x, e.pos.z, v.pos.x, v.pos.z) < R2) { hit = true; break; }
      }
      if (!hit && !(v.hp < v.maxHp * 0.4)) continue;
      this.stats.aiUnloads++;
      if (v.type.air && v.curAlt > 1.2) { v.unloadAt = { x: v.pos.x, z: v.pos.z }; v.stop(); this.land(v); }
      else { v.stop(); this.unloadAll(v); }
    }
  }

  // ---------------- Netz (Host → Client) ----------------
  netCargo(v) { return v.cargo?.length ? v.cargo.map((u) => u.type.key) : null; }
}
