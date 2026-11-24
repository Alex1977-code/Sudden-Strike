// Afghanistan-Epoche: Einheitentypen (Schlüssel af_<fraktion>_<name>), Fraktionen BW | TAL | SA | MUJ.
// Modellnamen werden je Fraktion suffigiert (af_dingo -> af_dingo_BW), damit der Geometrie-Cache in models.js nicht
// Farben zwischen Fraktionen vermischt. Die Modelle selbst stehen in models.js.
import { registerUnitTypes } from '../../game/unitTypes.js';
import { registerBuildKinds } from '../../game/logistics.js';
import './weapons.js';

const T = {};
const def = (fac, key, d) => { T[key] = { era: 'afghan', faction: fac, ...d, model: `${d.model}_${fac}` }; };
const inf = (fac, key, d) => def(fac, key, { cls: 'inf', model: 'af_soldier', armor: 'soft', radius: 0.8, ...d });
const veh = (fac, key, d) => def(fac, key, { cls: 'veh', armor: 'light', ...d });
const air = (fac, key, d) => def(fac, key, { cls: 'air', armor: 'air', ...d });
const str = (fac, key, d) => def(fac, key, { cls: 'struct', armor: 'struct', ...d });
const SUPPLY = { ammo: 1500, fuel: 3000, material: 12, radius: 15 };
const OBS = { range: 96, cone: Math.PI / 2, delay: 2 };

