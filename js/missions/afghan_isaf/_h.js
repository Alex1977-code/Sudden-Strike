// V3-C2: gemeinsame Helfer der Afghanistan-Kampagnen (afghan-isaf, afghan-soviet).
// Nur Missionslogik: Zähler, Wellen, Befestigungen, Pionier-Räumen, Dorfschäden, Hubschrauber-Einsätze und vier
// missionseigene Fähigkeiten (Leuchtrakete, MEDEVAC an der Landezone, 120-mm-Mörser BW, 122-mm-Artillerie SA).
import { ABILITIES } from '../../game/abilities.js';
import { UNIT_TYPES, registerUnitTypes } from '../../game/unitTypes.js';
import { rand } from '../../engine/util.js';

// ---------------------------------------------------------------- Abfragen
export const alive = (g, side, f) => g.units.filter((u) => u.alive && u.side === side && !u.type.structure && !u.type.air && (!f || f(u)));
export const near = (g, x, z, r, side, f) => g.units.filter((u) => u.alive && u.side === side && !u.type.structure && !u.type.air && Math.hypot(u.pos.x - x, u.pos.z - z) < r && (!f || f(u)));
export const dist = (u, x, z) => Math.hypot(u.pos.x - x, u.pos.z - z);
export const mmss = (s) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

// Zielzeile umschreiben (Zähler, Restzeit)
export function setText(g, id, text) {
  const o = g.objectives.find((q) => q.id === id);
  if (o && o.text !== text) { o.text = text; g.emit('objectives'); }
}
export const objCount = (g, id, base, n, m) => setText(g, id, `${base} (${Math.min(n, m)}/${m})`);
// Ziel einmalig setzen (nur solange offen)
export function settle(g, id, state) { if (g.objState(id) === 'open') g.setObjective(id, state); }

// ---------------------------------------------------------------- Einheiten
// Angriffsgruppe der Gegenseite: erscheint bei from, greift entlang pts an, danach Wache
export function wave(g, list, from, pts, { spacing = 4, cols = 4, tags = ['wave'], aggro = 40, after = 'guard', side = 'RU' } = {}) {
  if (g.ended) return [];
  return g.spawnGroup(list, side, from[0], from[1], { spacing, cols, tags, heading: Math.atan2(pts[0][0] - from[0], pts[0][1] - from[1]),
    ai: { mode: 'attackMove', points: pts.map((p) => [...p]), aggressive: true, aggroRadius: aggro, after } });
}
// Wachgruppe
export const post = (g, list, x, z, { r = 30, tags = [], side = 'RU', spacing = 3.5, cols = 3 } = {}) =>
  g.spawnGroup(list, side, x, z, { spacing, cols, tags, ai: { mode: 'guard', radius: r } });
// Fertiges Bauwerk (Graben, Sangar, Draht, Sprengfalle …): progress 1, sonst zählen Deckung/Minen nicht
export function fort(g, kind, side, x, z, o = {}) {
  const d = UNIT_TYPES[kind]?.build || {};
  return g.spawn(kind, side, x, z, { noBlock: true, build: { progress: 1, time: d.time || 1, kind }, mines: d.mines || 0, ...o });
}
// Nachtsicht (Restlicht-/Wärmebildgeräte): Sichtabzug der Nacht weitgehend ausgleichen
export function nightVision(units, k = 1.27) { for (const u of units) if (u.type.infantry || u.type.vehicle) u.sightMul = k; }

// Pioniere räumen erkannte Sprengfallen/Minen und Sperren der Gegenseite, wenn sie still daneben stehen
// (Kampagne ohne Logistikmodus kennt keine Räumbefehle). Sprengfallen erkennt ein Pionier ab 12 m (logistics.detectMines).
// Sperren: Bauwerke mit Tag 'sperre' (z. B. Felsbrocken/Panzersperre), ca. 6 s je Pionier.
export function clearByEngineers(g, dt, side = 'UA', onClear) {
  const engs = g.units.filter((u) => u.alive && u.side === side && u.type.engineer && !u.moving && !u.carrier);
  if (!engs.length) return;
  for (const m of [...g.units]) {
    if (!m.alive || !m.type.structure || m.side === side || m.side === 'N') continue;
    const b = m.type.build;
    const isMine = b && b.mines > 0, isWire = b && b.blocksInfantry, isBlock = m.tags.has('sperre');
    if (!(isMine || isWire || isBlock) || !m.seenBy?.[side]) continue;
    const n = engs.filter((e) => Math.hypot(e.pos.x - m.pos.x, e.pos.z - m.pos.z) < 7.5).length;
    if (!n) continue;
    if (isMine) m.mines = (m.mines ?? b.mines) - n * dt / 2.5;
    else m._cut = (m._cut || 0) + n * dt;
    if ((isMine && m.mines <= 0.0001) || (!isMine && m._cut >= (isBlock ? 6 : 4))) {
      g.effects.explosion(m.pos.x, m.pos.y + 0.2, m.pos.z, isMine ? 0.35 : 0.2, { crater: false });
      if (g.logi) g.logi.removeBuilding(m); else { m.alive = false; g.scene.remove(m.root); g.removeUnit(m); }
      g.emit('mineCleared', m);
      if (onClear) onClear(m);
    }
  }
}

