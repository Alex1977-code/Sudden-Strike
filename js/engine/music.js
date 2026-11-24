// =====================================================================================
// Sudden Strike – prozedurale Hintergrundmusik (WebAudio, KEINE Audiodateien)
// -------------------------------------------------------------------------------------
// Klassen-API:  const music = new Music(audio);   (audio = Instanz aus audio.js, nach audio.init())
//   start(theme)         'menu' | 'ww2' | 'afghan' | 'modern' | 'victory' | 'defeat'
//                        (Themen-Wechsel = Überblendung; Stinger spielen einmalig und enden von selbst)
//                        Ist der AudioContext noch nicht da (vor dem ersten Klick), wird das Thema
//                        gemerkt und beim nächsten start()/resume() gestartet.
//   resume()             startet das gemerkte Thema, falls noch nichts läuft (nach audio.init() aufrufen)
//   stop(fade=1.5)       blendet aus und vergisst das Thema
//   setIntensity(0..1)   0 = ruhige Erkundung (Pads/Atmosphäre), 1 = Gefecht (Drums/Puls dazu); weich (~3 s)
//   setVolume(0..1)      Musiklautstärke (Pegel = level * v, level 0.25 -> bei v=0.7 ca. -15 dB, bei Musik-Spitzen
//                        um -4 dBFS intern also ca. -19 dBFS)
//   setEnabled(bool)     Musik an/aus (merkt sich das Thema)
//   duck(depth=0.45, dur=0.9)  kurzes Absenken (z. B. bei Explosionen), optional
//   stats                Diagnose { ticks, tickMs, notes }
// Ausgang: Musikbus -> audio.pre (Kompressor/Limiter des Mischpults); Hall über audio.revIn (falls vorhanden).
// Scheduler: setTimeout (100 ms) + Lookahead 0.45 s auf ctx.currentTime; max. 16 gleichzeitige Stimmen.
// Offline-Test: new Music(stub, {manual:true}); music.start(theme,{snap:true}); music.pump(60) vor startRendering().
// =====================================================================================

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const pcOf = (m) => ((m % 12) + 12) % 12;
function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const MAXV = 16;

// Stimmführung: Akkordtöne (Pitchclasses) so legen, dass die Gesamtbewegung zum Vorgänger minimal ist
const PERMS = (() => { const out = []; const rec = (a, r) => { if (!r.length) { out.push(a); return; } for (let i = 0; i < r.length; i++) rec([...a, r[i]], r.filter((_, j) => j !== i)); }; rec([], [0, 1, 2, 3]); return out; })();
function voiceLead(prev, pcs, lo = 50, hi = 74) {
  const near = (pc, target) => { let best = null; for (let m = lo; m <= hi; m++) if (pcOf(m) === pcOf(pc) && (best === null || Math.abs(m - target) < Math.abs(best - target))) best = m; return best; };
  if (!prev) return pcs.map((pc, i) => near(pc, 56 + i * 4)).sort((a, b) => a - b);
  let bestV = null, bestC = 1e9;
  for (const p of PERMS) { const v = p.map((k, i) => near(pcs[k], prev[i])); const c = v.reduce((s, m, i) => s + Math.abs(m - prev[i]), 0); if (c < bestC) { bestC = c; bestV = v; } }
  return bestV.sort((a, b) => a - b);
}
const chordPcs = (root, iv) => iv.map((i) => pcOf(root + i));

