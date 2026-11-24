// =====================================================================================
// Sudden Strike – prozedurales Sound-System (WebAudio, KEINE externen Dateien)
// -------------------------------------------------------------------------------------
// Alle Klänge werden beim Start / bei Bedarf als kleine Mono-Samples (32 kHz) in reinem JS
// berechnet (mehrere Zufallsvarianten je Klang, gecacht & wiederverwendet), dann über ein
// Mischpult mit Bussen, Faltungshall (selbst erzeugte Impulsantworten), Entfernungs-Tiefpass,
// Laufzeit-Verzögerung und Stereo-Panorama abgespielt. Master -> Kompressor -> Limiter (-1 dBFS).
//
// ÖFFENTLICHE API (alle Methoden sind fehlertolerant, unbekannte kinds -> sinnvoller Fallback)
//   init([ctx])                 beim ersten Nutzerklick aufrufen (optional fremder AudioContext, z. B. Offline-Test)
//   setVolume(v 0..1)           Gesamtlautstärke (nach dem Limiter)
//   listener = {x, z, zoom, yaw}  Hörer = Kameraziel; zoom = Kameradistanz; yaw (optional, rad) = Kamerarotation um Y:
//                               yaw=0 -> Bildschirm-rechts = +x; rechts-Vektor = (cos yaw, -sin yaw) in (x,z)
//   shot(kind, x, z)            Waffenschuss. kinds: rifle mg autocannon cannon missile flak sniper pistol smg
//                               ww2_rifle ww2_mg ww2_smg tank75 tank88 howitzer mortar rocket_salvo ak pkm dshk
//                               rpg bazooka atgm grenade (+ Aliase, z. B. 'tank'->cannon; unbekannt -> Heuristik/rifle)
//   explosion(x, z, size=1, type) Detonation; size ~0.3..4 (4 Klassen); type 'air' = Luftsprengpunkt
//   splash(x, z, size=1)        Wassereinschlag
//   engine(id, kind, x, z, speed)  Motor-/Antriebsschleife je Objekt-ID; jeden Frame (oder ~10x/s) aufrufen.
//                               kinds: tracked wheeled truck heli jet prop_plane fpv shahed boat jeep_ww2 tank_ww2
//                               speed in Welteinheiten/s (relativ zu kind-Höchstgeschwindigkeit, s. ENG.vmax);
//                               nur die `maxEngines` (8, Handy 5) nächsten Quellen klingen, Rest stumm.
//                               Nicht mehr aufgerufene IDs werden nach 0.6 s automatisch ausgeblendet.
//   stopEngine(id) / stopAllEngines()
//   drone(x, z)                 kurzes Drohnen-/Shahed-Surren (Einzelton, alt)
//   siren()  boom()             Luftalarm / Überschallknall
//   ui(kind)                    'click' 'ack' 'obj' 'fail' 'radio' 'warn' 'select' 'done' (unbekannt -> click)
//   radio(dur=1.2)              Funkspruch-Rauschen mit Klick am Anfang/Ende (Dauer in s)
//   ambient()                   startet Umgebung (wird von init() erledigt)
//   setAmbience({night, season:'spring|summer|autumn|winter', era:'ww1|ww2|afghan|modern', intensity 0..1, rain 0..1})
//   stats()                     Diagnose (Stimmen je Kategorie, Cache, CPU-ms der Sample-Erzeugung)
// =====================================================================================

export const SR = 32000;            // Samplerate der vorberechneten Puffer (wird vom Browser resampelt)
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---------------------------------------------------------------- DSP-Grundbausteine
function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

// Zustandsvariablen-Filter (TPT, unbedingt stabil)
class SVF {
  constructor() { this.i1 = 0; this.i2 = 0; this.lp = 0; this.bp = 0; this.hp = 0; this.set(1000, 0.7); }
  set(fc, q) {
    const g = Math.tan(Math.PI * Math.min(fc, SR * 0.45) / SR); const k = 1 / q;
    this.k = k; this.a1 = 1 / (1 + g * (g + k)); this.a2 = g * this.a1; this.a3 = g * this.a2;
  }
  run(x) {
    const v3 = x - this.i2, v1 = this.a1 * this.i1 + this.a2 * v3, v2 = this.i2 + this.a2 * this.i1 + this.a3 * v3;
    this.i1 = 2 * v1 - this.i1; this.i2 = 2 * v2 - this.i2;
    this.lp = v2; this.bp = this.k * v1; this.hp = x - this.k * v1 - v2; return v2;
  }
}

const fadeIn = (t, a) => 1 - Math.exp(-t / a);

// LP-gefilterter Rauschstoß mit exponentieller Hülle und Cutoff-Sweep f0 -> f1
function blast(out, r, at, a, tau, f0, f1, o = {}) {
  const s0 = (at * SR) | 0; if (s0 >= out.length || a <= 0) return;
  const len = Math.min(out.length - s0, ((o.len || tau * 6) * SR) | 0);
  const f = new SVF(), att = o.att || 0.0008, q = o.q || 0.7, sw = o.sweep || tau * 2.5, dk = Math.exp(-1 / (tau * SR)), ak = Math.exp(-1 / (att * SR));
  let comp = 1, env = a, ai = 1;
  for (let i = 0; i < len; i++) {
    if ((i & 15) === 0) { const fc = f0 * Math.pow(f1 / f0, Math.min(1, i / SR / sw)); f.set(fc, q); comp = Math.min(5, Math.sqrt(SR * 0.5 / Math.max(fc, 80))) * 0.5; if (env < a * 1e-4) break; }
    f.run(r() * 2 - 1);
    out[s0 + i] += f.lp * comp * env * (1 - ai); env *= dk; ai *= ak;
  }
}
// hochpassgefilterter Kurzimpuls (Mündungsknall / Überschall-Knack)
function crack(out, r, at, a, ms, hp) {
  const s0 = (at * SR) | 0; if (s0 >= out.length) return;
  const L = ms * SR / 1000, len = Math.min(out.length - s0, (L * 6) | 0), f = new SVF(); f.set(hp, 0.7);
  for (let i = 0; i < len; i++) { f.run(r() * 2 - 1); out[s0 + i] += f.hp * a * Math.exp(-i / L); }
}
function thump(out, at, a, f0, f1, tau) {
  const s0 = (at * SR) | 0; if (s0 >= out.length) return; const len = Math.min(out.length - s0, (tau * 6 * SR) | 0);
  let ph = 0;
  const dk = Math.exp(-1 / (tau * SR)), fk = Math.exp(-1 / (tau * 0.5 * SR)); let e = a, fe = f0 - f1, ai = 1;
  for (let i = 0; i < len; i++) { ph += TAU * (f1 + fe) / SR; out[s0 + i] += Math.sin(ph) * e * (1 - ai); e *= dk; fe *= fk; ai *= 0.97; }
}
function ring(out, at, a, f, tau) {
  const s0 = (at * SR) | 0; if (s0 >= out.length) return; const len = Math.min(out.length - s0, (tau * 7 * SR) | 0);
  for (let i = 0; i < len; i++) { const t = i / SR; out[s0 + i] += a * Math.sin(TAU * f * t) * Math.exp(-t / tau); }
}
function whoosh(out, r, at, a, dur, f0, f1, q, rise) {
  const s0 = (at * SR) | 0; if (s0 >= out.length) return; const len = Math.min(out.length - s0, (dur * SR) | 0), f = new SVF();
  for (let i = 0; i < len; i++) {
    const t = i / SR; if ((i & 7) === 0) f.set(f0 * Math.pow(f1 / f0, t / dur), q);
    f.run(r() * 2 - 1);
    out[s0 + i] += f.bp * a * fadeIn(t, rise) * Math.exp(-Math.max(0, t - dur * 0.55) / (dur * 0.18)) * 1.6;
  }
}
function chirp(out, at, a, f0, f1, dur, harm = 0.25) {
  const s0 = (at * SR) | 0; if (s0 >= out.length) return; const len = Math.min(out.length - s0, (dur * SR) | 0); let ph = 0;
  for (let i = 0; i < len; i++) {
    const u = i / len, f = f0 * Math.pow(f1 / f0, u); ph += TAU * f / SR; const w = Math.sin(Math.PI * u); const e = w * w;
    out[s0 + i] += a * e * (Math.sin(ph) + harm * Math.sin(2 * ph + 0.5));
  }
}
function bell(out, at, f, a, tau) {
  const P = [[1, 1, 1], [2.76, 0.32, 0.45], [5.4, 0.12, 0.25]], s0 = (at * SR) | 0; if (s0 >= out.length) return;
  const len = Math.min(out.length - s0, (tau * 6 * SR) | 0);
  for (let i = 0; i < len; i++) { const t = i / SR; let y = 0; for (const [m, pa, pt] of P) y += pa * Math.sin(TAU * f * m * t) * Math.exp(-t / (tau * pt)); out[s0 + i] += a * y * fadeIn(t, 0.0008); }
}
// DC entfernen, weich begrenzen, auf Pegel lv normieren (lv <= 0.88 = -1.1 dBFS), kurz ausblenden
function finish(out, lv) {
  const a = Math.exp(-TAU * 25 / SR); let px = 0, py = 0, peak = 0;
  for (let i = 0; i < out.length; i++) { const x = out[i]; py = a * (py + x - px); px = x; out[i] = py; const v = Math.abs(py); if (v > peak) peak = v; }
  if (peak < 1e-9) return out;
  const D = 1.8, k = 1 / peak, nrm = Math.min(lv, 0.88) / Math.tanh(D);
  for (let i = 0; i < out.length; i++) out[i] = Math.tanh(D * out[i] * k) * nrm;
  const fl = Math.min(out.length, (0.008 * SR) | 0); for (let i = 0; i < fl; i++) out[out.length - 1 - i] *= i / fl;
  return out;
}

