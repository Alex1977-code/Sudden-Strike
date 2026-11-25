// Gebäude-Besetzung (MP-T4c). Kommandos: {t:'garrison', ids, target: Haus-id} · {t:'ungarrison', ids} (ids = Insassen oder Häuser)
// Zustand (einfache Felder): Haus.occupants = [Unit], Haus.garrisonSide, Haus.revealT; Insasse.garrison = Haus, Insasse.garrisonGoal = Haus (unterwegs).
import * as THREE from 'three';

export const GAR = {
  hitMul: 0.25,        // Schadensfaktor für Insassen
  accMul: 0.5,         // Trefferchance gegen Insassen
  enterDist: 4,        // Abstand zur Hauskante zum Betreten (MP-T5: 2,5 → 4, Trupps blieben an kleinen Häusern hängen)
  revealFor: 5,        // s, die ein feuerndes Haus als besetzt erkannt wird
  fleeHp: 0.5,         // Anteil Lebenspunkte der Flüchtenden
};

// Denkmäler/Anlagen ohne begehbares Inneres (V3-LM): nicht besetzbar
export const NO_GARRISON = new Set(['siegessaeule', 'obelisk', 'mig17_monument', 'barmaley_fountain', 'factory_chimney', 'chimney_modern', 'cooling_tower', 'water_tanks', 'water_tower', 'headframe', 'panzerkuppel', 'avalanche_gallery', 'tunnel_portal', 'salang_portal', 'brandenburger_tor', 'brandenburger_tor_s']);
export const canGarrison = (h) => !NO_GARRISON.has(h?.houseDef?.kind || h?.houseKind || '');
export const houseCap = (h) => Math.max(4, Math.min(12, Math.round(h.w * h.d * h.floors / 14) + 2));
export const floorsOf = (house) => house.houseDef?.floors || 1;
// Ist die Feindbesatzung eines Hauses für `team` aufgeklärt? (feuert gerade / wurde am Haus entdeckt) – MP-T7
export const knownHostile = (g, h, team) => !!(h.occupants?.length && h.garrisonSide !== team && g.time - (h.revealT ?? -99) < GAR.revealFor);

export class Garrison {
  constructor(game) { this.g = game; this.pending = []; this.badges = new Map(); }

  command(p, cmd, units) {
    const g = this.g;
    if (cmd.t === 'garrison') {
      const h = g.unitById(cmd.target);
      if (!h || !h.alive || h.type.key !== 'house' || !canGarrison(h)) return false;
      const inf = units.filter((u) => u.type.infantry && !u.type.kamikaze && !u.abandoned);
      if (!inf.length) return false;
      // MP-T7 (Anti-Info-Leck): Eine nicht aufgeklärte Feindbesatzung wird wie ein leeres Haus behandelt – der Befehl wird
      // angenommen, die Trupps laufen hin und entdecken die Besatzung erst am Haus (update). Nur eine bereits erkannte
      // (feuernde) Feindbesatzung lehnt den Befehl ab; die kennt das Team ohnehin. Platz zählt nur eigene Insassen/Anmärsche.
      const hostile = h.occupants?.length && h.garrisonSide !== p.team;
      if (hostile && knownHostile(g, h, p.team)) return false;
      const ownIn = hostile ? 0 : (h.occupants?.length || 0);
      const room = houseCap(h.houseDef) - ownIn - this.pending.filter((e) => e.house === h && e.u.side === p.team).length;
      if (room <= 0) return false;
      let n = 0;
      for (const u of inf) {
        if (n >= room) break;
        if (u.garrison === h) continue;
        if (u.garrison) this.leave(u);
        u.job = null; u.garrisonGoal = h;
        const a = Math.atan2(u.pos.x - h.pos.x, u.pos.z - h.pos.z);
        const rr = Math.max(h.houseDef.w, h.houseDef.d) / 2 + 1;
        u.moveTo(h.pos.x + Math.sin(a) * rr, h.pos.z + Math.cos(a) * rr);
        u.garrisonGoal = h; // moveTo löscht keine Ziele, aber sicher ist sicher
        this.pending.push({ u, house: h });
        n++;
      }
      return n > 0;
    }
    // ungarrison: ids dürfen Insassen oder Häuser sein
    let n = 0;
    for (const u of units) if (u.garrison) { this.leave(u); n++; } else if (u.garrisonGoal) { u.garrisonGoal = null; u.stop(); n++; }
    for (const id of cmd.ids || []) {
      const h = g.unitById(id);
      if (h && h.type.key === 'house' && h.occupants?.length && h.garrisonSide === p.team) for (const u of [...h.occupants]) if (u.owner === p.id) { this.leave(u); n++; }
    }
    return n > 0;
  }

