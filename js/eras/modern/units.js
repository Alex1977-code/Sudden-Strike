// Einheitentypen der Epoche „modern 2024–2026“ (Schlüssel m_*, era:'modern', faction:'UA'|'RU').
// Zusätzliche (dokumentierte) Typfelder, seit V3-M1 im Kern ausgewertet (unit.js, game.js, logistics.js):
//   ewImmune:true    – Störsender (Fähigkeit „EloKa-Störsender“ / game.jamZones) und EloKa-Waffen (weapon.ew) wirken nicht
//                      (Glasfaser-Drohnen). Kern: Accessor Unit.jammed.
//   droneResist:0..1 – Anteil, um den Schaden durch Kamikaze-Waffen (kind 'kamikaze': FPV, Lancet, Molniya …) sinkt
//                      (Schildkröten-Panzer mit Dachkäfig). Kern: game.applyDamage.
//   unmanned:true    – Bodenroboter: keine Besatzung, steigt im Gefecht nicht aus (Logistics.canBail/bailOut).
//   tether:m         – Kabellänge Glasfaser-Drohne (Meter): maximale Entfernung zum Operator, begrenzt in abilities.js.
//   role             – Zuordnung zu den Gefechts-Rollen (infantry|armor|support|logistics|drones), siehe rosters.js.
// V3-SL Satellitennetz (js/game/satnet.js): satTerminal:true + satRadius (fester Terminal), satlink:true|'UA'|'RU'
//   (mobiler Uplink, optional nur für dieses Team; je Einheit auch u.satlink), satJam:m (stört feindliche Terminals im Umkreis).
import { registerUnitTypes, UNIT_TYPES } from '../../game/unitTypes.js';
import './weapons.js';

const T = {};
const def = (fac, key, d) => { T[key] = { era: 'modern', faction: fac, ...d }; };
const inf = (fac, key, d) => def(fac, key, { cls: 'inf', armor: 'soft', radius: 0.8, ...d });
const veh = (fac, key, d) => def(fac, key, { cls: 'veh', armor: 'light', ...d });
const tank = (fac, key, d) => def(fac, key, { cls: 'veh', armor: 'heavy', ...d });
const air = (fac, key, d) => def(fac, key, { cls: 'air', armor: 'air', ...d });
const nav = (fac, key, d) => def(fac, key, { cls: 'naval', armor: 'light', ...d });

