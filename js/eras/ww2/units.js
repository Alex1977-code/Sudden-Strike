// WK2-Einheitenkatalog (US, UK, SU, DE). Alle Typen: era:'ww2', faction, Schlüssel ww2_*; model = Schlüssel.
import { registerUnitTypes } from '../../game/unitTypes.js';
import { registerBuildKinds } from '../../game/logistics.js';
import './weapons.js';

const T = {};
const ERA = { era: 'ww2' };

// ---------- Infanterie ----------
const OBS = { range: 96, cone: Math.PI / 2, delay: 2 };
const FACS = {
  US: { tag: 'us', n: 'US', rifle: 'ww2_garand', lmg: 'ww2_bar', smg: 'ww2_thompson', at: ['ww2_bazooka'], sniper: 'ww2_sniper_us', mortar: 'ww2_mortar_us', gren: 'ww2_mk2', charge: 'ww2_satchel', para: 'ww2_thompson' },
  UK: { tag: 'uk', n: 'UK', rifle: 'ww2_enfield', lmg: 'ww2_bren', smg: 'ww2_sten', at: ['ww2_piat'], sniper: 'ww2_sniper_uk', mortar: 'ww2_mortar_uk', gren: 'ww2_mills', charge: 'ww2_gammon', para: 'ww2_sten' },
  SU: { tag: 'su', n: 'SU', rifle: 'ww2_mosin', lmg: 'ww2_dp28', smg: 'ww2_ppsh', at: ['ww2_ptrd'], sniper: 'ww2_sniper_su', mortar: 'ww2_mortar_su', gren: 'ww2_rgd33', charge: 'ww2_demo_su' },
  DE: { tag: 'de', n: 'DE', rifle: 'ww2_k98', lmg: 'ww2_mg42', smg: 'ww2_mp40', at: ['ww2_panzerschreck', 'ww2_panzerfaust'], sniper: 'ww2_sniper_de', mortar: 'ww2_mortar_de', gren: 'ww2_m24', charge: 'ww2_geballte', para: 'ww2_fg42' },
};
const NAMES = {
  US: { rifle: 'Rifleman (Garand)', lmg: 'BAR-Schütze', smg: 'Thompson-Schütze', at: 'Bazooka-Team', sniper: 'Scharfschütze (M1903)', engineer: 'Pionier (Engineer)', officer: 'Offizier', medic: 'Sanitäter (Medic)', mortar: '60-mm-Mörsertrupp', para: 'Fallschirmjäger (Airborne)' },
  UK: { rifle: 'Rifleman (Lee-Enfield)', lmg: 'Bren-Gunner', smg: 'Sten-Schütze', at: 'PIAT-Team', sniper: 'Sniper (No.4 T)', engineer: 'Sapper', officer: 'Offizier', medic: 'Sanitäter (RAMC)', mortar: '3-Zoll-Mörsertrupp', para: 'Paratrooper (Red Devil)' },
  SU: { rifle: 'Schütze (Mosin)', lmg: 'DP-28-Schütze', smg: 'PPSch-Schütze', at: 'PTRD-Panzerbüchse', sniper: 'Scharfschütze', engineer: 'Pionier (Sapper)', officer: 'Kommandeur', medic: 'Sanitäterin/Sanitäter', mortar: '82-mm-Mörsertrupp' },
  DE: { rifle: 'Schütze (K98)', lmg: 'MG-42-Trupp', smg: 'MP-40-Schütze', at: 'Panzerabwehr (Schreck/Faust)', sniper: 'Scharfschütze (K98 ZF)', engineer: 'Pionier', officer: 'Offizier', medic: 'Sanitäter', mortar: '8-cm-Granatwerfertrupp', para: 'Fallschirmjäger' },
};
function inf(fac, kind, o) {
  const f = FACS[fac], key = `ww2_${f.tag}_${o.k}`;
  const base = { ...ERA, faction: fac, name: NAMES[fac][kind], icon: o.icon || '🪖', cls: 'inf', model: key, hp: 70, armor: 'soft', speed: 4.2, sight: 34, radius: 0.8, conceal: 0.35, weapons: [] };
  T[key] = { ...base, ...o.t };
  delete T[key].k;
  return key;
}
const infKeys = {};
for (const fac of Object.keys(FACS)) {
  const f = FACS[fac], K = {};
  const G = f.gren;
  K.rifle = inf(fac, 'rifle', { k: 'rifle', t: { weapons: [f.rifle, G], desc: 'Standard-Infanterie mit Handgranaten.' } });
  K.lmg = inf(fac, 'lmg', { k: f.tag === 'su' ? 'dp28' : f.tag === 'uk' ? 'bren' : f.tag === 'de' ? 'mg42' : 'bar', icon: '🔫', t: { weapons: [f.lmg], hp: 75, speed: 3.8, conceal: 0.3, desc: 'MG-Trupp: unterdrückt Infanterie.' } });
  K.smg = inf(fac, 'smg', { k: f.tag === 'su' ? 'ppsh' : f.tag === 'uk' ? 'sten' : f.tag === 'de' ? 'mp40' : 'thompson', t: { weapons: [f.smg, G], speed: 4.5, sight: 32, desc: 'Starke Nahkampfwaffe, kurze Reichweite.' } });
  K.at = inf(fac, 'at', { k: f.tag === 'su' ? 'ptrd' : f.tag === 'uk' ? 'piat' : f.tag === 'de' ? 'panzer' : 'bazooka', icon: '🚀', t: { weapons: [...f.at, f.rifle], hp: 60, speed: 3.8, conceal: 0.4, desc: 'Panzerabwehr der Infanterie.' } });
  K.sniper = inf(fac, 'sniper', { k: 'sniper', icon: '🎯', t: { weapons: [f.sniper], hp: 50, speed: 4, sight: 48, conceal: 0.7, desc: 'Gut getarnt, große Sichtweite.' } });
  K.engineer = inf(fac, 'engineer', { k: 'engineer', icon: '⛏️', t: { weapons: [f.rifle, f.charge], engineer: { material: 4 }, desc: 'Baut Sperren, Stellungen, Minenfelder; räumt Minen; sprengt Brücken/Gebäude.' } });
  K.officer = inf(fac, 'officer', { k: 'officer', icon: '🔭', t: { weapons: ['pistol'], hp: 55, sight: 24, conceal: 0.5, observer: { ...OBS }, officer: true, smoke: 2, desc: 'Offizier: Führungsaura 30 m (Treffer, Nachladen, Moral), im Stand nach 2 s Fernglas.' } });
  K.medic = inf(fac, 'medic', { k: 'medic', icon: '⚕️', t: { weapons: ['pistol'], hp: 60, sight: 30, medic: true, healRate: 2.5, healRadius: 10, desc: 'Sanitäter (medic): heilt Infanterie im Umkreis.' } });
  K.mortar = inf(fac, 'mortar', { k: 'mortar', icon: '💥', t: { weapons: [f.mortar, f.rifle], hp: 65, speed: 3.4, sight: 30, desc: 'Indirektes Feuer, braucht Aufklärer.' } });
  if (f.para) K.para = inf(fac, 'para', { k: fac === 'DE' ? 'fj' : 'para', icon: '🪂', t: { weapons: [f.para, G], hp: 85, speed: 4.6, sight: 36, conceal: 0.45, paratrooper: true, desc: 'Elite-Fallschirmjäger (Abwurf per Fähigkeit).' } });
  infKeys[fac] = K;
}

