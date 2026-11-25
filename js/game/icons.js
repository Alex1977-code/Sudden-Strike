// Einheitliches Inline-SVG-Icon-Set (ersetzt die Emojis in allen Bedienelementen).
// Raster 24×24, Strichstärke 1,7, runde Enden, alles in currentColor. Bodenfahrzeuge/Infanterie folgen der
// NATO-Taktiksymbolik (APP-6: Rahmen + Modifikator: Kreuz = Infanterie, Oval = Kette, Punkt = Artillerie,
// Schrägstrich = Aufklärung, Bogen = Flugabwehr); Luft, See und Bauwerke sind kleine Silhouetten.
//
//   icon(name, opts)          → SVG-String. name = Icon-Name, Einheitentyp-Schlüssel oder Fähigkeits-ID
//   iconForUnitType(type)     → SVG-String für einen UNIT_TYPES-Eintrag (iconKey → Schlüsseltabelle → Heuristik → Fallback)
//   unitIconKey(type)         → Icon-Name zum Typ
//   drawIcon(ctx, name, x, y, size, color, alpha)   → dasselbe auf einem Canvas (Path2D; Minikarte, Overlay)
//   hydrateIcons(root)        → ersetzt <i data-icon="name"> im DOM durch das SVG (statisches HTML)
// opts: { size (px, Standard 1em), label (aria-label + Tooltip), cls, color (Akzent/Teamfarbe), stroke }
// Neue Epochen: Typ-Eintrag { iconKey: 'tank' } (oder bekannte Schlüssel in KEY_MAP) – type.icon wird nur noch
// als Fallback ausgewertet, wenn es selbst ein Icon-Name ist (Emoji werden nie gerendert).

const C = (x, y, r) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
const E = (x, y, rx, ry) => `M${x - rx} ${y}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0z`;
const R = (x, y, w, h, r = 0) => r
  ? `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`
  : `M${x} ${y}h${w}v${h}h${-w}z`;
// Präfixe: '*' Fläche (Akzent, 30 %) + Kontur · '~' Vollfläche ohne Kontur · '=' gestrichelt · sonst Kontur
const T = (s) => '*' + s;
const S = (s) => '~' + s;

const FR = T(R(2.5, 5, 19, 14, 1.2));                // APP-6-Rahmen (Boden)
const XX = 'M2.5 5L21.5 19M21.5 5L2.5 19';           // Infanteriekreuz
const WHEELS = [C(8, 21.7, 1.3), C(16, 21.7, 1.3)];
const ROCKET = (x, y, h = 11) => [T(`M${x} ${y}l1.5 2.6V${y + h}h-3V${y + 2.6}z`), `M${x - 1.5} ${y + h - 1.5}l-1.6 2.4h1.6M${x + 1.5} ${y + h - 1.5}l1.6 2.4h-1.6`];
const PLANE = T('M12 2.5c1 0 1.6 1 1.6 2.5v5l8.4 4.5v2.2l-8.4-2.2v4.6l2.4 1.8v1.6L12 20.2 8 21.5v-1.6l2.4-1.8v-4.6L2 15.7v-2.2L10.4 9V5c0-1.5.6-2.5 1.6-2.5z');
const QUAD_ARMS = 'M9.6 9.6L6.2 6.2M14.4 9.6l3.4-3.4M9.6 14.4l-3.4 3.4M14.4 14.4l3.4 3.4';
const HOUSE = 'M3 11.5L12 4l9 7.5M5.5 9.7V20h13V9.7';
const BLAST = T('M12 2.5l1.9 5 4.6-2.4-2 4.9 5 1.9-5 1.9 2 4.9-4.6-2.4-1.9 5-1.9-5-4.6 2.4 2-4.9-5-1.9 5-1.9-2-4.9 4.6 2.4z');
const PERSON = [C(12, 8, 3.4), 'M5 20.5c0-4 3-6.5 7-6.5s7 2.5 7 6.5'];