// ======================= Bundeswehr / ISAF (BW) =======================
inf('BW', 'af_bw_rifle', { name: 'Schützentrupp (G36)', icon: '🪖', weaponModel: 'rifle', hp: 75, speed: 4.3, sight: 34, weapons: ['af_g36', 'af_dm51', 'af_ag36'], conceal: 0.35, desc: 'Vielseitige Infanterie mit G36. Solide Treffsicherheit.' });
inf('BW', 'af_bw_mg', { name: 'MG-Schütze (MG4)', icon: '🔫', weaponModel: 'mg', hp: 78, speed: 3.9, sight: 34, weapons: ['af_mg4'], conceal: 0.3, desc: 'Unterdrückungsfeuer mit MG4/MG3.' });
inf('BW', 'af_bw_sniper', { name: 'Scharfschütze (G82)', icon: '🎯', weaponModel: 'sniper', hp: 50, speed: 4, sight: 50, weapons: ['af_g82'], conceal: 0.7, desc: 'Gut getarnt, große Sichtweite. .50-Gewehr wirkt auch gegen leichte Fahrzeuge.' });
inf('BW', 'af_bw_at', { name: 'Panzerabwehr (Panzerfaust 3)', icon: '🚀', weaponModel: 'pzf', hp: 62, speed: 3.9, sight: 32, weapons: ['af_pzf3', 'af_g36'], conceal: 0.38, desc: 'Leichte Panzerabwehr, kurze Reichweite.' });
inf('BW', 'af_bw_milan', { name: 'Panzerabwehr (MILAN)', icon: '🚀', weaponModel: 'milan', hp: 62, speed: 3.6, sight: 36, weapons: ['af_milan', 'af_g36'], conceal: 0.38, desc: 'Lenkflugkörper-Panzerabwehr, große Reichweite.' });
inf('BW', 'af_bw_engineer', { name: 'Pionier / Kampfmittelräumer', icon: '⛏️', weaponModel: 'engineer', hp: 72, speed: 4.1, sight: 32, weapons: ['af_g36', 'af_dm51', 'charge'], conceal: 0.35, engineer: { material: 4 }, desc: 'Räumt Minen und Sprengfallen (IEDs), baut Sandsäcke, Gräben und Sperren.' });
inf('BW', 'af_bw_medic', { name: 'Sanitäter', icon: '⚕️', weaponModel: 'medic', hp: 60, speed: 4.2, sight: 30, weapons: ['pistol'], conceal: 0.35, medic: { rate: 3, radius: 10 }, desc: 'Heilt Infanterie im Umkreis.' });
inf('BW', 'af_bw_jtac', { name: 'Offizier / JTAC', icon: '🔭', weaponModel: 'jtac', hp: 58, speed: 4.1, sight: 24, weapons: ['pistol'], conceal: 0.5, observer: OBS, officer: true, desc: 'Fernglas: weite Sicht im Kegel. Leitet Luftnahunterstützung und Artillerie (Fähigkeiten).' });
inf('BW', 'af_bw_para', { name: 'Fallschirmjäger', icon: '🪂', weaponModel: 'para', hp: 100, speed: 4.8, sight: 38, weapons: ['af_g36p', 'af_dm51', 'af_ag36'], conceal: 0.45, desc: 'Elite-Infanterie, schnell und treffsicher.' });
veh('BW', 'af_bw_dingo', { transport: 6, name: 'ATF Dingo 2', icon: '🛡️', model: 'af_dingo', hp: 620, speed: 10, sight: 34, radius: 2.8, weapons: ['af_mg3rws'], turnRate: 2, turretRate: 3, airSight: 45, iedResist: 0.7, desc: 'Minengeschütztes Patrouillenfahrzeug (MRAP) mit Fernwaffenstation. Sehr hohe Überlebensfähigkeit gegen Sprengfallen.' });
veh('BW', 'af_bw_eagle', { transport: 3, name: 'Eagle IV', icon: '🛡️', model: 'af_eagle', hp: 560, speed: 10.5, sight: 34, radius: 2.8, weapons: ['af_hmg_rws'], turnRate: 2, turretRate: 3, airSight: 45, iedResist: 0.6, desc: 'Gepanzertes Mehrzweckfahrzeug (MRAP) mit schwerem MG in Fernwaffenstation.' });
veh('BW', 'af_bw_fennek', { name: 'Fennek (Aufklärer)', icon: '🔍', model: 'af_fennek', hp: 300, speed: 12, sight: 56, radius: 2.6, weapons: ['af_gmw'], turnRate: 2.4, turretRate: 3, conceal: 0.5, airSight: 50, iedResist: 0.3, desc: 'Flacher Spähwagen mit Sichtmast, große Sichtweite, gute Tarnung.' });
veh('BW', 'af_bw_wiesel_mk', { name: 'Wiesel 1 MK20', icon: '🚙', model: 'af_wiesel_mk', hp: 260, speed: 11, sight: 34, radius: 2.1, weapons: ['af_mk20'], turnRate: 2.6, turretRate: 2.4, desc: 'Leichte Waffenträger-Kette, 20-mm-Maschinenkanone.' });
veh('BW', 'af_bw_wiesel_tow', { name: 'Wiesel 1 TOW', icon: '🚙', model: 'af_wiesel_tow', hp: 240, speed: 11, sight: 34, radius: 2.1, weapons: ['tow'], turnRate: 2.6, turretRate: 2.2, desc: 'Leichter Panzerjäger mit TOW-2.' });
veh('BW', 'af_bw_marder', { transport: 6, name: 'Marder 1A5', icon: '🚙', model: 'af_marder', hp: 540, speed: 9, sight: 36, radius: 3.1, weapons: ['af_mk20', 'af_milan'], turnRate: 2, turretRate: 2, desc: 'Schützenpanzer mit 20-mm-Kanone und MILAN.' });
veh('BW', 'af_bw_mungo', { tow: true, transport: 8, name: 'Mungo', icon: '🛻', model: 'af_mungo', hp: 280, speed: 11, sight: 32, radius: 2.3, weapons: ['af_mg3'], turnRate: 2.4, turretRate: 3, desc: 'Leichter Gelände-Transporter für Infanteriegruppen.' });
veh('BW', 'af_bw_wolf', { transport: 3, name: 'Wolf', icon: '🚙', model: 'af_wolf', hp: 220, speed: 13, sight: 32, radius: 2.2, weapons: ['af_mg3'], turnRate: 2.8, turretRate: 3, desc: 'Geländewagen (G-Klasse). Leicht gepanzert, MG auf Ringlafette.' });
veh('BW', 'af_bw_truck', { tow: true, transport: 10, name: 'MAN-Versorgungs-Lkw', icon: '🚚', model: 'af_truck', hp: 220, speed: 10, sight: 24, radius: 2.8, weapons: [], turnRate: 1.8, fuel: 1500, supply: { ...SUPPLY }, desc: 'Füllt Munition, Treibstoff und Material im Umkreis auf.' });
veh('BW', 'af_bw_pzh2000', { name: 'Panzerhaubitze 2000', icon: '💥', model: 'af_pzh2000', hp: 560, speed: 6.5, sight: 26, radius: 3.5, weapons: ['af_pzh155'], turnRate: 1.2, turretRate: 0.9, desc: 'Selbstfahrlafette 155 mm. Reichweite 240 m. Fähigkeit „Artilleriefeuer PzH 2000".' });
veh('BW', 'af_bw_buffel', { name: 'Bergepanzer Büffel', icon: '🛠️', model: 'af_buffel', hp: 700, speed: 8, sight: 28, radius: 3.2, weapons: [], turnRate: 1.5, repair: { rate: 0.03, radius: 12 }, desc: 'Repariert Fahrzeuge im Umkreis und setzt zerstörte Ketten instand.' });
air('BW', 'af_bw_ch53', { transport: 20, name: 'CH-53G (Transport)', icon: '🚁', model: 'af_ch53', hp: 480, speed: 12, sight: 44, radius: 5, weapons: [], alt: 20, turnRate: 1.1, desc: 'Schwerer Transporthubschrauber. Unbewaffnet, anfällig gegen Flugabwehr.' });
air('BW', 'af_bw_nh90', { transport: 10, name: 'NH90 (Medevac)', icon: '🚑', model: 'af_nh90', hp: 380, speed: 14, sight: 44, radius: 4.5, weapons: [], alt: 18, turnRate: 1.3, desc: 'Verwundetentransport. Fähigkeit „Medevac".' });
air('BW', 'af_bw_tiger', { name: 'Tiger UHT', icon: '🚁', model: 'af_tiger', hp: 540, speed: 14, sight: 46, radius: 4, weapons: ['af_hot3', 'af_ate30'], alt: 18, turnRate: 1.5, turretRate: 2, desc: 'Unterstützungshubschrauber mit HOT-3 und 30-mm-Kanone.' });
air('BW', 'af_bw_luna', { name: 'LUNA-Drohne', icon: '🛩️', model: 'af_luna', hp: 30, speed: 12, sight: 62, radius: 1.5, weapons: [], alt: 28, conceal: 0.5, desc: 'Aufklärungsdrohne. Unbewaffnet.' });
air('BW', 'af_bw_heron', { name: 'Heron-Drohne', icon: '🛩️', model: 'af_heron', hp: 60, speed: 11, sight: 80, radius: 2.5, weapons: [], alt: 40, conceal: 0.45, desc: 'Große Aufklärungsdrohne mit Langzeit-Sensor. Unbewaffnet.' });
air('BW', 'af_bw_jet', { name: 'Jet (Luftnahunterstützung)', icon: '✈️', model: 'af_jet', hp: 260, speed: 42, sight: 40, radius: 4, weapons: [], alt: 26, turnRate: 1.4, desc: 'Wird von der Fähigkeit „Luftnahunterstützung" gerufen.' });
// Feldlager (Qalat-Elemente): Strukturen, keine Pionierbauwerke
str('BW', 'af_camp_sandbag', { name: 'Sandsackstellung', icon: '🟫', model: 'af_camp_sandbag', hp: 380, sight: 32, radius: 2.6, weapons: ['af_mg4'], turretRate: 2.5, desc: 'MG-Stellung hinter Sandsäcken.' });
str('BW', 'af_camp_tower', { name: 'Wachturm', icon: '🗼', model: 'af_camp_tower', hp: 700, sight: 46, radius: 2.4, weapons: ['af_mg3'], turretRate: 2.5, desc: 'Erhöhter MG-Posten mit großer Sichtweite.' });
str('BW', 'af_camp_tent', { name: 'Feldlager-Zelt', icon: '⛺', model: 'af_camp_tent', hp: 450, sight: 12, radius: 5, weapons: [], noAutoTarget: true, desc: 'Mannschaftszelt.' });
str('BW', 'af_camp_medtent', { name: 'Sanitätszelt', icon: '⚕️', model: 'af_camp_medtent', hp: 450, sight: 12, radius: 5, weapons: [], noAutoTarget: true, medic: { rate: 3, radius: 14 }, desc: 'Heilt Infanterie im Umkreis.' });

