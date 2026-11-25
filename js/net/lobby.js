// Lobby-Protokoll für Online-Team-Gefechte (bis 6 gegen 6, gemischt mit KI-Slots).
//
// Host-autoritativ: Der Host hält den Lobby-Zustand, Clients senden nur Wünsche
// (Name, Team, Bereit) und bekommen nach jeder Änderung den vollständigen Zustand.
// Ab Spielstart reicht die Lobby nur noch Spielnachrichten durch:
//   'cmd'   Client→Host  {playerId, cmd}     (Host setzt playerId selbst aus der Sitzzuordnung)
//   'snap'  Host→alle    (oder an einen Spieler – z. B. teamweise Sicht)
//   'event' Host→alle    (oder an einen Spieler)
//   'chat'  alle         (läuft über den Host, optional nur ans eigene Team)
//
//   const lobby = new Lobby(createTransport('local'), { name: 'Anna' });
//   lobby.on('update', state => …); lobby.on('start', info => …);
//   await lobby.hostLobby({ size: 'medium', playersPerTeam: 3 });   // Host
//   await lobby.joinLobby('stst-K7PXM');                             // Client
//
// Spieler-IDs = Slot-Index (0..11). Slots 0..n-1 = Team UA, n..2n-1 = Team RU (n = playersPerTeam).
//
// Erweiterung MP-T5: optionale Rolle je Slot (slot.role, z. B. 'armor'|'infantry'|'support'|'logistics'):
//   setRole(role) – eigener Slot (Client → Host 'setRole'); setSlot(idx, 'ai', { role }) / setSlotRole(idx, role) – Host.
//   Ohne slot.role bestimmt die Integration die Rolle aus der Position im Team. Zusätzliche Einstellungen
//   (preset, night, reinforce, victory, difficulty …) reicht updateSettings unverändert durch.

// V3-RS: Version 2 – Zuschauerplätze (state.specs, ids ab SPEC_ID0), Koop-Vorgabe (settings.coop), Wiederholungs-Anfrage.
//   Zuschauer: hello {spectate:true} bzw. 'setSpectate' {on}; im Spiel 'specView' {view:'all'|'UA'|'RU'} → emit('specView', id, view);
//   'replayReq' (Spieler oder Zuschauer) → emit('replayReq', id). Zuschauer stehen in startInfo.spectators und startInfo.assignments.
export const PROTOCOL_VERSION = 2;
export const MAX_SPECTATORS = 4;
export const SPEC_ID0 = 100;
export const TEAMS = ['UA', 'RU'];
export const MAX_PER_TEAM = 6;
export const SIZES = ['small', 'medium', 'large'];
export const SLOT_KINDS = ['open', 'human', 'ai', 'closed'];

// Farben je Team-Position (gut unterscheidbar, Team UA kühl/gelb, Team RU warm)
export const TEAM_COLORS = {
  UA: ['#3b82f6', '#facc15', '#22d3ee', '#a3e635', '#818cf8', '#2dd4bf'],
  RU: ['#ef4444', '#f97316', '#e879f9', '#b45309', '#f43f5e', '#fb7185'],
};

const DEFAULT_SETTINGS = { size: 'medium', season: 'summer', playersPerTeam: 2, seed: 0, fillAI: true };
const JOIN_TIMEOUT = 6000;

function lobbyError(message, code = 'lobby') {
  const e = new Error(message);
  e.code = code;
  return e;
}

function cleanName(name, fallback) {
  const s = String(name ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 20);
  return s || fallback;
}

const clone = o => JSON.parse(JSON.stringify(o));
const cleanRole = r => String(r ?? '').replace(/[^a-z]/g, '').slice(0, 16);
const randomSeed = () => (Math.random() * 0x7fffffff) >>> 0 || 1;

function makeSlot(slot, team, posInTeam) {
  return { slot, team, kind: 'open', peerId: null, name: '', ready: false, color: TEAM_COLORS[team][posInTeam % 6] };
}

