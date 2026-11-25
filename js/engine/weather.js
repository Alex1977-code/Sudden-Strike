// Wetter & Tageszeit (V3-W)
//
//   game.weather = new Weather(game)   (nach Gelände/Renderer-Umgebung/Effects, vor dem ersten Frame – siehe Game.load)
//   weather.update(dt)                 pro Spielschritt (Uhr, Wetterwechsel, Licht, Partikel, HUD, Nachtmarker, Leuchtraketen)
//   weather.set(type, intensity, fadeSec)   Wetter wechseln (weicher Übergang)
//   weather.pack() / weather.apply(o)  serialisierbarer Zustand (Online-Snapshot: Uhrzeit, Wetter, Leuchtraketen)
//   weather.sightMul(unit)             Sichtweiten-Faktor (Wetter + Nacht; Nachtsicht bei moderner Infanterie/Drohnen)
//   weather.moveMul(unit)              Tempo-Faktor (Rasputiza: Rad −35 %, Kette −15 %, Infanterie −10 % abseits von Straßen)
//   weather.airFactor                  ≥ 1: Erschwernis für Drohnen/Flugzeuge (Abklingzeit × airFactor, Abbruchrisiko bei Sturm/Schneetreiben)
//   weather.abilityGate(def)           → { cdMul, abort } für Luft-Fähigkeiten (game.useAbility)
//
// Mission/Gefecht:
//   time:    { start: '05:30', speed: 12 }        speed = Spielminuten pro Echtzeit-Minute (Zeitraffer; 0 = Uhr steht, 12 = 1 h je 5 min)
//   weather: { type, intensity (0..1), fade, changes: [{ at: Sekunden, type, intensity, fade }] }
//   Typen: clear, overcast, rain, storm, snow, fog, rasputiza
// Ohne `time` bleibt das Licht der Mission (env) unverändert (Wettereinflüsse werden darauf angewandt).
import * as THREE from 'three';
import { icon } from '../game/icons.js';
import { MODEL_KIT } from '../game/models.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export const WX_TYPES = {
  clear: { name: 'Klar', icon: 'wx_clear' },
  overcast: { name: 'Bewölkt', icon: 'wx_overcast' },
  rain: { name: 'Regen', icon: 'wx_rain' },
  storm: { name: 'Gewitter', icon: 'wx_storm' },
  snow: { name: 'Schneefall', icon: 'wx_snow' },
  fog: { name: 'Nebel', icon: 'wx_fog' },
  rasputiza: { name: 'Rasputiza (Schlammperiode)', icon: 'wx_mud' },
};

// Parameter je Typ/Intensität (alle 0..1): rain, snow, cloud, fog, wet (nasser Boden), mud (Matsch), thunder, wind
export function paramsFor(type, i = 0.6) {
  i = clamp(+i || 0, 0, 1);
  const P = { rain: 0, snow: 0, cloud: 0, fog: 0, wet: 0, mud: 0, thunder: 0, wind: 0.12 };
  switch (type) {
    case 'overcast': P.cloud = 0.45 + 0.5 * i; P.wind = 0.2; break;
    case 'rain': P.rain = 0.22 + 0.78 * i; P.cloud = 0.55 + 0.4 * i; P.wet = 0.45 + 0.55 * i; P.wind = 0.2 + 0.3 * i; break;
    case 'storm': P.rain = 0.8 + 0.2 * i; P.cloud = 1; P.wet = 1; P.thunder = 1; P.wind = 0.7 + 0.3 * i; break;
    case 'snow': P.snow = 0.25 + 0.75 * i; P.cloud = 0.5 + 0.4 * i; P.wind = 0.15 + 0.6 * i * i; break;
    case 'fog': P.fog = 0.25 + 0.75 * i; P.cloud = 0.45; P.wet = 0.25; P.wind = 0.05; break;
    case 'rasputiza': P.rain = 0.14 + 0.1 * i; P.cloud = 0.8; P.wet = 1; P.mud = clamp(0.35 + 0.9 * i, 0, 1); P.fog = 0.12; P.wind = 0.15; break;
    default: break;
  }
  return P;
}

// ---------------------------------------------------------------- Zeit/Sonne
export function parseClock(s, dflt = 12) {
  if (typeof s === 'number') return ((s % 24) + 24) % 24;
  const m = /^(\d{1,2})(?::(\d{2}))?/.exec(String(s || ''));
  return m ? ((+m[1] + (+m[2] || 0) / 60) % 24 + 24) % 24 : dflt;
}
export const fmtClock = (h) => { const m = Math.floor(((h % 24) + 24) % 24 * 60 + 1e-6); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
const DEC = { spring: 8, summer: 21, autumn: -5, winter: -20 };
// Sonnenhöhe (Grad) und Azimut (Grad ab Süden, positiv Richtung Westen) nach Ortszeit (Breite ~48°)
export function sunAt(hours, season = 'summer', lat = 48) {
  const L = lat * Math.PI / 180, d = (DEC[season] ?? 21) * Math.PI / 180, H = (hours - 12) * 15 * Math.PI / 180;
  const sinE = Math.sin(L) * Math.sin(d) + Math.cos(L) * Math.cos(d) * Math.cos(H);
  const elev = Math.asin(clamp(sinE, -1, 1)) * 180 / Math.PI;
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(L) - Math.tan(d) * Math.cos(L)) * 180 / Math.PI;
  return { elev, az };
}
export function daypartName(hours, elev) {
  if (elev > 8) return 'Tag';
  if (elev > -8) return hours < 12 ? 'Morgengrauen' : 'Abenddämmerung';
  return 'Nacht';
}

