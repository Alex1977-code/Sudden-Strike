// Wiederholungen (V3-RS): Aufzeichnung, Ablage, Datei-Export/-Import und deterministische Wiedergabe.
//
// Grundlage ist das Protokoll von savegame.js (SimRecorder = game.recorder): Seed + quantisiertes dt (1/240 s, lauflängen-
// kodiert) + Spielerkommandos mit Schrittindex. Eine Wiederholung ist ein vollständiger rec.serialize() am Partieende (inkl.
// Prüf-Snapshot des Endzustands) plus Metadaten und Ereignismarken (Verluste, Ziele) für die Zeitleiste.
//
//   new ReplayMarks(game)               – sammelt live Ereignismarken [zeit, art, …] (auch beim Vorspulen eines Spielstands)
//   buildReplay(game, rec, marks, meta) – Wiederholungsobjekt { v, kind:'ssreplay', meta, save, marks, players }
//   ReplayStore                         – letzte 10 Wiederholungen (IndexedDB, sonst localStorage; alles mit try/catch)
//   encodeReplayFile(data) / decodeReplayFile(arrayBuffer) – .ssreplay (gzip-komprimiertes JSON, ohne CompressionStream
//                                         unkomprimiert; beim Import wird beides erkannt)
//   new ReplayDriver(game, rec, data, hooks) – Wiedergabe: game.update ruft driver.frame(dt) (Hook in game.js);
//                                         Pause, Tempo 0,5–8×, Springen (vorwärts: weiter simulieren; rückwärts: Mission neu
//                                         laden und ohne Rendern bis zur Zielzeit simulieren), Sicht Team UA/RU/alles.
// Online (Host): Kommandos fremder Spieler stehen als [schritt, cmd, pid] im Protokoll; Sonderkommando {t:'__left'} = Spieler
//   hat das Spiel verlassen (KI-Übernahme bzw. im Koop Übergabe an den Host) – siehe applyLeave().
// Zwischen-Checkpoints gibt es nicht: Missionsskripte halten Closures (Timer, onArrive …), die sich nicht als Zustand sichern
// lassen – Zurückspulen simuliert deshalb ab dem Start neu (ohne Rendern, mit Fortschrittsanzeige).
import { Effects } from '../engine/effects.js';
import { fowUniforms } from '../engine/fow.js';
import { AICommander } from '../skirmish/ai.js';

export const REPLAY_VERSION = 1;
export const REPLAY_MAX = 10;
const Q = 240;
const r1 = (v) => Math.round(v * 10) / 10;

// ================= Ereignismarken (live) =================
export class ReplayMarks {
  constructor(game) {
    this.g = game; this.list = []; this.obj = new Map();
    game.on('loaded', () => { this.list = []; this.obj = new Map(); for (const o of game.objectives || []) this.obj.set(o.id, o.state); });
    game.on('kill', (u, killer, silent) => {
      if (game.replayDriver || game.demo || !u || u.side === 'N' || u.type?.cp || u.type?.key === 'house') return;
      if (this.list.length < 4000) this.list.push([r1(game.time), 'k', u.side, u.type?.vehicle || u.type?.air ? 1 : 0]);
    });
    game.on('objectives', () => {
      if (game.replayDriver || game.demo) return;
      for (const o of game.objectives || []) {
        const prev = this.obj.get(o.id);
        if (prev !== o.state && (o.state === 'done' || o.state === 'failed') && prev !== undefined) this.list.push([r1(game.time), 'o', o.state, String(o.text || '').slice(0, 80), o.optional ? 1 : 0]);
        this.obj.set(o.id, o.state);
      }
    });
  }
}

// ================= Wiederholung bauen =================
export function buildReplay(game, rec, marks, meta = {}) {
  const save = rec.serialize();
  return {
    v: REPLAY_VERSION, kind: 'ssreplay',
    meta: { date: new Date().toISOString(), dur: r1(game.time), steps: save.n, ...meta },
    save,
    marks: (marks?.list || []).slice(),
    players: game.players.map((p) => [p.id, p.name, p.team, p.color, p.ai ? 1 : 0]),
    local: game.localPlayerId,
  };
}
export function replayValid(d) { return !!d && d.kind === 'ssreplay' && d.v === REPLAY_VERSION && d.save && d.save.ctx && typeof d.save.d === 'string'; }

