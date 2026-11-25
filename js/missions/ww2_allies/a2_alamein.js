// A2 – El Alamein (Oktober 1942): Durchbruch durch den Minengürtel. Pioniere räumen Gassen, die Panzer folgen.
// Eigene Karte „angelehnt an El Alamein“: Küste im Norden, Steilkante der Senke im Süden, zwei Minengürtel quer zur Front.
import { bldg, road, rail, water, hill, field, settlement, landmarksOf } from '../../maps/places/_kit.js';
import { uk, setText, mmss, alive, fort, clearByEngineers } from './_h.js';

const BELT1 = 62, BELT2 = -52;            // x der Minengürtel (Ost = Alliierte, West = Achse)
const Z0 = -138, Z1 = 152;                // Ausdehnung der Gürtel
const LINE_X = -165;                      // Durchbruchslinie
const LIMIT = 1020;                       // s Zeitlimit
const NEED = 4;                           // Panzer, die die Linie überqueren müssen

const feats = [
  water([[-200, -200], [200, -200], [200, -150], [-200, -146]], { depth: 6, bank: 14 }),
  road([[-200, -128], [0, -126], [200, -130]], 8, true, { name: 'Küstenstraße' }),
  rail([[-200, -112], [0, -110], [200, -114]]),
  hill(-110, 70, 40, 6), hill(-20, 55, 44, 7), hill(95, 60, 40, 6), hill(150, -40, 36, 4), hill(-150, -60, 30, 5),
  hill(10, 190, 80, 22), hill(-110, 195, 70, 20), hill(120, 195, 70, 22), // Steilkante der Senke im Süden (Fahrzeugsperre)
  road([[200, 10], [60, 6], [-52, 10], [-200, 14]], 5, false, { name: 'Wüstenpiste' }),
  road([[200, -60], [-30, -70], [-200, -62]], 5, false, { name: 'Nordpiste' }),
  field([[BELT1 - 6, Z0], [BELT1 + 6, Z0], [BELT1 + 6, Z1], [BELT1 - 6, Z1]], 'stubble', 1.57),
  field([[BELT2 - 6, Z0], [BELT2 + 6, Z0], [BELT2 + 6, Z1], [BELT2 - 6, Z1]], 'stubble', 1.57),
  bldg('colonial_white', -120, -112, 18, 8, Math.PI, 1, 'Bahnhalt El Alamein'),
  bldg('water_tower', -100, -112, 4, 4, 0, 2),
];
feats.push(settlement('desert_village', -150, -95, 34, 1942, { buildingSet: 'north_africa', mainRoadAngle: 0, density: 0.35, square: false, fields: false }));

