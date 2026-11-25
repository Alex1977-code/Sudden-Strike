// Sichtlinien-Werkzeug (V3-X): Alt halten (PC), Knopf „Sicht“ in der Befehlsleiste (Umschalter, Handy/Gamepad).
// Zeigt für die gewählte eigene Einheit die Sichtlinie zum Cursor (Handy/ohne Maus: Bildschirmmitte, Fadenkreuz):
//   grün = frei · gelb = teilweise (durch Wald/Vegetation, oder Sperre durch Wald/Rauch) · rot = blockiert (Gelände/Gebäude)
// dazu Sichtweite (Ring), größte Waffenreichweite (gestrichelt) und den Sichtbereich-Fächer (Sektoren wie der Nebel).
// Nutzt ausschließlich die vorhandene Sichtlogik: game.vision.los/eyeY (Grund der Sperre: vision.lastBlock/lastForest),
// game.sightOf und game._observerSectors – keine eigene Sichtberechnung.
import * as THREE from 'three';

const COL = { clear: '#46d36b', partial: '#f0c23a', blocked: '#ff4d4d', dim: 'rgba(255,255,255,0.45)' };
const LABEL = { clear: 'Sicht frei', partial: 'Teilweise verdeckt', blocked: 'Sicht blockiert' };
const REASON = { terrain: 'Gelände', house: 'Gebäude', forest: 'Wald', smoke: 'Rauch' };

