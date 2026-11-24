// Mission 4 – Durchbruch bei Saporischschja (Gegenoffensive mit Leopard 2, Minenfeldern, HIMARS)
const VILLAGE = [0, -72];
const MINES = [[-46, -14, 16], [-12, -10, 12], [20, -18, 14], [56, -14, 15], [-80, -20, 14], [88, -22, 13]];

export default {
  id: 'm4',
  title: 'Durchbruch bei Saporischschja',
  place: 'Oblast Saporischschja · Nowa Dolyna',
  date: 'Juni 2023',
  briefing: [
    { s: 'Oberst Koval', t: 'Die Gegenoffensive beginnt. Vor uns: Nowa Dolyna, dahinter die Surowikin-Linie. Der Gegner hatte Monate Zeit, sich einzugraben – und er hat das Land mit Minen gepflastert.' },
    { s: 'Sova', t: 'Unsere Aufklärungsdrohnen machen die Minenfelder sichtbar. Fahrt NICHT blind hinein. Hinter dem Dorf feuert eine Artilleriebatterie, und im Nordwesten liegt ein Munitionsdepot – ein Ziel für HIMARS.' },
    { s: 'Leutnant Andrij Shevchuk (Leopard-Zug)', t: 'Drei Leoparden, frisch aus Deutschland. Wir zeigen ihnen die Front – aber nicht die Flanke. Und haltet uns die Ka-52 vom Hals.' },
  ],
  objectivesPreview: ['Artilleriebatterie hinter dem Dorf zerstören', 'Munitionsdepot im Nordwesten zerstören', 'Nowa Dolyna einnehmen', 'Optional: Höchstens einen Leopard verlieren'],
  forces: ['3× Leopard 2A6', '2× M2 Bradley', '1× Gepard', '6× Schützen', '2× Javelin', '1× Stinger', '1× Drohnenpilot', '2× Aufklärungsdrohne', '1× HIMARS', 'Fähigkeiten: Aufklärung, HIMARS, FPV (4×), Artillerie'],
  map: {
    size: 260, seed: 47, season: 'summer', relief: 5, baseHeight: 3, scatterTrees: 30, scarred: true,
    features: [
      { type: 'road', pts: [[0, 135], [2, 60], [-5, 0], [0, -72], [10, -135]], width: 7 },
      { type: 'road', pts: [[-135, -60], [0, -72], [135, -84]], width: 5, paved: false },
      { type: 'village', x: VILLAGE[0], z: VILLAGE[1], r: 32, houses: 13 },
      { type: 'field', poly: [[-125, 20], [-25, 20], [-25, 95], [-125, 95]], crop: 'sunflower', angle: 0.4 },
      { type: 'field', poly: [[25, 12], [125, 12], [125, 85], [25, 85]], crop: 'wheat', angle: 1.1 },
      { type: 'field', poly: [[-120, -45], [-35, -45], [-35, -5], [-120, -5]], crop: 'stubble', angle: 0 },
      { type: 'field', poly: [[35, -50], [120, -50], [120, -5], [35, -5]], crop: 'green', angle: 0.6 },
      { type: 'treeline', pts: [[-130, 6], [-14, 8]] }, { type: 'treeline', pts: [[16, 6], [130, 4]] },
      { type: 'treeline', pts: [[-130, -32], [-30, -34]] }, { type: 'treeline', pts: [[30, -32], [130, -30]] },
      { type: 'treeline', pts: [[-62, 100], [-60, 12]] }, { type: 'treeline', pts: [[62, 95], [60, 10]] },
      { type: 'forest', x: 98, z: -108, r: 26, kind: 'mixed', density: 0.05 },
      { type: 'forest', x: -95, z: -108, r: 24, kind: 'mixed', density: 0.06 },
      { type: 'hill', x: 100, z: -105, r: 30, h: 6 },
      { type: 'hill', x: 0, z: 110, r: 40, h: 5 },
    ],
  },
  env: { season: 'summer', sunElev: 42, sunAzim: 160, fogDensity: 0.0028 },
  weather: { type: 'clear' }, time: { start: '16:30', speed: 12 }, // V3-W: klar, Tag -> Abend
  camera: { x: 0, z: 90, dist: 95 },
  abilities: ['scan', 'himars', { id: 'fpv', charges: 4 }, 'artillery'],

  setup(g) {
    this.markers = [{ x: VILLAGE[0], z: VILLAGE[1], r: 34, label: 'Nowa Dolyna', color: '#5db8ff' }];
    this.mines = MINES.map(([x, z, r]) => ({ x, z, r, found: false, marker: { x, z, r, label: '⚠ Minen', color: '#ff6b6b', hidden: true } }));
    this.mines.forEach((m) => this.markers.push(m.marker));
    this.mineMeshes = [];

    g.spawnGroup([['leopard', 3]], 'UA', 0, 100, { spacing: 12, tags: ['leo'] });
    g.spawnGroup([['bradley', 2], ['gepard', 1]], 'UA', 0, 114, { spacing: 11, cols: 3 });
    g.spawnGroup([['rifle', 6], ['javelin', 2], ['stinger', 1], ['dronepilot', 1]], 'UA', -30, 104, { spacing: 3, cols: 5 });
    g.spawn('recon', 'UA', -10, 92); g.spawn('recon', 'UA', 15, 92);
    g.spawn('himars', 'UA', 30, 120);

    // Verteidigung im Dorf
    g.spawn('bunker', 'RU', -22, -46, { heading: Math.PI });
    g.spawn('bunker', 'RU', 24, -48, { heading: Math.PI });
    g.spawnGroup([['e_rifle', 8], ['e_mg', 2], ['e_rpg', 3]], 'RU', 0, -66, { spacing: 6, cols: 5, ai: { mode: 'guard', radius: 30 }, tags: ['village'] });
    g.spawn('t72', 'RU', -26, -62, { ai: { mode: 'hold' }, tags: ['village'] });
    g.spawn('t72', 'RU', 30, -64, { ai: { mode: 'hold' }, tags: ['village'] });
    g.spawn('bmp', 'RU', 8, -82, { ai: { mode: 'guard', radius: 35 }, tags: ['village'] });
    g.spawn('bmp', 'RU', -12, -86, { ai: { mode: 'guard', radius: 35 }, tags: ['village'] });
    // Artillerie und Depot
    g.spawn('msta', 'RU', 90, -112, { tags: ['target', 'arty'], ai: { mode: 'hold' } });
    g.spawn('msta', 'RU', 108, -100, { tags: ['target', 'arty'], ai: { mode: 'hold' } });
    g.spawnGroup([['e_rifle', 4], ['btr', 1]], 'RU', 96, -88, { spacing: 4, ai: { mode: 'guard', radius: 30 } });
    g.spawn('depot', 'RU', -98, -112, { tags: ['target', 'depot'] });
    g.spawn('fuel', 'RU', -78, -118, { tags: ['depot2'] });
    g.spawnGroup([['e_rifle', 3], ['e_mg', 1]], 'RU', -90, -96, { spacing: 3, ai: { mode: 'guard', radius: 30 } });
    g.spawn('orlan', 'RU', 0, -100, { ai: { mode: 'loiter', center: [0, 20], radius: 60 } });

    g.addObjective('arty', 'Artilleriebatterie hinter dem Dorf zerstören');
    g.addObjective('depot', 'Munitionsdepot im Nordwesten zerstören');
    g.addObjective('village', 'Nowa Dolyna einnehmen (Dorf von Feinden säubern)');
    g.addObjective('leo', 'Höchstens einen Leopard verlieren', { optional: true });
    this.leoLost = 0;
    this.capT = 0;
    g.later(2, () => g.say('Sova', 'Drohnen voraus! Minenfelder werden markiert, sobald unsere Aufklärung sie überfliegt.', 6));
    g.later(10, () => g.say('Shevchuk', 'Leoparden bereit. Zeigt mir die Gassen durch die Minen.', 4));
    g.later(105, () => g.say('Sova', 'Funkaufklärung: Ein Ka-52 startet im Norden. Gepard und Stinger in Position bringen – in etwa 15 Sekunden ist er da!', 5));
    g.later(120, () => {
      g.spawn('ka52', 'RU', -60, -128, { ai: { mode: 'attackMove', points: [[-30, -20], [0, 50], [40, 20], [0, -40]], after: 'guard', aggressive: true } });
      g.say('Sova', 'Ka-52 von Norden! Gepard und Stinger – Feuer frei!', 5);
      g.alert('⚠ Kampfhubschrauber Ka-52!', 3);
    });
    g.every(80, () => {
      if (g.ended) return false;
      for (let i = 0; i < 2; i++) g.spawn('lancet', 'RU', -30 + i * 60, -128, { ai: { mode: 'hunt', huntRadius: 280, points: [[0, 60], [0, 100]] } });
      g.alert('⚠ Lancet-Drohnen jagen unsere Fahrzeuge!', 3);
    }, 85);
  },
  onKill(g, u) {
    if (u.tags.has('leo')) {
      this.leoLost++;
      if (this.leoLost > 1) g.setObjective('leo', 'failed');
    }
  },
  update(g, dt) {
    // Minenfelder
    for (const m of this.mines) {
      if (!m.found && g.fow.isVisible(m.x, m.z) && g.units.some((u) => u.side === 'UA' && u.alive && (u.type.key === 'recon' || u.type.key === 'dronepilot') && Math.hypot(u.pos.x - m.x, u.pos.z - m.z) < m.r + 40) || (!m.found && g.reveals.some((r) => Math.hypot(r.x - m.x, r.z - m.z) < r.r))) {
        m.found = true; m.marker.hidden = false;
        g.effects.marker(m.x, m.z, 0xff3030, 9999, m.r).userData.persistent = true;
        g.say('Sova', 'Minenfeld entdeckt und markiert! Umfahren.', 3);
      }
      for (const u of g.units) {
        if (u.side !== 'UA' || !u.alive || u.type.air || u.type.structure || !u.moving) continue;
        if (Math.hypot(u.pos.x - m.x, u.pos.z - m.z) > m.r) continue;
        const p = u.type.vehicle ? 0.45 : 0.18;
        if (Math.random() < p * dt) {
          g.effects.explosion(u.pos.x, u.pos.y, u.pos.z, u.type.vehicle ? 1.4 : 0.7);
          g.applyDamage(u, u.type.vehicle ? 420 : 90, { vs: { soft: 1, light: 1, heavy: 0.9, struct: 0, air: 0 } }, null, { topAttack: true });
          if (!m.found) { m.found = true; m.marker.hidden = false; g.effects.marker(m.x, m.z, 0xff3030, 9999, m.r).userData.persistent = true; g.say('Shevchuk', 'Mine! Wir sind in ein Minenfeld gefahren!', 4); }
        }
      }
    }
    if (g.objState('arty') === 'open' && g.countTag('arty') === 0) { g.setObjective('arty', 'done'); g.say('Sova', 'Batterie zerstört. Keine Granaten mehr auf unsere Kolonne.', 4); }
    if (g.objState('depot') === 'open' && g.countTag('depot') === 0) { g.setObjective('depot', 'done'); g.say('Koval', 'Das Depot fliegt in die Luft! Das wird ihnen wochenlang fehlen.', 4); }
    // Dorf einnehmen
    if (g.objState('village') === 'open') {
      const enemies = g.unitsInArea(VILLAGE[0], VILLAGE[1], 36, 'RU').filter((u) => !u.type.air);
      const ours = g.unitsInArea(VILLAGE[0], VILLAGE[1], 32, 'UA').filter((u) => !u.type.air);
      if (enemies.length === 0 && ours.length >= 2) {
        this.capT += dt;
        if (this.capT > 3) { g.setObjective('village', 'done'); g.say('Shevchuk', 'Nowa Dolyna ist frei! Die Flagge weht über der Schule.', 5); }
      } else this.capT = 0;
    }
    if (!g.ended && ['arty', 'depot', 'village'].every((id) => g.objState(id) === 'done')) {
      if (g.objState('leo') === 'open') g.setObjective('leo', 'done');
      g.win('Der Durchbruch ist gelungen. Nowa Dolyna ist befreit.');
    }
  },
  victory: 'Jeder Meter durch die Minenfelder wurde teuer erkauft. Doch die erste Verteidigungslinie ist durchbrochen – und der Weg nach Süden, Richtung Krim, liegt offen.',
};
