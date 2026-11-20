// Partikel, Explosionen, Leuchtspur, Krater, Lichtblitze
import * as THREE from 'three';
import { rand } from './util.js';

const PARTICLE_VS = `
  attribute float aSize; attribute vec4 aColor; attribute float aRot;
  varying vec4 vColor; varying float vRot;
  uniform float uScale;
  void main(){
    vColor = aColor; vRot = aRot;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;
const PARTICLE_FS_SMOKE = `
  varying vec4 vColor; varying float vRot;
  float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
  void main(){
    vec2 p = gl_PointCoord - 0.5;
    float c = cos(vRot), s = sin(vRot);
    p = vec2(c*p.x - s*p.y, s*p.x + c*p.y);
    float d = length(p);
    float puff = 0.5 + 0.18*sin(atan(p.y,p.x)*5.0 + vRot*3.0);
    float a = smoothstep(0.5, 0.15, d) * (0.75 + 0.25*sin(p.x*14.0+vRot)*cos(p.y*11.0));
    a *= vColor.a;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor.rgb * (0.85 + 0.3*(0.5-p.y)), a);
  }`;
const PARTICLE_FS_ADD = `
  varying vec4 vColor; varying float vRot;
  void main(){
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p);
    float a = smoothstep(0.5, 0.0, d);
    a = a*a * vColor.a;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor.rgb * a, a);
  }`;

class ParticlePool {
  constructor(max, additive, scene) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    this.rot = new Float32Array(max);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grow = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.base = new Float32Array(max * 4);
    this.fadeIn = new Float32Array(max);
    this.alive = 0; this.cursor = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aRot', new THREE.BufferAttribute(this.rot, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = geo;
    this.uniforms = { uScale: { value: 600 } };
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
  emit(x, y, z, vx, vy, vz, size, life, r, g, b, a, { grow = 1, drag = 0.5, grav = 0, fadeIn = 0 } = {}) {
    const i = this.cursor; this.cursor = (this.cursor + 1) % this.max;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.base[i * 4] = r; this.base[i * 4 + 1] = g; this.base[i * 4 + 2] = b; this.base[i * 4 + 3] = a;
    this.size[i] = size; this.life[i] = life; this.maxLife[i] = life; this.grow[i] = grow; this.drag[i] = drag; this.grav[i] = grav;
    this.rot[i] = Math.random() * 6.28; this.fadeIn[i] = fadeIn;
  }
  update(dt, wind) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { this.col[i * 4 + 3] = 0; continue; }
      this.life[i] -= dt;
      const t = 1 - this.life[i] / this.maxLife[i];
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i * 3] = this.vel[i * 3] * d + wind.x * dt;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d - this.grav[i] * dt;
      this.vel[i * 3 + 2] = this.vel[i * 3 + 2] * d + wind.z * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] *= 1 + (this.grow[i] - 1) * dt;
      this.rot[i] += dt * 0.3;
      const fi = this.fadeIn[i] > 0 ? Math.min(1, t / this.fadeIn[i]) : 1;
      const fade = (1 - t) * fi;
      this.col[i * 4] = this.base[i * 4]; this.col[i * 4 + 1] = this.base[i * 4 + 1]; this.col[i * 4 + 2] = this.base[i * 4 + 2];
      this.col[i * 4 + 3] = this.base[i * 4 + 3] * fade;
    }
    const a = this.geo.attributes;
    a.position.needsUpdate = true; a.aColor.needsUpdate = true; a.aSize.needsUpdate = true; a.aRot.needsUpdate = true;
  }
}

export class Effects {
  constructor(scene, terrain, quality, audio) {
    this.scene = scene;
    this.terrain = terrain;
    this.audio = audio;
    const mul = { low: 0.4, medium: 0.7, high: 1, ultra: 1.4 }[quality] || 1;
    this.mul = mul;
    this.smoke = new ParticlePool(Math.floor(2600 * mul), false, scene);
    this.fire = new ParticlePool(Math.floor(2200 * mul), true, scene);
    this.wind = new THREE.Vector3(0.8, 0, 0.4);
    this.emitters = []; // dauerhafte Rauch-/Feuerquellen
    this.tracers = [];
    this.flashes = [];
    this.shake = 0;
    // Leuchtspurgeschosse
    this.tracerGeo = new THREE.CylinderGeometry(0.06, 0.06, 1, 4, 1, true);
    this.tracerGeo.rotateX(Math.PI / 2);
    this.tracerMatY = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3, 1.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.tracerMatR = new THREE.MeshBasicMaterial({ color: new THREE.Color(4.5, 1.2, 0.8), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.tracerMatG = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 4.0, 1.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.tracerPool = [];
    // Lichtblitze (gepoolt)
    this.lights = [];
    const nLights = quality === 'low' ? 2 : 5;
    for (let i = 0; i < nLights; i++) {
      const l = new THREE.PointLight(0xffaa55, 0, 40, 2);
      l.userData.t = 0;
      scene.add(l);
      this.lights.push(l);
    }
    // Krater (gepoolt)
    this.craterGeo = new THREE.CircleGeometry(1, 16);
    this.craterGeo.rotateX(-Math.PI / 2);
    this.craterMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    this.craters = [];
    this.craterIdx = 0;
    // Markierungen (Bewegungsziel / Warnungen)
    this.markers = [];
  }

  // --- Explosionen ---
  explosion(x, y, z, size = 1, { crater = true, sound = true, water = false, air = false } = {}) {
    const m = this.mul;
    const n = Math.floor((14 + 18 * size) * m);
    if (water) {
      for (let i = 0; i < n * 1.5; i++) {
        const a = Math.random() * 6.28, sp = rand(1, 4) * size;
        this.smoke.emit(x, y, z, Math.cos(a) * sp, rand(6, 16) * size, Math.sin(a) * sp, rand(2, 4) * size, rand(1, 2), 0.85, 0.9, 0.95, 0.8, { grow: 1.6, drag: 0.6, grav: 14 });
      }
    } else {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.28, el = Math.random(), sp = rand(2, 9) * size;
        this.fire.emit(x, y + 0.5, z, Math.cos(a) * sp * (1 - el * 0.5), rand(2, 10) * size * (air ? 0.5 : 1), Math.sin(a) * sp * (1 - el * 0.5),
          rand(2.5, 5.5) * size, rand(0.25, 0.6), 1.0, rand(0.45, 0.7), 0.2, 1.0, { grow: 2.2, drag: 3 });
      }
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.28, sp = rand(1, 5) * size;
        const g = rand(0.08, 0.22);
        this.smoke.emit(x + rand(-1, 1) * size, y + rand(0, 2) * size, z + rand(-1, 1) * size, Math.cos(a) * sp, rand(2, 6) * size, Math.sin(a) * sp,
          rand(3, 6) * size, rand(2.5, 5) * Math.sqrt(size), g, g * 0.95, g * 0.9, 0.85, { grow: 1.45, drag: 1.4, fadeIn: 0.08 });
      }
      // Funken / Trümmer
      for (let i = 0; i < n * 0.6; i++) {
        const a = Math.random() * 6.28, sp = rand(6, 18) * size;
        this.fire.emit(x, y + 0.5, z, Math.cos(a) * sp, rand(5, 16) * size, Math.sin(a) * sp, rand(0.4, 0.9), rand(0.5, 1.2), 1, 0.7, 0.3, 1, { drag: 0.3, grav: 22 });
      }
      if (crater && !air) this.addCrater(x, z, 1.2 + size * 1.6);
    }
    this.flash(x, y + 2, z, 40 * size, 0.18 + 0.12 * size);
    if (sound && this.audio) this.audio.explosion(x, z, size);
    this.shake = Math.min(1.2, this.shake + 0.15 * size);
  }
  smallHit(x, y, z) {
    for (let i = 0; i < 4 * this.mul + 1; i++) this.smoke.emit(x, y, z, rand(-1, 1), rand(1, 3), rand(-1, 1), rand(0.6, 1.2), rand(0.4, 0.8), 0.45, 0.4, 0.33, 0.6, { grow: 1.8, drag: 2 });
  }
  muzzle(x, y, z, big = false) {
    this.fire.emit(x, y, z, 0, 0, 0, big ? 3.5 : 0.9, big ? 0.12 : 0.06, 1, 0.75, 0.35, 1);
    if (big) {
      for (let i = 0; i < 6 * this.mul; i++) this.smoke.emit(x, y, z, rand(-2, 2), rand(0, 2), rand(-2, 2), rand(1.5, 3), rand(1, 2), 0.6, 0.58, 0.55, 0.5, { grow: 1.6, drag: 2 });
      this.flash(x, y, z, 14, 0.08);
    }
  }
  trail(x, y, z, kind = 'missile') {
    if (kind === 'missile') {
      this.fire.emit(x, y, z, 0, 0, 0, 1.6, 0.08, 1, 0.7, 0.35, 1);
      this.smoke.emit(x, y, z, rand(-0.3, 0.3), rand(0, 0.5), rand(-0.3, 0.3), rand(0.8, 1.4), rand(1.5, 2.8), 0.75, 0.75, 0.75, 0.55, { grow: 1.5, drag: 1 });
    } else if (kind === 'hypersonic') {
      this.fire.emit(x, y, z, 0, 0, 0, 3.2, 0.25, 1, 0.55, 0.3, 1);
      this.fire.emit(x, y, z, 0, 0, 0, 1.6, 0.4, 0.6, 0.7, 1, 0.8);
      this.smoke.emit(x, y, z, 0, 0, 0, 2.2, 3.0, 0.85, 0.85, 0.9, 0.5, { grow: 1.3, drag: 1 });
    } else if (kind === 'drone') {
      if (Math.random() < 0.3) this.smoke.emit(x, y, z, 0, 0, 0, 0.4, 0.5, 0.5, 0.5, 0.5, 0.3, { grow: 1.5 });
    } else if (kind === 'wake') {
      this.smoke.emit(x, y + 0.2, z, rand(-1, 1), rand(0.5, 1.5), rand(-1, 1), rand(0.8, 1.6), rand(0.8, 1.6), 0.9, 0.95, 1, 0.7, { grow: 1.7, drag: 1.5, grav: 3 });
    }
  }
  fireAndSmoke(x, y, z, intensity = 1) {
    if (Math.random() < 0.7 * this.mul) this.fire.emit(x + rand(-0.6, 0.6), y + rand(0, 0.6), z + rand(-0.6, 0.6), rand(-0.3, 0.3), rand(1.5, 3), rand(-0.3, 0.3), rand(1, 2) * intensity, rand(0.3, 0.6), 1, 0.5, 0.15, 0.9, { grow: 0.6, drag: 1 });
    if (Math.random() < 0.6 * this.mul) this.smoke.emit(x + rand(-0.5, 0.5), y + 1, z + rand(-0.5, 0.5), rand(-0.2, 0.2), rand(2, 4), rand(-0.2, 0.2), rand(1.5, 2.5) * intensity, rand(3, 6), 0.1, 0.1, 0.1, 0.7, { grow: 1.35, drag: 0.4, fadeIn: 0.1 });
  }
  // Dauerhafte Brandquelle (z. B. Wrack)
  addEmitter(obj, offsetY = 1, duration = 30, intensity = 1) {
    this.emitters.push({ obj, offsetY, t: duration, intensity });
  }
  addCrater(x, z, r) {
    let m = this.craters[this.craterIdx];
    if (!m) { m = new THREE.Mesh(this.craterGeo, this.craterMat); m.renderOrder = 1; this.scene.add(m); this.craters.push(m); }
    this.craterIdx = (this.craterIdx + 1) % 60;
    m.position.set(x, this.terrain.surface(x, z) + 0.06, z);
    m.scale.setScalar(r);
    m.rotation.y = Math.random() * 6;
    m.visible = !this.terrain.isWater(x, z);
  }
  flash(x, y, z, intensity, dur) {
    let l = this.lights.find((l) => l.userData.t <= 0) || this.lights.reduce((a, b) => (a.userData.t < b.userData.t ? a : b));
    l.position.set(x, y, z);
    l.userData.t = dur; l.userData.dur = dur; l.userData.max = intensity;
    l.intensity = intensity;
  }
  tracer(from, to, color = 'y', speed = 300) {
    let m = this.tracerPool.pop();
    const mat = color === 'r' ? this.tracerMatR : color === 'g' ? this.tracerMatG : this.tracerMatY;
    if (!m) { m = new THREE.Mesh(this.tracerGeo, mat); this.scene.add(m); }
    m.material = mat;
    m.visible = true;
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    m.userData = { from: from.clone(), dir: dir.normalize(), len, d: 0, speed };
    m.scale.set(1, 1, Math.min(4, len * 0.3));
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
    for (let i = this.emitters.length - 1; i >= 0; i--) {
      const e = this.emitters[i];
      e.t -= dt;
      if (e.t <= 0) { this.emitters.splice(i, 1); continue; }
      const p = e.obj.position || e.obj;
      const k = Math.min(1, e.t / 6);
      if (Math.random() < k) this.fireAndSmoke(p.x, p.y + e.offsetY, p.z, e.intensity);
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const m = this.tracers[i], u = m.userData;
      u.d += u.speed * dt;
      if (u.d >= u.len) { m.visible = false; this.tracers.splice(i, 1); this.tracerPool.push(m); continue; }
      m.position.copy(u.from).addScaledVector(u.dir, u.d);
    }
    for (const l of this.lights) {
      if (l.userData.t > 0) { l.userData.t -= dt; l.intensity = Math.max(0, l.userData.max * (l.userData.t / l.userData.dur)); }
      else l.intensity = 0;
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
