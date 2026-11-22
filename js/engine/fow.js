// Nebel des Krieges: Sichtbarkeitsgitter + Shader-Patch für Umgebungsmaterialien
import * as THREE from 'three';

export const FOW_RES = 128;
const ANG_R = 64;

export class FogOfWar {
  constructor(mapSize) {
    this.size = mapSize;
    this.res = FOW_RES;
    this.cell = mapSize / FOW_RES;
    this.visible = new Uint8Array(FOW_RES * FOW_RES);   // aktuell sichtbar (0/1)
    this.explored = new Uint8Array(FOW_RES * FOW_RES);  // je aufgedeckt
    this.data = new Uint8Array(FOW_RES * FOW_RES * 4);
    this.tex = new THREE.DataTexture(this.data, FOW_RES, FOW_RES, THREE.RGBAFormat);
    this.tex.magFilter = THREE.LinearFilter;
    this.tex.minFilter = THREE.LinearFilter;
    this.tex.needsUpdate = true;
    this.smooth = new Float32Array(FOW_RES * FOW_RES); // weich überblendet
    this.enabled = true;
  }
  toCell(x, z) {
    const h = this.size / 2;
    return [Math.floor((x + h) / this.cell), Math.floor((z + h) / this.cell)];
  }
  isVisible(x, z) {
    if (!this.enabled) return true;
    const [cx, cz] = this.toCell(x, z);
    if (cx < 0 || cz < 0 || cx >= this.res || cz >= this.res) return false;
    return this.visible[cz * this.res + cx] === 1;
  }
  isExplored(x, z) {
    if (!this.enabled) return true;
    const [cx, cz] = this.toCell(x, z);
    if (cx < 0 || cz < 0 || cx >= this.res || cz >= this.res) return false;
    return this.explored[cz * this.res + cx] === 1;
  }
  beginFrame() { this.visible.fill(0); }
  reveal(x, z, r) {
    const res = this.res, h = this.size / 2;
    const cx = (x + h) / this.cell, cz = (z + h) / this.cell, cr = r / this.cell;
    const x0 = Math.max(0, Math.floor(cx - cr)), x1 = Math.min(res - 1, Math.ceil(cx + cr));
    const z0 = Math.max(0, Math.floor(cz - cr)), z1 = Math.min(res - 1, Math.ceil(cz + cr));
    const r2 = cr * cr;
    for (let j = z0; j <= z1; j++) {
      const dz = j + 0.5 - cz;
      for (let i = x0; i <= x1; i++) {
        const dx = i + 0.5 - cx;
        if (dx * dx + dz * dz <= r2) { const k = j * res + i; this.visible[k] = 1; this.explored[k] = 1; }
      }
    }
  }
  // Sicht mit Verdeckung: radii[i] = Sichtweite im Sektor i (n Sektoren, linear interpoliert); r = Maximalradius.
  // Winkel kommen aus einer Tabelle ganzzahliger Zellversätze (Winkel wie in Vision.sectors: atan2(dx, dz)).
  revealSectors(x, z, r, radii, n) {
    const res = this.res, h = this.size / 2, cell = this.cell;
    const cx = (x + h) / cell, cz = (z + h) / cell, cr = r / cell;
    const R = ANG_R;
    if (cr > R) { this.reveal(x, z, r); return; }
    if (!this._ang) {
      const w = 2 * R + 1;
      this._ang = new Float32Array(w * w);
      for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) { let a = Math.atan2(di, dj); if (a < 0) a += Math.PI * 2; this._ang[(dj + R) * w + di + R] = a; }
    }
    const ang = this._ang, w = 2 * R + 1, k2 = n / (Math.PI * 2);
    const ci = Math.floor(cx), cj = Math.floor(cz);
    const x0 = Math.max(0, Math.floor(cx - cr)), x1 = Math.min(res - 1, Math.ceil(cx + cr));
    const z0 = Math.max(0, Math.floor(cz - cr)), z1 = Math.min(res - 1, Math.ceil(cz + cr));
    const cr2 = cr * cr, inv = 1 / cell;
    for (let j = z0; j <= z1; j++) {
      const dz = j + 0.5 - cz;
      for (let i = x0; i <= x1; i++) {
        const dx = i + 0.5 - cx;
        const d2 = dx * dx + dz * dz;
        if (d2 > cr2) continue;
        const f = ang[(j - cj + R) * w + (i - ci + R)] * k2 - 0.5;
        let s0 = Math.floor(f); const t = f - s0;
        if (s0 < 0) s0 += n;
        const s1 = s0 + 1 >= n ? 0 : s0 + 1;
        const rr = (radii[s0] + (radii[s1] - radii[s0]) * t) * inv;
        if (d2 <= rr * rr) { const k = j * res + i; this.visible[k] = 1; this.explored[k] = 1; }
      }
    }
  }
  revealAll() { this.visible.fill(1); this.explored.fill(1); }
  // weiche Überblendung, damit der Nebel nicht flackert
  upload(dt) {
    const n = this.res * this.res, k = Math.min(1, dt * 6);
    for (let i = 0; i < n; i++) {
      const target = this.visible[i] ? 1 : this.explored[i] ? 0.5 : 0;
      const v = this.smooth[i] += (target - this.smooth[i]) * k;
      const b = (v * 255) | 0;
      this.data[i * 4] = b; this.data[i * 4 + 1] = b; this.data[i * 4 + 2] = b; this.data[i * 4 + 3] = 255;
    }
    this.tex.needsUpdate = true;
  }
}