export class Lobby {
  /**
   * @param transport Objekt aus createTransport()
   * @param opts { name }
   */
  constructor(transport, opts = {}) {
    this.transport = transport;
    this.name = cleanName(opts.name, 'Spieler');
    this.state = null;          // aktueller Lobby-Zustand (Host & Client)
    this.startInfo = null;      // Start-Nachricht, sobald gestartet
    this._handlers = {};
    this._cmdSeq = 0;
    this._leaving = false;
    this._unsub = [
      transport.on('message', (from, msg) => this._onMessage(from, msg)),
      transport.on('peer-join', id => this._onPeerJoin(id)),
      transport.on('peer-leave', (id, reason) => this._onPeerLeave(id, reason)),
      transport.on('close', reason => this._onClose(reason)),
      transport.on('error', err => this._emit('error', err)),
    ];
  }

  // ---------------------------------------------------------------- Events
  on(ev, fn) { (this._handlers[ev] ||= new Set()).add(fn); return () => this.off(ev, fn); }
  off(ev, fn) { this._handlers[ev]?.delete(fn); }
  _emit(ev, ...args) {
    const hs = this._handlers[ev];
    if (!hs) return;
    for (const fn of [...hs]) {
      try { fn(...args); } catch (e) { console.error('[lobby] Fehler im Handler für', ev, e); }
    }
  }

  // ---------------------------------------------------------------- Abfragen
  get isHost() { return this.transport.isHost; }
  get code() { return this.state?.code ?? this.transport.code; }
  get phase() { return this.state?.phase ?? 'none'; }
  /** Eigene Spieler-ID (= Slot-Index) oder -1. */
  get playerId() {
    if (this.startInfo) return this.startInfo.assignments[this.transport.selfId] ?? -1;
    const s = this.state?.slots.find(s => s.kind === 'human' && s.peerId === this.transport.selfId);
    return s ? s.slot : -1;
  }
  get mySlot() { const id = this.playerId; return id >= 0 ? this.state.slots[id] || null : null; }
  /** V3-RS: eigener Zuschauerplatz (oder null). */
  get mySpec() { return this.state?.specs?.find((s) => s.peerId === this.transport.selfId) || null; }
  get isSpectator() { return !!this.mySpec || (this.startInfo ? (this.startInfo.assignments[this.transport.selfId] ?? -1) >= SPEC_ID0 : false); }
  /** Latenz (ms) zu einem Spieler (Host) bzw. zum Host (Client). */
  latencyOf(playerId) {
    if (!this.isHost) return this.transport.latency[this.transport.hostId] ?? null;
    const s = this.state?.slots[playerId];
    return s?.peerId ? (s.peerId === this.transport.selfId ? 0 : this.transport.latency[s.peerId] ?? null) : null;
  }

  // ================================================================ HOST
  /** Eröffnet einen Raum und die Lobby. Liefert den Raumcode. */
  async hostLobby(settings = {}, roomCode) {
    const code = await this.transport.host(roomCode);
    const st = this._normSettings({ ...DEFAULT_SETTINGS, ...settings });
    if (!st.seed) st.seed = randomSeed();
    this.state = { v: PROTOCOL_VERSION, code, phase: 'lobby', hostId: this.transport.selfId, rev: 0, settings: st, slots: [], specs: [] };
    this._buildSlots(st.playersPerTeam);
    const s0 = this.state.slots[0];
    Object.assign(s0, { kind: 'human', peerId: this.transport.selfId, name: this.name, ready: true });
    this._changed();
    return code;
  }

  _normSettings(s) {
    const out = { ...s };
    if (!SIZES.includes(out.size)) out.size = DEFAULT_SETTINGS.size;
    out.season = String(out.season || DEFAULT_SETTINGS.season).slice(0, 20);
    out.playersPerTeam = Math.max(1, Math.min(MAX_PER_TEAM, Math.round(+out.playersPerTeam || DEFAULT_SETTINGS.playersPerTeam)));
    out.seed = (Math.abs(Math.round(+out.seed || 0)) >>> 0);
    out.fillAI = out.fillAI !== false;
    out.specDelay = [0, 10].includes(+out.specDelay) ? +out.specDelay : 0; // V3-RS: Zuschauer-Verzögerung (s)
    return out;
  }

