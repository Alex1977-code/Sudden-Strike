// Wiederholungen – Oberfläche (V3-RS): Bildschirm „Wiederholungen“, Steuerleiste der Wiedergabe, Knöpfe im Endbildschirm,
// Datei-Export/-Import (.ssreplay) und – online – Anfrage der Wiederholung beim Host.
// Die DOM-Elemente werden hier erzeugt (keine Änderung an index.html nötig); Texte über t() (Schlüssel rs.*).
import { icon } from './icons.js';
import { t, registerStrings } from '../i18n.js';
import { fmtTime } from '../engine/util.js';
import { ReplayMarks, ReplayStore, ReplayDriver, buildReplay, encodeReplayFile, decodeReplayFile, replayFileName, replayValid } from './replay.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SPEEDS = [0.5, 1, 2, 4, 8];
const CHUNK = 48000; // Zeichen je Netzpaket beim Versand an Mitspieler

registerStrings('en', {
  'rs.menu': 'Replays', 'rs.over': 'Archive', 'rs.title': 'Replays', 'rs.note': 'The last {n} games are kept automatically. Export a replay to keep it permanently or to share it (.ssreplay).',
  'rs.empty': 'No replays yet – finish a mission or skirmish.', 'rs.watch': 'Watch', 'rs.export': 'Export', 'rs.import': 'Import', 'rs.delete': 'Delete',
  'rs.win': 'Victory', 'rs.loss': 'Defeat', 'rs.draw': 'Draw', 'rs.dur': 'Duration', 'rs.end.watch': 'Watch replay', 'rs.end.export': 'Save replay',
  'rs.end.request': 'Request replay from host', 'rs.end.saved': 'Replay saved', 'rs.loading': 'Loading replay …', 'rs.seek': 'Re-simulating … {p} %',
  'rs.view': 'View', 'rs.view.auto': 'Recorded', 'rs.view.all': 'All revealed', 'rs.follow': 'Follow', 'rs.follow.free': 'Free camera', 'rs.exit': 'Exit replay',
  'rs.ended': 'End of replay', 'rs.imported': 'Replay imported', 'rs.badfile': 'Import failed: {e}', 'rs.reqwait': 'Requesting replay from host …',
  'rs.reqok': 'Replay received and saved', 'rs.reqnone': 'The host has no replay of this game.', 'rs.reqfail': 'No answer – the replay is stored with the host (Replays menu).',
  'rs.hostnote': 'The host records this game – the replay is stored with the host.',
});

