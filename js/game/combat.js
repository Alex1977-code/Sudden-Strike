// Schüsse, Lenkflugkörper, Abfangjäger, Artillerie, Hyperschall- und Marschflugkörper
import * as THREE from 'three';
import { projectileModel } from './models.js';
import { rand } from '../engine/util.js';

const _a = new THREE.Vector3(), _b = new THREE.Vector3();

export class Missile {
  // mode: 'arc' (Bezier), 'straight', 'cruise' (Geländefolgeflug), 'homing'
  constructor(game, o) {
    this.game = game;
    Object.assign(this, { speed: 60, arc: 0, mode: 'arc', side: 'UA', threat: null, engaged: 0, trail: 'missile', model: 'atgm', scale: 1 }, o);
    this.pos = o.from.clone();
    this.start = o.from.clone();
    this.end = o.target ? o.target.aimPoint() : o.to.clone();
    this.u = 0;
    this.dead = false;
    this.age = 0;
    this.mesh = projectileModel(this.model).root;
    this.mesh.scale.setScalar(this.scale);
    this.mesh.position.copy(this.pos);
    game.scene.add(this.mesh);
    this.len = Math.max(1, this.start.distanceTo(this.end) + this.arc);
    this.prev = this.pos.clone();
  }
  bezier(u, out) {
    const s = this.start, e = this.end;
    _a.set((s.x + e.x) / 2, Math.max(s.y, e.y) + this.arc, (s.z + e.z) / 2);
    const i = 1 - u;
    return out.set(i * i * s.x + 2 * i * u * _a.x + u * u * e.x, i * i * s.y + 2 * i * u * _a.y + u * u * e.y, i * i * s.z + 2 * i * u * _a.z + u * u * e.z);
  }
  update(dt) {
    if (this.dead) return;
    this.age += dt;
    const game = this.game;
    this.prev.copy(this.pos);
    if (this.target && this.target.alive !== false) {
      if (this.target.pos) this.target.aimPoint ? this.target.aimPoint(this.end) : this.end.copy(this.target.pos);
    }
    if (this.targetMissile) {
      if (this.targetMissile.dead) { this.selfDestruct(); return; }
      this.end.copy(this.targetMissile.pos);
    }
    let arrived = false;
    if (this.mode === 'arc') {
      this.u += (this.speed * dt) / this.len;
      if (this.u >= 1) { this.u = 1; arrived = true; }
      this.bezier(this.u, this.pos);
    } else if (this.mode === 'cruise') {
      const dx = this.end.x - this.pos.x, dz = this.end.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      const step = this.speed * dt;
      if (d <= step + 1) { arrived = true; this.pos.copy(this.end); }
      else {
        this.pos.x += (dx / d) * step; this.pos.z += (dz / d) * step;
        const ground = game.terrain.surface(this.pos.x, this.pos.z);
        const cruiseAlt = ground + (this.cruiseAlt || 10);
        const ty = d < 30 ? this.end.y + (cruiseAlt - this.end.y) * (d / 30) : cruiseAlt;
        this.pos.y += (ty - this.pos.y) * Math.min(1, dt * 3);
      }
    } else { // straight / homing
      _b.subVectors(this.end, this.pos);
      const d = _b.length();
      const step = this.speed * dt;
      if (d <= step + 0.5) { arrived = true; this.pos.copy(this.end); }
      else this.pos.addScaledVector(_b.normalize(), step);
    }
    // Ausrichtung
    _b.subVectors(this.pos, this.prev);
    if (_b.lengthSq() > 1e-6) { this.mesh.position.copy(this.pos); this.mesh.lookAt(_a.copy(this.pos).add(_b)); }
    if (this.trail) {
      const n = this.trail === 'hypersonic' ? 4 : 1;
      for (let i = 0; i < n; i++) { const k = i / n; game.effects.trail(this.prev.x + (this.pos.x - this.prev.x) * k, this.prev.y + (this.pos.y - this.prev.y) * k, this.prev.z + (this.pos.z - this.prev.z) * k, this.trail); }
    }
    // Bodenkollision (z. B. Kinschal)
    if (!arrived && this.mode !== 'arc' && this.pos.y < game.terrain.surface(this.pos.x, this.pos.z) - 0.5) arrived = true;
    if (arrived) { this.dead = true; this.remove(); this.onHit && this.onHit(this); }
    if (this.age > 60) { this.dead = true; this.remove(); }
  }
  // Abgefangen
  intercepted() {
    if (this.dead) return;
    this.dead = true;
    this.remove();
    this.game.effects.explosion(this.pos.x, this.pos.y, this.pos.z, this.threat === 'hypersonic' ? 1.6 : 1, { crater: false, air: true });
    if (this.onIntercepted) this.onIntercepted(this);
  }
  selfDestruct() { if (this.dead) return; this.dead = true; this.remove(); this.game.effects.explosion(this.pos.x, this.pos.y, this.pos.z, 0.4, { crater: false, air: true, sound: false }); }
  remove() { this.game.scene.remove(this.mesh); }
}

