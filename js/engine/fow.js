// Nebel des Krieges: Sichtbarkeitsgitter + Shader-Patch für Umgebungsmaterialien
import * as THREE from 'three';

export const FOW_RES = 128;

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

// Patcht ein Standard-Material: Weltposition → Nebeltextur, verdunkelt verdeckte Bereiche
export function applyFow(material, { detail = false } = {}) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, fowUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFowWorld;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          vec4 fwp = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            fwp = instanceMatrix * fwp;
          #endif
          vFowWorld = (modelMatrix * fwp).xyz;
        }`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vFowWorld;
        uniform sampler2D uFowTex; uniform float uFowSize; uniform float uFowEnabled;
        float fHash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float fNoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
          return mix(mix(fHash(i),fHash(i+vec2(1,0)),u.x), mix(fHash(i+vec2(0,1)),fHash(i+vec2(1,1)),u.x), u.y); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        ${detail ? `
        {
          float n1 = fNoise(vFowWorld.xz * 0.35);
          float n2 = fNoise(vFowWorld.xz * 1.7);
          float n3 = fNoise(vFowWorld.xz * 6.0);
          diffuseColor.rgb *= 0.86 + 0.16 * n1 + 0.08 * n2 + 0.05 * n3;
        }` : ''}
        if (uFowEnabled > 0.5) {
          vec2 fuv = (vFowWorld.xz + uFowSize * 0.5) / uFowSize;
          float fv = texture2D(uFowTex, fuv).r;
          float outside = step(0.0, fuv.x) * step(fuv.x, 1.0) * step(0.0, fuv.y) * step(fuv.y, 1.0);
          fv *= outside;
          diffuseColor.rgb *= mix(0.16, 1.0, smoothstep(0.0, 1.0, fv));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.33))), (1.0 - fv) * 0.5);
        }`);
  };
  material.customProgramCacheKey = () => 'fow' + (detail ? 'd' : '');
  return material;
}