  /** Slot-Liste für n Spieler je Team aufbauen; Menschen und KI-Slots werden übernommen. */
  _buildSlots(n) {
    const old = this.state.slots;
    const keep = { UA: [], RU: [] };
    for (const s of old) if (s.kind === 'human' || s.kind === 'ai') keep[s.team].push(s);
    for (const t of TEAMS) keep[t].sort((a, b) => (a.kind === 'human' ? 0 : 1) - (b.kind === 'human' ? 0 : 1) || a.slot - b.slot);
    const slots = [];
    TEAMS.forEach((team, ti) => {
      for (let i = 0; i < n; i++) {
        const s = makeSlot(ti * n + i, team, i);
        const prev = keep[team][i];
        if (prev) Object.assign(s, { kind: prev.kind, peerId: prev.peerId, name: prev.name, ready: prev.ready, difficulty: prev.difficulty, role: prev.role });
        if (s.difficulty === undefined) delete s.difficulty;
        if (s.role === undefined) delete s.role;
        slots.push(s);
      }
    });
    this.state.slots = slots;
  }

  _requireHost(what) {
    if (!this.isHost || !this.state) { this._emit('error', lobbyError(`Nur der Host kann ${what}.`, 'not-host')); return false; }
    if (this.state.phase !== 'lobby') { this._emit('error', lobbyError('Das Spiel läuft bereits.', 'phase')); return false; }
    return true;
  }

  /** Host: Slot auf 'open' | 'ai' | 'closed' setzen. opts.difficulty für KI (optional). */
  setSlot(slotIdx, kind, opts = {}) {
    if (!this._requireHost('Slots ändern')) return false;
    const s = this.state.slots[slotIdx];
    if (!s) { this._emit('error', lobbyError(`Slot ${slotIdx} gibt es nicht.`)); return false; }
    if (!['open', 'ai', 'closed'].includes(kind)) { this._emit('error', lobbyError(`Ungültige Slot-Art: ${kind}`)); return false; }
    if (s.kind === 'human') { this._emit('error', lobbyError(`Slot ${slotIdx + 1} ist von ${s.name} belegt.`, 'occupied')); return false; }
    Object.assign(s, { kind, peerId: null, name: kind === 'ai' ? (opts.name || 'KI') : '', ready: kind === 'ai' });
    if (kind === 'ai') s.difficulty = opts.difficulty || s.difficulty || 'normal'; else delete s.difficulty;
    if (opts.role) s.role = cleanRole(opts.role);
    this._changed();
    return true;
  }

  /** Host: Rolle eines Slots (KI oder eigener) festlegen. */
  setSlotRole(slotIdx, role) {
    if (!this._requireHost('Rollen ändern')) return false;
    const s = this.state.slots[slotIdx];
    if (!s || (s.kind === 'human' && s.peerId !== this.transport.selfId)) return false;
    s.role = cleanRole(role);
    this._changed();
    return true;
  }

  /** Host: Spieler aus einem Slot entfernen. */
  kick(slotIdx) {
    if (!this.isHost || !this.state) return false;
    const s = this.state.slots[slotIdx];
    if (!s || s.kind !== 'human' || s.peerId === this.transport.selfId) return false;
    this.transport.send(s.peerId, { type: 'reject', reason: 'Du wurdest vom Host entfernt.' });
    const pid = s.peerId;
    setTimeout(() => this.transport.disconnect(pid, 'kick'), 100);
    return true;
  }

  /** Host: Einstellungen ändern (size, season, playersPerTeam, seed, fillAI). Setzt Bereit-Status zurück. */
  updateSettings(partial = {}) {
    if (!this._requireHost('Einstellungen ändern')) return false;
    const next = this._normSettings({ ...this.state.settings, ...partial });
    if (next.playersPerTeam !== this.state.settings.playersPerTeam) {
      const humans = this.state.slots.filter(s => s.kind === 'human');
      if (humans.length > next.playersPerTeam * 2) {
        this._emit('error', lobbyError(`Zu viele Spieler (${humans.length}) für ${next.playersPerTeam} gegen ${next.playersPerTeam}.`, 'too-many'));
        return false;
      }
      // Überzählige Menschen eines Teams ins andere Team verschieben
      const n = next.playersPerTeam;
      for (const t of TEAMS) {
        const mine = this.state.slots.filter(s => s.team === t && s.kind === 'human');
        for (const s of mine.slice(n)) s.team = t === 'UA' ? 'RU' : 'UA';
      }
      // KI-Slots, die keinen Platz mehr haben, entfallen (Menschen haben Vorrang)
      this._buildSlots(n);
    }
    this.state.settings = next;
    for (const s of this.state.slots) if (s.kind === 'human' && s.peerId !== this.transport.selfId) s.ready = false;
    this._changed();
    return true;
  }

