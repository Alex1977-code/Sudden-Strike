// V3-M2: Befehle wie im Original Sudden Strike – Befehlsketten, Haltungen, Rückzug, Formationen, Wegpunktlinie.
//
// Kommandos (über game.command validiert, serialisierbar):
//   jedes Einheiten-Kommando mit queue:true (Shift+Rechtsklick) wird an die Befehlskette der Einheit angehängt
//     (move, attack, garrison, embark, unload, hitch, unhitch, build, clearmines, pickmines, demolish, blowbridge,
//      buildbridge, grenade, smoke, dig, crew). Ohne queue ersetzt ein Befehl die Kette.
//   {t:'stance', ids, fire:'free'|'return'|'hold', move:'free'|'hold'|'pursue', pose:'stand'|'prone', cb:true|false}
//   {t:'retreat', ids}         – schnell zurück zum nächsten eigenen Sammelpunkt/Startzone, ignoriert Feuer
//   {t:'formation', value:'block'|'line'|'wedge'|'column'} – Formation des Spielers für Gruppenbewegungen
//     (move-Kommandos dürfen zusätzlich formation:… tragen)
// Zustände je Einheit (einfache Felder, snapshot-tauglich): u.queue [cmd…], u.fireMode, u.holdFire (= fireMode 'hold'),
//   u.moveMode, u.prone, u.retreat {x,z}, u.cbOff (kein automatisches Gegenbatteriefeuer), u.anchor [x,z].
// Sammelpunkte: mission.rally?.[team] ([x,z] oder [[x,z],…]), sonst Gefechts-Startzone (player.spawn), sonst
//   Schwerpunkt des Teams beim Missionsstart (game.orders.startZone[team]).
import * as THREE from 'three';

export const ORD = {
  tick: 0.25,
  queueMax: 16,
  pursueLeash: 28,       // m vom Ankerpunkt, die „Verfolgen begrenzt“ höchstens nachsetzt
  returnFireT: 6,        // s: Feuer erwidern nur auf Schützen, die so kürzlich gefeuert haben (oder wenn selbst getroffen)
  retreatSpeed: 1.3,     // Tempofaktor beim Rückzug (Niederhalten/Verwundung zählen nicht)
  prone: { speed: 0.45, hit: 0.7, conceal: 0.8 },
  formations: ['block', 'line', 'wedge', 'column'],
  queueable: new Set(['move', 'attack', 'garrison', 'embark', 'unload', 'hitch', 'unhitch', 'build', 'clearmines', 'pickmines', 'demolish', 'blowbridge', 'buildbridge', 'grenade', 'smoke', 'dig', 'crew']),
};
export const FORMATION_NAMES = { block: 'Block', line: 'Reihe', wedge: 'Keil', column: 'Kolonne' };
export const FIRE_NAMES = { free: 'Feuer frei', return: 'Feuer erwidern', hold: 'Feuer halten' };
export const MOVE_NAMES = { free: 'Frei', hold: 'Stellung halten', pursue: 'Verfolgen (begrenzt)' };

const fin = (v) => typeof v === 'number' && Number.isFinite(v);
const d2 = (ax, az, bx, bz) => (ax - bx) * (ax - bx) + (az - bz) * (az - bz);
// Abstand je Einheit in der Formation nach Einheitengröße
export const slotSpacing = (u) => (u.type.naval ? Math.max(9, u.radius * 2.4) : u.type.air ? 6 : u.type.vehicle ? Math.max(6.5, u.radius * 2.5) : Math.max(2.6, u.radius * 3.4));

export class Orders {
  constructor(game) {
    this.g = game;
    this.acc = 0;
    this.startZone = null;
    this.stats = { queued: 0, executed: 0, retreats: 0, pursuits: 0 };
    this.line = null;
  }

