// Übersetzt eine „Steppensturm-Karte" (js/editor/format.js) in Spieldaten:
//   compileWorld(doc)          → { map (Terrain-Definition mit features), env, houses, decorate(g) }
//   compileMission(doc, opts)  → Missionsobjekt für game.load (setup/update erzeugen Einheiten, KI und Ziele)
//   compilePreview(doc, cam)   → Editor-Vorschau (kein Nebel, keine KI, statische Einheiten)
//   compileSkirmishGen(doc)    → Generator-Ergebnis für js/skirmish/skirmish.js (Startzonen, Eroberungspunkte)
// Alles ist reine Datenverarbeitung – aus Karten/Mods wird nie Code ausgeführt.
import * as THREE from 'three';
import { mulberry32, distToPolyline, pointInPoly } from '../engine/util.js';
import { pickBuilding } from '../game/buildingKinds.js';
import { house as houseModel } from '../game/models.js';
import { UNIT_TYPES } from '../game/unitTypes.js';
import { sanitizeMap, escapeHtml, OBJECTIVE_KINDS, ERA_SET, hashStr, CP_KINDS } from './format.js';

const other = (t) => (t === 'UA' ? 'RU' : 'UA');
const r1 = (v) => Math.round(v * 10) / 10;
const FOG = (size) => (size <= 200 ? 0.0032 : size <= 260 ? 0.0028 : size <= 380 ? 0.0025 : 0.0021);

// ---------- Gelände ----------
function seedOf(doc, id) { return (doc.map.seed * 9973 + parseInt(hashStr(id), 36)) >>> 0; }

// Häuser einer Siedlung deterministisch erzeugen (Gebäude-Set aus buildingKinds.js)
function villageHouses(doc, v, taken) {
  const rnd = mulberry32(seedOf(doc, v.id));
  const half = doc.map.size / 2;
  const roads = doc.elements.filter((e) => e.type === 'road');
  const rivers = doc.elements.filter((e) => e.type === 'river');
  const waters = doc.elements.filter((e) => e.type === 'water');
  const out = [];
  let tries = 0;
  while (out.length < v.houses && tries < v.houses * 50) {
    tries++;
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * v.r;
    const x = v.x + Math.cos(a) * r, z = v.z + Math.sin(a) * r;
    const b = pickBuilding(rnd, v.set || 'ukraine_village', { urban: v.urban });
    const rad = Math.hypot(b.w, b.d) / 2;
    if (Math.abs(x) > half - rad - 4 || Math.abs(z) > half - rad - 4) continue;
    let rd = Infinity, rot = (rnd() < 0.5 ? 0 : Math.PI / 2) + (rnd() - 0.5) * 0.3, near = null;
    for (const f of roads) { const d = distToPolyline(x, z, f.pts) - f.width / 2; if (d < rd) { rd = d; near = f; } }
    if (rd < rad * 0.75 + 2) continue;
    if (rivers.some((f) => distToPolyline(x, z, f.pts) < f.width / 2 + 7 + rad)) continue;
    if (waters.some((f) => pointInPoly(x, z, f.poly) || distToPolyline(x, z, [...f.poly, f.poly[0]]) < rad + 8)) continue;
    if (taken.some((h) => Math.hypot(h.x - x, h.z - z) < h.rad + rad + 1.5)) continue;
    if (near && rd < 16) rot = roadAngle(near.pts, x, z) + (rnd() < 0.5 ? 0 : Math.PI);
    const h = { x: r1(x), z: r1(z), rot: Math.round(rot * 100) / 100, w: b.w, d: b.d, floors: Math.max(1, b.floors), style: b.style, kind: b.kind, modern: b.modern, rad };
    taken.push(h); out.push(h);
  }
  return out;
}
function roadAngle(pts, x, z) {
  let best = Infinity, ang = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const d = distToPolyline(x, z, [pts[i], pts[i + 1]]);
    if (d < best) { best = d; ang = -Math.atan2(bz - az, bx - ax); }
  }
  return ang;
}

