// A1 – Dünkirchen (Mai/Juni 1940): Rückzugsgefecht. Kanalbrücken am Rand des Brückenkopfes halten, bis die Boote ablegen.
import { placeMission, PLACE_BY_ID } from '../../maps/places/index.js';
import { uk, de, setText, mmss, stukaStrike, alive, fort } from './_h.js';

const PLACE = PLACE_BY_ID.duenkirchen;
const HOLD = 600;                // s bis „Boote legen ab“
const BR_W = [-30, 205], BR_E = [150, 210]; // Kanalbrücken Süd / Rosendaël
const ROUTE_W = [[-30, 222], [-30, 160], [-38, 90]];
const ROUTE_E = [[150, 228], [150, 160], [60, 100]];
const WAVES = [
  { t: 25, at: 'W', u: [['ww2_de_rifle', 3], ['ww2_de_mg42', 1]] },
  { t: 85, at: 'E', u: [['ww2_de_rifle', 3], ['ww2_de_mp40', 1]] },
  { t: 170, at: 'W', u: [['ww2_de_rifle', 4], ['ww2_de_mg42', 1], ['ww2_pz4', 1]] },
  { t: 260, at: 'E', u: [['ww2_de_rifle', 5], ['ww2_de_mg42', 1]] },
  { t: 350, at: 'E', u: [['ww2_de_rifle', 5], ['ww2_de_mp40', 1], ['ww2_stug3', 1]] },
  { t: 430, at: 'W', u: [['ww2_de_rifle', 6], ['ww2_de_mp40', 2], ['ww2_de_mg42', 1]] },
];

