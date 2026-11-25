// Kampfmechaniken nach klassischem Vorbild (V3-M1), epochenübergreifend: game.tac = new Tactics(game)
//
//  Niederhalten/Moral   u.supp 0..100 (Beschuss, Explosionen, Treffer), Erholung mit der Zeit. ≥25 geduckt, ≥50 liegend
//                       (langsamer, schlechter treffend, kleineres Profil), ≥88 Panik (u.panicT: Rückzug, nicht steuerbar).
//  Offizier             type.officer: Führungsaura 30 m (u.ledT) – Treffer +15 %, Nachladen −15 %, Niederhalten −40 %,
//                       schnellere Erholung; fällt er, Moralknick (+35 Niederhalten) in der Nähe. Fernglas wie Beobachter.
//  Veteranen            u.xp/u.vet 0..3 (Abschüsse, Treffer): Genauigkeit +6 %, Sicht +5 %, Nachladen −3 % je Stufe,
//                       langsame Selbstheilung, Niederhalten-Resistenz; Beförderungsmeldung.
//  Fahrzeugmodule       u.immobilized (Kette/Räder), u.mods = { eng 0|1|2 (beschädigt|brennt), tur (Turm klemmt), gun
//                       (Hauptwaffe zerstört), crw 0..3 (Besatzung verwundet) }; Trefferzone aus Winkel/Topangriff/Mine.
//                       Besatzung repariert Kette (30 s) und Turm (20 s) selbst; Bergepanzer repariert alles (logistics.js).
//  Handgranaten         Waffen kind 'grenade' (range, fuse, splash, incendiary, houseMul, ammo): Wurf im Bogen, Zünder,
//                       Explosion ohne Deckungsbonus; automatisch gegen Infanterie in Deckung/Graben/besetzten Häusern und
//                       Stellungen, Werfer (minRange/launcher) als Bogenschuss, Molotow setzt Häuser/Infanterie in Brand.
//  Rauch                game.tac.smokes = [{ id, x, z, r, dur, age, top, vx, vz }] – blockiert Sichtlinien (vision.js), driftet
//                       mit dem Wind; Nebelgranaten (Infanterie), Nebelwerfer (Fahrzeuge, automatisch bei Lenkflugkörpern).
//  Hinterhalt           u.ambush = { on, range }: schießt nicht, schwer zu entdecken, bis Feind < range oder Freigabe/Treffer.
//  Kommandos (game.command): {t:'smoke', ids, x, z} · {t:'grenade', ids, x, z, target?} · {t:'ambush', ids, value, range}
//                       · {t:'dig', ids}
import * as THREE from 'three';
import { UNIT_TYPES } from './unitTypes.js';
import { rand, clamp, angleDiff } from '../engine/util.js';

export const TAC = {
  tick: 0.25,
  supp: { crouch: 25, pinned: 50, panic: 88, panicLed: 97, decayFree: 9, decayFire: 2, quietT: 2.5, panicT: 5, panicCd: 14, flee: 16 },
  officer: { radius: 30, acc: 1.15, reload: 0.85, supp: 0.6, recover: 1.5, shock: 35 },
  vet: { xp: [5, 14, 30], acc: 0.06, sight: 0.05, reload: 0.03, regen: 0.12, supp: 0.12, names: ['Rekrut', 'Erfahren', 'Veteran', 'Elite'] },
  wounded: 0.25,
  smoke: { r: 7, dur: 38, top: 7, grow: 3, fade: 6, drift: 0.3, throwRange: 26, vehR: 8, vehDist: 7 },
  grenade: { throwSpeed: 13, launcherSpeed: 32 },
  repair: { track: 30, turret: 20, burn: 12, burnDmg: 0.008 },
  ambush: { range: 25, min: 5, max: 60, group: 18 },
  wireClear: 5,
  xpKill: { inf: 2, light: 4, heavy: 6, air: 4, struct: 3 },
};
const _v = new THREE.Vector3();
export const isLauncher = (w) => !!(w && (w.launcher || (w.kind === 'grenade' && w.minRange)));

// Startwerte der Taktik-Zustände (aus dem Unit-Konstruktor; alles einfache Felder → snapshot-tauglich)
export function smokeCharges(t) {
  if (t.smoke !== undefined) return t.smoke;
  if (t.infantry) return t.kamikaze ? 0 : t.officer ? 2 : 1;
  if (t.vehicle && !t.structure && !t.unmanned && !t.kamikaze) {
    if (t.smokeLaunchers !== undefined) return t.smokeLaunchers;
    if (t.supply || t.repair || t.towed || t.rail || !(t.weapons || []).length) return 0;
    if (t.era === 'ww2') return t.armor === 'heavy' ? 1 : 0;
    return t.armor === 'heavy' || t.armor === 'light' ? 2 : 0;
  }
  return 0;
}
export function initTactical(u) {
  const t = u.type;
  u.supp = 0; u.suppT = -99; u.panicT = 0; u.panicCd = 0; u.ledT = -99;
  u.xp = 0; u.vet = 0;
  u.mods = t.vehicle && !t.structure ? { eng: 0, tur: 0, gun: 0, crw: 0 } : null;
  u.smokeN = smokeCharges(t); u.smokeMax = u.smokeN;
  u.ambush = null; u.throwOrder = null; u.burnT = 0;
  for (const ws of u.weapons) if (ws.def.kind === 'grenade' && ws.cd > 1.5) ws.cd = rand(0, 1.5); // erster Wurf ohne lange Wartezeit
}
// Bitfeld der Fahrzeugmodule (Snapshot): eng 2 Bit | tur | gun | crw 2 Bit
export const packMods = (m) => (m ? (m.eng & 3) | (m.tur ? 4 : 0) | (m.gun ? 8 : 0) | ((m.crw & 3) << 4) : 0);
export function unpackMods(u, v) { if (!u.mods) return; u.mods.eng = v & 3; u.mods.tur = v & 4 ? 1 : 0; u.mods.gun = v & 8 ? 1 : 0; u.mods.crw = (v >> 4) & 3; }