export function compileWorld(doc) {
  const features = [];
  const houses = [];
  const taken = doc.elements.filter((e) => e.type === 'building').map((b) => ({ x: b.x, z: b.z, rad: Math.hypot(b.w, b.d) / 2 }));
  for (const e of doc.elements) {
    switch (e.type) {
      case 'hill': features.push({ type: 'hill', x: e.x, z: e.z, r: e.r, h: e.h }); break;
      case 'flat': features.push({ type: 'flat', x: e.x, z: e.z, r: e.r, h: e.h }); break;
      case 'water': features.push({ type: 'water', poly: e.poly, depth: e.depth }); break;
      case 'river': features.push({ type: 'river', pts: e.pts, width: e.width, depth: e.depth }); break;
      case 'road':
        if (e.kind === 'road') features.push({ type: 'road', pts: e.pts, width: e.width });
        else features.push({ type: 'road', pts: e.pts, width: e.width, paved: false, rail: e.kind === 'rail' || undefined });
        break;
      case 'forest': features.push(e.poly ? { type: 'forest', poly: e.poly, kind: e.kind, density: e.density } : { type: 'forest', x: e.x, z: e.z, r: e.r, kind: e.kind, density: e.density }); break;
      case 'treeline': features.push({ type: 'treeline', pts: e.pts }); break;
      case 'field': features.push({ type: 'field', poly: e.poly, crop: e.crop, angle: e.angle }); break;
      case 'bridge': features.push({ type: 'causeway', pts: e.pts, width: e.width }); break;
      case 'building': houses.push({ x: e.x, z: e.z, rot: e.rot, w: e.w, d: e.d, floors: e.floors, style: 0, kind: e.kind }); break;
      case 'village':
        if (e.style && e.style !== 'simple') features.push({ type: 'village', x: e.x, z: e.z, r: e.r, houses: e.houses, urban: e.urban, useGenerator: true, genType: e.style, seed: seedOf(doc, e.id), era: doc.meta.era });
        else for (const h of villageHouses(doc, e, taken)) houses.push(h);
        break;
    }
  }
  for (const h of houses) features.push({ type: 'house', x: h.x, z: h.z, rot: h.rot, w: h.w, d: h.d, floors: h.floors, style: h.style, kind: h.kind });
  const M = doc.map;
  const map = { size: M.size, seed: M.seed, season: M.season, relief: M.relief, baseHeight: 3, scatterTrees: M.scatterTrees, night: M.night, features };
  const env = { season: M.season, night: M.night, sunElev: M.night ? 10 : 38 + (M.seed % 10), sunAzim: 140 + (M.seed % 80), fogDensity: FOG(M.size) };
  const world = { map, env, houses, doc };
  world.decorate = (g) => decorateWorld(g, world);
  return world;
}

