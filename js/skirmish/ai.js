// KI-Kommandeur für den Gefechtsmodus (MP-T4a).
// Steuert einen Spieler AUSSCHLIESSLICH über game.command(playerId, cmd) – läuft damit später unverändert auf dem Host.
// Liest nur, was das Team wissen darf: eigene Einheiten, für das Team aufgeklärte Feinde (visibleTo), öffentliche
// Punktdaten (Besitzer/Fortschritt) und den Countdown.
//
// Ablauf je Entscheidung (alle 2–4 s, gestaffelt): Rückzug beschädigter Einheiten → Gruppen bilden (Hauptgruppen,
// schnelle Raid-Gruppe, Besatzungen) → Ziele wählen (neutrale/feindliche Punkte erobern, bedrohte eigene verteidigen,
// Teamabsprache über TeamIntel.claims) → Countdown-Reaktion (gefährdete Punkte verstärken, unbewachte Punkte mit
// schnellen Einheiten „klauen") → Fähigkeit der Rolle auf sichtbare Gegnerballungen.

import { knownHostile } from '../game/garrison.js';
import { buildKindsFor } from '../game/logistics.js';
import { UNIT_TYPES } from '../game/unitTypes.js';
// V3-M2: Pioniere bauen das Baumenü ihrer Epoche/Fraktion (buildKindsFor) und nehmen feindliche Minen auf (pickmines) statt
// sie nur zu räumen; Besatzungen ohne Haus graben sich ein ({t:'dig'}); Fähigkeiten 'smoke' (Rauchwand vor der angreifenden
// Hauptgruppe) und 'airdrop' (Luftlandung auf schwach verteidigte Punkte). Transporte setzen automatisch ab (transport.js).

export const AI_LEVELS = {
  easy: { courage: 2.2, interval: 4.0, steals: 0, window: 0, abilityChance: 0.35, err: 14, clusterMin: 5, retreatHp: 0, reissue: 14 },
  normal: { courage: 1.6, interval: 3.0, steals: 1, window: 45, abilityChance: 0.7, err: 7, clusterMin: 4, retreatHp: 0.22, reissue: 10 },
  hard: { courage: 1.35, interval: 2.0, steals: 2, window: 55, abilityChance: 1.0, err: 2.5, clusterMin: 3, retreatHp: 0.3, reissue: 8 },
  veteran: { courage: 1.2, interval: 1.6, steals: 3, window: 60, abilityChance: 1.0, err: 1.5, clusterMin: 3, retreatHp: 0.35, reissue: 6 }, // V3-X
};
const other = (t) => (t === 'UA' ? 'RU' : 'UA');
const weightOf = (u) => (u.type.armor === 'heavy' ? 4 : u.type.vehicle ? 2 : 1);
const mainsFront = (groups) => groups.filter((q) => (q.kind === 'main' || q.kind === 'raid') && q.ids.size && q.cx !== undefined).sort((a, b) => b.ids.size - a.ids.size)[0];
const d2 = (ax, az, bx, bz) => (ax - bx) * (ax - bx) + (az - bz) * (az - bz);

// Team-Lagebild: aufgeklärte Feinde (gecacht) und Zielabsprache zwischen den KI-Spielern eines Teams
export class TeamIntel {
  constructor(game, team) { this.g = game; this.team = team; this.t = -1; this.enemies = []; this.claims = new Map(); }
  visibleEnemies() {
    const g = this.g;
    if (this.t === g.time) return this.enemies;
    if (g.time - this.t < 0.5 && this.t >= 0) return this.enemies;
    this.t = g.time;
    const out = [];
    for (const u of g.units) if (u.alive && u.side === other(this.team) && !u.type.structure && u.visibleTo(this.team)) out.push(u);
    this.enemies = out;
    return out;
  }
  setClaims(pid, ids) { this.claims.set(pid, ids); }
  claimCount(cpId, exceptPid) { let n = 0; for (const [pid, ids] of this.claims) if (pid !== exceptPid) for (const id of ids) if (id === cpId) n++; return n; }
}

export class AICommander {
  constructor(game, sk, player, { difficulty = 'normal', phase = 1 } = {}) {
    this.g = game; this.sk = sk; this.p = player;
    this.L = AI_LEVELS[difficulty] || AI_LEVELS.normal;
    this.t = phase;
    this.groups = [];
    this.assign = new Map(); // unitId → Gruppe
    this.retreat = new Set();
    this.stealers = new Map(); // unitId → { cp, cycle }
    this.stealCycle = -1;
    this.home = [player.spawn.x, player.spawn.z];
    this.stats = { thinks: 0, commands: 0, abilities: 0, steals: 0, retreats: 0, builds: 0, clears: 0, crews: 0, bailouts: 0, resupplies: 0, truckMoves: 0, repairMoves: 0, supplied: 0 };
    this.resup = new Map(); // unitId → { t0 } Einheiten auf dem Weg zum Nachschub
    this.orderT = new Map(); // unitId → Zeit des letzten Logistik-Befehls (Drosselung)
    this.gid = 0;
  }
  cmd(c) { const ok = this.g.command(this.p.id, c); if (ok) this.stats.commands++; return ok; }
  update(dt) {
    this.t -= dt;
    if (this.t > 0) return;
    this.t = this.L.interval * (0.85 + Math.random() * 0.3);
    if (this.p.defeated || this.g.ended) return;
    this.think();
  }

