// Render-Pipeline: PBR, Himmel, Schatten, Bloom, MSAA/FXAA, Color Grading, SSU-Upscaling (DLSS-ähnlich) + dynamische Auflösung
//
// Ablauf pro Frame (alle Zwischenstufen in interner Auflösung intW×intH):
//   1. Szene → sceneRT (HDR, HalfFloat, WebGL2-Multisampling je Qualitätsstufe)
//   2. Bloom (UnrealBloomPass, nur Mip-Kette – das Zusammenmischen übernimmt Schritt 3)
//   3. Grade-Pass: HDR + Bloom → ACES-Tonemapping → sRGB → Kontrast/Sättigung/Tönung/Vignette → ldrRT (Luma im Alpha)
//   4. SSU-Pass (Ausgabeauflösung outW×outH, Bildschirm): Catmull-Rom-Upscaling + CAS-Schärfen,
//      bei Qualität „low“ (kein MSAA) zusätzlich FXAA
import * as THREE from 'three';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { clamp } from './util.js';

export const UPSCALE_MODES = { native: 1, quality: 0.67, balanced: 0.58, performance: 0.5, ultraperf: 0.33 };

// Qualitätsprofile: MSAA-Samples, Schattenauflösung, DPR-Kappe, Schattenreichweite, Untergrenze der dyn. Auflösung
const QUALITY = {
  low: { samples: 0, shadow: 1024, dpr: 1.25, shadowRange: 0.7, softShadows: false, minScale: 0.6 },
  medium: { samples: 2, shadow: 2048, dpr: 1.75, shadowRange: 0.85, softShadows: true, minScale: 0.6 },
  high: { samples: 4, shadow: 2048, dpr: 2, shadowRange: 1, softShadows: true, minScale: 0.6 },
  ultra: { samples: 4, shadow: 4096, dpr: 2.5, shadowRange: 1.15, softShadows: true, minScale: 0.65 },
};

// Licht-/Grading-Voreinstellungen je Umgebung
const ENV_PRESETS = {
  summer: {
    sun: 0xffeccc, sunI: 2.9, hemiSky: 0xbcd6ff, hemiGround: 0x5a4a32, hemiI: 0.55, exposure: 0.95, envI: 0.5,
    fog: 0xb4c4d4, turbidity: 8, rayleigh: 1.6,
    grade: { contrast: 0.2, sat: 1.16, shadowTint: [-0.012, 0.004, 0.016], highTint: [0.018, 0.006, -0.014], vignette: 0.24 },
  },
  autumn: {
    sun: 0xffe2bc, sunI: 2.7, hemiSky: 0xc0d2ec, hemiGround: 0x5a4630, hemiI: 0.55, exposure: 0.95, envI: 0.5,
    fog: 0xb8c0c8, turbidity: 9, rayleigh: 1.5,
    grade: { contrast: 0.18, sat: 1.1, shadowTint: [-0.01, 0.004, 0.014], highTint: [0.02, 0.006, -0.012], vignette: 0.24 },
  },
  winter: {
    // Schnee: weniger Exposure, mehr Sonnen-/weniger Himmelsanteil → Struktur bleibt sichtbar, nichts brennt aus
    sun: 0xfff0e2, sunI: 2.8, hemiSky: 0xc4d6f4, hemiGround: 0x7c8494, hemiI: 0.5, exposure: 0.95, envI: 0.4,
    fog: 0xc0cad8, turbidity: 5, rayleigh: 1.8,
    grade: { contrast: 0.2, sat: 1.06, shadowTint: [-0.01, 0.002, 0.018], highTint: [0.012, 0.006, -0.008], vignette: 0.22 },
  },
  night: {
    sun: 0xa8bce8, sunI: 1.3, hemiSky: 0x5a72a8, hemiGround: 0x22222e, hemiI: 1.0, exposure: 1.55, envI: 0.3,
    fog: 0x0a0e18, turbidity: 8, rayleigh: 0.4,
    grade: { contrast: 0.1, sat: 0.92, shadowTint: [-0.004, 0.004, 0.02], highTint: [0.012, 0.008, 0.0], vignette: 0.28 },
  },
};