export const ICONS = {
  // ---------- Infanterie (APP-6) ----------
  inf: [FR, XX],
  mg: [FR, XX, S(C(8, 21.7, 1)), S(C(12, 21.7, 1)), S(C(16, 21.7, 1))],
  at: [FR, 'M3.2 18.6L12 6l8.8 12.6'],
  sniper: [FR, C(12, 12, 3.3), 'M12 6.9v1.9M12 15.2v1.9M6.9 12h1.9M15.2 12h1.9'],
  engineer: [FR, 'M6.5 16.5V11h3v2.6h5V11h3v5.5'],
  medic: [FR, 'M12 7.8v8.4M7.8 12h8.4'],
  observer: [FR, T(C(8.9, 13.3, 2.5)), T(C(15.1, 13.3, 2.5)), 'M8.9 10.8V8.3h6.2v2.5'],
  drone_op: [FR, C(8.4, 9, 1.2), C(15.6, 9, 1.2), C(8.4, 15, 1.2), C(15.6, 15, 1.2), 'M9.2 9.8l5.6 4.4M14.8 9.8l-5.6 4.4'],
  special: [FR, S('M12 6.2l1.5 8.3h-3z'), 'M9.2 14.5h5.6M12 14.5v3.2'],
  aa_inf: [FR, T('M6.8 16.8a5.2 5.2 0 0 1 10.4 0z'), 'M12 11.6V8'],
  crew: [FR, ...PERSON.map((p, i) => (i ? 'M7.4 17.6c0-2.8 1.9-4.4 4.6-4.4s4.6 1.6 4.6 4.4' : C(12, 9.6, 2.2)))],
  // ---------- Fahrzeuge (APP-6) ----------
  tank: [FR, T(E(12, 12, 6.2, 3.4)), 'M18.2 12h2.6'],
  ifv: [FR, XX, T(E(12, 12, 5.6, 3))],
  wheeled: [FR, XX, ...WHEELS],
  recon_veh: [FR, 'M2.5 19L21.5 5', ...WHEELS],
  truck: [FR, T('M5 8.8h7.6v6.2H5z'), T('M12.6 10.6h3.2l2.5 2.4V15h-5.7z'), S(C(8, 15.9, 1.1)), S(C(15.6, 15.9, 1.1))],
  recovery: [FR, T(E(10.5, 14, 5.4, 2.7)), 'M11.5 11.6L18 7M18 7v3.4'],
  aa_gun: [FR, 'M6.8 11.4a5.2 5.2 0 0 1 10.4 0', T(E(12, 15.2, 4.8, 2.1))],
  aa_missile: [FR, 'M6.2 17.2a5.8 5.8 0 0 1 11.6 0', 'M12 15.6V8M10.2 9.8L12 7.8l1.8 2'],
  radar_veh: [FR, C(12, 12, 4.6), 'M12 12l3.2-3.2', S(C(12, 12, 0.9))],
  arty_tube: [FR, S(C(10.5, 13.2, 2.4)), 'M12.2 11.6L20 6.6'],
  arty_rocket: [FR, S(C(12, 16, 1.8)), 'M12 14V7.4M9.8 9.4L12 6.9l2.2 2.5'],
  // ---------- Luft ----------
  quad: [T(R(9.5, 9.5, 5, 5, 1.2)), QUAD_ARMS, C(5, 5, 2.4), C(19, 5, 2.4), C(5, 19, 2.4), C(19, 19, 2.4)],
  recon: [T(R(9.5, 9.5, 5, 5, 1.2)), QUAD_ARMS, C(5, 5, 2.4), C(19, 5, 2.4), C(5, 19, 2.4), C(19, 19, 2.4), S(C(12, 12, 1.2))],
  fpv: [T(R(10, 10, 4, 4, 1)), QUAD_ARMS, S(C(5.2, 5.2, 2.2)), S(C(18.8, 5.2, 2.2)), S(C(5.2, 18.8, 2.2)), S(C(18.8, 18.8, 2.2))],
  uav: [T(E(12, 11, 1.4, 7.4)), 'M2.5 10h19M8 19.5h8'],
  loiter: [T(E(12, 12, 1.5, 8.2)), 'M4 7.2l8 2.6 8-2.6M7.2 20l4.8-2 4.8 2'],
  delta: [T('M12 2.8L20.3 19.7 12 16.8 3.7 19.7z')],
  heli: [T(E(12, 11, 3, 4.6)), 'M12 15.6v5.4M9.4 21h5.2M4 3.8l16 14.4M20 3.8L4 18.2'],
  plane: [PLANE],
  missile: [T('M12 2.5c2 2 2.6 5 2.6 8v6.5H9.4v-6.5c0-3 .6-6 2.6-8z'), 'M9.4 14l-3.2 4.6h3.2M14.6 14l3.2 4.6h-3.2M12 17.5v4'],
  rocket: [...ROCKET(12, 3, 13), 'M5 21.5h14'],
  salvo: [...ROCKET(5.8, 7, 9), ...ROCKET(12, 3, 11), ...ROCKET(18.2, 7, 9)],
  // ---------- See ----------
  boat: [T('M2.5 14.5h19l-2.6 5h-13.6z'), 'M8 14.5V9.8h6.2v4.7M14.2 11.5h5.3', 'M3 22c1.9 0 1.9-1 3.8-1s1.9 1 3.8 1 1.9-1 3.8-1 1.9 1 3.8 1'],
  seadrone: [T('M2.5 16h13.5l5.5-2.2-1 5.2H4.5z'), 'M9 16l1.3-2.8h3.7L15.4 16', 'M3 22c1.9 0 1.9-1 3.8-1s1.9 1 3.8 1 1.9-1 3.8-1 1.9 1 3.8 1'],
  // ---------- Bauwerke ----------
  hq: [T('M3 20L12 8.5l9 11.5z'), 'M10 20l2-5 2 5', 'M12 8.5V3h5.2l-1.7 1.9 1.7 1.9H12'],
  depot: [T('M3.5 8L12 4l8.5 4v9L12 21l-8.5-4z'), 'M3.5 8L12 12l8.5-4M12 12v9'],
  fuel_depot: [T('M5 7a7 2.5 0 0 1 14 0v10a7 2.5 0 0 1-14 0z'), 'M5 7a7 2.5 0 0 0 14 0M5 12a7 2.5 0 0 0 14 0'],
  powerplant: [T('M6.5 21c1-3.5 1.7-5.8 1.7-8.2S7.4 8 6.8 4.5h8.4c-.6 3.5-1.4 5.8-1.4 8.3s.7 4.7 1.7 8.2z'), 'M18.5 21V10.5M20.5 21V10.5M3 21h18', 'M18.4 7.6c-.6-1 .6-1.6 0-2.8'],
  substation: [S('M13.3 2.5L5 13.6h5.8l-1 7.9 8.2-11.2h-5.8z')],
  radar: [C(12, 12, 8.6), C(12, 12, 4.3), 'M12 12l6.1-6.1', S(C(12, 12, 1.1))],
  bunker: [T('M2.5 19.5v-4.5a9.5 7.2 0 0 1 19 0v4.5z'), S(R(8, 13.6, 8, 2, .8))],
  railcar: [T(R(3, 5.5, 18, 10.5, 1)), 'M9 5.5V16M15 5.5V16', C(7.5, 18.6, 1.7), C(16.5, 18.6, 1.7)],
  bridge: [ 'M2 8.5h20', 'M3.5 20c0-6 3.5-11.5 8.5-11.5s8.5 5.5 8.5 11.5', 'M8 8.5v5.4M12 8.5v3M16 8.5v5.4', 'M2 20h20'],
  house: [T(HOUSE), 'M10 20v-5.2h4V20'],
  village: [T('M2.5 12.2L8 7l5.5 5.2V20h-11z'), T('M13.5 12.2l4-3.6 4 3.6V20h-8z'), 'M5.8 20v-4h3.4v4M16 20v-3.4h3V20'],
  tanktrap: ['M5 5l14 14M19 5L5 19M12 3v18', 'M3.5 21h17'],
  sandbag: [T(R(2.8, 14, 8.6, 5.4, 2.7)), T(R(12.6, 14, 8.6, 5.4, 2.7)), T(R(7.7, 8.2, 8.6, 5.4, 2.7))],
  trench: ['M2.5 7.5h5.5V17h8V7.5h5.5', 'M2.5 20.5h19', 'M10 12h4'],
  mine: [T(C(12, 12, 5.4)), 'M12 3.4v3.2M12 17.4v3.2M3.4 12h3.2M17.4 12h3.2M6 6l2.2 2.2M18 6l-2.2 2.2M6 18l2.2-2.2M18 18l-2.2-2.2', S(C(12, 12, 1.5))],
  zeppelin: [T(E(12, 10, 9, 4.4)), T(R(9.8, 15, 4.4, 2.6, .8)), 'M3.6 8.5L1.8 5.6M3.6 11.5L1.8 14.4M10.5 14.4v.6M13.5 14.4v.6'],
  aerostat: [T(C(12, 9, 6)), 'M8 13.4L11 19M16 13.4L13 19', T(R(10.2, 19, 3.6, 2.6, .6))],
  airfield: [PLANE],
  radio: [S(C(12, 7, 1.3)), 'M12 8.4L7.2 21M12 8.4L16.8 21M9.1 16.2h5.8M10.6 12.2h2.8', 'M7.4 3.6a6 6 0 0 0 0 6.8M16.6 3.6a6 6 0 0 1 0 6.8'],
  railway: [T(R(6, 3.5, 12, 13, 2.6)), R(8.4, 6.2, 7.2, 4.2, 1), S(C(9.2, 13.4, 1)), S(C(14.8, 13.4, 1)), 'M7.6 16.5L5.2 21.5M16.4 16.5l2.4 5M4 19.5h16'],
  // ---------- Wetter & Tageszeit (V3-W) ----------
  wx_clear: [T(C(12, 12, 4.2)), 'M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.3 5.3l1.9 1.9M16.8 16.8l1.9 1.9M18.7 5.3l-1.9 1.9M7.2 16.8l-1.9 1.9'],
  wx_moon: [T('M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5z')],
  wx_dawn: ['M3 18.5h18', T('M7.5 18.5a4.5 4.5 0 0 1 9 0'), 'M12 8v2.4M5.2 11.4l1.7 1.7M18.8 11.4l-1.7 1.7M2.8 15.2h2M19.2 15.2h2', 'M9.6 5.6L12 3.4l2.4 2.2'],
  wx_dusk: ['M3 18.5h18', T('M7.5 18.5a4.5 4.5 0 0 1 9 0'), 'M12 8v2.4M5.2 11.4l1.7 1.7M18.8 11.4l-1.7 1.7M2.8 15.2h2M19.2 15.2h2', 'M9.6 3.4L12 5.6l2.4-2.2'],
  wx_overcast: [T('M7 18.5h10.2a3.8 3.8 0 0 0 .5-7.57A5.4 5.4 0 0 0 7.3 10.2 4.2 4.2 0 0 0 7 18.5z')],
  wx_rain: [T('M7 14.5h10.2a3.8 3.8 0 0 0 .5-7.57A5.4 5.4 0 0 0 7.3 6.2 4.2 4.2 0 0 0 7 14.5z'), 'M8 17.5l-1 2.8M12 17.5l-1 2.8M16 17.5l-1 2.8'],
  wx_storm: [T('M7 14.5h10.2a3.8 3.8 0 0 0 .5-7.57A5.4 5.4 0 0 0 7.3 6.2 4.2 4.2 0 0 0 7 14.5z'), 'M12.8 14l-2.6 3.8h3.4l-2.2 3.7'],
  wx_snow: [T('M7 14.5h10.2a3.8 3.8 0 0 0 .5-7.57A5.4 5.4 0 0 0 7.3 6.2 4.2 4.2 0 0 0 7 14.5z'), S(C(8, 18, 1.1)), S(C(12, 20.4, 1.1)), S(C(16, 18, 1.1))],
  wx_fog: ['M4 7.5h16M3 11.5h18M5 15.5h14M8 19.5h8'],
  wx_mud: [T('M7 12.5h10.2a3.8 3.8 0 0 0 .5-7.57A5.4 5.4 0 0 0 7.3 4.2 4.2 4.2 0 0 0 7 12.5z'), 'M8.5 15l-.8 1.8M12.5 15l-.8 1.8M16.5 15l-.8 1.8', 'M3 21c2-1.6 3.2-1.6 5 0s3 1.6 5 0 3.2-1.6 5 0 2 1.2 3 0'],
  // ---------- Befehle ----------
  stop: [S(R(6, 6, 12, 12, 2))],
  holdfire: [C(12, 12, 5.6), 'M12 3.5v3.6M12 16.9v3.6M3.5 12h3.6M16.9 12h3.6', 'M4.8 19.2L19.2 4.8'],
  selectall: [T(R(3.5, 3.5, 7.4, 7.4, 1.6)), T(R(13.1, 3.5, 7.4, 7.4, 1.6)), T(R(3.5, 13.1, 7.4, 7.4, 1.6)), T(R(13.1, 13.1, 7.4, 7.4, 1.6))],
  box: ['=' + R(3.5, 5, 17, 14, 1.2), 'M13 13l6 2.2-2.6 1.1-1.1 2.6z'],
  move: [S(C(4.5, 12, 1.4)), 'M7.5 12h11M13.8 6.8L19 12l-5.2 5.2'],
  attack: [C(12, 12, 6), 'M12 3v4.2M12 16.8V21M3 12h4.2M16.8 12H21', S(C(12, 12, 1.2))],
  clearmines: [T(C(12, 16, 3.4)), 'M5.6 9.6a9 9 0 0 1 12.8 0M8.4 12.2a5 5 0 0 1 7.2 0', 'M4 20.5h16'],
  demolish: [BLAST],
  bailout: [T(E(12, 6.8, 7.4, 3)), 'M12 12.2v8M8.6 17l3.4 3.4 3.4-3.4'],
  takeover: [T(E(12, 17.2, 7.4, 3)), 'M12 3.2v8M8.6 7.6L12 11l3.4-3.4'],
  garrison: [T(HOUSE), S('M10 20v-5.2h4V20z'), 'M12 8.6v3M10.5 10.2L12 11.7l1.5-1.5'],
  ungarrison: ['M10 4H4.5v16H10', 'M8.5 12h11.5M16.5 8.5L20 12l-3.5 3.5'],
  binoculars: [T(C(7, 15.5, 3.6)), T(C(17, 15.5, 3.6)), 'M7 11.9V6.2h3.2v5.7M17 11.9V6.2h-3.2v5.7M10.4 15.5h3.2'],
  pause: [S(R(6, 4.8, 4, 14.4, 1)), S(R(14, 4.8, 4, 14.4, 1))],
  menu: ['M4 6.5h16M4 12h16M4 17.5h16'],
  team: [C(9, 8.4, 3), 'M3.6 19.4c0-3.4 2.4-5.4 5.4-5.4s5.4 2 5.4 5.4', C(17.2, 9.3, 2.4), 'M16.4 14.2c2.7 0 4.5 1.5 4.5 4.4'],
  player: PERSON,
  chat: ['M4 5h16v11H11l-4.5 4v-4H4z'],
  send: ['M3 11.8L21 3.5l-5.8 17-3.6-7.2z', 'M11.6 13.3L21 3.5'],
  copy: [R(8.5, 8.5, 12, 12, 2), 'M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2'],
  dice: [R(3.5, 3.5, 17, 17, 3.2), S(C(8.6, 8.6, 1.2)), S(C(15.4, 8.6, 1.2)), S(C(12, 12, 1.2)), S(C(8.6, 15.4, 1.2)), S(C(15.4, 15.4, 1.2))],
  swap: ['M4 8h14M14.5 4.5L18 8l-3.5 3.5', 'M20 16H6M9.5 12.5L6 16l3.5 3.5'],
  globe: [C(12, 12, 9), 'M3 12h18', 'M12 3c3.2 3 3.2 15 0 18M12 3c-3.2 3-3.2 15 0 18'],
  flask: ['M9.5 3h5M10.5 3v6L5.2 18.6a1.7 1.7 0 0 0 1.5 2.4h10.6a1.7 1.7 0 0 0 1.5-2.4L13.5 9V3', 'M7.4 15h9.2'],
  star: [T('M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z')],
  robot: [R(5, 8.5, 14, 10, 2.6), 'M12 8.5V5.4', S(C(12, 4.3, 1.1)), S(C(9, 13, 1.2)), S(C(15, 13, 1.2)), 'M9.8 16.2h4.4'],
  play: [S('M7.5 4.5l12.5 7.5-12.5 7.5z')],
  hourglass: ['M7 3.5h10M7 20.5h10M8 3.5c0 5 4 5.5 4 8.5s-4 3.5-4 8.5M16 3.5c0 5-4 5.5-4 8.5s4 3.5 4 8.5'],
  // ---------- Fähigkeiten (IDs aus abilities.js) ----------
  scan: ['M2 12c3-4.8 6.7-7 10-7s7 2.2 10 7c-3 4.8-6.7 7-10 7s-7-2.2-10-7z', T(C(12, 12, 3.2)), S(C(12, 12, 1))],
  ew: [S(C(12, 12, 1.6)), 'M8.4 8.4a5.1 5.1 0 0 0 0 7.2M15.6 8.4a5.1 5.1 0 0 1 0 7.2M5.5 5.5a9.2 9.2 0 0 0 0 13M18.5 5.5a9.2 9.2 0 0 1 0 13', 'M4 20L20 4'],
  // ---------- Status / Menü ----------
  obj_done: [T(C(12, 12, 8.6)), 'M7.8 12.4l3 3 5.6-6'],
  obj_open: [C(12, 12, 8.6)],
  obj_failed: [T(C(12, 12, 8.6)), 'M8.6 8.6l6.8 6.8M15.4 8.6l-6.8 6.8'],
  obj_target: [T('M12 3l8 9-8 9-8-9z')],
  obj_protect: [T('M12 3l8 3v6c0 5-3.6 8-8 9.5C7.6 20 4 17 4 12V6z'), 'M8.8 12l2.4 2.4 4-4.4'],
  check: ['M5 12.5l4.5 4.5L19 7'],
  close: ['M6 6l12 12M18 6L6 18'],
  clock: [C(12, 12, 8.6), 'M12 7v5.2l3.6 2'],
  ammo: [T('M9 21V10.4c0-2.8 1.4-4.9 3-6.4 1.6 1.5 3 3.6 3 6.4V21z'), 'M9 17h6'],
  fuel: [T('M12 3C8.2 8.6 6 11.8 6 15a6 6 0 0 0 12 0c0-3.2-2.2-6.4-6-12z')],
  material: [T('M3 6.5h18v11H3z'), 'M3 12h18M9 6.5V12M15 12v5.5'],
  supply: [T('M3.5 8L12 4l8.5 4v9L12 21l-8.5-4z'), 'M3.5 8L12 12l8.5-4M12 12v9'],
  warning: ['M12 3.4L21.6 20H2.4z', 'M12 9.8v4.8', S(C(12, 17.4, 1))],
  battery: [T(R(2.5, 8, 16, 9, 2)), 'M21 11v3', S(R(5, 10.5, 7, 4, .6))],
  repair: ['M14.6 3.8a4.6 4.6 0 0 0-4.3 6.3L3.7 16.7a2.2 2.2 0 0 0 3.1 3.1l6.6-6.6a4.6 4.6 0 0 0 6.3-4.3l-2.9 2.9-2.7-.6-.6-2.7 2.9-2.9a4.6 4.6 0 0 0-1.8-.8z'],
  flag: ['M6 21V3.5', T('M6 4.5h11.5l-2.8 3.8 2.8 3.7H6')],
  lock: [T(R(5, 11, 14, 9.5, 2)), 'M8 11V8a4 4 0 0 1 8 0v3', S(C(12, 15.7, 1.2))],
  medal: [T(C(12, 15, 5.5)), 'M8.4 3.5l2.4 6.3M15.6 3.5l-2.4 6.3', 'M12 12.6l.9 1.8 2 .3-1.4 1.4.3 2-1.8-.9-1.8.9.3-2-1.4-1.4 2-.3z'],
  unknown: [C(12, 12, 8.6), 'M9.4 9.6a2.7 2.7 0 1 1 3.9 2.4c-.9.5-1.3 1.1-1.3 2.1', S(C(12, 17.2, 1))],
  // ---------- Kampfmechaniken (V3-M1): Offizier, Granate, Nebel, Hinterhalt, Eingraben, Feuer frei ----------
  officer: [FR, XX, S('M12 6.6l1.3 2.7 3 .4-2.2 2.1.5 3-2.6-1.4-2.6 1.4.5-3-2.2-2.1 3-.4z')],
  grenade: [T(E(12, 14.5, 5, 6)), 'M10 8.6h4V6.2h-4zM14 7.4l3.4-2.6', 'M7.4 13h9.2M7.4 16.4h9.2'],
  smoke: [T('M5.5 17.5a3.5 3.5 0 0 1 .6-7 4.6 4.6 0 0 1 8.8-1.4 3.6 3.6 0 0 1 3.6 6 2.8 2.8 0 0 1-1.6 2.4z'), 'M4 20.5h16'],
  ambush: [T(HOUSE), 'M7.8 15.2c1.3-1.6 2.7-2.4 4.2-2.4s2.9.8 4.2 2.4c-1.3 1.6-2.7 2.4-4.2 2.4s-2.9-.8-4.2-2.4z', 'M6.5 19.5l11-8.6'],
  dig: [T('M3 15.5h4.5l1.5 3h6l1.5-3H21'), 'M13.5 3.5l3.5 3.5-5.6 5.6-3.5-3.5z', 'M11.4 12.6l-2 2'],
  firefree: [C(12, 12, 5.6), 'M12 3.5v3.6M12 16.9v3.6M3.5 12h3.6M16.9 12h3.6', S(C(12, 12, 1.4))],
  // ---------- Karteneditor & Mods (V3-E) ----------
  editor: [T('M3 6.5l5.5-2.5 6 2.5 5.5-2.5v7.5'), 'M3 6.5V19l5.5-2.5 3 1.2M8.5 4v12.5M14.5 6.5v4', T('M13 21l.8-3.2 6-6 2.4 2.4-6 6z')],
  mods: [T('M4 7h4.5a2.2 2.2 0 1 1 4 0H17v4.5a2.2 2.2 0 1 1 0 4V20H4z')],
  undo: ['M9 13.5L4.5 9 9 4.5', 'M4.5 9H14a5.5 5.5 0 0 1 0 11h-3'],
  redo: ['M15 13.5L19.5 9 15 4.5', 'M19.5 9H10a5.5 5.5 0 0 0 0 11h3'],
  save: [T(R(4, 4, 16, 16, 2)), 'M8 4v5h7V4', R(7.5, 13, 9, 7)],
  upload: ['M12 15V4M7.5 8.5L12 4l4.5 4.5', 'M4 14.5V20h16v-5.5'],
  download: ['M12 4v11M7.5 10.5L12 15l4.5-4.5', 'M4 14.5V20h16v-5.5'],
  trash: ['M4 7h16M9.5 7V4.5h5V7', T('M6.2 7l1 13h9.6l1-13z'), 'M10 11v5.5M14 11v5.5'],
  cursor: [T('M5.5 3.5l13 7.6-5.8 1.6-3 6z')],
  ed_hill: [T('M2 19.5l6.2-9.5 3.2 4.3 3.4-6.6 7.2 11.8z')],
  ed_dip: [T('M2 7.5c4.2 0 5 10 10 10s5.8-10 10-10'), '=M2 7.5h20'],
  ed_flat: ['M3 15h18M3 19h18', '=M3 11c3-4.5 6-4.5 9 0s6 4.5 9 0'],
  water: [T('M3 9.5c2-2 4-2 6 0s4 2 6 0 4-2 6 0V20H3z'), 'M6 14.5c1.3-1 2.7-1 4 0M14 16.5c1.3-1 2.7-1 4 0'],
  river: ['M3 3.5c6 0 3 8.5 9 8.5s3 8.5 9 8.5', 'M3 8.5c4 0 2 7.5 7 7.5s4 4.5 7 4.5'],
  road: ['M8.5 3L5 21M15.5 3L19 21', '=M12 4.5v15'],
  track: ['=M8.5 3L5 21', '=M15.5 3L19 21'],
  rail: ['M8.5 3v18M15.5 3v18', 'M5.5 6.5h13M5.5 11h13M5.5 15.5h13M5.5 20h13'],
  forest: [T('M7.5 3l4.3 8H9.3l3 5H2.7l3-5H3.2z'), 'M7.5 16v4.5', T('M17 7l3.4 6.3h-2l2.5 4.4h-7.8l2.5-4.4h-2z'), 'M17 17.7v2.8'],
  treeline: [S(C(5, 11.5, 2.7)), S(C(12, 11.5, 2.7)), S(C(19, 11.5, 2.7)), 'M5 14.5v4M12 14.5v4M19 14.5v4', 'M2 19h20'],
  field: [T(R(3, 6.5, 18, 13.5, 1)), 'M3 11h18M3 15.5h18', 'M10 4.5l2 2 2-2'],
  ford: ['M3 7.5c2-2 4-2 6 0s4 2 6 0 4-2 6 0', 'M3 17c2-2 4-2 6 0s4 2 6 0 4-2 6 0', S(C(7.5, 12.3, 1.4)), S(C(12, 12.3, 1.4)), S(C(16.5, 12.3, 1.4))],
  zone: ['=' + C(12, 12, 9), 'M10 17V7', T('M10 7.5h6l-1.5 2 1.5 2h-6')],
  // ---------- Befehle & Welt (V3-M2) ----------
  retreat: ['M19 12H6.5M11 7l-5 5 5 5', 'M20.5 5v14'],
  fire_return: [C(12, 12, 5.6), 'M12 3.5v3.6M12 16.9v3.6M3.5 12h3.6M16.9 12h3.6', 'M8.6 9.2a4 4 0 0 1 6.8 0M15.4 9.2l.4-2.4M15.4 9.2l-2.3-.6'],
  stance_hold: [T('M6 4.5h12v6.2c0 4.3-2.6 7.4-6 8.8-3.4-1.4-6-4.5-6-8.8z'), 'M9 11.5h6M12 8.5v6'],
  stance_pursue: [S(C(5, 12, 1.4)), 'M8 12h7M12.5 8.5L16 12l-3.5 3.5', '=' + C(12, 12, 9)],
  prone: [S(C(5, 15.5, 1.8)), 'M7 15.8h9.5l3 1.7M10.5 15.8l2.2-2.6h3', 'M3 19.5h18'],
  stand: [S(C(12, 4.6, 1.8)), 'M12 7v7.5M8.6 10.5h6.8M12 14.5l-3 5.5M12 14.5l3 5.5'],
  formation_block: [S(C(7, 7, 1.6)), S(C(12, 7, 1.6)), S(C(17, 7, 1.6)), S(C(7, 12, 1.6)), S(C(12, 12, 1.6)), S(C(17, 12, 1.6)), 'M12 15.5v5M9.8 18.3L12 20.5l2.2-2.2'],
  formation_line: [S(C(4.5, 12, 1.6)), S(C(9.5, 12, 1.6)), S(C(14.5, 12, 1.6)), S(C(19.5, 12, 1.6)), 'M12 4v4.5M9.8 6.2L12 4l2.2 2.2'],
  formation_wedge: [S(C(12, 6, 1.6)), S(C(8, 11, 1.6)), S(C(16, 11, 1.6)), S(C(4, 16, 1.6)), S(C(20, 16, 1.6)), '=M12 6L4 16M12 6l8 10'],
  formation_column: [S(C(12, 4.5, 1.5)), S(C(12, 9.5, 1.5)), S(C(12, 14.5, 1.5)), S(C(12, 19.5, 1.5))],
  embark: [T(R(3, 9, 15, 8, 1.5)), C(7, 18.5, 1.6), C(14, 18.5, 1.6), 'M18 13h3.5', S(C(21, 5, 1.4)), 'M21 7v3.5l-2.5 2.5'],
  unload: [T(R(2.5, 9, 13, 8, 1.5)), C(6, 18.5, 1.6), C(12.5, 18.5, 1.6), S(C(20, 7.5, 1.4)), 'M20 9.5v4.5M18 20.5l2-6.5 2 6.5', 'M15.5 13h2'],
  unload_at: [T(R(2.5, 10, 11, 7, 1.5)), C(5.5, 18.5, 1.5), C(11, 18.5, 1.5), 'M19 21.5s-3.8-4.6-3.8-7.6a3.8 3.8 0 0 1 7.6 0c0 3-3.8 7.6-3.8 7.6z', S(C(19, 13.9, 1.2))],
  hitch: [T(R(2.5, 8, 9, 7, 1.2)), C(5.5, 17, 1.6), 'M11.5 13h4.5', C(17.2, 13, 1.2), 'M18.4 13l3 -5M18.4 13l3 5', C(19.5, 19.5, 1.5)],
  unhitch: [T(R(2.5, 8, 9, 7, 1.2)), C(5.5, 17, 1.6), 'M11.5 13h2.5', '=M15 13h2', C(19, 13, 1.2), 'M20.2 13l2-3.5M20.2 13l2 3.5'],
  pickmines: [T(E(9, 15, 6, 2.6)), 'M9 12.4v-2', 'M17 4.5v9M14 10.5l3 3 3-3', 'M3 19.5h18'],
  blowbridge: ['M2 8.5h7.5M14.5 8.5H22', 'M3.5 20c0-5 2.5-9.5 6-11M20.5 20c0-5-2.5-9.5-6-11', 'M2 20h20', S(C(12, 7, 1.6)), 'M12 2.5v2M8.6 4l1.3 1.4M15.4 4l-1.3 1.4'],
  buildbridge: [T('M2 15h20v3H2z'), 'M5 18.5v2.5M12 18.5v2.5M19 18.5v2.5', 'M5 12l3-6 3 6M13 12l3-6 3 6'],
  counterbattery: [T('M4 19.5l4-10 4 10z'), 'M8 9.5V6M5.5 5.2c1.4-1.4 3.6-1.4 5 0M3.6 3.4c2.4-2.4 6.4-2.4 8.8 0', 'M14 14l6-6M17 8h3v3', S(C(20, 18, 1.5))],
  airdrop: [T('M4 9a8 6 0 0 1 16 0z'), 'M4 9l8 8M20 9l-8 8M12 9v8', S(C(12, 18.5, 1.6))],
  train: [T(R(5, 3.5, 14, 13, 2.5)), 'M5 10.5h14M9.5 3.5v7', C(8.5, 13.5, 1), C(15.5, 13.5, 1), 'M8 16.5L5 21M16 16.5l3 4.5M6.5 19h11'],
  waypoint: [S(C(5, 18, 1.5)), '=M6.5 17l5-6 6-2', 'M17.5 9l-.2-5.5L21 7.6z'],
  // ---------- Satellitennetz (V3-SL): Netzstatus, Terminal, gestört ----------
  satnet: [T(R(9.5, 3.5, 5, 6, 0.8)), T('M2.5 4.5h5v4h-5z'), T('M16.5 4.5h5v4h-5z'), 'M7.5 6.5h2M14.5 6.5h2', 'M8 14.5a5.6 5.6 0 0 0 8 0M5.2 17.2a9.6 9.6 0 0 0 13.6 0', S(C(12, 12.2, 1.1))],
  satdish: [T('M4 5.5L18 3l1.6 6.4-14 2.6z'), 'M12 10.2V15', 'M12 15l-5 6M12 15l5 6M12 15v6'],
  satjam: [T(R(9.5, 3.5, 5, 6, 0.8)), T('M2.5 4.5h5v4h-5z'), T('M16.5 4.5h5v4h-5z'), 'M7.5 6.5h2M14.5 6.5h2', '=M8 14.5a5.6 5.6 0 0 0 8 0', 'M4 21L20.5 12'],
  // ---------- Menü (V3-MENU) ----------
  gear: [T(C(12, 12, 3)), 'M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M5.5 18.5l1.8-1.8M16.7 7.3l1.8-1.8', C(12, 12, 6.6)],
  help: [C(12, 12, 9), 'M9.4 9.4a2.7 2.7 0 1 1 3.7 2.5c-.7.3-1.1.9-1.1 1.6v.8', S(C(12, 17.2, 1.1))],
  fullscreen: ['M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5', T(R(8.5, 8.5, 7, 7, 1))],
  back: ['M19 12H5.5M11 6l-6 6 6 6'],
  chevron: ['M9.5 5.5L16 12l-6.5 6.5'],
  calendar: [T(R(3.5, 5, 17, 15, 2)), 'M3.5 10h17M8 3v4M16 3v4', S(C(8, 14, 1)), S(C(12, 14, 1)), S(C(16, 14, 1))],
  pin: [T('M12 21.5s-6.5-6.4-6.5-11.2a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11.2-6.5 11.2z'), C(12, 10.3, 2.3)],
  sun: [T(C(12, 12, 4)), 'M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3L7 7M17 17l1.7 1.7M5.3 18.7L7 17M17 7l1.7-1.7'],
  moon: [T('M19.5 14.6A8 8 0 0 1 9.4 4.5a8 8 0 1 0 10.1 10.1z')],
  snow: ['M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6', 'M9.6 4.2L12 6.4l2.4-2.2M9.6 19.8l2.4-2.2 2.4 2.2'],
  cloud: [T('M6.5 18.5a4 4 0 0 1-.4-8 6 6 0 0 1 11.6-1.2 4.6 4.6 0 0 1-.2 9.2z')],
  rain: [T('M6.5 14.5a3.8 3.8 0 0 1-.4-7.6 5.8 5.8 0 0 1 11.2-1.1 4.4 4.4 0 0 1-.2 8.7z'), 'M8 17.5l-1 3M12.5 17.5l-1 3M17 17.5l-1 3'],
  fog: ['M3 9h18M5 13h14M3 17h18', T('M7 6.5a5 5 0 0 1 10 0z')],
  trophy: [T('M7 3.5h10v5a5 5 0 0 1-10 0z'), 'M7 5.5H3.8c0 3 1.4 4.8 3.6 5.2M17 5.5h3.2c0 3-1.4 4.8-3.6 5.2', 'M12 13.5v4M8 20.5h8M9.5 17.5h5'],
  retry: ['M4.5 12a7.5 7.5 0 1 0 2.3-5.4', 'M4.5 3.5v4.2h4.2'],
  home: [T('M4 10.5L12 4l8 6.5V20h-5.5v-5.5h-5V20H4z')],
  exit: ['M10 4H5v16h5', 'M14.5 8l4 4-4 4M18.5 12H9'],
  surrender: ['M5 21V3.5', T('M5 4.5c3-1.6 5.5 1.4 8.5 0s4.5-.6 5.5 0v8c-1-.6-2.5-1.4-5.5 0s-5.5-1.6-8.5 0')],
  speaker: [T('M4 9.5h3.5L12 5.5v13l-4.5-4H4z'), 'M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.6 7.6 0 0 1 0 11'],
  music: [S(C(7.5, 17.5, 2.5)), S(C(17, 15.5, 2.5)), 'M10 17.5V5.5l9.5-2v12'],
  monitor: [T(R(3, 4.5, 18, 12, 1.5)), 'M9 20.5h6M12 16.5v4'],
  gamepad: [T('M7 7.5h10a4.5 4.5 0 0 1 4.4 5.5l-.9 4a2.6 2.6 0 0 1-4.6 1L14 16H10l-1.9 2a2.6 2.6 0 0 1-4.6-1l-.9-4A4.5 4.5 0 0 1 7 7.5z'), 'M8 10.5v3.5M6.25 12.25h3.5', S(C(15.5, 11, 1)), S(C(17.5, 13, 1))],
  keyboard: [T(R(2.5, 6, 19, 12, 1.8)), 'M6 10h.01M9.3 10h.01M12.6 10h.01M15.9 10h.01M18 10h.01M6 13.5h.01M18 13.5h.01M8.5 14.5h7'],
  language: [C(12, 12, 9), 'M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z'],
  book: [T('M4 5.5c2.8-1.2 5.4-1.2 8 .8v14c-2.6-2-5.2-2-8-.8z'), T('M20 5.5c-2.8-1.2-5.4-1.2-8 .8v14c2.6-2 5.2-2 8-.8z')],
  crosshair: [C(12, 12, 7), 'M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5', S(C(12, 12, 1.2))],
  info: [C(12, 12, 9), 'M12 11v6', S(C(12, 7.6, 1.1))],
  difficulty: ['M5 19V14M10 19V10M15 19V6.5M20 19V3.5'],
};
// Rollen (Gefecht) und Fähigkeits-IDs verweisen auf vorhandene Symbole
const ALIAS = {
  role_armor: 'tank', role_infantry: 'inf', role_support: 'arty_tube', role_logistics: 'truck',
  fpv_ab: 'fpv', himars: 'rocket', tornado: 'salvo', artillery: 'demolish', stormshadow: 'missile',
  lancet: 'loiter', cp_zeppelin: 'zeppelin', cp_aerostat: 'aerostat', cp_airfield: 'airfield', cp_depot: 'depot',
  cp_radio: 'radio', cp_railway: 'railway', cp_village: 'village', build_tanktrap: 'tanktrap',
  bridge_road: 'bridge', bridge_rail: 'bridge', hold: 'holdfire', all: 'selectall', build: 'tanktrap',
  clear: 'clearmines', objective_done: 'obj_done', ok: 'obj_done', fail: 'obj_failed', sweep: 'clearmines',
  kills: 'attack', lost: 'close', intercept: 'obj_protect', kamikaze: 'delta', user: 'player',
  m_tobol: 'satjam', m_starlink: 'satdish', m_starlink_ru: 'satdish', // V3-SL
};

