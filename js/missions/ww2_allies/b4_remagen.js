// B4 – Remagen (7. März 1945): Die Ludendorff-Brücke im Handstreich nehmen, bevor sie gesprengt wird (Sprengladungen entschärfen),
// danach den Brückenkopf am Ostufer gegen Gegenangriffe halten.
import { placeMission, PLACE_BY_ID } from '../../maps/places/index.js';
import { us, setText, mmss, alive, fort } from './_h.js';
import { ground, infIn, wave } from './_hb.js';

const PLACE = PLACE_BY_ID.remagen;
const LIMIT = 1260;                                  // s Zeitlimit insgesamt
const HOLD = 420;                                    // s Brückenkopf halten
const EAST_X = 160;                                  // ab hier gilt ein Soldat als „drüben“
const NEED_E = 8;                                    // Soldaten, die für den Brückenkopf übersetzen müssen
const BH = { x: 200, z: 24, r: 72 };                 // Brückenkopf am Ostufer
const CH = [                                         // Sprengladungen (Zündzeit in s nach Missionsbeginn)
  { id: 'w', name: 'Westwiderlager', x: -44, z: -6, fuse: 330, t: 0, defused: false, boom: false },
  { id: 'm', name: 'Mittelbogen', x: 52, z: -6, fuse: 400, t: 0, defused: false, boom: false },
  { id: 'e', name: 'Ostwiderlager', x: 142, z: -6, fuse: 470, t: 0, defused: false, boom: false },
];

