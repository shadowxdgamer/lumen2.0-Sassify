import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { CORE_HEIGHT, DOSE_LIMIT, SECTOR_COUNT } from '../simulation/constants';
import type { SimSnapshot } from '../simulation/physicsEngine';
import { habitatTarget } from '../simulation/radiation';
import { command, getSnapshot, getView, type ViewState } from '../simulation/store';
import { HABITAT_POS, azimuthDeg, buildTerrainGeometry, heightAt } from '../simulation/terrain';
import {
  NET_RADIUS,
  WING_LENGTH,
  WING_ROOT,
  buildDoseRing,
  buildHabitat,
  buildNet,
  buildReactor,
  buildWings,
  coneMaterial,
  unitCone,
  type NetParts,
  type ReactorParts,
  type WingParts,
} from './builders';
import { DustSystem } from './dust';
import { regolithTexture } from './textures';
import { wingAzimuth } from '../vision/thermalRenderer';

export interface HudState {
  azimuth: number; // camera heading, deg (0 = looking north)
  axes: { x: [number, number]; y: [number, number]; z: [number, number] };
  fps: number;
}

const SLATE = new THREE.Color(0x1e293b);
const HOT_A = new THREE.Color(0xff5500);
const HOT_B = new THREE.Color(0xffcc00);
const GREEN = new THREE.Color(0x22ff77);
const RED = new THREE.Color(0xff2b2b);

const PRESETS: Record<ViewState['cameraPreset'], { pos: [number, number, number]; target: [number, number, number] }> = {
  orbit: { pos: [-5, 19, 35], target: [2, -2.5, -5] },
  top: { pos: [0, 68, 0.1], target: [0, -3, 0] },
  habitat: { pos: [2, 12, 2], target: [17, 2, -17] },
  reactor: { pos: [-11, 9, 14], target: [0, -1.5, 0] },
};

function label(cls: string): { obj: CSS2DObject; el: HTMLDivElement } {
  const el = document.createElement('div');
  el.className = `hud-label ${cls}`;
  const obj = new CSS2DObject(el);
  obj.center.set(0, 1);
  return { obj, el };
}

export class SceneController {
  private renderer: THREE.WebGLRenderer;
  private labels: CSS2DRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private raf = 0;
  private clock = new THREE.Clock();
  private resizeObs: ResizeObserver;
  private terrain: THREE.Mesh;
  private reactor: ReactorParts;
  private wings: WingParts[];
  private wingLight: THREE.PointLight;
  private net: NetParts;
  private netLevel = 0;
  private dust = new DustSystem();
  private habCone: THREE.Mesh;
  private hazCones: THREE.Mesh[];
  private tracking: THREE.Line;
  private doseRing: THREE.Mesh;
  private selectRing: THREE.Group;
  private lbl: Record<'dust' | 'wings' | 'hazard' | 'habitat' | 'tracking' | 'net', { obj: CSS2DObject; el: HTMLDivElement }>;
  private lastTick = -1;
  private pos = new THREE.Vector3();
  private targetPos = new THREE.Vector3();
  private dragging: 'move' | 'rotate' | null = null;
  private pendingDrag: THREE.Vector3 | null = null;
  private ray = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private camAnim: { from: THREE.Vector3; to: THREE.Vector3; tFrom: THREE.Vector3; tTo: THREE.Vector3; t: number } | null = null;
  private lastPresetNonce = -1;
  private frames = 0;
  private fpsTime = 0;
  private fps = 60;
  private hudCb: (h: HudState) => void;
  private startTime = performance.now();

  constructor(private container: HTMLElement, hudCb: (h: HudState) => void) {
    this.hudCb = hudCb;
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 600;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setSize(w, h);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.labels = new CSS2DRenderer();
    this.labels.setSize(w, h);
    this.labels.domElement.className = 'hud-label-layer';
    container.appendChild(this.labels.domElement);

    this.camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 600);
    this.camera.position.set(...PRESETS.orbit.pos);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(...PRESETS.orbit.target);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = 1.38;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 95;

