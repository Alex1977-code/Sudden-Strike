// C5 – Ardennen (Dezember 1944): Angriff im Nebel und Schnee. Brücke nehmen – dann geordneter Rückzug, sobald das Wetter aufklart
// und die alliierten Jagdbomber kommen. Treibstoff ist knapp (Logistikmodus); Eigene Karte „angelehnt an das Ourthe-Tal“.
import { bldg, road, river, hill, forest, bridge, settlement, landmarksOf } from '../../maps/places/_kit.js';
import { de, us, setText, mmss, alive, fort, wave, holdZone, foeStrike, reinforce, near } from './_h.js';

const BRIDGE = [36, 0], EXIT = [236, 8];
const LIMIT = 1150;
const START_FUEL = 85;      // s Fahrzeit: reicht für den Vorstoß, für den Rückzug kaum
const CLEAR_AT = 330;       // s – das Wetter klart auf
const NEED = 14;            // V3-R: 12 → 14 Mann am Sammelpunkt

const feats = [
  river([[26, -270], [30, -120], [18, 0], [34, 120], [30, 270]], 20, { depth: 2.4, bank: 4, name: 'Ourthe' }),
  ...bridge([[-6, 0], [76, 0]], 9, 'Steinbrücke', true, 'stone_arch'),
  road([[270, 8], [140, 4], [76, 0], [-6, 0], [-120, -4], [-270, -16]], 8, true, { name: 'Landstraße' }),
  road([[110, 4], [128, 90], [150, 270]], 6, false), road([[-60, -2], [-80, -120], [-100, -270]], 6, false), road([[-90, -4], [-110, 110], [-130, 270]], 6, false),
  hill(120, -130, 60, 20), hill(150, 140, 70, 24), hill(-130, -110, 60, 22), hill(-150, 130, 60, 20), hill(-60, 200, 50, 14),
  forest([[60, -260], [180, -260], [190, -140], [90, -130], [60, -200]], 'pine', 0.07),
  forest([[60, 140], [200, 160], [210, 270], [60, 270]], 'pine', 0.07),
  forest([[-260, -260], [-100, -270], [-120, -150], [-260, -140]], 'pine', 0.065),
  forest([[-250, 150], [-120, 160], [-140, 270], [-260, 270]], 'pine', 0.065),
  forest([[170, -60], [250, -70], [260, 40], [190, 50]], 'mixed', 0.05),
  bldg('church_ardennes', -66, -26, 10, 18, 0.2, 2, 'Dorfkirche'),
];
feats.push(
  settlement('normandy_village', -74, 0, 70, 1944, { buildingSet: 'ardennes', density: 0.8, mainRoadAngle: 0, square: false, cemetery: false, fields: false, keepOut: [{ x: BRIDGE[0], z: BRIDGE[1], r: 20 }] }),
  settlement('normandy_village', 150, 20, 40, 1945, { buildingSet: 'ardennes', density: 0.55, mainRoadAngle: 0.1, cemetery: false, fields: false }),
);

