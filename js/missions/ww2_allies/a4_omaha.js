// A4 – Omaha Beach (6. Juni 1944): Strandlandung. LCVP-Landungsboote (Auf-/Absitzen), Strandhindernisse, Widerstandsnester
// WN 62/65/72 ausschalten, Ausgänge öffnen; Nebenziel Pointe du Hoc (Rangers).
import { placeMission, PLACE_BY_ID } from '../../maps/places/index.js';
import { ABILITIES } from '../../game/abilities.js';
import { us, setText, mmss, alive, fort, clearByEngineers } from './_h.js';

const PLACE = PLACE_BY_ID.omaha;
const LIMIT = 1080;                        // s Zeitlimit der Landung
const NESTS = [                            // Widerstandsnester (Kasematten-Positionen aus der Ortsvorlage)
  { id: 'wn72', name: 'WN 72', x: -222, z: -78 },
  { id: 'wn65', name: 'WN 65', x: 58, z: -74 },
  { id: 'wn62', name: 'WN 62', x: 222, z: -76 },
];
const EXITS = [{ id: 'd1', name: 'D-1 Vierville', x: -200 }, { id: 'e1', name: 'E-1 St-Laurent', x: 80 }, { id: 'e3', name: 'E-3 Colleville', x: 200 }];
const HOC = [-258, -24];                   // Pointe du Hoc (westlicher Steilhang)

