// Netzwerk-Transport für Online-Gefechte (host-autoritativ, Sterntopologie).
//
// Zwei Implementierungen mit identischer API:
//   - PeerTransport  : WebRTC über PeerJS (vendor/peerjs, wird erst bei Bedarf nachgeladen)
//   - LocalTransport : BroadcastChannel (mehrere Tabs/Pages im selben Browser-Kontext;
//                      Tests und Offline-Fallback „LAN im selben Browser")
//
//   const t = createTransport('peer' | 'local', opts?);
//   const code = await t.host(roomCode?);      // Host: Raum eröffnen → Raumcode
//   await t.join(code);                        // Client: Raum beitreten
//   t.send(peerId, msg);  t.broadcast(msg);    // Host→alle Clients bzw. Client→Host
//   t.on('open'|'peer-join'|'peer-leave'|'message'|'error'|'close', fn) → unsubscribe()
//   t.close();
//   t.isHost, t.selfId, t.hostId, t.code, t.peers (Array), t.latency ({peerId: ms})
//
// Nachrichten müssen JSON-serialisierbar sein (LocalTransport erzwingt das ebenfalls,
// damit sich beide Transporte gleich verhalten). Reihenfolge je Verbindung bleibt erhalten.

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ohne I, O, 0, 1 (Verwechsler)
export const ROOM_PREFIX = 'stst-';

const DEFAULTS = {
  connectTimeout: 10000,  // ms bis Host/Join als gescheitert gelten
  heartbeatMs: 2000,      // Ping-Intervall
  peerTimeoutMs: 8000,    // ohne Lebenszeichen → Peer gilt als getrennt
  peerjsUrl: null,        // Pfad zu peerjs.min.js (Standard: relativ zu diesem Modul)
  peerOptions: {},        // an new Peer(id, opts) durchgereicht (eigener PeerServer, ICE …)
  maxHostAttempts: 4,     // neue Raum-IDs probieren, falls belegt (nur ohne Wunschcode)
};

/** Erzeugt einen gut lesbaren Raumcode, z. B. "K7PXM" (ohne Präfix). */
export function randomRoomCode(len = 5) {
  let s = '';
  const rnd = new Uint32Array(len);
  (globalThis.crypto || { getRandomValues: a => a.map(() => Math.random() * 2 ** 32) }).getRandomValues(rnd);
  for (let i = 0; i < len; i++) s += CODE_CHARS[rnd[i] % CODE_CHARS.length];
  return s;
}

/** Normalisiert Benutzereingaben: " k7p xm " → "stst-K7PXM", "stst-k7pxm" → "stst-K7PXM". */
export function normalizeRoomCode(code) {
  let c = String(code || '').trim();
  if (c.toLowerCase().startsWith(ROOM_PREFIX)) c = c.slice(ROOM_PREFIX.length);
  c = c.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return ROOM_PREFIX + c;
}

function netError(code, message, cause) {
  const e = new Error(message);
  e.code = code;
  if (cause) e.cause = cause;
  return e;
}

const secs = ms => String(Math.round(ms / 100) / 10).replace('.', ',') + ' s';
const now = () => (globalThis.performance ? performance.now() : Date.now());

// ---------------------------------------------------------------------------
// Gemeinsame Basis: Events, Peer-Verwaltung, Heartbeat/Latenz
// ---------------------------------------------------------------------------
class BaseTransport {
  constructor(kind, opts = {}) {
    this.kind = kind;
    this.opts = { ...DEFAULTS, ...opts };
    this.isHost = false;
    this.selfId = null;
    this.hostId = null;
    this.code = null;
    this.latency = {};          // peerId → Roundtrip in ms (letzte Messung, geglättet)
    this.stats = { sent: 0, received: 0 };
    this.closed = false;
    this.connected = false;
    this._handlers = {};
    this._peers = new Map();    // peerId → { lastSeen, ... } (Host: Clients; Client: nur Host)
    this._hbTimer = null;
    this._onPageHide = () => this.close();
  }