export class Tactics {
  constructor(game) {
    this.g = game;
    this.acc = 0;
    this.smokes = [];
    this.smokeSeq = 0;
    this.msgT = new Map();
    this.stats = { grenades: 0, smokes: 0, panics: 0, promotions: 0, moduleHits: 0, ambushes: 0, dug: 0, wiresCrushed: 0 };
  }

  // ================= Modifikatoren =================
  isLed(u) { return u.ledT > this.g.time; }
  pinned(u) { return u.supp >= TAC.supp.pinned; }
  accMul(s, target, w) {
    let m = 1;
    if (s.type.infantry) {
      if (s.supp >= TAC.supp.pinned) m *= 0.55; else if (s.supp >= TAC.supp.crouch) m *= 0.85;
      if (this.isLed(s)) m *= TAC.officer.acc;
    }
    if (s.vet) m *= 1 + TAC.vet.acc * s.vet;
    if (s.mods?.crw) m *= 1 - 0.15 * s.mods.crw;
    if (target && target.type.infantry && w && w.kind === 'bullet') { if (target.supp >= TAC.supp.pinned || target.prone) m *= 0.7; else if (target.supp >= TAC.supp.crouch) m *= 0.88; } // V3-M2: kriechend schwerer zu treffen
    return m;
  }
  reloadMul(u) {
    let m = 1;
    if (u.type.infantry) { if (this.isLed(u)) m *= TAC.officer.reload; if (u.supp >= TAC.supp.pinned) m *= 1.4; }
    if (u.vet) m *= 1 - TAC.vet.reload * u.vet;
    if (u.mods) { if (u.mods.crw) m *= 1 + 0.15 * u.mods.crw; if (u.mods.tur && !u.model?.turret) m *= 1.6; }
    return m;
  }
  speedMul(u) {
    // V3-M2: Rückzug ignoriert Niederhalten/Verwundung; Walzen bremst kurz; Geschütz am Haken bremst
    if (u.retreat) return u.type.infantry ? 1.3 : 1.15;
    if (u.type.vehicle) {
      let k = u.crushT > this.g.time ? 0.6 : 1;
      if (u.towing) k *= 0.8;
      if (k < 1) return k * (u.mods ? (u.mods.eng === 2 ? 0.3 : u.mods.eng === 1 ? 0.5 : 1) : 1);
    }
    if (u.type.infantry) {
      if (u.panicT > 0) return 1.15;
      let m = 1;
      if (u.supp >= TAC.supp.pinned) m *= 0.4; else if (u.supp >= TAC.supp.crouch) m *= 0.8;
      if (u.hp < u.maxHp * TAC.wounded) m *= 0.5; // Verwundete kriechen
      if (u.prone && u.supp < TAC.supp.pinned) m *= 0.45; // V3-M2: Haltung kriechend
      return m;
    }
    if (u.mods) return u.mods.eng === 2 ? 0.3 : u.mods.eng === 1 ? 0.5 : 1;
    return 1;
  }
  sightMul(u) { return u.vet ? 1 + TAC.vet.sight * u.vet : 1; }
  // Hält die Einheit das Feuer? (Feuer halten oder Hinterhalt)
  holds(u) { return u.holdFire || !!u.ambush?.on; }
  // Lohnt ein automatischer Granatwurf? (Infanterie in Deckung/Graben, besetzte Häuser, Stellungen; Molotow auch Fahrzeuge)
  grenadeWorthy(s, w, u) {
    if (u.type.key === 'house') return !!u.occupants?.length && u.garrisonSide !== s.side;
    if (w.incendiary && u.type.vehicle) return true;
    if (u.type.infantry) return isLauncher(w) || !!this.g.logi?.coverOf(u) || u.supp >= TAC.supp.pinned;
    if (u.type.structure && u.weapons.length && !u.type.build?.hidden) return true; // MG-Nest, Bunker
    return false;
  }

