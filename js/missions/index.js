// Kampagnen: Registry (campaigns.js) + Kampagne „Stahl und Sonnenblumen" (Ukraine) + Platzhalter der anderen Epochen.
// Neue Kampagnendateien registrieren sich selbst (registerCampaign) und werden hier nur importiert:
//   import './afghan_isaf/index.js';
import { registerCampaign } from './campaigns.js';
import m1 from './m1_kyiv.js';
import m2 from './m2_kharkiv.js';
import m3 from './m3_hypersonic.js';
import m4 from './m4_zaporizhzhia.js';
import m5 from './m5_crimea.js';
import './ww2_soviet/index.js';
import './ww2_allies/index.js';
import './ww2_axis/index.js';
import './ukraine/index.js';
import './tutorial/index.js';

// Ukraine-Missionen: Epoche, Schwierigkeit und Kurztext für die Missionsliste (Missionsdateien bleiben unverändert)
const UA_META = {
  m1: { difficulty: 1, summary: 'Hinterhalt auf eine Versorgungskolonne nördlich der Hauptstadt – Javelin-Teams, eine Aufklärungsdrohne und ein Dorf, das sich weigert zu fallen.' },
  m2: { difficulty: 2, summary: 'Gegenoffensive am Fluss: Orlan-Aufklärer vom Himmel holen, Artillerie und Munitionsdepot ausschalten und Sosnivka gegen den Gegenangriff halten.' },
  m3: { difficulty: 2, summary: 'Eine Nacht lang das Wärmekraftwerk am Dnipro schützen – Patriot, IRIS-T und Gepard gegen Drohnen, Marschflugkörper und Kinschal.' },
  m4: { difficulty: 3, summary: 'Durchbruch durch die gestaffelte Verteidigung: Batterie und Depot zerstören, dann Nowa Dolyna mit Leopard-Panzern einnehmen.' },
  m5: { difficulty: 3, summary: 'Kommandoeinsatz in der Straße von Kertsch: Radar und Panzir ausschalten, dann Straßen- und Eisenbahnbrücke mit Seedrohnen treffen.' },
};
for (const m of [m1, m2, m3, m4, m5]) { const x = UA_META[m.id] || {}; m.era ||= 'modern'; m.difficulty ||= x.difficulty; m.summary ||= x.summary; }

export const CAMPAIGN = [m1, m2, m3, m4, m5];