// Setup-Hilfe (Gefecht): Auswahl → time/weather-Definitionen. Zufall deterministisch aus dem Seed (Host/Client gleich).
export const SK_WEATHER = { random: 'Zufall', clear: 'Klar', rain: 'Regen', snow: 'Schnee', fog: 'Nebel', rasputiza: 'Rasputiza' };
export const SK_DAYTIME = { day: 'Tag', morning: 'Morgen', evening: 'Abend', night: 'Nacht', cycle: 'Wechsel' };
export function skirmishWeatherDef(choice, seed, season) {
  let c = SK_WEATHER[choice] ? choice : 'clear';
  if (c === 'random') {
    const r = ((Math.imul((seed | 0) ^ 0x9e3779b9, 2654435761) >>> 0) % 1000) / 1000;
    const pool = season === 'winter' ? [['clear', 0.3], ['snow', 0.5], ['fog', 0.2]] : season === 'autumn' ? [['clear', 0.3], ['rain', 0.3], ['rasputiza', 0.25], ['fog', 0.15]] : [['clear', 0.55], ['rain', 0.25], ['fog', 0.12], ['storm', 0.08]];
    let acc = 0; c = 'clear';
    for (const [k, p] of pool) { acc += p; if (r < acc) { c = k; break; } }
  }
  return { choice: c, def: c === 'clear' ? null : { type: c, intensity: c === 'fog' ? 0.5 : c === 'storm' ? 0.7 : 0.55 } };
}
export function skirmishTimeDef(choice) {
  switch (choice) {
    case 'morning': return { start: '05:20', speed: 0 };
    case 'evening': return { start: '19:30', speed: 0 };
    case 'night': return { start: '00:30', speed: 0 };
    case 'cycle': return { start: '06:00', speed: 20 };
    default: return null; // 'day': Licht der Karte unverändert
  }
}

// Kurzbeschreibung für Briefing/Tooltips
export function describeSetting(m) {
  const parts = [];
  const w = m?.weather;
  if (w && w.type && w.type !== 'clear') {
    const i = w.intensity ?? 0.6;
    const lvl = (w.type === 'rain' || w.type === 'snow') ? (i < 0.45 ? 'leichter ' : i > 0.75 ? 'starker ' : '') : '';
    const nm = w.type === 'rain' ? 'Regen' : w.type === 'snow' ? 'Schneefall' : (WX_TYPES[w.type]?.name || w.type);
    parts.push(lvl ? lvl.charAt(0).toUpperCase() + lvl.slice(1) + nm : nm);
  }
  const t = m?.time;
  if (t) {
    const h = parseClock(t.start, 12), s = sunAt(h, DEC[m.env?.season] !== undefined ? m.env.season : 'summer');
    parts.push(`${fmtClock(h)} Uhr (${daypartName(h, s.elev)})${t.speed > 0 ? ', Tageszeit läuft' : ''}`);
  }
  return parts.length ? 'Wetter: ' + parts.join(' · ') : '';
}

// ---------------------------------------------------------------- Shader
const RAIN_VS = `
  attribute vec4 aSeed; attribute float aEnd;
  uniform vec3 uCenter, uSize, uVel; uniform float uTime, uLen, uDens, uAlpha;
  varying float vA;
  void main(){
    if (aSeed.w > uDens) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vA = 0.0; return; }
    vec3 q = aSeed.xyz * uSize + vec3(uVel.x, -uVel.y, uVel.z) * uTime;
    vec3 rel = mod(q - uCenter, uSize) - 0.5 * uSize;
    vec3 pos = uCenter + rel;
    vec3 dir = normalize(vec3(uVel.x, -uVel.y, uVel.z));
    pos -= dir * uLen * aEnd;
    vec3 e = abs(rel) / (0.5 * uSize);
    float edge = 1.0 - smoothstep(0.78, 1.0, max(max(e.x, e.z), e.y));
    vec4 mv = viewMatrix * vec4(pos, 1.0);
    float near = smoothstep(2.0, 12.0, -mv.z);
    vA = uAlpha * edge * near * mix(1.0, 0.18, aEnd) * (0.55 + 0.45 * aSeed.w);
    gl_Position = projectionMatrix * mv;
  }`;
const RAIN_FS = `
  precision highp float; uniform vec3 uCol; varying float vA;
  void main(){ gl_FragColor = vec4(uCol, vA); }`;
const SNOW_VS = `
  attribute vec4 aSeed;
  uniform vec3 uCenter, uSize, uVel; uniform float uTime, uDens, uAlpha, uPx, uFlake;
  varying float vA;
  void main(){
    if (aSeed.w > uDens) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vA = 0.0; return; }
    vec3 q = aSeed.xyz * uSize + vec3(uVel.x, -uVel.y, uVel.z) * uTime;
    vec3 rel = mod(q - uCenter, uSize) - 0.5 * uSize;
    vec3 pos = uCenter + rel;
    float ph = aSeed.w * 80.0;
    pos.x += sin(uTime * 0.9 + ph) * 0.045 * uSize.x * 0.1 + sin(uTime * 2.1 + ph * 1.7) * 0.02 * uSize.x * 0.1;
    pos.z += cos(uTime * 0.7 + ph * 1.3) * 0.045 * uSize.z * 0.1;
    vec3 e = abs(rel) / (0.5 * uSize);
    float edge = 1.0 - smoothstep(0.78, 1.0, max(max(e.x, e.z), e.y));
    vec4 mv = viewMatrix * vec4(pos, 1.0);
    float sz = uPx * uFlake * (0.6 + 0.8 * fract(aSeed.w * 7.0)) / max(1.0, -mv.z);
    gl_PointSize = clamp(sz, 1.6, 8.0);
    vA = uAlpha * edge * smoothstep(2.0, 12.0, -mv.z) * clamp(sz / 2.5, 0.45, 1.0);
    gl_Position = projectionMatrix * mv;
  }`;
const SNOW_FS = `
  precision highp float; uniform vec3 uCol; varying float vA;
  void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d, d) * 4.0; float a = (1.0 - smoothstep(0.35, 1.0, r)) * vA; if (a < 0.01) discard; gl_FragColor = vec4(uCol, a); }`;

// Gelände: Nässe, Pfützen, Matsch, Schneeauflage (hängt sich an den vorhandenen Nebel-/Gelände-Patch)
const TERRAIN_PATCH = `
  #include <roughnessmap_fragment>
  {
    float wxA = fNoise(vFowWorld.xz * 0.06 + 3.7) * 0.6 + fNoise(vFowWorld.xz * 0.19 + 9.1) * 0.4;
    float flat_ = smoothstep(0.93, 0.985, normalize(vFowN).y);
    float wxWet = uWx.x, wxMud = uWx.y, wxSnow = uWx.z;
    diffuseColor.rgb *= 1.0 - 0.26 * wxWet - 0.10 * wxMud;
    float wxCh = max(max(diffuseColor.r, diffuseColor.g), diffuseColor.b) - min(min(diffuseColor.r, diffuseColor.g), diffuseColor.b);
    float wxMk = smoothstep(0.012, 0.05, wxCh); // Asphalt (unbunt) bleibt weitgehend unverschlammt
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.19, 0.125, 0.07) * (0.8 + 0.5 * wxA), 0.5 * wxMud * wxMk);
    roughnessFactor = mix(roughnessFactor, 0.7, wxWet * 0.6);
    float pud = smoothstep(0.68 - 0.1 * wxWet - 0.08 * wxMud, 0.8 - 0.08 * wxWet - 0.06 * wxMud, wxA) * flat_ * step(0.001, wxWet) * clamp(wxWet * 1.3 - 0.25, 0.0, 1.0);
    roughnessFactor = mix(roughnessFactor, 0.4, pud);
    diffuseColor.rgb *= 1.0 - 0.22 * pud;
    float sn = wxSnow * smoothstep(0.6, 0.95, normalize(vFowN).y) * (0.75 + 0.25 * wxA);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.80, 0.83, 0.88), sn * 0.62);
    roughnessFactor = mix(roughnessFactor, 0.92, sn);
  }`;

