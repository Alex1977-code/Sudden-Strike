// V3-GP: Gamepad-Steuerung (Gamepad API, Standard-Mapping: Xbox / PlayStation)
// Spiel: virtueller Cursor + dieselben Input-Methoden wie Maus (pickAt/commandAt/boxSelect/…).
// Menüs: Fokus-Navigation über sichtbare Elemente des obersten Bildschirms.
import { icon } from './icons.js';

const KEY = 'steppensturm.gamepad.v1';
const BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
const DEAD = 0.18;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const GAMEPAD_BINDINGS = [
  ['Linker Stick', 'Cursor bewegen (am Rand scrollt die Karte)'],
  ['Rechter Stick', 'links/rechts Kamera drehen, hoch/runter zoomen'],
  ['LT / RT (L2 / R2)', 'Zoom raus / rein'],
  ['A (Kreuz)', 'Auswählen · gedrückt halten + Cursor bewegen = Auswahlrahmen · 2x = gleicher Typ'],
  ['B (Kreis)', 'Befehl (Bewegen/Angreifen/Besetzen) · Abbrechen im Zielmodus'],
  ['X (Quadrat)', 'Angriffsbewegung zum Cursor'],
  ['Y (Dreieck)', 'Halt · LB+Y = Feuer halten umschalten'],
  ['LB (L1) + A', 'Zur Auswahl hinzufügen / Rahmen ergänzend'],
  ['RB (R1)', 'Fähigkeitenmenü: Stick/Steuerkreuz wählen, A bestätigt, B bricht ab, dann A auf das Ziel'],
  ['Steuerkreuz', 'Gruppen 1–4 wählen (2x = Kamera hin) · LB + Steuerkreuz = Gruppe speichern'],
  ['Start (Options)', 'Pausemenü'],
  ['Back (Share)', 'Kurz: alle auswählen · Lang halten: diese Hilfe'],
  ['L3 / R3', 'Kamera auf Auswahl / gleichen Typ auf dem Bildschirm wählen · LB+R3 Vibration an/aus'],
  ['Menüs', 'Steuerkreuz/Stick Fokus, A aktivieren, B zurück, links/rechts ändert Auswahlfelder und Regler'],
];

export class GamepadControl {
  constructor(game, input, hud) {
    this.game = game; this.input = input; this.hud = hud;
    this.active = false;       // Gamepad zuletzt benutzt (Cursor/Fokusrahmen sichtbar)
    this.cx = innerWidth / 2; this.cy = innerHeight / 2;
    this.prev = null; this.knownPads = new Set();
    this.hold = 0; this.aDown = null; this.radial = null;
    this.backT = 0; this.backLong = false;
    this.navT = 0; this.navDir = null;
    this.focus = null; this.menuScr = null;
    this.hoverT = 0; this.rumbleT = 0;
    this.vibration = true;
    try { const s = JSON.parse(localStorage.getItem(KEY) || '{}'); if (s.vibration === false) this.vibration = false; } catch (e) { /* ignorieren */ }
    this._build();
    window.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') this._deactivate(); }, true);
    window.addEventListener('pointerdown', () => this._deactivate(), true);
    window.addEventListener('gamepadconnected', (e) => this._connected(e.gamepad));
    window.addEventListener('gamepaddisconnected', (e) => { this.knownPads.delete(e.gamepad.index + e.gamepad.id); this.toast('Gamepad getrennt'); });
  }

  // ---------- DOM ----------
  _build() {
    const mk = (tag, id, html = '') => { const e = document.createElement(tag); e.id = id; e.innerHTML = html; document.body.appendChild(e); return e; };
    this.cursorEl = mk('div', 'gp-cursor', '<svg viewBox="-16 -16 32 32" width="32" height="32" aria-hidden="true"><circle r="9" fill="none"/><path d="M-15 0H-5M5 0H15M0 -15V-5M0 5V15"/><circle r="1.4" class="dot"/></svg>');
    this.cursorEl.classList.add('hidden');
    this.toastEl = mk('div', 'gp-toast'); this.toastEl.classList.add('hidden');
    this.radialEl = mk('div', 'gp-radial'); this.radialEl.classList.add('hidden');
    this.helpEl = mk('div', 'gp-help', `<div class="gp-help-box"><h3>Gamepad-Belegung</h3><table>${GAMEPAD_BINDINGS.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</table><p class="gp-vib"></p><p class="muted">Beliebige Taste schließt die Hilfe.</p></div>`);
    this.helpEl.classList.add('hidden');
  }
  toast(text, dur = 2.6) {
    this.toastEl.textContent = text; this.toastEl.classList.remove('hidden');
    clearTimeout(this._toastT); this._toastT = setTimeout(() => this.toastEl.classList.add('hidden'), dur * 1000);
  }
  _connected(pad) {
    const k = pad.index + pad.id;
    if (this.knownPads.has(k)) return;
    this.knownPads.add(k);
    this.toast('Gamepad verbunden: ' + String(pad.id).replace(/\(.*?\)/g, '').trim().slice(0, 40) + ' – Back lang drücken für die Belegung');
  }
  _deactivate() { if (this.active) { this.active = false; this._applyVisibility(); } }
  _applyVisibility(mode) {
    document.body.classList.toggle('gp-active', this.active);
    const show = this.active && (mode ?? this._mode()) === 'game';
    this.cursorEl.classList.toggle('hidden', !show);
  }

