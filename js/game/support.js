// V3-M2: Luftlandung (Fallschirmjäger / Hubschrauber) und Gegenbatteriefeuer.
//
// Luftlandung – Fähigkeit 'airdrop' (js/game/abilities.js) → game.support.airdrop(player, x, z, { n, unit, era }):
//   WK2: Transportflugzeug (C-47 / Ju 52, Optik über js/engine/aircraft.js) überfliegt das Ziel, Fallschirmjäger springen
//   gestreut ab, Schirme sinken (TR 28 m in ~4 s), Truppen landen verteilt und sind erst danach handlungsfähig.
//   Modern/Afghanistan: Transporthubschrauber (Mi-8 bzw. CH-53/Mi-8 der Epoche) fliegt mit Truppen ein, landet am Ziel,
//   lässt absitzen (transport.js) und fliegt zurück. Er ist eine echte Einheit (Flugabwehr kann ihn abschießen).
//   Online: Event 'pd' [id, H, T] → Clients zeigen die Schirme ebenfalls.
// Gegenbatteriefeuer: feuert feindliche Artillerie (Einheit mit Waffe kind 'artillery', combat.incomingShell), orten
//   eigene Gegenbatterie-Radare (type.cbRadar.range, z. B. AN/TPQ-36, Zoopark-1) bzw. in WK2 Beobachter/Offiziere per
//   Schallmessung (SUP.soundRange) die Feuerstellung: Aufdeckung für das Team (SUP.reveal s), Marker, Meldung. Eigene
//   Artillerie in Reichweite (nicht in Bewegung, Haltung cb nicht aus: {t:'stance', cb:false}) schießt automatisch zurück.
//   Feuer von außerhalb der Karte (Fähigkeiten) wird nur gemeldet. Ereignis: game.emit('counterBattery', shooter, detector).
import * as THREE from 'three';
import { rand } from '../engine/util.js';
import { airMission } from '../engine/aircraft.js';
import { UNIT_TYPES } from './unitTypes.js';

export const SUP = { reveal: 12, soundRange: 150, cooldown: 4, chuteH: 28, chuteT: 4, paras: 6, heliPax: 8 };
const other = (t) => (t === 'UA' ? 'RU' : 'UA');
let _chute = null;
function chuteGeo() {
  if (!_chute) { _chute = new THREE.SphereGeometry(2.1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2); _chute.userData.shared = true; }
  return _chute;
}

export class Support {
  constructor(game) {
    this.g = game;
    this.chutes = [];
    this.msgT = {};
    this.stats = { drops: 0, paras: 0, helis: 0, cbDetections: 0, cbReturns: 0, cbOffmap: 0 };
  }