// ======================= Ukraine =======================
// Kampfpanzer
tank('UA', 'm_abrams', { name: 'M1A1 Abrams', icon: '🛡️', model: 'm_abrams', role: 'armor', hp: 1100, speed: 8.2, sight: 38, radius: 3.3, weapons: ['tank120', 'coax'], turnRate: 1.5, turretRate: 1.4, fuel: 420, desc: 'US-Kampfpanzer mit Gasturbine und flachem Turm. Stärkste Frontpanzerung der Ukraine, hoher Spritverbrauch.' });
tank('UA', 'm_leo1', { name: 'Leopard 1A5', icon: '🛡️', model: 'm_leo1', role: 'armor', hp: 800, speed: 9.5, sight: 36, radius: 3.1, weapons: ['m_tank105', 'coax'], turnRate: 1.7, turretRate: 1.5, desc: 'Älterer, schneller Kampfpanzer mit 105-mm-Kanone. Leichter gepanzert als der Leopard 2.' });
tank('UA', 'm_t64', { name: 'T-64BV', icon: '🛡️', model: 'm_t64', role: 'armor', hp: 700, speed: 8, sight: 34, radius: 3, weapons: ['tank125', 'coax'], turnRate: 1.5, turretRate: 1.2, desc: 'Bewährter ukrainischer Kampfpanzer mit Reaktivpanzerung. Günstig und zahlreich.' });
// Schützen-/Radpanzer
veh('UA', 'm_cv90', { transport: 6, name: 'CV90', icon: '🚙', model: 'm_cv90', role: 'armor', hp: 560, speed: 10, sight: 38, radius: 3, weapons: ['m_ac40', 'coax'], turnRate: 2, turretRate: 2.2, airSight: 50, desc: 'Schwedischer Schützenpanzer mit 40-mm-Bofors. Schnell, gut gegen leichte Ziele und Drohnen.' });
veh('UA', 'm_marder', { transport: 6, name: 'Marder 1A3', icon: '🚙', model: 'm_marder', role: 'armor', hp: 520, speed: 9.3, sight: 36, radius: 3, weapons: ['m_ac20', 'm_milan'], turnRate: 2, turretRate: 2, desc: 'Deutscher Schützenpanzer mit 20-mm-Kanone und MILAN.' });
veh('UA', 'm_bmp2', { transport: 7, name: 'BMP-2 (ukr.)', icon: '🚙', model: 'bmp', role: 'armor', hp: 440, speed: 9, sight: 34, radius: 3, weapons: ['ac30', 'm_konkurs'], turnRate: 2, turretRate: 2, desc: 'Ukrainischer Bestand-SPz mit 30-mm-Kanone und Konkurs. Zahlreich, geringer Schutz.' });
veh('UA', 'm_stryker', { transport: 9, name: 'Stryker', icon: '🚙', model: 'm_stryker', role: 'armor', hp: 430, speed: 12, sight: 36, radius: 3, weapons: ['hmg'], turnRate: 2.2, turretRate: 3, airSight: 55, desc: 'Radschützenpanzer 8×8 mit .50-MG-Waffenstation und Gitterschutz. Schnell, Flugabwehr-tauglich.' });
veh('UA', 'm_senator', { transport: 8, name: 'Roshel Senator', icon: '🛻', model: 'm_senator', role: 'armor', hp: 320, speed: 12.5, sight: 34, radius: 2.5, weapons: ['mg'], turnRate: 2.6, turretRate: 3, desc: 'Leicht gepanzertes Radfahrzeug (4×4) mit Waffenstation. Schnelle Aufklärung und Verfolgung.' });
// Artillerie
veh('UA', 'm_pzh2000', { name: 'PzH 2000', icon: '💥', model: 'm_pzh2000', role: 'support', hp: 640, speed: 6.5, sight: 26, radius: 3.6, weapons: ['m_pzh155'], turnRate: 1.2, turretRate: 0.9, desc: 'Deutsche Panzerhaubitze 155 mm. Reichweite 245 m, sehr hohe Feuerrate.' });
veh('UA', 'm_caesar', { name: 'CAESAR', icon: '💥', model: 'm_caesar', role: 'support', hp: 330, speed: 11, sight: 26, radius: 3.2, weapons: ['m_caesar155'], turnRate: 1.5, turretRate: 1.2, desc: 'Radhaubitze 155 mm auf Lkw – schießt und wechselt schnell die Stellung, kaum gepanzert.' });
veh('UA', 'm_bohdana', { name: 'Bohdana', icon: '💥', model: 'm_bohdana', role: 'support', hp: 360, speed: 10.5, sight: 26, radius: 3.3, weapons: ['m_bohdana155'], turnRate: 1.4, turretRate: 1.1, desc: 'Ukrainische 155-mm-Radhaubitze auf Tatra 8×8.' });
veh('UA', 'm_archer', { name: 'Archer', icon: '💥', model: 'm_archer', role: 'support', hp: 390, speed: 10, sight: 26, radius: 3.4, weapons: ['m_archer155'], turnRate: 1.4, turretRate: 1.2, desc: 'Schwedische 155-mm-Radhaubitze mit Ladeautomat, geschützter Kabine. Shoot-and-scoot.' });
veh('UA', 'm_krab', { name: 'AHS Krab', icon: '💥', model: 'm_krab', role: 'support', hp: 600, speed: 6.3, sight: 26, radius: 3.5, weapons: ['m_krab155'], turnRate: 1.2, turretRate: 0.9, desc: 'Polnische Kettenhaubitze 155 mm.' });
veh('UA', 'm_neptun_tel', { name: 'Neptun-Werfer', icon: '🚀', model: 'm_neptun_tel', role: 'support', hp: 300, speed: 8.5, sight: 28, radius: 3.4, weapons: [], turnRate: 1.3, desc: 'Küsten-/Landzielraketen-Werfer – Voraussetzung für die Fähigkeit „Neptun-Marschflugkörper“.' });
// Flugabwehr
veh('UA', 'm_nasams', { name: 'NASAMS', icon: '🛰️', model: 'm_nasams', role: 'support', hp: 290, speed: 8.5, sight: 30, radius: 3.4, weapons: ['m_amraam'], turnRate: 1.4, turretRate: 2, airSight: 100, desc: 'Mittelstreckenflugabwehr (AMRAAM-ER, 110 m) gegen Drohnen und Marschflugkörper. Schwach gegen Hyperschall.' });
veh('UA', 'm_skynex', { name: 'Skynex', icon: '🎯', model: 'm_skynex', role: 'support', hp: 360, speed: 8.2, sight: 38, radius: 3.2, weapons: ['m_ahead'], turnRate: 1.6, turretRate: 3, airSight: 80, desc: 'Moderne Flak-Nachfolgerin des Gepard: 35-mm-AHEAD mit Radar. Sehr stark gegen Drohnen.' });
veh('UA', 'm_interceptor', { name: 'Abfangdrohnen-Trupp', icon: '🛻', model: 'm_interceptor', role: 'support', hp: 190, speed: 13, sight: 40, radius: 2.3, weapons: ['m_interceptor', 'hmg'], turnRate: 3, turretRate: 4, airSight: 70, desc: 'Mobiles Pick-up-Team mit Abfang-FPV gegen Shahed-Drohnen (Reichweite 46 m, 90 % gegen Drohnen).' });
// Drohnen
air('UA', 'm_leleka', { name: 'Leleka-10', icon: '🛩️', model: 'recon_wing', role: 'drones', hp: 35, speed: 12, sight: 60, radius: 1.5, weapons: [], alt: 28, conceal: 0.5, desc: 'Ukrainische Aufklärungsdrohne. Deckt den Nebel des Krieges auf. Unbewaffnet.' });
air('UA', 'm_vampire', { name: 'Bomber-Drohne „Vampire“', icon: '🛸', model: 'm_vampire', role: 'drones', hp: 70, speed: 7, sight: 34, radius: 2, weapons: ['m_vampire_bomb'], alt: 14, conceal: 0.7, turnRate: 1.4, desc: 'Schwere Hexakopter-Drohne (Baba Jaga) mit Nachtsicht – wirft Bomben. Kreist über dem Einsatzgebiet, schwer zu entdecken.' });
air('UA', 'm_fiberfpv', { name: 'Glasfaser-FPV', icon: '🧵', model: 'm_fiberfpv', role: 'drones', hp: 12, speed: 21, sight: 28, radius: 1, weapons: ['m_fiberfpv'], alt: 8, lifetime: 55, kamikaze: true, conceal: 0.6, ewImmune: true, tether: 55, desc: 'FPV-Drohne am Glasfaserkabel: immun gegen Störsender, aber nur 55 m vom Operator entfernt einsetzbar.' });
nav('UA', 'm_magura5', { name: 'Magura V5', icon: '🚤', model: 'seadrone', role: 'drones', hp: 85, speed: 18, sight: 36, radius: 2, weapons: ['seadrone'], kamikaze: true, conceal: 0.6, turnRate: 1.8, desc: 'Unbemanntes Sprengboot, größere Ladung und Reichweite.' });
nav('UA', 'm_magura7', { name: 'Magura V7', icon: '🚤', model: 'm_magura7', role: 'drones', hp: 110, speed: 15, sight: 38, radius: 2.2, weapons: ['m_magura_aam'], turnRate: 1.8, turretRate: 3, airSight: 50, conceal: 0.5, desc: 'Seedrohne mit Luftabwehr-Raketen (R-73) – jagt Hubschrauber und Drohnen auf See.' });
veh('UA', 'm_ugv_mg', { name: 'UGV Themis (MG)', icon: '🤖', model: 'm_ugv_mg', role: 'drones', hp: 170, speed: 6, sight: 30, radius: 1.5, weapons: ['m_ugv_mg'], turnRate: 2.4, turretRate: 3, fuel: 480, unmanned: true, conceal: 0.5, desc: 'Ferngesteuerter Kettenroboter mit MG. Hält Gräben und Wege ohne Besatzung.' });
veh('UA', 'm_ugv_kami', { name: 'Kamikaze-UGV', icon: '🤖', model: 'm_ugv_kami', role: 'drones', hp: 120, speed: 6.5, sight: 28, radius: 1.4, weapons: ['m_ugv_charge'], turnRate: 2.4, kamikaze: true, fuel: 300, unmanned: true, conceal: 0.5, desc: 'Sprengstoff-Roboter. Fährt in Befestigungen und Fahrzeuge.' });
veh('UA', 'm_ugv_log', { name: 'Logistik-UGV', icon: '🤖', model: 'm_ugv_log', role: 'logistics', hp: 190, speed: 6.5, sight: 24, radius: 1.8, weapons: [], turnRate: 2, fuel: 900, unmanned: true, supply: { ammo: 500, fuel: 900, material: 4, radius: 12 }, desc: 'Unbemannter Nachschubträger: versorgt Einheiten im Umkreis von 12 m mit Munition und Treibstoff.' });
// Infanterie
inf('UA', 'm_dronehunter', { name: 'Drohnenabwehr-Trupp', icon: '📡', model: 'm_dronehunter', role: 'infantry', hp: 65, speed: 4.2, sight: 34, weapons: ['m_ewrifle', 'm_shotgun'], conceal: 0.35, airSight: 48, desc: 'Schrotflinte und EloKa-Gewehr gegen FPV- und Aufklärungsdrohnen. Der EloKa-Strahl wirkt nicht gegen Glasfaser-Drohnen.' });
inf('UA', 'm_fibreop', { name: 'Glasfaser-FPV-Operator', icon: '🎮', model: 'm_fibreop', role: 'infantry', hp: 55, speed: 4, sight: 32, weapons: ['rifle'], conceal: 0.5, desc: 'Startet störsichere Glasfaser-FPV (Fähigkeit „Glasfaser-FPV“, 55 m Kabel). Schützen!' });

