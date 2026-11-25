// C3 – Gazala (Mai/Juni 1942): Wüstenkrieg. Panzergefecht um eine verminte Box-Stellung; Treibstoff und Munition kommen nur mit dem Tross.
// Logistikmodus (mission.logistics): Fahrzeuge verbrauchen Sprit, Waffen Munition – Versorgungs-Lkw füllen beides im Umkreis auf.
import { bldg, road, hill, water, field, settlement, landmarksOf } from '../../maps/places/_kit.js';
import { de, uk, setText, mmss, alive, fort, wave, holdZone, clearByEngineers, reinforce, near } from './_h.js';

const BOX = [-92, 8];            // Mittelpunkt der Box
const BASE = [232, 6];           // Nachschublager im Osten
const LIMIT = 1200;
const START_FUEL = 75;          // s Fahrzeit bei Missionsbeginn (Tank fast leer)

const feats = [
  hill(-180, 140, 70, 9), hill(-40, 175, 80, 11), hill(110, 165, 70, 10), hill(-170, -150, 60, 7), hill(60, -170, 70, 8), hill(-250, 20, 60, 8),
  road([[-280, -60], [-100, -62], [60, -58], [280, -64]], 6, false, { name: 'Trigh Capuzzo' }),
  road([[-280, 112], [-90, 108], [100, 112], [280, 106]], 6, false, { name: 'Trigh el Abd' }),
  road([[BOX[0], BOX[1]], [60, 8], [BASE[0], BASE[1]]], 6, false, { name: 'Pad zur Box' }),
  road([[-280, 6], [BOX[0], BOX[1]]], 5, false, { name: 'Westpiste' }),
  field([[-150, -40], [-34, -40], [-34, 58], [-150, 58]], 'stubble', 0.2),
  bldg('colonial_white', BOX[0] + 4, BOX[1] - 4, 18, 9, 0.4, 1, 'Gefechtsstand der Box'), bldg('water_tower', BOX[0] - 14, BOX[1] + 10, 4, 4, 0, 2, 'Zisterne'),
  bldg('warehouse', BASE[0] - 8, BASE[1] + 20, 20, 10, 0, 1, 'Nachschublager'), bldg('warehouse', BASE[0] - 12, BASE[1] - 22, 16, 9, 0, 1),
];

