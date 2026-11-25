// B3 – Bastogne (Dezember 1944): Eingeschlossen. Verteidigung der Stadt im Schnee, bis der Entsatz eintrifft. Solange Nebel und Schnee den
// Himmel schließen, gibt es weder Nachschub noch Luftunterstützung – erst der Wetterumschwung bringt Abwürfe und Jagdbomber.
import { placeMission, PLACE_BY_ID } from '../../maps/places/index.js';
import { airMission } from '../../engine/aircraft.js';
import { us, setText, mmss, alive, fort } from './_h.js';
import { limitAmmo, refill, ammoLevel, ground, infIn, wave } from './_hb.js';

const PLACE = PLACE_BY_ID.bastogne;
const CEN = { x: 0, z: 0, r: 40 };                 // Marktplatz
const CLEAR = 420;                                  // s: Himmel klart auf (Abwürfe, Jabos)
const RELIEF = 900;                                 // s: Panzerspitze von Süden
const FINISH = 70;                                  // s nach dem Entsatz: Angriffe gebrochen
const DZ = [{ x: -34, z: 34, at: 440 }, { x: 40, z: -30, at: 700 }];   // Abwurfzonen

const W = [-270, -40], Nn = [8, -270], Ea = [270, -28], SE = [262, 190];
const mission = placeMission(PLACE, {
  id: 'b3', title: 'Bastogne – Eingeschlossen', place: 'Bastogne, Ardennen · angelehnt an Bastogne', date: 'Dezember 1944',
  era: 'ww2', difficulty: 3, structures: false, markers: false,
  summary: 'Im Schnee eingekesselt: Die Stadt gegen Angriffe aus allen Richtungen halten, bis das Wetter aufklart, der Nachschub einfliegt und der Entsatz eintrifft.',
  briefing: [
    { s: 'Colonel Haines', t: 'Sieben Straßen laufen in Bastogne zusammen – deshalb will der Gegner die Stadt, und deshalb sitzen wir jetzt mittendrin. Die Deutschen haben uns auf allen Seiten eingeschlossen. Der Himmel ist zu: kein Nachschub aus der Luft, keine Jabos.' },
    { s: 'Colonel Haines', t: 'Munition und Sanitätsmaterial sind knapp. Jeder Schuss zählt. Die Deutschen werden uns zur Übergabe auffordern – die Antwort wird ein einziges Wort sein. Danach halten wir den Ring: Vier Sektoren, Panzerabwehr nach vorn, Infanterie in die Löcher.' },
    { s: 'Sergeant Reyes', t: 'Wenn das Wetter aufklart, kommen die Transporter mit Nachschub und die Jagdbomber. Bis dahin: halten, halten, halten. Und der Entsatz kommt von Süden – wir wissen nur nicht genau wann.' },
  ],
  objectivesPreview: ['Bastogne halten, bis der Entsatz eintrifft', 'Optional: Mindestens 8 gepanzerte Fahrzeuge zerstören', 'Optional: Nachschubabwurf bergen (15 Einheiten auffüllen)', 'Optional: Marktplatz nie ganz verlieren', 'Wetter: Schnee und Nebel, später klar'],
  forces: ['16× Rifleman', '8× Fallschirmjäger', '4× BAR-Schütze', '5× Bazooka-Team', '2× Pionier', '2× Sanitäter', '1× Offizier', '2× Mörsertrupp', '1× Scharfschütze', '3× 57-mm-Pak', '2× M101-Haubitze', '3× Sherman', '2× M10', 'Fähigkeiten: Artillerie, Nebel; später Jabo-Angriff'],
  weather: { type: 'fog', intensity: 0.55, changes: [{ at: 120, type: 'snow', intensity: 0.6, fade: 30 }, { at: CLEAR, type: 'clear', intensity: 0, fade: 45 }] }, time: { start: '07:30', speed: 3 },
  camera: { x: 0, z: 20, dist: 120 },
  abilities: [{ id: 'ww2_artillery', charges: 3 }, { id: 'smoke', charges: 2 }, { id: 'ww2_airstrike_us', charges: 0 }],

  setup(g) {
    this.t0 = g.time; this.tanks = 0; this.supplied = new Set(); this.cleared = false; this.lostT = 0; this.sqT = 0; this.centerLost = false; this.warnAmmo = false; this.rel = false; this.tRel = null;
    const inf = (x, z, n, h) => g.spawnGroup(n, 'UA', x, z, { spacing: 3.3, cols: 5, heading: h, tags: ['own'] });
    const own = [
      ...inf(-74, -6, [[us.rifle, 5], [us.lmg, 1], [us.at, 1]], Math.PI * 1.5),   // West
      ...inf(6, -66, [[us.rifle, 5], [us.lmg, 1], [us.at, 1]], Math.PI),             // Nord
      ...inf(78, -6, [[us.rifle, 4], [us.para, 2], [us.lmg, 1], [us.at, 1]], Math.PI / 2),   // Ost
      ...inf(56, 60, [[us.para, 6], [us.lmg, 1], [us.at, 2]], Math.PI * 0.25),      // Südost
      ...inf(-6, 8, [[us.rifle, 2], [us.sniper, 1], [us.officer, 1], [us.medic, 2], [us.engineer, 2], [us.mortar, 2]], Math.PI),   // Marktplatz
      g.spawn('ww2_us_57mm', 'UA', -70, 12, { heading: -Math.PI / 2, tags: ['own'] }), g.spawn('ww2_us_57mm', 'UA', 16, -60, { heading: Math.PI, tags: ['own'] }), g.spawn('ww2_us_57mm', 'UA', 74, 14, { heading: Math.PI / 2, tags: ['own'] }),
      g.spawn('ww2_m101', 'UA', -20, 24, { heading: Math.PI, tags: ['own'] }), g.spawn('ww2_m101', 'UA', 20, 24, { heading: Math.PI, tags: ['own'] }),
      g.spawn('ww2_sherman', 'UA', -64, -22, { heading: -Math.PI / 2, tags: ['own', 'tank'], ai: { mode: 'hold' } }), g.spawn('ww2_sherman', 'UA', 66, -24, { heading: Math.PI / 2, tags: ['own', 'tank'], ai: { mode: 'hold' } }),
      g.spawn('ww2_sherman', 'UA', 8, 50, { heading: Math.PI, tags: ['own', 'tank'], ai: { mode: 'hold' } }),
      g.spawn('ww2_m10', 'UA', -8, -52, { heading: Math.PI, tags: ['own', 'tank'], ai: { mode: 'hold' } }), g.spawn('ww2_m10', 'UA', 64, 44, { heading: Math.PI / 4, tags: ['own', 'tank'], ai: { mode: 'hold' } }),
    ];
    limitAmmo(own, 0.8);
    for (const [x, z] of [[-84, -14], [-84, 6], [-14, -72], [26, -70], [88, -16], [88, 6], [62, 70], [74, 54]]) fort(g, 'ww2_foxhole', 'UA', x, z, {});
    fort(g, 'ww2_mgnest', 'UA', -80, 0, { heading: -Math.PI / 2 }); fort(g, 'ww2_mgnest', 'UA', 16, -76, { heading: Math.PI }); fort(g, 'ww2_mgnest', 'UA', 92, -4, { heading: Math.PI / 2 });
    g.addObjective('hold', `Bastogne halten, bis der Entsatz eintrifft (${mmss(RELIEF)})`);
    g.addObjective('armor', 'Mindestens 8 gepanzerte Fahrzeuge zerstören (0/8)', { optional: true });
    g.addObjective('supply', 'Nachschubabwurf bergen: 15 Einheiten auffüllen (0/15)', { optional: true, hidden: true });
    g.addObjective('square', 'Marktplatz nie ganz verlieren', { optional: true });
    g.later(3, () => g.say('Haines', 'Sektoren besetzen, Panzerabwehr nach vorn! Munition sparen – Feuer nur auf Sicht.', 6));
    g.later(40, () => g.say('Reyes', 'Kein Flugzeug am Himmel, kein Nachschub. Wir haben, was wir tragen.', 5));
    // Angriffe: Ab der dritten Phase stoßen die Wellen bis auf den Marktplatz durch (sonst blieben sie am Rand stehen)
    const wv = (t, list, from, pts, o) => g.later(t, () => wave(g, list, from, t >= 440 ? [...pts, [0, 0]] : pts, o));
    wv(70, [['ww2_de_rifle', 7], ['ww2_de_mg42', 1], ['ww2_de_mp40', 1]], W, [[-200, -30], [-110, -14], [-80, -6]], { msg: '⚠ Angriff von Westen (Straße nach Marche)!' });
    wv(160, [['ww2_pz4', 1], ['ww2_de_rifle', 6], ['ww2_de_mg42', 1]], Nn, [[8, -200], [8, -120], [8, -76]], { msg: '⚠ Panzer von Norden (Straße nach Houffalize)!' });
    wv(340, [['ww2_stug3', 1], ['ww2_pz4', 1], ['ww2_de_rifle', 6], ['ww2_de_mg42', 1]], SE, [[200, 150], [130, 100], [74, 62]], { msg: '⚠ Panzer von Südosten (Marvie)!' });
    wv(440, [['ww2_pz4', 1], ['ww2_de_rifle', 6]], W, [[-200, -30], [-110, -14], [-80, -6]], { msg: '⚠ Panzerangriff von Westen!' });
    wv(530, [['ww2_pz4', 1], ['ww2_de_rifle', 5], ['ww2_de_mg42', 1]], Nn, [[8, -200], [8, -120], [8, -76]], { msg: '⚠ Panzer von Norden!' });
    wv(740, [['ww2_stug3', 1], ['ww2_de_rifle', 5], ['ww2_de_fj', 2]], SE, [[200, 150], [130, 100], [74, 62]], { msg: '⚠ Starker Angriff von Südosten!' });
    wv(790, [['ww2_pz4', 1], ['ww2_de_rifle', 5], ['ww2_de_mp40', 1]], Nn, [[8, -200], [8, -120], [8, -76]], { msg: '⚠ Panzerangriff von Norden!' });
    g.later(300, () => g.say('Haines', 'Ein deutscher Parlamentär fordert die Übergabe der Stadt. Die Antwort ist ein einziges Wort: „Nuts!“', 6));
    g.later(CLEAR - 10, () => g.say('Reyes', 'Der Nebel reißt auf! Gleich hören wir Motoren – haltet die Abwurfzone frei!', 6));
    g.later(CLEAR + 15, () => {
      this.cleared = true; g.alert('Himmel klart auf – Luftunterstützung verfügbar', 5);
      g.addAbilityCharges('ww2_airstrike_us', 3); g.addAbilityCharges('ww2_artillery', 2);
      g.say('Haines', 'Jabos über uns! Der Himmel gehört wieder uns – gebt Zielmarkierungen für den Luftschlag.', 5);
    });
    DZ.forEach((z, i) => g.later(z.at, () => {
      if (g.ended) return;
      g.say('Reyes', i === 0 ? 'Transporter im Anflug! Nachschub fällt westlich des Marktplatzes – holt ihn euch!' : 'Zweiter Abwurf – diesmal nördlich des Platzes. Hinlaufen, nachfüllen!', 5);
      const p = g.playerById(0);
      try { airMission(g, p, z.x, z.z, { model: 'c47', count: 3, formation: 'vic', radio: 'Nachschub', noFlak: true, onOverTarget() {} }); } catch (e) { /* ohne Flugzeugmodell nur Zone */ }
      g.markerTo('UA', z.x, z.z, 0xffd500, 120, 16);
      this.dz = { x: z.x, z: z.z, t: g.time, left: 120 };
      const o = g.objectives.find((q) => q.id === 'supply'); if (o && o.hidden) { o.hidden = false; g.emit('objectives'); }
    }));
    g.later(RELIEF - 30, () => g.say('Reyes', 'Panzer im Süden! Das ist die 4. Panzerdivision – sie brechen den Ring!', 5));
    g.later(RELIEF, () => {
      this.rel = true; this.tRel = g.time; g.alert('Entsatz: Panzerspitze von Süden', 6);
      g.spawnGroup([['ww2_sherman76', 4], ['ww2_m3ht', 2], [us.rifle, 8]], 'UA', 10, 280, { spacing: 8, cols: 4, heading: Math.PI, ai: { mode: 'attackMove', points: [[10, 190], [8, 110], [8, 60]], after: 'guard' }, tags: ['own', 'relief'] });
    });
  },
  onKill(g, u) {
    if (u.side === 'RU' && u.type.vehicle && !u.type.air) {
      this.tanks++; setText(g, 'armor', `Mindestens 8 gepanzerte Fahrzeuge zerstören (${Math.min(this.tanks, 8)}/8)`); if (this.tanks >= 8) g.setObjective('armor', 'done');
    }
  },
  update(g, dt) {
    if (g.ended) return;
    const t = g.time - this.t0;
    const mine = alive(g, 'UA', (u) => u.type.infantry);
    if (this.dz && this.dz.left > 0) {
      this.dz.left -= dt;
      for (const u of ground(g, 'UA', this.dz.x, this.dz.z, 16)) if (!u.tags.has('s' + this.dz.t)) {
        u.tags.add('s' + this.dz.t);
        if (refill([u], 0.9)) this.supplied.add(u.id);
      }
      setText(g, 'supply', `Nachschubabwurf bergen: 15 Einheiten auffüllen (${Math.min(this.supplied.size, 15)}/15)`);
      if (this.supplied.size >= 15) g.setObjective('supply', 'done');
    }
    if (!this.warnAmmo && ammoLevel(g) < 0.3) { this.warnAmmo = true; g.say('Haines', 'Die Munition geht zur Neige – nur noch gezielte Schüsse, Reserven in die Löcher!', 5); }
    // Marktplatz: Die Stadt fällt, wenn sich der Gegner mit mindestens 6 Mann in der Mitte hält und kaum Schützen im Ring (85 m) übrig sind;
    // das Nebenziel „Marktplatz nie ganz verlieren“ fällt schon, wenn die Mitte (40 m) leer von eigenen Schützen und voller Gegner ist
    const oursC = infIn(g, 'UA', CEN.x, CEN.z, CEN.r).length, oursRing = infIn(g, 'UA', CEN.x, CEN.z, 85).length, foesC = ground(g, 'RU', CEN.x, CEN.z, CEN.r).length;
    if (oursC === 0 && foesC >= 5) this.sqT += dt; else this.sqT = Math.max(0, this.sqT - dt);
    if (!this.centerLost && this.sqT > 6) { this.centerLost = true; g.setObjective('square', 'failed'); g.alert('Marktplatz teilweise verloren!', 4); }
    if (foesC >= 6 && oursRing <= 5) this.lostT += dt; else this.lostT = Math.max(0, this.lostT - dt);
    if (this.lostT > 16) { g.setObjective('hold', 'failed'); g.lose('Der Marktplatz von Bastogne ist verloren – der Ring ist gesprengt, die Stadt gefallen.'); return; }
    setText(g, 'hold', this.rel ? 'Bastogne halten – die Panzerspitze bricht den Ring' : `Bastogne halten, bis der Entsatz eintrifft (${mmss(RELIEF - t)})`);
    if (this.rel && g.time - this.tRel > FINISH) {
      const rem = alive(g, 'RU', (u) => u.tags.has('wave') && Math.hypot(u.pos.x, u.pos.z) < 90).length;
      if ((rem <= 3 || foesC <= 6) && mine.length > 0) {
        g.setObjective('hold', 'done'); if (g.objState('square') === 'open') g.setObjective('square', 'done');
        if (g.objState('armor') === 'open') g.setObjective('armor', 'failed'); if (g.objState('supply') === 'open') g.setObjective('supply', 'failed');
        g.say('Haines', 'Die Spitze ist da. Der Ring ist gebrochen – Bastogne ist frei.', 5);
        g.win('Bastogne ist gehalten. Der Entsatz hat den Ring gesprengt, die Verteidiger haben die Ardennenoffensive an ihrem Knotenpunkt gestoppt.'); return;
      }
    }
    if (mine.length === 0 && alive(g, 'UA').length === 0) { g.setObjective('hold', 'failed'); g.lose('Die Verteidiger sind aufgerieben – Bastogne ist gefallen.'); }
  },
  victory: 'Bastogne hielt. Der Straßenknoten blieb in alliierter Hand und nahm der deutschen Ardennenoffensive ihr wichtigstes Ziel – gegen Schnee, Kälte und den Mangel an allem.',
});
mission.markers = [
  { x: CEN.x, z: CEN.z, r: 24, label: 'Marktplatz', color: '#5db8ff' },
  { x: 10, z: 250, r: 14, label: 'Entsatz (Süden)', color: '#ffe9a8' },
];
export default mission;
