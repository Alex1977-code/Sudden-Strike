// Mission 7 – Krynky, Herbst 2023: nächtliche Flussüberquerung mit Sturmbooten, Brückenkopf am linken Dnipro-Ufer halten
// bis zur Ablösung. Eigene Karte, angelehnt an Krynky (Gebiet Cherson): breiter Dnipro, Auwald, Straßendorf am Ufer.
import { wave, near, ground, living, enemyKab, clusterIn, autoUnload, overrun } from './_util.js';

const LZ = [-8, -64];      // Landeplatz am Südufer
const BH = [0, -22];       // Brückenkopf (Dorfrand)
const HOLD = 330;

const feats = [
  { type: 'water', poly: [[-240, -165], [240, -155], [240, -80], [130, -74], [40, -82], [-60, -76], [-150, -84], [-240, -88]], depth: 6, bank: 8 },
  { type: 'island', x: 150, z: -118, r: 16, h: 1.1 },
  { type: 'island', x: -170, z: -125, r: 12, h: 1.0 },
  // rechtes Ufer (Norden): Uferwald, Bootsstellen
  { type: 'forest', poly: [[-210, -210], [210, -210], [210, -168], [-210, -174]], kind: 'mixed', density: 0.05 },
  { type: 'house', kind: 'cottage', x: -150, z: -192, w: 8, d: 7, rot: 0, floors: 1 },
  { type: 'house', kind: 'barn', x: -132, z: -190, w: 10, d: 7, rot: 0, floors: 1 },
  // linkes Ufer: Auwald (Weiden, Pappeln), sumpfige Senken
  { type: 'forest', poly: [[-210, -76], [-60, -70], [-70, -18], [-210, -10]], kind: 'poplar', density: 0.06 },
  { type: 'forest', poly: [[70, -74], [210, -76], [210, -12], [60, -20]], kind: 'deciduous', density: 0.06 },
  { type: 'forest', x: -150, z: 120, r: 40, kind: 'deciduous', density: 0.05 },
  { type: 'forest', x: 150, z: 130, r: 36, kind: 'mixed', density: 0.05 },
  { type: 'crater_field', x: 0, z: -10, r: 70, density: 0.008, rmax: 3.5 },
  // Krynky: Straßendorf am Ufer, Straße nach Süden
  { type: 'road', pts: [[-200, 20], [-60, 18], [60, 22], [200, 30]], width: 7, paved: false, name: 'Uferstraße' },
  { type: 'road', pts: [[10, 22], [0, 120], [20, 210]], width: 7, paved: true, name: 'Straße nach Korsunka' },
  { type: 'settlement', kind: 'ukr_village', x: 10, z: 24, r: 62, seed: 2023, density: 0.6, mainRoadAngle: 0, cemetery: false },
  { type: 'hill', x: 0, z: 150, r: 46, h: 4 },
  { type: 'treeline', pts: [[-200, 90], [-40, 96]] }, { type: 'treeline', pts: [[40, 96], [200, 90]] },
];

