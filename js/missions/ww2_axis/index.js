// Kampagne „WK2 – Deutsche Seite“ (ww2-axis, V3-C5): sechs Missionen aus Sicht einfacher Soldaten der Wehrmacht –
// nüchtern und kritisch erzählt (Antikriegsperspektive); das Kriegsende wird als Befreiung vom NS-Regime eingeordnet.
// Keine Symbole, keine SS-Einheiten, keine historischen Führerfiguren; alle Charaktere sind erfunden.
import { registerCampaign } from '../campaigns.js';
import c1 from './c1_ebenemael.js';
import c2 from './c2_kreta.js';
import c3 from './c3_gazala.js';
import c4 from './c4_charkow.js';
import c5 from './c5_ardennen.js';

export const MISSIONS = [c1, c2, c3, c4, c5];

const DEF = {
  id: 'ww2-axis', era: 'ww2', faction: 'Deutsche Seite', order: 60,
  title: 'WK2 – Soldaten der Wehrmacht', subtitle: 'Ein Krieg, der nicht zu gewinnen war', years: '1940–1945',
  desc: 'Von Eben-Emael bis zum Kessel von Halbe – ein Krieg aus der Sicht einfacher Soldaten: Erschöpfung, Zweifel, Verluste. Kein Triumph, keine Verklärung. Das Ende 1945 ist die Befreiung Europas vom NS-Regime.',
  accent: '#9aa08a',
  missions: MISSIONS,
};
registerCampaign(DEF);
// js/missions/index.js registriert die Platzhalter aller Kampagnen NACH den (hochgezogenen) Importen – danach nochmals eintragen.
queueMicrotask(() => registerCampaign(DEF));
