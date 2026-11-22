// Einheiten: Bewegung, Zielerfassung, Feuern, KI, Zerstörung
import * as THREE from 'three';
import { UNIT_TYPES } from './unitTypes.js';
import { buildModel, house as houseModel, rubble, wreckify } from './models.js';
import { angleDiff, clamp, rand } from '../engine/util.js';

let NEXT_ID = 1;
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4(), _up = new THREE.Vector3(0, 1, 0), _n = new THREE.Vector3();

export class Unit {
  constructor(game, typeKey, side, x, z, opts = {}) {
    const type = UNIT_TYPES[typeKey];
    if (!type) throw new Error('Unbekannter Einheitentyp ' + typeKey);
    this.game = game;
    this.id = NEXT_ID++;
    this.type = type;
    this.side = side;
    this.name = opts.name || type.name;
    this.maxHp = Math.round(type.hp * (opts.hpMul || 1));
    this.hp = this.maxHp;
    this.radius = opts.radius || type.radius;
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = opts.heading ?? (side === 'UA' ? Math.PI : 0);
    this.alt = type.alt || 0;
    this.curAlt = type.air ? (opts.startAlt ?? this.alt) : 0;
    this.speed = (type.speed || 0) * (opts.speedMul || 1);
    this.alive = true;
    this.tags = new Set(opts.tags || []);
    this.ai = opts.ai || null;
    this.order = null;
    this.path = null;
    this.repathT = 0;
    this.holdFire = false;
    this.lifetime = type.lifetime || 0;
    this.seenByPlayer = side === 'UA';
    this.seenByEnemy = false;
    this.lastHit = -99;
    this.kills = 0;
    this.moving = false;
    this.animT = Math.random() * 10;
    this.turretYaw = 0;
    this.barrelPitch = 0;
    this.weapons = type.weaponDefs.map((w) => ({ def: w, cd: rand(0, w.reload || 1), ammo: w.ammo ?? Infinity, reloadT: 0, target: null, acqT: rand(0, 0.4) }));
    this.invulnerable = !!opts.invulnerable;
    this.noCapture = !!opts.noCapture;

    // Modell
    if (typeKey === 'house') {
      this.houseDef = opts.house;
      const h = houseModel(opts.house);
      this.model = { root: h.root, height: h.height };
      this.radius = Math.max(opts.house.w, opts.house.d) / 2;
      this.heading = opts.house.rot;
    } else {
      this.model = buildModel(type, side, game.terrain.season, game.settings?.quality);
    }
    this.root = this.model.root;
    this.root.userData.unit = this;
    this.root.traverse((o) => { o.userData.unit = this; });
    game.scene.add(this.root);
    this.place(0);
    if (type.structure) {
      this.root.matrixAutoUpdate = false;
      this.root.updateMatrix();
    }
  }

  get isAir() { return this.type.air; }
  get armor() { return this.type.armor; }
  get primary() { return this.weapons[0]; }

  // ---------------- Position ----------------
  place(dt) {
    const t = this.game.terrain;
    const p = this.pos;
    if (this.type.air) {
      const ground = t.surface(p.x, p.z);
      p.y = ground + this.curAlt + Math.sin(this.animT * 2) * 0.3;
      this.root.position.copy(p);
      this.root.rotation.set(0, this.heading, 0);
      if (this.bank) this.root.rotateZ(this.bank);
      if (this.diving) this.root.rotateX(0.5);
      return;
    }
    if (this.type.naval) {
      p.y = t.seaLevel;
      this.root.position.set(p.x, p.y + Math.sin(this.animT * 1.5) * 0.08, p.z);
      this.root.rotation.set(Math.sin(this.animT * 1.1) * 0.03 - (this.moving ? 0.06 : 0), this.heading, Math.sin(this.animT * 0.9) * 0.04);
      return;
    }
    p.y = t.height(p.x, p.z);
    this.root.position.copy(p);
    if (this.type.vehicle && !this.type.structure) {
      // Neigung an Gelände anpassen
      t.normal(p.x, p.z, _n);
      _q.setFromUnitVectors(_up, _n);
      _q2.setFromAxisAngle(_up, this.heading);
      const target = _q.multiply(_q2);
      if (dt > 0) this.root.quaternion.slerp(target, Math.min(1, dt * 6)); else this.root.quaternion.copy(target);
    } else {
      this.root.rotation.set(0, this.heading, 0);
    }
  }