  get peers() { return [...this._peers.keys()]; }

  on(ev, fn) {
    (this._handlers[ev] ||= new Set()).add(fn);
    return () => this.off(ev, fn);
  }
  off(ev, fn) { this._handlers[ev]?.delete(fn); }
  _emit(ev, ...args) {
    const hs = this._handlers[ev];
    if (!hs || !hs.size) {
      if (ev === 'error') console.warn('[net]', args[0]?.message || args[0]);
      return;
    }
    for (const fn of [...hs]) {
      try { fn(...args); } catch (e) { console.error('[net] Fehler im Handler für', ev, e); }
    }
  }

  /** Nutzernachricht an einen Peer. */
  send(peerId, msg) {
    if (!this.connected) return false;
    if (!this._peers.has(peerId)) return false;
    this.stats.sent++;
    return this._sendRaw(peerId, { k: 'd', d: msg });
  }

  /** Host: an alle Clients. Client: an den Host. */
  broadcast(msg) {
    if (!this.connected) return false;
    if (!this.isHost) return this.send(this.hostId, msg);
    let ok = true;
    for (const id of this._peers.keys()) ok = this.send(id, msg) && ok;
    return ok;
  }

  // --- interne Verarbeitung eingehender Pakete (vom konkreten Transport aufgerufen) ---
  _handlePacket(fromId, p) {
    const peer = this._peers.get(fromId);
    if (!peer) return;
    peer.lastSeen = now();
    switch (p.k) {
      case 'd':
        this.stats.received++;
        this._emit('message', fromId, p.d);
        break;
      case 'ping':
        this._sendRaw(fromId, { k: 'pong', ts: p.ts });
        break;
      case 'pong': {
        const rtt = Math.max(0, now() - p.ts);
        const prev = this.latency[fromId];
        this.latency[fromId] = Math.round(prev == null ? rtt : prev * 0.6 + rtt * 0.4);
        break;
      }
      case 'bye':
        this._dropPeer(fromId, p.reason || 'bye');
        break;
    }
  }

  _addPeer(id, extra = {}) {
    if (this._peers.has(id)) return false;
    this._peers.set(id, { lastSeen: now(), ...extra });
    this._emit('peer-join', id);
    // Sofort messen, damit die Latenz nicht erst nach 2 s bekannt ist
    this._sendRaw(id, { k: 'ping', ts: now() });
    return true;
  }

  _dropPeer(id, reason) {
    const peer = this._peers.get(id);
    if (!peer) return;
    this._peers.delete(id);
    delete this.latency[id];
    this._closePeer(id, peer);
    this._emit('peer-leave', id, reason);
    if (!this.isHost && id === this.hostId) {
      this._shutdown(reason === 'bye' ? 'Der Host hat das Spiel verlassen.'
        : reason === 'kick' || reason === 'reject' ? 'Die Verbindung wurde vom Host getrennt.'
        : 'Verbindung zum Host verloren.');
    }
  }

  /** Host: einzelnen Client trennen (z. B. Kick). */
  disconnect(peerId, reason = 'kick') {
    if (!this._peers.has(peerId)) return;
    this._sendRaw(peerId, { k: 'bye', reason });
    this._dropPeer(peerId, reason);
  }

  _startHeartbeat() {
    clearInterval(this._hbTimer);
    this._hbLast = now();
    this._hbTimer = setInterval(() => {
      const t = now();
      // Eigener Takt war blockiert (z. B. Karte laden, Hintergrund-Tab): wartende Nachrichten sind noch nicht
      // verarbeitet – den Peers eine Schonfrist geben statt sie fälschlich als getrennt zu werten (Erweiterung MP-T5).
      if (t - this._hbLast > this.opts.heartbeatMs * 3) for (const peer of this._peers.values()) peer.lastSeen = Math.max(peer.lastSeen, t - this.opts.heartbeatMs);
      this._hbLast = t;
      for (const [id, peer] of [...this._peers]) {
        if (t - peer.lastSeen > this.opts.peerTimeoutMs) {
          this._dropPeer(id, 'timeout');
          continue;
        }
        this._sendRaw(id, { k: 'ping', ts: t });
      }
    }, this.opts.heartbeatMs);
    if (typeof addEventListener === 'function') addEventListener('pagehide', this._onPageHide);
  }

