// Zuschauermodus online (V3-RS)
//
// Host (SpectatorFeed, von HostSession angelegt, wenn die Start-Nachricht Zuschauer enthält):
//   • Snapshots je Zuschauer: Sicht 'all' = alle Einheiten ungefiltert (volle Details), sonst teamEntries(Team) wie ein Spieler
//     dieses Teams; Spielerliste/Statistik immer ungefiltert (beide Teams). Kein 'me' (keine Fähigkeiten).
//   • Ereignisse: alle Effekte/Tode/Flugkörper ohne Sichtfilter, Funk beider Teams.
//   • Optional Verzögerung (Lobby-Einstellung specDelay, z. B. 10 s) gegen Mitlesen: alles wird gepuffert und später gesendet.
//   • Zuschauer können nichts befehlen: die Lobby verwirft 'cmd' von Zuschauern, game.spectator sperrt issueCommand.
// Client (createSpectatorUI): Panel mit Sicht (Alle / Ukraine / Russland), Kamera folgen (Spieler) bzw. frei, Statistik beider
//   Teams (Einheiten, Abschüsse, Verluste, Punkte). Lobby: Zuschauerplätze (bis 4), „Zuschauen“/„Mitspielen“, Host-Option Verzögerung.
import { icon } from '../game/icons.js';
import { t, registerStrings } from '../i18n.js';
import { fowUniforms } from '../engine/fow.js';
import { UNIT_CODEC } from './session.js';
import { followCenter } from '../game/replay.js';

const r1 = (v) => Math.round(v * 10) / 10;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const TEAM = { UA: ['Ukraine', '#2f7de1'], RU: ['Russland', '#e5484d'] };

registerStrings('en', {
  'spec.title': 'Spectator', 'spec.view': 'View', 'spec.all': 'All', 'spec.follow.free': 'Free camera', 'spec.units': 'Units', 'spec.kl': 'K/L',
  'spec.lobby': 'Spectators', 'spec.none': 'no spectators', 'spec.join': 'Spectate', 'spec.play': 'Play', 'spec.delay': '10 s delay for spectators',
  'spec.joinBtn': 'Join as spectator', 'spec.you': 'You are watching', 'spec.points': 'pts', 'spec.end': '{t} wins', 'spec.endDraw': 'Draw',
});
registerStrings('en', { 'Ukraine': 'Ukraine', 'Russland': 'Russia' });

// =====================================================================================================================
export class SpectatorFeed {
  constructor(host, info) {
    this.h = host;
    this.ids = (info.spectators || []).map((s) => s.id);
    this.gone = new Set();
    this.view = new Map(this.ids.map((id) => [id, 'all']));
    this.delay = Math.max(0, +(info.settings?.specDelay || 0));
    this.q = []; this.buf = [];
    this.stats = { snaps: 0, events: 0 };
  }
  get active() { return this.ids.some((id) => !this.gone.has(id)); }
  get live() { return this.ids.filter((id) => !this.gone.has(id)); }
  left(id) { this.gone.add(id); }
  setView(id, v) { if (this.view.has(id)) this.view.set(id, v === 'UA' || v === 'RU' ? v : 'all'); }
  ev(e) { if (this.active) this.q.push(e); }
  _send(kind, msg, id) {
    if (this.delay > 0) this.buf.push([performance.now() + this.delay * 1000, kind, msg, id]);
    else if (kind === 'snap') this.h.lobby.sendSnap(msg, id); else this.h.lobby.sendEvent(msg, id);
  }
  _drain() {
    const now = performance.now();
    while (this.buf.length && this.buf[0][0] <= now) {
      const [, kind, msg, id] = this.buf.shift();
      if (this.gone.has(id)) continue;
      if (kind === 'snap') this.h.lobby.sendSnap(msg, id); else this.h.lobby.sendEvent(msg, id);
    }
    if (this.buf.length > 4000) this.buf.splice(0, this.buf.length - 4000);
  }
  flush() {
    if (this.q.length && this.active) {
      const msg = { t: r1(this.h.game.time), l: this.q };
      for (const id of this.live) { this._send('event', msg, id); this.stats.events++; }
    }
    this.q = [];
    this._drain();
  }
  snap(common, rows) {
    if (!this.active) return;
    const enc = {};
    for (const id of this.live) {
      const v = this.view.get(id) || 'all';
      if (!enc[v]) enc[v] = UNIT_CODEC.encode(v === 'all' ? this.allEntries() : this.h.teamEntries(v));
      const msg = { ...common, u: enc[v], spec: v, ...(rows ? { pl: rows } : {}) };
      this._send('snap', msg, id);
      this.stats.snaps++;
    }
  }
  /** Alle lebenden Einheiten (ohne Eroberungspunkte), Häuser bei Schaden/Besatzung – mit vollen Details. */
  allEntries() {
    const g = this.h.game, out = [];
    for (const u of g.units) {
      if (!u.alive || u.type.cp) continue;
      if (u.type.key === 'house') {
        const occ = u.occupants?.length > 0;
        if (u.hp < u.maxHp - 0.5 || occ || (u.damageStage || 0) > 0) out.push(this.h.houseEntry(u, u.garrisonSide === 'RU' ? 'RU' : 'UA', false));
        continue;
      }
      if (u.side === 'N' && !u.abandoned) continue;
      out.push(this.h.unitEntry(u, u.abandoned ? u.prevSide : u.side));
    }
    out.sort((a, b) => a[0] - b[0]);
    return out;
  }
}

