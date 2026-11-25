// V3-C1: Ukraine-Kampagne „Stahl und Sonnenblumen“ bis November 2026 – vollständige Reihenfolge (m1–m5 unverändert vorn,
// damit der gespeicherte Fortschritt über die Missions-ids m1–m5 erhalten bleibt) plus sieben neue Missionen chronologisch.
// Hinweis Importreihenfolge: Dieses Modul läuft vor dem Rumpf von js/missions/index.js; dessen spätere Registrierung mit
// m1–m5 überschreibt die längere Liste nicht (campaigns.js: Teilliste bereits enthaltener Missionen wird ignoriert).
import { registerCampaign } from '../campaigns.js';
import './units.js';
import m1 from '../m1_kyiv.js';
import m2 from '../m2_kharkiv.js';
import m3 from '../m3_hypersonic.js';
import m4 from '../m4_zaporizhzhia.js';
import m5 from '../m5_crimea.js';
import m6 from './m6_bachmut.js';
import m7 from './m7_krynky.js';
import m8 from './m8_awdijiwka.js';
import m9 from './m9_kursk.js';
import m10 from './m10_pokrowsk.js';
import m11 from './m11_dunkles_netz.js';
import m12 from './m12_kertsch.js';

// Metadaten m1–m5 (nur falls fehlend; js/missions/index.js ergänzt später Kurztexte). Vor registerCampaign setzen, da
// normalizeMission sonst die Standardschwierigkeit 2 einträgt und die Werte aus index.js (||=) nicht mehr greifen.
const UA_DIFF = { m1: 1, m2: 2, m3: 2, m4: 3, m5: 3 };
for (const m of [m1, m2, m3, m4, m5]) { m.era ||= 'modern'; m.difficulty ||= UA_DIFF[m.id]; }

// m5 war bisher das Kampagnenende: nur den Schlusssatz „Ende der Kampagne“ entfernen (Spielinhalt unverändert)
if (typeof m5.victory === 'string') m5.victory = m5.victory.replace(/\n\nEnde der Kampagne\.[^\n]*$/, '\n\nDer Krieg ist nicht vorbei.');

export const UKRAINE_MISSIONS = [m1, m2, m3, m4, m5, m6, m7, m8, m9, m10, m11, m12];
registerCampaign({ id: 'ukraine', era: 'modern', missions: UKRAINE_MISSIONS });
