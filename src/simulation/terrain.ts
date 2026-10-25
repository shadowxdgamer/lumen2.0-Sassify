import * as THREE from 'three';

// Deterministic lunar crater heightfield shared by the renderer and the
// radiation raycaster, so what you see is exactly what shields the crew.

export const TERRAIN_SIZE = 80;
export const FLOOR_RADIUS = 12;
export const RIM_RADIUS = 22;
export const SHELF_RADIUS = 30;
const FLOOR_Y = -4;
const RIM_Y = 3;
const SHELF_Y = 1.2;

/** Max reactor distance from crater centre (stays on the flat floor). */
export const SITING_RADIUS = 10.5;

/** Habitat sits just outside the NE rim crest. */
export const HABITAT_POS = { x: 17.3, z: -17.3 };

function hash2(ix: number, iz: number, seed: number): number {
  let h = (ix * 374761393 + iz * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

export function valueNoise(x: number, z: number, seed = 7): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = smooth(x - ix);
  const fz = smooth(z - iz);
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

export function fbm(x: number, z: number, octaves = 4, seed = 7): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let o = 0; o < octaves; o++) {
    sum += amp * (valueNoise(x * freq, z * freq, seed + o * 31) - 0.5);
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum;
}

function craterProfile(r: number): number {
  if (r < FLOOR_RADIUS) return FLOOR_Y + 0.25 * (r / FLOOR_RADIUS) ** 2;
  if (r < RIM_RADIUS) {
    const t = (r - FLOOR_RADIUS) / (RIM_RADIUS - FLOOR_RADIUS);
    return FLOOR_Y + 0.25 + (RIM_Y - FLOOR_Y - 0.25) * Math.pow(smooth(t), 1.25);
  }
  const t = Math.min(1, (r - RIM_RADIUS) / (SHELF_RADIUS - RIM_RADIUS));
  return RIM_Y + (SHELF_Y - RIM_Y) * smooth(t);
}

/** Ground elevation at (x, z) in scene units. */
export function heightAt(x: number, z: number): number {
  const r = Math.hypot(x, z);
  // Small secondary craterlets for visual realism (deterministic).
  let bowl = 0;
  for (const [cx, cz, cr] of CRATERLETS) {
    const d = Math.hypot(x - cx, z - cz) / cr;
    if (d < 1.3) bowl += d < 1 ? -0.6 * (1 - d * d) : 0.35 * (1 - (d - 1) / 0.3);
  }
  const roughness = r < FLOOR_RADIUS ? 0.25 : 0.9;
  return craterProfile(r) + roughness * fbm(x * 0.18, z * 0.18, 5) + bowl;
}

const CRATERLETS: ReadonlyArray<readonly [number, number, number]> = [
  [-26, 22, 3.2],
  [28, 20, 2.4],
  [-30, -26, 4],
  [4, 33, 2.2],
  [-8, -31, 2.6],
];

/** Builds a terrain geometry in the XZ plane with heights from heightAt. */
export function buildTerrainGeometry(segments: number): THREE.PlaneGeometry {
  const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/** Azimuth in degrees, 0 = north (−Z), clockwise toward east (+X). */
export function azimuthDeg(dx: number, dz: number): number {
  const a = (Math.atan2(dx, -dz) * 180) / Math.PI;
  return (a + 360) % 360;
}

export function azimuthToDir(azDeg: number): { x: number; z: number } {
  const a = (azDeg * Math.PI) / 180;
  return { x: Math.sin(a), z: -Math.cos(a) };
}

export function angleDiff(a: number, b: number): number {
  const d = (((a - b) % 360) + 540) % 360 - 180;
  return Math.abs(d);
}
