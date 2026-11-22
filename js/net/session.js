// Online-Gefecht (MP-T5): Integration von Lobby/Transport in das Spiel – host-autoritativ.
//
//   Host   (HostSession):   volle Simulation inkl. KI-Kommandeure der KI-Slots. Empfängt 'cmd' der Clients und führt sie
//                           mit der vom Host bestimmten playerId aus (game.command). Sendet ~10 Hz Snapshots je Team
//                           (nur Einheiten, die das Team sieht – kein Maphack) und zuverlässige Event-Bündel je Spieler
//                           (Schüsse, Explosionen, Flugkörper, Tod/Wrack, Funk/Warnungen, Bau fertig, Aufklärung).
//   Client (ClientSession): simuliert nicht autoritativ (game.net.isClient → game.stepClient). Einheiten werden aus den
//                           Snapshots erzeugt/entfernt/aktualisiert (u.remote, Interpolation mit ~120 ms Puffer),
//                           Events spielen Effekte/Ton ab, Eingaben gehen über game.issueCommand → lobby.sendCmd.
//
// Snapshot { t, u: Base64 (UNIT_CODEC), sk: { p: Punkte, s: [UA,RU], r: Countdown, c: Zyklus }, me: { ab }, pl?, res? }
// Event-Bündel { t, l: [[art, …], …] } – Arten siehe ClientSession._applyEvent.
import * as THREE from 'three';
import { UNIT_TYPES } from '../game/unitTypes.js';
import { Missile } from '../game/combat.js';
import { createCodec } from './codec.js';
import { AICommander } from '../skirmish/ai.js';
import { normalizeSetup, netPointState, applyNetPoints, endFor, ROLES, TEAM_NAME } from '../skirmish/skirmish.js';

export const TYPE_KEYS = Object.keys(UNIT_TYPES);
const TYPE_IDX = new Map(TYPE_KEYS.map((k, i) => [k, i]));
export const ROLE_ORDER = ['armor', 'infantry', 'support', 'logistics', 'armor', 'infantry'];
const CALLSIGNS = { UA: ['Sokil', 'Bars', 'Wowk', 'Orel', 'Tur', 'Lys'], RU: ['Medwed', 'Wolk', 'Grom', 'Schtorm', 'Kedr', 'Berkut'] };
export const NET = {
  snapHz: 10,          // Snapshots je Sekunde
  interpDelay: 0.12,   // s Interpolationspuffer beim Client
  playersEvery: 10,    // Spielerliste/Statistik jeden n-ten Snapshot
  readyTimeout: 25,    // s, die der Host auf das Laden der Clients wartet
  attackPingEvery: 6,  // s Drossel „unter Beschuss“ je Spieler
  loadTimeoutMs: 120000, // Verbindungs-Timeout während alle laden (Karte bauen blockiert den Hauptthread)
};
// Während des Ladens großzügiger Heartbeat-Timeout (Transport-Option zur Laufzeit), danach wieder der normale Wert
function relaxTimeout(lobby) { const o = lobby.transport.opts; if (!o._normalTimeout) o._normalTimeout = o.peerTimeoutMs; o.peerTimeoutMs = Math.max(o.peerTimeoutMs, NET.loadTimeoutMs); }
function restoreTimeout(lobby) { const o = lobby.transport.opts; if (o._normalTimeout) o.peerTimeoutMs = o._normalTimeout; }

// Einheiten-Schema: [id, typ, owner, x, z, heading, hp, maxHp, turm/fernglas, flags, flughöhe, munition, sprit, material, bau, haus]
export const UNIT_CODEC = createCodec([
  { name: 'id', type: 'uint', delta: true }, { name: 'type', type: 'uint' }, { name: 'owner', type: 'int' },
  { name: 'x', type: 'fixed', step: 1 / 32 }, { name: 'z', type: 'fixed', step: 1 / 32 }, { name: 'h', type: 'angle', bits: 8 },
  { name: 'hp', type: 'fixed', step: 1, keepPositive: true }, { name: 'maxHp', type: 'uint' }, { name: 'ty', type: 'angle', bits: 8 },
  { name: 'flags', type: 'uint' }, { name: 'alt', type: 'fixed', step: 0.25 }, { name: 'stock', type: 'int' },
  { name: 'fuel', type: 'uint' }, { name: 'mat', type: 'uint' }, { name: 'build', type: 'uint' }, { name: 'gh', type: 'uint' },
]);
export const F = { moving: 1, hold: 2, immob: 4, abandoned: 8, bino: 16, garrison: 32, dive: 64, UA: 128, RU: 256, hot: 512, fired: 1024, work: 2048 };
const r1 = (v) => Math.round(v * 10) / 10;