// ---------------------------------------------------------------- Waffen
// crack {a,ms,hp}: Überschall-/Mündungsknack · bang {a,tau,f0,f1}: Knall · thump {a,f0,f1,tau}: Körper
// tail {a,tau,fc,d}: Reflexion · echo {n,from,to,a,fc}: Hall von Gelände · rep: Wiederholungen (Salve/Flak)
// gap = Mindestabstand in ms je Kachel (Drosselung), lv = Pegel
const SHOT = {
  rifle:      { dur: 0.8, lv: 0.55, gap: 40, crack: { a: 0.9, ms: 3, hp: 2000 }, bang: { a: 0.9, tau: 0.03, f0: 3800, f1: 900 }, thump: { a: 0.45, f0: 180, f1: 95, tau: 0.04 }, tail: { a: 0.14, tau: 0.3, fc: 1600, d: 0.015 }, echo: { n: 4, from: 0.06, to: 0.5, a: 0.07, fc: 1300 } },
  pistol:     { dur: 0.55, lv: 0.45, gap: 70, crack: { a: 0.8, ms: 2.5, hp: 2800 }, bang: { a: 0.8, tau: 0.02, f0: 4800, f1: 1300 }, thump: { a: 0.35, f0: 240, f1: 130, tau: 0.03 }, tail: { a: 0.1, tau: 0.2, fc: 2000, d: 0.01 }, echo: { n: 2, from: 0.05, to: 0.3, a: 0.05, fc: 1500 } },
  smg:        { dur: 0.45, lv: 0.45, gap: 35, crack: { a: 0.8, ms: 2.5, hp: 2600 }, bang: { a: 0.8, tau: 0.022, f0: 4200, f1: 1100 }, thump: { a: 0.4, f0: 220, f1: 120, tau: 0.03 }, tail: { a: 0.09, tau: 0.18, fc: 1800, d: 0.01 } },
  sniper:     { dur: 1.8, lv: 0.8, gap: 300, crack: { a: 1, ms: 4, hp: 1500 }, bang: { a: 1, tau: 0.08, f0: 3000, f1: 500 }, thump: { a: 0.7, f0: 120, f1: 55, tau: 0.1 }, tail: { a: 0.25, tau: 0.7, fc: 1000, d: 0.03 }, echo: { n: 6, from: 0.12, to: 1.2, a: 0.12, fc: 900 } },
  mg:         { dur: 0.5, lv: 0.6, gap: 40, crack: { a: 0.9, ms: 3, hp: 1700 }, bang: { a: 0.9, tau: 0.04, f0: 3000, f1: 700 }, thump: { a: 0.55, f0: 150, f1: 80, tau: 0.05 }, tail: { a: 0.12, tau: 0.25, fc: 1400, d: 0.01 } },
  autocannon: { dur: 0.9, lv: 0.75, gap: 60, crack: { a: 0.9, ms: 4, hp: 1200 }, bang: { a: 1, tau: 0.07, f0: 2000, f1: 380 }, thump: { a: 0.8, f0: 90, f1: 48, tau: 0.09 }, tail: { a: 0.2, tau: 0.4, fc: 900, d: 0.02 }, echo: { n: 3, from: 0.1, to: 0.6, a: 0.1, fc: 800 } },
  cannon:     { dur: 2.2, lv: 0.88, gap: 120, crack: { a: 0.8, ms: 5, hp: 900 }, bang: { a: 1, tau: 0.22, f0: 1800, f1: 220 }, thump: { a: 1, f0: 65, f1: 32, tau: 0.3 }, tail: { a: 0.3, tau: 1, fc: 700, d: 0.04 }, echo: { n: 6, from: 0.15, to: 1.4, a: 0.15, fc: 700 } },
  tank75:     { dur: 2.0, lv: 0.85, gap: 120, crack: { a: 0.9, ms: 4, hp: 1100 }, bang: { a: 1, tau: 0.18, f0: 2000, f1: 260 }, thump: { a: 0.9, f0: 72, f1: 36, tau: 0.25 }, tail: { a: 0.28, tau: 0.9, fc: 800, d: 0.03 }, echo: { n: 5, from: 0.12, to: 1.2, a: 0.14, fc: 750 }, ring: { a: 0.05, f: 1900, tau: 0.05 } },
  tank88:     { dur: 2.6, lv: 0.88, gap: 150, crack: { a: 1, ms: 5, hp: 900 }, bang: { a: 1, tau: 0.32, f0: 1500, f1: 160 }, thump: { a: 1.1, f0: 55, f1: 28, tau: 0.4 }, tail: { a: 0.35, tau: 1.2, fc: 650, d: 0.05 }, echo: { n: 7, from: 0.15, to: 1.6, a: 0.16, fc: 650 } },
  howitzer:   { dur: 3.6, lv: 0.88, gap: 200, crack: { a: 0.6, ms: 7, hp: 500 }, bang: { a: 1, tau: 0.5, f0: 1100, f1: 90 }, thump: { a: 1.2, f0: 45, f1: 24, tau: 0.6 }, tail: { a: 0.45, tau: 1.8, fc: 500, d: 0.06 }, echo: { n: 9, from: 0.2, to: 2.4, a: 0.2, fc: 500 } },
  mortar:     { dur: 1.3, lv: 0.6, gap: 150, bang: { a: 0.6, tau: 0.1, f0: 1000, f1: 300 }, thump: { a: 1, f0: 150, f1: 70, tau: 0.15 }, ring: { a: 0.18, f: 640, tau: 0.16 }, tail: { a: 0.15, tau: 0.5, fc: 600, d: 0.03 }, echo: { n: 3, from: 0.1, to: 0.8, a: 0.1, fc: 600 } },
  rocket_salvo: { dur: 4.0, lv: 0.8, gap: 400, rep: { n: 6, gap: 0.24, jit: 0.14, decay: 0.95 }, bang: { a: 0.7, tau: 0.15, f0: 2500, f1: 300 }, thump: { a: 0.6, f0: 80, f1: 40, tau: 0.2 }, whoosh: { a: 0.6, at: 0.03, dur: 1.3, f0: 1500, f1: 4200, q: 0.5, rise: 0.08 }, echo: { n: 3, from: 0.2, to: 1.5, a: 0.08, fc: 800 } },
  missile:    { dur: 1.6, lv: 0.6, gap: 120, bang: { a: 0.5, tau: 0.1, f0: 2800, f1: 400 }, thump: { a: 0.5, f0: 90, f1: 45, tau: 0.12 }, whoosh: { a: 0.9, at: 0.02, dur: 1.5, f0: 2000, f1: 5000, q: 0.5, rise: 0.12 } },
  flak:       { dur: 1.6, lv: 0.78, gap: 100, rep: { n: 3, gap: 0.085, jit: 0.02, decay: 0.85 }, crack: { a: 0.8, ms: 4, hp: 1100 }, bang: { a: 1, tau: 0.09, f0: 1800, f1: 300 }, thump: { a: 0.7, f0: 85, f1: 45, tau: 0.1 }, tail: { a: 0.2, tau: 0.5, fc: 900, d: 0.03 }, echo: { n: 4, from: 0.15, to: 1, a: 0.1, fc: 800 } },
  ww2_rifle:  { dur: 0.9, lv: 0.6, gap: 70, crack: { a: 0.9, ms: 3.5, hp: 1700 }, bang: { a: 1, tau: 0.045, f0: 2800, f1: 600 }, thump: { a: 0.6, f0: 150, f1: 75, tau: 0.06 }, tail: { a: 0.16, tau: 0.35, fc: 1300, d: 0.015 }, echo: { n: 4, from: 0.06, to: 0.6, a: 0.08, fc: 1100 }, ring: { a: 0.04, f: 2300, tau: 0.03 }, mech: { at: 0.5, a: 0.12 } },
  ww2_mg:     { dur: 0.4, lv: 0.55, gap: 28, crack: { a: 1, ms: 2.5, hp: 2200 }, bang: { a: 0.8, tau: 0.025, f0: 3400, f1: 900 }, thump: { a: 0.4, f0: 170, f1: 90, tau: 0.035 }, tail: { a: 0.08, tau: 0.15, fc: 1600, d: 0.008 } },
  ww2_smg:    { dur: 0.45, lv: 0.48, gap: 40, crack: { a: 0.8, ms: 2.5, hp: 2300 }, bang: { a: 0.85, tau: 0.026, f0: 3600, f1: 900 }, thump: { a: 0.45, f0: 200, f1: 105, tau: 0.035 }, tail: { a: 0.09, tau: 0.2, fc: 1500, d: 0.01 } },
  ak:         { dur: 0.7, lv: 0.58, gap: 45, crack: { a: 1, ms: 3.5, hp: 1500 }, bang: { a: 0.95, tau: 0.04, f0: 3200, f1: 700 }, thump: { a: 0.5, f0: 160, f1: 85, tau: 0.05 }, tail: { a: 0.14, tau: 0.3, fc: 1400, d: 0.012 }, echo: { n: 3, from: 0.06, to: 0.5, a: 0.07, fc: 1200 } },
  pkm:        { dur: 0.55, lv: 0.62, gap: 42, crack: { a: 1, ms: 3.5, hp: 1400 }, bang: { a: 1, tau: 0.045, f0: 2700, f1: 620 }, thump: { a: 0.65, f0: 140, f1: 72, tau: 0.055 }, tail: { a: 0.13, tau: 0.28, fc: 1250, d: 0.01 } },
  dshk:       { dur: 1.0, lv: 0.75, gap: 70, crack: { a: 1, ms: 4.5, hp: 1100 }, bang: { a: 1, tau: 0.06, f0: 2300, f1: 420 }, thump: { a: 0.95, f0: 95, f1: 48, tau: 0.08 }, tail: { a: 0.22, tau: 0.5, fc: 900, d: 0.02 }, echo: { n: 4, from: 0.1, to: 0.8, a: 0.1, fc: 850 } },
  rpg:        { dur: 1.8, lv: 0.75, gap: 200, crack: { a: 0.5, ms: 4, hp: 900 }, bang: { a: 0.8, tau: 0.12, f0: 2200, f1: 280 }, thump: { a: 0.7, f0: 80, f1: 40, tau: 0.15 }, whoosh: { a: 0.7, at: 0.04, dur: 1.4, f0: 1200, f1: 3800, q: 0.5, rise: 0.1 }, echo: { n: 3, from: 0.15, to: 1, a: 0.1, fc: 800 } },
  bazooka:    { dur: 1.8, lv: 0.72, gap: 200, bang: { a: 0.7, tau: 0.14, f0: 1800, f1: 260 }, thump: { a: 0.75, f0: 70, f1: 36, tau: 0.18 }, whoosh: { a: 0.65, at: 0.05, dur: 1.5, f0: 1000, f1: 3000, q: 0.45, rise: 0.12 }, ring: { a: 0.05, f: 900, tau: 0.08 }, echo: { n: 3, from: 0.15, to: 1, a: 0.1, fc: 700 } },
  atgm:       { dur: 2.6, lv: 0.6, gap: 300, bang: { a: 0.35, tau: 0.06, f0: 2500, f1: 500 }, thump: { a: 0.6, f0: 110, f1: 55, tau: 0.1 }, whoosh: { a: 0.8, at: 0.05, dur: 2.4, f0: 3500, f1: 2200, q: 0.6, rise: 0.25 } },
  grenade:    { dur: 0.7, lv: 0.5, gap: 120, bang: { a: 0.45, tau: 0.05, f0: 1500, f1: 400 }, thump: { a: 1, f0: 210, f1: 90, tau: 0.07 }, ring: { a: 0.08, f: 1250, tau: 0.04 }, tail: { a: 0.08, tau: 0.25, fc: 900, d: 0.02 } },
};
export const SHOT_KINDS = Object.keys(SHOT);