// Deutsche Namen (Tooltip / aria-label), wenn kein label übergeben wird
export const ICON_LABELS = {
  inf: 'Infanterie', mg: 'Maschinengewehr', at: 'Panzerabwehr', sniper: 'Scharfschütze', engineer: 'Pionier', medic: 'Sanitäter',
  observer: 'Beobachter', drone_op: 'Drohnenpilot', special: 'Spezialkräfte', aa_inf: 'Flugabwehr (Infanterie)', crew: 'Besatzung',
  tank: 'Kampfpanzer', ifv: 'Schützenpanzer', wheeled: 'Radfahrzeug', recon_veh: 'Aufklärungsfahrzeug', truck: 'Lkw', recovery: 'Bergepanzer',
  aa_gun: 'Flakpanzer', aa_missile: 'Flugabwehrraketen', radar_veh: 'Radarfahrzeug', arty_tube: 'Rohrartillerie', arty_rocket: 'Raketenartillerie',
  quad: 'Drohne', recon: 'Aufklärungsdrohne', fpv: 'FPV-Drohne', uav: 'Aufklärungsdrohne', loiter: 'Kamikazedrohne', delta: 'Kamikazedrohne',
  heli: 'Hubschrauber', plane: 'Flugzeug', missile: 'Marschflugkörper', rocket: 'Rakete', salvo: 'Raketensalve',
  boat: 'Boot', seadrone: 'Seedrohne', hq: 'Gefechtsstand', depot: 'Depot', fuel_depot: 'Treibstofflager', powerplant: 'Kraftwerk',
  substation: 'Umspannwerk', radar: 'Radar', bunker: 'Bunker', railcar: 'Waggon', bridge: 'Brücke', house: 'Gebäude', village: 'Dorf',
  tanktrap: 'Panzersperre', sandbag: 'Sandsäcke', trench: 'Graben', mine: 'Minenfeld', zeppelin: 'Zeppelin', aerostat: 'Fesselballon',
  airfield: 'Flugfeld', radio: 'Funkturm', railway: 'Bahnhof',
  editor: 'Karteneditor', mods: 'Mods', undo: 'Rückgängig', redo: 'Wiederholen', save: 'Speichern', upload: 'Importieren',
  download: 'Exportieren', trash: 'Löschen', cursor: 'Auswahl', ed_hill: 'Hügel', ed_dip: 'Senke', ed_flat: 'Ebnen', water: 'Wasser',
  river: 'Fluss', road: 'Straße', track: 'Feldweg', rail: 'Bahnlinie', forest: 'Wald', treeline: 'Baumreihe', field: 'Feld',
  ford: 'Furt', zone: 'Startzone',
  satnet: 'Satellitennetz', satdish: 'Satellitenterminal', satjam: 'Satellitennetz gestört', // V3-SL
  stop: 'Halt', holdfire: 'Feuer halten', selectall: 'Alle wählen', box: 'Auswahlrahmen', move: 'Bewegen', attack: 'Angreifen',
  clearmines: 'Minen räumen', demolish: 'Sprengen', bailout: 'Aussteigen', takeover: 'Übernehmen', garrison: 'Besetzen',
  ungarrison: 'Verlassen', binoculars: 'Fernglas', pause: 'Pause', menu: 'Menü', team: 'Team', player: 'Spieler', chat: 'Chat',
  send: 'Senden', copy: 'Kopieren', dice: 'Zufall', swap: 'Team wechseln', globe: 'Internet', flask: 'Test', star: 'Host',
  robot: 'KI', play: 'Start', hourglass: 'Wartet', scan: 'Aufklärung', ew: 'Elektronische Kampfführung', artillery: 'Artillerie',
  himars: 'HIMARS-Schlag', tornado: 'Raketensalve', stormshadow: 'Marschflugkörper', lancet: 'Kamikazedrohne',
  obj_done: 'Ziel erfüllt', obj_open: 'Ziel offen', obj_failed: 'Ziel gescheitert', obj_target: 'Ziel', obj_protect: 'Schützen',
  check: 'Bereit', close: 'Schließen', clock: 'Zeit', ammo: 'Munition', fuel: 'Treibstoff', material: 'Baumaterial', supply: 'Vorrat',
  warning: 'Warnung', battery: 'Akku', repair: 'Reparatur', flag: 'Flagge', lock: 'Gesperrt', medal: 'Abgeschlossen', unknown: 'Unbekannt',
  role_armor: 'Panzerkeil', role_infantry: 'Infanterie', role_support: 'Artillerie', role_logistics: 'Logistik',
  officer: 'Offizier', grenade: 'Handgranate', smoke: 'Nebel', ambush: 'Hinterhalt', dig: 'Eingraben', firefree: 'Feuer frei',
  retreat: 'Rückzug', fire_return: 'Feuer erwidern', stance_hold: 'Stellung halten', stance_pursue: 'Verfolgen (begrenzt)',
  prone: 'Kriechen', stand: 'Aufstehen', formation_block: 'Formation Block', formation_line: 'Formation Reihe',
  formation_wedge: 'Formation Keil', formation_column: 'Formation Kolonne', embark: 'Aufsitzen', unload: 'Absitzen',
  unload_at: 'Absitzen am Ziel', hitch: 'Aufprotzen', unhitch: 'Abprotzen', pickmines: 'Minen aufnehmen',
  blowbridge: 'Brücke sprengen', buildbridge: 'Brücke bauen', counterbattery: 'Gegenbatteriefeuer', airdrop: 'Luftlandung',
  train: 'Zug', waypoint: 'Befehlskette',
  wx_clear: 'Klar', wx_moon: 'Nacht', wx_dawn: 'Morgengrauen', wx_dusk: 'Abenddämmerung', wx_overcast: 'Bewölkt', wx_rain: 'Regen',
  wx_storm: 'Gewitter', wx_snow: 'Schneefall', wx_fog: 'Nebel', wx_mud: 'Rasputiza',
  gear: 'Einstellungen', help: 'Hilfe', fullscreen: 'Vollbild', back: 'Zurück', chevron: 'Weiter', calendar: 'Datum', pin: 'Ort',
  sun: 'Klar', moon: 'Nacht', snow: 'Winter', cloud: 'Bewölkt', rain: 'Regen', fog: 'Nebel', trophy: 'Sieg', retry: 'Wiederholen',
  home: 'Hauptmenü', exit: 'Verlassen', surrender: 'Aufgeben', speaker: 'Lautstärke', music: 'Musik', monitor: 'Grafik',
  gamepad: 'Gamepad', keyboard: 'Tastatur', language: 'Sprache', book: 'Ausbildung', crosshair: 'Ziel', info: 'Information',
  difficulty: 'Schwierigkeit',
};