/** Spielerliste (game.setupPlayers) aus den Lobby-Slots der Start-Nachricht. */
export function playersFromStart(info, myId) {
  const n = info.settings.playersPerTeam;
  const out = [];
  for (const s of info.slots) {
    if (s.kind !== 'human' && s.kind !== 'ai') continue;
    const pos = s.team === 'RU' ? s.slot - n : s.slot;
    const ai = s.kind === 'ai';
    out.push({
      id: s.slot, team: s.team, slot: pos, role: ROLES[s.role] ? s.role : ROLE_ORDER[pos % ROLE_ORDER.length],
      name: ai ? `${CALLSIGNS[s.team][pos % 6]} (KI)` : (s.name || `Spieler ${s.slot + 1}`), color: s.color,
      ai, local: s.slot === myId, remote: !ai && s.slot !== myId, difficulty: s.difficulty || info.settings.difficulty || 'normal',
    });
  }
  return out;
}
/** Gefechts-Setup (createSkirmish) aus der Start-Nachricht – auf allen Rechnern identisch bis auf netRole/team. */
export function setupFromStart(info, myId, role) {
  const st = info.settings;
  const S = normalizeSetup({
    mode: st.playersPerTeam, preset: st.preset || 'random', size: st.size, season: st.season, night: !!st.night,
    difficulty: st.difficulty || 'normal', reinforce: st.reinforce || 180, victory: st.victory || 'points', seed: info.seed,
  });
  S.players = playersFromStart(info, myId);
  S.team = S.players.find((p) => p.local)?.team || 'UA';
  S.netRole = role;
  S.online = true;
  return S;
}

// Flugkörper (Host): Start/Ende als Event weiterreichen (einmalig installiert, offline ohne Wirkung)
const _reg = Missile.prototype.register, _rem = Missile.prototype.remove;
Missile.prototype.register = function () { const r = _reg.call(this); this.game.net?.onMissile?.(this); return r; };
Missile.prototype.remove = function () { _rem.call(this); this.game.net?.onMissileGone?.(this); };