// ======================= Taliban (TAL) =======================
inf('TAL', 'af_tal_fighter', { name: 'Kämpfer (AK)', icon: '🪖', weaponModel: 'rifle', hp: 66, speed: 4.2, sight: 32, weapons: ['af_ak', 'af_rgd5'], conceal: 0.4, desc: 'Leichte Infanterie, gut getarnt in Gelände und Ortschaft.' });
inf('TAL', 'af_tal_pkm', { name: 'PKM-Schütze', icon: '🔫', weaponModel: 'mg', hp: 70, speed: 3.7, sight: 32, weapons: ['af_pkm'], conceal: 0.35, desc: 'Unterstützungs-MG.' });
inf('TAL', 'af_tal_rpg', { name: 'RPG-Schütze', icon: '🚀', weaponModel: 'rpg', hp: 58, speed: 3.9, sight: 30, weapons: ['af_rpg', 'af_ak'], conceal: 0.4, desc: 'Panzerabwehr auf kurze Distanz.' });
inf('TAL', 'af_tal_sniper', { name: 'Scharfschütze (Dragunow)', icon: '🎯', weaponModel: 'sniper', hp: 50, speed: 4, sight: 46, weapons: ['af_svd'], conceal: 0.72, desc: 'Gut getarnt, große Sichtweite.' });
inf('TAL', 'af_tal_mortar', { name: 'Mörsertrupp (82 mm)', icon: '💥', weaponModel: 'mortar', hp: 60, speed: 3.4, sight: 30, weapons: ['af_mortar82', 'pistol'], conceal: 0.45, desc: 'Indirektes Feuer, Reichweite 130 m. Fähigkeit „Mörserfeuer".' });
inf('TAL', 'af_tal_ied', { name: 'IED-Leger', icon: '⛏️', weaponModel: 'ied', hp: 60, speed: 4, sight: 28, weapons: ['af_ak', 'af_rgd5', 'charge'], conceal: 0.6, engineer: { material: 4 }, desc: 'Legt versteckte Sprengfallen (als Minenfeld), räumt Minen. Für den Gegner unsichtbar bis zur Auslösung.' });
veh('TAL', 'af_tal_technical', { transport: 4, name: 'Technical (DShK)', icon: '🛻', model: 'af_technical', hp: 190, speed: 13, sight: 40, radius: 2.3, weapons: ['af_dshk'], turnRate: 3, turretRate: 3.5, airSight: 55, desc: 'Pickup mit schwerem MG. Schnell, aber verwundbar. Wirksam gegen Hubschrauber.' });
veh('TAL', 'af_tal_bike', { name: 'Motorrad-Späher', icon: '🏍️', model: 'af_bike', hp: 70, speed: 16, sight: 46, radius: 1.2, weapons: ['af_ak'], turnRate: 3.4, conceal: 0.4, desc: 'Schneller Späher mit Sturmgewehr.' });
veh('TAL', 'af_tal_pickup', { tow: true, transport: 6, name: 'Pickup (Transport)', icon: '🛻', model: 'af_pickup', hp: 170, speed: 13, sight: 34, radius: 2.3, weapons: [], turnRate: 3, desc: 'Ziviles Transportfahrzeug (Logistik-Platzhalter).' });
veh('TAL', 'af_tal_ural', { tow: true, transport: 12, name: 'Ural-Lkw (erbeutet)', icon: '🚚', model: 'af_ural', hp: 190, speed: 10, sight: 24, radius: 2.8, weapons: [], turnRate: 1.8, fuel: 1500, supply: { ...SUPPLY }, desc: 'Erbeuteter Lkw mit Nachschubvorrat.' });
str('TAL', 'af_ied', { name: 'Sprengfalle (IED)', icon: '💣', model: 'af_ied', hp: 60, sight: 0, radius: 2.2, weapons: [], noAutoTarget: true, hidden: true, build: { cost: 1, time: 6, w: 3, d: 3, mines: 1, hidden: true }, desc: 'Versteckte Sprengfalle. Per placeIED() oder Missionsskript; nur für den Besitzer sichtbar, bis sie auslöst.' });