// Einheitentyp-Schlüssel → Icon (explizit; neue Epochen können iconKey setzen oder hier erweitern)
const KEY_MAP = {
  rifle: 'inf', e_rifle: 'inf', mg: 'mg', e_mg: 'mg', javelin: 'at', e_rpg: 'at', e_atgm: 'at', sniper: 'sniper', e_sniper: 'sniper',
  dronepilot: 'drone_op', e_recon: 'drone_op', stinger: 'aa_inf', e_igla: 'aa_inf', sso: 'special', e_spetsnaz: 'special',
  ua_engineer: 'engineer', e_engineer: 'engineer', ua_medic: 'medic', e_medic: 'medic', ua_crew: 'crew', e_crew: 'crew',
  ua_observer: 'observer', e_observer: 'observer',
  leopard: 'tank', t72: 'tank', t90: 'tank', bradley: 'ifv', bmp: 'ifv', btr: 'wheeled', pickup: 'recon_veh',
  truck: 'truck', ua_truck: 'truck', ua_supply: 'truck', ru_supply: 'truck', ua_recovery: 'recovery', ru_recovery: 'recovery',
  ua_tankdestroyer: 'at', ru_tankdestroyer: 'at',
  gepard: 'aa_gun', pantsir: 'aa_gun', irist: 'aa_missile', patriot: 'aa_missile', s400: 'aa_missile',
  patriot_radar: 'radar_veh', s400radar: 'radar', himars: 'arty_rocket', msta: 'arty_tube',
  recon: 'recon', fpv: 'fpv', orlan: 'uav', lancet: 'loiter', shahed: 'delta', ka52: 'heli', seadrone: 'seadrone', boat: 'boat',
  hq: 'hq', depot: 'depot', fuel: 'fuel_depot', powerplant: 'powerplant', substation: 'substation', radar: 'radar', bunker: 'bunker',
  railcar: 'railcar', bridge_road: 'bridge', bridge_rail: 'bridge', house: 'house', tanktrap: 'tanktrap', sandbag: 'sandbag',
  trench: 'trench', minefield: 'mine', cp_zeppelin: 'zeppelin', cp_aerostat: 'aerostat', cp_airfield: 'airfield', cp_depot: 'depot',
  cp_radio: 'radio', cp_railway: 'railway', cp_village: 'village',
  // V3-M2
  m_d30: 'arty_tube', m_m119: 'arty_tube', m_mt12: 'at', m_tpq36: 'radar_veh', m_zoopark: 'radar_veh', m_mi8: 'heli', m_mi8ru: 'heli',
  m_rail_loco: 'train', m_rail_wagon: 'railcar', m_rail_tank: 'railcar', m_rail_armor: 'train', m_rail_flak: 'railcar',
};

