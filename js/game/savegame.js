// Speichern/Laden (V3-X): deterministische Wiederholung (Seed + dt-Protokoll + Spielerkommandos) mit Prüf-Snapshot.
//
// Warum kein reiner Zustands-Snapshot? Missionsskripte arbeiten mit Closures (g.later(t, () => …), u.ai.onArrive, Einheiten-
// referenzen in this.*). Diese lassen sich nicht serialisieren – Wellen/Ereignisse gingen nach dem Laden verloren. Stattdessen:
//   • Während Laden + Simulation ersetzt ein Seed-RNG (mulberry32) Math.random. Optik/Audio/Ambient-Flüge/Wetter-Partikel laufen
//     isoliert mit dem nativen Zufall (sie verbrauchen je Qualität/Gerät unterschiedlich viele Zufallszahlen).
//   • game.update quantisiert dt auf 1/240 s (mit Übertrag) und protokolliert es lauflängenkodiert; Spielerkommandos
//     (game.issueCommand) werden mit Schrittindex protokolliert.
//   • Laden = Mission mit demselben Seed neu laden und das Protokoll ohne Rendern vorspulen.
//   • Zusätzlich ein kompakter Prüf-Snapshot (Einheiten, Ziele, Statistik, Fähigkeiten, Missions-Primitivvariablen). Nach dem
//     Vorspulen wird verglichen; kleine Abweichungen (z. B. andere Qualitätsstufe) werden korrigiert (Drift-Schutz).
//
// API: const rec = new SimRecorder(game) (game.recorder)
//   rec.runLoad(ctx, seed, fn)      – Mission laden (fn ruft game.load/startSkirmish) und Aufzeichnung starten
//   rec.canSave() / rec.serialize() – Spielstand-Objekt (ohne Vorschaubild/Meta)
//   await rec.replay(save, onProgress) – nach runLoad(…, save.seed) das Protokoll vorspulen, danach Snapshot prüfen/korrigieren
//   store: listSaves(), readSave(slot), writeSave(slot, data), deleteSave(slot)
// Hooks in game.js: emit('preSetup') vor mission.setup, emit('postLoad') nach 'loaded', game.update → rec.quantize/enter/exit,
//   issueCommand → rec.onCommand. Während des Vorspulens: game.replaying = true (Erfolge/Sprachfunk ignorieren Ereignisse).
import { Effects } from '../engine/effects.js';
import { UNIT_TYPES } from './unitTypes.js';

const NATIVE = Math.random;
const Q = 240;          // dt-Raster (1/240 s)
const VERSION = 1;
const IDX_KEY = 'steppensturm.saves.v1';
const SLOT_KEY = (s) => 'steppensturm.save.v1.' + s;
export const SAVE_SLOTS = ['1', '2', '3', 'quick', 'auto'];
export const AUTOSAVE_EVERY = 300; // Spielsekunden

// Aufrufer, deren Zufallsverbrauch nur die Optik betrifft (Dateipfade im Stacktrace)
const VISUAL_CALLER = /vendor\/three\/|three\.module|\/models\.js|\/effects\.js|\/audio\.js|\/music\.js|\/settlement\.js|\/terrain\.js/;
// Erster Aufrufer außerhalb von savegame.js/util.js (rand) – V8: strukturierte Aufrufstellen, sonst Stack-Text
const SKIP_FILE = /savegame\.js|\/util\.js/;
const visualCaller = (() => {
  if (typeof Error.captureStackTrace === 'function') {
    const holder = {}, prep = (_, cs) => cs;
    return function visualCaller() {
      const pst = Error.prepareStackTrace, lim = Error.stackTraceLimit;
      Error.prepareStackTrace = prep; Error.stackTraceLimit = 6;
      Error.captureStackTrace(holder, visualCaller);
      const cs = holder.stack;
      Error.prepareStackTrace = pst; Error.stackTraceLimit = lim;
      if (!Array.isArray(cs)) return false;
      for (const c of cs) { const f = c.getFileName(); if (!f || SKIP_FILE.test(f)) continue; return VISUAL_CALLER.test(f); } // ohne Datei: eingebaute Funktionen (Array.map …)
      return false;
    };
  }
  return function visualCaller() {
    const lim = Error.stackTraceLimit; Error.stackTraceLimit = 6;
    const st = new Error().stack || ''; Error.stackTraceLimit = lim;
    for (const l of st.split('\n')) { if (!l || l === 'Error' || SKIP_FILE.test(l) || /visualCaller/.test(l)) continue; return VISUAL_CALLER.test(l); }
    return false;
  };
})();
const hashSeed = (a, b) => { let h = (a >>> 0) ^ Math.imul(b + 0x9e3779b9, 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); return ((h ^ (h >>> 16)) >>> 0) || 1; };