// ---------- Fahrzeuge ----------
function veh(key, fac, o) { T[key] = { ...ERA, faction: fac, icon: '🛡️', cls: 'veh', model: key, armor: 'heavy', sight: 36, turnRate: 1.6, turretRate: 1.4, ...o }; return key; }
const SUPPLY = { fuel: 1500, supply: { ammo: 1500, fuel: 3000, material: 12, radius: 15 } };

// US
veh('ww2_sherman', 'US', { name: 'M4A1 Sherman', hp: 600, speed: 8, radius: 2.9, weapons: ['ww2_m3_75', 'ww2_m1919'], desc: 'Zuverlässiger Mittlerer Panzer, 75 mm. Stark in Zahl.' });
veh('ww2_sherman76', 'US', { name: 'M4A3E8 Sherman (76)', hp: 620, speed: 8, radius: 2.9, weapons: ['ww2_m1_76', 'ww2_m1919'], desc: 'Verbesserte Kanone, breite Ketten.' });
veh('ww2_m10', 'US', { name: 'M10 Wolverine', hp: 430, armor: 'light', speed: 9.5, radius: 2.9, turretRate: 1.8, weapons: ['ww2_m1_76', 'ww2_browning50'], desc: 'Jagdpanzer mit offenem Turm: schnell, dünn gepanzert.' });
veh('ww2_m3ht', 'US', { name: 'M3 Halbkette', icon: '🚙', hp: 330, armor: 'light', speed: 10, radius: 2.8, sight: 34, turnRate: 2, weapons: ['ww2_browning50'], transport: 10, desc: 'Mannschaftstransporter mit .50-Cal-MG.' });
veh('ww2_jeep', 'US', { name: 'Jeep Willys', icon: '🚙', hp: 110, armor: 'light', speed: 14, radius: 1.6, sight: 40, turnRate: 3, weapons: ['ww2_m1919'], desc: 'Leichtes Aufklärungs- und Zugfahrzeug.' });
veh('ww2_gmc', 'US', { name: 'GMC CCKW Lkw', icon: '🚚', hp: 200, armor: 'light', speed: 10, radius: 2.8, sight: 24, turnRate: 1.8, weapons: [], ...SUPPLY, desc: 'Nachschub-Lkw, zieht Geschütze.' });
veh('ww2_m7', 'US', { name: 'M7 Priest', icon: '💥', hp: 420, armor: 'light', speed: 7, radius: 2.9, turretRate: 0.8, weapons: ['ww2_m101', 'ww2_browning50'], desc: '105-mm-Selbstfahrhaubitze.' });
// UK
veh('ww2_cromwell', 'UK', { name: 'Cromwell', hp: 480, speed: 9.5, radius: 3, weapons: ['ww2_qf75', 'ww2_besa'], desc: 'Schneller Kreuzerpanzer.' });
veh('ww2_firefly', 'UK', { name: 'Sherman Firefly', hp: 570, speed: 7.8, radius: 2.9, weapons: ['ww2_17pdr', 'ww2_besa'], desc: 'Sherman mit 17-pdr – bricht Tiger und Panther.' });
veh('ww2_churchill', 'UK', { name: 'Churchill VII', hp: 820, speed: 5, radius: 3.4, weapons: ['ww2_qf75', 'ww2_besa'], desc: 'Schwerer Infanteriepanzer, zäh und langsam.' });
veh('ww2_carrier', 'UK', { name: 'Universal Carrier', icon: '🚙', hp: 240, armor: 'light', speed: 9, radius: 2.1, turnRate: 2.4, weapons: ['ww2_bren'], transport: 4, desc: 'Leichter Kettenträger mit Bren.' });
veh('ww2_bedford', 'UK', { name: 'Bedford QL Lkw', icon: '🚚', hp: 190, armor: 'light', speed: 10, radius: 2.7, sight: 24, turnRate: 1.8, weapons: [], ...SUPPLY, desc: 'Nachschub-Lkw, zieht Geschütze.' });
// SU
veh('ww2_t34_76', 'SU', { name: 'T-34/76', hp: 540, speed: 9, radius: 2.9, weapons: ['ww2_f34', 'ww2_dt'], desc: 'Robuster Mittlerer Panzer mit Schrägpanzerung.' });
veh('ww2_t34_85', 'SU', { name: 'T-34/85', hp: 610, speed: 8.8, radius: 2.9, weapons: ['ww2_zis85', 'ww2_dt'], desc: 'Größerer Turm, 85-mm-Kanone.' });
veh('ww2_kv1', 'SU', { name: 'KV-1', hp: 780, speed: 5.5, radius: 3.2, weapons: ['ww2_f34', 'ww2_dt'], turretRate: 1.2, desc: 'Schwerer Panzer, hohe Panzerung, träge.' });
veh('ww2_is2', 'SU', { name: 'IS-2', hp: 900, speed: 6, radius: 3.2, weapons: ['ww2_d25t', 'ww2_dt'], turretRate: 1.0, desc: '122-mm-Kanone: schwere Sprengwirkung, langsame Ladezeit.' });
veh('ww2_su76', 'SU', { name: 'SU-76', icon: '💥', hp: 300, armor: 'light', speed: 9, radius: 2.6, turretRate: 0.6, weapons: ['ww2_zis3'], desc: 'Leichtes offenes Sturmgeschütz.' });
veh('ww2_su100', 'SU', { name: 'SU-100', hp: 570, speed: 7.8, radius: 2.9, turretRate: 0.5, weapons: ['ww2_d10', 'ww2_dt'], desc: 'Jagdpanzer mit 100-mm-Kanone.' });
veh('ww2_bm13', 'SU', { name: 'BM-13 Katjuscha', icon: '🎆', hp: 230, armor: 'light', speed: 9.5, radius: 3, sight: 30, turretRate: 1.0, weapons: ['ww2_bm13'], desc: 'Raketenwerfer – Fähigkeit „Katjuscha-Salve".' });
veh('ww2_zis_truck', 'SU', { name: 'ZiS-5 Lkw', icon: '🚚', hp: 180, armor: 'light', speed: 10, radius: 2.7, sight: 24, turnRate: 1.8, weapons: [], ...SUPPLY, desc: 'Nachschub-Lkw, zieht Geschütze.' });
veh('ww2_ba64', 'SU', { name: 'BA-64', icon: '🚙', hp: 150, armor: 'light', speed: 13, radius: 2.0, sight: 42, turnRate: 3, weapons: ['ww2_dt'], desc: 'Leichter Panzerspähwagen.' });
// DE
veh('ww2_pz4', 'DE', { name: 'Panzer IV Ausf. H', hp: 560, speed: 7.5, radius: 2.9, weapons: ['ww2_kwk40', 'ww2_mg34'], desc: 'Rückgrat der Panzertruppe, 7,5 cm lang.' });
veh('ww2_panther', 'DE', { name: 'Panther Ausf. G', hp: 800, speed: 7.4, radius: 3.2, weapons: ['ww2_kwk42', 'ww2_mg34'], turretRate: 1.3, desc: 'Schräge Front, starke 7,5-cm-L/70.' });
veh('ww2_tiger', 'DE', { name: 'Tiger I', hp: 1000, speed: 5.8, radius: 3.2, weapons: ['ww2_kwk36', 'ww2_mg34'], turretRate: 1.0, desc: '88 mm: dominiert frontal, verwundbar in Flanke und Heck.' });
veh('ww2_stug3', 'DE', { name: 'StuG III Ausf. G', hp: 520, speed: 7, radius: 2.9, turretRate: 0.5, weapons: ['ww2_kwk40', 'ww2_mg34'], conceal: 0.2, desc: 'Sturmgeschütz ohne Turm: niedrig, günstig, tödlich.' });
veh('ww2_hetzer', 'DE', { name: 'Jagdpanzer 38(t) Hetzer', hp: 400, speed: 7.5, radius: 2.5, turretRate: 0.5, weapons: ['ww2_kwk40'], conceal: 0.25, desc: 'Kleiner, niedriger Jagdpanzer.' });
veh('ww2_jagdpz4', 'DE', { name: 'Jagdpanzer IV/70', hp: 560, speed: 6.8, radius: 2.9, turretRate: 0.5, weapons: ['ww2_kwk42', 'ww2_mg34'], desc: 'Jagdpanzer mit langer 7,5-cm-Kanone.' });
veh('ww2_sdkfz251', 'DE', { name: 'Sd.Kfz. 251 Halbkette', icon: '🚙', hp: 340, armor: 'light', speed: 9.5, radius: 2.8, turnRate: 2, weapons: ['ww2_mg42'], transport: 10, desc: 'Gepanzerter Mannschaftstransporter.' });
veh('ww2_kubel', 'DE', { name: 'Kübelwagen', icon: '🚙', hp: 100, armor: 'light', speed: 13, radius: 1.6, sight: 40, turnRate: 3, weapons: [], desc: 'Leichter Stabs- und Zugwagen.' });
veh('ww2_opel', 'DE', { name: 'Opel Blitz Lkw', icon: '🚚', hp: 190, armor: 'light', speed: 10, radius: 2.7, sight: 24, turnRate: 1.8, weapons: [], ...SUPPLY, desc: 'Nachschub-Lkw, zieht Geschütze.' });
veh('ww2_wespe', 'DE', { name: 'Wespe (10,5-cm)', icon: '💥', hp: 280, armor: 'light', speed: 7.5, radius: 2.5, turretRate: 0.8, weapons: ['ww2_lefh18'], desc: 'Selbstfahrhaubitze.' });
veh('ww2_puma', 'DE', { name: 'Sd.Kfz. 234/2 Puma', icon: '🚙', hp: 250, armor: 'light', speed: 12, radius: 2.7, sight: 42, turnRate: 2.4, weapons: ['ww2_kwk39', 'ww2_mg34'], desc: 'Schneller Spähwagen mit 5-cm-Kanone.' });