// ---------- Ausschmückung nach game.load (Gebäudearten, Brücken, Bahngleise) ----------
let _mats = null;
function mats() {
  if (_mats) return _mats;
  _mats = {
    concrete: new THREE.MeshStandardMaterial({ color: 0x8d8c86, roughness: 0.9 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x5e5d58, roughness: 0.95 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x6f7377, roughness: 0.5, metalness: 0.6 }),
    tie: new THREE.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 1 }),
    rail: new THREE.MeshStandardMaterial({ color: 0x8f8f8f, roughness: 0.35, metalness: 0.8 }),
  };
  return _mats;
}
export function decorateWorld(g, world) {
  const doc = world.doc;
  // Gebäudearten: Das Gelände übernimmt Häuser ohne Art – passendes Modell nachträglich einsetzen
  const byPos = new Map(world.houses.map((h) => [`${h.x.toFixed(1)},${h.z.toFixed(1)}`, h]));
  for (const u of g.units) {
    if (u.type.key !== 'house' || !u.houseDef) continue;
    const spec = byPos.get(`${u.houseDef.x.toFixed(1)},${u.houseDef.z.toFixed(1)}`);
    if (!spec || !spec.kind) continue;
    if (u.root.userData.houseKind === spec.kind) continue; // Gelände kennt die Art bereits
    swapHouseModel(g, u, spec);
  }
  const grp = new THREE.Group();
  grp.name = 'editor-decor';
  const T = g.terrain, sea = T.seaLevel;
  const M = mats();
  for (const e of doc.elements) {
    if (e.type === 'bridge' && e.kind === 'bridge') {
      const [a, b] = e.pts, dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
      if (L < 1) continue;
      const bg = new THREE.Group();
      bg.position.set((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2);
      bg.rotation.y = -Math.atan2(dz, dx);
      const w = e.width;
      const deck = new THREE.Mesh(new THREE.BoxGeometry(L + 6, 0.45, w + 0.6), M.concrete);
      deck.position.y = sea + 0.78 - 0.22; deck.castShadow = deck.receiveShadow = true; bg.add(deck);
      for (const s of [-1, 1]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(L + 6, 0.12, 0.12), M.steel);
        rail.position.set(0, sea + 1.75, s * (w / 2 + 0.2)); bg.add(rail);
        const n = Math.max(2, Math.round((L + 6) / 2.5));
        const post = new THREE.BoxGeometry(0.12, 1.0, 0.12);
        const posts = new THREE.InstancedMesh(post, M.steel, n + 1);
        const m4 = new THREE.Matrix4();
        for (let i = 0; i <= n; i++) { m4.makeTranslation(-(L + 6) / 2 + (i / n) * (L + 6), sea + 1.25, s * (w / 2 + 0.2)); posts.setMatrixAt(i, m4); }
        bg.add(posts);
      }
      const np = Math.max(1, Math.floor(L / 9));
      for (let i = 1; i <= np; i++) {
        const x = -L / 2 + (i / (np + 1)) * L;
        for (const s of [-1, 1]) {
          const p = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.65, 6, 8), M.dark);
          p.position.set(x, sea + 0.4 - 3, s * w * 0.28); p.castShadow = true; bg.add(p);
        }
      }
      grp.add(bg);
    }
    if (e.type === 'road' && e.kind === 'rail') grp.add(railTrack(T, e.pts));
  }
  grp.traverse((o) => { o.userData.editorDecor = true; o.raycast = () => {}; });
  if (grp.children.length) g.world.add(grp);
  return grp;
}
function swapHouseModel(g, u, spec) {
  const def = u.houseDef;
  def.kind = spec.kind;
  if (spec.modern !== undefined) def.modern = spec.modern;
  const h = houseModel(def);
  const vis = u.root.visible;
  g.scene.remove(u.root);
  u.model = { root: h.root, height: h.height };
  u.root = h.root;
  u.root.userData.unit = u;
  u.root.traverse((o) => { o.userData.unit = u; });
  g.scene.add(u.root);
  u.place(0);
  u.root.visible = vis;
  u.root.matrixAutoUpdate = false;
  u.root.updateMatrix();
}
function railTrack(T, pts) {
  const M = mats();
  const samples = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.floor(L / 1.25));
    const ang = -Math.atan2(bz - az, bx - ax);
    for (let k = 0; k < n; k++) { const t = k / n; samples.push([ax + (bx - ax) * t, az + (bz - az) * t, ang]); }
  }
  const g = new THREE.Group();
  const ties = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.16, 2.5), M.tie, samples.length);
  const railN = samples.length * 2;
  const rails = new THREE.InstancedMesh(new THREE.BoxGeometry(1.3, 0.14, 0.09), M.rail, railN);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), s1 = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
  samples.forEach(([x, z, ang], i) => {
    const y = T.surface(x, z) + 0.08;
    q.setFromAxisAngle(up, ang);
    m4.compose(p.set(x, y, z), q, s1); ties.setMatrixAt(i, m4);
    const sx = Math.sin(ang), cx = Math.cos(ang);
    for (const s of [-1, 1]) {
      // senkrecht zur Fahrtrichtung versetzt (lokale z-Achse)
      const ox = sx * s * 0.72, oz = cx * s * 0.72;
      const yy = T.surface(x + ox, z + oz) + 0.2;
      m4.compose(p.set(x + ox, Math.max(yy, y + 0.12), z + oz), q, s1); rails.setMatrixAt(i * 2 + (s > 0 ? 1 : 0), m4);
    }
  });
  ties.receiveShadow = true; rails.castShadow = true;
  g.add(ties, rails);
  return g;
}