  // ================= Formation =================
  // Zielpunkte je Einheit: kind block (bisherige Aufstellung) · line (Reihe quer) · wedge (Keil) · column (Kolonne).
  // Fahrzeuge zuerst (vorn), Abstände nach Einheitengröße. from: [cx, cz] Ausgangsschwerpunkt.
  slots(units, x, z, kind = 'block', from = null) {
    const n = units.length;
    if (!n) return [];
    const cx = from ? from[0] : units.reduce((s, u) => s + u.pos.x, 0) / n, cz = from ? from[1] : units.reduce((s, u) => s + u.pos.z, 0) / n;
    let dir = Math.atan2(x - cx, z - cz);
    if (!Number.isFinite(dir) || (Math.abs(x - cx) + Math.abs(z - cz)) < 0.5) dir = 0;
    const sorted = [...units].sort((a, b) => (a.type.vehicle ? 0 : 1) - (b.type.vehicle ? 0 : 1) || b.radius - a.radius);
    const c = Math.cos(dir), s = Math.sin(dir);
    const out = [];
    const put = (u, ox, oz) => out.push([u, x + ox * c + oz * s, z - ox * s + oz * c]);
    if (n === 1) { out.push([sorted[0], x, z]); return out; }
    if (kind === 'line') {
      const sp = sorted.map(slotSpacing), W = sp.reduce((a, b) => a + b, 0) - sp[0] / 2 - sp[n - 1] / 2;
      let o = -W / 2;
      sorted.forEach((u, i) => { if (i) o += (sp[i - 1] + sp[i]) / 2; put(u, o, 0); });
    } else if (kind === 'wedge') {
      let back = 0, prevSp = slotSpacing(sorted[0]);
      put(sorted[0], 0, 0);
      for (let i = 1; i < n; i++) {
        const k = Math.ceil(i / 2), sp = Math.max(prevSp, slotSpacing(sorted[i]));
        if (i % 2 === 1) back = k * sp * 0.85;
        put(sorted[i], (i % 2 ? -1 : 1) * k * sp * 0.8, -back);
        if (i % 2 === 0) prevSp = slotSpacing(sorted[i]);
      }
    } else if (kind === 'column') {
      let o = 0;
      sorted.forEach((u, i) => { if (i) o += (slotSpacing(sorted[i - 1]) + slotSpacing(u)) / 2; put(u, 0, -o); });
    } else {
      const cols = Math.ceil(Math.sqrt(n * 2));
      sorted.forEach((u, i) => {
        const r = Math.floor(i / cols), cc = i % cols;
        const sp = u.type.vehicle || u.type.naval ? 8 : u.type.air ? 6 : 3;
        put(u, (cc - (Math.min(cols, n - r * cols) - 1) / 2) * sp, -r * sp);
      });
    }
    // Zielpunkte auf befahrbares Gelände ziehen
    const T = this.g.terrain, pf = this.g.pathfinder;
    for (const e of out) {
      const k = T.cellIndex(e[1], e[2]);
      if (k >= 0 && pf.passable(k, e[0].type.naval ? 'water' : 'ground', !!e[0].type.vehicle)) continue;
      if (e[0].type.air) continue;
      e[1] = x + (e[1] - x) * 0.5; e[2] = z + (e[2] - z) * 0.5;
    }
    return out;
  }
  formationOf(playerId) { return this.g.playerById(playerId)?.formation || 'block'; }

