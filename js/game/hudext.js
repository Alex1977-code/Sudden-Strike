// V3-M2: Befehlsleiste, Tastenkürzel und Overlay für Befehle & Welt (installiert von HUD; Eingabe-Erweiterung ohne Änderung
// der Basislogik in input.js – Methoden werden ergänzt, unbekannte Fälle laufen an die Originale weiter).
//
// Tastenkürzel (zusätzlich zu input.js):
//   Shift+Rechtsklick  Befehl an die Befehlskette anhängen (Bewegen, Angreifen, Betreten, Aufsitzen, Bauen …)
//   X  Rückzug zum Sammelpunkt          V  Feuermodus: Feuer frei → Feuer erwidern → Feuer halten
//   L  Bewegung: frei → Stellung halten → Verfolgen (begrenzt)                 C  Haltung: stehend ↔ kriechend
//   K  Formation: Block → Reihe → Keil → Kolonne                              U  Absitzen (alle), Shift+U Absitzen am Ziel
//   I  Aufprotzen (nächstes eigenes Geschütz) bzw. Abprotzen                 O  Gegenbatteriefeuer an/aus (Artillerie)
//   Rechtsklick Infanterie → eigenes Transportfahrzeug = aufsitzen; Zugfahrzeug → eigenes Geschütz = aufprotzen.
import { icon, unitIconKey, drawIcon } from './icons.js';
import { ORD, FORMATION_NAMES, FIRE_NAMES, MOVE_NAMES } from './orders.js';
import { TR } from './transport.js';

const FIRE_CYCLE = ['free', 'return', 'hold'];
const MOVE_CYCLE = ['free', 'hold', 'pursue'];
const fireOf = (u) => (u.holdFire ? 'hold' : u.fireMode === 'return' ? 'return' : 'free');
const moveOf = (u) => u.moveMode || 'free';
const d2 = (ax, az, bx, bz) => (ax - bx) * (ax - bx) + (az - bz) * (az - bz);

export class HudExt {
  constructor(hud) {
    this.hud = hud;
    this.g = hud.game;
    this.installed = false;
    queueMicrotask(() => this.install());
  }
  get input() { return this.hud.input; }