// ---------- Missionsobjekt ----------
function aiFor(u, doc, t) {
  const type = UNIT_TYPES[u.type];
  if (!type || type.structure) return u.ai === 'hold' || type?.structure ? { mode: 'hold' } : null;
  if (type.kamikaze) return { mode: 'hunt', huntRadius: 260, points: [[t.x, t.z]] };
  if (u.ai === 'hold') return { mode: 'hold' };
  if (u.ai === 'attack') return { mode: 'attackMove', points: [[t.x, t.z]], after: 'guard', aggressive: true, aggroRadius: 34 };
  if (type.air) return { mode: 'loiter', center: [u.x, u.z], radius: 40 };
  return { mode: 'guard', radius: 35 };
}
function teamCenter(doc, team) {
  const z = doc.zones.find((q) => q.team === team);
  if (z) return { x: z.x, z: z.z };
  const us = doc.units.filter((u) => u.team === team);
  if (us.length) return { x: us.reduce((s, u) => s + u.x, 0) / us.length, z: us.reduce((s, u) => s + u.z, 0) / us.length };
  return { x: 0, z: 0 };
}
function camFor(doc, team, dist) {
  const c = teamCenter(doc, team);
  const yaw = Math.hypot(c.x, c.z) > 10 ? Math.atan2(c.x, c.z) : 0;
  return { x: c.x - Math.sin(yaw) * 12, z: c.z - Math.cos(yaw) * 12, dist, yaw };
}
const isCombatEnemy = (u) => u.alive && !u.type.kamikaze && !u.type.build && (!u.type.structure || (u.weapons && u.weapons.length > 0));

export function objectiveText(o) {
  if (o.kind === 'hold') return `Gebiet halten: ${o.minutes} min`;
  if (o.kind === 'timelimit') return `Zeitlimit: ${o.minutes} min`;
  return OBJECTIVE_KINDS[o.kind];
}

