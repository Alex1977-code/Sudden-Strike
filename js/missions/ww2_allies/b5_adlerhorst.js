// B5 – Kommandounternehmen „Adlerhorst“ (Frühjahr 1945, FIKTIV): Ein alliierter Kommandotrupp dringt nachts in eine Gebirgsfestung ein,
// in der Raketenforschung betrieben wird: Radar und Flak ausschalten, Unterlagen sichern, Raketenprüfstand sprengen, Häftlinge der
// Zwangsarbeit befreien und mit ihnen entkommen. Karte: Hochgebirge, Schnee, Nacht. Die Festung ist frei erfunden.
// Eigene Minimal-Bauarten (Radar, Prüfstand, Häftlinge) sind hier im Missionsordner registriert (registerModel / registerUnitTypes).
import { MODEL_KIT, registerModel } from '../../game/models.js';
import { registerUnitTypes, UNIT_TYPES } from '../../game/unitTypes.js';
import '../../eras/ww2/units.js';
import { infModel } from '../../eras/ww2/mod_inf.js';
import { FAC } from '../../eras/ww2/kit.js';
import { bldg, faceTo, road, forest, hill, flat } from '../../maps/places/_kit.js';
import { uk, setText, mmss, alive, fort } from './_h.js';
import { ground } from './_hb.js';

const { THREE, box, cyl, add, cylG } = MODEL_KIT;
const PI = Math.PI;
const mat = (c, r = 0.85, m = 0.1) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
let MATS = null;
const mats = () => MATS || (MATS = { conc: mat(0x8a8984, 0.95, 0), concD: mat(0x5c5b57, 0.95, 0), steel: mat(0x484b4d, 0.5, 0.6), white: mat(0xd9d9d2, 0.7, 0.1), grey: mat(0x7d8286, 0.6, 0.4), paint: mat(0x6c6a52, 0.8, 0.1), soot: mat(0x1d1c1a, 1, 0) });

// ---------------- Eigene Modelle (minimal) ----------------
registerModel('ww2_adler_radar', () => {
  const m = mats(), g = new THREE.Group();
  box(g, 5, 0.5, 5, m.conc, 0, 0.25, 0);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cyl(g, 0.12, 0.2, 7, m.steel, sx * 1.2, 3.6, sz * 1.2, sz * 0.05, 0, -sx * 0.05, 5);
  for (const y of [2, 4, 6]) box(g, 2.8, 0.1, 2.8, m.steel, 0, y, 0);
  box(g, 3, 2, 3, m.paint, 0, 7.6, 0);
  const dish = new THREE.Group(); dish.position.set(0, 9.4, 0); g.add(dish);
  box(dish, 5.4, 3.6, 0.35, m.grey, 0, 0, 0.3); box(dish, 5.0, 3.2, 0.06, m.steel, 0, 0, 0.55);
  box(dish, 0.12, 3.6, 0.12, m.steel, 0, 0, 1.4); box(dish, 0.5, 0.5, 0.4, m.steel, 0, 0, 1.9);
  cyl(g, 0.4, 0.4, 1.4, m.steel, 0, 8.6, 0, 0, 0, 0, 8);
  return { root: g, height: 11, radar: dish };
});
registerModel('ww2_adler_stand', () => {
  const m = mats(), g = new THREE.Group();
  box(g, 22, 0.8, 18, m.conc, 0, 0.4, 0); box(g, 8, 0.2, 8, m.soot, 0, 0.9, 0);   // Betonplatte, Brandfleck
  box(g, 22, 3, 1.2, m.concD, 0, 1.5, -9.4); box(g, 1.2, 3, 18, m.concD, -11.4, 1.5, 0);   // Schutzwälle
  for (const s of [-1, 1]) { box(g, 1.2, 15, 1.2, m.steel, s * 3.2, 8, 0); for (let y = 2; y < 15; y += 2.2) box(g, 5.8, 0.1, 0.1, m.steel, s * 3.2, y, 0.5); }
  box(g, 7.6, 0.8, 1.2, m.steel, 0, 15.2, 0);
  // liegende Rakete auf dem Aufrichter (grau-weiß, ohne Kennzeichen)
  cyl(g, 0.8, 0.85, 8.5, m.white, 0, 6.8, -0.2, 0, 0, 0, 12);
  cyl(g, 0.01, 0.8, 3.4, m.white, 0, 12.2, -0.2, 0, 0, 0, 12);
  cyl(g, 0.85, 0.7, 1.6, m.grey, 0, 1.9, -0.2, 0, 0, 0, 12);
  for (let k = 0; k < 4; k++) { const a = k * PI / 2; box(g, 0.12, 2.4, 1.8, m.grey, Math.sin(a) * 1.2, 3.3, Math.cos(a) * 1.2 - 0.2, 0, a, 0); }
  box(g, 3, 2.2, 2.6, m.paint, 7.5, 1.9, 5.5); cyl(g, 0.3, 0.3, 3, m.steel, 7.5, 3.6, 5.5, 0, 0, 0, 6);   // Messbunker / Rohrleitung
  return { root: g, height: 16 };
});
registerModel('ww2_adler_prisoner', (side, type, ctx) => {
  const r = infModel('US', { weapon: 'none' })(side, type, ctx), m = mat(0x7a808a, 0.95, 0), cap = mat(0x4e535c, 0.95, 0);
  const f = FAC.US;
  r.root.traverse((o) => { if (!o.isMesh || !o.material || !o.material.color) return; const c = o.material.color.getHex(); if (c === f.uni || c === f.uniDark) o.material = m; else if (c === f.helm) o.material = cap; });
  return r;
});
registerUnitTypes({
  ww2_adler_radar: { era: 'ww2', name: 'Funkmessgerät (Radar)', icon: '📡', cls: 'struct', model: 'ww2_adler_radar', armor: 'struct', sight: 0, weapons: [], noAutoTarget: true, hp: 160, radius: 3.2, desc: 'Ortungsgerät der Festung: Ohne Radar bleibt der Alarm klein.' },
  ww2_adler_stand: { era: 'ww2', name: 'Raketenprüfstand', icon: '🚀', cls: 'struct', model: 'ww2_adler_stand', armor: 'struct', sight: 0, weapons: [], noAutoTarget: true, hp: 700, radius: 9, desc: 'Prüfstand für Flüssigkeitsraketen – mit Sprengladung zu zerstören.' },
  ww2_adler_prisoner: { ...UNIT_TYPES.ww2_uk_rifle, name: 'Befreite Häftlinge', icon: '🕊️', model: 'ww2_adler_prisoner', weapons: [], hp: 45, speed: 3.4, sight: 22, desc: 'Zwangsarbeiter aus dem Lager – unbewaffnet, geschwächt. Bringt sie in Sicherheit.' },
});

