// Online-Gefecht (MP-T5): Menüs „Online-Gefecht“ und Lobby, In-Game-Chat, Verbindungsabbrüche.
// Wird von main.js mit createOnline(ctx) eingebunden:
//   ctx = { game, show(name), hideScreens(), startGame(S, session) → Promise, toMenu() → Promise, simTick(dt) }
// Verbindungsart 'peer' (Internet, PeerJS/WebRTC) oder 'local' (BroadcastChannel – mehrere Tabs desselben Browsers).
// TURN-Server (für Mobilfunk/CGNAT): NET_CONFIG.peerOptions.config.iceServers unten bzw. window.STST_NET_CONFIG.
import { createTransport, normalizeRoomCode } from './transport.js';
import { Lobby, TEAMS, MAX_PER_TEAM } from './lobby.js';
import { HostSession, ClientSession, setupFromStart, ROLE_ORDER } from './session.js';
import { ROLES, DIFFICULTIES, VICTORY, TEAM_NAME, TEAM_COLOR, MAP_PRESETS, MAP_SIZES } from '../skirmish/skirmish.js';
import { generateSkirmishMap } from '../skirmish/maps.js';
import { Terrain } from '../engine/terrain.js';

// ---- Verbindungs-Konfiguration -------------------------------------------------------------------------------
// Standard: öffentlicher PeerJS-Vermittlungsserver (0.peerjs.com) + STUN von Google. Für Verbindungen über Mobilfunk
// (CGNAT, symmetrisches NAT) einen TURN-Server eintragen, z. B.:
//   iceServers: [{ urls: 'stun:stun.l.google.com:19302' },
//                { urls: 'turn:turn.example.org:3478', username: 'user', credential: 'pass' }]
// Alternativ vor dem Laden von main.js: window.STST_NET_CONFIG = { peerOptions: { config: { iceServers: [...] } } }
export const NET_CONFIG = {
  connectTimeout: 12000,
  // Beim Laden der Karte ist der Hauptthread einige Sekunden blockiert (langsame Handys: > 8 s) – deshalb großzügiger
  // als der Transport-Standard. Ein geschlossener Tab wird unabhängig davon sofort erkannt (Abmeldung beim pagehide).
  peerTimeoutMs: 25000,
  peerOptions: {
    config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' }] },
  },
};
const ONLINE_KEY = 'steppensturm.online.v1';
const DEFAULT_SETTINGS = { size: 'medium', season: 'summer', playersPerTeam: 2, preset: 'random', night: false, reinforce: 180, victory: 'points', difficulty: 'normal', fillAI: true };
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const opt = (v, t, sel) => `<option value="${v}"${sel ? ' selected' : ''}>${t}</option>`;

export function createOnline(ctx) { return new OnlineUI(ctx); }

class OnlineUI {
  constructor(ctx) {
    this.ctx = ctx;
    this.game = ctx.game;
    this.artifact = window.__ARTIFACT === true;
    this.prefs = { name: '', kind: this.artifact ? 'local' : 'peer' };
    try { Object.assign(this.prefs, JSON.parse(localStorage.getItem(ONLINE_KEY) || '{}')); } catch (e) { /* ignorieren */ }
    if (this.artifact) this.prefs.kind = 'local';
    this.lobby = null; this.session = null; this.inGame = false; this.pings = {};
    this.previewCache = new Map();
    this._bind();
  }
  get active() { return !!this.session; }
  savePrefs() { try { localStorage.setItem(ONLINE_KEY, JSON.stringify(this.prefs)); } catch (e) { /* ignorieren */ } }