// ================= Ablage: localStorage, Ausweichablage IndexedDB =================
const DB_NAME = 'steppensturm-replays', DB_STORE = 'replays';
const LS_IDX = 'steppensturm.replays.v1', LS_KEY = (id) => 'steppensturm.replay.v1.' + id;
function idbOpen() {
  return new Promise((res, rej) => {
    try {
      if (typeof indexedDB === 'undefined') return rej(new Error('kein IndexedDB'));
      const rq = indexedDB.open(DB_NAME, 1);
      rq.onupgradeneeded = () => { try { rq.result.createObjectStore(DB_STORE, { keyPath: 'id' }); } catch (e) { /* vorhanden */ } };
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error || new Error('IndexedDB'));
      rq.onblocked = () => rej(new Error('IndexedDB blockiert'));
    } catch (e) { rej(e); }
  });
}
function idbDo(mode, fn) {
  return idbOpen().then((db) => new Promise((res, rej) => {
    let out;
    try {
      const tx = db.transaction(DB_STORE, mode), st = tx.objectStore(DB_STORE);
      const rq = fn(st);
      if (rq) rq.onsuccess = () => { out = rq.result; };
      tx.oncomplete = () => { db.close(); res(out); };
      tx.onerror = tx.onabort = () => { db.close(); rej(tx.error || new Error('IndexedDB-Fehler')); };
    } catch (e) { try { db.close(); } catch (e2) { /* */ } rej(e); }
  }));
}
function lsIdx() { try { return JSON.parse(localStorage.getItem(LS_IDX) || '[]') || []; } catch (e) { return []; } }
function lsSetIdx(a) { try { localStorage.setItem(LS_IDX, JSON.stringify(a)); } catch (e) { /* voll */ } }

// Primär localStorage (schnell, synchron); passt eine Wiederholung dort nicht mehr hinein, landet sie in IndexedDB
// (in Headless-/ausgelasteten Umgebungen öffnet IndexedDB teils erst nach Sekunden – deshalb nur als Ausweichablage).
const LS_IDB = 'steppensturm.replays.idb';
const idbUsed = () => { try { return localStorage.getItem(LS_IDB) === '1'; } catch (e) { return false; } };
export class ReplayStore {
  async _idbList() {
    if (!idbUsed()) return [];
    try { const all = (await idbDo('readonly', (st) => st.getAll())) || []; return all.map((r) => ({ id: r.id, ...r.data.meta, size: r.size || 0, idb: 1 })); }
    catch (e) { console.warn('[replay] IndexedDB-Liste', e); return []; }
  }
  async list() {
    const a = lsIdx(), b = await this._idbList();
    const seen = new Set(a.map((m) => m.id));
    return [...a, ...b.filter((m) => !seen.has(m.id))].sort((x, y) => String(y.date).localeCompare(String(x.date)));
  }
  async get(id) {
    try { const raw = localStorage.getItem(LS_KEY(id)); if (raw) return JSON.parse(raw); } catch (e) { /* weiter mit IndexedDB */ }
    if (!idbUsed()) return null;
    try { const r = await idbDo('readonly', (st) => st.get(id)); return r ? r.data : null; } catch (e) { console.warn('[replay] Lesen', e); return null; }
  }
  async put(data) {
    const id = data.meta?.id || ('r' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36));
    data.meta = { ...(data.meta || {}), id };
    let s = '';
    try { s = JSON.stringify(data); } catch (e) { return null; }
    const size = s.length;
    // zuerst Platz schaffen (höchstens REPLAY_MAX insgesamt)
    const all = await this.list();
    for (const m of all.filter((m) => m.id !== id).slice(REPLAY_MAX - 1)) await this.del(m.id);
    const idx = lsIdx().filter((m) => m.id !== id);
    try {
      localStorage.setItem(LS_KEY(id), s);
      localStorage.setItem(LS_IDX, JSON.stringify([...idx, { id, ...data.meta, size }]));
      return id;
    } catch (e) {
      try { localStorage.removeItem(LS_KEY(id)); } catch (e2) { /* */ }
    }
    try { // localStorage voll → IndexedDB
      await idbDo('readwrite', (st) => st.put({ id, data, size }));
      try { localStorage.setItem(LS_IDB, '1'); } catch (e) { /* */ }
      return id;
    } catch (e) { console.warn('[replay] Speichern fehlgeschlagen', e); return null; }
  }
  async del(id) {
    try { localStorage.removeItem(LS_KEY(id)); } catch (e) { /* */ }
    lsSetIdx(lsIdx().filter((m) => m.id !== id));
    if (idbUsed()) { try { await idbDo('readwrite', (st) => st.delete(id)); } catch (e) { /* */ } }
  }
  async prune(max = REPLAY_MAX) { const l = await this.list(); for (const m of l.slice(max)) await this.del(m.id); }
}