// V3-M1: Anführer der Taliban (Führungsaura wie Offiziere)
inf('TAL', 'af_tal_commander', { name: 'Kommandeur', icon: '⭐', weaponModel: 'rifle', hp: 66, speed: 4.2, sight: 30, weapons: ['af_ak', 'af_rgd5'], conceal: 0.45, officer: true, observer: OBS, desc: 'Anführer: Führungsaura 30 m (Treffer, Nachladen, Moral), Fernglas im Stand. Fällt er, wankt die Moral.' });

// ======================= Sowjetarmee (SA) =======================
inf('SA', 'af_sa_rifle', { name: 'Mot.-Schützen (AK-74)', icon: '🪖', weaponModel: 'rifle', hp: 72, speed: 4.2, sight: 33, weapons: ['af_ak74', 'af_f1', 'af_gp25'], conceal: 0.33, desc: 'Motorisierte Schützen.' });
inf('SA', 'af_sa_pk', { name: 'PK-Schütze', icon: '🔫', weaponModel: 'mg', hp: 76, speed: 3.8, sight: 33, weapons: ['af_pk'], conceal: 0.3, desc: 'Gruppen-MG.' });
inf('SA', 'af_sa_rpg', { name: 'RPG-Trupp', icon: '🚀', weaponModel: 'rpg', hp: 62, speed: 3.8, sight: 30, weapons: ['af_rpg', 'af_ak74'], conceal: 0.35, desc: 'Panzerabwehr auf kurze Distanz.' });
inf('SA', 'af_sa_spg9', { name: 'SPG-9-Trupp', icon: '🚀', weaponModel: 'spg9', hp: 62, speed: 3.3, sight: 32, weapons: ['af_spg9', 'af_ak74'], conceal: 0.35, desc: 'Rückstoßfreies Geschütz, größere Reichweite.' });
inf('SA', 'af_sa_sniper', { name: 'Scharfschütze (SWD)', icon: '🎯', weaponModel: 'sniper', hp: 50, speed: 3.9, sight: 46, weapons: ['af_svd'], conceal: 0.68, desc: 'Gut getarnt, große Sichtweite.' });
inf('SA', 'af_sa_vdv', { name: 'Fallschirmjäger (WDW)', icon: '🪂', weaponModel: 'vdv', hp: 105, speed: 4.7, sight: 38, weapons: ['af_ak74', 'af_f1', 'af_gp25'], conceal: 0.42, desc: 'Luftlandetruppen: zäh und schnell.' });
inf('SA', 'af_sa_engineer', { name: 'Pionier', icon: '⛏️', weaponModel: 'engineer', hp: 70, speed: 3.9, sight: 30, weapons: ['af_ak74', 'af_f1', 'charge'], conceal: 0.3, engineer: { material: 4 }, desc: 'Baut Sperren, Sandsäcke, Gräben und Minenfelder, räumt Minen.' });
inf('SA', 'af_sa_medic', { name: 'Sanitäter', icon: '⚕️', weaponModel: 'medic', hp: 60, speed: 4, sight: 28, weapons: ['pistol'], conceal: 0.3, medic: { rate: 2.5, radius: 10 }, desc: 'Heilt Infanterie im Umkreis.' });
inf('SA', 'af_sa_officer', { name: 'Offizier', icon: '🔭', weaponModel: 'jtac', hp: 58, speed: 4, sight: 24, weapons: ['pistol'], conceal: 0.5, observer: OBS, officer: true, desc: 'Offizier: Führungsaura 30 m (Treffer, Nachladen, Moral), Fernglas: weite Sicht im Kegel.' });
veh('SA', 'af_sa_bmp1', { transport: 8, name: 'BMP-1', icon: '🚙', model: 'af_bmp', hp: 400, speed: 9, sight: 32, radius: 3, weapons: ['af_2a28', 'af_malyutka', 'coaxRU'], turnRate: 2, turretRate: 2, desc: 'Schützenpanzer mit 73-mm-Kanone und Malyutka.' });
veh('SA', 'af_sa_bmp2', { transport: 7, name: 'BMP-2', icon: '🚙', model: 'af_bmp2', hp: 430, speed: 9, sight: 33, radius: 3, weapons: ['ac30', 'af_konkurs'], turnRate: 2, turretRate: 2.2, desc: 'Schützenpanzer mit 30-mm-Maschinenkanone und Konkurs.' });
veh('SA', 'af_sa_btr70', { transport: 8, name: 'BTR-70', icon: '🚙', model: 'af_btr70', hp: 310, speed: 11, sight: 32, radius: 3, weapons: ['kpvt'], turnRate: 2, turretRate: 2, desc: 'Radschützenpanzer, 14,5-mm-KPWT.' });
veh('SA', 'af_sa_btr80', { transport: 8, name: 'BTR-80', icon: '🚙', model: 'af_btr80', hp: 330, speed: 11, sight: 32, radius: 3, weapons: ['kpvt', 'coaxRU'], turnRate: 2, turretRate: 2, desc: 'Radschützenpanzer, 14,5-mm-KPWT und Koax-MG.' });
veh('SA', 'af_sa_bmd1', { transport: 5, name: 'BMD-1', icon: '🪂', model: 'af_bmd', hp: 340, speed: 10, sight: 32, radius: 2.8, weapons: ['af_2a28', 'coaxRU'], turnRate: 2.2, turretRate: 2, desc: 'Luftlande-Schützenpanzer der WDW.' });
veh('SA', 'af_sa_t55', { name: 'T-55', icon: '🛡️', model: 'af_t55', hp: 780, armor: 'heavy', speed: 7.5, sight: 32, radius: 3, weapons: ['af_d10', 'coaxRU'], turnRate: 1.4, turretRate: 1.1, desc: 'Kampfpanzer mit 100-mm-Kanone.' });
veh('SA', 'af_sa_t62', { name: 'T-62', icon: '🛡️', model: 'af_t62', hp: 830, armor: 'heavy', speed: 7.5, sight: 33, radius: 3.1, weapons: ['af_u5ts', 'coaxRU'], turnRate: 1.4, turretRate: 1.2, desc: 'Kampfpanzer mit 115-mm-Glattrohr.' });
veh('SA', 'af_sa_shilka', { name: 'ZSU-23-4 Schilka', icon: '🎯', model: 'af_shilka', hp: 400, speed: 8, sight: 42, radius: 3, weapons: ['af_zu23x4'], turnRate: 1.8, turretRate: 3, airSight: 70, desc: 'Flakpanzer. Vernichtet Flugziele, wirksam auch gegen Infanterie in Stellungen.' });
veh('SA', 'af_sa_bm21', { name: 'BM-21 Grad', icon: '🎆', model: 'af_bm21', hp: 300, speed: 9, sight: 26, radius: 3.2, weapons: ['af_grad'], turnRate: 1.6, turretRate: 0.8, desc: 'Mehrfachraketenwerfer. Fähigkeit „Grad-Salve".' });
veh('SA', 'af_sa_2s1', { name: '2S1 Gwosdika', icon: '💥', model: 'af_2s1', hp: 480, speed: 7, sight: 26, radius: 3.2, weapons: ['af_d30'], turnRate: 1.3, turretRate: 1, desc: 'Selbstfahrhaubitze 122 mm.' });
veh('SA', 'af_sa_ural', { tow: true, transport: 12, name: 'Ural-Versorgung', icon: '🚚', model: 'af_ural', hp: 220, speed: 10, sight: 24, radius: 2.8, weapons: [], turnRate: 1.8, fuel: 1500, supply: { ...SUPPLY }, desc: 'Füllt Munition, Treibstoff und Material im Umkreis auf.' });
veh('SA', 'af_sa_uaz', { tow: true, transport: 4, name: 'UAZ-469', icon: '🚙', model: 'af_uaz', hp: 200, speed: 13, sight: 36, radius: 2.2, weapons: ['af_pk', 'af_ags17'], turnRate: 2.8, turretRate: 3, desc: 'Leichter Geländewagen mit PK und AGS-17.' });
air('SA', 'af_sa_hind', { transport: 8, name: 'Mi-24 Hind', icon: '🚁', model: 'af_hind', hp: 520, speed: 14, sight: 46, radius: 4.5, weapons: ['af_yakb', 'af_s8', 'af_shturm'], alt: 18, turnRate: 1.3, turretRate: 2, desc: 'Kampfhubschrauber. Stark gegen Boden, verwundbar für Stinger und DShK.' });
air('SA', 'af_sa_mi8', { transport: 16, name: 'Mi-8 (Transport)', icon: '🚁', model: 'af_mi8', hp: 380, speed: 12, sight: 40, radius: 4.8, weapons: [], alt: 18, turnRate: 1.2, desc: 'Transporthubschrauber, unbewaffnet.' });
air('SA', 'af_sa_su25', { name: 'Su-25 Gratsch', icon: '✈️', model: 'af_su25', hp: 300, speed: 42, sight: 40, radius: 4, weapons: [], alt: 26, turnRate: 1.4, desc: 'Wird von der Fähigkeit „Su-25-Angriff" gerufen.' });

