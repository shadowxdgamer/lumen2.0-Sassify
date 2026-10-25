import * as THREE from 'three';
import { NET_DEFLECTION } from '../simulation/constants';
import { NET_RADIUS } from './builders';
import { softDotTexture } from './textures';

// Charged lunar dust particles + electric arcs where they strike the
// electrostatic mesh net (85 % deflected, 15 % leak through).

const MAX_DUST = 900;
const MAX_ARCS = 48;
const ARC_NODES = 7; // → 6 segments
const HIDDEN = -1e4;

export class DustSystem {
  readonly points: THREE.Points;
  readonly arcs: THREE.LineSegments;
  readonly flashes: THREE.Points;
  private pos = new Float32Array(MAX_DUST * 3);
  private vel = new Float32Array(MAX_DUST * 3);
  private age = new Float32Array(MAX_DUST);
  private alive = new Uint8Array(MAX_DUST);
  private arcPos = new Float32Array(MAX_ARCS * (ARC_NODES - 1) * 2 * 3);
  private arcCol = new Float32Array(MAX_ARCS * (ARC_NODES - 1) * 2 * 3);
  private arcState = Array.from({ length: MAX_ARCS }, () => ({ life: 0, p: new THREE.Vector3(), t: new THREE.Vector3() }));
  private flashPos = new Float32Array(MAX_ARCS * 3);
  private flashCol = new Float32Array(MAX_ARCS * 3);
  private spawnAcc = 0;
  private nextArc = 0;
  private rng = 12345;

