// Render-Pipeline: PBR, Himmel, Schatten, Bloom, SSU-Upscaling (DLSS-ähnlich) + dynamische Auflösung
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { clamp } from './util.js';

export const UPSCALE_MODES = { native: 1, quality: 0.67, balanced: 0.58, performance: 0.5, ultraperf: 0.33 };

// Kantenbewusstes Bikubik-Upscaling (Catmull-Rom, 9 Taps) + kontrastadaptives Schärfen
const SSU_SHADER = {
  uniforms: {
    tSrc: { value: null },
    uSrcSize: { value: new THREE.Vector2(1, 1) },
    uSharp: { value: 0.5 },
    uUvScale: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
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
    void main(){
      vec2 uv = vUv * uUvScale;
      vec3 c = catmull(uv);
      // CAS-ähnliches Schärfen
      vec2 px = 1.0 / uSrcSize;
      vec3 n = texture2D(tSrc, uv + vec2(0.0, px.y)).rgb;
      vec3 s = texture2D(tSrc, uv - vec2(0.0, px.y)).rgb;
      vec3 e = texture2D(tSrc, uv + vec2(px.x, 0.0)).rgb;
      vec3 w = texture2D(tSrc, uv - vec2(px.x, 0.0)).rgb;
      vec3 mn = min(min(min(n, s), min(e, w)), c);
      vec3 mx = max(max(max(n, s), max(e, w)), c);
      vec3 amp = clamp(min(mn, 1.0 - mx) / max(mx, 1e-4), 0.0, 1.0);
      amp = sqrt(amp);
      float peak = -1.0 / mix(8.0, 4.8, uSharp);
      vec3 wgt = amp * peak;
      vec3 res = (c + (n + s + e + w) * wgt) / (1.0 + 4.0 * wgt);
      res = mix(c, res, step(0.01, uSharp));
      gl_FragColor = vec4(clamp(res, 0.0, 1.0), 1.0);
    }`,
};

export class GameRenderer {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.settings = settings;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setPixelRatio(1);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 1, 3000);

    // Licht
    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x4a4030, 0.6);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.6;
    this.scene.add(this.sun, this.sun.target);
    this.sunDir = new THREE.Vector3(-0.5, 0.75, 0.35).normalize();

    // Himmel
    this.sky = new Sky();
    this.sky.scale.setScalar(2500);
    this.scene.add(this.sky);
    this.pmrem = new THREE.PMREMGenerator(this.renderer);

    // Post-Processing
    this.composer = new EffectComposer(this.renderer);
    this.composer.renderToScreen = false;
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.4, 0.5, 0.93);
    this.output = new OutputPass();
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.output);

    // SSU-Upscaling-Pass (zeichnet in voller Auflösung auf den Bildschirm)
    this.ssuMat = new THREE.ShaderMaterial({ ...SSU_SHADER, uniforms: THREE.UniformsUtils.clone(SSU_SHADER.uniforms), depthTest: false, depthWrite: false });
    this.ssuQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.ssuMat);
    this.ssuScene = new THREE.Scene();
    this.ssuScene.add(this.ssuQuad);
    this.ssuCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.renderScale = 1;
    this.drsTimer = 0;
    this.frameTimes = [];
    this.fps = 60;
    this.applySettings();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  setEnvironment({ night = false, season = 'summer', fogDensity = 0.0032, sunElev = 38, sunAzim = 210 } = {}) {
    this.night = night;
    const u = this.sky.material.uniforms;
    const elev = night ? -4 : sunElev;
    const phi = THREE.MathUtils.degToRad(90 - elev), theta = THREE.MathUtils.degToRad(sunAzim);
    const sp = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
    u.sunPosition.value.copy(sp);
    u.turbidity.value = season === 'winter' ? 6 : 8;
    u.rayleigh.value = night ? 0.4 : 1.6;
    u.mieCoefficient.value = 0.006;
    u.mieDirectionalG.value = 0.85;
    if (night) {
      // Mondlicht
      this.sunDir.set(0.4, 0.8, -0.3).normalize();
      this.sun.color.set(0xa8bce8); this.sun.intensity = 1.1;
      this.hemi.color.set(0x5068a0); this.hemi.groundColor.set(0x1a1a24); this.hemi.intensity = 0.9;
      this.renderer.toneMappingExposure = 1.15;
      this.scene.fog = new THREE.FogExp2(0x070a12, fogDensity * 1.2);
      this.scene.background = new THREE.Color(0x05070d);
      this.sky.visible = false;
    } else {
      this.sunDir.copy(sp).normalize();
      this.sun.color.set(season === 'winter' ? 0xf0f2ff : 0xfff1dc);
      this.sun.intensity = season === 'winter' ? 2.0 : 2.6;
      this.hemi.color.set(0xbfd8ff); this.hemi.groundColor.set(season === 'winter' ? 0x8890a0 : 0x4a4030);
      this.hemi.intensity = season === 'winter' ? 0.8 : 0.6;
      this.renderer.toneMappingExposure = season === 'winter' ? 0.75 : 0.95;
      const fogCol = season === 'winter' ? 0xc3ccd8 : 0xb8c6d4;
      this.scene.fog = new THREE.FogExp2(fogCol, fogDensity);
      this.scene.background = null;
      this.sky.visible = true;
    }
    // Umgebungs-Map für PBR-Reflexionen aus dem Himmel
    if (this.envRT) this.envRT.dispose();
    const envScene = new THREE.Scene();
    if (night) { envScene.background = new THREE.Color(0x0a0f1c); }
    else { const s2 = new Sky(); s2.scale.setScalar(100); Object.keys(u).forEach((k) => (s2.material.uniforms[k].value = u[k].value)); envScene.add(s2); }
    this.envRT = this.pmrem.fromScene(envScene, 0.04);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = night ? 0.25 : 0.55;
  }

  applySettings() {
    const s = this.settings;
    const shadowSize = { low: 1024, medium: 1536, high: 2048, ultra: 4096 }[s.quality] || 2048;
    this.renderer.shadowMap.enabled = !!s.shadows && s.quality !== 'low';
    this.sun.castShadow = this.renderer.shadowMap.enabled;
    if (this.sun.shadow.mapSize.x !== shadowSize) {
      this.sun.shadow.mapSize.set(shadowSize, shadowSize);
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    }
    this.bloom.enabled = !!s.bloom;
    this.ssuMat.uniforms.uSharp.value = s.sharpness;
    if (s.upscale !== 'auto') this.renderScale = UPSCALE_MODES[s.upscale] ?? 1;
    this.maxDpr = { low: 1, medium: 1.5, high: 2, ultra: 2.5 }[s.quality] || 1.5;
    this.resize();
    // Materialien neu kompilieren, wenn Schatten umgeschaltet wurden
    this.scene.traverse((o) => { if (o.material) { const m = Array.isArray(o.material) ? o.material : [o.material]; m.forEach((mm) => (mm.needsUpdate = true)); } });
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
    this.composer.setPixelRatio(1);
    this.composer.setSize(sw, sh);
    this.bloom.setSize(Math.floor(sw / 2), Math.floor(sh / 2));
    this.ssuMat.uniforms.uSrcSize.value.set(sw, sh);
  }

  // Dynamische Auflösung: hält die Ziel-FPS
  _updateDRS(dt) {
    this.frameTimes.push(dt);
    if (this.frameTimes.length > 30) this.frameTimes.shift();
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.fps = 1 / Math.max(avg, 1e-4);
    if (this.settings.upscale !== 'auto') return;
    this.drsTimer += dt;
    if (this.drsTimer < 0.75) return;
    this.drsTimer = 0;
    const target = this.settings.targetFps || 60;
    let s = this.renderScale;
    if (this.fps < target * 0.92) s -= this.fps < target * 0.7 ? 0.1 : 0.05;
    else if (this.fps > target * 1.08 || this.fps > 58 && target >= 60 && this.fps > target - 2) s += 0.05;
    s = clamp(s, 0.4, 1);
    if (Math.abs(s - this.renderScale) > 0.001) { this.renderScale = s; this._resizeInternal(); }
  }

  updateShadowCamera(center, extent) {
    const d = clamp(extent, 40, 220);
    const cam = this.sun.shadow.camera;
    if (cam.right !== d) { cam.left = -d; cam.right = d; cam.top = d; cam.bottom = -d; cam.near = 1; cam.far = 600; cam.updateProjectionMatrix(); }
    // Texel-Snapping gegen Schattenflimmern
    const texel = (2 * d) / this.sun.shadow.mapSize.x;
    const cx = Math.round(center.x / texel) * texel, cz = Math.round(center.z / texel) * texel;
    this.sun.position.set(cx + this.sunDir.x * 300, center.y + this.sunDir.y * 300, cz + this.sunDir.z * 300);
    this.sun.target.position.set(cx, center.y, cz);
  }

  render(dt) {
    this._updateDRS(dt);
    this.composer.render(dt);
    this.ssuMat.uniforms.tSrc.value = this.composer.readBuffer.texture;
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.ssuScene, this.ssuCam);
  }

  clearScene(keep) {
    for (let i = this.scene.children.length - 1; i >= 0; i--) {
      const o = this.scene.children[i];
      if (keep.includes(o)) continue;
      this.scene.remove(o);
      o.traverse((c) => {
        if (c.geometry && !c.geometry.userData.shared) c.geometry.dispose();
      });
    }
  }
}