const START = { x: -214, z: 176 };                  // Absetzpunkt = Ausgang
const EXIT = { x: -214, z: 176, r: 30 };
const GATE = { x: 66, z: -24 };
const RAD = { x: 150, z: -128 };
const STAND = { x: 168, z: -62 };
const ARCH = { x: 34, z: -66, r: 10 };
const CAMP = { x: -10, z: -112, r: 26 };
const LIMIT = 1620;                                 // s Zeitlimit
const NEED_P = 8;                                   // Befreite, die den Ausgang erreichen müssen

const feats = [
  { type: 'mountain', x: -170, z: -140, r: 115, h: 72, snow: true }, { type: 'mountain', x: 60, z: -255, r: 115, h: 88, snow: true },
  { type: 'mountain', x: 255, z: -165, r: 115, h: 78, snow: true }, { type: 'mountain', x: 275, z: 75, r: 100, h: 62, snow: true },
  { type: 'mountain', x: -265, z: 10, r: 85, h: 56, snow: true }, { type: 'mountain', x: 115, z: 255, r: 100, h: 50, snow: true },
  flat(-214, 176, 48, 8), flat(100, -72, 95, 12), flat(-10, -112, 50, 12), flat(-40, 30, 40, 10), flat(-110, 100, 36, 9),
  hill(RAD.x, RAD.z + 6, 38, 6),
  road([[-214, 176], [-150, 128], [-110, 100], [-70, 62], [-40, 30], [-4, 8], [40, -12], [GATE.x, GATE.z]], 4, false, { name: 'Passweg' }),
  road([[GATE.x, GATE.z], [100, -44], [120, -66], [150, -66]], 5, false), road([[GATE.x, GATE.z], [40, -66], [10, -100], [-10, -112]], 4, false),
  road([[100, -44], [112, -96], [118, -150]], 5, false), road([[RAD.x, RAD.z], [140, -100], [120, -80]], 3, false),
  forest([[-290, 60], [-190, 60], [-200, 120], [-290, 130]], 'pine', 0.05), forest([[-290, 230], [-170, 250], [-160, 290], [-290, 290]], 'pine', 0.05), forest([[-80, 150], [-20, 90], [30, 130], [-10, 220], [-80, 220]], 'pine', 0.05),
  forest([[-130, -20], [-70, -40], [-50, 0], [-90, 40], [-130, 20]], 'pine', 0.05), forest([[190, -20], [260, -10], [262, 70], [200, 80]], 'pine', 0.05),
  forest([[-60, -150], [-30, -170], [10, -160], [8, -150]], 'pine', 0.045),
  // Festungsbauten (Gebirgsfestung, frei erfunden)
  bldg('casemate', 54, -34, 14, 9, faceTo(54, -34, -20, 20), 1, 'Wachbunker am Tor'),
  bldg('casemate', 136, -30, 12, 9, faceTo(136, -30, 90, 40), 1, 'Flankenbunker'),
  bldg('panzerkuppel', 82, -44, 7, 7, 0, 1, 'Panzerkuppel'), bldg('panzerkuppel', 120, -44, 7, 7, 0, 1),
  bldg('tunnel_portal', 118, -158, 16, 14, faceTo(118, -158, 118, -100), 2, 'Stolleneingang Nord'),
  bldg('tunnel_portal', 212, -96, 14, 12, faceTo(212, -96, 150, -80), 2, 'Stolleneingang Ost'),
  bldg('hangar', 112, -80, 30, 18, 0, 2, 'Montagehalle'),
  bldg('fachwerk', ARCH.x, ARCH.z - 6, 18, 11, faceTo(ARCH.x, ARCH.z - 6, 60, 10), 2, 'Verwaltung (Archiv)'),
  bldg('harbour_shed', -26, -128, 20, 8, 0, 1, 'Lagerbaracke'), bldg('harbour_shed', 6, -128, 20, 8, 0, 1), bldg('harbour_shed', -26, -96, 20, 8, Math.PI, 1), bldg('harbour_shed', 6, -96, 20, 8, Math.PI, 1),
  bldg('norman_stone', 92, -18, 12, 8, 0, 2, 'Wachquartier'),
];