// ======================= Russland =======================
tank('RU', 'm_t80', { name: 'T-80BVM', icon: '🛡️', model: 'm_t80', role: 'armor', hp: 1050, speed: 8.4, sight: 38, radius: 3.1, weapons: ['m_tank125', 'coaxRU'], turnRate: 1.5, turretRate: 1.2, fuel: 400, desc: 'Gasturbinen-Kampfpanzer mit Relikt-Reaktivpanzerung. Schnell, durstig.' });
tank('RU', 'm_turtle', { name: 'T-72B3M „Schildkröte“', icon: '🐢', model: 'm_turtle', role: 'armor', hp: 950, speed: 6.5, sight: 36, radius: 3.2, weapons: ['m_tank125', 'coaxRU'], turnRate: 1.2, turretRate: 1.0, droneResist: 0.7, desc: 'Panzer mit Käfig über Turm und Wanne gegen FPV-Drohnen (−70 % Schaden durch Kamikaze-Drohnen). Langsam und schwerfällig.' });
veh('RU', 'm_bmp3', { transport: 7, name: 'BMP-3', icon: '🚙', model: 'm_bmp3', role: 'armor', hp: 580, speed: 9.5, sight: 35, radius: 3, weapons: ['ac30', 'm_bmp3gun'], turnRate: 2, turretRate: 2, desc: 'Schützenpanzer mit 100-mm-Kanone und 30-mm-Maschinenkanone. Starke Feuerkraft gegen weiche Ziele.' });
veh('RU', 'm_mtlb', { transport: 10, tow: true, name: 'MT-LB (Kampfaufbau)', icon: '🚙', model: 'm_mtlb', role: 'armor', hp: 340, speed: 9.5, sight: 30, radius: 3, weapons: ['kpvt', 'mgRU'], turnRate: 2, turretRate: 2, desc: 'Improvisiert aufgerüsteter Kettenschlepper mit Gitterschutz. Billig, wendig, schwach gepanzert.' });
veh('RU', 'm_2s7', { name: '2S7 Pion', icon: '💥', model: 'm_2s7', role: 'support', hp: 560, speed: 5.5, sight: 26, radius: 3.7, weapons: ['m_pion203'], turnRate: 1.0, turretRate: 0.7, desc: 'Schwere 203-mm-Kanone. Reichweite 300 m, verheerende Wirkung, sehr langsames Nachladen.' });
veh('RU', 'm_tos1a', { name: 'TOS-1A', icon: '🔥', model: 'm_tos1a', role: 'support', hp: 560, speed: 7, sight: 28, radius: 3.5, weapons: ['m_tos1a'], turnRate: 1.3, turretRate: 0.9, desc: 'Thermobarischer Raketenwerfer (24 Rohre) auf T-72-Fahrgestell. Reichweite nur 62 m, vernichtend gegen Infanterie und Stellungen.' });
veh('RU', 'm_iskander_tel', { name: 'Iskander-M Werfer', icon: '🚀', model: 'm_iskander_tel', role: 'support', hp: 320, speed: 8.5, sight: 28, radius: 3.5, weapons: [], turnRate: 1.2, desc: 'Ballistischer Raketenwerfer 9K720 – Voraussetzung für die Fähigkeit „Iskander-M-Schlag“.' });
veh('RU', 'm_tor', { name: 'Tor-M2', icon: '📡', model: 'm_tor', role: 'support', hp: 340, speed: 8.5, sight: 34, radius: 3.2, weapons: ['m_tor'], turnRate: 1.6, turretRate: 2.5, airSight: 70, desc: 'Kurz-/Mittelstrecken-Flugabwehr auf Kettenfahrgestell, sehr gut gegen Drohnen und Marschflugkörper.' });
veh('RU', 'm_buk', { name: 'Buk-M3', icon: '🛰️', model: 'm_buk', role: 'support', hp: 380, speed: 7.5, sight: 30, radius: 3.4, weapons: ['m_buk'], turnRate: 1.3, turretRate: 1.5, airSight: 110, desc: 'Mittelstrecken-Flugabwehr (95 m), gut gegen Marschflugkörper und Flugzeuge.' });
veh('RU', 'm_moto', { name: 'Motorrad-Sturmgruppe', icon: '🏍️', model: 'm_moto', role: 'infantry', hp: 70, speed: 16, sight: 30, radius: 1.2, weapons: ['rifleRU'], turnRate: 3.2, conceal: 0.3, desc: 'Schnelle, ungeschützte Motorrad-Sturmtrupps (2025-Taktik). Durchbruch durch Lücken, extrem verwundbar.' });
veh('RU', 'm_buggy', { name: 'Buggy-Sturmgruppe', icon: '🏎️', model: 'm_buggy', role: 'infantry', hp: 130, speed: 14, sight: 30, radius: 2, weapons: ['mgRU'], turnRate: 2.8, turretRate: 3, desc: 'Leichter Geländebuggy mit MG. Schnell, kaum geschützt.' });
air('RU', 'm_zala', { name: 'ZALA-Aufklärer', icon: '🛩️', model: 'm_zala', role: 'drones', hp: 35, speed: 12, sight: 58, radius: 1.5, weapons: [], alt: 30, conceal: 0.45, desc: 'Aufklärungsdrohne (Nurflügler). Deckt den Nebel des Krieges auf. Unbewaffnet.' });
air('RU', 'm_orion', { name: 'Orion-Kampfdrohne', icon: '🛩️', model: 'm_orion', role: 'drones', hp: 170, speed: 11, sight: 52, radius: 2.5, weapons: ['m_orion_atgm', 'm_orion_bomb'], alt: 34, turnRate: 1.2, conceal: 0.35, desc: 'Große Langstrecken-Kampfdrohne mit Lenkflugkörpern und Gleitbomben. Anfällig gegen Flugabwehr.' });
air('RU', 'm_molniya', { name: 'Molniya', icon: '⚡', model: 'm_molniya', role: 'drones', hp: 25, speed: 14, sight: 28, radius: 1.2, weapons: ['m_molniya'], alt: 12, lifetime: 150, kamikaze: true, conceal: 0.5, desc: 'Billige Flächen-Kamikazedrohne aus Sperrholz/Pappe. Leichte Ladung, in Massen eingesetzt.' });
air('RU', 'm_kvn', { name: 'Glasfaser-FPV „KVN“', icon: '🧵', model: 'm_kvn', role: 'drones', hp: 12, speed: 21, sight: 28, radius: 1, weapons: ['m_kvn'], alt: 8, lifetime: 55, kamikaze: true, conceal: 0.6, ewImmune: true, tether: 55, desc: 'FPV am Glasfaserkabel: immun gegen Störsender, nur 55 m vom Operator entfernt einsetzbar.' });
air('RU', 'm_geran3', { name: 'Geran-3', icon: '🔺', model: 'm_geran3', role: 'drones', hp: 70, speed: 20, sight: 30, radius: 2, weapons: ['m_geran3'], alt: 20, lifetime: 220, kamikaze: true, desc: 'Strahlgetriebene Shahed-Variante: fast doppelt so schnell, größere Ladung, schwerer abzufangen.' });
inf('RU', 'm_storm', { name: 'Sturminfanterie', icon: '🪖', model: 'm_storm', role: 'infantry', hp: 55, speed: 4.6, sight: 32, weapons: ['rifleRU'], conceal: 0.3, desc: 'Zahlreiche, schwach geschützte Sturmtrupps. Billig, schnell, ersetzbar.' });
inf('RU', 'm_rubikon', { name: 'Drohnenregiment-Pilot', icon: '🎮', model: 'm_fibreop', role: 'infantry', hp: 55, speed: 3.9, sight: 32, weapons: ['rifleRU'], conceal: 0.5, desc: 'Spezialisierter Drohnenpilot: Glasfaser-FPV „KVN“ und Molniya-Schwärme (Fähigkeiten).' });
inf('RU', 'm_dronehunter_ru', { name: 'Drohnenabwehr-Trupp', icon: '📡', model: 'm_dronehunter', role: 'infantry', hp: 65, speed: 4, sight: 32, weapons: ['m_ewrifle', 'm_shotgun'], conceal: 0.35, airSight: 46, desc: 'Schrotflinte und EloKa-Gewehr gegen Drohnen. Der EloKa-Strahl wirkt nicht gegen Glasfaser-Drohnen.' });
// Fahrzeug-Flugzeuge (Katalog / Luftunterstützung; Fähigkeiten spawnen sie temporär)
air('UA', 'm_f16', { name: 'F-16', icon: '✈️', model: 'm_jet_f16', role: 'drones', hp: 260, speed: 40, sight: 40, radius: 4, weapons: [], alt: 28, turnRate: 1.4, desc: 'Kampfflugzeug – wird von der Fähigkeit „F-16-Luftnahunterstützung“ gerufen.' });
air('UA', 'm_mirage', { name: 'Mirage 2000', icon: '✈️', model: 'm_jet_mirage', role: 'drones', hp: 240, speed: 42, sight: 40, radius: 4, weapons: [], alt: 28, turnRate: 1.5, desc: 'Kampfflugzeug – Fähigkeit „Mirage-Schlag (SCALP/Hammer)“.' });
air('RU', 'm_su34', { name: 'Su-34', icon: '✈️', model: 'm_jet_su34', role: 'drones', hp: 320, speed: 38, sight: 40, radius: 4.5, weapons: [], alt: 30, turnRate: 1.3, desc: 'Jagdbomber – Fähigkeit „Gleitbomben-Schlag (KAB/UMPK)“.' });