  /** Host: Spiel starten. Voraussetzung: alle Menschen bereit, jedes Team hat mindestens einen Teilnehmer. */
  start() {
    if (!this._requireHost('das Spiel starten')) return false;
    const st = this.state;
    const notReady = st.slots.filter(s => s.kind === 'human' && !s.ready && s.peerId !== this.transport.selfId);
    if (notReady.length) {
      this._emit('error', lobbyError('Noch nicht bereit: ' + notReady.map(s => s.name).join(', '), 'not-ready'));
      return false;
    }
    const slots = clone(st.slots);
    for (const s of slots) {
      if (s.kind === 'open') {
        if (st.settings.fillAI) Object.assign(s, { kind: 'ai', name: 'KI', ready: true, difficulty: 'normal' });
        else s.kind = 'closed';
      }
      if (s.kind === 'human') s.ready = true;
    }
    for (const t of TEAMS) {
      if (st.settings.coop) break; // V3-RS: Koop-Kampagne – Gegner stellt die Mission
      if (!slots.some(s => s.team === t && (s.kind === 'human' || s.kind === 'ai'))) {
        this._emit('error', lobbyError(`Team ${t} hat keine Teilnehmer.`, 'empty-team'));
        return false;
      }
    }
    const assignments = {};
    for (const s of slots) if (s.kind === 'human') assignments[s.peerId] = s.slot;
    for (const s of st.specs || []) assignments[s.peerId] = s.id; // V3-RS: Zuschauer
    st.slots = slots;
    st.phase = 'game';
    st.rev++;
    const info = {
      type: 'start', v: PROTOCOL_VERSION, code: st.code, seed: st.settings.seed,
      settings: clone(st.settings), slots: clone(slots), assignments,
      hostPlayerId: assignments[this.transport.selfId],
      spectators: clone((st.specs || []).map(s => ({ id: s.id, name: s.name }))),
    };
    this.startInfo = info;
    this.transport.broadcast(info);
    this._emit('update', this.state);
    this._emit('start', clone(info));
    return true;
  }

  _changed() {
    this.state.rev++;
    this.transport.broadcast({ type: 'lobby', lobby: this.state });
    this._emit('update', this.state);
  }

  _slotOfPeer(peerId) { return this.state?.slots.find(s => s.kind === 'human' && s.peerId === peerId) || null; }

  _freeSlot(preferTeam) {
    const humans = t => this.state.slots.filter(s => s.team === t && s.kind === 'human').length;
    const order = preferTeam ? [preferTeam, ...TEAMS.filter(t => t !== preferTeam)]
      : [...TEAMS].sort((a, b) => humans(a) - humans(b));
    for (const t of order) {
      const s = this.state.slots.find(s => s.team === t && s.kind === 'open');
      if (s) return s;
    }
    return null;
  }

  _onPeerJoin(id) {
    // Platz wird erst bei 'hello' vergeben (Protokollversion + Name).
  }

  _onPeerLeave(peerId, reason) {
    if (!this.isHost || !this.state) return;
    const sp = this._specOfPeer(peerId);
    if (sp) { // V3-RS: Zuschauer
      const info = { playerId: sp.id, peerId, name: sp.name, team: null, reason, spectator: true };
      if (this.state.phase === 'lobby') { this.state.specs = this.state.specs.filter(x => x !== sp); this._changed(); } else sp.connected = false;
      this.transport.broadcast({ type: 'left', info });
      this._emit('left', info);
      return;
    }
    const s = this._slotOfPeer(peerId);
    if (!s) return;
    const info = { playerId: s.slot, peerId, name: s.name, team: s.team, reason };
    if (this.state.phase === 'lobby') {
      Object.assign(s, { kind: 'open', peerId: null, name: '', ready: false });
      this._changed();
    } else {
      s.connected = false;
    }
    this.transport.broadcast({ type: 'left', info });
    this._emit('left', info);
  }