  // ================= Niederhalten =================
  addSupp(u, amt, src) {
    if (!u.alive || !u.type.infantry || u.type.kamikaze || u.type.unmanned || amt <= 0) return;
    let m = 1;
    if (this.isLed(u)) m *= TAC.officer.supp;
    if (u.vet) m *= 1 - TAC.vet.supp * u.vet;
    if (u.garrison) m *= 0.5; else if (this.g.logi?.coverOf(u)) m *= 0.7;
    if (u.type.officer) m *= 0.7;
    u.supp = Math.min(100, u.supp + amt * m);
    u.suppT = this.g.time;
    if (src) { u.suppX = src.x; u.suppZ = src.z; }
  }
  // Schuss auf ein Ziel (Treffer oder nicht): Ziel und Infanterie in der Nähe werden niedergehalten
  onShot(s, w, target) {
    if (!target || !target.alive || !s) return;
    let base = w.suppress;
    if (base === undefined) {
      if (w.kind === 'bullet') base = ((w.burst || 1) >= 4 ? 10 : 2 + (w.burst || 1) * 0.8) * (w.dmg >= 20 ? 1.5 : 1);
      else if (w.kind === 'shell') base = 14;
      else base = 0;
    }
    if (!base) return;
    const g = this.g, R = w.kind === 'shell' ? 5 : 3.5, x = target.pos.x, z = target.pos.z;
    if (target.occupants?.length) for (const o of target.occupants) this.addSupp(o, base * 0.4, s.pos);
    for (const u of g.units) {
      if (!u.alive || !u.type.infantry || u.side === s.side || u.side === 'N' || u.garrison) continue;
      const dx = u.pos.x - x, dz = u.pos.z - z;
      if (dx > R || dx < -R || dz > R || dz < -R || dx * dx + dz * dz > R * R) continue;
      this.addSupp(u, u === target ? base : base * 0.6, s.pos);
    }
  }
  // Explosion (Artillerie, Granaten, Splash): Infanterie im 2,2-fachen Radius wird niedergehalten
  onBlast(x, z, r, dmg, side, hitAll = false) {
    const R = r * 2.2, base = clamp(dmg * 0.25, 10, 45), src = { x, z };
    for (const u of this.g.units) {
      if (!u.alive || !u.type.infantry || u.side === 'N' || (!hitAll && u.side === side)) continue;
      const d = Math.hypot(u.pos.x - x, u.pos.z - z);
      if (d > R) continue;
      this.addSupp(u, base * (1 - d / R) * (u.garrison ? 0.6 : 1), src);
    }
  }
  _startPanic(u) {
    const g = this.g;
    u.panicT = TAC.supp.panicT; u.panicCd = g.time + TAC.supp.panicCd;
    u.job = null; u.throwOrder = null;
    if (u.ambush) u.ambush.on = false;
    const sx = u.suppX ?? u.pos.x - Math.sin(u.heading), sz = u.suppZ ?? u.pos.z - Math.cos(u.heading);
    let a = Math.atan2(u.pos.x - sx, u.pos.z - sz) + rand(-0.4, 0.4);
    const T = g.terrain, L = TAC.supp.flee;
    let tx = u.pos.x + Math.sin(a) * L, tz = u.pos.z + Math.cos(a) * L;
    if (!T.inBounds(tx, tz, -8)) { a += Math.PI; tx = u.pos.x + Math.sin(a) * L; tz = u.pos.z + Math.cos(a) * L; }
    u._goto(tx, tz);
    for (const ws of u.weapons) ws.target = null;
    this.stats.panics++;
    this._msg(u.owner, 'panic', `⚠ ${u.name}: Panik – Rückzug!`, 4);
    g.emit('panic', u);
  }

  // ================= Erfahrung =================
  addXp(u, x) {
    if (!u || !u.type || u.type.structure || u.type.kamikaze || u.type.unmanned || u.side === 'N' || !(x > 0)) return;
    u.xp = (u.xp || 0) + x;
    let v = 0;
    while (v < 3 && u.xp >= TAC.vet.xp[v]) v++;
    if (v > (u.vet || 0)) {
      u.vet = v;
      this.stats.promotions++;
      if (u.alive) {
        this.g.alertTo(u.owner, `★ Beförderung: ${u.name} ist jetzt ${TAC.vet.names[v]}`, 3);
        this.g.markerTo(u.owner, u.pos.x, u.pos.z, 0xffd500, 1.2, 2.5);
      }
      this.g.emit('promoted', u, v);
    }
  }

  // ================= Treffer / Tod (aus game.applyDamage / killUnit) =================
  onHit(t, amount, w, src, opts = {}) {
    if (src && src.weapons && src.side !== t.side && t.side !== 'N') this.addXp(src, t.type.vehicle ? 0.35 : 0.15);
    if (t.ambush?.on) this.spring(t);
    if (t.occupants?.length) for (const o of t.occupants) if (o.ambush?.on) { this.spring(o); break; }
    if (t.type.infantry) this.addSupp(t, 6 + amount * 0.15, src?.pos);
    if (t.mods && !t.abandoned && !t.invulnerable && amount >= t.maxHp * 0.04 && t.hp - amount > 0) this.moduleHit(t, amount, w, src, opts);
  }
  onKill(u, killer) {
    const g = this.g;
    if (killer && killer.weapons && killer.side !== u.side && u.side !== 'N' && !u.type.build) {
      const k = TAC.xpKill;
      this.addXp(killer, u.type.structure ? k.struct : u.type.air ? k.air : u.type.infantry ? k.inf : u.armor === 'heavy' ? k.heavy : k.light);
    }
    // Offizier gefallen: kurzer Moralknick in der Nähe
    if (u.type.officer && u.side !== 'N') {
      const r2 = TAC.officer.radius ** 2;
      let n = 0;
      for (const o of g.units) {
        if (!o.alive || o === u || o.side !== u.side || !o.type.infantry) continue;
        if ((o.pos.x - u.pos.x) ** 2 + (o.pos.z - u.pos.z) ** 2 > r2) continue;
        o.ledT = -99; this.addSupp(o, TAC.officer.shock, u.pos); n++; // Aura weg, dann Schock
      }
      g.alertTo(u.side, `⚠ ${u.name} gefallen – Moral der Truppe sinkt!`, 3);
      g.emit('officerDown', u, n);
    }
  }