// Gemeinsame Uniforms für alle Materialien mit Nebel-Patch
export const fowUniforms = {
  uFowTex: { value: null },
  uFowSize: { value: 240 },
  uFowEnabled: { value: 1 },
  uTime: { value: 0 },
};

// GLSL-Rauschfunktionen (Value-Noise), auch vom Wasser-Shader genutzt
export const FOW_NOISE_GLSL = `
  float fHash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float fNoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(fHash(i),fHash(i+vec2(1,0)),u.x), mix(fHash(i+vec2(0,1)),fHash(i+vec2(1,1)),u.x), u.y); }`;

// Gemeinsamer Nebel-Block (Fragment): verdunkelt/entsättigt unerkundete Bereiche
const FOW_APPLY_GLSL = `
  if (uFowEnabled > 0.5) {
    vec2 fuv = (vFowWorld.xz + uFowSize * 0.5) / uFowSize;
    float fv = texture2D(uFowTex, fuv).r;
    float outside = step(0.0, fuv.x) * step(fuv.x, 1.0) * step(0.0, fuv.y) * step(fuv.y, 1.0);
    fv *= outside;
    diffuseColor.rgb *= mix(0.16, 1.0, smoothstep(0.0, 1.0, fv));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.33))), (1.0 - fv) * 0.5);
  }`;