  // ================================================================ Menü „Online-Gefecht“
  _bind() {
    $('btn-online').onclick = () => this.open();
    document.querySelector('#screen-online .back').onclick = () => { this.ctx.show('title'); };
    if (this.artifact) $('online-artifact-note').classList.remove('hidden');
    $('net-name').value = this.prefs.name;
    $('net-name').addEventListener('change', () => { this.prefs.name = $('net-name').value.trim().slice(0, 20); this.savePrefs(); });
    $('net-conn').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      this.prefs.kind = b.dataset.v; this.savePrefs(); this.renderConn();
    });
    $('btn-net-host').onclick = () => this.host();
    $('btn-net-join').onclick = () => this.join();
    $('net-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') this.join(); });
    const room = new URLSearchParams(location.search).get('room');
    if (room) $('net-code').value = room;
    // Lobby
    $('btn-lobby-copy').onclick = () => this.copyCode();
    $('btn-lobby-leave').onclick = () => this.leaveLobby();
    $('btn-lobby-ready').onclick = () => { const s = this.lobby?.mySlot; if (s) this.lobby.setReady(!s.ready); };
    $('btn-lobby-start').onclick = () => this.startMatch();
    $('btn-lobby-team').onclick = () => { const s = this.lobby?.mySlot; if (s) this.lobby.setTeam(s.team === 'UA' ? 'RU' : 'UA'); };
    $('lobby-chat-form').addEventListener('submit', (e) => { e.preventDefault(); this.sendChat($('lobby-chat-input')); });
    for (const t of TEAMS) $('lobby-team-' + t).addEventListener('change', (e) => this._slotChange(e));
    for (const t of TEAMS) $('lobby-team-' + t).addEventListener('click', (e) => this._slotClick(e));
    // Einstellungen (Host)
    $('ls-mode').innerHTML = [1, 2, 3, 4, 5, 6].map((n) => `<button data-v="${n}">${n}v${n}</button>`).join('');
    $('ls-preset').innerHTML = opt('random', '🎲 Zufall') + MAP_PRESETS.map((p) => opt(p.id, p.name)).join('');
    $('ls-size').innerHTML = Object.entries(MAP_SIZES).map(([k, z]) => opt(k, `${z.label} (${z.size} m, bis ${z.maxPerTeam}v${z.maxPerTeam})`)).join('');
    $('ls-diff').innerHTML = Object.entries(DIFFICULTIES).map(([k, t]) => opt(k, t)).join('');
    $('ls-victory').innerHTML = Object.entries(VICTORY).map(([k, t]) => opt(k, t)).join('');
    $('ls-mode').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) this.setSetting({ playersPerTeam: +b.dataset.v }); });
    const conv = { 'ls-preset': ['preset'], 'ls-size': ['size'], 'ls-season': ['season'], 'ls-reinforce': ['reinforce', Number], 'ls-victory': ['victory'], 'ls-diff': ['difficulty'], 'ls-seed': ['seed', (v) => Math.max(1, Math.floor(+v) || 1)] };
    for (const [id, [key, fn]] of Object.entries(conv)) $(id).addEventListener('change', () => this.setSetting({ [key]: fn ? fn($(id).value) : $(id).value }));
    $('ls-night').addEventListener('change', () => this.setSetting({ night: $('ls-night').checked }));
    $('ls-reroll').onclick = () => this.setSetting({ seed: Math.floor(Math.random() * 99999) + 1 });
    // In-Game-Chat
    $('btn-chat').onclick = () => this.toggleChat();
    $('net-chat-form').addEventListener('submit', (e) => { e.preventDefault(); this.sendChat($('net-chat-input'), true); this.toggleChat(false); });
    for (const id of ['net-chat-input', 'lobby-chat-input', 'net-code', 'net-name']) {
      $(id).addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape' && id === 'net-chat-input') this.toggleChat(false); });
      $(id).addEventListener('keyup', (e) => e.stopPropagation());
    }
    window.addEventListener('keydown', (e) => {
      if (!this.inGame || e.key !== 'Enter' || e.target?.tagName === 'INPUT') return;
      e.preventDefault(); this.toggleChat(true);
    });
    $('net-msg-ok').onclick = () => { $('net-msg').classList.add('hidden'); this.leaveGame(); };
  }
  open(msg = '', err = false) {
    this.renderConn();
    this.status('net-status', msg, err);
    this.ctx.show('online');
  }
  renderConn() {
    const k = this.prefs.kind;
    $('net-conn').querySelectorAll('button').forEach((b) => {
      b.classList.toggle('active', b.dataset.v === k);
      if (b.dataset.v === 'peer') b.disabled = this.artifact;
    });
    $('net-conn-note').innerHTML = this.artifact
      ? 'Im Claude-Artifact sind Netzwerkverbindungen gesperrt: <b>Online-Spiel nur in der Web-Version (z. B. GitHub Pages)</b>. Der lokale Test (mehrere Tabs dieses Browsers) funktioniert.'
      : k === 'peer'
        ? 'Verbindung über das Internet (WebRTC, Vermittlung über den PeerJS-Server). Raumcode an die Mitspieler weitergeben. Über Mobilfunk kann ein TURN-Server nötig sein (siehe README).'
        : 'Lokaler Test: Host und Mitspieler laufen als Tabs/Fenster <b>desselben Browsers</b> auf diesem Gerät (BroadcastChannel).';
  }
  status(id, msg, err = false) { const el = $(id); el.textContent = msg || ''; el.className = 'net-status' + (msg ? (err ? ' err' : ' ok') : ''); }
  playerName() { const n = $('net-name').value.trim().slice(0, 20); this.prefs.name = n; this.savePrefs(); return n || 'Spieler'; }
  _newLobby() {
    const opts = { ...NET_CONFIG, ...(window.STST_NET_CONFIG || {}) };
    const t = createTransport(this.prefs.kind === 'local' ? 'local' : 'peer', this.prefs.kind === 'local' ? { peerTimeoutMs: opts.peerTimeoutMs } : opts);
    const L = new Lobby(t, { name: this.playerName() });
    this.lobby = L; this.pings = {}; this.chatLog = [];
    this._lostShown = false;
    L.on('update', () => this.renderLobby());
    L.on('start', (info) => this.onStart(info));
    L.on('chat', (c) => this.onChat(c));
    L.on('event', (e) => { if (e?.k === 'ping' && L.phase === 'lobby') { this.pings = e.p || {}; this.renderLobby(); } });
    L.on('left', (i) => this.onLeft(i));
    L.on('error', (e) => this.onError(e));
    return L;
  }
  _busy(v) { for (const id of ['btn-net-host', 'btn-net-join']) $(id).disabled = v; }
  async host() {
    if (this.prefs.kind === 'peer' && this.artifact) return;
    this._busy(true);
    this.status('net-status', this.prefs.kind === 'peer' ? 'Verbinde mit dem Vermittlungsserver …' : 'Eröffne lokalen Raum …');
    const L = this._newLobby();
    try {
      await L.hostLobby({ ...DEFAULT_SETTINGS, ...(this.prefs.settings || {}), seed: Math.floor(Math.random() * 99999) + 1 });
      this.enterLobby();
    } catch (e) {
      this._drop();
      this.status('net-status', 'Raum konnte nicht erstellt werden: ' + (e.message || e), true);
    }
    this._busy(false);
  }
  async join() {
    const raw = $('net-code').value.trim();
    if (!raw) { this.status('net-status', 'Bitte den Raumcode eingeben (z. B. stst-K7PXM).', true); return; }
    const code = normalizeRoomCode(raw);
    this._busy(true);
    this.status('net-status', `Verbinde mit Raum ${code} …`);
    const L = this._newLobby();
    try {
      await L.joinLobby(code);
      this.enterLobby();
    } catch (e) {
      this._drop();
      this.status('net-status', this._joinError(e, code), true);
    }
    this._busy(false);
  }
  _joinError(e, code) {
    const m = e?.message || String(e);
    if (e?.code === 'peer-unavailable' || /nicht gefunden|unavailable|Could not connect/i.test(m)) return `Raum ${code} nicht gefunden. Code prüfen – ist der Host noch in der Lobby?` + (this.prefs.kind === 'local' ? ' (Lokal: Host muss im selben Browser geöffnet sein.)' : '');
    return m;
  }
  _drop() {
    try { this.lobby?.leave(); } catch (e) { /* ignorieren */ }
    this.lobby = null;
    clearInterval(this.pingTimer);
  }

  // ================================================================ Lobby
  enterLobby() {
    const L = this.lobby;
    $('lobby-code').textContent = L.code;
    $('lobby-chat-log').innerHTML = '';
    this.status('lobby-status', L.isHost ? 'Raum eröffnet. Gib den Raumcode an deine Mitspieler weiter.' : 'Beigetreten. Wähle Team und Rolle und melde dich bereit.');
    clearInterval(this.pingTimer);
    if (L.isHost) this.pingTimer = setInterval(() => {
      if (!this.lobby || this.lobby.phase !== 'lobby') return;
      const p = {};
      for (const s of this.lobby.state.slots) if (s.kind === 'human') { const ms = this.lobby.latencyOf(s.slot); if (ms !== null) p[s.slot] = Math.round(ms); }
      this.pings = p;
      this.lobby.sendEvent({ k: 'ping', p });
      this.renderLobby();
    }, 2000);
    this.renderLobby();
    this.ctx.show('lobby');
  }
  setSetting(partial) {
    const L = this.lobby;
    if (!L?.isHost || L.phase !== 'lobby') return;
    if (Object.entries(partial).every(([k, v]) => L.state.settings[k] === v)) return; // unverändert → Bereit-Status behalten
    if (L.updateSettings(partial)) {
      const { size, season, preset, night, reinforce, victory, difficulty, playersPerTeam } = L.state.settings;
      this.prefs.settings = { size, season, preset, night, reinforce, victory, difficulty, playersPerTeam }; this.savePrefs();
    } else this.renderLobby();
  }
  renderLobby() {
    const L = this.lobby;
    if (!L?.state) return;
    const st = L.state, S = st.settings, host = L.isHost, me = L.playerId;
    const n = S.playersPerTeam;
    for (const team of TEAMS) {
      const slots = st.slots.filter((s) => s.team === team);
      const humans = slots.filter((s) => s.kind === 'human').length, ais = slots.filter((s) => s.kind === 'ai').length;
      let h = `<h4 style="color:${TEAM_COLOR[team]}"><span>${team === 'UA' ? '🇺🇦 ' : ''}${TEAM_NAME[team]}</span><span class="muted">${humans} Spieler · ${ais} KI</span></h4>`;
      for (const s of slots) h += this._slotRow(s, st, host, me, n);
      // Nur bei Änderungen neu aufbauen (offene Auswahllisten bleiben bedienbar); Ping separat aktualisieren
      const box = $('lobby-team-' + team);
      if (box._html !== h) { box._html = h; box.innerHTML = h; }
      box.querySelectorAll('.ping').forEach((el) => {
        const slot = +el.dataset.slot, s = st.slots[slot];
        const own = s?.peerId === st.hostId && host;
        const ms = s?.kind === 'human' && !own ? (this.pings[slot] ?? (host ? this.lobby.latencyOf(slot) : null)) : null;
        el.textContent = ms === null || ms === undefined ? '' : Math.round(ms) + ' ms';
      });
    }
    const mine = L.mySlot;
    $('lobby-me').textContent = mine ? `Du: ${mine.name} · Team ${TEAM_NAME[mine.team]}${host ? ' · Host' : ''}` : '';
    $('btn-lobby-team').disabled = !mine || !st.slots.some((s) => s.team !== mine.team && s.kind === 'open');
    // Einstellungen
    const box = document.querySelector('.lobby-settings');
    box.classList.toggle('readonly', !host);
    box.querySelectorAll('select, input, button').forEach((el) => { el.disabled = !host; });
    $('ls-mode').querySelectorAll('button').forEach((b) => b.classList.toggle('active', +b.dataset.v === n));
    $('ls-preset').value = S.preset || 'random'; $('ls-size').value = S.size; $('ls-season').value = S.season;
    $('ls-night').checked = !!S.night; $('ls-reinforce').value = String(S.reinforce || 180); $('ls-victory').value = S.victory || 'points';
    $('ls-diff').value = S.difficulty || 'normal';
    if (document.activeElement !== $('ls-seed')) $('ls-seed').value = S.seed;
    this._preview(S);
    // Knöpfe
    $('btn-lobby-ready').classList.toggle('hidden', host);
    $('btn-lobby-start').classList.toggle('hidden', !host);
    if (!host && mine) { $('btn-lobby-ready').textContent = mine.ready ? '✔ Bereit (zurücknehmen)' : 'Bereit melden'; $('btn-lobby-ready').classList.toggle('ready', !!mine.ready); }
    if (host) {
      const notReady = st.slots.filter((s) => s.kind === 'human' && !s.ready && s.peerId !== st.hostId);
      const has = (t) => st.slots.some((s) => s.team === t && (s.kind === 'human' || s.kind === 'ai' || (s.kind === 'open' && S.fillAI)));
      const why = notReady.length ? `Warte auf: ${notReady.map((s) => s.name).join(', ')}` : !has('UA') || !has('RU') ? 'Jedes Team braucht mindestens einen Teilnehmer.' : '';
      $('btn-lobby-start').disabled = !!why;
      $('btn-lobby-start').title = why || 'Alle bereit – Spiel starten';
      if (!this._statusSticky) this.status('lobby-status', why || 'Alle bereit. Offene Plätze werden von der KI übernommen.', false);
    }
  }
  _slotRow(s, st, host, me, n) {
    const isMe = s.slot === me, human = s.kind === 'human', ai = s.kind === 'ai';
    const pos = s.team === 'RU' ? s.slot - n : s.slot;
    const role = ROLES[s.role] ? s.role : ROLE_ORDER[pos % ROLE_ORDER.length];
    const isHostSlot = human && s.peerId === st.hostId;
    let name;
    if (human) name = `<span class="nm" title="${esc(s.name)}">${esc(s.name)}${isMe ? ' (du)' : ''}</span>`;
    else if (ai) name = `<span class="nm">🤖 KI · ${DIFFICULTIES[s.difficulty] || 'Normal'}</span>`;
    else name = `<span class="nm open">${s.kind === 'closed' ? 'Geschlossen' : 'Offen – KI, falls frei'}</span>`;
    let roleEl = '<span></span>';
    if (human || ai || (s.kind === 'open' && st.settings.fillAI)) {
      const can = isMe || (host && ai);
      roleEl = can ? `<select data-act="role" data-slot="${s.slot}" title="Rolle">${Object.entries(ROLES).map(([k, r]) => opt(k, `${r.icon} ${r.name}`, k === role)).join('')}</select>`
        : `<span class="muted" title="${ROLES[role].name}">${ROLES[role].icon} ${ROLES[role].name.split(' ')[0]}</span>`;
    }
    const stTxt = isHostSlot ? '<span class="st ok">★ Host</span>' : human ? (s.ready ? '<span class="st ok">✔ bereit</span>' : '<span class="st wait">⏳ wartet</span>') : ai ? '<span class="st ok">KI</span>' : '<span class="st"></span>';
    const pingEl = `<span class="ping" data-slot="${s.slot}"></span>`;
    let ctl = '<span></span>';
    if (host && !human) {
      const v = s.kind === 'ai' ? 'ai:' + (s.difficulty || 'normal') : s.kind;
      ctl = `<select data-act="kind" data-slot="${s.slot}" title="Platz">${opt('open', 'Offen', v === 'open')}${opt('ai:easy', 'KI leicht', v === 'ai:easy')}${opt('ai:normal', 'KI normal', v === 'ai:normal')}${opt('ai:hard', 'KI schwer', v === 'ai:hard')}${opt('closed', 'Geschlossen', v === 'closed')}</select>`;
    } else if (host && human && !isMe) ctl = `<button data-act="kick" data-slot="${s.slot}" title="Spieler entfernen">✖</button>`;
    return `<div class="slot${isMe ? ' me' : ''}"><i class="dot" style="background:${s.kind === 'closed' ? '#444' : s.color}"></i>${name}${roleEl}${stTxt}${pingEl}${ctl}</div>`;
  }
  _slotChange(e) {
    const el = e.target, L = this.lobby; if (!L) return;
    const idx = +el.dataset.slot;
    if (el.dataset.act === 'role') {
      if (idx === L.playerId) L.setRole(el.value);
      else if (L.isHost) { const s = L.state.slots[idx]; if (s.kind === 'open') L.setSlot(idx, 'ai', { difficulty: L.state.settings.difficulty, role: el.value }); else L.setSlotRole(idx, el.value); }
    } else if (el.dataset.act === 'kind' && L.isHost) {
      const [kind, diff] = el.value.split(':');
      L.setSlot(idx, kind, kind === 'ai' ? { difficulty: diff } : {});
    }
  }
  _slotClick(e) {
    const b = e.target.closest('button[data-act="kick"]'); if (!b || !this.lobby?.isHost) return;
    const s = this.lobby.state.slots[+b.dataset.slot];
    if (s && this.lobby.kick(s.slot)) this.sysChat(`${s.name} wurde entfernt.`);
  }
  _preview(S) {
    const key = `${S.seed}|${S.preset}|${S.size}|${S.season}|${S.playersPerTeam}|${S.night}`;
    if (this._pvKey === key) return;
    this._pvKey = key;
    clearTimeout(this._pvT);
    this._pvT = setTimeout(() => {
      try {
        const gen = generateSkirmishMap({ size: S.size, seed: S.seed, playersPerTeam: S.playersPerTeam, season: S.season, night: !!S.night, preset: S.preset || 'random' });
        const c = $('ls-map'), cx = c.getContext('2d');
        const ck = `${S.seed}|${gen.preset}|${S.size}|${S.season}|${S.playersPerTeam}`;
        let img = this.previewCache.get(ck);
        if (!img) { img = new Terrain(gen.map, 'low').minimapImage(200); this.previewCache.set(ck, img); }
        cx.fillStyle = '#111'; cx.fillRect(0, 0, c.width, c.height); cx.drawImage(img, 0, 0, c.width, c.height);
        const N = gen.map.size, toC = (x, z) => [((x + N / 2) / N) * c.width, ((z + N / 2) / N) * c.height];
        for (const cp of gen.capturePoints) { const [x, y] = toC(cp.x, cp.z); cx.fillStyle = 'rgba(140,144,150,.6)'; cx.strokeStyle = '#fff'; cx.beginPath(); cx.arc(x, y, Math.max(4, cp.radius / N * c.width), 0, 7); cx.fill(); cx.stroke(); }
        for (const team of TEAMS) gen.spawns[team].forEach((sp) => { const [x, y] = toC(sp.x, sp.z); cx.fillStyle = TEAM_COLOR[team]; cx.fillRect(x - 4, y - 4, 8, 8); });
        const small = MAP_SIZES[S.size]?.maxPerTeam < S.playersPerTeam;
        $('ls-info').innerHTML = `<b>${esc(gen.title)}</b><br>${gen.capturePoints.length} Eroberungspunkte · Seed <b>${S.seed}</b>` + (small ? `<br><span style="color:var(--accent)">Karte wird für ${S.playersPerTeam}v${S.playersPerTeam} vergrößert.</span>` : '');
      } catch (err) { console.error(err); }
    }, 120);
  }
  copyCode() {
    const code = this.lobby?.code; if (!code) return;
    const done = () => this.status('lobby-status', `Raumcode ${code} kopiert.`);
    const fallback = () => {
      const el = $('lobby-code'), r = document.createRange();
      r.selectNodeContents(el); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
      let ok = false; try { ok = document.execCommand('copy'); } catch (e) { /* ignorieren */ }
      this.status('lobby-status', ok ? `Raumcode ${code} kopiert.` : 'Raumcode markiert – mit Strg+C (bzw. lange tippen → Kopieren) übernehmen.');
    };
    this._statusSticky = true; setTimeout(() => { this._statusSticky = false; }, 3000);
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(code).then(done, fallback);
    else fallback();
  }
  startMatch() {
    const L = this.lobby; if (!L?.isHost) return;
    const st = L.state;
    // Offene Plätze mit der eingestellten KI-Stärke füllen
    if (st.settings.fillAI !== false) for (const s of st.slots) if (s.kind === 'open') L.setSlot(s.slot, 'ai', { difficulty: st.settings.difficulty || 'normal' });
    if (!L.start()) this.renderLobby();
  }
  leaveLobby() {
    this._drop();
    this.open('Lobby verlassen.');
  }

  // ================================================================ Lobby-Ereignisse
  onChat(c) {
    const line = `<div><b>${esc(c.name)}${c.scope === 'team' ? ' [Team]' : ''}:</b> ${esc(c.text)}</div>`;
    if (this.inGame) this.gameChat(line);
    else { const log = $('lobby-chat-log'); log.insertAdjacentHTML('beforeend', line); log.scrollTop = log.scrollHeight; }
  }
  sysChat(text) {
    const line = `<div class="sys">${esc(text)}</div>`;
    if (this.inGame) this.gameChat(line);
    else { const log = $('lobby-chat-log'); log.insertAdjacentHTML('beforeend', line); log.scrollTop = log.scrollHeight; }
  }
  sendChat(input, game = false) {
    let text = input.value.trim(); input.value = '';
    if (!text || !this.lobby) return;
    let scope = 'all';
    if (/^\/t\s/i.test(text)) { scope = 'team'; text = text.slice(3).trim(); }
    if (text) this.lobby.sendChat(text, scope);
  }
  onLeft(i) {
    const L = this.lobby; if (!L) return;
    if (i.host) return; // Host-Verlust kommt als Fehler 'host-lost'
    if (!this.inGame && L.phase === 'lobby') this.sysChat(`${i.name || 'Ein Spieler'} hat die Lobby verlassen.`);
  }
  onError(e) {
    const code = e?.code, msg = e?.message || String(e);
    if (code === 'host-lost' || code === 'rejected') {
      if (this._lostShown) return;
      this._lostShown = true;
      const txt = code === 'rejected' ? msg : /verlassen/.test(msg) ? 'Der Host hat das Spiel verlassen.' : msg || 'Verbindung zum Host verloren.';
      if (this.inGame || this.session) this.hostLost(txt);
      else { this._drop(); this.open(txt, true); }
      return;
    }
    if (this.inGame) { this.game.alert(msg, 3); return; }
    if (this.lobby && $('screen-lobby') && !$('screen-lobby').classList.contains('hidden')) {
      this._statusSticky = true; setTimeout(() => { this._statusSticky = false; }, 4000);
      this.status('lobby-status', msg, true);
    } else this.status('net-status', msg, true);
  }
  hostLost(text) {
    if (this.game.ended && this.inGame) { this.game.alert(text, 4); return; }
    $('net-msg-title').textContent = 'Verbindung beendet';
    $('net-msg-text').textContent = `${text} Das Online-Gefecht ist beendet.`;
    $('net-msg').classList.remove('hidden');
  }

  // ================================================================ Spiel
  async onStart(info) {
    const L = this.lobby;
    clearInterval(this.pingTimer);
    this._lostShown = false;
    const role = L.isHost ? 'host' : 'client';
    const myId = L.playerId;
    const S = setupFromStart(info, myId, role);
    const sess = role === 'host' ? new HostSession(this.game, L, info, S) : new ClientSession(this.game, L, info, S);
    this.session = sess;
    this.game.net = sess.net;
    sess.onSys = (txt) => this.sysChat(txt);
    sess.onWait = (txt) => { const el = $('net-wait'); el.textContent = txt; el.classList.toggle('hidden', !txt); };
    this.inGame = true;
    document.activeElement?.blur?.(); // Fokus aus dem (dann verborgenen) Lobby-Chat nehmen – sonst greifen Tasten nicht
    $('net-chat-log').innerHTML = '';
    await this.ctx.startGame(S, sess);
    if (this.session !== sess) return; // inzwischen verlassen
    sess.onLoaded();
    $('btn-chat').classList.remove('hidden');
    $('net-chat').classList.remove('hidden');
    if (role === 'host') this._startTicker();
    this.sysChat(`Online-Gefecht ${S.mode}v${S.mode} gestartet – Raum ${info.code}. Enter öffnet den Chat (/t … nur Team).`);
  }
  // Pro Frame aus main.js
  update(dt) { this.session?.update(dt); this._chatFade(dt); }
  // Host im Hintergrund-Tab: Simulation über einen Worker-Takt weiterlaufen lassen (requestAnimationFrame ruht dort)
  _startTicker() {
    this._stopTicker();
    this.lastFrame = performance.now();
    const tick = () => {
      const now = performance.now();
      if (now - this.lastFrame > 250 && this.session?.isHost) { const dt = Math.min(0.1, (now - (this._bgLast || now - 50)) / 1000); this._bgLast = now; this.ctx.simTick(dt); }
      else this._bgLast = now;
    };
    try {
      const src = 'let t=setInterval(()=>postMessage(0),50);onmessage=()=>{clearInterval(t);close();}';
      this.worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      this.worker.onmessage = tick;
    } catch (e) { this.tickTimer = setInterval(tick, 50); }
  }
  _stopTicker() {
    if (this.worker) { try { this.worker.postMessage(0); this.worker.terminate(); } catch (e) { /* ignorieren */ } this.worker = null; }
    clearInterval(this.tickTimer);
  }
  frameDone() { this.lastFrame = performance.now(); }
  async leaveGame() {
    const sess = this.session;
    this.session = null; this.inGame = false;
    this._stopTicker();
    sess?.dispose();
    this.game.net = null;
    this._drop();
    $('btn-chat').classList.add('hidden'); $('net-chat').classList.add('hidden'); $('net-wait').classList.add('hidden');
    $('net-msg').classList.add('hidden');
    this.toggleChat(false);
    await this.ctx.toMenu();
  }
  // ---- In-Game-Chat ----
  gameChat(html) {
    const log = $('net-chat-log');
    log.insertAdjacentHTML('beforeend', html);
    const el = log.lastElementChild; el.dataset.t = String(performance.now());
    while (log.children.length > 8) log.firstElementChild.remove();
    log.scrollTop = log.scrollHeight;
    if (this.game.audio) this.game.audio.ui('click');
  }
  _chatFade() {
    const log = $('net-chat-log'); if (!log?.children.length || this.chatOpen) return;
    const now = performance.now();
    for (const el of [...log.children]) if (now - +(el.dataset.t || 0) > 15000) el.remove();
  }
  toggleChat(v = !this.chatOpen) {
    this.chatOpen = v && this.inGame;
    $('net-chat-form').classList.toggle('hidden', !this.chatOpen);
    if (this.chatOpen) $('net-chat-input').focus(); else $('net-chat-input').blur();
  }
}

export { MAX_PER_TEAM };