  // ================= Fahrzeugmodule =================
  moduleHit(t, amount, w, src, opts) {
    let zone = 'side';
    if (w && w.mine) zone = 'bottom';
    else if (opts.topAttack) zone = 'top';
    else if (src && src.pos) {
      const ang = Math.atan2(src.pos.x - t.pos.x, src.pos.z - t.pos.z);
      const d = Math.abs(angleDiff(t.heading, ang));
      zone = d < 0.7 ? 'front' : d > 2.4 ? 'rear' : 'side';
    }
    const P = {
      front: [['tur', 0.14], ['gun', 0.07], ['crw', 0.08], ['trk', 0.07]],
      side: [['trk', 0.22], ['eng', 0.1], ['crw', 0.1], ['tur', 0.05]],
      rear: [['eng', 0.35], ['trk', 0.14]],
      top: [['eng', 0.18], ['tur', 0.15], ['crw', 0.15], ['trk', 0.05]],
      bottom: [['trk', 0.7], ['crw', 0.15]],
    }[zone];
    const sev = clamp(amount / (t.maxHp * 0.15), 0.4, 1.6);
    t.lastZone = zone;
    for (const [m, p] of P) if (Math.random() < p * sev) this.damageModule(t, m, src);
  }
  damageModule(t, m, src = null) {
    const g = this.g, md = t.mods;
    if (!md) return false;
    const wheeled = !/tank|panzer|track|kette/i.test(t.type.model + t.type.name) && t.armor !== 'heavy';
    let txt = null;
    if (m === 'trk') { if (t.immobilized || t.type.rail) return false; t.immobilized = true; t.selfFixT = 0; txt = wheeled ? 'Räder/Antrieb zerstört' : 'Kette zerstört'; }
    else if (m === 'eng') {
      if (md.eng === 2) return false;
      md.eng = md.eng === 1 || Math.random() < 0.4 ? 2 : 1;
      if (md.eng === 2) { t.engBurnT = TAC.repair.burn; t.burnSrc = src && src.side ? src : null; txt = 'Motor brennt!'; } else txt = 'Motor beschädigt';
    } else if (m === 'tur') { if (md.tur) return false; md.tur = 1; t.turFixT = 0; txt = t.model?.turret ? 'Turm klemmt' : 'Richtanlage beschädigt'; }
    else if (m === 'gun') { if (md.gun || !t.weapons.length) return false; md.gun = 1; txt = 'Hauptwaffe zerstört'; }
    else if (m === 'crw') { if (md.crw >= 3) return false; md.crw++; txt = `Besatzung verwundet (${md.crw}/3)`; }
    this.stats.moduleHits++;
    if (txt && t.owner !== null) this._msg(t.owner, 'mod' + t.id, `⚠ ${t.name}: ${txt}`, 2);
    g.emit('moduleHit', t, m);
    return true;
  }
  // Instandsetzung eines Moduls (Bergepanzer/Logistik): liefert true, wenn etwas repariert wurde
  repairOne(u) {
    const md = u.mods;
    if (u.immobilized) { u.immobilized = false; u.selfFixT = 0; return true; }
    if (!md) return false;
    if (md.eng) { md.eng = 0; u.engBurnT = 0; return true; }
    if (md.gun) { md.gun = 0; return true; }
    if (md.tur) { md.tur = 0; return true; }
    if (md.crw) { md.crw = 0; return true; }
    return false;
  }
  damaged(u) { return !!(u.immobilized || (u.mods && (u.mods.eng || u.mods.tur || u.mods.gun || u.mods.crw))); }