function synthShot(kind, seed) {
  const p = SHOT[kind] || SHOT.rifle, r = rng(seed), J = (v, s = 0.12) => v * (1 + (r() * 2 - 1) * s);
  const out = new Float32Array((p.dur * SR) | 0), reps = p.rep ? p.rep.n : 1;
  for (let k = 0; k < reps; k++) {
    const at = p.rep ? Math.max(0, k * p.rep.gap + (r() - 0.5) * p.rep.jit) : 0, am = (p.rep ? Math.pow(p.rep.decay, k) : 1) * J(1, 0.15);
    if (p.crack) crack(out, r, at, p.crack.a * am, J(p.crack.ms, 0.2), J(p.crack.hp, 0.15));
    if (p.bang) blast(out, r, at, p.bang.a * am, J(p.bang.tau, 0.15), J(p.bang.f0, 0.12), J(p.bang.f1, 0.15));
    if (p.thump) thump(out, at, p.thump.a * am, J(p.thump.f0, 0.08), J(p.thump.f1, 0.08), J(p.thump.tau, 0.12));
    if (p.tail) blast(out, r, at + p.tail.d, p.tail.a * am, J(p.tail.tau, 0.15), p.tail.fc, p.tail.fc * 0.45, { att: 0.02 });
    if (p.echo) for (let e = 0; e < p.echo.n; e++) { const d = p.echo.from + r() * (p.echo.to - p.echo.from); blast(out, r, at + d, p.echo.a * am * Math.exp(-d / (p.echo.to * 0.8)) * (0.5 + r()), 0.03 + r() * 0.05, p.echo.fc * (0.7 + r() * 0.6), p.echo.fc * 0.4, { att: 0.008 }); }
    if (p.ring) ring(out, at, p.ring.a * am, J(p.ring.f, 0.05), p.ring.tau);
    if (p.whoosh) { const w = p.whoosh; whoosh(out, r, at + w.at, w.a * am, J(w.dur, 0.1), J(w.f0, 0.1), J(w.f1, 0.1), w.q, w.rise); }
    if (p.mech) { crack(out, r, p.mech.at, p.mech.a, 1.5, 1800); ring(out, p.mech.at + 0.03, p.mech.a * 0.35, 2400, 0.02); crack(out, r, p.mech.at + 0.09, p.mech.a * 0.8, 1.5, 1500); }
  }
  return finish(out, p.lv);
}

// ---------------------------------------------------------------- Explosionen / Wasser
const EXPL = [
  { dur: 1.9, lv: 0.7, tau: 0.16, f0: 4500, f1: 300, sub: [0.8, 95, 42, 0.28], rum: [0.5, 0.5, 160], deb: 5, c: 0.5 },
  { dur: 3.0, lv: 0.8, tau: 0.3, f0: 3800, f1: 220, sub: [1, 75, 34, 0.45], rum: [0.7, 0.9, 140], deb: 9, c: 1 },
  { dur: 4.2, lv: 0.88, tau: 0.5, f0: 3000, f1: 160, sub: [1.1, 60, 28, 0.65], rum: [0.9, 1.4, 120], deb: 14, c: 2 },
  { dur: 5.5, lv: 0.88, tau: 0.8, f0: 2500, f1: 110, sub: [1.2, 48, 24, 0.9], rum: [1, 2, 100], deb: 20, c: 3.5 },
];
const explClass = (size) => (size < 0.75 ? 0 : size < 1.5 ? 1 : size < 2.6 ? 2 : 3);
function synthExplosion(cls, seed, air) {
  const P = EXPL[cls], r = rng(seed), J = (v, s = 0.12) => v * (1 + (r() * 2 - 1) * s), out = new Float32Array((P.dur * SR) | 0);
  crack(out, r, 0, air ? 1.2 : 0.8, 5 + cls, air ? 1400 : 800);
  blast(out, r, 0.002, 1, J(P.tau, 0.15) * (air ? 0.6 : 1), air ? P.f0 * 1.4 : P.f0, J(P.f1, 0.2), { q: 0.7 });
  if (!air) {
    thump(out, 0.004, P.sub[0], J(P.sub[1], 0.08), P.sub[2], P.sub[3]);
    blast(out, r, 0.03, P.rum[0] * 0.7, P.rum[1] * 0.45, P.rum[2], P.rum[2] * 0.5, { att: 0.06, len: P.rum[1] * 2.6 });            // Erd-Nachrollen
    for (let i = 0; i < P.deb; i++) {                                                                                                // Trümmer
      const t = 0.15 + Math.pow(r(), 1.5) * P.dur * 0.55, a = 0.22 * Math.exp(-t / (P.dur * 0.4)) * (0.5 + r());
      blast(out, r, t, a, 0.02 + r() * 0.05, 400 + r() * 1400, 150, { att: 0.003 });
      if (r() < 0.35) ring(out, t, a * 0.2, 2200 + r() * 2800, 0.02);
    }
  } else {
    thump(out, 0.004, P.sub[0] * 0.25, 110, 55, 0.2);
    for (let i = 0; i < 18 + cls * 6; i++) { const t = 0.05 + r() * P.dur * 0.35; crack(out, r, t, 0.3 * Math.exp(-t / 0.5) * r(), 2, 2200 + r() * 2000); }   // Splitter-Prasseln
    blast(out, r, 0.1, 0.25, 0.5 + cls * 0.2, 900, 250, { att: 0.04 });
  }
  return finish(out, P.lv);
}
const SPLASH = [
  { dur: 0.9, lv: 0.5, tau: 0.16, f: [800, 3200], low: 350, bub: 5 },
  { dur: 1.5, lv: 0.62, tau: 0.28, f: [600, 2800], low: 280, bub: 9 },
  { dur: 2.4, lv: 0.75, tau: 0.45, f: [400, 2400], low: 220, bub: 14 },
];
function synthSplash(cls, seed) {
  const P = SPLASH[cls], r = rng(seed), out = new Float32Array((P.dur * SR) | 0);
  blast(out, r, 0, 1, P.tau, P.f[0], P.f[1], { att: 0.012, sweep: 0.07, q: 0.9 });
  blast(out, r, 0.005, 0.8, P.tau * 1.3, P.low * 1.5, P.low * 0.6, { att: 0.01 });
  thump(out, 0.01, 0.55, 150, 62, P.tau * 0.8);
  for (let i = 0; i < P.bub; i++) {                                                           // Blasen
    const t = 0.05 + Math.pow(r(), 1.3) * P.dur * 0.6, f = 300 + r() * 600;
    chirp(out, t, 0.13 * Math.exp(-t / (P.dur * 0.4)), f, f * (1.4 + r() * 0.6), 0.03 + r() * 0.06, 0);
  }
  for (let i = 0; i < 6 + P.bub; i++) { const t = 0.08 + r() * P.dur * 0.6; ring(out, t, 0.05 * Math.exp(-t / 0.5), 2200 + r() * 2500, 0.006); }   // Tropfen
  return finish(out, P.lv);
}

