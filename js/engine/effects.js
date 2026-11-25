// Partikel, Explosionen, Leuchtspur, Krater, Lichtblitze
import * as THREE from 'three';
import { rand } from './util.js';

// ---------- prozedurale Texturen (einmalig, per CanvasTexture) ----------
function mkCanvas(w, h) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}
function toTex(c) {
  const t = new THREE.CanvasTexture(c);
  t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
let _seed = 12345;
const srand = () => { _seed = (_seed * 1664525 + 1013904223) >>> 0; return _seed / 4294967296; };

// 2x2 Atlas weicher, wolkiger Puffs (Alpha-Kanal)
function makePuffAtlas() {
  const S = 256, T = 128, c = mkCanvas(S, S);
  if (!c) return null;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, S, S);
  for (let k = 0; k < 4; k++) {
    const ox = (k % 2) * T, oy = Math.floor(k / 2) * T;
    ctx.save(); ctx.beginPath(); ctx.rect(ox, oy, T, T); ctx.clip();
    ctx.translate(ox + T / 2, oy + T / 2);
    for (let i = 0; i < 34; i++) {
      const a = srand() * 6.283, d = Math.pow(srand(), 0.7) * 30, r = 14 + srand() * 22;
      const x = Math.cos(a) * d, y = Math.sin(a) * d;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.42)'); g.addColorStop(0.55, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // Rundung erzwingen
    ctx.globalCompositeOperation = 'destination-in';
    const m = ctx.createRadialGradient(0, 0, 0, 0, 0, T * 0.5);
    m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(0.6, 'rgba(0,0,0,0.9)'); m.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = m; ctx.fillRect(-T / 2, -T / 2, T, T);
    ctx.restore();
  }
  return toTex(c);
}
function makeStarTex() {
  const S = 128, c = mkCanvas(S, S);
  if (!c) return null;
  const ctx = c.getContext('2d');
  ctx.translate(S / 2, S / 2);
  ctx.globalCompositeOperation = 'lighter';
  const spike = (ang, len, wid, a) => {
    ctx.save(); ctx.rotate(ang);
    ctx.scale(len, wid);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(0.35, `rgba(255,220,150,${a * 0.5})`); g.addColorStop(1, 'rgba(255,150,50,0)');
    ctx.fillStyle = g; ctx.fillRect(-1, -1, 2, 2); ctx.restore();
  };
  for (let i = 0; i < 4; i++) spike(i * Math.PI / 2 + 0.2, 60, 7, 0.95);
  for (let i = 0; i < 4; i++) spike(i * Math.PI / 2 + Math.PI / 4 + 0.2, 36, 6, 0.6);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,210,120,0.55)'); g.addColorStop(1, 'rgba(255,120,30,0)');
  ctx.fillStyle = g; ctx.fillRect(-32, -32, 64, 64);
  return toTex(c);
}
function makeGlowTex() {
  const S = 128, c = mkCanvas(S, S);
  if (!c) return null;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.2, 'rgba(255,240,200,0.85)'); g.addColorStop(0.5, 'rgba(255,170,70,0.35)'); g.addColorStop(1, 'rgba(255,100,20,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  return toTex(c);
}
function makeRingTex() {
  const S = 128, c = mkCanvas(S, S);
  if (!c) return null;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.55, 'rgba(255,255,255,0)');
  g.addColorStop(0.82, 'rgba(255,255,255,0.55)'); g.addColorStop(0.93, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  return toTex(c);
}
function makeCraterTex() {
  const S = 128, c = mkCanvas(S, S);
  if (!c) return null;
  const ctx = c.getContext('2d');
  ctx.translate(64, 64);
  // Auswurf-Strahlen
  for (let i = 0; i < 22; i++) {
    const a = srand() * 6.283, l = 38 + srand() * 26;
    ctx.strokeStyle = `rgba(20,14,8,${0.12 + srand() * 0.18})`; ctx.lineWidth = 1 + srand() * 3;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * 20, Math.sin(a) * 20); ctx.lineTo(Math.cos(a) * l, Math.sin(a) * l); ctx.stroke();
  }
  // unregelmäßiger Brandfleck
  for (let i = 0; i < 14; i++) {
    const a = srand() * 6.283, d = srand() * 12, r = 24 + srand() * 22;
    const x = Math.cos(a) * d, y = Math.sin(a) * d;
    const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
    g.addColorStop(0, 'rgba(12,9,6,0.55)'); g.addColorStop(0.7, 'rgba(26,18,10,0.25)'); g.addColorStop(1, 'rgba(26,18,10,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // aufgeworfener Rand (heller)
  const rim = ctx.createRadialGradient(0, 0, 18, 0, 0, 50);
  rim.addColorStop(0, 'rgba(0,0,0,0)'); rim.addColorStop(0.55, 'rgba(0,0,0,0)');
  rim.addColorStop(0.75, 'rgba(120,96,70,0.28)'); rim.addColorStop(1, 'rgba(120,96,70,0)');
  ctx.fillStyle = rim; ctx.fillRect(-64, -64, 128, 128);
  // dunkler Kern
  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, 32);
  core.addColorStop(0, 'rgba(4,3,2,0.95)'); core.addColorStop(0.6, 'rgba(10,7,4,0.8)'); core.addColorStop(1, 'rgba(14,10,6,0)');
  ctx.fillStyle = core; ctx.fillRect(-64, -64, 128, 128);
  // Randverlauf
  ctx.globalCompositeOperation = 'destination-in';
  const m = ctx.createRadialGradient(0, 0, 40, 0, 0, 64);
  m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = m; ctx.fillRect(-64, -64, 128, 128);
  return toTex(c);
}

// ---------- Partikel-Shader ----------
const PARTICLE_VS = `
  attribute float aSize; attribute vec4 aColor; attribute float aRot; attribute float aAge; attribute float aSeed; attribute float aHeat;
  varying vec4 vColor; varying float vRot; varying float vAge; varying float vSeed; varying float vHeat;
  uniform float uScale;
  void main(){
    vColor = aColor; vRot = aRot; vAge = aAge; vSeed = aSeed; vHeat = aHeat;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = clamp(aSize * uScale / max(0.1, -mv.z), 0.0, 700.0);
    // Sprite entlang des Sichtstrahls zur Kamera ziehen (Bildposition bleibt gleich): verhindert den
    // harten, waagerechten Schnitt, wenn die flache Partikelscheibe den Boden schneidet.
    float dist = length(mv.xyz);
    float push = min(aSize * 0.4, max(0.0, dist - 1.0) * 0.5);
    mv.xyz *= (dist - push) / max(dist, 1e-3);
    gl_Position = projectionMatrix * mv;
  }`;