const has = (name) => Object.prototype.hasOwnProperty.call(ICONS, name);
export function resolveIcon(name) {
  if (has(name)) return name;
  if (ALIAS[name] && has(ALIAS[name])) return ALIAS[name];
  if (KEY_MAP[name]) return KEY_MAP[name];
  return 'unknown';
}

// Kategorie-/Rollen-Heuristik für Typen ohne iconKey und ohne Eintrag in KEY_MAP (z. B. neue Epochen)
export function unitIconKey(type) {
  if (!type) return 'unknown';
  if (type.iconKey && (has(type.iconKey) || ALIAS[type.iconKey])) return resolveIcon(type.iconKey);
  const k = type.key;
  if (k && KEY_MAP[k]) return KEY_MAP[k];
  const kinds = (type.weaponDefs || []).map((w) => w && w.kind);
  const model = String(type.model || '');
  const nm = String(type.name || '').toLowerCase();
  if (type.cp) return 'flag';
  if (type.build) return 'sandbag';
  if (type.cls === 'inf') {
    if (type.medic) return 'medic';
    if (type.engineer) return 'engineer';
    if (type.observer) return 'observer';
    if (kinds.includes('sam')) return 'aa_inf';
    if (kinds.includes('atgm')) return 'at';
    if (/scharf|sniper/.test(nm)) return 'sniper';
    if (/spezial|special|speznas|ranger|commando/.test(nm)) return 'special';
    if (/mg|maschinengewehr|machine/.test(nm)) return 'mg';
    return 'inf';
  }
  if (type.cls === 'veh') {
    if (type.rail) return 'train'; // V3-M2
    if (type.towable && /how|haubitze/i.test(String(type.gunKind || '') + nm)) return 'arty_tube';
    if (type.supply) return 'truck';
    if (type.repair) return 'recovery';
    if (kinds.includes('artillery') || /spg|haubitze|howitzer/.test(model + nm)) return 'arty_tube';
    if (/himars|mlrs|rocket|raketenwerfer|katjuscha|katyusha/.test(model + nm)) return 'arty_rocket';
    if (kinds.includes('sam')) return type.airSight > 70 ? 'aa_missile' : 'aa_gun';
    if (type.airSight && !(type.weapons || []).length) return 'radar_veh';
    if (/truck|lkw|supply/.test(model + nm)) return 'truck';
    if (kinds.includes('atgm') && type.armor !== 'heavy') return 'at';
    if (type.armor === 'heavy' || /tank|panzer/.test(model + nm)) return 'tank';
    if (/btr|wheel|rad|jeep|pickup|truck/.test(model)) return 'wheeled';
    return 'ifv';
  }
  if (type.cls === 'air') {
    if (/heli|hubschrauber/.test(model + nm)) return 'heli';
    if (type.kamikaze) return /quad|fpv/.test(model + nm) ? 'fpv' : 'delta';
    if (/quad/.test(model)) return 'recon';
    if (/plane|jet|flugzeug|bomber|fighter/.test(model + nm)) return 'plane';
    return (type.weapons || []).length ? 'plane' : 'uav';
  }
  if (type.cls === 'naval') return type.kamikaze ? 'seadrone' : 'boat';
  if (type.cls === 'struct') {
    if (type.bridge) return 'bridge';
    if (type.airSight || /radar/.test(model)) return 'radar';
    return 'depot';
  }
  if (type.icon && (has(type.icon) || ALIAS[type.icon])) return resolveIcon(type.icon); // type.icon nur als Fallback, wenn es ein Icon-Name ist
  return 'unknown';
}