// ---------- Gezogene Geschütze ----------
const TOW = { US: ['ww2_gmc', 'ww2_jeep', 'ww2_m3ht'], UK: ['ww2_bedford', 'ww2_carrier'], SU: ['ww2_zis_truck', 'ww2_ba64'], DE: ['ww2_opel', 'ww2_sdkfz251', 'ww2_kubel'] };
function gun(key, fac, o) { T[key] = { ...ERA, faction: fac, icon: '🎯', cls: 'veh', model: key, armor: 'light', speed: 2.4, sight: 34, radius: 1.8, turnRate: 1.2, turretRate: 1.2, towed: true, towedBy: TOW[fac], crew: 3, conceal: 0.3, ...o }; return key; }
gun('ww2_pak40', 'DE', { name: '7,5-cm-Pak 40', hp: 170, weapons: ['ww2_pak40'], crew: 4, conceal: 0.45, desc: 'Starke Pak, gut zu tarnen.' });
gun('ww2_flak88', 'DE', { name: '8,8-cm-Flak 36', hp: 230, radius: 2.4, weapons: ['ww2_flak88_at', 'ww2_flak88_aa'], crew: 6, airSight: 70, sight: 40, conceal: 0.2, desc: 'Gefürchtet gegen Panzer und Flugzeuge.' });
gun('ww2_6pdr', 'UK', { name: '6-pdr Pak (57 mm)', hp: 150, weapons: ['ww2_6pdr'], crew: 4, conceal: 0.45, desc: 'Britische Panzerabwehrkanone.' });
gun('ww2_us_57mm', 'US', { name: '57-mm-Pak M1', hp: 150, weapons: ['ww2_6pdr'], crew: 4, conceal: 0.45, desc: 'US-Lizenzbau der 6-pdr.' });
gun('ww2_zis3', 'SU', { name: 'ZiS-3 (76 mm)', hp: 160, weapons: ['ww2_zis3'], crew: 4, conceal: 0.45, desc: 'Vielseitige Divisionskanone.' });
gun('ww2_m101', 'US', { name: '105-mm-Haubitze M2A1', hp: 200, radius: 2.2, weapons: ['ww2_m101'], crew: 5, desc: 'Gezogene Feldhaubitze.' });
gun('ww2_lefh18', 'DE', { name: '10,5-cm-leFH 18', hp: 200, radius: 2.2, weapons: ['ww2_lefh18'], crew: 5, desc: 'Leichte Feldhaubitze.' });
gun('ww2_flak37', 'DE', { name: '3,7-cm-Flak 36', hp: 140, weapons: ['ww2_flak37'], crew: 3, airSight: 65, desc: 'Leichte Flak gegen Tiefflieger.' });
gun('ww2_bofors_us', 'US', { name: '40-mm-Bofors', hp: 140, weapons: ['ww2_bofors'], crew: 3, airSight: 65, desc: 'Leichte Flak.' });
gun('ww2_bofors_uk', 'UK', { name: '40-mm-Bofors', hp: 140, weapons: ['ww2_bofors'], crew: 3, airSight: 65, desc: 'Leichte Flak.' });
gun('ww2_61k', 'SU', { name: '37-mm 61-K', hp: 140, weapons: ['ww2_61k'], crew: 3, airSight: 65, desc: 'Leichte Flak.' });
gun('ww2_nebelwerfer', 'DE', { name: 'Nebelwerfer 41', icon: '🎆', hp: 150, radius: 2.0, weapons: ['ww2_nebel'], crew: 4, desc: 'Raketenwerfer, Fähigkeit „Nebelwerfer-Salve".' });