const mission = placeMission(PLACE, {
  id: 'a4', title: 'Omaha – Der blutige Strand', place: 'Omaha Beach, Normandie · angelehnt an Omaha Beach', date: '6. Juni 1944, 06:30 Uhr',
  era: 'ww2', difficulty: 3, structures: false, markers: false,
  summary: 'Strandlandung unter Feuer: Landungsboote an den Strand steuern, Hindernisse räumen, drei Widerstandsnester ausschalten und die Ausgänge öffnen.',
  briefing: [
    { s: 'Colonel Mercer', t: 'Die Landungsboote bringen euch in vier Wellen an den Strand. Dahinter liegen Hindernisse, Minen und Steilhänge, auf denen die Widerstandsnester jeden Meter Sand im Feuer haben. Wer am Strand liegen bleibt, stirbt dort.' },
    { s: 'Colonel Mercer', t: 'Ziel sind die Ausgänge durch die Hänge. Dafür müssen WN 72, WN 65 und WN 62 fallen. Pioniere räumen Minen und Draht (davor stehen bleiben), die Panzer umfahren die Tschechenigel, die Schiffsartillerie und die Jabos stehen auf Abruf bereit. Rauch deckt euch beim Vorgehen.' },
    { s: 'Captain Reeves (Rangers)', t: 'Meine Rangers landen im Westen am Steilhang und klettern hinauf. Dort stehen schwere Haubitzen, die den Strand bestreichen. Wenn wir sie nehmen, wird euer Weg leichter.' },
  ],
  objectivesPreview: ['Widerstandsnester WN 72, WN 65 und WN 62 ausschalten', 'Mindestens zwei Ausgänge öffnen (D-1, E-1, E-3)', 'Optional: Haubitzen an der Pointe du Hoc ausschalten', 'Zeitlimit: 18 Minuten'],
  forces: ['4× LCVP-Landungsboot mit je 12 Mann', '1× LCVP der Rangers', '4× Pionier', '2× Bazooka', '2× BAR', '1× Offizier', '1× Sanitäter', 'Verstärkung: Sherman auf dem Strand', 'Fähigkeiten: Artillerie (Zerstörer), Jabo-Angriff, Nebel'],
  weather: { type: 'overcast', intensity: 0.25 }, time: { start: '07:00', speed: 3 },
  camera: { x: -20, z: -228, dist: 120 },
  abilities: [{ id: 'ww2_artillery', charges: 5 }, { id: 'ww2_airstrike_us', charges: 3 }, { id: 'smoke', charges: 4 }],

  setup(g) {
    this.t0 = g.time; this.exitsOpen = new Set(); this.hocDone = false; this.nestsDown = new Set(); this.reinf = false;
    // Landungsboote der ersten Welle: Besatzung/Infanterie sitzt schon auf
    const cargo = [[us.rifle, 6], [us.smg, 2], [us.lmg, 1], [us.at, 1], [us.engineer, 1], [us.medic, 0]].filter((c) => c[1] > 0);
    const wave = [[-180, -268], [-40, -268], [90, -268], [215, -268]];
    wave.forEach(([x, z], i) => g.spawn('ww2_lcvp', 'UA', x, z, { heading: 0, cargo: i === 1 ? [...cargo, [us.officer, 1], [us.medic, 1]] : cargo, tags: ['boat'] }));
    g.spawn('ww2_lcvp', 'UA', -245, -268, { heading: 0, cargo: [[us.smg, 5], [us.rifle, 4], [us.lmg, 2], [us.engineer, 1]], tags: ['boat', 'rangerboat'] });
    // Strandhindernisse, Stacheldraht und Minen am Strand
    for (let x = -240; x <= 240; x += 18) fort(g, 'ww2_tetrahedron', 'RU', x + (Math.abs(x) % 3) * 3, -118 - (Math.abs(x) % 2) * 10, { tags: ['obst'] });
    for (let x = -230; x <= 230; x += 30) fort(g, 'ww2_barbedwire', 'RU', x, -96, { tags: ['obst'] });
    for (const x of [-150, -100, 10, 120, 170]) fort(g, 'ww2_mines_ap', 'RU', x, -104, { mines: 8, tags: ['obst'] });
    // Widerstandsnester mit MG-Nestern, Pak und Infanterie in Löchern
    for (const n of NESTS) {
      const bk = fort(g, 'ww2_bunker', 'RU', n.x, n.z + 6, { heading: Math.PI, tags: ['wn', n.id] }); bk.hp = bk.maxHp = 1100;
      fort(g, 'ww2_mgnest', 'RU', n.x - 14, n.z + 10, { heading: Math.PI, tags: ['wn', n.id] });
      fort(g, 'ww2_mgnest', 'RU', n.x + 14, n.z + 10, { heading: Math.PI, tags: ['wn', n.id] });
      g.spawnGroup([['ww2_de_rifle', 3], ['ww2_de_mg42', 1]], 'RU', n.x, n.z + 2, { spacing: 3.4, cols: 3, ai: { mode: 'guard', radius: 22 }, tags: ['wn', n.id] });
    }
    // WN 66 (Les Moulins) liefert Flankenfeuer, ist aber kein Pflichtziel
    fort(g, 'ww2_mgnest', 'RU', -62, -68, { heading: Math.PI });
    // Ausgänge: leichte Besatzung
    for (const e of EXITS) g.spawnGroup([['ww2_de_rifle', 3], ['ww2_de_mg42', 1]], 'RU', e.x + 8, -8, { spacing: 3.4, cols: 4, ai: { mode: 'guard', radius: 20 } });
    // Pointe du Hoc: Haubitzen auf dem Steilhang
    for (let i = 0; i < 3; i++) g.spawn('ww2_lefh18', 'RU', HOC[0] - 4 + i * 6, HOC[1] - i * 4, { heading: Math.PI, ai: { mode: 'hold' }, tags: ['hoc'] });
    g.spawnGroup([['ww2_de_rifle', 5], ['ww2_de_mg42', 2]], 'RU', HOC[0] + 6, HOC[1] + 14, { spacing: 3.4, cols: 4, ai: { mode: 'guard', radius: 24 }, tags: ['hocguard'] });
    fort(g, 'ww2_mgnest', 'RU', HOC[0] + 4, HOC[1] + 28, { heading: Math.PI, tags: ['hocguard'] });

    g.addObjective('wn', 'Widerstandsnester ausschalten: WN 72, WN 65, WN 62 (0/3)');
    g.addObjective('exits', `Mindestens zwei Ausgänge öffnen (0/2) – ${mmss(LIMIT)}`);
    g.addObjective('hoc', 'Pointe du Hoc: Haubitzen ausschalten', { optional: true });
    // Vorbereitungsfeuer der Schiffsartillerie auf die Widerstandsnester (die Boote sind noch auf See)
    const navy = (n, delay) => g.later(delay, () => { if (!g.ended) try { ABILITIES.ww2_artillery.exec(g, n.x, n.z + 4, g.playerById(0)); } catch (e) { /* ohne Artillerie */ } });
    for (const n of NESTS) for (const d of [1, 8, 15, 22, 29]) navy(n, d);
    g.later(1, () => g.say('Mercer', 'Schiffsartillerie eröffnet das Feuer auf die Widerstandsnester!', 5));
    g.later(2, () => g.say('Mercer', 'Boote voraus! Wählt die Boote und steuert sie auf den Strand zu. Dann: absitzen (U) oder Rechtsklick auf den Strand.', 7));
    g.later(14, () => g.say('Reeves', 'Rangers an der Steilküste im Westen – wir steigen dort an Land und holen uns die Haubitzen.', 5));
    g.later(200, () => { // zweite Welle: Panzer und Pioniere auf dem Strand
      g.alert('Zweite Welle: Sherman landen am Strand', 4); g.say('Mercer', 'Panzer an Land! Sie geben euch Feuerschutz gegen die Bunker.', 5);
      g.spawnGroup([['ww2_sherman', 4]], 'UA', -20, -150, { spacing: 12, cols: 3, heading: 0, ai: { mode: 'attackMove', points: [[-20, -100]], after: 'guard' } });
      g.spawnGroup([[us.engineer, 3], [us.rifle, 6]], 'UA', 60, -145, { spacing: 3.4, cols: 5, heading: 0, ai: { mode: 'attackMove', points: [[60, -108]], after: 'guard' } });
    });
    g.later(420, () => { // dritte Welle: weitere Infanterie
      g.spawnGroup([[us.rifle, 8], [us.smg, 2], [us.medic, 1]], 'UA', 10, -146, { spacing: 3.4, cols: 6, heading: 0, ai: { mode: 'attackMove', points: [[10, -106]], after: 'guard' } });
      g.say('Mercer', 'Dritte Welle landet – Verstärkung für den Strand!', 4);
    });
    g.later(520, () => { // Gegenstoß der Reserve durch die Ausgänge
      g.alert('⚠ Deutsche Reserve rückt durch die Ausgänge vor!', 4);
      g.spawnGroup([['ww2_stug3', 1], ['ww2_de_rifle', 6], ['ww2_de_mg42', 2]], 'RU', 90, 120, { spacing: 6, cols: 5, ai: { mode: 'attackMove', points: [[84, 30], [84, -40]], aggressive: true, after: 'guard' } });
      g.spawnGroup([['ww2_de_rifle', 6], ['ww2_de_mg42', 1]], 'RU', 205, 118, { spacing: 4, cols: 4, ai: { mode: 'attackMove', points: [[204, 30], [200, -40]], aggressive: true, after: 'guard' } });
    });
  },
  update(g, dt) {
    if (g.ended) return;
    clearByEngineers(g, dt);
    const left = LIMIT - (g.time - this.t0);
    // Widerstandsnester: gefallen, wenn alle Bauwerke und Besatzungen des Nests tot sind
    for (const n of NESTS) if (!this.nestsDown.has(n.id) && g.countTag(n.id) === 0) {
      this.nestsDown.add(n.id); g.say('Mercer', `${n.name} ist ausgeschaltet!`, 4);
    }
    setText(g, 'wn', `Widerstandsnester ausschalten: WN 72, WN 65, WN 62 (${this.nestsDown.size}/3)`);
    if (this.nestsDown.size >= 3 && g.objState('wn') === 'open') g.setObjective('wn', 'done');
    // Ausgänge: ein Nest-Ausgang ist offen, wenn oben am Hang mindestens 4 eigene Soldaten stehen und kein Feind in der Nähe ist
    for (const e of EXITS) if (!this.exitsOpen.has(e.id)) {
      const ours = g.unitsInArea(e.x, -8, 28, 'UA').filter((u) => u.type.infantry || u.type.vehicle).length;
      const foes = g.unitsInArea(e.x, -8, 28, 'RU').filter((u) => !u.type.structure && !u.type.air).length;
      if (ours >= 4 && foes === 0) { this.exitsOpen.add(e.id); g.say('Mercer', `Ausgang ${e.name} ist offen!`, 4); }
    }
    setText(g, 'exits', `Mindestens zwei Ausgänge öffnen (${Math.min(2, this.exitsOpen.size)}/2) – ${mmss(left)}`);
    if (this.exitsOpen.size >= 2 && g.objState('exits') === 'open') g.setObjective('exits', 'done');
    if (g.objState('hoc') === 'open' && g.countTag('hoc') === 0) { g.setObjective('hoc', 'done'); g.say('Reeves', 'Die Haubitzen an der Pointe du Hoc sind zerstört. Der Strand ist aus Westen sicher!', 5); }
    if (g.objState('wn') === 'done' && g.objState('exits') === 'done') {
      g.say('Mercer', 'Der Strand ist offen. Die Ausgänge sind frei – die zweite Welle strömt nach.', 5);
      g.win('Der Brückenkopf bei Omaha ist gesichert. Der Preis war hoch.'); return;
    }
    if (left <= 0) { g.setObjective('exits', 'failed'); g.lose('Die Landung ist am Strand steckengeblieben – die Frist ist abgelaufen.'); }
  },
  victory: 'Am Abend hielten die Amerikaner einen schmalen Streifen zwischen Strand und Hang. Mehr als zweitausend Mann hatten dafür ihr Leben gelassen – Omaha war der teuerste Strand des D-Day.',
});
mission.markers = [
  ...NESTS.map((n) => ({ x: n.x, z: n.z, r: 14, label: n.name, color: '#ff6b6b' })),
  ...EXITS.map((e) => ({ x: e.x, z: -8, r: 14, label: 'Ausgang ' + e.name, color: '#5db8ff' })),
  { x: HOC[0], z: HOC[1], r: 14, label: 'Pointe du Hoc', color: '#ffe9a8' },
];
export default mission;