// ---------------------------------------------------------------- Motorschleifen (2 s, nahtlos)
const ENG_N = SR * 2;
function loopNoise(r, fc, passes = 2) {       // zirkulär gefiltertes Rauschen, auf RMS 1 normiert
  const n = ENG_N, a = 1 - Math.exp(-TAU * fc / SR); let x = new Float32Array(n), y = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = r() * 2 - 1;
  for (let p = 0; p < passes; p++) { let s = 0; for (let q = 0; q < 2; q++) for (let i = 0; i < n; i++) { s += a * (x[i] - s); if (q === 1) y[i] = s; } const t = x; x = y; y = t; }
  let e = 0; for (let i = 0; i < n; i++) e += x[i] * x[i]; const g = 1 / Math.sqrt(e / n + 1e-12); for (let i = 0; i < n; i++) x[i] *= g; return x;
}
function addNoise(out, nz, a, am) { for (let i = 0; i < out.length; i++) out[i] += nz[i] * a * (am ? am(i) : 1); }
function addHarm(out, f, K, pw, a, shape) {   // f muss ein Vielfaches von 0.5 Hz sein (nahtlos)
  for (let k = 1; k <= K; k++) {
    let ak = a / Math.pow(k, pw); if (shape) ak *= shape(k * f); if (k * f > SR * 0.45) break;
    const w = TAU * k * f / SR, c = Math.cos(w), s = Math.sin(w); let sn = Math.sin(k * 1.7), cs = Math.cos(k * 1.7);
    for (let i = 0; i < out.length; i++) { out[i] += ak * sn; const t = sn * c + cs * s; cs = cs * c - sn * s; sn = t; }
  }
}
const lfo = (m, d, ph = 0) => (i) => 1 + d * Math.sin(TAU * m * i / ENG_N + ph);
function grainWrap(out, r, pos, len, fc, a) {
  const n = out.length, k = 1 - Math.exp(-TAU * fc / SR), c = Math.min(4, Math.sqrt(SR * 0.5 / fc)) * 0.5; let y = 0, y2 = 0;
  for (let i = 0; i < len; i++) { y += k * ((r() * 2 - 1) - y); y2 += k * (y - y2); out[(pos + i) % n] += y2 * c * a * Math.exp(-i / (len * 0.3)); }
}
function clanks(out, r, count, fc, a, ring_f) {
  for (let i = 0; i < count; i++) {
    const pos = ((i + 0.5 + (r() - 0.5) * 0.5) / count * ENG_N) | 0, amp = a * (0.45 + r() * 0.55);
    grainWrap(out, r, pos, (0.03 * SR) | 0, fc * (0.8 + r() * 0.5), amp);
    const f = ring_f * (0.9 + r() * 0.3), n = (0.025 * SR) | 0; for (let j = 0; j < n; j++) out[(pos + j) % ENG_N] += amp * 0.22 * Math.sin(TAU * f * j / SR) * Math.exp(-j / (0.008 * SR));
  }
}
function synthEngine(kind, seed) {
  const r = rng(seed), out = new Float32Array(ENG_N), nz = (fc, a, am) => addNoise(out, loopNoise(r, fc), a, am);
  const nasal = (c, w) => (f) => 1 + 2.5 * Math.exp(-(((f - c) / w) ** 2));
  switch (kind) {
    case 'tank_ww2': nz(90, 1, lfo(5, 0.3)); addHarm(out, 20, 16, 1.1, 0.6, null); clanks(out, r, 26, 700, 0.9, 1100); addHarm(out, 1250, 1, 0, 0.03, null); addHarm(out, 1900, 1, 0, 0.02, null); break;
    case 'wheeled': nz(150, 0.5); addHarm(out, 32, 18, 1.0, 0.6, null); nz(900, 0.15); addHarm(out, 300, 1, 0, 0.03, null); break;
    case 'truck': nz(100, 0.6, lfo(11, 0.3)); addHarm(out, 22, 20, 0.95, 0.7, null); clanks(out, r, 16, 1000, 0.12, 1700); addHarm(out, 410, 1, 0, 0.02, null); break;
    case 'jeep_ww2': addHarm(out, 42, 30, 0.8, 0.6, null); nz(1800, 0.1, lfo(21, 0.4)); clanks(out, r, 28, 1400, 0.1, 2100); nz(300, 0.25); break;
    case 'heli': {
      const am = lfo(22, 0.6, 0.5);
      for (let i = 0; i < 22; i++) { const pos = (i / 22 * ENG_N) | 0, a = 0.8 * (i % 2 ? 0.85 : 1); grainWrap(out, r, pos, (0.04 * SR) | 0, 500, a * 2); for (let j = 0; j < 1200; j++) out[(pos + j) % ENG_N] += a * 0.8 * Math.sin(TAU * 62 * j / SR) * Math.exp(-j / (0.012 * SR)); }
      addHarm(out, 48, 8, 1, 0.12, null); addHarm(out, 1700, 1, 0, 0.05, lfo(5, 0.2)); addHarm(out, 2550, 1, 0, 0.03, null); nz(2500, 0.12, am); nz(180, 0.3); break;
    }
    case 'jet': { const rough = loopNoise(r, 14); nz(2500, 0.6, (i) => 1 + 0.2 * rough[i]); nz(400, 0.8, (i) => 1 + 0.2 * rough[i]); addHarm(out, 1800, 1, 0, 0.06, null); addHarm(out, 2700, 1, 0, 0.04, null); addHarm(out, 4200, 1, 0, 0.02, null); break; }
    case 'prop_plane': addHarm(out, 36, 24, 0.85, 0.6, null); addHarm(out, 36.5, 24, 0.9, 0.5, null); nz(700, 0.15); addHarm(out, 18, 4, 1, 0.3, lfo(3, 0.3)); break;
    case 'fpv': for (const f of [640, 665, 702, 718]) addHarm(out, f, 10, 1.0, 0.3, null); nz(5000, 0.1, lfo(11, 0.3)); break;
    case 'shahed': addHarm(out, 78, 40, 0.65, 0.6, nasal(950, 250)); nz(1500, 0.15); { const am = lfo(30, 0.25); for (let i = 0; i < out.length; i++) out[i] *= am(i); } break;
    case 'boat': addHarm(out, 28, 12, 1.2, 0.6, null); { const am = lfo(16, 0.5); for (let i = 0; i < out.length; i++) out[i] *= am(i); } nz(250, 0.8, lfo(18, 0.4)); nz(4000, 0.1); break;
    case 'tracked': default: nz(110, 0.9, lfo(7, 0.35)); addHarm(out, 24, 16, 1.15, 0.55, null); addHarm(out, 36, 6, 1.0, 0.15, null); clanks(out, r, 20, 900, 0.55, 1100); addHarm(out, 2350, 1, 0, 0.02, lfo(3, 0.2)); addHarm(out, 3100, 1, 0, 0.015, null);
  }
  let m = 0, pk = 0; for (let i = 0; i < out.length; i++) m += out[i]; m /= out.length;
  for (let i = 0; i < out.length; i++) { out[i] -= m; const v = Math.abs(out[i]); if (v > pk) pk = v; }
  const k = 1 / (pk + 1e-9); for (let i = 0; i < out.length; i++) out[i] = Math.tanh(1.2 * out[i] * k) * 0.8 / Math.tanh(1.2);
  return out;
}
const ENG = {
  tracked: { vmax: 7, g: 0.55, r0: 0.8, r1: 1.3 }, tank_ww2: { vmax: 6, g: 0.6, r0: 0.8, r1: 1.25 },
  wheeled: { vmax: 14, g: 0.5, r0: 0.75, r1: 1.4 }, truck: { vmax: 12, g: 0.5, r0: 0.75, r1: 1.35 }, jeep_ww2: { vmax: 15, g: 0.45, r0: 0.8, r1: 1.35 },
  heli: { vmax: 30, g: 0.6, r0: 0.92, r1: 1.12, air: 1 }, jet: { vmax: 90, g: 0.6, r0: 0.85, r1: 1.3, air: 1 }, prop_plane: { vmax: 60, g: 0.5, r0: 0.85, r1: 1.25, air: 1 },
  fpv: { vmax: 35, g: 0.35, r0: 0.8, r1: 1.5, air: 1 }, shahed: { vmax: 35, g: 0.4, r0: 0.9, r1: 1.15, air: 1 }, boat: { vmax: 12, g: 0.5, r0: 0.8, r1: 1.4 },
};
export const ENGINE_KINDS = Object.keys(ENG);

// ---------------------------------------------------------------- UI / Funk / Sirene / Überschall
const UI = {
  click: { dur: 0.12, lv: 0.35, gap: 25, make: (o, r) => { bell(o, 0, 2400, 0.8, 0.008); bell(o, 0, 3600, 0.3, 0.006); crack(o, r, 0, 0.12, 1, 3000); } },
  select: { dur: 0.12, lv: 0.3, gap: 25, make: (o, r) => { bell(o, 0, 1800, 0.8, 0.012); crack(o, r, 0, 0.08, 1, 2500); } },
  ack: { dur: 0.4, lv: 0.35, gap: 40, make: (o) => { bell(o, 0, 1568, 0.8, 0.06); bell(o, 0.065, 2093, 0.8, 0.07); } },
  done: { dur: 0.45, lv: 0.4, gap: 40, make: (o) => { bell(o, 0, 1318, 0.8, 0.07); bell(o, 0.07, 1760, 0.8, 0.08); bell(o, 0.14, 2217, 0.6, 0.09); } },
  obj: { dur: 1.9, lv: 0.5, gap: 200, make: (o) => { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => { bell(o, [0, 0.11, 0.22, 0.36][i], f, 0.7, 0.45); bell(o, [0, 0.11, 0.22, 0.36][i], f * 0.5, 0.25, 0.5); }); [523.25, 659.25, 783.99].forEach((f) => bell(o, 0.42, f, 0.35, 0.7)); } },
  fail: { dur: 1.2, lv: 0.5, gap: 200, make: (o) => {
    const tone = (at, f, a, tau) => { const s0 = (at * SR) | 0, len = Math.min(o.length - s0, (tau * 6 * SR) | 0); let lp = 0; const k = 1 - Math.exp(-TAU * 900 / SR);
      for (let i = 0; i < len; i++) { const t = i / SR; let y = 0; for (let h = 1; h <= 6; h++) y += Math.sin(TAU * f * h * t) / h; lp += k * (y - lp); o[s0 + i] += a * lp * fadeIn(t, 0.015) * Math.exp(-t / tau); } };
    tone(0, 311.13, 0.8, 0.25); tone(0.2, 233.08, 0.8, 0.35); tone(0.2, 246.94, 0.35, 0.35); } },
  warn: { dur: 0.45, lv: 0.4, gap: 300, make: (o) => { ring(o, 0, 0.8, 880, 0.06); ring(o, 0.2, 0.8, 880, 0.06); } },
};
function synthUI(kind, seed) { const p = UI[kind] || UI.click, r = rng(seed), o = new Float32Array((p.dur * SR) | 0); p.make(o, r); return finish(o, p.lv); }
function synthRadio(seed, dur = 0.5) {
  const r = rng(seed), n = Math.max(1, (dur * SR) | 0), o = new Float32Array(n), f = new SVF(); f.set(1700, 0.9);
  crack(o, r, 0, 0.9, 2, 800); blast(o, r, 0.002, 0.6, 0.02, 3000, 1200, { att: 0.002 });                  // Squelch-Klick
  const s1 = (0.015 * SR) | 0, s2 = Math.max(s1 + 1, n - ((0.06 * SR) | 0)), flut = 0.5 + r() * 2;
  for (let i = s1; i < s2; i++) {
    const t = i / SR; const sp = r() < 0.0025 ? (r() * 2 - 1) * 3 : 0; f.run(r() * 2 - 1 + sp);
    o[i] += f.bp * 0.7 * (0.3 + 0.7 * Math.exp(-t / 0.12)) * (0.8 + 0.2 * Math.sin(TAU * flut * t)) * fadeIn(t, 0.01);
  }
  const e = Math.max(0, dur - 0.055); crack(o, r, e, 0.7, 2.5, 1000); blast(o, r, e + 0.003, 0.35, 0.035, 2600, 900, { att: 0.002 });   // Ende-Klick + Kshh
  return finish(o, 0.5);
}
function synthSiren(seed) {
  const r = rng(seed), n = (4.4 * SR) | 0, o = new Float32Array(n); let ph = 0, lag = 430, lp = 0; const k = 1 - Math.exp(-TAU * 1800 / SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR, tgt = 430 + 330 * (0.5 - 0.5 * Math.cos(TAU * t / 2.2)); lag += (tgt - lag) * 0.0008; ph += TAU * lag / SR;
    let y = 0; for (let h = 1; h <= 7; h++) y += Math.sin(h * ph) / Math.pow(h, 1.2);
    lp += k * (y - lp); o[i] = (lp + (r() * 2 - 1) * 0.03) * (0.9 + 0.1 * Math.sin(TAU * 5.5 * t)) * Math.min(fadeIn(t, 0.4), 1) * Math.min(1, (4.4 - t) / 0.6);
  }
  return finish(o, 0.6);
}
function synthBoom(seed) {
  const r = rng(seed), o = new Float32Array((1.8 * SR) | 0);
  [[0, 1], [0.11, 0.8]].forEach(([at, a]) => { crack(o, r, at, a, 6, 300); thump(o, at, a * 0.9, 55, 30, 0.25); blast(o, r, at, a * 0.8, 0.3, 1200, 120); });
  blast(o, r, 0.05, 0.5, 0.6, 200, 60, { att: 0.05, len: 1.6 });
  return finish(o, 0.88);
}