export function createReplayUI(d) {
  // d = { game, rec, show, hideScreens, toast, loadForReplay(data) → Promise<bool>, exitWatch(to) → Promise, volume(),
  //       metaFor(won, text) → {title, over, result, kind}, lobby() → aktuelle Lobby | null, setLoading(text|null) }
  const { game, rec } = d;
  const store = new ReplayStore();
  const marks = new ReplayMarks(game);
  let last = null, lastMode = 'none', driver = null, from = 'title', reqTimer = null, rx = null;
  injectStyle();

  // ---------------- Bildschirm „Wiederholungen“ ----------------
  const scr = document.createElement('div');
  scr.id = 'screen-replays'; scr.className = 'screen hidden';
  scr.innerHTML = `<div class="panel mpanel saves-panel rs-panel">
    <header class="scr-head"><div class="scr-over">${esc(t('rs.over', 'Archiv'))}</div><h2>${esc(t('rs.title', 'Wiederholungen'))}</h2><p id="rs-note" class="note"></p></header>
    <div class="scr-body"><div id="rs-list" class="saves-list"></div></div>
    <footer class="scr-foot"><button id="btn-rs-back">${icon('back')}<span>${esc(t('common.back', 'Zurück'))}</span></button><span class="grow"></span>
      <button id="btn-rs-import">${icon('upload', { cls: 'ic-in' })}<span>${esc(t('rs.import', 'Importieren'))}</span></button>
      <input id="rs-file" type="file" accept=".ssreplay,application/json,application/gzip" hidden></footer></div>`;
  document.body.appendChild(scr);
  $('btn-rs-back').onclick = () => d.show(from === 'replays' ? 'title' : from);
  $('btn-rs-import').onclick = () => $('rs-file').click();
  $('rs-file').addEventListener('change', async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    try { const data = await decodeReplayFile(await f.arrayBuffer()); delete data.meta.id; await store.put(data); d.toast(t('rs.imported', 'Wiederholung importiert')); render(); }
    catch (err) { d.toast(t('rs.badfile', 'Import fehlgeschlagen: {e}', { e: err.message })); }
  });
  $('rs-list').addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const id = b.dataset.id, act = b.dataset.act;
    if (act === 'del') {
      if (!b.dataset.armed) { b.dataset.armed = '1'; b.classList.add('danger'); setTimeout(() => { delete b.dataset.armed; b.classList.remove('danger'); }, 2500); return; }
      await store.del(id); render(); return;
    }
    const data = await store.get(id);
    if (!data) { render(); return; }
    if (act === 'watch') watch(data, 'replays');
    else if (act === 'export') exportFile(data);
  });
  const RES = { win: ['check', 'rs.win', 'Sieg'], loss: ['close', 'rs.loss', 'Niederlage'], draw: ['swap', 'rs.draw', 'Unentschieden'] };
  async function render() {
    $('rs-note').textContent = t('rs.note', 'Die letzten {n} Partien werden automatisch aufbewahrt. Zum dauerhaften Aufheben oder Weitergeben exportieren (.ssreplay).', { n: 10 });
    const list = await store.list();
    if (!list.length) { $('rs-list').innerHTML = `<p class="muted rs-empty">${esc(t('rs.empty', 'Noch keine Wiederholungen – beende eine Mission oder ein Gefecht.'))}</p>`; return; }
    $('rs-list').innerHTML = list.map((m) => {
      const r = RES[m.result] || RES.loss;
      const date = (() => { try { return new Date(m.date).toLocaleString(document.documentElement.lang === 'en' ? 'en-GB' : 'de-DE', { dateStyle: 'short', timeStyle: 'short' }); } catch (e) { return ''; } })();
      return `<div class="save-slot rs-row" data-id="${esc(m.id)}"><div class="rs-res rs-${esc(m.result || 'loss')}">${icon(r[0])}<span>${esc(t(r[1], r[2]))}</span></div>
        <div class="sv-info"><small class="sv-name">${esc(m.over || '')}</small><b>${esc(m.title || '')}</b><span class="muted">${esc(date)} · ${esc(t('rs.dur', 'Dauer'))} ${fmtTime(m.dur || 0)}${m.size ? ` · ${Math.max(1, Math.round(m.size / 1024))} KB` : ''}</span></div>
        <div class="sv-btns"><button class="big" data-act="watch" data-id="${esc(m.id)}">${icon('play', { cls: 'ic-in' })}<span>${esc(t('rs.watch', 'Ansehen'))}</span></button>
        <button data-act="export" data-id="${esc(m.id)}" title="${esc(t('rs.export', 'Exportieren'))}" aria-label="${esc(t('rs.export', 'Exportieren'))}">${icon('download')}</button>
        <button class="ghost" data-act="del" data-id="${esc(m.id)}" title="${esc(t('rs.delete', 'Löschen'))}" aria-label="${esc(t('rs.delete', 'Löschen'))}">${icon('trash')}</button></div></div>`;
    }).join('');
  }
  function open(back) { from = back || 'title'; render(); d.show('replays'); }

  // Hauptmenü: Knopf „Wiederholungen“
  const sub = document.querySelector('#screen-title .mm-sub');
  if (sub && !$('btn-replays')) {
    const b = document.createElement('button');
    b.id = 'btn-replays'; b.className = 'mm-small'; b.title = t('rs.menu', 'Wiederholungen');
    b.innerHTML = `${icon('retry')}<span>${esc(t('rs.menu', 'Wiederholungen'))}</span>`;
    b.onclick = () => open('title');
    const aw = $('btn-awards'); if (aw) sub.insertBefore(b, aw); else sub.appendChild(b);
  }

  // ---------------- Datei-Export ----------------
  async function exportFile(data) {
    try {
      const blob = await encodeReplayFile(data);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = replayFileName(data);
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      return blob;
    } catch (e) { d.toast('Export: ' + e.message); return null; }
  }

  // ---------------- Endbildschirm: Aufzeichnung übernehmen, Knöpfe ----------------
  const endBox = document.createElement('div');
  endBox.id = 'end-replay'; endBox.className = 'end-replay hidden';
  document.querySelector('#screen-end .scr-body')?.appendChild(endBox);
  function renderEnd(mode) {
    lastMode = mode;
    if (mode === 'none') { endBox.classList.add('hidden'); endBox.innerHTML = ''; return; }
    endBox.classList.remove('hidden');
    if (mode === 'remote') {
      endBox.innerHTML = `<button id="btn-rs-request">${icon('download', { cls: 'ic-in' })}<span>${esc(t('rs.end.request', 'Wiederholung vom Host anfordern'))}</span></button><span class="muted rs-endnote" id="rs-endnote"></span>`;
      $('btn-rs-request').onclick = () => requestFromHost();
      return;
    }
    endBox.innerHTML = `<button id="btn-rs-watch"${last ? '' : ' disabled'}>${icon('play', { cls: 'ic-in' })}<span>${esc(t('rs.end.watch', 'Wiederholung ansehen'))}</span></button>
      <button id="btn-rs-save"${last ? '' : ' disabled'}>${icon('download', { cls: 'ic-in' })}<span>${esc(t('rs.end.export', 'Wiederholung speichern'))}</span></button><span class="muted rs-endnote" id="rs-endnote">${last ? esc(t('rs.end.saved', 'Wiederholung gespeichert')) : ''}</span>`;
    $('btn-rs-watch').onclick = () => { if (last) watch(last, 'end'); };
    $('btn-rs-save').onclick = () => { if (last) exportFile(last); };
  }
  game.on('loaded', () => { if (!game.replayDriver) renderEnd('none'); });
  game.on('end', (won, text) => {
    if (game.replayDriver || game.demo) return;
    if (rec.on && rec.ctx && !rec.replaying) {
      last = null;
      renderEnd('ready');
      const meta = { ...(d.metaFor?.(won, text) || {}), kind: rec.ctx.kind };
      // nach dem laufenden Simulationsschritt: Endzustand vollständig (Prüf-Snapshot)
      setTimeout(async () => {
        try {
          last = buildReplay(game, rec, marks, meta);
          const id = await store.put(last);
          if (id) last.meta.id = id;
        } catch (e) { console.warn('[replay] Aufzeichnung', e); }
        if (lastMode === 'ready') renderEnd('ready');
      }, 0);
    } else if (game.net?.isClient) renderEnd('remote');
    else renderEnd('none');
  });

  // ---------------- Online: Wiederholung beim Host anfordern / an Mitspieler senden ----------------
  function attachLobby(L) {
    if (!L || L._rsAttached) return;
    L._rsAttached = true;
    L.on('replayReq', (pid) => {
      if (!L.isHost) return;
      const data = last;
      if (!data) { L.sendEvent({ k: 'rp', none: 1 }, pid); return; }
      const s = JSON.stringify(data), n = Math.max(1, Math.ceil(s.length / CHUNK)), id = String(data.meta?.id || Date.now());
      for (let i = 0; i < n; i++) L.sendEvent({ k: 'rp', id, i, n, d: s.slice(i * CHUNK, (i + 1) * CHUNK) }, pid);
    });
    L.on('event', async (e) => {
      if (!e || e.k !== 'rp' || L.isHost) return;
      if (e.none) { clearTimeout(reqTimer); note(t('rs.reqnone', 'Der Host hat keine Wiederholung dieser Partie.')); return; }
      if (!rx || rx.id !== e.id) rx = { id: e.id, n: e.n, parts: [] };
      rx.parts[e.i] = e.d;
      if (rx.parts.filter((x) => x !== undefined).length < rx.n) { note(`${t('rs.reqwait', 'Wiederholung wird angefordert …')} ${Math.round((rx.parts.filter((x) => x !== undefined).length / rx.n) * 100)} %`); return; }
      clearTimeout(reqTimer);
      try {
        const data = JSON.parse(rx.parts.join('')); rx = null;
        if (!replayValid(data)) throw new Error('Version');
        delete data.meta.id;
        data.meta.over = data.meta.over || '';
        last = data;
        await store.put(data);
        note(t('rs.reqok', 'Wiederholung empfangen und gespeichert'));
        d.toast(t('rs.reqok', 'Wiederholung empfangen und gespeichert'));
      } catch (err) { note('Fehler: ' + err.message); }
    });
  }
  function note(s) { const el = $('rs-endnote'); if (el) el.textContent = s; }
  function requestFromHost() {
    const L = d.lobby?.();
    if (!L || L.isHost || typeof L.requestReplay !== 'function') { note(t('rs.reqfail', 'Keine Antwort – die Wiederholung liegt beim Host (Menü „Wiederholungen“).')); return; }
    attachLobby(L);
    note(t('rs.reqwait', 'Wiederholung wird angefordert …'));
    L.requestReplay();
    clearTimeout(reqTimer);
    reqTimer = setTimeout(() => note(t('rs.reqfail', 'Keine Antwort – die Wiederholung liegt beim Host (Menü „Wiederholungen“).')), 15000);
  }

  // ---------------- Wiedergabe + Steuerleiste ----------------
  const bar = document.createElement('div');
  bar.id = 'rs-bar'; bar.className = 'rs-bar hidden';
  bar.innerHTML = `<div class="rs-row1">
      <button id="rs-play" class="rs-ic" aria-label="Pause">${icon('pause')}</button>
      <div class="seg rs-speed" id="rs-speed">${SPEEDS.map((s) => `<button data-v="${s}">${String(s).replace('.', ',')}×</button>`).join('')}</div>
      <span id="rs-time" class="rs-time">0:00 / 0:00</span>
      <span class="grow"></span>
      <label class="rs-lbl"><span>${esc(t('rs.view', 'Sicht'))}</span><select id="rs-view"><option value="auto">${esc(t('rs.view.auto', 'Aufnahme'))}</option><option value="UA">Ukraine</option><option value="RU">Russland</option><option value="all">${esc(t('rs.view.all', 'Alles aufgedeckt'))}</option></select></label>
      <label class="rs-lbl"><span>${esc(t('rs.follow', 'Folgen'))}</span><select id="rs-follow"></select></label>
      <button id="rs-exit" class="rs-ic" title="${esc(t('rs.exit', 'Wiedergabe beenden'))}" aria-label="${esc(t('rs.exit', 'Wiedergabe beenden'))}">${icon('close')}</button>
    </div>
    <div id="rs-tl" class="rs-tl" role="slider" aria-label="Zeitleiste" tabindex="0"><div id="rs-tl-fill" class="rs-fill"></div><div id="rs-tl-marks" class="rs-marks"></div><div id="rs-tl-head" class="rs-head"></div></div>
    <div id="rs-msg" class="rs-msg hidden"></div>`;
  document.body.appendChild(bar);
  $('rs-play').onclick = () => togglePause();
  $('rs-speed').addEventListener('click', (e) => { const b = e.target.closest('button[data-v]'); if (b && driver) { driver.speed = +b.dataset.v; updateBar(); } });
  $('rs-view').addEventListener('change', () => driver?.setView($('rs-view').value));
  $('rs-follow').addEventListener('change', () => { const v = $('rs-follow').value; driver?.setFollow(v === '' ? null : (isNaN(+v) ? v : +v)); });
  $('rs-exit').onclick = () => exit();
  $('rs-tl').addEventListener('click', (e) => {
    if (!driver || driver.busy) return;
    const r = $('rs-tl').getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    seek(f * driver.duration);
  });
  $('rs-tl').addEventListener('keydown', (e) => {
    if (!driver || driver.busy) return;
    if (e.key === 'ArrowRight') { seek(game.time + 15); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { seek(game.time - 15); e.preventDefault(); }
  });
  for (const ev of ['keydown', 'keyup', 'pointerdown', 'wheel']) bar.addEventListener(ev, (e) => e.stopPropagation());

  function buildTimeline() {
    const m = driver.data.marks || [], D = Math.max(1, driver.duration);
    $('rs-tl-marks').innerHTML = m.map((x) => {
      const p = Math.min(100, (x[0] / D) * 100).toFixed(2);
      if (x[1] === 'k') return `<i class="rs-mk k ${x[2] === 'RU' ? 'ru' : 'ua'}${x[3] ? ' veh' : ''}" style="left:${p}%" title="${fmtTime(x[0])} – Verlust ${x[2]}"></i>`;
      if (x[1] === 'o') return `<i class="rs-mk o ${x[2]}" style="left:${p}%" title="${fmtTime(x[0])} – ${esc(x[3])}"></i>`;
      return '';
    }).join('');
    const sel = $('rs-follow'), pl = game.players.filter((p) => !p.spectator);
    sel.innerHTML = `<option value="">${esc(t('rs.follow.free', 'Freie Kamera'))}</option>` + pl.map((p) => `<option value="${esc(p.id)}">${esc(p.name)} (${p.team})</option>`).join('');
    sel.value = driver.follow == null ? '' : String(driver.follow);
    $('rs-view').value = driver.view;
  }
  function updateBar() {
    if (!driver) return;
    const D = Math.max(0.001, driver.duration), tt = Math.min(game.time, D);
    $('rs-time').textContent = `${fmtTime(tt)} / ${fmtTime(D)}`;
    const p = ((tt / D) * 100).toFixed(2) + '%';
    $('rs-tl-fill').style.width = p; $('rs-tl-head').style.left = p;
    $('rs-play').innerHTML = driver.paused || driver.atEnd ? icon('play') : icon('pause');
    $('rs-play').setAttribute('aria-label', driver.paused ? 'Play' : 'Pause');
    $('rs-speed').querySelectorAll('button').forEach((b) => b.classList.toggle('active', +b.dataset.v === driver.speed));
    try { game.audio?.setVolume?.(driver.speed > 2 || driver.busy ? 0 : d.volume()); } catch (e) { /* */ }
  }
  setInterval(() => { if (driver && !bar.classList.contains('hidden')) updateBar(); }, 200);
  function msg(text) { const el = $('rs-msg'); el.textContent = text || ''; el.classList.toggle('hidden', !text); }

  async function watch(data, back = 'replays') {
    if (driver) await exit(false);
    from = back;
    driver = new ReplayDriver(game, rec, data, {
      load: (dd) => d.loadForReplay(dd),
      volume: () => d.volume(),
      onProgress: (f, kind) => { if (kind === 'done') d.setLoading(null); else d.setLoading(t('rs.seek', 'Neu-Simulation … {p} %', { p: Math.round(f * 100) })); },
      onDone: () => { d.setLoading(null); updateBar(); },
      onEnd: () => { msg(t('rs.ended', 'Ende der Wiederholung')); updateBar(); },
    });
    window.__replayDriver = driver;
    document.body.classList.add('rs-watch');
    msg('');
    const ok = await driver.start();
    if (!ok) { document.body.classList.remove('rs-watch'); driver = null; d.toast('Wiederholung konnte nicht geladen werden.'); d.show(from === 'end' ? 'title' : 'replays'); return false; }
    buildTimeline();
    bar.classList.remove('hidden');
    updateBar();
    return true;
  }
  async function seek(time) {
    if (!driver || driver.busy) return false;
    msg('');
    const ok = await driver.seekTime(Math.max(0, Math.min(driver.duration, time)));
    d.setLoading(null);
    updateBar();
    if (driver.atEnd) msg(t('rs.ended', 'Ende der Wiederholung'));
    return ok;
  }
  function togglePause() { if (!driver) return; if (driver.atEnd) { driver.paused = false; return; } driver.paused = !driver.paused; updateBar(); }
  async function exit(toMenu = true) {
    const dr = driver;
    if (!dr) return;
    driver = null; window.__replayDriver = null;
    dr.stop();
    bar.classList.add('hidden'); msg('');
    document.body.classList.remove('rs-watch');
    try { game.audio?.setVolume?.(d.volume()); } catch (e) { /* */ }
    if (toMenu) await d.exitWatch(from === 'end' ? 'title' : 'replays');
    if (toMenu && from !== 'end') render();
  }

  return {
    open, render, watch, seek, exit, togglePause, attachLobby, exportFile, store, marks,
    get driver() { return driver; }, get last() { return last; }, set last(v) { last = v; },
    encode: encodeReplayFile, decode: decodeReplayFile,
  };
}