  think() {
    const g = this.g, p = this.p, team = p.team, sk = this.sk;
    this.stats.thinks++;
    const ground = [], air = [], arty = [], trucks = [], engineers = [], crews = [], observers = [];
    const alive = new Set();
    for (const u of g.units) {
      if (!u.alive || u.owner !== p.id || u.type.structure || u.type.kamikaze) continue;
      alive.add(u.id);
      if (u.type.air) air.push(u);
      else if (u.type.naval) continue;
      else if (u.bino) observers.push(u);
      else if (u.type.engineer) engineers.push(u);
      else if (u.type.key === 'ua_crew' || u.type.key === 'e_crew') crews.push(u);
      else if (u.type.key === 'himars' || u.weapons.some((w) => w.def.indirect)) arty.push(u);
      else if (u.supply || u.type.repair || !u.weapons.length) trucks.push(u);
      else ground.push(u);
    }
    // Aufräumen
    for (const gr of this.groups) for (const id of gr.ids) if (!alive.has(id)) gr.ids.delete(id);
    this.groups = this.groups.filter((gr) => gr.ids.size > 0 || gr.kind === 'main' && this.groups.filter((q) => q.kind === 'main').length === 1);
    for (const id of [...this.assign.keys()]) if (!alive.has(id)) this.assign.delete(id);
    for (const id of [...this.retreat]) if (!alive.has(id)) this.retreat.delete(id);
    for (const [id, s] of [...this.stealers]) if (!alive.has(id) || s.cycle !== sk.reinfCycle) this.stealers.delete(id);
    for (const id of [...this.resup.keys()]) if (!alive.has(id)) this.resup.delete(id);
    for (const id of [...this.orderT.keys()]) if (!alive.has(id)) this.orderT.delete(id); // MP-T6: tote ids nicht ansammeln
    const enemies = sk.intel[team].visibleEnemies();

    // 1) Rückzug stark beschädigter Einheiten
    if (this.L.retreatHp) {
      for (const u of ground) {
        if (this.retreat.has(u.id) || this.stealers.has(u.id)) continue;
        if (u.hp / u.maxHp < this.L.retreatHp && (u.type.vehicle || u.hp < 25)) {
          this.retreat.add(u.id);
          const gr = this.assign.get(u.id); if (gr) gr.ids.delete(u.id);
          this.assign.delete(u.id);
          this.stats.retreats++;
          this.cmd({ t: 'move', ids: [u.id], x: this.home[0] + (Math.random() - 0.5) * 16, z: this.home[1] + (team === 'UA' ? 8 : -8) });
        }
      }
    }
    if (g.logistics) this.resupplyCheck(ground);
    const active = ground.filter((u) => !this.retreat.has(u.id) && !this.stealers.has(u.id) && !this.resup.has(u.id) && !u.job);

    // 2) Gruppen
    this.organize(active);

    // 3) Ziele und Befehle der Gruppen
    const mains = this.groups.filter((gr) => gr.kind === 'main' || gr.kind === 'raid');
    const claims = [];
    for (const gr of this.groups) {
      const units = [...gr.ids].map((id) => g.unitById(id)).filter((u) => u && u.alive);
      if (!units.length) continue;
      gr.cx = units.reduce((s, u) => s + u.pos.x, 0) / units.length;
      gr.cz = units.reduce((s, u) => s + u.pos.z, 0) / units.length;
      if (gr.kind === 'garrison') { this.runGarrison(gr, units); continue; }
      gr.power = units.reduce((s, u) => s + weightOf(u) * (0.4 + 0.6 * u.hp / u.maxHp), 0);
      if (this.regroup(gr, units)) { this.drive(gr, units); continue; }
      if (this.checkFallback(gr, units, enemies)) { this.drive(gr, units); continue; }
      this.chooseTarget(gr, units, enemies);
      if (gr.target) claims.push(gr.target.id);
      this.drive(gr, units);
    }
    sk.intel[team].setClaims(p.id, claims);

    // 4) Unterstützungseinheiten
    this.runObservers(observers, mainsFront(this.groups), enemies);
    const lead = mains.filter((gr) => gr.ids.size).sort((a, b) => b.ids.size - a.ids.size)[0];
    this.supportUnits(arty, air, [], lead, enemies);
    if (g.logistics) this.logisticsUnits(trucks, engineers, crews, ground, lead, enemies);

    // 5) Countdown-Reaktion
    if (this.L.window && sk.reinfT < this.L.window) this.countdownReaction(ground, enemies);

    // 6) Fähigkeiten
    this.useAbilities(ground, enemies);
  }

  organize(active) {
    const fast = (u) => u.type.vehicle && u.type.armor === 'light' && u.speed >= 6.5 && u.weapons.length;
    let raid = this.groups.find((gr) => gr.kind === 'raid');
    const mains = () => this.groups.filter((gr) => gr.kind === 'main');
    if (!mains().length) this.groups.push(this.newGroup('main'));
    for (const u of active) {
      if (this.assign.has(u.id)) continue;
      let gr;
      if (this.L.steals && active.length >= 6 && fast(u) && (!raid || raid.ids.size < 2)) {
        if (!raid) { raid = this.newGroup('raid'); this.groups.push(raid); }
        gr = raid;
      } else {
        const ms = mains();
        if (ms.length < 2 && active.length >= 14 && ms[0].ids.size >= 7) { const n = this.newGroup('main'); this.groups.push(n); ms.push(n); }
        gr = ms.sort((a, b) => a.ids.size - b.ids.size)[0];
      }
      gr.ids.add(u.id);
      this.assign.set(u.id, gr);
    }
  }
  newGroup(kind) { return { id: ++this.gid, kind, ids: new Set(), target: null, dest: null, lastCmd: -99, jx: (Math.random() - 0.5) * 8, jz: (Math.random() - 0.5) * 8, since: this.g.time }; }

  // Stärke aufgeklärter Feinde in der Nähe eines Punkts
  enemyPower(enemies, x, z, r) { let s = 0; const r2 = r * r; for (const e of enemies) if (!e.type.air && d2(e.pos.x, e.pos.z, x, z) < r2) s += weightOf(e); return s; }
  ownPower(x, z, r) { let s = 0; const r2 = r * r; for (const u of this.g.units) if (u.alive && u.side === this.p.team && !u.type.structure && !u.type.air && d2(u.pos.x, u.pos.z, x, z) < r2) s += weightOf(u); return s; }

  // Sammeln (MP-T7): Eine zusammengeschmolzene Hauptgruppe greift nicht mehr tröpfchenweise an, sondern sammelt
  // Nachschub am hintersten eigenen Punkt bzw. vor dem Aufmarschraum, bis sie wieder Gefechtsstärke hat (Hysterese
  // 5 → 10 Stärkepunkte; Infanterie 1, leichte Fahrzeuge 2, Kampfpanzer 4). Verhindert den Schneeball, bei dem
  // jede Verstärkung einzeln in die überlegene Front läuft.
  regroup(gr, units) {
    if (gr.kind !== 'main') return false;
    const g = this.g, team = this.p.team, LO = 5, HI = 10;
    if (!gr.gather && gr.power < LO && g.time > 60) gr.gather = true;
    if (gr.gather && gr.power >= HI) { gr.gather = false; gr.target = null; gr.dest = null; gr.lastCmd = -99; return false; }
    if (!gr.gather) return false;
    let rx = this.home[0], rz = this.home[1] + (team === 'UA' ? -18 : 18), bd = Infinity;
    for (const cp of this.sk.points) {
      if (cp.owner !== team) continue;
      const dd = d2(cp.x, cp.z, this.home[0], this.home[1]);
      if (dd < bd) { bd = dd; rx = cp.x; rz = cp.z; }
    }
    if (!gr.dest || gr.mode !== 'gather' || d2(gr.dest[0], gr.dest[1], rx, rz) > 15 * 15) { gr.target = null; gr.mode = 'gather'; gr.dest = [rx + gr.jx, rz + gr.jz]; gr.lastCmd = -99; }
    this.stats.gathers = (this.stats.gathers || 0) + 1;
    return true;
  }

