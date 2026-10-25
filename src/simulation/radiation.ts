import * as THREE from 'three';
import {
  CORE_HEIGHT,
  DOSE_LIMIT,
  I0,
  MU_REGOLITH,
  SECTOR_COUNT,
  SHIELD_FACTOR,
  SHIELD_HALF_ANGLE,
  WORLD_SCALE,
} from './constants';
import {
  HABITAT_POS,
  RIM_RADIUS,
  SITING_RADIUS,
  angleDiff,
  azimuthDeg,
  buildTerrainGeometry,
  heightAt,
} from './terrain';

export interface RayResult {
  azimuth: number; // deg
  distance: number; // metres
  thickness: number; // metres of regolith intersected
  shieldDelta: number; // deg between ray and shield axis
  dose: number; // rem/yr
  target: { x: number; y: number; z: number };
}

export interface RadiationResult {
  sectors: RayResult[];
  habitat: RayResult & { secure: boolean };
  hazardSectors: number[]; // indices of the worst unshielded sector on each side of the shield axis
}

/** Hidden physics copy of the terrain (lower resolution, DoubleSide for entry/exit hits). */
let physicsMesh: THREE.Mesh | null = null;
function getPhysicsMesh(): THREE.Mesh {
  if (!physicsMesh) {
    physicsMesh = new THREE.Mesh(buildTerrainGeometry(64), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    physicsMesh.updateMatrixWorld(true);
  }
  return physicsMesh;
}

const raycaster = new THREE.Raycaster();
const origin = new THREE.Vector3();
const dir = new THREE.Vector3();
const target = new THREE.Vector3();

export function corePosition(rx: number, rz: number) {
  return { x: rx, y: heightAt(rx, rz) + CORE_HEIGHT, z: rz };
}

export const habitatTarget = () => ({ x: HABITAT_POS.x, y: heightAt(HABITAT_POS.x, HABITAT_POS.z) + 0.8, z: HABITAT_POS.z });

/** Regolith thickness (scene units) along the segment origin→target using paired entry/exit hits. */
export function regolithThickness(o: THREE.Vector3, t: THREE.Vector3): number {
  dir.subVectors(t, o);
  const far = dir.length();
  dir.normalize();
  raycaster.set(o, dir);
  raycaster.near = 0;
  raycaster.far = far;
  const hits = raycaster.intersectObject(getPhysicsMesh(), false);
  let thickness = 0;
  let inside = false;
  let entry = 0;
  for (const h of hits) {
    if (!inside) {
      entry = h.distance;
      inside = true;
    } else {
      thickness += h.distance - entry;
      inside = false;
    }
  }
  if (inside) thickness += far - entry;
  return thickness;
}

function evaluateRay(core: { x: number; y: number; z: number }, tgt: { x: number; y: number; z: number }, shieldAz: number): RayResult {
  origin.set(core.x, core.y, core.z);
  target.set(tgt.x, tgt.y, tgt.z);
  const thicknessUnits = regolithThickness(origin, target);
  const distance = origin.distanceTo(target) * WORLD_SCALE;
  const az = azimuthDeg(tgt.x - core.x, tgt.z - core.z);
  const shieldDelta = angleDiff(az, shieldAz);
  const s = shieldDelta <= SHIELD_HALF_ANGLE ? SHIELD_FACTOR : 1;
  const thickness = thicknessUnits * WORLD_SCALE;
  const dose = ((I0 * s) / (distance * distance)) * Math.exp(-MU_REGOLITH * thickness);
  return { azimuth: az, distance, thickness, shieldDelta, dose, target: { ...tgt } };
}

/** Habitat dose only (used by the siting optimizer). */
export function habitatDose(rx: number, rz: number, shieldAz: number): number {
  return evaluateRay(corePosition(rx, rz), habitatTarget(), shieldAz).dose;
}

export function computeRadiation(rx: number, rz: number, shieldAz: number): RadiationResult {
  const core = corePosition(rx, rz);
  const sectors: RayResult[] = [];
  for (let i = 0; i < SECTOR_COUNT; i++) {
    const az = (i * 360) / SECTOR_COUNT + 360 / SECTOR_COUNT / 2;
    const a = (az * Math.PI) / 180;
    // Aim at the rim crest seen from the crater centre (crater-wall hazard).
    const tx = Math.sin(a) * RIM_RADIUS;
    const tz = -Math.cos(a) * RIM_RADIUS;
    sectors.push(evaluateRay(core, { x: tx, y: heightAt(tx, tz) + 0.4, z: tz }, shieldAz));
  }
  const hab = evaluateRay(core, habitatTarget(), shieldAz);

  // Worst unshielded lateral sector (60°–130° off the shield axis) on each side, skipping the habitat bearing.
  const side = (s: RayResult) => (((s.azimuth - shieldAz + 360) % 360) < 180 ? 0 : 1);
  const best: [number, number] = [-1, -1];
  sectors.forEach((s, i) => {
    if (s.dose <= DOSE_LIMIT || angleDiff(s.azimuth, hab.azimuth) < 30 || s.shieldDelta < 60 || s.shieldDelta > 130) return;
    const k = side(s);
    if (best[k] < 0 || s.dose > sectors[best[k]].dose) best[k] = i;
  });
  return {
    sectors,
    habitat: { ...hab, secure: hab.dose < DOSE_LIMIT },
    hazardSectors: best.filter((i) => i >= 0),
  };
}

/**
 * Auto-optimize siting: grid search over the crater floor with the shield
 * aimed at the habitat (analytically optimal), minimising habitat dose plus
 * a small cable-length penalty.
 */
export function optimizeSiting(): { x: number; z: number; shieldAz: number; dose: number } {
  let best = { x: 0, z: 0, shieldAz: 0, dose: Infinity, score: Infinity };
  const step = 1.5;
  for (let x = -SITING_RADIUS; x <= SITING_RADIUS; x += step) {
    for (let z = -SITING_RADIUS; z <= SITING_RADIUS; z += step) {
      if (Math.hypot(x, z) > SITING_RADIUS - 0.5) continue;
      const shieldAz = azimuthDeg(HABITAT_POS.x - x, HABITAT_POS.z - z);
      const dose = habitatDose(x, z, shieldAz);
      const cableM = Math.hypot(HABITAT_POS.x - x, HABITAT_POS.z - z) * WORLD_SCALE;
      const score = dose + cableM * 0.004;
      if (score < best.score) best = { x, z, shieldAz, dose, score };
    }
  }
  return { x: best.x, z: best.z, shieldAz: best.shieldAz, dose: best.dose };
}