  muzzleWorld(out = new THREE.Vector3()) {
    if (this.model.muzzle) { this.root.updateMatrixWorld(true); return this.model.muzzle.getWorldPosition(out); }
    return out.copy(this.pos).setY(this.pos.y + (this.model.height || 2) * 0.6);
  }
  aimPoint(out = new THREE.Vector3()) {
    return out.set(this.pos.x, this.pos.y + (this.type.air ? 0 : Math.min(this.model.height || 2, 6) * 0.5), this.pos.z);
  }
  distTo(u) { return Math.hypot(u.pos.x - this.pos.x, u.pos.z - this.pos.z); }
  edgeDist(u) { return Math.max(0, this.distTo(u) - (u.radius || 0) * 0.8); }

  // ---------------- Befehle ----------------
  moveTo(x, z, { attackMove = false, queue = false } = {}) {
    if (this.type.structure || !this.speed) return;
    this.order = { type: attackMove ? 'attackMove' : 'move', x, z };
    this.computePath(x, z);
    if (!attackMove) this.weapons.forEach((w) => { if (this.side === 'UA') w.target = w.target; });
  }
  attack(target) {
    if (!target || !target.alive) return;
    this.order = { type: 'attack', target };
    this.path = null; this.repathT = 0;
    this.weapons.forEach((w) => { if (this.canWeaponTarget(w.def, target)) w.target = target; });
  }
  bestWeaponFor(t) {
    let best = null, bv = 0.05;
    for (const w of this.weapons) {
      if (!this.canWeaponTarget(w.def, t)) continue;
      const v = w.def.vs[t.armor] || 0;
      if (v > bv) { bv = v; best = w; }
    }
    return best;
  }
  stop() { this.order = null; this.path = null; this.moving = false; }
  computePath(x, z) {
    if (this.type.air) { this.path = [[x, z]]; return; }
    const mode = this.type.naval ? 'water' : 'ground';
    this.path = this.game.pathfinder.find(this.pos.x, this.pos.z, x, z, mode, this.type.vehicle);
  }