// Einheit ohne Abschuss/Verlustzählung aus dem Spiel nehmen (ausgeflogen, durchgefahren, gesichert)
export function vanish(g, u) {
  if (!u || !u.alive) return;
  u.alive = false;
  g.scene.remove(u.root);
  g.removeUnit(u);
}

// Dorfschäden: Häuser im Kreis zu Missionsbeginn erfassen; loss() = Anteil verlorener Gebäudepunkte (0..1)
export function villageWatch(g, x, z, r) {
  const hs = g.units.filter((u) => u.alive && u.type.key === 'house' && Math.hypot(u.pos.x - x, u.pos.z - z) < r);
  const tot = hs.reduce((s, h) => s + h.maxHp, 0) || 1;
  return {
    n: hs.length,
    loss() { let l = 0; for (const h of hs) l += h.alive ? Math.max(0, h.maxHp - h.hp) : h.maxHp; return l / tot; },
    destroyed() { return hs.filter((h) => !h.alive).length; },
  };
}

// Gebiet halten: true, wenn der Gegner die Stellung länger als grace s beherrscht
export function overrun(g, st, key, x, z, r, { grace = 12, dt = 0.05, minOwn = 1 } = {}) {
  const own = near(g, x, z, r, 'UA').length, en = near(g, x, z, r, 'RU').length;
  const bad = (own < minOwn && en > 0) || en >= Math.max(4, own * 3);
  st[key] = bad ? (st[key] || 0) + dt : 0;
  return st[key] > grace;
}

// Fahrzeugkolonne: fährt die Route (Wegpunkte) selbstständig ab, in fester Reihenfolge mit Abstand. allowed() liefert den
// höchsten freigegebenen Wegpunkt-Index (gemeldete Sperren davor müssen geräumt sein); davor halten die Fahrzeuge.
export class Convoy {
  constructor(g, vehicles, route, { allowed = () => Infinity, arriveR = 8, gap = 13 } = {}) {
    Object.assign(this, { g, vehicles, route, allowed, arriveR, gap });
    for (const v of vehicles) { v.ai = null; v._cv = 1; }
  }
  get arrived() { return this.vehicles.filter((v) => v.arrivedConvoy); }
  get living() { return this.vehicles.filter((v) => v.alive || v.arrivedConvoy); }
  step() {
    const R = this.route, lim = this.allowed();
    let prev = null;
    for (const [k, v] of this.vehicles.entries()) {
      if (!v.alive || v.arrivedConvoy) { if (v.alive) prev = v; continue; }
      let i = v._cv;
      while (i < R.length && Math.hypot(v.pos.x - R[i][0], v.pos.z - R[i][1]) < this.arriveR) i++;
      v._cv = i;
      if (i >= R.length) { v.arrivedConvoy = true; v.stop(); prev = v; continue; }
      const wait = i > lim || (prev && prev.alive && prev.moving && !prev.arrivedConvoy && Math.hypot(prev.pos.x - v.pos.x, prev.pos.z - v.pos.z) < this.gap && (prev._cv || 1) <= i);
      if (wait) { if (v.moving || v.path?.length) v.stop(); v._tgt = 0; }
      else if (v._tgt !== i || (!v.moving && !v.path?.length)) {
        const last = i === R.length - 1, o = last ? (k - (this.vehicles.length - 1) / 2) * 6 : 0;
        v.moveTo(R[i][0] + o, R[i][1] + (last ? Math.abs(o) * 0.3 : 0)); v._tgt = i;
      }
      prev = v;
    }
  }
}

