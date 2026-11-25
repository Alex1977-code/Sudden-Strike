// Tutorial-Gerüst (V3-TUT): Schritt-für-Schritt-Anleitung mit Hinweisbox (DOM-Overlay), Zielmarkierung und
// Prüfung der Spieleraktionen über Spielzustand und game.on('command'). Texte je Eingabegerät: pc | touch | pad.
//
// Schritt: { id, title, text: 'Text' | { pc, touch, pad }, info?: true (nur „Weiter“), say?: [Sprecher, Text],
//            enter?(g, t), check?(g, t) → truthy = erfüllt, mark?(g, t) → [x, z, r?] | null, padNote?: true (am Gamepad nicht belegt),
//            hold?: Sekunden Pause nach Erfüllung }
// Helfer in t: t.cmd(typ, pred?) (Kommandos seit Schrittbeginn), t.own(), t.st (Schritt-Scratch), t.camMoved/Zoomed/Rotated, t.minimap.

import { trRuntime as TR } from '../../i18n/runtime.js'; // V3-I18N-B: Hinweisbox bei Sprache 'en' übersetzen

const STYLE = `
#tut-box{position:fixed;z-index:15;top:calc(8px + env(safe-area-inset-top,0px));left:490px;right:160px;max-width:640px;background:rgba(14,22,16,.94);border:2px solid #8fb573;border-radius:10px;color:#eef3e8;padding:9px 12px 10px;font:14px/1.38 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.55);pointer-events:auto}
#tut-box.ok{border-color:#ffd84a;background:rgba(40,52,18,.95)}
#tut-box .th{display:flex;justify-content:space-between;gap:8px;align-items:baseline;font-weight:700;color:#bfe39a;margin-bottom:3px}
#tut-box .th small{font-weight:600;color:#9db08a;white-space:nowrap}
#tut-box .tt b,#tut-box .tt kbd{color:#ffe38a}
#tut-box .tt kbd{font:inherit;font-weight:700;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.25);border-radius:4px;padding:0 4px}
#tut-box .tn{margin-top:4px;color:#f0b27a;font-size:12.5px}
#tut-box .tb{display:flex;gap:8px;justify-content:flex-end;margin-top:7px}
#tut-box button{pointer-events:auto;cursor:pointer;font:inherit;font-weight:700;border-radius:7px;border:1px solid #5d7a49;background:#25361d;color:#eef3e8;padding:5px 14px;min-height:32px}
#tut-box button.go{background:#4f7a2e;border-color:#9cd16b}
#tut-box button.skip{background:transparent;color:#aab99c}
@media (max-width:900px){#tut-box{left:340px;right:118px;font-size:12px;padding:6px 9px 7px;border-width:1.5px}#tut-box button{padding:3px 10px;min-height:26px}#tut-box .tn{font-size:11px}}
@media (max-width:900px) and (max-height:420px){#tut-box .tt{max-height:92px;overflow:auto}}
`;

export function inputMode() {
  try { if (window.__gamepad?.active) return 'pad'; } catch (e) { /* ignorieren */ }
  if (inputMode.last) return inputMode.last;
  try { if (window.matchMedia && matchMedia('(pointer: coarse)').matches) return 'touch'; } catch (e) { /* ignorieren */ }
  return document.body.classList.contains('touch') ? 'touch' : 'pc';
}
function trackInput() {
  if (trackInput.done) return;
  trackInput.done = true;
  window.addEventListener('pointerdown', (e) => { inputMode.last = e.pointerType === 'touch' ? 'touch' : 'pc'; }, true);
  window.addEventListener('keydown', () => { inputMode.last = 'pc'; }, true);
}

