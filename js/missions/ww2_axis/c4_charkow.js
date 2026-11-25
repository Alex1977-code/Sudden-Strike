// C4 – Charkow (Februar/März 1943): Häuserkampf im Winter. Platz der Freiheit, Lopan-Brücke und Hauptbahnhof nehmen; die Rasputiza setzt ein.
// Eigene Karte „angelehnt an Charkow“: Lopan (NW → SO) mit zwei Brücken, großer Platz im Westen, Bahnhof im Süden, Blockbebauung.
import { bldg, road, rail, river, hill, forest, bridge, settlement, landmarksOf } from '../../maps/places/_kit.js';
import { de, su, setText, mmss, alive, fort, wave, holdZone, reinforce } from './_h.js';

const SQ = [-120, 16], BR = [10, -6], ST = [64, 168];
const T_END = 720, LIMIT = 1100;

const feats = [
  river([[-110, -270], [-40, -140], [-10, -40], [30, 40], [58, 110], [130, 270]], 16, { depth: 2.2, bank: 4, name: 'Lopan' }),
  ...bridge([[-12, -6], [34, -6]], 11, 'Lopan-Brücke', true, 'concrete_beam'),
  ...bridge([[-86, -110], [-40, -110]], 9, 'Brücke Nord', true, 'steel_truss'),
  road([[-270, 16], [SQ[0], SQ[1]], [-60, 8], [-12, -6], [34, -6], [130, -10], [270, -14]], 10, true, { name: 'Prospekt' }),
  road([[SQ[0] - 20, SQ[1]], [SQ[0] + 20, SQ[1]]], 56, true, { square: true, name: 'Platz der Freiheit' }),
  road([[-86, -110], [-130, -40], [SQ[0], SQ[1] - 20]], 8, true), road([[-40, -110], [60, -110], [120, -100]], 8, true),
  road([[SQ[0], SQ[1] + 28], [-70, 110], [-10, 150], [ST[0], ST[1]]], 9, true, { name: 'Bahnhofstraße' }),
  rail([[-270, 200], [-80, 196], [ST[0] - 30, ST[1] + 14], [ST[0] + 60, ST[1] + 12], [270, 190]]),
  rail([[ST[0] - 40, ST[1] + 26], [ST[0] + 70, ST[1] + 26]]),
  bldg('station_ww2', ST[0], ST[1], 38, 12, 0, 2, 'Hauptbahnhof'),
  bldg('industrial', SQ[0] + 36, SQ[1] - 40, 40, 18, 0, 5, 'Haus der Industrie'),
  bldg('industrial', SQ[0] - 36, SQ[1] + 36, 30, 16, 1.5, 4, 'Verwaltungsgebäude'),
  bldg('church_orthodox', 70, -50, 12, 16, 0.6, 2, 'Kirche'),
  hill(-200, -140, 60, 6), hill(190, 120, 60, 6), hill(-190, 150, 50, 4),
  forest([[170, -200], [262, -200], [262, -120], [190, -130]], 'mixed', 0.04),
  forest([[-262, 200], [-170, 210], [-180, 262], [-262, 262]], 'mixed', 0.04),
];
feats.push(
  settlement('german_city', SQ[0], SQ[1] + 4, 108, 1943, { buildingSet: 'stalingrad_1942', era: 'ww2', density: 0.78, mainRoadAngle: 0, square: false, cemetery: false, fields: false, keepOut: [{ x: SQ[0], z: SQ[1], r: 32 }] }),
  settlement('german_city', 100, -20, 100, 1944, { buildingSet: 'stalingrad_1942', era: 'ww2', density: 0.74, mainRoadAngle: 0.15, cemetery: false, fields: false, keepOut: [{ x: BR[0], z: BR[1], r: 18 }] }),
  settlement('german_city', 60, 150, 80, 1945, { buildingSet: 'stalingrad_1942', era: 'ww2', density: 0.7, mainRoadAngle: 0.3, cemetery: false, fields: false, keepOut: [{ x: ST[0], z: ST[1], r: 30 }] }),
);