export class Combat {
  constructor(game) { this.game = game; }

  hitChance(shooter, w, target) {
    let acc = w.acc;
    if (target.type.air) acc = w.airAcc ?? 0.1;
    const d = shooter.distTo(target);
    acc *= 1 - 0.35 * Math.min(1, d / w.range);
    if (target.moving) acc *= target.type.infantry ? 0.8 : 0.85;
    if (target.type.infantry && this.game.terrain.inForest(target.pos.x, target.pos.z)) acc *= 0.65;
    if (target.type.infantry && this.game.logi?.coverOf(target)) acc *= 0.8; // Deckung (Sandsäcke/Graben)
    if (shooter.moving) acc *= 0.7;
    if (shooter.hp < shooter.maxHp * 0.3) acc *= 0.85;
    if (this.game.tac) acc *= this.game.tac.accMul(shooter, target, w); // Niederhalten, Offizier, Veteranen, Besatzung
    return Math.min(0.97, acc);
  }

  fire(shooter, ws, target, threat) {
    const game = this.game, fx = game.effects, w = ws.def;
    const from = shooter.muzzleWorld();
    const tp = threat ? threat.pos.clone() : target.aimPoint();
    game.audio.shot(w.sound, shooter.pos.x, shooter.pos.z);
    shooter.lastFired = game.time;
    const sp = game.ownerPlayer(shooter);
    if (sp) sp.stats.shots++;

    const tac = game.tac;
    if (w.kind === 'grenade') { // Handgranate / Molotow / Unterlauf-Granatwerfer: Wurf bzw. Bogenschuss
      if (tac && target) tac.throwAt(shooter, w, target.pos.x, target.pos.z, target);
      return;
    }
    if (w.kind === 'bullet') {
      const n = w.burst || 1;
      if (!threat && tac) tac.onShot(shooter, w, target);
      if (!threat && w.sound === 'grenade') { this._lob(shooter, ws, target, from, tp); return; } // AGS/Granatmaschinenwaffe
      fx.muzzle(from.x, from.y, from.z, false);
      // Gegen Marschflugkörper/Drohnen mit Rohrwaffen
      if (threat) {
        for (let i = 0; i < Math.min(2, n); i++) fx.tracer(from, _a.copy(tp).add(new THREE.Vector3(rand(-2, 2), rand(-2, 2), rand(-2, 2))), w.tracer || 'y', 400);
        if (Math.random() < (w.intercept[threat.threat] || 0) * 0.35) threat.intercepted();
        return;
      }
      let hits = 0;
      const pc = this.hitChance(shooter, w, target);
      for (let i = 0; i < n; i++) if (Math.random() < pc) hits++;
      const tracers = Math.min(n, w.tracer ? 2 : 0);
      for (let i = 0; i < tracers; i++) {
        const miss = i >= hits;
        const end = tp.clone();
        if (miss) end.add(new THREE.Vector3(rand(-2, 2), rand(-0.5, 1.5), rand(-2, 2)));
        fx.tracer(from, end, w.tracer, 350);
      }
      if (hits > 0) {
        const delay = shooter.distTo(target) / 400;
        game.later(delay, () => {
          if (!target.alive) return;
          game.applyDamage(target, w.dmg * hits, w, shooter);
          if (w.splash) game.splashDamage(target.pos.x, target.pos.z, w.splash, w.dmg * 0.3, w, shooter.side, target, false, shooter.owner);
          if (!target.type.infantry && Math.random() < 0.5) fx.smallHit(tp.x, tp.y, tp.z);
        });
      }
      return;
    }

    if (w.kind === 'shell') {
      fx.muzzle(from.x, from.y, from.z, true);
      if (tac) tac.onShot(shooter, w, target);
      const hit = Math.random() < this.hitChance(shooter, w, target);
      const end = tp.clone();
      if (!hit) end.add(new THREE.Vector3(rand(-4, 4), 0, rand(-4, 4))).setY(game.terrain.surface(end.x, end.z));
      fx.tracer(from, end, 'y', 450);
      const delay = from.distanceTo(end) / 450;
      game.later(delay, () => {
        if (hit && target.alive) {
          game.applyDamage(target, w.dmg, w, shooter);
          fx.explosion(end.x, end.y, end.z, 0.5, { crater: false });
        } else fx.explosion(end.x, end.y, end.z, 0.6);
        if (w.splash) game.splashDamage(end.x, end.z, w.splash, w.dmg * 0.25, w, shooter.side, hit ? target : null, false, shooter.owner);
      });
      return;
    }

    if (w.kind === 'atgm') {
      const hit = Math.random() < this.hitChance(shooter, w, target);
      const d = shooter.distTo(target);
      new Missile(game, {
        from, target: hit ? target : null, to: hit ? null : tp.clone().add(new THREE.Vector3(rand(-5, 5), -tp.y + game.terrain.surface(tp.x, tp.z), rand(-5, 5))),
        speed: w.speed || 40, arc: w.topAttack ? Math.max(8, d * 0.45) : w.straight ? 1 : 3, side: shooter.side, model: 'atgm',
        onHit: (m) => {
          // Rauch zwischen Schütze und Ziel: Lenkung verliert das Ziel (65 %)
          const blind = hit && tac && target.alive && tac.lineSmoked(shooter.pos, target.pos) && Math.random() < 0.65;
          if (hit && !blind && target.alive) game.applyDamage(target, w.dmg, w, shooter, { topAttack: w.topAttack });
          fx.explosion(m.pos.x, m.pos.y, m.pos.z, 0.9, { crater: !hit || blind });
          if (w.splash) game.splashDamage(m.pos.x, m.pos.z, w.splash, w.dmg * 0.2, w, shooter.side, hit ? target : null, false, shooter.owner);
        },
      }).register();
      fx.muzzle(from.x, from.y, from.z, true);
      if (tac && target?.type.vehicle) tac.onAtgm(target, shooter); // Nebelwurfanlage des Ziels
      return;
    }

    if (w.kind === 'sam') {
      // Abfangrakete
      const m = new Missile(game, {
        from: from.clone().add(new THREE.Vector3(0, 1, 0)), mode: 'homing', speed: w.speed || 120, side: shooter.side, model: 'interceptor', scale: 1.2,
        target: threat ? null : target, targetMissile: threat || null, to: tp.clone(),
        onHit: (mm) => {
          if (threat) {
            threat.engaged = Math.max(0, threat.engaged - 1);
            if (!threat.dead && Math.random() < (w.intercept[threat.threat] || 0)) {
              threat.intercepted();
              const ip = game.ownerPlayer(shooter);
              if (ip) ip.stats.intercepts++;
              if (shooter.side === game.localSide && game.onIntercept) game.onIntercept(threat, shooter);
            } else fx.explosion(mm.pos.x, mm.pos.y, mm.pos.z, 0.4, { crater: false, air: true });
          } else if (target && target.alive) {
            const chance = target.type.kamikaze || target.type.key === 'orlan' ? (w.intercept?.drone ?? w.airAcc) : w.airAcc;
            if (Math.random() < chance) game.applyDamage(target, w.dmg, w, shooter);
            fx.explosion(mm.pos.x, mm.pos.y, mm.pos.z, 0.5, { crater: false, air: true });
          }
        },
      });
      if (threat) threat.engaged++;
      m.register();
      // Startrauch
      for (let i = 0; i < 8; i++) fx.smoke.emit(from.x, from.y, from.z, rand(-2, 2), rand(0, 2), rand(-2, 2), rand(2, 4), rand(1.5, 3), 0.8, 0.8, 0.8, 0.6, { grow: 1.5, drag: 1.5 });
      return;
    }

    if (w.kind === 'artillery') {
      fx.muzzle(from.x, from.y, from.z, true);
      const spread = w.spread || 8;
      const tx = tp.x + rand(-spread, spread), tz = tp.z + rand(-spread, spread);
      this.incomingShell(tx, tz, w, shooter.side, 3.5 + shooter.distTo(target) / 80, shooter, 1.4, shooter.owner);
      return;
    }

    if (w.kind === 'charge') {
      // Sprengladung anbringen
      const tgt = target;
      fx.marker(tgt.pos.x, tgt.pos.z, 0xff3030, 2.5, 3);
      fx.throwable(from, tgt.aimPoint(), 0.35, 2.5, 'charge'); // Ladung sichtbar angebracht
      game.later(2.5, () => {
        if (!shooter.alive && Math.random() < 0.5) return;
        const p = tgt.pos;
        if (tgt.alive) game.applyDamage(tgt, w.dmg, w, shooter);
        fx.explosion(p.x, p.y + 1, p.z, 1.6);
      });
      return;
    }
  }