export default {
  id: 'a2', title: 'El Alamein – Teufelsgärten', place: 'Westliche Wüste, Ägypten · angelehnt an El Alamein', date: 'Oktober 1942',
  era: 'ww2', difficulty: 2,
  summary: 'Wüstenkrieg: Pioniere räumen Gassen durch zwei Minengürtel unter Pak- und Artilleriefeuer, danach rollen die Panzer durch.',
  briefing: [
    { s: 'Brigadier Hale', t: 'Rommels Linie ist keine Linie, sie ist ein Minenfeld mit Geschützen dahinter. Zwei Gürtel, Pak 40 und die gefürchteten 88er. Wir haben keine Zeit für Umwege: Südlich bricht die Senke ab, nördlich liegt das Meer.' },
    { s: 'Brigadier Hale', t: 'Die Sapper gehen zuerst. Sobald sie nah genug sind, werden die Minen sichtbar. Stellt sie direkt vor ein erkanntes Minenfeld – sie räumen es, solange sie stehen und nicht beschossen werden. Danach rollen die Panzer durch die Gasse – nicht davor.' },
    { s: 'Sergeant Cole (Sapper)', t: 'Wer querfeldein durch die Teufelsgärten fährt, verliert Ketten und Besatzung. Wir brauchen eine Gasse, zwei Minenfelder breit. Haltet die Pak mit Rauch und Artillerie nieder, solange wir arbeiten.' },
  ],
  objectivesPreview: ['Mit mindestens 4 Panzern durch beide Minengürtel brechen (Linie im Westen)', 'Optional: Beide 88-mm-Flak ausschalten', 'Optional: Höchstens 2 Sapper verlieren', 'Zeitlimit: 17 Minuten'],
  forces: ['6× Sapper', '12× Rifleman', '2× Bren-Gunner', '2× PIAT-Team', '1× Offizier', '1× Sanitäter', '4× Sherman', '2× Churchill', '2× Universal Carrier', 'Fähigkeiten: Artillerie, Nebel, Aufklärungsflug'],
  map: { size: 400, seed: 1942, season: 'summer', palette: 'desert', terrainStyle: 'desert', relief: 2.5, baseHeight: 6, seaLevel: 0, scatterTrees: 3, features: feats },
  env: { season: 'summer', sunElev: 14, sunAzim: 80, fogDensity: 0.0026 },
  weather: { type: 'clear' }, time: { start: '06:10', speed: 4 },
  camera: { x: 168, z: 0, dist: 80, yaw: -1.57 },
  markers: [
    { x: BELT1, z: 0, r: 10, label: 'Minengürtel Ost', color: '#ff6b6b' },
    { x: BELT2, z: 0, r: 10, label: 'Minengürtel West', color: '#ff6b6b' },
    { x: LINE_X, z: 0, r: 18, label: 'Durchbruchslinie', color: '#5db8ff' },
  ],
  abilities: [{ id: 'ww2_artillery', charges: 4 }, { id: 'smoke', charges: 3 }, 'ww2_recon_uk'],

  setup(g) {
    this.t0 = g.time; this.through = new Set(); this.sapperLost = 0; this.flakDone = false;
    // Eigene Truppen im Osten
    g.spawnGroup([[uk.engineer, 6], [uk.medic, 1], [uk.officer, 1]], 'UA', 170, 0, { spacing: 3.4, cols: 4, heading: Math.PI / 2 });
    g.spawnGroup([[uk.rifle, 12], [uk.lmg, 2], [uk.at, 2]], 'UA', 182, -6, { spacing: 3.4, cols: 5, heading: Math.PI / 2 });
    g.spawnGroup([['ww2_sherman', 4], ['ww2_churchill', 2]], 'UA', 192, 4, { spacing: 12, cols: 2, heading: Math.PI / 2, tags: ['tank'] });
    g.spawnGroup([['ww2_carrier', 2]], 'UA', 176, 24, { spacing: 8, cols: 2, heading: Math.PI / 2 });
    // Minengürtel: Reihe aus Panzerminen-Feldern (je 3 Minen), lückenlos
    for (const bx of [BELT1, BELT2]) for (let z = Z0; z <= Z1; z += 8) fort(g, 'ww2_mines_at', 'RU', bx, z, { mines: 3, tags: ['mine'] });
    // Achsen-Verteidigung zwischen und hinter den Gürteln
    g.spawn('ww2_pak40', 'RU', 30, -40, { heading: -Math.PI / 2, ai: { mode: 'hold' } });
    g.spawn('ww2_pak40', 'RU', 28, 30, { heading: -Math.PI / 2, ai: { mode: 'hold' } });
    g.spawn('ww2_pak40', 'RU', 32, 92, { heading: -Math.PI / 2, ai: { mode: 'hold' } });
    g.spawnGroup([['ww2_de_rifle', 5], ['ww2_de_mg42', 2]], 'RU', 22, -10, { spacing: 3.5, cols: 4, ai: { mode: 'guard', radius: 24 } });
    g.spawnGroup([['ww2_de_rifle', 4], ['ww2_de_mg42', 1], ['ww2_de_mortar', 1]], 'RU', 18, 60, { spacing: 3.5, cols: 4, ai: { mode: 'guard', radius: 24 } });
    fort(g, 'ww2_mgnest', 'RU', 40, 6, { heading: -Math.PI / 2 });
    fort(g, 'ww2_mgnest', 'RU', 40, -78, { heading: -Math.PI / 2 });
    g.spawn('ww2_flak88', 'RU', -86, -26, { heading: -Math.PI / 2, ai: { mode: 'hold' }, tags: ['flak'] });
    g.spawn('ww2_flak88', 'RU', -90, 44, { heading: -Math.PI / 2, ai: { mode: 'hold' }, tags: ['flak'] });
    g.spawnGroup([['ww2_de_rifle', 5], ['ww2_de_mg42', 2], ['ww2_de_panzer', 2]], 'RU', -100, 8, { spacing: 3.5, cols: 5, ai: { mode: 'guard', radius: 30 } });
    g.spawn('ww2_pz4', 'RU', -118, -10, { ai: { mode: 'hold' } });
    g.spawn('ww2_pz4', 'RU', -116, 26, { ai: { mode: 'hold' } });
    g.addObjective('break', `Mit ${NEED} Panzern durch beide Minengürtel brechen (0/${NEED}) – ${mmss(LIMIT)}`);
    g.addObjective('flak', 'Beide 88-mm-Flak ausschalten', { optional: true });
    g.addObjective('sappers', 'Höchstens 2 Sapper verlieren', { optional: true });
    g.later(2, () => g.say('Cole', 'Sapper vor! Sobald die Minen sichtbar werden, stellt uns direkt davor – wir räumen eine Gasse.', 6));
    g.later(14, () => g.say('Hale', 'Artillerie auf die Pak-Stellungen legen und Nebel vor die Gasse, dann erst die Panzer nachziehen.', 6));
    // Gegenangriff der Achse aus dem Westen (Panzer + Infanterie)
    g.later(150, () => {
      g.spawnGroup([['ww2_pz4', 2], ['ww2_de_rifle', 5]], 'RU', -175, 0, { spacing: 7, cols: 4, ai: { mode: 'attackMove', points: [[-60, 4], [10, 4]], aggressive: true, after: 'guard' } });
      g.alert('⚠ Panzer-Gegenangriff von Westen!', 3); g.say('Hale', 'Deutsche Panzer rücken zum Gegenstoß vor. Sherman nach vorn!', 4);
    });
    g.later(420, () => {
      g.spawnGroup([['ww2_pz4', 2], ['ww2_stug3', 1], ['ww2_de_rifle', 5], ['ww2_de_mg42', 1]], 'RU', -175, 20, { spacing: 7, cols: 4, ai: { mode: 'attackMove', points: [[-30, 20], [60, 10]], aggressive: true, after: 'guard' } });
      g.alert('⚠ Zweiter Gegenstoß!', 3);
    });
    g.later(420, () => { // Verstärkung der Achse? Nein: Nachschub der Briten (Sapper + Schützen)
      g.spawnGroup([[uk.engineer, 3], [uk.rifle, 4]], 'UA', 195, -10, { spacing: 3.4, cols: 4, heading: Math.PI / 2, ai: { mode: 'attackMove', points: [[120, 0]], after: 'guard' } });
      g.say('Hale', 'Drei weitere Sapper und eine Schützengruppe sind unterwegs.', 4);
    });
  },
  onKill(g, u) {
    if (u.side === 'UA' && u.type.engineer) { this.sapperLost++; if (this.sapperLost > 2) g.setObjective('sappers', 'failed'); }
  },
  update(g, dt) {
    if (g.ended) return;
    clearByEngineers(g, dt);
    const left = LIMIT - (g.time - this.t0);
    // Durchbruch zählen: Panzer, die die Linie im Westen überquert haben (zählt auch, wenn sie danach fallen)
    for (const u of g.units) if (u.alive && u.side === 'UA' && u.tags.has('tank') && u.pos.x < LINE_X) this.through.add(u.id);
    const n = this.through.size;
    setText(g, 'break', `Mit ${NEED} Panzern durch beide Minengürtel brechen (${Math.min(n, NEED)}/${NEED}) – ${mmss(left)}`);
    if (g.objState('flak') === 'open' && g.countTag('flak') === 0) { g.setObjective('flak', 'done'); g.say('Hale', 'Beide 88er sind erledigt – der Weg ist frei für die Panzer.', 4); }
    if (n >= NEED) {
      g.setObjective('break', 'done');
      if (g.objState('sappers') === 'open') g.setObjective('sappers', 'done');
      g.say('Hale', 'Wir sind durch! Die Panzerdivisionen können nachrücken.', 5);
      g.win('Der Durchbruch ist gelungen. Die Achsenlinie ist aufgebrochen.');
      return;
    }
    const tanks = alive(g, 'UA', (u) => u.tags.has('tank') && !this.through.has(u.id)).length;
    if (tanks + n < NEED) { g.setObjective('break', 'failed'); g.lose('Zu viele Panzer sind in den Minen und im Pak-Feuer geblieben – der Durchbruch ist gescheitert.'); return; }
    if (left <= 0) { g.setObjective('break', 'failed'); g.lose('Die Zeit ist abgelaufen. Der Durchbruch ist nicht gelungen.'); }
  },
  victory: 'Nach Tagen zäher Kämpfe um die Gürtel brach die Front auf. Die Achse musste sich zurückziehen – der Wendepunkt des Wüstenkriegs.',
};