// Alle Methoden eines Objekts (Instanz + Prototypkette) so umhüllen, dass darin der native Zufall gilt
export function isolateRandom(obj, names = null) {
  if (!obj || obj.__isoRnd) return obj;
  const list = new Set(names || []);
  if (!names) for (let p = obj; p && p !== Object.prototype; p = Object.getPrototypeOf(p)) for (const k of Object.getOwnPropertyNames(p)) if (k !== 'constructor') list.add(k);
  for (const k of list) {
    let f; try { f = obj[k]; } catch (e) { continue; }
    if (typeof f !== 'function' || f.__iso) continue;
    const w = function (...a) { const prev = Math.random; Math.random = NATIVE; try { return f.apply(this, a); } finally { Math.random = prev; } };
    w.__iso = true;
    try { obj[k] = w; } catch (e) { /* schreibgeschützt */ }
  }
  try { Object.defineProperty(obj, '__isoRnd', { value: true, enumerable: false }); } catch (e) { /* */ }
  return obj;
}

const r2 = (v) => Math.round(v * 100) / 100;

export class SimRecorder {
  constructor(game) {
    this.game = game;
    game.recorder = this;
    this.on = false; this.armed = null; this.replaying = false;
    this.state = 1; this.stack = []; this.inSim = 0;
    this.next = () => {
      // Optik-Aufrufer (three.js-UUIDs neuer Objekte, Modelle, Effekte, Audio) nutzen den nativen Zufall: ihre Anzahl hängt von
      // Caches/Pools/Qualität ab (z. B. kalte Geometrie-Caches nach dem Neuladen der Seite) und würde die Simulation verschieben.
      if (visualCaller()) return NATIVE();
      let a = (this.state = (this.state + 0x6d2b79f5) >>> 0);
      a = Math.imul(a ^ (a >>> 15), a | 1);
      a ^= a + Math.imul(a ^ (a >>> 7), a | 61);
      return ((a ^ (a >>> 14)) >>> 0) / 4294967296;
    };
    this._reset();
    isolateRandom(game.audio);
    game.on('beginLoad', () => {
      if (!this.armed) { this.on = false; this.ctx = null; }
      // Satellitennetz beim nächsten Zugriff neu aufsetzen – auch wenn dieselbe Mission erneut geladen wird (Schnellladen)
      if (game.satnet && '_mission' in game.satnet) game.satnet._mission = null;
    });
    game.on('preSetup', () => this._preSetup());
    game.on('postLoad', () => this._postLoad());
  }
  _reset() { this.dq = []; this.dn = []; this.cmds = []; this.steps = 0; this.carry = 0; this.lastAuto = 0; }
  // ---------- RNG ----------
  seed(n) { this.state = (n >>> 0) || 1; }
  push(sim) { this.stack.push(Math.random); Math.random = sim ? this.next : NATIVE; }
  pop() { Math.random = this.stack.length ? this.stack.pop() : NATIVE; }
  sim(fn) { this.push(true); try { return fn(); } finally { this.pop(); } }
  enter() { this.push(true); this.inSim++; }
  exit() { this.inSim--; this.pop(); }
  get active() { return this.on && !this.replaying; }
  // ---------- Laden ----------
  runLoad(ctx, seed, fn) {
    const g = this.game;
    seed = (seed >>> 0) || ((NATIVE() * 0x7fffffff) | 0) + 1;
    this.on = false; this.armed = { ctx, seed };
    this.seed(seed);
    this.push(true);
    let ok = false, r;
    try { r = fn(); ok = true; } finally {
      this.pop();
      const live = ok && g.active && !g.demo && (!g.net || g.net.isHost) && r !== null; // V3-RS: Online-Host zeichnet für Wiederholungen auf
      this._reset();
      this.on = !!live;
      this.ctx = live ? ctx : null; this.seedV = seed; this.speedMul = g.speedMul || 1;
      this.quality = g.settings?.quality; this.difficulty = g.difficulty || 'normal';
      this.armed = null;
    }
    return r;
  }
  _preSetup() {
    const g = this.game;
    isolateRandom(g.effects); isolateRandom(g.effects?.smoke); isolateRandom(g.effects?.fire);
    if (g.weather) isolateRandom(g.weather, ['_look', '_particles', '_markers', '_hud', '_buildParticles', '_buildMarkers', '_buildFlare', '_buildHud', '_patchSky', '_patchTerrain', 'describe']);
    if (this.armed) this.seed(hashSeed(this.armed.seed, 1));
  }
  _postLoad() {
    const g = this.game;
    this._patchAir();
    if (!this.armed) return;
    try { g.satnet?._sync?.(); } catch (e) { /* */ }
    this.seed(hashSeed(this.armed.seed, 2));
  }
  // AirShow (aircraft.js): Flugoptik nativ, Spielwirkung der Flüge (Hooks) im Simulations-RNG
  _patchAir() {
    const air = this.game.air;
    if (!air || air.__recPatched) return;
    isolateRandom(air, ['update', 'ambient', '_ambientFlight', 'dropBomb']);
    const play = air.play, self = this;
    air.play = function (spec, hooks) {
      if (hooks && self.on) {
        const h = {};
        for (const k of Object.keys(hooks)) { const f = hooks[k]; h[k] = typeof f === 'function' ? function (...a) { return self.sim(() => f.apply(this, a)); } : f; }
        hooks = h;
      }
      return play.call(this, spec, hooks);
    };
    air.__recPatched = true;
  }
  // ---------- Aufzeichnung (aus game.update) ----------
  quantize(dt) {
    this._patchAir();
    const u = dt * Q + this.carry;
    let q = Math.round(u);
    if (q < 0) q = 0; else if (q > 60) q = 60;
    this.carry = u - q;
    if (q > 0) {
      const n = this.dq.length;
      if (n && this.dq[n - 1] === q) this.dn[n - 1]++; else { this.dq.push(q); this.dn.push(1); }
      this.steps++;
    }
    return q / Q;
  }
  // pid (V3-RS): Spieler-id fremder Kommandos (Online-Host: Kommandos der Mitspieler) – Eintrag [schritt, cmd, pid]
  onCommand(cmd, pid) {
    if (!this.on || this.replaying || this.inSim || !cmd || typeof cmd !== 'object') return;
    let c; try { c = JSON.parse(JSON.stringify(cmd)); } catch (e) { return; }
    if (pid !== undefined && pid !== null && String(pid) !== String(this.game.localPlayerId)) this.cmds.push([this.steps, c, pid]);
    else this.cmds.push([this.steps, c]);
  }
  canSave() { const g = this.game; return this.on && !this.replaying && g.active && !g.ended && !g.demo && !g.net && !g.replayDriver; }
  // ---------- Prüf-Snapshot ----------
  snapshot() {
    const g = this.game, u = [], h = [];
    for (const x of g.units) {
      if (!x.alive) continue;
      if (x.type.key === 'house') { if (x.hp < x.maxHp) h.push([x.id, Math.round(x.hp)]); continue; }
      if (x.type.cp) continue;
      u.push([x.id, x.type.key, x.side, x.owner ?? null, r2(x.pos.x), r2(x.pos.z), Math.round(x.hp * 10) / 10, Math.round(x.maxHp)]);
    }
    const mv = {};
    const m = g.mission;
    if (m) for (const k of Object.keys(m)) { const v = m[k]; if ((typeof v === 'number' && Number.isFinite(v)) || typeof v === 'boolean' || (typeof v === 'string' && v.length < 80 && !['id', 'title', 'place', 'date', 'victory', 'summary', 'era', 'campaignId'].includes(k))) mv[k] = v; }
    return {
      t: g.time, n: this.steps, u, h, mv,
      o: g.objectives.map((o) => [o.id, o.state, o.text, o.hidden ? 1 : 0]),
      st: g.players.map((p) => [p.id, p.stats.kills, p.stats.lost, p.stats.shots, p.stats.intercepts | 0]),
      ab: g.players.map((p) => [p.id, p.abilities.map((a) => [a.id, r2(a.cd), a.charges === Infinity ? -1 : a.charges])]),
      cd: g.countdown ? [r2(g.countdown.t), g.countdown.label] : null,
    };
  }
  serialize() {
    const g = this.game;
    return {
      v: VERSION, ctx: this.ctx, seed: this.seedV, sm: this.speedMul, q: this.quality, diff: this.difficulty,
      d: this.dq.map((q, i) => q + (this.dn[i] > 1 ? '*' + this.dn[i] : '')).join(','),
      c: this.cmds, n: this.steps, carry: this.carry, lastAuto: this.lastAuto, snap: this.snapshot(), time: g.time,
    };
  }
  // ---------- Vorspulen ----------
  async replay(save, onProgress = null) {
    const g = this.game;
    if (!save || save.v !== VERSION) throw new Error('Spielstand-Version nicht unterstützt');
    const runs = String(save.d || '').split(',').filter(Boolean).map((s) => { const [q, n] = s.split('*'); return [+q, n ? +n : 1]; });
    const cmds = save.c || [], total = Math.max(1, save.n | 0), sm = save.sm || 1;
    const wasPaused = g.paused, vol = g.audio?.volume;
    this.replaying = true; g.replaying = true; g.paused = true;
    try { g.audio?.setVolume?.(0); } catch (e) { /* */ }
    const t0 = performance.now();
    let step = 0, ci = 0, eacc = 0, tc = performance.now();
    const applyCmds = () => { while (ci < cmds.length && cmds[ci][0] <= step) { const c = cmds[ci++][1]; try { this.sim(() => g.command(g.localPlayerId, c)); } catch (e) { console.warn('[savegame] Kommando', e); } } };
    try {
      for (const [q, cnt] of runs) {
        const edt = q / Q, sdt = edt * sm;
        for (let k = 0; k < cnt; k++) {
          if (!g.active) throw new Error('Mission beendet');
          applyCmds();
          g.frame = (g.frame || 0) + 1;
          this.enter();
          try { g.time += sdt; g.weather?.update(sdt); g.stepSim(sdt); } finally { this.exit(); }
          this._patchAir();
          if (g.air && g.air._fx === g.effects) g.air.update(edt * sm);
          eacc += edt;
          if (eacc >= 0.5) { try { Effects.prototype.update.call(g.effects, eacc); } catch (e) { /* Optik */ } eacc = 0; }
          step++;
          if (performance.now() - tc > 45) {
            onProgress?.(step / total);
            await new Promise((res) => setTimeout(res, 0));
            tc = performance.now();
          }
        }
      }
      applyCmds();
      while (ci < cmds.length) { const c = cmds[ci++][1]; try { this.sim(() => g.command(g.localPlayerId, c)); } catch (e) { /* */ } }
    } finally {
      this.replaying = false; g.replaying = false; g.paused = wasPaused;
      try { g.audio?.setVolume?.(vol ?? 0.7); } catch (e) { /* */ }
    }
    // Protokoll übernehmen, damit spätere Spielstände die ganze Vorgeschichte enthalten
    this.dq = runs.map((r) => r[0]); this.dn = runs.map((r) => r[1]);
    this.cmds = cmds.map((c) => [c[0], c[1]]); this.steps = step; this.carry = save.carry || 0; this.lastAuto = save.lastAuto || 0;
    this.seedV = save.seed; this.speedMul = sm;
    const report = this.verify(save.snap);
    report.ms = Math.round(performance.now() - t0); report.steps = step;
    this.lastReport = report;
    onProgress?.(1);
    return report;
  }
  // Vergleich mit dem Prüf-Snapshot; Abweichungen korrigieren
  verify(s) {
    const g = this.game, rep = { units: 0, moved: 0, hp: 0, spawned: 0, removed: 0, maxDist: 0, objectives: 0, exact: true };
    if (!s) return rep;
    const want = new Map(s.u.map((r) => [r[0], r]));
    for (const u of [...g.units]) {
      if (!u.alive || u.type.key === 'house' || u.type.cp) continue;
      if (!want.has(u.id) || want.get(u.id)[1] !== u.type.key) {
        if (u.type.structure && u.side === 'N') continue;
        rep.removed++;
        u.alive = false; g.scene.remove(u.root); g.removeUnit(u);
      }
    }
    for (const r of s.u) {
      const [id, key, side, owner, x, z, hp, maxHp] = r;
      let u = g.unitById(id);
      rep.units++;
      if (!u || !u.alive || u.type.key !== key) {
        const T = UNIT_TYPES[key];
        if (T && (T.structure || T.build)) { rep.skipped = (rep.skipped || 0) + 1; continue; } // Bauten nicht ohne Bauzustand nachbilden
        try {
          u = g.spawn(key, side, x, z, { owner: owner ?? undefined });
          rep.spawned++;
        } catch (e) { continue; }
      }
      const d = Math.hypot(u.pos.x - x, u.pos.z - z);
      rep.maxDist = Math.max(rep.maxDist, d);
      if (d > 0.05) {
        rep.moved++;
        u.pos.x = x; u.pos.z = z;
        if (!u.type.air && g.terrain) { const y = g.terrain.surface(x, z); if (!u.type.naval && Math.abs(u.pos.y - y) < 6) u.pos.y = y; }
        u.root?.position.set(u.pos.x, u.pos.y, u.pos.z); u.root?.updateMatrix?.();
        if (u.path?.length) u.path = null;
      }
      if (Math.abs(u.hp - hp) > 0.5 || Math.abs(u.maxHp - maxHp) > 1) { rep.hp++; u.maxHp = maxHp; u.hp = hp; }
    }
    for (const [id, hp] of s.h || []) { const u = g.unitById(id); if (u && u.alive && Math.abs(u.hp - hp) > 1) { u.hp = hp; rep.hp++; } }
    for (const [id, state, text, hidden] of s.o || []) {
      const o = g.objectives.find((q) => q.id === id);
      if (!o) { g.objectives.push({ id, text, state, optional: false, hidden: !!hidden }); rep.objectives++; continue; }
      if (o.state !== state || o.text !== text) { o.state = state; o.text = text; rep.objectives++; }
    }
    g.emit('objectives');
    for (const [id, k, l, sh, ic] of s.st || []) { const p = g.playerById(id); if (p) Object.assign(p.stats, { kills: k, lost: l, shots: sh, intercepts: ic }); }
    for (const [id, list] of s.ab || []) {
      const p = g.playerById(id); if (!p) continue;
      for (const [aid, cd, ch] of list) { const a = p.abilities.find((q) => q.id === aid); if (a) { a.cd = cd; a.charges = ch < 0 ? Infinity : ch; } }
    }
    g.emit('abilities');
    if (s.mv && g.mission) for (const [k, v] of Object.entries(s.mv)) if (g.mission[k] !== v && typeof g.mission[k] !== 'function') { g.mission[k] = v; rep.mv = (rep.mv || 0) + 1; }
    if (Math.abs(g.time - s.t) > 1e-6) { rep.dt = r2(g.time - s.t); g.time = s.t; }
    rep.exact = !(rep.moved || rep.hp || rep.spawned || rep.removed || rep.objectives || rep.mv || rep.dt);
    if (!rep.exact) console.info('[savegame] Abweichung nach dem Vorspulen korrigiert', JSON.stringify(rep));
    return rep;
  }
}

