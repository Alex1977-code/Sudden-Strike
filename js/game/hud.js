// HUD: Ziele, Auswahl, Fähigkeiten, Minikarte, Lebensbalken, Funksprüche
import * as THREE from 'three';
import { fmtTime } from '../engine/util.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor(game, settings) {
    this.game = game;
    this.settings = settings;
    this.el = $('hud');
    this.objEl = $('objectives');
    this.selEl = $('selection');
    this.abEl = $('abilities');
    this.alertEl = $('alert');
    this.subEl = $('subtitle');
    this.timerEl = $('timer');
    this.fpsEl = $('fps');
    this.mm = $('minimap');
    this.mmCtx = this.mm.getContext('2d');
    this.mmBg = null;
    this.mmFog = document.createElement('canvas');
    this.mmFog.width = this.mmFog.height = 128;
    this.mmFogCtx = this.mmFog.getContext('2d');
    this.mmFogImg = this.mmFogCtx.createImageData(128, 128);
    this.sayQueue = [];
    this.sayT = 0;
    this.alertT = 0;
    this.mmT = 0;
    // Overlay für Lebensbalken
    this.overlay = document.createElement('canvas');
    Object.assign(this.overlay.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 });
    document.body.appendChild(this.overlay);
    this.octx = this.overlay.getContext('2d');
    this._resize();
    window.addEventListener('resize', () => this._resize());

    game.minimapReady = (img) => { this.mmBg = img; };
    game.on('objectives', () => this.refreshObjectives());
    game.on('selection', () => this.refreshSelection());
    game.on('abilities', () => this.refreshAbilities());
    game.on('say', (s, t, d) => this.queueSay(s, t, d));
    game.on('alert', (t, d) => this.showAlert(t, d));
    game.on('localPlayer', () => { this.refreshSelection(); this.refreshAbilities(); });
    game.on('players', () => { this.refreshSelection(); this.refreshAbilities(); });
    game.on('loaded', () => { this.refreshObjectives(); this.refreshSelection(); this.refreshAbilities(); this.sayQueue = []; this.subEl.classList.add('hidden'); this.alertEl.classList.add('hidden'); });
    game.on('underAttack', (u) => {
      const now = performance.now();
      if (now - (this.lastAttackPing || 0) > 12000 && !this._onScreen(u)) { this.lastAttackPing = now; this.attackPing = { x: u.pos.x, z: u.pos.z, t: 3 }; }
    });

    // Befehlsknöpfe
    $('orders').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const own = game.selected.filter((u) => u.alive && game.isOwn(u));
      const ids = own.map((u) => u.id);
      const o = b.dataset.order;
      if (o === 'stop') { if (ids.length) game.issueCommand({ t: 'stop', ids }); }
      else if (o === 'hold') { if (ids.length) { game.issueCommand({ t: 'hold', ids, value: !own.every((u) => u.holdFire) }); this.refreshSelection(); } }
      else if (o === 'all') game.select(game.playerUnits().filter((u) => !u.type.kamikaze || true));
      else if (o === 'box') this.input.setBoxMode(!this.input.boxMode);
      game.audio.ui('click');
    });
    this.mm.addEventListener('pointerdown', (e) => this._minimapClick(e));
    this.mm.addEventListener('pointermove', (e) => { if (e.buttons & 1) this._minimapClick(e, true); });
    this.mm.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  _resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.overlay.width = window.innerWidth * dpr; this.overlay.height = window.innerHeight * dpr;
    this.octx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  show(v) { this.el.classList.toggle('hidden', !v); this.overlay.style.display = v ? 'block' : 'none'; }

  // ---------- Ziele ----------
  refreshObjectives() {
    const g = this.game;
    this.objEl.innerHTML = (g.objectives || []).filter((o) => !o.hidden).map((o) => {
      const box = o.state === 'done' ? '☑' : o.state === 'failed' ? '☒' : '☐';
      return `<div class="obj ${o.state} ${o.optional ? 'optional' : ''}"><span class="box">${box}</span><span>${o.optional ? '(Optional) ' : ''}${o.text}</span></div>`;
    }).join('') || '<div class="obj">—</div>';
  }

  // ---------- Auswahl ----------
  refreshSelection() {
    const g = this.game;
    const sel = g.selected.filter((u) => u.alive);
    if (!sel.length) { this.selEl.innerHTML = ''; return; }
    if (sel.length === 1) {
      const u = sel[0];
      const w = u.type.weaponDefs.map((w) => w.name).join(', ') || 'unbewaffnet';
      const side = g.isOwn(u) ? '' : u.side === g.localSide ? `<span style="color:#5db8ff">Verbündet${g.playerById(u.owner) ? ' (' + g.playerById(u.owner).name + ')' : ''}</span> · ` : u.side === 'N' ? '<span class="muted">Neutral</span> · ' : '<span style="color:#ff6b6b">Feind</span> · ';
      this.selEl.innerHTML = `${this._unitBox(u, 1)}<div class="sel-detail"><b>${u.name}</b><br>${side}<span class="muted">${w}</span><br><span class="muted">${u.type.desc || ''}</span>${u.holdFire ? '<br><span style="color:#ffd500">Feuer halten</span>' : ''}<span class="hpnum"></span></div>`;
      this.selEl.firstChild.onclick = () => g.camera.focus(u.pos.x, u.pos.z);
      return;
    }
    // Gruppiert nach Typ
    const groups = new Map();
    for (const u of sel) { if (!groups.has(u.type.key)) groups.set(u.type.key, []); groups.get(u.type.key).push(u); }
    this.selEl.innerHTML = '';
    for (const [k, list] of groups) {
      const avg = list.reduce((s, u) => s + u.hp / u.maxHp, 0) / list.length;
      const d = document.createElement('div');
      d.innerHTML = this._unitBox(list[0], avg, list.length);
      const el = d.firstChild;
      el.title = list[0].name;
      el.onclick = () => g.select(list);
      this.selEl.appendChild(el);
    }
  }
  _unitBox(u, hp, cnt) {
    const col = hp > 0.6 ? '#46c46b' : hp > 0.3 ? '#e5b93e' : '#e5484d';
    return `<div class="sel-unit" title="${u.name}">${u.type.icon}${cnt > 1 ? `<span class="cnt">${cnt}</span>` : ''}<div class="hp"><i style="width:${Math.max(0, hp * 100)}%;background:${col}"></i></div></div>`;
  }

  // ---------- Fähigkeiten ----------
  refreshAbilities() {
    const g = this.game;
    this.abEl.innerHTML = '';
    g.abilities.forEach((a, i) => {
      const b = document.createElement('button');
      b.title = `${a.def.name} (F${i + 1})\n${a.def.desc}`;
      b.innerHTML = `<span class="key">F${i + 1}</span>${a.def.icon}<span>${a.def.name.split(/[ -]/)[0]}</span>${a.charges !== Infinity ? `<span class="charges">${a.charges}</span>` : ''}<div class="cd"></div>`;
      if (this.input?.pendingAbility === a) b.classList.add('active');
      b.onclick = () => this.input.startAbility(a);
      a.btn = b;
      this.abEl.appendChild(b);
    });
    this._updateAbilityState();
  }
  _updateAbilityState() {
    for (const a of this.game.abilities) {
      if (!a.btn) continue;
      const avail = this.game.abilityAvailable(a);
      a.btn.disabled = !avail && a.cd <= 0;
      const cd = a.btn.querySelector('.cd');
      cd.style.height = a.cd > 0 ? `${(a.cd / a.cooldown) * 100}%` : '0%';
      a.btn.style.opacity = avail ? 1 : 0.55;
    }
  }
  showTargetHint(text, onCancel) {
    const el = $('target-hint');
    el.textContent = text + (document.body.classList.contains('touch') ? ' – hier tippen zum Abbrechen' : ' – Rechtsklick/Esc bricht ab');
    el.classList.remove('hidden');
    el.onclick = onCancel;
  }
  hideTargetHint() { $('target-hint').classList.add('hidden'); }

  // ---------- Funk & Warnungen ----------
  queueSay(speaker, text, dur) { this.sayQueue.push({ speaker, text, dur }); if (this.sayT <= 0) this._nextSay(); }
  _nextSay() {
    const s = this.sayQueue.shift();
    if (!s) { this.subEl.classList.add('hidden'); this.sayT = 0; return; }
    this.subEl.innerHTML = `<b>${s.speaker}:</b> ${s.text}`;
    this.subEl.classList.remove('hidden');
    this.sayT = Math.max(2.5, s.dur) * (this.sayQueue.length > 2 ? 0.6 : 1);
  }
  showAlert(text, dur) { this.alertEl.textContent = text; this.alertEl.classList.remove('hidden'); this.alertT = dur; }

  // ---------- Minikarte ----------
  _minimapClick(e, drag = false) {
    const g = this.game;
    if (!g.active) return;
    const r = this.mm.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * g.terrain.size - g.terrain.half;
    const z = ((e.clientY - r.top) / r.height) * g.terrain.size - g.terrain.half;
    if (e.button === 2 && !drag) {
      const ids = g.selected.filter((u) => u.alive && g.isOwn(u)).map((u) => u.id);
      if (ids.length) g.issueCommand({ t: 'move', ids, x, z });
      return;
    }
    g.camera.focus(x, z);
  }
  drawMinimap() {
    const g = this.game, ctx = this.mmCtx, S = 180;
    if (!this.mmBg || !g.terrain) return;
    const T = g.terrain;
    const toM = (x, z) => [((x + T.half) / T.size) * S, ((z + T.half) / T.size) * S];
    ctx.drawImage(this.mmBg, 0, 0);
    if (g.fow.enabled) {
      const d = this.mmFogImg.data, sm = g.fow.smooth;
      for (let i = 0; i < 128 * 128; i++) { d[i * 4] = 5; d[i * 4 + 1] = 8; d[i * 4 + 2] = 12; d[i * 4 + 3] = (1 - sm[i]) * 200; }
      this.mmFogCtx.putImageData(this.mmFogImg, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.mmFog, 0, 0, S, S);
    }
    const ls = g.localSide;
    for (const u of g.units) {
      if (!u.alive || u.side === 'N') continue;
      if (u.side !== ls && !u.root.visible) continue;
      const [x, y] = toM(u.pos.x, u.pos.z);
      const s = u.type.structure ? 5 : u.type.vehicle || u.type.naval ? 3.5 : 2.5;
      // Eigene grün, Verbündete blau, Feinde rot
      ctx.fillStyle = g.isOwn(u) ? (g.selected.includes(u) ? '#ffffff' : '#5dff8a') : u.side === ls ? (g.selected.includes(u) ? '#d8ecff' : '#5db8ff') : '#ff4d4d';
      if (u.type.air) { ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s, y + s); ctx.lineTo(x - s, y + s); ctx.fill(); }
      else ctx.fillRect(x - s / 2, y - s / 2, s, s);
      if (u.tags.has('target') && u.side !== ls) { ctx.strokeStyle = '#ffd500'; ctx.lineWidth = 1.5; ctx.strokeRect(x - 5, y - 5, 10, 10); }
    }
    // Missionsmarker
    for (const m of g.mission?.markers || []) {
      if (m.hidden) continue;
      const [x, y] = toM(m.x, m.z);
      ctx.strokeStyle = m.color || '#ffd500'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, (m.r / T.size) * S, 0, Math.PI * 2); ctx.stroke();
    }
    // Warnungen (Kinschal)
    const blink = (performance.now() / 250) % 2 < 1;
    if (g.warnings && blink) for (const w of g.warnings) { const [x, y] = toM(w.x, w.z); ctx.strokeStyle = '#ff2020'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 7, 0, 6.29); ctx.stroke(); }
    // Flugkörper
    for (const m of g.missiles) {
      const hostile = m.side !== ls;
      if (!m.threat || !hostile && m.threat !== 'cruise') continue;
      const [x, y] = toM(m.pos.x, m.pos.z);
      ctx.fillStyle = hostile ? '#ff9040' : '#80c0ff';
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    if (this.attackPing && blink) { const [x, y] = toM(this.attackPing.x, this.attackPing.z); ctx.strokeStyle = '#ff4040'; ctx.lineWidth = 2; ctx.strokeRect(x - 6, y - 6, 12, 12); }
    // Kamera-Sichtbereich
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([nx, ny]) => g.groundPick(nx, ny * 0.95) || null);
    if (corners.every(Boolean)) {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1;
      ctx.beginPath();
      corners.forEach((p, i) => { const [x, y] = toM(p.x, p.z); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.closePath(); ctx.stroke();
    }
  }

  // ---------- Lebensbalken / Markierungen ----------
  _onScreen(u) { const v = u.aimPoint().project(this.game.gr.camera); return v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1; }
  drawOverlay() {
    const g = this.game, ctx = this.octx;
    const W = window.innerWidth, H = window.innerHeight;
    ctx.clearRect(0, 0, W, H);
    if (!g.active) return;
    const cam = g.gr.camera;
    const v = new THREE.Vector3();
    const zoomK = Math.max(0.6, Math.min(1.4, 70 / g.camera.dist));
    const ls = g.localSide;
    for (const u of g.units) {
      if (!u.alive || u.side === 'N' && u.hp >= u.maxHp) continue;
      if (u.side !== ls && u.side !== 'N' && !u.root.visible) continue;
      const sel = g.selected.includes(u);
      const target = u.tags.has('target') || u.tags.has('protect');
      if (!sel && u.hp >= u.maxHp && !target) continue;
      v.set(u.pos.x, u.pos.y + (u.model.height || 2) + 1.2, u.pos.z);
      v.project(cam);
      if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) continue;
      const x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H;
      const bw = (u.type.structure ? 46 : u.type.vehicle ? 30 : 18) * zoomK, bh = 4;
      const hp = Math.max(0, u.hp / u.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - bw / 2 - 1, y - 1, bw + 2, bh + 2);
      ctx.fillStyle = g.isOwn(u) ? (hp > 0.5 ? '#46c46b' : hp > 0.25 ? '#e5b93e' : '#e5484d') : u.side === ls ? (hp > 0.25 ? '#5db8ff' : '#e5484d') : u.side === 'N' ? '#aaa' : '#e5484d';
      ctx.fillRect(x - bw / 2, y, bw * hp, bh);
      if (target) {
        ctx.fillStyle = u.tags.has('protect') ? '#5db8ff' : '#ffd500';
        ctx.font = '600 11px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(u.tags.has('protect') ? '◆ SCHÜTZEN' : '◆ ZIEL', x, y - 4);
      }
      // Munition (Flugabwehr)
      if (sel && u.side === ls) {
        const w = u.weapons.find((w) => w.def.ammo);
        if (w) {
          ctx.fillStyle = '#9ec5ff'; ctx.font = '10px system-ui'; ctx.textAlign = 'center';
          ctx.fillText(w.ammo > 0 ? `${w.ammo}/${w.def.ammo}` : `Nachladen ${Math.ceil(w.reloadT)}s`, x, y + 15);
        }
        if (u.lifetime) { ctx.fillStyle = '#ffd500'; ctx.font = '10px system-ui'; ctx.textAlign = 'center'; ctx.fillText(`🔋${Math.ceil(u.lifetime)}s`, x, y + 15); }
      }
    }
    // Missionsmarker (Zonen) als Text
    for (const m of g.mission?.markers || []) {
      if (m.hidden || !m.label) continue;
      v.set(m.x, g.terrain.surface(m.x, m.z) + 6, m.z).project(cam);
      if (v.z > 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1) continue;
      const x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H;
      ctx.font = '700 12px system-ui'; ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(m.label, x + 1, y + 1);
      ctx.fillStyle = m.color || '#ffd500'; ctx.fillText(m.label, x, y);
    }
  }

  update(dt) {
    const g = this.game;
    if (!g.active) return;
    if (this.sayT > 0) { this.sayT -= dt; if (this.sayT <= 0) this._nextSay(); }
    if (this.alertT > 0) { this.alertT -= dt; if (this.alertT <= 0) this.alertEl.classList.add('hidden'); }
    if (this.attackPing) { this.attackPing.t -= dt; if (this.attackPing.t <= 0) this.attackPing = null; }
    this.mmT -= dt;
    if (this.mmT <= 0) { this.mmT = 0.15; this.drawMinimap(); this._updateAbilityState(); this._refreshSelHp(); }
    this.drawOverlay();
    this.timerEl.textContent = g.countdown ? `${g.countdown.label} ${fmtTime(g.countdown.t)}` : '';
    if (this.settings.showFps) {
      const gr = g.gr;
      this.fpsEl.textContent = `${Math.round(gr.fps)} FPS · ${gr.intW}×${gr.intH} → ${gr.outW}×${gr.outH} (${Math.round(gr.renderScale * 100)} %)`;
    } else this.fpsEl.textContent = '';
  }
  _refreshSelHp() {
    // Lebensbalken in Auswahl aktualisieren, ohne DOM komplett neu aufzubauen
    const sel = this.game.selected;
    if (sel.length === 1) {
      const u = sel[0];
      const bar = this.selEl.querySelector('.hp i');
      if (bar) { const hp = Math.max(0, u.hp / u.maxHp); bar.style.width = hp * 100 + '%'; }
    }
  }
  togglePause() { this.onTogglePause && this.onTogglePause(); }
}
