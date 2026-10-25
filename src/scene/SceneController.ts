import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { CORE_HEIGHT, LOAD_NOMINAL } from '../simulation/constants';
import type { SimSnapshot } from '../simulation/physicsEngine';
import { getSnapshot, getView, type ViewState } from '../simulation/store';
import { HABITAT_POS, RIM_RADIUS, azimuthDeg, buildTerrainGeometry, heightAt } from '../simulation/terrain';
import { wingAzimuth } from '../vision/thermalRenderer';
import {
  NET_RADIUS,
  WING_LENGTH,
  WING_ROOT,
  buildDrillRig,
  buildHabitat,
  buildNet,
  buildReactor,
  buildWings,
  type DrillParts,
  type NetParts,
  type ReactorParts,
  type WingParts,
} from './builders';
import { DustSystem } from './dust';
import { regolithTexture } from './textures';

export interface HudState {
  azimuth: number; // camera heading, deg (0 = looking north)
}

const SLATE = new THREE.Color(0x1e293b);
const HOT_A = new THREE.Color(0xff5500);
const HOT_B = new THREE.Color(0xffcc00);
const NET_CYAN = new THREE.Color(0x00ffff);
const NET_RED = new THREE.Color(0xff2a2a);
const DRILL_ON = new THREE.Color(0x22ff88);
const DRILL_OFF = new THREE.Color(0xff4a1a);
/** Ice-drill rigs stand on the western crater rim, clear of the reactor and habitat. */
const DRILL_AZIMUTHS = [298, 322, 346];
/** Seconds the faulted net flickers red before it drops out. */
const FAULT_FLICKER = 1.8;