  // ======================= Luftlandung =======================
  airdrop(p, x, z, o = {}) {
    const g = this.g;
    const era = o.era || g.mapobj?.eraOf?.() || 'modern';
    if (era === 'ww2') return this.paraDrop(p, x, z, o);
    return this.heliInsert(p, x, z, { ...o, era });
  }
  paraDrop(p, x, z, o = {}) {
    const g = this.g;
    const allied = p.team === 'UA';
    const unit = o.unit && UNIT_TYPES[o.unit] ? o.unit : allied ? 'ww2_us_para' : 'ww2_de_fj';
    const model = o.model || (allied ? (unit.includes('_uk_') ? 'dakota' : 'c47') : 'ju52');
    const n = o.n || SUP.paras;
    g.sayTo(p.id, 'Luftlande', 'Transporter im Anflug – Absprung über dem Zielgebiet!', 3);
    g.markerTo(p.team, x, z, 0xffd500, 10, 14);
    this.stats.drops++;
    let f = null;
    const drop = () => {
      const [dx, dz] = f?.spec?.dir || [0, 1];
      const heading = Math.atan2(dx, dz);
      for (let i = 0; i < n; i++) {
        g.later(i * 0.25, () => {
          if (g.ended) return;
          const ux = x + rand(-9, 9) + dx * (i * 2.2 - n), uz = z + rand(-9, 9) + dz * (i * 2.2 - n);
          const u = g.spawn(unit, p.team, ux, uz, { owner: p.id, heading });
          this.chute(u, SUP.chuteH, SUP.chuteT + rand(-0.4, 0.6));
          this.stats.paras++;
        });
      }
    };
    try { f = airMission(g, p, x, z, { model, radio: 'Luftlande', dropAt: 8, onOverTarget: drop }); }
    catch (e) { drop(); } // ohne Flugzeugmodell: nur Absprung
    return true;
  }
  // Fallschirm an einer Einheit (Host und Client): sinkt H m in T s, danach handlungsfähig
  chute(u, H = SUP.chuteH, T = SUP.chuteT, fromNet = false) {
    const g = this.g;
    const grp = new THREE.Group();
    const col = u.side === 'UA' ? 0xd8d2b0 : 0xa8b090;
    const canopy = new THREE.Mesh(chuteGeo(), new THREE.MeshStandardMaterial({ color: col, roughness: 0.9, side: THREE.DoubleSide }));
    canopy.position.y = 4.2; canopy.scale.y = 0.6; grp.add(canopy);
    const lines = new THREE.Mesh(new THREE.ConeGeometry(2, 3.2, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0x333333, wireframe: true, transparent: true, opacity: 0.5 }));
    lines.position.y = 2.6; lines.rotation.x = Math.PI; grp.add(lines);
    grp.traverse((q) => { q.raycast = () => {}; });
    u.root.add(grp);
    const c = { u, grp, H, T, t: 0, hold: u.holdFire, imm: u.immobilized };
    if (!fromNet) { u.immobilized = true; u.holdFire = true; u.dropping = true; }
    this.chutes.push(c);
    this._chuteStep(c, 0);
    if (!fromNet) g.net?.event?.(['pd', u.id, H, +T.toFixed(2)], u.pos.x, u.pos.z);
    return c;
  }
  _chuteStep(c, dt) {
    const u = c.u;
    c.t += dt;
    const k = Math.min(1, c.t / c.T);
    if (!u.alive) { u.root.remove(c.grp); return true; }
    u.root.position.y = u.pos.y + c.H * (1 - k);
    c.grp.rotation.y = Math.sin(c.t * 1.7) * 0.25;
    c.grp.rotation.z = Math.sin(c.t * 1.1) * 0.08;
    if (k >= 1) {
      u.root.remove(c.grp);
      c.grp.children.forEach((m) => m.material?.dispose?.());
      if (u.dropping) { u.dropping = false; u.immobilized = c.imm; u.holdFire = c.hold; }
      u.place(0);
      return true;
    }
    return false;
  }
  heliInsert(p, x, z, o = {}) {
    const g = this.g;
    const era = o.era;
    const heli = o.heli && UNIT_TYPES[o.heli] ? o.heli : era === 'afghan' ? (p.team === 'UA' ? 'af_bw_ch53' : 'af_sa_mi8') : (p.team === 'UA' ? 'm_mi8' : 'm_mi8ru');
    if (!UNIT_TYPES[heli]) return false;
    const inf = o.unit && UNIT_TYPES[o.unit] ? o.unit : era === 'afghan' ? (p.team === 'UA' ? 'af_bw_rifle' : 'af_sa_rifle') : (p.team === 'UA' ? 'rifle' : 'e_rifle');
    const edge = g.mission?.friendlyEdges?.[p.team] || (p.team === 'UA' && g.mission?.friendlyEdge) || [0, (p.team === 'UA' ? 1 : -1) * (g.terrain.half - 8)];
    const half = g.terrain.half - 6;
    const sx = Math.max(-half, Math.min(half, edge[0] + rand(-15, 15))), sz = Math.max(-half, Math.min(half, edge[1]));
    const h = g.spawn(heli, p.team, sx, sz, { owner: p.id, heading: Math.atan2(x - sx, z - sz), startAlt: 18 });
    h.insertion = { home: [sx, sz] };
    g.trans.loadNew(h, [[UNIT_TYPES[inf] ? inf : 'rifle', Math.min(o.n || SUP.heliPax, g.trans.capacity(h) || SUP.heliPax)]]);
    h.moveTo(x, z);
    h.unloadAt = { x, z };
    const onOut = (v) => {
      if (v !== h) return;
      g.off('disembark', onOut);
      g.later(2.5, () => { if (!h.alive) return; g.trans.takeoff(h); h.moveTo(h.insertion.home[0], h.insertion.home[1]); h.returning = g.time; });
    };
    g.on('disembark', onOut);
    g.sayTo(p.id, 'Luftlande', `${h.name} mit ${h.cargo?.length || 0} Mann im Anflug – Landezone markiert.`, 3);
    g.markerTo(p.team, x, z, 0xffd500, 14, 12);
    this.stats.drops++; this.stats.helis++;
    return true;
  }

  // ======================= Gegenbatterie =======================
  onArtilleryFire(shooter, w) {
    const g = this.g;
    const now = g.time;
    if (!shooter) {
      // Feuer von außerhalb der Karte (Fähigkeit): nur Meldung an Teams mit Radar
      return;
    }
    if (!shooter.alive || shooter.side === 'N' || (shooter._cbT ?? -99) > now - SUP.cooldown) return;
    shooter._cbT = now;
    const E = other(shooter.side);
    let det = null;
    for (const u of g.units) {
      if (!u.alive || u.side !== E) continue;
      const t = u.type;
      const R = t.cbRadar ? t.cbRadar.range : t.era === 'ww2' && t.infantry && (t.observer || t.officer) ? SUP.soundRange : 0;
      if (!R) continue;
      if (Math.hypot(u.pos.x - shooter.pos.x, u.pos.z - shooter.pos.z) <= R) { det = u; break; }
    }
    if (!det) return;
    this.stats.cbDetections++;
    const x = shooter.pos.x, z = shooter.pos.z;
    g.addReveal(x, z, 12, SUP.reveal, E);
    shooter.seenBy[E] = true;
    g.visionT = 0;
    g.markerTo(E, x, z, 0xff5030, 8, 9);
    if ((this.msgT[E] ?? -99) < now - 6) { this.msgT[E] = now; g.alertTo(E, det.type.cbRadar ? '📡 Gegenbatterie-Radar: feindliche Feuerstellung geortet!' : '👂 Schallmessung: feindliche Batterie geortet!', 3); }
    g.emit('counterBattery', shooter, det);
    // Eigene Artillerie in Reichweite schießt zurück
    for (const a of g.units) {
      if (!a.alive || a.side !== E || a.cbOff || a.moving || a.abandoned || a.towedBy || a.limberT > 0) continue;
      if (a.order?.type === 'attack' && a.order.target?.alive && !a.order.cb) continue; // Spielerziel hat Vorrang
      const ws = a.weapons.find((q) => q.def.kind === 'artillery' && q.stock >= 1);
      if (!ws) continue;
      const d = Math.hypot(a.pos.x - x, a.pos.z - z);
      if (d > ws.def.range * a.rangeMul() || (ws.def.minRange && d < ws.def.minRange)) continue;
      a.attack(shooter);
      if (a.order) a.order.cb = true;
      this.stats.cbReturns++;
    }
  }

  // ======================= Hauptschleife =======================
  update(dt) {
    for (let i = this.chutes.length - 1; i >= 0; i--) if (this._chuteStep(this.chutes[i], dt)) this.chutes.splice(i, 1);
    // Rückflug: Hubschrauber am Rand entfernen
    const g = this.g;
    for (const u of g.units) {
      if (!u.alive || !u.insertion || !u.returning || u.cargo?.length || u.landed || u.landing) continue;
      const [hx, hz] = u.insertion.home;
      if (Math.hypot(u.pos.x - hx, u.pos.z - hz) < 12 || g.time - u.returning > 45) { u.alive = false; g.scene.remove(u.root); g.removeUnit(u); } // ohne Abschusswertung
    }
  }
}