  _opened() {
    this.connected = true;
    this._startHeartbeat();
    this._emit('open', this.selfId);
  }

  _shutdown(reason) {
    if (this.closed) return;
    this.closed = true;
    this.connected = false;
    clearInterval(this._hbTimer);
    if (typeof removeEventListener === 'function') removeEventListener('pagehide', this._onPageHide);
    this._teardown();
    this._emit('close', reason || 'geschlossen');
  }

  /** Verbindung beenden (meldet sich bei allen Gegenstellen ab). */
  close() {
    if (this.closed) return;
    for (const id of this._peers.keys()) this._sendRaw(id, { k: 'bye', reason: 'bye' });
    for (const [id, peer] of [...this._peers]) { this._peers.delete(id); this._closePeer(id, peer); }
    this._shutdown('Verbindung beendet.');
  }

  _withTimeout(promise, ms, msg) {
    let timer;
    return Promise.race([
      promise,
      new Promise((_, rej) => { timer = setTimeout(() => rej(netError('timeout', msg)), ms); }),
    ]).finally(() => clearTimeout(timer));
  }

  // von Unterklassen zu implementieren
  _sendRaw() { return false; }
  _closePeer() {}
  _teardown() {}
}

// ---------------------------------------------------------------------------
// LocalTransport (BroadcastChannel)
// ---------------------------------------------------------------------------
// Alle Teilnehmer eines Raums teilen sich einen Kanal 'stst-net:<code>'. Pakete tragen
// from/to; Clients reden nur mit dem Host. Nutzlast wird als JSON-String verschickt, damit
// das Verhalten (z. B. undefined/TypedArrays) exakt dem PeerJS-'json'-Kanal entspricht.
export class LocalTransport extends BaseTransport {
  constructor(opts = {}) {
    super('local', { connectTimeout: 5000, ...opts });
    this._ch = null;
  }

  static get supported() { return typeof BroadcastChannel === 'function'; }

  _openChannel(code) {
    if (!LocalTransport.supported) throw netError('unsupported', 'Dieser Browser unterstützt kein lokales Netzwerk (BroadcastChannel fehlt).');
    this._ch = new BroadcastChannel('stst-net:' + code);
    this._ch.onmessage = ev => this._onChannel(ev.data);
  }

  _post(pkt) {
    if (!this._ch) return false;
    try { this._ch.postMessage(JSON.stringify(pkt)); return true; }
    catch (e) { this._emit('error', netError('send', 'Nachricht konnte nicht gesendet werden: ' + e.message, e)); return false; }
  }

  _sendRaw(to, p) { return this._post({ ...p, from: this.selfId, to }); }

  _onChannel(raw) {
    let pkt;
    try { pkt = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return; }
    if (!pkt || pkt.from === this.selfId) return;
    if (this._onControl?.(pkt)) return;
    if (pkt.to !== this.selfId && pkt.to !== '*') return;
    this._handlePacket(pkt.from, pkt);
  }

  async host(roomCode) {
    if (this.closed || this.connected) throw netError('state', 'Transport wurde bereits verwendet.');
    const wish = roomCode ? normalizeRoomCode(roomCode) : null;
    for (let attempt = 0; attempt < this.opts.maxHostAttempts; attempt++) {
      const code = wish || ROOM_PREFIX + randomRoomCode();
      const taken = await this._probe(code);
      if (!taken) {
        this.isHost = true;
        this.code = this.selfId = this.hostId = code;
        this._onControl = pkt => {
          if (pkt.k === 'probe') { this._post({ k: 'here', from: this.selfId, to: pkt.from }); return true; }
          if (pkt.k === 'join' && pkt.to === this.selfId) {
            if (!this._peers.has(pkt.from)) this._addPeer(pkt.from);
            else this._peers.get(pkt.from).lastSeen = now();
            this._post({ k: 'welcome', from: this.selfId, to: pkt.from });
            return true;
          }
          return false;
        };
        this._opened();
        return code;
      }
      if (wish) throw netError('taken', `Der Raumcode ${wish} ist bereits vergeben.`);
    }
    throw netError('taken', 'Es konnte kein freier Raumcode gefunden werden.');
  }