// ======================= V3-M2: gezogene Geschütze, Gegenbatterie-Radar, Transporthubschrauber, Eisenbahn =======================
// towable: Geschütz kann von Zugfahrzeugen (tow: true – Lkw, MT-LB, Ural/KrAZ) angehängt werden; Mannschaft schiebt langsam.
// cbRadar: Gegenbatterie-Radar (ortet feuernde Artillerie im Umkreis, js/game/support.js). rail: fährt nur auf Gleisen (rail.js).
veh('UA', 'm_m119', { name: 'M119 (105 mm, gezogen)', icon: '💥', model: 'm_towgun', role: 'support', hp: 170, speed: 2.2, sight: 30, radius: 1.9, weapons: ['m_m119'], turnRate: 1.1, turretRate: 0.9, towable: true, conceal: 0.35, gunKind: 'howitzer', desc: 'Leichte Feldhaubitze. Wird von Lkw/Zugmaschine gezogen (Auf-/Abprotzen 4 s), Mannschaft schiebt langsam.' });
veh('RU', 'm_d30', { name: 'D-30 (122 mm, gezogen)', icon: '💥', model: 'm_towgun', role: 'support', hp: 190, speed: 2.0, sight: 30, radius: 2.0, weapons: ['m_d30'], turnRate: 1.0, turretRate: 0.9, towable: true, conceal: 0.35, gunKind: 'howitzer', desc: 'Gezogene 122-mm-Haubitze, Rundumfeuer. Zugmaschine nötig für schnellen Stellungswechsel.' });
veh('RU', 'm_mt12', { name: 'MT-12 Rapira (100 mm)', icon: '🎯', model: 'm_towgun', role: 'support', hp: 160, speed: 2.2, sight: 34, radius: 1.8, weapons: ['m_mt12'], turnRate: 1.2, turretRate: 1.0, towable: true, conceal: 0.45, gunKind: 'at', desc: 'Gezogene Panzerabwehrkanone. Gut zu tarnen.' });
veh('UA', 'm_tpq36', { name: 'AN/TPQ-36 Gegenbatterie-Radar', icon: '📡', model: 'm_cbradar', role: 'support', hp: 220, speed: 9, sight: 30, radius: 2.8, weapons: [], turnRate: 1.6, airSight: 40, cbRadar: { range: 260 }, desc: 'Ortet feuernde Artillerie (Feuerstellung wird kurz aufgedeckt, eigene Artillerie in Reichweite schießt zurück).' });
veh('RU', 'm_zoopark', { name: '1L219 Zoopark-1', icon: '📡', model: 'm_cbradar', role: 'support', hp: 300, speed: 8.5, sight: 30, radius: 3, weapons: [], turnRate: 1.6, airSight: 40, cbRadar: { range: 260 }, tracked: true, desc: 'Gegenbatterie-Radar auf MT-LB-Fahrgestell.' });
air('UA', 'm_mi8', { name: 'Mi-8MSB (Transport)', icon: '🚁', model: 'af_mi8', role: 'drones', hp: 380, speed: 12, sight: 40, radius: 4.8, weapons: [], alt: 18, turnRate: 1.2, transport: 16, desc: 'Transporthubschrauber: Luftlandung (Fähigkeit „Luftlandung“), Infanterie auf-/absitzen nach Landung.' });
air('RU', 'm_mi8ru', { name: 'Mi-8AMTSch (Transport)', icon: '🚁', model: 'af_mi8', role: 'drones', hp: 400, speed: 12, sight: 40, radius: 4.8, weapons: [], alt: 18, turnRate: 1.2, transport: 16, desc: 'Transporthubschrauber der WDW.' });
const rail = (key, d) => def(d.faction || 'UA', key, { cls: 'veh', armor: 'light', icon: '🚂', speed: 7, sight: 30, radius: 4.6, turnRate: 0.3, turretRate: 1.4, rail: true, ...d });
rail('m_rail_loco', { name: 'Diesellok (Zug)', model: 'm_rail_loco', hp: 900, weapons: [], train: 'loco', desc: 'Lokomotive. Lok-Treffer stoppt den Zug.' });
rail('m_rail_wagon', { name: 'Güterwagen (Nachschub)', model: 'm_rail_wagon', hp: 520, weapons: [], train: 'wagon', desc: 'Munition/Material für den Bahnhof.' });
rail('m_rail_tank', { name: 'Kesselwagen (Treibstoff)', model: 'm_rail_tank', hp: 420, weapons: [], train: 'tank', secondary: true, desc: 'Treibstoff für den Bahnhof – explodiert bei Zerstörung.' });
rail('m_rail_armor', { name: 'Panzerwagen', model: 'm_rail_armor', hp: 1100, armor: 'heavy', weapons: ['ac30', 'coaxRU'], train: 'armor', desc: 'Improvisierter Panzerwaggon mit 30-mm-Turm.' });
rail('m_rail_flak', { name: 'Flak-Waggon (ZU-23-2)', model: 'm_rail_flak', hp: 560, weapons: ['m_zu23'], airSight: 60, train: 'flak', desc: 'Offener Waggon mit Zwillingsflak.' });