// =====================================================================================================================
export class HostSession {
  constructor(game, lobby, info, S) {
    this.game = game; this.lobby = lobby; this.info = info; this.S = S;
    this.isHost = true;
    this.loaded = false;
    this.ready = new Set();          // Spieler-ids, die fertig geladen haben
    this.gone = new Set();           // Spieler-ids, die das Spiel verlassen haben
    this.remote = S.players.filter((p) => p.remote).map((p) => p.id);
    this.q = new Map();              // playerId → Event-Liste (dieses Frame)
    this.teamQ = { UA: [], RU: [] };
    this.snapT = 0; this.snapN = 0; this.missileSeq = 0;
    this.lastPing = new Map();
    this.stats = { snaps: 0, bytes: {}, evBytes: {}, ticks: 0, tickMs: 0, tickMax: 0, snapMs: 0, cmds: 0, cmdsRejected: 0, takeovers: 0 };
    this.unsub = [];
    const g = game;
    // Vertrag game.net (Host)
    this.net = {
      isHost: true, isClient: false, session: this,
      sendCommand: (cmd) => g.command(g.localPlayerId, cmd),
      feedback: (to, kind, args) => this._feedback(to, kind, args),
      attacked: (u) => this._attacked(u),
      onMissile: (m) => this._onMissile(m),
      onMissileGone: (m) => this._onMissileGone(m),
    };
    relaxTimeout(lobby);
    this.unsub.push(lobby.on('cmd', (pid, cmd) => this._onCmd(pid, cmd)));
    this.unsub.push(lobby.on('left', (info2) => this._onLeft(info2)));
    this._onKill = (u, killer, silent) => this._kill(u, silent);
    this._onBuilt = (u) => this._teamEvent(u.side, ['bt', u.id]);
  }
  get connected() { return this.remote.filter((id) => !this.gone.has(id)); }
  // Nach game.load: Effekt-/Ton-Abgriff installieren, auf Clients warten
  onLoaded() {
    const g = this.game;
    this.loaded = true;
    this.sk = g.mission.skirmish;
    g.on('kill', this._onKill); g.on('built', this._onBuilt);
    this._tap();
    this.waitT = NET.readyTimeout;
    g.paused = this.connected.some((id) => !this.ready.has(id));
    this._waitNote();
  }
  _waitNote() {
    const missing = this.connected.filter((id) => !this.ready.has(id));
    const names = missing.map((id) => this.game.playerById(id)?.name).filter(Boolean);
    this.onWait?.(missing.length ? `Warte auf Mitspieler: ${names.join(', ')} …` : '');
  }
  // ---------------- Abgriff der Effekte/Töne (nur sichtbare Ereignisse je Team) ----------------
  _tap() {
    const g = this.game, fx = g.effects, au = g.audio, self = this;
    this._fx = fx; this._au = au;
    const o = this._orig = { explosion: fx.explosion, muzzle: fx.muzzle, tracer: fx.tracer, smallHit: fx.smallHit, shot: au.shot, drone: au.drone, boom: au.boom, addReveal: g.addReveal };
    fx.explosion = function (x, y, z, size = 1, opt = {}) {
      o.explosion.call(this, x, y, z, size, opt);
      if (!g._inDie) self._fxAt(x, z, ['x', r1(x), r1(y), r1(z), r1(size), (opt.crater === false ? 1 : 0) | (opt.sound === false ? 2 : 0) | (opt.water ? 4 : 0) | (opt.air ? 8 : 0)]);
    };
    fx.muzzle = function (x, y, z, big = false) { o.muzzle.call(this, x, y, z, big); if (!g._inDie) self._fxAt(x, z, ['m', r1(x), r1(y), r1(z), big ? 1 : 0]); };
    fx.tracer = function (a, b, color = 'y', speed = 300) { o.tracer.call(this, a, b, color, speed); self._fxAt(a.x, a.z, ['t', r1(a.x), r1(a.y), r1(a.z), r1(b.x), r1(b.y), r1(b.z), color, speed], b.x, b.z); };
    fx.smallHit = function (x, y, z) { o.smallHit.call(this, x, y, z); self._fxAt(x, z, ['h', r1(x), r1(y), r1(z)]); };
    au.shot = function (kind, x, z) { o.shot.call(this, kind, x, z); self._fxAt(x, z, ['s', kind, r1(x), r1(z)]); };
    au.drone = function (x, z) { o.drone.call(this, x, z); self._fxAt(x, z, ['d', r1(x), r1(z)]); };
    au.boom = function () { o.boom.call(this); for (const t of ['UA', 'RU']) self.teamQ[t].push(['b']); };
    g.addReveal = function (x, z, r, t, team = g.localSide) { o.addReveal.call(g, x, z, r, t, team); self._teamEvent(team, ['rv', r1(x), r1(z), r, t]); };
  }
  _untap() {
    const o = this._orig; if (!o) return;
    delete this._fx.explosion; delete this._fx.muzzle; delete this._fx.tracer; delete this._fx.smallHit; // Prototyp-Methoden wieder wirksam
    delete this._au.shot; delete this._au.drone; delete this._au.boom;
    delete this.game.addReveal;
    this._orig = null;
  }
  _teamHasRemote(team) { return this.connected.some((id) => this.game.playerById(id)?.team === team); }
  _fxAt(x, z, ev, x2, z2) {
    const g = this.game;
    for (const t of ['UA', 'RU']) {
      if (!this._teamHasRemote(t)) continue;
      const f = g.fows[t];
      if (f.isVisible(x, z) || (x2 !== undefined && f.isVisible(x2, z2))) this.teamQ[t].push(ev);
    }
  }
  _teamEvent(team, ev) { if (team === 'UA' || team === 'RU') { if (this._teamHasRemote(team)) this.teamQ[team].push(ev); } }
  _push(pid, ev) { if (!this.gone.has(pid) && this.remote.includes(pid)) { let l = this.q.get(pid); if (!l) this.q.set(pid, (l = [])); l.push(ev); } }
  _feedback(to, kind, args) {
    const g = this.game;
    for (const id of this.connected) {
      const p = g.playerById(id); if (!p) continue;
      const hit = to === null || to === undefined || ((to === 'UA' || to === 'RU') ? p.team === to : String(to) === String(id));
      if (hit) this._push(id, ['fb', kind, args]);
    }
  }
  _attacked(u) {
    const id = u.owner;
    if (id === null || !this.connected.includes(id)) return;
    const t = this.game.time;
    if (t - (this.lastPing.get(id) ?? -99) < NET.attackPingEvery) return;
    this.lastPing.set(id, t);
    this._push(id, ['ua', u.id]);
  }
  _kill(u, silent) {
    for (const t of ['UA', 'RU']) {
      if (!this._teamHasRemote(t)) continue;
      if (u.side === t || u.side === 'N' || u.seenBy?.[t] || u.prevSide === t) this.teamQ[t].push(['k', u.id, silent ? 1 : 0]);
    }
  }
  _onMissile(m) {
    const g = this.game;
    m.nid = ++this.missileSeq;
    m.netTeams = [];
    const d = { i: m.nid, f: [r1(m.pos.x), r1(m.pos.y), r1(m.pos.z)], to: [r1(m.end.x), r1(m.end.y), r1(m.end.z)], mo: m.mode, sp: m.speed, ar: r1(m.arc || 0), md: m.model, sc: m.scale, tr: m.trail, sd: m.side };
    if (m.target?.id !== undefined) d.tg = m.target.id;
    if (m.targetMissile?.nid) d.tm = m.targetMissile.nid;
    if (m.cruiseAlt) d.ca = m.cruiseAlt;
    if (m.threat) d.th = m.threat;
    for (const t of ['UA', 'RU']) {
      if (!this._teamHasRemote(t)) continue;
      const f = g.fows[t];
      if (m.side === t || f.isVisible(m.pos.x, m.pos.z) || f.isVisible(m.end.x, m.end.z)) { this.teamQ[t].push(['ms', d]); m.netTeams.push(t); }
    }
  }
  _onMissileGone(m) { for (const t of m.netTeams || []) this.teamQ[t].push(['mx', m.nid]); m.netTeams = null; }