export default {
  id: 'ua7_krynky',
  title: 'Brückenkopf Krynky',
  place: 'Krynky, linkes Dnipro-Ufer (Gebiet Cherson)',
  date: 'Oktober 2023, 02:20 Uhr',
  era: 'modern',
  difficulty: 2,
  summary: 'Nachts mit Sturmbooten über den Dnipro: am Ufer bei Krynky anlanden, den Dorfrand nehmen und den Brückenkopf gegen Gegenangriffe, Artillerie und Gleitbomben halten, bis die Ablösung übersetzt.',
  briefing: [
    { s: 'Oberst Koval', t: 'Seit dem Herbst 2022 ist der Dnipro die Front. Am linken Ufer, bei Krynky, haben unsere Marineinfanteristen einen schmalen Brückenkopf gebildet. Jede Nacht setzen Boote über – unter Beschuss.' },
    { s: 'Kapitänleutnant Ostap Melnyk (Marineinfanterie)', t: 'Drei Sturmboote, je ein Zug. Wir landen am markierten Platz, nehmen den Uferstreifen und die ersten Häuser und richten uns ein. Halten, bis die Ablösung übersetzt – etwa fünfeinhalb Minuten nach der Landung.' },
    { s: 'Sova (Aufklärung)', t: 'Der Nebel über dem Fluss deckt euch, aber Leuchtgranaten und Wärmebild nicht. Am Ufer liegen Postenstellungen, im Süden Mörser und Haubitzen. Ihre Su-34 werfen Gleitbomben auf alles, was sich am Ufer bewegt – wenn die Warnung kommt: raus aus der Markierung!' },
    { s: 'Melnyk', t: 'Boote: Rechtsklick ans Ufer, abgesessen wird automatisch am Landeplatz oder mit U. Danach die Boote zurückziehen – sie bringen später Nachschub.' },
  ],
  objectivesPreview: ['Übersetzen und am Landeplatz anlanden', 'Brückenkopf bis zur Ablösung halten (5:30 nach der Landung)', 'Optional: Haubitzenstellung im Süden ausschalten', 'Optional: Mindestens zwei Boote erhalten'],
  forces: ['3× Sturmboot (je 6–7 Mann)', '11× Schützen', '2× MG', '3× Javelin', '1× Scharfschütze', '1× Offizier', '1× Sanitäter', '1× Drohnenpilot', '1× Glasfaser-FPV-Operator', 'Artillerie vom rechten Ufer, FPV, Glasfaser-FPV, Nebel, Aufklärung'],
  map: { size: 420, seed: 1023, season: 'autumn', palette: 'mud', relief: 2, baseHeight: 3, seaLevel: 0, scatterTrees: 30, scarred: true, features: feats },
  env: { season: 'autumn', sunElev: 8, sunAzim: 120, fogDensity: 0.0034 },
  weather: { type: 'fog', intensity: 0.22, changes: [{ at: 200, type: 'overcast', intensity: 0.4, fade: 80 }] },
  time: { start: '02:20', speed: 6 },
  camera: { x: -5, z: -105, dist: 105, yaw: 0 },
  abilities: ['scan', { id: 'artillery', charges: 5 }, { id: 'fpv', charges: 4 }, { id: 'm_fiberfpv', charges: 4 }, { id: 'smoke', charges: 2 }],
  friendlyEdge: [0, -270],
  noDefaultDefeat: true,

  setup(g) {
    this.st = {}; this.landed = false; this.boatsLost = 0;
    this.markers = [
      { x: LZ[0], z: LZ[1], r: 14, label: 'Landeplatz', color: '#5db8ff' },
      { x: BH[0], z: BH[1], r: 46, label: 'Brückenkopf', color: '#ffd500' },
      { x: -120, z: 170, r: 16, label: 'Haubitzen', color: '#ff6b6b' },
    ];
    const cargo = [
      [['rifle', 4], ['mg', 1], ['ua_officer', 1], ['ua_medic', 1]],
      [['rifle', 4], ['javelin', 1], ['sniper', 1], ['dronepilot', 1]],
      [['rifle', 3], ['mg', 1], ['javelin', 2], ['m_fibreop', 1]],
    ];
    [-42, -8, 26].forEach((x, i) => g.spawn('ua_c1_boat', 'UA', x, -138, { heading: 0, tags: ['boat'], cargo: cargo[i] }));
    // Uferposten und Dorfrand
    g.spawnGroup([['e_rifle', 3], ['e_mg', 1]], 'RU', 24, -44, { spacing: 4, ai: { mode: 'guard', radius: 30 }, tags: ['shore'] });
    g.spawnGroup([['e_rifle', 3], ['e_rpg', 1]], 'RU', -52, -38, { spacing: 4, ai: { mode: 'guard', radius: 28 }, tags: ['shore'] });
    g.spawnGroup([['e_rifle', 3], ['e_sniper', 1]], 'RU', 14, 18, { spacing: 4, ai: { mode: 'guard', radius: 34 } });
    g.spawn('bunker', 'RU', 50, 62, { heading: Math.PI });
    g.spawnGroup([['e_rifle', 3], ['e_mg', 1]], 'RU', 48, 74, { spacing: 4, ai: { mode: 'guard', radius: 30 } });
    // Haubitzen im Süden (Nebenziel)
    g.spawn('m_d30', 'RU', -128, 168, { tags: ['arty'], ai: { mode: 'hold' } });
    g.spawn('m_d30', 'RU', -110, 176, { tags: ['arty'], ai: { mode: 'hold' } });
    g.spawnGroup([['e_rifle', 3]], 'RU', -118, 186, { spacing: 4, ai: { mode: 'guard', radius: 25 } });
    g.spawn('orlan', 'RU', 0, 100, { ai: { mode: 'loiter', center: [0, -60], radius: 70 } });

    g.addObjective('land', 'Übersetzen und am Landeplatz anlanden');
    g.addObjective('hold', 'Brückenkopf bis zur Ablösung halten');
    g.addObjective('arty', 'Haubitzenstellung im Süden ausschalten', { optional: true });
    g.addObjective('boats', 'Mindestens zwei Boote erhalten', { optional: true });
    g.later(2, () => g.say('Melnyk', 'Motoren leise. Boote zum Landeplatz – Rechtsklick ans Südufer.', 5));
    g.later(9, () => g.say('Sova', 'Ihre Posten am Ufer haben Wärmebild. Unsere Artillerie vom rechten Ufer kann sie niederhalten (F-Tasten).', 5));
    // Haubitzen beschießen erkannte Trupps am Ufer
    g.every(60, () => {
      if (g.ended) return false;
      if (!g.units.some((u) => u.alive && u.tags.has('arty'))) return;
      const c = clusterIn(g, 'UA', BH[0], BH[1] - 20, 75);
      if (c) { g.artilleryBarrage(c[0] + 6, c[1] + 6, 12, 4, { delay: 4, dmg: 150 }); g.alert('⚠ Haubitzenfeuer auf den Brückenkopf!', 2); }
    }, 80);
  },
  onLanding(g) {
    if (this.landed) return;
    this.landed = true; this.t0 = g.time;
    g.setObjective('land', 'done');
    g.say('Melnyk', 'Wir sind drüben! Uferstreifen säubern, in die ersten Häuser, eingraben (B). Die Boote zurück ans Nordufer!', 6);
    g.setCountdown(HOLD, 'Ablösung in', () => this.finish(g));
    const T = (s, fn) => g.later(s, () => { if (!g.ended) fn(); });
    const S = [[0, 200], [70, 205], [-60, 205]];
    const pts = (k) => [[S[k][0] * 0.6, 120], [BH[0] + (k - 1) * 14, BH[1] + 10]];
    T(45, () => { wave(g, [['m_storm', 3], ['e_rpg', 1]], S[0][0], S[0][1], pts(0)); g.alert('⚠ Gegenangriff aus dem Süden!', 2.5); });
    T(60, () => { for (let i = 0; i < 2; i++) g.spawn('lancet', 'RU', -40 + i * 80, 200, { ai: { mode: 'hunt', huntRadius: 320, points: [[0, -120]] } }); g.alert('⚠ Lancet-Drohnen jagen die Boote!', 3); });
    T(100, () => wave(g, [['m_storm', 4]], S[1][0], S[1][1], pts(1)));
    T(125, () => { const c = clusterIn(g, 'UA', BH[0], BH[1], 60); if (c) enemyKab(g, c[0], c[1]); });
    T(150, () => {
      g.spawn('ua_c1_boat', 'UA', -8, -150, { heading: 0, tags: ['boat'], cargo: [['rifle', 5], ['javelin', 1]], ai: { mode: 'convoy', points: [[-8, -96], [LZ[0], LZ[1] - 14]] } });
      g.say('Melnyk', 'Zweites Boot mit Verstärkung legt ab: fünf Schützen und ein Javelin.', 4);
    });
    T(160, () => { wave(g, [['m_storm', 3], ['e_mg', 1]], S[2][0], S[2][1], pts(2)); g.spawn('bmp', 'RU', 10, 205, { ai: { mode: 'attackMove', points: [[5, 110], [BH[0], BH[1] + 30]], aggressive: true, after: 'guard' } }); g.alert('⚠ Schützenpanzer im Anmarsch!', 3); });
    T(215, () => { const c = clusterIn(g, 'UA', BH[0], BH[1], 60); if (c) enemyKab(g, c[0], c[1]); });
    T(235, () => wave(g, [['m_storm', 5], ['e_rpg', 1]], S[0][0], S[0][1], pts(0)));
    T(270, () => { g.spawn('m_turtle', 'RU', 30, 205, { ai: { mode: 'attackMove', points: [[20, 110], [10, 40]], aggressive: true, after: 'guard' } }); wave(g, [['m_storm', 3]], S[1][0], S[1][1], pts(1)); g.alert('⚠ „Schildkröte“ – Panzer mit Drohnenkäfig! Javelin bereithalten.', 3); });
    T(300, () => g.say('Melnyk', 'Ablösung legt am Nordufer ab. Noch eine halbe Minute!', 4));
  },
  onKill(g, u) {
    if (u.tags.has('boat')) {
      this.boatsLost++;
      g.say('Melnyk', 'Boot verloren!', 3);
      if (this.boatsLost >= 2 && g.objState('boats') === 'open') g.setObjective('boats', 'failed');
    }
    if (u.tags.has('arty') && g.countTag('arty') === 0 && g.objState('arty') === 'open') { g.setObjective('arty', 'done'); g.say('Sova', 'Haubitzen schweigen. Gute Arbeit.', 4); }
  },
  finish(g) {
    if (g.ended) return;
    const held = near(g, BH[0], BH[1], 62, 'UA', (u) => u.type.infantry).length;
    if (held < 3) { g.setObjective('hold', 'failed'); g.lose('Als die Ablösung ankam, war der Brückenkopf nicht mehr zu halten.'); return; }
    g.setObjective('hold', 'done');
    if (g.objState('boats') === 'open') g.setObjective('boats', 'done');
    if (g.objState('arty') === 'open') g.setObjective('arty', 'failed');
    for (let i = 0; i < 3; i++) g.spawn('ua_c1_boat', 'UA', -30 + i * 22, -146, { heading: 0, cargo: [['rifle', 6]], ai: { mode: 'convoy', points: [[-20 + i * 14, -95]] } });
    g.win('Die Ablösung ist am Ufer. Der Brückenkopf hält – für diese Nacht.');
  },
  update(g, dt) {
    if (g.ended) return;
    autoUnload(g, LZ, 26);
    const ashore = g.units.filter((u) => u.alive && u.side === 'UA' && u.type.infantry && u.pos.z > -80).length;
    if (!this.landed && ashore >= 8) this.onLanding(g);
    if (this.landed && overrun(g, this.st, 'bh', BH[0], BH[1], 58, { dt, grace: 16 })) { g.setObjective('hold', 'failed'); g.lose('Der Brückenkopf ist gefallen.'); return; }
    const inf = living(g, 'UA', (u) => u.type.infantry).length + g.units.reduce((n, v) => n + (v.alive && v.side === 'UA' && v.cargo ? v.cargo.length : 0), 0);
    if (inf === 0) g.lose('Niemand hat das Ufer erreicht.');
    else if (!this.landed && g.time > 240) g.lose('Die Morgendämmerung naht – die Landung ist gescheitert.');
  },
  victory: 'Krynky wurde zum Sinnbild: ein paar zerschossene Häuser, ein Auwald voller Trichter, ein Fluss, den jede Nacht Boote kreuzten. Viele Marineinfanteristen kehrten nicht zurück. Ihr Mut band Kräfte, die anderswo fehlten.',
};