// ---------------------------------------------------------------- Natur
function synthBird(idx, seed) {
  const r = rng(seed * 7 + idx * 131 + 1), o = new Float32Array((1.4 * SR) | 0); let t = 0.02, f;
  switch (idx % 6) {
    case 0: f = 3200 + r() * 1200; for (let k = 0, m = 6 + ((r() * 5) | 0); k < m; k++) { chirp(o, t, 0.6, f * (1 + k * 0.03), f * 1.25, 0.05); t += 0.075; } break;
    case 1: f = 3800 + r() * 800; chirp(o, t, 0.6, f, f * 0.6, 0.28); chirp(o, t + 0.35, 0.5, f * 0.9, f * 0.55, 0.3); break;
    case 2: for (let k = 0; k < 3; k++) { chirp(o, t, 0.6, 2800, 4200, 0.09); chirp(o, t + 0.11, 0.5, 4000, 3000, 0.08); t += 0.32; } break;
    case 3: for (let k = 0; k < 9; k++) { f = 2500 + r() * 3000; chirp(o, t, 0.5, f, f * (0.7 + r() * 0.7), 0.04 + r() * 0.06); t += 0.07 + r() * 0.05; } break;
    case 4: chirp(o, t, 0.7, 760, 620, 0.22, 0.15); chirp(o, t + 0.3, 0.7, 620, 500, 0.26, 0.15); break;
    default: for (let k = 0; k < 2; k++) { const s0 = ((t + k * 0.4) * SR) | 0, len = (0.3 * SR) | 0; let ph = 0; for (let i = 0; i < len && s0 + i < o.length; i++) { const u = i / len, ff = 520 - 130 * u; ph += TAU * ff / SR; let y = 0; for (let h = 1; h <= 8; h++) y += Math.sin(h * ph) / h; o[s0 + i] += y * Math.sin(Math.PI * u) * (0.7 + 0.3 * Math.sin(TAU * 70 * u * 0.3)); } }   // Krähe
  }
  return finish(o, 0.45);
}
function synthOwl(seed) {
  const o = new Float32Array((1.7 * SR) | 0);
  [[0.05, 400, 0.4], [0.6, 360, 0.5]].forEach(([at, f, d]) => chirp(o, at, 0.8, f * 1.03, f * 0.95, d, 0.3));
  return finish(o, 0.4);
}
function synthAmb(kind, seed) {
  const r = rng(seed + 11), o = new Float32Array(kind === 'cricket' ? SR * 4 : SR * 6);
  if (kind === 'wind') { const n = o.length, a = 1 - Math.exp(-TAU * 700 / SR), x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = r() * 2 - 1;
    for (let p = 0; p < 3; p++) { let s = 0; for (let q = 0; q < 2; q++) for (let i = 0; i < n; i++) { s += a * (x[i] - s); if (q === 1) o[i] = s; } for (let i = 0; i < n; i++) x[i] = o[i]; } return finish(o, 0.8); }
  if (kind === 'rain') { const n = o.length, a1 = 1 - Math.exp(-TAU * 900 / SR), a2 = 1 - Math.exp(-TAU * 9000 / SR); let s1 = 0, s2 = 0;
    for (let q = 0; q < 2; q++) for (let i = 0; i < n; i++) { const x = r() * 2 - 1 + (r() < 0.002 ? (r() * 2 - 1) * 4 : 0); s1 += a1 * (x - s1); s2 += a2 * (x - s2); if (q === 1) o[i] = s2 - s1; } return finish(o, 0.8); }
  const n = o.length;                                                                                  // Grillen: Gruppen aus 4 kurzen Pulsen
  for (let c = 0; c < 5; c++) {
    const rate = 6 + c, f = 4200 + c * 170 + r() * 60, ph0 = r(), a = 0.5 - c * 0.05;
    for (let g = 0; g < rate * 4; g++) { const gt = ((g + ph0) / rate) % 4;
      for (let pl = 0; pl < 4; pl++) { const s0 = ((gt + pl * 0.022) * SR) | 0, L = (0.011 * SR) | 0; for (let i = 0; i < L; i++) o[(s0 + i) % n] += a * Math.sin(TAU * f * i / SR) * Math.pow(Math.sin(Math.PI * i / L), 2); } }
  }
  return finish(o, 0.5);
}

// ---------------------------------------------------------------- Impulsantworten (Faltungshall)
function genIR(sr, longIR, seed) {
  const L = longIR ? 2.8 : 0.5, n = (L * sr) | 0, tauD = longIR ? 0.5 : 0.09, pd = longIR ? 0.03 : 0.004, ch = [new Float32Array(n), new Float32Array(n)], r = rng(seed);
  for (let c = 0; c < 2; c++) {
    const o = ch[c]; let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr; if (t < pd) continue;
      const fc = longIR ? 5000 * Math.pow(0.1, t / L) : 7000 * Math.pow(0.25, t / L), a = 1 - Math.exp(-TAU * fc / sr);
      lp += a * ((r() * 2 - 1) - lp); o[i] = lp * Math.exp(-(t - pd) / tauD) * Math.min(1, (t - pd) / 0.015) * Math.min(1, (L - t) / (L * 0.15));
    }
    const taps = longIR ? [0.12, 0.21, 0.37, 0.55, 0.8] : [0.008, 0.013, 0.021, 0.034, 0.047, 0.06, 0.075];                 // Einzelreflexionen
    taps.forEach((tt, k) => { const s0 = ((tt * (1 + (r() - 0.5) * 0.2)) * sr) | 0, a = (longIR ? 0.5 : 1.2) * Math.exp(-k * 0.35) * (r() < 0.5 ? -1 : 1); for (let j = 0; j < 8 && s0 + j < n; j++) o[s0 + j] += a * Math.exp(-j / 3) * (longIR ? 0.4 : 0.6); });
  }
  return ch;
}

// ---------------------------------------------------------------- Auflösung von kind-Namen
const ALIAS = { machinegun: 'mg', gun: 'rifle', tank: 'cannon', mg42: 'ww2_mg', mp40: 'ww2_smg', k98: 'ww2_rifle', ak47: 'ak', rocket: 'rocket_salvo', katyusha: 'rocket_salvo', pak: 'tank75' };
const kindCache = new Map();
function resolveShot(k) {
  if (SHOT[k]) return k; let v = kindCache.get('s' + k); if (v) return v; const s = String(k == null ? '' : k).toLowerCase();
  if (SHOT[s]) v = s; else if (ALIAS[s]) v = ALIAS[s];
  else if (/howitz|artill|arty|haubitz/.test(s)) v = 'howitzer'; else if (/mortar|moerser|granatw/.test(s)) v = 'mortar';
  else if (/rocket|katyusha|grad|salvo|werfer/.test(s)) v = 'rocket_salvo'; else if (/atgm|atgw|javelin|konkurs|milan|\btow\b/.test(s)) v = 'atgm';
  else if (/rpg|panzerfaust|panzerschreck/.test(s)) v = 'rpg'; else if (/bazooka/.test(s)) v = 'bazooka'; else if (/missile|sam|stinger|lenkwaffe/.test(s)) v = 'missile';
  else if (/88/.test(s)) v = 'tank88'; else if (/75|76/.test(s)) v = 'tank75'; else if (/tank|cannon|kanone|at_gun|panzer/.test(s)) v = 'cannon';
  else if (/flak|\baa\b/.test(s)) v = 'flak'; else if (/sniper|scharf/.test(s)) v = 'sniper'; else if (/dshk|hmg|heavy/.test(s)) v = 'dshk';
  else if (/smg|\bmp\d|pps|thompson/.test(s)) v = /ww2/.test(s) ? 'ww2_smg' : 'smg'; else if (/mg|machine/.test(s)) v = /ww2/.test(s) ? 'ww2_mg' : 'mg';
  else if (/pistol|handgun|revolver/.test(s)) v = 'pistol'; else if (/nade|grenade/.test(s)) v = 'grenade'; else v = 'rifle';
  kindCache.set('s' + k, v); return v;
}
function resolveEngine(k) {
  if (ENG[k]) return k; let v = kindCache.get('e' + k); if (v) return v; const s = String(k == null ? '' : k).toLowerCase();
  if (ENG[s]) v = s; else if (/heli|rotor|hubschr/.test(s)) v = 'heli'; else if (/jet|fighter|bomber|jager/.test(s)) v = 'jet'; else if (/prop|plane|flugz|aircraft/.test(s)) v = 'prop_plane';
  else if (/fpv|quad/.test(s)) v = 'fpv'; else if (/shahed|loiter|drone|kamikaze|uav/.test(s)) v = 'shahed'; else if (/boat|ship|schiff|boot/.test(s)) v = 'boat';
  else if (/jeep|kuebel|kubel/.test(s)) v = 'jeep_ww2'; else if (/ww2.*(tank|track)|(tank|track).*ww2|panzer/.test(s)) v = 'tank_ww2'; else if (/truck|lkw/.test(s)) v = 'truck';
  else if (/wheel|apc|btr|rad/.test(s)) v = 'wheeled'; else v = 'tracked';
  kindCache.set('e' + k, v); return v;
}