  update(dt) {
    const g = this.g;
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const e = this.pending[i], u = e.u, h = e.house;
      if (!u.alive || !h.alive || u.garrisonGoal !== h) { if (u.garrisonGoal === h) u.garrisonGoal = null; this.pending.splice(i, 1); continue; }
      const hd = h.houseDef, reach = Math.max(hd.w, hd.d) / 2 + GAR.enterDist;
      if (Math.hypot(u.pos.x - h.pos.x, u.pos.z - h.pos.z) <= reach) {
        this.pending.splice(i, 1);
        if ((h.occupants?.length || 0) < houseCap(hd) && (!h.occupants?.length || h.garrisonSide === u.side)) this.enter(u, h);
        else {
          u.garrisonGoal = null;
          // Am Haus auf Feindbesatzung gestoßen (MP-T7): jetzt aufgeklärt, Meldung an den Besitzer des Trupps
          if (h.occupants?.length && h.garrisonSide !== u.side) {
            h.revealT = g.time;
            if (u.owner !== null && (h._contactT?.[u.side] ?? -99) < g.time - 5) { (h._contactT ||= {})[u.side] = g.time; g.alertTo(u.owner, '⚠ Gebäude ist feindlich besetzt!', 3); }
          }
        }
      } else if (!u.order && !u.path?.length) { u.garrisonGoal = null; this.pending.splice(i, 1); } // Weg blockiert
    }
    // Abzeichen nur für das Team der Besatzung
    const ls = g.localSide;
    for (const [h, b] of this.badges) b.visible = h.alive && h.garrisonSide === ls && h.occupants?.length > 0;
  }

  enter(u, h) {
    (h.occupants ||= []).push(u);
    h.garrisonSide = u.side;
    u.garrison = h; u.garrisonGoal = null;
    u.order = null; u.path = null; u.moving = false; u.job = null;
    u.pos.x = h.pos.x; u.pos.z = h.pos.z;
    u.root.visible = false;
    for (const w of u.weapons) w.target = null;
    this.updateBadge(h);
    this.g.emit('garrison', h);
    this.g.emit('selection');
  }
  leave(u, hpMul = 1) {
    const h = u.garrison;
    if (!h) return;
    const i = h.occupants.indexOf(u);
    if (i >= 0) h.occupants.splice(i, 1);
    u.garrison = null;
    const hd = h.houseDef, a = (u.id * 2.399) % (Math.PI * 2);
    const rr = Math.max(hd.w, hd.d) / 2 + 2.2;
    u.pos.x = h.pos.x + Math.sin(a) * rr; u.pos.z = h.pos.z + Math.cos(a) * rr;
    const k = this.g.terrain.cellIndex(u.pos.x, u.pos.z);
    if (k < 0 || !this.g.pathfinder.passable(k, 'ground', false)) { u.pos.x = h.pos.x + Math.sin(a + 3) * (rr + 2); u.pos.z = h.pos.z + Math.cos(a + 3) * (rr + 2); }
    if (hpMul < 1) u.hp = Math.max(1, u.hp * hpMul);
    u.root.visible = true;
    u.place(0);
    if (h.alive) { this.updateBadge(h); this.g.emit('garrison', h); }
    this.g.emit('selection');
  }
  // Aus game.removeUnit: Insasse stirbt/verschwindet bzw. Haus zerstört
  onRemove(u) {
    if (u.garrison && u.garrison.occupants) { const h = u.garrison; const i = h.occupants.indexOf(u); if (i >= 0) h.occupants.splice(i, 1); u.garrison = null; this.updateBadge(h); }
    if (u.type.key === 'house' && u.occupants?.length) this.onHouseGone(u);
    const b = this.badges.get(u);
    if (b && u.type.key === 'house') { u.root.remove(b); this.badges.delete(u); }
  }
  // Zerstörung: etwa die Hälfte der Insassen stirbt, der Rest flüchtet verwundet
  onHouseGone(h) {
    const list = [...h.occupants];
    for (const u of list) {
      if (!u.alive) continue;
      if (Math.random() < 0.5) { this.leave(u); this.g.killUnit(u, null, true); }
      else this.leave(u, GAR.fleeHp);
    }
    h.occupants = [];
    this.g.stats && (this.stats.destroyed = (this.stats.destroyed || 0) + list.length);
  }
  get stats() { return this._st || (this._st = {}); }

  // Treffer auf ein besetztes Haus: Insassen leiden mit (Fenstertreffer bzw. Explosionswirkung)
  onHouseHit(h, dmg, w, src) {
    const list = h.occupants;
    if (!list?.length) return;
    const soft = w.vs?.soft ?? 0.3;
    // V3-R: Insassen stehen rechnerisch alle in der Hausmitte – Splash trifft sie deshalb NICHT einzeln (game.splashDamage
    // überspringt sie), sondern nur über das Haus: je Treffer höchstens ein Insasse (Kugel durchs Fenster bzw. Splitter/Einsturz).
    const u = list[Math.floor(Math.random() * list.length)];
    if (w.kind === 'bullet') this.hurt(u, dmg * soft * 0.12, src);
    else this.hurt(u, dmg * Math.max(0.3, soft) * 0.3, src);
  }
  hurt(u, amount, src) {
    if (!u.alive) return;
    u.hp -= amount; u.lastHit = this.g.time;
    if (u.hp <= 0) this.g.killUnit(u, src && src.side ? src : null, true);
  }

  // ---- Abzeichen: Fahne + Insassenzahl ----
  updateBadge(h) {
    if (!h.alive) return;
    let b = this.badges.get(h);
    const n = h.occupants?.length || 0;
    if (!b) {
      b = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3, 5), new THREE.MeshBasicMaterial({ color: 0x333333 }));
      pole.position.y = 1.5; b.add(pole);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
      flag.position.set(0.75, 2.5, 0); b.add(flag); b.userData.flag = flag;
      const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
      const tex = new THREE.CanvasTexture(cv);
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
      spr.scale.set(2.4, 2.4, 1); spr.position.y = 4.6; spr.renderOrder = 8; b.add(spr);
      b.userData.cv = cv; b.userData.tex = tex;
      b.position.set(0, floorsOf(h) * 3 + 1.2, 0);
      b.traverse((o) => { o.raycast = () => {}; });
      h.root.add(b);
      this.badges.set(h, b);
    }
    b.userData.flag.material.color.set(h.garrisonSide === 'RU' ? 0xe5484d : 0x2f7de1);
    const c = b.userData.cv.getContext('2d');
    c.clearRect(0, 0, 64, 64);
    c.fillStyle = 'rgba(0,0,0,0.65)'; c.beginPath(); c.arc(32, 32, 26, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.font = 'bold 36px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(String(n), 32, 34);
    b.userData.tex.needsUpdate = true;
    b.visible = n > 0 && h.garrisonSide === this.g.localSide;
  }
}