export class Tutor {
  constructor(g, mission, steps, opts = {}) {
    this.g = g; this.mission = mission; this.steps = steps; this.opts = opts;
    this.i = -1; this.cmds = []; this.st = {}; this.listeners = [];
    this.done = false; this.dead = false; this.advanceAt = 0; this.clock = 0; this.markT = 0; this.minimap = false;
    this.lastMode = null; this.finished = false;
    trackInput();
    if (!document.getElementById('tut-style')) { const s = document.createElement('style'); s.id = 'tut-style'; s.textContent = STYLE; document.head.appendChild(s); }
    document.getElementById('tut-box')?.remove();
    const box = this.box = document.createElement('div');
    box.id = 'tut-box';
    box.addEventListener('pointerdown', (e) => e.stopPropagation());
    box.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.a === 'next') this.next(); else if (b.dataset.a === 'skip') this.skip();
    });
    document.body.appendChild(box);
    this.on('command', (pid, cmd) => { if (pid === g.localPlayerId) this.cmds.push(cmd); });
    this.on('end', () => { box.style.display = 'none'; });
    const mm = document.getElementById('minimap');
    if (mm) { this._mmh = () => { this.minimap = true; }; mm.addEventListener('pointerdown', this._mmh); }
    this.watch = setInterval(() => { if (g.mission !== mission) this.destroy(); }, 400);
    this.obj = opts.objective !== false;
    if (this.obj) g.addObjective('tut', '');
    this.next();
  }
  on(ev, fn) { this.g.on(ev, fn); this.listeners.push([ev, fn]); }
  destroy() {
    if (this.dead) return;
    this.dead = true;
    clearInterval(this.watch);
    for (const [ev, fn] of this.listeners) this.g.off(ev, fn);
    this.box.remove();
    const mm = document.getElementById('minimap'); if (mm && this._mmh) mm.removeEventListener('pointerdown', this._mmh);
  }
  get step() { return this.steps[this.i]; }
  get mode() { return inputMode(); }
  own() { return this.g.units.filter((u) => u.alive && this.g.isOwn(u) && !u.type.structure); }
  sel() { return this.g.selected.filter((u) => u.alive && this.g.isOwn(u)); }
  cmd(type, pred) { return this.cmds.some((c) => c.t === type && (!pred || pred(c))); }
  camMoved(d = 18) { const c = this.g.camera, s = this.cam0; return Math.hypot(c.target.x - s.x, c.target.z - s.z) > d; }
  camZoomed(f = 0.14) { return Math.abs(this.g.camera.goalDist / this.cam0.dist - 1) > f; }
  camRotated(a = 0.4) { return Math.abs(this.g.camera.goalYaw - this.cam0.yaw) > a; }
  skip() { if (this.finished) return; this.step?.onSkip?.(this.g, this); this.next(); }
  next() {
    const g = this.g;
    this.i++;
    this.cmds = []; this.st = {}; this.done = false; this.minimap = false; this.markT = 0;
    const c = g.camera;
    this.cam0 = { x: c.target.x, z: c.target.z, dist: c.goalDist, yaw: c.goalYaw };
    if (this.i >= this.steps.length) { this.finished = true; this.box.style.display = 'none'; this.opts.onFinish?.(g, this); return; }
    const s = this.step;
    if (s.skipIf?.(g, this)) { this.next(); return; }
    this.box.classList.remove('ok');
    s.enter?.(g, this);
    if (s.say) g.say(s.say[0], s.say[1], s.say[2] || 7);
    if (this.obj) { const o = g.objectives.find((o) => o.id === 'tut'); if (o) { o.text = `Lektion ${Math.min(this.i + 1, this.steps.length)}/${this.steps.length}: ${s.title}`; g.emit('objectives'); } }
    this.lastMode = null;
    this.render();
  }
  render() {
    const s = this.step; if (!s) return;
    const m = this.mode; this.lastMode = m;
    const tx = TR(typeof s.text === 'string' ? s.text : (s.text[m] ?? s.text.pc));
    const note = m === 'pad' && s.padNote ? `<div class="tn">${TR('Diese Aktion ist am Gamepad nicht belegt – Schritt mit „Überspringen“ abschließen oder Maus/Touch nutzen.')}</div>` : '';
    const nw = this.done ? '' : (s.info ? `<button class="go" data-a="next">${TR('Weiter')}</button>` : '');
    this.box.innerHTML = `<div class="th"><span>${this.done ? '✔ ' : ''}${TR(s.title)}</span><small>${TR(`Schritt ${this.i + 1}/${this.steps.length}`)}</small></div><div class="tt">${tx}</div>${note}<div class="tb"><button class="skip" data-a="skip">${TR('Überspringen')}</button>${nw}</div>`;
  }
  tick(dt) {
    if (this.dead || this.finished) return;
    const g = this.g, s = this.step; if (!s) return;
    this.clock += dt;
    this.opts.safety?.(g, this);
    if (this.mode !== this.lastMode) this.render();
    if (this.done) { this.advanceAt -= dt; if (this.advanceAt <= 0) this.next(); return; }
    this.markT -= dt;
    if (this.markT <= 0) {
      this.markT = 2.6;
      const m = s.mark?.(g, this);
      if (m) g.markerTo(g.localSide, m[0], m[1], 0xffd84a, 3, m[2] || 8);
    }
    s.tick?.(g, this, dt);
    if (!s.info && s.check && s.check(g, this)) {
      this.done = true; this.advanceAt = s.hold ?? 1.4;
      this.box.classList.add('ok');
      g.audio?.ui?.('ack');
      this.render();
    }
  }
}