  // ================= Kommandos =================
  // Liefert undefined, wenn das Kommando nicht hierher gehört
  command(p, cmd, units) {
    const g = this.g;
    switch (cmd.t) {
      case 'stance': {
        const sel = units.filter((u) => !u.type.structure || u.weapons.length);
        if (!sel.length) return false;
        let n = 0;
        for (const u of sel) {
          if (cmd.fire === 'free' || cmd.fire === 'return' || cmd.fire === 'hold') { u.fireMode = cmd.fire; u.holdFire = cmd.fire === 'hold'; if (cmd.fire !== 'hold' && u.ambush?.on && cmd.fire === 'free') u.ambush.on = false; n++; }
          if (cmd.move === 'free' || cmd.move === 'hold' || cmd.move === 'pursue') { u.moveMode = cmd.move === 'free' ? null : cmd.move; u.anchor = [u.pos.x, u.pos.z]; n++; }
          if ((cmd.pose === 'prone' || cmd.pose === 'stand') && u.type.infantry && !u.type.kamikaze) { u.prone = cmd.pose === 'prone'; n++; }
          if (typeof cmd.cb === 'boolean') { u.cbOff = !cmd.cb; n++; }
        }
        return n > 0;
      }
      case 'retreat': {
        const sel = units.filter((u) => !u.type.structure && u.speed > 0 && !u.type.rail);
        if (!sel.length) return false;
        const pts = this.rallyPoints(p.team, p.id);
        for (const u of sel) {
          let best = pts[0], bd = Infinity;
          for (const q of pts) { const d = d2(q[0], q[1], u.pos.x, u.pos.z); if (d < bd) { bd = d; best = q; } }
          if (!best) continue;
          if (u.garrison) g.gar.leave(u);
          u.queue = null; u.throwOrder = null; u.garrisonGoal = null; u.job = null; u.embarkGoal = null;
          if (u.ambush?.on) u.ambush.on = false;
          // Leichte Streuung am Sammelpunkt
          const a = (u.id * 2.399) % (Math.PI * 2), r = u.type.vehicle ? 6 + (u.id % 3) * 4 : 2 + (u.id % 4) * 1.5;
          const x = best[0] + Math.sin(a) * r, z = best[1] + Math.cos(a) * r;
          u.retreat = { x, z };
          u.moveTo(x, z);
          for (const ws of u.weapons) ws.target = null;
          this.stats.retreats++;
        }
        if (p.id === g.localPlayerId) g.effects.marker(best0(pts)[0], best0(pts)[1], 0x9ec5ff, 1.2, 4);
        return true;
      }
      case 'formation': {
        if (!ORD.formations.includes(cmd.value)) return false;
        p.formation = cmd.value;
        if (p.id === g.localPlayerId) g.emit('formation', cmd.value);
        return true;
      }
    }
    return undefined;
  }
  rallyPoints(team, playerId) {
    const g = this.g, m = g.mission, out = [];
    const r = m?.rally?.[team];
    if (Array.isArray(r) && r.length) { if (fin(r[0])) out.push(r); else for (const q of r) if (Array.isArray(q)) out.push(q); }
    if (!out.length) {
      const own = g.playerById(playerId);
      if (own?.spawn) out.push([own.spawn.x, own.spawn.z]);
      for (const q of g.playersOfTeam(team)) if (q.spawn && q !== own) out.push([q.spawn.x, q.spawn.z]);
    }
    // eigene gehaltene Eroberungspunkte (Gefecht)
    const sk = m?.skirmish;
    if (sk) for (const cp of sk.points) if (cp.owner === team) out.push([cp.x, cp.z]);
    if (!out.length && this.startZone?.[team]) out.push(this.startZone[team]);
    if (!out.length) out.push([0, (team === 'UA' ? 1 : -1) * (g.terrain.half - 25)]);
    return out;
  }

