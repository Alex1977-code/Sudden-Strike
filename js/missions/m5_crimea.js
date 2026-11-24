// Mission 5 – Die Krimbrücke (Spezialkräfte, Seedrohnen, Storm Shadow)
const BZ = -70;           // Brückenachse (z)
const SPAN_X = -30;       // Position der Zielsegmente

export default {
  id: 'm5',
  title: 'Die Krimbrücke',
  place: 'Straße von Kertsch',
  date: 'Juli 2023, 03:04 Uhr',
  briefing: [
    { s: 'Oberst Koval', t: 'Die Brücke über die Straße von Kertsch ist die Lebensader der Besatzer auf der Krim. Über sie rollen Munition, Treibstoff und Panzer. Sie ist das bestbewachte Bauwerk des Gegners.' },
    { s: 'Sova', t: 'Der Plan hat drei Teile. Erstens: Ein SSO-Trupp landet nachts an der Küste und schaltet das S-400-Radar und die Panzir-Stellung am Brückenkopf aus. Zweitens: Seedrohnen greifen die Pfeiler aus dem Wasser an. Drittens: Storm-Shadow-Marschflugkörper geben den Rest.' },
    { s: 'Kapitän Marko Hrytsenko (Marine-Drohnen)', t: 'Unsere „Magura" sind schnell und flach – aber Patrouillenboote und Hubschrauber jagen sie. Ein Ka-52 über dem Wasser ist tödlich für uns. Die Panzir auf der Insel Tusla schützt die Brücke von der Mitte aus.' },
    { s: 'Oberst Koval', t: 'Ziel sind je ein Segment der Straßen- und der Eisenbahnbrücke. Keine zivilen Ziele. Viel Glück – Ruhm der Ukraine.' },
  ],
  objectivesPreview: ['S-400-Radar zerstören (SSO)', 'Beide Panzir-Stellungen ausschalten', 'Segment der Straßenbrücke zerstören', 'Segment der Eisenbahnbrücke zerstören', 'Optional: Beide Patrouillenboote versenken'],
  forces: ['6× Spezialkräfte (SSO)', '2× Scharfschütze', '1× Stinger', '1× Aufklärungsdrohne', 'Seedrohnen „Magura" (4 Starts à 2)', 'Storm Shadow (4×)', 'Aufklärung'],
  map: {
    size: 280, seed: 53, season: 'summer', relief: 4, baseHeight: 3.5, scatterTrees: 25, seaLevel: 0, outerSea: true,
    features: [
      { type: 'water', poly: [[-78, -150], [100, -150], [108, -90], [96, -30], [150, 10], [150, 150], [-150, 150], [-150, 72], [-96, 42], [-80, -18]], depth: 8, bank: 12 },
      { type: 'island', x: 50, z: -62, r: 19, h: 1.4 },
      { type: 'flat', x: -112, z: -108, r: 26, h: 4 },
      { type: 'road', pts: [[-140, -70], [-100, -70], [-90, -60]], width: 8 },
      { type: 'road', pts: [[-140, -30], [-108, -40], [-100, -70]], width: 5, paved: false },
      { type: 'road', pts: [[115, -70], [140, -72]], width: 8 },
      { type: 'village', x: -125, z: -10, r: 16, houses: 6 },
      { type: 'village', x: 128, z: -110, r: 14, houses: 5 },
      { type: 'forest', x: -136, z: 2, r: 14, kind: 'pine', density: 0.06 },
      { type: 'forest', x: -132, z: -50, r: 12, kind: 'pine', density: 0.05 },
      { type: 'hill', x: -130, z: -130, r: 30, h: 5 },
    ],
    bridge: { x0: -96, x1: 120, z: BZ, deckY: 9, gaps: [{ x: SPAN_X, kind: 'road' }, { x: SPAN_X, kind: 'rail' }], gapLen: 28 },
  },
  env: { season: 'summer', sunElev: 9, sunAzim: 95, fogDensity: 0.0024 },
  weather: { type: 'fog', intensity: 0.4, changes: [{ at: 420, type: 'clear', fade: 90 }] }, time: { start: '03:40', speed: 10 }, // V3-W: Nacht -> Morgengrauen, Frühnebel lichtet sich
  camera: { x: -85, z: 10, dist: 115, yaw: 0.25 },
  abilities: [{ id: 'stormshadow', charges: 4 }, { id: 'seadrone', charges: 4 }, 'scan'],
  friendlyEdge: [-60, 160],
  seaSpawn: [10, 125],

  setup(g) {
    this.markers = [{ x: SPAN_X, z: BZ, r: 20, label: 'Zielsegmente', color: '#ffd500' }, { x: -120, z: 26, r: 8, label: 'Landezone', color: '#5db8ff' }];
    // Zielsegmente
    g.spawn('bridge_road', 'RU', SPAN_X, BZ - 7, { y: 9, tags: ['target', 'span', 'road'] });
    g.spawn('bridge_rail', 'RU', SPAN_X, BZ + 7, { y: 9, tags: ['target', 'span', 'rail'] });
    // Flugabwehr
    g.spawn('s400radar', 'RU', -118, -100, { tags: ['target', 's400radar'] });
    g.spawn('s400', 'RU', -104, -116, { ai: { mode: 'hold' } });
    g.spawn('s400', 'RU', -132, -112, { ai: { mode: 'hold' } });
    g.spawn('pantsir', 'RU', -92, -50, { tags: ['target', 'pantsir'], ai: { mode: 'hold' } });
    g.spawn('pantsir', 'RU', 50, -49, { tags: ['target', 'pantsir'], ai: { mode: 'hold' } });
    // Wachen
    g.spawnGroup([['e_rifle', 4], ['e_mg', 1]], 'RU', -116, -86, { spacing: 4, ai: { mode: 'guard', radius: 30 } });
    g.spawnGroup([['e_rifle', 3], ['e_rpg', 1]], 'RU', -100, -40, { spacing: 3, ai: { mode: 'guard', radius: 28 } });
    g.spawnGroup([['e_rifle', 3], ['e_mg', 1]], 'RU', -108, -20, { spacing: 3, ai: { mode: 'patrol', points: [[-108, -20], [-100, -45], [-125, -35], [-122, -10]] } });
    g.spawn('btr', 'RU', -128, -60, { ai: { mode: 'patrol', points: [[-128, -60], [-100, -68], [-110, -40]] } });
    // Marine
    g.spawn('boat', 'RU', -30, -30, { tags: ['boat'], ai: { mode: 'patrol', points: [[-40, -35], [40, -28], [65, 20], [-30, 25]] } });
    g.spawn('boat', 'RU', 60, 30, { tags: ['boat'], ai: { mode: 'patrol', points: [[60, 30], [-40, 50], [-55, -20], [30, -35]] } });
    // Spieler
    g.spawnGroup([['sso', 6], ['sniper', 2], ['stinger', 1]], 'UA', -120, 26, { spacing: 2.8, cols: 4, heading: Math.PI });
    g.spawn('recon', 'UA', -112, 32, { startAlt: 2 });
    // Brücke sichtbar machen
    for (let x = -100; x <= 120; x += 30) g.addReveal(x, BZ, 22, 1.5);

    g.addObjective('radar', 'S-400-Radar zerstören (SSO)');
    g.addObjective('pantsir', 'Beide Panzir-Stellungen ausschalten (0/2)');
    g.addObjective('road', 'Segment der Straßenbrücke zerstören');
    g.addObjective('rail', 'Segment der Eisenbahnbrücke zerstören');
    g.addObjective('boats', 'Beide Patrouillenboote versenken', { optional: true });
    this.pantsirKills = 0; this.boatKills = 0;
    g.later(2, () => g.say('Sova', 'Trupp ist an Land. Leise vorgehen – die SSO sind im Gelände schwer zu entdecken. Erst das S-400-Radar im Nordwesten.', 6));
    g.later(9, () => g.say('Hrytsenko', 'Seedrohnen (F2) sind bereit. Wartet, bis die Boote abgelenkt sind – oder versenkt sie zuerst.', 6));
    g.later(16, () => g.say('Sova', 'Storm Shadow (F1) fliegt tief übers Meer an. Solange S-400 und Panzir stehen, werden viele abgefangen.', 6));
    g.later(210, () => {
      g.spawn('ka52', 'RU', 130, -20, { ai: { mode: 'patrol', points: [[60, 10], [-20, 40], [-60, 0], [10, -40]] } });
      g.alert('⚠ Ka-52 über der Meerenge!', 3);
      g.say('Hrytsenko', 'Kampfhubschrauber über dem Wasser! Er jagt unsere Drohnen – der Stinger-Schütze muss ihn erwischen.', 6);
    });
  },
  onKill(g, u) {
    if (u.tags.has('s400radar')) {
      g.setObjective('radar', 'done');
      g.addAbilityCharges('stormshadow', 2);
      g.say('Koval', 'S-400 ist blind! Die Luftwaffe gibt zwei weitere Storm Shadow frei.', 5);
    }
    if (u.tags.has('pantsir')) {
      this.pantsirKills++;
      const o = g.objectives.find((o) => o.id === 'pantsir'); o.text = `Beide Panzir-Stellungen ausschalten (${this.pantsirKills}/2)`; g.emit('objectives');
      if (this.pantsirKills >= 2) { g.setObjective('pantsir', 'done'); g.say('Sova', 'Die Brücke ist nackt. Jetzt alles, was wir haben!', 4); }
    }
    if (u.tags.has('boat')) { this.boatKills++; if (this.boatKills >= 2) g.setObjective('boats', 'done'); }
    if (u.tags.has('road')) { g.setObjective('road', 'done'); g.say('Hrytsenko', 'Straßenbrücke: Segment ist ins Wasser gestürzt!', 4); }
    if (u.tags.has('rail')) { g.setObjective('rail', 'done'); g.say('Koval', 'Die Eisenbahnbrücke ist unterbrochen! Kein Zug kommt mehr auf die Krim.', 4); }
  },
  noDefaultDefeat: true,
  update(g) {
    if (g.ended) return;
    if (g.objState('road') === 'done' && g.objState('rail') === 'done') {
      g.win('Beide Brückensegmente liegen in der Meerenge. Die Versorgung der Krim ist unterbrochen.');
      return;
    }
    const ss = g.abilities.find((a) => a.id === 'stormshadow'), sd = g.abilities.find((a) => a.id === 'seadrone');
    const out = ss.charges <= 0 && sd.charges <= 0 && !g.units.some((u) => u.alive && u.side === 'UA' && (u.type.key === 'seadrone')) && !g.missiles.some((m) => m.side === 'UA' && !m.dead && m.threat === 'cruise');
    if (out && this.outT === undefined) this.outT = g.time;
    if (out && g.time - this.outT > 4) g.lose('Alle Seedrohnen und Marschflugkörper sind verbraucht – die Brücke steht noch.');
    if (!out) this.outT = undefined;
  },
  victory: 'Die Bilder der eingestürzten Fahrbahn gehen um die Welt. Die Brücke, die als uneinnehmbar galt, ist verwundbar – wie der Mythos ihrer Erbauer.\n\nEnde der Kampagne. Der Krieg ist nicht vorbei. Slava Ukraini.',
};