  // ---------------- Eingabe ergänzen ----------------
  install() {
    const inp = this.input;
    if (!inp || this.installed) return;
    this.installed = true;
    const g = this.g, self = this;
    const baseOrderAt = inp.orderAt.bind(inp);
    inp.orderAt = function (own, x, y, u, attackMove = false) {
      const queue = inp.keys.has('Shift');
      if (self.specialOrder(own, u, queue)) return;
      if (!queue) return baseOrderAt(own, x, y, u, attackMove);
      // Befehlskette: dieselbe Auswertung, jedes Kommando mit queue:true
      const iss = g.issueCommand;
      g.issueCommand = (c) => iss.call(g, { ...c, queue: true });
      try { return baseOrderAt(own, x, y, u, attackMove); } finally { g.issueCommand = iss; }
    };
    const baseFire = inp.fireBuild.bind(inp);
    inp.fireBuild = function (x, y, keep) { if (inp.pendingBuild?.ext) return self.fireTarget(x, y); return baseFire(x, y, keep); };
    const baseKey = inp.onKey.bind(inp);
    inp.onKey = function (e, down) { baseKey(e, down); if (down) self.onKey(e); };
  }
  // Rechtsklick/Antippen auf eigenes Fahrzeug bzw. Geschütz
  specialOrder(own, u, queue) {
    const g = this.g, T = g.trans;
    if (!u || !u.alive || u.side !== g.localSide || !T) return false;
    const q = queue || undefined;
    if (T.canCarry(u) && g.isOwn(u)) {
      const inf = own.filter((o) => o !== u && T.canBoard(o));
      if (inf.length) { g.issueCommand({ t: 'embark', ids: inf.map((o) => o.id), target: u.id, queue: q }); return true; }
    }
    if (u.type.towable && g.isOwn(u) && !u.towedBy) {
      const tows = own.filter((o) => T.canTow(o));
      if (tows.length) { g.issueCommand({ t: 'hitch', ids: [tows[0].id], target: u.id, queue: q }); return true; }
    }
    return false;
  }
  onKey(e) {
    const g = this.g, inp = this.input;
    if (!g.active || g.paused || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const own = inp.ownSelected();
    if (!own.length) return;
    const map = { x: 'retreat', v: 'firemode', l: 'movemode', c: 'pose', k: 'formation', o: 'cb' };
    if (map[k]) { this.onAct(map[k], own); return; }
    if (k === 'u') { this.onAct(e.shiftKey ? 'unload_at' : 'unload', own); return; }
    if (k === 'i') { this.onAct(own.some((u) => u.towing || u.towedBy) ? 'unhitch' : 'hitch', own); return; }
  }

  // ---------------- Befehlsleiste ----------------
  _cands(own) {
    const g = this.g, T = g.trans;
    const mob = own.filter((u) => !u.type.structure && !u.type.kamikaze);
    const fighters = mob.filter((u) => u.weapons.length);
    const inf = mob.filter((u) => u.type.infantry);
    const carriers = own.filter((u) => T.cargoCount(u) > 0);
    const boarders = inf.filter((u) => T.canBoard(u));
    const towing = own.filter((u) => u.towing || u.towedBy || u.towingId);
    const tows = own.filter((u) => T.canTow(u) && !u.towingId);
    const arty = own.filter((u) => u.weapons.some((w) => w.def.kind === 'artillery'));
    const eng = own.filter((u) => u.type.engineer);
    return { mob, fighters, inf, carriers, boarders, towing, tows, arty, eng };
  }
  nearTransport(units) {
    const g = this.g, T = g.trans;
    if (!units.length) return null;
    const cx = units.reduce((s, u) => s + u.pos.x, 0) / units.length, cz = units.reduce((s, u) => s + u.pos.z, 0) / units.length;
    let best = null, bd = 70 * 70;
    for (const v of g.units) {
      if (!g.isOwn(v) || !T.canCarry(v) || T.room(v) <= 0) continue;
      const d = d2(v.pos.x, v.pos.z, cx, cz);
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }
  nearGun(v) {
    const g = this.g, T = g.trans;
    let best = null, bd = 50 * 50;
    for (const u of g.units) { if (!g.isOwn(u) || !T.isTowable(u)) continue; const d = d2(u.pos.x, u.pos.z, v.pos.x, v.pos.z); if (d < bd) { bd = d; best = u; } }
    return best;
  }
  sig(own) {
    if (!own.length) return '';
    const c = this._cands(own), g = this.g;
    return [c.mob.map((u) => fireOf(u)[0] + moveOf(u)[0] + (u.prone ? 'p' : '') + (u.retreat ? 'r' : '') + (u.cbOff ? 'c' : '')).join(''),
      c.carriers.map((u) => g.trans.cargoCount(u)).join(','), c.boarders.length, c.towing.length, c.tows.length, c.arty.length, c.eng.map((u) => Math.floor(u.mineStock || 0)).join(','),
      g.localPlayer?.formation || 'block', g.bridges.length, g.bridges.map((b) => b.state[0]).join('')].join('|');
  }
  buttons(own, pend, btn) {
    const g = this.g, c = this._cands(own);
    if (!own.length) return '';
    let h = '';
    const ext = (m) => pend?.ext && pend.mode === m;
    if (c.fighters.length) {
      const f = fireOf(c.fighters[0]), all = c.fighters.every((u) => fireOf(u) === f);
      h += btn('firemode', '', f === 'hold' ? 'holdfire' : f === 'return' ? 'fire_return' : 'firefree', all ? (f === 'free' ? 'Feuer frei' : f === 'return' ? 'Erwidern' : 'Feuer halten') : 'Feuer …', false, f !== 'free');
    }
    if (c.mob.length) {
      const m = moveOf(c.mob[0]);
      h += btn('movemode', '', m === 'hold' ? 'stance_hold' : m === 'pursue' ? 'stance_pursue' : 'move', m === 'hold' ? 'Stellung' : m === 'pursue' ? 'Verfolgen' : 'Bew. frei', false, m !== 'free');
      h += btn('retreat', '', 'retreat', 'Rückzug', false, c.mob.some((u) => u.retreat));
    }
    if (c.inf.length) { const pr = c.inf.every((u) => u.prone); h += btn('pose', '', pr ? 'stand' : 'prone', pr ? 'Aufstehen' : 'Kriechen', false, pr); }
    if (c.mob.length > 1) { const fm = g.localPlayer?.formation || 'block'; h += btn('formation', '', 'formation_' + fm, FORMATION_NAMES[fm], false, fm !== 'block'); }
    if (c.boarders.length && this.nearTransport(c.boarders)) h += btn('embark', '', 'embark', 'Aufsitzen', false, false);
    if (c.carriers.length) { h += btn('unload', '', 'unload', 'Absitzen', false, false); h += btn('unload_at', '', 'unload_at', 'Absitzen am Ziel', false, ext('unload_at')); }
    if (c.towing.length) h += btn('unhitch', '', 'unhitch', 'Abprotzen', c.towing.some((u) => u.limberT > 0), false);
    else if (c.tows.some((v) => this.nearGun(v))) h += btn('hitch', '', 'hitch', 'Aufprotzen', false, false);
    if (c.arty.length) { const off = c.arty.every((u) => u.cbOff); h += btn('cb', '', 'counterbattery', off ? 'Gegenfeuer aus' : 'Gegenfeuer an', false, !off); }
    if (c.eng.length) {
      h += btn('pickmines', '', 'pickmines', 'Minen aufn.', false, ext('pickmines'));
      if (g.bridges.some((b) => b.state !== 'destroyed')) h += btn('blowbridge', '', 'blowbridge', 'Brücke sprengen', false, ext('blowbridge'));
      if (g.bridges.some((b) => b.state === 'destroyed')) h += btn('buildbridge', '', 'buildbridge', 'Brücke bauen', false, ext('buildbridge'));
    }
    return h;
  }
  onAct(act, own) {
    const g = this.g, inp = this.input, c = this._cands(own);
    const ids = (l) => l.map((u) => u.id);
    switch (act) {
      case 'firemode': {
        if (!c.fighters.length) return;
        const cur = fireOf(c.fighters[0]), next = FIRE_CYCLE[(FIRE_CYCLE.indexOf(cur) + 1) % 3];
        g.issueCommand({ t: 'stance', ids: ids(c.fighters), fire: next }); g.alert(FIRE_NAMES[next], 1.2); break;
      }
      case 'movemode': {
        if (!c.mob.length) return;
        const cur = moveOf(c.mob[0]), next = MOVE_CYCLE[(MOVE_CYCLE.indexOf(cur) + 1) % 3];
        g.issueCommand({ t: 'stance', ids: ids(c.mob), move: next }); g.alert('Bewegung: ' + MOVE_NAMES[next], 1.2); break;
      }
      case 'pose': if (c.inf.length) g.issueCommand({ t: 'stance', ids: ids(c.inf), pose: c.inf.every((u) => u.prone) ? 'stand' : 'prone' }); break;
      case 'retreat': if (c.mob.length) { g.issueCommand({ t: 'retreat', ids: ids(c.mob) }); g.alert('Rückzug!', 1.2); } break;
      case 'formation': {
        const cur = g.localPlayer?.formation || 'block', next = ORD.formations[(ORD.formations.indexOf(cur) + 1) % ORD.formations.length];
        g.issueCommand({ t: 'formation', value: next });
        if (g.net?.isClient && g.localPlayer) g.localPlayer.formation = next; // Anzeige sofort
        g.alert('Formation: ' + FORMATION_NAMES[next], 1.2); break;
      }
      case 'embark': { const v = this.nearTransport(c.boarders); if (v) g.issueCommand({ t: 'embark', ids: ids(c.boarders), target: v.id }); break; }
      case 'unload': if (c.carriers.length) g.issueCommand({ t: 'unload', ids: ids(c.carriers) }); break;
      case 'unhitch': if (c.towing.length) g.issueCommand({ t: 'unhitch', ids: ids(c.towing) }); break;
      case 'hitch': { for (const v of c.tows) { const gun = this.nearGun(v); if (gun) { g.issueCommand({ t: 'hitch', ids: [v.id], target: gun.id }); break; } } break; }
      case 'cb': if (c.arty.length) { const on = c.arty.every((u) => u.cbOff); g.issueCommand({ t: 'stance', ids: ids(c.arty), cb: on }); } break;
      case 'unload_at': case 'pickmines': case 'blowbridge': case 'buildbridge': this.startTarget(act); return;
      default: return;
    }
    this.hud.refreshBuildbar(true); this.hud.refreshSelection();
  }
  // ---------------- Zielwahl ----------------
  startTarget(mode) {
    const inp = this.input;
    if (!inp) return;
    if (inp.pendingBuild?.ext && inp.pendingBuild.mode === mode) { inp.cancelBuild(); return; }
    inp.cancelAbility();
    if (inp.pendingBuild) inp.cancelBuild();
    inp.pendingBuild = { mode, ext: true };
    const txt = { unload_at: 'Zielpunkt zum Absitzen wählen', pickmines: 'Minenfeld zum Aufnehmen wählen', blowbridge: 'Brücke zum Sprengen wählen', buildbridge: 'Zerstörte Brücke zum Wiederaufbau wählen' }[mode];
    this.hud.showTargetHint(txt + (inp.touch ? ' – Karte antippen' : ' – Klick wählt'), () => inp.cancelBuild());
    this.hud.refreshBuildbar(true);
  }
  fireTarget(x, y) {
    const g = this.g, inp = this.input, pb = inp.pendingBuild, own = inp.ownSelected(), c = this._cands(own);
    const p = inp.ground(x, y);
    if (!p) return;
    const q = inp.keys.has('Shift') || undefined;
    let ok = false;
    if (pb.mode === 'unload_at') ok = c.carriers.length && g.issueCommand({ t: 'unload', ids: c.carriers.map((u) => u.id), x: p.x, z: p.z, queue: q });
    else if (pb.mode === 'pickmines') ok = c.eng.length && g.issueCommand({ t: 'pickmines', ids: c.eng.map((u) => u.id), x: p.x, z: p.z, queue: q });
    else {
      const b = g.mapobj.nearestBridge(p.x, p.z, 30);
      ok = !!b && c.eng.length && g.issueCommand({ t: pb.mode, ids: c.eng.map((u) => u.id), target: b.id, queue: q });
    }
    if (ok === false || !ok) { g.audio.ui('fail'); return; }
    g.effects.marker(p.x, p.z, 0xffd500, 0.8, 2);
    inp.cancelBuild();
  }

  // ---------------- Auswahl-Detail ----------------
  tacText(u, own) {
    const g = this.g, T = g.trans, p = [];
    if (!own) return '';
    const cap = T.capacity(u);
    if (cap) {
      const types = T.cargoTypes(u), n = T.cargoCount(u);
      const ic = types.slice(0, 12).map((t) => icon(unitIconKey(t), { cls: 'ic-in' })).join('');
      p.push(`<span style="color:#9ec5ff" title="Insassen">${icon('embark', { cls: 'ic-in' })} Insassen ${n}/${cap}</span>${ic ? ' ' + ic : ''}`);
    }
    if (u.towing || u.towingId) { const gun = u.towing || g.unitById(u.towingId); p.push(`<span style="color:#ffd500">${icon('hitch', { cls: 'ic-in' })} zieht ${gun?.name || 'Geschütz'}</span>`); }
    if (u.towedBy) p.push('<span style="color:#ffd500">aufgeprotzt</span>');
    if (u.limberT > 0) p.push(`<span style="color:#ffb347">Protzen ${Math.ceil(u.limberT)} s</span>`);
    if (u.fireMode === 'return' && !u.holdFire) p.push('<span style="color:#ffb347">Feuer erwidern</span>');
    if (u.moveMode === 'hold') p.push('<span style="color:#9ec5ff">Stellung halten</span>'); else if (u.moveMode === 'pursue') p.push('<span style="color:#9ec5ff">Verfolgen (begrenzt)</span>');
    if (u.prone) p.push('<span class="muted">kriechend</span>');
    if (u.retreat) p.push('<span style="color:#9ec5ff">Rückzug</span>');
    if (u.cbOff) p.push('<span class="muted">Gegenfeuer aus</span>');
    if (u.mineStock >= 1) p.push(`<span style="color:#ffd500">Minen ${Math.floor(u.mineStock)}</span>`);
    const qn = u.remote ? Math.max(0, (u.netWp?.length || 0) - 1) : (u.queue?.length || 0);
    if (qn) p.push(`<span style="color:#c8ff5d">${icon('waypoint', { cls: 'ic-in' })} Befehlskette ${qn}</span>`);
    if (u.train) p.push(`<span class="muted">Zug ${Math.round(Math.abs(u.train.v) * 3.6)} km/h${u.train.target !== null ? ' → Ziel' : ''}</span>`);
    return p.join(' · ');
  }

  // ---------------- Overlay ----------------
  drawOverlay(ctx, W, H, cam, v) {
    const g = this.g, ls = g.localSide, T = g.trans;
    if (!T) return;
    const proj = (x, y, z) => { v.set(x, y, z).project(cam); if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) return null; return [(v.x * 0.5 + 0.5) * W, (-v.y * 0.5 + 0.5) * H]; };
    ctx.font = '700 11px system-ui'; ctx.textAlign = 'center';
    for (const u of g.units) {
      if (!u.alive || u.side !== ls) continue;
      const n = T.cargoCount(u);
      if (n > 0) {
        const s = proj(u.pos.x, u.pos.y + (u.model.height || 2) + (u.type.air ? 0 : 2.6), u.pos.z);
        if (s) { ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(s[0] + 10, s[1] - 9, 30, 14); drawIcon(ctx, 'embark', s[0] + 17, s[1] - 2, 11, '#9ec5ff'); ctx.fillStyle = '#9ec5ff'; ctx.textAlign = 'left'; ctx.fillText(String(n), s[0] + 25, s[1] + 2); ctx.textAlign = 'center'; }
      }
      if (u.limberT > 0 && !u.towedBy) {
        const s = proj(u.pos.x, u.pos.y + 4, u.pos.z);
        if (s) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(s[0] - 20, s[1], 40, 5); ctx.fillStyle = '#ffd500'; ctx.fillRect(s[0] - 19, s[1] + 1, 38 * (1 - u.limberT / TR.limber), 3); }
      }
      // Minen aufnehmen / räumen: Fortschritt über dem Minenfeld
      if (u.job?.type === 'clear') {
        const m = g.unitById(u.job.target);
        if (m?.alive && m.type.build?.mines) {
          const s = proj(m.pos.x, m.pos.y + 2, m.pos.z), tot = m.type.build.mines;
          if (s) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(s[0] - 26, s[1], 52, 6); ctx.fillStyle = u.job.pick ? '#ffd500' : '#5dff8a'; ctx.fillRect(s[0] - 25, s[1] + 1, 50 * Math.max(0, 1 - m.mines / tot), 4); ctx.fillStyle = '#fff'; ctx.fillText(u.job.pick ? `Minen aufnehmen ${Math.ceil(m.mines)}` : `Räumen ${Math.ceil(m.mines)}`, s[0], s[1] - 3); }
        }
      }
    }
    // Brücken: Zustand / Wiederaufbau
    for (const b of g.bridges) {
      if (b.state === 'intact' && b.hp >= b.maxHp) continue;
      const s = proj(b.cx, g.terrain.seaLevel + 3, b.cz);
      if (!s) continue;
      if (b.state === 'destroyed') {
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText('Brücke zerstört', s[0] + 1, s[1] + 1); ctx.fillStyle = '#ff8a5a'; ctx.fillText('Brücke zerstört', s[0], s[1]);
        if (b.build > 0) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(s[0] - 31, s[1] + 4, 62, 6); ctx.fillStyle = '#5dff8a'; ctx.fillRect(s[0] - 30, s[1] + 5, 60 * b.build, 4); }
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(s[0] - 31, s[1] + 4, 62, 6); ctx.fillStyle = b.hp / b.maxHp > 0.4 ? '#c8ccd0' : '#ff8a5a'; ctx.fillRect(s[0] - 30, s[1] + 5, 60 * Math.max(0, b.hp / b.maxHp), 4);
      }
    }
  }
}
