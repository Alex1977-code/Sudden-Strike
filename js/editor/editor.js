// Karteneditor (V3-E): lädt eine Karte in die normale 3D-Ansicht (Game/Renderer, Nebel aus, Simulation pausiert)
// und bearbeitet das Datenmodell aus js/editor/format.js. Nach jeder Änderung wird das Gelände (debounced) neu gebaut
// bzw. werden nur Einheiten/Punkte neu gesetzt. Zeichnung der Elemente auf einer 2D-Überlagerung (projiziert).
//
// Bedienung PC: Linksklick = Werkzeug (Punkte setzen/platzieren/auswählen), Linke Maus ziehen = Element/Ecke verschieben
// (Auswahl) bzw. Kamera schieben, Rechte Maus ziehen = Kamera, Mittlere Maus = Drehen, Mausrad = Zoom, WASD/QE.
// Tasten: Strg+Z / Strg+Y, Entf = Löschen, Enter = Fertig, Esc = Abbrechen, R = drehen.
// Touch: Werkzeug wählen, Tippen setzt Punkte/platziert, ein Finger ziehen = Kamera (oder Ziehen des gewählten
// Elements), zwei Finger = Zoom/Drehen, „Fertig" schließt Linien/Flächen.
import * as THREE from 'three';
import { icon, iconForUnitType } from '../game/icons.js';
import { UNIT_TYPES } from '../game/unitTypes.js';
import { BUILDING_SETS } from '../game/buildingKinds.js';
import {
  newMap, sanitizeMap, exportMap, mapCapabilities, escapeHtml, MAP_SIZE_OPTIONS, SEASONS, ERAS, ERA_SET, CROPS, FOREST_KINDS,
  ROAD_KINDS, CP_KINDS, CP_DEFAULT_R, AI_MODES, OBJECTIVE_KINDS, SET_NAMES, KIND_NAMES, ALL_BUILDING_KINDS, buildingDims,
  unitPalette, eraFactions, FACTION_NAMES, SETTLEMENT_STYLES,
} from './format.js';
import { compilePreview, compileMission, objectiveText } from './compile.js';
import { listSlots, loadSlot, saveSlot, deleteSlot, autosave, loadAutosave } from './storage.js';

const TOOLS = [
  { id: 'select', name: 'Auswahl', ic: 'cursor', hint: 'Element antippen/anklicken zum Auswählen, ziehen zum Verschieben. Ecken (weiße Quadrate) einzeln ziehen.' },
  { id: 'hill', name: 'Hügel', ic: 'ed_hill', kind: 'stamp', hint: 'Klicken/Tippen setzt einen Hügel (Radius/Höhe rechts).' },
  { id: 'dip', name: 'Senke', ic: 'ed_dip', kind: 'stamp', hint: 'Klicken/Tippen setzt eine Senke.' },
  { id: 'flat', name: 'Ebnen', ic: 'ed_flat', kind: 'stamp', hint: 'Klicken/Tippen ebnet das Gelände auf die dortige Höhe ein.' },
  { id: 'water', name: 'Wasser', ic: 'water', kind: 'poly', hint: 'Eckpunkte des Sees setzen, dann „Fertig".' },
  { id: 'river', name: 'Fluss', ic: 'river', kind: 'line', hint: 'Punkte entlang des Flusslaufs setzen, dann „Fertig".' },
  { id: 'road', name: 'Straße', ic: 'road', kind: 'line', hint: 'Punkte entlang der Straße setzen, dann „Fertig".' },
  { id: 'track', name: 'Feldweg', ic: 'track', kind: 'line', hint: 'Punkte entlang des Feldwegs setzen, dann „Fertig".' },
  { id: 'rail', name: 'Bahn', ic: 'rail', kind: 'line', hint: 'Punkte entlang der Bahnlinie setzen, dann „Fertig".' },
  { id: 'forest', name: 'Wald', ic: 'forest', kind: 'poly', hint: 'Waldfläche als Polygon zeichnen (oder rechts „Kreis" wählen und tippen).' },
  { id: 'treeline', name: 'Baumreihe', ic: 'treeline', kind: 'line', hint: 'Punkte der Baumreihe setzen, dann „Fertig".' },
  { id: 'field', name: 'Feld', ic: 'field', kind: 'poly', hint: 'Eckpunkte des Feldes setzen, dann „Fertig".' },
  { id: 'village', name: 'Siedlung', ic: 'village', kind: 'stamp', hint: 'Klicken/Tippen setzt eine Siedlung (Gebäude-Set rechts).' },
  { id: 'building', name: 'Gebäude', ic: 'house', kind: 'stamp', hint: 'Klicken/Tippen setzt ein Einzelgebäude (Art rechts, R = drehen).' },
  { id: 'bridge', name: 'Brücke', ic: 'bridge', kind: 'line2', hint: 'Zwei Punkte auf beiden Ufern setzen.' },
  { id: 'ford', name: 'Furt', ic: 'ford', kind: 'line2', hint: 'Zwei Punkte auf beiden Ufern setzen.' },
  { id: 'unit', name: 'Einheiten', ic: 'tank', kind: 'stamp', hint: 'Typ rechts wählen, dann klicken/tippen zum Platzieren.' },
  { id: 'point', name: 'Punkte', ic: 'flag', kind: 'stamp', hint: 'Eroberungspunkt platzieren (Art rechts).' },
  { id: 'zone', name: 'Startzone', ic: 'zone', kind: 'stamp', hint: 'Startzone eines Teams platzieren (Gefecht: Aufmarschraum).' },
  { id: 'hold', name: 'Zielgebiet', ic: 'obj_target', kind: 'stamp', hint: 'Gebiet für das Ziel „Gebiet halten" platzieren.' },
];
const TOOL = Object.fromEntries(TOOLS.map((t) => [t.id, t]));
const COLORS = {
  road: '#d9d4c8', track: '#a8865a', rail: '#2b2b2b', river: '#3d8de0', water: 'rgba(61,141,224,.35)', waterLine: '#3d8de0',
  forest: 'rgba(40,120,50,.32)', forestLine: '#2e9a48', treeline: '#3fae55', field: 'rgba(230,200,80,.22)', fieldLine: '#e6c850',
  village: '#ff9a3c', building: '#ffb36b', hill: '#c79a5a', dip: '#7aa6c9', flat: '#b0b0b0', bridge: '#f2f2f2', ford: '#8fd3ff',
  UA: '#4da3ff', RU: '#ff5a5a', point: '#d8dce2', hold: '#5db8ff', sel: '#ffd500',
};
const deg = (h) => Math.round((((Math.PI - h) * 180) / Math.PI % 360 + 360) % 360); // Bogenmaß (Spiel) → Kompass (0 = Nord)
const rad = (a) => Math.round((Math.PI - (a * Math.PI) / 180) * 100) / 100;
const r1 = (v) => Math.round(v * 10) / 10;
const isTyping = () => { const a = document.activeElement; return !!a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== 'checkbox' && a.type !== 'range' && a.type !== 'button'; };

