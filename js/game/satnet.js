// V3-SL: Satelliten-Datennetz („Starlink“ als Systembezeichnung) – Terminals, Netzabdeckung, Ausfälle und Wirkung.
//
// Modell
//   Terminals: feste Terminals (Typfeld satTerminal: true, satRadius, z. B. m_starlink) und mobile Uplinks auf Einheiten
//   (Typfeld satlink: true | 'UA' | 'RU' = nur für dieses Team, oder je Einheit u.satlink = true, z. B. Zugführer-Fahrzeug).
//   Abdeckung: Kreis um jedes funktionsfähige Terminal (fest 45 m, mobil 25 m), Team-weit für alle Spieler des Teams.
//   Ein Team „nutzt“ das Netz (Status ≠ 'none'), sobald es ein Terminal besitzt (automatisch) oder setEnabled(team, true).
//   Teams ohne Netz verhalten sich wie bisher (keine Boni, keine Mali).
//   Die Sicht ist im Team ohnehin geteilt (game.fows je Team) → modelliert wird das Lagebild für Feuerunterstützung:
//     verbunden:  Fähigkeiten mit needsNet: Abklingzeit ×0,75, Streuung ×0,6 (−40 %)
//     ohne Netz (Team nutzt das Netz, Quelle nicht verbunden): Streuung ×1,5, Vorlaufzeit +3 s, Abklingzeit ×1,25,
//                 FPV/Lancet nur bis 70 m vom Piloten (Sichtfunk), netLock-Fähigkeiten (Aufklärung) gesperrt („Kein Netz“)
// Ausfälle
//   (a) EloKa: game.jamZones (Fähigkeit 'ew'), satnet.jam(...) (Fähigkeit m_tobol) und Einheiten mit Typfeld satJam (m)
//       stören feindliche Terminals im Radius (Terminal rot, keine Abdeckung).
//   (b) zufällige kurze Netzausfälle (15–40 s, alle 4–8 min) – Gefecht: setup.satOutage, Kampagne: mission.satnet.randomOutages
//   (c) outage({ seconds, region?: {x,z,r}, reason: 'Störung'|'Wartung'|'Abschaltung', team? }) mit Funkspruch
//   (d) Terminal zerstört → Abdeckung im Radius weg.
//   Funkgesteuerte Drohnen (FPV, Lancet, Molniya …), die mit Netz gestartet wurden (d.netOp/d.netLinked), verlieren die
//   Führung, sobald ihr Pilot keine Verbindung mehr hat: mit aufgeschaltetem Ziel Endanflug geradeaus, sonst Absturz nach
//   1,5–3,5 s. Glasfaser-Drohnen (ewImmune) bleiben unberührt.
// API (game.satnet):
//   outage(o) · restore(team?) · setEnabled(team, bool) · addTerminal(team, x, z, {owner, radius, type, rot}) ·
//   jam(x, z, r, sec, byTeam) · setRandomOutages(on, team?) · status(team) · isConnected(u) · level(p, abilityId) ·
//   mod(p, abilityId) → {level, spread, delay, range} · enemyTerminalsSeen(team) · pack(team)/applyNet(s) (Online)
// Einbindung: main.js (new SatNet(game)), Simulation über einen Wrapper um game.stepSim (Host und Client), Fähigkeiten
// über Wrapper um game.abilityAvailable/useAbility, HUD über hud.update → satnet.hudUpdate, Snapshot-Feld 'sn'.
import * as THREE from 'three';
import { rand, fmtTime } from '../engine/util.js';
import { ABILITIES } from './abilities.js';
import { icon, drawIcon } from './icons.js';

export const SATNET = {
  radius: 45,            // feste Terminals
  mobileRadius: 25,      // mobile Uplinks (Fahrzeuge, Trupps)
  cdOn: 0.75, cdOff: 1.25,
  spreadOn: 0.6, spreadOff: 1.5,
  delayOff: 3,           // s längere Vorlaufzeit ohne aktuelles Lagebild
  fpvRangeOff: 70,       // m: FPV/Lancet ohne Netz nur in Sichtfunk-Reichweite des Piloten
  randomFirst: [150, 360], randomEvery: [240, 480], randomDur: [15, 40],
  tobol: { r: 60, t: 25 },
  tick: 0.25,
};
const TEAMS = ['UA', 'RU'];
const COL = { connected: '#5dff8a', degraded: '#ffd23c', outage: '#ff5a4d' };
const REASON = {
  'Störung': (s) => `Satellitennetz gestört – Datenverbindung ausgefallen (ca. ${Math.round(s)} s).`,
  'Wartung': (s) => `Wartungsfenster im Satellitennetz – ca. ${Math.round(s)} s keine Verbindung.`,
  'Abschaltung': (s) => `Satellitennetz abgeschaltet! Drohnenführung und Lagebild ohne Netz (ca. ${Math.round(s)} s).`,
};
const r1 = (v) => Math.round(v * 10) / 10;
const d2 = (ax, az, bx, bz) => (ax - bx) * (ax - bx) + (az - bz) * (az - bz);