// ---------- Luft / See ----------
function air(key, fac, o) { T[key] = { ...ERA, faction: fac, icon: '✈️', cls: 'air', model: key, armor: 'air', sight: 50, radius: 3, turnRate: 1.2, conceal: 0, ...o }; return key; }
air('ww2_l4', 'US', { name: 'Piper L-4 Cub', icon: '🛩️', hp: 110, speed: 15, alt: 28, sight: 60, weapons: [], desc: 'Aufklärer – Fähigkeit „Aufklärungsflug".' });
air('ww2_auster', 'UK', { name: 'Auster AOP', icon: '🛩️', hp: 110, speed: 15, alt: 28, sight: 60, weapons: [], desc: 'Beobachtungsflugzeug.' });
air('ww2_po2', 'SU', { name: 'Po-2', icon: '🛩️', hp: 110, speed: 13, alt: 26, sight: 56, weapons: [], desc: 'Doppeldecker-Aufklärer.' });
air('ww2_storch', 'DE', { name: 'Fieseler Storch', icon: '🛩️', hp: 120, speed: 14, alt: 26, sight: 60, weapons: [], desc: 'Aufklärer und Verbindungsflugzeug.' });
air('ww2_p47', 'US', { name: 'P-47 Thunderbolt', hp: 380, speed: 26, alt: 22, radius: 3.5, weapons: ['ww2_air_rockets'], desc: 'Jagdbomber – Fähigkeit „Jabo-Angriff".' });
air('ww2_typhoon', 'UK', { name: 'Hawker Typhoon', hp: 340, speed: 27, alt: 22, radius: 3.5, weapons: ['ww2_air_rockets'], desc: 'Raketenjagdbomber.' });
air('ww2_il2', 'SU', { name: 'Il-2 Schturmowik', hp: 460, speed: 23, alt: 20, radius: 3.5, weapons: ['ww2_air_rockets'], desc: 'Gepanzertes Schlachtflugzeug.' });
air('ww2_ju87', 'DE', { name: 'Ju 87 Stuka', hp: 300, speed: 22, alt: 22, radius: 3.5, weapons: ['ww2_air_rockets'], desc: 'Sturzkampfbomber.' });
air('ww2_c47', 'US', { name: 'C-47 Skytrain', hp: 520, speed: 18, alt: 30, radius: 5, weapons: [], transport: 18, desc: 'Transporter – Fallschirmabwurf.' });
air('ww2_dakota', 'UK', { name: 'Dakota', hp: 520, speed: 18, alt: 30, radius: 5, weapons: [], transport: 18, desc: 'Transporter – Fallschirmabwurf.' });
air('ww2_ju52', 'DE', { name: 'Ju 52', hp: 480, speed: 16, alt: 30, radius: 5, weapons: [], transport: 18, desc: 'Transporter – Fallschirmabwurf.' });
T.ww2_lcvp = { ...ERA, faction: 'US', name: 'LCVP Landungsboot', icon: '🚢', cls: 'naval', model: 'ww2_lcvp', hp: 260, armor: 'light', speed: 10, sight: 40, radius: 4, weapons: ['ww2_m1919'], turnRate: 0.9, turretRate: 2, transport: 36, landing: true, desc: 'Landungsboot für 36 Mann (Transportlogik später).' };