// =====================================================================================
// Themen. Jedes: bpm, setup(S) (Layer/Drohnen), step(S, i, t, bar, s) je 16tel-Schritt
// =====================================================================================
const THEMES = {
  // ---- Menü: getragen, melancholisch-heroisch (D-Moll) ----
  menu: {
    bpm: 66, echo: true,
    prog: [[50, [0, 3, 7, 10]], [46, [0, 4, 7, 11]], [53, [0, 4, 7, 12]], [48, [0, 4, 7, 12]], [50, [0, 3, 7, 10]], [46, [0, 4, 7, 11]], [43, [0, 3, 7, 10]], [45, [0, 4, 7, 12]]],
    scale: [2, 4, 5, 7, 9, 10, 0],
    layers: { pad: [0.5, 0.55], bass: [0.55, 0.3], mel: [0.42, 0.6], drum: [0.5, 0.5] },
    step(S, i, t, bar, s) {
      const ch = S.chordAt(bar);
      if (s === 0) {
        this.pad(S, t, ch, 16 * S.sd + 1.2, { a: 1.3, r: 2.2, g: 0.075, f0: 380, f1: 1500 });
        this.bassNote(S, t, ch.root - 12, 16 * S.sd, 0.34);
        if (bar % 4 === 0) this.timp(S, t, 0.5);
        if (bar % 8 === 4) this.brass(S, t + 0.1, ch.root + 12, 14 * S.sd, 0.07, { a: 1.6, r: 2.5 });
        S.tmpl = [[0, 6], [0], [0, 8, 12], [4, 8], [0, 3, 6, 10]][(S.rng() * 5) | 0]; S.melOn = S.rng() > 0.28;
      }
      if (S.melOn && S.tmpl.includes(s)) {
        const idx = S.tmpl.indexOf(s), nx = S.tmpl[idx + 1] ?? 16, m = this.melStep(S, ch, s === 0 || s === 8);
        this.bell(S, t, m, Math.min(14, Math.max(4, nx - s + 4)) * S.sd, 0.16 * (s === 0 ? 1 : 0.8));
      }
      if (S.I > 0.4 && s % 4 === 0 && S.rng() < S.I - 0.3) this.bell(S, t, ch.v[(s / 4 + 1) % 4] + 12, 2 * S.sd, 0.07, true);   // sanfte Arpeggio-Tupfer bei Spannung
    },
  },
  // ---- 2. Weltkrieg: Marschtrommel, Blechbläser-Pads, Moll (C-Moll harmonisch) ----
  ww2: {
    bpm: 84,
    prog: [[48, [0, 3, 7, 12]], [44, [0, 4, 7, 12]], [41, [0, 3, 7, 12]], [43, [0, 4, 7, 10]], [48, [0, 3, 7, 12]], [41, [0, 3, 7, 12]], [43, [0, 4, 7, 10]], [48, [0, 3, 7, 12]]],
    scale: [0, 2, 3, 5, 7, 8, 11],
    layers: { pad: [0.5, 0.35], bass: [0.5, 0.2], mel: [0.5, 0.35], drum: [0.7, 0.18] },
    step(S, i, t, bar, s) {
      const ch = S.chordAt(bar), I = S.I;
      if (s === 0) {
        this.pad(S, t, ch, 16 * S.sd + 0.8, { a: 0.7, r: 1.6, g: 0.07, f0: 450, f1: 1500, brass: true });
        this.bassNote(S, t, ch.root - 12, 7 * S.sd, 0.3);
        if (bar % 2 === 0) this.bassNote(S, t + 8 * S.sd, ch.root - 12, 7 * S.sd, 0.24);
        S.tmpl = [[0, 6, 8], [0, 4, 8, 12], [0, 8], [2, 6, 10], [0, 6, 8, 14]][(S.rng() * 5) | 0]; S.melOn = (bar % 2 === 0) ? S.rng() > 0.3 : S.rng() > 0.55;
      }
      if (S.melOn && S.tmpl.includes(s)) {
        const idx = S.tmpl.indexOf(s), nx = S.tmpl[idx + 1] ?? 16, m = this.melStep(S, ch, s === 0 || s === 8);
        this.brass(S, t, m, Math.max(2, nx - s - 1) * S.sd, 0.1, { a: 0.07, r: 0.4, vib: false });
      }
      // Marschtrommel: Rolle/Ruffs auf Zählzeit 2 & 4, Grundschlag ab Intensität 0.3
      if (I > 0.3) {
        const v = clamp((I - 0.25) * 1.4, 0.2, 1);
        if (s % 4 === 0) this.snare(S, t, (s % 8 === 4 ? 0.95 : 0.55) * v);
        if (s === 4 || s === 12) { this.snare(S, t - 0.055, 0.3 * v); this.snare(S, t - 0.028, 0.35 * v); }
        if (I > 0.55 && (s === 6 || s === 14 || s === 10)) this.snare(S, t, 0.3 * v);
        if (I > 0.75 && s % 2 === 1 && S.rng() < 0.5) this.snare(S, t, 0.18);
      }
      if (I > 0.5 && (s === 0 || s === 8)) this.kick(S, t, 0.5 + 0.3 * I);
      if (I > 0.7 && s === 0 && bar % 2 === 0) this.timp(S, t, 0.6);
    },
  },
  // ---- Afghanistan: Drone, modale Melodik (D-Phrygisch), Handtrommeln, sparsame Zupfklänge ----
  afghan: {
    bpm: 72, echo: true,
    prog: [[38, [0, 5, 7, 12]], [38, [0, 5, 7, 12]], [38, [0, 5, 7, 12]], [38, [0, 5, 7, 12]], [38, [0, 5, 7, 12]], [38, [0, 5, 7, 12]], [36, [0, 5, 7, 12]], [36, [0, 5, 7, 12]]],
    scale: [2, 3, 5, 7, 9, 10, 0],
    layers: { pad: [0.5, 0.45], bass: [0.4, 0.2], mel: [0.55, 0.5], drum: [0.7, 0.2] },
    setup(S) {
      const d = this.drone(S, 50, 0.05); S.drone = d;
    },
    step(S, i, t, bar, s) {
      const ch = S.chordAt(bar), I = S.I;
      if (s === 0) {
        if (bar % 2 === 0) this.pad(S, t, { v: ch.v.map((m) => m + 12).slice(1, 4), root: ch.root }, 32 * S.sd + 1, { a: 2.2, r: 3, g: 0.05, f0: 300, f1: 900, tri: true });
        // Drohnen-Grundton folgt dem Akkord (D -> C)
        const target = ch.root + 12, f = mtof(target);
        for (const o of S.drone.main) o.frequency.setTargetAtTime(f, t, 1.2);
        S.drone.sub.frequency.setTargetAtTime(f / 2, t, 1.2);
        for (const o of S.drone.fifth) o.frequency.setTargetAtTime(f * 1.5, t, 1.2);
        S.tmpl = [[0, 5, 8], [0, 3, 6, 10], [2, 8], [0, 6], [4, 6, 10, 13], [0]][(S.rng() * 6) | 0]; S.melOn = S.rng() > (bar % 4 === 3 ? 0.1 : 0.45);
      }
      if (S.melOn && S.tmpl.includes(s)) {
        const end = bar % 4 === 3 && s === S.tmpl[S.tmpl.length - 1];
        const m = end ? this.nearestPc(S, ch.root, S.mnote) : this.melStep(S, ch, s === 0, -0.12);
        if (S.rng() < 0.5 && !end) this.pluck(S, t - 0.075, m + (S.rng() < 0.5 ? 2 : 1 - 0), 0.07, 0.35);   // kurze Verzierung (Vorschlag)
        this.pluck(S, t, m, 0.2 + 0.1 * (s === 0), 1.8);
      }
      // Handtrommel (Doum/Tak): ab 0.3
      if (I > 0.3) {
        const v = clamp((I - 0.2) * 1.3, 0.2, 1);
        if (s === 0 || s === 10) this.doum(S, t, 0.85 * v);
        if (s === 8 && I > 0.5) this.doum(S, t, 0.55 * v);
        if (s === 3 || s === 6 || s === 12 || s === 14) this.tak(S, t, (s === 6 ? 0.55 : 0.4) * v);
        if (I > 0.65 && (s === 2 || s === 5 || s === 9 || s === 15) && S.rng() < 0.7) this.tak(S, t, 0.2);
        if (I > 0.7 && s === 0) this.frame(S, t, 0.7);
      }
    },
  },
  // ---- Moderne Ukraine: cineastische Pads, pulsierende Bässe, Taiko ----
  modern: {
    bpm: 88, echo: true,
    prog: [[52, [0, 3, 7, 14]], [48, [0, 4, 7, 14]], [55, [0, 4, 7, 12]], [50, [0, 4, 7, 14]], [52, [0, 3, 7, 14]], [48, [0, 4, 7, 11]], [43, [0, 4, 7, 12]], [50, [0, 4, 7, 9]]],
    scale: [4, 6, 7, 9, 11, 0, 2],
    layers: { pad: [0.5, 0.65], bass: [0.6, 0.15], mel: [0.45, 0.7], drum: [0.7, 0.35] },
    step(S, i, t, bar, s) {
      const ch = S.chordAt(bar), I = S.I;
      if (s === 0) {
        this.pad(S, t, ch, 16 * S.sd + 1, { a: 1.1, r: 2.2, g: 0.062, f0: 350 + 500 * I, f1: 1300 + 1500 * I, wide: true });
        this.bassNote(S, t, ch.root - 12, 16 * S.sd, 0.3, true);
        S.tmpl = [[0], [0, 6], [4], [2, 10], [0, 8, 11]][(S.rng() * 5) | 0]; S.melOn = S.rng() > 0.45;
      }
      if (S.melOn && S.tmpl.includes(s) && I < 0.7) this.bell(S, t, this.melStep(S, ch, s === 0) + 12, 6 * S.sd, 0.13, true);
      // pulsierender Synth-Bass
      if (I > 0.2) {
        const g = clamp((I - 0.1) * 0.9, 0.1, 0.6);
        const dense = I > 0.8 ? 1 : I > 0.5 ? 2 : 4;
        if (s % dense === 0 && !(dense === 4 && s % 8 !== 0 && I < 0.35)) this.pulse(S, t, ch.root - 12 + (s % 8 === 6 && I > 0.7 ? 12 : 0), dense * S.sd * 0.8, g * (s % 4 === 0 ? 1 : 0.7));
      }
      // hohe Ticks (Arpeggio)
      if (I > 0.38 && s % 2 === 0 && (s % 4 !== 0 || I > 0.55)) { const n = ch.v[(s / 2) % 4] + 24; this.tick(S, t, n, 0.05 + 0.05 * I); }
      // Taiko
      if (I > 0.5) {
        if (s === 0) this.taiko(S, t, 0.9);
        if (s === 8 && I > 0.62) this.taiko(S, t, 0.7);
        if (I > 0.82 && (s === 6 || s === 14)) this.taiko(S, t, 0.45, true);
        if (I > 0.85 && bar % 4 === 3 && s >= 12) this.taiko(S, t, 0.4 + 0.1 * (s - 12), true);
      }
      if (I > 0.6 && bar % 8 === 7 && s === 0) this.riser(S, t, 16 * S.sd);
    },
  },
  // ---- Stinger: Sieg ----
  victory: {
    bpm: 96, once: true, len: 48,
    scale: [2, 4, 6, 7, 9, 11, 1],
    step(S, i, t) {
      const sd = S.sd, seq = { 0: [62, 69, 74], 3: [66, 74], 6: [67, 71, 76], 8: [69, 73, 78], 12: [74, 78, 81] };
      const ev = seq[i];
      if (i === 0) { this.timp(S, t, 0.9); this.pad(S, t, { v: [50, 57, 62, 66], root: 50 }, 40 * sd, { a: 0.6, r: 3, g: 0.06, f0: 500, f1: 2200, brass: true }); }
      if (ev) for (const m of ev) this.brass(S, t, m, (i === 12 ? 18 : 3) * sd, i === 12 ? 0.075 : 0.09, { a: 0.05, r: i === 12 ? 2.5 : 0.35 });
      if (i === 8 || i === 12) this.timp(S, t, 0.85);
      if (i === 12) { this.bassNote(S, t, 38, 22 * sd, 0.4); this.bell(S, t + 0.1, 86, 6, 0.1, true); this.bell(S, t + 0.25, 90, 6, 0.08, true); }
      if (i >= 16 && i < 32 && i % 4 === 0) this.bell(S, t, [74, 78, 81, 86][(i / 4) % 4], 4, 0.09, true);
    },
  },
  // ---- Stinger: Niederlage ----
  defeat: {
    bpm: 58, once: true, len: 40,
    scale: [2, 4, 5, 7, 9, 10, 0],
    step(S, i, t) {
      const sd = S.sd;
      if (i === 0) { this.timp(S, t, 0.8); this.brass(S, t, 50, 6 * sd, 0.09, { a: 0.3, r: 1.5 }); this.brass(S, t, 57, 6 * sd, 0.07, { a: 0.3, r: 1.5 }); this.pad(S, t, { v: [50, 53, 57, 62], root: 50 }, 36 * sd, { a: 1.0, r: 3.5, g: 0.05, f0: 280, f1: 900 }); }
      if (i === 6) { this.brass(S, t, 46, 6 * sd, 0.09, { a: 0.3, r: 1.5 }); this.brass(S, t, 53, 6 * sd, 0.07, { a: 0.3, r: 1.5 }); }
      if (i === 12) { this.brass(S, t, 45, 8 * sd, 0.09, { a: 0.3, r: 1.5 }); this.brass(S, t, 52, 8 * sd, 0.07, { a: 0.3, r: 1.5 }); this.timp(S, t, 0.5); }
      if (i === 20) { this.brass(S, t, 38, 18 * sd, 0.1, { a: 0.5, r: 3 }); this.brass(S, t, 50, 18 * sd, 0.06, { a: 0.5, r: 3 }); this.timp(S, t, 0.7); }
      if ([2, 8, 16, 24].includes(i)) this.bell(S, t, [74, 72, 69, 62][[2, 8, 16, 24].indexOf(i)], 4, 0.11, true);
    },
  },
};

