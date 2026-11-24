// Mission 1 – Die Straße nach Kyjiw (Hinterhalt auf eine Kolonne, Tutorial)
const ROAD = [[10, -125], [6, -80], [-6, -40], [-4, 0], [8, 40], [4, 80], [0, 125]];

export default {
  id: 'm1',
  title: 'Die Straße nach Kyjiw',
  place: 'Oblast Kyjiw · Wilschanka',
  date: 'Ende Februar 2022',
  briefing: [
    { s: 'Oberst Dmytro Koval', t: 'Sie sind über die Grenze gekommen, als würden sie in drei Tagen in Kyjiw Kaffee trinken. Ihre Kolonnen stauen sich auf jeder Landstraße nördlich der Hauptstadt.' },
    { s: 'Oberst Koval', t: 'Hauptmann Melnyk – „Sova" – Ihre Gruppe hat ein paar Javelins, eine einzige Aufklärungsdrohne und ein Dorf, das sich weigert zu fallen. Die Straße durch Wilschanka ist eine Versorgungsader. Schneiden Sie sie durch.' },
    { s: 'Hptm. Oksana „Sova" Melnyk', t: 'Verstanden. Wir lassen die Drohne vorausfliegen, legen die Javelin-Teams in die Waldränder und warten, bis die Kolonne im Engpass steckt. Erst der vordere, dann der hintere Wagen.' },
  ],
  objectivesPreview: ['Feindkolonne mit der Aufklärungsdrohne aufspüren', 'Kolonne aufreiben – höchstens 3 Fahrzeuge dürfen durchbrechen', 'Optional: Feindlichen Spähtrupp im Nordosten ausschalten'],
  forces: ['6× Schützen', '1× MG', '3× Javelin-Team', '1× Scharfschütze', '1× Aufklärungsdrohne', 'Fähigkeit: Aufklärung', 'Fähigkeit: Artillerie (2×)'],
  map: {
    size: 240, seed: 11, season: 'winter', relief: 4, baseHeight: 3, scatterTrees: 70,
    features: [
      { type: 'road', pts: ROAD, width: 7 },
      { type: 'road', pts: [[-4, 0], [-60, 10], [-125, 30]], width: 4, paved: false },
      { type: 'road', pts: [[8, 40], [70, 30], [125, 40]], width: 4, paved: false },
      { type: 'village', x: 18, z: 55, r: 26, houses: 11 },
      { type: 'village', x: -70, z: 15, r: 14, houses: 4 },
      { type: 'hill', x: -42, z: -42, r: 32, h: 6 },
      { type: 'hill', x: 50, z: -30, r: 25, h: 4 },
      { type: 'forest', poly: [[-52, -72], [-14, -78], [-12, -22], [-22, 8], [-62, -2]], kind: 'mixed', density: 0.07 },
      { type: 'forest', poly: [[18, -64], [62, -70], [72, -12], [24, -8]], kind: 'pine', density: 0.07 },
      { type: 'forest', x: 80, z: -95, r: 26, kind: 'pine', density: 0.06 },
      { type: 'forest', x: -85, z: -95, r: 28, kind: 'mixed', density: 0.05 },
      { type: 'treeline', pts: [[-110, 62], [-22, 72]] },
      { type: 'treeline', pts: [[34, 92], [112, 82]] },
      { type: 'field', poly: [[-110, 75], [-20, 82], [-25, 120], [-110, 118]], crop: 'plowed', angle: 0.2 },
    ],
  },
  env: { season: 'winter', sunElev: 22, sunAzim: 200, fogDensity: 0.004 },
  weather: { type: 'snow', intensity: 0.35 }, time: { start: '07:10', speed: 4 }, // V3-W: leichter Schneefall, Morgengrauen
  camera: { x: 0, z: 66, dist: 85 },
  abilities: ['scan', { id: 'artillery', charges: 2 }],
  markers: [{ x: 0, z: 112, r: 14, label: 'Durchbruchslinie', color: '#ff6b6b' }],

  setup(g) {
    g.spawnGroup([['rifle', 3]], 'UA', -10, 80, { spacing: 3 });
    g.spawnGroup([['rifle', 3]], 'UA', 14, 80, { spacing: 3 });
    g.spawnGroup([['javelin', 3], ['mg', 1], ['sniper', 1]], 'UA', 2, 86, { spacing: 3.5, cols: 5 });
    g.spawn('recon', 'UA', 0, 74, { heading: Math.PI });
    // Spähtrupp im Nordosten
    g.spawnGroup([['e_rifle', 4], ['e_mg', 1]], 'RU', 78, -88, { spacing: 3, ai: { mode: 'guard', radius: 36 }, tags: ['scouts'] });
    this.convoy = [];
    this.escaped = 0;
    this.waves = 0;
    this.flagsScouts = false; // MP-T6: bei „Erneut versuchen“ zurücksetzen (sonst bleibt das Nebenziel gesperrt)
    g.addObjective('spot', 'Feindkolonne mit der Aufklärungsdrohne aufspüren');
    g.addObjective('convoy', 'Kolonne aufreiben – Durchbrüche: 0/3');
    g.addObjective('scouts', 'Feindlichen Spähtrupp im Nordosten ausschalten', { optional: true });
    g.later(1, () => g.say('Sova', 'Drohne startet. Wählt die Aufklärungsdrohne und schickt sie nach Norden die Straße entlang.', 6));
    g.later(8, () => g.say('Sova', 'Javelin-Teams in die Waldränder links und rechts der Straße. Im Wald seid ihr schwer zu entdecken.', 6));
    g.later(16, () => g.say('Sova', 'Tipp: Ziehen mit der Maus wählt mehrere Einheiten, Rechtsklick gibt Befehle. Am Handy: antippen und Ziel antippen.', 6));
    g.later(75, () => this.spawnWave(g, ['btr', 'truck', 'truck', 'bmp', 'truck', 't72', 'truck']));
    g.later(210, () => this.spawnWave(g, ['t72', 'bmp', 'truck', 'truck', 'btr', 'truck', 't72']));
    g.later(195, () => { g.addAbilityCharges('artillery', 1); g.say('Koval', 'Die Artillerie hat nachgeladen – ein weiterer Feuerschlag steht bereit.', 4); });
    g.later(150, () => {
      g.spawn('orlan', 'RU', 0, -125, { ai: { mode: 'loiter', center: [0, -10], radius: 45 } });
      g.say('Sova', 'Feindliche Orlan-Drohne über dem Wald! Sie meldet unsere Stellungen. MG und Schützen können sie herunterholen.', 6);
    });
  },
  spawnWave(g, list) {
    this.waves++;
    if (this.waves === 2) g.say('Koval', 'Zweite Kolonne im Anmarsch – diesmal mit mehr Panzern. Haltet durch, Sova!', 5);
    list.forEach((type, i) => {
      g.later(i * 4, () => {
        const u = g.spawn(type, 'RU', 9, -114, { heading: 0, speedMul: 0.6, tags: ['convoy'], ai: { mode: 'convoy', points: [...ROAD.slice(1, -1), [2, 114]], after: 'escaped' } });
        u.ai.onArrive = (unit) => this.onEscape(g, unit);
        this.convoy.push(u);
      });
    });
  },
  onEscape(g, u) {
    if (!u.alive) return;
    this.escaped++;
    u.alive = false;
    g.removeUnit(u);
    g.scene.remove(u.root);
    g.alert(`Feindfahrzeug ist durchgebrochen! (${this.escaped}/3)`, 3);
    const o = g.objectives.find((o) => o.id === 'convoy');
    o.text = `Kolonne aufreiben – Durchbrüche: ${this.escaped}/3`;
    g.emit('objectives');
    if (this.escaped > 3) { g.setObjective('convoy', 'failed'); g.lose('Zu viele Fahrzeuge sind nach Kyjiw durchgebrochen.'); }
  },
  update(g) {
    if (g.objState('spot') === 'open' && this.convoy.some((u) => u.alive && u.visibleTo('UA'))) {
      g.setObjective('spot', 'done');
      g.say('Sova', 'Kolonne gesichtet! BTR an der Spitze, Lkw dahinter, ein T-72 am Ende. Feuer frei, wenn sie im Engpass sind.', 6);
    }
    if (g.objState('scouts') === 'open' && this.flagsScouts !== true && g.countTag('scouts') === 0) { this.flagsScouts = true; g.setObjective('scouts', 'done'); }
    if (this.waves >= 2 && this.convoy.length >= 14 && this.convoy.every((u) => !u.alive) && g.objState('convoy') === 'open') {
      g.setObjective('convoy', 'done');
      g.say('Koval', 'Die Straße ist dicht – mit ausgebrannten Wracks. Gute Arbeit, Sova. Kyjiw hält.', 6);
      g.win('Die Kolonne wurde aufgerieben. Der Vorstoß auf Kyjiw kommt ins Stocken.');
    }
  },
  victory: 'Wilschanka hält. In den folgenden Wochen bleiben die Kolonnen im Norden stecken – und ziehen sich schließlich zurück.',
};