  _probe(code) {
    return new Promise(resolve => {
      this.selfId = 'p-' + randomRoomCode(8);
      this._openChannel(code);
      let done = false;
      this._onControl = pkt => {
        if (pkt.k === 'here' && pkt.to === this.selfId && !done) {
          done = true;
          this._ch.close(); this._ch = null;
          resolve(true);
        }
        return true;
      };
      this._post({ k: 'probe', from: this.selfId, to: code });
      setTimeout(() => { if (!done) { done = true; resolve(false); } }, 250);
    });
  }

  async join(code) {
    if (this.closed || this.connected) throw netError('state', 'Transport wurde bereits verwendet.');
    code = normalizeRoomCode(code);
    this.code = this.hostId = code;
    this.selfId = 'c-' + randomRoomCode(8);
    this._openChannel(code);
    let timer;
    const welcomed = new Promise(resolve => {
      this._onControl = pkt => {
        if (pkt.k === 'welcome' && pkt.to === this.selfId) {
          this._onControl = null;
          resolve();
          return true;
        }
        return pkt.k === 'probe' || pkt.k === 'join' || pkt.k === 'here' || pkt.k === 'welcome';
      };
      const knock = () => this._post({ k: 'join', from: this.selfId, to: code });
      knock();
      timer = setInterval(knock, 400);
    });
    try {
      await this._withTimeout(welcomed, this.opts.connectTimeout,
        `Raum ${code} nicht gefunden – Zeitüberschreitung beim Verbinden (${secs(this.opts.connectTimeout)}). ` +
        'Ist der Host im selben Browser geöffnet?');
    } catch (e) {
      clearInterval(timer);
      this._ch?.close(); this._ch = null;
      this.closed = true;
      this._emit('error', e);
      throw e;
    }
    clearInterval(timer);
    // Kontrollpakete (probe/join) anderer Teilnehmer ignorieren
    this._onControl = pkt => pkt.k === 'probe' || pkt.k === 'join' || pkt.k === 'here' || pkt.k === 'welcome';
    this._addPeer(code);
    this._opened();
  }

  _teardown() {
    const ch = this._ch;
    this._ch = null;
    // kurz offen lassen, damit 'bye' noch rausgeht
    if (ch) setTimeout(() => ch.close(), 50);
  }
}

// ---------------------------------------------------------------------------
// PeerTransport (WebRTC via PeerJS)
// ---------------------------------------------------------------------------
let peerjsPromise = null;

/** Lädt vendor/peerjs/peerjs.min.js per <script> (einmalig) und liefert die Klasse Peer. */
export function loadPeerJS(url, timeoutMs = 10000) {
  if (globalThis.Peer) return Promise.resolve(globalThis.Peer);
  if (peerjsPromise) return peerjsPromise;
  const src = url || new URL('../../vendor/peerjs/peerjs.min.js', import.meta.url).href;
  peerjsPromise = new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(netError('load', 'PeerJS kann hier nicht geladen werden (kein Dokument).'));
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    const timer = setTimeout(() => fail('Zeitüberschreitung'), timeoutMs);
    function fail(why) {
      clearTimeout(timer);
      s.remove();
      peerjsPromise = null;
      reject(netError('load', `Die Online-Bibliothek (PeerJS) konnte nicht geladen werden (${why}).`));
    }
    s.onload = () => {
      clearTimeout(timer);
      if (globalThis.Peer) resolve(globalThis.Peer);
      else fail('Peer nicht definiert');
    };
    s.onerror = () => fail('Datei nicht erreichbar');
    document.head.appendChild(s);
  });
  return peerjsPromise;
}

