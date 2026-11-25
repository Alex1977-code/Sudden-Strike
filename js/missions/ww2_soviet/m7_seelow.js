// Kampagne „WK2 – Rote Armee“, Mission 7 – Seelower Höhen (April 1945): Nachtangriff mit Scheinwerfern über das Oderbruch.
import { PLACE_BY_ID, placeMission } from '../../maps/places/index.js';
import { S, E, wave, capture, setupMines, updateMines } from './_common.js';

const SEELOW = [-215, -40];
const OVER = [128, -28];       // Westende der Brücke über die Alte Oder
const LIMIT = 1500;
// Scheinwerfer-Positionen (leuchten die Höhen ab): x, z, Radius
const LIGHTS = [[-150, -170], [-150, -70], [-150, 40], [-150, 150]];

export default placeMission(PLACE_BY_ID.seelow, {
  structures: false, markers: false, defender: 'RU',
  id: 'sw7', era: 'ww2', difficulty: 3,
  title: 'Seelower Höhen',
  place: 'Oderbruch · Seelower Höhen (angelehnt an die Seelower Höhen)',
  date: 'April 1945',
  summary: 'Nachtangriff über das Oderbruch: Scheinwerfer, Minenfelder und die Höhenstellung – der letzte große Riegel vor Berlin.',
  briefing: [
    { s: 'Generaloberst Kusnezow', t: 'Das Oderbruch ist ein Sumpf mit Gräben und Dämmen, darüber der Steilrand der Seelower Höhen. Der Gegner hat Wochen gebuddelt. Wir greifen vor Morgengrauen an – mit Artillerie und Scheinwerfern, die den Gegner blenden sollen.' },
    { s: 'Major Petrenko (Pioniere)', t: 'Der Rauch und das Scheinwerferlicht sind zwiespältig: Der Gegner sieht uns schlechter, wir aber auch uns selbst. Minen in jedem zweiten Graben. Meine Pioniere gehen vor – wer ein Feld ohne Räumung betritt, verliert Fahrzeuge.' },
    { s: 'Generaloberst Kusnezow', t: 'Die Männer auf den Höhen sind überwiegend Jugendliche und Volkssturm, dazwischen kampferprobte Verbände. Ihr Krieg ist verloren, das weiß hier jeder. Wir müssen trotzdem durch. Seelow ist das Ziel.' },
  ],
  objectivesPreview: ['Die Alte Oder überqueren und das Westufer sichern', 'Die Höhenstellung durchbrechen (alle Stützpunkte)', 'Seelow einnehmen', 'Optional: Die 8,8-cm-Flak auf den Höhen ausschalten'],
  forces: ['13× T-34/85', '3× IS-2', '2× SU-100', '14× Schützen', '8× PPSch', '4× DP-28', '3× Panzerbüchse', '4× Pioniere', '1× Offizier', '2× Sanitäter', '2× BM-13', 'Verstärkung: 4× T-34/85 nach 6 Minuten', 'Fähigkeiten: Katjuscha, Artillerie, Schlachtflieger (Il-2)'],
  weather: { type: 'fog', intensity: 0.7, changes: [{ at: 600, type: 'fog', intensity: 0.4, fade: 120 }, { at: 1100, type: 'overcast', intensity: 0.4, fade: 120 }] },
  time: { start: '03:20', speed: 3 },
  camera: { x: 240, z: -40, dist: 130 },
  abilities: ['ww2_katyusha', { id: 'ww2_artillery', charges: 4 }, { id: 'ww2_airstrike_su', charges: 2 }],

  setup(g) {
    this.t = 0; this.lightT = 0; this.lightI = 0; this.reserveDone = false;
    this.markers = [
      { x: OVER[0], z: OVER[1], r: 30, label: 'Alte Oder – Brückenkopf', color: '#5db8ff' },
      { x: -150, z: -30, r: 70, label: 'Höhenstellung', color: '#ff6b6b' },
      { x: SEELOW[0], z: SEELOW[1], r: 44, label: 'Seelow', color: '#e9c34a' },
    ];
    setupMines(this, g, [[40, -120, 20], [60, 10, 20], [30, 120, 18], [-60, -30, 18], [-70, 90, 18], [-50, -190, 18], [-96, 30, 14]]);
    // Eigene Kräfte (Ostufer der Alten Oder)
    g.spawnGroup([[S.t85, 13], [S.is2, 3], [S.su100, 2]], 'UA', 268, -90, { spacing: 12, cols: 5, heading: Math.PI / 2, tags: ['tank'] });
    g.spawnGroup([[S.rifle, 14], [S.smg, 8], [S.dp, 4], [S.at, 3], [S.eng, 4], [S.off, 1], [S.med, 2]], 'UA', 262, -10, { spacing: 3, cols: 10, heading: Math.PI / 2 });
    g.spawn(S.bm13, 'UA', 282, 20, { heading: Math.PI / 2 }); g.spawn(S.bm13, 'UA', 282, 34, { heading: Math.PI / 2 });
    // Brückenkopf am Westufer der Alten Oder
    g.spawn(E.mgnest, 'RU', 120, -44, { heading: Math.PI / 2, tags: ['line'] }); g.spawn(E.mgnest, 'RU', 118, -10, { heading: Math.PI / 2, tags: ['line'] });
    g.spawnGroup([[E.rifle, 6], [E.mg, 1], [E.at, 2]], 'RU', 108, -26, { spacing: 4, cols: 5, ai: { mode: 'guard', radius: 22 }, tags: ['line', 'bank'] });
    g.spawn(E.pak, 'RU', 96, -24, { heading: Math.PI / 2, ai: { mode: 'hold' }, tags: ['line', 'bank'] });
    // Höhenstellung (Steilrand) – Pak, MG, Flak, Infanterie
    for (const z of [-220, -150, -90, -30, 30, 90, 150, 210]) {
      if (z === -150 || z === -30 || z === 90 || z === 210) g.spawn(E.pak, 'RU', -152, z, { heading: Math.PI / 2, ai: { mode: 'hold' }, tags: ['line'] });
      g.spawnGroup([[E.rifle, 3], [E.at, 1]], 'RU', -156, z + 10, { spacing: 3, cols: 3, ai: { mode: 'guard', radius: 18 }, tags: ['line'] });
    }
    for (const z of [-190, -60, 60, 180]) g.spawn(E.mgnest, 'RU', -146, z, { heading: Math.PI / 2, tags: ['line'] });
    for (const z of [-90, 100]) g.spawn(E.flak88, 'RU', -176, z, { heading: Math.PI / 2, ai: { mode: 'hold' }, tags: ['line', 'flak'] });
    g.spawn(E.mortar, 'RU', -190, -60, { ai: { mode: 'guard', radius: 14 } }); g.spawn(E.mortar, 'RU', -190, 80, { ai: { mode: 'guard', radius: 14 } });
    // Bruch: vorgeschobene Posten am Hauptgraben
    for (const z of [-170, 20]) g.spawnGroup([[E.rifle, 3], [E.mg, 1]], 'RU', -88, z, { spacing: 3, ai: { mode: 'guard', radius: 18 }, tags: ['line'] });
    // Seelow
    g.spawnGroup([[E.rifle, 4], [E.mg, 1], [E.at, 1]], 'RU', SEELOW[0], SEELOW[1], { spacing: 5, cols: 5, ai: { mode: 'guard', radius: 34 }, tags: ['town'] });
    g.spawn(E.panther, 'RU', SEELOW[0] - 14, SEELOW[1] + 18, { ai: { mode: 'guard', radius: 30 }, tags: ['town'] });

    g.addObjective('bank', 'Die Alte Oder überqueren und das Westufer sichern');
    g.addObjective('line', 'Die Höhenstellung durchbrechen (alle Stützpunkte)');
    g.addObjective('seelow', 'Seelow einnehmen');
    g.addObjective('flak', 'Die 8,8-cm-Flak auf den Höhen ausschalten', { optional: true });
    g.later(3, () => g.say('Kusnezow', 'Feuerwalze! Scheinwerfer an – alle Rohre auf die Höhen!', 5));
    g.later(10, () => g.say('Petrenko', 'Minen im Bruch! Pioniere voran, Panzer folgen auf geräumten Gassen.', 6));
    g.later(240, () => {
      g.spawnGroup([[S.t85, 4], [S.smg, 6]], 'UA', 276, -50, { spacing: 10, cols: 5, heading: Math.PI / 2, tags: ['tank'] });
      g.markerTo?.('UA', 276, -50, 0x5db8ff, 8, 14); g.say('Kusnezow', 'Zweite Staffel setzt über die Oder. Brückenkopf ausbauen!', 5);
    });
  },

  update(g, dt) {
    this.t += dt;
    updateMines(this, g, dt, { who: 'Petrenko', found: 'Minenfeld entdeckt – Gasse räumen!' });
    // Scheinwerfer: Lichtkegel überstreichen die Höhen und decken Stellungen für 8 s auf
    this.lightT += dt;
    if (this.lightT > 14 && this.t < 900) {
      this.lightT = 0;
      const [x, z] = LIGHTS[this.lightI++ % LIGHTS.length];
      g.addReveal(x, z, 40, 8, 'UA');
      g.effects.marker(x, z, 0xfff2b0, 8, 36);
    }
    if (g.ended) return;
    if (g.objState('bank') === 'open' && g.countTag('bank') === 0 && capture(this, g, dt, 'bank', { x: OVER[0], z: OVER[1], r: 34, need: 3, secs: 3, allow: 0, enemyR: 40 })) { g.setObjective('bank', 'done'); g.say('Kusnezow', 'Brückenkopf steht. Jetzt die Höhen!', 4); }
    if (g.objState('line') === 'open' && g.countTag('line') === 0) { g.setObjective('line', 'done'); g.say('Kusnezow', 'Die Höhenstellung ist durchbrochen. Nach Seelow – und weiter nach Westen.', 5); }
    if (g.objState('flak') === 'open' && g.countTag('flak') === 0) g.setObjective('flak', 'done');
    if (g.objState('seelow') === 'open' && g.objState('line') === 'done' && capture(this, g, dt, 'seelow', { x: SEELOW[0], z: SEELOW[1], r: 40, need: 3, secs: 4, allow: 0, enemyR: 48 })) g.setObjective('seelow', 'done');
    if (!this.reserveDone && this.t > 520 && g.objState('line') === 'open') {
      this.reserveDone = true;
      wave(g, 'RU', [[E.panther, 2], [E.pz4, 1], [E.rifle, 6]], -200, -20, [[-110, -20], [-20, -10]], { tags: ['reserve'] });
      g.alert('Gegenstoß der Reserve von der Höhe!', 4);
    }
    if (['bank', 'line', 'seelow'].every((id) => g.objState(id) === 'done')) g.win('Die Seelower Höhen sind genommen. Der Weg nach Berlin ist offen – bezahlt mit Zehntausenden Toten auf beiden Seiten, viele davon Jugendliche. Die Ruinen von Seelow stehen still.');
    if (this.t > LIMIT) g.lose('Der Nachtangriff blieb am Steilrand stecken. Der Morgen bringt den Gegenstoß.');
  },
  victory: 'Die Höhen sind genommen. Der Weg nach Berlin ist frei – und die letzte Schlacht liegt vor uns.',
});