// opts: { fromEditor, source }
export function compileMission(docIn, opts = {}) {
  const doc = sanitizeMap(docIn).map;
  const world = compileWorld(doc);
  const P = doc.player, E = other(P);
  const json = JSON.stringify(doc);
  const id = 'custom_' + hashStr(json);
  const objs = doc.objectives.length ? doc.objectives : [{ id: 'o0', kind: 'annihilate' }];
  const timeOnly = objs.every((o) => o.kind === 'timelimit');
  const countBy = (team) => {
    const c = {};
    for (const u of doc.units) if (u.team === team) c[u.type] = (c[u.type] || 0) + 1;
    return Object.entries(c).map(([k, n]) => `${n}× ${UNIT_TYPES[k]?.name || k}`);
  };
  const brief = doc.briefing.trim() || doc.meta.description.trim() || 'Keine weiteren Informationen. Erfüllt die Einsatzziele.';
  const mission = {
    id, custom: true, fromEditor: !!opts.fromEditor, source: opts.source || null, doc,
    // title/place/date werden per textContent angezeigt (Briefing, Ladeanzeige); HTML-Felder unten sind escaped
    title: doc.meta.title,
    place: `Eigene Karte${doc.meta.author ? ' · von ' + doc.meta.author : ''}`,
    date: doc.meta.era === 'ww2' ? '1939–1945' : doc.meta.era === 'afghan' ? 'Afghanistan' : 'Gegenwart',
    briefing: brief.split(/\n{2,}/).slice(0, 12).map((p, i) => ({ s: i === 0 ? 'Lage' : '…', t: escapeHtml(p).replace(/\n/g, '<br>') })),
    objectivesPreview: objs.map((o) => escapeHtml(objectiveText(o) + (o.kind === 'timelimit' && !timeOnly ? ' (danach gescheitert)' : o.kind === 'timelimit' ? ' – so lange durchhalten' : ''))),
    forces: countBy(P).map(escapeHtml),
    map: world.map, env: world.env,
    camera: camFor(doc, P, Math.min(130, 70 + doc.map.size * 0.12)),
    players: P === 'RU' ? [{ id: 0, name: 'Spieler', team: 'RU', color: '#5dff8a', local: true }, { id: 1, name: 'KI', team: 'UA', color: '#4da3ff', ai: true }] : undefined,
    noDefaultDefeat: true,
    markers: [],
    setup(g) {
      world.decorate(g);
      this.markers = [];
      this.rt = { hold: {}, checkT: 0, lostT: 0 };
      const tgt = { [P]: teamCenter(doc, E), [E]: teamCenter(doc, P) };
      for (const p of doc.points) {
        const u = g.spawn('cp_' + p.kind, 'N', p.x, p.z, { invulnerable: true, noBlock: p.kind !== 'zeppelin' && p.kind !== 'aerostat' });
        u.name = escapeHtml(p.name); // HUD zeigt Namen per innerHTML
        this.markers.push({ x: p.x, z: p.z, r: p.radius, label: escapeHtml(p.name), color: '#8c9096' });
      }
      for (const u of doc.units) {
        const opt = { heading: u.heading, tags: u.target ? ['target'] : [] };
        if (u.team === E) opt.ai = aiFor(u, doc, tgt[E]);
        g.spawn(u.type, u.team, u.x, u.z, opt);
      }
      for (const o of objs) {
        g.addObjective(o.id, objectiveText(o));
        if (o.kind === 'hold') { this.markers.push({ x: o.x, z: o.z, r: o.r, label: 'Halten', color: '#5db8ff' }); this.rt.hold[o.id] = 0; }
        if (o.kind === 'timelimit') {
          g.setCountdown(o.minutes * 60, 'Zeitlimit', () => {
            if (g.ended) return;
            if (timeOnly) { g.setObjective(o.id, 'done'); g.win('Durchgehalten – das Zeitlimit ist erreicht.'); }
            else { g.setObjective(o.id, 'failed'); g.lose('Die Zeit ist abgelaufen.'); }
          });
        }
      }
      g.later(1, () => g.say('Stab', escapeHtml(`${doc.meta.title}: ${objs.filter((o) => o.kind !== 'timelimit').map(objectiveText).join(' · ') || 'Durchhalten!'}`), 6)); // HUD nutzt innerHTML
    },
    update(g, dt) {
      const rt = this.rt;
      if (!rt || g.ended) return;
      for (const o of objs) {
        if (g.objState(o.id) !== 'open' || o.kind !== 'hold') continue;
        const mine = g.units.some((u) => u.alive && u.side === P && !u.type.air && !u.type.structure && Math.hypot(u.pos.x - o.x, u.pos.z - o.z) < o.r);
        const foe = g.units.some((u) => u.alive && u.side === E && !u.type.air && !u.type.structure && Math.hypot(u.pos.x - o.x, u.pos.z - o.z) < o.r);
        if (mine && !foe) {
          rt.hold[o.id] += dt;
          const left = Math.max(0, o.minutes * 60 - rt.hold[o.id]);
          const ob = g.objectives.find((q) => q.id === o.id);
          const txt = `Gebiet halten: noch ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
          if (ob && ob.text !== txt) { ob.text = txt; g.emit('objectives'); }
          if (left <= 0) { g.setObjective(o.id, 'done'); g.say('Stab', 'Gebiet gehalten!', 4); }
        }
      }
      rt.checkT -= dt;
      if (rt.checkT > 0) return;
      rt.checkT = 0.5;
      for (const o of objs) {
        if (g.objState(o.id) !== 'open') continue;
        if (o.kind === 'annihilate' && !g.units.some((u) => u.side === E && isCombatEnemy(u))) { g.setObjective(o.id, 'done'); }
        if (o.kind === 'destroy' && g.countTag('target') === 0) { g.setObjective(o.id, 'done'); g.say('Stab', 'Alle Zielobjekte zerstört.', 4); }
      }
      const main = objs.filter((o) => o.kind !== 'timelimit');
      if (main.length && main.every((o) => g.objState(o.id) === 'done')) {
        for (const o of objs) if (o.kind === 'timelimit' && g.objState(o.id) === 'open') g.setObjective(o.id, 'done');
        g.countdown = null;
        g.win('Alle Einsatzziele erfüllt.');
        return;
      }
      // Niederlage: keine kampffähigen eigenen Einheiten mehr
      if (g.time > 3 && !g.units.some((u) => u.alive && u.side === P && !u.type.structure && !u.type.kamikaze)) g.lose('Alle eigenen Einheiten sind gefallen.');
    },
    victory: '',
  };
  return mission;
}

// Editor-Vorschau: gleiche Welt, Einheiten statisch, kein Nebel, keine Ziele
export function compilePreview(doc, cam) {
  const world = compileWorld(doc);
  const map = { ...world.map, noFog: true };
  return {
    id: 'editor_preview', editorPreview: true, title: doc.meta.title, map, env: world.env,
    camera: cam || { x: 0, z: 0, dist: Math.round(doc.map.size * 0.6), yaw: 0 },
    noDefaultDefeat: true, markers: [],
    world,
    setup(g) { world.decorate(g); },
    update() {},
  };
}

// Für js/skirmish/skirmish.js: wie generateSkirmishMap(), aber aus einer eigenen Karte
export function compileSkirmishGen(docIn) {
  const doc = sanitizeMap(docIn).map;
  const world = compileWorld(doc);
  const S = doc.map.size;
  const spawns = { UA: [], RU: [] };
  for (const z of doc.zones) spawns[z.team].push({ x: z.x, z: z.z });
  for (const t of ['UA', 'RU']) if (!spawns[t].length) spawns[t].push({ x: 0, z: t === 'UA' ? S / 2 - 30 : -S / 2 + 30 });
  const dist = Math.min(155, 80 + S * 0.12);
  const cam = (t) => { const c = spawns[t][0]; const yaw = Math.hypot(c.x, c.z) > 10 ? Math.atan2(c.x, c.z) : (t === 'UA' ? 0 : Math.PI); return { x: c.x, z: c.z, dist, yaw }; };
  const capturePoints = doc.points.map((p, i) => ({ id: `cp${i + 1}`, x: p.x, z: p.z, kind: p.kind, name: escapeHtml(p.name), value: p.value, radius: p.radius }));
  return {
    id: 'skirmish', preset: 'custom', custom: true,
    // Gefechtstitel landen in innerHTML (Pause-Info) → escaped
    title: escapeHtml(doc.meta.title), place: escapeHtml(`Eigene Karte${doc.meta.author ? ' · von ' + doc.meta.author : ''}`),
    recommendedSize: S <= 260 ? 'small' : S <= 380 ? 'medium' : 'large',
    map: world.map, env: world.env, spawns, capturePoints,
    camera: { UA: cam('UA'), RU: cam('RU') },
    description: escapeHtml(doc.meta.description || `Eigene Karte (${S} m)`) + ` – ${capturePoints.length} Eroberungspunkte.`,
    meta: { features: world.map.features.length, players: Math.max(spawns.UA.length, spawns.RU.length), custom: true },
    decorate: (g) => world.decorate(g),
  };
}
export { CP_KINDS, ERA_SET };