  // ================= Handgranaten & Würfe =================
  // Wurf/Bogenschuss mit Waffe w auf (x, z) (target optional: Haus/Einheit für Zielwirkung)
  throwAt(s, w, x, z, target = null) {
    const g = this.g;
    const from = s.garrison ? new THREE.Vector3(s.pos.x, s.garrison.roofY - 1.5, s.pos.z) : s.muzzleWorld(new THREE.Vector3());
    const d = Math.hypot(x - from.x, z - from.z);
    const launcher = isLauncher(w);
    const acc = clamp((w.acc ?? 0.6) * this.accMul(s, target, w), 0.05, 0.98);
    const sc = (target?.type?.key === 'house' ? 0 : d * (1 - acc) * 0.25) + (launcher ? 0.6 : 0.3);
    const a = rand(0, Math.PI * 2), rr = rand(0, sc);
    const tx = x + Math.cos(a) * rr, tz = z + Math.sin(a) * rr;
    const ty = g.terrain.surface(tx, tz) + (target?.type?.key === 'house' ? 1.5 : 0);
    const flight = w.kind === 'charge' ? 0.35 : launcher ? 0.25 + d / TAC.grenade.launcherSpeed : 0.45 + d / TAC.grenade.throwSpeed;
    const det = launcher || w.incendiary ? flight : Math.max(flight + 0.4, w.fuse || 3);
    const kind = w.incendiary ? 'molotov' : launcher ? 'launcher' : w.kind === 'charge' ? 'charge' : 'grenade';
    g.effects.throwable(from, _v.set(tx, ty, tz), flight, det, kind);
    if (s.garrison) s.garrison.revealT = g.time;
    this.stats.grenades++;
    const side = s.side, owner = s.owner;
    g.later(det, () => this._detonate(tx, tz, w, s, side, owner, target));
    return true;
  }
  _detonate(x, z, w, s, side, owner, target) {
    const g = this.g, fx = g.effects;
    if (!g.active) return;
    const y = g.terrain.surface(x, z), r = w.splash || 5, launcher = isLauncher(w);
    const src = s && s.side ? s : { pos: new THREE.Vector3(x, y, z), alive: false, side, owner };
    if (!src.pos) src.pos = new THREE.Vector3(x, y, z);
    const house = target?.type?.key === 'house' && target.alive ? target : null;
    if (w.incendiary) { fx.explosion(x, y + 0.3, z, 0.45, { crater: false }); fx.firePool(x, y + 0.1, z, 9); }
    else fx.explosion(x, y + (house ? 1.5 : 0.3), z, w.kind === 'charge' ? 1.4 : launcher ? 0.6 : 0.7, { crater: !house });
    const opts = { topAttack: true, grenade: true };
    for (const u of [...g.units]) {
      if (!u.alive || u.garrison || (u.type.air && u.curAlt > 4)) continue;
      if (u.type.key === 'house') {
        // Wurf ins Fenster: Haus und die Insassen EINES Raums (V3-R: höchstens 2, nicht die ganze Besatzung)
        if (u !== house) continue; // nur das anvisierte Haus (Wurf durchs Fenster)
        const hm = w.houseMul || 1.4;
        const room = (u.occupants || []).filter((o) => !(o.side === side && o.owner === owner));
        while (room.length > 2) room.splice(Math.floor(Math.random() * room.length), 1);
        for (const o of room) {
          const amt = w.dmg * 0.55 * hm * rand(0.8, 1.2);
          this.addSupp(o, 30, src.pos);
          g.gar.hurt(o, amt, src);
          if (w.incendiary && o.alive) o.burnT = Math.max(o.burnT || 0, 4);
        }
        if (w.vs.struct) g.applyDamage(u, w.dmg * hm * 2, w, src, opts);
        continue;
      }
      if (u.type.structure && !u.weapons.length && !u.type.build) continue;
      const d = Math.hypot(u.pos.x - x, u.pos.z - z) - u.radius * 0.7;
      if (d > r) continue;
      const k = 1 - Math.max(0, d) / r;
      const mul = u.side === side ? 0.3 : 1; // Eigengefährdung gering (Wurf weg von eigenen Leuten)
      g.applyDamage(u, w.dmg * k * mul, w, src, opts);
      if (w.incendiary && u.alive && k > 0.3) {
        if (u.type.infantry) u.burnT = Math.max(u.burnT || 0, 5);
        else if (u.mods && Math.random() < (u.armor === 'heavy' ? 0.25 : 0.6)) this.damageModule(u, 'eng', src);
      }
    }
    this.onBlast(x, z, r, w.dmg, side);
    g.emit('grenade', x, z, w, side);
  }
  // Wurfauftrag (Kommando grenade/smoke): Einheit läuft in Reichweite und wirft
  _stepThrow(u, dt) {
    const o = u.throwOrder, g = this.g;
    if (o.kind === 'grenade') {
      const ws = u.weapons.find((q) => q.def.kind === 'grenade' && q.stock >= 1 && q.ammo > 0);
      if (!ws) { u.throwOrder = null; return; }
      const tgt = o.target !== undefined ? g.unitById(o.target) : null;
      if (o.target !== undefined && (!tgt || !tgt.alive)) { u.throwOrder = null; return; }
      const x = tgt ? tgt.pos.x : o.x, z = tgt ? tgt.pos.z : o.z;
      if (!this._inThrowRange(u, x, z, (ws.def.range || 20) * u.rangeMul(), tgt)) return;
      if (ws.cd > 0) return;
      const w = ws.def;
      ws.cd = w.reload * this.reloadMul(u);
      if (w.ammo) { ws.ammo--; if (ws.ammo <= 0) ws.reloadT = w.reloadAmmo; }
      if (ws.stock !== Infinity) ws.stock--;
      u.lastFired = g.time;
      u.heading = Math.atan2(x - u.pos.x, z - u.pos.z);
      g.audio.shot(w.sound || 'grenade', u.pos.x, u.pos.z);
      this.throwAt(u, w, x, z, tgt);
      u.throwOrder = null;
    } else if (o.kind === 'smoke') {
      if (u.smokeN <= 0) { u.throwOrder = null; return; }
      if (!this._inThrowRange(u, o.x, o.z, TAC.smoke.throwRange * u.rangeMul(), null)) return;
      u.smokeN--;
      u.heading = Math.atan2(o.x - u.pos.x, o.z - u.pos.z);
      this.throwSmoke(u, o.x, o.z);
      u.throwOrder = null;
    }
  }
  _inThrowRange(u, x, z, range, tgt) {
    const d = Math.hypot(x - u.pos.x, z - u.pos.z) - (tgt ? tgt.radius * 0.8 : 0);
    if (d <= range) { if (u.order && u.order.type !== 'attack') { u.order = null; u.path = null; } u.moving = false; return true; }
    if (u.garrison) { u.throwOrder = null; return false; } // aus dem Haus nur in Reichweite
    if (!u.order || u.order.type !== 'move' || !u.path || !u.path.length) {
      const a = Math.atan2(u.pos.x - x, u.pos.z - z), r = range * 0.85;
      u._goto(x + Math.sin(a) * r, z + Math.cos(a) * r);
      if (!u.path || !u.path.length) u.throwOrder = null;
    }
    return false;
  }

