// Bildschirm „Mods & eigene Karten": Mods laden (Datei/Einfügen), an-/abschalten, löschen; eigene Karten als Mission
// oder Gefecht starten bzw. im Editor öffnen. Alle Texte aus Mods werden escaped (escapeHtml) bzw. per textContent gesetzt.
import { icon } from '../game/icons.js';
import { escapeHtml, mapCapabilities, exportMap } from './format.js';
import { listMods, installMod, setModEnabled, removeMod, listCustomMaps, UNIT_FIELDS, WEAPON_FIELDS } from './mods.js';
import { EXAMPLE_MOD } from './example_mod.js';
import { UNIT_TYPES, W } from '../game/unitTypes.js';

export function createModsUI(ctx) {
  const $ = (id) => document.getElementById(id);
  const root = $('screen-mods');
  if (!root) return { render() {} };
  root.addEventListener('keydown', (e) => { if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) e.stopPropagation(); });
  const msg = (lines, ok = true) => {
    const el = $('mods-msg');
    el.className = 'ed-msg ' + (ok ? 'ok' : 'warn');
    el.innerHTML = (Array.isArray(lines) ? lines : [lines]).slice(0, 12).map((l) => `<div>${escapeHtml(l)}</div>`).join('');
  };
  function load(text, label) {
    const r = installMod(text);
    if (!r.ok) { msg([`${label}: abgewiesen.`, ...r.errors], false); return r; }
    const m = r.mod;
    msg([`Mod „${m.name}" ${r.replaced ? 'aktualisiert' : 'installiert'} und aktiviert: ${m.maps.length} Karte(n), ${Object.keys(m.units).length} Einheiten- und ${Object.keys(m.weapons).length} Waffen-Anpassung(en).`, ...r.warnings.slice(0, 8), r.warnings.length > 8 ? `… ${r.warnings.length - 8} weitere Hinweise` : ''].filter(Boolean), true);
    render();
    return r;
  }
  $('mods-load').onclick = () => { const t = $('mods-paste').value.trim(); if (!t) { msg('Bitte Mod-JSON einfügen oder eine Datei wählen.', false); return; } load(t, 'Eingefügter Mod'); };
  $('mods-example').onclick = () => load(JSON.stringify(EXAMPLE_MOD), 'Beispiel-Mod');
  $('mods-file').onchange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { msg('Datei zu groß (max. 2 MB).', false); return; }
    const rd = new FileReader();
    rd.onload = () => { load(String(rd.result || ''), f.name); e.target.value = ''; };
    rd.onerror = () => msg('Datei konnte nicht gelesen werden.', false);
    rd.readAsText(f);
  };
  $('mods-editor').onclick = () => ctx.openEditor(null);

  function render() {
    const maps = listCustomMaps();
    $('mods-maps').innerHTML = maps.length ? maps.map((m, i) => {
      const cap = mapCapabilities(m.doc);
      return `<div class="mod-card"><div class="mc-main"><b>${escapeHtml(m.title)}</b><br><span class="muted">${escapeHtml(m.source)}${m.author ? ' · ' + escapeHtml(m.author) : ''} · ${m.doc.map.size} m · ${m.doc.units.length} Einheiten · ${m.doc.points.length} Punkte</span></div>
        <div class="mc-btns"><button data-mission="${i}" ${cap.mission ? '' : 'disabled title="Keine Einheiten für beide Teams"'}>${icon('flag')} Mission</button><button data-sk="${i}" ${cap.skirmish ? '' : 'disabled title="Startzonen für beide Teams und Eroberungspunkte nötig"'}>${icon('tank')} Gefecht</button><button data-edit="${i}">${icon('editor')} Editor</button></div></div>`;
    }).join('') : '<p class="muted">Noch keine eigenen Karten – im Editor speichern oder einen Mod mit Karten laden.</p>';
    $('mods-maps').querySelectorAll('[data-mission]').forEach((b) => (b.onclick = () => ctx.playAsMission(maps[+b.dataset.mission])));
    $('mods-maps').querySelectorAll('[data-sk]').forEach((b) => (b.onclick = () => ctx.playAsSkirmish(maps[+b.dataset.sk])));
    $('mods-maps').querySelectorAll('[data-edit]').forEach((b) => (b.onclick = () => ctx.openEditor(JSON.parse(exportMap(maps[+b.dataset.edit].doc)))));
    const mods = listMods();
    $('mods-list').innerHTML = mods.length ? mods.map((m) => {
      const ch = [
        ...Object.entries(m.units).map(([k, v]) => `${UNIT_TYPES[k]?.name || k}: ${Object.entries(v).map(([f, x]) => `${f} ${x}`).join(', ')}`),
        ...Object.entries(m.weapons).map(([k, v]) => `${W[k]?.name || k}: ${Object.entries(v).map(([f, x]) => `${f} ${x}`).join(', ')}`),
      ];
      return `<div class="mod-card${m.enabled ? '' : ' off'}"><div class="mc-main"><b>${escapeHtml(m.name)}</b>${m.version ? ` <span class="muted">v${escapeHtml(m.version)}</span>` : ''}${m.author ? ` <span class="muted">· ${escapeHtml(m.author)}</span>` : ''}<br>
        <span class="muted">${escapeHtml(m.description)}</span><br><span class="muted">${m.maps.length} Karte(n)${ch.length ? ' · ' + escapeHtml(ch.join(' · ')) : ''}</span></div>
        <div class="mc-btns"><label class="check"><input type="checkbox" data-toggle="${escapeHtml(m.id)}"${m.enabled ? ' checked' : ''}> aktiv</label><button data-remove="${escapeHtml(m.id)}" title="Mod entfernen">${icon('trash')}</button></div></div>`;
    }).join('') : '<p class="muted">Keine Mods installiert.</p>';
    $('mods-list').querySelectorAll('[data-toggle]').forEach((c) => (c.onchange = () => { setModEnabled(c.dataset.toggle, c.checked); render(); }));
    $('mods-list').querySelectorAll('[data-remove]').forEach((b) => (b.onclick = () => {
      if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Sicher?'; setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.innerHTML = icon('trash'); } }, 5000); return; }
      removeMod(b.dataset.remove); render(); msg('Mod entfernt.');
    }));
    $('mods-fields').textContent = `Einheiten: ${Object.keys(UNIT_FIELDS).join(', ')} · Waffen: ${Object.keys(WEAPON_FIELDS).join(', ')}`;
  }
  return { render, load };
}