// ---------- Panzerzug (Zug-Logik später) ----------
function train(tag, fac, k, o) { const key = `ww2_${tag}_train_${k}`; T[key] = { ...ERA, faction: fac, icon: '🚂', cls: 'veh', model: key, armor: 'light', speed: 6, sight: 30, radius: 4.5, turnRate: 0.3, turretRate: 1.2, rail: true, train: k, ...o }; return key; }
for (const [tag, fac] of [['de', 'DE'], ['su', 'SU']]) {
  const g = fac === 'DE' ? 'Panzerzug' : 'Panzerzug';
  train(tag, fac, 'loco', { name: `${g}-Lokomotive`, hp: 900, weapons: [], desc: 'Dampflok, zieht den Zug.' });
  train(tag, fac, 'wagon', { name: 'Güterwagen', hp: 500, weapons: [], desc: 'Güterwagen (Nachschub).' });
  train(tag, fac, 'flak', { name: 'Flak-Waggon', hp: 550, weapons: [fac === 'DE' ? 'ww2_flak37' : 'ww2_61k'], airSight: 60, desc: 'Flak-Waggon mit Schnellfeuerkanone.' });
  train(tag, fac, 'armor', { name: 'Panzerwagen', hp: 1100, armor: 'heavy', weapons: [fac === 'DE' ? 'ww2_kwk40' : 'ww2_f34', fac === 'DE' ? 'ww2_mg34' : 'ww2_dt'], desc: 'Gepanzerter Waggon mit Turm.' });
}

