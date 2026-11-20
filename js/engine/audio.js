// Synthetischer Sound (WebAudio) – keine externen Dateien nötig
export class Audio {
  constructor() {
    this.ctx = null;
    this.volume = 0.7;
    this.listener = { x: 0, z: 0, zoom: 60 };
    this.lastPlay = {};
  }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 6;
    this.master.connect(comp); comp.connect(this.ctx.destination);
    // Rausch-Puffer
    const len = this.ctx.sampleRate * 2;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b = 0.98 * b + 0.02 * w; d[i] = w * 0.6 + b * 3; }
    this.ambient();
  }
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }
  _att(x, z) {
    if (x === undefined) return 1;
    const d = Math.hypot(x - this.listener.x, z - this.listener.z);
    const r = 40 + this.listener.zoom * 1.2;
    return Math.max(0, 1 - d / (r * 2.2)) * (60 / Math.max(40, this.listener.zoom * 0.8 + 20));
  }
  _throttle(key, ms) {
    const now = performance.now();
    if (this.lastPlay[key] && now - this.lastPlay[key] < ms) return false;
    this.lastPlay[key] = now; return true;
  }
  _noiseBurst({ dur = 0.2, freq = 1000, q = 1, type = 'lowpass', gain = 0.5, attack = 0.002, sweep = 0, delay = 0 }) {
    const c = this.ctx, t = c.currentTime + delay;
    const src = c.createBufferSource(); src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  }
  _tone({ freq = 440, dur = 0.2, type = 'sine', gain = 0.2, slide = 1, delay = 0 }) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide !== 1) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }
  shot(kind, x, z) {
    if (!this.ctx) return;
    const a = this._att(x, z); if (a < 0.03) return;
    if (!this._throttle('shot' + kind, kind === 'rifle' ? 45 : 80)) return;
    if (kind === 'rifle') this._noiseBurst({ dur: 0.12, freq: 2400, type: 'bandpass', q: 0.8, gain: 0.25 * a });
    else if (kind === 'mg' || kind === 'autocannon') this._noiseBurst({ dur: 0.14, freq: kind === 'mg' ? 1800 : 900, type: 'bandpass', q: 0.9, gain: 0.35 * a });
    else if (kind === 'cannon') { this._noiseBurst({ dur: 0.7, freq: 700, sweep: 0.15, gain: 0.8 * a }); this._tone({ freq: 70, dur: 0.4, gain: 0.4 * a, slide: 0.5 }); }
    else if (kind === 'missile') this._noiseBurst({ dur: 1.0, freq: 3000, sweep: 0.3, type: 'bandpass', q: 0.6, gain: 0.35 * a, attack: 0.05 });
    else if (kind === 'flak') { for (let i = 0; i < 3; i++) this._noiseBurst({ dur: 0.1, freq: 1100, type: 'bandpass', gain: 0.4 * a, delay: i * 0.07 }); }
  }
  explosion(x, z, size = 1) {
    if (!this.ctx) return;
    const a = this._att(x, z); if (a < 0.02) return;
    if (!this._throttle('expl', 60)) return;
    this._noiseBurst({ dur: 0.9 + size * 0.6, freq: 900, sweep: 0.08, gain: Math.min(1, 0.6 * a * (0.6 + size * 0.4)), attack: 0.005 });
    this._tone({ freq: 55, dur: 0.6 + size * 0.3, type: 'sine', gain: 0.6 * a, slide: 0.4 });
  }
  drone(x, z) {
    if (!this.ctx) return; const a = this._att(x, z); if (a < 0.05 || !this._throttle('drone', 200)) return;
    this._tone({ freq: 180 + Math.random() * 40, dur: 0.6, type: 'sawtooth', gain: 0.05 * a, slide: 1.1 });
  }
  siren() {
    if (!this.ctx || !this._throttle('siren', 3000)) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(400, t);
    for (let i = 0; i < 3; i++) { o.frequency.linearRampToValueAtTime(800, t + i * 0.9 + 0.45); o.frequency.linearRampToValueAtTime(400, t + i * 0.9 + 0.9); }
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1500;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.1); g.gain.setValueAtTime(0.18, t + 2.5); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
    o.connect(f); f.connect(g); g.connect(this.master); o.start(t); o.stop(t + 2.9);
  }
  boom() { // Überschallknall
    if (!this.ctx) return;
    this._noiseBurst({ dur: 0.35, freq: 400, gain: 0.9, attack: 0.001 });
    this._noiseBurst({ dur: 0.3, freq: 400, gain: 0.7, attack: 0.001, delay: 0.12 });
  }
  ui(kind = 'click') {
    if (!this.ctx) return;
    if (kind === 'click') this._tone({ freq: 900, dur: 0.05, type: 'square', gain: 0.04 });
    else if (kind === 'ack') { this._tone({ freq: 600, dur: 0.06, type: 'square', gain: 0.04 }); this._tone({ freq: 900, dur: 0.06, type: 'square', gain: 0.04, delay: 0.07 }); }
    else if (kind === 'obj') { [523, 659, 784].forEach((f, i) => this._tone({ freq: f, dur: 0.25, type: 'triangle', gain: 0.12, delay: i * 0.12 })); }
    else if (kind === 'fail') { [400, 300].forEach((f, i) => this._tone({ freq: f, dur: 0.3, type: 'triangle', gain: 0.12, delay: i * 0.2 })); }
    else if (kind === 'radio') this._noiseBurst({ dur: 0.15, freq: 2500, type: 'bandpass', q: 2, gain: 0.08 });
  }
  ambient() {
    // leiser Wind
    const c = this.ctx;
    const src = c.createBufferSource(); src.buffer = this.noise; src.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 350;
    const g = c.createGain(); g.gain.value = 0.05;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.07;
    const lg = c.createGain(); lg.gain.value = 150;
    lfo.connect(lg); lg.connect(f.frequency); lfo.start();
    src.connect(f); f.connect(g); g.connect(this.master); src.start();
  }
}
