// Kampagne „WK2 – Rote Armee“, Mission 1 – Festung Brest (Juni 1941): Zitadelle halten, dann Ausbruch aus dem Kessel.
import { PLACE_BY_ID, placeMission } from '../../maps/places/index.js';
import { S, E, wave, ours, foes, capture, ourCount } from './_common.js';

const HOLD = 420;            // Sekunden bis zum Ausbruchsbefehl
const EXIT = [205, 128];     // Sammelpunkt jenseits des Cholmer Tors (Straße nach Osten)
const LIMIT = 1300;

export default placeMission(PLACE_BY_ID.brest, {
  structures: false, markers: false,
  id: 'sw1', era: 'ww2', difficulty: 1, fictional: false,
  title: 'Festung Brest',
  place: 'Brest-Litowsk · Zitadelle (angelehnt an die Festung Brest)',
  date: 'Juni 1941',
  summary: 'Überfall im Morgengrauen: Die Zitadelle halten, so lange es geht – und dann aus dem Kessel ausbrechen.',
  briefing: [
    { s: 'Hauptmann Wolkow', t: 'Vor Sonnenaufgang Artilleriefeuer auf die ganze Anlage. Kein Befehl von oben, die Verbindung ist tot. Wir sind die Garnison der Zitadelle, und der Gegner steht schon an den Toren.' },
    { s: 'Leutnant Maslowa (Sanitätsdienst)', t: 'In den Kellern der Kasematten sind auch die Familien der Soldaten. Haltet den Ring, jede Stunde zählt für sie – und für die Verwundeten, die wir nicht wegbringen können.' },
    { s: 'Hauptmann Wolkow', t: 'Wir halten, solange der Ring hält. Wenn der Gegner die Tore aufbricht, bleibt nur ein Weg: nach Osten über das Cholmer Tor, hinter den Muchawez, in die Wälder. Nicht alle werden es schaffen.' },
  ],
  objectivesPreview: ['Die Zitadelle gegen die Angriffe halten', 'Ausbruch: mindestens 5 Soldaten jenseits des Cholmer Tors sammeln', 'Optional: Beide Sanitäter überleben'],
  forces: ['14× Schützen', '3× DP-28', '2× PPSch', '2× Panzerbüchse PTRD', '2× 82-mm-Granatwerfer', '2× ZiS-3 (76 mm)', '1× BA-64', '1× Offizier', '2× Sanitäter'],
  weather: { type: 'fog', intensity: 0.5, changes: [{ at: 240, type: 'clear', intensity: 0, fade: 90 }] },
  env: { season: 'summer', sunElev: 8, sunAzim: 70, fogDensity: 0.004 },
  time: { start: '03:50', speed: 5 },
  camera: { x: 0, z: -4, dist: 120 },
  abilities: [],

  setup(g) {
    this.t = 0; this.phase = 'hold'; this.medsLost = 0;
    this.markers = [
      { x: 0, z: -10, r: 40, label: 'Zitadelle', color: '#5db8ff' },
      { x: EXIT[0], z: EXIT[1], r: 36, label: 'Ausbruch', color: '#7be07b', hidden: true },
    ];
    this.exitMarker = this.markers[1];
    // Eigene Garnison im Hof und an den Kasematten
    g.spawnGroup([[S.rifle, 8], [S.dp, 2]], 'UA', -52, -18, { spacing: 3, cols: 5, tags: ['inf'] });
    g.spawnGroup([[S.rifle, 6], [S.smg, 2], [S.dp, 1]], 'UA', 52, -12, { spacing: 3, cols: 5, tags: ['inf'] });
    g.spawnGroup([[S.at, 2], [S.mortar, 2], [S.off, 1]], 'UA', 0, 6, { spacing: 4, cols: 5, tags: ['inf'] });
    g.spawn(S.med, 'UA', -6, -10, { tags: ['med'] }); g.spawn(S.med, 'UA', 8, -4, { tags: ['med'] });
    g.spawn(S.zis3, 'UA', -88, -34, { heading: -Math.PI / 2 }); g.spawn(S.zis3, 'UA', 4, -56, { heading: Math.PI });
    g.spawn(S.ba64, 'UA', 30, -4);
    // Gegner: Ausbruchsriegel im Osten (steht von Anfang an, greift nicht an)
    g.spawn(E.mgnest, 'RU', 196, 112, { heading: -2.2 });
    g.spawnGroup([[E.rifle, 5], [E.mg, 1]], 'RU', 182, 108, { spacing: 4, cols: 5, ai: { mode: 'guard', radius: 24 }, tags: ['exit'] });
    g.spawn(E.pak, 'RU', 222, 126, { heading: -2.4, ai: { mode: 'guard', radius: 20 }, tags: ['exit'] });

    g.addObjective('hold', 'Die Zitadelle halten, bis der Ausbruch möglich ist');
    g.addObjective('breakout', 'Ausbruch: 5 Soldaten jenseits des Cholmer Tors sammeln');
    g.addObjective('med', 'Beide Sanitäter überleben', { optional: true });

    g.later(3, () => g.say('Wolkow', 'Sie kommen über die Brücke am Brester Tor! Alle auf die Posten – Feuer erst auf kurze Distanz.', 6));
    // Angriffswellen (Wehrmacht-Typen, Verstärkung wächst)
    g.later(25, () => wave(g, 'RU', [[E.rifle, 8], [E.mg, 2]], 0, -178, [[0, -96], [0, -38]], { tags: ['w'] }));
    g.later(110, () => { g.alert('Angriff von Westen – Terespoler Tor!', 4); wave(g, 'RU', [[E.rifle, 8], [E.smg, 2], [E.at, 1]], -196, -70, [[-128, -44], [-60, -16]], { tags: ['w'] }); });
    g.later(205, () => { g.say('Wolkow', 'Sturmgeschütze am Brester Tor! Panzerbüchsen nach vorn!', 5); wave(g, 'RU', [[E.stug, 2], [E.rifle, 8], [E.mg, 1]], 6, -190, [[0, -96], [0, -34]], { tags: ['w'] }); });
    g.later(300, () => { wave(g, 'RU', [[E.rifle, 10], [E.mg, 2], [E.smg, 3]], 190, 40, [[112, 34], [40, 4]], { tags: ['w'] }); wave(g, 'RU', [[E.pz4, 1], [E.rifle, 6]], -190, -90, [[-128, -44], [-50, -14]], { tags: ['w'] }); });
    g.every(45, () => { if (g.ended || this.phase !== 'hold') return false; g.combat.incomingShell(-40 + Math.random() * 80, -40 + Math.random() * 50, { name: 'Granate', dmg: 90, splash: 6, vs: { soft: 1, light: 0.8, heavy: 0.3, air: 0, struct: 0.3 } }, 'RU', 4, null, 1.2, null); }, 60);
  },

  onKill(g, u) {
    if (u.tags?.has('med')) { this.medsLost++; g.setObjective('med', 'failed'); }
  },

  update(g, dt) {
    this.t += dt;
    if (this.phase === 'hold' && this.t >= HOLD) {
      this.phase = 'breakout';
      g.setObjective('hold', 'done');
      this.exitMarker.hidden = false;
      g.say('Wolkow', 'Der Ring bricht an mehreren Stellen. Ausbruch nach Osten – über das Cholmer Tor, dann die Straße entlang. Wer verwundet ist, nimmt die Sanitäter mit.', 7);
      g.alert('Ausbruch nach Osten!', 4);
      g.later(30, () => g.say('Maslowa', 'Die Familien bleiben in den Kellern, bis es ruhiger wird. Geht – lebt, damit jemand erzählen kann, was hier war.', 7));
    }
    if (this.phase === 'breakout' && !g.ended) {
      // Ausbruch gelungen: genug Soldaten im Sammelpunkt und die Sperre ist durchbrochen
      if (capture(this, g, dt, 'exit', { x: EXIT[0], z: EXIT[1], r: 38, need: 5, secs: 4, allow: 2, enemyR: 44 })) {
        g.setObjective('breakout', 'done');
        if (g.objState('med') === 'open') g.setObjective('med', 'done');
        g.win('Ein Teil der Garnison hat den Ring durchbrochen. Die Zitadelle fällt erst Wochen später – viele bleiben zurück, Soldaten wie Zivilisten. Brest wird in der sowjetischen Erinnerung zum Sinnbild eines Anfangs, in dem alles verloren schien.');
      }
    }
    if (g.ended) return;
    if (this.phase === 'hold' && ourCount(g) < 3) { g.setObjective('hold', 'failed'); g.lose('Die Garnison ist aufgerieben. Die Zitadelle ist verloren.'); }
    else if (this.t > LIMIT) g.lose('Der Ausbruch kam zu spät: Der Kessel hat sich geschlossen.');
  },
  victory: 'Der Ausbruch aus der Zitadelle gelang nur wenigen. Wer zurückblieb, hielt noch Wochen aus. Die Opfer – Soldaten und Zivilisten – sind in Brest bis heute gegenwärtig.',
});