// ======================= V3-SL: Satellitennetz („Starlink“ als Systembezeichnung, neutrales Modell ohne Markenzeichen) =======================
def('UA', 'm_starlink', { cls: 'struct', armor: 'struct', name: 'Starlink-Terminal', icon: '📡', iconKey: 'satdish', model: 'm_satterm', role: 'support', hp: 160, sight: 16, radius: 1.2, weapons: [], satTerminal: true, satRadius: 45, desc: 'Satelliten-Datenterminal (Antenne auf Dreibein): Netzabdeckung 45 m für das ganze Team. Mit Netz: Drohnen- und Artilleriefähigkeiten präziser (Streuung −40 %), kürzere Abklingzeit. Störbar durch EloKa (Terminal rot).' });
def('RU', 'm_starlink_ru', { cls: 'struct', armor: 'struct', name: 'Erbeutetes Satellitenterminal (fiktiv)', icon: '📡', iconKey: 'satdish', model: 'm_satterm', role: 'support', hp: 140, sight: 16, radius: 1.2, weapons: [], satTerminal: true, satRadius: 45, fictional: true, desc: 'Fiktives Szenario: erbeutetes bzw. auf dem Schwarzmarkt beschafftes Terminal. Gleiche Wirkung wie auf ukrainischer Seite.' });

registerUnitTypes(T);
export const MODERN_TYPES = T;

// V3-SL: mobile Uplinks (Drohnenpiloten, Gefechtsstand, Offizier, Raketen-/Rohrartillerie mit Feuerleit-Software) – nur UA
for (const k of ['dronepilot', 'hq', 'ua_officer', 'himars', 'm_pzh2000', 'm_caesar', 'm_archer', 'm_bohdana', 'm_krab', 'm_interceptor', 'm_tpq36']) if (UNIT_TYPES[k] && UNIT_TYPES[k].satlink === undefined) UNIT_TYPES[k].satlink = 'UA';
// EloKa-Trupp (RU): stört feindliche Satellitenterminals im Umkreis von 18 m dauerhaft
if (UNIT_TYPES.m_dronehunter_ru) UNIT_TYPES.m_dronehunter_ru.satJam = 18;