const FS_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// Tonemapping (ACES wie three.js) + Color Grading, Ausgabe sRGB, Luma im Alpha (für FXAA)
const GRADE_SHADER = {
  uniforms: {
    tScene: { value: null },
    tBloom: { value: null },
    uBloomOn: { value: 0 },
    uExposure: { value: 1 },
    uContrast: { value: 0.15 },
    uSat: { value: 1.1 },
    uShadowTint: { value: new THREE.Vector3() },
    uHighTint: { value: new THREE.Vector3() },
    uVignette: { value: 0.22 },
  },
  vertexShader: FS_VERT,
  fragmentShader: `
    precision highp float;
    uniform sampler2D tScene; uniform sampler2D tBloom;
    uniform float uBloomOn, uExposure, uContrast, uSat, uVignette;
    uniform vec3 uShadowTint, uHighTint;
    varying vec2 vUv;
    vec3 RRTAndODTFit(vec3 v){
      vec3 a = v * (v + 0.0245786) - 0.000090537;
      vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
      return a / b;
    }
    vec3 acesFilmic(vec3 color){
      const mat3 ACESInputMat = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
      const mat3 ACESOutputMat = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
      color *= uExposure / 0.6;
      color = ACESInputMat * color;
      color = RRTAndODTFit(color);
      color = ACESOutputMat * color;
      return clamp(color, 0.0, 1.0);
    }
    vec3 toSRGB(vec3 c){
      return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
    }
    void main(){
      vec3 hdr = texture2D(tScene, vUv).rgb;
      if (uBloomOn > 0.5) hdr += texture2D(tBloom, vUv).rgb;
      vec3 c = toSRGB(acesFilmic(max(hdr, 0.0)));
      // Kontrast: sanfte S-Kurve um Mittelgrau
      vec3 sc = c * c * (3.0 - 2.0 * c);
      c = mix(c, sc, uContrast);
      // Sättigung
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, uSat);
      // Split-Toning (Schatten kühl, Lichter warm)
      c += uShadowTint * (1.0 - l) * (1.0 - l) + uHighTint * l * l;
      // Vignette
      vec2 d = vUv - 0.5;
      float vg = clamp(dot(d, d) * 2.0, 0.0, 1.0);
      c *= 1.0 - uVignette * vg * vg * (3.0 - 2.0 * vg);
      c = clamp(c, 0.0, 1.0);
      gl_FragColor = vec4(c, dot(c, vec3(0.299, 0.587, 0.114)));
    }`,
};