  // ---------------- Eingänge ----------------
  _onCmd(pid, cmd) {
    const g = this.game;
    if (cmd?.t === 'netReady') { this.ready.add(pid); if (this.loaded) this._waitNote(); return; }
    if (!this.loaded || !g.active || g.ended) return;
    if (pid === g.localPlayerId) return; // Host steuert direkt
    const ok = g.command(pid, cmd);
    this.stats.cmds++; if (!ok) this.stats.cmdsRejected++;
    if (!ok && cmd && typeof cmd === 'object') this._push(pid, ['fb', 'ui', ['fail']]);
  }
  // Client weg → KI übernimmt seinen Slot
  _onLeft(info) {
    const g = this.game, pid = info.playerId;
    if (info.host || !this.remote.includes(pid) || this.gone.has(pid)) return;
    this.gone.add(pid);
    this.goneInfo = { ...(this.goneInfo || {}), [pid]: { reason: info.reason, t: this.game.time, loaded: this.loaded, ready: this.ready.has(pid) } };
    this.q.delete(pid);
    const p = g.playerById(pid);
    const why = info.reason === 'timeout' ? 'Verbindung verloren' : 'hat das Spiel verlassen';
    if (p && this.loaded && !g.ended) {
      p.remote = false; p.ai = true;
      p.name = `${info.name || p.name} (KI)`;
      const sk = g.mission?.skirmish;
      if (sk && !p.defeated) sk.ais.push(new AICommander(g, sk, p, { difficulty: this.S.difficulty, phase: 0.3 }));
      this.stats.takeovers++;
      const txt = `${info.name || 'Ein Spieler'} ${why} – die KI übernimmt seine Einheiten.`;
      g.alertTo(null, txt, 5);
      this._feedback(null, 'chat', [txt]); this.onSys?.(txt); // zusätzlich dauerhaft im Chat-Protokoll
      g.emit('players');
      this.snapN = NET.playersEvery - 1; // Spielerliste sofort neu senden
    } else if (p) { p.remote = false; p.ai = true; }
    if (this.loaded) this._waitNote();
  }