  // ---------------- Kampf ----------------
  canWeaponTarget(w, u) {
    if (!u || !u.alive || u.side === this.side || u.type.neutral && !this.order?.target) return false;
    if (u.invulnerable) return false;
    if (u.type.air) { if (!w.canAir) return false; }
    else if (w.airOnly) return false;
    if ((w.vs[u.armor] || 0) <= 0.01) return false;
    if (w.requiresRadar && !this.game.hasRadar(this.side, w.requiresRadar)) return false;
    return true;
  }
  isSpotted(u) {
    if (u.type.structure && u.side !== 'N') return this.side === 'UA' ? this.game.fow.isExplored(u.pos.x, u.pos.z) || u.seenByPlayer : true;
    if (u.side === 'N') return true;
    return this.side === 'UA' ? u.seenByPlayer : u.seenByEnemy;
  }
  inRange(w, u) {
    const d = u.type.air ? Math.hypot(this.distTo(u), (u.pos.y - this.pos.y) * 0.5) : this.edgeDist(u);
    if (w.minRange && d < w.minRange) return false;
    return d <= w.range;
  }
  pickTarget(ws) {
    const w = ws.def;
    const game = this.game;
    // Explizites Ziel?
    const ot = this.order?.type === 'attack' ? this.order.target : null;
    if (ot && this.canWeaponTarget(w, ot) && this.isSpotted(ot) && this.inRange(w, ot)) return ot;
    if (this.holdFire && this.side === 'UA') return null;
    let best = null, bestScore = -Infinity;
    const list = game.units;
    const rangeLimit = w.range + 6;
    for (let i = 0; i < list.length; i++) {
      const u = list[i];
      if (u.side === this.side || u.side === 'N' || !u.alive) continue;
      if (Math.abs(u.pos.x - this.pos.x) > rangeLimit + 15 || Math.abs(u.pos.z - this.pos.z) > rangeLimit + 15) continue;
      if (!this.canWeaponTarget(w, u) || !this.isSpotted(u) || !this.inRange(w, u)) continue;
      const eff = w.vs[u.armor] || 0;
      let score = eff * 10 - this.distTo(u) * 0.08;
      if (w.prefer && w.prefer.includes(u.armor)) score += 6;
      if (u.type.kamikaze) score += 4; // Drohnen zuerst
      if (u.type.structure) score -= 8;
      if (w.kind === 'atgm' && u.armor === 'soft') score -= 10;
      if (score > bestScore) { bestScore = score; best = u; }
    }
    return best;
  }
  pickThreat(ws) {
    const w = ws.def;
    if (!w.intercept) return null;
    if (w.requiresRadar && !this.game.hasRadar(this.side, w.requiresRadar)) return null;
    let best = null, bd = Infinity;
    for (const m of this.game.missiles) {
      if (!m.threat || m.side === this.side || m.dead || !w.intercept[m.threat]) continue;
      const maxEng = m.threat === 'hypersonic' ? 3 : 2;
      if (m.engaged >= maxEng) continue;
      const d = this.pos.distanceTo(m.pos);
      if (d > w.range * 1.05) continue;
      const pr = m.threat === 'hypersonic' ? 0 : m.threat === 'cruise' ? 30 : 60;
      if (d + pr < bd) { bd = d + pr; best = m; }
    }
    return best;
  }

  // ---------------- Update ----------------
  update(dt) {
    if (!this.alive) return;
    this.animT += dt;
    const type = this.type;
    if (this.lifetime) {
      this.lifetime -= dt;
      if (this.lifetime <= 0) { this.game.killUnit(this, null, true); return; }
    }
    if (this.jammed) { this.jammed -= dt; if (this.jammed <= 0) { this.game.killUnit(this, null, true); return; } }

    if (!type.structure) {
      if (this.ai) this.updateAI(dt);
      this.updateMovement(dt);
    }
    this.updateWeapons(dt);
    this.animate(dt);
    if (!type.structure) this.place(dt);
  }