// ======================= Mudschaheddin (MUJ) =======================
inf('MUJ', 'af_muj_rifle', { name: 'Kämpfer (Lee-Enfield)', icon: '🪖', weaponModel: 'enfield', hp: 62, speed: 4.3, sight: 32, weapons: ['af_enfield', 'af_rgd5'], conceal: 0.45, desc: 'Ortskundige Kämpfer mit Repetiergewehr: genau, aber langsam feuernd.' });
inf('MUJ', 'af_muj_ak', { name: 'Kämpfer (AK)', icon: '🪖', weaponModel: 'rifle', hp: 65, speed: 4.2, sight: 32, weapons: ['af_ak', 'af_rgd5', 'af_gp25'], conceal: 0.42, desc: 'Mit erbeuteten Sturmgewehren ausgerüstet.' });
inf('MUJ', 'af_muj_rpg', { name: 'RPG-Schütze', icon: '🚀', weaponModel: 'rpg', hp: 58, speed: 3.9, sight: 30, weapons: ['af_rpg', 'af_enfield'], conceal: 0.45, desc: 'Panzerabwehr auf kurze Distanz.' });
inf('MUJ', 'af_muj_stinger', { name: 'Stinger-Team (ab 1986)', icon: '🎯', weaponModel: 'stinger', hp: 58, speed: 3.7, sight: 34, weapons: ['stinger', 'af_ak'], conceal: 0.45, airSight: 55, desc: 'Schultergestützte Flugabwehr gegen Hubschrauber und Jets.' });
inf('MUJ', 'af_muj_mortar', { name: 'Mörsertrupp', icon: '💥', weaponModel: 'mortar', hp: 58, speed: 3.4, sight: 30, weapons: ['af_mortar82', 'pistol'], conceal: 0.5, desc: 'Indirektes Feuer, Reichweite 130 m. Fähigkeit „Mörserfeuer".' });
str('MUJ', 'af_muj_dshk', { name: 'DShK-Stellung', icon: '🔫', model: 'af_dshk_nest', hp: 520, sight: 34, radius: 2.8, weapons: ['af_dshk'], turretRate: 2.2, desc: 'Geschütztes schweres MG, wirksam gegen Hubschrauber und Infanterie.' });
veh('MUJ', 'af_muj_btr', { transport: 8, name: 'BTR (erbeutet)', icon: '🚙', model: 'af_btr70', hp: 300, speed: 10, sight: 30, radius: 3, weapons: ['kpvt'], turnRate: 2, turretRate: 2, desc: 'Erbeuteter Radschützenpanzer.' });
veh('MUJ', 'af_muj_zpu1', { towable: true, name: 'ZPU-1', icon: '🎯', model: 'af_zpu1', hp: 160, speed: 4.5, sight: 34, radius: 2.0, weapons: ['af_zpu1'], turnRate: 1.5, turretRate: 3, airSight: 60, desc: 'Leichte Fliegerabwehr 14,5 mm (gezogen). Auch gegen Bodenziele.' });
veh('MUJ', 'af_muj_zu23', { towable: true, name: 'ZU-23', icon: '🎯', model: 'af_zu23', hp: 200, speed: 4.5, sight: 36, radius: 2.4, weapons: ['af_zu23'], turnRate: 1.4, turretRate: 3, airSight: 68, desc: 'Zwillings-Flak 23 mm (gezogen). Gefährlich für Hubschrauber.' });
veh('MUJ', 'af_muj_caravan', { name: 'Packtier-Karawane', icon: '🐪', model: 'af_caravan', hp: 130, speed: 4.4, sight: 24, radius: 2.4, weapons: [], turnRate: 1.6, fuel: 1e7, supply: { ammo: 500, fuel: 600, material: 3, radius: 10 }, desc: 'Esel und Kamel mit kleinem Nachschubvorrat an Munition.' });