  // ---------------- Befehlskette ----------------
  // Einheiten-Kommando mit queue:true: freie Einheiten führen sofort aus, beschäftigte hängen an
  enqueue(p, cmd, units) {
    const g = this.g;
    if (!ORD.queueable.has(cmd.t) || !units.length) return false;
    const now = [], later = [];
    for (const u of units) ((this.idle(u) && !u.queue?.length) ? now : later).push(u);
    // Bewegung: Formationsplätze aus dem geplanten Endpunkt der Kette
    let per = null;
    if (cmd.t === 'move' && fin(cmd.x) && fin(cmd.z) && units.length > 1) {
      const ends = units.map((u) => this.planEnd(u));
      const cx = ends.reduce((s, e) => s + e[0], 0) / ends.length, cz = ends.reduce((s, e) => s + e[1], 0) / ends.length;
      per = new Map(this.slots(units.filter((u) => !u.type.structure), cmd.x, cmd.z, cmd.formation || this.formationOf(p.id), [cx, cz]).map(([u, x, z]) => [u.id, [x, z]]));
    }
    const mk = (u) => {
      const c = { ...cmd, ids: [u.id], queue: undefined, fromQueue: true };
      if (per && per.has(u.id)) { [c.x, c.z] = per.get(u.id); c.formation = 'block'; }
      return c;
    };
    let ok = false;
    if (now.length) {
      if (per) { for (const u of now) ok = g.command(p.id, mk(u)) || ok; }
      else ok = g.command(p.id, { ...cmd, ids: now.map((u) => u.id), queue: undefined, fromQueue: true }) || ok;
    }
    for (const u of later) {
      if (!u.queue) u.queue = [];
      if (u.queue.length >= ORD.queueMax) continue;
      u.queue.push(mk(u));
      ok = true;
      this.stats.queued++;
    }
    if (ok && p.id === g.localPlayerId && fin(cmd.x) && fin(cmd.z)) g.effects.marker(cmd.x, cmd.z, 0xc8ff5d, 0.8, 1.6);
    return ok;
  }
  // Geplanter Endpunkt einer Einheit (letzter Kettenbefehl mit Ort, sonst aktuelles Ziel, sonst Position)
  planEnd(u) {
    const q = u.queue;
    if (q) for (let i = q.length - 1; i >= 0; i--) { const p = this.cmdPos(q[i]); if (p) return p; }
    const o = u.order;
    if (o && (o.type === 'move' || o.type === 'attackMove')) return [o.x, o.z];
    return [u.pos.x, u.pos.z];
  }
  cmdPos(c) {
    if (fin(c.x) && fin(c.z)) return [c.x, c.z];
    if (c.target !== undefined && c.target !== null) {
      if (c.t === 'blowbridge' || c.t === 'buildbridge') { const b = this.g.mapobj?.bridgeById(c.target); return b ? [b.cx, b.cz] : null; }
      const t = this.g.unitById(c.target);
      if (t && t.alive) return [t.pos.x, t.pos.z];
    }
    return null;
  }
  idle(u) {
    if (u.panicT > 0 || u.limberT > 0) return false;
    if (u.job || u.garrisonGoal || u.throwOrder || u.embarkGoal || u.unloadAt || u.hitchGoal || u.bridgeJob) return false;
    if (u.order && !(u.order.type === 'attack' && (!u.order.target || !u.order.target.alive))) return false;
    if (u.path && u.path.length) return false;
    if (u.type.air && u.landing) return false;
    return true;
  }