  updateMovement(dt) {
    const type = this.type;
    const game = this.game;
    this.moving = false;
    let tx = null, tz = null;
    const o = this.order;
    if (o) {
      if (o.type === 'attack') {
        const t = o.target;
        if (!t || !t.alive) { this.order = null; this.path = null; }
        else {
          const usable = this.bestWeaponFor(t);
          if (type.kamikaze && type.air) {
            tx = t.pos.x; tz = t.pos.z;
            this.path = null;
          } else if (type.kamikaze) {
            if (this.edgeDist(t) <= this.primary.def.range + 1.5) { this.detonate(t); return; }
            this.repathT -= dt;
            if (!this.path || !this.path.length || this.repathT <= 0) { this.computePath(t.pos.x, t.pos.z); this.repathT = 1.5; }
            if (this.path && this.path.length === 1 && this.distTo(t) < 25) { tx = t.pos.x; tz = t.pos.z; }
          } else if (!usable) { this.order = null; }
          else if (this.inRange(usable.def, t) && this.isSpotted(t)) { this.path = null; }
          else {
            this.repathT -= dt;
            if (!this.path || this.repathT <= 0) { this.computePath(t.pos.x, t.pos.z); this.repathT = 1.5; }
          }
        }
      } else if (o.type === 'attackMove') {
        // Bei Feindkontakt anhalten und kämpfen
        if (this.weapons.some((w) => w.target && w.target.alive && !w.def.airOnly && !w.target.type.air)) { /* stehen bleiben */ }
        else if (!this.path || !this.path.length) this.order = null;
      } else if (o.type === 'move') {
        if (!this.path || !this.path.length) this.order = null;
      }
    }
    // Kamikaze-Drohnen ohne Auftrag: automatisch angreifen
    if (type.kamikaze && (!this.order || this.order.type !== 'attack')) {
      const tgt = this.findKamikazeTarget();
      if (tgt && (!this.order || this.order.type === 'attackMove' || this.side !== 'UA' || !this.path?.length)) this.attack(tgt);
    }

    const holdForAttack = this.order?.type === 'attackMove' && this.weapons.some((w) => w.target && w.target.alive && !w.target.type.air && !w.def.airOnly);
    if (tx === null && this.path && this.path.length && !holdForAttack) { [tx, tz] = this.path[0]; }
    if (tx === null) {
      if (type.air) { // Schweben / Kreisen
        if (!type.kamikaze && type.key !== 'recon' && type.key !== 'ka52') { this.heading += dt * 0.5; this.stepForward(dt, 0.6); }
        this.curAlt += (this.alt - this.curAlt) * Math.min(1, dt);
        this.diving = false;
      }
      return;
    }
    const dx = tx - this.pos.x, dz = tz - this.pos.z;
    const d = Math.hypot(dx, dz);
    const arrive = type.air ? 2 : type.vehicle ? 2.5 : 1.2;
    if (d < arrive && !(type.kamikaze && this.order?.type === 'attack')) {
      if (this.path) this.path.shift();
      return;
    }
    const desired = Math.atan2(dx, dz);
    const diff = angleDiff(this.heading, desired);
    const turn = (type.turnRate || 8) * dt;
    this.heading += clamp(diff, -turn, turn);
    let spd = this.speed;
    if (!type.air && !type.naval) {
      if (game.terrain.onRoad(this.pos.x, this.pos.z)) spd *= 1.2;
      else if (game.terrain.inForest(this.pos.x, this.pos.z)) spd *= type.vehicle ? 0.55 : 0.85;
      if (type.vehicle && Math.abs(diff) > 0.9) spd *= 0.15;
    }
    if (type.naval && Math.abs(diff) > 1.2) spd *= 0.3;
    if (this.hp < this.maxHp * 0.3 && type.vehicle) spd *= 0.6;
    // Kamikaze-Anflug
    if (type.air) {
      let targetAlt = this.alt;
      if (type.kamikaze && this.order?.type === 'attack') {
        const t = this.order.target;
        const hd = this.distTo(t);
        const tAlt = t.type.air ? t.curAlt : (t.model.height || 2) * 0.5;
        if (hd < 30) targetAlt = tAlt + (this.alt - tAlt) * (hd / 30);
        this.diving = hd < 30;
        if (this.edgeDist(t) <= this.primary.def.range + 1.5 && Math.abs(this.curAlt - tAlt) < 4) { this.detonate(t); return; }
      }
      this.curAlt += (targetAlt - this.curAlt) * Math.min(1, dt * 2);
      this.bank = clamp(-diff, -0.5, 0.5);
    }
    this.stepForward(dt, spd / this.speed);
    if (type.naval && Math.random() < 0.5) { const b = _v.set(Math.sin(this.heading), 0, Math.cos(this.heading)); game.effects.trail(this.pos.x - b.x * 3, this.pos.y, this.pos.z - b.z * 3, 'wake'); }
    if (type.kamikaze && type.air && Math.random() < dt * 2) game.audio.drone(this.pos.x, this.pos.z);
  }
  stepForward(dt, mul = 1) {
    const s = this.speed * mul * dt;
    const nx = this.pos.x + Math.sin(this.heading) * s, nz = this.pos.z + Math.cos(this.heading) * s;
    const t = this.game.terrain;
    if (!this.type.air) {
      const k = t.cellIndex(nx, nz);
      if (k < 0) return;
      const pf = this.game.pathfinder;
      const ok = pf.passable(k, this.type.naval ? 'water' : 'ground');
      if (!ok) {
        // Gleiten an Hindernis
        const kx = t.cellIndex(nx, this.pos.z), kz = t.cellIndex(this.pos.x, nz);
        if (kx >= 0 && pf.passable(kx, this.type.naval ? 'water' : 'ground')) this.pos.x = nx;
        else if (kz >= 0 && pf.passable(kz, this.type.naval ? 'water' : 'ground')) this.pos.z = nz;
        else if (this.path) { this.repathT = 0; if (this.order && this.order.type !== 'attack') this.computePath(this.order.x, this.order.z); }
        this.moving = true;
        return;
      }
    } else if (!t.inBounds(nx, nz, -30)) return;
    this.pos.x = nx; this.pos.z = nz;
    this.moving = true;
  }