// Kantenbewusstes Bikubik-Upscaling (Catmull-Rom, 9 Taps) + kontrastadaptives Schärfen (CAS),
// optional FXAA (wenn kein MSAA aktiv ist) und Dithering gegen Banding
const SSU_SHADER = {
  uniforms: {
    tSrc: { value: null },
    uSrcSize: { value: new THREE.Vector2(1, 1) },
    uSharp: { value: 0.5 },
    uUvScale: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: FS_VERT,
  fragmentShader: `
    precision highp float;
    uniform sampler2D tSrc; uniform vec2 uSrcSize; uniform float uSharp; uniform vec2 uUvScale;
    varying vec2 vUv;
    vec3 catmull(vec2 uv){
      vec2 samplePos = uv * uSrcSize;
      vec2 tc = floor(samplePos - 0.5) + 0.5;
      vec2 f = samplePos - tc;
      vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
      vec2 w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
      vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f));
      vec2 w3 = f * f * (-0.5 + 0.5 * f);
      vec2 w12 = w1 + w2;
      vec2 off12 = w2 / w12;
      vec2 tc0 = (tc - 1.0) / uSrcSize, tc3 = (tc + 2.0) / uSrcSize, tc12 = (tc + off12) / uSrcSize;
      vec3 r = vec3(0.0);
      r += texture2D(tSrc, vec2(tc0.x, tc0.y)).rgb * w0.x * w0.y;
      r += texture2D(tSrc, vec2(tc12.x, tc0.y)).rgb * w12.x * w0.y;
      r += texture2D(tSrc, vec2(tc3.x, tc0.y)).rgb * w3.x * w0.y;
      r += texture2D(tSrc, vec2(tc0.x, tc12.y)).rgb * w0.x * w12.y;
      r += texture2D(tSrc, vec2(tc12.x, tc12.y)).rgb * w12.x * w12.y;
      r += texture2D(tSrc, vec2(tc3.x, tc12.y)).rgb * w3.x * w12.y;
      r += texture2D(tSrc, vec2(tc0.x, tc3.y)).rgb * w0.x * w3.y;
      r += texture2D(tSrc, vec2(tc12.x, tc3.y)).rgb * w12.x * w3.y;
      r += texture2D(tSrc, vec2(tc3.x, tc3.y)).rgb * w3.x * w3.y;
      return max(r, 0.0);
    }
  #ifdef USE_FXAA
    // FXAA (klassische Variante): Kantenrichtung aus 4 Diagonal-Lumas, Blur entlang der Kante
    vec3 fxaa(vec2 uv, vec2 px){
      vec4 m = texture2D(tSrc, uv);
      float lNW = texture2D(tSrc, uv + vec2(-1.0, -1.0) * px).a;
      float lNE = texture2D(tSrc, uv + vec2(1.0, -1.0) * px).a;
      float lSW = texture2D(tSrc, uv + vec2(-1.0, 1.0) * px).a;
      float lSE = texture2D(tSrc, uv + vec2(1.0, 1.0) * px).a;
      float lMin = min(m.a, min(min(lNW, lNE), min(lSW, lSE)));
      float lMax = max(m.a, max(max(lNW, lNE), max(lSW, lSE)));
      if (lMax - lMin < max(0.0312, lMax * 0.125)) return m.rgb;
      vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), (lNW + lSW) - (lNE + lSE));
      float dirReduce = max((lNW + lNE + lSW + lSE) * (0.25 * 0.125), 1.0 / 128.0);
      float rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
      dir = clamp(dir * rcpDirMin, vec2(-8.0), vec2(8.0)) * px;
      vec3 a = 0.5 * (texture2D(tSrc, uv + dir * (1.0 / 3.0 - 0.5)).rgb + texture2D(tSrc, uv + dir * (2.0 / 3.0 - 0.5)).rgb);
      vec3 b = a * 0.5 + 0.25 * (texture2D(tSrc, uv - dir * 0.5).rgb + texture2D(tSrc, uv + dir * 0.5).rgb);
      float lB = dot(b, vec3(0.299, 0.587, 0.114));
      return (lB < lMin || lB > lMax) ? a : b;
    }
  #endif
    void main(){
      vec2 uv = vUv * uUvScale;
      vec2 px = 1.0 / uSrcSize;
    #ifdef USE_FXAA
      vec3 c = fxaa(uv, px);
      float sharpK = 0.5;
    #else
      vec3 c = catmull(uv);
      float sharpK = 1.0;
    #endif
      // CAS-ähnliches Schärfen
      vec3 n = texture2D(tSrc, uv + vec2(0.0, px.y)).rgb;
      vec3 s = texture2D(tSrc, uv - vec2(0.0, px.y)).rgb;
      vec3 e = texture2D(tSrc, uv + vec2(px.x, 0.0)).rgb;
      vec3 w = texture2D(tSrc, uv - vec2(px.x, 0.0)).rgb;
      vec3 mn = min(min(min(n, s), min(e, w)), c);
      vec3 mx = max(max(max(n, s), max(e, w)), c);
      vec3 amp = clamp(min(mn, 1.0 - mx) / max(mx, 1e-4), 0.0, 1.0);
      amp = sqrt(amp);
      float peak = -1.0 / mix(8.0, 4.8, uSharp);
      vec3 wgt = amp * peak * sharpK;
      vec3 res = (c + (n + s + e + w) * wgt) / (1.0 + 4.0 * wgt);
      res = mix(c, res, step(0.01, uSharp));
      // Dithering (±0.5 LSB) gegen Banding in Himmel/Nebel
      float dn = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
      res += dn / 255.0;
      gl_FragColor = vec4(clamp(res, 0.0, 1.0), 1.0);
    }`,
};

const _v = new THREE.Vector3(), _p = new THREE.Vector3(), _dir = new THREE.Vector3();
const _lx = new THREE.Vector3(), _ly = new THREE.Vector3();
const _UP = new THREE.Vector3(0, 1, 0);
const _NDC = [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 1], [-1, 0], [1, 0], [0, -1]];