export class SatNet {
  constructor(game) {
    this.game = game;
    this._mission = undefined;
    this._uiT = 0;
    this._rings = new Map();
    this.reset(null);
    this._wrap();
    game.on('kill', (u) => this._onKill(u));
  }

  // ---------- Lebenszyklus ----------
  reset(mission) {
    this._mission = mission;
    const m = mission || {};
    const random = !!(m.setupData?.satOutage || m.satnet?.randomOutages);
    this.teams = {};
    for (const t of TEAMS) {
      this.teams[t] = { enabled: m.satnet === false ? false : null, out: null, random, rnd: rand(...SATNET.randomFirst), status: 'none', msgT: -99 };
    }
    this.regions = []; this.jams = [];
    this.terms = { UA: [], RU: [] };
    this._jammers = [];
    this._jamIds = new Set(); // Online-Client: gestörte Terminals (aus dem Snapshot)
    this.tickT = 0;
    this.stats = { outages: 0, jamEvents: 0, linkLost: 0, crashed: 0, terminalsLost: 0, uses: { on: 0, off: 0 } };
    for (const r of this._rings.values()) r.mesh.parent?.remove(r.mesh);
    this._rings.clear();
  }
  _sync() { if (this.game.mission !== this._mission) this.reset(this.game.mission); }
  get isClient() { return !!this.game.net?.isClient; }

  // Wrapper um Simulationsschritt und Fähigkeiten (keine Änderung an game.js nötig)
  _wrap() {
    const g = this.game, self = this;
    const step = g.stepSim;
    g.stepSim = function (dt) { step.call(this, dt); try { self.update(dt); } catch (e) { console.error('[satnet]', e); } };
    const avail = g.abilityAvailable;
    g.abilityAvailable = function (a) { return avail.call(this, a) && !self.locked(a); };
    const use = g.useAbility;
    g.useAbility = function (pid, id, x, z) {
      const p = this.playerById(pid);
      const a = p?.abilities.find((q) => q === id || q.id === id);
      const lv = a ? self.level(p, a.id) : null;
      const ok = use.call(this, pid, id, x, z);
      if (ok && a && lv) {
        const m = lv === 'on' ? SATNET.cdOn : SATNET.cdOff;
        a.cd = a.cooldown * m;
        self.stats.uses[lv]++;
        this.emit('abilities');
      }
      return ok;
    };
  }