  findKamikazeTarget() {
    let best = null, bs = -Infinity;
    const range = this.type.sight + (this.ai?.huntRadius || 0);
    const w = this.primary.def;
    for (const u of this.game.units) {
      if (u.side === this.side || u.side === 'N' || !u.alive || u.type.air) continue;
      if (!this.canWeaponTarget(w, u) || !this.isSpotted(u)) continue;
      if (this.ai?.targetTag && !u.tags.has(this.ai.targetTag)) continue;
      const d = this.distTo(u);
      if (d > range) continue;
      const eff = w.vs[u.armor] || 0;
      const s = eff * 30 - d + (w.prefer?.includes(u.armor) ? 15 : 0);
      if (s > bs) { bs = s; best = u; }
    }
    return best;
  }
  detonate(target) {
    const w = this.primary.def;
    const game = this.game;
    const p = this.pos.clone();
    if (target && target.alive) game.applyDamage(target, w.dmg, w, this, { topAttack: !!w.topAttack });
    game.splashDamage(p.x, p.z, w.splash || 3, w.dmg * 0.35, w, this.side, target);
    const water = this.type.naval;
    game.effects.explosion(p.x, water ? game.terrain.seaLevel : Math.max(p.y - 1, game.terrain.surface(p.x, p.z)), p.z, water ? 2.5 : this.type.key === 'shahed' ? 2.2 : 1.2, { water });
    if (water) game.effects.explosion(p.x, game.terrain.seaLevel + 1, p.z, 1.6, { crater: false, sound: false });
    this.alive = false;
    this.detonated = true;
    game.removeUnit(this);
  }