export default {
  id: 'c5', era: 'ww2', difficulty: 3,
  title: 'Ardennen – Brücke im Nebel', place: 'Ourthe-Tal, Ardennen · angelehnt an die Ardennen', date: '17.–22. Dezember 1944',
  summary: 'Angriff im Nebel mit knappem Sprit: Brücke nehmen, dann geordnet zurück, sobald der Himmel aufklart und die Jabos kommen.',
  briefing: [
    { s: 'Hauptmann Lessing', t: 'Man hat uns gesagt, ein einziger Schlag im Wetter, in dem kein Flugzeug fliegt, kehre den Krieg im Westen um. Ich habe die Tankwagen gesehen: Es reicht nicht bis zum Fluss, geschweige denn bis Antwerpen. Wir nehmen die Brücke, weil man uns das befohlen hat. Mehr verlangt niemand von uns.' },
    { s: 'Feldwebel Scholz', t: 'Nebel und Schnee, kaum fünfzig Meter Sicht. Das ist unser Verbündeter – solange es hält. Die Brücke liegt hinter dem Dorf. Panzer sparsam fahren, der Sprit reicht für einen Vorstoß und kaum für den Weg zurück. Wer liegen bleibt, wird gesprengt.' },
    { s: 'Gefreiter Brink', t: 'Wenn der Himmel aufreißt, kommen die Jabos, und dann ist die Straße ein Schießstand. Dann wird sofort zurückgegangen, geordnet, Gruppe um Gruppe. Meine Mutter schreibt, dass die Stadt gebombt wird. Ich weiß nicht, wen wir hier eigentlich beschützen.' },
  ],
  objectivesPreview: ['Die Steinbrücke über die Ourthe nehmen', 'Danach geordneter Rückzug: mindestens 14 Mann (davon 2 Panzer) erreichen den Sammelpunkt im Osten', 'Optional: Den Versorgungs-Lkw retten', 'Zeitlimit: 19 Minuten'],
  forces: ['3× Panther', '2× StuG III', '2× Sd.Kfz. 251', '18× Schützen', '3× MG-42', '2× Panzerschreck', '3× Pioniere', '1× Offizier', '1× Sanitäter', '1× Versorgungs-Lkw', 'Fähigkeiten: Nebelwerfer-Salve, Artillerie, Rauch'],
  map: { size: 540, seed: 1944, season: 'winter', palette: 'winter', terrainStyle: 'hills', relief: 6, baseHeight: 6, seaLevel: 0, scatterTrees: 20, features: feats },
  env: { season: 'winter', sunElev: 9, sunAzim: 190, fogDensity: 0.0055 },
  weather: { type: 'fog', intensity: 0.75, changes: [{ at: 120, type: 'snow', intensity: 0.5, fade: 40 }, { at: CLEAR_AT, type: 'clear', intensity: 0, fade: 70 }] },
  time: { start: '07:30', speed: 3 },
  camera: { x: 190, z: 6, dist: 115, yaw: -1.57 },
  logistics: true,
  markers: [
    { x: BRIDGE[0], z: BRIDGE[1], r: 24, label: 'Steinbrücke', color: '#ffe9a8' },
    { x: EXIT[0], z: EXIT[1], r: 36, label: 'Sammelpunkt (Rückzug)', color: '#7be07b', hidden: true },
  ],
  abilities: [{ id: 'ww2_nebelwerfer', charges: 1 }, { id: 'ww2_artillery', charges: 2 }, { id: 'smoke', charges: 3 }],

  setup(g) {
    this.t0 = g.time; this.br = {}; this.phase = 'attack'; this.strikes = 0; this.nextStrike = 0; this.fwd = new Set(); this.exitM = this.markers[1];
    const tanks = g.spawnGroup([['ww2_panther', 3], ['ww2_stug3', 2]], 'UA', 220, 4, { spacing: 12, cols: 3, heading: -Math.PI / 2, tags: ['tank'] });
    for (const u of tanks) if (u.maxFuel) u.fuel = START_FUEL;
    for (const u of g.spawnGroup([['ww2_sdkfz251', 2]], 'UA', 226, 34, { spacing: 10, cols: 2, heading: -Math.PI / 2, tags: ['htr'] })) if (u.maxFuel) u.fuel = START_FUEL;
    g.spawnGroup([[de.rifle, 12], [de.lmg, 3], [de.at, 2], [de.smg, 3], [de.officer, 1], [de.medic, 1]], 'UA', 232, -12, { spacing: 3.2, cols: 5, heading: -Math.PI / 2 });
    g.spawnGroup([[de.engineer, 3], [de.rifle, 4]], 'UA', 236, 24, { spacing: 3.2, cols: 4, heading: -Math.PI / 2 });
    const trk = g.spawn('ww2_opel', 'UA', 246, -30, { heading: -Math.PI / 2, tags: ['truck'] });
    if (trk?.supply) trk.supply.fuel = 220; // fast leer: Treibstoffmangel
    // Verteidiger: amerikanische Infanterie im Dorf, Bazookas, Pak am Brückenkopf, M10 in Reserve
    g.spawnGroup([[us.rifle, 7], [us.lmg, 2], [us.at, 2]], 'RU', -62, -6, { spacing: 3.6, cols: 4, ai: { mode: 'guard', radius: 28 } });
    g.spawnGroup([[us.rifle, 6], [us.lmg, 1], [us.at, 1]], 'RU', -70, 18, { spacing: 3.6, cols: 4, ai: { mode: 'guard', radius: 26 } });
    g.spawnGroup([[us.rifle, 5], [us.lmg, 2], [us.sniper, 1]], 'RU', 8, -14, { spacing: 3.6, cols: 4, ai: { mode: 'guard', radius: 24 }, tags: ['bk'] });
    fort(g, 'ww2_mgnest', 'RU', -6, -4, { heading: Math.PI / 2, tags: ['bk'] }); fort(g, 'ww2_foxhole', 'RU', 0, 12, {});
    g.spawn('ww2_us_57mm', 'RU', -14, 8, { heading: Math.PI / 2, ai: { mode: 'hold' }, tags: ['bk'] });
    g.spawn('ww2_m10', 'RU', -46, -14, { ai: { mode: 'guard', radius: 32 } });
    g.spawnGroup([[us.rifle, 6], [us.lmg, 2], [us.at, 2]], 'RU', 70, -26, { spacing: 3.6, cols: 4, ai: { mode: 'guard', radius: 26 } });
    g.spawn('ww2_us_57mm', 'RU', 62, 16, { heading: -Math.PI / 2, ai: { mode: 'hold' } });
    g.addObjective('bridge', 'Die Steinbrücke über die Ourthe nehmen');
    g.addObjective('retreat', `Rückzug: ${NEED} Mann (davon 2 Panzer) zum Sammelpunkt im Osten`, { hidden: true });
    g.addObjective('truck', 'Den Versorgungs-Lkw retten', { optional: true });
    g.later(3, () => g.say('Lessing', 'Sprit sparen: Nicht auf der Stelle drehen, Umwege vermeiden. Den Lkw dicht an den Panzern halten – er ist unsere letzte Reserve.', 7));
    g.later(40, () => g.say('Scholz', 'Aus dem Nebel kommen sie nicht auf Sicht heran. Fahrt vorsichtig auf die Brücke zu – die Pak steht am Westende.', 6));
    g.later(210, () => { g.alert('⚠ Gegner verstärkt das Dorf!', 4); wave(g, [[us.rifle, 7], [us.lmg, 1], [us.at, 2], ['ww2_m10', 1]], -250, -10, [[-130, -6], [-70, 0]], { tags: ['w'] }); });
    g.later(280, () => { g.alert('⚠ Zweiter Gegenstoß über die Brücke!', 4); wave(g, [[us.rifle, 8], [us.lmg, 2], [us.at, 2], ['ww2_sherman', 2]], -250, 4, [[-130, 0], [-30, 0], [20, 0]], { tags: ['w'] }); });
    g.later(CLEAR_AT - 20, () => g.say('Brink', 'Der Wind dreht. Der Nebel reißt auf – mir gefällt das nicht.', 4));
  },

  update(g, dt) {
    if (g.ended) return;
    const t = g.time - this.t0;
    const mine = alive(g, 'UA').length;
    if (this.phase === 'attack') {
      const b = holdZone(g, dt, this.br, BRIDGE[0], BRIDGE[1], 22, { need: 2, secs: 6, enemyR: 26 });
      if (b) {
        this.phase = 'held'; g.setObjective('bridge', 'done');
        g.addObjective('held', 'Brückenkopf halten, bis der Rückzugsbefehl kommt');
        g.say('Lessing', 'Brücke genommen. Wir halten sie, bis Befehl kommt – und der Himmel macht mir Sorgen.', 6);
      }
    }
    if (this.phase === 'held' && t >= CLEAR_AT) {
      this.phase = 'retreat'; g.setObjective('held', 'done');
      const o = g.objectives.find((q) => q.id === 'retreat'); if (o) { o.hidden = false; g.emit('objectives'); }
      this.exitM.hidden = false;
      g.say('Lessing', 'Der Himmel ist klar, die Jabos kommen. Rückzug! Zurück zum Sammelpunkt, Gruppe um Gruppe. Verwundete und Sprit zuerst.', 7);
      g.alert('Rückzug zum Sammelpunkt im Osten!', 5);
      this.nextStrike = t + 4;
      // V3-R (Balance, Automatik siegte nach 365 s ohne einen Verlust): Panzerspitze der Gegenseite stößt von Norden in den Rückzugsweg
      g.later(6, () => { if (g.ended) return; g.alert('⚠ Gegnerische Panzer stoßen von Norden in den Rückzugsweg!', 4); wave(g, [['ww2_sherman', 2], [us.rifle, 6], [us.lmg, 1]], 150, -250, [[160, -80], [190, 0], [EXIT[0], EXIT[1]]], { tags: ['w'] }); wave(g, [['ww2_m10', 1], [us.rifle, 4]], -120, 4, [[-20, 0], [60, 0], [140, 4]], { tags: ['w'] }); });
    }
    if (this.phase === 'attack' || this.phase === 'held') for (const u of g.units) if (u.alive && u.side === 'UA' && u.pos.x < 45) this.fwd.add(u.id);
    // Wetter klart auf → alliierte Jagdbomber (Aircraft.js über die Fähigkeiten, Seite RU)
    if (this.phase === 'retreat' && t >= this.nextStrike && !g.ended) {
      const ours = alive(g, 'UA', (u) => !u.type.structure);
      if (ours.length) {
        if (this.strikes === 0) { g.alert('⚠ Der Himmel klart auf – Jagdbomber!', 5); g.say('Brink', 'Jabos! Auseinander, runter von der Straße!', 4); }
        // Ziel: dichteste Gruppe eigener Fahrzeuge/Infanterie
        let best = ours[0], bn = -1;
        for (const u of ours) { const n = ours.filter((v) => Math.hypot(v.pos.x - u.pos.x, v.pos.z - u.pos.z) < 14).length + (u.type.vehicle ? 2 : 0); if (n > bn) { bn = n; best = u; } }
        foeStrike(g, 'ww2_airstrike_us', best.pos.x, best.pos.z);
        this.strikes++; this.nextStrike = t + 20; // V3-R: 32 → 20 s
      }
    }
    if (this.phase === 'retreat') {
      const inExit = near(g, 'UA', EXIT[0], EXIT[1], 36).filter((u) => this.fwd.has(u.id));
      const tanksIn = inExit.filter((u) => u.tags.has('tank')).length;
      setText(g, 'retreat', `Rückzug: ${inExit.length}/${NEED} Mann (davon ${Math.min(tanksIn, 2)}/2 Panzer) am Sammelpunkt im Osten`);
      if (g.objState('truck') === 'open' && !alive(g, 'UA', (u) => u.tags.has('truck')).length) g.setObjective('truck', 'failed');
      if (inExit.length >= NEED && tanksIn >= 2) {
        g.setObjective('retreat', 'done');
        if (g.objState('truck') === 'open') g.setObjective('truck', inExit.some((u) => u.tags.has('truck')) ? 'done' : 'failed');
        g.win('Die Brücke ist gefallen, doch der Vorstoß ist nach wenigen Tagen zu Ende: Sprit, Wetter und Luftüberlegenheit der Gegenseite entscheiden. Es war die letzte große Offensive im Westen – tausende Tote auf beiden Seiten und in den Dörfern der Ardennen, und danach der unaufhaltsame Rückweg.');
        return;
      }
    }
    if (mine < 4 && t > 5) { g.setObjective(this.phase === 'attack' ? 'bridge' : this.phase === 'held' ? 'held' : 'retreat', 'failed'); g.lose('Der Verband ist aufgerieben. Kaum jemand kommt zurück.'); return; }
    if (t > LIMIT) { g.setObjective(this.phase === 'attack' ? 'bridge' : this.phase === 'held' ? 'held' : 'retreat', 'failed'); g.lose('Zu spät: Der Verband ist abgeschnitten, bevor er den Sammelpunkt erreicht.'); }
  },
  victory: 'Die Brücke war genommen – und für den Krieg im Westen entschied das nichts mehr.',
};