// Himmel: Wolkendecke (Rauschen), Sterne, Blitz
const SKY_PATCH = {
  decl: `
    uniform float uOvercast, uNight, uFlash, uTimeS; uniform vec3 uCloudCol;
    float skH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float skN(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(skH(i), skH(i + vec2(1.0, 0.0)), u.x), mix(skH(i + vec2(0.0, 1.0)), skH(i + vec2(1.0, 1.0)), u.x), u.y); }
  `,
  main: `
    {
      vec3 dr = normalize(vWorldPosition - cameraPosition);
      float up = max(dr.y, 0.02);
      vec2 cp = dr.xz / (up + 0.25) * 1.6 + vec2(uTimeS * 0.004, uTimeS * 0.0015);
      float cn = skN(cp) * 0.55 + skN(cp * 2.3 + 7.0) * 0.3 + skN(cp * 5.1) * 0.15;
      vec3 cc = uCloudCol * (0.72 + 0.5 * cn) * (1.0 + uFlash * 2.5);
      retColor = mix(retColor, cc, clamp(uOvercast, 0.0, 1.0) * 0.92);
      // Nachthimmel: Grundhelligkeit + Sterne
      vec3 nightBase = mix(vec3(0.012, 0.02, 0.045), vec3(0.03, 0.045, 0.085), 1.0 - clamp(dr.y, 0.0, 1.0));
      retColor = max(retColor, nightBase * uNight);
      vec2 sp = dr.xz / (abs(dr.y) + 0.35) * 160.0;
      float st = step(0.9972, skH(floor(sp))) * smoothstep(0.04, 0.3, dr.y) * uNight * (1.0 - clamp(uOvercast * 1.4, 0.0, 1.0));
      retColor += vec3(0.7, 0.75, 0.9) * st * 0.6;
    }`,
};

const _c = new THREE.Color(), _c2 = new THREE.Color();
const COL = {
  moon: new THREE.Color(0xa8bce8), dusk: new THREE.Color(0xff9458), duskSky: new THREE.Color(0xb48aa0), nightSky: new THREE.Color(0x5a72a8),
  nightGnd: new THREE.Color(0x242a3c), duskFog: new THREE.Color(0xa08a86), nightFog: new THREE.Color(0x141c2e), grey: new THREE.Color(0xc8d0da),
  flare: new THREE.Color(0xffe6b0),
};
const NIGHT_GRADE = { contrast: 0.1, sat: 0.94, shadowTint: [-0.004, 0.004, 0.02], highTint: [0.012, 0.008, 0.0], vignette: 0.26 };
const AIR_ICONS = new Set(['✈️', '🛩️', '🚁', '🐝', '🧵', '🛸']);
const AIR_ID = /fpv|lancet|drone|cas|air|f16|mirage|su\d|mig|medevac|kab|molniya|gleit|shahed|orlan|heli|mi24/i;
const WHEELED = /truck|pickup|btr|himars|radartruck|patriot|s400|pantsir|irist|jeep|wheel|kamaz|ural|hmmwv|iskander|tornado|neptun|supply|stryker|lkw|bm21|grad|tel$/i;

export class Weather {
  constructor(game) {
    this.g = game;
    const m = game.mission || {};
    this.mission = m;
    const gr = game.gr;
    this.gr = gr;
    this.client = !!game.net?.isClient;
    this.t = 0;
    this.season = m.env?.season || game.terrain?.season || 'summer';
    this.mobile = typeof window !== 'undefined' && (window.innerWidth < 900 || (window.matchMedia && matchMedia('(pointer: coarse)').matches));
    const q = game.settings?.quality || 'high';
    this.qMul = (q === 'low' ? 0.45 : q === 'medium' ? 0.7 : q === 'ultra' ? 1.15 : 1) * (this.mobile ? 0.55 : 1);

    // Zeit
    const td = m.time;
    this.hasTime = !!td;
    this.hours = td ? parseClock(td.start, 12) : 12;
    this.speed = td ? +td.speed || 0 : 0; // Spielminuten je Echtzeit-Minute
    this.baseAzim = m.env?.sunAzim ?? 200;

    // Wetter
    const wd = m.weather || {};
    this.type = WX_TYPES[wd.type] ? wd.type : 'clear';
    this.intensity = clamp(wd.intensity ?? 0.6, 0, 1);
    this.changes = (wd.changes || []).filter((c) => WX_TYPES[c.type]).map((c) => ({ ...c })).sort((a, b) => a.at - b.at);
    this.changeIdx = 0;
    this.cur = paramsFor(this.type, this.intensity);
    this.tgt = { ...this.cur };
    this.fadeRate = 1 / 6;
    this.flash = 0; this.nextBolt = 8 + Math.random() * 8; this.boltQ = [];
    this.flares = []; this.flareId = 0; this.flareCd = { UA: 6, RU: 9 }; this.flareScan = 0;
    this.nightF = 0; this.day = 1; this.elev = 40;
    this.airFactor = 1; this.sightRed = 0; this.nightRed = 0;
    this.mudOn = 0;

    this._captureBase(m);
    this._buildParticles();
    this._patchTerrain();
    this._patchSky();
    this._buildMarkers();
    this._buildFlare();
    this._buildHud();
    this.idle = !this.hasTime && this.type === 'clear' && !this.changes.length; // Altverhalten: Licht der Mission bleibt unberührt
    this._derive();
    if (!this.idle) { this._look(0, true); this._particles(0); }
    this._hudT = 0; this._hudKey = '';
    this._audioKey = '';
  }