  updateWeapons(dt) {
    if (this.type.kamikaze) return;
    const game = this.game;
    let aimTarget = null, aimPoint = null;
    for (const ws of this.weapons) {
      const w = ws.def;
      ws.cd -= dt;
      if (ws.ammo <= 0) { ws.reloadT -= dt; if (ws.reloadT <= 0) ws.ammo = w.ammo; continue; }
      ws.acqT -= dt;
      if (ws.acqT <= 0) {
        ws.acqT = w.intercept ? 0.12 : 0.35 + Math.random() * 0.2;
        ws.threat = this.pickThreat(ws);
        if (!w.threatsOnly || !ws.threat) {
          if (!ws.target || !ws.target.alive || !this.canWeaponTarget(w, ws.target) || !this.inRange(w, ws.target) || !this.isSpotted(ws.target) || (this.order?.type === 'attack' && this.order.target !== ws.target && this.canWeaponTarget(w, this.order.target))) ws.target = this.pickTarget(ws);
          if (w.threatsOnly) ws.target = null;
        }
      }
      const threat = ws.threat && !ws.threat.dead && this.pos.distanceTo(ws.threat.pos) < w.range * 1.1 ? ws.threat : null;
      const target = threat ? null : ws.target && ws.target.alive ? ws.target : null;
      if (!threat && !target) continue;
      const tp = threat ? threat.pos : target.pos;
      if (!aimTarget) { aimTarget = threat || target; aimPoint = tp; }
      if (ws.cd > 0) continue;
      if (this.holdFire && this.side === 'UA' && !(this.order?.type === 'attack') && !(threat && threat.threat === 'hypersonic')) continue;
      // Ausrichtung prüfen
      const desired = Math.atan2(tp.x - this.pos.x, tp.z - this.pos.z);
      if (this.model.turret) {
        const cur = this.heading + this.turretYaw;
        const tol = w.kind === 'bullet' ? 0.35 : w.kind === 'sam' || w.indirect ? 0.8 : 0.12;
        if (Math.abs(angleDiff(cur, desired)) > tol) continue;
      } else if (this.type.infantry && !this.moving) {
        this.heading = desired;
      } else if (this.type.infantry && this.moving && w.kind !== 'bullet') continue;
      if (w.indirect && this.moving) continue;
      ws.cd = w.reload * rand(0.9, 1.1);
      if (w.ammo) { ws.ammo--; if (ws.ammo <= 0) ws.reloadT = w.reloadAmmo; }
      game.combat.fire(this, ws, target, threat);
    }
    // Turm drehen
    if (this.model.turret) {
      const rate = (this.type.turretRate || 1.5) * dt;
      let desiredRel = 0;
      if (aimPoint) desiredRel = angleDiff(this.heading, Math.atan2(aimPoint.x - this.pos.x, aimPoint.z - this.pos.z));
      const diff = angleDiff(this.turretYaw, desiredRel);
      this.turretYaw += clamp(diff, -rate, rate);
      this.model.turret.rotation.y = this.turretYaw;
      if (this.model.barrel && aimPoint && (this.type.key === 'gepard' || this.type.key === 'pantsir' || this.type.key === 'pickup' || this.type.key === 'boat')) {
        const dh = Math.hypot(aimPoint.x - this.pos.x, aimPoint.z - this.pos.z);
        const pitch = -Math.atan2(aimPoint.y - this.pos.y - 2, dh);
        this.model.barrel.rotation.x += (clamp(pitch, -1.2, 0.1) - this.model.barrel.rotation.x) * Math.min(1, dt * 4);
      }
    }
    this.aiming = aimTarget;
  }

  animate(dt) {
    const m = this.model;
    if (m.rotors) for (const r of m.rotors) r.rotation.y += dt * 40;
    if (m.radar) m.radar.rotation.y += dt * (this.type.key === 'gepard' ? 3 : 0.8);
    if (m.radar2) m.radar2.rotation.y -= dt * 2;
    if (m.legs && m.body) {
      if (this.moving) {
        const s = Math.sin(this.animT * 9);
        m.legs[0].rotation.x = s * 0.6; m.legs[1].rotation.x = -s * 0.6;
        m.body.position.y = Math.abs(s) * 0.06;
      } else { m.legs[0].rotation.x *= 0.8; m.legs[1].rotation.x *= 0.8; }
    }
  }