  constructor() {
    this.pos.fill(HIDDEN);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.points = new THREE.Points(
      g,
      new THREE.PointsMaterial({ color: 0xd9d3c4, size: 0.32, map: softDotTexture(), transparent: true, opacity: 0.9, depthWrite: false }),
    );
    this.points.frustumCulled = false;

    const ag = new THREE.BufferGeometry();
    ag.setAttribute('position', new THREE.BufferAttribute(this.arcPos, 3));
    ag.setAttribute('color', new THREE.BufferAttribute(this.arcCol, 3));
    this.arcs = new THREE.LineSegments(
      ag,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    );
    this.arcs.frustumCulled = false;

    const fg = new THREE.BufferGeometry();
    this.flashPos.fill(HIDDEN);
    fg.setAttribute('position', new THREE.BufferAttribute(this.flashPos, 3));
    fg.setAttribute('color', new THREE.BufferAttribute(this.flashCol, 3));
    this.flashes = new THREE.Points(
      fg,
      new THREE.PointsMaterial({
        size: 2.4,
        map: softDotTexture(),
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.flashes.frustumCulled = false;
  }

  private rand() {
    this.rng = (this.rng * 16807) % 2147483647;
    return this.rng / 2147483647;
  }

  private spawn(center: THREE.Vector3, plume: boolean) {
    for (let i = 0; i < MAX_DUST; i++) {
      if (this.alive[i]) continue;
      // Plume ejecta arrives from the landing pad (WSW, az ≈ 235°); background dust from anywhere.
      const az = plume ? ((235 + (this.rand() - 0.5) * 50) * Math.PI) / 180 : this.rand() * Math.PI * 2;
      const r = plume ? 30 + this.rand() * 6 : 20 + this.rand() * 9;
      const x = center.x + Math.sin(az) * r;
      const z = center.z - Math.cos(az) * r;
      const y = center.y + 0.5 + this.rand() * (plume ? 7 : 11);
      const speed = plume ? 12 + this.rand() * 8 : 4 + this.rand() * 4;
      const tx = center.x + (this.rand() - 0.5) * 8 - x;
      const ty = center.y + 2 + (this.rand() - 0.5) * 3 - y;
      const tz = center.z + (this.rand() - 0.5) * 8 - z;
      const len = Math.hypot(tx, ty, tz);
      this.pos.set([x, y, z], i * 3);
      this.vel.set([(tx / len) * speed, (ty / len) * speed, (tz / len) * speed], i * 3);
      this.age[i] = 0;
      this.alive[i] = 1;
      return;
    }
  }

  private spawnArc(p: THREE.Vector3, center: THREE.Vector3) {
    const a = this.arcState[this.nextArc];
    this.nextArc = (this.nextArc + 1) % MAX_ARCS;
    a.life = 1;
    a.p.copy(p);
    const n = p.clone().sub(center).normalize();
    a.t.set(this.rand() - 0.5, this.rand() - 0.5, this.rand() - 0.5).cross(n).normalize();
  }

  /**
   * @param deflecting whether the net is up and powered (deflects 85 % of strikes)
   * @param plume whether lander ejecta is inbound
   */
  update(dt: number, center: THREE.Vector3, deflecting: boolean, plume: boolean) {
    const rate = plume ? 420 : 55;
    this.spawnAcc += rate * dt;
    while (this.spawnAcc >= 1) {
      this.spawn(center, plume);
      this.spawnAcc -= 1;
    }
    const tmp = new THREE.Vector3();
    for (let i = 0; i < MAX_DUST; i++) {
      if (!this.alive[i]) continue;
      const o = i * 3;
      const px = this.pos[o];
      const py = this.pos[o + 1];
      const pz = this.pos[o + 2];
      const d0 = Math.hypot(px - center.x, py - center.y, pz - center.z);
      this.vel[o + 1] -= 0.16 * dt; // lunar gravity (scene units)
      const nx = px + this.vel[o] * dt;
      const ny = py + this.vel[o + 1] * dt;
      const nz = pz + this.vel[o + 2] * dt;
      const d1 = Math.hypot(nx - center.x, ny - center.y, nz - center.z);
      this.age[i] += dt;
      if (deflecting && d0 >= NET_RADIUS && d1 < NET_RADIUS && ny > center.y && this.rand() < NET_DEFLECTION) {
        // Reflect off the charged mesh and spark.
        tmp.set(nx - center.x, ny - center.y, nz - center.z).normalize();
        const vn = this.vel[o] * tmp.x + this.vel[o + 1] * tmp.y + this.vel[o + 2] * tmp.z;
        this.vel[o] = (this.vel[o] - 2 * vn * tmp.x) * 0.55;
        this.vel[o + 1] = (this.vel[o + 1] - 2 * vn * tmp.y) * 0.55;
        this.vel[o + 2] = (this.vel[o + 2] - 2 * vn * tmp.z) * 0.55;
        const hit = tmp.clone().multiplyScalar(NET_RADIUS + 0.05).add(center);
        this.pos.set([hit.x, hit.y, hit.z], o);
        if (this.rand() < 0.5) this.spawnArc(hit, center);
        continue;
      }
      this.pos[o] = nx;
      this.pos[o + 1] = ny;
      this.pos[o + 2] = nz;
      if (d1 < 2.2 || ny < center.y - 3 || this.age[i] > 7 || d1 > 48) {
        this.alive[i] = 0;
        this.pos[o + 1] = HIDDEN;
      }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.updateArcs(dt, center);
  }

  private updateArcs(dt: number, center: THREE.Vector3) {
    const node = new THREE.Vector3();
    const prev = new THREE.Vector3();
    const segs = ARC_NODES - 1;
    for (let a = 0; a < MAX_ARCS; a++) {
      const s = this.arcState[a];
      const base = a * segs * 2 * 3;
      if (s.life <= 0) {
        for (let k = 0; k < segs * 6; k++) this.arcCol[base + k] = 0;
        this.flashCol.fill(0, a * 3, a * 3 + 3);
        continue;
      }
      s.life -= dt * 3.2;
      const bright = Math.max(0, s.life);
      prev.copy(s.p);
      for (let k = 1; k < ARC_NODES; k++) {
        // Crawl along the dome surface with jitter (re-randomised each frame = flicker).
        node
          .copy(s.t)
          .multiplyScalar(k * 0.55)
          .add(s.p)
          .add(new THREE.Vector3(this.rand() - 0.5, this.rand() - 0.5, this.rand() - 0.5).multiplyScalar(0.55));
        node.sub(center).setLength(NET_RADIUS + 0.05).add(center);
        const o = base + (k - 1) * 6;
        this.arcPos.set([prev.x, prev.y, prev.z, node.x, node.y, node.z], o);
        const c = [0.55 * bright, 1.0 * bright, 1.0 * bright];
        this.arcCol.set([...c, ...c], o);
        prev.copy(node);
      }
      this.flashPos.set([s.p.x, s.p.y, s.p.z], a * 3);
      this.flashCol.set([0.5 * bright, 0.95 * bright, 1.0 * bright], a * 3);
    }
    this.arcs.geometry.attributes.position.needsUpdate = true;
    this.arcs.geometry.attributes.color.needsUpdate = true;
    this.flashes.geometry.attributes.position.needsUpdate = true;
    this.flashes.geometry.attributes.color.needsUpdate = true;
  }
}