const attr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const svgCache = new Map();
function body(name) {
  let b = svgCache.get(name);
  if (b) return b;
  b = ICONS[name].map((d) => {
    if (d[0] === '*') return `<path d="${d.slice(1)}" fill="var(--ic-acc,currentColor)" fill-opacity=".3"/>`;
    if (d[0] === '~') return `<path d="${d.slice(1)}" fill="currentColor" stroke="none"/>`;
    if (d[0] === '=') return `<path d="${d.slice(1)}" stroke-dasharray="2.6 2.4"/>`;
    return `<path d="${d}"/>`;
  }).join('');
  svgCache.set(name, b);
  return b;
}

export function icon(name, opts = {}) {
  const n = resolveIcon(name);
  const label = opts.label ?? null;
  const size = opts.size ? ` width="${opts.size}" height="${opts.size}"` : '';
  const style = [opts.color ? `--ic-acc:${opts.color}` : '', opts.stroke ? `stroke-width:${opts.stroke}` : ''].filter(Boolean).join(';');
  const a11y = label ? ` role="img" aria-label="${attr(label)}"` : ' aria-hidden="true" focusable="false"';
  return `<svg class="ic ic-${n}${opts.cls ? ' ' + opts.cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"${size}${style ? ` style="${style}"` : ''}${a11y}>${label ? `<title>${attr(label)}</title>` : ''}${body(n)}</svg>`;
}
export function iconLabel(name) { return ICON_LABELS[name] || ICON_LABELS[resolveIcon(name)] || ''; }
export function iconForUnitType(type, opts = {}) {
  const n = unitIconKey(type);
  return icon(n, { label: opts.label === undefined ? undefined : opts.label, ...opts });
}