export class LosTool {
  constructor(game, hud, input) {
    this.g = game; this.hud = hud; this.input = input;
    this.held = false; this.sticky = false; this.last = null;
    this._v = new THREE.Vector3();
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'Alt' || !game.active || game.demo) return;
      e.preventDefault(); // Browser-Menüleiste (Alt) nicht fokussieren
      this.held = true;
    });
    window.addEventListener('keyup', (e) => { if (e.key === 'Alt') { e.preventDefault(); this.held = false; } });
    window.addEventListener('blur', () => { this.held = false; });
    game.on('loaded', () => { this.sticky = false; this._syncBtn(); });
    const btn = document.getElementById('btn-los');
    if (btn) btn.addEventListener('click', (e) => { e.stopPropagation(); this.toggle(); });
    // nach dem HUD-Overlay zeichnen
    const upd = hud.update.bind(hud);
    hud.update = (dt) => { upd(dt); try { this.draw(); } catch (e) { console.warn('[lostool]', e); } };
  }
  get active() { return (this.held || this.sticky) && this.g.active && !this.g.demo; }
  toggle(v = !this.sticky) { this.sticky = !!v; this._syncBtn(); }
  _syncBtn() { const b = document.getElementById('btn-los'); if (b) b.classList.toggle('active', this.sticky); }
  unit() {
    const g = this.g;
    const sel = g.selected.filter((u) => u.alive && !u.type.build && u.side === g.localSide);
    return sel.find((u) => g.isOwn(u) && !u.type.structure) || sel[0] || null;
  }
  maxRange(u) {
    let r = 0;
    for (const w of u.weapons || []) if (w.def && !w.def.airOnly && !(w.def.threatsOnly)) r = Math.max(r, w.def.range || 0);
    return r;
  }
  // Sichtprüfung Einheit → Bodenpunkt (Zielhöhe: stehende Person); Ergebnis { state, reason, dist, inSight, inRange }
  evaluate(u, x, z, ty = null) {
    const g = this.g, V = g.vision, T = g.terrain;
    const ey = V.eyeY(u);
    const tY = ty ?? T.surface(x, z) + 1.2;
    const ok = V.los(u.pos.x, ey, u.pos.z, x, tY, z, u.garrison || null, null);
    const reason = ok ? (V.lastForest > 0 ? 'forest' : null) : V.lastBlock;
    const state = ok ? (V.lastForest > 0 ? 'partial' : 'clear') : (reason === 'forest' || reason === 'smoke' ? 'partial' : 'blocked');
    const dist = Math.hypot(x - u.pos.x, z - u.pos.z);
    const sight = g.sightOf(u), range = this.maxRange(u);
    return { state, reason, dist, sight, range, inSight: dist <= sight, inRange: range > 0 && dist <= range, eye: ey, ty: tY };
  }
  target() {
    const inp = this.input, W = window.innerWidth, H = window.innerHeight;
    let sx = W / 2, sy = H / 2, center = true;
    if (inp && inp.mouse && inp.mouse.inside && !inp.touch && inp.mouse.x >= 0) { sx = inp.mouse.x; sy = inp.mouse.y; center = false; }
    const p = this.g.groundPick((sx / W) * 2 - 1, -(sy / H) * 2 + 1);
    return p ? { x: p.x, z: p.z, sx, sy, center } : null;
  }
  _proj(x, y, z) {
    const v = this._v.set(x, y, z).project(this.g.gr.camera);
    if (v.z > 1) return null;
    return [(v.x * 0.5 + 0.5) * window.innerWidth, (-v.y * 0.5 + 0.5) * window.innerHeight];
  }
  _ring(ctx, cx, cz, r, color, dash, width = 1.5) {
    const T = this.g.terrain, N = 64;
    ctx.beginPath(); let started = false;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2, x = cx + Math.sin(a) * r, z = cz + Math.cos(a) * r;
      const p = this._proj(x, T.surface(x, z) + 0.3, z);
      if (!p) { started = false; continue; }
      if (started) ctx.lineTo(p[0], p[1]); else { ctx.moveTo(p[0], p[1]); started = true; }
    }
    ctx.setLineDash(dash || []); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(); ctx.setLineDash([]);
  }
  draw() {
    const g = this.g;
    this.last = null;
    if (!this.active) return;
    const ctx = this.hud.octx, T = g.terrain;
    const u = this.unit();
    const tgt = this.target();
    if (tgt?.center) { // Fadenkreuz (Handy/Gamepad)
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(tgt.sx - 12, tgt.sy); ctx.lineTo(tgt.sx - 4, tgt.sy); ctx.moveTo(tgt.sx + 4, tgt.sy); ctx.lineTo(tgt.sx + 12, tgt.sy);
      ctx.moveTo(tgt.sx, tgt.sy - 12); ctx.lineTo(tgt.sx, tgt.sy - 4); ctx.moveTo(tgt.sx, tgt.sy + 4); ctx.lineTo(tgt.sx, tgt.sy + 12); ctx.stroke();
    }
    if (!u) { this._label(ctx, tgt ? tgt.sx : window.innerWidth / 2, tgt ? tgt.sy : window.innerHeight / 2, 'Sichtlinie: eigene Einheit wählen', COL.dim); return; }
    // Sichtbereich-Fächer (Sektoren wie der Nebel des Krieges)
    try {
      const c = g._observerSectors(u);
      if (c && c.r) {
        ctx.beginPath();
        let first = null;
        for (let s = 0; s <= c.n; s++) {
          const i = s % c.n, a = (i + 0.5) / c.n * Math.PI * 2, R = c.r[i];
          const x = u.pos.x + Math.sin(a) * R, z = u.pos.z + Math.cos(a) * R;
          const p = this._proj(x, T.surface(x, z) + 0.3, z); if (!p) continue;
          if (!first) { first = p; ctx.moveTo(p[0], p[1]); } else ctx.lineTo(p[0], p[1]);
        }
        ctx.fillStyle = 'rgba(120,200,255,0.08)'; ctx.fill();
        ctx.strokeStyle = 'rgba(120,200,255,0.35)'; ctx.lineWidth = 1; ctx.stroke();
      }
    } catch (e) { /* Sektoren optional */ }
    const sight = g.sightOf(u), range = this.maxRange(u);
    this._ring(ctx, u.pos.x, u.pos.z, sight, 'rgba(160,220,255,0.75)', null, 1.5);
    if (range > 0) this._ring(ctx, u.pos.x, u.pos.z, range, 'rgba(255,170,80,0.8)', [6, 5], 1.5);
    if (!tgt) return;
    const res = this.evaluate(u, tgt.x, tgt.z);
    // Linie in Abschnitten: jeder Abschnitt mit dem Ergebnis bis zu seinem Endpunkt (zeigt, wo die Sicht abreißt)
    const N = Math.max(6, Math.min(36, Math.round(res.dist / 4)));
    const ey = res.eye, segs = [];
    let prev = this._proj(u.pos.x, ey, u.pos.z);
    for (let i = 1; i <= N; i++) {
      const f = i / N, x = u.pos.x + (tgt.x - u.pos.x) * f, z = u.pos.z + (tgt.z - u.pos.z) * f;
      const r = i === N ? res : this.evaluate(u, x, z, ey + (res.ty - ey) * f);
      const p = this._proj(x, ey + (res.ty - ey) * f, z);
      if (prev && p) segs.push([prev, p, r.state, f * res.dist > sight]);
      prev = p;
    }
    ctx.lineCap = 'round';
    for (const [a, b, st, far] of segs) {
      ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 5; ctx.setLineDash(far ? [5, 4] : []);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      ctx.strokeStyle = COL[st]; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    ctx.setLineDash([]);
    const end = this._proj(tgt.x, res.ty, tgt.z);
    if (end) {
      ctx.fillStyle = COL[res.state]; ctx.beginPath(); ctx.arc(end[0], end[1], 5, 0, Math.PI * 2); ctx.fill();
      const extra = [res.reason ? REASON[res.reason] : null, `${Math.round(res.dist)} m`, !res.inSight ? 'außer Sichtweite' : null, range > 0 ? (res.inRange ? 'in Waffenreichweite' : 'außer Waffenreichweite') : null].filter(Boolean).join(' · ');
      this._label(ctx, end[0], end[1] - 14, `${LABEL[res.state]} – ${extra}`, COL[res.state]);
    }
    this.last = { unit: u.id, state: res.state, reason: res.reason, dist: res.dist, segs: segs.map((s) => s[2]), sight, range, x: tgt.x, z: tgt.z };
  }
  _label(ctx, x, y, text, color) {
    ctx.font = '600 12px system-ui, sans-serif';
    const w = ctx.measureText(text).width + 12;
    const lx = Math.max(4, Math.min(window.innerWidth - w - 4, x - w / 2));
    ctx.fillStyle = 'rgba(10,12,10,0.78)'; ctx.fillRect(lx, y - 16, w, 20);
    ctx.fillStyle = color; ctx.fillText(text, lx + 6, y - 2);
  }
}
