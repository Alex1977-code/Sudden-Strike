// Kampagne „WK2 – Rote Armee“ (ww2-soviet): 8 Missionen von Brest 1941 bis Berlin 1945.
import { registerCampaign } from '../campaigns.js';
import m1 from './m1_brest.js';
import m2 from './m2_moskau.js';
import m3 from './m3_stalingrad.js';
import m4 from './m4_uranus.js';
import m5 from './m5_prochorowka.js';
import m6 from './m6_bagration.js';
import m7 from './m7_seelow.js';
import m8 from './m8_berlin.js';

registerCampaign({
  id: 'ww2-soviet',
  title: 'WK2 – Rote Armee', subtitle: 'Brest · Stalingrad · Berlin', years: '1941–1945',
  desc: 'Vom Sommer 1941 in der Zitadelle von Brest über Moskau, Stalingrad und Prochorowka bis zu den Seelower Höhen und Berlin – ein langer, verlustreicher Weg durch zerstörte Dörfer und Städte. Nüchtern erzählt: Opfer auf allen Seiten, Befreiung vom NS-Regime, kein Triumphgeschrei.',
  missions: [m1, m2, m3, m4, m5, m6, m7, m8],
});
