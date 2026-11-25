// Mission 6 – Bachmut, Mai 2023: Häuserkampf im Westteil der Stadt, Hinterhalte aus Häusern, Nordbrücke sprengen.
import { placeMap, placeLabel, wave, near, ground, housesNear, garrisonNow, objCount, overrun, living } from './_util.js';

const HQ = [-150, 40];          // Gefechtsstand im Privatsektor westlich der Bachmutka
const AMB = [-84, 30];          // Häuser am Westende der Brücke Zentrum (Hinterhalt)
const ROUTES = {
  N: { from: [70, -165], pts: [[-26, -150], [-76, -150], [-130, -70], [-150, 30]], bridge: 'Brücke Nord' },
  C: { from: [70, 5], pts: [[-18, 18], [-62, 26], [-110, 34], [-150, 40]], bridge: 'Brücke Zentrum' },
  S: { from: [50, 165], pts: [[-30, 170], [-80, 170], [-130, 100], [-150, 50]], bridge: 'Brücke Süd' },
};
const HOLD = 480;

export default {
  id: 'ua6_bachmut',
  title: 'Die letzten Häuser',
  place: 'Bachmut, Westufer der Bachmutka',
  date: 'Mai 2023',
  era: 'modern',
  difficulty: 2,
  summary: 'Häuserkampf in Bachmut: Trupps in die Häuser, Hinterhalte an den Brücken legen und den Westteil der Stadt acht Minuten halten – damit die Flanken gesichert werden können.',
  briefing: [
    { s: 'Oberst Koval', t: 'Bachmut, Mai 2023. Von der Stadt sind nur noch Trümmer übrig. Der Gegner greift seit Monaten in kleinen Sturmgruppen an, Welle um Welle, ohne Rücksicht auf die eigenen Verluste.' },
    { s: 'Major Iryna Bondar (Bataillon)', t: 'Wir halten die Häuserblöcke westlich der Bachmutka. Drei Brücken führen über den Fluss: Nord, Zentrum und Süd. Über alle drei werden sie kommen. Unser Gefechtsstand liegt im Privatsektor an der Straße nach Tschassiw Jar.' },
    { s: 'Sova (Aufklärung)', t: 'Die Häuser sind unsere Panzerung. Setzt Trupps in die Häuser und stellt sie auf Hinterhalt (Taste J): Sie schweigen, bis der Gegner auf 25 Meter heran ist. Zwei Gruppen am Westende der Zentrumsbrücke liegen bereits so.' },
    { s: 'Major Bondar', t: 'Die Pioniere haben Sprengladungen dabei. Wenn die Nordbrücke fällt, bleibt dem Gegner ein Weg weniger. Haltet acht Minuten – dann sind die Flanken gesichert und wir können geordnet zurückgehen.' },
  ],
  objectivesPreview: ['Westufer acht Minuten halten', 'Gefechtsstand im Privatsektor darf nicht fallen', 'Optional: Nordbrücke mit Pionieren sprengen', 'Optional: 12 Gegner aus besetzten Häusern heraus ausschalten'],
  forces: ['10× Schützen', '2× MG', '2× Javelin', '2× Scharfschütze', '1× Offizier', '1× Sanitäter', '2× Pionier', '1× Drohnenpilot', '1× Glasfaser-FPV-Operator', 'Verstärkung: T-64BV + Schützen', 'Artillerie, FPV, Glasfaser-FPV'],
  map: placeMap('bachmut', { season: 'summer', palette: 'spring' }),
  env: { season: 'summer', sunElev: 22, sunAzim: 230, fogDensity: 0.0032 },
  weather: { type: 'overcast', intensity: 0.5, changes: [{ at: 300, type: 'rain', intensity: 0.35, fade: 60 }] },
  time: { start: '17:40', speed: 8 },
  camera: { x: -100, z: 30, dist: 120, yaw: 0 },
  abilities: [{ id: 'artillery', charges: 5 }, { id: 'fpv', charges: 4 }, { id: 'm_fiberfpv', charges: 4 }, { id: 'smoke', charges: 2 }],
  friendlyEdge: [-300, 40],
  noDefaultDefeat: true,

  setup(g) {
    this.st = {}; this.houseKills = 0; this.wave = 0;
    this.markers = [
      { x: HQ[0], z: HQ[1], r: 30, label: 'Gefechtsstand', color: '#5db8ff' },
      { x: AMB[0], z: AMB[1], r: 18, label: 'Hinterhalt', color: '#ffd500' },
      { x: -50, z: -150, r: 14, label: 'Brücke Nord', color: '#ff9a3c' },
    ];
    // Hinterhaltsgruppen in den Häusern am Brückenkopf
    const hs = housesNear(g, AMB[0], AMB[1], 40);
    const a1 = g.spawnGroup([['rifle', 3], ['mg', 1]], 'UA', AMB[0] - 6, AMB[1] + 6, { spacing: 2.5, tags: ['amb'] });
    const a2 = g.spawnGroup([['rifle', 2], ['javelin', 1], ['sniper', 1]], 'UA', AMB[0] - 6, AMB[1] - 6, { spacing: 2.5, tags: ['amb'] });
    garrisonNow(g, a1, hs[0], true);
    garrisonNow(g, a2, hs[1] || hs[0], true);
    // Hauptkräfte am Gefechtsstand
    g.spawnGroup([['rifle', 5], ['mg', 1], ['javelin', 1], ['sniper', 1]], 'UA', HQ[0] + 20, HQ[1] - 6, { spacing: 3, cols: 4 });
    g.spawnGroup([['ua_officer', 1], ['ua_medic', 1], ['dronepilot', 1], ['m_fibreop', 1]], 'UA', HQ[0] - 4, HQ[1] + 6, { spacing: 3 });
    g.spawnGroup([['ua_engineer', 2]], 'UA', -120, -60, { spacing: 3, tags: ['eng'] });
    const hq = housesNear(g, HQ[0], HQ[1], 30)[0];
    if (hq) this.markers[0].x = hq.pos.x, this.markers[0].z = hq.pos.z;

    // Gegner: Vorposten im Osten, erste Sturmgruppen
    g.spawnGroup([['e_rifle', 4], ['e_mg', 1]], 'RU', 40, -20, { spacing: 4, ai: { mode: 'guard', radius: 30 } });
    g.spawnGroup([['e_sniper', 1], ['e_rifle', 2]], 'RU', 30, 120, { spacing: 4, ai: { mode: 'guard', radius: 25 } });
    g.spawn('orlan', 'RU', 60, -60, { ai: { mode: 'loiter', center: [-90, 30], radius: 70 } });

    g.addObjective('hold', `Westufer halten (${Math.round(HOLD / 60)}:00)`);
    g.addObjective('hq', 'Gefechtsstand im Privatsektor darf nicht fallen');
    g.addObjective('bridge', 'Brücke Nord mit Pionieren sprengen', { optional: true });
    g.addObjective('house', 'Gegner aus besetzten Häusern ausschalten (0/12)', { optional: true });
    g.setCountdown(HOLD, 'Flanken gesichert in', () => this.finish(g));

    g.later(2, () => g.say('Bondar', 'Sie kommen über alle drei Brücken. Trupps in die Häuser – Rechtsklick auf ein Haus, dann J für Hinterhalt.', 6));
    g.later(10, () => g.say('Bondar', 'Pioniere: zur Nordbrücke. Befehl „Brücke sprengen“ in der Befehlsleiste, dann Ziel die Brücke.', 6));
    g.later(18, () => g.say('Sova', 'Orlan kreist über uns. Ihre Artillerie wird jeden erkannten Trupp im Freien beschießen – bleibt in Deckung.', 5));
    // Wellen
    const plan = [[30, 'C', 0], [80, 'N', 0], [125, 'S', 1], [170, 'C', 1], [215, 'N', 2], [260, 'S', 2], [300, 'C', 3], [345, 'N', 3], [390, 'C', 4], [430, 'S', 4]];
    for (const [t, r, lv] of plan) g.later(t, () => this.attack(g, r, lv));
    g.every(70, () => {
      if (g.ended) return false;
      const tg = living(g, 'UA', (u) => ground(u) && !u.garrison && u.seenBy?.RU).sort(() => Math.random() - 0.5)[0];
      if (tg) { g.artilleryBarrage(tg.pos.x, tg.pos.z, 9, 4, { delay: 4, dmg: 180 }); g.alert('⚠ Artilleriefeuer!', 2); }
    }, 60);
    g.later(200, () => {
      g.spawnGroup([['m_t64', 1]], 'UA', -260, 42, { heading: -Math.PI / 2, order: [-150, 46] });
      g.spawnGroup([['rifle', 4], ['javelin', 1]], 'UA', -262, 52, { spacing: 2.5, heading: -Math.PI / 2, order: [-140, 52] });
      g.say('Bondar', 'Verstärkung über die T 0504: ein T-64 und ein Trupp. Der Panzer bleibt hinter den Häusern – er ist unsere Reserve.', 6);
    });
  },
  attack(g, key, lv) {
    if (g.ended) return;
    let r = ROUTES[key];
    const br = g.bridges.find((b) => b.name === r.bridge);
    if (br && br.state === 'destroyed') r = ROUTES.C; // Nordbrücke gesprengt → Umweg über das Zentrum
    const list = [['m_storm', 5 + lv], ['e_rpg', 1]];
    if (lv >= 2) list.push(['e_mg', 1]);
    wave(g, list, r.from[0], r.from[1], r.pts, { tags: ['wave'] });
    if (lv >= 1 && lv % 2 === 1) g.spawn(lv >= 3 ? 'bmp' : 'btr', 'RU', r.from[0] + 12, r.from[1], { ai: { mode: 'attackMove', points: r.pts, aggressive: true, after: 'guard' } });
    if (lv >= 3) g.spawn('t72', 'RU', r.from[0] + 20, r.from[1] + 8, { ai: { mode: 'attackMove', points: r.pts.slice(0, 3), aggressive: true, after: 'guard' } });
    this.wave++;
    if (this.wave === 1) g.say('Sova', 'Erste Sturmgruppe an der Zentrumsbrücke. Hinterhalt hält still … wartet …', 4);
    else if (lv >= 3) g.alert('⚠ Panzer im Anmarsch!', 3);
    else g.alert(`⚠ Sturmgruppe – ${{ N: 'Nordbrücke', C: 'Zentrumsbrücke', S: 'Südbrücke' }[key === 'N' && r === ROUTES.C ? 'C' : key]}`, 2.5);
  },
  onKill(g, u, killer) {
    if (u.side === 'RU' && killer?.garrison) {
      this.houseKills++;
      objCount(g, 'house', 'Gegner aus besetzten Häusern ausschalten', this.houseKills, 12);
      if (this.houseKills >= 12) g.setObjective('house', 'done');
    }
  },
  finish(g) {
    if (g.ended) return;
    const own = living(g, 'UA', ground).length;
    if (own < 3) { g.lose('Der Westteil der Stadt ist gefallen.'); return; }
    g.setObjective('hold', 'done'); g.setObjective('hq', 'done');
    if (g.objState('bridge') === 'open') g.setObjective('bridge', 'failed');
    if (g.objState('house') === 'open') g.setObjective('house', 'failed');
    g.win('Die Flanken sind gesichert. Im Schutz der Dämmerung lösen sich die letzten Trupps vom Westufer.');
  },
  update(g, dt) {
    if (g.ended) return;
    if (g.objState('bridge') === 'open') {
      const br = g.bridges.find((b) => b.name === 'Brücke Nord');
      if (br?.state === 'destroyed') { g.setObjective('bridge', 'done'); g.say('Bondar', 'Die Nordbrücke liegt im Fluss. Ein Weg weniger für sie.', 4); }
      else if (!br && g.time > 1) g.objectives.splice(g.objectives.findIndex((o) => o.id === 'bridge'), 1), g.emit('objectives');
    }
    if (overrun(g, this.st, 'hq', this.markers[0].x, this.markers[0].z, 32, { dt, grace: 14 })) {
      g.setObjective('hq', 'failed');
      g.lose('Der Gefechtsstand ist überrannt worden.');
      return;
    }
    if (!living(g, 'UA', (u) => ground(u) && (u.type.infantry || u.type.vehicle)).length) g.lose('Alle Trupps sind gefallen.');
  },
  victory: 'Bachmut war nicht mehr zu halten. Aber jede Stunde, die die Verteidiger gewannen, kostete den Angreifer mehr, als er bereit war zuzugeben – und gab den Flanken die Zeit, sich einzurichten.\n\nViele Kameraden sind in diesen Häusern geblieben. Wir vergessen sie nicht.',
};