  // ---------- Abfragen ----------
  active(team) {
    this._sync();
    const T = this.teams[team];
    return !!T && T.enabled === true && this.game.mission?.satnet !== false;
  }
  terminalRadius(u) {
    if (!u || !u.alive || (u.side !== 'UA' && u.side !== 'RU') || u.carrier) return 0;
    const ty = u.type;
    if (ty.satTerminal) return u.satRadius || ty.satRadius || SATNET.radius;
    const sl = u.satlink ?? ty.satlink;
    if (!sl || ty.kamikaze) return 0;
    if (typeof sl === 'string' && sl !== u.side) return 0;
    if (u.satlink === undefined && ty.era && ty.era !== 'modern') return 0;
    return u.satRadius || ty.satRadius || SATNET.mobileRadius;
  }
  _inRegion(x, z, team) {
    for (const r of this.regions) if ((!r.team || r.team === team) && d2(x, z, r.x, r.z) < r.r * r.r) return r;
    return null;
  }
  _jammedAt(x, z, team) {
    for (const j of this.game.jamZones || []) if ((j.team || 'UA') !== team && d2(x, z, j.x, j.z) < j.r * j.r) return true;
    for (const j of this.jams) if (j.team !== team && d2(x, z, j.x, j.z) < j.r * j.r) return true;
    for (const e of this._jammers) if (e.side !== team && d2(x, z, e.pos.x, e.pos.z) < e.type.satJam * e.type.satJam) return true;
    return false;
  }
  isConnected(u) {
    if (!u || !u.alive) return false;
    const team = u.side;
    if (!this.active(team) || this.teams[team].out) return false;
    const x = u.carrier ? u.carrier.pos.x : u.pos.x, z = u.carrier ? u.carrier.pos.z : u.pos.z;
    if (this._inRegion(x, z, team)) return false;
    for (const t of this.terms[team]) if (t.ok && t.u.alive && d2(x, z, t.u.pos.x, t.u.pos.z) <= t.r * t.r) return true;
    return false;
  }
  teamUp(team) { return this.active(team) && !this.teams[team].out && this.terms[team].some((t) => t.ok && t.u.alive); }
  // Netzstufe einer Fähigkeit für einen Spieler: null (kein Netzbezug / Team ohne Netz) | 'on' | 'off'
  level(p, id) {
    const def = ABILITIES[id];
    if (!def?.needsNet || !p || !this.active(p.team)) return null;
    if (def.requires) {
      for (const u of this.game.units) if (u.alive && u.owner === p.id && u.type.key === def.requires && this.isConnected(u)) return 'on';
      return 'off';
    }
    return this.teamUp(p.team) ? 'on' : 'off';
  }
  locked(a) {
    if (!a?.def?.needsNet || !a.def.netLock) return false;
    const p = this.game.playerById(a.owner);
    return this.level(p, a.id) === 'off';
  }
  mod(p, id) {
    const lv = this.level(p, id);
    return {
      level: lv,
      spread: lv === 'on' ? SATNET.spreadOn : lv === 'off' ? SATNET.spreadOff : 1,
      delay: lv === 'off' ? SATNET.delayOff : 0,
      range: lv === 'off' ? SATNET.fpvRangeOff : Infinity,
    };
  }
  status(team) {
    this._sync();
    if (!this.active(team)) return { code: 'none', text: '', total: 0, ok: 0, jammed: 0 };
    const T = this.teams[team], list = this.terms[team];
    const total = list.length, ok = list.filter((t) => t.ok).length, jammed = list.filter((t) => t.jam).length;
    const reg = this.regions.filter((r) => !r.team || r.team === team);
    if (T.out) return { code: 'outage', text: `Ausfall ${fmtTime(T.out.t)}`, remaining: T.out.t, reason: T.out.reason, total, ok, jammed, title: `${T.out.reason}: Satellitennetz ausgefallen, noch ${fmtTime(T.out.t)}` };
    if (!ok) {
      const text = !total ? 'Ausfall – kein Terminal' : jammed ? 'gestört – keine Verbindung' : 'Ausfall';
      return { code: 'outage', text, total, ok, jammed, title: !total ? 'Alle Terminals verloren' : jammed ? `${jammed} Terminal(s) durch EloKa gestört` : 'Keine Verbindung' };
    }
    if (jammed || reg.length || ok < total) {
      const rem = reg.length ? Math.max(...reg.map((r) => r.t)) : 0;
      return { code: 'degraded', text: `gestört (${ok}/${total})${rem ? ' ' + fmtTime(rem) : ''}`, total, ok, jammed, remaining: rem || undefined, title: jammed ? `${jammed} Terminal(s) durch EloKa gestört` : reg.length ? `Regionaler Ausfall (${reg[0].reason})` : 'Teilweise Abdeckung' };
    }
    return { code: 'connected', text: 'verbunden', total, ok, jammed, title: `${ok} Terminal(s) verbunden` };
  }
  // Für die KI: feindliche Terminals, die das Team gerade sieht
  enemyTerminalsSeen(team) {
    const g = this.game, fow = g.fowFor(team), out = [];
    for (const u of g.units) {
      if (!u.alive || u.side === team || u.side === 'N' || !this.terminalRadius(u) || !this.active(u.side)) continue;
      if (u.type.structure ? fow.isVisible(u.pos.x, u.pos.z) : u.seenBy?.[team]) out.push(u);
    }
    return out;
  }