// Für Offline-Tests/Tools: reine Sample-Erzeugung ohne WebAudio
export const synth = {
  shot: (kind, seed = 1) => synthShot(resolveShot(kind), seed), explosion: (cls, seed = 1, air = false) => synthExplosion(cls, seed, air), splash: (cls, seed = 1) => synthSplash(cls, seed),
  engine: (kind, seed = 1) => synthEngine(resolveEngine(kind), seed), ui: (kind, seed = 1) => synthUI(kind, seed), radio: (seed = 1, dur = 0.5) => synthRadio(seed, dur),
  siren: (seed = 1) => synthSiren(seed), boom: (seed = 1) => synthBoom(seed), bird: (i, seed = 1) => synthBird(i, seed), owl: (seed = 1) => synthOwl(seed), amb: (k, seed = 1) => synthAmb(k, seed),
};

// Fernkampf je Epoche: k = Waffe (oder '_expl'), n = Anzahl Schuss, gap = Abstand s, w = Gewicht
const ERA_FAR = {
  ww1: [{ k: 'howitzer', n: [1, 3], gap: [0.6, 2.5], w: 0.6 }, { k: 'ww2_mg', n: [4, 12], gap: [0.08, 0.12], w: 0.2 }, { k: '_expl', n: [1, 2], gap: [0.3, 1], w: 0.2 }],
  ww2: [{ k: 'howitzer', n: [1, 3], gap: [0.6, 2.5], w: 0.3 }, { k: 'ww2_mg', n: [4, 14], gap: [0.04, 0.07], w: 0.3 }, { k: 'ww2_rifle', n: [2, 6], gap: [0.3, 1.2], w: 0.15 }, { k: 'tank75', n: [1, 2], gap: [1, 3], w: 0.1 }, { k: '_expl', n: [1, 2], gap: [0.3, 1], w: 0.15 }],
  afghan: [{ k: 'ak', n: [3, 10], gap: [0.07, 0.12], w: 0.35 }, { k: 'pkm', n: [4, 12], gap: [0.06, 0.09], w: 0.2 }, { k: 'dshk', n: [3, 8], gap: [0.1, 0.15], w: 0.1 }, { k: 'rpg', n: [1, 1], gap: [1, 1], w: 0.1 }, { k: 'mortar', n: [1, 3], gap: [0.8, 2], w: 0.1 }, { k: '_expl', n: [1, 2], gap: [0.3, 1], w: 0.15 }],
  modern: [{ k: 'autocannon', n: [3, 8], gap: [0.08, 0.14], w: 0.2 }, { k: 'mg', n: [4, 12], gap: [0.06, 0.1], w: 0.3 }, { k: 'rifle', n: [2, 8], gap: [0.1, 0.4], w: 0.2 }, { k: 'howitzer', n: [1, 3], gap: [0.6, 2.5], w: 0.15 }, { k: 'mortar', n: [1, 3], gap: [0.8, 2], w: 0.05 }, { k: '_expl', n: [1, 2], gap: [0.3, 1], w: 0.1 }],
};

// =====================================================================================
export class Audio {
  constructor() {
    this.ctx = null;
    this.volume = 0.7;
    this.listener = { x: 0, z: 0, zoom: 60, yaw: 0 };
    this.lastPlay = {};
    this.bank = new Map();
    this.engines = new Map();
    this.amb = { night: false, season: 'summer', era: 'modern', intensity: 0.5, rain: 0 };
    this.mobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
    this.maxEngines = this.mobile ? 5 : 8;
    const m = this.mobile;
    this.cats = { w: this._cat(m ? 10 : 16), x: this._cat(m ? 5 : 8), u: this._cat(6), r: this._cat(2), a: this._cat(m ? 4 : 6), v: this._cat(4), f: this._cat(m ? 10 : 20) };
    this.genMs = 0; this.drops = 0; this.debug = false; this.manual = false; this._base = 0; this._lastMaint = 0; this._next = { bird: 0, owl: 0, far: 0 };
  }
  _cat(max) { return { n: 0, max, list: [] }; }
  _now() { return this.ctx.currentTime + this._base; }  // _base nur für Offline-Tests
  _ok() { const c = this.ctx; return !!c && (this.manual || c.state === 'running'); }
  _err(e) { if (this.debug) throw e; if (!this._warned) { this._warned = true; console.warn('[audio]', e); } }