  // ---------------- Pro Frame (nach game.update) ----------------
  update(dt) {
    if (!this.loaded) return;
    const g = this.game;
    if (this.waitT > 0 && g.paused && !g.ended) {
      this.waitT -= dt;
      const missing = this.connected.filter((id) => !this.ready.has(id));
      if (!missing.length || this.waitT <= 0) { g.paused = false; this.waitT = 0; this.onWait?.(''); setTimeout(() => restoreTimeout(this.lobby), 5000); }
    }
    this._flush();
    this.snapT -= dt;
    if (this.snapT <= 0) { this.snapT += 1 / NET.snapHz; if (this.snapT < 0) this.snapT = 0; this._sendSnapshots(); }
  }
  _flush() {
    const g = this.game, t = r1(g.time);
    for (const id of this.connected) {
      const p = g.playerById(id); if (!p) continue;
      const tq = this.teamQ[p.team], own = this.q.get(id);
      if (!tq.length && !own?.length) continue;
      const l = own?.length ? tq.concat(own) : tq;
      const msg = { t, l };
      this._count('evBytes', id, msg);
      this.lobby.sendEvent(msg, id);
    }
    this.teamQ.UA = []; this.teamQ.RU = []; this.q.clear();
  }
  _count(k, id, msg) { this.stats[k][id] = (this.stats[k][id] || 0) + JSON.stringify(msg).length + 24; }
  _sendSnapshots() {
    const g = this.game, sk = this.sk;
    const t0 = performance.now();
    this.snapN++;
    const withPlayers = this.snapN % NET.playersEvery === 1 || NET.playersEvery <= 1;
    const common = { t: r1(g.time) };
    if (sk) {
      common.sk = { p: netPointState(sk), s: [sk.scores.UA, sk.scores.RU], r: r1(sk.reinfT), c: sk.reinfCycle, i: sk.interval };
      if (sk.result) common.res = sk.result;
    }
    // Spielerliste je Team: Einheitenzahl und „wartet“ nur für das eigene Team (MP-T6: keine Feindstärke über das Netz)
    const plFor = {};
    if (withPlayers) {
      const rows = g.players.map((p) => {
        let n = 0; for (const u of g.units) if (u.alive && u.owner === p.id && !u.type.structure && !u.type.kamikaze) n++;
        const s = p.stats;
        return [p.id, p.name, p.ai ? 1 : 0, p.defeated ? 1 : 0, p.waiting ? 1 : 0, s.kills, s.lost, s.captured || 0, s.reinf || 0, n, s.shots || 0, s.intercepts || 0];
      });
      for (const T of ['UA', 'RU']) plFor[T] = rows.map((r, i) => (g.players[i].team === T ? r : [r[0], r[1], r[2], r[3], 0, r[5], r[6], r[7], r[8], -1, r[10], r[11]]));
    }
    const enc = {};
    for (const team of ['UA', 'RU']) if (this._teamHasRemote(team)) enc[team] = UNIT_CODEC.encode(this.teamEntries(team));
    for (const id of this.connected) {
      const p = g.playerById(id); if (!p) continue;
      const msg = { ...common, ...(withPlayers ? { pl: plFor[p.team] } : {}), u: enc[p.team], me: { ab: p.abilities.map((a) => [Math.round(a.cd * 10), a.charges === Infinity ? -1 : a.charges]) } };
      this._count('bytes', id, msg);
      this.lobby.sendSnap(msg, id);
    }
    this.stats.snaps++;
    this.stats.snapMs += performance.now() - t0;
  }
  /** Einträge für ein Team: eigene/verbündete vollständig, Feinde nur bei Sicht, Strukturen nur erkundet. */
  teamEntries(T) {
    const g = this.game, fow = g.fows[T], out = [];
    for (const u of g.units) {
      if (!u.alive) continue;
      const t = u.type;
      if (t.cp) continue;
      let inc = false;
      if (t.key === 'house') {
        const occ = u.occupants?.length > 0;
        const hot = occ && u.garrisonSide !== T && g.time - u.revealT < 5;
        inc = fow.isExplored(u.pos.x, u.pos.z) && (u.hp < u.maxHp - 0.5 || (occ && u.garrisonSide === T) || hot);
        if (inc) out.push(this.houseEntry(u, T, hot));
        continue;
      }
      if (u.side === T) inc = true;
      else if (u.abandoned) inc = fow.isExplored(u.pos.x, u.pos.z);
      else if (u.side === 'N') inc = false;
      else if (t.structure) inc = t.build?.hidden ? !!u.seenBy[T] : fow.isExplored(u.pos.x, u.pos.z);
      else inc = !!u.seenBy[T] && !u.garrison;
      if (inc) out.push(this.unitEntry(u, T));
    }
    out.sort((a, b) => a[0] - b[0]);
    return out;
  }
  unitEntry(u, T) {
    const g = this.game, own = u.side === T || (u.abandoned && u.prevSide === T);
    let f = 0;
    if (u.moving) f |= F.moving;
    if (u.holdFire) f |= F.hold;
    if (u.immobilized) f |= F.immob;
    if (u.abandoned) f |= F.abandoned;
    if (u.bino?.on) f |= F.bino;
    if (u.garrison) f |= F.garrison;
    if (u.diving) f |= F.dive;
    const side = u.abandoned ? u.prevSide : u.side;
    if (side === 'UA') f |= F.UA; else if (side === 'RU') f |= F.RU;
    if (u.lastFired && g.time - u.lastFired < 2) f |= F.fired;
    if (u.working && g.time - u.working < 0.5) f |= F.work;
    const am = own ? u.ammoInfo() : null;
    return [u.id, TYPE_IDX.get(u.type.key), u.owner ?? -1, u.pos.x, u.pos.z, u.heading, Math.max(0, u.hp), u.maxHp, u.bino ? u.bino.yaw : u.turretYaw, f,
      u.type.air ? u.curAlt : 0, am ? Math.floor(am.cur + 1e-6) : -1, own && u.maxFuel ? Math.round(u.fuel) : 0,
      own && u.maxMaterial ? Math.round(u.material * 10) : 0, u.build ? Math.round(Math.min(1, u.build.progress) * 250) : 0, u.garrison ? u.garrison.id : 0];
  }
  houseEntry(h, T, hot) {
    let f = 0;
    const occ = h.occupants?.length || 0;
    const mine = occ && h.garrisonSide === T;
    if (mine || hot) f |= h.garrisonSide === 'RU' ? F.RU : F.UA;
    if (hot) f |= F.hot;
    return [h.id, TYPE_IDX.get('house'), -1, h.pos.x, h.pos.z, h.heading, Math.max(0, h.hp), h.maxHp, 0, f, 0, -1, 0, 0, 0, mine ? occ : 0];
  }
  /** Bandbreite/Leistung für Tests. */
  report() {
    const s = this.stats, out = { snaps: s.snaps, avgSnapMs: s.snaps ? s.snapMs / s.snaps : 0, perPlayer: {} };
    for (const id of this.remote) out.perPlayer[id] = { snapBytes: s.bytes[id] || 0, eventBytes: s.evBytes[id] || 0 };
    out.cmds = s.cmds; out.cmdsRejected = s.cmdsRejected; out.takeovers = s.takeovers;
    return out;
  }
  dispose() {
    const g = this.game;
    this._untap();
    g.off('kill', this._onKill); g.off('built', this._onBuilt);
    for (const u of this.unsub) u();
    if (g.net === this.net) g.net = null;
  }
}

