// Kampagne „Afghanistan – Sowjetkrieg“ (afghan-soviet, V3-C2): 1979–1989 aus Sicht einer sowjetischen Einheit. Leitmotiv: ein
// zermürbender Einsatz fern der Heimat, den viele Beteiligte später als sinnlos empfanden. Alle Charaktere sind erfunden.
import { registerCampaign } from '../campaigns.js';
import s1 from './s1_salang.js';
import s2 from './s2_pandschir.js';
import s3 from './s3_nachschubroute.js';
import s4 from './s4_hoehe3234.js';
import s5 from './s5_termez.js';

export const MISSIONS = [s1, s2, s3, s4, s5];

registerCampaign({
  id: 'afghan-soviet', era: 'afghan', faction: 'Sowjetarmee', order: 30,
  title: 'Afghanistan – Sowjetkrieg', subtitle: 'Salang · Pandschir · Termez', years: '1979–1989',
  desc: 'Neun Jahre, fünf Einsätze einer Einheit: Kolonnen über den Salang, Luftlandungen im Pandschir, Nächte im Grenzgebirge, eine Höhe über der Straße nach Chost und die letzte Brücke über den Amudarja – ein Krieg fern der Heimat, dessen Sinn viele später nicht mehr sahen.',
  accent: '#c0704f',
  missions: MISSIONS,
});