const mission = placeMission(PLACE, {
  id: 'a1', title: 'Dünkirchen – Der Kanal hält', place: 'Dünkirchen, Frankreich · Brückenkopf am Kanal', date: '31. Mai 1940',
  era: 'ww2', difficulty: 1, structures: false, markers: false,
  summary: 'Rückzugsgefecht am Brückenkopf: Zwei Kanalbrücken halten, Stuka-Angriffe überstehen und auf die Boote warten.',
  briefing: [
    { s: 'Major Hartley', t: 'Die Armee steht mit dem Rücken zum Meer. Am Strand und an den Molen warten Tausende auf die Boote. Jede Stunde, die dieser Kanal hält, bringt hunderte Männer nach England.' },
    { s: 'Major Hartley', t: 'Ihr haltet die beiden Kanalbrücken im Süden. Die Deutschen greifen mit Infanterie und Panzern über beide Brücken an, und die Stukas heulen ab dem Mittag über uns. Deckung nutzen, nicht zurückweichen.' },
    { s: 'Lieutenant Price', t: 'Wir haben wenig Munition, aber Rauch, ein paar Granaten und die Bofors. In zehn Minuten legen die letzten Boote dieser Staffel ab. Dann sind wir dran – bis dahin: halten.' },
  ],
  objectivesPreview: ['Kanalbrücken halten, bis die Boote ablegen (10 Minuten)', 'Nicht zulassen, dass der Feind in die Stadt durchbricht', 'Optional: Mörserstellung südlich des Kanals ausschalten', 'Optional: Höchstens 12 Mann verlieren'],
  forces: ['12× Rifleman', '4× Bren-Gunner', '4× PIAT-Team', '1× Offizier', '2× Sanitäter', '2× Scharfschütze', '1× Mörsertrupp', '4× 6-pdr Pak', '1× Bofors-Flak', '2× Universal Carrier', 'Verstärkung: weitere Schützen und Pak', 'Fähigkeiten: Nebel, Artillerie, Aufklärungsflug'],
  weather: { type: 'overcast', intensity: 0.55 }, time: { start: '12:00', speed: 4 },
  camera: { x: 60, z: 170, dist: 120 },
  abilities: [{ id: 'smoke', charges: 4 }, { id: 'ww2_artillery', charges: 3 }, 'ww2_recon_uk'],

  setup(g) {
    this.lost = 0; this.breachT = 0; this.mortarDone = false;
    this.t0 = g.time;
    // Verteidiger am Nordufer des Kanals
    g.spawnGroup([[uk.rifle, 6], [uk.lmg, 2], [uk.at, 2]], 'UA', -34, 172, { spacing: 3.2, cols: 4, heading: Math.PI });
    g.spawnGroup([[uk.rifle, 6], [uk.lmg, 2], [uk.at, 2]], 'UA', 148, 176, { spacing: 3.2, cols: 4, heading: Math.PI });
    g.spawnGroup([[uk.sniper, 2], [uk.medic, 1]], 'UA', -30, 166, { spacing: 3, cols: 3, heading: Math.PI });
    g.spawnGroup([[uk.officer, 1], [uk.medic, 1], [uk.mortar, 1]], 'UA', 50, 160, { spacing: 4, cols: 3, heading: Math.PI });
    for (const [x, z] of [[-22, 160], [-48, 162], [138, 164], [162, 166]]) g.spawn('ww2_6pdr', 'UA', x, z, { heading: Math.PI });
    g.spawn('ww2_bofors_uk', 'UA', 60, 140, { heading: Math.PI });
    g.spawn('ww2_carrier', 'UA', -44, 150, { heading: Math.PI });
    g.spawn('ww2_carrier', 'UA', 160, 150, { heading: Math.PI });
    // Stellungen: MG-Nester und Schützenlöcher an den Brückenköpfen
    for (const [x, z] of [[-40, 182], [-22, 180], [140, 184], [158, 186]]) fort(g, 'ww2_mgnest', 'UA', x, z, { heading: Math.PI });
    for (const [x, z] of [[-48, 176], [-30, 176], [-14, 178], [134, 180], [150, 182], [164, 180]]) fort(g, 'ww2_foxhole', 'UA', x, z, {});
    for (const [x, z] of [[-48, 168], [-36, 166], [-24, 168], [138, 172], [150, 170], [162, 172]]) fort(g, 'ww2_barbedwire', 'UA', x, z, {});
    // Feindliche Mörserstellung südlich des Kanals (Nebenziel)
    g.spawnGroup([['ww2_de_mortar', 2], ['ww2_de_rifle', 3]], 'RU', 60, 262, { spacing: 4, cols: 5, ai: { mode: 'guard', radius: 26 }, tags: ['mortar'] });
    // Rauch über Hafen und Strand
    for (const [x, z, r] of [[-170, -40, 16], [-120, -80, 14], [-10, -130, 14], [100, -140, 14]]) g.tac?.addSmoke(x, z, r, 1500, 0);

    g.addObjective('hold', `Kanalbrücken halten – Boote legen ab in ${mmss(HOLD)}`);
    g.addObjective('perimeter', 'Feind nicht in die Stadt durchbrechen lassen');
    g.addObjective('mortar', 'Mörserstellung südlich des Kanals ausschalten', { optional: true });
    g.addObjective('losses', 'Höchstens 12 Mann verlieren', { optional: true });
    g.later(2, () => g.say('Hartley', 'Feind in Sicht südlich des Kanals. Stellungen halten, Feuer erst auf Kommando!', 5));
    g.later(12, () => g.say('Price', 'Jeder Mann sucht sich Deckung. Die Pak 6-Pfünder decken die Brücken, die Bofors schützt uns vor den Stukas.', 6));
    for (const w of WAVES) g.later(w.t, () => this.wave(g, w));
    // Stuka-Angriffe auf die Stellungen (Zielgebiet wird kurz vorher markiert, die Bofors würfelt mit)
    for (const [t, x, z] of [[110, -95, 150], [270, 100, 152], [420, 20, 130], [520, -100, 140]]) {
      g.later(t - 9, () => { if (!g.ended) { g.alert('⚠ Stukas im Anflug – Zielgebiet markiert!', 4); g.markerTo('UA', x, z, 0xff3030, 9, 18); } });
      g.later(t, () => stukaStrike(g, x, z));
    }
    g.later(230, () => { // Verstärkung vom Perimeter
      g.spawnGroup([[uk.rifle, 5], [uk.lmg, 1]], 'UA', -10, 40, { spacing: 3.2, cols: 4, heading: Math.PI, ai: { mode: 'attackMove', points: [[-20, 150]], after: 'guard' } });
      g.say('Hartley', 'Verstärkung aus der Stadt: sechs Mann der Guards. Mehr haben wir nicht.', 5);
    });
    g.later(400, () => {
      g.spawn('ww2_6pdr', 'UA', 80, 60, { heading: Math.PI, ai: { mode: 'hold' } });
      g.spawnGroup([[uk.rifle, 4], [uk.at, 1]], 'UA', 70, 40, { spacing: 3.2, cols: 4, heading: Math.PI, ai: { mode: 'attackMove', points: [[100, 160]], after: 'guard' } });
      g.say('Hartley', 'Eine letzte Pak und eine Handvoll Schützen von der Küste – verteilt sie auf die Brücken!', 5);
    });
    g.later(HOLD - 90, () => g.say('Price', 'Noch anderthalb Minuten bis zum Ablegen. Durchhalten, Jungs!', 4));
  },
  wave(g, w) {
    if (g.ended) return;
    const [x, z, route] = w.at === 'W' ? [-30, 285, ROUTE_W] : [155, 288, ROUTE_E];
    g.spawnGroup(w.u, 'RU', x, z, { spacing: 4.5, cols: 5, heading: Math.PI, ai: { mode: 'attackMove', points: route.map((p) => [...p]), aggressive: true, aggroRadius: 45, after: 'guard' } });
    g.alert(w.at === 'W' ? '⚠ Angriff über die Westbrücke!' : '⚠ Angriff über die Ostbrücke (Rosendaël)!', 3);
  },
  onKill(g, u) {
    if (u.side === 'UA' && u.type.infantry && !u.type.structure) {
      this.lost++;
      if (this.lost > 12) g.setObjective('losses', 'failed');
    }
  },
  update(g, dt) {
    if (g.ended) return;
    const left = HOLD - (g.time - this.t0);
    setText(g, 'hold', `Kanalbrücken halten – Boote legen ab in ${mmss(left)}`);
    if (g.objState('mortar') === 'open' && g.countTag('mortar') === 0) { g.setObjective('mortar', 'done'); g.say('Price', 'Die Mörser sind still. Gute Arbeit!', 4); }
    // Durchbruch: viele Feinde nördlich der Kanallinie
    const inside = alive(g, 'RU', (u) => u.pos.z < 110).length;
    this.breachT = inside >= 5 ? this.breachT + dt : 0;
    if (this.breachT > 6) { g.setObjective('perimeter', 'failed'); g.setObjective('hold', 'failed'); g.lose('Der Feind ist in die Stadt eingebrochen – der Weg zum Strand ist offen. Die Boote müssen ohne Deckung ablegen.'); return; }
    if (left <= 0) {
      g.setObjective('hold', 'done'); g.setObjective('perimeter', 'done');
      if (g.objState('losses') === 'open') g.setObjective('losses', 'done');
      g.say('Hartley', 'Die Boote legen ab! Rückzug zum Strand, die Nachhut folgt. Gut gehalten.', 5);
      g.win('Die Kanallinie hat gehalten. Tausende Soldaten konnten übersetzen.');
    }
  },
  victory: 'Der Brückenkopf hielt, bis die Boote abgelegt hatten. In den folgenden Tagen konnten über 330.000 Soldaten die Küste verlassen – die Armee war gerettet, doch ihre Ausrüstung blieb am Strand zurück.',
});
mission.markers = [
  { x: BR_W[0], z: BR_W[1], r: 14, label: 'Westbrücke', color: '#7f9fc4' },
  { x: BR_E[0], z: BR_E[1], r: 14, label: 'Brücke Rosendaël', color: '#7f9fc4' },
  { x: -150, z: -230, r: 12, label: 'Ostmole (Einschiffung)', color: '#ffe9a8' },
];
export default mission;