// V3-M1: Anführer der Mudschaheddin (Führungsaura wie Offiziere)
inf('MUJ', 'af_muj_commander', { name: 'Kommandant', icon: '⭐', weaponModel: 'rifle', hp: 64, speed: 4.2, sight: 30, weapons: ['af_ak', 'af_rgd5'], conceal: 0.45, officer: true, observer: OBS, desc: 'Anführer: Führungsaura 30 m (Treffer, Nachladen, Moral), Fernglas im Stand. Fällt er, wankt die Moral.' });

// ======================= Feldbefestigungen (Pionierbauten, build-Feld wie tanktrap/sandbag/trench/minefield) =======================
// Platzierung per placeFortification() oder durch Pioniere (Baumenü je Fraktion über registerBuildKinds, V3-M1).
str('BW', 'af_hesco', { name: 'HESCO-Wall', icon: '🧱', model: 'af_hesco', hp: 1300, sight: 0, radius: 2.8, weapons: [], noAutoTarget: true, build: { cost: 3, time: 22, w: 5, d: 1.6, cover: 0.6, conceal: 0.2, blocks: true }, desc: 'Gefüllte Schutzwand (Feldlager). Starke Deckung (Schaden −60 %), sperrt Fahrzeuge.' });
str('BW', 'af_concertina', { name: 'NATO-Draht', icon: '〰️', model: 'af_concertina', hp: 120, sight: 0, radius: 3, weapons: [], noAutoTarget: true, build: { cost: 1, time: 8, w: 6, d: 1.4, blocksInfantry: true }, blocksInfantry: true, desc: 'Drahtrolle. Sperrt Infanterie (Logik im Kern folgt).' });
str('ALL', 'af_trench', { name: 'Kampfstand / Graben', icon: '⛏️', model: 'af_trench', hp: 500, sight: 0, radius: 3.2, weapons: [], noAutoTarget: true, build: { cost: 2, time: 18, w: 6, d: 2.4, cover: 0.6, conceal: 0.5 }, desc: 'Schützengraben mit Sandsackbrüstung (Schaden −60 %).' });
str('ALL', 'af_foxhole', { name: 'Schützenloch', icon: '🕳️', model: 'af_foxhole', hp: 120, sight: 0, radius: 1.4, weapons: [], noAutoTarget: true, selfDig: true, build: { cost: 1, time: 6, w: 1.8, d: 1.8, cover: 0.5, conceal: 0.5, selfDig: true }, desc: 'Von der Infanterie selbst gegraben. Deckung (Schaden −50 %).' });
str('MUJ', 'af_sangar', { name: 'Sangar (Steinstellung)', icon: '🪨', model: 'af_sangar', hp: 700, sight: 0, radius: 2.6, weapons: [], noAutoTarget: true, build: { cost: 2, time: 16, w: 4.5, d: 3.2, cover: 0.55, conceal: 0.4 }, desc: 'Steinwall-Stellung der Mudschaheddin. Gute Deckung und Tarnung.' });