// ================= Datei (.ssreplay) =================
export async function encodeReplayFile(data) {
  const json = JSON.stringify(data);
  if (typeof CompressionStream === 'function') {
    try {
      const cs = new Blob([json], { type: 'application/json' }).stream().pipeThrough(new CompressionStream('gzip'));
      const buf = await new Response(cs).arrayBuffer();
      return new Blob([buf], { type: 'application/gzip' });
    } catch (e) { /* unkomprimiert */ }
  }
  return new Blob([json], { type: 'application/json' });
}
export async function decodeReplayFile(buf) {
  const b = new Uint8Array(buf);
  let text;
  if (b.length > 2 && b[0] === 0x1f && b[1] === 0x8b) {
    if (typeof DecompressionStream !== 'function') throw new Error('Komprimierte Datei – dieser Browser kann sie nicht entpacken.');
    const ds = new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'));
    text = await new Response(ds).text();
  } else text = new TextDecoder().decode(b);
  let d;
  try { d = JSON.parse(text); } catch (e) { throw new Error('Keine gültige Wiederholungsdatei.'); }
  if (!replayValid(d)) throw new Error('Keine gültige Wiederholungsdatei (Version?).');
  return d;
}
export function replayFileName(d) {
  const t = String(d.meta?.title || 'partie').toLowerCase().replace(/[äöüß]/g, (c) => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }[c])).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'partie';
  const dt = String(d.meta?.date || new Date().toISOString()).slice(0, 16).replace(/[T:]/g, '-');
  return `steppensturm-${t}-${dt}.ssreplay`;
}

// ================= Spieler verlässt das Online-Spiel (Host und Wiedergabe identisch) =================
// coop: Einheiten gehen an den ersten verbliebenen Menschen des Teams; sonst übernimmt (im Gefecht) die KI.
export function applyLeave(g, pid, { name = '', difficulty = 'normal' } = {}) {
  const p = g.playerById(pid);
  if (!p) return null;
  p.remote = false;
  if (g.coop) {
    const to = g.coop.humans.map((id) => g.playerById(id)).find((q) => q && q !== p);
    if (to) for (const u of g.units) if (u.owner === p.id) u.owner = to.id;
    return 'coop';
  }
  p.ai = true;
  if (name) p.name = `${name} (KI)`;
  const sk = g.mission?.skirmish;
  if (sk && !p.defeated) { sk.ais.push(new AICommander(g, sk, p, { difficulty, phase: 0.3 })); return 'ai'; }
  return 'idle';
}