  // Front halten: Gegen deutlich überlegene, aufgeklärte Kräfte zieht sich die Gruppe zum nächsten eigenen Punkt
  // (bzw. Aufmarschraum) zurück und sammelt sich, statt hineinzulaufen.
  checkFallback(gr, units, enemies) {
    const g = this.g, team = this.p.team;
    if (gr.fallbackUntil && g.time < gr.fallbackUntil) return true;
    if (gr.fallbackUntil) { gr.fallbackUntil = 0; gr.target = null; gr.dest = null; }
    const near = this.enemyPower(enemies, gr.cx, gr.cz, 55);
    if (near <= gr.power * this.L.courage || near < 6) return false;
    let best = null, bd = Infinity;
    for (const cp of this.sk.points) {
      if (cp.owner !== team) continue;
      const dd = d2(cp.x, cp.z, gr.cx, gr.cz);
      if (dd < 30 * 30) continue; // nicht der Punkt, an dem gekämpft wird
      const toHome = d2(cp.x, cp.z, this.home[0], this.home[1]), meHome = d2(gr.cx, gr.cz, this.home[0], this.home[1]);
      if (toHome > meHome) continue; // nur nach hinten
      if (dd < bd) { bd = dd; best = cp; }
    }
    const [fx, fz] = best ? [best.x, best.z] : [this.home[0], this.home[1] + (team === 'UA' ? -14 : 14)];
    gr.target = null; gr.mode = 'fallback'; gr.dest = [fx + gr.jx, fz + gr.jz]; gr.lastCmd = -99;
    gr.fallbackUntil = g.time + 20;
    this.stats.fallbacks = (this.stats.fallbacks || 0) + 1;
    // Nicht im Angriffsmodus zurück (sonst bleiben sie beim ersten Feindkontakt stehen)
    this.cmd({ t: 'move', ids: units.map((u) => u.id), x: gr.dest[0], z: gr.dest[1] });
    gr.lastCmd = g.time;
    return true;
  }

  chooseTarget(gr, units, enemies) {
    const sk = this.sk, team = this.p.team, intel = sk.intel[team];
    const cur = gr.target;
    // Ziel erreicht? Eigener, ungefährdeter Punkt → evtl. Besatzung abstellen, dann weiter
    if (cur && cur.owner === team && !cur.capTeam && gr.mode !== 'defend') {
      this.maybeGarrison(gr, units, cur);
      gr.target = null;
    }
    if (gr.target && gr.mode === 'defend' && cur.owner === team && !cur.capTeam && this.enemyPower(enemies, cur.x, cur.z, cur.radius * 2.5) === 0) gr.target = null;
    if (gr.forced && this.g.time < gr.forced) return; // Countdown-Befehl hat Vorrang
    let best = null, bs = -Infinity, bmode = null;
    for (const cp of sk.points) {
      const dist = Math.sqrt(d2(gr.cx, gr.cz, cp.x, cp.z));
      const ep = this.enemyPower(enemies, cp.x, cp.z, cp.radius * 2.5);
      let s, mode;
      if (cp.owner !== team) {
        if (ep > (gr.power || 1) * this.L.courage * 1.1 && cp !== cur) continue;
        s = cp.value * 30 + (cp.owner ? 0 : 12) - dist * 0.18 - intel.claimCount(cp.id, this.p.id) * 18 - ep * 2.5 + (cp.capTeam === team ? 10 : 0);
        if (gr.kind === 'raid') s += (cp.owner ? 0 : 10) - ep * 4;
        mode = 'capture';
      } else {
        const threat = ep + (cp.capTeam && cp.capTeam !== team ? 10 : 0);
        if (threat <= 0) continue;
        s = cp.value * 30 + threat * 3 - dist * 0.18 - this.ownPower(cp.x, cp.z, cp.radius * 1.5) * 1.5 - intel.claimCount(cp.id, this.p.id) * 10;
        mode = 'defend';
      }
      if (cp === cur) s += 25; // Hysterese
      if (s > bs) { bs = s; best = cp; bmode = mode; }
    }
    if (best) { if (best !== gr.target) { gr.target = best; gr.dest = null; } gr.mode = bmode; return; }
    // Keine Punkte offen: Feinde in der Nähe eigener Punkte jagen, sonst den vordersten eigenen Punkt halten.
    // MP-T7: früher stieß die Gruppe bis in den gegnerischen Aufmarschraum vor und vernichtete dort jede eintreffende
    // Verstärkung („Spawn-Campen") – nach dem ersten verlorenen Treffen war jede Partie entschieden.
    gr.target = null; gr.mode = 'hunt';
    let tx, tz;
    const own = sk.points.filter((cp) => cp.owner === team);
    if (enemies.length) {
      let bd = Infinity;
      for (const e of enemies) {
        if (e.type.air) continue;
        if (!own.some((cp) => d2(e.pos.x, e.pos.z, cp.x, cp.z) < 70 * 70)) continue;
        const dd = d2(e.pos.x, e.pos.z, gr.cx, gr.cz); if (dd < bd) { bd = dd; tx = e.pos.x; tz = e.pos.z; }
      }
    }
    if (tx === undefined) {
      gr.mode = 'hold';
      const es = this.g.playersOfTeam(other(team)).find((q) => !q.defeated) || this.g.playersOfTeam(other(team))[0];
      let bd = Infinity;
      for (const cp of own) { const dd = d2(cp.x, cp.z, es.spawn.x, es.spawn.z); if (dd < bd) { bd = dd; tx = cp.x + gr.jx; tz = cp.z + gr.jz; } }
      if (tx === undefined) { tx = this.home[0] + gr.jx; tz = this.home[1] + (team === 'UA' ? -18 : 18); }
    }
    if (!gr.dest || d2(gr.dest[0], gr.dest[1], tx, tz) > 30 * 30) gr.dest = [tx, tz], gr.lastCmd = -99;
  }