registerUnitTypes(T);
export const AF_TYPES = T;
// Pionier-Baumenü der Epoche je Fraktion (V3-M1)
registerBuildKinds(['af_trench', 'af_foxhole'], { era: 'afghan' });
registerBuildKinds(['af_hesco', 'af_concertina'], { era: 'afghan', factions: ['BW'] });
registerBuildKinds(['af_ied'], { era: 'afghan', factions: ['TAL'] });
registerBuildKinds(['af_sangar'], { era: 'afghan', factions: ['MUJ'] });

/** Befestigung/Pionierbau fertig platzieren (progress 1). kind: af_hesco | af_concertina | af_trench | af_foxhole | af_sangar. */
export function placeFortification(game, kind, team, x, z, rot = 0, opts = {}) {
  const d = T[kind].build;
  return game.spawn(kind, team, x, z, { noBlock: true, rot, build: { progress: 1, time: d.time, kind }, ...opts });
}

/** Versteckte Sprengfalle (IED) per Skript setzen. Nur für das Besitzer-Team sichtbar, bis sie auslöst. */
export function placeIED(game, team, x, z, opts = {}) {
  return game.spawn('af_ied', team, x, z, { noBlock: true, build: { progress: 1, time: 1, kind: 'af_ied' }, mines: opts.mines ?? 1, ...opts });
}