// =====================================================================================
export class Music {
  constructor(audio, opts = {}) {
    this.audio = audio; this.ctx = null; this.opts = opts;
    this.enabled = true; this.volume = 0.7; this.level = opts.level ?? 0.25; this.I = 0; this.want = null;
    this.S = null; this.old = []; this.timer = null; this.lookahead = opts.lookahead ?? 0.45;
    this.manual = !!opts.manual; this.stats = { ticks: 0, tickMs: 0, notes: 0 };
    this.mobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
    this._seed = 20240611;
  }

  // ------------------------------------------------------------------ Öffentliche API
  start(theme, o = {}) {
    if (!THEMES[theme]) return;
    this.want = theme;
    if (!this.enabled) return;
    if (!this._build()) return;
    if (this.S && this.S.theme === theme && !this.S.done && !o.force) return;
    const fade = o.snap ? 0.05 : (THEMES[theme].once ? 0.8 : 2.2);
    this._retire(this.S, o.snap ? 0.05 : (THEMES[theme].once ? 1.0 : 2.5));
    this.S = this._session(theme, o);
    if (o.snap) this.S.I = this.I;
    if (!this.manual) this._schedule();
    if (this.ctx.state === 'suspended' && this.ctx.resume && !this.manual) { try { this.ctx.resume(); } catch (e) { /* */ } }
  }
  resume() { if (this.want && this.enabled && (!this.S || this.S.done)) { if (!(this.S && this.S.done && THEMES[this.want].once)) this.start(this.want); } }
  stop(fade = 1.5) { this.want = null; this._retire(this.S, fade); this.S = null; }
  setIntensity(v) { this.I = clamp(+v || 0, 0, 1); }
  setVolume(v) { this.volume = clamp(+v || 0, 0, 1); if (this.out) for (const g of [this.out, this.wetOut]) g.gain.setTargetAtTime(this.level * this.volume, this.ctx.currentTime, 0.05); }
  setEnabled(on) {
    on = !!on; if (on === this.enabled) return; this.enabled = on;
    if (!on) { this._retire(this.S, 0.6); this.S = null; } else if (this.want) this.start(this.want);
  }
  duck(depth = 0.45, dur = 0.9) {
    if (!this.out) return; const t = this.ctx.currentTime, base = this.level * this.volume;
    for (const n of [this.out, this.wetOut]) { const g = n.gain; g.cancelScheduledValues(t); g.setTargetAtTime(base * depth, t, 0.04); g.setTargetAtTime(base, t + 0.15 + dur * 0.4, dur / 3); }
  }
  /** Offline/Test: plant alle Schritte bis Zeit `seconds` ab Start voraus. */
  pump(seconds) { const old = this.lookahead; this.lookahead = seconds; this._tick(); this.lookahead = old; }