  // ------------------------------------------------------------------ Aufbau
  init(extCtx) {
    if (this.ctx) { if (this.ctx.resume && this.ctx.state === 'suspended' && !this.manual) this.ctx.resume(); return; }
    let c = extCtx;
    if (!c) { const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext); if (!AC) return; try { c = new AC(); } catch (e) { return; } }
    this.ctx = c; this.manual = !!extCtx;
    try { this._build(); } catch (e) { console.warn('[audio] init fehlgeschlagen', e); this.ctx = null; return; }
    if (!this.manual) {
      this._timer = setInterval(() => this._tick(), 400);
      this._warm = this._warmList(); this._warmI = 0; setTimeout(() => this._warmStep(), 700);
    }
    this.ambient();
  }
  _build() {
    const c = this.ctx, g = (v) => { const n = c.createGain(); n.gain.value = v; return n; };
    this.out = g(this.volume); this.master = this.out; this.out.connect(c.destination);
    const lim = c.createWaveShaper(), curve = new Float32Array(2049), K = 1.3, ceil = 0.89;      // Limiter: nie über -1 dBFS
    for (let i = 0; i < curve.length; i++) { const x = i / 1024 - 1; curve[i] = ceil * Math.tanh(K * x) / Math.tanh(K); }
    lim.curve = curve; if (!this.mobile) lim.oversample = '2x'; lim.connect(this.out);
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 6; comp.attack.value = 0.004; comp.release.value = 0.18; comp.connect(lim);
    this.pre = g(0.8); this.pre.connect(comp);
    const bus = {}; this.bus = bus;
    for (const [k, v] of [['weap', 1], ['expl', 1], ['veh', 0.8], ['amb', 0.7], ['ui', 0.6]]) { bus[k] = g(v); bus[k].connect(this.pre); }
    this.ambLevel = 0.7;
    // Funkbus: Telefon-Bandpass + leichte Verzerrung
    const rin = g(0.7), hp = c.createBiquadFilter(), lp = c.createBiquadFilter(), ws = c.createWaveShaper(), rc = new Float32Array(257);
    hp.type = 'highpass'; hp.frequency.value = 320; lp.type = 'lowpass'; lp.frequency.value = 3400;
    for (let i = 0; i < 257; i++) { const x = i / 128 - 1; rc[i] = Math.tanh(2.2 * x) / Math.tanh(2.2); } ws.curve = rc;
    rin.connect(hp); hp.connect(lp); lp.connect(ws); ws.connect(this.pre); bus.radio = rin;
    // Faltungshall: kurze Außen-Reflexion + lange Ferne
    this.revIn = g(1); const revOut = g(0.7); revOut.connect(this.pre);
    const mkIR = (isLong, seed) => { const d = genIR(c.sampleRate, isLong, seed), b = c.createBuffer(2, d[0].length, c.sampleRate); b.getChannelData(0).set(d[0]); b.getChannelData(1).set(d[1]); return b; };
    const cs = c.createConvolver(); cs.buffer = mkIR(false, 5); const ss = g(0.5); this.revIn.connect(ss); ss.connect(cs); cs.connect(revOut);
    const cl = c.createConvolver(); cl.buffer = mkIR(true, 9); const sl = g(0.8); this.revIn.connect(sl); sl.connect(cl); cl.connect(revOut);
    this.hasPan = typeof c.createStereoPanner === 'function';
  }
  setVolume(v) { this.volume = v; if (this.out) this.out.gain.value = v; }

  // ------------------------------------------------------------------ Sample-Bank
  _make(type, key, i) {
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now(), seed = hashStr(type + key) + i * 7919 + 1;
    let d;
    switch (type) {
      case 'shot': d = synthShot(key, seed); break;
      case 'expl': d = synthExplosion(+key[0], seed, key[1] === 'a'); break;
      case 'splash': d = synthSplash(+key, seed); break;
      case 'eng': d = synthEngine(key, seed); break;
      case 'ui': d = synthUI(key, seed); break;
      case 'radio': d = synthRadio(seed, 0.5); break;
      case 'siren': d = synthSiren(seed); break;
      case 'boom': d = synthBoom(seed); break;
      case 'bird': d = synthBird(+key, seed); break;
      case 'owl': d = synthOwl(seed); break;
      default: d = synthAmb(key, seed);
    }
    const b = this.ctx.createBuffer(1, d.length, SR); if (b.copyToChannel) b.copyToChannel(d, 0); else b.getChannelData(0).set(d);
    this.genMs += (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0; return b;
  }
  _get(type, key, nv = 3) {
    const id = type + ':' + key; let arr = this.bank.get(id); if (!arr) { arr = []; this.bank.set(id, arr); }
    if (arr.length < nv && (arr.length === 0 || Math.random() < 0.5)) arr.push(this._make(type, key, arr.length));
    return arr[(Math.random() * arr.length) | 0];
  }
  _warmList() {   // Vorberechnung im Leerlauf, häufige Klänge zuerst
    const L = [], add = (type, key, nv) => { for (let i = 0; i < nv; i++) L.push([type, key, i]); };
    ['click', 'ack'].forEach((k) => add('ui', k, 1)); ['rifle', 'mg', 'ak'].forEach((k) => add('shot', k, 3)); add('expl', '0g', 2); add('expl', '1g', 3); add('expl', '2g', 2);
    ['cannon', 'autocannon', 'pistol', 'smg', 'ww2_rifle', 'ww2_mg', 'pkm', 'tank75', 'sniper', 'missile', 'flak'].forEach((k) => add('shot', k, 2));
    ['radio', 'siren', 'boom'].forEach((k) => add(k, k, 1)); ['tracked', 'wheeled', 'heli'].forEach((k) => add('eng', k, 1));
    ['ww2_smg', 'tank88', 'howitzer', 'mortar', 'rocket_salvo', 'dshk', 'rpg', 'bazooka', 'atgm', 'grenade'].forEach((k) => add('shot', k, 1));
    add('expl', '3g', 1); add('expl', '1a', 1); add('splash', '0', 1); add('splash', '1', 1); ['obj', 'fail', 'warn', 'select', 'done'].forEach((k) => add('ui', k, 1));
    return L;
  }
  _warmStep() {
    if (!this.ctx || !this._warm || this._warmI >= this._warm.length) return;
    const [type, key, i] = this._warm[this._warmI++], id = type + ':' + key; let arr = this.bank.get(id); if (!arr) { arr = []; this.bank.set(id, arr); }
    try { if (arr.length <= i) arr.push(this._make(type, key, arr.length)); } catch (e) { this._err(e); }
    setTimeout(() => this._warmStep(), 35);
  }

  // ------------------------------------------------------------------ Raum / Wiedergabe
  _sp(x, z) {
    if (x === undefined || x === null || !isFinite(x) || !isFinite(z)) return { g: 1, cut: 18000, pan: 0, wet: 0.1, delay: 0, dn: 0, d: 0 };
    const L = this.listener, dx = x - L.x, dz = z - L.z, d = Math.hypot(dx, dz), R = 40 + L.zoom * 1.2, dn = d / R;
    if (dn > 2.6) return null;
    const zf = Math.min(1.25, 60 / Math.max(40, L.zoom * 0.8 + 20)), g = zf * Math.pow(1 - dn / 2.6, 1.5), yaw = L.yaw || 0;
    const rx = dx * Math.cos(yaw) - dz * Math.sin(yaw);
    return { g, d, dn, pan: clamp(rx / (R * 0.8), -0.9, 0.9), cut: Math.max(700, 18000 / (1 + dn * dn * 2.5 + dn * 1.5)), wet: Math.min(0.85, 0.1 + 0.5 * dn), delay: d > 25 ? Math.min(1.2, (d - 25) / 220) : 0 };
  }
  _throttle(key, ms) {
    const now = this._now() * 1000; if (this.lastPlay[key] !== undefined && now - this.lastPlay[key] < ms) return false;
    this.lastPlay[key] = now; return true;
  }
  _nodes(o) {   // Stimmenkette: gain -> lowpass -> pan -> Bus (+ Hall-Send)
    const c = this.ctx, vg = c.createGain(), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = o.cut || 18000; lp.Q.value = 0.5;
    vg.connect(lp); let tail = lp, pan = null;
    if (this.hasPan) { pan = c.createStereoPanner(); pan.pan.value = o.pan || 0; lp.connect(pan); tail = pan; }
    tail.connect(this.bus[o.bus]);
    let sg = null; if (o.wet > 0.01) { sg = c.createGain(); sg.gain.value = o.wet; lp.connect(sg); sg.connect(this.revIn); }
    return { vg, lp, pan, sg };
  }
  _kill(cat, v) { const i = cat.list.indexOf(v); if (i >= 0) { cat.list.splice(i, 1); cat.n = cat.list.length; } v.end = 0; try { const t = this._now(); v.vg.gain.cancelScheduledValues(t); v.vg.gain.setTargetAtTime(0, t, 0.01); v.src.stop(t + 0.06); } catch (e) { /* schon beendet */ } }
  _play(buf, o) {
    const c = this.ctx, cat = this.cats[o.cat || 'w']; let g = o.g; if (!(g > 0.012)) return null;
    const tn = this._now(); if (cat.n) { cat.list = cat.list.filter((v) => v.end > tn); cat.n = cat.list.length; }   // abgelaufene Stimmen austragen
    if (cat.n >= cat.max) {   // Stimmenlimit: nur wenn lauter als die leiseste, diese ersetzen
      let mv = null; for (const v of cat.list) if (!mv || v.g < mv.g) mv = v;
      if (!mv || !(g > mv.g * 1.5)) { this.drops++; return null; }
      this._kill(cat, mv);
    }
    g *= 1 / Math.sqrt(1 + cat.n * 0.12);
    const t = this._now() + (o.delay || 0), src = c.createBufferSource(), nd = this._nodes(o); src.buffer = buf;
    if (o.rate) src.playbackRate.value = o.rate; src.connect(nd.vg);
    if (o.env) { const dur = o.dur, a = o.env[0], rl = o.env[1]; nd.vg.gain.setValueAtTime(0, t); nd.vg.gain.linearRampToValueAtTime(g, t + a); nd.vg.gain.setValueAtTime(g, t + Math.max(a, dur - rl)); nd.vg.gain.linearRampToValueAtTime(0, t + dur); } else nd.vg.gain.value = g;
    const rt = o.dur ? o.dur : buf.duration / (o.rate || 1), v = { g, src, vg: nd.vg, end: t + rt + 0.05 }; cat.list.push(v); cat.n++;
    src.onended = () => { const i = cat.list.indexOf(v); if (i >= 0) { cat.list.splice(i, 1); cat.n = cat.list.length; } try { src.disconnect(); nd.vg.disconnect(); nd.lp.disconnect(); if (nd.pan) nd.pan.disconnect(); if (nd.sg) nd.sg.disconnect(); } catch (e) { /* egal */ } };
    if (o.dur) src.start(t, o.offset || 0, o.dur + 0.02); else src.start(t, o.offset || 0);
    return v;
  }
  _duck(a, hold) {
    if (!this.bus) return; const g = this.bus.amb.gain, t = this._now(); g.cancelScheduledValues(t); g.setTargetAtTime(this.ambLevel * a, t, 0.03); g.setTargetAtTime(this.ambLevel, t + hold, 0.4);
  }

  // ------------------------------------------------------------------ Waffen / Explosionen
  _shotPlay(k, sp, boost, cat, bus, extraDelay = 0) {
    const buf = this._get('shot', k, 3);
    return this._play(buf, { cat, bus, g: sp.g * boost, cut: sp.cut, pan: sp.pan, wet: sp.wet, delay: sp.delay + extraDelay, rate: 0.96 + Math.random() * 0.08 });
  }
  shot(kind, x, z) {
    if (!this._ok()) return;
    try {
      const sp = this._sp(x, z); if (!sp || sp.g < 0.03) return;
      const k = resolveShot(kind), gk = x === undefined ? '' : ((x / 30) | 0) + ',' + ((z / 30) | 0);
      if (!this._throttle('s' + k + gk, SHOT[k].gap)) return;
      this._shotPlay(k, sp, 1, 'w', 'weap');
    } catch (e) { this._err(e); }
  }
  explosion(x, z, size = 1, type) {
    if (!this._ok()) return;
    try {
      const sp = this._sp(x, z); if (!sp || sp.g < 0.02) return;
      size = +size || 1; const cls = explClass(size), air = type === 'air';
      if (!this._throttle('x' + cls + (x === undefined ? '' : ((x / 40) | 0) + ',' + ((z / 40) | 0)), 60)) return;
      const buf = this._get('expl', cls + (air ? 'a' : 'g'), 3);
      this._play(buf, { cat: 'x', bus: 'expl', g: sp.g * Math.min(1.2, 0.8 + 0.2 * size / EXPL[cls].c), cut: sp.cut, pan: sp.pan, wet: Math.min(0.9, sp.wet + 0.1), delay: sp.delay, rate: clamp(Math.pow(EXPL[cls].c / size, 0.12), 0.85, 1.15) * (0.97 + Math.random() * 0.06) });
      if (cls >= 2 && sp.dn < 1.2) this._duck(0.45, 0.5 + cls * 0.3);
    } catch (e) { this._err(e); }
  }
  splash(x, z, size = 1) {
    if (!this._ok()) return;
    try {
      const sp = this._sp(x, z); if (!sp || sp.g < 0.02) return; size = +size || 1; const cls = size < 0.8 ? 0 : size < 1.8 ? 1 : 2;
      if (!this._throttle('sp' + cls + (x === undefined ? '' : ((x / 30) | 0) + ',' + ((z / 30) | 0)), 80)) return;
      this._play(this._get('splash', '' + cls, 3), { cat: 'x', bus: 'expl', g: sp.g, cut: sp.cut, pan: sp.pan, wet: sp.wet, delay: sp.delay, rate: 0.95 + Math.random() * 0.1 });
    } catch (e) { this._err(e); }
  }
  drone(x, z) {
    if (!this._ok()) return;
    try {
      const sp = this._sp(x, z); if (!sp || sp.g < 0.05 || !this._throttle('drone', 200)) return;
      this._play(this._get('eng', 'shahed', 1), { cat: 'v', bus: 'veh', g: sp.g * 0.3, cut: sp.cut, pan: sp.pan, wet: sp.wet * 0.7, delay: sp.delay, rate: 1 + Math.random() * 0.2, offset: Math.random() * 1.3, dur: 0.6, env: [0.08, 0.25] });
    } catch (e) { this._err(e); }
  }
  siren() {
    if (!this._ok() || !this._throttle('siren', 3000)) return;
    try { this._play(this._get('siren', 'wail', 1), { cat: 'a', bus: 'amb', g: 0.55, cut: 9000, wet: 0.5 }); } catch (e) { this._err(e); }
  }
  boom() {   // Überschallknall
    if (!this._ok() || !this._throttle('boom', 200)) return;
    try { this._play(this._get('boom', 'b', 2), { cat: 'x', bus: 'expl', g: 0.9, cut: 12000, wet: 0.4 }); this._duck(0.5, 0.6); } catch (e) { this._err(e); }
  }

  // ------------------------------------------------------------------ UI / Funk
  ui(kind = 'click') {
    if (!this._ok()) return;
    try {
      const k = UI[kind] ? kind : kind === 'radio' ? 'radio' : 'click';
      if (k === 'radio') { if (!this._throttle('radio', 120)) return; this._play(this._get('radio', 'radio', 3), { cat: 'r', bus: 'radio', g: 0.8, wet: 0 }); return; }
      if (!this._throttle('ui' + k, UI[k].gap)) return;
      this._play(this._get('ui', k, 1), { cat: 'u', bus: 'ui', g: 0.9, rate: 0.98 + Math.random() * 0.04, wet: k === 'obj' ? 0.35 : k === 'fail' ? 0.25 : k === 'click' || k === 'select' ? 0 : 0.1 });
    } catch (e) { this._err(e); }
  }
  radio(dur = 1.2) {   // Funkspruch-Hintergrund (Rauschen + Klick am Anfang/Ende), dur in s
    if (!this._ok()) return;
    try {
      dur = clamp(+dur || 1.2, 0.2, 8); const d = synthRadio((Math.random() * 1e9) | 0, dur), b = this.ctx.createBuffer(1, d.length, SR); b.getChannelData(0).set(d);
      this._play(b, { cat: 'r', bus: 'radio', g: 0.7, wet: 0 });
    } catch (e) { this._err(e); }
  }

  // ------------------------------------------------------------------ Motoren
  engine(id, kind, x, z, speed) {
    if (!this._ok()) return;
    try {
      const now = this._now(); let e = this.engines.get(id);
      if (!e) { e = { id, kind: resolveEngine(kind), v: null, pd: -1, pt: now, dop: 1 }; this.engines.set(id, e); } else if (kind !== e.k0) e.kind = resolveEngine(kind);
      e.k0 = kind; e.x = x; e.z = z; e.speed = speed === undefined ? 0.5 * ENG[e.kind].vmax : +speed || 0; e.seen = now;
      if (now - this._lastMaint > 0.1) this._engMaint();
    } catch (err) { this._err(err); }
  }
  _engDrop(e) {
    const v = e.v; e.v = null; if (!v) return;
    try { const t = this._now(); v.vg.gain.cancelScheduledValues(t); v.vg.gain.setTargetAtTime(0, t, 0.08); v.src.stop(t + 0.5); } catch (err) { /* egal */ }
  }
  stopEngine(id) { const e = this.engines.get(id); if (e) { this._engDrop(e); this.engines.delete(id); } }
  stopAllEngines() { for (const e of this.engines.values()) this._engDrop(e); this.engines.clear(); }
  _engMaint() {
    const now = this._now(), t = this._now(), list = []; this._lastMaint = now;
    for (const [id, e] of this.engines) {
      if (now - e.seen > 0.6) { this._engDrop(e); this.engines.delete(id); continue; }
      e.sp = this._sp(e.x, e.z); e.score = e.sp ? e.sp.g : 0; list.push(e);
    }
    list.sort((a, b) => b.score - a.score);
    for (let i = 0; i < list.length; i++) {
      const e = list[i], sp = e.sp;
      if (i >= this.maxEngines || e.score < 0.02) { if (e.v) this._engDrop(e); e.pd = -1; continue; }
      const E = ENG[e.kind], s = clamp(e.speed / E.vmax, 0, 1.4), sc = Math.min(s, 1);
      let dop = 1; if (e.pd >= 0 && now > e.pt + 0.05) { const vr = (sp.d - e.pd) / (now - e.pt); dop = clamp(1 - vr / 1000, 0.93, 1.07); } e.pd = sp.d; e.pt = now;
      const rate = (E.r0 + (E.r1 - E.r0) * Math.pow(sc, 0.8)) * dop, gain = E.g * (E.air ? 0.7 + 0.3 * sc : 0.35 + 0.65 * sc) * sp.g;
      if (!e.v) {
        const c = this.ctx, src = c.createBufferSource(); src.buffer = this._get('eng', e.kind, 1); src.loop = true; src.playbackRate.value = rate;
        const nd = this._nodes({ bus: 'veh', cut: sp.cut, pan: sp.pan, wet: sp.wet * 0.8 }); nd.vg.gain.value = 0; src.connect(nd.vg); src.start(t, Math.random() * 2);
        const v = { src, vg: nd.vg, lp: nd.lp, pan: nd.pan, sg: nd.sg, nd };
        src.onended = () => { try { src.disconnect(); nd.vg.disconnect(); nd.lp.disconnect(); if (nd.pan) nd.pan.disconnect(); if (nd.sg) nd.sg.disconnect(); } catch (err) { /* egal */ } };
        e.v = v;
      }
      const v = e.v;
      v.src.playbackRate.setTargetAtTime(rate, t, 0.1); v.vg.gain.setTargetAtTime(gain, t, 0.12); v.lp.frequency.setTargetAtTime(sp.cut, t, 0.1);
      if (v.pan) v.pan.pan.setTargetAtTime(sp.pan, t, 0.1); if (v.sg) v.sg.gain.setTargetAtTime(sp.wet * 0.8, t, 0.1);
    }
  }

  // ------------------------------------------------------------------ Umgebung
  ambient() {
    if (!this.ctx || this._ambOn) return; this._ambOn = true;
    try {
      const c = this.ctx, mkLoop = (key, gain) => { const src = c.createBufferSource(); src.buffer = this._get('amb', key, 1); src.loop = true; const g = c.createGain(); g.gain.value = gain; src.connect(g); return { src, g }; };
      const w = mkLoop('wind', 0.0001), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
      const o1 = c.createOscillator(), o1g = c.createGain(); o1.frequency.value = 0.07; o1g.gain.value = 160; o1.connect(o1g); o1g.connect(lp.frequency);
      const o2 = c.createOscillator(), o2g = c.createGain(); o2.frequency.value = 0.13; o2g.gain.value = 0.35; o2.connect(o2g);
      const gust = c.createGain(); gust.gain.value = 0.65; o2g.connect(gust.gain); w.g.connect(lp); lp.connect(gust); gust.connect(this.bus.amb);
      const cr = mkLoop('cricket', 0.0001); cr.g.connect(this.bus.amb); const rn = mkLoop('rain', 0.0001); rn.g.connect(this.bus.amb);
      o1.start(); o2.start(); w.src.start(0, Math.random() * 5); cr.src.start(0, Math.random() * 3); rn.src.start(0, Math.random() * 5);
      this._amb = { w, cr, rn, lp }; this._applyAmb(true);
    } catch (e) { this._err(e); }
  }
  setAmbience(o = {}) {
    const A = this.amb;
    if (o.night !== undefined) A.night = !!o.night;
    if (o.season) A.season = String(o.season); if (o.era) A.era = String(o.era);
    if (o.intensity !== undefined) A.intensity = clamp(+o.intensity || 0, 0, 1); if (o.rain !== undefined) A.rain = clamp(+o.rain || 0, 0, 1);
    this._applyAmb();
  }
  _applyAmb(now) {
    if (!this._amb || !this.ctx) return;
    const A = this.amb, t = this._now(), tc = now ? 0.01 : 1.5, winter = A.season === 'winter', B = this._amb;
    B.w.g.gain.setTargetAtTime(0.05 + 0.03 * A.intensity + (winter ? 0.04 : 0) + A.rain * 0.03, t, tc);
    B.lp.frequency.setTargetAtTime(winter ? 520 : 380, t, tc);
    B.cr.g.gain.setTargetAtTime((A.night && !winter ? 0.11 : !A.night && A.season === 'summer' ? 0.02 : 0) * (1 - 0.6 * A.intensity), t, tc);
    B.rn.g.gain.setTargetAtTime(A.rain * 0.12, t, tc);
  }
  _tick() {
    const c = this.ctx; if (!c || c.state !== 'running' || (typeof document !== 'undefined' && document.hidden)) return;
    try {
      this._engMaint();
      const A = this.amb, t = this._now(), N = this._next, winter = A.season === 'winter';
      if (!A.night && !winter && t > N.bird) {
        N.bird = t + (2.5 + Math.random() * 5) * (1 + 3 * A.intensity);
        this._play(this._get('bird', '' + ((Math.random() * 6) | 0), 1), { cat: 'f', bus: 'amb', g: 0.1 + Math.random() * 0.1, cut: 9000 + Math.random() * 5000, pan: Math.random() * 1.6 - 0.8, wet: 0.3, rate: 0.9 + Math.random() * 0.25 });
      }
      if (A.night && !winter && t > N.owl) { N.owl = t + 20 + Math.random() * 30; this._play(this._get('owl', 'o', 1), { cat: 'f', bus: 'amb', g: 0.15, cut: 3000, pan: Math.random() * 1.6 - 0.8, wet: 0.5, delay: 0.1 }); }
      if (A.intensity > 0.05 && t > N.far) { N.far = t + (6 + Math.random() * 14) / (0.3 + A.intensity * 1.7); this._distant(); }
    } catch (e) { this._err(e); }
  }
  _distant() {   // ferne Gefechte: Artillerie/MG aus zufälliger Richtung, stark tiefpassgefiltert und verhallt
    const set = ERA_FAR[this.amb.era] || ERA_FAR.modern; let w = Math.random() * set.reduce((s, e) => s + e.w, 0), ev = set[0];
    for (const e of set) { w -= e.w; if (w <= 0) { ev = e; break; } }
    const L = this.listener, R = 40 + L.zoom * 1.2, ang = Math.random() * TAU, dn = 1.7 + Math.random() * 0.8, x = L.x + Math.cos(ang) * R * dn, z = L.z + Math.sin(ang) * R * dn, sp = this._sp(x, z); if (!sp) return;
    sp.cut = Math.min(sp.cut, 1100); sp.wet = Math.max(sp.wet, 0.7);
    const n = ev.n[0] + ((Math.random() * (ev.n[1] - ev.n[0] + 1)) | 0); let at = 0;
    for (let i = 0; i < n; i++) {
      if (ev.k === '_expl') this._play(this._get('expl', '1g', 3), { cat: 'f', bus: 'amb', g: sp.g * 2.5, cut: sp.cut, pan: sp.pan, wet: sp.wet, delay: sp.delay + at, rate: 0.9 });
      else this._shotPlay(ev.k, sp, 3, 'f', 'amb', at);
      at += ev.gap[0] + Math.random() * (ev.gap[1] - ev.gap[0]);
    }
  }

  stats() {
    const cats = {}; for (const k in this.cats) cats[k] = this.cats[k].n;
    let samples = 0; for (const a of this.bank.values()) samples += a.length;
    return { cats, drops: this.drops, samples, genMs: Math.round(this.genMs), engines: this.engines.size, enginesActive: [...this.engines.values()].filter((e) => e.v).length };
  }
}