// ---------- Epochen-Bauwerke (Pionier-Bauten, Muster wie tanktrap/sandbag/trench/minefield) ----------
function bld(key, name, o) { T[key] = { ...ERA, name, icon: '🧱', cls: 'struct', model: key, armor: 'struct', sight: 0, weapons: [], noAutoTarget: true, ...o }; }
bld('ww2_barbedwire', 'Stacheldraht', { hp: 120, radius: 2.4, blocksInfantry: true, build: { cost: 1, time: 8, w: 4.4, d: 1.2, blocksInfantry: true, conceal: 0 }, desc: 'Hält Infanterie auf (Fahrzeuge walzen ihn nieder).' });
bld('ww2_antitank_ditch', 'Panzergraben', { hp: 900, radius: 4, build: { cost: 3, time: 30, w: 8, d: 3.6, blocks: true }, desc: 'Sperrt Fahrzeuge, Infanterie kann queren.' });
bld('ww2_foxhole', 'Schützenloch', { hp: 220, radius: 1.5, selfDig: true, build: { cost: 0, time: 6, w: 2.4, d: 2.4, cover: 0.5, conceal: 0.5, selfDig: true }, desc: 'Infanterie kann es selbst graben (Schaden −50 %).' });
bld('ww2_mgnest', 'MG-Nest', { hp: 420, radius: 2.2, weapons: ['ww2_mg42'], noAutoTarget: false, build: { cost: 1, time: 14, w: 3.4, d: 3.0, cover: 0.45, conceal: 0.3 }, desc: 'Sandsack-MG-Stellung.' });
bld('ww2_bunker', 'Betonbunker', { hp: 2200, radius: 3.6, sight: 30, weapons: ['ww2_mg42'], noAutoTarget: false, build: { cost: 6, time: 60, w: 6, d: 5, cover: 0.75, conceal: 0.2 }, desc: 'Atlantikwall-Stil, stark gegen Infanterie-Waffen.' });
bld('ww2_tetrahedron', 'Tschechenigel', { hp: 800, radius: 2.4, build: { cost: 1, time: 10, w: 4.4, d: 2.4, blocks: true }, desc: 'Strandhindernis/Panzersperre.' });
bld('ww2_mines_at', 'Panzerminen', { hp: 150, radius: 5, mineKind: 'at', build: { cost: 2, time: 14, w: 9, d: 9, mines: 8, hidden: true, mineKind: 'at' }, desc: 'Für den Gegner unsichtbar. Schwer gegen Fahrzeuge.' });
bld('ww2_mines_ap', 'Schützenminen', { hp: 150, radius: 5, mineKind: 'ap', build: { cost: 2, time: 14, w: 9, d: 9, mines: 12, hidden: true, mineKind: 'ap' }, desc: 'Für den Gegner unsichtbar. Schwer gegen Infanterie.' });

