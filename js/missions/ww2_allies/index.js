// Kampagne „Westalliierte“ (ww2-allies): Teil 1 (a1–a5, V3-C3a) und Teil 2 (b1–b5, V3-C3b) in fester Reihenfolge.
import { registerCampaign } from '../campaigns.js';
import a1 from './a1_duenkirchen.js';
import a2 from './a2_alamein.js';
import a3 from './a3_pegasus.js';
import a4 from './a4_omaha.js';
import a5 from './a5_carentan.js';
import b1 from './b1_arnheim.js';

export const MISSIONS = [a1, a2, a3, a4, a5, b1];

const DEF = {
  id: 'ww2-allies', era: 'ww2', faction: 'Westalliierte',
  title: 'WK2 – Westalliierte', subtitle: 'Dünkirchen · Normandie · Remagen', years: '1940–1945',
  desc: 'Vom Rückzug über den Kanal 1940 und dem Wüstenkrieg bei El Alamein über die Nacht von Pegasus Bridge, den blutigen Strand von Omaha und die Hecken von Carentan bis zur Brücke von Remagen.',
  missions: MISSIONS,
};
registerCampaign(DEF);
// js/missions/index.js registriert die Platzhalter aller Kampagnen NACH den (hochgezogenen) Importen und würde Titel/Missionen
// überschreiben – daher nach der Modulauswertung noch einmal eintragen.
queueMicrotask(() => registerCampaign(DEF));