// Patcht ein Standard-Material: Weltposition → Nebeltextur, verdunkelt verdeckte Bereiche.
// Optionen:
//   detail  – einfache mehrskalige Helligkeitsvariation (Altverhalten)
//   terrain – Geländemodus: mehrskaliges Rauschen, hangabhängige Fels-Tönung; Alpha der Map = Unebenheitsmaske
//   bump    – (mit terrain) Mikro-Normalenstörung aus Rauschgradienten
//   wind    – Vertex-Wiegen für Gras/Halme (Instanzen, lokale y-Achse = Höhe)
export function applyFow(material, { detail = false, terrain = false, bump = false, wind = false } = {}) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, fowUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        varying vec3 vFowWorld;
        ${terrain ? 'varying vec3 vFowN;' : ''}
        ${wind ? 'uniform float uTime;' : ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        ${wind ? `
        {
          vec3 ip = vec3(0.0);
          #ifdef USE_INSTANCING
            ip = instanceMatrix[3].xyz;
          #endif
          float ph = uTime * 1.7 + ip.x * 0.31 + ip.z * 0.23;
          float k = max(transformed.y, 0.0);
          k *= k;
          transformed.x += (sin(ph) * 0.10 + sin(ph * 2.3 + 1.7) * 0.04) * k;
          transformed.z += (cos(ph * 0.8) * 0.07) * k;
        }` : ''}
        {
          vec4 fwp = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            fwp = instanceMatrix * fwp;
          #endif
          vFowWorld = (modelMatrix * fwp).xyz;
          ${terrain ? 'vFowN = normalize(mat3(modelMatrix) * objectNormal);' : ''}
        }`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vFowWorld;
        ${terrain ? 'varying vec3 vFowN;' : ''}
        uniform sampler2D uFowTex; uniform float uFowSize; uniform float uFowEnabled;
        ${FOW_NOISE_GLSL}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        ${terrain ? `
        float fowBump = 1.0;
        #ifdef USE_MAP
          fowBump = diffuseColor.a; diffuseColor.a = opacity;
        #endif
        {
          vec2 p = vFowWorld.xz;
          float fpx = length(fwidth(p));
          float hf = 1.0 - smoothstep(0.12, 0.45, fpx);
          float n1 = fNoise(p * 0.045 + 13.0);
          float n2 = fNoise(p * 0.31 + 7.1);
          float n3 = fNoise(p * 2.6 - 3.3);
          diffuseColor.rgb *= (0.91 + 0.16 * n1) * (1.0 + (n2 - 0.5) * 0.12) * (1.0 + (n3 - 0.5) * 0.16 * hf * (0.4 + 0.6 * fowBump));
          // hangabhängige Fels-Tönung mit Schichtung
          float sl = 1.0 - normalize(vFowN).y;
          float rk = smoothstep(0.12, 0.34, sl + (n2 - 0.5) * 0.08);
          if (rk > 0.0) {
            float strata = fNoise(vec2((p.x + p.y) * 0.12, vFowWorld.y * 2.4));
            vec3 rockC = vec3(dot(diffuseColor.rgb, vec3(0.30, 0.59, 0.11))) * vec3(1.02, 0.98, 0.93) * (0.72 + 0.45 * strata);
            diffuseColor.rgb = mix(diffuseColor.rgb, rockC, rk * 0.6);
          }
        }` : detail ? `
        {
          float n1 = fNoise(vFowWorld.xz * 0.35);
          float n2 = fNoise(vFowWorld.xz * 1.7);
          float n3 = fNoise(vFowWorld.xz * 6.0);
          diffuseColor.rgb *= 0.86 + 0.16 * n1 + 0.08 * n2 + 0.05 * n3;
        }` : ''}
        ${FOW_APPLY_GLSL}`);
    if (terrain && bump) {
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec2 p = vFowWorld.xz;
          float fpx = length(fwidth(p));
          float fade = (1.0 - smoothstep(0.18, 0.9, fpx)) * fowBump;
          if (fade > 0.01) {
            const float e = 0.15;
            vec2 q1 = p * 0.85;
            float a = fNoise(q1);
            vec2 g = vec2(fNoise(q1 + vec2(e, 0.0)) - a, fNoise(q1 + vec2(0.0, e)) - a) * (0.85 / e) * 0.22;
            vec2 q2 = p * 3.1 + 17.0;
            float b = fNoise(q2);
            g += vec2(fNoise(q2 + vec2(e, 0.0)) - b, fNoise(q2 + vec2(0.0, e)) - b) * (3.1 / e) * 0.035 * (1.0 - smoothstep(0.08, 0.3, fpx));
            vec3 wn = normalize(normalize(vFowN) - vec3(g.x, 0.0, g.y) * fade);
            normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
          }
        }`);
    }
  };
  material.customProgramCacheKey = () => 'fow' + (terrain ? 't' : '') + (bump ? 'b' : '') + (detail ? 'd' : '') + (wind ? 'w' : '');
  return material;
}