// =====================================================================================================================
export class ClientSession {
  constructor(game, lobby, info, S) {
    this.game = game; this.lobby = lobby; this.info = info; this.S = S;
    this.isHost = false;
    this.loaded = false;
    this.pending = null;            // letzter Snapshot während des Ladens
    this.batches = [];              // verzögerte Event-Bündel (auf Interpolationszeit)
    this.offset = null;             // Hostzeit − lokale Zeit (geglättet)
    this.renderT = 0;
    this.missiles = new Map();
    this.stats = { snaps: 0, events: 0, bytes: 0, t0: performance.now(), maxUnits: 0, errors: 0 };
    this.lastSnapUnits = 0;
    this.unsub = [];
    const g = game;
    this.net = {
      isHost: false, isClient: true, session: this,
      sendCommand: (cmd) => this.sendCommand(cmd),
    };
    relaxTimeout(lobby);
    this.unsub.push(lobby.on('snap', (s) => this._onSnap(s)));
    this.unsub.push(lobby.on('event', (e) => this._onEvent(e)));
  }
  sendCommand(cmd) {
    const g = this.game;
    if (!cmd || typeof cmd !== 'object') return false;
    this.lobby.sendCmd(cmd);
    // Sofortige Rückmeldung (Ton, Marker) – ausgeführt wird auf dem Host
    if (cmd.t === 'move') { g.audio.ui('ack'); g.effects?.marker(cmd.x, cmd.z, cmd.attackMove ? 0xffa030 : 0x5dff8a, 0.8, 2); }
    else if (cmd.t === 'attack') { const t = g.unitById(cmd.target); g.audio.ui('ack'); if (t) g.effects?.marker(t.pos.x, t.pos.z, 0xff4040, 0.8, Math.max(2, t.radius + 1)); }
    else if (cmd.t === 'stop' || cmd.t === 'hold') g.audio.ui('ack');
    return true;
  }
  onLoaded() {
    this.loaded = true;
    this.sk = this.game.mission.skirmish;
    this.lobby.sendCmd({ t: 'netReady' });
    if (this.pending) { const s = this.pending; this.pending = null; this._applySnap(s); }
  }
  _onSnap(s) {
    this.stats.bytes += JSON.stringify(s).length + 24;
    this.stats.snaps++;
    if (!this.loaded) { this.pending = s; return; }
    try { this._applySnap(s); } catch (e) { this.stats.errors++; console.error('[net] Snapshot', e); }
  }
  _onEvent(e) {
    this.stats.bytes += JSON.stringify(e).length + 24;
    this.stats.events++;
    if (!e || !Array.isArray(e.l)) return;
    if (!this.loaded) { for (const ev of e.l) if (ev[0] === 'fb') this._applyEvent(ev); return; } // nur Funk/Warnungen
    // Funk/Warnungen/Ton sofort, Effekte zur passenden (interpolierten) Zeit
    const later = [];
    for (const ev of e.l) { if (ev[0] === 'fb' || ev[0] === 'ua') this._safe(ev); else later.push(ev); }
    if (later.length) this.batches.push({ t: e.t, l: later });
  }
  _safe(ev) { try { this._applyEvent(ev); } catch (err) { this.stats.errors++; console.error('[net] Event', ev[0], err); } }

  // ---------------- Pro Frame (vor game.update) ----------------
  update(dt) {
    if (!this.loaded) return;
    const now = performance.now() / 1000;
    if (this.offset !== null) {
      const rt = now + this.offset - NET.interpDelay;
      this.renderT = Math.max(this.renderT, rt);
      this.game.netRenderT = this.renderT;
    }
    while (this.batches.length && this.batches[0].t <= this.renderT + 0.02) {
      const b = this.batches.shift();
      for (const ev of b.l) this._safe(ev);
    }
    const g = this.game;
    for (const u of [...g.units]) if (u.remote && u.alive && u.netGoneT != null && u.netGoneT <= this.renderT + 0.02) this._vanish(u);
    if (this.batches.length > 200) this.batches.splice(0, this.batches.length - 200);
  }