  // ---------- Modus ----------
  _topScreen() {
    const l = [...document.querySelectorAll('.screen:not(.hidden)')];
    if (!l.length) return null;
    let best = l[0], bz = -1;
    l.forEach((e, i) => { const z = (parseInt(getComputedStyle(e).zIndex, 10) || 0) * 100 + i; if (z >= bz) { bz = z; best = e; } });
    return best;
  }
  _mode() {
    if (!document.getElementById('loading')?.classList.contains('hidden')) return 'none';
    if (this._topScreen()) return 'menu';
    const g = this.game;
    if (g.active && !g.paused && !document.getElementById('hud')?.classList.contains('hidden')) return 'game';
    return 'none';
  }

  // ---------- Polling ----------
  _pad() {
    const list = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of list) if (p && p.connected !== false) return p;
    return null;
  }
  update(dt) {
    const pad = this._pad();
    if (!pad) { this.prev = null; if (this.cursorEl) this.cursorEl.classList.add('hidden'); return; }
    this._connected(pad);
    const ax = (i) => pad.axes[i] || 0;
    const dz = (x, y) => { const m = Math.hypot(x, y); if (m < DEAD) return [0, 0, 0]; const k = Math.min(1, (m - DEAD) / (1 - DEAD)) / m; return [x * k, y * k, Math.min(1, (m - DEAD) / (1 - DEAD))]; };
    const [lx, ly, lm] = dz(ax(0), ax(1));
    const [rx, ry, rm] = dz(ax(2), ax(3));
    const b = pad.buttons.map((x) => !!(x && (x.pressed || x.value > 0.6)));
    const val = (i) => (pad.buttons[i] ? pad.buttons[i].value || (pad.buttons[i].pressed ? 1 : 0) : 0);
    // Manche Pads melden die Trigger/D-Pad nicht als Buttons – D-Pad-Achsen-Fallback (Hat) ignorieren, Standard-Mapping erwartet
    const prev = this.prev || b.map(() => false);
    const edge = (i) => b[i] && !prev[i];
    const rel = (i) => !b[i] && prev[i];
    const st = { b, edge, rel, val, lx, ly, lm, rx, ry, rm, dt, pad };
    const any = b.some(Boolean) || lm > 0 || rm > 0;
    if (any && !this.active) { this.active = true; }
    this.prev = b;
    const mode = this._mode();
    this._applyVisibility(mode);
    if (this.helpEl && !this.helpEl.classList.contains('hidden')) { if (b.some((x, i) => edge(i))) this._help(false); return; }
    // Back lang: Hilfe (in jedem Modus)
    if (b[BTN.BACK]) { this.backT += dt; if (this.backT > 0.6 && !this.backLong) { this.backLong = true; this._help(true); return; } } else if (rel(BTN.BACK)) { /* unten behandelt */ }
    if (mode === 'menu') { this._menu(st); this._resetGame(); }
    else if (mode === 'game') this._game(st);
    else this._resetGame();
    if (!b[BTN.BACK]) { this.backT = 0; this.backLong = false; }
    this._hookFx();
  }
  _resetGame() {
    if (this.aDown) { this.input.hideBox(); this.aDown = null; }
    if (this.radial) this._radial(false);
  }
  _help(on) {
    this.helpEl.classList.toggle('hidden', !on);
    if (on) { const v = this.helpEl.querySelector('.gp-vib'); v.textContent = 'Vibration: ' + (this.vibration ? 'an' : 'aus') + ' (LB + R3 schaltet um)'; }
  }

  // ---------- Spiel ----------
  _game(s) {
    const g = this.game, inp = this.input, dt = s.dt, b = s.b;
    const cam = g.camera;
    const LB = b[BTN.LB];
    // Backtaste kurz = alle auswählen
    if (s.rel(BTN.BACK) && !this.backLong) { g.select(g.playerUnits()); g.audio.ui('click'); }
    if (this.radial) { this._radialUpdate(s); return; }
    // Cursor
    if (s.lm > 0) {
      this.hold = Math.min(1.5, this.hold + dt);
      const speed = (110 + 1150 * s.lm * s.lm) * (1 + Math.min(1, this.hold) * 0.45);
      this.cx = clamp(this.cx + s.lx * speed * dt, 0, innerWidth - 1);
      this.cy = clamp(this.cy + s.ly * speed * dt, 0, innerHeight - 1);
    } else this.hold = 0;
    // Rand-Scrollen
    const sp = cam.dist * 1.2 * dt, m = 22;
    let dx = 0, dz = 0;
    if (this.cx <= m && s.lx < -0.2) dx -= Math.abs(s.lx);
    if (this.cx >= innerWidth - 1 - m && s.lx > 0.2) dx += s.lx;
    if (this.cy <= m && s.ly < -0.2) dz -= Math.abs(s.ly);
    if (this.cy >= innerHeight - 1 - m && s.ly > 0.2) dz += s.ly;
    if (dx || dz) cam.pan(dx * sp, dz * sp);
    // Kamera: rechter Stick + Trigger
    if (s.rx) cam.rotate(-s.rx * dt * 2);
    const zin = s.val(BTN.RT), zout = s.val(BTN.LT);
    const z = s.ry * 1.4 + (zout - zin) * 1.6;
    if (z) cam.zoom(Math.exp(z * dt));
    // A: auswählen / Rahmen
    if (s.edge(BTN.A)) {
      if (inp.pendingAbility || inp.pendingBuild) inp.pickAt(this.cx, this.cy, { add: LB });
      else this.aDown = { sx: this.cx, sy: this.cy, moved: false };
    }
    if (this.aDown) {
      const a = this.aDown;
      if (!a.moved && Math.hypot(this.cx - a.sx, this.cy - a.sy) > 10) a.moved = true;
      if (a.moved && b[BTN.A]) inp.showBox(a.sx, a.sy, this.cx, this.cy);
      if (s.rel(BTN.A)) {
        if (a.moved) { inp.boxSelect(a.sx, a.sy, this.cx, this.cy, LB); inp.hideBox(); } else inp.pickAt(a.sx, a.sy, { add: LB });
        this.aDown = null;
      }
    }
    // B: Befehl / Abbrechen, X: Angriffsbewegung
    if (s.edge(BTN.B)) inp.commandAt(this.cx, this.cy, { attackMove: false });
    if (s.edge(BTN.X) && !inp.pendingAbility && !inp.pendingBuild) inp.commandAt(this.cx, this.cy, { attackMove: true });
    // Y: Halt (LB+Y: Feuer halten umschalten)
    if (s.edge(BTN.Y)) {
      const own = inp.ownSelected();
      if (own.length) {
        if (LB) { g.issueCommand({ t: 'hold', ids: own.map((u) => u.id), value: !own.every((u) => u.holdFire) }); this.hud.refreshSelection?.(); }
        else g.issueCommand({ t: 'stop', ids: own.map((u) => u.id) });
      }
    }
    // Steuerkreuz: Gruppen 1–4
    for (const [i, k] of [[BTN.UP, '1'], [BTN.RIGHT, '2'], [BTN.DOWN, '3'], [BTN.LEFT, '4']]) {
      if (s.edge(i)) { if (LB) inp.storeGroup(k); else inp.selectGroup(k); }
    }
    // RB: Fähigkeitenmenü bzw. Ziel abbrechen
    if (s.edge(BTN.RB)) { if (inp.pendingAbility) inp.cancelAbility(); else this._radial(true); }
    // Start: Pause
    if (s.edge(BTN.START)) this.hud.togglePause();
    // Stick-Klicks
    if (s.edge(BTN.L3)) { const own = inp.ownSelected(); if (own.length) cam.focus(own.reduce((t, u) => t + u.pos.x, 0) / own.length, own.reduce((t, u) => t + u.pos.z, 0) / own.length); }
    if (s.edge(BTN.R3)) { if (LB) { this.vibration = !this.vibration; try { localStorage.setItem(KEY, JSON.stringify({ vibration: this.vibration })); } catch (e) { /* ignorieren */ } this.toast('Vibration ' + (this.vibration ? 'an' : 'aus')); } else { const own = inp.ownSelected(); if (own.length) inp.selectSameType(own[0]); } }
    // Vorschau im Zielmodus + Cursor-Farbe
    if (inp.pendingAbility) inp._updatePreview(this.cx, this.cy);
    if (inp.pendingBuild) inp._updateBuildPreview(this.cx, this.cy);
    this.hoverT -= dt;
    if (this.hoverT <= 0) {
      this.hoverT = 0.12;
      const u = g.pickUnit(this.cx, this.cy);
      this.cursorEl.classList.toggle('enemy', !!(u && u.side !== g.localSide && u.side !== 'N'));
      this.cursorEl.classList.toggle('own', !!(u && g.isOwn(u)));
    }
    this.cursorEl.classList.toggle('target', !!(inp.pendingAbility || inp.pendingBuild));
    this.cursorEl.style.transform = `translate(${this.cx - 16}px, ${this.cy - 16}px)`;
  }

  // ---------- Radiales Fähigkeitenmenü ----------
  _radial(on) {
    const g = this.game;
    if (!on) { this.radial = null; this.radialEl.classList.add('hidden'); return; }
    const list = g.abilities || [];
    if (!list.length) { g.alert('Keine Fähigkeiten verfügbar', 1.5); return; }
    const n = list.length;
    this.radial = { idx: Math.max(0, list.findIndex((a) => g.abilityAvailable(a))), list };
    this.radialEl.innerHTML = `<div class="gp-rad-ring">${list.map((a, i) => {
      const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      return `<div class="gp-rad-item" data-i="${i}" style="left:calc(50% + ${Math.cos(ang) * 120}px);top:calc(50% + ${Math.sin(ang) * 120}px)">${icon(a.id)}<span>${a.def.name.split(/[ -]/)[0]}</span></div>`;
    }).join('')}<div class="gp-rad-center"></div></div>`;
    this.radialEl.classList.remove('hidden');
    this._radialMark();
  }
  _radialMark() {
    const r = this.radial; if (!r) return;
    this.radialEl.querySelectorAll('.gp-rad-item').forEach((e, i) => {
      e.classList.toggle('sel', i === r.idx);
      e.classList.toggle('off', !this.game.abilityAvailable(r.list[i]));
    });
    this.radialEl.querySelector('.gp-rad-center').textContent = r.list[r.idx].def.name;
  }
  _radialUpdate(s) {
    const r = this.radial, n = r.list.length;
    if (s.lm > 0.5) {
      const ang = Math.atan2(s.ly, s.lx) + Math.PI / 2;
      const k = ((Math.round(ang / (2 * Math.PI / n)) % n) + n) % n;
      if (k !== r.idx) { r.idx = k; this._radialMark(); }
    }
    if (s.edge(BTN.LEFT) || s.edge(BTN.UP)) { r.idx = (r.idx + n - 1) % n; this._radialMark(); }
    if (s.edge(BTN.RIGHT) || s.edge(BTN.DOWN)) { r.idx = (r.idx + 1) % n; this._radialMark(); }
    if (s.edge(BTN.A) || s.edge(BTN.RB)) { const a = r.list[r.idx]; this._radial(false); this.input.startAbility(a); }
    else if (s.edge(BTN.B) || s.edge(BTN.START)) this._radial(false);
  }

  // ---------- Menüs ----------
  _visible(el) {
    if (!el.getClientRects().length || el.closest('.hidden')) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && !el.disabled;
  }
  _items(scr) {
    return [...scr.querySelectorAll('button, select, input:not([type=hidden]), a[href], .mission-card:not(.locked), [tabindex="0"]')].filter((e) => this._visible(e));
  }
  _setFocus(el) {
    if (this.focus && this.focus !== el) this.focus.classList.remove('gp-focus');
    this.focus = el;
    if (!el) return;
    el.classList.add('gp-focus');
    try { el.focus({ preventScroll: true }); } catch (e) { /* ignorieren */ }
    el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }
  _menu(s) {
    const scr = this._topScreen();
    if (scr !== this.menuScr) { this.menuScr = scr; this._setFocus(null); }
    let f = this.focus;
    if (!f || !scr.contains(f) || !this._visible(f)) {
      const items = this._items(scr);
      f = items.find((e) => e.classList.contains('big')) || items[0] || null;
      this._setFocus(f);
    }
    if (!this.active) return;
    // Richtung (Steuerkreuz + Stick mit Wiederholung)
    let dir = null;
    if (s.b[BTN.UP]) dir = 'up'; else if (s.b[BTN.DOWN]) dir = 'down'; else if (s.b[BTN.LEFT]) dir = 'left'; else if (s.b[BTN.RIGHT]) dir = 'right';
    else if (s.lm > 0.55) dir = Math.abs(s.lx) > Math.abs(s.ly) ? (s.lx > 0 ? 'right' : 'left') : (s.ly > 0 ? 'down' : 'up');
    if (!dir) { this.navDir = null; this.navT = 0; }
    else {
      this.navT -= s.dt;
      if (dir !== this.navDir || this.navT <= 0) { const first = dir !== this.navDir; this.navDir = dir; this.navT = first ? 0.38 : 0.13; this._move(dir); }
    }
    f = this.focus;
    if (s.edge(BTN.A) && f) this._activate(f, s.b[BTN.LB] ? -1 : 1);
    if (s.edge(BTN.B)) this._back(scr);
    if (s.edge(BTN.START) && scr.id === 'screen-pause') document.getElementById('btn-resume')?.click();
  }
  _move(dir) {
    const f = this.focus;
    if (f && (dir === 'left' || dir === 'right')) {
      if (f.tagName === 'SELECT') { this._cycle(f, dir === 'right' ? 1 : -1); return; }
      if (f.tagName === 'INPUT' && f.type === 'range') { this._range(f, dir === 'right' ? 1 : -1); return; }
    }
    const items = this._items(this.menuScr).filter((e) => e !== f);
    if (!f) { this._setFocus(items[0]); return; }
    const r0 = f.getBoundingClientRect(), x0 = r0.left + r0.width / 2, y0 = r0.top + r0.height / 2;
    let best = null, bs = Infinity;
    for (const e of items) {
      const r = e.getBoundingClientRect(), dx = r.left + r.width / 2 - x0, dy = r.top + r.height / 2 - y0;
      const [pri, sec] = dir === 'right' ? [dx, dy] : dir === 'left' ? [-dx, dy] : dir === 'down' ? [dy, dx] : [-dy, dx];
      if (pri < 3) continue;
      const score = pri + Math.abs(sec) * 2.5;
      if (score < bs) { bs = score; best = e; }
    }
    if (best) this._setFocus(best);
  }
  _cycle(sel, d) {
    const n = sel.options.length; if (!n) return;
    let i = sel.selectedIndex;
    for (let k = 0; k < n; k++) { i = (i + d + n) % n; if (!sel.options[i].disabled) break; }
    sel.selectedIndex = i;
    sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true }));
  }
  _range(el, d) {
    const min = +el.min || 0, max = el.max === '' ? 100 : +el.max, step = +el.step || (max - min) / 20;
    el.value = clamp(+el.value + d * step, min, max);
    el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  _activate(el, d = 1) {
    if (el.tagName === 'SELECT') this._cycle(el, d);
    else if (el.tagName === 'INPUT' && (el.type === 'range')) this._range(el, d);
    else if (el.tagName === 'INPUT' && el.type !== 'checkbox' && el.type !== 'radio' && el.type !== 'button' && el.type !== 'submit') el.focus();
    else el.click();
  }
  _back(scr) {
    if (scr.id === 'screen-pause') { document.getElementById('btn-resume')?.click(); return; }
    const b = [...scr.querySelectorAll('.back, .back-campaign, #btn-lobby-leave, #net-msg-ok, #ed-modal-cancel')].find((e) => this._visible(e));
    if (b) b.click();
  }

  // ---------- Vibration ----------
  _hookFx() {
    const fx = this.game.effects;
    if (!fx || fx.__gpHook || typeof fx.explosion !== 'function') return;
    fx.__gpHook = true;
    const orig = fx.explosion.bind(fx);
    fx.explosion = (x, y, z, size = 1, o) => { const r = orig(x, y, z, size, o); try { this._rumbleAt(x, z, size); } catch (e) { /* ignorieren */ } return r; };
  }
  _rumbleAt(x, z, size) {
    if (!this.vibration || !this.active) return;
    const t = this.game.camera?.target; if (!t) return;
    const now = performance.now();
    if (now - this.rumbleT < 120) return;
    const d = Math.hypot(x - t.x, z - t.z), R = 55 + size * 12;
    if (d > R) return;
    this.rumbleT = now;
    const k = clamp((1 - d / R) * (0.35 + size * 0.3), 0, 0.7);
    const pad = this._pad(); if (!pad) return;
    const dur = Math.round(70 + size * 50);
    try {
      if (pad.vibrationActuator?.playEffect) pad.vibrationActuator.playEffect('dual-rumble', { startDelay: 0, duration: dur, weakMagnitude: k * 0.6, strongMagnitude: k * 0.4 });
      else if (pad.hapticActuators?.[0]?.pulse) pad.hapticActuators[0].pulse(k, dur);
    } catch (e) { /* ignorieren */ }
  }
}