export function createEditor(ctx) {
  const { game, gr, input } = ctx;
  const E = {
    active: false, doc: null, tool: 'select', sel: null, draw: null, undo: [], redo: [],
    keys: { t: '', u: '' }, objs: { units: new Map(), points: new Map() }, status: '', rebuildT: null, saveT: null,
    opts: {
      hill: { r: 30, h: 6 }, dip: { r: 26, h: -4 }, flat: { r: 26 },
      water: { depth: 5 }, river: { width: 14, depth: 3 }, road: { width: 7 }, track: { width: 4 }, rail: { width: 4 },
      forest: { shape: 'poly', r: 24, kind: 'mixed', density: 0.05 }, treeline: {}, field: { crop: 'wheat', angle: 0 },
      village: { r: 30, houses: 10, set: null, urban: false, style: 'simple' }, building: { kind: 'cottage', rot: 0 },
      bridge: { width: 7 }, ford: { width: 8 },
      unit: { type: 'leopard', team: 'UA', heading: null, ai: 'guard', target: false, era: null, faction: 'all', q: '' },
      point: { kind: 'zeppelin' }, zone: { team: 'UA', r: 22 }, hold: { r: 25, minutes: 3 },
    },
    stats: { rebuilds: 0, lastRebuildMs: 0 },
  };
  let root, overlay, octx, ui = {};

  // ================= DOM =================
  function build() {
    root = document.createElement('div');
    root.id = 'editor';
    root.className = 'hidden';
    root.innerHTML = `
      <canvas id="ed-overlay"></canvas>
      <div id="ed-top">
        <button id="ed-exit" class="icon-btn" title="Editor verlassen">${icon('close')}</button>
        <input id="ed-title" maxlength="80" spellcheck="false" aria-label="Kartentitel">
        <span class="grow"></span>
        <button id="ed-undo" class="icon-btn" title="Rückgängig (Strg+Z)">${icon('undo')}</button>
        <button id="ed-redo" class="icon-btn" title="Wiederholen (Strg+Y)">${icon('redo')}</button>
        <button id="ed-btn-map" title="Karteneinstellungen">${icon('globe')}<span>Karte</span></button>
        <button id="ed-btn-mission" title="Ziele und Briefing">${icon('obj_target')}<span>Mission</span></button>
        <button id="ed-btn-file" title="Speichern, Laden, Export, Import">${icon('save')}<span>Datei</span></button>
        <button id="ed-play" class="big" title="Karte testspielen">${icon('play')}<span>Testen</span></button>
      </div>
      <div id="ed-tools">${TOOLS.map((t) => `<button data-tool="${t.id}" title="${t.name}">${icon(t.ic)}<span>${t.name}</span></button>`).join('')}</div>
      <div id="ed-panel"><button id="ed-panel-toggle" class="icon-btn" title="Eigenschaften ein-/ausblenden">${icon('menu')}</button><div id="ed-panel-body"></div></div>
      <div id="ed-hint"><span id="ed-hint-text"></span><span class="ed-hint-btns"><button id="ed-back">Punkt zurück</button><button id="ed-cancel">Abbrechen</button><button id="ed-done" class="big">Fertig</button></span></div>
      <div id="ed-status" class="hidden"></div>
      <div id="ed-modal" class="screen hidden"><div class="panel wide" id="ed-modal-panel"></div></div>`;
    document.body.appendChild(root);
    const q = (id) => root.querySelector('#' + id);
    ui = { title: q('ed-title'), tools: q('ed-tools'), panel: q('ed-panel'), body: q('ed-panel-body'), hint: q('ed-hint'), hintText: q('ed-hint-text'), status: q('ed-status'), modal: q('ed-modal'), modalPanel: q('ed-modal-panel') };
    overlay = q('ed-overlay');
    octx = overlay.getContext('2d');
    // Texteingaben: Tastendrücke nicht an die Spielsteuerung weitergeben (Leertaste, WASD …)
    root.addEventListener('keydown', (e) => { if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) e.stopPropagation(); });
    q('ed-exit').onclick = () => exit();
    q('ed-undo').onclick = () => doUndo();
    q('ed-redo').onclick = () => doRedo();
    q('ed-btn-map').onclick = () => openMapDialog();
    q('ed-btn-mission').onclick = () => openMissionDialog();
    q('ed-btn-file').onclick = () => openFileDialog();
    q('ed-play').onclick = () => play();
    q('ed-panel-toggle').onclick = () => ui.panel.classList.toggle('collapsed');
    q('ed-done').onclick = () => finishDraw();
    q('ed-back').onclick = () => { if (E.draw?.pts.length) { E.draw.pts.pop(); updateHint(); } };
    q('ed-cancel').onclick = () => cancelDraw();
    ui.tools.addEventListener('click', (e) => { const b = e.target.closest('button[data-tool]'); if (b) setTool(b.dataset.tool); });
    ui.title.addEventListener('change', () => { pushUndo(); E.doc.meta.title = ui.title.value.trim() || 'Ohne Titel'; commit(); });
    ui.modal.addEventListener('pointerdown', (e) => { if (e.target === ui.modal) closeModal(); });
    window.addEventListener('resize', resizeOverlay);
    // Zeiger auf der 3D-Ansicht
    const c = document.getElementById('game');
    c.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', (e) => onUp(e, true));
    window.addEventListener('keydown', onKey);
    resizeOverlay();
  }
  function resizeOverlay() {
    if (!overlay) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    overlay.width = Math.round(window.innerWidth * dpr); overlay.height = Math.round(window.innerHeight * dpr);
    overlay.style.width = window.innerWidth + 'px'; overlay.style.height = window.innerHeight + 'px';
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ================= Öffnen / Schließen =================
  function open(doc = null, { cam = null, keepUndo = false } = {}) {
    if (!root) build();
    const d = doc || loadAutosave() || newMap();
    E.doc = sanitizeMap(d).map;
    if (!keepUndo) { E.undo = []; E.redo = []; }
    E.sel = null; E.draw = null;
    if (!E.opts.unit.era) E.opts.unit.era = E.doc.meta.era;
    E.active = true;
    if (E.camMax0 === undefined) E.camMax0 = game.camera.maxDist;
    game.camera.maxDist = Math.max(E.camMax0, E.doc.map.size * 0.9); // Übersicht über die ganze Karte
    ctx.hideScreens();
    ctx.hud.show(false);
    root.classList.remove('hidden');
    document.body.classList.add('editor-on');
    E.keys = { t: '', u: '' };
    rebuild(cam || E.lastCam || null, true);
    setTool(E.tool);
    refreshTop();
  }
  function close() {
    E.active = false;
    if (E.camMax0 !== undefined) { game.camera.maxDist = E.camMax0; game.camera.goalDist = Math.min(game.camera.goalDist, E.camMax0); }
    clearTimeout(E.rebuildT); E.rebuildT = null;
    flushAutosave();
    if (root) root.classList.add('hidden');
    document.body.classList.remove('editor-on');
    closeModal();
  }
  function exit() { close(); ctx.onExit?.(); }
  function camState() { const c = game.camera; return { x: r1(c.goal.x), z: r1(c.goal.z), dist: r1(c.goalDist), yaw: Math.round(c.goalYaw * 1000) / 1000 }; }

  // ================= Neuaufbau =================
  function setStatus(t) { E.status = t; ui.status.textContent = t; ui.status.classList.toggle('hidden', !t); }
  function rebuild(cam = null, immediate = false) {
    clearTimeout(E.rebuildT);
    const run = () => {
      E.rebuildT = null;
      const t0 = performance.now();
      try {
        const c = cam || (game.active && game.mission?.editorPreview ? camState() : null);
        game.camera.orbit = false;
        game.camera.maxDist = Math.max(E.camMax0 ?? 170, E.doc.map.size * 0.9);
        if (game.mission?.editorPreview) releaseWorld();
        game.load(compilePreview(E.doc, c));
        game.paused = true;
        E.keys.t = terrainKey();
        spawnObjects();
      } catch (err) { console.error(err); setStatus('Fehler beim Aufbau: ' + err.message); return; }
      E.stats.rebuilds++; E.stats.lastRebuildMs = Math.round(performance.now() - t0);
      setStatus('');
    };
    setStatus('Gelände wird berechnet …');
    if (immediate) run();
    else E.rebuildT = setTimeout(() => { setStatus('Gelände wird berechnet …'); requestAnimationFrame(() => setTimeout(run, 0)); }, 350);
  }
  // GPU-Speicher der alten Vorschau freigeben: gr.clearScene() gibt nur Geometrien frei; Gelände-Texturen/Materialien
  // blieben bei jedem Neuaufbau liegen (+2 Texturen je Aufbau → Speicher läuft bei vielen Änderungen voll).
  // dispose() auf noch anderweitig genutzte Texturen ist unkritisch (three.js lädt sie bei Bedarf neu hoch).
  function releaseWorld() {
    const w = game.world;
    if (!w) return;
    const seen = new Set();
    const texOf = (m) => {
      for (const v of Object.values(m)) if (v && v.isTexture) seen.add(v);
      if (m.uniforms) for (const u of Object.values(m.uniforms)) { const v = u && u.value; if (v && v.isTexture) seen.add(v); else if (Array.isArray(v)) for (const t of v) if (t && t.isTexture) seen.add(t); }
    };
    w.traverse((o) => { const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; for (const m of ms) { texOf(m); seen.add(m); } });
    for (const x of seen) { try { x.dispose(); } catch (e) { /* ignorieren */ } }
    for (const f of Object.values(game.fows || {})) { try { f.tex?.dispose?.(); } catch (e) { /* ignorieren */ } }
  }
  const terrainKey = () => JSON.stringify([E.doc.map, E.doc.elements]);
  const objKey = () => JSON.stringify([E.doc.units, E.doc.points]);
  function removeGameUnit(u) {
    if (!u) return;
    u.alive = false;
    game.removeUnit(u);
    game.scene.remove(u.root);
  }
  function spawnObjects() {
    for (const u of E.objs.units.values()) removeGameUnit(u);
    for (const u of E.objs.points.values()) removeGameUnit(u);
    E.objs.units.clear(); E.objs.points.clear();
    if (!game.active) return;
    for (const d of E.doc.units) {
      try { E.objs.units.set(d.id, game.spawn(d.type, d.team, d.x, d.z, { heading: d.heading })); } catch (e) { console.warn('Editor: Einheit', d.type, e); }
    }
    for (const p of E.doc.points) {
      try { E.objs.points.set(p.id, game.spawn('cp_' + p.kind, 'N', p.x, p.z, { invulnerable: true, noBlock: true })); } catch (e) { console.warn('Editor: Punkt', p.kind, e); }
    }
    game.updateVision(0, true);
    E.keys.u = objKey();
  }
  // Nach jeder Änderung: Gelände neu bauen oder nur Objekte neu setzen
  function commit({ immediate = false, touch = true } = {}) {
    if (touch) E.doc.meta.modified = new Date().toISOString().slice(0, 19); // Laden/Import ändert den Zeitstempel nicht
    if (terrainKey() !== E.keys.t) rebuild(null, immediate);
    else if (objKey() !== E.keys.u) spawnObjects();
    scheduleAutosave();
    refreshTop();
    renderPanel();
  }
  function scheduleAutosave() { clearTimeout(E.saveT); E.saveT = setTimeout(flushAutosave, 800); }
  function flushAutosave() { clearTimeout(E.saveT); E.saveT = null; if (E.doc) { const r = autosave(E.doc); if (!r.ok) setStatus(r.error); } }

  // ================= Rückgängig =================
  function pushUndo() {
    E.undo.push(JSON.stringify(E.doc));
    if (E.undo.length > 80) E.undo.shift();
    E.redo = [];
    refreshTop();
  }
  function doUndo() {
    if (E.draw) { cancelDraw(); return; }
    if (!E.undo.length) return;
    E.redo.push(JSON.stringify(E.doc));
    E.doc = JSON.parse(E.undo.pop());
    validateSel(); commit();
  }
  function doRedo() {
    if (!E.redo.length) return;
    E.undo.push(JSON.stringify(E.doc));
    E.doc = JSON.parse(E.redo.pop());
    validateSel(); commit();
  }
  function refreshTop() {
    if (!root) return;
    root.querySelector('#ed-undo').disabled = !E.undo.length && !E.draw;
    root.querySelector('#ed-redo').disabled = !E.redo.length;
    if (document.activeElement !== ui.title) ui.title.value = E.doc.meta.title;
  }

  // ================= Werkzeuge =================
  function setTool(id) {
    if (!TOOL[id]) id = 'select';
    if (E.draw) cancelDraw();
    E.tool = id;
    if (id !== 'select') E.sel = null;
    ui.tools.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.tool === id));
    if (id === 'unit' && E.opts.unit.era !== E.doc.meta.era && !E._eraTouched) E.opts.unit.era = E.doc.meta.era;
    if (id === 'village' && !E.opts.village.set) E.opts.village.set = ERA_SET[E.doc.meta.era];
    renderPanel();
    updateHint();
  }
  function updateHint() {
    const t = TOOL[E.tool];
    const drawing = !!E.draw;
    let txt = t.hint;
    if (drawing) {
      const n = E.draw.pts.length, need = t.kind === 'poly' ? 3 : 2;
      txt = `${t.name}: ${n} Punkt${n === 1 ? '' : 'e'} gesetzt${n < need ? ` – mindestens ${need} nötig` : ' – „Fertig" schließt ab'}.`;
    } else if (E.sel) txt = 'Ausgewählt: ' + selName(E.sel) + ' – ziehen verschiebt, Entf löscht.';
    ui.hintText.textContent = txt;
    ui.hint.classList.toggle('drawing', drawing);
    refreshTop();
  }
  function selName(s) {
    const o = findSel(s);
    if (!o) return '';
    if (s.kind === 'unit') return UNIT_TYPES[o.type]?.name || o.type;
    if (s.kind === 'point') return o.name;
    if (s.kind === 'zone') return `Startzone ${o.team}`;
    if (s.kind === 'hold') return 'Zielgebiet';
    return elName(o);
  }
  function elName(e) {
    if (e.type === 'road') return ROAD_KINDS[e.kind];
    if (e.type === 'hill') return e.h < 0 ? 'Senke' : 'Hügel';
    if (e.type === 'bridge') return e.kind === 'ford' ? 'Furt' : 'Brücke';
    if (e.type === 'building') return KIND_NAMES[e.kind] || e.kind;
    return { flat: 'Ebene', water: 'Wasser', river: 'Fluss', forest: 'Wald', treeline: 'Baumreihe', field: 'Feld', village: 'Siedlung' }[e.type] || e.type;
  }
  function newId(prefix) { return prefix + (E.doc.nextId++); }
  function ground(x, y) { return input.ground(x, y); }
  function clampXZ(x, z) { const h = E.doc.map.size / 2 - 2; return [r1(Math.max(-h, Math.min(h, x))), r1(Math.max(-h, Math.min(h, z)))]; }

  // Platzieren (Stempel-Werkzeuge)
  function stamp(p) {
    const [x, z] = clampXZ(p.x, p.z);
    const o = E.opts[E.tool];
    pushUndo();
    let sel = null;
    switch (E.tool) {
      case 'hill': { const e = { id: newId('e'), type: 'hill', x, z, r: o.r, h: Math.abs(o.h) || 4 }; E.doc.elements.push(e); sel = { kind: 'el', id: e.id }; break; }
      case 'dip': { const e = { id: newId('e'), type: 'hill', x, z, r: o.r, h: -Math.abs(o.h || 4) }; E.doc.elements.push(e); sel = { kind: 'el', id: e.id }; break; }
      case 'flat': { const h = Math.max(-6, Math.min(30, r1(game.terrain?.height(x, z) ?? 3))); const e = { id: newId('e'), type: 'flat', x, z, r: o.r, h }; E.doc.elements.push(e); sel = { kind: 'el', id: e.id }; break; }
      case 'forest': { const e = { id: newId('e'), type: 'forest', x, z, r: o.r, kind: o.kind, density: o.density }; E.doc.elements.push(e); sel = { kind: 'el', id: e.id }; break; }
      case 'village': { const e = { id: newId('e'), type: 'village', x, z, r: o.r, houses: o.houses, set: o.set || ERA_SET[E.doc.meta.era], urban: o.urban, style: o.style || 'simple' }; E.doc.elements.push(e); sel = { kind: 'el', id: e.id }; break; }
      case 'building': { const dd = buildingDims(o.kind); const e = { id: newId('e'), type: 'building', x, z, rot: o.rot, kind: o.kind, w: dd.w, d: dd.d, floors: dd.floors }; E.doc.elements.push(e); sel = { kind: 'el', id: e.id }; break; }
      case 'unit': {
        if (!UNIT_TYPES[o.type]) { E.undo.pop(); return; }
        const heading = o.heading === null ? (o.team === 'UA' ? Math.PI : 0) : o.heading;
        const u = { id: newId('u'), type: o.type, team: o.team, x, z, heading: Math.round(heading * 100) / 100, ai: o.ai, target: !!o.target };
        E.doc.units.push(u); sel = { kind: 'unit', id: u.id };
        break;
      }
      case 'point': { const p2 = { id: newId('p'), kind: o.kind, x, z, name: uniqueName(CP_KINDS[o.kind]), value: o.kind === 'zeppelin' ? 3 : 1, radius: CP_DEFAULT_R[o.kind] }; E.doc.points.push(p2); sel = { kind: 'point', id: p2.id }; break; }
      case 'zone': { const zz = { id: newId('z'), team: o.team, x, z, r: o.r }; E.doc.zones.push(zz); sel = { kind: 'zone', id: zz.id }; break; }
      case 'hold': { const ob = { id: newId('o'), kind: 'hold', x, z, r: o.r, minutes: o.minutes }; E.doc.objectives.push(ob); sel = { kind: 'hold', id: ob.id }; break; }
    }
    // Im Platzier-Modus bleibt das Werkzeug aktiv; die letzte Platzierung ist gewählt (Eigenschaften rechts)
    E.lastPlaced = sel;
    commit();
  }
  function uniqueName(base) {
    const names = new Set(E.doc.points.map((p) => p.name));
    if (!names.has(base)) return base;
    for (let i = 2; i < 99; i++) if (!names.has(`${base} ${i}`)) return `${base} ${i}`;
    return base;
  }
  // Linien/Flächen zeichnen
  function addDrawPoint(p) {
    const t = TOOL[E.tool];
    if (!E.draw) E.draw = { tool: E.tool, pts: [] };
    const [x, z] = clampXZ(p.x, p.z);
    const last = E.draw.pts[E.draw.pts.length - 1];
    if (last && Math.hypot(last[0] - x, last[1] - z) < 1) return;
    E.draw.pts.push([x, z]);
    if (t.kind === 'line2' && E.draw.pts.length >= 2) { finishDraw(); return; }
    updateHint();
  }
  function cancelDraw() { E.draw = null; updateHint(); }
  function finishDraw() {
    const d = E.draw;
    if (!d) return;
    const t = TOOL[d.tool], o = E.opts[d.tool];
    const need = t.kind === 'poly' ? 3 : 2;
    if (d.pts.length < need) { setStatusFlash(`Mindestens ${need} Punkte nötig.`); return; }
    pushUndo();
    let e = null;
    const pts = d.pts.map((p) => p.slice());
    switch (d.tool) {
      case 'water': e = { type: 'water', poly: pts, depth: o.depth }; break;
      case 'river': e = { type: 'river', pts, width: o.width, depth: o.depth }; break;
      case 'road': case 'track': case 'rail': e = { type: 'road', kind: d.tool, pts, width: o.width }; break;
      case 'forest': e = { type: 'forest', poly: pts, kind: o.kind, density: o.density }; break;
      case 'treeline': e = { type: 'treeline', pts }; break;
      case 'field': e = { type: 'field', poly: pts, crop: o.crop, angle: o.angle }; break;
      case 'bridge': case 'ford': e = { type: 'bridge', kind: d.tool, pts: pts.slice(0, 2), width: o.width }; break;
    }
    E.draw = null;
    if (e) { e.id = newId('e'); E.doc.elements.push(e); E.lastPlaced = { kind: 'el', id: e.id }; }
    updateHint();
    commit();
  }
  let flashT = null;
  function setStatusFlash(t) { setStatus(t); clearTimeout(flashT); flashT = setTimeout(() => { if (E.status === t) setStatus(''); }, 2200); }

  // ================= Auswahl =================
  function findSel(s) {
    if (!s) return null;
    const list = s.kind === 'unit' ? E.doc.units : s.kind === 'point' ? E.doc.points : s.kind === 'zone' ? E.doc.zones : s.kind === 'hold' ? E.doc.objectives : E.doc.elements;
    return list.find((o) => o.id === s.id) || null;
  }
  function validateSel() { if (E.sel && !findSel(E.sel)) E.sel = null; if (E.lastPlaced && !findSel(E.lastPlaced)) E.lastPlaced = null; }
  function deleteSel() {
    const s = E.sel || (E.tool !== 'select' ? E.lastPlaced : null);
    const o = findSel(s);
    if (!o) return;
    pushUndo();
    const list = s.kind === 'unit' ? E.doc.units : s.kind === 'point' ? E.doc.points : s.kind === 'zone' ? E.doc.zones : s.kind === 'hold' ? E.doc.objectives : E.doc.elements;
    list.splice(list.indexOf(o), 1);
    E.sel = null; E.lastPlaced = null;
    updateHint();
    commit();
  }
  function select(s) { E.sel = s; updateHint(); renderPanel(); }

  // ================= Projektion / Treffer =================
  const _v = new THREE.Vector3();
  let W = 1, H = 1;
  function proj(x, z, dy = 0.4) {
    const T = game.terrain;
    _v.set(x, (T ? T.surface(x, z) : 0) + dy, z).project(gr.camera);
    if (_v.z > 1 || _v.z < -1) return null;
    return [(_v.x * 0.5 + 0.5) * W, (-_v.y * 0.5 + 0.5) * H];
  }
  function ppm() { const cam = gr.camera; return H / (2 * Math.max(5, game.camera.dist) * Math.tan((cam.fov * Math.PI / 180) / 2)); }
  function dense(pts, closed = false, step = 4) {
    const out = [];
    const arr = closed ? [...pts, pts[0]] : pts;
    for (let i = 0; i < arr.length - 1; i++) {
      const [ax, az] = arr[i], [bx, bz] = arr[i + 1];
      const n = Math.max(1, Math.min(60, Math.ceil(Math.hypot(bx - ax, bz - az) / step)));
      for (let k = 0; k < n; k++) out.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]);
    }
    out.push(arr[arr.length - 1]);
    return out;
  }
  function circlePts(x, z, r, n = 36) { const o = []; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; o.push([x + Math.cos(a) * r, z + Math.sin(a) * r]); } return o; }
  function projPath(pts, closed) { const out = []; for (const p of dense(pts, closed)) { const s = proj(p[0], p[1]); out.push(s); } return out; }
  function distSeg(px, py, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1; const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / l2)); return Math.hypot(px - a[0] - dx * t, py - a[1] - dy * t); }
  function pathDist(sp, x, y) { let d = Infinity; for (let i = 0; i < sp.length - 1; i++) if (sp[i] && sp[i + 1]) d = Math.min(d, distSeg(x, y, sp[i], sp[i + 1])); return d; }
  function inScreenPoly(sp, x, y) { const p = sp.filter(Boolean); let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const a = p[i], b = p[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
  // Handles des gewählten Elements: [{ i (Index in pts/poly) | 'r' (Radius) | 'c' (Mitte), x, z }]
  function handlesOf(s) {
    const o = findSel(s);
    if (!o) return [];
    const pts = o.pts || o.poly;
    if (pts) return pts.map((p, i) => ({ i, x: p[0], z: p[1] }));
    if (o.r !== undefined) return [{ i: 'r', x: o.x + o.r, z: o.z }];
    if (o.type === 'building') { const L = Math.max(o.w, o.d) / 2 + 3; return [{ i: 'rot', x: o.x + Math.cos(o.rot) * L, z: o.z - Math.sin(o.rot) * L }]; }
    if (s.kind === 'unit') { const L = Math.max(6, (UNIT_TYPES[o.type]?.radius || 2) * 2.5); return [{ i: 'rot', x: o.x + Math.sin(o.heading) * L, z: o.z + Math.cos(o.heading) * L }]; }
    return [];
  }
  function hitTest(x, y, touch) {
    const tol = touch ? 22 : 12;
    // 1) Handles der Auswahl
    // (Griff nur, wenn er näher liegt als die Mitte des gewählten Objekts – sonst wird verschoben statt gedreht)
    if (E.sel) {
      const so = findSel(E.sel), c = so && so.x !== undefined ? proj(so.x, so.z) : null;
      const dc = c ? Math.hypot(c[0] - x, c[1] - y) : Infinity;
      for (const h of handlesOf(E.sel)) { const s = proj(h.x, h.z); if (!s) continue; const d = Math.hypot(s[0] - x, s[1] - y); if (d < tol + 2 && d < dc) return { ...E.sel, handle: h.i }; }
    }
    // 2) Einheiten, Punkte, Zonen, Zielgebiete, Gebäude (Punktobjekte)
    let best = null, bd = tol + 6;
    const tryPt = (kind, o, extra = 0) => { const s = proj(o.x, o.z); if (!s) return; const d = Math.hypot(s[0] - x, s[1] - y) - extra; if (d < bd) { bd = d; best = { kind, id: o.id }; } };
    for (const u of E.doc.units) tryPt('unit', u, 4);
    if (best) return best;
    for (const p of E.doc.points) tryPt('point', p);
    for (const z of E.doc.zones) tryPt('zone', z);
    for (const o of E.doc.objectives) if (o.kind === 'hold') tryPt('hold', o);
    for (const e of E.doc.elements) if (e.type === 'building' || e.type === 'village' || e.type === 'hill' || e.type === 'flat' || (e.type === 'forest' && !e.poly)) tryPt('el', e, e.type === 'building' ? 4 : 0);
    if (best) return best;
    // 3) Linien
    for (let i = E.doc.elements.length - 1; i >= 0; i--) {
      const e = E.doc.elements[i];
      if (!e.pts) continue;
      const sp = projPath(e.pts, false);
      const w = Math.max(tol, ((e.width || 4) * ppm()) / 2 + 4);
      if (pathDist(sp, x, y) < w) return { kind: 'el', id: e.id };
    }
    // 4) Kreise (Fläche) und Polygone
    const cand = [];
    for (const o of [...E.doc.zones.map((z) => ['zone', z]), ...E.doc.objectives.filter((q) => q.kind === 'hold').map((q) => ['hold', q]), ...E.doc.points.map((p) => ['point', p, p.radius])]) {
      const [kind, ob, r0] = o;
      const sp = projPath(circlePts(ob.x, ob.z, r0 ?? ob.r, 24), true);
      if (inScreenPoly(sp, x, y)) cand.push({ kind, id: ob.id, a: (r0 ?? ob.r) ** 2 });
    }
    for (const e of E.doc.elements) {
      let sp = null, a = 0;
      if (e.poly) { sp = projPath(e.poly, true); a = polyArea(e.poly); }
      else if (e.r !== undefined) { sp = projPath(circlePts(e.x, e.z, e.r, 24), true); a = Math.PI * e.r * e.r; }
      if (sp && inScreenPoly(sp, x, y)) cand.push({ kind: 'el', id: e.id, a });
    }
    cand.sort((p, q) => p.a - q.a);
    return cand[0] ? { kind: cand[0].kind, id: cand[0].id } : null;
  }
  const polyArea = (p) => { let a = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]); return Math.abs(a / 2); };

  // ================= Zeiger =================
  const ptrs = new Map();
  let pinch = null, drag = null;
  function onDown(e) {
    if (!E.active || !ui.modal.classList.contains('hidden')) return;
    e.preventDefault();
    if (e.pointerType === 'touch') document.body.classList.add('touch');
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, button: e.button, type: e.pointerType, moved: false, t: performance.now() });
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      a.moved = b.moved = true;
      if (drag?.undoPushed && drag.changed) finishDrag(); else if (drag?.undoPushed) E.undo.pop();
      drag = null;
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      return;
    }
    if (ptrs.size > 2) return;
    const p = ptrs.get(e.pointerId);
    // Ziehen von Elementen nur mit dem Auswahlwerkzeug (linke Maus / ein Finger)
    if (E.tool === 'select' && (e.pointerType !== 'mouse' || e.button === 0)) {
      const hit = hitTest(e.clientX, e.clientY, e.pointerType !== 'mouse');
      if (hit && (E.sel?.id === hit.id || hit.handle !== undefined || e.pointerType === 'mouse')) {
        if (!E.sel || E.sel.id !== hit.id || E.sel.kind !== hit.kind) select({ kind: hit.kind, id: hit.id });
        const g0 = ground(e.clientX, e.clientY);
        if (g0) { drag = { id: e.pointerId, hit, start: g0, orig: JSON.parse(JSON.stringify(findSel(hit))), undoPushed: false, changed: false }; p.dragging = true; }
      }
    }
  }
  function onMove(e) {
    if (!E.active) return;
    E.mouse = { x: e.clientX, y: e.clientY, type: e.pointerType };
    const p = ptrs.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (Math.hypot(p.x - p.sx, p.y - p.sy) > (p.type === 'mouse' ? 4 : 9)) p.moved = true;
    if (ptrs.size === 2 && pinch) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (pinch.d > 10) game.camera.zoom(pinch.d / Math.max(10, d));
      game.camera.rotate(-(ang - pinch.ang));
      const s = game.camera.dist / window.innerHeight * 1.6;
      game.camera.pan(-(mx - pinch.mx) * s, -(my - pinch.my) * s);
      pinch = { d, ang, mx, my };
      return;
    }
    if (drag && drag.id === e.pointerId) { if (p.moved) dragTo(e.clientX, e.clientY); return; }
    if (!p.moved) return;
    if (p.type === 'mouse' && (p.button === 1 || (p.button === 0 && e.altKey))) { game.camera.rotate(-dx * 0.006); return; }
    const s = game.camera.dist / window.innerHeight * 1.6;
    game.camera.pan(-dx * s, -dy * s);
  }
  function onUp(e, cancel = false) {
    const p = ptrs.get(e.pointerId);
    if (!p) return;
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (drag && drag.id === e.pointerId) { if (drag.changed) finishDrag(); else if (drag.undoPushed) E.undo.pop(); drag = null; if (p.moved || cancel) return; }
    if (cancel || p.moved || !E.active) return;
    if (p.type === 'mouse' && p.button === 2) { if (E.draw) finishDraw(); return; }
    if (p.type === 'mouse' && p.button !== 0) return;
    click(e.clientX, e.clientY, p.type !== 'mouse');
  }
  function click(x, y, touch) {
    const t = TOOL[E.tool];
    if (E.tool === 'select') { const hit = hitTest(x, y, touch); select(hit ? { kind: hit.kind, id: hit.id } : null); return; }
    const g = ground(x, y);
    if (!g) return;
    if (t.kind === 'stamp') { if (E.tool === 'forest') return; stamp(g); return; }
    if (E.tool === 'forest' && E.opts.forest.shape === 'circle') { E.tool = 'forest'; stampForestCircle(g); return; }
    addDrawPoint(g);
  }
  function stampForestCircle(g) {
    const [x, z] = clampXZ(g.x, g.z), o = E.opts.forest;
    pushUndo();
    const e = { id: newId('e'), type: 'forest', x, z, r: o.r, kind: o.kind, density: o.density };
    E.doc.elements.push(e); E.lastPlaced = { kind: 'el', id: e.id };
    commit();
  }
  function dragTo(x, y) {
    const g = ground(x, y);
    if (!g) return;
    const o = findSel(drag.hit);
    if (!o) return;
    if (!drag.undoPushed) {
      // Zustand vor dem Ziehen sichern (orig wurde vor jeder Änderung kopiert)
      const cur = JSON.stringify(E.doc);
      const tmp = JSON.parse(cur);
      const list = drag.hit.kind === 'unit' ? tmp.units : drag.hit.kind === 'point' ? tmp.points : drag.hit.kind === 'zone' ? tmp.zones : drag.hit.kind === 'hold' ? tmp.objectives : tmp.elements;
      const i = list.findIndex((q) => q.id === o.id); if (i >= 0) list[i] = drag.orig;
      E.undo.push(JSON.stringify(tmp)); E.redo = []; drag.undoPushed = true;
    }
    const dx = g.x - drag.start.x, dz = g.z - drag.start.z;
    const O = drag.orig, h = drag.hit.handle;
    if (h === 'r') o.r = r1(Math.max(4, Math.min(o.type === 'village' ? 90 : 160, Math.hypot(g.x - o.x, g.z - o.z))));
    else if (h === 'rot') {
      const a = Math.atan2(g.x - o.x, g.z - o.z);
      if (drag.hit.kind === 'unit') o.heading = Math.round(a * 100) / 100; else o.rot = Math.round((a - Math.PI / 2) * 100) / 100;
    } else if (typeof h === 'number') { const arr = o.pts || o.poly; const [cx, cz] = clampXZ(g.x, g.z); arr[h] = [cx, cz]; }
    else if (O.pts || O.poly) { const k = O.pts ? 'pts' : 'poly'; o[k] = O[k].map(([px, pz]) => clampXZ(px + dx, pz + dz)); }
    else { const [cx, cz] = clampXZ(O.x + dx, O.z + dz); o.x = cx; o.z = cz; }
    drag.changed = true;
    // Live-Vorschau der Einheit/des Punkts
    const gu = drag.hit.kind === 'unit' ? E.objs.units.get(o.id) : drag.hit.kind === 'point' ? E.objs.points.get(o.id) : null;
    if (gu) { gu.pos.x = o.x; gu.pos.z = o.z; if (o.heading !== undefined) gu.heading = o.heading; gu.place(0); gu.root.updateMatrix(); }
  }
  function finishDrag() { commit(); }

  // ================= Tastatur =================
  function onKey(e) {
    if (!E.active || isTyping() || !ui.modal.classList.contains('hidden')) return;
    const k = e.key;
    if ((e.ctrlKey || e.metaKey) && (k === 'z' || k === 'Z')) { e.preventDefault(); if (e.shiftKey) doRedo(); else doUndo(); return; }
    if ((e.ctrlKey || e.metaKey) && (k === 'y' || k === 'Y')) { e.preventDefault(); doRedo(); return; }
    if ((e.ctrlKey || e.metaKey) && (k === 's' || k === 'S')) { e.preventDefault(); openFileDialog(); return; }
    if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); if (E.draw) { E.draw.pts.pop(); updateHint(); } else deleteSel(); return; }
    if (k === 'Enter') { finishDraw(); return; }
    if (k === 'Escape') { if (E.draw) cancelDraw(); else select(null); return; }
    if (k === 'r' || k === 'R') { rotateSel(Math.PI / 4); return; }
  }
  function rotateSel(a) {
    const s = E.sel || E.lastPlaced; const o = findSel(s);
    if (E.tool === 'building' && !E.sel) { E.opts.building.rot = Math.round(((E.opts.building.rot + a) % (Math.PI * 2)) * 100) / 100; renderPanel(); }
    if (E.tool === 'unit' && !E.sel) { const h = E.opts.unit.heading ?? (E.opts.unit.team === 'UA' ? Math.PI : 0); E.opts.unit.heading = Math.round(((h - a) % (Math.PI * 2)) * 100) / 100; renderPanel(); }
    if (!o || !E.sel) return;
    pushUndo();
    if (s.kind === 'unit') o.heading = Math.round(((o.heading - a) % (Math.PI * 2)) * 100) / 100;
    else if (o.type === 'building') o.rot = Math.round(((o.rot + a) % (Math.PI * 2)) * 100) / 100;
    else { E.undo.pop(); return; }
    commit();
  }

  // ================= Einzelbild =================
  function update(dt) {
    if (!E.active) return;
    // Kamera per Tastatur (Input.update ist bei pausiertem Spiel aus)
    if (!isTyping() && ui.modal.classList.contains('hidden')) {
      const ks = input.keys, sp = game.camera.dist * 1.2 * dt;
      let dx = 0, dz = 0;
      if (ks.has('w') || ks.has('ArrowUp')) dz -= 1;
      if (ks.has('s') || ks.has('ArrowDown')) dz += 1;
      if (ks.has('a') || ks.has('ArrowLeft')) dx -= 1;
      if (ks.has('d') || ks.has('ArrowRight')) dx += 1;
      if (ks.has('q')) game.camera.rotate(dt * 1.5);
      if (ks.has('e')) game.camera.rotate(-dt * 1.5);
      if (dx || dz) game.camera.pan(dx * sp, dz * sp);
    }
    E.lastCam = game.active ? camState() : E.lastCam;
    draw();
  }

  // ================= Überlagerung zeichnen =================
  function strokePath(sp, color, width, dash = null, close = false) {
    octx.strokeStyle = color; octx.lineWidth = width; octx.setLineDash(dash || []);
    octx.beginPath();
    let pen = false;
    for (const s of sp) { if (!s) { pen = false; continue; } if (!pen) { octx.moveTo(s[0], s[1]); pen = true; } else octx.lineTo(s[0], s[1]); }
    if (close && pen && sp[0]) octx.closePath();
    octx.stroke();
    octx.setLineDash([]);
  }
  function fillPath(sp, color) {
    const p = sp.filter(Boolean);
    if (p.length < 3) return;
    octx.fillStyle = color; octx.beginPath(); octx.moveTo(p[0][0], p[0][1]); for (const s of p) octx.lineTo(s[0], s[1]); octx.closePath(); octx.fill();
  }
  function label(s, text, color = '#fff') {
    if (!s) return;
    octx.font = '600 12px system-ui, sans-serif'; octx.textAlign = 'center'; octx.textBaseline = 'bottom';
    octx.lineWidth = 3; octx.strokeStyle = 'rgba(0,0,0,.75)'; octx.strokeText(text, s[0], s[1] - 8);
    octx.fillStyle = color; octx.fillText(text, s[0], s[1] - 8);
  }
  function draw() {
    W = window.innerWidth; H = window.innerHeight;
    octx.clearRect(0, 0, W, H);
    if (!game.active || !game.terrain || !game.mission?.editorPreview) return;
    gr.camera.updateMatrixWorld();
    const k = ppm();
    const selId = E.sel?.id;
    for (const e of E.doc.elements) {
      const sel = e.id === selId;
      const sc = sel ? COLORS.sel : null;
      switch (e.type) {
        case 'water': { const sp = projPath(e.poly, true); fillPath(sp, COLORS.water); strokePath(sp, sc || COLORS.waterLine, sel ? 3 : 2, null, true); break; }
        case 'forest': {
          const sp = e.poly ? projPath(e.poly, true) : projPath(circlePts(e.x, e.z, e.r), true);
          fillPath(sp, COLORS.forest); strokePath(sp, sc || COLORS.forestLine, sel ? 3 : 1.5, [6, 4], true); break;
        }
        case 'field': { const sp = projPath(e.poly, true); fillPath(sp, COLORS.field); strokePath(sp, sc || COLORS.fieldLine, sel ? 3 : 1.5, [3, 3], true); break; }
        // Linien: halbtransparentes Band in echter Breite + Mittellinie (das 3D-Gelände bleibt sichtbar)
        case 'river': { const sp = projPath(e.pts); strokePath(sp, 'rgba(61,141,224,.25)', Math.max(4, e.width * k)); strokePath(sp, sc || COLORS.river, sel ? 3 : 2); break; }
        case 'road': {
          const sp = projPath(e.pts);
          strokePath(sp, e.kind === 'rail' ? 'rgba(40,40,40,.25)' : 'rgba(235,225,200,.2)', Math.max(3, e.width * k));
          strokePath(sp, sc || COLORS[e.kind], sel ? 3 : 2, e.kind === 'track' ? [8, 6] : e.kind === 'rail' ? [3, 4] : null);
          break;
        }
        case 'treeline': strokePath(projPath(e.pts), sc || COLORS.treeline, 3, [2, 5]); break;
        case 'bridge': { const sp = projPath(e.pts); strokePath(sp, e.kind === 'ford' ? 'rgba(143,211,255,.3)' : 'rgba(255,255,255,.3)', Math.max(4, e.width * k)); strokePath(sp, sc || (e.kind === 'ford' ? COLORS.ford : COLORS.bridge), sel ? 3 : 2, e.kind === 'ford' ? [5, 4] : null); break; }
        case 'hill': case 'flat': case 'village': {
          const col = e.type === 'village' ? COLORS.village : e.type === 'flat' ? COLORS.flat : e.h < 0 ? COLORS.dip : COLORS.hill;
          strokePath(projPath(circlePts(e.x, e.z, e.r), true), sc || col, sel ? 3 : 1.5, e.type === 'village' ? null : [4, 4], true);
          const s = proj(e.x, e.z);
          if (s) { octx.fillStyle = sc || col; octx.fillRect(s[0] - 3, s[1] - 3, 6, 6); }
          if (sel || e.type === 'village') label(s, e.type === 'village' ? (e.style && e.style !== 'simple' ? SETTLEMENT_STYLES[e.style].replace('Generator: ', '') : `${SET_NAMES[e.set] || 'Siedlung'} (${e.houses})`) : e.type === 'flat' ? `Ebene ${e.h} m` : `${e.h > 0 ? '+' : ''}${e.h} m`, sc || col);
          break;
        }
        case 'building': {
          const c = Math.cos(e.rot), s2 = Math.sin(e.rot), hw = e.w / 2, hd = e.d / 2;
          const corners = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([lx, lz]) => [e.x + lx * c + lz * s2, e.z - lx * s2 + lz * c]);
          const sp = corners.map(([x, z]) => proj(x, z, 0.6));
          strokePath(sp, sc || COLORS.building, sel ? 3 : 2, null, true);
          if (sel) label(proj(e.x, e.z), KIND_NAMES[e.kind] || e.kind, sc);
          break;
        }
      }
    }
    for (const z of E.doc.zones) {
      const sel = z.id === selId, sp = projPath(circlePts(z.x, z.z, z.r), true);
      fillPath(sp, z.team === 'UA' ? 'rgba(77,163,255,.12)' : 'rgba(255,90,90,.12)');
      strokePath(sp, sel ? COLORS.sel : COLORS[z.team], sel ? 3 : 2, [10, 5], true);
      label(proj(z.x, z.z), `Start ${z.team === 'UA' ? 'Ukraine' : 'Russland'}`, COLORS[z.team]);
    }
    for (const o of E.doc.objectives) {
      if (o.kind !== 'hold') continue;
      const sel = o.id === selId, sp = projPath(circlePts(o.x, o.z, o.r), true);
      strokePath(sp, sel ? COLORS.sel : COLORS.hold, sel ? 3 : 2, [4, 3], true);
      label(proj(o.x, o.z), `Halten ${o.minutes} min`, COLORS.hold);
    }
    for (const p of E.doc.points) {
      const sel = p.id === selId;
      strokePath(projPath(circlePts(p.x, p.z, p.radius), true), sel ? COLORS.sel : COLORS.point, sel ? 3 : 1.5, null, true);
      label(proj(p.x, p.z, 3), `${p.name} (${p.value})`, sel ? COLORS.sel : COLORS.point);
    }
    for (const u of E.doc.units) {
      const s = proj(u.x, u.z, 0.6);
      if (!s) continue;
      const sel = u.id === selId;
      octx.fillStyle = COLORS[u.team]; octx.strokeStyle = sel ? COLORS.sel : '#000'; octx.lineWidth = sel ? 2.5 : 1;
      octx.beginPath(); octx.arc(s[0], s[1], sel ? 6 : 4, 0, 7); octx.fill(); octx.stroke();
      if (u.target) { octx.strokeStyle = '#ffd500'; octx.lineWidth = 1.5; octx.strokeRect(s[0] - 8, s[1] - 8, 16, 16); }
      if (sel) { const L = Math.max(6, (UNIT_TYPES[u.type]?.radius || 2) * 2.5), f = proj(u.x + Math.sin(u.heading) * L, u.z + Math.cos(u.heading) * L, 0.6); if (f) strokePath([s, f], COLORS.sel, 2); label(s, UNIT_TYPES[u.type]?.name || u.type, COLORS.sel); }
    }
    // Handles der Auswahl
    if (E.sel) for (const h of handlesOf(E.sel)) {
      const s = proj(h.x, h.z);
      if (!s) continue;
      octx.fillStyle = h.i === 'r' || h.i === 'rot' ? COLORS.sel : '#fff'; octx.strokeStyle = '#000'; octx.lineWidth = 1;
      octx.fillRect(s[0] - 5, s[1] - 5, 10, 10); octx.strokeRect(s[0] - 5, s[1] - 5, 10, 10);
    }
    // Zeichnung in Arbeit
    if (E.draw) {
      const pts = [...E.draw.pts];
      if (E.mouse?.type === 'mouse') { const g = ground(E.mouse.x, E.mouse.y); if (g) pts.push([g.x, g.z]); }
      const closed = TOOL[E.draw.tool].kind === 'poly';
      if (pts.length >= 2) strokePath(projPath(pts, closed && pts.length > 2), COLORS.sel, 2.5, [6, 4], closed && pts.length > 2);
      for (const p of E.draw.pts) { const s = proj(p[0], p[1]); if (s) { octx.fillStyle = COLORS.sel; octx.fillRect(s[0] - 4, s[1] - 4, 8, 8); } }
    }
    // Vorschau des Stempels unter der Maus
    if (!E.draw && E.mouse?.type === 'mouse' && TOOL[E.tool].kind === 'stamp' && !ptrs.size) {
      const g = ground(E.mouse.x, E.mouse.y);
      const o = E.opts[E.tool];
      const r = E.tool === 'point' ? CP_DEFAULT_R[o.kind] : o.r;
      if (g && r) strokePath(projPath(circlePts(g.x, g.z, r, 28), true), 'rgba(255,213,0,.7)', 1.5, [3, 3], true);
    }
  }

  // ================= Seitenleiste (Werkzeugoptionen / Eigenschaften) =================
  // Formularfelder: { k, label, type: 'range'|'number'|'select'|'check'|'text'|'seg', min, max, step, opts }
  function fieldHtml(f, v) {
    const id = 'edf-' + f.k;
    if (f.type === 'select') return `<label>${f.label}<select data-k="${f.k}" id="${id}">${Object.entries(f.opts).map(([k2, t]) => `<option value="${escapeHtml(k2)}"${String(v) === k2 ? ' selected' : ''}>${escapeHtml(t)}</option>`).join('')}</select></label>`;
    if (f.type === 'check') return `<label class="check"><input type="checkbox" data-k="${f.k}" id="${id}"${v ? ' checked' : ''}> ${f.label}</label>`;
    if (f.type === 'seg') return `<div class="sk-field"><span>${f.label}</span><div class="seg" data-k="${f.k}">${Object.entries(f.opts).map(([k2, t]) => `<button data-v="${k2}" class="${String(v) === k2 ? 'active' : ''}">${t}</button>`).join('')}</div></div>`;
    if (f.type === 'text') return `<label>${f.label}<input type="text" data-k="${f.k}" id="${id}" maxlength="${f.max || 40}" value="${escapeHtml(v)}"></label>`;
    return `<label>${f.label} <span class="ed-val" data-for="${f.k}">${f.fmt ? f.fmt(v) : v}</span><input type="range" data-k="${f.k}" id="${id}" min="${f.min}" max="${f.max}" step="${f.step || 1}" value="${v}"></label>`;
  }
  const F = {
    r: (max = 160, min = 4) => ({ k: 'r', label: 'Radius', min, max, step: 1, fmt: (v) => v + ' m' }),
    hill: { k: 'h', label: 'Höhe', min: 1, max: 30, step: 0.5, fmt: (v) => v + ' m' },
    dip: { k: 'h', label: 'Tiefe', min: -12, max: -1, step: 0.5, fmt: (v) => v + ' m' },
    hset: { k: 'h', label: 'Höhe', min: -12, max: 30, step: 0.5, fmt: (v) => v + ' m' },
    flatH: { k: 'h', label: 'Zielhöhe', min: -6, max: 30, step: 0.5, fmt: (v) => v + ' m' },
    width: (min, max) => ({ k: 'width', label: 'Breite', min, max, step: 0.5, fmt: (v) => v + ' m' }),
    depth: (max) => ({ k: 'depth', label: 'Tiefe', min: 1, max, step: 0.5, fmt: (v) => v + ' m' }),
    forestKind: { k: 'kind', label: 'Art', type: 'select', opts: FOREST_KINDS },
    density: { k: 'density', label: 'Dichte', min: 0.01, max: 0.12, step: 0.01, fmt: (v) => Math.round(v * 100) + ' %' },
    crop: { k: 'crop', label: 'Feldfrucht', type: 'select', opts: CROPS },
    angle: { k: 'angle', label: 'Furchen', min: -3.14, max: 3.14, step: 0.05, fmt: (v) => Math.round(v * 180 / Math.PI) + '°' },
    houses: { k: 'houses', label: 'Gebäude', min: 1, max: 60, step: 1 },
    set: { k: 'set', label: 'Gebäude-Set', type: 'select', opts: Object.fromEntries(Object.keys(BUILDING_SETS).map((k2) => [k2, SET_NAMES[k2] || k2])) },
    urban: { k: 'urban', label: 'Städtisch (größere Gebäude)', type: 'check' },
    style: { k: 'style', label: 'Stil', type: 'select', opts: SETTLEMENT_STYLES },
    kind: () => ({ k: 'kind', label: 'Gebäudeart', type: 'select', opts: Object.fromEntries(ALL_BUILDING_KINDS().map((k2) => [k2, KIND_NAMES[k2] || k2])) }),
    rot: { k: 'rotDeg', label: 'Drehung', min: 0, max: 359, step: 1, fmt: (v) => v + '°' },
    floors: { k: 'floors', label: 'Stockwerke', min: 1, max: 16, step: 1 },
    roadKind: { k: 'kind', label: 'Art', type: 'select', opts: ROAD_KINDS },
    bridgeKind: { k: 'kind', label: 'Art', type: 'select', opts: { bridge: 'Brücke', ford: 'Furt' } },
    team: { k: 'team', label: 'Team', type: 'seg', opts: { UA: 'Ukraine', RU: 'Russland' } },
    heading: { k: 'headDeg', label: 'Blickrichtung', min: 0, max: 359, step: 5, fmt: (v) => v + '° ' + ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'][Math.round(v / 45) % 8] },
    ai: { k: 'ai', label: 'Verhalten (KI)', type: 'select', opts: AI_MODES },
    target: { k: 'target', label: 'Zielobjekt (Ziel „Ziel-Einheiten zerstören")', type: 'check' },
    cpKind: { k: 'kind', label: 'Art', type: 'select', opts: CP_KINDS },
    cpName: { k: 'name', label: 'Name', type: 'text', max: 40 },
    cpValue: { k: 'value', label: 'Wert', min: 1, max: 5, step: 1 },
    cpR: { k: 'radius', label: 'Radius', min: 8, max: 40, step: 1, fmt: (v) => v + ' m' },
    minutes: { k: 'minutes', label: 'Dauer', min: 0.5, max: 30, step: 0.5, fmt: (v) => v + ' min' },
    shape: { k: 'shape', label: 'Form', type: 'seg', opts: { poly: 'Polygon', circle: 'Kreis' } },
  };
  function fieldsFor(kind, o) {
    if (kind === 'unit') return [F.team, F.heading, F.ai, F.target];
    if (kind === 'point') return [F.cpKind, F.cpName, F.cpValue, F.cpR];
    if (kind === 'zone') return [F.team, F.r(60, 8)];
    if (kind === 'hold') return [F.r(80, 8), F.minutes];
    switch (o.type) {
      case 'hill': return [F.r(), F.hset];
      case 'flat': return [F.r(), F.flatH];
      case 'water': return [F.depth(12)];
      case 'river': return [F.width(4, 60), F.depth(8)];
      case 'road': return [F.roadKind, F.width(2, 14)];
      case 'forest': return o.poly ? [F.forestKind, F.density] : [F.r(120), F.forestKind, F.density];
      case 'treeline': return [];
      case 'field': return [F.crop, F.angle];
      case 'village': return [F.style, F.r(90, 8), F.houses, F.set, F.urban];
      case 'building': return [F.kind(), F.rot, F.floors];
      case 'bridge': return [F.bridgeKind, F.width(3, 16)];
    }
    return [];
  }
  function toolFields(id) {
    switch (id) {
      case 'hill': return [F.r(), F.hill];
      case 'dip': return [F.r(), F.dip];
      case 'flat': return [F.r()];
      case 'water': return [F.depth(12)];
      case 'river': return [F.width(4, 60), F.depth(8)];
      case 'road': return [F.width(2, 14)];
      case 'track': case 'rail': return [F.width(2, 8)];
      case 'forest': return E.opts.forest.shape === 'circle' ? [F.shape, F.r(120), F.forestKind, F.density] : [F.shape, F.forestKind, F.density];
      case 'field': return [F.crop, F.angle];
      case 'village': return [F.style, F.r(90, 8), F.houses, F.set, F.urban];
      case 'building': return [F.kind(), F.rot];
      case 'bridge': case 'ford': return [F.width(3, 16)];
      case 'point': return [F.cpKind];
      case 'zone': return [F.team, F.r(60, 8)];
      case 'hold': return [F.r(80, 8), F.minutes];
    }
    return [];
  }
  // virtuelle Felder (Grad statt Bogenmaß)
  const getV = (o, k) => (k === 'rotDeg' ? Math.round(((o.rot || 0) * 180 / Math.PI % 360 + 360) % 360) : k === 'headDeg' ? deg(o.heading ?? (o.team === 'UA' ? Math.PI : 0)) : o[k]);
  function setV(o, k, v) {
    if (k === 'rotDeg') o.rot = Math.round((v * Math.PI / 180) * 100) / 100;
    else if (k === 'headDeg') o.heading = rad(v);
    else o[k] = v;
  }
  function renderPanel() {
    if (!ui.body || !E.doc) return;
    const s = E.sel;
    const o = findSel(s);
    let html = '';
    if (E.tool === 'select') {
      if (!o) {
        html = `<h3>Auswahl</h3><p class="ed-note">Element anklicken/antippen. Ziehen verschiebt, weiße Ecken einzeln ziehen, gelbe Griffe ändern Radius/Drehung.</p>` + summaryHtml();
      } else {
        html = `<h3>${escapeHtml(selName(s))}</h3>` + fieldsFor(s.kind, o).map((f) => fieldHtml(f, getV(o, f.k))).join('');
        if (s.kind === 'unit') html = `<h3>${iconForUnitType(UNIT_TYPES[o.type])} ${escapeHtml(selName(s))}</h3>` + fieldsFor(s.kind, o).map((f) => fieldHtml(f, getV(o, f.k))).join('');
        html += `<div class="ed-row"><button id="ed-del">${icon('trash')} Löschen</button>${s.kind === 'unit' ? `<button id="ed-dup">Kopieren</button>` : ''}</div>`;
      }
    } else if (E.tool === 'unit') {
      html = unitToolHtml();
    } else {
      const t = TOOL[E.tool];
      html = `<h3>${icon(t.ic)} ${t.name}</h3><p class="ed-note">${t.hint}</p>` + toolFields(E.tool).map((f) => fieldHtml(f, getV(E.opts[E.tool], f.k))).join('');
      const lp = findSel(E.lastPlaced);
      if (lp && E.lastPlaced) html += `<div class="ed-row"><button id="ed-del">${icon('trash')} Letztes löschen</button><button id="ed-tosel">Bearbeiten</button></div>`;
    }
    ui.body.innerHTML = html;
    bindPanel(o, s);
  }
  function summaryHtml() {
    const d = E.doc, cap = mapCapabilities(d);
    const n = (t) => d.elements.filter((e) => e.type === t).length;
    return `<div class="ed-sum"><b>${escapeHtml(d.meta.title)}</b><br>${d.map.size} m · ${SEASONS[d.map.season]}${d.map.night ? ' · Nacht' : ''} · ${ERAS[d.meta.era]}<br>
      ${d.elements.length} Geländeelemente (${n('road')} Wege, ${n('river') + n('water')} Gewässer, ${n('forest')} Wälder, ${n('village')} Siedlungen)<br>
      Einheiten: ${d.units.filter((u) => u.team === 'UA').length} Ukraine · ${d.units.filter((u) => u.team === 'RU').length} Russland<br>
      ${d.points.length} Eroberungspunkte · ${d.zones.length} Startzonen · Ziele: ${d.objectives.map((o) => escapeHtml(objectiveText(o))).join(', ') || '–'}<br>
      <span class="${cap.mission ? 'ok' : 'warn'}">Mission ${cap.mission ? 'spielbar' : 'unvollständig'}</span> · <span class="${cap.skirmish ? 'ok' : 'warn'}">Gefecht ${cap.skirmish ? 'spielbar' : 'unvollständig'}</span>
      ${cap.issues.length ? `<ul>${cap.issues.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>` : ''}</div>
      <p class="ed-note">Gelände-Neuaufbau: ${E.stats.lastRebuildMs} ms</p>`;
  }
  function unitToolHtml() {
    const o = E.opts.unit;
    const facs = eraFactions(o.era);
    if (o.faction !== 'all' && !facs.includes(o.faction)) o.faction = 'all';
    const list = unitPalette({ era: o.era, faction: o.faction }).filter((u) => !o.q || u.name.toLowerCase().includes(o.q.toLowerCase()) || u.key.includes(o.q.toLowerCase()));
    if (!UNIT_TYPES[o.type] || !list.some((u) => u.key === o.type)) o.type = list[0]?.key || o.type;
    const head = o.heading === null ? (o.team === 'UA' ? Math.PI : 0) : o.heading;
    return `<h3>${icon('tank')} Einheiten platzieren</h3>
      <div class="sk-field"><span>Team</span><div class="seg" data-k="team">${['UA', 'RU'].map((t) => `<button data-v="${t}" class="${o.team === t ? 'active' : ''}">${t === 'UA' ? 'Ukraine' : 'Russland'}</button>`).join('')}</div></div>
      <label>Epoche <select data-k="era"><option value="all">Alle</option>${Object.entries(ERAS).map(([k2, t]) => `<option value="${k2}"${o.era === k2 ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
      <label>Fraktion <select data-k="faction"><option value="all">Alle</option>${facs.map((f) => `<option value="${f}"${o.faction === f ? ' selected' : ''}>${FACTION_NAMES[f] || f}</option>`).join('')}</select></label>
      <label>Suche <input type="text" data-k="q" value="${escapeHtml(o.q)}" placeholder="Name …" maxlength="30"></label>
      <div class="ed-units" role="listbox">${list.map((u) => `<button data-unit="${u.key}" class="${u.key === o.type ? 'active' : ''}" title="${escapeHtml(u.name)} (${FACTION_NAMES[u.faction] || u.faction})">${iconForUnitType(UNIT_TYPES[u.key])}<span>${escapeHtml(u.name)}</span></button>`).join('') || '<p class="ed-note">Keine Einheiten für diesen Filter.</p>'}</div>
      ${fieldHtml(F.heading, deg(head))}${fieldHtml(F.ai, o.ai)}${fieldHtml(F.target, o.target)}
      <p class="ed-note">${list.length} Typen · Verhalten gilt für KI-Einheiten (Gegner des Spielerteams). R dreht.</p>
      ${E.lastPlaced && findSel(E.lastPlaced) ? `<div class="ed-row"><button id="ed-del">${icon('trash')} Letzte löschen</button><button id="ed-tosel">Bearbeiten</button></div>` : ''}`;
  }
  function bindPanel(o, s) {
    const body = ui.body;
    const isTool = E.tool !== 'select';
    const target = isTool ? E.opts[E.tool] : o;
    let undoArmed = false;
    const apply = (k, v, final) => {
      if (!target) return;
      if (!isTool && !undoArmed) { pushUndo(); undoArmed = true; }
      if (isTool && E.tool === 'unit' && k === 'team' && !E.sel) target.heading = null;
      if (isTool && k === 'era') E._eraTouched = true;
      setV(target, k, v);
      if (k === 'kind' && !isTool && o?.type === 'building') { const dd = buildingDims(v); o.w = dd.w; o.d = dd.d; o.floors = dd.floors; }
      if (k === 'kind' && !isTool && s?.kind === 'point') { o.radius = CP_DEFAULT_R[v]; if (Object.values(CP_KINDS).some((n) => o.name.startsWith(n))) o.name = uniqueName(CP_KINDS[v]); }
      const val = body.querySelector(`.ed-val[data-for="${k}"]`);
      const f = Object.values(F).map((x) => (typeof x === 'function' ? x() : x)).find((x) => x.k === k);
      if (val) val.textContent = f?.fmt ? f.fmt(v) : v;
      if (final) {
        undoArmed = false;
        if (!isTool) commit(); else if (['era', 'faction', 'q', 'shape', 'team'].includes(k)) renderPanel();
        if (isTool && E.tool === 'unit' && k === 'team') renderPanel();
      }
    };
    body.querySelectorAll('input[type=range]').forEach((el) => {
      el.addEventListener('input', () => apply(el.dataset.k, +el.value, false));
      el.addEventListener('change', () => apply(el.dataset.k, +el.value, true));
    });
    body.querySelectorAll('select').forEach((el) => el.addEventListener('change', () => apply(el.dataset.k, el.value, true)));
    body.querySelectorAll('input[type=checkbox]').forEach((el) => el.addEventListener('change', () => apply(el.dataset.k, el.checked, true)));
    body.querySelectorAll('input[type=text]').forEach((el) => {
      if (el.dataset.k === 'q') { el.addEventListener('input', () => { E.opts.unit.q = el.value; const pos = el.selectionStart; renderPanel(); const n = ui.body.querySelector('input[data-k="q"]'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }); return; }
      el.addEventListener('change', () => apply(el.dataset.k, el.value.trim(), true));
    });
    body.querySelectorAll('.seg[data-k]').forEach((seg) => seg.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; apply(seg.dataset.k, b.dataset.v, true); seg.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b)); }));
    body.querySelectorAll('[data-unit]').forEach((b) => b.addEventListener('click', () => { E.opts.unit.type = b.dataset.unit; body.querySelectorAll('[data-unit]').forEach((x) => x.classList.toggle('active', x === b)); }));
    const del = body.querySelector('#ed-del'); if (del) del.onclick = () => { if (!E.sel && E.lastPlaced) { E.sel = E.lastPlaced; deleteSel(); } else deleteSel(); };
    const tosel = body.querySelector('#ed-tosel'); if (tosel) tosel.onclick = () => { const lp = E.lastPlaced; setTool('select'); select(lp); };
    const dup = body.querySelector('#ed-dup'); if (dup) dup.onclick = () => { const u = findSel(E.sel); if (!u) return; pushUndo(); const c = { ...u, id: newId('u'), x: clampXZ(u.x + 4, u.z)[0] }; E.doc.units.push(c); E.sel = { kind: 'unit', id: c.id }; commit(); };
  }

  // ================= Dialoge =================
  function openModal(html, bind) {
    ui.modalPanel.innerHTML = html;
    ui.modal.classList.remove('hidden');
    ui.modalPanel.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => closeModal()));
    bind?.(ui.modalPanel);
  }
  function closeModal() { if (ui.modal) ui.modal.classList.add('hidden'); }
  function openMapDialog() {
    const d = E.doc;
    openModal(`<h2>Karte</h2>
      <label>Kartengröße <select id="edm-size">${MAP_SIZE_OPTIONS.map((s) => `<option value="${s}"${s === d.map.size ? ' selected' : ''}>${s} × ${s} m</option>`).join('')}</select></label>
      <label>Epoche <select id="edm-era">${Object.entries(ERAS).map(([k, t]) => `<option value="${k}"${k === d.meta.era ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
      <label>Jahreszeit <select id="edm-season">${Object.entries(SEASONS).map(([k, t]) => `<option value="${k}"${k === d.map.season ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
      <label class="check"><input type="checkbox" id="edm-night"${d.map.night ? ' checked' : ''}> Nacht</label>
      <label>Grundrelief <span class="ed-val" id="edm-relief-v">${d.map.relief}</span><input type="range" id="edm-relief" min="0" max="14" step="0.5" value="${d.map.relief}"></label>
      <label>Einzelbäume <span class="ed-val" id="edm-trees-v">${d.map.scatterTrees}</span><input type="range" id="edm-trees" min="0" max="300" step="5" value="${d.map.scatterTrees}"></label>
      <label>Seed (Gelände-Zufall) <span class="seedrow"><input type="number" id="edm-seed" min="1" max="999999" value="${d.map.seed}"><button id="edm-reroll" title="Neuer Zufallsseed">${icon('dice')}</button></span></label>
      <p class="note">Beim Verkleinern werden Elemente außerhalb an den Rand verschoben.</p>
      <div class="row"><button data-close>Abbrechen</button><button id="edm-ok" class="big">Übernehmen</button></div>`, (p) => {
      p.querySelector('#edm-relief').oninput = (e) => (p.querySelector('#edm-relief-v').textContent = e.target.value);
      p.querySelector('#edm-trees').oninput = (e) => (p.querySelector('#edm-trees-v').textContent = e.target.value);
      p.querySelector('#edm-reroll').onclick = () => (p.querySelector('#edm-seed').value = Math.floor(Math.random() * 99999) + 1);
      p.querySelector('#edm-ok').onclick = () => {
        pushUndo();
        const era = p.querySelector('#edm-era').value;
        if (era !== d.meta.era) { E.opts.unit.era = era; E.opts.village.set = ERA_SET[era]; E._eraTouched = false; }
        d.meta.era = era;
        d.map.size = +p.querySelector('#edm-size').value;
        d.map.season = p.querySelector('#edm-season').value;
        d.map.night = p.querySelector('#edm-night').checked;
        d.map.relief = +p.querySelector('#edm-relief').value;
        d.map.scatterTrees = +p.querySelector('#edm-trees').value;
        d.map.seed = Math.max(1, Math.min(999999, Math.floor(+p.querySelector('#edm-seed').value) || 1));
        E.doc = sanitizeMap(d).map; // klemmt Koordinaten auf die neue Größe
        closeModal();
        commit({ immediate: true });
      };
    });
  }
  function openMissionDialog() {
    const d = E.doc;
    const has = (k) => d.objectives.find((o) => o.kind === k);
    const holds = d.objectives.filter((o) => o.kind === 'hold');
    const cap = mapCapabilities(d);
    openModal(`<h2>Mission</h2>
      <label>Titel <input type="text" id="edq-title" maxlength="80" value="${escapeHtml(d.meta.title)}"></label>
      <label>Autor <input type="text" id="edq-author" maxlength="60" value="${escapeHtml(d.meta.author)}"></label>
      <label>Kurzbeschreibung <input type="text" id="edq-desc" maxlength="600" value="${escapeHtml(d.meta.description)}"></label>
      <div class="sk-field"><span>Spielerteam</span><div class="seg" id="edq-player"><button data-v="UA" class="${d.player === 'UA' ? 'active' : ''}">Ukraine</button><button data-v="RU" class="${d.player === 'RU' ? 'active' : ''}">Russland</button></div></div>
      <h3>Einsatzziele</h3>
      <label class="check"><input type="checkbox" id="edq-ann"${has('annihilate') ? ' checked' : ''}> Alle Feinde vernichten</label>
      <label class="check"><input type="checkbox" id="edq-des"${has('destroy') ? ' checked' : ''}> Ziel-Einheiten zerstören <span class="muted">(${d.units.filter((u) => u.target && u.team !== d.player).length} markiert – Einheit wählen, „Zielobjekt")</span></label>
      <label class="check"><input type="checkbox" id="edq-time"${has('timelimit') ? ' checked' : ''}> Zeitlimit <input type="number" id="edq-tmin" min="1" max="180" value="${has('timelimit')?.minutes || 20}" style="width:5em"> min</label>
      <div class="ed-holds">${holds.length ? holds.map((o) => `<div>Gebiet halten bei (${Math.round(o.x)}, ${Math.round(o.z)}): <input type="number" data-hold="${o.id}" min="0.5" max="60" step="0.5" value="${o.minutes}" style="width:5em"> min <button data-delhold="${o.id}">${icon('trash')}</button></div>`).join('') : '<span class="muted">Gebiet halten: mit dem Werkzeug „Zielgebiet" auf der Karte platzieren.</span>'}</div>
      <p class="note">Ohne aktive Ziele gilt „Alle Feinde vernichten". Zeitlimit allein = so lange durchhalten; zusammen mit anderen Zielen = danach gescheitert.</p>
      <h3>Briefing</h3>
      <textarea id="edq-brief" rows="6" maxlength="4000" placeholder="Lagebeschreibung für den Spieler …">${escapeHtml(d.briefing)}</textarea>
      ${cap.issues.length ? `<ul class="warn">${cap.issues.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>` : ''}
      <div class="row"><button data-close>Abbrechen</button><button id="edq-ok" class="big">Übernehmen</button></div>`, (p) => {
      let player = d.player;
      p.querySelector('#edq-player').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; player = b.dataset.v; p.querySelectorAll('#edq-player button').forEach((x) => x.classList.toggle('active', x === b)); };
      const delHold = new Set();
      p.querySelectorAll('[data-delhold]').forEach((b) => (b.onclick = () => { delHold.add(b.dataset.delhold); b.parentElement.remove(); }));
      p.querySelector('#edq-ok').onclick = () => {
        pushUndo();
        d.meta.title = p.querySelector('#edq-title').value.trim() || 'Ohne Titel';
        d.meta.author = p.querySelector('#edq-author').value.trim();
        d.meta.description = p.querySelector('#edq-desc').value;
        d.briefing = p.querySelector('#edq-brief').value;
        d.player = player;
        const objs = [];
        const keep = (k) => d.objectives.find((o) => o.kind === k);
        if (p.querySelector('#edq-ann').checked) objs.push(keep('annihilate') || { id: newId('o'), kind: 'annihilate' });
        if (p.querySelector('#edq-des').checked) objs.push(keep('destroy') || { id: newId('o'), kind: 'destroy' });
        for (const o of d.objectives) if (o.kind === 'hold' && !delHold.has(o.id)) { const inp = p.querySelector(`[data-hold="${o.id}"]`); if (inp) o.minutes = Math.max(0.5, Math.min(60, +inp.value || o.minutes)); objs.push(o); }
        if (p.querySelector('#edq-time').checked) { const t = keep('timelimit') || { id: newId('o'), kind: 'timelimit' }; t.minutes = Math.max(1, Math.min(180, +p.querySelector('#edq-tmin').value || 20)); objs.push(t); }
        d.objectives = objs;
        E.doc = sanitizeMap(d).map;
        closeModal();
        commit();
      };
    });
  }
  function openFileDialog(tab = 'save') {
    const slots = listSlots();
    const json = exportMap(E.doc);
    openModal(`<h2>Datei</h2>
      <div class="seg ed-tabs" id="edf-tabs"><button data-t="save">Speichern/Laden</button><button data-t="export">Export</button><button data-t="import">Import</button><button data-t="new">Neu</button></div>
      <div data-pane="save">
        <label>Name <span class="seedrow"><input type="text" id="edf-name" maxlength="40" value="${escapeHtml(E.slotName || E.doc.meta.title)}"><button id="edf-save" class="big">${icon('save')} Speichern</button></span></label>
        <div class="ed-slots">${slots.length ? slots.map((s) => `<div class="ed-slot"><div><b>${escapeHtml(s.name)}</b><br><span class="muted">${escapeHtml(s.title)} · ${s.units} Einheiten · ${escapeHtml(s.modified.replace('T', ' '))}</span></div><button data-load="${escapeHtml(s.name)}">Laden</button><button data-del="${escapeHtml(s.name)}" title="Löschen">${icon('trash')}</button></div>`).join('') : '<p class="muted">Noch keine gespeicherten Karten.</p>'}</div>
        <p class="note">Gespeichert wird im Browser (localStorage). Gespeicherte Karten erscheinen unter „Mods &amp; eigene Karten" und im Gefecht.</p>
      </div>
      <div data-pane="export">
        <textarea id="edf-json" rows="10" readonly spellcheck="false">${escapeHtml(json)}</textarea>
        <div class="row"><button id="edf-copy">${icon('copy')} In Zwischenablage kopieren</button><button id="edf-dl">${icon('download')} Als Datei herunterladen</button></div>
        <p class="note" id="edf-exp-note">${(json.length / 1024).toFixed(1)} KB · Format „steppensturm-karte" Version ${E.doc.version}${window.__ARTIFACT ? ' · Im Artifact sind Downloads gesperrt – bitte „Kopieren" nutzen.' : ''}</p>
      </div>
      <div data-pane="import">
        <label>Datei wählen <input type="file" id="edf-file" accept=".json,application/json,text/plain"></label>
        <textarea id="edf-paste" rows="8" spellcheck="false" placeholder="Oder JSON hier einfügen …"></textarea>
        <div class="row"><span class="muted" id="edf-imp-msg"></span><button id="edf-import" class="big">${icon('upload')} Importieren</button></div>
      </div>
      <div data-pane="new">
        <p>Neue, leere Karte beginnen? Die aktuelle Karte bleibt in der automatischen Sicherung, bis du sie überschreibst – vorher speichern!</p>
        <label>Größe <select id="edf-nsize">${MAP_SIZE_OPTIONS.map((s) => `<option value="${s}"${s === 260 ? ' selected' : ''}>${s} m</option>`).join('')}</select></label>
        <label>Epoche <select id="edf-nera">${Object.entries(ERAS).map(([k, t]) => `<option value="${k}"${k === E.doc.meta.era ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
        <div class="row"><span></span><button id="edf-new" class="big">Neue Karte</button></div>
      </div>
      <p id="edf-msg" class="ed-msg"></p>
      <div class="row"><span></span><button data-close>Schließen</button></div>`, (p) => {
      const msg = (t, ok = true) => { const m = p.querySelector('#edf-msg'); m.textContent = t; m.className = 'ed-msg ' + (ok ? 'ok' : 'warn'); };
      const setTab = (t) => { p.querySelectorAll('#edf-tabs button').forEach((b) => b.classList.toggle('active', b.dataset.t === t)); p.querySelectorAll('[data-pane]').forEach((d) => d.classList.toggle('hidden', d.dataset.pane !== t)); };
      p.querySelector('#edf-tabs').onclick = (e) => { const b = e.target.closest('button'); if (b) setTab(b.dataset.t); };
      setTab(tab);
      p.querySelector('#edf-save').onclick = () => {
        const name = p.querySelector('#edf-name').value.trim() || E.doc.meta.title;
        const r = saveSlot(name, E.doc);
        if (r.ok) { E.slotName = r.name; msg(`Gespeichert als „${r.name}".`); setTimeout(() => openFileDialog('save'), 600); } else msg(r.error, false);
      };
      p.querySelectorAll('[data-load]').forEach((b) => (b.onclick = () => {
        const doc = loadSlot(b.dataset.load);
        if (!doc) { msg('Speicherplatz konnte nicht gelesen werden.', false); return; }
        pushUndo(); E.doc = doc; E.slotName = b.dataset.load; E.sel = null; E.lastPlaced = null; closeModal(); commit({ immediate: true, touch: false });
      }));
      p.querySelectorAll('[data-del]').forEach((b) => (b.onclick = () => {
        if (!b.dataset.armed) { b.dataset.armed = '1'; b.innerHTML = 'Sicher?'; setTimeout(() => { delete b.dataset.armed; b.innerHTML = icon('trash'); }, 3000); return; }
        const r = deleteSlot(b.dataset.del); if (r.ok) openFileDialog('save'); else msg(r.error, false);
      }));
      p.querySelector('#edf-copy').onclick = async () => { const ok = await copyText(json, p.querySelector('#edf-json')); msg(ok ? 'In die Zwischenablage kopiert.' : 'Kopieren nicht möglich – Text ist markiert, bitte mit Strg+C / „Kopieren" übernehmen.', ok); };
      p.querySelector('#edf-dl').onclick = () => { const ok = downloadText(json, fileName(E.doc.meta.title) + '.json'); msg(ok ? 'Download gestartet.' : 'Download nicht möglich – bitte „Kopieren" nutzen.', ok); };
      p.querySelector('#edf-file').onchange = (e) => {
        const f = e.target.files?.[0]; if (!f) return;
        if (f.size > 2 * 1024 * 1024) { msg('Datei zu groß (max. 2 MB).', false); return; }
        const rd = new FileReader();
        rd.onload = () => { p.querySelector('#edf-paste').value = String(rd.result || ''); p.querySelector('#edf-imp-msg').textContent = f.name + ' geladen – „Importieren" drücken.'; };
        rd.onerror = () => msg('Datei konnte nicht gelesen werden.', false);
        rd.readAsText(f);
      };
      p.querySelector('#edf-import').onclick = () => {
        const r = importText(p.querySelector('#edf-paste').value);
        if (!r.ok) { msg(r.errors.join(' '), false); return; }
        closeModal();
        if (r.warnings.length) setStatusFlash('Importiert mit Hinweisen: ' + r.warnings.slice(0, 2).join(' '));
      };
      p.querySelector('#edf-new').onclick = () => {
        pushUndo();
        E.doc = newMap({ size: +p.querySelector('#edf-nsize').value, era: p.querySelector('#edf-nera').value });
        E.opts.unit.era = E.doc.meta.era; E.opts.village.set = ERA_SET[E.doc.meta.era];
        E.sel = null; E.lastPlaced = null; E.slotName = null; closeModal(); commit({ immediate: true });
      };
    });
  }
  function importText(text) {
    const r = sanitizeMap(String(text || '').trim(), { source: 'Import' });
    if (!r.ok) return r;
    pushUndo();
    E.doc = r.map; E.sel = null; E.lastPlaced = null;
    E.opts.unit.era = E.doc.meta.era; E.opts.village.set = ERA_SET[E.doc.meta.era];
    commit({ immediate: true, touch: false });
    return r;
  }
  const fileName = (t) => (String(t).normalize('NFKD').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'karte');

  // ================= Testspielen =================
  function play() {
    flushAutosave();
    const cap = mapCapabilities(E.doc);
    if (!cap.mission) { setStatusFlash('Zum Testspielen Einheiten für beide Teams platzieren.'); return false; }
    if (E.draw) finishDraw();
    E.returnCam = camState();
    const m = compileMission(E.doc, { fromEditor: true });
    close();
    ctx.playMission(m);
    return true;
  }

  return {
    get active() { return E.active; },
    get doc() { return E.doc; },
    get state() { return E; },
    open, close, update, play, exit,
    setTool, stamp: (x, z) => { stamp({ x, z }); }, addPoint: (x, z) => addDrawPoint({ x, z }), finishDraw, cancelDraw,
    undo: doUndo, redo: doRedo, select, deleteSel, importText, exportText: () => exportMap(E.doc),
    setDoc: (d) => { const r = sanitizeMap(d); if (r.ok) { pushUndo(); E.doc = r.map; commit({ immediate: true }); } return r; },
    openFileDialog, openMapDialog, openMissionDialog, closeModal, flushRebuild: () => { if (E.rebuildT) { clearTimeout(E.rebuildT); rebuild(null, true); } },
    rotateSel, project: (x, z) => proj(x, z), hitTest,
    get returnCam() { return E.returnCam; },
  };
}

// ---------- Zwischenablage / Download (mit Rückfall) ----------
export async function copyText(text, ta = null) {
  try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; } } catch (e) { /* Rückfall */ }
  try {
    const el = ta || document.createElement('textarea');
    if (!ta) { el.value = text; el.style.position = 'fixed'; el.style.opacity = '0'; document.body.appendChild(el); }
    el.focus(); el.select();
    const ok = document.execCommand && document.execCommand('copy');
    if (!ta) el.remove();
    return !!ok;
  } catch (e) { return false; }
}
export function downloadText(text, name) {
  try {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = name; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  } catch (e) { return false; }
}
