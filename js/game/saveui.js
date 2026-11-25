// Spielstände – Bildschirm „Speichern/Laden“, Schnellspeichern (F5) / Schnellladen (F9), Autosave (V3-X).
// Abhängigkeiten kommen aus main.js (Menüfunktionen), die Spiellogik aus savegame.js.
import { icon } from './icons.js';
import { listSaves, readSave, writeSave, deleteSave, AUTOSAVE_EVERY } from './savegame.js';
import { levelOf } from './difficulty.js';
import { fmtTime } from '../engine/util.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SLOT_NAMES = { 1: 'Platz 1', 2: 'Platz 2', 3: 'Platz 3', quick: 'Schnellspeicher (F5)', auto: 'Autosave' };

export function createSaveUI(d) {
  // d = { game, rec, show, hideScreens, current(), isOnline(), inMission(), saveMeta(), startFromSave(data), onLoaded(report), toast(text) }
  const { game, rec } = d;
  let mode = 'load', from = 'title', busy = false;

  function thumbnail() {
    const W = 192, H = 108;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    try {
      const gr = game.gr;
      gr.render(1 / 60);
      const src = gr.renderer.domElement;
      const sw = src.width, sh = src.height, k = Math.max(W / sw, H / sh);
      ctx.drawImage(src, (W - sw * k) / 2, (H - sh * k) / 2, sw * k, sh * k);
      const px = ctx.getImageData(W / 2, H / 2, 1, 1).data;
      if (px[3] === 0 || px[0] + px[1] + px[2] < 3) throw new Error('leer');
    } catch (e) {
      // Ersatz: Minikarte mit Einheitenpunkten
      ctx.fillStyle = '#2b3324'; ctx.fillRect(0, 0, W, H);
      const t = game.terrain;
      if (t) {
        try { const img = t._mmThumb || (t._mmThumb = t.minimapImage(128)); ctx.drawImage(img, (W - H) / 2, 0, H, H); } catch (e2) { /* */ }
        for (const u of game.units) {
          if (!u.alive || u.side === 'N' || (u.side !== game.localSide && !u.seenBy?.[game.localSide])) continue;
          const x = (W - H) / 2 + ((u.pos.x + t.half) / t.size) * H, y = ((u.pos.z + t.half) / t.size) * H;
          ctx.fillStyle = u.side === game.localSide ? '#5dff8a' : '#ff4d4d'; ctx.fillRect(x - 1, y - 1, 2.5, 2.5);
        }
      }
    }
    try { return c.toDataURL('image/jpeg', 0.62); } catch (e) { return ''; }
  }

  function save(slot, { silent = false } = {}) {
    if (d.isOnline()) { if (!silent) d.toast('Im Online-Spiel kann nicht gespeichert werden.'); return false; }
    if (!rec.canSave() || !rec.ctx) { if (!silent) d.toast('Speichern ist hier nicht möglich.'); return false; }
    const data = rec.serialize();
    data.meta = { ...d.saveMeta(), date: new Date().toISOString(), t: Math.round(game.time), diff: data.diff, thumb: thumbnail(), kind: data.ctx.kind };
    try {
      writeSave(slot, data);
      if (slot === 'auto') rec.lastAuto = game.time;
      if (!silent) d.toast(`Gespeichert: ${SLOT_NAMES[slot] || slot}`);
      return true;
    } catch (e) {
      console.warn('[savegame] Speichern fehlgeschlagen', e);
      d.toast('Speichern fehlgeschlagen – Browserspeicher voll?');
      return false;
    }
  }

  async function load(slot) {
    if (busy) return null;
    if (d.isOnline()) { d.toast('Im Online-Spiel kann nicht geladen werden.'); return null; }
    const data = readSave(slot);
    if (!data || !data.ctx) { d.toast('Kein Spielstand in diesem Platz.'); return null; }
    busy = true;
    const ld = $('loading'), lt = $('loading-text');
    try {
      const ok = await d.startFromSave(data);
      if (!ok) { d.toast('Spielstand passt zu keiner bekannten Mission.'); return null; }
      lt.textContent = 'Spielstand wird geladen … 0 %';
      ld.classList.remove('hidden');
      game.paused = true;
      const rep = await rec.replay(data, (f) => { lt.textContent = `Spielstand wird geladen … ${Math.round(f * 100)} %`; });
      ld.classList.add('hidden');
      d.onLoaded(rep, data);
      return rep;
    } catch (e) {
      console.warn('[savegame] Laden fehlgeschlagen', e);
      ld.classList.add('hidden');
      d.toast('Laden fehlgeschlagen: ' + e.message);
      return null;
    } finally { busy = false; }
  }

  function render() {
    const idx = listSaves(), online = d.isOnline(), can = rec.canSave() && !!rec.ctx && !online;
    $('saves-title').textContent = mode === 'save' ? 'Spiel speichern' : 'Spielstand laden';
    $('saves-over').textContent = mode === 'save' ? (game.mission?.title || 'Einsatz') : 'Spielstände';
    const note = $('saves-note');
    note.textContent = online ? 'Im Online-Spiel ist Speichern/Laden deaktiviert.' : mode === 'save' && !can ? 'In diesem Spielmodus kann nicht gespeichert werden (nur Kampagne und Gefecht).' : 'F5 Schnellspeichern · F9 Schnellladen · Autosave beim Missionsstart und alle 5 Minuten';
    const slots = mode === 'save' ? ['1', '2', '3'] : ['quick', 'auto', '1', '2', '3'];
    $('saves-list').innerHTML = slots.map((s) => {
      const m = idx[s];
      const info = m ? `<b>${esc(m.title || 'Einsatz')}</b><span>${esc(m.over || '')}</span><span class="muted">${new Date(m.date).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })} · Spielzeit ${fmtTime(m.t || 0)}${m.diff ? ' · ' + esc(levelOf(m.diff).name) : ''}</span>` : '<span class="muted">– leer –</span>';
      const thumb = m?.thumb ? `<img src="${m.thumb}" alt="">` : `<div class="noimg">${icon('save')}</div>`;
      const btns = mode === 'save'
        ? `<button class="sv-do" data-slot="${s}" ${can ? '' : 'disabled'}>${icon('save', { cls: 'ic-in' })}<span>${m ? 'Überschreiben' : 'Speichern'}</span></button>`
        : `<button class="sv-do big" data-slot="${s}" ${m && !online ? '' : 'disabled'}>${icon('load', { cls: 'ic-in' })}<span>Laden</span></button>`;
      const del = m ? `<button class="sv-del ghost" data-slot="${s}" title="Löschen" aria-label="Spielstand löschen">${icon('trash')}</button>` : '';
      return `<div class="save-slot${m ? '' : ' empty'}" data-slot="${s}"><div class="sv-thumb">${thumb}</div><div class="sv-info"><small class="sv-name">${SLOT_NAMES[s]}</small>${info}</div><div class="sv-btns">${btns}${del}</div></div>`;
    }).join('');
  }
  function open(m, back) { mode = m; from = back || d.current() || 'title'; render(); d.show('saves'); }

  $('saves-list').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    const s = b.dataset.slot;
    if (b.classList.contains('sv-del')) {
      if (b.dataset.armed) { deleteSave(s); render(); return; }
      b.dataset.armed = '1'; b.classList.add('danger'); b.title = 'Nochmals tippen zum Löschen'; setTimeout(() => { delete b.dataset.armed; b.classList.remove('danger'); }, 2500);
      return;
    }
    if (mode === 'save') {
      const exists = !!listSaves()[s];
      if (exists && !b.dataset.armed) { b.dataset.armed = '1'; b.querySelector('span').textContent = 'Wirklich überschreiben?'; setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; render(); } }, 3000); return; }
      if (save(s)) { render(); }
    } else load(s);
  });
  $('btn-saves-back').addEventListener('click', () => d.show(from === 'saves' ? 'title' : from));

  // Tastatur: F5 Schnellspeichern, F9 Schnellladen (im Einsatz, offline)
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'F5' && e.key !== 'F9') return;
    if (!d.inMission() || e.target?.tagName === 'INPUT') return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.key === 'F5') save('quick');
    else if (listSaves().quick) load('quick');
    else d.toast('Kein Schnellspeicherstand vorhanden.');
  }, true);

  // Autosave (aus der Spielschleife)
  function tick() {
    if (busy || !d.inMission() || d.isOnline() || game.paused || !rec.canSave() || !rec.ctx) return;
    if (game.time - (rec.lastAuto || 0) >= AUTOSAVE_EVERY) save('auto', { silent: true });
  }
  return { open, save, load, render, tick, thumbnail, get busy() { return busy; } };
}