  // ---------------- Grundwerte aus Renderer (nach setEnvironment) ----------------
  _captureBase(m) {
    const gr = this.gr;
    // Nachtmissionen mit Tageszeit: Tagesbasis herstellen, die Uhr steuert dann das Licht
    if (this.hasTime && (m.env?.night || gr.night)) gr.setEnvironment({ ...(m.env || {}), night: false });
    const gu = gr.gradeMat.uniforms;
    this.base = {
      sun: gr.sun.color.clone(), sunI: gr.sun.intensity, hemiSky: gr.hemi.color.clone(), hemiGnd: gr.hemi.groundColor.clone(), hemiI: gr.hemi.intensity,
      exposure: gr.renderer.toneMappingExposure, envI: gr.scene.environmentIntensity ?? 0.5,
      fog: gr.scene.fog ? gr.scene.fog.color.clone() : new THREE.Color(0xb4c4d4), fogD: gr.scene.fog ? gr.scene.fog.density : 0.0032,
      sunDir: gr.sunDir.clone(), night: !!gr.night,
      grade: { contrast: gu.uContrast.value, sat: gu.uSat.value, shadowTint: gu.uShadowTint.value.toArray(), highTint: gu.uHighTint.value.toArray(), vignette: gu.uVignette.value },
      sky: { turbidity: gr.sky.material.uniforms.turbidity.value, rayleigh: gr.sky.material.uniforms.rayleigh.value, sunPos: gr.sky.material.uniforms.sunPosition.value.clone() },
    };
    this.grade = { ...this.base.grade, shadowTint: [0, 0, 0], highTint: [0, 0, 0] };
  }