// ---------- V3-X: Speichern/Laden, Sichtlinie, Erfolge (aw_*) ----------
const AW_TANK = [T(R(3, 12, 18, 5, 2.5)), T(R(7, 8.5, 8, 4, 1)), 'M15 10.5h6.5', C(7, 14.5, 1), C(12, 14.5, 1), C(17, 14.5, 1)];
const STAR5 = (x, y, r) => { const p = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; p.push(`${(x + Math.cos(a) * rr).toFixed(2)} ${(y + Math.sin(a) * rr).toFixed(2)}`); } return 'M' + p.join('L') + 'z'; };
Object.assign(ICONS, {
  load: [T('M3 6.5h6l2 2h10v11H3z'), 'M12 17v-6M9.5 13.5L12 11l2.5 2.5'],
  los: ['M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z', C(12, 12, 2.8), '=M12 12L22.5 3'],
  voice: ['M3.5 9.5h4l5-4v13l-5-4h-4z', 'M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11'],
  aw_first: [C(12, 12, 9.5), T(STAR5(12, 12.3, 5.6))],
  aw_flag: ['M5 21V3.5', T('M5 4h12l-2.5 4 2.5 4H5')],
  aw_book: [T('M3 5.5c3-1 6-1 9 1v13c-3-2-6-2-9-1z'), T('M21 5.5c-3-1-6-1-9 1v13c3-2 6-2 9-1z')],
  aw_mountain: [T('M2 20l6.5-11 4 6 2.5-4 7 9z'), 'M8.5 9l1.6 2.6'],
  aw_tank: AW_TANK,
  aw_tank2: [...AW_TANK, S(STAR5(12, 4.2, 3.2))],
  aw_inf: [C(12, 7.5, 3), 'M5.5 20.5c0-4 3-6.5 6.5-6.5s6.5 2.5 6.5 6.5', 'M2 12h3M19 12h3'],
  aw_kills: [C(12, 12, 8), C(12, 12, 3), 'M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5'],
  aw_shield: [T('M12 2.8l8 3v6c0 5-3.5 8.3-8 9.6C7.5 20.1 4 16.8 4 11.8v-6z'), 'M8.3 12.2l2.6 2.6 4.9-5.2'],
  aw_bridge: ['M2 8.5h8.5M13.5 8.5H22', T('M3 8.5v3c3 0 4.5 2 4.5 4.5H9c0-2.6.6-4 1.5-4.8V8.5z'), T('M21 8.5v3c-3 0-4.5 2-4.5 4.5H15c0-2.6-.6-4-1.5-4.8V8.5z'), 'M11 11.5l1 1.5M12.8 11l.6 1.8', 'M2 20c2 1 4-1 6 0s4 1 6 0 4-1 8 0'],
  aw_train: [T(R(3, 5, 12, 11, 2)), 'M3 10.5h12', C(6.5, 13, 1), C(11.5, 13, 1), 'M5 16l-1.5 4M13 16l1.5 4', 'M17.5 6l3.5-2M17.5 9.5h4M17.5 13l3.5 2'],
  aw_house: [T('M3 11.5L12 4l9 7.5V20H3z'), T(R(6, 12, 4, 3.2)), 'M10 13.6l7.5-2.3', 'M18.5 10.5l2.5-1M18.6 12.6l2.6.4'],
  aw_sat: [T(R(9.5, 9.5, 5, 5, 1)), T('M2.5 7.5l5.5 3-1.5 2.6-5.5-3z'), T('M21.5 16.5l-5.5-3 1.5-2.6 5.5 3z'), 'M14.5 14.5l2.5 2.5', 'M15.5 21.5a6 6 0 0 0 6-6', 'M3 3l18 18'],
  aw_moon: [T('M15.5 3.5a8.5 8.5 0 1 0 5 13.2A7 7 0 0 1 15.5 3.5z'), S(C(7, 6, 0.9)), S(C(4.5, 11, 0.7))],
  aw_snow: ['M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9', 'M9.5 4.5L12 6.5l2.5-2M9.5 19.5L12 17.5l2.5 2'],
  aw_gold: [T(C(12, 14.5, 6)), 'M8 2.5l2.6 6.3M16 2.5l-2.6 6.3', S(STAR5(12, 14.8, 3.6))],
  aw_gold10: [T(C(6.5, 15, 4)), T(C(17.5, 15, 4)), T(C(12, 12.5, 4.8)), 'M10 3l1.6 4.8M14 3l-1.6 4.8'],
  aw_vet: [T('M4 9l8-5 8 5v3l-8-5-8 5z'), T('M4 15l8-5 8 5v3l-8-5-8 5z')],
  aw_sk: ['M4.5 3.5l12 12', 'M19.5 3.5l-12 12', 'M14 16.5l4 4M16.5 14l4 4M10 16.5l-4 4M7.5 14l-4 4'],
  aw_big: [T(R(2.5, 4, 8, 6, 1)), T(R(13.5, 4, 8, 6, 1)), T(R(2.5, 14, 8, 6, 1)), T(R(13.5, 14, 8, 6, 1))],
  aw_drone: [T(R(9.5, 9.5, 5, 5, 1.2)), QUAD_ARMS, C(5.5, 5.5, 2.2), C(18.5, 5.5, 2.2), C(5.5, 18.5, 2.2), C(18.5, 18.5, 2.2)],
  aw_intercept: [T('M3.5 20.5l7-7 2 2-7 7z'), 'M12.5 11.5l2.5-2.5', T(STAR5(17.5, 6.5, 4.5))],
  aw_elite: [S(STAR5(12, 6, 4)), 'M5 13l7 4 7-4M5 17.5l7 4 7-4'],
  aw_fire: [BLAST],
  aw_clock: [C(12, 13, 8.5), 'M12 8.5V13l3 2', 'M9.5 2.5h5M12 2.5v2'],
  aw_save: [T('M4 3.5h13l3.5 3.5v13.5H4z'), T(R(7, 3.5, 8, 6)), R(7, 13, 10, 7.5)],
});
Object.assign(ICON_LABELS, { load: 'Laden', los: 'Sichtlinie', voice: 'Sprachfunk' });