  // Granatmaschinenwaffe (AGS, GMW): Granaten im flachen Bogen, Einschläge nach der Flugzeit
  _lob(shooter, ws, target, from, tp) {
    const game = this.game, fx = game.effects, w = ws.def, n = w.burst || 1;
    fx.muzzle(from.x, from.y, from.z, false);
    const pc = this.hitChance(shooter, w, target);
    const d = shooter.distTo(target), flight = 0.3 + d / 45;
    let hits = 0;
    for (let i = 0; i < n; i++) {
      const hit = Math.random() < pc;
      if (hit) hits++;
      const end = tp.clone();
      if (!hit) end.add(new THREE.Vector3(rand(-3, 3), 0, rand(-3, 3)));
      end.y = game.terrain.surface(end.x, end.z);
      const dl = i * 0.12;
      game.later(dl, () => fx.throwable(from, end, flight, flight, 'launcher'));
      game.later(dl + flight, () => fx.explosion(end.x, end.y + 0.2, end.z, 0.35, { crater: false, sound: i === 0 }));
    }
    game.later(flight + 0.05, () => {
      if (hits && target.alive) game.applyDamage(target, w.dmg * hits, w, shooter);
      if (w.splash && target.alive !== undefined) game.splashDamage(target.pos.x, target.pos.z, w.splash, w.dmg * 0.4 * Math.max(1, hits), w, shooter.side, hits ? target : null, false, shooter.owner);
    });
  }

  // Granate im Anflug (Artillerie, auch für Missionsereignisse)
  incomingShell(x, z, w, side, delay = 3, shooter = null, size = 1.4, owner = shooter?.owner ?? null) {
    const game = this.game;
    if (shooter && shooter.weapons) game.support?.onArtilleryFire(shooter, w); // V3-M2: Gegenbatterie (Radar/Schallmessung)
    game.later(delay, () => {
      const y = game.terrain.surface(x, z);
      game.effects.explosion(x, y, z, size, { water: game.terrain.isWater(x, z) });
      game.splashDamage(x, z, w.splash || 7, w.dmg, w, side, null, true, owner);
    });
  }
}

// Registrierung im Spiel
Missile.prototype.register = function () { this.game.missiles.push(this); return this; };