  drive(gr, units) {
    const g = this.g;
    if (gr.target && !gr.dest) { gr.dest = [gr.target.x + gr.jx, gr.target.z + gr.jz]; gr.lastCmd = -99; }
    if (!gr.dest) return;
    const [dx, dz] = gr.dest;
    const fresh = gr.lastCmd < 0;
    const r = gr.target ? gr.target.radius * 0.7 : 20;
    if (fresh) {
      gr.lastCmd = g.time;
      this.cmd({ t: 'move', ids: units.map((u) => u.id), x: dx, z: dz, attackMove: true });
      return;
    }
    if (g.time - gr.lastCmd < this.L.reissue) return;
    // Nur untätige Nachzügler neu schicken (spart Wegfindung)
    const idle = units.filter((u) => !u.order && d2(u.pos.x, u.pos.z, dx, dz) > r * r && !u.weapons.some((w) => w.target && w.target.alive));
    if (idle.length) { gr.lastCmd = g.time; this.cmd({ t: 'move', ids: idle.map((u) => u.id), x: dx, z: dz, attackMove: true }); }
  }

  maybeGarrison(gr, units, cp) {
    if (gr.kind !== 'main' || units.length < 6) return;
    const gars = this.groups.filter((q) => q.kind === 'garrison');
    if (gars.length >= 3 || gars.some((q) => q.target === cp)) return;
    const inf = units.filter((u) => u.type.infantry && d2(u.pos.x, u.pos.z, cp.x, cp.z) < (cp.radius * 2) ** 2).sort((a, b) => d2(a.pos.x, a.pos.z, cp.x, cp.z) - d2(b.pos.x, b.pos.z, cp.x, cp.z));
    const take = inf.slice(0, cp.value >= 2 ? 2 : 1);
    if (!take.length) return;
    const gq = this.newGroup('garrison'); gq.target = cp; this.groups.push(gq);
    for (const u of take) { gr.ids.delete(u.id); gq.ids.add(u.id); this.assign.set(u.id, gq); }
    this.cmd({ t: 'move', ids: take.map((u) => u.id), x: cp.x + (Math.random() - 0.5) * 6, z: cp.z + (Math.random() - 0.5) * 6 });
  }
  // Beobachter: vor der Hauptgruppe (zum Ziel hin) in Stellung gehen, still halten, Fernglas aufs Ziel richten
  runObservers(obs, lead, enemies) {
    if (!obs.length) return;
    const g = this.g, team = this.p.team;
    let k = 0;
    for (const o of obs) {
      k++;
      let fx, fz, aim;
      if (lead && lead.cx !== undefined && lead.dest) {
        const dx = lead.dest[0] - lead.cx, dz = lead.dest[1] - lead.cz, l = Math.hypot(dx, dz) || 1;
        const ahead = Math.min(l, 26);
        fx = lead.cx + dx / l * ahead + (k % 2 ? -8 : 8); fz = lead.cz + dz / l * ahead;
        aim = lead.dest;
      } else { fx = this.home[0] + (k - 1) * 6; fz = this.home[1] + (team === 'UA' ? -22 : 22); const es = g.playersOfTeam(other(team))[0]; aim = [es.spawn.x, es.spawn.z]; }
      // höhere Position in der Nähe bevorzugen (Hügel)
      let bx = fx, bz = fz, bh = g.terrain.height(fx, fz);
      for (let i = 0; i < 6; i++) { const a = i * 1.047, x = fx + Math.cos(a) * 10, z = fz + Math.sin(a) * 10; if (!g.terrain.inBounds(x, z, 4)) continue; const h = g.terrain.height(x, z); const kk = g.terrain.cellIndex(x, z); if (h > bh + 0.8 && kk >= 0 && !g.terrain.gBlocked[kk] && !g.terrain.gWater[kk]) { bh = h; bx = x; bz = z; } }
      const dd = d2(o.pos.x, o.pos.z, bx, bz);
      if (dd > 14 * 14 && (!o.order || o.order.type !== 'move' || d2(o.order.x, o.order.z, bx, bz) > 20 * 20)) { this.cmd({ t: 'move', ids: [o.id], x: bx, z: bz }); this.stats.obsMoves = (this.stats.obsMoves || 0) + 1; }
      else if (!o.order && o.bino && !o.moving) {
        // Blickrichtung: nächster aufgeklärter Feind, sonst Ziel
        let tx = aim[0], tz = aim[1], bd = Infinity;
        for (const e of enemies) { if (e.type.air) continue; const q = d2(e.pos.x, e.pos.z, o.pos.x, o.pos.z); if (q < bd) { bd = q; tx = e.pos.x; tz = e.pos.z; } }
        if (Math.abs(Math.atan2(tx - o.pos.x, tz - o.pos.z) - o.bino.yaw) > 0.3) this.cmd({ t: 'binoculars', ids: [o.id], x: tx, z: tz });
      }
    }
  }
  runGarrison(gr, units) {
    const cp = gr.target;
    if (!cp || cp.owner !== this.p.team) {
      // Punkt verloren → Besatzung schließt sich der Hauptgruppe an
      const main = this.groups.find((q) => q.kind === 'main');
      for (const u of units) { gr.ids.delete(u.id); if (main) { main.ids.add(u.id); this.assign.set(u.id, main); } else this.assign.delete(u.id); }
      return;
    }
    // Häuser am Punkt besetzen (nächstes freies Haus im Radius)
    const houses = this.g.terrain.objects.houses;
    const free = units.filter((u) => !u.garrison && !u.garrisonGoal && !u.order);
    if (free.length) {
      let bestH = null, bd = (cp.radius * 1.4) ** 2;
      for (const h of this.g.units) {
        if (h.type.key !== 'house' || !h.alive || knownHostile(this.g, h, this.p.team)) continue; // MP-T7: nur aufgeklärte Feindbesatzung meiden (kein Wissen über verdeckte)
        const q = d2(h.pos.x, h.pos.z, cp.x, cp.z);
        if (q < bd && (h.occupants?.length || 0) < 4) { bd = q; bestH = h; }
      }
      if (bestH && this.cmd({ t: 'garrison', ids: free.map((u) => u.id), target: bestH.id })) { this.stats.garrisons = (this.stats.garrisons || 0) + free.length; return; }
    }
    const strays = units.filter((u) => !u.order && !u.garrison && !u.garrisonGoal && d2(u.pos.x, u.pos.z, cp.x, cp.z) > (cp.radius * 0.6) ** 2);
    if (strays.length) this.cmd({ t: 'move', ids: strays.map((u) => u.id), x: cp.x, z: cp.z, attackMove: true });
    // V3-M2: Infanterie ohne Haus am Punkt gräbt sich ein (Schützenloch)
    const g = this.g;
    const diggers = units.filter((u) => u.type.infantry && !u.order && !u.garrison && !u.garrisonGoal && !u.job && !u.moving && !g.logi?.coverOf(u) && (u._aiDigT ?? -99) < g.time - 30);
    if (diggers.length) { for (const u of diggers) u._aiDigT = g.time; if (this.cmd({ t: 'dig', ids: diggers.map((u) => u.id) })) this.stats.digs = (this.stats.digs || 0) + diggers.length; }
  }