// Hubschrauber setzt Infanterie an einem Punkt ab (landet, setzt ab) und fliegt zurück; Rückgabe: Hubschrauber
export function heliInsert(g, type, side, from, to, cargo, { onLand, leave = true, alt = 18 } = {}) {
  const h = g.spawn(type, side, from[0], from[1], { startAlt: alt, cargo, tags: ['insert'] });
  h.ai = null;
  if (g.trans) { h.unloadAt = { x: to[0], z: to[1] }; h.moveTo(to[0], to[1]); } else h.moveTo(to[0], to[1]);
  let t0 = g.time, landed = false;
  const poll = () => {
    if (g.ended || !h.alive) return;
    const empty = !h.cargo?.length;
    if (!landed && (empty || g.time - t0 > 70)) {
      landed = true;
      let out = [];
      if (!empty && g.trans) out = g.trans.unloadAll(h); // Rückfallebene: nach 70 s sofort absetzen
      if (onLand) onLand(h, out);
      if (leave) g.later(4, () => { if (!h.alive) return; g.trans?.takeoff?.(h); h.moveTo(from[0], from[1]); g.later(22, () => vanish(g, h)); });
      return;
    }
    g.later(0.5, poll);
  };
  g.on('disembark', function lis(v, out) { if (v === h) { g.off('disembark', lis); if (!landed) { landed = true; if (onLand) onLand(h, out); if (leave) g.later(4, () => { if (!h.alive) return; g.trans?.takeoff?.(h); h.moveTo(from[0], from[1]); g.later(22, () => vanish(g, h)); }); } } });
  g.later(0.5, poll);
  return h;
}

// Munition begrenzen (Kampagne hat sonst unbegrenzte Vorräte); refill füllt anteilig auf
export function limitAmmo(units, k = 0.5) {
  for (const u of units) for (const w of u.weapons || []) {
    if (!w.def.stock) continue;
    w.stockMax = Math.max(12, Math.round(w.def.stock * k)); w.stock = w.stockMax;
  }
}
export function refill(units, frac = 0.6) {
  let n = 0;
  for (const u of units) {
    let did = false;
    for (const w of u.weapons || []) {
      if (w.stockMax === undefined || w.stockMax === Infinity || w.stock >= w.stockMax) continue;
      w.stock = Math.min(w.stockMax, w.stock + w.stockMax * frac); did = true;
      if (w.def.ammo && w.ammo <= 0) w.reloadT = Math.min(w.reloadT, 1);
    }
    if (did) n++;
  }
  return n;
}

// ---------------------------------------------------------------- Fähigkeiten (missionseigen)
const edgeOf = (game, p) => game.mission?.friendlyEdges?.[p.team] || (p.team === 'UA' && game.mission?.friendlyEdge) || [0, (p.team === 'UA' ? 1 : -1) * (game.terrain.half + 40)];
const sfx = (game, k, x, z) => { try { game.audio.shot(k, x, z); } catch (e) { /* kein Ton */ } };
const MORT120 = { name: '120-mm-Mörser', dmg: 160, splash: 6, vs: { soft: 1, light: 0.6, heavy: 0.2, air: 0, struct: 0.35 } };
const HOW122 = { name: '122-mm-Haubitze D-30', dmg: 190, splash: 6.5, vs: { soft: 1, light: 0.8, heavy: 0.4, air: 0, struct: 0.5 } };

function shells(game, p, x, z, w, n, spread, t0, dt, size, snd) {
  const e = edgeOf(game, p);
  for (let i = 0; i < n; i++) {
    game.later(i * 0.15, () => sfx(game, snd, e[0], e[1]));
    game.combat.incomingShell(x + rand(-spread, spread), z + rand(-spread, spread), w, p.team, t0 + i * dt, null, size, p.id);
  }
}