const mission = {
  id: 'b5', title: 'Adlerhorst', place: 'Gebirgsfestung in den Alpen (fiktiv)', date: 'Frühjahr 1945 · fiktives Szenario',
  era: 'ww2', difficulty: 3, fictional: true,
  summary: 'Fiktives Kommandounternehmen: Ein Trupp dringt nachts in eine Gebirgsfestung mit Raketenforschung ein, sprengt den Prüfstand, sichert Unterlagen und befreit Häftlinge der Zwangsarbeit.',
  briefing: [
    { s: 'Hinweis', t: 'Diese Mission ist frei erfunden. Die Festung „Adlerhorst“ hat es so nicht gegeben. Sie steht für ein reales Verbrechen: Die V2-Rakete wurde in unterirdischen Anlagen wie dem Mittelwerk bei Nordhausen von Häftlingen des Konzentrationslagers Mittelbau-Dora gebaut, unter mörderischen Bedingungen. Bei der Herstellung der Waffe starben mehr Menschen als durch ihren Einsatz.' },
    { s: 'Major Fenwick', t: 'Die Aufklärung meldet eine Raketenforschungsanlage im Fels, bewacht, mit Radar und Flak auf dem Grat. Unser Trupp wird nachts abgesetzt. Zuerst Wachen umgehen – leise –, dann Radar und Flak, damit der Alarm klein bleibt.' },
    { s: 'Major Fenwick', t: 'Drei Aufgaben im Inneren: Die Unterlagen im Verwaltungsbau sichern, den Raketenprüfstand sprengen – Pionier hin, kein Wachmann in der Nähe – und die Häftlinge im Lager befreien. Das Lager hat Vorrang vor allem anderen: Es sind Menschen, die hier zur Arbeit gezwungen werden, ausgehungert und unbewaffnet. Bringt sie zum Absetzpunkt zurück.' },
    { s: 'Sergeant Dunn', t: 'Wir haben nur Handwaffen und Ladungen. Rauch deckt unseren Rückweg. Wenn der Alarm losgeht, kommen Verstärkungen aus der Kaserne – dann zählt jede Minute. Kein Held spielen: Wir wollen alle durchbringen, auch die, die wir befreien.' },
  ],
  objectivesPreview: ['Radar und beide Flak ausschalten', 'Unterlagen im Verwaltungsbau sichern', 'Raketenprüfstand sprengen', 'Häftlinge befreien und mit ihnen zum Absetzpunkt entkommen (mind. 8)', 'Optional: Unentdeckt bleiben (kein Alarm)', 'Optional: Kein Häftling kommt zu Schaden'],
  forces: ['6× Sten-Schütze (Kommando)', '4× Rifleman', '2× Scharfschütze', '3× Bren-Gunner', '3× Sapper', '1× Offizier', '2× Sanitäter', 'Fähigkeit: Nebel'],
  map: { size: 520, seed: 1945, season: 'winter', palette: 'winter', terrainStyle: 'mountains', relief: 11, baseHeight: 8, seaLevel: 0, scatterTrees: 22, features: feats },
  env: { season: 'winter', sunElev: 5, sunAzim: 200, fogDensity: 0.0034 },
  weather: { type: 'snow', intensity: 0.35 }, time: { start: '23:10', speed: 3 },
  camera: { x: -200, z: 150, dist: 85, yaw: 0.5 },
  markers: [
    { x: EXIT.x, z: EXIT.z, r: EXIT.r, label: 'Absetzpunkt / Ausgang', color: '#ffe9a8' },
    { x: RAD.x, z: RAD.z, r: 14, label: 'Radar und Flak', color: '#ff6b6b' },
    { x: ARCH.x, z: ARCH.z, r: 12, label: 'Archiv', color: '#5db8ff' },
    { x: STAND.x, z: STAND.z, r: 16, label: 'Raketenprüfstand', color: '#ff6b6b' },
    { x: CAMP.x, z: CAMP.z, r: 18, label: 'Häftlingslager', color: '#7ee0a0' },
  ],
  abilities: [{ id: 'smoke', charges: 3 }],

  setup(g) {
    this.t0 = g.time; this.alarm = false; this.engaged = 0; this.docsT = 0; this.docs = false; this.chargeT = 0; this.charge = null; this.standDone = false;
    this.freed = false; this.campT = 0; this.wavesSent = 0; this.pLost = 0; this.escaped = new Set(); this.freeT = 0;
    // Kommandotrupp
    this.team = [
      ...g.spawnGroup([[uk.smg, 6], [uk.rifle, 4], [uk.sniper, 2], [uk.lmg, 3]], 'UA', START.x, START.z, { spacing: 3.2, cols: 6, heading: 0.9, tags: ['team'] }),
      ...g.spawnGroup([[uk.engineer, 3], [uk.officer, 1], [uk.medic, 2]], 'UA', START.x - 8, START.z + 6, { spacing: 3.4, cols: 3, heading: 0.9, tags: ['team'] }),
    ];
    // Festung: Radar auf dem Grat, Flak, Prüfstand
    g.spawn('ww2_adler_radar', 'RU', RAD.x, RAD.z, { tags: ['radar'] });
    g.spawn('ww2_flak37', 'RU', RAD.x - 20, RAD.z + 8, { hpMul: 0.6, heading: PI, ai: { mode: 'hold' }, tags: ['flak', 'gar'] });
    g.spawn('ww2_flak37', 'RU', RAD.x + 22, RAD.z + 6, { hpMul: 0.6, heading: PI, ai: { mode: 'hold' }, tags: ['flak', 'gar'] });
    g.spawnGroup([['ww2_de_rifle', 2], ['ww2_de_mg42', 1]], 'RU', RAD.x, RAD.z + 18, { spacing: 3.4, cols: 4, ai: { mode: 'guard', radius: 20 }, tags: ['gar', 'radarwache'] });
    g.spawn('ww2_adler_stand', 'RU', STAND.x, STAND.z, { tags: ['stand'] });
    g.spawnGroup([['ww2_de_rifle', 2], ['ww2_de_mg42', 1]], 'RU', STAND.x - 18, STAND.z + 14, { spacing: 3.4, cols: 4, ai: { mode: 'guard', radius: 22 }, tags: ['gar', 'stand'] });
    // Tor und Wachquartier (Wachen schlafen bzw. stehen, KI hält Stellung)
    fort(g, 'ww2_mgnest', 'RU', GATE.x + 6, GATE.z + 10, { heading: -2.4, tags: ['gar', 'gate'] }); fort(g, 'ww2_mgnest', 'RU', GATE.x - 4, GATE.z - 12, { heading: -2.4, tags: ['gar', 'gate'] });
    g.spawnGroup([['ww2_de_rifle', 2]], 'RU', GATE.x + 10, GATE.z - 2, { spacing: 3.4, cols: 4, ai: { mode: 'guard', radius: 18 }, tags: ['gar', 'gate'] });
    g.spawnGroup([['ww2_de_rifle', 2]], 'RU', -24, 8, { spacing: 3.4, cols: 3, ai: { mode: 'guard', radius: 14 }, tags: ['gar', 'patrol'] });
    g.spawnGroup([['ww2_de_rifle', 2]], 'RU', -98, 80, { spacing: 3.4, cols: 3, ai: { mode: 'guard', radius: 14 }, tags: ['gar', 'patrol'] });
    g.spawnGroup([['ww2_de_rifle', 2], ['ww2_de_mp40', 1]], 'RU', 30, -50, { spacing: 3.4, cols: 4, ai: { mode: 'guard', radius: 16 }, tags: ['gar', 'arch'] });
    g.spawnGroup([['ww2_de_rifle', 2]], 'RU', 96, -36, { spacing: 3.4, cols: 3, ai: { mode: 'guard', radius: 18 }, tags: ['gar', 'barracks'] });
    // Häftlingslager: Wachen, Draht, Häftlinge (unbewaffnet, bis zur Befreiung festgesetzt)
    g.spawnGroup([['ww2_de_rifle', 3], ['ww2_de_mp40', 1]], 'RU', CAMP.x, CAMP.z + 24, { spacing: 3.6, cols: 3, ai: { mode: 'guard', radius: 22 }, tags: ['gar', 'camp'] });
    fort(g, 'ww2_mgnest', 'RU', CAMP.x - 22, CAMP.z + 28, { heading: PI, tags: ['gar', 'camp'] });
    for (let k = -4; k <= 4; k++) { fort(g, 'ww2_barbedwire', 'RU', CAMP.x + k * 6, CAMP.z + 14, { tags: ['wire'] }); }
    this.pris = g.spawnGroup([['ww2_adler_prisoner', 14]], 'UA', CAMP.x, CAMP.z, { spacing: 3.2, cols: 5, heading: 0, tags: ['pris'] });
    for (const u of this.pris) { u.immobilized = true; u.holdFire = true; }
    g.addObjective('ofa', 'Radar und beide Flak ausschalten (3 Ziele)');
    g.addObjective('docs', 'Unterlagen im Verwaltungsbau sichern');
    g.addObjective('stand', 'Raketenprüfstand sprengen (Pionier mit Ladung)');
    g.addObjective('free', 'Häftlinge befreien (Wachen im Lager ausschalten, Tor öffnen)');
    g.addObjective('escape', `Mit mindestens ${NEED_P} Befreiten zum Absetzpunkt entkommen`);
    g.addObjective('quiet', 'Unentdeckt bleiben (kein Alarm)', { optional: true });
    g.addObjective('safe', 'Kein Häftling kommt zu Schaden', { optional: true });
    g.later(4, () => g.say('Fenwick', 'Absetzpunkt erreicht. Dunkelheit hält bis zum Morgen. Wachen umgehen – Scharfschützen räumen Einzelposten.', 6));
    g.later(30, () => g.say('Dunn', 'Das Lager liegt nördlich des Passwegs, die Prüfhalle und der Stand im Osten. Radar und Flak sitzen auf dem Grat.', 6));
  },
  raiseAlarm(g, why) {
    if (this.alarm) return;
    this.alarm = true; g.audio.siren?.(); g.alert('⚠ ALARM in der Festung!', 5);
    g.say('Dunn', why || 'Wir sind entdeckt! Sirenen in der Anlage – Verstärkung ist unterwegs!', 5);
    g.setObjective('quiet', 'failed');
    const radar = g.units.some((u) => u.alive && u.tags.has('radar'));
    const send = (d, list) => g.later(d, () => {
      if (g.ended) return; this.wavesSent++;
      const c = alive(g, 'UA', (u) => u.tags.has('team'));
      const tgt = c.length ? [c.reduce((s, u) => s + u.pos.x, 0) / c.length, c.reduce((s, u) => s + u.pos.z, 0) / c.length] : [60, -20];
      g.spawnGroup(list, 'RU', 100, -32, { spacing: 4, cols: 5, ai: { mode: 'attackMove', points: [[GATE.x, GATE.z], tgt], aggressive: true, aggroRadius: 60, after: 'guard' }, tags: ['react'] });
      g.alert('⚠ Verstärkung aus der Kaserne!', 3);
    });
    send(8, [['ww2_de_rifle', 6], ['ww2_de_mg42', 1], ['ww2_de_mp40', 1]]);
    send(80, [['ww2_de_rifle', 6], ['ww2_de_mp40', 2], ['ww2_de_mg42', 1]]);
    if (radar) { send(150, [['ww2_sdkfz251', 1], ['ww2_de_rifle', 6], ['ww2_de_mg42', 1]]); send(240, [['ww2_de_rifle', 7], ['ww2_de_mp40', 2], ['ww2_de_panzer', 1]]); }
    else g.say('Dunn', 'Das Radar ist aus – sie wissen weniger über uns, das Ganze bleibt kleiner.', 4);
  },
  update(g, dt) {
    if (g.ended) return;
    const t = g.time - this.t0;
    const team = alive(g, 'UA', (u) => u.tags.has('team'));
    if (team.length === 0) { g.lose('Der Kommandotrupp ist aufgerieben. Das Unternehmen ist gescheitert.'); return; }
    // Alarm: Wachen, die Ziele bekämpfen, summieren Zeit; viele auf einmal lösen den Alarm sofort aus
    if (!this.alarm) {
      let eng = 0;
      for (const u of g.units) if (u.alive && u.side === 'RU' && u.type.infantry && u.weapons.some((w) => w.target && w.target.alive && w.target.side === 'UA')) eng++;
      this.engaged += eng * dt;
      if (eng >= 5 || this.engaged > 70) this.raiseAlarm(g);
    }
    // Radar & Flak
    const left = g.units.filter((u) => u.alive && (u.tags.has('radar') || u.tags.has('flak'))).length;
    setText(g, 'ofa', `Radar und beide Flak ausschalten (${3 - Math.min(3, left)}/3)`);
    if (left === 0 && g.objState('ofa') === 'open') { g.setObjective('ofa', 'done'); g.say('Fenwick', 'Radar und Flak sind aus – keine Ortung mehr, kein Luftabwehrfeuer.', 5); }
    // Unterlagen
    if (!this.docs) {
      const foes = ground(g, 'RU', ARCH.x, ARCH.z, 22).length, own = ground(g, 'UA', ARCH.x, ARCH.z, ARCH.r).filter((u) => u.tags.has('team')).length;
      if (own > 0 && foes === 0) { this.docsT += dt; if (this.docsT >= 8) { this.docs = true; g.setObjective('docs', 'done'); g.say('Fenwick', 'Unterlagen gesichert: Pläne, Listen, Namen. Das wird später gebraucht – für die Aufklärung dieser Verbrechen.', 6); } } else this.docsT = Math.max(0, this.docsT - dt);
    }
    // Prüfstand: Sprengladung durch Pioniere
    const stand = g.units.find((u) => u.tags.has('stand') && u.type.structure);
    if (!this.standDone) {
      if (!stand || !stand.alive) this.standDone = true;
      else if (!this.charge) {
        const eng = g.unitsInArea(STAND.x, STAND.z, 12, 'UA').filter((u) => u.type.engineer).length, foes = ground(g, 'RU', STAND.x, STAND.z, 22).length;
        if (eng > 0 && foes === 0) { this.chargeT += dt * eng; if (this.chargeT >= 8) { this.charge = { t: 22 }; g.say('Dunn', 'Ladung ist scharf – zurück! Zündung in 20 Sekunden!', 5); g.alert('Ladung am Prüfstand: Zündung in 20 s', 5); } } else this.chargeT = Math.max(0, this.chargeT - dt);
      } else {
        this.charge.t -= dt;
        if (this.charge.t <= 0) {
          g.effects.explosion(STAND.x, 4, STAND.z, 2.2, { crater: true }); g.effects.explosion(STAND.x + 4, 8, STAND.z - 3, 1.6, { crater: false });
          g.splashDamage(STAND.x, STAND.z, 24, 400, { dmg: 400, splash: 24, vs: { soft: 1, light: 1, heavy: 1, struct: 1, air: 0 } }, 'UA', null, false);
          g.killUnit(stand, null, true); this.standDone = true;
        }
      }
    }
    if (this.standDone && g.objState('stand') === 'open') { g.setObjective('stand', 'done'); g.say('Fenwick', 'Der Prüfstand ist zerstört. Dieses Gelände wird keine Raketen mehr sehen.', 5); }
    // Lager befreien
    const guards = g.units.filter((u) => u.alive && u.side === 'RU' && u.tags.has('camp') && !u.type.structure).length;
    if (!this.freed) {
      const own = ground(g, 'UA', CAMP.x, CAMP.z, 18).filter((u) => u.tags.has('team')).length;
      setText(g, 'free', guards > 0 ? `Häftlinge befreien – Wachen im Lager: ${guards}` : 'Häftlinge befreien – Lagertor öffnen (Trupp ins Lager)');
      if (guards === 0 && own > 0) { this.campT += dt; if (this.campT >= 3) this.freePrisoners(g); } else this.campT = 0;
    } else this.followLogic(g, dt);
    // Entkommen: Befreite am Ausgang
    if (this.freed) {
      const pr = alive(g, 'UA', (u) => u.tags.has('pris'));
      for (const u of pr) if (Math.hypot(u.pos.x - EXIT.x, u.pos.z - EXIT.z) < EXIT.r) this.escaped.add(u.id);
      const n = this.escaped.size, inTeam = team.filter((u) => Math.hypot(u.pos.x - EXIT.x, u.pos.z - EXIT.z) < EXIT.r).length;
      setText(g, 'escape', `Mit mindestens ${NEED_P} Befreiten zum Absetzpunkt entkommen (${Math.min(n, NEED_P)}/${NEED_P})`);
      this.pLost = 14 - pr.length;
      if (this.pLost > 0 && g.objState('safe') === 'open') g.setObjective('safe', 'failed');
      const required = g.objState('ofa') === 'done' && g.objState('docs') === 'done' && g.objState('stand') === 'done';
      if (n >= NEED_P && inTeam >= 2 && required) {
        g.setObjective('escape', 'done'); if (g.objState('quiet') === 'open') g.setObjective('quiet', 'done'); if (g.objState('safe') === 'open') g.setObjective('safe', 'done');
        g.say('Fenwick', 'Wir haben sie durchgebracht. Boote am Pass, alle an Bord. Gute Arbeit.', 6);
        g.win(`Das Kommandounternehmen ist gelungen: ${n} Häftlinge wurden befreit, der Prüfstand zerstört, die Unterlagen gesichert.`); return;
      }
      if (n < NEED_P && pr.filter((u) => !this.escaped.has(u.id)).length + n < NEED_P) { g.setObjective('escape', 'failed'); g.lose('Zu viele Häftlinge sind zu Schaden gekommen – das Unternehmen ist gescheitert.'); return; }
    }
    if (t > LIMIT) { g.setObjective('escape', 'failed'); g.lose('Der Morgen graut – der Trupp ist nicht rechtzeitig herausgekommen.'); }
  },
  freePrisoners(g) {
    this.freed = true; g.setObjective('free', 'done');
    g.say('Dunn', 'Das Tor ist offen! Sie sind unbewaffnet und völlig erschöpft – langsam, ruhig, wir bringen euch hier raus.', 6);
    for (const u of this.pris) if (u.alive) { u.immobilized = false; }
    g.addAbilityCharges('smoke', 1);
  },
  followLogic(g, dt) {
    // Befreite folgen dem nächsten Mann des Trupps, solange sie keinen Befehl haben (sie sind auch einzeln steuerbar)
    this.freeT -= dt; if (this.freeT > 0) return; this.freeT = 2.5;
    const team = alive(g, 'UA', (u) => u.tags.has('team'));
    if (!team.length) return;
    for (const u of this.pris) {
      if (!u.alive || u.moving) continue;
      let best = null, bd = 1e9; for (const c of team) { const d = Math.hypot(c.pos.x - u.pos.x, c.pos.z - u.pos.z); if (d < bd) { bd = d; best = c; } }
      if (best && bd > 10) u.moveTo(best.pos.x + (Math.random() - 0.5) * 6, best.pos.z + (Math.random() - 0.5) * 6);
    }
  },
  victory: 'Die Anlage im Fels ist eine Erfindung. Ihr Vorbild nicht: Im Mittelwerk bei Nordhausen und im Lager Mittelbau-Dora wurden Zehntausende Häftlinge zur Arbeit an der V2 gezwungen. Viele von ihnen überlebten es nicht.',
};
export default mission;