  // ---------------- Snapshot anwenden ----------------
  _applySnap(s) {
    const g = this.game;
    if (!g.active) return;
    if (!this._restoreSet) { this._restoreSet = true; setTimeout(() => restoreTimeout(this.lobby), 5000); } // Host ist geladen und sendet
    const now = performance.now() / 1000;
    const off = s.t - now;
    if (this.offset === null || Math.abs(off - this.offset) > 1.5) { this.offset = off; this.renderT = s.t - NET.interpDelay; }
    else this.offset += (off - this.offset) * 0.08;
    if (Math.abs(g.time - s.t) > 1) g.time = s.t;
    // Einheiten
    const seen = new Set();
    if (typeof s.u === 'string') {
      const entries = UNIT_CODEC.decode(s.u);
      for (const e of entries) { seen.add(e[0]); this._applyUnit(e, s.t); }
      this.lastSnapUnits = entries.length;
      if (entries.length > this.stats.maxUnits) this.stats.maxUnits = entries.length;
    }
    // Nicht mehr gemeldete Einheiten verschwinden zur Interpolationszeit (ein Tod-Event derselben Zeit wird vorher abgespielt)
    for (const u of g.units) if (u.remote && u.alive && !seen.has(u.id) && u.netGoneT == null) u.netGoneT = s.t;
    // Eigene Fähigkeiten
    const lp = g.localPlayer;
    if (s.me?.ab && lp) {
      let changed = false;
      s.me.ab.forEach((x, i) => {
        const a = lp.abilities[i]; if (!a) return;
        const ch = x[1] < 0 ? Infinity : x[1];
        if (a.charges !== ch) { a.charges = ch; changed = true; }
        a.cd = x[0] / 10;
      });
      if (changed) g.emit('abilities');
    }
    // Spieler/Statistik
    if (s.pl) {
      for (const r of s.pl) {
        const p = g.playerById(r[0]); if (!p) continue;
        p.name = r[1]; p.ai = !!r[2];
        if (r[3] && !p.defeated) { p.defeated = true; g.emit('playerDefeated', p); }
        p.waiting = !!r[4];
        Object.assign(p.stats, { kills: r[5], lost: r[6], captured: r[7], reinf: r[8], shots: r[10] || 0, intercepts: r[11] || 0 });
        p.netUnits = r[9];
      }
    }
    // Gefecht: Punkte, Punktestand, Countdown, Ergebnis
    const sk = this.sk;
    if (sk && s.sk) {
      applyNetPoints(g, sk, s.sk.p);
      sk.scores.UA = s.sk.s[0]; sk.scores.RU = s.sk.s[1];
      const prevCycle = sk.reinfCycle;
      sk.reinfT = s.sk.r; sk.reinfCycle = s.sk.c; if (s.sk.i) sk.interval = s.sk.i;
      if (prevCycle !== sk.reinfCycle) g.emit('abilities');
    }
    if (sk && s.res && !sk.result) { sk.result = s.res; if (!g.ended) endFor(g, s.res); }
  }
  _applyUnit(e, t) {
    const g = this.game;
    const [id, ti, owner, x, z, h, hp, maxHp, ty, f, alt, stock, fuel, mat, build, gh] = e;
    const key = TYPE_KEYS[ti];
    const type = UNIT_TYPES[key];
    if (!type) return;
    const sideBits = f & F.UA ? 'UA' : f & F.RU ? 'RU' : 'N';
    let u = g.unitById(id);
    if (key === 'house') {
      if (!u || !u.alive) return;
      u.hp = hp; if (maxHp) u.maxHp = maxHp;
      if (sideBits !== 'N') u.garrisonSide = sideBits;
      if (f & F.hot) u.revealT = g.time;
      return;
    }
    if (u && (!u.alive || !u.remote || u.type !== type)) { if (u.remote && u.alive) this._vanish(u); u = null; }
    if (u) u.netGoneT = null;
    const abandoned = !!(f & F.abandoned);
    const side = abandoned ? 'N' : sideBits;
    if (!u) {
      const opts = { id, owner: owner < 0 ? undefined : owner, heading: h, noBlock: true };
      if (type.structure) opts.rot = h;
      if (type.build) { opts.build = { progress: build / 250, time: type.build.time, kind: key }; opts.mines = type.build.mines || 0; }
      u = g.spawn(key, sideBits === 'N' ? 'UA' : sideBits, x, z, opts);
      u.remote = true; u.ai = null;
      u.net = { buf: [] };
      if (sideBits === 'N') { u.side = 'N'; u.owner = null; }
      if (type.build) g.logi.setProgress(u, build / 250);
      u.pos.x = x; u.pos.z = z; u.heading = h;
      if (type.air) u.curAlt = alt;
      if (!type.structure) u.place(0);
    }
    // Besitz/Seite (Aussteigen, Übernahme)
    const own = owner < 0 ? null : owner;
    if (abandoned !== !!u.abandoned || u.side !== side || u.owner !== own) {
      u.abandoned = abandoned;
      if (abandoned) { u.prevSide = sideBits; u.seenBy = { UA: true, RU: true }; u.root.visible = true; }
      u.side = side; u.owner = abandoned ? null : own;
      if (u.ring) u.ring.material = g.ringMatFor(u);
      if (g.selected.includes(u)) { if (abandoned) g.select(g.selected.filter((q) => q !== u)); else g.emit('selection'); }
    }
    u.hp = hp; u.maxHp = maxHp || u.maxHp;
    u.moving = !!(f & F.moving);
    u.holdFire = !!(f & F.hold);
    u.immobilized = !!(f & F.immob);
    u.diving = !!(f & F.dive);
    if (u.bino) u.bino.on = !!(f & F.bino);
    if (f & F.fired) u.lastFired = g.time;
    if (f & F.work) u.working = g.time;
    if (stock >= 0) { const ws = u.weapons.find((w) => w.stockMax !== Infinity); if (ws) ws.stock = stock; }
    if (u.maxFuel) u.fuel = fuel;
    if (u.maxMaterial && (u.side === g.localSide)) u.material = mat / 10;
    if (u.build && Math.abs(u.build.progress - build / 250) > 1e-3) g.logi.setProgress(u, build / 250);
    // Gebäude-Besatzung
    const house = f & F.garrison ? g.unitById(gh) : null;
    if (house !== (u.garrison || null)) { if (u.garrison) this._leave(u); if (house && house.alive) this._enter(u, house); }
    // Interpolationspuffer
    const b = u.net.buf;
    const last = b[b.length - 1];
    if (!last || t > last.t) b.push({ t, x, z, h, ty, alt });
    if (b.length > 12) b.splice(0, b.length - 12);
  }
  _enter(u, h) {
    (h.occupants ||= []).push(u);
    h.garrisonSide = u.side;
    u.garrison = h;
    u.root.visible = false;
    this.game.gar.updateBadge(h);
    this.game.emit('selection');
  }
  _leave(u) {
    const h = u.garrison;
    if (!h) return;
    const i = h.occupants?.indexOf(u) ?? -1;
    if (i >= 0) h.occupants.splice(i, 1);
    u.garrison = null;
    if (h.alive) this.game.gar.updateBadge(h);
    this.game.emit('selection');
  }
  // Einheit verschwindet ohne Tod (außer Sicht, an Bord gegangen, abgebaut)
  _vanish(u) {
    const g = this.game;
    if (u.garrison) this._leave(u);
    u.alive = false;
    g.scene.remove(u.root);
    if (u._cone) u._cone.visible = false;
    g.removeUnit(u);
  }