const k = (fac, ...keys) => keys.filter((x) => T[x] && (T[x].faction === fac || T[x].faction === 'ALL'));
export const ROSTERS = {
  BW: {
    infantry: k('BW', 'af_bw_rifle', 'af_bw_mg', 'af_bw_sniper', 'af_bw_at', 'af_bw_milan', 'af_bw_engineer', 'af_bw_medic', 'af_bw_jtac', 'af_bw_para'),
    armor: k('BW', 'af_bw_dingo', 'af_bw_eagle', 'af_bw_fennek', 'af_bw_wiesel_mk', 'af_bw_wiesel_tow', 'af_bw_marder', 'af_bw_mungo', 'af_bw_wolf'),
    support: k('BW', 'af_bw_pzh2000', 'af_bw_tiger', 'af_bw_luna', 'af_bw_heron', 'af_bw_jet', 'af_bw_ch53', 'af_bw_nh90', 'af_camp_sandbag', 'af_hesco', 'af_concertina', 'af_trench', 'af_foxhole', 'af_camp_tower', 'af_camp_tent', 'af_camp_medtent'),
    logistics: k('BW', 'af_bw_truck', 'af_bw_buffel'),
  },
  TAL: {
    infantry: k('TAL', 'af_tal_fighter', 'af_tal_pkm', 'af_tal_rpg', 'af_tal_sniper', 'af_tal_mortar', 'af_tal_ied', 'af_tal_commander'),
    armor: k('TAL', 'af_tal_technical', 'af_tal_bike'),
    support: k('TAL', 'af_ied', 'af_trench', 'af_foxhole'),
    logistics: k('TAL', 'af_tal_pickup', 'af_tal_ural'),
  },
  SA: {
    infantry: k('SA', 'af_sa_rifle', 'af_sa_pk', 'af_sa_rpg', 'af_sa_spg9', 'af_sa_sniper', 'af_sa_vdv', 'af_sa_engineer', 'af_sa_medic', 'af_sa_officer'),
    armor: k('SA', 'af_sa_bmp1', 'af_sa_bmp2', 'af_sa_btr70', 'af_sa_btr80', 'af_sa_bmd1', 'af_sa_t55', 'af_sa_t62', 'af_sa_uaz'),
    support: k('SA', 'af_trench', 'af_foxhole', 'af_sa_shilka', 'af_sa_bm21', 'af_sa_2s1', 'af_sa_hind', 'af_sa_mi8', 'af_sa_su25'),
    logistics: k('SA', 'af_sa_ural'),
  },
  MUJ: {
    infantry: k('MUJ', 'af_muj_rifle', 'af_muj_ak', 'af_muj_rpg', 'af_muj_stinger', 'af_muj_mortar', 'af_muj_commander'),
    armor: k('MUJ', 'af_muj_btr'),
    support: k('MUJ', 'af_muj_dshk', 'af_muj_zpu1', 'af_muj_zu23', 'af_sangar', 'af_trench', 'af_foxhole'),
    logistics: k('MUJ', 'af_muj_caravan'),
  },
};
