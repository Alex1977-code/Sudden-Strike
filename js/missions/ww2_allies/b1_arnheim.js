// B1 – Arnheim (September 1944): Brücke halten bis zur Ablösung. Britische Fallschirmjäger halten das Nordende der Rheinbrücke
// gegen Panzerangriffe, die Munition wird knapp, die Ablösung kommt nicht rechtzeitig – zuletzt Ausbruch nach Westen.
import { placeMission, PLACE_BY_ID } from '../../maps/places/index.js';
import { uk, setText, mmss, alive, fort } from './_h.js';
import { limitAmmo, refill, ammoLevel, ground, infIn, wave } from './_hb.js';

const PLACE = PLACE_BY_ID.arnheim;
const BR = { x: 60, z: 66, r: 46 };                 // Brückenkopf (Nordende der Rheinbrücke)
const OUT = { x: -215, z: -34, r: 34 };             // Sammelraum Oosterbeek (Ziel des Ausbruchs)
const HOLD = 720;                                   // s bis zum Ausbruchsbefehl (die Ablösung bleibt aus)
const MIN_T = 300;                                  // s, vor denen der Verlust der Brücke die Mission beendet
const BREAK_T = 330;                                // s für den Ausbruch
const NEED_OUT = 8;                                 // Soldaten, die den Sammelraum erreichen müssen
const DROP = { x: 40, z: 40 };                      // Abwurfzone des ersten Versorgungsabwurfs