const ATLAS_LOOKUP = `
  uniform sampler2D uTex;
  varying vec4 vColor; varying float vRot; varying float vAge; varying float vSeed; varying float vHeat;
  float puff(vec2 uv0){
    float tile = floor(vSeed * 4.0);
    vec2 off = vec2(mod(tile, 2.0), floor(tile / 2.0)) * 0.5;
    return texture2D(uTex, off + clamp(uv0, 0.01, 0.99) * 0.5).a;
  }`;
const PARTICLE_FS_SMOKE = ATLAS_LOOKUP + `
  void main(){
    vec2 q = gl_PointCoord - 0.5;
    float c = cos(vRot), s = sin(vRot);
    vec2 p = vec2(c*q.x - s*q.y, s*q.x + c*q.y);
    float a = puff(p + 0.5);
    // Licht von oben (Bildschirm): in gedrehte Koordinaten umrechnen
    vec2 toLight = vec2(s, -c) * 0.07;
    float a2 = puff(p + 0.5 + toLight);
    float shade = clamp(0.78 + (a - a2) * 1.6 + 0.35 * (0.5 - gl_PointCoord.y), 0.5, 1.4);
    float al = a * vColor.a * smoothstep(0.5, 0.38, length(q));
    if (al < 0.01) discard;
    vec3 col = vColor.rgb * shade * mix(1.0, 0.85, vAge);
    col += vHeat * vec3(1.3, 0.5, 0.1) * max(0.0, 1.0 - vAge * 3.5) * a;
    gl_FragColor = vec4(col, al);
  }`;
const PARTICLE_FS_ADD = ATLAS_LOOKUP + `
  void main(){
    vec2 q = gl_PointCoord - 0.5;
    float c = cos(vRot), s = sin(vRot);
    vec2 p = vec2(c*q.x - s*q.y, s*q.x + c*q.y);
    float d = length(q);
    float t = puff(p + 0.5);
    float a = (0.35 + 0.65 * t) * smoothstep(0.5, 0.0, d);
    float core = smoothstep(0.32, 0.0, d);
    // Farbe ueber Lebenszeit: weiss-gelb -> Grundfarbe(orange) -> dunkelrot
    vec3 hot = mix(vec3(2.4, 2.1, 1.5), vColor.rgb * 1.5, smoothstep(0.0, 0.32, vAge));
    vec3 cool = mix(hot, vec3(0.6, 0.09, 0.02), smoothstep(0.42, 1.0, vAge));
    vec3 col = mix(vColor.rgb, cool, vHeat);
    col *= 0.7 + 1.1 * core;
    float al = a * vColor.a;
    if (al < 0.01) discard;
    gl_FragColor = vec4(col, al);
  }`;

class ParticlePool {
  constructor(max, additive, scene, tex) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    this.rot = new Float32Array(max);
    this.age = new Float32Array(max);
    this.seed = new Float32Array(max);
    this.heat = new Float32Array(max);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grow = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.base = new Float32Array(max * 4);
    this.fadeIn = new Float32Array(max);
    this.alive = 0; this.cursor = 0;
    const geo = new THREE.BufferGeometry();
    const dyn = (arr, n) => new THREE.BufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', dyn(this.pos, 3));
    geo.setAttribute('aColor', dyn(this.col, 4));
    geo.setAttribute('aSize', dyn(this.size, 1));
    geo.setAttribute('aRot', dyn(this.rot, 1));
    geo.setAttribute('aAge', dyn(this.age, 1));
    geo.setAttribute('aSeed', dyn(this.seed, 1));
    geo.setAttribute('aHeat', dyn(this.heat, 1));
    this.geo = geo;
    this.uniforms = { uScale: { value: 600 }, uTex: { value: tex } };
    const mat = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VS, fragmentShader: additive ? PARTICLE_FS_ADD : PARTICLE_FS_SMOKE,
      uniforms: this.uniforms, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 3 : 2;
    scene.add(this.points);
  }
  emit(x, y, z, vx, vy, vz, size, life, r, g, b, a, { grow = 1, drag = 0.5, grav = 0, fadeIn = 0, heat = 0 } = {}) {
    const i = this.cursor; this.cursor = (this.cursor + 1) % this.max;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.base[i * 4] = r; this.base[i * 4 + 1] = g; this.base[i * 4 + 2] = b; this.base[i * 4 + 3] = a;
    this.size[i] = size; this.life[i] = life; this.maxLife[i] = life; this.grow[i] = grow; this.drag[i] = drag; this.grav[i] = grav;
    this.rot[i] = Math.random() * 6.28; this.fadeIn[i] = fadeIn; this.seed[i] = Math.random() * 0.999; this.heat[i] = heat; this.age[i] = 0;
  }
  update(dt, wind) {
    const { life, maxLife, vel, pos, drag, grav, size, grow, rot, fadeIn, col, base, age } = this;
    for (let i = 0; i < this.max; i++) {
      if (life[i] <= 0) { col[i * 4 + 3] = 0; continue; }
      life[i] -= dt;
      const t = 1 - life[i] / maxLife[i];
      const d = Math.max(0, 1 - drag[i] * dt);
      const i3 = i * 3;
      vel[i3] = vel[i3] * d + wind.x * dt;
      vel[i3 + 1] = vel[i3 + 1] * d - grav[i] * dt;
      vel[i3 + 2] = vel[i3 + 2] * d + wind.z * dt;
      pos[i3] += vel[i3] * dt; pos[i3 + 1] += vel[i3 + 1] * dt; pos[i3 + 2] += vel[i3 + 2] * dt;
      size[i] *= 1 + (grow[i] - 1) * dt;
      rot[i] += dt * 0.3;
      age[i] = t;
      const fi = fadeIn[i] > 0 ? Math.min(1, t / fadeIn[i]) : 1;
      const fade = (1 - t) * fi;
      col[i * 4] = base[i * 4]; col[i * 4 + 1] = base[i * 4 + 1]; col[i * 4 + 2] = base[i * 4 + 2];
      col[i * 4 + 3] = base[i * 4 + 3] * fade;
    }
    const a = this.geo.attributes;
    a.position.needsUpdate = true; a.aColor.needsUpdate = true; a.aSize.needsUpdate = true; a.aRot.needsUpdate = true;
    a.aAge.needsUpdate = true; a.aSeed.needsUpdate = true; a.aHeat.needsUpdate = true;
  }
}

const _dummy = new THREE.Object3D();
const _col = new THREE.Color();
// Erdklumpen/Splitter: dunkle Erdtöne statt heller „Steinbrocken"
const DEBRIS_COLORS = [0x3b3127, 0x4a3c2e, 0x2e2a25, 0x55473a, 0x40362c, 0x5a5048];

