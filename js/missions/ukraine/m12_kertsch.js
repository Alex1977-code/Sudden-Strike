// Mission 12 – Finale „Die Brücke von Kertsch“, November 2026 (FIKTIV): kombinierte Operation – Langstreckenschläge und
// Spezialkräfte schalten die Flugabwehr aus, Seedrohnen räumen die Meerenge, Pioniere bringen Sprengladungen an der
// Straßenbrücke an (V3-M2 Brückensprengung, js/game/bridges.js; ohne Brückensystem skriptierter Ersatz). Ortsvorlage Kertsch.
import { FICTION_NOTE, placeMap, near, ground, living, autoUnload, objCount } from './_util.js';

const LZ = [-146, 46];          // Anlandestelle Krim-Seite südlich des Widerlagers
const SSO0 = [-214, 150];       // SSO an Land (Küste südlich der Stadt)
const ROAD_NAME = 'Krimbrücke (Straße)', RAIL_NAME = 'Krimbrücke (Bahn)';

export default {
  id: 'ua12_kertsch',
  title: 'Die Brücke von Kertsch',
  place: 'Straße von Kertsch (fiktives Szenario)',
  date: 'November 2026, 03:10 Uhr',
  era: 'modern',
  difficulty: 3,
  fictional: true,
  summary: 'Fiktives Finale: Langstreckenschläge, Spezialkräfte und Seedrohnen öffnen den Weg – dann bringen Pioniere Sprengladungen an der Krimbrücke an. Ein kombinierter Einsatz, bei dem jeder Teil gelingen muss.',
  briefing: [
    { s: 'Hinweis', t: 'FIKTIVES SZENARIO. ' + FICTION_NOTE + ' Die beschriebene Operation hat so nicht stattgefunden.' },
    { s: 'Oberst Koval', t: 'November 2026. Die Brücke über die Straße von Kertsch wurde schon zweimal getroffen und jedes Mal repariert. Heute Nacht soll ein Feld der Straßenbrücke fallen – nicht durch Raketen, die an den verstärkten Pfeilern abprallen, sondern durch Sprengladungen direkt an der Fahrbahn.' },
    { s: 'Sova (Aufklärung)', t: 'Zuerst muss die Flugabwehr weg: das S-400-Radar und die Werfer westlich der Brücke, zwei Panzir – eine am Widerlager, eine auf der Insel Tusla – und ein Tor-System an der Küste. Storm Shadow, Flamingo und Ljutyj-Drohnen kommen durch, wenn das Radar blind ist. Unsere SSO sind schon an Land.' },
    { s: 'Kapitän Marko Hrytsenko (Marine-Drohnen)', t: 'Zwei Patrouillenboote sichern die Meerenge. Die Seedrohnen räumen sie, bevor die Pionierboote kommen. Die Pioniere landen südlich des Widerlagers, steigen auf die Fahrbahn und gehen bis zum Mittelfeld.' },
    { s: 'Oberst Koval', t: 'Keine zivilen Ziele. Jeder, der heute Nacht hinausfährt, weiß, was er riskiert. Bringt so viele wie möglich zurück.' },
  ],
  objectivesPreview: ['Flugabwehr ausschalten: S-400-Radar, 2× Panzir, Tor', 'Pioniere an der Krim-Seite anlanden', 'Sprengladungen an der Straßenbrücke zünden', 'Optional: Eisenbahnbrücke ebenfalls sprengen', 'Optional: Beide Patrouillenboote versenken'],
  forces: ['6× Spezialkräfte (SSO), 2× Scharfschütze, 1× Stinger, 1× Aufklärungsdrohne', 'Später: 2× Sturmboot mit 4× Pionier und 6× SSO', 'Storm Shadow (4), Flamingo (2), Ljutyj-Drohnen (3), Seedrohnen (4), Aufklärung'],
  map: placeMap('kertsch', { season: 'autumn' }),
  env: { season: 'autumn', sunElev: 8, sunAzim: 110, fogDensity: 0.0024 },
  weather: { type: 'rain', intensity: 0.3, changes: [{ at: 420, type: 'overcast', intensity: 0.5, fade: 90 }] },
  time: { start: '03:10', speed: 8 },
  camera: { x: -170, z: 110, dist: 125, yaw: 0 },
  abilities: [{ id: 'stormshadow', charges: 4 }, { id: 'm_flamingo', charges: 2 }, { id: 'm_lyutyi', charges: 3 }, { id: 'seadrone', charges: 4 }, 'scan'],
  friendlyEdge: [60, 360],
  seaSpawn: [30, 270],
  noDefaultDefeat: true,

  setup(g) {
    this.aaKills = 0; this.boatKills = 0; this.engLanded = false; this.engSent = false; this.charged = 0;
    this.markers = [
      { x: -215, z: -70, r: 26, label: 'S-400', color: '#ff6b6b' },
      { x: LZ[0], z: LZ[1], r: 14, label: 'Anlandestelle', color: '#5db8ff' },
      { x: -75, z: 0, r: 22, label: 'Mittelfeld', color: '#ffd500' },
    ];
    // Brücke: verstärkte Pfeiler (Raketen allein reichen nicht), Zielfeld markieren
    this.road = g.bridges.find((b) => b.name === ROAD_NAME) || null;
    this.rail = g.bridges.find((b) => b.name === RAIL_NAME) || null;
    for (const b of [this.road, this.rail]) if (b) { b.maxHp = b.hp = 1e7; }
    if (this.road) { this.markers[2].x = this.road.cx; this.markers[2].z = this.road.cz; }
    else { // Ersatz ohne Brückensystem: Zielsegmente wie in Mission 5
      this.span = g.spawn('bridge_road', 'RU', -75, -7, { y: 9, tags: ['span'] });
      this.span.invulnerable = true;
    }
    for (let x = -150; x <= 220; x += 30) g.addReveal(x, 0, 22, 1.5);

    // Spieler: SSO an Land
    g.spawnGroup([['sso', 6], ['sniper', 2], ['stinger', 1]], 'UA', SSO0[0], SSO0[1], { spacing: 2.8, cols: 4, heading: Math.PI });
    g.spawn('recon', 'UA', SSO0[0] + 8, SSO0[1] + 6, { startAlt: 2 });
    // Flugabwehr
    g.spawn('s400radar', 'RU', -215, -62, { tags: ['aa', 'radar'] });
    g.spawn('s400', 'RU', -232, -80, { ai: { mode: 'hold' } });
    g.spawn('s400', 'RU', -198, -88, { ai: { mode: 'hold' } });
    g.spawn('pantsir', 'RU', -176, -34, { tags: ['aa'], ai: { mode: 'hold' } });
    g.spawn('pantsir', 'RU', 58, 28, { tags: ['aa'], ai: { mode: 'hold' } });
    g.spawn('m_tor', 'RU', -196, 34, { tags: ['aa'], ai: { mode: 'hold' } });
    // Wachen an Land und auf der Brücke
    g.spawnGroup([['e_rifle', 4], ['e_mg', 1]], 'RU', -214, -44, { spacing: 4, ai: { mode: 'guard', radius: 30 } });
    g.spawnGroup([['e_rifle', 3], ['e_rpg', 1]], 'RU', -184, 10, { spacing: 4, ai: { mode: 'guard', radius: 28 } });
    g.spawnGroup([['e_rifle', 3], ['e_mg', 1]], 'RU', -200, 80, { spacing: 3, ai: { mode: 'patrol', points: [[-200, 80], [-170, 50], [-190, 10], [-215, 60]] } });
    g.spawn('btr', 'RU', -186, -10, { ai: { mode: 'patrol', points: [[-186, -10], [-160, -7], [-200, -30]] } });
    g.spawnGroup([['e_rifle', 3]], 'RU', -128, -7, { spacing: 3, ai: { mode: 'guard', radius: 14 }, tags: ['deck'] });
    // Marine
    g.spawn('boat', 'RU', -60, 60, { tags: ['boat'], ai: { mode: 'patrol', points: [[-80, 60], [40, 70], [80, 140], [-60, 120]] } });
    g.spawn('boat', 'RU', 120, -60, { tags: ['boat'], ai: { mode: 'patrol', points: [[120, -60], [-40, -70], [-90, -130], [100, -130]] } });

    g.addObjective('aa', 'Flugabwehr ausschalten: S-400-Radar, 2× Panzir, Tor (0/4)');
    g.addObjective('land', 'Pioniere an der Krim-Seite anlanden');
    g.addObjective('road', 'Sprengladungen an der Straßenbrücke zünden');
    g.addObjective('rail', 'Eisenbahnbrücke ebenfalls sprengen', { optional: true });
    g.addObjective('boats', 'Beide Patrouillenboote versenken', { optional: true });
    g.setCountdown(1080, 'Morgendämmerung in', () => { if (!g.ended) { g.setObjective('road', 'failed'); g.lose('Die Dämmerung bricht an. Die Operation wird abgebrochen – die Brücke steht.'); } });
    g.later(2, () => g.say('Sova', 'SSO an Land. Leise nach Norden – das S-400-Radar steht westlich der Brücke. Fehlt das Radar, kommen unsere Marschflugkörper durch.', 7));
    g.later(10, () => g.say('Hrytsenko', 'Seedrohnen (F4) sind bereit für die Patrouillenboote.', 5));
    g.later(240, () => { if (!this.engSent && !g.ended) this.sendEngineers(g, true); });
    g.later(300, () => {
      if (g.ended) return;
      g.spawn('ka52', 'RU', 200, -200, { ai: { mode: 'patrol', points: [[60, 80], [-60, 140], [-150, 60], [-40, -40]] } });
      g.alert('⚠ Ka-52 über der Meerenge!', 3);
      g.say('Hrytsenko', 'Kampfhubschrauber! Er jagt die Boote – Stinger bereithalten.', 5);
    });
  },
  sendEngineers(g, early) {
    this.engSent = true;
    const cargo = [[['ua_engineer', 2], ['sso', 3]], [['ua_engineer', 2], ['sso', 3]]];
    this.engBoats = [g.spawn('ua_c1_boat', 'UA', -40, 262, { heading: Math.PI, tags: ['eboat'], cargo: cargo[0] }), g.spawn('ua_c1_boat', 'UA', -12, 266, { heading: Math.PI, tags: ['eboat'], cargo: cargo[1] })];
    g.say('Hrytsenko', early ? 'Die Zeit drängt – die Pionierboote laufen aus, auch wenn die Flugabwehr noch nicht ganz weg ist. Kurs Anlandestelle!' : 'Flugabwehr ist blind. Pionierboote laufen aus – Kurs Anlandestelle südlich des Widerlagers.', 6);
    g.alert('Pionierboote unterwegs – zur Anlandestelle steuern', 3);
  },
  onBridge(g, b) {
    if (g.ended) return;
    if ((b === this.road || b.name === ROAD_NAME) && g.objState('road') === 'open') {
      g.setObjective('road', 'done');
      g.say('Hrytsenko', 'Das Mittelfeld der Straßenbrücke ist eingestürzt!', 5);
      g.later(7, () => this.finish(g));
    }
    if ((b === this.rail || b.name === RAIL_NAME) && g.objState('rail') === 'open') { g.setObjective('rail', 'done'); g.say('Sova', 'Auch die Eisenbahnbrücke ist unterbrochen.', 4); }
  },
  finish(g) {
    if (g.ended) return;
    if (g.objState('rail') === 'open') g.setObjective('rail', 'failed');
    if (g.objState('boats') === 'open') g.setObjective('boats', 'failed');
    const back = living(g, 'UA', (u) => u.type.infantry).length;
    g.win(`Ein Feld der Straßenbrücke liegt in der Meerenge. ${back} Soldaten des Einsatzkommandos werden in der Morgendämmerung von den Booten aufgenommen.`);
  },
  onKill(g, u) {
    if (u.tags.has('aa')) {
      this.aaKills++;
      objCount(g, 'aa', 'Flugabwehr ausschalten: S-400-Radar, 2× Panzir, Tor', this.aaKills, 4);
      if (u.tags.has('radar')) g.say('Sova', 'S-400-Radar zerstört! Die Werfer sind blind.', 4);
      if (this.aaKills >= 4 && g.objState('aa') === 'open') { g.setObjective('aa', 'done'); if (!this.engSent) this.sendEngineers(g, false); }
    }
    if (u.tags.has('boat')) { this.boatKills++; if (this.boatKills >= 2) g.setObjective('boats', 'done'); }
    if (u.tags.has('eboat')) g.say('Hrytsenko', 'Ein Pionierboot ist getroffen!', 4);
  },
  engineers(g) {
    let n = 0;
    for (const u of g.unitMap.values()) if (u.alive && u.side === 'UA' && u.type.engineer) n++;
    return n;
  },
  update(g, dt) {
    if (g.ended) return;
    autoUnload(g, LZ, 26, () => {
      if (!this.engLanded) { this.engLanded = true; g.setObjective('land', 'done'); g.say('Pionier', 'An Land. Wir gehen über die Rampe auf die Fahrbahn – Befehl „Brücke sprengen“, Ziel Mittelfeld.', 6); }
    });
    // Brückenzustand (V3-M2): Einsturz des Mittelfelds
    for (const b of [this.road, this.rail]) if (b && b.state === 'destroyed') this.onBridge(g, b);
    if (!this.charged && g.units.some((u) => u.alive && u.side === 'UA' && u.bridgeJob?.kind === 'blow' && u.bridgeJob.phase === 'work')) { this.charged = 1; g.say('Pionier', 'Wir sind am Mittelfeld – Ladungen werden angebracht!', 4); }
    // Ersatz ohne Brückensystem: Pioniere 16 s am Mittelfeld
    if (this.span && this.span.alive) {
      const e = g.units.filter((u) => u.alive && u.side === 'UA' && u.type.engineer && Math.hypot(u.pos.x - (-96), u.pos.z - (-7)) < 12);
      this.spT = e.length ? (this.spT || 0) + dt : 0;
      if (this.spT > 16) { this.span.invulnerable = false; g.killUnit(this.span, null); this.onBridge(g, { name: ROAD_NAME }); }
    }
    if (this.engSent && g.objState('road') === 'open' && this.engineers(g) === 0) {
      g.setObjective('road', 'failed');
      g.lose('Kein Pionier hat die Brücke erreicht. Die Operation ist gescheitert.');
      return;
    }
    if (!living(g, 'UA', (u) => ground(u) || u.type.naval).length && !(this.engSent && this.engineers(g))) g.lose('Das Einsatzkommando ist aufgerieben.');
  },
  victory: 'Ein Feld der Brücke liegt im Wasser der Meerenge. Was in dieser Nacht gelang, gelang nur, weil Planer, Piloten, Drohnenführer, Spezialkräfte und Pioniere einander vertrauten. Nicht alle kamen zurück. Ihre Namen bleiben.\n\nEnde der Kampagne. Diese letzte Operation ist frei erfunden – der Krieg, den sie erzählt, ist es nicht.\n\n(Fiktives Szenario.)',
};