  _hostHandle(from, msg) {
    const st = this.state;
    if (msg.type === 'hello') {
      if (this._slotOfPeer(from)) { this.transport.send(from, { type: 'lobby', lobby: st }); return; }
      const reject = reason => {
        this.transport.send(from, { type: 'reject', reason });
        setTimeout(() => this.transport.disconnect(from, 'reject'), 200);
      };
      if (msg.v !== PROTOCOL_VERSION) return reject('Unterschiedliche Spielversion – bitte Seite neu laden.');
      if (st.phase !== 'lobby') return reject('Das Spiel läuft bereits.');
      if (this._specOfPeer(from)) { this.transport.send(from, { type: 'lobby', lobby: st }); return; }
      const free = msg.spectate ? null : this._freeSlot(TEAMS.includes(msg.team) ? msg.team : null);
      if (!free) { // V3-RS: Zuschauerplatz (gewünscht oder Lobby voll)
        if (this._addSpec(from, msg.name)) return;
        return reject(msg.spectate ? 'Alle Zuschauerplätze sind belegt.' : 'Die Lobby ist voll.');
      }
      Object.assign(free, { kind: 'human', peerId: from, name: cleanName(msg.name, 'Spieler ' + (free.slot + 1)), ready: false });
      this._changed();
      return;
    }
    const sp = this._specOfPeer(from);
    if (sp) return this._specHandle(sp, from, msg); // V3-RS: Zuschauer
    const s = this._slotOfPeer(from);
    if (!s) return; // nicht (mehr) Teil der Lobby
    switch (msg.type) {
      case 'setSpectate': // V3-RS: Spieler wird Zuschauer
        if (st.phase !== 'lobby' || !msg.on || from === this.transport.selfId) return;
        if ((st.specs ||= []).length >= MAX_SPECTATORS) { this.transport.send(from, { type: 'notice', text: 'Alle Zuschauerplätze sind belegt.', code: 'spec-full' }); return; }
        { const name = s.name; Object.assign(s, { kind: 'open', peerId: null, name: '', ready: false }); delete s.role; this._addSpec(from, name); }
        return;
      case 'replayReq': this._emit('replayReq', s.slot); return;
      case 'setName':
        if (st.phase !== 'lobby') return;
        s.name = cleanName(msg.name, s.name);
        this._changed();
        break;
      case 'setReady':
        if (st.phase !== 'lobby') return;
        s.ready = !!msg.ready;
        this._changed();
        break;
      case 'setTeam':
        if (st.phase !== 'lobby') return;
        this._moveToTeam(s, msg.team, from);
        break;
      case 'setRole':
        if (st.phase !== 'lobby') return;
        s.role = cleanRole(msg.role);
        this._changed();
        break;
      case 'cmd':
        if (st.phase !== 'game' || !msg.cmd || typeof msg.cmd !== 'object') return;
        this._emit('cmd', s.slot, msg.cmd);
        break;
      case 'chat':
        this._relayChat(s, msg.text, msg.scope);
        break;
    }
  }

  // ---------------------------------------------------------------- V3-RS: Zuschauer
  _specOfPeer(peerId) { return this.state?.specs?.find(s => s.peerId === peerId) || null; }
  _addSpec(peerId, name) {
    const st = this.state;
    st.specs ||= [];
    if (st.specs.length >= MAX_SPECTATORS || st.settings.coop) return false;
    let id = SPEC_ID0; while (st.specs.some(s => s.id === id)) id++;
    st.specs.push({ id, peerId, name: cleanName(name, 'Zuschauer ' + (id - SPEC_ID0 + 1)) });
    this._changed();
    return true;
  }
  _specHandle(sp, from, msg) {
    const st = this.state;
    switch (msg.type) {
      case 'setName': if (st.phase === 'lobby') { sp.name = cleanName(msg.name, sp.name); this._changed(); } break;
      case 'setSpectate':
        if (st.phase !== 'lobby' || msg.on) return;
        { const free = this._freeSlot(TEAMS.includes(msg.team) ? msg.team : null);
          if (!free) { this.transport.send(from, { type: 'notice', text: 'Kein freier Spielerplatz.', code: 'lobby-full' }); return; }
          st.specs = st.specs.filter(x => x !== sp);
          Object.assign(free, { kind: 'human', peerId: from, name: sp.name, ready: false });
          this._changed(); }
        break;
      case 'chat': this._relayChat({ slot: sp.id, name: sp.name, team: null, spectator: true }, msg.text, 'all'); break;
      case 'specView': if (st.phase === 'game') this._emit('specView', sp.id, ['all', 'UA', 'RU'].includes(msg.view) ? msg.view : 'all'); break;
      case 'replayReq': this._emit('replayReq', sp.id); break;
    }
  }

