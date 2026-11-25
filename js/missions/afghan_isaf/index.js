// Kampagne „Afghanistan – ISAF“ (afghan-isaf, V3-C2): Bundeswehr im Raum Kunduz 2009–2013. Schwerpunkt Schutz-, Versorgungs-
// und Bergungsaufträge, nüchtern aus Sicht der Soldaten. Alle Charaktere sind erfunden; Zivilisten sind nie Ziel.
import { registerCampaign } from '../campaigns.js';
import i1 from './i1_versorgungsfahrt.js';

export const MISSIONS = [i1];

registerCampaign({
  id: 'afghan-isaf', era: 'afghan', faction: 'ISAF / Bundeswehr', order: 20,
  title: 'Afghanistan – ISAF', subtitle: 'Kunduz 2009–2013', years: '2009–2013',
  desc: 'Versorgungsfahrten, ein Brunnen, der über Nacht geschützt werden muss, eine Bergung im Raum Chahar Darah, die Brücke am Kunduz-Fluss und der Abzug aus dem Feldlager – fünf Einsätze aus Sicht der Soldaten, in einem Land, dessen Bevölkerung den höchsten Preis zahlt.',
  accent: '#c9a36a',
  missions: MISSIONS,
});