function injectStyle() {
  if (document.getElementById('rs-style')) return;
  const st = document.createElement('style');
  st.id = 'rs-style';
  st.textContent = `
/* ============ V3-RS: Wiederholungen, Zuschauer, Koop ============ */
.rs-row { grid-template-columns: 108px minmax(0, 1fr) auto; }
.rs-res { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; height: 64px; border: 1px solid var(--m-line); background: rgba(0,0,0,.3); font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
.rs-res .ic { width: 22px; height: 22px; }
.rs-res.rs-win { color: #8be28b; } .rs-res.rs-loss { color: #ff8f86; } .rs-res.rs-draw { color: #d8d2b8; }
.rs-empty { padding: 18px 4px; }
.end-replay { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 12px; }
.end-replay button { min-height: 44px; display: inline-flex; align-items: center; gap: 6px; }
.rs-endnote { font-size: 12.5px; }
body.rs-watch #orders, body.rs-watch #abilities, body.rs-watch #buildbar, body.rs-watch #btn-chat, body.rs-watch #net-chat { display: none !important; }
body.spectating #orders, body.spectating #abilities, body.spectating #buildbar { display: none !important; }
.rs-bar { position: fixed; left: 50%; transform: translateX(-50%); top: calc(54px + env(safe-area-inset-top, 0px)); z-index: 40; width: min(820px, calc(100vw - 16px)); box-sizing: border-box;
  background: rgba(14, 17, 14, .88); border: 1px solid rgba(214,200,160,.28); padding: 6px 8px 8px; color: #e8e4d4; font-size: 13px; backdrop-filter: blur(3px); }
.rs-bar.hidden { display: none; }
.rs-row1 { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.rs-row1 .grow { flex: 1; }
.rs-ic { min-width: 40px; min-height: 40px; display: inline-flex; align-items: center; justify-content: center; padding: 0 8px; }
.rs-speed button { min-height: 40px; min-width: 44px; padding: 0 6px; }
.rs-time { font-variant-numeric: tabular-nums; min-width: 92px; text-align: center; }
.rs-lbl { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: #bdb7a0; }
.rs-lbl select { min-height: 40px; max-width: 150px; }
.rs-tl { position: relative; height: 22px; margin-top: 6px; background: rgba(255,255,255,.08); border: 1px solid rgba(214,200,160,.25); cursor: pointer; }
.rs-fill { position: absolute; left: 0; top: 0; bottom: 0; background: rgba(255, 213, 0, .22); pointer-events: none; }
.rs-head { position: absolute; top: -3px; bottom: -3px; width: 2px; margin-left: -1px; background: #ffd500; pointer-events: none; }
.rs-marks { position: absolute; inset: 0; pointer-events: none; }
.rs-mk { position: absolute; width: 2px; margin-left: -1px; }
.rs-mk.k { bottom: 0; height: 45%; opacity: .75; } .rs-mk.k.veh { height: 70%; width: 3px; }
.rs-mk.k.ua { background: #4ea3ff; } .rs-mk.k.ru { background: #ff5a55; }
.rs-mk.o { top: 0; height: 100%; width: 4px; margin-left: -2px; background: #ffd500; } .rs-mk.o.failed { background: #ff8f86; }
.rs-msg { margin-top: 6px; text-align: center; color: #ffd500; font-weight: 600; }
.rs-msg.hidden { display: none; }
@media (max-width: 640px) { .rs-lbl span { display: none; } .rs-lbl select { max-width: 112px; } .rs-time { min-width: 0; } }
/* Zuschauer */
.spec-panel { position: fixed; right: 8px; top: calc(54px + env(safe-area-inset-top, 0px)); z-index: 38; width: min(300px, calc(100vw - 16px)); box-sizing: border-box; background: rgba(14,17,14,.86);
  border: 1px solid rgba(214,200,160,.28); padding: 8px; color: #e8e4d4; font-size: 12.5px; }
.spec-panel.hidden { display: none; }
.spec-panel h4 { margin: 0 0 6px; font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: #ffd500; display: flex; justify-content: space-between; align-items: center; }
.spec-panel .seg button { min-height: 36px; padding: 0 8px; font-size: 12px; }
.spec-panel select { width: 100%; min-height: 36px; margin-top: 6px; }
.spec-panel table { width: 100%; border-collapse: collapse; margin-top: 6px; }
.spec-panel td { padding: 2px 3px; } .spec-panel td.n { text-align: right; font-variant-numeric: tabular-nums; }
.spec-panel tr.team td { padding-top: 6px; font-weight: 700; }
.spec-panel .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; }
.spec-panel .spec-min { min-width: 32px; min-height: 32px; padding: 0 6px; }
.spec-panel.min .spec-body { display: none; }
.lobby-specs { margin-top: 8px; padding: 8px; border: 1px solid var(--m-line, rgba(214,200,160,.15)); background: rgba(0,0,0,.22); font-size: 13px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.lobby-specs .spec-names { flex: 1; min-width: 160px; color: var(--m-text-2, #cfc9b4); }
.lobby-specs button { min-height: 40px; }
.lobby-coop { margin: 0 0 10px; padding: 10px; border: 1px solid rgba(255,213,0,.35); background: rgba(255,213,0,.06); font-size: 13px; }
.lobby-coop b { color: #ffd500; }
#screen-lobby.coop .lobby-settings, #screen-lobby.coop #lobby-team-RU, #screen-lobby.coop #btn-lobby-team, #screen-lobby.coop #lobby-role-desc { display: none !important; }
.brief-coop { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; }
`;
  document.head.appendChild(st);
}