  // ================= Rauch =================
  effR(c) { const S = TAC.smoke; return c.r * Math.min(1, c.age / S.grow) * clamp((c.dur - c.age) / S.fade, 0, 1); }
  addSmoke(x, z, r = TAC.smoke.r, dur = TAC.smoke.dur, age = 0) {
    const w = this.g.effects?.wind || { x: 0.8, z: 0.4 }, S = TAC.smoke;
    const c = { id: ++this.smokeSeq, x, z, r, dur, age, top: S.top, vx: w.x * S.drift, vz: w.z * S.drift, dead: false };
    this.smokes.push(c);
    this.stats.smokes++;
    this.g.effects?.smokeScreen(c);
    return c;
  }
  throwSmoke(u, x, z) {
    const g = this.g, from = u.muzzleWorld(new THREE.Vector3());
    const d = Math.hypot(x - from.x, z - from.z), flight = 0.45 + d / TAC.grenade.throwSpeed;
    g.effects.throwable(from, _v.set(x, g.terrain.surface(x, z), z), flight, flight + 2.5, 'smoke');
    g.audio.shot('grenade', u.pos.x, u.pos.z);
    g.later(flight, () => { if (g.active) this.addSmoke(x, z, TAC.smoke.r, TAC.smoke.dur); });
  }
  // Nebelwurfanlage eines Fahrzeugs: Rauchwand zwischen Fahrzeug und Bedrohung (dir = Blickwinkel zur Bedrohung)
  vehicleSmoke(u, dir = u.heading + u.turretYaw) {
    if (!u.alive || u.smokeN <= 0 || (u._smokeCd || 0) > this.g.time) return false;
    const g = this.g, S = TAC.smoke;
    u.smokeN--; u._smokeCd = g.time + 6;
    const x = u.pos.x + Math.sin(dir) * S.vehDist, z = u.pos.z + Math.cos(dir) * S.vehDist;
    const from = u.muzzleWorld(new THREE.Vector3());
    for (const s of [-1, 0, 1]) {
      const a = dir + s * 0.5, tx = u.pos.x + Math.sin(a) * S.vehDist, tz = u.pos.z + Math.cos(a) * S.vehDist;
      g.effects.throwable(from, _v.set(tx, g.terrain.surface(tx, tz), tz), 0.5, 1.2, 'smoke');
    }
    g.audio.shot('grenade', u.pos.x, u.pos.z);
    g.effects.muzzle(from.x, from.y, from.z, false);
    g.later(0.5, () => { if (g.active) this.addSmoke(x, z, S.vehR, S.dur * 0.9, 1.5); });
    this._msg(u.owner, 'vs' + u.id, `${u.name}: Nebelwurfanlage ausgelöst`, 2);
    return true;
  }
  // Lenkflugkörper im Anflug auf ein Fahrzeug: automatische Nebelwand (Reaktionszeit 0,6 s)
  onAtgm(target, shooter) {
    if (!target?.alive || !target.type.vehicle || target.smokeN <= 0 || target.abandoned) return;
    const g = this.g;
    g.later(0.6, () => { if (target.alive && shooter?.pos) this.vehicleSmoke(target, Math.atan2(shooter.pos.x - target.pos.x, shooter.pos.z - target.pos.z)); });
  }
  // Rauch zwischen zwei Punkten? (2D-Strecke gegen Wolkenkreis, unterhalb der Wolkenoberkante)
  segBlocked(ox, oz, oy, tx, tz, ty) {
    const list = this.smokes;
    if (!list.length) return false;
    const dx = tx - ox, dz = tz - oz, l2 = dx * dx + dz * dz || 1;
    for (const c of list) {
      const r = this.effR(c);
      if (r < 1.5) continue;
      let k = ((c.x - ox) * dx + (c.z - oz) * dz) / l2;
      k = k < 0 ? 0 : k > 1 ? 1 : k;
      const px = ox + dx * k, pz = oz + dz * k;
      if ((px - c.x) ** 2 + (pz - c.z) ** 2 > r * r) continue;
      const h = oy + (ty - oy) * k;
      if (h > this.g.terrain.height(px, pz) + c.top) continue;
      return true;
    }
    return false;
  }
  lineSmoked(a, b) { const T = this.g.terrain; return this.segBlocked(a.x, a.z, T.surface(a.x, a.z) + 2, b.x, b.z, T.surface(b.x, b.z) + 1.5); }
  // Wolken, die einen Kreis (x, z, R) berühren (Vorfilter für Sichtsektoren)
  smokesNear(x, z, R) {
    const out = [];
    for (const c of this.smokes) { const r = this.effR(c); if (r >= 1.5 && Math.hypot(c.x - x, c.z - z) < R + r) out.push(c); }
    return out;
  }
  inSmoke(list, x, z, h) {
    for (const c of list) { const r = this.effR(c); if ((x - c.x) ** 2 + (z - c.z) ** 2 < r * r && h < this.g.terrain.height(x, z) + c.top) return true; }
    return false;
  }

  // ================= Hinterhalt =================
  spring(u, silent = false) {
    const g = this.g;
    if (!u.ambush?.on) return;
    let n = 0;
    const r2 = TAC.ambush.group ** 2;
    for (const o of g.units) {
      if (!o.alive || !o.ambush?.on || o.owner !== u.owner) continue;
      if (o !== u && !(u.garrison && o.garrison === u.garrison) && (o.pos.x - u.pos.x) ** 2 + (o.pos.z - u.pos.z) ** 2 > r2) continue;
      o.ambush.on = false; n++;
    }
    this.stats.ambushes++;
    if (!silent) this._msg(u.owner, 'amb', `⚔ Hinterhalt ausgelöst – Feuer frei! (${n})`, 3);
    g.emit('ambushSprung', u, n);
  }

