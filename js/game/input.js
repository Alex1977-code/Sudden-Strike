// RTS-Kamera und Eingabe (Maus, Tastatur, Touch)
import * as THREE from 'three';
import { clamp, lerp } from '../engine/util.js';
import { UNIT_TYPES } from './unitTypes.js';
import { knownHostile } from './garrison.js';

export class RTSCamera {
  constructor(game, cam) {
    this.game = game;
    this.cam = cam;
    this.target = new THREE.Vector3();
    this.goal = new THREE.Vector3();
    this.dist = 80; this.goalDist = 80;
    this.yaw = 0; this.goalYaw = 0;
    this.minDist = 22; this.maxDist = 170;
    this.orbit = false;
  }
  reset(x, z, dist = 80, yaw = 0) {
    this.goal.set(x, 0, z); this.target.copy(this.goal);
    this.dist = this.goalDist = dist; this.yaw = this.goalYaw = yaw;
  }
  focus(x, z) { this.goal.x = x; this.goal.z = z; }
  pan(dx, dz) {
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    this.goal.x += dx * c + dz * s;
    this.goal.z += -dx * s + dz * c;
  }
  zoom(f) { this.goalDist = clamp(this.goalDist * f, this.minDist, this.maxDist); }
  rotate(a) { this.goalYaw += a; }
  update(dt) {
    const g = this.game;
    if (!g.terrain) return;
    if (this.orbit) this.goalYaw += dt * 0.05;
    const half = g.terrain.half;
    this.goal.x = clamp(this.goal.x, -half + 10, half - 10);
    this.goal.z = clamp(this.goal.z, -half + 10, half - 10);
    const k = 1 - Math.exp(-dt * 10);
    this.target.x = lerp(this.target.x, this.goal.x, k);
    this.target.z = lerp(this.target.z, this.goal.z, k);
    this.target.y = lerp(this.target.y, g.terrain.surface(this.target.x, this.target.z), 1 - Math.exp(-dt * 4));
    this.dist = lerp(this.dist, this.goalDist, 1 - Math.exp(-dt * 8));
    this.yaw = lerp(this.yaw, this.goalYaw, 1 - Math.exp(-dt * 8));
    const pitch = lerp(0.72, 1.05, (this.dist - this.minDist) / (this.maxDist - this.minDist));
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const shake = g.effects ? g.effects.shake : 0;
    const sx = shake ? (Math.random() - 0.5) * shake * 0.8 : 0, sy = shake ? (Math.random() - 0.5) * shake * 0.8 : 0;
    this.cam.position.set(this.target.x + Math.sin(this.yaw) * cp * this.dist + sx, this.target.y + sp * this.dist + sy, this.target.z + Math.cos(this.yaw) * cp * this.dist);
    const minY = g.terrain.surface(this.cam.position.x, this.cam.position.z) + 6;
    if (this.cam.position.y < minY) this.cam.position.y = minY;
    this.cam.lookAt(this.target.x + sx * 0.5, this.target.y, this.target.z);
    if (g.gr) g.gr.updateShadowCamera(this.target, this.dist * 1.1 + 30);
  }
}

export class Input {
  constructor(game, canvas, hud) {
    this.game = game;
    this.canvas = canvas;
    this.hud = hud;
    this.keys = new Set();
    this.pointers = new Map();
    this.mouse = { x: -1, y: -1, inside: false };
    this.pendingAbility = null;
    this.pendingBuild = null; // { mode: 'build'|'clearmines'|'demolish', kind } – Platzieren per Klick/Antippen
    this.buildRot = null;
    this.boxMode = false;
    this.lastTap = { t: 0, unit: null };
    this.selbox = document.getElementById('selbox');
    this.preview = null;
    this._bind();
  }
  get touch() { return document.body.classList.contains('touch'); }

  _bind() {
    const c = this.canvas;
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('pointerdown', (e) => this.onDown(e));
    window.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerup', (e) => this.onUp(e));
    window.addEventListener('pointercancel', (e) => this.onUp(e, true));
    c.addEventListener('wheel', (e) => { e.preventDefault(); if (this.game.active) this.game.camera.zoom(e.deltaY > 0 ? 1.12 : 0.89); }, { passive: false });
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    document.addEventListener('mouseleave', () => (this.mouse.inside = false));
    window.addEventListener('blur', () => this.keys.clear());
  }