  supportUnits(arty, air, trucks, lead, enemies) {
    const g = this.g, team = this.p.team;
    const sgn = team === 'UA' ? 1 : -1;
    const front = lead && lead.dest ? lead : null;
    // Artillerie: hinter der Hauptgruppe (Richtung eigener Aufmarschraum)
    if (arty.length) {
      let tx = this.home[0], tz = this.home[1];
      if (front) { const fx = front.cx ?? front.dest[0], fz = front.cz ?? front.dest[1]; const vx = this.home[0] - fx, vz = this.home[1] - fz, l = Math.hypot(vx, vz) || 1; const k = Math.min(l, 60); tx = fx + vx / l * k; tz = fz + vz / l * k; }
      const idle = arty.filter((u) => !u.order && d2(u.pos.x, u.pos.z, tx, tz) > 35 * 35);
      if (idle.length) this.cmd({ t: 'move', ids: idle.map((u) => u.id), x: tx, z: tz });
    }
    // Aufklärungsdrohnen: über das Ziel der Hauptgruppe bzw. einen ungesehenen Feindpunkt
    if (air.length) {
      const fow = g.fowFor(team);
      let tgt = front?.target || null;
      if (!tgt || fow.isVisible(tgt.x, tgt.z)) {
        const cands = this.sk.points.filter((c) => c.owner !== team && !fow.isVisible(c.x, c.z));
        cands.sort((a, b) => d2(a.x, a.z, this.home[0], this.home[1]) - d2(b.x, b.z, this.home[0], this.home[1]));
        tgt = cands[0] || tgt;
      }
      if (tgt) {
        const tx = tgt.x + sgn * 12, tz = tgt.z + sgn * 18;
        const idle = air.filter((u) => (!u.order || u.order.type === 'move' && (!u.path || !u.path.length)) && d2(u.pos.x, u.pos.z, tx, tz) > 20 * 20);
        if (idle.length) this.cmd({ t: 'move', ids: idle.map((u) => u.id), x: tx, z: tz });
      }
    }
    // Lkw: im Aufmarschraum bleiben (Versorgungslogik folgt später)
    const far = trucks.filter((u) => !u.order && d2(u.pos.x, u.pos.z, this.home[0], this.home[1]) > 40 * 40);
    if (far.length) this.cmd({ t: 'move', ids: far.map((u) => u.id), x: this.home[0], z: this.home[1] + sgn * 6 });
  }

  // Kurz vor Ablauf: gefährdete eigene Punkte verstärken, unbewachte fremde Punkte mit schnellen Einheiten klauen
  countdownReaction(ground, enemies) {
    const sk = this.sk, team = this.p.team, T = sk.reinfT, g = this.g;
    if (this.stealCycle !== sk.reinfCycle) { this.stealCycle = sk.reinfCycle; this.defended = false; this.stealsSent = 0; }
    // Verteidigung (einmal je Countdown): Hauptgruppe zum bedrohten eigenen Punkt, falls rechtzeitig erreichbar
    const threatened = this.defended ? [] : sk.points.filter((c) => c.owner === team && (c.capTeam && c.capTeam !== team || c.presence[other(team)] > 0));
    for (const c of threatened) {
      const gr = this.groups.filter((q) => q.kind === 'main' && q.ids.size).sort((a, b) => d2(a.cx, a.cz, c.x, c.z) - d2(b.cx, b.cz, c.x, c.z))[0];
      if (!gr || gr.cx === undefined) continue;
      if (Math.sqrt(d2(gr.cx, gr.cz, c.x, c.z)) / 5 > T) continue;
      gr.target = c; gr.mode = 'defend'; gr.dest = [c.x, c.z]; gr.lastCmd = -99; gr.forced = g.time + T + 2;
      const units = [...gr.ids].map((id) => g.unitById(id)).filter(Boolean);
      this.drive(gr, units);
      this.defended = true;
      break;
    }
    // Klauen (wiederholt geprüft, bis die Zahl der Späher für diesen Countdown erreicht ist)
    if (this.stealsSent >= this.L.steals || T < 9) return;
    const taken = new Set();
    const busy = new Set([...this.stealers.values()].map((s) => s.cp));
    for (const ai of sk.ais) if (ai !== this && ai.p.team === team) for (const s of ai.stealers.values()) busy.add(s.cp);
    const cands = sk.points.filter((c) => c.owner !== team && !busy.has(c.id) && c.presence[team] === 0 && this.enemyPower(enemies, c.x, c.z, c.radius * 1.8) === 0);
    cands.sort((a, b) => (b.owner ? 1 : 0) - (a.owner ? 1 : 0) || b.value - a.value);
    const pool = ground.filter((u) => !this.retreat.has(u.id) && !this.stealers.has(u.id) && this.assign.get(u.id)?.kind !== 'garrison' && u.speed > 0 && !u.weapons.some((w) => w.target && w.target.alive));
    for (const c of cands) {
      if (this.stealsSent >= this.L.steals) break;
      let best = null, be = Infinity;
      for (const u of pool) {
        if (taken.has(u.id)) continue;
        const eta = Math.sqrt(d2(u.pos.x, u.pos.z, c.x, c.z)) / (u.speed * 0.8) ;
        if (eta < T - 7 && eta < be) { be = eta; best = u; }
      }
      if (!best) continue;
      taken.add(best.id);
      const gr = this.assign.get(best.id); if (gr) gr.ids.delete(best.id);
      this.assign.delete(best.id);
      this.stealers.set(best.id, { cp: c.id, cycle: sk.reinfCycle });
      this.cmd({ t: 'move', ids: [best.id], x: c.x, z: c.z });
      this.stats.steals++;
      this.stealsSent++;
      sk.log.push({ t: g.time, type: 'stealAttempt', cp: c.id, name: c.name, team, player: this.p.id, unit: best.type.key, eta: Math.round(be) });
    }
  }

