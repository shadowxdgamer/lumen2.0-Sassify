import * as THREE from 'three';
import { CORE_HEIGHT, SHIELD_HALF_ANGLE } from '../simulation/constants';
import { wingAzimuth } from '../vision/thermalRenderer';
import { coreSlotTexture, wingGridTexture } from './textures';

// Procedural meshes for the reactor, radiators, habitat and electrostatic net.

export const WING_ROOT = 1.6;
export const WING_LENGTH = 7.2;
export const WING_SEGMENTS = 4;
export const NET_RADIUS = 16;

/** Top hemisphere of an icosphere with a flat base (y ≥ 0). */
export function hemisphere(radius: number, detail: number): THREE.BufferGeometry {
  const ico = new THREE.IcosahedronGeometry(radius, detail);
  const src = ico.attributes.position.array as Float32Array;
  const out: number[] = [];
  for (let i = 0; i < src.length; i += 9) {
    const cy = (src[i + 1] + src[i + 4] + src[i + 7]) / 3;
    if (cy <= 0) continue;
    for (let k = 0; k < 9; k += 3) out.push(src[i + k], Math.max(0, src[i + k + 1]), src[i + k + 2]);
  }
  ico.dispose();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  geo.computeVertexNormals();
  return geo;
}

const metal = (color: number, roughness = 0.35, metalness = 0.85) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

export interface ReactorParts {
  group: THREE.Group;
  coreMat: THREE.MeshStandardMaterial;
  shield: THREE.Group;
  coreLight: THREE.PointLight;
  pickables: THREE.Object3D[];
}

export function buildReactor(): ReactorParts {
  const group = new THREE.Group();
  const pickables: THREE.Object3D[] = [];
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, y: number) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.y = y;
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    pickables.push(m);
    return m;
  };

  const dark = metal(0x3a4048, 0.55, 0.7);
  const steel = metal(0x9aa3ad, 0.3, 0.9);
  const brushed = metal(0x6f7882, 0.4, 0.85);

  add(new THREE.CylinderGeometry(1.7, 2.0, 0.5, 32), dark, 0.25); // landing skid
  add(new THREE.CylinderGeometry(1.15, 1.3, 1.35, 32), brushed, 1.17); // lower vessel tier
  for (let i = 0; i < 3; i++) add(new THREE.TorusGeometry(1.22, 0.05, 8, 40).rotateX(Math.PI / 2), steel, 0.75 + i * 0.4);

  // Glowing core ring slots (emissive scales with core temperature).
  const slots = coreSlotTexture();
  slots.repeat.set(2, 1);
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x1a1410,
    emissive: 0xff6600,
    emissiveMap: slots,
    emissiveIntensity: 0.4,
    roughness: 0.6,
    metalness: 0.4,
  });
  add(new THREE.CylinderGeometry(1.18, 1.18, 0.7, 48, 1, true), coreMat, CORE_HEIGHT);
  add(new THREE.CylinderGeometry(1.0, 1.18, 0.95, 32), steel, CORE_HEIGHT + 0.82); // upper tier
  add(new THREE.CylinderGeometry(0.55, 0.75, 1.5, 24), brushed, CORE_HEIGHT + 2.05); // Stirling tower
  for (let i = 0; i < 8; i++) {
    // Stirling converter heads around the tower.
    const a = (i / 8) * Math.PI * 2;
    const head = add(new THREE.CylinderGeometry(0.16, 0.16, 0.9, 12), dark, CORE_HEIGHT + 1.9);
    head.position.x = Math.cos(a) * 0.82;
    head.position.z = Math.sin(a) * 0.82;
  }
  add(new THREE.CylinderGeometry(1.35, 1.05, 0.36, 40), metal(0x2b2f36, 0.7, 0.5), CORE_HEIGHT + 2.98); // axial shadow-shield cap

  // Structural struts (skid → upper tier).
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 8), steel);
    strut.position.set(Math.cos(a) * 1.55, 1.45, Math.sin(a) * 1.55);
    strut.rotation.z = Math.cos(a) * 0.22;
    strut.rotation.x = -Math.sin(a) * 0.22;
    strut.castShadow = true;
    group.add(strut);
  }

  // Directional B4C shadow shield (rotates with θ_shield). Centred on az 0 (−Z).
  const shield = new THREE.Group();
  const half = (SHIELD_HALF_ANGLE * Math.PI) / 180;
  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(1.55, 1.55, 2.0, 24, 1, true, Math.PI - half, 2 * half),
    new THREE.MeshStandardMaterial({ color: 0x23272e, roughness: 0.8, metalness: 0.3, side: THREE.DoubleSide }),
  );
  plate.position.y = CORE_HEIGHT + 0.2;
  plate.castShadow = true;
  shield.add(plate);
  const trim = new THREE.Mesh(
    new THREE.CylinderGeometry(1.58, 1.58, 0.12, 24, 1, true, Math.PI - half, 2 * half),
    new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide }),
  );
  trim.position.y = CORE_HEIGHT + 1.15;
  shield.add(trim);
  group.add(shield);
  pickables.push(plate);

  const coreLight = new THREE.PointLight(0xff7a2a, 4, 16, 1.6);
  coreLight.position.y = CORE_HEIGHT;
  group.add(coreLight);

  return { group, coreMat, shield, coreLight, pickables };
}