  ndc(x, y) { return [(x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1]; }
  ground(x, y) { const [nx, ny] = this.ndc(x, y); return this.game.groundPick(nx, ny); }

  onDown(e) {
    const g = this.game;
    if (!g.active || g.paused) return;
    if (e.pointerType === 'touch') document.body.classList.add('touch');
    this.canvas.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, button: e.button, type: e.pointerType, t: performance.now(), moved: false });
    if (this.pointers.size === 2) this._startPinch();
    if (e.pointerType === 'touch' && this.pointers.size === 1) {
      clearTimeout(this.longPress);
      this.longPress = setTimeout(() => {
        const p = this.pointers.get(e.pointerId);
        if (p && !p.moved && this.pointers.size === 1) { p.longPressed = true; g.select([]); this.cancelAbility(); this.cancelBuild(); if (navigator.vibrate) navigator.vibrate(20); }
      }, 550);
    }
  }
  _startPinch() {
    const [a, b] = [...this.pointers.values()];
    a.moved = b.moved = true;
    clearTimeout(this.longPress);
    this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
    this.hideBox();
  }
  onMove(e) {
    const g = this.game;
    this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.inside = true;
    if (e.pointerType === 'mouse') this.lastMouseMove = performance.now();
    const p = this.pointers.get(e.pointerId);
    if (!g.active) return;
    if (this.pendingAbility && e.pointerType === 'mouse') this._updatePreview(e.clientX, e.clientY);
    if (this.pendingBuild && e.pointerType === 'mouse') this._updateBuildPreview(e.clientX, e.clientY);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (Math.hypot(p.x - p.sx, p.y - p.sy) > 8) { p.moved = true; clearTimeout(this.longPress); }
    if (this.pointers.size === 2 && this.pinch) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (this.pinch.d > 10) g.camera.zoom(this.pinch.d / Math.max(10, d));
      g.camera.rotate(-(ang - this.pinch.ang));
      const s = g.camera.dist / window.innerHeight * 1.6;
      g.camera.pan(-(mx - this.pinch.mx) * s, -(my - this.pinch.my) * s);
      this.pinch = { d, ang, mx, my };
      return;
    }
    if (p.type === 'mouse') {
      if (p.button === 1 || (p.button === 0 && this.keys.has('Alt'))) { g.camera.rotate(-dx * 0.006); return; }
      if (p.button === 2) { const s = g.camera.dist / window.innerHeight * 1.6; g.camera.pan(-dx * s, -dy * s); return; }
      if (p.button === 0 && p.moved && !this.pendingAbility && !this.pendingBuild) this.showBox(p.sx, p.sy, p.x, p.y);
    } else {
      // Touch: ein Finger
      if (this.boxMode && !this.pendingAbility && !this.pendingBuild) { if (p.moved) this.showBox(p.sx, p.sy, p.x, p.y); return; }
      if (p.moved) { const s = g.camera.dist / window.innerHeight * 1.6; g.camera.pan(-dx * s, -dy * s); }
    }
  }
  onUp(e, cancel = false) {
    const g = this.game;
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this.pointers.delete(e.pointerId);
    clearTimeout(this.longPress);
    if (this.pointers.size < 2) this.pinch = null;
    if (cancel || !g.active || p.longPressed) { this.hideBox(); return; }
    if (p.type === 'mouse') {
      if (p.button === 0) {
        if (p.moved && !this.pendingAbility && !this.pendingBuild) { this.boxSelect(p.sx, p.sy, p.x, p.y, e.shiftKey); this.hideBox(); }
        else if (!p.moved) this.leftClick(p.x, p.y, e.shiftKey);
      } else if (p.button === 2 && !p.moved) this.rightClick(p.x, p.y, e.ctrlKey);
    } else {
      if (this.boxMode && p.moved) { this.boxSelect(p.sx, p.sy, p.x, p.y, false); this.hideBox(); this.setBoxMode(false); return; }
      if (!p.moved && performance.now() - p.t < 450) this.tap(p.x, p.y);
    }
  }

  // ---------- Befehle (nur über serialisierbare Kommandos) ----------
  ownSelected() { return this.game.selected.filter((u) => u.alive && this.game.isOwn(u)); }
  // Ziel unter dem Zeiger: Feind/Neutral → Angriff, sonst Bewegung zum Bodenpunkt
  orderAt(own, x, y, u, attackMove = false) {
    const g = this.game;
    const ids = own.map((o) => o.id);
    if (u && u.abandoned) {
      // Infanterie übernimmt das verlassene Fahrzeug, alles andere schießt es ggf. zusammen
      const inf = own.filter((o) => o.type.infantry);
      if (inf.length) {
        g.issueCommand({ t: 'crew', ids: inf.map((o) => o.id), target: u.id });
        const rest = own.filter((o) => !o.type.infantry);
        if (rest.length) g.issueCommand({ t: 'attack', ids: rest.map((o) => o.id), target: u.id });
        return;
      }
    }
    if (u && u.type.key === 'house' && !attackMove) {
      // Haus: Infanterie besetzt (eigene/leere Häuser), alle anderen und erkannte Feindbesatzung → Angriff
      // (MP-T7: nur aufgeklärte Feindbesatzung zählt – sonst verriete die Reaktion die Besetzung)
      const mine = !knownHostile(g, u, g.localSide);
      const inf = own.filter((o) => o.type.infantry && !o.type.kamikaze);
      if (mine && inf.length) {
        g.issueCommand({ t: 'garrison', ids: inf.map((o) => o.id), target: u.id });
        const rest = own.filter((o) => !inf.includes(o));
        if (rest.length) g.issueCommand({ t: 'move', ids: rest.map((o) => o.id), x: u.pos.x, z: u.pos.z });
        return;
      }
    }
    if (u && u.side !== g.localSide) { g.issueCommand({ t: 'attack', ids, target: u.id }); return; }
    const p = this.ground(x, y);
    if (p) g.issueCommand({ t: 'move', ids, x: p.x, z: p.z, attackMove });
  }

  // ---------- Maus ----------
  leftClick(x, y, shift) {
    const g = this.game;
    if (this.pendingAbility) { this.fireAbility(x, y); return; }
    if (this.pendingBuild) { this.fireBuild(x, y, shift); return; }
    const u = g.pickUnit(x, y);
    const now = performance.now();
    if (u && g.isOwn(u)) {
      if (now - this.lastTap.t < 350 && this.lastTap.unit === u) this.selectSameType(u);
      else if (shift) { if (g.selected.includes(u)) g.select(g.selected.filter((s) => s !== u)); else g.select([u], true); }
      else g.select([u]);
      this.lastTap = { t: now, unit: u };
      g.audio.ui('click');
    } else if (u && this._selectOccupants(u)) { /* Besatzung gewählt */ }
    else if (u) { g.select([u]); }
    else if (!shift) g.select([]);
  }
  rightClick(x, y, ctrl) {
    const g = this.game;
    if (this.pendingAbility) { this.cancelAbility(); return; }
    if (this.pendingBuild) { this.cancelBuild(); return; }
    const own = this.ownSelected();
    if (!own.length) return;
    this.orderAt(own, x, y, g.pickUnit(x, y), ctrl);
  }
  // ---------- Touch ----------
  tap(x, y) {
    const g = this.game;
    if (this.pendingAbility) { this.fireAbility(x, y); return; }
    if (this.pendingBuild) { this.fireBuild(x, y, false); return; }
    const u = g.pickUnit(x, y, 34);
    const now = performance.now();
    const own = this.ownSelected();
    if (u && g.isOwn(u)) {
      if (now - this.lastTap.t < 380 && this.lastTap.unit === u) this.selectSameType(u);
      else if (own.length && own.includes(u) && own.length > 1) g.select([u]);
      else g.select([u]);
      this.lastTap = { t: now, unit: u };
      g.audio.ui('click');
      return;
    }
    if (own.length) this.orderAt(own, x, y, u);
    else if (u && this._selectOccupants(u)) { /* Besatzung gewählt */ }
    else if (u) g.select([u]);
  }
  // Klick auf ein eigenes besetztes Haus wählt die Besatzung
  _selectOccupants(h) {
    const g = this.game;
    if (h.type.key !== 'house' || !h.occupants?.length || h.garrisonSide !== g.localSide) return false;
    const mine = h.occupants.filter((o) => g.isOwn(o));
    if (!mine.length) return false;
    g.select(mine); g.audio.ui('click');
    return true;
  }
  selectSameType(u) {
    const g = this.game;
    const list = g.units.filter((o) => g.isOwn(o) && o.alive && o.type.key === u.type.key && this.onScreen(o));
    g.select(list);
  }
  onScreen(u) {
    const v = u.aimPoint().project(this.game.gr.camera);
    return v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1;
  }
  boxSelect(x0, y0, x1, y1, add) {
    const g = this.game;
    const minX = Math.min(x0, x1), maxX = Math.max(x0, x1), minY = Math.min(y0, y1), maxY = Math.max(y0, y1);
    const w = window.innerWidth, h = window.innerHeight;
    const v = new THREE.Vector3();
    const list = g.units.filter((u) => {
      if (!u.alive || !g.isOwn(u) || u.type.structure) return false;
      u.aimPoint(v); v.project(g.gr.camera);
      if (v.z > 1) return false;
      const px = (v.x * 0.5 + 0.5) * w, py = (-v.y * 0.5 + 0.5) * h;
      return px >= minX && px <= maxX && py >= minY && py <= maxY;
    });
    if (list.length || !add) g.select(list, add);
    if (list.length) g.audio.ui('click');
  }
  showBox(x0, y0, x1, y1) {
    const s = this.selbox.style;
    this.selbox.classList.remove('hidden');
    s.left = Math.min(x0, x1) + 'px'; s.top = Math.min(y0, y1) + 'px';
    s.width = Math.abs(x1 - x0) + 'px'; s.height = Math.abs(y1 - y0) + 'px';
  }
  hideBox() { this.selbox.classList.add('hidden'); }
  setBoxMode(v) { this.boxMode = v; document.getElementById('btn-box')?.classList.toggle('active', v); }

  // ---------- Fähigkeiten ----------
  startAbility(a) {
    const g = this.game;
    if (!g.abilityAvailable(a)) { g.audio.ui('fail'); return; }
    if (this.pendingAbility === a) { this.cancelAbility(); return; }
    this.pendingAbility = a;
    this.hud.showTargetHint(`Ziel wählen: ${a.def.name}`, () => this.cancelAbility());
    this.hud.refreshAbilities();
    if (!this.preview) {
      const geo = new THREE.RingGeometry(0.92, 1, 48); geo.rotateX(-Math.PI / 2);
      this.preview = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffd500, transparent: true, opacity: 0.8, depthTest: false }));
      this.preview.renderOrder = 6;
    }
    this.preview.scale.setScalar(a.def.radius || 8);
    g.scene.add(this.preview);
    this.preview.visible = false;
    if (this.mouse.inside && !this.touch) this._updatePreview(this.mouse.x, this.mouse.y);
  }
  _updatePreview(x, y) {
    if (!this.preview) return;
    const p = this.ground(x, y);
    if (!p) { this.preview.visible = false; return; }
    this.preview.visible = true;
    this.preview.position.set(p.x, p.y + 0.4, p.z);
  }
  cancelAbility() {
    this.pendingAbility = null;
    this.hud.hideTargetHint();
    this.hud.refreshAbilities();
    if (this.preview) this.game.scene.remove(this.preview);
  }
  fireAbility(x, y) {
    const a = this.pendingAbility;
    const p = this.ground(x, y);
    if (!p) return;
    const ok = this.game.issueCommand({ t: 'ability', ability: a.id, x: p.x, z: p.z });
    if (ok === false) this.game.audio.ui('fail');
    this.cancelAbility();
  }

  // ---------- Pioniere: Bauen / Minen räumen / Sprengen (Platzieren per Klick bzw. Antippen) ----------
  engineers() { return this.ownSelected().filter((u) => u.type.engineer); }
  startBuild(mode, kind = null) {
    const g = this.game;
    if (mode !== 'binoculars' && mode !== 'garrison' && !this.engineers().length) { g.audio.ui('fail'); return; }
    if (this.pendingBuild && this.pendingBuild.mode === mode && this.pendingBuild.kind === kind) { this.cancelBuild(); return; }
    this.cancelAbility();
    this.pendingBuild = { mode, kind };
    const touch = this.touch;
    const txt = mode === 'binoculars' ? 'Blickrichtung des Fernglases wählen' : mode === 'garrison' ? 'Gebäude zum Besetzen wählen' : mode === 'build' ? `${UNIT_TYPES[kind].name} platzieren` : mode === 'clearmines' ? 'Minenfeld zum Räumen wählen' : 'Brücke/Gebäude zum Sprengen wählen';
    this.hud.showTargetHint(txt + (touch ? ' – Karte antippen' : mode === 'build' ? ' – Klick platziert (R dreht)' : ' – Klick wählt'), () => this.cancelBuild());
    if (mode === 'build') {
      const d = UNIT_TYPES[kind].build;
      if (!this.buildPreview) {
        this.buildPreview = new THREE.Mesh(new THREE.BoxGeometry(1, 0.3, 1), new THREE.MeshBasicMaterial({ color: 0x5dff8a, transparent: true, opacity: 0.45, depthTest: false }));
        this.buildPreview.renderOrder = 6;
      }
      this.buildPreview.scale.set(d.w, 1, d.d);
      g.scene.add(this.buildPreview);
      this.buildPreview.visible = false;
      if (this.mouse.inside && !touch) this._updateBuildPreview(this.mouse.x, this.mouse.y);
    }
    this.hud.refreshBuildbar(true);
  }
  _autoRot(px, pz) {
    const e = this.engineers()[0];
    return e ? Math.atan2(px - e.pos.x, pz - e.pos.z) : 0;
  }
  _updateBuildPreview(x, y) {
    const pb = this.pendingBuild;
    if (!pb || pb.mode !== 'build' || !this.buildPreview) return;
    const p = this.ground(x, y);
    if (!p) { this.buildPreview.visible = false; return; }
    const rot = this.buildRot ?? this._autoRot(p.x, p.z);
    this.buildPreview.visible = true;
    this.buildPreview.position.set(p.x, p.y + 0.5, p.z);
    this.buildPreview.rotation.y = rot;
    const ok = this.game.logi.footprintOk(pb.kind, p.x, p.z, rot);
    this.buildPreview.material.color.setHex(ok ? 0x5dff8a : 0xff4d4d);
  }
  cancelBuild() {
    if (!this.pendingBuild) return;
    this.pendingBuild = null;
    this.buildRot = null;
    this.hud.hideTargetHint();
    if (this.buildPreview) this.game.scene.remove(this.buildPreview);
    this.hud.refreshBuildbar(true);
  }
  fireBuild(x, y, keep) {
    const g = this.game, pb = this.pendingBuild;
    if (pb.mode === 'binoculars' || pb.mode === 'garrison') {
      const own = this.ownSelected();
      if (!own.length) { this.cancelBuild(); return; }
      let okk;
      if (pb.mode === 'binoculars') {
        const p = this.ground(x, y); if (!p) return;
        okk = g.issueCommand({ t: 'binoculars', ids: own.filter((u) => u.bino).map((u) => u.id), x: p.x, z: p.z });
      } else {
        const h = g.pickUnit(x, y, 36);
        if (!h || h.type.key !== 'house') { g.audio.ui('fail'); return; }
        okk = g.issueCommand({ t: 'garrison', ids: own.filter((u) => u.type.infantry).map((u) => u.id), target: h.id });
      }
      if (okk === false) { g.audio.ui('fail'); return; }
      g.audio.ui('ack');
      this.cancelBuild();
      return;
    }
    const eng = this.engineers();
    const ids = eng.map((u) => u.id);
    if (!eng.length) { this.cancelBuild(); return; }
    let ok = false;
    if (pb.mode === 'build') {
      const p = this.ground(x, y); if (!p) return;
      ok = g.issueCommand({ t: 'build', ids, kind: pb.kind, x: p.x, z: p.z, rot: this.buildRot ?? this._autoRot(p.x, p.z) });
    } else if (pb.mode === 'clearmines') {
      const p = this.ground(x, y); if (!p) return;
      ok = g.issueCommand({ t: 'clearmines', ids, x: p.x, z: p.z });
    } else {
      const u = g.pickUnit(x, y, 36);
      if (!u) { g.audio.ui('fail'); return; }
      ok = g.issueCommand({ t: 'demolish', ids, target: u.id });
    }
    if (ok === false) { g.audio.ui('fail'); if (pb.mode === 'build') g.alert('Hier kann nicht gebaut werden (Material, Gelände oder Hindernis).', 1.8); return; }
    g.audio.ui('ack');
    if (!keep) this.cancelBuild();
  }

  // ---------- Tastatur ----------
  onKey(e, down) {
    const g = this.game;
    const k = e.key;
    if (down) this.keys.add(k.length === 1 ? k.toLowerCase() : k); else this.keys.delete(k.length === 1 ? k.toLowerCase() : k);
    if (!down || !g.active) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
    if (k === 'Escape') { if (this.pendingAbility) this.cancelAbility(); else if (this.pendingBuild) this.cancelBuild(); else this.hud.togglePause(); return; }
    if ((k === 'r' || k === 'R') && this.pendingBuild?.mode === 'build') { this.buildRot = ((this.buildRot ?? 0) + Math.PI / 4) % (Math.PI * 2); this._updateBuildPreview(this.mouse.x, this.mouse.y); return; }
    if (g.paused && k !== ' ') return;
    if (k === ' ') { e.preventDefault(); this.hud.togglePause(); return; }
    if (/^F[1-6]$/.test(k)) { e.preventDefault(); const a = g.abilities[+k.slice(1) - 1]; if (a) this.startAbility(a); return; }
    const own = this.ownSelected();
    if ((k === 'a' || k === 'A') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); g.select(g.playerUnits()); return; }
    if (k === 's' && !e.ctrlKey && own.length && !this.keys.has('w')) { /* S = Halt nur mit Auswahl, sonst Kamera */ g.issueCommand({ t: 'stop', ids: own.map((u) => u.id) }); this.stopPressed = true; return; }
    if (k === 'h') { if (own.length) { g.issueCommand({ t: 'hold', ids: own.map((u) => u.id), value: !own.every((u) => u.holdFire) }); this.hud.refreshSelection(); } return; }
    if (/^[1-9]$/.test(k)) {
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); g.groups[k] = [...own]; g.alert(`Gruppe ${k} gespeichert (${own.length})`, 1.5); }
      else if (g.groups[k]) {
        const list = g.groups[k].filter((u) => u.alive);
        if (this.lastGroupKey === k && performance.now() - this.lastGroupT < 400 && list.length) g.camera.focus(list[0].pos.x, list[0].pos.z);
        g.select(list); this.lastGroupKey = k; this.lastGroupT = performance.now();
      }
      return;
    }
    if (k === 'f' && own.length) { g.camera.focus(own[0].pos.x, own[0].pos.z); return; }
    if (k === '+' ) g.camera.zoom(0.85);
    if (k === '-') g.camera.zoom(1.15);
  }

  update(dt) {
    const g = this.game;
    if (!g.active || g.paused) return;
    const sp = g.camera.dist * 1.2 * dt;
    let dx = 0, dz = 0;
    const ks = this.keys;
    if (ks.has('w') || ks.has('ArrowUp')) dz -= 1;
    if ((ks.has('s') && !g.selected.some((u) => g.isOwn(u))) || ks.has('ArrowDown')) dz += 1;
    if (ks.has('a') || ks.has('ArrowLeft')) dx -= 1;
    if (ks.has('d') || ks.has('ArrowRight')) dx += 1;
    if (ks.has('q')) g.camera.rotate(dt * 1.5);
    if (ks.has('e')) g.camera.rotate(-dt * 1.5);
    // Bildschirmrand-Scrollen (nur Maus, im Vollbild/Fenster)
    if (!this.touch && this.mouse.inside && this.pointers.size === 0 && this.lastMouseMove && performance.now() - this.lastMouseMove < 8000) {
      const m = 6, w = window.innerWidth, h = window.innerHeight;
      if (this.mouse.x <= m) dx -= 1; else if (this.mouse.x >= w - m) dx += 1;
      if (this.mouse.y <= m) dz -= 1; else if (this.mouse.y >= h - m) dz += 1;
    }
    if (dx || dz) g.camera.pan(dx * sp, dz * sp);
  }
}
