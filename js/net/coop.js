// Koop-Kampagne zu zweit (V3-RS)
//
// Ablauf: Briefing → „Koop (online)“ → Online-Menü (Raum erstellen) → Lobby mit Missionsvorgabe (settings.coop = {cid, idx, mid,
// title}); Team UA hat 2 Plätze, Team RU ist geschlossen (den Gegner stellt die Mission). Start → beide laden die Mission mit
// demselben Seed. Host: volle Simulation inkl. Missionsskripten (wie offline), Gast: Client wie im Online-Gefecht.
//   • Spieler: Host = Slot 0, Gast = Slot 1 (beide Team UA), Gegner = KI-Spieler Slot 2 (Team RU, Einheiten-KI der Mission).
//   • game.coop = { team, humans, ownerFor(typ, seite) }: neue Einheiten des Teams ohne ausdrücklichen Besitzer werden je Typ
//     abwechselnd auf beide Spieler verteilt (Hook in game.spawn) – gilt auch für Verstärkungen der Missionsskripte.
//   • Fähigkeiten geteilt: der Gast liest/schreibt die Fähigkeitenliste des Hosts (gemeinsame Ladungen/Abklingzeit, p.coopShare).
//   • Niederlage erst, wenn beide keine Einheiten mehr haben (game.checkDefeat); Sieg/Niederlage der Mission → Ereignis 'end' an
//     den Gast (Fortschritt wird bei beiden gespeichert, main.js → completeMission).
//   • Funk/Warnungen der Mission (g.say/g.alert) gehen auch an den Gast; Ziele und Countdown laufen im Snapshot mit (ob, cd).
//   • Gast: Mission wird mit Seed geladen (gleiche Karte, Brücken, ids), danach alle Einheiten/Timer der Skripte entfernt –
//     Einheiten kommen per Snapshot vom Host, Skripte laufen nur dort.
// Missionsskripte bleiben unverändert: sie arbeiten mit Seiten ('UA'/'RU') bzw. dem ersten Spieler eines Teams.
import { icon } from '../game/icons.js';
import { t, registerStrings } from '../i18n.js';
import { UNIT_TYPES } from '../game/unitTypes.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const r1 = (v) => Math.round(v * 10) / 10;
export const COOP_TEAM = 'UA';

registerStrings('en', {
  'coop.btn': 'Co-op (online)', 'coop.btn.t': 'Play this mission online together with a second player',
  'coop.open': 'Co-op: “{m}” – create a room and pass the code to your partner (they join via “Join room”).',
  'coop.lobby': 'Co-op campaign', 'coop.lobby.p': 'Both players command the same team. Units are split between you, abilities are shared. Progress is saved for both.',
  'coop.notfound': 'The co-op mission was not found (different game version?).',
});

/** Koop-Objekt für game.coop (Host und Wiedergabe verteilen, Client nicht). */
export function makeCoop(game, spec) {
  return {
    team: spec.team || COOP_TEAM, humans: spec.humans.slice(), counts: {}, seen: 0,
    ownerFor(typeKey, side) {
      if (side !== this.team || game.net?.isClient || this.humans.length < 2) return null;
      const T = UNIT_TYPES[typeKey];
      if (!T || T.structure || T.cp) return null;
      let c = this.counts[typeKey];
      if (c === undefined) c = this.seen++ % this.humans.length; // Startversatz je Typ abwechselnd → ausgewogene Mischung
      this.counts[typeKey] = c + 1;
      return this.humans[c % this.humans.length];
    },
  };
}

/** Spielerliste/Setup aus der Start-Nachricht der Lobby. */
export function coopSetup(info, myId, role) {
  const humans = info.slots.filter((s) => s.kind === 'human' && s.team === COOP_TEAM).sort((a, b) => a.slot - b.slot);
  const players = humans.map((s) => ({ id: s.slot, team: COOP_TEAM, name: s.name || `Spieler ${s.slot + 1}`, color: s.color, local: s.slot === myId, remote: s.slot !== myId }));
  const ruId = info.slots.find((s) => s.team === 'RU')?.slot ?? 2;
  players.push({ id: ruId, team: 'RU', name: 'KI', color: '#ff4d4d', ai: true });
  return { coop: { ...info.settings.coop }, players, team: COOP_TEAM, netRole: role, online: true, seed: info.seed, mode: 2, difficulty: 'normal' };
}