    this.scene.background = new THREE.Color(0x020409);
    this.scene.fog = new THREE.FogExp2(0x03060b, 0.0065);

    // --- lighting: low grazing sun from the west, faint earthshine fill ---
    this.scene.add(new THREE.AmbientLight(0x6a7a8c, 0.55));
    this.scene.add(new THREE.HemisphereLight(0x9fb2c8, 0x0b0d10, 0.35));
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.8);
    sun.position.set(-46, 15, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -45;
    sc.right = 45;
    sc.top = 45;
    sc.bottom = -45;
    sc.far = 140;
    sun.shadow.bias = -0.0006;
    this.scene.add(sun);

    this.scene.add(this.buildStars());

    // --- terrain (same heightfield as the radiation raycaster) ---
    const tex = regolithTexture();
    this.terrain = new THREE.Mesh(
      buildTerrainGeometry(128),
      new THREE.MeshStandardMaterial({ color: 0x8c8c8c, map: tex, bumpMap: tex, bumpScale: 0.9, roughness: 0.92, metalness: 0.08 }),
    );
    this.terrain.receiveShadow = true;
    this.scene.add(this.terrain);

    // --- reactor + wings ---
    this.reactor = buildReactor();
    this.wings = buildWings(this.reactor.group);
    this.scene.add(this.reactor.group);
    this.wingLight = new THREE.PointLight(0xff6a1a, 0, 14, 1.4);
    this.reactor.group.add(this.wingLight);
    const w0 = (wingAzimuth(0) * Math.PI) / 180;
    this.wingLight.position.set(Math.sin(w0) * 5.2, CORE_HEIGHT + 1.2, -Math.cos(w0) * 5.2);

    this.selectRing = new THREE.Group();
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    this.selectRing.add(new THREE.Mesh(new THREE.RingGeometry(2.3, 2.45, 64).rotateX(-Math.PI / 2), ringMat));
    const dashed = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(Array.from({ length: 96 }, (_, i) => new THREE.Vector3(Math.cos((i / 96) * Math.PI * 2) * 5.6, 0, Math.sin((i / 96) * Math.PI * 2) * 5.6))),
      new THREE.LineDashedMaterial({ color: 0x38e1ff, dashSize: 0.5, gapSize: 0.35, transparent: true, opacity: 0.8 }),
    );
    dashed.computeLineDistances();
    this.selectRing.add(dashed);
    this.selectRing.position.y = 0.12;
    this.reactor.group.add(this.selectRing);

    this.doseRing = buildDoseRing(SECTOR_COUNT, 6.2, 6.9);
    this.doseRing.position.y = 0.15;
    this.reactor.group.add(this.doseRing);

    // --- habitat ---
    const hab = buildHabitat();
    hab.position.set(HABITAT_POS.x, heightAt(HABITAT_POS.x, HABITAT_POS.z) - 0.25, HABITAT_POS.z);
    this.scene.add(hab);

    // --- electrostatic net + dust ---
    this.net = buildNet();
    this.scene.add(this.net.group);
    this.scene.add(this.dust.points, this.dust.arcs, this.dust.flashes);

    // --- radiation cones + tracking line ---
    const cone = unitCone();
    this.habCone = new THREE.Mesh(cone, coneMaterial(0x22ff77));
    this.hazCones = [new THREE.Mesh(cone, coneMaterial(0xff2b2b)), new THREE.Mesh(cone, coneMaterial(0xff2b2b))];
    this.scene.add(this.habCone, ...this.hazCones);
    this.tracking = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(1, 1, 1)]),
      new THREE.LineDashedMaterial({ color: 0x67e8f9, dashSize: 0.7, gapSize: 0.45, transparent: true, opacity: 0.95, toneMapped: false }),
    );
    this.scene.add(this.tracking);

    // --- floating HUD callouts ---
    this.lbl = {
      dust: label('hud-red'),
      wings: label('hud-cyan'),
      hazard: label('hud-red'),
      habitat: label('hud-cyan'),
      tracking: label('hud-track'),
      net: label('hud-cyan hud-small'),
    };
    for (const l of Object.values(this.lbl)) this.scene.add(l.obj);
    this.lbl.habitat.obj.center.set(1, 1); // grows leftward, away from the panel edge

    const s = getSnapshot();
    this.pos.set(s.reactor.x, heightAt(s.reactor.x, s.reactor.z), s.reactor.z);
    this.reactor.group.position.copy(this.pos);
    // Wings unfold on load.
    this.wings.forEach((w) => w.pivot.scale.set(1, 1, 0.02));

    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);
    this.loop();
  }

  private buildStars(): THREE.Points {
    const n = 1800;
    const p = new Float32Array(n * 3);
    let seed = 99;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < n; i++) {
      const th = r() * Math.PI * 2;
      const ph = Math.acos(r() * 0.95);
      const R = 260;
      p.set([R * Math.sin(ph) * Math.cos(th), R * Math.cos(ph) - 10, R * Math.sin(ph) * Math.sin(th)], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.7, sizeAttenuation: true, fog: false, transparent: true, opacity: 0.85 }));
  }

  private resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.labels.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------ interaction
  private setNdc(e: PointerEvent) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
  }

  private onDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    this.setNdc(e);
    if (this.ray.intersectObjects(this.reactor.pickables, false).length) {
      this.dragging = e.shiftKey ? 'rotate' : 'move';
      this.controls.enabled = false;
      this.renderer.domElement.style.cursor = 'grabbing';
    }
  };

  private onMove = (e: PointerEvent) => {
    this.setNdc(e);
    if (!this.dragging) {
      const over = this.ray.intersectObjects(this.reactor.pickables, false).length > 0;
      this.renderer.domElement.style.cursor = over ? 'grab' : '';
      return;
    }
    const hit = this.ray.intersectObject(this.terrain, false)[0];
    if (hit) this.pendingDrag = hit.point.clone();
  };

  private onUp = () => {
    if (!this.dragging) return;
    const mode = this.dragging;
    this.dragging = null;
    this.controls.enabled = true;
    this.renderer.domElement.style.cursor = '';
    const s = getSnapshot();
    command((eng) =>
      eng.log(
        'info',
        mode === 'move'
          ? `REACTOR RELOCATED to (${(s.reactor.x * 10).toFixed(0)} m E, ${(-s.reactor.z * 10).toFixed(0)} m N) — raycast siting re-evaluated`
          : `B4C SHIELD ROTATED to ${s.shieldAz.toFixed(0)}°`,
      ),
    );
  };

  // ------------------------------------------------------------ frame loop
  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    const s = getSnapshot();
    const view = getView();

    if (this.pendingDrag) {
      const p = this.pendingDrag;
      this.pendingDrag = null;
      if (this.dragging === 'move') command((e) => e.setReactorPose(p.x, p.z));
      else if (this.dragging === 'rotate') command((e) => e.setShield(azimuthDeg(p.x - s.reactor.x, p.z - s.reactor.z)));
    }

    this.applyPreset(view, s);
    this.animateCamera(dt);

    // Reactor pose (smoothed).
    this.targetPos.set(s.reactor.x, heightAt(s.reactor.x, s.reactor.z), s.reactor.z);
    this.pos.lerp(this.targetPos, Math.min(1, dt * 10));
    this.reactor.group.position.copy(this.pos);
    this.reactor.shield.rotation.y = (-s.shieldAz * Math.PI) / 180;

    // Wing unfold animation.
    const tUnfold = (performance.now() - this.startTime) / 1000;
    this.wings.forEach((w, i) => {
      const k = THREE.MathUtils.clamp((tUnfold - 0.3 - i * 0.25) / 1.6, 0.02, 1);
      w.pivot.scale.z = 1 - Math.pow(1 - k, 3);
    });

    // Thermal visuals.
    const time = performance.now() / 1000;
    const coreGlow = THREE.MathUtils.clamp((s.coreTemp - 330) / 590, 0.05, 1);
    this.reactor.coreMat.emissiveIntensity = 0.35 + coreGlow * 3.2 * (0.92 + 0.08 * Math.sin(time * 6));
    this.reactor.coreLight.intensity = 3 + coreGlow * 30;
    this.wings.forEach((w, i) => {
      const t = THREE.MathUtils.clamp((s.wingTemps[i] - 430) / (890 - 430), 0, 1);
      const hot = t < 0.5 ? SLATE.clone().lerp(HOT_A, t * 2) : HOT_A.clone().lerp(HOT_B, (t - 0.5) * 2);
      w.mat.color.copy(SLATE).lerp(new THREE.Color(0x5a2a10), t);
      w.mat.emissive.copy(hot);
      w.mat.emissiveIntensity = t * 2.4;
      w.frame.color.set(t > 0.3 ? 0xffb070 : 0x7c8ea3);
    });
    const w0 = THREE.MathUtils.clamp((s.wingTemps[0] - 430) / 460, 0, 1);
    this.wingLight.intensity = w0 * 60;

    // Electrostatic net deploy + pulse.
    this.netLevel = THREE.MathUtils.clamp(this.netLevel + (s.netOn ? dt / 1.2 : -dt / 0.8), 0, 1);
    const ease = 1 - Math.pow(1 - this.netLevel, 3);
    this.net.group.visible = this.netLevel > 0.001;
    this.net.group.position.set(this.pos.x, this.pos.y + 0.1, this.pos.z);
    this.net.group.scale.set(0.4 + 0.6 * ease, Math.max(0.001, ease), 0.4 + 0.6 * ease);
    const pulse = 0.5 + 0.5 * Math.sin(time * 3.1);
    this.net.wireMat.opacity = (0.32 + 0.3 * pulse) * ease;
    this.net.shellMat.opacity = (0.035 + 0.03 * pulse) * ease;
    this.net.ringMat.opacity = 0.85 * ease;

    const center = new THREE.Vector3(this.pos.x, this.pos.y + 0.1, this.pos.z);
    this.dust.update(dt, center, this.netLevel, s.plumeActive);

    if (s.tick !== this.lastTick) {
      this.lastTick = s.tick;
      this.updateRadiation(s, view);
      this.updateLabels(s, view);
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
    this.reportHud(dt);
  };

  private applyPreset(view: ViewState, s: SimSnapshot) {
    if (view.presetNonce === this.lastPresetNonce) return;
    const first = this.lastPresetNonce < 0;
    this.lastPresetNonce = view.presetNonce;
    if (first) return;
    const p = PRESETS[view.cameraPreset];
    const off = view.cameraPreset === 'reactor' ? new THREE.Vector3(s.reactor.x, heightAt(s.reactor.x, s.reactor.z) + 2, s.reactor.z) : new THREE.Vector3();
    this.camAnim = {
      from: this.camera.position.clone(),
      to: new THREE.Vector3(...p.pos).add(off),
      tFrom: this.controls.target.clone(),
      tTo: new THREE.Vector3(...p.target).add(off),
      t: 0,
    };
  }

  private animateCamera(dt: number) {
    const a = this.camAnim;
    if (!a) return;
    a.t = Math.min(1, a.t + dt / 1.1);
    const k = a.t < 0.5 ? 4 * a.t ** 3 : 1 - Math.pow(-2 * a.t + 2, 3) / 2;
    this.camera.position.lerpVectors(a.from, a.to, k);
    this.controls.target.lerpVectors(a.tFrom, a.tTo, k);
    if (a.t >= 1) this.camAnim = null;
  }

  private placeCone(mesh: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3, halfW: number, halfH: number) {
    const len = from.distanceTo(to);
    mesh.position.copy(from);
    mesh.lookAt(to);
    mesh.scale.set(len * Math.tan(halfW), len * Math.tan(halfH), len);
  }

  private updateRadiation(s: SimSnapshot, view: ViewState) {
    const core = new THREE.Vector3(s.reactor.x, heightAt(s.reactor.x, s.reactor.z) + CORE_HEIGHT, s.reactor.z);
    const ht = habitatTarget();
    const hab = new THREE.Vector3(ht.x, ht.y + 0.6, ht.z);
    const secure = s.radiation.habitat.secure;
    this.habCone.visible = view.showCones;
    this.placeCone(this.habCone, core, hab, 0.11, 0.05);
    (this.habCone.material as THREE.MeshBasicMaterial).color.copy(secure ? GREEN : RED);
    (this.habCone.material as THREE.MeshBasicMaterial).opacity = secure ? 0.2 : 0.3;

    this.hazCones.forEach((c, k) => {
      const idx = s.radiation.hazardSectors[k];
      c.visible = view.showCones && idx !== undefined;
      if (idx === undefined) return;
      const t = s.radiation.sectors[idx].target;
      this.placeCone(c, core, new THREE.Vector3(t.x, t.y + 0.4, t.z), 0.13, 0.05);
    });

    const g = this.tracking.geometry as THREE.BufferGeometry;
    g.setFromPoints([core, hab]);
    this.tracking.computeLineDistances();
    this.tracking.visible = view.showCones;
    (this.tracking.material as THREE.LineDashedMaterial).color.set(secure ? 0x67e8f9 : 0xff6b6b);

    // Dose ring colours (green inside the B4C shadow, red where > limit).
    const col = this.doseRing.geometry.attributes.color as THREE.BufferAttribute;
    s.radiation.sectors.forEach((sec, i) => {
      const hot = sec.dose > DOSE_LIMIT;
      const k = hot ? Math.min(1, 0.35 + Math.log10(sec.dose / DOSE_LIMIT) * 0.6) : 0.9;
      const c = hot ? [k, 0.08 * k, 0.05 * k] : [0.1 * k, k, 0.45 * k];
      for (let v = 0; v < 6; v++) col.setXYZ(i * 6 + v, c[0], c[1], c[2]);
    });
    col.needsUpdate = true;
    this.doseRing.visible = view.showCones;
  }

  private updateLabels(s: SimSnapshot, view: ViewState) {
    for (const l of Object.values(this.lbl)) l.obj.visible = view.showLabels;
    if (!view.showLabels) return;
    const base = this.pos;
    const wingTip = (i: number, extra = 0) => {
      const a = (wingAzimuth(i) * Math.PI) / 180;
      const r = WING_ROOT + WING_LENGTH * 0.75 + extra;
      return new THREE.Vector3(base.x + Math.sin(a) * r, base.y + CORE_HEIGHT - 0.4, base.z - Math.cos(a) * r);
    };

    // Wing 0 thermal callout.
    const hot = s.dust[0] > 0.3 || s.wingTemps[0] > 600;
    this.lbl.dust.el.className = `hud-label ${hot ? 'hud-red' : 'hud-cyan'}`;
    this.lbl.dust.el.innerHTML = hot
      ? `<b>DUST OVERHEATING</b><span>WING 0 · D ${(s.dust[0] * 100).toFixed(0)}% · ε ${s.emissivity[0].toFixed(2)}</span><span>NaK MANIFOLD ${s.wingTemps[0].toFixed(0)}K</span>`
      : `<b>WING 0 NOMINAL</b><span>D ${(s.dust[0] * 100).toFixed(0)}% · ε ${s.emissivity[0].toFixed(2)}</span><span>MANIFOLD ${s.wingTemps[0].toFixed(0)}K</span>`;
    this.lbl.dust.obj.position.copy(wingTip(0, 0.5));

    const prad = s.pRad.reduce((a, b) => a + b, 0) / 1000;
    const epsAvg = s.emissivity.reduce((a, b) => a + b, 0) / 4;
    this.lbl.wings.el.innerHTML = `<b>RADIATING WINGS</b><span>4 × 42 m² · ε̄ ${epsAvg.toFixed(2)}</span><span>P<sub>rad</sub> ${prad.toFixed(1)} kW → 40K SINK</span>`;
    this.lbl.wings.obj.position.copy(wingTip(3, 1.5));

    const hz = s.radiation.hazardSectors[0];
    this.lbl.hazard.obj.visible = view.showCones && hz !== undefined;
    if (hz !== undefined) {
      const sec = s.radiation.sectors[hz];
      this.lbl.hazard.el.innerHTML = `<b>HAZARD SHADOW</b><span>AZ ${sec.azimuth.toFixed(0)}° · ${sec.dose.toFixed(0)} rem/yr</span>`;
      const t = sec.target;
      this.lbl.hazard.obj.position.set(t.x, t.y + 2.2, t.z);
    }

    const hab = s.radiation.habitat;
    const ht = habitatTarget();
    this.lbl.habitat.el.className = `hud-label ${hab.secure ? 'hud-cyan' : 'hud-red'}`;
    this.lbl.habitat.el.innerHTML = hab.secure
      ? `<b>HABITAT DOME</b><b>SECURE</b><span>${hab.dose.toFixed(2)} rem/yr &lt; ${DOSE_LIMIT}</span>`
      : `<b>HABITAT DOSE</b><b>BREACH</b><span>${hab.dose.toFixed(1)} rem/yr &gt; ${DOSE_LIMIT}</span>`;
    this.lbl.habitat.el.innerHTML += `<span>B4C θ ${s.shieldAz.toFixed(0)}° · Δθ ${hab.shieldDelta.toFixed(0)}° · S ${hab.shieldDelta <= 25 ? '0.04' : '1.00'}</span><span>REGOLITH ${hab.thickness.toFixed(1)} m · d ${hab.distance.toFixed(0)} m</span>`;
    this.lbl.habitat.obj.position.set(ht.x - 4, ht.y + 1.5, ht.z + 4);

    const core = new THREE.Vector3(s.reactor.x, base.y + CORE_HEIGHT, s.reactor.z);
    this.lbl.tracking.el.textContent = '3D TRACKING';
    this.lbl.tracking.obj.position.lerpVectors(core, new THREE.Vector3(ht.x, ht.y, ht.z), 0.62).add(new THREE.Vector3(0, 1.4, 0));
    this.lbl.tracking.obj.visible = view.showCones;

    this.lbl.net.obj.visible = s.netOn;
    this.lbl.net.el.innerHTML = `<b>ELECTROSTATIC MESH NET</b><span>+12 kV · 85% DEFLECTION · ${this.dust.deflections} HITS</span>`;
    this.lbl.net.obj.position.set(base.x - NET_RADIUS * 0.78, base.y + NET_RADIUS * 0.62, base.z + 2);
  }

  private reportHud(dt: number) {
    this.frames++;
    this.fpsTime += dt;
    if (this.fpsTime >= 0.5) {
      this.fps = this.frames / this.fpsTime;
      this.frames = 0;
      this.fpsTime = 0;
      this.dust.deflections = Math.round(this.dust.deflections * 0.5);
    }
    if (this.frames % 3) return;
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const azimuth = azimuthDeg(dir.x, dir.z);
    const inv = this.camera.matrixWorldInverse;
    const proj = (v: THREE.Vector3): [number, number] => {
      const p = v.clone().transformDirection(inv);
      return [p.x, -p.y];
    };
    this.hudCb({
      azimuth,
      axes: { x: proj(new THREE.Vector3(1, 0, 0)), y: proj(new THREE.Vector3(0, 1, 0)), z: proj(new THREE.Vector3(0, 0, 1)) },
      fps: this.fps,
    });
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.resizeObs.disconnect();
    const el = this.renderer.domElement;
    el.removeEventListener('pointerdown', this.onDown);
    el.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    this.controls.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose?.();
    });
    this.renderer.dispose();
    el.remove();
    this.labels.domElement.remove();
  }
}
