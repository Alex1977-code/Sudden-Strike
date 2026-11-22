// Mission 3 – Nacht über Kyjiw (Flugabwehr gegen Shahed, Marschflugkörper und Kinschal-Hyperschallraketen)
const PLANT = [8, -58], SUB = [-34, -36], BATT = [22, 26];

export default {
  id: 'm3',
  title: 'Nacht der Hyperschallraketen',
  place: 'Kyjiw · Wärmekraftwerk am Dnipro',
  date: 'Mai 2023',
  briefing: [
    { s: 'Oberst Koval', t: 'Der Gegner hat genug von Panzern verloren. Jetzt greift er die Städte an – mit Schwärmen von Shahed-Drohnen, Kalibr-Marschflugkörpern und Kinschal-Hyperschallraketen. Die Kinschal galt als „nicht abfangbar".' },
    { s: 'Major Iryna Bondar (Patriot-Batterie)', t: 'Wir haben eine Patriot-Batterie. Zwei Starter, ein Radar. Jeder PAC-3-Flugkörper zählt. Für die Kinschal brauchen wir bis zu drei Abfangraketen – verschwendet sie nicht an Drohnen.' },
    { s: 'Sova', t: 'Die Shahed übernehmen Gepard, IRIS-T und unsere mobilen Feuergruppen. Und Vorsicht: Eine Sabotagegruppe könnte versuchen, das Patriot-Radar am Boden auszuschalten.' },
  ],
  objectivesPreview: ['Wärmekraftwerk schützen', 'Patriot-Radar einsatzbereit halten', 'Bis zum Morgengrauen durchhalten (6:00)', 'Optional: Umspannwerk schützen', 'Optional: 4 Kinschal abfangen'],
  forces: ['Patriot: 2× Starter + Radar', '2× IRIS-T SLM', '2× Gepard', '3× Mobile Feuergruppe', '4× Schützen', '1× MG', '1× Stinger', 'Fähigkeiten: Aufklärung, EloKa'],
  map: {
    size: 240, seed: 31, season: 'summer', relief: 3, baseHeight: 3, scatterTrees: 40,
    features: [
      { type: 'water', poly: [[82, -140], [140, -140], [140, 140], [98, 140], [86, 40], [76, -40]], depth: 7, bank: 10 },
      { type: 'road', pts: [[-125, 0], [70, 0]], width: 7 },
      { type: 'road', pts: [[0, 125], [0, -125]], width: 7 },
      { type: 'road', pts: [[-62, 125], [-62, -60], [8, -60]], width: 6 },
      { type: 'village', x: -38, z: 52, r: 44, houses: 22, urban: true },
      { type: 'village', x: 42, z: 76, r: 24, houses: 8, urban: true },
      { type: 'village', x: 40, z: -100, r: 18, houses: 5 },
      { type: 'flat', x: 8, z: -58, r: 30, h: 3 },
      { type: 'flat', x: 22, z: 26, r: 22, h: 3.2 },
      { type: 'forest', poly: [[-125, -125], [-72, -125], [-82, -40], [-125, -28]], kind: 'mixed', density: 0.05 },
      { type: 'forest', x: 55, z: -30, r: 14, kind: 'mixed', density: 0.05 },
      { type: 'treeline', pts: [[-60, -10], [60, -12]] },
    ],
  },
  env: { night: true, fogDensity: 0.0042 },
  camera: { x: 10, z: 10, dist: 115 },
  abilities: ['scan', 'ew'],
  markers: [],

  setup(g) {
    this.markers = [];
    this.drg = null;
    g.spawn('powerplant', 'UA', PLANT[0], PLANT[1], { tags: ['protect', 'plant'], name: 'Wärmekraftwerk', hpMul: 1.5 });
    g.spawn('substation', 'UA', SUB[0], SUB[1], { tags: ['protect', 'sub'] });
    g.spawn('patriot', 'UA', BATT[0] - 8, BATT[1] - 2, { heading: Math.PI, tags: ['patriot'] });
    g.spawn('patriot', 'UA', BATT[0] + 8, BATT[1] - 2, { heading: Math.PI, tags: ['patriot'] });
    g.spawn('patriot_radar', 'UA', BATT[0], BATT[1] + 9, { heading: Math.PI, tags: ['protect', 'radar'] });
    g.spawn('irist', 'UA', -24, -8, { heading: Math.PI });
    g.spawn('irist', 'UA', 44, -6, { heading: Math.PI });
    g.spawn('gepard', 'UA', 46, -34, { heading: Math.PI * 0.75 });
    g.spawn('gepard', 'UA', -40, -66, { heading: Math.PI });
    g.spawn('pickup', 'UA', 0, -4); g.spawn('pickup', 'UA', -52, 4); g.spawn('pickup', 'UA', 52, 12);
    g.spawnGroup([['rifle', 4], ['mg', 1], ['stinger', 1]], 'UA', 18, 48, { spacing: 3 });

    g.addObjective('plant', 'Wärmekraftwerk schützen');
    g.addObjective('radar', 'Patriot-Radar einsatzbereit halten');
    g.addObjective('dawn', 'Bis zum Morgengrauen durchhalten');
    g.addObjective('sub', 'Umspannwerk schützen', { optional: true });
    g.addObjective('kinzhal', 'Kinschal abfangen (0/4)', { optional: true });
    this.kinzhalShot = 0;
    g.onIntercept = (threat) => {
      if (threat.threat !== 'hypersonic') return;
      this.kinzhalShot++;
      const o = g.objectives.find((o) => o.id === 'kinzhal'); o.text = `Kinschal abfangen (${this.kinzhalShot}/4)`; g.emit('objectives');
      if (this.kinzhalShot >= 4) g.setObjective('kinzhal', 'done');
    };
    g.setCountdown(360, 'Morgengrauen in', () => {
      g.setObjective('dawn', 'done');
      if (g.objState('sub') === 'open') g.setObjective('sub', 'done');
      g.win('Die Nacht ist vorbei. Das Kraftwerk liefert weiter Strom – und die „unbesiegbare" Kinschal ist vom Himmel geholt worden.');
    });
    g.later(2, () => g.say('Bondar', 'Radar aktiv. Tipp: Wählt die Patriot-Starter und drückt H bzw. „Feuer" (Feuer halten) – dann feuern sie NUR auf Hyperschallraketen.', 7));
    g.later(10, () => g.say('Sova', 'Mobile Feuergruppen verteilen. Shahed fliegen langsam und tief – die MGs holen sie runter.', 5));

    const N = (x) => [x, -122], E = (z) => [122, z];
    const shaheds = (n, targets) => {
      for (let i = 0; i < n; i++) {
        g.later(i * 2.2, () => {
          const from = Math.random() < 0.5 ? N(-80 + Math.random() * 160) : E(-100 + Math.random() * 150);
          const tg = targets[i % targets.length];
          const tu = g.byTag(tg)[0];
          g.launchShahed(from[0], from[1], tu || [PLANT[0], PLANT[1]], { ai: { mode: 'hunt', targetTag: tg } });
        });
      }
      g.alert(`⚠ ${n} Shahed-Drohnen im Anflug!`, 3);
    };
    const cruise = (n, targets) => {
      for (let i = 0; i < n; i++) g.later(i * 3, () => {
        const tg = targets[i % targets.length];
        const tu = g.byTag(tg)[0];
        const t = tu ? [tu.pos.x, tu.pos.z] : PLANT;
        g.launchCruise(125, -60 + Math.random() * 120, t[0], t[1], { speed: 38, dmg: 1400 });
      });
      g.alert(`⚠ ${n} Kalibr-Marschflugkörper aus Osten!`, 3);
    };
    const kinzhal = (tag, delay = 0) => g.later(delay, () => {
      const tu = g.byTag(tag)[0] || g.byTag('plant')[0];
      if (!tu) return;
      g.launchKinzhal(tu.pos.x + (Math.random() - 0.5) * 4, tu.pos.z + (Math.random() - 0.5) * 4, { warning: 8, angle: Math.PI + (Math.random() - 0.5) });
    });
    // Angriffsplan
    g.later(22, () => shaheds(6, ['sub', 'plant']));
    g.later(70, () => { cruise(3, ['plant', 'sub']); shaheds(4, ['plant']); });
    g.later(120, () => { g.say('Bondar', 'MiG-31K gestartet! Kinschal-Abschuss erwartet – Ziel ist vermutlich unsere Batterie!', 5); kinzhal('patriot', 4); });
    // Sabotagegruppe: früh angekündigt und zunächst im Wald versammelt, damit Zeit zum Abfangen bleibt
    g.later(80, () => {
      this.drg = g.spawnGroup([['e_rifle', 5], ['e_rpg', 2], ['e_mg', 1]], 'RU', -108, -88, { spacing: 3, tags: ['drg'], ai: { mode: 'guard', radius: 18 } });
      this.markers.push({ x: -100, z: -80, r: 22, label: 'Sabotagegruppe (Westwald)', color: '#ff6b6b' });
      g.addReveal(-104, -86, 18, 6);
      g.say('Sova', 'Unsere Drohne meldet eine Sabotagegruppe, die sich im Westwald sammelt. Abmarsch in etwa eineinhalb Minuten – Schützen und MG jetzt losschicken!', 7);
    });
    g.later(150, () => g.say('Sova', 'Die Sabotagegruppe setzt sich in einer halben Minute in Bewegung!', 4));
    g.later(180, () => {
      for (const u of this.drg || []) {
        if (!u.alive) continue;
        u.ai = { mode: 'attackMove', points: [[-80, -30], [-30, 15], [BATT[0], BATT[1] + 9]], aggressive: true, aggroRadius: 25 };
      }
      if ((this.drg || []).some((u) => u.alive)) g.say('Sova', 'Sabotagegruppe bricht aus dem Wald aus – Richtung Patriot-Radar!', 5);
      this.markers = this.markers.filter((m) => !m.label?.startsWith('Sabotage'));
    });
    g.later(185, () => { shaheds(8, ['plant', 'patriot', 'sub']); cruise(3, ['plant']); });
    g.later(215, () => { kinzhal('plant'); kinzhal('patriot', 3); });
    g.later(255, () => { shaheds(6, ['radar', 'plant']); cruise(2, ['radar']); });
    g.later(300, () => { g.say('Bondar', 'Massiver Schlag! Drei Kinschal gleichzeitig – alles, was wir haben!', 5); kinzhal('plant'); kinzhal('patriot', 1.5); kinzhal('sub', 3); cruise(4, ['plant', 'sub']); shaheds(10, ['plant', 'patriot', 'radar']); });
  },
  onKill(g, u) {
    if (u.tags.has('plant')) { g.setObjective('plant', 'failed'); g.lose('Das Wärmekraftwerk wurde zerstört. Die Stadt liegt im Dunkeln.'); }
    if (u.tags.has('radar')) { g.setObjective('radar', 'failed'); g.say('Bondar', 'Radar verloren! Die Patriot-Starter sind blind!', 5); }
    if (u.tags.has('sub')) g.setObjective('sub', 'failed');
  },
  update(g) {},
  victory: 'Im Mai 2023 meldet die ukrainische Luftverteidigung erstmals den Abschuss von Kinschal-Raketen über Kyjiw. Der Mythos der Unverwundbarkeit ist gebrochen.',
};
