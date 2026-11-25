// A5 – Carentan (Juni 1944): Häuserkampf in der Stadt und Bocage. Fallschirmjäger nehmen die Stadt und halten gegen den
// Gegenangriff mit Sturmgeschützen, bis die Panzerunterstützung eintrifft.
import { placeMission, PLACE_BY_ID } from '../../maps/places/index.js';
import { us, setText, mmss, alive, fort } from './_h.js';

const PLACE = PLACE_BY_ID.carentan;
const ZONES = [                                       // Stadtziele
  { id: 'markt', name: 'Marktplatz', x: 70, z: 30, r: 34 },
  { id: 'bahnhof', name: 'Bahnhof', x: 85, z: 107, r: 30 },
  { id: 'hafen', name: 'Hafenviertel', x: 118, z: -14, r: 30 },
];
const RELIEF = 330;                                   // s nach Einnahme: Panzerunterstützung trifft ein
const LIMIT = 1380;                                   // s Zeitlimit insgesamt

const mission = placeMission(PLACE, {
  id: 'a5', title: 'Carentan – Häuserkampf im Bocage', place: 'Carentan, Normandie · angelehnt an Carentan', date: '12./13. Juni 1944',
  era: 'ww2', difficulty: 3, structures: false, markers: false,
  summary: 'Fallschirmjäger erobern Carentan Haus um Haus und halten die Stadt gegen den Gegenangriff mit Sturmgeschützen, bis Panzerunterstützung eintrifft.',
  map: { ...PLACE.map, terrainStyle: 'bocage' },
  briefing: [
    { s: 'Lieutenant Colonel Ewell', t: 'Carentan verbindet die beiden Brückenköpfe. Wir sind über die Dammstraße vorgedrungen, jetzt müssen wir die Stadt nehmen. Die Verteidiger sind Fallschirmjäger der Wehrmacht – zäh, und sie kennen jedes Haus.' },
    { s: 'Lieutenant Colonel Ewell', t: 'Marktplatz, Bahnhof und Hafenviertel. Räumt die Häuser mit Granaten und MPs, setzt Bazookas gegen Fahrzeuge ein. Wenn wir die Stadt haben, kommt der Gegenangriff aus den Hecken im Südwesten – mit Sturmgeschützen.' },
    { s: 'Sergeant Doyle', t: 'Die Panzer sind unterwegs, aber nicht vor Ablauf einiger Minuten da. Bis dahin: Bazooka in die Obergeschosse, MGs in die Fenster, und niemand verlässt den Platz.' },
  ],
  objectivesPreview: ['Marktplatz, Bahnhof und Hafenviertel einnehmen', 'Stadt halten, bis die Panzerunterstützung eintrifft und den Gegenangriff bricht', 'Optional: Mindestens 2 Sturmgeschütze zerstören', 'Optional: Bahnhof bis zum Ende halten', 'Zeitlimit: 23 Minuten'],
  forces: ['14× Fallschirmjäger', '8× Rifleman', '4× Thompson-Schütze', '2× BAR-Schütze', '3× Bazooka-Team', '2× Pionier', '1× Offizier', '1× Sanitäter', '1× Mörsertrupp', 'Verstärkung: 4× Sherman, 1× M10', 'Fähigkeiten: Artillerie, Nebel, Jabo-Angriff'],
  weather: { type: 'overcast', intensity: 0.3 }, time: { start: '07:00', speed: 3 },
  camera: { x: -20, z: -30, dist: 120 },
  abilities: [{ id: 'ww2_artillery', charges: 3 }, { id: 'smoke', charges: 3 }, { id: 'ww2_airstrike_us', charges: 2 }],

  setup(g) {
    this.t0 = g.time; this.captured = new Set(); this.capT = {}; this.tCap = null; this.relief = false; this.stugs = 0; this.fell = 0;
    for (const z of ZONES) this.capT[z.id] = 0;
    // Eigene Truppen am Ende des Damms
    g.spawnGroup([[us.para, 14], [us.smg, 4]], 'UA', -40, -36, { spacing: 3.3, cols: 5, heading: -2.2 });
    g.spawnGroup([[us.rifle, 8], [us.lmg, 2], [us.at, 3]], 'UA', -22, -22, { spacing: 3.3, cols: 5, heading: -2.2 });
    g.spawnGroup([[us.engineer, 2], [us.officer, 1], [us.medic, 1], [us.mortar, 1]], 'UA', -52, -46, { spacing: 3.6, cols: 3, heading: -2.2 });
    // Verteidiger in den Häusern und Gassen (Fallschirmjäger der Wehrmacht)
    g.spawnGroup([['ww2_de_fj', 3], ['ww2_de_mg42', 1]], 'RU', 70, 26, { spacing: 3.4, cols: 3, ai: { mode: 'guard', radius: 22 }, tags: ['town', 'markt'] });
    g.spawnGroup([['ww2_de_fj', 3], ['ww2_de_mp40', 1]], 'RU', 56, 6, { spacing: 3.4, cols: 4, ai: { mode: 'guard', radius: 24 }, tags: ['town', 'markt'] });
    g.spawnGroup([['ww2_de_fj', 3], ['ww2_de_mg42', 1]], 'RU', 85, 100, { spacing: 3.4, cols: 4, ai: { mode: 'guard', radius: 24 }, tags: ['town', 'bahnhof'] });
    g.spawnGroup([['ww2_de_fj', 3], ['ww2_de_mp40', 1]], 'RU', 118, -16, { spacing: 3.4, cols: 3, ai: { mode: 'guard', radius: 24 }, tags: ['town', 'hafen'] });
    fort(g, 'ww2_mgnest', 'RU', 40, 4, { heading: -2.4, tags: ['town', 'markt'] });
    fort(g, 'ww2_foxhole', 'RU', 30, -8, {}); fort(g, 'ww2_foxhole', 'RU', 28, -2, {});
    g.addObjective('town', 'Carentan einnehmen: Marktplatz, Bahnhof, Hafenviertel (0/3)');
    g.addObjective('hold', 'Stadt halten, bis die Panzerunterstützung eintrifft');
    g.addObjective('stugs', 'Mindestens 2 Sturmgeschütze zerstören (0/2)', { optional: true });
    g.addObjective('station', 'Bahnhof bis zum Ende halten', { optional: true });
    g.later(2, () => g.say('Ewell', 'Vorwärts in die Stadt! Marktplatz zuerst – dort sitzt ihr Kern.', 5));
    g.later(14, () => g.say('Doyle', 'Häuser sind Festungen: Granaten durch die Fenster, dann rein. Bazookas gegen alles, was Ketten hat.', 6));
  },
  startCounter(g) {
    this.tCap = g.time;
    g.say('Ewell', 'Wir haben die Stadt! Jetzt kommt der Gegenangriff aus dem Südwesten – Stellungen beziehen!', 6);
    g.setObjective('town', 'done');
    const go = (delay, list, from, pts, msg) => g.later(delay, () => {
      if (g.ended) return; g.alert(msg, 4);
      g.spawnGroup(list, 'RU', from[0], from[1], { spacing: 6, cols: 5, ai: { mode: 'attackMove', points: pts, aggressive: true, aggroRadius: 50, after: 'guard' }, tags: ['counter'] });
    });
    go(40, [['ww2_stug3', 2], ['ww2_de_rifle', 6], ['ww2_de_mg42', 1]], [-60, 250], [[-20, 190], [20, 100], [62, 40]], '⚠ Gegenangriff aus dem Südwesten!');
    go(140, [['ww2_stug3', 1], ['ww2_pz4', 1], ['ww2_de_rifle', 6], ['ww2_de_mp40', 2]], [-10, 262], [[30, 200], [70, 120], [78, 50]], '⚠ Zweite Welle mit Sturmgeschützen!');
    go(RELIEF - 20, [['ww2_stug3', 2], ['ww2_de_rifle', 8], ['ww2_de_mg42', 2]], [150, 150], [[120, 120], [100, 60], [75, 34]], '⚠ Angriff von Osten über die Bahnlinie!');
    g.later(RELIEF, () => {
      this.relief = true;
      g.say('Doyle', 'Panzer! Die Shermans rollen von Westen in die Stadt ein!', 5); g.alert('Panzerunterstützung ist eingetroffen', 4);
      g.spawnGroup([['ww2_sherman', 4], ['ww2_m10', 1]], 'UA', -255, 62, { spacing: 9, cols: 3, heading: Math.PI / 2, ai: { mode: 'attackMove', points: [[-100, 50], [30, 36]], after: 'guard' }, tags: ['relief'] });
    });
  },
  onKill(g, u) {
    if (u.side === 'RU' && u.type.key === 'ww2_stug3') { this.stugs++; setText(g, 'stugs', `Mindestens 2 Sturmgeschütze zerstören (${Math.min(this.stugs, 2)}/2)`); if (this.stugs >= 2) g.setObjective('stugs', 'done'); }
  },
  update(g, dt) {
    if (g.ended) return;
    const t = g.time - this.t0;
    // Zonen einnehmen / verlieren
    let held = 0;
    for (const z of ZONES) {
      const foes = g.unitsInArea(z.x, z.z, z.r, 'RU').filter((u) => !u.type.structure && !u.type.air).length;
      const ours = g.unitsInArea(z.x, z.z, z.r, 'UA').filter((u) => !u.type.structure && !u.type.air).length;
      if (!this.captured.has(z.id)) {
        if (ours >= 2 && foes === 0) { this.capT[z.id] += dt; if (this.capT[z.id] > 4) { this.captured.add(z.id); g.say('Ewell', `${z.name} ist in unserer Hand!`, 4); } } else this.capT[z.id] = 0;
      } else if (this.tCap !== null && foes >= 3 && ours === 0) {
        this.capT[z.id] += dt; if (this.capT[z.id] > 10) { this.captured.delete(z.id); this.capT[z.id] = 0; g.alert(`${z.name} verloren!`, 3); }
      } else this.capT[z.id] = 0;
      if (this.captured.has(z.id)) held++;
    }
    if (this.tCap === null) {
      setText(g, 'town', `Carentan einnehmen: Marktplatz, Bahnhof, Hafenviertel (${held}/3) – ${mmss(LIMIT - t)}`);
      if (held >= 3) this.startCounter(g);
    } else {
      const left = RELIEF - (g.time - this.tCap);
      setText(g, 'hold', left > 0 ? `Stadt halten – Panzerunterstützung in ${mmss(left)}` : 'Stadt halten, bis der Gegenangriff gebrochen ist');
      if (held < 2 && (g.time - this.tCap) > 20) { this.lostT = (this.lostT || 0) + dt; if (this.lostT > 12) { g.setObjective('hold', 'failed'); g.lose('Carentan ist wieder verloren – der Gegenangriff hat die Stadt zurückerobert.'); return; } } else this.lostT = 0;
      if (this.relief && g.time - this.tCap > RELIEF + 40) {
        const remaining = alive(g, 'RU', (u) => u.tags.has('counter')).length;
        if (remaining <= 2) {
          g.setObjective('hold', 'done');
          if (g.objState('station') === 'open') g.setObjective('station', this.captured.has('bahnhof') ? 'done' : 'failed');
          g.say('Ewell', 'Der Gegenangriff ist gebrochen. Carentan gehört uns – die beiden Brückenköpfe sind verbunden.', 6);
          g.win('Carentan ist gehalten. Die Brückenköpfe Utah und Omaha sind nun verbunden.'); return;
        }
      }
    }
    if (t > LIMIT) { g.setObjective(this.tCap === null ? 'town' : 'hold', 'failed'); g.lose('Die Zeit ist abgelaufen – Carentan blieb nicht in unserer Hand.'); }
  },
  victory: 'Mit dem Fall von Carentan waren die beiden Landungsabschnitte verbunden. Der Brückenkopf in der Normandie stand auf einer durchgehenden Linie.',
});
mission.markers = ZONES.map((z) => ({ x: z.x, z: z.z, r: z.r, label: z.name, color: '#5db8ff' }));
export default mission;