export class GameRenderer {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.settings = settings;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; // Exposure-Ablage; Tonemapping selbst im Grade-Pass
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setPixelRatio(1);

    const ext = this.renderer.extensions;
    this.floatRT = ext.has('EXT_color_buffer_float');
    this.halfRT = this.floatRT || ext.has('EXT_color_buffer_half_float');
    this.maxSamples = this.renderer.capabilities.maxSamples || 0;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 1, 3000);

    // Licht
    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x4a4030, 0.6);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0003;
    this.sun.shadow.normalBias = 0.08;
    this.sun.shadow.radius = 1.5;
    this.scene.add(this.sun, this.sun.target);
    this.sunDir = new THREE.Vector3(-0.5, 0.75, 0.35).normalize();
    this._shadowKey = '';

    // Himmel
    this.sky = new Sky();
    this.sky.scale.setScalar(2500);
    this.scene.add(this.sky);
    this.pmrem = new THREE.PMREMGenerator(this.renderer);

    // Post-Processing
    this.samples = -1;
    this.sceneRT = null;
    this.ldrRT = new THREE.WebGLRenderTarget(64, 64, { type: THREE.UnsignedByteType, depthBuffer: false, stencilBuffer: false });
    this.ldrRT.texture.generateMipmaps = false;
    // Bloom: nur die Mip-Kette wird berechnet; das additive Zurückschreiben übernimmt der Grade-Pass
    // (spart einen Schreib-/Resolve-Durchgang auf das Multisample-Target). renderToScreen + unsichtbare
    // Kopier-/Blend-Materialien verhindern, dass der Pass selbst etwas ausgibt.
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.4, 0.5, 0.93);
    this.bloom.renderToScreen = true;
    this.bloom.basic.visible = false;
    this.bloom.blendMaterial.visible = false;

    this.gradeMat = new THREE.ShaderMaterial({ ...GRADE_SHADER, uniforms: THREE.UniformsUtils.clone(GRADE_SHADER.uniforms), depthTest: false, depthWrite: false, toneMapped: false });
    this.gradeMat.uniforms.tBloom.value = this.bloom.renderTargetsHorizontal[0].texture;
    this.ssuMat = new THREE.ShaderMaterial({ ...SSU_SHADER, uniforms: THREE.UniformsUtils.clone(SSU_SHADER.uniforms), depthTest: false, depthWrite: false, toneMapped: false });
    this.ssuQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.ssuMat);
    this.ssuQuad.frustumCulled = false;
    this.ssuScene = new THREE.Scene();
    this.ssuScene.add(this.ssuQuad);
    this.ssuCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.renderScale = settings.upscale === 'auto' ? 0.8 : 1;
    this.drsTimer = 0;
    this.drsCooldown = 0;
    this.frameTimes = [];
    this.fps = 60;
    this.applySettings();
    this.setGrade(ENV_PRESETS.summer.grade);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  setGrade(g) {
    const u = this.gradeMat.uniforms;
    u.uContrast.value = g.contrast; u.uSat.value = g.sat; u.uVignette.value = g.vignette;
    u.uShadowTint.value.fromArray(g.shadowTint); u.uHighTint.value.fromArray(g.highTint);
  }

  setEnvironment({ night = false, season = 'summer', fogDensity = 0.0032, sunElev = 38, sunAzim = 210 } = {}) {
    this.night = night;
    const P = night ? ENV_PRESETS.night : ENV_PRESETS[season] || ENV_PRESETS.summer;
    const u = this.sky.material.uniforms;
    const elev = night ? -4 : sunElev;
    const phi = THREE.MathUtils.degToRad(90 - elev), theta = THREE.MathUtils.degToRad(sunAzim);
    const sp = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
    u.sunPosition.value.copy(sp);
    u.turbidity.value = P.turbidity;
    u.rayleigh.value = P.rayleigh;
    u.mieCoefficient.value = 0.005;
    u.mieDirectionalG.value = 0.85;
    this.sun.color.set(P.sun); this.sun.intensity = P.sunI;
    this.hemi.color.set(P.hemiSky); this.hemi.groundColor.set(P.hemiGround); this.hemi.intensity = P.hemiI;
    this.renderer.toneMappingExposure = P.exposure;
    if (night) {
      // Mondlicht
      this.sunDir.set(0.4, 0.8, -0.3).normalize();
      this.scene.fog = new THREE.FogExp2(P.fog, fogDensity * 1.1);
      this.scene.background = new THREE.Color(0x05070d);
      this.sky.visible = false;
    } else {
      this.sunDir.copy(sp).normalize();
      // Tiefe Sonne: Licht wärmer und etwas schwächer, Himmelslicht trägt mehr
      const low = clamp((25 - sunElev) / 20, 0, 1);
      if (low > 0) {
        this.sun.color.lerp(new THREE.Color(0xffd2a0), low * (season === 'winter' ? 0.35 : 0.6));
        this.sun.intensity *= 1 - low * 0.12;
      }
      // Sehr flache Sonne → Schatten werden extrem lang; Schattenrichtung für die Darstellung etwas anheben
      if (this.sunDir.y < 0.3) { this.sunDir.y = 0.3; this.sunDir.normalize(); }
      this.scene.fog = new THREE.FogExp2(P.fog, fogDensity);
      this.scene.background = null;
      this.sky.visible = true;
    }
    this.setGrade(P.grade);
    this._shadowKey = '';
    // Umgebungs-Map für PBR-Reflexionen aus dem Himmel
    if (this.envRT) this.envRT.dispose();
    const envScene = new THREE.Scene();
    if (night) { envScene.background = new THREE.Color(0x0a0f1c); }
    else { const s2 = new Sky(); s2.scale.setScalar(100); Object.keys(u).forEach((k) => { if (s2.material.uniforms[k]) s2.material.uniforms[k].value = u[k].value; }); envScene.add(s2); } // V3-W: Wetter-Uniforms nur im Haupthimmel
    this.envRT = this.pmrem.fromScene(envScene, 0.04);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = P.envI;
  }

  applySettings() {
    const s = this.settings;
    const Q = QUALITY[s.quality] || QUALITY.high;
    this.Q = Q;
    // Schatten: auf allen Stufen an (wenn gewünscht); kleinere Map + engere Box auf schwachen Stufen
    const shadowType = Q.softShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    this.renderer.shadowMap.enabled = !!s.shadows;
    this.sun.castShadow = this.renderer.shadowMap.enabled;
    if (this.sun.shadow.mapSize.x !== Q.shadow || this.renderer.shadowMap.type !== shadowType) {
      this.renderer.shadowMap.type = shadowType;
      this.sun.shadow.mapSize.set(Q.shadow, Q.shadow);
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
      this._shadowKey = '';
    }
    this.bloom.enabled = !!s.bloom;
    this.ssuMat.uniforms.uSharp.value = s.sharpness;
    this.minScale = Q.minScale;
    if (s.upscale !== 'auto') this.renderScale = UPSCALE_MODES[s.upscale] ?? 1;
    else this.renderScale = clamp(this.renderScale, this.minScale, 1);
    this.maxDpr = Q.dpr;
    // Kantenglättung: MSAA (WebGL2) – sonst FXAA im SSU-Pass
    const samples = Math.min(Q.samples, this.maxSamples);
    if (samples !== this.samples) this._createSceneRT(samples);
    const fxaa = samples === 0;
    if (!!this.ssuMat.defines.USE_FXAA !== fxaa) {
      if (fxaa) this.ssuMat.defines.USE_FXAA = ''; else delete this.ssuMat.defines.USE_FXAA;
      this.ssuMat.needsUpdate = true;
    }
    this.resize();
    // Materialien neu kompilieren, wenn Schatten umgeschaltet wurden
    this.scene.traverse((o) => { if (o.material) { const m = Array.isArray(o.material) ? o.material : [o.material]; m.forEach((mm) => (mm.needsUpdate = true)); } });
  }

  _createSceneRT(samples) {
    if (this.sceneRT) this.sceneRT.dispose();
    this.samples = samples;
    // Multisample + HalfFloat braucht EXT_color_buffer_float; sonst 8 Bit (oder HalfFloat ohne MSAA)
    let type = THREE.HalfFloatType;
    if (samples > 0 && !this.floatRT) type = THREE.UnsignedByteType;
    else if (!this.halfRT) type = THREE.UnsignedByteType;
    this.sceneRT = new THREE.WebGLRenderTarget(this.intW || 64, this.intH || 64, { type, samples, depthBuffer: true, stencilBuffer: false });
    this.sceneRT.texture.generateMipmaps = false;
    this.gradeMat.uniforms.tScene.value = this.sceneRT.texture;
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr || 1.5);
    this.outW = Math.floor(w * dpr); this.outH = Math.floor(h * dpr);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this._resizeInternal();
  }
  _resizeInternal() {
    const sw = Math.max(64, Math.floor(this.outW * this.renderScale)), sh = Math.max(64, Math.floor(this.outH * this.renderScale));
    this.intW = sw; this.intH = sh;
    this.sceneRT.setSize(sw, sh);
    this.ldrRT.setSize(sw, sh);
    this.bloom.setSize(Math.floor(sw / 2), Math.floor(sh / 2));
    this.ssuMat.uniforms.uSrcSize.value.set(sw, sh);
  }

  // Dynamische Auflösung: hält die Ziel-FPS, fällt aber nie unter minScale (sonst wird das Bild pixelig)
  _updateDRS(dt) {
    this.frameTimes.push(dt);
    if (this.frameTimes.length > 30) this.frameTimes.shift();
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.fps = 1 / Math.max(avg, 1e-4);
    if (this.settings.upscale !== 'auto') return;
    this.drsTimer += dt;
    this.drsCooldown -= dt;
    if (this.drsTimer < 1) return;
    this.drsTimer = 0;
    const target = this.settings.targetFps || 60;
    let s = this.renderScale;
    if (this.fps < target * 0.88) { s -= this.fps < target * 0.7 ? 0.1 : 0.05; this.drsCooldown = 4; }
    else if (this.fps > target * 0.97 && this.drsCooldown <= 0) s += 0.05;
    s = clamp(Math.round(s * 20) / 20, this.minScale || 0.6, 1);
    if (Math.abs(s - this.renderScale) > 0.001) { this.renderScale = s; this._resizeInternal(); }
  }

  // Schattenkamera eng an den sichtbaren Bodenbereich anpassen: Sichtkegel-Ecken werden mit der
  // Bodenebene (Höhe des Kameraziels) geschnitten, in den Lichtraum projiziert und dort umschlossen.
  // extent dient als Obergrenze für die Reichweite. Texel-Snapping + quantisierte Boxgröße gegen Flimmern.
  updateShadowCamera(center, extent) {
    if (!this.sun.castShadow) return;
    const cam = this.camera;
    cam.updateMatrixWorld();
    const Q = this.Q || QUALITY.high;
    const camPos = cam.position;
    const camH = Math.max(5, camPos.y - center.y);
    const maxDist = clamp(Math.max(camH * 3, (extent || 120) * 1.4), 60, 340) * Q.shadowRange;
    // Lichtraum-Basis (wie Object3D.lookAt der Schattenkamera)
    const lz = this.sunDir;
    _lx.crossVectors(_UP, lz).normalize();
    _ly.crossVectors(lz, _lx);
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity, minW = Infinity, maxW = -Infinity;
    const hBelow = 6, hAbove = 14, casterH = 40;
    for (const [nx, ny] of _NDC) {
      _v.set(nx, ny, 0.5).unproject(cam);
      _dir.subVectors(_v, camPos).normalize();
      const hor = Math.max(1e-4, Math.hypot(_dir.x, _dir.z));
      let t = _dir.y < -1e-4 ? (center.y - camPos.y) / _dir.y : Infinity;
      if (t * hor > maxDist) t = maxDist / hor;
      _p.copy(camPos).addScaledVector(_dir, t);
      for (const dy of [-hBelow, hAbove]) {
        _v.set(_p.x, center.y + dy, _p.z);
        const u = _v.dot(_lx), vv = _v.dot(_ly), w = _v.dot(lz);
        if (u < minU) minU = u; if (u > maxU) maxU = u;
        if (vv < minV) minV = vv; if (vv > maxV) maxV = vv;
        if (w < minW) minW = w;
        const wc = w + casterH * lz.y;
        if (wc > maxW) maxW = wc;
      }
    }
    // Box-Halbgrößen geometrisch quantisieren (~9 %-Stufen), damit sie beim Schwenken stabil bleiben
    const quant = (x) => Math.pow(2, Math.ceil(Math.log2(Math.max(x, 8)) * 8) / 8);
    const hu = Math.min(quant((maxU - minU) / 2 + 3), 280), hv = Math.min(quant((maxV - minV) / 2 + 3), 280);
    const size = this.sun.shadow.mapSize.x;
    const tu = (2 * hu) / size, tv = (2 * hv) / size;
    const cu = Math.round((minU + maxU) / 2 / tu) * tu, cv = Math.round((minV + maxV) / 2 / tv) * tv;
    const eyeW = maxW + 10, far = eyeW - minW + 10;
    const sc = this.sun.shadow.camera;
    const key = hu + '|' + hv + '|' + Math.ceil(far / 10);
    if (key !== this._shadowKey) {
      this._shadowKey = key;
      sc.left = -hu; sc.right = hu; sc.top = hv; sc.bottom = -hv;
      sc.near = 0.5; sc.far = Math.ceil(far / 10) * 10;
      sc.updateProjectionMatrix();
      // Bias an Texelgröße/Tiefenbereich anpassen
      const texel = Math.max(tu, tv);
      this.sun.shadow.normalBias = clamp(texel * 1.4, 0.02, 0.35);
      this.sun.shadow.bias = -Math.min(0.0015, 0.06 / sc.far);
    }
    this.sun.position.set(0, 0, 0).addScaledVector(_lx, cu).addScaledVector(_ly, cv).addScaledVector(lz, eyeW);
    this.sun.target.position.copy(this.sun.position).addScaledVector(lz, -50);
  }

  render(dt) {
    this._updateDRS(dt);
    const r = this.renderer;
    // 1. Szene (HDR, MSAA)
    r.setRenderTarget(this.sceneRT);
    r.render(this.scene, this.camera);
    // 2. Bloom-Mips
    const bloomOn = this.bloom.enabled;
    if (bloomOn) this.bloom.render(r, null, this.sceneRT, dt, false);
    // 3. Tonemapping + Grading
    const gu = this.gradeMat.uniforms;
    gu.uBloomOn.value = bloomOn ? 1 : 0;
    gu.uExposure.value = r.toneMappingExposure;
    this.ssuQuad.material = this.gradeMat;
    r.setRenderTarget(this.ldrRT);
    r.render(this.ssuScene, this.ssuCam);
    // 4. Upscaling + Schärfen (+ FXAA) auf den Bildschirm
    this.ssuQuad.material = this.ssuMat;
    this.ssuMat.uniforms.tSrc.value = this.ldrRT.texture;
    r.setRenderTarget(null);
    r.render(this.ssuScene, this.ssuCam);
  }

  clearScene(keep) {
    for (let i = this.scene.children.length - 1; i >= 0; i--) {
      const o = this.scene.children[i];
      if (keep.includes(o)) continue;
      this.scene.remove(o);
      o.traverse((c) => {
        if (c.geometry && !c.geometry.userData.shared) c.geometry.dispose();
        // Texturen pro Szene (z. B. Gelände-Farbkarte) freigeben; geteilte, gecachte Texturen
        // lädt three.js bei erneuter Nutzung automatisch wieder hoch.
        if (c.material) for (const m of Array.isArray(c.material) ? c.material : [c.material]) {
          if (!m || m.userData?.shared) continue;
          for (const k in m) { const t = m[k]; if (t && t.isTexture && !t.userData?.shared && !t.isRenderTargetTexture) t.dispose(); }
        }
      });
    }
  }
}