  // ================= Hauptschleife (Host) =================
  update(dt) {
    const g = this.g;
    if (!this.startZone && g.time > 0.5) {
      this.startZone = {};
      for (const t of ['UA', 'RU']) {
        const l = g.units.filter((u) => u.alive && u.side === t && !u.type.structure);
        if (l.length) this.startZone[t] = [l.reduce((s, u) => s + u.pos.x, 0) / l.length, l.reduce((s, u) => s + u.pos.z, 0) / l.length];
      }
    }
    this.acc += dt;
    if (this.acc < ORD.tick) return;
    this.acc = 0;
    for (const u of [...g.units]) {
      if (!u.alive || u.type.structure || u.side === 'N') continue;
      if (u.retreat) this._retreatStep(u);
      if (u.queue?.length && this.idle(u)) this._next(u);
      else if (u.moveMode === 'pursue') this._pursue(u);
      if (u.moveMode && !u.anchor) u.anchor = [u.pos.x, u.pos.z];
    }
  }
  _next(u) {
    const g = this.g;
    for (let guard = 0; guard < 4 && u.queue?.length; guard++) {
      const c = u.queue.shift();
      const ok = g.command(u.owner, c);
      this.stats.executed++;
      if (ok) { if (u.moveMode) u.anchor = this.cmdPos(c) || [u.pos.x, u.pos.z]; break; }
    }
    if (u.queue && !u.queue.length) u.queue = null;
  }
  _retreatStep(u) {
    const r = u.retreat;
    if (d2(u.pos.x, u.pos.z, r.x, r.z) < (u.type.vehicle ? 7 * 7 : 3.5 * 3.5) || (!u.order && !u.path?.length)) {
      u.retreat = null;
      if (u.moveMode) u.anchor = [u.pos.x, u.pos.z];
    } else if (!u.order && u.speed > 0) u.moveTo(r.x, r.z);
  }
  // Verfolgen (begrenzt): sichtbare Feinde außerhalb der Waffenreichweite bis ORD.pursueLeash m vom Anker verfolgen
  _pursue(u) {
    const g = this.g;
    if (u.retreat || u.garrison || u.job || u.queue?.length) return;
    const a = u.anchor || (u.anchor = [u.pos.x, u.pos.z]);
    const far = d2(u.pos.x, u.pos.z, a[0], a[1]) > ORD.pursueLeash * ORD.pursueLeash;
    const o = u.order;
    if (o?.type === 'attack' && o.pursuit) {
      if (far || !o.target?.alive || !o.target.visibleTo(u.side)) { u.moveTo(a[0], a[1]); if (u.order) u.order.pursuitReturn = true; }
      return;
    }
    if (o || (u.path && u.path.length)) return;
    let best = null, bd = Infinity;
    const sight = g.sightOf(u);
    for (const e of g.units) {
      if (!e.alive || e.side === u.side || e.side === 'N' || e.type.structure || e.garrison || !e.visibleTo(u.side)) continue;
      const d = Math.hypot(e.pos.x - u.pos.x, e.pos.z - u.pos.z);
      if (d > sight || d >= bd) continue;
      if (Math.hypot(e.pos.x - a[0], e.pos.z - a[1]) > ORD.pursueLeash + 45) continue;
      const w = u.bestWeaponFor(e);
      if (!w || u.inRange(w.def, e)) continue; // in Reichweite: einfach schießen
      best = e; bd = d;
    }
    if (best) { u.attack(best); u.order.pursuit = true; this.stats.pursuits++; }
    else if (d2(u.pos.x, u.pos.z, a[0], a[1]) > 9) u.moveTo(a[0], a[1]);
  }
  // Rückzug/Haltung für Tempo und Zielwahl (unit.js, tactics.js)
  mayTarget(s, t) {
    if (s.fireMode !== 'return') return true;
    const now = this.g.time;
    return (t.lastFired && now - t.lastFired < ORD.returnFireT) || now - s.lastHit < ORD.returnFireT;
  }