  // ---------- Missions-API ----------
  outage({ seconds = 30, region = null, reason = 'Störung', team = null, silent = false } = {}) {
    this._sync();
    if (this.isClient) return null;
    const g = this.game, sec = Math.max(1, +seconds || 30);
    if (!REASON[reason]) reason = 'Störung';
    const teams = team ? [team] : TEAMS;
    this.stats.outages++;
    this.tickT = 0;
    if (region && Number.isFinite(+region.x) && Number.isFinite(+region.z)) {
      const r = { x: +region.x, z: +region.z, r: Math.max(5, +region.r || 60), t: sec, total: sec, team: team || null, reason };
      this.regions.push(r);
      if (!silent) for (const t of teams) if (this.active(t)) {
        g.sayTo(t, 'Fernmelder', `${reason} im Satellitennetz – im markierten Raum ca. ${Math.round(sec)} s keine Verbindung.`, 5);
        g.markerTo(t, r.x, r.z, 0xff5a4d, Math.min(sec, 12), r.r);
      }
      return r;
    }
    for (const t of teams) {
      const T = this.teams[t];
      T.out = { t: Math.max(sec, T.out?.t || 0), total: sec, reason };
      if (!silent && this.active(t)) { g.sayTo(t, 'Fernmelder', REASON[reason](sec), 5); g.uiTo(t, 'radio'); }
    }
    return { teams, seconds: sec, reason };
  }
  restore(team = null) {
    this._sync();
    for (const t of team ? [team] : TEAMS) if (this.teams[t].out) { this.teams[t].out = null; this._restored(t); }
    this.regions = team ? this.regions.filter((r) => r.team && r.team !== team) : [];
    this.tickT = 0;
  }
  setEnabled(team, on) { this._sync(); if (this.teams[team]) { this.teams[team].enabled = !!on; this.tickT = 0; } }
  setRandomOutages(on, team = null) { this._sync(); for (const t of team ? [team] : TEAMS) { this.teams[t].random = !!on; this.teams[t].rnd = rand(...SATNET.randomFirst); } }
  addTerminal(team, x, z, o = {}) {
    this._sync();
    const key = o.type || (team === 'RU' ? 'm_starlink_ru' : 'm_starlink');
    const u = this.game.spawn(key, team, x, z, { owner: o.owner, rot: o.rot ?? 0 });
    if (o.radius) u.satRadius = o.radius;
    if (this.teams[team] && this.teams[team].enabled === null) this.teams[team].enabled = true;
    this.tickT = 0;
    return u;
  }
  // Störzone (z. B. Tobol): stört feindliche Terminals von byTeam; Rückgabe: Zahl betroffener Terminals
  jam(x, z, r = SATNET.tobol.r, sec = SATNET.tobol.t, byTeam = 'RU') {
    this._sync();
    this.jams.push({ x, z, r, t: sec, team: byTeam });
    this.tickT = 0;
    let n = 0;
    for (const u of this.game.units) if (u.alive && u.side !== byTeam && u.side !== 'N' && this.terminalRadius(u) && d2(x, z, u.pos.x, u.pos.z) < r * r) n++;
    return n;
  }

  // ---------- Gefecht ----------
  // Aufruf aus skirmish.spawnArmy: fester Terminal am Aufmarschraum (UA; RU nur mit fiktivem Flag satCaptured),
  // Zugführer-Fahrzeuge (erster Leopard/Bradley) mit mobilem Uplink.
  onSkirmishArmy(p, units, S = {}) {
    this._sync();
    const g = this.game, sp = p.spawn;
    if (!sp || (p.team !== 'UA' && !(S.satCaptured && p.team === 'RU'))) return null;
    if (p.team === 'UA') for (const k of ['leopard', 'bradley']) { const v = units.find((u) => u.type.key === k); if (v) v.satlink = true; }
    const dir = p.team === 'UA' ? 1 : -1, T = g.terrain;
    for (const [ox, oz] of [[14, 6], [-14, 6], [18, -2], [-18, -2], [10, 12], [-10, 12], [0, 16]]) {
      const x = sp.x + ox, z = sp.z + oz * dir;
      const k = T.cellIndex ? T.cellIndex(x, z) : -1;
      if (k >= 0 && (T.gBlocked?.[k] || T.gWater?.[k])) continue;
      if (T.isWater?.(x, z)) continue;
      return this.addTerminal(p.team, x, z, { owner: p.id });
    }
    return null;
  }