if (!ABILITIES.af_c2_flare) Object.assign(ABILITIES, {
  af_c2_flare: {
    name: 'Leuchtrakete', icon: '✨', cooldown: 10, charges: 8, radius: 40,
    desc: 'Leuchtrakete über dem Zielgebiet: hebt den Sichtabzug der Nacht im Umkreis von 40 m für 20 s auf und deckt das Gebiet auf.',
    exec(game, x, z, p) {
      if (!game.weather?.fireFlare) { game.addReveal(x, z, 34, 20, p.team); return; }
      game.weather.fireFlare(x, z, p.team);
      game.sayTo(p.id, 'Gruppenführer', 'Leuchtrakete – Gelände beobachten!', 2.5);
    },
  },
  af_c2_medevac: {
    name: 'MEDEVAC (Landezone)', icon: '🚑', cooldown: 45, charges: 0, radius: 18,
    desc: 'Rettungshubschrauber landet an der markierten Landezone und nimmt Verwundete (Kennung „verwundet“) im Umkreis von 18 m auf. Die Landezone muss frei von Gegnern sein (35 m).',
    exec(game, x, z, p) {
      const foe = game.units.some((u) => u.alive && u.side !== p.team && u.side !== 'N' && !u.type.structure && Math.hypot(u.pos.x - x, u.pos.z - z) < 35);
      if (foe) { game.sayTo(p.id, 'Rettungsleitstelle', 'Landezone nicht gesichert – der Hubschrauber kann dort nicht landen.', 4); return false; }
      const lz = game.mission?.lz;
      if (lz && Math.hypot(lz[0] - x, lz[1] - z) > 30) { game.sayTo(p.id, 'Rettungsleitstelle', 'Landung nur an der vereinbarten Landezone möglich.', 4); return false; }
      const type = game.mission?.medevacType || 'af_bw_nh90';
      const e = edgeOf(game, p);
      const h = game.spawn(type, p.team, e[0] + rand(-8, 8), e[1], { owner: p.id, startAlt: 18, tags: ['medevac'] });
      h.ai = null; h.moveTo(x, z);
      game.markerTo(p.team, x, z, 0xff4040, 20, 18);
      game.sayTo(p.id, 'Rettungsleitstelle', 'Rettungshubschrauber im Anflug – Landezone offen halten, Verwundete bereitstellen!', 4);
      const t0 = game.time;
      let st = 'in', tl = 0;
      const poll = () => {
        if (!game.active) return;
        if (!h.alive) { game.sayTo(p.id, 'Rettungsleitstelle', 'Hubschrauber getroffen und abgedreht – neuer Anflug später!', 4); game.mission?.onMedevacLost?.(game); return; }
        if (st === 'in') {
          if (Math.hypot(h.pos.x - x, h.pos.z - z) < 7) { st = 'land'; h.stop(); game.trans?.land?.(h); tl = game.time; }
          else if (game.time - t0 > 60) { vanish(game, h); return; }
        } else if (st === 'land' && game.time - tl > 7) {
          const w = game.units.filter((u) => u.alive && u.side === p.team && u.tags.has('wounded') && Math.hypot(u.pos.x - x, u.pos.z - z) < 18);
          for (const u of w) vanish(game, u);
          game.mission?.onEvac?.(game, w.length);
          game.sayTo(p.id, 'Rettungsleitstelle', w.length ? `${w.length} Verwundete an Bord. Wir fliegen ab.` : 'Keine Verwundeten an der Landezone – Abflug.', 4);
          st = 'out'; game.trans?.takeoff?.(h); h.moveTo(e[0], e[1]); game.later(16, () => vanish(game, h)); return;
        }
        game.later(0.25, poll);
      };
      game.later(0.25, poll);
    },
  },
  af_c2_mortar120: {
    name: 'Mörserfeuer 120 mm', icon: '💥', cooldown: 40, charges: 4, radius: 12,
    desc: '6 Granaten 120 mm aus der Mörserstellung (Flugzeit ~5 s). Ohne Sicht auf das Ziel deutlich ungenauer. Vorsicht in Ortschaften.',
    exec(game, x, z, p) {
      const vis = game.fowFor(p.team).isVisible(x, z);
      game.sayTo(p.id, 'Mörser', vis ? 'Ziel aufgenommen – Feuer!' : 'Kein Sichtkontakt – Feuer nach Planquadrat, Streuung erhöht!', 3);
      shells(game, p, x, z, MORT120, 6, vis ? 6 : 13, 4.5, 0.45, 1.3, 'mortar');
      game.markerTo(p.team, x, z, 0xff8030, 7, 12);
    },
  },
  af_c2_arty_sa: {
    name: 'Artilleriefeuer 122 mm', icon: '💥', cooldown: 45, charges: 4, radius: 14,
    desc: '8 Granaten der Haubitzbatterie (D-30, 122 mm; Flugzeit ~5 s). Ohne Sicht auf das Ziel deutlich ungenauer.',
    exec(game, x, z, p) {
      const vis = game.fowFor(p.team).isVisible(x, z);
      game.sayTo(p.id, 'Batterie', vis ? 'Verstanden, Feuer!' : 'Feuer nach Karte – Streuung groß!', 3);
      shells(game, p, x, z, HOW122, 8, vis ? 8 : 15, 5, 0.35, 1.5, 'howitzer');
      game.markerTo(p.team, x, z, 0xff8030, 7, 14);
    },
  },
});

// Packtier-Karawane, die nicht automatisch beschossen wird (Lasttiere und Material sollen gesichert werden)
if (!UNIT_TYPES.af_c2_caravan && UNIT_TYPES.af_muj_caravan) {
  const o = UNIT_TYPES.af_muj_caravan;
  registerUnitTypes({ af_c2_caravan: { era: 'afghan', faction: 'MUJ', cls: 'veh', armor: 'light', model: o.model, name: 'Packtier-Karawane', icon: o.icon, hp: o.hp, speed: 4.4, sight: o.sight, radius: o.radius, weapons: [], turnRate: o.turnRate, noAutoTarget: true, desc: 'Esel und Maultiere mit Munition und Material. Wird nicht automatisch beschossen – sichern statt zerstören.' } });
}
