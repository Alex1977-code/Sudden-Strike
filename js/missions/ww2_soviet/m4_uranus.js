// Kampagne „WK2 – Rote Armee“, Mission 4 – Operation Uranus (November 1942): Durchbruch durch die Flankenstellung, Vereinigung bei Kalatsch.
import { road, river, bridge, forest, hill, settlement, grove } from '../../maps/places/_kit.js';
import { S, E, wave, capture, foeCount, setupMines, updateMines } from './_common.js';

const BR = [150, 60];     // Donbrücke
const LINE_X = -96;       // Flankenstellung
const LIMIT = 1500;

export default {
  id: 'sw4', era: 'ww2', difficulty: 2,
  title: 'Operation Uranus',
  place: 'Don-Steppe · Brücke bei Kalatsch (angelehnt an das Donknie bei Kalatsch)',
  date: 'November 1942',
  summary: 'Durchbruch durch eine dünn gehaltene Flankenstellung der Achsenverbündeten, dann im Eiltempo zur Donbrücke bei Kalatsch – die Zange schließt sich.',
  briefing: [
    { s: 'Oberst Rjabow', t: 'Nach Monaten in den Ruinen von Stalingrad schlagen wir endlich von außen zu. Der Gegner hält die Flanken mit Verbänden der Verbündeten, schwach bewaffnet und weit auseinandergezogen. Wir sollen die Linie aufbrechen und das Donknie bei Kalatsch erreichen.' },
    { s: 'Hauptmann Tschernowa (Pioniere)', t: 'Vor der Linie liegen Minenfelder, aber der Nebel gibt uns Deckung. Meine Pioniere räumen Gassen – ein Panzer, der blind hineinfährt, kommt nicht wieder heraus.' },
    { s: 'Oberst Rjabow', t: 'Hinter der Linie liegt der Don. Die Brücke bei Kalatsch muss unversehrt in unsere Hand fallen. Von Süden schiebt sich ein zweiter Stoß heran – wenn wir sie halten, schließt sich der Ring um die 6. Armee. Viele auf der anderen Seite sind Zwangsrekrutierte, die nicht mehr kämpfen wollen. Das ändert nichts daran, dass geschossen wird.' },
  ],
  objectivesPreview: ['Die Flankenstellung durchbrechen (alle Stützpunkte der Linie ausschalten)', 'Die Don-Brücke bei Kalatsch einnehmen', 'Die Brücke halten, bis sich beide Stoßkeile vereinigen', 'Optional: Brücke vor Ablauf von 14 Minuten erreichen'],
  forces: ['6× T-34/76', '1× KW-1', '14× Schützen', '6× PPSch', '3× DP-28', '2× Panzerbüchse', '2× Pioniere', '2× BM-13', '1× Offizier', '1× Sanitäter', 'Verstärkung: 3× T-34 nach 5 Minuten', 'Fähigkeiten: Katjuscha-Salve, Artillerie, Schlachtflieger (Il-2)'],
  map: {
    size: 520, seed: 1119, season: 'winter', terrainStyle: 'steppe', relief: 2, baseHeight: 4, scatterTrees: 10,
    features: [
      river([[158, -270], [148, -110], [156, 60], [146, 270]], 34, { depth: 3.2, bank: 5, name: 'Don' }),
      ...bridge([[112, 58], [198, 64]], 10, 'Donbrücke bei Kalatsch', true, 'steel_truss'),
      road([[-262, 46], [-150, 50], [-96, 52], [20, 56], [112, 58]], 7, false, { name: 'Straße nach Kalatsch' }),
      road([[198, 64], [260, 70]], 7, false),
      road([[-96, -262], [-90, -130], [-96, 52], [-100, 140], [-90, 262]], 5, false, { name: 'Rollbahn hinter der Linie' }),
      road([[20, 56], [30, -40], [60, -150], [90, -262]], 5, false),
      hill(-170, -120, 36, 5), hill(60, 130, 40, 5), hill(-40, -80, 30, 4),
      grove(-30, 120, 18, 'poplar', 0.06), grove(70, -60, 16, 'poplar', 0.05), grove(-200, 120, 22, 'mixed', 0.05),
      forest([[170, -250], [250, -250], [250, -170], [175, -180]], 'mixed', 0.05),
      settlement('ukr_village', 112, 116, 42, 1942, { era: 'ww2', mainRoadAngle: 0.1, density: 0.6, fields: false, cemetery: false }),
      settlement('ukr_town', 232, 72, 56, 1943, { era: 'ww2', mainRoadAngle: 0.1, density: 0.6, fields: false }),
      settlement('ukr_village', -40, -150, 40, 1944, { era: 'ww2', mainRoadAngle: Math.PI / 2, density: 0.5, fields: false, cemetery: false }),
    ],
  },
  env: { season: 'winter', sunElev: 8, sunAzim: 120, fogDensity: 0.0042 },
  weather: { type: 'fog', intensity: 0.6, changes: [{ at: 330, type: 'snow', intensity: 0.45, fade: 90 }, { at: 800, type: 'clear', intensity: 0, fade: 120 }] },
  time: { start: '07:30', speed: 3 },
  camera: { x: -200, z: 40, dist: 135 },
  abilities: ['ww2_katyusha', { id: 'ww2_artillery', charges: 3 }, { id: 'ww2_airstrike_su', charges: 2 }],

  setup(g) {
    this.t = 0; this.bridgeT = null; this.linked = false;
    this.markers = [
      { x: BR[0], z: BR[1], r: 30, label: 'Donbrücke Kalatsch', color: '#5db8ff' },
      { x: LINE_X, z: 0, r: 22, label: 'Flankenstellung', color: '#ff6b6b' },
    ];
    setupMines(this, g, [[-122, -70, 16], [-118, 30, 16], [-120, 130, 15], [-112, -150, 14]]);
    // Eigene Kräfte (Westrand)
    g.spawnGroup([[S.t34, 6]], 'UA', -238, 20, { spacing: 13, cols: 3, heading: Math.PI / 2, tags: ['tank'] });
    g.spawn(S.kv1, 'UA', -246, 50, { heading: Math.PI / 2, tags: ['tank'] });
    g.spawnGroup([[S.rifle, 14], [S.smg, 6], [S.dp, 3]], 'UA', -226, 74, { spacing: 3, cols: 8, heading: Math.PI / 2 });
    g.spawnGroup([[S.at, 2], [S.eng, 2], [S.off, 1], [S.med, 1]], 'UA', -232, 96, { spacing: 3, cols: 6, heading: Math.PI / 2 });
    g.spawn(S.bm13, 'UA', -250, 100, { heading: Math.PI / 2 }); g.spawn(S.bm13, 'UA', -250, 112, { heading: Math.PI / 2 });
    // Flankenstellung (Stützpunkte entlang der Linie)
    const L = ['line'];
    for (const z of [-150, -92, -40, 6, 52, 98, 150]) g.spawn(E.mgnest, 'RU', LINE_X, z, { heading: -Math.PI / 2, tags: L });
    for (const z of [-66, 28, 124]) g.spawn(E.pak, 'RU', LINE_X + 6, z, { heading: -Math.PI / 2, tags: L, ai: { mode: 'hold' } });
    for (const z of [-150, -92, -40, 6, 52, 98, 150]) g.spawnGroup([[E.rifle, 3]], 'RU', LINE_X + 10, z + 6, { spacing: 3, cols: 3, ai: { mode: 'guard', radius: 18 }, tags: L });
    g.spawn(E.wire, 'RU', LINE_X - 14, -20); g.spawn(E.wire, 'RU', LINE_X - 14, 76); g.spawn(E.wire, 'RU', LINE_X - 14, -110);
    g.spawn(E.mortar, 'RU', LINE_X + 36, 20, { ai: { mode: 'guard', radius: 18 }, tags: L }); g.spawn(E.mortar, 'RU', LINE_X + 36, 100, { ai: { mode: 'guard', radius: 18 }, tags: L });
    // Brückenwache und Don-Stellung
    g.spawn(E.mgnest, 'RU', 98, 46, { heading: -Math.PI / 2 }); g.spawn(E.mgnest, 'RU', 100, 74, { heading: -Math.PI / 2 });
    g.spawn(E.pak, 'RU', 104, 60, { heading: -Math.PI / 2, ai: { mode: 'hold' }, tags: ['bridge'] });
    g.spawnGroup([[E.rifle, 8], [E.mg, 2], [E.at, 1]], 'RU', 120, 62, { spacing: 4, cols: 5, ai: { mode: 'guard', radius: 22 }, tags: ['bridge'] });
    g.spawn(E.flak37, 'RU', 208, 56, { heading: -Math.PI / 2, ai: { mode: 'guard', radius: 20 } });
    g.spawn(E.opel, 'RU', 222, 80); g.spawn(E.opel, 'RU', 232, 88);
    g.addObjective('line', 'Die Flankenstellung durchbrechen (alle Stützpunkte ausschalten)');
    g.addObjective('bridge', 'Die Donbrücke bei Kalatsch einnehmen');
    g.addObjective('link', 'Die Brücke halten, bis sich die Stoßkeile vereinigen');
    g.addObjective('time', 'Die Brücke vor Ablauf von 14 Minuten erreichen', { optional: true });
    g.later(3, () => g.say('Rjabow', 'Katjuschas eröffnen den Angriff – Feuerwalze auf die Linie! Danach Panzer vor, Pioniere voraus.', 6));
    g.later(300, () => { wave0(g); g.say('Rjabow', 'Zweite Welle trifft ein: drei T-34 und Schützen. Nachziehen!', 5); });
    g.every(75, () => { if (g.ended) return false; if (this.t > 120 && g.objState('line') === 'open') this._reserve(g); }, 120);
  },
  _reserve(g) {
    if (this.reserveN >= 2) return;
    this.reserveN = (this.reserveN || 0) + 1;
    wave(g, 'RU', [[E.pz4, 1], [E.rifle, 5], [E.mg, 1]], 20, 40, [[-60, 20], [-92, 20]], { tags: ['reserve'] });
    g.alert('Panzerreserve des Gegners!', 3);
  },
  onKill(g, u) {
    if (u.tags?.has('tank')) this.lostT = (this.lostT || 0) + 1;
  },
  update(g, dt) {
    this.t += dt;
    updateMines(this, g, dt, { who: 'Tschernowa', found: 'Minenfeld! Pioniere räumen – alle anderen halten Abstand.' });
    if (g.ended) return;
    if (g.objState('line') === 'open' && g.countTag('line') === 0) { g.setObjective('line', 'done'); g.say('Rjabow', 'Die Linie ist durchbrochen! Panzer – ohne Halt zum Don!', 5); }
    if (g.objState('bridge') === 'open' && capture(this, g, dt, 'br', { x: BR[0], z: BR[1], r: 30, need: 3, secs: 4, allow: 0, enemyR: 40 })) {
      g.setObjective('bridge', 'done'); this.bridgeT = this.t;
      if (this.t <= 840) g.setObjective('time', 'done'); else g.setObjective('time', 'failed');
      g.say('Rjabow', 'Brücke genommen! Haltet sie – der Südkeil muss in Minuten hier sein.', 6);
      g.later(45, () => {
        this.linked = true;
        g.alert('Der Südkeil erscheint am Ostufer!', 5);
        g.say('Rjabow', 'Meldung: Panzer des 4. Mechanisierten Korps von Osten! Wir stehen bei Kalatsch Hand in Hand.', 6);
        const east = g.spawnGroup([[S.t34, 3], [S.rifle, 6]], 'UA', 252, 72, { spacing: 8, cols: 3, heading: -Math.PI / 2, tags: ['east'], ai: { mode: 'attackMove', points: [[200, 66]], after: 'guard', aggressive: true } });
      });
    }
    if (this.bridgeT !== null && g.objState('link') === 'open') {
      if (this.linked && g.units.some((u) => u.alive && u.tags.has('east') && Math.hypot(u.pos.x - 200, u.pos.z - 66) < 34)) {
        g.setObjective('link', 'done');
        g.win('Bei Kalatsch schließt sich der Ring um die 6. Armee. Hunderttausende Soldaten auf beiden Seiten sind nun im Kessel oder davor – und der Winter kommt erst. Es ist der Wendepunkt, aber kein Grund zum Jubel: Das Sterben geht weiter.');
      }
    }
    if (this.t > LIMIT) g.lose('Der Angriff ist festgefahren. Die Zange schließt sich nicht.');
  },
  victory: 'Die Zange hat sich geschlossen. Die Entscheidung an der Wolga ist gefallen – mit enormen Opfern auf allen Seiten.',
};

function wave0(g) {
  g.spawnGroup([[S.t34, 3], [S.rifle, 6], [S.smg, 2]], 'UA', -250, 60, { spacing: 8, cols: 4, heading: Math.PI / 2 });
  g.markerTo?.('UA', -250, 60, 0x5db8ff, 8, 14);
}