export default {
  id: 'c3', era: 'ww2', difficulty: 2,
  title: 'Gazala – Die Box', place: 'Cyrenaika, Libyen · angelehnt an die Gazala-Linie', date: 'Ende Mai 1942',
  summary: 'Panzergefecht in der Wüste: Eine verminte Box-Stellung brechen – mit zu wenig Sprit, begrenzter Munition und einem Tross, der geschützt werden muss.',
  briefing: [
    { s: 'Oberleutnant Rahn', t: 'Die Tanks sind fast leer, die Munition reicht für ein, zwei Gefechte. Der Nachschub kommt über Hunderte Kilometer Wüstenpiste, und jeder Lkw, den die Jabos erwischen, fehlt uns. Das ist der eigentliche Krieg hier: nicht die Panzer, sondern der Sprit.' },
    { s: 'Feldwebel Aigner', t: 'Vor uns liegt die Box: Minenfelder, Draht, Pak-Nester und mittendrin eine Garnison, die weiß, dass wir vorbeikommen müssen. Pioniere räumen eine Gasse, die Panzer folgen, die Lkw bleiben dicht dahinter – wer den Tross verliert, steht nach zwei Kilometern still.' },
    { s: 'Gefreiter Haas (Fahrer)', t: 'Es sind vierzig Grad im Turm, der Staub zerreißt die Motoren. Heute Mittag soll ein Sandsturm aufziehen: Dann sieht man nichts mehr, und alle schießen auf alles. Und wofür das alles – ein Stück Sand mit einem Brunnen. Aber meine Kameraden sitzen drin.' },
  ],
  objectivesPreview: ['Die Box einnehmen (Gefechtsstand im Zentrum)', 'Pioniere räumen die Gasse durch die Minengürtel', 'Optional: Mindestens 2 Versorgungs-Lkw erhalten', 'Optional: Beide Pak-Stellungen ausschalten', 'Zeitlimit: 20 Minuten'],
  forces: ['5× Panzer IV (Tank fast leer!)', '2× StuG III', '2× Sd.Kfz. 251', '14× Schützen/MG', '4× Pioniere', '2× Versorgungs-Lkw (Munition, Sprit)', 'Fähigkeiten: Artillerie, Stuka-Angriff, Rauch, Aufklärungsflug'],
  map: { size: 560, seed: 1942, season: 'summer', palette: 'desert', terrainStyle: 'desert', relief: 3, baseHeight: 6, seaLevel: 0, scatterTrees: 2, features: feats },
  env: { season: 'summer', sunElev: 62, sunAzim: 160, fogDensity: 0.0022 },
  weather: { type: 'clear', changes: [{ at: 240, type: 'fog', intensity: 0.65, fade: 40 }, { at: 430, type: 'clear', intensity: 0, fade: 90 }] },
  time: { start: '11:00', speed: 3 },
  camera: { x: 150, z: 0, dist: 120, yaw: -1.57 },
  logistics: true,
  supplyPoints() { return [{ x: BASE[0], z: BASE[1], r: 32, team: 'UA', direct: false }]; },
  markers: [
    { x: BOX[0], z: BOX[1], r: 30, label: 'Box (Gefechtsstand)', color: '#ff6b6b' },
    { x: BASE[0], z: BASE[1], r: 32, label: 'Nachschublager (Lkw füllen hier auf)', color: '#7be07b' },
  ],
  abilities: [{ id: 'ww2_artillery', charges: 2 }, { id: 'ww2_airstrike_de', charges: 1 }, { id: 'smoke', charges: 3 }, 'ww2_recon_de'],

  setup(g) {
    this.t0 = g.time; this.box = {}; this.trucksLost = 0; this.counter = false;
    // Eigene Truppen im Osten, Treibstoff bewusst knapp (Fahrzeuge verbrauchen 1 Einheit je Fahrsekunde)
    const tanks = g.spawnGroup([['ww2_pz4', 5], ['ww2_stug3', 2]], 'UA', 196, 4, { spacing: 12, cols: 3, heading: -Math.PI / 2, tags: ['tank'] });
    for (const u of tanks) if (u.maxFuel) u.fuel = START_FUEL;
    const htr = g.spawnGroup([['ww2_sdkfz251', 2]], 'UA', 200, 38, { spacing: 10, cols: 2, heading: -Math.PI / 2, tags: ['htr'] });
    for (const u of htr) if (u.maxFuel) u.fuel = START_FUEL;
    g.spawnGroup([[de.rifle, 8], [de.lmg, 3], [de.smg, 2], [de.at, 1], [de.officer, 1], [de.medic, 1]], 'UA', 212, -8, { spacing: 3.4, cols: 5, heading: -Math.PI / 2 });
    g.spawnGroup([[de.engineer, 4]], 'UA', 212, 22, { spacing: 3.4, cols: 4, heading: -Math.PI / 2 });
    g.spawnGroup([['ww2_opel', 2]], 'UA', 224, -26, { spacing: 10, cols: 2, heading: -Math.PI / 2, tags: ['truck'] });
    // Die Box: Minengürtel mit Gasse-freien Feldern, Draht, MG-Nester, Pak, Panzer in Reserve
    for (let a = 0; a < Math.PI * 2; a += 0.55) {
      const r = 58, x = BOX[0] + Math.cos(a) * r, z = BOX[1] + Math.sin(a) * r * 0.9;
      if (Math.cos(a) > 0.5) fort(g, 'ww2_mines_at', 'RU', x, z, { mines: 3, tags: ['mine'] });
      else fort(g, 'ww2_mines_ap', 'RU', x, z, { mines: 4, tags: ['mine'] });
    }
    for (const z of [-18, 4, 26]) fort(g, 'ww2_mines_at', 'RU', BOX[0] + 52, BOX[1] + z, { mines: 3, tags: ['mine'] });
    for (const z of [-26, 0, 22]) fort(g, 'ww2_barbedwire', 'RU', BOX[0] + 44, BOX[1] + z, {});
    fort(g, 'ww2_mgnest', 'RU', BOX[0] + 34, BOX[1] - 22, { heading: Math.PI / 2 });
    fort(g, 'ww2_mgnest', 'RU', BOX[0] + 34, BOX[1] + 20, { heading: Math.PI / 2 });
    fort(g, 'ww2_mgnest', 'RU', BOX[0] - 30, BOX[1] + 2, { heading: -Math.PI / 2 });
    fort(g, 'ww2_foxhole', 'RU', BOX[0] + 24, BOX[1] - 4, {}); fort(g, 'ww2_foxhole', 'RU', BOX[0] + 8, BOX[1] + 14, {});
    g.spawn('ww2_6pdr', 'RU', BOX[0] + 30, BOX[1] - 4, { heading: Math.PI / 2, ai: { mode: 'hold' }, tags: ['pak'] });
    g.spawn('ww2_6pdr', 'RU', BOX[0] + 26, BOX[1] + 30, { heading: Math.PI / 2, ai: { mode: 'hold' }, tags: ['pak'] });
    g.spawn('ww2_6pdr', 'RU', BOX[0] + 10, BOX[1] - 26, { heading: Math.PI / 2, ai: { mode: 'hold' } });
    g.spawn('ww2_6pdr', 'RU', BOX[0] + 8, BOX[1] + 36, { heading: Math.PI / 2, ai: { mode: 'hold' } });
    fort(g, 'ww2_mgnest', 'RU', BOX[0] + 4, BOX[1] - 30, { heading: Math.PI / 2 });
    g.spawnGroup([[uk.rifle, 6], [uk.lmg, 2], [uk.at, 2]], 'RU', BOX[0] + 2, BOX[1] - 24, { spacing: 3.5, cols: 5, ai: { mode: 'guard', radius: 26 } });
    g.spawnGroup([[uk.rifle, 8], [uk.lmg, 2], [uk.at, 2]], 'RU', BOX[0] + 14, BOX[1] - 2, { spacing: 3.5, cols: 5, ai: { mode: 'guard', radius: 28 } });
    g.spawnGroup([[uk.rifle, 6], [uk.mortar, 1]], 'RU', BOX[0] - 8, BOX[1] + 12, { spacing: 3.5, cols: 4, ai: { mode: 'guard', radius: 26 } });
    g.spawnGroup([['ww2_sherman', 4], ['ww2_carrier', 2]], 'RU', BOX[0] - 18, BOX[1] - 12, { spacing: 10, cols: 3, ai: { mode: 'guard', radius: 34 } });
    g.addObjective('box', 'Die Box einnehmen (Gefechtsstand im Zentrum)');
    g.addObjective('lanes', 'Gasse durch die Minengürtel räumen (Pioniere vor die Minen stellen)');
    g.addObjective('tross', 'Mindestens 2 Versorgungs-Lkw erhalten', { optional: true });
    g.addObjective('pak', 'Beide Pak-Stellungen ausschalten', { optional: true });
    g.later(3, () => g.say('Rahn', 'Tank prüfen! Die Anzeige unter dem Panzersymbol zeigt den Sprit. Die Lkw füllen im Umkreis von 15 Metern auf – Munition und Treibstoff.', 7));
    g.later(25, () => g.say('Aigner', 'Pioniere vor die Minen! Erst die Gasse, dann die Panzer. Wer querfeldein fährt, verliert die Kette.', 6));
    g.later(200, () => g.say('Haas', 'Staub am Horizont. Das wird ein Sandsturm – dann auf die Minen achten, man sieht nichts mehr.', 5));
    // Flankenstoß der Gegenseite auf den Tross, Panzer aus dem Süden
    g.later(330, () => { g.alert('⚠ Aufklärer greifen den Tross an!', 4); wave(g, [['ww2_carrier', 2], [uk.rifle, 4]], 150, 180, [[190, 100], [212, 20]], { tags: ['w'], after: 'attackMove' }); });
    g.later(520, () => { g.alert('⚠ Gegnerische Panzer aus Süden!', 4); wave(g, [['ww2_sherman', 3], [uk.rifle, 4]], -20, 210, [[-40, 100], [-70, 30]], { tags: ['w'] }); });
    // Nachschubkolonne trifft später ein (neue Lkw, voller Vorrat)
    g.later(380, () => { reinforce(g, [['ww2_opel', 2]], 262, 6, { heading: -Math.PI / 2, spacing: 8, tags: ['truck'] }); g.say('Rahn', 'Nachschubkolonne am Lager eingetroffen. Zwei Lkw mit Sprit und Munition – holt sie ab.', 5); });
  },

  onKill(g, u) { if (u.side === 'UA' && u.tags?.has('truck')) { this.trucksLost++; } },

  update(g, dt) {
    if (g.ended) return;
    clearByEngineers(g, dt);
    const t = g.time - this.t0;
    // V3-R (Balance, war zu leicht: Automatik nach 232 s mit allen Nebenzielen): Sobald eigene Truppen die Box erreichen,
    // wirft der Gegner seine Panzerreserve aus dem Westen hinein
    if (!this.counter && near(g, 'UA', BOX[0], BOX[1], 70).length >= 3) {
      this.counter = true;
      g.alert('⚠ Gegenangriff: Panzerreserve aus Westen!', 4);
      wave(g, [['ww2_sherman', 3], [uk.rifle, 4], [uk.at, 1]], -250, 20, [[-160, 14], [BOX[0], BOX[1]]], { tags: ['w'] });
    }
    const laneMines = g.units.filter((u) => u.alive && u.side === 'RU' && u.type.mineKind && Math.hypot(u.pos.x - (BOX[0] + 55), u.pos.z - (BOX[1] + 2)) < 8).length;
    setText(g, 'lanes', laneMines ? `Gasse durch den Minengürtel räumen – noch ${laneMines} Minenfelder` : 'Gasse durch den Minengürtel ist geräumt');
    if (!laneMines && g.objState('lanes') === 'open') g.setObjective('lanes', 'done');
    if (g.objState('pak') === 'open' && g.countTag('pak') === 0) g.setObjective('pak', 'done');
    const trucks = alive(g, 'UA', (u) => u.tags.has('truck')).length;
    if (g.objState('tross') === 'open' && trucks < 2) g.setObjective('tross', 'failed');
    const tanks = alive(g, 'UA', (u) => u.tags.has('tank'));
    const stuck = tanks.length > 0 && tanks.every((u) => u.maxFuel > 0 && u.fuel <= 0.5);
    if (holdZone(g, dt, this.box, BOX[0], BOX[1], 26, { need: 4, secs: 20, allow: 1, enemyR: 32 })) {
      g.setObjective('box', 'done');
      if (g.objState('tross') === 'open') g.setObjective('tross', trucks >= 2 ? 'done' : 'failed');
      g.win('Die Box ist gefallen. Gefangene, Verwundete, ausgebrannte Fahrzeuge zwischen den Minenfeldern. Der Vormarsch geht weiter – bis der Sprit wieder ausgeht. Die Männer auf beiden Seiten, die hier liegen, haben mit dem Sinn dieses Krieges nichts mehr zu tun.');
      return;
    }
    if (!tanks.length && t > 5) { g.setObjective('box', 'failed'); g.lose('Alle Panzer sind ausgefallen. Der Vorstoß endet in der Wüste.'); return; }
    if (stuck && trucks === 0) { g.setObjective('box', 'failed'); g.lose('Ohne Tross und ohne Treibstoff bleiben die Panzer liegen. Die Besatzungen sprengen sie in der Nacht.'); return; }
    if (t > LIMIT) { g.setObjective('box', 'failed'); g.lose('Zeit abgelaufen: Der Gegner hat sich verstärkt, die Box bleibt in seiner Hand.'); }
  },
  victory: 'Die Box ist genommen. Was bleibt, sind Gefangene, Verwundete und eine Wüste, in der die Fahrzeuge bald wieder ohne Treibstoff stehen.',
};