const mission = placeMission(PLACE, {
  id: 'b4', title: 'Remagen – Die Brücke steht', place: 'Remagen und Erpel am Rhein · angelehnt an Remagen', date: '7. März 1945',
  era: 'ww2', difficulty: 3, structures: false, markers: false,
  summary: 'Die Ludendorff-Brücke ist die letzte intakte Rheinbrücke: Handstreich gegen die Sprengkommandos, Ladungen entschärfen und den Brückenkopf im Osten halten.',
  briefing: [
    { s: 'Lieutenant Hollis', t: 'Wir haben Remagen fast ohne Gegenwehr erreicht – und von der Höhe aus sehen wir die Ludendorff-Brücke. Sie steht noch. Die Deutschen bereiten die Sprengung vor, vermutlich Minuten. Wenn die Brücke fällt, steht der Rhein wieder zwischen uns und der Ostseite.' },
    { s: 'Lieutenant Hollis', t: 'Wir nehmen sie im Handstreich: Infanterie vor, Panzer geben Feuerschutz, Pioniere zu den Ladungen – sie müssen drei Stellen entschärfen. Auf dem Ostufer sitzen MGs im Brückenturm und im Tunnel der Erpeler Ley. Rauch hilft, Artillerie hält die Türme nieder.' },
    { s: 'Sergeant Kowal', t: 'Wenn wir drüben sind, holt sich die Gegenseite die Brücke wieder: Panzer, Infanterie, Artillerie. Wir brauchen den Brückenkopf, bis Verstärkung nachrückt. Die Brücke muss stehen – an beiden Enden.' },
  ],
  objectivesPreview: ['Alle drei Sprengladungen entschärfen (Pioniere)', 'Mit mindestens 8 Mann das Ostufer erreichen', 'Brückenkopf halten (7 Minuten)', 'Optional: Tunnelstellung der Erpeler Ley ausschalten', 'Optional: Mindestens 2 Panzer bringen die Brücke über'],
  forces: ['12× Rifleman', '4× Thompson-Schütze', '4× BAR-Schütze', '3× Bazooka-Team', '4× Pionier', '1× Offizier', '1× Sanitäter', '1× Mörsertrupp', '3× Sherman (76 mm)', '1× M10', '2× Halbkette M3', 'Fähigkeiten: Artillerie, Nebel, Jabo-Angriff'],
  weather: { type: 'overcast', intensity: 0.3 }, time: { start: '15:30', speed: 3 },
  camera: { x: -100, z: -10, dist: 110, yaw: -1.57 },
  abilities: [{ id: 'ww2_artillery', charges: 3 }, { id: 'smoke', charges: 3 }, { id: 'ww2_airstrike_us', charges: 1 }],

  setup(g) {
    this.t0 = g.time; this.defused = 0; this.across = new Set(); this.tCross = null; this.lostT = 0; this.tanksAcross = new Set(); this.ley = false; this.bridgeObj = g.bridges[0] || null;
    // Eigene Truppen am Westufer
    g.spawnGroup([[us.rifle, 12], [us.smg, 4], [us.lmg, 4], [us.at, 3]], 'UA', -128, -72, { spacing: 3.3, cols: 6, heading: Math.PI / 2, tags: ['own'] });
    g.spawnGroup([[us.engineer, 4], [us.officer, 1], [us.medic, 1], [us.mortar, 1]], 'UA', -140, -62, { spacing: 3.5, cols: 4, heading: Math.PI / 2, tags: ['own'] });
    g.spawnGroup([['ww2_sherman76', 3], ['ww2_m10', 1], ['ww2_m3ht', 2]], 'UA', -150, -80, { spacing: 9, cols: 3, heading: Math.PI / 2, tags: ['own', 'tank'] });
    // Verteidiger am Westende: MG-Nester, Schützen, Brückenwache
    fort(g, 'ww2_mgnest', 'RU', -72, -12, { heading: -Math.PI / 2, tags: ['gar', 'wb'] }); fort(g, 'ww2_mgnest', 'RU', -72, 6, { heading: -Math.PI / 2, tags: ['gar', 'wb'] });
    fort(g, 'ww2_foxhole', 'RU', -86, -2, {}); fort(g, 'ww2_foxhole', 'RU', -94, -18, {});
    g.spawnGroup([['ww2_de_rifle', 5], ['ww2_de_mg42', 1], ['ww2_de_mp40', 1]], 'RU', -76, -2, { spacing: 3.6, cols: 4, ai: { mode: 'guard', radius: 26 }, tags: ['gar', 'wb'] });
    g.spawn('ww2_pak40', 'RU', -96, -10, { heading: -Math.PI / 2, ai: { mode: 'hold' }, tags: ['gar', 'wb'] });
    // Auf und hinter der Brücke
    g.spawnGroup([['ww2_de_rifle', 4], ['ww2_de_mg42', 1], ['ww2_de_engineer', 2]], 'RU', 52, -2, { spacing: 3.4, cols: 4, ai: { mode: 'guard', radius: 20 }, tags: ['gar', 'mid'] });
    g.spawn('ww2_flak37', 'RU', 150, -14, { heading: Math.PI, ai: { mode: 'hold' }, tags: ['gar', 'eb', 'flak'] }); g.spawn('ww2_flak37', 'RU', 150, 8, { heading: Math.PI, ai: { mode: 'hold' }, tags: ['gar', 'eb', 'flak'] });
    // Ostufer: Brückenturm, Uferstraße, Tunnelstellung der Erpeler Ley
    fort(g, 'ww2_mgnest', 'RU', 168, -14, { heading: Math.PI / 2, tags: ['gar', 'eb'] }); fort(g, 'ww2_mgnest', 'RU', 168, 8, { heading: Math.PI / 2, tags: ['gar', 'eb'] });
    fort(g, 'ww2_foxhole', 'RU', 176, -2, {}); fort(g, 'ww2_foxhole', 'RU', 186, 22, {});
    g.spawnGroup([['ww2_de_rifle', 6], ['ww2_de_mg42', 2], ['ww2_de_mp40', 1]], 'RU', 174, 0, { spacing: 3.6, cols: 4, ai: { mode: 'guard', radius: 30 }, tags: ['gar', 'eb'] });
    fort(g, 'ww2_bunker', 'RU', 186, -62, { heading: Math.PI, hpMul: 0.5, tags: ['gar', 'ley'] });
    fort(g, 'ww2_mgnest', 'RU', 172, -52, { heading: Math.PI, tags: ['gar', 'ley'] });
    g.spawnGroup([['ww2_de_rifle', 4], ['ww2_de_mg42', 1], ['ww2_de_panzer', 1]], 'RU', 188, -70, { spacing: 3.4, cols: 3, ai: { mode: 'guard', radius: 26 }, tags: ['gar', 'ley'] });
    g.addObjective('charges', `Sprengladungen entschärfen (0/3) – erste Zündung in ${mmss(CH[0].fuse)}`);
    g.addObjective('cross', `Mit ${NEED_E} Mann das Ostufer erreichen (0/${NEED_E})`);
    g.addObjective('hold', `Brückenkopf halten (${mmss(HOLD)})`, { hidden: true });
    g.addObjective('ley', 'Tunnelstellung der Erpeler Ley ausschalten', { optional: true });
    g.addObjective('tanks', 'Mindestens 2 Panzer über die Brücke bringen (0/2)', { optional: true });
    g.later(3, () => g.say('Hollis', 'Vorwärts zur Brücke! Pioniere bleiben hinter der Infanterie, bis die Türme schweigen!', 5));
    g.later(25, () => g.say('Kowal', 'Die Ladungen sitzen am West- und Ostwiderlager und im Mittelbogen. Ein Pionier, kein Feind in der Nähe – dann schneiden wir die Zündschnur durch.', 7));
    for (const c of CH) {
      const m = Math.round((c.fuse - 60) / 1);
      g.later(m, () => { if (!c.defused && !g.ended) g.alert(`⚠ ${c.name}: Zündung in einer Minute!`, 4); });
    }
  },
  update(g, dt) {
    if (g.ended) return;
    const t = g.time - this.t0;
    // Sprengladungen: entschärfen oder zünden
    for (const c of CH) {
      if (c.defused || c.boom) continue;
      const foes = g.unitsInArea(c.x, c.z, 15, 'RU').filter((u) => !u.type.structure && !u.type.air).length;
      const eng = g.unitsInArea(c.x, c.z, 8, 'UA').filter((u) => u.type.engineer).length;
      if (eng > 0 && foes === 0) {
        c.t += dt * eng;
        if (c.t >= 6) { c.defused = true; this.defused++; g.say('Kowal', `${c.name}: Ladung entschärft!`, 4); }
      }
      if (!c.defused && t > c.fuse) {
        c.boom = true; g.effects.explosion(c.x, 1, c.z, 1.6, { crater: false });
        if (this.bridgeObj) g.mapobj.br.destroy(this.bridgeObj, 'charge');
        g.setObjective('charges', 'failed'); g.lose('Die Ladungen sind gezündet – die Ludendorff-Brücke ist gesprengt, der Rhein bleibt eine Mauer.'); return;
      }
    }
    const next = CH.find((c) => !c.defused);
    setText(g, 'charges', next ? `Sprengladungen entschärfen (${this.defused}/3) – nächste Zündung in ${mmss(next.fuse - t)}` : 'Alle Sprengladungen entschärft');
    if (this.defused >= 3 && g.objState('charges') === 'open') { g.setObjective('charges', 'done'); g.say('Hollis', 'Alle Ladungen sind raus! Die Brücke gehört uns, wenn wir sie halten.', 5); }
    // Übergang
    for (const u of g.units) if (u.alive && u.side === 'UA' && u.pos.x > EAST_X && u.pos.x < 260) { if (u.type.infantry) this.across.add(u.id); else if (u.type.vehicle) this.tanksAcross.add(u.id); }
    const n = this.across.size;
    if (g.objState('cross') === 'open') setText(g, 'cross', `Mit ${NEED_E} Mann das Ostufer erreichen (${Math.min(n, NEED_E)}/${NEED_E})`);
    if (g.objState('tanks') === 'open') { setText(g, 'tanks', `Mindestens 2 Panzer über die Brücke bringen (${Math.min(this.tanksAcross.size, 2)}/2)`); if (this.tanksAcross.size >= 2) g.setObjective('tanks', 'done'); }
    if (g.objState('ley') === 'open' && g.units.filter((u) => u.alive && u.side === 'RU' && u.tags.has('ley')).length === 0) { g.setObjective('ley', 'done'); g.say('Kowal', 'Der Tunnel ist still – kein MG mehr am Hang.', 4); }
    if (this.tCross === null && n >= NEED_E && this.defused >= 3) this.startHold(g);
    if (this.tCross !== null) {
      const left = HOLD - (g.time - this.tCross);
      setText(g, 'hold', `Brückenkopf halten (${mmss(left)})`);
      const ours = infIn(g, 'UA', BH.x, BH.z, BH.r).length, foes = ground(g, 'RU', BH.x, BH.z, 50).length;
      if (ours === 0 && foes >= 4) { this.lostT += dt; if (this.lostT > 14) { g.setObjective('hold', 'failed'); g.lose('Der Brückenkopf ist verloren – die Männer auf dem Ostufer wurden zurückgeworfen.'); return; } } else this.lostT = Math.max(0, this.lostT - dt);
      if (left <= 0 && ours >= 3) {
        g.setObjective('hold', 'done'); if (g.objState('ley') === 'open') g.setObjective('ley', 'failed'); if (g.objState('tanks') === 'open') g.setObjective('tanks', 'failed');
        g.say('Hollis', 'Verstärkung rollt über die Brücke. Der Brückenkopf steht!', 5);
        g.win('Der Brückenkopf am Ostufer ist gehalten. Die Ludendorff-Brücke war der erste Rheinübergang für die Alliierten – ein Wendepunkt der Schlussphase des Krieges.'); return;
      }
    }
    if (t > LIMIT) { g.setObjective(this.tCross === null ? 'cross' : 'hold', 'failed'); g.lose('Die Zeit ist abgelaufen – der Brückenkopf ist nicht zustande gekommen.'); }
  },
  startHold(g) {
    this.tCross = g.time;
    g.setObjective('cross', 'done');
    const o = g.objectives.find((q) => q.id === 'hold'); if (o) { o.hidden = false; g.emit('objectives'); }
    g.say('Hollis', 'Wir sind drüben! Jetzt kommen die Gegenangriffe – Stellungen am Ostufer, Bazookas an die Straße!', 6);
    g.alert('Brückenkopf am Ostufer errichtet', 4);
    g.addAbilityCharges('ww2_artillery', 2); g.addAbilityCharges('smoke', 1);
    const go = (d, ...a) => g.later(d, () => wave(g, ...a));
    go(30, [['ww2_de_rifle', 6], ['ww2_de_mp40', 2], ['ww2_de_mg42', 1]], [280, 74], [[240, 60], [210, 40], [190, 22]], { msg: '⚠ Gegenangriff entlang der Uferstraße!' });
    go(85, [['ww2_pz4', 1], ['ww2_de_rifle', 5], ['ww2_de_mg42', 1]], [184, -74], [[186, -50], [188, -10], [190, 18]], { msg: '⚠ Panzer aus dem Tunnel der Erpeler Ley!' });
    go(150, [['ww2_stug3', 1], ['ww2_de_rifle', 6], ['ww2_de_mp40', 2]], [280, 60], [[240, 56], [214, 40], [194, 22]], { msg: '⚠ Sturmgeschütz mit Infanterie von Osten!' });
    go(215, [['ww2_pz4', 1], ['ww2_panther', 1], ['ww2_de_rifle', 6], ['ww2_de_mg42', 1]], [270, -20], [[240, 0], [216, 14], [196, 24]], { msg: '⚠ Starker Panzerangriff!' });
    go(290, [['ww2_de_rifle', 8], ['ww2_de_mp40', 2], ['ww2_de_panzer', 1]], [148, 250], [[150, 150], [170, 80], [190, 40]], { msg: '⚠ Infanterie von Süden entlang des Ufers!' });
    go(350, [['ww2_stug3', 1], ['ww2_pz4', 1], ['ww2_de_rifle', 6], ['ww2_de_mg42', 1]], [280, 50], [[240, 54], [214, 38], [194, 22]], { msg: '⚠ Letzter Gegenstoß!' });
    // Eigene Verstärkung folgt über die Brücke
    g.later(60, () => {
      g.say('Kowal', 'Pioniere und Panzer kommen über die Brücke nach.', 5);
      g.spawnGroup([['ww2_sherman76', 2], [us.rifle, 6], [us.engineer, 1]], 'UA', -150, -20, { spacing: 8, cols: 3, heading: Math.PI / 2, ai: { mode: 'attackMove', points: [[40, -4], [180, 10]], after: 'guard' }, tags: ['own', 'tank'] });
    });
    // Artillerie des Gegners auf den Brückenkopf (nicht auf die Brücke)
    g.every(45, () => { if (!g.ended) { const c = alive(g, 'UA', (u) => u.type.infantry && u.pos.x > 170); if (c.length) { const u = c[Math.floor(Math.random() * c.length)]; g.artilleryBarrage(u.pos.x, u.pos.z, 10, 3, { delay: 4, dmg: 90 }); } } }, 60);
  },
  victory: 'Die Ludendorff-Brücke blieb befahrbar und sicherte den ersten Brückenkopf östlich des Rheins. Wenige Tage später stürzte sie, durch die Zerstörungen und Überlastung, in den Fluss – da standen aber schon Pontonbrücken.',
});
mission.markers = [
  ...CH.map((c) => ({ x: c.x, z: c.z, r: 8, label: `Ladung: ${c.name}`, color: '#ff6b6b' })),
  { x: BH.x, z: BH.z, r: 20, label: 'Brückenkopf Ost', color: '#5db8ff' },
  { x: 188, z: -70, r: 14, label: 'Tunnel Erpeler Ley', color: '#ffe9a8' },
];
export default mission;