const PRESETS: Record<ViewState['cameraPreset'], { pos: [number, number, number]; target: [number, number, number] }> = {
  orbit: { pos: [-5, 19, 35], target: [-1, -2.5, -6] },
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
  private reactor: ReactorParts;
  private wings: WingParts[];
  private wingLight: THREE.PointLight;
  private net: NetParts;
  private netLevel = 0;
  private dust = new DustSystem();
  private drills: DrillParts[] = [];
  private lbl: Record<'dust' | 'wings' | 'habitat' | 'net' | 'drills', { obj: CSS2DObject; el: HTMLDivElement }>;
  private lastTick = -1;
  private pos = new THREE.Vector3();
  private camAnim: { from: THREE.Vector3; to: THREE.Vector3; tFrom: THREE.Vector3; tTo: THREE.Vector3; t: number } | null = null;
  private lastPresetNonce = -1;
  private frames = 0;
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

    // --- terrain ---
    const tex = regolithTexture();
    const terrain = new THREE.Mesh(
      buildTerrainGeometry(128),
      new THREE.MeshStandardMaterial({ color: 0x8c8c8c, map: tex, bumpMap: tex, bumpScale: 0.9, roughness: 0.92, metalness: 0.08 }),
    );
    terrain.receiveShadow = true;
    this.scene.add(terrain);

    // --- reactor + wings ---
    this.reactor = buildReactor();
    this.wings = buildWings(this.reactor.group);
    this.scene.add(this.reactor.group);
    this.wingLight = new THREE.PointLight(0xff6a1a, 0, 14, 1.4);
    this.reactor.group.add(this.wingLight);
    const w0 = (wingAzimuth(0) * Math.PI) / 180;
    this.wingLight.position.set(Math.sin(w0) * 5.2, CORE_HEIGHT + 1.2, -Math.cos(w0) * 5.2);

    const selectRing = new THREE.Group();
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    selectRing.add(new THREE.Mesh(new THREE.RingGeometry(2.3, 2.45, 64).rotateX(-Math.PI / 2), ringMat));
    const dashed = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(Array.from({ length: 96 }, (_, i) => new THREE.Vector3(Math.cos((i / 96) * Math.PI * 2) * 5.6, 0, Math.sin((i / 96) * Math.PI * 2) * 5.6))),
      new THREE.LineDashedMaterial({ color: 0x38e1ff, dashSize: 0.5, gapSize: 0.35, transparent: true, opacity: 0.8 }),
    );
    dashed.computeLineDistances();
    selectRing.add(dashed);
    selectRing.position.y = 0.12;
    this.reactor.group.add(selectRing);

    // --- habitat ---
    const hab = buildHabitat();
    hab.position.set(HABITAT_POS.x, heightAt(HABITAT_POS.x, HABITAT_POS.z) - 0.25, HABITAT_POS.z);
    this.scene.add(hab);

    // --- ice-mining drill rigs (ISRU) on the crater rim ---
    for (const az of DRILL_AZIMUTHS) {
      const rig = buildDrillRig();
      const a = (az * Math.PI) / 180;
      const x = Math.sin(a) * (RIM_RADIUS + 1.2);
      const z = -Math.cos(a) * (RIM_RADIUS + 1.2);
      rig.group.position.set(x, heightAt(x, z) - 0.15, z);
      rig.group.rotation.y = -a;
      this.scene.add(rig.group);
      this.drills.push(rig);
    }

    // --- electrostatic net + dust ---
    this.net = buildNet();
    this.scene.add(this.net.group);
    this.scene.add(this.dust.points, this.dust.arcs, this.dust.flashes);

    // --- floating HUD callouts ---
    this.lbl = {
      dust: label('hud-red'),
      wings: label('hud-cyan'),
      habitat: label('hud-cyan'),
      net: label('hud-cyan hud-small'),
      drills: label('hud-cyan'),
    };
    for (const l of Object.values(this.lbl)) this.scene.add(l.obj);
    this.lbl.habitat.obj.center.set(1, 1); // grows leftward, away from the panel edge
    this.lbl.drills.obj.center.set(0.5, 0); // hangs below the rigs, clear of the toolbar

    const s = getSnapshot();
    this.pos.set(s.reactor.x, heightAt(s.reactor.x, s.reactor.z), s.reactor.z);
    this.reactor.group.position.copy(this.pos);
    // Wings unfold on load.
    this.wings.forEach((w) => w.pivot.scale.set(1, 1, 0.02));

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

  // ------------------------------------------------------------ frame loop
  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    const s = getSnapshot();
    const view = getView();
    const time = performance.now() / 1000;

    this.applyPreset(view, s);
    this.animateCamera(dt);
    this.reactor.group.position.copy(this.pos);
    this.reactor.shield.rotation.y = (-s.shieldAz * Math.PI) / 180;

    // Wing unfold animation.
    const tUnfold = (performance.now() - this.startTime) / 1000;
    this.wings.forEach((w, i) => {
      const k = THREE.MathUtils.clamp((tUnfold - 0.3 - i * 0.25) / 1.6, 0.02, 1);
      w.pivot.scale.z = 1 - Math.pow(1 - k, 3);
    });

    // Thermal visuals.
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

    this.updateNet(dt, time, s);
    this.updateDrills(dt, time, s);

    if (s.tick !== this.lastTick) {
      this.lastTick = s.tick;
      this.updateLabels(s, view);
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
    this.reportHud();
  };

  /** Deploys the net when engaged; on a fault it flickers red for FAULT_FLICKER s, then drops out. */
  private updateNet(dt: number, time: number, s: SimSnapshot) {
    const flickering = s.netFault && s.netFaultAge < FAULT_FLICKER;
    const want = s.netOn || flickering;
    const rate = flickering ? dt / 0.3 : want ? dt / 1.2 : -dt / 0.8;
    this.netLevel = THREE.MathUtils.clamp(this.netLevel + rate, 0, 1);
    const ease = 1 - Math.pow(1 - this.netLevel, 3);
    const color = s.netFault ? NET_RED : NET_CYAN;
    this.net.wireMat.color.copy(color);
    this.net.shellMat.color.copy(color);
    this.net.ringMat.color.copy(color);
    const flicker = flickering && Math.random() < 0.45 ? 0.08 : 1;
    this.net.group.visible = this.netLevel > 0.001;
    this.net.group.position.set(this.pos.x, this.pos.y + 0.1, this.pos.z);
    this.net.group.scale.set(0.4 + 0.6 * ease, Math.max(0.001, ease), 0.4 + 0.6 * ease);
    const pulse = 0.5 + 0.5 * Math.sin(time * 3.1);
    this.net.wireMat.opacity = (0.32 + 0.3 * pulse) * ease * flicker;
    this.net.shellMat.opacity = (0.035 + 0.03 * pulse) * ease * flicker;
    this.net.ringMat.opacity = 0.85 * ease * flicker;

    const center = new THREE.Vector3(this.pos.x, this.pos.y + 0.1, this.pos.z);
    this.dust.update(dt, center, s.netOn && this.netLevel > 0.95, s.plumeActive);
  }

  /** Augers spin and glow in proportion to their power share; a red beacon blinks when shed. */
  private updateDrills(dt: number, time: number, s: SimSnapshot) {
    const share = THREE.MathUtils.clamp(s.triage.alloc.drills / LOAD_NOMINAL.drills, 0, 1);
    const blink = Math.sin(time * 7) > 0 ? 1 : 0.15;
    this.drills.forEach((d, i) => {
      d.auger.rotation.y += dt * 11 * share;
      d.auger.position.y = share > 0 ? 0.12 * Math.sin(time * 2.4 + i * 1.7) * share : 0;
      d.augerMat.emissiveIntensity = 0.1 + 1.4 * share;
      const beacon = share > 0 ? DRILL_ON : DRILL_OFF;
      d.beaconMat.color.copy(beacon).multiplyScalar(share > 0 ? 1 : blink);
      d.beaconLight.color.copy(beacon);
      d.beaconLight.intensity = share > 0 ? 6 : 8 * blink;
    });
  }

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

  private updateLabels(s: SimSnapshot, view: ViewState) {
    for (const l of Object.values(this.lbl)) l.obj.visible = view.showLabels;
    if (!view.showLabels) return;
    const base = this.pos;
    const wingTip = (i: number, extra = 0) => {
      const a = (wingAzimuth(i) * Math.PI) / 180;
      const r = WING_ROOT + WING_LENGTH * 0.75 + extra;
      return new THREE.Vector3(base.x + Math.sin(a) * r, base.y + CORE_HEIGHT - 0.4, base.z - Math.cos(a) * r);
    };

    // Wing 0: amber while dust accumulates, red once it is overheating.
    const hot = s.dust[0] > 0.6 || s.wingTemps[0] > 700;
    const fouled = s.dust[0] > 0.12;
    this.lbl.dust.obj.visible = fouled;
    this.lbl.dust.el.className = `hud-label ${hot ? 'hud-red' : 'hud-amber'}`;
    this.lbl.dust.el.innerHTML = `<b>${hot ? 'DUST OVERHEATING' : 'DUST ON WING 0'}</b><span>DUST ${(s.dust[0] * 100).toFixed(0)}% · ε ${s.emissivity[0].toFixed(2)} · ${s.wingTemps[0].toFixed(0)}K</span>`;
    this.lbl.dust.obj.position.copy(wingTip(0, 0.5));

    const prad = s.pRad.reduce((a, b) => a + b, 0) / 1000;
    const epsAvg = s.emissivity.reduce((a, b) => a + b, 0) / 4;
    this.lbl.wings.el.innerHTML = `<b>RADIATING WINGS</b><span>ε ${epsAvg.toFixed(2)} · ${prad.toFixed(0)} kW TO SPACE</span>`;
    this.lbl.wings.obj.position.copy(wingTip(3, 1.5));

    const hy = heightAt(HABITAT_POS.x, HABITAT_POS.z);
    this.lbl.habitat.el.innerHTML = `<b>HABITAT DOME</b><span>LIFE SUPPORT ${(s.triage.alloc.life / 1000).toFixed(1)} kW · PROTECTED</span>`;
    this.lbl.habitat.obj.position.set(HABITAT_POS.x - 4, hy + 2.3, HABITAT_POS.z + 4);

    this.lbl.net.obj.visible = s.netOn || s.netFault;
    this.lbl.net.el.className = `hud-label hud-small ${s.netFault ? 'hud-red' : 'hud-cyan'}`;
    this.lbl.net.el.innerHTML = s.netFault
      ? '<b>SHIELD FAULT: OFFLINE</b><span>MESH NET HV BUS DOWN — PLUME UNOPPOSED</span>'
      : '<b>ELECTROSTATIC MESH NET — AUTO-ENGAGED</b><span>DEFLECTING 85% OF DUST</span>';
    this.lbl.net.obj.position.set(base.x - NET_RADIUS * 0.82, base.y + NET_RADIUS * 0.4, base.z + 4);

    const kw = s.triage.alloc.drills / 1000;
    const state = s.triage.failsafe ? 'DISABLED — SAVING LIFE SUPPORT' : kw < LOAD_NOMINAL.drills / 1000 - 0.5 ? 'REDUCED' : 'ACTIVE';
    this.lbl.drills.el.className = `hud-label ${s.triage.failsafe ? 'hud-red' : kw < 15.5 ? 'hud-amber' : 'hud-cyan'}`;
    this.lbl.drills.el.innerHTML = `<b>ICE DRILLS: ${kw.toFixed(1)} kW [${state}]</b><span>3 ISRU RIGS · WATER-ICE MINING</span>`;
    this.lbl.drills.obj.position.copy(this.drills[1].group.position).add(new THREE.Vector3(1.5, -0.2, 3.5));
  }

  private reportHud() {
    if (++this.frames % 3) return;
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    this.hudCb({ azimuth: azimuthDeg(dir.x, dir.z) });
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.resizeObs.disconnect();
    this.controls.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose?.();
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labels.domElement.remove();
  }
}