  // ================= Logistik (MP-T4b) – ausschließlich über game.command =================
  detach(u) { const gr = this.assign.get(u.id); if (gr) gr.ids.delete(u.id); this.assign.delete(u.id); }
  needsSupply(u, lim = 0.15) {
    const am = u.ammoInfo();
    return !!((am && am.cur / am.max < lim) || (u.maxFuel && u.fuel / u.maxFuel < lim));
  }
  throttled(u, sec) { const t = this.orderT.get(u.id); if (t !== undefined && this.g.time - t < sec) return true; this.orderT.set(u.id, this.g.time); return false; }
  // Nachschubpunkte (eigene Spawn-Zone, gehaltene Depots) und Versorgungs-Lkw des Teams
  supplyDirectPoints() {
    const team = this.p.team, mission = this.g.mission;
    return (mission.supplyPoints?.(this.g) || []).filter((pt) => pt.team === team && pt.direct);
  }
  nearestSupplyTruck(u) {
    let best = null, bd = Infinity;
    for (const t of this.g.units) {
      if (!t.alive || !t.supply || t.side !== this.p.team || t === u) continue;
      if (t.supply.ammo < 80 && t.supply.fuel < 80) continue;
      const dd = d2(t.pos.x, t.pos.z, u.pos.x, u.pos.z);
      if (dd < bd) { bd = dd; best = t; }
    }
    return best;
  }
  // Einheiten mit leerer Munition/Tank ziehen sich zum Versorgungs-Lkw oder zum Nachschubpunkt zurück und schließen sich danach wieder an
  resupplyCheck(ground) {
    const g = this.g;
    for (const u of ground) {
      const r = this.resup.get(u.id);
      if (r) {
        const done = !this.needsSupply(u, 0.5) || g.time - r.t0 > 90;
        if (done) { this.resup.delete(u.id); this.stats.supplied++; continue; }
        if (!u.order && !this.throttled(u, 6)) this.sendToSupply(u);
      } else if (this.needsSupply(u, 0.12) && !this.retreat.has(u.id) && !this.stealers.has(u.id)) {
        this.resup.set(u.id, { t0: g.time });
        this.detach(u);
        this.stats.resupplies++;
        this.orderT.set(u.id, g.time);
        this.sendToSupply(u);
      }
    }
  }
  sendToSupply(u) {
    if (u.cantMove && !u.immobilized && u.maxFuel && u.fuel <= 0) return; // Tank leer: Lkw kommt zu ihm
    const tr = this.nearestSupplyTruck(u);
    let x, z;
    if (tr && d2(tr.pos.x, tr.pos.z, u.pos.x, u.pos.z) < 260 * 260) { x = tr.pos.x + (Math.random() - 0.5) * 8; z = tr.pos.z + (Math.random() - 0.5) * 8; }
    else {
      const pts = this.supplyDirectPoints().sort((a, b) => d2(a.x, a.z, u.pos.x, u.pos.z) - d2(b.x, b.z, u.pos.x, u.pos.z));
      if (pts.length) { x = pts[0].x + (Math.random() - 0.5) * 12; z = pts[0].z + (Math.random() - 0.5) * 12; } else { x = this.home[0]; z = this.home[1]; }
    }
    this.cmd({ t: 'move', ids: [u.id], x, z });
  }
  // Punkt hinter der Frontgruppe (Richtung eigener Aufmarschraum)
  behindFront(gr, dist) {
    const vx = this.home[0] - gr.cx, vz = this.home[1] - gr.cz, l = Math.hypot(vx, vz) || 1;
    const k = Math.min(dist, l);
    return [gr.cx + vx / l * k, gr.cz + vz / l * k];
  }
  logisticsUnits(trucks, engineers, crews, ground, lead, enemies) {
    const g = this.g, team = this.p.team, sk = this.sk;
    const mains = this.groups.filter((gr) => (gr.kind === 'main' || gr.kind === 'raid') && gr.ids.size && gr.cx !== undefined);
    const own = g.units.filter((u) => u.alive && u.side === team && !u.type.structure && !u.type.air);
    // Bedürftige eigene Einheiten (leer/ohne Sprit/Kette) für Lkw und Bergefahrzeuge
    const needy = own.filter((u) => this.needsSupply(u, 0.2) && !u.supply);
    const damaged = own.filter((u) => u.type.vehicle && !u.type.repair && (u.hp < u.maxHp * 0.65 || u.immobilized));
    const abandoned = g.units.filter((u) => u.alive && u.abandoned);
    let ti = 0;
    for (const tr of trucks) {
      if (this.throttled(tr, 5)) continue;
      let tx = null, tz = null;
      if (tr.supply) {
        const lowPool = tr.supply.ammo < tr.type.supply.ammo * 0.2 || tr.supply.fuel < tr.type.supply.fuel * 0.2;
        if (lowPool) {
          const pts = this.supplyDirectPoints().sort((a, b) => d2(a.x, a.z, tr.pos.x, tr.pos.z) - d2(b.x, b.z, tr.pos.x, tr.pos.z));
          if (pts.length) { tx = pts[0].x; tz = pts[0].z; }
        } else {
          // zum nächsten bedürftigen Verbündeten, sonst hinter die Frontgruppe
          let bd = 220 * 220, bu = null;
          for (const u of needy) { const dd = d2(u.pos.x, u.pos.z, tr.pos.x, tr.pos.z); if (dd < bd) { bd = dd; bu = u; } }
          if (bu) { tx = bu.pos.x; tz = bu.pos.z; }
        }
        if (tx === null && mains.length) { const gr = mains[ti++ % mains.length]; [tx, tz] = this.behindFront(gr, 24); }
        if (tx !== null && d2(tx, tz, tr.pos.x, tr.pos.z) > 14 * 14 && (!tr.order || d2(tr.order.x, tr.order.z, tx, tz) > 20 * 20)) { this.cmd({ t: 'move', ids: [tr.id], x: tx, z: tz }); this.stats.truckMoves++; }
      } else if (tr.type.repair) {
        let bd = Infinity, bu = null;
        for (const u of [...damaged, ...abandoned.filter((a) => a.hp < a.maxHp * 0.95 || a.immobilized)]) { const dd = d2(u.pos.x, u.pos.z, tr.pos.x, tr.pos.z); if (dd < bd && dd < 200 * 200) { bd = dd; bu = u; } }
        if (bu) { tx = bu.pos.x; tz = bu.pos.z; }
        else if (mains.length) { const gr = mains[ti++ % mains.length]; [tx, tz] = this.behindFront(gr, 14); }
        if (tx !== null && d2(tx, tz, tr.pos.x, tr.pos.z) > 8 * 8 && (!tr.order || d2(tr.order.x, tr.order.z, tx, tz) > 20 * 20)) { this.cmd({ t: 'move', ids: [tr.id], x: tx, z: tz }); this.stats.repairMoves++; }
      } else {
        const far = !tr.order && d2(tr.pos.x, tr.pos.z, this.home[0], this.home[1]) > 40 * 40;
        if (far) this.cmd({ t: 'move', ids: [tr.id], x: this.home[0], z: this.home[1] + (team === 'UA' ? 6 : -6) });
      }
    }
    this.engineerLogic(engineers, mains, enemies);
    this.crewLogic(crews, ground, abandoned, enemies);
    // Bailout: bewegungsunfähige, schwer beschädigte Fahrzeuge unter Beschuss verlassen
    for (const u of own) {
      if (!u.type.vehicle || !g.logi.canBail(u) || u.hp > u.maxHp * 0.45) continue;
      if (this.throttled(u, 6)) continue;
      const near = enemies.some((e) => !e.type.air && d2(e.pos.x, e.pos.z, u.pos.x, u.pos.z) < 55 * 55);
      if (near && Math.random() < 0.5 && this.cmd({ t: 'bailout', ids: [u.id] })) this.stats.bailouts++;
    }
  }
  engineerLogic(engineers, mains, enemies) {
    const g = this.g, team = this.p.team, sk = this.sk;
    const es = g.playersOfTeam(other(team)).find((q) => q.spawn);
    const built = g.logi.countBuilds(this.p.id);
    const base = ['tanktrap', 'sandbag', 'minefield', 'trench'];
    const cost = { tanktrap: 1, sandbag: 1, minefield: 2, trench: 2 };
    for (const e of engineers) {
      if (e.job) continue;
      if (this.throttled(e, 7)) continue;
      // Nachschub an Baumaterial
      if (e.material < 1) {
        const tr = this.nearestSupplyTruck(e);
        const pts = this.supplyDirectPoints().sort((a, b) => d2(a.x, a.z, e.pos.x, e.pos.z) - d2(b.x, b.z, e.pos.x, e.pos.z));
        let x = this.home[0], z = this.home[1];
        if (tr && tr.supply.material >= 1) { x = tr.pos.x; z = tr.pos.z; } else if (pts.length) { x = pts[0].x; z = pts[0].z; }
        if (d2(x, z, e.pos.x, e.pos.z) > 10 * 10) this.cmd({ t: 'move', ids: [e.id], x, z });
        continue;
      }
      // Feindliche (aufgeklärte) Minenfelder räumen
      let mine = null, bd = 90 * 90;
      for (const u of g.units) {
        if (!u.alive || !u.type.build?.mines || u.side === team || !u.seenBy[team]) continue;
        const dd = d2(u.pos.x, u.pos.z, e.pos.x, e.pos.z);
        if (dd < bd) { bd = dd; mine = u; }
      }
      if (mine && this.cmd({ t: (e.mineStock || 0) < 12 ? 'pickmines' : 'clearmines', ids: [e.id], x: mine.pos.x, z: mine.pos.z })) { this.stats.clears++; continue; }
      // Epochen-Bauarten des Pioniers (ohne selbst gegrabene Schützenlöcher)
      const kinds = buildKindsFor(e.type).filter((k) => !UNIT_TYPES[k]?.build?.selfDig);
      const bs = base.filter((k) => kinds.includes(k)), ex = kinds.filter((k) => !base.includes(k)), order = [];
      for (let i = 0; i < Math.max(bs.length, ex.length); i++) { if (bs[i]) order.push(bs[i]); if (ex[i]) order.push(ex[i]); } // Basis und Epoche abwechselnd
      for (const k of order) if (cost[k] === undefined) cost[k] = UNIT_TYPES[k]?.build?.cost ?? 2;
      // Gehaltene Punkte befestigen
      if (built < 10 && es) {
        let best = null, bs = Infinity;
        for (const cp of sk.points) {
          if (cp.owner !== team) continue;
          const nb = g.units.reduce((n, u) => n + (u.alive && u.type.build && u.side === team && d2(u.pos.x, u.pos.z, cp.x, cp.z) < (cp.radius * 2.2) ** 2 ? 1 : 0), 0);
          if (nb >= 6) continue;
          const dd = Math.sqrt(d2(e.pos.x, e.pos.z, cp.x, cp.z)) + nb * 25;
          if (dd < bs) { bs = dd; best = { cp, nb }; }
        }
        if (best && bs < 260) {
          const { cp, nb } = best;
          let dx = es.spawn.x - cp.x, dz = es.spawn.z - cp.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
          const kind = order[nb % order.length];
          if (e.material + 1e-6 >= cost[kind]) {
            const bd = UNIT_TYPES[kind]?.build || {};
            const off = { tanktrap: cp.radius * 0.95, sandbag: cp.radius * 0.5, minefield: cp.radius * 1.5 + 6, trench: cp.radius * 0.25 }[kind] ?? (bd.mines ? cp.radius * 1.5 + 6 : bd.blocks ? cp.radius * 0.95 : cp.radius * 0.5);
            for (let tryN = 0; tryN < 5; tryN++) {
              const lat = (Math.random() - 0.5) * (8 + tryN * 4);
              const x = cp.x + dx * off - dz * lat + (Math.random() - 0.5) * 2, z = cp.z + dz * off + dx * lat + (Math.random() - 0.5) * 2;
              const helpers = engineers.filter((o) => o !== e && !o.job && d2(o.pos.x, o.pos.z, e.pos.x, e.pos.z) < 20 * 20).slice(0, 1).map((o) => o.id);
              if (this.cmd({ t: 'build', ids: [e.id, ...helpers], kind, x, z, rot: Math.atan2(dx, dz) })) { this.stats.builds++; break; }
            }
            continue;
          }
        }
      }
      // sonst: der Hauptgruppe hinterher
      if (mains.length && !e.order) {
        const gr = mains[(e.id | 0) % mains.length];
        const [tx, tz] = this.behindFront(gr, 12);
        if (d2(tx, tz, e.pos.x, e.pos.z) > 20 * 20) this.cmd({ t: 'move', ids: [e.id], x: tx, z: tz });
      }
    }
  }
  // Infanterie/Besatzungen übernehmen nahe verlassene Fahrzeuge
  crewLogic(crews, ground, abandoned, enemies) {
    const g = this.g;
    if (!abandoned.length) { for (const c of crews) if (!c.job && !this.assign.has(c.id)) this.joinMain(c); return; }
    const taken = new Set();
    for (const u of g.units) if (u.alive && u.job?.type === 'crew') taken.add(u.job.target);
    const infs = [...crews, ...ground.filter((u) => u.type.infantry && !u.job && !this.retreat.has(u.id) && !this.stealers.has(u.id))];
    for (const v of abandoned) {
      if (taken.has(v.id) || v.hp < v.maxHp * 0.25) continue;
      if (!v.weapons.length && !v.supply && !v.type.repair) continue;
      if (enemies.some((e) => !e.type.air && d2(e.pos.x, e.pos.z, v.pos.x, v.pos.z) < 22 * 22)) continue;
      const cand = infs.filter((u) => !u.job && d2(u.pos.x, u.pos.z, v.pos.x, v.pos.z) < 55 * 55).sort((a, b) => d2(a.pos.x, a.pos.z, v.pos.x, v.pos.z) - d2(b.pos.x, b.pos.z, v.pos.x, v.pos.z)).slice(0, 2);
      if (!cand.length) continue;
      if (this.cmd({ t: 'crew', ids: cand.map((u) => u.id), target: v.id })) {
        this.stats.crews++;
        for (const u of cand) this.detach(u);
        taken.add(v.id);
      }
    }
    for (const c of crews) if (!c.job && !this.assign.has(c.id)) this.joinMain(c);
  }
  joinMain(u) {
    const ms = this.groups.filter((gr) => gr.kind === 'main');
    const gr = ms.sort((a, b) => a.ids.size - b.ids.size)[0];
    if (!gr) return;
    gr.ids.add(u.id); this.assign.set(u.id, gr);
  }

