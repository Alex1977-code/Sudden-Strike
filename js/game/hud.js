// HUD: Ziele, Auswahl, Fähigkeiten, Minikarte, Lebensbalken, Funksprüche
import * as THREE from 'three';
import { fmtTime } from '../engine/util.js';
import { UNIT_TYPES } from './unitTypes.js';
import { buildKindsFor } from './logistics.js';
import { TAC } from './tactics.js';
import { icon, iconLabel, drawIcon, unitIconKey } from './icons.js';
import { HudExt } from './hudext.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor(game, settings) {
    this.game = game;
    this.settings = settings;
    this.el = $('hud');
    this.objEl = $('objectives');
    this.selEl = $('selection');
    this.abEl = $('abilities');
    this.buildEl = $('buildbar');
    this.buildSig = '';
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
    game.on('selection', () => { this.refreshSelection(); this.refreshBuildbar(); this.refreshGroups(); });
    game.on('groups', () => this.refreshGroups());
    game.on('kill', () => { this._groupsDirty = true; });
    this._initGroupBar();
    game.on('vehicleCaptured', () => this.refreshBuildbar());
    game.on('bailout', () => this.refreshBuildbar());
    game.on('abilities', () => this.refreshAbilities());
    game.on('say', (s, t, d) => this.queueSay(s, t, d));
    game.on('alert', (t, d) => this.showAlert(t, d));
    game.on('localPlayer', () => { this.refreshSelection(); this.refreshAbilities(); });
    game.on('players', () => { this.refreshSelection(); this.refreshAbilities(); });
    game.on('loaded', () => { this.refreshGroups(); this.refreshObjectives(); this.refreshSelection(); this.refreshAbilities(); this.sayQueue = []; this.subEl.classList.add('hidden'); this.alertEl.classList.add('hidden'); this.setupSkirmish(); });
    game.on('cpCaptured', () => { this.skDirty = true; });
    game.on('playerDefeated', () => { this.skDirty = true; });
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
    this.buildEl.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      const own = game.selected.filter((u) => u.alive && game.isOwn(u));
      const act = b.dataset.act;
      if (act === 'bailout') { const ids = own.filter((u) => game.logi.canBail(u)).map((u) => u.id); if (ids.length) game.issueCommand({ t: 'bailout', ids }); this.refreshBuildbar(true); }
      else if (act === 'ungarrison') { const ids = own.filter((u) => u.garrison).map((u) => u.id); if (ids.length) game.issueCommand({ t: 'ungarrison', ids }); this.refreshBuildbar(true); }
      else if (act === 'garrison' || act === 'binoculars') this.input.startBuild(act);
      else if (act === 'build') this.input.startBuild('build', b.dataset.kind);
      else if (act === 'clearmines' || act === 'demolish') this.input.startBuild(act);
      // Kampfmechaniken (V3-M1): Granate/Nebel per Zielwahl, Fahrzeug-Nebel sofort, Eingraben, Hinterhalt/Feuer frei
      else if (act === 'grenade') this.input.startBuild('grenade');
      else if (act === 'smoke') {
        const veh = own.filter((u) => u.type.vehicle && u.smokeN > 0);
        if (veh.length) game.issueCommand({ t: 'smoke', ids: veh.map((u) => u.id) });
        if (own.some((u) => u.type.infantry && u.smokeN > 0)) this.input.startBuild('smoke');
      } else if (act === 'dig') { const ids = own.filter((u) => u.type.infantry && !u.garrison).map((u) => u.id); if (ids.length) game.issueCommand({ t: 'dig', ids }); }
      else if (act === 'ambush' || act === 'firefree') {
        const ids = own.filter((u) => !u.type.structure && !u.type.air).map((u) => u.id);
        if (ids.length) game.issueCommand({ t: 'ambush', ids, value: act === 'ambush', range: TAC.ambush.range });
        this.refreshBuildbar(true); this.refreshSelection();
      } else this.ext?.onAct(act, own, b);
      game.audio.ui('click');
    });
    this.mm.addEventListener('pointerdown', (e) => this._minimapClick(e));
    this.mm.addEventListener('pointermove', (e) => { if (e.buttons & 1) this._minimapClick(e, true); });
    this.mm.addEventListener('contextmenu', (e) => e.preventDefault());
    $('sk-teams-btn')?.addEventListener('click', () => { $('sk-teams').classList.toggle('open'); this.skDirty = true; });
    this.ext = new HudExt(this); // V3-M2: Befehle & Welt (Haltungen, Rückzug, Formation, Auf-/Absitzen, Schleppen, Brücken, Minen)
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
      const bn = o.state === 'done' ? 'obj_done' : o.state === 'failed' ? 'obj_failed' : 'obj_open';
      const box = icon(bn, { label: iconLabel(bn) });
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
      const w = u.weapons.map((ws) => ws.def.name).join(', ') || 'unbewaffnet'; // MP-T7: Einheitenwaffen (Gefecht ggf. ergänzt)
      const side = g.isOwn(u) ? '' : u.side === g.localSide ? `<span style="color:#5db8ff">Verbündet${g.playerById(u.owner) ? ' (' + g.playerById(u.owner).name + ')' : ''}</span> · ` : u.abandoned ? '<span style="color:#ffd500">Verlassen</span> · ' : u.side === 'N' ? '<span class="muted">Neutral</span> · ' : '<span style="color:#ff6b6b">Feind</span> · ';
      this.selEl.innerHTML = `${this._unitBox(u, 1)}<div class="sel-detail"><b>${u.name}</b><br>${side}<span class="muted">${w}</span><br><span class="muted">${u.abandoned ? 'Verlassen – Infanterie kann das Fahrzeug übernehmen, Bergepanzer reparieren.' : (u.type.desc || '')}</span>${u.holdFire ? '<br><span style="color:#ffd500">Feuer halten</span>' : ''}<div class="logi"></div><div class="tac">${this.tacText(u)}</div><span class="hpnum"></span></div><div class="sel-mini"><b>${u.name}</b> <span class="logi-m">${this.logiShort(u)}</span></div>`;
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
      d.innerHTML = this._unitBox(list[0], avg, list.length, g.logistics && list[0].supply ? this._supplyFrac(list) : null);
      const el = d.firstChild;
      el.dataset.k = k;
      el.title = list[0].name;
      el.onclick = () => g.select(list);
      this.selEl.appendChild(el);
    }
  }
  _unitBox(u, hp, cnt, sup = null) {
    const col = hp > 0.6 ? '#46c46b' : hp > 0.3 ? '#e5b93e' : '#e5484d';
    if (sup === null && cnt === undefined && this.game.logistics && u.supply) sup = this._supplyFrac([u]);
    const supBar = sup !== null ? `<div class="sup" title="Lkw-Vorrat"><i style="width:${Math.max(0, sup * 100)}%"></i></div>` : '';
    const tc = SK_COL[u.side] || SK_COL.N;
    return `<div class="sel-unit" title="${u.name}" role="button" aria-label="${u.name}" style="--tc:${tc}">${icon(unitIconKey(u.type), { color: tc })}${cnt > 1 ? `<span class="cnt">${cnt}</span>` : ''}${supBar}<div class="hp"><i style="width:${Math.max(0, hp * 100)}%;background:${col}"></i></div></div>`;
  }

  // ---------- Fähigkeiten ----------
  refreshAbilities() {
    const g = this.game;
    this.abEl.innerHTML = '';
    g.abilities.forEach((a, i) => {
      const b = document.createElement('button');
      b.title = `${a.def.name} (F${i + 1})\n${a.def.desc}`;
      b.setAttribute('aria-label', a.def.name);
      b.innerHTML = `<span class="key">F${i + 1}</span>${icon(a.id)}<span>${a.def.name.split(/[ -]/)[0]}</span>${a.charges !== Infinity ? `<span class="charges">${a.charges}</span>` : ''}<div class="cd"></div>`;
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
    // Eroberungspunkte (Gefecht): Kreis in Besitzerfarbe, Bogen = Eroberungsfortschritt
    const sk = g.mission?.skirmish;
    if (sk) {
      for (const p of sk.points) {
        const [x, y] = toM(p.x, p.z);
        const r = Math.max(5, (p.radius / T.size) * S);
        ctx.fillStyle = (p.owner ? SK_COL[p.owner] : SK_COL.N) + '66';
        ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = p.owner ? SK_COL[p.owner] : '#c8ccd0';
        ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.stroke();
        if (p.capTeam && p.progress > 0) { ctx.strokeStyle = p.contested ? '#ffa030' : SK_COL[p.capTeam]; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r + 2.5, -Math.PI / 2, -Math.PI / 2 + p.progress * 6.2832); ctx.stroke(); }
        drawIcon(ctx, 'cp_' + p.kind, x, y, Math.max(9, r * 1.5), '#fff');
      }
    }
    for (const u of g.units) {
      if (!u.alive || u.side === 'N') continue;
      if (u.side !== ls && !u.root.visible) continue;
      const [x, y] = toM(u.pos.x, u.pos.z);
      const s = u.type.build ? 2 : u.type.structure ? 5 : u.type.vehicle || u.type.naval ? 3.5 : 2.5;
      // Eigene grün, Verbündete blau, Feinde rot
      ctx.fillStyle = g.isOwn(u) ? (g.selected.includes(u) ? '#ffffff' : '#5dff8a') : u.side === ls ? (g.selected.includes(u) ? '#d8ecff' : '#5db8ff') : '#ff4d4d';
      if (u.type.air) { ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s, y + s); ctx.lineTo(x - s, y + s); ctx.fill(); }
      else ctx.fillRect(x - s / 2, y - s / 2, s, s);
      if (u.tags.has('target') && u.side !== ls) { ctx.strokeStyle = '#ffd500'; ctx.lineWidth = 1.5; ctx.strokeRect(x - 5, y - 5, 10, 10); }
    }
    // Verlassene Fahrzeuge (neutral)
    for (const u of g.units) {
      if (!u.alive || !u.abandoned) continue;
      const [x, y] = toM(u.pos.x, u.pos.z);
      ctx.strokeStyle = '#ffd500'; ctx.lineWidth = 1.5; ctx.strokeRect(x - 3, y - 3, 6, 6);
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
      if (!u.alive) continue;
      if (u.side === 'N' && u.occupants?.length && u.garrisonSide === ls && u.occupants.some((o) => o.ambush?.on && o.side === ls)) this._ambushHouseLabel(u, v, cam, W, H);
      if (u.side === 'N' && u.hp >= u.maxHp && !u.abandoned) continue;
      if (u.side !== ls && u.side !== 'N' && !u.root.visible) continue;
      const sel = g.selected.includes(u);
      const target = u.tags.has('target') || u.tags.has('protect');
      const building = u.build && u.build.progress < 1;
      // Kampfzustand (V3-M1): Winkel (Veteranen), Niederhalten/Panik, Hinterhalt, Brand/Kette auch ohne Auswahl anzeigen
      const tacMark = !u.type.structure && (u.vet > 0 || u.supp >= TAC.supp.crouch || u.panicT > 0 || u.burnT > 0 || u.mods?.eng === 2 || (u.ambush?.on && u.side === ls));
      const plain = !sel && u.hp >= u.maxHp && !target && !u.abandoned && !building;
      if (plain && !tacMark) continue;
      if (u.type.build && !sel && !building) continue;
      v.set(u.pos.x, u.pos.y + (u.model.height || 2) + 1.2, u.pos.z);
      v.project(cam);
      if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) continue;
      const x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H;
      const bw = (u.type.structure ? 46 : u.type.vehicle ? 30 : 18) * zoomK, bh = 4;
      const hp = Math.max(0, u.hp / u.maxHp);
      if (tacMark || (sel && (u.supp > 0 || u.vet))) this._tacMarks(u, x, y, bw, sel, ls);
      if (plain) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - bw / 2 - 1, y - 1, bw + 2, bh + 2);
      ctx.fillStyle = g.isOwn(u) ? (hp > 0.5 ? '#46c46b' : hp > 0.25 ? '#e5b93e' : '#e5484d') : u.side === ls ? (hp > 0.25 ? '#5db8ff' : '#e5484d') : u.side === 'N' ? '#aaa' : '#e5484d';
      ctx.fillRect(x - bw / 2, y, bw * hp, bh);
      if (target) {
        ctx.fillStyle = u.tags.has('protect') ? '#5db8ff' : '#ffd500';
        ctx.font = '600 11px system-ui';
        ctx.textAlign = 'center';
        drawIcon(ctx, u.tags.has('protect') ? 'obj_protect' : 'obj_target', x - 26, y - 9, 11, ctx.fillStyle);
        ctx.textAlign = 'left'; ctx.fillText(u.tags.has('protect') ? 'SCHÜTZEN' : 'ZIEL', x - 19, y - 4); ctx.textAlign = 'center';
      }
      if (u.abandoned) { ctx.fillStyle = '#ffd500'; ctx.font = '700 10px system-ui'; ctx.textAlign = 'left'; drawIcon(ctx, 'flag', x - 26, y - 9, 11, '#ffd500'); ctx.fillText('verlassen', x - 19, y - 4); ctx.textAlign = 'center'; }
      if (building) { ctx.fillStyle = '#5dff8a'; ctx.font = '700 10px system-ui'; ctx.textAlign = 'left'; drawIcon(ctx, 'repair', x - 19, y - 9, 11, '#5dff8a'); ctx.fillText(`${Math.round(u.build.progress * 100)} %`, x - 12, y - 4); ctx.textAlign = 'center'; }
      // Logistik: Munitions-/Treibstoffbalken, Vorrat (Lkw), Baumaterial
      let yy = y + bh + 3;
      if (sel && g.logistics && u.side === ls) {
        const bar = (frac, col) => { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - bw / 2 - 1, yy - 1, bw + 2, 5); ctx.fillStyle = col; ctx.fillRect(x - bw / 2, yy, bw * Math.max(0, Math.min(1, frac)), 3); yy += 6; };
        const am = u.ammoInfo();
        if (am) bar(am.cur / am.max, am.cur < 1 ? '#ff5a5a' : '#6fb7ff');
        if (u.maxFuel) bar(u.fuel / u.maxFuel, u.fuel <= 0 ? '#ff5a5a' : '#ffb347');
        if (u.supply) { bar(u.supply.ammo / u.type.supply.ammo, '#6fb7ff'); bar(u.supply.fuel / u.type.supply.fuel, '#ffb347'); }
        ctx.font = '10px system-ui'; ctx.textAlign = 'center';
        if (u.maxMaterial || u.supply) { ctx.fillStyle = '#ffd500'; drawIcon(ctx, 'material', x - 8, yy + 4, 10, '#ffd500'); ctx.textAlign = 'left'; ctx.fillText(`${Math.floor((u.maxMaterial ? u.material : u.supply.material) + 1e-6)}`, x - 1, yy + 8); ctx.textAlign = 'center'; yy += 11; }
        if (u.immobilized) { ctx.fillStyle = '#ff8a8a'; ctx.fillText('Kette zerstört', x, yy + 8); yy += 11; }
        else if (u.maxFuel && u.fuel <= 0) { ctx.fillStyle = '#ff8a8a'; ctx.fillText('Tank leer', x, yy + 8); yy += 11; }
        else if (am && am.cur < 1) { ctx.fillStyle = '#ff8a8a'; ctx.fillText('Munition leer', x, yy + 8); yy += 11; }
      }
      // Munition (Flugabwehr)
      if (sel && u.side === ls) {
        const w = u.weapons.find((w) => w.def.ammo);
        if (w) {
          ctx.fillStyle = '#9ec5ff'; ctx.font = '10px system-ui'; ctx.textAlign = 'center';
          ctx.fillText(w.ammo > 0 ? `${w.ammo}/${w.def.ammo}` : `Nachladen ${Math.ceil(w.reloadT)}s`, x, yy + 9);
        }
        if (u.lifetime) { ctx.fillStyle = '#ffd500'; ctx.font = '10px system-ui'; ctx.textAlign = 'center'; drawIcon(ctx, 'battery', x - 10, yy + 5, 10, '#ffd500'); ctx.textAlign = 'left'; ctx.fillText(`${Math.ceil(u.lifetime)}s`, x - 3, yy + 9); ctx.textAlign = 'center'; }
      }
    }
    this.ext?.drawOverlay(ctx, W, H, cam, v); // V3-M2: Insassen, Brückenbau, Minen aufnehmen
    // Eroberungspunkte: Name + Fortschritt über dem Punkt
    const skp = g.mission?.skirmish;
    if (skp) {
      for (const p of skp.points) {
        v.set(p.x, g.terrain.surface(p.x, p.z) + 11, p.z).project(cam);
        if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) continue;
        const x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H;
        const col = p.owner ? SK_COL[p.owner] : '#c8ccd0';
        ctx.font = '700 12px system-ui'; ctx.textAlign = 'center';
        const label = `${p.name}${p.contested ? ' (umkämpft)' : ''}`;
        ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillText(label, x + 1, y + 1);
        ctx.fillStyle = col; ctx.fillText(label, x, y);
        if (p.capTeam && p.progress > 0) {
          const bw = 64;
          ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - bw / 2 - 1, y + 4, bw + 2, 6);
          ctx.fillStyle = p.contested ? '#ffa030' : SK_COL[p.capTeam]; ctx.fillRect(x - bw / 2, y + 5, bw * Math.min(1, p.progress), 4);
        }
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

  // Winkel-Abzeichen (Veteranen), Niederhalten-Balken, Panik/Hinterhalt/Brand-Hinweise über einer Einheit
  _tacMarks(u, x, y, bw, sel, ls) {
    const ctx = this.octx;
    if (u.vet > 0) { // goldene Winkel links neben dem Balken
      ctx.strokeStyle = '#ffd500'; ctx.lineWidth = 1.6;
      for (let i = 0; i < u.vet; i++) {
        const cx = x - bw / 2 - 7, cy = y + 4 - i * 3.6;
        ctx.beginPath(); ctx.moveTo(cx - 3.5, cy); ctx.lineTo(cx, cy - 3); ctx.lineTo(cx + 3.5, cy); ctx.stroke();
      }
    }
    if (u.type.infantry && u.supp > 1) {
      const f = Math.min(1, u.supp / 100);
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x - bw / 2 - 1, y + 5, bw + 2, 4);
      ctx.fillStyle = u.supp >= TAC.supp.pinned ? '#ff6a3a' : u.supp >= TAC.supp.crouch ? '#ffb347' : '#e8e0a0';
      ctx.fillRect(x - bw / 2, y + 6, bw * f, 2);
    }
    let txt = null, col = '#fff';
    if (u.panicT > 0) { txt = 'PANIK'; col = '#ff5a5a'; }
    else if (u.burnT > 0 || u.mods?.eng === 2) { txt = 'BRAND'; col = '#ff8a3a'; }
    else if (u.ambush?.on && u.side === ls) { txt = 'HINTERHALT'; col = '#c8a2ff'; }
    else if (sel && u.supp >= TAC.supp.pinned) { txt = 'NIEDER'; col = '#ff8a5a'; }
    else if (sel && u.immobilized) { txt = 'KETTE'; col = '#ff8a8a'; }
    if (txt) {
      ctx.font = '700 9px system-ui'; ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(txt, x + 1, y - 3);
      ctx.fillStyle = col; ctx.fillText(txt, x, y - 4);
    }
  }
  _ambushHouseLabel(h, v, cam, W, H) {
    v.set(h.pos.x, (h.roofY || h.pos.y + 4) + 2.5, h.pos.z).project(cam);
    if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) return;
    const ctx = this.octx, x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H;
    ctx.font = '700 10px system-ui'; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText('HINTERHALT', x + 1, y + 1);
    ctx.fillStyle = '#c8a2ff'; ctx.fillText('HINTERHALT', x, y);
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
    if (g.mission?.skirmish) this.updateSkirmish(dt);
    if (this.settings.showFps) {
      const gr = g.gr;
      this.fpsEl.textContent = `${Math.round(gr.fps)} FPS · ${gr.intW}×${gr.intH} → ${gr.outW}×${gr.outH} (${Math.round(gr.renderScale * 100)} %)`;
    } else this.fpsEl.textContent = '';
  }
  // ---------- Schnellwahlgruppen ----------
  _initGroupBar() {
    const el = document.getElementById('groups');
    if (!el) return;
    this.groupsEl = el;
    let press = null;
    const slotOf = (t) => t.closest && t.closest('[data-group]');
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('pointerdown', (e) => {
      const b = slotOf(e.target); if (!b) return;
      const k = b.dataset.group;
      press = { k, t: performance.now(), long: false, button: e.button, x: e.clientX, y: e.clientY };
      clearTimeout(this._grpTimer);
      // Gedrückt halten (Touch oder Maus): aktuelle Auswahl in diese Gruppe speichern / leere Auswahl löst Gruppe auf
      if (k !== '+') this._grpTimer = setTimeout(() => { if (press && press.k === k) { press.long = true; this.input.storeGroup(k); if (navigator.vibrate) navigator.vibrate(25); } }, 550);
    });
    el.addEventListener('pointerup', (e) => {
      clearTimeout(this._grpTimer);
      const b = slotOf(e.target); const p = press; press = null;
      if (!b || !p || p.long || b.dataset.group !== p.k) return;
      const k = p.k;
      if (k === '+') { this.input.storeNextFreeGroup(); return; }
      if (p.button === 2 || e.ctrlKey || e.metaKey) { this.input.storeGroup(k, { add: e.shiftKey }); return; }
      this.input.selectGroup(k, { add: e.shiftKey });
    });
    el.addEventListener('pointerleave', () => { clearTimeout(this._grpTimer); press = null; });
  }
  refreshGroups() {
    const el = this.groupsEl; const g = this.game; const inp = this.input;
    if (!el || !inp || !g.active) { if (el) el.innerHTML = ''; return; }
    this._groupsDirty = false;
    const own = inp.ownSelected ? inp.ownSelected() : [];
    let html = '';
    for (let i = 1; i <= 9; i++) {
      const k = String(i);
      const list = inp.groupUnits(k);
      if (!list.length) continue;
      // häufigster Typ als Symbol
      const cnt = new Map(); for (const u of list) cnt.set(u.type, (cnt.get(u.type) || 0) + 1);
      const main = [...cnt.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const hp = list.reduce((s, u) => s + u.hp / u.maxHp, 0) / list.length;
      const col = hp > 0.6 ? 'var(--green)' : hp > 0.3 ? '#e5b93e' : 'var(--red)';
      const active = own.length && list.length === own.length && list.every((u) => own.includes(u));
      html += `<button class="grp${active ? ' active' : ''}" data-group="${k}" title="Gruppe ${k}: ${list.length} Einheit(en) – Klick wählen, Doppelklick Kamera, Strg+Klick/gedrückt halten überschreiben, Umschalt+Klick hinzufügen">`
        + `<b class="gk">${k}</b>${icon(unitIconKey(main))}<span class="gc">${list.length}</span><i class="gh" style="width:${Math.round(hp * 100)}%;background:${col}"></i></button>`;
    }
    if (own.length) html += `<button class="grp add" data-group="+" title="Auswahl als neue Gruppe speichern (Strg+1…9)">${icon('team')}<span class="gc">+</span></button>`;
    if (html === this._lastGroupsHtml) return; // nur bei Änderung neu aufbauen (stabile Knöpfe für Klick/Halten)
    this._lastGroupsHtml = html;
    el.innerHTML = html;
    el.classList.toggle('hidden', !html);
  }
  _refreshSelHp() {
    if (this._groupsDirty || (this._grpT = (this._grpT || 0) + 1) % 4 === 0) this.refreshGroups();
    // Lebensbalken in Auswahl aktualisieren, ohne DOM komplett neu aufzubauen
    const sel = this.game.selected;
    if (sel.length === 1) {
      const u = sel[0];
      const bar = this.selEl.querySelector('.hp i');
      if (bar) { const hp = Math.max(0, u.hp / u.maxHp); bar.style.width = hp * 100 + '%'; }
      const lg = this.selEl.querySelector('.logi');
      if (lg) lg.innerHTML = this.logiText(u);
      const lm = this.selEl.querySelector('.logi-m');
      if (lm) lm.innerHTML = this.logiShort(u);
      const tc = this.selEl.querySelector('.tac');
      if (tc) { const h = this.tacText(u); if (tc._h !== h) { tc._h = h; tc.innerHTML = h; } }
      const sb = this.selEl.querySelector('.sup i');
      if (sb && u.supply) sb.style.width = this._supplyFrac([u]) * 100 + '%';
    } else if (sel.length > 1) {
      // Gruppen: Vorratsbalken der Versorgungs-Lkw aktualisieren
      for (const el of this.selEl.querySelectorAll('.sel-unit[data-k]')) {
        const list = sel.filter((u) => u.alive && u.type.key === el.dataset.k);
        const i = el.querySelector('.sup i'); if (i && list.length) i.style.width = this._supplyFrac(list) * 100 + '%';
      }
    }
    this.refreshBuildbar();
  }
  // Logistik-Zustand einer Einheit als Text (Auswahl-Detail)
  logiText(u) {
    if (!this.game.logistics) return '';
    const parts = [];
    const am = u.ammoInfo();
    if (am) parts.push(`Munition ${Math.floor(am.cur)}/${am.max}`);
    if (u.maxFuel) parts.push(`Treibstoff ${Math.round(u.fuel / u.maxFuel * 100)} %`);
    if (u.maxMaterial) parts.push(`Material ${Math.floor(u.material + 1e-6)}/${u.maxMaterial}`);
    if (u.supply) parts.push(`Vorrat: Mun ${Math.round(u.supply.ammo / u.type.supply.ammo * 100)} % · Sprit ${Math.round(u.supply.fuel / u.type.supply.fuel * 100)} % · Mat ${Math.floor(u.supply.material)}`);
    if (u.immobilized) parts.push('<span style="color:#ff8a8a">Kette zerstört</span>');
    else if (u.maxFuel && u.fuel <= 0) parts.push('<span style="color:#ff8a8a">Tank leer</span>');
    if (u.build && u.build.progress < 1) parts.push(`Bau ${Math.round(u.build.progress * 100)} %`);
    return parts.join(' · ');
  }
  // Kampfzustand (V3-M1): Moral/Niederhalten, Veteranenstufe, Offiziersaura, Hinterhalt, Fahrzeugmodule
  tacText(u) {
    const g = this.game, p = [];
    if (!u || u.type.structure) return '';
    const own = u.side === g.localSide;
    if (u.vet) p.push(`<span style="color:#ffd500" title="Veteranenstufe">${'▲'.repeat(u.vet)} ${TAC.vet.names[u.vet]}</span>`);
    if (u.type.infantry) {
      if (u.panicT > 0) p.push('<span style="color:#ff5a5a">PANIK – Rückzug</span>');
      else if (u.supp >= TAC.supp.pinned) p.push(`<span style="color:#ff8a5a">Niedergehalten (${Math.round(u.supp)} %)</span>`);
      else if (u.supp >= TAC.supp.crouch) p.push(`<span style="color:#ffb347">Unter Feuer (${Math.round(u.supp)} %)</span>`);
      if (u.hp < u.maxHp * TAC.wounded) p.push('<span style="color:#ff8a8a">Schwer verwundet</span>');
      if (own && u.ledT > g.time && !u.type.officer) p.push('<span style="color:#9ec5ff">Offizier in der Nähe</span>');
      if (u.type.officer) p.push(`<span style="color:#9ec5ff">Führungsaura ${TAC.officer.radius} m</span>`);
    }
    if (own && u.ambush?.on) p.push(`<span style="color:#c8a2ff">Hinterhalt ${u.ambush.range} m</span>`);
    if (own && u.smokeMax) p.push(`<span class="muted">Nebel ${u.smokeN}/${u.smokeMax}</span>`);
    if (this.ext) { const x = this.ext.tacText(u, own); if (x) p.push(x); }
    const m = u.mods;
    if (m) {
      if (u.immobilized && !g.logistics) p.push('<span style="color:#ff8a8a">Kette/Räder zerstört</span>'); // Gefecht: steht in der Logistikzeile
      if (m.eng === 2) p.push('<span style="color:#ff5a5a">Motor brennt</span>'); else if (m.eng) p.push('<span style="color:#ffb347">Motor beschädigt</span>');
      if (m.tur) p.push('<span style="color:#ffb347">Turm klemmt</span>');
      if (m.gun) p.push('<span style="color:#ff8a8a">Hauptwaffe zerstört</span>');
      if (m.crw) p.push(`<span style="color:#ffb347">Besatzung verwundet ${m.crw}/3</span>`);
    }
    return p.join(' · ');
  }
  // Kompakte Logistikzeile für die Handy-Auswahl (MP-T7): Munition, Treibstoff, Material, Lkw-Vorrat
  logiShort(u) {
    if (u.side !== this.game.localSide) return '';
    if (!this.game.logistics) return this._tacShort(u);
    const p = [];
    const am = u.ammoInfo();
    if (am) p.push(`<span title="Munition">${icon('ammo', { cls: 'ic-in' })}${Math.floor(am.cur)}/${am.max}</span>`);
    if (u.maxFuel) p.push(`<span title="Treibstoff">${icon('fuel', { cls: 'ic-in' })}${Math.round(u.fuel / u.maxFuel * 100)}%</span>`);
    if (u.maxMaterial) p.push(`<span title="Material">${icon('material', { cls: 'ic-in' })}${Math.floor(u.material + 1e-6)}/${u.maxMaterial}</span>`);
    if (u.supply) p.push(`<span class="sup-txt" title="Lkw-Vorrat Munition · Treibstoff · Material">${icon('supply', { cls: 'ic-in' })} M${Math.round(u.supply.ammo / u.type.supply.ammo * 100)}% S${Math.round(u.supply.fuel / u.type.supply.fuel * 100)}% B${Math.floor(u.supply.material)}</span>`);
    if (u.immobilized) p.push('<span style="color:#ff8a8a">Kette!</span>');
    else if (u.maxFuel && u.fuel <= 0) p.push('<span style="color:#ff8a8a">Tank leer</span>');
    if (u.mods?.eng === 2) p.push('<span style="color:#ff5a5a">Brand!</span>');
    if (u.panicT > 0) p.push('<span style="color:#ff5a5a">Panik</span>'); else if (u.supp >= TAC.supp.pinned) p.push('<span style="color:#ff8a5a">Nieder</span>');
    if (u.vet) p.push(`<span style="color:#ffd500">${'▲'.repeat(u.vet)}</span>`);
    if (u.ambush?.on) p.push('<span style="color:#c8a2ff">Hinterhalt</span>');
    return p.join(' ');
  }
  _tacShort(u) {
    const p = [];
    if (u.immobilized) p.push('<span style="color:#ff8a8a">Kette!</span>');
    if (u.mods?.eng === 2) p.push('<span style="color:#ff5a5a">Brand!</span>');
    if (u.panicT > 0) p.push('<span style="color:#ff5a5a">Panik</span>'); else if (u.supp >= TAC.supp.pinned) p.push('<span style="color:#ff8a5a">Nieder</span>');
    if (u.vet) p.push(`<span style="color:#ffd500">${'▲'.repeat(u.vet)}</span>`);
    if (u.ambush?.on) p.push('<span style="color:#c8a2ff">Hinterhalt</span>');
    return p.join(' ');
  }
  _supplyFrac(list) { return list.reduce((s, u) => s + (u.supply ? (u.supply.ammo / u.type.supply.ammo + u.supply.fuel / u.type.supply.fuel) / 2 : 0), 0) / list.length; }
  // Befehlsleiste für Pioniere (Bauen, Minen räumen, Sprengen) und Fahrzeuge (Aussteigen)
  refreshBuildbar(force = false) {
    const g = this.game, el = this.buildEl;
    if (!el) return;
    const own = g.selected.filter((u) => u.alive && g.isOwn(u));
    const eng = g.logistics ? own.filter((u) => u.type.engineer) : [];
    const bail = g.logistics ? own.filter((u) => g.logi.canBail(u)) : [];
    const mat = eng.reduce((n, u) => n + u.material, 0);
    const pend = this.input?.pendingBuild;
    const tmode = pend && (pend.mode === 'grenade' || pend.mode === 'smoke');
    if (pend && !eng.length && pend.mode !== 'binoculars' && pend.mode !== 'garrison' && !tmode && !pend.ext) { this.input.cancelBuild(); return; }
    const inf = g.logistics ? own.filter((u) => u.type.infantry && !u.type.kamikaze) : [];
    const gar = own.filter((u) => u.garrison);
    const obs = own.filter((u) => u.bino);
    // Kampfmechaniken (V3-M1): Granate, Nebel, Eingraben, Hinterhalt – in allen Spielmodi
    const tinf = own.filter((u) => u.type.infantry && !u.type.kamikaze);
    const gren = tinf.filter((u) => u.weapons.some((w) => w.def.kind === 'grenade' && w.stock >= 1 && w.ammo > 0)).length;
    const smk = own.filter((u) => u.smokeN > 0).length;
    const digg = tinf.filter((u) => !u.garrison).length;
    const ambOn = own.filter((u) => u.ambush?.on).length;
    const kinds = eng.length ? [...new Set(eng.flatMap((u) => buildKindsFor(u.type)))] : [];
    const extSig = this.ext ? this.ext.sig(own) : '';
    const sig = `${inf.length ? 1 : 0}|${gar.length}|${obs.length}|${eng.length}|${bail.length}|${Math.floor(mat + 1e-6)}|${pend ? pend.mode + (pend.kind || '') : ''}|${tinf.length}|${gren}|${smk}|${digg}|${ambOn}|${kinds.join(',')}|${extSig}`;
    if (!force && sig === this.buildSig) return;
    this.buildSig = sig;
    if (!eng.length && !bail.length && !inf.length && !gar.length && !obs.length && !tinf.length && !smk && !(this.ext && own.length)) { el.classList.add('hidden'); el.innerHTML = ''; return; }
    const btn = (act, kind, ic, label, dis, active) => `<button data-act="${act}"${kind ? ` data-kind="${kind}"` : ''}${dis ? ' disabled' : ''}${active ? ' class="active"' : ''} title="${label}" aria-label="${label}">${icon(ic)}<span>${label}</span></button>`;
    let h = '';
    if (eng.length) {
      h += `<div class="mat" title="Baumaterial-Ladungen der gewählten Pioniere (Nachschub am Versorgungs-Lkw)">${icon('material', { cls: 'ic-in' })} ${Math.floor(mat + 1e-6)}/${eng.reduce((n, u) => n + u.maxMaterial, 0)}</div>`;
      for (const k of kinds) {
        const d = UNIT_TYPES[k];
        h += btn('build', k, unitIconKey(d), `${d.name.replace('Schützengraben', 'Graben').replace('Sandsackwall', 'Sandsäcke').replace('Panzersperre', 'Sperre')} ${d.build.cost}`, mat + 1e-6 < d.build.cost, pend?.mode === 'build' && pend.kind === k);
      }
      h += btn('clearmines', '', 'clearmines', 'Räumen', false, pend?.mode === 'clearmines');
      h += btn('demolish', '', 'demolish', 'Sprengen 2', mat + 1e-6 < 2, pend?.mode === 'demolish');
    }
    if (obs.length) h += btn('binoculars', '', 'binoculars', 'Fernglas', false, pend?.mode === 'binoculars');
    if (inf.length) h += btn('garrison', '', 'garrison', 'Besetzen', false, pend?.mode === 'garrison');
    if (gar.length) h += btn('ungarrison', '', 'ungarrison', 'Verlassen', false, false);
    if (bail.length) h += btn('bailout', '', 'bailout', 'Aussteigen', false, false);
    if (gren) h += btn('grenade', '', 'grenade', 'Granate', false, pend?.mode === 'grenade');
    if (smk) h += btn('smoke', '', 'smoke', 'Nebel', false, pend?.mode === 'smoke');
    if (digg) h += btn('dig', '', 'dig', 'Eingraben', false, false);
    if (tinf.length || gar.length) h += ambOn ? btn('firefree', '', 'firefree', 'Feuer frei', false, true) : btn('ambush', '', 'ambush', 'Hinterhalt', false, false);
    if (this.ext) h += this.ext.buttons(own, pend, btn, eng);
    if (!h) { el.classList.add('hidden'); el.innerHTML = ''; return; }
    el.innerHTML = h;
    el.classList.remove('hidden');
  }
  togglePause() { this.onTogglePause && this.onTogglePause(); }

  // ---------- Gefechtsmodus: Punkteleiste, Verstärkungs-Countdown, Punktestand, Team-/Spielerliste ----------
  setupSkirmish() {
    const sk = this.game.mission?.skirmish;
    const bar = $('skbar'), teams = $('sk-teams');
    this.el.classList.toggle('skirmish', !!sk);
    if (!bar) return;
    bar.classList.toggle('hidden', !sk); teams.classList.toggle('hidden', !sk);
    this.lastBeep = null;
    if (!sk) return;
    if (window.innerWidth > 900 && window.innerHeight > 560) teams.classList.add('open'); else teams.classList.remove('open');
    $('sk-cps').innerHTML = sk.points.map((p) => `<div class="cp" data-id="${p.id}" title="${p.name}"><i class="ring"></i><b>${icon('cp_' + p.kind, { label: p.name })}</b></div>`).join('');
    this.skCpEls = [...$('sk-cps').children];
    this.skCpEls.forEach((el, i) => { el.onclick = () => { const p = sk.points[i]; this.game.camera.focus(p.x, p.z); }; });
    this.skDirty = true; this.skT = 0;
  }
  updateSkirmish(dt) {
    const g = this.game, sk = g.mission.skirmish;
    // Countdown jedes Frame (Ton bei 30 s und in den letzten 10 s)
    const T = Math.max(0, sk.reinfT);
    const sec = Math.ceil(T);
    const rEl = $('sk-reinf');
    rEl.textContent = `Verstärkung in ${fmtTime(T)}`;
    rEl.classList.toggle('urgent', T <= 30);
    if (this.lastBeep !== sec && !g.paused) {
      if (this.lastBeep !== null && (sec === 30 || (sec <= 10 && sec >= 1))) this._beep(sec <= 3 ? 1320 : sec === 30 ? 660 : 990);
      this.lastBeep = sec;
    }
    this.skT -= dt;
    if (this.skT > 0 && !this.skDirty) return;
    this.skT = 0.2; this.skDirty = false;
    sk.points.forEach((p, i) => {
      const el = this.skCpEls[i]; if (!el) return;
      const col = p.owner ? SK_COL[p.owner] : SK_COL.N;
      el.style.background = col;
      el.style.borderColor = p.owner === 'UA' ? '#ffd500' : p.owner === 'RU' ? '#ffb0b0' : '#c8ccd0';
      el.classList.toggle('contested', p.contested);
      el.classList.toggle('big', p.kind === 'zeppelin');
      const ring = el.firstChild;
      if (p.capTeam && p.progress > 0) ring.style.background = `conic-gradient(${p.contested ? '#ffa030' : SK_COL[p.capTeam]} ${Math.round(p.progress * 360)}deg, transparent 0)`;
      else ring.style.background = 'none';
      el.title = `${p.name} – ${p.owner ? (p.owner === 'UA' ? 'Ukraine' : 'Russland') : 'neutral'}${p.contested ? ' (umkämpft)' : ''}`;
    });
    const ls = g.localSide, os = ls === 'UA' ? 'RU' : 'UA';
    let extra = '';
    if (sk.pointsLimit) extra = `<span class="lim">Ziel ${sk.pointsLimit}</span>`;
    else if (sk.timeLimit) extra = `<span class="lim">${icon('clock', { cls: 'ic-in' })} ${fmtTime(Math.max(0, sk.timeLimit - g.time))}</span>`;
    $('sk-score').innerHTML = `<span style="color:${SK_COL[ls]}">${ls} ${sk.scores[ls]}</span> : <span style="color:${SK_COL[os]}">${sk.scores[os]} ${os}</span>${extra}`;
    const tl = $('sk-teams');
    if (!tl.classList.contains('open')) return;
    const rows = [];
    for (const team of [ls, os]) {
      const held = sk.points.filter((p) => p.owner === team).length;
      rows.push(`<div class="tl-head" style="color:${SK_COL[team]}">${team === 'UA' ? 'Ukraine' : 'Russland'} · ${held} Punkt(e) · ${sk.scores[team]}</div>`);
      for (const p of g.playersOfTeam(team)) {
        let n = 0; for (const u of g.units) if (u.alive && u.owner === p.id && !u.type.structure && !u.type.kamikaze) n++;
        if (p.netUnits !== undefined) n = p.netUnits; // Online-Client: Zahl vom Host (Feinde sind nicht alle bekannt)
        if (team !== ls || n < 0) n = '–'; // MP-T6: keine Feindstärke anzeigen (Nebel des Krieges)
        const st = p.defeated ? ' defeated' : p.waiting && team === ls ? ' waiting' : '';
        rows.push(`<div class="tl-row${p.id === g.localPlayerId ? ' me' : ''}${st}"><i style="background:${p.color}"></i><span class="nm">${SK_ROLE[p.role] ? icon(SK_ROLE[p.role], { cls: 'ic-in' }) : ''} ${p.name}</span><span class="n">${n}</span><span class="kl">${p.stats.kills}/${p.stats.lost}</span></div>`);
      }
    }
    $('sk-teamlist').innerHTML = rows.join('');
  }
  _beep(f) { const a = this.game.audio; if (!a.ctx) return; if (typeof a._tone === 'function') a._tone({ freq: f, dur: 0.12, type: 'square', gain: 0.06 }); else a.ui?.('click'); } // neues Audio ohne _tone
}
const SK_COL = { UA: '#2f7de1', RU: '#e5484d', N: '#8c9096' };
const SK_ROLE = { armor: 'role_armor', infantry: 'role_infantry', support: 'role_support', logistics: 'role_logistics' };
