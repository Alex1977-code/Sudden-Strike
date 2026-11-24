// Rosters der Epoche „modern 2024–2026“ für Gefecht/KI. Einbindung in skirmish.js erfolgt später durch einen anderen Agenten.
// Struktur: ROSTERS_MODERN[team][kategorie] = Liste von Typschlüsseln (nur m_*-Typen dieser Epoche).
//   infantry  – Infanterie und Schnellangriffs-Gruppen        armor – Panzer, Schützen-/Radpanzer
//   support   – Artillerie, Flugabwehr, Raketenwerfer          logistics – Nachschub (Roboter-Lkw)
//   drones    – Drohnen, Roboter, Seedrohnen, Flugzeuge (Luftunterstützung)
// ABIL_MODERN: Fähigkeiten je Team (ids aus ABILITIES) mit empfohlenen Ladungen; REQUIRES: benötigter Typ je Fähigkeit.
export const ROSTERS_MODERN = {
  UA: {
    infantry: ['m_dronehunter', 'm_fibreop', 'ua_officer'], // ua_officer/e_officer: Kerntypen (V3-M1, Führungsaura)
    armor: ['m_abrams', 'm_leo1', 'm_t64', 'm_cv90', 'm_marder', 'm_bmp2', 'm_stryker', 'm_senator'],
    support: ['m_pzh2000', 'm_caesar', 'm_bohdana', 'm_archer', 'm_krab', 'm_nasams', 'm_skynex', 'm_interceptor', 'm_neptun_tel'],
    logistics: ['m_ugv_log'],
    drones: ['m_leleka', 'm_vampire', 'm_fiberfpv', 'm_magura5', 'm_magura7', 'm_ugv_mg', 'm_ugv_kami'], // V3-A: Flugzeuge (F-16, Mirage) sind rein optisch (AirShow), keine Einheiten mehr
  },
  RU: {
    infantry: ['m_storm', 'm_rubikon', 'm_dronehunter_ru', 'm_moto', 'm_buggy', 'e_officer'],
    armor: ['m_t80', 'm_turtle', 'm_bmp3', 'm_mtlb'],
    support: ['m_2s7', 'm_tos1a', 'm_iskander_tel', 'm_tor', 'm_buk'],
    logistics: [],
    drones: ['m_zala', 'm_orion', 'm_molniya', 'm_kvn', 'm_geran3'], // V3-A: Su-34 nur noch Optik
  },
};
export const ABIL_MODERN = {
  UA: ['m_atacms', 'm_neptun', { id: 'm_flamingo', charges: 2 }, { id: 'm_lyutyi', charges: 3 }, { id: 'm_f16cas', charges: 3 }, { id: 'm_mirage', charges: 2 }, { id: 'm_fiberfpv', charges: 6 }],
  RU: ['m_iskander', { id: 'm_kh101', charges: 3 }, { id: 'm_kab', charges: 4 }, { id: 'm_su57', charges: 3 }, { id: 'm_kinzhal', charges: 2 }, { id: 'm_kvn', charges: 6 }, { id: 'm_molniya', charges: 5 }],
};
export const REQUIRES_MODERN = {
  m_atacms: 'himars', m_neptun: 'm_neptun_tel', m_fiberfpv: 'm_fibreop', m_iskander: 'm_iskander_tel', m_kvn: 'm_rubikon', m_molniya: 'm_rubikon',
};