registerUnitTypes(T);

export const WW2_TYPES = T;
const k = (...a) => a;
export const ROSTERS = {
  US: { infantry: [...Object.values(infKeys.US)], armor: ['ww2_sherman', 'ww2_sherman76', 'ww2_m10'], support: ['ww2_m7', 'ww2_m101', 'ww2_us_57mm', 'ww2_bofors_us', 'ww2_m3ht', 'ww2_jeep', 'ww2_p47', 'ww2_l4', 'ww2_c47', 'ww2_lcvp'], logistics: ['ww2_gmc'] },
  UK: { infantry: [...Object.values(infKeys.UK)], armor: ['ww2_cromwell', 'ww2_firefly', 'ww2_churchill'], support: ['ww2_carrier', 'ww2_6pdr', 'ww2_bofors_uk', 'ww2_typhoon', 'ww2_auster', 'ww2_dakota'], logistics: ['ww2_bedford'] },
  SU: { infantry: [...Object.values(infKeys.SU)], armor: ['ww2_t34_76', 'ww2_t34_85', 'ww2_kv1', 'ww2_is2', 'ww2_su76', 'ww2_su100'], support: ['ww2_bm13', 'ww2_zis3', 'ww2_61k', 'ww2_ba64', 'ww2_il2', 'ww2_po2', 'ww2_su_train_armor', 'ww2_su_train_flak'], logistics: ['ww2_zis_truck', 'ww2_su_train_loco', 'ww2_su_train_wagon'] },
  DE: { infantry: [...Object.values(infKeys.DE)], armor: ['ww2_pz4', 'ww2_panther', 'ww2_tiger', 'ww2_stug3', 'ww2_hetzer', 'ww2_jagdpz4'], support: ['ww2_puma', 'ww2_sdkfz251', 'ww2_wespe', 'ww2_nebelwerfer', 'ww2_pak40', 'ww2_flak88', 'ww2_flak37', 'ww2_lefh18', 'ww2_kubel', 'ww2_ju87', 'ww2_storch', 'ww2_ju52', 'ww2_de_train_armor', 'ww2_de_train_flak'], logistics: ['ww2_opel', 'ww2_de_train_loco', 'ww2_de_train_wagon'] },
};
export const FORTIFICATIONS = ['ww2_barbedwire', 'ww2_antitank_ditch', 'ww2_foxhole', 'ww2_mgnest', 'ww2_bunker', 'ww2_tetrahedron', 'ww2_mines_at', 'ww2_mines_ap'];
// Pionier-Baumenü der Epoche (V3-M1): alle WK2-Pioniere; Schützenloch gräbt jede Infanterie zusätzlich selbst ({t:'dig'})
registerBuildKinds(FORTIFICATIONS, { era: 'ww2' });