  _moveToTeam(s, team, peerId) {
    if (!TEAMS.includes(team) || s.team === team) return;
    const target = this.state.slots.find(x => x.team === team && x.kind === 'open');
    if (!target) {
      const msg = `Team ${team} ist voll.`;
      if (peerId === this.transport.selfId) this._emit('error', lobbyError(msg, 'team-full'));
      else this.transport.send(peerId, { type: 'notice', text: msg, code: 'team-full' });
      return;
    }
    Object.assign(target, { kind: 'human', peerId: s.peerId, name: s.name, ready: peerId === this.transport.selfId ? true : false });
    if (s.role) target.role = s.role; else delete target.role;
    delete s.role;
    Object.assign(s, { kind: 'open', peerId: null, name: '', ready: false });
    this._changed();
  }

  _relayChat(s, text, scope) {
    text = String(text ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 300);
    if (!text) return;
    const out = { type: 'chat', playerId: s.slot, name: s.name, team: s.team, scope: scope === 'team' ? 'team' : 'all', text };
    if (s.spectator) out.spectator = true;
    // V3-RS: Zuschauer lesen den allgemeinen Chat; im Spiel schreiben sie nur unter sich (kein Einsagen)
    const toPlayers = !(s.spectator && this.state.phase === 'game');
    for (const x of this.state.slots) {
      if (!toPlayers || x.kind !== 'human' || !x.peerId) continue;
      if (out.scope === 'team' && x.team !== s.team) continue;
      if (x.peerId === this.transport.selfId) this._emit('chat', out);
      else this.transport.send(x.peerId, out);
    }
    if (out.scope !== 'team') for (const x of this.state.specs || []) if (x.peerId && x.connected !== false) this.transport.send(x.peerId, out);
  }

  _peerOfPlayer(playerId) {
    if (playerId >= SPEC_ID0) return this.state?.specs?.find(s => s.id === playerId)?.peerId || null; // V3-RS
    const s = this.state?.slots[playerId];
    return s && s.kind === 'human' ? s.peerId : null;
  }

  // ================================================================ CLIENT
  /** Tritt einer Lobby bei. Liefert den Lobby-Zustand nach erfolgreicher Platzvergabe. */
  async joinLobby(code, opts = {}) {
    await this.transport.join(code);
    return new Promise((resolve, reject) => {
      const done = (err, st) => {
        clearTimeout(timer); offU(); offE();
        err ? reject(err) : resolve(st);
      };
      const timer = setTimeout(() => done(lobbyError('Keine Antwort vom Host (Zeitüberschreitung bei der Platzvergabe).', 'timeout')), opts.timeout || JOIN_TIMEOUT);
      const offU = this.on('update', st => { if (this.playerId >= 0 || this.mySpec) done(null, st); });
      const offE = this.on('_reject', reason => done(lobbyError(reason, 'rejected')));
      this.transport.send(this.transport.hostId, { type: 'hello', v: PROTOCOL_VERSION, name: this.name, team: opts.team, spectate: !!opts.spectate });
    });
  }