  // ---------------- KI (Gegner) ----------------
  updateAI(dt) {
    const ai = this.ai;
    ai.t = (ai.t || 0) - dt;
    if (ai.t > 0) return;
    ai.t = 0.6 + Math.random() * 0.4;
    const game = this.game;
    if (ai.mode === 'attackMove' || ai.mode === 'convoy' || ai.mode === 'patrol') {
      ai.i = ai.i || 0;
      const pts = ai.points;
      if (!pts || !pts.length) { ai.mode = 'guard'; return; }
      const [px, pz] = pts[Math.min(ai.i, pts.length - 1)];
      const d = Math.hypot(px - this.pos.x, pz - this.pos.z);
      if (d < (this.type.air ? 8 : 6)) {
        ai.i++;
        if (ai.i >= pts.length) {
          if (ai.mode === 'patrol') ai.i = 0;
          else { ai.mode = ai.after || 'guard'; ai.home = [this.pos.x, this.pos.z]; this.stop(); if (ai.onArrive) ai.onArrive(this); return; }
        }
        const [nx, nz] = pts[ai.i % pts.length];
        this.moveTo(nx, nz, { attackMove: ai.mode !== 'convoy' });
      } else if (!this.order || (this.order.type !== 'attack' && (!this.path || !this.path.length))) {
        this.moveTo(px, pz, { attackMove: ai.mode !== 'convoy' });
      }
      // Bei Angriffsbewegung: sichtbare Feinde in der Nähe angreifen
      if (ai.mode === 'attackMove' && !this.type.kamikaze && ai.aggressive) this.aiEngageNearby(ai.aggroRadius || 30);
    } else if (ai.mode === 'guard') {
      if (!ai.home) ai.home = [this.pos.x, this.pos.z];
      const r = ai.radius || 35;
      const hd = Math.hypot(ai.home[0] - this.pos.x, ai.home[1] - this.pos.z);
      if (hd > r * 1.6) { this.moveTo(ai.home[0], ai.home[1]); return; }
      if (!this.order) this.aiEngageNearby(r);
    } else if (ai.mode === 'hunt') {
      if (!this.order || this.order.type !== 'attack') {
        const tgt = this.findKamikazeTarget();
        if (tgt) this.attack(tgt);
        else if (ai.points) { this.ai.mode = 'patrol'; }
      }
    } else if (ai.mode === 'loiter') {
      const [cx, cz] = ai.center;
      const a = (game.time * 0.15 + this.id) % (Math.PI * 2);
      const r = ai.radius || 40;
      this.moveTo(cx + Math.cos(a) * r, cz + Math.sin(a) * r);
    }
  }
  aiEngageNearby(r) {
    if (this.order?.type === 'attack' && this.order.target.alive) return;
    let best = null, bd = r;
    for (const u of this.game.units) {
      if (u.side === this.side || u.side === 'N' || !u.alive || !this.isSpotted(u)) continue;
      if (u.type.air && !this.weapons.some((w) => w.def.canAir)) continue;
      if (!this.weapons.some((w) => this.canWeaponTarget(w.def, u))) continue;
      const d = this.distTo(u);
      if (d < bd) { bd = d; best = u; }
    }
    if (best) {
      const w = this.weapons.find((w) => this.canWeaponTarget(w.def, best));
      if (w && !this.inRange(w.def, best)) this.attack(best);
    }
  }

