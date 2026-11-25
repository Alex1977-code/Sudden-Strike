// Kampagne „Grundausbildung“ (Tutorial): drei kurze Lernmissionen auf einem Truppenübungsplatz (V3-TUT)
import { registerCampaign } from '../campaigns.js';
import t1 from './t1_grundlagen.js';
import t2 from './t2_fahrzeuge.js';
import t3 from './t3_gefechtsuebung.js';

registerCampaign({
  id: 'tutorial', era: 'tutorial', faction: 'Ausbildung', order: 0,
  title: 'Grundausbildung', subtitle: 'Truppenübungsplatz „Heidekamp“', years: '',
  desc: 'Drei kurze Lektionen: Grundlagen der Steuerung, Fahrzeuge und Unterstützung, eine Gefechtsübung – mit Anleitung für Maus/Tastatur, Touch und Gamepad.',
  accent: '#8fb573',
  missions: [t1, t2, t3],
});