/** Client: Einheiten/Timer der lokal ausgeführten Missionsvorbereitung entfernen (kommen per Snapshot vom Host). */
export function purgeClient(g) {
  for (const u of [...g.units]) {
    if (!u.alive || u.side === 'N') continue;
    u.alive = false;
    g.scene.remove(u.root);
    if (u._cone) u._cone.visible = false;
    try { g.removeUnit(u); } catch (e) { /* Aufräumen */ }
  }
  for (const h of g.units) if (h.occupants?.length) { h.occupants = []; h.garrisonSide = null; try { g.gar?.updateBadge?.(h); } catch (e) { /* */ } }
  g.timers = []; g.animations = []; g.countdown = null;
  g.select([]);
}

export function installCoop(d) {
  // d = { game, rec, online, currentMission(), findMission(m), resolveMission(ctx), loadWithSpinner(text, fn) }
  const { game } = d;
  game.on('beginLoad', () => { game.coop = game._coopNext ? makeCoop(game, game._coopNext) : null; game._coopNext = null; });
  // Geteilte Fähigkeiten: der Partner liest/schreibt die Liste des Hosts (vor mission.setup → setAbilities)
  game.on('preSetup', () => {
    const c = game.coop; if (!c) return;
    const host = game.playerById(c.humans[0]); if (!host) return;
    for (const id of c.humans.slice(1)) {
      const p = game.playerById(id); if (!p) continue;
      p.coopShare = true;
      Object.defineProperty(p, 'abilities', { get: () => host.abilities, set: (v) => { host.abilities = v; }, configurable: true, enumerable: true });
    }
  });
  function prepare(S) {
    game._coopNext = { team: COOP_TEAM, humans: S.players.filter((p) => !p.ai && p.team === COOP_TEAM).map((p) => p.id) };
  }

  // ---------------- Briefing: Knopf „Koop (online)“ ----------------
  const start = $('btn-start-mission');
  if (start && !$('btn-brief-coop')) {
    const b = document.createElement('button');
    b.id = 'btn-brief-coop'; b.className = 'brief-coop';
    b.title = t('coop.btn.t', 'Diese Mission online gemeinsam mit einem zweiten Spieler spielen');
    b.innerHTML = `${icon('team', { cls: 'ic-in' })}<span>${esc(t('coop.btn', 'Koop (online)'))}</span>`;
    b.onclick = () => {
      const m = d.currentMission(); const fm = m && d.findMission(m);
      if (!fm) return;
      d.online.coopPending = { cid: fm.campaign.id, idx: fm.index, mid: m.id, title: m.title };
      d.online.open(t('coop.open', 'Koop: „{m}“ – Raum erstellen und den Code an den Mitspieler weitergeben (er tritt über „Raum beitreten“ bei).', { m: m.title }));
    };
    start.parentNode.insertBefore(b, start);
  }
  // Briefing für eigene Karten/Tutorial: Knopf nur für Kampagnenmissionen
  const syncBtn = () => { const b = $('btn-brief-coop'), m = d.currentMission(); if (b) b.classList.toggle('hidden', !(m && d.findMission(m) && !m.custom && d.findMission(m).campaign.era !== 'tutorial')); };
  const brief = $('screen-briefing');
  if (brief) new MutationObserver(syncBtn).observe(brief, { attributes: true, attributeFilter: ['class'] });

  // ---------------- Lobby: Hinweis „Koop-Kampagne“ ----------------
  const L0 = d.online.renderLobby.bind(d.online);
  const banner = document.createElement('div');
  banner.id = 'lobby-coop'; banner.className = 'lobby-coop hidden';
  const teams = $('lobby-team-UA');
  teams?.parentNode?.insertBefore(banner, teams);
  d.online.renderLobby = (...a) => {
    const r = L0(...a);
    const st = d.online.lobby?.state, c = st?.settings?.coop;
    $('screen-lobby')?.classList.toggle('coop', !!c);
    banner.classList.toggle('hidden', !c);
    if (c) {
      const html = `${icon('team', { cls: 'ic-in' })} <b>${esc(t('coop.lobby', 'Koop-Kampagne'))}: ${esc(c.title || '')}</b><br><span class="muted">${esc(t('coop.lobby.p', 'Beide Spieler führen dasselbe Team. Die Einheiten werden aufgeteilt, Fähigkeiten sind gemeinsam. Der Fortschritt wird bei beiden gespeichert.'))}</span>`;
      if (banner._html !== html) { banner._html = html; banner.innerHTML = html; }
    }
    return r;
  };

  // ---------------- Spielstart (aus main.js startOnlineGame) ----------------
  async function startGame(S, h) {
    // h = { hideScreens, setMission(m), loadWithSpinner, afterLoad(m) }
    const m = d.resolveMission(S.coop);
    if (!m) { d.online.hostLost(t('coop.notfound', 'Die Koop-Mission wurde nicht gefunden (andere Spielversion?).')); return null; }
    game.difficulty = 'normal';
    const host = S.netRole === 'host';
    const ctx = { kind: 'coop', cid: S.coop.cid, idx: S.coop.idx, mid: S.coop.mid, players: JSON.parse(JSON.stringify(S.players)), coop: { ...S.coop } };
    await h.loadWithSpinner(`Lade Koop-Einsatz „${m.title}“ …`, () => {
      game.camera.orbit = false;
      prepare(S);
      // gleicher Seed auf beiden Rechnern → gleiche Kartenobjekte/ids; der Host zeichnet zusätzlich auf (Wiederholung)
      d.rec.runLoad(ctx, S.seed, () => { game.setupPlayers(S.players); game.load(m); });
      if (!host) purgeClient(game);
    });
    if (!game.active) return null;
    return m;
  }
  // Wiedergabe einer Koop-Aufzeichnung (offline, Perspektive des Hosts)
  function loadForReplay(c, seed, m) {
    if (!m) return null;
    const players = c.players.map((p) => ({ ...p, remote: false }));
    prepare({ players });
    d.rec.runLoad(c, seed, () => { game.setupPlayers(players); game.load(m); });
    return m;
  }

  // ---------------- Sitzung: Host leitet Funk/Ziele/Ende weiter, Gast übernimmt sie ----------------
  function onSession(sess, S) {
    if (!S?.coop) return;
    const g = game;
    if (sess.isHost) {
      sess.extraSnap = (withPlayers) => {
        const ob = g.objectives.map((o) => [o.id, o.state, o.text, o.optional ? 1 : 0, o.hidden ? 1 : 0]);
        const key = JSON.stringify(ob), out = {};
        if (key !== sess._obKey || withPlayers) { out.ob = ob; sess._obKey = key; }
        out.cd = g.countdown ? [r1(g.countdown.t), String(g.countdown.label || '')] : 0;
        return out;
      };
      let inNotify = 0;
      const n0 = g.notify;
      g.notify = function (...a) { inNotify++; try { return n0.apply(this, a); } finally { inNotify--; } };
      const onSay = (sp, text, dur) => { if (!inNotify) sess._feedback(null, 'say', [sp, text, dur]); };
      const onAlert = (text, dur) => { if (!inNotify) sess._feedback(null, 'alert', [text, dur]); };
      const onEnd = (won, text) => sess._feedback(null, 'end', [!!won, String(text || '')]);
      g.on('say', onSay); g.on('alert', onAlert); g.on('end', onEnd);
      const d0 = sess.dispose.bind(sess);
      sess.dispose = () => { g.off('say', onSay); g.off('alert', onAlert); g.off('end', onEnd); if (g.notify !== n0) delete g.notify; d0(); };
    } else {
      sess.onExtraSnap = (s) => {
        if (s.ob) { g.objectives = s.ob.map(([id, state, text, opt, hid]) => ({ id, state, text, optional: !!opt, hidden: !!hid })); g.emit('objectives'); }
        if (s.cd !== undefined) g.countdown = s.cd ? { t: s.cd[0], label: s.cd[1] } : null;
      };
      sess.onFb = (kind, a) => { if (kind === 'end' && !g.ended) { g.ended = true; g.emit('end', !!a[0], a[1] || ''); } };
    }
  }
  return { prepare, startGame, loadForReplay, onSession, coopSetup, purgeClient };
}