export interface WingParts {
  pivot: THREE.Group;
  mat: THREE.MeshStandardMaterial;
  frame: THREE.LineBasicMaterial;
}

export function buildWings(parent: THREE.Group): WingParts[] {
  const grid = wingGridTexture();
  const wings: WingParts[] = [];
  const segLen = WING_LENGTH / WING_SEGMENTS;
  for (let i = 0; i < 4; i++) {
    const pivot = new THREE.Group();
    pivot.position.y = CORE_HEIGHT;
    pivot.rotation.y = (-wingAzimuth(i) * Math.PI) / 180;
    const mat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      map: grid,
      emissive: 0x000000,
      emissiveMap: grid,
      roughness: 0.42,
      metalness: 0.55,
      side: THREE.DoubleSide,
    });
    const frame = new THREE.LineBasicMaterial({ color: 0x7c8ea3, transparent: true, opacity: 0.7 });
    const boom = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, WING_ROOT), metal(0x8b949e));
    boom.position.z = -WING_ROOT / 2;
    pivot.add(boom);
    const panelGeo = new THREE.BoxGeometry(2.3, 0.07, segLen - 0.08);
    const edges = new THREE.EdgesGeometry(panelGeo);
    for (let s = 0; s < WING_SEGMENTS; s++) {
      const panel = new THREE.Mesh(panelGeo, mat);
      panel.position.z = -(WING_ROOT + segLen * (s + 0.5));
      panel.castShadow = true;
      panel.receiveShadow = true;
      panel.add(new THREE.LineSegments(edges, frame));
      pivot.add(panel);
    }
    // NaK manifold header along the root.
    const header = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.3, 10).rotateZ(Math.PI / 2), metal(0xb0b8c0));
    header.position.z = -WING_ROOT;
    pivot.add(header);
    parent.add(pivot);
    wings.push({ pivot, mat, frame });
  }
  return wings;
}

export function buildHabitat(): THREE.Group {
  const g = new THREE.Group();
  const geo = hemisphere(3.8, 2);
  const glass = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      color: 0x9fb8cc,
      transparent: true,
      opacity: 0.28,
      roughness: 0.12,
      metalness: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  glass.position.y = 0.35;
  g.add(glass);
  const cage = new THREE.LineSegments(new THREE.WireframeGeometry(geo), new THREE.LineBasicMaterial({ color: 0xdfe7ef }));
  cage.position.y = 0.35;
  g.add(cage);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(3.95, 4.2, 0.5, 40), metal(0x7a838d, 0.5, 0.8));
  ring.position.y = 0.2;
  ring.receiveShadow = true;
  ring.castShadow = true;
  g.add(ring);
  const tunnel = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.1, 2.4), metal(0x8a939c, 0.5, 0.8));
  tunnel.position.set(-3.4, 0.6, 2.6);
  tunnel.rotation.y = -0.7;
  g.add(tunnel);
  const light = new THREE.PointLight(0x9fd8ff, 6, 9, 1.5);
  light.position.y = 1.4;
  g.add(light);
  return g;
}

export interface NetParts {
  group: THREE.Group;
  wireMat: THREE.MeshBasicMaterial;
  shellMat: THREE.MeshBasicMaterial;
  ringMat: THREE.MeshBasicMaterial;
}

export function buildNet(): NetParts {
  const group = new THREE.Group();
  const geo = hemisphere(NET_RADIUS, 3);
  const wireMat = new THREE.MeshBasicMaterial({
    color: 0x00ffff,
    wireframe: true,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const shellMat = new THREE.MeshBasicMaterial({
    color: 0x00c8ff,
    transparent: true,
    opacity: 0.05,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  group.add(new THREE.Mesh(geo, wireMat));
  group.add(new THREE.Mesh(geo, shellMat));
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x22e6ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(NET_RADIUS, 0.12, 8, 96).rotateX(Math.PI / 2), ringMat);
  group.add(ring);
  group.visible = false;
  return { group, wireMat, shellMat, ringMat };
}

/** Unit cone with apex at the origin opening along +Z to z = 1. */
export function unitCone(): THREE.BufferGeometry {
  const g = new THREE.ConeGeometry(1, 1, 32, 1, true);
  g.translate(0, -0.5, 0);
  g.rotateX(-Math.PI / 2);
  return g;
}

export function coneMaterial(color: number) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.2,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
}

/** Thin flat ring of 36 dose sectors in reactor-local coordinates. */
export function buildDoseRing(sectors: number, inner: number, outer: number): THREE.Mesh {
  const pos: number[] = [];
  const col: number[] = [];
  const gap = 0.03;
  for (let i = 0; i < sectors; i++) {
    const a0 = (i / sectors) * Math.PI * 2 + gap;
    const a1 = ((i + 1) / sectors) * Math.PI * 2 - gap;
    // azimuth a → (sin a, −cos a)
    const p = (r: number, a: number) => [Math.sin(a) * r, 0, -Math.cos(a) * r];
    const v = [p(inner, a0), p(outer, a0), p(outer, a1), p(inner, a1)];
    for (const idx of [0, 1, 2, 0, 2, 3]) {
      pos.push(...v[idx]);
      col.push(0, 1, 0.5);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
}