export default {
  id: 'c4', era: 'ww2', difficulty: 3,
  title: 'Charkow – Häuserkampf', place: 'Charkow, Ukraine · angelehnt an den Stadtkern von Charkow', date: 'Februar/März 1943',
  summary: 'Winterkampf um eine große Stadt: Platz der Freiheit, Lopan-Brücke und Hauptbahnhof nehmen – bis das Tauwetter die Straßen in Schlamm verwandelt.',
  briefing: [
    { s: 'Hauptmann Ebner', t: 'Die Stadt hat in diesem Winter schon zweimal den Besitzer gewechselt. Wer Hausnummern kennt, kennt die Keller, in denen die Menschen sitzen, die nirgendwohin konnten. Wir kämpfen uns durch Straßen, in denen morgens noch Kinder gespielt haben. Es ist ein schlechter Ort für einen Krieg – und wir haben ihn hergebracht.' },
    { s: 'Oberfeldwebel Weidner', t: 'Platz der Freiheit, die Brücke über den Lopan, der Hauptbahnhof: drei Punkte, die wir nehmen müssen, ehe die Straßen weich werden. Pioniere vor, Infanterie räumt Haus um Haus, die Panzer folgen auf den Straßen – nie allein in die Querstraße, die Panzerbüchsen sitzen in jedem zweiten Fenster.' },
    { s: 'Gefreiter Moll', t: 'Seit zwei Wochen keine volle Nacht geschlafen. Die Kompanie, die ich im Herbst übernommen habe, besteht aus elf Mann. Wenn das Tauwetter kommt, bleibt jedes Fahrzeug stecken, und der Gegner weiß das. Dann haben wir gar nichts mehr, außer einander.' },
  ],
  objectivesPreview: ['Platz der Freiheit einnehmen', 'Lopan-Brücke einnehmen', 'Hauptbahnhof einnehmen', 'Die drei Punkte halten (12 Minuten Gesamtzeit)', 'Optional: Haus der Industrie sichern', 'Optional: Höchstens 15 Mann Verlust'],
  forces: ['3× Panzer IV', '2× StuG III', '1× Tiger I', '2× Sd.Kfz. 251', '16× Schützen', '3× MG-42-Trupps', '3× MP-40', '3× Pioniere', '2× Mörser', '1× Offizier', '1× Sanitäter', 'Fähigkeiten: Artillerie, Stuka-Angriff, Rauch'],
  map: { size: 560, seed: 1943, season: 'winter', palette: 'winter', relief: 2, baseHeight: 5, seaLevel: 0, scatterTrees: 14, features: feats },
  env: { season: 'winter', sunElev: 12, sunAzim: 200, fogDensity: 0.0032 },
  weather: { type: 'snow', intensity: 0.4, changes: [{ at: 420, type: 'rasputiza', intensity: 0.6, fade: 90 }] },
  time: { start: '08:30', speed: 3 },
  camera: { x: -210, z: 20, dist: 120, yaw: 1.57 },
  markers: [
    { x: SQ[0], z: SQ[1], r: 30, label: 'Platz der Freiheit', color: '#ffe9a8' },
    { x: BR[0], z: BR[1], r: 22, label: 'Lopan-Brücke', color: '#ffe9a8' },
    { x: ST[0], z: ST[1], r: 30, label: 'Hauptbahnhof', color: '#ffe9a8' },
  ],
  abilities: [{ id: 'ww2_artillery', charges: 3 }, { id: 'ww2_airstrike_de', charges: 1 }, { id: 'smoke', charges: 3 }],

  setup(g) {
    this.t0 = g.time; this.z = { sq: {}, br: {}, st: {} }; this.lost = 0; this.rasp = false;
    g.spawnGroup([['ww2_pz4', 3], ['ww2_stug3', 2], ['ww2_tiger', 1]], 'UA', -250, 24, { spacing: 10, cols: 3, heading: Math.PI / 2, tags: ['tank'] });
    g.spawnGroup([['ww2_sdkfz251', 2]], 'UA', -250, 56, { spacing: 10, cols: 2, heading: Math.PI / 2 });
    g.spawnGroup([[de.rifle, 10], [de.lmg, 2], [de.smg, 3], [de.at, 2], [de.officer, 1], [de.medic, 1]], 'UA', -236, -4, { spacing: 3.2, cols: 5, heading: Math.PI / 2 });
    g.spawnGroup([[de.rifle, 6], [de.lmg, 1], [de.engineer, 3], [de.mortar, 2]], 'UA', -236, 40, { spacing: 3.2, cols: 5, heading: Math.PI / 2 });
    // Sowjetische Verteidiger: Platz, Brückenkopf, Bahnhof, dazu Panzer und Pak in den Querstraßen
    g.spawnGroup([[su.rifle, 8], [su.lmg, 2], [su.at, 2], [su.smg, 2]], 'RU', SQ[0] + 10, SQ[1] - 6, { spacing: 3.5, cols: 5, ai: { mode: 'guard', radius: 30 }, tags: ['sq'] });
    fort(g, 'ww2_mgnest', 'RU', SQ[0] + 30, SQ[1] + 12, { heading: -Math.PI / 2, tags: ['sq'] }); fort(g, 'ww2_foxhole', 'RU', SQ[0] + 24, SQ[1] - 10, {});
    g.spawn('ww2_zis3', 'RU', SQ[0] + 48, SQ[1] + 4, { heading: -Math.PI / 2, ai: { mode: 'hold' }, tags: ['sq'] });
    g.spawnGroup([[su.rifle, 6], [su.lmg, 2], [su.at, 2], [su.sniper, 1]], 'RU', BR[0] + 18, BR[1] + 4, { spacing: 3.5, cols: 4, ai: { mode: 'guard', radius: 28 }, tags: ['br'] });
    fort(g, 'ww2_mgnest', 'RU', BR[0] + 24, BR[1] - 8, { heading: -Math.PI / 2, tags: ['br'] }); fort(g, 'ww2_barbedwire', 'RU', BR[0] - 20, BR[1] + 2, {});
    g.spawn('ww2_t34_76', 'RU', BR[0] + 30, BR[1] + 4, { ai: { mode: 'guard', radius: 30 }, tags: ['br'] });
    g.spawn('ww2_zis3', 'RU', BR[0] + 40, BR[1] + 14, { heading: -Math.PI / 2, ai: { mode: 'hold' }, tags: ['br'] });
    g.spawnGroup([[su.rifle, 8], [su.lmg, 2], [su.smg, 2], [su.at, 2]], 'RU', ST[0] - 6, ST[1] - 8, { spacing: 3.5, cols: 5, ai: { mode: 'guard', radius: 30 }, tags: ['st'] });
    g.spawn('ww2_t34_76', 'RU', ST[0] + 30, ST[1] - 6, { ai: { mode: 'guard', radius: 30 }, tags: ['st'] });
    g.spawn('ww2_kv1', 'RU', ST[0] + 10, ST[1] + 20, { ai: { mode: 'guard', radius: 30 }, tags: ['st'] });
    g.spawnGroup([[su.rifle, 4], [su.mortar, 2]], 'RU', 50, 80, { spacing: 3.5, cols: 4, ai: { mode: 'guard', radius: 30 } });
    g.addObjective('sq', 'Platz der Freiheit einnehmen');
    g.addObjective('br', 'Lopan-Brücke einnehmen');
    g.addObjective('st', 'Hauptbahnhof einnehmen');
    g.addObjective('hold', `Die drei Punkte halten – ${mmss(T_END)}`);
    g.addObjective('men', 'Höchstens 15 Mann Verlust', { optional: true });
    g.later(3, () => g.say('Weidner', 'Häuser einzeln nehmen, Fenster beobachten! Panzer nur zusammen mit der Infanterie in die Querstraße.', 6));
    g.later(40, () => g.say('Ebner', 'Wenn Zivilisten in den Kellern sind, schießt nicht blind in die Häuser. Wir wissen nicht, wer darin sitzt.', 5));
    // Gegenstöße der Roten Armee
    g.later(220, () => { g.alert('⚠ Gegenstoß aus dem Norden!', 4); wave(g, [[su.rifle, 8], [su.smg, 3], ['ww2_t34_76', 1]], -60, -260, [[-50, -150], [-90, -60], [SQ[0], SQ[1] - 20]], { tags: ['w'] }); });
    g.later(430, () => { g.say('Moll', 'Es taut. Die Straßen werden zu Brei. Rasputiza.', 5); g.alert('Rasputiza: Fahrzeuge abseits der Straßen kommen kaum noch voran.', 5); });
    g.later(470, () => { g.alert('⚠ Gegenstoß über den Lopan!', 4); wave(g, [[su.rifle, 8], [su.lmg, 2], [su.at, 2], ['ww2_t34_85', 2]], 250, -20, [[170, -14], [90, -10]], { tags: ['w'] }); });
    g.later(560, () => { wave(g, [[su.rifle, 8], [su.smg, 4], ['ww2_t34_76', 2]], 230, 180, [[150, 170], [90, 168]], { tags: ['w'] }); });
    g.later(240, () => { reinforce(g, [[de.rifle, 8], [de.lmg, 1], [de.at, 1]], -262, 14, { heading: Math.PI / 2, spacing: 3.2 }); g.say('Ebner', 'Eine Marschkompanie ist eingetroffen. Es sind Männer, die kaum eine Woche an der Front sind.', 5); });
  },

  onKill(g, u) { if (u.side === 'UA' && !u.type.structure) this.lost++; },

  update(g, dt) {
    if (g.ended) return;
    const t = g.time - this.t0;
    const mine = alive(g, 'UA').length;
    const a = holdZone(g, dt, this.z.sq, SQ[0], SQ[1], 30, { need: 2, secs: 6, enemyR: 34 });
    const b = holdZone(g, dt, this.z.br, BR[0], BR[1], 24, { need: 2, secs: 6, enemyR: 28 });
    const c = holdZone(g, dt, this.z.st, ST[0], ST[1], 30, { need: 2, secs: 6, enemyR: 34 });
    for (const [k, f, txt] of [['sq', a, 'Der Platz ist genommen – Haus für Haus.'], ['br', b, 'Die Brücke ist offen. Pioniere prüfen auf Sprengladungen.'], ['st', c, 'Der Bahnhof ist unser. Die Gleise sind leer.']]) {
      if (f && g.objState(k) === 'open') { g.setObjective(k, 'done'); g.say('Weidner', txt, 4); }
    }
    if (g.objState('men') === 'open' && this.lost > 15) g.setObjective('men', 'failed');
    if (a && b && c) {
      const left = Math.max(0, T_END - t);
      setText(g, 'hold', `Die drei Punkte halten – ${mmss(left)}`);
      if (left <= 0) {
        g.setObjective('hold', 'done');
        g.win('Charkow ist wieder in deutscher Hand – für kurze Zeit. Die Stadt ist weitgehend zerstört, ein großer Teil der Bewohner geflohen, verschleppt oder tot. Im selben Jahr geht sie endgültig verloren. Wer hier überlebt hat, trägt keine Siegesfreude davon, sondern den Geruch der Keller.');
        return;
      }
    } else setText(g, 'hold', 'Die drei Punkte halten – erst alle drei einnehmen');
    if (mine < 3 && t > 5) { g.setObjective('hold', 'failed'); g.lose('Der Angriff ist zusammengebrochen. Die Reste des Verbands ziehen sich aus der Stadt zurück.'); return; }
    if (t > LIMIT) { g.setObjective('hold', 'failed'); g.lose('Die Straßen sind im Schlamm versunken, der Angriff ist festgefahren.'); }
  },
  victory: 'Die Stadt ist genommen. Die Bewohner, die in den Kellern überlebten, werden diesen Winter nie vergessen.',
};
