// Mission 2 – Schwarm über Charkiw (Drohnenkrieg: Aufklärer abschießen, Artillerie mit FPV jagen, Gegenangriff halten)
export default {
  id: 'm2',
  title: 'Schwarm über Charkiw',
  place: 'Oblast Charkiw · Sosnivka am Fluss',
  date: 'September 2022',
  briefing: [
    { s: 'Oberst Koval', t: 'Die Gegenoffensive bei Charkiw läuft. Jenseits des Flusses steht eine Batterie Msta-S, die jeden unserer Vorstöße zerhackt. Ihre Augen sind zwei Orlan-Drohnen.' },
    { s: 'Sova', t: 'Ohne Orlan keine Zielkoordinaten. Erst blenden wir sie – Gepard und Stinger holen die Aufklärer vom Himmel. Dann schicken wir die FPV-Schwärme über den Fluss.' },
    { s: 'Drohnenpilot „Taras"', t: 'Achtung: Der Gegner setzt Lancet-Kamikazedrohnen gegen Fahrzeuge ein. Der Störsender verschafft uns Luft. Und: Die Drohnenpiloten sind unser wertvollstes Gut. Haltet sie aus dem Feuer.' },
  ],
  objectivesPreview: ['Beide Orlan-Aufklärer abschießen', 'Artilleriebatterie (2× Msta-S) zerstören', 'Munitionsdepot bei Hrakowe zerstören', 'Sosnivka gegen den Gegenangriff halten'],
  forces: ['2× Drohnenpilot', '2× Aufklärungsdrohne', '5× Schützen', '1× MG', '2× Javelin', '1× Stinger', '2× M2 Bradley', '1× Gepard', 'Fähigkeiten: FPV-Schwarm, Aufklärung, EloKa'],
  map: {
    size: 240, seed: 23, season: 'autumn', relief: 7, baseHeight: 4, scatterTrees: 50,
    features: [
      { type: 'river', pts: [[-130, -20], [-60, -8], [0, -26], [60, -12], [130, -30]], width: 16, depth: 3, bank: 7 },
      { type: 'causeway', pts: [[-28, -42], [-28, 8]], width: 9 },
      { type: 'causeway', pts: [[72, -46], [70, 10]], width: 9 },
      { type: 'road', pts: [[-28, 125], [-30, 60], [-28, 8], [-28, -42], [-42, -82], [-52, -125]], width: 6 },
      { type: 'road', pts: [[-30, 60], [25, 48], [70, 10], [72, -46], [62, -90], [70, -125]], width: 5, paved: false },
      { type: 'village', x: 22, z: 42, r: 24, houses: 10 },
      { type: 'village', x: -52, z: -90, r: 18, houses: 6 },
      { type: 'hill', x: 42, z: -100, r: 36, h: 8 },
      { type: 'hill', x: -85, z: 62, r: 30, h: 6 },
      { type: 'forest', x: -88, z: 24, r: 24, kind: 'mixed', density: 0.06 },
      { type: 'forest', x: 20, z: -70, r: 26, kind: 'mixed', density: 0.06 },
      { type: 'forest', x: 98, z: -92, r: 20, kind: 'pine', density: 0.06 },
      { type: 'forest', poly: [[-125, -60], [-95, -60], [-90, -125], [-125, -125]], kind: 'pine', density: 0.05 },
      { type: 'treeline', pts: [[60, 70], [120, 55]] },
      { type: 'field', poly: [[40, 70], [120, 62], [120, 118], [40, 118]], crop: 'stubble', angle: 1.2 },
      { type: 'field', poly: [[-20, -40], [10, -40], [5, -110], [-25, -110]], crop: 'plowed', angle: 0.1 },
    ],
  },
  env: { season: 'autumn', sunElev: 26, sunAzim: 240, fogDensity: 0.0036 },
  camera: { x: 5, z: 80, dist: 90 },
  abilities: [{ id: 'fpv', charges: 8 }, 'scan', 'ew'],
  markers: [{ x: 22, z: 42, r: 26, label: 'Sosnivka', color: '#5db8ff' }],

  setup(g) {
    g.spawnGroup([['dronepilot', 2], ['stinger', 1]], 'UA', 10, 98, { spacing: 3 });
    g.spawnGroup([['rifle', 5], ['mg', 1], ['javelin', 2]], 'UA', -12, 92, { spacing: 3, cols: 4 });
    g.spawnGroup([['bradley', 2], ['gepard', 1]], 'UA', 30, 96, { spacing: 9, cols: 3 });
    g.spawn('recon', 'UA', -5, 84); g.spawn('recon', 'UA', 20, 84);

    // Gegner
    g.spawn('msta', 'RU', 34, -100, { tags: ['target', 'arty'], ai: { mode: 'hold' } });
    g.spawn('msta', 'RU', 52, -94, { tags: ['target', 'arty'], ai: { mode: 'hold' } });
    g.spawn('depot', 'RU', -64, -104, { tags: ['target', 'depot'] });
    g.spawnGroup([['e_rifle', 4], ['btr', 1]], 'RU', 42, -82, { spacing: 4, ai: { mode: 'guard', radius: 35 } });
    g.spawnGroup([['e_rifle', 3]], 'RU', -58, -92, { spacing: 3, ai: { mode: 'guard', radius: 30 } });
    g.spawnGroup([['e_rifle', 4], ['e_mg', 1], ['bmp', 1]], 'RU', -28, -54, { spacing: 4, ai: { mode: 'guard', radius: 35 } });
    g.spawnGroup([['e_rifle', 3], ['e_rpg', 1], ['t72', 1]], 'RU', 72, -58, { spacing: 4, ai: { mode: 'guard', radius: 35 } });
    g.spawn('orlan', 'RU', -40, -40, { tags: ['orlan'], ai: { mode: 'loiter', center: [-10, 20], radius: 55 } });
    g.spawn('orlan', 'RU', 60, -40, { tags: ['orlan'], ai: { mode: 'loiter', center: [40, 40], radius: 45 } });

    g.addObjective('orlan', 'Beide Orlan-Aufklärer abschießen (0/2)');
    g.addObjective('arty', 'Artilleriebatterie (2× Msta-S) zerstören');
    g.addObjective('depot', 'Munitionsdepot bei Hrakowe zerstören');
    g.addObjective('hold', 'Sosnivka gegen den Gegenangriff halten', { hidden: true });
    this.orlanKills = 0; this.phase = 1;
    g.later(2, () => g.say('Sova', 'Zwei Orlan kreisen über uns. Gepard und Stinger nach vorne – sobald sie in Reichweite sind, holen sie sie runter.', 6));
    g.later(12, () => g.say('Taras', 'FPV-Schwarm ist bereit (F1). Schickt erst die Aufklärungsdrohnen über den Fluss, damit wir Ziele sehen.', 6));
    // Lancet-Angriffe
    g.every(65, () => {
      if (this.phase > 2) return;
      for (let i = 0; i < 2; i++) g.spawn('lancet', 'RU', -20 + i * 40, -118, { ai: { mode: 'hunt', huntRadius: 260, points: [[22, 50], [0, 90]] } });
      g.alert('⚠ Lancet-Drohnen im Anflug! Gepard / EloKa einsetzen.', 3);
    }, 50);
  },
  onKill(g, u) {
    if (u.tags.has('orlan')) {
      this.orlanKills++;
      const o = g.objectives.find((o) => o.id === 'orlan'); o.text = `Beide Orlan-Aufklärer abschießen (${this.orlanKills}/2)`; g.emit('objectives');
      if (this.orlanKills >= 2) { g.setObjective('orlan', 'done'); g.say('Sova', 'Der Himmel ist sauber. Ihre Artillerie ist jetzt blind – Zeit für die Schwärme.', 5); }
    }
  },
  update(g) {
    if (g.objState('arty') === 'open' && g.countTag('arty') === 0) { g.setObjective('arty', 'done'); g.say('Taras', 'Beide Haubitzen brennen! Volltreffer in die Ladeluke.', 4); }
    if (g.objState('depot') === 'open' && g.countTag('depot') === 0) { g.setObjective('depot', 'done'); g.say('Sova', 'Das Depot geht hoch – das sieht man bis Charkiw.', 4); }
    if (this.phase === 1 && g.objState('arty') === 'done' && g.objState('depot') === 'done') {
      this.phase = 2;
      const o = g.objectives.find((o) => o.id === 'hold'); o.hidden = false; g.emit('objectives');
      g.say('Koval', 'Sie schicken alles, was sie noch haben, gegen Sosnivka. Haltet das Dorf drei Minuten, dann kommt Verstärkung!', 6);
      g.addAbilityCharges('fpv', 4);
      g.setCountdown(180, 'Verstärkung in', () => {
        g.setObjective('hold', 'done');
        g.win('Die Gegenoffensive rollt weiter. Die Region Charkiw wird befreit.');
      });
      const wave = (n) => {
        g.spawnGroup([['t72', 1 + n], ['bmp', 2], ['e_rifle', 4], ['e_rpg', 1]], 'RU', -28, -110, { spacing: 5, ai: { mode: 'attackMove', points: [[-28, -40], [-28, 10], [10, 40]], aggressive: true } });
        g.spawnGroup([['btr', 1], ['e_rifle', 4], ['e_mg', 1]], 'RU', 68, -112, { spacing: 4, ai: { mode: 'attackMove', points: [[72, -40], [70, 10], [30, 40]], aggressive: true } });
        for (let i = 0; i < 3; i++) g.spawn('lancet', 'RU', -40 + i * 30, -118, { ai: { mode: 'hunt', huntRadius: 260, points: [[22, 50], [0, 90]] } });
      };
      wave(0);
      g.later(80, () => { wave(1); g.say('Sova', 'Zweite Welle! Panzer an beiden Furten!', 4); });
    }
    if (this.phase === 2 && !g.ended) {
      // Niederlage, wenn das Dorf überrannt wird
      const ours = g.unitsInArea(22, 42, 30, 'UA').filter((u) => !u.type.air).length;
      const theirs = g.unitsInArea(22, 42, 26, 'RU').filter((u) => !u.type.air && !u.type.structure).length;
      if (theirs >= 4 && ours === 0) { g.setObjective('hold', 'failed'); g.lose('Sosnivka wurde überrannt.'); }
    }
  },
  victory: 'Mit blinden Haubitzen und brennenden Depots bricht die Front bei Charkiw zusammen. Hunderte Ortschaften werden in wenigen Tagen befreit.',
};