  // ---------- Simulation ----------
  update(dt) {
    this._sync();
    const g = this.game;
    if (!g.active) return;
    for (const t of TEAMS) {
      const T = this.teams[t];
      if (T.out) { T.out.t -= dt; if (T.out.t <= 0) { T.out = null; if (!this.isClient) this._restored(t); this.tickT = 0; } }
    }
    if (this.regions.length) { for (const r of this.regions) r.t -= dt; const n = this.regions.length; this.regions = this.regions.filter((r) => r.t > 0); if (n !== this.regions.length) this.tickT = 0; }
    if (this.jams.length) { for (const j of this.jams) j.t -= dt; const n = this.jams.length; this.jams = this.jams.filter((j) => j.t > 0); if (n !== this.jams.length) this.tickT = 0; }
    this.tickT -= dt;
    if (this.tickT > 0) return;
    const step = SATNET.tick - Math.min(0, this.tickT);
    this.tickT = SATNET.tick;
    if (this.isClient) { this._scanClient(); return; }
    this._scan();
    this._links();
    for (const t of TEAMS) {
      const T = this.teams[t];
      if (T.random && this.active(t) && !T.out) {
        T.rnd -= step;
        if (T.rnd <= 0) { T.rnd = rand(...SATNET.randomEvery); this.outage({ seconds: rand(...SATNET.randomDur), reason: 'Störung', team: t }); this._scan(); }
      }
      this._statusChange(t);
    }
  }
  _scan() {
    const g = this.game;
    this._jammers = [];
    const terms = { UA: [], RU: [] };
    for (const u of g.units) {
      if (!u.alive) continue;
      if (u.type.satJam) this._jammers.push(u);
      const r = this.terminalRadius(u);
      if (r) terms[u.side].push({ u, r, fixed: !!u.type.satTerminal, ok: false, jam: false });
    }
    for (const team of TEAMS) {
      const T = this.teams[team];
      if (T.enabled === null && terms[team].length && g.mission?.satnet !== false) T.enabled = true;
      for (const t of terms[team]) {
        const x = t.u.pos.x, z = t.u.pos.z;
        t.jam = this._jammedAt(x, z, team);
        t.ok = !t.jam && !T.out && !this._inRegion(x, z, team);
        if (t.jam && !t.u._satJam && this.active(team)) {
          this.stats.jamEvents++;
          if (g.time - T.msgT > 8) { T.msgT = g.time; g.sayTo(team, 'Fernmelder', `${t.fixed ? 'Starlink-Terminal' : t.u.type.name + ' (Uplink)'} gestört – EloKa im Raum, Verbindung im Umkreis weg!`, 4); }
        }
        t.u._satJam = t.jam;
      }
    }
    this.terms = terms;
  }
  // Online-Client: Terminals des eigenen Teams aus eigenen/verbündeten Einheiten, Störung aus dem Snapshot
  _scanClient() {
    const g = this.game, ls = g.localSide, terms = { UA: [], RU: [] };
    for (const u of g.units) {
      if (!u.alive || u.side !== ls) continue;
      const r = this.terminalRadius(u);
      if (!r) continue;
      const jam = this._jamIds.has(u.id);
      terms[ls].push({ u, r, fixed: !!u.type.satTerminal, jam, ok: !jam && !this.teams[ls].out && !this._inRegion(u.pos.x, u.pos.z, ls) });
      u._satJam = jam;
    }
    this.terms = terms;
  }
  // Funkgesteuerte Drohnen: Pilot ohne Verbindung → Endanflug (Ziel aufgeschaltet) oder Absturz
  _links() {
    const g = this.game, lost = new Map();
    for (const u of g.units) {
      if (!u.alive || !u.netLinked || u.type.ewImmune) continue;
      const op = g.unitById(u.netOp);
      if (!op || !op.alive) continue; // Pilot gefallen: Drohne fliegt ihren Auftrag zu Ende
      if (this.isConnected(op)) continue;
      u.netLinked = false;
      this.stats.linkLost++;
      if (u.order?.type === 'attack' && u.order.target?.alive) u.netBlind = true; // Endanflug geradeaus
      else { u.jammed = rand(1.5, 3.5); this.stats.crashed++; }
      lost.set(u.owner, (lost.get(u.owner) || 0) + 1);
    }
    for (const [owner, n] of lost) g.sayTo(owner, 'Drohnenpilot', `Verbindung zu ${n} FPV-Drohne(n) verloren – kein Netz!`, 3);
  }
  _statusChange(team) {
    const T = this.teams[team];
    const st = this.status(team).code;
    if (st === T.status) return;
    const prev = T.status;
    T.status = st;
    this.game.emit('satnet', team, st, prev);
    if (prev === 'none' || st === 'none' || T.out) return;
    if (st === 'outage') this.game.sayTo(team, 'Fernmelder', 'Keine Satellitenverbindung mehr – alle Terminals gestört oder verloren!', 4);
    else if (st === 'connected' && prev === 'outage') this.game.sayTo(team, 'Fernmelder', 'Satellitenverbindung wieder hergestellt.', 3);
  }
  _restored(team) {
    if (!this.active(team)) return;
    this.game.sayTo(team, 'Fernmelder', 'Satellitennetz wiederhergestellt – Verbindung steht.', 4);
  }
  _onKill(u) {
    if (this.isClient || !u?.type?.satTerminal || !this.active(u.side)) return;
    this.stats.terminalsLost++;
    this.game.sayTo(u.side, 'Fernmelder', 'Starlink-Terminal zerstört – Netzabdeckung im Raum verloren!', 4);
    this.tickT = 0;
  }