const PEER_ERRORS = {
  'browser-incompatible': 'Dieser Browser unterstützt kein WebRTC – Online-Spiel nicht möglich.',
  'disconnected': 'Die Verbindung zum Vermittlungsserver wurde getrennt.',
  'invalid-id': 'Ungültiger Raumcode.',
  'invalid-key': 'Ungültiger API-Schlüssel für den Vermittlungsserver.',
  'network': 'Der Vermittlungsserver ist nicht erreichbar. Bitte Internetverbindung prüfen.',
  'peer-unavailable': 'Raum nicht gefunden. Bitte den Code prüfen.',
  'ssl-unavailable': 'Der Vermittlungsserver erfordert eine sichere Verbindung (HTTPS).',
  'server-error': 'Der Vermittlungsserver ist nicht erreichbar.',
  'socket-error': 'Verbindungsfehler zum Vermittlungsserver.',
  'socket-closed': 'Die Verbindung zum Vermittlungsserver wurde unerwartet geschlossen.',
  'unavailable-id': 'Dieser Raumcode ist bereits vergeben.',
  'webrtc': 'WebRTC-Verbindungsfehler.',
};

function peerError(err) {
  const type = err?.type || 'unknown';
  return netError(type, PEER_ERRORS[type] || ('Netzwerkfehler: ' + (err?.message || type)), err);
}

export class PeerTransport extends BaseTransport {
  constructor(opts = {}) {
    super('peer', opts);
    this._peer = null;
    this._conns = new Map(); // peerId → DataConnection
  }

  static get supported() { return typeof RTCPeerConnection === 'function'; }

  async _load() {
    if (!PeerTransport.supported) throw netError('browser-incompatible', PEER_ERRORS['browser-incompatible']);
    return loadPeerJS(this.opts.peerjsUrl, this.opts.connectTimeout);
  }

  _timeoutMsg(what) {
    return `Zeitüberschreitung beim ${what} (${secs(this.opts.connectTimeout)}). ` +
      'Der Vermittlungsserver (PeerJS) ist nicht erreichbar – bitte Internetverbindung prüfen oder „Lokal“ wählen.';
  }