// ================= Ablage (localStorage) =================
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { localStorage.setItem(k, v); }
function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { /* */ } }
export function listSaves() {
  let idx = {};
  try { idx = JSON.parse(lsGet(IDX_KEY) || '{}') || {}; } catch (e) { idx = {}; }
  return idx;
}
export function readSave(slot) {
  const raw = lsGet(SLOT_KEY(slot));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}
// data = { meta, ...serialize() }; wirft bei vollem Speicher (nach einem Versuch, den Autosave zu opfern)
export function writeSave(slot, data) {
  const s = JSON.stringify(data);
  const idx = listSaves();
  const put = () => { lsSet(SLOT_KEY(slot), s); idx[slot] = { ...data.meta, size: s.length }; lsSet(IDX_KEY, JSON.stringify(idx)); };
  try { put(); }
  catch (e) {
    if (slot !== 'auto' && idx.auto) { lsDel(SLOT_KEY('auto')); delete idx.auto; try { put(); return s.length; } catch (e2) { /* weiter unten */ } }
    throw e;
  }
  return s.length;
}
export function deleteSave(slot) {
  lsDel(SLOT_KEY(slot));
  const idx = listSaves(); delete idx[slot];
  try { lsSet(IDX_KEY, JSON.stringify(idx)); } catch (e) { /* */ }
}