registerCampaign({ placeholder: true,
  id: 'tutorial', era: 'tutorial', faction: 'Ausbildung', order: 0,
  title: 'Tutorial – Grundausbildung', subtitle: 'Übungsgelände', years: '',
  desc: 'Auswählen, Bewegen, Deckung, Fahrzeuge und Unterstützungsfeuer – Schritt für Schritt auf dem Übungsplatz.',
  accent: '#8fb573', missions: [],
});
registerCampaign({
  id: 'ukraine', era: 'modern', faction: 'Ukraine', order: 10,
  title: 'Ukraine 2022–2026', subtitle: '„Stahl und Sonnenblumen"', years: '2022–2026',
  desc: 'Vom Hinterhalt vor Kyjiw bis zur Krimbrücke: Drohnen, Javelins und Flugabwehr gegen eine übermächtige Invasionsarmee.',
  accent: '#e9c34a', missions: CAMPAIGN,
  art: { sky: ['#1f3550', '#d9b15c'], sun: { x: 300, y: 140, r: 24, color: '#ffd98a' }, terrain: 'steppe', far: '#3a4552', ground: '#2c2a1c', ink: '#101318',
    sil: [['tank', 46, 190, 1.25], ['drone', 236, 58, 0.85, true], ['drone', 278, 80, 0.6, true], ['pylon', 340, 190, 1.7]] },
});
registerCampaign({ placeholder: true,
  id: 'afghan-isaf', era: 'afghan', faction: 'ISAF / Bundeswehr', order: 20,
  title: 'Afghanistan – ISAF', subtitle: 'Stabilisierungseinsatz', years: '2001–2014',
  desc: 'Patrouillen im Raum Kunduz, Hinterhalte an Bewässerungsgräben und im Gebirge – Schutz der Bevölkerung unter ständiger Bedrohung.',
  accent: '#c9a36a', missions: [],
  art: { sky: ['#30455c', '#e2bd85'], sun: { x: 84, y: 64, r: 18, color: '#fff1cc' }, terrain: 'mountains', far: '#8a7559', ground: '#4d3d2a', ink: '#1b150f',
    sil: [['heli', 230, 66, 1.4, true], ['truck', 52, 200, 1.15], ['soldier', 120, 204, 1.2]] },
});
registerCampaign({ placeholder: true,
  id: 'afghan-soviet', era: 'afghan', faction: 'Sowjetisch-Afghanischer Krieg', order: 30,
  title: 'Afghanistan – Sowjetkrieg', subtitle: 'Salang · Pandschir · Kandahar', years: '1979–1989',
  desc: 'Konvois über den Salang-Pass, Gefechte im Pandschir-Tal – ein zermürbender Krieg in unwegsamem Hochgebirge.',
  accent: '#c0704f', missions: [],
  art: { sky: ['#3a2f3a', '#d49a6a'], sun: { x: 320, y: 84, r: 22, color: '#ffd2a0' }, terrain: 'mountains', snow: true, far: '#6f5a52', ground: '#3a2b22', ink: '#170f0c',
    sil: [['heli', 120, 60, 1.2], ['heli', 200, 84, 0.8], ['truck', 260, 204, 1.0], ['truck', 318, 206, 1.0]] },
});
registerCampaign({ placeholder: true,
  id: 'ww2-allies', era: 'ww2', faction: 'Westalliierte', order: 40,
  title: 'WK2 – Westalliierte', subtitle: 'Dünkirchen · Normandie · Remagen', years: '1940–1945',
  desc: 'Von der Evakuierung bei Dünkirchen über die Landung in der Normandie bis zur Brücke von Remagen.',
  accent: '#7f9fc4', missions: [],
  art: { sky: ['#2a3340', '#a9a48c'], sun: { x: 330, y: 64, r: 16, color: '#f6ecd0' }, terrain: 'coast', ground: '#3a3a2c', ink: '#11151a',
    sil: [['plane', 70, 50, 1.1, true], ['plane', 120, 74, 0.8, true], ['tank_ww2', 250, 200, 1.3]] },
});
registerCampaign({ placeholder: true,
  id: 'ww2-soviet', era: 'ww2', faction: 'Rote Armee', order: 50,
  title: 'WK2 – Rote Armee', subtitle: 'Brest · Stalingrad · Berlin', years: '1941–1945',
  desc: 'Von der Festung Brest über Stalingrad und Prochorowka bis zu den Seelower Höhen und Berlin.',
  accent: '#c95a4e', missions: [],
  art: { sky: ['#28303a', '#b9b7ae'], sun: null, terrain: 'snow', far: '#59616a', ground: '#d6dade', ink: '#161a1e',
    sil: [['birch', 30, 186, 1.6], ['birch', 52, 190, 1.3], ['tank_ww2', 200, 202, 1.4], ['tank_ww2', 300, 198, 1.0], ['soldier', 150, 206, 1.1]] },
});
registerCampaign({ placeholder: true,
  id: 'ww2-axis', era: 'ww2', faction: 'Deutsche Seite', order: 60,
  title: 'WK2 – Deutsche Seite', subtitle: 'Eben-Emael · Tobruk · Königsberg', years: '1940–1945',
  desc: 'Eben-Emael, der Wüstenkrieg um Tobruk und El Alamein, Rückzugskämpfe bis Königsberg – nüchtern, ohne Verklärung.',
  accent: '#9aa08a', missions: [],
  art: { sky: ['#2d2f2b', '#c2ad7e'], sun: { x: 90, y: 78, r: 20, color: '#f8e2b0' }, terrain: 'desert', far: '#8a7a58', ground: '#5a4a32', ink: '#17140e',
    sil: [['tank_ww2', 230, 196, 1.35, true], ['truck', 70, 200, 1.0], ['plane', 300, 56, 0.9, true]] },
});

// Hintergrund-Gefecht für das Titelmenü
export const DEMO = {
  id: 'demo',
  map: { ...m4.map, features: m4.map.features },
  env: { season: 'summer', sunElev: 14, sunAzim: 250, fogDensity: 0.0032 },
  camera: { x: 0, z: 10, dist: 95, yaw: 0.6 },
  demo(g) {
    g.camera.orbit = true;
    g.spawnGroup([['leopard', 3], ['bradley', 2]], 'UA', 0, 40, { spacing: 12, ai: { mode: 'attackMove', points: [[0, -20], [0, -70]], aggressive: true } });
    g.spawnGroup([['rifle', 6], ['javelin', 2]], 'UA', -25, 45, { spacing: 3, ai: { mode: 'attackMove', points: [[-20, -30], [-10, -70]], aggressive: true } });
    g.spawnGroup([['t72', 3], ['bmp', 2]], 'RU', 0, -50, { spacing: 12, ai: { mode: 'guard', radius: 60 } });
    g.spawnGroup([['e_rifle', 8], ['e_rpg', 2]], 'RU', 15, -60, { spacing: 3, ai: { mode: 'guard', radius: 50 } });
    g.later(3, () => g.spawn('lancet', 'RU', 0, -110, { ai: { mode: 'hunt', huntRadius: 200, points: [[0, 30]] } }));
    for (const u of g.units) if (u.side === 'UA' && u.ai) u.ai = { ...u.ai };
  },
  demoUpdate(g) {
    // Ein bisschen Dauer-Gefecht: Nachschub für beide Seiten
    this._t = (this._t || 0) + 1;
    if (this._t % 600 === 0) {
      if (g.units.filter((u) => u.side === 'RU' && u.alive).length < 6) g.spawnGroup([['t72', 2], ['e_rifle', 4]], 'RU', 0, -100, { spacing: 8, ai: { mode: 'attackMove', points: [[0, 0], [0, 50]], aggressive: true } });
      if (g.units.filter((u) => u.side === 'UA' && u.alive).length < 6) g.spawnGroup([['leopard', 2], ['rifle', 4]], 'UA', 0, 100, { spacing: 8, ai: { mode: 'attackMove', points: [[0, 0], [0, -60]], aggressive: true } });
    }
  },
};