  /** Erzeugt Peer und wartet auf 'open'. */
  _createPeer(Peer, id) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const peer = id ? new Peer(id, { debug: 0, ...this.opts.peerOptions }) : new Peer({ debug: 0, ...this.opts.peerOptions });
      peer.on('open', () => { if (!settled) { settled = true; resolve(peer); } });
      peer.on('error', err => {
        if (!settled) { settled = true; try { peer.destroy(); } catch {} reject(peerError(err)); return; }
        this._onPeerError(err);
      });
      this._pendingPeer = peer;
    });
  }

  _onPeerError(err) {
    const e = peerError(err);
    // 'peer-unavailable' nach dem Verbinden ist für Host irrelevant
    if (err?.type === 'peer-unavailable' && this.isHost) return;
    this._emit('error', e);
    if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(err?.type) && this.connected) {
      // Signalisierung weg – bestehende DataChannels laufen weiter; nur melden.
    }
  }

  _attachConn(conn) {
    const id = conn.peer;
    this._conns.set(id, conn);
    conn.on('data', data => { if (data && typeof data === 'object') this._handlePacket(id, data); });
    conn.on('close', () => this._dropPeer(id, 'closed'));
    conn.on('error', err => this._emit('error', peerError(err)));
    // ICE-Zustand überwachen (schnellere Abbruch-Erkennung als Heartbeat)
    const pc = conn.peerConnection;
    if (pc) pc.addEventListener('iceconnectionstatechange', () => {
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') this._dropPeer(id, 'ice-' + pc.iceConnectionState);
    });
  }

  _sendRaw(to, p) {
    const c = this._conns.get(to);
    if (!c || !c.open) return false;
    try { c.send(p); return true; }
    catch (e) { this._emit('error', netError('send', 'Nachricht konnte nicht gesendet werden: ' + e.message, e)); return false; }
  }

  _closePeer(id) {
    const c = this._conns.get(id);
    this._conns.delete(id);
    if (c) setTimeout(() => { try { c.close(); } catch {} }, 50);
  }

  async host(roomCode) {
    if (this.closed || this.connected) throw netError('state', 'Transport wurde bereits verwendet.');
    const wish = roomCode ? normalizeRoomCode(roomCode) : null;
    let peer = null;
    try {
      const Peer = await this._load();
      const attempt = async () => {
        for (let i = 0; i < this.opts.maxHostAttempts; i++) {
          const code = wish || ROOM_PREFIX + randomRoomCode();
          try { return await this._createPeer(Peer, code); }
          catch (e) { if (e.code !== 'unavailable-id' || wish) throw e; }
        }
        throw netError('unavailable-id', 'Es konnte kein freier Raumcode gefunden werden.');
      };
      peer = await this._withTimeout(attempt(), this.opts.connectTimeout, this._timeoutMsg('Eröffnen des Raums'));
    } catch (e) {
      this._abortPending();
      this.closed = true;
      this._emit('error', e);
      throw e;
    }
    this._peer = peer;
    this.isHost = true;
    this.code = this.selfId = this.hostId = peer.id;
    peer.on('connection', conn => {
      conn.on('open', () => {
        this._attachConn(conn);
        this._addPeer(conn.peer);
      });
    });
    peer.on('disconnected', () => {
      // Signalisierung verloren: neue Clients können nicht mehr beitreten, bestehende laufen weiter.
      if (!this.closed) { try { peer.reconnect(); } catch {} }
    });
    this._opened();
    return this.code;
  }

  async join(code) {
    if (this.closed || this.connected) throw netError('state', 'Transport wurde bereits verwendet.');
    code = normalizeRoomCode(code);
    this.code = this.hostId = code;
    try {
      const Peer = await this._load();
      const run = async () => {
        const peer = await this._createPeer(Peer, null);
        this._peer = peer;
        this.selfId = peer.id;
        return new Promise((resolve, reject) => {
          const conn = peer.connect(code, { reliable: true, serialization: 'json' });
          const onErr = err => reject(err?.type === 'peer-unavailable'
            ? netError('peer-unavailable', `Raum ${code} nicht gefunden. Bitte den Code prüfen.`, err)
            : peerError(err));
          peer.on('error', onErr);
          conn.on('open', () => { peer.off('error', onErr); resolve(conn); });
          conn.on('error', onErr);
        });
      };
      const conn = await this._withTimeout(run(), this.opts.connectTimeout, this._timeoutMsg(`Verbinden mit Raum ${code}`));
      this._attachConn(conn);
    } catch (e) {
      this._abortPending();
      this.closed = true;
      this._emit('error', e);
      throw e;
    }
    this._addPeer(code);
    this._opened();
  }

  _abortPending() {
    for (const p of [this._pendingPeer, this._peer]) { try { p?.destroy(); } catch {} }
    this._pendingPeer = this._peer = null;
  }

  _teardown() {
    const p = this._peer;
    this._peer = null;
    if (p) setTimeout(() => { try { p.destroy(); } catch {} }, 100);
  }
}

/**
 * Fabrik. kind: 'peer' (Online, WebRTC) | 'local' (BroadcastChannel, selber Browser).
 * opts: siehe DEFAULTS (connectTimeout, heartbeatMs, peerTimeoutMs, peerjsUrl, peerOptions).
 */
export function createTransport(kind = 'peer', opts = {}) {
  if (kind === 'local') return new LocalTransport(opts);
  if (kind === 'peer' || kind === 'online') return new PeerTransport(opts);
  throw netError('kind', `Unbekannter Transport: ${kind}`);
}