// ================= Wiedergabe =================
export class ReplayDriver {
  /**
   * hooks: { load(data) → Promise<bool> (Mission mit data.save.seed über rec.runLoad laden), onProgress(f, text), onDone(),
   *          onEnd(), volume() → Standardlautstärke }
   */
  constructor(game, rec, data, hooks = {}) {
    this.g = game; this.rec = rec; this.data = data; this.hooks = hooks;
    const s = data.save;
    this.runs = String(s.d || '').split(',').filter(Boolean).map((x) => { const [q, n] = x.split('*'); return [+q, n ? +n : 1]; });
    this.cmds = s.c || [];
    this.sm = s.sm || 1;
    this.total = 0; for (const r of this.runs) this.total += r[1];
    // Zeit nach Schritt i (wie game.time beim Spielen aufsummiert)
    this.cum = new Float64Array(this.total + 1);
    let t = 0, i = 0;
    for (const [q, n] of this.runs) { const sdt = (q / Q) * this.sm; for (let k = 0; k < n; k++) { t += sdt; this.cum[++i] = t; } }
    this.duration = t;
    this.speed = 1; this.paused = false; this.view = 'auto'; this.follow = null;
    this.busy = true; this.atEnd = false; this.budget = 0;
    this._resetPtr();
  }
  _resetPtr() { this.step = 0; this.ci = 0; this.ri = 0; this.rk = 0; this.atEnd = false; this.budget = 0; }
  get time() { return this.g.time; }
  timeOfStep(s) { return this.cum[Math.max(0, Math.min(this.total, s | 0))]; }
  stepOfTime(t) {
    let lo = 0, hi = this.total;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (this.cum[m] <= t + 1e-9) lo = m; else hi = m - 1; }
    return lo;
  }
  // ---- Laden/Neustart ----
  async start() {
    const g = this.g;
    g.replayDriver = this; g.replaying = true;
    const ok = await this._reload();
    if (!ok) { this.stop(); return false; }
    return true;
  }
  async _reload() {
    const g = this.g;
    this.busy = true;
    g.replayDriver = this;
    let ok = false;
    try { ok = await this.hooks.load(this.data); } catch (e) { console.error('[replay] Laden', e); ok = false; }
    g.replayDriver = this; g.replaying = true; g.paused = false;
    this.rec.replaying = false;
    this._resetPtr();
    this._viewMod = false;
    this.busy = false;
    return ok && g.active;
  }
  stop() {
    const g = this.g;
    if (g.replayDriver === this) g.replayDriver = null;
    g.replaying = false;
    this.rec.replaying = false; this.rec.on = false; this.rec.ctx = null;
    try { if (g.fow) { fowUniforms.uFowTex.value = g.fow.tex; fowUniforms.uFowEnabled.value = g.fow.enabled ? 1 : 0; } } catch (e) { /* */ }
    this.stopped = true;
  }
  // ---- ein Simulationsschritt (identisch zu SimRecorder.replay) ----
  _applyCmds() {
    const g = this.g, cmds = this.cmds;
    while (this.ci < cmds.length && cmds[this.ci][0] <= this.step) {
      const [, c, pid] = cmds[this.ci++];
      try {
        if (c && c.t === '__left') this.rec.sim(() => applyLeave(g, pid, c));
        else this.rec.sim(() => g.command(pid ?? g.localPlayerId, c));
      } catch (e) { console.warn('[replay] Kommando', e); }
    }
  }
  _stepOnce() {
    const g = this.g, R = this.rec;
    const q = this.runs[this.ri][0], edt = q / Q, sdt = edt * this.sm;
    this._applyCmds();
    g.frame = (g.frame || 0) + 1;
    R.enter();
    try { g.time += sdt; g.weather?.update(sdt); g.stepSim(sdt); } finally { R.exit(); }
    R._patchAir();
    if (g.air && g.air._fx === g.effects) g.air.update(edt * this.sm);
    this.step++;
    if (++this.rk >= this.runs[this.ri][1]) { this.ri++; this.rk = 0; }
    if (this.step >= this.total) { this._applyCmds(); }
    return edt;
  }
  _nextEdt() { return this.ri < this.runs.length ? this.runs[this.ri][0] / Q : Infinity; }
  // ---- pro Frame (aus game.update) ----
  frame(dt) {
    const g = this.g;
    if (this.busy || !g.active) return;
    let vis = 0;
    if (!this.paused && !this.atEnd) {
      this.budget = Math.min(this.budget + dt * this.speed, 0.5 * Math.max(1, this.speed));
      const t0 = performance.now();
      while (this.step < this.total && this.budget >= this._nextEdt() - 1e-9 && g.active) {
        const e = this._stepOnce();
        this.budget -= e; vis += e;
        if (performance.now() - t0 > 40) { this.budget = 0; break; }
      }
      if (this.step >= this.total) { this.atEnd = true; this.budget = 0; this.hooks.onEnd?.(); }
    }
    // Optik wie in game.update (ohne Simulation)
    g.camera.update(dt);
    if (this.follow != null) this._follow(dt);
    g.effects.setScale(g.gr.intH || 800);
    if (vis > 0) { try { Effects.prototype.update.call(g.effects, Math.min(0.1, vis)); } catch (e) { /* Optik */ } }
    g.updateRings(); g.updateCones(); g.orders?.updateVisual();
    if (!this.paused && vis > 0) g.mapobj?.updateSound(Math.min(dt, 0.1));
    this.applyView(dt);
  }
  // ---- Springen ----
  async seekTime(t) { return this.seekStep(this.stepOfTime(t)); }
  async seekStep(target) {
    const g = this.g;
    target = Math.max(0, Math.min(this.total, target | 0));
    if (this.busy) return false;
    if (target < this.step) { // zurück: neu laden und ab dem Start simulieren
      this.hooks.onProgress?.(0, 'reload');
      const ok = await this._reload();
      if (!ok) return false;
    }
    if (target === this.step) { this.hooks.onDone?.(); return true; }
    this.busy = true;
    this.rec.replaying = true; // main.js rendert dann nicht
    try { g.audio?.setVolume?.(0); } catch (e) { /* */ }
    const from = this.step, n = Math.max(1, target - from);
    let tc = performance.now();
    try {
      while (this.step < target && g.active) {
        this._stepOnce();
        if (performance.now() - tc > 45) {
          this.hooks.onProgress?.((this.step - from) / n, 'sim');
          await new Promise((res) => setTimeout(res, 0));
          tc = performance.now();
          if (this.stopped) return false;
        }
      }
    } finally {
      this.rec.replaying = false;
      try { g.audio?.setVolume?.(this.hooks.volume?.() ?? 0.7); } catch (e) { /* */ }
      this.busy = false;
    }
    this.atEnd = this.step >= this.total;
    try { Effects.prototype.update.call(g.effects, 0.5); } catch (e) { /* */ }
    try { g._applyLocalVisibility(); g.fow?.upload(1); } catch (e) { /* nur Optik */ }
    this._viewMod = true; // Sicht neu anwenden
    this.hooks.onProgress?.(1, 'done');
    this.hooks.onDone?.();
    if (this.atEnd) this.hooks.onEnd?.();
    return true;
  }
  // ---- Sicht: 'auto' (aufgezeichnete Perspektive) | 'UA' | 'RU' | 'all' – rein optisch, Simulation unverändert ----
  setView(v) { this.view = v; this._viewMod = true; this.applyView(0.5); }
  applyView(dt) {
    const g = this.g, ls = g.localSide;
    const v = this.view === 'auto' ? ls : this.view;
    if (v === ls) {
      if (this._viewMod) {
        this._viewMod = false;
        fowUniforms.uFowTex.value = g.fow.tex; fowUniforms.uFowEnabled.value = g.fow.enabled ? 1 : 0;
        try { g._applyLocalVisibility(); } catch (e) { /* */ }
      }
      return;
    }
    this._viewMod = true;
    if (v === 'all') {
      fowUniforms.uFowEnabled.value = 0;
      for (const u of g.units) if (u.alive && u.side !== 'N') u.root.visible = !u.garrison;
      return;
    }
    const f = g.fows[v];
    if (!f) return;
    f.upload(Math.max(0.05, dt || 0));
    fowUniforms.uFowTex.value = f.tex; fowUniforms.uFowEnabled.value = f.enabled ? 1 : 0;
    for (const u of g.units) {
      if (!u.alive || u.side === 'N') continue;
      u.root.visible = !u.garrison && (u.side === v || (u.type.build?.hidden ? !!u.seenBy[v] : u.type.structure ? f.isExplored(u.pos.x, u.pos.z) : !!u.seenBy[v]));
    }
  }
  // ---- Kamera folgt einem Spieler (Schwerpunkt seiner Einheiten) ----
  setFollow(pid) { this.follow = pid; }
  _follow(dt) {
    const c = followCenter(this.g, this.follow);
    if (c) { const cam = this.g.camera; cam.goal.x = c.x; cam.goal.z = c.z; }
  }
  // ---- Endzustand mit dem Prüf-Snapshot der Aufzeichnung vergleichen (ohne zu korrigieren) ----
  compareEnd() {
    const s = this.data.save.snap, now = this.rec.snapshot();
    if (!s) return null;
    const want = new Map(s.u.map((r) => [r[0], r])), have = new Map(now.u.map((r) => [r[0], r]));
    let missing = 0, extra = 0, maxDist = 0, maxHp = 0;
    for (const [id, r] of want) { const h = have.get(id); if (!h) { missing++; continue; } maxDist = Math.max(maxDist, Math.hypot(h[4] - r[4], h[5] - r[5])); maxHp = Math.max(maxHp, Math.abs(h[6] - r[6])); }
    for (const id of have.keys()) if (!want.has(id)) extra++;
    const objSame = JSON.stringify(s.o) === JSON.stringify(now.o);
    const statsSame = JSON.stringify(s.st) === JSON.stringify(now.st);
    return { units: s.u.length, unitsNow: now.u.length, missing, extra, maxDist: Math.round(maxDist * 1000) / 1000, maxHp: Math.round(maxHp * 100) / 100, objSame, statsSame, dt: Math.round((this.g.time - s.t) * 1000) / 1000,
      exact: !missing && !extra && maxDist < 0.02 && maxHp < 0.11 && objSame && statsSame };
  }
}
export function followCenter(g, pid) {
  let x = 0, z = 0, n = 0;
  for (const u of g.units) if (u.alive && u.owner === pid && !u.type.structure && u.root?.visible !== false) { x += u.pos.x; z += u.pos.z; n++; }
  return n ? { x: x / n, z: z / n } : null;
}