  useAbilities(ground, enemies) {
    const g = this.g, p = this.p, team = p.team, L = this.L;
    if (Math.random() > L.abilityChance) return;
    const err = () => (Math.random() + Math.random() - 1) * L.err;
    for (const a of p.abilities) {
      if (!g.abilityAvailable(a)) continue;
      let target = null;
      const R = a.def.radius || 12;
      if (a.id === 'scan') {
        const fow = g.fowFor(team);
        const main = this.groups.find((q) => q.kind === 'main' && q.target);
        if (main && !fow.isVisible(main.target.x, main.target.z)) target = [main.target.x, main.target.z];
        else {
          const c = this.sk.points.filter((q) => q.owner === other(team) && !fow.isVisible(q.x, q.z)).sort((x, y) => d2(x.x, x.z, this.home[0], this.home[1]) - d2(y.x, y.z, this.home[0], this.home[1]))[0];
          if (c && Math.random() < 0.5) target = [c.x, c.z];
        }
      } else if ((a.id === 'ew' || a.id === 'm_tobol') && g.satnet?.enemyTerminalsSeen?.(team).some((t) => !t._satJam)) {
        // V3-SL: sichtbare, noch nicht gestörte feindliche Satellitenterminals stören (Tobol 60 m, EloKa-Störsender 38 m)
        const terms = g.satnet.enemyTerminalsSeen(team).filter((t) => !t._satJam);
        const c = this.bestCluster(terms, a.id === 'm_tobol' ? 45 : 30);
        if (c) target = [c.x, c.z];
      } else if (a.id === 'ew') {
        const drones = enemies.filter((e) => e.type.air && e.type.key !== 'ka52' && ground.some((u) => d2(u.pos.x, u.pos.z, e.pos.x, e.pos.z) < 70 * 70));
        if (drones.length >= (L === AI_LEVELS.hard ? 1 : 2)) target = [drones[0].pos.x, drones[0].pos.z];
      } else if (a.id === 'fpv' || a.id === 'lancet') {
        const ops = g.units.filter((u) => u.alive && u.owner === p.id && u.type.key === a.def.requires);
        const veh = enemies.filter((e) => e.type.vehicle && ops.some((o) => d2(o.pos.x, o.pos.z, e.pos.x, e.pos.z) < 170 * 170));
        if (veh.length) { const c = this.bestCluster(veh, R); if (c && c.score >= 2) target = [c.x, c.z]; }
      } else if (a.id === 'smoke') {
        // Rauchwand zwischen angreifender Hauptgruppe und naher Feindballung
        const main = this.groups.find((q) => q.kind === 'main' && q.target && q.ids.size >= 3 && q.cx !== undefined);
        if (main) {
          const near = enemies.filter((e) => !e.type.air && d2(e.pos.x, e.pos.z, main.cx, main.cz) < 55 * 55);
          const c = near.length >= 2 ? this.bestCluster(near, 14) : null;
          if (c) target = [(main.cx + c.x * 2) / 3, (main.cz + c.z * 2) / 3];
        }
      } else if (a.id === 'airdrop') {
        // Luftlandung auf einen nicht gehaltenen, schwach verteidigten Punkt
        const cands = this.sk.points.filter((q) => q.owner !== team && this.enemyPower(enemies, q.x, q.z, 45) < 3).sort((x, y) => d2(x.x, x.z, this.home[0], this.home[1]) - d2(y.x, y.z, this.home[0], this.home[1]));
        if (cands.length && g.time > 90) target = [cands[0].x, cands[0].z];
      } else if (a.id === 'artillery' || a.id === 'himars' || a.id === 'tornado' || a.id === 'stormshadow') {
        const gnd = enemies.filter((e) => !e.type.air);
        const c = this.bestCluster(gnd, R);
        if (c && c.score >= L.clusterMin && !this.friendlyNear(c.x, c.z, R + 4)) target = [c.x, c.z];
      }
      if (!target) continue;
      const x = target[0] + err(), z = target[1] + err();
      if (this.cmd({ t: 'ability', ability: a.id, x, z })) { this.stats.abilities++; return; }
    }
  }
  bestCluster(list, R) {
    if (!list.length) return null;
    const R2 = R * R;
    let best = null;
    const step = Math.max(1, Math.floor(list.length / 40));
    for (let i = 0; i < list.length; i += step) {
      const c = list[i];
      let s = 0, sx = 0, sz = 0;
      for (const e of list) if (d2(e.pos.x, e.pos.z, c.pos.x, c.pos.z) < R2) { const w = weightOf(e); s += w; sx += e.pos.x * w; sz += e.pos.z * w; }
      if (!best || s > best.score) best = { x: sx / s, z: sz / s, score: s };
    }
    return best;
  }
  friendlyNear(x, z, r) {
    const r2 = r * r;
    for (const u of this.g.units) if (u.alive && u.side === this.p.team && !u.type.structure && !u.type.air && d2(u.pos.x, u.pos.z, x, z) < r2) return true;
    return false;
  }
}
