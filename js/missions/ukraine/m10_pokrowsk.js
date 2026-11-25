// Mission 10 – Pokrowsk, Herbst 2025: Logistikstraße gegen Infiltrationstrupps und Drohnenschwärme halten (Glasfaser-FPV,
// EloKa, Abfangdrohnen). Ortsvorlage Pokrowsk, Rasputiza und Morgennebel.
import { placeMap, wave, near, ground, living, objCount, housesNear, garrisonNow } from './_util.js';

const HQ = [4, 50];                 // Umschlagpunkt an der E 50 (Stützpunkt)
const ROUTE = [[-118, -200], [-112, -80], [-104, 40], [-60, 52], [HQ[0], HQ[1]]];
const START = [-120, -262];
const NEED = 8, MAXLOST = 6, TOTAL = 14;

export default {
  id: 'ua10_pokrowsk',
  title: 'Die Straße',
  place: 'Pokrowsk',
  date: 'November 2025',
  era: 'modern',
  difficulty: 3,
  summary: 'Pokrowsk im Herbstschlamm: die letzte Nachschubstraße offen halten – gegen Infiltrationstrupps, Drohnenschwärme und versteckte Glasfaser-Piloten. Störsender, Abfangdrohnen und eigene Glasfaser-FPV sind die Antwort.',
  briefing: [
    { s: 'Oberst Koval', t: 'Pokrowsk, Herbst 2025. Der Gegner sickert in kleinen Trupps in die Stadt ein, zu zweit, zu dritt. Über der einzigen Straße kreisen seine Drohnen. Jede Fahrt mit Nachschub ist ein Wagnis.' },
    { s: 'Hauptfeldwebel Olena Kravets (Drohnenabwehr)', t: 'Die Straße kommt von Norden über die H 32 und biegt an der E 50 nach Osten zu unserem Stützpunkt ab. Wir müssen acht Fahrten durchbringen – Lastwagen und Logistik-Roboter. Funkgesteuerte Drohnen holen Störsender und Abfangtrupp herunter. Gegen Glasfaser-Drohnen hilft das nicht: die müssen wir abschießen – oder ihre Piloten finden.' },
    { s: 'Sova (Aufklärung)', t: 'Drei feindliche Drohnenteams verstecken sich in Häusern im Süden. Solange sie arbeiten, kommen Schwärme. Unsere Glasfaser-Operatoren reichen 55 Meter weit – mit Deckung heranführen.' },
    { s: 'Kravets', t: 'Schlamm überall: abseits der Straße kommen Räder kaum voran. Und der Nebel am Morgen hilft beiden Seiten.' },
  ],
  objectivesPreview: [`${NEED} Nachschubfahrten zum Stützpunkt bringen`, 'Gefechtsstand darf nicht fallen', `Nicht mehr als ${MAXLOST - 1} Fahrzeuge verlieren`, 'Optional: drei feindliche Drohnenteams ausschalten'],
  forces: ['Gefechtsstand', '6× Schützen, 2× MG, 1× Javelin, 1× Scharfschütze', '2× Drohnenabwehr-Trupp, 1× Abfangdrohnen-Trupp, 1× Skynex', '2× Glasfaser-FPV-Operator, 1× Drohnenpilot', '2× UGV Themis (MG)', 'EloKa-Störsender, Glasfaser-FPV, FPV, Artillerie, Aufklärung'],
  map: placeMap('pokrowsk', { season: 'autumn', palette: 'mud' }),
  env: { season: 'autumn', sunElev: 10, sunAzim: 140, fogDensity: 0.0036 },
  weather: { type: 'fog', intensity: 0.4, changes: [{ at: 200, type: 'rasputiza', intensity: 0.7, fade: 90 }] },
  time: { start: '06:40', speed: 6 },
  camera: { x: -50, z: 50, dist: 130, yaw: 0 },
  abilities: ['scan', { id: 'ew', charges: 6 }, { id: 'm_fiberfpv', charges: 6 }, { id: 'fpv', charges: 3 }, { id: 'artillery', charges: 3 }],
  friendlyEdge: [-120, -330],
  noDefaultDefeat: true,

  setup(g) {
    this.delivered = 0; this.lost = 0; this.sent = 0; this.teams = 0;
    this.markers = [
      { x: HQ[0], z: HQ[1], r: 16, label: 'Stützpunkt', color: '#5db8ff' },
      { x: START[0], z: START[1] + 20, r: 14, label: 'Nachschub (H 32)', color: '#5db8ff' },
      { x: -104, z: 44, r: 20, label: 'Kreuzung', color: '#ffd500' },
    ];
    this.hq = g.spawn('hq', 'UA', HQ[0] + 8, HQ[1] - 22, { tags: ['hq'] });
    g.spawnGroup([['rifle', 3], ['mg', 1], ['javelin', 1]], 'UA', -96, 58, { spacing: 3 });
    g.spawnGroup([['rifle', 3], ['mg', 1], ['sniper', 1]], 'UA', -30, 64, { spacing: 3 });
    g.spawnGroup([['m_dronehunter', 2], ['m_fibreop', 1]], 'UA', -78, 40, { spacing: 3 });
    g.spawnGroup([['m_fibreop', 1], ['dronepilot', 1]], 'UA', 10, 64, { spacing: 3 });
    g.spawn('m_interceptor', 'UA', -40, 40);
    g.spawn('m_skynex', 'UA', 26, 40);
    g.spawn('m_ugv_mg', 'UA', -110, 70); g.spawn('m_ugv_mg', 'UA', 2, 90);

    // Feindliche Drohnenteams versteckt im Süden (in Häusern)
    [[-40, 186], [96, 172], [170, 210]].forEach(([x, z], i) => {
      const team = g.spawnGroup([['m_rubikon', 2]], 'RU', x, z, { spacing: 2, tags: ['dteam', 'dt' + i] });
      const h = housesNear(g, x, z, 40)[0];
      if (h) garrisonNow(g, team, h);
      else team.forEach((u) => { u.ai = { mode: 'guard', radius: 12 }; });
    });
    g.spawnGroup([['m_storm', 3], ['e_mg', 1]], 'RU', 60, 220, { spacing: 4, ai: { mode: 'guard', radius: 30 } });
    g.spawn('m_zala', 'RU', 0, 220, { ai: { mode: 'loiter', center: [-60, 40], radius: 90 } });

    g.addObjective('deliver', `Nachschubfahrten zum Stützpunkt bringen (0/${NEED})`);
    g.addObjective('hq', 'Gefechtsstand darf nicht fallen');
    g.addObjective('lost', `Nicht mehr als ${MAXLOST - 1} Fahrzeuge verlieren (0)`);
    g.addObjective('dteam', 'Feindliche Drohnenteams ausschalten (0/3)', { optional: true });
    g.later(2, () => g.say('Kravets', 'Erste Fahrt rollt in zwanzig Sekunden. Störsender (F-Taste) erst einsetzen, wenn Funkdrohnen über der Straße sind.', 6));
    g.later(12, () => g.say('Sova', 'Infiltrationstrupps nutzen den Nebel. Achtet auf die Kreuzung H 32 / E 50.', 5));
    // Nachschub
    g.every(40, () => { if (g.ended || this.sent >= TOTAL) return false; this.convoy(g); }, 20);
    // Infiltration und Schwärme
    const T = (s, fn) => g.later(s, () => { if (!g.ended) fn(); });
    const inf = [[-230, 250, [[-150, 120], [-104, 46]]], [210, 250, [[60, 120], [0, 54]]], [-265, 170, [[-180, 90], [-110, 52]]], [120, 260, [[40, 140], [-60, 54]]]];
    [35, 90, 140, 190, 240, 290, 340, 390, 440, 500].forEach((s, k) => T(s, () => {
      const [x, z, pts] = inf[k % inf.length];
      wave(g, [['m_storm', 2 + (k > 4 ? 1 : 0)]], x, z, pts, { spacing: 3 });
      if (k === 5 || k === 8) g.spawnGroup([['m_moto', 3]], 'RU', x, z, { spacing: 4, ai: { mode: 'attackMove', points: pts, aggressive: true, after: 'guard' } });
    }));
    g.every(50, () => {
      if (g.ended) return false;
      const n = 2 + this.teams;
      for (let i = 0; i < n; i++) g.spawn('m_molniya', 'RU', -150 + i * 80, 255, { ai: { mode: 'hunt', huntRadius: 420, targetTag: 'supply', points: [[-104, 40], [-110, -60]] } });
      g.alert(`⚠ Molniya-Schwarm (${n}) aus dem Süden!`, 2.5);
    }, 60);
    g.every(110, () => {
      if (g.ended) return false;
      g.spawn('lancet', 'RU', 200, 250, { ai: { mode: 'hunt', huntRadius: 460, points: [[-100, 0]] } });
    }, 150);
  },
  convoy(g) {
    const k = this.sent++;
    const type = k % 2 ? 'm_ugv_log' : 'ua_truck';
    const v = g.spawn(type, 'UA', START[0], START[1], { heading: 0, tags: ['supply'], ai: { mode: 'convoy', points: ROUTE.map((p) => [...p]), after: 'guard' } });
    if (k === 0) g.say('Kravets', 'Erste Fahrt ist unterwegs. Haltet die Straße frei!', 4);
    return v;
  },
  onKill(g, u) {
    if (u.tags.has('supply')) { this.lost++; g.alert('✖ Nachschubfahrzeug verloren!', 2.5); }
  },
  update(g) {
    if (g.ended) return;
    // KVN-Glasfaser-Drohnen der versteckten Teams auf nahe Ziele
    this.kT = (this.kT || 0) + 1;
    const teams = living(g, 'RU', (u) => u.tags.has('dteam'));
    this.teams = [0, 1, 2].filter((i) => teams.some((u) => u.tags.has('dt' + i))).length;
    if (this.kT % 500 === 0) {
      for (const op of teams) {
        if (!op.alive || op._k > g.time) continue;
        const tg = g.units.filter((u) => u.alive && u.side === 'UA' && !u.type.air && !u.type.structure && Math.hypot(u.pos.x - op.pos.x, u.pos.z - op.pos.z) < 70)[0];
        if (!tg) continue;
        op._k = g.time + 30;
        for (let i = 0; i < 2; i++) g.later(i * 0.5, () => { const dd = g.spawn('m_kvn', 'RU', op.pos.x, op.pos.z, { startAlt: 1 }); if (tg.alive) dd.attack(tg); else dd.moveTo(tg.pos.x, tg.pos.z, { attackMove: true }); });
      }
    }
    const killed = 3 - this.teams;
    objCount(g, 'dteam', 'Feindliche Drohnenteams ausschalten', killed, 3);
    if (killed >= 3 && g.objState('dteam') === 'open') { g.setObjective('dteam', 'done'); g.say('Sova', 'Die Drohnenteams sind ausgeschaltet. Die Schwärme werden kleiner.', 5); }
    // Ankunft am Stützpunkt
    for (const v of [...g.units]) {
      if (!v.alive || !v.tags.has('supply') || Math.hypot(v.pos.x - HQ[0], v.pos.z - HQ[1]) > 18) continue;
      this.delivered++; v.tags.delete('supply'); g.removeUnit(v); if (v.root) v.root.visible = false;
      g.say('Kravets', `Fahrt ${this.delivered} ist durch.`, 2.5);
    }
    objCount(g, 'deliver', 'Nachschubfahrten zum Stützpunkt bringen', this.delivered, NEED);
    const lo = g.objectives.find((o) => o.id === 'lost');
    if (lo && lo.text !== `Nicht mehr als ${MAXLOST - 1} Fahrzeuge verlieren (${this.lost})`) { lo.text = `Nicht mehr als ${MAXLOST - 1} Fahrzeuge verlieren (${this.lost})`; g.emit('objectives'); }
    if (this.delivered >= NEED) {
      g.setObjective('deliver', 'done'); g.setObjective('hq', 'done'); g.setObjective('lost', 'done');
      if (g.objState('dteam') === 'open') g.setObjective('dteam', 'failed');
      g.win('Acht Fahrten sind durch. Die Verteidiger von Pokrowsk haben Munition, Wasser und Batterien für die nächsten Tage.');
      return;
    }
    if (!this.hq.alive) { g.setObjective('hq', 'failed'); g.lose('Der Gefechtsstand ist zerstört.'); return; }
    if (this.lost >= MAXLOST || this.sent >= TOTAL && this.delivered + living(g, 'UA', (u) => u.tags.has('supply')).length < NEED) { g.setObjective('lost', 'failed'); g.lose('Zu viele Fahrzeuge verloren – die Straße ist abgeschnitten.'); return; }
    if (!living(g, 'UA', (u) => ground(u) && !u.tags.has('supply')).length) g.lose('Niemand hält die Straße mehr.');
  },
  victory: 'Die Straße nach Pokrowsk war in diesem Herbst ein Korridor aus Schlamm, Netzen und ausgebrannten Fahrzeugen. Fahrer, Pioniere und Drohnenabwehr hielten sie Tag für Tag offen – viele von ihnen um einen hohen Preis.',
};