  // ================= Darstellung: Wegpunktlinie (Host und Client) =================
  // Wegpunkte einer Einheit: [[x, z, art], …] art: m Bewegung, a Angriffsbewegung, x Angriff, s Sonderbefehl
  waypoints(u) {
    if (u.remote) return u.netWp || [];
    const out = [];
    const o = u.order;
    if (u.retreat) out.push([u.retreat.x, u.retreat.z, 'r']);
    else if (o && (o.type === 'move' || o.type === 'attackMove')) out.push([o.x, o.z, o.type === 'move' ? 'm' : 'a']);
    else if (o?.type === 'attack' && o.target?.alive) out.push([o.target.pos.x, o.target.pos.z, 'x']);
    const goal = u.embarkGoal || u.garrisonGoal || u.hitchGoal;
    if (goal?.alive) out.push([goal.pos.x, goal.pos.z, 's']);
    if (u.unloadAt) out.push([u.unloadAt.x, u.unloadAt.z, 's']);
    if (u.job?.target !== undefined) { const t = this.g.unitById(u.job.target); if (t) out.push([t.pos.x, t.pos.z, 's']); }
    if (u.bridgeJob) { const b = this.g.mapobj?.bridgeById(u.bridgeJob.bridge); if (b) out.push([b.cx, b.cz, 's']); }
    for (const c of u.queue || []) { const p = this.cmdPos(c); if (p) out.push([p[0], p[1], c.t === 'move' ? (c.attackMove ? 'a' : 'm') : c.t === 'attack' ? 'x' : 's']); }
    return out;
  }
  // Kompakt für Snapshots (nur eigenes Team): [x, z, art, …] auf 0,5 m
  packWaypoints(u) {
    const w = this.waypoints(u);
    if (!w.length) return null;
    const K = { m: 0, a: 1, x: 2, s: 3, r: 4 };
    const out = [];
    for (const [x, z, k] of w.slice(0, ORD.queueMax + 2)) out.push(Math.round(x * 2) / 2, Math.round(z * 2) / 2, K[k] ?? 3);
    return out;
  }
  unpackWaypoints(u, arr) {
    const K = ['m', 'a', 'x', 's', 'r'];
    const out = [];
    if (Array.isArray(arr)) for (let i = 0; i + 2 < arr.length; i += 3) out.push([arr[i], arr[i + 1], K[arr[i + 2]] || 's']);
    u.netWp = out;
  }
  updateVisual() {
    const g = this.g;
    if (!g.active || !g.terrain) return;
    const sel = g.selected.filter((u) => u.alive && g.isOwn(u));
    let L = this.line;
    if (!sel.length) { if (L) L.visible = false; return; }
    const MAXV = 4000;
    if (!L || L.parent !== g.scene) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAXV * 3), 3).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAXV * 3), 3).setUsage(THREE.DynamicDrawUsage));
      L = this.line = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, depthTest: false, depthWrite: false }));
      L.renderOrder = 6; L.frustumCulled = false; L.raycast = () => {};
      L.name = 'waypoints';
      g.scene.add(L);
    }
    const pos = L.geometry.attributes.position.array, col = L.geometry.attributes.color.array;
    let n = 0;
    const T = g.terrain;
    const COL = { m: [0.36, 1, 0.54], a: [1, 0.63, 0.19], x: [1, 0.3, 0.3], s: [1, 0.84, 0.2], r: [0.62, 0.77, 1] };
    const seg = (ax, az, bx, bz, c) => {
      if (n + 2 > MAXV) return;
      const ay = T.surface(ax, az) + 0.6, by = T.surface(bx, bz) + 0.6;
      pos[n * 3] = ax; pos[n * 3 + 1] = ay; pos[n * 3 + 2] = az; col[n * 3] = c[0]; col[n * 3 + 1] = c[1]; col[n * 3 + 2] = c[2]; n++;
      pos[n * 3] = bx; pos[n * 3 + 1] = by; pos[n * 3 + 2] = bz; col[n * 3] = c[0]; col[n * 3 + 1] = c[1]; col[n * 3 + 2] = c[2]; n++;
    };
    for (const u of sel.slice(0, 60)) {
      const wp = this.waypoints(u);
      if (!wp.length) continue;
      let px = u.pos.x, pz = u.pos.z;
      for (const [x, z, k] of wp) {
        const c = COL[k] || COL.s;
        // gestrichelt (Teilstücke)
        const L2 = Math.hypot(x - px, z - pz), steps = Math.min(40, Math.max(1, Math.floor(L2 / 3)));
        for (let i = 0; i < steps; i += 1) {
          if (i % 2) continue;
          const t0 = i / steps, t1 = Math.min(1, (i + 1) / steps);
          seg(px + (x - px) * t0, pz + (z - pz) * t0, px + (x - px) * t1, pz + (z - pz) * t1, c);
        }
        // Rautenmarke am Wegpunkt
        const r = 0.9;
        seg(x - r, z, x, z - r, c); seg(x, z - r, x + r, z, c); seg(x + r, z, x, z + r, c); seg(x, z + r, x - r, z, c);
        px = x; pz = z;
      }
    }
    L.geometry.setDrawRange(0, n);
    L.geometry.attributes.position.needsUpdate = true; L.geometry.attributes.color.needsUpdate = true;
    L.visible = n > 0;
  }
}
const best0 = (pts) => pts[0] || [0, 0];