  // ================= Kommandos =================
  command(p, cmd, units) {
    const g = this.g;
    const fin = (v) => typeof v === 'number' && Number.isFinite(v);
    switch (cmd.t) {
      case 'smoke': {
        let n = 0;
        for (const u of units) {
          if (u.type.vehicle && u.smokeN > 0 && !u.abandoned) {
            const dir = fin(cmd.x) && fin(cmd.z) ? Math.atan2(cmd.x - u.pos.x, cmd.z - u.pos.z) : u.heading + u.turretYaw;
            if (this.vehicleSmoke(u, dir)) n++;
          } else if (u.type.infantry && u.smokeN > 0 && fin(cmd.x) && fin(cmd.z)) {
            u.job = null; u.throwOrder = { kind: 'smoke', x: cmd.x, z: cmd.z }; n++;
            if (n >= 1 && units.filter((q) => q.type.infantry).length > 1) break; // eine Nebelgranate je Befehl genügt
          }
        }
        return n > 0;
      }
      case 'grenade': {
        const t = cmd.target !== undefined && cmd.target !== null ? g.unitById(cmd.target) : null;
        if (t && (!t.alive || (t.side !== 'N' && t.side === p.team) || (t.side !== 'N' && !t.type.structure && !t.visibleTo(p.team)))) return false;
        if (!t && (!fin(cmd.x) || !fin(cmd.z))) return false;
        let n = 0;
        for (const u of units) {
          if (!u.type.infantry || !u.weapons.some((q) => q.def.kind === 'grenade' && q.stock >= 1 && q.ammo > 0)) continue;
          u.job = null;
          u.throwOrder = t ? { kind: 'grenade', target: t.id } : { kind: 'grenade', x: cmd.x, z: cmd.z };
          n++;
        }
        return n > 0;
      }
      case 'ambush': {
        const list = [...units];
        for (const id of cmd.ids || []) {
          const h = g.unitById(id);
          if (h && h.type.key === 'house' && h.occupants?.length && h.garrisonSide === p.team) for (const o of h.occupants) if (o.owner === p.id && !list.includes(o)) list.push(o);
        }
        const sel = list.filter((u) => !u.type.structure && !u.type.air && !u.type.kamikaze && !u.abandoned);
        if (!sel.length) return false;
        const v = cmd.value === undefined ? !sel.every((u) => u.ambush?.on) : !!cmd.value;
        const range = fin(cmd.range) ? clamp(cmd.range, TAC.ambush.min, TAC.ambush.max) : TAC.ambush.range;
        for (const u of sel) {
          if (v) { u.ambush = { on: true, range }; u.holdFire = false; for (const ws of u.weapons) ws.target = null; if (u.order?.type === 'attack') u.order = null; }
          else if (u.ambush) u.ambush.on = false;
        }
        return true;
      }
      case 'dig': {
        let n = 0;
        for (const u of units) {
          if (!u.type.infantry || u.type.kamikaze || u.garrison || u.abandoned) continue;
          if (this.dig(u, p)) n++;
        }
        return n > 0;
      }
    }
    return false;
  }
  digKind(u) {
    const t = u.type;
    const k = t.digKind || (t.era === 'ww2' ? 'ww2_foxhole' : t.era === 'afghan' ? 'af_foxhole' : 'foxhole');
    return UNIT_TYPES[k]?.build ? k : 'foxhole';
  }
  // Schützenloch an der Position der Einheit ausheben (ohne Material); vorhandenes eigenes Loch daneben fertigstellen
  dig(u, p) {
    const g = this.g, T = g.terrain;
    const k = T.cellIndex(u.pos.x, u.pos.z);
    if (k < 0 || T.gWater[k]) return false;
    let hole = null;
    for (const b of g.units) {
      if (!b.alive || !b.type.selfDig || b.side !== u.side) continue;
      if (Math.hypot(b.pos.x - u.pos.x, b.pos.z - u.pos.z) < 1.8) { hole = b; break; }
    }
    if (hole && hole.build.progress >= 1) return false; // steht schon in einem fertigen Loch
    if (!hole) {
      if (g.units.filter((b) => b.alive && b.type.selfDig && b.owner === p.id).length >= 80) return false;
      const kind = this.digKind(u), def = UNIT_TYPES[kind].build;
      hole = g.spawn(kind, u.side, u.pos.x, u.pos.z, { owner: p.id, rot: u.heading, noBlock: true, build: { progress: 0, time: def.time, kind } });
      g.logi.setProgress(hole, 0.02);
      this.stats.dug++;
    }
    u.stop();
    u.throwOrder = null;
    u.job = { type: 'build', target: hole.id, dig: true };
    return true;
  }