  // ---------------- Events ----------------
  _applyEvent(ev) {
    const g = this.game, fx = g.effects;
    switch (ev[0]) {
      case 'x': fx.explosion(ev[1], ev[2], ev[3], ev[4], { crater: !(ev[5] & 1), sound: !(ev[5] & 2), water: !!(ev[5] & 4), air: !!(ev[5] & 8) }); break;
      case 'm': fx.muzzle(ev[1], ev[2], ev[3], !!ev[4]); break;
      case 't': fx.tracer(new THREE.Vector3(ev[1], ev[2], ev[3]), new THREE.Vector3(ev[4], ev[5], ev[6]), ev[7], ev[8]); break;
      case 'h': fx.smallHit(ev[1], ev[2], ev[3]); break;
      case 's': g.audio.shot(ev[1], ev[2], ev[3]); break;
      case 'd': g.audio.drone(ev[1], ev[2]); break;
      case 'b': g.audio.boom(); break;
      case 'k': { // Tod / Wrack
        const u = g.unitById(ev[1]);
        if (!u || !u.alive) break;
        if (u.garrison) this._leave(u);
        if (u.occupants?.length) { for (const o of [...u.occupants]) this._leave(o); u.occupants = []; }
        u.die(null, !!ev[2]);
        g.removeUnit(u);
        break;
      }
      case 'ms': { // Flugkörperstart (nur Optik)
        const d = ev[1];
        const tgt = d.tg !== undefined ? g.unitById(d.tg) : null;
        const tm = d.tm ? this.missiles.get(d.tm) : null;
        const m = new Missile(g, {
          from: new THREE.Vector3(...d.f), to: new THREE.Vector3(...d.to), target: tgt && tgt.alive ? tgt : null, targetMissile: tm && !tm.dead ? tm : null,
          mode: d.mo, speed: d.sp, arc: d.ar, model: d.md, scale: d.sc, trail: d.tr, side: d.sd, threat: d.th || null, cruiseAlt: d.ca,
        });
        m.nid = d.i;
        m.register();
        this.missiles.set(d.i, m);
        if (this.missiles.size > 300) for (const [k, mm] of this.missiles) { if (mm.dead) this.missiles.delete(k); }
        break;
      }
      case 'mx': { const m = this.missiles.get(ev[1]); if (m) { if (!m.dead) { m.dead = true; m.remove(); } this.missiles.delete(ev[1]); } break; }
      case 'rv': g.reveals.push({ x: ev[1], z: ev[2], r: ev[3], t: ev[4], team: g.localSide }); g.visionT = 0; break;
      case 'bt': { const u = g.unitById(ev[1]); if (u) { fx.marker(u.pos.x, u.pos.z, 0x5dff8a, 0.8, 3); if (g.isOwn(u)) { g.alert(`🔨 ${u.name} fertig`, 2); g.audio.ui('ack'); } } break; }
      case 'ua': { const u = g.unitById(ev[1]); if (u && u.alive) g.emit('underAttack', u); break; }
      case 'fb': {
        const [kind, a] = [ev[1], ev[2] || []];
        if (kind === 'say') g.say(...a);
        else if (kind === 'alert') g.alert(...a);
        else if (kind === 'ui') g.audio.ui(a[0]);
        else if (kind === 'marker') fx?.marker(...a);
        else if (kind === 'chat') this.onSys?.(a[0]);
        break;
      }
    }
  }
  report() {
    const secs = (performance.now() - this.stats.t0) / 1000;
    return { snaps: this.stats.snaps, events: this.stats.events, bytes: this.stats.bytes, bytesPerSec: this.stats.bytes / Math.max(1, secs), maxUnits: this.stats.maxUnits, units: this.lastSnapUnits, errors: this.stats.errors };
  }
  dispose() {
    for (const u of this.unsub) u();
    if (this.game.net === this.net) this.game.net = null;
  }
}

export { TEAM_NAME };