  // ---------------- Partikel ----------------
  _buildParticles() {
    const N = Math.round(5600 * this.qMul), M = Math.round(5200 * this.qMul);
    this.nRain = N; this.nSnow = M;
    const rnd = (n) => { const a = new Float32Array(n * 4); for (let i = 0; i < a.length; i++) a[i] = Math.random(); return a; };
    // Regen: LineSegments (2 Vertices je Strich)
    const rs = rnd(N), seed = new Float32Array(N * 2 * 4), end = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) for (let k = 0; k < 2; k++) { for (let c = 0; c < 4; c++) seed[(i * 2 + k) * 4 + c] = rs[i * 4 + c]; end[i * 2 + k] = k; }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3));
    rg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    rg.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    rg.userData.shared = false;
    this.rainU = {
      uCenter: { value: new THREE.Vector3() }, uSize: { value: new THREE.Vector3(100, 60, 100) }, uVel: { value: new THREE.Vector3(1, 24, 0.5) },
      uTime: { value: 0 }, uLen: { value: 1.4 }, uDens: { value: 0 }, uAlpha: { value: 0.3 }, uCol: { value: new THREE.Color(0.8, 0.86, 0.96) },
    };
    this.rainMat = new THREE.ShaderMaterial({ uniforms: this.rainU, vertexShader: RAIN_VS, fragmentShader: RAIN_FS, transparent: true, depthWrite: false, fog: false });
    this.rain = new THREE.LineSegments(rg, this.rainMat);
    this.rain.frustumCulled = false; this.rain.renderOrder = 6; this.rain.visible = false;
    // Schnee: Points
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(M * 3), 3));
    sg.setAttribute('aSeed', new THREE.BufferAttribute(rnd(M), 4));
    this.snowU = {
      uCenter: { value: new THREE.Vector3() }, uSize: { value: new THREE.Vector3(100, 60, 100) }, uVel: { value: new THREE.Vector3(1, 2.2, 0.5) },
      uTime: { value: 0 }, uDens: { value: 0 }, uAlpha: { value: 0.8 }, uPx: { value: 600 }, uFlake: { value: 0.16 }, uCol: { value: new THREE.Color(0.95, 0.97, 1.0) },
    };
    this.snowMat = new THREE.ShaderMaterial({ uniforms: this.snowU, vertexShader: SNOW_VS, fragmentShader: SNOW_FS, transparent: true, depthWrite: false, fog: false });
    this.snow = new THREE.Points(sg, this.snowMat);
    this.snow.frustumCulled = false; this.snow.renderOrder = 6; this.snow.visible = false;
    this.gr.scene.add(this.rain, this.snow);
  }

  // ---------------- Gelände-/Himmel-Patches ----------------
  _patchTerrain() {
    this.wxU = { value: new THREE.Vector4(0, 0, 0, 0) };
    const mesh = this.g.terrain?.mesh, mat = mesh?.material;
    if (!mat || mat.userData?.wxPatched) return;
    const prev = mat.onBeforeCompile, U = this.wxU;
    mat.onBeforeCompile = function (shader, r) {
      if (prev) prev.call(this, shader, r);
      shader.uniforms.uWx = U;
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec4 uWx;')
        .replace('#include <roughnessmap_fragment>', TERRAIN_PATCH);
    };
    mat.userData.wxPatched = true;
    mat.customProgramCacheKey = () => 'wx1';
    mat.needsUpdate = true;
  }
  _patchSky() {
    const mat = this.gr.sky.material;
    if (!mat.uniforms.uOvercast) {
      Object.assign(mat.uniforms, { uOvercast: { value: 0 }, uNight: { value: 0 }, uFlash: { value: 0 }, uTimeS: { value: 0 }, uCloudCol: { value: new THREE.Color(0.55, 0.58, 0.64) } });
      mat.fragmentShader = mat.fragmentShader
        .replace('void main() {', SKY_PATCH.decl + '\nvoid main() {')
        .replace('gl_FragColor = vec4( retColor, 1.0 );', SKY_PATCH.main + '\n gl_FragColor = vec4( retColor, 1.0 );');
      mat.needsUpdate = true;
    }
    this.skyU = mat.uniforms;
  }

  // ---------------- Nachtmarker (IFF-Ringe unter Einheiten), Leuchtrakete ----------------
  _buildMarkers() {
    const geo = new THREE.RingGeometry(0.72, 1, 28); geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.0, depthWrite: false, toneMapped: false });
    this.maxMarks = 260;
    this.marks = new THREE.InstancedMesh(geo, mat, this.maxMarks);
    this.marks.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.maxMarks * 3), 3);
    this.marks.count = 0; this.marks.frustumCulled = false; this.marks.renderOrder = 4; this.marks.visible = false;
    this.gr.scene.add(this.marks);
  }
  _buildFlare() {
    // Die Leuchtraketen-Lichtquelle existiert immer (Intensität 0), damit sich die Lichtanzahl nie ändert (kein Shader-Recompile)
    this.flareLight = new THREE.PointLight(0xffe6b0, 0, 110, 2);
    this.gr.scene.add(this.flareLight);
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const x = cv.getContext('2d'), gd = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gd.addColorStop(0, 'rgba(255,250,225,1)'); gd.addColorStop(0.25, 'rgba(255,225,160,0.7)'); gd.addColorStop(1, 'rgba(255,200,120,0)');
    x.fillStyle = gd; x.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    this.flareSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false, color: new THREE.Color(3, 2.6, 1.8) }));
    this.flareSprite.visible = false; this.flareSprite.renderOrder = 7;
    this.gr.scene.add(this.flareSprite);
  }

  // ---------------- HUD ----------------
  _buildHud() {
    if (typeof document === 'undefined') return;
    let el = document.getElementById('wx-chip');
    if (!el) {
      const st = document.createElement('style');
      st.textContent = `#wx-chip{display:inline-flex;align-items:center;gap:6px;background:var(--panel,rgba(14,18,24,.78));border-radius:8px;padding:5px 9px;margin-right:6px;font-weight:600;font-variant-numeric:tabular-nums;cursor:default;vertical-align:top}
#wx-chip svg{width:18px;height:18px;flex:none}#wx-chip .wx-i2{opacity:.9}#wx-chip.hidden{display:none}
@media (max-width:900px){#wx-chip{padding:3px 6px;font-size:12px;gap:4px;margin-right:4px}#wx-chip svg{width:15px;height:15px}}`;
      document.head.appendChild(st);
      el = document.createElement('div'); el.id = 'wx-chip'; el.className = 'hidden';
      const tr = document.getElementById('topright');
      if (tr) tr.insertBefore(el, tr.firstChild); else document.body.appendChild(el);
    }
    this.hudEl = el;
  }
  describe() {
    const lines = [];
    const w = WX_TYPES[this.type];
    lines.push(`${w.name}${this.type === 'rain' || this.type === 'snow' ? (this.intensity < 0.45 ? ' (leicht)' : this.intensity > 0.75 ? ' (stark)' : '') : ''}`);
    if (this.hasTime) lines.push(`${fmtClock(this.hours)} Uhr · ${daypartName(this.hours, this.elev)}`);
    const sr = Math.round((1 - this.sightMulBase()) * 100);
    if (sr > 0) lines.push(`Sichtweite −${sr} %`);
    if (this.nightF > 0.3) lines.push('Nacht: Sicht −30 % (Nachtsicht: −10 %); Leuchtraketen bei Feindkontakt');
    if (this.cur.mud > 0.3) lines.push('Matsch abseits von Straßen: Rad −35 %, Kette −15 %, Infanterie −10 %');
    if (this.airFactor > 1.05) lines.push(`Drohnen/Flugzeuge: Abklingzeit +${Math.round((this.airFactor - 1) * 100)} %${this.airFactor >= 1.5 ? ', Einsatz kann abbrechen' : ''}`);
    return lines;
  }
  _hud(dt) {
    const el = this.hudEl; if (!el) return;
    this._hudT -= dt; if (this._hudT > 0) return;
    this._hudT = 0.5;
    const show = this.hasTime || this.type !== 'clear';
    const clk = this.hasTime ? fmtClock(this.hours) : '';
    const part = this.hasTime ? (this.elev > 8 ? '' : this.elev > -8 ? (this.hours < 12 ? 'wx_dawn' : 'wx_dusk') : 'wx_moon') : '';
    const key = `${show}|${clk}|${this.type}|${Math.round(this.intensity * 10)}|${part}`;
    if (key === this._hudKey) return;
    this._hudKey = key;
    el.classList.toggle('hidden', !show || this.g.demo);
    const w = WX_TYPES[this.type];
    const lines = this.describe();
    el.title = lines.join('\n');
    el.setAttribute('aria-label', lines.join(', '));
    const main = this.type !== 'clear' ? w.icon : (part || 'wx_clear');
    el.innerHTML = icon(main) + (part && this.type !== 'clear' ? `<span class="wx-i2">${icon(part)}</span>` : '') + (clk ? `<span>${clk}</span>` : '');
  }

  // ---------------- Steuerung ----------------
  set(type, intensity = 0.6, fadeSec = 8) {
    if (!WX_TYPES[type]) return;
    this.idle = false;
    this.type = type; this.intensity = clamp(+intensity, 0, 1);
    this.tgt = paramsFor(type, this.intensity);
    this.fadeRate = 1 / Math.max(0.05, +fadeSec || 0);
    if (fadeSec <= 0) this.cur = { ...this.tgt };
  }
  setTime(clock, speed) { this.hours = parseClock(clock, this.hours); if (speed !== undefined) this.speed = +speed || 0; this.hasTime = this.hasTime || true; }
  pack() {
    return { h: Math.round(this.hours * 1000) / 1000, s: this.speed, ht: this.hasTime ? 1 : 0, ty: this.type, i: Math.round(this.intensity * 100) / 100, fl: this.flares.map((f) => [f.id, Math.round(f.x), Math.round(f.z), Math.round(f.t * 10) / 10, f.team]) };
  }
  apply(o) {
    if (!o) return;
    if (o.ht && !this.hasTime) { this.hasTime = true; this.idle = false; }
    if (o.h !== undefined) { let d = o.h - this.hours; if (d > 12) d -= 24; if (d < -12) d += 24; if (Math.abs(d) > 0.02) this.hours = ((o.h % 24) + 24) % 24; }
    if (o.s !== undefined) this.speed = o.s;
    if (o.ty && (o.ty !== this.type || Math.abs((o.i ?? this.intensity) - this.intensity) > 0.005)) this.set(o.ty, o.i ?? this.intensity, 8);
    if (o.fl) {
      for (const [id, x, z, t, team] of o.fl) {
        if (!this.flares.some((f) => f.id === id)) this._addFlare(x, z, team, t, id);
      }
    }
  }
  serialize() { return this.pack(); }
  restore(o) { this.apply(o); }

  // Beobachter-Sicht: Wetter-/Nachtfaktor
  sightMulBase() { return 1 - this.sightRed; }
  sightMul(o) {
    let m = 1 - this.sightRed;
    if (this.nightRed > 0.005) {
      const t = o.type;
      const nv = t.air || (t.infantry && (!t.era || t.era === 'modern'));
      let red = nv ? this.nightRed / 3 : this.nightRed;
      if (this.flares.length && o.pos) for (const f of this.flares) { const dx = o.pos.x - f.x, dz = o.pos.z - f.z; if (dx * dx + dz * dz < f.r * f.r) { red = 0; break; } }
      m *= 1 - red;
    }
    if (o.type.air && this.airFactor > 1) m *= 1 / (1 + 0.12 * (this.airFactor - 1));
    return m;
  }
  moveMul(u) {
    const t = u.type;
    if (t.air) return this.airFactor > 1.2 ? 1 / Math.sqrt(this.airFactor) : 1;
    const mud = this.cur.mud;
    if (mud < 0.03 || t.naval) return 1;
    const G = this.g;
    if (G.terrain.onRoad(u.pos.x, u.pos.z)) return 1;
    let r;
    if (t.infantry || !t.vehicle) r = 0.10;
    else {
      let c = t._wxCls;
      if (!c) c = t._wxCls = (t.armor !== 'heavy' && WHEELED.test((t.model || '') + ' ' + (t.key || ''))) ? 'w' : 'k';
      r = c === 'w' ? 0.35 : 0.15;
    }
    return 1 - r * mud;
  }
  isAirAbility(def) { return !!def && (AIR_ICONS.has(def.icon) || AIR_ID.test(def.id || def.key || '')); }
  abilityGate(def) {
    if (this.airFactor <= 1.02 || !this.isAirAbility(def)) return { cdMul: 1, abort: false };
    const f = this.airFactor;
    const p = f >= 1.5 ? 0.1 + (f - 1.5) * 0.6 : 0;
    return { cdMul: f, abort: Math.random() < p, msg: `Einsatz wegen ${WX_TYPES[this.type]?.name || 'Wetter'} abgebrochen – kein Flugwetter! Neuer Versuch in Kürze.` };
  }

  // ---------------- Leuchtraketen ----------------
  _addFlare(x, z, team, t = 20, id = ++this.flareId) {
    if (id > this.flareId) this.flareId = id;
    const f = { id, x, z, team, t, t0: 20, r: 40 };
    this.flares.push(f);
    const g = this.g;
    if (!this.client && team && g.addReveal) g.addReveal(x, z, 34, 20, team);
    else if (this.client && team === g.localSide && g.addReveal) g.addReveal(x, z, 34, Math.max(1, t), team);
    try { g.audio?.shot?.('missile', x, z); } catch (e) { /* Audio optional */ }
    return f;
  }
  fireFlare(x, z, team = null) { return this._addFlare(x, z, team); }
  _autoFlares(dt) {
    if (this.client || this.nightF < 0.55) return;
    for (const k in this.flareCd) this.flareCd[k] -= dt;
    this.flareScan -= dt; if (this.flareScan > 0) return;
    this.flareScan = 2.5;
    const g = this.g;
    for (const A of ['UA', 'RU']) {
      if (this.flareCd[A] > 0) continue;
      const B = A === 'UA' ? 'RU' : 'UA';
      let pick = null, n = 0;
      for (const u of g.units) {
        if (!u.alive || u.side !== A || u.type.structure || u.type.air || !u.seenBy?.[B]) continue;
        if (this.flares.some((f) => (u.pos.x - f.x) ** 2 + (u.pos.z - f.z) ** 2 < (f.r * 0.8) ** 2)) continue;
        if (++n === 1 || Math.random() < 1 / n) pick = u;
      }
      if (pick) { this._addFlare(pick.pos.x + (Math.random() - 0.5) * 10, pick.pos.z + (Math.random() - 0.5) * 10, B); this.flareCd[B] = 26; }
    }
  }
  _updateFlares(dt) {
    const L = this.flareLight, S = this.flareSprite;
    for (let i = this.flares.length - 1; i >= 0; i--) { const f = this.flares[i]; f.t -= dt; if (f.t <= 0) this.flares.splice(i, 1); }
    const f = this.flares[0];
    if (!f) { L.intensity = 0; S.visible = false; return; }
    const age = f.t0 - f.t, fade = smooth(0, 1.2, age) * smooth(0, 4, f.t);
    const y = this.g.terrain.surface(f.x, f.z) + 46 - age * 0.9;
    const flick = 0.9 + 0.1 * Math.sin(this.t * 31 + f.id) + 0.05 * Math.sin(this.t * 13);
    L.position.set(f.x, y, f.z);
    L.intensity = 2600 * fade * flick * (0.45 + 0.55 * this.nightF);
    S.visible = true; S.position.set(f.x, y, f.z); S.scale.setScalar(9 * (0.8 + 0.2 * flick)); S.material.opacity = fade;
  }

  // ---------------- Abgeleitete Werte ----------------
  _derive() {
    const c = this.cur;
    const rl = Math.max(c.rain, c.snow);
    this.sightRed = Math.round(Math.max(0.1 * smooth(0, 0.2, rl) + 0.1 * rl, 0.2 * c.fog * 0.9) * 50) / 50; // quantisiert: Sichtsektor-Cache bleibt gültig
    this.airFactor = 1 + 0.3 * c.rain + 0.6 * c.snow * c.snow + 0.5 * c.thunder + 0.2 * c.fog;
    this.nightRed = Math.round(0.3 * this.nightF * 50) / 50;
  }

  // ---------------- Licht ----------------
  _look(dt, force) {
    const gr = this.gr, B = this.base, c = this.cur;
    let e, day, nightF, twil, sunDirV = null;
    if (this.hasTime) {
      const s = sunAt(this.hours, this.season);
      e = s.elev;
      day = smooth(-4, 8, e); nightF = 1 - smooth(-14, -3, e); twil = (1 - day) * (1 - nightF);
      const th = (90 - e) * Math.PI / 180, ph = (this.baseAzim + s.az) * Math.PI / 180;
      sunDirV = new THREE.Vector3().setFromSphericalCoords(1, th, ph);
      this._sunRaw = sunDirV;
    } else { e = B.night ? -4 : 30; day = B.night ? 0 : 1; nightF = B.night ? 1 : 0; twil = 0; }
    this.elev = e; this.day = day; this.nightF = nightF;
    this._derive();
    const flash = this.flash;
    const cloud = clamp(c.cloud + 0.15 * c.fog, 0, 1);
    const wet = c.wet;

    if (this.hasTime) {
      const low = 1 - smooth(4, 30, e);
      _c.copy(B.sun).lerp(COL.dusk, low * 0.7);
      _c.lerp(COL.moon, 1 - day);
      gr.sun.color.copy(_c).lerp(COL.grey, cloud * 0.55);
      const sunI = B.sunI * (0.15 + 0.85 * smooth(-1, 22, e)) * day * (1 - 0.62 * cloud) + 1.25 * (1 - day) * (1 - 0.35 * cloud);
      gr.sun.intensity = sunI;
      // Schattenrichtung: Sonne (nie unter 0.3 Höhe) → Mond
      const sd = sunDirV.clone(); if (sd.y < 0.3) { sd.y = 0.3; sd.normalize(); }
      const moon = new THREE.Vector3(-sunDirV.x * 0.8, 0.8, -sunDirV.z * 0.8).normalize();
      gr.sunDir.copy(sd).lerp(moon, 1 - day).normalize();
      // Himmelslicht
      _c.copy(B.hemiSky).lerp(COL.duskSky, twil * 0.6).lerp(COL.nightSky, nightF);
      gr.hemi.color.copy(_c).lerp(COL.grey, cloud * 0.25);
      _c.copy(B.hemiGnd).lerp(COL.nightGnd, nightF);
      gr.hemi.groundColor.copy(_c);
      gr.hemi.intensity = (B.hemiI * (1 + 0.35 * twil) + (1.05 - B.hemiI) * nightF) * (1 + 0.28 * cloud);
      gr.renderer.toneMappingExposure = (B.exposure + (1.62 - B.exposure) * nightF + 0.22 * twil) * (1 + 0.05 * cloud);
      gr.scene.environmentIntensity = B.envI * (1 - 0.6 * nightF) * (1 - 0.3 * twil);
      _c.copy(B.fog).lerp(COL.duskFog, twil * 0.7).lerp(COL.nightFog, nightF);
      // Sky-Shader
      const sp = this.skyU.sunPosition.value; sp.copy(sunDirV).multiplyScalar(1);
      this.skyU.uNight.value = nightF;
    } else {
      gr.sun.color.copy(B.sun).lerp(COL.grey, cloud * 0.55);
      gr.sun.intensity = B.sunI * (1 - 0.62 * cloud);
      gr.hemi.intensity = B.hemiI * (1 + 0.28 * cloud);
      gr.renderer.toneMappingExposure = B.exposure * (1 + 0.05 * cloud);
      _c.copy(B.fog);
      this.skyU.uNight.value = nightF;
    }
    // Wetter: Nebelfarbe/-dichte, Wolken im Himmel, Blitz
    const L = clamp(0.12 + 0.88 * day * (0.35 + 0.65 * smooth(0, 25, e)), 0.08, 1);
    if (gr.scene.fog) {
      _c2.copy(COL.grey).multiplyScalar(0.3 + 0.55 * L); _c2.lerp(_c, 1 - clamp(c.fog * 0.8 + cloud * 0.35, 0, 1));
      gr.scene.fog.color.copy(_c2);
      gr.scene.fog.density = B.fogD * (this.hasTime ? 1 + 0.15 * nightF : 1) * (1 + 0.85 * c.fog + 0.25 * c.rain + 0.18 * c.snow + 0.08 * cloud);
    }
    this.skyU.uOvercast.value = clamp(cloud * 0.95 + c.fog * 0.25, 0, 1);
    this.skyU.uFlash.value = flash;
    this.skyU.uTimeS.value = this.t % 5000;
    _c.setRGB(0.6, 0.64, 0.72).multiplyScalar(0.12 + 0.88 * L * (1 - 0.3 * c.rain)); this.skyU.uCloudCol.value.copy(_c);
    if (flash > 0.01) { gr.hemi.intensity += 2.4 * flash; gr.renderer.toneMappingExposure *= 1 + 0.3 * flash; }
    // Grade
    const G = this.grade, bg = B.grade;
    if (this.hasTime) {
      G.contrast = lerp(bg.contrast, NIGHT_GRADE.contrast, nightF); G.sat = lerp(bg.sat, NIGHT_GRADE.sat, nightF);
      G.vignette = lerp(bg.vignette, NIGHT_GRADE.vignette, nightF);
      for (let i = 0; i < 3; i++) {
        G.shadowTint[i] = lerp(bg.shadowTint[i], NIGHT_GRADE.shadowTint[i], nightF);
        G.highTint[i] = lerp(bg.highTint[i], NIGHT_GRADE.highTint[i], nightF) + [0.03, 0.01, -0.025][i] * twil;
      }
    } else { G.contrast = bg.contrast; G.sat = bg.sat; G.vignette = bg.vignette; for (let i = 0; i < 3; i++) { G.shadowTint[i] = bg.shadowTint[i]; G.highTint[i] = bg.highTint[i]; } }
    G.sat *= 1 - 0.16 * cloud - 0.06 * c.snow;
    G.contrast *= 1 - 0.18 * cloud;
    gr.setGrade(G);
    // Nässe/Pfützen/Schnee am Boden
    this.wxU.value.set(wet, c.mud, Math.min(1, c.snow * 1.2), 0);
    // Effekte nachts heller
    const fx = this.g.effects; if (fx) fx.flashMul = 1 + 1.6 * nightF;
    // Scheinwerfer/Kennzeichen
    this._night(nightF);
  }
  _night(nf) {
    const k = Math.round(nf * 20);
    if (k === this._nk) return; this._nk = k;
    try {
      const M = this._M || (this._M = this._models());
      if (M?.headlight) { M.headlight.emissive.setHex(0xfff0b0); M.headlight.emissiveIntensity = 1 + 5 * nf; }
      for (const key of ['iffUA', 'iffUA2']) if (M?.[key]) M[key].emissiveIntensity = 1 + 3 * nf;
    } catch (e) { /* Materialien optional */ }
  }
  _models() { return MODEL_KIT.M; }

  // ---------------- Partikel/Marker pro Frame ----------------
  _particles(dt) {
    const gr = this.gr, cam = gr.camera, g = this.g, c = this.cur;
    const tgt = g.camera?.target, dist = g.camera?.dist || 80;
    const S = clamp(dist * 1.7, 70, 300);
    const cp = cam.position;
    const gy = tgt ? tgt.y : 0;
    const H = clamp(cp.y - gy + 18, 36, 220);
    const cx = tgt ? lerp(cp.x, tgt.x, 0.6) : cp.x, cz = tgt ? lerp(cp.z, tgt.z, 0.6) : cp.z;
    const sc = S / 90;
    const wd = g.effects?.wind || { x: 0.8, z: 0.4 };
    const wl = Math.hypot(wd.x, wd.z) || 1, wx = wd.x / wl, wz = wd.z / wl;
    const wind = c.wind;
    this.t += dt;
    const tm = this.t % 3000;
    const L = clamp(0.2 + 0.8 * this.day * (0.4 + 0.6 * smooth(0, 25, this.elev)), 0.18, 1) * (1 - 0.15 * c.cloud) + 0.18 * this.flash;
    // Regen
    const rainAmt = clamp(c.rain, 0, 1);
    this.rain.visible = rainAmt > 0.02;
    if (this.rain.visible) {
      const u = this.rainU;
      u.uCenter.value.set(cx, gy + H * 0.5 - 4, cz); u.uSize.value.set(S, H, S);
      u.uVel.value.set(wx * (2 + 9 * wind), 22 + 8 * rainAmt, wz * (2 + 9 * wind));
      u.uTime.value = tm; u.uLen.value = 0.8 * sc * (0.7 + 0.5 * rainAmt); u.uDens.value = 0.35 + 0.65 * rainAmt;
      u.uAlpha.value = 0.17 + 0.12 * rainAmt;
      u.uCol.value.setRGB(0.78, 0.84, 0.95).multiplyScalar(0.3 + 0.8 * L);
      this.rain.geometry.setDrawRange(0, this.nRain * 2);
    }
    // Schnee
    const snowAmt = clamp(c.snow, 0, 1);
    this.snow.visible = snowAmt > 0.02;
    if (this.snow.visible) {
      const u = this.snowU;
      u.uCenter.value.set(cx, gy + H * 0.5 - 4, cz); u.uSize.value.set(S, H, S);
      u.uVel.value.set(wx * (1.2 + 9 * wind), 1.9 + 1.3 * snowAmt, wz * (1.2 + 9 * wind));
      u.uTime.value = tm; u.uDens.value = snowAmt;
      u.uAlpha.value = 0.82;
      u.uPx.value = (gr.intH || 700) / (2 * Math.tan(cam.fov * Math.PI / 360));
      u.uFlake.value = 0.2 * sc * 0.55 + 0.1;
      u.uCol.value.setRGB(0.95, 0.97, 1.0).multiplyScalar(0.3 + 1.1 * L);
    }
  }
  _markers(nf) {
    const M = this.marks, g = this.g;
    const on = nf > 0.35 && !g.demo;
    M.visible = on;
    if (!on) return;
    M.material.opacity = clamp((nf - 0.35) * 1.6, 0, 0.8);
    const ls = g.localSide, arr = M.instanceMatrix.array, col = M.instanceColor.array;
    let n = 0;
    for (const u of g.units) {
      if (n >= this.maxMarks) break;
      if (!u.alive || u.type.structure || u.type.air || u.type.kamikaze || u.side === 'N' || !u.root.visible || u.garrison) continue;
      const i = n * 16, s = Math.max(0.95, u.radius * 0.95);
      arr[i] = s; arr[i + 1] = 0; arr[i + 2] = 0; arr[i + 3] = 0; arr[i + 4] = 0; arr[i + 5] = s; arr[i + 6] = 0; arr[i + 7] = 0;
      arr[i + 8] = 0; arr[i + 9] = 0; arr[i + 10] = s; arr[i + 11] = 0;
      arr[i + 12] = u.pos.x; arr[i + 13] = g.terrain.surface(u.pos.x, u.pos.z) + 0.18; arr[i + 14] = u.pos.z; arr[i + 15] = 1;
      const own = u.side === ls, o3 = n * 3;
      if (g.isOwn(u)) { col[o3] = 0.04; col[o3 + 1] = 0.3; col[o3 + 2] = 0.1; } else if (own) { col[o3] = 0.04; col[o3 + 1] = 0.16; col[o3 + 2] = 0.34; } else { col[o3] = 0.4; col[o3 + 1] = 0.06; col[o3 + 2] = 0.04; }
      n++;
    }
    M.count = n; M.instanceMatrix.needsUpdate = true; M.instanceColor.needsUpdate = true;
  }

  // ---------------- Hauptschleife ----------------
  update(dt) {
    if (!dt) return;
    const g = this.g;
    if (this.hasTime && this.speed) this.hours = (this.hours + dt * this.speed / 3600) % 24;
    if (!this.client) {
      while (this.changeIdx < this.changes.length && g.time >= this.changes[this.changeIdx].at) {
        const c = this.changes[this.changeIdx++]; this.set(c.type, c.intensity ?? 0.6, c.fade ?? 12);
      }
    }
    if (this.idle) { this._hud(dt); return; }
    // Parameter weich nachführen
    const step = this.fadeRate * dt;
    for (const k in this.tgt) { const d = this.tgt[k] - this.cur[k]; this.cur[k] += Math.abs(d) <= step ? d : Math.sign(d) * step; }
    // Blitze
    const c = this.cur;
    this.flash = Math.max(0, this.flash - dt * 3.2);
    if (c.thunder > 0.5) {
      this.nextBolt -= dt;
      if (this.nextBolt <= 0) {
        this.nextBolt = 7 + Math.random() * 14; this.flash = 1;
        this.boltQ.push({ t: 0.25 + Math.random() * 0.2, dbl: true }, { t: 1 + Math.random() * 2.5, thunder: true });
      }
    }
    for (let i = this.boltQ.length - 1; i >= 0; i--) {
      const b = this.boltQ[i]; b.t -= dt;
      if (b.t > 0) continue;
      this.boltQ.splice(i, 1);
      if (b.dbl) this.flash = 0.7; else if (b.thunder) { try { g.audio?.thunder?.(300 + Math.random() * 1500); } catch (e) { /* */ } }
    }
    this._look(dt);
    this._particles(dt);
    this._markers(this.nightF);
    this._autoFlares(dt);
    this._updateFlares(dt);
    this._hud(dt);
    // Ton
    const ak = Math.round(c.rain * 10) + '|' + Math.round(c.wind * 10);
    if (ak !== this._audioKey) { this._audioKey = ak; try { g.audio?.setWeather?.({ rain: Math.min(1, c.rain * 1.1 + c.snow * 0.0), wind: Math.max(0, c.wind - 0.1) * (c.snow > 0.3 ? 1.3 : 1) }); } catch (e) { /* */ } }
  }

  dispose() {
    try { this.g.audio?.setWeather?.({ rain: 0, wind: 0 }); } catch (e) { /* */ }
    if (this.hudEl) this.hudEl.classList.add('hidden');
    const fx = this.g.effects; if (fx) fx.flashMul = 1;
    if (this._nk !== undefined) { this._nk = undefined; try { this._night(0); } catch (e) { /* */ } }
    if (this.skyU) { this.skyU.uOvercast.value = 0; this.skyU.uNight.value = 0; this.skyU.uFlash.value = 0; }
  }
}