export class Effects {
  constructor(scene, terrain, quality, audio) {
    this.scene = scene;
    this.terrain = terrain;
    this.audio = audio;
    const mul = { low: 0.4, medium: 0.7, high: 1, ultra: 1.4 }[quality] || 1;
    this.mul = mul;
    this.puffTex = makePuffAtlas();
    this.starTex = makeStarTex();
    this.glowTex = makeGlowTex();
    this.ringTex = makeRingTex();
    this.craterTex = makeCraterTex();
    this.smoke = new ParticlePool(Math.floor(3200 * mul), false, scene, this.puffTex);
    this.fire = new ParticlePool(Math.floor(2400 * mul), true, scene, this.puffTex);
    this.wind = new THREE.Vector3(0.8, 0, 0.4);
    this.emitters = []; // dauerhafte Rauch-/Feuerquellen
    this.tracers = [];
    this.flashes = [];
    this.pending = []; // verzoegerte Explosionsphasen
    this.shake = 0;
    // Leuchtspurgeschosse (Kern + Glow-Huelle)
    this.tracerGeo = new THREE.CylinderGeometry(0.06, 0.06, 1, 5, 1, true);
    this.tracerGeo.rotateX(Math.PI / 2);
    const tm = (r, g, b, op) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending });
    this.tracerMatY = tm(7, 5, 1.8, 1); this.tracerMatR = tm(7.5, 1.8, 1.0, 1); this.tracerMatG = tm(2.2, 6.5, 2.0, 1);
    this.tracerGlowY = tm(2.6, 1.5, 0.35, 0.4); this.tracerGlowR = tm(2.8, 0.45, 0.2, 0.4); this.tracerGlowG = tm(0.5, 2.4, 0.5, 0.4);
    this.tracerPool = [];
    // Lichtblitze (gepoolt)
    this.lights = [];
    const nLights = quality === 'low' ? 2 : 5;
    for (let i = 0; i < nLights; i++) {
      const l = new THREE.PointLight(0xffaa55, 0, 40, 2);
      l.userData.t = 0; l.userData.owner = null;
      scene.add(l);
      this.lights.push(l);
    }
    this.maxOwned = Math.max(0, nLights - 2);
    // Krater (gepoolt)
    this.craterGeo = new THREE.CircleGeometry(1, 24);
    this.craterGeo.rotateX(-Math.PI / 2);
    this.craterMat = new THREE.MeshBasicMaterial({ map: this.craterTex, color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    this.craters = [];
    this.craterIdx = 0;
    // Druckwellen-Ringe (gepoolt)
    this.ringGeo = new THREE.CircleGeometry(1, 40);
    this.ringGeo.rotateX(-Math.PI / 2);
    this.rings = []; this.ringFree = [];
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ map: this.ringTex, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3 }));
      m.visible = false; m.renderOrder = 2; m.userData = {};
      scene.add(m); this.ringFree.push(m);
    }
    // Blitz-Sprites (Sternform / Glow, gepoolt)
    this.sprites = []; this.spriteFree = [];
    const nSpr = Math.ceil(14 * mul) + 8;
    for (let i = 0; i < nSpr; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.starTex, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      s.visible = false; s.renderOrder = 4; s.userData = {};
      scene.add(s); this.spriteFree.push(s);
    }
    // Truemmer (InstancedMesh)
    this.debrisMax = Math.max(24, Math.floor(110 * mul));
    const dg = new THREE.IcosahedronGeometry(1, 0);
    this.debris = new THREE.InstancedMesh(dg, new THREE.MeshLambertMaterial({ color: 0xffffff }), this.debrisMax);
    this.debris.frustumCulled = false;
    this.debris.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.dp = new Float32Array(this.debrisMax * 3); this.dv = new Float32Array(this.debrisMax * 3);
    this.dr = new Float32Array(this.debrisMax * 3); this.ds = new Float32Array(this.debrisMax * 3);
    this.dsize = new Float32Array(this.debrisMax * 3); this.dlife = new Float32Array(this.debrisMax);
    this.dtrail = new Float32Array(this.debrisMax); this.dcursor = 0; this.dalive = 0;
    _dummy.scale.setScalar(0); _dummy.updateMatrix();
    for (let i = 0; i < this.debrisMax; i++) {
      this.debris.setMatrixAt(i, _dummy.matrix);
      this.debris.setColorAt(i, _col.setHex(DEBRIS_COLORS[i % DEBRIS_COLORS.length]));
    }
    this.debris.instanceColor.needsUpdate = true;
    scene.add(this.debris);
    // Markierungen (Bewegungsziel / Warnungen)
    this.markers = [];
    // Wurfkörper (Handgranate, Molotow, Nebelgranate, Sprengladung, Werfergranate) – gepoolt, rein optisch
    this.throws = []; this.throwPool = [];
    this.throwGeo = new THREE.IcosahedronGeometry(0.13, 0);
    const tl = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
    this.throwMats = { grenade: tl(0x3b4030), molotov: tl(0x6f8f4a, { emissive: 0x552200 }), smoke: tl(0x9a9a8c), charge: tl(0x5a4a32), launcher: tl(0x55584a) };
    // Rauchwände (Nebelgranaten/-werfer, Artillerie-Nebel): Objekte { x, z, r, age, dur, dead } aus game.tac.smokes
    this.screens = [];
  }
  // Wurf im Bogen von from nach to (Flugzeit flight s), liegt danach bis fuse s; kind: grenade|molotov|smoke|charge|launcher
  throwable(from, to, flight, fuse, kind = 'grenade') {
    let m = this.throwPool.pop();
    if (!m) { m = new THREE.Mesh(this.throwGeo, this.throwMats.grenade); m.castShadow = false; m.renderOrder = 2; this.scene.add(m); }
    m.material = this.throwMats[kind] || this.throwMats.grenade;
    m.scale.set(1, kind === 'molotov' ? 1.8 : 1, 1).multiplyScalar(kind === 'charge' ? 2.4 : kind === 'launcher' ? 0.75 : 1);
    m.visible = true;
    const d = Math.hypot(to.x - from.x, to.z - from.z);
    const f = Math.max(0.12, flight);
    m.position.copy(from);
    this.throws.push({ m, from: from.clone(), to: to.clone(), t: 0, flight: f, end: Math.max(f, fuse || f), kind, h: kind === 'launcher' ? 0.8 + d * 0.12 : kind === 'charge' ? 0.4 : 1.4 + d * 0.22 });
  }
  _updateThrows(dt) {
    for (let i = this.throws.length - 1; i >= 0; i--) {
      const th = this.throws[i], m = th.m;
      th.t += dt;
      if (th.t >= th.end) { m.visible = false; this.throws.splice(i, 1); this.throwPool.push(m); continue; }
      if (th.t < th.flight) {
        const k = th.t / th.flight;
        m.position.set(th.from.x + (th.to.x - th.from.x) * k, th.from.y + (th.to.y - th.from.y) * k + 4 * th.h * k * (1 - k), th.from.z + (th.to.z - th.from.z) * k);
        m.rotation.x += dt * 14; m.rotation.z += dt * 9;
        const p = m.position;
        if (th.kind === 'molotov') this.fire.emit(p.x, p.y, p.z, 0, 0.4, 0, 0.7, 0.2, 1, 0.6, 0.2, 1, { heat: 1 });
        else if (th.kind === 'smoke' || th.kind === 'launcher') { if (Math.random() < 0.6) this.smoke.emit(p.x, p.y, p.z, 0, 0.2, 0, 0.35, 0.7, 0.75, 0.75, 0.72, 0.5, { grow: 1.6, drag: 1 }); }
      } else {
        const p = m.position.set(th.to.x, th.to.y + 0.08, th.to.z);
        if (th.kind === 'smoke' && Math.random() < 0.9 * this.mul) this.smoke.emit(p.x, p.y + 0.2, p.z, rand(-0.4, 0.4), rand(0.6, 1.4), rand(-0.4, 0.4), rand(1, 1.8), rand(1.6, 2.6), 0.86, 0.86, 0.84, 0.65, { grow: 1.6, drag: 1.2 });
        else if (th.kind === 'grenade' && Math.random() < dt * 6) this.fire.emit(p.x, p.y + 0.1, p.z, rand(-0.5, 0.5), rand(0.5, 1.5), rand(-0.5, 0.5), 0.12, 0.25, 1, 0.8, 0.4, 1, { grav: 3, heat: 0.5 });
      }
    }
  }
  // Brandfläche (Molotow): kurzlebige Feuerquelle am Boden
  firePool(x, y, z, dur = 9) {
    this.addEmitter(new THREE.Vector3(x, y, z), 0, dur, 0.75);
    for (let i = 0; i < 10 * this.mul + 3; i++) this.fire.emit(x + rand(-1.5, 1.5), y + 0.2, z + rand(-1.5, 1.5), rand(-0.6, 0.6), rand(1, 3), rand(-0.6, 0.6), rand(1, 2), rand(0.4, 0.8), 1, 0.55, 0.15, 1, { grow: 0.8, drag: 1, heat: 1 });
  }
  // Rauchwand: emittiert dichten, hellen Rauch im Wolkenradius, solange das Wolkenobjekt lebt (Drift über c.x/c.z)
  smokeScreen(c) { this.screens.push(c); }
  _updateScreens(dt) {
    for (let i = this.screens.length - 1; i >= 0; i--) {
      const c = this.screens[i];
      if (c.dead || c.age >= c.dur) { this.screens.splice(i, 1); continue; }
      const grow = Math.min(1, (c.age + 0.3) / 3), fade = Math.min(1, (c.dur - c.age) / 6);
      const rate = (8 + c.r * 2.6) * this.mul * fade;
      let n = rate * dt; const whole = Math.floor(n); n = whole + (Math.random() < n - whole ? 1 : 0);
      const R = c.r * 0.85 * grow;
      for (let k = 0; k < n; k++) {
        const a = Math.random() * 6.283, rr = Math.sqrt(Math.random()) * R;
        const x = c.x + Math.cos(a) * rr, z = c.z + Math.sin(a) * rr;
        const y = this.terrain.surface(x, z) + rand(0.4, 2.6);
        const g = rand(0.8, 0.9);
        this.smoke.emit(x, y, z, (c.vx || 0) + rand(-0.3, 0.3), rand(0.15, 0.6), (c.vz || 0) + rand(-0.3, 0.3), rand(3.2, 5.2) * (0.6 + 0.4 * grow), rand(4.5, 7), g, g, g * 0.98, 0.5, { grow: 1.22, drag: 0.7, fadeIn: 0.15 });
      }
    }
  }

  // --- interne Helfer ---
  _ring(x, y, z, r0, r1, dur, color, op) {
    const m = this.ringFree.pop();
    if (!m) return;
    m.visible = true; m.position.set(x, y + 0.12, z); m.scale.setScalar(r0);
    m.material.color.copy(color); m.material.opacity = op;
    m.userData = { t: dur, dur, r0, r1, op };
    this.rings.push(m);
  }
  _sprite(x, y, z, size, dur, tex, r, g, b, grow = 1.3) {
    const s = this.spriteFree.pop();
    if (!s) return;
    s.visible = true; s.position.set(x, y, z); s.scale.set(size, size, 1);
    s.material.map = tex; s.material.color.setRGB(r, g, b); s.material.opacity = 1; s.material.rotation = Math.random() * 6.28;
    s.userData = { t: dur, dur, size, grow };
    this.sprites.push(s);
  }
  _debris(x, y, z, vx, vy, vz, sz) {
    const i = this.dcursor; this.dcursor = (this.dcursor + 1) % this.debrisMax;
    if (this.dlife[i] <= 0) this.dalive++;
    this.dp[i * 3] = x; this.dp[i * 3 + 1] = y; this.dp[i * 3 + 2] = z;
    this.dv[i * 3] = vx; this.dv[i * 3 + 1] = vy; this.dv[i * 3 + 2] = vz;
    this.dr[i * 3] = Math.random() * 6; this.dr[i * 3 + 1] = Math.random() * 6; this.dr[i * 3 + 2] = Math.random() * 6;
    this.ds[i * 3] = rand(-9, 9); this.ds[i * 3 + 1] = rand(-9, 9); this.ds[i * 3 + 2] = rand(-9, 9);
    this.dsize[i * 3] = sz * rand(0.7, 1.3); this.dsize[i * 3 + 1] = sz * rand(0.5, 1); this.dsize[i * 3 + 2] = sz * rand(0.7, 1.2);
    this.dlife[i] = rand(0.9, 1.6); this.dtrail[i] = Math.random() < 0.15 ? Math.random() * 0.08 : 99; // nur wenige ziehen eine Staubspur
  }
  _updateDebris(dt) {
    if (this.dalive <= 0) return;
    const T = this.terrain;
    let alive = 0;
    for (let i = 0; i < this.debrisMax; i++) {
      if (this.dlife[i] <= 0) continue;
      const i3 = i * 3;
      this.dlife[i] -= dt;
      if (this.dlife[i] <= 0) {
        _dummy.scale.setScalar(0); _dummy.updateMatrix(); this.debris.setMatrixAt(i, _dummy.matrix); continue;
      }
      alive++;
      this.dv[i3 + 1] -= 24 * dt;
      this.dp[i3] += this.dv[i3] * dt; this.dp[i3 + 1] += this.dv[i3 + 1] * dt; this.dp[i3 + 2] += this.dv[i3 + 2] * dt;
      const g = T.surface(this.dp[i3], this.dp[i3 + 2]);
      let flying = true;
      if (this.dp[i3 + 1] < g + 0.1) {
        this.dp[i3 + 1] = g + 0.1;
        if (T.isWater(this.dp[i3], this.dp[i3 + 2])) { this.dlife[i] = 0.01; this.smoke.emit(this.dp[i3], g, this.dp[i3 + 2], 0, 2, 0, 1, 0.6, 0.9, 0.95, 1, 0.5, { grow: 1.8 }); continue; }
        if (this.dv[i3 + 1] < -3) { this.dv[i3 + 1] *= -0.3; this.dv[i3] *= 0.6; this.dv[i3 + 2] *= 0.6; this.ds[i3] *= 0.5; this.ds[i3 + 1] *= 0.5; this.ds[i3 + 2] *= 0.5; }
        else { this.dv[i3] = this.dv[i3 + 1] = this.dv[i3 + 2] = 0; this.ds[i3] = this.ds[i3 + 1] = this.ds[i3 + 2] = 0; flying = false; if (this.dlife[i] > 0.35) this.dlife[i] = 0.35; }
      }
      if (flying) {
        this.dr[i3] += this.ds[i3] * dt; this.dr[i3 + 1] += this.ds[i3 + 1] * dt; this.dr[i3 + 2] += this.ds[i3 + 2] * dt;
        this.dtrail[i] -= dt;
        if (this.dtrail[i] <= 0) {
          this.dtrail[i] = 0.07;
          this.smoke.emit(this.dp[i3], this.dp[i3 + 1], this.dp[i3 + 2], rand(-0.3, 0.3), rand(0.1, 0.5), rand(-0.3, 0.3), rand(0.25, 0.45), rand(0.4, 0.8), 0.34, 0.29, 0.24, 0.35, { grow: 1.5, drag: 1.5 });
        }
      }
      const sc = Math.min(1, this.dlife[i] * 3);
      _dummy.position.set(this.dp[i3], this.dp[i3 + 1], this.dp[i3 + 2]);
      _dummy.rotation.set(this.dr[i3], this.dr[i3 + 1], this.dr[i3 + 2]);
      _dummy.scale.set(this.dsize[i3] * sc, this.dsize[i3 + 1] * sc, this.dsize[i3 + 2] * sc);
      _dummy.updateMatrix();
      this.debris.setMatrixAt(i, _dummy.matrix);
    }
    this.dalive = alive;
    this.debris.instanceMatrix.needsUpdate = true;
  }

  // --- Explosionen ---
  explosion(x, y, z, size = 1, { crater = true, sound = true, water = false, air = false } = {}) {
    const m = this.mul;
    const sc = Math.min(size, 5); // Zaehlbasis begrenzen
    if (water) this._waterExplosion(x, y, z, size, sc);
    else this._blast(x, y, z, size, sc, air);
    if (!water) this.pending.push({ t: 0.22, step: 0, x, y, z, size, sc, air });
    if (!water && !air && crater) this.addCrater(x, z, 1.2 + size * 1.6);
    this.flash(x, y + 2, z, 40 * size, 0.18 + 0.12 * size);
    if (sound && this.audio) this.audio.explosion(x, z, size);
    this.shake = Math.min(1.2, this.shake + 0.15 * size);
  }
  _blast(x, y, z, size, sc, air) {
    const m = this.mul;
    const H = size * 4; // Basisgroesse
    // Kernblitz
    this._sprite(x, y + 1.2 * size, z, 11 * size, 0.16, this.glowTex, 3, 2.6, 1.8, 1.6);
    this.fire.emit(x, y + 1, z, 0, 0, 0, 9 * size, 0.14, 1, 0.9, 0.6, 1, { grow: 1.5, heat: 1 });
    // Feuerball mit Farbverlauf (heat)
    const nF = Math.floor((10 + 12 * sc) * m);
    for (let i = 0; i < nF; i++) {
      const a = Math.random() * 6.28, el = air ? rand(-1, 1) : Math.random();
      const sp = rand(2, 8) * size, hz = Math.sqrt(Math.max(0, 1 - el * el));
      this.fire.emit(x + rand(-0.5, 0.5), y + (air ? 0 : 0.5), z + rand(-0.5, 0.5), Math.cos(a) * sp * hz, (air ? el * sp : 2 + el * sp * 1.2), Math.sin(a) * sp * hz,
        rand(2.6, 5.6) * size, rand(0.35, 0.85), 1.0, rand(0.5, 0.7), 0.18, 1.0, { grow: 1.9, drag: 3, heat: 1 });
    }
    // Rauchblasen um den Feuerball (heisser, dunkler Rauch)
    const nS = Math.floor((8 + 10 * sc) * m);
    for (let i = 0; i < nS; i++) {
      const a = Math.random() * 6.28, sp = rand(1, 5) * size, g = rand(0.07, 0.2);
      this.smoke.emit(x + rand(-1, 1) * size, y + rand(0, 2) * size, z + rand(-1, 1) * size, Math.cos(a) * sp, (air ? rand(-3, 3) : rand(2, 6)) * size, Math.sin(a) * sp,
        rand(3, 6) * size, rand(2.5, 5) * Math.sqrt(size), g, g * 0.95, g * 0.9, 0.85, { grow: 1.45, drag: 1.4, fadeIn: 0.08, heat: 1 });
    }
    // Funken
    const nSp = Math.floor((8 + 8 * sc) * m);
    for (let i = 0; i < nSp; i++) {
      const a = Math.random() * 6.28, sp = rand(8, 22) * size;
      this.fire.emit(x, y + 0.5, z, Math.cos(a) * sp, rand(air ? -12 : 4, 16) * size, Math.sin(a) * sp, rand(0.3, 0.7), rand(0.5, 1.2), 1, 0.75, 0.3, 1, { drag: 0.3, grav: 22, heat: 0.5 });
    }
    if (air) return;
    // Druckwelle am Boden
    _col.setRGB(1.2, 1.0, 0.8);
    this._ring(x, this.terrain.surface(x, z), z, 1.5, 7 * size + 3, 0.45, _col, 0.9);
    // Staubwolke
    const nD = Math.floor((10 + 10 * sc) * m);
    for (let i = 0; i < nD; i++) {
      const a = (i / nD) * 6.28 + Math.random() * 0.4, sp = rand(7, 14) * size;
      const c = rand(0.4, 0.55);
      this.smoke.emit(x + Math.cos(a) * 1.5, y + 1.0, z + Math.sin(a) * 1.5, Math.cos(a) * sp, rand(0.3, 1.5), Math.sin(a) * sp, rand(2.6, 4.2) * size, rand(1.4, 2.6), c, c * 0.88, c * 0.7, 0.6, { grow: 1.5, drag: 2.6, fadeIn: 0.05 });
    }
    // Erdfontäne: Einschläge werfen vor allem Erde steil nach oben (Partikel) …
    const nE = Math.floor((10 + 8 * sc) * m);
    for (let i = 0; i < nE; i++) {
      const a = Math.random() * 6.28, sp = rand(1, 5) * Math.sqrt(size);
      const c = rand(0.16, 0.26);
      this.smoke.emit(x + rand(-0.5, 0.5), y + 0.5, z + rand(-0.5, 0.5), Math.cos(a) * sp, rand(10, 22) * Math.sqrt(size), Math.sin(a) * sp,
        rand(0.9, 1.8) * size, rand(0.9, 1.5), c, c * 0.85, c * 0.7, 0.85, { grow: 1.35, drag: 0.9, grav: 16 });
    }
    // … dazu kleine dunkle Erdklumpen/Splitter (keine großen hellen Brocken)
    const nT = Math.floor((7 + 6 * sc) * m);
    for (let i = 0; i < nT; i++) {
      const a = Math.random() * 6.28, sp = rand(3, 10) * Math.sqrt(size);
      this._debris(x, y + 0.5, z, Math.cos(a) * sp, rand(10, 24) * Math.sqrt(size), Math.sin(a) * sp, rand(0.07, 0.2) * Math.sqrt(size));
    }
    // Rauchsaeule (Stiel)
    const nStem = Math.floor((5 + 5 * sc) * m);
    for (let i = 0; i < nStem; i++) {
      const g = rand(0.1, 0.2);
      this.smoke.emit(x + rand(-1, 1) * size, y + 1 + i * 0.5 * size, z + rand(-1, 1) * size, rand(-0.6, 0.6), rand(5, 10) * size, rand(-0.6, 0.6),
        rand(2.8, 4.4) * size, rand(2.5, 4.5), g, g, g * 0.95, 0.8, { grow: 1.35, drag: 1.2, fadeIn: 0.1, heat: 0.6 });
    }
    void H;
  }
  _stage(p) {
    const m = this.mul, { x, y, z, size, sc } = p;
    if (p.step === 0) {
      // Pilzkopf: Ring aus Rauch, der nach aussen rollt
      const nC = Math.floor((9 + 9 * sc) * m);
      const hy = y + 3.5 * size;
      for (let i = 0; i < nC; i++) {
        const a = (i / nC) * 6.28 + Math.random() * 0.5, sp = rand(2.5, 5) * size, g = rand(0.16, 0.3);
        this.smoke.emit(x + Math.cos(a) * size, hy + rand(-0.5, 1) * size, z + Math.sin(a) * size, Math.cos(a) * sp, rand(4, 7.5) * size, Math.sin(a) * sp,
          rand(3.5, 6) * size, rand(3, 5.5), g, g * 0.97, g * 0.92, 0.85, { grow: 1.35, drag: 1.5, fadeIn: 0.08 });
      }
      // Kappe oben
      for (let i = 0; i < Math.floor((4 + 3 * sc) * m); i++) {
        const g = rand(0.2, 0.32);
        this.smoke.emit(x + rand(-1.5, 1.5) * size, hy + 3 * size, z + rand(-1.5, 1.5) * size, rand(-1.5, 1.5), rand(3, 5) * size, rand(-1.5, 1.5),
          rand(4.5, 7) * size, rand(3.5, 5.5), g, g, g * 0.95, 0.8, { grow: 1.3, drag: 1.3, fadeIn: 0.1 });
      }
      p.t = 0.25; p.step = 1;
    } else {
      // Nachlaufender Stiel
      for (let i = 0; i < Math.floor((3 + 3 * sc) * m); i++) {
        const g = rand(0.12, 0.22);
        this.smoke.emit(x + rand(-1, 1) * size, y + 2 * size + i * size, z + rand(-1, 1) * size, rand(-0.5, 0.5), rand(4, 8) * size, rand(-0.5, 0.5),
          rand(3, 5) * size, rand(3, 5), g, g, g, 0.7, { grow: 1.3, drag: 1.2, fadeIn: 0.1 });
      }
      p.t = -1;
    }
  }
  _waterExplosion(x, y, z, size, sc) {
    const m = this.mul;
    this._sprite(x, y + 1, z, 7 * size, 0.12, this.glowTex, 1.6, 1.8, 2.2, 1.4);
    // Wassersaeule
    const nC = Math.floor((12 + 12 * sc) * m);
    for (let i = 0; i < nC; i++) {
      const a = Math.random() * 6.28, r = Math.random() * 1.2 * size, k = i / nC;
      this.smoke.emit(x + Math.cos(a) * r, y + k * 2 * size, z + Math.sin(a) * r, Math.cos(a) * rand(0.5, 2.5), rand(10, 20) * size * (0.6 + k * 0.5), Math.sin(a) * rand(0.5, 2.5),
        rand(2, 4) * size, rand(1.2, 2.2), 0.88, 0.94, 1, 0.8, { grow: 1.5, drag: 0.5, grav: 14 });
    }
    // Gischt (Tropfen)
    for (let i = 0; i < Math.floor((14 + 14 * sc) * m); i++) {
      const a = Math.random() * 6.28, sp = rand(2, 7) * size;
      this.smoke.emit(x, y + 1, z, Math.cos(a) * sp, rand(8, 18) * size, Math.sin(a) * sp, rand(0.7, 1.4), rand(0.9, 1.7), 0.95, 0.98, 1, 0.85, { grow: 1.2, drag: 0.3, grav: 20 });
    }
    // Gischt-Ring am Wasser
    const nR = Math.floor((14 + 10 * sc) * m);
    for (let i = 0; i < nR; i++) {
      const a = (i / nR) * 6.28, sp = rand(5, 9) * size;
      this.smoke.emit(x + Math.cos(a) * 2, y + 0.3, z + Math.sin(a) * 2, Math.cos(a) * sp, rand(0.5, 2), Math.sin(a) * sp, rand(2, 3.4) * size, rand(1.2, 2), 0.93, 0.97, 1, 0.6, { grow: 1.7, drag: 2, fadeIn: 0.05 });
    }
    _col.setRGB(0.9, 1.1, 1.3);
    this._ring(x, y, z, 1.5, 6 * size + 3, 0.6, _col, 0.8);
    this._ring(x, y, z, 0.8, 3.5 * size + 2, 0.9, _col, 0.5);
    this.fire.emit(x, y + 1, z, 0, 0, 0, 5 * size, 0.1, 0.9, 1, 1, 0.8);
  }
  smallHit(x, y, z) {
    for (let i = 0; i < 4 * this.mul + 1; i++) this.smoke.emit(x, y, z, rand(-1, 1), rand(1, 3), rand(-1, 1), rand(0.6, 1.2), rand(0.4, 0.8), 0.45, 0.4, 0.33, 0.6, { grow: 1.8, drag: 2 });
    this.fire.emit(x, y, z, 0, 0, 0, 1.6, 0.1, 1, 0.8, 0.4, 1, { heat: 1 });
    for (let i = 0; i < 3 * this.mul + 1; i++) this.fire.emit(x, y, z, rand(-5, 5), rand(2, 7), rand(-5, 5), rand(0.2, 0.4), rand(0.3, 0.6), 1, 0.75, 0.3, 1, { drag: 0.3, grav: 20, heat: 0.5 });
  }
  muzzle(x, y, z, big = false) {
    this._sprite(x, y, z, big ? 6 : 1.8, big ? 0.1 : 0.05, this.starTex, 3, 2.4, 1.2, 1.2);
    this.fire.emit(x, y, z, 0, 0, 0, big ? 3.5 : 0.9, big ? 0.12 : 0.06, 1, 0.75, 0.35, 1, { heat: 0.6 });
    if (big) {
      // Rauchring (waagerecht) + Puffs
      const nR = Math.max(5, Math.floor(10 * this.mul));
      for (let i = 0; i < nR; i++) {
        const a = (i / nR) * 6.28, sp = rand(3.5, 5.5);
        this.smoke.emit(x, y, z, Math.cos(a) * sp, rand(0, 0.6), Math.sin(a) * sp, rand(1.4, 2.2), rand(1, 1.8), 0.65, 0.62, 0.58, 0.55, { grow: 1.6, drag: 2.2 });
      }
      for (let i = 0; i < 4 * this.mul; i++) this.smoke.emit(x, y, z, rand(-1.5, 1.5), rand(0.5, 2), rand(-1.5, 1.5), rand(1.8, 3), rand(1.2, 2.2), 0.55, 0.53, 0.5, 0.5, { grow: 1.5, drag: 1.5 });
      this.flash(x, y, z, 14, 0.08);
    }
  }
  trail(x, y, z, kind = 'missile') {
    const dense = Math.random() < 0.5 + this.mul * 0.5;
    if (kind === 'missile') {
      this.fire.emit(x, y, z, 0, 0, 0, 1.8, 0.1, 1, 0.65, 0.25, 1, { heat: 1 });
      this.fire.emit(x, y, z, 0, 0, 0, 0.9, 0.07, 1, 0.95, 0.7, 1);
      if (dense) this.smoke.emit(x, y, z, rand(-0.3, 0.3), rand(0, 0.5), rand(-0.3, 0.3), rand(1, 1.7), rand(2.8, 4.6), 0.8, 0.8, 0.8, 0.6, { grow: 1.45, drag: 1, fadeIn: 0.05, heat: 0.5 });
    } else if (kind === 'hypersonic') {
      this.fire.emit(x, y, z, 0, 0, 0, 3.6, 0.3, 1, 0.5, 0.25, 1, { heat: 1 });
      this.fire.emit(x, y, z, 0, 0, 0, 2.4, 0.5, 0.45, 0.6, 1, 0.9);   // Plasma-Gluehen
      this.fire.emit(x, y, z, 0, 0, 0, 1.2, 0.18, 1, 1, 1, 1);
      if (dense) this.smoke.emit(x, y, z, rand(-0.2, 0.2), rand(0, 0.3), rand(-0.2, 0.2), rand(2.2, 3.2), rand(3.5, 5.5), 0.88, 0.88, 0.92, 0.55, { grow: 1.3, drag: 0.8, fadeIn: 0.04, heat: 0.3 });
    } else if (kind === 'drone') {
      if (Math.random() < 0.3) this.smoke.emit(x, y, z, 0, 0, 0, 0.4, 0.5, 0.5, 0.5, 0.5, 0.3, { grow: 1.5 });
    } else if (kind === 'wake') {
      this.smoke.emit(x, y + 0.2, z, rand(-1, 1), rand(0.5, 1.5), rand(-1, 1), rand(0.8, 1.6), rand(0.8, 1.6), 0.92, 0.96, 1, 0.7, { grow: 1.7, drag: 1.5, grav: 3 });
    }
  }
  fireAndSmoke(x, y, z, intensity = 1) {
    const m = this.mul;
    if (Math.random() < 0.8 * m) this.fire.emit(x + rand(-0.6, 0.6), y + rand(0, 0.6), z + rand(-0.6, 0.6), rand(-0.3, 0.3), rand(1.5, 3.2), rand(-0.3, 0.3), rand(1.2, 2.4) * intensity, rand(0.35, 0.7), 1, 0.5, 0.15, 0.95, { grow: 0.7, drag: 1, heat: 1 });
    if (Math.random() < 0.6 * m) this.smoke.emit(x + rand(-0.5, 0.5), y + 1, z + rand(-0.5, 0.5), rand(-0.2, 0.2), rand(2, 4), rand(-0.2, 0.2), rand(1.6, 2.7) * intensity, rand(3.5, 6.5), 0.1, 0.1, 0.1, 0.72, { grow: 1.35, drag: 0.4, fadeIn: 0.1, heat: 0.5 });
    if (Math.random() < 0.08 * m) this.fire.emit(x + rand(-0.5, 0.5), y + 0.5, z + rand(-0.5, 0.5), rand(-1.5, 1.5), rand(3, 6), rand(-1.5, 1.5), rand(0.2, 0.35), rand(0.6, 1.2), 1, 0.7, 0.3, 1, { drag: 0.4, grav: -1, heat: 0.4 });
  }
  // Dauerhafte Brandquelle (z. B. Wrack)
  addEmitter(obj, offsetY = 1, duration = 30, intensity = 1) {
    const e = { obj, offsetY, t: duration, intensity, light: null, ph: Math.random() * 10 };
    if (intensity >= 1.1 && this.maxOwned > 0) {
      let owned = 0; for (const l of this.lights) if (l.userData.owner) owned++;
      if (owned < this.maxOwned) {
        const l = this.lights.find((l) => !l.userData.owner && l.userData.t <= 0);
        if (l) { l.userData.owner = e; e.light = l; l.color.setHex(0xff7a2a); l.distance = 18; }
      }
    }
    this.emitters.push(e);
  }
  _releaseLight(e) {
    const l = e.light; if (!l) return;
    l.userData.owner = null; l.intensity = 0; l.userData.t = 0; l.color.setHex(0xffaa55); l.distance = 40; e.light = null;
  }
  addCrater(x, z, r) {
    let m = this.craters[this.craterIdx];
    if (!m) { m = new THREE.Mesh(this.craterGeo, this.craterMat); m.renderOrder = 1; this.scene.add(m); this.craters.push(m); }
    this.craterIdx = (this.craterIdx + 1) % 60;
    m.position.set(x, this.terrain.surface(x, z) + 0.06, z);
    const rr = r * 1.15;
    m.scale.set(rr * rand(0.9, 1.1), rr, rr * rand(0.9, 1.1));
    m.rotation.y = Math.random() * 6.28;
    m.visible = !this.terrain.isWater(x, z);
  }
  flash(x, y, z, intensity, dur) {
    intensity *= this.flashMul || 1; // V3-W: Mündungsfeuer/Explosionen leuchten nachts stärker
    const free = this.lights.filter((l) => !l.userData.owner);
    if (!free.length) return;
    const l = free.find((l) => l.userData.t <= 0) || free.reduce((a, b) => (a.userData.t < b.userData.t ? a : b));
    l.position.set(x, y, z);
    l.userData.t = dur; l.userData.dur = dur; l.userData.max = intensity;
    l.intensity = intensity;
  }
  tracer(from, to, color = 'y', speed = 300) {
    let m = this.tracerPool.pop();
    const mat = color === 'r' ? this.tracerMatR : color === 'g' ? this.tracerMatG : this.tracerMatY;
    const glow = color === 'r' ? this.tracerGlowR : color === 'g' ? this.tracerGlowG : this.tracerGlowY;
    if (!m) {
      m = new THREE.Mesh(this.tracerGeo, mat);
      const gl = new THREE.Mesh(this.tracerGeo, glow); gl.scale.set(4.5, 4.5, 1.15); gl.renderOrder = 3; m.add(gl);
      m.renderOrder = 3; this.scene.add(m);
    }
    m.material = mat; m.children[0].material = glow;
    m.visible = true;
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    m.userData = { from: from.clone(), dir: dir.normalize(), len, d: 0, speed };
    m.scale.set(1, 1, Math.min(5, len * 0.35));
    m.position.copy(from);
    m.lookAt(to);
    this.tracers.push(m);
  }
  marker(x, z, color = 0x46c46b, dur = 0.8, r = 1.5) {
    const geo = new THREE.RingGeometry(r * 0.75, r, 24);
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, depthTest: false }));
    m.position.set(x, this.terrain.surface(x, z) + 0.2, z);
    m.renderOrder = 5;
    m.userData = { t: dur, dur, r };
    this.scene.add(m);
    this.markers.push(m);
    return m;
  }

  update(dt) {
    this.smoke.update(dt, this.wind);
    this.fire.update(dt, { x: 0, z: 0 });
    this._updateDebris(dt);
    this._updateThrows(dt);
    this._updateScreens(dt);
    const now = performance.now() / 1000;
    for (let i = this.emitters.length - 1; i >= 0; i--) {
      const e = this.emitters[i];
      e.t -= dt;
      const p = e.obj.position || e.obj;
      if (e.t <= 0) { this._releaseLight(e); this.emitters.splice(i, 1); continue; }
      const k = Math.min(1, e.t / 6);
      if (Math.random() < k) this.fireAndSmoke(p.x, p.y + e.offsetY, p.z, e.intensity);
      if (e.light) {
        const f = 0.7 + 0.3 * Math.sin(now * 17 + e.ph) * Math.sin(now * 7.3 + e.ph * 2) + Math.random() * 0.25;
        e.light.position.set(p.x, p.y + e.offsetY + 1.5, p.z);
        e.light.intensity = 9 * e.intensity * f * k;
      }
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const m = this.tracers[i], u = m.userData;
      u.d += u.speed * dt;
      if (u.d >= u.len) { m.visible = false; this.tracers.splice(i, 1); this.tracerPool.push(m); continue; }
      m.position.copy(u.from).addScaledVector(u.dir, u.d);
      // Glut-Schweif
      this.fire.emit(m.position.x, m.position.y, m.position.z, 0, 0, 0, 0.55, 0.12, m.material.color.r > m.material.color.g * 2 ? 1 : 1, m.material.color.r > m.material.color.g * 2 ? 0.35 : 0.8, m.material.color.r > m.material.color.g * 2 ? 0.2 : 0.35, 0.7);
    }
    for (const l of this.lights) {
      if (l.userData.owner) continue;
      if (l.userData.t > 0) { l.userData.t -= dt; l.intensity = Math.max(0, l.userData.max * (l.userData.t / l.userData.dur)); }
      else l.intensity = 0;
    }
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i];
      p.t -= dt;
      if (p.t <= 0) { this._stage(p); if (p.t < 0) this.pending.splice(i, 1); }
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i], u = r.userData;
      u.t -= dt;
      if (u.t <= 0) { r.visible = false; this.rings.splice(i, 1); this.ringFree.push(r); continue; }
      const k = 1 - u.t / u.dur;
      r.scale.setScalar(u.r0 + (u.r1 - u.r0) * (1 - (1 - k) * (1 - k)));
      r.material.opacity = u.op * (1 - k) * (1 - k);
    }
    for (let i = this.sprites.length - 1; i >= 0; i--) {
      const s = this.sprites[i], u = s.userData;
      u.t -= dt;
      if (u.t <= 0) { s.visible = false; this.sprites.splice(i, 1); this.spriteFree.push(s); continue; }
      const k = 1 - u.t / u.dur;
      const sz = u.size * (1 + (u.grow - 1) * k);
      s.scale.set(sz, sz, 1);
      s.material.opacity = 1 - k * k;
    }
    for (let i = this.markers.length - 1; i >= 0; i--) {
      const m = this.markers[i];
      if (m.userData.persistent) { m.material.opacity = 0.5 + 0.4 * Math.sin(performance.now() / 150); continue; }
      m.userData.t -= dt;
      const t = m.userData.t / m.userData.dur;
      m.material.opacity = t;
      m.scale.setScalar(0.6 + 0.4 * t);
      if (m.userData.t <= 0) { this.scene.remove(m); m.geometry.dispose(); m.material.dispose(); this.markers.splice(i, 1); }
    }
    this.shake = Math.max(0, this.shake - dt * 2.5);
  }
  removeMarker(m) {
    const i = this.markers.indexOf(m);
    if (i >= 0) this.markers.splice(i, 1);
    this.scene.remove(m); m.geometry.dispose(); m.material.dispose();
  }
  setScale(h) { this.smoke.uniforms.uScale.value = h * 0.9; this.fire.uniforms.uScale.value = h * 0.9; }
}