const N = [60, -200], S = [60, 290], EA = [262, 40];
const mission = placeMission(PLACE, {
  id: 'b1', title: 'Arnheim – Die Brücke', place: 'Arnheim, Niederlande · angelehnt an Arnheim', date: 'September 1944',
  era: 'ww2', difficulty: 3, structures: false, markers: false,
  summary: 'Britische Fallschirmjäger halten das Nordende der Rheinbrücke gegen Panzer, die Munition geht zur Neige – die Ablösung kommt zu spät, am Ende steht der geordnete Ausbruch.',
  briefing: [
    { s: 'Major Carver', t: 'Wir halten das Nordende der Brücke – mehr ist von der Division nicht durchgekommen. Der Rest liegt weiter westlich bei Oosterbeek unter Druck. Wenn die Brücke in unserer Hand bleibt, kann das Panzerkorps von Süden über den Rhein.' },
    { s: 'Major Carver', t: 'Die Deutschen greifen von drei Seiten an, zuletzt mit Panzern und Sturmgeschützen. Unsere Munition ist begrenzt – jeder Schuss muss sitzen. PIATs und 6-Pfünder gegen die Panzer, Schützen in die Häuser an der Rampe.' },
    { s: 'Captain Ashby', t: 'Das Korps meldet sich: „In Kürze bei euch.“ Wir haben das schon zweimal gehört. Haltet so lange wie möglich. Und wenn der Befehl zum Ausbruch kommt, geht es geordnet nach Westen, Verwundete zuerst in die Mitte.' },
  ],
  objectivesPreview: ['Nordende der Brücke halten (Ablösung erwartet)', 'Dann: Geordneter Ausbruch – mindestens 8 Mann erreichen Oosterbeek', 'Optional: Mindestens 6 gepanzerte Fahrzeuge zerstören', 'Optional: Mindestens 14 Mann kommen durch', 'Munition ist knapp – Versorgungsabwürfe beachten'],
  forces: ['10× Fallschirmjäger', '6× Rifleman', '4× Sten-Schütze', '4× Bren-Gunner', '4× PIAT-Team', '2× Sapper', '1× Scharfschütze', '1× Offizier', '1× Sanitäter', '1× Mörsertrupp', '2× 6-pdr', 'Fähigkeiten: Artillerie, Nebel'],
  weather: { type: 'overcast', intensity: 0.35 }, time: { start: '10:30', speed: 3 },
  camera: { x: 62, z: 50, dist: 110 },
  abilities: [{ id: 'ww2_artillery', charges: 3 }, { id: 'smoke', charges: 3 }],

  setup(g) {
    this.t0 = g.time; this.phase = 'hold'; this.tBreak = null; this.lostT = 0; this.arrived = new Set(); this.kills = 0; this.dropDone = {}; this.lowWarn = false;
    // Britische Fallschirmjäger am Brückenkopf, in und zwischen den Häusern an der Rampe
    const own = [
      ...g.spawnGroup([[uk.para, 10], [uk.smg, 4], [uk.rifle, 6]], 'UA', 60, 70, { spacing: 3.4, cols: 5, heading: Math.PI, tags: ['own'] }),
      ...g.spawnGroup([[uk.lmg, 4], [uk.at, 4], [uk.sniper, 1]], 'UA', 60, 56, { spacing: 3.4, cols: 5, heading: Math.PI, tags: ['own'] }),
      ...g.spawnGroup([[uk.engineer, 2], [uk.officer, 1], [uk.medic, 1], [uk.mortar, 1]], 'UA', 60, 80, { spacing: 3.6, cols: 3, heading: Math.PI, tags: ['own'] }),
      g.spawn('ww2_6pdr', 'UA', 38, 48, { heading: -2.4, tags: ['own'] }), g.spawn('ww2_6pdr', 'UA', 84, 46, { heading: -0.7, tags: ['own'] }),
    ];
    limitAmmo(own, 0.5);
    fort(g, 'ww2_foxhole', 'UA', 34, 30, { tags: ['pos'] }); fort(g, 'ww2_foxhole', 'UA', 88, 30, { tags: ['pos'] });
    fort(g, 'ww2_foxhole', 'UA', 32, 84, { tags: ['pos'] }); fort(g, 'ww2_foxhole', 'UA', 90, 86, { tags: ['pos'] });
    fort(g, 'ww2_mgnest', 'UA', 52, 36, { heading: Math.PI, tags: ['pos'] }); fort(g, 'ww2_mgnest', 'UA', 70, 36, { heading: Math.PI, tags: ['pos'] });
    g.addObjective('hold', `Nordende der Brücke halten – Ablösung erwartet (${mmss(HOLD)})`);
    g.addObjective('break', `Ausbruch nach Oosterbeek: mindestens ${NEED_OUT} Mann im Sammelraum`, { hidden: true });
    g.addObjective('armor', 'Mindestens 6 gepanzerte Fahrzeuge zerstören (0/6)', { optional: true });
    g.addObjective('men', 'Mindestens 14 Mann kommen durch', { optional: true, hidden: true });
    g.later(3, () => g.say('Carver', 'Stellungen halten! Schützen in die Häuser an der Rampe, PIATs ans Ende der Straße.', 6));
    g.later(25, () => g.say('Ashby', 'Funkspruch vom Korps: Ablösung „in etwa 12 Minuten“.', 5));
    // Angriffswellen
    const W = (t, ...a) => g.later(t, () => wave(g, ...a));
    W(50, [['ww2_puma', 2], ['ww2_sdkfz251', 1], ['ww2_de_rifle', 5], ['ww2_de_mg42', 1]], S, [[60, 200], [60, 130], [60, 98]], { msg: '⚠ Gepanzerte Spähwagen und Halbkettenfahrzeuge über die Brücke!' });
    W(150, [['ww2_de_rifle', 6], ['ww2_de_mg42', 1], ['ww2_de_mp40', 1]], EA, [[180, 0], [120, 30], [80, 50]], { msg: '⚠ Infanterie greift von Osten an!' });
    W(260, [['ww2_pz4', 1], ['ww2_de_rifle', 5], ['ww2_de_mg42', 1]], N, [[56, -90], [58, -10], [60, 36]], { msg: '⚠ Panzer von Norden!' });
    W(390, [['ww2_sdkfz251', 2], ['ww2_de_rifle', 6], ['ww2_de_mp40', 2], ['ww2_puma', 1]], S, [[60, 200], [60, 130], [60, 98]], { msg: '⚠ Zweiter Vorstoß über die Brücke!' });
    W(470, [['ww2_pz4', 1], ['ww2_stug3', 1], ['ww2_de_rifle', 6], ['ww2_de_mg42', 1]], EA, [[190, -10], [120, 20], [84, 48]], { msg: '⚠ Panzer und Sturmgeschütz von Osten!' });
    W(590, [['ww2_panther', 1], ['ww2_de_rifle', 7], ['ww2_de_mg42', 1], ['ww2_de_panzer', 1]], N, [[50, -100], [56, -20], [60, 34]], { msg: '⚠ Schwerer Panzer von Norden!' });
    W(690, [['ww2_stug3', 1], ['ww2_pz4', 1], ['ww2_de_rifle', 6], ['ww2_de_mp40', 2]], EA, [[190, 0], [120, 28], [80, 52]], { msg: '⚠ Starker Angriff von Osten!' });
    // Verstärkung aus Oosterbeek und Versorgungsabwürfe
    g.later(380, () => {
      g.say('Ashby', 'Eine Gruppe aus Oosterbeek hat sich durchgeschlagen – sechs Mann, wenig Munition.', 5);
      limitAmmo(g.spawnGroup([[uk.smg, 3], [uk.rifle, 3]], 'UA', -60, -30, { spacing: 3.4, cols: 3, heading: Math.PI / 2, ai: { mode: 'attackMove', points: [[40, 30]], after: 'hold' }, tags: ['own'] }), 0.4);
    });
    g.later(200, () => {
      g.say('Ashby', 'Versorgungsabwurf! Er geht nahe der Rampe nieder – holt die Container, solange es geht.', 5);
      g.markerTo('UA', DROP.x, DROP.z, 0xffd500, 90, 14); this.drop = { ...DROP, t: g.time, left: 90 };
    });
    g.later(520, () => {
      g.say('Ashby', 'Zweiter Abwurf – der Wind hat ihn zur Hälfte nach Osten getragen. Was wir haben, ist, was wir haben.', 5);
      g.markerTo('UA', 76, 46, 0xffd500, 60, 12); this.drop = { x: 76, z: 46, t: g.time, left: 60 };
    });
    g.later(480, () => g.say('Ashby', 'Das Korps meldet: Spitze bei Nijmegen aufgehalten. Neue Ankunftszeit unbekannt.', 5));
    g.later(HOLD - 45, () => {
      g.say('Carver', 'Gefechtsmeldung: Die Brigade ist abgeschnitten, die Ablösung erreicht uns nicht mehr. Ausbruch vorbereiten!', 6);
      // Deutsche Sperrgruppen entlang der Utrechtseweg im Westen
      g.spawnGroup([['ww2_de_rifle', 5], ['ww2_de_mg42', 1], ['ww2_de_mp40', 1]], 'RU', -110, -34, { spacing: 4, cols: 4, ai: { mode: 'guard', radius: 30 }, tags: ['block'] });
      g.spawnGroup([['ww2_de_rifle', 4], ['ww2_de_mg42', 1]], 'RU', -170, -40, { spacing: 4, cols: 4, ai: { mode: 'guard', radius: 30 }, tags: ['block'] });
    });
  },
  startBreakout(g, why) {
    if (this.phase !== 'hold') return;
    this.phase = 'break'; this.tBreak = g.time;
    g.setObjective('hold', why === 'time' ? 'done' : 'failed');
    g.say('Carver', why === 'time' ? 'Wir haben gehalten, solange es ging. Jetzt raus – Westen, nach Oosterbeek! Verwundete in die Mitte, Rauch legen!' : 'Die Rampe ist nicht mehr zu halten! Ausbruch nach Westen, sofort!', 6);
    g.alert('Ausbruch nach Oosterbeek!', 5);
    const o = g.objectives.find((q) => q.id === 'break'); if (o) { o.hidden = false; g.emit('objectives'); }
    const m = g.objectives.find((q) => q.id === 'men'); if (m) { m.hidden = false; g.emit('objectives'); }
    g.markerTo('UA', OUT.x, OUT.z, 0x5db8ff, 60, OUT.r);
    g.addAbilityCharges('smoke', 2); g.addAbilityCharges('ww2_artillery', 1);
  },
  onKill(g, u) {
    if (u.side === 'RU' && u.type.vehicle && !u.type.air && !u.type.structure) {
      this.kills++; setText(g, 'armor', `Mindestens 6 gepanzerte Fahrzeuge zerstören (${Math.min(this.kills, 6)}/6)`); if (this.kills >= 6) g.setObjective('armor', 'done');
    }
  },
  update(g, dt) {
    if (g.ended) return;
    const t = g.time - this.t0;
    const mine = alive(g, 'UA', (u) => u.type.infantry);
    // Nachschubzone: Einheiten in der Zone werden aufgefüllt (einmal je Einheit und Abwurf)
    if (this.drop && this.drop.left > 0) {
      this.drop.left -= dt;
      const key = this.drop.t;
      for (const u of ground(g, 'UA', this.drop.x, this.drop.z, 14)) if (u.type.infantry && !u.tags.has('d' + key)) { u.tags.add('d' + key); refill([u], 0.55); }
    }
    if (!this.lowWarn && ammoLevel(g) < 0.25) { this.lowWarn = true; g.say('Carver', 'Munition fast verbraucht! Nur noch gezielt feuern – Bajonett und Granaten für den Rest.', 5); }
    if (this.phase === 'hold') {
      const ours = infIn(g, 'UA', BR.x, BR.z, BR.r).length, foes = ground(g, 'RU', BR.x, BR.z, 32).length;
      setText(g, 'hold', `Nordende der Brücke halten – Ablösung erwartet (${mmss(HOLD - t)})`);
      if (ours === 0 && foes >= 3) this.lostT += dt; else this.lostT = Math.max(0, this.lostT - dt * 0.5);
      if (this.lostT > 10) {
        if (t < MIN_T) { g.setObjective('hold', 'failed'); g.lose('Die Brücke fiel zu früh – die Verbindung nach Süden ist verloren, die Fallschirmjäger sind aufgerieben.'); return; }
        this.startBreakout(g, 'lost');
      } else if (t >= HOLD) this.startBreakout(g, 'time');
    }
    if (this.phase === 'break') {
      for (const u of mine) if (Math.hypot(u.pos.x - OUT.x, u.pos.z - OUT.z) < OUT.r) this.arrived.add(u.id);
      const n = this.arrived.size, left = BREAK_T - (g.time - this.tBreak);
      setText(g, 'break', `Ausbruch nach Oosterbeek: ${Math.min(n, NEED_OUT)}/${NEED_OUT} Mann im Sammelraum – ${mmss(left)}`);
      setText(g, 'men', `Mindestens 14 Mann kommen durch (${Math.min(n, 14)}/14)`);
      if (n >= NEED_OUT) {
        g.setObjective('break', 'done'); g.setObjective('men', n >= 14 ? 'done' : 'failed');
        if (g.objState('armor') === 'open') g.setObjective('armor', 'failed');
        g.say('Carver', 'Wir sind durch. Die Division hat jeden Mann gebraucht – und wir haben die Brücke so lange gehalten, wie es ging.', 6);
        g.win(`Der Ausbruch ist gelungen: ${n} Mann haben Oosterbeek erreicht. Die Brücke war nicht zu halten, aber die Division gewann Zeit.`); return;
      }
      const possible = n + mine.filter((u) => !this.arrived.has(u.id)).length;
      if (possible < NEED_OUT) { g.setObjective('break', 'failed'); g.lose('Zu viele Männer sind gefallen – der Ausbruch ist gescheitert.'); return; }
      if (left <= 0) { g.setObjective('break', 'failed'); g.lose('Der Ausbruch kam nicht rechtzeitig durch – die Deutschen haben den Ring geschlossen.'); }
    }
  },
  victory: 'Vier Tage hielten die Fallschirmjäger das Nordende der Brücke, länger als geplant. Das Panzerkorps erreichte sie nicht mehr – die Operation endete ohne den Rheinübergang.',
});
mission.markers = [
  { x: BR.x, z: BR.z, r: 20, label: 'Nordende der Rheinbrücke', color: '#5db8ff' },
  { x: OUT.x, z: OUT.z, r: 18, label: 'Oosterbeek (Sammelraum)', color: '#ffe9a8' },
];
export default mission;