// =====================================================================================================================
// Client-Oberfläche (Panel im Spiel + Lobby-Ergänzungen)
export function createSpectatorUI({ game, online }) {
  let sess = null, view = 'all', follow = null, raf = 0, min = false;
  const panel = document.createElement('div');
  panel.id = 'spec-panel'; panel.className = 'spec-panel hidden';
  panel.innerHTML = `<h4><span>${icon('los', { cls: 'ic-in' })} ${esc(t('spec.title', 'Zuschauer'))}</span><button class="spec-min" id="spec-min" aria-label="Ein-/ausklappen">–</button></h4>
    <div class="spec-body"><div class="seg" id="spec-view"><button data-v="all">${esc(t('spec.all', 'Alle'))}</button><button data-v="UA">${esc(t('Ukraine', 'Ukraine'))}</button><button data-v="RU">${esc(t('Russland', 'Russland'))}</button></div>
    <select id="spec-follow" aria-label="Kamera"></select><div id="spec-stats"></div></div>`;
  document.body.appendChild(panel);
  for (const ev of ['keydown', 'keyup', 'pointerdown', 'wheel']) panel.addEventListener(ev, (e) => e.stopPropagation());
  $('spec-min').onclick = () => { min = !min; panel.classList.toggle('min', min); $('spec-min').textContent = min ? '+' : '–'; };
  $('spec-view').addEventListener('click', (e) => { const b = e.target.closest('button[data-v]'); if (b) setView(b.dataset.v); });
  $('spec-follow').addEventListener('change', () => { const v = $('spec-follow').value; follow = v === '' ? null : +v; });

  // Zuschauer-Flag vor dem Laden setzen (game.spectator sperrt Befehle); bei jedem anderen Laden zurücksetzen
  game.on('beginLoad', () => { game.spectator = !!game._specNext; game._specNext = false; if (!game.spectator) stop(); });

  function setView(v) {
    view = v;
    const g = game;
    if (v === 'all') {
      for (const T of ['UA', 'RU']) if (g.fows?.[T]) g.fows[T].enabled = false;
      fowUniforms.uFowEnabled.value = 0;
    } else {
      const p = g.playersOfTeam(v)[0];
      if (p && g.localPlayerId !== p.id) g.localPlayerId = p.id;
      for (const T of ['UA', 'RU']) if (g.fows?.[T]) g.fows[T].enabled = !g.mission?.map?.noFog;
      fowUniforms.uFowEnabled.value = g.fow?.enabled ? 1 : 0;
    }
    g.visionT = 0;
    sess?.lobby?.specView(v);
    render();
  }
  function begin(session) {
    sess = session;
    document.body.classList.add('spectating');
    panel.classList.remove('hidden');
    follow = null;
    const sel = $('spec-follow');
    sel.innerHTML = `<option value="">${esc(t('spec.follow.free', 'Freie Kamera'))}</option>` + game.players.map((p) => `<option value="${p.id}">${esc(p.name)} (${p.team})</option>`).join('');
    setView('all');
    cancelAnimationFrame(raf);
    let last = performance.now(), acc = 0;
    const loop = (now) => {
      if (!sess) return;
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (follow != null) { const c = followCenter(game, follow); if (c) { game.camera.goal.x = c.x; game.camera.goal.z = c.z; } }
      if (view === 'all') { fowUniforms.uFowEnabled.value = 0; for (const u of game.units) if (u.alive && u.side !== 'N') u.root.visible = !u.garrison; }
      acc += dt; if (acc > 0.5) { acc = 0; render(); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  }
  function stop() {
    sess = null; cancelAnimationFrame(raf);
    document.body.classList.remove('spectating');
    panel.classList.add('hidden');
  }
  function render() {
    $('spec-view').querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.v === view));
    const sk = game.mission?.skirmish, rows = [];
    for (const T of ['UA', 'RU']) {
      const ps = game.playersOfTeam(T);
      const kills = ps.reduce((s, p) => s + (p.stats.kills || 0), 0), lost = ps.reduce((s, p) => s + (p.stats.lost || 0), 0);
      rows.push(`<tr class="team"><td style="color:${TEAM[T][1]}">${esc(t(TEAM[T][0], TEAM[T][0]))}${sk ? ` · ${sk.scores[T]} ${esc(t('spec.points', 'Pkt.'))}` : ''}</td><td class="n">${kills}/${lost}</td></tr>`);
      for (const p of ps) {
        let n = p.netUnits;
        if (n === undefined || n < 0) { n = 0; for (const u of game.units) if (u.alive && u.owner === p.id && !u.type.structure && !u.type.kamikaze) n++; }
        rows.push(`<tr${p.defeated ? ' class="muted"' : ''}><td><span class="dot" style="background:${esc(p.color)}"></span>${esc(p.name)} <span class="muted">· ${n}</span></td><td class="n">${p.stats.kills | 0}/${p.stats.lost | 0}</td></tr>`);
      }
    }
    $('spec-stats').innerHTML = `<table><tr><td class="muted">${esc(t('spec.units', 'Spieler · Einheiten'))}</td><td class="n muted">${esc(t('spec.kl', 'A/V'))}</td></tr>${rows.join('')}</table>`;
  }
  // Ende: neutrales Ergebnis statt Sieg/Niederlage aus Sicht eines Teams
  game.on('end', () => {
    if (!game.spectator) return;
    setTimeout(() => {
      const res = game.mission?.skirmish?.result, w = $('end-word');
      if (!w) return;
      $('screen-end').dataset.result = 'draw';
      w.textContent = res?.winner ? t('spec.end', '{t} gewinnt', { t: t(TEAM[res.winner][0], TEAM[res.winner][0]) }) : t('spec.endDraw', 'Unentschieden');
    }, 0);
  });

  // ---------------- Lobby: Zuschauerplätze ----------------
  const box = document.createElement('div');
  box.id = 'lobby-specs'; box.className = 'lobby-specs';
  const anchor = document.querySelector('#screen-lobby .lobby-tools');
  anchor?.parentNode?.insertBefore(box, anchor.nextSibling);
  box.addEventListener('click', (e) => {
    const L = online.lobby; if (!L) return;
    const b = e.target.closest('button[data-act]'); if (!b) return;
    if (b.dataset.act === 'spec') L.setSpectate(true);
    else if (b.dataset.act === 'play') L.setSpectate(false);
  });
  box.addEventListener('change', (e) => {
    const L = online.lobby; if (!L?.isHost) return;
    if (e.target.id === 'ls-specdelay') online.setSetting({ specDelay: e.target.checked ? 10 : 0 });
  });
  function renderLobby() {
    const L = online.lobby, st = L?.state;
    if (!st) return;
    const coop = !!st.settings?.coop;
    box.classList.toggle('hidden', coop);
    if (coop) return;
    const specs = st.specs || [], me = L.mySpec, host = L.isHost;
    const names = specs.length ? specs.map((s) => esc(s.name) + (me && s.id === me.id ? ' (du)' : '')).join(', ') : `<span class="muted">${esc(t('spec.none', 'keine Zuschauer'))}</span>`;
    let btn = '';
    if (!host && me) btn = `<button data-act="play">${icon('player', { cls: 'ic-in' })} ${esc(t('spec.play', 'Mitspielen'))}</button>`;
    else if (!host && L.mySlot && specs.length < 4) btn = `<button data-act="spec">${icon('los', { cls: 'ic-in' })} ${esc(t('spec.join', 'Zuschauen'))}</button>`;
    const delay = `<label class="spec-delay"><input type="checkbox" id="ls-specdelay" ${st.settings.specDelay ? 'checked' : ''} ${host ? '' : 'disabled'}> ${esc(t('spec.delay', '10 s Verzögerung für Zuschauer'))}</label>`;
    const html = `${icon('los', { cls: 'ic-in' })}<b>${esc(t('spec.lobby', 'Zuschauer'))} ${specs.length}/4:</b><span class="spec-names">${names}</span>${btn}${delay}`;
    if (box._html !== html) { box._html = html; box.innerHTML = html; }
    if (me) { // Zuschauer: kein „Bereit“, Hinweis
      $('btn-lobby-ready')?.classList.add('hidden');
      const el = $('lobby-me'); if (el) el.textContent = `${t('spec.you', 'Du schaust zu')}: ${me.name}`;
    }
  }
  const r0 = online.renderLobby.bind(online);
  online.renderLobby = (...a) => { const r = r0(...a); try { renderLobby(); } catch (e) { console.warn('[spec] Lobby', e); } return r; };

  // Beitreten als Zuschauer (Knopf neben „Raum beitreten“)
  const joinBtn = $('btn-net-join');
  if (joinBtn && !$('btn-net-spectate')) {
    const b = document.createElement('button');
    b.id = 'btn-net-spectate'; b.className = 'ghost';
    b.innerHTML = `${icon('los', { cls: 'ic-in' })} ${esc(t('spec.joinBtn', 'Als Zuschauer beitreten'))}`;
    b.onclick = () => online.join({ spectate: true });
    joinBtn.parentNode.appendChild(b);
  }
  return { begin, stop, setView, render, get view() { return view; }, get follow() { return follow; }, set follow(v) { follow = v; } };
}