  _clientHandle(from, msg) {
    if (from !== this.transport.hostId) return;
    switch (msg.type) {
      case 'lobby':
        this.state = msg.lobby;
        this._emit('update', this.state);
        break;
      case 'reject':
        this._emit('_reject', msg.reason);
        this._emit('error', lobbyError(msg.reason, 'rejected'));
        break;
      case 'notice':
        this._emit('error', lobbyError(msg.text, msg.code || 'notice'));
        break;
      case 'start':
        this.startInfo = msg;
        if (this.state) { this.state.phase = 'game'; this.state.slots = clone(msg.slots); }
        this._emit('update', this.state);
        this._emit('start', clone(msg));
        break;
      case 'snap': this._emit('snap', msg.s); break;
      case 'event': this._emit('event', msg.e); break;
      case 'chat': this._emit('chat', msg); break;
      case 'left': this._emit('left', msg.info); break;
    }
  }

  // ================================================================ gemeinsam
  _onMessage(from, msg) {
    if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return;
    if (this.isHost) this._hostHandle(from, msg); else this._clientHandle(from, msg);
  }

  _onClose(reason) {
    if (this._leaving) return;
    if (!this.isHost && this.state) {
      const host = this.state.slots.find(s => s.peerId === this.state.hostId);
      this._emit('left', { playerId: host ? host.slot : -1, peerId: this.state.hostId, name: host?.name, host: true, reason });
      this._emit('error', lobbyError(reason || 'Verbindung zum Host verloren.', 'host-lost'));
    }
  }

  _request(type, data) {
    if (this.isHost) return this._hostHandle(this.transport.selfId, { type, ...data });
    return this.transport.send(this.transport.hostId, { type, ...data });
  }

  setName(name) {
    this.name = cleanName(name, this.name);
    if (this.state) this._request('setName', { name: this.name });
  }
  setTeam(team) { this._request('setTeam', { team }); }
  /** V3-RS: Zuschauer werden (on) bzw. einen Spielerplatz nehmen (off). */
  setSpectate(on, team) { this._request('setSpectate', { on: !!on, team }); }
  /** V3-RS: Zuschauer – gewünschte Sicht ('all' | 'UA' | 'RU'). */
  specView(view) { if (!this.isHost) this.transport.send(this.transport.hostId, { type: 'specView', view }); }
  /** V3-RS: Wiederholung beim Host anfordern (Antwort als Event {k:'rp', …}). */
  requestReplay() { if (!this.isHost) this.transport.send(this.transport.hostId, { type: 'replayReq' }); }
  /** Eigene Rolle wählen (Erweiterung MP-T5). */
  setRole(role) { this._request('setRole', { role: cleanRole(role) }); }
  setReady(ready = true) {
    if (this.isHost) return; // Host gilt immer als bereit (Start-Knopf)
    this._request('setReady', { ready: !!ready });
  }

  /** Spielkommando senden (Client → Host). Beim Host wird 'cmd' lokal ausgelöst. */
  sendCmd(cmd) {
    if (this.phase !== 'game') return false;
    if (this.isHost) { this._emit('cmd', this.playerId, cmd); return true; }
    return this.transport.send(this.transport.hostId, { type: 'cmd', playerId: this.playerId, n: ++this._cmdSeq, cmd });
  }

  /** Host: Zustands-Snapshot an alle (oder nur an Spieler toPlayerId) senden. */
  sendSnap(s, toPlayerId) { return this._hostSend({ type: 'snap', s }, toPlayerId); }
  /** Host: Spielereignis an alle (oder nur an Spieler toPlayerId) senden. */
  sendEvent(e, toPlayerId) { return this._hostSend({ type: 'event', e }, toPlayerId); }

  _hostSend(msg, toPlayerId) {
    if (!this.isHost) return false;
    if (toPlayerId == null) return this.transport.broadcast(msg);
    const pid = this._peerOfPlayer(toPlayerId);
    return pid && pid !== this.transport.selfId ? this.transport.send(pid, msg) : false;
  }

  /** Chat an alle (scope 'all') oder nur ans eigene Team ('team'). */
  sendChat(text, scope = 'all') {
    if (this.isHost) { const s = this.mySlot; if (s) this._relayChat(s, text, scope); return true; }
    return this.transport.send(this.transport.hostId, { type: 'chat', text: String(text ?? '').slice(0, 300), scope });
  }

  /** Lobby/Spiel verlassen und Verbindung schließen. */
  leave() {
    this._leaving = true;
    this.transport.close();
    for (const u of this._unsub) u();
  }
}
