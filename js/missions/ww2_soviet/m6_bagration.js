// Kampagne „WK2 – Rote Armee“, Mission 6 – Operation Bagration (Juni 1944): Partisanen-Überfall auf einen Zug, Durchbruch durch Sumpf und Wald.
import { road, river, bridge, forest, grove, hill, water, settlement } from '../../maps/places/_kit.js';
import { S, E, wave, capture, foes, setupMines, updateMines } from './_common.js';

const J = [-150, 18];      // Knotenpunkt (Dorf an Bahn und Rollbahn)
const RAIL = [[280, -52], [200, -66], [120, -86], [30, -96], [-60, -76], [-150, -40], [-280, -30]]; // Ost → West
const LIMIT = 1500;

export default {
  id: 'sw6', era: 'ww2', difficulty: 2,
  title: 'Operation Bagration',
  place: 'Weißrussland · Drut-Niederung (angelehnt an die Landschaft östlich von Bobruisk)',
  date: 'Juni 1944',
  summary: 'Partisanen halten einen Nachschubzug auf, während die Panzer durch Wald und Sumpf zum Fluss stoßen – und weiter zum Eisenbahnknoten.',
  briefing: [
    { s: 'Oberst Karpow', t: 'Drei Jahre Besatzung, Dörfer verbrannt, Menschen verschleppt. Heute brechen wir die Heeresgruppe Mitte auf. Der Weg führt durch Wald und Sumpf, die der Gegner für unpassierbar hält – und über den Fluss, den er verteidigt.' },
    { s: 'Kommandeurin Wassiljewa (Partisanen)', t: 'Meine Leute liegen am Bahndamm. Ein Nachschubzug mit Munition rollt um diese Zeit nach Westen. Wir halten ihn auf. Zielt auf die Lokomotive, dann ist er stehen. Das nimmt dem Gegner die Reserven für den Gegenstoß.' },
    { s: 'Oberst Karpow', t: 'Die Hauptmacht greift die Drut-Linie an: Hauptbrücke im Süden, ein Knüppeldamm im Norden, kaum bewacht. Danach der Knotenpunkt im Westen. Die Dörfer hier haben viel durchgemacht – bringt sie nicht unter Feuer, wo es nicht sein muss.' },
  ],
  objectivesPreview: ['Den Nachschubzug stoppen (Lokomotive ausschalten)', 'Die Drut-Linie durchbrechen', 'Den Eisenbahnknoten im Westen einnehmen', 'Optional: Mindestens 6 Partisanen überleben'],
  forces: ['Partisanen: 6× PPSch, 5× Schützen, 2× DP-28, 2× Panzerbüchse, 1× Scharfschütze, 2× Pioniere', 'Hauptmacht: 7× T-34/85, 2× SU-76, 12× Schützen, 4× PPSch, 3× DP-28, 2× Panzerbüchse, 2× Pioniere, 1× Offizier, 1× Sanitäter', 'Fähigkeiten: Schlachtflieger (Il-2) ×2, Artillerie ×3'],
  map: {
    size: 560, seed: 1944622, season: 'summer', palette: 'mud', relief: 1.5, baseHeight: 3, scatterTrees: 70,
    railways: [{ pts: RAIL, id: 'main' }],
    features: [
      river([[112, -280], [106, -110], [112, 50], [104, 280]], 14, { depth: 2.6, bank: 4, name: 'Drut' }),
      ...bridge([[84, 46], [134, 50]], 8, 'Drut-Brücke (Hauptstraße)', false, 'wood'),
      ...bridge([[86, -166], [128, -160]], 5, 'Knüppeldamm', false, 'wood'),
      road([[282, 52], [134, 50]], 7, false, { name: 'Rollbahn' }), road([[84, 46], [-40, 36], [-150, 18], [-282, 10]], 7, false),
      road([[282, -164], [128, -160]], 4, false), road([[86, -166], [10, -150], [-70, -120], [-150, -40]], 4, false),
      road([[-150, 18], [-150, -40]], 5, false),
      // Sumpfflächen und Waldmassive
      water([[160, 70], [230, 64], [240, 130], [170, 140]], { depth: 1.1, bank: 3 }), water([[-60, 90], [10, 84], [20, 150], [-50, 156]], { depth: 1.1, bank: 3 }),
      water([[180, -130], [250, -126], [256, -90], [186, -96]], { depth: 1, bank: 3 }), water([[-200, -150], [-130, -156], [-120, -110], [-196, -100]], { depth: 1, bank: 3 }),
      forest([[130, 84], [270, 80], [270, 270], [130, 270]], 'mixed', 0.075), forest([[-270, 70], [-170, 66], [-160, 270], [-270, 270]], 'mixed', 0.075),
      forest([[130, -270], [270, -270], [270, -190], [136, -186]], 'pine', 0.08), forest([[-270, -270], [-130, -270], [-136, -190], [-270, -186]], 'pine', 0.08),
      forest([[0, -270], [100, -270], [96, -200], [0, -196]], 'pine', 0.07), forest([[-60, 100], [100, 100], [100, 270], [-60, 270]], 'mixed', 0.06),
      grove(40, -120, 26, 'birch', 0.07), grove(60, -125, 18, 'pine', 0.08), grove(-100, 80, 24, 'birch', 0.06),
      hill(-20, -20, 28, 4), hill(190, -20, 30, 4),
      settlement('ukr_village', J[0], J[1], 56, 1944, { era: 'ww2', mainRoadAngle: 0.1, density: 0.6, fields: false, cemetery: false }),
      settlement('ukr_village', 220, 30, 36, 1945, { era: 'ww2', mainRoadAngle: 0.1, density: 0.5, fields: false, cemetery: false }),
    ],
  },
  env: { season: 'summer', sunElev: 20, sunAzim: 140, fogDensity: 0.0038 },
  weather: { type: 'fog', intensity: 0.45, changes: [{ at: 300, type: 'clear', intensity: 0, fade: 120 }] },
  time: { start: '04:20', speed: 4 },
  camera: { x: 30, z: -80, dist: 150 },
  abilities: [{ id: 'ww2_airstrike_su', charges: 2 }, { id: 'ww2_artillery', charges: 3 }],

  setup(g) {
    this.t = 0; this.trainObj = null; this.reserveDone = false; this.partLost = 0;
    this.markers = [
      { x: 30, z: -96, r: 26, label: 'Hinterhalt am Bahndamm', color: '#5db8ff' },
      { x: 108, z: 48, r: 22, label: 'Drut-Brücke', color: '#e9c34a' },
      { x: 106, z: -163, r: 18, label: 'Knüppeldamm', color: '#e9c34a' },
      { x: J[0], z: J[1], r: 44, label: 'Eisenbahnknoten', color: '#ff6b6b' },
    ];
    setupMines(this, g, [[78, 40, 12], [74, 56, 12]]);
    // Partisanen im Wald am Bahndamm (Nordseite)
    const P = ['part'];
    g.spawnGroup([[S.smg, 6], [S.rifle, 5], [S.dp, 2], [S.at, 2], [S.sniper, 1], [S.eng, 2]], 'UA', 30, -118, { spacing: 3, cols: 6, heading: 0, tags: P });
    // Hauptmacht (Osten)
    g.spawnGroup([[S.t85, 7], [S.su76, 2]], 'UA', 262, 42, { spacing: 12, cols: 4, heading: Math.PI / 2, tags: ['tank'] });
    g.spawnGroup([[S.rifle, 12], [S.smg, 4], [S.dp, 3], [S.at, 2], [S.eng, 2], [S.off, 1], [S.med, 1]], 'UA', 250, 62, { spacing: 3, cols: 8, heading: Math.PI / 2 });
    // Drut-Linie: Hauptbrücke stark, Knüppeldamm schwach
    const L = ['line'];
    g.spawn(E.pak, 'RU', 66, 36, { heading: Math.PI / 2, tags: L, ai: { mode: 'hold' } }); g.spawn(E.pak, 'RU', 64, 62, { heading: Math.PI / 2, tags: L, ai: { mode: 'hold' } });
    g.spawn(E.mgnest, 'RU', 74, 28, { heading: Math.PI / 2, tags: L }); g.spawn(E.mgnest, 'RU', 76, 72, { heading: Math.PI / 2, tags: L });
    g.spawnGroup([[E.rifle, 8], [E.mg, 2], [E.at, 2]], 'RU', 60, 50, { spacing: 4, cols: 6, ai: { mode: 'guard', radius: 24 }, tags: L });
    g.spawn(E.stug, 'RU', 40, 46, { ai: { mode: 'guard', radius: 24 }, tags: L });
    g.spawn(E.mgnest, 'RU', 80, -156, { heading: Math.PI / 2, tags: L });
    g.spawnGroup([[E.rifle, 4], [E.mg, 1]], 'RU', 70, -160, { spacing: 4, ai: { mode: 'guard', radius: 20 }, tags: L });
    g.spawn(E.flak37, 'RU', 20, 80, { ai: { mode: 'guard', radius: 18 } });
    // Knotenpunkt
    g.spawnGroup([[E.rifle, 5], [E.mg, 2], [E.at, 2]], 'RU', J[0], J[1], { spacing: 5, cols: 6, ai: { mode: 'guard', radius: 32 }, tags: ['junction'] });
    g.spawn(E.pz4, 'RU', J[0] + 20, J[1] - 16, { ai: { mode: 'hold' }, tags: ['junction'] });
    g.spawn(E.pak, 'RU', J[0] + 34, J[1] + 6, { heading: Math.PI / 2, ai: { mode: 'hold' }, tags: ['junction'] });
    // Streife auf dem Bahndamm (vor dem Zug)
    g.spawnGroup([[E.rifle, 4], [E.mg, 1]], 'RU', 80, -94, { spacing: 4, ai: { mode: 'patrol', points: [[90, -92], [20, -100], [90, -92]] }, tags: ['escort'] });

    g.addObjective('train', 'Den Nachschubzug stoppen (Lokomotive ausschalten)');
    g.addObjective('line', 'Die Drut-Linie durchbrechen');
    g.addObjective('junction', 'Den Eisenbahnknoten im Westen einnehmen');
    g.addObjective('part', 'Mindestens 6 Partisanen überleben', { optional: true });
    g.later(3, () => g.say('Wassiljewa', 'Die Streife läuft den Damm ab. Wartet, bis der Zug da ist: erst die Lok, dann der Rest. Ambush-Modus: Feuer auf mein Zeichen.', 7));
    // Zug: kommt aus dem Osten nach Westen (spawnTrain, sonst Lkw-Kolonne als Rückfall)
    g.later(20, () => this._train(g));
    g.later(180, () => g.say('Karpow', 'Die Hauptmacht tritt an. Panzer über die Rollbahn, Schützen durch den Wald – und Pioniere zu den Minen vor der Brücke!', 7));
  },

  _train(g) {
    if (typeof g.spawnTrain === 'function' && typeof g.addRailway === 'function') {
      const tr = g.spawnTrain({ side: 'RU', kind: 'supply', cars: 3, era: 'ww2', faction: 'DE', go: 'end', speed: 5 });
      this.trainObj = tr;
      if (tr) for (const c of tr.cars) c.tags.add('train');
    }
    if (!this.trainObj) {
      // Rückfall: Lkw-Kolonne auf der Straße
      this.fallback = [];
      for (let i = 0; i < 4; i++) this.fallback.push(g.spawn(E.opel, 'RU', 120 - i * 10, -94, { tags: ['train'], ai: { mode: 'convoy', points: [[-60, -76], [-150, -40]] } }));
    }
    g.say('Wassiljewa', 'Rauchfahne im Osten – der Zug kommt!', 4);
  },

  onKill(g, u) {
    if (u.tags?.has('part')) { this.partLost++; if (this.partLost > 10) g.setObjective('part', 'failed'); }
  },

  update(g, dt) {
    this.t += dt;
    updateMines(this, g, dt, { who: 'Pionier', found: 'Minen vor der Brücke! Pioniere räumen.' });
    if (g.ended) return;
    const tr = this.trainObj;
    if (g.objState('train') === 'open' && (tr || this.fallback)) {
      const done = tr ? !tr.cars[0].alive || tr.alive === false : this.fallback.every((u) => !u.alive);
      if (done) { g.setObjective('train', 'done'); g.say('Wassiljewa', 'Der Zug steht! Das Gegenstück zur Munition fehlt der Drut-Linie jetzt.', 5); }
    }
    // Wenn der Zug entkommt (Ende der Strecke) → Reserve verstärkt die Linie
    if (!this.reserveDone && this.t > 175 && g.objState('train') === 'open') {
      this.reserveDone = true;
      wave(g, 'RU', [[E.pz4, 2], [E.rifle, 6]], -150, -40, [[-40, 10], [60, 50]], { tags: ['line'] });
      g.say('Karpow', 'Der Zug ist durch! Gegner verstärkt die Linie mit Panzern.', 5); g.setObjective('train', 'failed');
    }
    if (g.objState('line') === 'open' && g.countTag('line') === 0) { g.setObjective('line', 'done'); g.say('Karpow', 'Die Drut-Linie ist gebrochen! Zum Knotenpunkt!', 5); }
    if (g.objState('junction') === 'open' && g.objState('line') === 'done' && capture(this, g, dt, 'j', { x: J[0], z: J[1], r: 42, need: 3, secs: 4, allow: 0, enemyR: 50 })) g.setObjective('junction', 'done');
    if (g.objState('line') === 'done' && g.objState('junction') === 'done') {
      if (g.objState('part') === 'open') { const n = g.units.filter((u) => u.alive && u.tags.has('part')).length; g.setObjective('part', n >= 6 ? 'done' : 'failed'); }
      g.win('Der Knotenpunkt ist genommen, die Front der Heeresgruppe Mitte reißt auf. In den Dörfern hinter der Linie kommen Überlebende aus den Wäldern – vieles ist niedergebrannt. Der Krieg ist hier vorüber, die Trauer nicht.');
    }
    if (this.t > LIMIT) g.lose('Der Durchbruch blieb im Sumpf stecken. Die Offensive verliert den Schwung.');
  },
  victory: 'Operation Bagration zerschlägt die Heeresgruppe Mitte. Für Weißrussland, das ein Viertel seiner Bevölkerung verloren hat, endet damit die Besatzung.',
};
