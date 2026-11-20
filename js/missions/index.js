// Kampagne „Stahl und Sonnenblumen"
import m1 from './m1_kyiv.js';
import m2 from './m2_kharkiv.js';
import m3 from './m3_hypersonic.js';
import m4 from './m4_zaporizhzhia.js';
import m5 from './m5_crimea.js';

export const CAMPAIGN = [m1, m2, m3, m4, m5];

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
