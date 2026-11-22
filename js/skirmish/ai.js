// KI-Kommandeur für den Gefechtsmodus (MP-T4a).
// Steuert einen Spieler AUSSCHLIESSLICH über game.command(playerId, cmd) – läuft damit später unverändert auf dem Host.
// Liest nur, was das Team wissen darf: eigene Einheiten, für das Team aufgeklärte Feinde (visibleTo), öffentliche
// Punktdaten (Besitzer/Fortschritt) und den Countdown.
//
// Ablauf je Entscheidung (alle 2–4 s, gestaffelt): Rückzug beschädigter Einheiten → Gruppen bilden (Hauptgruppen,
// schnelle Raid-Gruppe, Besatzungen) → Ziele wählen (neutrale/feindliche Punkte erobern, bedrohte eigene verteidigen,
// Teamabsprache über TeamIntel.claims) → Countdown-Reaktion (gefährdete Punkte verstärken, unbewachte Punkte mit
// schnellen Einheiten „klauen") → Fähigkeit der Rolle auf sichtbare Gegnerballungen.

export const AI_LEVELS = {
  easy: { courage: 2.2, interval: 4.0, steals: 0, window: 0, abilityChance: 0.35, err: 14, clusterMin: 5, retreatHp: 0, reissue: 14 },
  normal: { courage: 1.6, interval: 3.0, steals: 1, window: 45, abilityChance: 0.7, err: 7, clusterMin: 4, retreatHp: 0.22, reissue: 10 },
  hard: { courage: 1.35, interval: 2.0, steals: 2, window: 55, abilityChance: 1.0, err: 2.5, clusterMin: 3, retreatHp: 0.3, reissue: 8 },
};
const other = (t) => (t === 'UA' ? 'RU' : 'UA');
const weightOf = (u) => (u.type.armor === 'heavy' ? 4 : u.type.vehicle ? 2 : 1);
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
    this.stats = { thinks: 0, commands: 0, abilities: 0, steals: 0, retreats: 0 };
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
    const ground = [], air = [], arty = [], trucks = [];
    const alive = new Set();
    for (const u of g.units) {
      if (!u.alive || u.owner !== p.id || u.type.structure || u.type.kamikaze) continue;
      alive.add(u.id);
      if (u.type.air) air.push(u);
      else if (u.type.naval) continue;
      else if (u.type.key === 'himars' || u.weapons.some((w) => w.def.indirect)) arty.push(u);
      else if (!u.weapons.length) trucks.push(u);
      else ground.push(u);
    }
    // Aufräumen
    for (const gr of this.groups) for (const id of gr.ids) if (!alive.has(id)) gr.ids.delete(id);
    this.groups = this.groups.filter((gr) => gr.ids.size > 0 || gr.kind === 'main' && this.groups.filter((q) => q.kind === 'main').length === 1);
    for (const id of [...this.assign.keys()]) if (!alive.has(id)) this.assign.delete(id);
    for (const id of [...this.retreat]) if (!alive.has(id)) this.retreat.delete(id);
    for (const [id, s] of [...this.stealers]) if (!alive.has(id) || s.cycle !== sk.reinfCycle) this.stealers.delete(id);
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
    const active = ground.filter((u) => !this.retreat.has(u.id) && !this.stealers.has(u.id));

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
      if (this.checkFallback(gr, units, enemies)) { this.drive(gr, units); continue; }
      this.chooseTarget(gr, units, enemies);
      if (gr.target) claims.push(gr.target.id);
      this.drive(gr, units);
    }
    sk.intel[team].setClaims(p.id, claims);

    // 4) Unterstützungseinheiten
    const lead = mains.filter((gr) => gr.ids.size).sort((a, b) => b.ids.size - a.ids.size)[0];
    this.supportUnits(arty, air, trucks, lead, enemies);

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
    // Keine Punkte offen: Jagd auf sichtbare Feinde, sonst Vorstoß zum gegnerischen Aufmarschraum
    gr.target = null; gr.mode = 'hunt';
    let tx, tz;
    if (enemies.length) {
      let bd = Infinity;
      for (const e of enemies) { if (e.type.air) continue; const dd = d2(e.pos.x, e.pos.z, gr.cx, gr.cz); if (dd < bd) { bd = dd; tx = e.pos.x; tz = e.pos.z; } }
    }
    if (tx === undefined) { const es = this.g.playersOfTeam(other(team)).find((q) => !q.defeated) || this.g.playersOfTeam(other(team))[0]; tx = es.spawn.x; tz = es.spawn.z; }
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
  runGarrison(gr, units) {
    const cp = gr.target;
    if (!cp || cp.owner !== this.p.team) {
      // Punkt verloren → Besatzung schließt sich der Hauptgruppe an
      const main = this.groups.find((q) => q.kind === 'main');
      for (const u of units) { gr.ids.delete(u.id); if (main) { main.ids.add(u.id); this.assign.set(u.id, main); } else this.assign.delete(u.id); }
      return;
    }
    const strays = units.filter((u) => !u.order && d2(u.pos.x, u.pos.z, cp.x, cp.z) > (cp.radius * 0.6) ** 2);
    if (strays.length) this.cmd({ t: 'move', ids: strays.map((u) => u.id), x: cp.x, z: cp.z, attackMove: true });
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
      } else if (a.id === 'ew') {
        const drones = enemies.filter((e) => e.type.air && e.type.key !== 'ka52' && ground.some((u) => d2(u.pos.x, u.pos.z, e.pos.x, e.pos.z) < 70 * 70));
        if (drones.length >= (L === AI_LEVELS.hard ? 1 : 2)) target = [drones[0].pos.x, drones[0].pos.z];
      } else if (a.id === 'fpv' || a.id === 'lancet') {
        const ops = g.units.filter((u) => u.alive && u.owner === p.id && u.type.key === a.def.requires);
        const veh = enemies.filter((e) => e.type.vehicle && ops.some((o) => d2(o.pos.x, o.pos.z, e.pos.x, e.pos.z) < 170 * 170));
        if (veh.length) { const c = this.bestCluster(veh, R); if (c && c.score >= 2) target = [c.x, c.z]; }
      } else if (a.id === 'artillery' || a.id === 'himars' || a.id === 'stormshadow') {
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