  // ------------------------------------------------------------------ Aufbau
  _build() {
    if (this.ctx) return true;
    const a = this.audio, c = a && a.ctx; if (!c) return false;
    this.ctx = c;
    this.out = c.createGain(); this.out.gain.value = this.level * this.volume;
    this.wetOut = c.createGain(); this.wetOut.gain.value = this.level * this.volume;   // Hall-Send folgt der Musiklautstärke
    this.out.connect(a.pre || c.destination);
    if (a.revIn) this.wetOut.connect(a.revIn);
    const n = c.sampleRate * 2, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0), r = mulberry(7);
    for (let i = 0; i < n; i++) d[i] = r() * 2 - 1;
    this.noise = b;
    return true;
  }

  _session(theme, o) {
    const c = this.ctx, T = THEMES[theme], sd = 60 / T.bpm / 4, t0 = c.currentTime + 0.08;
    const S = {
      theme, T, sd, rng: mulberry(this._seed + (this._n = (this._n || 0) + 1) * 977), step: 0, t: t0, I: this.I, voices: [], done: false, nodes: [], oscs: [], once: !!T.once, len: T.len || 0,
      mnote: 62, tmpl: [0], melOn: true, voicing: null, vbar: -1, snap: !!o.snap,
    };
    S.fadeDry = c.createGain(); S.fadeWet = c.createGain();
    const fin = o.snap ? 0.05 : 2.0;
    for (const f of [S.fadeDry, S.fadeWet]) { f.gain.setValueAtTime(0, c.currentTime); f.gain.linearRampToValueAtTime(1, c.currentTime + fin); }
    S.fadeDry.connect(this.out); S.fadeWet.connect(this.wetOut);
    S.nodes.push(S.fadeDry, S.fadeWet);
    S.L = {};
    for (const [k, [g, w]] of Object.entries(T.layers || { pad: [0.5, 0.5], bass: [0.5, 0.2], mel: [0.5, 0.5], drum: [0.6, 0.3] })) S.L[k] = this._layer(S, g, w);
    if (T.once) { S.L.pad.g.gain.value = 1; S.L.bass.g.gain.value = 1; S.L.mel.g.gain.value = 1; S.L.drum.g.gain.value = 1; }
    if (T.echo) {
      const e = c.createDelay(2), fb = c.createGain(), lp = c.createBiquadFilter(), send = c.createGain(), out = this._layer(S, 1, 0.55);
      e.delayTime.value = sd * 3; fb.gain.value = 0.38; lp.type = 'lowpass'; lp.frequency.value = 2400; send.gain.value = 0.42;
      S.L.mel.g.connect(send); send.connect(e); e.connect(lp); lp.connect(fb); fb.connect(e); lp.connect(out.g);
      S.nodes.push(e, fb, lp, send);
    }
    S.chordAt = (bar) => {
      const P = T.prog || [[50, [0, 3, 7, 12]]]; const [root, iv] = P[bar % P.length];
      if (S.vbar !== bar) { S.voicing = voiceLead(S.voicing, chordPcs(root, iv)); S.vbar = bar; }
      return { root, v: S.voicing, pcs: chordPcs(root, iv) };
    };
    // Themen rufen Instrumente als this.xyz() auf -> an diese Instanz binden
    T.pad = (...a) => this._pad(...a); T.brass = (...a) => this._brass(...a); T.bell = (...a) => this._bell(...a); T.pluck = (...a) => this._pluck(...a);
    T.bassNote = (...a) => this._bassNote(...a); T.pulse = (...a) => this._pulse(...a); T.tick = (...a) => this._tick16(...a);
    T.kick = (...a) => this._kick(...a); T.taiko = (...a) => this._taiko(...a); T.timp = (...a) => this._timp(...a); T.snare = (...a) => this._snare(...a);
    T.doum = (...a) => this._doum(...a); T.tak = (...a) => this._tak(...a); T.frame = (...a) => this._frame(...a); T.riser = (...a) => this._riser(...a);
    T.drone = (...a) => this._drone(...a); T.melStep = (...a) => this._melStep(...a); T.nearestPc = (...a) => this._nearestPc(...a);
    if (T.setup) T.setup(S);
    return S;
  }
  _layer(S, gain, wet) {
    const c = this.ctx, g = c.createGain(), w = c.createGain(); g.gain.value = gain; w.gain.value = wet;
    g.connect(S.fadeDry); g.connect(w); w.connect(S.fadeWet); S.nodes.push(g, w);
    return { g, w };
  }
  _retire(S, fade) {
    if (!S) return; const c = this.ctx, t = c.currentTime;
    S.done = true;
    for (const f of [S.fadeDry, S.fadeWet]) { try { f.gain.cancelScheduledValues(t); f.gain.setValueAtTime(f.gain.value, t); f.gain.linearRampToValueAtTime(0, t + fade); } catch (e) { /* */ } }
    for (const o of S.oscs) { try { o.stop(t + fade + 0.05); } catch (e) { /* */ } }
    if (this.old.indexOf(S) < 0) this.old.push(S);
    if (!this.manual) setTimeout(() => this._free(S), (fade + 4) * 1000);
  }
  _free(S) { try { for (const n of S.nodes) n.disconnect(); } catch (e) { /* */ } const i = this.old.indexOf(S); if (i >= 0) this.old.splice(i, 1); }

  // ------------------------------------------------------------------ Scheduler
  _schedule() {
    if (this.timer || this.manual) return;
    this.timer = setInterval(() => this._tick(), 100);
  }
  _tick() {
    const S = this.S, c = this.ctx; if (!S || !c) return;
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    const now = c.currentTime;
    if (!this.manual && c.state !== 'running') return;
    if (S.done) { if (this.timer && !this.manual) { /* Stinger fertig -> Timer anhalten */ clearInterval(this.timer); this.timer = null; } return; }
    // weiche Intensität (Zeitkonstante ~3 s) + Layer-Pegel
    if (!S.snap) { const dt = Math.max(0, now - (S.lastNow ?? now)); S.I += (this.I - S.I) * (1 - Math.exp(-dt / 3)); }
    S.lastNow = now;
    if (S.t < now - 0.3) S.t = now + 0.05;       // Tab war im Hintergrund: nicht aufholen
    let guard = 0;
    while (S.t < now + this.lookahead && guard++ < 4000) {
      const i = S.step, bar = (i / 16) | 0, s = i % 16;
      if (S.once && i >= S.len) { S.done = true; this._tail(S); break; }
      try { S.T.step(S, i, S.t, bar, s); } catch (e) { if (!this._warned) { this._warned = true; console.warn('[music]', e); } }
      S.step++; S.t += S.sd;
    }
    if (!S.once) this._layerLevels(S, now);
    this.stats.ticks++; this.stats.tickMs += (typeof performance !== 'undefined' ? performance.now() : 0) - t0;
  }
  _tail(S) { if (!this.manual) setTimeout(() => this._retire(S, 2.5), 5000); }
  _layerLevels(S, now) {
    // Intensität steuert die Lautstärke von Drums/Bass (Noten sind zusätzlich nach Intensität gegatet)
    const I = S.I; if (S.snap) return;
    const k = S.lvlT && now - S.lvlT < 0.3; if (k) return; S.lvlT = now;
    const T = S.T.layers || {}, set = (n, v) => S.L[n].g.gain.setTargetAtTime(v, now, 0.8);
    if (T.drum) set('drum', T.drum[0] * clamp(I * 2.2, 0, 1));
    if (T.bass && S.theme === 'modern') set('bass', T.bass[0] * clamp(0.5 + I, 0.5, 1));
    if (T.pad) set('pad', T.pad[0] * (1 - 0.18 * I));
  }

  // ------------------------------------------------------------------ Stimmen
  _voice(S, t, len, cap = MAXV) {
    const v = S.voices, now = this.ctx.currentTime; let n = 0;
    for (let i = v.length - 1; i >= 0; i--) { if (v[i][1] < now - 1) v.splice(i, 1); else if (v[i][0] <= t && v[i][1] > t) n++; }
    if (n >= cap) return false; v.push([t, t + len]); this.stats.notes++; return true;
  }
  /** Allzweck-Note: Oszillator-Stack -> (Tiefpass) -> Hüllkurve -> Layer */
  _note(S, o) {
    const c = this.ctx, t = o.t, a = o.a ?? 0.01, r = o.r ?? 0.3, dur = Math.max(o.dur, a + 0.02);
    if (!this._voice(S, t, dur + r, o.cap || MAXV)) return false;
    const g = c.createGain(), gp = g.gain, te = t + dur;
    gp.setValueAtTime(0, t); gp.linearRampToValueAtTime(o.g, t + a);
    if (o.d) gp.setTargetAtTime(o.g * (o.s ?? 0), t + a, o.d / 3);
    gp.setTargetAtTime(0, te, r / 5);
    let head = g;
    if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = o.lp.q ?? 0.7; f.frequency.setValueAtTime(o.lp.f0, t); f.frequency.setTargetAtTime(o.lp.f1, t + (o.lp.at ?? 0), o.lp.tc ?? 0.3); if (o.lp.f2) f.frequency.setTargetAtTime(o.lp.f2, te - r * 0.5, 0.5); f.connect(g); head = f; }
    const parts = o.parts || (o.det || [0]).map((d) => ({ r: 1, g: 1, type: o.wave || 'sawtooth', det: d }));
    const stop = te + r * 1.3 + 0.05;
    for (const p of parts) {
      const os = c.createOscillator(); os.type = p.type; os.frequency.value = o.f * p.r; if (p.det) os.detune.value = p.det;
      if (p.g !== 1) { const pg = c.createGain(); pg.gain.value = p.g; os.connect(pg); pg.connect(head); } else os.connect(head);
      os.start(t); os.stop(stop);
    }
    g.connect(o.dest);
    return true;
  }
  _pad(S, t, ch, dur, o) {
    const n = ch.v.length;
    for (let i = 0; i < n; i++) {
      const f = mtof(ch.v[i]), det = o.wide ? [-13, 0, 13] : o.tri ? [-5, 5] : [-8, 8];
      const parts = det.map((d) => ({ r: 1, g: 1, type: o.tri ? 'triangle' : o.brass && i % 2 ? 'square' : 'sawtooth', det: d }));
      if (o.brass) for (const p of parts) p.g = p.type === 'square' ? 0.5 : 1;
      this._note(S, { t, dur, f, parts, g: o.g * (o.wide ? 0.8 : 1), a: o.a, r: o.r, lp: { f0: o.f0, f1: o.f1, tc: o.a * 0.8, q: 0.8, f2: o.f0 * 0.8 }, dest: S.L.pad.g, cap: 16 });
    }
  }
  _brass(S, t, m, dur, g, o = {}) {
    const f = mtof(m);
    this._note(S, { t, dur, f, parts: [{ r: 1, g: 1, type: 'sawtooth', det: -7 }, { r: 1, g: 0.7, type: 'sawtooth', det: 6 }, { r: 1, g: 0.35, type: 'square', det: 0 }], g, a: o.a ?? 0.1, r: o.r ?? 0.4, d: 0.5, s: 0.75, lp: { f0: f * 1.4, f1: Math.min(f * 6, 5200), tc: (o.a ?? 0.1) * 1.2 + 0.05, q: 1.2, f2: f * 2 }, dest: S.L.mel.g, cap: 15 });
  }
  _bell(S, t, m, dur, g, soft) {
    const f = mtof(m);
    this._note(S, { t, dur, f, parts: [{ r: 1, g: 1, type: 'triangle' }, { r: 2, g: 0.28, type: 'sine' }, { r: 3.01, g: soft ? 0.07 : 0.12, type: 'sine' }], g, a: 0.012, d: Math.min(2.4, dur * 0.7) , s: 0.0, r: 0.8, lp: { f0: 4200, f1: 1100, tc: 0.5 }, dest: S.L.mel.g, cap: 13 });
  }
  _pluck(S, t, m, g, dur) {
    const f = mtof(m);   // Rubab-/Dambura-artig: Dreieck+Säge, schneller Tiefpass-Abfall
    this._note(S, { t, dur, f, parts: [{ r: 1, g: 1, type: 'triangle', det: -3 }, { r: 1, g: 0.55, type: 'sawtooth', det: 4 }, { r: 2, g: 0.2, type: 'sine' }], g, a: 0.004, d: 0.5, s: 0, r: 0.5, lp: { f0: 3800, f1: 500, tc: 0.18, q: 1.5 }, dest: S.L.mel.g, cap: 13 });
  }
  _bassNote(S, t, m, dur, g, sub) {
    const f = mtof(m);
    this._note(S, { t, dur, f, parts: [{ r: 1, g: 1, type: 'sine' }, { r: 2, g: 0.18, type: 'triangle' }], g, a: 0.35, r: 0.9, d: 0, lp: { f0: 400, f1: 400 }, dest: S.L.bass.g });
  }
  _pulse(S, t, m, dur, g) {
    const f = mtof(m);
    this._note(S, { t, dur: Math.max(0.08, dur), f, parts: [{ r: 1, g: 1, type: 'sawtooth', det: -6 }, { r: 1, g: 1, type: 'sawtooth', det: 6 }, { r: 0.5, g: 0.8, type: 'sine' }], g: g * 0.17, a: 0.006, d: 0.12, s: 0.45, r: 0.1, lp: { f0: 1800 + 1800 * S.I, f1: 260, tc: 0.07, q: 2.5 }, dest: S.L.bass.g, cap: 14 });
  }
  _tick16(S, t, m, g) {
    this._note(S, { t, dur: 0.12, f: mtof(m), parts: [{ r: 1, g: 1, type: 'sine' }, { r: 2, g: 0.3, type: 'triangle' }], g, a: 0.003, d: 0.07, s: 0, r: 0.1, dest: S.L.mel.g, cap: 11 });
  }
  _drone(S, m, g) {
    const c = this.ctx, f = mtof(m), main = [], fifth = [];
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = 1.1;
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 180; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
    const dg = c.createGain(); dg.gain.setValueAtTime(0, c.currentTime); dg.gain.linearRampToValueAtTime(g, c.currentTime + 4); lp.connect(dg); dg.connect(S.L.pad.g);
    const mk = (fr, type, det, arr, vol) => { const o = c.createOscillator(); o.type = type; o.frequency.value = fr; o.detune.value = det; const og = c.createGain(); og.gain.value = vol; o.connect(og); og.connect(lp); o.start(); arr.push(o); S.oscs.push(o); S.nodes.push(og); };
    mk(f, 'sawtooth', -9, main, 1); mk(f, 'sawtooth', 8, main, 0.8); mk(f / 2, 'sine', 0, main, 0.9); mk(f * 1.5, 'triangle', 4, fifth, 0.5);
    S.oscs.push(lfo); S.nodes.push(lp, lg, dg);
    S.voices.push([0, Infinity], [0, Infinity]);
    return { main: main.slice(0, 2), sub: main[2], fifth, lp };
  }
  _melStep(S, ch, strong, bias = 0) {
    const sc = S.T.scale, notes = [];
    for (let m = 57; m <= 79; m++) if (sc.includes(pcOf(m))) notes.push(m);
    let k = notes.reduce((b, m, i) => (Math.abs(m - S.mnote) < Math.abs(notes[b] - S.mnote) ? i : b), 0);
    const centre = notes.findIndex((m) => m >= (S.theme === 'ww2' ? 62 : 67));
    const moves = [-2, -1, -1, 0, 1, 1, 2]; let d = moves[(S.rng() * moves.length) | 0];
    if (k > centre + 4) d = -Math.abs(d) - (S.rng() < 0.4 ? 1 : 0); else if (k < centre - 4) d = Math.abs(d);
    if (bias && S.rng() < Math.abs(bias) * 4) d = bias < 0 ? -1 : 1;
    k = clamp(k + d, 0, notes.length - 1); let m = notes[k];
    if (strong) { // auf Betonungen zum nächsten Akkordton ziehen
      let best = m, bd = 99; for (const n of notes) if (ch.pcs.includes(pcOf(n)) && Math.abs(n - m) < bd) { bd = Math.abs(n - m); best = n; } if (bd <= 2) m = best;
    }
    S.mnote = m; return m;
  }
  _nearestPc(S, rootMidi, from) { let best = from, bd = 99; for (let m = 57; m <= 79; m++) if (pcOf(m) === pcOf(rootMidi) && Math.abs(m - from) < bd) { bd = Math.abs(m - from); best = m; } S.mnote = best; return best; }

  // ------------------------------------------------------------------ Schlagwerk
  _env(S, t, peak, dec, node) { const g = this.ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + 0.003); g.gain.setTargetAtTime(0, t + 0.003, dec / 5); g.connect(node); return g; }
  _thump(S, t, f0, f1, pd, dec, g, dest) {
    if (!this._voice(S, t, dec * 1.4, 15)) return;
    const c = this.ctx, o = c.createOscillator(), e = this._env(S, t, g, dec, dest); o.type = 'sine';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + pd); o.connect(e); o.start(t); o.stop(t + dec * 1.4 + 0.02);
  }
  _nz(S, t, type, f, q, dec, g, dest, f1) {
    if (!this._voice(S, t, dec * 1.4, 15)) return;
    const c = this.ctx, s = c.createBufferSource(), fl = c.createBiquadFilter(), e = this._env(S, t, g, dec, dest);
    s.buffer = this.noise; fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q; if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dec);
    s.connect(fl); fl.connect(e); s.start(t, S.rng() * 1.5); s.stop(t + dec * 1.4 + 0.02);
  }
  _kick(S, t, v) { const d = S.L.drum.g; this._thump(S, t, 125, 46, 0.07, 0.32, 0.75 * v, d); this._nz(S, t, 'highpass', 2500, 0.5, 0.02, 0.1 * v, d); }
  _taiko(S, t, v, low) { const d = S.L.drum.g; this._thump(S, t, low ? 82 : 100, low ? 46 : 55, 0.16, low ? 0.7 : 1.2, 0.8 * v, d); this._nz(S, t, 'bandpass', 380, 0.8, 0.14, 0.28 * v, d); }
  _timp(S, t, v) { const d = S.L.drum.g; this._thump(S, t, 90, 66, 0.2, 1.8, 0.55 * v, d); this._nz(S, t, 'bandpass', 300, 0.8, 0.1, 0.12 * v, d); }
  _snare(S, t, v) { const d = S.L.drum.g; this._nz(S, t, 'bandpass', 3200, 0.55, 0.15, 0.42 * v, d); this._nz(S, t, 'highpass', 6500, 0.5, 0.07, 0.08 * v, d); this._thump(S, t, 230, 175, 0.05, 0.09, 0.32 * v, d); }
  _doum(S, t, v) { const d = S.L.drum.g; this._thump(S, t, 165, 98, 0.06, 0.34, 0.6 * v, d); this._nz(S, t, 'lowpass', 500, 0.7, 0.05, 0.1 * v, d); }
  _tak(S, t, v) { const d = S.L.drum.g; this._nz(S, t, 'bandpass', 2900, 5, 0.06, 0.42 * v, d); this._thump(S, t, 480, 380, 0.03, 0.05, 0.06 * v, d); }
  _frame(S, t, v) { const d = S.L.drum.g; this._thump(S, t, 120, 70, 0.1, 0.8, 0.55 * v, d); this._nz(S, t, 'bandpass', 260, 1, 0.12, 0.15 * v, d); }
  _riser(S, t, dur) { this._nz(S, t, 'bandpass', 260, 1.8, dur, 0.1, S.L.mel.g, 5200); }
}

export const MUSIC_THEMES = Object.keys(THEMES);