// ---------- Canvas ----------
const pathCache = new Map();
export function drawIcon(ctx, name, x, y, size, color = '#fff', alpha = 1) {
  const n = resolveIcon(name);
  let parts = pathCache.get(n);
  if (!parts) { parts = ICONS[n].map((d) => ({ m: /^[*~=]/.test(d) ? d[0] : '', p: new Path2D(/^[*~=]/.test(d) ? d.slice(1) : d) })); pathCache.set(n, parts); }
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2); ctx.scale(size / 24, size / 24);
  ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const { m, p } of parts) {
    if (m === '~') ctx.fill(p);
    else {
      if (m === '*') { ctx.globalAlpha = alpha * 0.3; ctx.fill(p); ctx.globalAlpha = alpha; }
      if (m === '=') ctx.setLineDash([2.6, 2.4]);
      ctx.stroke(p);
      if (m === '=') ctx.setLineDash([]);
    }
  }
  ctx.restore();
}

// ---------- Statisches HTML: <i data-icon="stop"></i> ----------
export function hydrateIcons(root = document) {
  if (!root || !root.querySelectorAll) return;
  root.querySelectorAll('[data-icon]').forEach((el) => {
    const n = el.dataset.icon;
    el.classList.add('ic-slot');
    el.innerHTML = icon(n);
    el.removeAttribute('data-icon');
    el.dataset.iconDone = n;
  });
  // Tooltip → aria-label für reine Symbolknöpfe/-leisten
  root.querySelectorAll('button[title]:not([aria-label])').forEach((b) => b.setAttribute('aria-label', b.getAttribute('title').replace(/\s*\(.*\)\s*$/, '')));
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => hydrateIcons());
  else hydrateIcons();
}