  // ---------------- Tod ----------------
  die(killer, silent = false) {
    this.alive = false;
    const game = this.game;
    const fx = game.effects;
    const p = this.pos;
    const type = this.type;
    if (this.ring) this.ring.visible = false;
    if (type.infantry) {
      const body = this.model.body;
      game.animations.push({ t: 0, dur: 0.5, fn: (k) => { body.rotation.x = -Math.PI / 2 * k; body.position.y = 0.3 * k; } });
      game.later(30, () => game.scene.remove(this.root));
      return;
    }
    if (type.air) {
      if (silent && this.jammed !== undefined) { /* gestört – stürzt ab */ }
      const v = { vy: 0, spin: rand(3, 8) };
      const root = this.root;
      const t = game.terrain;
      const big = type.key === 'ka52';
      game.animations.push({
        t: 0, dur: 8, fn: (k, dt) => {
          if (root.userData.crashed) return;
          v.vy -= 20 * dt;
          root.position.y += v.vy * dt;
          root.position.x += Math.sin(this.heading) * this.speed * 0.5 * dt;
          root.position.z += Math.cos(this.heading) * this.speed * 0.5 * dt;
          root.rotation.y += v.spin * dt; root.rotation.z += dt * 2;
          if (Math.random() < 0.5) fx.trail(root.position.x, root.position.y, root.position.z, 'missile');
          const g = t.surface(root.position.x, root.position.z);
          if (root.position.y <= g + 0.3) {
            root.userData.crashed = true;
            fx.explosion(root.position.x, g, root.position.z, big ? 2 : 0.6, { water: t.isWater(root.position.x, root.position.z) });
            game.scene.remove(root);
            if (big) { const w = new THREE.Object3D(); w.position.set(root.position.x, g, root.position.z); fx.addEmitter(w, 0.5, 40, 1.2); }
          }
        },
      });
      if (!silent) fx.explosion(p.x, p.y, p.z, big ? 1.2 : 0.5, { crater: false, air: true });
      return;
    }
    if (type.naval) {
      fx.explosion(p.x, p.y + 1, p.z, type.key === 'boat' ? 2 : 1, { crater: false });
      const root = this.root;
      game.animations.push({ t: 0, dur: 6, fn: (k) => { root.position.y = p.y - k * 6; root.rotation.x = k * 0.6; if (k >= 1) game.scene.remove(root); } });
      if (type.key === 'boat') fx.addEmitter(root, 3, 8, 1.5);
      return;
    }
    if (type.bridge) {
      fx.explosion(p.x, p.y + 2, p.z, 3.5, { crater: false });
      for (let i = -1; i <= 1; i++) game.later(0.3 + Math.abs(i) * 0.25, () => fx.explosion(p.x + i * 10, p.y, p.z + rand(-3, 3), 2.5, { crater: false }));
      const root = this.root;
      root.matrixAutoUpdate = true;
      const y0 = root.position.y, sea = game.terrain.seaLevel;
      game.animations.push({
        t: 0, dur: 3, fn: (k) => {
          root.position.y = y0 - (y0 - sea + 3) * k * k;
          root.rotation.z = 0.25 * k; root.rotation.x = 0.08 * k;
          if (k >= 1 && !root.userData.splashed) { root.userData.splashed = true; fx.explosion(p.x, sea, p.z, 3, { water: true, sound: false }); }
        },
      });
      fx.addEmitter(new THREE.Object3D().translateX(p.x).translateY(y0).translateZ(p.z), 0, 40, 2);
      return;
    }
    if (type.key === 'house') {
      fx.explosion(p.x, p.y + 2, p.z, 1.6);
      game.scene.remove(this.root);
      const r = rubble(this.houseDef.w, this.houseDef.d);
      r.position.copy(p); r.rotation.y = this.heading;
      game.scene.add(r);
      fx.addEmitter(r, 1, 20, 1);
      return;
    }
    // Fahrzeuge & Gebäude
    const size = type.structure ? 2.2 : type.armor === 'heavy' ? 1.8 : 1.3;
    fx.explosion(p.x, p.y + 1.5, p.z, size);
    if (type.secondary) {
      for (let i = 0; i < 8; i++) game.later(0.3 + i * 0.35, () => fx.explosion(p.x + rand(-6, 6), p.y + rand(0, 3), p.z + rand(-6, 6), rand(0.8, 2.2)));
    }
    wreckify(this.root);
    this.root.matrixAutoUpdate = true;
    if (this.model.turret && type.armor === 'heavy' && Math.random() < 0.6) {
      // Turm fliegt weg ("Jack-in-the-box")
      const tur = this.model.turret;
      const vy = { v: rand(12, 18) }, spin = rand(-4, 4);
      game.animations.push({ t: 0, dur: 2.5, fn: (k, dt) => { vy.v -= 18 * dt; tur.position.y = Math.max(0.5, tur.position.y + vy.v * dt); tur.rotation.x += spin * dt; tur.rotation.z += spin * 0.5 * dt; } });
    }
    fx.addEmitter(this.root, type.structure ? 2 : 1.5, type.structure ? 60 : 35, type.structure ? 1.8 : 1.1);
  }
}