  // ================= Hauptschleife (Host) =================
  // Pro Einheit und Frame (aus Unit.update): Erholung, Panik, Wurfaufträge
  unitStep(u, dt) {
    const g = this.g;
    if (u.supp > 0) {
      const quiet = g.time - u.suppT > TAC.supp.quietT;
      u.supp = Math.max(0, u.supp - dt * (quiet ? TAC.supp.decayFree : TAC.supp.decayFire) * (this.isLed(u) ? TAC.officer.recover : 1));
    }
    if (u.panicT > 0) {
      u.panicT -= dt;
      if (u.panicT <= 0) { u.panicT = 0; u.stop(); u.supp = Math.min(u.supp, 55); }
    } else if (u.type.infantry && !u.retreat && u.supp >= (this.isLed(u) ? TAC.supp.panicLed : TAC.supp.panic) && g.time > u.panicCd && !u.garrison && !u.garrisonGoal && !g.logi?.coverOf(u) && u.speed > 0) {
      this._startPanic(u);
    }
    if (u.throwOrder && u.panicT <= 0) this._stepThrow(u, dt);
  }
  update(dt) {
    const g = this.g;
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const c = this.smokes[i];
      c.age += dt; c.x += c.vx * dt; c.z += c.vz * dt;
      if (c.age >= c.dur) { c.dead = true; this.smokes.splice(i, 1); }
    }
    this.acc += dt;
    if (this.acc < TAC.tick) return;
    const step = this.acc; this.acc = 0;
    const now = g.time;
    const officers = [], wires = [], ambushers = [], vehicles = [];
    for (const u of g.units) {
      if (!u.alive) continue;
      const t = u.type;
      if (t.build) { if (t.build.blocksInfantry && u.build?.progress >= 1) wires.push(u); continue; }
      if (u.side === 'N') continue;
      if (t.officer && u.panicT <= 0) officers.push(u);
      if (u.ambush?.on) ambushers.push(u);
      if (t.vehicle && !t.structure && u.moving) vehicles.push(u);
      // Veteranen: langsame Selbstheilung, wenn länger nicht getroffen
      if (u.vet && u.hp < u.maxHp && now - u.lastHit > 8 && !t.structure) u.hp = Math.min(u.maxHp, u.hp + TAC.vet.regen * u.vet * step * (t.vehicle ? 3 : 1));
      // Brennende Infanterie (Molotow)
      if (u.burnT > 0) {
        u.burnT -= step;
        this.addSupp(u, 20 * step, null);
        u.hp -= 7 * step; u.lastHit = now;
        if (u.hp <= 0) { g.killUnit(u, null); continue; }
      }
      const md = u.mods;
      if (md && !u.abandoned) {
        // Besatzung repariert Kette und Turm selbst, wenn nicht unter Beschuss
        const calm = now - u.lastHit > 4;
        if (u.immobilized && calm && !u.type.rail) { u.selfFixT = (u.selfFixT || 0) + step; u.working = now; if (u.selfFixT >= TAC.repair.track) { u.immobilized = false; u.selfFixT = 0; this._msg(u.owner, 'fix' + u.id, `${u.name}: Kette instand gesetzt`, 2); } }
        if (md.tur && calm) { u.turFixT = (u.turFixT || 0) + step; if (u.turFixT >= TAC.repair.turret) { md.tur = 0; u.turFixT = 0; } }
        if (md.eng === 2) {
          u.engBurnT = (u.engBurnT ?? TAC.repair.burn) - step;
          u.hp -= u.maxHp * TAC.repair.burnDmg * step; u.lastHit = now;
          if (u.hp <= 0) { g.killUnit(u, u.burnSrc || null); continue; }
          if (u.engBurnT <= 0) md.eng = 1;
        }
      }
    }
    // Offiziere: Führungsaura
    if (officers.length) {
      const r2 = TAC.officer.radius ** 2;
      for (const u of g.units) {
        if (!u.alive || !u.type.infantry || u.side === 'N') continue;
        for (const o of officers) {
          if (o.side !== u.side) continue;
          if ((o.pos.x - u.pos.x) ** 2 + (o.pos.z - u.pos.z) ** 2 <= r2) { u.ledT = now + TAC.tick * 2 + 0.05; break; }
        }
      }
    }
    // Hinterhalt: Feind näher als die eingestellte Distanz → auslösen
    for (const u of ambushers) {
      if (!u.ambush?.on) continue;
      const R = u.ambush.range, R2 = R * R;
      for (const e of g.units) {
        if (!e.alive || e.side === u.side || e.side === 'N' || e.type.structure || (e.type.air && e.curAlt > 6) || e.garrison) continue;
        if (Math.abs(e.pos.x - u.pos.x) > R || Math.abs(e.pos.z - u.pos.z) > R) continue;
        if ((e.pos.x - u.pos.x) ** 2 + (e.pos.z - u.pos.z) ** 2 <= R2) { this.spring(u); break; }
      }
    }
    // Stacheldraht: Fahrzeuge walzen ihn nieder
    for (const w of wires) {
      for (const v of vehicles) {
        if (Math.hypot(v.pos.x - w.pos.x, v.pos.z - w.pos.z) > w.radius + v.radius * 0.6) continue;
        this.stats.wiresCrushed++;
        g.effects.smallHit(w.pos.x, w.pos.y + 0.4, w.pos.z);
        g.logi.removeBuilding(w);
        g.emit('wireCrushed', w, v);
        break;
      }
    }
  }
  // Online-Client: nur Rauchdrift (Sichtprüfung des eigenen Nebels)
  updateClient(dt) {
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const c = this.smokes[i];
      c.age += dt; c.x += c.vx * dt; c.z += c.vz * dt;
      if (c.age >= c.dur) { c.dead = true; this.smokes.splice(i, 1); }
    }
  }

  // ================= Darstellung (Host und Client): Haltung, Brand =================
  pose(u, dt) {
    const g = this.g;
    if (u.burnT > 0 && Math.random() < dt * 10) g.effects.fireAndSmoke(u.pos.x, u.pos.y + 0.3, u.pos.z, 0.45);
    if (u.mods?.eng === 2 && Math.random() < dt * 12) g.effects.fireAndSmoke(u.pos.x - Math.sin(u.heading) * u.radius * 0.6, u.pos.y + 1.2, u.pos.z - Math.cos(u.heading) * u.radius * 0.6, 0.8);
    const b = u.model?.body;
    if (!b || !u.type.infantry || u.garrison) return;
    let tgt = 0;
    if (u.panicT > 0) tgt = 0;
    else if (u.supp >= TAC.supp.pinned || (u.moving && u.hp < u.maxHp * TAC.wounded) || u.prone) tgt = 2; // V3-M2: Haltung kriechend
    else if (u.supp >= TAC.supp.crouch || (u.job?.dig && !u.moving)) tgt = 1;
    const cur = u._pose || 0;
    if (Math.abs(cur - tgt) < 0.01 && !u._poseDirty) return;
    u._pose = cur + (tgt - cur) * Math.min(1, dt * 5);
    if (Math.abs(u._pose - tgt) < 0.01) u._pose = tgt;
    const p = u._pose;
    // 0 stehend · 1 geduckt (vorgebeugt, tiefer) · 2 liegend (Bauchlage)
    b.rotation.x = p <= 1 ? 0.32 * p : 0.32 + 1.13 * (p - 1);
    b.position.y = p <= 1 ? -0.24 * p : -0.24 + 0.4 * (p - 1);
    b.position.z = p <= 1 ? 0 : -0.85 * (p - 1);
    u._poseDirty = p !== 0;
  }

  _msg(to, key, text, dur) {
    if (to === null || to === undefined) return;
    const k = to + '|' + key, now = this.g.time;
    if ((this.msgT.get(k) ?? -99) > now - 4) return;
    this.msgT.set(k, now);
    this.g.alertTo(to, text, dur);
  }
}