  // ---------- Online (Snapshot-Feld 'sn', nur eigenes Team) ----------
  anyActive() { return TEAMS.some((t) => this.active(t)); }
  pack(team) {
    this._sync();
    const T = this.teams[team];
    if (!T) return null;
    const sl = [];
    for (const u of this.game.units) if (u.alive && u.side === team && u.satlink === true) sl.push(u.id);
    return {
      e: T.enabled === true ? 1 : 0,
      o: T.out ? [r1(T.out.t), T.out.reason, r1(T.out.total)] : 0,
      rg: this.regions.filter((r) => !r.team || r.team === team).map((r) => [r1(r.x), r1(r.z), r1(r.r), r1(r.t), r.reason]),
      j: this.terms[team].filter((t) => t.jam).map((t) => t.u.id),
      sl,
    };
  }
  applyNet(s) {
    this._sync();
    if (!s) return;
    const ls = this.game.localSide, T = this.teams[ls];
    T.enabled = s.e ? true : false;
    T.out = s.o ? { t: s.o[0], reason: s.o[1], total: s.o[2] } : null;
    this.regions = (s.rg || []).map((r) => ({ x: r[0], z: r[1], r: r[2], t: r[3], reason: r[4], team: ls }));
    this._jamIds = new Set(s.j || []);
    for (const id of s.sl || []) { const u = this.game.unitById(id); if (u) u.satlink = true; }
    this._scanClient();
  }

  // ---------- HUD (Aufruf aus hud.update nach drawOverlay) ----------
  hudUpdate(hud, dt) {
    this._sync();
    const g = this.game;
    this._uiT -= dt;
    if (this._uiT <= 0) { this._uiT = 0.2; this._renderStatus(); }
    if (!g.active || !this.active(g.localSide)) { this._hideRings(); return; }
    this._drawTerminals(hud);
    this._updateRings();
  }
  _renderStatus() {
    const g = this.game;
    let el = document.getElementById('satnet-status');
    if (!el) {
      const host = document.getElementById('topright');
      if (!host) return;
      el = document.createElement('div');
      el.id = 'satnet-status';
      el.setAttribute('role', 'status');
      Object.assign(el.style, { display: 'none', alignItems: 'center', gap: '6px', background: 'var(--panel, rgba(16,22,30,.85))', border: '1px solid', borderRadius: '8px', padding: '4px 10px', marginBottom: '4px', fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap', justifyContent: 'flex-end' });
      host.prepend(el);
    }
    const st = g.active ? this.status(g.localSide) : { code: 'none' };
    if (st.code === 'none') { if (el.style.display !== 'none') el.style.display = 'none'; el.dataset.state = 'none'; return; }
    const col = COL[st.code];
    const html = `${icon(st.code === 'connected' ? 'satnet' : 'satjam', { size: 16 })}<span>Netz: ${st.text}</span>`;
    if (el._html !== html) { el.innerHTML = html; el._html = html; }
    el.style.display = 'flex'; el.style.color = col; el.style.borderColor = col;
    el.title = st.title || '';
    el.dataset.state = st.code;
  }
  _drawTerminals(hud) {
    const g = this.game, ctx = hud.octx, cam = g.gr.camera, ls = g.localSide;
    if (!ctx || !cam) return;
    const W = window.innerWidth, H = window.innerHeight, v = this._v || (this._v = new THREE.Vector3());
    for (const t of this.terms[ls] || []) {
      const u = t.u;
      if (!u.alive || !u.root?.visible) continue;
      const sel = g.selected.includes(u);
      if (!t.fixed && !sel && !t.jam) continue;
      v.set(u.pos.x, u.pos.y + (u.model?.height || 2) + 2.6, u.pos.z).project(cam);
      if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) continue;
      const x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H;
      const col = t.ok ? COL.connected : t.jam ? COL.outage : COL.degraded;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill();
      drawIcon(ctx, t.ok ? 'satdish' : 'satjam', x, y, 16, col, 1);
    }
  }
  // Netzradius als dezenter Bodenring um ausgewählte eigene Terminals
  _updateRings() {
    const g = this.game, ls = g.localSide, want = new Set();
    for (const t of this.terms[ls] || []) {
      const u = t.u;
      if (!u.alive || !g.selected.includes(u)) continue;
      want.add(u.id);
      let r = this._rings.get(u.id);
      if (!r || r.r !== t.r) { if (r) r.mesh.parent?.remove(r.mesh); r = { r: t.r, x: NaN, z: NaN, mesh: this._ringMesh(t.r) }; this._rings.set(u.id, r); }
      if (!r.mesh.parent) g.scene.add(r.mesh);
      if (Math.abs(r.x - u.pos.x) > 0.5 || Math.abs(r.z - u.pos.z) > 0.5) { r.x = u.pos.x; r.z = u.pos.z; this._fitRing(r); }
      r.mesh.material.color.set(t.ok ? 0x5dff8a : t.jam ? 0xff5a4d : 0xffd23c);
      r.mesh.visible = true;
    }
    for (const [id, r] of this._rings) if (!want.has(id)) { r.mesh.parent?.remove(r.mesh); r.mesh.geometry.dispose(); r.mesh.material.dispose(); this._rings.delete(id); }
  }
  _hideRings() { for (const r of this._rings.values()) r.mesh.visible = false; }
  _ringMesh(R) {
    const seg = Math.max(48, Math.round(R * 2.2));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((seg + 1) * 2 * 3), 3));
    const idx = [];
    for (let i = 0; i < seg; i++) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, c, b, b, c, d); }
    geo.setIndex(idx);
    const mat = new THREE.MeshBasicMaterial({ color: 0x5dff8a, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 3; mesh.frustumCulled = false; mesh.userData.seg = seg;
    return mesh;
  }
  _fitRing(r) {
    const T = this.game.terrain, pos = r.mesh.geometry.attributes.position, seg = r.mesh.userData.seg;
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2, s = Math.sin(a), c = Math.cos(a);
      for (let k = 0; k < 2; k++) {
        const rr = r.r + (k ? 0.45 : -0.45), x = r.x + s * rr, z = r.z + c * rr;
        pos.setXYZ(i * 2 + k, x, T.surface(x, z) + 0.35, z);
      }
    }
    pos.needsUpdate = true;
    r.mesh.geometry.computeBoundingSphere();
  }
  // Fähigkeitenknopf: „Kein Netz“-Hinweis (Aufruf aus hud._updateAbilityState)
  decorateAbility(a) {
    if (!a?.btn) return;
    const p = this.game.playerById(a.owner);
    const lv = a.def?.needsNet && p ? this.level(p, a.id) : null;
    let b = a.btn._satBadge;
    if (lv !== 'off') { if (b && b.style.display !== 'none') { b.style.display = 'none'; a.btn.title = a.btn._satTitle || a.btn.title; } return; }
    if (!b) {
      b = document.createElement('span');
      b.className = 'nonet';
      Object.assign(b.style, { position: 'absolute', left: '2px', right: '2px', top: '2px', font: '700 9px system-ui, sans-serif', color: '#fff', background: 'rgba(190,40,35,.9)', borderRadius: '3px', textAlign: 'center', pointerEvents: 'none', lineHeight: '12px', zIndex: 2 });
      b.textContent = 'Kein Netz';
      if (getComputedStyle(a.btn).position === 'static') a.btn.style.position = 'relative';
      a.btn.appendChild(b);
      a.btn._satBadge = b;
    }
    if (b.style.display === 'none' || !a.btn._satTitle) {
      a.btn._satTitle = a.btn.title.replace(/\n\[Kein Netz.*$/s, '');
      a.btn.title = a.btn._satTitle + (a.def.netLock ? '\n[Kein Netz – gesperrt]' : '\n[Kein Netz – Streuung höher, Vorlauf länger]');
    }
    b.style.display = '';
  }
}
